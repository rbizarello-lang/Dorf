// Regras da Ilha das Lanternas. Puro e determinístico: sem three, sem DOM, sem Math.random.
import { CELLS, CENTER, LIT, N, NB, NB_DIR, dist } from './hex';
import { Find, IslandMap, Terrain, generateIsland } from './map';
import { mulberry32, shuffle, subSeed } from './rng';

export const Card = { House: 0, Field: 1, Olive: 2, Lantern: 3, Dock: 4 } as const;
export const CARD_NAMES = ['Casa', 'Campo', 'Oliveiral', 'Lanterna', 'Cais'];
export const Struct = { None: 0, House: 1, Field: 2, Olive: 3, Lantern: 4, Dock: 5 } as const;

export const GoalId = { Tip: 0, Residents: 1, Finds: 2, Row: 3, Light: 4 } as const;
export const GOAL_COUNT = 5;

/** Todos os números ajustáveis num lugar só (ver docs/simulacao.md para o porquê de cada um). */
export const RULES = {
  turns: 30,
  nights: [10, 20, 30],
  startFood: 2,
  startOil: 2,
  handSize: 3,
  houseCostFood: 5,
  /** Festa da noite: cada feastFood de comida guardada vira +1 morador (até feastCap por noite) e o estoque zera. */
  feastFood: 5,
  feastCap: 12,
  /** Convidados que uma casa guarda da festa, além do teto da variedade (houseMax). */
  feastExtra: 4,
  lanternCostOil: 4,
  discardOil: 1,
  /** Óleo que cada lanterna (menos o Farol) queima numa noite. */
  nightOil: 2,
  houseMax: 4,
  ruinResidents: 3,
  dockFishBonus: 2,
  goalPoints: 5,
  residentsGoal: 66,
  findsGoal: 5,
  rowGoal: 4,
  lightGoal: 0.8,
  /** Composição do baralho (cartas por tipo), na ordem de Card. */
  deck: [16, 10, 10, 13, 9],
};

export type Action =
  | { kind: 'play'; slot: number; idx: number }
  | { kind: 'discard'; slot: number };

export interface Summary {
  score: number;
  residents: number;
  goals: number[];      // metas atribuídas
  goalsMet: boolean[];  // se cada uma foi cumprida
  litPct: number;       // % da terra revelada
  finds: number;
}

export class Game {
  readonly seed: number;
  map: IslandMap;
  readonly goals: number[];
  readonly goalTarget: number;      // moradores da meta
  struct: Uint8Array;
  revealed: Uint8Array;
  lost: Uint8Array;                 // moradores perdidos nas noites, por casa
  feast: Uint8Array;                // moradores ganhos nas festas, por casa
  houses: number[] = [];
  prod: number[] = [];              // campos, oliveirais e cais
  lanterns: number[] = [];
  food = RULES.startFood;
  oil = RULES.startOil;
  turn = 1;
  deck: number[] = [];
  hand: number[] = [];
  litLand = 0;
  foundCount = 0;
  ruinsFound = 0;
  stuckTurns = 0;                   // turnos em que nenhuma carta do baralho cabia em lugar nenhum
  fixedHands = 0;                   // mãos refeitas pela regra da mão garantida
  discards = 0;
  /** Uma entrada por noite: comida no estoque antes da festa, moradores que a festa pôs e comida perdida. */
  feasts: Array<{ food: number; placed: number; lost: number; rest: number }> = [];
  log: string[] = [];

