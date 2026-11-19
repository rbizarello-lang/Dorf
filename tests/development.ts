import assert from 'node:assert/strict';
import { Board, DEFAULT_RULES } from '../src/core/board';
import { DIRS, opposite } from '../src/core/hex';
import { developmentAt, previewDevelopment } from '../src/core/development';
import { T, type TileDef } from '../src/core/tiles';

const tile = (terrain: T, edges: T[] = Array<T>(6).fill(terrain)): TileDef => ({ edges, seed: 1, quest: null });

function boardWithSupports(terrain: T, count: number) {
  const board = new Board({ ...DEFAULT_RULES });
  board.placeRaw(0, 0, tile(terrain), 0);
  for (let side = 0; side < count; side++) {
    const [dq, dr] = DIRS[side];
    const edges = Array<T>(6).fill(T.Grass);
    edges[opposite(side)] = terrain;
    board.placeRaw(dq, dr, tile(T.Grass, edges), 0);
  }
  return board;
}

for (const terrain of [T.Village, T.Forest, T.Field, T.Water]) {
  const labels = ['sem encaixes', 'um encaixe', 'dois encaixes', 'três encaixes'];
  for (let count = 0; count <= 3; count++) {
    const board = boardWithSupports(terrain, count);
    const dev = developmentAt(board, 0, 0);
    assert.deepEqual(dev.supports, Array<number>(6).fill(count), `${T[terrain]}: suportes por setor (${labels[count]})`);
    assert.deepEqual(dev.levels, Array<number>(6).fill(count), `${T[terrain]}: estágio por setor (${labels[count]})`);
    assert.ok(dev.levels.every((level) => level >= 0 && level <= 3), 'estágio fica no intervalo 0..3');
  }
}

// Terrenos diferentes não dão suporte visual; a prévia não altera o tabuleiro.
{
  const board = new Board({ ...DEFAULT_RULES });
  board.placeRaw(0, 0, tile(T.Forest), 0);
  const mismatch = Array<T>(6).fill(T.Grass);
  mismatch[opposite(0)] = T.Field;
  board.placeRaw(1, 0, tile(T.Grass, mismatch), 0);
  assert.deepEqual(developmentAt(board, 0, 0), { levels: Array(6).fill(0), supports: Array(6).fill(0) });
}

// A peça nova amadurece e eleva apenas o vizinho cujo terreno encaixou.
{
  const board = new Board({ ...DEFAULT_RULES });
  const existing = board.placeRaw(0, 0, tile(T.Water, [T.Water, T.Grass, T.Grass, T.Grass, T.Grass, T.Grass]), 0);
  const candidate = [T.Field, T.Field, T.Field, T.Water, T.Field, T.Field];
  const before = JSON.stringify({ list: board.list, edges: existing.edges, frontier: [...board.frontier], score: board.score, ports: board.ports });
  const preview = previewDevelopment(board, 1, 0, candidate);
  assert.deepEqual(preview.placed.before.levels, Array(6).fill(0));
  assert.equal(preview.placed.after.supports[3], 1);
  assert.equal(preview.placed.after.levels[3], 1);
  assert.equal(preview.neighbors.length, 1);
  assert.deepEqual(preview.neighbors[0].before.levels, Array(6).fill(0));
  assert.deepEqual(preview.neighbors[0].after.levels, [1, 0, 0, 0, 0, 0]);
  assert.equal(JSON.stringify({ list: board.list, edges: existing.edges, frontier: [...board.frontier], score: board.score, ports: board.ports }), before);
  assert.deepEqual(previewDevelopment(board, 1, 0, candidate), preview, 'a prévia é determinística');

  const replay = new Board({ ...DEFAULT_RULES });
  replay.placeRaw(0, 0, tile(T.Water, [T.Water, T.Grass, T.Grass, T.Grass, T.Grass, T.Grass]), 0);
  replay.placeRaw(1, 0, tile(T.Water, candidate), 0);
  assert.deepEqual(developmentAt(replay, 1, 0), preview.placed.after, 'replay reproduz o estágio da peça nova');
  assert.deepEqual(developmentAt(replay, 0, 0), preview.neighbors[0].after, 'replay reproduz a maturação do vizinho');
}

// Quatro encaixes continuam no estágio máximo.
{
  const board = boardWithSupports(T.Forest, 4);
  const development = developmentAt(board, 0, 0);
  assert.ok(development.levels.every((level) => level === 3));
  assert.ok(development.supports.every((support) => support === 4));
}

console.log('Desenvolvimento: terrenos, estágios, prévia, imutabilidade e replay passaram');

import * as THREE from 'three/webgpu';
import { LivingLandscape } from '../src/render/developmentView';
import { developBuild } from '../src/render/developmentBuild';
import { buildTile } from '../src/render/tileBuilder';
import type { Lib } from '../src/render/lib';
import { themeById } from '../src/themes/themes';

const riviera = themeById('riviera');
const houses = riviera.houses.map(() => ({ h: 0.11, top: 0.2, chimney: null }));
for (const terrain of [T.Forest, T.Field, T.Village]) {
  const edges = Array<T>(6).fill(terrain);
  const atStage = (stage: number) => {
    const built = buildTile(edges, 42, riviera, { detail: 1.6, houses });
    developBuild(built, edges, [stage, stage, stage, stage, stage, stage]);
    return built.decos.map(({ key,x,z,sx,sy,sz }) => [key,x,z,sx,sy,sz]);
  };
  for (let level=1; level<=3; level++) {
    assert.notDeepEqual(atStage(level), atStage(level-1), 'cada estágio muda a geometria visível');
    assert.deepEqual(atStage(level), atStage(level), 'repetir a semente recompõe a decoração');
  }
}

