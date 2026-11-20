// Composição de terreno por borda: cada borda de terra carrega 4 números (prado, mata, plantação, vila) que somam 1; rio e trilho
// ficam fora (são caminhos estritos). Os quatro números viajam como dados extras da peça (`aux.c0` a `aux.c3`, um valor por borda) e
// giram junto com as bordas. Usado pela Aquarela (bordas misturadas) e pela Terra contínua (campo suavizado).
import { LAND, T, isStrict } from '../../src/core/tiles';
import type { RTile } from './lite';

export const LAND_N = 4;
const KEYS = ['c0', 'c1', 'c2', 'c3'] as const;

/** `aux` com a composição de cada borda: `comp[i][k]`, k = terreno (T.Grass..T.Village). Borda estrita: tudo 0. */
export function compAux(comp: number[][]): Record<string, number[]> {
  const aux: Record<string, number[]> = {};
  for (let k = 0; k < LAND_N; k++) aux[KEYS[k]] = comp.map((c) => c[k]);
  return aux;
}

/** `aux` de uma peça sem mistura: cada borda de terra é 100% do terreno dela. */
export const pureAux = (edges: readonly T[]): Record<string, number[]> => compAux(edges.map((t) => pure(t)));

/** O vetor de composição da borda `i` de uma peça vista. */
export function compOf(v: RTile, i: number, out: number[] = [0, 0, 0, 0]): number[] {
  for (let k = 0; k < LAND_N; k++) out[k] = v.aux[KEYS[k]][i];
  return out;
}

/** Distância L1 entre as composições de duas bordas (0 = iguais, 2 = sem terreno em comum). */
export function l1(a: RTile, i: number, b: RTile, j: number): number {
  let d = 0;
  for (let k = 0; k < LAND_N; k++) d += Math.abs(a.aux[KEYS[k]][i] - b.aux[KEYS[k]][j]);
  return d;
}

/** A composição pura de uma borda de terra (1 no terreno dela). */
export function pure(t: T): number[] {
  const c = [0, 0, 0, 0];
  if (!isStrict(t)) c[t] = 1;
  return c;
}

/** Composição média da peça: a média das bordas de terra (a mistura que a peça traz para o campo). */
export function tileComp(v: RTile): number[] {
  const out = [0, 0, 0, 0];
  let n = 0;
  for (let i = 0; i < 6; i++) {
    if (isStrict(v.edges[i])) continue;
    n++;
    for (let k = 0; k < LAND_N; k++) out[k] += v.aux[KEYS[k]][i];
  }
  if (n) for (let k = 0; k < LAND_N; k++) out[k] /= n;
  return out;
}

export const isLand = (t: T) => LAND.includes(t);
