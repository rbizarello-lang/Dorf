// Níveis de altura por casa (R2): platôs. Só aparência: regras, pontuação e replay não leem nada daqui.
// O nível sai de uma função PURA da semente e da casa, nunca da jogada: a peça sabe o nível de todos os
// vizinhos, presentes ou futuros, ao ser montada, e a emenda não depende da ordem de colocação.
import { DIRS, hexDistance, hexToWorld } from './hex';

/** Comprimento de onda do ruído (em unidades do mundo; o passo entre casas é ~1,73): platôs de algumas casas de largura. */
const WAVE = 5.5;
/** Ruído (0..1) em que começa o nível 1 (~2/3 das casas ficam abaixo disto) e largura da faixa de cada nível, em ruído. */
const T1 = 0.55;
const WIDTH = 0.15;
/** Teto da altura perto da origem: a casa (0,0) e os 6 vizinhos ficam em 0; depois sobe 0,7 por casa (menos que 1: ainda vizinhos a 1 degrau). */
const CAP0 = 0.45;
const CAP_SLOPE = 0.7;

/** Hash inteiro de (semente, ix, iz) em [0, 1). */
function lattice(seed: number, ix: number, iz: number): number {
  let n = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Ruído de valor suave em (x, z), 0..1, com uma célula de `WAVE`. */
function noise(seed: number, x: number, z: number): number {
  const fx = Math.floor(x / WAVE), fz = Math.floor(z / WAVE);
  const u = fade(x / WAVE - fx), v = fade(z / WAVE - fz);
  const a = lattice(seed, fx, fz), b = lattice(seed, fx + 1, fz);
  const c = lattice(seed, fx, fz + 1), d = lattice(seed, fx + 1, fz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** O ruído da casa (0..1), antes da escala em níveis. */
export function reliefNoise(seed: number, q: number, r: number): number {
  const { x, z } = hexToWorld(q, r);
  // Duas oitavas (a de cima, fina, só dá um pouco de recorte nas bordas dos platôs).
  return noise(seed ^ 0x2f6a1, x, z) * 0.82 + noise(seed ^ 0x6d3b9, x * 2.1 + 17, z * 2.1 - 9) * 0.18;
}

/** Altura contínua (em níveis) de uma casa, antes de arredondar. */
export function reliefHeight(seed: number, q: number, r: number, maxLevel: number): number {
  const v = reliefNoise(seed, q, r);
  const h = (v - T1) / WIDTH + 0.5;
  const cap = CAP0 + CAP_SLOPE * (hexDistance(q, r, 0, 0) - 1);
  return Math.max(0, Math.min(h, cap, maxLevel + 0.49));
}

/** Nível "cru": a altura arredondada. */
const rawLevel = (seed: number, q: number, r: number, top: number) => Math.round(reliefHeight(seed, q, r, top));

/**
 * Nível depois da erosão: uma casa não passa de 1 acima do vizinho mais baixo. Com níveis até 2, isto garante vizinhos a
 * no máximo 1 degrau, qualquer que seja o ruído (o platô alto ganha um anel de nível 1 em volta: terraço).
 */
function eroded(seed: number, q: number, r: number, top: number): number {
  let lo = rawLevel(seed, q, r, top);
  if (lo === 0) return 0;
  const own = lo;
  for (const [dq, dr] of DIRS) lo = Math.min(lo, rawLevel(seed, q + dq, r + dr, top) + 1);
  return Math.min(own, lo);
}

/**
 * Nível (0 a `maxLevel`, no máximo 2) da casa (q, r) na partida de semente `seed`. `maxLevel` 0 = plano.
 * Vizinhos diferem no máximo 1 nível; a casa (0,0) e os 6 vizinhos ficam no 0. Casas soltas (com no máximo
 * um vizinho no mesmo nível e todos os outros num único nível vizinho) são absorvidas: o relevo vem em
 * platôs, não em pontinhos. A limpeza só move a casa para o nível dos vizinhos, então mantém a diferença ≤ 1.
 */
export function levelAt(seed: number, q: number, r: number, maxLevel: number): number {
  const top = Math.min(2, Math.floor(maxLevel));
  if (top <= 0 || hexDistance(q, r, 0, 0) <= 1) return 0;
  const own = eroded(seed, q, r, top);
  let same = 0;
  let other = -1;
  for (const [dq, dr] of DIRS) {
    const n = eroded(seed, q + dq, r + dr, top);
    if (n === own) same++;
    else if (other < 0 || other === n) other = n;
    else return own; // vizinhos em dois níveis diferentes do meu: é uma encosta, fica
  }
  return same <= 1 && other >= 0 ? other : own;
}
