import * as THREE from 'three/webgpu';
import {
  BRDF_GGX,
  BRDF_Lambert,
  F_Schlick,
  Fn,
  Loop,
  abs,
  attribute,
  cameraPosition,
  cameraViewMatrix,
  clamp,
  cos,
  dFdx,
  dFdy,
  diffuseContribution,
  dot,
  exp,
  float,
  floor,
  fract,
  fwidth,
  hash,
  instanceIndex,
  length,
  max,
  min,
  mix,
  mod,
  modelWorldMatrix,
  normalView,
  normalWorld,
  positionGeometry,
  positionLocal,
  positionPrevious,
  positionViewDirection,
  positionWorld,
  reference,
  refract,
  renderGroup,
  roughness,
  select,
  sign,
  sin,
  smoothstep,
  specularColor,
  specularColorBlended,
  specularF90,
  step,
  texture,
  uniform,
  uniformArray,
  varying,
  vec2,
  vec3,
  vec4,
  vertexColor,
} from 'three/tsl';
import { CAUSTIC_FRAMES, CAUSTIC_SIZE, makeCausticTexture, makeNoiseTexture, makeWaterTexture } from './noise';

// Materiais do jogo em TSL (nós do three.js), que compilam tanto para WebGPU
// quanto para WebGL2. Atributos por vértice dos kits (ver lib.ts):
//   color = cor fixa da parte; tint = 1 → a parte recebe a cor da instância; glow = 1 → acende à noite.
// Atributo por instância: iColor (a cor sorteada para cada árvore, casa, planta...).
// As instâncias usam `InstancedMesh` com a geometria embrulhada por `withInstanceColor`.

/** Uniformes globais, atualizados pelo World a cada quadro. */
export const U = {
  time: uniform(0),
  /** Passo do quadro (para o vetor de movimento das plantas no antisserrilhado temporal). */
  dt: uniform(1 / 60),
  wind: uniform(new THREE.Vector2(0.8, 0.6).normalize()),
  night: uniform(0),
  clouds: uniform(0.16),
  sparkle: uniform(new THREE.Color('#ffffff')),
  glow: uniform(new THREE.Color('#ffd98a')),
  water: uniform(new THREE.Color('#63b1dc')),
  /** Onda no chão quando uma peça assenta: (x, z, instante inicial, força). */
  ripple: uniform(new THREE.Vector4(0, 0, -100, 0)),
  /** Direção (para o sol) e cor da luz do sol: o caminho do sol dentro da água e a luz de contorno dos kits. */
  sunDir: uniform(new THREE.Vector3(-0.5, 0.8, 0.3).normalize()),
  sun: uniform(new THREE.Color('#fff0d8')),
};

export const noiseTex = makeNoiseTexture();
export const waterTex = makeWaterTexture();

// Os tipos do TSL distinguem nós "variáveis" de expressões e travam composições válidas;
// nos auxiliares abaixo usamos um tipo aberto (a validação real é a compilação do shader).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;
type N2 = N;
type N3 = N;

/** Sombra das nuvens (1 = sol pleno): só escurece a luz direta. */
export const cloudLight = Fn(([p]: [N2]) => {
  const uv = p.div(42).add(vec2(U.time.mul(0.0031), U.time.mul(0.0017)));
  const n = texture(noiseTex, uv).r;
  return float(1).sub(U.clouds.mul(smoothstep(0.47, 0.7, n)).mul(1.8));
});

/**
 * Onda que corre pelo chão a partir da peça que assentou: um pulso que sobe e desce,
 * some em ~1,5 s e não mexe na própria peça (começa na borda dela).
 */
const rippleY = (pw: N, t: N) => {
  const d = length(pw.xz.sub(U.ripple.xy));
  const age = t.sub(U.ripple.z).max(0);
  const x = d.sub(age.mul(3.2).add(0.75));
  const wave = sin(x.mul(10)).mul(exp(x.mul(x).mul(-14)));
  return wave.mul(exp(age.mul(-1.9))).mul(smoothstep(0.6, 0.95, d)).mul(U.ripple.w).mul(0.042);
};

/** Desloca `positionLocal` (e `positionPrevious`, para o TRAA) pela onda e por um extra opcional. */
function displaced(extra?: (p: N, t: N, now: boolean) => N) {
  return Fn(() => {
    const now = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
    const prev = modelWorldMatrix.mul(vec4(positionPrevious, 1)).xyz;
    const tPrev = U.time.sub(U.dt);
    let dNow: N = vec3(0, rippleY(now, U.time), 0);
    let dPrev: N = vec3(0, rippleY(prev, tPrev), 0);
    if (extra) {
      dNow = dNow.add(extra(positionLocal, U.time, true));
      dPrev = dPrev.add(extra(positionPrevious, tPrev, false));
    }
    positionPrevious.addAssign(dPrev);
    return positionLocal.add(dNow);
  })();
}

