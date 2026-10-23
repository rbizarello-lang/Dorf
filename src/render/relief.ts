import * as THREE from 'three/webgpu';
import { mulberry32 } from '../core/rng';

// Relevo decorativo (R1): os kits `peak` (serra de rocha com neve opcional) e `hill` (morro gramado).
// Os dois seguem o contrato dos kits de lib.ts (position, normal, color, tint, glow) e saem de uma
// semente fixa: a geometria depende só do tema. O que varia de peça para peça é a escala (x, y, z),
// o giro e a cor da instância. Medidas no espaço do kit (a peça tem raio 1).

/** Serra: raio da base e altura do cume principal, com a escala 1 (a escala de altura fica entre 0,75 e 1,05: no máximo ~0,9 acima do chão). */
export const PEAK = { r: 0.5, h: 0.85 };
/** Morro: raio da base e altura do topo, com a escala 1. */
export const HILL = { r: 0.45, h: 0.24 };

/** Cumes da serra, sempre os mesmos: [ângulo do centro, distância (em PEAK.r), raio e altura (fração do principal)]. */
export const PEAK_CONES: readonly [number, number, number, number][] = [
  [0, 0, 1, 1],
  [0.9, 0.66, 0.6, 0.62],
  [3.7, 0.72, 0.46, 0.42],
  [5.3, 0.7, 0.34, 0.28],
];
/** Alcance da serra a partir do centro, em PEAK.r (com a folga das cristas): a pegada na peça. */
export const PEAK_REACH = 1.1 * Math.max(...PEAK_CONES.map(([, d, r]) => d + r));

const SNOW = new THREE.Color('#f4f7fb');
const tmp = new THREE.Color();

type V3 = [number, number, number];

class Mesh {
  pos: number[] = [];
  col: number[] = [];
  tint: number[] = [];

  vert(p: V3, c: THREE.Color, t: number) {
    this.pos.push(...p);
    this.col.push(c.r, c.g, c.b);
    this.tint.push(t);
  }

  /** Triângulo com a face para fora do eixo (ox, oz) e para cima; cada vértice leva a cor e o tint dele. */
  face(a: V3, b: V3, c: V3, ca: THREE.Color, cb: THREE.Color, cc: THREE.Color, ta: number, tb: number, tc: number, ox: number, oz: number) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (a[0] + b[0] + c[0]) / 3 - ox, mz = (a[2] + b[2] + c[2]) / 3 - oz;
    if (nx * mx + nz * mz + ny * 0.3 < 0) {
      [b, c] = [c, b];
      [cb, cc] = [cc, cb];
      [tb, tc] = [tc, tb];
    }
    this.vert(a, ca, ta);
    this.vert(b, cb, tb);
    this.vert(c, cc, tc);
  }

  /** Malha sem índice: a normal sai da face (serra facetada). */
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(this.tint), 1));
    g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(this.tint.length), 1));
    g.computeVertexNormals();
    return g;
  }
}

export interface PeakOpts {
  /** Neve nos cumes (pela altura, com a linha irregular). */
  snow: boolean;
  /** Cor do pé da serra (o chão de prado do tema: a rocha nasce da terra sem emenda). */
  foot: THREE.ColorRepresentation;
  /** Mata no alto da serra (essa cor, em facetas fixas) no lugar da neve: a chapada de rocha com a mata no topo. */
  crown?: THREE.ColorRepresentation;
  /** Versão leve para o zoom aberto: poucas faces, mesma silhueta. */
  far?: boolean;
  /** Névoa de pintura em tinta: do pé até ~60% da altura a rocha desbota para esta cor (e a cor da instância tinge menos). */
  mist?: THREE.ColorRepresentation;
}

/**
 * Serra de rocha facetada: um cume principal, um ombro e um contraforte (3 cones sobrepostos, ~100 faces;
 * a versão leve tem ~35). Rocha com `tint = 1` (recebe a cor da instância), neve e pé gramado com cor fixa.
 */
