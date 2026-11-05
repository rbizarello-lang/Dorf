// Os três jogadores da bancada. Todos escolhem pelo ganho imediato da jogada (`Move.pts`); mudam só até onde enxergam.
import { LiteWorld } from './lite';
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

/** Quantas jogadas o planejador de 3 peças expande na peça atual e na seguinte. */
export const BEAM3 = [6, 4];

/**
 * Planejador de 3 peças (medida extra, só nos mundos leves, que sabem se clonar): enxerga também a peça depois da seguinte, que o jogo só
 * mostra com o mirante. Serve para confirmar a profundidade de uma regra cujo prêmio se forma em várias jogadas. Valor de uma jogada =
 * ganho dela + o da melhor resposta com a peça seguinte + o da melhor resposta seguinte (poda por largura, sem a poda por limite).
 */
export const planejador3: Player = {
  id: 'planejador3',
  name: 'planejador (3 peças)',
  choose(w, moves, rng) {
    if (!(w instanceof LiteWorld)) return planejador.choose(w, moves, rng);
    let best = moves[0];
    let bestV = -Infinity;
    for (const m1 of ranked(moves, rng).slice(0, BEAM3[0])) {
      const w1 = w.clone();
      w1.play(m1);
      let tail = 0;
      for (const m2 of ranked(w1.moves(), rng).slice(0, BEAM3[1])) {
        const w2 = w1.clone();
        w2.play(m2);
        let last = 0;
        for (const x of w2.moves()) if (x.pts > last) last = x.pts;
        if (m2.pts + last > tail) tail = m2.pts + last;
      }
      const v = m1.pts + tail;
      if (v > bestV) {
        bestV = v;
        best = m1;
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
/** Também jogáveis pelo nome (`--jogadores=planejador3`), mas fora da tabela padrão: custam bem mais. */
export const ALL_PLAYERS: Player[] = [...PLAYERS, planejador3];
