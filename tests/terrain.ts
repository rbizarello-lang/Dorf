// Campo de altura contínuo da peça (src/render/terrain.ts): a emenda entre duas peças vizinhas que concordam no perfil da
// borda casa ponto a ponto (sem fresta), a peça plana continua plana e a inclinação é limitada (sem agulhas nem degraus).
import { corner, DIRS, edgeMid, hexToWorld, INR } from '../src/core/hex';
import { mulberry32 } from '../src/core/rng';
import { T } from '../src/core/tiles';
import { buildTile, WATER_Y } from '../src/render/tileBuilder';
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
