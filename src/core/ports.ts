import { DIRS } from './hex';
import { mulberry32, type Rng } from './rng';
import { T, rotateEdges, type TileDef } from './tiles';

export const HARBORS = [
  { name: 'Feira', cargo: 'Grãos', color: '#edb654', tiles: 4 },
  { name: 'Serraria', cargo: 'Madeira', color: '#8bc6a2', tiles: 6 },
  { name: 'Estaleiro', cargo: 'Ferragens', color: '#e28e74', tiles: 8 },
] as const;

export interface Port {
  id: number;
  q: number;
  r: number;
  delivered: boolean;
}

export function chart(seed: number) {
  const heading = Math.floor(mulberry32(seed ^ 0x52746173)() * 6);
  const ports = HARBORS.map((_, id) => {
    const [dq, dr] = DIRS[(heading + 2 * id) % 6];
    return { id, q: dq * (2 + id), r: dr * (2 + id), delivered: false };
  });
  const edges = rotateEdges([T.Water, T.Field, T.Water, T.Forest, T.Water, T.Village], heading);
  return { edges, ports };
}

/** As duas primeiras peças permitem abrir a Feira. Depois, retas, curvas e
 * bifurcações se intercalam com as peças comuns da paisagem. */
export function channelTile(rng: Rng, index: number): TileDef | null {
  if (index % 3 === 0) return null;
  const land = [T.Grass, T.Forest, T.Field, T.Village];
  const a = land[Math.floor(rng() * 4)], b = land[Math.floor(rng() * 4)];
  const edges = [T.Water, a, a, b, b, b];
  if (index <= 2 || index % 3 === 1) edges[3] = T.Water;
  else {
    edges[2] = T.Water;
    if (rng() < 0.55) edges[4] = T.Water;
  }
  return { edges: rotateEdges(edges, Math.floor(rng() * 6)), seed: Math.floor(rng() * 2 ** 31), quest: null };
}
