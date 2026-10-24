// Mapa da província: pergaminho sobre a mesa de nogueira, a capital em miniatura no centro e três postos acesos.
import * as THREE from 'three';
import { MATS, type Stage, type Env } from './stage';
import { MAP_W, MAP_D, POS, ROUTES, mapTexture } from './mapart';
import { buildBrejo, BREJO } from './v_brejo';
import { buildSerra, SERRA } from './v_serra';
import { buildCosta, COSTA } from './v_costa';
import { buildCapital, CAPITAL } from './v_capital';
import { walnutTexture, tableTexture, mistTexture } from './tex';
import { fbm, smooth } from './rng';
import type { V2 } from './structs';
import type { PItem } from './pool';

let walnut: THREE.MeshStandardMaterial | null = null;
const WALNUT = (): THREE.MeshStandardMaterial => {
  if (!walnut) { const t = walnutTexture(); t.repeat.set(5, 3); walnut = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, envMapIntensity: 0.6 }); }
  return walnut;
};
const BRASS = new THREE.MeshStandardMaterial({ color: 0xc9964a, metalness: 1, roughness: 0.3, envMapIntensity: 1.5 });

export interface MapOpts { x: number; z: number; s: number; arrival: boolean }
export interface MapHandle { capital: { x: number; z: number }; spots: Record<'capital' | 'brejo' | 'serra' | 'costa', { x: number; z: number }>; parked: { x: number; z: number }; root: THREE.Group }

