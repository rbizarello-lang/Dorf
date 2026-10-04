import type { Board, Placed } from './board';
import { DIRS, hexDistance, hkey, opposite } from './hex';
import { mulberry32 } from './rng';
import { T } from './tiles';

// Rotas de comércio (modo Estrada Real). Mercados na rede de trilho e portos na rede
// de água rendem uma vez, pelo par mais distante que a jogada acabou de ligar.
// A conta é a da carroça do Age of Empires II: pts = round(4 · d · (d / 6 + 1)).

export interface RouteHit {
  kind: 'market' | 'port';
  d: number;
  points: number;
  tiles: number;
}

export interface RoutePost {
  q: number;
  r: number;
}

/** Mercado: estação, trilho de uma borda só, ou vila colada ao trilho. A mesma condição da estação visual. */
export function isMarket(p: Placed): boolean {
  if (p.def.special === 'station') return true;
  let rails = 0;
  let village = false;
  for (let i = 0; i < 6; i++) {
    if (p.edges[i] !== T.Rail) continue;
    rails++;
    if (p.edges[(i + 1) % 6] === T.Village || p.edges[(i + 5) % 6] === T.Village) village = true;
  }
  return rails === 1 || village;
}

/** Porto: vila colada a rio ou lago dentro da peça. */
export function isPort(p: Placed): boolean {
  for (let i = 0; i < 6; i++) {
    if (p.edges[i] !== T.Water) continue;
    if (p.edges[(i + 1) % 6] === T.Village || p.edges[(i + 5) % 6] === T.Village) return true;
  }
  return false;
}

/** Componentes conexas de um terreno contínuo (rio ou trilho). */
export function networks(board: Board, terr: T): Placed[][] {
  const seen = new Set<number>();
  const out: Placed[][] = [];
  for (const start of board.list) {
    if (seen.has(start.key) || !start.edges.includes(terr)) continue;
    const net: Placed[] = [];
    const stack = [start];
    seen.add(start.key);
    while (stack.length) {
      const t = stack.pop()!;
      net.push(t);
      for (let i = 0; i < 6; i++) {
        if (t.edges[i] !== terr) continue;
        const n = board.tiles.get(hkey(t.q + DIRS[i][0], t.r + DIRS[i][1]));
        if (n && !seen.has(n.key) && n.edges[opposite(i)] === terr) {
          seen.add(n.key);
          stack.push(n);
        }
      }
    }
    out.push(net);
  }
  return out;
}

const pairKey = (kind: string, a: number, b: number) => `${kind}:${Math.min(a, b)}:${Math.max(a, b)}`;

/** Pontos da tabela do plano, para d ≥ 2. d ≥ 6 também devolve uma peça. */
export function routePoints(d: number) {
  return { points: Math.round(4 * d * (d / 6 + 1)), tiles: d >= 6 ? 1 : 0 };
}

/**
 * Paga, no máximo, um par novo por rede: o mais distante entre os que esta peça acabou de ligar.
 * Marca o par em `board.routesPaid` para não pagar de novo.
 */
export function payRoutes(board: Board, placed: Placed): RouteHit[] {
  const hits: RouteHit[] = [];
  const market = payOne(board, placed, T.Rail, isMarket, 'market');
  const port = payOne(board, placed, T.Water, isPort, 'port');
  if (market) hits.push(market);
  if (port) hits.push(port);
  return hits;
}

function payOne(board: Board, placed: Placed, terr: T, isNode: (p: Placed) => boolean, kind: RouteHit['kind']): RouteHit | null {
  if (!placed.edges.includes(terr)) return null;
  const net = networks(board, terr).find((n) => n.includes(placed));
  if (!net) return null;
  const nodes = net.filter(isNode);
  if (nodes.length < 2) return null;
  // Componentes da rede sem a peça nova: pares em componentes diferentes (ou com a própria peça) são novos.
  const comp = new Map<number, number>();
  let id = 0;
  for (const start of net) {
    if (start === placed || comp.has(start.key)) continue;
    const stack = [start];
    comp.set(start.key, id);
    while (stack.length) {
      const t = stack.pop()!;
      for (let i = 0; i < 6; i++) {
        if (t.edges[i] !== terr) continue;
        const n = board.tiles.get(hkey(t.q + DIRS[i][0], t.r + DIRS[i][1]));
        if (!n || n === placed || comp.has(n.key) || n.edges[opposite(i)] !== terr) continue;
        comp.set(n.key, id);
        stack.push(n);
      }
    }
    id++;
  }
  const fresh = (a: Placed, b: Placed) => a === placed || b === placed || comp.get(a.key) !== comp.get(b.key);
  let best: { a: Placed; b: Placed; d: number } | null = null;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (!fresh(a, b)) continue;
      const d = hexDistance(a.q, a.r, b.q, b.r);
      if (d < 2 || board.routesPaid.has(pairKey(kind, a.key, b.key))) continue;
      if (!best || d > best.d) best = { a, b, d };
    }
  }
  if (!best) return null;
  board.routesPaid.add(pairKey(kind, best.a.key, best.b.key));
  return { kind, d: best.d, ...routePoints(best.d) };
}

/** Quatro postos no pergaminho, da semente, sem mexer na sequência de peças. */
export function routePosts(seed: number): RoutePost[] {
  const rng = mulberry32((seed ^ 0x40e7e5) >>> 0);
  const out: RoutePost[] = [];
  for (const d of [4, 7, 10, 13]) {
    const k = Math.floor(rng() * 6);
    const j = Math.floor(rng() * d);
    const [aq, ar] = DIRS[k];
    const [bq, br] = DIRS[(k + 2) % 6];
    out.push({ q: aq * d + bq * j, r: ar * d + br * j });
  }
  return out;
}
