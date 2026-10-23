// Kits de geometria da vila, todos gerados em código (low-poly facetado com cor por vértice).
// Convenção das casas: frente em +z, origem no chão, cumeeira ao longo de x.
import * as THREE from 'three';
import { Geo, gable } from './geo';

export interface HouseKit {
  wall: THREE.BufferGeometry; roof: THREE.BufferGeometry; snow: THREE.BufferGeometry; win: THREE.BufferGeometry;
  /** y do beiral: a neve nasce dali. */
  roofY: number;
  chimney: THREE.Vector3;
  /** Janelas da frente (para o brilho noturno), em coordenadas locais. */
  winPts: THREE.Vector3[];
  radius: number;
}

const WOOD = 0x5b3b24, FRAME = 0x6b4a30, STONE = 0x9a8f84;

export function cottageKit(): HouseKit {
  const W = 1.0, D = 0.76, H = 0.5, RH = 0.42;
  const wall = new Geo(11)
    .box(W + 0.06, 0.1, D + 0.06, STONE, { y: 0.05, grad: [0.7, 0.95] })
    .box(W, H - 0.1, D, 0xfff8ec, { y: 0.1 + (H - 0.1) / 2, grad: [0.82, 1] })
    .box(0.2, 0.33, 0.04, WOOD, { x: 0.2, y: 0.265, z: D / 2 + 0.005, grad: [1, 1] })
    .box(0.24, 0.05, 0.07, WOOD, { x: 0.2, y: 0.45, z: D / 2 + 0.02, grad: [1, 1] })
    .box(0.21, 0.23, 0.02, FRAME, { x: -0.27, y: 0.32, z: D / 2 + 0.004, grad: [1, 1] })
    .box(0.21, 0.23, 0.02, FRAME, { x: -0.27, y: 0.32, z: -D / 2 - 0.004, grad: [1, 1] })
    .box(0.02, 0.23, 0.21, FRAME, { x: W / 2 + 0.004, y: 0.32, z: 0.05, grad: [1, 1] })
    .box(0.02, 0.23, 0.21, FRAME, { x: -W / 2 - 0.004, y: 0.32, z: 0.05, grad: [1, 1] })
    .box(0.13, 0.62, 0.13, 0xa88672, { x: -0.3, y: H + 0.2, z: -0.1, grad: [0.75, 1] })
    .box(0.18, 0.045, 0.18, 0x7e6858, { x: -0.3, y: H + 0.52, z: -0.1, grad: [1, 1] })
    .build();
  const roof = new Geo(12).add(gable(D + 0.18, RH, W + 0.24), 0xffffff, { ry: Math.PI / 2, y: H - 0.02, grad: [0.74, 1] }).build();
  const snow = new Geo(13).add(gable(D + 0.24, RH + 0.05, W + 0.3), 0xf7fbff, { ry: Math.PI / 2, y: 0.015, grad: [0.9, 1], jit: 0.012 }).build();
  const win = new Geo(14)
    .box(0.15, 0.17, 0.02, 0xffffff, { x: -0.27, y: 0.32, z: D / 2 + 0.014, grad: [1, 1] })
    .box(0.15, 0.17, 0.02, 0xffffff, { x: -0.27, y: 0.32, z: -D / 2 - 0.014, grad: [1, 1] })
    .box(0.02, 0.17, 0.15, 0xffffff, { x: W / 2 + 0.014, y: 0.32, z: 0.05, grad: [1, 1] })
    .box(0.02, 0.17, 0.15, 0xffffff, { x: -W / 2 - 0.014, y: 0.32, z: 0.05, grad: [1, 1] })
    .build();
  return { wall, roof, snow, win, roofY: H - 0.02, chimney: new THREE.Vector3(-0.3, H + 0.6, -0.1), winPts: [new THREE.Vector3(-0.27, 0.32, D / 2 + 0.1)], radius: 0.75 };
}

