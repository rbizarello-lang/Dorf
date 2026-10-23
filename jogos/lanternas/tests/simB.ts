// Simulação da versão B e comparação A × B (arrependimento por turno, turno de decisão, uso de peças).
// Chamado por tests/sim.ts. Os critérios de simulador da B ficam em CRITERIOS.md e viram asserções aqui.
import { BOTS, BotId, decide, phiWith } from '../src/core/bots';
import { Action, CARD_NAMES, Game } from '../src/core/game';
import { BOTS_B, BotIdB, decideB, phiWith as phiWithB } from '../src/core/botsB';
import { ActionB, CARD_NAMES_B, CardB, GOAL_TITLES_B, GameB, RULES_B, RULES_TEXT_B, StructB } from '../src/core/gameB';
import { N, NB } from '../src/core/hex';
import { Terrain } from '../src/core/map';
import { Rng, mulberry32 } from '../src/core/rng';

const pct = (xs: number[], p: number): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const f1 = (x: number): string => x.toFixed(1);
const f2 = (x: number): string => x.toFixed(2);
const f0p = (x: number): string => (100 * x).toFixed(0) + '%';

// ---------- partidas da B ----------
interface ResultB {
  score: number; goals: number[]; met: boolean[]; litPct: number; cards: number[];
  tightTurns: number; tightBase: number; ended: boolean; redeals: number; hash: string; history: ActionB[];
  houses: number; residents: number; manors: number; biggest: number; finds: number;
}

function playGameB(bot: BotIdB, seed: number): ResultB {
  const g = new GameB(seed);
  const rng = mulberry32(seed * 7919 + BOTS_B.indexOf(bot) + 1);
  const cards = [0, 0, 0, 0, 0];
  let tightTurns = 0, tightBase = 0;
  const trace: number[] = [];
  while (!g.over) {
    const d = decideB(bot, g, rng);
    if (d.cardValues.length >= 2) {
      tightBase++;
      const [a, b] = d.cardValues;
      if (a - b < 0.25 * Math.max(Math.abs(a), 1)) tightTurns++;
    }
    cards[g.hand[d.action.slot]]++;
    if (!g.apply(d.action)) throw new Error(`B ${bot} semente ${seed}: ação ilegal`);
    trace.push(d.action.idx);
  }
  const s = g.summary();
  return {
    score: s.score, goals: s.goals, met: s.goalsMet, litPct: s.litPct, cards, tightTurns, tightBase,
    ended: g.ended, redeals: g.redeals, hash: trace.join(',') + '|' + s.score + '|' + g.lit.join(''), history: g.history,
    houses: g.houses.length, residents: s.residents, manors: g.manors(), biggest: g.biggestVillage(), finds: g.foundCount,
  };
}

// ---------- adaptadores para medir as duas versões do mesmo jeito ----------
interface Engine<G, A> {
  label: string;
  bots: string[];
  create(seed: number): G;
  clone(g: G): G;
  over(g: G): boolean;
  decide(bot: string, g: G, rng: Rng): A;
  apply(g: G, a: A): boolean;
  actions(g: G): A[];
  /** Jogadas do 2º passo: o estado depois de cada jogada possível, sem fechar o turno (como o bot avalia). */
  quick(g: G): G[];
  /** Valor da posição na régua do planejador da versão; `before` é o que estava à vista no começo da decisão. */
  phi(g: G, before: Uint8Array): number;
  seen(g: G): Uint8Array;
  score(g: G): number;
}

const engineA: Engine<Game, Action> = {
  label: 'A', bots: BOTS,
  create: (s) => new Game(s), clone: (g) => g.clone(), over: (g) => g.over,
  decide: (bot, g, rng) => decide(bot as BotId, g, rng).action,
  apply: (g, a) => g.apply(a), actions: (g) => g.legalActions(),
  quick: (g) => {
    const out: Game[] = [];
    g.hand.forEach((card) => { for (const i of g.placements(card)) { const c = g.clone(); c.place(card, i); out.push(c); } });
    const d = g.clone(); d.oil += 1; out.push(d);
    return out;
  },
  phi: (g, before) => phiWith('planejador', g, before), seen: (g) => g.seen, score: (g) => g.score(),
};

const engineB: Engine<GameB, ActionB> = {
  label: 'B', bots: BOTS_B,
  create: (s) => new GameB(s), clone: (g) => g.clone(), over: (g) => g.over,
  decide: (bot, g, rng) => decideB(bot as BotIdB, g, rng).action,
  apply: (g, a) => g.apply(a), actions: (g) => g.legalActions(),
  quick: (g) => {
    const out: GameB[] = [];
    g.hand.forEach((card) => { for (const i of g.placements(card)) { const c = g.clone(); c.place(card, i); out.push(c); } });
    return out;
  },
  phi: (g, before) => phiWithB('planejador', g, before), seen: (g) => g.lit, score: (g) => g.score(),
};

