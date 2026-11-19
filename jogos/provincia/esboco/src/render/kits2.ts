// Kits novos da Província (a Ilha não tinha): moinho, catedral, muralha, portão, torre, ponte, carroça, barracas, vinhedo, montanha...
// Mesma regra dos kits da Ilha: cor por vértice, base em y = 0, unidades do hexágono de raio 1.
import * as THREE from 'three';
import { Geo, gable } from './geo';
import { PAL } from './palette';

const PI = Math.PI;
const SLATE = 0x4f7f86, SLATE_D = 0x3c656c;

export const windmillBody = (): THREE.BufferGeometry => new Geo(201)
  .cyl(0.26, 0.3, 0.14, PAL.stone, 8, { y: 0.07 })
  .cyl(0.17, 0.25, 0.78, PAL.cream, 8, { y: 0.53, grad: [0.8, 1.05] })
  .cyl(0.2, 0.2, 0.04, PAL.walnut, 8, { y: 0.52 })
  .cone(0.23, 0.3, PAL.clayDark, 8, { y: 1.07, grad: [0.8, 1.1] })
  .box(0.1, 0.18, 0.03, PAL.walnut, { y: 0.23, z: 0.265 })
  .box(0.07, 0.09, 0.03, PAL.walnut, { y: 0.75, z: 0.2 })
  .box(0.1, 0.05, 0.1, PAL.timber, { y: 0.93, z: 0.2 })
  .build();

/** Pás: a origem é o eixo; giram em torno de z. */
export const windmillBlades = (): THREE.BufferGeometry => {
  const g = new Geo(202);
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2;
    const dx = -Math.sin(a), dy = Math.cos(a);
    g.box(0.035, 0.82, 0.03, PAL.walnut, { x: dx * 0.41, y: dy * 0.41, rz: a, grad: [1, 1] });
    g.box(0.17, 0.4, 0.012, PAL.cream, { x: dx * 0.5 + Math.cos(a) * 0.1, y: dy * 0.5 + Math.sin(a) * 0.1, rz: a, z: 0.02, grad: [0.95, 1] });
  }
  g.cyl(0.05, 0.05, 0.1, PAL.walnut, 6, { rx: PI / 2, z: -0.02 });
  return g.build();
};