export function houseKit(): HouseKit {
  const W = 1.05, D = 0.82, H = 0.95, RH = 0.5;
  const wall = new Geo(21)
    .box(W + 0.07, 0.1, D + 0.07, STONE, { y: 0.05, grad: [0.7, 0.95] })
    .box(W, 0.46, D, 0xfff8ec, { y: 0.33, grad: [0.8, 1] })
    .box(W + 0.07, 0.05, D + 0.07, WOOD, { y: 0.58, grad: [1, 1] })
    .box(W + 0.05, 0.37, D + 0.05, 0xfff3de, { y: 0.785, grad: [0.88, 1] })
    // enxaimel
    .box(0.04, 0.37, 0.03, WOOD, { x: -W / 2 - 0.01, y: 0.785, z: D / 2 + 0.03, grad: [1, 1] })
    .box(0.04, 0.37, 0.03, WOOD, { x: W / 2 + 0.01, y: 0.785, z: D / 2 + 0.03, grad: [1, 1] })
    .box(0.03, 0.37, 0.03, WOOD, { x: 0, y: 0.785, z: D / 2 + 0.03, grad: [1, 1] })
    .box(0.2, 0.34, 0.04, WOOD, { x: 0, y: 0.27, z: D / 2 + 0.005, grad: [1, 1] })
    .box(0.26, 0.05, 0.08, WOOD, { x: 0, y: 0.46, z: D / 2 + 0.02, grad: [1, 1] })
    .box(0.21, 0.23, 0.02, FRAME, { x: -0.32, y: 0.34, z: D / 2 + 0.004, grad: [1, 1] })
    .box(0.21, 0.23, 0.02, FRAME, { x: 0.32, y: 0.34, z: D / 2 + 0.004, grad: [1, 1] })
    .box(0.2, 0.22, 0.02, FRAME, { x: -0.3, y: 0.8, z: D / 2 + 0.03, grad: [1, 1] })
    .box(0.2, 0.22, 0.02, FRAME, { x: 0.3, y: 0.8, z: D / 2 + 0.03, grad: [1, 1] })
    .box(0.02, 0.22, 0.2, FRAME, { x: W / 2 + 0.03, y: 0.8, z: 0, grad: [1, 1] })
    .box(0.02, 0.22, 0.2, FRAME, { x: -W / 2 - 0.03, y: 0.8, z: 0, grad: [1, 1] })
    .box(0.14, 0.7, 0.14, 0xa88672, { x: 0.3, y: H + 0.2, z: -0.12, grad: [0.75, 1] })
    .box(0.19, 0.05, 0.19, 0x7e6858, { x: 0.3, y: H + 0.57, z: -0.12, grad: [1, 1] })
    // puxadinho com telhado baixo
    .box(0.55, 0.44, 0.62, 0xfff8ec, { x: W / 2 + 0.2, y: 0.22, z: 0.06, grad: [0.8, 1] })
    .box(0.17, 0.2, 0.02, FRAME, { x: W / 2 + 0.2, y: 0.28, z: 0.06 + 0.31 + 0.004, grad: [1, 1] })
    .build();
  const roof = new Geo(22)
    .add(gable(D + 0.2, RH, W + 0.26), 0xffffff, { ry: Math.PI / 2, y: H - 0.04, grad: [0.74, 1] })
    .add(gable(0.62 + 0.14, 0.3, 0.55 + 0.14), 0xffffff, { ry: Math.PI / 2, x: W / 2 + 0.2, y: 0.42, z: 0.06, grad: [0.74, 1] })
    .build();
  const snow = new Geo(23)
    .add(gable(D + 0.26, RH + 0.05, W + 0.32), 0xf7fbff, { ry: Math.PI / 2, y: 0.015, grad: [0.9, 1], jit: 0.012 })
    .build();
  // a neve do puxadinho vem junto, deslocada para o seu beiral
  const snow2 = new Geo(24)
    .add(gable(D + 0.26, RH + 0.05, W + 0.32), 0xf7fbff, { ry: Math.PI / 2, y: 0.015, grad: [0.9, 1], jit: 0.012 })
    .add(gable(0.62 + 0.2, 0.3 + 0.045, 0.55 + 0.2), 0xf7fbff, { ry: Math.PI / 2, x: W / 2 + 0.2, y: 0.42 - (H - 0.04) + 0.015, z: 0.06, grad: [0.9, 1], jit: 0.01 })
    .build();
  snow.dispose();
  const win = new Geo(25)
    .box(0.15, 0.17, 0.02, 0xffffff, { x: -0.32, y: 0.34, z: D / 2 + 0.014, grad: [1, 1] })
    .box(0.15, 0.17, 0.02, 0xffffff, { x: 0.32, y: 0.34, z: D / 2 + 0.014, grad: [1, 1] })
    .box(0.14, 0.16, 0.02, 0xffffff, { x: -0.3, y: 0.8, z: D / 2 + 0.044, grad: [1, 1] })
    .box(0.14, 0.16, 0.02, 0xffffff, { x: 0.3, y: 0.8, z: D / 2 + 0.044, grad: [1, 1] })
    .box(0.02, 0.16, 0.14, 0xffffff, { x: W / 2 + 0.044, y: 0.8, z: 0, grad: [1, 1] })
    .box(0.02, 0.16, 0.14, 0xffffff, { x: -W / 2 - 0.044, y: 0.8, z: 0, grad: [1, 1] })
    .box(0.13, 0.14, 0.02, 0xffffff, { x: W / 2 + 0.2, y: 0.28, z: 0.06 + 0.31 + 0.014, grad: [1, 1] })
    .build();
  return {
    wall, roof, snow: snow2, win, roofY: H - 0.04, chimney: new THREE.Vector3(0.3, H + 0.65, -0.12),
    winPts: [new THREE.Vector3(-0.32, 0.34, D / 2 + 0.1), new THREE.Vector3(0.32, 0.34, D / 2 + 0.1), new THREE.Vector3(-0.3, 0.8, D / 2 + 0.13), new THREE.Vector3(0.3, 0.8, D / 2 + 0.13)],
    radius: 0.95,
  };
}

