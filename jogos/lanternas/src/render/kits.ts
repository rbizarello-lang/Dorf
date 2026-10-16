// Kits low-poly: cada função devolve uma geometria com cor por vértice, desenhada em unidades do hexágono
// (raio 1), com a base da peça em y = 0. Nada vem de arquivo.
import * as THREE from 'three';
import { Geo, gable } from './geo';
import { PAL } from './palette';

const PI = Math.PI;
const hash = (a: number, b: number): number => {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------- peças de terra ----------
export interface TileSpec {
  bottom: number; top: number; bevel: number; bump: number; jag: number;
  topCol: number; lipCol: number; sideCol: number; seed: number; R?: number;
}

/** Hexágono chanfrado, de bottom a top, com o miolo levemente erguido (relevo) e, se `jag`, a borda irregular. */
export function tileGeometry(s: TileSpec): THREE.BufferGeometry {
  const R = s.R ?? 0.985;
  const pos: number[] = [], col: number[] = [];
  const c = new THREE.Color();
  const ring = (r: number, y: number, k: number, j = 0): THREE.Vector3 => {
    const a = (k % 6) * PI / 3;
    return new THREE.Vector3(r * Math.cos(a), y + j, r * Math.sin(a));
  };
  const yLip = s.top - s.bevel * 0.9;
  const L0 = [0, 1, 2, 3, 4, 5].map((k) => ring(R, s.bottom, k));
  const L1 = [0, 1, 2, 3, 4, 5].map((k) => ring(R, yLip, k));
  const L2 = [0, 1, 2, 3, 4, 5].map((k) => ring(R - s.bevel, s.top, k, s.jag * (hash(k, s.seed) * 0.9 + 0.1)));
  const C = new THREE.Vector3(0, s.top + s.bump, 0);
  const mid = new THREE.Vector3(0, (s.top + s.bottom) / 2, 0);
  const tri = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, ca: number, cb: number, cd: number, ma = 1, mb = 1, md = 1): void => {
    // Garante a face voltada para fora do miolo da peça.
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(d, a));
    const ctr = new THREE.Vector3().add(a).add(b).add(d).multiplyScalar(1 / 3).sub(mid);
    if (n.dot(ctr) < 0) { [b, d] = [d, b]; [cb, cd] = [cd, cb]; [mb, md] = [md, mb]; }
    for (const [v, cc, m] of [[a, ca, ma], [b, cb, mb], [d, cd, md]] as Array<[THREE.Vector3, number, number]>) {
      pos.push(v.x, v.y, v.z);
      c.set(cc);
      col.push(c.r * m, c.g * m, c.b * m);
    }
  };
  for (let k = 0; k < 6; k++) {
    const k1 = (k + 1) % 6;
    // lado (escurece embaixo), chanfro (cor do lábio), topo (leque até o miolo)
    tri(L0[k], L0[k1], L1[k], s.sideCol, s.sideCol, s.sideCol, 0.62, 0.62, 1);
    tri(L0[k1], L1[k1], L1[k], s.sideCol, s.sideCol, s.sideCol, 0.62, 1, 1);
    tri(L1[k], L1[k1], L2[k], s.lipCol, s.lipCol, s.lipCol);
    tri(L1[k1], L2[k1], L2[k], s.lipCol, s.lipCol, s.lipCol);
    // o miolo é um pouco mais claro: relevo lido pela cor, além da forma
    tri(C, L2[k], L2[k1], s.topCol, s.topCol, s.topCol, 1.07, 0.97, 0.97);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Anel (com preenchimento suave) deitado no plano, para realçar hexágonos. Cor RGBA por vértice. */
export function hexRing(rOut: number, rIn: number, fillAlpha: number, rgb: [number, number, number]): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const P = (r: number, k: number): [number, number, number] => [r * Math.cos(k * PI / 3), 0, r * Math.sin(k * PI / 3)];
  const push = (p: [number, number, number], a: number): void => { pos.push(...p); col.push(rgb[0], rgb[1], rgb[2], a); };
  const t = (a: [number, number, number], aa: number, b: [number, number, number], ab: number, c: [number, number, number], ac: number): void => {
    // face para cima (normal +y): a ordem horária vista de cima vira anti-horária ao inverter
    const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
    const ny = uz * vx - ux * vz;
    if (ny >= 0) { push(a, aa); push(b, ab); push(c, ac); } else { push(a, aa); push(c, ac); push(b, ab); }
  };
  for (let k = 0; k < 6; k++) {
    const o0 = P(rOut, k), o1 = P(rOut, k + 1), i0 = P(rIn, k), i1 = P(rIn, k + 1), z: [number, number, number] = [0, 0, 0];
    t(o0, 0.95, o1, 0.95, i0, 0.95); t(o1, 0.95, i1, 0.95, i0, 0.95);
    t(i0, fillAlpha, i1, fillAlpha, z, fillAlpha * 0.4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

// ---------- vegetação ----------
export const pine = (): THREE.BufferGeometry => new Geo(3)
  .cyl(0.045, 0.065, 0.22, PAL.timber, 5, { y: 0.11 })
  .cone(0.34, 0.4, PAL.leafB, 6, { y: 0.4, jit: 0.05, grad: [0.7, 1] })
  .cone(0.27, 0.36, PAL.leafA, 6, { y: 0.62, jit: 0.04, grad: [0.75, 1] })
  .cone(0.19, 0.32, PAL.leafC, 6, { y: 0.84, jit: 0.03, grad: [0.8, 1.05] })
  .build();

export const roundTree = (): THREE.BufferGeometry => new Geo(5)
  .cyl(0.05, 0.075, 0.32, PAL.timber, 5, { y: 0.16 })
  .ico(0.3, PAL.leafA, 1, { y: 0.5, sy: 0.88, jit: 0.1, grad: [0.62, 1.05] })
  .ico(0.2, PAL.leafC, 1, { x: 0.14, y: 0.72, z: -0.06, jit: 0.07, grad: [0.75, 1.1] })
  .build();

export const tallTree = (): THREE.BufferGeometry => new Geo(9)
  .cyl(0.035, 0.055, 0.3, PAL.sand, 5, { y: 0.15 })
  .ico(0.2, PAL.leafC, 1, { y: 0.62, sy: 2.1, jit: 0.06, grad: [0.62, 1.12] })
  .ico(0.12, PAL.meadow, 0, { x: -0.08, y: 0.4, z: 0.07, jit: 0.04 })
  .build();

export const oliveGrove = (): THREE.BufferGeometry => {
  const g = new Geo(11);
  const spots: Array<[number, number, number]> = [[-0.38, -0.2, 0.0], [0.36, -0.16, 1.2], [0.0, 0.42, 2.4]];
  spots.forEach(([x, z, a], i) => {
    g.cyl(0.035, 0.06, 0.3, PAL.walnut, 5, { x, z, y: 0.15, rz: 0.12 * (i - 1), rx: 0.08 });
    g.ico(0.26, PAL.olive, 1, { x, z, y: 0.42, sy: 0.7, jit: 0.1, ry: a, grad: [0.7, 1.1] });
    g.ico(0.16, PAL.oliveDark, 1, { x: x + 0.1, z: z - 0.06, y: 0.52, sy: 0.7, jit: 0.07 });
  });
  g.cyl(0.07, 0.06, 0.12, PAL.clay, 6, { x: 0.52, z: 0.3, y: 0.06 });
  return g.build();
};

/** Bosque plantado (carta Bosque da B): cinco árvores de copas variadas num mesmo hexágono. */
export const grove = (): THREE.BufferGeometry => {
  const g = new Geo(83);
  const spots: Array<[number, number, number, number]> = [[-0.42, -0.22, 0.95, 0], [0.4, -0.14, 1.0, 1], [0.02, 0.44, 0.9, 2], [-0.08, -0.04, 1.2, 1], [0.46, 0.42, 0.7, 0], [-0.46, 0.34, 0.75, 1]];
  spots.forEach(([x, z, k, kind]) => {
    g.cyl(0.04 * k, 0.06 * k, 0.26 * k, PAL.timber, 5, { x, z, y: 0.13 * k });
    if (kind === 0) {
      g.cone(0.3 * k, 0.38 * k, PAL.leafB, 6, { x, z, y: 0.4 * k, jit: 0.05, grad: [0.7, 1] });
      g.cone(0.22 * k, 0.34 * k, PAL.leafA, 6, { x, z, y: 0.62 * k, jit: 0.04, grad: [0.75, 1] });
      g.cone(0.15 * k, 0.28 * k, PAL.leafC, 6, { x, z, y: 0.82 * k, jit: 0.03, grad: [0.8, 1.05] });
    } else if (kind === 1) {
      g.ico(0.27 * k, PAL.leafA, 1, { x, z, y: 0.48 * k, sy: 0.9, jit: 0.1, grad: [0.62, 1.05] });
      g.ico(0.17 * k, PAL.leafC, 1, { x: x + 0.12 * k, z: z - 0.05 * k, y: 0.68 * k, jit: 0.07, grad: [0.75, 1.1] });
    } else {
      g.ico(0.18 * k, PAL.leafC, 1, { x, z, y: 0.58 * k, sy: 2.0, jit: 0.06, grad: [0.62, 1.12] });
    }
  });
  return g.build();
};

const wheatRows = (): THREE.BufferGeometry => {
  const g = new Geo(13);
  g.cyl(0.88, 0.9, 0.035, PAL.soil, 6, { y: 0.017, ry: PI / 6, grad: [0.8, 1] });
  for (let i = 0; i < 7; i++) {
    const z = (i - 3) * 0.19;
    const hw = Math.max(0.2, 0.86 - Math.abs(z) / 1.732 - 0.1);
    g.add(gable(0.13, 0.13, hw * 2), i % 2 ? 0xe8c14d : 0xd9b23f, { y: 0.03, z, ry: PI / 2, grad: [0.75, 1.1] });
  }
  g.cone(0.16, 0.22, 0xe8c14d, 6, { x: 0.52, z: 0.5, y: 0.14 });
  g.cyl(0.02, 0.02, 0.1, PAL.walnut, 4, { x: 0.52, z: 0.5, y: 0.04 });
  return g.build();
};
export const field = wheatRows;

export const rockPile = (v: number): THREE.BufferGeometry => {
  const g = new Geo(17 + v);
  if (v === 0) {
    g.ico(0.36, PAL.rock, 0, { y: 0.2, sy: 0.85, jit: 0.12, grad: [0.62, 1.12] })
      .ico(0.22, PAL.rockDark, 0, { x: 0.4, z: 0.18, y: 0.1, jit: 0.08, grad: [0.7, 1.05] })
      .ico(0.14, PAL.rock, 0, { x: -0.3, z: 0.34, y: 0.07, jit: 0.05 });
  } else {
    g.ico(0.3, PAL.rockDark, 0, { x: -0.12, y: 0.24, sy: 1.25, jit: 0.1, grad: [0.62, 1.1] })
      .ico(0.26, PAL.rock, 0, { x: 0.28, z: -0.1, y: 0.16, jit: 0.1, grad: [0.65, 1.1] })
      .ico(0.12, PAL.stoneDark, 0, { x: 0.05, z: 0.4, y: 0.06, jit: 0.04 });
  }
  return g.build();
};

export const tuft = (): THREE.BufferGeometry => {
  const g = new Geo(21);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26;
    g.cone(0.022, 0.16 + (i % 2) * 0.05, i % 2 ? PAL.meadowDark : PAL.leafC, 3, { x: Math.cos(a) * 0.035, z: Math.sin(a) * 0.035, y: 0.08, rz: Math.cos(a) * 0.25, rx: Math.sin(a) * 0.25 });
  }
  return g.build();
};

export const flowers = (): THREE.BufferGeometry => {
  const g = new Geo(23);
  const cols = [0xfff2d0, 0xffd45a, 0xf5a3b8, 0xffffff];
  cols.forEach((c, i) => {
    const x = Math.cos(i * 1.7) * 0.07, z = Math.sin(i * 1.7) * 0.07;
    g.cyl(0.006, 0.006, 0.1, PAL.leafB, 3, { x, z, y: 0.05 });
    g.ico(0.03, c, 0, { x, z, y: 0.115 });
  });
  return g.build();
};

// ---------- construções ----------
export const house = (roof: number): THREE.BufferGeometry => new Geo(29)
  .box(0.6, 0.08, 0.52, PAL.stone, { y: 0.04 })
  .box(0.5, 0.3, 0.42, PAL.cream, { y: 0.23, grad: [0.82, 1] })
  .add(gable(0.66, 0.27, 0.54), roof, { y: 0.38, grad: [0.85, 1.08] })
  .box(0.085, 0.2, 0.085, PAL.stoneDark, { x: 0.14, y: 0.55, z: -0.09 })
  .box(0.115, 0.03, 0.115, PAL.walnut, { x: 0.14, y: 0.66, z: -0.09 })
  .box(0.1, 0.17, 0.02, PAL.walnut, { y: 0.165, z: 0.215 })
  .ico(0.1, PAL.leafA, 0, { x: -0.34, y: 0.09, z: 0.18, jit: 0.04 })
  .cyl(0.05, 0.05, 0.1, PAL.timber, 6, { x: 0.36, y: 0.1, z: 0.2 })
  .build();

/** Janelas de uma casa: quatro posições (duas na frente, duas na lateral). */
export const WINDOW_SLOTS: Array<{ x: number; y: number; z: number; ry: number }> = [
  { x: -0.14, y: 0.26, z: 0.215, ry: 0 }, { x: 0.14, y: 0.26, z: 0.215, ry: 0 },
  { x: 0.255, y: 0.26, z: -0.08, ry: PI / 2 }, { x: 0.255, y: 0.26, z: 0.08, ry: PI / 2 },
];
export const windowPane = (): THREE.BufferGeometry => new Geo(1).box(0.085, 0.1, 0.02, 0xffffff, { grad: [1, 1] }).build();

export const lanternPole = (): THREE.BufferGeometry => new Geo(31)
  .cyl(0.08, 0.11, 0.09, PAL.stoneDark, 6, { y: 0.045 })
  .cyl(0.024, 0.036, 0.8, PAL.walnut, 6, { y: 0.48 })
  .cyl(0.12, 0.1, 0.035, PAL.walnut, 6, { y: 0.865 })
  .cyl(0.008, 0.008, 0.2, PAL.walnut, 3, { x: 0.1, y: 0.97 })
  .cyl(0.008, 0.008, 0.2, PAL.walnut, 3, { x: -0.1, y: 0.97 })
  .cyl(0.008, 0.008, 0.2, PAL.walnut, 3, { z: 0.1, y: 0.97 })
  .cyl(0.008, 0.008, 0.2, PAL.walnut, 3, { z: -0.1, y: 0.97 })
  .cone(0.17, 0.15, 0x2c4a55, 6, { y: 1.15, grad: [0.8, 1.1] })
  .ico(0.028, PAL.flame, 0, { y: 1.25 })
  .build();
export const lanternGlass = (): THREE.BufferGeometry => new Geo(1).ico(0.1, PAL.flame, 1, { y: 0.97, sy: 1.3, grad: [0.9, 1] }).build();

export const lighthouse = (): THREE.BufferGeometry => {
  const g = new Geo(37);
  const tx = -0.1, tz = -0.12;
  g.cyl(0.62, 0.7, 0.18, PAL.stone, 8, { x: tx, z: tz, y: 0.09 });
  const bands = [PAL.cream, PAL.clay, PAL.cream, PAL.clay, PAL.cream];
  bands.forEach((c, i) => {
    const r0 = 0.5 - i * 0.04, r1 = 0.5 - (i + 1) * 0.04;
    g.cyl(r1, r0, 0.3, c, 8, { x: tx, z: tz, y: 0.18 + 0.15 + i * 0.3, grad: [0.85, 1.05] });
  });
  const yG = 0.18 + 1.5;
  g.cyl(0.42, 0.34, 0.07, PAL.walnut, 10, { x: tx, z: tz, y: yG + 0.035 });
  g.cyl(0.4, 0.4, 0.06, PAL.walnut, 10, { x: tx, z: tz, y: yG + 0.15, grad: [1, 1] });
  g.cyl(0.26, 0.3, 0.07, PAL.stoneDark, 10, { x: tx, z: tz, y: yG + 0.085 });
  for (let k = 0; k < 4; k++) g.cyl(0.02, 0.02, 0.36, PAL.walnut, 4, { x: tx + Math.cos(k * PI / 2 + 0.78) * 0.2, z: tz + Math.sin(k * PI / 2 + 0.78) * 0.2, y: yG + 0.28 });
  g.cone(0.32, 0.3, 0x2c4a55, 10, { x: tx, z: tz, y: yG + 0.62, grad: [0.8, 1.1] });
  g.ico(0.04, PAL.flame, 0, { x: tx, z: tz, y: yG + 0.8 });
  g.box(0.12, 0.2, 0.03, PAL.walnut, { x: tx + 0.05, z: tz + 0.62, y: 0.28, ry: 0.0 });
  // casa do faroleiro, encostada na torre
  g.box(0.5, 0.26, 0.4, PAL.cream, { x: 0.5, z: 0.35, y: 0.13, ry: -0.5 });
  g.add(gable(0.58, 0.24, 0.5), PAL.clay, { x: 0.5, z: 0.35, y: 0.26, ry: -0.5 + PI / 2 * 0 });
  g.box(0.08, 0.16, 0.02, PAL.walnut, { x: 0.43, z: 0.57, y: 0.09, ry: -0.5 });
  return g.build();
};
export const lighthouseGlass = (): THREE.BufferGeometry => {
  const tx = -0.1, tz = -0.12, yG = 0.18 + 1.5;
  return new Geo(1).cyl(0.2, 0.2, 0.34, PAL.flameHot, 10, { x: tx, z: tz, y: yG + 0.31, grad: [1, 1] }).build();
};
export const LIGHTHOUSE_TOP = { x: -0.1, y: 0.18 + 1.5 + 0.31, z: -0.12 };

export const dock = (): THREE.BufferGeometry => {
  const g = new Geo(41);
  for (let i = 0; i < 7; i++) g.box(0.2, 0.05, 0.46, i % 2 ? PAL.timber : PAL.timberLight, { x: 0.1 + i * 0.24, y: -0.025, grad: [0.9, 1.05] });
  for (const s of [-1, 1]) {
    g.box(1.8, 0.05, 0.04, PAL.walnut, { x: 0.95, y: -0.075, z: s * 0.17 });
    for (const px of [0.3, 1.0, 1.66]) g.cyl(0.04, 0.05, 1.05, PAL.walnut, 5, { x: px, y: -0.5, z: s * 0.24 });
  }
  g.cyl(0.05, 0.05, 0.14, PAL.walnut, 5, { x: 1.74, y: 0.07, z: 0.2 });
  g.box(0.15, 0.12, 0.15, PAL.timber, { x: 0.34, y: 0.06, z: -0.1 });
  return g.build();
};

export const boat = (): THREE.BufferGeometry => {
  const outline = (s: number): THREE.Shape => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.36 * s, 0.02 * s); sh.lineTo(-0.22 * s, 0.13 * s); sh.lineTo(0.18 * s, 0.13 * s); sh.lineTo(0.4 * s, 0);
    sh.lineTo(0.18 * s, -0.13 * s); sh.lineTo(-0.22 * s, -0.13 * s); sh.lineTo(-0.36 * s, -0.02 * s); sh.closePath();
    return sh;
  };
  const hull = new THREE.ExtrudeGeometry(outline(1), { depth: 0.1, bevelEnabled: false });
  hull.rotateX(-PI / 2);
  const inner = new THREE.ExtrudeGeometry(outline(0.78), { depth: 0.02, bevelEnabled: false });
  inner.rotateX(-PI / 2);
  const sail = new THREE.Shape();
  sail.moveTo(0, 0); sail.lineTo(0, 0.55); sail.lineTo(0.3, 0.08); sail.closePath();
  const sg = new THREE.ExtrudeGeometry(sail, { depth: 0.012, bevelEnabled: false });
  return new Geo(43)
    .add(hull, PAL.cream, { y: -0.03, grad: [0.75, 1] })
    .add(new THREE.BoxGeometry(0.8, 0.03, 0.04), PAL.clay, { y: 0.06, z: 0.126, grad: [1, 1] })
    .add(new THREE.BoxGeometry(0.8, 0.03, 0.04), PAL.clay, { y: 0.06, z: -0.126, grad: [1, 1] })
    .add(inner, PAL.timberLight, { y: 0.065 })
    .cyl(0.012, 0.012, 0.6, PAL.walnut, 4, { x: -0.04, y: 0.36 })
    .add(sg, 0xfff3d6, { x: -0.03, y: 0.1, grad: [0.9, 1] })
    .build();
};

