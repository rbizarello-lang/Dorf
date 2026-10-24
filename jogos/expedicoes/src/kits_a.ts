// Construções: cada lugar tem o seu jeito de construir. Frente em +z, origem no chão, cumeeira ao longo de x.
// Cores vão nos vértices; `glow` marca as janelas e lanternas que acendem à noite.
import * as THREE from 'three';
import { Geo, gable, lathe } from './geo';

const DARKGLASS = 0x2a3b4c;

export interface Built { geo: THREE.BufferGeometry; chim: [number, number, number]; win: [number, number, number][]; r: number }

interface TimberOpts {
  W: number; D: number; H: number; RH: number; wall: number; roof: number; stone?: number; beams?: number; two?: boolean; chim?: number;
  wing?: boolean; door?: number; shut?: number; lit?: number[];
}
/** Casa de aldeia da capital: caiada ou de enxaimel, telhado de duas águas, chaminé de tijolo. */
export function timberHouse(seed: number, o: TimberOpts): Built {
  const { W, D, H, RH } = o;
  const stone = o.stone ?? 0x9a8f84, beams = o.beams ?? 0x5b3b24, door = o.door ?? 0x5b3b24;
  const g = new Geo(seed);
  g.box(W + 0.08, 0.3, D + 0.08, stone, { y: -0.05, grad: [0.62, 0.95] });
  const h1 = o.two ? H * 0.52 : H;
  g.box(W, h1 - 0.1, D, o.wall, { y: 0.1 + (h1 - 0.1) / 2, grad: [0.8, 1] });
  if (o.two) {
    g.box(W + 0.08, 0.05, D + 0.08, beams, { y: h1, grad: [1, 1] });
    g.box(W + 0.05, H - h1, D + 0.05, o.wall, { y: h1 + (H - h1) / 2 + 0.025, grad: [0.88, 1] });
  }
  if (o.beams !== undefined || o.two) {
    for (const x of [-W / 2, 0, W / 2]) g.box(0.04, o.two ? H - 0.12 : H - 0.12, 0.03, beams, { x: x * 0.98, y: 0.1 + (H - 0.1) / 2, z: D / 2 + 0.02, grad: [1, 1] });
    g.box(W, 0.035, 0.03, beams, { y: H * 0.75, z: D / 2 + 0.02, grad: [1, 1] });
    if (o.two) for (const s of [-1, 1]) g.box(0.5, 0.03, 0.03, beams, { x: s * 0.2, y: H * 0.85, z: D / 2 + 0.03, rz: s * 0.7, grad: [1, 1] });
  }
  const dx = W * 0.18;
  g.box(0.2, 0.33, 0.04, door, { x: dx, y: 0.265, z: D / 2 + 0.005, grad: [1, 1] });
  g.box(0.25, 0.05, 0.07, beams, { x: dx, y: 0.45, z: D / 2 + 0.02, grad: [1, 1] });
  const wins: [number, number, number][] = [];
  const lit = o.lit ?? [1, 0.6, 1, 0.8];
  let li = 0;
  const win = (x: number, y: number, z: number, side: 'f' | 'b' | 'l' | 'r'): void => {
    const f = side === 'f' || side === 'b';
    const zz = side === 'b' ? -1 : 1;
    const gl = lit[li++ % lit.length];
    if (f) {
      g.box(0.21, 0.23, 0.02, o.shut ?? beams, { x, y, z: zz * (z + 0.004), grad: [1, 1] });
      g.box(0.15, 0.17, 0.02, DARKGLASS, { x, y, z: zz * (z + 0.014), grad: [1, 1], glow: gl });
    } else {
      const xx = side === 'l' ? -1 : 1;
      g.box(0.02, 0.23, 0.21, o.shut ?? beams, { x: xx * (W / 2 + 0.004), y, z: x, grad: [1, 1] });
      g.box(0.02, 0.17, 0.15, DARKGLASS, { x: xx * (W / 2 + 0.014), y, z: x, grad: [1, 1], glow: gl });
    }
    if (side === 'f') wins.push([x, y, z + 0.12]);
  };
  win(-W * 0.3, h1 * 0.62, D / 2, 'f');
  win(-W * 0.3, h1 * 0.62, D / 2, 'b');
  win(0.05, h1 * 0.62, D / 2, 'l');
  win(0.05, h1 * 0.62, D / 2, 'r');
  if (o.two) { win(-W * 0.28, H * 0.8, D / 2 + 0.03, 'f'); win(W * 0.28, H * 0.8, D / 2 + 0.03, 'f'); }
  // telhado
  g.add(gable(D + 0.22, RH, W + 0.28), o.roof, { ry: Math.PI / 2, y: H - 0.03, grad: [0.74, 1] });
  g.box(W + 0.3, 0.035, 0.05, 0x3a2a20, { y: H - 0.03 + RH + 0.004, grad: [1, 1] });
  // chaminé
  const cx = o.chim ?? -W * 0.3;
  g.box(0.13, 0.62, 0.13, 0xa88672, { x: cx, y: H + 0.22, z: -0.1, grad: [0.75, 1] });
  g.box(0.18, 0.045, 0.18, 0x7e6858, { x: cx, y: H + 0.54, z: -0.1, grad: [1, 1] });
  if (o.wing) {
    g.box(0.52, 0.42, 0.6, o.wall, { x: W / 2 + 0.2, y: 0.21, z: 0.06, grad: [0.8, 1] });
    g.add(gable(0.62 + 0.14, 0.3, 0.52 + 0.14), o.roof, { ry: Math.PI / 2, x: W / 2 + 0.2, y: 0.4, z: 0.06, grad: [0.74, 1] });
  }
  return { geo: g.build(), chim: [cx, H + 0.62, -0.1], win: wins, r: Math.max(W, D) * 0.8 };
}

