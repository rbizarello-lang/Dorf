// Relatório de equilíbrio, separado dos testes. Não entra no `npm test`: uma leva
// de partidas por modo e por tema demora minutos, e o check precisa continuar rápido.
// Só usa src/core. As sementes são 1..N, então a mesma linha de comando dá a mesma tabela.
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEFAULT_RULES, type PlaceResult, type Rules } from '../src/core/board';
import { Game } from '../src/core/game';
import { DIRS, hkey, opposite, unkey } from '../src/core/hex';
import { MODES, type Mode } from '../src/core/modes';
import { mulberry32 } from '../src/core/rng';
import { previewRoutes } from '../src/core/routes';
import { SITE_REWARD } from '../src/core/sites';
import { synergyOf } from '../src/core/synergy';
import { T, rotateEdges, type TileDef } from '../src/core/tiles';
import { THEMES, type Theme } from '../src/themes/themes';

const rulesFor = (t: Theme, mode: Mode): Rules => ({ ...DEFAULT_RULES, ...(mode.daily ? {} : t.rules), ...mode.rules });

type Player = 'guloso' | 'missoes' | 'rotas';
const PLAYERS: Player[] = ['guloso', 'missoes', 'rotas'];
const PLAYER_NAME: Record<Player, string> = {
  guloso: 'guloso',
  missoes: 'persegue missões',
  rotas: 'busca rotas',
};

interface Buckets {
  missoes: number;
  bordas: number;
  perfeitos: number;
  interacoes: number;
  influencia: number;
  sitios: number;
  especiais: number;
  maravilha: number;
  rotas: number;
  sobras: number;
  cercados: number;
  demais: number;
}

interface Sample {
  score: number;
  tiles: number;
  era: number;
  discards: number;
  routes: number;
  routePoints: number;
  sitesFound: number;
  allSites: boolean;
  buckets: Buckets;
}

const emptyBuckets = (): Buckets => ({
  missoes: 0,
  bordas: 0,
  perfeitos: 0,
  interacoes: 0,
  influencia: 0,
  sitios: 0,
  especiais: 0,
  maravilha: 0,
  rotas: 0,
  sobras: 0,
  cercados: 0,
  demais: 0,
});

/** Parte os pontos da jogada pelo que o resultado já traz. O resto (bônus do tema, cartas, estação) fica em `demais`. */
function addBuckets(b: Buckets, res: PlaceResult, rules: Rules) {
  const missoes = res.questsDone.reduce((a, q) => a + (q.points ?? 0), 0);
  const bordas = res.matches * rules.matchPoints;
  const perfeitos = res.perfect ? rules.perfectBonus : 0;
  const interacoes = res.synergies.length * rules.synergyPoints;
  const influencia = res.influence.points;
  const sitios = res.site ? SITE_REWARD[res.site.kind].points : 0;
  const especiais = res.special?.points ?? 0;
  const maravilha = res.wonder?.done ? rules.wonderPoints : 0;
  const rotas = res.routes.reduce((a, h) => a + h.points, 0);
  const sobras = res.leftoverBonus ?? 0;
  const cercados = res.closed.length * rules.closedBonus;
  const known = missoes + bordas + perfeitos + interacoes + influencia + sitios + especiais + maravilha + rotas + sobras + cercados;
  b.missoes += missoes;
  b.bordas += bordas;
  b.perfeitos += perfeitos;
  b.interacoes += interacoes;
  b.influencia += influencia;
  b.sitios += sitios;
  b.especiais += especiais;
  b.maravilha += maravilha;
  b.rotas += rotas;
  b.sobras += sobras;
  b.cercados += cercados;
  b.demais += res.points - known;
}

function greedyScore(matches: number, neighbors: number, rand: () => number) {
  return matches * 3 - (neighbors - matches) * 2 + (matches === neighbors ? neighbors : 0) + rand() * 0.5;
}