export function buildMap(S: Stage, o: MapOpts): MapHandle {
  const { x: ox, z: oz, s } = o;
  S.noCast = true;
  const root = new THREE.Group();
  root.position.set(ox, 0, oz); root.scale.setScalar(s);
  S.group.add(root);
  const W = (lx: number, lz: number): { x: number; z: number } => ({ x: ox + lx * s, z: oz + lz * s });

  // mesa
  const table = new THREE.Mesh(new THREE.PlaneGeometry(64, 44), WALNUT());
  table.rotation.x = -Math.PI / 2; table.position.y = -0.42; table.receiveShadow = true;
  S.group.add(table);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshBasicMaterial({ map: tableTexture(), transparent: true, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.set(ox, -0.4, oz); S.group.add(halo);

  // pergaminho com cantos levemente curvados
  const geo = new THREE.PlaneGeometry(MAP_W, MAP_D, 100, 64);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const ex = Math.abs(x) / (MAP_W / 2), ez = Math.abs(z) / (MAP_D / 2);
    const curl = 0.22 * smooth(0.82, 1, ex) * smooth(0.55, 1, ez) + 0.05 * smooth(0.9, 1, ez);
    p.setY(i, curl + (fbm(x * 0.4, z * 0.4, 1) - 0.5) * 0.05);
  }
  geo.computeVertexNormals();
  const sheet = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: mapTexture(), roughness: 0.9, metalness: 0 }));
  sheet.receiveShadow = true; sheet.castShadow = true;
  root.add(sheet);
  // rolos de madeira com ponteiras de latão
  for (const sx of [-1, 1]) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, MAP_D + 0.9, 20), WALNUT());
    roll.rotation.x = Math.PI / 2; roll.position.set(sx * (MAP_W / 2 + 0.2), 0.14, 0); roll.castShadow = true; roll.receiveShadow = true;
    root.add(roll);
    for (const sz of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 20), BRASS);
      cap.rotation.x = Math.PI / 2; cap.position.set(sx * (MAP_W / 2 + 0.2), 0.14, sz * (MAP_D / 2 + 0.5)); root.add(cap);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), BRASS);
      knob.position.set(sx * (MAP_W / 2 + 0.2), 0.14, sz * (MAP_D / 2 + 0.72)); root.add(knob);
    }
  }
  // pesos de latão nos cantos
  for (const [wx, wz] of [[-8.6, 5.4], [8.9, 5.5]]) {
    const wgt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.3, 14), BRASS);
    wgt.position.set(wx, 0.2, wz); wgt.castShadow = true; root.add(wgt);
  }

  // miniaturas: o chão assenta no pergaminho
  const mini = (_id: string, pos: V2, sc: number, base: number, yaw: number, build: (S: Stage, mini: boolean) => unknown): { x: number; z: number } => {
    const w = W(pos[0], pos[1]);
    S.at(w.x, 0.03 + (0.6 - base) * sc * s, w.z, yaw, sc * s);
    build(S, true);
    return w;
  };
  const spots = {
    capital: mini('capital', POS.capital, 0.255, -2.3, 0, buildCapital),
    brejo: mini('brejo', POS.brejo, 0.215, -2.0, 0.3, buildBrejo),
    serra: mini('serra', POS.serra, 0.215, -2.2, -0.35, buildSerra),
    costa: mini('costa', POS.costa, 0.215, -2.2, 0.2, buildCosta),
  };
  void CAPITAL; void BREJO; void SERRA; void COSTA;
  S.at(0, 0, 0, 0, 1);
  S.glowMin = 0.5;

  // halos de luz acesos sob cada posto (e um brilho maior na capital)
  for (const [k, w] of Object.entries(spots)) S.glow(w.x, 0.12, w.z, k === 'capital' ? 5.6 * s : 4.1 * s, k === 'capital' ? 0xffd9a0 : 0xffc76f, 0.15);
  // bandeirolas do posto
  const flag = (kind: string, w: { x: number; z: number }, dx: number, dz: number): void => { S.put(kind, w.x + dx * s, 0.03, w.z + dz * s, 0.4, 0.62 * s); };
  flag('banBrejo', spots.brejo, 1.6, 1.2); flag('banSerra', spots.serra, -1.6, 1.3); flag('banCosta', spots.costa, -1.5, 1.4); flag('banCap', spots.capital, -2.6, 1.7);

  // bruma sobre a terra incógnita
  const tex = mistTexture(21);
  const mists: { m: THREE.Mesh; sp: number }[] = [];
  for (const [mx, mz, w, d, op] of [[-9.6, 0, 3.4, 9, 0.5], [9.8, -3.5, 3.2, 6, 0.45], [0, -6.4, 16, 2.4, 0.4], [-4, 6.4, 10, 2.2, 0.38], [5, 6.4, 8, 2.2, 0.38], [-9.4, -5.4, 4, 3.5, 0.55], [9.4, 5.8, 4, 3, 0.45]] as number[][]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: op, color: 0xd9ccb4 }));
    m.rotation.x = -Math.PI / 2; m.position.set(ox + mx * s, 0.5 * s + 0.25, oz + mz * s); m.scale.setScalar(s); m.renderOrder = 4;
    S.group.add(m); mists.push({ m, sp: 0.01 + Math.random() * 0.01 });
  }

  // caravana: carroça e dois bois
  const parked = W(1.5, 2.65);
  const wag = S.put('wagon', 0, 0, 0, 0, 1.0 * s);
  const ox1 = S.put('ox', 0, 0, 0, 0, 0.85 * s), ox2 = S.put('ox', 0, 0, 0, 0, 0.85 * s);
  const route = ROUTES.serra.map(([x, z]) => W(x, z));
  const lens = [0]; for (let i = 1; i < route.length; i++) lens.push(lens[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z));
  const dust: PItem[] = [];
  for (let i = 0; i < 6; i++) dust.push(S.put('puff', 0, 0, 0, 0, 0, { col: new THREE.Color(0.85, 0.78, 0.65) }));
  const place = (x: number, z: number, yaw: number, t: number): void => {
    const c = Math.cos(yaw), si = Math.sin(yaw);
    const bob = Math.abs(Math.sin(t * 7)) * 0.012 * s;
    wag.x = x; wag.z = z; wag.y = 0.04 + bob; wag.yaw = yaw;
    ox1.x = x + c * 0.5 * s + si * 0.1 * s * 0; ox1.z = z - si * 0.5 * s; ox1.y = 0.04 + bob; ox1.yaw = yaw;
    ox2.x = ox1.x + si * 0.18 * s; ox2.z = ox1.z + c * 0.18 * s; ox2.y = ox1.y; ox2.yaw = yaw;
    ox1.x -= si * 0.09 * s; ox1.z -= c * 0.09 * s;
    for (const q of ['wagon', 'ox']) S.pools.get(q)!.dirty = true;
  };
  const sparkle: PItem[] = [];
  if (o.arrival) {
    place(parked.x, parked.z, -0.35, 0);
    for (const w of [W(2.6, 0.9), spots.brejo, parked]) sparkle.push(S.glow(w.x + (w === spots.brejo ? 0.2 * s : 0), 0.9 * s, w.z - (w === spots.brejo ? 0.2 * s : 0), 3.0 * s, 0xffe08a, 2));
    sparkle.push(S.glow(spots.capital.x + 0.5 * s, 1.6 * s, spots.capital.z + 0.1 * s, 2.6 * s, 0xfff0b0, 2));
  }
  S.anims.push((e: Env) => {
    for (const q of mists) q.m.rotation.z += e.dt * q.sp;
    if (!o.arrival) {
      const total = lens[lens.length - 1];
      const ph = (e.t * 0.16) % 2, f = ph < 1 ? ph : 2 - ph;
      const d = f * total;
      let k = 1; while (k < lens.length - 1 && lens[k] < d) k++;
      const u = (d - lens[k - 1]) / (lens[k] - lens[k - 1] || 1);
      const a = route[k - 1], b = route[k];
      const dir = ph < 1 ? 1 : -1;
      const yaw = Math.atan2(-(b.z - a.z) * dir, (b.x - a.x) * dir);
      place(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u, yaw, e.t);
      dust.forEach((it, i) => {
        const age = (e.t * 0.8 + i / 6) % 1;
        it.x = wag.x - Math.cos(yaw) * (0.2 + age * 0.5) * s; it.z = wag.z + Math.sin(yaw) * (0.2 + age * 0.5) * s; it.y = 0.08 + age * 0.3 * s;
        it.bx = it.by = it.bz = (0.15 + age * 0.4) * (1 - age) * s * 1.2;
      });
    }
    S.pools.get('puff')?.mesh && (S.pools.get('puff')!.dirty = true);
    void MATS;
  });
  return { capital: spots.capital, spots, parked, root };
}