export const flag = (): THREE.BufferGeometry => {
  const pen = new THREE.Shape();
  pen.moveTo(0, 1.45); pen.lineTo(0.46, 1.3); pen.lineTo(0, 1.15); pen.closePath();
  return new Geo(47)
    .cyl(0.016, 0.02, 1.5, PAL.walnut, 5, { y: 0.75 })
    .add(new THREE.ExtrudeGeometry(pen, { depth: 0.012, bevelEnabled: false }), PAL.flame, { grad: [1, 1] })
    .build();
};
export const star = (): THREE.BufferGeometry => {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.075 : 0.19, a = PI / 2 + i * PI / 5;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
  g.translate(0, 0, -0.025);
  return new Geo(1).add(g, PAL.flameHot, { grad: [1, 1] }).build();
};

// ---------- achados ----------
export const ruin = (): THREE.BufferGeometry => new Geo(53)
  .cyl(0.62, 0.68, 0.07, PAL.stoneDark, 7, { y: 0.035 })
  .cyl(0.1, 0.115, 0.7, PAL.stone, 8, { x: -0.28, z: 0.04, y: 0.42, grad: [0.7, 1.08] })
  .box(0.24, 0.06, 0.24, PAL.stoneDark, { x: -0.28, z: 0.04, y: 0.8 })
  .cyl(0.1, 0.115, 0.5, PAL.stone, 8, { x: 0.27, z: 0.04, y: 0.32, grad: [0.7, 1.08] })
  .cone(0.1, 0.1, PAL.stone, 5, { x: 0.27, z: 0.04, y: 0.62, jit: 0.04 })
  .box(0.66, 0.1, 0.16, PAL.stone, { x: -0.05, z: 0.04, y: 0.88, rz: 0.1, jit: 0.02 })
  .cyl(0.08, 0.09, 0.2, PAL.stone, 7, { x: 0.12, z: -0.36, y: 0.17, rz: 1.45 })
  .box(0.14, 0.09, 0.12, PAL.stoneDark, { x: -0.3, z: -0.32, y: 0.1, ry: 0.5 })
  .box(0.1, 0.07, 0.1, PAL.stone, { x: 0.4, z: -0.28, y: 0.08, ry: 1.1 })
  .ico(0.1, PAL.leafC, 0, { x: -0.28, z: 0.04, y: 0.85, sy: 0.4, jit: 0.04 })
  .ico(0.09, PAL.leafB, 0, { x: 0.12, z: -0.36, y: 0.1, sy: 0.5 })
  .build();

