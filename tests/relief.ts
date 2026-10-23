// Níveis de altura (src/core/relief.ts): determinismo, vizinhos a no máximo 1 degrau, origem no 0,
// distribuição e platôs (sem casas soltas). Só aparência: nada disto entra no replay.
import { DIRS, hexDistance } from '../src/core/hex';
import { levelAt } from '../src/core/relief';

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
if (failed) {
  console.error(`${failed} falha(s)`);
  process.exit(1);
}
