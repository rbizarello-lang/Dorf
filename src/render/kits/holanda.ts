import * as THREE from 'three/webgpu';
import type { Part } from '../lib';

// Kits da Holanda Dourada (etapa T1). Arquivo à parte para o merge dos temas ser fácil: lib.ts só chama estas
// funções num `case`. Cada uma devolve `Part[]` (o lib.ts junta com o `kit()` dele). Só importa o TIPO de lib.ts,
// então não há ciclo de módulos; as primitivas abaixo são cópias mínimas das de lib.ts.

type V3 = [number, number, number];

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const cyl = (rt: number, rb: number, h: number, seg: number, x = 0, y = 0, z = 0) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y + h / 2, z);
const cone = (r: number, h: number, seg: number, x = 0, y = 0, z = 0) => new THREE.ConeGeometry(r, h, seg).translate(x, y + h / 2, z);
const oct = (r: number) => new THREE.OctahedronGeometry(r, 0);

function tri(a: V3, b: V3, c: V3) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...a, ...b, ...c]), 3));
  return g;
}

/** Barra de seção quadrada entre dois pontos (correntes, vigas inclinadas). */
function strut(a: V3, b: V3, t: number) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const g = new THREE.BoxGeometry(t, dir.length(), t);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  return g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
}

// ---------------------------------------------------------------- empenas

/**
 * Empena holandesa da fachada de uma casa de telhado de duas águas com cumeeira ao longo de z (a fachada fica em
 * z = ±d/2, com a largura `w` em x). Uma folha só (sem espessura), uma por fachada: `bell` é a empena de sino
 * (cintura estreita e remate arredondado, em arenito claro), `neck` é a de pescoço (ombros em rampa e um pescoço
 * reto e alto, em tijolo, com a viga de içamento no alto). A base acompanha o telhado (y = h) e o perfil sobe
 * além da cumeeira (`rh`), então a empena esconde o triângulo do telhado.
 */
export function dutchGableParts(style: 'bell' | 'neck', w: number, d: number, h: number, rh: number, brick: string, stone: string): Part[] {
  // Perfil da metade direita (x ≥ 0), de baixo para cima: [x em frações de w/2, y em frações de rh].
  const half: [number, number][] =
    style === 'bell'
      ? [[1.04, 0], [1.04, 0.22], [0.86, 0.4], [0.58, 0.52], [0.46, 0.68], [0.48, 0.9], [0.62, 1.08], [0.6, 1.22], [0.4, 1.34], [0.18, 1.4], [0, 1.42]]
      : [[1.04, 0], [1.04, 0.2], [0.84, 0.3], [0.7, 0.55], [0.5, 0.62], [0.5, 1.2], [0.58, 1.26], [0.58, 1.36], [0, 1.36]];
  const pts = [...half.map(([x, y]) => new THREE.Vector2((x * w) / 2, y * rh)), ...half.slice(0, -1).reverse().map(([x, y]) => new THREE.Vector2((-x * w) / 2, y * rh))];
  const shape = new THREE.Shape(pts);
  const face = (sign: 1 | -1) => {
    const g = new THREE.ShapeGeometry(shape);
    // A folha olha para fora da fachada: a ordem dos vértices do ShapeGeometry olha para +z.
    if (sign < 0) g.rotateY(Math.PI);
    return g.translate(0, h, sign * (d / 2 + 0.004));
  };
  const color = style === 'bell' ? stone : brick;
  const parts: Part[] = [{ geo: face(1), color }, { geo: face(-1), color }];
  const top = h + 1.36 * rh;
  // Cornija de arenito no remate e, no pescoço, a viga de içamento com a roldana (o gancho das mudanças).
  if (style === 'neck') {
    for (const sg of [1, -1]) {
      parts.push({ geo: box(w * 0.5, 0.006, 0.014, 0, top - 0.002, sg * (d / 2 + 0.006)), color: stone });
      parts.push({ geo: box(0.006, 0.006, 0.03, 0, top - 0.012, sg * (d / 2 + 0.018)), color: '#3e3530' });
      parts.push({ geo: box(0.003, 0.02, 0.003, 0, top - 0.032, sg * (d / 2 + 0.03)), color: '#3e3530' });
    }
  } else {
    for (const sg of [1, -1]) parts.push({ geo: oct(0.008).translate(0, top + 0.004, sg * (d / 2 + 0.004)), color: '#c9a24a' });
  }
  return parts;
}

// ---------------------------------------------------------------- árvore