// --- vegetação ---
export const trunkGeo = (): THREE.BufferGeometry => new Geo(31)
  .cyl(0.04, 0.075, 0.5, 0x6b4a2e, 6, { y: 0.25, grad: [0.7, 1] })
  .cyl(0.018, 0.034, 0.3, 0x6b4a2e, 5, { x: 0.075, y: 0.56, rz: -0.62, grad: [0.85, 1] })
  .cyl(0.018, 0.034, 0.3, 0x6b4a2e, 5, { x: -0.075, y: 0.56, rz: 0.62, grad: [0.85, 1] })
  .cyl(0.012, 0.022, 0.2, 0x6b4a2e, 4, { x: 0.01, y: 0.66, z: 0.04, rx: 0.45, grad: [0.9, 1] })
  .build();

export const canopyGeo = (): THREE.BufferGeometry => new Geo(32).ico(0.36, 0xffffff, 1, { jit: 0.1, grad: [0.62, 1] }).build();

export const pineGeo = (): THREE.BufferGeometry => new Geo(33)
  .cyl(0.04, 0.06, 0.25, 0x6d5444, 5, { y: 0.12, grad: [0.8, 1] })
  .cone(0.4, 0.55, 0xffffff, 7, { y: 0.45, grad: [0.62, 1], jit: 0.04 })
  .cone(0.31, 0.5, 0xffffff, 7, { y: 0.78, grad: [0.68, 1], jit: 0.04 })
  .cone(0.21, 0.45, 0xffffff, 7, { y: 1.08, grad: [0.72, 1], jit: 0.03 })
  .build();

