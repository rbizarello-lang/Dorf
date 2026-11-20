// Custo de CPU de montar uma peça do modo Relevo (`buildTile` com o campo de altura contínuo) e uma soma de verificação da geometria:
// serve para conferir que uma otimização não mexe na peça (mesma soma) e para ver quanto custa cada peça. Fora do `npm test` (mede tempo).
// Uso: npm run cpu   (CPU do processo, não relógio: não varia com a carga da máquina)
import { mulberry32 } from '../src/core/rng';
import { T } from '../src/core/tiles';
import { buildTile } from '../src/render/tileBuilder';
import { THEMES } from '../src/themes/themes';

const theme = THEMES.find((t) => t.id === 'holanda')!;
const rng = mulberry32(77);
const N = Number(process.argv[2] ?? 120);
const classic = process.argv[3] === 'classico';
const cpu = () => {
  const u = process.cpuUsage();
  return (u.user + u.system) / 1000;
};

const specs = Array.from({ length: N }, (_, i) => {
  const edges = Array.from({ length: 6 }, () => [T.Grass, T.Forest, T.Field, T.Village, T.Grass, T.Forest][Math.floor(rng() * 6)]);
  if (i % 5 === 0) edges[1] = edges[4] = T.Water;
  if (i % 7 === 0) edges[2] = T.Village;
  const h = Array.from({ length: 6 }, () => Math.floor(rng() * 3));
  for (let k = 1; k < 6; k++) h[k] = Math.max(0, Math.min(2, h[k - 1] + Math.floor(rng() * 3) - 1));
  const own = Math.min(...h);
  const loc = h.map((v) => v - own);
  const placed = h.map(() => rng() < 0.4);
  return { edges, seed: 1000 + i * 7919, own, nb: h.map((v) => v), sec: loc, placed, terrain: { h: loc, c: loc.reduce((p, v) => p + v, 0) / 6, he: loc.slice(), co: loc.map((v, k) => (loc[(k + 5) % 6] + v) / 2), world: { x: (i % 17) * 1.5, z: Math.floor(i / 17) * 1.3, rot: i % 6, seed: 42 } } };
});

let sum = 0;
let tris = 0;
const run = () => {
  let s = 0;
  for (const sp of specs) {
    const b = buildTile(sp.edges, sp.seed, theme, { detail: 0.8, houses: [], continuous: !classic, levels: classic ? undefined : { own: sp.own, nb: sp.nb, sec: sp.sec, placed: sp.placed, terrain: sp.terrain } });
    for (const a of [b.pos, b.col, b.splat, b.water]) for (let i = 0; i < a.length; i += 7) s += a[i] * (1 + (i % 13));
    tris += b.pos.length / 9;
    s += b.decos.length * 3.1 + b.decos.reduce((p, d) => p + d.x + d.z, 0);
  }
  return s;
};
run(); // aquece o JIT
tris = 0;
const t0 = cpu();
sum = run();
const ms = cpu() - t0;
console.log(`${N} peças ${classic ? 'do Clássico' : 'do Relevo'}: ${ms.toFixed(0)} ms de CPU (${(ms / N).toFixed(2)} ms por peça), ${Math.round(tris / N)} triângulos de chão por peça, soma ${sum.toFixed(6)}`);