  constructor(seed: number, from?: Game, blind = false) {
    this.seed = seed;
    if (from) {
      // Cópia "cega" (para os bots): os achados ainda sob a névoa somem do mapa, então avaliar uma jogada não espia a névoa.
      this.map = blind ? { ...from.map, finds: from.map.finds.map((f, i) => (from.revealed[i] ? f : 0)) } : from.map;
      this.goals = from.goals; this.goalTarget = from.goalTarget;
      this.struct = from.struct.slice(); this.revealed = from.revealed.slice(); this.lost = from.lost.slice(); this.feast = from.feast.slice();
      this.houses = from.houses.slice(); this.prod = from.prod.slice(); this.lanterns = from.lanterns.slice();
      this.food = from.food; this.oil = from.oil; this.turn = from.turn;
      this.deck = from.deck.slice(); this.hand = from.hand.slice();
      this.litLand = from.litLand; this.foundCount = from.foundCount; this.ruinsFound = from.ruinsFound;
      this.stuckTurns = from.stuckTurns; this.fixedHands = from.fixedHands; this.discards = from.discards; this.feasts = from.feasts.slice();
      return;
    }
    this.map = generateIsland(seed);
    this.struct = new Uint8Array(N);
    this.revealed = new Uint8Array(N);
    this.lost = new Uint8Array(N);
    this.feast = new Uint8Array(N);
    const goalRng = mulberry32(subSeed(seed, 4));
    this.goals = shuffle([0, 1, 2, 3, 4], goalRng).slice(0, 3).sort((a, b) => a - b);
    this.goalTarget = RULES.residentsGoal;
    // Baralho: composição fixa, embaralhada pela semente.
    const cards: number[] = [];
    RULES.deck.forEach((n, c) => { for (let k = 0; k < n; k++) cards.push(c); });
    this.deck = shuffle(cards, mulberry32(subSeed(seed, 3)));
    // O Farol velho no centro, já aceso.
    this.struct[CENTER] = Struct.Lantern;
    this.lanterns.push(CENTER);
    this.lightUp(CENTER);
    this.dealHand();
  }

  clone(blind = false): Game { return new Game(this.seed, this, blind); }

  get over(): boolean { return this.turn > RULES.turns; }
  get nightsLeft(): number { return RULES.nights.filter((n) => n >= this.turn).length; }
  get turnsLeft(): number { return Math.max(0, RULES.turns - this.turn + 1); }

  // ---------- luz ----------
  private lightUp(idx: number): void {
    for (const c of LIT[idx]) {
      if (this.revealed[c]) continue;
      this.revealed[c] = 1;
      if (this.map.terrain[c] !== Terrain.Water) this.litLand++;
      const f = this.map.finds[c];
      if (f !== Find.None) {
        this.foundCount++;
        if (f === Find.Ruin) this.ruinsFound++;
      }
    }
  }

  /** Casa protegida na noite: encostada numa lanterna (ou o farol). */
  houseLit(h: number): boolean {
    for (const n of NB[h]) if (this.struct[n] === Struct.Lantern) return true;
    return false;
  }

  // ---------- validade ----------
  /** Não há mais terra vazia sob a luz: a Lanterna ganha o alcance de socorro (veja canPlace). */
  private noLitSpot(): boolean {
    for (let i = 0; i < N; i++) {
      if (this.revealed[i] && this.struct[i] === Struct.None && this.map.finds[i] === Find.None && this.map.terrain[i] !== Terrain.Water) return false;
    }
    return true;
  }

  /**
   * A carta pode ser jogada em `idx`? (inclui o custo)
   * Regra de socorro: se a luz não tem mais nenhuma terra vazia, a Lanterna pode ir a uma terra vazia
   * da névoa encostada na luz; senão a partida travaria de vez. `rescue` vem de noLitSpot (calculado uma vez).
   */
  canPlace(card: number, idx: number, rescue = false): boolean {
    if (this.struct[idx] !== Struct.None || this.map.finds[idx] !== Find.None) return false;
    const t = this.map.terrain[idx];
    if (!this.revealed[idx]) {
      return rescue && card === Card.Lantern && this.oil >= RULES.lanternCostOil && t !== Terrain.Water
        && NB[idx].some((n) => this.revealed[n]);
    }
    switch (card) {
      case Card.House: return this.food >= RULES.houseCostFood && (t === Terrain.Meadow || t === Terrain.Wood || t === Terrain.Beach);
      case Card.Field: return t === Terrain.Meadow;
      case Card.Olive: return t === Terrain.Meadow || t === Terrain.Rock;
      case Card.Lantern: return this.oil >= RULES.lanternCostOil && t !== Terrain.Water;
      case Card.Dock: return t === Terrain.Beach && NB[idx].some((n) => this.map.terrain[n] === Terrain.Water);
      default: return false;
    }
  }