/** Recebe a sombra do sol e multiplica pelas nuvens (o tipo do three declara a função sem parâmetro). */
const shadowWithClouds = Fn(([shadow]: [N]) => shadow.mul(cloudLight(positionWorld.xz))) as unknown as () => THREE.Node;

/** Deslocamento do vento nas copas (espaço do mundo; `h` = altura acima do tronco). */
const treeSway = (p: N3, h: N, t: N) => {
  const ph = p.x.mul(0.55).add(p.z.mul(0.45));
  const gust = sin(dot(p.xz, U.wind).mul(0.8).sub(t.mul(0.9))).mul(0.4).add(0.6);
  return vec3(sin(t.mul(1.6).add(ph)).mul(0.05), float(0), cos(t.mul(1.3).add(ph.mul(1.2))).mul(0.04)).mul(h.mul(gust));
};

/** Onda de vento que atravessa as plantações: dobra as plantas a favor do vento. */
const cropBend = (p: N3, hgt: N, t: N) => {
  const wave = sin(dot(p.xz, U.wind).mul(2.4).sub(t.mul(2.2))).mul(0.5).add(0.5);
  const gust = wave.mul(wave);
  const bend = hgt.mul(hgt).mul(gust.mul(3.8).add(1.2));
  const jig = vec2(sin(t.mul(3.1).add(p.x.mul(9))), cos(t.mul(2.7).add(p.z.mul(7)))).mul(hgt.mul(0.06));
  const xz = U.wind.mul(bend).add(jig);
  return { d: vec3(xz.x, bend.mul(-0.45), xz.y), gust };
};

interface DecoOpts {
  sway?: 'tree' | 'crop';
  /** Fiadas de telha nas superfícies inclinadas tingidas (telhados), só de perto. */
  shingles?: boolean;
  /** Contorno luminoso nas bordas das copas, na cor do sol. */
  rim?: boolean;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  side?: THREE.Side;
}

/** Material dos kits instanciados: cor por vértice × cor da instância (onde tint = 1), janelas acesas à noite. */
function decoMaterial(o: DecoOpts) {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: o.roughness ?? 0.85, metalness: o.metalness ?? 0, flatShading: true, side: o.side ?? THREE.FrontSide });
  const tint = attribute('tint', 'float');
  const glow = attribute('glow', 'float');
  const iColor = attribute('iColor', 'vec3');
  let base: N3 = vertexColor().rgb.mul(mix(vec3(1), iColor, tint));
  // positionLocal já vem transformado pela instância (r186: instância antes do positionNode).
  if (o.sway === 'tree') {
    const h = max(positionGeometry.y.sub(0.08), 0);
    m.positionNode = displaced((p, t) => treeSway(p, h, t));
  } else if (o.sway === 'crop') {
    const hgt = max(positionGeometry.y, 0);
    const sheen = varying(float(0), 'vSheen');
    m.positionNode = displaced((p, t, now) => {
      const b = cropBend(p, hgt, t);
      if (now) sheen.assign(b.gust.mul(clamp(hgt.mul(14), 0, 1)));
      return b.d;
    });
    base = base.mul(sheen.mul(0.22).add(1));
  } else m.positionNode = displaced();
  const toCam = cameraPosition.sub(positionWorld);
  const camDist = length(toCam);
  if (o.shingles) {
    const roof = smoothstep(0.3, 0.45, normalWorld.y).mul(smoothstep(0.97, 0.9, normalWorld.y)).mul(tint);
    const rows = smoothstep(0.25, 0.6, abs(fract(positionWorld.y.mul(72)).sub(0.5)).mul(2));
    base = base.mul(mix(float(1), rows.mul(0.17).add(0.85), roof.mul(smoothstep(15, 6, camDist))));
  }
  m.colorNode = base;
  // Cada janela acende num momento diferente do anoitecer.
  const lit = smoothstep(0, 0.25, U.night.mul(1.25).sub(hash(instanceIndex).mul(0.5)));
  let emissive: N3 = U.glow.mul(glow).mul(varying(lit, 'vLit')).mul(2.6);
  if (o.emissive) emissive = emissive.add(uniform(new THREE.Color(o.emissive)).mul(o.emissiveIntensity ?? 0.6));
  if (o.rim) {
    const v = toCam.div(camDist);
    const rim = float(1).sub(max(dot(normalWorld, v), 0)).pow(3);
    emissive = emissive.add(U.sun.mul(base).mul(rim.mul(0.35)).mul(float(1).sub(U.night)));
  }
  m.emissiveNode = emissive;
  m.receivedShadowNode = shadowWithClouds;
  return m;
}

