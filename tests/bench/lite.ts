// Motor leve da bancada: um mundo de peças hexagonais com as regras de base do Clássico (encaixe de 10 pontos, perfeito, cerco com
// peça de volta, interações) e ganchos para as ideias novas mudarem uma coisa de cada vez. Não toca no `core`: usa só as funções puras
// dele (geração de peças, `synergyOf`, relevo e água). Conferido contra o próprio `core` em `verifica.ts` (a mesma partida, jogada a
// jogada, dá os mesmos pontos): sem isso, a bancada mediria o motor e não a regra.
import { DEFAULT_RULES } from '../../src/core/board';
import { DIRS, hexDistance } from '../../src/core/hex';
import { mulberry32 } from '../../src/core/rng';
import { synergyOf } from '../../src/core/synergy';
import { T, generateTile, isStrict, type TileDef } from '../../src/core/tiles';
import type { Move, World } from './types';

/** Raio do mapa guardado (em casas): partidas de ~100 peças nunca chegam perto. */
export const RAD = 48;
const SPAN = 2 * RAD + 1;
const MAX_TILES = 512;
const cellOf = (q: number, r: number) => (q + RAD) * SPAN + (r + RAD);
const inside = (q: number, r: number) => q >= -RAD && q <= RAD && r >= -RAD && r <= RAD;
export const opp = (i: number) => (i + 3) % 6;

/** O mesmo `out[(i + rot) % 6] = base[i]` do `rotateEdges`, para qualquer tipo de dado por borda. */
export function rot6<X>(arr: readonly X[], rot: number): X[] {
  const out = new Array<X>(6);
  for (let i = 0; i < 6; i++) out[(i + rot) % 6] = arr[i];
  return out;
}

/** Uma peça vista em um giro: bordas e dados extras por borda, já na orientação do mundo. */
export interface RTile {
  edges: T[];
  aux: Record<string, number[]>;
}

/** Uma peça da pilha: as seis vistas (giros 0 a 5) são calculadas uma vez. */
export interface LTile {
  /** Semente da decoração (a do `TileDef`): dela saem os dados extras de cada regra. */
  seed: number;
  edges: T[];
  aux: Record<string, number[]>;
  views: RTile[];
}

export function makeLTile(seed: number, edges: T[], aux: Record<string, number[]> = {}): LTile {
  const views: RTile[] = [];
  for (let rot = 0; rot < 6; rot++) {
    const a: Record<string, number[]> = {};
    for (const k of Object.keys(aux)) a[k] = rot6(aux[k], rot);
    views.push({ edges: rot6(edges, rot), aux: a });
  }
  return { seed, edges, aux, views };
}

/** Uma peça colocada. Imutável (os clones a compartilham): o que muda fica em arrays indexados por `idx`. */
export interface Placed {
  q: number;
  r: number;
  idx: number;
  v: RTile;
  seed: number;
}

export interface LiteCfg {
  startTiles: number;
  waterChance: number;
  railChance: number;
  matchPoints: number;
  perfectBonus: number;
  closedBonus: number;
  closedTiles: number;
  synergyPoints: number;
}

/** Os números do Clássico (os de `DEFAULT_RULES`, sem tema): a base de toda regra leve. */
export const BASE_CFG: LiteCfg = {
  startTiles: DEFAULT_RULES.startTiles,
  waterChance: DEFAULT_RULES.waterChance,
  railChance: DEFAULT_RULES.railChance,
  matchPoints: DEFAULT_RULES.matchPoints,
  perfectBonus: DEFAULT_RULES.perfectBonus,
  closedBonus: DEFAULT_RULES.closedBonus,
  closedTiles: DEFAULT_RULES.closedTiles,
  synergyPoints: DEFAULT_RULES.synergyPoints,
};

export const STARTER_EDGES: T[] = [T.Grass, T.Grass, T.Forest, T.Forest, T.Field, T.Village];

// Marca das casas já vistas ao listar a fronteira (uma só vez por chamada; o motor roda em um único fio).
const stamp = new Int32Array(SPAN * SPAN);
let stampNo = 0;