export const orchard = (): THREE.BufferGeometry => {
  const g = new Geo(59);
  const spots: Array<[number, number]> = [[-0.36, 0.1], [0.34, 0.2], [0.0, -0.4]];
  spots.forEach(([x, z], t) => {
    g.cyl(0.04, 0.06, 0.26, PAL.timber, 5, { x, z, y: 0.13 });
    g.ico(0.27, PAL.leafC, 1, { x, z, y: 0.46, sy: 0.86, jit: 0.08, grad: [0.7, 1.1] });
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3 + t, rr = 0.22;
      g.ico(0.045, PAL.apple, 0, { x: x + Math.cos(a) * rr, z: z + Math.sin(a) * rr, y: 0.46 + Math.sin(a * 2 + t) * 0.12 });
    }
  });
  return g.build();
};

export const springStones = (): THREE.BufferGeometry => {
  const g = new Geo(61);
  for (let k = 0; k < 8; k++) {
    const a = k * PI / 4;
    g.ico(0.1 + (k % 3) * 0.02, k % 2 ? PAL.stone : PAL.rock, 0, { x: Math.cos(a) * 0.4, z: Math.sin(a) * 0.4, y: 0.07, sy: 0.8, jit: 0.05, grad: [0.7, 1.1] });
  }
  for (let k = 0; k < 5; k++) g.cone(0.015, 0.2, PAL.leafB, 3, { x: 0.5 + (k % 2) * 0.05, z: -0.3 + k * 0.05, y: 0.1, rz: 0.15 });
  return g.build();
};
export const springWater = (): THREE.BufferGeometry => new Geo(1).cyl(0.34, 0.34, 0.05, 0x7fe9f2, 12, { y: 0.06, grad: [1, 1] }).build();

