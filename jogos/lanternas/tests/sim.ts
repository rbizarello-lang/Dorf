// Simulação: 300 partidas por jogador simulado, relatório e critérios de aprovação.
// Também confere invariantes (determinismo, limite de moradores, recursos). Falha (exit 1) se algo reprovar.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOTS, BotId, decide } from '../src/core/bots';
import { CARD_NAMES, GOAL_TITLES, Game, RULES, Struct } from '../src/core/game';
import { N } from '../src/core/hex';
import { Terrain } from '../src/core/map';
import { mulberry32 } from '../src/core/rng';

const GAMES = Number(process.env.GAMES ?? 300);
const GOAL_NAMES = GOAL_TITLES;
const failures: string[] = [];
const fail = (msg: string): void => { failures.push(msg); };

interface Result {
  score: number; goals: number[]; met: boolean[]; litPct: number; cards: number[]; discards: number;
  tightTurns: number; tightBase: number; stuck: number; fixed: number; hash: string; houseMax: number; minRes: number;
}

function playGame(bot: BotId, seed: number): Result {
  const g = new Game(seed);
  const rng = mulberry32(seed * 7919 + BOTS.indexOf(bot) + 1);
  const cards = [0, 0, 0, 0, 0];
  let tightTurns = 0, tightBase = 0, houseMax = 0, minRes = 99;
  const trace: number[] = [];
  while (!g.over) {
    const d = decide(bot, g, rng);
    if (d.cardValues.length >= 2) {
      tightBase++;
      const [a, b] = d.cardValues;
      if (a - b < 0.25 * Math.max(Math.abs(a), 1)) tightTurns++;
    }
    if (d.action.kind === 'play') cards[g.hand[d.action.slot]]++;
    const ok = g.apply(d.action);
    if (!ok) throw new Error(`${bot} seed ${seed}: ação ilegal`);
    trace.push(d.action.kind === 'play' ? d.action.idx : -1);
    // Invariantes a cada turno.
    minRes = Math.min(minRes, g.food, g.oil);
    for (const h of g.houses) houseMax = Math.max(houseMax, g.houseResidents(h));
  }
  const s = g.summary();
  return {
    score: s.score, goals: s.goals, met: s.goalsMet, litPct: s.litPct, cards, discards: g.discards,
    tightTurns, tightBase, stuck: g.stuckTurns, fixed: g.fixedHands, hash: trace.join(',') + '|' + s.score, houseMax, minRes,
  };
}

const pct = (xs: number[], p: number): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const f1 = (x: number): string => x.toFixed(1);
const f0p = (x: number): string => (100 * x).toFixed(0) + '%';

const results: Record<string, Result[]> = {};
for (const bot of BOTS) {
  results[bot] = [];
  for (let seed = 1; seed <= GAMES; seed++) results[bot].push(playGame(bot, seed));
}

// ---------- estatísticas ----------
interface Stats {
  mean: number; p10: number; p50: number; p90: number; goalRate: number[]; lit: number; cardShare: number[];
  discards: number; tight: number; stuckGames: number; fixedGames: number;
}
const stats: Record<string, Stats> = {};
for (const bot of BOTS) {
  const rs = results[bot];
  const sc = rs.map((r) => r.score);
  const goalRate = [0, 1, 2, 3, 4].map((gid) => {
    const withGoal = rs.filter((r) => r.goals.includes(gid));
    return withGoal.length ? withGoal.filter((r) => r.met[r.goals.indexOf(gid)]).length / withGoal.length : NaN;
  });
  const totalCards = [0, 1, 2, 3, 4].map((c) => rs.reduce((a, r) => a + r.cards[c], 0));
  const sumCards = totalCards.reduce((a, b) => a + b, 0);
  const tb = rs.reduce((a, r) => a + r.tightBase, 0);
  stats[bot] = {
    mean: mean(sc), p10: pct(sc, 0.1), p50: pct(sc, 0.5), p90: pct(sc, 0.9), goalRate,
    lit: mean(rs.map((r) => r.litPct)), cardShare: totalCards.map((c) => c / Math.max(1, sumCards)),
    discards: mean(rs.map((r) => r.discards)), tight: tb ? rs.reduce((a, r) => a + r.tightTurns, 0) / tb : 0,
    stuckGames: rs.filter((r) => r.stuck > 0).length / rs.length, fixedGames: rs.filter((r) => r.fixed > 0).length / rs.length,
  };
}

// ---------- critérios de aprovação ----------
const P = stats.planejador, Gu = stats.guloso, A = stats.aleatorio;
const check = (cond: boolean, msg: string): void => { if (!cond) fail(msg); };
check(P.mean >= 1.3 * A.mean, `planejador (${f1(P.mean)}) < 1,3x aleatório (${f1(A.mean)})`);
check(P.mean >= Gu.mean, `planejador (${f1(P.mean)}) < guloso (${f1(Gu.mean)})`);
check(P.tight >= 0.25 && P.tight <= 0.65, `escolha apertada do planejador fora de 25-65%: ${f0p(P.tight)}`);
P.cardShare.forEach((s, c) => check(s <= 0.45, `carta ${CARD_NAMES[c]} com ${f0p(s)} das escolhas do planejador (> 45%)`));
P.goalRate.forEach((r, gid) => { if (!(r >= 0.2 && r <= 0.85)) fail(`meta "${GOAL_NAMES[gid]}" do planejador cumprida em ${f0p(r)} (fora de 20-85%)`); });
check(P.lit >= 0.45 && P.lit <= 0.9, `ilha revelada pelo planejador: ${f0p(P.lit)} (fora de 45-90%)`);
for (const bot of BOTS) check(stats[bot].stuckGames === 0, `${bot}: ${f0p(stats[bot].stuckGames)} das partidas com turno sem jogada válida`);