export abstract class LiteWorld implements World {
  protected grid = new Int32Array(SPAN * SPAN);
  protected list: Placed[] = [];
  /** Peça já cercada e paga (por índice). */
  protected closed = new Uint8Array(MAX_TILES);
  /** Vizinhos já colocados de cada peça. */
  protected nbn = new Uint8Array(MAX_TILES);
  score = 0;
  placed = 0;
  discards = 0;
  stack: number;
  protected drawn = 0;
  protected cur: LTile | null = null;
  protected nxt: LTile | null = null;
  /** Peças sorteadas, por índice da pilha (compartilhado entre clones: o gerador é puro). */
  protected tiles = new Map<number, LTile>();
  protected nbs: (Placed | undefined)[] = [undefined, undefined, undefined, undefined, undefined, undefined];
  /** Peças de volta da jogada em avaliação (o mar, o cerco): o `extra` soma aqui. */
  protected exTiles = 0;
  /** Pontos do termo próprio da regra, por nome, nas jogadas já feitas (para a tabela de origem dos pontos). */
  protected got: Record<string, number> = {};
  /** Os do `extra` da jogada em avaliação (só entram em `got` ao jogar de verdade). */
  protected gotNow: Record<string, number> = {};

  // ---- ganchos das regras ----
  /** A rotina de `perfeito` e de `cerco`: a similaridade mínima de cada borda. */
  protected perfectS = 1;
  protected usePerfect = true;
  protected useClosed = true;
  /** A regra tem `extra` (precisa da peça já posta para medir). */
  protected hasExtra = false;
  /** Anota também a origem dos pontos de base (encaixe das bordas, perfeito, cerco, interações) em `parts()`. */
  protected trackBase = false;

  constructor(readonly seed: number, protected cfg: LiteCfg = BASE_CFG) {
    this.stack = cfg.startTiles;
  }

  /** (1) O gerador: a peça de índice `i` da pilha. Mesma sequência de bordas e sementes do `Game.draw`; as regras acrescentam dados extras. */
  protected makeTile(i: number): LTile {
    const rng = mulberry32((this.seed + Math.imul(i, 0x9e3779b1)) >>> 0);
    rng();
    const def = generateTile(rng, true, this.cfg.waterChance, this.cfg.railChance);
    return this.decorate(def);
  }

  /** Dados extras de uma peça sorteada. Padrão: nenhum. Sempre de um gerador derivado de `def.seed`. */
  protected decorate(def: TileDef): LTile {
    return makeLTile(def.seed, def.edges);
  }

  /** A peça do centro (as bordas fixas do `Game`; a semente vem do primeiro sorteio da semente da partida). */
  protected makeStarter(seed: number): LTile {
    return makeLTile(seed, [...STARTER_EDGES]);
  }

  /** (2) Validade de uma borda contra a da peça vizinha: rio e trilho só encostam neles mesmos. */
  protected compat(a: RTile, i: number, b: RTile, j: number): boolean {
    const x = a.edges[i], y = b.edges[j];
    return x === y || !(isStrict(x) || isStrict(y));
  }

  /** Semelhança das duas bordas, de 0 a 1 (1 = encaixe de sempre). */
  protected sim(a: RTile, i: number, b: RTile, j: number): number {
    return a.edges[i] === b.edges[j] ? 1 : 0;
  }

  /** (3) Pontos de uma borda encostada. */
  protected pay(_a: RTile, _i: number, _b: RTile, _j: number, s: number): number {
    return s >= 1 ? this.cfg.matchPoints : 0;
  }

  /** Pontos de borda além do encaixe (os degraus do relevo). */
  protected edgePts(_a: RTile, _i: number, _b: RTile, _j: number): number {
    return 0;
  }

  /** A interação entre terrenos só conta onde o encaixe não pagou. */
  protected synOpen(s: number): boolean {
    return s < 1;
  }

  /** Pontos que dependem do mundo todo (umidade, área, água). `p` já está posta; só grave estado se `commit`. */
  protected extra(_p: Placed, _commit: boolean): number {
    return 0;
  }

