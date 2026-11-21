import assert from 'node:assert/strict';
import { villageAccess, type VillageLane } from '../src/render/villageAccess';

const lane: VillageLane = { from: [0, 0], to: [0.6, 0], halfWidth: 0.042 };
// Pisos planos com dois trechos levantados numa passagem curta.
const height = (x: number) => Math.max(0, Math.min(0.07, (x - 0.16) * 0.47));
const free = () => true;
const plan = villageAccess([lane], height, free);
assert.ok(plan, 'uma rua livre com dois pisos deve ganhar acesso');
assert.deepEqual(villageAccess([lane], height, free), plan, 'mesma rua e relevo dão a mesma escada');
assert.equal(villageAccess([lane], () => 0.2, free), null, 'plano não precisa de escada');
assert.equal(villageAccess([lane], x => height(x) * 3, free), null, 'desnível alto demais');
assert.equal(villageAccess([lane], height, x => x < 0.21 || x > 0.24), null, 'obstáculo na passagem');
assert.equal(villageAccess([lane], height, (_, z) => z > -0.01), null, 'um lado da passagem está bloqueado');
assert.equal(villageAccess([lane], height, x => x < 0.32), null, 'o patamar alto fica fora do piso livre');

const reversed = villageAccess([{ ...lane, from: lane.to, to: lane.from }], height, free);
assert.ok(reversed && reversed.along[0] > 0, 'a escada sobe mesmo com a rua em ordem inversa');
for (const stair of [plan, reversed]) {
  const first = stair.treads[0];
  const last = stair.treads[stair.treads.length - 1];
  const low = height(stair.from[0]);
  const high = height(stair.from[0] + stair.along[0] * last.end);
  assert.ok(first.y > low && first.y - low < 0.044, 'entrada a um degrau do primeiro piso');
  assert.ok(Math.abs(last.y - high) < 0.01, 'último piso toca o patamar alto');
  assert.ok(stair.halfWidth <= lane.halfWidth);
  for (let i = 1; i < stair.treads.length; i++) {
    const prev = stair.treads[i - 1], next = stair.treads[i];
    assert.ok(next.y > prev.y && Math.abs(next.start - prev.end) < 1e-9, 'degraus contínuos em altura crescente');
  }
}
console.log('acessos da vila: pisos, continuidade, obstáculos e determinismo conferidos');
