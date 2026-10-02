import { DIRS, hkey, opposite } from './hex';
import { LOOKOUT_MOVES, SITE_REWARD, type Site, type SiteKind } from './sites';
import { type SynHit, type SynKind, synergyOf } from './synergy';
import { T, isStrict, rotateEdges, type TileDef } from './tiles';

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
}

export const DEFAULT_RULES: Rules = {
  startTiles: 40,
  matchPoints: 10,
  perfectBonus: 20,
  closedBonus: 30,
  closedTiles: 1,
  questChance: 0.24,
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
}

export interface Quest {
  id: number;
  terrain: T;
  target: number;
  exact: boolean;
  anchor: Placed;
  sector: number;
  progress: number;
  state: 'active' | 'done' | 'failed';
  reward: number;
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
  /** Exploradores: pontos pelas peças que sobraram quando o último sítio foi achado. */
  leftoverBonus?: number;
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
    return { valid: !occupied && neighbors > 0 && !conflict, occupied, neighbors, matches, edgeState, synergies, site: this.siteAt(q, r), eraMark: this.markPending !== null && edges.includes(T.Village) ? this.markPending : null };
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
      points += R.perfectBonus;
      this.perfects++;
    }
    placed.synergies = c.synergies;
    if (c.eraMark !== null) {
      placed.eraMark = c.eraMark;
      this.markPending = null;
    }
    points += c.synergies.length * R.synergyPoints;
    for (const h of c.synergies) {
      this.synergyCount[h.kind]++;
      points += R.synergyBonus[h.kind] ?? 0;
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
      if (site.kind === 'lookout') this.lookout = LOOKOUT_MOVES;
    }
    const candidates = [placed, ...DIRS.map(([dq, dr]) => this.get(q + dq, r + dr)).filter((x): x is Placed => !!x)];
    for (const t of candidates) {
      if (t.closed || !this.isClosedPerfect(t)) continue;
      t.closed = true;
      closed.push(t);
      points += R.closedBonus;
      tilesGained += R.closedTiles;
    }

    this.computeGroups();

    const questsDone: Quest[] = [];
    const questsFailed: Quest[] = [];
    for (const quest of this.quests) {
      if (quest.state !== 'active') continue;
      quest.progress = this.groupSize(quest.anchor, quest.sector);
      if (quest.exact) {
        if (quest.progress === quest.target) quest.state = 'done';
        else if (quest.progress > quest.target) quest.state = 'failed';
      } else if (quest.progress >= quest.target) quest.state = 'done';
      if (quest.state === 'done') {
        questsDone.push(quest);
        tilesGained += quest.reward;
        points += quest.target * 10;
        this.questsCompleted++;
      } else if (quest.state === 'failed') questsFailed.push(quest);
    }

    let newQuest: Quest | null = null;
    if (def.quest) {
      const sector = this.bestSector(placed, def.quest.terrain);
      if (sector >= 0) {
        const size = this.groupSize(placed, sector);
        const target = size + def.quest.delta;
        newQuest = {
          id: ++this.questSeq,
          terrain: def.quest.terrain,
          target,
          exact: def.quest.exact,
          anchor: placed,
          sector,
          progress: size,
          state: 'active',
          reward: def.quest.exact ? 6 : 4 + Math.floor(target / 8),
        };
        this.quests.push(newQuest);
      }
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
    return { placed, points, matches: c.matches, neighbors: c.neighbors, perfect, closed, synergies: c.synergies, tilesGained, questsDone, questsFailed, newQuest, site, eraUp };
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
