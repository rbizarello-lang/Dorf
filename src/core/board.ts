import { BLESSING, SYN_BLESSING, type BlessingId } from './blessings';
import { DIRS, hexDistance, hkey, opposite } from './hex';
import { LOOKOUT_MOVES, SITE_REWARD, type Site, type SiteKind } from './sites';
import { SPECIALS, type SpecialKind } from './specials';
import { type SynHit, type SynKind, synergyOf } from './synergy';
import { T, isStrict, rotateEdges, type QuestKind, type TileDef } from './tiles';

export interface Rules {
  startTiles: number;
  matchPoints: number;
  perfectBonus: number;
  /** Bônus ao cercar uma peça com 6 vizinhos, todos encaixados. */
  closedBonus: number;
  closedTiles: number;
  questChance: number;
  maxQuests: number;
  /** Pontos por borda de interação (bordas diferentes que "conversam"). */
  synergyPoints: number;
  /** Pontuação que abre cada era da vila (a primeira é 0). Uma só entrada = sem eras. */
  eraScores: number[];
  /** Peças ganhas a cada era nova. */
  eraTiles: number;
  /** Bônus do tema: pontos extras por borda encaixada de um terreno. */
  matchBonus: Partial<Record<T, number>>;
  /** Bônus do tema: pontos extras por interação de um tipo. */
  synergyBonus: Partial<Record<SynKind, number>>;
  /** Quantos sítios escondidos o mapa tem. */
  sites: number;
  /** Modo zen: a pilha nunca acaba. */
  infinite: boolean;
  /** A partida acaba quando todos os sítios forem achados (cada peça que sobrou vale `leftoverPoints`). */
  endOnSites: boolean;
  leftoverPoints: number;
  /**
   * Maravilha na última era: a próxima peça com 2+ bordas de vila vira o canteiro, e cada
   * peça colocada depois avança uma etapa. 0 = sem maravilha.
   */
  wonderStages: number;
  /** Escolha de 1 entre 2 cartas a cada era nova (src/core/blessings.ts). */
  blessings: boolean;
  /** Pontos e peças ao completar a maravilha. */
  wonderPoints: number;
  wonderTiles: number;
  /** Peças por missão: grupo (mais 1 a cada 6 peças pedidas), grupo exato, fechar, contagem (perfeitos, interações). */
  groupQuestTiles: number;
  exactQuestTiles: number;
  closeQuestTiles: number;
  countQuestTiles: number;
}

export const DEFAULT_RULES: Rules = {
  startTiles: 50,
  matchPoints: 10,
  perfectBonus: 20,
  closedBonus: 30,
  closedTiles: 1,
  questChance: 0.32,
  maxQuests: 4,
  synergyPoints: 5,
  eraScores: [0, 500, 1500, 3000],
  eraTiles: 3,
  matchBonus: {},
  synergyBonus: {},
  sites: 6,
  infinite: false,
  endOnSites: false,
  leftoverPoints: 20,
  blessings: true,
  wonderStages: 6,
  wonderPoints: 300,
  wonderTiles: 6,
  groupQuestTiles: 5,
  exactQuestTiles: 7,
  closeQuestTiles: 6,
  countQuestTiles: 5,
};

export interface Placed {
  q: number;
  r: number;
  key: number;
  def: TileDef;
  rot: number;
  /** Bordas já rotacionadas (posição no mundo). */
  edges: T[];
  index: number;
  closed: boolean;
  /** Interações criadas quando a peça foi colocada (construções nas bordas). */
  synergies: SynHit[];
  /** Era cujo marco foi erguido nesta peça (a primeira peça com vila depois do avanço). */
  eraMark?: number;
  /** Sítio descoberto nesta peça (a peça mostra a ruína, o baú, o relicário ou a torre). */
  site?: SiteKind;
  /** Canteiro da maravilha (o meio da peça fica livre para ela). */
  wonder?: boolean;
}