  /** O `extra` anota aqui de onde vieram os pontos dele (`nome`); a partida soma o que foi jogado de verdade. */
  protected note(name: string, pts: number): void {
    if (pts) this.gotNow[name] = (this.gotNow[name] ?? 0) + pts;
  }

  parts(): Record<string, number> {
    return this.got;
  }

  /** Depois de uma jogada de verdade: atualiza o estado próprio da regra. */
  protected onCommit(_p: Placed): void {}

  // ---- mundo ----
  at(q: number, r: number): Placed | undefined {
    if (!inside(q, r)) return undefined;
    const k = this.grid[cellOf(q, r)];
    return k ? this.list[k - 1] : undefined;
  }

  protected push(t: LTile, rot: number, q: number, r: number): Placed {
    const idx = this.list.length;
    const p: Placed = { q, r, idx, v: t.views[rot], seed: t.seed };
    this.list.push(p);
    this.grid[cellOf(q, r)] = idx + 1;
    for (const [dq, dr] of DIRS) {
      const n = this.at(q + dq, r + dr);
      if (n && n !== p) {
        this.nbn[n.idx]++;
        this.nbn[idx]++;
      }
    }
    return p;
  }

  protected pop(): void {
    const p = this.list.pop()!;
    this.grid[cellOf(p.q, p.r)] = 0;
    for (const [dq, dr] of DIRS) {
      const n = this.at(p.q + dq, p.r + dr);
      if (n) this.nbn[n.idx]--;
    }
    this.nbn[p.idx] = 0;
    this.closed[p.idx] = 0;
  }

  /** Começa a partida: a peça do centro e as duas primeiras da pilha (a atual e a próxima). */
  start(): this {
    const starter = this.makeStarter(Math.floor(mulberry32(this.seed)() * 2 ** 31));
    const p = this.push(starter, 0, 0, 0);
    this.onCommit(p);
    this.cur = this.tileFor(++this.drawn);
    this.nxt = this.tileFor(++this.drawn);
    return this;
  }

  protected tileFor(i: number): LTile {
    let t = this.tiles.get(i);
    if (!t) this.tiles.set(i, (t = this.makeTile(i)));
    return t;
  }

  over() {
    return this.cur === null;
  }

  /** Todos os (casa, giro) válidos da peça atual com os pontos imediatos. */
  moves(): Move[] {
    const t = this.cur;
    if (!t) return [];
    const out: Move[] = [];
    stampNo++;
    for (const p of this.list) {
      for (const [dq, dr] of DIRS) {
        const q = p.q + dq, r = p.r + dr;
        if (!inside(q, r)) continue;
        const c = cellOf(q, r);
        if (this.grid[c] !== 0 || stamp[c] === stampNo) continue;
        stamp[c] = stampNo;
        for (let rot = 0; rot < 6; rot++) {
          const e = this.evaluate(t, q, r, rot, false);
          if (e >= 0) out.push({ q, r, rot, pts: e });
        }
      }
    }
    return out;
  }

