import assert from 'node:assert/strict';
import { Board, DEFAULT_RULES } from '../src/core/board';
import { Game } from '../src/core/game';
import { DIRS, hexToWorld } from '../src/core/hex';
import { boardHill, handHill, hillHeight, hillSignature, type HillProfile } from '../src/core/hills';
import { T, type TileDef } from '../src/core/tiles';

const rules = { ...DEFAULT_RULES, riverTrade: true, layout: 'crista' as const };
const tile = (edges: T[], seed: number): TileDef => ({ edges, seed, quest: null });
const forest = tile(Array<T>(6).fill(T.Forest), 12765);
const farm = tile(Array<T>(6).fill(T.Field), 757979);
const plateau = tile([T.Forest, T.Grass, T.Field, T.Village, T.Forest, T.Field], 43512);
const approx = (a: number, b: number, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);

function sample(profile: HillProfile, rot: number, dx: number, dz: number) {
  const a = rot * Math.PI / 3, cos = Math.cos(a), sin = Math.sin(a);
  return hillHeight(profile, cos * dx + sin * dz, -sin * dx + cos * dz);
}

// O relevo intrínseco não depende de uma missão, vizinhança ou sorteio extra.
{
  const high = handHill(plateau);
  assert.ok(hillHeight(high, 0, 0) > .12);
  const low = handHill(tile(Array<T>(6).fill(T.Grass), 43155));
  assert.equal(low.landform, 'Várzea');
  assert.ok(hillHeight(low, 0, 0) < hillHeight(high, 0, 0));
  assert.deepEqual(high, handHill({ ...plateau, quest: { kind: 'perfect', terrain: T.Field, delta: 1, exact: false } }));
  assert.notDeepEqual(handHill({ ...plateau, seed: 641298335 }), high);
  assert.equal(hillSignature(undefined), '');
  for (const layout of ['confluencia', 'forquilha', 'enseada'] as const) {
    assert.equal(boardHill(new Board({ ...rules, layout }), 5, 5, plateau, 1), undefined);
  }
  assert.equal(boardHill(new Board({ ...rules, riverTrade: false }), 5, 5, plateau, 0), undefined);
  const historic = new Game(42, rules);
  for (const p of historic.board.list) assert.equal(boardHill(historic.board, p.q, p.r, p.def, p.rot), undefined);
}

// Quatro contatos de mata sustentam três níveis. Campo vizinho e rio conectado
// não contam como apoios terrestres. O ombro oposto e cada quina têm cota finita.
{
  const board = new Board(rules), q = 5, r = 4;
  board.placeRaw(q, r, forest, 0);
  const read = () => boardHill(board, q, r, forest, 0)!;
  const hand = handHill(forest);
  assert.deepEqual(read(), hand);
  board.placeRaw(q + DIRS[4][0], r + DIRS[4][1], farm, 0);
  assert.deepEqual(read(), hand);
  let previous = read();
  for (let i = 0; i < 4; i++) {
    const [dq, dr] = DIRS[i];
    board.placeRaw(q + dq, r + dr, forest, 0);
    const current = read();
    assert.equal(current.stage, Math.min(i + 1, 3));
    if (i < 3) assert.ok(hillHeight(current, 0, 0) - hillHeight(previous, 0, 0) > .065);
    else approx(hillHeight(current, 0, 0), hillHeight(previous, 0, 0));
    assert.ok(current.rims[i] > 0);
    previous = current;
  }
  for (const strict of [T.Water, T.Rail]) {
    const strictBoard = new Board(rules);
    const def = tile([strict, T.Field, T.Field, strict, T.Village, T.Forest], 29825);
    strictBoard.placeRaw(q, r, def, 0);
    strictBoard.placeRaw(q + 1, r, def, 0);
    assert.deepEqual(boardHill(strictBoard, q, r, def, 0), handHill(def));
    const bare = handHill(tile(Array<T>(6).fill(strict), 42));
    for (const v of [0, .25, .6]) approx(hillHeight(bare, v, .12), 0);
  }
}