// ---------- invariantes ----------
for (const bot of BOTS) {
  const again = results[bot].slice(0, 20).map((_, i) => playGame(bot, i + 1).hash);
  check(again.every((h, i) => h === results[bot][i].hash), `${bot}: mesma semente deu resultado diferente`);
  check(results[bot].every((r) => r.houseMax <= RULES.houseMax), `${bot}: casa com mais de ${RULES.houseMax} moradores`);
  check(results[bot].every((r) => r.minRes >= 0), `${bot}: recurso negativo`);
}
{
  // Mesma semente: mesmo mapa e mesmas cartas; sementes diferentes: mapas diferentes.
  const a = new Game(42), b = new Game(42), c = new Game(43);
  check(a.map.terrain.join() === b.map.terrain.join() && a.map.finds.join() === b.map.finds.join(), 'mapa não determinístico');
  check(a.deck.join() === b.deck.join() && a.hand.join() === b.hand.join(), 'baralho não determinístico');
  check(a.goals.join() === b.goals.join(), 'metas não determinísticas');
  check(a.map.terrain.join() !== c.map.terrain.join(), 'sementes diferentes deram o mesmo mapa');
  // Estrutura do mapa em todas as sementes testadas.
  for (let seed = 1; seed <= GAMES; seed++) {
    const g = new Game(seed);
    const t = g.map.terrain;
    check(t[N >> 1] !== undefined && g.struct.some((s) => s === Struct.Lantern), `semente ${seed}: sem farol`);
    check(g.revealed.some((v) => v === 1), `semente ${seed}: nada revelado no começo`);
    const finds = [...g.map.finds].filter((f) => f).length;
    if (finds !== 6) fail(`semente ${seed}: ${finds} achados (esperado 6)`);
    check(g.foundCount === 0, `semente ${seed}: achado já revelado no começo`);
    check(g.map.landCount >= 40 && g.map.landCount <= 130, `semente ${seed}: terra com ${g.map.landCount} hexágonos`);
    check(t[g.map.tip] !== Terrain.Water, `semente ${seed}: ponta na água`);
  }
}

// ---------- relatório ----------
const out: string[] = [];
out.push(`Resultados de ${GAMES} partidas por jogador (sementes 1..${GAMES}), ${RULES.turns} turnos cada.`, '');
out.push('### Pontuação', '', '| Jogador | Média | p10 | p50 | p90 | Ilha revelada | Descartes/partida | Escolha apertada | Partidas travadas | Mãos refeitas (partidas) |', '|---|---|---|---|---|---|---|---|---|---|');
for (const bot of BOTS) {
  const s = stats[bot];
  out.push(`| ${bot} | ${f1(s.mean)} | ${s.p10} | ${s.p50} | ${s.p90} | ${f0p(s.lit)} | ${f1(s.discards)} | ${f0p(s.tight)} | ${f0p(s.stuckGames)} | ${f0p(s.fixedGames)} |`);
}
out.push('', '### Metas cumpridas (entre as partidas em que a meta foi sorteada)', '', '| Meta | ' + BOTS.join(' | ') + ' |', '|---|' + BOTS.map(() => '---').join('|') + '|');
for (let gid = 0; gid < 5; gid++) out.push(`| ${GOAL_NAMES[gid]} | ${BOTS.map((b) => f0p(stats[b].goalRate[gid])).join(' | ')} |`);
out.push('', '### Cartas escolhidas (parte das jogadas, sem contar descartes)', '', '| Carta | ' + BOTS.join(' | ') + ' |', '|---|' + BOTS.map(() => '---').join('|') + '|');
CARD_NAMES.forEach((n, c) => out.push(`| ${n} | ${BOTS.map((b) => f0p(stats[b].cardShare[c])).join(' | ')} |`));
out.push('', `Razão planejador / aleatório: ${(P.mean / A.mean).toFixed(2)}x. Planejador / guloso: ${(P.mean / Gu.mean).toFixed(2)}x.`);
const report = out.join('\n');
console.log(report);

const docPath = fileURLToPath(new URL('../docs/simulacao.md', import.meta.url));
if (existsSync(docPath) && GAMES === 300) {
  const cur = readFileSync(docPath, 'utf8');
  const a = '<!-- RELATORIO:INICIO -->', b = '<!-- RELATORIO:FIM -->';
  if (cur.includes(a) && cur.includes(b)) {
    const next = cur.slice(0, cur.indexOf(a) + a.length) + '\n' + report + '\n' + cur.slice(cur.indexOf(b));
    if (next !== cur) writeFileSync(docPath, next);
  }
}

if (failures.length) {
  console.error('\nREPROVADO:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('\nTodos os critérios passaram.');