export type MatKey = 'deco' | 'foliage' | 'crop' | 'crystal' | 'glass';

export function makeDecoMaterials(): Record<MatKey, THREE.MeshStandardNodeMaterial> {
  return {
    deco: decoMaterial({ shingles: true }),
    foliage: decoMaterial({ sway: 'tree', roughness: 0.9, rim: true }),
    crop: decoMaterial({ sway: 'crop', roughness: 0.9, side: THREE.DoubleSide }),
    crystal: decoMaterial({ sway: 'tree', roughness: 0.25, metalness: 0.1, emissive: '#3a2a66', emissiveIntensity: 0.6 }),
    glass: decoMaterial({ roughness: 0.2, metalness: 0.2 }),
  };
}

/**
 * Chão das peças. Cor por vértice (a paleta do tema) × detalhe procedural por tipo de
 * terreno, com pesos por vértice em `splat` = [prado, floresta, plantação, vila]:
 *   prado: manchas grandes claras e escuras (mais amarelas no claro) e textura fina;
 *   floresta: chão de mata mais escuro, musgo e folhas secas;
 *   plantação: terra arada com sulcos suaves;
 *   vila: terra batida com pedrinhas.
 * O topo ganha uma leve ondulação de normal (a luz rasante revela o relevo); as laterais,
 * estratos e pedras. Tudo em coordenadas de mundo, sem costura entre peças.
 */
export function makeGroundMaterial() {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0, flatShading: true });
  m.positionNode = displaced();
  const p = positionWorld.xz;
  const sp = attribute('splat', 'vec4');
  const blot = texture(noiseTex, p.div(2.6)).g;
  const blot2 = texture(noiseTex, p.div(1.1).add(vec2(0.31, 0.77))).r;
  const fine = texture(noiseTex, p.mul(0.85)).b;
  const grain = texture(noiseTex, p.mul(2.9).add(vec2(0.5, 0.2))).b;
  // Fatores multiplicativos por terreno (preservam a cor do tema).
  const warm = vec3(1.07, 1.03, 0.86);
  const cool = vec3(0.9, 0.97, 1.04);
  const grass = mix(cool, warm, blot).mul(blot2.mul(0.18).add(0.86)).mul(fine.sub(0.5).mul(0.14).add(1));
  const litter = smoothstep(0.62, 0.8, grain);
  const forest = mix(vec3(0.74, 0.8, 0.74), vec3(0.98, 0.96, 0.9), blot.mul(0.7).add(blot2.mul(0.3))).mul(mix(vec3(1), vec3(1.25, 1.02, 0.7), litter.mul(0.55)));
  const furrow = sin(p.x.mul(31).add(p.y.mul(17)).add(blot.mul(6))).mul(0.5).add(0.5);
  const field = vec3(furrow.mul(0.1).add(0.93)).mul(blot2.mul(0.14).add(0.93));
  const pebble = smoothstep(0.7, 0.86, grain);
  const village = vec3(blot.mul(0.2).add(0.88)).mul(mix(vec3(1), vec3(1.16, 1.12, 1.06), pebble.mul(0.6)));
  const rest = float(1).sub(sp.x.add(sp.y).add(sp.z).add(sp.w)).max(0);
  const plain = vec3(texture(noiseTex, p.div(3.5)).g.mul(0.2).add(0.9));
  const detail = grass.mul(sp.x).add(forest.mul(sp.y)).add(field.mul(sp.z)).add(village.mul(sp.w)).add(plain.mul(rest));
  // Topo × lateral (normal plana de cada triângulo).
  const top = smoothstep(0.55, 0.9, normalWorld.y);
  const sideP = positionWorld.x.add(positionWorld.z);
  const strata = texture(noiseTex, vec2(sideP.mul(0.9), positionWorld.y.mul(7))).g;
  const stones = smoothstep(0.66, 0.8, texture(noiseTex, vec2(sideP.mul(3.1), positionWorld.y.mul(9))).b);
  const sideF = vec3(strata.mul(0.32).add(0.8)).mul(mix(vec3(1), vec3(1.22, 1.18, 1.1), stones.mul(0.8)));
  m.colorNode = vertexColor().rgb.mul(mix(sideF, detail, top));
  // Relevo fino do prado e da mata: inclina a normal com o mapa de declive da água.
  const slope = texture(waterTex, p.mul(0.45)).rg.sub(0.5).mul(sp.x.add(sp.y).mul(0.5).add(0.12));
  const nW = vec3(slope.x.negate(), 1, slope.y.negate()).normalize();
  m.normalNode = mix(normalView, cameraViewMatrix.mul(vec4(nW, 0)).xyz.normalize(), top);
  m.receivedShadowNode = shadowWithClouds;
  return m;
}