/** Peixe do cardume (cabeça para +x): corpo prateado, cauda e nadadeira laranja para destacar do mar turquesa. */
export const fish = (): THREE.BufferGeometry => new Geo(67)
  .ico(0.085, 0xf6fcff, 0, { sx: 2.1, sy: 0.75, sz: 0.8, grad: [0.78, 1] })
  .cone(0.07, 0.13, 0xff8f3f, 3, { rz: PI / 2, x: -0.2, sz: 0.25, sy: 1.1 })
  .cone(0.045, 0.1, 0xff8f3f, 3, { y: 0.06, x: -0.02, sz: 0.25 })
  .build();

/** Mancha escura sob o cardume, vista de cima: ajuda a achá-lo no mar. */
export const schoolPatch = (): THREE.BufferGeometry => new Geo(3).cyl(0.95, 0.95, 0.012, 0x15607e, 14, { y: 0.03, grad: [1, 1] }).build();

export const gull = (): THREE.BufferGeometry => {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    0, 0, 0.0, -0.06, 0, -0.34, 0.12, 0, -0.04,
    0, 0, 0.0, 0.12, 0, 0.04, -0.06, 0, 0.34,
    -0.1, 0, 0, 0.14, 0, 0.0, 0.02, 0.03, 0,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(27).fill(1), 3));
  g.computeVertexNormals();
  return g;
};

