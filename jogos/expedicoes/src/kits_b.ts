// Natureza, bichos, barcos e pequenos objetos. Tudo em baixa contagem de triângulos, cor por vértice.
import * as THREE from 'three';
import { Geo, gable } from './geo';

// ---------- árvores e plantas ----------
export const pineGeo = (snow: boolean, tone = 0x3f6b48): THREE.BufferGeometry => {
  const g = new Geo(snow ? 61 : 60).cyl(0.04, 0.065, 0.28, 0x5a4636, 5, { y: 0.14, grad: [0.7, 1] });
  const tiers: [number, number, number][] = [[0.42, 0.56, 0.4], [0.33, 0.52, 0.72], [0.23, 0.46, 1.02], [0.14, 0.36, 1.3]];
  for (const [r, h, y] of tiers) {
    g.cone(r, h, tone, 7, { y, grad: [0.58, 1.05], jit: 0.035 });
    if (snow) g.cone(r * 0.82, h * 0.6, 0xf4f8fb, 7, { y: y + h * 0.12, grad: [0.88, 1], jit: 0.03 });
  }
  return g.build();
};
export const oakGeo = (): THREE.BufferGeometry => new Geo(62)
  .cyl(0.045, 0.08, 0.5, 0x6b4a2e, 6, { y: 0.25, grad: [0.7, 1] })
  .cyl(0.02, 0.035, 0.3, 0x6b4a2e, 5, { x: 0.08, y: 0.56, rz: -0.62, grad: [0.85, 1] })
  .cyl(0.02, 0.035, 0.3, 0x6b4a2e, 5, { x: -0.08, y: 0.56, rz: 0.62, grad: [0.85, 1] })
  .ico(0.36, 0x5f9a4a, 1, { y: 0.82, sy: 0.9, jit: 0.1, grad: [0.62, 1.05] })
  .ico(0.22, 0x73ad55, 1, { x: 0.22, y: 0.7, z: 0.1, jit: 0.07, grad: [0.7, 1.05] })
  .build();
export const willowGeo = (): THREE.BufferGeometry => {
  const g = new Geo(63)
    .cyl(0.05, 0.09, 0.55, 0x5b4a38, 6, { y: 0.27, rz: 0.12, jit: 0.01, grad: [0.6, 1] })
    .ico(0.34, 0x56733a, 1, { x: 0.05, y: 0.72, sy: 0.62, jit: 0.1, grad: [0.62, 1.05] })
    .ico(0.2, 0x6a8845, 1, { x: -0.22, y: 0.66, z: 0.1, sy: 0.7, jit: 0.07, grad: [0.7, 1.05] });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 6.283 + (i % 2) * 0.2, r = 0.25 + (i % 3) * 0.06, len = 0.4 + (i % 4) * 0.08;
    g.box(0.025, len, 0.02, i % 2 ? 0x9aae62 : 0x819a52, { x: 0.05 + Math.sin(a) * r, y: 0.64 - len / 2 + 0.04, z: Math.cos(a) * r, rz: Math.sin(a) * 0.1, rx: Math.cos(a) * 0.1, grad: [0.75, 1.05] });
  }
  return g.build();
};
export const deadTreeGeo = (): THREE.BufferGeometry => new Geo(64)
  .cyl(0.035, 0.07, 0.8, 0x6a5e52, 5, { y: 0.4, rz: 0.08, grad: [0.6, 1] })
  .cyl(0.015, 0.03, 0.4, 0x6a5e52, 4, { x: 0.12, y: 0.62, rz: -0.9, grad: [0.8, 1] })
  .cyl(0.012, 0.026, 0.34, 0x6a5e52, 4, { x: -0.1, y: 0.7, rz: 0.8, grad: [0.8, 1] })
  .cyl(0.01, 0.02, 0.22, 0x6a5e52, 4, { x: 0.02, y: 0.88, z: 0.06, rx: 0.7, grad: [0.9, 1] })
  .build();

