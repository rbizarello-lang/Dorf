import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AnimalKind, BoatKind, BodyStyle, CropStyle, HouseKind, Landmark, RoofStyle, Theme, TreeGeo, VehicleKind } from '../themes/types';

// Biblioteca de "kits": geometrias low-poly com cor por vértice, montadas por tema.
// Cada chave vira um InstancedMesh (1 draw call para milhares de cópias).
// Atributos extras por vértice:
//   tint = 1 → a cor da instância tinge esta parte (copa, parede); 0 → cor fixa (tronco, janela)
//   glow = 1 → parte acende à noite (janelas, luzes)

type Col = THREE.ColorRepresentation;

interface Part {
  geo: THREE.BufferGeometry;
  color: Col;
  tint?: number;
  glow?: number;
  /** Gradiente vertical: fator de cor na base e no topo, entre y0 e y1. */
  grad?: [number, number, number, number];
}

const tmpC = new THREE.Color();

function kit(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const tint = new Float32Array(n).fill(p.tint ?? 0);
    const glow = new Float32Array(n).fill(p.glow ?? 0);
    tmpC.set(p.color);
    const pos = g.attributes.position;
    for (let i = 0; i < n; i++) {
      let f = 1;
      if (p.grad) {
        const [a, b, y0, y1] = p.grad;
        const t = THREE.MathUtils.clamp((pos.getY(i) - y0) / (y1 - y0 || 1), 0, 1);
        f = a + (b - a) * t;
      }
      col[i * 3] = tmpC.r * f;
      col[i * 3 + 1] = tmpC.g * f;
      col[i * 3 + 2] = tmpC.b * f;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 1));
    g.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
    return g;
  });
  const out = mergeGeometries(geos)!;
  out.computeVertexNormals();
  return out;
}

// ---------------------------------------------------------------- primitivas

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const cyl = (rt: number, rb: number, h: number, seg: number, x = 0, y = 0, z = 0) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y + h / 2, z);
const cone = (r: number, h: number, seg: number, x = 0, y = 0, z = 0) => new THREE.ConeGeometry(r, h, seg).translate(x, y + h / 2, z);
const ico = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);
const oct = (r: number) => new THREE.OctahedronGeometry(r, 0);

function jitter(geo: THREE.BufferGeometry, amount: number, seed: number) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position as THREE.BufferAttribute;
  // Mesma posição → mesmo deslocamento, para a malha não abrir frestas.
  const h = (x: number, y: number, z: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453;
    return s - Math.floor(s) - 0.5;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    pos.setXYZ(i, x + h(x, y, z) * amount, y + h(y, z, x) * amount * 0.6, z + h(z, x, y) * amount);
  }
  return g;
}

/** Triângulo avulso (lâminas de capim/trigo). */
function tri(a: number[], b: number[], c: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...a, ...b, ...c]), 3));
  return g;
}

/** Lâmina em forma de pipa (base estreita, espiga larga, ponta): 2 triângulos. */
function blade(h: number, w: number, lean: number, ang: number, earAt = 0.68, droop = 0) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (x: number, y: number, z: number) => [x * c - z * s + lean * c * y / h, y, x * s + z * c + lean * s * y / h];
  const top = P(droop, h, 0);
  const l = P(-w, h * earAt, 0), r = P(w, h * earAt, 0);
  const bl = P(-w * 0.35, 0, 0), br = P(w * 0.35, 0, 0);
  return [tri(bl, br, r), tri(bl, r, l), tri(l, r, top)];
}

/** Casco de barco: caixa com proa e popa afinadas. */
function hull(len: number, w: number, h: number) {
  const g = new THREE.BoxGeometry(len, h, w, 4, 1, 1).toNonIndexed();
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = Math.abs(x) / (len / 2);
    const taper = t > 0.45 ? 1 - (t - 0.45) / 0.55 : 1;
    const lift = t > 0.6 ? (t - 0.6) * h * 1.2 : 0;
    p.setXYZ(i, x, y + h / 2 + lift * (y > 0 ? 1 : 0.4), z * Math.max(0.05, taper) * (y < 0 ? 0.7 : 1));
  }
  return g;
}

// ---------------------------------------------------------------- casas

export interface HouseMeta {
  /** Altura da parede e topo do telhado (escala 1). */
  h: number;
  top: number;
  /** Ponto de saída da fumaça, ou null. */
  chimney: [number, number, number] | null;
}

const BODY: Record<BodyStyle, { w: number; h: number; d: number }> = {
  cottage: { w: 0.14, h: 0.11, d: 0.12 },
  long: { w: 0.24, h: 0.085, d: 0.11 },
  cube: { w: 0.12, h: 0.1, d: 0.12 },
  tall: { w: 0.1, h: 0.2, d: 0.13 },
  round: { w: 0.14, h: 0.09, d: 0.14 },
};

const DOOR = '#4a3326';

function windowsFor(style: BodyStyle, win: Col, w: number, h: number, d: number): Part[] {
  const parts: Part[] = [];
  // Janelas são planos (2 triângulos) voltados para fora da parede.
  const pane = (gw: number, gh: number, x: number, y: number, z: number, rotY: number) => new THREE.PlaneGeometry(gw, gh).rotateY(rotY).translate(x, y + gh / 2, z);
  const glass = (gw: number, gh: number, x: number, y: number, z: number, face: 'x' | 'z') => {
    const rot = face === 'z' ? (z > 0 ? 0 : Math.PI) : x > 0 ? Math.PI / 2 : -Math.PI / 2;
    parts.push({ geo: pane(gw, gh, x, y, z, rot), color: win, glow: 1 });
  };
  const fz = d / 2 + 0.001, bz = -d / 2 - 0.001, sx = w / 2 + 0.001;
  if (style === 'round') {
    for (const a of [0.9, -0.9, Math.PI - 0.6, Math.PI + 0.6]) {
      const g = new THREE.PlaneGeometry(0.018, 0.02).rotateY(a).translate(Math.sin(a) * (w / 2 + 0.001), h * 0.5, Math.cos(a) * (w / 2 + 0.001));
      parts.push({ geo: g, color: win, glow: 1 });
    }
    parts.push({ geo: pane(0.026, 0.05, 0, 0, w / 2 + 0.001, 0), color: DOOR });
    return parts;
  }
  const floors = style === 'tall' ? 3 : 1;
  const cols = style === 'long' ? [-0.075, -0.03, 0.03, 0.075] : style === 'tall' ? [-0.024, 0.024] : [-0.042, 0.042];
  const ws = style === 'cube' ? 0.016 : 0.02;
  for (let f = 0; f < floors; f++) {
    const y = floors > 1 ? 0.035 + f * 0.058 : h * 0.42;
    for (const x of cols) {
      if (f === 0 && Math.abs(x) < 0.03 && style !== 'long') continue;
      glass(ws, ws * 1.15, x, y, fz, 'z');
      glass(ws, ws * 1.15, x, y, bz, 'z');
    }
  }
  if (style !== 'tall') {
    glass(ws, ws * 1.15, sx, h * 0.42, 0, 'x');
    glass(ws, ws * 1.15, -sx, h * 0.42, 0, 'x');
  }
  const doorX = style === 'long' ? 0 : 0;
  parts.push({ geo: pane(0.026, style === 'tall' ? 0.055 : 0.05, doorX, 0, fz + 0.001, 0), color: DOOR });
  return parts;
}

function trimFor(style: BodyStyle, trim: Col, w: number, h: number, d: number): Part[] {
  if (style === 'round') return [{ geo: cyl(w / 2 + 0.004, w / 2 + 0.004, 0.012, 12, 0, h - 0.012), color: trim }];
  const t = 0.007;
  const parts: Part[] = [];
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) parts.push({ geo: box(t, h, t, x, 0, z), color: trim });
  const beams = style === 'tall' ? [0.066, 0.124] : [h * 0.62];
  for (const y of beams) {
    parts.push({ geo: new THREE.PlaneGeometry(w + t, t).translate(0, y + t / 2, d / 2 + 0.002), color: trim });
    parts.push({ geo: new THREE.PlaneGeometry(w + t, t).rotateY(Math.PI).translate(0, y + t / 2, -d / 2 - 0.002), color: trim });
    parts.push({ geo: new THREE.PlaneGeometry(d + t, t).rotateY(Math.PI / 2).translate(w / 2 + 0.002, y + t / 2, 0), color: trim });
    parts.push({ geo: new THREE.PlaneGeometry(d + t, t).rotateY(-Math.PI / 2).translate(-w / 2 - 0.002, y + t / 2, 0), color: trim });
  }
  return parts;
}

