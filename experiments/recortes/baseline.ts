// Linha de base: o Clássico (hexágonos de hoje) medido com as MESMAS métricas dos Recortes.
// Usa src/core só para ler (não altera o jogo). Empacota com o rolldown, como os testes:
//   npx rolldown experiments/recortes/baseline.ts --file .cache/recortes-base.mjs --format esm --platform node --logLevel silent
//   node .cache/recortes-base.mjs --games 300 --player greedy --tiles 58
// Regras: as do modo Partida rápida (sem missões, pilha fixa) com `--tiles` peças, para a pilha
// bater com a dos Recortes em área (40 retalhos de ~1,5 hexágono ≈ 58 hexágonos).
import { performance } from 'node:perf_hooks';
import { DEFAULT_RULES, type Rules } from '../../src/core/board';
import { Game } from '../../src/core/game';
import { DIRS, hkey, unkey } from '../../src/core/hex';
import { mulberry32 } from '../../src/core/rng';
import { rotateEdges } from '../../src/core/tiles';
// @ts-ignore: módulo .mjs do experimento
import { rasterStats } from './metrics.mjs';

const S = 1000;
const args = Object.fromEntries(process.argv.slice(2).reduce((a: any[], v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const games = +(args.games ?? 300);
const player = args.player ?? 'greedy';
const tiles = +(args.tiles ?? 58);

const rules: Rules = { ...DEFAULT_RULES, startTiles: tiles, fixedStack: true, questChance: 0, sites: 0, wonderStages: 0, blessings: false };

const hexPoly = (q: number, r: number) => {
  const cx = 1.5 * q * S, cy = Math.sqrt(3) * (r + q / 2) * S;
  const vx: number[] = [], vy: number[] = [];
  for (let i = 0; i < 6; i++) {
    vx.push(cx + S * Math.cos((Math.PI / 3) * i));
    vy.push(cy + S * Math.sin((Math.PI / 3) * i));
  }
  return { vx, vy };
};

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const pct = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0;
};

interface Rec { score: number; placed: number; noPose: number; maxConsec: number; poses: number[]; rich: number[]; gap: number[]; top3gap: number[]; ms: number[]; check: Record<string, any> }
const recs: Rec[] = [];

for (let g = 0; g < games; g++) {
  const seed = 1000 + g;
  const game = new Game(seed, rules);
  const rng = mulberry32((seed * 7919 + 13) >>> 0);
  const rec: Rec = { score: 0, placed: 1, noPose: 0, maxConsec: 0, poses: [], rich: [], gap: [], top3gap: [], ms: [], check: {} };
  let consec = 0;
  const snap = (tag: string) => {
    const polys = [...game.board.tiles.values()].map((p) => hexPoly(p.q, p.r));
    let perim = 0;
    for (const p of game.board.tiles.values()) for (const [dq, dr] of DIRS) if (!game.board.tiles.has(hkey(p.q + dq, p.r + dr))) perim += S;
    const n = polys.length;
    const area = n * 1.5 * Math.sqrt(3) * S * S;
    rec.check[tag] = { ...rasterStats(polys), perim, ratio: perim / (2 * Math.sqrt(Math.PI * area)), n };
  };
  while (game.current) {
    const def = game.current;
    // todas as jogadas (casa, giro) com os pontos reais
    const moves: { q: number; r: number; rot: number; pts: number }[] = [];
    const t0 = performance.now();
    for (const k of game.board.frontier) {
      const [q, r] = unkey(k);
      for (let rot = 0; rot < 6; rot++) {
        if (!game.board.check(q, r, rotateEdges(def.edges, rot)).valid) continue;
        game.rot = rot;
        const res = game.preview(q, r);
        if (res) moves.push({ q, r, rot, pts: res.points });
      }
    }
    const ms = performance.now() - t0;
    if (!moves.length) {
      rec.noPose++;
      consec++;
      rec.maxConsec = Math.max(rec.maxConsec, consec);
      game.discardIfStuck();
      continue;
    }
    consec = 0;
    moves.sort((a, b) => b.pts - a.pts || a.q - b.q || a.r - b.r || a.rot - b.rot);
    const best = moves[0].pts;
    rec.poses.push(moves.length);
    rec.ms.push(ms);
    rec.rich.push(moves.filter((m) => m.pts >= best * 0.9).length);
    const med = moves[Math.floor(moves.length / 2)].pts;
    rec.gap.push(best > 0 ? (best - med) / best : 0);
    rec.top3gap.push(best > 0 ? (best - moves[Math.min(2, moves.length - 1)].pts) / best : 0);
    // top 3 por casa distinta (como a lista de poses dos Recortes tem lugares distintos)
    let idx = 0;
    if (player === 'top3') {
      const places: typeof moves = [];
      for (const m of moves) if (!places.some((p) => p.q === m.q && p.r === m.r)) places.push(m);
      const m = places[Math.floor(rng() * Math.min(3, places.length))];
      idx = moves.indexOf(m);
    }
    const m = moves[idx];
    game.rot = m.rot;
    const res = game.place(m.q, m.r);
    rec.score += res?.points ?? 0;
    rec.placed++;
    const n = game.board.tiles.size;
    if (n === 10 || n === 20 || n === 30 || n === 45) snap('n' + n);
  }
  snap('fim');
  recs.push(rec);
}

const row: any = {
  label: `classico/${player}`,
  games,
  semPosePct: (100 * recs.reduce((s, r) => s + r.noPose, 0)) / Math.max(1, recs.reduce((s, r) => s + r.placed + r.noPose, 0)),
  partidasComTravaPct: (100 * recs.filter((r) => r.noPose > 0).length) / games,
  travaFortePct: (100 * recs.filter((r) => r.maxConsec >= 3).length) / games,
  posesMed: mean(recs.flatMap((r) => r.poses)),
  posesMin: Math.min(...recs.flatMap((r) => r.poses)),
  rich10: mean(recs.flatMap((r) => r.rich)),
  richMed: pct(recs.flatMap((r) => r.rich), 50),
  gap: mean(recs.flatMap((r) => r.gap)),
  top3gap: mean(recs.flatMap((r) => r.top3gap)),
  msMed: mean(recs.flatMap((r) => r.ms)),
  scoreMed: mean(recs.map((r) => r.score)),
  scoreP10: pct(recs.map((r) => r.score), 10),
  scoreP90: pct(recs.map((r) => r.score), 90),
  placedMed: mean(recs.map((r) => r.placed)),
  check: {},
};
for (const tag of ['n10', 'n20', 'n30', 'n45', 'fim']) {
  const cs = recs.map((r) => r.check[tag]).filter(Boolean);
  if (!cs.length) continue;
  row.check[tag] = {
    n: cs.length,
    ratio: mean(cs.map((c) => c.ratio)),
    lagoons: mean(cs.map((c) => c.lagoons)),
    slits: mean(cs.map((c) => c.slits)),
    slitPct: mean(cs.map((c) => (100 * c.slitHex) / c.landHex)),
    lagoonPct: mean(cs.map((c) => (100 * c.lagoonHex) / c.landHex)),
    landHex: mean(cs.map((c) => c.landHex)),
  };
}
console.log(JSON.stringify(row));