// O mapa já mudou enquanto a primeira peça estava no ar. Assentar mantém a assinatura que gerou a malha.
{
  const board = boardWithSupports(T.Forest, 1);
  const p = board.list[0], scene = new THREE.Group(), ground = new THREE.MeshBasicMaterial();
  const landscape = new LivingLandscape({ ground } as Lib, scene, () => 0);
  const geometry = { pos: new Float32Array(9), col: new Float32Array(9), splat: new Float32Array(12),
    water: new Float32Array(), wflow: new Float32Array(), wbed: new Float32Array(), decos: [], chimneys: [] };
  let rebuilt = 0;
  landscape.add(p, geometry, '0');
  for (let twice=0; twice<2; twice++) landscape.sync([p.key], () => '1', () => { rebuilt++; return geometry; });
  assert.equal(rebuilt, 1);
  for (const other of board.list.slice(1)) landscape.add(other, geometry, '1');
  const visited: number[] = [];
  landscape.sync([p.key], (changed) => { visited.push(changed.key); return '1'; }, () => geometry);
  assert.deepEqual(visited, [p.key], 'as casas distantes não são consultadas');
  landscape.dispose(); ground.dispose();
  assert.equal(scene.children.length, 0);
}
console.log('Paisagem: três estágios físicos por terreno, repetição, queda sobreposta e atualização local passaram');

// Exercita o cálculo usado pelo render antes de criar câmera, canvas ou dispositivo gráfico.
Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('http://localhost/') });
const { World } = await import('../src/render/world');
function sharedWaterWidths() {
  const board = new Board({ ...DEFAULT_RULES, infinite: true });
  const model = Object.assign(Object.create(World.prototype), { board, livingEnabled: true, widths: new Map(), flows: new Map() });
  const measures: number[] = [];
  for (const [q, r, rot] of [[0, 0, 2], [1, 0, 4], [0, 1, 3], [1, -1, 5]]) {
    const placed = board.placeRaw(q, r, { ...tile(T.Water), seed: 63 + rot }, rot);
    model.settleWidths(placed);
    for (const p of board.list) for (let side = 0; side < 6; side++) {
      const [dq, dr] = DIRS[side], neighbor = board.get(p.q + dq, p.r + dr);
      if (!neighbor) continue;
      const width = (item: typeof placed, edge: number): number => {
        const base = model.settleWidths(item);
        const expanded = model.developmentOptions(item.q, item.r, item.def, item.rot, base);
        return expanded.widths[(edge + 6 - item.rot) % 6];
      };
      const own = width(p, side);
      assert.equal(own, width(neighbor, opposite(side)), 'as duas bocas da fronteira devem casar');
      if (p.q === 0 && p.r === 0 && side === 0) measures.push(own);
    }
  }
  assert.ok(measures[1] > measures[0] && measures[2] > measures[1], 'o canal alarga nos três estágios');
  return measures;
}
assert.deepEqual(sharedWaterWidths(), sharedWaterWidths(), 'reconstruir a sequência reproduz as larguras');
console.log('Água: larguras compartilhadas, rotações, estágios e reconstrução passaram');

import { Game } from '../src/core/game';
import { RIDGE_LOTS, ridgeSection, ridgeSnapshot } from '../src/core/ridge';
import { hexToWorld } from '../src/core/hex';

{
  const rules = { ...DEFAULT_RULES, riverTrade:true, layout:'crista' as const };
  const game = new Game(42,rules), before=ridgeSnapshot(game.board);
  assert.deepEqual(before.map(p=>p.stage),[1,2,1]);
  assert.ok(game.check(1,0)?.valid);
  const preview = previewDevelopment(game.board,1,0,game.currentEdges()!);
  assert.deepEqual(ridgeSnapshot(game.board),before);
  assert.ok(game.place(1,0));
  const after=ridgeSnapshot(game.board);
  assert.deepEqual(after.map(p=>p.stage),[1,3,2]);
  for (const i of [1,2]) {
    const p=after[i];
    assert.equal(p.buildings.length,before[i].buildings.length+1);
    assert.deepEqual(p.buildings.slice(0,-1),before[i].buildings);
    assert.deepEqual(preview.neighbors.find(n=>n.q===p.q && n.r===p.r)?.after,
      developmentAt(game.board,p.q,p.r));
  }
  const replay=new Game(42,rules);
  assert.deepEqual(ridgeSnapshot(replay.board),before);
  replay.place(1,0);
  assert.deepEqual(ridgeSnapshot(replay.board),after);
  for (let i=0;i<RIDGE_LOTS.length-1;i++) {
    const a=ridgeSection(i,1), b=ridgeSection(i+1,0);
    const left=hexToWorld(RIDGE_LOTS[i].q,RIDGE_LOTS[i].r);
    const right=hexToWorld(RIDGE_LOTS[i+1].q,RIDGE_LOTS[i+1].r);
    for(const v of [-1.34,-.64,.22,.74,1.33]) {
      assert.ok(Math.abs(left.x+a.x+a.nx*a.width*v-right.x-b.x-b.nx*b.width*v)<1e-9);
      assert.ok(Math.abs(left.z+a.z+a.nz*a.width*v-right.z-b.z-b.nz*b.width*v)<1e-9);
    }
    assert.equal(a.height,b.height);
  }
  console.log('Crista: dois bairros previstos, casas preservadas, emendas e reconstrução passaram');
}
