// Encostas (src/core/hills.ts + src/render/hillSurface.ts), em partidas inteiras de todos os temas e de três modos (Clássico, Relevo e Terra).
// Confere:
//   1. EMENDA, por um oráculo escrito aqui: para cada divisa entre duas peças de terra, amostra a altura dos DOIS lados no espaço do
//      mundo (cada lado vai ao local da própria peça por uma conta feita aqui, não pela do render) e compara com a fórmula fechada do
//      relevo da divisa (terreno igual: rim da dupla de sementes × perfil transversal; terreno diferente ou sem vizinha: chão, 0);
//      também os nós da malha (`HillSurface`) dos dois lados na divisa;
//   2. determinismo (a mesma peça no mesmo tabuleiro dá o mesmo perfil, e o perfil não depende da ordem em que as peças foram postas);
//   3. a ATUALIZAÇÃO DAS VIZINHAS: o protocolo do mundo (refazer só a peça nova e as 6 vizinhas a cada jogada) chega ao mesmo estado
//      final do cálculo do zero, em várias ordens de jogada;
//   4. replay e desfazer: refazer a partida jogada a jogada dá os mesmos perfis, e desfazer (replay até a jogada anterior) devolve
//      os perfis de antes;
//   5. o chão da divisa sobe com o encaixe (o patamar vai a 3) e nunca passa de um teto.
import { DEFAULT_RULES, type Board, type Placed, type Rules } from '../src/core/board';
import { Game } from '../src/core/game';
import { corner, DIRS, hexToWorld, opposite } from '../src/core/hex';
import { boardHill, handHill, hillHeight, hillSignature, MASS, type HillProfile } from '../src/core/hills';
import { modeById, modeRules, type ModeId } from '../src/core/modes';
import { tileProfile } from '../src/core/relief';
import { mulberry32 } from '../src/core/rng';
import { isStrict, T } from '../src/core/tiles';
import { HillSurface } from '../src/render/hillSurface';
import { THEMES } from '../src/themes/themes';
import './village-terraces';
import './foundations';
import './inner-bays';

const N = Number(process.argv[2] ?? 12);
let failed = 0;
const fail = (msg: string) => {
  if (failed++ < 30) console.error('FALHOU:', msg);
};
const check = (ok: boolean, msg: string) => {
  if (!ok) fail(msg);
};

const MODES: ModeId[] = ['classico', 'relevo', 'terra'];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// ----- o oráculo: tudo recalculado aqui, sem as funções de altura do jogo -----
/** O ponto local (x, z) de uma peça com giro `rot` e centro `c`, a partir de um ponto do mundo (rotação por -rot·60°). */
function toLocal(c: { x: number; z: number }, rot: number, x: number, z: number): [number, number] {
  const a = (-rot * Math.PI) / 3, dx = x - c.x, dz = z - c.z;
  return [dx * Math.cos(a) - dz * Math.sin(a), dx * Math.sin(a) + dz * Math.cos(a)];
}
/** O rim esperado de uma divisa (terreno `t`, sementes `a` e `b`, e os dois níveis lógicos do Relevo, ou null). */
function expectedRim(t: T, a: number, b: number, lv: [number, number] | null): number {
  const pair = (a ^ b) >>> 0;
  let rim = (0.12 + MASS[t] * 0.6) * (0.9 + (0.2 * (pair % 191)) / 190);
  if (lv) rim += (0.05 * (lv[0] + lv[1])) / 2;
  return rim;
}

let games = 0, seams = 0, valleys = 0, nodeChecks = 0, replays = 0, orders = 0, tiles = 0, maxStage = 0, maxRim = 0;

function playGame(seed: number, mode: ModeId) {
  const theme = THEMES[seed % THEMES.length];
  const rules: Rules = { ...DEFAULT_RULES, ...theme.rules, ...modeRules(modeById(mode), seed) };
  const g = new Game(seed, rules, []);
  const rnd = mulberry32(seed * 7 + 1);
  const moves: [number, number, number][] = [];
  const snaps: string[] = [];
  let guard = 0;
  while (g.current && guard++ < 80) {
    const m = g.bestMove(rnd);
    if (!m) break;
    g.rot = m.rot;
    if (!g.place(m.q, m.r)) break;
    moves.push([m.q, m.r, m.rot]);
    snaps.push(boardSig(g.board));
  }
  return { g, rules, moves, snaps, theme };
}