export const reedGeo = (tall = 1): THREE.BufferGeometry => {
  const g = new Geo(65);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, r = 0.03 + (i % 3) * 0.035, h = (0.6 + (i % 4) * 0.14) * tall;
    const lean = 0.05 + (i % 3) * 0.05;
    g.box(0.016, h, 0.01, i % 2 ? 0x8d9c52 : 0x768a45, { x: Math.sin(a) * r, y: h / 2, z: Math.cos(a) * r, rz: Math.cos(a) * lean, rx: -Math.sin(a) * lean, grad: [0.5, 1.1] });
    if (i % 3 === 0) g.cyl(0.016, 0.016, 0.1, 0x5e3f26, 5, { x: Math.sin(a) * r + Math.cos(a) * lean * h, y: h - 0.02, z: Math.cos(a) * r - Math.sin(a) * lean * h, rz: Math.cos(a) * lean, rx: -Math.sin(a) * lean, grad: [1, 1] });
  }
  return g.build();
};
export const lilyGeo = (flower: boolean): THREE.BufferGeometry => {
  const g = new Geo(66).cyl(0.12, 0.12, 0.012, 0x4f7a3a, 9, { y: 0.01, grad: [0.8, 1] }).cyl(0.07, 0.07, 0.014, 0x5f8d45, 8, { x: 0.04, y: 0.012, grad: [0.9, 1] });
  if (flower) g.ico(0.04, 0xf0b6cf, 0, { y: 0.045, sy: 0.8, grad: [0.8, 1.1] }).ico(0.025, 0xfff0a0, 0, { y: 0.06, grad: [1, 1] });
  return g.build();
};
export const tuftGeo = (tone = 0x7aa04a): THREE.BufferGeometry => new Geo(67)
  .cone(0.028, 0.2, tone, 3, { x: -0.03, y: 0.1, rz: 0.15, grad: [0.55, 1.05] })
  .cone(0.028, 0.26, tone, 3, { x: 0.02, y: 0.13, z: 0.02, rz: -0.12, grad: [0.55, 1.05] })
  .cone(0.028, 0.17, tone, 3, { z: -0.04, y: 0.085, rx: -0.2, grad: [0.55, 1.05] })
  .build();
export const shrubGeo = (tone = 0x58803f): THREE.BufferGeometry => new Geo(68)
  .ico(0.17, tone, 1, { y: 0.1, sy: 0.7, jit: 0.07, grad: [0.6, 1.05] })
  .ico(0.11, tone, 1, { x: 0.13, y: 0.08, z: 0.05, sy: 0.7, jit: 0.05, grad: [0.65, 1.05] })
  .build();
export const rockGeo = (big: boolean, tone = 0x8a8680): THREE.BufferGeometry => big
  ? new Geo(69).ico(0.5, tone, 1, { y: 0.2, sy: 0.85, jit: 0.2, grad: [0.55, 1] }).ico(0.3, tone, 1, { x: 0.38, y: 0.1, z: 0.2, jit: 0.12, grad: [0.55, 1] }).ico(0.22, tone, 1, { x: -0.3, y: 0.08, z: 0.28, jit: 0.1, grad: [0.55, 1] }).build()
  : new Geo(70).ico(0.17, tone, 1, { y: 0.07, sy: 0.7, jit: 0.07, grad: [0.62, 1] }).build();
export const snowMoundGeo = (): THREE.BufferGeometry => new Geo(71).ico(0.28, 0xf2f7fb, 1, { y: 0.0, sy: 0.4, jit: 0.05, grad: [0.88, 1] }).build();
export const flowerGeo = (): THREE.BufferGeometry => new Geo(72)
  .cyl(0.006, 0.006, 0.16, 0x5f8a3a, 3, { y: 0.08, grad: [1, 1] })
  .ico(0.032, 0xffffff, 0, { y: 0.17, sy: 0.7, grad: [0.9, 1.1] }).build();
export const barrelGeo = (): THREE.BufferGeometry => new Geo(73)
  .cyl(0.1, 0.09, 0.2, 0x8a5f3a, 9, { y: 0.1, grad: [0.7, 1] })
  .cyl(0.103, 0.103, 0.02, 0x3a2a20, 9, { y: 0.05, grad: [1, 1] }).cyl(0.103, 0.103, 0.02, 0x3a2a20, 9, { y: 0.16, grad: [1, 1] }).build();
export const crateGeo = (fish: boolean): THREE.BufferGeometry => {
  const g = new Geo(74).box(0.22, 0.14, 0.16, 0x9a7448, { y: 0.07, grad: [0.7, 1] }).box(0.23, 0.02, 0.17, 0x6b4a30, { y: 0.14, grad: [1, 1] });
  if (fish) for (let i = 0; i < 3; i++) g.ico(0.035, 0xb8c4cc, 0, { x: -0.06 + i * 0.06, y: 0.155, sx: 2.2, sy: 0.7, sz: 0.8, ry: 0.3 * i, grad: [0.8, 1.1] });
  return g.build();
};
export const hayGeo = (): THREE.BufferGeometry => new Geo(75)
  .cyl(0.21, 0.21, 0.46, 0xd6b45a, 10, { y: 0.21, rz: Math.PI / 2, grad: [0.7, 1] })
  .cyl(0.215, 0.215, 0.03, 0xb89868, 10, { y: 0.21, x: -0.1, rz: Math.PI / 2, grad: [1, 1] })
  .cyl(0.215, 0.215, 0.03, 0xb89868, 10, { y: 0.21, x: 0.1, rz: Math.PI / 2, grad: [1, 1] }).build();