export const wheatGeo = (): THREE.BufferGeometry => new Geo(34)
  .box(0.022, 0.4, 0.022, 0xffffff, { x: -0.05, y: 0.2, z: 0.02, rz: 0.06, grad: [0.55, 1] })
  .box(0.022, 0.43, 0.022, 0xffffff, { x: 0.04, y: 0.215, z: -0.03, rz: -0.05, grad: [0.55, 1] })
  .box(0.022, 0.38, 0.022, 0xffffff, { x: 0.0, y: 0.19, z: 0.06, rx: -0.05, grad: [0.55, 1] })
  .box(0.045, 0.12, 0.045, 0xffffff, { x: -0.06, y: 0.43, z: 0.02, rz: 0.06, grad: [0.9, 1.1] })
  .box(0.045, 0.13, 0.045, 0xffffff, { x: 0.05, y: 0.47, z: -0.03, rz: -0.05, grad: [0.9, 1.1] })
  .box(0.045, 0.11, 0.045, 0xffffff, { x: 0.0, y: 0.41, z: 0.065, rx: -0.05, grad: [0.9, 1.1] })
  .build();

export const tuftGeo = (): THREE.BufferGeometry => new Geo(35)
  .cone(0.028, 0.2, 0xffffff, 3, { x: -0.03, y: 0.1, rz: 0.15, grad: [0.55, 1.05] })
  .cone(0.028, 0.26, 0xffffff, 3, { x: 0.02, y: 0.13, z: 0.02, rz: -0.12, grad: [0.55, 1.05] })
  .cone(0.028, 0.17, 0xffffff, 3, { x: 0.0, y: 0.085, z: -0.04, rx: -0.2, grad: [0.55, 1.05] })
  .build();

export const bloomGeo = (): THREE.BufferGeometry => new Geo(36).ico(0.05, 0xffffff, 0, { y: 0.27, sy: 0.7, grad: [0.85, 1.1] }).build();

export const pumpkinGeo = (): THREE.BufferGeometry => new Geo(37)
  .ico(0.14, 0xffffff, 1, { y: 0.1, sy: 0.78, grad: [0.6, 1] })
  .cyl(0.018, 0.026, 0.07, 0x7f8a45, 5, { y: 0.215, grad: [1, 1] })
  .build();

export const hayGeo = (): THREE.BufferGeometry => new Geo(38)
  .cyl(0.21, 0.21, 0.46, 0xffffff, 10, { y: 0.21, rz: Math.PI / 2, grad: [0.7, 1] })
  .cyl(0.215, 0.215, 0.03, 0xb89868, 10, { y: 0.21, x: -0.1, rz: Math.PI / 2, grad: [1, 1] })
  .cyl(0.215, 0.215, 0.03, 0xb89868, 10, { y: 0.21, x: 0.1, rz: Math.PI / 2, grad: [1, 1] })
  .build();

export const appleGeo = (): THREE.BufferGeometry => new Geo(39).ico(0.045, 0xffffff, 0, { grad: [0.8, 1.05] }).build();

export const rockGeo = (): THREE.BufferGeometry => new Geo(40).ico(0.17, 0xffffff, 1, { y: 0.07, sy: 0.7, jit: 0.07, grad: [0.62, 1] }).build();

export const fenceGeo = (): THREE.BufferGeometry => new Geo(41)
  .box(0.05, 0.3, 0.05, 0xffffff, { x: -0.25, y: 0.15, grad: [0.7, 1] })
  .box(0.05, 0.3, 0.05, 0xffffff, { x: 0.25, y: 0.15, grad: [0.7, 1] })
  .box(0.54, 0.035, 0.03, 0xffffff, { y: 0.12, z: 0.0, grad: [0.9, 1] })
  .box(0.54, 0.035, 0.03, 0xffffff, { y: 0.23, z: 0.0, grad: [0.9, 1] })
  .build();

