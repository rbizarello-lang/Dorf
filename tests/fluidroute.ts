// Barcos no encaixe fluido: a água foi desenhada deslocada por uma função do mundo (`Warp`), então o caminho do barco leva o mesmo
// deslocamento (`warpPath`). Confere, por peça de rio de 2 bordas, que o caminho deslocado fica sobre a malha da água deslocada, e que o
// caminho do hexágono (sem deslocar) sai dela. Só geometria: nada daqui entra no replay.
import { DIRS, edgeMid, hexToWorld } from '../src/core/hex';
import * as THREE from 'three/webgpu';
import { T } from '../src/core/tiles';
import { GroundMap } from '../src/render/groundMap';
import { SeaMap } from '../src/render/seaMap';
import { Warp, warpBuild, warpPath } from '../src/render/fluid';
import { buildTile } from '../src/render/tileBuilder';
import { THEMES } from '../src/themes/themes';

let fails = 0;
const ok = (c: boolean, msg: string) => {
  if (!c) {
    fails++;
    console.error('FALHOU:', msg);
  }
};

const W = T.Water, G = T.Grass;
const theme = THEMES.find((t) => t.id === 'holanda')!;
const warp = new Warp(0x2a);

/** O ponto (x, z) cai em algum triângulo da malha (vértices em coordenadas do mundo, 9 números por triângulo)? */
function inside(tris: Float32Array, ox: number, oz: number, x: number, z: number) {
  for (let t = 0; t < tris.length; t += 9) {
    const ax = tris[t] + ox, az = tris[t + 2] + oz, bx = tris[t + 3] + ox, bz = tris[t + 5] + oz, cx = tris[t + 6] + ox, cz = tris[t + 8] + oz;
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
    const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
    if (u >= 0 && v >= 0 && u + v <= 1) return true;
  }
  return false;
}

// Pares de bordas de rio: opostas, a 120° e vizinhas (o caminho do barco é a curva da borda A à B pelo centro).
const pairs: [number, number][] = [[0, 3], [1, 4], [0, 2], [1, 5], [0, 1], [3, 4]];
let within = 0, without = 0, total = 0;
for (const [si, seed] of [11, 123, 4242, 99999, 31337, 7, 2024, 555, 8, 9, 10, 12].entries()) {
  for (const [a, b] of pairs) {
    const edges = [G, G, G, G, G, G];
    edges[a] = W;
    edges[b] = W;
    const { x: cx, z: cz } = hexToWorld((si * 5) % 11 - 5, (si * 7) % 9 - 4);
    const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, cx, 0, cz, 1];
    const built = warpBuild(buildTile(edges, seed, theme, { detail: 0.4, houses: [], continuous: true }), m, warp);
    if (!built.water.length) continue;
    const [A, B] = [edgeMid(a), edgeMid(b)];
    const raw: [number, number][] = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16, u = 1 - t;
      raw.push([u * u * A[0] + t * t * B[0], u * u * A[1] + t * t * B[1]]);
    }
    const bent = warpPath(raw, cx, cz, warp);
    ok(bent.length >= raw.length, 'o caminho deslocado não perde pontos');
    // Só os pontos do miolo (a ponta de cada borda é a emenda com a vizinha, onde a malha desta peça acaba).
    for (const [x, z] of bent.slice(2, -2)) {
      total++;
      if (inside(built.water, cx, cz, cx + x, cz + z)) within++;
    }
    for (const [x, z] of raw.slice(2, -2)) if (!inside(built.water, cx, cz, cx + x, cz + z)) without++;
  }
}
console.log(`caminhos do barco sobre a água: deslocado ${within}/${total} (${((within / total) * 100).toFixed(1)}%), sem deslocar fora dela em ${without}`);
// Sem o deslocamento o barco sai da água no dobro dos pontos (ou mais); com ele, quase todos ficam sobre a água.
ok(within / total > 0.9, `o caminho deslocado fica sobre a água (${within}/${total})`);
ok(without >= 2 * (total - within), `sem deslocar o barco sai da água bem mais (${without} contra ${total - within} pontos): o teste distingue`);

