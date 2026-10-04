// Escrito pelo agente revisor (Sonnet) durante a QA do protótipo; adaptado para o repositório.
// Cenários sintéticos: peça travada / descarte / fim de jogo por descarte / semente vs. sequência de peças.
import { DEFAULT_RULES, type Rules } from '../src/core/board';
import { Game } from '../src/core/game';
import { DIRS, hkey } from '../src/core/hex';
import { T, rotateEdges, type TileDef } from '../src/core/tiles';
import { mulberry32 } from '../src/core/rng';
import { timelineSvg, type TurnNote } from '../src/ui/minimap';

const rules: Rules = { ...DEFAULT_RULES };
let bad = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    bad++;
    console.log('  FALHA: ' + m);
  } else console.log('  ok: ' + m);
};

const land = (t: T): TileDef => ({ edges: [t, t, t, t, t, t], seed: 1, quest: null });
const water6: TileDef = { edges: [T.Water, T.Water, T.Water, T.Water, T.Water, T.Water], seed: 2, quest: null };

// ---- 1) Cenário travado: 6 peças de água cercando o inicial => qualquer peça sem água fica sem jogada.
{
  console.log('Cenário 1: anel de água');
  const g = new Game(1, { ...rules, startTiles: 5 });
  for (const [dq, dr] of DIRS) g.board.placeRaw(dq, dr, water6, 0);
  g.board.computeGroups();
  g.current = land(T.Grass);
  g.next = land(T.Forest);
  ok(g.hasAnyMove(g.current) === false, 'hasAnyMove(peça de terra) === false no anel de água');
  ok(g.bestMove() === null, 'bestMove() === null');
  const st0 = g.stack;
  let n = 0;
  while (g.discardIfStuck()) n++;
  ok(g.stack === st0 - n, `descartes consecutivos reduzem a pilha 1 a 1 (n=${n}, pilha ${st0}->${g.stack})`);
  ok(g.over, 'jogo termina ao esvaziar por descartes');
  ok(g.stack === 0, 'pilha final = 0 (não negativa)');
  ok(g.discarded === n, 'contador discarded coerente');
  // Depois de over, discardIfStuck/place/bestMove não devem quebrar
  ok(g.discardIfStuck() === false && g.bestMove() === null && g.place(3, 3) === null, 'após o fim: discard=false, bestMove=null, place=null');
}

// ---- 2) Peça com água pode ser colocada no anel (uma das rotações)
{
  console.log('Cenário 2: peça com água encaixa no anel');
  const g = new Game(1, { ...rules, startTiles: 5 });
  for (const [dq, dr] of DIRS) g.board.placeRaw(dq, dr, water6, 0);
  g.board.computeGroups();
  const wat: TileDef = { edges: [T.Water, T.Grass, T.Grass, T.Grass, T.Grass, T.Grass], seed: 3, quest: null };
  ok(g.hasAnyMove(wat) === true, 'hasAnyMove(peça com 1 água) === true');
}

// ---- 3) Pilha: última peça e bônus de peças
{
  console.log('Cenário 3: fronteira do fim de jogo');
  const g = new Game(7, { ...rules, startTiles: 1 });
  ok(g.stack === 1 && g.current !== null, 'startTiles=1: 1 peça atual');
  const m = g.bestMove()!;
  g.rot = m.rot;
  const res = g.place(m.q, m.r)!;
  ok(res !== null && g.over && g.stack === 0, `colocar a última peça encerra (stack=${g.stack}, ganhou ${res.tilesGained})`);
  const g2 = new Game(7, { ...rules, startTiles: 0 });
  ok(g2.current !== null && g2.stack === 0, `startTiles=0: current!=null mas stack=0 (over=${g2.over}) — regra não usada nos temas`);
}