/** Álamo (choupo-da-lombardia): coluna estreita e alta de três blocos, para as alamedas e os cortinados de pôlder. */
export function poplarParts(trunk: THREE.ColorRepresentation, far: boolean): Part[] {
  const blob = (r: number, sx: number, sy: number, y: number) => {
    const g = far ? new THREE.OctahedronGeometry(r, 0) : new THREE.IcosahedronGeometry(r, 0);
    return g.scale(sx, sy, sx).translate(0, y, 0);
  };
  return [
    ...(far ? [] : [{ geo: new THREE.CylinderGeometry(0.0105, 0.015, 0.07, 5, 1, true).translate(0, 0.035, 0), color: trunk, grad: [0.8, 1.05, 0, 0.07] as [number, number, number, number] }]),
    { geo: blob(0.082, 0.62, 1.55, 0.2), color: '#fff', tint: 1, grad: [0.78, 1.0, 0.06, 0.34] },
    { geo: blob(0.058, 0.55, 1.7, 0.37), color: '#fff', tint: 1, grad: [0.9, 1.1, 0.24, 0.5] },
  ];
}

// ---------------------------------------------------------------- plantação

/** Jacinto: espiga cônica de florzinhas sobre duas folhas largas (a cor da flor vem da fileira). */
export function bulbParts(): Part[] {
  const spike = (r: number, h: number, y: number) => ({ geo: new THREE.ConeGeometry(r, h, 5, 1, true).translate(0, y + h / 2, 0), color: '#fff', tint: 1, grad: [0.8, 1.14, 0.03, 0.08] as [number, number, number, number] });
  // 13 triângulos (a tulipa tem 15): duas folhas, o caule e a espiga em dois cones abertos.
  return [
    { geo: tri([-0.005, 0, 0], [0.005, 0, 0], [0.004, 0.034, 0.014]), color: '#4f8a3a' },
    { geo: tri([0, 0, -0.005], [0, 0, 0.005], [-0.014, 0.03, -0.004]), color: '#4f8a3a' },
    { geo: tri([-0.002, 0, 0], [0.002, 0, 0], [0, 0.034, 0]), color: '#5f8a3a' },
    spike(0.0125, 0.034, 0.03),
    spike(0.008, 0.026, 0.052),
  ];
}

// ---------------------------------------------------------------- bichos

/** Pato: corpo gordo e baixo de cor da instância, cabeça verde-escura (ou da instância) e bico laranja. */
export function duckParts(): Part[] {
  return [
    { geo: new THREE.IcosahedronGeometry(0.014, 0).scale(1.5, 0.8, 0.95).translate(0, 0.012, 0), color: '#fff', tint: 1 },
    { geo: tri([-0.02, 0.014, 0.0], [-0.032, 0.026, 0.0], [-0.014, 0.02, 0.006]), color: '#fff', tint: 1 },
    { geo: oct(0.0075).translate(0.018, 0.027, 0), color: '#2d5a3a' },
    { geo: box(0.01, 0.003, 0.006, 0.026, 0.024, 0), color: '#e0902a' },
  ];
}

// ---------------------------------------------------------------- barco

/** Casco de fundo chato: proa e popa afinadas, com a quina arredondada pela inclinação do costado. */
function flatHull(len: number, w: number, h: number) {
  const g = new THREE.BoxGeometry(len, h, w, 4, 1, 1).toNonIndexed();
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = Math.abs(x) / (len / 2);
    const taper = t > 0.62 ? 1 - ((t - 0.62) / 0.38) * 0.82 : 1;
    p.setXYZ(i, x, y + h / 2 + (t > 0.8 && y > 0 ? (t - 0.8) * h * 1.4 : 0), z * taper * (y < 0 ? 0.82 : 1));
  }
  return g;
}

/**
 * Tjalk: barco de carga de fundo chato dos rios e do Zuiderzee, com as quilhas laterais (leeboards) em pá, mastro
 * curto, vela de gávea marrom-ferrugem, buja na proa e a cabine pequena na popa. ~110 triângulos.
 */
export function tjalkParts(hull: string, sail: string): Part[] {
  const wood = '#4a3a30';
  return [
    { geo: flatHull(0.15, 0.044, 0.024), color: hull },
    { geo: box(0.15, 0.004, 0.046, 0, 0.022), color: '#7a5a3c' },
    { geo: box(0.03, 0.02, 0.028, -0.052, 0.024), color: '#f1e6d2' },
    { geo: box(0.034, 0.004, 0.032, -0.052, 0.044), color: '#3e3530' },
    // Leeboards: pás arredondadas que pendem dos dois bordos, inclinadas para fora.
    ...[1, -1].map((s) => ({ geo: new THREE.BoxGeometry(0.036, 0.004, 0.026).rotateX(s * 0.55).translate(0.01, 0.014, s * 0.034), color: '#6a4a32' })),
    // Mastro, retranca e vela de gávea (um quadrilátero de dois triângulos) mais a buja.
    { geo: cyl(0.0025, 0.003, 0.14, 4, 0.012, 0.02), color: wood },
    { geo: strut([-0.05, 0.05, 0], [0.012, 0.06, 0], 0.003), color: wood },
    { geo: strut([-0.044, 0.07, 0], [0.0, 0.16, 0], 0.0025), color: wood },
    { geo: tri([0.01, 0.052, 0], [0.01, 0.15, 0], [-0.05, 0.052, 0]), color: sail },
    { geo: tri([0.01, 0.15, 0], [0.01, 0.052, 0], [-0.05, 0.052, 0]), color: sail },
    { geo: tri([-0.05, 0.052, 0], [-0.044, 0.138, 0], [0.01, 0.15, 0]), color: sail },
    { geo: tri([-0.044, 0.138, 0], [-0.05, 0.052, 0], [0.01, 0.15, 0]), color: sail },
    { geo: tri([0.016, 0.05, 0], [0.016, 0.13, 0], [0.07, 0.034, 0]), color: '#e8dcc4' },
    { geo: tri([0.016, 0.13, 0], [0.016, 0.05, 0], [0.07, 0.034, 0]), color: '#e8dcc4' },
  ];
}