  placements(card: number): number[] {
    const rescue = card === Card.Lantern && this.noLitSpot();
    const out: number[] = [];
    for (let i = 0; i < N; i++) if (this.canPlace(card, i, rescue)) out.push(i);
    return out;
  }

  playable(card: number): boolean {
    const rescue = card === Card.Lantern && this.noLitSpot();
    for (let i = 0; i < N; i++) if (this.canPlace(card, i, rescue)) return true;
    return false;
  }

  // ---------- moradores ----------
  /** Moradores de uma casa agora: 1 + tipos distintos vizinhos (+1 Pomar), no máximo 4, menos as perdas da noite. */
  houseResidents(h: number): number {
    let campo = 0, bosque = 0, agua = 0, lant = 0, pomar = 0;
    for (const n of NB[h]) {
      const s = this.struct[n], t = this.map.terrain[n];
      if (s === Struct.Field) campo = 1;
      if (s === Struct.Lantern) lant = 1;
      if (t === Terrain.Wood && s === Struct.None) bosque = 1;
      if (t === Terrain.Water || t === Terrain.Beach) agua = 1;
      if (this.revealed[n] && this.map.finds[n] === Find.Orchard) pomar = 1;
    }
    const v = Math.min(RULES.houseMax, 1 + campo + bosque + agua + lant + pomar + pomar) + this.feast[h];
    return Math.max(0, v - this.lost[h]);
  }

  /** Cada Pomar vizinho vale +1; o tipo "Pomar" também conta na variedade (por isso pomar entra duas vezes acima). */
  residents(): number {
    let r = this.ruinsFound * RULES.ruinResidents;
    for (const h of this.houses) r += this.houseResidents(h);
    return r;
  }

  // ---------- produção ----------
  foodIncome(): number {
    let f = 0;
    for (const p of this.prod) {
      const s = this.struct[p];
      if (s === Struct.Field) {
        f += 1;
        for (const n of NB[p]) if (this.revealed[n] && this.map.finds[n] === Find.Spring) f += 1;
      } else if (s === Struct.Dock) {
        f += 1;
        for (const n of NB[p]) if (this.revealed[n] && this.map.finds[n] === Find.Fish) { f += RULES.dockFishBonus; break; }
      }
    }
    return f;
  }
  oilIncome(): number {
    let o = 0;
    for (const p of this.prod) if (this.struct[p] === Struct.Olive) o++;
    return o;
  }

  // ---------- metas ----------
  tipDistance(): number {
    let best = 99;
    for (const l of this.lanterns) best = Math.min(best, dist(l, this.map.tip));
    return best;
  }
  longestRow(): number {
    let best = this.houses.length ? 1 : 0;
    for (const h of this.houses) {
      for (let d = 0; d < 3; d++) {
        let len = 1, c = NB_DIR[h][d];
        while (c >= 0 && this.struct[c] === Struct.House) { len++; c = NB_DIR[c][d]; }
        if (len > best) best = len;
      }
    }
    return best;
  }
  litFraction(): number { return this.litLand / this.map.landCount; }

  /** Progresso 0..1 de uma meta (1 = cumprida). */
  goalProgress(g: number): number {
    switch (g) {
      case GoalId.Tip: return this.struct[this.map.tip] === Struct.Lantern ? 1 : 0;
      case GoalId.Residents: return Math.min(1, this.residents() / this.goalTarget);
      case GoalId.Finds: return Math.min(1, this.foundCount / RULES.findsGoal);
      case GoalId.Row: return Math.min(1, this.longestRow() / RULES.rowGoal);
      case GoalId.Light: return Math.min(1, this.litFraction() / RULES.lightGoal);
      default: return 0;
    }
  }
  goalMet(g: number): boolean { return this.goalProgress(g) >= 1; }
  goalsMetCount(): number { return this.goals.reduce((n, g) => n + (this.goalMet(g) ? 1 : 0), 0); }
  score(): number { return this.residents() + RULES.goalPoints * this.goalsMetCount(); }