  /**
   * Avalia (e, com `commit`, faz) uma jogada: devolve os pontos, ou -1 se for inválida. As peças de volta ficam em `exTiles`.
   * A mesma conta serve para ordenar as jogadas e para pontuar: não existe uma versão "barata" que possa divergir.
   */
  protected evaluate(t: LTile, q: number, r: number, rot: number, commit: boolean): number {
    if (!inside(q, r) || this.grid[cellOf(q, r)] !== 0) return -1;
    const v = t.views[rot];
    const nbs = this.nbs;
    const cfg = this.cfg;
    let n = 0, pts = 0, syn = 0, edgeSum = 0;
    let perfect = true;
    for (let i = 0; i < 6; i++) {
      const o = this.at(q + DIRS[i][0], r + DIRS[i][1]);
      nbs[i] = o;
      if (!o) continue;
      n++;
      const j = opp(i);
      if (!this.compat(v, i, o.v, j)) return -1;
      const s = this.sim(v, i, o.v, j);
      const pay = this.pay(v, i, o.v, j, s) + this.edgePts(v, i, o.v, j);
      pts += pay;
      edgeSum += pay;
      if (s < this.perfectS) perfect = false;
      if (this.synOpen(s) && synergyOf(v.edges[i], o.v.edges[j])) syn++;
    }
    if (n === 0) return -1;
    if (this.usePerfect && n >= 2 && perfect) pts += cfg.perfectBonus;
    pts += syn * cfg.synergyPoints;
    this.exTiles = 0;
    this.gotNow = {};
    const perfectPts = this.usePerfect && n >= 2 && perfect ? cfg.perfectBonus : 0;
    let closedPts = 0;
    let newClosed: number[] | null = null;
    if (this.useClosed) {
      let c = 0;
      if (n === 6 && perfect) c++;
      for (let i = 0; i < 6; i++) {
        const o = nbs[i];
        if (o && !this.closed[o.idx] && this.nbn[o.idx] === 5 && this.closedWith(o, q, r, v)) {
          c++;
          if (commit) (newClosed ??= []).push(o.idx);
        }
      }
      pts += c * cfg.closedBonus;
      closedPts = c * cfg.closedBonus;
      this.exTiles += c * cfg.closedTiles;
      if (commit && n === 6 && perfect) (newClosed ??= []).push(this.list.length);
    }
    if (this.trackBase) {
      this.note('encaixe das bordas', edgeSum);
      this.note('perfeito', perfectPts);
      this.note('cerco da peça', closedPts);
      this.note('interações', syn * cfg.synergyPoints);
    }
    if (this.hasExtra || commit) {
      const p = this.push(t, rot, q, r);
      if (this.hasExtra) pts += this.extra(p, commit);
      if (commit) {
        if (newClosed) for (const k of newClosed) this.closed[k] = 1;
        this.onCommit(p);
      } else this.pop();
    }
    return pts;
  }

  /** A peça colocada `o`, com uma vizinha nova em (q, r), ficaria cercada por 6 bordas que encaixam? */
  private closedWith(o: Placed, q: number, r: number, v: RTile): boolean {
    for (let k = 0; k < 6; k++) {
      const nq = o.q + DIRS[k][0], nr = o.r + DIRS[k][1];
      const m = nq === q && nr === r ? v : this.at(nq, nr)?.v;
      if (!m || this.sim(o.v, k, m, opp(k)) < this.perfectS) return false;
    }
    return true;
  }

  play(m: Move): number {
    const t = this.cur;
    if (!t) throw new Error('partida acabada');
    const pts = this.evaluate(t, m.q, m.r, m.rot, true);
    if (pts < 0) throw new Error(`jogada inválida ${m.q},${m.r},${m.rot}`);
    for (const k of Object.keys(this.gotNow)) this.got[k] = (this.got[k] ?? 0) + this.gotNow[k];
    this.score += pts;
    this.placed++;
    this.stack += this.exTiles - 1;
    this.advance();
    return pts;
  }

  discard(): void {
    if (!this.cur) return;
    this.discards++;
    this.stack -= 1;
    this.advance();
  }

  private advance() {
    this.cur = this.stack > 0 ? this.nxt : null;
    this.nxt = this.tileFor(++this.drawn);
  }

  after(m: Move): Move[] {
    const w = this.clone();
    w.play(m);
    return w.moves();
  }

  // ---- clones ----
  /** Um mundo vazio da mesma regra (sem `start`). */
  protected abstract spawn(): LiteWorld;

  clone(): LiteWorld {
    const w = this.spawn();
    this.copyInto(w);
    return w;
  }

  protected copyInto(w: LiteWorld): void {
    w.grid = this.grid.slice();
    w.list = this.list.slice();
    w.closed = this.closed.slice();
    w.nbn = this.nbn.slice();
    w.score = this.score;
    w.placed = this.placed;
    w.discards = this.discards;
    w.stack = this.stack;
    w.drawn = this.drawn;
    w.cur = this.cur;
    w.nxt = this.nxt;
    w.tiles = this.tiles;
    w.got = { ...this.got };
  }

  /** Peças do mundo (a do centro é o índice 0). */
  get tilesList(): readonly Placed[] {
    return this.list;
  }
}

/** Distância em casas entre duas peças colocadas. */
export const dist = (a: { q: number; r: number }, b: { q: number; r: number }) => hexDistance(a.q, a.r, b.q, b.r);
