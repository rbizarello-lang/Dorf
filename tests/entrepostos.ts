import assert from 'node:assert/strict';
import { DEFAULT_RULES } from '../src/core/board';
import { Game } from '../src/core/game';
import { DIRS, hexDistance, unkey } from '../src/core/hex';
import { modeById } from '../src/core/modes';
import { chart, type ChartId, type FreightContractId } from '../src/core/ports';
import { T, type TileDef } from '../src/core/tiles';
import { themeById } from '../src/themes/themes';

type Cell = [q: number, r: number];
type Move = [q: number, r: number, rot: number];
type Tile = { q: number; r: number; edges: readonly T[] };
type PortState = { at?: number; paid?: number; reward?: number };
type Shipment = [id: number, tiles: number];

const key = (q: number, r: number) => `${q},${r}`;
const step = (q: number, r: number, side: number): Cell => [q + DIRS[side][0], r + DIRS[side][1]];
const other = (side: number) => (side + 3) % 6;
const mode = modeById('entrepostos');

// Busca por camadas, pelas duas bocas de cada emenda. A lista de peças é o único dado do motor usado aqui.
function mainRiver(tiles: readonly Tile[]) {
  const grid = new Map(tiles.map((tile) => [key(tile.q, tile.r), tile]));
  const origin = grid.get('0,0');
  const seen = new Set<string>();
  let layer = origin?.edges.includes(T.Water) ? [origin] : [];
  while (layer.length) {
    for (const tile of layer) seen.add(key(tile.q, tile.r));
    const next = new Set<Tile>();
    for (const tile of layer) for (const [side, edge] of tile.edges.entries()) {
      if (edge !== T.Water) continue;
      const neighbor = key(...step(tile.q, tile.r, side));
      const tileNext = grid.get(neighbor);
      if (!seen.has(neighbor) && tileNext?.edges[other(side)] === T.Water) next.add(tileNext);
    }
    layer = [...next];
  }
  return seen;
}

function forecast(previous: readonly PortState[], reaches: readonly boolean[], turn: number, freight: FreightContractId) {
  const ports = previous.map((state, id) => ({ ...state, at: state.at ?? (reaches[id] ? turn : undefined) }));
  const [fair, sawmill, yard] = ports;
  const shipments: Shipment[] = [];
  function ship(id: number, tiles: number) {
    ports[id].paid = turn;
    ports[id].reward = tiles;
    shipments.push([id, tiles]);
  }
  if (freight === 'direto' && fair.at !== undefined && fair.paid === undefined) ship(0, 4);
  if (sawmill.at !== undefined && sawmill.paid === undefined) ship(1, 6);
  if (freight === 'madeira' && fair.at !== undefined && sawmill.at !== undefined && fair.paid === undefined)
    ship(0, sawmill.at <= fair.at ? 10 : 4);
  if (yard.at !== undefined && yard.paid === undefined) ship(2, 8);
  return { ports, shipments };
}

function changedTiles(game: Game, [q, r, rot]: Move) {
  const edges = game.current!.edges.map((_, side, base) => base[(side - rot + 6) % 6]);
  return [...game.board.list, { q, r, edges }];
}

function stateOf(game: Game) {
  return {
    stack: game.stack, score: game.board.score, bonus: game.finalSupplyBonus, over: game.over,
    rot: game.rot, placed: game.placedCount, discarded: game.discarded, hand: [game.current, game.next],
    frontier: [...game.board.frontier], tiles: game.board.list.map((tile) => [tile.q, tile.r, tile.rot, tile.edges]),
    ports: game.board.ports.map((port) => [port.id, port.q, port.r, port.connectedAt, port.paidAt, port.reward, port.delivered]),
  };
}

function validPaths(game: Game, tiles: readonly Tile[], reaches: readonly boolean[], context: string) {
  for (const [id, port] of game.board.ports.entries()) {
    const path = game.board.riverPath(port.q, port.r);
    if (!reaches[id]) {
      assert.deepEqual(path, [], `${context}: caminho até cais sem canal`);
      continue;
    }
    assert.deepEqual(path[0], [0, 0], `${context}: caminho parte do centro`);
    assert.deepEqual(path.at(-1), [port.q, port.r], `${context}: caminho termina no cais`);
    assert.equal(new Set(path.map(([q, r]) => key(q, r))).size, path.length, `${context}: caminho sem ciclo`);
    for (let i = 1; i < path.length; i++) {
      const [a, b] = [path[i - 1], path[i]];
      const side = DIRS.findIndex(([dq, dr]) => (a[0] + dq === b[0] && a[1] + dr === b[1]));
      assert.notEqual(side, -1, `${context}: caminho passa só por vizinhos`);
      assert.equal(tiles.find((p) => p.q === a[0] && p.r === a[1])?.edges[side], T.Water, `${context}: saída por água`);
      assert.equal(tiles.find((p) => p.q === b[0] && p.r === b[1])?.edges[other(side)], T.Water, `${context}: entrada por água`);
    }
  }
}

