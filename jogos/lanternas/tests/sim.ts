// Simulação: 300 partidas por jogador simulado, relatório e critérios de aprovação.
// Também confere invariantes (determinismo, limite de moradores, recursos). Falha (exit 1) se algo reprovar.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOTS, BotId, decide, windMove } from '../src/core/bots';
import { Action, CARD_NAMES, GOAL_TITLES, Game, RULES, Struct } from '../src/core/game';
import { N } from '../src/core/hex';
import { Terrain } from '../src/core/map';
import { mulberry32 } from '../src/core/rng';
import { runVersionB } from './simB';

const GAMES = Number(process.env.GAMES ?? 300);
const GOAL_NAMES = GOAL_TITLES;
const SOPRO = 'planejador+sopro';
const VARIANTS: string[] = [...BOTS, SOPRO];
const failures: string[] = [];
const fail = (msg: string): void => { failures.push(msg); };

interface Result {
  score: number; goals: number[]; met: boolean[]; litPct: number; cards: number[]; discards: number;
  food20: number; oil20: number; foodEnd: number; oilEnd: number;
  /** Por noite (10, 20, 30): comida no começo do turno da noite, comida na festa, comida perdida, moradores da festa. */
  foodBefore: number[]; foodFeast: number[]; foodLost: number[]; foodRest: number[]; feastPlaced: number[];
  winds: number; history: Action[]; tightTurns: number; tightBase: number; stuck: number; fixed: number; hash: string; houseMax: number; minRes: number;
}

function playGame(variant: string, seed: number): Result {
  const bot = variant.split('+')[0] as BotId, useWind = variant === SOPRO;
  const g = new Game(seed);
  const rng = mulberry32(seed * 7919 + BOTS.indexOf(bot) + 1);
  const cards = [0, 0, 0, 0, 0];
  let tightTurns = 0, tightBase = 0, houseMax = 0, minRes = 99;
  const trace: number[] = [];
  let food20 = 0, oil20 = 0;
  const foodBefore: number[] = [];
  while (!g.over) {
    if (RULES.nights.includes(g.turn)) foodBefore.push(g.food);
    // O sopro não gasta o turno: o planejador decide só com o que está à vista (windMove).
    if (useWind) for (let k = 0; k < RULES.windMax; k++) { const w = windMove(g); if (w >= 0) g.apply({ kind: 'wind', idx: w }); }
    const d = decide(bot, g, rng);
    if (d.cardValues.length >= 2) {
      tightBase++;
      const [a, b] = d.cardValues;
      if (a - b < 0.25 * Math.max(Math.abs(a), 1)) tightTurns++;
    }
    if (d.action.kind === 'play') cards[g.hand[d.action.slot]]++;
    const ok = g.apply(d.action);
    if (!ok) throw new Error(`${bot} seed ${seed}: ação ilegal`);
    if (g.turn === 21) { food20 = g.food; oil20 = g.oil; }
    trace.push(d.action.kind === 'play' ? d.action.idx : -1);
    // Invariantes a cada turno.
    minRes = Math.min(minRes, g.food, g.oil);
    for (const h of g.houses) houseMax = Math.max(houseMax, g.houseResidents(h));
  }
  const s = g.summary();
  return {
    score: s.score, goals: s.goals, met: s.goalsMet, litPct: s.litPct, cards, discards: g.discards,
    food20, oil20, foodEnd: g.food, oilEnd: g.oil,
    foodBefore, foodFeast: g.feasts.map((f) => f.food), foodLost: g.feasts.map((f) => f.lost), foodRest: g.feasts.map((f) => f.rest), feastPlaced: g.feasts.map((f) => f.placed),
    winds: g.windsUsed, history: g.history, tightTurns, tightBase, stuck: g.stuckTurns, fixed: g.fixedHands, hash: trace.join(',') + '|' + s.score + '|' + g.seen.join(''), houseMax, minRes,
  };
}

const pct = (xs: number[], p: number): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const f1 = (x: number): string => x.toFixed(1);
const f0p = (x: number): string => (100 * x).toFixed(0) + '%';

const results: Record<string, Result[]> = {};
for (const bot of VARIANTS) {
  results[bot] = [];
  for (let seed = 1; seed <= GAMES; seed++) results[bot].push(playGame(bot, seed));
}

