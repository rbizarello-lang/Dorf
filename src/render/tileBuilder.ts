import * as THREE from 'three/webgpu';
import { corner, edgeMid, INR } from '../core/hex';
import { mulberry32, pick, randInt, randRange, type Rng, weighted } from '../core/rng';
import type { SynKind } from '../core/synergy';
import type { SiteKind } from '../core/sites';
import type { SpecialKind } from '../core/specials';
import { isStrict, T } from '../core/tiles';
import type { CropKind, Theme } from '../themes/types';
import { CROP_LAYOUT, type HouseMeta } from './lib';

// Gera a peça na orientação de origem (rotação 0), em coordenadas locais.
// O mesmo resultado serve para o fantasma, a animação de queda e o "cozimento"
// no bloco estático: só muda a matriz. Tudo é determinístico pela semente.

export const TILE_T = 0.28;
/** Superfície da água: abaixo do chão, dentro do leito escavado. */
export const WATER_Y = -0.02;
const BED_Y = 0.004;
export const RIVER_HW = 0.19;
/** Meia-largura do rio na borda (estreito, normal, largo), com o peso de cada uma. */
const RIVER_WIDTHS: ReadonlyArray<readonly [number, number]> = [
  [0.13, 0.3],
  [0.19, 0.45],
  [0.25, 0.25],
];
/**
 * Meia-largura da boca de um lago: quase a borda inteira, para lagos vizinhos virarem um só.
 * Sobra terra perto dos cantos (com a margem inclinada), então a emenda nunca chega ao canto.
 */
const LAKE_MOUTH = 0.36;
/** Raio do lago no fim de um rio. */
const LAKE_R = 0.3;
/** Fundo extra no meio dos lagos e dos rios largos (a cor da água escurece com a coluna). */
const LAKE_DEEP = 0.035;
/** Faixa junto à borda em que o perfil da água vira o da borda (é o que casa com a vizinha). */
const SEAM_W = 0.16;
/** Afastamento extra que a decoração guarda dos lagos. */
const BANK_EXTRA = 0.055;
/** Profundidade do leito e largura da margem inclinada (a partir da linha d'água nominal). */
const BED_DEPTH = 0.048;
const BANK_W = 0.075;
export const ROAD_HW = 0.1;
/** Altura em que veículos andam (maglev flutua sobre a via). */
export const ROAD_Y = { rail: 0.03, dirt: 0.006, stone: 0.008, sand: 0.006, maglev: 0.075 } as const;

/** spin: pás e rodas; wander: animais; chop/tend/carry: aldeões (golpe de machado, capina, vai e vem). */
export type Anim = 'spin-z' | 'spin-x' | 'wander' | 'chop' | 'tend' | 'carry';

export interface Deco {
  key: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  sx: number;
  sy: number;
  sz: number;
  color: THREE.Color;
  anim?: Anim;
  /** Só existe na peça viva (andaime de obra): o World não o grava nos blocos. */
  transient?: boolean;
}

export interface TileBuild {
  pos: Float32Array;
  col: Float32Array;
  /** Por vértice do chão: pesos de detalhe [prado, floresta, plantação, vila] (0 nas laterais). */
  splat: Float32Array;
  water: Float32Array;
  /** Por vértice da água: correnteza (x, z, em unidades/s relativas). */
  wflow: Float32Array;
  /**
   * Por vértice da água: cor do leito logo abaixo (r, g, b) e profundidade da coluna
   * (superfície menos leito; negativa onde o barranco já saiu da água).
   */
  wbed: Float32Array;
  decos: Deco[];
  /** Pontos de onde sai fumaça de chaminé, de 4 em 4: x, y, z e o tipo de casa (a era muda a altura). */
  chimneys: number[];
}

export interface BuildOpts {
  /** 1 = densidade total de plantas e capim; menor em qualidade baixa. */
  detail: number;
  /** Interações nas bordas (setor na orientação de origem). */
  synergies?: { sector: number; kind: SynKind }[];
  houses: HouseMeta[];
  /**
   * Sentido da correnteza em cada borda de rio, na orientação de origem: +1 a água sai
   * da peça, -1 entra. Sem isso (pilha), vale a regra padrão de `resolveFlow`.
   */
  flow?: readonly number[];
  /**
   * Meia-largura da água em cada borda, na orientação de origem: a da peça vizinha onde ela
   * já existe. Sem isso (pilha), vale a de `waterShape`.
   */
  widths?: readonly number[];
  /** Peça inicial: o meio fica livre para o Centro da vila (objeto à parte, no World). */
  center?: boolean;
  /** Marco da era erguido nesta peça (índice da era: uma flâmula por era). */
  eraMark?: number;
  /** Sítio descoberto nesta peça: ruína, baú, relicário ou torre de vigia. */
  site?: SiteKind;
  /** Peça especial: a construção dela (estação, moinho d'água ou farol). */
  special?: SpecialKind;
  /** Canteiro da maravilha: o meio da peça fica livre (a maravilha é um objeto à parte, no World). */
  wonder?: boolean;
}

type V2 = [number, number];
type V3 = [number, number, number];

const colorCache = new Map<string, THREE.Color>();
export function tc(hex: string): THREE.Color {
  let c = colorCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

/** Pesos de detalhe do chão por vértice: [prado, floresta, plantação, vila]. */
type Splat = readonly [number, number, number, number];
const NO_SPLAT: Splat = [0, 0, 0, 0];

class Buf {
  pos: number[] = [];
  col: number[] = [];
  spl: number[] = [];
  constructor(readonly withColor: boolean) {}

  tri(a: V3, b: V3, c: V3, ca: THREE.Color, cb: THREE.Color, cc: THREE.Color, n: V3, sa: Splat = NO_SPLAT, sb: Splat = sa, sc: Splat = sa) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * n[0] + ny * n[1] + nz * n[2] < 0) {
      [b, c] = [c, b];
      [cb, cc] = [cc, cb];
      [sb, sc] = [sc, sb];
    }
    this.pos.push(...a, ...b, ...c);
    if (this.withColor) this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    this.spl.push(...sa, ...sb, ...sc);
  }

  quad(a: V3, b: V3, c: V3, d: V3, ca: THREE.Color, cb: THREE.Color, cc: THREE.Color, cd: THREE.Color, n: V3, sp: Splat = NO_SPLAT) {
    this.tri(a, b, c, ca, cb, cc, n, sp);
    this.tri(a, c, d, ca, cc, cd, n, sp);
  }
}

const UP: V3 = [0, 1, 0];
const WHITE = new THREE.Color(1, 1, 1);
/** Árvores e marcos maiores que a escala natural: com a câmera baixa, o que conta a história da peça precisa ler de longe. */
const TREE_SCALE = 1.3;
/** Chance de um arbusto de frutas por setor de prado (nos temas com `berry`). */
const BERRY_CHANCE = 0.06;
const LANDMARK_SCALE = 1.25;
const LUSH = new THREE.Color('#5fa83a');

export interface Path {
  pts: V2[];
  hw: number;
  /** Meia-largura em cada ponto (rios de largura variável); sem isso, vale `hw`. */
  hws?: number[];
}