export const fenceGeo = (tone = 0x8a6a45): THREE.BufferGeometry => new Geo(76)
  .box(0.05, 0.3, 0.05, tone, { x: -0.25, y: 0.15, grad: [0.7, 1] }).box(0.05, 0.3, 0.05, tone, { x: 0.25, y: 0.15, grad: [0.7, 1] })
  .box(0.54, 0.035, 0.03, tone, { y: 0.12, grad: [0.9, 1] }).box(0.54, 0.035, 0.03, tone, { y: 0.23, grad: [0.9, 1] }).build();
export const wallGeo = (): THREE.BufferGeometry => new Geo(77)
  .box(0.62, 0.26, 0.2, 0x8f8b84, { y: 0.1, jit: 0.02, grad: [0.62, 1] })
  .box(0.5, 0.08, 0.16, 0xa09b93, { y: 0.27, x: 0.04, jit: 0.02, grad: [0.8, 1] }).build();
export const wallSnowGeo = (): THREE.BufferGeometry => new Geo(78)
  .box(0.62, 0.26, 0.2, 0x8f8b84, { y: 0.1, jit: 0.02, grad: [0.62, 1] })
  .box(0.5, 0.08, 0.16, 0xa09b93, { y: 0.27, x: 0.04, jit: 0.02, grad: [0.8, 1] })
  .box(0.6, 0.04, 0.18, 0xf2f7fb, { y: 0.33, x: 0.02, jit: 0.01, grad: [1, 1] }).build();
export const cobbleGeo = (): THREE.BufferGeometry => new Geo(79).box(0.17, 0.04, 0.13, 0xb9ae9c, { y: 0.02, jit: 0.015, grad: [0.85, 1] }).build();