export function peakGeometry(o: PeakOpts): THREE.BufferGeometry {
  const rng = mulberry32(0x9e4a11);
  const m = new Mesh();
  const foot = new THREE.Color(o.foot);
  const snowLine = 0.36;
  const mist = o.mist !== undefined ? new THREE.Color(o.mist) : null;
  // Quanto de névoa há na altura y (1 no pé, 0 a 60% do cume principal).
  const mistAt = (y: number) => (mist ? Math.pow(Math.max(0, 1 - y / (PEAK.h * 0.6)), 1.3) * 0.9 : 0);
  const crown = o.crown !== undefined ? new THREE.Color(o.crown) : null;
  const crownLine = 0.6;
  PEAK_CONES.forEach(([ang, dist, rs, hs], k) => {
    const ox = Math.cos(ang) * dist * PEAK.r, oz = Math.sin(ang) * dist * PEAK.r;
    const R = PEAK.r * rs, H = PEAK.h * hs;
    // Anéis: [raio, altura] em fração de R e H. O de baixo afunda no chão.
    const N = o.far ? 5 : k === 0 ? 9 : 7;
    const rings: [number, number][] = o.far ? [[1, -0.08], [0.55, 0.45]] : k === 0 ? [[1, -0.08], [0.78, 0.22], [0.5, 0.5], [0.24, 0.78]] : [[1, -0.08], [0.72, 0.34], [0.36, 0.7]];
    const rot = rng() * 6.28;
    const verts: V3[][] = rings.map(([rr, hh], ri) =>
      Array.from({ length: N }, (_, i) => {
        // Cristas e vales: raios alternados; o anel do alto é mais regular.
        const ridge = (i % 2 ? 0.78 : 1.15) * (ri < 2 ? 1 : 0.9);
        const a = rot + ((i + (rng() - 0.5) * 0.4) / N) * Math.PI * 2;
        const r = R * rr * ridge * (0.92 + rng() * 0.16);
        return [ox + Math.cos(a) * r, H * hh + (ri > 0 ? (rng() - 0.5) * 0.14 * H : 0), oz + Math.sin(a) * r] as V3;
      }),
    );
    const apex: V3 = [ox + (rng() - 0.5) * 0.18 * R, H, oz + (rng() - 0.5) * 0.18 * R];
    const rock = (yc: number) => {
      // Com névoa (tinta), a rocha escurece para o cume (nanquim) em vez de clarear: o pé se perde na bruma.
      const f = (mist ? 0.98 - 0.3 * Math.min(1, yc / PEAK.h) : 0.74 + 0.34 * Math.min(1, yc / PEAK.h)) * (0.8 + rng() * 0.34);
      return tmp.setRGB(f, f * (0.97 + rng() * 0.06), f);
    };
    const faceTint = (yc: number) => (o.snow && yc / H > snowLine + (rng() - 0.5) * 0.18 ? 0 : 1);
    const put = (a: V3, b: V3, c: V3) => {
      const yc = (a[1] + b[1] + c[1]) / 3;
      const base = rock(yc).clone();
      const snow = faceTint(yc) === 0;
      // Mata no topo: as facetas altas ficam verdes (cor fixa, valor sorteado por faceta, linha irregular).
      const wood = crown !== null && yc / H > crownLine + (rng() - 0.5) * 0.16;
      const col = wood ? crown!.clone().multiplyScalar(0.8 + rng() * 0.4) : snow ? SNOW.clone().multiplyScalar(0.94 + rng() * 0.08) : base;
      const vc = (p: V3) => (p[1] < 0.015 ? foot : mist && !snow && !wood ? col.clone().lerp(mist, mistAt(p[1])) : col);
      const vt = (p: V3) => (p[1] < 0.015 ? 0 : snow || wood ? 0 : 1 - mistAt(p[1]) * 0.85);
      m.face(a, b, c, vc(a), vc(b), vc(c), vt(a), vt(b), vt(c), ox, oz);
    };
    for (let ri = 0; ri + 1 < rings.length; ri++) {
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const a = verts[ri][i], b = verts[ri][j], c = verts[ri + 1][j], d = verts[ri + 1][i];
        // Diagonal alternada: as facetas não formam grade.
        if ((i + ri + k) % 2) {
          put(a, b, c);
          put(a, c, d);
        } else {
          put(a, b, d);
          put(b, c, d);
        }
      }
    }
    const top = verts[verts.length - 1];
    for (let i = 0; i < N; i++) put(top[i], top[(i + 1) % N], apex);
  });
  return m.build();
}

/** Perfil do morro: altura (fração de HILL.h) a `d` do centro (0 a 1), arredondada, com o fundo afundado no chão. */
export function hillProfile(d: number) {
  return Math.max(-0.1, Math.pow(Math.cos(Math.min(1, d) * Math.PI * 0.5), 1.25) * 1.1 - 0.1);
}

export interface HillOpts {
  /** Versão leve para o zoom aberto. */
  far?: boolean;
}

/** Morro gramado, arredondado (normais suaves): ~70 faces; a versão leve, ~18. A cor vem da instância (`tint = 1`). */
export function hillGeometry(o: HillOpts = {}): THREE.BufferGeometry {
  const segs = o.far ? 6 : 10;
  const ds = o.far ? [0.5, 1] : [0.3, 0.58, 0.8, 0.95, 1];
  const pos: number[] = [0, HILL.h * hillProfile(0), 0];
  const col: number[] = [1.04, 1.04, 1.04];
  ds.forEach((d, ri) => {
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      // Contorno levemente irregular (o mesmo em todos os anéis, para a encosta não torcer).
      const wob = 1 + 0.07 * Math.sin(a * 2 + 0.6) + 0.04 * Math.sin(a * 3 + 2);
      const r = HILL.r * d * wob;
      pos.push(Math.cos(a) * r, HILL.h * hillProfile(d), Math.sin(a) * r);
      const f = 1.02 - 0.12 * (ri / (ds.length - 1));
      col.push(f, f, f);
    }
  });
  const idx: number[] = [];
  // Cada triângulo sai com a face para fora de um ponto abaixo do centro (o morro é convexo).
  const tri = (a: number, b: number, c: number) => {
    const P = (i: number) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    const [pa, pb, pc] = [P(a), P(b), P(c)];
    const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2], vx = pc[0] - pa[0], vy = pc[1] - pa[1], vz = pc[2] - pa[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const cx = (pa[0] + pb[0] + pc[0]) / 3, cy = (pa[1] + pb[1] + pc[1]) / 3 + 0.2, cz = (pa[2] + pb[2] + pc[2]) / 3;
    if (nx * cx + ny * cy + nz * cz < 0) idx.push(a, c, b);
    else idx.push(a, b, c);
  };
  for (let i = 0; i < segs; i++) tri(0, 1 + i, 1 + ((i + 1) % segs));
  for (let ri = 0; ri + 1 < ds.length; ri++) {
    const a0 = 1 + ri * segs, b0 = 1 + (ri + 1) * segs;
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs;
      tri(a0 + i, a0 + j, b0 + j);
      tri(a0 + i, b0 + j, b0 + i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  const n = pos.length / 3;
  g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