export const puff = (): THREE.BufferGeometry => new Geo(71).ico(1, 0xffffff, 1, { jit: 0.22, grad: [0.78, 1.04] }).build();
export const dustBall = (): THREE.BufferGeometry => new Geo(73).ico(1, 0xffffff, 1, { jit: 0.2, grad: [1, 1] }).build();
export const cone = (): THREE.BufferGeometry => {
  // feixe do farol: cone com a ponta em z = 0, aberto para +z
  const g = new THREE.ConeGeometry(0.55, 8, 14, 1, true);
  g.rotateX(-PI / 2);
  g.translate(0, 0, 4);
  return g;
};

// ---------- pedestal ----------
export function pedestal(): THREE.BufferGeometry {
  const lathe = (pts: Array<[number, number]>): THREE.BufferGeometry => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 56);
  const g = new Geo(79);
  g.add(lathe([[0, -4.2], [15.8, -4.2], [16.0, -4.0], [16.0, -3.5], [15.3, -3.3], [15.0, -3.1], [14.95, -2.75], [15.4, -2.5], [15.55, -2.1], [15.4, -1.7], [15.0, -1.3]]), PAL.walnut, { grad: [0.7, 1.05] });
  g.add(lathe([[15.0, -1.3], [14.95, -0.7]]), PAL.timber, { grad: [0.85, 1.05] });
  g.add(lathe([[14.95, -0.7], [15.25, -0.58], [15.25, 0.1], [14.7, 0.24], [13.85, 0.24]]), PAL.timberLight, { grad: [0.9, 1.1] });
  g.add(lathe([[13.85, 0.24], [13.8, 0.1], [13.8, -0.9]]), PAL.timber, { grad: [0.6, 0.95] });
  g.add(new THREE.TorusGeometry(15.12, 0.07, 4, 56).rotateX(PI / 2), PAL.flame, { y: -0.66, grad: [1, 1] });
  g.add(new THREE.TorusGeometry(15.5, 0.06, 4, 56).rotateX(PI / 2), PAL.flame, { y: -3.35, grad: [1, 1] });
  return g.build();
}
