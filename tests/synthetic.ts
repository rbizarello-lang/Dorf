// Escrito pelo agente revisor (Sonnet) durante a QA do protótipo; adaptado para o repositório.
// Cenários sintéticos: peça travada / descarte / fim de jogo por descarte / semente vs. sequência de peças.
import { Board, DEFAULT_RULES, type Rules } from '../src/core/board';
import { Game } from '../src/core/game';
import { DIRS, hkey, unkey } from '../src/core/hex';
import { previewRoutes, routePoints } from '../src/core/routes';
import { T, generateTile, rotateEdges, type TileDef } from '../src/core/tiles';
import { mulberry32 } from '../src/core/rng';
import { timelineSvg, type TurnNote } from '../src/ui/minimap';
import { monumentsDue } from '../src/ui/progress';
import { DAILY_RULES, dailyDate, dailyRule, dailySeed, modeRules, MODES } from '../src/core/modes';
import { shareLine, shareUrl, terrainPoints } from '../src/core/share';
import { knotColors, rotateCorners } from '../src/core/quilt';

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

// ---- 7) Monumentos da praça: a conta é pura e não depende do armazenamento.
{
  console.log('Cenário 7: monumentos por conquista');
  const none = { relics: 0, wonders: 0 };
  ok(monumentsDue({ lumber: 9, relics: 0, wonder: false }, none).join() === '', '9 serrarias ainda não erguem a tora');
  ok(monumentsDue({ lumber: 10, relics: 0, wonder: false }, none).join() === 'log', '10 serrarias numa partida dão a tora');
  ok(monumentsDue({ lumber: 0, relics: 0, wonder: true }, none).join() === 'statue', 'a primeira maravilha dá a estátua');
  ok(monumentsDue({ lumber: 0, relics: 0, wonder: false }, { relics: 0, wonders: 1 }).join() === 'statue', 'maravilha de outra partida também dá a estátua');
  ok(monumentsDue({ lumber: 0, relics: 3, wonder: false }, { relics: 16, wonders: 0 }).join() === '', '19 relíquias ainda não dão o relicário');
  ok(monumentsDue({ lumber: 0, relics: 4, wonder: false }, { relics: 16, wonders: 0 }).join() === 'reliquary', '20 relíquias dão o relicário');
  ok(monumentsDue({ lumber: 10, relics: 20, wonder: true }, none).join() === 'log,statue,reliquary', 'as três conquistas juntas, na ordem fixa');
}

// ---- 8) Estrada Real: a tabela e um par de mercados a 4 casas. O clássico não paga.
{
  console.log('Cenário 8: rotas de comércio');
  ok(routePoints(2).points === 22 && routePoints(2).tiles === 0, 'd=2 rende 22');
  ok(routePoints(4).points === 54 && routePoints(6).points === 96 && routePoints(6).tiles === 1, 'd=4 rende 54 e d=6 rende 96 e uma peça');
  ok(routePoints(8).points === 150 && routePoints(10).points === 214 && routePoints(10).tiles === 1, 'd=8 rende 150 e d=10 rende 214');
  const track = (back: boolean, fwd: boolean): TileDef => {
    const edges = [T.Grass, T.Grass, T.Grass, T.Grass, T.Grass, T.Grass];
    if (fwd) edges[0] = T.Rail;
    if (back) edges[3] = T.Rail;
    return { edges, seed: 1, quest: null };
  };
  const lay = (routes: boolean) => {
    const b = new Board({ ...DEFAULT_RULES, routes, sites: 0 });
    b.placeRaw(0, 0, track(false, true), 0);
    for (let q = 1; q <= 3; q++) b.placeRaw(q, 0, track(true, true), 0);
    return b.place(4, 0, track(true, false), 0);
  };
  const previewBoard = new Board({ ...DEFAULT_RULES, routes: true, sites: 0 });
  previewBoard.placeRaw(0, 0, track(false, true), 0);
  for (let q = 1; q <= 3; q++) previewBoard.placeRaw(q, 0, track(true, true), 0);
  const peek = previewRoutes(previewBoard, 4, 0, track(true, false).edges);
  ok(peek.length === 1 && peek[0].kind === 'market' && peek[0].d === 4 && peek[0].points === 54, 'a prévia mostra os 54 pontos antes de colocar');
  ok(previewBoard.routesPaid.size === 0, 'a prévia não marca o par como pago');
  const paid = lay(true);
  ok(paid.routes.length === 1 && paid.routes[0].kind === 'market' && paid.routes[0].d === 4 && paid.routes[0].points === 54, 'mercados a 4 casas rendem 54');
  ok(paid.points === 64, 'o encaixe do trilho (10) soma com a rota (54)');
  const classic = lay(false);
  ok(classic.routes.length === 0 && classic.points === 10, 'no clássico a mesma linha não rende rota');
  const near = new Board({ ...DEFAULT_RULES, routes: true, sites: 0 });
  near.placeRaw(0, 0, track(false, true), 0);
  const close = near.place(1, 0, track(true, false), 0);
  ok(close.routes.length === 0 && close.points === 10, 'mercados vizinhos (d=1) não rendem');
  const same = (chances: boolean) => generateTile(mulberry32(7), true, ...(chances ? [0.17, 0.09] as const : []));
  const left = same(false), right = same(true);
  ok(left.edges.join() === right.edges.join() && left.seed === right.seed, 'as chances padrão não mudam a sequência de peças');
  const g = new Game(3, { ...DEFAULT_RULES, routes: true, sites: 0, blessings: false });
  const rand = mulberry32(3);
  let drift = 0;
  for (let i = 0; i < 40 && g.current; i++) {
    const m = g.bestMove(rand);
    if (!m) {
      if (!g.discardIfStuck()) break;
      continue;
    }
    g.rot = m.rot;
    const edges = g.currentEdges();
    const peek = edges ? previewRoutes(g.board, m.q, m.r, edges, g.current?.special) : [];
    const res = g.place(m.q, m.r);
    if (!res) break;
    const got = res.routes.map((h) => `${h.kind}:${h.d}:${h.points}`).join();
    const want = peek.map((h) => `${h.kind}:${h.d}:${h.points}`).join();
    if (got !== want) drift++;
  }
  ok(drift === 0, 'em 40 jogadas a prévia coincide com a rota paga');
}