// ---- 4) A sequência de peças depende do estado das missões?
{
  console.log('Cenário 4: mesma semente, jogadas diferentes => mesma sequência de peças?');
  function sequence(seed: number, policy: 'greedy' | 'random', n: number) {
    const rnd = mulberry32(seed * 31 + (policy === 'greedy' ? 1 : 2));
    Math.random = mulberry32(seed + 99);
    const g = new Game(seed, rules);
    const seq: number[] = [g.current!.seed];
    let i = 0;
    while (g.current && i++ < n) {
      let move: { q: number; r: number; rot: number } | null;
      if (policy === 'greedy') move = g.bestMove();
      else {
        const all: { q: number; r: number; rot: number }[] = [];
        for (const k of g.board.frontier) {
          const q = (k >> 13) - 4096, r = (k & 8191) - 4096;
          for (let rot = 0; rot < 6; rot++) if (g.board.check(q, r, rotateEdges(g.current.edges, rot)).valid) all.push({ q, r, rot });
        }
        move = all.length ? all[Math.floor(rnd() * all.length)] : null;
      }
      if (!move) break;
      g.rot = move.rot;
      g.place(move.q, move.r);
      while (g.discardIfStuck());
      if (g.current) seq.push(g.current.seed);
    }
    return seq;
  }
  let diverged = 0, total = 0, firstDivs: number[] = [];
  for (let seed = 1; seed <= 200; seed++) {
    const a = sequence(seed, 'greedy', 60);
    const b = sequence(seed, 'random', 60);
    total++;
    const L = Math.min(a.length, b.length);
    let d = -1;
    for (let i = 0; i < L; i++) if (a[i] !== b[i]) { d = i; break; }
    if (d >= 0) {
      diverged++;
      firstDivs.push(d);
    }
  }
  firstDivs.sort((x, y) => x - y);
  console.log(`  sementes com sequência de peças diferente entre duas políticas: ${diverged}/${total}; 1ª divergência (mediana) na peça #${firstDivs[Math.floor(firstDivs.length / 2)]}`);
  ok(diverged === 0, 'sequência de peças independe das jogadas (necessário p/ desafio por semente)');
}

// ---- 5) Colocar peça em célula ocupada / sem vizinho / com conflito
{
  console.log('Cenário 5: validações de Game.place');
  const g = new Game(3, rules);
  const cur = g.current!;
  ok(g.place(0, 0) === null, 'place em célula ocupada => null');
  ok(g.place(10, 10) === null, 'place longe (sem vizinho) => null');
  g.current = { edges: [T.Water, T.Grass, T.Grass, T.Grass, T.Grass, T.Grass], seed: 4, quest: null };
  g.rot = 0;
  // água na borda 0: colocar em (0,1)? a borda 3 do novo fica de frente p/ o inicial (que é terra) — não deve ser água
  // rotação 0: água na borda 0 => borda de frente p/ o inicial em (dq,dr)=DIRS[i] é opposite(i)
  let anyConflict = false;
  for (let i = 0; i < 6; i++) {
    const c = g.check(DIRS[i][0], DIRS[i][1]);
    // a peça 'água' em rot 0 tem água na borda 0 => de frente p/ o inicial só quando (i+3)%6 === 0 => i === 3
    if (i === 3) { if (c?.valid) anyConflict = true; } else if (!c?.valid) anyConflict = true;
  }
  ok(!anyConflict, 'rio não encosta em terra: só a célula com água de frente é rejeitada');
  void cur;
  void hkey;
}

// ---- 6) Linha do tempo: marcas de era, missão e maravilha, sem deixar cor solta entrar no SVG.
{
  console.log('Cenário 6: linha do tempo');
  const turns: TurnNote[] = [
    { score: 10, groups: [1, 1, 1, 1, 0, 0], era: null, quests: 0, wonder: null },
    { score: 520, groups: [3, 2, 1, 2, 1, 0], era: 1, quests: 1, wonder: null },
    { score: 3100, groups: [6, 4, 3, 5, 2, 1], era: 3, quests: 0, wonder: 'done' },
  ];
  const colors = ['#89b84a', '#3f8f4a', '#e8b83a', '#d9643f', '#3f8fb8', '#b9a37a'];
  const svg = timelineSvg(turns, colors, '#c8553a', ['Prado', 'Floresta', 'Plantação', 'Vila', 'Rio', 'Estrada']);
  ok(svg.includes('polyline') && svg.includes('maior grupo'), 'gráfico tem a pontuação e a legenda do maior grupo');
  ok(svg.includes('data-mark="era"') && svg.includes('>II<'), 'marca a era alcançada');
  ok(svg.includes('data-mark="quest"') && svg.includes('data-mark="wonder"') && svg.includes('★'), 'marca missão e maravilha pronta');
  ok(svg.includes('#3f8fb8') && svg.includes('>Rio<'), 'o grupo usa a cor e o nome do terreno');
  ok(timelineSvg([], colors, '#c8553a') === '', 'sem jogadas não desenha');
  const dirty = timelineSvg([{ score: 1, groups: [1, 0, 0, 0, 0, 0], era: null, quests: 0, wonder: 'start' }], ['<script>'], '#c8553a');
  ok(dirty.includes('☆') && !dirty.includes('<script>'), 'cor fora do padrão não entra no svg');
}

console.log(bad ? `\n${bad} FALHA(S)` : '\nTodos os cenários sintéticos passaram');
process.exit(bad ? 1 : 0);
