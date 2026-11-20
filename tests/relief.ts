// Níveis de altura (src/core/relief.ts): determinismo, vizinhos a no máximo 1 degrau, origem no 0,
// distribuição e platôs (sem casas soltas). Só aparência: nada disto entra no replay.
import { DIRS, hexDistance } from '../src/core/hex';
import { levelAt, tileProfile } from '../src/core/relief';
import { generateEdges, isStrict, T } from '../src/core/tiles';
import { mulberry32 } from '../src/core/rng';

let failed = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failed++;
    console.error('FALHOU:', msg);
  }
};

const SEEDS = [1, 7, 42, 99, 12345, 20261023, 0x9e3779b9, 4000000000, 3, 8675309, 31, 2026];
const R = 50;
let total0 = 0, totalAll = 0, lonely = 0, steep = 0, cells = 0;
const dump = process.argv.includes('--dump');
for (const max of [1, 2]) {
  for (const seed of SEEDS) {
    const lv = new Map<number, number>();
    const at = (q: number, r: number) => {
      const k = q * 100003 + r;
      let v = lv.get(k);
      if (v === undefined) lv.set(k, (v = levelAt(seed, q, r, max)));
      return v;
    };
    const n = [0, 0, 0];
    for (let q = -R; q <= R; q++) {
      for (let r = -R; r <= R; r++) {
        if (hexDistance(q, r, 0, 0) > R) continue;
        const l = at(q, r);
        check(l === levelAt(seed, q, r, max), `determinismo ${seed} ${q},${r}`);
        check(l >= 0 && l <= max, `faixa ${l} (máx ${max})`);
        n[l]++;
        cells++;
        let same = 0;
        for (const [dq, dr] of DIRS) {
          const m = at(q + dq, r + dr);
          if (Math.abs(m - l) > 1) steep++;
          if (m === l) same++;
        }
        if (same === 0 && hexDistance(q, r, 0, 0) < R) lonely++;
      }
    }
    check(at(0, 0) === 0, 'origem');
    for (const [dq, dr] of DIRS) check(at(dq, dr) === 0, 'vizinho da origem');
    const tot = n[0] + n[1] + n[2];
    total0 += n[0];
    totalAll += tot;
    if (dump) console.log(`máx ${max} semente ${seed}: ${n.map((x) => ((100 * x) / tot).toFixed(1)).join('% / ')}%`);
    if (max === 2) check(n[2] > 0, `a semente ${seed} nunca chega ao nível 2`);
    check(n[0] / tot > 0.4 && n[0] / tot < 0.85, `nível 0 fora de 40-85% na semente ${seed}: ${(n[0] / tot).toFixed(2)}`);
  }
}
const mean0 = total0 / totalAll;
check(mean0 > 0.55 && mean0 < 0.75, `nível 0 médio fora de 55-75%: ${mean0.toFixed(3)}`);
check(steep === 0, `${steep} pares de vizinhos com diferença maior que 1`);
check(lonely / cells < 0.002, `casas soltas demais: ${lonely} de ${cells}`);
check(levelAt(7, 5, 5, 0) === 0, 'maxLevel 0 é plano');
console.log(`relief: ${cells} casas, nível 0 em ${(mean0 * 100).toFixed(1)}%, ${lonely} soltas, ${steep} degraus duplos`);
// Perfis por peça (modo Relevo): determinismo, faixa 0 a 2, setores vizinhos a no máximo 1 degrau, rio/trilho planos.
{
  const rng = mulberry32(99);
  const shapes: Record<string, number> = {};
  const levels = [0, 0, 0];
  let n = 0, strictTiles = 0;
  for (let i = 0; i < 20000; i++) {
    const edges = generateEdges(rng, 0.17, 0.09);
    const seed = Math.floor(rng() * 2 ** 31);
    const a = tileProfile(edges, seed), b = tileProfile(edges, seed);
    check(JSON.stringify(a) === JSON.stringify(b), 'perfil não determinístico');
    n++;
    shapes[a.shape] = (shapes[a.shape] ?? 0) + 1;
    check(a.h.length === 6 && a.h.every((v) => Number.isInteger(v) && v >= 0 && v <= 2) && a.c >= Math.max(...a.h) && a.c <= 2, `perfil fora da faixa ${JSON.stringify(a)}`);
    for (let k = 0; k < 6; k++) check(Math.abs(a.h[k] - a.h[(k + 1) % 6]) <= 1, `setores vizinhos com mais de 1 degrau ${JSON.stringify(a)}`);
    if (edges.some(isStrict)) {
      strictTiles++;
      check(a.h.every((v) => v === a.h[0]) && a.c === a.h[0], 'peça com rio ou trilho não é plana');
      if (edges.includes(T.Rail)) check(a.h[0] === 1, 'trilho fora do nível 1');
    }
    levels[Math.min(...a.h)]++;
  }
  check(Object.keys(shapes).length === 9, `faltam formas: ${Object.keys(shapes)}`);
  console.log(`perfis: ${n} peças, ${strictTiles} com rio/trilho, formas ${JSON.stringify(shapes)}, base 0/1/2: ${levels.join('/')}`);
}
if (failed) {
  console.error(`${failed} falha(s)`);
  process.exit(1);
}