// ---- 9) Estação: +3 na interação da vez; o trinco fixa a estação
{
  console.log('Cenário 9: estações');
  const piece = (facing: T): TileDef => ({ edges: [T.Grass, T.Grass, T.Grass, facing, T.Grass, T.Grass], seed: 1, quest: null });
  const score = (origin: T, facing: T, extra: Partial<Rules>, fillers = 0) => {
    const b = new Board({ ...DEFAULT_RULES, ...extra, blessings: false, influence: false, wonderStages: 0, eraScores: [0], sites: 0 });
    b.placeRaw(0, 0, { edges: [origin, origin, origin, origin, origin, origin], seed: 1, quest: null }, 0);
    for (let i = 0; i < fillers; i++) b.placeRaw(4, i + 4, land(T.Grass), 0);
    return b.place(1, 0, piece(facing), 0)!.points;
  };
  ok(score(T.Field, T.Grass, {}) === 8, 'primavera: colmeia vale 5+3');
  ok(score(T.Village, T.Forest, {}) === 5, 'primavera: serraria não leva o bônus');
  ok(score(T.Field, T.Grass, { seasonBonus: false }) === 5, 'sem o bônus de estação fica em 5');
  ok(score(T.Village, T.Grass, { seasonLock: 3 }) === 8, 'inverno travado: pasto vale 5+3');
  ok(score(T.Field, T.Grass, { seasonLock: 3 }) === 5, 'inverno travado: colmeia não leva o bônus');
  ok(score(T.Village, T.Field, {}, 20) === 8, 'depois do centro e de 20 peças, a jogada seguinte é verão: moinho vale 5+3');
}