function wallGeometry(k: HouseKind, win: Col) {
  const { w, h, d } = BODY[k.body];
  const body = k.body === 'round' ? cyl(w / 2, w / 2, h, 12) : box(w, h, d);
  const parts: Part[] = [{ geo: body, color: '#ffffff', tint: 1 }, ...windowsFor(k.body, win, w, h, d)];
  if (k.trim) parts.push(...trimFor(k.body, k.trim, w, h, d));
  // Soco (base) um pouco mais escuro dá peso à casa.
  if (k.body !== 'round') parts.push({ geo: box(w + 0.004, 0.012, d + 0.004), color: '#8a7a6a' });
  return kit(parts);
}

function roofGeometry(style: RoofStyle, body: BodyStyle, chimney: boolean): { geo: THREE.BufferGeometry; top: number; chim: [number, number, number] | null } {
  const { w, h, d } = BODY[body];
  const o = 0.016; // beiral
  const parts: Part[] = [];
  let top = h;
  const round = body === 'round';
  switch (style) {
    case 'flat': {
      parts.push({ geo: box(w + 0.01, 0.014, d + 0.01, 0, h), color: '#fff', tint: 1 });
      parts.push({ geo: box(w + 0.01, 0.012, 0.008, 0, h + 0.014, d / 2), color: '#fff', tint: 1 });
      parts.push({ geo: box(w + 0.01, 0.012, 0.008, 0, h + 0.014, -d / 2), color: '#fff', tint: 1 });
      top = h + 0.026;
      break;
    }
    case 'dome': {
      const r = Math.max(w, d) / 2 + 0.004;
      parts.push({ geo: new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, h, 0), color: '#fff', tint: 1, glow: 0.35 });
      top = h + r;
      break;
    }
    case 'cone': {
      const r = (round ? w / 2 : Math.max(w, d) / 2) + o;
      const rh = 0.09;
      parts.push({ geo: cone(r, rh, round ? 12 : 4, 0, h, 0).rotateY(round ? 0 : Math.PI / 4), color: '#fff', tint: 1 });
      top = h + rh;
      break;
    }
    case 'hip': {
      const rh = 0.07;
      const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);
      g.scale(w + o * 2, rh, d + o * 2).translate(0, h + rh / 2, 0);
      parts.push({ geo: g, color: '#fff', tint: 1 });
      top = h + rh;
      break;
    }
    case 'pagoda': {
      const a = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).scale(w + 0.05, 0.05, d + 0.05).translate(0, h + 0.025, 0);
      const b = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).scale(w * 0.62, 0.06, d * 0.62).translate(0, h + 0.06, 0);
      parts.push({ geo: a, color: '#fff', tint: 1 }, { geo: b, color: '#fff', tint: 1 });
      parts.push({ geo: box(w * 0.5, 0.02, d * 0.5, 0, h + 0.02), color: '#fff', tint: 1 });
      top = h + 0.09;
      break;
    }
    case 'thatch': {
      const r = d / 2 + o * 0.8;
      // Meio cilindro deitado: o arco fica para cima depois do rotateZ.
      const g = new THREE.CylinderGeometry(r, r, w + o * 1.5, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
      g.scale(1, 0.8, 1).translate(0, h, 0);
      parts.push({ geo: g, color: '#fff', tint: 1, grad: [0.85, 1.08, h, h + r] });
      top = h + r * 0.8;
      break;
    }
    case 'stepgable': {
      const rh = 0.085;
      const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2);
      g.scale(d + 0.01, rh / 1.5, (w + 0.01) / 1.732).translate(0, h + rh / 3, 0).rotateY(Math.PI / 2);
      parts.push({ geo: g, color: '#fff', tint: 1 });
      // Empena escalonada na fachada: degraus da cor da parede (tijolo).
      for (const z of [d / 2 + 0.004, -d / 2 - 0.004]) {
        for (let s = 0; s < 3; s++) {
          const sw = w * (1 - s * 0.3);
          parts.push({ geo: box(sw, rh / 3 + 0.006, 0.012, 0, h + (s * rh) / 3, z), color: '#9a4a32' });
        }
      }
      top = h + rh;
      break;
    }
    default: {
      // gable / turf: prisma com cumeeira ao longo de x.
      const rh = style === 'turf' ? 0.06 : 0.07;
      const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2);
      g.scale(w + o * 2, rh / 1.5, (d + o * 2) / 1.732).translate(0, h + rh / 3, 0);
      parts.push({ geo: g, color: '#fff', tint: 1 });
      if (style === 'turf') parts.push({ geo: box(w + o * 2 + 0.004, 0.01, 0.01, 0, h + rh - 0.004), color: '#6a8a3a' });
      top = h + rh;
    }
  }
  let chim: [number, number, number] | null = null;
  if (chimney && style !== 'dome' && !round) {
    const cx = w * 0.26;
    const cy = style === 'flat' ? h + 0.02 : h + (top - h) * 0.45;
    parts.push({ geo: box(0.018, top - cy + 0.018, 0.018, cx, cy, -d * 0.12), color: '#7a6a60' });
    chim = [cx, top + 0.03, -d * 0.12];
  }
  return { geo: kit(parts), top, chim };
}

// ---------------------------------------------------------------- árvores

