// Resumo das partidas de uma regra com um jogador: o que a tabela e o JSON mostram.
import type { GameRec } from './sim';

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export interface Summary {
  rule: string;
  player: string;
  games: number;
  score: { mean: number; sd: number; p10: number; p50: number; p90: number };
  /** Peças colocadas por partida (média e mediana). */
  placed: { mean: number; p50: number };
  /** Partidas com pelo menos um descarte (peça que não coube em lugar nenhum), em %, e descartes por partida. */
  stuckPct: number;
  discardsPerGame: number;
  /** Tempo escolhendo, por jogada (ms). */
  msPerMove: number;
  /** Riqueza de decisão (ver `Decisions` em sim.ts). */
  rich: {
    /** Jogadas válidas por decisão. */
    options: number;
    /** % das decisões com uma só jogada. */
    forcedPct: number;
    /** % das decisões em que a melhor jogada vale 0 (escolher não muda nada). */
    emptyPct: number;
    /** Nas decisões que contam: jogadas a até 10% da melhor, casas distintas entre elas, e distância relativa melhor−mediana. */
    good: number;
    goodCells: number;
    gap: number;
    /** Pontos da melhor jogada nas decisões que contam (o que está em jogo em cada escolha). */
    stake: number;
  };
  /** Pontos por partida (média) que vieram do termo próprio da ideia, por nome; vazio nas regras do núcleo. */
  parts: Record<string, number>;
  /** Placar de cada partida por semente (1..N), para o pareamento entre jogadores. */
  scores: number[];
}

export function summarize(rule: string, player: string, recs: GameRec[]): Summary {
  const sorted = recs.map((r) => r.score).sort((a, b) => a - b);
  const m = mean(sorted);
  const sd = Math.sqrt(sorted.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, sorted.length - 1));
  const placed = recs.map((r) => r.placed).sort((a, b) => a - b);
  let turns = 0, forced = 0, empty = 0, info = 0, options = 0, good = 0, cells = 0, gap = 0, stake = 0, ms = 0;
  for (const r of recs) {
    const d = r.dec;
    turns += d.turns;
    forced += d.forced;
    empty += d.empty;
    info += d.informative;
    options += d.options;
    good += d.good;
    cells += d.goodCells;
    gap += d.gap;
    stake += d.stake;
    ms += r.ms;
  }
  const parts: Record<string, number> = {};
  for (const r of recs) for (const [k, v] of Object.entries(r.parts ?? {})) parts[k] = (parts[k] ?? 0) + v / recs.length;
  return {
    rule,
    player,
    games: recs.length,
    score: { mean: m, sd, p10: percentile(sorted, 0.1), p50: percentile(sorted, 0.5), p90: percentile(sorted, 0.9) },
    placed: { mean: mean(placed), p50: percentile(placed, 0.5) },
    stuckPct: (100 * recs.filter((r) => r.discards > 0).length) / Math.max(1, recs.length),
    discardsPerGame: mean(recs.map((r) => r.discards)),
    msPerMove: turns ? ms / turns : 0,
    rich: {
      options: turns ? options / turns : 0,
      forcedPct: turns ? (100 * forced) / turns : 0,
      emptyPct: turns ? (100 * empty) / turns : 0,
      good: info ? good / info : 0,
      goodCells: info ? cells / info : 0,
      gap: info ? gap / info : 0,
      stake: info ? stake / info : 0,
    },
    parts,
    scores: recs.slice().sort((a, b) => a.seed - b.seed).map((r) => r.score),
  };
}

/** Diferença pareada por semente (b − a): média, erro padrão, o ganho relativo (soma de b sobre soma de a, menos 1) e a fração de sementes em que b ganha de a. */
export function paired(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  const d = Array.from({ length: n }, (_, i) => b[i] - a[i]);
  const m = mean(d);
  const se = Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1)) / Math.sqrt(Math.max(1, n));
  const sa = a.slice(0, n).reduce((x, y) => x + y, 0);
  const sb = b.slice(0, n).reduce((x, y) => x + y, 0);
  return { mean: m, se, rel: sa ? sb / sa - 1 : 0, wins: n ? d.filter((x) => x > 0).length / n : 0 };
}
