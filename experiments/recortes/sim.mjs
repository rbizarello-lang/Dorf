// Simulação de partidas dos Recortes (sem gráficos).
//
//   node sim.mjs --fam i30 --player greedy --games 300 --pieces 40 --out saida.json
//
// Opções: --minContact 0.5 (em lados de hexágono) --P 48 --forgive none|discard|patch|magnet|all
//         --tolMul 1 --exhaustive 1 --from 0 --games N --patchSlits 3
//         --world '{"fitPts":4,"gulfPts":16}' (qualquer opção de World: pontuação, tol, dTol)
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { S, deepInside, hyp, mulberry32 } from './geom.mjs';
import { rasterStats } from './metrics.mjs';
import { WATER, makePiece, shapeAt } from './pieces.mjs';
import { World } from './world.mjs';

const polysOf = (world) => world.pieces.map((p) => ({ vx: p.vx, vy: p.vy }));

/**
 * Oráculo independente do gerador de poses: confere (1) vértices inteiros, (2) nenhuma peça entra em
 * outra além da tolerância, (3) rio só encosta em rio: arestas antiparalelas que se sobrepõem em mais
 * de 40 unidades precisam ser as duas de rio ou as duas de terra.
 */
export function validate(world) {
  const tol2 = (world.tol * 1.5) ** 2;
  const out = { overlaps: 0, nonInt: 0, riverBad: 0 };
  const ps = world.pieces;
  for (const p of ps) for (let i = 0; i < p.vx.length; i++) if (!Number.isInteger(p.vx[i]) || !Number.isInteger(p.vy[i])) out.nonInt++;
  for (let a = 0; a < ps.length; a++)
    for (let b = a + 1; b < ps.length; b++) {
      const A = ps[a], B = ps[b];
      if (A.maxx < B.minx - 200 || B.maxx < A.minx - 200 || A.maxy < B.miny - 200 || B.maxy < A.miny - 200) continue;
      let hit = false;
      for (let i = 0; i < A.sx.length && !hit; i++) if (deepInside(A.sx[i], A.sy[i], B.vx, B.vy, tol2)) hit = true;
      for (let i = 0; i < B.sx.length && !hit; i++) if (deepInside(B.sx[i], B.sy[i], A.vx, A.vy, tol2)) hit = true;
      if (hit) out.overlaps++;
      for (const e of A.edges)
        for (const f of B.edges) {
          if (e.ux * f.ux + e.uy * f.uy > -world.angCos) continue;
          const dc = e.ux * (f.ay - e.ay) - e.uy * (f.ax - e.ax), dd = e.ux * (f.by - e.ay) - e.uy * (f.bx - e.ax);
          if (Math.abs(dc) > world.dTol + 1 || Math.abs(dd) > world.dTol + 1) continue;
          const tc = e.ux * (f.ax - e.ax) + e.uy * (f.ay - e.ay), td = e.ux * (f.bx - e.ax) + e.uy * (f.by - e.ay);
          const ov = Math.min(e.len, Math.max(tc, td)) - Math.max(0, Math.min(tc, td));
          if (ov > 60 && (e.label === WATER) !== (f.label === WATER)) out.riverBad++;
        }
    }
  return out;
}

const pct = (a, p) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