class JourneyOracle {
  private ports: PortState[] = [{}, {}, {}];

  place(game: Game, move: Move, expected?: Shipment[], edgePoints?: number) {
    const [q, r, rot] = move;
    const context = `${game.rules.layout}/${game.rules.freight}, semente ${game.seed}, jogada ${game.placedCount + 1} (${q},${r},${rot})`;
    game.rot = rot;
    const before = JSON.stringify(stateOf(game));
    const score = game.board.score;
    const stack = game.stack;
    const tiles = changedTiles(game, move);
    const reached = mainRiver(tiles);
    const docks = game.board.ports.map((port) => reached.has(key(port.q, port.r)));
    const quote = forecast(this.ports, docks, game.placedCount + 1, game.rules.freight);
    if (expected) assert.deepEqual(quote.shipments, expected, `${context}: ordem e valor da situação sintética`);

    const showShipments = (deliveries: { id: number; reward?: number }[]) => deliveries.map((p) => [p.id, p.reward]);
    const preview = game.preview(q, r);
    assert.ok(preview, `${context}: prévia de jogada válida`);
    assert.deepEqual(showShipments(preview.deliveries), quote.shipments, `${context}: prévia de frete`);
    if (game.current!.edges.includes(T.Water)) {
      const voyage = game.board.voyageAt(q, r, tiles.at(-1)!.edges);
      assert.deepEqual(voyage.connected.map((p) => p.id).sort(), docks.flatMap((joined, id) => joined ? [id] : []), `${context}: prévia de conexões`);
      assert.deepEqual(voyage.shipments.map(({ port, tiles: amount }) => [port.id, amount]), quote.shipments, `${context}: ordem e valor na carta`);
      assert.equal(voyage.joins, reached.has(key(q, r)), `${context}: prévia do canal principal`);
    }
    assert.equal(JSON.stringify(stateOf(game)), before, `${context}: prévias puras`);

    const result = game.place(q, r);
    assert.ok(result, `${context}: jogada válida`);
    assert.deepEqual(showShipments(result.deliveries), quote.shipments, `${context}: fretes pagos`);
    assert.deepEqual(game.board.ports.map((port) => [port.id, port.connectedAt, port.paidAt, port.reward, port.delivered]),
      quote.ports.map(({ at, paid, reward }, id) => [id, at, paid, reward, paid !== undefined]), `${context}: histórico de contato e pagamento`);
    validPaths(game, tiles, docks, context);

    const rewards = quote.shipments.reduce((sum, [, amount]) => sum + amount, 0);
    const stock = stack - 1 + rewards + result.closed.length;
    const won = quote.ports.every((port) => port.paid !== undefined);
    const bonus = won ? stock * 20 : 0;
    assert.equal(result.tilesGained, rewards + result.closed.length, `${context}: suprimentos ganhos`);
    assert.equal(game.stack, won ? 0 : stock, `${context}: pilha líquida`);
    assert.equal(game.finalSupplyBonus, bonus, `${context}: bônus de estoque`);
    assert.equal(result.leftoverBonus ?? 0, bonus, `${context}: bônus relatado pela jogada`);
    assert.equal(preview.leftoverBonus ?? 0, bonus, `${context}: bônus na prévia`);
    assert.equal(preview.points, result.points, `${context}: prévia de pontos`);
    assert.equal(game.over, won || stock === 0, `${context}: encerra com o último frete ou a última peça`);
    if (edgePoints !== undefined) assert.equal(game.board.score, score + edgePoints + bonus, `${context}: pontos de encaixe e estoque`);
    this.ports = quote.ports;
    return { q, r, rot, shipments: quote.shipments, points: game.board.score, stack: game.stack, bonus, ports: this.ports };
  }
}

