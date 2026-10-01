import { DIRS, hexDistance } from './hex';
import { mulberry32 } from './rng';

// Sítios para descobrir: lugares escondidos no mapa (ruínas, tesouros, relíquias,
// mirantes) que rendem algo a quem coloca uma peça em cima. Saem da semente por um
// gerador próprio, então não mexem na sequência de peças (a mesma semente dá os
// mesmos sítios e as mesmas peças para qualquer jogador).

export type SiteKind = 'ruin' | 'treasure' | 'relic' | 'lookout';

export interface Site {
  q: number;
  r: number;
  kind: SiteKind;
  found: boolean;
}

/** Recompensa de cada tipo. O mirante também mostra as próximas peças por algumas jogadas. */
export const SITE_REWARD: Record<SiteKind, { points: number; tiles: number }> = {
  ruin: { points: 60, tiles: 0 },
  treasure: { points: 0, tiles: 2 },
  relic: { points: 100, tiles: 1 },
  lookout: { points: 20, tiles: 0 },
};

/** Jogadas em que o mirante mostra as próximas peças. */
export const LOOKOUT_MOVES = 10;

/** Anéis de distância (em hexágonos) onde os sítios aparecem, do mais perto ao mais longe. */
const RINGS: ReadonlyArray<readonly [number, number]> = [
  [3, 4],
  [5, 6],
  [7, 9],
  [10, 12],
  [13, 15],
];

const KIND_CYCLE: readonly SiteKind[] = ['ruin', 'treasure', 'lookout', 'relic', 'ruin', 'treasure', 'relic', 'ruin', 'treasure', 'ruin'];

/** Hexágono a uma distância exata da origem (caminhando no anel). */
function onRing(d: number, k: number, j: number): [number, number] {
  const [aq, ar] = DIRS[k];
  const [bq, br] = DIRS[(k + 2) % 6];
  return [aq * d + bq * j, ar * d + br * j];
}

export function generateSites(seed: number, count: number): Site[] {
  if (count <= 0) return [];
  const rng = mulberry32((seed ^ 0x51735173) >>> 0);
  const kinds = KIND_CYCLE.slice(0, Math.min(count, KIND_CYCLE.length));
  while (kinds.length < count) kinds.push(KIND_CYCLE[kinds.length % KIND_CYCLE.length]);
  // Embaralha os tipos (Fisher-Yates) para o primeiro anel não ser sempre igual.
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const out: Site[] = [];
  for (let i = 0; i < count; i++) {
    const [lo, hi] = RINGS[Math.min(RINGS.length - 1, Math.floor(i / 2))];
    for (let tries = 0; tries < 60; tries++) {
      const d = lo + Math.floor(rng() * (hi - lo + 1));
      const [q, r] = onRing(d, Math.floor(rng() * 6), Math.floor(rng() * d));
      if (out.some((s) => hexDistance(s.q, s.r, q, r) < 3)) continue;
      out.push({ q, r, kind: kinds[i], found: false });
      break;
    }
  }
  return out;
}
