// Águas que descem (modo Relevo): a água tem origem, direção e fim, e quem manda é o chão. Núcleo puro e determinístico.
//
// Regra: uma peça de rio no nível 1 ou 2 pode ser uma NASCENTE (sorteada pela semente da própria peça, num gerador à
// parte: a sequência de peças não muda). O curso parte da nascente e só desce: de uma peça de água para a vizinha de água
// que está no mesmo nível ou abaixo. Cada peça com água corrente rende `flowPoints`; quando o curso chega ao "mar" (um
// lago, de 3 bordas de água ou mais, ou uma peça de água no nível 0) rende `seaPoints` e `seaTiles` peças, uma vez por
// nascente. Água que não vem de nenhuma nascente por um caminho que só desce é água parada: vale 0 e nunca proíbe a jogada.
//
// Tudo é função do tabuleiro (peças, bordas e níveis): sem estado guardado, então replay, desfazer e prévia batem sempre.
// Os pontos são a diferença entre o total depois e antes, e o total só cresce com peças novas.
import { DIRS, hexDistance, hkey, opposite } from './hex';
import { levelAt } from './relief';
import { mulberry32 } from './rng';
import { T } from './tiles';

export interface WaterTile {
  q: number;
  r: number;
  /** Bordas em orientação de mundo. */
  edges: readonly T[];
  /** Nível da peça (peça de rio é plana, então é o de qualquer borda). */
  level: number;
  spring: boolean;
}

export interface WaterState {
  /** Peças com água corrente: sentido em cada borda de água (+1 sai, -1 entra, 0 sem água naquela borda). */
  flow: Map<number, number[]>;
  /** Nascentes cujo curso chegou ao mar. */
  reached: Set<number>;
}

/** Chance de uma peça de rio com no máximo 2 bordas de água, acima do nível 0, ser nascente. */
export const SPRING_CHANCE = 0.3;
const SALT = 0x5b21d;

/** Uma peça de rio no nível 1 ou mais, com 1 ou 2 bordas de água (nem lago nem terra seca), pode ser nascente. */
export function springEligible(edges: readonly T[], level: number): boolean {
  if (level < 1) return false;
  const n = edges.filter((e) => e === T.Water).length;
  return n >= 1 && n <= 2;
}

/** A peça (semente `seed`, bordas `edges`, nível `level`) é nascente? Hash puro da semente da peça. */
export function isSpring(seed: number, edges: readonly T[], level: number): boolean {
  if (!springEligible(edges, level)) return false;
  let h = Math.imul((seed ^ SALT) | 0, 2654435761);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296 < SPRING_CHANCE;
}

// ---------------------------------------------------------------------------------------------------------------------
// Nascentes escondidas: além das que vêm na peça (`isSpring`, o sorteio da própria peça), o mapa guarda casas onde brota uma
// nascente que ninguém vê. Saem da semente por um gerador à parte (como os sítios), nas casas de altura máxima do relevo da
// semente (`levelAt` = 2: é no alto que a água nasce), então não mexem na sequência de peças. A casa só se revela quando uma
// peça com água encosta nela (vizinha) ou pousa nela; uma peça de rio no nível 1 ou mais, com 1 ou 2 bordas de água, que
// pouse ali vira a nascente. Revelar é função do tabuleiro (sem estado): replay, desfazer e prévia batem sempre.
// ---------------------------------------------------------------------------------------------------------------------

export interface SpringSite {
  q: number;
  r: number;
}

/** Faixas de distância do Centro (em casas) onde as nascentes escondidas aparecem, da mais perto à mais longe. */
const SPRING_RINGS: ReadonlyArray<readonly [number, number]> = [[4, 6], [5, 8], [7, 10], [9, 12]];
/** Distância mínima entre duas nascentes escondidas. */
const SPRING_GAP = 4;

/** `count` casas de nascente escondida para a semente `seed`: puro e determinístico, e mexe só no próprio gerador. */
export function generateHiddenSprings(seed: number, count: number): SpringSite[] {
  if (count <= 0) return [];
  const rng = mulberry32((seed ^ 0x3c6ef372) >>> 0);
  const out: SpringSite[] = [];
  for (let i = 0; i < count; i++) {
    const [lo, hi] = SPRING_RINGS[Math.min(SPRING_RINGS.length - 1, i)];
    const cands: SpringSite[] = [];
    for (let q = -hi; q <= hi; q++) {
      for (let r = Math.max(-hi, -q - hi); r <= Math.min(hi, -q + hi); r++) {
        const d = hexDistance(q, r, 0, 0);
        if (d < lo || d > hi || levelAt(seed, q, r, 2) !== 2) continue;
        if (out.some((s) => hexDistance(s.q, s.r, q, r) < SPRING_GAP)) continue;
        cands.push({ q, r });
      }
    }
    // Sorteia sempre (mesmo sem candidata), para o resto do gerador não depender de quantas houve.
    const pick = rng();
    if (cands.length) out.push(cands[Math.floor(pick * cands.length)]);
  }
  return out;
}

/** A casa (q, r) é de uma nascente escondida? */
export const hiddenSpringAt = (sites: readonly SpringSite[], q: number, r: number) => sites.some((s) => s.q === q && s.r === r);

/** A nascente escondida da casa (q, r) já se revelou? Com uma peça de água vizinha dela (ou em cima: aí ela já virou nascente). */
export function springRevealed(sites: readonly SpringSite[], q: number, r: number, hasWater: (q: number, r: number) => boolean): boolean {
  if (!hiddenSpringAt(sites, q, r)) return false;
  if (hasWater(q, r)) return true;
  return DIRS.some(([dq, dr]) => hasWater(q + dq, r + dr));
}

const waterEdges = (t: WaterTile) => t.edges.filter((e) => e === T.Water).length;
/** O "mar": um lago (3+ bordas de água) ou água no nível 0. */
export const isSea = (t: WaterTile) => t.level === 0 || waterEdges(t) >= 3;

export function waterState(tiles: readonly WaterTile[]): WaterState {
  const byKey = new Map<number, WaterTile>();
  for (const t of tiles) byKey.set(hkey(t.q, t.r), t);
  const flow = new Map<number, number[]>();
  const reached = new Set<number>();
  for (const s of tiles) {
    if (!s.spring) continue;
    const sk = hkey(s.q, s.r);
    const seen = new Set<number>([sk]);
    const queue = [s];
    let sea = false;
    while (queue.length) {
      const a = queue.shift()!;
      const ak = hkey(a.q, a.r);
      let f = flow.get(ak);
      if (!f) flow.set(ak, (f = a.edges.map((e) => (e === T.Water ? 1 : 0))));
      for (let e = 0; e < 6; e++) {
        if (a.edges[e] !== T.Water) continue;
        const b = byKey.get(hkey(a.q + DIRS[e][0], a.r + DIRS[e][1]));
        if (!b || b.edges[opposite(e)] !== T.Water || b.level > a.level) continue;
        const bk = hkey(b.q, b.r);
        // A borda por onde a água entra em `b` deixa de ser saída.
        let g = flow.get(bk);
        if (!g) flow.set(bk, (g = b.edges.map((x) => (x === T.Water ? 1 : 0))));
        g[opposite(e)] = -1;
        if (seen.has(bk)) continue;
        seen.add(bk);
        if (isSea(b)) sea = true;
        queue.push(b);
      }
    }
    if (sea) reached.add(sk);
  }
  return { flow, reached };
}

/** Pontos e peças pelo que a água rende no estado `st`. */
export const waterScore = (st: WaterState, flowPoints: number, seaPoints: number) => st.flow.size * flowPoints + st.reached.size * seaPoints;
