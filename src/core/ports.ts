import { DIRS, hkey, opposite, unkey } from './hex';
import { mulberry32, type Rng } from './rng';
import { LAND, T, rotateEdges, type TileDef } from './tiles';

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

export const FREIGHT_CONTRACTS = {
  direto: 'Entrega direta',
  madeira: 'Madeira para a Feira',
} as const;
export type FreightContractId = keyof typeof FREIGHT_CONTRACTS;

export interface Port {
  id: number;
  q: number;
  r: number;
  delivered: boolean;
  connectedAt?: number;
  paidAt?: number;
  reward?: number;
}

/** Cada sequência descreve um caminho viável. O jogador pode fazer o seu. */
const CORRIDORS: Record<ChartId, readonly (readonly number[])[]> = {
  confluencia: [[0, 0], [2, 2, 2], [4, 4, 4, 4]],
  forquilha: [[0, 0, 0, 1], [0, 0, 0, 5, 5], [2, 2, 2]],
  enseada: [[0, 0, 0, 0], [2, 2], [2, 2, 3, 3]],
};

export function chart(seed: number, layout: ChartId = 'confluencia') {
  const heading = Math.floor(mulberry32(seed ^ 0x52746173)() * 6);
  const corridors = CORRIDORS[layout].map((path) => path.map((side) => (side + heading) % 6));
  const ports: Port[] = corridors.map((path, id) => {
    let q = 0, r = 0;
    for (const side of path) {
      q += DIRS[side][0];
      r += DIRS[side][1];
    }
    return { id, q, r, delivered: false };
  });
  const edges = rotateEdges([T.Water, T.Field, T.Water, T.Forest, T.Water, T.Village], heading);
  return { edges, ports, corridors };
}

/** As duas primeiras são retas. Depois, retas, curvas e bifurcações se alternam com peças comuns. */
export function channelTile(rng: Rng, index: number, layout: ChartId): TileDef | null {
  if (layout !== 'confluencia' && index === 3) return { edges: [T.Grass, T.Grass, T.Field, T.Village, T.Forest, T.Grass], seed: Math.floor(rng() * 2 ** 31), quest: null };
  if (index % 3 === 0) return null;
  const a = LAND[Math.floor(rng() * LAND.length)], b = LAND[Math.floor(rng() * LAND.length)];
  const edges = [T.Water, a, a, b, b, b];
  if (index <= 2 || index % 3 === 1) edges[3] = T.Water;
  else {
    edges[2] = T.Water;
    if (rng() < 0.55 || (layout === 'forquilha' && index % 6 === 5)) edges[4] = T.Water;
  }
  return { edges: rotateEdges(edges, Math.floor(rng() * 6)), seed: Math.floor(rng() * 2 ** 31), quest: null };
}

type RiverEdges = (q: number, r: number) => readonly T[] | undefined;

/** Segue apenas emendas de água nas duas bordas e guarda o caminho mais curto desde a vila. */
function riverTree(edgesAt: RiverEdges, origin = hkey(0, 0)) {
  const parents = new Map([[origin, origin]]);
  const queue = [origin];
  for (const key of queue) {
    const [q, r] = unkey(key);
    const edges = edgesAt(q, r);
    for (let i = 0; i < 6; i++) {
      if (edges?.[i] !== T.Water) continue;
      const x = q + DIRS[i][0], y = r + DIRS[i][1];
      const next = hkey(x, y);
      if (parents.has(next) || edgesAt(x, y)?.[opposite(i)] !== T.Water) continue;
      parents.set(next, key);
      queue.push(next);
    }
  }
  return parents;
}

export function riverPath(edgesAt: RiverEdges, q: number, r: number, from: readonly [number, number] = [0, 0]): [number, number][] {
  if (!edgesAt(...from)?.includes(T.Water)) return [];
  const origin = hkey(...from);
  const parents = riverTree(edgesAt, origin);
  let key = hkey(q, r);
  if (!parents.has(key)) return [];
  const path: [number, number][] = [];
  while (key !== origin) {
    path.push(unkey(key));
    key = parents.get(key)!;
  }
  return [unkey(origin), ...path.reverse()];
}

export interface Voyage {
  connected: Port[];
  shipments: { port: Port; tiles: number }[];
  joins: boolean;
}

export function voyage(ports: readonly Port[], freight: FreightContractId, edgesAt: RiverEdges, q: number, r: number): Voyage {
  if (!ports.length || !edgesAt(q, r)?.includes(T.Water)) return { connected: [], shipments: [], joins: false };
  const river = riverTree(edgesAt);
  const connected = ports.filter((p) => river.has(hkey(p.q, p.r)));
  const payable = connected.filter((p) => !p.delivered);
  const shipments: Voyage['shipments'] = payable.filter((p) => freight === 'direto' || p.id !== 0).map((port) => ({ port, tiles: HARBORS[port.id].tiles }));
  if (freight === 'madeira') {
    const fair = payable.find((p) => p.id === 0), mill = connected.find((p) => p.id === 1);
    if (fair && mill) {
      // Ausência de `connectedAt` significa que o cais acabou de se ligar; o empate favorece a Serraria.
      const fairFirst = fair.connectedAt !== undefined && (mill.connectedAt === undefined || fair.connectedAt < mill.connectedAt);
      // Quando abrem juntas, a madeira sai da Serraria antes de chegar à Feira.
      const afterMill = shipments[0]?.port.id === 1 ? 1 : 0;
      shipments.splice(afterMill, 0, { port: fair, tiles: fairFirst ? HARBORS[0].tiles : 10 });
    }
  }
  return { connected, shipments, joins: river.has(hkey(q, r)) };
}
