import * as THREE from 'three/webgpu';
import { corner, edgeMid, INR } from '../core/hex';
import type { DayPhase, EggKit } from '../core/eggs';
import { mulberry32, pick, randInt, randRange, type Rng, weighted } from '../core/rng';
import { HILL, hillProfile, PEAK, PEAK_CONES, PEAK_REACH } from './relief';
import type { SynKind } from '../core/synergy';
import type { SiteKind } from '../core/sites';
import type { SpecialKind } from '../core/specials';
import { isStrict, T } from '../core/tiles';
import { gatesOf, type CropKind, type Theme } from '../themes/types';
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
export const ROAD_Y = { rail: 0.03, dirt: 0.006, stone: 0.008, sand: 0.006, maglev: 0.075, dike: 0.054, stepstone: 0.007 } as const;
/** Altura do topo do dique (`road: 'dike'`): aterro gramado com o caminho de tijolo por cima. */
const DIKE_H = 0.05;

/** spin: pás e rodas; wander: animais; chop/tend/carry: aldeões (golpe de machado, capina, vai e vem);
 * swim: peixe de cardume (gira em volta de um centro, com o raio em `orbit`); bob: barco ancorado. */
export type Anim = 'spin-z' | 'spin-x' | 'wander' | 'chop' | 'tend' | 'carry' | 'swim' | 'bob';

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
  /** Peixe: raio do círculo que ele nada (negativo = sentido horário). O centro fica à esquerda (ou à direita) da direção da peça. */
  orbit?: number;
  /** Só existe na peça viva (andaime de obra): o World não o grava nos blocos. */
  transient?: boolean;
  /** Bicho da fauna do tema: só aparece nesta fase do dia (`Theme.fauna[].time`). */
  when?: DayPhase;
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
  /** Easter eggs de kit desta peça (`Theme.eggs`, efeito 'kit'): decididos pelo jogo, pela partida, nunca pelo relógio. */
  eggs?: { id: string; kit: EggKit; scale?: number; color?: string }[];
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
/** Terraços (Theme.terraces): altura de cada patamar, altura do beiral sobre ele e o tamanho de cada patamar de cima em relação à parcela (2 e 3 patamares). */
const TERRACE_H = 0.012;
const TERRACE_LIP = 0.004;
const TERRACE_SCALE: readonly (readonly number[])[] = [[0.62], [0.76, 0.5]];
const SPLAT_WALL: Splat = [0, 0, 0.2, 0];
/**
 * Árvores do tamanho de uma casa (no máximo ~1,3× a altura dela), como na referência: a mata lê como
 * massa fechada de muitas copas pequenas, não como árvores soltas sobre grama, e a vila não some
 * atrás de uma copa. A leitura de longe vem da mancha escura da mata inteira (valor e quantidade),
 * não do tamanho de cada árvore. Os marcos seguem maiores que o natural (`LANDMARK_SCALE`).
 */
const TREE_SCALE = 0.85;
/** Mistura no `mulberry32(seed ^ …)` que sorteia as árvores das peças de mata, para o resto da peça não depender da quantidade delas. */
const FOREST_SEED = 0x5f0e5;
/** Mistura no gerador do relevo decorativo (`Theme.relief`): serra ou morro, posição, tamanho e o que sobe a encosta. */
const RELIEF_SEED = 0x3d9a1c7;
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

