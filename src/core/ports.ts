import { DIRS } from './hex';
import { mulberry32, type Rng } from './rng';
import { T, rotateEdges, type TileDef } from './tiles';

export const HARBORS = [
  { name: 'Feira', cargo: 'Grãos', color: '#edb654', tiles: 4 },
  { name: 'Serraria', cargo: 'Madeira', color: '#8bc6a2', tiles: 6 },
  { name: 'Estaleiro', cargo: 'Ferragens', color: '#e28e74', tiles: 8 },
] as const;

export const CHARTS = {
  confluencia: 'Confluência',
  forquilha: 'Rio bifurcado',
  enseada: 'Cais da enseada',
} as const;
export type ChartId = keyof typeof CHARTS;

export interface Port {
  id: number;
  q: number;
  r: number;
  delivered: boolean;
  connectedAt?: number;
  paidAt?: number;
  reward?: number;
}

export function chart(seed: number, layout: ChartId = 'confluencia') {
  const heading = Math.floor(mulberry32(seed ^ 0x52746173)() * 6);
  // Cada sequência descreve um corredor viável. A água que o jogador construir continua livre.
  const paths = layout === 'forquilha' ? [[0, 0, 0, 1], [0, 0, 0, 5, 5], [2, 2, 2]]
    : layout === 'enseada' ? [[0, 0, 0, 0], [2, 2], [2, 2, 3, 3]] : [[0, 0], [2, 2, 2], [4, 4, 4, 4]];
  const corridors = paths.map((path) => path.map((side) => (side + heading) % 6));
  const ports = corridors.map((path, id) => {
    let q = 0, r = 0;
    for (const side of path) { q += DIRS[side][0]; r += DIRS[side][1]; }
    return { id, q, r, delivered: false };
  });
  const edges = rotateEdges([T.Water, T.Field, T.Water, T.Forest, T.Water, T.Village], heading);
  return { edges, ports, corridors };
}

/** As duas primeiras peças permitem abrir a Feira. Depois, retas, curvas e
 * bifurcações se intercalam com as peças comuns da paisagem. */
export function channelTile(rng: Rng, index: number, layout: ChartId): TileDef | null {
  // Uma clareira cedo oferece uma margem para descarregar peças enquanto se prepara a bifurcação.
  if (layout !== 'confluencia' && index === 3) return { edges: [T.Grass,T.Grass,T.Field,T.Village,T.Forest,T.Grass], seed: Math.floor(rng() * 2 ** 31), quest: null };
  if (index % 3 === 0) return null;
  const land = [T.Grass, T.Forest, T.Field, T.Village];
  const a = land[Math.floor(rng() * 4)], b = land[Math.floor(rng() * 4)];
  const edges = [T.Water, a, a, b, b, b];
  if (index <= 2 || index % 3 === 1) edges[3] = T.Water;
  else {
    edges[2] = T.Water;
    if (rng() < 0.55 || (layout === 'forquilha' && index % 6 === 5)) edges[4] = T.Water;
  }
  return { edges: rotateEdges(edges, Math.floor(rng() * 6)), seed: Math.floor(rng() * 2 ** 31), quest: null };
}