export interface Quest {
  id: number;
  kind: QuestKind;
  terrain: T;
  /**
   * group: tamanho pedido; close: bordas abertas quando a missão nasceu;
   * perfect e synergy: quantas vezes.
   */
  target: number;
  exact: boolean;
  anchor: Placed;
  /** Setor do grupo na peça âncora (group e close); -1 nas missões de contagem. */
  sector: number;
  /** group: tamanho atual; close: bordas já fechadas (target − abertas); perfect e synergy: contagem. */
  progress: number;
  state: 'active' | 'done' | 'failed';
  reward: number;
  /** close: bordas do grupo ainda viradas para o vazio. */
  open?: number;
  /** synergy: o tipo de interação pedido. */
  syn?: SynKind;
  /** perfect e synergy: a contagem do tabuleiro quando a missão nasceu. */
  base?: number;
  /** Pontos que a missão rendeu ao ser cumprida. */
  points?: number;
}

export interface Check {
  valid: boolean;
  occupied: boolean;
  neighbors: number;
  matches: number;
  /** Por borda: 0 sem vizinho, 1 encaixa, 2 não encaixa, 3 conflito (rio/trilho), 4 interação. */
  edgeState: number[];
  synergies: SynHit[];
  /** Sítio ainda escondido nesta posição (a prévia mostra a recompensa). */
  site: Site | null;
  /** Era cujo marco esta peça ergueria (o fantasma já mostra), ou null. */
  eraMark: number | null;
  /** Esta peça viraria o canteiro da maravilha (o fantasma já mostra o meio livre). */
  wonder: boolean;
}

export interface PlaceResult {
  placed: Placed;
  points: number;
  matches: number;
  neighbors: number;
  perfect: boolean;
  closed: Placed[];
  synergies: SynHit[];
  tilesGained: number;
  questsDone: Quest[];
  questsFailed: Quest[];
  newQuest: Quest | null;
  /** Sítio descoberto nesta jogada. */
  site: Site | null;
  /** Era alcançada nesta jogada (índice a partir de 0), ou null. */
  eraUp: number | null;
  /** Maravilha: começou nesta peça (etapa 0), avançou ou ficou pronta nesta jogada; null se nada mudou. */
  wonder: { stage: number; started: boolean; done: boolean } | null;
  /** Exploradores: pontos pelas peças que sobraram quando o último sítio foi achado. */
  leftoverBonus?: number;
  /** Peça especial colocada: quantas peças à volta contaram, pontos e peças ganhos. */
  special: { kind: SpecialKind; count: number; points: number; tiles: number } | null;
}

export class Board {
  readonly tiles = new Map<number, Placed>();
  readonly list: Placed[] = [];
  readonly frontier = new Set<number>();
  readonly quests: Quest[] = [];
  score = 0;
  perfects = 0;
  questsCompleted = 0;
  readonly synergyCount: Record<SynKind, number> = { lumber: 0, mill: 0, pasture: 0, apiary: 0 };
  /** Era atual da vila (0 = primeira). */
  era = 0;
  /** Era cujo marco espera a próxima peça com vila, ou null. */
  markPending: number | null = null;
  /** Sítios do mapa (preenchidos pelo Game a partir da semente). */
  sites: Site[] = [];
  /** Jogadas restantes em que o mirante mostra as próximas peças. */
  lookout = 0;
  /** Maravilha: peça do canteiro e etapa (pronta quando chega a `rules.wonderStages`). */
  wonder: { tile: Placed; stage: number } | null = null;
  /** Cartas escolhidas nas viradas de era (src/core/blessings.ts), na ordem. */
  readonly blessings: BlessingId[] = [];
  private questSeq = 0;
  // Union-find sobre (peça, setor): refeito a cada jogada, O(n).
  private parent = new Int32Array(0);
  private groupTiles = new Int32Array(0);

  constructor(public rules: Rules) {}

  get(q: number, r: number) {
    return this.tiles.get(hkey(q, r));
  }

  activeQuests() {
    return this.quests.filter((q) => q.state === 'active');
  }

