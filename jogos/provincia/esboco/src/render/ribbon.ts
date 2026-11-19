// Fitas deitadas sobre o chão: rio (com margem) e estrada. Seguem uma polilinha, com largura variável.
import * as THREE from 'three';
import type { Pt } from '../data';

export interface RibbonOpts { y: number; width: (t: number) => number; center: number; edge: number; uvw?: boolean; jitter?: number; }

/** Junta várias polilinhas numa malha só (cor por vértice: borda → meio → borda). */
export function ribbon(runs: Pt[][], o: RibbonOpts): THREE.BufferGeometry | null {
  const pos: number[] = [], col: number[] = [], uvw: number[] = [], idx: number[] = [];
  const cC = new THREE.Color(o.center), cE = new THREE.Color(o.edge);
  let base = 0;
  for (const run of runs) {
    if (run.length < 2) continue;
    // comprimento acumulado
    const cum = [0];
    for (let i = 1; i < run.length; i++) cum.push(cum[i - 1] + Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]));
    const total = cum[cum.length - 1] || 1;
    // reamostra para ~0.12 de passo
    for (let i = 0; i < run.length; i++) {
      const a = run[Math.max(0, i - 1)], b = run[Math.min(run.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const w = o.width(cum[i] / total) / 2;
      const px = run[i][0], pz = run[i][1];
      for (const s of [-1, 0, 1]) {
        const x = px - dz * w * s, z = pz + dx * w * s;
        pos.push(x, o.y, z);
        const c = s === 0 ? cC : cE;
        const j = 1 + ((Math.sin(cum[i] * 7.3 + s) * 0.5) * (o.jitter ?? 0));
        col.push(c.r * j, c.g * j, c.b * j);
        uvw.push(cum[i], s);
      }
      if (i > 0) {
        const p = base + (i - 1) * 3, q = base + i * 3;
        // duas faixas: (esq, meio) e (meio, dir); a face aponta para cima
        idx.push(p, p + 1, q, q, p + 1, q + 1, p + 1, p + 2, q + 1, q + 1, p + 2, q + 2);
      }
    }
    base += run.length * 3;
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (o.uvw) g.setAttribute('uvw', new THREE.Float32BufferAttribute(uvw, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // as normais saem do enrolamento; forçamos para cima onde ele inverter
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  g.computeBoundingSphere();
  return g;
}
