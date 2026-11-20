// Paisagem viva (src/core/living.ts): o estágio de cada terreno de cada peça, em partidas inteiras de todos os temas e de quatro modos
// (Clássico, Zen, Relevo e Terra contínua). Confere:
//   1. o estágio contra um ORÁCULO escrito aqui, que não chama o código testado: tabela própria de vizinhos, contagem própria de
//      encaixes por terreno e, na Terra, as manchas por busca em largura sobre (peça, setor) com área e fechamento contados à mão;
//   2. as invariantes: rio e trilho sem estágio, estágio de 0 a 3, fora da Terra só os encaixes valem, a função não muda o tabuleiro;
//   3. independência da ordem: o mesmo conjunto de peças, postas em outras ordens (crescimento conexo aleatório, lista embaralhada),
//      dá o mesmo mapa de estágios;
//   4. replay e desfazer: refazer a partida jogada a jogada dá, a cada jogada, o mesmo mapa; desfazer (replay até a jogada anterior)
//      devolve o mapa de antes;
//   5. o estágio não mexe na pontuação: a mesma partida pontua igual com e sem o cálculo no meio;
//   6. a prévia do fantasma (`previewStages`, `previewGrowth`) bate com o que a peça vira ao pousar (só encaixes);
//   7. a Terra de fato usa as manchas: alguma peça passa do estágio dos encaixes por mancha fechada e por mancha grande.
import { DEFAULT_RULES, type Board, type Placed, type Rules } from '../src/core/board';
import { Game } from '../src/core/game';
import { LIVING, livingStages, previewGrowth, previewStages, stageSig } from '../src/core/living';
import { modeById, modeRules, type ModeId } from '../src/core/modes';
import { mulberry32 } from '../src/core/rng';
import { T } from '../src/core/tiles';
import { THEMES } from '../src/themes/themes';

const N = Number(process.argv[2] ?? 12);
let failed = 0;
const fail = (msg: string) => {
  if (failed++ < 30) console.error('FALHOU:', msg);
};
const check = (ok: boolean, msg: string) => {
  if (!ok) fail(msg);
};

// ----- o oráculo -----
/** Vizinhos axiais, escritos aqui (a borda i encosta na casa i; o lado oposto é i + 3). */
const NB: [number, number][] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
type Cell = { q: number; r: number; edges: readonly number[] };

function oracle(cells: Cell[], terra: boolean): Map<string, number[]> {
  const at = new Map<string, number>();
  cells.forEach((c, i) => at.set(`${c.q},${c.r}`, i));
  const nbOf = (i: number, s: number) => {
    const j = at.get(`${cells[i].q + NB[s][0]},${cells[i].r + NB[s][1]}`);
    return j === undefined ? -1 : j;
  };
  const land = (t: number) => t >= 0 && t <= 3;
  const out = new Map<string, number[]>();
  cells.forEach((c, i) => {
    const st = [0, 0, 0, 0, 0, 0];
    for (let t = 0; t <= 3; t++) {
      let m = 0;
      for (let s = 0; s < 6; s++) {
        if (c.edges[s] !== t) continue;
        const j = nbOf(i, s);
        if (j >= 0 && cells[j].edges[(s + 3) % 6] === t) m++;
      }
      st[t] = Math.min(3, m);
    }
    out.set(`${c.q},${c.r}`, st);
  });
  if (!terra) return out;
  // Manchas: busca em largura sobre os setores (peça, borda) de terra.
  const seen = new Set<string>();
  cells.forEach((c, i) => {
    for (let s0 = 0; s0 < 6; s0++) {
      if (!land(c.edges[s0]) || seen.has(`${i}:${s0}`)) continue;
      const terr = c.edges[s0];
      const members: [number, number][] = [];
      const queue: [number, number][] = [[i, s0]];
      seen.add(`${i}:${s0}`);
      let closed = true;
      while (queue.length) {
        const [a, s] = queue.pop()!;
        members.push([a, s]);
        const next: [number, number][] = [];
        // dentro da peça: o setor ao lado, se for do mesmo terreno
        for (const d of [1, 5]) if (cells[a].edges[(s + d) % 6] === terr) next.push([a, (s + d) % 6]);
        // pela borda: o setor da vizinha do outro lado
        const j = nbOf(a, s);
        if (j < 0) closed = false;
        else if (cells[j].edges[(s + 3) % 6] === terr) next.push([j, (s + 3) % 6]);
        for (const [b, t] of next) if (!seen.has(`${b}:${t}`)) (seen.add(`${b}:${t}`), queue.push([b, t]));
      }
      const area = members.length / 6;
      for (const [a] of members) {
        const key = `${cells[a].q},${cells[a].r}`;
        const st = out.get(key)!;
        const base = (() => {
          let m = 0;
          for (let s = 0; s < 6; s++) {
            if (cells[a].edges[s] !== terr) continue;
            const j = nbOf(a, s);
            if (j >= 0 && cells[j].edges[(s + 3) % 6] === terr) m++;
          }
          return m;
        })();
        const v = closed ? 3 : area >= 4 ? Math.min(3, base + 1) : 0;
        if (v > st[terr]) st[terr] = v;
      }
    }
  });
  return out;
}