  check(q: number, r: number, edges: readonly T[]): Check {
    const edgeState = [0, 0, 0, 0, 0, 0];
    const occupied = this.tiles.has(hkey(q, r));
    let neighbors = 0;
    let matches = 0;
    let conflict = false;
    const synergies: SynHit[] = [];
    for (let i = 0; i < 6; i++) {
      const n = this.get(q + DIRS[i][0], r + DIRS[i][1]);
      if (!n) continue;
      neighbors++;
      const a = edges[i];
      const b = n.edges[opposite(i)];
      if (a === b) {
        matches++;
        edgeState[i] = 1;
      } else if (isStrict(a) || isStrict(b)) {
        edgeState[i] = 3;
        conflict = true;
      } else {
        const kind = synergyOf(a, b);
        edgeState[i] = kind ? 4 : 2;
        if (kind) synergies.push({ edge: i, kind });
      }
    }
    const eraMark = this.markPending !== null && edges.includes(T.Village) ? this.markPending : null;
    const R = this.rules;
    const lastEra = R.eraScores.length > 1 && this.era === R.eraScores.length - 1;
    const wonder = !this.wonder && R.wonderStages > 0 && lastEra && eraMark === null && edges.filter((e) => e === T.Village).length >= 2;
    return { valid: !occupied && neighbors > 0 && !conflict, occupied, neighbors, matches, edgeState, synergies, site: this.siteAt(q, r), eraMark, wonder };
  }

  /** Sítio ainda não descoberto em (q, r). */
  siteAt(q: number, r: number): Site | null {
    for (const s of this.sites) if (!s.found && s.q === q && s.r === r) return s;
    return null;
  }

  sitesLeft() {
    return this.sites.filter((s) => !s.found).length;
  }

  /** Coloca sem pontuar (peça inicial, reconstrução de estado). */
  placeRaw(q: number, r: number, def: TileDef, rot: number): Placed {
    const key = hkey(q, r);
    const p: Placed = { q, r, key, def, rot, edges: rotateEdges(def.edges, rot), index: this.list.length, closed: false, synergies: [] };
    this.tiles.set(key, p);
    this.list.push(p);
    this.frontier.delete(key);
    for (const [dq, dr] of DIRS) {
      const k = hkey(q + dq, r + dr);
      if (!this.tiles.has(k)) this.frontier.add(k);
    }
    return p;
  }