/** Joga uma partida. Devolve o registro; com cfg.keep devolve também o mundo e o passo a passo. */
export function playGame(cfg) {
  const { fam, seed } = cfg;
  const wopts = { P: cfg.P ?? 48, minContact: (cfg.minContact ?? 0.5) * S, exhaustive: !!cfg.exhaustive, tolMul: cfg.tolMul ?? 1, ...(cfg.world ?? {}) };
  const world = new World(fam, wopts);
  const rng = mulberry32((seed * 7919 + 13) >>> 0);
  const forgive = cfg.forgive ?? 'none';
  const useDiscard = forgive !== 'none';
  const usePatch = forgive === 'patch';
  const pieces = cfg.pieces ?? 40;
  const rec = {
    seed,
    turns: 0,
    noPose: 0,
    discards: 0,
    patches: 0,
    maxConsec: 0,
    stuck: false,
    score: 0,
    placed: 0,
    ms: [],
    poses: [],
    rich: [],
    richPlaces: [],
    gap: [],
    top3gap: [],
    cand: [],
    ovl: [],
    riverPieces: 0,
    riverJoined: 0,
    check: {},
    parts: { match: 0, syn: 0, river: 0, perfect: 0, fit: 0, gulf: 0 },
    steps: [],
  };
  const first = makePiece(fam, seed, 0);
  world.placeFirst(first, 0);
  rec.placed = 1;
  let stack = pieces - 1;
  let k = 1;
  let consec = 0;
  const cps = new Set(cfg.checkpoints ?? [10, 20, 30]);
  const snapshot = (tag) => {
    const rs = rasterStats(polysOf(world));
    rec.check[tag] = { ...rs, perim: world.perim, ratio: world.perim / (2 * Math.sqrt(Math.PI * world.area)), n: world.pieces.length };
  };
  let patchesGiven = 0;
  while (stack > 0) {
    let piece = makePiece(fam, seed, k++);
    stack--;
    rec.turns++;
    // remendo por fendas: o jogo oferece uma peça pequena extra quando o mapa tem muitas fendas
    if (cfg.patchSlits && patchesGiven < 8 && world.pieces.length >= 8) {
      const rs = rasterStats(polysOf(world));
      if (rs.slits + rs.lagoons >= cfg.patchSlits) {
        patchesGiven++;
        const patch = makePiece(fam, seed, 5000 + k, true);
        const r = world.poses(patch);
        if (r.poses.length) {
          const pose = r.poses[0];
          world.place(patch, pose);
          rec.patches++;
          rec.score += pose.score;
          rec.placed++;
        }
      }
    }
    const t0 = performance.now();
    let res = world.poses(piece);
    let ms = performance.now() - t0;
    if (!res.poses.length) {
      rec.noPose++;
      consec++;
      rec.maxConsec = Math.max(rec.maxConsec, consec);
      if (!useDiscard) {
        rec.stuck = true;
        break;
      }
      rec.discards++;
      if (usePatch) {
        const patch = makePiece(fam, seed, 7000 + k, true);
        const r2 = world.poses(patch);
        if (r2.poses.length) {
          piece = patch;
          res = r2;
          rec.patches++;
        } else continue;
      } else continue;
    }
    consec = 0;
    const poses = res.poses;
    rec.ms.push(ms);
    rec.poses.push(poses.length);
    rec.cand.push(res.stats.candidates);
    rec.ovl.push(res.stats.overlapTests);
    const best = poses[0].score;
    const thr = best * 0.9;
    const good = poses.filter((p) => p.score >= thr);
    rec.rich.push(good.length);
    // lugares distintos entre as boas: agrupa as poses cujo centro está a menos de 0,8 lado uma da outra
    const centers = [];
    for (const p of good) {
      const sh = shapeAt(piece, p.r);
      const cx = sh.cx + p.tx, cy = sh.cy + p.ty;
      if (!centers.some((c) => (c[0] - cx) ** 2 + (c[1] - cy) ** 2 < (0.8 * S) ** 2)) centers.push([cx, cy]);
    }
    rec.richPlaces.push(centers.length);
    const med = poses[Math.floor(poses.length / 2)].score;
    rec.gap.push(best > 0 ? (best - med) / best : 0);
    rec.top3gap.push(best > 0 ? (best - (poses[Math.min(2, poses.length - 1)].score)) / best : 0);
    // escolha do jogador
    let idx = 0;
    if (cfg.player === 'top3') idx = Math.floor(rng() * Math.min(3, poses.length));
    const pose = poses[idx];
    const pc = world.place(piece, pose);
    rec.score += pose.score;
    rec.placed++;
    for (const key of Object.keys(rec.parts)) rec.parts[key] += pose.parts[key] ?? 0;
    if (piece.mouths.length) {
      rec.riverPieces++;
      if ((pose.parts.river ?? 0) > 0) rec.riverJoined++;
    }
    if (cfg.keep) {
      rec.steps.push({ k, piece, n: poses.length, score: pose.score, parts: pose.parts, poses: poses.slice(0, 12).map((p) => ({ r: p.r, tx: p.tx, ty: p.ty, score: p.score })), chosen: idx, pcId: pc.id, snap: cfg.snap ? world.pieces.map((q) => q.edges.map((e) => e.exp.slice())) : null });
    }
    if (cps.has(world.pieces.length)) snapshot('n' + world.pieces.length);
  }
  snapshot('fim');
  const v = validate(world);
  rec.overlaps = v.overlaps;
  rec.nonInt = v.nonInt;
  rec.riverBad = v.riverBad;
  rec.perimEnd = world.perim;
  if (cfg.keep) rec.world = world;
  return rec;
}