/** Casa caiada de pescador: cubos brancos, portas e venezianas azuis, terraço, buganvília. */
export function caicada(seed: number, variant: number): Built {
  const WHITE = 0xf6f3ea, BLUE = 0x2f78b6, TERRA = 0xc2603a;
  const g = new Geo(seed);
  const wins: [number, number, number][] = [];
  const W = variant === 0 ? 1.0 : 0.86, D = variant === 0 ? 0.74 : 0.7, H = variant === 0 ? 0.56 : 0.5;
  g.box(W + 0.06, 0.26, D + 0.06, 0xd9d2c0, { y: -0.04, grad: [0.7, 0.95] });
  g.box(W, H, D, WHITE, { y: 0.09 + H / 2, jit: 0.006, grad: [0.8, 1] });
  const wnd = (x: number, y: number, side: number, gl: number): void => {
    g.box(0.2, 0.25, 0.03, BLUE, { x, y, z: side * (D / 2 + 0.004), grad: [1, 1] });
    g.box(0.13, 0.17, 0.03, DARKGLASS, { x, y, z: side * (D / 2 + 0.016), grad: [1, 1], glow: gl });
    g.box(0.05, 0.25, 0.04, BLUE, { x: x - 0.14, y, z: side * (D / 2 + 0.02), grad: [1, 1] });
    g.box(0.05, 0.25, 0.04, BLUE, { x: x + 0.14, y, z: side * (D / 2 + 0.02), grad: [1, 1] });
  };
  if (variant === 0) {
    g.box(W + 0.1, 0.05, D + 0.1, 0xe8e2d4, { y: 0.09 + H + 0.02, grad: [0.9, 1] });
    g.box(W + 0.1, 0.1, 0.05, WHITE, { y: 0.09 + H + 0.1, z: D / 2 + 0.03, grad: [0.9, 1] });
    g.box(W + 0.1, 0.1, 0.05, WHITE, { y: 0.09 + H + 0.1, z: -D / 2 - 0.03, grad: [0.9, 1] });
    // cubo do terraço
    g.box(0.5, 0.3, 0.46, WHITE, { x: -0.18, y: 0.09 + H + 0.2, z: -0.1, grad: [0.85, 1] });
    g.box(0.56, 0.04, 0.52, 0xe8e2d4, { x: -0.18, y: 0.09 + H + 0.37, z: -0.1, grad: [0.9, 1] });
    g.box(0.16, 0.22, 0.03, BLUE, { x: -0.18, y: 0.09 + H + 0.14, z: 0.14, grad: [1, 1] });
    wnd(0.12, 0.09 + H + 0.2, 1, 0.9);
    // escada externa
    for (let i = 0; i < 4; i++) g.box(0.22, 0.08, 0.1, 0xe8e2d4, { x: W / 2 + 0.16, y: 0.1 + i * 0.12, z: 0.1 - i * 0.12, grad: [0.9, 1] });
    // porta e janelas
    g.box(0.2, 0.34, 0.04, BLUE, { x: 0.28, y: 0.27, z: D / 2 + 0.01, grad: [1, 1] });
    wnd(-0.28, 0.4, 1, 1);
    wnd(0, 0.4, -1, 0.7);
    g.box(0.1, 0.34, 0.1, 0xefe9da, { x: 0.38, y: 0.09 + H + 0.2, z: -0.28, grad: [0.8, 1] });
    g.box(0.14, 0.04, 0.14, 0xa6998a, { x: 0.38, y: 0.09 + H + 0.39, z: -0.28, grad: [1, 1] });
    // buganvília
    g.ico(0.12, 0xc43d78, 0, { x: -0.5, y: 0.34, z: 0.3, sy: 1.1, jit: 0.05, grad: [0.7, 1] });
    g.ico(0.09, 0xd8588f, 0, { x: -0.46, y: 0.5, z: 0.34, jit: 0.04, grad: [0.8, 1] });
    wins.push([0.1, 0.4, D / 2 + 0.1]);
  } else {
    g.add(gable(D + 0.2, 0.34, W + 0.2), TERRA, { ry: Math.PI / 2, y: 0.09 + H - 0.02, grad: [0.78, 1] });
    g.box(W + 0.22, 0.03, 0.05, 0x8d3f22, { y: 0.09 + H - 0.02 + 0.34, grad: [1, 1] });
    g.box(0.18, 0.32, 0.04, BLUE, { x: 0.0, y: 0.25, z: D / 2 + 0.01, grad: [1, 1] });
    g.cyl(0.09, 0.09, 0.04, BLUE, 8, { x: 0, y: 0.41, z: D / 2 + 0.01, rx: Math.PI / 2, grad: [1, 1] });
    wnd(-0.28, 0.38, 1, 1); wnd(0.28, 0.38, 1, 0.8); wnd(0, 0.38, -1, 0.6);
    g.box(0.1, 0.4, 0.1, 0xefe9da, { x: 0.3, y: 0.09 + H + 0.2, z: -0.1, grad: [0.8, 1] });
    g.box(0.14, 0.04, 0.14, 0xa6998a, { x: 0.3, y: 0.09 + H + 0.42, z: -0.1, grad: [1, 1] });
    g.ico(0.1, 0xc43d78, 0, { x: 0.45, y: 0.3, z: 0.34, sy: 1.1, jit: 0.05, grad: [0.7, 1] });
    wins.push([-0.28, 0.38, D / 2 + 0.1]);
  }
  return { geo: g.build(), chim: variant === 0 ? [0.38, 1.05, -0.28] : [0.3, 0.98, -0.1], win: wins, r: 0.8 };
}