// ---------------------------------------------------------------- água

/** Índice de refração da água e a refletância de frente de um dielétrico com ele. */
const IOR = 1.333;
const WATER_F0 = ((IOR - 1) / (IOR + 1)) ** 2;
/** Coluna d'água mais funda (tileBuilder: do leito escavado até a superfície). */
const DEPTH_MAX = 0.028;
/**
 * Absorção por canal, medida em colunas inteiras: uma turbidez igual nos três canais e um
 * extra para os canais fracos na cor da água do tema (numa água azul, o vermelho some antes).
 */
const ABS_BASE = 0.65;
const ABS_HUE = 0.5;
/** Ganho do reflexo do céu: o ambiente do jogo é bem mais escuro que um céu de verdade (sky.ts). */
const SKY_GAIN = 2.2;
/** Cáusticas: lado do ladrilho no mundo, duração do ciclo (s) e força. */
const CAUSTIC_TILE = 0.6;
const CAUSTIC_LOOP = 7;
const CAUSTIC_GAIN = 0.8;

export const causticTex = makeCausticTexture();

/** Esteiras dos barcos, preenchidas pelo life.ts: (x, z, rumo × força), os mais perto da câmera. */
export const WAKE_MAX = 8;
export const WAKES = uniformArray(Array.from({ length: WAKE_MAX }, () => new THREE.Vector4()), 'vec4');
export const WAKE_N = uniform(0, 'int');

/**
 * Máscara do reflexo de tela (post.ts) gravada por material no lugar da rugosidade. A da
 * água varia com a distância (filtro abaixo) e deixou de servir de assinatura.
 */
export const ssrMask = new WeakMap<THREE.Material, N>();

/** Fresnel exato de um dielétrico (luz não polarizada), do ar para a água. */
const fresnelWater = (cosI: N) => {
  const c = cosI.clamp(0, 1);
  const cosT = float(1).sub(float(1).sub(c.mul(c)).div(IOR * IOR)).max(0).sqrt();
  const rs = c.sub(cosT.mul(IOR)).div(c.add(cosT.mul(IOR)));
  const rp = c.mul(IOR).sub(cosT).div(c.mul(IOR).add(cosT));
  return rs.mul(rs).add(rp.mul(rp)).mul(0.5);
};

interface WaterShade {
  /** Normal do leito (espaço de câmera): a luz difusa vem de baixo, não das ondas. */
  bedN: N;
  /** Refletância difusa sob a luz direta: leito com cáusticas, água turva e espuma. */
  lit: N;
}

/**
 * Luz da água. A superfície só reflete: o sol pelo GGX e o céu com o Fresnel exato. O que
 * vem de baixo (leito e água turva) é difuso e iluminado como o chão do leito, então a beira
 * molhada continua o barranco seco sem emenda; as cáusticas multiplicam só a luz direta,
 * e por isso somem na sombra e à noite.
 */
class WaterLighting extends THREE.PhysicalLightingModel {
  private shade: WaterShade;

  constructor(shade: WaterShade) {
    super();
    this.shade = shade;
  }

  direct({ lightDirection, lightColor, reflectedLight }: N) {
    const v = positionViewDirection;
    const dotVH = v.dot(lightDirection.add(v).normalize()).clamp();
    const F = (F_Schlick as N)({ f0: specularColor, f90: specularF90, dotVH });
    const bedNL = this.shade.bedN.dot(lightDirection).clamp();
    reflectedLight.directDiffuse.addAssign(lightColor.mul(bedNL).mul((BRDF_Lambert as N)({ diffuseColor: this.shade.lit })).mul(F.oneMinus()));
    const dotNL = normalView.dot(lightDirection).clamp();
    const spec = (BRDF_GGX as N)({ lightDirection, f0: specularColorBlended, f90: float(1), roughness });
    reflectedLight.directSpecular.addAssign(lightColor.mul(dotNL).mul(spec).mul(this.multiScatteringCompensation as N));
  }

