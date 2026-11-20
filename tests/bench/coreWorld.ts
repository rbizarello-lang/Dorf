// Mundo da bancada sobre o `Game` do núcleo: as regras do próprio jogo (Clássico, Relevo) rodam como são, sem cópia da lógica.
// `moves()` dá os pontos imediatos de cada jogada pelo `Board.check` (sem clonar o tabuleiro 300 vezes por jogada); `play()` usa o
// `Game.place` de verdade, então o placar final é o do jogo. Os dois só divergem no que o `check` não vê (missões, eras, cartas,
// maravilha, rotas): em `verifica.ts` a diferença é conferida (zero nas regras de base, sem essas camadas).
import { DEFAULT_RULES, type Board, type Check, type Rules } from '../../src/core/board';
import { Game } from '../../src/core/game';
import { DIRS, opposite, unkey } from '../../src/core/hex';
import { SITE_REWARD } from '../../src/core/sites';
import { rotateEdges, type T, type TileDef } from '../../src/core/tiles';
import type { Move, World } from './types';

/** As regras de base do Clássico: sem missões, eras, sítios, maravilha, cartas, estação nem influência. Só encaixe, perfeito, cerco e interações. */
export const baseRules = (): Rules => ({
  ...DEFAULT_RULES,
  questChance: 0,
  maxQuests: 0,
  sites: 0,
  wonderStages: 0,
  blessings: false,
  eraScores: [0],
  seasonBonus: false,
  influence: false,
});

/** O Relevo com água sobre a base: altura por peça, degraus, cachoeiras, nascentes, rio até o mar. Sem as nascentes escondidas (a bancada leve não as tem). */
export const reliefBaseRules = (): Rules => ({
  ...baseRules(),
  relief: true,
  stepPoints: 3,
  fallPoints: 5,
  springs: true,
  flowPoints: 8,
  seaPoints: 60,
  seaTiles: 2,
  waterChance: 0.24,
  hiddenSprings: 0,
  hiddenSpringPoints: 0,
});

/** Casas cercadas por 6 vizinhas que encaixam depois de pôr `edges` em (q, r): a peça nova e as vizinhas que ainda não estavam pagas. */
function closedCount(b: Board, q: number, r: number, edges: readonly T[]): number {
  const edgeAt = (x: number, y: number): readonly T[] | undefined => (x === q && y === r ? edges : b.get(x, y)?.edges);
  const sealed = (cq: number, cr: number, own: readonly T[]) => {
    for (let i = 0; i < 6; i++) {
      const n = edgeAt(cq + DIRS[i][0], cr + DIRS[i][1]);
      if (!n || n[opposite(i)] !== own[i]) return false;
    }
    return true;
  };
  let c = sealed(q, r, edges) ? 1 : 0;
  for (const [dq, dr] of DIRS) {
    const n = b.get(q + dq, r + dr);
    if (n && !n.closed && sealed(n.q, n.r, n.edges)) c++;
  }
  return c;
}

/** O ganho imediato de uma jogada válida (o que o `Board.place` soma pelo `check`, mais o cerco). */
function value(b: Board, q: number, r: number, edges: readonly T[], c: Check): number {
  const R = b.rules;
  let v = c.matches * R.matchPoints;
  if (c.neighbors >= 2 && c.matches === c.neighbors) v += R.perfectBonus;
  v += c.synergies.length * R.synergyPoints + c.steps * R.stepPoints + c.falls * R.fallPoints;
  v += (c.water?.gain ?? 0) + c.influence.points;
  if (c.site) v += SITE_REWARD[c.site.kind].points;
  for (let i = 0; i < 6; i++) if (c.edgeState[i] === 1) v += R.matchBonus[edges[i]] ?? 0;
  for (const h of c.synergies) v += R.synergyBonus[h.kind] ?? 0;
  return v + closedCount(b, q, r, edges) * R.closedBonus;
}

/** Todas as jogadas válidas de `def` no tabuleiro `b`, com os pontos imediatos. */
export function movesOn(b: Board, def: TileDef): Move[] {
  const out: Move[] = [];
  for (const k of b.frontier) {
    const [q, r] = unkey(k);
    for (let rot = 0; rot < 6; rot++) {
      const c = b.checkDef(q, r, def, rot);
      if (c.valid) out.push({ q, r, rot, pts: value(b, q, r, rotateEdges(def.edges, rot), c) });
    }
  }
  return out;
}

export class CoreWorld implements World {
  readonly game: Game;

  constructor(seed: number, rules: Rules) {
    this.game = new Game(seed, rules, []);
  }

  get score() {
    return this.game.board.score;
  }
  get placed() {
    return this.game.placedCount;
  }
  get discards() {
    return this.game.discarded;
  }
  get stack() {
    return this.game.stack;
  }

  over() {
    return this.game.current === null;
  }

  moves(): Move[] {
    const def = this.game.current;
    return def ? movesOn(this.game.board, def) : [];
  }

  play(m: Move): number {
    this.game.rot = m.rot;
    const res = this.game.place(m.q, m.r);
    if (!res) throw new Error(`jogada inválida ${m.q},${m.r},${m.rot}`);
    // A carta da era é sempre a primeira das duas (como no `tests/balance.ts`).
    while (this.game.offers.length) this.game.choose(0);
    return res.points;
  }

  discard() {
    this.game.discardIfStuck();
  }

  after(m: Move): Move[] {
    const g = this.game;
    const def = g.current;
    if (!def) return [];
    const b = g.board.clone();
    const res = b.place(m.q, m.r, def, m.rot);
    if (!g.rules.infinite && g.stack - 1 + (g.rules.fixedStack ? 0 : res.tilesGained) <= 0) return [];
    return movesOn(b, g.next);
  }

  native(rand: () => number): Move | null {
    const m = this.game.bestMove(rand);
    return m && { q: m.q, r: m.r, rot: m.rot, pts: 0 };
  }
}
