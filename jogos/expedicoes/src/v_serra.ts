// Posto na serra: encosta nevada, chalés de pedra, trilha em ziguezague, boca de mina com trilhos, cabras, pinheiros e uma ponte de corda.
import * as THREE from 'three';
import type { Stage, Env } from './stage';
import { Island } from './island';
import { ropeBridge, walk } from './structs';
import { curve, distPoly, face, fbm, hex, meshAt, mount, mulberry32, scatter, smooth, type V2 } from './common';
import { mistTexture } from './tex';

export const SERRA = { R: 7.3 };
const GORGE: V2[] = curve([[3.6, -7.6], [3.7, -5.0], [3.4, -2.6], [3.9, -0.4], [4.6, 1.8], [5.2, 4.2], [5.6, 7.0]], 5);
const TRAIL: V2[] = curve([[-0.2, 0.9], [-1.7, 0.3], [-0.6, -0.7], [-2.1, -1.4], [-1.0, -2.3], [-2.4, -3.0]], 6);
const PADS: [number, number, number, number][] = [[-0.3, 1.2, 2.3, 0.95], [-2.4, -3.1, 0.9, 2.5], [5.5, -1.2, 1.2, 1.3], [5.5, 1.4, 1.2, 1.2]];

export function serraH(x: number, z: number): number {
  // maciço ao fundo (norte), vale ao sul
  const peak1 = 4.3 * Math.exp(-((x + 1.6) ** 2 / 9 + (z + 5.0) ** 2 / 8));
  const peak2 = 3.1 * Math.exp(-((x - 2.6) ** 2 / 6 + (z + 4.4) ** 2 / 5));
  const ridge = 1.7 * smooth(-1.0, -6.0, z);
  const east = 1.9 * smooth(4.3, 6.5, x) * smooth(-4.5, -1.0, z) ;
  let h = 0.35 + peak1 + peak2 + ridge * 0.6 + east + (fbm(x * 0.45, z * 0.45, 4) - 0.5) * 0.9 * (0.4 + smooth(-1, -4, z));
  h += (fbm(x * 1.7, z * 1.7, 12) - 0.5) * 0.18;
  for (const [px, pz, r, ph] of PADS) { const d = Math.hypot(x - px, z - pz); h += (ph - h) * smooth(r + 1.0, r, d); }
  // desfiladeiro
  const g = distPoly(x, z, GORGE);
  const w = 0.55 + 0.1 * Math.sin(z * 1.1);
  h -= 3.2 * smooth(w + 0.55, w - 0.1, g) ;
  return h;
}

const SNOW = hex(0xeef3f8), SNOW2 = hex(0xdde8f2), ROCK = hex(0x8b8a88), ROCK2 = hex(0x6a6e78), DIRT = hex(0x8a7a68), PATH = hex(0xb3a48c), FROZEN = hex(0xb7c4b6), TRAMP = hex(0xcfc9c0);