/** Ruído de valor em (x, z), determinístico pela semente (sem Math.random): 0..1, célula ~0,3. */
function bNoise(seed: number, x: number, z: number): number {
  const h = (ix: number, iz: number) => {
    let n = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const fx = Math.floor(x / 0.3), fz = Math.floor(z / 0.3);
  const u = x / 0.3 - fx, v = z / 0.3 - fz;
  const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = h(fx, fz) + (h(fx + 1, fz) - h(fx, fz)) * su;
  const b = h(fx, fz + 1) + (h(fx + 1, fz + 1) - h(fx, fz + 1)) * su;
  return a + (b - a) * sv;
}

/** Distância de (x, z) à aresta mais próxima do polígono. */
function polyEdgeDist(x: number, z: number, pts: V2[]) {
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    const dx = xj - xi, dz = zj - zi;
    const t = Math.max(0, Math.min(1, ((x - xi) * dx + (z - zi) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - xi - dx * t, z - zi - dz * t));
  }
  return best;
}

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

/**
 * Meandro: desloca o rio de lado por um ruído de baixa frequência (gerador à parte, derivado da
 * semente). O envelope sin² zera o deslocamento e a inclinação nas duas pontas, então a posição
 * do rio na borda não muda e a emenda com a peça vizinha continua casando. A amplitude é limitada
 * para o raio da curva ficar maior que a largura do rio (sem dobra nem estrangulamento).
 */
function meander(pts: V2[], seed: number): V2[] {
  const r = mulberry32(seed ^ 0x3ea4d);
  const n = pts.length - 1;
  const f1 = 0.9 + r() * 0.5, f2 = 1.8 + r() * 0.8;
  const p1 = r() * 6.3, p2 = r() * 6.3;
  const a1 = (0.15 + r() * 0.1) * (r() < 0.5 ? 1 : -1), a2 = 0.05 + r() * 0.04;
  const off = pts.map((_, k) => {
    const t = k / n;
    const env = Math.sin(Math.PI * t) ** 2;
    return env * (a1 * Math.sin(2 * Math.PI * f1 * t + p1) + a2 * Math.sin(2 * Math.PI * f2 * t + p2));
  });
  return pts.map(([x, z], k) => {
    const [ax, az] = pts[Math.max(0, k - 1)], [bx, bz] = pts[Math.min(n, k + 1)];
    const l = Math.hypot(bx - ax, bz - az) || 1;
    return [x - ((bz - az) / l) * off[k], z + ((bx - ax) / l) * off[k]] as V2;
  });
}

/** Caminhos da água: rio de 2 bordas em curva; lago, nascente e junção com raios até o meio. */
function waterPaths(shape: WaterShape, widths: readonly number[], seed: number): Path[] {
  const { idx, lake } = shape;
  const r = mulberry32(seed ^ 0x77a1);
  if (idx.length === 2 && !lake) {
    const [a, b] = idx;
    const pts = meander(bezier(edgeMid(a), [0, 0], edgeMid(b), 24), seed);
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
  // Enseadas e ilhota do lago: gerador à parte, que não mexe nas demais ondulações.
  const rl = mulberry32(seed ^ 0x6c4b7);
  const inlets: { a: number; w: number; k: number }[] = [];
  let islet: { x: number; z: number; r: number } | null = null;
  if (lake) {
    const nb = lake.r > 0.33 ? 1 + (rl() < 0.5 ? 1 : 0) : rl() < 0.6 ? 1 : 0;
    for (let k = 0; k < nb; k++) inlets.push({ a: rl() * 6.283, w: 0.3 + rl() * 0.2, k: 0.3 + rl() * 0.25 });
    // Só em lago grande, longe das bocas (que emendam com os vizinhos), e em 1 de cada 3.
    if (lake.r >= 0.38 && n >= 2 && rl() < 0.34) {
      const ia = rl() * 6.283, off = lake.r * (0.1 + rl() * 0.2);
      islet = { x: lake.x + Math.cos(ia) * off, z: lake.z + Math.sin(ia) * off, r: 0.13 + rl() * 0.05 };
    }
  }
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
      // Enseadas: uma ou duas línguas de água que avançam além do lóbulo, com a ponta arredondada.
      let bays = 0;
      for (const b of inlets) bays += b.k * Math.exp(-((Math.atan2(Math.sin(a - b.a), Math.cos(a - b.a)) / b.w) ** 2));
      d = Math.min(d, Math.hypot(x - lake.x, z - lake.z) - Math.min(lake.r * (lobes + bays), INR - 0.1));
      // Ilhota: terra firme dentro do lago, de contorno irregular.
      if (islet) {
        const ia = Math.atan2(z - islet.z, x - islet.x);
        d = Math.max(d, islet.r * (1 + 0.18 * Math.sin(3 * ia + o[2]) + 0.1 * Math.sin(2 * ia + o[3])) - Math.hypot(x - islet.x, z - islet.z));
      }
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

/** Ponto da margem mais perto de (x, z), descendo pela distância até a água, e a direção para dentro dela. */
function shoreFrom(field: { e: (x: number, z: number) => number }, x: number, z: number) {
  const h = 0.008;
  for (let k = 0; k < 24; k++) {
    const e = field.e(x, z);
    const gx = (field.e(x + h, z) - field.e(x - h, z)) / (2 * h), gz = (field.e(x, z + h) - field.e(x, z - h)) / (2 * h);
    const l = Math.hypot(gx, gz);
    if (l < 1e-4) return null;
    const nx = -gx / l, nz = -gz / l;
    if (Math.abs(e - 0.012) < 0.004) return { x, z, nx, nz };
    const step = Math.max(-0.05, Math.min(0.05, e - 0.012));
    x += nx * step;
    z += nz * step;
  }
  return null;
}

export function buildTile(edges: readonly T[], seed: number, theme: Theme, opts: BuildOpts): TileBuild {
  const rng = mulberry32(seed);
  const frng = mulberry32((seed ^ FOREST_SEED) >>> 0);
  const detail = opts.detail;
  const g = new Buf(true);
    const decos: Deco[] = [];
  const chimneys: number[] = [];
  // Cada peça desloca valor e matiz do prado pela semente (gerador à parte, para não mexer no resto da
  // peça): o prado grande ganha degraus de tom entre as peças, como no original.
  const tone = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const dL = (tone() - 0.5) * 0.12, dH = ((tone() - 0.5) * 16) / 360;
  const groundCols = edges.map((t) => {
    const c = tc(theme.ground[t]);
    if (t !== T.Grass) return c;
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return new THREE.Color().setHSL((hsl.h + dH + 1) % 1, hsl.s, Math.min(0.95, Math.max(0.05, hsl.l + dL)));
  });
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
      // Faixa de mistura larga (0,6 do arco) com o limite torcido por ruído da semente e da
      // posição: a fronteira entre terrenos vira lóbulos, não uma reta.
      const sAng = Math.max(0, Math.min(1, b / sum + (bNoise(seed ^ 0x3b0d, x, z) - 0.5) * 0.3)); // 0 no lado do canto i, 1 no lado do canto i+1
      const tA = 0.5 * (1 - smooth(0, 0.6, sAng)), tB = 0.5 * (1 - smooth(0, 0.6, 1 - sAng));
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
    // Camadas de baixo (solo e rocha): cores e fronteira sorteadas por um gerador derivado da semente
    // (não mexe no `rng` da peça). Onde o entorno é mar, a rocha é bem escura, como falésia na água.
    const rs = mulberry32(((seed ^ 0x51de7a1) + i * 977) >>> 0);
    const jit = (a: number) => 1 + (rs() - 0.5) * 2 * a;
    const soilC = midC.clone().lerp(sideDark, 0.55).multiplyScalar(jit(0.14));
    const rockBase = new THREE.Color(0.16, 0.15, 0.15).lerp(sideDark, theme.surround === 'mar' ? 0.15 : 0.35);
    const rockTop = rockBase.clone().multiplyScalar(jit(0.2));
    const rockBot = rockTop.clone().multiplyScalar(0.7);
    const rockY: number[] = [];
    for (let k = 0; k <= N; k++) rockY.push(-0.16 - rs() * 0.05);
    for (let k = 0; k < N; k++) {
      const v0 = V(N - k, k), v1 = V(N - k - 1, k + 1);
      const [x0, y0, z0] = v0.p, [x1, y1, z1] = v1.p;
      const l0 = shade(v0.c, 0.72), l1 = shade(v1.c, 0.72);
      const b0 = Math.min(y0 - 0.05, -0.05), b1 = Math.min(y1 - 0.05, -0.05);
      g.quad([x0, y0, z0], [x1, y1, z1], [x1, b1, z1], [x0, b0, z0], l0, l1, l1, l0, nrm);
      g.quad([x0, b0, z0], [x1, b1, z1], [x1, -0.11, z1], [x0, -0.11, z0], side, side, midC, midC, nrm);
      const r0 = rockY[k], r1 = rockY[k + 1];
      g.quad([x0, -0.11, z0], [x1, -0.11, z1], [x1, r1, z1], [x0, r0, z0], midC, midC, soilC, soilC, nrm);
      g.quad([x0, r0, z0], [x1, r1, z1], [x1, -TILE_T, z1], [x0, -TILE_T, z0], rockTop, rockTop, rockBot, rockBot, nrm);
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
    const sr = mulberry32((seed ^ 0x57e95) >>> 0);
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
      } else if (theme.road === 'stepstone') {
        // Caminho de posta: terra batida com lajes de passo (tobiishi) alternadas de um lado e do outro do eixo, cada uma
        // um pouco torta, e tufos de capim na beira. Sem sulcos paralelos nem fileiras de dormentes (não lê como trilho).
        // Gerador à parte: o resto da peça não depende dele.
        alongPath(p.pts, 0.032, 0.066, (cx, cz, tx, tz, k) => {
          const o = (k % 2 ? 0.017 : -0.017) + (sr() - 0.5) * 0.012;
          const sk = (sr() - 0.5) * 0.02, hl = 0.021 + sr() * 0.008;
          const x = cx - tz * o, z = cz + tx * o;
          const c = bed.clone().lerp(det, 0.45 + sr() * 0.5);
          beam(g, [x - tx * hl - tz * sk, z - tz * hl + tx * sk], [x + tx * hl + tz * sk, z + tz * hl - tx * sk], 0.019 + sr() * 0.006, BED_Y, BED_Y + 0.005 + sr() * 0.002, c, shade(c, 0.72));
        });
        alongPath(p.pts, 0.05, 0.11, (cx, cz, tx, tz, k) => {
          const side = k % 2 ? 1 : -1, o = side * (p.hw * 0.92 + sr() * 0.012);
          D('grass', cx - tz * o, 0, cz + tx * o, sr() * 6, randRange(sr, 0.8, 1.2), shade(tc(pick(sr, theme.grass)), 0.85));
        });
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
      } else if (theme.road === 'dike') {
        // Dique: aterro gramado em dois degraus (talude), caminho de tijolo no topo e estacas na base. A seção é a mesma
        // em toda borda de via, então a emenda com a vizinha casa; o miolo da junção ganha um montículo.
        const gr = tc(theme.ground[0]);
        const slope = gr.clone().multiplyScalar(1.12), foot = gr.clone().multiplyScalar(0.7);
        for (let k = 0; k < p.pts.length - 1; k++) {
          beam(g, p.pts[k], p.pts[k + 1], p.hw * 2.3, 0, DIKE_H * 0.45, slope, foot);
          beam(g, p.pts[k], p.pts[k + 1], p.hw * 1.75, DIKE_H * 0.45, DIKE_H, slope, shade(gr, 0.84));
        }
        const side = (pts: V2[], off: number) =>
          pts.map((q, k) => {
            const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
            const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            return [q[0] - ((b[1] - a[1]) / l) * off, q[1] + ((b[0] - a[0]) / l) * off] as V2;
          });
        // Caminho de tijolo com meio-fio claro nos dois lados e juntas de argamassa a cada passo (retângulos chatos, sem sorteio).
        strip(g, p.pts, p.hw * 1.0, DIKE_H + 0.0005, bed);
        for (const off of [-1.0, 1.0]) strip(g, side(p.pts, p.hw * off), 0.011, DIKE_H + 0.0012, shade(tc(theme.roadBed), 1.25));
        alongPath(p.pts, 0.03, 0.07, (cx, cz, tx, tz) => {
          const hw = p.hw * 0.9, d = 0.0035;
          g.quad([cx - tz * hw - tx * d, DIKE_H + 0.0009, cz + tx * hw - tz * d], [cx - tz * hw + tx * d, DIKE_H + 0.0009, cz + tx * hw + tz * d], [cx + tz * hw + tx * d, DIKE_H + 0.0009, cz - tx * hw + tz * d], [cx + tz * hw - tx * d, DIKE_H + 0.0009, cz - tx * hw - tz * d], det, det, det, det, UP);
        });
        // Estacas de madeira ao pé do talude, nos dois lados.
        alongPath(p.pts, 0.1, 0.26, (cx, cz, tx, tz, k) => {
          for (const sg of [1, -1]) {
            const x = cx - tz * p.hw * 2.45 * sg, z = cz + tx * p.hw * 2.45 * sg;
            beam(g, [x - tx * 0.003, z - tz * 0.003], [x + tx * 0.003, z + tz * 0.003], 0.0035, 0, 0.02 + ((k + (sg > 0 ? 1 : 0)) % 3) * 0.004, tc(theme.sleeper), shade(tc(theme.sleeper), 0.7));
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
      if (theme.roadLamps) {
        alongPath(p.pts, 0.2, 0.32, (cx, cz, tx, tz) => {
          D('lantern', cx - tz * (p.hw + 0.05), 0, cz + tx * (p.hw + 0.05), yawTo(tx, tz), 1, WHITE);
        });
      }
    }
    // Junção: pátio de cascalho cobrindo o miolo do triângulo de curvas.
    if (road.idx.length !== 2) {
      if (theme.road === 'dike') {
        // Montículo do dique na junção ou no fim da linha: um tronco de cone baixo, com a pracinha de tijolo no topo.
        const gr = tc(theme.ground[0]);
        const r0 = road.idx.length > 2 ? 0.34 : ROAD_HW * 2.3, seg = 16;
        disc(g, 0, 0, r0 * 0.78, DIKE_H, gr.clone().multiplyScalar(1.02), seg);
        for (let k = 0; k < seg; k++) {
          const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
          const p0: V2 = [Math.cos(a0) * r0 * 0.78, Math.sin(a0) * r0 * 0.78], p1: V2 = [Math.cos(a1) * r0 * 0.78, Math.sin(a1) * r0 * 0.78];
          const q0: V3 = [Math.cos(a0) * r0, 0, Math.sin(a0) * r0], q1: V3 = [Math.cos(a1) * r0, 0, Math.sin(a1) * r0];
          const nrm: V3 = [Math.cos((a0 + a1) / 2), 0.7, Math.sin((a0 + a1) / 2)];
          g.quad([p0[0], DIKE_H, p0[1]], [p1[0], DIKE_H, p1[1]], q1, q0, gr, gr, shade(gr, 0.78), shade(gr, 0.78), nrm);
        }
        disc(g, 0, 0, r0 * 0.5, DIKE_H + 0.0006, bed, 12);
      } else disc(g, 0, 0, road.idx.length > 2 ? 0.3 : ROAD_HW * 1.05, BED_Y + 0.001, bed, road.idx.length > 2 ? 18 : 12);
    }
    if (road.idx.length === 1) {
      // Estação (ou pousada) no fim da linha.
      const [mx, mz] = edgeMid(road.idx[0]);
      const ux = mx / INR, uz = mz / INR;
      const sx = ux * 0.3 - uz * 0.16, sz = uz * 0.3 + ux * 0.16;
      D('station', sx, BED_Y, sz, yawTo(ux, uz), 1, WHITE);
      reserved.push([sx, sz, 0.15]);
    }
    // Portal sobre a via, na primeira borda de linha que encosta num setor de vila.
    const gates = gatesOf(theme);
    const gi = gates.length ? road.idx.find((i) => edges[(i + 1) % 6] === T.Village || edges[(i + 5) % 6] === T.Village) : undefined;
    if (gi !== undefined) {
      const [mx, mz] = edgeMid(gi);
      const n = nearestOnPaths(mx * 0.7, mz * 0.7, road.paths);
      // Vários estilos: a semente da peça escolhe (gerador à parte; com um só, nada é sorteado).
      const gk = gates.length > 1 ? Math.floor(mulberry32((seed ^ 0x6a7e5) >>> 0)() * gates.length) : 0;
      D(`gate:${gk}`, n.p[0], BED_Y, n.p[1], yawTo(-n.t[1], n.t[0]), 1, WHITE);
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
      const sc = (theme.mill === 'windmill' ? 1.1 : theme.mill === 'windpump' ? 1 : theme.mill === 'engenho' ? 1.55 : 1.2) * LANDMARK_SCALE;
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
    // Fogueira ao lado da construção: o material só acende à noite.
    D('fire', x - mz * 0.1, 0, z + mx * 0.1, ry, 0.5, WHITE);
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
      D('fire', x + Math.sin(ry) * 0.22 * sc, 0.006, z + Math.cos(ry) * 0.22 * sc, ry, 0.4, WHITE);
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
  let shaduf = !!opts.special;
  for (let i = 0; i < 6; i++) {
    for (const j of [(i + 1) % 6, (i + 5) % 6]) {
      const shared = j === (i + 1) % 6 ? (i + 1) % 6 : i; // canto comum aos dois setores
      const [cx, cz] = corner(shared);
      const tx0 = cx * 0.46, tz0 = cz * 0.46;
      if (edges[i] === T.Field && edges[j] === T.Water) {
        lush.add(i);
        // Shaduf (Theme.irrigation): poste e braço na margem, com o balde sobre a água (só visual).
        if (theme.irrigation && !shaduf && field && water.paths.length) {
          const s = shoreFrom(field, tx0, tz0);
          if (s && Math.hypot(s.x, s.z) < INR - 0.12 && free(s.x, s.z, 0.1)) {
            shaduf = true;
            const px = s.x - s.nx * 0.03, pz = s.z - s.nz * 0.03;
            D('shaduf', px, 0, pz, yawTo(s.nx, s.nz), 1, WHITE);
            reserved.push([px, pz, 0.09]);
          }
        }
      }
      const lakeTile = !!shape.lake && water.idx.length >= 2;
      // Vila na beira d'água: no lago, e em metade das peças de rio (pela semente, sem sorteio),
      // nasce o cais de pescador em vez da roda d'água.
      if (edges[i] === T.Village && edges[j] === T.Water && !watermill && field && (lakeTile || ((seed >>> 7) & 1) === 1)) {
        const s = shoreFrom(field, tx0, tz0);
        if (!s || field.e(s.x + s.nx * 0.16, s.z + s.nz * 0.16) > -0.02 || Math.hypot(s.x, s.z) > INR - 0.1) continue;
        watermill = true;
        const ry = yawTo(s.nx, s.nz);
        D('pier', s.x, 0, s.z, ry, 1.25, WHITE);
        // O barco encosta ao lado da ponta do cais, paralelo a ele.
        const bx = s.x + s.nx * 0.11 - s.nz * 0.07, bz = s.z + s.nz * 0.11 + s.nx * 0.07;
        if (field.e(bx, bz) < -0.03) D('moored', bx, WATER_Y, bz, ry, 0.85, WHITE, 'bob');
        const hx = s.x - s.nx * 0.17, hz = s.z - s.nz * 0.17;
        D('wall:0', hx, 0, hz, ry, 1.1, WHITE.clone().multiply(tc(theme.houses[0].walls[0])));
        D('roof:0', hx, 0, hz, ry, 1.1, tc(theme.houses[0].roofs[0]).clone());
        reserved.push([s.x, s.z, 0.12], [hx, hz, 0.13], [bx, bz, 0.08]);
      } else if (edges[i] === T.Village && edges[j] === T.Water && !watermill && water.paths.length && !lakeTile) {
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
  if (theme.bridge && water.idx.length === 2 && !shape.lake && (water.paths[0].hws?.[water.paths[0].pts.length >> 1] ?? RIVER_HW) <= 0.215) {
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
    D('fire', Math.sin(ry) * 0.2 * sc, 0, Math.cos(ry) * 0.2 * sc, ry, 0.38, WHITE);
    if (theme.landmark === 'windmill') {
      const fx = Math.sin(ry) * 0.078 * sc, fz = Math.cos(ry) * 0.078 * sc;
      D('sails', fx, 0.255 * sc, fz, ry, sc, WHITE, 'spin-z');
    }
    reserved.push([0, 0, (WIDE_LANDMARKS.has(theme.landmark) ? 0.3 : 0.2) * sc]);
  }

  // --- Plantações: parcelas de terra com fileiras de plantas.
  const cropKinds = theme.crops.map((c) => [c, c.weight] as const);
  // Cultura e parcelas de cada borda de plantação, para a aba da emenda (mais abaixo).
  const abaCrops: (CropKind | null)[] = [null, null, null, null, null, null];
  const abaPlots: V2[][][] = [[], [], [], [], [], []];
  for (let i = 0; i < 6; i++) {
    if (edges[i] !== T.Field) continue;
    const crop: CropKind = weighted(rng, cropKinds);
    abaCrops[i] = crop;
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
      const tintAmt = crop.style === 'rice' ? 0.2 : crop.style === 'tulip' || crop.style === 'bulb' ? 0.1 : 0.42;
      const sc = vary(rng, soil.clone().lerp(tc(crop.colors[0]), tintAmt), 0.08);
      // Sem parede lateral: o leque tem dois anéis, o interno na cor da terra e o externo
      // (bisel de ~0,04, altura 0) misturado ao chão, para a parcela se fundir ao prado.
      const gc = groundCols[i];
      const edge = sc.clone().lerp(gc, 0.6);
      const clampIn = (x: number, z: number): V2 => {
        for (let e = 0; e < 6; e++) {
          const [mx, mz] = edgeMid(e);
          const proj = (x * mx + z * mz) / INR;
          const lim = INR - 0.02;
          if (proj > lim) {
            x -= (mx / INR) * (proj - lim);
            z -= (mz / INR) * (proj - lim);
          }
        }
        return [x, z];
      };
      abaPlots[i].push(pts);
      const outer = pts.map(([x, z]) => clampIn(cx + (x - cx) * 1.2, cz + (z - cz) * 1.2));
      const spIn: Splat = [0, 0, 0.6, 0], spOut: Splat = [0, 0, 0.25, 0];
      for (let j = 0; j < sides; j++) {
        const j2 = (j + 1) % sides;
        const a = pts[j], b = pts[j2], ao = outer[j], bo = outer[j2];
        g.tri([cx, h, cz], [a[0], h, a[1]], [b[0], h, b[1]], sc, sc, sc, UP, spIn);
        g.tri([a[0], h, a[1]], [ao[0], 0.001, ao[1]], [bo[0], 0.001, bo[1]], sc, edge, edge, UP, spIn, spOut, spOut);
        g.tri([a[0], h, a[1]], [bo[0], 0.001, bo[1]], [b[0], h, b[1]], sc, edge, sc, UP, spIn, spOut, spIn);
      }
      // Terraços (Theme.terraces): patamares concêntricos sobre a parcela, cada um um pouco mais alto e menor,
      // com um riser de muro (mureta de pedra) e um beiral de 4 mm que guarda a água do arrozal. Só a geometria
      // do chão muda: a borda externa da parcela continua na altura 0 e o rng da peça não gasta nada.
      const terr = theme.terraces && (!theme.terraces.styles || theme.terraces.styles.includes(crop.style)) ? Math.max(1, Math.min(3, Math.round(theme.terraces.levels))) : 1;
      // `rise` (Theme.terraces.rise) multiplica a altura do patamar e do beiral (1 = 12 mm por degrau).
      const tH = TERRACE_H * (theme.terraces?.rise ?? 1), tLip = TERRACE_LIP * (theme.terraces?.rise ?? 1);
      const rings: V2[][] = [pts];
      if (terr > 1) {
        const wall = shade(tc(theme.rock).clone().lerp(sc, 0.3), 0.82);
        for (let j = 1; j < terr; j++) {
          const f = TERRACE_SCALE[terr - 2][j - 1];
          const poly = pts.map(([x, z]) => [cx + (x - cx) * f, cz + (z - cz) * f] as V2);
          rings.push(poly);
          const yLow = h + (j - 1) * tH, yHigh = h + j * tH;
          const tread = shade(sc, 1 + 0.05 * j);
          for (let t = 0; t < sides; t++) {
            const a = poly[t], b = poly[(t + 1) % sides];
            g.tri([cx, yHigh, cz], [a[0], yHigh, a[1]], [b[0], yHigh, b[1]], tread, tread, tread, UP, spIn);
            // Riser: do patamar de baixo até o beiral, de frente para fora.
            const mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz;
            g.quad([a[0], yLow, a[1]], [b[0], yLow, b[1]], [b[0], yHigh + tLip, b[1]], [a[0], yHigh + tLip, a[1]], shade(wall, 0.85), shade(wall, 0.85), wall, wall, [mx, 0, mz], SPLAT_WALL);
            // Beiral: faixa fina no alto do muro.
            const ai: V2 = [cx + (a[0] - cx) * 0.93, cz + (a[1] - cz) * 0.93], bi: V2 = [cx + (b[0] - cx) * 0.93, cz + (b[1] - cz) * 0.93];
            g.quad([a[0], yHigh + tLip, a[1]], [b[0], yHigh + tLip, b[1]], [bi[0], yHigh + tLip, bi[1]], [ai[0], yHigh + tLip, ai[1]], wall, wall, wall, wall, UP, SPLAT_WALL);
          }
        }
      }
      const levelAt = (x: number, z: number) => {
        let lv = 0;
        for (let j = 1; j < rings.length; j++) if (insidePoly(x, z, rings[j])) lv = j;
        return lv;
      };
      // Fileiras: direção aleatória por parcela; densidade cai com a qualidade.
      const inner = pts; // 100% do polígono: a escala e o descarte nas plantas fazem o recuo
      const old = pts.map(([x, z]) => [cx + (x - cx) * 0.86, cz + (z - cz) * 0.86] as V2);
      // Geradores derivados (descarte e plantas da faixa nova): o rng da peça não muda com eles.
      const pr = mulberry32((seed ^ 0x5ca1ed) + i * 131 + k * 17);
      const fr = mulberry32((seed ^ 0x7d15c4) + i * 131 + k * 17);
      const dens = 1 / Math.sqrt(Math.max(0.3, detail));
      const gap = L.rowGap * dens, step = L.step * dens;
      const dir = rng() * Math.PI;
      const ux = Math.cos(dir), uz = Math.sin(dir);
      const base = tc(pick(rng, crop.colors));
      // Canais de irrigação (Theme.irrigation): um canal reto no sentido das fileiras e, às vezes, outro cruzado,
      // cortando a parcela de lado a lado (a corda do polígono). Gerador à parte: o rng da peça não gasta nada.
      const canals: [V2, V2][] = [];
      if (theme.irrigation) {
        const cr = mulberry32((seed ^ 0xca4a1) + i * 131 + k * 17);
        const chord = (ox: number, oz: number, dx: number, dz: number) => {
          let a: V2 | null = null, b: V2 | null = null;
          for (let t = -rad * 1.5; t <= rad * 1.5; t += 0.008) {
            const x = ox + dx * t, z = oz + dz * t;
            if (!insidePoly(x, z, pts)) continue;
            if (!a) a = [x, z];
            b = [x, z];
          }
          if (a && b && Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.12) canals.push([a, b]);
        };
        const off = (cr() - 0.5) * 0.5 * rad;
        chord(cx - uz * off, cz + ux * off, ux, uz);
        if (cr() < theme.irrigation.cross) chord(cx + ux * (cr() - 0.5) * 0.6 * rad, cz + uz * (cr() - 0.5) * 0.6 * rad, -uz, ux);
        const water = tc(theme.irrigation.color), rim = shade(sc, 0.7);
        for (const [a, b] of canals) {
          strip(g, [a, b], 0.0165, h + 0.0004, rim, spIn);
          strip(g, [a, b], 0.0105, h + 0.0009, water);
        }
      }
      const nearCanal = (x: number, z: number) => canals.some(([a, b]) => {
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 0.024;
      });
      let row = 0;
      for (let o = -rad; o <= rad; o += gap, row++) {
        const rowCol = L.rowColor ? tc(crop.colors[(row + k) % crop.colors.length]) : null;
        for (let t = -rad + ((row % 2) * step) / 2; t <= rad; t += step) {
          const x = cx + ux * t - uz * o + (rng() - 0.5) * step * 0.25;
          const z = cz + uz * t + ux * o + (rng() - 0.5) * step * 0.25;
          if (!insidePoly(x, z, inner) || !free(x, z, 0)) continue; // não planta dentro de construções
          if (canals.length && nearCanal(x, z)) continue; // as plantas abrem espaço para o canal
          // Dentro do polígono antigo (86%) os sorteios saem do rng da peça, na mesma ordem de
          // antes: cultura e cor das parcelas não mudam. Só a faixa nova de borda usa o derivado.
          const hedge = crop.style === 'tea' || crop.style === 'vineyard' || crop.style === 'lavender';
          const R = insidePoly(x, z, old) ? rng : pr;
          // Perto da borda da parcela as plantas diminuem e rareiam (degradê até o prado).
          const edgeT = smooth(0, 0.08, polyEdgeDist(x, z, pts));
          const s0 = randRange(R, L.scale[0], L.scale[1]);
          let c = rowCol ?? (R() < 0.7 ? base : tc(pick(R, crop.colors)));
          c = vary(R, c, 0.06);
          const yaw = hedge ? yawTo(ux, uz) : R() * Math.PI * 2;
          if (fr() < (1 - edgeT) * 0.55) continue;
          if (L.sparse !== undefined && fr() > L.sparse) continue;
          const s = s0 * (isLush ? 1.12 : 1) * (0.45 + 0.55 * edgeT);
          if (isLush && !rowCol) c = c.lerp(LUSH, 0.22);
          D(`crop:${crop.style}`, x, h + levelAt(x, z) * tH, z, yaw, s, c);
        }
      }
      // Lago congelado: um pesqueiro (tenda, buraco, varal) perto do meio de algumas parcelas, por um gerador à parte.
      if (crop.style === 'icefield') {
        const cr = mulberry32((seed ^ 0x1ce5a1) + i * 131 + k * 17);
        const roll = cr(), ox = (cr() - 0.5) * rad * 0.7, oz = (cr() - 0.5) * rad * 0.7, yaw = cr() * Math.PI * 2;
        const walls = theme.houses[0].walls, tent = tc(walls[Math.floor(cr() * walls.length)]);
        const x = cx + ox, z = cz + oz;
        if (roll < (k === 1 ? 0.55 : 0.16) && rad > 0.17 && insidePoly(x, z, old) && free(x, z, 0.1) && clear(x, z) > 0.12) {
          D('icecamp', x, h, z, yaw, 1, tent);
          reserved.push([x, z, 0.1]);
        }
      }
    }
  }

  // --- Relevo decorativo (Theme.relief): uma serra ou um morro na peça, por um gerador à parte (semente da
  // peça). Entra antes das árvores e das casas, que desviam dele (reserved). Só ocupa setores de prado, mata,
  // rio ou trilho (vila e lavoura ficam livres, com as casas e as parcelas de sempre), e a pegada inteira
  // tem de caber neles; fica de fora a peça com marco, sítio ou construção especial. Rio e trilho: clear().
  interface Relief { kind: 'peak' | 'hill'; x: number; z: number; ry: number; sx: number; sy: number; sz: number; reach: number }
  let relief: Relief | null = null;
  const rel = theme.relief;
  const lr = mulberry32((seed ^ RELIEF_SEED) >>> 0);
  const roomy = (i: number) => edges[i] === T.Grass || edges[i] === T.Forest || edges[i] === T.Water || edges[i] === T.Rail;
  const sectorAt = (x: number, z: number) => {
    let best = 0, bd = -Infinity;
    for (let i = 0; i < 6; i++) {
      const [mx, mz] = edgeMid(i);
      if (x * mx + z * mz > bd) (bd = x * mx + z * mz), (best = i);
    }
    return best;
  };
  const sectors = [0, 1, 2, 3, 4, 5].filter(roomy);
  // Falésia (estilo 'falesia'): arenito longe do rio, então a peça com água fica sem ela.
  if (rel && rel.amp > 0 && sectors.length && !(rel.style === 'falesia' && hasWater) && !opts.center && !opts.special && !opts.wonder && !opts.site && opts.eraMark === undefined) {
    const roll = lr(), kindRoll = lr();
    if (roll < Math.min(0.9, rel.amp * 0.6)) {
      // Falésia: só mesas (sem outeiros), para não somar um pool de decoração a mais.
      const kind = rel.style === 'falesia' || (rel.style === 'serra' && kindRoll < 0.55) ? 'peak' : 'hill';
      const s0 = randRange(lr, 0.85, 1.3);
      const kx = randRange(lr, 0.88, 1.18), kz = randRange(lr, 0.88, 1.18);
      const ky = randRange(lr, 0.85, 1.3), kh = randRange(lr, 0.8, 1.5), ry = lr() * Math.PI * 2;
      // Se a peça não comporta o tamanho sorteado, tenta de novo menor (a pegada tem de caber nos setores livres).
      for (const f of [1, 0.78, 0.6]) {
        if (relief) break;
        const s = s0 * f;
        // 'dique': o morro vira um aterro baixo e comprido (diques de pôlder), sem serras.
        const dike = rel.style === 'dique';
        // `Theme.relief.tall` (serras de tinta): mais altas e mais estreitas, sem aumentar a pegada.
        const tall = kind === 'peak' ? rel.tall ?? 1 : 1;
        const sx = (s * kx * (dike ? 1.3 : 1)) / Math.sqrt(tall), sz = (s * kz * (dike ? 0.3 : 1)) / Math.sqrt(tall);
        // Altura total até ~0,85 (a câmera baixa não esconde mais que uma casa atrás).
        const sy = kind === 'peak' ? Math.max(0.75, Math.min(1.05, s * ky * 0.95)) * tall : kh * (0.6 + 0.4 * f) * (dike ? 0.2 : 1);
        const reach = kind === 'peak' ? PEAK_REACH * PEAK.r * Math.max(sx, sz) : HILL.r * 1.07 * Math.max(sx, sz);
        const maxD = Math.max(0.02, 0.8 - reach);
        for (let t = 0; t < 6 && !relief; t++) {
          // Perto do centro da peça (a distância pesa para o meio), na direção de um setor livre.
          const sec = sectors[Math.floor(lr() * sectors.length)];
          const a = Math.PI / 6 + (Math.PI / 3) * sec + (lr() - 0.5) * 1.0, d = maxD * lr() ** 1.5;
          const x = Math.cos(a) * d, z = Math.sin(a) * d;
          if (!free(x, z, 0.1) || clear(x, z) <= reach * (kind === 'peak' ? 0.6 : 0.45)) continue;
          let fits = true;
          for (let k = 0; k < 6 && fits; k++) fits = roomy(sectorAt(x + Math.cos(k * 1.047) * reach * 0.75, z + Math.sin(k * 1.047) * reach * 0.75));
          if (fits) relief = { kind, x, z, ry, sx, sy, sz, reach };
        }
      }
      if (relief) {
        const { x, z, ry, sx, sy, sz, reach } = relief;
        if (kind === 'peak') {
          D('peak', x, 0, z, ry, [sx, sy, sz], vary(lr, tc(rel.rock ?? theme.rock), 0.08));
          reserved.push([x, z, reach * 0.85]);
        } else {
          const gi = [sectorAt(x, z), 0, 1, 2, 3, 4, 5].find((i) => edges[i] === T.Grass || edges[i] === T.Forest) ?? 0;
          // Falésia: o morro é de arenito, da cor da rocha (um outeiro de pedra e areia, não de capim).
          D('hill', x, 0, z, ry, [sx, sy, sz], vary(lr, rel.style === 'falesia' ? tc(rel.rock ?? theme.rock).clone().lerp(groundCols[gi], 0.35) : groundCols[gi], 0.05));
          reserved.push([x, z, reach * 0.55]);
        }
        taken.push([x, z]);
      }
    }
  }

  // --- Árvores, casas, capim, animais.
  const forestKinds = theme.forest.map((k) => [k, k.weight] as const);
  // Clareira da serraria: as árvores perto dela viram tocos (sem sorteio a mais, para o resto
  // da peça sair igual).
  const clearings = (opts.synergies ?? []).filter((h) => h.kind === 'lumber').map((h) => edgeMid(h.sector));
  const addTree = (x: number, z: number, r: Rng = rng, small = 1, only?: (typeof forestKinds)[number][0]) => {
    const kind = only ?? weighted(r, forestKinds);
    const s = randRange(r, 0.85, 1.25) * TREE_SCALE * small * (kind.geo === 'crystal' ? 1.4 : kind.geo === 'cactus' ? 1.1 : 1);
    const ry = r() * Math.PI * 2;
    const sy = s * randRange(r, 0.9, 1.15);
    const color = vary(r, tc(pick(r, kind.colors)), 0.1);
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
  const houses: { x: number; z: number; s: number; sector: number; door?: V2 }[] = [];
  // Cor por casa, com viés: ~60% das casas usam a cor de telhado da peça (uma por tipo de casa) e o resto
  // sorteia da paleta do tipo, para a vila ler como confete de telhados e de paredes claras e escuras.
  // O sorteio extra vem de um gerador à parte (consome sempre o mesmo tanto), então o resto da peça
  // não muda; as chamadas ao `rng` abaixo seguem a ordem antiga.
  const crng = mulberry32((seed ^ 0x5c0105) >>> 0);
  // Proporção por casa (largura e profundidade 0,8 a 1,3): também de um gerador à parte, para a
  // peça não mudar em mais nada. Parede e telhado recebem a mesma tripla de escala.
  const prng = mulberry32((seed ^ 0x27d0a5) >>> 0);
  const tileRoof = new Map<number, string>();
  // D29: sorteios novos (giro das casas, lotes extras, anexos) saem de geradores à parte, para o
  // resto da peça sair igual ao que já era.
  const rv = mulberry32((seed ^ 0xd29d29) >>> 0);
  const r4 = mulberry32((seed ^ 0x0d29a77) >>> 0);
  // Raio aproximado da casa no chão, para os lotes não se tocarem.
  const houseR = (s: number) => 0.085 * s;
  // Sobrados (a torre estreita e o sobrado largo) ficam só nos lotes grandes, não nos pequenos nem nos galpões.
  const isTower = (b: string) => b === 'tall' || b === 'sobrado';
  const addHouse = (x: number, z: number, baseAng: number, sector = -1, door?: V2, small?: [number, number]) => {
    const R = small ? r4 : rng;
    const i = small ? weighted(R, houseKinds.filter(([k]) => !isTower(theme.houses[k].body)).length ? houseKinds.filter(([k]) => !isTower(theme.houses[k].body)) : houseKinds) : weighted(R, houseKinds);
    const kind = theme.houses[i];
    const meta = opts.houses[i];
    // Uma casa dominante grande de cumeeira paralela à rua (de longe ela se lê sozinha) e, ao redor,
    // casas médias e pequenas nos lotes extras. Escala anisotrópica (kx, kz) do D27 por cima da escala do lote.
    const s = small ? randRange(R, small[0], small[1]) * (kind.body === 'long' ? 0.85 : 1) : randRange(R, 1.65, 1.95) * (kind.body === 'long' ? 0.9 : 1);
    const sy = randRange(R, 0.92, 1.12);
    let ry = sector >= 0 ? baseAng + (R() - 0.5) * 0.08 : baseAng + (R() < 0.5 ? 0 : Math.PI / 2) + (R() - 0.5) * 0.12;
    // 25% das casas de vila giram (um quarto delas 90°, o resto ±20°) para quebrar a grade de cumeeiras.
    if (sector >= 0) {
      const q = rv(), sg = rv() < 0.5 ? -1 : 1;
      if (q < 0.1) ry += Math.PI / 2;
      else if (q < 0.25) ry += sg * 0.35;
    }
    const kx = randRange(prng, 0.8, kind.body === 'long' ? 1.1 : 1.3), kz = randRange(prng, 0.8, 1.3);
    const sc: [number, number, number] = [s * kx, s * sy, s * kz];
    D(`wall:${i}`, x, 0, z, ry, sc, vary(R, tc(pick(R, kind.walls)), 0.08));
    let roof = tileRoof.get(i);
    if (roof === undefined) tileRoof.set(i, (roof = pick(R, kind.roofs)));
    else if (R() < 0.2) roof = pick(R, kind.roofs);
    const own = pick(crng, kind.roofs);
    if (crng() >= 0.6) roof = own;
    D(`roof:${i}`, x, 0, z, ry, sc, vary(R, tc(roof), 0.06));
    if (meta?.chimney && R() < 0.85) {
      const [cx, cy, cz] = meta.chimney;
      const c = Math.cos(ry), sn = Math.sin(ry);
      chimneys.push(x + (cx * kx * c + cz * kz * sn) * s, cy * s * sy, z + (-cx * kx * sn + cz * kz * c) * s, i);
    }
    taken.push([x, z]);
    houses.push({ x, z, s: s * Math.max(kx, kz), sector, door });
    return i;
  };

  const grassN = Math.round(randInt(rng, 9, 15) * detail);
  for (let i = 0; i < 6; i++) {
    const terr = edges[i];
    const sectorAng = -(Math.PI / 6 + (Math.PI / 3) * i);
    if (terr === T.Forest) {
      // Mata em massa: muitas copas pequenas, 2 a 3× o número antigo, num gerador derivado (o resto da peça não muda com a contagem).
      // Cada árvore é a melhor de alguns candidatos (a mais longe das vizinhas): sem buracos nem grumos.
      // Franja: perto de um setor vizinho que não é mata, as árvores ficam menores e mais ralas, com arbusto no meio.
      const n = Math.max(5, Math.round(randInt(frng, theme.treesPerSector[0], theme.treesPerSector[1]) * 1.75));  // o antigo era ×0,7: aqui ≈2,5× a contagem de antes
      const [cax, caz] = corner(i), [cbx, cbz] = corner((i + 1) % 6);
      const fringeOf = (x: number, z: number) => {
        // Distância até a divisa com cada setor vizinho (a reta do centro ao canto), só se o vizinho não é mata.
        let d = Infinity;
        if (edges[(i + 5) % 6] !== T.Forest) d = Math.min(d, Math.abs(x * caz - z * cax) / Math.hypot(cax, caz));
        if (edges[(i + 1) % 6] !== T.Forest) d = Math.min(d, Math.abs(x * cbz - z * cbx) / Math.hypot(cbx, cbz));
        return d < 0.16;
      };
      // Mata em fileiras (`Theme.forestRows`): 2 ou 3 fileiras retas e paralelas à borda, cada uma de uma espécie só
      // (alameda de álamos, cortinado de pôlder). O gerador da peça não gasta nada (tudo sai do `frng`).
      if (theme.forestRows) {
        const [mx, mz] = edgeMid(i);
        const ml = Math.hypot(mx, mz), ux = mx / ml, uz = mz / ml, tx = -uz, tz = ux;
        const rows = 2 + (frng() < 0.5 ? 1 : 0), sp = 0.125 + frng() * 0.025, d0 = 0.3 + frng() * 0.08;
        for (let rw = 0; rw < rows; rw++) {
          const only = weighted(frng, forestKinds), dist = d0 + rw * 0.17;
          for (let sOff = -0.66 + (frng() - 0.5) * sp; sOff <= 0.66; sOff += sp) {
            const x = ux * dist + tx * sOff + (frng() - 0.5) * 0.008, z = uz * dist + tz * sOff + (frng() - 0.5) * 0.008;
            if (sectorAt(x, z) !== i || Math.hypot(x, z) > 0.93 || !free(x, z, 0.05) || clear(x, z) < 0.04) continue;
            addTree(x, z, frng, 1, only);
          }
        }
      }
      for (let k = 0, tries = 0; !theme.forestRows && k < n && tries < n * 4; tries++) {
        let best: V2 | null = null, bestD = -1;
        for (let c = 0; c < 4; c++) {
          const p = samplePoint(frng, i, 0.1, 0.05);
          if (!p || !free(p[0], p[1], 0.055) || clear(p[0], p[1]) < 0.04) continue;
          let md = Infinity;
          for (const [tx, tz] of taken) md = Math.min(md, (tx - p[0]) ** 2 + (tz - p[1]) ** 2);
          if (md > bestD) { bestD = md; best = p; }
        }
        if (!best) continue;
        k++;
        if (fringeOf(best[0], best[1])) {
          if (frng() < 0.4) continue;
          if (frng() < 0.3) {
            D('bush', best[0], 0, best[1], frng() * 6, randRange(frng, 0.9, 1.5), vary(frng, tc(pick(frng, theme.bush))));
            taken.push(best);
          } else addTree(best[0], best[1], frng, 0.72);
        } else addTree(best[0], best[1], frng);
      }
      for (let k = Math.round(4 * detail); k > 0; k--) {
        const p = samplePoint(rng, i, 0.1, 0.05);
        if (p && clear(p[0], p[1]) > 0.03 && free(p[0], p[1], 0.03)) D('grass', p[0], 0, p[1], rng() * 6, randRange(rng, 0.9, 1.4), shade(tc(pick(rng, theme.grass)), 0.8));
      }
    } else if (terr === T.Village) {
      // Quarteirão: a rua vai do meio da borda ao centro e os lotes ficam dos dois lados dela,
      // de frente para ela. A primeira casa escolhe o lado pela semente; a segunda (em 30% dos
      // setores) vem do lado oposto, um pouco mais para dentro.
      const [mx, mz] = edgeMid(i);
      const ux = mx / INR, uz = mz / INR;
      const side = rng() < 0.5 ? 1 : -1;
      const lots: [number, number][] = [[0.52, side], [0.4, -side]];
      const n = rng() < 0.3 ? 2 : 1;
      for (let k = 0, tries = 0; k < n && tries < 4; tries++) {
        const [along, sd] = lots[(k + (tries > 0 ? 1 : 0)) % 2];
        const off = 0.2 * (tries > 1 ? -sd : sd);
        const hx = ux * INR * along - uz * off, hz = uz * INR * along + ux * off;
        if (!free(hx, hz, 0.3) || clear(hx, hz) < 0.15 || Math.hypot(hx, hz) > INR - 0.12) continue;
        addHouse(hx, hz, sectorAng, i, [ux * INR * along - uz * 0.03 * Math.sign(off), uz * INR * along + ux * 0.03 * Math.sign(off)]);
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
          // Manchas maiores (10 a 14): leem de longe como canteiro, não como pontinhos.
          for (let f = randInt(rng, 10, 14); f > 0; f--) {
            const fx = p[0] + (rng() - 0.5) * 0.3, fz = p[1] + (rng() - 0.5) * 0.3;
            if (clear(fx, fz) > 0.03) D('flower', fx, 0, fz, 0, randRange(rng, 0.8, 1.2), c);
          }
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

  // D29: lotes extras. Depois de tudo o mais, cada setor de vila com a casa dominante ganha uma
  // casa média e uma pequena ao longo da mesma rua (de um lado e do outro), mais anexos com os
  // kits que já existem: galpão (uma casa pequena e escura), poço e horta de arbustos.
  for (const dom of houses.filter((h) => h.sector >= 0)) {
    const i = dom.sector;
    const [mx, mz] = edgeMid(i);
    const ux = mx / INR, uz = mz / INR;
    const sectorAng = -(Math.PI / 6 + (Math.PI / 3) * i);
    const lotsAt = (count: number, range: [number, number]) => {
      for (let k = 0, tries = 0; k < count && tries < 10; tries++) {
        const along = 0.3 + r4() * 0.46;
        const sd = r4() < 0.5 ? -1 : 1;
        const sc = (range[0] + range[1]) / 2;
        const off = sd * (0.17 + r4() * 0.08 + houseR(sc) * 0.6);
        const hx = ux * INR * along - uz * off, hz = uz * INR * along + ux * off;
        if (!free(hx, hz, 0.06) || clear(hx, hz) < 0.1 || Math.hypot(hx, hz) > INR - 0.1) continue;
        if (houses.some((h) => Math.hypot(h.x - hx, h.z - hz) < houseR(h.s) + houseR(sc) + 0.03)) continue;
        if (trees.some(([tx, tz, ts]) => Math.hypot(tx - hx, tz - hz) < 0.05 * ts + houseR(sc))) continue;
        addHouse(hx, hz, sectorAng, i, [ux * INR * along - uz * 0.03 * Math.sign(off), uz * INR * along + ux * 0.03 * Math.sign(off)], range);
        k++;
      }
    };
    lotsAt(1, [1.35, 1.55]);
    lotsAt(r4() < 0.7 ? 1 : 0, [1.05, 1.25]);
    // Anexos atrás da casa dominante (do lado de dentro da vila, longe da rua).
    const back = (d: number, w: number): V2 => [dom.x - ux * d - uz * w, dom.z - uz * d + ux * w];
    for (let a = 0; a < 2; a++) {
      const [bx, bz] = back(0.16 * dom.s * 0.75 + 0.08, (a === 0 ? 1 : -1) * (0.08 + r4() * 0.08));
      const roll = r4(), pick1 = r4();
      if (roll > 0.6 || !free(bx, bz, 0.07) || clear(bx, bz) < 0.06 || Math.hypot(bx, bz) > INR - 0.1) continue;
      if (houses.some((h) => Math.hypot(h.x - bx, h.z - bz) < houseR(h.s) + 0.06)) continue;
      if (pick1 < 0.45) {
        // Galpão: casa pequena de paredes e telhado escuros, sem fumaça.
        const gi = houseKinds.find(([k]) => !isTower(theme.houses[k].body) && theme.houses[k].body !== 'long')?.[0] ?? 0;
        const ry = sectorAng + (r4() < 0.5 ? 0 : Math.PI / 2);
        const gs = 0.75 + r4() * 0.15;
        D(`wall:${gi}`, bx, 0, bz, ry, [gs, gs, gs], shade(vary(r4, tc(pick(r4, theme.houses[gi].walls)), 0.04), 0.78));
        D(`roof:${gi}`, bx, 0, bz, ry, [gs, gs, gs], shade(tc(pick(r4, theme.houses[gi].roofs)), 0.72));
        taken.push([bx, bz]);
      } else if (pick1 < 0.7) {
        // Poço.
        D('well', bx, 0, bz, r4() * 6, 0.9, WHITE);
        taken.push([bx, bz]);
      } else {
        // Horta: dois ou três arbustos e um tufo de flores.
        for (let b = 0; b < 3; b++) D('bush', bx + (r4() - 0.5) * 0.08, 0, bz + (r4() - 0.5) * 0.08, r4() * 6, 0.7 + r4() * 0.5, vary(r4, tc(pick(r4, theme.bush))));
        const c = tc(pick(r4, theme.flowers));
        for (let f = 0; f < 3; f++) D('flower', bx + (r4() - 0.5) * 0.12, 0, bz + (r4() - 0.5) * 0.12, 0, 1, c);
        taken.push([bx, bz]);
      }
    }
  }

  // Relevo: a mata sobe a encosta do morro e abraça o pé da serra (a rocha tem cristas e vales, então nada sobe
  // por ela), pedras caídas no pé da serra e moitas no alto do morro. Depois das árvores da peça (taken), por um gerador próprio.
  if (relief) {
    const { kind, x: cx, z: cz, ry, sx, sy, sz } = relief;
    const cr = Math.cos(ry), sr = Math.sin(ry);
    const baseR = kind === 'peak' ? PEAK.r : HILL.r;
    // Ponto no molde do kit (polar: ângulo e fração do raio) para o mundo, e a altura da encosta ali.
    const onSlope = (t: number, d: number) => {
      const lx = Math.cos(t) * d * baseR * sx, lz = Math.sin(t) * d * baseR * sz;
      return { x: cx + lx * cr + lz * sr, z: cz - lx * sr + lz * cr, y: kind === 'peak' ? 0 : Math.max(0, HILL.h * hillProfile(d) * sy) };
    };
    // Na serra, os ombros são mais altos que a encosta do cume principal: a mata não sobe por onde eles passam.
    const inShoulder = (t: number, d: number) => kind === 'peak' && PEAK_CONES.slice(1).some(([a, r, rs]) => Math.hypot(Math.cos(t) * d - Math.cos(a) * r, Math.sin(t) * d - Math.sin(a) * r) < rs * 1.35);
    const room = (px: number, pz: number, minD: number) => Math.hypot(px, pz) < INR - 0.1 && clear(px, pz) > 0.03 && taken.every(([tx, tz]) => (tx - px) ** 2 + (tz - pz) ** 2 >= minD * minD);
    const forests = edges.filter((e) => e === T.Forest).length;
    const wr = mulberry32((seed ^ RELIEF_SEED ^ 0x77) >>> 0);
    // `Theme.relief.slopeTrees`: só estas árvores sobem a encosta (pinheiros nas serras do Oriente); omitido, a mata inteira.
    const slopeOnly = forestKinds.filter(([k]) => rel?.slopeTrees?.includes(k.geo));
    const slopeKinds = slopeOnly.length ? slopeOnly : forestKinds;
    if (forests > 0) {
      for (let n = Math.round(forests * (kind === 'hill' ? 1.5 : 1) + wr() * 3), tries = 0; n > 0 && tries < 40; tries++) {
        const t = wr() * Math.PI * 2, d = kind === 'peak' ? randRange(wr, 1.1, 1.3) : randRange(wr, 0.25, 0.92);
        if (inShoulder(t, d)) continue;
        const p = onSlope(t, d);
        if (!room(p.x, p.z, 0.07)) continue;
        const k = weighted(wr, slopeKinds);
        const sc = randRange(wr, 0.7, 1.05) * TREE_SCALE * (k.geo === 'crystal' ? 1.4 : k.geo === 'cactus' ? 1.1 : 1);
        D(`tree:${k.geo}`, p.x, p.y > 0 ? p.y - 0.004 : 0, p.z, wr() * 6.28, [sc, sc * randRange(wr, 0.9, 1.15), sc], vary(wr, tc(pick(wr, k.colors)), 0.1));
        taken.push([p.x, p.z]);
        n--;
      }
    } else if (kind === 'hill') {
      for (let n = randInt(wr, 1, 3), tries = 0; n > 0 && tries < 20; tries++) {
        const p = onSlope(wr() * Math.PI * 2, randRange(wr, 0.1, 0.6));
        if (!room(p.x, p.z, 0.08)) continue;
        D('bush', p.x, Math.max(0, p.y - 0.004), p.z, wr() * 6, randRange(wr, 1.1, 1.8), vary(wr, tc(pick(wr, theme.bush))));
        taken.push([p.x, p.z]);
        n--;
      }
    }
    if (kind === 'peak') {
      // Pedras caídas no pé da serra.
      for (let n = randInt(wr, 2, 4), tries = 0; n > 0 && tries < 20; tries++) {
        const t = wr() * Math.PI * 2, p = onSlope(t, randRange(wr, 1.0, 1.3));
        if (inShoulder(t, 1.15) || !room(p.x, p.z, 0.06)) continue;
        D('rock', p.x, 0, p.z, wr() * 6, randRange(wr, 1.2, 2.4), vary(wr, tc(rel?.rock ?? theme.rock), 0.1));
        taken.push([p.x, p.z]);
        n--;
      }
    }
  }

  // Âncora do prado: um elemento de escala média por peça (p ~ 0,35), entre o tufo e a peça inteira.
  // Gerador à parte (semente da peça), kits que já existem; respeita free(), clear() e reserved.
  const grassSectors = [0, 1, 2, 3, 4, 5].filter((i) => edges[i] === T.Grass);
  const arng = mulberry32((seed ^ 0x2c1b3c6d) >>> 0);
  if (grassSectors.length && arng() < 0.35) {
    const i = grassSectors[Math.floor(arng() * grassSectors.length)];
    const p = samplePoint(arng, i, 0.25, 0.2);
    const ok = (x: number, z: number, r: number) => free(x, z, r) && clear(x, z) > r + 0.03;
    if (p && ok(p[0], p[1], 0.14)) {
      const [x, z] = p;
      const kind = Math.floor(arng() * 5);
      if (kind === 0) {
        // árvore solitária, com copa cheia
        const k = weighted(arng, forestKinds);
        const s = randRange(arng, 1.1, 1.5) * TREE_SCALE;
        D(`tree:${k.geo}`, x, 0, z, arng() * 6.28, [s, s * randRange(arng, 0.95, 1.15), s], vary(arng, tc(pick(arng, k.colors))));
        trees.push([x, z, s]);
      } else if (kind === 1) {
        // sebe curta: fileira de moitas
        const a = arng() * Math.PI, n = randInt(arng, 4, 5);
        for (let k = 0; k < n; k++) {
          const t = (k - (n - 1) / 2) * 0.1;
          const hx = x + Math.cos(a) * t, hz = z + Math.sin(a) * t;
          if (ok(hx, hz, 0.04)) D('bush', hx, 0, hz, arng() * 6, randRange(arng, 1.5, 1.9), vary(arng, tc(pick(arng, theme.bush))));
        }
      } else if (kind === 2) {
        // pedra grande com duas companheiras
        D('rock', x, 0, z, arng() * 6, randRange(arng, 2, 2.6), vary(arng, tc(theme.rock)));
        for (let k = 0; k < 2; k++) {
          const a = arng() * 6.28, hx = x + Math.cos(a) * 0.1, hz = z + Math.sin(a) * 0.1;
          if (ok(hx, hz, 0.03)) D('rock', hx, 0, hz, arng() * 6, randRange(arng, 0.9, 1.4), vary(arng, tc(theme.rock)));
        }
      } else if (kind === 3) {
        // canteiro de flores
        const c = tc(pick(arng, theme.flowers));
        for (let f = randInt(arng, 12, 16); f > 0; f--) {
          const a = arng() * 6.28, r = Math.sqrt(arng()) * 0.13, fx = x + Math.cos(a) * r, fz = z + Math.sin(a) * r;
          if (clear(fx, fz) > 0.03) D('flower', fx, 0, fz, 0, randRange(arng, 0.9, 1.3), c);
        }
      } else {
        // moita grande com broto ao lado
        D('bush', x, 0, z, arng() * 6, randRange(arng, 2.1, 2.6), vary(arng, tc(pick(arng, theme.bush))));
        const hx = x + 0.12, hz = z + 0.05;
        if (ok(hx, hz, 0.04)) D('bush', hx, 0, hz, arng() * 6, randRange(arng, 1.2, 1.5), vary(arng, tc(pick(arng, theme.bush))));
      }
      taken.push([x, z]);
    }
  }

  // --- Aba de campo na emenda: meia parcela simétrica no meio de cada borda de plantação, até o
  // plano da borda. Forma, altura e cor dependem só de (i, tema), nunca da semente: a peça vizinha
  // também de plantação gera a metade espelhada e as duas formam uma parcela só sobre a emenda.
  // Fica depois de árvores e casas (free) para não sobrepor nada e não mexer nos sorteios delas.
  const ABA_A = 0.25, ABA_D = 0.18, ABA_N = 6, ABA_H = 0.005;
  // Espaçamento das plantas da aba em relação ao das parcelas: mais ralo, para a aba não pesar
  // nas instâncias (a terra costura a emenda; as plantas só sugerem a continuidade).
  const ABA_SPARSE = 2.5;
  for (let i = 0; i < 6; i++) {
    const crop = abaCrops[i];
    if (!crop) continue;
    const ang = Math.PI / 6 + (Math.PI / 3) * i;
    const nx = Math.cos(ang), nz = Math.sin(ang), tx = -nz, tz = nx;
    const at = (t: number, d: number): V2 => [nx * d + tx * t, nz * d + tz * t];
    // Contorno da meia elipse (t de +A a -A, no sentido dos ângulos crescentes) e o anel externo do bisel.
    const ring = (ka: number, kd: number): V2[] => {
      const out: V2[] = [];
      for (let j = 0; j <= ABA_N; j++) {
        const th = (j / ABA_N) * Math.PI;
        out.push(at((ABA_A + ka) * Math.cos(th), INR - (ABA_D + kd) * Math.sin(th)));
      }
      return out;
    };
    const inner = ring(0, 0), outer = ring(0.04, 0.04);
    const c0 = theme.crops[0];
    const sc = tc(c0.soil).clone().lerp(tc(c0.colors[0]), c0.style === 'rice' ? 0.2 : c0.style === 'tulip' || c0.style === 'bulb' ? 0.1 : 0.42);
    const edge = sc.clone().lerp(groundCols[i], 0.6);
    const spIn: Splat = [0, 0, 0.6, 0], spOut: Splat = [0, 0, 0.25, 0];
    const [cx, cz] = at(0, INR - ABA_D * 0.4);
    for (let j = 0; j < ABA_N; j++) {
      const a = inner[j], b = inner[j + 1], ao = outer[j], bo = outer[j + 1];
      g.tri([cx, ABA_H, cz], [a[0], ABA_H, a[1]], [b[0], ABA_H, b[1]], sc, sc, sc, UP, spIn);
      g.tri([a[0], ABA_H, a[1]], [ao[0], 0.001, ao[1]], [bo[0], 0.001, bo[1]], sc, edge, edge, UP, spIn, spOut, spOut);
      g.tri([a[0], ABA_H, a[1]], [bo[0], 0.001, bo[1]], [b[0], ABA_H, b[1]], sc, edge, sc, UP, spIn, spOut, spIn);
    }
    // Plantas: fileiras paralelas à borda, a meia distância de linha da emenda, para o espaçamento
    // continuar o mesmo do outro lado (a vizinha escalona as fileiras ao contrário).
    const L = CROP_LAYOUT[crop.style];
    const dens = 1 / Math.sqrt(Math.max(0.3, detail));
    const gap = L.rowGap * dens * ABA_SPARSE, step = L.step * dens * ABA_SPARSE;
    const ar = mulberry32((seed ^ 0xab4c0f) + i * 131);
    const poly = inner.concat([at(-ABA_A, INR), at(ABA_A, INR)]);
    const hedge = crop.style === 'tea' || crop.style === 'vineyard' || crop.style === 'lavender';
    const yawRow = yawTo(tx, tz);
    for (let r = 0; (r + 0.5) * gap < ABA_D; r++) {
      const d = INR - (r + 0.5) * gap;
      const rowCol = L.rowColor ? tc(crop.colors[r % crop.colors.length]) : null;
      const off = ((r + (i >= 3 ? 1 : 0)) % 2) * step * 0.5;
      for (let t = -ABA_A + off + step * 0.25; t <= ABA_A; t += step) {
        const [x, z] = at(t, d);
        if (!insidePoly(x, z, poly) || !free(x, z, 0.03) || clear(x, z) < 0.03) continue;
        if (abaPlots[i].some((pp) => insidePoly(x, z, pp))) continue; // a parcela sorteada já planta ali
        // Degradê só no arco: ρ é a distância normalizada ao centro da meia elipse.
        const rho = Math.hypot(t / ABA_A, (INR - d) / ABA_D);
        const edgeT = smooth(1, 0.75, rho);
        if (ar() < (1 - edgeT) * 0.55) continue;
        if (L.sparse !== undefined && ar() > L.sparse) continue;
        let c = rowCol ?? tc(crop.colors[Math.floor(ar() * crop.colors.length)]);
        c = vary(ar, c, 0.06);
        const s = randRange(ar, L.scale[0], L.scale[1]) * 1.2 * (lush.has(i) ? 1.12 : 1) * (0.45 + 0.55 * edgeT);
        D(`crop:${crop.style}`, x, ABA_H, z, hedge ? yawRow : ar() * Math.PI * 2, s, lush.has(i) && !rowCol ? c.lerp(LUSH, 0.22) : c);
      }
    }
  }

  // Chão de mata sob cada árvore: terra escura que assenta a copa no chão (Dorfromantik).
  if (trees.length) {
    const floor = tc(theme.ground[T.Forest]).clone().lerp(tc(theme.trunk), 0.35).multiplyScalar(0.62);
    // Discos maiores que a copa de baixo: com a mata mais cheia eles se unem num chão escuro contínuo.
    for (const [x, z, s] of trees) disc(g, x, z, 0.075 * s, 0.0025, floor, 5, [0, 1, 0, 0]);
  }

  // Centro: segue o terreno dominante, quando não há rio, estrada ou marco.
  if (clear(0, 0) > 0.08) {
    const count = new Map<T, number>();
    for (const e of edges) count.set(e, (count.get(e) ?? 0) + 1);
    const [top, n] = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n >= 3 && top === T.Forest && free(0, 0, 0.09)) addTree((rng() - 0.5) * 0.05, (rng() - 0.5) * 0.05);
  }

  // Praça de terra batida sob o Centro da vila.
  if (opts.center) {
    const vg = tc(theme.ground[T.Village]);
    disc(g, 0, 0, 0.29, 0.004, vg.clone().lerp(tc(theme.roadBed), 0.35).multiplyScalar(0.92), 18, [0, 0, 0, 1]);
  }

  // --- Vida na vila: lotes de terra batida sob as casas, uma rua clara do meio de cada borda de
  // vila até o centro (ela emenda com a da peça vizinha) e, com vila em 3 ou mais bordas, uma
  // pracinha com poço onde as ruas se encontram. Sem sorteio: sai das posições das casas.
  const vSectors = [0, 1, 2, 3, 4, 5].filter((i) => edges[i] === T.Village);
  if (vSectors.length) {
    const vg = tc(theme.ground[T.Village]);
    const dirt = vg.clone().lerp(tc(theme.roadBed), 0.45).multiplyScalar(0.8);
    // Rua e pracinha bem mais claras que o chão da vila: é a malha que faz as casas lerem em quarteirões.
    const trail = vg.clone().lerp(tc(theme.roadBed), 0.25).lerp(WHITE, 0.38);
    const VILLAGE: Splat = [0, 0, 0, 1];
    const plaza = !opts.center && vSectors.length >= 3 && clear(0, 0) > 0.14 && free(0, 0, 0.12);
    // Trechos da rua que não pisam em rio, estrada nem construção reservada.
    const open = (x: number, z: number) => clear(x, z) > 0.035 && reserved.every(([rx, rz, rr]) => (rx - x) ** 2 + (rz - z) ** 2 > rr * rr * 0.8);
    const lane = (a: V2, b: V2, hw: number) => {
      let run: V2[] = [];
      for (const p of line(a, b, 10)) {
        if (open(p[0], p[1])) run.push(p);
        else {
          if (run.length > 1) strip(g, run, hw, 0.0045, trail, VILLAGE);
          run = [];
        }
      }
      if (run.length > 1) strip(g, run, hw, 0.0045, trail, VILLAGE);
    };
    for (const i of vSectors) {
      const [mx, mz] = edgeMid(i);
      const l = Math.hypot(mx, mz) || 1;
      const end = plaza ? 0.14 : opts.center ? 0.3 : vSectors.length >= 2 || houses.some((h) => h.sector === i) ? 0 : 0.25;
      lane([mx * 0.94, mz * 0.94], [(mx / l) * end, (mz / l) * end], 0.036);
    }
    for (const h of houses) {
      disc(g, h.x, h.z, 0.075 * h.s, 0.004, dirt, 8, VILLAGE);
      if (h.door) {
        // Caminho curto da porta até a rua.
        const [mx, mz] = edgeMid(h.sector);
        const l = Math.hypot(mx, mz) || 1;
        const t = (h.x * mx + h.z * mz) / (l * l);
        lane([h.x, h.z], [mx * t, mz * t], 0.018);
      }
    }
    if (plaza) {
      disc(g, 0, 0, 0.17, 0.005, trail, 16, VILLAGE);
      D('well', 0, 0, 0, rng() * 6, 1.15, WHITE);
      taken.push([0, 0]);
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

  // --- Fauna do tema (Theme.fauna): uma espécie por lugar (prado, mata, campo, beira ou água), sorteada
  // por um gerador à parte e por último, como a paisagem trabalhada. Temas sem `fauna` não gastam nada.
  if (theme.fauna?.length) {
    const fr2 = mulberry32((seed ^ 0xfa07a) >>> 0);
    const sectorsOf = (t: T) => [0, 1, 2, 3, 4, 5].filter((i) => edges[i] === t);
    for (const where of ['prado', 'floresta', 'campo', 'margem', 'agua'] as const) {
      const specs = theme.fauna.filter((f) => (f.where ?? 'prado') === where);
      if (!specs.length) continue;
      const chance = Math.max(...specs.map((f) => f.chance ?? 0.25));
      const roll = fr2(), count = 1 + (fr2() < 0.4 ? 1 : 0);
      const spec = weighted(fr2, specs.map((f) => [f, f.weight] as const));
      if (roll >= chance) continue;
      // Um ponto livre do lugar: setor do terreno (prado, mata, campo), faixa logo fora da água (margem) ou água funda.
      let at: V2 | null = null;
      for (let tries = 0; tries < 24 && !at; tries++) {
        let p: V2 | null = null;
        if (where === 'margem' || where === 'agua') {
          if (!field) break;
          const x = (fr2() - 0.5) * 2, z = (fr2() - 0.5) * 2;
          const d = field.e(x, z);
          if (Math.hypot(x, z) > INR - 0.12) continue;
          if (where === 'margem' ? d > 0.012 && d < 0.05 : d < -0.08) p = [x, z];
        } else {
          const secs = sectorsOf(where === 'prado' ? T.Grass : where === 'floresta' ? T.Forest : T.Field);
          if (secs.length) p = samplePoint(fr2, secs[Math.floor(fr2() * secs.length)], 0.18, 0.14);
          if (p && !(free(p[0], p[1], 0.08) && clear(p[0], p[1]) > 0.06)) p = null;
        }
        at = p;
      }
      if (!at) continue;
      for (let a = 0; a < count; a++) {
        const x = at[0] + (fr2() - 0.5) * 0.06, z = at[1] + (fr2() - 0.5) * 0.06;
        const c = vary(fr2, tc(pick(fr2, spec.colors)), 0.05);
        D(`fauna:${spec.kind}`, x, where === 'agua' ? WATER_Y - 0.008 : 0, z, fr2() * 6, randRange(fr2, 0.9, 1.15), c, 'wander');
        if (spec.time) decos[decos.length - 1].when = spec.time;
      }
      taken.push(at);
    }
  }

  // --- Peças de chão do prado (Theme.groundKits): tufos de 1 a 3 do kit (cupinzeiros) num setor de prado. Gerador à
  // parte e depois de tudo, como a fauna: o resto da peça não muda e os temas sem `groundKits` não gastam nada.
  if (theme.groundKits?.length) {
    const gr = mulberry32((seed ^ 0xc0b1d0) >>> 0);
    const grass = [0, 1, 2, 3, 4, 5].filter((i) => edges[i] === T.Grass);
    for (const spec of theme.groundKits) {
      const roll = gr(), sec = grass.length ? grass[Math.floor(gr() * grass.length)] : -1;
      if (sec < 0 || roll >= spec.chance * Math.min(1, grass.length / 2 + 0.3)) continue;
      const p = samplePoint(gr, sec, 0.16, 0.12);
      if (!p || !(free(p[0], p[1], 0.07) && clear(p[0], p[1]) > 0.05)) continue;
      const [lo, hi] = spec.count ?? [1, 3];
      for (let n = randInt(gr, lo, hi); n > 0; n--) {
        const x = p[0] + (gr() - 0.5) * 0.1, z = p[1] + (gr() - 0.5) * 0.1;
        if (clear(x, z) < 0.03) continue;
        D(`ground:${spec.kit}`, x, 0, z, gr() * 6, randRange(gr, 0.75, 1.3), vary(gr, tc(pick(gr, spec.colors)), 0.06));
      }
      taken.push(p);
    }
  }

  // --- Easter eggs de peça (Theme.eggs, efeito 'kit'): o kit especial num ponto livre perto do meio da peça.
  // Quem decide é a partida (core/eggs.ts), nunca o relógio; a posição sai da semente da peça.
  if (opts.eggs?.length) {
    const er = mulberry32((seed ^ 0xe66e66) >>> 0);
    for (const e of opts.eggs) {
      let at: V2 = [0, 0];
      for (let tries = 0; tries < 40; tries++) {
        const a = er() * Math.PI * 2, rr = Math.sqrt(er()) * 0.5;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        at = [x, z];
        if (free(x, z, 0.08) && clear(x, z) > 0.06) break;
      }
      D(`egg:${e.kit}`, at[0], 0, at[1], er() * 6, e.scale ?? 1, e.color ? tc(e.color) : WHITE);
      taken.push(at);
    }
  }

  // --- Cardume: 3 peixes nadando em círculo no lago ou no remanso de uma junção de rios.
  // Gerador à parte e por último, como a paisagem trabalhada.
  if (field && (shape.lake || water.idx.length >= 3)) {
    const r3 = mulberry32((seed ^ 0x51a5f15) >>> 0);
    const cx = shape.lake ? shape.lake.x : 0, cz = shape.lake ? shape.lake.z : 0;
    const R = Math.min(0.2, -field.e(cx, cz) - 0.06) * (0.75 + r3() * 0.25);
    if (R >= 0.07 && (shape.lake || r3() < 0.5)) {
      const fishCol = tc(theme.water).clone().multiplyScalar(0.3);
      const w = r3() < 0.5 ? 1 : -1;
      const a0 = r3() * Math.PI * 2;
      for (let k = 0; k < 3; k++) {
        const a = a0 + (k * Math.PI * 2) / 3 + (r3() - 0.5) * 0.6;
        const r = R * (0.8 + r3() * 0.35);
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        // Direção da tangente: anti-horário (w = 1) ou horário.
        D('fish', x, WATER_Y + 0.004, z, yawTo(-Math.sin(a) * w, Math.cos(a) * w), 1, fishCol, 'swim');
        decos[decos.length - 1].orbit = r * w;
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
