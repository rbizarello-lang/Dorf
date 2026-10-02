import * as THREE from 'three/webgpu';
import { Fn, convertToTexture, diffuseColor, dot, float, hash, length, max, mix, mrt, normalView, output, packNormalToRGB, pass, perspectiveDepthToViewZ, renderOutput, roughness, sample, screenCoordinate, screenUV, smoothstep, uniform, unpackRGBToNormal, vec2, vec3, vec4, velocity } from 'three/tsl';
import { bilateralBlur } from 'three/addons/tsl/display/BilateralBlurNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { godrays } from 'three/addons/tsl/display/GodraysNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { sharpen } from 'three/addons/tsl/display/SharpenNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { indirectShare, ssrMask } from './materials';

// Pós-processamento por perfil de qualidade, montado como um grafo de nós (RenderPipeline).
//   ultra: iluminação indireta com oclusão (SSGI) + reflexos na água (SSR) + raios de luz
//          (godrays) + bloom + profundidade de campo + antisserrilhado temporal (TRAA)
//   high:  GTAO em meia resolução + bloom + profundidade de campo + TRAA
//          (GTAO lê a profundidade, que no WebGPU não pode ser multiamostrada: por isso TRAA, não MSAA)
//   (ultra e high também desenham o traço de tinta, o contorno dos objetos)
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
  /** Traço de tinta (contorno); precisa ler a profundidade, então não combina com MSAA. */
  ink: boolean;
  aa: 'traa' | 'msaa' | 'fxaa';
}

const CONFIG: Record<Exclude<Quality, 'low'>, Config> = {
  ultra: { ao: 0, gi: true, ssr: true, rays: true, bloom: true, dof: true, ink: true, aa: 'traa' },
  high: { ao: 0.5, gi: false, ssr: false, rays: false, bloom: true, dof: true, ink: true, aa: 'traa' },
  medium: { ao: 0, gi: false, ssr: false, rays: false, bloom: false, dof: false, ink: false, aa: 'msaa' },
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
  giStrength: uniform(0.8),
  reflection: uniform(0.9),
  /** Intensidade dos raios de luz; world.ts aumenta no amanhecer e no entardecer. */
  rays: uniform(0.25),
  rayColor: uniform(new THREE.Color(1, 0.95, 0.85)),
  /** Nitidez devolvida depois do TRAA (RCAS): 0 = máxima, 2 = nenhuma. */
  sharpness: uniform(0.4),
  /** Gradação por hora (world.ts): os realces puxam para a cor do sol e as sombras para o tom oposto. */
  shade: uniform(new THREE.Color(1, 1, 1)),
  light: uniform(new THREE.Color(1, 1, 1)),
  /** Traço de tinta: força (0 = sem contorno) e a cor da tinta (linear). */
  ink: uniform(0.9),
  inkColor: uniform(new THREE.Color(0.045, 0.03, 0.022)),
  /** Distâncias da câmera em que o traço começa a sumir e some de todo (world.ts, pelo zoom). */
  inkNear: uniform(20),
  inkFar: uniform(40),
};

/**
 * Máscara do reflexo no alfa da normal: só a água grava valores entre ~0,04 e ~0,09 (a
 * máscara própria dela, `ssrMask`); os outros materiais gravam a rugosidade (o vidro e o
 * cristal ficam em 0,2 ou mais; materiais sem PBR leem 0). A espuma apaga o reflexo.
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

/**
 * Vinheta, gradação por zona, saturação e o ombro, em espaço linear. Os realces ganham um
 * toque da cor do sol e as sombras um do tom oposto (na tarde: realce dourado, sombra azulada,
 * como numa foto com o céu iluminando a sombra); no escuro profundo a cor some um pouco.
 */