// ---------- bichos ----------
export const heronGeo = (pose: 0 | 1 | 2): THREE.BufferGeometry => {
  // pose 0: de pé; 1 e 2: voando (asas para cima e para baixo)
  const g = new Geo(80 + pose);
  const GREY = 0xcfd5d9, DK = 0x5a626a;
  if (pose === 0) {
    g.cyl(0.012, 0.012, 0.3, 0x6d6a4a, 4, { x: 0.01, y: 0.15, z: 0.02, grad: [1, 1] });
    g.cyl(0.012, 0.012, 0.3, 0x6d6a4a, 4, { x: -0.025, y: 0.15, z: -0.02, grad: [1, 1] });
    g.ico(0.07, GREY, 1, { y: 0.34, sx: 1.7, sy: 0.9, sz: 0.8, rz: 0.2, grad: [0.75, 1] });
    g.ico(0.05, DK, 0, { x: -0.1, y: 0.3, sx: 1.6, sy: 0.4, sz: 0.5, rz: 0.5, grad: [1, 1] });
    g.cyl(0.014, 0.02, 0.2, GREY, 5, { x: 0.1, y: 0.46, rz: -0.35, grad: [0.9, 1] });
    g.cyl(0.012, 0.014, 0.12, GREY, 5, { x: 0.15, y: 0.6, rz: 0.3, grad: [0.9, 1] });
    g.ico(0.024, GREY, 0, { x: 0.16, y: 0.67, sx: 1.4, grad: [1, 1] });
    g.cone(0.01, 0.12, 0xe0a83a, 4, { x: 0.25, y: 0.665, rz: -Math.PI / 2, grad: [1, 1] });
    g.box(0.1, 0.012, 0.012, DK, { x: 0.12, y: 0.69, rz: -0.2, grad: [1, 1] });
  } else {
    const a = pose === 1 ? 0.7 : -0.4;
    g.ico(0.06, GREY, 1, { sx: 1.8, sy: 0.8, sz: 0.8, grad: [0.8, 1] });
    g.cyl(0.012, 0.016, 0.18, GREY, 5, { x: 0.13, y: 0.04, rz: -1.1, grad: [1, 1] });
    g.ico(0.022, GREY, 0, { x: 0.2, y: 0.09, sx: 1.4, grad: [1, 1] });
    g.cone(0.009, 0.1, 0xe0a83a, 4, { x: 0.28, y: 0.09, rz: -Math.PI / 2, grad: [1, 1] });
    g.cyl(0.008, 0.008, 0.28, 0x6d6a4a, 3, { x: -0.22, y: -0.01, rz: Math.PI / 2, grad: [1, 1] });
    g.box(0.16, 0.01, 0.34, GREY, { x: -0.01, z: 0.18, rx: a, grad: [1, 1] });
    g.box(0.16, 0.01, 0.34, GREY, { x: -0.01, z: -0.18, rx: -a, grad: [1, 1] });
    g.box(0.1, 0.012, 0.12, DK, { x: -0.03, z: 0.36 * Math.cos(a), y: 0.36 * Math.sin(a) * 0.5, rx: a, grad: [1, 1] });
    g.box(0.1, 0.012, 0.12, DK, { x: -0.03, z: -0.36 * Math.cos(a), y: 0.36 * Math.sin(a) * 0.5, rx: -a, grad: [1, 1] });
  }
  return g.build();
};
export const goatGeo = (): THREE.BufferGeometry => {
  const W = 0xf1ece0, G = 0x6b6258;
  const g = new Geo(84)
    .ico(0.12, W, 1, { y: 0.24, sx: 1.55, sy: 0.85, sz: 0.78, grad: [0.72, 1] })
    .ico(0.075, W, 1, { x: 0.2, y: 0.31, sx: 0.95, sy: 1.1, grad: [0.85, 1] })
    .cone(0.04, 0.12, W, 5, { x: 0.28, y: 0.285, rz: -1.35, grad: [0.9, 1] })
    .cone(0.01, 0.1, G, 3, { x: 0.17, y: 0.42, z: 0.025, rz: 0.9, grad: [1, 1] })
    .cone(0.01, 0.1, G, 3, { x: 0.17, y: 0.42, z: -0.025, rz: 0.9, grad: [1, 1] })
    .cone(0.012, 0.07, W, 3, { x: 0.25, y: 0.21, rz: Math.PI, grad: [1, 1] })
    .cone(0.015, 0.06, W, 3, { x: -0.17, y: 0.3, rz: 1.9, grad: [1, 1] });
  for (const [x, z] of [[0.1, 0.05], [0.1, -0.05], [-0.1, 0.05], [-0.1, -0.05]]) g.cyl(0.012, 0.014, 0.17, G, 4, { x, y: 0.085, z, grad: [1, 1] });
  return g.build();
};
export const gullGeo = (pose: 0 | 1 | 2): THREE.BufferGeometry => {
  const g = new Geo(85 + pose).ico(0.045, 0xf6f6f2, 1, { sx: 1.9, sy: 0.85, sz: 0.85, grad: [0.85, 1] })
    .ico(0.03, 0xf6f6f2, 0, { x: 0.075, y: 0.02, grad: [1, 1] })
    .cone(0.012, 0.05, 0xe8a830, 4, { x: 0.12, y: 0.015, rz: -Math.PI / 2, grad: [1, 1] })
    .cone(0.02, 0.08, 0xe9e9e4, 3, { x: -0.1, rz: Math.PI / 2, grad: [1, 1] });
  if (pose === 0) {
    g.cyl(0.006, 0.006, 0.06, 0xe0a83a, 3, { y: -0.06, grad: [1, 1] });
    g.box(0.1, 0.01, 0.03, 0xb4b8bc, { x: -0.01, y: 0.02, z: 0.04, grad: [1, 1] }).box(0.1, 0.01, 0.03, 0xb4b8bc, { x: -0.01, y: 0.02, z: -0.04, grad: [1, 1] });
  } else {
    const a = pose === 1 ? 0.7 : -0.45;
    g.box(0.07, 0.008, 0.16, 0xe4e6e6, { z: 0.09, rx: a, grad: [1, 1] }).box(0.07, 0.008, 0.16, 0xe4e6e6, { z: -0.09, rx: -a, grad: [1, 1] });
    g.box(0.06, 0.009, 0.05, 0x3a3f46, { z: 0.18 * Math.cos(a), y: 0.09 * Math.sin(a), rx: a, grad: [1, 1] }).box(0.06, 0.009, 0.05, 0x3a3f46, { z: -0.18 * Math.cos(a), y: 0.09 * Math.sin(a), rx: -a, grad: [1, 1] });
  }
  return g.build();
};
export const birdGeo = (up: boolean): THREE.BufferGeometry => {
  const a = up ? 0.75 : -0.45;
  return new Geo(88)
    .ico(0.045, 0x2b3140, 1, { sx: 1.9, sy: 0.85, sz: 0.85, grad: [1, 1] })
    .ico(0.03, 0xeee6d6, 0, { x: 0.01, y: -0.02, sx: 1.6, sy: 0.6, grad: [1, 1] })
    .cone(0.022, 0.08, 0x2b3140, 3, { x: -0.1, rz: Math.PI / 2, grad: [1, 1] })
    .box(0.07, 0.008, 0.15, 0x333a4a, { z: 0.085, rx: a, grad: [1, 1] })
    .box(0.07, 0.008, 0.15, 0x333a4a, { z: -0.085, rx: -a, grad: [1, 1] }).build();
};
export const sheepGeo = (): THREE.BufferGeometry => new Geo(89)
  .ico(0.16, 0xfff9ee, 1, { y: 0.2, sx: 1.3, sy: 0.92, sz: 0.95, jit: 0.04, grad: [0.78, 1] })
  .ico(0.075, 0x4a403a, 1, { x: 0.21, y: 0.26, sx: 1.1, grad: [1, 1] })
  .cyl(0.014, 0.014, 0.12, 0x3b332e, 4, { x: 0.1, y: 0.06, z: 0.06, grad: [1, 1] }).cyl(0.014, 0.014, 0.12, 0x3b332e, 4, { x: 0.1, y: 0.06, z: -0.06, grad: [1, 1] })
  .cyl(0.014, 0.014, 0.12, 0x3b332e, 4, { x: -0.1, y: 0.06, z: 0.06, grad: [1, 1] }).cyl(0.014, 0.014, 0.12, 0x3b332e, 4, { x: -0.1, y: 0.06, z: -0.06, grad: [1, 1] }).build();