/** Capela caiada com cúpula azul: o marco da costa. */
export function chapel(seed: number): THREE.BufferGeometry {
  const g = new Geo(seed);
  g.box(0.9, 0.12, 0.9, 0xd9d2c0, { y: -0.02, grad: [0.7, 0.95] });
  g.box(0.78, 0.6, 0.78, 0xf6f3ea, { y: 0.34, jit: 0.006, grad: [0.8, 1] });
  g.cyl(0.32, 0.36, 0.2, 0xf1ede2, 14, { y: 0.74, grad: [0.85, 1] });
  g.add(lathe([[0, 0], [0.3, 0], [0.31, 0.06], [0.27, 0.2], [0.17, 0.32], [0.05, 0.4], [0, 0.42]], 14), 0x2d70b2, { y: 0.84, grad: [0.75, 1] });
  g.cyl(0.012, 0.012, 0.18, 0xeee9dc, 4, { y: 1.34, grad: [1, 1] });
  g.box(0.1, 0.02, 0.02, 0xeee9dc, { y: 1.38, grad: [1, 1] });
  g.box(0.2, 0.34, 0.04, 0x2f78b6, { y: 0.27, z: 0.4, grad: [1, 1] });
  g.cyl(0.1, 0.1, 0.04, 0x2f78b6, 8, { y: 0.44, z: 0.4, rx: Math.PI / 2, grad: [1, 1] });
  for (const x of [-0.24, 0.24]) g.box(0.1, 0.2, 0.03, DARKGLASS, { x, y: 0.5, z: 0.4, grad: [1, 1], glow: 1 });
  return g.build();
}

