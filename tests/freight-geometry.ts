import assert from 'node:assert/strict';
import { CurvePath, LineCurve3, Matrix4, Mesh, Object3D, QuadraticBezierCurve3, Vector3 } from 'three/webgpu';
import type { Board } from '../src/core/board';
import { DIRS, hexToWorld, hkey, opposite } from '../src/core/hex';
import type { Port } from '../src/core/ports';
import { levelAt } from '../src/core/relief';
import { Warp, warpBuild } from '../src/render/fluid';
import type { FreightWater } from '../src/render/freightRoute';
import { HarborLayer } from '../src/render/harbors';
import { buildTile, LEVEL_STEP, waterShape, WATER_Y } from '../src/render/tileBuilder';
import type { Theme } from '../src/themes/types';

const totals = { routes: 0, samples: 0, oldSamples: 0, oldDry: 0, parts: 0, hullDry: 0, levelSeams: 0 };

function terrain(board: Board, theme: Theme, seed: number, fluid: boolean, levels: boolean) {
  const warp = fluid ? new Warp(0x2a) : null;
  const at = (x: number, z: number) => {
    const [dx, dz] = warp?.at(x, z) ?? [0, 0];
    return { x: x + dx, z: z + dz };
  };
  const height = (q: number, r: number) => levelAt(seed, q, r, (levels && theme.relief?.levels) || 0);
  const widths = new Map<number, number[]>();
  const water = new Map<number, FreightWater>();
  for (const p of board.list) {
    const local = waterShape(p.def.edges, p.def.seed).widths;
    const aligned = local.map((original, i) => {
      const side = (i + p.rot) % 6, [dq, dr] = DIRS[side];
      return original > 0 ? (widths.get(hkey(p.q + dq, p.r + dr))?.[opposite(side)] || original) : 0;
    });
    if (!aligned.some(Boolean)) continue;
    widths.set(p.key, aligned.map((_, i) => aligned[(i - p.rot + 6) % 6]));
    const { x, z } = hexToWorld(p.q, p.r);
    const own = height(p.q, p.r);
    const nb = DIRS.map((_, i) => {
      const [dq, dr] = DIRS[(i + p.rot) % 6];
      return height(p.q + dq, p.r + dr);
    });
    const matrix = new Matrix4().makeRotationY((-p.rot * Math.PI) / 3).setPosition(x, own * LEVEL_STEP, z);
    const built = buildTile(p.def.edges, p.def.seed, theme, {
      detail: 0.4, houses: [], continuous: fluid, special: p.def.special, widths: aligned,
      levels: levels ? { own, nb } : undefined,
    });
    const b = warp ? warpBuild(built, matrix.elements, warp) : built;
    const world = new Float32Array(b.water.length);
    const vec = new Vector3();
    for (let i = 0; i < world.length; i += 3) vec.fromArray(b.water, i).applyMatrix4(matrix).toArray(world, i);
    water.set(p.key, { pos: world, bed: b.wbed, start: 0, count: world.length / 3 });
  }
  return { at, height, water };
}

// O oráculo usa o sinal das três arestas e interpola a profundidade do leito.
function wet({ pos, bed }: FreightWater, x: number, z: number) {
  const edge = (a: number, b: number) => (pos[a] - x) * (pos[b + 2] - z) - (pos[b] - x) * (pos[a + 2] - z);
  for (let i = 0; i < pos.length; i += 9) {
    const a = edge(i + 3, i + 6), b = edge(i + 6, i), c = edge(i, i + 3), sum = a + b + c;
    if (Math.abs(sum) < 1e-9 || Math.min(a / sum, b / sum, c / sum) < -1e-6) continue;
    const k = (i / 3) * 4 + 3;
    if ((a * bed[k] + b * bed[k + 4] + c * bed[k + 8]) / sum >= 0) return true;
  }
  return false;
}

