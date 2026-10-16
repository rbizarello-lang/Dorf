// Regras da Ilha das Lanternas, versão B (enxuta: 6 regras, sem exceções). Puro e determinístico, como a A:
// sem three, sem DOM, sem Math.random. Reaproveita hex, rng e a geração da ilha (map.ts).
import { CELLS, CENTER, LIT, N, NB, dist } from './hex';
import { Find, IslandMap, Terrain, generateIsland } from './map';
import { mulberry32, shuffle, subSeed } from './rng';

/** Palpite público do terreno sob a névoa (a ilha tem raio 7 e a terra fica perto do centro). */
export const BLIND_LAND_RADIUS_B = 5;

export const CardB = { House: 0, Field: 1, Grove: 2, Lantern: 3, Dock: 4 } as const;
export const CARD_NAMES_B = ['Casa', 'Campo', 'Bosque', 'Lanterna', 'Cais'];
export const StructB = { None: 0, House: 1, Field: 2, Grove: 3, Lantern: 4, Dock: 5 } as const;
export const HOUSE_NAMES_B = ['Casa', 'Sobrado', 'Casarão', 'Solar'];
export const LANDMARK_NAMES_B = ['Poço', 'Praça', 'Capela'];

export const GoalIdB = { Manor: 0, Plaza: 1, Finds: 2, Light: 3 } as const;
export const GOAL_COUNT_B = 4;
export const GOAL_TITLES_B = ['Um solar', 'Vila com praça', 'Achados', 'Ilha iluminada'];

/** Todos os números ajustáveis num lugar só (ver docs/simulacao.md, seção "Versão B"). */
export const RULES_B = {
  turns: 30,
  handSize: 3,
  houseMax: 4,
  /** A vila ganha um marco ao chegar a cada um destes tamanhos (poço, praça, capela). */
  landmarkAt: [3, 6, 10],
  landmarkResidents: 3,
  ruinResidents: 3,
  /** Alcance do Cardume (Água) e da Nascente (Campo) sobre as casas. */
  springReach: 2,
  goalPoints: 5,
  /** Solares (casas de nível 4) da meta. */
  manorGoal: 2,
  findsGoal: 4,
  lightGoal: 0.7,
  /** Composição do baralho (cartas por tipo), na ordem de CardB. */
  deck: [12, 8, 8, 9, 4],
};

export interface ActionB { slot: number; idx: number }

export interface SummaryB {
  score: number; residents: number; goals: number[]; goalsMet: boolean[]; litPct: number; finds: number;
}

export class GameB {
  readonly seed: number;
  map: IslandMap;
  readonly goals: number[];
  struct: Uint8Array;
  /** Iluminado: a luz de uma lanterna chega (revela terreno e achados). */
  lit: Uint8Array;
  houses: number[] = [];
  lanterns: number[] = [];
  turn = 1;
  deck: number[] = [];
  hand: number[] = [];
  litLand = 0;
  foundCount = 0;
  ruinsFound = 0;
  /** Vezes em que as 3 peças não couberam em lugar nenhum e vieram outras 3. */
  redeals = 0;
  /** A ilha ficou sem lugar para qualquer peça do baralho: a noite cai antes do turno 30. */
  ended = false;
  history: ActionB[] = [];

