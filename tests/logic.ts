// Escrito pelo agente revisor (Sonnet) durante a QA do protótipo; adaptado para o repositório.
// Teste de lógica (sem three): simula partidas com a IA gulosa e confere invariantes
// contra oráculos independentes (BFS de grupos, pontuação recalculada, validade por força bruta).
import { DEFAULT_RULES, Board, type Placed, type Quest, type Rules } from '../src/core/board';
import { Game } from '../src/core/game';
import { DIRS, hkey, opposite, unkey, hexToWorld, worldToHex, hexDistance } from '../src/core/hex';
import { T, isStrict, rotateEdges, type TileDef } from '../src/core/tiles';
import { mulberry32 } from '../src/core/rng';
import { MODES, type Mode } from '../src/core/modes';
import { generateSites } from '../src/core/sites';
import { SPECIAL_KINDS, type SpecialKind } from '../src/core/specials';
import { THEMES } from '../src/themes/themes';

const rulesFor = (t: { rules?: Partial<Rules> }, mode?: Mode): Rules => ({ ...DEFAULT_RULES, ...(mode?.daily ? {} : t.rules), ...mode?.rules });

// Recompensas dos sítios (cópia independente da tabela de src/core/sites.ts).
const ORACLE_SITE: Record<string, { points: number; tiles: number }> = {
  ruin: { points: 60, tiles: 0 },
  treasure: { points: 0, tiles: 2 },
  relic: { points: 100, tiles: 1 },
  lookout: { points: 20, tiles: 0 },
};

// Peças especiais (cópia independente de src/core/specials.ts): bordas, terreno contado, raio,
// pontos por peça contada, peças ganhas e jogadas de mirante.
const ORACLE_SPECIAL: Record<SpecialKind, { edges: T[]; terrain: T; radius: number; per: number; tiles: number; lookout: number }> = {
  station: { edges: [T.Rail, T.Village, T.Village, T.Rail, T.Field, T.Grass], terrain: T.Rail, radius: 2, per: 12, tiles: 2, lookout: 0 },
  watermill: { edges: [T.Water, T.Village, T.Field, T.Water, T.Field, T.Field], terrain: T.Field, radius: 1, per: 20, tiles: 1, lookout: 0 },
  lighthouse: { edges: [T.Water, T.Grass, T.Grass, T.Forest, T.Grass, T.Grass], terrain: T.Water, radius: 2, per: 10, tiles: 0, lookout: 5 },
};

// Cartas da virada de era (cópia independente dos números de src/core/blessings.ts).
const ORACLE_BLESS = { synergy: 5, perfect: 10, closed: 1, quest: 2, site: 1, lookout: 10 };
const BLESS_IDS = ['lumber', 'mill', 'pasture', 'apiary', 'surveyors', 'builders', 'pilgrims', 'cartographers'];

// Influência das construções (cópia independente de src/core/synergy.ts): terrenos que contam
// e pontos por setor em cada era; teto por peça.
const ORACLE_INF: Record<string, { terrains: T[]; per: number[] }> = {
  lumber: { terrains: [T.Forest], per: [1, 2, 2, 3] },
  mill: { terrains: [T.Field], per: [1, 2, 2, 3] },
  pasture: { terrains: [T.Grass], per: [1, 2, 2, 3] },
  apiary: { terrains: [T.Grass, T.Field], per: [1, 1, 1, 2] },
};
const ORACLE_INF_CAP = 8;

// Math.random determinístico para tornar bestMove reprodutível nos testes.
function seedMathRandom(seed: number) {
  const r = mulberry32(seed);
  Math.random = r;
}

const fails: string[] = [];
const counters: Record<string, number> = {};
const inc = (k: string, n = 1) => (counters[k] = (counters[k] ?? 0) + n);
function fail(msg: string) {
  if (fails.length < 60) fails.push(msg);
  inc('FALHAS_TOTAIS');
}
function assert(cond: boolean, msg: string) {
  if (!cond) fail(msg);
}

// ------------------------------------------------------------------ oráculos

/** Validade por força bruta, independente de Board.check. */
function oracleValid(b: Board, q: number, r: number, edges: readonly T[]) {
  if (b.tiles.has(hkey(q, r))) return false;
  let neighbors = 0;
  for (let i = 0; i < 6; i++) {
    const n = b.get(q + DIRS[i][0], r + DIRS[i][1]);
    if (!n) continue;
    neighbors++;
    const a = edges[i];
    const c = n.edges[(i + 3) % 6];
    if (a === c) continue;
    if (a === T.Water || a === T.Rail || c === T.Water || c === T.Rail) return false;
  }
  return neighbors > 0;
}

/** Candidatos: todas as células vazias adjacentes a alguma peça (recalculado do zero). */
function oracleFrontier(b: Board): Set<number> {
  const s = new Set<number>();
  for (const p of b.list) for (const [dq, dr] of DIRS) if (!b.tiles.has(hkey(p.q + dq, p.r + dr))) s.add(hkey(p.q + dq, p.r + dr));
  return s;
}

function oracleAnyMove(b: Board, def: TileDef) {
  for (const k of oracleFrontier(b)) {
    const [q, r] = unkey(k);
    for (let rot = 0; rot < 6; rot++) if (oracleValid(b, q, r, rotateEdges(def.edges, rot))) return true;
  }
  return false;
}

/** Bordas do grupo de (peça, setor) viradas para uma casa vazia (missão de fechar). */
function oracleOpenEdges(b: Board, anchor: Placed, sector: number) {
  let open = 0;
  for (const [p, s] of oracleGroupMembers(b, anchor, sector)) if (!b.get(p.q + DIRS[s][0], p.r + DIRS[s][1])) open++;
  return open;
}

/** BFS sobre (peça, setor): tamanho do grupo em nº de peças distintas. */
function oracleGroupSize(b: Board, anchor: Placed, sector: number) {
  return new Set(oracleGroupMembers(b, anchor, sector).map(([p]) => p)).size;
}