const profileOf = (b: Board, p: Placed) => boardHill(b, p.q, p.r, p.def, p.rot);
/** Assinatura do tabuleiro: o perfil de cada peça, ordenado por casa (não pela ordem das jogadas). */
function boardSig(b: Board) {
  return b.list.map((p) => `${p.q},${p.r}:${hillSignature(profileOf(b, p))}`).sort().join('|');
}

for (let seed = 1; seed <= N && failed < 30; seed++) {
  for (const mode of MODES) {
    const { g, rules, moves, snaps } = playGame(seed, mode);
    const b = g.board;
    games++;
    tiles += b.list.length;
    const profiles = new Map<number, HillProfile>();
    for (const p of b.list) {
      const h = profileOf(b, p);
      profiles.set(p.key, h);
      maxStage = Math.max(maxStage, h.stage);
      for (const v of h.rims) maxRim = Math.max(maxRim, v);
      // 2. determinismo
      check(hillSignature(profileOf(b, p)) === hillSignature(h), `determinismo seed ${seed} ${mode} ${p.q},${p.r}`);
      check(h.stage >= 0 && h.stage <= 3, `patamar fora de 0..3 (${h.stage})`);
    }
    // 1. emendas
    const surfaces = new Map<number, HillSurface>();
    const surf = (p: Placed) => {
      let s = surfaces.get(p.key);
      if (!s) surfaces.set(p.key, (s = new HillSurface(profiles.get(p.key)!, 6, (x, z) => hillHeight(profiles.get(p.key)!, x, z))));
      return s;
    };
    for (const p of b.list) {
      const cp = hexToWorld(p.q, p.r);
      for (let w = 0; w < 6; w++) {
        const t = p.edges[w];
        if (isStrict(t)) continue;
        const [dq, dr] = DIRS[w];
        const nb = b.get(p.q + dq, p.r + dr);
        // Edge `w` (mundo) da peça: do canto de origem `(w - rot)` ao seguinte, girados pelo `rot`.
        const k = (w - p.rot + 6) % 6;
        const [ax, az] = corner(k), [bx, bz] = corner((k + 1) % 6);
        const a = (p.rot * Math.PI) / 3;
        const rotW = (x: number, z: number): [number, number] => [x * Math.cos(a) - z * Math.sin(a) + cp.x, x * Math.sin(a) + z * Math.cos(a) + cp.z];
        const matched = !!nb && !isStrict(nb.edges[opposite(w)]) && nb.edges[opposite(w)] === t;
        const lv: [number, number] | null = rules.relief && nb?.heights && p.heights ? [p.heights[w], nb.heights[opposite(w)]] : null;
        for (let s = 0; s <= 12; s++) {
          const f = s / 12;
          const [wx, wz] = rotW(ax + (bx - ax) * f, az + (bz - az) * f);
          const [lx, lz] = toLocal(cp, p.rot, wx, wz);
          const mine = hillHeight(profiles.get(p.key)!, lx, lz);
          // a distância ao meio da borda, medida ao longo dela: 0 no meio, 0,5 nos cantos
          const across = Math.abs(f - 0.5);
          let want = 0;
          if (matched) want = expectedRim(t, p.def.seed, nb!.def.seed, lv) * (1 - smooth(0.38, 0.8, across / 0.5));
          check(Math.abs(mine - want) < 1e-9, `divisa seed ${seed} ${mode} ${p.q},${p.r} lado ${w} f=${f.toFixed(2)}: ${mine} x ${want}`);
          if (matched) {
            const cn = hexToWorld(nb!.q, nb!.r);
            const [nx, nz] = toLocal(cn, nb!.rot, wx, wz);
            const theirs = hillHeight(profiles.get(nb!.key)!, nx, nz);
            check(Math.abs(mine - theirs) < 1e-9, `emenda seed ${seed} ${mode} ${p.q},${p.r}|${nb!.q},${nb!.r} f=${f.toFixed(2)}: ${mine} x ${theirs}`);
            seams++;
          } else valleys++;
        }
        // Os nós da malha na divisa (os 7 do lado de 6 divisões): os dois lados iguais, no mesmo ponto do mundo.
        if (matched) {
          const sa = surf(p), sb = surf(nb!);
          for (let n = 0; n <= 6; n++) {
            const f = n / 6;
            const [wx, wz] = rotW(ax + (bx - ax) * f, az + (bz - az) * f);
            const cn = hexToWorld(nb!.q, nb!.r);
            const [nx, nz] = toLocal(cn, nb!.rot, wx, wz);
            const [lx, lz] = toLocal(cp, p.rot, wx, wz);
            check(Math.abs(sa.at(lx, lz) - sb.at(nx, nz)) < 1e-6, `malha seed ${seed} ${mode} ${p.q},${p.r}|${nb!.q},${nb!.r} nó ${n}`);
            nodeChecks++;
          }
        }
      }
    }
    // 3. o protocolo do mundo, em várias ordens (crescimento conexo aleatório): só a peça nova e as 6 vizinhas são refeitas a cada jogada.
    const finalSig = boardSig(b);
    for (let o = 0; o < 4; o++) {
      const rng = mulberry32(seed * 131 + o);
      const pending = [...b.list];
      const have = new Map<number, Placed>();
      const fake = { rules: b.rules, get: (q: number, r: number) => have.get(q * 100003 + r) } as unknown as Board;
      const sigs = new Map<number, string>();
      const sigOf = (p: Placed) => hillSignature(boardHill(fake, p.q, p.r, p.def, p.rot));
      // começa pela primeira peça e cresce por vizinhas já postas
      const first = pending.shift()!;
      have.set(first.q * 100003 + first.r, first);
      sigs.set(first.key, sigOf(first));
      while (pending.length) {
        const cand = pending.filter((p) => DIRS.some(([dq, dr]) => have.has((p.q + dq) * 100003 + p.r + dr)));
        if (!cand.length) break;
        const pick = cand[Math.floor(rng() * cand.length)];
        pending.splice(pending.indexOf(pick), 1);
        have.set(pick.q * 100003 + pick.r, pick);
        for (const t of [pick, ...DIRS.map(([dq, dr]) => have.get((pick.q + dq) * 100003 + pick.r + dr)).filter((x): x is Placed => !!x)]) sigs.set(t.key, sigOf(t));
      }
      const got = [...have.values()].map((p) => `${p.q},${p.r}:${sigs.get(p.key)}`).sort().join('|');
      check(got === finalSig || have.size < b.list.length, `ordem ${o} seed ${seed} ${mode}: o protocolo de vizinhas não chegou ao estado final`);
      if (have.size === b.list.length) orders++;
    }
    // 4. replay e desfazer: refaz a partida jogada a jogada e compara a assinatura depois de cada jogada.
    const replay = new Game(seed, rules, []);
    let ok = true;
    for (let i = 0; i < moves.length && ok; i++) {
      replay.rot = moves[i][2];
      replay.place(moves[i][0], moves[i][1]);
      if (boardSig(replay.board) !== snaps[i]) {
        fail(`replay seed ${seed} ${mode} jogada ${i}`);
        ok = false;
      }
    }
    replays++;
    // Desfazer a última jogada = replay até a anterior: o perfil volta ao de antes.
    if (moves.length > 2) {
      const undo = new Game(seed, rules, []);
      for (let i = 0; i < moves.length - 1; i++) {
        undo.rot = moves[i][2];
        undo.place(moves[i][0], moves[i][1]);
      }
      check(boardSig(undo.board) === snaps[moves.length - 2], `desfazer seed ${seed} ${mode}`);
    }
    // 5. a mão: a peça da pilha tem perfil só dela, determinístico, e o Relevo soma a altura lógica.
    if (g.current) {
      const hand = handHill(g.current, rules.relief ? tileProfile(g.current.edges, g.current.seed).h : undefined);
      check(hillSignature(hand) === hillSignature(handHill(g.current, rules.relief ? tileProfile(g.current.edges, g.current.seed).h : undefined)), 'mão');
      check(hand.rims.every((v) => v === 0) && hand.stage === 0, 'a peça na mão não tem divisa nem patamar');
    }
  }
}
check(maxStage === 3, `nenhuma peça chegou ao patamar 3 (máx ${maxStage}): o encaixe não sobe a encosta`);
check(maxRim < 0.6, `rim alto demais (${maxRim})`);

if (failed) {
  console.error(`${failed} falhas`);
  process.exit(1);
}
console.log(`encostas ok: ${games} partidas, ${tiles} peças, ${seams} amostras de emenda dos dois lados, ${valleys} de vale, ${nodeChecks} nós da malha, ${orders} ordens de vizinhas, ${replays} replays, patamar máx ${maxStage}, rim máx ${maxRim.toFixed(3)}`);