export const cathedral = (): THREE.BufferGeometry => {
  const g = new Geo(210);
  const roof = SLATE;
  g.box(1.34, 0.06, 1.5, PAL.stone, { y: 0.03 })
    .box(1.12, 0.04, 1.28, PAL.stoneDark, { y: 0.08 })
    // nave (ao longo de z) e transepto (ao longo de x)
    .box(0.46, 0.42, 1.12, PAL.cream, { y: 0.31, z: 0.0, grad: [0.82, 1] })
    .add(gable(0.54, 0.28, 1.14), roof, { y: 0.52, z: 0.0, grad: [0.85, 1.08] })
    .box(1.04, 0.38, 0.36, PAL.cream, { y: 0.29, z: -0.04, grad: [0.82, 1] })
    .add(gable(0.44, 0.26, 1.06), roof, { y: 0.48, z: -0.04, ry: PI / 2, grad: [0.85, 1.08] })
    // contrafortes
    ;
  for (const zz of [-0.36, -0.12, 0.12, 0.36]) for (const sx of [-1, 1]) g.box(0.06, 0.34, 0.07, PAL.stone, { x: 0.27 * sx, y: 0.25, z: zz, grad: [0.8, 1] });
  // torres da fachada (frente em +z)
  for (const sx of [-1, 1]) {
    g.box(0.24, 0.92, 0.24, PAL.cream, { x: 0.21 * sx, y: 0.5, z: 0.5, grad: [0.8, 1.05] })
      .box(0.27, 0.04, 0.27, PAL.stoneDark, { x: 0.21 * sx, y: 0.5, z: 0.5 })
      .box(0.2, 0.24, 0.2, PAL.cream, { x: 0.21 * sx, y: 1.06, z: 0.5, grad: [0.9, 1.05] })
      .cone(0.16, 0.52, SLATE_D, 4, { x: 0.21 * sx, y: 1.42, z: 0.5, ry: PI / 4, grad: [0.8, 1.12] })
      .ico(0.025, PAL.flameHot, 0, { x: 0.21 * sx, y: 1.7, z: 0.5, grad: [1, 1] });
  }
  // portal e rosácea
  g.box(0.16, 0.26, 0.04, PAL.walnut, { y: 0.19, z: 0.625 })
    .add(new THREE.CircleGeometry(0.1, 12), 0xffc15e, { y: 0.7, z: 0.576, grad: [1, 1] });
  // cruzeiro: torre central e a flecha alta (a maravilha)
  g.box(0.34, 0.5, 0.34, PAL.cream, { y: 0.77, z: -0.04, grad: [0.85, 1.05] })
    .box(0.38, 0.04, 0.38, PAL.stoneDark, { y: 1.04, z: -0.04 })
    .cyl(0.17, 0.2, 0.34, PAL.cream, 8, { y: 1.23, z: -0.04, grad: [0.9, 1.05] })
    .cyl(0.19, 0.19, 0.03, PAL.walnut, 8, { y: 1.41, z: -0.04 })
    .cone(0.19, 1.05, SLATE, 8, { y: 1.95, z: -0.04, grad: [0.78, 1.12] })
    .cyl(0.008, 0.008, 0.2, PAL.flameHot, 3, { y: 2.57, z: -0.04, grad: [1, 1] })
    .box(0.09, 0.012, 0.012, PAL.flameHot, { y: 2.6, z: -0.04, grad: [1, 1] })
    .ico(0.035, PAL.flameHot, 0, { y: 2.48, z: -0.04, grad: [1, 1] });
  for (const [x, z] of [[-0.14, -0.18], [0.14, -0.18], [-0.14, 0.1], [0.14, 0.1]] as Array<[number, number]>) g.cone(0.05, 0.22, SLATE_D, 4, { x, y: 1.14, z, ry: PI / 4 }).box(0.06, 0.2, 0.06, PAL.cream, { x, y: 0.99, z });
  return g.build();
};

/** Calçada redonda da praça. */
export const cobble = (): THREE.BufferGeometry => {
  const g = new Geo(211);
  g.cyl(1.55, 1.6, 0.04, PAL.stone, 28, { y: 0.02, grad: [0.9, 1] })
    .cyl(1.3, 1.3, 0.012, PAL.cream, 28, { y: 0.046, grad: [1, 1] })
    .cyl(1.12, 1.12, 0.012, PAL.stone, 28, { y: 0.05, grad: [1, 1] });
  return g.build();
};

export const wallSeg = (): THREE.BufferGeometry => {
  const g = new Geo(220);
  g.box(1.04, 0.08, 0.26, PAL.stoneDark, { y: 0.04 })
    .box(1.0, 0.44, 0.17, PAL.stone, { y: 0.3, grad: [0.8, 1.05] })
    .box(1.0, 0.04, 0.22, PAL.stoneDark, { y: 0.54 });
  for (let i = 0; i < 4; i++) g.box(0.15, 0.1, 0.22, PAL.stone, { x: -0.38 + i * 0.253, y: 0.61, grad: [0.9, 1.1] });
  return g.build();
};
export const wallTower = (): THREE.BufferGeometry => new Geo(221)
  .cyl(0.24, 0.27, 0.1, PAL.stoneDark, 8, { y: 0.05 })
  .cyl(0.19, 0.22, 0.78, PAL.stone, 8, { y: 0.47, grad: [0.78, 1.05] })
  .cyl(0.25, 0.22, 0.08, PAL.stoneDark, 8, { y: 0.88 })
  .cone(0.26, 0.36, PAL.clay, 8, { y: 1.14, grad: [0.8, 1.1] })
  .cyl(0.008, 0.008, 0.3, PAL.walnut, 3, { y: 1.45 })
  .add(new THREE.BoxGeometry(0.17, 0.08, 0.008), PAL.flame, { x: 0.09, y: 1.55, grad: [1, 1] })
  .box(0.05, 0.1, 0.02, PAL.walnut, { y: 0.2, z: 0.2 })
  .build();