// ---------------------------------------------------------------- ponte e portão

/**
 * Ponte levadiça de contrapeso (aqui fechada): tabuleiro plano e baixo entre dois encontros de tijolo, e sobre cada
 * encontro um pórtico de dois postes com a viga de balanço inclinada e a corrente que desce até o tabuleiro. A ponte
 * atravessa ao longo de x (a água corre em z), como as outras. Madeira escura com guarda-corpo branco.
 */
export function drawbridgeParts(main: string, det: string): Part[] {
  const L = 0.31;
  const deckY = 0.05;
  const parts: Part[] = [];
  parts.push({ geo: box(2 * L - 0.1, 0.012, 0.078, 0, deckY - 0.012), color: main });
  for (const z of [0.04, -0.04]) {
    parts.push({ geo: box(2 * L - 0.1, 0.006, 0.006, 0, deckY + 0.026, z), color: det });
    for (let i = 0; i <= 5; i++) parts.push({ geo: box(0.005, 0.03, 0.005, -L + 0.05 + ((2 * L - 0.1) * i) / 5, deckY, z), color: det });
  }
  for (const s of [1, -1]) {
    const x = s * (L - 0.05);
    // Encontro de tijolo, do fundo do leito ao tabuleiro.
    parts.push({ geo: box(0.1, deckY + 0.02, 0.11, x, -0.03), color: '#a0553a', grad: [0.75, 1.05, -0.03, deckY] });
    parts.push({ geo: box(0.106, 0.008, 0.116, x, deckY - 0.004), color: '#d8cdb6' });
    // Pórtico: dois postes e a travessa; a viga de balanço sobe inclinada para o lado de fora do vão.
    for (const z of [0.052, -0.052]) {
      parts.push({ geo: box(0.01, 0.13, 0.01, x - s * 0.02, deckY, z), color: main });
      parts.push({ geo: strut([x - s * 0.02, deckY + 0.12, z], [x + s * 0.045, deckY + 0.185, z], 0.008), color: main });
      parts.push({ geo: strut([x - s * 0.02, deckY + 0.12, z], [x - s * 0.17, deckY + 0.185, z], 0.006), color: main });
      // Corrente: da ponta da viga ao tabuleiro, no lado do vão.
      parts.push({ geo: strut([x - s * 0.17, deckY + 0.185, z], [x - s * 0.17, deckY + 0.02, z], 0.0025), color: '#2a2622' });
    }
    parts.push({ geo: box(0.01, 0.01, 0.114, x - s * 0.02, deckY + 0.12), color: main });
    // Contrapeso: caixa de pedra na ponta da viga do lado de terra.
    parts.push({ geo: box(0.02, 0.026, 0.1, x + s * 0.052, deckY + 0.16), color: '#8a8478' });
  }
  return parts;
}

/**
 * Portão de cidade de tijolo (stadspoort): dois pilares de tijolo, o arco do passadiço, um frontão de degraus e,
 * no alto, a torrezinha com o relógio. A via passa ao longo de z (os pilares ficam em x).
 */
export function brickGateParts(brick: string, stone: string): Part[] {
  const parts: Part[] = [];
  for (const x of [-0.13, 0.13]) {
    parts.push({ geo: box(0.07, 0.17, 0.09, x), color: brick, grad: [0.75, 1.05, 0, 0.17] });
    parts.push({ geo: box(0.078, 0.01, 0.098, x, 0.0), color: stone });
    parts.push({ geo: box(0.078, 0.008, 0.098, x, 0.17), color: stone });
  }
  parts.push({ geo: box(0.2, 0.05, 0.09, 0, 0.14), color: brick });
  for (let i = 0; i < 3; i++) parts.push({ geo: box(0.28 - i * 0.07, 0.014, 0.092, 0, 0.19 + i * 0.014), color: i % 2 ? brick : stone });
  parts.push({ geo: box(0.05, 0.05, 0.05, 0, 0.232), color: stone });
  parts.push({ geo: cone(0.04, 0.05, 4, 0, 0.282).rotateY(Math.PI / 4), color: '#3e4a56' });
  parts.push({ geo: new THREE.CircleGeometry(0.014, 10).translate(0, 0.258, 0.0255), color: '#f4ecd8', glow: 0.25 });
  parts.push({ geo: new THREE.CircleGeometry(0.014, 10).rotateY(Math.PI).translate(0, 0.258, -0.0255), color: '#f4ecd8', glow: 0.25 });
  return parts;
}

