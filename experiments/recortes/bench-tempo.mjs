// Tempo de cálculo da lista de poses por jogada, um processo só, numa máquina o mais quieta possível.
//   node bench-tempo.mjs [jogos por linha]
import { playGame } from './sim.mjs';

const games = +(process.argv[2] ?? 10);
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
console.log('| família | P | jogos | ms/jogada (média) | p95 | máx | candidatos/jogada | testes de sobreposição/jogada |');
console.log('|---|---|---|---|---|---|---|---|');
for (const fam of ['i30', 'i15', 'ii'])
  for (const P of [24, 48, 64]) {
    const ms = [], cand = [], ovl = [];
    const n = fam === 'ii' ? Math.max(3, Math.round(games / 2)) : games;
    for (let g = 0; g < n; g++) {
      const r = playGame({ fam, seed: 3000 + g, player: 'greedy', pieces: 40, P, forgive: 'discard', checkpoints: [] });
      ms.push(...r.ms);
      cand.push(...r.cand);
      ovl.push(...r.ovl);
    }
    const m = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    console.log(`| ${fam} | ${P} | ${n} | ${m(ms).toFixed(1)} | ${pct(ms, 95).toFixed(1)} | ${Math.max(...ms).toFixed(0)} | ${m(cand).toFixed(0)} | ${m(ovl).toFixed(0)} |`);
  }
