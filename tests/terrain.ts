// Campo de altura contínuo da peça (src/render/terrain.ts): a emenda entre duas peças vizinhas que concordam no perfil da
// borda casa ponto a ponto (sem fresta), a peça plana continua plana e a inclinação é limitada (sem agulhas nem degraus).
import { corner, DIRS, edgeMid, hexToWorld, INR, opposite } from '../src/core/hex';
import { mulberry32 } from '../src/core/rng';
import { T } from '../src/core/tiles';
import { buildTile, LEVEL_STEP, WATER_Y } from '../src/render/tileBuilder';
import { THEMES } from '../src/themes/themes';
import { edgeProfile, isFlat, makeTerrain, nearestOnEdge, SKIRT_MAX, skirtDrop, skirtEnd, skirtWidth, swellAt, type TerrainSpec } from '../src/render/terrain';

let failed = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failed++;
    console.error('FALHA: ' + msg);
  }
};

const rng = mulberry32(2026);
const randSpec = (seed: number): TerrainSpec => {
  const h = Array.from({ length: 6 }, () => Math.floor(rng() * 3));
  for (let k = 1; k < 6; k++) h[k] = Math.max(0, Math.min(2, h[k - 1] + Math.floor(rng() * 3) - 1));
  return { h, c: h.reduce((p, v) => p + v, 0) / 6, he: h.slice(), co: h.map((v, k) => (h[(k + 5) % 6] + v) / 2), vil: h.map(() => (rng() < 0.3 ? 1 : 0)), seed };
};

let worst = 0, steepest = 0, n = 0;
for (let t = 0; t < 400; t++) {
  const a = randSpec(t + 1);
  const w = Math.floor(rng() * 6), o = (w + 3) % 6;
  // A vizinha adota o perfil da borda `w` de A (meio e os dois cantos, na ordem invertida) e tem outro alvo no interior.
  const b = randSpec(1000 + t);
  const he = b.he.slice(), co = b.co.slice();
  he[o] = a.he[w];
  co[(o + 1) % 6] = a.co[w];
  co[o] = a.co[(w + 1) % 6];
  const ta = makeTerrain(a), tb = makeTerrain({ ...b, he, co });
  // A borda `w` de A vai do canto w ao w+1; a borda `o` de B, do canto o ao o+1, andando ao contrário (o canto o+1 de B é o canto w de A).
  const [ax, az] = corner(w), [bx, bz] = corner((w + 1) % 6);
  const [cx, cz] = corner(o), [dx, dz] = corner((o + 1) % 6);
  for (let i = 0; i <= 20; i++) {
    const s = i / 20;
    const pa = ta.at(ax + (bx - ax) * s, az + (bz - az) * s);
    const pb = tb.at(dx + (cx - dx) * s, dz + (cz - dz) * s);
    worst = Math.max(worst, Math.abs(pa - pb));
    n++;
  }
  for (let i = 0; i < 40; i++) {
    const x = (rng() - 0.5) * 1.8, z = (rng() - 0.5) * 1.6;
    steepest = Math.max(steepest, ta.slope(x, z));
  }
}
check(worst < 0.01, `emenda com fresta: ${worst} níveis (0,003 do mundo é o limite: só perto dos cantos)`);
check(steepest < 6, `inclinação demais: ${steepest} níveis por unidade`);