  summary(): Summary {
    return {
      score: this.score(), residents: this.residents(), goals: this.goals.slice(),
      goalsMet: this.goals.map((g) => this.goalMet(g)), litPct: this.litFraction(), finds: this.foundCount,
    };
  }

  // ---------- jogada ----------
  /** Aplica só a colocação (custo + efeito + luz). Usado pelos bots para avaliar sem fechar o turno. */
  place(card: number, idx: number): void {
    switch (card) {
      case Card.House: this.food -= RULES.houseCostFood; this.struct[idx] = Struct.House; this.houses.push(idx); break;
      case Card.Field: this.struct[idx] = Struct.Field; this.prod.push(idx); break;
      case Card.Olive: this.struct[idx] = Struct.Olive; this.prod.push(idx); break;
      case Card.Dock: this.struct[idx] = Struct.Dock; this.prod.push(idx); break;
      case Card.Lantern:
        this.oil -= RULES.lanternCostOil; this.struct[idx] = Struct.Lantern; this.lanterns.push(idx);
        this.lightUp(idx);
        break;
    }
  }

  /**
   * Noite: cada lanterna (menos o Farol velho) queima RULES.nightOil de óleo, na ordem em que foi acesa;
   * sem óleo ela apaga naquela noite. Depois vem a festa. Casa sem lanterna acesa encostada perde 1 morador.
   */
  private night(): void {
    const lit = new Uint8Array(N);
    for (const l of this.lanterns) {
      if (l === CENTER) { lit[l] = 1; continue; }
      if (this.oil >= RULES.nightOil) { this.oil -= RULES.nightOil; lit[l] = 1; }
    }
    // Festa: a comida guardada vira moradores nas casas iluminadas com vaga; o resto do estoque se perde.
    {
      const n0 = Math.min(RULES.feastCap, Math.floor(this.food / RULES.feastFood));
      let n = n0;
      // Convidados em rodízio entre as casas iluminadas com vaga, na ordem em que foram construídas.
      const open = this.houses.filter((h) => NB[h].some((c) => lit[c]));
      for (let again = true; again && n > 0;) {
        again = false;
        for (const h of open) {
          if (n <= 0) break;
          if (this.feastRoom(h) > 0) { this.feast[h]++; n--; again = true; }
        }
      }
      const placed = n0 - n;
      // Perda = comida que passa do teto da noite ou não acha casa iluminada com vaga; o resto da divisão fica à parte.
      const rest = this.food % RULES.feastFood;
      this.feasts.push({ food: this.food, placed, lost: this.food - placed * RULES.feastFood - rest, rest });
      this.food = 0;
    }
    for (const h of this.houses) {
      if (this.houseResidents(h) <= 0) continue;
      if (!NB[h].some((n) => lit[n])) this.lost[h]++;
    }
  }

  /** Quanto a casa ainda comporta de moradores de festa. */
  feastRoom(h: number): number { return RULES.feastExtra - this.feast[h]; }

  /** Moradores que a festa daria com `food` de comida (casas com lanterna encostada e vaga). */
  feastGain(food = this.food): number {
    let room = 0;
    for (const h of this.houses) if (this.houseLit(h)) room += Math.max(0, this.feastRoom(h));
    return Math.min(RULES.feastCap, Math.floor(food / RULES.feastFood), room);
  }

  /** Óleo que as lanternas pedem numa noite (para a interface e para o planejador). */
  nightUpkeep(): number { return (this.lanterns.length - 1) * RULES.nightOil; }

  /** Joga a carta da mão `slot` em `idx` e fecha o turno. Devolve false se for ilegal. */
  play(slot: number, idx: number): boolean {
    if (this.over || slot < 0 || slot >= this.hand.length) return false;
    const card = this.hand[slot];
    if (!this.canPlace(card, idx, card === Card.Lantern && this.noLitSpot())) return false;
    this.place(card, idx);
    this.endTurn(slot);
    return true;
  }