export const sheepGeo = (): THREE.BufferGeometry => new Geo(42)
  .ico(0.16, 0xfff9ee, 1, { y: 0.2, sx: 1.3, sy: 0.92, sz: 0.95, jit: 0.04, grad: [0.78, 1] })
  .ico(0.075, 0x4a403a, 1, { x: 0.21, y: 0.26, sx: 1.1, grad: [1, 1] })
  .box(0.03, 0.05, 0.1, 0x4a403a, { x: 0.19, y: 0.3, grad: [1, 1] })
  .cyl(0.014, 0.014, 0.12, 0x3b332e, 4, { x: 0.1, y: 0.06, z: 0.06, grad: [1, 1] })
  .cyl(0.014, 0.014, 0.12, 0x3b332e, 4, { x: 0.1, y: 0.06, z: -0.06, grad: [1, 1] })
  .cyl(0.014, 0.014, 0.12, 0x3b332e, 4, { x: -0.1, y: 0.06, z: 0.06, grad: [1, 1] })
  .cyl(0.014, 0.014, 0.12, 0x3b332e, 4, { x: -0.1, y: 0.06, z: -0.06, grad: [1, 1] })
  .build();

export const birdGeo = (up: boolean): THREE.BufferGeometry => {
  const a = up ? 0.75 : -0.45;
  return new Geo(43)
    .ico(0.045, 0x2b3140, 1, { sx: 1.9, sy: 0.85, sz: 0.85, grad: [1, 1] })
    .ico(0.03, 0xeee6d6, 0, { x: 0.01, y: -0.02, sx: 1.6, sy: 0.6, grad: [1, 1] })
    .cone(0.022, 0.08, 0x2b3140, 3, { x: -0.1, rz: Math.PI / 2, grad: [1, 1] })
    .box(0.07, 0.008, 0.15, 0x333a4a, { x: 0, y: 0.0, z: 0.085, rx: a, grad: [1, 1] })
    .box(0.07, 0.008, 0.15, 0x333a4a, { x: 0, y: 0.0, z: -0.085, rx: -a, grad: [1, 1] })
    .build();
};

export const cloudGeo = (): THREE.BufferGeometry => new Geo(44)
  .ico(0.5, 0xffffff, 1, { x: 0, y: 0, sy: 0.62, jit: 0.07, grad: [0.78, 1] })
  .ico(0.38, 0xffffff, 1, { x: 0.5, y: -0.04, sy: 0.6, jit: 0.07, grad: [0.78, 1] })
  .ico(0.4, 0xffffff, 1, { x: -0.5, y: -0.06, sy: 0.58, jit: 0.07, grad: [0.78, 1] })
  .ico(0.34, 0xffffff, 1, { x: 0.15, y: 0.2, sy: 0.7, jit: 0.07, grad: [0.85, 1] })
  .build();

export const lampPoleGeo = (): THREE.BufferGeometry => new Geo(45)
  .cyl(0.03, 0.045, 0.9, 0x2b2a2a, 6, { y: 0.45, grad: [0.8, 1] })
  .cyl(0.07, 0.07, 0.04, 0x2b2a2a, 6, { y: 0.02, grad: [1, 1] })
  .box(0.13, 0.03, 0.13, 0x2b2a2a, { y: 0.93, grad: [1, 1] })
  .cone(0.1, 0.1, 0x2b2a2a, 4, { y: 1.12, ry: Math.PI / 4, grad: [1, 1] })
  .build();
export const lampHeadGeo = (): THREE.BufferGeometry => new Geo(46).box(0.09, 0.13, 0.09, 0xffffff, { y: 1.0, grad: [1, 1] }).build();

export const puffGeo = (): THREE.BufferGeometry => new Geo(47).ico(0.07, 0xffffff, 1, { jit: 0.02, grad: [0.85, 1] }).build();
export const lanternGeo = (): THREE.BufferGeometry => new Geo(48).ico(0.07, 0xffffff, 1, { sy: 1.2, grad: [1, 1] }).build();
export const cobbleGeo = (): THREE.BufferGeometry => new Geo(49).box(0.17, 0.04, 0.13, 0xffffff, { y: 0.02, jit: 0.015, grad: [0.85, 1] }).build();