  constructor(seed: number, from?: GameB, blind = false) {
    this.seed = seed;
    if (from) {
      this.map = blind ? {
        ...from.map,
        // Cópia "cega" (para os bots): achados e terreno sob a névoa não existem; vale o palpite público.
        finds: from.map.finds.map((f, i) => (from.lit[i] ? f : 0)),
        terrain: from.map.terrain.map((t, i) => (from.lit[i] ? t : dist(i, CENTER) <= BLIND_LAND_RADIUS_B ? Terrain.Meadow : Terrain.Water)),
      } : from.map;
      this.goals = from.goals;
      this.struct = from.struct.slice(); this.lit = from.lit.slice();
      this.houses = from.houses.slice(); this.lanterns = from.lanterns.slice();
      this.turn = from.turn; this.deck = from.deck.slice(); this.hand = from.hand.slice();
      this.litLand = from.litLand; this.foundCount = from.foundCount; this.ruinsFound = from.ruinsFound;
      this.redeals = from.redeals; this.ended = from.ended; this.history = from.history.slice();
      return;
    }
    const m = generateIsland(seed);
    // Sem Rocha na B: vira Prado (o terreno é só paisagem e lugar de peça).
    this.map = { ...m, terrain: m.terrain.map((t) => (t === Terrain.Rock ? Terrain.Meadow : t)) };
    this.struct = new Uint8Array(N);
    this.lit = new Uint8Array(N);
    this.goals = shuffle([0, 1, 2, 3], mulberry32(subSeed(seed, 4))).slice(0, 3).sort((a, b) => a - b);
    const cards: number[] = [];
    RULES_B.deck.forEach((n, c) => { for (let k = 0; k < n; k++) cards.push(c); });
    this.deck = shuffle(cards, mulberry32(subSeed(seed, 3)));
    // O Farol velho no centro, já aceso.
    this.struct[CENTER] = StructB.Lantern;
    this.lanterns.push(CENTER);
    this.lightUp(CENTER);
    this.dealHand();
  }

  clone(blind = false): GameB { return new GameB(this.seed, this, blind); }

  get over(): boolean { return this.ended || this.turn > RULES_B.turns; }
  get turnsLeft(): number { return Math.max(0, RULES_B.turns - this.turn + 1); }

  // ---------- luz ----------
  private lightUp(idx: number): void {
    for (const c of LIT[idx]) {
      if (this.lit[c]) continue;
      this.lit[c] = 1;
      if (this.map.terrain[c] !== Terrain.Water) this.litLand++;
      const f = this.map.finds[c];
      if (f !== Find.None) {
        this.foundCount++;
        if (f === Find.Ruin) this.ruinsFound++;
      }
    }
  }

  // ---------- validade ----------
  /**
   * A peça pode ir em `idx`? Hexágono de terra sem peça. Achado já revelado fica como está.
   * Casa, Campo e Bosque: onde há luz. Cais: em Praia com luz. Lanterna: onde há luz ou encostada nela.
   */
  canPlace(card: number, idx: number): boolean {
    if (this.struct[idx] !== StructB.None || this.map.terrain[idx] === Terrain.Water) return false;
    if (this.lit[idx] && this.map.finds[idx] !== Find.None) return false;
    switch (card) {
      case CardB.Lantern: return this.lit[idx] === 1 || NB[idx].some((n) => this.lit[n]);
      case CardB.Dock: return this.lit[idx] === 1 && this.map.terrain[idx] === Terrain.Beach;
      case CardB.House: case CardB.Field: case CardB.Grove: return this.lit[idx] === 1;
      default: return false;
    }
  }