/** Chalé da serra: embasamento de pedra, tora escura, telhado íngreme com neve, sacada e lenha. */
export function chalet(seed: number, long: boolean, snow = true): Built {
  const W = long ? 1.4 : 1.0, D = long ? 0.8 : 0.78;
  const g = new Geo(seed);
  const wins: [number, number, number][] = [];
  g.box(W + 0.1, 0.5, D + 0.1, 0x8d8a84, { y: 0.08, jit: 0.015, grad: [0.62, 0.95] });
  for (let i = 0; i < 5; i++) g.box(W + 0.12, 0.012, D + 0.12, 0x6e6b66, { y: -0.1 + i * 0.1, grad: [1, 1] });
  // andar de tora
  g.box(W, 0.46, D, 0x7a5234, { y: 0.56, grad: [0.78, 1] });
  for (let i = 0; i < 4; i++) g.box(W + 0.03, 0.018, D + 0.03, 0x5a3b24, { y: 0.4 + i * 0.1, grad: [1, 1] });
  // porta
  g.box(0.22, 0.34, 0.05, 0x4a2f1c, { x: W * 0.2, y: 0.27, z: D / 2 + 0.06, grad: [1, 1] });
  g.box(0.3, 0.04, 0.1, 0x3d281a, { x: W * 0.2, y: 0.46, z: D / 2 + 0.06, grad: [1, 1] });
  const xs = long ? [-0.45, -0.1, 0.45] : [-0.27, 0.12];
  xs.forEach((x, i) => {
    g.box(0.24, 0.26, 0.04, 0x9a3b2c, { x, y: 0.58, z: D / 2 + 0.01, grad: [1, 1] });
    g.box(0.15, 0.17, 0.03, DARKGLASS, { x, y: 0.58, z: D / 2 + 0.03, grad: [1, 1], glow: i % 3 === 1 ? 0.7 : 1 });
    wins.push([x, 0.58, D / 2 + 0.1]);
  });
  g.box(0.26, 0.28, 0.04, 0x9a3b2c, { x: 0, y: 0.58, z: -D / 2 - 0.01, grad: [1, 1] });
  g.box(0.16, 0.18, 0.03, DARKGLASS, { x: 0, y: 0.58, z: -D / 2 - 0.03, grad: [1, 1], glow: 1 });
  // sacada
  g.box(0.7, 0.04, 0.2, 0x5a3b24, { x: -W * 0.15, y: 0.5, z: D / 2 + 0.14, grad: [1, 1] });
  for (let i = 0; i <= 4; i++) g.box(0.025, 0.14, 0.025, 0x4a2f1c, { x: -W * 0.15 - 0.33 + i * 0.165, y: 0.58, z: D / 2 + 0.23, grad: [1, 1] });
  g.box(0.7, 0.025, 0.03, 0x4a2f1c, { x: -W * 0.15, y: 0.66, z: D / 2 + 0.23, grad: [1, 1] });
  // telhado de duas águas, beiral largo
  const RH = 0.66;
  g.add(gable(D + 0.42, RH, W + 0.34), 0x474d58, { ry: Math.PI / 2, y: 0.76, grad: [0.74, 1] });
  for (let k = 0; k < 3; k++) g.add(gable(D + 0.43 - k * 0.1, 0.05, W + 0.35), k % 2 ? 0x3d434d : 0x535a66, { ry: Math.PI / 2, y: 0.76 + 0.13 + k * 0.17, grad: [1, 1] });
  if (snow) {
    g.add(gable(D + 0.5, RH * 0.62, W + 0.42), 0xf3f8fc, { ry: Math.PI / 2, y: 0.76 + RH * 0.38 + 0.02, grad: [0.9, 1], jit: 0.02 });
    g.box(W + 0.5, 0.06, 0.08, 0xf3f8fc, { y: 0.76 + RH - 0.01, grad: [1, 1] });
  }
  // chaminé de pedra
  g.box(0.17, 0.9, 0.17, 0x8d8a84, { x: W * 0.28, y: 0.95, z: -0.12, grad: [0.7, 1] });
  g.box(0.22, 0.05, 0.22, 0x6e6b66, { x: W * 0.28, y: 1.42, z: -0.12, grad: [1, 1] });
  if (snow) g.box(0.2, 0.03, 0.2, 0xf3f8fc, { x: W * 0.28, y: 1.46, z: -0.12, grad: [1, 1] });
  // lenha encostada
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) g.cyl(0.04, 0.04, 0.3, r % 2 ? 0x8a5f3a : 0x9c6e44, 6, { x: -W / 2 - 0.1, y: 0.06 + r * 0.075, z: -0.2 + c * 0.09 + r * 0.045, rz: Math.PI / 2, grad: [0.8, 1] });
  return { geo: g.build(), chim: [W * 0.28, 1.5, -0.12], win: wins, r: W * 0.8 };
}

