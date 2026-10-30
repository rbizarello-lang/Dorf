// Os três jogadores da bancada. Todos escolhem pelo ganho imediato da jogada (`Move.pts`); mudam só até onde enxergam.
import type { Move, Player } from './types';

/** Jogadas em ordem de pontos (maior primeiro); os empates saem em ordem aleatória do gerador de quem joga, sem favorecer posição. */
export function ranked(moves: Move[], rng: () => number): Move[] {
  const keyed = moves.map((m) => ({ m, k: rng() }));
  keyed.sort((a, b) => b.m.pts - a.m.pts || a.k - b.k);
  return keyed.map((x) => x.m);
}

/** Guloso: a melhor jogada imediata. */
export const guloso: Player = {
  id: 'guloso',
  name: 'guloso',
  choose: (_w, moves, rng) => ranked(moves, rng)[0],
};

/** Quantas jogadas imediatas o planejador expande (poda por largura) e o maior ganho que a peça seguinte pode render (poda por limite). */
export const BEAM = 8;
export const NEXT_BOUND = 150;

/**
 * Planejador: olha a peça seguinte, que o jogo mostra, em profundidade 2. Só expande as `BEAM` melhores jogadas imediatas e para
 * quando nem somando o maior ganho possível da próxima peça uma jogada mais fraca alcançaria a melhor já achada. O valor de uma
 * jogada é o ganho dela mais o da melhor resposta com a peça seguinte, no tabuleiro depois dela.
 */
export const planejador: Player = {
  id: 'planejador',
  name: 'planejador (2 peças)',
  choose(w, moves, rng) {
    const top = ranked(moves, rng).slice(0, BEAM);
    let best = top[0];
    let bestV = -Infinity;
    for (const m of top) {
      if (m.pts + NEXT_BOUND < bestV) break;
      let next = 0;
      for (const x of w.after(m)) if (x.pts > next) next = x.pts;
      const v = m.pts + next;
      if (v > bestV) {
        bestV = v;
        best = m;
      }
    }
    return best;
  },
};

/** Distraído: escolhe ao acaso entre as 3 melhores jogadas imediatas. */
export const distraido: Player = {
  id: 'distraido',
  name: 'distraído (3 melhores)',
  choose(_w, moves, rng) {
    const top = ranked(moves, rng).slice(0, 3);
    return top[Math.floor(rng() * top.length)];
  },
};

export const PLAYERS: Player[] = [guloso, planejador, distraido];