export function buildSerra(S: Stage, mini: boolean): Island {
  const r = mulberry32(33);
  const isl = new Island({
    R: SERRA.R, seed: 5, base: -2.2, wobble: 1.0, nr: mini ? 30 : 70, ns: mini ? 90 : 210,
    h: serraH,
    color: (x, z, h, slope, out) => {
      const n = fbm(x * 1.3, z * 1.3, 2);
      out.copy(SNOW).lerp(SNOW2, n);
      const rock = smooth(0.75, 1.45, slope + (n - 0.5) * 0.5);
      const low = smooth(1.6, 0.4, h);
      out.lerp(FROZEN, low * 0.55 * smooth(0.3, 0.9, n));
      out.lerp(ROCK.clone().lerp(ROCK2, n), rock);
      const gp = distPoly(x, z, GORGE);
      out.lerp(ROCK2, smooth(1.4, 0.5, gp) * 0.8);
      const tr = distPoly(x, z, TRAIL);
      out.lerp(PATH, smooth(0.28, 0.12, tr) * 0.9);
      for (const [px, pz, rr] of PADS) out.lerp(TRAMP.clone().lerp(DIRT, 0.35), smooth(rr, rr - 0.7, Math.hypot(x - px, z - pz)) * 0.8);
    },
    strata: [{ color: 0xf0f5fa, depth: 0.14 }, { color: 0x7a5e44, depth: 0.28 }, { color: 0x8b8a88, depth: 0.4 }, { color: 0x6a6e78, depth: 0.35 }, { color: 0x9a9890, depth: 0.3 }, { color: 0x3a3f48, depth: 9 }],
  });
  // riacho congelado no fundo do desfiladeiro e um lago gelado no vale
  const ice = isl.water({ level: -1.5, deep: new THREE.Color(0x35566e), shallow: new THREE.Color(0xa8c8dc), alpha: 0.8, foam: 0, wave: 0.0, speed: 0.2, nr: 30, ns: 90 });
  mount(S, isl, mini ? [] : [ice]);
  const ins = (x: number, z: number, m = 0.4): boolean => isl.inside(x, z) > m;
  const free = (x: number, z: number, m = 0): boolean => distPoly(x, z, GORGE) > 1.1 + m && distPoly(x, z, TRAIL) > 0.35 + m;

  // ---- vila no patamar ----
  const vill: [number, number, number, string][] = [
    [-0.9, 0.9, 0, 'chaletB'], [0.9, 0.4, 0, 'chaletA'], [-1.9, 1.8, 0, 'chaletA'], [0.3, 2.1, 0, 'chaletB'], [1.9, 1.7, 0, 'chaletA'], [-2.6, 0.2, 0, 'chaletA'],
  ];
  const cx = -0.3, cz = 1.2;
  let nh = 0;
  for (const [x, z, , k] of vill) {
    if (mini && nh > 3) break;
    nh++;
    const y = serraH(x, z);
    const yaw = face(x, z, cx, cz) + (r() - 0.5) * 0.4;
    S.put(k, x, y, z, yaw, 0.95 + r() * 0.12, { col: S.tone(0.94 + r() * 0.1) });
    if (!mini) {
      S.glow(x + Math.sin(yaw) * 0.55, y + 0.62, z + Math.cos(yaw) * 0.55, 1.0, 0xffb360, 0.2);
      S.smoke(x + Math.cos(yaw) * 0.28 * 1 - Math.sin(yaw) * -0.12, y + 1.5, z + Math.sin(yaw) * -0.28 * 1 + Math.cos(yaw) * -0.12, 0.8);
    }
  }
  // torre de vigia no fim da trilha
  S.put('towerS', -2.4, serraH(-2.4, -3.1), -3.1, 0.6, 1.0);
  if (!mini) S.glow(-2.4, serraH(-2.4, -3.1) + 1.4, -3.1, 1.3, 0xffb360, 0.1);
  // fogueira da praça
  if (!mini) {
    const fy = serraH(cx, cz);
    S.put('lantern', cx, fy + 0.12, cz, 0, 1.6);
    S.glow(cx, fy + 0.25, cz, 1.8, 0xff9a40, 1.2);
    for (let i = 0; i < 5; i++) S.put('rock', cx + Math.cos(i * 1.26) * 0.2, fy, cz + Math.sin(i * 1.26) * 0.2, i, 0.5);
  }
  // muros de pedra com neve
  if (!mini) for (const [a, b] of [[[-3.5, 2.8], [-1.5, 3.4]], [[1.8, 3.0], [3.0, 2.3]]] as [V2, V2][]) {
    for (const p of walk([a, b], 0.6)) S.put('wallS', p.x, serraH(p.x, p.z), p.z, -p.a, 1);
  }
  // lampiões
  if (!mini) for (const [x, z] of [[-1.5, 1.3], [0.6, 1.0], [-0.2, 2.3], [-3.1, -0.4], [1.5, -0.3]] as V2[]) {
    S.put('lpost', x, serraH(x, z), z, r() * 6, 1);
    S.glow(x + 0.16, serraH(x, z) + 0.56, z, 0.8, 0xffc479, 0.5);
  }
  // trilha: estacas com fita
  if (!mini) for (const p of walk(TRAIL, 0.9)) if (p.s > 0.5) S.put('sign', p.x + 0.25, serraH(p.x + 0.25, p.z), p.z, r() * 6, 0.55);

  // ---- mina e trilhos ----
  const mx = 6.2, mz = -2.3;
  S.put('mineMouth', mx, serraH(mx, mz), mz, -Math.PI / 2 + 0.05, 1.25);
  const RAIL: V2[] = curve([[mx - 0.6, mz], [4.95, mz + 0.05], [4.85, mz + 1.0], [5.0, mz + 2.2], [5.5, mz + 3.2]], 6);
  const cartPath: V2[] = [];
  if (!mini) {
    for (const p of walk(RAIL, 0.42)) { S.put('rail', p.x, serraH(p.x, p.z) - 0.01, p.z, -p.a, 1); cartPath.push([p.x, p.z]); }
    S.put('crate', 5.9, serraH(5.9, 1.2), 1.2, 0.3, 1);
    S.put('barrel', 5.7, serraH(5.7, 1.0), 1.3, 0, 1);
    S.glow(mx - 0.1, serraH(mx, mz) + 0.75, mz + 0.3 * 1.25, 1.1, 0xffc479, 0.4);
  }
  // ---- ponte de corda sobre o desfiladeiro ----
  const A = new THREE.Vector3(2.55, serraH(2.55, -1.6) + 0.35, -1.6), B = new THREE.Vector3(5.0, serraH(5.0, -1.2) + 0.35, -1.2);
  // acerta o terreno dos dois lados: a ponte nasce em patamares
  meshAt(S, ropeBridge(A, B, 0.3));

  // ---- pinheiros: vale e encostas baixas ----
  const pines = scatter(r, mini ? 30 : 170, 0, 0, SERRA.R, (x, z) => {
    const h = serraH(x, z);
    return ins(x, z, 0.35) && free(x, z, 0.1) && h > 0.1 && h < 2.4 && Math.hypot(x - cx, z - cz) > 3.1 && distPoly(x, z, RAIL) > 0.6 && Math.hypot(x - mx, z - mz) > 1.4;
  }, 0.55, 12);
  for (const [x, z] of pines) {
    const h = serraH(x, z);
    const big = r() < 0.5 ? 'pineS' : 'pineD';
    S.put(big === 'pineD' && h > 1.2 ? 'pineS' : big, x, h - 0.04, z, r() * 6, 0.85 + r() * 0.8, { col: S.tone(0.88 + r() * 0.2) });
  }
  // rochas altas e montes de neve
  for (const [x, z] of scatter(r, mini ? 8 : 46, 0, 0, SERRA.R, (x, z) => ins(x, z, 0.4) && free(x, z) && serraH(x, z) > 1.0, 0.5, 8)) S.put('rockBig', x, serraH(x, z) - 0.05, z, r() * 6, 0.7 + r() * 0.9, { col: S.tone(0.8 + r() * 0.3) });
  if (!mini) for (const [x, z] of scatter(r, 60, 0, 0, SERRA.R, (x, z) => ins(x, z, 0.4) && free(x, z) && serraH(x, z) < 1.8, 0.3, 8)) S.put('mound', x, serraH(x, z) - 0.02, z, r() * 6, 0.6 + r() * 0.9);

  if (mini) return isl;

  // ---- cabras: andam entre pedras perto da trilha ----
  const goats = [[-1.6, -1.0], [-2.7, -2.0], [-0.9, -2.8], [2.2, 3.0], [-3.7, 0.6], [1.0, -1.2]].map(([x, z], i) => ({ it: S.put('goat', x, serraH(x, z), z, r() * 6, 1.25, { col: S.tone(i % 3 === 0 ? 0.62 : i % 3 === 1 ? 0.96 : 0.8) }), x, z, ph: r() * 6, sp: 0.3 + r() * 0.2 }));
  // vagoneta
  const cart = S.put('cart', 0, 0, 0, 0, 1.2);
  const cartLen: number[] = [0];
  for (let i = 1; i < cartPath.length; i++) cartLen.push(cartLen[i - 1] + Math.hypot(cartPath[i][0] - cartPath[i - 1][0], cartPath[i][1] - cartPath[i - 1][1]));
  // pássaro grande (águia) e neve
  const eagle = [S.put('birdA', 0, 5, 0, 0, 2.2, { col: S.tone(0.5) }), S.put('birdB', 0, 5, 0, 0, 2.2, { col: S.tone(0.5) })];
  const flakes = Array.from({ length: 170 }, () => ({ it: S.put('flake', 0, 0, 0, 0, 1), x: (r() - 0.5) * 15, z: (r() - 0.5) * 15, u: r(), sp: 0.14 + r() * 0.12 }));
  // névoa no desfiladeiro e no vale
  const tex = mistTexture(5);
  const mists = [0, 1].map((i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.35, color: 0xe6eefa }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, i === 0 ? -0.9 : 0.55, 0); m.renderOrder = 3 + i;
    S.group.add(m); return m;
  });
  S.anims.push((e: Env) => {
    const t = e.t;
    for (const g of goats) {
      const a = t * g.sp + g.ph, x = g.x + Math.cos(a) * 0.5, z = g.z + Math.sin(a * 0.8) * 0.4;
      const p = Math.min(serraH(x, z), 4);
      g.it.x = x; g.it.z = z; g.it.y = p + Math.abs(Math.sin(a * 6)) * 0.01;
      g.it.yaw = Math.atan2(-Math.cos(a * 0.8) * 0.32, -Math.sin(a) * 0.5);
    }
    S.pools.get('goat')!.dirty = true;
    // vagoneta vai e vem; sai da mina e volta
    const total = cartLen[cartLen.length - 1];
    const ph = (Math.sin(t * 0.18) * 0.5 + 0.5) * total;
    let k = 1; while (k < cartLen.length - 1 && cartLen[k] < ph) k++;
    const f = (ph - cartLen[k - 1]) / (cartLen[k] - cartLen[k - 1] || 1);
    const a = cartPath[k - 1], b = cartPath[k];
    cart.x = a[0] + (b[0] - a[0]) * f; cart.z = a[1] + (b[1] - a[1]) * f; cart.y = serraH(cart.x, cart.z) + 0.02;
    cart.yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    S.pools.get('cart')!.dirty = true;
    const ea = t * 0.12;
    const flap = Math.sin(t * 2.2) > 0;
    eagle.forEach((it, i) => { it.x = Math.cos(ea) * 5.2; it.z = Math.sin(ea) * 4.4 - 1; it.y = 4.6 + Math.sin(ea * 3) * 0.3; it.yaw = Math.atan2(Math.cos(ea) * 4.4, -Math.sin(ea) * 5.2); it.vis = (i === 0) === flap ? 1 : 0; });
    S.pools.get('birdA')!.dirty = S.pools.get('birdB')!.dirty = true;
    for (const f2 of flakes) {
      const u = (f2.u + t * f2.sp) % 1;
      f2.it.x = f2.x + Math.sin(t * 0.6 + f2.z) * 0.4; f2.it.z = f2.z + Math.cos(t * 0.5 + f2.x) * 0.3;
      f2.it.y = 5.2 * (1 - u) - 0.2;
      f2.it.bx = f2.it.by = f2.it.bz = 0.9 * Math.min(1, u * 8) * Math.min(1, (1 - u) * 8);
    }
    S.pools.get('flake')!.dirty = true;
    mists.forEach((m, i) => { (m.material as THREE.MeshBasicMaterial).opacity = (i === 0 ? 0.55 : 0.28) * (1 - e.night * 0.5); m.rotation.z += e.dt * 0.006 * (i ? -1 : 1); });
  });
  return isl;
}