/** A mesma nota do guloso, com um empurrão para a missão ativa (grupo, fechar, perfeito, interação). */
function questMove(game: Game, def: TileDef, rand: () => number) {
  const b = game.board;
  const want = new Map<number, T>();
  let perfects = 0;
  const syn = new Set<string>();
  for (const q of b.activeQuests()) {
    if (q.kind === 'perfect') perfects++;
    else if (q.kind === 'synergy' && q.syn) syn.add(q.syn);
    else if ((q.kind === 'group' || q.kind === 'close') && !(q.exact && q.target - q.progress <= 1)) {
      for (const [p, s] of b.groupMembers(q.anchor, q.sector)) {
        const k = hkey(p.q + DIRS[s][0], p.r + DIRS[s][1]);
        if (!b.tiles.has(k)) want.set(k * 8 + opposite(s), q.terrain);
      }
    }
  }
  let best: { q: number; r: number; rot: number; score: number } | null = null;
  for (const k of b.frontier) {
    const [q, r] = unkey(k);
    for (let rot = 0; rot < 6; rot++) {
      const edges = rotateEdges(def.edges, rot);
      const c = b.check(q, r, edges);
      if (!c.valid) continue;
      let score = greedyScore(c.matches, c.neighbors, rand);
      for (let i = 0; i < 6; i++) {
        const t = want.get(k * 8 + i);
        if (t !== undefined && edges[i] === t) score += 3;
        const n = b.get(q + DIRS[i][0], r + DIRS[i][1]);
        if (!n || !syn.size) continue;
        const kind = synergyOf(edges[i], n.edges[opposite(i)]);
        if (kind && syn.has(kind)) score += 2;
      }
      if (perfects && c.neighbors >= 2 && c.matches === c.neighbors) score += 2;
      if (!best || score > best.score) best = { q, r, rot, score };
    }
  }
  return best;
}

/**
 * O guloso, mas uma rota paga pesa mais que um encaixe comum. Serve para ver o teto
 * da Estrada Real: no clássico (sem a regra) a nota é a mesma do guloso.
 */
function routeMove(game: Game, def: TileDef, rand: () => number) {
  const b = game.board;
  let best: { q: number; r: number; rot: number; score: number } | null = null;
  for (const k of b.frontier) {
    const [q, r] = unkey(k);
    for (let rot = 0; rot < 6; rot++) {
      const edges = rotateEdges(def.edges, rot);
      const c = b.check(q, r, edges);
      if (!c.valid) continue;
      let score = greedyScore(c.matches, c.neighbors, rand);
      if (b.rules.routes) {
        const hits = previewRoutes(b, q, r, edges, def.special);
        if (hits.length) score += 6 * hits.length + hits.reduce((a, h) => a + h.points, 0) / 10;
      }
      if (!best || score > best.score) best = { q, r, rot, score };
    }
  }
  return best;
}

function choose(game: Game, player: Player, rand: () => number) {
  const def = game.current;
  if (!def) return null;
  if (player === 'guloso') return game.bestMove(rand);
  if (player === 'missoes') return questMove(game, def, rand);
  return routeMove(game, def, rand);
}

function play(seed: number, theme: Theme, mode: Mode, player: Player): Sample {
  const rules = rulesFor(theme, mode);
  const game = new Game(seed, rules, []);
  // O desempate do guloso usa um gerador à parte, para não mexer na sequência de peças.
  const rand = mulberry32((seed ^ 0x5eed) >>> 0);
  const buckets = emptyBuckets();
  let routes = 0;
  let routePoints = 0;
  let pointsSum = 0;
  const cap = rules.infinite ? 70 : 800;
  let guard = 0;
  while (game.current && guard++ < cap) {
    const m = choose(game, player, rand);
    if (!m) {
      if (!game.discardIfStuck()) break;
      continue;
    }
    game.rot = m.rot;
    const res = game.place(m.q, m.r);
    if (!res) break;
    addBuckets(buckets, res, rules);
    pointsSum += res.points;
    routes += res.routes.length;
    routePoints += res.routes.reduce((a, h) => a + h.points, 0);
    while (game.offers.length) game.choose(0);
    while (game.discardIfStuck());
  }
  if (Math.abs(pointsSum - game.board.score) > 0.01) {
    throw new Error(`semente ${seed} ${mode.id}/${theme.id}: soma das jogadas ${pointsSum} ≠ placar ${game.board.score}`);
  }
  const found = game.board.sites.filter((s) => s.found).length;
  return {
    score: game.board.score,
    tiles: game.placedCount,
    era: game.board.era,
    discards: game.discarded,
    routes,
    routePoints,
    sitesFound: found,
    allSites: game.board.sites.length > 0 && found === game.board.sites.length,
    buckets,
  };
}

