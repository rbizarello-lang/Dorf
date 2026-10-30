// Verificações da bancada (`npm run bench -- --verifica` e `--paridade`). Sem elas, a bancada mediria o motor e não a regra.
//   1. motor leve × núcleo: o Clássico base e o Relevo base, escritos nos dois (o `Game` e o `LiteWorld`), jogam a MESMA partida e, a cada
//      peça, listam as mesmas jogadas válidas com os mesmos pontos, e jogando uma delas dão os mesmos pontos reais e a mesma pilha;
//   2. coerência de cada regra: o `pts` de `moves()` é o que `play()` paga, `after()` não mexe no mundo, a partida é determinística;
//   3. paridade com o `tests/balance.ts`: a IA do jogo (`Game.bestMove`) no Clássico, pelo mundo da bancada, dá partida por partida o
//      mesmo placar que o laço do balance, e o resumo bate com o `.cache/balance.json` (se rodou `npm run balance -- <mesmo N>`).
import { existsSync, readFileSync } from 'node:fs';
import { Game } from '../../src/core/game';
import { mulberry32 } from '../../src/core/rng';
import { ranked } from './players';
import { ALL, BY_ID } from './rules/index';
import { gameRules } from './rules/core';
import { mixComp } from './rules/aquarela';
import { LAND, T, generateTile, isStrict } from '../../src/core/tiles';
import type { Move, Rule, World } from './types';

const key = (m: Move) => `${m.q},${m.r},${m.rot}`;
const out: string[] = [];
const say = (s: string) => {
  out.push(s);
  console.log(s);
};

/** Joga a mesma partida em dois mundos e compara as jogadas a cada peça. Devolve o número de divergências. */
function twin(label: string, a: World, b: World, seed: number, stats: { turns: number; moves: number; bad: number }): void {
  const rng = mulberry32(seed ^ 0xabc);
  let guard = 0;
  while (!a.over() && !b.over() && guard++ < 2000) {
    const ma = a.moves(), mb = b.moves();
    stats.turns++;
    stats.moves += ma.length;
    const mapB = new Map(mb.map((m) => [key(m), m.pts]));
    let bad = ma.length !== mb.length ? 1 : 0;
    for (const m of ma) if (mapB.get(key(m)) !== m.pts) bad++;
    if (bad) {
      stats.bad++;
      if (stats.bad <= 5) {
        const diff = ma.filter((m) => mapB.get(key(m)) !== m.pts).slice(0, 3).map((m) => `${key(m)}: ${m.pts} × ${mapB.get(key(m))}`);
        say(`  DIVERGE ${label} semente ${seed}, peça ${a.placed}: ${ma.length} × ${mb.length} jogadas; ${diff.join('; ')}`);
      }
      return;
    }
    if (!ma.length) {
      a.discard();
      b.discard();
      continue;
    }
    const m = ranked(ma, rng)[0];
    const pa = a.play(m), pb = b.play(m);
    if (pa !== pb || a.score !== b.score || a.stack !== b.stack) {
      stats.bad++;
      say(`  DIVERGE ${label} semente ${seed}, peça ${a.placed}: pontos ${pa} × ${pb}, placar ${a.score} × ${b.score}, pilha ${a.stack} × ${b.stack}`);
      return;
    }
  }
}

function checkTwins(n: number): boolean {
  let ok = true;
  for (const [coreId, liteId] of [['base', 'base-lite'], ['relevo-base', 'relevo-lite']] as const) {
    const stats = { turns: 0, moves: 0, bad: 0 };
    for (let seed = 1; seed <= n; seed++) twin(`${coreId}×${liteId}`, BY_ID.get(coreId)!.create(seed), BY_ID.get(liteId)!.create(seed), seed, stats);
    say(`${stats.bad ? 'FALHOU' : 'ok'}  ${coreId} (núcleo) × ${liteId} (motor leve): ${n} partidas, ${stats.turns} peças, ${stats.moves} jogadas comparadas, ${stats.bad} divergências`);
    if (stats.bad) ok = false;
  }
  return ok;
}

