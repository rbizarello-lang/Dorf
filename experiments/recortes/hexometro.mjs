// "Hexômetro" da costa (critério do plano Terra Contínua): o quanto as direções da costa do mapa
// concentram em múltiplos de 60°, ou seja, o quanto o contorno ainda lê como hexágono.
//   m6 = |soma(w * e^(i*6*teta))| / soma(w), com w = comprimento exposto de cada trecho de costa.
// Hexágonos de hoje: 1,00 (toda a costa está em 0°, 60° ou 120°). Direções sem preferência: ~0.
//   node hexometro.mjs [jogos por família]
import { playGame } from './sim.mjs';

const games = +(process.argv[2] ?? 40);
function m6(world) {
  let re = 0, im = 0, tot = 0, m12r = 0, m12i = 0;
  for (const pc of world.pieces)
    for (const e of pc.edges) {
      const w = e.expLen;
      if (w < 1) continue;
      const t = Math.atan2(e.by - e.ay, e.bx - e.ax);
      re += w * Math.cos(6 * t);
      im += w * Math.sin(6 * t);
      m12r += w * Math.cos(12 * t);
      m12i += w * Math.sin(12 * t);
      tot += w;
    }
  return { m6: Math.hypot(re, im) / tot, m12: Math.hypot(m12r, m12i) / tot };
}
console.log('| família | jogos | hexômetro m6 (1,00 = hexágono) | m12 (30°) |');
console.log('|---|---|---|---|');
console.log('| Clássico (hexágonos) | - | 1.00 | 1.00 |');
for (const fam of ['i30', 'i15', 'ii']) {
  const n = fam === 'ii' ? Math.max(10, Math.round(games / 3)) : games;
  let a = 0, b = 0;
  for (let g = 0; g < n; g++) {
    const r = playGame({ fam, seed: 1000 + g, player: 'greedy', pieces: 40, keep: true, forgive: 'discard', checkpoints: [] });
    const m = m6(r.world);
    a += m.m6;
    b += m.m12;
  }
  console.log(`| ${fam} | ${n} | ${(a / n).toFixed(2)} | ${(b / n).toFixed(2)} |`);
}