// Saia e ondulado do mundo: a peça B vizinha (que veio depois) adota o perfil da borda de A, e o chão dela nunca passa abaixo da
// saia de A; o ondulado é o mesmo valor dos dois lados da divisa (a emenda continua casando com ele ligado).
{
  const rg = mulberry32(77);
  let worstSeam = 0, worstEnv = Infinity, hits = 0;
  for (let t = 0; t < 300; t++) {
    const w = Math.floor(rg() * 6), o = (w + 3) % 6;
    const [aq, ar] = [0, 0], [bq, br] = [aq + DIRS[w][0], ar + DIRS[w][1]];
    const wa = hexToWorld(aq, ar), wb = hexToWorld(bq, br);
    const ownA = Math.floor(rg() * 3);
    const hA = [ownA, 0, 0, 0, 0, 0];
    for (let k = 1; k < 6; k++) hA[k] = Math.max(0, Math.min(2, hA[k - 1] + Math.floor(rg() * 3) - 1));
    const A: TerrainSpec = { h: hA, c: ownA, he: hA.slice(), co: hA.map((v, k) => (hA[(k + 5) % 6] + v) / 2), vil: [0, 0, 0, 0, 0, 0], seed: t, own: 0, world: { x: wa.x, z: wa.z, rot: 0, seed: 99 } };
    const hB = [Math.floor(rg() * 3), 0, 0, 0, 0, 0];
    for (let k = 1; k < 6; k++) hB[k] = Math.max(0, Math.min(2, hB[k - 1] + Math.floor(rg() * 3) - 1));
    const he = hB.slice(), co = hB.map((v, k) => (hB[(k + 5) % 6] + v) / 2);
    he[o] = A.he[w];
    co[(o + 1) % 6] = A.co[w];
    co[o] = A.co[(w + 1) % 6];
    const env = [0, 1, 2, 3, 4, 5].map((k) => k === o);
    const B: TerrainSpec = { h: hB, c: 0, he, co, vil: [0, 0, 0, 0, 0, 0], seed: t + 5, own: 0, env, world: { x: wb.x, z: wb.z, rot: 0, seed: 99 } };
    const ta = makeTerrain(A), tb = makeTerrain(B);
    // Emenda com o ondulado ligado: o mesmo ponto do mundo, lido pelas duas peças.
    const [ax, az] = corner(w), [bx, bz] = corner((w + 1) % 6);
    for (let i = 0; i <= 12; i++) {
      const s0 = i / 12;
      const px = wa.x + ax + (bx - ax) * s0, pz = wa.z + az + (bz - az) * s0;
      worstSeam = Math.max(worstSeam, Math.abs(ta.at(px - wa.x, pz - wa.z) - tb.at(px - wb.x, pz - wb.z)));
    }
    // Saia de A dentro de B: o chão de B fica sempre no mínimo na altura dela.
    for (let i = 0; i < 40; i++) {
      const lx = (rg() - 0.5) * 1.9, lz = (rg() - 0.5) * 1.7;
      const [omx, omz] = edgeMid(o);
      const dB = INR - (lx * omx + lz * omz) / INR;
      if (dB < 0 || dB > 0.95) continue;
      const px = wb.x + lx, pz = wb.z + lz;
      const { t: tq, rho } = nearestOnEdge(w, px - wa.x, pz - wa.z);
      const hb = edgeProfile(A, w, tq);
      const [qx, qz] = [ax + (bx - ax) * tq, az + (bz - az) * tq];
      const hbs = hb + swellAt(99, wa.x + qx, wa.z + qz);
      const skirt = hbs - skirtDrop(hbs, rho);
      worstEnv = Math.min(worstEnv, tb.at(lx, lz) - skirt);
      hits++;
    }
  }
  check(worstSeam < 0.01, `emenda com o ondulado: ${worstSeam} níveis`);
  check(worstEnv > -1e-6, `a saia da vizinha passa acima do chão novo: ${worstEnv} níveis`);
  check(hits > 500, `poucos pontos de saia conferidos: ${hits}`);
  // A curva da saia: começa na borda, termina em hb + skirtEnd(hb) na largura dela e nunca desce.
  for (const hb of [-0.1, 0, 0.5, 1, 1.5, 2, 2.9]) {
    const w = skirtWidth(hb);
    check(skirtDrop(hb, 0) === 0 && Math.abs(skirtDrop(hb, w + 0.01) - (hb + skirtEnd(hb))) < 1e-9, `saia ${hb}: extremos`);
    let prev = 0, ok = true;
    for (let i = 1; i <= 50; i++) {
      const d = skirtDrop(hb, (i / 50) * (w + 0.1));
      if (d < prev - 1e-12) ok = false;
      prev = d;
    }
    check(ok, `saia ${hb}: não monótona`);
    check(w <= SKIRT_MAX, `saia ${hb}: larga demais (${w})`);
    // O pé não passa do fundo da peça (0,28) e a encosta nunca é íngreme demais (inclinação no mundo, até ~50°).
    check(hb - skirtDrop(hb, w) >= -0.28 / 0.3 - 1e-9, `saia ${hb}: o pé passa do fundo da peça`);
    let steep = 0;
    for (let i = 0; i < 200; i++) steep = Math.max(steep, ((skirtDrop(hb, ((i + 1) / 200) * w) - skirtDrop(hb, (i / 200) * w)) * 0.3) / (w / 200));
    check(steep < 1.2, `saia ${hb}: íngreme demais (${steep.toFixed(2)})`);
  }
  console.log(`saia: ${hits} pontos conferidos, pior emenda com o ondulado ${worstSeam.toExponential(1)}, folga mínima da saia ${worstEnv.toExponential(1)} níveis`);
}
// Água e chão: o ondulado do mundo não afunda a margem nem o campo abaixo da linha d'água (uma poça solta, ou a água por cima das
// casas), e a decoração fica fora da água. Peças com rio e lago em todos os níveis, com o ondulado ligado.
{
  const holanda = THEMES.find((t) => t.id === 'holanda')!;
  const W = T.Water, G = T.Grass, V = T.Village, F = T.Forest, P = T.Field;
  const sets = [[W, V, V, W, G, G], [W, W, W, G, G, G], [W, V, F, W, V, P], [V, W, W, V, V, W], [W, W, W, W, W, G], [W, G, V, V, G, W]];
  let n = 0, inWater = 0, puddle = 0;
  for (const edges of sets) for (let seed = 1; seed <= 12; seed++) for (const own of [0, 1, 2]) {
    const z6 = [0, 0, 0, 0, 0, 0];
    const b = buildTile(edges, seed * 7919, holanda, { detail: 0.6, houses: [], levels: { own, nb: [own, own, own, own, own, own], sec: z6, placed: [false, false, false, false, false, false], terrain: { h: z6, c: 0, he: z6, co: z6, world: { x: seed, z: own * 3, rot: 0, seed: 5 } } } });
    const wet = (x: number, z: number) => {
      for (let i = 0; i < b.water.length; i += 9) {
        const [ax, az, bx, bz, cx, cz] = [b.water[i], b.water[i + 2], b.water[i + 3], b.water[i + 5], b.water[i + 6], b.water[i + 8]];
        const d = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
        if (Math.abs(d) < 1e-9) continue;
        const u = ((x - ax) * (cz - az) - (cx - ax) * (z - az)) / d, v = ((bx - ax) * (z - az) - (x - ax) * (bz - az)) / d;
        if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
        const j = i / 3;
        if (b.wbed[j * 4 + 3] * (1 - u - v) + b.wbed[(j + 1) * 4 + 3] * u + b.wbed[(j + 2) * 4 + 3] * v > 0.003) return true;
      }
      return false;
    };
    for (const d of b.decos) {
      if (/^(lily|reed|moored|fish|wheel|fauna|dock|pier|boat|bridge)/.test(d.key) || d.transient) continue;
      n++;
      if (wet(d.x, d.z)) inWater++;
    }
    // Chão abaixo da linha d'água sem água por cima: poça solta (a lateral e a saia ficam de fora: y < -0,2 ou fora do tampo).
    for (let i = 1; i < b.pos.length; i += 3) if (b.pos[i] > -0.2 && b.pos[i] < WATER_Y - 0.006 && Math.hypot(b.pos[i - 1], b.pos[i + 1]) < 0.85 && !wet(b.pos[i - 1], b.pos[i + 1])) puddle++;
  }
  check(inWater <= n * 0.001, `decoração dentro da água com o relevo ondulado: ${inWater} de ${n}`);
  check(puddle === 0, `chão abaixo da linha d'água sem água por cima: ${puddle} vértices`);
  console.log(`água: ${n} decorações conferidas, ${inWater} na água`);
}

