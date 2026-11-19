import { DIRS, opposite } from './hex';
import type { Board, Placed } from './board';
import { T } from './tiles';

/** Estágio visual e número de encaixes que o sustentam, por setor da peça. */
export type DevelopmentValues = [number, number, number, number, number, number];

export interface Development {
  levels: DevelopmentValues;
  supports: DevelopmentValues;
}

export interface DevelopmentChange {
  q: number;
  r: number;
  before: Development;
  after: Development;
}

export interface DevelopmentPreview {
  placed: DevelopmentChange;
  neighbors: DevelopmentChange[];
}

type Override = { q: number; r: number; edges: readonly T[] };

function at(board: Board, q: number, r: number, override?: Override): Placed | undefined {
  if (override && override.q === q && override.r === r) return undefined;
  return board.get(q, r);
}

function development(board: Board, q: number, r: number, edges: readonly T[] | undefined, override?: Override): Development {
  const tile = edges ? undefined : at(board, q, r, override);
  const terrain = edges ?? tile?.edges;
  const supports: DevelopmentValues = [0, 0, 0, 0, 0, 0];
  const levels: DevelopmentValues = [0, 0, 0, 0, 0, 0];
  if (!terrain) return { levels, supports };

  const matches = new Map<T, number>();
  for (let side = 0; side < 6; side++) {
    const neighbor = at(board, q + DIRS[side][0], r + DIRS[side][1], override);
    const neighborEdges = override && override.q === q + DIRS[side][0] && override.r === r + DIRS[side][1]
      ? override.edges
      : neighbor?.edges;
    if (neighborEdges?.[opposite(side)] === terrain[side]) {
      matches.set(terrain[side], (matches.get(terrain[side]) ?? 0) + 1);
    }
  }
  for (let side = 0; side < 6; side++) {
    const count = matches.get(terrain[side]) ?? 0;
    supports[side] = count;
    levels[side] = Math.min(3, count);
  }
  return { levels, supports };
}

/** Deriva o estágio de cada setor pelo total de encaixes externos do mesmo terreno.
 * Interações entre terrenos não contam: o desenvolvimento não altera regras ou pontuação. */
export function developmentAt(board: Board, q: number, r: number, edges?: readonly T[]): Development {
  return development(board, q, r, edges);
}

/** Prévia imutável do desenvolvimento da peça e dos vizinhos que ela encaixará. */
export function previewDevelopment(board: Board, q: number, r: number, edges: readonly T[]): DevelopmentPreview {
  const before = developmentAt(board, q, r);
  const after = developmentAt(board, q, r, edges);
  const neighbors: DevelopmentChange[] = [];
  for (const [dq, dr] of DIRS) {
    const neighbor = board.get(q + dq, r + dr);
    if (!neighbor) continue;
    const neighborBefore = developmentAt(board, neighbor.q, neighbor.r);
    const neighborAfter = development(board, neighbor.q, neighbor.r, undefined, { q, r, edges });
    if (neighborBefore.levels.every((level, i) => level === neighborAfter.levels[i])) continue;
    neighbors.push({
      q: neighbor.q,
      r: neighbor.r,
      before: neighborBefore,
      after: neighborAfter,
    });
  }
  return { placed: { q, r, before, after }, neighbors };
}