/** Cada regra: `pts` de `moves()` = o que `play()` paga (só as leves), `after()` não mexe, determinismo, placar que só cresce. */
function checkRule(rule: Rule, n: number): boolean {
  let bad = 0;
  const complain = (s: string) => {
    if (bad++ < 3) say(`  FALHOU ${rule.id}: ${s}`);
  };
  const light = !['classico', 'relevo', 'base', 'relevo-base'].includes(rule.id);
  const finals: number[] = [];
  for (let pass = 0; pass < 2; pass++) {
    for (let seed = 1; seed <= n; seed++) {
      const w = rule.create(seed);
      const rng = mulberry32(seed ^ 0x77);
      let last = 0, guard = 0;
      while (!w.over() && guard++ < 2000) {
        const ms = w.moves();
        if (!ms.length) {
          w.discard();
          continue;
        }
        const m = ranked(ms, rng)[0];
        if (pass === 0 && guard % 7 === 0) {
          const before = JSON.stringify(ms.map((x) => [x.q, x.r, x.rot, x.pts]));
          w.after(m);
          if (JSON.stringify(w.moves().map((x) => [x.q, x.r, x.rot, x.pts])) !== before) complain(`after() mexeu no mundo (semente ${seed})`);
        }
        const pts = w.play(m);
        if (light && pts !== m.pts) complain(`play pagou ${pts}, moves() dizia ${m.pts} (semente ${seed})`);
        if (!(pts >= 0)) complain(`pontos negativos ${pts} (semente ${seed})`);
        if (w.score < last) complain(`placar caiu (semente ${seed})`);
        last = w.score;
      }
      if (pass === 0) finals.push(w.score);
      else if (finals[seed - 1] !== w.score) complain(`partida não determinística (semente ${seed}: ${finals[seed - 1]} × ${w.score})`);
    }
  }
  say(`${bad ? 'FALHOU' : 'ok'}  ${rule.id}: ${n} partidas duas vezes, coerência de pontos, after() e determinismo`);
  return bad === 0;
}

/** Quanto o jogo paga a mais do que `moves()` enxerga nas regras cheias (missões, eras, cartas...): informativo. */
function cheapGap(rule: Rule, n: number) {
  let sum = 0, cnt = 0, real = 0;
  for (let seed = 1; seed <= n; seed++) {
    const w = rule.create(seed);
    const rng = mulberry32(seed);
    let guard = 0;
    while (!w.over() && guard++ < 2000) {
      const ms = w.moves();
      if (!ms.length) {
        w.discard();
        continue;
      }
      const m = ranked(ms, rng)[0];
      const p = w.play(m);
      sum += p - m.pts;
      real += p;
      cnt++;
    }
  }
  say(`info ${rule.id}: o jogo paga em média ${(sum / cnt).toFixed(2)} a mais por peça do que a bancada enxerga (${((100 * sum) / real).toFixed(1)}% dos pontos: missões, eras, cartas, rotas)`);
}

/** Aquarela: parcela de bordas de terra misturadas nas peças sorteadas (a proposta pede até 30%). */
function aquarelaShare() {
  let mixed = 0, land = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const rng = mulberry32(seed);
    const def = generateTile(rng, true);
    const comp = mixComp(def.edges, def.seed);
    def.edges.forEach((t, i) => {
      if (isStrict(t) || !LAND.includes(t as T)) return;
      land++;
      if (comp[i][t] < 0.999) mixed++;
    });
  }
  say(`info aquarela: ${((100 * mixed) / land).toFixed(1)}% das bordas de terra saem misturadas (400 peças)`);
}

export function verifyAll(n = 40): boolean {
  say(`# Verificação da bancada (${n} partidas por conferência)`);
  let ok = checkTwins(n);
  for (const r of [...ALL, BY_ID.get('base-lite')!, BY_ID.get('relevo-lite')!]) ok = checkRule(r, Math.min(n, r.id === 'classico' || r.id === 'relevo' ? 12 : n)) && ok;
  cheapGap(BY_ID.get('classico')!, 12);
  cheapGap(BY_ID.get('relevo')!, 12);
  aquarelaShare();
  say(ok ? 'TUDO OK' : 'HÁ FALHAS');
  return ok;
}

