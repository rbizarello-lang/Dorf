// Posto na costa: falésia com farol, cais, barcos de pesca, redes secando, casas caiadas, gaivotas e ondas na praia.
import * as THREE from 'three';
import type { Stage, Env } from './stage';
import { MATS } from './stage';
import { Island } from './island';
import { pier, walk } from './structs';
import { curve, distPoly, fbm, hex, meshAt, mount, mulberry32, scatter, smooth, type V2 } from './common';

export const COSTA = { R: 7.4 };
const coastC = (x: number, z: number): number => x + 0.55 * z - (2.5 + 0.45 * Math.sin(1.3 * z + 0.5) + 0.3 * Math.sin(2.3 * x));
const landH = (x: number, z: number): number => 0.55 + 1.4 * smooth(0.4, -1.8, z) + (fbm(x * 0.5, z * 0.5, 6) - 0.5) * 0.35;
export function costaH(x: number, z: number): number {
  const L = landH(x, z), c = coastC(x, z);
  const w = 2.1 - 1.5 * smooth(0.9, 1.9, L);
  const t = smooth(-0.9, -0.9 + w, c);
  // praia: o fundo vai ficando mais fundo mar adentro
  return L * (1 - t) + (-0.8 - 0.25 * smooth(0, 4, c)) * t;
}
const SEA = { x: 1, z: 0.55 };
const SEAN = Math.hypot(SEA.x, SEA.z);
const PATH: V2[] = curve([[-2.6, 0.6], [-1.4, 1.0], [-0.4, 1.5], [0.4, 2.1], [0.9, 2.6]], 6);
const GRASS = hex(0x86a24c), GRASS2 = hex(0x9db25e), DRY = hex(0xb5b46c), SAND = hex(0xe6d4a4), WETS = hex(0xb9a37c), CLIFF = hex(0xd8caa4), CLIFF2 = hex(0xb7a47a), SEAB = hex(0xc9bd96), PATHC = hex(0xd8c79a);

