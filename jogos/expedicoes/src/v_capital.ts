// Capital: um burgo de colinas e rio. Na semana 4 ganha bairros que refletem as expedições:
// pescadores (costa), torres de pedra (serra), canal com passarelas (brejo) e um mercado com barracas das três origens.
import * as THREE from 'three';
import { MATS, type Stage, type Env } from './stage';
import { Island } from './island';
import { Geo } from './geo';
import { boardwalk, walk } from './structs';
import { curve, distPoly, face, fbm, hex, meshAt, mount, mulberry32, scatter, smooth, type V2 } from './common';
import type { PItem } from './pool';
import { pier } from './structs';

export const CAPITAL = { R: 8.8 };
const RIVER: V2[] = curve([[-9.6, 2.8], [-7.2, 2.3], [-5.0, 3.0], [-2.8, 3.6], [-0.6, 3.5], [1.8, 4.0], [3.6, 4.9], [5.2, 5.6]], 6);
const CANAL: V2[] = curve([[-3.3, 3.5], [-4.7, 2.0], [-5.6, 0.3], [-6.0, -1.6], [-5.6, -3.2]], 6);
const BAY = { x: 6.0, z: 5.9 };
const WL = 0.05;
const ROADS: V2[][] = [
  curve([[0, 0.1], [1.8, -0.9], [3.6, -1.4], [5.8, -2.2], [8.8, -2.6]], 5),
  curve([[0, 0.1], [-1.8, 0.7], [-3.4, 0.9], [-6.4, 1.2], [-9, 1.0]], 5),
  curve([[0, 0.1], [0.3, 1.6], [0.5, 2.8], [0.6, 4.2], [1.0, 6.4], [1.4, 9]], 5),
  curve([[0, 0.1], [1.6, 1.0], [3.2, 1.6], [4.8, 1.8], [6.3, 1.5]], 5),
  curve([[0, 0.1], [-0.2, -1.4], [-0.4, -3.0], [-0.4, -4.5]], 5),
];
const FIELDS = [{ x: 4.6, z: -3.9, w: 3.0, d: 2.0, rot: 0.2 }, { x: -3.4, z: -3.6, w: 2.8, d: 1.9, rot: -0.15 }];
export const wk = { v: 0 };

function fieldMask(f: { x: number; z: number; w: number; d: number; rot: number }, x: number, z: number): { m: number; v: number } {
  const c = Math.cos(f.rot), s = Math.sin(f.rot);
  const dx = x - f.x, dz = z - f.z, u = dx * c + dz * s, v = -dx * s + dz * c;
  return { m: smooth(f.w / 2 + 0.12, f.w / 2 - 0.2, Math.abs(u)) * smooth(f.d / 2 + 0.12, f.d / 2 - 0.2, Math.abs(v)), v: u };
}
export function capitalH(x: number, z: number): number {
  let h = 0.5 + (fbm(x * 0.3, z * 0.3, 2) - 0.5) * 0.6 + (fbm(x * 1.2, z * 1.2, 4) - 0.5) * 0.12;
  h += 1.5 * Math.exp(-(((x + 0.4) ** 2) / 11 + ((z + 5.6) ** 2) / 6));
  h += 0.5 * Math.exp(-(((x - 5.2) ** 2) / 5 + ((z + 3.9) ** 2) / 3));
  h += 0.7 * smooth(5.5, 9, Math.hypot(x, z * 0.8)) * smooth(-1, -6, z);
  const dp = Math.hypot(x, z - 0.1); h += (0.62 - h) * smooth(3.0, 2.3, dp);
  h += (2.0 - h) * smooth(2.4, 1.2, Math.hypot(x + 0.4, z + 5.2)) * 0.9;
  const wr = 0.55 + 0.1 * Math.sin(x * 0.9);
  h -= 0.9 * smooth(wr + 0.5, wr - 0.1, distPoly(x, z, RIVER));
  h -= 0.75 * smooth(0.75, 0.2, distPoly(x, z, CANAL));
  const bd = Math.hypot(x - BAY.x, z - BAY.z) - (3.1 + 0.4 * Math.sin(3 * Math.atan2(z - BAY.z, x - BAY.x)) + 0.2 * Math.sin(7 * x));
  h -= 1.6 * smooth(0.5, -0.7, bd);
  return h;
}

