// Contorno físico, textura da orla e boca de rio das casas vazias do Relevo e da Terra.
import assert from 'node:assert/strict';
import { corner, DIRS, edgeMid, hexToWorld, hkey, INR, worldToHex } from '../src/core/hex';
import { T } from '../src/core/tiles';
import { BAY_RADIUS, bayBlend, bayMouth, bayWaterDistance } from '../src/render/bay';
import { Warp } from '../src/render/fluid';
import { GROUND_EXTENT } from '../src/render/groundMap';
import { SeaMap, SEA_SIZE } from '../src/render/seaMap';
import { buildTile } from '../src/render/tileBuilder';
import { themeById } from '../src/themes/themes';

const ring = new Set(DIRS.map(([q, r]) => hkey(q, r)));
const occupied = (q: number, r: number) => ring.has(hkey(q, r));
assert.equal(bayMouth(0, 0, occupied), -1);
for (let side = 0; side < 6; side++) {
  const mouth = hkey(...DIRS[side]);
  const second = hkey(...DIRS[(side + 1) % 6]);
  ring.delete(mouth);
  assert.equal(bayMouth(0, 0, occupied), side);
  const [mx, mz] = edgeMid(side);
  assert(bayBlend(side, mx * 0.7, mz * 0.7) > 0, 'A transição precisa alcançar o canal');
  assert.equal(bayBlend(side, mx, mz), 0, 'A curva passou da boca para a orla');
  assert(bayWaterDistance(side, mx * 0.7, mz * 0.7) > 0, 'O canal virou uma faixa de areia');
  assert.equal(bayWaterDistance(-1, mx * 0.7, mz * 0.7), 0, 'A baía fechada não tem canal');
  ring.delete(second);
  assert.equal(bayMouth(0, 0, occupied), undefined);
  ring.add(mouth).add(second);
}
ring.add(hkey(0, 0));
assert.equal(bayMouth(0, 0, occupied), undefined);

const theme = themeById('holanda');
const terrain = Array<T>(6).fill(T.Meadow);
const opts = { detail: 0.65, houses: [], skirt: [true, false, false, false, false, false] };
const open = buildTile(terrain, 37, theme, opts);
const round = buildTile(terrain, 37, theme, { ...opts, bay: [-1] });
const [mx, mz] = edgeMid(0);
const arc: [number, number][] = [];
for (let i = 0; i < round.groundEnd; i += 3) {
  const x = round.pos[i], z = round.pos[i + 2];
  if (x * mx + z * mz <= INR ** 2 + 1e-5) continue;
  const r = Math.hypot(x - 2 * mx, z - 2 * mz);
  assert(r >= BAY_RADIUS - 1e-5, 'A saia entrou na região circular do vazio');
  if (Math.abs(r - BAY_RADIUS) < 1e-5) arc.push([x, z]);
}
assert(new Set(arc.map(([x, z]) => `${x},${z}`)).size >= 5, 'Faltaram vértices no arco da saia');
for (const end of [corner(0), corner(1)]) {
  const x = end[0] - 2 * mx, z = end[1] - 2 * mz;
  assert(arc.some(([px, pz]) => Math.hypot(px - 2 * mx - x * BAY_RADIUS, pz - 2 * mz - z * BAY_RADIUS) < 1e-5), 'A coluna do canto não termina na bissetriz compartilhada');
}
assert.notDeepEqual(round.pos, open.pos);

terrain[0] = terrain[3] = T.Water;
const water = buildTile(terrain, 37, theme, opts);
assert(water.water.length > 0);
for (const mouth of [-1, 1, 2, 3, 4, 5]) {
  const roundWater = buildTile(terrain, 37, theme, { ...opts, bay: [mouth] });
  assert.deepEqual(roundWater.water, water.water, `A película da boca de rio mudou (boca da baía ${mouth})`);
}

const map = new SeaMap();
const warp = new Warp(0x2a);
const unwarp = (x: number, z: number) => warp.inverse(x, z);
for (const [q, r] of DIRS) map.add(q, r, 0.08, unwarp);
map.flush();
const pixels = map.texture.image.data as Uint8Array;
const before = pixels.slice();
map.setBays(new Map([[hkey(0, 0), -1]]), unwarp);
map.flush();
const closed = pixels.slice();
assert.notDeepEqual(closed, before);
assert.deepEqual(map.data, before, 'O contorno não pode contaminar os carimbos do mapa do mar');
const texel = (2 * GROUND_EXTENT) / SEA_SIZE;
for (let i = 0; i < before.length; i++) {
  if (before[i] === closed[i]) continue;
  const [q, r] = worldToHex(...unwarp((i % SEA_SIZE + 0.5) * texel - GROUND_EXTENT, (Math.floor(i / SEA_SIZE) + 0.5) * texel - GROUND_EXTENT));
  assert(q === 0 && r === 0, 'A máscara vazou da casa para a orla');
}
const center = hexToWorld(0, 0);
const [dx, dz] = warp.at(center.x, center.z);
const index = Math.floor((GROUND_EXTENT + dz) / texel) * SEA_SIZE + Math.floor((GROUND_EXTENT + dx) / texel);
assert(closed[index] > 0, 'A baía sumiu antes do fantasma');
map.preview(0, 0, 0, unwarp);
map.flush();
assert.equal(pixels[index], 0, 'O fantasma não cobriu a baía');
map.unpreview();
map.flush();
assert.deepEqual(pixels, closed, 'Ao tirar o fantasma, a baía não voltou');
map.setBays(new Map(), unwarp);
map.flush();
assert.deepEqual(pixels, before);
console.log('Baías internas: cerco e boca em 6 direções, pé da saia, película de rio e textura com fantasma.');
