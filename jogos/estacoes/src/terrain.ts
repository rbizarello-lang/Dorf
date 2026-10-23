// Layout da vila, relevo e o bloco de terra em corte (camadas na lateral).
// Plano: x para a direita, z para quem olha, y para cima. Placa de 14 x 14.
import * as THREE from 'three';
import { fbm, smooth, vnoise, mulberry32 } from './rng';
import type { SeasonLook } from './looks';

export const HALF = 7;
export const FLOOR_Y = -2;
export type V2 = [number, number];

export const STREAM_A: V2[] = [[5.9, -7.4], [5.5, -5.6], [4.8, -4.0], [4.4, -2.6], [4.2, -1.0], [4.0, 0.1]];
export const STREAM_B: V2[] = [[4.3, 3.0], [4.9, 4.4], [5.4, 5.7], [5.2, 7.4]];
export const STREAM_W = 0.42;
export const LAKE = { x: 3.7, z: 1.5, rx: 1.8, rz: 1.5 };
export const PLAZA = { x: -0.6, z: 0.25 };
export const MILL = { x: -4.2, z: -4.1 };

export const ROAD_MAIN: V2[] = [[7.2, -3.2], [5.9, -3.2], [4.5, -3.1], [3.2, -2.7], [1.9, -1.9], [0.6, -0.9], [PLAZA.x, PLAZA.z], [-2.2, 0.8], [-3.8, 1.5], [-5.4, 2.2], [-7.2, 2.7]];
export const ROAD_SOUTH: V2[] = [[PLAZA.x, PLAZA.z], [-0.7, 1.8], [-1.1, 3.3], [-1.5, 4.8], [-1.6, 7.2]];
export const ROAD_TRACK: V2[] = [[-2.2, 0.8], [-2.9, -0.8], [-3.6, -2.4], [-4.0, -3.5]];
export const ROADS = [ROAD_MAIN, ROAD_SOUTH, ROAD_TRACK];

export interface FieldDef { x: number; z: number; w: number; d: number; rot: number }
export const FIELDS: FieldDef[] = [
  { x: -4.6, z: 5.4, w: 3.2, d: 2.2, rot: -0.1 },
  { x: 1.4, z: -5.3, w: 3.4, d: 2.2, rot: 0.12 },
];
export const ORCHARD = { x: -5.5, z: -1.6, cols: 3, rows: 4, sp: 0.95 };
export const PEN = { x: 1.2, z: 5.4, w: 3.0, d: 1.9 };