  /** Descarta a carta `slot` por +1 óleo e fecha o turno. */
  discard(slot: number): boolean {
    if (this.over || slot < 0 || slot >= this.hand.length) return false;
    this.oil += RULES.discardOil;
    this.discards++;
    this.endTurn(slot);
    return true;
  }

  apply(a: Action): boolean { return a.kind === 'play' ? this.play(a.slot, a.idx) : this.discard(a.slot); }

  private endTurn(chosen: number): void {
    // As outras cartas da mão voltam ao fundo do baralho; a escolhida sai de jogo.
    this.hand.forEach((c, i) => { if (i !== chosen) this.deck.push(c); });
    this.hand = [];
    // Produção do turno e noite.
    this.food += this.foodIncome();
    this.oil += this.oilIncome();
    if (RULES.nights.includes(this.turn)) this.night();
    this.turn++;
    if (!this.over) this.dealHand();
  }

  /** Mão da vez: as 3 do topo. Mão garantida: se nenhuma cabe em lugar nenhum, a 3ª troca com a primeira do baralho que caiba. */
  private dealHand(): void {
    this.hand = this.deck.splice(0, RULES.handSize);
    if (this.hand.some((c) => this.playable(c))) return;
    const k = this.deck.findIndex((c) => this.playable(c));
    if (k >= 0) {
      const last = this.hand.length - 1;
      [this.hand[last], this.deck[k]] = [this.deck[k], this.hand[last]];
      this.fixedHands++;
    } else {
      this.stuckTurns++;
    }
  }

  /** Todas as ações legais (colocar em cada lugar; descartar cada carta distinta). */
  legalActions(): Action[] {
    const out: Action[] = [];
    this.hand.forEach((card, slot) => {
      for (const i of this.placements(card)) out.push({ kind: 'play', slot, idx: i });
      out.push({ kind: 'discard', slot });
    });
    return out;
  }

  /** Para a interface: hexágonos válidos da carta em `slot`. */
  validCells(slot: number): number[] { return this.placements(this.hand[slot]); }

  /** Distância ao centro (para a interface e para os testes). */
  static coord(idx: number): { q: number; r: number } { return CELLS[idx]; }
}

export function parseSeed(raw: string | null): number | null {
  if (raw === null || !/^-?\d{1,9}$/.test(raw.trim())) return null;
  return Number.parseInt(raw.trim(), 10);
}

export const GOAL_TITLES = ['Ponta marcada', 'Moradores', 'Achados', 'Fileira de casas', 'Ilha iluminada'];

/** Texto da meta para a interface e o relatório. */
export function goalLabel(g: number): string {
  switch (g) {
    case GoalId.Tip: return 'Acenda uma lanterna na ponta marcada';
    case GoalId.Residents: return `Chegue a ${RULES.residentsGoal} moradores`;
    case GoalId.Finds: return `Descubra ${RULES.findsGoal} achados`;
    case GoalId.Row: return `Tenha ${RULES.rowGoal} casas encostadas em fila`;
    case GoalId.Light: return `Ilumine ${Math.round(RULES.lightGoal * 100)}% da ilha`;
    default: return '';
  }
}

/** Regra curta de cada carta (interface). */
export function cardRule(c: number): string {
  switch (c) {
    case Card.House: return `Custa ${RULES.houseCostFood} comida. Em Prado, Bosque ou Praia. Moradores: 1 + tipos distintos ao redor (Campo, Bosque, Água/Praia, Lanterna, Pomar), no máximo ${RULES.houseMax}.`;
    case Card.Field: return 'Só em Prado. +1 comida por turno (+1 por Nascente vizinha).';
    case Card.Olive: return 'Em Prado ou Rocha. +1 óleo por turno.';
    case Card.Lantern: return `Custa ${RULES.lanternCostOil} óleo. Acende raio 2 e revela a névoa. Em qualquer terra.`;
    case Card.Dock: return `Em Praia junto da água. +1 comida por turno (+${RULES.dockFishBonus} com Cardume vizinho).`;
    default: return '';
  }
}