/**
 * Arrependimento por turno: em cada turno, o valor da jogada escolhida contra o da melhor jogada, os dois olhando um turno à frente
 * (a jogada, a mão seguinte já conhecida e a melhor resposta), na régua do planejador da versão, com o jogo inteiro à vista.
 * Em pontos de potencial (cerca de 1 ponto de pontuação cada).
 */
function regretRun<G, A>(e: Engine<G, A>, bot: string, seeds: number[]): { mean: number; perSeed: number[] } {
  const perSeed: number[] = [];
  for (const seed of seeds) {
    const g = e.create(seed);
    const rng = mulberry32(seed * 7919 + e.bots.indexOf(bot) + 1);
    let sum = 0, turns = 0;
    while (!e.over(g)) {
      const chosen = e.decide(bot, g, rng);
      const before = e.seen(g).slice();
      const value = (a: A): number => {
        const g1 = e.clone(g);
        e.apply(g1, a);
        if (e.over(g1)) return e.phi(g1, before);
        let best = -Infinity;
        for (const q of e.quick(g1)) best = Math.max(best, e.phi(q, before));
        return best;
      };
      const vc = value(chosen);
      let best = vc;
      for (const a of e.actions(g)) best = Math.max(best, value(a));
      sum += best - vc; turns++;
      e.apply(g, chosen);
    }
    perSeed.push(sum / Math.max(1, turns));
  }
  return { mean: mean(perSeed), perSeed };
}

/**
 * Turno de decisão: do estado no começo de cada turno t, completa a partida com o planejador e com o aleatório (mesmos turnos até t).
 * A diferença média dos finais, `gap(t)`, é quanto as jogadas que faltam ainda mudam o resultado. O turno de decisão é o primeiro
 * em que ela cai a 10% da diferença do turno 1 (ou 25%, para a segunda leitura).
 */
function decisionRun<G, A>(e: Engine<G, A>, seeds: number[], randomRuns: number): { gap: number[]; t10: number; t25: number } {
  const turns = 30;
  const sums = new Array<number>(turns).fill(0);
  for (const seed of seeds) {
    const g = e.create(seed);
    const rng = mulberry32(seed * 104729 + 3);
    const snaps: G[] = [];
    while (!e.over(g)) {
      snaps.push(e.clone(g));
      e.apply(g, e.decide('planejador', g, rng));
    }
    const final = e.score(g);
    snaps.forEach((s0, t) => {
      let rnd = 0;
      for (let k = 0; k < randomRuns; k++) {
        const c = e.clone(s0);
        const r = mulberry32(seed * 31 + t * 7 + k + 1);
        while (!e.over(c)) e.apply(c, e.decide('aleatorio', c, r));
        rnd += e.score(c);
      }
      sums[t] += final - rnd / randomRuns;
    });
  }
  const gap = sums.map((x) => x / seeds.length);
  const first = (frac: number): number => { const k = gap.findIndex((x) => x <= frac * gap[0]); return k < 0 ? turns + 1 : k + 1; };
  return { gap, t10: first(0.1), t25: first(0.25) };
}

// ---------- execução ----------
export interface AStats {
  /** Estatísticas por bot da versão A (as de tests/sim.ts). */
  [bot: string]: { mean: number; p10: number; p90: number; tight: number; cardShare: number[] };
}

export interface BOutput { report: string; failures: string[] }