// Fresta entre saias: peças vizinhas (de 3 a 5 das 7 casas em volta do Centro, em ordem sorteada, com rio e trilho) e a casa vazia ao lado
// delas: toda a faixa de 0,2 em volta de cada peça tem chão (visto de cima), em qualquer ordem de colocação.
{
  const rgap = mulberry32(99);
  const theme = THEMES.find((t) => t.id === 'holanda')!;
  const G = T.Grass;
interface P { q: number; r: number; hw: number[]; edges: T[]; he: number[]; co: number[]; own: number }
const placed = new Map<string, P>();
const key = (q: number, r: number) => q + ',' + r;
function seam(q: number, r: number, hw: number[], ew: T[]) {
  const he = hw.slice(), co = hw.map((v, k) => (hw[(k + 5) % 6] + v) / 2);
  for (let w = 0; w < 6; w++) {
    if (ew[w] === T.Water || ew[w] === T.Rail) continue;
    const n = placed.get(key(q + DIRS[w][0], r + DIRS[w][1]));
    if (!n) continue;
    const o = opposite(w);
    he[w] = n.he[o];
    co[w] = n.co[(o + 1) % 6];
    co[(w + 1) % 6] = n.co[o];
  }
  return { he, co };
}
function put(q: number, r: number, hw: number[], edges: T[], seed: number) {
  const own = Math.min(...hw);
  const { he, co } = seam(q, r, hw, edges);
  const ct = hw.reduce((p, v) => p + v, 0) / 6;
  const pl = [0, 1, 2, 3, 4, 5].map((w) => !!placed.get(key(q + DIRS[w][0], r + DIRS[w][1])));
  const loc = (a: number[]) => a.map((v) => v - own);
  const { x, z } = hexToWorld(q, r);
  const b = buildTile(edges, seed, theme, { detail: 0.3, houses: [], levels: { own, nb: hw.map((v, w) => (pl[w] ? placed.get(key(q + DIRS[w][0], r + DIRS[w][1]))!.hw[opposite(w)] : v)), sec: loc(hw), placed: pl, terrain: { h: loc(hw), c: ct - own, he: loc(he), co: loc(co), world: { x, z, rot: 0, seed: 1234 } } } });
  placed.set(key(q, r), { q, r, hw, edges, he, co, own });
  return { b, x, z, oy: own * LEVEL_STEP };
}
const rh = () => {
  const h = [Math.floor(rgap() * 3), 0, 0, 0, 0, 0];
  for (let k = 1; k < 6; k++) h[k] = Math.max(0, Math.min(2, h[k - 1] + Math.floor(rgap() * 3) - 1));
  return h;
};
const RES = 0.03;
const TYPES = [T.Grass, T.Grass, T.Forest, T.Village, T.Field, T.Water, T.Rail];
const pairType = (q1: number, r1: number, q2: number, r2: number, salt: number) => {
  const [a, b] = q1 < q2 || (q1 === q2 && r1 < r2) ? [[q1, r1], [q2, r2]] : [[q2, r2], [q1, r1]];
  let h = Math.imul(a[0] * 31 + a[1] * 17 + b[0] * 131 + b[1] * 71 + 1000, 2654435761) ^ salt;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return TYPES[((h ^ (h >>> 13)) >>> 0) % TYPES.length];
};
let holes = 0, tests = 0, worst = 0;
const N = 40;
const cells: [number, number][] = [[0, 0], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const inHexAt = (px: number, pz: number, q: number, r: number) => {
  const c = hexToWorld(q, r), x = Math.abs(px - c.x), z = Math.abs(pz - c.z);
  return Math.max(z, x * 0.8660254 + z * 0.5) - 0.8660254;
};
for (let t = 0; t < N; t++) {
  placed.clear();
  const k = 3 + Math.floor(rgap() * 3);
  const pool = cells.slice();
  const pick: [number, number][] = [];
  while (pick.length < k) pick.push(pool.splice(Math.floor(rgap() * pool.length), 1)[0]);
  const out: { b: ReturnType<typeof put>['b']; x: number; z: number; oy: number }[] = [];
  for (const [q, r] of pick) {
    const hw = rh();
    const edges = DIRS.map(([dq, dr]) => pairType(q, r, q + dq, r + dr, t)) as T[];
    // peça de água/trilho: plana no nível dela
    const strict = edges.some((e) => e === T.Water || e === T.Rail);
    const hh = strict ? hw.map(() => 1) : hw;
    out.push(put(q, r, hh, edges, 100 + t * 13 + q * 7 + r));
  }
  const S = 7, n = Math.round(S / RES), c0 = hexToWorld(0, 0);
  const hm = new Float32Array(n * n).fill(-9);
  for (const o of out) {
    const p = o.b.pos;
    for (let i = 0; i < p.length; i += 9) {
      const X = [p[i] + o.x, p[i + 3] + o.x, p[i + 6] + o.x], Z = [p[i + 2] + o.z, p[i + 5] + o.z, p[i + 8] + o.z], Y = [p[i + 1] + o.oy, p[i + 4] + o.oy, p[i + 7] + o.oy];
      const gx0 = Math.max(0, Math.floor((Math.min(...X) - c0.x + S / 2) / RES)), gx1 = Math.min(n - 1, Math.ceil((Math.max(...X) - c0.x + S / 2) / RES));
      const gz0 = Math.max(0, Math.floor((Math.min(...Z) - c0.z + S / 2) / RES)), gz1 = Math.min(n - 1, Math.ceil((Math.max(...Z) - c0.z + S / 2) / RES));
      const d = (X[1] - X[0]) * (Z[2] - Z[0]) - (X[2] - X[0]) * (Z[1] - Z[0]);
      if (Math.abs(d) < 1e-12) continue;
      for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
        const px = c0.x - S / 2 + (gx + 0.5) * RES, pz = c0.z - S / 2 + (gz + 0.5) * RES;
        const u = ((px - X[0]) * (Z[2] - Z[0]) - (X[2] - X[0]) * (pz - Z[0])) / d, v = ((X[1] - X[0]) * (pz - Z[0]) - (px - X[0]) * (Z[1] - Z[0])) / d;
        if (u < -0.02 || v < -0.02 || u + v > 1.02) continue;
        hm[gx * n + gz] = Math.max(hm[gx * n + gz], Y[0] + (Y[1] - Y[0]) * u + (Y[2] - Y[0]) * v);
      }
    }
  }
  let bad = 0;
  for (let gx = 0; gx < n; gx++) for (let gz = 0; gz < n; gz++) {
    const px = c0.x - S / 2 + (gx + 0.5) * RES, pz = c0.z - S / 2 + (gz + 0.5) * RES;
    // célula do ponto: a que o contém; vazia e perto de uma peça (menos de 0.2 do hexágono dela)
    let inTile = false, dmin = 9;
    for (const [q, r] of pick) { const d = inHexAt(px, pz, q, r); if (d <= 0) inTile = true; dmin = Math.min(dmin, d); }
    if (inTile) continue;
    tests++;
    if (dmin < 0.2 && hm[gx * n + gz] < -8) bad++;
  }
  holes += bad;
  worst = Math.max(worst, bad);
}
check(holes === 0, `fresta entre saias e vizinhas: ${holes} pontos sem chão (pior caso ${worst})`);
  console.log(`emenda: ${tests} pontos de casa vazia conferidos, ${holes} sem chão`);
}

const flat: TerrainSpec = { h: [1, 1, 1, 1, 1, 1], c: 1, he: [1, 1, 1, 1, 1, 1], co: [1, 1, 1, 1, 1, 1], vil: [0, 0, 0, 0, 0, 0], seed: 5 };
check(isFlat(flat), 'peça plana não é plana');
check(!isFlat({ ...flat, he: [2, 1, 1, 1, 1, 1] }), 'perfil de emenda diferente conta como relevo');
const spec: TerrainSpec = { ...flat, h: [1, 1, 0, 0, 1, 1], c: 0.67, he: [1, 1, 0, 0, 1, 1], co: [1, 1, 0.5, 0, 0.5, 1], seed: 9 };
check(makeTerrain(spec).at(0.3, -0.2) === makeTerrain(spec).at(0.3, -0.2), 'campo não determinístico');
console.log(`terreno: ${n} pontos de emenda, pior fresta ${worst.toExponential(1)}, maior inclinação ${steepest.toFixed(2)} níveis/unidade`);
if (failed) {
  console.error(`${failed} falha(s)`);
  process.exit(1);
}
