// Custo das Encostas ao montar uma peça: triângulos de chão (topo e decalques) e CPU de `buildTile`, com e sem `hill`. Fora do `npm test`.
// Uso: npm run hills:custo [pecas] [tema]
import { handHill, HillProfile } from '../src/core/hills';
import { mulberry32 } from '../src/core/rng';
import { T } from '../src/core/tiles';
import { buildTile } from '../src/render/tileBuilder';
import { THEMES } from '../src/themes/themes';

const N = Number(process.argv[2] ?? 150);
const theme = THEMES.find((t) => t.id === (process.argv[3] ?? 'holanda'))!;
const rng = mulberry32(77);
const cpu = () => {
  const u = process.cpuUsage();
  return (u.user + u.system) / 1000;
};
const specs = Array.from({ length: N }, (_, i) => {
  const edges = Array.from({ length: 6 }, () => [T.Grass, T.Forest, T.Field, T.Village][Math.floor(rng() * 4)]);
  if (i % 6 === 0) edges[1] = edges[4] = T.Water;
  if (i % 11 === 0) edges[0] = edges[3] = T.Rail;
  const def = { edges, seed: 1000 + i * 7919, quest: null };
  const hill: HillProfile = handHill(def);
  // metade das peças já com divisa e patamar (encaixes iguais)
  if (i % 2) {
    hill.stage = 1 + (i % 3);
    for (let k = 0; k < 6; k++) if (edges[k] < 4 && rng() < 0.5) hill.rims[k] = 0.2 + rng() * 0.2;
    for (let k = 0; k < 6; k++) if (edges[k] < 4) hill.shoulders[k] += 0.1 * hill.stage;
  }
  return { def, hill };
});
const run = (on: boolean) => {
  let top = 0, over = 0;
  const t0 = cpu();
  for (const s of specs) {
    const b = buildTile(s.def.edges, s.def.seed, theme, { detail: Number(process.env.DETAIL ?? 0.8), houses: [], hill: on ? s.hill : undefined, hand: on ? s.hill : undefined });
    top += b.groundEnd / 9;
    over += (b.pos.length - b.groundEnd) / 9;
  }
  return { ms: cpu() - t0, top: top / N, over: over / N };
};
run(false);
run(true);
const a = run(false), b = run(true);
const f = (r: { ms: number; top: number; over: number }) => `${(r.ms / N).toFixed(2)} ms/peça, topo+lados ${r.top.toFixed(0)} tri, decalques+fundações ${r.over.toFixed(0)} tri`;
console.log(`${N} peças (${theme.id})\n  sem Encostas: ${f(a)}\n  com Encostas: ${f(b)}`);
