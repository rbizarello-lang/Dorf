import * as THREE from 'three/webgpu';
import {
  Fn,
  abs,
  attribute,
  cameraPosition,
  cameraViewMatrix,
  clamp,
  cos,
  dot,
  float,
  fract,
  fwidth,
  hash,
  instanceIndex,
  length,
  max,
  mix,
  modelWorldMatrix,
  normalView,
  normalWorld,
  positionGeometry,
  positionLocal,
  positionPrevious,
  positionWorld,
  reference,
  renderGroup,
  select,
  sin,
  smoothstep,
  texture,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
  vertexColor,
} from 'three/tsl';
import { makeNoiseTexture, makeWaterTexture } from './noise';

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
  bank: uniform(new THREE.Color('#d9e3a2')),
  /** Cor do céu refletida na água (acompanha a hora do dia). */
  sky: uniform(new THREE.Color('#fff4f0')),
  /** Direção (para o sol) e cor da luz do sol, para o cintilar da água. */
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
  if (o.sway === 'tree') {
    const h = max(positionGeometry.y.sub(0.08), 0);
    m.positionNode = Fn(() => {
      // positionLocal já vem transformado pela instância (r186: instância antes do positionNode).
      positionPrevious.addAssign(treeSway(positionPrevious, h, U.time.sub(U.dt)));
      return positionLocal.add(treeSway(positionLocal, h, U.time));
    })();
  } else if (o.sway === 'crop') {
    const hgt = max(positionGeometry.y, 0);
    const sheen = varying(float(0), 'vSheen');
    m.positionNode = Fn(() => {
      const now = cropBend(positionLocal, hgt, U.time);
      positionPrevious.addAssign(cropBend(positionPrevious, hgt, U.time.sub(U.dt)).d);
      sheen.assign(now.gust.mul(clamp(hgt.mul(14), 0, 1)));
      return positionLocal.add(now.d);
    })();
    base = base.mul(sheen.mul(0.22).add(1));
  }
  m.colorNode = base;
  // Cada janela acende num momento diferente do anoitecer.
  const lit = smoothstep(0, 0.25, U.night.mul(1.25).sub(hash(instanceIndex).mul(0.5)));
  let emissive: N3 = U.glow.mul(glow).mul(varying(lit, 'vLit')).mul(2.6);
  if (o.emissive) emissive = emissive.add(uniform(new THREE.Color(o.emissive)).mul(o.emissiveIntensity ?? 0.6));
  m.emissiveNode = emissive;
  m.receivedShadowNode = shadowWithClouds;
  return m;
}

export type MatKey = 'deco' | 'foliage' | 'crop' | 'crystal' | 'glass';

export function makeDecoMaterials(): Record<MatKey, THREE.MeshStandardNodeMaterial> {
  return {
    deco: decoMaterial({}),
    foliage: decoMaterial({ sway: 'tree', roughness: 0.9 }),
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

/**
 * Água dos rios e lagos. Atributos por vértice (tileBuilder): `wflow` = correnteza no
 * plano (0 a 1) e `wedge` = 0 no meio do canal, 1 na beira.
 *   - ondulação que desce o rio (mapa de fluxo em duas fases que se alternam);
 *   - cor por profundidade (rasa e clara na beira, funda e escura no meio);
 *   - espuma na beira e rastros onde a água corre;
 *   - normal ondulada para o brilho do sol e um reflexo do céu nos ângulos rasantes.
 */
export function makeWaterMaterial() {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.08, metalness: 0 });
  const p = positionWorld.xz;
  const t = U.time;
  // Correnteza em coordenadas de mundo (o bloco estático já vem girado; a peça viva não).
  const fl = attribute('wflow', 'vec2');
  const f = modelWorldMatrix.mul(vec4(fl.x, 0, fl.y, 0)).xz;
  const w = attribute('wedge', 'float');
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
  const slope = nn.rg.sub(0.5).mul(2).mul(0.55).add(big.rg.sub(0.5).mul(0.5));
  const nW = vec3(slope.x.negate(), 1, slope.y.negate()).normalize();
  m.normalNode = cameraViewMatrix.mul(vec4(nW, 0)).xyz.normalize();

  const shallow = mix(U.water, U.bank, 0.22).mul(vec3(1.0, 1.12, 1.1));
  const deep = (U.water as N).mul(vec3(0.36, 0.52, 0.72));
  const depth = smoothstep(0.05, 1.0, w);
  let col: N3 = mix(deep, shallow, depth.mul(depth.mul(-0.5).add(1.5)).clamp(0, 1));
  // Reflexo do céu: mais forte quando o olhar é rasante e nas cristas.
  const view = cameraPosition.sub(positionWorld).normalize();
  const fres = float(1).sub(view.y.clamp(0, 1)).pow(3).mul(0.45).add(nn.b.sub(0.5).mul(0.1));
  col = mix(col, U.sky, fres.clamp(0, 0.4));
  // Espuma: na beira, quebrada pelo ruído, e rastros finos onde a água corre.
  const shore = smoothstep(0.8, 0.97, w.add(big.b.sub(0.5).mul(0.35)).add(nn.b.sub(0.5).mul(0.12)));
  const streak = nn.a.mul(smoothstep(0.25, 0.9, speed)).mul(smoothstep(0.15, 0.6, w)).mul(0.55);
  const foam = shore.mul(0.75).add(streak).clamp(0, 1);
  col = mix(col, vec3(0.97, 0.98, 1) as N3, foam.mul(float(1).sub(U.night.mul(0.5))));
  m.colorNode = col;
  m.roughnessNode = mix(float(0.07), float(0.6), foam);
  // Cintilar do sol nas cristas (emissivo, para o bloom pegar).
  const refl = nW.mul(-2).mul(dot(view, nW)).add(view).negate().normalize();
  const glint = max(dot(refl, U.sunDir), 0).pow(220).mul(smoothstep(0.35, 0.9, nn.a.add(big.a.mul(0.5))));
  m.emissiveNode = U.sun.mul(glint.mul(5).mul(float(1).sub(U.night)).mul(float(1).sub(foam)));
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