// Oráculo espacial independente: percorre a reta entre os cantos no mundo e
// volta aos eixos locais de cada peça. A normal é a linha entre os dois centros.
let seams = 0;
for (let direction = 0; direction < 6; direction++) {
  for (let rotationA = 0; rotationA < 6; rotationA++) for (let rotationB = 0; rotationB < 6; rotationB++) {
    const [dq, dr] = DIRS[direction];
    const q = 6, r = 6, centerA = hexToWorld(q, r), centerB = hexToWorld(q + dq, r + dr);
    const nx = (centerB.x - centerA.x) / Math.sqrt(3), nz = (centerB.z - centerA.z) / Math.sqrt(3);
    const sideA = (direction - rotationA + 6) % 6, sideB = (direction + 3 - rotationB + 6) % 6;
    for (const terrain of [T.Village, T.Water, T.Rail]) {
      const a = tile([...plateau.edges], 17951), b = tile([...farm.edges], 178855335);
      a.edges[sideA] = b.edges[sideB] = terrain;
      const fixture = new Board(rules);
      fixture.placeRaw(q, r, a, rotationA);
      const preview = boardHill(fixture, q + dq, r + dr, b, rotationB);
      fixture.placeRaw(q + dq, r + dr, b, rotationB);
      const left = boardHill(fixture, q, r, a, rotationA)!;
      const right = boardHill(fixture, q + dq, r + dr, b, rotationB)!;
      assert.deepEqual(right, preview);
      for (let t = 0; t <= 16; t++) {
        const cross = t / 16 - .5;
        const px = (centerA.x + centerB.x) / 2 - nz * cross, pz = (centerA.z + centerB.z) / 2 + nx * cross;
        const aY = sample(left, rotationA, px - centerA.x, pz - centerA.z);
        const bY = sample(right, rotationB, px - centerB.x, pz - centerB.z);
        approx(aY, bY);
        if (terrain !== T.Village || t === 0 || t === 16) approx(aY, 0);
        else if (t >= 5 && t <= 11) assert.ok(aY > .15);
        const epsilon = 1e-4;
        const justA = sample(left, rotationA, px - nx * epsilon - centerA.x, pz - nz * epsilon - centerA.z);
        const justB = sample(right, rotationB, px + nx * epsilon - centerB.x, pz + nz * epsilon - centerB.z);
        approx((aY - justA) / epsilon, (justB - bY) / epsilon, .004);
        seams++;
      }
    }
  }
}

// Duas peças normais, exatamente como são oferecidas na semente da abertura.
// O segundo canal sobe uma margem da primeira peça mesmo com o resto da vila estável.
function opening(extra: boolean) {
  const game = new Game(42, rules), def = game.current!;
  const hand = handHill(def);
  const before = boardHill(game.board, 1, 0, def, 0)!;
  assert.equal(before.stage, 2);
  assert.ok(hillHeight(before, -.12, .48) > hillHeight(hand, -.12, .48) + .16);
  assert.ok(game.place(1, 0));
  assert.deepEqual(boardHill(game.board, 1, 0, def, 0), before);
  if (extra) {
    game.rot = 2;
    assert.ok(game.place(1, -1));
  }
  return { game, first: boardHill(game.board, 1, 0, def, 0)!, before };
}
{
  const { game, first, before } = opening(true);
  const seam = hexToWorld(0, -1);
  assert.ok(hillHeight(first, seam.x / 2, seam.z / 2) > .20);
  approx(hillHeight(before, seam.x / 2, seam.z / 2), 0);
  assert.notEqual(hillSignature(first), hillSignature(before));
  assert.deepEqual(opening(true).first, first);
  assert.deepEqual(opening(false).first, before);
  const port = game.board.ports[0], pier = boardHill(game.board, port.q, port.r, plateau, 5)!;
  approx(hillHeight(pier, .43, .18), 0);
}
console.log(`Encostas: ${seams} amostras de divisas, seis giros de cada peça, relevo na pilha, apoios, rios, vias, cais e replay conferidos`);
