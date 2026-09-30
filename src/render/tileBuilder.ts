import * as THREE from 'three';
import { corner, edgeMid, INR } from '../core/hex';
import { mulberry32, pick, randInt, randRange, type Rng, weighted } from '../core/rng';
import { T } from '../core/tiles';
import type { Theme, TreeGeo } from '../themes/themes';
import type { DecoKind } from './lib';

// Gera a peça na orientação de origem (rotação 0), em coordenadas locais.
// O mesmo resultado serve para o fantasma, para a animação de queda e para o
// "cozimento" no chunk estático: só muda a matriz de transformação.

export const TILE_T = 0.28;
const WATER_Y = 0.013;
const BANK_Y = 0.006;
const BED_Y = 0.004;
const RIVER_HW = 0.19;
const BANK_EXTRA = 0.055;
const RAIL_HW = 0.1;

export interface Deco {
  kind: DecoKind;
  x: number;
  y: number;
  z: number;
  ry: number;
  sx: number;
  sy: number;
  sz: number;
  color: THREE.Color;
}

export interface TileBuild {
  pos: Float32Array;
  col: Float32Array;
  water: Float32Array;
  decos: Deco[];
  /** Pontos (x, y, z) de onde sai fumaça de chaminé. */
  chimneys: number[];
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
    // Garante a orientação pedida (face da frente para n).
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

interface Path {
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

function pathsFor(edges: readonly T[], terr: T, hw: number): { paths: Path[]; idx: number[] } {
  const idx: number[] = [];
  for (let i = 0; i < 6; i++) if (edges[i] === terr) idx.push(i);
  const paths: Path[] = [];
  if (idx.length === 2) paths.push({ pts: bezier(edgeMid(idx[0]), [0, 0], edgeMid(idx[1]), 16), hw });
  else for (const i of idx) paths.push({ pts: line(edgeMid(i), [0, 0], 8), hw });
  return { paths, idx };
}

function distToPaths(x: number, z: number, paths: Path[]) {
  let best = Infinity;
  for (const p of paths) {
    for (let k = 0; k < p.pts.length - 1; k++) {
      const [ax, az] = p.pts[k];
      const [bx, bz] = p.pts[k + 1];
      const dx = bx - ax, dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
      const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t)) - p.hw;
      if (d < best) best = d;
    }
  }
  return best;
}

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

/** Caixa alongada entre dois pontos (trilhos). */
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

function shade(c: THREE.Color, f: number) {
  return c.clone().multiplyScalar(f);
}

function vary(rng: Rng, c: THREE.Color, amount = 0.07) {
  const f = 1 + (rng() - 0.5) * 2 * amount;
  return c.clone().multiplyScalar(f);
}

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
    // Distância até a borda externa do setor (projeção na direção do meio da borda).
    if ((x * mx + z * mz) / INR > INR - margin) continue;
    return [x, z];
  }
  return null;
}

const TREE_TRUNK: Record<TreeGeo, number> = { conifer: 1, round: 1.1, blossom: 1.2, palm: 2.4, crystal: 0 };

