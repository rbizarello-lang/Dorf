import { type BlessingId, blessingOffer } from './blessings';
import { Board, type PlaceResult, type Rules } from './board';
import { unkey } from './hex';
import { mulberry32, type Rng } from './rng';
import { generateSites } from './sites';
import { type SpecialKind, specialSlots, specialTile } from './specials';
import { T, generateTile, rotateEdges, type TileDef } from './tiles';

export interface Move {
  q: number;
  r: number;
  rot: number;
  score: number;
}

export class Game {
  readonly board: Board;
  readonly rng: Rng;
  stack: number;
  current: TileDef | null;
  next: TileDef;
  rot = 0;
  placedCount = 0;
  discarded = 0;
  private drawn = 0;
  /**
   * Escolhas de era ainda por fazer, a mais antiga primeiro. Não travam a partida: a carta
   * vale da jogada seguinte à escolha em diante, e o save guarda a escolha junto da jogada
   * depois da qual ela foi feita.
   */
  offers: [BlessingId, BlessingId][] = [];
  /** Índice da pilha → peça especial liberada que sai nele. */
  private slots: Map<number, SpecialKind>;

  constructor(
    readonly seed: number,
    readonly rules: Rules,
    /** Peças especiais liberadas que entram nesta partida (vazio no Desafio do dia). */
    readonly specials: readonly SpecialKind[] = [],
  ) {
    this.rng = mulberry32(seed);
    this.slots = specialSlots(seed, specials);
    this.board = new Board(rules);
    const starter: TileDef = {
      edges: [T.Grass, T.Grass, T.Forest, T.Forest, T.Field, T.Village],
      seed: Math.floor(this.rng() * 2 ** 31),
      quest: null,
    };
    this.board.placeRaw(0, 0, starter, 0);
    this.board.computeGroups();
    this.board.sites = generateSites(seed, rules.sites);
    this.stack = rules.startTiles;
    this.current = this.draw();
    this.next = this.draw();
  }

  get over() {
    return this.current === null;
  }

  /**
   * Cada peça tem um gerador próprio (semente + índice) e sempre consome os mesmos
   * sorteios. Assim, a mesma semente dá a mesma sequência de peças para qualquer
   * jogador; só a presença da missão depende do estado da partida. Uma peça especial
   * liberada toma o lugar da peça do seu índice, sem mexer nas outras.
   */
  private draw(): TileDef {
    const rng = mulberry32((this.seed + Math.imul(++this.drawn, 0x9e3779b1)) >>> 0);
    const kind = this.slots.get(this.drawn);
    if (kind) return specialTile(rng, kind);
    const roll = rng();
    const def = generateTile(rng, true);
    // Missões ainda na mão (atual e próxima) contam para o limite.
    let pending = 0;
    for (const t of new Set([this.current, this.next])) if (t?.quest) pending++;
    const active = this.board.activeQuests().length + pending;
    if (!(active < this.rules.maxQuests && roll < this.rules.questChance)) def.quest = null;
    return def;
  }

  /**
   * As `n` peças depois da próxima, sem sorteá-las (o mirante as mostra). Só as bordas:
   * a missão de cada uma depende do estado da partida quando ela for sorteada.
   */
  upcoming(n: number): TileDef[] {
    const out: TileDef[] = [];
    for (let k = 1; k <= n; k++) {
      const rng = mulberry32((this.seed + Math.imul(this.drawn + k, 0x9e3779b1)) >>> 0);
      const kind = this.slots.get(this.drawn + k);
      if (kind) {
        out.push(specialTile(rng, kind));
        continue;
      }
      rng();
      out.push({ ...generateTile(rng, true), quest: null });
    }
    return out;
  }

  currentEdges() {
    return this.current ? rotateEdges(this.current.edges, this.rot) : null;
  }

  rotate(dir: 1 | -1) {
    this.rot = (this.rot + dir + 6) % 6;
  }

  check(q: number, r: number) {
    const edges = this.currentEdges();
    return edges ? this.board.check(q, r, edges) : null;
  }

  place(q: number, r: number): PlaceResult | null {
    const def = this.current;
    if (!def) return null;
    const c = this.check(q, r);
    if (!c?.valid) return null;
    const era = this.board.era;
    const res = this.board.place(q, r, def, this.rot);
    this.placedCount++;
    // Uma jogada pode abrir mais de uma era; cada uma traz a sua escolha. Cartas já escolhidas
    // ou ainda na mesa não voltam.
    if (this.rules.blessings) for (let e = era + 1; e <= this.board.era; e++) this.offers.push(blessingOffer(this.seed, e, [...this.board.blessings, ...this.offers.flat()]));
    if (!this.rules.infinite) this.stack += res.tilesGained - 1;
    // Exploradores: achou o último sítio, a partida acaba e cada peça que sobrou vale pontos.
    if (this.rules.endOnSites && this.board.sites.length && this.board.sitesLeft() === 0) {
      const bonus = Math.max(0, this.stack) * this.rules.leftoverPoints;
      this.board.score += bonus;
      res.points += bonus;
      res.leftoverBonus = bonus;
      this.stack = 0;
    }
    this.advance();
    return res;
  }

  /** Escolhe a carta 0 ou 1 da escolha de era mais antiga; devolve a carta, ou null se não havia escolha. */
  choose(pick: number): BlessingId | null {
    const offer = this.offers.shift();
    if (!offer) return null;
    const id = offer[pick === 1 ? 1 : 0];
    this.board.bless(id);
    return id;
  }

  /** Avança para a próxima peça. */
  private advance() {
    this.rot = 0;
    this.current = this.stack > 0 ? this.next : null;
    this.next = this.draw();
  }

  /** Descarta a peça atual quando ela não cabe em lugar nenhum. */
  discardIfStuck(): boolean {
    if (!this.current || this.hasAnyMove(this.current)) return false;
    this.discarded++;
    if (!this.rules.infinite) this.stack -= 1;
    this.advance();
    return true;
  }

  hasAnyMove(def: TileDef) {
    for (const k of this.board.frontier) {
      const [q, r] = unkey(k);
      for (let rot = 0; rot < 6; rot++) if (this.board.check(q, r, rotateEdges(def.edges, rot)).valid) return true;
    }
    return false;
  }

  /**
   * Jogada gulosa (modo demonstração e teste de carga). O desempate usa um gerador à parte
   * (Math.random por padrão), para não mexer na sequência de peças.
   */
  bestMove(rand: () => number = Math.random): Move | null {
    const def = this.current;
    if (!def) return null;
    let best: Move | null = null;
    for (const k of this.board.frontier) {
      const [q, r] = unkey(k);
      for (let rot = 0; rot < 6; rot++) {
        const c = this.board.check(q, r, rotateEdges(def.edges, rot));
        if (!c.valid) continue;
        const score = c.matches * 3 - (c.neighbors - c.matches) * 2 + (c.matches === c.neighbors ? c.neighbors : 0) + rand() * 0.5;
        if (!best || score > best.score) best = { q, r, rot, score };
      }
    }
    return best;
  }
}
