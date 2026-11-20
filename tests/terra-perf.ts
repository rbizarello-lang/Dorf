// Custo da Terra contínua com 300 peças no tabuleiro (medida à mão, fora do `npm run check`): `npm run terra:perf`.
// O que custa é refazer as manchas por casa candidata: cada prévia (`Game.preview`) clona o tabuleiro e põe a peça, e o "Onde encaixa"
// (`rankMoves`) faz isso para cada casa da fronteira e cada giro. Mede o mesmo tabuleiro no Clássico e no Relevo para comparar.
import { DEFAULT_RULES, type Rules } from '../src/core/board';
import { Game } from '../src/core/game';
import { modeById, modeRules } from '../src/core/modes';
import { patchField } from '../src/core/terra';
import { THEMES } from '../src/themes/themes';

const rulesOf = (id: string, seed: number): Rules => ({ ...DEFAULT_RULES, ...THEMES[0].rules, ...modeRules(modeById(id), seed), startTiles: 500, infinite: true });
const TARGET = Number(process.argv[2] ?? 300);

function build(id: string, seed: number): Game {
  const g = new Game(seed, rulesOf(id, seed), []);
  const rand = (() => { let a = seed; return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  let guard = 0;
  while (g.board.list.length < TARGET && guard++ < 5000) {
    const m = g.bestMove(rand);
    if (!m) { if (!g.discardIfStuck()) break; continue; }
    g.rot = m.rot;
    g.place(m.q, m.r);
    while (g.offers.length) g.choose(0);
    while (g.discardIfStuck());
  }
  return g;
}

const time = (reps: number, fn: () => void) => {
  fn();
  const t0 = performance.now();
  for (let i = 0; i < reps; i++) fn();
  return (performance.now() - t0) / reps;
};
const f = (x: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

console.log(`Tabuleiro de ${TARGET} peças (média de 3 sementes), ms por chamada:`);
for (const id of ['classico', 'relevo', 'terra']) {
  const rows: number[][] = [];
  for (const seed of [11, 22, 33]) {
    const g = build(id, seed);
    const frontier = g.board.frontier.size;
    // Uma casa e um giro válidos para a prévia.
    let probe: { q: number; r: number; rot: number } | null = null;
    for (const m of [g.bestMove(() => 0.5)]) if (m) probe = m;
    const row: number[] = [g.board.list.length, frontier];
    row.push(time(200, () => g.board.clone()));
    if (probe) {
      g.rot = probe.rot;
      row.push(time(200, () => g.preview(probe!.q, probe!.r)));
    } else row.push(NaN);
    row.push(time(5, () => g.rankMoves(5)));
    row.push(time(5, () => g.bestMove(() => 0.5)));
    row.push(id === 'terra' ? time(500, () => patchField(g.board, 1)) : NaN);
    rows.push(row);
  }
  const avg = (i: number) => rows.reduce((a, r) => a + r[i], 0) / rows.length;
  console.log(`  ${id.padEnd(9)} peças ${avg(0).toFixed(0)}, fronteira ${avg(1).toFixed(0)} | clone ${f(avg(2))} | prévia ${f(avg(3))} | rankMoves(5) ${f(avg(4))} | bestMove ${f(avg(5))}${id === 'terra' ? ` | patchField ${f(avg(6))}` : ''}`);
}