/** Agrega uma lista de partidas numa linha de tabela. */
export function summarize(recs, label) {
  const all = (f) => recs.flatMap(f);
  const turns = recs.reduce((s, r) => s + r.turns, 0);
  const stuckTurns = recs.reduce((s, r) => s + r.noPose, 0);
  const row = {
    label,
    games: recs.length,
    semPosePct: (100 * stuckTurns) / Math.max(1, turns),
    partidasComTravaPct: (100 * recs.filter((r) => r.noPose > 0).length) / recs.length,
    travaFortePct: (100 * recs.filter((r) => r.maxConsec >= 3).length) / recs.length,
    posesMed: mean(all((r) => r.poses)),
    posesMin: Math.min(...all((r) => r.poses)),
    rich10: mean(all((r) => r.rich)),
    richMed: pct(all((r) => r.rich), 50),
    richPlaces: mean(all((r) => r.richPlaces ?? [])),
    gap: mean(all((r) => r.gap)),
    top3gap: mean(all((r) => r.top3gap)),
    msMed: mean(all((r) => r.ms)),
    msP95: pct(all((r) => r.ms), 95),
    msMax: Math.max(...all((r) => r.ms)),
    scoreMed: mean(recs.map((r) => r.score)),
    scoreP10: pct(recs.map((r) => r.score), 10),
    scoreP90: pct(recs.map((r) => r.score), 90),
    placedMed: mean(recs.map((r) => r.placed)),
    discards: mean(recs.map((r) => r.discards)),
    patches: mean(recs.map((r) => r.patches)),
    overlaps: recs.reduce((s, r) => s + r.overlaps, 0),
    nonInt: recs.reduce((s, r) => s + r.nonInt, 0),
    riverBad: recs.reduce((s, r) => s + r.riverBad, 0),
    riverJoinPct: (100 * recs.reduce((s, r) => s + r.riverJoined, 0)) / Math.max(1, recs.reduce((s, r) => s + r.riverPieces, 0)),
    parts: Object.fromEntries(Object.keys(recs[0].parts).map((key) => [key, mean(recs.map((r) => r.parts[key]))])),
    check: {},
  };
  for (const tag of ['n10', 'n20', 'n30', 'fim']) {
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
  return row;
}

// ---- linha de comando ----
if (process.argv[1] && process.argv[1].endsWith('sim.mjs')) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
  const games = +(args.games ?? 300), from = +(args.from ?? 0);
  const cfg = {
    fam: args.fam ?? 'i30',
    player: args.player ?? 'greedy',
    pieces: +(args.pieces ?? 40),
    minContact: +(args.minContact ?? 0.5),
    P: +(args.P ?? 48),
    forgive: args.forgive ?? 'none',
    tolMul: +(args.tolMul ?? 1),
    exhaustive: args.exhaustive === '1',
    patchSlits: +(args.patchSlits ?? 0),
    world: { ...(args.magnet === '1' ? (args.fam === 'ii' ? { tolMul: 2 } : { tol: 100, dTol: 100 }) : {}), ...(args.world ? JSON.parse(args.world) : {}) },
  };
  const recs = [];
  const t0 = performance.now();
  for (let g = from; g < from + games; g++) {
    recs.push(playGame({ ...cfg, seed: 1000 + g }));
    if (args.verbose && (g - from) % 10 === 9) process.stderr.write(`  ${g - from + 1}/${games} ${((performance.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  const row = summarize(recs, args.label ?? `${cfg.fam}/${cfg.player}/${cfg.forgive}/c${cfg.minContact}`);
  row.cfg = cfg;
  row.wallSec = (performance.now() - t0) / 1000;
  if (args.out) writeFileSync(args.out, JSON.stringify(row, null, 1));
  console.log(JSON.stringify(row));
}