const GRASS = hex(0x86b04e), GRASS2 = hex(0x9cc062), HILL = hex(0x739a47), COBBLE = hex(0xb9ad98), DIRT = hex(0xc9ae7c), WHEAT = hex(0xd9b94a), WHEAT2 = hex(0xb8962f), MUD = hex(0x6c6a4a);
const SANDC = hex(0xe0cfa0), PAVE = hex(0x9d988e), DARKMUD = hex(0x5c5236), WETC = hex(0x6a6040);

export function buildCapital(S: Stage, mini: boolean): Island {
  const r = mulberry32(52);
  const isl = new Island({
    R: CAPITAL.R, seed: 9, base: -2.3, wobble: 1.0, nr: mini ? 32 : 74, ns: mini ? 100 : 230,
    h: capitalH,
    color: (x, z, h, _s, out) => {
      const n = fbm(x * 1.2, z * 1.2, 5);
      out.copy(GRASS).lerp(GRASS2, n);
      out.lerp(HILL, smooth(0.9, 1.9, h) * 0.8);
      if (h < 0.3) out.lerp(MUD, smooth(0.3, 0.05, h) * 0.8);
      let fm = 0, fv = 0;
      for (const f of FIELDS) { const q = fieldMask(f, x, z); if (q.m > fm) { fm = q.m; fv = q.v; } }
      out.lerp(WHEAT.clone().lerp(WHEAT2, 0.5 + 0.5 * Math.sin(fv * 22)), fm * 0.95);
      let dr = Infinity; for (const rd of ROADS) dr = Math.min(dr, distPoly(x, z, rd));
      out.lerp(DIRT, smooth(0.42, 0.22, dr) * 0.9);
      out.lerp(COBBLE, smooth(2.4, 2.1, Math.hypot(x, z - 0.1)));
      if (h < WL - 0.03) { out.copy(MUD).lerp(hex(0x3c3a2a), smooth(0, -0.8, h)); return; }
      if (wk.v > 0) {
        // bairros novos pintam o próprio chão
        const fish = smooth(2.3, 1.5, Math.hypot(x - 5.6, z - 1.8)) * wk.v;
        out.lerp(SANDC, fish * 0.75).lerp(PAVE, fish * smooth(0.3, 0.1, Math.abs(Math.sin(x * 4) * Math.sin(z * 4))) * 0.3);
        const tw = smooth(2.6, 1.5, Math.hypot(x + 0.4, z + 4.6)) * wk.v;
        out.lerp(PAVE, tw * 0.75);
        const cn = smooth(1.5, 0.7, distPoly(x, z, CANAL)) * wk.v;
        out.lerp(DARKMUD.clone().lerp(WETC, n), cn * 0.7);
        const mk = smooth(2.6, 2.1, Math.hypot(x, z - 0.1)) * smooth(0.9, 1.3, Math.hypot(x, z - 0.1)) * wk.v;
        out.lerp(hex(0xd6c9ae), mk * 0.45);
      }
    },
    strata: [{ color: 0x6b8a3a, depth: 0.16 }, { color: 0x7a5a3a, depth: 0.34 }, { color: 0xa88660, depth: 0.3 }, { color: 0x8c8a82, depth: 0.4 }, { color: 0x4a4a48, depth: 9 }],
  });
  const river = isl.water({ level: WL, deep: new THREE.Color(0x2a6a80), shallow: new THREE.Color(0x7fc0c0), alpha: 0.86, foam: 0.45, wave: 0.01, speed: 0.9, nr: mini ? 28 : 56, ns: mini ? 90 : 170 });
  mount(S, isl, [river]);
  const ins = (x: number, z: number, m = 0.4): boolean => isl.inside(x, z) > m;
  const dryok = (x: number, z: number, m = 0): boolean => capitalH(x, z) > 0.3 && distPoly(x, z, RIVER) > 0.9 + m && distPoly(x, z, CANAL) > 0.9 + m && Math.hypot(x - BAY.x, z - BAY.z) > 3.9 + m;
  const roadD = (x: number, z: number): number => Math.min(...ROADS.map((rd) => distPoly(x, z, rd)));

  // itens da semana 4
  const w4: { it: PItem; kit: string }[] = [];
  const emit: { em: { str: number }; base: number; four: boolean }[] = [];
  const put = (four: boolean, kit: string, x: number, y: number, z: number, yaw = 0, s = 1, o: Partial<PItem> = {}): PItem => {
    const it = S.put(kit, x, y, z, yaw, s, o);
    if (four) w4.push({ it, kit });
    return it;
  };
  const glow = (four: boolean, x: number, y: number, z: number, size: number, col: number, fl = 0): PItem => {
    const it = S.glow(x, y, z, size, col, fl);
    if (four) w4.push({ it, kit: 'glow' });
    return it;
  };
  const home = (four: boolean, kit: string, x: number, z: number, yaw: number, s = 1): void => {
    const y = capitalH(x, z);
    put(four, kit, x, y, z, yaw, s, { col: S.tone(0.94 + r() * 0.1) });
    if (mini) return;
    glow(four, x + Math.sin(yaw) * 0.55, y + 0.4, z + Math.cos(yaw) * 0.55, 1.0, 0xffb360, 0.2);
    if (r() < 0.6) { const em = S.smoke(x - Math.sin(yaw) * 0.12 + Math.cos(yaw) * -0.3, y + 1.05, z - Math.cos(yaw) * 0.12 - Math.sin(yaw) * -0.3, 0.5); emit.push({ em, base: 0.5, four }); }
  };

  // ---------- Semana 1: o burgo ----------
  const core: [number, number, string][] = [
    [-3.6, -1.6, 'capHouse'], [-3.9, 0.9, 'capCot'], [3.7, -1.9, 'capHouse2'], [3.9, 0.3, 'capCot2'], [-2.0, 2.0, 'capCot'], [1.9, 2.3, 'capHouse'], [-1.9, -3.0, 'capCot2'], [1.9, -3.4, 'capCot'],
  ];
  for (const [x, z, k] of core) home(false, k, x, z, face(x, z, 0, 0.1) + (r() - 0.5) * 0.3, 1);
  put(false, 'fountain', 0, 0.62, 0.15, 0, 1);
  put(false, 'clock', -1.6, 0.62, -1.2, 0.5, 0.95);
  put(false, 'well', -1.8, capitalH(-1.8, 1.4), 1.4, 0, 1);
  const mill = put(false, 'mill', 5.6, capitalH(5.6, -2.6) + 0.02, -2.6, -0.4, 0.95);
  void mill;
  const blades = S.put('millBlades', 5.6 + Math.sin(-0.4) * 0.45, capitalH(5.6, -2.6) + 1.62 * 0.95, -2.6 + Math.cos(-0.4) * 0.45, -0.4, 0.95);
  if (!mini) {
    for (const [x, z] of [[1.7, 0.6], [-1.4, -0.6], [1.5, -1.3], [-0.5, 1.5]] as V2[]) { S.put('lamp', x, 0.62, z, 0, 0.9); S.glow(x, 0.62 + 0.82, z, 1.0, 0xffc479, 0.5); }
    // cercas e feno nos campos
    for (const f of FIELDS) {
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      for (let i = 0; i < 6; i++) { const u = -f.w / 2 + (i + 0.5) * f.w / 6; S.put('fence', f.x + u * c + (f.d / 2 + 0.1) * -s, capitalH(f.x + u * c, f.z + u * s), f.z + u * s + (f.d / 2 + 0.1) * c, -f.rot, 1); }
      S.put('hay', f.x - f.w / 2 - 0.4, capitalH(f.x - f.w / 2 - 0.4, f.z), f.z, 0.4, 1);
      S.put('hay', f.x - f.w / 2 - 0.3, capitalH(f.x - f.w / 2 - 0.3, f.z + 0.5), f.z + 0.5, 1.2, 0.9);
    }
  }
  // carvalhos, moitas e flores
  const trees = scatter(r, mini ? 24 : 70, 0, 0, CAPITAL.R, (x, z) => ins(x, z, 0.6) && dryok(x, z, 0.1) && roadD(x, z) > 0.7 && Math.hypot(x, z - 0.1) > 3.4
    && Math.hypot(x + 0.4, z + 5.0) > 3.2 && FIELDS.every((f) => fieldMask(f, x, z).m < 0.01) && Math.hypot(x - 6, z - 1.8) > 2.4 && distPoly(x, z, CANAL) > 1.6 && core.every((c) => Math.hypot(c[0] - x, c[1] - z) > 1.1), 0.9, 14);
  for (const [x, z] of trees) put(false, 'oak', x, capitalH(x, z) - 0.04, z, r() * 6, 0.85 + r() * 0.5, { col: S.tone(0.88 + r() * 0.2, 0.2 * (r() - 0.5)) });
  if (!mini) {
    for (const [x, z] of scatter(r, 140, 0, 0, CAPITAL.R, (x, z) => ins(x, z, 0.5) && dryok(x, z) && roadD(x, z) > 0.4 && Math.hypot(x, z - 0.1) > 2.6 && FIELDS.every((f) => fieldMask(f, x, z).m < 0.05), 0.35, 8)) S.put(r() < 0.5 ? 'tuft' : 'shrub', x, capitalH(x, z), z, r() * 6, 0.7 + r() * 0.5, { col: S.tone(0.85 + r() * 0.3) });
    // ovelhas no cercado
    const sheep = [0, 1, 2, 3].map((i) => ({ it: S.put('sheep', -6.2 + i * 0.3, capitalH(-6.2, -5.6), -5.6 + (i % 2) * 0.4, r() * 6, 1.1), hx: -6.0, hz: -5.6, ph: r() * 6 }));
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; S.put('fence', -6.0 + Math.cos(a) * 1.3, capitalH(-6.0, -5.6), -5.6 + Math.sin(a) * 1.0, -a + Math.PI / 2, 0.9); }
    const doves = [0, 1, 2, 3, 4].map(() => ({ a: S.put('birdA', 0, 4, 0, 0, 1.2), b: S.put('birdB', 0, 4, 0, 0, 1.2), ph: r() * 6, rad: 2 + r() * 2.5 }));
    const row = S.put('row', -3.4, WL, 3.5, 0.2, 1.1);
    S.anims.push((e: Env) => {
      const t = e.t;
      sheep.forEach((s) => { const a = t * 0.3 + s.ph; s.it.x = s.hx + Math.cos(a) * 0.6; s.it.z = s.hz + Math.sin(a) * 0.45; s.it.yaw = -a - Math.PI / 2; });
      S.pools.get('sheep')!.dirty = true;
      doves.forEach((d) => { const a = t * 0.4 + d.ph, flap = Math.sin(t * 10 + d.ph) > 0; for (const [it, on] of [[d.a, flap], [d.b, !flap]] as const) { it.x = -1.6 + Math.cos(a) * d.rad; it.z = -1.2 + Math.sin(a) * d.rad * 0.8; it.y = 3.4 + Math.sin(a * 2) * 0.3; it.yaw = Math.atan2(Math.cos(a) * 0.8, -Math.sin(a)); it.vis = on ? 1 : 0; } });
      S.pools.get('birdA')!.dirty = S.pools.get('birdB')!.dirty = true;
      row.x = -3.4 + Math.sin(t * 0.2) * 0.8; row.y = WL + Math.sin(t * 1.3) * 0.01; S.pools.get('row')!.dirty = true;
    });
  }
  // ponte de pedra sobre o rio e passarela sobre o canal
  const arc = (L: number): THREE.BufferGeometry => {
    const g = new Geo(160);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const x = -L + ((i + 0.5) * 2 * L) / n, y = 0.3 * (1 - (x / L) ** 2), sl = Math.atan2(-0.6 * x / (L * L), 1);
      g.box(2 * L / n + 0.01, 0.08, 0.7, i % 2 ? 0xb9ad98 : 0xa89c88, { x, y, rz: sl, grad: [0.9, 1] });
    }
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) { const x = -L + ((i + 0.5) * 2 * L) / n, y = 0.3 * (1 - (x / L) ** 2), sl = Math.atan2(-0.6 * x / (L * L), 1); g.box(2 * L / n, 0.14, 0.07, 0x8f8b84, { x, y: y + 0.12, z: s * 0.36, rz: sl, grad: [0.8, 1] }); }
    for (const s of [-1, 1]) g.box(0.4, 0.3, 0.9, 0x9a9086, { x: s * (L + 0.1), y: -0.02, grad: [0.7, 1] });
    return g.build();
  };
  { const bz = 3.55; const m = meshAt(S, arc(1.1)); const w = S.world(0.55, capitalH(0.55, bz) + 0.14, bz); m.position.copy(w); m.rotation.y = S.P.yaw + Math.PI / 2; m.scale.setScalar(S.P.s); }

  // ---------- Semana 4: bairros ----------
  // casas novas nos arredores
  const extra: [number, number, string][] = [[-2.8, 3.0, 'capHouse2'], [3.0, 3.1, 'capCot'], [-4.8, -3.6, 'capHouse'], [4.2, -0.3, 'capCot2'], [-0.8, 4.6, 'capCot'], [2.4, -4.9, 'capHouse2']];
  for (const [x, z, k] of extra) if (dryok(x, z, 0)) home(true, k, x, z, face(x, z, 0, 0.1) + (r() - 0.5) * 0.3, 0.95);

  const g4 = new THREE.Group();
  S.group.add(g4);
  g4.position.set(S.P.x, S.P.y, S.P.z); g4.rotation.y = S.P.yaw; g4.scale.setScalar(S.P.s);
  const mesh4 = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, ry = 0): void => {
    const m = new THREE.Mesh(geo, MATS.lit); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; g4.add(m);
  };

  // --- bairro dos pescadores (estilo da costa) ---
  const fishH: [number, number][] = [[4.5, 1.1], [5.7, 0.7], [6.9, 1.2], [5.0, 2.3], [6.4, 2.4], [7.5, 2.7], [3.8, 2.6]];
  fishH.forEach(([x, z], i) => { if (mini && i > 3) return; if (capitalH(x, z) > 0.28 && ins(x, z, 0.5)) home(true, i % 3 === 1 ? 'caiB' : 'caiA', x, z, face(x, z, BAY.x, BAY.z) + (r() - 0.5) * 0.3, 0.95); });
  { const x = 5.6, z = 3.0; if (capitalH(x, z) > 0.2) put(true, 'chapel', 7.4, capitalH(7.4, 0.2), 0.2, face(7.4, 0.2, BAY.x, BAY.z), 0.8); }
  let px = 5.5, pz = 2.4; for (let zz = 1.5; zz < 5; zz += 0.05) if (capitalH(5.5, zz) < 0.22) { px = 5.5; pz = zz; break; }
  mesh4(pier(mini ? 1.4 : 2.4, 0.34, -1.0), px, 0, pz, -Math.PI / 2);
  if (!mini) {
    for (const [dx, dz, k, yy] of [[0.9, 1.0, 'fishB', 0], [-0.9, 1.9, 'fishR', 0], [0.95, 2.6, 'row', 0], [-0.8, 0.6, 'row', 0]] as [number, number, string, number][]) put(true, k, px + dx, yy, pz + dz, r() * 6, 1.1);
    for (const [x, z] of [[4.6, 0.3], [6.2, 0.2], [7.0, 1.8]] as V2[]) if (capitalH(x, z) > 0.25) put(true, 'netrack', x, capitalH(x, z), z, r() * 3, 1);
    put(true, 'fishrack', 5.0, capitalH(5.0, 3.0), 3.0, 0.3, 1);
    put(true, 'banCosta', 4.0, capitalH(4.0, 1.9), 1.9, 0, 1);
    for (const dz of [0.5, 1.6]) { put(true, 'lamp', px + 0.28, 0.36, pz + dz, 0, 0.8); glow(true, px + 0.28, 0.36 + 0.7, pz + dz, 1.0, 0xffc479, 0.4); }
  }
  // --- torres de pedra (estilo da serra) ---
  put(true, 'tower1', -0.4, capitalH(-0.4, -5.2), -5.2, 0.4, 1.05);
  put(true, 'tower0', -2.4, capitalH(-2.4, -4.5), -4.5, 0.2, 1);
  put(true, 'tower0', 1.7, capitalH(1.7, -4.6), -4.6, -0.3, 1);
  if (!mini) {
    put(true, 'chaletA0', -1.5, capitalH(-1.5, -3.6), -3.6, face(-1.5, -3.6, 0, 0.1), 1);
    put(true, 'chaletA0', 0.8, capitalH(0.8, -3.3), -3.3, face(0.8, -3.3, 0, 0.1), 1);
    glow(true, -0.4, capitalH(-0.4, -5.2) + 2.4, -5.2, 1.4, 0xffb360, 0.1);
    for (const p of walk([[-3.0, -3.7], [-2.2, -3.1], [-0.4, -2.7], [1.4, -2.9], [2.5, -3.7]], 0.58)) put(true, 'wall', p.x, capitalH(p.x, p.z), p.z, -p.a, 1);
    put(true, 'banSerra', -1.0, capitalH(-1.0, -2.2), -2.2, 0, 1.2);
    put(true, 'banSerra', 0.2, capitalH(0.2, -2.2), -2.2, 0, 1.2);
    for (const [x, z] of scatter(r, 16, -0.4, -5.2, 3.6, (x, z) => capitalH(x, z) > 0.9 && ins(x, z, 0.6) && Math.hypot(x + 0.4, z + 5.2) > 1.5 && roadD(x, z) > 0.5, 0.7)) put(true, 'pineD', x, capitalH(x, z) - 0.03, z, r() * 6, 0.9 + r() * 0.5);
    for (const [x, z] of [[-1.0, -3.9], [0.5, -4.0]] as V2[]) { put(true, 'lpost', x, capitalH(x, z), z, 0, 1); glow(true, x + 0.16, capitalH(x, z) + 0.56, z, 0.8, 0xffc479, 0.5); }
  }
  // --- canal com passarelas (estilo do brejo) ---
  const stilts: [number, number, string][] = [[-4.7, 2.0, 'stiltB'], [-5.6, 0.3, 'stiltA'], [-6.0, -1.6, 'stiltA']];
  stilts.forEach(([x, z, k], i) => {
    if (mini && i > 0) return;
    const yaw = Math.atan2(-6.0 - (-4.7), 0) * 0 + (i === 0 ? 0.9 : 1.57);
    put(true, k, x + 0.02, WL, z, yaw, 0.95);
    if (!mini) { glow(true, x + Math.sin(yaw) * 0.5, WL + 0.98, z + Math.cos(yaw) * 0.5, 1.1, 0xffb360, 0.2); }
  });
  const off = (pts: V2[], d: number): V2[] => pts.map(([x, z], i) => { const a = i < pts.length - 1 ? Math.atan2(pts[i + 1][1] - z, pts[i + 1][0] - x) : Math.atan2(z - pts[i - 1][1], x - pts[i - 1][0]); return [x - Math.sin(a) * d, z + Math.cos(a) * d] as V2; });
  const deckY = (x: number, z: number): number => { const h = capitalH(x, z); const w = smooth(0.4, 0.15, h); return (h + 0.12) * (1 - w) + (WL + 0.5) * w; };
  const pileY = (x: number, z: number): number => capitalH(x, z) - 0.05;
  const cs = CANAL.filter((_, i) => i % 3 === 0);
  mesh4(boardwalk(off(cs, 0.85), 0.42, deckY, pileY, { rail: true, seed: 161 }));
  mesh4(boardwalk(off(cs, -0.85), 0.42, deckY, pileY, { rail: false, seed: 162 }));
  mesh4(boardwalk([[-5.2, 0.1], [-5.6, 0.3], [-6.0, 0.7]] as V2[], 0.42, (x, z) => Math.max(deckY(x, z), WL + 0.5), pileY, { rail: true, seed: 163 }));
  mesh4(boardwalk([[-4.4, 2.4], [-4.9, 2.2], [-5.4, 1.9]] as V2[], 0.42, (x, z) => Math.max(deckY(x, z), WL + 0.5), pileY, { rail: true, seed: 164 }));
  if (!mini) {
    for (const [x, z] of scatter(r, 40, -5.4, 0.8, 3.6, (x, z) => ins(x, z, 0.5) && Math.abs(distPoly(x, z, CANAL) - 0.5) < 0.35, 0.2, 8)) put(true, r() < 0.4 ? 'reedT' : 'reed', x, Math.max(capitalH(x, z), WL - 0.1), z, r() * 6, 0.8 + r() * 0.5);
    for (const [x, z] of [[-7.0, 0.2], [-4.2, -2.6], [-3.8, 3.2]] as V2[]) if (ins(x, z, 0.8)) put(true, 'willow', x, capitalH(x, z) - 0.05, z, r() * 6, 1.3);
    walk(off(cs, 0.85), 1.7).forEach((q, i) => { if (i % 2) return; put(true, 'lpost', q.x, deckY(q.x, q.z), q.z, q.a + Math.PI / 2, 1); glow(true, q.x, deckY(q.x, q.z) + 0.56, q.z, 0.8, 0xffc479, 0.6); });
    put(true, 'banBrejo', -4.0, capitalH(-4.0, 1.9), 1.9, 0, 1.2);
    put(true, 'flat', -5.6, WL + 0.01, -0.5, 1.57, 1.1);
    for (let i = 0; i < 6; i++) put(true, 'lily', -5.6 + Math.sin(i * 2) * 0.2, WL + 0.01, 1.2 + i * 0.4 - 1.0 + Math.cos(i) * 0.05, i, 0.8);
  }
  // --- mercado: barracas das três origens em volta da fonte ---
  const kinds = ['stallFish', 'stallOre', 'stallReed'];
  const nst = mini ? 4 : 8;
  for (let i = 0; i < nst; i++) {
    const a = 0.3 + (i / nst) * 6.283 + 0.2;
    // deixa as bocas das ruas livres
    const x = Math.cos(a) * 1.75, z = 0.15 + Math.sin(a) * 1.75;
    if (roadD(x, z) < 0.38) continue;
    put(true, kinds[i % 3], x, 0.63, z, face(x, z, 0, 0.15), 1);
    if (!mini) glow(true, x, 0.63 + 0.62, z, 0.9, 0xffc479, 0.5);
  }
  if (!mini) {
    put(true, 'banCosta', 1.2, 0.63, -1.4, 0.3, 1.1); put(true, 'banSerra', -1.2, 0.63, 1.6, 0.3, 1.1); put(true, 'banBrejo', 2.2, 0.63, 1.3, 0.3, 1.1);
    for (const [x, z, k] of [[1.2, 1.9, 'crateF'], [-2.1, -0.1, 'barrel'], [2.1, -1.2, 'crate'], [-1.0, 2.2, 'barrel'], [0.4, -2.1, 'crateF']] as [number, number, string][]) put(true, k, x, 0.63, z, r() * 6, 1.1);
  }

  // ---------- animação e troca de semana ----------
  const apply = (w: number, instant: boolean): void => {
    const on = w === 4;
    w4.forEach((q, i) => { const pool = S.pools.get(q.kit)!; pool.show(q.it, on, instant ? 0 : (i % 40) * 0.025, instant); });
    g4.visible = true;
    target = on ? 1 : 0;
    if (instant) { g4Scale = target; wk.v = target; isl.recolor(); }
  };
  let target = 0, g4Scale = 0;
  S.weekHook = apply;
  S.anims.push((e: Env) => {
    blades.rz = -e.t * 0.45; S.pools.get('millBlades')!.dirty = true;
    if (Math.abs(g4Scale - target) > 0.001) {
      g4Scale += Math.sign(target - g4Scale) * Math.min(Math.abs(target - g4Scale), e.dt / 1.4);
      wk.v = g4Scale; isl.recolor();
    }
    g4.scale.set(S.P.s, Math.max(1e-3, g4Scale) * S.P.s, S.P.s); g4.visible = g4Scale > 0.005;
    for (const q of emit) q.em.str = q.base * (q.four ? Math.min(1, Math.max(0, (g4Scale - 0.6) / 0.4)) : 1);
  });
  return isl;
}
