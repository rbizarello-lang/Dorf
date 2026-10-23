import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Kits do tema Terraços do Oriente (geometria própria, para o tema não mexer no lib.ts além de uma linha de `case`
// por kit). Seguem o contrato dos kits de lib.ts: cor por vértice (`color`), `tint` (1 = a cor da instância tinge a
// parte) e `glow` (1 = acende à noite). Tudo no espaço do kit, com o pé na origem e a frente em +x quando é bicho.

type Col = THREE.ColorRepresentation;
interface Part {
  geo: THREE.BufferGeometry;
  color: Col;
  tint?: number;
  glow?: number;
  /** Gradiente vertical: fator de cor na base e no topo, entre y0 e y1. */
  grad?: [number, number, number, number];
}

const tmp = new THREE.Color();

function kit(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    tmp.set(p.color);
    const pos = g.attributes.position;
    for (let i = 0; i < n; i++) {
      let f = 1;
      if (p.grad) {
        const [a, b, y0, y1] = p.grad;
        f = a + (b - a) * THREE.MathUtils.clamp((pos.getY(i) - y0) / (y1 - y0 || 1), 0, 1);
      }
      col[i * 3] = tmp.r * f;
      col[i * 3 + 1] = tmp.g * f;
      col[i * 3 + 2] = tmp.b * f;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n).fill(p.tint ?? 0), 1));
    g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n).fill(p.glow ?? 0), 1));
    return g;
  });
  const out = mergeGeometries(geos)!;
  out.computeVertexNormals();
  return out;
}

type V3 = [number, number, number];
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const cyl = (rt: number, rb: number, h: number, seg: number, x = 0, y = 0, z = 0) => new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(x, y + h / 2, z);
const cone = (r: number, h: number, seg: number, x = 0, y = 0, z = 0) => new THREE.ConeGeometry(r, h, seg, 1).translate(x, y + h / 2, z);
const ball = (r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail).scale(sx, sy, sz).translate(x, y, z);
const disc = (r: number, seg: number, x: number, y: number, z: number) => new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2).translate(x, y, z);
/** Prisma entre dois pontos (galho, pescoço, perna): lado `w`. */
function strut(a: V3, b: V3, w: number) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const g = new THREE.BoxGeometry(w, len, w);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  return g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
}

/**
 * Niwaki: pinheiro podado de jardim. Tronco torcido e três "nuvens" de agulhas achatadas e deslocadas, cada uma
 * de um lado do tronco (a copa em camadas da pintura, e não o guarda-sol do `umbrella`). Perene: o material não
 * tinge a copa com a estação (EVERGREEN em lib.ts). `far` = versão leve do zoom aberto (octaedros).
 */
export function niwakiGeometry(trunk: Col, far: boolean): THREE.BufferGeometry {
  const pad = (r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, g0: number): Part => ({
    geo: far ? new THREE.OctahedronGeometry(r, 0).scale(sx, sy, sz).translate(x, y, z) : ball(r, sx, sy, sz, x, y, z, 0),
    color: '#fff',
    tint: 1,
    grad: [0.7, 1.12, g0, g0 + r * sy * 2.2],
  });
  const parts: Part[] = [];
  if (far) {
    parts.push({ geo: new THREE.PlaneGeometry(0.03, 0.3).translate(0, 0.15, 0), color: trunk });
  } else {
    parts.push({ geo: strut([0, 0, 0], [-0.012, 0.13, 0.006], 0.03), color: trunk, grad: [0.8, 1.05, 0, 0.13] });
    parts.push({ geo: strut([-0.012, 0.12, 0.006], [0.02, 0.22, -0.008], 0.022), color: trunk });
    parts.push({ geo: strut([0.02, 0.21, -0.008], [0.004, 0.3, 0.004], 0.016), color: trunk });
    // Galhos que seguram as nuvens, de um lado e do outro.
    parts.push({ geo: strut([-0.012, 0.12, 0.006], [-0.075, 0.15, 0.03], 0.012), color: trunk });
    parts.push({ geo: strut([0.02, 0.21, -0.008], [0.075, 0.235, -0.03], 0.012), color: trunk });
  }
  parts.push(pad(0.075, 1.3, 0.3, 1.1, -0.07, 0.165, 0.03, 0.1));
  parts.push(pad(0.07, 1.25, 0.3, 1.1, 0.075, 0.25, -0.028, 0.18));
  parts.push(pad(0.055, 1.2, 0.32, 1.05, 0.004, 0.325, 0.004, 0.27));
  return kit(parts);
}