export function auditFreight(board: Board, port: Port, theme: Theme, seed: number, fluid: boolean, levels: boolean) {
  const { at, height, water } = terrain(board, theme, seed, fluid, levels);
  const mill = board.ports[1];
  const from = board.rules.freight === 'madeira' && port.id === 0 ? [mill.q, mill.r] as const : undefined;
  const path = board.riverPath(port.q, port.r, from);
  const context = [theme.id, board.rules.layout, board.rules.freight, seed, port.id, fluid, levels].join('/');
  const tiles = path.map(([q, r]) => ({ ...hexToWorld(q, r), w: water.get(hkey(q, r))! }));
  const inside = (x: number, z: number) => tiles.some(({ x: cx, z: cz, w }) => Math.abs(x - cx) < 1.4 && Math.abs(z - cz) < 1.4 && wet(w, x, z));

  const legacy = new CurvePath<Vector3>();
  const centers = path.map(([q, r]) => {
    const world = hexToWorld(q, r), p = at(world.x, world.z);
    return new Vector3(p.x, height(q, r) * LEVEL_STEP + WATER_Y + 0.053, p.z);
  });
  let prev = centers[0];
  for (let i = 1; i < centers.length - 1; i++) {
    const center = centers[i], enter = center.clone().lerp(centers[i - 1], 0.19), leave = center.clone().lerp(centers[i + 1], 0.19);
    legacy.add(new LineCurve3(prev, enter));
    legacy.add(new QuadraticBezierCurve3(enter, center, leave));
    prev = leave;
  }
  legacy.add(new LineCurve3(prev, centers.at(-1)!));
  const count = Math.ceil(legacy.getLength() / 0.02);
  let oldDry = 0;
  for (let i = 0; i <= count; i++) {
    const { x, z } = legacy.getPoint(i / count);
    if (!inside(x, z)) oldDry++;
  }

  const scene = new Object3D(), layer = new HarborLayer(scene);
  const [lq, lr] = path.at(-1)!;
  let settled = false;
  const launch = () => layer.depart(board, port, (q, r) => settled || q !== lq || r !== lr ? water.get(hkey(q, r)) : undefined, at);
  launch();
  layer.tick(0.5);
  assert.equal(scene.children.length, 0, 'A barca aguarda a peça que ainda cai');
  settled = true;
  const run = (audit: boolean) => {
    const actual: number[][] = [];
    let last: Vector3 | undefined;
    for (let i = 0; i < 1500; i++) {
      layer.tick(0.008);
      const boat = scene.children[0] as Mesh | undefined;
      if (!boat && actual.length) break;
      if (!boat) continue;
      if (!boat.visible) continue;
      const { x, y, z } = boat.position;
      actual.push([x, y, z, boat.rotation.y]);
      if (audit) {
        totals.samples++;
        assert.ok(inside(x, z), context + ': centro fora da água em ' + [x, z]);
        if (last && Math.abs(y - last.y) > 0.015) totals.levelSeams++;
        last = boat.position.clone();
        // Projeção da proa, popa e laterais do casco.
        const angle = boat.rotation.y;
        const hull = Array.from({ length: 16 }, (_, j) => [0.11 * boat.scale.x * Math.sin(j * Math.PI / 8), 0.23 * boat.scale.z * Math.cos(j * Math.PI / 8)]);
        for (const [a, b] of hull) {
          totals.parts++;
          if (!inside(x + a * Math.cos(angle) + b * Math.sin(angle), z - a * Math.sin(angle) + b * Math.cos(angle))) {
            totals.hullDry++;

          }
        }
      }
    }
    assert.ok(actual.length > 15, context + ': a viagem inteira deve aparecer');
    assert.equal(scene.children.length, 0, 'A barca saiu de cena após chegar');
    assert.ok(Math.hypot(actual[0][0] - centers[0].x, actual[0][2] - centers[0].z) < 0.6, context + ': zarpou da origem');
    assert.ok(Math.hypot(actual.at(-1)![0] - centers.at(-1)!.x, actual.at(-1)![2] - centers.at(-1)!.z) < 0.6, context + ': chegou ao destino');
    return actual;
  };
  const actual = run(true);
  launch();
  assert.deepEqual(run(false), actual, context + ': determinismo em posições, cotas e rumo');
  if (seed === 8 && board.rules.layout === 'forquilha' && theme.id === 'holanda' && !fluid && !levels && port.id === 2) {
    assert.ok(oldDry > 0, 'O Estaleiro da semente 8 reproduz a regressão com a rota anterior');
    console.log('Estaleiro / Rio bifurcado / semente 8: anterior fora em', oldDry, '/', count + 1, 'novo em 0 /', actual.length);
  }
  totals.routes++;
  totals.oldDry += oldDry;
  totals.oldSamples += count + 1;
}

export function reportFreightGeometry() {
  console.log('Trajeto geométrico das barcas:', totals);
}
