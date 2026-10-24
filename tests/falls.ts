// Cachoeiras (R3): cada metade (lábio e lâmina na peça alta, espuma na baixa) sai só dos níveis, na orientação de origem,
// e a peça sem degrau de rio sai como sempre. Só a geometria: nada daqui entra no replay.
import { edgeMid, INR } from '../src/core/hex';
import { T } from '../src/core/tiles';
import { FALL_D } from '../src/render/relief';
import { buildTile, LEVEL_STEP, WATER_Y, waterShape } from '../src/render/tileBuilder';
import { THEMES } from '../src/themes/themes';

let fails = 0;
const ok = (c: boolean, msg: string) => {
  if (!c) {
    fails++;
    console.error('FALHOU:', msg);
  }
};
const same = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length === b.length && Array.prototype.every.call(a, (v: number, i: number) => v === b[i]);

const W = T.Water, G = T.Grass;
// Holanda: sem patamares alagados (esses somam água em outras alturas na mesma malha).
const theme = THEMES.find((t) => t.id === 'holanda')!;
const edges = [W, G, G, W, G, G];
const base = { detail: 0.4, houses: [] };

for (const seed of [11, 123, 4242, 99999]) {
  const flat = buildTile(edges, seed, theme, base);
  ok(flat.fall.pos.length === 0 && flat.foam.pos.length === 0 && flat.falls.length === 0, `sem níveis, sem queda (${seed})`);
  // Peça alta sem degrau de rio (vizinhas do rio no mesmo nível): idêntica à plana.
  const level = buildTile(edges, seed, theme, { ...base, levels: { own: 1, nb: [1, 0, 1, 1, 1, 1] } });
  ok(level.fall.pos.length === 0 && level.falls.length === 0, `degrau fora do rio não cria queda (${seed})`);

  // Peça alta: o rio sai pela borda 3 para uma casa 1 nível abaixo.
  const hi = buildTile(edges, seed, theme, { ...base, levels: { own: 1, nb: [1, 1, 1, 0, 1, 1] } });
  const drop = LEVEL_STEP;
  ok(hi.falls.length === 6, `uma queda (${seed})`);
  ok(Math.abs(hi.falls[5] - drop) < 1e-9, 'altura da queda = degrau');
  const [mx, mz] = edgeMid(3);
  ok(Math.abs(hi.falls[0] - mx) < 1e-9 && Math.abs(hi.falls[1] - mz) < 1e-9, 'o lábio está no meio da borda');
  const Wf = hi.falls[4];
  const w = waterShape(edges, seed).widths[3];
  ok(Math.abs(Wf - (w + 0.012)) < 1e-9, 'a lâmina tem a largura do rio na borda');
  // Todos os vértices da lâmina: dentro da largura, saindo da borda para fora (até FALL_D) e nunca acima da água.
  const nx = mx / INR, nz = mz / INR;
  let minY = Infinity, maxY = -Infinity, maxOut = -Infinity, maxSide = 0;
  for (let i = 0; i < hi.fall.pos.length; i += 3) {
    const x = hi.fall.pos[i], y = hi.fall.pos[i + 1], z = hi.fall.pos[i + 2];
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    maxOut = Math.max(maxOut, (x - mx) * nx + (z - mz) * nz);
    maxSide = Math.max(maxSide, Math.abs((x - mx) * -nz + (z - mz) * nx));
  }
  ok(maxY < WATER_Y, `a lâmina começa sob a linha d'água da peça (${maxY})`);
  ok(Math.abs(maxOut - FALL_D) < 1e-6, 'a lâmina avança FALL_D além da borda');
  ok(maxSide <= Wf * 1.04 + 1e-6, 'a lâmina não passa da largura do rio');
  // Vai até o nível da vizinha (água dela = WATER_Y - drop) e segue até o chão do mundo.
  ok(minY < WATER_Y - drop, 'a lâmina chega ao nível da vizinha');
  ok(hi.fall.nrm.length === hi.fall.pos.length && hi.fall.dat.length / 4 === hi.fall.pos.length / 3, 'atributos da lâmina alinhados');
  // Normais viradas para fora e para cima (nunca para dentro da peça).
  let inward = 0;
  for (let i = 0; i < hi.fall.nrm.length; i += 3) if (hi.fall.nrm[i] * nx + hi.fall.nrm[i + 2] * nz < -1e-6) inward++;
  ok(inward === 0, 'normais da lâmina para fora');
  // Determinismo: a mesma peça sai igual.
  const hi2 = buildTile(edges, seed, theme, { ...base, levels: { own: 1, nb: [1, 1, 1, 0, 1, 1] } });
  ok(same(hi.fall.pos, hi2.fall.pos) && same(hi.pos, hi2.pos) && same(hi.water, hi2.water), 'a peça alta é determinística');
  // O rio não desce em rampa: a água fica em WATER_Y em toda a peça.
  ok(hi.water.length > 0 && Array.prototype.every.call(hi.water, (v: number, i: number) => i % 3 !== 1 || v === Math.fround(WATER_Y)), 'a água da peça alta é plana');

  // Peça baixa: o rio entra pela borda 3 vindo de uma casa mais alta; só a espuma, na água dela.
  const lo = buildTile(edges, seed, theme, { ...base, levels: { own: 0, nb: [0, 0, 0, 1, 0, 0] } });
  ok(lo.fall.pos.length === 0 && lo.falls.length === 0, 'a peça baixa não tem lâmina');
  ok(lo.foam.pos.length === 18, `a peça baixa tem o anel de espuma (${seed})`);
  for (let i = 0; i < lo.foam.pos.length; i += 3) {
    const x = lo.foam.pos[i], z = lo.foam.pos[i + 2];
    ok(lo.foam.pos[i + 1] > WATER_Y, 'a espuma fica sobre a água');
    ok((x * nx + z * nz) <= INR + 1e-6, 'a espuma não passa da borda');
  }
  // A peça no nível 0 sem diferença de nível sai idêntica à plana (a pilha e a galeria não mudam).
  const flat0 = buildTile(edges, seed, theme, { ...base, levels: { own: 0, nb: [0, 0, 0, 0, 0, 0] } });
  ok(same(flat0.pos, flat.pos) && same(flat0.water, flat.water) && flat0.fall.pos.length === 0 && flat0.foam.pos.length === 0, 'nível 0 sem degrau = peça plana');
  // Nas duas metades, a largura que o rio tem na borda é a mesma (a emenda casa).
  const loW = lo.foam.dat[2];
  ok(Math.abs(loW - Wf) < 1e-6, 'a espuma tem a mesma largura da lâmina');
}

if (fails) {
  console.error(`${fails} falhas`);
  process.exit(1);
}
console.log('cachoeiras ok');