export interface HouseSlot { x: number; z: number; kind: 'cottage' | 'house'; year: 1 | 3; upgrade?: boolean; s: number }
export const HOUSES: HouseSlot[] = [
  { x: -1.2, z: -1.6, kind: 'cottage', year: 1, upgrade: true, s: 1 },
  { x: 1.6, z: -0.4, kind: 'house', year: 1, s: 1 },
  { x: 0.9, z: 1.6, kind: 'cottage', year: 1, upgrade: true, s: 1 },
  { x: -2.4, z: 2.7, kind: 'house', year: 1, s: 1 },
  { x: -3.7, z: 3.6, kind: 'cottage', year: 1, s: 0.95 },
  { x: -4.9, z: 0.3, kind: 'cottage', year: 1, upgrade: true, s: 1 },
  { x: -1.0, z: -3.2, kind: 'cottage', year: 1, s: 1 },
  { x: 2.7, z: -0.8, kind: 'cottage', year: 1, upgrade: true, s: 0.95 },
  // chegam no ano 3
  { x: 0.6, z: 3.5, kind: 'house', year: 3, s: 1 },
  { x: 1.0, z: -3.2, kind: 'cottage', year: 3, s: 1 },
  { x: -5.9, z: 3.5, kind: 'cottage', year: 3, s: 1 },
  { x: 1.8, z: 3.3, kind: 'house', year: 3, s: 0.95 },
];

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
export function distPoly(px: number, pz: number, pts: V2[]): number {
  let d = 1e9;
  for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, segDist(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}
export const distRoads = (x: number, z: number, list: V2[][] = ROADS): number => Math.min(...list.map((r) => distPoly(x, z, r)));
export const distStream = (x: number, z: number): number => Math.min(distPoly(x, z, STREAM_A), distPoly(x, z, STREAM_B));
export const lakeE = (x: number, z: number): number => {
  const e = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
  return e * (1 + 0.14 * (vnoise(x * 1.3, z * 1.3, 4) - 0.5));
};

export function fieldMask(f: FieldDef, x: number, z: number): { m: number; v: number } {
  const c = Math.cos(f.rot), s = Math.sin(f.rot);
  const u = (x - f.x) * c + (z - f.z) * s, v = -(x - f.x) * s + (z - f.z) * c;
  return { m: smooth(f.w / 2 + 0.1, f.w / 2 - 0.1, Math.abs(u)) * smooth(f.d / 2 + 0.1, f.d / 2 - 0.1, Math.abs(v)), v };
}

function rawHeight(x: number, z: number): number {
  let h = 0.3 + 0.09 * Math.sin(x * 0.55 + 1.3) * Math.cos(z * 0.4) + 0.12 * (fbm(x * 0.33, z * 0.33, 3) - 0.5);
  h += 1.25 * Math.exp(-((x - MILL.x) ** 2 + (z - MILL.z) ** 2) / (2 * 1.7 * 1.7));
  h += 0.5 * Math.exp(-((x + 6) ** 2 + (z + 5.6) ** 2) / (2 * 2 * 2));
  h += 0.3 * Math.exp(-((x - 5.6) ** 2 + (z + 5.2) ** 2) / (2 * 1.8 * 1.8));
  // lago e riacho: escavados (a água fica em y = 0)
  const ds = distStream(x, z);
  const cs = smooth(STREAM_W + 0.75, STREAM_W - 0.05, ds);
  const e = lakeE(x, z);
  const cl = smooth(1.55, 0.8, e);
  const bed = Math.min(-0.18 - 0.1 * (1 - smooth(0, STREAM_W, ds)), -0.14 - 0.48 * smooth(1, 0, e));
  const c = Math.max(cs, cl);
  const bedH = cl > cs ? -0.14 - 0.48 * smooth(1.05, 0, e) : bed;
  return h + (bedH - h) * c;
}

/** Achatamentos: sob cada casa e na praça o relevo vira plano. */
const FLATS: { x: number; z: number; r: number; h: number }[] = [];
for (const hs of HOUSES) FLATS.push({ x: hs.x, z: hs.z, r: 0.85, h: rawHeight(hs.x, hs.z) });
FLATS.push({ x: PLAZA.x, z: PLAZA.z, r: 1.7, h: rawHeight(PLAZA.x, PLAZA.z) });
FLATS.push({ x: MILL.x, z: MILL.z, r: 0.9, h: rawHeight(MILL.x, MILL.z) });
FLATS.push({ x: PEN.x, z: PEN.z, r: 1.4, h: rawHeight(PEN.x, PEN.z) });

export function heightAt(x: number, z: number): number {
  let h = rawHeight(x, z);
  for (const f of FLATS) {
    const w = smooth(f.r + 0.7, f.r, Math.hypot(x - f.x, z - f.z));
    if (w > 0) h += (f.h - h) * w;
  }
  return h;
}

export const roadAngle = (pts: V2[], t: number): number => {
  const i = Math.max(0, Math.min(pts.length - 2, Math.floor(t)));
  return Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
};

// --- malha do chão ---
export const N = 112;
const NV = (N + 1) * (N + 1);

export class Terrain {
  readonly mesh: THREE.Mesh;
  readonly sides: THREE.Mesh;
  readonly stones: THREE.Mesh;
  private readonly col: Float32Array;
  private readonly H = new Float32Array(NV);
  private readonly X = new Float32Array(NV);
  private readonly Z = new Float32Array(NV);
  private readonly path1 = new Float32Array(NV);
  private readonly path3 = new Float32Array(NV);
  private readonly cob3 = new Float32Array(NV);
  private readonly field = new Float32Array(NV);
  private readonly furrow = new Float32Array(NV);
  private readonly wet = new Float32Array(NV);
  private readonly vari = new Float32Array(NV);
  private readonly forest = new Float32Array(NV);
  private readonly pen = new Float32Array(NV);
  private readonly sideCol: Float32Array;
  private readonly sideLayer: Uint8Array;
  private readonly sideShade: Float32Array;

  constructor() {
    const pos = new Float32Array(NV * 3);
    this.col = new Float32Array(NV * 3);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i;
      const x = -HALF + (i * 2 * HALF) / N, z = -HALF + (j * 2 * HALF) / N;
      const h = heightAt(x, z);
      this.X[k] = x; this.Z[k] = z; this.H[k] = h;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const dr = distRoads(x, z, [ROAD_MAIN, ROAD_SOUTH]), dt = distPoly(x, z, ROAD_TRACK);
      const dp = Math.hypot(x - PLAZA.x, z - PLAZA.z);
      const dRoad = Math.min(dr, dt);
      this.path1[k] = Math.max(smooth(0.44, 0.26, dRoad), smooth(1.3, 1.0, dp));
      this.path3[k] = Math.max(smooth(0.58, 0.4, dr), smooth(0.44, 0.26, dt), smooth(1.95, 1.65, dp));
      this.cob3[k] = Math.max(smooth(0.5, 0.34, dr), smooth(1.85, 1.55, dp));
      let fm = 0, fv = 0;
      for (const f of FIELDS) { const r = fieldMask(f, x, z); if (r.m > fm) { fm = r.m; fv = r.v; } }
      this.field[k] = fm; this.furrow[k] = 0.5 + 0.5 * Math.sin(fv * 24);
      this.wet[k] = smooth(0.2, 0.03, h);
      this.vari[k] = vnoise(x * 1.5, z * 1.5, 2) * 0.7 + vnoise(x * 5, z * 5, 6) * 0.3;
      const pm = smooth(PEN.w / 2 + 0.2, PEN.w / 2 - 0.2, Math.abs(x - PEN.x)) * smooth(PEN.d / 2 + 0.2, PEN.d / 2 - 0.2, Math.abs(z - PEN.z));
      this.pen[k] = pm;
    }
    const idx: number[] = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;

    // --- laterais em camadas ---
    const LAYERS = 6;
    const sPos: number[] = [], sNor: number[] = [], sIdx: number[] = [];
    const layer: number[] = [], shade: number[] = [];
    const rnd = mulberry32(77);
    const stonePool: { x: number; y: number; z: number; nx: number; nz: number; s: number }[] = [];
    const D = [0.07, 0.34, 0.85, 1.36, 1.86];
    for (let side = 0; side < 4; side++) {
      const nx = side === 0 ? 0 : side === 1 ? 1 : side === 2 ? 0 : -1;
      const nz = side === 0 ? -1 : side === 1 ? 0 : side === 2 ? 1 : 0;
      for (let i = 0; i < N; i++) {
        const pt = (ii: number): [number, number] => {
          const t = -HALF + (ii * 2 * HALF) / N;
          return side === 0 ? [t, -HALF] : side === 1 ? [HALF, t] : side === 2 ? [-t, HALF] : [-HALF, -t];
        };
        const [x0, z0] = pt(i), [x1, z1] = pt(i + 1);
        const hy0 = heightAt(x0, z0), hy1 = heightAt(x1, z1);
        const edge = (hy: number, x: number, z: number, k: number): number => {
          if (k === 0) return hy;
          if (k === LAYERS) return FLOOR_Y;
          const w = vnoise((x + z) * 2.3 + side * 5, k * 3.7, 11) * 0.09;
          return Math.max(FLOOR_Y + 0.05, hy - D[k - 1] - w);
        };
        const sh = 0.93 + 0.14 * vnoise(i * 0.35 + side * 9, 3, 21);
        for (let k = 0; k < LAYERS; k++) {
          const base = sPos.length / 3;
          const ya0 = edge(hy0, x0, z0, k), yb0 = edge(hy0, x0, z0, k + 1);
          const ya1 = edge(hy1, x1, z1, k), yb1 = edge(hy1, x1, z1, k + 1);
          sPos.push(x0, ya0, z0, x1, ya1, z1, x0, yb0, z0, x1, yb1, z1);
          for (let q = 0; q < 4; q++) { sNor.push(nx, 0, nz); layer.push(k); shade.push((q < 2 ? 1 : 0.86) * sh); }
          // enrolamento voltado para fora: confere a normal do primeiro triângulo com a da lateral
          const ex = x1 - x0, ey = ya1 - ya0, ez = z1 - z0, fx = 0, fy = yb0 - ya0, fz = 0;
          const cx = ey * fz - ez * fy, cz = ex * fy - ey * fx;
          if (cx * nx + cz * nz >= 0) sIdx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
          else sIdx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        }
        if (rnd() < 0.045) stonePool.push({ x: (x0 + x1) / 2, y: FLOOR_Y + 0.15 + rnd() * (hy0 - FLOOR_Y - 0.5), z: (z0 + z1) / 2, nx, nz, s: 0.07 + rnd() * 0.09 });
      }
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
    sg.setAttribute('normal', new THREE.Float32BufferAttribute(sNor, 3));
    this.sideCol = new Float32Array((sPos.length / 3) * 3);
    sg.setAttribute('color', new THREE.BufferAttribute(this.sideCol, 3));
    sg.setIndex(sIdx);
    this.sideLayer = new Uint8Array(layer);
    this.sideShade = new Float32Array(shade);
    this.sides = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 }));
    this.sides.receiveShadow = true;

    // pedras embutidas nas laterais (mesmo mesh, cores fixas)
    const parts: THREE.BufferGeometry[] = [];
    const tmp = new THREE.Color();
    for (const s of stonePool) {
      const ico = new THREE.IcosahedronGeometry(s.s, 0);
      ico.scale(1, 0.72, 1);
      ico.rotateY(rnd() * 6);
      ico.translate(s.x + s.nx * 0.01, s.y, s.z + s.nz * 0.01);
      ico.deleteAttribute('uv');
      ico.computeVertexNormals();
      const c = new Float32Array(ico.attributes.position.count * 3);
      tmp.setHSL(0.08 + rnd() * 0.04, 0.08 + rnd() * 0.1, 0.42 + rnd() * 0.22);
      for (let i = 0; i < c.length; i += 3) { c[i] = tmp.r; c[i + 1] = tmp.g; c[i + 2] = tmp.b; }
      ico.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.push(ico);
    }
    // mergeGeometries sem importar o utilitário: concatenação manual
    let nverts = 0;
    for (const p of parts) nverts += p.attributes.position.count;
    const P = new Float32Array(nverts * 3), Nn = new Float32Array(nverts * 3), Cc = new Float32Array(nverts * 3);
    let o = 0;
    for (const p of parts) {
      P.set(p.attributes.position.array as Float32Array, o * 3);
      Nn.set(p.attributes.normal.array as Float32Array, o * 3);
      Cc.set(p.attributes.color.array as Float32Array, o * 3);
      o += p.attributes.position.count;
    }
    const stg = new THREE.BufferGeometry();
    stg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    stg.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
    stg.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
    this.stones = new THREE.Mesh(stg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    this.stones.receiveShadow = true;
  }

  /** Mancha o chão do bosque embaixo das árvores (chamado uma vez, depois de plantar). */
  setForest(pts: { x: number; z: number; r: number }[]): void {
    for (let k = 0; k < NV; k++) {
      let w = 0;
      for (const p of pts) w = Math.max(w, smooth(p.r, p.r * 0.35, Math.hypot(this.X[k] - p.x, this.Z[k] - p.z)));
      this.forest[k] = w;
    }
  }

  /** year: 0 (ano 1) a 1 (ano 3), contínuo durante a transição. */
  recolor(L: SeasonLook, year: number): void {
    const gA = L.grassA, gB = L.grassB, snow = L.snow;
    const SN = 0.94, SG = 0.97, SB = 1.0;
    const cobR = 0.3, cobG = 0.27, cobB = 0.24;
    const bedR = 0.16, bedG = 0.2, bedB = 0.18;
    const c = this.col;
    for (let k = 0; k < NV; k++) {
      const v = this.vari[k];
      let r = gA.r + (gB.r - gA.r) * v, g = gA.g + (gB.g - gA.g) * v, b = gA.b + (gB.b - gA.b) * v;
      const fo = this.forest[k] * 0.7;
      r += (L.forest.r - r) * fo; g += (L.forest.g - g) * fo; b += (L.forest.b - b) * fo;
      const fm = this.field[k], fur = 0.82 + 0.3 * this.furrow[k];
      r += (L.soil.r * fur - r) * fm; g += (L.soil.g * fur - g) * fm; b += (L.soil.b * fur - b) * fm;
      const pn = this.pen[k] * 0.45;
      r += (L.path.r * 0.85 - r) * pn; g += (L.path.g * 0.85 - g) * pn; b += (L.path.b * 0.85 - b) * pn;
      const wt = this.wet[k] * 0.75;
      r += (L.wet.r - r) * wt; g += (L.wet.g - g) * wt; b += (L.wet.b - b) * wt;
      const pa = this.path1[k] + (this.path3[k] - this.path1[k]) * year;
      const pv = 0.94 + 0.12 * vnoise(this.X[k] * 7, this.Z[k] * 7, 3);
      r += (L.path.r * pv - r) * pa; g += (L.path.g * pv - g) * pa; b += (L.path.b * pv - b) * pa;
      const cb = this.cob3[k] * year;
      r += (cobR * pv - r) * cb; g += (cobG * pv - g) * cb; b += (cobB * pv - b) * cb;
      const h = this.H[k];
      if (snow > 0) {
        const sv = 0.965 + 0.035 * v;
        const sa = snow * (1 - 0.5 * pa) * (1 - 0.6 * cb) * smooth(0.0, 0.1, h);
        r += (SN * sv - r) * sa; g += (SG * sv - g) * sa; b += (SB * sv - b) * sa;
      }
      const bd = smooth(0.02, -0.1, h);
      r += (bedR - r) * bd; g += (bedG - g) * bd; b += (bedB - b) * bd;
      c[k * 3] = r; c[k * 3 + 1] = g; c[k * 3 + 2] = b;
    }
    (this.mesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    // laterais: o gramado do topo segue a estação; a camada de cima congela no inverno
    const frost = snow;
    const turf = new THREE.Color().copy(gB).lerp(new THREE.Color(0xf4f8ff), frost);
    const layers: THREE.Color[] = [
      turf,
      new THREE.Color('#4c3222').lerp(new THREE.Color('#6e5b52'), frost * 0.8),
      new THREE.Color('#7e5836'),
      new THREE.Color('#a97c4e'),
      new THREE.Color('#756c60'),
      new THREE.Color('#4a4642'),
    ];
    const sc = this.sideCol;
    for (let i = 0; i < this.sideLayer.length; i++) {
      const lc = layers[this.sideLayer[i]], s = this.sideShade[i];
      sc[i * 3] = lc.r * s; sc[i * 3 + 1] = lc.g * s; sc[i * 3 + 2] = lc.b * s;
    }
    (this.sides.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