const grade = Fn(([c]: [ReturnType<typeof vec4>]) => {
  const p = screenUV.sub(0.5).mul(vec2(1, 1.15));
  const v = smoothstep(0.9, 0.25, length(p));
  const lit = c.rgb.mul(mix(float(1).sub(P.vignette), float(1), v));
  const l = dot(lit, vec3(0.299, 0.587, 0.114));
  const rgb = lit.mul(mix(vec3(1), P.shade, smoothstep(0.3, 0.02, l))).mul(mix(vec3(1), P.light, smoothstep(0.35, 0.85, l)));
  const sat = P.saturation.mul(smoothstep(0, 0.06, l).mul(0.12).add(0.88));
  return vec4(shoulder(mix(vec3(l), rgb, sat)), c.a);
});

/** Ruído triangular de ±1 nível de 8 bits, depois da conversão para sRGB: tira as faixas do céu e da névoa. */
const dither = Fn(([c]: [ReturnType<typeof vec4>]) => {
  const px = screenCoordinate.xy.floor();
  const seed = px.x.add(px.y.mul(4096));
  const n = hash(seed).add(hash(seed.add(4194304))).sub(1);
  return vec4(c.rgb.add(n.div(255)), c.a);
});

/**
 * Normal da cena para GTAO, SSGI e SSR. O WebGPU limita a 32 bytes por amostra o total das
 * saídas (cada RGBA8 conta 8): cor, normal, difusa e velocidade já ocupam tudo, então a
 * rugosidade (máscara da água) vai no alfa; sem reflexos, o alfa leva a parte indireta da
 * luz (ver `indirectShare`). Materiais transparentes (partículas, casas vazias) saem com
 * alfa 0: a mistura usa o alfa de cada saída e a normal de trás fica intacta; antes, cada
 * partícula deixava um quadrado de normal errada na oclusão.
 */
const sceneNormal = (withRoughness: boolean) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Fn((builder: any) => {
    const m = builder.material as (THREE.Material & { roughness?: number }) | null;
    if (m?.transparent) return vec4(0);
    const mask = m && ssrMask.get(m);
    return vec4(packNormalToRGB(normalView), !withRoughness ? indirectShare(m) : mask ? mask : m?.roughness !== undefined ? roughness : float(1));
  })();

/**
 * Traço de tinta, como o contorno desenhado do Dorfromantik. Cada pixel olha os vizinhos até
 * `w` pixels (3 em 1080p, 6 em 4K): se algum está bem mais longe, o pixel é a silhueta de um
 * objeto à frente e escurece na cor dele (o traço fica do lado do objeto, não do fundo). Com a
 * normal, as quinas vivas (canto de parede, beiral) ganham um traço mais leve; as facetas do
 * chão e das copas dobram menos que o limiar. Vem antes do TRAA, que o antisserrilha.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ink = (input: any, depth: any, normal: any, camera: THREE.PerspectiveCamera) =>
  Fn(() => {
    const near = uniform(camera.near);
    const far = uniform(camera.far);
    const size = vec2(depth.size(0));
    const w = max(float(2), size.y.div(360).round());
    const px = vec2(1).div(size);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const distAt = (uv: any) => perspectiveDepthToViewZ(depth.sample(uv).r, near, far).negate();
    const dc = distAt(screenUV);
    // Oito direções na distância w e quatro na metade: a linha fica cheia também na diagonal.
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    const offs = [...dirs.map(([x, y]) => px.mul(vec2(x, y)).mul(w)), ...dirs.slice(0, 4).map(([x, y]) => px.mul(vec2(x, y)).mul(w.mul(0.5).ceil()))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let gap: any = float(0);
    for (const o of offs) gap = max(gap, distAt(screenUV.add(o)).sub(dc));
    // Salto relativo: o chão visto de lado varia pouco por pixel; uma casa contra o chão, muito.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let e: any = smoothstep(0.015, 0.04, gap.div(dc));
    if (normal) {
      const nc = unpackRGBToNormal(normal.sample(screenUV).rgb);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bend: any = float(0);
      for (const o of offs.slice(8)) bend = max(bend, float(1).sub(dot(nc, unpackRGBToNormal(normal.sample(screenUV.add(o)).rgb))));
      e = max(e, smoothstep(0.3, 0.6, bend).mul(0.5));
    }
    e = e.mul(smoothstep(P.inkFar, P.inkNear, dc)).mul(P.ink);
    // Quase só tinta, com um pouco da cor do objeto: escuro também sobre a mata escura.
    const line = mix(input.rgb.mul(0.3), P.inkColor, 0.7);
    return vec4(mix(input.rgb, line, e), input.a);
  })();

/** Cor difusa da cena (rebatimento do SSGI) e, no alfa, a parte indireta da luz. */
const sceneDiffuse = Fn((builder: { material: THREE.Material | null }) => {
  const m = builder.material;
  return m?.transparent ? vec4(0) : vec4(diffuseColor.rgb, indirectShare(m));
})();

