// Ajudantes comuns às vistas: distâncias a poligonais, sorteio em região, montagem do bloco de terra no palco.
import * as THREE from 'three';
import type { Island, Water } from './island';
import type { Stage } from './stage';
import { fbm, mulberry32, smooth } from './rng';
import type { V2 } from './structs';

export { smooth, fbm, mulberry32 };
export type { V2 };

export function distSeg(px: number, pz: number, a: V2, b: V2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2)) : 0;
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}
export function distPoly(px: number, pz: number, pts: V2[]): number {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(px, pz, pts[i], pts[i + 1]));
  return d;
}
/** Suaviza uma poligonal (Catmull-Rom) para margens e trilhas orgânicas. */
export function curve(pts: V2[], per = 6): V2[] {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
  return c.getPoints((pts.length - 1) * per).map((p) => [p.x, p.z] as V2);
}
export const face = (x: number, z: number, tx: number, tz: number): number => Math.atan2(tx - x, tz - z);
export const mix = (a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color): THREE.Color => out.copy(a).lerp(b, t);
export const hex = (h: number): THREE.Color => new THREE.Color(h);

/** Sorteia pontos numa região com um teste; devolve até n pontos com afastamento mínimo. */
export function scatter(r: () => number, n: number, cx: number, cz: number, rad: number, ok: (x: number, z: number) => boolean, gap = 0, tries = 40): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < tries; t++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * rad;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!ok(x, z)) continue;
      if (gap > 0 && out.some((p) => Math.hypot(p[0] - x, p[1] - z) < gap)) continue;
      out.push([x, z]);
      break;
    }
  }
  return out;
}

/** Põe o bloco de terra (e as águas) no palco, na posição do Place atual, e liga a animação da água. */
export function mount(S: Stage, isl: Island, waters: Water[]): void {
  const { x, y, z, yaw, s } = S.P;
  isl.group.position.set(x, y, z);
  isl.group.rotation.y = yaw;
  isl.group.scale.setScalar(s);
  S.group.add(isl.group);
  if (S.noCast) isl.terrain.castShadow = true;
  for (const w of waters) {
    w.mesh.position.set(x, y, z);
    w.mesh.rotation.y = yaw;
    w.mesh.scale.setScalar(s);
    S.group.add(w.mesh);
    S.waters.push(w);
  }
}

/** Malha única (passarela, ponte) no sistema local do Place atual. */
export function meshAt(S: Stage, geo: THREE.BufferGeometry, mat: THREE.Material = LITMAT()): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  const { x, y, z, yaw, s } = S.P;
  m.position.set(x, y, z); m.rotation.y = yaw; m.scale.setScalar(s);
  m.castShadow = true; m.receiveShadow = true;
  S.group.add(m);
  return m;
}
import { MATS } from './stage';
const LITMAT = (): THREE.Material => MATS.lit;