// ---- 10) "Onde encaixa": a 1ª sugestão é a jogada de maior pontuação (oráculo por força bruta)
{
  console.log('Cenário 10: rankMoves');
  type Mv = [number, number, number] | null; // null = descarte
  // Oráculo: refaz a partida do zero por replay e joga de verdade cada (casa, giro); os pontos são os de place().
  const realPoints = (seed: number, hist: Mv[], q: number, r: number, rot: number) => {
    const g = new Game(seed, rules);
    for (const h of hist) {
      if (!h) g.discardIfStuck();
      else {
        g.rot = h[2];
        g.place(h[0], h[1]);
      }
    }
    g.rot = rot;
    return g.place(q, r)?.points ?? null;
  };
  let moments = 0, wrongTop = 0, wrongPts = 0, unstable = 0, mutated = 0;
  for (const seed of [3, 11, 29, 47]) {
    const g = new Game(seed, rules);
    const hist: Mv[] = [];
    const rnd = mulberry32(seed * 7 + 1);
    for (let step = 0; step < 36 && g.current; step++) {
      if (step % 3 === 0) {
        moments++;
        const before = JSON.stringify([g.board.score, g.stack, g.rot, g.board.list.length]);
        const top = g.rankMoves(3);
        if (JSON.stringify([g.board.score, g.stack, g.rot, g.board.list.length]) !== before) mutated++;
        if (JSON.stringify(g.rankMoves(3)) !== JSON.stringify(top)) unstable++;
        let best = -Infinity;
        for (const k of g.board.frontier) {
          const [q, r] = unkey(k);
          for (let rot = 0; rot < 6; rot++) {
            const p = realPoints(seed, hist, q, r, rot);
            if (p !== null && p > best) best = p;
          }
        }
        if (!top.length || top[0].points !== best) wrongTop++;
        for (const m of top) if (realPoints(seed, hist, m.q, m.r, m.rot) !== m.points) wrongPts++;
        if (top.some((m, i) => i > 0 && m.points > top[i - 1].points)) wrongTop++;
        if (new Set(top.map((m) => `${m.q},${m.r}`)).size !== top.length) wrongTop++;
      }
      // Avança com jogadas aleatórias válidas (sem Math.random), para variar os momentos.
      const cells = [...g.board.frontier];
      let done = false;
      for (let tries = 0; tries < 40 && !done; tries++) {
        const [q, r] = unkey(cells[Math.floor(rnd() * cells.length)]);
        g.rot = Math.floor(rnd() * 6);
        if (g.check(q, r)?.valid) {
          hist.push([q, r, g.rot]);
          g.place(q, r);
          done = true;
        }
      }
      if (!done) break;
      if (g.discardIfStuck()) hist.push(null);
    }
  }
  ok(moments >= 40, `${moments} momentos conferidos`);
  ok(wrongTop === 0, 'a 1ª sugestão tem a maior pontuação de todas as casas e giros, em ordem e sem casa repetida');
  ok(wrongPts === 0, 'os pontos de cada sugestão são os que place() paga');
  ok(unstable === 0 && mutated === 0, 'determinística e sem efeito colateral');
}

// ---- 11) Desafio do dia: regra do dia e texto de compartilhar
{
  console.log('Cenário 11: regra do dia e compartilhar');
  ok(dailyRule(20261014) === dailyRule(20261014), 'a mesma data dá a mesma regra');
  ok(dailySeed(new Date(2026, 9, 14)) === 20261014, 'a semente do dia é AAAAMMDD da data local');
  const ids = new Set<string>();
  let repeat = 0;
  for (let i = 0; i < 366; i++) {
    const d = new Date(2026, 0, 1 + i);
    ids.add(dailyRule(dailySeed(d)).id);
    if (i > 0 && dailyRule(dailySeed(d)).id === dailyRule(dailySeed(new Date(2026, 0, i))).id) repeat++;
  }
  ok(ids.size === DAILY_RULES.length, 'ao longo do ano todas as regras aparecem');
  ok(repeat === 0, 'dois dias seguidos nunca têm a mesma regra');
  ok(dailyRule(20261014).id !== dailyRule(20261015).id, 'datas diferentes variam');
  ok(dailyDate(20260230) === null && dailyDate(12345) === null, 'semente que não é data é recusada');
  ok(typeof dailyRule(777).id === 'string' && dailyRule(-5).id !== undefined, 'semente que não é data ainda dá uma regra');
  const daily = MODES.find((m) => m.daily)!;
  ok(JSON.stringify(modeRules(daily, 20261014)) === JSON.stringify(dailyRule(20261014).rules), 'modeRules traz a regra do dia no desafio');
  ok(JSON.stringify(modeRules(MODES[0], 20261014)) === JSON.stringify(MODES[0].rules), 'os outros modos não mudam');

  ok(shareLine(20261014, 1240, [T.Forest, T.Field, T.Village]) === 'Retalhos 14/10 · 1.240 · 🌲🌾🏘', 'texto fixo: Retalhos 14/10 · 1.240 · 🌲🌾🏘');
  ok(shareLine(20260105, 999, [T.Grass, T.Water, T.Rail, T.Forest]) === 'Retalhos 05/01 · 999 · 🌿🌊🚂', 'só três emojis e dia com zero à esquerda');
  ok(shareLine(20261014, 1234567, []) === 'Retalhos 14/10 · 1.234.567', 'sem terrenos não sobra separador');
  ok(shareUrl('https://x.test/Dorf/', 20261014) === 'https://x.test/Dorf/?mode=diario&seed=20261014', 'link com modo e semente');
  const b = new Board({ ...DEFAULT_RULES, matchBonus: { [T.Forest]: 3 } });
  b.placeRaw(0, 0, land(T.Forest), 0);
  b.placeRaw(1, 0, land(T.Forest), 0);
  b.placeRaw(0, 1, land(T.Field), 0);
  b.placeRaw(-1, 1, land(T.Field), 0);
  const tp = terrainPoints(b, { matchPoints: 10, matchBonus: { [T.Forest]: 3 } });
  ok(tp.length === 2 && tp[0][0] === T.Forest && tp[0][1] === 13 && tp[1][0] === T.Field && tp[1][1] === 10, 'terrenos que mais pontuaram: floresta 13, plantação depois');
}

