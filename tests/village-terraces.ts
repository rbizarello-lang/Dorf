// Prova as novas faces na malha do jogo e a cota que casas, decalques e animações leem.
import assert from 'node:assert/strict';
import { Color, DataUtils, Matrix4 } from 'three/webgpu';
import { corner, INR } from '../src/core/hex';
import type { HillProfile } from '../src/core/hills';
import { T } from '../src/core/tiles';
import { Warp, warpBuild } from '../src/render/fluid';
import { GroundMap, GROUND_EXTENT, GROUND_SIZE } from '../src/render/groundMap';
import { buildTile, railPaths } from '../src/render/tileBuilder';
import { terraceFaces } from '../src/render/villageTerraces';
import { THEMES } from '../src/themes/themes';

const close = (a: number, b: number, where: string) => assert.ok(Math.abs(a - b) < 2e-6, `${where}: ${a} × ${b}`);
const V = T.Village, G = T.Grass, F = T.Forest, W = T.Water, R = T.Rail;
const hill: HillProfile = { stage: 2, landform: 'Encosta', shoulders: [0.49, 0.46, 0.3, 0.17, 0.22, 0.24], rims: [0.31, 0, 0, 0, 0, 0] };

// Escala conhecida: em um terreno que subiria 8 cm ao atravessar o triângulo, a face concentra quase 10 cm
// numa faixa estreita. A bancada e a capa repartem o restante da projeção horizontal.
const faces = terraceFaces([0.14, 0.22, 0.14], [1, 1, 1]);
for (const kind of ['bench', 'wall', 'coping'] as const) assert.ok(faces.some((face) => face.kind === kind), `falta ${kind}`);
const wall = faces.filter((f) => f.kind === 'wall').flatMap((f) => f.points);
assert.ok(Math.max(...wall.map((p) => p.y)) - Math.min(...wall.map((p) => p.y)) > 0.095);
assert.ok(Math.max(...wall.map((p) => p.u)) - Math.min(...wall.map((p) => p.u)) < 0.13);

let points = 0, changed = 0, steepFaces = 0;
for (const theme of THEMES) {
  for (const edges of [[V, V, V, G, G, F], [V, V, W, G, R, F], [V, G, R, V, V, R]] as const) {
    const seed = 34719;
    const opts = { detail: 0.65, hill, houses: [] };
    const tile = buildTile(edges, seed, theme, opts);
    const again = buildTile(edges, seed, theme, opts);
    assert.deepEqual(tile.pos, again.pos);
    assert.deepEqual(tile.col, again.col);
    assert.deepEqual(tile.decos, again.decos);
    assert.ok(tile.hill);
    let area = 0;
    for (let i = 0; i < tile.groundEnd; i += 9) {
      const [x0, y0, z0, x1, y1, z1, x2, y2, z2] = tile.pos.subarray(i, i + 9);
      const ny = (z1 - z0) * (x2 - x0) - (x1 - x0) * (z2 - z0);
      if (Math.abs(ny) < 1e-8) continue; // Laterais da ilha, sem projeção no plano.
      assert.ok(ny > 0, 'solo com face invertida');
      area += ny * 0.5;
      const x = (x0 + x1 + x2) / 3, y = (y0 + y1 + y2) / 3, z = (z0 + z1 + z2) / 3;
      const h = tile.hill.at(x, z), base = tile.hill.at(x, z, true);
      if (y >= 0 && (Math.abs(h - base) > 1e-5 || !edges.some((t) => t === W))) {
        close(h, y, 'cota no baricentro do triângulo desenhado');
        points++;
      }
      if (Math.abs(h - base) > 0.015) {
        changed++;
        const nx = (y1 - y0) * (z2 - z0) - (z1 - z0) * (y2 - y0);
        const nz = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
        if (ny / Math.hypot(nx, ny, nz) < 0.45) steepFaces++;
      }
    }
    close(area, 3 * INR, 'área do hexágono vista de cima');
    for (let side = 0; side < 6; side++) {
      const [x0, z0] = corner(side), [x1, z1] = corner(side + 1);
      for (let i = 0; i <= 48; i++) {
        const f = i / 48, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f;
        close(tile.hill.at(x, z), tile.hill.at(x, z, true), 'emenda original');
      }
    }
    for (let i = 0; i < tile.water.length; i += 3) {
      const x = tile.water[i], z = tile.water[i + 2];
      close(tile.hill.at(x, z), tile.hill.at(x, z, true), 'leito original');
    }
    for (const { pts } of railPaths(edges, seed).paths) {
      for (let i = 1; i < pts.length; i++) {
        const [x0, z0] = pts[i - 1], [x1, z1] = pts[i];
        const d = Math.hypot(x1 - x0, z1 - z0);
        if (!d) continue;
        for (const off of [-0.10, 0, 0.10]) {
          const x = (x0 + x1) * 0.5 + off * (z1 - z0) / d, z = (z0 + z1) * 0.5 - off * (x1 - x0) / d;
          close(tile.hill.at(x, z), tile.hill.at(x, z, true), 'traçado original da via');
        }
      }
    }
    for (const d of tile.decos.filter((d) => d.key.startsWith('wall:'))) {
      const roof = tile.decos.find((r) => r.key.startsWith('roof:') && r.x === d.x && r.z === d.z);
      assert.ok(roof, 'casa sem telhado');
      close(roof.y, d.y, 'parede e telhado assentam juntos');
    }
  }
}
assert.ok(changed > 250 && steepFaces > 80, `arrimos insuficientes: ${changed} faces alteradas, ${steepFaces} íngremes`);

