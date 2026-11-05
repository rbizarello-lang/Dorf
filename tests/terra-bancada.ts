// Bancada × jogo (Terra contínua): a mesma partida do jogador guloso da bancada (tests/bench/rules/terra.ts, a regra calibrada) é
// refeita no `Game` do núcleo (modo `terra` sem missões, eras, sítios, maravilha, cartas, estação nem influência) e comparada jogada a
// jogada, termo a termo: pontos da jogada, peças devolvidas (pilha), emendas, perfeito, cerco, interações, crescimento e fechamento das
// manchas, umidade e água. A diferença esperada é zero: o motor leve da bancada e o núcleo implementam a mesma regra por caminhos
// diferentes (a bancada com campo e união-busca próprios; o jogo com o `Board`). Uso: `npm run terra:bancada -- [partidas] [primeira semente]`.
import { DEFAULT_RULES, type Rules } from '../src/core/board';
import { Game } from '../src/core/game';
import { unkey } from '../src/core/hex';
import { modeById } from '../src/core/modes';
import { mulberry32 } from '../src/core/rng';
import { baseRules } from './bench/coreWorld';
import { ranked } from './bench/players';
import { BY_ID } from './bench/rules/index';

/** As regras do modo Terra contínua sobre o encaixe puro: a mesma base da bancada (sem as camadas de progressão do jogo) e sem teto de peças devolvidas. */
export const terraBaseRules = (): Rules => ({ ...DEFAULT_RULES, ...baseRules(), ...modeById('terra').rules, terraBackMin: 1, terraBackCap: 0 });

/** Os termos da bancada (`parts()`) que o jogo conta um a um. A água a bancada separa em duas (própria e a que chega); o jogo, em uma. */
const TERMS = ['encaixe das bordas', 'perfeito', 'cerco da peça', 'interações', 'manchas (crescimento)', 'fechamento de mancha', 'umidade levada às peças vizinhas'] as const;

const N = Number(process.argv[2] ?? 20);
const FIRST = Number(process.argv[3] ?? 1);
const rule = BY_ID.get('terra')!;
const fails: string[] = [];
const sums: Record<string, [number, number]> = {};
let candidates = 0, candMoves = 0, moves = 0, games = 0, scoreBench = 0, scoreGame = 0;

for (let seed = FIRST; seed < FIRST + N && fails.length <= 30; seed++) {
  const w = rule.create(seed);
  const game = new Game(seed, terraBaseRules(), []);
  const rng = mulberry32((seed ^ Math.imul(0x6a1, 0x9e3779b1)) >>> 0);
  let guard = 0;
  let prev: Record<string, number> = {};
  while (!w.over() && guard++ < 2000 && fails.length <= 30) {
    const mv = w.moves();
    if (!mv.length) {
      w.discard();
      if (!game.discardIfStuck()) fails.push(`seed ${seed}: a bancada descartou, o jogo não`);
      continue;
    }
    const m = ranked(mv, rng)[0];
    // Em algumas jogadas, confere TODAS as candidatas: os pontos que a bancada dá a cada (casa, giro) são os que a prévia do jogo dá.
    if (w.placed % 9 === 4) {
      candidates++;
      const seen = new Set<string>();
      for (const c of mv) {
        game.rot = c.rot;
        const pv = game.preview(c.q, c.r);
        seen.add(`${c.q},${c.r},${c.rot}`);
        if (!pv || pv.points !== c.pts) fails.push(`seed ${seed} jogada ${w.placed}: candidata ${c.q},${c.r} giro ${c.rot}: bancada ${c.pts}, prévia do jogo ${pv?.points}`);
        candMoves++;
      }
      // E o jogo não aceita jogada que a bancada recusa.
      for (const k of game.board.frontier) {
        const [q, r] = unkey(k);
        for (let rot = 0; rot < 6; rot++) {
          game.rot = rot;
          if (game.check(q, r)?.valid && !seen.has(`${q},${r},${rot}`)) fails.push(`seed ${seed} jogada ${w.placed}: o jogo aceita ${q},${r} giro ${rot}, a bancada não`);
        }
      }
    }
    const pts = w.play(m);
    const parts = { ...w.parts!() };
    game.rot = m.rot;
    const res = game.place(m.q, m.r);
    if (!res) {
      fails.push(`seed ${seed}: o jogo recusou a jogada ${m.q},${m.r},${m.rot}`);
      break;
    }
    moves++;
    const got = (k: string) => (parts[k] ?? 0) - (prev[k] ?? 0);
    const T = res.terra!;
    const mine: Record<(typeof TERMS)[number], number> = {
      'encaixe das bordas': T.seams,
      perfeito: res.perfect ? game.rules.perfectBonus : 0,
      'cerco da peça': res.closed.length * game.rules.closedBonus,
      interações: res.synergies.length * game.rules.synergyPoints,
      'manchas (crescimento)': T.growth,
      'fechamento de mancha': T.closePoints,
      'umidade levada às peças vizinhas': T.moisture,
    };
    for (const k of TERMS) {
      const a = got(k), b = mine[k];
      (sums[k] ??= [0, 0])[0] += a;
      sums[k][1] += b;
      if (a !== b) fails.push(`seed ${seed} jogada ${w.placed}: ${k}: bancada ${a}, jogo ${b}`);
    }
    const waterBench = got('água corrente (própria peça)') + got('água que chega (peças de antes e mar)');
    const waterGame = res.water?.points ?? 0;
    (sums['água'] ??= [0, 0])[0] += waterBench;
    sums['água'][1] += waterGame;
    if (waterBench !== waterGame) fails.push(`seed ${seed} jogada ${w.placed}: água: bancada ${waterBench}, jogo ${waterGame}`);
    if (pts !== res.points) fails.push(`seed ${seed} jogada ${w.placed}: pontos da jogada: bancada ${pts}, jogo ${res.points}`);
    prev = parts;
    // Descarte: o jogo descarta quando a peça travou; a bancada, quando não há jogada.
    while (!w.over() && w.moves().length === 0) {
      w.discard();
      if (!game.discardIfStuck()) fails.push(`seed ${seed}: a bancada descartou, o jogo não`);
    }
    if (game.discardIfStuck()) fails.push(`seed ${seed}: o jogo descartou, a bancada não`);
    if (game.stack !== w.stack) fails.push(`seed ${seed} jogada ${w.placed}: pilha: bancada ${w.stack}, jogo ${game.stack}`);
  }
  games++;
  scoreBench += w.score;
  scoreGame += game.board.score;
  if (w.score !== game.board.score || w.placed !== game.placedCount || w.discards !== game.discarded) fails.push(`seed ${seed}: final: bancada ${w.score}/${w.placed}/${w.discards}, jogo ${game.board.score}/${game.placedCount}/${game.discarded}`);
}

console.log(`Bancada × jogo: ${games} partidas, ${moves} jogadas (${candidates} posições com as ${candMoves} candidatas conferidas), placar total ${scoreBench} (bancada) × ${scoreGame} (jogo)`);
for (const [k, [a, b]] of Object.entries(sums)) console.log(`  ${k.padEnd(36)} bancada ${String(a).padStart(7)}  jogo ${String(b).padStart(7)}${a === b ? '' : '  <-- diferente'}`);
if (fails.length) {
  console.log(`${fails.length} divergência(s):`);
  for (const f of fails.slice(0, 30)) console.log('  - ' + f);
  process.exit(1);
}
console.log('OK: o jogo e a bancada dão os mesmos pontos, jogada a jogada.');
