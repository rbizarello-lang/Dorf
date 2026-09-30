import { type Rng, pick, randInt, weighted } from './rng';

/** Tipos de borda. Os nomes exibidos vêm do tema (ex.: Floresta → Cristais em Marte). */
export enum T {
  Grass = 0,
  Forest = 1,
  Field = 2,
  Village = 3,
  Water = 4,
  Rail = 5,
}
export const TERRAIN_COUNT = 6;
export const LAND: readonly T[] = [T.Grass, T.Forest, T.Field, T.Village];
/** Bordas que exigem continuidade (rio só encosta em rio, trilho só em trilho). */
export const isStrict = (t: T) => t === T.Water || t === T.Rail;

export interface QuestSpec {
  terrain: T;
  delta: number;
  exact: boolean;
}

export interface TileDef {
  /** Bordas na orientação de origem (rotação 0). */
  edges: T[];
  /** Semente da decoração: a peça fica igual no fantasma, na queda e no mapa. */
  seed: number;
  quest: QuestSpec | null;
}

export function rotateEdges(edges: readonly T[], rot: number): T[] {
  const out = new Array<T>(6);
  for (let i = 0; i < 6; i++) out[(i + rot) % 6] = edges[i];
  return out;
}

const LAND_WEIGHTS: ReadonlyArray<readonly [T, number]> = [
  [T.Grass, 0.24],
  [T.Forest, 0.3],
  [T.Field, 0.22],
  [T.Village, 0.24],
];

function pickLand(rng: Rng, exclude?: T): T {
  const items = exclude === undefined ? LAND_WEIGHTS : LAND_WEIGHTS.filter(([t]) => t !== exclude);
  return weighted(rng, items);
}

/** Preenche as posições nulas com terreno comum, em trechos contíguos. */
function fillLand(e: (T | null)[], rng: Rng) {
  if (!e.some((x) => x !== null)) {
    const k = weighted(rng, [
      [1, 0.28],
      [2, 0.47],
      [3, 0.25],
    ] as const);
    const cuts = new Set<number>();
    while (cuts.size < k) cuts.add(randInt(rng, 0, 5));
    const sorted = [...cuts].sort((a, b) => a - b);
    let prev: T | undefined;
    for (let j = 0; j < sorted.length; j++) {
      const t = pickLand(rng, prev);
      prev = t;
      const end = j + 1 < sorted.length ? sorted[j + 1] : sorted[0] + 6;
      for (let i = sorted[j]; i < end; i++) e[i % 6] = t;
    }
    return;
  }
  // Trechos vazios entre bordas de rio/trilho.
  const start = e.findIndex((x) => x !== null);
  for (let n = 0; n < 6; n++) {
    const i = (start + n) % 6;
    if (e[i] !== null) continue;
    let len = 0;
    while (len < 6 && e[(i + len) % 6] === null) len++;
    const t1 = pickLand(rng);
    const split = len >= 2 && rng() < 0.45 ? randInt(rng, 1, len - 1) : len;
    const t2 = pickLand(rng, t1);
    for (let j = 0; j < len; j++) e[(i + j) % 6] = j < split ? t1 : t2;
    n += len - 1;
  }
}

const WATER_PATTERNS: ReadonlyArray<readonly [number[], number]> = [
  [[0, 3], 4],
  [[0, 2], 3],
  [[0, 1], 1],
  [[0], 1.1],
  [[0, 2, 4], 1],
  [[0, 1, 2], 0.9],
  [[0, 1, 2, 3], 0.5],
];
const RAIL_PATTERNS: ReadonlyArray<readonly [number[], number]> = [
  [[0, 3], 4],
  [[0, 2], 3],
  [[0], 0.8],
  [[0, 2, 4], 0.5],
];

export function generateEdges(rng: Rng): T[] {
  const e: (T | null)[] = Array<T | null>(6).fill(null);
  const roll = rng();
  if (roll < 0.15) for (const i of weighted(rng, WATER_PATTERNS)) e[i] = T.Water;
  else if (roll < 0.24) for (const i of weighted(rng, RAIL_PATTERNS)) e[i] = T.Rail;
  fillLand(e, rng);
  return rotateEdges(e as T[], randInt(rng, 0, 5));
}

const QUEST_DELTA: Record<number, [number, number]> = {
  [T.Forest]: [4, 11],
  [T.Field]: [3, 8],
  [T.Village]: [3, 8],
  [T.Water]: [3, 7],
  [T.Rail]: [3, 6],
};

export function generateTile(rng: Rng, withQuest: boolean): TileDef {
  const edges = generateEdges(rng);
  let quest: QuestSpec | null = null;
  if (withQuest) {
    const options = [...new Set(edges)].filter((t) => t !== T.Grass);
    if (options.length) {
      const terrain = pick(rng, options);
      const [lo, hi] = QUEST_DELTA[terrain];
      quest = { terrain, delta: randInt(rng, lo, hi), exact: rng() < 0.22 };
    }
  }
  return { edges, seed: Math.floor(rng() * 2 ** 31), quest };
}