// ---------------------------------------------------------------- easter eggs

/** Queijo gigante: roda de gouda amarela com casca de cera vermelha e uma cunha cortada. */
export function cheeseParts(): Part[] {
  return [
    { geo: cyl(0.06, 0.062, 0.05, 14), color: '#e8b830', grad: [0.82, 1.08, 0, 0.05] },
    { geo: cyl(0.055, 0.06, 0.012, 14, 0, 0.05), color: '#c8201a' },
    { geo: new THREE.CircleGeometry(0.052, 14).rotateX(-Math.PI / 2).translate(0, 0.0625, 0), color: '#d83a2a' },
    { geo: new THREE.BoxGeometry(0.03, 0.04, 0.062).rotateY(0.5).translate(0.052, 0.03, 0.02), color: '#f4d25a' },
  ];
}

/** O menino do dique: agachado, de barrete azul e tamancos, com o dedo no buraco e uma gota que escorre. */
export function dikeBoyParts(): Part[] {
  return [
    // Trecho de dique com o buraco.
    { geo: box(0.09, 0.05, 0.05), color: '#7c6a54', grad: [0.75, 1.05, 0, 0.05] },
    { geo: new THREE.CircleGeometry(0.007, 6).translate(0.0, 0.026, 0.0253), color: '#1e1a16' },
    // O menino.
    { geo: box(0.016, 0.02, 0.012, -0.012, 0.0, 0.052), color: '#3a5a8a' },
    { geo: box(0.014, 0.02, 0.012, -0.012, 0.018, 0.052), color: '#c0392b' },
    { geo: oct(0.0085).translate(-0.012, 0.047, 0.052), color: '#e8bfa0' },
    { geo: cone(0.0095, 0.012, 5, -0.012, 0.052, 0.052), color: '#2f4a7a' },
    { geo: strut([-0.006, 0.03, 0.054], [0.0, 0.028, 0.03], 0.004), color: '#e8bfa0' },
    // A gota (brilha de leve).
    { geo: oct(0.0042).scale(0.8, 1.4, 0.8).translate(0.004, 0.012, 0.03), color: '#9fd0ef', glow: 0.4 },
  ];
}

// ---------------------------------------------------------------- moinho de vento

/**
 * Moinho de vento holandês (grondzeiler): torre octogonal afunilada sobre um soco de pedra, galeria baixa em volta,
 * boné redondo no alto, eixo das pás saindo à frente e o rabo (a vara de girar o boné) descendo atrás. O cubo das
 * pás fica em (0, 0,255, +0,078), a mesma posição do moinho antigo (as pás de `sailsGeometry` não mudam).
 */
export function windmillParts(wall: string, roof: string, det: string, win: string, door: string): Part[] {
  return [
    { geo: cyl(0.074, 0.084, 0.03, 8), color: '#8a7a6a' },
    { geo: cyl(0.04, 0.066, 0.2, 8, 0, 0.03), color: wall, grad: [0.88, 1.06, 0.03, 0.23] },
    // Galeria: o passadiço de madeira a meio da torre, com a mureta.
    { geo: cyl(0.078, 0.078, 0.012, 8, 0, 0.098), color: det },
    // Boné: meia-esfera achatada e o eixo das pás à frente.
    { geo: new THREE.SphereGeometry(0.052, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1).translate(0, 0.228, 0), color: roof },
    { geo: cyl(0.007, 0.007, 0.05, 6).rotateX(Math.PI / 2).translate(0, 0.255, 0.06), color: '#4a3a30' },
    // Rabo e escadinha atrás.
    { geo: strut([0, 0.245, -0.045], [0, 0.04, -0.15], 0.006), color: det },
    { geo: box(0.036, 0.006, 0.006, 0, 0.05, -0.138), color: det },
    { geo: box(0.02, 0.04, 0.006, 0, 0.03, 0.066), color: door },
    { geo: box(0.014, 0.018, 0.006, 0, 0.14, 0.056), color: win, glow: 1 },
    { geo: box(0.014, 0.018, 0.006, 0, 0.17, -0.049), color: win, glow: 1 },
  ];
}