export const oxGeo = (): THREE.BufferGeometry => {
  const B = 0x8a6a48;
  const g = new Geo(90)
    .ico(0.14, B, 1, { y: 0.26, sx: 1.6, sy: 0.95, sz: 0.85, grad: [0.7, 1] })
    .ico(0.07, 0x7a5a3a, 1, { x: 0.1, y: 0.37, grad: [0.9, 1] })
    .ico(0.075, B, 1, { x: 0.26, y: 0.3, sx: 1.2, grad: [0.9, 1] })
    .cone(0.012, 0.09, 0xe9e0c8, 3, { x: 0.26, y: 0.39, z: 0.07, rz: 0.4, rx: 0.9, grad: [1, 1] })
    .cone(0.012, 0.09, 0xe9e0c8, 3, { x: 0.26, y: 0.39, z: -0.07, rz: 0.4, rx: -0.9, grad: [1, 1] });
  for (const [x, z] of [[0.12, 0.07], [0.12, -0.07], [-0.12, 0.07], [-0.12, -0.07]]) g.cyl(0.02, 0.022, 0.2, 0x4a3a2a, 5, { x, y: 0.1, z, grad: [1, 1] });
  return g.build();
};
export const wagonGeo = (): THREE.BufferGeometry => {
  const g = new Geo(91)
    .box(0.62, 0.06, 0.3, 0x6b4a30, { y: 0.17, grad: [0.8, 1] })
    .box(0.62, 0.1, 0.02, 0x7a5636, { y: 0.24, z: 0.15, grad: [1, 1] }).box(0.62, 0.1, 0.02, 0x7a5636, { y: 0.24, z: -0.15, grad: [1, 1] })
    .add(new THREE.CylinderGeometry(0.17, 0.17, 0.56, 10, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(0), 0xe9dfc4, { x: 0, y: 0.26, grad: [0.8, 1] })
    .box(0.62, 0.02, 0.04, 0xb3402b, { y: 0.45, grad: [1, 1] });
  for (const x of [-0.2, 0.2]) for (const z of [-0.17, 0.17]) g.cyl(0.1, 0.1, 0.03, 0x4a3320, 10, { x, y: 0.11, z, rx: Math.PI / 2, grad: [0.9, 1] });
  g.cyl(0.01, 0.01, 0.34, 0x4a3320, 4, { x: 0.46, y: 0.16, rz: Math.PI / 2, grad: [1, 1] });
  return g.build();
};
export const cartGeo = (): THREE.BufferGeometry => {
  const g = new Geo(92).box(0.34, 0.14, 0.24, 0x6a5a48, { y: 0.15, grad: [0.7, 1] })
    .box(0.4, 0.03, 0.28, 0x3e4651, { y: 0.23, grad: [1, 1] })
    .ico(0.11, 0x3e4651, 1, { y: 0.27, sx: 1.4, sy: 0.7, jit: 0.05, grad: [0.6, 1] })
    .ico(0.05, 0xc5a24e, 0, { x: 0.05, y: 0.31, jit: 0.02, grad: [0.9, 1.1] }).ico(0.04, 0xa07a3c, 0, { x: -0.07, y: 0.3, z: 0.04, jit: 0.02, grad: [0.9, 1.1] });
  for (const x of [-0.11, 0.11]) for (const z of [-0.13, 0.13]) g.cyl(0.05, 0.05, 0.02, 0x2a2e33, 8, { x, y: 0.06, z, rx: Math.PI / 2, grad: [1, 1] });
  return g.build();
};
export const railGeo = (): THREE.BufferGeometry => {
  const g = new Geo(93);
  for (const z of [-0.09, 0.09]) g.box(0.5, 0.025, 0.025, 0x6b7078, { y: 0.07, z, grad: [1, 1] });
  for (let i = 0; i < 3; i++) g.box(0.05, 0.03, 0.26, 0x5a4636, { x: -0.18 + i * 0.18, y: 0.03, grad: [0.8, 1] });
  return g.build();
};

// ---------- barcos ----------
function hullShape(L: number, W: number, stern = 0.7): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(L / 2, 0);
  s.quadraticCurveTo(L * 0.28, W / 2, -L * 0.1, W / 2);
  s.lineTo(-L / 2, W / 2 * stern);
  s.lineTo(-L / 2, -W / 2 * stern);
  s.lineTo(-L * 0.1, -W / 2);
  s.quadraticCurveTo(L * 0.28, -W / 2, L / 2, 0);
  return s;
}
function hull(L: number, W: number, H: number, stern = 0.7): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(hullShape(L, W, stern), { depth: H, bevelEnabled: false, curveSegments: 5 });
  g.rotateX(-Math.PI / 2);
  return g;
}
export const flatBoatGeo = (): THREE.BufferGeometry => new Geo(94)
  .add(hull(0.95, 0.24, 0.1, 0.8), 0x56604a, { y: 0.0, grad: [0.65, 1] })
  .add(hull(0.8, 0.17, 0.02, 0.8), 0x7a6648, { y: 0.095, grad: [1, 1] })
  .box(0.12, 0.012, 0.2, 0x8a7656, { x: -0.1, y: 0.115, grad: [1, 1] })
  .cyl(0.012, 0.012, 0.6, 0x6b5640, 4, { x: -0.42, y: 0.38, rz: 0.2, grad: [1, 1] })
  .cyl(0.012, 0.012, 0.22, 0x6b5640, 4, { x: 0.36, y: 0.2, grad: [1, 1] })
  .ico(0.045, 0xffd9a0, 0, { x: 0.36, y: 0.33, sy: 1.2, grad: [1, 1], glow: 2.6 })
  .ico(0.04, 0xd8c690, 0, { x: -0.05, y: 0.15, sx: 1.4, grad: [0.8, 1] }).build();