function treeGeometry(geo: TreeGeo, trunk: Col): THREE.BufferGeometry {
  const T = (h: number, r = 0.02) => ({ geo: cyl(r * 0.7, r, h, 5), color: trunk, grad: [0.8, 1.05, 0, h] as [number, number, number, number] });
  switch (geo) {
    case 'conifer':
      return kit([
        T(0.1),
        { geo: cone(0.11, 0.2, 7, 0, 0.09), color: '#fff', tint: 1, grad: [0.78, 1.0, 0.09, 0.47] },
        { geo: cone(0.085, 0.17, 7, 0, 0.2), color: '#fff', tint: 1, grad: [0.85, 1.05, 0.09, 0.47] },
        { geo: cone(0.055, 0.14, 7, 0, 0.31), color: '#fff', tint: 1, grad: [0.9, 1.1, 0.09, 0.47] },
      ]);
    case 'round':
      return kit([T(0.13), { geo: jitter(ico(0.1, 1), 0.018, 1).scale(1, 1.1, 1).translate(0, 0.21, 0), color: '#fff', tint: 1, grad: [0.8, 1.08, 0.1, 0.32] }]);
    case 'blossom':
      return kit([
        T(0.14),
        { geo: jitter(ico(0.085, 1), 0.02, 2).translate(0.035, 0.2, 0.01), color: '#fff', tint: 1, grad: [0.85, 1.08, 0.12, 0.34] },
        { geo: jitter(ico(0.075, 1), 0.02, 3).translate(-0.045, 0.22, -0.02), color: '#fff', tint: 1, grad: [0.85, 1.08, 0.12, 0.34] },
        { geo: jitter(ico(0.065, 1), 0.02, 4).translate(0, 0.28, 0.02), color: '#fff', tint: 1, grad: [0.85, 1.08, 0.12, 0.34] },
      ]);
    case 'palm': {
      const parts: Part[] = [];
      let x = 0;
      for (let i = 0; i < 4; i++) {
        parts.push({ geo: cyl(0.014, 0.017, 0.085, 5, x, i * 0.082, 0), color: trunk, grad: [0.85, 1.05, 0, 0.34] });
        x += 0.008;
      }
      for (let i = 0; i < 7; i++) {
        const leaf = new THREE.ConeGeometry(0.03, 0.2, 3, 1).rotateZ(-Math.PI / 2 - 0.5).translate(0.09, 0.32, 0).rotateY((i / 7) * Math.PI * 2 + 0.3);
        parts.push({ geo: leaf.translate(x, 0, 0), color: '#fff', tint: 1 });
      }
      parts.push({ geo: oct(0.012).translate(x + 0.01, 0.315, 0.01), color: '#6a4a2a' });
      return kit(parts);
    }
    case 'crystal':
      return kit([
        { geo: oct(0.06).scale(1, 2.6, 1).translate(0, 0.15, 0), color: '#fff', tint: 1 },
        { geo: oct(0.04).scale(1, 2.4, 1).rotateZ(0.35).translate(0.06, 0.09, 0.02), color: '#fff', tint: 1 },
        { geo: oct(0.035).scale(1, 2.2, 1).rotateZ(-0.4).translate(-0.05, 0.08, -0.03), color: '#fff', tint: 1 },
      ]);
    case 'cypress':
      return kit([T(0.06, 0.016), { geo: jitter(ico(0.1, 1), 0.012, 5).scale(0.42, 2.0, 0.42).translate(0, 0.25, 0), color: '#fff', tint: 1, grad: [0.75, 1.05, 0.05, 0.45] }]);
    case 'olive':
      return kit([
        { geo: cyl(0.014, 0.024, 0.09, 5).rotateZ(0.25), color: trunk },
        { geo: cyl(0.012, 0.016, 0.06, 5).rotateZ(-0.5).translate(0.03, 0.06, 0), color: trunk },
        { geo: jitter(ico(0.1, 1), 0.02, 6).scale(1.35, 0.62, 1.2).translate(0.01, 0.15, 0), color: '#fff', tint: 1, grad: [0.8, 1.1, 0.1, 0.2] },
      ]);
    case 'oak':
      return kit([
        T(0.13, 0.028),
        { geo: jitter(ico(0.09, 1), 0.02, 7).translate(0, 0.25, 0), color: '#fff', tint: 1, grad: [0.78, 1.08, 0.12, 0.34] },
        { geo: jitter(ico(0.072, 0), 0.016, 8).translate(0.07, 0.19, 0.02), color: '#fff', tint: 1, grad: [0.78, 1.08, 0.12, 0.34] },
        { geo: jitter(ico(0.072, 0), 0.016, 9).translate(-0.06, 0.2, -0.03), color: '#fff', tint: 1, grad: [0.78, 1.08, 0.12, 0.34] },
      ]);
    case 'birch':
      return kit([
        { geo: cyl(0.011, 0.015, 0.22, 5), color: '#ece8e0' },
        { geo: cyl(0.0155, 0.0155, 0.008, 5, 0, 0.05), color: '#3a3430' },
        { geo: cyl(0.0145, 0.0145, 0.008, 5, 0, 0.11), color: '#3a3430' },
        { geo: jitter(ico(0.06, 1), 0.015, 10).scale(0.9, 1.4, 0.9).translate(0.01, 0.24, 0), color: '#fff', tint: 1, grad: [0.85, 1.1, 0.15, 0.32] },
        { geo: jitter(ico(0.045, 1), 0.012, 11).translate(-0.03, 0.18, 0.02), color: '#fff', tint: 1 },
      ]);
    case 'cactus':
      return kit([
        { geo: cyl(0.022, 0.026, 0.26, 8), color: '#fff', tint: 1, grad: [0.85, 1.05, 0, 0.26] },
        { geo: new THREE.SphereGeometry(0.022, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.26, 0), color: '#fff', tint: 1 },
        { geo: cyl(0.013, 0.013, 0.05, 6).rotateZ(Math.PI / 2).translate(0.04, 0.12, 0), color: '#fff', tint: 1 },
        { geo: cyl(0.013, 0.014, 0.08, 6, 0.064, 0.12, 0), color: '#fff', tint: 1 },
        { geo: cyl(0.012, 0.012, 0.04, 6).rotateZ(Math.PI / 2).translate(-0.035, 0.08, 0), color: '#fff', tint: 1 },
        { geo: cyl(0.012, 0.013, 0.06, 6, -0.055, 0.08, 0), color: '#fff', tint: 1 },
      ]);
    case 'bamboo': {
      const parts: Part[] = [];
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        const r = 0.012 + (i % 3) * 0.018;
        const h = 0.28 + (i % 4) * 0.05;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        parts.push({ geo: cyl(0.0055, 0.0065, h, 4, x, 0, z).rotateZ((x > 0 ? -1 : 1) * 0.06), color: '#fff', tint: 1, grad: [0.75, 1.0, 0, 0.4] });
        parts.push({ geo: cone(0.028, 0.07, 4, x, h - 0.05, z).rotateY(a), color: '#fff', tint: 1, grad: [0.9, 1.1, 0.2, 0.45] });
      }
      return kit(parts);
    }
    case 'araucaria': {
      const parts: Part[] = [T(0.36, 0.018)];
      for (const [x, y, z, r] of [
        [0, 0.36, 0, 0.1],
        [0.05, 0.3, 0.02, 0.07],
        [-0.05, 0.31, -0.02, 0.07],
      ] as const) {
        parts.push({ geo: cone(r, 0.05, 8, x, y, z).rotateX(Math.PI).translate(0, 2 * y + 0.05, 0), color: '#fff', tint: 1, grad: [0.8, 1.05, y, y + 0.05] });
        parts.push({ geo: cone(r * 0.95, 0.03, 8, x, y + 0.045, z), color: '#fff', tint: 1 });
      }
      return kit(parts);
    }
  }
}

// ---------------------------------------------------------------- plantações

export interface CropLayout {
  rowGap: number;
  step: number;
  scale: [number, number];
  /** Cada fileira com uma cor (tulipas, quinoa). */
  rowColor: boolean;
}

export const CROP_LAYOUT: Record<CropStyle, CropLayout> = {
  wheat: { rowGap: 0.05, step: 0.04, scale: [0.95, 1.2], rowColor: false },
  barley: { rowGap: 0.05, step: 0.04, scale: [0.95, 1.15], rowColor: false },
  rice: { rowGap: 0.044, step: 0.036, scale: [0.9, 1.1], rowColor: false },
  corn: { rowGap: 0.06, step: 0.05, scale: [0.85, 1.1], rowColor: false },
  sugarcane: { rowGap: 0.065, step: 0.05, scale: [0.9, 1.15], rowColor: false },
  tulip: { rowGap: 0.036, step: 0.028, scale: [1.05, 1.3], rowColor: true },
  lavender: { rowGap: 0.052, step: 0.04, scale: [0.8, 1.0], rowColor: false },
  sunflower: { rowGap: 0.05, step: 0.036, scale: [1.05, 1.3], rowColor: false },
  vineyard: { rowGap: 0.065, step: 0.045, scale: [1, 1.1], rowColor: false },
  papyrus: { rowGap: 0.06, step: 0.05, scale: [0.85, 1.15], rowColor: false },
  tea: { rowGap: 0.06, step: 0.05, scale: [0.95, 1.1], rowColor: false },
  coffee: { rowGap: 0.06, step: 0.05, scale: [0.9, 1.1], rowColor: false },
  cotton: { rowGap: 0.055, step: 0.045, scale: [0.9, 1.1], rowColor: false },
  quinoa: { rowGap: 0.05, step: 0.042, scale: [0.9, 1.15], rowColor: true },
  hydro: { rowGap: 0.06, step: 0.05, scale: [0.9, 1.1], rowColor: false },
};

function tuft(n: number, h: number, w: number, spread: number, earAt: number, droop = 0, seed = 1): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + r() * 0.8;
    const hh = h * (0.8 + r() * 0.35);
    const bs = blade(hh, w, spread * (0.5 + r()), ang, earAt, droop);
    const ox = Math.cos(ang) * spread * 0.4, oz = Math.sin(ang) * spread * 0.4;
    for (const b of bs) out.push(b.translate(ox, 0, oz));
  }
  return out;
}