function bezier(a: V2, c: V2, b: V2, n: number): V2[] {
  const out: V2[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

function line(a: V2, b: V2, n: number): V2[] {
  const out: V2[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

/** Caminhos de rio/estrada dentro da peça: curva entre duas bordas, ou retas até o centro. */
export function pathsFor(edges: readonly T[], terr: T, hw: number): { paths: Path[]; idx: number[] } {
  const idx: number[] = [];
  for (let i = 0; i < 6; i++) if (edges[i] === terr) idx.push(i);
  const paths: Path[] = [];
  if (idx.length === 2) paths.push({ pts: bezier(edgeMid(idx[0]), [0, 0], edgeMid(idx[1]), 16), hw });
  else for (const i of idx) paths.push({ pts: line(edgeMid(i), [0, 0], 8), hw });
  return { paths, idx };
}

/** Peso de cada terreno ao escolher para que lado a via se curva: ela foge da vila e da mata. */
const CROWD: Record<number, number> = { [T.Grass]: 0, [T.Field]: 1, [T.Forest]: 2, [T.Village]: 3, [T.Water]: 3, [T.Rail]: 3 };

/**
 * Traçado da via entre as bordas a e b, em coordenadas locais. Nas duas pontas a via sai
 * no meio da borda e perpendicular a ela, então emenda com a vizinha sem quebra. Entre bordas
 * vizinhas e a 120° é um arco de círculo (com raio sorteado em ±15%); entre bordas opostas,
 * em vez da reta, um arco que se desvia para o lado mais aberto (prado, plantação) ou, se os
 * dois lados pesam igual, um S (`straight` mantém a reta: a plataforma da peça estação é reta).
 * Não gasta o rng da peça: o Life refaz o mesmo traçado para os
 * trens. A ordem (a, b) só inverte o sentido dos pontos.
 */
export function railCurve(edges: readonly T[], seed: number, a: number, b: number, straight = false, n = 20): V2[] {
  if (a > b) return railCurve(edges, seed, b, a, straight, n).reverse();
  const rng = mulberry32(((seed ^ 0x2c1b3c6d) + a * 7 + b * 131) >>> 0);
  const A = edgeMid(a), B = edgeMid(b);
  const sep = Math.min(b - a, 6 - (b - a));
  const out: V2[] = [];
  if (sep < 3) {
    // Alça do arco cúbico: 4/3·tan(θ/4)·raio, com θ = 120° (raio 0,5) ou 60° (raio 1,5).
    const h = (sep === 1 ? 0.385 : 0.536) * randRange(rng, 0.85, 1.15);
    const k = 1 - h / INR;
    const c1: V2 = [A[0] * k, A[1] * k], c2: V2 = [B[0] * k, B[1] * k];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
      out.push([w0 * A[0] + w1 * c1[0] + w2 * c2[0] + w3 * B[0], w0 * A[1] + w1 * c1[1] + w2 * c2[1] + w3 * B[1]]);
    }
    return out;
  }
  // Bordas opostas: lado 1 são os setores a+1 e a+2; a normal (nx, nz) aponta para ele.
  let nx = -(B[1] - A[1]), nz = B[0] - A[0];
  const l = Math.hypot(nx, nz);
  nx /= l;
  nz /= l;
  const [sx, sz] = edgeMid(a + 1);
  if (nx * sx + nz * sz < 0) {
    nx = -nx;
    nz = -nz;
  }
  const side1 = CROWD[edges[(a + 1) % 6]] + CROWD[edges[(a + 2) % 6]];
  const side2 = CROWD[edges[(a + 4) % 6]] + CROWD[edges[(a + 5) % 6]];
  const amp = straight ? 0 : randRange(rng, 0.12, 0.2);
  const sign = side1 === side2 ? (rng() < 0.5 ? -1 : 1) : side1 < side2 ? 1 : -1;
  const s = side1 === side2 && rng() < 0.6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const sp = Math.sin(Math.PI * t);
    // sen²: derivada nula nas pontas (sai perpendicular à borda).
    const f = sign * amp * (s ? 1.3 * Math.sin(2 * Math.PI * t) * sp : sp * sp);
    out.push([A[0] + (B[0] - A[0]) * t + nx * f, A[1] + (B[1] - A[1]) * t + nz * f]);
  }
  return out;
}

/** Vias da peça: uma curva entre duas bordas; com 3 ou mais, um triângulo de curvas (como uma
 * triangular de manobra) ligando cada borda à seguinte; com uma só, reta até a estação. */
export function railPaths(edges: readonly T[], seed: number, straight = false): { paths: Path[]; idx: number[] } {
  const idx: number[] = [];
  for (let i = 0; i < 6; i++) if (edges[i] === T.Rail) idx.push(i);
  if (idx.length < 2) return { paths: idx.map((i) => ({ pts: line(edgeMid(i), [0, 0], 8), hw: ROAD_HW })), idx };
  const pairs = idx.length === 2 ? [[idx[0], idx[1]]] : idx.map((i, j) => [i, idx[(j + 1) % idx.length]]);
  return { paths: pairs.map(([a, b]) => ({ pts: railCurve(edges, seed, a, b, straight), hw: ROAD_HW })), idx };
}

function nearestOnPaths(x: number, z: number, paths: Path[]) {
  let best = { d: Infinity, p: [0, 0] as V2, t: [1, 0] as V2, hw: 0 };
  for (const p of paths) {
    for (let k = 0; k < p.pts.length - 1; k++) {
      const [ax, az] = p.pts[k];
      const [bx, bz] = p.pts[k + 1];
      const dx = bx - ax, dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
      const px = ax + dx * t, pz = az + dz * t;
      const hw = p.hws ? p.hws[k] + (p.hws[k + 1] - p.hws[k]) * t : p.hw;
      const d = Math.hypot(x - px, z - pz) - hw;
      if (d < best.d) {
        const l = Math.sqrt(len2);
        best = { d, p: [px, pz], t: [dx / l, dz / l], hw };
      }
    }
  }
  return best;
}

const distToPaths = (x: number, z: number, paths: Path[]) => nearestOnPaths(x, z, paths).d;

/**
 * Completa o sentido da correnteza nas bordas de rio sem vizinho conhecido (0). Se a água
 * já entra por alguma borda, as demais são saídas, e vice-versa. Sem nada conhecido:
 * rio de 2 bordas entra pela de menor índice; lago recebe a água; junção de 3+ é uma
 * confluência (sai pela de menor índice). Usada pelo World (com os vizinhos) e pela pilha.
 */
export function resolveFlow(edges: readonly T[], known?: readonly number[]): number[] {
  const out = [0, 0, 0, 0, 0, 0];
  const idx: number[] = [];
  for (let i = 0; i < 6; i++) if (edges[i] === T.Water) idx.push(i);
  if (!idx.length) return out;
  let ins = 0, outs = 0;
  for (const i of idx) {
    const k = known?.[i] ?? 0;
    out[i] = k;
    if (k < 0) ins++;
    else if (k > 0) outs++;
  }
  const fill = ins ? 1 : outs ? -1 : 0;
  idx.forEach((i, j) => {
    if (out[i]) return;
    if (fill) out[i] = fill;
    else if (idx.length === 1) out[i] = -1;
    else if (idx.length === 2) out[i] = j === 0 ? -1 : 1;
    else out[i] = j === 0 ? 1 : -1;
  });
  return out;
}

/**
 * Ponto do caminho mais perto da margem: d é a distância até a linha d'água (negativa dentro),
 * com o parâmetro t (0 no início, 1 no fim) e a tangente.
 */
function nearestParam(x: number, z: number, p: Path) {
  const pts = p.pts;
  let best = { d: Infinity, t: 0, tx: 1, tz: 0 };
  const n = pts.length - 1;
  for (let k = 0; k < n; k++) {
    const [ax, az] = pts[k];
    const [bx, bz] = pts[k + 1];
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const hw = p.hws ? p.hws[k] + (p.hws[k + 1] - p.hws[k]) * u : p.hw;
    const d = Math.hypot(x - ax - dx * u, z - az - dz * u) - hw;
    if (d < best.d) {
      const l = Math.sqrt(len2);
      best = { d, t: (k + u) / n, tx: dx / l, tz: dz / l };
    }
  }
  return best;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface WaterShape {
  /** Bordas de água. */
  idx: number[];
  /** Meia-largura preferida em cada borda (0 onde não há água). */
  widths: number[];
  /** Lago da peça (centro e raio), ou null quando a água é só rio. */
  lake: { x: number; z: number; r: number } | null;
}

/**
 * Forma da água pela semente, com um gerador à parte (não mexe no resto da decoração):
 * se a peça tem lago e a meia-largura de cada borda. Água num trecho só de bordas vizinhas
 * vira lago quase sempre, com bocas largas que emendam com os lagos ao lado; rio que passa
 * de um lado a outro às vezes atravessa um lago no meio da peça. O World troca a largura
 * das bordas que encostam numa peça já colocada pela dela (`BuildOpts.widths`).
 */
export function waterShape(edges: readonly T[], seed: number): WaterShape {
  const idx: number[] = [];
  for (let i = 0; i < 6; i++) if (edges[i] === T.Water) idx.push(i);
  const widths = [0, 0, 0, 0, 0, 0];
  const n = idx.length;
  if (!n) return { idx, widths, lake: null };
  const r = mulberry32(seed ^ 0x1a6e5);
  const runs = idx.filter((i) => edges[(i + 5) % 6] !== T.Water).length;
  const bay = n >= 2 && runs === 1;
  const roll = r();
  let lake: WaterShape['lake'] = null;
  if (n === 1) lake = { x: 0, z: 0, r: LAKE_R };
  else if (bay ? n >= 3 || roll < 0.65 : roll < (n === 2 ? 0.22 : 0.35)) {
    let x = 0, z = 0;
    if (bay) {
      for (const i of idx) {
        const [mx, mz] = edgeMid(i);
        x += mx / n;
        z += mz / n;
      }
      x *= 0.45;
      z *= 0.45;
    }
    lake = { x, z, r: bay ? [0, 0, 0.4, 0.48, 0.54, 0.58][n] + r() * 0.06 : 0.34 + r() * 0.08 };
  }
  for (const i of idx) widths[i] = lake && bay ? LAKE_MOUTH : weighted(r, RIVER_WIDTHS);
  return { idx, widths, lake };
}

/** Caminhos da água: rio de 2 bordas em curva; lago, nascente e junção com raios até o meio. */
function waterPaths(shape: WaterShape, widths: readonly number[], seed: number): Path[] {
  const { idx, lake } = shape;
  const r = mulberry32(seed ^ 0x77a1);
  if (idx.length === 2 && !lake) {
    const [a, b] = idx;
    const pts = bezier(edgeMid(a), [0, 0], edgeMid(b), 16);
    // Remanso ou estreito no meio da peça: a largura das bordas fica igual à da vizinha.
    const bulge = -0.25 + r() * 0.7;
    const hws = pts.map((_, k) => {
      const t = k / (pts.length - 1);
      return Math.max(0.1, (widths[a] + (widths[b] - widths[a]) * smooth(0, 1, t)) * (1 + bulge * Math.sin(Math.PI * t)));
    });
    return [{ pts, hw: widths[a], hws }];
  }
  const cx = lake ? lake.x : 0, cz = lake ? lake.z : 0;
  const inner = lake ? lake.r * 0.8 : Math.max(...widths) * 1.05;
  return idx.map((i) => {
    const pts = line(edgeMid(i), [cx, cz], 10);
    const hws = pts.map((_, k) => {
      const t = k / (pts.length - 1);
      return widths[i] + (Math.max(widths[i], inner) - widths[i]) * smooth(0.15, 1, t);
    });
    return { pts, hw: widths[i], hws };
  });
}

/**
 * Campo da água de uma peça: distância assinada até a linha d'água nominal (negativa
 * dentro do rio), perfil do leito e correnteza. Junto a cada borda o campo vira o perfil
 * da própria borda (só a largura dela), então peças vizinhas concordam na emenda.
 */
function waterField(shape: WaterShape, paths: Path[], widths: readonly number[], flow: readonly number[], seed: number) {
  const { idx, lake } = shape;
  const n = idx.length;
  const junction = n >= 3 && !lake ? Math.max(...widths) * 1.05 : 0;
  // Margem orgânica: ondula no interior da peça; lagos ganham lóbulos.
  const r = mulberry32(seed ^ 0x51ed);
  const o = [r() * 6.3, r() * 6.3, r() * 6.3, r() * 6.3, r() * 6.3, r() * 6.3];
  const wiggle = (x: number, z: number) => {
    const w = Math.sin(x * 9.1 + o[0]) * Math.sin(z * 8.3 + o[1]) + Math.sin((x - z) * 15.7 + o[2]) * 0.45 + Math.sin((x + z) * 23 + o[3]) * 0.2;
    return w * 0.026;
  };
  const interior = (x: number, z: number) => {
    let d = Infinity;
    for (const p of paths) d = Math.min(d, nearestParam(x, z, p).d);
    if (lake) {
      const a = Math.atan2(z - lake.z, x - lake.x);
      const lobes = 1 + 0.1 * Math.sin(3 * a + o[4]) + 0.06 * Math.sin(5 * a + o[5]);
      d = Math.min(d, Math.hypot(x - lake.x, z - lake.z) - lake.r * lobes);
    }
    if (junction) d = Math.min(d, Math.hypot(x, z) - junction);
    return d + wiggle(x, z);
  };
  const e = (x: number, z: number) => {
    // Perfil das bordas próximas, misturado pelo inverso do quadrado da distância: na borda
    // vale exatamente o perfil dela (|s| − largura, ou terra), igual ao da vizinha.
    let A = 0, sw = 0, se = 0;
    for (let i = 0; i < 6; i++) {
      const [mx, mz] = edgeMid(i);
      const b = INR - (x * mx + z * mz) / INR;
      if (b >= SEAM_W) continue;
      const a = 1 - smooth(0, SEAM_W, b);
      const s = (z * mx - x * mz) / INR;
      const prof = widths[i] > 0 ? Math.abs(s) - widths[i] : 0.3;
      const w = a / Math.max(b, 1e-5) ** 2;
      sw += w;
      se += w * prof;
      A = Math.max(A, a);
    }
    const fi = interior(x, z);
    return A > 0 ? A * (se / sw) + (1 - A) * fi : fi;
  };
  const ground = (x: number, z: number) => {
    const d = e(x, z);
    return d >= BANK_W ? 0 : -BED_DEPTH * smooth(BANK_W, -0.05, d) - LAKE_DEEP * smooth(-0.08, -0.35, d);
  };
  /** Correnteza [fx, fz] num ponto da superfície. */
  const at = (x: number, z: number): [number, number] => {
    let best: ReturnType<typeof nearestParam> | null = null;
    let bi = 0;
    paths.forEach((p, i) => {
      const r = nearestParam(x, z, p);
      if (!best || r.d < best.d) {
        best = r;
        bi = i;
      }
    });
    const b = best as ReturnType<typeof nearestParam> | null;
    if (!b) return [0, 0];
    let dir = 1, speed = 1;
    if (paths.length === 1 && n === 2) {
      const sa = flow[idx[0]], sb = flow[idx[1]];
      if (sa < 0 && sb > 0) dir = 1;
      else if (sa > 0 && sb < 0) dir = -1;
      else {
        // As duas entram (encontro) ou as duas saem (nascente): a água para no meio.
        const toMid = b.t < 0.5 ? 1 : -1;
        dir = sa < 0 ? toMid : -toMid;
        speed = smooth(0, 0.45, Math.abs(b.t - 0.5) * 2);
      }
    } else {
      dir = flow[idx[bi]] < 0 ? 1 : -1; // t cresce da borda para o centro
      speed = smooth(0, 0.5, 1 - b.t);
      // No lago a água quase para.
      if (lake) speed *= 0.15 + 0.85 * smooth(lake.r * 0.4, lake.r * 1.2, Math.hypot(x - lake.x, z - lake.z));
    }
    return [b.tx * dir * speed, b.tz * dir * speed];
  };
  return { e, ground, at };
}

/**
 * Superfície da água: os mesmos triângulos do leito que ficam abaixo da linha d'água,
 * achatados em WATER_Y. Assim a profundidade interpolada em cada pixel é exatamente a
 * do chão de baixo (zero na beira, onde o barranco corta a água) e a cor do leito
 * acompanha a do barranco.
 */
class WaterBuf {
  pos: number[] = [];
  flow: number[] = [];
  bed: number[] = [];
  private cache = new Map<string, [number, number]>();
  constructor(private field: ReturnType<typeof waterField>) {}

  private attr(x: number, z: number) {
    const k = `${x.toFixed(4)},${z.toFixed(4)}`;
    let v = this.cache.get(k);
    if (!v) this.cache.set(k, (v = this.field.at(x, z)));
    return v;
  }

  tri(a: { p: V3; c: THREE.Color }, b: { p: V3; c: THREE.Color }, c: { p: V3; c: THREE.Color }) {
    if (Math.min(a.p[1], b.p[1], c.p[1]) > WATER_Y - 1e-4) return;
    // Sempre virado para cima.
    const cross = (b.p[0] - a.p[0]) * (c.p[2] - a.p[2]) - (b.p[2] - a.p[2]) * (c.p[0] - a.p[0]);
    for (const v of cross > 0 ? [a, c, b] : [a, b, c]) {
      const [x, y, z] = v.p;
      const [fx, fz] = this.attr(x, z);
      this.pos.push(x, WATER_Y, z);
      this.flow.push(fx, fz);
      this.bed.push(v.c.r, v.c.g, v.c.b, WATER_Y - y);
    }
  }
}

function strip(buf: Buf, pts: V2[], hw: number, y: number, color: THREE.Color, sp: Splat = NO_SPLAT) {
  const L: V3[] = [];
  const R: V3[] = [];
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(pts.length - 1, k + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    L.push([p[0] - tz * hw, y, p[1] + tx * hw]);
    R.push([p[0] + tz * hw, y, p[1] - tx * hw]);
  }
  for (let k = 0; k < pts.length - 1; k++) buf.quad(L[k], R[k], R[k + 1], L[k + 1], color, color, color, color, UP, sp);
}

function disc(buf: Buf, cx: number, cz: number, r: number, y: number, color: THREE.Color, seg = 12, sp: Splat = NO_SPLAT) {
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2;
    const a1 = ((k + 1) / seg) * Math.PI * 2;
    buf.tri([cx, y, cz], [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r], [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r], color, color, color, UP, sp);
  }
}

/** Caixa alongada entre dois pontos (trilhos, dormentes, pedras). */
function beam(buf: Buf, a: V2, b: V2, w: number, y0: number, y1: number, color: THREE.Color, dark: THREE.Color) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l = Math.hypot(dx, dz) || 1;
  const px = (-dz / l) * w, pz = (dx / l) * w;
  const a1: V3 = [a[0] + px, y1, a[1] + pz], a2: V3 = [a[0] - px, y1, a[1] - pz];
  const b1: V3 = [b[0] + px, y1, b[1] + pz], b2: V3 = [b[0] - px, y1, b[1] - pz];
  buf.quad(a1, a2, b2, b1, color, color, color, color, UP);
  const n1: V3 = [px, 0, pz], n2: V3 = [-px, 0, -pz];
  buf.quad(a1, b1, [b1[0], y0, b1[2]], [a1[0], y0, a1[2]], color, color, dark, dark, n1);
  buf.quad(a2, b2, [b2[0], y0, b2[2]], [a2[0], y0, a2[2]], color, color, dark, dark, n2);
}

/** Percorre um caminho chamando `fn` a cada `step` de comprimento. */
function alongPath(pts: V2[], start: number, step: number, fn: (x: number, z: number, tx: number, tz: number, k: number) => void) {
  let acc = 0;
  let next = start;
  let k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (seg === 0) continue;
    const tx = (b[0] - a[0]) / seg, tz = (b[1] - a[1]) / seg;
    while (next <= acc + seg) {
      const t = next - acc;
      fn(a[0] + tx * t, a[1] + tz * t, tx, tz, k++);
      next += step;
    }
    acc += seg;
  }
}