// A emenda: o ponto da borda é o mesmo visto das duas peças (a função do deslocamento é do mundo).
{
  const a = hexToWorld(0, 0), b = hexToWorld(DIRS[0][0], DIRS[0][1]);
  const [mx, mz] = edgeMid(0);
  const pa = warpPath([[mx, mz]], a.x, a.z, warp)[0];
  const pb = warpPath([[-mx, -mz]], b.x, b.z, warp)[0];
  ok(Math.abs(a.x + pa[0] - (b.x + pb[0])) < 1e-9 && Math.abs(a.z + pa[1] - (b.z + pb[1])) < 1e-9, 'a borda comum tem o mesmo ponto deslocado nas duas peças');
}

// Pré-visualização no mapa do chão (fantasma e queda): pinta como o `add`, e `unpreview` devolve tudo, mesmo com duas sobrepostas.
{
  const color = new THREE.Color('#3a7bd5');
  const tile = (q: number, r: number, seed: number) => {
    const { x, z } = hexToWorld(q, r);
    const m = new THREE.Matrix4().makeRotationY((-2 * Math.PI) / 3).setPosition(x, 0, z);
    const b = warpBuild(buildTile([G, W, G, G, W, G], seed, theme, { detail: 0.4, houses: [], continuous: true }), m.elements, warp);
    return { b, m };
  };
  const snap = (g: GroundMap) => [g.data, g.cover, g.height, g.land, g.relief].map((a) => a.slice() as Uint8Array | Uint16Array);
  const same = (g: GroundMap, s: ReturnType<typeof snap>) => [g.data, g.cover, g.height, g.land, g.relief].every((a, i) => a.every((v, k) => v === s[i][k]));
  const [A, B, C] = [tile(0, 0, 11), tile(1, 0, 22), tile(0, 1, 33)];
  const g = new GroundMap();
  g.add(A.b, A.m, color);
  const base = snap(g);
  g.preview(B.b, B.m, color);
  const covered = g.cover.reduce((n, v) => n + (v ? 1 : 0), 0);
  ok(covered > base[1].reduce((n, v) => n + (v ? 1 : 0), 0), 'a pré-visualização cobre texels novos');
  // O resultado da pré-visualização é o do `add` de verdade.
  const ref = new GroundMap();
  ref.add(A.b, A.m, color);
  ref.add(B.b, B.m, color);
  ok(same(ref, snap(g)), 'preview pinta como add');
  g.preview(C.b, C.m, color);
  g.unpreview();
  ok(same(g, base), 'unpreview devolve o mapa como era, com duas pré-visualizações sobrepostas');
  g.unpreview();
  ok(same(g, base), 'unpreview sem nada empilhado não muda o mapa');
  // Depois de pintar de verdade, a devolução antiga não pode desfazer o que foi pintado: quem chama desfaz antes (World.bake).
  g.preview(B.b, B.m, color);
  g.unpreview();
  g.add(B.b, B.m, color);
  ok(same(ref, snap(g)), 'desfazer a pré-visualização e pintar de verdade dá o mesmo que pintar direto');

  const sea = new SeaMap();
  sea.add(0, 0, 0, (x, z) => warp.inverse(x, z));
  const seaBase = sea.data.slice();
  sea.preview(1, 0, 0.2, (x, z) => warp.inverse(x, z));
  ok(sea.data.some((v, i) => v !== seaBase[i]), 'o mar muda com a pré-visualização');
  sea.preview(0, 1, 0, (x, z) => warp.inverse(x, z));
  sea.unpreview();
  ok(sea.data.every((v, i) => v === seaBase[i]), 'o mar volta como era');
}

if (fails) {
  console.error(`${fails} falha(s) em tests/fluidroute.ts`);
  process.exit(1);
}
console.log('fluidroute: ok');