export const fishBoatGeo = (c1: number, c2: number): THREE.BufferGeometry => new Geo(95)
  .add(hull(1.1, 0.4, 0.2, 0.75), c1, { y: 0.0, grad: [0.6, 1] })
  .add(hull(1.12, 0.41, 0.045, 0.75), c2, { y: 0.14, grad: [1, 1] })
  .add(hull(0.9, 0.3, 0.02, 0.75), 0x8a6a48, { y: 0.19, grad: [1, 1] })
  .box(0.26, 0.2, 0.22, 0xf0e8d8, { x: -0.2, y: 0.3, grad: [0.8, 1] })
  .box(0.3, 0.03, 0.26, c1, { x: -0.2, y: 0.41, grad: [0.9, 1] })
  .box(0.1, 0.07, 0.02, DARK, { x: -0.07, y: 0.32, grad: [1, 1], glow: 1 })
  .cyl(0.014, 0.014, 0.6, 0x4a3a2a, 4, { x: 0.2, y: 0.5, grad: [1, 1] })
  .cyl(0.008, 0.008, 0.42, 0x4a3a2a, 3, { x: 0.12, y: 0.62, rz: 1.1, grad: [1, 1] })
  .ico(0.03, 0xffd9a0, 0, { x: 0.46, y: 0.28, sy: 1.2, grad: [1, 1], glow: 2.6 })
  .cyl(0.008, 0.008, 0.14, 0x4a3a2a, 3, { x: 0.46, y: 0.22, grad: [1, 1] }).build();
const DARK = 0x2a3b4c;
export const sailBoatGeo = (): THREE.BufferGeometry => {
  const g = new Geo(96).add(hull(0.9, 0.3, 0.14, 0.6), 0xf0e8d8, { grad: [0.7, 1] }).add(hull(0.92, 0.31, 0.03, 0.6), 0x2d70b2, { y: 0.11, grad: [1, 1] })
    .cyl(0.012, 0.012, 0.9, 0x6b4a30, 4, { x: 0.05, y: 0.55, grad: [1, 1] });
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([0.05, 0.12, 0.0, 0.05, 0.98, 0.0, -0.42, 0.14, 0.0], 3));
  tri.setIndex([0, 1, 2]);
  g.add(tri, 0xf6efe0, { grad: [0.85, 1] });
  const tri2 = new THREE.BufferGeometry();
  tri2.setAttribute('position', new THREE.Float32BufferAttribute([0.08, 0.12, 0.0, 0.08, 0.84, 0.0, 0.46, 0.14, 0.0], 3));
  tri2.setIndex([0, 1, 2]);
  g.add(tri2, 0xe0b04a, { grad: [0.85, 1] });
  return g.build();
};
export const rowBoatGeo = (): THREE.BufferGeometry => new Geo(97)
  .add(hull(0.6, 0.24, 0.1, 0.7), 0x9c4a2c, { grad: [0.65, 1] }).add(hull(0.5, 0.17, 0.02, 0.7), 0x8a6a48, { y: 0.095, grad: [1, 1] })
  .box(0.04, 0.012, 0.22, 0x6b4a30, { x: 0.02, y: 0.12, grad: [1, 1] }).build();

