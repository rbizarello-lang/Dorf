import * as THREE from 'three/webgpu';
import { Fn, convertToTexture, diffuseColor, dot, float, length, mix, mrt, normalView, output, packNormalToRGB, pass, renderOutput, roughness, sample, screenUV, smoothstep, uniform, unpackRGBToNormal, vec2, vec3, vec4, velocity } from 'three/tsl';
import { bilateralBlur } from 'three/addons/tsl/display/BilateralBlurNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { godrays } from 'three/addons/tsl/display/GodraysNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';

// Pós-processamento por perfil de qualidade, montado como um grafo de nós (RenderPipeline).
//   ultra: iluminação indireta com oclusão (SSGI) + reflexos na água (SSR) + raios de luz
//          (godrays) + bloom + profundidade de campo + antisserrilhado temporal (TRAA)
//   high:  GTAO em meia resolução + bloom + profundidade de campo + TRAA
//          (GTAO lê a profundidade, que no WebGPU não pode ser multiamostrada: por isso TRAA, não MSAA)
//   medium: MSAA 4× + gradação e vinheta (um passe barato)
//   low:   sem pipeline (desenho direto, com o MSAA do canvas)

export type Quality = 'ultra' | 'high' | 'medium' | 'low';

interface Config {
  ao: number; // 0 = desligado; senão, escala de resolução
  gi: boolean; // SSGI: luz que rebate entre superfícies; já inclui a oclusão (substitui o GTAO)
  ssr: boolean;
  rays: boolean;
  bloom: boolean;
  dof: boolean;
  aa: 'traa' | 'msaa' | 'fxaa';
}

const CONFIG: Record<Exclude<Quality, 'low'>, Config> = {
  ultra: { ao: 0, gi: true, ssr: true, rays: true, bloom: true, dof: true, aa: 'traa' },
  high: { ao: 0.5, gi: false, ssr: false, rays: false, bloom: true, dof: true, aa: 'traa' },
  medium: { ao: 0, gi: false, ssr: false, rays: false, bloom: false, dof: false, aa: 'msaa' },
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
  giStrength: uniform(0.3),
  reflection: uniform(0.9),
  /** Intensidade dos raios de luz; world.ts aumenta no amanhecer e no entardecer. */
  rays: uniform(0.25),
  rayColor: uniform(new THREE.Color(1, 0.95, 0.85)),
};

/**
 * Só a água tem rugosidade abaixo de ~0,1 (o vidro e o cristal ficam em 0,2 ou mais;
 * materiais sem PBR leem 0). A espuma sobe a rugosidade e apaga o reflexo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WATER_MASK = (r: any) => smoothstep(0.02, 0.04, r).mul(smoothstep(0.14, 0.09, r));

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
  /** A cena grava a cor difusa (saída `diffuse`) para a luz indireta. */
  gi: boolean;
  dispose(): void;
}

/** Efeitos que `?fx=` pode ligar um a um (depuração de custo): ao, gi, ssr, rays, traa, msaa, bloom, dof. */
export const FX_FLAGS = ['ao', 'gi', 'ssr', 'rays', 'traa', 'msaa', 'bloom', 'dof'] as const;

/**
 * `rayLight` é a luz cujo mapa de sombra os raios percorrem. Precisa ser uma DirectionalLight
 * com sombra própria: as cascatas do sol (CSMShadowNode) não expõem um mapa único.
 */
