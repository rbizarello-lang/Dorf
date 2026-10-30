// Uma partida da bancada: o jogador escolhe até a pilha acabar, e cada decisão entra nas métricas de riqueza.
import { mulberry32 } from '../../src/core/rng';
import type { Move, Player, Rule } from './types';

/** O que cada decisão (cada vez que havia jogada) diz sobre a riqueza da escolha. Somas: viram médias na hora de resumir. */
export interface Decisions {
  /** Vezes em que havia pelo menos uma jogada (decisões). */
  turns: number;
  /** Só 1 jogada possível (forçada). */
  forced: number;
  /** 2 ou mais jogadas, e a melhor vale 0: escolher não muda nada. */
  empty: number;
  /** 2 ou mais jogadas e a melhor vale mais que 0: as decisões que contam. */
  informative: number;
  /** Soma das jogadas válidas, em todas as decisões. */
  options: number;
  /** Nas decisões que contam: soma das jogadas a até 10% da melhor, das casas distintas entre elas e da distância relativa melhor−mediana. */
  good: number;
  goodCells: number;
  gap: number;
  /** Nas decisões que contam: soma dos pontos da melhor jogada (o que a decisão tem em jogo). */
  stake: number;
}

export interface GameRec {
  seed: number;
  score: number;
  /** Peças colocadas (sem a do centro). */
  placed: number;
  discards: number;
  /** Tempo gasto escolhendo (ms) e quantas escolhas. */
  ms: number;
  dec: Decisions;
  /** Pontos que vieram do termo próprio da ideia, por nome (só nos mundos leves). */
  parts?: Record<string, number>;
}

export const emptyDecisions = (): Decisions => ({ turns: 0, forced: 0, empty: 0, informative: 0, options: 0, good: 0, goodCells: 0, gap: 0, stake: 0 });

/** Acumula uma decisão. `moves` nunca vem vazio. */
export function addDecision(d: Decisions, moves: Move[]) {
  d.turns++;
  d.options += moves.length;
  if (moves.length < 2) {
    d.forced++;
    return;
  }
  let best = -Infinity;
  for (const m of moves) if (m.pts > best) best = m.pts;
  if (best <= 0) {
    d.empty++;
    return;
  }
  d.informative++;
  const floor = 0.9 * best;
  let good = 0;
  const cells = new Set<number>();
  for (const m of moves)
    if (m.pts >= floor) {
      good++;
      cells.add((m.q + 1000) * 4096 + (m.r + 1000));
    }
  const pts = moves.map((m) => m.pts).sort((a, b) => a - b);
  const mid = pts.length >> 1;
  const median = pts.length % 2 ? pts[mid] : (pts[mid - 1] + pts[mid]) / 2;
  d.good += good;
  d.goodCells += cells.size;
  d.gap += (best - median) / best;
  d.stake += best;
}

/** Joga uma partida inteira de semente `seed` com `player` sob `rule`. Determinístico: o desempate de quem joga usa gerador próprio. */
export function playGame(rule: Rule, player: Player, seed: number): GameRec {
  const w = rule.create(seed);
  const salt = player.id === 'guloso' ? 0x6a1 : player.id === 'planejador' ? 0x6a2 : 0xd157;
  const rng = mulberry32((seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0);
  const dec = emptyDecisions();
  let ms = 0;
  let guard = 0;
  while (!w.over() && guard++ < 2000) {
    const moves = w.moves();
    if (!moves.length) {
      w.discard();
      continue;
    }
    addDecision(dec, moves);
    const t0 = performance.now();
    const m = player.choose(w, moves, rng);
    ms += performance.now() - t0;
    w.play(m);
  }
  return { seed, score: w.score, placed: w.placed, discards: w.discards, ms, dec, parts: w.parts?.() };
}