// ---------- feira e adereços ----------
export const stallGeo = (kind: 'fish' | 'ore' | 'reed'): THREE.BufferGeometry => {
  const aw: [number, number] = kind === 'fish' ? [0x2f78b6, 0xf4efe4] : kind === 'ore' ? [0x56606e, 0xb86a3a] : [0x6f8a46, 0xd2b75e];
  const g = new Geo(98 + (kind === 'fish' ? 0 : kind === 'ore' ? 1 : 2))
    .box(0.8, 0.3, 0.38, kind === 'ore' ? 0x5d5e60 : 0x7a5a3a, { y: 0.15, grad: [0.75, 1] })
    .box(0.84, 0.03, 0.42, 0x9a7448, { y: 0.31, grad: [1, 1] });
  for (const x of [-0.38, 0.38]) for (const z of [-0.17, 0.17]) g.box(0.03, 0.62, 0.03, 0x5b3b24, { x, y: 0.4, z, grad: [0.9, 1] });
  for (let k = 0; k < 7; k++) g.box(0.12, 0.025, 0.56, aw[k % 2], { x: -0.36 + k * 0.12, y: 0.72 - Math.abs(k - 3) * 0.0, z: 0.02, rx: -0.2, grad: [0.85, 1] });
  g.box(0.84, 0.05, 0.03, aw[0], { y: 0.66, z: 0.28, grad: [1, 1] });
  if (kind === 'fish') {
    for (let i = 0; i < 5; i++) g.ico(0.035, 0xaeb9c2, 0, { x: -0.28 + i * 0.13, y: 0.35, z: 0.05, sx: 2.3, sy: 0.7, sz: 0.8, ry: 0.2 * (i % 2 ? 1 : -1), grad: [0.8, 1.1] });
    g.box(0.18, 0.1, 0.14, 0x9a7448, { x: 0.28, y: 0.38, z: -0.05, grad: [0.8, 1] });
    for (let i = 0; i < 4; i++) g.cyl(0.006, 0.006, 0.12, 0x4a3a2a, 3, { x: -0.3 + i * 0.2, y: 0.6, z: 0.18, grad: [1, 1] });
    g.ico(0.03, 0xffd9a0, 0, { x: 0.32, y: 0.6, z: 0.2, grad: [1, 1], glow: 2.2 });
  } else if (kind === 'ore') {
    for (let i = 0; i < 6; i++) g.ico(0.05 + (i % 3) * 0.015, i % 2 ? 0x3e4651 : 0xb27a3a, 0, { x: -0.3 + i * 0.12, y: 0.37, z: 0.02 + (i % 2) * 0.05, jit: 0.03, grad: [0.7, 1.15] });
    g.box(0.1, 0.1, 0.1, 0x2a2e33, { x: 0.3, y: 0.38, z: -0.06, grad: [0.8, 1] });
    g.ico(0.03, 0xffd9a0, 0, { x: -0.32, y: 0.6, z: 0.2, grad: [1, 1], glow: 2.2 });
  } else {
    for (let i = 0; i < 3; i++) g.cyl(0.07, 0.06, 0.1, 0xa87c4a, 8, { x: -0.25 + i * 0.22, y: 0.37, z: 0.04, grad: [0.7, 1] });
    for (let i = 0; i < 4; i++) g.cyl(0.012, 0.012, 0.3, 0x8d9c52, 4, { x: 0.28 + i * 0.015, y: 0.45, z: -0.05 + i * 0.03, rz: 0.08 * (i - 2), grad: [0.7, 1.1] });
    g.ico(0.03, 0xffd9a0, 0, { x: 0.32, y: 0.6, z: 0.2, grad: [1, 1], glow: 2.2 });
  }
  return g.build();
};
export const bannerGeo = (c1: number, c2: number): THREE.BufferGeometry => new Geo(102)
  .cyl(0.014, 0.018, 1.0, 0x5a4636, 5, { y: 0.5, grad: [0.8, 1] })
  .box(0.28, 0.2, 0.012, c1, { x: 0.15, y: 0.88, grad: [0.85, 1] })
  .box(0.28, 0.05, 0.014, c2, { x: 0.15, y: 0.83, grad: [1, 1] })
  .ico(0.025, 0xc9a24a, 0, { y: 1.02, grad: [1, 1] }).build();
