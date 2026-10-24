// Níveis de altura por casa (R2): platôs. Só aparência: regras, pontuação e replay não leem nada daqui.
// O nível sai de uma função PURA da semente e da casa, nunca da jogada: a peça sabe o nível de todos os
// vizinhos, presentes ou futuros, ao ser montada, e a emenda não depende da ordem de colocação.
import { DIRS, hexDistance, hexToWorld } from './hex';
import { mulberry32, weighted } from './rng';
import { T, isStrict, rotateEdges } from './tiles';

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

// ---------------------------------------------------------------------------------------------------------------------
// Relevo por peça (modo Relevo): a altura é da PEÇA, não da casa. Cada peça sorteada traz um perfil de altura por borda
// (nível 0 a 2, um por setor), gerado só da semente dela e das bordas, num gerador à parte: a sequência de peças e o
// replay dos outros modos não mudam. As alturas das bordas viram parte do encaixe (Board.check). Convive com os platôs
// da semente (`levelAt`, invariante 15): no modo Relevo o mundo desliga os platôs da semente e lê o perfil da peça.
// ---------------------------------------------------------------------------------------------------------------------

/** Perfil de altura de uma peça: nível de cada borda/setor (na orientação de origem) e do morro no meio. */
export interface Profile {
  /** Nível (0 a 2) de cada setor, o mesmo da borda `i`. */
  h: number[];
  /** Nível do meio da peça (o pico): o maior dos setores, ou um a mais no morro. */
  c: number;
  /** Nome da forma (para as capturas e o almanaque). */
  shape: string;
}

/** Formas em relação ao nível-base (somadas a ele): em todas, setores vizinhos diferem no máximo 1 degrau. */
const SHAPES: ReadonlyArray<readonly [string, readonly number[], number]> = [
  ['plana', [0, 0, 0, 0, 0, 0], 0.34],
  ['morro', [0, 0, 0, 0, 0, 0], 0.08], // plana nas bordas, com pico no meio
  ['barranco', [1, 0, 0, 0, 0, 0], 0.11], // uma borda alta
  ['canto', [1, 1, 0, 0, 0, 0], 0.1],
  ['meia', [1, 1, 1, 0, 0, 0], 0.1], // metade alta, metade baixa
  ['rampa', [2, 2, 1, 0, 0, 1], 0.09], // alta numa ponta, baixa na outra
  ['espinhaço', [2, 1, 1, 0, 1, 1], 0.06],
  ['sela', [1, 0, 0, 1, 0, 0], 0.06], // duas bordas altas opostas
  ['vale', [0, 1, 1, 1, 1, 1], 0.06], // uma borda baixa
];
const SHAPE_WEIGHTS = SHAPES.map(([name, , w]) => [name, w] as const);

/** Nível-base: peça plana varia mais; peça com degrau tem menos folga; a de 2 degraus fica no 0. */
const BASE_FLAT: ReadonlyArray<readonly [number, number]> = [[0, 0.3], [1, 0.4], [2, 0.3]];
const BASE_RANGE1: ReadonlyArray<readonly [number, number]> = [[0, 0.5], [1, 0.5]];
const BASE_RANGE2: ReadonlyArray<readonly [number, number]> = [[0, 1]];
/** Rio e trilho (bordas estritas) saem planos: o rio pode cair 1 degrau (cachoeira), o trilho nunca muda de nível. */
const BASE_WATER: ReadonlyArray<readonly [number, number]> = [[0, 0.1], [1, 0.8], [2, 0.1]];
const RAIL_LEVEL = 1;
const SALT = 0x7e11ef;

const flatProfile = (level: number): Profile => ({ h: [level, level, level, level, level, level], c: level, shape: 'plana' });

/**
 * Perfil da peça de bordas `edges` (origem) e semente `seed`. Puro e determinístico: não sorteia nada do jogo.
 * Peça com rio ou trilho sai plana (a água e o trilho não cruzam um penhasco dentro da peça).
 */
export function tileProfile(edges: readonly T[], seed: number): Profile {
  const rng = mulberry32((seed ^ SALT) >>> 0);
  if (edges.includes(T.Rail)) return flatProfile(RAIL_LEVEL);
  if (edges.some((e) => isStrict(e))) return flatProfile(weighted(rng, BASE_WATER));
  const name = weighted(rng, SHAPE_WEIGHTS);
  const rel = SHAPES.find(([n]) => n === name)![1];
  const rot = rotateEdges(rel as unknown as T[], Math.floor(rng() * 6)) as unknown as number[];
  const range = Math.max(...rot);
  const base = name === 'morro' ? Math.floor(rng() * 2) : weighted(rng, range === 0 ? BASE_FLAT : range === 1 ? BASE_RANGE1 : BASE_RANGE2);
  const h = rot.map((v) => v + base);
  return { h, c: name === 'morro' ? base + 1 : Math.max(...h), shape: name };
}

/** O perfil da peça inicial (o Centro da vila): plana no nível 1, para a praça ficar no chão. */
export const STARTER_PROFILE: Profile = flatProfile(1);

/** As alturas de um perfil na orientação do mundo, com a peça girada `rot` passos (a mesma conta das bordas). */
export function worldHeights(p: Profile, rot: number): number[] {
  return rotateEdges(p.h as unknown as T[], rot) as unknown as number[];
}

/** Encaixe de altura de uma borda: 1 igual, 2 degrau de 1 nível (vale), 3 alto demais (não encaixa). */
export function heightFit(a: number, b: number, terr: T): 1 | 2 | 3 {
  const d = Math.abs(a - b);
  if (d === 0) return 1;
  // O trilho nunca muda de nível; o resto aceita 1 degrau.
  return d === 1 && terr !== T.Rail ? 2 : 3;
}
