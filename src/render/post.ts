import * as THREE from 'three/webgpu';
import { Fn, dot, float, length, mix, mrt, normalView, output, packNormalToRGB, pass, renderOutput, sample, screenUV, smoothstep, uniform, unpackRGBToNormal, vec2, vec3, vec4, velocity } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';

// Pós-processamento por perfil de qualidade, montado como um grafo de nós (RenderPipeline).
//   ultra: oclusão ambiente (GTAO) + bloom + profundidade de campo + antisserrilhado temporal (TRAA)
//   high:  GTAO em meia resolução + bloom + profundidade de campo + TRAA
//          (GTAO lê a profundidade, que no WebGPU não pode ser multiamostrada: por isso TRAA, não MSAA)
//   medium: MSAA 4× + gradação e vinheta (um passe barato)
//   low:   sem pipeline (desenho direto, com o MSAA do canvas)

export type Quality = 'ultra' | 'high' | 'medium' | 'low';

interface Config {
  ao: number; // 0 = desligado; senão, escala de resolução
  bloom: boolean;
  dof: boolean;
  aa: 'traa' | 'msaa' | 'fxaa';
}

const CONFIG: Record<Exclude<Quality, 'low'>, Config> = {
  ultra: { ao: 1, bloom: true, dof: true, aa: 'traa' },
  high: { ao: 0.5, bloom: true, dof: true, aa: 'traa' },
  medium: { ao: 0, bloom: false, dof: false, aa: 'msaa' },
};

/** Parâmetros ajustáveis em tempo real (sem recompilar). */
export const P = {
  aoStrength: uniform(0.85),
  vignette: uniform(0.22),
  saturation: uniform(1.06),
  focus: uniform(10),
  focalLength: uniform(4),
  bokeh: uniform(1.2),
  bloomStrength: uniform(0.35),
};

/**
 * Ombro suave: identidade até 0,8 e compressão exponencial até 1. As paletas dos temas
 * foram escolhidas sem tone mapping; curvas filmicas (AgX, ACES, Neutral) mudam os tons
 * médios e escuros. Esta só atua nos realces (bloom, brilhos na água).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const shoulder = (x: any) => {
  const a = 0.8;
  return x.min(a).add(float(1).sub(x.sub(a).max(0).div(1 - a).negate().exp()).mul(1 - a));
};

/** Vinheta, leve ajuste de saturação e o ombro, em espaço linear. */
const grade = Fn(([c]: [ReturnType<typeof vec4>]) => {
  const p = screenUV.sub(0.5).mul(vec2(1, 1.15));
  const v = smoothstep(0.9, 0.25, length(p));
  const rgb = c.rgb.mul(mix(float(1).sub(P.vignette), float(1), v));
  const l = dot(rgb, vec3(0.299, 0.587, 0.114));
  return vec4(shoulder(mix(vec3(l), rgb, P.saturation)), c.a);
});

export interface Post {
  pipeline: THREE.RenderPipeline;
  dispose(): void;
}

/** Efeitos que `?fx=` pode ligar um a um (depuração de custo): ao, traa, msaa, bloom, dof. */
export const FX_FLAGS = ['ao', 'traa', 'msaa', 'bloom', 'dof'] as const;

export function buildPost(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, q: Exclude<Quality, 'low'>, fx?: string[]): Post {
  const cfg: Config = fx
    ? { ao: fx.includes('ao') ? CONFIG[q].ao || 0.5 : 0, bloom: fx.includes('bloom'), dof: fx.includes('dof'), aa: fx.includes('traa') ? 'traa' : fx.includes('msaa') ? 'msaa' : 'fxaa' }
    : CONFIG[q];
  const disposables: { dispose(): void }[] = [];
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera, { samples: cfg.aa === 'msaa' ? 4 : 0 });
  disposables.push(scenePass);
  const outputs: Record<string, unknown> = { output };
  if (cfg.ao) outputs.normal = packNormalToRGB(normalView);
  if (cfg.aa === 'traa') outputs.velocity = velocity;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (Object.keys(outputs).length > 1) scenePass.setMRT(mrt(outputs as any));
  if (cfg.ao) scenePass.getTexture('normal').type = THREE.UnsignedByteType;
  if (cfg.aa === 'traa') scenePass.getTexture('velocity').type = THREE.HalfFloatType;

  const color = scenePass.getTextureNode('output');
  const depth = scenePass.getTextureNode('depth');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = color;

  if (cfg.ao) {
    const nrm = scenePass.getTextureNode('normal');
    const aoNode = ao(depth, sample((uv) => unpackRGBToNormal(nrm.sample(uv))), camera);
    aoNode.resolutionScale = cfg.ao;
    aoNode.radius.value = 0.22;
    aoNode.thickness.value = 0.6;
    aoNode.distanceExponent.value = 1.4;
    aoNode.scale.value = 1.1;
    aoNode.samples.value = q === 'ultra' ? 16 : 12;
    disposables.push(aoNode);
    const occ = aoNode.getTextureNode().sample(screenUV).r;
    node = vec4(color.rgb.mul(mix(float(1), occ, P.aoStrength)), color.a);
  }

  if (cfg.aa === 'traa') {
    const t = traa(node, depth, scenePass.getTextureNode('velocity'), camera);
    disposables.push(t);
    node = t;
  }

  if (cfg.bloom) {
    const b = bloom(node, P.bloomStrength, 0.45, 0.92);
    disposables.push(b);
    node = node.add(b);
  }

  if (cfg.dof) {
    const d = dof(node, scenePass.getViewZNode(), P.focus, P.focalLength, P.bokeh);
    disposables.push(d);
    node = d;
  }

  node = grade(node);
  if (cfg.aa === 'fxaa') {
    pipeline.outputColorTransform = false;
    node = fxaa(renderOutput(node));
  }
  pipeline.outputNode = node;
  return {
    pipeline,
    dispose() {
      for (const d of disposables) d.dispose();
      pipeline.dispose();
    },
  };
}
