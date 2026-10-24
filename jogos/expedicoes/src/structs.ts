// Peças únicas de forma livre (passarelas, píeres, ponte de corda): uma malha mesclada cada, sem instâncias.
import * as THREE from 'three';
import { Geo } from './geo';

export type V2 = [number, number];

/** Amostras ao longo de uma poligonal, a cada `step`: posição e direção. */
export function walk(pts: V2[], step: number): { x: number; z: number; a: number; s: number }[] {
  const out: { x: number; z: number; a: number; s: number }[] = [];
  let s = 0, d = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0);
    while (d < len) { const t = d / len; out.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, a, s: s + d }); d += step; }
    d -= len; s += len;
  }
  return out;
}

/** Passarela de tábuas sobre estacas. `deckY` pode seguir o terreno; `pileY` é onde as estacas terminam. */
export function boardwalk(pts: V2[], width: number, deckY: (x: number, z: number) => number, pileY: (x: number, z: number) => number, o: { rail?: boolean; plank?: number; seed?: number } = {}): THREE.BufferGeometry {
  const g = new Geo(o.seed ?? 150);
  const step = o.plank ?? 0.13;
  const smp = walk(pts, step);
  smp.forEach((p, i) => {
    const y = deckY(p.x, p.z);
    const tone = [0x8d6b44, 0x7e5e3a, 0x9a7650][i % 3];
    g.box(step * 0.92, 0.035, width, tone, { x: p.x, y, z: p.z, ry: -p.a, jit: 0.004, grad: [0.85, 1] });
  });
  const pp = walk(pts, 0.75);
  pp.forEach((p) => {
    const y = deckY(p.x, p.z), yb = pileY(p.x, p.z);
    const nx = -Math.sin(p.a), nz = Math.cos(p.a);
    for (const s of [-1, 1]) {
      const px = p.x + nx * s * (width / 2 - 0.03), pz = p.z + nz * s * (width / 2 - 0.03);
      g.cyl(0.032, 0.042, y - yb, 0x4e4034, 6, { x: px, y: (y + yb) / 2 - 0.02, z: pz, jit: 0.008, grad: [0.55, 1] });
      if (o.rail) g.cyl(0.02, 0.026, 0.28, 0x5a4636, 5, { x: px, y: y + 0.16, z: pz, grad: [0.8, 1] });
    }
  });
  if (o.rail) {
    for (const s of [-1, 1]) {
      const rl: V2[] = pts.map(([x, z], i) => {
        const a = i < pts.length - 1 ? Math.atan2(pts[i + 1][1] - z, pts[i + 1][0] - x) : Math.atan2(z - pts[i - 1][1], x - pts[i - 1][0]);
        return [x - Math.sin(a) * s * (width / 2 - 0.03), z + Math.cos(a) * s * (width / 2 - 0.03)] as V2;
      });
      for (let i = 0; i < rl.length - 1; i++) {
        g.seg(new THREE.Vector3(rl[i][0], deckY(rl[i][0], rl[i][1]) + 0.27, rl[i][1]), new THREE.Vector3(rl[i + 1][0], deckY(rl[i + 1][0], rl[i + 1][1]) + 0.27, rl[i + 1][1]), 0.026, 0x5a4636);
      }
    }
  }
  return g.build();
}

/** Ponte de corda entre dois pontos, com barriga (sag), tábuas, cordas de mão e pilares. */
export function ropeBridge(A: THREE.Vector3, B: THREE.Vector3, sag: number, width = 0.46): THREE.BufferGeometry {
  const g = new Geo(151);
  const N = 18;
  const dir = new THREE.Vector3(B.x - A.x, 0, B.z - A.z), hl = dir.length();
  dir.normalize();
  const nrm = new THREE.Vector3(-dir.z, 0, dir.x);
  const P = (t: number, off = 0, up = 0): THREE.Vector3 => new THREE.Vector3(
    A.x + (B.x - A.x) * t + nrm.x * off, A.y + (B.y - A.y) * t - sag * 4 * t * (1 - t) + up, A.z + (B.z - A.z) * t + nrm.z * off);
  const ang = Math.atan2(-(B.z - A.z), B.x - A.x);
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N, t0 = i / N, t1 = (i + 1) / N;
    const p = P(t);
    const slope = Math.atan2(P(t1).y - P(t0).y, hl / N);
    g.box(hl / N * 0.86, 0.03, width, i % 2 ? 0x8a6a44 : 0x9a7650, { x: p.x, y: p.y, z: p.z, ry: ang, rz: slope, grad: [0.9, 1] });
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < N; i++) {
      g.seg(P(i / N, s * width * 0.52, 0.34), P((i + 1) / N, s * width * 0.52, 0.34), 0.02, 0xb9a070);
      g.seg(P(i / N, s * width * 0.5, 0.0), P((i + 1) / N, s * width * 0.5, 0.0), 0.022, 0x9c8458);
      if (i % 2 === 0) g.seg(P(i / N, s * width * 0.52, 0.0), P(i / N, s * width * 0.52, 0.34), 0.012, 0xb9a070);
    }
    for (const t of [0, 1]) {
      const p = P(t, s * width * 0.55);
      g.cyl(0.045, 0.055, 0.7, 0x5a4636, 6, { x: p.x, y: p.y + 0.3, z: p.z, grad: [0.7, 1] });
    }
  }
  return g.build();
}

/** Píer de tábuas que avança em +x; estacas por baixo, cabeça em T, guarda-corpo e escada. */
export function pier(len: number, deckY: number, seabed: number): THREE.BufferGeometry {
  const g = new Geo(152);
  const n = Math.round(len / 0.17);
  for (let i = 0; i < n; i++) g.box(0.15, 0.04, 0.56, i % 2 ? 0x93683e : 0x7e5632, { x: i * 0.17, y: deckY, jit: 0.004, grad: [0.85, 1] });
  for (let i = 0; i <= Math.round(len / 0.8); i++) for (const s of [-1, 1]) {
    g.cyl(0.04, 0.05, deckY - seabed + 0.1, 0x4e3220, 6, { x: i * 0.8, y: (deckY + seabed) / 2, z: s * 0.27, jit: 0.008, grad: [0.5, 1] });
    if (i % 2 === 0) g.cyl(0.05, 0.05, 0.12, 0x3e2a1a, 6, { x: i * 0.8, y: deckY + 0.08, z: s * 0.27, grad: [0.9, 1] });
  }
  for (let i = 0; i < 5; i++) g.box(0.17, 0.04, 1.2, i % 2 ? 0x93683e : 0x7e5632, { x: len + i * 0.17, y: deckY, grad: [0.85, 1] });
  for (const s of [-1, 1]) for (const dx of [0, 0.6]) g.cyl(0.04, 0.05, deckY - seabed + 0.1, 0x4e3220, 6, { x: len + dx, y: (deckY + seabed) / 2, z: s * 0.58, grad: [0.5, 1] });
  for (let i = 0; i <= Math.round(len / 0.8); i++) g.box(0.04, 0.3, 0.04, 0x5a3b24, { x: i * 0.8, y: deckY + 0.17, z: -0.28, grad: [0.9, 1] });
  g.box(len, 0.03, 0.03, 0x5a3b24, { x: len / 2, y: deckY + 0.3, z: -0.28, grad: [1, 1] });
  for (let i = 0; i < 4; i++) g.box(0.3, 0.025, 0.05, 0x6c5a44, { x: len + 0.5, y: deckY - 0.1 - i * 0.12, z: 0.62, grad: [1, 1] });
  return g.build();
}