const cellsOf = (b: Board): Cell[] => b.list.map((p) => ({ q: p.q, r: p.r, edges: p.edges }));
const stagesOf = (b: Board) => {
  const m = livingStages(b);
  const out = new Map<string, string>();
  for (const p of b.list) out.set(`${p.q},${p.r}`, stageSig(m.get(p.key)!));
  return out;
};
const mapSig = (m: Map<string, string>) => [...m.entries()].map(([k, v]) => `${k}=${v}`).sort().join('|');
const MODES: ModeId[] = ['classico', 'zen', 'relevo', 'terra'];

let games = 0, tiles = 0, orders = 0, replays = 0, undos = 0, previews = 0, hist = [0, 0, 0, 0], terraLift = { closed: 0, large: 0 };

function playGame(seed: number, mode: ModeId) {
  const theme = THEMES[seed % THEMES.length];
  const rules: Rules = { ...DEFAULT_RULES, ...theme.rules, ...modeRules(modeById(mode), seed) };
  const g = new Game(seed, rules, []);
  const rnd = mulberry32(seed * 7 + 1);
  const moves: [number, number, number][] = [];
  const snaps: string[] = [];
  const scores: number[] = [];
  let guard = 0;
  while (g.current && guard++ < 90) {
    const m = g.bestMove(rnd);
    if (!m) break;
    g.rot = m.rot;
    // 6. a prévia do fantasma, antes de pousar, contra o que a peça vira depois (fora da Terra, onde só os encaixes valem).
    const pre = previewStages(g.board, m.q, m.r, g.current.edges.length ? rotated(g.current.edges, m.rot) : []);
    const grow = previewGrowth(g.board, m.q, m.r, rotated(g.current.edges, m.rot));
    const before = stagesOf(g.board);
    if (!g.place(m.q, m.r)) break;
    moves.push([m.q, m.r, m.rot]);
    scores.push(g.board.score);
    snaps.push(mapSig(stagesOf(g.board)));
    const placed = g.board.get(m.q, m.r)!;
    if (!rules.terra) {
      check(stageSig(pre) === stageSig(livingStages(g.board).get(placed.key)!), `prévia seed ${seed} ${mode} ${m.q},${m.r}`);
      const after = stagesOf(g.board);
      let changed = 0;
      for (const [k, v] of after) if (k !== `${m.q},${m.r}` && before.has(k) && before.get(k) !== v) changed++;
      check(changed === grow, `crescimento das vizinhas seed ${seed} ${mode}: prévia ${grow}, real ${changed}`);
      previews++;
    }
  }
  return { g, rules, moves, snaps, scores };
}
/** Giro das bordas escrito aqui (out[(i + rot) % 6] = base[i]). */
function rotated(base: readonly number[], rot: number): T[] {
  const out = new Array<T>(6);
  for (let i = 0; i < 6; i++) out[(i + rot) % 6] = base[i] as T;
  return out;
}