/** Portão: duas torres e uma verga; a muralha corre ao longo de x e a passagem é ao longo de z. */
export const gate = (): THREE.BufferGeometry => {
  const g = new Geo(222);
  for (const sx of [-1, 1]) {
    g.cyl(0.2, 0.24, 0.9, PAL.stone, 8, { x: 0.38 * sx, y: 0.45, grad: [0.78, 1.05] })
      .cyl(0.26, 0.23, 0.08, PAL.stoneDark, 8, { x: 0.38 * sx, y: 0.94 })
      .cone(0.27, 0.38, PAL.clay, 8, { x: 0.38 * sx, y: 1.21, grad: [0.8, 1.1] })
      .cyl(0.008, 0.008, 0.3, PAL.walnut, 3, { x: 0.38 * sx, y: 1.55 })
      .add(new THREE.BoxGeometry(0.17, 0.08, 0.008), PAL.apple, { x: 0.38 * sx + 0.09, y: 1.65, grad: [1, 1] });
  }
  g.box(0.62, 0.2, 0.2, PAL.stone, { y: 0.66, grad: [0.85, 1.05] })
    .box(0.66, 0.04, 0.24, PAL.stoneDark, { y: 0.78 })
    .box(0.06, 0.4, 0.17, PAL.stone, { x: -0.21, y: 0.28 }).box(0.06, 0.4, 0.17, PAL.stone, { x: 0.21, y: 0.28 });
  for (let i = 0; i < 3; i++) g.box(0.12, 0.09, 0.2, PAL.stone, { x: -0.22 + i * 0.22, y: 0.85 });
  return g.build();
};

export const bridge = (): THREE.BufferGeometry => {
  const g = new Geo(230);
  const top = (x: number): number => 0.1 + 0.2 * Math.max(0, 1 - (x / 0.62) * (x / 0.62));
  // empena de pedra, com o arco aberto por baixo (duas faces)
  const sh = new THREE.Shape();
  sh.moveTo(-0.66, -0.1);
  sh.lineTo(-0.66, top(-0.66));
  for (let i = -6; i <= 6; i++) { const x = i * 0.11; sh.lineTo(x, top(x)); }
  sh.lineTo(0.66, top(0.66)); sh.lineTo(0.66, -0.1);
  const hole = new THREE.Path();
  hole.absarc(0, -0.05, 0.28, PI, 0, true);
  sh.holes.push(hole);
  for (const sz of [-1, 1]) {
    const e = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false, curveSegments: 10 });
    g.add(e, PAL.stone, { z: sz * 0.17 - 0.03, grad: [0.75, 1.05] });
  }
  for (let i = 0; i < 9; i++) {
    const x = -0.56 + i * 0.14, y = top(x) + 0.0;
    const slope = (top(x + 0.07) - top(x - 0.07)) / 0.14;
    g.box(0.16, 0.05, 0.34, PAL.timberLight, { x, y: y - 0.02, rz: Math.atan(slope), grad: [0.9, 1.05] });
    g.box(0.15, 0.07, 0.05, PAL.stoneDark, { x, y: y + 0.04, z: 0.19, rz: Math.atan(slope) });
    g.box(0.15, 0.07, 0.05, PAL.stoneDark, { x, y: y + 0.04, z: -0.19, rz: Math.atan(slope) });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box(0.07, 0.16, 0.07, PAL.stoneDark, { x: 0.64 * sx, y: 0.14, z: 0.19 * sz });
  return g.build();
};