const shade = (c: THREE.Color, f: number) => c.clone().multiplyScalar(f);
const vary = (rng: Rng, c: THREE.Color, amount = 0.07) => c.clone().multiplyScalar(1 + (rng() - 0.5) * 2 * amount);

function samplePoint(rng: Rng, sector: number, minR = 0.13, margin = 0.08): V2 | null {
  const [ax, az] = corner(sector);
  const [bx, bz] = corner((sector + 1) % 6);
  const [mx, mz] = edgeMid(sector);
  for (let tries = 0; tries < 6; tries++) {
    let u = rng(), v = rng();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const x = u * ax + v * bx;
    const z = u * az + v * bz;
    if (Math.hypot(x, z) < minR) continue;
    if ((x * mx + z * mz) / INR > INR - margin) continue;
    return [x, z];
  }
  return null;
}

function insidePoly(x: number, z: number, pts: V2[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Marcos de planta larga: as casas guardam mais distância deles. */
const WIDE_LANDMARKS: ReadonlySet<string> = new Set(['pyramid', 'pylon', 'kancha', 'hall']);

/** Ângulo de rotação em y que leva o eixo x local para a direção (dx, dz). */
const yawTo = (dx: number, dz: number) => Math.atan2(-dz, dx);

export function buildTile(edges: readonly T[], seed: number, theme: Theme, opts: BuildOpts): TileBuild {
  const rng = mulberry32(seed);
  const detail = opts.detail;
  const g = new Buf(true);
    const decos: Deco[] = [];
  const chimneys: number[] = [];
  const groundCols = edges.map((t) => tc(theme.ground[t]));
  // y = 0 quer dizer "no chão": acompanha o leito e as margens dos rios.
  const D = (key: string, x: number, y: number, z: number, ry: number, s: number | V3, color: THREE.Color, anim?: Anim) => {
    const [sx, sy, sz] = typeof s === 'number' ? [s, s, s] : s;
    decos.push({ key, x, y: y === 0 ? groundY(x, z) : y, z, ry, sx, sy, sz, color, anim });
  };
  /** Andaime em volta de uma construção que sobe: `w` de largura e `h` de altura. */
  const scaffold = (x: number, z: number, ry: number, w: number, h: number) => {
    D('scaffold', x, 0, z, ry, [w / 0.15, h + 0.03, w / 0.15], WHITE);
    decos[decos.length - 1].transient = true;
  };

  const shape = waterShape(edges, seed);
  // O moinho especial precisa do rio passando reto, sem lago no meio.
  if (opts.special === 'watermill') shape.lake = null;
  const widths = shape.widths.map((w, i) => (w > 0 ? (opts.widths?.[i] || w) : 0));
  const water = { idx: shape.idx, paths: waterPaths(shape, widths, seed) };
  const road = railPaths(edges, seed, opts.special === 'station');
  const hasWater = water.idx.length > 0;
  const flow = opts.flow ?? resolveFlow(edges);
  const field = hasWater ? waterField(shape, water.paths, widths, flow, seed) : null;
  /** Distância até a água ou a via mais próxima (negativa dentro): a decoração desvia. */
  const clear = (x: number, z: number) => Math.min(road.paths.length ? distToPaths(x, z, road.paths) : Infinity, field ? field.e(x, z) - (shape.lake ? BANK_EXTRA : 0) : Infinity);
  /** Altura do chão: 0, exceto no leito e nas margens dos rios. */
  const groundY = (x: number, z: number) => (field ? field.ground(x, z) : 0);
  const bank = tc(theme.bank);
  const waterSide = tc(theme.water).clone().lerp(bank, 0.25);
  const waterDeep = shade(tc(theme.water), 0.55);
  const wb = field ? new WaterBuf(field) : null;

  // --- Topo: 6 setores subdivididos, com cores misturadas nas divisas. Peças com rio
  // usam uma malha mais fina para o leito e as margens inclinadas.
  const N = hasWater ? 12 : 4;
  const center = new THREE.Color(0, 0, 0);
  for (const c of groundCols) center.add(c);
  center.multiplyScalar(1 / 6);
  // Rio e estrada têm chão de prado para o detalhe do shader.
  const landOf = (t: T) => (t === T.Forest ? 1 : t === T.Field ? 2 : t === T.Village ? 3 : 0);
  const oneHot = (t: T): number[] => [0, 1, 2, 3].map((k) => (k === landOf(t) ? 1 : 0));
  const centerSplat = [0, 0, 0, 0];
  for (const e of edges) oneHot(e).forEach((v, k) => (centerSplat[k] += v / 6));
  const topColor = (i: number, a: number, b: number, x: number, z: number): { c: THREE.Color; s: Splat } => {
    const own = groundCols[i];
    const c = own.clone();
    let sp = oneHot(edges[i]);
    const mixS = (o: number[], t: number) => (sp = sp.map((v, k) => v + (o[k] - v) * t));
    const sum = a + b;
    if (sum > 0) {
      const sAng = b / sum; // 0 no lado do canto i, 1 no lado do canto i+1
      const tA = 0.5 * (1 - smooth(0, 0.3, sAng)), tB = 0.5 * (1 - smooth(0, 0.3, 1 - sAng));
      c.lerp(groundCols[(i + 5) % 6], tA);
      mixS(oneHot(edges[(i + 5) % 6]), tA);
      c.lerp(groundCols[(i + 1) % 6], tB);
      mixS(oneHot(edges[(i + 1) % 6]), tB);
    }
    const tC = 1 - smooth(0, 0.3, sum / N);
    c.lerp(center, tC);
    mixS(centerSplat, tC);
    if (field) {
      const e = field.e(x, z);
      const sand = 1 - smooth(0.03, 0.085, e);
      c.lerp(bank, sand);
      c.multiplyScalar(1 - 0.3 * (1 - smooth(0.004, 0.03, e)));
      sp = sp.map((v) => v * (1 - sand));
    }
    return { c, s: sp as unknown as Splat };
  };
  for (let i = 0; i < 6; i++) {
    const A = corner(i);
    const B = corner((i + 1) % 6);
    const vs = new Map<number, { p: V3; c: THREE.Color; s: Splat }>();
    const V = (a: number, b: number) => {
      const k = a * 64 + b;
      let v = vs.get(k);
      if (!v) {
        const x = (a / N) * A[0] + (b / N) * B[0], z = (a / N) * A[1] + (b / N) * B[1];
        v = { p: [x, groundY(x, z), z], ...topColor(i, a, b, x, z) };
        vs.set(k, v);
      }
      return v;
    };
    for (let a = 0; a < N; a++) {
      for (let b = 0; b < N - a; b++) {
        const p0 = V(a, b), p1 = V(a + 1, b), p2 = V(a, b + 1);
        g.tri(p0.p, p1.p, p2.p, p0.c, p1.c, p2.c, UP, p0.s, p1.s, p2.s);
        wb?.tri(p0, p1, p2);
        if (a + b < N - 1) {
          const p3 = V(a + 1, b + 1);
          g.tri(p1.p, p3.p, p2.p, p1.c, p3.c, p2.c, UP, p1.s, p3.s, p2.s);
          wb?.tri(p1, p3, p2);
        }
      }
    }

    // --- Lateral desta borda, em camadas de terra; acompanha o perfil do leito.
    const [mx, mz] = edgeMid(i);
    const nrm: V3 = [mx, 0, mz];
    const side = tc(theme.side);
    const sideDark = tc(theme.sideDark);
    const midC = side.clone().lerp(sideDark, 0.35);
    for (let k = 0; k < N; k++) {
      const v0 = V(N - k, k), v1 = V(N - k - 1, k + 1);
      const [x0, y0, z0] = v0.p, [x1, y1, z1] = v1.p;
      const l0 = shade(v0.c, 0.72), l1 = shade(v1.c, 0.72);
      const b0 = Math.min(y0 - 0.05, -0.05), b1 = Math.min(y1 - 0.05, -0.05);
      g.quad([x0, y0, z0], [x1, y1, z1], [x1, b1, z1], [x0, b0, z0], l0, l1, l1, l0, nrm);
      g.quad([x0, b0, z0], [x1, b1, z1], [x1, -0.15, z1], [x0, -0.15, z0], side, side, midC, midC, nrm);
      g.quad([x0, -0.15, z0], [x1, -0.15, z1], [x1, -TILE_T, z1], [x0, -TILE_T, z0], midC, midC, sideDark, sideDark, nrm);
      // Corte da água na lateral (só aparece na beira aberta do mapa, como num aquário).
      if (y0 < WATER_Y - 0.001 || y1 < WATER_Y - 0.001) {
        const c0 = Math.min(y0, WATER_Y), c1 = Math.min(y1, WATER_Y);
        g.quad([x0, WATER_Y, z0], [x1, WATER_Y, z1], [x1, c1, z1], [x0, c0, z0], waterSide, waterSide, waterDeep, waterDeep, [mx * 1.01, 0, mz * 1.01]);
      }
    }
  }

  // --- Lugares reservados para construções especiais (a decoração desvia deles).
  const reserved: [number, number, number][] = [];
  const taken: V2[] = [];
  const free = (x: number, z: number, minD: number) => {
    for (const [tx, tz] of taken) if ((tx - x) ** 2 + (tz - z) ** 2 < minD * minD) return false;
    for (const [rx, rz, rr] of reserved) if ((rx - x) ** 2 + (rz - z) ** 2 < rr * rr) return false;
    return true;
  };
  if (opts.center) reserved.push([0, 0, 0.3]);

  // --- Rios e lagos: plantas na água e na margem (a superfície já saiu com o leito).
  if (field) {
    const lake = shape.lake && water.idx.length >= 2;
    // Vitórias-régias na água parada: no lago, ou perto da margem do rio.
    let lilies = randInt(rng, 0, lake ? 4 : water.idx.length >= 3 ? 3 : 1) + (lake ? 1 : 0);
    for (let tries = 0; lilies > 0 && tries < 40; tries++) {
      const x = (rng() - 0.5) * 1.7, z = (rng() - 0.5) * 1.7;
      const d = field.e(x, z);
      if (d > -0.035 || (!lake && d < -0.09) || Math.hypot(x, z) > INR - 0.08) continue;
      D('lily', x, WATER_Y - 0.0095, z, rng() * 6, 1, vary(rng, tc(theme.lily)));
      lilies--;
    }
    // Juncos na beira: pontos sorteados que caem na faixa logo fora da linha d'água.
    for (let tries = Math.round(320 * Math.max(0.35, detail)); tries > 0; tries--) {
      const x = (rng() - 0.5) * 2, z = (rng() - 0.5) * 2;
      const d = field.e(x, z);
      if (d < 0.004 || d > 0.032 || Math.hypot(x, z) > INR - 0.03) continue;
      D('reed', x, 0, z, rng() * 6, randRange(rng, 0.8, 1.3), WHITE);
    }
  }

  // --- Estradas: trilho, terra, pedra, areia ou via maglev.
  if (road.idx.length) {
    const bed = tc(theme.roadBed);
    const det = tc(theme.roadDetail);
    const sleeper = tc(theme.sleeper);
    for (const p of road.paths) {
      strip(g, p.pts, p.hw * (theme.road === 'sand' ? 1.15 : 1), BED_Y, bed);
      if (theme.road === 'rail') {
        alongPath(p.pts, 0.035, 0.07, (cx, cz, tx, tz) => beam(g, [cx - tz * 0.085, cz + tx * 0.085], [cx + tz * 0.085, cz - tx * 0.085], 0.014, BED_Y, BED_Y + 0.012, sleeper, shade(sleeper, 0.7)));
        for (let k = 0; k < p.pts.length - 1; k++) {
          const a = p.pts[k], b = p.pts[k + 1];
          const seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const tx = (b[0] - a[0]) / seg, tz = (b[1] - a[1]) / seg;
          for (const off of [-0.048, 0.048]) beam(g, [a[0] - tz * off, a[1] + tx * off], [b[0] - tz * off, b[1] + tx * off], 0.008, BED_Y, BED_Y + 0.026, det, shade(det, 0.6));
        }
      } else if (theme.road === 'dirt') {
        for (const off of [-0.04, 0.04]) {
          const shifted = p.pts.map((q, k) => {
            const a = p.pts[Math.max(0, k - 1)], b = p.pts[Math.min(p.pts.length - 1, k + 1)];
            const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            return [q[0] - ((b[1] - a[1]) / l) * off, q[1] + ((b[0] - a[0]) / l) * off] as V2;
          });
          strip(g, shifted, 0.013, BED_Y + 0.001, det);
        }
      } else if (theme.road === 'stone') {
        alongPath(p.pts, 0.012, 0.032, (cx, cz, tx, tz, k) => {
          for (const off of [-0.052, -0.017, 0.018, 0.053]) {
            const o = off + (k % 2 ? 0.017 : 0);
            if (Math.abs(o) > 0.07) continue;
            const x = cx - tz * o, z = cz + tx * o;
            const c = bed.clone().lerp(det, rng() * 0.8);
            beam(g, [x - tx * 0.013, z - tz * 0.013], [x + tx * 0.013, z + tz * 0.013], 0.014, BED_Y, BED_Y + 0.004 + rng() * 0.002, c, shade(c, 0.75));
          }
        });
      } else if (theme.road === 'sand') {
        alongPath(p.pts, 0.02, 0.028, (cx, cz, tx, tz) => {
          const o = (rng() - 0.5) * 0.08;
          disc(g, cx - tz * o, cz + tx * o, 0.006, BED_Y + 0.001, det, 5);
        });
      } else {
        // Maglev: viga elevada sobre pilares.
        const beamC = det;
        for (let k = 0; k < p.pts.length - 1; k++) beam(g, p.pts[k], p.pts[k + 1], 0.024, 0.05, 0.062, beamC, shade(beamC, 0.7));
        alongPath(p.pts, 0.06, 0.16, (cx, cz, tx, tz) => beam(g, [cx - tx * 0.012, cz - tz * 0.012], [cx + tx * 0.012, cz + tz * 0.012], 0.012, 0, 0.052, shade(beamC, 0.8), shade(beamC, 0.6)));
      }
    }
    // Junção: pátio de cascalho cobrindo o miolo do triângulo de curvas.
    if (road.idx.length !== 2) disc(g, 0, 0, road.idx.length > 2 ? 0.3 : ROAD_HW * 1.05, BED_Y + 0.001, bed, road.idx.length > 2 ? 18 : 12);
    if (road.idx.length === 1) {
      // Estação (ou pousada) no fim da linha.
      const [mx, mz] = edgeMid(road.idx[0]);
      const ux = mx / INR, uz = mz / INR;
      const sx = ux * 0.3 - uz * 0.16, sz = uz * 0.3 + ux * 0.16;
      D('station', sx, BED_Y, sz, yawTo(ux, uz), 1, WHITE);
      reserved.push([sx, sz, 0.15]);
    }
    // Portal sobre a via, na primeira borda de linha que encosta num setor de vila.
    const gi = theme.gate ? road.idx.find((i) => edges[(i + 1) % 6] === T.Village || edges[(i + 5) % 6] === T.Village) : undefined;
    if (gi !== undefined) {
      const [mx, mz] = edgeMid(gi);
      const n = nearestOnPaths(mx * 0.7, mz * 0.7, road.paths);
      D('gate', n.p[0], BED_Y, n.p[1], yawTo(-n.t[1], n.t[0]), 1, WHITE);
      reserved.push([n.p[0], n.p[1], 0.17]);
    }
  }

  // Camisas dos aldeões: metade na cor da casa, metade nas cores dos telhados, escolhidas pela
  // semente (sem gastar o rng).
  const shirts = theme.houses.flatMap((h) => h.roofs);
  const shirt = (k: number) => tc(((seed >>> 0) + k) % 2 ? theme.ui.accent : shirts[((seed >>> 0) + k * 7) % shirts.length]);

  // --- Interações nas bordas: reservam um lugar perto da borda do setor.
  for (const s of opts.synergies ?? []) {
    const [mx, mz] = edgeMid(s.sector);
    const x = mx * 0.64, z = mz * 0.64;
    reserved.push([x, z, 0.15]);
    const ry = yawTo(mx, mz) + Math.PI / 2;
    // Aldeão do ofício, dentro da área reservada, entre a construção e o meio da peça (sem sorteio).
    const wx = x - mx * 0.13 - mz * 0.06, wz = z - mz * 0.13 + mx * 0.06;
    if (s.kind === 'mill') D('folk:sack', wx, 0, wz, yawTo(-mx, -mz), 1, shirt(s.sector), 'carry');
    else D(s.kind === 'lumber' ? 'folk:axe' : 'folk:hoe', wx, 0, wz, yawTo(x - wx, z - wz), 1, shirt(s.sector), s.kind === 'lumber' ? 'chop' : 'tend');
    if (s.kind === 'lumber') {
      D('logs', x, 0, z, ry, 1.25, WHITE);
      scaffold(x, z, ry, 0.2, 0.1);
    } else if (s.kind === 'apiary') {
      D('apiary', x, 0, z, ry, 1.3, WHITE);
      scaffold(x, z, ry, 0.15, 0.06);
      const c = tc(pick(rng, theme.flowers));
      for (let f = 0; f < 6; f++) D('flower', x + (rng() - 0.5) * 0.18, 0, z + (rng() - 0.5) * 0.18, 0, 1, c);
    } else if (s.kind === 'pasture') {
      D('fence', x, 0, z, ry, 1, WHITE);
      scaffold(x, z, ry, 0.26, 0.04);
      for (let a = 0; a < 3; a++) D('animal', x + (rng() - 0.5) * 0.1, 0, z + (rng() - 0.5) * 0.1, rng() * 6, randRange(rng, 0.9, 1.15), vary(rng, tc(pick(rng, theme.animals.colors)), 0.05), 'wander');
    } else if (s.kind === 'mill') {
      const sc = (theme.mill === 'windmill' ? 1.1 : theme.mill === 'windpump' ? 1 : 1.2) * LANDMARK_SCALE;
      const face = Math.atan2(-mx, -mz); // +z local (porta e pás) voltado para o centro da peça
      D('mill', x, 0, z, face, sc, WHITE);
      scaffold(x, z, face, 0.17 * sc, theme.mill === 'windmill' || theme.mill === 'windpump' ? 0.34 * sc : 0.2 * sc);
      if (theme.mill === 'windmill') {
        // Cubo das pás: à frente do capuz, na direção +z local do moinho.
        const fx = Math.sin(face) * 0.078 * sc, fz = Math.cos(face) * 0.078 * sc;
        D('sails', x + fx, 0.255 * sc, z + fz, face, sc, WHITE, 'spin-z');
      } else if (theme.mill === 'windpump') {
        const fx = Math.sin(face) * 0.022 * sc, fz = Math.cos(face) * 0.022 * sc;
        D('rotor', x + fx, groundY(x, z) + 0.318 * sc, z + fz, face, sc, WHITE, 'spin-z');
      }
    }
  }

  // --- Peça especial: a construção dela, sem sorteio. A estação e o moinho ficam na beira do
  // trilho ou do rio, de frente para ele e do lado da vila; o farol, numa ilhota no meio do lago.
  if (opts.special === 'lighthouse' && water.idx.length === 1) {
    const [ex, ez] = edgeMid(water.idx[0]);
    D('special:lighthouse', 0, WATER_Y - 0.035, 0, yawTo(ex, ez), 1.4, WHITE);
    reserved.push([0, 0, 0.24]);
  } else if (opts.special === 'station' || opts.special === 'watermill') {
    const along = opts.special === 'station' ? road : water;
    const path = along.paths[0];
    if (path) {
      const [px, pz] = path.pts[Math.floor(path.pts.length / 2)];
      const n = nearestOnPaths(px, pz, [path]);
      // Normal do caminho apontando para o lado da primeira borda de vila.
      const vi = edges.findIndex((t) => t === T.Village);
      const [vx, vz] = edgeMid(vi < 0 ? 1 : vi);
      let nx = -n.t[1], nz = n.t[0];
      if (nx * (vx - px) + nz * (vz - pz) < 0) [nx, nz] = [-nx, -nz];
      if (opts.special === 'station') {
        // A plataforma (até +0,12 em z no kit, ×1,4) encosta no trilho.
        const sx = px + nx * (ROAD_HW + 0.17), sz = pz + nz * (ROAD_HW + 0.17);
        // O trilho fica em +z do kit: a frente do kit olha para -n.
        D('special:station', sx, BED_Y, sz, yawTo(-nz, nx), 1.4, WHITE);
        // As casas desviam pelo centro delas: o raio cobre a estação e meia casa.
        reserved.push([sx, sz, 0.34]);
      } else {
        const wx = px + nx * (n.hw + 0.012), wz = pz + nz * (n.hw + 0.012);
        D('wheel', wx, WATER_Y + 0.08, wz, yawTo(nx, nz), 1.7, WHITE, 'spin-x');
        const hx = px + nx * (n.hw + 0.17), hz = pz + nz * (n.hw + 0.17);
        D('special:watermill', hx, 0, hz, yawTo(nx, nz) + Math.PI, 1.25, WHITE);
        reserved.push([wx, wz, 0.14], [hx, hz, 0.3]);
      }
    }
  }

  // --- Marco da era: o marco do tema maior, num tablado de pedra, com uma flâmula por era.
  // Fica no meio da peça ou, se um rio ou estrada passa ali, no meio de um setor de vila.
  // Sem sorteio, para o resto da peça não mudar.
  if (opts.eraMark) {
    const wide = WIDE_LANDMARKS.has(theme.landmark);
    const villages = [0, 1, 2, 3, 4, 5].filter((i) => edges[i] === T.Village);
    const spots: [number, number, number][] = [[0, 0, wide ? 1.15 : 1.25]];
    for (const i of villages) {
      const [mx, mz] = edgeMid(i);
      spots.push([mx * 0.5, mz * 0.5, wide ? 0.8 : 1]);
    }
    const spot = spots.find(([x, z, sc]) => clear(x, z) > 0.27 * sc + 0.04 && free(x, z, 0.2));
    if (spot) {
      const [x, z, sc] = spot;
      const [fx, fz] = edgeMid(villages[0] ?? 0);
      const ry = x === 0 && z === 0 ? yawTo(fx, fz) : yawTo(-x, -z);
      const R = 0.24 * sc;
      disc(g, x, z, R, 0.006, shade(tc(theme.rock), 1.18), 18, [0, 0, 0, 1]);
      D('landmark', x, 0.006, z, ry, sc, WHITE);
      scaffold(x, z, ry, (wide ? 0.42 : 0.3) * sc, (wide ? 0.3 : 0.42) * sc);
      if (theme.landmark === 'windmill') D('sails', x + Math.sin(ry) * 0.078 * sc, 0.006 + 0.255 * sc, z + Math.cos(ry) * 0.078 * sc, ry, sc, WHITE, 'spin-z');
      // Flâmulas na cor de destaque do tema, espalhadas em volta do tablado.
      const flag = tc(theme.ui.accent);
      for (let k = 0; k < opts.eraMark; k++) {
        const a = ry + Math.PI / 4 + (k * Math.PI * 2) / opts.eraMark;
        D('pennant', x + Math.cos(a) * R * 0.88, 0.006, z - Math.sin(a) * R * 0.88, ry, 1.35, flag);
      }
      reserved.push([x, z, R + 0.05]);
    }
  }

  if (opts.wonder) reserved.push([0, 0, 0.6]);

  // --- Sítio descoberto: no meio da peça ou no meio de um setor sem rio nem estrada (sem sorteio).
  if (opts.site) {
    const spots: [number, number][] = [[0, 0]];
    for (let i = 0; i < 6; i++) {
      if (isStrict(edges[i])) continue;
      const [mx, mz] = edgeMid(i);
      spots.push([mx * 0.5, mz * 0.5]);
    }
    const spot = spots.find(([x, z]) => clear(x, z) > 0.17 && free(x, z, 0.16)) ?? spots[spots.length - 1];
    const [x, z] = spot;
    const ry = x === 0 && z === 0 ? 0.4 : yawTo(-x, -z);
    disc(g, x, z, 0.15, 0.004, shade(tc(theme.ground[T.Village]), 0.9), 14);
    D(`site:${opts.site}`, x, 0.004, z, ry, 1, opts.site === 'treasure' ? tc(theme.animals.colors[0]) : WHITE);
    reserved.push([x, z, 0.17]);
  }

  // --- Construções internas (sem pontos): moinho d'água, estação, silo, irrigação.
  const lush = new Set<number>();
  // A peça especial já tem a sua construção: nada de roda ou estação pequenas ao lado.
  let watermill = !!opts.special;
  let station = road.idx.length === 1 || !!opts.special;
  for (let i = 0; i < 6; i++) {
    for (const j of [(i + 1) % 6, (i + 5) % 6]) {
      const shared = j === (i + 1) % 6 ? (i + 1) % 6 : i; // canto comum aos dois setores
      const [cx, cz] = corner(shared);
      const tx0 = cx * 0.46, tz0 = cz * 0.46;
      if (edges[i] === T.Field && edges[j] === T.Water) lush.add(i);
      if (edges[i] === T.Village && edges[j] === T.Water && !watermill && water.paths.length && !(shape.lake && water.idx.length >= 2)) {
        const n = nearestOnPaths(tx0, tz0, water.paths);
        let px = tx0 - n.p[0], pz = tz0 - n.p[1];
        const l = Math.hypot(px, pz) || 1;
        px /= l;
        pz /= l;
        const wx = n.p[0] + px * (n.hw + 0.012), wz = n.p[1] + pz * (n.hw + 0.012);
        if (Math.hypot(wx, wz) > INR - 0.08) continue;
        watermill = true;
        D('wheel', wx, WATER_Y + 0.05, wz, yawTo(px, pz), 1, WHITE, 'spin-x');
        const hx = n.p[0] + px * (n.hw + 0.11), hz = n.p[1] + pz * (n.hw + 0.11);
        const ry = yawTo(n.t[0], n.t[1]);
        D('wall:0', hx, 0, hz, ry, 1.15, WHITE.clone().multiply(tc(theme.houses[0].walls[0])));
        D('roof:0', hx, 0, hz, ry, 1.15, tc(theme.houses[0].roofs[0]).clone());
        reserved.push([wx, wz, 0.08], [hx, hz, 0.13]);
      }
      if (edges[i] === T.Village && edges[j] === T.Rail && !station && road.paths.length) {
        const n = nearestOnPaths(tx0, tz0, road.paths);
        let px = tx0 - n.p[0], pz = tz0 - n.p[1];
        const l = Math.hypot(px, pz) || 1;
        px /= l;
        pz /= l;
        const sx = n.p[0] + px * (ROAD_HW + 0.045), sz = n.p[1] + pz * (ROAD_HW + 0.045);
        if (Math.hypot(sx, sz) > INR - 0.12) continue;
        station = true;
        D('station', sx, BED_Y, sz, yawTo(n.t[0], n.t[1]), 1, WHITE);
        reserved.push([sx, sz, 0.14]);
      }
      if (edges[i] === T.Field && edges[j] === T.Rail && road.paths.length && rng() < 0.4) {
        const n = nearestOnPaths(tx0, tz0, road.paths);
        let px = tx0 - n.p[0], pz = tz0 - n.p[1];
        const l = Math.hypot(px, pz) || 1;
        const sx = n.p[0] + (px / l) * (ROAD_HW + 0.06), sz = n.p[1] + (pz / l) * (ROAD_HW + 0.06);
        if (Math.hypot(sx, sz) > INR - 0.1 || !free(sx, sz, 0.1)) continue;
        D('silo', sx, 0, sz, yawTo(n.t[0], n.t[1]), 1, WHITE);
        reserved.push([sx, sz, 0.1]);
      }
    }
  }

  // --- Ponte: rio de duas bordas com vila numa margem e terra na outra. Sem sorteio,
  // para não mudar o resto da peça.
  // Rio largo demais para o vão da ponte (ou que vira lago) fica sem ela.
  if (theme.bridge && water.idx.length === 2 && !shape.lake && (water.paths[0].hws?.[8] ?? RIVER_HW) <= 0.215) {
    const [a, b] = water.idx;
    const sideA = edges.slice(a + 1, b), sideB = [...edges.slice(b + 1), ...edges.slice(0, a)];
    if (sideA.length && sideB.length && (sideA.includes(T.Village) || sideB.includes(T.Village))) {
      const pts = water.paths[0].pts;
      const m = pts.length >> 1;
      const [px, pz] = pts[m];
      const tx = pts[m + 1][0] - pts[m - 1][0], tz = pts[m + 1][1] - pts[m - 1][1];
      const l = Math.hypot(tx, tz) || 1;
      const ex = (-tz / l) * 0.3, ez = (tx / l) * 0.3;
      if (free(px + ex, pz + ez, 0.06) && free(px - ex, pz - ez, 0.06)) {
        // y explícito: com 0 a ponte iria para o fundo do leito.
        D('bridge', px, 0.001, pz, yawTo(ex, ez), 1, WHITE);
        reserved.push([px + ex, pz + ez, 0.1], [px - ex, pz - ez, 0.1]);
      }
    }
  }

  // --- Marco no centro das vilas grandes.
  const villageCount = edges.filter((e) => e === T.Village).length;
  const landmarkRoll = rng();
  if (theme.landmark !== 'none' && villageCount >= 2 && clear(0, 0) > 0.2 && free(0, 0, 0.2) && landmarkRoll < theme.landmarkChance * (villageCount - 1) * 0.8) {
    const ry = rng() * Math.PI * 2;
    const sc = LANDMARK_SCALE;
    D('landmark', 0, 0, 0, ry, sc, WHITE);
    if (theme.landmark === 'windmill') {
      const fx = Math.sin(ry) * 0.078 * sc, fz = Math.cos(ry) * 0.078 * sc;
      D('sails', fx, 0.255 * sc, fz, ry, sc, WHITE, 'spin-z');
    }
    reserved.push([0, 0, (WIDE_LANDMARKS.has(theme.landmark) ? 0.3 : 0.2) * sc]);
  }

  // --- Plantações: parcelas de terra com fileiras de plantas.
  const cropKinds = theme.crops.map((c) => [c, c.weight] as const);
  for (let i = 0; i < 6; i++) {
    if (edges[i] !== T.Field) continue;
    const crop: CropKind = weighted(rng, cropKinds);
    const L = CROP_LAYOUT[crop.style];
    const soil = tc(crop.soil);
    const isLush = lush.has(i);
    const plots: V2[] = [];
    const want = randInt(rng, 3, 5);
    for (let k = 0, tries = 0; k < want && tries < want * 5; tries++) {
      const p = samplePoint(rng, i, 0.04, 0.03);
      const rad = randRange(rng, 0.15, 0.22);
      if (!p || clear(p[0], p[1]) < rad * 1.1) continue;
      if (plots.some(([x, z]) => (x - p[0]) ** 2 + (z - p[1]) ** 2 < 0.2 * 0.2)) continue;
      if (!free(p[0], p[1], 0.05)) continue;
      plots.push(p);
      k++;
      const sides = randInt(rng, 4, 6);
      const rot0 = rng() * Math.PI * 2;
      const pts: V2[] = [];
      for (let j = 0; j < sides; j++) {
        const a = rot0 + (j / sides) * Math.PI * 2 + (rng() - 0.5) * 0.5;
        const rr = rad * randRange(rng, 0.8, 1.1);
        let x = p[0] + Math.cos(a) * rr;
        let z = p[1] + Math.sin(a) * rr;
        for (let e = 0; e < 6; e++) {
          const [mx, mz] = edgeMid(e);
          const proj = (x * mx + z * mz) / INR;
          const lim = INR - 0.02;
          if (proj > lim) {
            x -= (mx / INR) * (proj - lim);
            z -= (mz / INR) * (proj - lim);
          }
        }
        pts.push([x, z]);
      }
      const cx = pts.reduce((s, q) => s + q[0], 0) / sides;
      const cz = pts.reduce((s, q) => s + q[1], 0) / sides;
      const h = 0.006 + k * 0.002;
      // De longe a parcela precisa "ler" como a cultura: a terra puxa a cor da planta.
      const tintAmt = crop.style === 'rice' ? 0.2 : crop.style === 'tulip' ? 0.1 : 0.42;
      const sc = vary(rng, soil.clone().lerp(tc(crop.colors[0]), tintAmt), 0.08);
      const dark = shade(sc, 0.72);
      for (let j = 0; j < sides; j++) {
        const a = pts[j], b = pts[(j + 1) % sides];
        g.tri([cx, h, cz], [a[0], h, a[1]], [b[0], h, b[1]], sc, sc, sc, UP);
        g.quad([a[0], h, a[1]], [b[0], h, b[1]], [b[0], 0, b[1]], [a[0], 0, a[1]], dark, dark, dark, dark, [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz]);
      }
      // Fileiras: direção aleatória por parcela; densidade cai com a qualidade.
      const inner = pts.map(([x, z]) => [cx + (x - cx) * 0.86, cz + (z - cz) * 0.86] as V2);
      const dens = 1 / Math.sqrt(Math.max(0.3, detail));
      const gap = L.rowGap * dens, step = L.step * dens;
      const dir = rng() * Math.PI;
      const ux = Math.cos(dir), uz = Math.sin(dir);
      const base = tc(pick(rng, crop.colors));
      let row = 0;
      for (let o = -rad; o <= rad; o += gap, row++) {
        const rowCol = L.rowColor ? tc(crop.colors[(row + k) % crop.colors.length]) : null;
        for (let t = -rad + ((row % 2) * step) / 2; t <= rad; t += step) {
          const x = cx + ux * t - uz * o + (rng() - 0.5) * step * 0.25;
          const z = cz + uz * t + ux * o + (rng() - 0.5) * step * 0.25;
          if (!insidePoly(x, z, inner) || !free(x, z, 0)) continue; // não planta dentro de construções
          const s = randRange(rng, L.scale[0], L.scale[1]) * (isLush ? 1.12 : 1);
          let c = rowCol ?? (rng() < 0.7 ? base : tc(pick(rng, crop.colors)));
          c = vary(rng, c, 0.06);
          if (isLush && !rowCol) c = c.lerp(LUSH, 0.22);
          const hedge = crop.style === 'tea' || crop.style === 'vineyard' || crop.style === 'lavender';
          D(`crop:${crop.style}`, x, h, z, hedge ? yawTo(ux, uz) : rng() * Math.PI * 2, s, c);
        }
      }
    }
  }

  // --- Árvores, casas, capim, animais.
  const forestKinds = theme.forest.map((k) => [k, k.weight] as const);
  // Clareira da serraria: as árvores perto dela viram tocos (sem sorteio a mais, para o resto
  // da peça sair igual).
  const clearings = (opts.synergies ?? []).filter((h) => h.kind === 'lumber').map((h) => edgeMid(h.sector));
  const addTree = (x: number, z: number) => {
    const kind = weighted(rng, forestKinds);
    const s = randRange(rng, 0.9, 1.4) * TREE_SCALE * (kind.geo === 'crystal' ? 1.4 : kind.geo === 'cactus' ? 1.1 : 1);
    const ry = rng() * Math.PI * 2;
    const sy = s * randRange(rng, 0.9, 1.15);
    const color = vary(rng, tc(pick(rng, kind.colors)));
    taken.push([x, z]);
    if (kind.geo !== 'crystal' && clearings.some(([mx, mz]) => Math.hypot(x - mx * 0.64, z - mz * 0.64) < 0.34)) {
      D('stump', x, 0, z, ry, 1.2, tc(theme.trunk));
      return;
    }
    D(`tree:${kind.geo}`, x, 0, z, ry, [s, sy, s], color);
    trees.push([x, z, s]);
  };
  const trees: [number, number, number][] = [];
  const houseKinds = theme.houses.map((h, i) => [i, h.weight] as const);
  const houses: { x: number; z: number; s: number; sector: number }[] = [];
  // Cor do telhado por peça (uma por tipo de casa), com uma ou outra exceção: de longe a vila lê
  // como um bloco de cor, não como confete de telhados vermelhos, azuis e amarelos misturados.
  const tileRoof = new Map<number, string>();
  const addHouse = (x: number, z: number, baseAng: number, sector = -1) => {
    const i = weighted(rng, houseKinds);
    const kind = theme.houses[i];
    const meta = opts.houses[i];
    // Poucas casas grandes, alinhadas à borda: de longe cada uma se lê sozinha.
    const s = randRange(rng, 1.5, 1.8) * (kind.body === 'long' ? 0.9 : 1);
    const sy = randRange(rng, 0.92, 1.12);
    const ry = baseAng + (rng() < 0.5 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.12;
    D(`wall:${i}`, x, 0, z, ry, [s, s * sy, s], vary(rng, tc(pick(rng, kind.walls)), 0.04));
    let roof = tileRoof.get(i);
    if (roof === undefined) tileRoof.set(i, (roof = pick(rng, kind.roofs)));
    else if (rng() < 0.2) roof = pick(rng, kind.roofs);
    D(`roof:${i}`, x, 0, z, ry, [s, s * sy, s], vary(rng, tc(roof), 0.05));
    if (meta?.chimney && rng() < 0.85) {
      const [cx, cy, cz] = meta.chimney;
      const c = Math.cos(ry), sn = Math.sin(ry);
      chimneys.push(x + (cx * c + cz * sn) * s, cy * s * sy, z + (-cx * sn + cz * c) * s, i);
    }
    taken.push([x, z]);
    houses.push({ x, z, s, sector });
  };

  const grassN = Math.round(randInt(rng, 9, 15) * detail);
  for (let i = 0; i < 6; i++) {
    const terr = edges[i];
    const sectorAng = -(Math.PI / 6 + (Math.PI / 3) * i);
    if (terr === T.Forest) {
      // Árvores maiores e menos numerosas: cada copa se lê sozinha, como as casas.
      const n = Math.max(2, Math.round(randInt(rng, theme.treesPerSector[0], theme.treesPerSector[1]) * 0.7));
      for (let k = 0, tries = 0; k < n && tries < n * 5; tries++) {
        const p = samplePoint(rng, i, 0.1, 0.07);
        if (!p || !free(p[0], p[1], 0.125) || clear(p[0], p[1]) < 0.05) continue;
        addTree(p[0], p[1]);
        k++;
      }
      for (let k = Math.round(4 * detail); k > 0; k--) {
        const p = samplePoint(rng, i, 0.1, 0.05);
        if (p && clear(p[0], p[1]) > 0.03 && free(p[0], p[1], 0.03)) D('grass', p[0], 0, p[1], rng() * 6, randRange(rng, 0.9, 1.4), shade(tc(pick(rng, theme.grass)), 0.8));
      }
    } else if (terr === T.Village) {
      const n = randInt(rng, 1, 2);
      for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
        const p = samplePoint(rng, i, 0.15, 0.13);
        if (!p || !free(p[0], p[1], 0.27) || clear(p[0], p[1]) < 0.16) continue;
        addHouse(p[0], p[1], sectorAng, i);
        k++;
      }
      for (let k = Math.round(3 * detail); k > 0; k--) {
        const p = samplePoint(rng, i, 0.12, 0.05);
        if (p && free(p[0], p[1], 0.1) && clear(p[0], p[1]) > 0.03) D('grass', p[0], 0, p[1], rng() * 6, randRange(rng, 0.8, 1.2), tc(pick(rng, theme.grass)));
      }
    } else if (terr === T.Grass) {
      for (let k = grassN; k > 0; k--) {
        const p = samplePoint(rng, i, 0.08, 0.03);
        if (!p || clear(p[0], p[1]) < 0.02 || !free(p[0], p[1], 0.035)) continue;
        D('grass', p[0], 0, p[1], rng() * 6, randRange(rng, 0.8, 1.35), vary(rng, tc(pick(rng, theme.grass)), 0.08));
      }
      if (rng() < 0.45) {
        const p = samplePoint(rng, i, 0.15, 0.1);
        if (p && free(p[0], p[1], 0.08) && clear(p[0], p[1]) > 0.04) {
          D('bush', p[0], 0, p[1], rng() * 6, randRange(rng, 0.8, 1.4), vary(rng, tc(pick(rng, theme.bush))));
          taken.push(p);
        }
      }
      if (rng() < 0.45) {
        const p = samplePoint(rng, i, 0.15, 0.12);
        if (p && clear(p[0], p[1]) > 0.06 && free(p[0], p[1], 0.05)) {
          const c = tc(pick(rng, theme.flowers));
          for (let f = randInt(rng, 3, 6); f > 0; f--) D('flower', p[0] + (rng() - 0.5) * 0.14, 0, p[1] + (rng() - 0.5) * 0.14, 0, randRange(rng, 0.8, 1.2), c);
        }
      }
      if (rng() < 0.18) {
        const p = samplePoint(rng, i, 0.15, 0.1);
        if (p && free(p[0], p[1], 0.08) && clear(p[0], p[1]) > 0.04) D('rock', p[0], 0, p[1], rng() * 6, randRange(rng, 0.7, 1.5), vary(rng, tc(theme.rock)));
      }
      if (rng() < 0.12) {
        const p = samplePoint(rng, i, 0.18, 0.14);
        if (p && free(p[0], p[1], 0.1) && clear(p[0], p[1]) > 0.08) {
          for (let a = randInt(rng, 1, 2); a > 0; a--) D('animal', p[0] + (rng() - 0.5) * 0.06, 0, p[1] + (rng() - 0.5) * 0.06, rng() * 6, randRange(rng, 0.9, 1.1), vary(rng, tc(pick(rng, theme.animals.colors)), 0.05), 'wander');
        }
      }
    }
  }

  // Chão de mata sob cada árvore: terra escura que assenta a copa no chão (Dorfromantik).
  if (trees.length) {
    const floor = tc(theme.ground[T.Forest]).clone().lerp(tc(theme.trunk), 0.35).multiplyScalar(0.72);
    for (const [x, z, s] of trees) disc(g, x, z, 0.055 * s, 0.0025, floor, 7, [0, 1, 0, 0]);
  }

  // Centro: segue o terreno dominante, quando não há rio, estrada ou marco.
  if (clear(0, 0) > 0.08) {
    const count = new Map<T, number>();
    for (const e of edges) count.set(e, (count.get(e) ?? 0) + 1);
    const [top, n] = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n >= 3 && top === T.Forest && free(0, 0, 0.09)) addTree((rng() - 0.5) * 0.05, (rng() - 0.5) * 0.05);
    if (n >= 3 && top === T.Village && free(0, 0, 0.2)) addHouse(0, 0, rng() * 6);
  }

  // Praça de terra batida sob o Centro da vila.
  if (opts.center) {
    const vg = tc(theme.ground[T.Village]);
    disc(g, 0, 0, 0.29, 0.004, vg.clone().lerp(tc(theme.roadBed), 0.35).multiplyScalar(0.92), 18, [0, 0, 0, 1]);
  }

  // --- Vida na vila: pegada de terra batida sob as casas, trilhas até uma pracinha e,
  // nas vilas com 3 ou mais casas, um poço. Sem sorteio: sai das posições das casas.
  if (houses.length) {
    const vg = tc(theme.ground[T.Village]);
    const dirt = vg.clone().lerp(tc(theme.roadBed), 0.45).multiplyScalar(0.8);
    const trail = vg.clone().lerp(tc(theme.roadBed), 0.2).multiplyScalar(1.14);
    const VILLAGE: Splat = [0, 0, 0, 1];
    // Trechos contíguos de setores de vila (a casa do centro vai para o maior).
    const runs: number[][] = [];
    const start = edges.findIndex((e, i) => e === T.Village && edges[(i + 5) % 6] !== T.Village);
    if (start < 0) runs.push([0, 1, 2, 3, 4, 5]);
    else {
      for (let k = 0; k < 6; k++) {
        const i = (start + k) % 6;
        if (edges[i] !== T.Village) continue;
        if (edges[(i + 5) % 6] === T.Village && runs.length) runs[runs.length - 1].push(i);
        else runs.push([i]);
      }
    }
    runs.sort((a, b) => b.length - a.length);
    for (const run of runs) {
      const hs = houses.filter((h) => run.includes(h.sector) || (h.sector < 0 && run === runs[0]));
      for (const h of hs) disc(g, h.x, h.z, 0.075 * h.s, 0.004, dirt, 8, VILLAGE);
      if (hs.length < 2) continue;
      let px = hs.reduce((a, h) => a + h.x, 0) / hs.length, pz = hs.reduce((a, h) => a + h.z, 0) / hs.length;
      // A praça não pode cair dentro de uma casa: escorrega em direção ao centro da peça.
      for (let k = 0; k < 6 && hs.some((h) => Math.hypot(h.x - px, h.z - pz) < 0.1); k++) {
        px *= 0.82;
        pz *= 0.82;
      }
      for (const h of hs) {
        // Trilha com uma leve curva (para um lado ou outro, conforme a posição da casa).
        const mx = (h.x + px) / 2, mz = (h.z + pz) / 2;
        const dx = px - h.x, dz = pz - h.z, l = Math.hypot(dx, dz) || 1;
        const bend = Math.sin(h.x * 37.1 + h.z * 19.7) * 0.18 * l;
        strip(g, bezier([h.x, h.z], [mx - (dz / l) * bend, mz + (dx / l) * bend], [px, pz], 6), 0.024, 0.0045, trail, VILLAGE);
      }
      disc(g, px, pz, 0.065, 0.005, trail, 10, VILLAGE);
      if (hs.length >= 3 && free(px, pz, 0.05) && clear(px, pz) > 0.08) {
        D('well', px, 0, pz, Math.atan2(pz, px), 1, WHITE);
        taken.push([px, pz]);
      }
    }
  }

  // --- Paisagem trabalhada: jazidas (mina, quando a vila encosta nelas dentro da peça) e
  // arbustos de frutas no prado. Gerador à parte e por último, para não mexer no resto da peça.
  if (theme.ore || theme.berry) {
    const r2 = mulberry32((seed ^ 0x7e57a11) >>> 0);
    for (let i = 0; i < 6; i++) {
      if (edges[i] !== T.Grass) continue;
      const oreRoll = r2(), berryRoll = r2();
      const p = samplePoint(r2, i, 0.16, 0.12);
      if (theme.ore && oreRoll < theme.ore.chance && p && free(p[0], p[1], 0.1) && clear(p[0], p[1]) > 0.08) {
        const mine = edges[(i + 1) % 6] === T.Village || edges[(i + 5) % 6] === T.Village;
        D(mine ? 'mine' : 'ore', p[0], 0, p[1], r2() * Math.PI * 2, mine ? 1.5 : 1.3, tc(theme.ore.color));
        taken.push(p);
        continue;
      }
      const b = samplePoint(r2, i, 0.12, 0.08);
      if (theme.berry && berryRoll < BERRY_CHANCE && b && free(b[0], b[1], 0.07) && clear(b[0], b[1]) > 0.05) {
        D('berry', b[0], 0, b[1], r2() * Math.PI * 2, randRange(r2, 1.1, 1.5), tc(theme.berry));
        taken.push(b);
      }
    }
  }

  // Uma peça de vila em cada quatro tem um aldeão levando um saco da primeira casa ao meio da peça.
  const home = houses.find((h) => h.sector >= 0);
  if (home && (seed >>> 0) % 4 === 0) {
    const l = Math.hypot(home.x, home.z) || 1;
    const wx = home.x - (home.x / l) * 0.07, wz = home.z - (home.z / l) * 0.07;
    D('folk:sack', wx, 0, wz, yawTo(-home.x, -home.z), 1, shirt(6), 'carry');
  }

  return {
    pos: new Float32Array(g.pos),
    col: new Float32Array(g.col),
    splat: new Float32Array(g.spl),
    water: new Float32Array(wb?.pos ?? []),
    wflow: new Float32Array(wb?.flow ?? []),
    wbed: new Float32Array(wb?.bed ?? []),
    decos,
    chimneys,
  };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function decoMatrix(d: Deco, out = _m) {
  _q.setFromAxisAngle(_up, d.ry);
  return out.compose(_p.set(d.x, d.y, d.z), _q, _s.set(d.sx, d.sy, d.sz));
}