/** Casa em palafitas do brejo: tábua cinzenta, telhado de sapé, varanda e escada para a água. */
export function stilt(seed: number, variant: number): Built {
  const g = new Geo(seed);
  const wins: [number, number, number][] = [];
  const W = variant === 0 ? 0.9 : 1.15, D = variant === 0 ? 0.7 : 0.8, FH = 0.62;
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) g.cyl(0.04, 0.05, FH + 0.9, 0x4e4034, 6, { x: sx * (W / 2 + 0.1), y: (FH - 0.9) / 2, z: sz * (D / 2 + 0.12), jit: 0.01, grad: [0.55, 1] });
  // assoalho e varanda
  g.box(W + 0.34, 0.06, D + 0.62, 0x7b6a52, { y: FH, z: 0.12, grad: [0.8, 1] });
  for (let i = 0; i < 8; i++) g.box(W + 0.34, 0.012, 0.012, 0x4e4034, { y: FH + 0.035, z: -0.22 + i * 0.1, grad: [1, 1] });
  // cabine
  g.box(W, 0.5, D, 0x8f8a74, { y: FH + 0.28, grad: [0.78, 1] });
  for (let i = 0; i < 6; i++) g.box(0.012, 0.5, D + 0.02, 0x6c6652, { x: -W / 2 + 0.08 + i * (W - 0.16) / 5, y: FH + 0.28, grad: [1, 1] });
  g.box(0.2, 0.36, 0.04, 0x4a3a2a, { x: W * 0.2, y: FH + 0.24, z: D / 2 + 0.01, grad: [1, 1] });
  g.box(0.2, 0.2, 0.03, 0x4a3a2a, { x: -W * 0.22, y: FH + 0.36, z: D / 2 + 0.01, grad: [1, 1] });
  g.box(0.14, 0.14, 0.03, DARKGLASS, { x: -W * 0.22, y: FH + 0.36, z: D / 2 + 0.03, grad: [1, 1], glow: 1 });
  g.box(0.2, 0.2, 0.03, 0x4a3a2a, { x: 0, y: FH + 0.36, z: -D / 2 - 0.01, grad: [1, 1] });
  g.box(0.14, 0.14, 0.03, DARKGLASS, { x: 0, y: FH + 0.36, z: -D / 2 - 0.03, grad: [1, 1], glow: 0.8 });
  wins.push([-W * 0.22, FH + 0.36, D / 2 + 0.12]);
  // sapé: duas águas, beiral comprido, com tufos caindo
  g.add(gable(D + 0.34, 0.5, W + 0.34), 0xb6a05a, { ry: Math.PI / 2, y: FH + 0.5, grad: [0.62, 1], jit: 0.025 });
  g.add(gable(D + 0.38, 0.22, W + 0.38), 0xc9b36c, { ry: Math.PI / 2, y: FH + 0.5 + 0.28, grad: [0.8, 1], jit: 0.02 });
  for (let i = 0; i < 9; i++) g.box(0.07, 0.07, 0.05, 0x8d7a40, { x: -W / 2 - 0.12 + i * (W + 0.24) / 8, y: FH + 0.5, z: D / 2 + 0.2 - 0.0, rx: 0.5, jit: 0.02, grad: [1, 1] });
  // varanda: guarda-corpo e lanterna
  for (let i = 0; i <= 4; i++) g.box(0.025, 0.18, 0.025, 0x5a4a38, { x: -W / 2 - 0.1 + i * (W + 0.2) / 4, y: FH + 0.12, z: D / 2 + 0.38, grad: [1, 1] });
  g.box(W + 0.2, 0.025, 0.03, 0x5a4a38, { y: FH + 0.22, z: D / 2 + 0.38, grad: [1, 1] });
  g.box(0.035, 0.34, 0.035, 0x4e4034, { x: -W / 2 - 0.05, y: FH + 0.25, z: D / 2 + 0.38, grad: [1, 1] });
  g.box(0.14, 0.02, 0.02, 0x4e4034, { x: -W / 2 + 0.01, y: FH + 0.4, z: D / 2 + 0.38, grad: [1, 1] });
  g.ico(0.05, 0xffd9a0, 0, { x: -W / 2 + 0.07, y: FH + 0.35, z: D / 2 + 0.38, sy: 1.2, grad: [1, 1], glow: 2.4 });
  // escada para a água
  for (let i = 0; i < 4; i++) g.box(0.24, 0.025, 0.07, 0x6c5a44, { x: W * 0.15, y: FH - 0.08 - i * 0.14, z: D / 2 + 0.5 + i * 0.05, grad: [1, 1] });
  for (const s of [-1, 1]) g.box(0.025, 0.65, 0.025, 0x4e4034, { x: W * 0.15 + s * 0.13, y: FH - 0.3, z: D / 2 + 0.58, rx: -0.3, grad: [1, 1] });
  // caixote e rede
  g.box(0.18, 0.14, 0.18, 0x6b5640, { x: W / 2 + 0.05, y: FH + 0.1, z: -0.1, grad: [0.8, 1] });
  g.cyl(0.07, 0.07, 0.15, 0x7a5a3a, 8, { x: W / 2 + 0.1, y: FH + 0.1, z: 0.2, grad: [0.8, 1] });
  if (variant === 1) {
    g.box(0.38, 0.42, 0.42, 0x8f8a74, { x: -W / 2 - 0.34, y: FH + 0.26, z: 0.0, grad: [0.78, 1] });
    g.add(gable(0.42 + 0.2, 0.3, 0.38 + 0.2), 0xb6a05a, { ry: Math.PI / 2, x: -W / 2 - 0.34, y: FH + 0.46, grad: [0.62, 1], jit: 0.02 });
    g.box(0.1, 0.1, 0.03, DARKGLASS, { x: -W / 2 - 0.34, y: FH + 0.3, z: 0.22, grad: [1, 1], glow: 1 });
  }
  g.box(0.1, 0.3, 0.1, 0x7a6a52, { x: W * 0.25, y: FH + 0.78, z: -0.14, grad: [0.8, 1] });
  return { geo: g.build(), chim: [W * 0.25, FH + 0.95, -0.14], win: wins, r: 0.9 };
}