/**
 * Oclusão com rebatimento colorido (Jimenez et al., 2016): uma superfície clara devolve aos
 * cantos parte da luz que a oclusão tira, na cor dela. O pé da grama fica verde-escuro, não cinza.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const multiBounce = (occ: any, albedo: any) => {
  const a = albedo.mul(2.0404).sub(0.3324);
  const b = albedo.mul(-4.7951).add(0.6417);
  const c = albedo.mul(2.7552).add(0.6903);
  return max(vec3(occ), occ.mul(a).add(b).mul(occ).add(c).mul(occ));
};

export interface Post {
  pipeline: THREE.RenderPipeline;
  /** A cena grava a cor difusa (saída `diffuse`) para a luz indireta. */
  gi: boolean;
  /** Há média temporal (TRAA): o ruído que muda a cada quadro some. */
  temporal: boolean;
  dispose(): void;
}

/** Efeitos que `?fx=` pode ligar um a um (depuração de custo): ao, gi, ssr, rays, traa, msaa, bloom, dof, ink. */
export const FX_FLAGS = ['ao', 'gi', 'ssr', 'rays', 'traa', 'msaa', 'bloom', 'dof', 'ink'] as const;

/**
 * `rayLight` é a luz cujo mapa de sombra os raios percorrem. Precisa ser uma DirectionalLight
 * com sombra própria: as cascatas do sol (CSMShadowNode) não expõem um mapa único.
 * `clouds` é a cena das nuvens, desenhada por cima da cena principal.
 */