/**
 * Garça-branca: corpo esguio, pescoço em S, bico amarelo e pernas longas. Anda devagar pela margem com o mesmo passeio
 * dos outros bichos; a cor da instância tinge o corpo (branco, ou cinza-azulado para a garça-real).
 */
export function heronGeometry(): THREE.BufferGeometry {
  const leg = '#3a3430';
  // Um pouco maior que a escala dos bichos de pasto (a garça é alta e fina; sem isso some no zoom médio).
  return kit([
    { geo: strut([0.002, 0, 0.004], [0.004, 0.044, 0.004], 0.0035), color: leg },
    { geo: strut([-0.004, 0, -0.004], [-0.003, 0.044, -0.004], 0.0035), color: leg },
    { geo: ball(0.016, 1.7, 0.8, 0.75, 0, 0.056, 0), color: '#fff', tint: 1, grad: [0.85, 1.05, 0.045, 0.068] },
    // Cauda.
    { geo: cone(0.007, 0.024, 3, 0, 0, 0).rotateZ(Math.PI / 2 + 0.2).translate(-0.03, 0.058, 0), color: '#fff', tint: 1 },
    // Pescoço em S (três segmentos) e cabeça.
    { geo: strut([0.017, 0.062, 0], [0.024, 0.078, 0], 0.006), color: '#fff', tint: 1 },
    { geo: strut([0.024, 0.078, 0], [0.018, 0.094, 0], 0.005), color: '#fff', tint: 1 },
    { geo: strut([0.018, 0.094, 0], [0.024, 0.106, 0], 0.0045), color: '#fff', tint: 1 },
    { geo: ball(0.005, 1.2, 0.9, 0.9, 0.026, 0.108, 0), color: '#fff', tint: 1 },
    { geo: cone(0.0022, 0.02, 3, 0, 0, 0).rotateZ(-Math.PI / 2).translate(0.045, 0.108, 0), color: '#e8b43a' },
  ]).scale(1.4, 1.4, 1.4);
}

// ---------------------------------------------------------------- ovos (easter eggs de peça)

/**
 * A cerejeira milenar: tronco grosso e retorcido, copa larga e baixa em nuvens de flor (a cor da instância tinge as
 * nuvens, para ficar rosa), pétalas no chão e um torii miúdo ao pé.
 */
export function ancientBlossomGeometry(trunk: Col): THREE.BufferGeometry {
  const parts: Part[] = [
    { geo: strut([0, 0, 0], [-0.02, 0.07, 0.01], 0.05), color: trunk, grad: [0.75, 1.05, 0, 0.07] },
    { geo: strut([-0.02, 0.065, 0.01], [0.02, 0.14, -0.01], 0.038), color: trunk },
    { geo: strut([0.015, 0.13, -0.01], [0.09, 0.17, 0.02], 0.016), color: trunk },
    { geo: strut([-0.01, 0.1, 0.01], [-0.1, 0.15, -0.02], 0.016), color: trunk },
    { geo: strut([0.02, 0.14, -0.01], [0.0, 0.2, 0.03], 0.014), color: trunk },
  ];
  const cloud = (r: number, x: number, y: number, z: number, sy = 0.55): Part => ({ geo: ball(r, 1.2, sy, 1.1, x, y, z, 1), color: '#fff', tint: 1, glow: 0.12, grad: [0.82, 1.14, 0.12, 0.3] });
  parts.push(cloud(0.095, 0, 0.215, 0.005, 0.6), cloud(0.07, 0.1, 0.19, 0.03), cloud(0.07, -0.105, 0.185, -0.02), cloud(0.055, 0.03, 0.27, -0.02), cloud(0.05, -0.04, 0.25, 0.07));
  // Pétalas no chão: discos pequenos em volta, na cor da copa.
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, d = 0.11 + (i % 3) * 0.035;
    parts.push({ geo: disc(0.009, 5, Math.cos(a) * d, 0.002, Math.sin(a) * d), color: '#fff', tint: 1, glow: 0.15 });
  }
  // Torii miúdo diante da árvore.
  const red = '#c8402e';
  parts.push({ geo: cyl(0.004, 0.0045, 0.05, 6, 0.12, 0, -0.07), color: red }, { geo: cyl(0.004, 0.0045, 0.05, 6, 0.17, 0, -0.07), color: red });
  parts.push({ geo: box(0.07, 0.007, 0.01, 0.145, 0.044, -0.07), color: '#2a2624' }, { geo: box(0.058, 0.005, 0.008, 0.145, 0.034, -0.07), color: red });
  return kit(parts);
}