/** O laço do `tests/balance.ts` (função `play`), copiado: a IA gulosa do jogo no Clássico com o desempate de semente fixa. */
function balanceLoop(seed: number) {
  const game = new Game(seed, gameRules('classico', seed), []);
  const rand = mulberry32((seed ^ 0x5eed) >>> 0);
  let guard = 0;
  while (game.current && guard++ < 800) {
    const m = game.bestMove(rand);
    if (!m) {
      if (!game.discardIfStuck()) break;
      continue;
    }
    game.rot = m.rot;
    if (!game.place(m.q, m.r)) break;
    while (game.offers.length) game.choose(0);
    while (game.discardIfStuck());
  }
  return { score: game.board.score, tiles: game.placedCount, discards: game.discarded };
}

export function parity(n: number): boolean {
  say(`# Paridade com o tests/balance.ts (Clássico, IA do jogo, ${n} partidas, sementes 1 a ${n})`);
  const classico = BY_ID.get('classico')!;
  const mine: { score: number; tiles: number; discards: number }[] = [];
  let ok = true;
  for (let seed = 1; seed <= n; seed++) {
    const w = classico.create(seed);
    const rand = mulberry32((seed ^ 0x5eed) >>> 0);
    let guard = 0;
    while (!w.over() && guard++ < 800) {
      const m = w.native!(rand);
      if (!m) {
        w.discard();
        continue;
      }
      w.play(m);
      while (!w.over() && !w.moves().length) w.discard();
    }
    mine.push({ score: w.score, tiles: w.placed, discards: w.discards });
    const ref = balanceLoop(seed);
    if (ref.score !== w.score || ref.tiles !== w.placed || ref.discards !== w.discards) {
      ok = false;
      say(`  DIVERGE semente ${seed}: bancada ${w.score}/${w.placed}/${w.discards} × laço do balance ${ref.score}/${ref.tiles}/${ref.discards} (placar/peças/descartes)`);
    }
  }
  say(`${ok ? 'ok' : 'FALHOU'}  partida por partida: o mundo da bancada com a IA do jogo dá o placar, as peças e os descartes do laço do balance`);
  const sorted = mine.map((m) => m.score).sort((a, b) => a - b);
  const pct = (p: number) => {
    const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  };
  const avg = sorted.reduce((a, b) => a + b, 0) / n;
  const tiles = mine.map((m) => m.tiles).sort((a, b) => a - b);
  const mid = (tiles.length - 1) * 0.5;
  const tilesP50 = tiles[Math.floor(mid)] + (tiles[Math.ceil(mid)] - tiles[Math.floor(mid)]) * (mid - Math.floor(mid));
  say(`bancada: média ${avg.toFixed(0)}, p10 ${pct(0.1).toFixed(0)}, p50 ${pct(0.5).toFixed(0)}, p90 ${pct(0.9).toFixed(0)}, peças p50 ${tilesP50.toFixed(0)}, travadas ${((100 * mine.filter((m) => m.discards > 0).length) / n).toFixed(1)}%`);
  const file = '.cache/balance.json';
  if (existsSync(file)) {
    const j = JSON.parse(readFileSync(file, 'utf8')) as { games: number; modes: { label: string; player: string; score: { mean: number; p10: number; p50: number; p90: number }; tilesP50: number; discardPct: number }[] };
    const row = j.modes.find((r) => r.label === 'Clássico' && r.player === 'guloso');
    if (row && j.games === n) {
      const same = Math.abs(row.score.mean - avg) < 1e-6 && Math.abs(row.score.p10 - pct(0.1)) < 1e-6 && Math.abs(row.score.p50 - pct(0.5)) < 1e-6 && Math.abs(row.score.p90 - pct(0.9)) < 1e-6 && Math.abs(row.tilesP50 - tilesP50) < 1e-6;
      say(`${same ? 'ok' : 'FALHOU'}  .cache/balance.json (${j.games} partidas): média ${row.score.mean.toFixed(0)}, p10 ${row.score.p10.toFixed(0)}, p50 ${row.score.p50.toFixed(0)}, p90 ${row.score.p90.toFixed(0)}, peças p50 ${row.tilesP50}, travadas ${row.discardPct.toFixed(1)}%`);
      if (!same) ok = false;
    } else say(`(o .cache/balance.json é de ${j.games} partidas: rode \`npm run balance -- ${n}\` para conferir o resumo também)`);
  } else say(`(sem .cache/balance.json: rode \`npm run balance -- ${n}\` e repita, para conferir o resumo também)`);
  return ok;
}