const horse = (g: Geo, x: number): void => {
  const c = 0x7a4a2a, d = 0x4a2d1c;
  g.box(0.3, 0.13, 0.11, c, { x: x + 0.06, y: 0.24 })
    .box(0.1, 0.16, 0.08, c, { x: x + 0.24, y: 0.3, rz: -0.6 })
    .box(0.12, 0.07, 0.07, d, { x: x + 0.33, y: 0.38 })
    .box(0.03, 0.04, 0.02, d, { x: x + 0.26, y: 0.42, z: 0.025 })
    .box(0.03, 0.04, 0.02, d, { x: x + 0.26, y: 0.42, z: -0.025 })
    .box(0.07, 0.03, 0.03, d, { x: x - 0.12, y: 0.24, rz: 0.5 });
  for (const [dx, dz] of [[-0.07, 0.04], [-0.07, -0.04], [0.17, 0.04], [0.17, -0.04]] as Array<[number, number]>) g.box(0.035, 0.18, 0.035, d, { x: x + dx, y: 0.09, z: dz });
};
export const cart = (): THREE.BufferGeometry => {
  const g = new Geo(240);
  g.box(0.34, 0.05, 0.22, PAL.timber, { x: -0.12, y: 0.17 })
    .box(0.34, 0.07, 0.025, PAL.timberLight, { x: -0.12, y: 0.22, z: 0.1 })
    .box(0.34, 0.07, 0.025, PAL.timberLight, { x: -0.12, y: 0.22, z: -0.1 })
    .box(0.025, 0.07, 0.2, PAL.timberLight, { x: -0.28, y: 0.22 })
    .ico(0.12, 0xe0b94a, 1, { x: -0.13, y: 0.27, sy: 0.7, sx: 1.2, jit: 0.04, grad: [0.8, 1.05] })
    .box(0.3, 0.02, 0.02, PAL.walnut, { x: 0.14, y: 0.17, z: 0.06 })
    .box(0.3, 0.02, 0.02, PAL.walnut, { x: 0.14, y: 0.17, z: -0.06 });
  for (const sx of [-1, 1]) g.cyl(0.085, 0.085, 0.03, PAL.walnut, 8, { x: -0.12 + sx * 0.08, y: 0.085, z: 0.125, rx: PI / 2 }).cyl(0.085, 0.085, 0.03, PAL.walnut, 8, { x: -0.12 + sx * 0.08, y: 0.085, z: -0.125, rx: PI / 2 });
  horse(g, 0.3);
  return g.build();
};

const awning = (a: number, b: number, k: number): THREE.BufferGeometry => {
  const g = new Geo(250 + k);
  g.box(0.36, 0.05, 0.2, PAL.timber, { y: 0.17 })
    .box(0.03, 0.34, 0.03, PAL.walnut, { x: -0.16, y: 0.17, z: -0.07 }).box(0.03, 0.34, 0.03, PAL.walnut, { x: 0.16, y: 0.17, z: -0.07 })
    .box(0.03, 0.26, 0.03, PAL.walnut, { x: -0.16, y: 0.13, z: 0.08 }).box(0.03, 0.26, 0.03, PAL.walnut, { x: 0.16, y: 0.13, z: 0.08 });
  for (let i = 0; i < 6; i++) g.box(0.07, 0.015, 0.27, i % 2 ? b : a, { x: -0.178 + i * 0.07, y: 0.35, z: 0.0, rx: 0.32, grad: [1, 1.05] });
  g.box(0.36, 0.02, 0.025, a, { y: 0.31, z: 0.132 });
  const goods = [0xd9453d, 0xe8b24c, 0x74a84a];
  for (let i = 0; i < 5; i++) g.ico(0.03, goods[(i + k) % 3], 0, { x: -0.12 + i * 0.06, y: 0.225, z: 0.02 + (i % 2) * 0.03, grad: [1, 1] });
  g.cyl(0.05, 0.05, 0.08, PAL.timberLight, 6, { x: 0.27, y: 0.04, z: 0.04 });
  return g.build();
};
export const stallA = (): THREE.BufferGeometry => awning(PAL.apple, PAL.cream, 0);
export const stallB = (): THREE.BufferGeometry => awning(PAL.teal, PAL.cream, 1);
export const stallC = (): THREE.BufferGeometry => awning(PAL.mustard, PAL.cream, 2);
export const barrels = (): THREE.BufferGeometry => new Geo(255)
  .cyl(0.07, 0.07, 0.12, PAL.timber, 8, { x: 0, y: 0.06 }).cyl(0.07, 0.07, 0.12, PAL.timberLight, 8, { x: 0.15, y: 0.06, z: 0.04 }).cyl(0.07, 0.07, 0.12, PAL.timber, 8, { x: 0.07, y: 0.18, z: 0.02 })
  .box(0.2, 0.1, 0.16, PAL.timberLight, { x: -0.18, y: 0.05, z: 0.08, ry: 0.4 })
  .build();