export function runVersionB(games: number, a: AStats): BOutput {
  const failures: string[] = [];
  const check = (cond: boolean, msg: string): void => { if (!cond) failures.push(msg); };
  const seedsAll = Array.from({ length: games }, (_, i) => i + 1);

  const results: Record<string, ResultB[]> = {};
  for (const bot of BOTS_B) results[bot] = seedsAll.map((s) => playGameB(bot, s));

  interface SB { mean: number; p10: number; p50: number; p90: number; lit: number; tight: number; cardShare: number[]; goalRate: number[]; stuck: number; redeal: number; houses: number; residents: number; manors: number; biggest: number; finds: number }
  const st: Record<string, SB> = {};
  for (const bot of BOTS_B) {
    const rs = results[bot], sc = rs.map((r) => r.score);
    const tb = rs.reduce((x, r) => x + r.tightBase, 0);
    const total = [0, 1, 2, 3, 4].map((c) => rs.reduce((x, r) => x + r.cards[c], 0));
    const sum = total.reduce((x, y) => x + y, 0);
    st[bot] = {
      mean: mean(sc), p10: pct(sc, 0.1), p50: pct(sc, 0.5), p90: pct(sc, 0.9), lit: mean(rs.map((r) => r.litPct)),
      tight: tb ? rs.reduce((x, r) => x + r.tightTurns, 0) / tb : 0, cardShare: total.map((c) => c / Math.max(1, sum)),
      goalRate: [0, 1, 2, 3].map((gid) => {
        const w = rs.filter((r) => r.goals.includes(gid));
        return w.length ? w.filter((r) => r.met[r.goals.indexOf(gid)]).length / w.length : NaN;
      }),
      stuck: rs.filter((r) => r.ended).length / rs.length, redeal: mean(rs.map((r) => r.redeals)),
      houses: mean(rs.map((r) => r.houses)), residents: mean(rs.map((r) => r.residents)), manors: mean(rs.map((r) => r.manors)),
      biggest: mean(rs.map((r) => r.biggest)), finds: mean(rs.map((r) => r.finds)),
    };
  }
  const P = st.planejador, R = st.aleatorio;

  // ---------- critérios de simulador da B (CRITERIOS.md) ----------
  check(P.mean >= 1.2 * R.mean, `B: planejador (${f1(P.mean)}) < 1,2x aleatório (${f1(R.mean)})`);
  check(P.tight >= 0.25 && P.tight <= 0.65, `B: escolha apertada do planejador fora de 25-65%: ${f0p(P.tight)}`);
  for (const bot of BOTS_B) check(st[bot].stuck === 0, `B ${bot}: ${f0p(st[bot].stuck)} das partidas travadas (a ilha ficou sem lugar para as peças)`);
  P.cardShare.forEach((sh, c) => check(sh <= 0.45, `B: carta ${CARD_NAMES_B[c]} com ${f0p(sh)} das escolhas do planejador (> 45%)`));

  // ---------- invariantes e cenários da B ----------
  for (const bot of BOTS_B) {
    const again = results[bot].slice(0, 20).map((_, i) => playGameB(bot, i + 1).hash);
    const ok = again.every((h, i) => h === results[bot][i].hash);
    check(ok, `B ${bot}: mesma semente deu resultado diferente`);
    check(results[bot].every((r) => r.history.length === (r.ended ? r.history.length : RULES_B.turns)), `B ${bot}: partida sem 30 jogadas`);
  }
  check(RULES_TEXT_B.length === 6, `B: ${RULES_TEXT_B.length} regras escritas (esperado 6)`);
  {
    const a = new GameB(42), b = new GameB(42), c = new GameB(43);
    check(a.map.terrain.join() === b.map.terrain.join() && a.deck.join() === b.deck.join() && a.hand.join() === b.hand.join() && a.goals.join() === b.goals.join(), 'B: semente não determinística');
    check(a.map.terrain.join() !== c.map.terrain.join(), 'B: sementes diferentes deram o mesmo mapa');
    check(!a.map.terrain.includes(Terrain.Rock), 'B: sobrou Rocha');
    check(a.hand.length === RULES_B.handSize, 'B: mão sem 3 peças');
    check(RULES_B.deck.reduce((x, y) => x + y, 0) >= RULES_B.turns + 2 * RULES_B.handSize - 1, 'B: baralho curto demais para 30 turnos de mão cheia');
    for (const seed of seedsAll) {
      const g = new GameB(seed);
      check(g.struct.some((s) => s === StructB.Lantern) && g.lit.some((v) => v === 1), `B semente ${seed}: sem farol aceso`);
      check(g.hand.some((card) => g.playable(card)), `B semente ${seed}: mão inicial sem jogada`);
    }
  }
  {
    // Cenário: nível da casa = 1 + tipos diferentes encostados (até 4); recalculado ao pôr algo ao lado.
    const g = new GameB(7);
    g.lit.fill(1);
    const spot = [...Array(N).keys()].find((i) => g.map.terrain[i] === Terrain.Meadow && g.struct[i] === 0 && NB[i].length === 6 && NB[i].every((n) => g.map.terrain[n] !== Terrain.Water && g.map.terrain[n] !== Terrain.Wood && g.map.finds[n] === 0 && g.struct[n] === 0) && !NB[i].some((n) => NB[n].some((m) => g.map.finds[m])));
    check(spot !== undefined, 'B cenário: sem lugar de teste');
    if (spot !== undefined) {
      g.place(CardB.House, spot);
      const nb = NB[spot];
      const lv = (): number => g.levelAt(spot);
      check(lv() === 1, `B cenário: casa sozinha deveria ser nível 1 (é ${lv()})`);
      g.place(CardB.Field, nb[0]); check(lv() === 2, 'B cenário: Campo deveria subir a casa a 2');
      g.place(CardB.Field, nb[1]); check(lv() === 2, 'B cenário: o segundo Campo não conta de novo');
      g.place(CardB.Grove, nb[2]); check(lv() === 3, 'B cenário: Bosque deveria subir a casa a 3');
      g.place(CardB.Lantern, nb[3]); check(lv() === 4, 'B cenário: Lanterna deveria subir a casa a 4');
      g.place(CardB.Dock, nb[4]); check(lv() === 4, 'B cenário: o nível passou de 4');
      check(g.residents() === 4 && g.manors() === 1, 'B cenário: moradores deveriam ser o nível da casa');
      // Vila: 3 casas encostadas dão poço (+3).
      const g2 = new GameB(7); g2.lit.fill(1);
      const base = g2.residents();
      const free = [spot, nb[0], nb[1]];
      g2.place(CardB.House, free[0]); g2.place(CardB.House, free[1]);
      check(g2.landmarkCount() === 0, 'B cenário: 2 casas não fazem vila');
      g2.place(CardB.House, free[2]);
      check(g2.landmarkCount() === 1 && g2.biggestVillage() === 3, 'B cenário: 3 casas deveriam dar o poço');
      check(g2.residents() >= base + 3 + 3, 'B cenário: o poço não somou 3 moradores');
    }
    // Cais só em Praia iluminada; Casa só com luz; Lanterna também encostada na luz.
    const h = new GameB(11);
    const beachLit = [...Array(N).keys()].find((i) => h.lit[i] && h.map.terrain[i] === Terrain.Beach && h.struct[i] === 0 && !h.map.finds[i]);
    const dark = [...Array(N).keys()].find((i) => !h.lit[i] && h.map.terrain[i] !== Terrain.Water && NB[i].some((n) => h.lit[n]) && !h.map.finds[i]);
    check(dark !== undefined && h.canPlace(CardB.Lantern, dark) && !h.canPlace(CardB.House, dark), 'B cenário: a Lanterna deveria caber encostada na luz e a Casa não');
    check(beachLit === undefined || h.canPlace(CardB.Dock, beachLit), 'B cenário: Cais deveria caber em Praia iluminada');
  }
  {
    // Replay: semente + jogadas refazem a partida.
    const g = new GameB(11);
    const rng = mulberry32(5);
    while (!g.over) g.apply(decideB('planejador', g, rng).action);
    const again = GameB.replay(11, JSON.parse(JSON.stringify(g.history)) as ActionB[]);
    check(again !== null && again.score() === g.score() && again.lit.join('') === g.lit.join('') && again.history.length === g.history.length, 'B replay: a partida refeita difere');
    check(GameB.replay(11, [{ slot: 0, idx: 0 }]) === null, 'B replay: aceitou uma jogada ilegal');
  }

  // ---------- arrependimento e turno de decisão (as duas versões) ----------
  const regretSeeds = seedsAll.slice(0, Number(process.env.REGRET_GAMES ?? 16));
  const decisionSeeds = seedsAll.slice(0, Number(process.env.DECISION_GAMES ?? 40));
  const regA: Record<string, number> = {}, regB: Record<string, number> = {};
  for (const bot of BOTS) regA[bot] = regretRun(engineA, bot, regretSeeds).mean;
  for (const bot of BOTS_B) regB[bot] = regretRun(engineB, bot, regretSeeds).mean;
  const decA = decisionRun(engineA, decisionSeeds, 2);
  const decB = decisionRun(engineB, decisionSeeds, 2);

  // ---------- relatório ----------
  const out: string[] = [];
  out.push(`Resultados de ${games} partidas por jogador (sementes 1..${games}), ${RULES_B.turns} peças cada.`, '');
  out.push('### Pontuação da B', '', '| Jogador | Média | p10 | p50 | p90 | Ilha iluminada | Escolha apertada | Partidas travadas | Mãos refeitas por partida |', '|---|---|---|---|---|---|---|---|---|');
  for (const bot of BOTS_B) { const s = st[bot]; out.push(`| ${bot} | ${f1(s.mean)} | ${s.p10} | ${s.p50} | ${s.p90} | ${f0p(s.lit)} | ${f0p(s.tight)} | ${f0p(s.stuck)} | ${f2(s.redeal)} |`); }
  out.push('', `Razão planejador / aleatório: ${f2(P.mean / R.mean)}x. Planejador / guloso: ${f2(P.mean / st.guloso.mean)}x.`);
  out.push('', '### De onde vêm os pontos na B (média por partida)', '', '| Jogador | Casas | Moradores | Solares | Maior vila | Achados revelados |', '|---|---|---|---|---|---|');
  for (const bot of BOTS_B) { const s = st[bot]; out.push(`| ${bot} | ${f1(s.houses)} | ${f1(s.residents)} | ${f1(s.manors)} | ${f1(s.biggest)} | ${f1(s.finds)} |`); }
  out.push('', '### Metas da B cumpridas (entre as partidas em que a meta foi sorteada)', '', '| Meta | ' + BOTS_B.join(' | ') + ' |', '|---|' + BOTS_B.map(() => '---').join('|') + '|');
  GOAL_TITLES_B.forEach((t, gid) => out.push(`| ${t} | ${BOTS_B.map((b) => f0p(st[b].goalRate[gid])).join(' | ')} |`));
  out.push('', '### Peças escolhidas na B (parte das jogadas)', '', '| Peça | ' + BOTS_B.join(' | ') + ' |', '|---|' + BOTS_B.map(() => '---').join('|') + '|');
  CARD_NAMES_B.forEach((n, c) => out.push(`| ${n} | ${BOTS_B.map((b) => f0p(st[b].cardShare[c])).join(' | ')} |`));

  out.push('', '### A × B', '', `Mesmas ${games} sementes. A tem o planejador sem o sopro do vento (a coluna "A+sopro" da seção acima fica de fora aqui). Arrependimento: ${regretSeeds.length} sementes por jogador; turno de decisão: ${decisionSeeds.length} sementes.`, '');
  out.push('| Versão | Jogador | Média | p10 | p90 | Razão contra o aleatório | Escolha apertada | Arrependimento médio por turno |', '|---|---|---|---|---|---|---|---|');
  for (const bot of BOTS) { const s = a[bot]; out.push(`| A | ${bot} | ${f1(s.mean)} | ${s.p10} | ${s.p90} | ${f2(s.mean / a.aleatorio.mean)}x | ${f0p(s.tight)} | ${f2(regA[bot])} |`); }
  for (const bot of BOTS_B) { const s = st[bot]; out.push(`| B | ${bot} | ${f1(s.mean)} | ${s.p10} | ${s.p90} | ${f2(s.mean / R.mean)}x | ${f0p(s.tight)} | ${f2(regB[bot])} |`); }
  out.push('', 'Arrependimento = em cada turno, quanto a jogada escolhida valia menos que a melhor jogada de um turno à frente (a jogada, a mão seguinte e a melhor resposta), na régua do planejador de cada versão, com a névoa à vista. Unidade: pontos de potencial (cerca de 1 ponto de pontuação). O aleatório mostra o piso; um jogador que escolhe bem fica perto de 0.');
  out.push('', '#### Turno de decisão', '', 'Do começo de cada turno, completa a partida com o planejador e com o aleatório. A diferença média dos finais é quanto as jogadas que faltam ainda mudam o resultado. Turno de decisão = primeiro turno em que ela cai a 10% (ou 25%) da diferença do turno 1.', '');
  const marks = [1, 5, 10, 15, 20, 25, 28, 30];
  out.push('| Versão | ' + marks.map((t) => `turno ${t}`).join(' | ') + ' | Decisão (10%) | Decisão (25%) |', '|---|' + marks.map(() => '---').join('|') + '|---|---|');
  for (const [lab, d] of [['A', decA], ['B', decB]] as Array<[string, typeof decA]>) out.push(`| ${lab} | ${marks.map((t) => f1(d.gap[t - 1])).join(' | ')} | ${d.t10 > 30 ? 'nunca' : 'turno ' + d.t10} | ${d.t25 > 30 ? 'nunca' : 'turno ' + d.t25} |`);
  out.push('', '#### Uso de peças do planejador', '');
  out.push('| Versão | ' + ['Casa', 'Campo', 'Oliveiral / Bosque', 'Lanterna', 'Cais'].join(' | ') + ' |', '|---|---|---|---|---|---|');
  out.push(`| A | ${[0, 1, 2, 3, 4].map((c) => `${CARD_NAMES[c]} ${f0p(a.planejador.cardShare[c])}`).join(' | ')} |`);
  out.push(`| B | ${[0, 1, 2, 3, 4].map((c) => `${CARD_NAMES_B[c]} ${f0p(P.cardShare[c])}`).join(' | ')} |`);

  return { report: out.join('\n'), failures };
}
