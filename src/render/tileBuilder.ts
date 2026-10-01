import * as THREE from 'three';
import { corner, edgeMid, INR } from '../core/hex';
import { mulberry32, pick, randInt, randRange, type Rng, weighted } from '../core/rng';
import type { SynKind } from '../core/synergy';
import { T } from '../core/tiles';
import type { CropKind, Theme } from '../themes/types';
import { CROP_LAYOUT, type HouseMeta } from './lib';

// Gera a peça na orientação de origem (rotação 0), em coordenadas locais.
// O mesmo resultado serve para o fantasma, a animação de queda e o "cozimento"
// no bloco estático: só muda a matriz. Tudo é determinístico pela semente.

export const TILE_T = 0.28;
const WATER_Y = 0.013;
const BANK_Y = 0.006;
const BED_Y = 0.004;
export const RIVER_HW = 0.19;
const BANK_EXTRA = 0.055;
export const ROAD_HW = 0.1;
/** Altura em que veículos andam (maglev flutua sobre a via). */
export const ROAD_Y = { rail: 0.03, dirt: 0.006, stone: 0.008, sand: 0.006, maglev: 0.075 } as const;

export type Anim = 'spin-z' | 'spin-x' | 'wander';

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
}

export interface TileBuild {
  pos: Float32Array;
  col: Float32Array;
  water: Float32Array;
  decos: Deco[];
  /** Pontos (x, y, z) de onde sai fumaça de chaminé. */
  chimneys: number[];
}

export interface BuildOpts {
  /** 1 = densidade total de plantas e capim; menor em qualidade baixa. */
  detail: number;
  /** Interações nas bordas (setor na orientação de origem). */
  synergies?: { sector: number; kind: SynKind }[];
  houses: HouseMeta[];
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

class Buf {
  pos: number[] = [];
  col: number[] = [];
  constructor(readonly withColor: boolean) {}

  tri(a: V3, b: V3, c: V3, ca: THREE.Color, cb: THREE.Color, cc: THREE.Color, n: V3) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * n[0] + ny * n[1] + nz * n[2] < 0) {
      [b, c] = [c, b];
      [cb, cc] = [cc, cb];
    }
    this.pos.push(...a, ...b, ...c);
    if (this.withColor) this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }

  quad(a: V3, b: V3, c: V3, d: V3, ca: THREE.Color, cb: THREE.Color, cc: THREE.Color, cd: THREE.Color, n: V3) {
    this.tri(a, b, c, ca, cb, cc, n);
    this.tri(a, c, d, ca, cc, cd, n);
  }
}

const UP: V3 = [0, 1, 0];
const WHITE = new THREE.Color(1, 1, 1);
const LUSH = new THREE.Color('#5fa83a');

