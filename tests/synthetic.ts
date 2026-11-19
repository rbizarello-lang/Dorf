// Escrito pelo agente revisor (Sonnet) durante a QA do protótipo; adaptado para o repositório.
// Cenários sintéticos: peça travada / descarte / fim de jogo por descarte / semente vs. sequência de peças.
import { DEFAULT_RULES, type Rules } from '../src/core/board';
import { sail } from './voyage';
import { Game } from '../src/core/game';
import { DIRS, hkey } from '../src/core/hex';
import { T, rotateEdges, type TileDef } from '../src/core/tiles';
import { mulberry32 } from '../src/core/rng';

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

{
  const trial = new Game(42, { ...rules, riverTrade: true });
  const port = trial.board.ports[0], dir = DIRS.findIndex(([x, y]) => x * 2 === port.q && y * 2 === port.r);
  const edges = Array<T>(6).fill(T.Grass);
  edges[dir] = edges[(dir + 3) % 6] = T.Water;
  const piece = { edges, quest: null, seed: 1 };
  trial.board.placeRaw(port.q, port.r, piece, 0);
  trial.board.computeGroups();
  ok(!trial.board.onMainRiver(trial.board.get(port.q, port.r)) && !port.delivered, 'Rio isolado no cais ainda espera a vila');
  const quote = trial.board.voyageAt(port.q / 2, port.r / 2, edges);
  ok(quote.shipments.length === 1 && quote.shipments[0].port.id === 0 && quote.shipments[0].tiles === 4 && !port.delivered, 'Prévia da ponte reconhece um cais remoto e preserva a partida');
  const bridge = trial.board.place(port.q / 2, port.r / 2, piece, 0);
  ok(bridge.deliveries.length === 1 && port.delivered, 'Ligar o trecho intermediário entrega a carga');
  const farther = trial.board.place(port.q * 1.5, port.r * 1.5, piece, 0);
  ok(farther.deliveries.length === 0, 'Ampliar a rota pronta não repete a entrega');

  let finished = 0;
  let firstSupply = 0;
  for (let seed = 1; seed <= 36; seed++) {
    const { game, moves } = sail(seed);
    if (game.over && game.board.ports.every((p) => p.delivered)) finished++;
    const replay = new Game(seed, game.rules);
    for (const [i, [q, r, rot]] of moves.entries()) {
      replay.rot = rot;
      const res = replay.place(q, r)!;
      if (i === 1 && res.deliveries.length === 1 && res.deliveries[0].id === 0 && replay.stack === 26) firstSupply++;
      while (replay.discardIfStuck());
    }
    ok(replay.board.score === game.board.score && replay.over === game.over, `Viagem ${seed}: replay do roteiro`);
  }
  ok(finished === 36 && firstSupply === 36, `${finished}/36 viagens chegaram aos três cais; ${firstSupply}/36 abasteceram a Feira na segunda peça`);
  let charters = 0;
  for (let seed = 1; seed <= 36; seed++) {
    const direct = sail(seed), freight = new Game(seed, { ...direct.game.rules, combinedFreight: true, legacyFreight: true });
    let held = false, released = false;
    for (const [i, [q, r, rot]] of direct.moves.entries()) {
      freight.rot = rot;
      const res = freight.place(q, r)!;
      if (i === 1) held = !res.deliveries.length && freight.stack === 22;
      if (res.deliveries.some((p) => p.id === 1)) released = res.deliveries.some((p) => p.id === 0);
      while (freight.discardIfStuck());
    }
    if (held && released && freight.over && freight.board.ports.every((p) => p.delivered)
      && freight.board.score === direct.game.board.score + 6 * freight.rules.leftoverPoints) charters++;
  }
  ok(charters === 36, `${charters}/36 fretes aguardaram a Serraria, pagaram juntos e fecharam com o prêmio correto`);

  // Cais consecutivos no mesmo canal permitem inverter a ordem e ligar ambos pela mesma ponte.
  for (const simultaneous of [false, true]) {
    const g = new Game(42, { ...rules, riverTrade: true, combinedFreight: true });
    const [fair, sawmill] = g.board.ports;
    const [dx, dr] = DIRS[dir];
    Object.assign(sawmill, { q: dx, r: dr });
    if (simultaneous) g.board.placeRaw(fair.q, fair.r, piece, 0);
    const first = g.board.place(dx, dr, piece, 0);
    const next = simultaneous ? first : g.board.place(fair.q, fair.r, piece, 0);
    ok(fair.reward === 10 && sawmill.reward === 6 && sawmill.delivered && fair.delivered && first.deliveries.length === (simultaneous ? 2 : 1)
      && next.deliveries.some((p) => p.id === 0), simultaneous ? 'Ponte única libera os dois cais' : 'Serraria aberta antes da Feira também cumpre o frete');
    ok(g.board.place(dx * 3, dr * 3, piece, 0).deliveries.length === 0, 'Frete quitado uma única vez');
  }
}

console.log(bad ? `\n${bad} FALHA(S)` : '\nTodos os cenários sintéticos passaram');
process.exit(bad ? 1 : 0);