export function buildPost(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, q: Exclude<Quality, 'low'>, fx?: string[], rayLight?: THREE.DirectionalLight, clouds?: THREE.Scene): Post {
  const cfg: Config = fx
    ? { ao: fx.includes('ao') ? CONFIG[q].ao || 0.5 : 0, gi: fx.includes('gi'), ssr: fx.includes('ssr'), rays: fx.includes('rays'), bloom: fx.includes('bloom'), dof: fx.includes('dof'), ink: fx.includes('ink') && !fx.includes('msaa'), aa: fx.includes('traa') ? 'traa' : fx.includes('msaa') ? 'msaa' : 'fxaa' }
    : CONFIG[q];
  if (!rayLight) cfg.rays = false;
  const disposables: { dispose(): void }[] = [];
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera, { samples: cfg.aa === 'msaa' ? 4 : 0 });
  disposables.push(scenePass);
  const outputs: Record<string, unknown> = { output };
  if (cfg.ao || cfg.gi || cfg.ssr) outputs.normal = sceneNormal(cfg.ssr);
  // Alfa 0 pelo mesmo motivo da normal (partículas, casas vazias); as opacas gravam sem
  // mistura e levam no alfa a parte indireta da luz.
  if (cfg.gi) outputs.diffuse = sceneDiffuse;
  if (cfg.aa === 'traa') outputs.velocity = velocity;
  if (Object.keys(outputs).length > 1) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sceneMrt = mrt(outputs as any);
    // Sem isto, só a saída `output` mistura: as outras são sobrescritas até por partículas.
    // Com a mistura do material, o alfa 0 dos transparentes deixa a normal e a difusa intactas.
    for (const k of ['normal', 'diffuse']) if (outputs[k]) sceneMrt.setBlendMode(k, new THREE.BlendMode(THREE.MaterialBlending));
    scenePass.setMRT(sceneMrt);
  }
  if (outputs.normal) scenePass.getTexture('normal').type = THREE.UnsignedByteType;
  if (cfg.gi) scenePass.getTexture('diffuse').type = THREE.UnsignedByteType;
  if (cfg.aa === 'traa') scenePass.getTexture('velocity').type = THREE.HalfFloatType;

  const color = scenePass.getTextureNode('output');
  const depth = scenePass.getTextureNode('depth');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = color;
  const nrm = outputs.normal ? scenePass.getTextureNode('normal') : null;
  const normalOf = nrm ? sample((uv) => unpackRGBToNormal(nrm.sample(uv).rgb)) : null;
  // Parte indireta da luz em cada pixel: a oclusão só escurece essa parte da cor.
  const diffuse = cfg.gi ? scenePass.getTextureNode('diffuse') : null;
  const share = diffuse ? diffuse.a : nrm && !cfg.ssr ? nrm.a : float(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const occlude = (rgb: any, occ: any) => rgb.mul(vec3(1).sub(vec3(1).sub(occ).mul(share)));

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
    // Sem o rebatimento colorido da oclusão: aqui a luz rebatida vem do próprio SSGI.
    const occ = mix(float(1), g.a, P.aoStrength);
    // A luz rebatida entra só onde há oclusão (sob as copas, junto às paredes). No chão
    // aberto e ondulado, o SSGI soma o próprio chão iluminado e apagaria as sombras longas.
    const bounce = diffuse!.rgb.mul(g.rgb).mul(P.giStrength).mul(float(1).sub(g.a));
    node = vec4(occlude(color.rgb, occ).add(bounce), color.a);
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
    const occ = mix(float(1), (clean as unknown as { r: ReturnType<typeof float> }).r, P.aoStrength);
    // Sem a cor difusa no passe, o rebatimento usa a matiz do pixel com a claridade de um chão.
    const albedo = diffuse ? diffuse.rgb : color.rgb.div(max(color.r, max(color.g, color.b)).max(1e-4)).mul(0.42);
    node = vec4(occlude(node.rgb, multiBounce(occ, albedo)), color.a);
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

  // O traço vem antes das nuvens: elas passam por cima do mapa sem contorno.
  if (cfg.ink) node = ink(node, depth, nrm, camera);

  if (clouds) {
    // Nuvens (clouds.ts) num passe à parte, por cima da luz indireta, da oclusão e dos reflexos:
    // no passe da cena, elas herdariam a oclusão e o rebatimento do chão que fica embaixo delas.
    const over = pass(clouds, camera, { depthBuffer: false });
    // Limpa com alfa 0 (o renderizador limparia com 1): onde não há nuvem, a cena passa inteira.
    over.setMRT(mrt({ output }).setClearColor('output', 0x000000, 0));
    // Sem TRAA, meia resolução: a nuvem é macia, e o passe custa um quarto.
    if (cfg.aa !== 'traa') over.setResolutionScale(0.5);
    disposables.push(over);
    // A mistura do material já deixa a cor multiplicada pelo alfa.
    const c = over.getTextureNode('output');
    node = vec4(node.rgb.mul(float(1).sub(c.a)).add(c.rgb), node.a);
  }

  if (cfg.aa === 'traa') {
    const t = traa(node, depth, scenePass.getTextureNode('velocity'), camera);
    disposables.push(t);
    // O TRAA amolece a imagem; o RCAS devolve o detalhe sem realçar o ruído do SSGI.
    const sh = sharpen(t, P.sharpness, true);
    disposables.push(sh);
    node = sh;
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

  // A conversão para sRGB fica aqui, e não no fim do pipeline, para o dither vir depois dela.
  pipeline.outputColorTransform = false;
  node = renderOutput(grade(node));
  if (cfg.aa === 'fxaa') node = fxaa(node);
  pipeline.outputNode = dither(node);
  return {
    pipeline,
    gi: cfg.gi,
    temporal: cfg.aa === 'traa',
    dispose() {
      for (const d of disposables) d.dispose();
      pipeline.dispose();
    },
  };
}