/** Torre de pedra da serra (e dos bairros novos da capital): fuste circular, galeria de madeira, cone de ardósia. */
export function stoneTower(seed: number, h: number, snow: boolean): Built {
  const g = new Geo(seed);
  g.cyl(0.58, 0.64, 0.18, 0x6f6c68, 12, { y: 0.0, grad: [0.6, 0.95] });
  g.cyl(0.4, 0.5, h, 0x9b968c, 12, { y: 0.09 + h / 2, jit: 0.012, grad: [0.62, 1] });
  for (let i = 1; i <= 3; i++) g.cyl(0.43 - i * 0.02, 0.44 - i * 0.02, 0.025, 0x74706a, 12, { y: 0.09 + (h * i) / 4, grad: [1, 1] });
  const wins: [number, number, number][] = [];
  for (let i = 0; i < 3; i++) {
    const y = 0.35 + (h * 0.7 * i) / 2.2, a = 0.5 + i * 2.1;
    const r = 0.46 - (y / h) * 0.06;
    g.box(0.07, 0.24, 0.05, 0x1d1b1a, { x: Math.sin(a) * r, y, z: Math.cos(a) * r, ry: a, grad: [1, 1] });
    g.box(0.045, 0.18, 0.05, DARKGLASS, { x: Math.sin(a) * (r + 0.01), y, z: Math.cos(a) * (r + 0.01), ry: a, grad: [1, 1], glow: 1 });
    if (i === 0) wins.push([Math.sin(a) * (r + 0.1), y, Math.cos(a) * (r + 0.1)]);
  }
  g.box(0.22, 0.34, 0.06, 0x4a2f1c, { y: 0.26, z: 0.5, grad: [1, 1] });
  const gy = 0.09 + h;
  g.cyl(0.55, 0.5, 0.08, 0x6a4a2e, 12, { y: gy, grad: [0.8, 1] });
  g.cyl(0.46, 0.46, 0.34, 0x7a5234, 12, { y: gy + 0.2, grad: [0.78, 1] });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; g.box(0.14, 0.14, 0.03, DARKGLASS, { x: Math.sin(a) * 0.47, y: gy + 0.22, z: Math.cos(a) * 0.47, ry: a, grad: [1, 1], glow: i % 2 ? 1 : 0.7 }); }
  g.cone(0.66, 0.78, 0x46505f, 12, { y: gy + 0.37 + 0.39, grad: [0.7, 1] });
  if (snow) g.cone(0.52, 0.5, 0xf3f8fc, 12, { y: gy + 0.37 + 0.52, grad: [0.9, 1], jit: 0.02 });
  g.cyl(0.012, 0.012, 0.4, 0x2a2a2a, 4, { y: gy + 1.4, grad: [1, 1] });
  g.box(0.3, 0.16, 0.012, 0xb3402b, { x: 0.15, y: gy + 1.52, grad: [1, 1] });
  return { geo: g.build(), chim: [0, 0, 0], win: wins, r: 0.65 };
}