function cropGeometry(style: CropStyle): THREE.BufferGeometry {
  const G = '#5f8a3a';
  const green = (g: THREE.BufferGeometry[]): Part[] => g.map((geo) => ({ geo, color: G }));
  const tinted = (g: THREE.BufferGeometry[], grad: [number, number, number, number]): Part[] => g.map((geo) => ({ geo, color: '#fff', tint: 1, grad }));
  switch (style) {
    case 'wheat':
      return kit(tinted(tuft(5, 0.105, 0.008, 0.022, 0.62, 0, 3), [0.55, 1.14, 0, 0.11]));
    case 'barley':
      return kit(tinted(tuft(5, 0.1, 0.0075, 0.022, 0.6, 0.022, 5), [0.58, 1.12, 0, 0.1]));
    case 'rice':
      return kit(tinted(tuft(6, 0.068, 0.0055, 0.018, 0.8, 0.008, 7), [0.65, 1.14, 0, 0.07]));
    case 'corn': {
      const parts: Part[] = [{ geo: cyl(0.004, 0.006, 0.13, 3), color: '#fff', tint: 1, grad: [0.7, 1, 0, 0.13] }];
      parts.push(...tinted(tuft(3, 0.075, 0.009, 0.03, 0.5, 0.02, 9), [0.7, 1.05, 0, 0.08]));
      parts.push({ geo: cone(0.012, 0.03, 3, 0, 0.125), color: '#e3c25a' });
      parts.push({ geo: oct(0.009).scale(0.8, 1.8, 0.8).translate(0.008, 0.07, 0), color: '#e8c860' });
      return kit(parts);
    }
    case 'sugarcane': {
      const parts: Part[] = [];
      for (const [x, z, h] of [
        [0, 0, 0.15],
        [0.012, 0.01, 0.13],
        [-0.01, 0.008, 0.14],
      ])
        parts.push({ geo: cyl(0.0035, 0.0045, h, 3, x, 0, z), color: '#fff', tint: 1, grad: [0.65, 1, 0, 0.15] });
      parts.push(...tinted(tuft(4, 0.08, 0.007, 0.035, 0.5, 0.03, 11).map((g) => g.translate(0, 0.07, 0)), [0.8, 1.1, 0.07, 0.15]));
      return kit(parts);
    }
    case 'tulip':
      return kit([
        { geo: tri([-0.002, 0, 0], [0.002, 0, 0], [0, 0.05, 0]), color: G },
        ...green(tuft(2, 0.03, 0.006, 0.01, 0.5, 0, 13)),
        { geo: oct(0.013).scale(1, 1.4, 1).translate(0, 0.056, 0), color: '#fff', tint: 1 },
      ]);
    case 'lavender':
      return kit([
        ...green(tuft(2, 0.025, 0.006, 0.012, 0.5, 0, 17)),
        { geo: jitter(ico(0.024, 0), 0.004, 12).scale(1.25, 0.8, 0.85).translate(0, 0.034, 0), color: '#fff', tint: 1, grad: [0.72, 1.12, 0.02, 0.06] },
      ]);
    case 'sunflower':
      return kit([
        { geo: cyl(0.003, 0.004, 0.1, 3), color: G },
        ...green(tuft(2, 0.05, 0.01, 0.02, 0.5, 0.01, 19)),
        { geo: new THREE.CircleGeometry(0.026, 6).rotateY(Math.PI / 2).rotateZ(-0.3).translate(0.004, 0.1, 0), color: '#fff', tint: 1 },
        { geo: new THREE.CircleGeometry(0.009, 6).rotateY(Math.PI / 2).rotateZ(-0.3).translate(0.0055, 0.1, 0), color: '#5a3a1a' },
      ]);
    case 'vineyard':
      return kit([
        { geo: box(0.005, 0.07, 0.005), color: '#6a4a32' },
        { geo: jitter(ico(0.028, 0), 0.006, 13).scale(1.6, 0.9, 0.8).translate(0, 0.05, 0), color: '#fff', tint: 1, grad: [0.8, 1.05, 0.03, 0.08] },
        { geo: oct(0.007).translate(0.012, 0.03, 0.012), color: '#5a2a5a' },
        { geo: oct(0.007).translate(-0.014, 0.032, -0.012), color: '#5a2a5a' },
      ]);
    case 'papyrus': {
      const parts: Part[] = [];
      for (const [x, z, h] of [
        [0, 0, 0.13],
        [0.012, -0.008, 0.11],
        [-0.01, 0.01, 0.12],
      ]) {
        parts.push({ geo: cyl(0.0025, 0.0035, h, 3, x, 0, z), color: '#fff', tint: 1, grad: [0.7, 1, 0, h] });
        parts.push({ geo: cone(0.02, 0.025, 6, x, h - 0.012, z).rotateX(Math.PI).translate(0, 2 * h - 0.012 + 0.013, 0), color: '#fff', tint: 1 });
      }
      return kit(parts);
    }
    case 'tea':
      return kit([{ geo: jitter(ico(0.032, 0), 0.005, 14).scale(1.2, 0.7, 1).translate(0, 0.02, 0), color: '#fff', tint: 1, grad: [0.75, 1.1, 0, 0.04] }]);
    case 'coffee':
      return kit([
        { geo: jitter(ico(0.028, 0), 0.006, 15).scale(1, 1.3, 1).translate(0, 0.035, 0), color: '#fff', tint: 1, grad: [0.7, 1.05, 0, 0.07] },
        { geo: oct(0.006).translate(0.02, 0.035, 0.01), color: '#c0282a' },
        { geo: oct(0.006).translate(-0.018, 0.04, -0.012), color: '#c0282a' },
        { geo: oct(0.006).translate(0.004, 0.05, 0.022), color: '#c0282a' },
      ]);
    case 'cotton':
      return kit([
        { geo: jitter(ico(0.024, 0), 0.005, 16).translate(0, 0.03, 0), color: '#4f7a3a' },
        { geo: oct(0.009).translate(0.015, 0.045, 0.008), color: '#fff', tint: 1 },
        { geo: oct(0.009).translate(-0.014, 0.042, -0.01), color: '#fff', tint: 1 },
        { geo: oct(0.008).translate(0.002, 0.055, -0.004), color: '#fff', tint: 1 },
      ]);
    case 'quinoa':
      return kit([...green(tuft(3, 0.05, 0.006, 0.014, 0.5, 0, 21)), { geo: oct(0.012).scale(0.9, 2.2, 0.9).translate(0, 0.07, 0), color: '#fff', tint: 1, grad: [0.8, 1.1, 0.05, 0.1] }]);
    case 'hydro':
      return kit([
        { geo: box(0.05, 0.012, 0.03), color: '#cfd6de' },
        { geo: jitter(ico(0.022, 0), 0.004, 17).scale(1.3, 0.8, 0.9).translate(0, 0.022, 0), color: '#fff', tint: 1, glow: 1 },
      ]);
  }
}

// ---------------------------------------------------------------- marcos

function landmarkGeometry(kind: Landmark, [wall, roof, det]: [string, string, string], win: Col): THREE.BufferGeometry | null {
  const gable = (w: number, rh: number, d: number, y: number) => new THREE.CylinderGeometry(1, 1, 1, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(w, rh / 1.5, d / 1.732).translate(0, y + rh / 3, 0);
  const pyr = (w: number, h: number, d: number, y: number) => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).scale(w, h, d).translate(0, y + h / 2, 0);
  switch (kind) {
    case 'church':
      return kit([
        { geo: box(0.3, 0.14, 0.15), color: wall },
        { geo: gable(0.32, 0.1, 0.17, 0.14), color: roof },
        { geo: box(0.09, 0.3, 0.09, -0.19, 0, 0), color: wall },
        { geo: pyr(0.1, 0.16, 0.1, 0.3).translate(-0.19, 0, 0), color: roof },
        { geo: box(0.006, 0.04, 0.03, -0.235, 0.2, 0), color: win, glow: 1 },
        { geo: box(0.006, 0.05, 0.03, -0.236, 0, 0), color: DOOR },
        ...[-0.08, 0, 0.08].map((x) => ({ geo: box(0.025, 0.05, 0.006, x, 0.05, 0.076), color: win, glow: 1 })),
        { geo: oct(0.012).translate(-0.19, 0.49, 0), color: det },
      ]);
    case 'baroque':
      return kit([
        { geo: box(0.2, 0.17, 0.26), color: wall },
        { geo: gable(0.22, 0.09, 0.28, 0.17).rotateY(Math.PI / 2), color: roof },
        ...[-0.085, 0.085].flatMap((z) => [
          { geo: box(0.08, 0.28, 0.08, 0.1, 0, z), color: wall },
          { geo: new THREE.SphereGeometry(0.035, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0.1, 0.28, z), color: det },
          { geo: box(0.006, 0.04, 0.025, 0.141, 0.19, z), color: win, glow: 1 },
          { geo: box(0.084, 0.012, 0.084, 0.1, 0.2, z), color: det },
        ]),
        { geo: box(0.006, 0.07, 0.05, 0.101, 0, 0), color: det },
        { geo: box(0.006, 0.03, 0.03, 0.101, 0.1, 0), color: win, glow: 1 },
      ]);
    case 'tower':
      return kit([
        { geo: box(0.1, 0.42, 0.1), color: wall, grad: [0.85, 1.05, 0, 0.42] },
        ...[
          [-0.035, -0.035],
          [0.035, -0.035],
          [-0.035, 0.035],
          [0.035, 0.035],
        ].map(([x, z]) => ({ geo: box(0.024, 0.03, 0.024, x, 0.42, z), color: wall })),
        ...[0.12, 0.22, 0.32].map((y) => ({ geo: box(0.018, 0.028, 0.006, 0, y, 0.051), color: win, glow: 1 })),
        { geo: box(0.16, 0.1, 0.12, 0.1, 0, 0), color: wall },
        { geo: gable(0.18, 0.06, 0.14, 0.1).translate(0.1, 0, 0), color: roof },
      ]);
    case 'pagoda': {
      const parts: Part[] = [];
      let y = 0;
      for (let i = 0; i < 3; i++) {
        const s = 1 - i * 0.22;
        parts.push({ geo: box(0.16 * s, 0.08, 0.16 * s, 0, y), color: wall });
        parts.push({ geo: box(0.008, 0.035, 0.05 * s, 0.081 * s, y + 0.025), color: win, glow: 1 });
        parts.push({ geo: pyr(0.3 * s, 0.07, 0.3 * s, y + 0.07), color: roof });
        y += 0.1;
      }
      parts.push({ geo: cyl(0.006, 0.008, 0.1, 5, 0, y + 0.02), color: det });
      parts.push({ geo: box(0.16, 0.02, 0.16), color: '#8a7a6a' });
      return kit(parts);
    }
    case 'pyramid':
      return kit([
        { geo: pyr(0.42, 0.34, 0.42, 0), color: wall, grad: [0.85, 1.06, 0, 0.34] },
        { geo: pyr(0.07, 0.056, 0.07, 0.29), color: det },
      ]);
    case 'obelisk':
      return kit([
        { geo: box(0.1, 0.03, 0.1), color: roof },
        { geo: cyl(0.018, 0.028, 0.34, 4, 0, 0.03).rotateY(Math.PI / 4), color: wall },
        { geo: pyr(0.028, 0.035, 0.028, 0.37), color: det },
      ]);
    case 'windmill':
      return windmillBody(wall, roof, det, win);
    case 'temple':
      return kit([
        { geo: box(0.32, 0.03, 0.24), color: roof },
        { geo: box(0.28, 0.03, 0.2, 0, 0.03), color: roof },
        { geo: box(0.24, 0.03, 0.16, 0, 0.06), color: roof },
        { geo: box(0.18, 0.12, 0.12, 0, 0.09), color: wall },
        ...[-0.07, -0.023, 0.023, 0.07].map((x) => ({ geo: cyl(0.009, 0.009, 0.12, 6, x, 0.09, 0.075), color: wall })),
        { geo: box(0.2, 0.02, 0.17, 0, 0.21), color: wall },
        { geo: gable(0.21, 0.06, 0.18, 0.23), color: det },
        { geo: box(0.03, 0.06, 0.006, 0, 0.09, 0.061), color: DOOR },
      ]);
    case 'stave': {
      const parts: Part[] = [];
      let y = 0;
      for (let i = 0; i < 3; i++) {
        const s = 1 - i * 0.28;
        parts.push({ geo: box(0.16 * s, 0.09, 0.16 * s, 0, y), color: wall });
        parts.push({ geo: pyr(0.22 * s, 0.08, 0.22 * s, y + 0.07), color: roof });
        y += 0.12;
      }
      parts.push({ geo: cone(0.03, 0.12, 4, 0, y - 0.02).rotateY(Math.PI / 4), color: roof });
      parts.push({ geo: box(0.006, 0.03, 0.02, 0.081, 0.03, 0), color: win, glow: 1 });
      parts.push({ geo: cone(0.012, 0.04, 4, 0.1, 0.12, 0).rotateZ(-0.9), color: det });
      return kit(parts);
    }
    case 'dome':
      return kit([
        { geo: cyl(0.22, 0.23, 0.03, 16), color: wall },
        { geo: new THREE.SphereGeometry(0.21, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.03, 0), color: roof, glow: 0.3 },
        { geo: cyl(0.004, 0.004, 0.12, 4, 0.05, 0.2, 0), color: wall },
        { geo: oct(0.012).translate(0.05, 0.33, 0), color: det, glow: 1 },
      ]);
    default:
      return null;
  }
}

