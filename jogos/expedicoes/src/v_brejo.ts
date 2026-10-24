// Posto no brejo: palafitas, passarelas de madeira sobre a água, juncos, garças, barquinhos chatos, névoa baixa e lanternas.
import * as THREE from 'three';
import type { Stage, Env } from './stage';
import { Island } from './island';
import { boardwalk, walk } from './structs';
import { curve, distPoly, fbm, hex, meshAt, mount, mulberry32, scatter, smooth, type V2 } from './common';
import { mistTexture } from './tex';

export const BREJO = { R: 7.3, WL: 0.1 };
const LAGOON = { x: 0.3, z: 0.2 };
const lagoonR = (th: number): number => 2.9 + 0.5 * Math.sin(3 * th + 1) + 0.35 * Math.sin(5 * th + 2) + 0.2 * Math.sin(2 * th);
const CH: V2[][] = [
  curve([[-8.5, -2.8], [-6.4, -2.6], [-4.6, -1.7], [-3.0, -0.4]]),
  curve([[7.6, 5.8], [5.5, 4.6], [3.9, 3.0], [2.6, 1.8]]),
  curve([[2.4, -8.5], [2.0, -6.2], [1.3, -4.2], [0.9, -2.4]]),
  curve([[-1.5, 8.2], [-2.6, 5.9], [-1.6, 3.8], [-0.8, 2.4]]),
];
function sdf(x: number, z: number): number {
  const dx = x - LAGOON.x, dz = z - LAGOON.z;
  let d = Math.hypot(dx, dz) - lagoonR(Math.atan2(dz, dx));
  for (let i = 0; i < CH.length; i++) d = Math.min(d, distPoly(x, z, CH[i]) - (0.42 + 0.15 * Math.sin(x * 1.3 + i)));
  // lagoas pequenas
  d = Math.min(d, Math.hypot(x + 4.7, z - 3.6) - 1.0, Math.hypot(x - 5.0, z + 3.3) - 0.9);
  return d + (fbm(x * 0.5 + 9, z * 0.5, 3) - 0.5) * 0.5;
}
export function brejoH(x: number, z: number): number {
  const d = sdf(x, z);
  const depth = smooth(0.35, -0.55, d);
  const hump = fbm(x * 0.4, z * 0.4, 5);
  return 0.46 + 0.14 * hump - depth * 1.0 - (1 - smooth(0.6, 0.0, Math.abs(d))) * 0;
}

const MUD = hex(0x4a4430), MOSS = hex(0x667c3e), MOSS2 = hex(0x4f6a3a), BANK = hex(0x8a8a4c), PEAT = hex(0x3e3626), SILT = hex(0x6b6244);