export function buildTile(edges: readonly T[], seed: number, theme: Theme): TileBuild {
  const rng = mulberry32(seed);
  const g = new Buf(true);
  const w = new Buf(false);
  const decos: Deco[] = [];
  const chimneys: number[] = [];
  const groundCols = edges.map((t) => tc(theme.ground[t]));

  // --- Topo: 6 setores subdivididos, com cores misturadas nas divisas.
  const N = 4;
  const center = new THREE.Color(0, 0, 0);
  for (const c of groundCols) center.add(c);
  center.multiplyScalar(1 / 6);
  for (let i = 0; i < 6; i++) {
    const A = corner(i);
    const B = corner((i + 1) % 6);
    const own = groundCols[i];
    const prev = groundCols[(i + 5) % 6];
    const next = groundCols[(i + 1) % 6];
    const edgeA = own.clone().lerp(prev, 0.5);
    const edgeB = own.clone().lerp(next, 0.5);
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

  // --- Rios e lagos.
  const water = pathsFor(edges, T.Water, RIVER_HW);
  const rail = pathsFor(edges, T.Rail, RAIL_HW);
  const allPaths = [...water.paths, ...rail.paths];
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
    const lilies = randInt(rng, 0, n >= 3 ? 3 : 1);
    for (let k = 0; k < lilies; k++) {
      const p = pick(rng, water.paths);
      const pt = p.pts[randInt(rng, 2, p.pts.length - 2)];
      decos.push({ kind: 'lily', x: pt[0] + (rng() - 0.5) * 0.14, y: WATER_Y - 0.008, z: pt[1] + (rng() - 0.5) * 0.14, ry: rng() * 6, sx: 1, sy: 1, sz: 1, color: vary(rng, tc(theme.lily)) });
    }
  }

  // --- Trilhos: leito de brita, dormentes e dois trilhos.
  if (rail.idx.length) {
    const bed = tc(theme.railBed);
    const sleeper = tc(theme.sleeper);
    const railC = tc(theme.rail);
    const railD = shade(railC, 0.6);
    for (const p of rail.paths) {
      strip(g, p.pts, p.hw, BED_Y, bed);
      let acc = 0;
      let nextAt = 0.035;
      for (let k = 0; k < p.pts.length - 1; k++) {
        const a = p.pts[k];
        const b = p.pts[k + 1];
        const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const tx = (b[0] - a[0]) / seg, tz = (b[1] - a[1]) / seg;
        while (nextAt <= acc + seg) {
          const t = nextAt - acc;
          const cx = a[0] + tx * t, cz = a[1] + tz * t;
          beam(g, [cx - tz * 0.085, cz + tx * 0.085], [cx + tz * 0.085, cz - tx * 0.085], 0.014, BED_Y, BED_Y + 0.012, sleeper, shade(sleeper, 0.7));
          nextAt += 0.07;
        }
        acc += seg;
        for (const off of [-0.048, 0.048]) {
          beam(g, [a[0] - tz * off, a[1] + tx * off], [b[0] - tz * off, b[1] + tx * off], 0.008, BED_Y, BED_Y + 0.026, railC, railD);
        }
      }
    }
    if (rail.idx.length !== 2) disc(g, 0, 0, RAIL_HW * 1.05, BED_Y + 0.001, bed);
    if (rail.idx.length === 1) {
      // Estação no fim da linha.
      const ang = -(Math.PI / 6 + (Math.PI / 3) * rail.idx[0]) + Math.PI / 2;
      decos.push({ kind: 'station', x: 0, y: 0.005, z: 0, ry: ang, sx: 1, sy: 1, sz: 1, color: tc(theme.walls[0]) });
      decos.push({ kind: 'roof', x: 0, y: 0.007, z: 0, ry: ang, sx: 1.6, sy: 0.8, sz: 1.1, color: tc(theme.roofs[0]) });
    }
  }

  // --- Plantações: retalhos poligonais irregulares, levemente elevados.
  const fieldCols = theme.field.map(tc);
  const patches: V2[] = [];
  for (let i = 0; i < 6; i++) {
    if (edges[i] !== T.Field) continue;
    const base = pick(rng, fieldCols);
    const want = randInt(rng, 4, 6);
    for (let k = 0, tries = 0; k < want && tries < want * 5; tries++) {
      const p = samplePoint(rng, i, 0.02, 0.03);
      if (!p || distToPaths(p[0], p[1], allPaths) < 0.12) continue;
      if (patches.some(([x, z]) => (x - p[0]) ** 2 + (z - p[1]) ** 2 < 0.15 * 0.15)) continue;
      patches.push(p);
      k++;
      const sides = randInt(rng, 4, 6);
      const rad = randRange(rng, 0.13, 0.2);
      const rot0 = rng() * Math.PI * 2;
      const pts: V2[] = [];
      for (let j = 0; j < sides; j++) {
        const a = rot0 + (j / sides) * Math.PI * 2 + (rng() - 0.5) * 0.6;
        const rr = rad * randRange(rng, 0.75, 1.15);
        let x = p[0] + Math.cos(a) * rr;
        let z = p[1] + Math.sin(a) * rr;
        // Mantém o retalho dentro do hexágono.
        for (let e = 0; e < 6; e++) {
          const [mx, mz] = edgeMid(e);
          const proj = (x * mx + z * mz) / INR;
          const lim = INR - 0.025;
          if (proj > lim) {
            x -= (mx / INR) * (proj - lim);
            z -= (mz / INR) * (proj - lim);
          }
        }
        pts.push([x, z]);
      }
      const cx = pts.reduce((a, q) => a + q[0], 0) / sides;
      const cz = pts.reduce((a, q) => a + q[1], 0) / sides;
      const h = randRange(rng, 0.014, 0.026) + k * 0.003;
      const c = vary(rng, rng() < 0.65 ? base : pick(rng, fieldCols), 0.07);
      const d = shade(c, 0.72);
      const light = c.clone().lerp(WHITE, 0.12);
      for (let j = 0; j < sides; j++) {
        const a = pts[j], b = pts[(j + 1) % sides];
        g.tri([cx, h + 0.004, cz], [a[0], h, a[1]], [b[0], h, b[1]], light, c, c, UP);
        const n: V3 = [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz];
        g.quad([a[0], h, a[1]], [b[0], h, b[1]], [b[0], 0, b[1]], [a[0], 0, a[1]], d, d, d, d, n);
      }
    }
  }

  // --- Decoração instanciada: árvores, casas, arbustos.
  const taken: V2[] = [];
  const free = (x: number, z: number, minD: number) => {
    for (const [tx, tz] of taken) if ((tx - x) ** 2 + (tz - z) ** 2 < minD * minD) return false;
    return true;
  };
  const forestKinds = theme.forest.map((k) => [k, k.weight] as const);
  const addTree = (x: number, z: number) => {
    const kind = weighted(rng, forestKinds);
    const s = randRange(rng, 0.9, 1.45) * (kind.geo === 'crystal' ? 1.45 : 1);
    const ry = rng() * Math.PI * 2;
    const trunk = TREE_TRUNK[kind.geo];
    if (trunk > 0) decos.push({ kind: 'trunk', x, y: 0, z, ry, sx: s, sy: s * trunk, sz: s, color: tc(theme.trunk) });
    decos.push({ kind: kind.geo, x, y: 0, z, ry, sx: s, sy: s * randRange(rng, 0.9, 1.15), sz: s, color: vary(rng, tc(pick(rng, kind.colors))) });
    taken.push([x, z]);
  };
  const walls = theme.walls.map(tc);
  const roofs = theme.roofs.map(tc);
  const addHouse = (x: number, z: number, baseAng: number) => {
    const s = randRange(rng, 1.2, 1.55);
    const tower = rng() < theme.towerChance;
    const sy = tower ? 2.4 : randRange(rng, 0.9, 1.3);
    const ry = baseAng + (rng() < 0.5 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.5;
    decos.push({ kind: 'wall', x, y: 0, z, ry, sx: s, sy: s * sy, sz: s, color: vary(rng, pick(rng, walls), 0.04) });
    const top = 0.11 * s * sy;
    if (tower) decos.push({ kind: 'spire', x, y: top, z, ry, sx: s, sy: s, sz: s, color: vary(rng, pick(rng, roofs), 0.05) });
    else decos.push({ kind: 'roof', x, y: top - 0.11 * s, z, ry, sx: s, sy: s, sz: s, color: vary(rng, pick(rng, roofs), 0.05) });
    if (rng() < 0.35) chimneys.push(x, top + 0.09 * s, z);
    taken.push([x, z]);
  };

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
    } else if (terr === T.Village) {
      const n = randInt(rng, 2, 3);
      for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
        const p = samplePoint(rng, i, 0.14, 0.14);
        if (!p || !free(p[0], p[1], 0.23) || distToPaths(p[0], p[1], allPaths) < 0.14) continue;
        addHouse(p[0], p[1], sectorAng);
        k++;
      }
    } else if (terr === T.Grass) {
      if (rng() < 0.45) {
        const p = samplePoint(rng, i, 0.15, 0.1);
        if (p && free(p[0], p[1], 0.08) && distToPaths(p[0], p[1], allPaths) > 0.04) {
          const s = randRange(rng, 0.8, 1.4);
          decos.push({ kind: 'bush', x: p[0], y: 0, z: p[1], ry: rng() * 6, sx: s, sy: s, sz: s, color: vary(rng, tc(pick(rng, theme.bush))) });
          taken.push(p);
        }
      }
      if (rng() < 0.4) {
        const p = samplePoint(rng, i, 0.15, 0.12);
        if (p && distToPaths(p[0], p[1], allPaths) > 0.06) {
          const c = tc(pick(rng, theme.flowers));
          for (let f = randInt(rng, 3, 6); f > 0; f--) {
            decos.push({ kind: 'flower', x: p[0] + (rng() - 0.5) * 0.14, y: 0, z: p[1] + (rng() - 0.5) * 0.14, ry: 0, sx: 1, sy: 1, sz: 1, color: c });
          }
        }
      }
      if (rng() < 0.18) {
        const p = samplePoint(rng, i, 0.15, 0.1);
        if (p && free(p[0], p[1], 0.08) && distToPaths(p[0], p[1], allPaths) > 0.04) {
          const s = randRange(rng, 0.7, 1.5);
          decos.push({ kind: 'rock', x: p[0], y: 0, z: p[1], ry: rng() * 6, sx: s, sy: s, sz: s, color: vary(rng, tc(theme.rock)) });
        }
      }
    }
  }

  // Centro: segue o terreno dominante, quando não há rio ou trilho passando.
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