interface Row {
  label: string;
  player: string;
  n: number;
  score: { mean: number; sd: number; p10: number; p50: number; p90: number };
  tilesP50: number;
  eraMean: number;
  discardPct: number;
  routes: number;
  routePoints: number;
  sites: number;
  allSitesPct: number;
  buckets: Buckets;
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function summarize(label: string, player: string, samples: Sample[]): Row {
  const scores = samples.map((s) => s.score).sort((a, b) => a - b);
  const tiles = samples.map((s) => s.tiles).sort((a, b) => a - b);
  const mean = scores.reduce((a, x) => a + x, 0) / scores.length;
  const variance = scores.reduce((a, x) => a + (x - mean) ** 2, 0) / Math.max(1, scores.length - 1);
  const buckets = emptyBuckets();
  for (const s of samples) for (const k of Object.keys(buckets) as (keyof Buckets)[]) buckets[k] += s.buckets[k] / samples.length;
  return {
    label,
    player,
    n: samples.length,
    score: { mean, sd: Math.sqrt(variance), p10: percentile(scores, 0.1), p50: percentile(scores, 0.5), p90: percentile(scores, 0.9) },
    tilesP50: percentile(tiles, 0.5),
    eraMean: samples.reduce((a, s) => a + s.era, 0) / samples.length,
    discardPct: (100 * samples.filter((s) => s.discards > 0).length) / samples.length,
    routes: samples.reduce((a, s) => a + s.routes, 0) / samples.length,
    routePoints: samples.reduce((a, s) => a + s.routePoints, 0) / samples.length,
    sites: samples.reduce((a, s) => a + s.sitesFound, 0) / samples.length,
    allSitesPct: (100 * samples.filter((s) => s.allSites).length) / samples.length,
    buckets,
  };
}

const nArg = Number(process.argv[2]);
const N = Number.isInteger(nArg) && nArg > 0 ? nArg : 80;
const vale = THEMES[0];
const modes = MODES.filter((m) => m.id !== 'zen');

const modeRows: Row[] = [];
for (const mode of modes) {
  for (const player of PLAYERS) {
    const samples: Sample[] = [];
    for (let seed = 1; seed <= N; seed++) samples.push(play(seed, vale, mode, player));
    modeRows.push(summarize(mode.name, PLAYER_NAME[player], samples));
    process.stderr.write(`${mode.name} · ${PLAYER_NAME[player]}: ${N} partidas\n`);
  }
}

const themeRows: Row[] = [];
const classic = modes[0];
for (const theme of THEMES) {
  const samples: Sample[] = [];
  for (let seed = 1; seed <= N; seed++) samples.push(play(seed, theme, classic, 'guloso'));
  themeRows.push(summarize(theme.name, 'guloso', samples));
  process.stderr.write(`${theme.name}: ${N} partidas\n`);
}

const num = (x: number, d = 0) => x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const cell = (x: number, d = 0) => num(x, d).padStart(7);

function scoreTable(rows: Row[]) {
  const head = '| | Jogador | Média | Desvio | p10 | p50 | p90 | Peças | Era | Travadas |';
  const sep = '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|';
  const body = rows.map(
    (r) =>
      `| ${r.label} | ${r.player} | ${cell(r.score.mean)} | ${cell(r.score.sd)} | ${cell(r.score.p10)} | ${cell(r.score.p50)} | ${cell(r.score.p90)} | ${cell(r.tilesP50)} | ${cell(r.eraMean, 2)} | ${cell(r.discardPct, 1)}% |`,
  );
  return [head, sep, ...body].join('\n');
}

function sourceTable(rows: Row[]) {
  const keys: (keyof Buckets)[] = ['missoes', 'bordas', 'perfeitos', 'interacoes', 'influencia', 'sitios', 'especiais', 'maravilha', 'rotas', 'sobras', 'cercados', 'demais'];
  const names = ['Missões', 'Bordas', 'Perfeitos', 'Interações', 'Influência', 'Sítios', 'Especiais', 'Maravilha', 'Rotas', 'Sobras', 'Cercados', 'Demais'];
  const head = `| | Jogador | ${names.join(' | ')} | Rotas/partida |`;
  const sep = `|---|---|${names.map(() => '---:').join('|')}|---:|`;
  const body = rows.map((r) => {
    const cols = keys.map((k) => cell(r.buckets[k]));
    return `| ${r.label} | ${r.player} | ${cols.join(' | ')} | ${cell(r.routes, 2)} |`;
  });
  return [head, sep, ...body].join('\n');
}

const lines = [
  `# Painel de equilíbrio`,
  ``,
  `${N} partidas por célula, sementes 1 a ${N}, sem peças especiais. A carta da era é sempre a primeira das duas. Zen fica de fora (não acaba).`,
  `Travadas = partidas com pelo menos um descarte. Era 0 é a primeira. "Demais" junta bônus do tema, cartas da era, estação e o extra do agrimensor.`,
  `Para comparar uma regra nova: rode de novo e veja a diferença em \`.cache/balance.json\`.`,
  ``,
  `## Modos (tema ${vale.name})`,
  ``,
  scoreTable(modeRows),
  ``,
  `### De onde vêm os pontos (média por partida)`,
  ``,
  sourceTable(modeRows),
  ``,
  `Sítios achados (média) e, nos Exploradores, partidas que acharam todos:`,
  ``,
  ...modeRows
    .filter((r) => r.label === 'Exploradores' || r.label === 'Estrada Real')
    .map((r) => `- ${r.label}, ${r.player}: ${num(r.sites, 2)} sítios; todos os sítios em ${num(r.allSitesPct, 1)}% das partidas; pontos de rota ${num(r.routePoints)} (${num((100 * r.routePoints) / Math.max(1, r.score.mean), 1)}% do placar).`),
  ``,
  `## Temas (Clássico, jogador guloso)`,
  ``,
  scoreTable(themeRows),
  ``,
];
const md = lines.join('\n');
process.stdout.write(md);

mkdirSync('.cache', { recursive: true });
writeFileSync('.cache/balance.md', md);
writeFileSync('.cache/balance.json', JSON.stringify({ games: N, seeds: [1, N], blessing: 0, specials: [], modes: modeRows, themes: themeRows }, null, 2));

const csvKeys = ['grupo', 'nome', 'jogador', 'n', 'media', 'desvio', 'p10', 'p50', 'p90', 'pecas_p50', 'era', 'travadas_pct', 'rotas', 'pontos_rota', 'sitios', 'todos_sitios_pct', ...Object.keys(emptyBuckets())];
const csvRow = (grupo: string, r: Row) =>
  [grupo, r.label, r.player, r.n, r.score.mean, r.score.sd, r.score.p10, r.score.p50, r.score.p90, r.tilesP50, r.eraMean, r.discardPct, r.routes, r.routePoints, r.sites, r.allSitesPct, ...Object.values(r.buckets)]
    .map((v) => (typeof v === 'number' ? v.toFixed(2) : v))
    .join(',');
writeFileSync('.cache/balance.csv', [csvKeys.join(','), ...modeRows.map((r) => csvRow('modo', r)), ...themeRows.map((r) => csvRow('tema', r))].join('\n') + '\n');