for (let seed = 1; seed <= N && failed < 30; seed++) {
  for (const mode of MODES) {
    const { g, rules, moves, snaps, scores } = playGame(seed, mode);
    const b = g.board;
    games++;
    tiles += b.list.length;
    // 1. o oráculo
    const want = oracle(cellsOf(b), !!rules.terra);
    const map = livingStages(b);
    for (const p of b.list) {
      const got = map.get(p.key)!;
      const w = want.get(`${p.q},${p.r}`)!;
      check(got.length === 6 && got.every((v, t) => v === w[t]), `oráculo seed ${seed} ${mode} ${p.q},${p.r}: ${got.join('')} contra ${w.join('')}`);
      // 2. invariantes
      check(got[T.Water] === 0 && got[T.Rail] === 0, `rio e trilho sem estágio seed ${seed} ${mode}`);
      check(got.every((v) => v >= 0 && v <= LIVING.maxStage), `estágio fora de 0 a 3 seed ${seed} ${mode}`);
      hist[Math.max(...got)]++;
      if (rules.terra) {
        const plain = oracle(cellsOf(b), false).get(`${p.q},${p.r}`)!;
        if (got.some((v, t) => v > plain[t])) {
          for (let t = 0; t <= 3; t++) if (got[t] > plain[t]) got[t] === 3 ? terraLift.closed++ : terraLift.large++;
        }
      } else {
        const plain = want.get(`${p.q},${p.r}`)!;
        check(got.every((v, t) => v === plain[t]), `fora da Terra só os encaixes valem seed ${seed} ${mode}`);
      }
    }
    // 2b. a função não muda o tabuleiro
    const snapBefore = JSON.stringify(b.list.map((p) => [p.q, p.r, p.edges, p.index]));
    livingStages(b);
    check(snapBefore === JSON.stringify(b.list.map((p) => [p.q, p.r, p.edges, p.index])), 'o cálculo mudou o tabuleiro');
    // 3. independência da ordem (e da ordem da lista)
    const finalSig = mapSig(stagesOf(b));
    for (let o = 0; o < 4; o++) {
      const rng = mulberry32(seed * 977 + o * 31 + 5);
      const pending = [...b.list];
      const have = new Map<string, Placed>();
      const order: Placed[] = [];
      const key = (q: number, r: number) => `${q},${r}`;
      const fake = { rules: b.rules, get: (q: number, r: number) => have.get(key(q, r)), list: order } as unknown as Board;
      const first = pending.shift()!;
      have.set(key(first.q, first.r), first);
      order.push(first);
      while (pending.length) {
        const cand = pending.filter((p) => NB.some(([dq, dr]) => have.has(key(p.q + dq, p.r + dr))));
        if (!cand.length) break;
        const pick = cand[Math.floor(rng() * cand.length)];
        pending.splice(pending.indexOf(pick), 1);
        have.set(key(pick.q, pick.r), pick);
        order.push(pick);
      }
      // lista embaralhada: nem a ordem das jogadas nem a da lista pode importar
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const m = livingStages(fake);
      const got = new Map<string, string>();
      for (const p of order) got.set(key(p.q, p.r), stageSig(m.get(p.key)!));
      check(!pending.length ? mapSig(got) === finalSig : true, `ordem ${o} seed ${seed} ${mode}: o estágio depende da ordem`);
      if (!pending.length) orders++;
    }
    // 4. replay e desfazer
    const replay = new Game(seed, rules, []);
    const replaySnaps: string[] = [];
    for (let i = 0; i < moves.length; i++) {
      replay.rot = moves[i][2];
      replay.place(moves[i][0], moves[i][1]);
      replaySnaps.push(mapSig(stagesOf(replay.board)));
      check(replaySnaps[i] === snaps[i], `replay seed ${seed} ${mode} jogada ${i}`);
      // 5. a pontuação não depende do cálculo
      check(replay.board.score === scores[i], `pontuação seed ${seed} ${mode} jogada ${i}`);
    }
    replays++;
    if (moves.length > 2) {
      const k = moves.length - 1;
      const undo = new Game(seed, rules, []);
      for (let i = 0; i < k; i++) {
        undo.rot = moves[i][2];
        undo.place(moves[i][0], moves[i][1]);
      }
      check(mapSig(stagesOf(undo.board)) === snaps[k - 1], `desfazer seed ${seed} ${mode}`);
      undos++;
    }
  }
}
check(hist[3] > 0 && hist[2] > 0 && hist[1] > 0, `faltou cobertura dos estágios: ${hist}`);
check(terraLift.closed > 0, 'na Terra nenhuma mancha fechada subiu uma peça ao estágio máximo');
check(terraLift.large > 0, 'na Terra nenhuma mancha grande subiu um estágio');

if (failed) {
  console.error(`${failed} falhas`);
  process.exit(1);
}
console.log(`paisagem viva ok: ${games} partidas, ${tiles} peças, ${orders} ordens, ${replays} replays, ${undos} desfazer, ${previews} prévias, peças por estágio máximo ${hist.join('/')}, Terra: ${terraLift.closed} terrenos por mancha fechada e ${terraLift.large} por mancha grande`);