export function buildCosta(S: Stage, mini: boolean): Island {
  const r = mulberry32(45);
  const isl = new Island({
    R: COSTA.R, seed: 7, base: -2.2, wobble: 1.0, nr: mini ? 30 : 70, ns: mini ? 90 : 210,
    h: costaH,
    color: (x, z, h, slope, out) => {
      const n = fbm(x * 1.4, z * 1.4, 3);
      out.copy(GRASS).lerp(GRASS2, n).lerp(DRY, smooth(0.5, 0.8, fbm(x * 0.6, z * 0.6, 9)) * 0.7);
      // praia
      const sand = smooth(0.42, 0.22, h);
      out.lerp(SAND, sand);
      out.lerp(WETS, smooth(0.1, 0.0, h) * 0.8);
      if (h < -0.05) out.copy(SEAB).lerp(hex(0x8aa7a0), smooth(-0.1, -0.8, h));
      // falésia
      const cl = smooth(0.7, 1.4, slope);
      out.lerp(CLIFF.clone().lerp(CLIFF2, n), cl);
      out.lerp(PATHC, smooth(0.26, 0.1, distPoly(x, z, PATH)) * 0.9);
    },
    strata: [{ color: 0x6f6a3a, depth: 0.15 }, { color: 0xe3d6b4, depth: 0.35 }, { color: 0xc8aa72, depth: 0.28 }, { color: 0xe0d3ae, depth: 0.3 }, { color: 0x8c8a82, depth: 0.4 }, { color: 0x4a4a48, depth: 9 }],
  });
  const water = isl.water({ level: 0, deep: new THREE.Color(0x1a6a94), shallow: new THREE.Color(0x7fd6d4), alpha: 0.88, foam: 0.95, surf: 0.8, wave: 0.014, speed: 1, nr: mini ? 28 : 56, ns: mini ? 90 : 170 });
  mount(S, isl, [water]);
  const ins = (x: number, z: number, m = 0.4): boolean => isl.inside(x, z) > m;
  const yaw0 = Math.atan2(SEA.x, SEA.z); // casas olham para o mar

  // ---- farol e capela no alto ----
  const lx = 3.0, lz = -3.9, ly = costaH(lx, lz);
  S.put('lighthouse', lx, ly, lz, Math.PI + 0.1, 1.0);
  S.put('chapel', -2.4, costaH(-2.4, -2.3), -2.3, yaw0 - 0.3, 1.0);
  const lensY = ly + 3.56;
  if (!mini) {
    S.glow(lx, lensY, lz, 3.4, 0xffe2a0, 0.3);
    const wx = lx - 0.95 * Math.cos(0.1) * -1;
    void wx;
    S.glow(-2.4 + 0.2, costaH(-2.4, -2.3) + 0.5, -2.3 + 0.4, 0.9, 0xffb360, 0.2);
  }

  // ---- vila de pescadores no terraço ----
  const okHouse = (x: number, z: number): boolean => ins(x, z, 1.0) && costaH(x, z) > 0.38 && coastC(x, z) < -0.9 && coastC(x, z) > -3.2 && distPoly(x, z, PATH) > 0.5 && Math.hypot(x - lx, z - lz) > 1.8 && z > -1.4 && Math.hypot(x + 2.4, z + 2.3) > 1.3;
  const hp = scatter(r, mini ? 5 : 11, -1.4, 1.6, 3.8, okHouse, 1.25, 80);
  const houses: V2[] = [];
  for (const [x, z] of hp) {
    const yaw = yaw0 + (r() - 0.5) * 0.35;
    const y = costaH(x, z);
    S.put(r() < 0.6 ? 'caiA' : 'caiB', x, y, z, yaw, 0.95 + r() * 0.15, { col: S.tone(0.95 + r() * 0.08) });
    houses.push([x, z]);
    if (!mini) {
      S.glow(x + Math.sin(yaw) * 0.55, y + 0.45, z + Math.cos(yaw) * 0.55, 1.0, 0xffb360, 0.2);
      if (r() < 0.6) S.smoke(x + Math.cos(yaw) * 0.38 - Math.sin(yaw) * 0.0, y + 0.95, z - Math.sin(yaw) * 0.38, 0.5);
    }
  }
  // escada de pedra do terraço até a praia (degraus de calçamento)
  if (!mini) for (const p of walk(PATH, 0.3)) if (p.s > 1.0) S.put('cobble', p.x + (r() - 0.5) * 0.12, costaH(p.x, p.z) + 0.005, p.z + (r() - 0.5) * 0.12, r() * 3, 1);
  // cíprestes e arbustos no alto
  for (const [x, z] of scatter(r, mini ? 6 : 34, 0, 0, COSTA.R, (x, z) => ins(x, z, 0.6) && costaH(x, z) > 0.45 && coastC(x, z) < -1.0 && distPoly(x, z, PATH) > 0.5 && houses.every((h) => Math.hypot(h[0] - x, h[1] - z) > 0.9) && Math.hypot(x - lx, z - lz) > 1.4, 0.6, 12)) {
    const it = S.put('pineD', x, costaH(x, z) - 0.03, z, r() * 6, 0.8 + r() * 0.4, { col: S.tone(0.85 + r() * 0.2, 0.2) });
    it.bx *= 0.5; it.bz *= 0.5; it.by *= 1.1;
  }
  for (const [x, z] of scatter(r, mini ? 6 : 50, 0, 0, COSTA.R, (x, z) => ins(x, z, 0.4) && costaH(x, z) > 0.3 && coastC(x, z) < -0.7 && distPoly(x, z, PATH) > 0.4, 0.4, 10)) {
    S.put(r() < 0.4 ? 'bush' : r() < 0.5 ? 'shrub' : 'tuftD', x, costaH(x, z), z, r() * 6, 0.8 + r() * 0.6, { col: S.tone(0.85 + r() * 0.3) });
  }
  if (!mini) for (const [x, z] of scatter(r, 14, 0, 0, COSTA.R, (x, z) => ins(x, z, 0.5) && coastC(x, z) > -1.1 && coastC(x, z) < -0.4 && costaH(x, z) > 0.12, 0.5)) S.put('rock', x, costaH(x, z), z, r() * 6, 0.7 + r() * 0.8);
  // rochedos no mar
  for (const [x, z] of [[4.9, 3.4], [3.3, 5.3], [5.9, 0.2]] as V2[]) if (ins(x, z, 0.8)) S.put('rockBig', x, -0.25, z, r() * 6, 0.75 + r() * 0.3);

  // ---- cais ----
  // início na praia, onde o terreno cruza 0.18 andando em direção ao mar
  let ps = 0, px = 0.2, pz = 2.3;
  for (let s = 0; s < 6; s += 0.05) { const x = -0.6 + (SEA.x / SEAN) * s - 0.2, z = 1.8 + (SEA.z / SEAN) * s; if (costaH(x, z) < 0.2) { ps = s; px = x; pz = z; break; } }
  void ps;
  const th = Math.atan2(SEA.z, SEA.x);
  const pierLen = mini ? 1.8 : 3.0;
  const pm = meshAt(S, pier(pierLen, 0.34, -0.8));
  { const w = S.world(px, 0, pz); pm.position.set(w.x, S.P.y, w.z); pm.rotation.y = S.P.yaw - th; }
  const pu = (u: number, v: number): V2 => [px + Math.cos(th) * u - Math.sin(th) * v, pz + Math.sin(th) * u + Math.cos(th) * v];
  if (!mini) {
    for (const u of [0.4, 1.6, 2.8]) { const [x, z] = pu(u, -0.28); S.put('lamp', x, 0.36, z, 0, 0.8); S.glow(x, 0.36 + 0.7, z, 1.0, 0xffc479, 0.4); }
    for (const [u, v] of [[pierLen - 0.2, 0.4], [pierLen + 0.2, -0.45], [pierLen - 0.6, 0.5]] as V2[]) { const [x, z] = pu(u, v); S.put(r() < 0.5 ? 'crateF' : 'barrel', x, 0.36, z, r() * 6, 1.1); }
    const [rx, rz] = pu(1.2, 0.4); S.put('fishrack', rx, 0.36, rz, th * -1 + 1.57, 0.8);
  }
  // barcos atracados
  const moored: { it: ReturnType<Stage['put']>; ph: number }[] = [];
  for (const [u, v, k] of [[1.2, 0.95, 'fishB'], [2.6, -1.0, 'fishR'], [2.0, 1.1, 'row'], [3.4, 1.0, 'fishB']] as [number, number, string][]) {
    if (mini && u > 2) continue;
    const [x, z] = pu(u, v);
    if (costaH(x, z) > -0.05) continue;
    moored.push({ it: S.put(k, x, 0.0, z, -th + (r() - 0.5) * 0.25, 1.15), ph: r() * 6 });
  }
  // barcos arrastados na areia, redes e varais
  const beach = scatter(r, 6, -0.3, 2.8, 2.6, (x, z) => ins(x, z, 0.7) && costaH(x, z) > 0.12 && costaH(x, z) < 0.35 && distPoly(x, z, PATH) > 0.5 && Math.hypot(x - px, z - pz) > 0.8, 1.0, 40);
  beach.forEach(([x, z], i) => {
    if (mini && i > 1) return;
    if (i < 2) S.put(i ? 'row' : 'fishR', x, costaH(x, z) + 0.05, z, -th + 1.57 + (r() - 0.5) * 0.4, 1.15);
    else if (!mini) S.put(i % 2 ? 'netrack' : 'fishrack', x, costaH(x, z), z, -th + (r() - 0.5) * 0.5 + 0.2, i % 2 ? 1.0 : 0.9);
  });
  if (!mini) {
    for (const [x, z] of scatter(r, 5, -1.0, 2.0, 1.6, (x, z) => costaH(x, z) > 0.3 && coastC(x, z) < -0.9 && distPoly(x, z, PATH) > 0.4, 0.8, 30)) S.put(r() < 0.5 ? 'netrack' : 'barrel', x, costaH(x, z), z, r() * 6, 1.0);
  }
  if (mini) return isl;

  // ---- veleiro que sai e volta; gaivotas; feixe do farol ----
  const sail = S.put('sail', 0, 0, 0, 0, 1.4);
  const sailRoute = curve([[3.4, 3.0], [4.9, 2.6], [6.0, 3.6], [5.3, 5.1], [3.7, 5.2], [3.0, 4.0], [3.4, 3.0]], 8);
  const lens: number[] = [0];
  for (let i = 1; i < sailRoute.length; i++) lens.push(lens[i - 1] + Math.hypot(sailRoute[i][0] - sailRoute[i - 1][0], sailRoute[i][1] - sailRoute[i - 1][1]));
  const gulls = Array.from({ length: 7 }, (_, i) => ({ a: S.put('gullA', 0, 3, 0, 0, 1.3), b: S.put('gullB', 0, 3, 0, 0, 1.3), c: i < 4 ? [lx, lz] as V2 : [2.4, 2.8] as V2, rad: 1.2 + r() * 2.3, h: 2.2 + r() * 2.4, w: (0.25 + r() * 0.25) * (i % 2 ? 1 : -1), ph: r() * 6 }));
  for (const [x, z, y] of [[...pu(0.8, 0.28), 0.48], [...pu(2.0, 0.28), 0.48], [...pu(3.2, 0.28), 0.48], [lx + 0.2, lz + 0.4, lensY - 0.12]] as [number, number, number][]) S.put('gull', x, y, z, r() * 6, 1.3);
  const beam = S.put('beam', lx, lensY, lz, 0, 1);
  const walkers = S.pools.get('fishB');
  void walkers;
  S.anims.push((e: Env) => {
    const t = e.t;
    for (const m of moored) { m.it.y = Math.sin(t * 1.2 + m.ph) * 0.012; m.it.rz = Math.sin(t * 0.9 + m.ph) * 0.03; }
    for (const k of ['fishB', 'fishR', 'row']) S.pools.get(k)!.dirty = true;
    const total = lens[lens.length - 1], s = (t * 0.35) % total;
    let k = 1; while (k < lens.length - 1 && lens[k] < s) k++;
    const f = (s - lens[k - 1]) / (lens[k] - lens[k - 1] || 1);
    const a = sailRoute[k - 1], b = sailRoute[k];
    sail.x = a[0] + (b[0] - a[0]) * f; sail.z = a[1] + (b[1] - a[1]) * f; sail.y = Math.sin(t * 1.3) * 0.012;
    sail.yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); sail.rx = Math.sin(t * 1.0) * 0.04;
    S.pools.get('sail')!.dirty = true;
    for (const g of gulls) {
      const an = t * g.w + g.ph, x = g.c[0] + Math.cos(an) * g.rad, z = g.c[1] + Math.sin(an) * g.rad * 0.8, y = g.h + Math.sin(an * 2.3) * 0.25;
      const flap = Math.sin(t * 5 + g.ph * 3) > 0;
      const sgn = Math.sign(g.w);
      const yaw = Math.atan2(-Math.cos(an) * 0.8 * sgn, -Math.sin(an) * sgn);
      for (const [it, on] of [[g.a, flap], [g.b, !flap]] as const) { it.x = x; it.y = y; it.z = z; it.yaw = yaw; it.rx = Math.cos(an) * 0.2 * sgn; it.vis = on ? 1 : 0; }
    }
    S.pools.get('gullA')!.dirty = S.pools.get('gullB')!.dirty = true;
    beam.yaw = t * 0.9;
    S.pools.get('beam')!.dirty = true;
    MATS.beam.opacity = 0.55 * smooth(0.1, 0.7, e.night);
  });
  return isl;
}