// --- peças soltas (uma malha cada) ---
export function millTowerGeo(): THREE.BufferGeometry {
  return new Geo(51)
    .cyl(0.5, 0.58, 0.18, 0x8a8076, 10, { y: 0.09, grad: [0.7, 1] })
    .cyl(0.36, 0.5, 1.5, 0xf2e8d4, 10, { y: 0.93, grad: [0.78, 1] })
    .cyl(0.4, 0.4, 0.05, 0x6b4a30, 10, { y: 1.5, grad: [1, 1] })
    .cone(0.46, 0.55, 0x9c4a30, 10, { y: 1.8, grad: [0.75, 1] })
    .box(0.2, 0.36, 0.05, 0x5b3b24, { y: 0.36, z: 0.51, grad: [1, 1] })
    .box(0.14, 0.18, 0.04, 0x5b3b24, { y: 1.05, z: 0.4, grad: [1, 1] })
    .box(0.14, 0.18, 0.04, 0x5b3b24, { y: 1.05, z: -0.4, grad: [1, 1] })
    .cyl(0.04, 0.04, 0.28, 0x3a2a20, 6, { y: 1.62, z: 0.4, rx: Math.PI / 2, grad: [1, 1] })
    .build();
}
export function millBladesGeo(): THREE.BufferGeometry {
  const g = new Geo(52).cyl(0.07, 0.07, 0.12, 0x3a2a20, 6, { rx: Math.PI / 2, grad: [1, 1] });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const c = Math.cos(a), s = Math.sin(a);
    g.box(0.05, 1.35, 0.04, 0x5b3b24, { x: -s * 0.68, y: c * 0.68, rz: a, grad: [1, 1] });
    // tela da pá: placa ao lado do braço
    const ox = c * 0.16, oy = s * 0.16;
    g.box(0.2, 0.82, 0.012, 0xe9dcc0, { x: -s * 0.72 + ox, y: c * 0.72 + oy, z: 0.025, rz: a, grad: [0.9, 1] });
  }
  return g.build();
}

export function wellGeo(): THREE.BufferGeometry {
  return new Geo(53)
    .cyl(0.34, 0.37, 0.3, 0x9d958a, 10, { y: 0.15, grad: [0.7, 1] })
    .cyl(0.27, 0.27, 0.02, 0x2d5c78, 10, { y: 0.29, grad: [1, 1] })
    .box(0.05, 0.62, 0.05, 0x5b3b24, { x: -0.3, y: 0.58, grad: [1, 1] })
    .box(0.05, 0.62, 0.05, 0x5b3b24, { x: 0.3, y: 0.58, grad: [1, 1] })
    .add(gable(0.8, 0.24, 0.5), 0x9c4a30, { y: 0.85, ry: Math.PI / 2, grad: [0.8, 1] })
    .cyl(0.015, 0.015, 0.6, 0x3a2a20, 4, { y: 0.74, rz: Math.PI / 2, grad: [1, 1] })
    .cyl(0.05, 0.04, 0.07, 0x7a5a3a, 6, { x: 0.05, y: 0.5, grad: [1, 1] })
    .build();
}