  indirectSpecular(builder: N) {
    const { radiance, iblIrradiance, reflectedLight } = builder.context;
    const F = fresnelWater(normalView.dot(positionViewDirection)).toVar();
    reflectedLight.indirectSpecular.addAssign(radiance.mul(F).mul(SKY_GAIN));
    reflectedLight.indirectDiffuse.addAssign(diffuseContribution.mul(iblIrradiance).mul(1 / Math.PI).mul(F.oneMinus()));
  }
}

class WaterMaterial extends THREE.MeshStandardNodeMaterial {
  shade!: WaterShade;

  setupSpecular() {
    specularColor.assign(vec3(WATER_F0));
    specularColorBlended.assign(vec3(WATER_F0));
    specularF90.assign(1);
  }

  setupLightingModel() {
    return new WaterLighting(this.shade);
  }
}

/**
 * Ondinhas que não vêm do mapa de ondas: esteiras dos barcos (o V de Kelvin e as ondas
 * transversais), anéis de peixe (uma célula sorteada por hash, de tempos em tempos) e a
 * onda de quando uma peça assenta. Devolve (inclinação x, inclinação z, espuma).
 */
const ripples = (p: N, depth: N) =>
  Fn(() => {
    const t = U.time;
    const slope = vec2(0).toVar();
    const foam = float(0).toVar();
    Loop(WAKE_N, ({ i }: { i: N }) => {
      const b = WAKES.element(i) as N;
      const rel = p.sub(b.xy);
      const s = length(b.zw);
      const dir = b.zw.div(s.max(1e-4));
      const side = vec2(dir.y.negate(), dir.x);
      const ahead = dot(rel, dir);
      const back = ahead.negate().max(0);
      const across = dot(rel, side);
      const decay = exp(back.mul(-2.5)).mul(smoothstep(0.03, -0.03, ahead)).mul(s);
      // Braços do V (ângulo de Kelvin, ~19,5°): uma crista de cada lado, que alarga e some
      // a uns 3 comprimentos de barco. A inclinação não cai com a largura, senão some de longe.
      const off = abs(across).sub(back.mul(0.354));
      const x = off.div(back.mul(0.035).add(0.004));
      const arm = exp(x.pow2().negate()).mul(decay);
      const dOff = side.mul(sign(across)).add(dir.mul(0.354));
      slope.addAssign(dOff.mul(x.mul(arm).mul(-1.05)));
      // Ondas transversais dentro do V, paradas em relação ao barco.
      const inV = smoothstep(0.36, 0.18, abs(across).div(back.max(0.01))).mul(decay);
      slope.addAssign(dir.mul(cos(back.mul(120))).mul(inV.mul(-0.18)));
      // Espuma: o contorno do casco (elipse do tamanho médio dos barcos, mais forte na proa)
      // e o começo dos braços.
      const hull = length(vec2(ahead.div(0.085), across.div(0.03)));
      const bow = smoothstep(-0.04, 0.07, ahead).mul(0.4).add(0.6);
      foam.addAssign(arm.mul(smoothstep(0.24, 0.05, back)).mul(0.6).add(exp(hull.sub(1).pow2().mul(-30)).mul(bow).mul(s).mul(0.55)));
    });
    // Peixes: em metade das células de 0,9, um anel duplo nasce a cada 5 a 10 s e se abre.
    const CELL = 0.9;
    const cell = floor(p.div(CELL)) as N;
    const seed = cell.x.add(512).add(cell.y.add(512).mul(1024)).mul(8);
    const h = (k: number) => hash(seed.add(k));
    const period = h(0).mul(5).add(5);
    const age = fract(t.div(period).add(h(1))).mul(period);
    const rel = p.sub(cell.add(vec2(h(2), h(3)).mul(0.6).add(0.2)).mul(CELL));
    const r = length(rel).max(1e-4);
    const R = age.mul(0.07);
    const env = exp(age.mul(-1.1)).mul(smoothstep(0, 0.25, age)).mul(step(h(4), 0.5)).mul(smoothstep(0.003, 0.01, depth));
    const x1 = r.sub(R), x2 = r.sub(R.mul(0.6));
    const g1 = exp(x1.div(0.007).pow2().negate());
    const g2 = exp(x2.div(0.005).pow2().negate());
    const dh = x1.mul(-2 / 0.007 ** 2).mul(g1).add(x2.mul((-2 * 0.6) / 0.005 ** 2).mul(g2)).mul(env).mul(0.0009);
    slope.addAssign(rel.div(r).mul(dh));
    foam.addAssign(g1.mul(env).mul(smoothstep(0.8, 0, age)).mul(0.35));
    // Peça que assenta: a inclinação da onda de `rippleY` (que já sobe e desce os vértices)
    // e uma franja de ondinhas finas atrás da frente.
    const rd = length(p.sub(U.ripple.xy)).max(1e-4);
    const rage = t.sub(U.ripple.z).max(0);
    const fx = rd.sub(rage.mul(3.2).add(0.75));
    const renv = exp(rage.mul(-1.9)).mul(smoothstep(0.6, 0.95, rd)).mul(U.ripple.w);
    const main = cos(fx.mul(10)).mul(10).sub(fx.mul(28).mul(sin(fx.mul(10)))).mul(exp(fx.mul(fx).mul(-14))).mul(0.042);
    const fine = cos(fx.mul(90)).mul(exp(fx.mul(fx).mul(-60))).mul(0.06);
    slope.addAssign(p.sub(U.ripple.xy).div(rd).mul(main.add(fine).mul(renv)));
    return vec3(slope, foam);
  })();

