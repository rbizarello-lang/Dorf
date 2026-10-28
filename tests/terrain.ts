// Campo de altura contínuo da peça (src/render/terrain.ts): a emenda entre duas peças vizinhas que concordam no perfil da
// borda casa ponto a ponto (sem fresta), a peça plana continua plana e a inclinação é limitada (sem agulhas nem degraus).
import { corner } from '../src/core/hex';
import { mulberry32 } from '../src/core/rng';
import { isFlat, makeTerrain, type TerrainSpec } from '../src/render/terrain';

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