export function buildBrejo(S: Stage, mini: boolean): Island {
  const r = mulberry32(21);
  const isl = new Island({
    R: BREJO.R, seed: 3, base: -2.0, wobble: 1.1, nr: mini ? 30 : 64, ns: mini ? 90 : 200,
    h: brejoH,
    color: (x, z, h, _s, out) => {
      const n = fbm(x * 1.1, z * 1.1, 8);
      if (h < BREJO.WL - 0.05) { out.copy(MUD).lerp(PEAT, smooth(0.0, -0.6, h)); return; }
      const w = smooth(0.46, 0.14, h);
      out.copy(MOSS).lerp(MOSS2, n);
      out.lerp(BANK, smooth(0.62, 0.8, n) * 0.6);
      out.lerp(SILT, w * 0.8);
      out.lerp(PEAT, smooth(0.22, 0.1, h) * 0.5);
    },
    strata: [{ color: 0x3a2d22, depth: 0.3 }, { color: 0x6b4e35, depth: 0.3 }, { color: 0x6c6a5c, depth: 0.35 }, { color: 0x4a5148, depth: 0.4 }, { color: 0x2f3a3a, depth: 9 }],
  });
  const water = isl.water({ level: BREJO.WL, deep: new THREE.Color(0x1b3a38), shallow: new THREE.Color(0x66906a), alpha: 0.86, foam: 0.12, wave: 0.006, speed: 0.5, nr: mini ? 26 : 50, ns: mini ? 80 : 150 });
  mount(S, isl, [water]);
  const inside = (x: number, z: number, m = 0.4): boolean => isl.inside(x, z) > m;
  const wet = (x: number, z: number): number => BREJO.WL - brejoH(x, z); // profundidade da água
  const deep = (x: number, z: number, m = 0.3): boolean => inside(x, z, 0.5) && wet(x, z) > m;

  // ---- casas em palafitas, em volta da lagoa ----
  const spots: [number, number, number, 'stiltA' | 'stiltB'][] = [
    [-1.7, -1.2, 0.5, 'stiltB'], [1.8, -1.5, -0.4, 'stiltA'], [2.9, 1.3, -1.4, 'stiltA'], [0.9, 2.1, 3.1, 'stiltB'], [-1.9, 1.2, 1.9, 'stiltA'], [-3.6, -1.5, 0.9, 'stiltA'],
  ];
  const houses: { x: number; z: number; yaw: number }[] = [];
  spots.forEach(([x, z, yaw, k]) => {
    if (mini && houses.length > 3) return;
    const ok = wet(x, z) > 0.25;
    if (!ok) return;
    const it = S.put(k, x, BREJO.WL, z, yaw, 1, { col: S.tone(0.94 + r() * 0.1) });
    void it;
    houses.push({ x, z, yaw });
    if (!mini) {
      // janela acesa: brilho na frente da casa
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      S.glow(x + fx * 0.5, BREJO.WL + 0.98, z + fz * 0.5, 1.15, 0xffb360, 0.2);
      const lx = x + Math.cos(yaw) * -0.5 + fx * 0.55, lz = z - Math.sin(yaw) * -0.5 + fz * 0.55;
      S.glow(lx, BREJO.WL + 0.97, lz, 0.75, 0xffc479, 0.4);
      S.smoke(x + Math.cos(yaw) * 0.22 - Math.sin(yaw) * -0.14 * 0, BREJO.WL + 1.58, z, 0.38 + r() * 0.15);
    }
  });

  // ---- passarelas: ligam as casas e a margem; lanternas nos postes ----
  const deckY = (x: number, z: number): number => {
    const h = brejoH(x, z);
    const w = smooth(0.46, 0.2, h);
    return (h + 0.13) * (1 - w) + (BREJO.WL + 0.62) * w;
  };
  const pileY = (x: number, z: number): number => brejoH(x, z) - 0.05;
  const walks: V2[][] = [
    curve([[-5.6, -2.5], [-4.5, -2.0], [-3.6, -1.5], [-2.6, -1.4], [-1.6, -1.8]], 4),
    curve([[-1.7, -1.7], [-0.6, -2.2], [0.6, -2.0], [1.7, -1.9]], 4),
    curve([[1.8, -1.9], [2.7, -0.9], [3.0, 0.2], [2.9, 0.9]], 4),
    curve([[2.9, 1.3], [2.3, 2.2], [1.4, 2.5], [0.9, 2.4]], 4),
    curve([[0.9, 2.4], [-0.2, 2.2], [-1.2, 1.8], [-1.9, 1.5]], 4),
    curve([[-1.9, 1.0], [-2.1, 0.0], [-1.9, -0.9], [-1.7, -1.6]], 4),
    curve([[4.4, 0.9], [3.8, 1.1], [3.1, 1.2]], 4),
  ];
  const wk = mini ? walks.slice(0, 3) : walks;
  wk.forEach((p, i) => meshAt(S, boardwalk(p, 0.46, deckY, pileY, { rail: i % 2 === 0, seed: 150 + i }), undefined));
  if (!mini) {
    walks.forEach((p, i) => {
      const smp = walk(p, 1.5);
      smp.forEach((q, k) => {
        if ((k + i) % 2) return;
        const nx = -Math.sin(q.a), nz = Math.cos(q.a);
        const px = q.x + nx * 0.26, pz = q.z + nz * 0.26;
        S.put('lpost', px, deckY(q.x, q.z), pz, q.a + Math.PI / 2 * 0 + (k % 2 ? 0 : Math.PI), 1);
        const ly = deckY(q.x, q.z) + 0.56;
        const side = k % 2 ? 1 : -1;
        S.glow(px + Math.cos(-q.a + (k % 2 ? 0 : Math.PI)) * 0.16 * 0 + 0.0, ly, pz, 0.8, 0xffc479, 0.6);
        void side;
      });
    });
  }

  // ---- vegetação: juncos nas margens, vitórias-régias nas águas rasas, salgueiros nas ilhotas ----
  const reeds: { it: ReturnType<Stage['put']>; ph: number }[] = [];
  const reedPts = scatter(r, mini ? 30 : 230, 0, 0, BREJO.R, (x, z) => inside(x, z, 0.2) && Math.abs(sdf(x, z) - 0.05) < 0.4 && walks.every((w) => distPoly(x, z, w) > 0.5), 0.16, 8);
  for (const [x, z] of reedPts) {
    const tall = r() < 0.4;
    const it = S.put(tall ? 'reedT' : 'reed', x, Math.max(brejoH(x, z), BREJO.WL - 0.12), z, r() * 6, 0.8 + r() * 0.6, { col: S.tone(0.85 + r() * 0.3) });
    reeds.push({ it, ph: r() * 6 });
  }
  if (!mini) {
    for (const [x, z] of scatter(r, 90, 0, 0, BREJO.R, (x, z) => deep(x, z, 0.08) && wet(x, z) < 0.6 && isl.inside(x, z) > 0.6 && walks.every((w) => distPoly(x, z, w) > 0.55) && houses.every((h) => Math.hypot(h.x - x, h.z - z) > 0.9), 0.35)) {
      S.put(r() < 0.2 ? 'lilyF' : 'lily', x, BREJO.WL + 0.01, z, r() * 6, 0.7 + r() * 0.7);
    }
    for (const [x, z] of scatter(r, 120, 0, 0, BREJO.R, (x, z) => inside(x, z, 0.3) && brejoH(x, z) > 0.3 && sdf(x, z) > 0.2, 0.3)) S.put(r() < 0.5 ? 'tuft' : 'tuftD', x, brejoH(x, z), z, r() * 6, 0.8 + r() * 0.5, { col: S.tone(0.85 + r() * 0.3) });
  }
  const trees: V2[] = [[-5.6, 4.6], [5.4, -4.2], [-2.8, -5.6], [4.2, 4.7], [-5.2, -4.6], [6.0, 1.0]];
  trees.forEach(([x, z], i) => { if (inside(x, z, 1.0) && brejoH(x, z) > 0.3 && !(mini && i > 2)) S.put(i % 4 === 3 ? 'dead' : 'willow', x, brejoH(x, z) - 0.05, z, r() * 6, 1.4 + r() * 0.6); });
  for (const [x, z] of scatter(r, mini ? 6 : 26, 0, 0, BREJO.R, (x, z) => inside(x, z, 0.6) && brejoH(x, z) > 0.34 && walks.every((w) => distPoly(x, z, w) > 0.6), 0.5)) S.put(r() < 0.3 ? 'rock' : 'shrub', x, brejoH(x, z), z, r() * 6, 0.8 + r() * 0.7, { col: S.tone(0.8 + r() * 0.3) });

  if (mini) return isl;

  // ---- garças: em pé nos baixios, duas voando ----
  const herons: V2[] = [[-4.4, 2.6], [4.4, 3.0], [-0.9, -3.6], [5.8, -1.9], [-2.2, 3.4]];
  herons.forEach(([x, z], i) => { const y = Math.max(brejoH(x, z), BREJO.WL - 0.2); S.put('heron', x, y, z, r() * 6, 0.95 + i * 0.03); });
  const fl = [S.put('heronA', 0, 3, 0, 0, 1), S.put('heronA', 0, 3, 0, 0, 0.95)];
  const flB = [S.put('heronB', 0, 3, 0, 0, 1), S.put('heronB', 0, 3, 0, 0, 0.95)];
  const birds = [0, 1, 2].map(() => ({ a: S.put('birdA', 0, 4, 0, 0, 1.2), b: S.put('birdB', 0, 4, 0, 0, 1.2), ph: r() * 6 }));

  // ---- barquinhos chatos: seguem curvas na lagoa e nos canais ----
  const routes: { pts: V2[]; sp: number; ph: number }[] = [
    { pts: curve([[-3.2, -0.2], [-2.0, 0.4], [-0.8, 0.0], [0.6, -0.6], [1.8, 0.0], [2.2, 1.2], [1.2, 1.6], [-0.4, 1.4], [-1.9, 0.9], [-3.2, -0.2]], 6), sp: 0.28, ph: 0 },
    { pts: curve([[-2.7, -1.9], [-1.0, -3.2], [0.4, -3.5], [0.8, -2.4], [-0.6, -1.8], [-2.0, -1.5], [-2.7, -1.9]], 6), sp: 0.22, ph: 2 },
    { pts: curve([[6.5, 5.1], [5.0, 4.2], [3.8, 3.0], [3.0, 2.0], [4.0, 3.2], [5.2, 4.4], [6.5, 5.1]], 6), sp: 0.2, ph: 4 },
  ];
  const boats = routes.map((rt) => { const it = S.put('flat', 0, BREJO.WL, 0, 0, 1.15); S.glow(0, 0, 0, 0.7, 0xffc479, 0.5); return { it, g: S.pools.get('glow')!.items[S.pools.get('glow')!.items.length - 1], rt }; });
  const lens: number[][] = routes.map((rt) => { const c = [0]; for (let i = 1; i < rt.pts.length; i++) c.push(c[i - 1] + Math.hypot(rt.pts[i][0] - rt.pts[i - 1][0], rt.pts[i][1] - rt.pts[i - 1][1])); return c; });

  // ---- vaga-lumes ----
  const flies = scatter(r, 26, 0, 0, 6, (x, z) => inside(x, z, 0.5), 0.2).map(([x, z]) => ({ x, z, ph: r() * 6, g: S.glow(x, 0.5, z, 0.32, 0xd8ff7a, 1) }));

  // ---- névoa baixa: três lençóis ----
  const mistTex = mistTexture(11);
  const mists: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(BREJO.R * 2.3, BREJO.R * 2.3), new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.5, color: 0xdfe8d8 }));
    m.rotation.x = -Math.PI / 2; m.position.set(S.P.x, S.P.y + 0.2 + i * 0.28, S.P.z); m.renderOrder = 3 + i;
    S.group.add(m); mists.push(m);
  }

  const glowPool = S.pools.get('glow')!;
  void glowPool;
  S.anims.push((e: Env) => {
    const t = e.t;
    for (const q of reeds) {
      const a = Math.sin(t * 1.3 + q.ph + q.it.x * 0.7) * 0.07 * (0.6 + e.wind);
      q.it.rz = a; q.it.rx = a * 0.6;
    }
    S.pools.get('reed')!.dirty = true; S.pools.get('reedT')!.dirty = true;
    // garças voando em círculo largo
    fl.forEach((it, i) => {
      const a = t * 0.22 + i * 3.1, x = Math.cos(a) * 5.0, z = Math.sin(a) * 4.2, y = 2.4 + Math.sin(a * 2 + i) * 0.3;
      const flap = Math.sin(t * 3.4 + i) > 0;
      const yaw = Math.atan2(-Math.cos(a) * 4.2, -Math.sin(a) * 5.0) + Math.PI / 2 * 0;
      const o = flap ? [it, flB[i]] : [flB[i], it];
      o[0].x = x; o[0].y = y; o[0].z = z; o[0].yaw = Math.atan2(Math.cos(a) * 4.2, -Math.sin(a) * 5.0); o[0].vis = 1;
      o[1].vis = 0;
      void yaw;
    });
    S.pools.get('heronA')!.dirty = true; S.pools.get('heronB')!.dirty = true;
    birds.forEach((b, i) => {
      const a = t * 0.5 + b.ph, x = Math.cos(a) * 3.0 + i, z = Math.sin(a) * 2.4 - i, y = 3.4 + Math.sin(a * 2) * 0.2;
      const flap = Math.sin(t * 11 + i) > 0;
      const yaw = Math.atan2(Math.cos(a) * 2.4, -Math.sin(a) * 3.0);
      for (const [it, on] of [[b.a, flap], [b.b, !flap]] as const) { it.x = x; it.y = y; it.z = z; it.yaw = yaw; it.vis = on ? 1 : 0; }
    });
    S.pools.get('birdA')!.dirty = true; S.pools.get('birdB')!.dirty = true;
    boats.forEach((b, i) => {
      const L = lens[i], total = L[L.length - 1];
      const s = ((t * b.rt.sp + b.rt.ph) % total + total) % total;
      let k = 1; while (k < L.length - 1 && L[k] < s) k++;
      const f = (s - L[k - 1]) / (L[k] - L[k - 1] || 1);
      const p0 = b.rt.pts[k - 1], p1 = b.rt.pts[k];
      const x = p0[0] + (p1[0] - p0[0]) * f, z = p0[1] + (p1[1] - p0[1]) * f;
      b.it.x = x; b.it.z = z; b.it.y = BREJO.WL + Math.sin(t * 1.4 + i) * 0.01 + 0.01;
      b.it.yaw = Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]);
      b.it.rz = Math.sin(t * 1.1 + i * 2) * 0.03;
      b.g.x = x + Math.cos(b.it.yaw) * 0.42; b.g.z = z - Math.sin(b.it.yaw) * 0.42; b.g.y = BREJO.WL + 0.38;
    });
    S.pools.get('flat')!.dirty = true;
    flies.forEach((f) => {
      f.g.x = f.x + Math.sin(t * 0.5 + f.ph) * 0.5; f.g.z = f.z + Math.cos(t * 0.43 + f.ph * 2) * 0.5; f.g.y = 0.45 + Math.sin(t * 0.9 + f.ph) * 0.15;
    });
    mists.forEach((m, i) => {
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.min(0.75, 0.42 * smooth(0, 1, 1) * (0.9 - i * 0.18) * (0.75 + 0.25 * (1 - e.night * 0.4)));
      mat.color.setRGB(0.88 - e.night * 0.5, 0.92 - e.night * 0.42, 0.85 - e.night * 0.2);
      m.rotation.z += e.dt * (0.008 + i * 0.005) * (i % 2 ? -1 : 1);
    });
  });
  return isl;
}
