// Chão do diorama: uma malha por região fundada, com hexágonos chanfrados no topo e o corte lateral de terra em camadas
// (capa de relva, terra, argila, pedra) só nas bordas expostas. Tudo gerado em código.
import * as THREE from 'three';
import { DIRS, ckey, hash2 } from '../data';
import type { Cell, Model } from '../model';

const PI = Math.PI;
// camadas de cima para baixo: relva, terra, argila, pedra (espessuras)
const BANDS: Array<{ col: number; t: number }> = [
  { col: 0x6f9a45, t: 0.07 }, { col: 0x8a6544, t: 0.27 }, { col: 0xb9854f, t: 0.22 }, { col: 0x8f8a80, t: 9 },
];
const c3 = new THREE.Color();

export function regionGeometry(model: Model, regionId: string): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const tri = (a: number[], b: number[], c: number[], ca: THREE.Color, cb: THREE.Color, cc: THREE.Color, out: boolean): void => {
    // garante a face para fora: normal · (centro - miolo) > 0 (o miolo vem em out=false/true pelo chamador)
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    void nx; void nz;
    const flip = out ? ny < 0 : false;
    const o = flip ? [a, c, b] : [a, b, c];
    const oc = flip ? [ca, cc, cb] : [ca, cb, cc];
    for (let i = 0; i < 3; i++) { pos.push(o[i][0], o[i][1], o[i][2]); col.push(oc[i].r, oc[i].g, oc[i].b); }
  };
  // face lateral: o chamador passa os vértices na ordem que olha para fora
  const quad = (p0: number[], p1: number[], q0: number[], q1: number[], c0: THREE.Color, c1: THREE.Color): void => {
    // p0,p1 em cima (da esquerda para a direita visto de fora), q0,q1 embaixo
    for (const [a, b, c, ca, cb, cc] of [[p0, q0, p1, c0, c1, c0], [p1, q0, q1, c0, c1, c1]] as Array<[number[], number[], number[], THREE.Color, THREE.Color, THREE.Color]>) {
      for (const [v, k] of [[a, ca], [b, cb], [c, cc]] as Array<[number[], THREE.Color]>) { pos.push(v[0], v[1], v[2]); col.push(k.r, k.g, k.b); }
    }
  };
  for (const c of model.cells.values()) {
    if (c.region.id !== regionId) continue;
    const R = 1.0, ri = 0.92, bev = 0.035;
    const vx = (k: number, r: number): [number, number] => [c.x + Math.cos(k * PI / 3) * r, c.z + Math.sin(k * PI / 3) * r];
    const top = new THREE.Color(c.col);
    const edge = top.clone().multiplyScalar(0.8);
    // topo: leque de seis triângulos até o centro (levemente erguido), chanfro até a borda
    for (let k = 0; k < 6; k++) {
      const [x0, z0] = vx(k, ri), [x1, z1] = vx(k + 1, ri);
      const [X0, Z0] = vx(k, R), [X1, Z1] = vx(k + 1, R);
      const lift = 0.008;
      const sh = (kk: number): THREE.Color => top.clone().multiplyScalar(kk);
      const nb = model.cells.get(ckey(c.q + DIRS[k][0], c.r + DIRS[k][1]));
      const seam = nb && nb.region.id !== c.region.id; // fronteira entre regiões: sulco mais escuro
      const eCol = seam ? top.clone().multiplyScalar(0.55) : edge;
      // face de cima (normal +y): sentido horário visto de cima
      tri([c.x, c.h + lift, c.z], [x1, c.h, z1], [x0, c.h, z0], sh(1.05), sh(0.98), sh(0.98), true);
      // chanfro
      tri([x0, c.h, z0], [x1, c.h, z1], [X1, c.h - bev, Z1], sh(0.98), sh(0.98), eCol, true);
      tri([x0, c.h, z0], [X1, c.h - bev, Z1], [X0, c.h - bev, Z0], sh(0.98), eCol, eCol, true);
      // lado exposto
      const exposed = !nb || nb.h < c.h - 0.001;
      if (!exposed) continue;
      const yBottom = nb ? nb.h - bev : -0.06;
      const yTop = c.h - bev;
      const N = 3;
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N;
        const a = [X0 + (X1 - X0) * t0, Z0 + (Z1 - Z0) * t0], b = [X0 + (X1 - X0) * t1, Z0 + (Z1 - Z0) * t1];
        const wob = (t: number, j: number): number => (hash2(c.q * 7 + k * 3 + t * 5, c.r * 11 + j, 21) - 0.5) * 0.07;
        // limites das camadas, contados a partir do topo desta célula
        let acc = 0;
        for (let j = 0; j < BANDS.length; j++) {
          const d0 = acc, d1 = acc + BANDS[j].t;
          acc = d1;
          const y0a = Math.max(yBottom, yTop - d0 - (j === 0 ? 0 : wob(t0 * N, j)));
          const y0b = Math.max(yBottom, yTop - d0 - (j === 0 ? 0 : wob(t1 * N, j)));
          const y1a = Math.max(yBottom, yTop - d1 - wob(t0 * N, j + 1));
          const y1b = Math.max(yBottom, yTop - d1 - wob(t1 * N, j + 1));
          if (y0a <= yBottom && y0b <= yBottom) break;
          c3.set(BANDS[j].col);
          const shade = 1 - Math.min(0.28, d0 * 0.2);
          const cA = c3.clone().multiplyScalar(shade * (0.96 + hash2(c.q + i, c.r + j, k) * 0.08));
          // vértices de cima para a esquerda/direita; a ordem de enrolamento olha para fora
          quad([b[0], y0b, b[1]], [a[0], y0a, a[1]], [b[0], y1b, b[1]], [a[0], y1a, a[1]], cA, cA);
        }
      }
    }
    void vx; void edge;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export type { Cell };
