import { chart, type ChartId } from '../src/core/ports';
import { DEFAULT_RULES } from '../src/core/board';
import { themeById } from '../src/themes/themes';
import { Game } from '../src/core/game';
import { DIRS, hexDistance, hkey, unkey } from '../src/core/hex';
import { modeById } from '../src/core/modes';
import { rotateEdges, T } from '../src/core/tiles';

/** Roteiro de navegação por retas. Mantém as margens dos trechos futuros livres e
 * tenta os cais na ordem das distâncias. Só usa jogadas oferecidas pela partida. */
export function sail(seed: number, combinedFreight = false, layout: ChartId = 'confluencia', order = [0, 1, 2], alternate = false, theme = 'holanda') {
  const rules = { ...DEFAULT_RULES, ...themeById(theme).rules, ...modeById('entrepostos').rules, combinedFreight, layout };
  const game = new Game(seed, rules);
  const moves: number[][] = [];
  let minimum = game.stack;
  const reserved = new Map<number, Set<number>>();
  const { corridors } = chart(seed, layout);
  for (const id of order) {
    let q = 0, r = 0;
    for (const [i, side] of corridors[id].entries()) {
      q += DIRS[side][0]; r += DIRS[side][1];
      const key = hkey(q, r), needed = reserved.get(key) ?? new Set<number>();
      needed.add((side + 3) % 6);
      if (i + 1 < corridors[id].length) needed.add(corridors[id][i + 1]);
      reserved.set(key, needed);
    }
  }
  const priority = [...reserved.keys()];
  while (game.current) {
    let best = -Infinity, move: number[] | null = null;
    const frontier = alternate ? [...game.board.frontier].reverse() : game.board.frontier;
    for (const key of frontier) {
      const [q, r] = unkey(key), heading = reserved.get(key);
      for (let rot = 0; rot < 6; rot++) {
        const edges = rotateEdges(game.current.edges, rot);
        if (!game.board.check(q, r, edges).valid) continue;
        let score = -hexDistance(q, r, 0, 0);
        if (heading !== undefined) {
          if ([...heading].some((side) => edges[side] !== T.Water)) continue;
          if (![...heading].some((side) => game.board.onMainRiver(game.board.get(q + DIRS[side][0], r + DIRS[side][1])))) continue;
          score += 200 - 4 * priority.indexOf(key);
        }
        if (DIRS.some(([dx, dy], i) => {
          const next = reserved.get(hkey(q + dx, r + dy));
          if (next === undefined || game.board.get(q + dx, r + dy)) return false;
          const water = next.has((i + 3) % 6);
          return water ? edges[i] !== T.Water : edges[i] === T.Water || edges[i] === T.Rail;
        })) continue;
        if (score > best) { best = score; move = [q, r, rot]; }
      }
    }
    if (!move) break;
    minimum = Math.min(minimum, game.stack - 1);
    game.rot = move[2];
    if (!game.place(move[0], move[1])) throw new Error('Jogada recusada');
    moves.push(move);
    while (game.discardIfStuck());
  }
  return { game, moves, minimum };
}