const tile = buildTile([V, V, V, G, G, F], 34719, THEMES[0], { detail: 0.65, hill, houses: [], continuous: true });
const map = new GroundMap(), matrix = new Matrix4();
map.add(tile, matrix, new Color());
const texel = 2 * GROUND_EXTENT / GROUND_SIZE;
let texels = 0;
for (let pz = 503; pz <= 521; pz++) {
  for (let px = 502; px <= 522; px++) {
    const x = (px + 0.5) * texel - GROUND_EXTENT, z = (pz + 0.5) * texel - GROUND_EXTENT;
    const h = tile.hill!.at(x, z), base = tile.hill!.at(x, z, true);
    if (Math.abs(h - base) < 0.015) continue;
    const index = pz * GROUND_SIZE + px;
    assert.equal(map.cover[index], 255, 'fresta na cobertura onde subiu um arrimo');
    assert.ok(Math.abs(DataUtils.fromHalfFloat(map.relief[index]) - h) < 0.001, 'mapa de alturas ignora o arrimo');
    texels++;
  }
}
assert.ok(texels > 25, 'a prova precisa alcançar os patamares no mapa de alturas');

const warp = new Warp(811);
const warped = warpBuild(tile, matrix.elements, warp);
const divisions = tile.hill!.divisions;
let perimeterArea = 0, warpArea = 0;
for (let side = 0; side < 6; side++) {
  const [ax, az] = corner(side), [bx, bz] = corner(side + 1);
  let lastX = 0, lastZ = 0;
  for (let k = 0; k <= divisions; k++) {
    const x = ax + (bx - ax) * k / divisions, z = az + (bz - az) * k / divisions;
    const [dx, dz] = warp.at(x, z);
    if (k) perimeterArea += lastX * (z + dz) - lastZ * (x + dx);
    lastX = x + dx;
    lastZ = z + dz;
  }
}
for (let i = 0; i < warped.groundEnd; i += 9) {
  const [x0, , z0, x1, , z1, x2, , z2] = warped.pos.subarray(i, i + 9);
  const ny = (z1 - z0) * (x2 - x0) - (x1 - x0) * (z2 - z0);
  assert.ok(ny > -1e-8, 'face invertida após deslocamento');
  warpArea += ny;
}
close(warpArea, perimeterArea, 'projeção do chão com encaixe fluido');
console.log(`patamares de vila ok: ${points} cotas da malha, ${steepFaces} faces íngremes e ${texels} texels conferidos; emendas, leitos e vias preservados`);