export const vineyard = (): THREE.BufferGeometry => {
  const g = new Geo(260);
  g.cyl(0.88, 0.9, 0.035, 0x8b6e3e, 6, { y: 0.017, ry: PI / 6, grad: [0.8, 1] });
  for (let i = 0; i < 6; i++) {
    const z = (i - 2.5) * 0.22;
    const hw = Math.max(0.2, 0.84 - Math.abs(z) / 1.732 - 0.1);
    g.add(gable(0.1, 0.16, hw * 2), i % 2 ? PAL.leafA : PAL.leafB, { y: 0.03, z, ry: PI / 2, grad: [0.7, 1.1] });
    for (let k = 0; k < 4; k++) g.ico(0.028, k % 2 ? 0x7a2f86 : 0x5b2570, 0, { x: -hw * 0.6 + k * hw * 0.4, y: 0.2, z: z + 0.03, grad: [1, 1] });
    for (const sx of [-1, 1]) g.cyl(0.01, 0.01, 0.2, PAL.walnut, 3, { x: sx * hw * 0.92, y: 0.12, z });
  }
  return g.build();
};

export const mountain = (v: number): THREE.BufferGeometry => {
  const g = new Geo(270 + v);
  const rk = [PAL.rock, PAL.rockDark, 0x8f8b86];
  g.cone(0.62, 1.05, rk[0], 6, { x: -0.1, z: 0.0, y: 0.52 + 0.15 * v, jit: 0.1, grad: [0.55, 1.1] })
    .cone(0.44, 0.78, rk[1], 6, { x: 0.38, z: 0.22, y: 0.39, jit: 0.08, grad: [0.55, 1.1] })
    .cone(0.38, 0.62, rk[2], 6, { x: 0.12, z: -0.42, y: 0.31, jit: 0.07, grad: [0.55, 1.1] })
    .cone(0.2, 0.34, 0xf3f4f8, 6, { x: -0.1, z: 0.0, y: 1.0 + 0.15 * v, jit: 0.04, grad: [0.92, 1.1] })
    .cone(0.12, 0.2, 0xf3f4f8, 6, { x: 0.38, z: 0.22, y: 0.7, jit: 0.03, grad: [0.92, 1.1] });
  for (let k = 0; k < 4; k++) g.cone(0.12, 0.22, PAL.leafB, 5, { x: -0.55 + k * 0.1, z: 0.45 + (k % 2) * 0.1, y: 0.11, grad: [0.7, 1] });
  return g.build();
};

export const hay = (): THREE.BufferGeometry => new Geo(280)
  .cyl(0.15, 0.17, 0.12, 0xdcb24a, 7, { y: 0.06, grad: [0.8, 1.05] }).cone(0.16, 0.2, 0xe8c14d, 7, { y: 0.22, grad: [0.85, 1.1] }).build();

export const sheep = (): THREE.BufferGeometry => {
  const g = new Geo(281);
  g.ico(0.08, 0xf4f0e6, 1, { y: 0.12, sx: 1.2, jit: 0.03, grad: [0.8, 1.05] })
    .ico(0.045, 0x3b3532, 0, { x: 0.11, y: 0.14, grad: [1, 1] })
    .ico(0.05, 0xf4f0e6, 0, { x: -0.02, y: 0.19, jit: 0.02 });
  for (const [dx, dz] of [[-0.05, 0.035], [-0.05, -0.035], [0.05, 0.035], [0.05, -0.035]] as Array<[number, number]>) g.cyl(0.01, 0.01, 0.07, 0x3b3532, 3, { x: dx, y: 0.035, z: dz });
  return g.build();
};