// ---- 12) Colcha: nós de canto montados à mão
{
  console.log('Cenário 12: nós de canto');
  // Canto 0 da casa (0,0): divide com o vizinho da direção 0 (canto 4 dele) e o da direção 5 (canto 2 dele).
  const grass = (seed: number): TileDef => ({ edges: [T.Grass, T.Grass, T.Grass, T.Grass, T.Grass, T.Grass], seed, quest: null });
  // Acha peças A (em (1,0)) e B (em (1,-1)) cujos botões nesse canto têm a cor 0, e a peça N com um giro que mostra cor 0 em seu canto 0.
  let sa = 1, sb = 1;
  while (knotColors(sa)[4] !== 0) sa++;
  while (knotColors(sb)[2] !== 0) sb++;
  let sn = 1, rotOk = -1, rotBad = -1;
  while (rotOk < 0) {
    for (let rot = 0; rot < 6; rot++) {
      const c = rotateCorners(knotColors(sn), rot)[0];
      if (c === 0 && rotOk < 0) rotOk = rot;
      if (c !== 0 && rotBad < 0) rotBad = rot;
    }
    if (rotOk < 0 || rotBad < 0) { sn++; rotOk = -1; rotBad = -1; }
  }
  const make = (knots: number) => {
    const b = new Board({ ...DEFAULT_RULES, knots, influence: false });
    b.placeRaw(1, 0, grass(sa), 0);
    b.placeRaw(1, -1, grass(sb), 0);
    b.computeGroups();
    return b;
  };
  const kc = (rot: number) => rotateCorners(knotColors(sn), rot);
  const edges = grass(sn).edges;
  const b1 = make(15);
  const chk = b1.check(0, 0, edges, kc(rotOk));
  ok(chk.knots.length === 1 && chk.knots[0].corner === 0 && chk.knots[0].color === 0 && chk.wants.length === 0, 'cor igual nas três peças: o canto 0 amarra um nó');
  const chkBad = b1.check(0, 0, edges, kc(rotBad));
  ok(chkBad.knots.length === 0 && chkBad.wants.length === 1 && chkBad.wants[0].color === 0, 'cor diferente: sem nó, e o canto pede a cor 0');
  const res = b1.place(0, 0, grass(sn), rotOk);
  // 2 encaixes de grama (20) + perfeito (20) + nó (15)
  ok(res.points === 55 && res.knots.length === 1 && b1.get(0, 0)!.knots.join() === '0', `a jogada com nó vale 55 (deu ${res.points})`);
  const b2 = make(15);
  const resBad = b2.place(0, 0, grass(sn), rotBad);
  ok(resBad.points === 40 && resBad.knots.length === 0, `a mesma jogada sem nó vale 40 (deu ${resBad.points})`);
  const b0 = make(0);
  const res0 = b0.place(0, 0, grass(sn), rotOk);
  ok(res0.points === 40 && res0.knots.length === 0 && b0.get(0, 0)!.corners.length === 0, 'fora da Colcha (knots 0) o nó não existe e a jogada vale 40');
  // Sem a terceira peça no canto (só um vizinho), não há nó.
  const single = new Board({ ...DEFAULT_RULES, knots: 15 });
  single.placeRaw(1, 0, grass(sa), 0);
  ok(single.check(0, 0, edges, kc(rotOk)).knots.length === 0, 'canto com só uma vizinha não amarra');
  // A prévia (clone) não amarra nada no tabuleiro de verdade.
  const g = new Game(5, { ...DEFAULT_RULES, knots: 15 });
  const before = g.board.list.length;
  const m = g.bestMove(() => 0.5)!;
  g.rot = m.rot;
  const pv = g.preview(m.q, m.r)!;
  ok(g.board.list.length === before && pv.points > 0 && g.board.list.every((p) => p.knots.length === 0), 'prévia não mexe nos nós do tabuleiro');
}

console.log(bad ? `\n${bad} FALHA(S)` : '\nTodos os cenários sintéticos passaram');
process.exit(bad ? 1 : 0);