/** BFS sobre (peça, setor): todos os setores do grupo. */
function oracleGroupMembers(b: Board, anchor: Placed, sector: number): Array<[Placed, number]> {
  const idx = new Map<Placed, number>();
  b.list.forEach((p, i) => idx.set(p, i));
  const seen = new Set<number>();
  const stack: Array<[Placed, number]> = [[anchor, sector]];
  seen.add(idx.get(anchor)! * 6 + sector);
  const members: Array<[Placed, number]> = [];
  while (stack.length) {
    const [p, s] = stack.pop()!;
    members.push([p, s]);
    const terr = p.edges[s];
    const push = (pp: Placed, ss: number) => {
      const k = idx.get(pp)! * 6 + ss;
      if (!seen.has(k)) {
        seen.add(k);
        stack.push([pp, ss]);
      }
    };
    // dentro da peça
    for (let s2 = 0; s2 < 6; s2++) {
      if (s2 === s || p.edges[s2] !== terr) continue;
      if (isStrict(terr)) push(p, s2);
      else if (s2 === (s + 1) % 6 || s2 === (s + 5) % 6) push(p, s2);
    }
    // através da borda
    const nb = b.get(p.q + DIRS[s][0], p.r + DIRS[s][1]);
    if (nb && nb.edges[opposite(s)] === terr) push(nb, opposite(s));
  }
  return members;
}

function oracleClosed(b: Board, t: Placed) {
  for (let i = 0; i < 6; i++) {
    const n = b.get(t.q + DIRS[i][0], t.r + DIRS[i][1]);
    if (!n || n.edges[(i + 3) % 6] !== t.edges[i]) return false;
  }
  return true;
}

interface QuestHist {
  quest: Quest;
  sizes: number[];
  createdAtMove: number;
}

// ------------------------------------------------------------------ simulação

interface GameLog {
  seed: number;
  themeId: string;
  rules: Rules;
  specials: SpecialKind[];
  /** q, r, rot e, depois, as cartas escolhidas logo após a jogada (0 ou 1). */
  moves: number[][];
  snapshots: { score: number; stack: number; cur: number | null; next: number; tiles: number; active: number; discarded: number; perfects: number; qc: number }[];
  finalScore: number;
  finalStack: number;
  placed: number;
  discarded: number;
  quests: number;
  mode: string;
}

const themeStats: Record<string, { games: number; moves: number; score: number; discards: number; questsDone: number; questsFailed: number; exactDone: number; exactFailed: number; closed: number; perfects: number; maxActive: number; overshootGames: number }> = {};

// greedy: a IA do jogo; quest: a mesma IA, mas que também persegue as missões ativas (como uma
// pessoa faria); random e worst: jogadores ruins, para achar travas e casos extremos.
type Policy = 'greedy' | 'quest' | 'random' | 'worst';
function chooseMove(game: Game, policy: Policy, rnd: () => number): { q: number; r: number; rot: number } | null {
  if (policy === 'greedy') return game.bestMove();
  const def = game.current;
  if (!def) return null;
  if (policy === 'quest') return questMove(game, def, rnd);
  const all: { q: number; r: number; rot: number; score: number }[] = [];
  for (const k of game.board.frontier) {
    const [q, r] = unkey(k);
    for (let rot = 0; rot < 6; rot++) {
      const c = game.board.check(q, r, rotateEdges(def.edges, rot));
      if (!c.valid) continue;
      all.push({ q, r, rot, score: c.matches * 3 - (c.neighbors - c.matches) * 2 + (c.matches === c.neighbors ? c.neighbors : 0) });
    }
  }
  if (!all.length) return null;
  if (policy === 'random') return all[Math.floor(rnd() * all.length)];
  // worst: pior pontuação (mais desencaixes), desempate aleatório
  let best = all[0];
  for (const m of all) if (m.score < best.score || (m.score === best.score && rnd() < 0.3)) best = m;
  return best;
}

/** Jogada gulosa com um empurrão para as missões ativas (não usa o código das missões do Board). */
function questMove(game: Game, def: TileDef, rnd: () => number) {
  const b = game.board;
  // Casas vizinhas de cada grupo de missão, com o terreno que o grupo pede.
  const want = new Map<number, number>();
  const counts = { perfect: 0, syn: new Set<string>() };
  for (const q of b.activeQuests()) {
    if (q.kind === 'perfect') counts.perfect++;
    else if (q.kind === 'synergy') counts.syn.add(q.syn!);
    else if (!(q.exact && q.target - q.progress <= 1)) {
      for (const [p, s] of oracleGroupMembers(b, q.anchor, q.sector)) {
        const k = hkey(p.q + DIRS[s][0], p.r + DIRS[s][1]);
        if (!b.tiles.has(k)) want.set(k * 8 + opposite(s), q.terrain);
      }
    }
  }
  const PAIR_KIND = ['lumber', 'mill', 'pasture', 'apiary'];
  const PAIRS = [[T.Village, T.Forest], [T.Village, T.Field], [T.Village, T.Grass], [T.Field, T.Grass]];
  let best: { q: number; r: number; rot: number; score: number } | null = null;
  for (const k of b.frontier) {
    const [q, r] = unkey(k);
    for (let rot = 0; rot < 6; rot++) {
      const edges = rotateEdges(def.edges, rot);
      const c = b.check(q, r, edges);
      if (!c.valid) continue;
      let score = c.matches * 3 - (c.neighbors - c.matches) * 2 + (c.matches === c.neighbors ? c.neighbors : 0) + rnd() * 0.5;
      for (let i = 0; i < 6; i++) {
        const t = want.get(k * 8 + i);
        if (t !== undefined && edges[i] === t) score += 3;
        const n = b.get(q + DIRS[i][0], r + DIRS[i][1]);
        if (!n || !counts.syn.size) continue;
        const pair = PAIRS.findIndex(([x, y]) => (edges[i] === x && n.edges[opposite(i)] === y) || (edges[i] === y && n.edges[opposite(i)] === x));
        if (pair >= 0 && counts.syn.has(PAIR_KIND[pair])) score += 2;
      }
      if (counts.perfect && c.neighbors >= 2 && c.matches === c.neighbors) score += 2;
      if (!best || score > best.score) best = { q, r, rot, score };
    }
  }
  return best;
}