/** O lago da Grande Carpa: borda de pedra, água de jade, nenúfares e uma carpa dourada em arco sobre a água, com respingos. */
export function koiPondGeometry(): THREE.BufferGeometry {
  const stone = '#8c8f8a';
  const parts: Part[] = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    parts.push({ geo: box(0.03, 0.014, 0.022).rotateY(-a).translate(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1), color: stone, grad: [0.8, 1.05, 0, 0.014] });
  }
  parts.push({ geo: disc(0.098, 16, 0, 0.009, 0), color: '#4f9a9a', glow: 0.1 });
  parts.push({ geo: disc(0.03, 8, -0.04, 0.0105, -0.03), color: '#5f9a5a' }, { geo: disc(0.022, 8, 0.05, 0.0105, 0.04), color: '#6aa862' });
  parts.push({ geo: cone(0.008, 0.012, 6, 0.05, 0.0105, 0.04), color: '#f4b6cc' });
  // A carpa saltando: corpo em arco (4 segmentos que sobem e descem), cauda aberta, dourada e brilhando de leve.
  const gold = '#f0b030';
  const seg: V3[] = [[-0.05, 0.012, 0], [-0.025, 0.045, 0], [0.0, 0.062, 0], [0.026, 0.05, 0], [0.05, 0.026, 0]];
  for (let i = 0; i < seg.length - 1; i++) parts.push({ geo: strut(seg[i], seg[i + 1], 0.018 - i * 0.003), color: gold, glow: 0.5 });
  parts.push({ geo: ball(0.011, 1.2, 0.9, 0.9, 0.052, 0.022, 0), color: gold, glow: 0.5 });
  parts.push({ geo: cone(0.012, 0.026, 3).rotateZ(Math.PI / 2 + 0.6).translate(-0.066, 0.014, 0), color: '#e8902a', glow: 0.4 });
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05;
    parts.push({ geo: new THREE.OctahedronGeometry(0.0035, 0).translate(Math.cos(a) * 0.035, 0.03 + (i % 3) * 0.012, Math.sin(a) * 0.035), color: '#dff4f4', glow: 0.5 });
  }
  return kit(parts);
}

/** O gato da sorte: maneki-neko de cerâmica (a cor da instância tinge o corpo) num santuário de pilares vermelhos e telhado escuro. */
export function luckyCatGeometry(): THREE.BufferGeometry {
  return kit([
    { geo: box(0.08, 0.012, 0.07), color: '#8a8478', grad: [0.8, 1, 0, 0.012] },
    { geo: box(0.05, 0.03, 0.04, 0, 0.012), color: '#a8a296' },
    { geo: ball(0.016, 1, 1.15, 0.9, 0, 0.062, 0), color: '#fff', tint: 1 },
    { geo: ball(0.013, 1.15, 1, 1, 0, 0.088, 0), color: '#fff', tint: 1 },
    { geo: cone(0.0045, 0.01, 3, -0.005, 0.098, 0.008), color: '#fff', tint: 1 },
    { geo: cone(0.0045, 0.01, 3, -0.005, 0.098, -0.008), color: '#fff', tint: 1 },
    { geo: strut([0.006, 0.07, 0.014], [0.012, 0.098, 0.018], 0.007), color: '#fff', tint: 1 },
    { geo: box(0.02, 0.004, 0.002, 0.012, 0.068, 0), color: '#c8402e' },
    { geo: cyl(0.005, 0.005, 0.002, 8, 0.013, 0.056, 0).rotateZ(Math.PI / 2), color: '#e8b43a', glow: 0.4 },
    { geo: cyl(0.0035, 0.004, 0.11, 5, -0.034, 0.012, -0.028), color: '#c8402e' },
    { geo: cyl(0.0035, 0.004, 0.11, 5, -0.034, 0.012, 0.028), color: '#c8402e' },
    { geo: cyl(0.0035, 0.004, 0.11, 5, 0.034, 0.012, -0.028), color: '#c8402e' },
    { geo: cyl(0.0035, 0.004, 0.11, 5, 0.034, 0.012, 0.028), color: '#c8402e' },
    { geo: cone(0.066, 0.03, 4, 0, 0.122).rotateY(Math.PI / 4), color: '#3f4650' },
  ]);
}