/** Farol listrado com a casa do faroleiro. A lente é a peça que mais brilha. */
export function lighthouse(seed: number): THREE.BufferGeometry {
  const g = new Geo(seed);
  g.cyl(0.62, 0.72, 0.3, 0x8d8a84, 14, { y: 0.0, grad: [0.6, 0.95] });
  const H = 3.1, segs = 7;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const r0 = 0.5 - 0.17 * t0, r1 = 0.5 - 0.17 * t1;
    g.cyl(r1, r0, H / segs + 0.001, i % 2 ? 0xc43c2c : 0xf4efe4, 14, { y: 0.15 + (i + 0.5) * H / segs, grad: [0.75, 1] });
  }
  g.cyl(0.46, 0.4, 0.07, 0x2a2a2a, 14, { y: 0.15 + H + 0.03, grad: [1, 1] });
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.box(0.02, 0.2, 0.02, 0x2a2a2a, { x: Math.sin(a) * 0.44, y: 0.15 + H + 0.17, z: Math.cos(a) * 0.44, grad: [1, 1] }); }
  g.cyl(0.44, 0.44, 0.02, 0x2a2a2a, 14, { y: 0.15 + H + 0.27, grad: [1, 1] });
  g.cyl(0.26, 0.26, 0.4, 0xfff0c0, 12, { y: 0.15 + H + 0.31, grad: [1, 1], glow: 3.2 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; g.box(0.025, 0.42, 0.025, 0x222222, { x: Math.sin(a) * 0.27, y: 0.15 + H + 0.31, z: Math.cos(a) * 0.27, grad: [1, 1] }); }
  g.cone(0.34, 0.26, 0xc43c2c, 12, { y: 0.15 + H + 0.65, grad: [0.75, 1] });
  g.ico(0.05, 0xc9a24a, 0, { y: 0.15 + H + 0.82, grad: [1, 1] });
  g.box(0.16, 0.3, 0.05, 0x3a2a20, { y: 0.45, z: 0.47, ry: 0, grad: [1, 1] });
  for (let i = 0; i < 4; i++) g.box(0.06, 0.16, 0.04, DARKGLASS, { x: Math.sin(i * 1.7 + 0.5) * 0.4, y: 0.9 + i * 0.6, z: Math.cos(i * 1.7 + 0.5) * 0.4, ry: i * 1.7 + 0.5, grad: [1, 1], glow: 0.9 });
  // casa do faroleiro, encostada
  g.box(0.9, 0.46, 0.6, 0xf4efe4, { x: 0.95, y: 0.23, z: 0.15, grad: [0.8, 1] });
  g.add(gable(0.74, 0.34, 1.02), 0xb5472f, { ry: Math.PI / 2, x: 0.95, y: 0.44, z: 0.15, grad: [0.75, 1] });
  g.box(0.18, 0.3, 0.04, 0x2f78b6, { x: 0.8, y: 0.17, z: 0.46, grad: [1, 1] });
  g.box(0.16, 0.16, 0.03, DARKGLASS, { x: 1.15, y: 0.28, z: 0.46, grad: [1, 1], glow: 1 });
  g.box(0.1, 0.34, 0.1, 0xb59a8a, { x: 1.2, y: 0.78, z: -0.02, grad: [0.8, 1] });
  return g.build();
}