/** Marco da praça (ano 3): bacia de fonte, torre do relógio, bancos e barracas. Origem no centro da praça. */
export function plazaGeo(): THREE.BufferGeometry {
  const g = new Geo(54)
    // bacia
    .cyl(1.0, 1.04, 0.28, 0xb9b0a2, 14, { y: 0.14, grad: [0.72, 1] })
    .cyl(0.86, 0.86, 0.04, 0x3f7f9a, 14, { y: 0.27, grad: [1, 1] })
    .cyl(0.98, 0.98, 0.05, 0xd2c9ba, 14, { y: 0.3, grad: [1, 1] })
    // torre
    .cyl(0.55, 0.62, 0.14, 0xa59c8e, 4, { y: 0.35, ry: Math.PI / 4, grad: [0.8, 1] })
    .box(0.52, 1.5, 0.52, 0xe6dccb, { y: 1.16, grad: [0.78, 1] })
    .box(0.62, 0.1, 0.62, 0xa59c8e, { y: 1.95, grad: [1, 1] })
    .box(0.58, 0.55, 0.58, 0xe6dccb, { y: 2.27, grad: [0.9, 1] })
    .cone(0.5, 0.62, 0x9c4a30, 4, { y: 2.85, ry: Math.PI / 4, grad: [0.78, 1] })
    .cyl(0.012, 0.012, 0.3, 0xc99a3c, 4, { y: 3.3, grad: [1, 1] })
    .ico(0.045, 0xd9a840, 0, { y: 3.46, grad: [1, 1] })
    .box(0.2, 0.025, 0.012, 0xd9a840, { y: 3.38, x: 0.1, grad: [1, 1] });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const c = Math.cos(a), s = Math.sin(a);
    g.cyl(0.2, 0.2, 0.03, 0xf6efdc, 14, { x: s * 0.3, y: 2.27, z: c * 0.3, rx: Math.PI / 2, ry: 0, rz: 0, grad: [1, 1] });
    g.box(0.02, 0.15, 0.012, 0x2a2018, { x: s * 0.32, y: 2.31, z: c * 0.32, ry: a, grad: [1, 1] });
    g.box(0.12, 0.02, 0.012, 0x2a2018, { x: s * 0.32 + c * 0.05, y: 2.27, z: c * 0.32 - s * 0.05, ry: a, grad: [1, 1] });
  }
  // fonte: jato
  g.cyl(0.03, 0.04, 0.0 + 0.001, 0xffffff, 4, { y: 0.3, grad: [1, 1] });
  // bancos
  for (const [bx, bz, br] of [[1.45, 0.35, Math.PI / 2], [-1.45, -0.45, -Math.PI / 2]] as const) {
    g.box(0.7, 0.05, 0.22, 0x8a5a36, { x: bx, y: 0.26, z: bz, ry: br, grad: [1, 1] });
    g.box(0.7, 0.2, 0.04, 0x8a5a36, { x: bx - Math.sin(br) * 0.11 * -1, y: 0.4, z: bz - Math.cos(br) * 0.11 * -1, ry: br, grad: [1, 1] });
    g.box(0.05, 0.26, 0.2, 0x3a2a20, { x: bx + Math.cos(br) * 0.3, y: 0.13, z: bz - Math.sin(br) * 0.3, ry: br, grad: [1, 1] });
    g.box(0.05, 0.26, 0.2, 0x3a2a20, { x: bx - Math.cos(br) * 0.3, y: 0.13, z: bz + Math.sin(br) * 0.3, ry: br, grad: [1, 1] });
  }
  // barracas listradas
  for (const [sx, sz, sr] of [[0.6, 1.55, 0.2], [-0.9, 1.5, -0.25]] as const) {
    g.box(0.8, 0.28, 0.4, 0x7a5a3a, { x: sx, y: 0.14, z: sz, ry: sr, grad: [0.8, 1] });
    for (const o of [-1, 1]) for (const p of [-1, 1]) {
      const ox = o * 0.37, oz = p * 0.17;
      g.box(0.03, 0.6, 0.03, 0x5b3b24, { x: sx + ox * Math.cos(sr) + oz * Math.sin(sr), y: 0.3, z: sz - ox * Math.sin(sr) + oz * Math.cos(sr), grad: [1, 1] });
    }
    for (let k = 0; k < 6; k++) {
      const ox = -0.35 + k * 0.14;
      g.box(0.14, 0.03, 0.5, k % 2 ? 0xf4ead6 : 0xc2402e, { x: sx + ox * Math.cos(sr), y: 0.64 - (k % 1) * 0, z: sz - ox * Math.sin(sr), ry: sr, rx: 0.18, grad: [1, 1] });
    }
    g.ico(0.05, 0xd8452c, 0, { x: sx - 0.2 * Math.cos(sr), y: 0.31, z: sz + 0.2 * Math.sin(sr), grad: [1, 1] });
    g.ico(0.05, 0xe8b23c, 0, { x: sx, y: 0.31, z: sz, grad: [1, 1] });
    g.ico(0.05, 0x7aa84a, 0, { x: sx + 0.2 * Math.cos(sr), y: 0.31, z: sz - 0.2 * Math.sin(sr), grad: [1, 1] });
  }
  return g.build();
}