export const campfire = (): THREE.BufferGeometry => {
  const g = new Geo(282);
  for (let k = 0; k < 6; k++) g.ico(0.04, PAL.stoneDark, 0, { x: Math.cos(k * 1.047) * 0.11, z: Math.sin(k * 1.047) * 0.11, y: 0.03, jit: 0.02 });
  g.cone(0.07, 0.15, PAL.flame, 5, { y: 0.1, grad: [1, 1] }).cone(0.04, 0.12, PAL.flameHot, 5, { y: 0.12, grad: [1, 1] });
  g.box(0.2, 0.03, 0.03, PAL.walnut, { y: 0.04, ry: 0.5 }).box(0.2, 0.03, 0.03, PAL.walnut, { y: 0.04, ry: -0.6 });
  return g.build();
};
export const logs = (): THREE.BufferGeometry => new Geo(283)
  .cyl(0.035, 0.035, 0.26, PAL.timber, 6, { y: 0.035, rz: PI / 2 }).cyl(0.035, 0.035, 0.26, PAL.timberLight, 6, { y: 0.035, z: 0.075, rz: PI / 2 }).cyl(0.035, 0.035, 0.26, PAL.timber, 6, { y: 0.1, z: 0.035, rz: PI / 2 }).build();

export const shrine = (): THREE.BufferGeometry => new Geo(284)
  .cyl(0.42, 0.46, 0.06, PAL.stoneDark, 7, { y: 0.03 })
  .box(0.3, 0.28, 0.3, PAL.cream, { y: 0.2, grad: [0.82, 1] })
  .add(gable(0.38, 0.2, 0.36), PAL.clayDark, { y: 0.34, ry: PI / 2, grad: [0.85, 1.08] })
  .box(0.1, 0.16, 0.02, PAL.walnut, { y: 0.14, z: 0.155 })
  .cone(0.03, 0.08, PAL.flame, 4, { y: 0.17, z: 0.0, x: 0.0, grad: [1, 1] })
  .box(0.012, 0.16, 0.012, PAL.flameHot, { y: 0.62 }).box(0.07, 0.012, 0.012, PAL.flameHot, { y: 0.65 })
  .cone(0.07, 0.3, PAL.leafB, 6, { x: -0.38, z: 0.1, y: 0.2 }).cone(0.07, 0.3, PAL.leafA, 6, { x: 0.4, z: -0.05, y: 0.2 })
  .build();

export const cabinRoofless = (): THREE.BufferGeometry => new Geo(285).box(0.1, 0.1, 0.1, 0xffffff).build();

/** Lampião de rua: poste curto, com o vidro à parte (o vidro brilha à noite). */
export const lampPost = (): THREE.BufferGeometry => new Geo(286)
  .cyl(0.04, 0.06, 0.06, PAL.stoneDark, 6, { y: 0.03 })
  .cyl(0.014, 0.022, 0.78, PAL.walnut, 6, { y: 0.43 })
  .cyl(0.07, 0.05, 0.03, PAL.walnut, 6, { y: 0.83 })
  .cone(0.09, 0.08, 0x2c4a55, 6, { y: 1.02, grad: [0.8, 1.1] })
  .build();
export const lampGlass = (): THREE.BufferGeometry => new Geo(287).ico(0.052, PAL.flameHot, 1, { y: 0.9, sy: 1.3, grad: [1, 1] }).build();

export const treeSolo = (): THREE.BufferGeometry => new Geo(288)
  .cyl(0.03, 0.04, 0.2, PAL.timber, 5, { y: 0.1 }).ico(0.2, PAL.leafA, 1, { y: 0.36, sy: 0.9, jit: 0.08, grad: [0.65, 1.05] }).build();

/** Pássaro: corpo e duas asas (cada asa gira em torno da raiz). */
export const birdBody = (): THREE.BufferGeometry => new Geo(290).cone(0.03, 0.14, 0x3a3430, 5, { rx: PI / 2, grad: [1, 1] }).ico(0.025, 0x3a3430, 0, { z: 0.07, y: 0.008, grad: [1, 1] }).build();
export const birdWing = (side: number): THREE.BufferGeometry => {
  const g = new THREE.BufferGeometry();
  const s = side;
  const v = new Float32Array([0, 0, 0.04, s * 0.2, 0.02, -0.03, 0, 0, -0.05, 0, 0, 0.04, 0, 0, -0.05, s * 0.2, 0.02, -0.03]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(18).fill(0.18), 3));
  g.computeVertexNormals();
  return g;
};

/** Farol: feixe (cone aberto, aditivo). */
export const beam = (): THREE.BufferGeometry => {
  const g = new THREE.ConeGeometry(0.3, 4, 14, 1, true);
  g.rotateX(-PI / 2);
  g.translate(0, 0, 2);
  return g;
};
