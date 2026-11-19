import { DEFAULT_RULES } from '../src/core/board';
import { themeById } from '../src/themes/themes';
import { Game } from '../src/core/game';
import { DIRS, hexDistance, hkey, unkey } from '../src/core/hex';
import { modeById } from '../src/core/modes';
import { rotateEdges, T } from '../src/core/tiles';

/** Roteiro de navegação por retas. Mantém as margens dos trechos futuros livres e
 * tenta os cais na ordem das distâncias. Só usa jogadas oferecidas pela partida. */
export function sail(seed: number, combinedFreight = false) {
  const rules = { ...DEFAULT_RULES, ...themeById('holanda').rules, ...modeById('entrepostos').rules, combinedFreight };
  const game = new Game(seed, rules);
  const moves: number[][] = [];
  const reserved = new Map<number, number>();
  for (const p of game.board.ports) {
    const n = hexDistance(0, 0, p.q, p.r);
    const d = DIRS.findIndex(([x, y]) => x === p.q / n && y === p.r / n);
    for (let k = 1; k <= n; k++) reserved.set(hkey(k * p.q / n, k * p.r / n), d);
  }
  while (game.current) {
    let best = -Infinity, move: number[] | null = null;
    for (const key of game.board.frontier) {
      const [q, r] = unkey(key), heading = reserved.get(key);
      for (let rot = 0; rot < 6; rot++) {
        const edges = rotateEdges(game.current.edges, rot);
        if (!game.board.check(q, r, edges).valid) continue;
        let score = -hexDistance(q, r, 0, 0);
        if (heading !== undefined) {
          const [dx, dy] = DIRS[heading];
          if (!game.board.onMainRiver(game.board.get(q - dx, r - dy)) || edges[(heading + 3) % 6] !== T.Water) continue;
          if (edges[heading] !== T.Water && !game.board.ports.some((p) => p.q === q && p.r === r)) continue;
          score += 200 - 4 * [...reserved.keys()].indexOf(key);
        }
        if (DIRS.some(([dx, dy], i) => {
          const next = reserved.get(hkey(q + dx, r + dy));
          if (next === undefined || game.board.get(q + dx, r + dy)) return false;
          const water = next === i || (next + 3) % 6 === i;
          return water ? edges[i] !== T.Water : edges[i] === T.Water || edges[i] === T.Rail;
        })) continue;
        if (score > best) { best = score; move = [q, r, rot]; }
      }
    }
    if (!move) break;
    game.rot = move[2];
    if (!game.place(move[0], move[1])) throw new Error('Jogada recusada');
    moves.push(move);
    while (game.discardIfStuck());
  }
  return { game, moves };
}