/**
 * Água dos rios e lagos, com coluna d'água. Atributos por vértice (tileBuilder): `wflow` =
 * correnteza no plano; `wbed` = cor do leito e profundidade exata (a malha da água repete a
 * do leito, então a profundidade chega a zero exatamente onde o barranco corta a água).
 *   - ondulação que desce o rio (mapa de fluxo em duas fases), esteiras e anéis;
 *   - o olhar refrata, atravessa a coluna e encontra o leito; cada canal é absorvido conforme
 *     a cor da água do tema, e a água turva que sobra ganha a cor funda do tema;
 *   - cáusticas no leito (volume pré-calculado em noise.ts), só na luz direta;
 *   - reflexo com Fresnel exato; o brilho do sol é o GGX da luz, com a rugosidade alargada
 *     pela variação das ondas dentro do pixel: de longe vira um caminho de luz estável;
 *   - espuma rendada na beira, rastros na correnteza e espuma das esteiras.
 */
export function makeWaterMaterial() {
  const m = new WaterMaterial({ roughness: 0.05, metalness: 0 });
  m.positionNode = displaced();
  const p = positionWorld.xz;
  const t = U.time;
  // Correnteza em coordenadas de mundo (o bloco estático já vem girado; a peça viva não).
  const fl = attribute('wflow', 'vec2');
  const f = modelWorldMatrix.mul(vec4(fl.x, 0, fl.y, 0)).xz;
  const bed = attribute('wbed', 'vec4');
  const depth = bed.w.max(0);
  const speed = length(f);
  const CYCLE = 2.6;
  const ph0 = fract(t.div(CYCLE));
  const ph1 = fract(t.div(CYCLE).add(0.5));
  const wA = float(1).sub(abs(ph0.mul(2).sub(1)));
  const drift = f.mul(0.13 * CYCLE);
  const sc = 1 / 1.35;
  // Lagos e remansos (sem correnteza) ainda ondulam devagar.
  const calm = vec2(t.mul(0.011), t.mul(-0.007));
  const uvA = p.sub(drift.mul(ph0)).mul(sc).add(calm);
  const uvB = p.sub(drift.mul(ph1)).mul(sc).add(calm).add(vec2(0.37, 0.61));
  const nA = texture(waterTex, uvA);
  const nB = texture(waterTex, uvB);
  const nn = mix(nB, nA, wA);
  const big = texture(waterTex, p.mul(0.23).add(vec2(t.mul(-0.004), t.mul(0.006))));
  const extra = ripples(p, depth).toVar();
  const slope = nn.rg.sub(0.5).mul(2).mul(0.55).add(big.rg.sub(0.5).mul(0.5)).add(extra.xy);
  const nW = vec3(slope.x.negate(), 1, slope.y.negate()).normalize().toVar();
  m.normalNode = cameraViewMatrix.mul(vec4(nW, 0)).xyz.normalize();

  // O olhar refrata na superfície e desce até o leito; o sol faz o mesmo caminho na descida.
  const view = cameraPosition.sub(positionWorld).normalize();
  const tr = refract(view.negate(), nW, 1 / IOR);
  const pathV = depth.div(tr.y.negate().max(0.3));
  const pBed = p.add(tr.xz.mul(pathV));
  const sunCosT = float(1).sub(float(1).sub(U.sunDir.y.mul(U.sunDir.y)).div(IOR * IOR)).sqrt();
  const pathS = depth.div(sunCosT);
  // Absorção por canal a partir da cor da água do tema.
  const wc = U.water as N;
  const hue = wc.div(max(max(wc.r, wc.g), wc.b).max(1e-3)).max(0.02);
  const sigma = hue.log().negate().mul(ABS_HUE).add(ABS_BASE).div(DEPTH_MAX);
  const tView = exp(sigma.mul(pathV).negate());
  const tBed = exp(sigma.mul(pathV.add(pathS)).negate());

  // Leito: a cor dos vértices do chão logo abaixo, com o mesmo detalhe "liso" do material do
  // chão (na beira os dois casam) e pedrinhas que só aparecem com alguma água por cima.
  const plain = texture(noiseTex, pBed.div(3.5)).g.mul(0.2).add(0.9);
  const grain = texture(noiseTex, pBed.mul(2.9).add(vec2(0.5, 0.2))).b;
  const pebbles = smoothstep(0.62, 0.8, grain).mul(0.2).sub(smoothstep(0.38, 0.2, grain).mul(0.14)).mul(smoothstep(0.004, 0.014, depth));
  const seen = bed.rgb.mul(plain).mul(pebbles.add(1)).mul(tBed);
  const murk = wc.mul(vec3(0.42, 0.62, 0.88)).mul(tView.oneMinus());

  // Cáusticas: duas fases da correnteza, misturadas sem perder contraste (são padrões
  // independentes); somem no raso (a luz ainda não focou) e quando o ladrilho fica menor
  // que o pixel.
  const caus = (uv: N, frame: N) => {
    const f0 = floor(frame);
    const a = texture(causticTex, uv).depth(mod(f0, CAUSTIC_FRAMES).toInt()).r;
    const b = texture(causticTex, uv).depth(mod(f0.add(1), CAUSTIC_FRAMES).toInt()).r;
    return mix(a, b, frame.sub(f0));
  };
  const cz = t.mul(CAUSTIC_FRAMES / CAUSTIC_LOOP);
  const cA = caus(pBed.sub(drift.mul(ph0)).div(CAUSTIC_TILE), cz);
  const cB = caus(pBed.sub(drift.mul(ph1)).div(CAUSTIC_TILE).add(vec2(0.31, 0.57)), cz.add(11.7));
  const cMix = mix(cB, cA, wA).mul(4 / 0.94).sub(1).div(wA.mul(wA).add(wA.oneMinus().pow2()).sqrt()).add(1);
  const texPerPx = length(fwidth(pBed)).mul(CAUSTIC_SIZE / CAUSTIC_TILE);
  const cK = smoothstep(0.002, 0.012, depth).mul(float(1).sub(smoothstep(0.9, 2.6, texPerPx))).mul(CAUSTIC_GAIN);
  const caustic = cMix.sub(1).mul(cK).add(1).max(0);

  // Espuma: uma linha fina que lambe a beira, a renda (onde dois ruídos se cruzam) no raso,
  // os rastros onde a água corre e a das esteiras.
  const lap = sin(t.mul(1.1).add(big.b.mul(9))).mul(0.0011);
  const edgeLine = float(1).sub(smoothstep(0, float(0.0026).add(lap), depth));
  const n1 = texture(waterTex, p.mul(1.9).add(vec2(t.mul(0.021), t.mul(-0.013)))).b;
  const n2 = texture(waterTex, p.mul(2.6).add(vec2(t.mul(-0.017), t.mul(0.019))).add(0.5)).b;
  const lace = smoothstep(0.07, 0, abs(n1.sub(n2))).mul(float(1).sub(smoothstep(0.002, 0.016, depth)));
  const streak = nn.a.mul(smoothstep(0.4, 1, speed)).mul(smoothstep(0.004, 0.014, depth)).mul(0.12);
  const foam = max(edgeLine, lace).mul(0.85).add(streak).add(extra.z).clamp(0, 1).toVar();
  const foamCol = vec3(0.97, 0.98, 1).mul(float(1).sub(U.night.mul(0.5)));
  m.colorNode = mix(seen.add(murk), foamCol, foam);
  // Normal do leito: a mesma do chão (quase "para cima", com o relevo fino do material do chão).
  const bedSlope = texture(waterTex, pBed.mul(0.45)).rg.sub(0.5).mul(0.12);
  const bedW = vec3(bedSlope.x.negate(), 1, bedSlope.y.negate()).normalize();
  m.shade = { bedN: cameraViewMatrix.mul(vec4(bedW, 0)).xyz.normalize(), lit: mix(seen.mul(caustic).add(murk), foamCol, foam) };

  // Rugosidade com o filtro de Kaplanyan: a variação da normal dentro do pixel vira
  // rugosidade (α² += 2σ²), então o brilho do sol não pisca quando as ondas ficam menores
  // que o pixel. Espuma é fosca e apaga o reflexo de tela.
  const dnx = dFdx(nW), dny = dFdy(nW);
  const kernel = min(dot(dnx, dnx).add(dot(dny, dny)).mul(0.5), 0.18);
  m.roughnessNode = mix(float(0.05 ** 4).add(kernel).sqrt().sqrt(), float(0.6), foam);
  ssrMask.set(m, mix(float(0.065), float(0.2), foam));
  m.receivedShadowNode = shadowWithClouds;
  return m;
}