export function bridgeGeo(): THREE.BufferGeometry {
  const g = new Geo(55);
  const L = 1.5;
  const arc = (x: number): number => 0.3 * (1 - (x / L) * (x / L));
  const n = 12;
  for (let i = 0; i < n; i++) {
    const x = -L + ((i + 0.5) * 2 * L) / n;
    const slope = Math.atan2(arc(x + 0.05) - arc(x - 0.05), 0.1);
    g.box(2 * L / n + 0.01, 0.06, 1.0, i % 2 ? 0x9a6f45 : 0x8a6038, { x, y: arc(x), rz: slope, grad: [1, 1] });
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 4; i++) {
      const x = -L + (i * 2 * L) / 4;
      g.box(0.06, 0.3, 0.06, 0x5b3b24, { x, y: arc(x) + 0.17, z: s * 0.5, grad: [0.9, 1] });
    }
    for (let i = 0; i < 8; i++) {
      const x = -L + 0.19 + (i * (2 * L - 0.38)) / 7;
      const slope = Math.atan2(arc(x + 0.05) - arc(x - 0.05), 0.1);
      g.box(0.4, 0.04, 0.04, 0x6b4a30, { x, y: arc(x) + 0.3, z: s * 0.5, rz: slope, grad: [1, 1] });
    }
  }
  // cabeceiras de pedra
  for (const s of [-1, 1]) g.box(0.35, 0.14, 1.2, 0x9a9086, { x: s * (L + 0.1), y: 0.0, grad: [0.7, 1] });
  return g.build();
}

export function pierGeo(): THREE.BufferGeometry {
  const g = new Geo(56);
  for (let i = 0; i < 9; i++) g.box(0.17, 0.04, 0.5, i % 2 ? 0x93683e : 0x7e5632, { x: i * 0.19, y: 0.05, grad: [1, 1] });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) g.cyl(0.035, 0.035, 0.4, 0x4e3220, 5, { x: 0.15 + i * 0.5, y: -0.1, z: s * 0.23, grad: [1, 1] });
  return g.build();
}
export function boatGeo(): THREE.BufferGeometry {
  return new Geo(57)
    .box(0.62, 0.08, 0.24, 0x8c4a2c, { y: 0.03, grad: [0.7, 1] })
    .box(0.18, 0.08, 0.2, 0x8c4a2c, { x: 0.38, y: 0.06, rz: 0.4, grad: [0.8, 1] })
    .box(0.18, 0.08, 0.2, 0x8c4a2c, { x: -0.38, y: 0.06, rz: -0.4, grad: [0.8, 1] })
    .box(0.06, 0.03, 0.26, 0xd9c8a0, { x: 0.05, y: 0.1, grad: [1, 1] })
    .build();
}
export function duckGeo(): THREE.BufferGeometry {
  return new Geo(58)
    .ico(0.06, 0xf7f2e4, 1, { sx: 1.35, sy: 0.8, y: 0.03, grad: [0.8, 1] })
    .ico(0.038, 0x3d7a58, 1, { x: 0.07, y: 0.09, grad: [1, 1] })
    .cone(0.015, 0.04, 0xe8a030, 4, { x: 0.12, y: 0.09, rz: -Math.PI / 2, grad: [1, 1] })
    .build();
}