function windmillBody(wall: Col, roof: Col, det: Col, win: Col) {
  return kit([
    { geo: box(0.12, 0.03, 0.12), color: '#8a7a6a' },
    { geo: cyl(0.05, 0.075, 0.22, 8, 0, 0.03), color: wall, grad: [0.9, 1.05, 0, 0.25] },
    { geo: cone(0.062, 0.07, 8, 0, 0.25), color: roof },
    { geo: box(0.02, 0.04, 0.006, 0, 0.03, 0.073), color: DOOR },
    { geo: box(0.014, 0.018, 0.006, 0, 0.14, 0.061), color: win, glow: 1 },
    { geo: box(0.1, 0.006, 0.1, 0, 0.1), color: det },
  ]);
}

/** Pás do moinho: giram em torno do eixo z, centro em (0,0,0). */
function sailsGeometry(det: Col, sail: Col) {
  const parts: Part[] = [{ geo: cyl(0.012, 0.012, 0.03, 6).rotateX(Math.PI / 2).translate(0, 0, -0.015), color: det }];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const arm = box(0.008, 0.15, 0.006, 0, 0.012, 0).rotateZ(a);
    const cloth = box(0.034, 0.11, 0.003, 0.022, 0.05, 0.004).rotateZ(a);
    parts.push({ geo: arm, color: det }, { geo: cloth, color: sail });
  }
  return kit(parts);
}

/** Roda d'água: gira em torno do eixo x. */
function wheelGeometry(wood: Col) {
  const parts: Part[] = [{ geo: cyl(0.008, 0.008, 0.05, 6).rotateZ(Math.PI / 2).translate(-0.025, 0, 0), color: '#4a3a30' }];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push({ geo: box(0.03, 0.006, 0.07, 0, -0.003, 0).translate(0, 0.035, 0).rotateX(a), color: wood });
    parts.push({ geo: box(0.004, 0.004, 0.06, 0.012, -0.002, 0).translate(0, 0.0, 0.03).rotateX(a), color: '#5a4032' });
  }
  parts.push({ geo: new THREE.TorusGeometry(0.06, 0.005, 4, 12).rotateY(Math.PI / 2).translate(0.014, 0, 0), color: '#5a4032' });
  parts.push({ geo: new THREE.TorusGeometry(0.06, 0.005, 4, 12).rotateY(Math.PI / 2).translate(-0.014, 0, 0), color: '#5a4032' });
  return kit(parts);
}

// ---------------------------------------------------------------- animais, barcos, veículos

function animalGeometry(kind: AnimalKind): THREE.BufferGeometry {
  const leg = (x: number, z: number, h: number, c: Col) => ({ geo: box(0.006, h, 0.006, x, 0, z), color: c });
  const legs = (lx: number, lz: number, h: number, c: Col) => [leg(lx, lz, h, c), leg(lx, -lz, h, c), leg(-lx, lz, h, c), leg(-lx, -lz, h, c)];
  switch (kind) {
    case 'sheep':
      return kit([{ geo: jitter(ico(0.022, 1), 0.004, 20).scale(1.35, 0.95, 1).translate(0, 0.036, 0), color: '#fff', tint: 1 }, { geo: box(0.014, 0.016, 0.012, 0.03, 0.03, 0), color: '#2f2a28' }, ...legs(0.014, 0.008, 0.02, '#2f2a28')]);
    case 'goat':
      return kit([{ geo: box(0.04, 0.02, 0.018, 0, 0.022), color: '#fff', tint: 1 }, { geo: box(0.014, 0.014, 0.012, 0.025, 0.036), color: '#fff', tint: 1 }, { geo: cone(0.003, 0.014, 4, 0.024, 0.05, 0.004).rotateZ(-0.4), color: '#6a5a4a' }, ...legs(0.014, 0.007, 0.022, '#5a4a3a')]);
    case 'cow':
      return kit([{ geo: box(0.052, 0.026, 0.024, 0, 0.022), color: '#fff', tint: 1 }, { geo: box(0.018, 0.018, 0.016, 0.034, 0.03), color: '#fff', tint: 1 }, { geo: box(0.006, 0.006, 0.016, 0.044, 0.028), color: '#e8b8a8' }, ...legs(0.018, 0.008, 0.022, '#3a3230')]);
    case 'horse':
      return kit([{ geo: box(0.048, 0.022, 0.017, 0, 0.03), color: '#fff', tint: 1 }, { geo: box(0.012, 0.028, 0.012, 0.026, 0.044).rotateZ(-0.35), color: '#fff', tint: 1 }, { geo: box(0.02, 0.01, 0.01, 0.044, 0.062), color: '#fff', tint: 1 }, { geo: box(0.006, 0.02, 0.004, -0.026, 0.032), color: '#2a2220' }, ...legs(0.017, 0.006, 0.03, '#2a2220')]);
    case 'llama':
      return kit([{ geo: box(0.036, 0.02, 0.018, 0, 0.03), color: '#fff', tint: 1 }, { geo: box(0.01, 0.04, 0.01, 0.017, 0.045), color: '#fff', tint: 1 }, { geo: box(0.016, 0.01, 0.01, 0.022, 0.084), color: '#fff', tint: 1 }, { geo: cone(0.003, 0.01, 4, 0.016, 0.094, 0.003), color: '#3a2e28' }, ...legs(0.012, 0.006, 0.03, '#6a5040')]);
    case 'camel':
      return kit([{ geo: box(0.05, 0.022, 0.02, 0, 0.042), color: '#fff', tint: 1 }, { geo: new THREE.SphereGeometry(0.016, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.064, 0), color: '#fff', tint: 1 }, { geo: box(0.01, 0.032, 0.01, 0.03, 0.05).rotateZ(-0.5), color: '#fff', tint: 1 }, { geo: box(0.018, 0.01, 0.01, 0.05, 0.075), color: '#fff', tint: 1 }, ...legs(0.018, 0.007, 0.042, '#8a6a4a')]);
    case 'deer':
      return kit([{ geo: box(0.042, 0.018, 0.014, 0, 0.032), color: '#fff', tint: 1 }, { geo: box(0.009, 0.026, 0.009, 0.022, 0.046).rotateZ(-0.3), color: '#fff', tint: 1 }, { geo: box(0.016, 0.009, 0.009, 0.034, 0.066), color: '#fff', tint: 1 }, { geo: cone(0.012, 0.03, 3, 0.03, 0.072, 0).rotateY(0.6), color: '#e8dcc0' }, ...legs(0.015, 0.005, 0.032, '#4a3a2e')]);
    case 'rover':
      return kit([
        { geo: box(0.05, 0.016, 0.03, 0, 0.012), color: '#fff', tint: 1 },
        ...[-0.018, 0, 0.018].flatMap((x) => [0.018, -0.018].map((z) => ({ geo: cyl(0.008, 0.008, 0.006, 8).rotateX(Math.PI / 2).translate(x, 0.008, z), color: '#3a3a44' }))),
        { geo: cyl(0.002, 0.002, 0.03, 4, -0.012, 0.028, 0), color: '#9aa3b2' },
        { geo: box(0.014, 0.01, 0.014, 0.018, 0.028), color: '#36d1d1', glow: 1 },
      ]);
  }
}