/** Grade hexagonal do vazio, que desbota longe do tabuleiro. */
export function makeVoidMaterial() {
  const u = {
    bg: uniform(new THREE.Color()),
    fill: uniform(new THREE.Color()),
    line: uniform(new THREE.Color()),
    center: uniform(new THREE.Vector2()),
    radius: uniform(6),
  };
  // Parte iluminada (recebe a sombra do tabuleiro e a oclusão) e parte emissiva (a cor
  // do tema se mantém igual ao fundo e à névoa, que não são iluminados).
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  m.envMapIntensity = 0;
  const grid = Fn(() => {
    const p = positionWorld.xz;
    const qf = p.x.mul(2 / 3);
    const rf = p.x.div(-3).add(p.y.mul(0.57735027));
    const c = vec3(qf, qf.negate().sub(rf), rf);
    const rc = c.add(0.5).floor().toVar();
    const d = abs(rc.sub(c));
    const fixX = d.x.greaterThan(d.y).and(d.x.greaterThan(d.z));
    const fixY = d.y.greaterThan(d.z);
    rc.x.assign(select(fixX, rc.y.negate().sub(rc.z), rc.x));
    rc.y.assign(select(fixX.not().and(fixY), rc.x.negate().sub(rc.z), rc.y));
    rc.z.assign(select(fixX.not().and(fixY.not()), rc.x.negate().sub(rc.y), rc.z));
    const ctr = vec2(rc.x.mul(1.5), rc.z.add(rc.x.mul(0.5)).mul(1.7320508));
    const a = abs(p.sub(ctr));
    const hd = max(a.y, a.x.mul(0.8660254).add(a.y.mul(0.5)));
    const aa = fwidth(hd).mul(1.2);
    const lineW = smoothstep(float(0.831).sub(aa), float(0.831), hd);
    const inner = float(1).sub(smoothstep(float(0.8).sub(aa), float(0.8), hd));
    const fade = float(1).sub(smoothstep(u.radius, u.radius.add(7), length(p.sub(u.center))));
    const col = mix(u.bg, u.fill, inner.mul(fade).mul(0.9));
    return mix(col, u.line, lineW.mul(fade));
  })();
  const LIT = 0.4;
  m.colorNode = grid.mul(LIT);
  m.emissiveNode = grid.mul(1 - LIT * 0.95);
  m.fog = true;
  return { material: m, u };
}