  placements(card: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < N; i++) if (this.canPlace(card, i)) out.push(i);
    return out;
  }

  playable(card: number): boolean {
    for (let i = 0; i < N; i++) if (this.canPlace(card, i)) return true;
    return false;
  }

  // ---------- casas ----------
  /** Nível que uma casa teria em `idx` (1 + tipos diferentes ao redor, até 4): vale para casa posta e para casa hipotética. */
  levelAt(idx: number): number {
    let campo = 0, bosque = 0, agua = 0, lant = 0, pomar = 0;
    for (const n of NB[idx]) {
      const s = this.struct[n], t = this.map.terrain[n];
      if (s === StructB.Field) campo = 1;
      else if (s === StructB.Lantern) lant = 1;
      else if (s === StructB.Grove || (s === StructB.None && t === Terrain.Wood)) bosque = 1;
      if (s === StructB.Dock || t === Terrain.Water) agua = 1;
      if (this.lit[n] && this.map.finds[n] === Find.Orchard) pomar = 1;
    }
    // Cardume e Nascente revelados alcançam as casas até springReach de distância.
    if (!agua || !campo) {
      for (const c of LIT[idx]) {
        if (!this.lit[c] || dist(c, idx) > RULES_B.springReach) continue;
        const f = this.map.finds[c];
        if (f === Find.Fish) agua = 1;
        else if (f === Find.Spring) campo = 1;
      }
    }
    return Math.min(RULES_B.houseMax, 1 + campo + bosque + agua + lant + pomar);
  }

  /** Vilas: grupos de 3 ou mais casas encostadas. Devolve o tamanho de cada grupo (de qualquer tamanho). */
  groups(): number[] {
    const seen = new Set<number>(), sizes: number[] = [];
    for (const h of this.houses) {
      if (seen.has(h)) continue;
      let size = 0;
      const stack = [h];
      seen.add(h);
      while (stack.length) {
        const c = stack.pop()!;
        size++;
        for (const n of NB[c]) if (this.struct[n] === StructB.House && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
      sizes.push(size);
    }
    return sizes;
  }

  /** Marcos de uma vila do tamanho dado: 0 a 3 (poço, praça, capela). */
  static landmarks(size: number): number { return RULES_B.landmarkAt.filter((k) => size >= k).length; }

  landmarkCount(): number { return this.groups().reduce((a, s) => a + GameB.landmarks(s), 0); }

  manors(): number { return this.houses.reduce((n, h) => n + (this.levelAt(h) >= RULES_B.houseMax ? 1 : 0), 0); }
  biggestVillage(): number { return this.groups().reduce((m, s) => Math.max(m, s), 0); }

  residents(): number {
    let r = this.ruinsFound * RULES_B.ruinResidents + this.landmarkCount() * RULES_B.landmarkResidents;
    for (const h of this.houses) r += this.levelAt(h);
    return r;
  }

  // ---------- metas ----------
  litFraction(): number { return this.litLand / this.map.landCount; }

  goalProgress(g: number): number {
    switch (g) {
      case GoalIdB.Manor: return Math.min(1, this.manors() / RULES_B.manorGoal);
      case GoalIdB.Plaza: return Math.min(1, this.biggestVillage() / RULES_B.landmarkAt[1]);
      case GoalIdB.Finds: return Math.min(1, this.foundCount / RULES_B.findsGoal);
      case GoalIdB.Light: return Math.min(1, this.litFraction() / RULES_B.lightGoal);
      default: return 0;
    }
  }
  goalMet(g: number): boolean { return this.goalProgress(g) >= 1; }
  goalsMetCount(): number { return this.goals.reduce((n, g) => n + (this.goalMet(g) ? 1 : 0), 0); }
  score(): number { return this.residents() + RULES_B.goalPoints * this.goalsMetCount(); }

  summary(): SummaryB {
    return {
      score: this.score(), residents: this.residents(), goals: this.goals.slice(),
      goalsMet: this.goals.map((g) => this.goalMet(g)), litPct: this.litFraction(), finds: this.foundCount,
    };
  }

  // ---------- jogada ----------
  /** Aplica só a colocação (efeito + luz). Usado pelos bots para avaliar sem fechar o turno. */
  place(card: number, idx: number): void {
    switch (card) {
      case CardB.House: this.struct[idx] = StructB.House; this.houses.push(idx); break;
      case CardB.Field: this.struct[idx] = StructB.Field; break;
      case CardB.Grove: this.struct[idx] = StructB.Grove; break;
      case CardB.Dock: this.struct[idx] = StructB.Dock; break;
      case CardB.Lantern: this.struct[idx] = StructB.Lantern; this.lanterns.push(idx); this.lightUp(idx); break;
    }
  }

  /** Joga a peça da mão `slot` em `idx` e fecha o turno. Devolve false se for ilegal. */
  play(slot: number, idx: number): boolean {
    if (this.over || slot < 0 || slot >= this.hand.length) return false;
    const card = this.hand[slot];
    if (!this.canPlace(card, idx)) return false;
    this.history.push({ slot, idx });
    this.place(card, idx);
    // As outras peças da mão voltam ao fundo do baralho; a escolhida sai de jogo.
    this.hand.forEach((c, i) => { if (i !== slot) this.deck.push(c); });
    this.hand = [];
    this.turn++;
    if (!this.over) this.dealHand();
    return true;
  }

  apply(a: ActionB): boolean { return this.play(a.slot, a.idx); }

  /** Refaz uma partida a partir da semente e das jogadas (o que a tela de replay e os testes usam). */
  static replay(seed: number, actions: ActionB[]): GameB | null {
    const g = new GameB(seed);
    for (const a of actions) if (!g.apply(a)) return null;
    return g;
  }

  /**
   * Mão da vez: as 3 do topo. Se nenhuma couber em lugar nenhum, elas vão ao fundo e vêm outras 3
   * (regra geral da mão, não uma exceção de peça). Se o baralho inteiro não couber, a ilha está completa e a noite cai.
   */
  private dealHand(): void {
    const rounds = Math.ceil(this.deck.length / RULES_B.handSize) + 1;
    for (let k = 0; k < rounds; k++) {
      this.hand = this.deck.splice(0, RULES_B.handSize);
      if (this.hand.some((c) => this.playable(c))) return;
      this.deck.push(...this.hand);
      this.redeals++;
    }
    this.hand = [];
    this.ended = true;
  }

  /** Todas as jogadas possíveis (colocar cada peça da mão em cada lugar válido). */
  legalActions(): ActionB[] {
    const out: ActionB[] = [];
    this.hand.forEach((card, slot) => { for (const i of this.placements(card)) out.push({ slot, idx: i }); });
    return out;
  }

  validCells(slot: number): number[] { return this.placements(this.hand[slot]); }

  static coord(idx: number): { q: number; r: number } { return CELLS[idx]; }
}

/** Texto da meta para a interface e o relatório. */
export function goalLabelB(g: number): string {
  switch (g) {
    case GoalIdB.Manor: return RULES_B.manorGoal === 1 ? 'Tenha um solar (casa de nível 4)' : `Tenha ${RULES_B.manorGoal} solares (casas de nível 4)`;
    case GoalIdB.Plaza: return `Forme uma vila de ${RULES_B.landmarkAt[1]} casas, com praça`;
    case GoalIdB.Finds: return `Revele ${RULES_B.findsGoal} achados`;
    case GoalIdB.Light: return `Ilumine ${Math.round(RULES_B.lightGoal * 100)}% da ilha`;
    default: return '';
  }
}

/** As 6 regras, exatamente como o jogador as lê (interface e documentos usam este texto). */
export const RULES_TEXT_B: string[] = [
  'Em cada turno aparecem 3 peças. Você coloca 1 num hexágono de terra iluminado e vazio; as outras 2 voltam ao fundo do baralho.',
  'A Lanterna é uma peça: ela acende e revela a névoa até 2 hexágonos de distância, e pode ir em qualquer terra iluminada ou encostada na luz.',
  'Cada casa sobe de nível conforme os tipos diferentes encostados nela, entre Campo, Bosque, Água, Lanterna e Pomar: nível = 1 + tipos, até 4 (casa, sobrado, casarão, solar). Moradores = nível.',
  'Três casas encostadas formam uma vila, que ganha um marco aos 3, 6 e 10 casas (poço, praça, capela). Cada marco vale +3 moradores.',
  'Os achados dão um presente ao serem revelados: a Ruína traz +3 moradores, o Pomar conta como tipo para as casas encostadas, e o Cardume e a Nascente fazem as casas a até 2 hexágonos contarem Água e Campo.',
  'São 30 peças. Ao fim cai a noite: a pontuação é moradores + 5 por meta cumprida (3 metas sorteadas). Não existe derrota.',
];