  place(q: number, r: number, def: TileDef, rot: number): PlaceResult {
    const edges = rotateEdges(def.edges, rot);
    const c = this.check(q, r, edges);
    const placed = this.placeRaw(q, r, def, rot);
    const R = this.rules;
    let points = c.matches * R.matchPoints;
    const perfect = c.neighbors >= 2 && c.matches === c.neighbors;
    if (perfect) {
      points += R.perfectBonus + (this.blessed('surveyors') ? BLESSING.perfect : 0);
      this.perfects++;
    }
    placed.synergies = c.synergies;
    // A peça especial tem a sua construção no meio: o marco da era e a maravilha esperam a próxima.
    if (c.eraMark !== null && !def.special) {
      placed.eraMark = c.eraMark;
      this.markPending = null;
    }
    points += c.synergies.length * R.synergyPoints;
    for (const h of c.synergies) {
      this.synergyCount[h.kind]++;
      points += R.synergyBonus[h.kind] ?? 0;
      if (this.blessed(SYN_BLESSING[h.kind])) points += BLESSING.synergy;
    }
    // Bônus do tema por terreno encaixado.
    for (let i = 0; i < 6; i++) if (c.edgeState[i] === 1) points += R.matchBonus[edges[i]] ?? 0;

    // Peças que acabaram de ficar cercadas por 6 vizinhos encaixados.
    const closed: Placed[] = [];
    let tilesGained = 0;

    // Sítio descoberto: o mirante conta a partir da próxima jogada.
    if (this.lookout > 0) this.lookout--;
    const site = c.site;
    if (site) {
      site.found = true;
      placed.site = site.kind;
      points += SITE_REWARD[site.kind].points;
      tilesGained += SITE_REWARD[site.kind].tiles;
      if (site.kind === 'lookout') this.lookout = Math.max(this.lookout, LOOKOUT_MOVES);
      if (this.blessed('cartographers')) tilesGained += BLESSING.site;
    }
    // Peça especial: pontos por peça à volta com o terreno dela (contadas na hora de colocar).
    let special: PlaceResult['special'] = null;
    if (def.special) {
      const sp = SPECIALS[def.special];
      let count = 0;
      for (const t of this.list) if (t !== placed && hexDistance(q, r, t.q, t.r) <= sp.radius && t.edges.includes(sp.terrain)) count++;
      special = { kind: def.special, count, points: count * sp.per, tiles: sp.tiles };
      points += special.points;
      tilesGained += sp.tiles;
      if (sp.lookout) this.lookout = Math.max(this.lookout, sp.lookout);
    }
    const candidates = [placed, ...DIRS.map(([dq, dr]) => this.get(q + dq, r + dr)).filter((x): x is Placed => !!x)];
    for (const t of candidates) {
      if (t.closed || !this.isClosedPerfect(t)) continue;
      t.closed = true;
      closed.push(t);
      points += R.closedBonus;
      tilesGained += R.closedTiles + (this.blessed('builders') ? BLESSING.closed : 0);
    }

    this.computeGroups();

    const questsDone: Quest[] = [];
    const questsFailed: Quest[] = [];
    for (const quest of this.quests) {
      if (quest.state !== 'active') continue;
      let gain = 0;
      if (quest.kind === 'group') {
        quest.progress = this.groupSize(quest.anchor, quest.sector);
        if (quest.exact) {
          if (quest.progress === quest.target) quest.state = 'done';
          else if (quest.progress > quest.target) quest.state = 'failed';
        } else if (quest.progress >= quest.target) quest.state = 'done';
        gain = quest.target * 10;
      } else if (quest.kind === 'close') {
        quest.open = this.openEdges(quest.anchor, quest.sector);
        quest.progress = Math.max(0, quest.target - quest.open);
        if (quest.open === 0) quest.state = 'done';
        gain = this.groupSize(quest.anchor, quest.sector) * 10;
      } else {
        quest.progress = this.counter(quest) - quest.base!;
        if (quest.progress >= quest.target) quest.state = 'done';
        gain = quest.target * (quest.kind === 'perfect' ? 20 : 15);
      }
      if (quest.state === 'done') {
        questsDone.push(quest);
        tilesGained += quest.reward + (this.blessed('pilgrims') ? BLESSING.quest : 0);
        quest.points = gain;
        points += gain;
        this.questsCompleted++;
      } else if (quest.state === 'failed') questsFailed.push(quest);
    }

    let newQuest: Quest | null = null;
    const spec = def.quest;
    if (spec && (spec.kind === 'group' || spec.kind === 'close')) {
      const sector = this.bestSector(placed, spec.terrain);
      if (sector >= 0) {
        const size = this.groupSize(placed, sector);
        if (spec.kind === 'group') {
          const target = size + spec.delta;
          newQuest = { id: ++this.questSeq, kind: 'group', terrain: spec.terrain, target, exact: spec.exact, anchor: placed, sector, progress: size, state: 'active', reward: spec.exact ? R.exactQuestTiles : R.groupQuestTiles + Math.floor(target / 6) };
        } else {
          // Peça num buraco cercado pode já nascer com o grupo fechado: aí não há o que pedir.
          const open = this.openEdges(placed, sector);
          if (open > 0) newQuest = { id: ++this.questSeq, kind: 'close', terrain: spec.terrain, target: open, exact: false, anchor: placed, sector, progress: 0, state: 'active', reward: R.closeQuestTiles, open };
        }
      }
    } else if (spec) {
      newQuest = { id: ++this.questSeq, kind: spec.kind, terrain: spec.terrain, target: spec.delta, exact: false, anchor: placed, sector: -1, progress: 0, state: 'active', reward: R.countQuestTiles, syn: spec.syn };
      newQuest.base = this.counter(newQuest);
    }
    if (newQuest) this.quests.push(newQuest);

    // Maravilha (só na última era): começa na próxima peça com 2+ bordas de vila que não seja
    // a do marco da era; depois, cada peça colocada avança uma etapa.
    let wonder: PlaceResult['wonder'] = null;
    if (this.wonder && this.wonder.stage < R.wonderStages) {
      const stage = ++this.wonder.stage;
      const done = stage === R.wonderStages;
      if (done) {
        points += R.wonderPoints;
        tilesGained += R.wonderTiles;
      }
      wonder = { stage, started: false, done };
    } else if (c.wonder && !def.special) {
      this.wonder = { tile: placed, stage: 0 };
      placed.wonder = true;
      wonder = { stage: 0, started: true, done: false };
    }

    this.score += points;
    // Eras: a pontuação acumulada abre a próxima, que traz peças.
    let eraUp: number | null = null;
    while (this.era + 1 < R.eraScores.length && this.score >= R.eraScores[this.era + 1]) {
      this.era++;
      tilesGained += R.eraTiles;
      eraUp = this.era;
      this.markPending = this.era;
    }
    return { placed, points, matches: c.matches, neighbors: c.neighbors, perfect, closed, synergies: c.synergies, tilesGained, questsDone, questsFailed, newQuest, site, eraUp, wonder, special };
  }