function boatGeometry(kind: BoatKind, [hullC, sailC]: [string, string]): THREE.BufferGeometry {
  const H = (len: number, w: number, h: number) => ({ geo: hull(len, w, h), color: hullC });
  const mast = (h: number, x = 0) => ({ geo: cyl(0.0025, 0.003, h, 4, x, 0.01), color: '#4a3a30' });
  switch (kind) {
    case 'rowboat':
      return kit([H(0.1, 0.036, 0.016), { geo: box(0.008, 0.004, 0.03, 0.015, 0.014), color: '#6a4a32' }, { geo: box(0.008, 0.004, 0.03, -0.02, 0.014), color: '#6a4a32' }, { geo: box(0.07, 0.003, 0.003, 0, 0.018, 0.03).rotateY(0.3), color: '#6a4a32' }]);
    case 'sailboat':
      return kit([H(0.11, 0.036, 0.018), mast(0.12), { geo: tri([0.004, 0.03, 0], [0.004, 0.13, 0], [0.05, 0.03, 0]), color: sailC }, { geo: tri([0.004, 0.13, 0], [0.004, 0.03, 0], [0.05, 0.03, 0]), color: sailC }]);
    case 'felucca':
      return kit([
        H(0.12, 0.034, 0.016),
        mast(0.07),
        { geo: cyl(0.002, 0.002, 0.16, 4).rotateZ(-0.9).translate(0.005, 0.08, 0), color: '#4a3a30' },
        { geo: tri([-0.058, 0.03, 0], [0.066, 0.135, 0], [0.04, 0.03, 0]), color: sailC },
        { geo: tri([0.066, 0.135, 0], [-0.058, 0.03, 0], [0.04, 0.03, 0]), color: sailC },
      ]);
    case 'junk':
      return kit([
        H(0.12, 0.04, 0.018),
        { geo: box(0.025, 0.02, 0.04, -0.045, 0.016), color: hullC },
        mast(0.12, 0.005),
        { geo: box(0.004, 0.08, 0.06, 0.008, 0.04), color: sailC },
        ...[0.055, 0.075, 0.095].map((y) => ({ geo: box(0.006, 0.003, 0.062, 0.008, y), color: '#4a3a30' })),
      ]);
    case 'longship':
      return kit([
        H(0.16, 0.036, 0.018),
        { geo: cone(0.006, 0.04, 4, 0.08, 0.02).rotateZ(-0.5), color: hullC },
        { geo: cone(0.006, 0.04, 4, -0.08, 0.02).rotateZ(0.5), color: hullC },
        mast(0.1),
        ...[0, 1, 2, 3].map((i) => ({ geo: box(0.004, 0.016, 0.07, 0.004, 0.04 + i * 0.016), color: i % 2 ? '#f3ead8' : sailC })),
        ...[-0.05, -0.025, 0, 0.025, 0.05].flatMap((x) => [0.019, -0.019].map((z) => ({ geo: cyl(0.008, 0.008, 0.003, 6).rotateX(Math.PI / 2).translate(x, 0.02, z), color: '#c9a24a' }))),
      ]);
    case 'barge':
      return kit([H(0.15, 0.04, 0.014), { geo: box(0.04, 0.02, 0.03, -0.02, 0.014), color: sailC }, { geo: box(0.03, 0.016, 0.03, 0.025, 0.014), color: '#8a6a4a' }]);
    case 'canoe':
      return kit([H(0.11, 0.026, 0.012), { geo: box(0.01, 0.022, 0.01, 0.01, 0.012), color: sailC }, { geo: oct(0.006).translate(0.01, 0.04, 0), color: '#6a4a32' }, { geo: box(0.004, 0.004, 0.05, 0.014, 0.024).rotateX(0.5), color: '#6a4a32' }]);
    case 'reedboat': {
      const g = new THREE.CylinderGeometry(0.014, 0.014, 0.11, 6, 4).rotateZ(Math.PI / 2).toNonIndexed();
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const t = Math.abs(x) / 0.055;
        p.setY(i, p.getY(i) * (1 - t * 0.6) + t * t * 0.03 + 0.012);
        p.setZ(i, p.getZ(i) * (1 - t * 0.6));
      }
      return kit([{ geo: g, color: hullC, grad: [0.85, 1.05, 0, 0.04] }, { geo: box(0.01, 0.022, 0.01, 0.0, 0.02), color: sailC }]);
    }
    case 'hover':
      return kit([{ geo: cyl(0.04, 0.05, 0.016, 12, 0, 0.004), color: hullC }, { geo: new THREE.SphereGeometry(0.022, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.02, 0), color: sailC, glow: 0.6 }, { geo: cyl(0.052, 0.052, 0.004, 12, 0, 0.004), color: sailC, glow: 1 }]);
  }
}

function vehicleGeometry(kind: VehicleKind, [body, det]: [string, string], animal: AnimalKind): { head: THREE.BufferGeometry; car: THREE.BufferGeometry } {
  const wheels = (xs: number[], r: number, z: number): Part[] => xs.flatMap((x) => [z, -z].map((zz) => ({ geo: cyl(r, r, 0.004, 8).rotateX(Math.PI / 2).translate(x, r, zz), color: '#2a2622' })));
  switch (kind) {
    case 'steam':
      return {
        head: kit([
          { geo: cyl(0.018, 0.018, 0.06, 10).rotateZ(Math.PI / 2).translate(0.012, 0.03, 0), color: body },
          { geo: box(0.03, 0.04, 0.036, -0.03, 0.012), color: body },
          { geo: box(0.034, 0.006, 0.04, -0.03, 0.052), color: det },
          { geo: cyl(0.007, 0.005, 0.022, 6, 0.03, 0.044), color: '#2a2622' },
          { geo: box(0.08, 0.008, 0.036, 0, 0.01), color: '#2a2622' },
          { geo: box(0.004, 0.012, 0.012, -0.0145, 0.03, 0.0185), color: '#ffd98a', glow: 1 },
          ...wheels([0.025, 0, -0.03], 0.011, 0.02),
        ]),
        car: kit([{ geo: box(0.065, 0.034, 0.036, 0, 0.014), color: det }, { geo: box(0.069, 0.005, 0.04, 0, 0.048), color: body }, ...[-0.018, 0.018].map((x) => ({ geo: box(0.014, 0.012, 0.037, x, 0.028), color: '#ffe2a8', glow: 1 })), ...wheels([0.022, -0.022], 0.008, 0.019)]),
      };
    case 'maglev':
      return {
        head: kit([{ geo: box(0.06, 0.026, 0.032, -0.006, 0.01), color: body }, { geo: cone(0.018, 0.04, 4, 0.04, 0.0).rotateZ(-Math.PI / 2).translate(0, 0.023, 0).rotateX(Math.PI / 4), color: body }, { geo: box(0.066, 0.006, 0.034, -0.004, 0.02), color: det, glow: 0.6 }]),
        car: kit([{ geo: box(0.07, 0.026, 0.032, 0, 0.01), color: body }, { geo: box(0.07, 0.006, 0.034, 0, 0.02), color: det, glow: 0.6 }]),
      };
    case 'cart':
      return {
        head: animalGeometry('horse'),
        car: kit([{ geo: box(0.05, 0.016, 0.034, 0, 0.018), color: body }, { geo: jitter(ico(0.02, 0), 0.004, 30).scale(1.2, 0.7, 0.9).translate(0, 0.036, 0), color: det }, ...wheels([0], 0.016, 0.02), { geo: box(0.04, 0.003, 0.003, 0.04, 0.024, 0.01), color: '#5a4032' }, { geo: box(0.04, 0.003, 0.003, 0.04, 0.024, -0.01), color: '#5a4032' }]),
      };
    case 'caravan': {
      const a = animal === 'camel' || animal === 'llama' || animal === 'horse' ? animal : 'horse';
      const pack = (x: number, y: number) => [{ geo: box(0.014, 0.014, 0.03, x, y), color: det }];
      const base = animalGeometry(a);
      const packY = a === 'camel' ? 0.07 : a === 'llama' ? 0.05 : 0.052;
      return { head: mergeGeometries([base, kit(pack(-0.004, packY))])!, car: mergeGeometries([base.clone(), kit([...pack(-0.004, packY), { geo: box(0.018, 0.01, 0.022, -0.004, packY + 0.014), color: body }])])! };
    }
  }
}

