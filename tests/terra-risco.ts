// Riscos da Terra contínua na bancada (Fase 2 do jogo): a cauda dos pontos de uma jogada e o abuso da peça de volta.
//   npm run terra:risco -- cauda <primeira semente> <quantas>   o guloso joga; imprime uma linha JSON por partida com os pontos de cada jogada
//   npm run terra:risco -- abuso <primeira semente> <quantas>   o "fechador" joga: a cada jogada escolhe a que mais devolve peças (depois a que mais pontua)
//   npm run terra:risco -- abuso2 ...                          o mesmo, olhando também a peça seguinte
// Os botões da regra entram por `BENCH_KNOBS` (ex.: '{"terra":{"backMin":2}}'). Não entra no `npm run check`.
import { mulberry32 } from '../src/core/rng';
import { ranked } from './bench/players';
import { BY_ID } from './bench/rules/index';
import type { LiteWorld } from './bench/lite';
import type { Move } from './bench/types';

const [, , kind = 'cauda', first = '1', count = '10'] = process.argv;
const rule = BY_ID.get('terra')!;
const CAP = 1500;

/** O fechador: entre todas as jogadas, a que devolve mais peças à pilha (cerco, mancha fechada, mar); desempata pelos pontos. */
function fechador(w: LiteWorld, moves: Move[], rng: () => number): Move {
  let best = moves[0];
  let bestV = -Infinity;
  for (const m of moves) {
    const c = w.clone();
    const before = c.stack;
    c.play(m);
    const v = (c.stack - before + 1) * 1e5 + m.pts + rng() * 0.01;
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  return best;
}

/** O fechador de 2 peças: olha também a peça seguinte (que o jogo mostra) e soma a melhor devolução dela; expande só as 8 melhores jogadas. */
function fechador2(w: LiteWorld, moves: Move[], rng: () => number): Move {
  const gain = (c: LiteWorld, m: Move) => {
    const before = c.stack;
    c.play(m);
    return c.stack - before + 1;
  };
  const scored = moves.map((m) => ({ m, g: gain(w.clone(), m) + rng() * 0.01 })).sort((a, b) => b.g - a.g || b.m.pts - a.m.pts).slice(0, 8);
  let best = scored[0].m;
  let bestV = -Infinity;
  for (const { m, g } of scored) {
    const c = w.clone();
    c.play(m);
    let next = 0;
    if (!c.over()) for (const m2 of c.moves()) next = Math.max(next, gain(c.clone(), m2));
    const v = (g + next) * 1e5 + m.pts;
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  return best;
}

for (let seed = Number(first); seed < Number(first) + Number(count); seed++) {
  const w = rule.create(seed) as LiteWorld;
  const rng = mulberry32((seed ^ Math.imul(kind === 'cauda' ? 0x6a1 : 0xfec4, 0x9e3779b1)) >>> 0);
  const moves: number[][] = [];
  let backTotal = 0;
  let prevParts: Record<string, number> = {};
  while (!w.over() && w.placed + w.discards < CAP) {
    const mv = w.moves();
    if (!mv.length) {
      w.discard();
      continue;
    }
    const m = kind === 'cauda' ? ranked(mv, rng)[0] : kind === 'abuso2' ? fechador2(w, mv, rng) : fechador(w, mv, rng);
    const stack = w.stack;
    const pts = w.play(m);
    const back = w.stack - stack + 1;
    backTotal += back;
    const parts = w.parts!();
    moves.push([pts, (parts['fechamento de mancha'] ?? 0) - (prevParts['fechamento de mancha'] ?? 0), back]);
    prevParts = { ...parts };
  }
  console.log(JSON.stringify({ seed, score: w.score, placed: w.placed, discards: w.discards, stack: w.stack, capped: w.placed + w.discards >= CAP, backTotal, moves }));
}
