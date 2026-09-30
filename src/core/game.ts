import { Board, type PlaceResult, type Rules } from './board';
import { unkey } from './hex';
import { mulberry32, type Rng } from './rng';
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

  constructor(
    readonly seed: number,
    readonly rules: Rules,
  ) {
    this.rng = mulberry32(seed);
    this.board = new Board(rules);
    const starter: TileDef = {
      edges: [T.Grass, T.Grass, T.Forest, T.Forest, T.Field, T.Village],
      seed: Math.floor(this.rng() * 2 ** 31),
      quest: null,
    };
    this.board.placeRaw(0, 0, starter, 0);
    this.board.computeGroups();
    this.stack = rules.startTiles;
    this.current = this.draw();
    this.next = this.draw();
  }

  get over() {
    return this.current === null;
  }

  private draw(): TileDef {
    const active = this.board.activeQuests().length;
    const withQuest = active < this.rules.maxQuests && this.rng() < this.rules.questChance;
    return generateTile(this.rng, withQuest);
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
    const res = this.board.place(q, r, def, this.rot);
    this.placedCount++;
    this.stack += res.tilesGained - 1;
    this.advance();
    return res;
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
    this.stack -= 1;
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

  /** Jogada gulosa (modo demonstração e teste de carga). Usa Math.random para não mexer na sequência de peças. */
  bestMove(): Move | null {
    const def = this.current;
    if (!def) return null;
    let best: Move | null = null;
    for (const k of this.board.frontier) {
      const [q, r] = unkey(k);
      for (let rot = 0; rot < 6; rot++) {
        const c = this.board.check(q, r, rotateEdges(def.edges, rot));
        if (!c.valid) continue;
        const score = c.matches * 3 - (c.neighbors - c.matches) * 2 + (c.matches === c.neighbors ? c.neighbors : 0) + Math.random() * 0.5;
        if (!best || score > best.score) best = { q, r, rot, score };
      }
    }
    return best;
  }
}
