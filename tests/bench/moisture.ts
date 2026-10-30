// Umidade (proposta F2-4, Orvalho): a água do mapa molha em volta e cada terreno gosta de uma faixa de umidade.
//
//   umidade de uma casa = max sobre as peças com água (rio ou lago) de  [1,0  0,7  0,45  0,25]  pela distância em casas (0, 1, 2, 3),
//                         0,1 além de 3;  mais 0,1 por vizinha de mata (peça com 3 ou mais bordas de mata), no máximo +0,2; teto 1.
//   faixas que cada terreno gosta:  plantação 0,5–0,8 · mata 0,4–1,0 · prado 0,2–0,6 · vila 0,1–0,4
//   pontos de uma peça = Σ sobre os terrenos dela (pelo peso de cada um na peça): 8 se a umidade cai na faixa, 11 se cai na metade do meio.
//
// Só cresce: cada peça guarda o que já pagou (`paid`) e uma peça de água ou de mata nova paga a diferença às peças que ela fez entrar na faixa.
import { T } from '../../src/core/tiles';
import type { LiteWorld, Placed } from './lite';

export const MOIST = [1.0, 0.7, 0.45, 0.25];
export const MOIST_FAR = 0.1;
export const FOREST_BOOST = 0.1;
export const BOOST_CAP = 0.2;
/** Faixa de umidade de cada terreno de terra (índice = T.Grass..T.Village). */
export const RANGE: readonly (readonly [number, number])[] = [
  [0.2, 0.6], // prado
  [0.4, 1.0], // mata
  [0.5, 0.8], // plantação
  [0.1, 0.4], // vila
];
export const FIT_IN = 8;
export const FIT_MID = 11;
const REACH = 3;

export const hasWater = (edges: readonly T[]) => edges.includes(T.Water);
export const forestish = (edges: readonly T[]) => edges.filter((e) => e === T.Forest).length >= 3;

/** Umidade da casa (q, r) no mundo `w` (a peça posta ali, se houver, não conta para si mesma como mata). */
export function moistureAt(w: LiteWorld, q: number, r: number): number {
  let d = REACH + 1;
  for (let dq = -REACH; dq <= REACH; dq++) {
    for (let dr = Math.max(-REACH, -dq - REACH); dr <= Math.min(REACH, -dq + REACH); dr++) {
      const p = w.at(q + dq, r + dr);
      if (!p || !hasWater(p.v.edges)) continue;
      const k = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
      if (k < d) d = k;
    }
  }
  let m = d <= REACH ? MOIST[d] : MOIST_FAR;
  let boost = 0;
  for (const [dq, dr] of [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]) {
    const p = w.at(q + dq, r + dr);
    if (p && forestish(p.v.edges)) boost += FOREST_BOOST;
  }
  m += Math.min(BOOST_CAP, boost);
  return Math.min(1, m);
}

/** Pontos (inteiros) de uma peça de composição `comp` (4 terrenos, soma 1 ou 0) com umidade `m`. */
export function fitOf(comp: readonly number[], m: number): number {
  let s = 0;
  for (let k = 0; k < comp.length; k++) {
    const [lo, hi] = RANGE[k];
    if (!comp[k] || m < lo || m > hi) continue;
    const mid = (lo + hi) / 2;
    s += comp[k] * (Math.abs(m - mid) <= (hi - lo) / 4 ? FIT_MID : FIT_IN);
  }
  return Math.round(s);
}

/** Quem pode ter a umidade mudada pela peça `p` recém-posta: ela mesma, e as vizinhas até onde a água (3) ou a mata (1) alcança. */
export function affected(w: LiteWorld, p: Placed): Placed[] {
  const out: Placed[] = [p];
  const reach = hasWater(p.v.edges) ? REACH : forestish(p.v.edges) ? 1 : 0;
  for (let dq = -reach; dq <= reach; dq++) {
    for (let dr = Math.max(-reach, -dq - reach); dr <= Math.min(reach, -dq + reach); dr++) {
      if (!dq && !dr) continue;
      const o = w.at(p.q + dq, p.r + dr);
      if (o) out.push(o);
    }
  }
  return out;
}
