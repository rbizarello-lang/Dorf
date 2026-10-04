import type { SpecialKind } from './specials';
import { type Rng, pick, randInt, weighted } from './rng';
import type { SynKind } from './synergy';

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

/**
 * Tipos de missão:
 *   group   → grupo do terreno com N peças (ou exatamente N);
 *   close   → fechar o grupo do terreno (nenhuma borda dele virada para o vazio);
 *   perfect → N encaixes perfeitos a partir de agora;
 *   synergy → N interações de um tipo a partir de agora.
 */
export type QuestKind = 'group' | 'close' | 'perfect' | 'synergy';

export interface QuestSpec {
  kind: QuestKind;
  terrain: T;
  /** group: quanto o grupo precisa crescer; perfect e synergy: quantas vezes. */
  delta: number;
  exact: boolean;
  /** synergy: o tipo de interação pedido. */
  syn?: SynKind;
}

export interface TileDef {
  /** Bordas na orientação de origem (rotação 0). */
  edges: T[];
  /** Semente da decoração: a peça fica igual no fantasma, na queda e no mapa. */
  seed: number;
  quest: QuestSpec | null;
  /** Peça especial (estação, moinho d'água, farol): bordas fixas e pontos pelo terreno à volta. */
  special?: SpecialKind;
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

// Bordas de água vizinhas viram lago no render (tileBuilder.waterShape); lagos encostados
// pela boca viram um lago só.
const WATER_PATTERNS: ReadonlyArray<readonly [number[], number]> = [
  [[0, 3], 4],
  [[0, 2], 3],
  [[0, 1], 1.4],
  [[0], 1.1],
  [[0, 2, 4], 1],
  [[0, 1, 2], 1.2],
  [[0, 1, 2, 3], 0.6],
  [[0, 1, 2, 3, 4], 0.25],
];
const RAIL_PATTERNS: ReadonlyArray<readonly [number[], number]> = [
  [[0, 3], 4],
  [[0, 2], 3],
  [[0], 0.8],
  [[0, 2, 4], 0.5],
];

export function generateEdges(rng: Rng, waterChance = 0.17, railChance = 0.09): T[] {
  const e: (T | null)[] = Array<T | null>(6).fill(null);
  const roll = rng();
  // Os limiares de sempre (0,17 e 0,26) ficam literais: 0,17+0,09 não é o mesmo número e mudaria a sequência.
  const waterCut = waterChance === 0.17 && railChance === 0.09 ? 0.17 : waterChance;
  const railCut = waterChance === 0.17 && railChance === 0.09 ? 0.26 : waterChance + railChance;
  if (roll < waterCut) for (const i of weighted(rng, WATER_PATTERNS)) e[i] = T.Water;
  else if (roll < railCut) for (const i of weighted(rng, RAIL_PATTERNS)) e[i] = T.Rail;
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

/** Interações que envolvem cada terreno (a missão de interação usa um terreno da própria peça). */
const SYN_BY_TERRAIN: Record<number, SynKind[]> = {
  [T.Forest]: ['lumber'],
  [T.Field]: ['mill', 'apiary'],
  [T.Village]: ['lumber', 'mill', 'pasture'],
  [T.Water]: [],
  [T.Rail]: [],
};

export function generateTile(rng: Rng, withQuest: boolean, waterChance = 0.17, railChance = 0.09): TileDef {
  const edges = generateEdges(rng, waterChance, railChance);
  let quest: QuestSpec | null = null;
  if (withQuest) {
    const options = [...new Set(edges)].filter((t) => t !== T.Grass);
    if (options.length) {
      const terrain = pick(rng, options);
      const [lo, hi] = QUEST_DELTA[terrain];
      quest = { kind: 'group', terrain, delta: randInt(rng, lo, hi), exact: rng() < 0.22 };
    }
  }
  const seed = Math.floor(rng() * 2 ** 31);
  // O tipo da missão é sorteado depois da semente da decoração: bordas e aparência da peça
  // ficam iguais às de antes dos tipos novos.
  if (quest) {
    const roll = rng();
    const syns = SYN_BY_TERRAIN[quest.terrain];
    if (roll < 0.55) {
      // grupo (o tipo de sempre)
    } else if (roll < 0.75 && LAND.includes(quest.terrain)) quest = { kind: 'close', terrain: quest.terrain, delta: 0, exact: false };
    else if (roll < 0.87) quest = { kind: 'perfect', terrain: quest.terrain, delta: randInt(rng, 3, 5), exact: false };
    else if (syns.length) quest = { kind: 'synergy', terrain: quest.terrain, delta: randInt(rng, 3, 6), exact: false, syn: pick(rng, syns) };
  }
  return { edges, seed, quest };
}