// ---------- estatísticas ----------
interface Stats {
  mean: number; p10: number; p50: number; p90: number; goalRate: number[]; lit: number; cardShare: number[];
  winds: number; discards: number; tight: number; foodBefore: number[]; foodFeast: number[]; foodLost: number[]; foodRest: number[]; feastPlaced: number[]; lostNight: number; restNight: number; food20: number; oil20: number; foodEnd: number; oilEnd: number; stuckGames: number; fixedGames: number;
}
const stats: Record<string, Stats> = {};
for (const bot of VARIANTS) {
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
    food20: mean(rs.map((r) => r.food20)), oil20: mean(rs.map((r) => r.oil20)),
    foodEnd: mean(rs.map((r) => r.foodEnd)), oilEnd: mean(rs.map((r) => r.oilEnd)),
    winds: mean(rs.map((r) => r.winds)),
    foodBefore: RULES.nights.map((_, k) => mean(rs.map((r) => r.foodBefore[k]))),
    foodFeast: RULES.nights.map((_, k) => mean(rs.map((r) => r.foodFeast[k]))),
    foodLost: RULES.nights.map((_, k) => mean(rs.map((r) => r.foodLost[k]))),
    feastPlaced: RULES.nights.map((_, k) => mean(rs.map((r) => r.feastPlaced[k]))),
    foodRest: RULES.nights.map((_, k) => mean(rs.map((r) => r.foodRest[k]))),
    lostNight: mean(rs.map((r) => mean(r.foodLost))), restNight: mean(rs.map((r) => mean(r.foodRest))),
    discards: mean(rs.map((r) => r.discards)), tight: tb ? rs.reduce((a, r) => a + r.tightTurns, 0) / tb : 0,
    stuckGames: rs.filter((r) => r.stuck > 0).length / rs.length, fixedGames: rs.filter((r) => r.fixed > 0).length / rs.length,
  };
}

// ---------- critérios de aprovação ----------
const P = stats.planejador, Gu = stats.guloso, A = stats.aleatorio, PS = stats[SOPRO];
const check = (cond: boolean, msg: string): void => { if (!cond) fail(msg); };
check(P.mean >= Gu.mean, `planejador (${f1(P.mean)}) < guloso (${f1(Gu.mean)})`);
// Os critérios do planejador valem para ele sem e com o sopro do vento.
for (const [nome, X] of [['planejador', P], [SOPRO, PS]] as Array<[string, Stats]>) {
  check(X.mean >= 1.3 * A.mean, `${nome} (${f1(X.mean)}) < 1,3x aleatório (${f1(A.mean)})`);
  check(X.tight >= 0.25 && X.tight <= 0.65, `${nome}: escolha apertada fora de 25-65%: ${f0p(X.tight)}`);
  X.cardShare.forEach((sh, c) => check(sh <= 0.45, `${nome}: carta ${CARD_NAMES[c]} com ${f0p(sh)} das escolhas (> 45%)`));
  X.goalRate.forEach((r, gid) => { if (!(r >= 0.2 && r <= 0.85)) fail(`${nome}: meta "${GOAL_NAMES[gid]}" cumprida em ${f0p(r)} (fora de 20-85%)`); });
  check(X.lit >= 0.45 && X.lit <= 0.9, `${nome}: ilha revelada ${f0p(X.lit)} (fora de 45-90%)`);
  check(X.foodEnd < 15, `${nome}: comida final média ${f1(X.foodEnd)} (esperado abaixo de 15)`);
  check(X.lostNight <= 4, `${nome}: comida perdida por noite ${f1(X.lostNight)} (esperado até 4)`);
  check(X.oilEnd < 10, `${nome}: óleo final médio ${f1(X.oilEnd)} (esperado abaixo de 10)`);
}
// Sopro do vento: o ganho do planejador (mesmas sementes) fica entre +1 e +6 pontos.
const windGain = PS.mean - P.mean;
check(windGain >= 1 && windGain <= 6, `ganho do sopro do vento: ${windGain.toFixed(2)} pontos (esperado entre +1 e +6)`);
check(PS.winds > 0, 'o planejador não usou o sopro');
for (const v of VARIANTS) check(stats[v].stuckGames === 0, `${v}: ${f0p(stats[v].stuckGames)} das partidas com turno sem jogada válida`);

