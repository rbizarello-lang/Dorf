import assert from 'node:assert/strict';
import { CHARTS, chart, type ChartId } from '../src/core/ports';
import { Game } from '../src/core/game';
import { DIRS } from '../src/core/hex';
import { rotateEdges } from '../src/core/tiles';
import { sail } from './voyage';

for (const layout of Object.keys(CHARTS) as ChartId[]) {
  const path = chart(42, layout).corridors;
  const visits = new Map<string, number>();
  for (const directions of path) {
    let q = 0, r = 0;
    for (const side of directions) {
      q += DIRS[side][0]; r += DIRS[side][1];
      const cell = [q, r].join(',');
      visits.set(cell, (visits.get(cell) ?? 0) + 1);
    }
  }
  const shared = [...visits.values()].filter((n) => n > 1).length;
  const stats = { layout, shared, solved: 0, runs: 0, minMoves: Infinity, maxMoves: 0, minimum: Infinity, orders: {} as Record<string, number>, premium: 0 };
  for (let seed = 1; seed <= 100; seed++) {
    let solved = false;
    for (const [i, order] of [[0,1,2], [1,0,2], [2,0,1], [0,2,1], [1,2,0], [2,1,0]].entries()) {
      if (i >= 3 && solved) break;
      const { game, moves, minimum } = sail(seed, true, layout, order, i >= 3);
      stats.runs++;
      if (!game.board.ports.every((p) => p.delivered)) continue;
      solved = true; stats.minimum = Math.min(stats.minimum, minimum);
      stats.minMoves = Math.min(stats.minMoves, moves.length); stats.maxMoves = Math.max(stats.maxMoves, moves.length);
      const sequence = [...game.board.ports].sort((a,b) => a.connectedAt! - b.connectedAt!).map((p) => p.id).join('');
      stats.orders[sequence] = 1 + (stats.orders[sequence] ?? 0);
      if (game.board.ports[0].reward === 10) stats.premium++;
      const replay = new Game(seed, game.rules);
      const connected = new Set<number>(), paid = new Set<number>();
      for (const [q,r,rot] of moves) {
        const def = replay.current!, edges = rotateEdges(def.edges, rot);
        const before = JSON.stringify([replay.stack, replay.board.ports, replay.board.score, def]);
        for (let angle=0; angle<6; angle++) replay.board.voyageAt(q,r,rotateEdges(def.edges,angle));
        assert.equal(JSON.stringify([replay.stack, replay.board.ports, replay.board.score, def]), before);
        const preview = replay.board.voyageAt(q,r,edges).shipments.map((x) => [x.port.id, x.tiles]);
        replay.rot = rot;
        const result = replay.place(q,r)!;
        // Oráculo usa os grupos já calculados na peça confirmada; o orçamento depende dos turnos anteriores.
        const connectedNow = replay.board.ports.filter((p) => replay.board.onMainRiver(replay.board.get(p.q,p.r)));
        const expected = connectedNow.filter((p) => !paid.has(p.id) && (p.id !== 0 || connectedNow.some((x) => x.id === 1)))
          .map((p) => [p.id, p.id === 0 ? (connected.has(0) && !paid.has(1) ? 4 : 10) : p.id === 1 ? 6 : 8]);
        assert.deepEqual(preview, expected);
        assert.deepEqual(result.deliveries.map((p) => [p.id, p.reward]), expected);
        for (const p of connectedNow) connected.add(p.id);
        for (const [id] of expected) paid.add(id);
        while (replay.discardIfStuck());
      }
      assert.equal(replay.board.score, game.board.score);
    }
    if (solved) stats.solved++; else console.error(layout, seed);
  }
  console.log(JSON.stringify(stats));
  assert.equal(stats.solved, 100);
}