export function buildPost(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, q: Exclude<Quality, 'low'>, fx?: string[], rayLight?: THREE.DirectionalLight): Post {
  const cfg: Config = fx
    ? { ao: fx.includes('ao') ? CONFIG[q].ao || 0.5 : 0, gi: fx.includes('gi'), ssr: fx.includes('ssr'), rays: fx.includes('rays'), bloom: fx.includes('bloom'), dof: fx.includes('dof'), aa: fx.includes('traa') ? 'traa' : fx.includes('msaa') ? 'msaa' : 'fxaa' }
    : CONFIG[q];
  if (!rayLight) cfg.rays = false;
  const disposables: { dispose(): void }[] = [];
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera, { samples: cfg.aa === 'msaa' ? 4 : 0 });
  disposables.push(scenePass);
  const outputs: Record<string, unknown> = { output };
  // O WebGPU limita a 32 bytes por amostra o total das saídas (cada RGBA8 conta 8):
  // cor, normal, difusa e velocidade já ocupam tudo, então a rugosidade vai no alfa da normal.
  if (cfg.ao || cfg.gi || cfg.ssr) outputs.normal = cfg.ssr ? vec4(packNormalToRGB(normalView), roughness) : packNormalToRGB(normalView);
  // Alfa 0: peças transparentes (casas vazias, anel do cursor) misturam pelo alfa de cada
  // saída e assim não sujam a cor difusa; as opacas gravam sem mistura.
  if (cfg.gi) outputs.diffuse = vec4(diffuseColor.rgb, 0);
  if (cfg.aa === 'traa') outputs.velocity = velocity;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (Object.keys(outputs).length > 1) scenePass.setMRT(mrt(outputs as any));
  if (outputs.normal) scenePass.getTexture('normal').type = THREE.UnsignedByteType;
  if (cfg.gi) scenePass.getTexture('diffuse').type = THREE.UnsignedByteType;
  if (cfg.aa === 'traa') scenePass.getTexture('velocity').type = THREE.HalfFloatType;

  const color = scenePass.getTextureNode('output');
  const depth = scenePass.getTextureNode('depth');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = color;
  const nrm = outputs.normal ? scenePass.getTextureNode('normal') : null;
  const normalOf = nrm ? sample((uv) => unpackRGBToNormal(nrm.sample(uv).rgb)) : null;

  if (cfg.gi && normalOf) {
    // Luz indireta: a cor das superfícies vizinhas tinge as sombras (grama sob as casas,
    // telhado colorido sobre a parede). O canal alfa traz a oclusão.
    const g = ssgi(color, depth, normalOf, camera);
    g.sliceCount.value = 2;
    g.stepCount.value = 12;
    g.radius.value = 3;
    g.thickness.value = 0.35;
    g.giIntensity.value = 4;
    g.aoIntensity.value = 1;
    g.useTemporalFiltering = cfg.aa === 'traa';
    disposables.push(g);
    const diffuse = scenePass.getTextureNode('diffuse');
    const occ = mix(float(1), g.a, P.aoStrength);
    node = vec4(color.rgb.mul(occ).add(diffuse.rgb.mul(g.rgb).mul(P.giStrength)), color.a);
  }

  if (cfg.ao && normalOf) {
    const aoNode = ao(depth, normalOf, camera);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aoNode.resolutionScale = cfg.ao;
    aoNode.radius.value = 0.22;
    aoNode.thickness.value = 0.6;
    aoNode.distanceExponent.value = 1.4;
    aoNode.scale.value = 1.1;
    aoNode.samples.value = q === 'ultra' ? 16 : 12;
    // Com TRAA, o ruído do GTAO gira a cada quadro e a média temporal o apaga.
    aoNode.useTemporalFiltering = cfg.aa === 'traa';
    disposables.push(aoNode);
    // Filtro de ruído que respeita profundidade e normal: a oclusão sai limpa já no
    // primeiro quadro, sem depender da média temporal.
    const clean = denoise(aoNode.getTextureNode(), depth, normalOf, camera);
    clean.radius.value = 6;
    disposables.push(clean);
    const occ = (clean as unknown as { r: ReturnType<typeof float> }).r;
    node = vec4(color.rgb.mul(mix(float(1), occ, P.aoStrength)), color.a);
  }

  if (cfg.ssr && normalOf) {
    // Reflexos só na água: céu, margens, casas e árvores espelhados na correnteza.
    const mask = WATER_MASK(scenePass.getTextureNode('normal').a);
    // As ondas da normal espalham demais os raios: o reflexo usa uma normal mais calma,
    // puxada para o "para cima" do mundo (em espaço de câmera).
    const up = uniform(camera.matrixWorldInverse).mul(vec4(0, 1, 0, 0)).xyz;
    const calm = sample((uv) => {
      const n = nrm!.sample(uv);
      return mix(unpackRGBToNormal(n.rgb), up, WATER_MASK(n.a).mul(0.8)).normalize();
    });
    const r = ssr(convertToTexture(node), depth, calm, { metalnessNode: mask, roughnessNode: float(0.05), camera });
    r.maxDistance.value = 12;
    r.thickness.value = 0.6;
    r.quality.value = 1;
    r.resolutionScale = 0.5;
    disposables.push(r);
    node = vec4(node.rgb.add(r.rgb.mul(P.reflection)), node.a);
  }

  if (cfg.rays && rayLight) {
    // Raios de luz: o mapa de sombra percorrido pelo ar dá os feixes entre árvores e telhados.
    const gr = godrays(depth, camera, rayLight);
    gr.raymarchSteps.value = 48;
    gr.density.value = 0.5;
    gr.maxDensity.value = 0.5;
    gr.distanceAttenuation.value = 1.2;
    disposables.push(gr);
    const blurred = bilateralBlur(gr.getTextureNode(), vec2(1, 1), 2, 0.6);
    disposables.push(blurred);
    // O canal vermelho é a luz espalhada no ar iluminado ao longo do raio (0 = nenhuma).
    const lit = blurred.r.mul(P.rays);
    node = vec4(mix(node.rgb, P.rayColor, lit), node.a);
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
    gi: cfg.gi,
    dispose() {
      for (const d of disposables) d.dispose();
      pipeline.dispose();
    },
  };
}