/**
 * Filtro de sombra suave: grade de 4×4 amostras com comparação bilinear do hardware
 * (cada uma já filtra 2×2), sem ruído. O PCF padrão do three gira 5 amostras por um
 * ruído fixo por pixel, que o antisserrilhado temporal não consegue suavizar.
 * O espalhamento usa `shadow.radius` (em texels).
 */
export const softShadowFilter = Fn(({ depthTexture, shadowCoord, shadow, depthLayer }: { depthTexture: THREE.DepthTexture; shadowCoord: N; shadow: THREE.LightShadow; depthLayer: N }) => {
  const mapSize = (reference('mapSize', 'vec2', shadow) as N).setGroup(renderGroup);
  const radius = (reference('radius', 'float', shadow) as N).setGroup(renderGroup);
  const step = vec2(1).div(mapSize).mul(radius);
  const tap = (ox: number, oy: number) => {
    let t: N = texture(depthTexture, shadowCoord.xy.add(vec2(ox, oy).mul(step)));
    if ((depthTexture as unknown as { isArrayTexture?: boolean }).isArrayTexture) t = t.depth(depthLayer);
    return t.compare(shadowCoord.z);
  };
  let sum: N = float(0);
  for (const oy of [-1.5, -0.5, 0.5, 1.5]) for (const ox of [-1.5, -0.5, 0.5, 1.5]) sum = sum.add(tap(ox, oy));
  return sum.div(16);
});