  blessed(id: BlessingId) {
    return this.blessings.includes(id);
  }

  /** Aplica a carta escolhida na virada de era (vale da próxima jogada em diante). */
  bless(id: BlessingId) {
    this.blessings.push(id);
    if (id === 'cartographers') this.lookout = Math.max(this.lookout, BLESSING.lookout);
  }

  /** Contagem do tabuleiro que uma missão de contagem acompanha. */
  private counter(q: Quest) {
    return q.kind === 'perfect' ? this.perfects : this.synergyCount[q.syn!];
  }

  /** Bordas do grupo de (p, setor) viradas para uma casa vazia. */
  openEdges(p: Placed, sector: number) {
    const root = this.find(p.index * 6 + sector);
    let open = 0;
    for (const t of this.list) for (let s = 0; s < 6; s++) if (this.find(t.index * 6 + s) === root && !this.get(t.q + DIRS[s][0], t.r + DIRS[s][1])) open++;
    return open;
  }

  private isClosedPerfect(t: Placed) {
    for (let i = 0; i < 6; i++) {
      const n = this.get(t.q + DIRS[i][0], t.r + DIRS[i][1]);
      if (!n || n.edges[opposite(i)] !== t.edges[i]) return false;
    }
    return true;
  }

  private bestSector(p: Placed, terrain: T) {
    let best = -1;
    let bestSize = -1;
    for (let s = 0; s < 6; s++) {
      if (p.edges[s] !== terrain) continue;
      const size = this.groupSize(p, s);
      if (size > bestSize) {
        bestSize = size;
        best = s;
      }
    }
    return best;
  }

  private find(x: number): number {
    const parent = this.parent;
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  private union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }

  computeGroups() {
    const n = this.list.length * 6;
    this.parent = new Int32Array(n);
    for (let i = 0; i < n; i++) this.parent[i] = i;
    for (const t of this.list) {
      const base = t.index * 6;
      for (let s = 0; s < 6; s++) {
        const terr = t.edges[s];
        // Dentro da peça: setores vizinhos iguais se unem; rio e trilho se unem pelo centro.
        if (isStrict(terr)) {
          for (let s2 = s + 1; s2 < 6; s2++) if (t.edges[s2] === terr) this.union(base + s, base + s2);
        } else if (t.edges[(s + 1) % 6] === terr) this.union(base + s, base + ((s + 1) % 6));
        const nb = this.get(t.q + DIRS[s][0], t.r + DIRS[s][1]);
        if (nb && nb.index > t.index && nb.edges[opposite(s)] === terr) this.union(base + s, nb.index * 6 + opposite(s));
      }
    }
    // Tamanho do grupo = número de peças distintas.
    this.groupTiles = new Int32Array(n);
    const seen: number[] = [];
    for (const t of this.list) {
      seen.length = 0;
      for (let s = 0; s < 6; s++) {
        const root = this.find(t.index * 6 + s);
        if (!seen.includes(root)) {
          seen.push(root);
          this.groupTiles[root]++;
        }
      }
    }
  }

  groupSize(p: Placed, sector: number) {
    return this.groupTiles[this.find(p.index * 6 + sector)] ?? 0;
  }

  /** Setores (peça, setor) do mesmo grupo — usado para destacar missões. */
  groupMembers(p: Placed, sector: number): Array<[Placed, number]> {
    const root = this.find(p.index * 6 + sector);
    const out: Array<[Placed, number]> = [];
    for (const t of this.list) for (let s = 0; s < 6; s++) if (this.find(t.index * 6 + s) === root) out.push([t, s]);
    return out;
  }
}