function birdGeometry() {
  return kit([
    { geo: tri([0, 0, 0], [-0.01, 0.004, 0.03], [0.012, 0, 0]), color: '#3a3634' },
    { geo: tri([0, 0, 0], [0.012, 0, 0], [-0.01, 0.004, -0.03]), color: '#3a3634' },
    { geo: tri([-0.01, 0.004, 0.03], [0, 0, 0], [0.012, 0, 0]), color: '#3a3634' },
    { geo: tri([0.012, 0, 0], [0, 0, 0], [-0.01, 0.004, -0.03]), color: '#3a3634' },
  ]);
}

// ---------------------------------------------------------------- estruturas das interações

function specialsFor(theme: Theme, walls: string, roofs: string) {
  const wood = theme.trunk;
  const logs: Part[] = [];
  for (let i = 0; i < 5; i++) {
    const row = i < 3 ? 0 : 1;
    const z = row === 0 ? (i - 1) * 0.019 : (i - 3.5) * 0.019;
    logs.push({ geo: cyl(0.009, 0.009, 0.08, 6).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.009 + row * 0.016, z), color: wood, grad: [0.8, 1.1, 0, 0.03] });
  }
  logs.push({ geo: cyl(0.014, 0.016, 0.02, 7, 0.07, 0, 0.04), color: wood });
  logs.push({ geo: box(0.06, 0.05, 0.05, -0.02, 0, -0.07), color: walls });
  logs.push({ geo: new THREE.CylinderGeometry(1, 1, 1, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(0.075, 0.03, 0.064 / 1.732).translate(-0.02, 0.06, -0.07), color: roofs });

  const fence: Part[] = [];
  const N = 10;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const a2 = ((i + 1) / N) * Math.PI * 2;
    const R = 0.12;
    fence.push({ geo: box(0.006, 0.03, 0.006, Math.cos(a) * R, 0, Math.sin(a) * R), color: wood });
    const mx = (Math.cos(a) + Math.cos(a2)) * R * 0.5, mz = (Math.sin(a) + Math.sin(a2)) * R * 0.5;
    const len = 2 * R * Math.sin(Math.PI / N);
    fence.push({ geo: box(len, 0.004, 0.003, 0, 0.02, 0).rotateY(-(a + a2) / 2 + Math.PI / 2).translate(mx, 0, mz), color: wood });
  }
  fence.push({ geo: box(0.03, 0.012, 0.012, 0.06, 0, 0.02), color: '#8a7a6a' });

  const apiary: Part[] = [];
  for (const [x, z] of [
    [-0.04, 0],
    [0, 0.03],
    [0.04, -0.005],
  ]) {
    apiary.push({ geo: box(0.024, 0.006, 0.024, x, 0, z), color: '#6a4a32' });
    apiary.push({ geo: box(0.022, 0.026, 0.022, x, 0.006, z), color: '#f3e3b0' });
    apiary.push({ geo: box(0.026, 0.005, 0.026, x, 0.032, z), color: '#c9a24a' });
  }

  const granary: Part[] = [
    { geo: cyl(0.04, 0.042, 0.13, 10, -0.03, 0, 0), color: walls },
    { geo: cone(0.046, 0.05, 10, -0.03, 0.13, 0), color: roofs },
    { geo: cyl(0.032, 0.034, 0.1, 10, 0.045, 0, 0.02), color: walls },
    { geo: cone(0.037, 0.04, 10, 0.045, 0.1, 0.02), color: roofs },
    { geo: box(0.012, 0.03, 0.004, -0.03, 0, 0.041), color: DOOR },
  ];

  const station: Part[] = [
    { geo: box(0.2, 0.012, 0.06), color: '#9a9082' },
    ...[-0.06, 0.06].flatMap((x) => [0.018, -0.018].map((z) => ({ geo: box(0.004, 0.05, 0.004, x, 0.012, z), color: wood }))),
    { geo: box(0.15, 0.006, 0.06, 0, 0.062), color: roofs },
    { geo: box(0.05, 0.04, 0.03, 0.06, 0.012, -0.012), color: walls },
    { geo: box(0.02, 0.012, 0.004, 0.06, 0.03, 0.004), color: theme.window, glow: 1 },
  ];

  const silo: Part[] = [
    { geo: cyl(0.03, 0.032, 0.16, 10), color: '#c9ccd2' },
    { geo: cone(0.034, 0.04, 10, 0, 0.16), color: '#8a9098' },
    { geo: box(0.05, 0.05, 0.04, 0.05, 0, 0), color: walls },
  ];

  return {
    logs: kit(logs),
    fence: kit(fence),
    apiary: kit(apiary),
    granary: kit(granary),
    station: kit(station),
    silo: kit(silo),
    wheel: wheelGeometry(wood),
  };
}

// ---------------------------------------------------------------- materiais

export interface Uniforms {
  uTime: { value: number };
  uSparkle: { value: THREE.Color };
  uWind: { value: THREE.Vector2 };
  uNight: { value: number };
  uGlow: { value: THREE.Color };
  uClouds: { value: number };
}

const NOISE = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float cloudShade(vec2 p, float t){
  vec2 q = p * 0.085 + t * vec2(0.011, 0.006);
  float n = vnoise(q) * 0.65 + vnoise(q * 2.3 + 7.1) * 0.35;
  return smoothstep(0.5, 0.74, n);
}`;

interface PatchOpts {
  key: string;
  tint?: boolean;
  glow?: boolean;
  sway?: 'tree' | 'crop';
  clouds?: boolean;
  groundNoise?: boolean;
  water?: boolean;
}

/** Injeta nos shaders padrão do three.js os efeitos do jogo (vento, nuvens, janelas...). */
function patch(mat: THREE.Material, u: Uniforms, o: PatchOpts) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    let vs = shader.vertexShader;
    let fs = shader.fragmentShader;
    const common = `#include <common>
uniform float uTime; uniform vec2 uWind; varying vec3 vWPos; varying float vGlow; varying float vSheen;
${o.tint || o.glow ? 'attribute float tint; attribute float glow;' : ''}`;
    vs = vs.replace('#include <common>', common);
    if (o.tint || o.glow) {
      vs = vs.replace(
        '#include <color_vertex>',
        `#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
  vColor = vec4(1.0);
#endif
#ifdef USE_COLOR
  vColor.rgb *= color.rgb;
#endif
#ifdef USE_INSTANCING_COLOR
  vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, tint);
#endif
vGlow = glow;`,
      );
    } else vs = vs.replace('#include <color_vertex>', '#include <color_vertex>\nvGlow = 0.0;');
    let move = '';
    if (o.sway === 'tree') {
      move = `
#ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
  float ph = ip.x * 1.7 + ip.z * 1.3;
  float bend = max(transformed.y - 0.08, 0.0);
  float gust = 0.6 + 0.4 * sin(dot(ip.xz, uWind) * 0.8 - uTime * 0.9);
  transformed.x += sin(uTime * 1.6 + ph) * 0.05 * bend * gust;
  transformed.z += cos(uTime * 1.3 + ph * 1.2) * 0.04 * bend * gust;
#endif`;
    } else if (o.sway === 'crop') {
      move = `
#ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
  float hgt = max(transformed.y, 0.0);
  float wave = sin(dot(ip.xz, uWind) * 2.4 - uTime * 2.2) * 0.5 + 0.5;
  float gust = wave * wave;
  vec3 lw = transpose(mat3(instanceMatrix)) * vec3(uWind.x, 0.0, uWind.y);
  vec2 ld = normalize(lw.xz + 1e-5);
  float bend = hgt * hgt * (1.2 + 3.8 * gust);
  transformed.xz += ld * bend + vec2(sin(uTime * 3.1 + ip.x * 9.0), cos(uTime * 2.7 + ip.z * 7.0)) * hgt * 0.06;
  transformed.y -= bend * 0.45;
  vSheen = gust * clamp(hgt * 14.0, 0.0, 1.0);
#endif`;
    }
    vs = vs.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vSheen = 0.0;