// ---------- invariantes ----------
for (const bot of VARIANTS) {
  const again = results[bot].slice(0, 20).map((_, i) => playGame(bot, i + 1).hash);
  check(again.every((h, i) => h === results[bot][i].hash), `${bot}: mesma semente deu resultado diferente`);
  check(results[bot].every((r) => r.houseMax <= RULES.houseMax + RULES.feastExtra), `${bot}: casa com mais de ${RULES.houseMax + RULES.feastExtra} moradores`);
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

// ---------- sopro do vento: cenários ----------
{
  const g = new Game(7);
  const lit = [...Array(N).keys()].filter((i) => g.revealed[i]);
  const edge = [...Array(N).keys()].filter((i) => g.canBlow(i));
  check(edge.length > 0 && edge.every((i) => !g.revealed[i] && !g.seen[i]), 'sopro: alvos inválidos (têm de ser nuvem fechada)');
  check(edge.every((i) => g.map.terrain[i] !== undefined) && lit.every((i) => !g.canBlow(i)), 'sopro: alvo dentro da luz');
  const far = [...Array(N).keys()].find((i) => !g.revealed[i] && !g.canBlow(i))!;
  check(!g.blow(far) && g.wind === 1, 'sopro: aceitou nuvem longe da luz');
  const t = g.turn, hand = g.hand.join(), litBefore = g.litLand, found = g.foundCount, rev = g.revealed.join();
  const target = edge[0];
  check(g.blow(target) && g.wind === 0 && g.turn === t && g.hand.join() === hand, 'sopro: gastou o turno ou não gastou a carga');
  check(Game.windArea(target).every((c) => g.seen[c] === 1), 'sopro: não dissolveu o raio 1');
  check(g.litLand === litBefore && g.foundCount === found && g.revealed.join() === rev, 'sopro: iluminou ou contou achado');
  check(!g.blow(edge.find((i) => g.canBlow(i)) ?? target), 'sopro: soprou sem carga');
  // Terra soprada não recebe casa, campo nem cais; só a Lanterna (com óleo).
  g.oil = 20; g.food = 20;
  const seenDark = [...Array(N).keys()].find((i) => g.seen[i] && !g.revealed[i] && g.map.terrain[i] !== Terrain.Water && g.map.finds[i] === 0);
  if (seenDark !== undefined) {
    for (const c of [0, 1, 2, 4]) check(!g.canPlace(c, seenDark, false), `sopro: carta ${CARD_NAMES[c]} cabe fora da luz`);
    check(g.canPlace(3, seenDark, false), 'sopro: a Lanterna deveria caber na terra soprada');
  }
  // Recarga: a noite devolve a carga, com no máximo 1 guardado.
  const g2 = new Game(7);
  g2.blow(edge[0]);
  const r = new Game(7);
  r.wind = 1;
  while (g2.turn <= RULES.nights[0]) g2.apply({ kind: 'discard', slot: 0 });
  check(g2.wind === 1, 'sopro: não recarregou na noite');
  while (r.turn <= RULES.nights[0]) r.apply({ kind: 'discard', slot: 0 });
  check(r.wind === RULES.windMax, 'sopro: guardou mais que o máximo');
  // Replay: semente + jogadas refazem a partida, com os sopros no meio.
  const g3 = new Game(11);
  const rng = mulberry32(5);
  while (!g3.over) { const w = windMove(g3); if (w >= 0) g3.apply({ kind: 'wind', idx: w }); g3.apply(decide('planejador', g3, rng).action); }
  const again = Game.replay(11, JSON.parse(JSON.stringify(g3.history)) as Action[]);
  check(again !== null && again.score() === g3.score() && again.seen.join('') === g3.seen.join('') && again.history.length === g3.history.length, 'replay: a partida refeita difere');
  check(g3.history.some((a) => a.kind === 'wind'), 'replay: o sopro não ficou no histórico');
}

// ---------- relatório ----------
const out: string[] = [];
out.push(`Resultados de ${GAMES} partidas por jogador (sementes 1..${GAMES}), ${RULES.turns} turnos cada.`, '');
out.push('### Pontuação', '', '| Jogador | Média | p10 | p50 | p90 | Ilha revelada | Descartes/partida | Escolha apertada | Partidas travadas | Mãos refeitas (partidas) |', '|---|---|---|---|---|---|---|---|---|---|');
for (const bot of VARIANTS) {
  const s = stats[bot];
  out.push(`| ${bot} | ${f1(s.mean)} | ${s.p10} | ${s.p50} | ${s.p90} | ${f0p(s.lit)} | ${f1(s.discards)} | ${f0p(s.tight)} | ${f0p(s.stuckGames)} | ${f0p(s.fixedGames)} |`);
}
out.push('', '### Sopro do vento (planejador sem e com o sopro, mesmas 300 sementes)', '', '| Jogador | Média | p10 | p50 | p90 | Sopros/partida | Ilha revelada | Achados (meta) |', '|---|---|---|---|---|---|---|---|');
for (const v of ['planejador', SOPRO]) { const s = stats[v]; out.push(`| ${v} | ${f1(s.mean)} | ${s.p10} | ${s.p50} | ${s.p90} | ${f1(s.winds)} | ${f0p(s.lit)} | ${f0p(s.goalRate[2])} |`); }
{
  const d = results[SOPRO].map((r, i) => r.score - results.planejador[i].score);
  const sd = Math.sqrt(mean(d.map((x) => (x - mean(d)) ** 2)));
  out.push('', `Ganho do sopro: **${windGain >= 0 ? '+' : ''}${windGain.toFixed(2)} pontos** em média (±${(1.96 * sd / Math.sqrt(d.length)).toFixed(2)} no intervalo de 95%); partidas que melhoraram ${f0p(d.filter((x) => x > 0).length / d.length)}, empataram ${f0p(d.filter((x) => x === 0).length / d.length)}, pioraram ${f0p(d.filter((x) => x < 0).length / d.length)}. Critério: entre +1 e +6.`);
}
out.push('', '### Recursos parados (média por partida)', '', '| Jogador | Comida no turno 20 | Óleo no turno 20 | Comida no fim | Óleo no fim |', '|---|---|---|---|---|');
for (const bot of VARIANTS) { const s = stats[bot]; out.push(`| ${bot} | ${f1(s.food20)} | ${f1(s.oil20)} | ${f1(s.foodEnd)} | ${f1(s.oilEnd)} |`); }
out.push('', '### A festa da noite: comida guardada e comida perdida (média por noite 10 / 20 / 30)', '', '| Jogador | Comida no começo do turno da noite (após os turnos 9, 19, 29) | Comida na festa (depois da renda) | Moradores da festa | Comida perdida | Resto da divisão | Perda média por noite (sem o resto) |', '|---|---|---|---|---|---|---|');
for (const bot of VARIANTS) {
  const s = stats[bot], j = (xs: number[]): string => xs.map(f1).join(' / ');
  out.push(`| ${bot} | ${j(s.foodBefore)} | ${j(s.foodFeast)} | ${j(s.feastPlaced)} | ${j(s.foodLost)} | ${j(s.foodRest)} | ${f1(s.lostNight)} |`);
}
out.push('', 'Perda = comida que passa do teto de moradores da noite ou não acha casa iluminada com vaga. O resto da divisão (menos de uma festa de comida) vai em coluna à parte e não entra na perda.');
out.push('', '### Metas cumpridas (entre as partidas em que a meta foi sorteada)', '', '| Meta | ' + VARIANTS.join(' | ') + ' |', '|---|' + VARIANTS.map(() => '---').join('|') + '|');
for (let gid = 0; gid < 5; gid++) out.push(`| ${GOAL_NAMES[gid]} | ${VARIANTS.map((b) => f0p(stats[b].goalRate[gid])).join(' | ')} |`);
out.push('', '### Cartas escolhidas (parte das jogadas, sem contar descartes)', '', '| Carta | ' + VARIANTS.join(' | ') + ' |', '|---|' + VARIANTS.map(() => '---').join('|') + '|');
CARD_NAMES.forEach((n, c) => out.push(`| ${n} | ${VARIANTS.map((b) => f0p(stats[b].cardShare[c])).join(' | ')} |`));
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

// ---------- versão B (tests/simB.ts) e comparação A × B ----------
const asB = (x: Stats) => ({ mean: x.mean, p10: x.p10, p90: x.p90, tight: x.tight, cardShare: x.cardShare });
const resB = runVersionB(GAMES, { aleatorio: asB(A), guloso: asB(Gu), planejador: asB(P) });
console.log('\n## Versão B\n\n' + resB.report);
for (const m of resB.failures) fail(m);
if (existsSync(docPath) && GAMES === 300) {
  const cur = readFileSync(docPath, 'utf8');
  const a = '<!-- VERSAO_B:INICIO -->', b = '<!-- VERSAO_B:FIM -->';
  if (cur.includes(a) && cur.includes(b)) {
    const next = cur.slice(0, cur.indexOf(a) + a.length) + '\n' + resB.report + '\n' + cur.slice(cur.indexOf(b));
    if (next !== cur) writeFileSync(docPath, next);
  }
}

if (failures.length) {
  console.error('\nREPROVADO:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('\nTodos os critérios passaram.');