/** Raio de luz do farol: dois leques aditivos que giram. Origem na lente. */
export function lightBeam(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const L = 6.5;
  for (const s of [1, -1]) {
    const b = pos.length / 3;
    pos.push(0.0, 0.0, 0.0, s * L, 0.9, -0.9, s * L, 0.9, 0.9, s * L, -0.9, 0.9, s * L, -0.9, -0.9);
    col.push(1, 0.85, 0.5, 0.2, 0.15, 0.08, 0.2, 0.15, 0.08, 0.2, 0.15, 0.08, 0.2, 0.15, 0.08);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 3, b + 4, b, b + 4, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Boca de mina: caixilho de madeira, interior escuro, lanterna e pilha de minério. */
export function mineMouth(seed: number): THREE.BufferGeometry {
  const g = new Geo(seed);
  g.ico(0.9, 0x6f6c68, 1, { x: -0.5, y: 0.35, z: -0.55, sx: 1.1, sy: 0.9, jit: 0.2, grad: [0.55, 1] });
  g.box(0.9, 0.78, 0.5, 0x161312, { y: 0.4, z: -0.1, grad: [1, 1] });
  for (const s of [-1, 1]) g.box(0.1, 0.84, 0.12, 0x6a4a2e, { x: s * 0.46, y: 0.42, z: 0.18, jit: 0.01, grad: [0.7, 1] });
  g.box(1.06, 0.12, 0.14, 0x6a4a2e, { y: 0.86, z: 0.18, grad: [0.8, 1] });
  for (const s of [-1, 1]) g.box(0.08, 0.34, 0.08, 0x5a3b24, { x: s * 0.38, y: 0.74, z: 0.18, rz: s * 0.7, grad: [1, 1] });
  g.box(1.16, 0.06, 0.22, 0x4a2f1c, { y: 0.96, z: 0.18, grad: [1, 1] });
  g.add(gable(0.3, 0.16, 1.2), 0x3d434d, { ry: Math.PI / 2, y: 0.98, z: 0.18, grad: [0.7, 1] });
  g.box(1.2, 0.04, 0.3, 0xf3f8fc, { y: 1.12, z: 0.18, grad: [1, 1], jit: 0.01 });
  g.box(0.02, 0.18, 0.02, 0x2a2a2a, { x: 0.28, y: 0.68, z: 0.3, grad: [1, 1] });
  g.ico(0.06, 0xffd9a0, 0, { x: 0.28, y: 0.55, z: 0.3, sy: 1.2, grad: [1, 1], glow: 2.6 });
  // pilha de minério
  g.ico(0.2, 0x3e4651, 1, { x: 0.8, y: 0.1, z: 0.5, sy: 0.7, jit: 0.1, grad: [0.6, 1] });
  g.ico(0.12, 0xa07a3c, 0, { x: 0.74, y: 0.2, z: 0.5, jit: 0.05, grad: [0.8, 1.1] });
  g.ico(0.08, 0xc5a24e, 0, { x: 0.9, y: 0.12, z: 0.56, jit: 0.04, grad: [0.8, 1.1] });
  return g.build();
}