export const lampPostGeo = (): THREE.BufferGeometry => new Geo(103)
  .cyl(0.025, 0.04, 0.8, 0x2b2a2a, 6, { y: 0.4, grad: [0.8, 1] })
  .cyl(0.06, 0.06, 0.04, 0x2b2a2a, 6, { y: 0.02, grad: [1, 1] })
  .box(0.1, 0.12, 0.1, 0xffd9a0, { y: 0.88, grad: [1, 1], glow: 2.4 })
  .box(0.13, 0.025, 0.13, 0x2b2a2a, { y: 0.96, grad: [1, 1] })
  .cone(0.09, 0.09, 0x2b2a2a, 4, { y: 1.03, ry: Math.PI / 4, grad: [1, 1] }).build();
export const lanternPostGeo = (): THREE.BufferGeometry => new Geo(104)
  .cyl(0.028, 0.034, 0.7, 0x4e4034, 5, { y: 0.35, grad: [0.6, 1] })
  .box(0.2, 0.02, 0.02, 0x4e4034, { x: 0.08, y: 0.66, grad: [1, 1] })
  .cyl(0.004, 0.004, 0.06, 0x2a2a2a, 3, { x: 0.16, y: 0.63, grad: [1, 1] })
  .ico(0.045, 0xffd9a0, 0, { x: 0.16, y: 0.56, sy: 1.25, grad: [1, 1], glow: 2.6 })
  .cone(0.05, 0.04, 0x3a2a20, 5, { x: 0.16, y: 0.63, grad: [1, 1] }).build();
export const signGeo = (): THREE.BufferGeometry => new Geo(105)
  .cyl(0.02, 0.03, 0.6, 0x5a4636, 5, { y: 0.3, grad: [0.7, 1] })
  .box(0.26, 0.09, 0.02, 0xa07a4a, { x: 0.1, y: 0.52, rz: 0.05, grad: [1, 1] })
  .box(0.22, 0.08, 0.02, 0xa07a4a, { x: -0.08, y: 0.4, rz: -0.08, grad: [1, 1] }).build();
export const netRackGeo = (): THREE.BufferGeometry => {
  const g = new Geo(106);
  for (const x of [-0.5, 0.5]) g.cyl(0.025, 0.035, 0.78, 0x6b5640, 5, { x, y: 0.37, grad: [0.7, 1] });
  g.cyl(0.02, 0.02, 1.1, 0x6b5640, 5, { y: 0.7, rz: Math.PI / 2, grad: [1, 1] });
  // rede pendurada: grade fina com barriga
  for (let i = 0; i <= 8; i++) {
    const x = -0.46 + i * 0.115;
    g.box(0.008, 0.4, 0.008, 0xa89a6a, { x, y: 0.5 - (1 - Math.pow((i - 4) / 4, 2)) * 0.0, z: 0, grad: [0.6, 1] });
  }
  for (let j = 0; j < 5; j++) g.box(0.96, 0.008, 0.008, 0xa89a6a, { y: 0.34 + j * 0.085, z: 0, grad: [1, 1] });
  for (let i = 0; i < 4; i++) g.ico(0.022, 0xc9482f, 0, { x: -0.3 + i * 0.2, y: 0.32, z: 0.02, grad: [0.9, 1.1] });
  return g.build();
};
export const fishRackGeo = (): THREE.BufferGeometry => {
  const g = new Geo(107);
  for (const x of [-0.3, 0.3]) g.cyl(0.02, 0.025, 0.5, 0x6b5640, 5, { x, y: 0.25, grad: [0.7, 1] });
  g.cyl(0.014, 0.014, 0.66, 0x6b5640, 4, { y: 0.45, rz: Math.PI / 2, grad: [1, 1] });
  for (let i = 0; i < 5; i++) g.ico(0.03, 0xb4a88a, 0, { x: -0.22 + i * 0.11, y: 0.36, sx: 0.7, sy: 2.4, sz: 0.5, grad: [0.8, 1.1] });
  return g.build();
};
export const flakeGeo = (): THREE.BufferGeometry => new Geo(108).ico(0.03, 0xffffff, 0, { grad: [1, 1] }).build();
export const puffGeo = (): THREE.BufferGeometry => new Geo(109).ico(0.07, 0xffffff, 1, { jit: 0.02, grad: [0.85, 1] }).build();
export const lanternGeo = (): THREE.BufferGeometry => new Geo(110).ico(0.06, 0xffd9a0, 1, { sy: 1.2, grad: [1, 1], glow: 2.6 }).build();
export const bushBerryGeo = (): THREE.BufferGeometry => new Geo(111).ico(0.17, 0x4f7a3a, 1, { y: 0.1, sy: 0.7, jit: 0.06, grad: [0.6, 1.05] }).ico(0.03, 0xc43d78, 0, { x: 0.1, y: 0.2, grad: [1, 1] }).ico(0.03, 0xe08a3a, 0, { x: -0.08, y: 0.18, z: 0.08, grad: [1, 1] }).build();
export const roofGableGeo = gable;