${move}
#ifdef USE_INSTANCING
  vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`,
    );
    fs = fs.replace('#include <common>', `#include <common>\nuniform float uTime; uniform vec3 uSparkle; uniform float uNight; uniform vec3 uGlow; uniform float uClouds;\nvarying vec3 vWPos; varying float vGlow; varying float vSheen;\n${NOISE}`);
    let color = '';
    if (o.groundNoise) {
      color += `{ vec2 p = vWPos.xz; float n = vnoise(p * 2.3) * 0.6 + vnoise(vec2(p.x * 7.0 + p.y * 2.0, p.y * 3.0)) * 0.4; diffuseColor.rgb *= 0.9 + 0.2 * n; }`;
    }
    if (o.water) {
      color += `{ vec2 p = vWPos.xz;
  float w = sin(p.x * 5.0 + uTime * 1.1 + sin(p.y * 3.0)) * sin(p.y * 6.0 - uTime * 0.9 + sin(p.x * 2.0));
  diffuseColor.rgb *= 0.94 + 0.08 * w;
  float s = smoothstep(0.93, 1.0, sin(p.x * 11.0 + uTime * 1.7) * sin(p.y * 13.0 - uTime * 1.3 + p.x));
  diffuseColor.rgb = mix(diffuseColor.rgb, uSparkle, s * 0.55 * (1.0 - uNight * 0.7)); }`;
    }
    if (o.sway === 'crop') color += `diffuseColor.rgb *= 1.0 + vSheen * 0.22;`;
    if (o.clouds) color += `diffuseColor.rgb *= 1.0 - uClouds * cloudShade(vWPos.xz, uTime);`;
    fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n${color}`);
    if (o.glow) fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlow * vGlow * uNight * 2.4;');
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => o.key;
}

export type MatKey = 'deco' | 'foliage' | 'crop' | 'crystal' | 'glass';

export class Lib {
  readonly uniforms: Uniforms = {
    uTime: { value: 0 },
    uSparkle: { value: new THREE.Color('#ffffff') },
    uWind: { value: new THREE.Vector2(0.8, 0.6).normalize() },
    uNight: { value: 0 },
    uGlow: { value: new THREE.Color('#ffd98a') },
    uClouds: { value: 0.16 },
  };
  readonly ground: THREE.MeshStandardMaterial;
  readonly water: THREE.MeshStandardMaterial;
  readonly mats: Record<MatKey, THREE.MeshStandardMaterial>;
  readonly geos = new Map<string, THREE.BufferGeometry>();
  houseMeta: HouseMeta[] = [];
  landmarkMeta: { sails: [number, number, number] | null } = { sails: null };

  constructor() {
    const u = this.uniforms;
    this.ground = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
    patch(this.ground, u, { key: 'ground', groundNoise: true, clouds: true });
    this.water = new THREE.MeshStandardMaterial({ color: '#63b1dc', roughness: 0.3, metalness: 0.05 });
    patch(this.water, u, { key: 'water', water: true, clouds: true });
    const std = (extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, ...extra });
    this.mats = {
      deco: std(),
      foliage: std({ roughness: 0.9 }),
      crop: std({ roughness: 0.9, side: THREE.DoubleSide }),
      crystal: std({ roughness: 0.25, metalness: 0.1, emissive: '#3a2a66', emissiveIntensity: 0.6 }),
      glass: std({ roughness: 0.2, metalness: 0.2 }),
    };
    patch(this.mats.deco, u, { key: 'deco', tint: true, glow: true, clouds: true });
    patch(this.mats.foliage, u, { key: 'foliage', tint: true, glow: true, sway: 'tree', clouds: true });
    patch(this.mats.crop, u, { key: 'crop', tint: true, glow: true, sway: 'crop', clouds: true });
    patch(this.mats.crystal, u, { key: 'crystal', tint: true, glow: true, sway: 'tree' });
    patch(this.mats.glass, u, { key: 'glass', tint: true, glow: true });
  }

  applyTheme(theme: Theme) {
    for (const g of this.geos.values()) g.dispose();
    this.geos.clear();
    const set = (k: string, g: THREE.BufferGeometry | null) => g && this.geos.set(k, g);
    this.water.color.set(theme.water);
    this.uniforms.uSparkle.value.set(theme.sparkle);
    this.uniforms.uGlow.value.set(theme.window);

    for (const f of theme.forest) if (!this.geos.has(`tree:${f.geo}`)) set(`tree:${f.geo}`, treeGeometry(f.geo, theme.trunk));
    this.domeKeys.clear();
    theme.houses.forEach((k, i) => k.roof === 'dome' && this.domeKeys.add(`roof:${i}`));
    this.houseMeta = theme.houses.map((k, i) => {
      set(`wall:${i}`, wallGeometry(k, theme.window));
      const r = roofGeometry(k.roof, k.body, !!k.chimney);
      set(`roof:${i}`, r.geo);
      return { h: BODY[k.body].h, top: r.top, chimney: r.chim };
    });
    set('landmark', landmarkGeometry(theme.landmark, theme.landmarkColors, theme.window));
    const [lw, lr, ld] = theme.landmarkColors;
    if (theme.landmark === 'windmill' || theme.mill === 'windmill') set('sails', sailsGeometry(ld, '#f3ead8'));
    set('mill', theme.mill === 'windmill' ? windmillBody(lw, lr, ld, theme.window) : null);
    for (const c of theme.crops) if (!this.geos.has(`crop:${c.style}`)) set(`crop:${c.style}`, cropGeometry(c.style));
    const sp = specialsFor(theme, theme.houses[0].walls[0], theme.houses[0].roofs[0]);
    for (const [k, g] of Object.entries(sp)) set(k, g);
    if (theme.mill === 'granary') set('mill', sp.granary);
    set('grass', kit(tuft(4, 0.042, 0.0045, 0.012, 0.75, 0.004, 23).map((geo) => ({ geo, color: '#fff', tint: 1, grad: [0.6, 1.12, 0, 0.045] as [number, number, number, number] }))));
    set('reed', kit(tuft(5, 0.07, 0.004, 0.012, 0.8, 0.01, 29).map((geo) => ({ geo, color: '#4f7a3a', grad: [0.6, 1.1, 0, 0.07] as [number, number, number, number] }))));
    set('bush', kit([{ geo: jitter(ico(0.05, 0), 0.01, 5).translate(0, 0.03, 0), color: '#fff', tint: 1, grad: [0.8, 1.1, 0, 0.07] }]));
    set('rock', kit([{ geo: new THREE.DodecahedronGeometry(0.04, 0).scale(1, 0.6, 1).translate(0, 0.012, 0), color: '#fff', tint: 1 }]));
    set('flower', kit([{ geo: oct(0.014).translate(0, 0.024, 0), color: '#fff', tint: 1 }, { geo: tri([-0.002, 0, 0], [0.002, 0, 0], [0, 0.02, 0]), color: '#4f7a3a' }]));
    set('lily', kit([{ geo: cyl(0.035, 0.035, 0.006, 7, 0, 0.011), color: '#fff', tint: 1 }, { geo: oct(0.008).translate(0.01, 0.02, 0.006), color: '#f7c6d8' }]));
    set('animal', animalGeometry(theme.animals.kind));
    set('boat', boatGeometry(theme.boat, theme.boatColors));
    const v = vehicleGeometry(theme.vehicle, theme.vehicleColors, theme.animals.kind);
    set('vehicle:head', v.head);
    set('vehicle:car', v.car);
    set('bird', birdGeometry());
  }

  geo(key: string) {
    return this.geos.get(key) ?? null;
  }

  material(key: string): THREE.Material {
    if (key === 'tree:crystal') return this.mats.crystal;
    if (key.startsWith('tree:') || key === 'bush') return this.mats.foliage;
    if (key.startsWith('crop:') || key === 'grass' || key === 'reed' || key === 'flower') return this.mats.crop;
    if (this.domeKeys.has(key)) return this.mats.glass;
    return this.mats.deco;
  }

  private domeKeys = new Set<string>();

  /** Plantas e capim não projetam sombra (economia grande, quase invisível). */
  castsShadow(key: string) {
    return !(key.startsWith('crop:') || key === 'grass' || key === 'reed' || key === 'flower' || key === 'lily');
  }
}