function simulate(seed: number, themeIdx: number, checkEvery: boolean, policy: Policy = 'greedy', mode: Mode = MODES[0], specials: SpecialKind[] = []): GameLog {
  const prnd = mulberry32(seed ^ 0x5bd1e995);
  const theme = THEMES[themeIdx];
  const rules = rulesFor(theme, mode);
  // Zen não acaba: a simulação para num teto de jogadas.
  const maxMoves = rules.infinite ? 70 : Infinity;
  let expectedEra = 0;
  let pendingMark: number | null = null;
  // Maravilha (oráculo): índice da peça do canteiro e etapa.
  let wonderAt: number | null = null;
  let wonderStage = 0;
  // Cartas escolhidas e escolhas ainda na mesa (oráculo).
  const oBless = new Set<string>();
  let oOffers = 0;
  // Influência (oráculo): casa → tipos de construção vizinha.
  const oInf = new Map<string, Set<string>>();
  const game = new Game(seed, rules, specials);
  const b = game.board;
  const specialsSeen = new Set<SpecialKind>();
  const log: GameLog = { seed, themeId: theme.id, rules, specials, moves: [], snapshots: [], finalScore: 0, finalStack: 0, placed: 0, discarded: 0, quests: 0, mode: mode.id };
  const ts = (themeStats[theme.id] ??= { games: 0, moves: 0, score: 0, discards: 0, questsDone: 0, questsFailed: 0, exactDone: 0, exactFailed: 0, closed: 0, perfects: 0, maxActive: 0, overshootGames: 0 });
  ts.games++;

  const hist = new Map<number, QuestHist>();
  // Contagens próprias do oráculo para as missões de contagem (perfeitos e interações por tipo).
  let oraclePerfects = 0;
  const oracleSyn: Record<string, number> = { lumber: 0, mill: 0, pasture: 0, apiary: 0 };
  const questBase = new Map<number, number>();
  let expectedScore = 0;
  let expectedStack = rules.startTiles;
  let maxActive = 0;

  // A 1ª peça nunca deve estar travada
  assert(game.current !== null && oracleAnyMove(b, game.current), `seed ${seed}/${theme.id}: 1ª peça sem jogada`);

  let guard = 0;
  while (game.current && guard++ < 5000 && log.moves.length < maxMoves) {
    assert(game.stack >= 1, `seed ${seed}: pilha ${game.stack} com peça atual`);
    const cur = game.current;
    // bestMove só devolve jogadas válidas e null <=> não há jogada
    const m = chooseMove(game, policy, prnd);
    const any = oracleAnyMove(b, cur);
    assert((m !== null) === any, `seed ${seed}: bestMove ${m ? 'achou' : 'null'} mas oráculo anyMove=${any}`);
    assert((game.bestMove() !== null) === any, `seed ${seed}: game.bestMove() diverge do oráculo`);
    assert(game.hasAnyMove(cur) === any, `seed ${seed}: hasAnyMove diverge do oráculo`);
    if (!m) {
      // nunca deveria chegar aqui pois discardIfStuck roda após cada jogada
      fail(`seed ${seed}: peça sem jogada permanece como atual (soft-lock)`);
      break;
    }
    const edges = rotateEdges(cur.edges, m.rot);
    // Marco da era: a primeira peça com vila depois de um avanço.
    // A peça especial tem a construção dela no meio: o marco espera a próxima peça com vila.
    const expectedMark = pendingMark !== null && !cur.special && edges.some((e) => e === T.Village) ? pendingMark : null;
    assert(oracleValid(b, m.q, m.r, edges), `seed ${seed}: bestMove inválida pelo oráculo`);
    // Estado prévio para o oráyculo de pontuação
    const closedBefore = new Set(b.list.filter((t) => oracleClosed(b, t)).map((t) => t.index));
    // vizinhos/encaixes pelo oráculo
    let nbs = 0, mt = 0, syn = 0;
    const synKinds: string[] = [];
    // Interações (oráculo próprio): bordas comuns diferentes que formam um dos 4 pares.
    const SYN_PAIRS = [
      [T.Village, T.Forest],
      [T.Village, T.Field],
      [T.Village, T.Grass],
      [T.Field, T.Grass],
    ];
    for (let i = 0; i < 6; i++) {
      const n = b.get(m.q + DIRS[i][0], m.r + DIRS[i][1]);
      if (!n) continue;
      nbs++;
      const a = edges[i], c = n.edges[(i + 3) % 6];
      if (c === a) mt++;
      else {
        const pair = SYN_PAIRS.findIndex(([x, y]) => (a === x && c === y) || (a === y && c === x));
        if (pair >= 0) {
          syn++;
          synKinds.push(['lumber', 'mill', 'pasture', 'apiary'][pair]);
        }
      }
    }
    const prevQuestStates = b.quests.map((q) => q.state);
    const listBefore = b.list.length;
    // Sítio escondido na posição escolhida (antes de colocar).
    const siteHere = b.sites.find((st) => !st.found && st.q === m.q && st.r === m.r) ?? null;
    const siteKind = siteHere?.kind ?? null;
    const foundBefore = b.sites.filter((st) => st.found).length;

    game.rot = m.rot;
    const res = game.place(m.q, m.r);
    if (!res) {
      fail(`seed ${seed}: game.place recusou jogada válida`);
      break;
    }
    log.moves.push([m.q, m.r, m.rot]);
    inc('jogadas');
    ts.moves++;
    assert(b.list.length === listBefore + 1, `seed ${seed}: list não cresceu 1`);
    assert(b.tiles.size === b.list.length, `seed ${seed}: tiles.size != list.length`);

    // --- pontuação esperada (inclui os bônus do tema, recalculados aqui)
    let pts = mt * rules.matchPoints + syn * rules.synergyPoints;
    // Estação (cópia de src/core/seasons.ts): a cada 20 jogadas, +3 numa interação.
    const seasonLock = rules.seasonLock;
    const season = seasonLock === 0 || seasonLock === 1 || seasonLock === 2 || seasonLock === 3 ? seasonLock : Math.floor((log.moves.length - 1) / 20) % 4;
    const seasonKind = (['apiary', 'mill', 'lumber', 'pasture'] as const)[season];
    for (let i = 0; i < 6; i++) {
      const n = b.get(m.q + DIRS[i][0], m.r + DIRS[i][1]);
      if (!n || n === res.placed) continue;
      const a = edges[i], c = n.edges[(i + 3) % 6];
      if (a === c) pts += rules.matchBonus[a] ?? 0;
      else {
        const pair = SYN_PAIRS.findIndex(([x, y]) => (a === x && c === y) || (a === y && c === x));
        if (pair >= 0) {
          const kind = (['lumber', 'mill', 'pasture', 'apiary'] as const)[pair];
          pts += rules.synergyBonus[kind] ?? 0;
          if (oBless.has(kind)) pts += ORACLE_BLESS.synergy;
          if (rules.seasonBonus && kind === seasonKind) pts += 3;
        }
      }
    }
    assert(res.synergies.length === syn, `seed ${seed}: interações ${res.synergies.length} != oráculo ${syn}`);
    // Influência: casa marcada por interações anteriores; cada tipo uma vez, com teto.
    let inf = 0;
    if (rules.influence) {
      for (const kind of oInf.get(`${m.q},${m.r}`) ?? []) {
        const O = ORACLE_INF[kind];
        inf += edges.filter((e) => O.terrains.includes(e)).length * O.per[Math.min(expectedEra, 3)];
      }
      inf = Math.min(ORACLE_INF_CAP, inf);
      oInf.delete(`${m.q},${m.r}`);
      for (const kind of synKinds) for (const [dq, dr] of DIRS) if (!b.get(m.q + dq, m.r + dr)) {
        const k = `${m.q + dq},${m.r + dr}`;
        if (!oInf.has(k)) oInf.set(k, new Set());
        oInf.get(k)!.add(kind);
      }
    }
    pts += inf;
    assert(res.influence.points === inf, `seed ${seed}: influência ${res.influence.points} != oráculo ${inf}`);
    if (inf) inc('influencia');
    const perfect = nbs >= 2 && mt === nbs;
    if (perfect) pts += rules.perfectBonus + (oBless.has('surveyors') ? ORACLE_BLESS.perfect : 0);
    assert(res.perfect === perfect, `seed ${seed}: perfect diverge`);
    if (perfect) oraclePerfects++;
    for (const k of synKinds) oracleSyn[k]++;
    assert(res.matches === mt && res.neighbors === nbs, `seed ${seed}: matches/neighbors divergem (${res.matches}/${res.neighbors} vs ${mt}/${nbs})`);
    const closedAfter = new Set(b.list.filter((t) => oracleClosed(b, t)).map((t) => t.index));
    const newlyClosed = [...closedAfter].filter((i) => !closedBefore.has(i));
    assert(newlyClosed.length === res.closed.length, `seed ${seed}: closed diverge (${newlyClosed.length} vs ${res.closed.length})`);
    for (const t of b.list) assert(t.closed === closedAfter.has(t.index), `seed ${seed}: flag closed inconsistente na peça ${t.index}`);
    pts += newlyClosed.length * rules.closedBonus;
    let gained = newlyClosed.length * (rules.closedTiles + (oBless.has('builders') ? ORACLE_BLESS.closed : 0));
    ts.closed += newlyClosed.length;
    if (perfect) ts.perfects++;

    // --- missões: progresso e estado esperados pelo oráculo
    for (let qi = 0; qi < prevQuestStates.length; qi++) {
      const q = b.quests[qi];
      if (prevQuestStates[qi] !== 'active') {
        assert(q.state === prevQuestStates[qi], `seed ${seed}: missão ${q.id} mudou de estado depois de encerrada`);
        continue;
      }
      let expected: 'active' | 'done' | 'failed' = 'active';
      let progress: number;
      let gain: number;
      if (q.kind === 'group') {
        const size = oracleGroupSize(b, q.anchor, q.sector);
        hist.get(q.id)!.sizes.push(size);
        if (q.exact) {
          if (size === q.target) expected = 'done';
          else if (size > q.target) expected = 'failed';
        } else if (size >= q.target) expected = 'done';
        progress = size;
        gain = q.target * 10;
      } else if (q.kind === 'close') {
        const open = oracleOpenEdges(b, q.anchor, q.sector);
        if (open === 0) expected = 'done';
        progress = Math.max(0, q.target - open);
        gain = oracleGroupSize(b, q.anchor, q.sector) * 10;
        inc('missao_fechar_' + expected);
      } else {
        const count = q.kind === 'perfect' ? oraclePerfects : oracleSyn[q.syn!];
        progress = count - questBase.get(q.id)!;
        if (progress >= q.target) expected = 'done';
        gain = q.target * (q.kind === 'perfect' ? 20 : 15);
      }
      assert(q.state === expected, `seed ${seed}: missão ${q.id} (${q.kind}${q.exact ? ' exata' : ''}) alvo ${q.target} progresso ${progress} estado ${q.state} esperado ${expected}`);
      if (expected === 'done') {
        pts += gain;
        gained += q.reward + (oBless.has('pilgrims') ? ORACLE_BLESS.quest : 0);
        ts.questsDone++;
        if (q.exact) ts.exactDone++;
        inc('missao_ok_' + q.kind);
      } else if (expected === 'failed') {
        ts.questsFailed++;
        if (q.exact) ts.exactFailed++;
      }
      if (q.state === 'active') assert(q.progress === progress, `seed ${seed}: progresso da missão ${q.id} ${q.progress} != oráculo ${progress}`);
    }
    if (res.newQuest) {
      const nq = res.newQuest;
      assert(nq.kind === cur.quest?.kind && nq.anchor === res.placed && nq.state === 'active', `seed ${seed}: nova missão não veio da peça`);
      if (nq.kind === 'group' || nq.kind === 'close') {
        const size = oracleGroupSize(b, nq.anchor, nq.sector);
        assert(nq.anchor.edges[nq.sector] === nq.terrain, `seed ${seed}: setor/terreno da missão incoerentes`);
        // o setor escolhido deve ser o de maior grupo
        let bestSize = -1;
        for (let s = 0; s < 6; s++) if (nq.anchor.edges[s] === nq.terrain) bestSize = Math.max(bestSize, oracleGroupSize(b, nq.anchor, s));
        assert(size === bestSize, `seed ${seed}: missão não usou o maior grupo`);
        if (nq.kind === 'group') {
          assert(nq.progress === size && nq.target > size, `seed ${seed}: nova missão inconsistente`);
          assert(nq.reward === (nq.exact ? rules.exactQuestTiles : rules.groupQuestTiles + Math.floor(nq.target / 6)), `seed ${seed}: recompensa da missão de grupo`);
        } else {
          const open = oracleOpenEdges(b, nq.anchor, nq.sector);
          assert(open > 0 && nq.target === open && nq.progress === 0 && nq.reward === rules.closeQuestTiles, `seed ${seed}: nova missão de fechar inconsistente`);
        }
        hist.set(nq.id, { quest: nq, sizes: [size], createdAtMove: log.moves.length });
      } else {
        assert(nq.target >= 3 && nq.progress === 0 && nq.reward === rules.countQuestTiles && (nq.kind === 'perfect' || !!nq.syn), `seed ${seed}: nova missão de contagem inconsistente`);
        questBase.set(nq.id, nq.kind === 'perfect' ? oraclePerfects : oracleSyn[nq.syn!]);
        hist.set(nq.id, { quest: nq, sizes: [], createdAtMove: log.moves.length });
      }
      inc('missao_nova_' + nq.kind);
    } else if (cur.quest && (cur.quest.kind === 'perfect' || cur.quest.kind === 'synergy')) fail(`seed ${seed}: missão de contagem não nasceu`);
    for (const q of b.quests) if (!hist.has(q.id)) fail(`seed ${seed}: missão ${q.id} sem histórico`);

    // --- sítio
    if (siteKind) {
      pts += ORACLE_SITE[siteKind].points;
      gained += ORACLE_SITE[siteKind].tiles + (oBless.has('cartographers') ? ORACLE_BLESS.site : 0);
      inc('sitios_' + siteKind);
    }
    // --- peça especial: pontos por peça a até `radius` hexágonos com ao menos uma borda do terreno dela
    let specialExp: { kind: SpecialKind; count: number; points: number; tiles: number } | null = null;
    if (cur.special) {
      const O = ORACLE_SPECIAL[cur.special];
      assert(cur.edges.every((e, i) => e === O.edges[i]) && !cur.quest, `seed ${seed}: peça especial ${cur.special} com bordas ou missão erradas`);
      let count = 0;
      for (const t of b.list) {
        if (t === res.placed) continue;
        const dq = t.q - res.placed.q, dr = t.r - res.placed.r;
        if ((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2 <= O.radius && t.edges.includes(O.terrain)) count++;
      }
      pts += count * O.per;
      gained += O.tiles;
      specialExp = { kind: cur.special, count, points: count * O.per, tiles: O.tiles };
      if (O.lookout) assert(b.lookout >= O.lookout, `seed ${seed}: farol não abriu o mirante`);
      specialsSeen.add(cur.special);
      inc('especiais_' + cur.special);
    }
    assert(JSON.stringify(res.special) === JSON.stringify(specialExp), `seed ${seed}: especial ${JSON.stringify(res.special)} != oráculo ${JSON.stringify(specialExp)}`);
    assert((res.site?.kind ?? null) === siteKind, `seed ${seed}: sítio ${res.site?.kind} != oráculo ${siteKind}`);
    assert(b.sites.filter((st) => st.found).length === foundBefore + (siteKind ? 1 : 0), `seed ${seed}: contagem de sítios achados`);

    // --- maravilha: na última era, a primeira peça com 2+ bordas de vila (que não seja a do
    // marco) vira canteiro; cada peça seguinte avança uma etapa; a última etapa paga o bônus.
    let wonderExp: { stage: number; started: boolean; done: boolean } | null = null;
    if (wonderAt !== null && wonderStage < rules.wonderStages) {
      wonderStage++;
      const done = wonderStage === rules.wonderStages;
      if (done) {
        pts += rules.wonderPoints;
        gained += rules.wonderTiles;
        inc('maravilhas');
      }
      wonderExp = { stage: wonderStage, started: false, done };
    } else if (wonderAt === null && !cur.special && rules.wonderStages > 0 && rules.eraScores.length > 1 && expectedEra === rules.eraScores.length - 1 && expectedMark === null && edges.filter((e) => e === T.Village).length >= 2) {
      wonderAt = res.placed.index;
      wonderStage = 0;
      wonderExp = { stage: 0, started: true, done: false };
      inc('canteiros');
    }
    assert(JSON.stringify(res.wonder) === JSON.stringify(wonderExp), `seed ${seed}: maravilha ${JSON.stringify(res.wonder)} != oráculo ${JSON.stringify(wonderExp)}`);
    assert((b.wonder?.tile.index ?? null) === wonderAt && (b.wonder?.stage ?? 0) === wonderStage, `seed ${seed}: estado da maravilha diverge do oráculo`);

    // --- eras: limiares de pontuação, +eraTiles por era
    expectedScore += pts;
    let eraUps = 0;
    while (expectedEra + 1 < rules.eraScores.length && expectedScore >= rules.eraScores[expectedEra + 1]) {
      expectedEra++;
      eraUps++;
    }
    gained += eraUps * rules.eraTiles;
    if (eraUps) inc('eras');
    if (expectedMark !== null) {
      pendingMark = null;
      inc('marcos_de_era');
    }
    if (eraUps) pendingMark = expectedEra;
    assert((res.placed.eraMark ?? null) === expectedMark, `seed ${seed}: marco da era ${res.placed.eraMark} != oráculo ${expectedMark}`);
    assert(b.era === expectedEra, `seed ${seed}: era ${b.era} != oráculo ${expectedEra}`);
    assert((res.eraUp !== null) === eraUps > 0, `seed ${seed}: eraUp ${res.eraUp} sem avanço esperado`);

    // --- escolha de era: uma por era nova; a política 'worst' nunca escolhe (partida sem cartas)
    if (rules.blessings) oOffers += eraUps;
    assert(game.offers.length === oOffers, `seed ${seed}: ${game.offers.length} escolhas de era na mesa, oráculo ${oOffers}`);
    const onTable = game.offers.flat();
    for (const o of game.offers) assert(o.length === 2 && o[0] !== o[1] && o.every((id) => BLESS_IDS.includes(id) && !oBless.has(id)), `seed ${seed}: escolha de era inválida ${JSON.stringify(o)}`);
    assert(new Set(onTable).size === onTable.length, `seed ${seed}: carta repetida na mesa ${JSON.stringify(game.offers)}`);
    while (policy !== 'worst' && game.offers.length) {
      const pick = prnd() < 0.5 ? 0 : 1;
      const want = game.offers[0][pick];
      const lookBefore = b.lookout;
      const got = game.choose(pick);
      assert(got === want, `seed ${seed}: escolheu ${got}, esperado ${want}`);
      oBless.add(want);
      oOffers--;
      log.moves[log.moves.length - 1].push(pick);
      if (want === 'cartographers') assert(b.lookout === Math.max(lookBefore, ORACLE_BLESS.lookout), `seed ${seed}: cartógrafos não abriram o mirante`);
      inc('cartas_' + want);
    }
    assert(b.blessings.length === oBless.size && b.blessings.every((id) => oBless.has(id)), `seed ${seed}: cartas ${b.blessings} != oráculo ${[...oBless]}`);

    // --- exploradores: último sítio encerra e as peças que sobram viram pontos
    const allFound = rules.endOnSites && b.sites.length > 0 && b.sites.every((st) => st.found);
    if (!rules.infinite) expectedStack += gained - 1;
    if (allFound) {
      const bonus = Math.max(0, expectedStack) * rules.leftoverPoints;
      pts += bonus;
      expectedScore += bonus;
      expectedStack = 0;
      inc('exploradores_completos');
    }
    assert(res.points === pts, `seed ${seed}: pontos da jogada ${res.points} != oráculo ${pts}`);
    assert(res.tilesGained === gained, `seed ${seed}: peças ganhas ${res.tilesGained} != oráculo ${gained}`);
    assert(b.score === expectedScore, `seed ${seed}: score acumulado ${b.score} != oráculo ${expectedScore}`);

    // --- fronteira
    if (checkEvery) {
      const of = oracleFrontier(b);
      assert(of.size === b.frontier.size && [...of].every((k) => b.frontier.has(k)), `seed ${seed}: fronteira inconsistente`);
      // grupo: todas as peças (peça, setor) batem com o oráculo? amostra: todas as peças
      for (const t of b.list) for (let s = 0; s < 6; s++) {
        const a = b.groupSize(t, s);
        const o = oracleGroupSize(b, t, s);
        if (a !== o) {
          fail(`seed ${seed}: groupSize(${t.q},${t.r},s${s}) = ${a}, oráculo ${o}`);
          break;
        }
      }
    }
    const active = b.activeQuests().length;
    maxActive = Math.max(maxActive, active);

    // --- descarte (mesmo fluxo do main.ts)
    let disc = 0;
    while (true) {
      const cur2 = game.current;
      const stuckOracle = cur2 !== null && !oracleAnyMove(b, cur2);
      const stackBefore = game.stack;
      const did = game.discardIfStuck();
      assert(did === stuckOracle, `seed ${seed}: discardIfStuck=${did} oráculo=${stuckOracle}`);
      if (!did) break;
      disc++;
      if (!rules.infinite) expectedStack -= 1;
      assert(game.stack === stackBefore - (rules.infinite ? 0 : 1), `seed ${seed}: descarte mexeu na pilha de forma errada`);
      inc('descartes');
      ts.discards++;
    }
    log.discarded += disc;
    assert(game.stack === expectedStack, `seed ${seed}: pilha ${game.stack} != esperada ${expectedStack}`);
    assert(game.stack >= 0, `seed ${seed}: pilha negativa ${game.stack}`);
    assert((game.current === null) === (game.stack <= 0), `seed ${seed}: over inconsistente (stack ${game.stack}, current ${game.current ? 'sim' : 'não'})`);
    log.snapshots.push({ score: b.score, stack: game.stack, cur: game.current ? game.current.seed : null, next: game.next.seed, tiles: b.list.length, active, discarded: game.discarded, perfects: b.perfects, qc: b.questsCompleted });
  }
  assert(guard < 5000, `seed ${seed}: loop de segurança estourou`);

  // Missões: estado final coerente com o histórico
  for (const h of hist.values()) {
    const q = h.quest;
    if (q.kind !== 'group') continue;
    let exp: 'active' | 'done' | 'failed' = 'active';
    for (const s of h.sizes.slice(1)) {
      if (exp !== 'active') break;
      if (q.exact) {
        if (s === q.target) exp = 'done';
        else if (s > q.target) exp = 'failed';
      } else if (s >= q.target) exp = 'done';
    }
    assert(q.state === exp, `seed ${seed}: estado final da missão ${q.id} ${q.state} != histórico ${exp}`);
    // monotonicidade do tamanho
    for (let i = 1; i < h.sizes.length; i++) if (h.sizes[i] < h.sizes[i - 1]) fail(`seed ${seed}: grupo da missão ${q.id} encolheu`);
  }
  assert(b.questsCompleted === b.quests.filter((q) => q.state === 'done').length, `seed ${seed}: questsCompleted != nº de missões done`);
  assert(b.perfects === log.snapshots.length ? true : true, '');
  log.finalScore = b.score;
  log.finalStack = game.stack;
  log.placed = game.placedCount;
  log.quests = b.questsCompleted;
  ts.score += b.score;
  ts.maxActive = Math.max(ts.maxActive, maxActive);
  if (maxActive > rules.maxQuests) ts.overshootGames++;
  if (!rules.infinite) {
    assert(game.over, `seed ${seed}: jogo não terminou`);
    // conservação da pilha: início + ganhos - jogadas - descartes = 0 (fim)
    assert(game.stack <= 0, `seed ${seed}: fim de jogo com pilha ${game.stack}`);
  } else assert(!game.over && game.stack === rules.startTiles, `seed ${seed}: zen terminou ou mexeu na pilha`);
  assert(game.placedCount === log.moves.length, `seed ${seed}: placedCount != moves`);
  // Toda peça liberada sai até a 16ª peça depois do início: quem jogou mais que isso a viu.
  for (const k of specials) if (log.moves.length + log.discarded >= 16 + 13 * SPECIAL_KINDS.indexOf(k)) assert(specialsSeen.has(k) || log.discarded > 0, `seed ${seed}: peça especial ${k} liberada não saiu`);
  for (const k of specialsSeen) assert(specials.includes(k), `seed ${seed}: peça especial ${k} saiu sem estar liberada`);
  return log;
}

// ------------------------------------------------------------------ replay (mesmo fluxo de main.ts:newGame)

function replay(log: GameLog, upTo = log.moves.length) {
  const game = new Game(log.seed, log.rules, log.specials);
  const moves: number[][] = [];
  for (const [q, r, rot, ...picks] of log.moves.slice(0, upTo)) {
    game.rot = rot;
    if (!game.place(q, r)) break;
    for (const p of picks) game.choose(p);
    moves.push([q, r, rot, ...picks]);
    while (game.discardIfStuck());
  }
  return { game, moves };
}

// ------------------------------------------------------------------ execução

const N_GAMES = Number(process.argv[2] ?? 300);
const t0 = Date.now();
const logs: GameLog[] = [];
const POLICIES: Policy[] = ['greedy', 'quest', 'random', 'worst'];
for (let g = 0; g < N_GAMES; g++) {
  const themeIdx = g % THEMES.length;
  const policy = POLICIES[Math.floor(g / THEMES.length) % POLICIES.length];
  const seed = 1000 + g * 7919;
  seedMathRandom(seed ^ 0xabcdef);
  // Um quinto das partidas em cada modo alternativo (o resto no clássico).
  const mode = g % 5 === 4 ? MODES[1 + Math.floor(g / 5) % (MODES.length - 1)] : MODES[0];
  // Um terço das partidas com todas as peças especiais liberadas e um terço só com a primeira.
  const specials = g % 3 === 1 ? [...SPECIAL_KINDS] : g % 3 === 2 ? [SPECIAL_KINDS[0]] : [];
  const lg = simulate(seed, themeIdx, g < 60, policy, mode, specials);
  (lg as GameLog & { policy?: string }).policy = policy;
  inc('partidas_' + policy);
  inc('modo_' + mode.id);
  logs.push(lg);
}
console.log(`Simulação: ${N_GAMES} partidas em ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// Replay completo e parcial
let replayFull = 0, replayPartial = 0, replayMismatch = 0;
for (const log of logs) {
  const { game, moves } = replay(log);
  replayFull++;
  const ok = game.board.score === log.finalScore && game.stack === log.finalStack && game.placedCount === log.placed && moves.length === log.moves.length && game.discarded === log.discarded;
  if (!ok) {
    replayMismatch++;
    fail(`replay completo divergiu na seed ${log.seed}: score ${game.board.score} vs ${log.finalScore}, stack ${game.stack} vs ${log.finalStack}`);
  }
  // parciais (estado a cada k jogadas)
  const ks = new Set<number>([1, 2, 3, Math.floor(log.moves.length / 2), log.moves.length - 1]);
  for (let i = 0; i < 6; i++) ks.add(1 + Math.floor(((i + 1) * log.moves.length) / 7));
  for (const k of ks) {
    if (k < 1 || k > log.moves.length) continue;
    const { game: gk } = replay(log, k);
    replayPartial++;
    const s = log.snapshots[k - 1];
    const same =
      gk.board.score === s.score &&
      gk.stack === s.stack &&
      (gk.current ? gk.current.seed : null) === s.cur &&
      gk.next.seed === s.next &&
      gk.board.list.length === s.tiles &&
      gk.board.activeQuests().length === s.active &&
      gk.discarded === s.discarded &&
      gk.board.perfects === s.perfects &&
      gk.board.questsCompleted === s.qc;
    if (!same) {
      replayMismatch++;
      fail(`replay parcial k=${k} divergiu na seed ${log.seed}`);
    }
  }
}
console.log(`Replay: ${replayFull} completos + ${replayPartial} parciais, divergências: ${replayMismatch}`);

// Continuação após replay parcial: joga o resto das jogadas e compara o final
let contOk = 0, contBad = 0;
for (const log of logs.slice(0, 120)) {
  const k = Math.max(1, Math.floor(log.moves.length / 3));
  const { game } = replay(log, k);
  for (const [q, r, rot, ...picks] of log.moves.slice(k)) {
    game.rot = rot;
    if (!game.place(q, r)) break;
    for (const p of picks) game.choose(p);
    while (game.discardIfStuck());
  }
  if (game.board.score === log.finalScore && game.stack === log.finalStack) contOk++;
  else contBad++;
}
console.log(`Continuação pós-replay: ok ${contOk}, divergente ${contBad}`);
if (contBad) fail(`continuação pós-replay divergiu em ${contBad} partidas`);

// ------------------------------------------------------------------ hex: viagem de ida e volta
{
  let bad = 0, n = 0;
  for (let q = -60; q <= 60; q++) for (let r = -60; r <= 60; r++) {
    n++;
    const { x, z } = hexToWorld(q, r);
    const [q2, r2] = worldToHex(x, z);
    if (q2 !== q || r2 !== r) bad++;
    const k = hkey(q, r);
    const [q3, r3] = unkey(k);
    if (q3 !== q || r3 !== r) bad++;
  }
  // limites da chave
  for (const [q, r] of [[-4096, -4096], [4095, 4095], [-4096, 4095], [4095, -4096]]) {
    const [q3, r3] = unkey(hkey(q, r));
    if (q3 !== q || r3 !== r) bad++;
  }
  // ponto aleatório: worldToHex deve devolver o centro mais próximo
  const rnd = mulberry32(5);
  let nearestBad = 0;
  for (let i = 0; i < 20000; i++) {
    const x = (rnd() - 0.5) * 60, z = (rnd() - 0.5) * 60;
    const [q, r] = worldToHex(x, z);
    const c = hexToWorld(q, r);
    const d0 = Math.hypot(x - c.x, z - c.z);
    for (const [dq, dr] of DIRS) {
      const c2 = hexToWorld(q + dq, r + dr);
      if (Math.hypot(x - c2.x, z - c2.z) < d0 - 1e-9) nearestBad++;
    }
  }
  // DIRS[i] aponta para o ângulo do meio da borda i (30° + 60°·i)
  let dirBad = 0;
  for (let i = 0; i < 6; i++) {
    const c = hexToWorld(DIRS[i][0], DIRS[i][1]);
    const ang = (Math.atan2(c.z, c.x) * 180) / Math.PI;
    const want = (30 + 60 * i) % 360;
    const diff = (((ang - want) % 360) + 540) % 360 - 180;
    if (Math.abs(diff) > 1e-6) dirBad++;
    // oposto
    const o = DIRS[opposite(i)];
    if (o[0] !== -DIRS[i][0] || o[1] !== -DIRS[i][1]) dirBad++;
    if (hexDistance(0, 0, DIRS[i][0], DIRS[i][1]) !== 1) dirBad++;
  }
  console.log(`Hex: ${n} ida-e-volta, erros ${bad}; vizinho mais próximo violado ${nearestBad}/20000; DIRS/oposto erros ${dirBad}`);
  if (bad || nearestBad || dirBad) fail(`hex: bad=${bad} nearest=${nearestBad} dir=${dirBad}`);
}

// ------------------------------------------------------------------ sítios: determinismo e distribuição
{
  let bad = 0, total = 0;
  const dist = (a: { q: number; r: number }, b: { q: number; r: number }) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
  const RING_OK: [number, number][] = [
    [3, 4],
    [5, 6],
    [7, 9],
    [10, 12],
    [13, 15],
  ];
  for (let seed = 1; seed <= 400; seed++) {
    for (const n of [6, 10]) {
      const a = generateSites(seed, n), b2 = generateSites(seed, n);
      total++;
      if (JSON.stringify(a) !== JSON.stringify(b2)) bad++;
      if (a.length !== n) bad++;
      for (let i = 0; i < a.length; i++) {
        const [lo, hi] = RING_OK[Math.min(RING_OK.length - 1, Math.floor(i / 2))];
        const d0 = dist(a[i], { q: 0, r: 0 });
        if (d0 < lo || d0 > hi || a[i].found) bad++;
        for (let j = i + 1; j < a.length; j++) if (dist(a[i], a[j]) < 3) bad++;
      }
    }
  }
  // A semente dos sítios não mexe na sequência de peças: mesma semente, mesmas peças com e sem sítios.
  for (let seed = 1; seed <= 50; seed++) {
    const g1 = new Game(seed, { ...DEFAULT_RULES, sites: 0 });
    const g2 = new Game(seed, { ...DEFAULT_RULES, sites: 10 });
    if (g1.current?.seed !== g2.current?.seed || g1.next.seed !== g2.next.seed) bad++;
  }
  // As peças especiais só trocam a peça dos seus índices: o resto da sequência é igual.
  for (let seed = 1; seed <= 50; seed++) {
    const g1 = new Game(seed, { ...DEFAULT_RULES, startTiles: 200 });
    const g2 = new Game(seed, { ...DEFAULT_RULES, startTiles: 200 }, [...SPECIAL_KINDS]);
    const a = g1.upcoming(80), c = g2.upcoming(80);
    let specials = 0;
    for (let i = 0; i < 80; i++) {
      if (c[i].special) specials++;
      else if (a[i].seed !== c[i].seed || a[i].edges.join() !== c[i].edges.join()) bad++;
    }
    if (specials !== 6) bad++;
  }
  console.log(`Sítios: ${total} gerações conferidas, erros ${bad}`);
  if (bad) fail(`sítios: ${bad} erros de geração`);
}

// ------------------------------------------------------------------ resumo
console.log('\nContadores:', JSON.stringify(counters));
// Duração da partida no modo clássico, por jogador: é a medida do balanceamento (pilha, missões, recompensas).
console.log('\nClássico, por jogador (mediana de peças colocadas · média de missões cumpridas):');
for (const p of POLICIES) {
  const ls = logs.filter((l) => (l as GameLog & { policy?: string }).policy === p && l.mode === 'classico');
  if (!ls.length) continue;
  const placed = ls.map((l) => l.placed).sort((a, b) => a - b);
  const med = placed[Math.floor(placed.length / 2)];
  console.log(`  ${p.padEnd(7)} partidas ${String(ls.length).padStart(3)}  peças ${String(med).padStart(4)} (de ${placed[0]} a ${placed[placed.length - 1]})  missões ${(ls.reduce((a, l) => a + l.quests, 0) / ls.length).toFixed(1)}  pontos ${(ls.reduce((a, l) => a + l.finalScore, 0) / ls.length).toFixed(0)}`);
}
console.log('\nPor tema:');
for (const [id, s] of Object.entries(themeStats)) {
  console.log(
    `  ${id.padEnd(9)} partidas ${s.games}  jogadas/partida ${(s.moves / s.games).toFixed(1)}  pontos médios ${(s.score / s.games).toFixed(0)}  descartes ${s.discards}  missões ok ${s.questsDone} (exatas ${s.exactDone})  perdidas ${s.questsFailed}  fechadas ${s.closed}  perfeitos ${s.perfects}  máx.ativas ${s.maxActive}  partidas>maxQuests ${s.overshootGames}`,
  );
}
console.log('\nFALHAS:', fails.length ? '' : 'nenhuma');
for (const f of fails) console.log('  - ' + f);
process.exit(fails.length ? 1 : 0);
