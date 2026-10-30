// Lê os JSONs de resultado de uma pasta e imprime tabelas em texto (markdown).
//   node tabela.mjs <pasta> [prefixo]
import { readFileSync, readdirSync } from 'node:fs';

const dir = process.argv[2];
const prefix = process.argv[3] ?? '';
const rows = readdirSync(dir)
  .filter((f) => f.endsWith('.json') && f.startsWith(prefix))
  .sort()
  .map((f) => {
    try {
      return { f, ...JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) };
    } catch {
      return null;
    }
  })
  .filter((r) => r && r.label);

const n1 = (v) => (v == null || Number.isNaN(v) ? '-' : v.toFixed(1));
const n0 = (v) => (v == null || Number.isNaN(v) ? '-' : v.toFixed(0));
const n2 = (v) => (v == null || Number.isNaN(v) ? '-' : v.toFixed(2));

console.log('| execução | jogos | sem pose % | partidas c/ trava % | trava forte % | poses/jogada | ≤10% da melhor (poses / lugares) | gap melhor-mediana | ms/jogada (méd, p95) | nota p10-p90 | descartes | remendos |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows)
  console.log(`| ${r.label} | ${r.games} | ${n1(r.semPosePct)} | ${n0(r.partidasComTravaPct)} | ${n0(r.travaFortePct)} | ${n1(r.posesMed)} | ${n1(r.rich10)} / ${n1(r.richPlaces)} | ${n2(r.gap)} | ${n0(r.msMed)}, ${n0(r.msP95)} | ${n0(r.scoreP10)}-${n0(r.scoreP90)} | ${n1(r.discards)} | ${n1(r.patches)} |`);
console.log('');
console.log('| execução | rugosidade (perímetro / círculo) 20→fim | lagoas por partida (fim) | fendas % da terra (fim) | lagoas % da terra (fim) | rio continua % | sobreposições / não-inteiros / rio errado |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) {
  const c20 = r.check?.n20, cf = r.check?.fim;
  console.log(`| ${r.label} | ${n2(c20?.ratio)} → ${n2(cf?.ratio)} | ${n1(cf?.lagoons)} | ${n1(cf?.slitPct)} | ${n1(cf?.lagoonPct)} | ${n0(r.riverJoinPct)} | ${r.overlaps ?? '-'} / ${r.nonInt ?? '-'} / ${r.riverBad ?? '-'} |`);
}