export interface Path {
  pts: V2[];
  hw: number;
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

function nearestOnPaths(x: number, z: number, paths: Path[]) {
  let best = { d: Infinity, p: [0, 0] as V2, t: [1, 0] as V2 };
  for (const p of paths) {
    for (let k = 0; k < p.pts.length - 1; k++) {
      const [ax, az] = p.pts[k];
      const [bx, bz] = p.pts[k + 1];
      const dx = bx - ax, dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
      const px = ax + dx * t, pz = az + dz * t;
      const d = Math.hypot(x - px, z - pz) - p.hw;
      if (d < best.d) {
        const l = Math.sqrt(len2);
        best = { d, p: [px, pz], t: [dx / l, dz / l] };
      }
    }
  }
  return best;
}

const distToPaths = (x: number, z: number, paths: Path[]) => nearestOnPaths(x, z, paths).d;

function strip(buf: Buf, pts: V2[], hw: number, y: number, color: THREE.Color) {
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
  for (let k = 0; k < pts.length - 1; k++) buf.quad(L[k], R[k], R[k + 1], L[k + 1], color, color, color, color, UP);
}

function disc(buf: Buf, cx: number, cz: number, r: number, y: number, color: THREE.Color, seg = 12) {
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2;
    const a1 = ((k + 1) / seg) * Math.PI * 2;
    buf.tri([cx, y, cz], [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r], [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r], color, color, color, UP);
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

/** Ângulo de rotação em y que leva o eixo x local para a direção (dx, dz). */
const yawTo = (dx: number, dz: number) => Math.atan2(-dz, dx);

export function buildTile(edges: readonly T[], seed: number, theme: Theme, opts: BuildOpts): TileBuild {
  const rng = mulberry32(seed);
  const detail = opts.detail;
  const g = new Buf(true);
  const w = new Buf(false);
  const decos: Deco[] = [];
  const chimneys: number[] = [];
  const groundCols = edges.map((t) => tc(theme.ground[t]));
  const D = (key: string, x: number, y: number, z: number, ry: number, s: number | V3, color: THREE.Color, anim?: Anim) => {
    const [sx, sy, sz] = typeof s === 'number' ? [s, s, s] : s;
    decos.push({ key, x, y, z, ry, sx, sy, sz, color, anim });
  };

  // --- Topo: 6 setores subdivididos, com cores misturadas nas divisas.
  const N = 4;
  const center = new THREE.Color(0, 0, 0);
  for (const c of groundCols) center.add(c);
  center.multiplyScalar(1 / 6);
  for (let i = 0; i < 6; i++) {
    const A = corner(i);
    const B = corner((i + 1) % 6);
    const own = groundCols[i];
    const edgeA = own.clone().lerp(groundCols[(i + 5) % 6], 0.5);
    const edgeB = own.clone().lerp(groundCols[(i + 1) % 6], 0.5);
    const P = (a: number, b: number): V3 => [(a / N) * A[0] + (b / N) * B[0], 0, (a / N) * A[1] + (b / N) * B[1]];
    const C = (a: number, b: number) => (a === 0 && b === 0 ? center : b === 0 ? edgeA : a === 0 ? edgeB : own);
    for (let a = 0; a < N; a++) {
      for (let b = 0; b < N - a; b++) {
        g.tri(P(a, b), P(a + 1, b), P(a, b + 1), C(a, b), C(a + 1, b), C(a, b + 1), UP);
        if (a + b < N - 1) g.tri(P(a + 1, b), P(a + 1, b + 1), P(a, b + 1), C(a + 1, b), C(a + 1, b + 1), C(a, b + 1), UP);
      }
    }
  }

  // --- Laterais em camadas de terra.
  const side = tc(theme.side);
  const sideDark = tc(theme.sideDark);
  const LIP = 0.05;
  for (let i = 0; i < 6; i++) {
    const [ax, az] = corner(i);
    const [bx, bz] = corner((i + 1) % 6);
    const [mx, mz] = edgeMid(i);
    const n: V3 = [mx, 0, mz];
    const lip = shade(groundCols[i], 0.72);
    g.quad([ax, 0, az], [bx, 0, bz], [bx, -LIP, bz], [ax, -LIP, az], lip, lip, lip, lip, n);
    const mid = side.clone().lerp(sideDark, 0.35);
    g.quad([ax, -LIP, az], [bx, -LIP, bz], [bx, -0.15, bz], [ax, -0.15, az], side, side, mid, mid, n);
    g.quad([ax, -0.15, az], [bx, -0.15, bz], [bx, -TILE_T, bz], [ax, -TILE_T, az], mid, mid, sideDark, sideDark, n);
  }

  const water = pathsFor(edges, T.Water, RIVER_HW);
  const road = pathsFor(edges, T.Rail, ROAD_HW);
  const allPaths = [...water.paths, ...road.paths];
  if (water.idx.length === 1) allPaths.push({ pts: [[0, 0], [0.001, 0]], hw: 0.3 + BANK_EXTRA });

  // --- Lugares reservados para construções especiais (a decoração desvia deles).
  const reserved: [number, number, number][] = [];
  const taken: V2[] = [];
  const free = (x: number, z: number, minD: number) => {
    for (const [tx, tz] of taken) if ((tx - x) ** 2 + (tz - z) ** 2 < minD * minD) return false;
    for (const [rx, rz, rr] of reserved) if ((rx - x) ** 2 + (rz - z) ** 2 < rr * rr) return false;
    return true;
  };

  // --- Rios e lagos.
  const bank = tc(theme.bank);
  if (water.idx.length) {
    for (const p of water.paths) {
      strip(g, p.pts, p.hw + BANK_EXTRA, BANK_Y, bank);
      strip(w, p.pts, p.hw, WATER_Y, WHITE);
    }
    const n = water.idx.length;
    if (n === 1 || n >= 3) {
      const r = n === 1 ? 0.3 : RIVER_HW;
      disc(g, 0, 0, r + BANK_EXTRA, BANK_Y, bank);
      disc(w, 0, 0, r, WATER_Y, WHITE);
    }
    if (n >= 3) {
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        if (edges[i] !== T.Water || edges[j] !== T.Water) continue;
        const [mx, mz] = edgeMid(i);
        const [cx, cz] = corner(j);
        const [nx, nz] = edgeMid(j);
        for (const [buf, y, c] of [
          [g, BANK_Y, bank],
          [w, WATER_Y, WHITE],
        ] as const) {
          buf.tri([0, y, 0], [mx, y, mz], [cx, y, cz], c, c, c, UP);
          buf.tri([0, y, 0], [cx, y, cz], [nx, y, nz], c, c, c, UP);
        }
      }
    }
    // Vitórias-régias e juncos na margem.
    for (let k = randInt(rng, 0, n >= 3 ? 3 : 1); k > 0; k--) {
      const p = pick(rng, water.paths);
      const pt = p.pts[randInt(rng, 2, p.pts.length - 2)];
      D('lily', pt[0] + (rng() - 0.5) * 0.14, WATER_Y - 0.008, pt[1] + (rng() - 0.5) * 0.14, rng() * 6, 1, vary(rng, tc(theme.lily)));
    }
    for (const p of water.paths) {
      alongPath(p.pts, 0.05 + rng() * 0.05, 0.075 / Math.max(0.35, detail), (x, z, tx, tz) => {
        if (rng() < 0.45) return;
        const s = rng() < 0.5 ? 1 : -1;
        const o = p.hw + 0.012 + rng() * 0.02;
        const rx = x - tz * o * s, rz = z + tx * o * s;
        if (Math.hypot(rx, rz) > INR - 0.03 || distToPaths(rx, rz, allPaths) < -0.005) return;
        D('reed', rx, BANK_Y, rz, rng() * 6, randRange(rng, 0.8, 1.3), WHITE);
      });
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
    if (road.idx.length !== 2) disc(g, 0, 0, ROAD_HW * 1.05, BED_Y + 0.001, bed);
    if (road.idx.length === 1) {
      // Estação (ou pousada) no fim da linha.
      const [mx, mz] = edgeMid(road.idx[0]);
      const ux = mx / INR, uz = mz / INR;
      const sx = ux * 0.3 - uz * 0.16, sz = uz * 0.3 + ux * 0.16;
      D('station', sx, BED_Y, sz, yawTo(ux, uz), 1, WHITE);
      reserved.push([sx, sz, 0.15]);
    }
  }

  // --- Interações nas bordas: reservam um lugar perto da borda do setor.
  for (const s of opts.synergies ?? []) {
    const [mx, mz] = edgeMid(s.sector);
    const x = mx * 0.64, z = mz * 0.64;
    reserved.push([x, z, 0.15]);
    const ry = yawTo(mx, mz) + Math.PI / 2;
    if (s.kind === 'lumber') D('logs', x, 0, z, ry, 1.25, WHITE);
    else if (s.kind === 'apiary') {
      D('apiary', x, 0, z, ry, 1.3, WHITE);
      const c = tc(pick(rng, theme.flowers));
      for (let f = 0; f < 6; f++) D('flower', x + (rng() - 0.5) * 0.18, 0, z + (rng() - 0.5) * 0.18, 0, 1, c);
    } else if (s.kind === 'pasture') {
      D('fence', x, 0, z, ry, 1, WHITE);
      for (let a = 0; a < 3; a++) D('animal', x + (rng() - 0.5) * 0.1, 0, z + (rng() - 0.5) * 0.1, rng() * 6, randRange(rng, 0.9, 1.15), vary(rng, tc(pick(rng, theme.animals.colors)), 0.05), 'wander');
    } else if (s.kind === 'mill') {
      const sc = theme.mill === 'windmill' ? 1.1 : 1.2;
      const face = Math.atan2(-mx, -mz); // +z local (porta e pás) voltado para o centro da peça
      D('mill', x, 0, z, face, sc, WHITE);
      if (theme.mill === 'windmill') {
        // Cubo das pás: à frente do capuz, na direção +z local do moinho.
        const fx = Math.sin(face) * 0.078 * sc, fz = Math.cos(face) * 0.078 * sc;
        D('sails', x + fx, 0.255 * sc, z + fz, face, sc, WHITE, 'spin-z');
      }
    }
  }

  // --- Construções internas (sem pontos): moinho d'água, estação, silo, irrigação.
  const lush = new Set<number>();
  let watermill = false;
  let station = road.idx.length === 1;
  for (let i = 0; i < 6; i++) {
    for (const j of [(i + 1) % 6, (i + 5) % 6]) {
      const shared = j === (i + 1) % 6 ? (i + 1) % 6 : i; // canto comum aos dois setores
      const [cx, cz] = corner(shared);
      const tx0 = cx * 0.46, tz0 = cz * 0.46;
      if (edges[i] === T.Field && edges[j] === T.Water) lush.add(i);
      if (edges[i] === T.Village && edges[j] === T.Water && !watermill && water.paths.length) {
        const n = nearestOnPaths(tx0, tz0, water.paths);
        let px = tx0 - n.p[0], pz = tz0 - n.p[1];
        const l = Math.hypot(px, pz) || 1;
        px /= l;
        pz /= l;
        const wx = n.p[0] + px * (RIVER_HW + 0.012), wz = n.p[1] + pz * (RIVER_HW + 0.012);
        if (Math.hypot(wx, wz) > INR - 0.08) continue;
        watermill = true;
        D('wheel', wx, 0.04, wz, yawTo(px, pz), 1, WHITE, 'spin-x');
        const hx = n.p[0] + px * (RIVER_HW + 0.11), hz = n.p[1] + pz * (RIVER_HW + 0.11);
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

  // --- Marco no centro das vilas grandes.
  const villageCount = edges.filter((e) => e === T.Village).length;
  const landmarkRoll = rng();
  if (theme.landmark !== 'none' && villageCount >= 2 && distToPaths(0, 0, allPaths) > 0.2 && free(0, 0, 0.2) && landmarkRoll < theme.landmarkChance * (villageCount - 1) * 0.8) {
    const ry = rng() * Math.PI * 2;
    D('landmark', 0, 0, 0, ry, 1, WHITE);
    if (theme.landmark === 'windmill') {
      const fx = Math.sin(ry) * 0.078, fz = Math.cos(ry) * 0.078;
      D('sails', fx, 0.255, fz, ry, 1, WHITE, 'spin-z');
    }
    reserved.push([0, 0, theme.landmark === 'pyramid' ? 0.3 : 0.2]);
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
      if (!p || distToPaths(p[0], p[1], allPaths) < rad * 1.1) continue;
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
  const addTree = (x: number, z: number) => {
    const kind = weighted(rng, forestKinds);
    const s = randRange(rng, 0.9, 1.4) * (kind.geo === 'crystal' ? 1.4 : kind.geo === 'cactus' ? 1.1 : 1);
    D(`tree:${kind.geo}`, x, 0, z, rng() * Math.PI * 2, [s, s * randRange(rng, 0.9, 1.15), s], vary(rng, tc(pick(rng, kind.colors))));
    taken.push([x, z]);
  };
  const houseKinds = theme.houses.map((h, i) => [i, h.weight] as const);
  const addHouse = (x: number, z: number, baseAng: number) => {
    const i = weighted(rng, houseKinds);
    const kind = theme.houses[i];
    const meta = opts.houses[i];
    const s = randRange(rng, 1.15, 1.45) * (kind.body === 'long' ? 0.9 : 1);
    const sy = randRange(rng, 0.92, 1.12);
    const ry = baseAng + (rng() < 0.5 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.4;
    D(`wall:${i}`, x, 0, z, ry, [s, s * sy, s], vary(rng, tc(pick(rng, kind.walls)), 0.04));
    D(`roof:${i}`, x, 0, z, ry, [s, s * sy, s], vary(rng, tc(pick(rng, kind.roofs)), 0.05));
    if (meta?.chimney && rng() < 0.7) {
      const [cx, cy, cz] = meta.chimney;
      const c = Math.cos(ry), sn = Math.sin(ry);
      chimneys.push(x + (cx * c + cz * sn) * s, cy * s * sy, z + (-cx * sn + cz * c) * s);
    }
    taken.push([x, z]);
  };

  const grassN = Math.round(randInt(rng, 9, 15) * detail);
  for (let i = 0; i < 6; i++) {
    const terr = edges[i];
    const sectorAng = -(Math.PI / 6 + (Math.PI / 3) * i);
    if (terr === T.Forest) {
      const n = randInt(rng, theme.treesPerSector[0], theme.treesPerSector[1]);
      for (let k = 0, tries = 0; k < n && tries < n * 5; tries++) {
        const p = samplePoint(rng, i, 0.1, 0.07);
        if (!p || !free(p[0], p[1], 0.1) || distToPaths(p[0], p[1], allPaths) < 0.05) continue;
        addTree(p[0], p[1]);
        k++;
      }
      for (let k = Math.round(4 * detail); k > 0; k--) {
        const p = samplePoint(rng, i, 0.1, 0.05);
        if (p && distToPaths(p[0], p[1], allPaths) > 0.03 && free(p[0], p[1], 0.03)) D('grass', p[0], 0, p[1], rng() * 6, randRange(rng, 0.9, 1.4), shade(tc(pick(rng, theme.grass)), 0.8));
      }
    } else if (terr === T.Village) {
      const n = randInt(rng, 2, 3);
      for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
        const p = samplePoint(rng, i, 0.14, 0.13);
        if (!p || !free(p[0], p[1], 0.22) || distToPaths(p[0], p[1], allPaths) < 0.14) continue;
        addHouse(p[0], p[1], sectorAng);
        k++;
      }
      for (let k = Math.round(3 * detail); k > 0; k--) {
        const p = samplePoint(rng, i, 0.12, 0.05);
        if (p && free(p[0], p[1], 0.1) && distToPaths(p[0], p[1], allPaths) > 0.03) D('grass', p[0], 0, p[1], rng() * 6, randRange(rng, 0.8, 1.2), tc(pick(rng, theme.grass)));
      }
    } else if (terr === T.Grass) {
      for (let k = grassN; k > 0; k--) {
        const p = samplePoint(rng, i, 0.08, 0.03);
        if (!p || distToPaths(p[0], p[1], allPaths) < 0.02 || !free(p[0], p[1], 0.035)) continue;
        D('grass', p[0], 0, p[1], rng() * 6, randRange(rng, 0.8, 1.35), vary(rng, tc(pick(rng, theme.grass)), 0.08));
      }
      if (rng() < 0.45) {
        const p = samplePoint(rng, i, 0.15, 0.1);
        if (p && free(p[0], p[1], 0.08) && distToPaths(p[0], p[1], allPaths) > 0.04) {
          D('bush', p[0], 0, p[1], rng() * 6, randRange(rng, 0.8, 1.4), vary(rng, tc(pick(rng, theme.bush))));
          taken.push(p);
        }
      }
      if (rng() < 0.45) {
        const p = samplePoint(rng, i, 0.15, 0.12);
        if (p && distToPaths(p[0], p[1], allPaths) > 0.06 && free(p[0], p[1], 0.05)) {
          const c = tc(pick(rng, theme.flowers));
          for (let f = randInt(rng, 3, 6); f > 0; f--) D('flower', p[0] + (rng() - 0.5) * 0.14, 0, p[1] + (rng() - 0.5) * 0.14, 0, randRange(rng, 0.8, 1.2), c);
        }
      }
      if (rng() < 0.18) {
        const p = samplePoint(rng, i, 0.15, 0.1);
        if (p && free(p[0], p[1], 0.08) && distToPaths(p[0], p[1], allPaths) > 0.04) D('rock', p[0], 0, p[1], rng() * 6, randRange(rng, 0.7, 1.5), vary(rng, tc(theme.rock)));
      }
      if (rng() < 0.12) {
        const p = samplePoint(rng, i, 0.18, 0.14);
        if (p && free(p[0], p[1], 0.1) && distToPaths(p[0], p[1], allPaths) > 0.08) {
          for (let a = randInt(rng, 1, 2); a > 0; a--) D('animal', p[0] + (rng() - 0.5) * 0.06, 0, p[1] + (rng() - 0.5) * 0.06, rng() * 6, randRange(rng, 0.9, 1.1), vary(rng, tc(pick(rng, theme.animals.colors)), 0.05), 'wander');
        }
      }
    }
  }

  // Centro: segue o terreno dominante, quando não há rio, estrada ou marco.
  if (distToPaths(0, 0, allPaths) > 0.08) {
    const count = new Map<T, number>();
    for (const e of edges) count.set(e, (count.get(e) ?? 0) + 1);
    const [top, n] = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n >= 3 && top === T.Forest && free(0, 0, 0.09)) addTree((rng() - 0.5) * 0.05, (rng() - 0.5) * 0.05);
    if (n >= 3 && top === T.Village && free(0, 0, 0.2)) addHouse(0, 0, rng() * 6);
  }

  return { pos: new Float32Array(g.pos), col: new Float32Array(g.col), water: new Float32Array(w.pos), decos, chimneys };
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