function fixture(freight: FreightContractId, adjacent = false) {
  const game = new Game(42, { ...DEFAULT_RULES, ...mode.rules, freight });
  assert.equal(game.stack, 24);
  const riverSides = game.board.list[0].edges.flatMap((edge, side) => edge === T.Water ? [side] : []);
  assert.equal(riverSides.length, 3);
  const [heading] = riverSides;
  const at = (dist: number, row: number, side = heading): Cell => {
    const [dq, dr] = DIRS[side];
    const [x, y] = DIRS[(side + 1) % 6];
    return [dist * dq + row * x, dist * dr + row * y];
  };
  const locations = adjacent ? [at(2, 0), at(3, 0), at(2, 0, riverSides[2])] : riverSides.map((side) => at(2, 0, side));
  game.board.ports = locations.map(([q, r], id) => ({ id, q, r, delivered: false }));
  const oracle = new JourneyOracle();
  function place(cell: Cell, water: number[], rewards: Shipment[], edgePoints?: number) {
    const edges = Array<T>(6).fill(T.Grass);
    for (const side of water) edges[side] = T.Water;
    game.current = { edges, seed: 100 + game.placedCount, quest: null };
    return oracle.place(game, [...cell, 0], rewards, edgePoints);
  }
  function approach(id: number) {
    const side = riverSides[id];
    place(at(1, 0, side), [side, other(side)], [], 10);
  }
  function land(id: number, rewards: Shipment[]) {
    const side = riverSides[id];
    return place(locations[id], [side, other(side)], rewards, 10);
  }
  return { game, at, approach, land, place, heading };
}

// Entrega direta, reabastecimento em ordens diferentes, sem pagar duas vezes ao continuar um canal.
{
  const { game, at, approach, land, place, heading } = fixture('direto');
  approach(0);
  assert.equal(land(0, [[0, 4]]).stack, 26);
  assert.equal(place(at(3, 0), [heading, other(heading)], [], 10).stack, 25);
  approach(2);
  assert.equal(land(2, [[2, 8]]).stack, 31);
  approach(1);
  assert.equal(land(1, [[1, 6]]).bonus, 700);
  assert.equal(game.board.score, 770);
  assert.equal(game.place(...at(4, 0)), null);
}

// Feira antes, depois e na mesma jogada da Serraria. No empate, um segmento remoto libera os dois cais.
{
  const first = fixture('madeira');
  first.approach(0);
  assert.equal(first.land(0, []).stack, 22);
  first.approach(1);
  assert.equal(first.land(1, [[1, 6], [0, 4]]).stack, 30);
  first.approach(2);
  assert.equal(first.land(2, [[2, 8]]).bonus, 720);

  const after = fixture('madeira');
  after.approach(1);
  assert.equal(after.land(1, [[1, 6]]).stack, 28);
  after.approach(0);
  assert.equal(after.land(0, [[0, 10]]).stack, 36);
  after.approach(2);
  assert.equal(after.land(2, [[2, 8]]).bonus, 840);

  const { at, place, heading, game } = fixture('madeira', true);
  const water = [heading, other(heading)];
  place(at(0, 1), [], []);
  place(at(1, 1), [], []);
  place(at(2, 0), water, []);
  place(at(3, 0), water, []);
  assert.ok(game.board.ports.slice(0, 2).every((port) => port.connectedAt === undefined));
  const both = place(at(1, 0), water, [[1, 6], [0, 10]]);
  assert.equal(both.stack, 35);
  assert.deepEqual(both.ports.slice(0, 2).map((port) => [port.at, port.paid]), [[5, 5], [5, 5]]);
  place(at(4, 0), water, []);
}

// Cais pede peça de água, mas pode ser preparado por terra. Rio e trilho conservam seus encaixes estritos.
{
  const { game, at, place, heading } = fixture('direto');
  const land = Array<T>(6).fill(T.Grass);
  const def = (edges: T[]): TileDef => ({ edges, seed: 7, quest: null });
  const rail = [...land];
  rail[other(heading)] = T.Rail;
  assert.equal(game.board.check(...at(1, 0), land).valid, false, 'Terra não tapa a boca de rio do centro');
  assert.equal(game.board.check(...at(1, 0), rail).valid, false, 'Trilho não encosta em rio');
  place(at(0, 1), [], []);
  place(at(1, 1), [], []);
  assert.equal(game.board.check(...at(2, 0), land).valid, false, 'Cais sem água é inválido mesmo quando encosta lateralmente em terra');
  game.current = def(land);
  const before = stateOf(game);
  assert.equal(game.preview(...at(2, 0)), null);
  assert.equal(game.place(...at(2, 0)), null);
  assert.deepEqual(stateOf(game), before, 'Tentativa no cais seco preserva a partida');
  place(at(2, 0), [heading, other(heading)], [], 10);
  assert.deepEqual(game.board.riverPath(...at(2, 0)), [], 'Cais com água desconectada continua esperando');
}

{
  const { game, approach } = fixture('madeira');
  game.stack = 1;
  approach(0);
  assert.ok(game.over && game.board.ports.every((port) => !port.delivered), 'A pilha vazia encerra uma viagem incompleta');
  assert.equal(game.finalSupplyBonus, 0);
}

// Roteiro de teste: reserva os corredores da carta. O cálculo do frete percorre as emendas efetivas.
function sail(seed: number, layout: ChartId, freight: FreightContractId, theme: string, order = [0, 1, 2]) {
  assert.equal(mode.id, 'entrepostos');
  const rules = { ...DEFAULT_RULES, ...themeById(theme).rules, ...mode.rules, layout, freight };
  const game = new Game(seed, rules), oracle = new JourneyOracle();
  const reserved = new Map<string, Set<number>>();
  const { corridors } = chart(seed, layout);
  for (const id of order) {
    const corridor = corridors[id];
    let q = 0, r = 0;
    for (const [i, side] of corridor.entries()) {
      [q, r] = step(q, r, side);
      const cell = key(q, r), edges = reserved.get(cell) ?? new Set<number>();
      edges.add(other(side));
      if (i + 1 < corridor.length) edges.add(corridor[i + 1]);
      reserved.set(cell, edges);
    }
  }
  const priority = [...reserved.keys()];
  const turns = [];
  while (game.current) {
    const reached = mainRiver(game.board.list);
    let best = -Infinity, move: Move | null = null;
    for (const hex of game.board.frontier) {
      const [q, r] = unkey(hex), at = key(q, r), required = reserved.get(at);
      if (required && ![...required].some((side) => reached.has(key(...step(q, r, side))))) continue;
      for (let rot = 0; rot < 6; rot++) {
        if (!game.board.checkDef(q, r, game.current, rot).valid) continue;
        const edges = game.current.edges.map((_, side, base) => base[(side - rot + 6) % 6]);
        if (required && [...required].some((side) => edges[side] !== T.Water)) continue;
        if (edges.some((edge, side) => {
          const next = step(q, r, side), future = reserved.get(key(...next));
          if (!future || game.board.get(...next)) return false;
          return future.has(other(side)) ? edge !== T.Water : edge === T.Water || edge === T.Rail;
        })) continue;
        const score = required ? 100 - priority.indexOf(at) : -hexDistance(q, r, 0, 0);
        if (score > best) { best = score; move = [q, r, rot]; }
      }
    }
    assert.ok(move, `${layout}/${freight}, ${theme}, semente ${seed}: sem jogada no turno ${game.placedCount + 1}`);
    turns.push(oracle.place(game, move));
    while (game.discardIfStuck());
  }
  assert.ok(game.board.ports.every((p) => p.delivered), `${layout}/${freight}, ${theme}, semente ${seed}: faltou entregar cais`);
  return { game, turns };
}

const [, , action, argSeed, argTheme, argChart, argFreight, firstDock] = process.argv;
if (action === '--roteiro') {
  const { turns } = sail(Number(argSeed), argChart as ChartId, argFreight as FreightContractId, argTheme, firstDock === 'serraria' ? [1, 0, 2] : undefined);
  console.log(JSON.stringify(turns));
} else {
  const layouts: ChartId[] = ['confluencia', 'forquilha', 'enseada'];
  const contracts: FreightContractId[] = ['direto', 'madeira'];
  let games = 0, placements = 0;
  for (const layout of layouts) for (const freight of contracts) for (let seed = 1; seed <= 12; seed++) {
    const theme = ['holanda', 'egito', 'oriental', 'brasil', 'inverno'][seed % 5];
    const order = freight === 'madeira' && seed % 2 ? [1, 0, 2] : [0, 1, 2];
    const { game, turns } = sail(seed, layout, freight, theme, order);
    const replay = new Game(seed, game.rules), oracle = new JourneyOracle();
    for (const [i, { q, r, rot, shipments, points, stack }] of turns.entries()) {
      if (i === 1) {
        const originalRotation = replay.rot;
        const before = JSON.stringify(stateOf(replay));
        for (let rotation = 0; rotation < 6; rotation++) {
          replay.rot = rotation;
          replay.preview(q, r);
        }
        replay.rot = originalRotation;
        assert.equal(JSON.stringify(stateOf(replay)), before, 'Consultar seis rotações preserva a partida');
      }
      const res = oracle.place(replay, [q, r, rot], shipments);
      assert.deepEqual([res.points, res.stack], [points, stack], 'Replay reproduz pontuação e estoque em cada jogada');
      while (replay.discardIfStuck());
    }
    assert.deepEqual(stateOf(replay), stateOf(game), 'Replay completo reproduz o estado final dos cais');
    games++;
    placements += turns.length;
  }
  console.log(`Entrepostos: cenários de frete e ${games} viagens dirigidas em 3 cartas e 2 contratos, ${placements} jogadas com prévia e replay conferidos por oráculo.`);
}
