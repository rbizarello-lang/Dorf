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
import { tileProfile } from '../src/core/relief';
import { isSpring } from '../src/core/water';
import { smearComp } from '../src/core/terra';

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

// ---- 12) Águas que descem (modo Relevo): a água só desce; a nascente abre o curso, o mar paga, a subida fica parada.
{
  console.log('Cenário 12: águas que descem');
  const relevo = MODES.find((m) => m.id === 'relevo')!;
  const R: Rules = { ...DEFAULT_RULES, ...relevo.rules, startTiles: 1 };
  const G = T.Grass, W = T.Water;
  /** Uma peça com estas bordas, nível de rio e nascente (ou não): procura a semente pelo gerador do núcleo. */
  const def = (edges: T[], level: number, spring: boolean): TileDef => {
    for (let seed = 1; seed < 20000; seed++) if (tileProfile(edges, seed).h[0] === level && isSpring(seed, edges, level) === spring) return { edges, seed, quest: null };
    throw new Error('sem semente');
  };
  const start = (rules: Rules) => {
    const b = new Board(rules);
    b.placeRaw(0, 0, land(G), 0);
    b.computeGroups();
    return b;
  };
  const src = def([W, G, G, G, G, G], 1, true);
  const straight = (lv: number) => def([W, G, G, W, G, G], lv, false);
  const lake = def([W, W, W, W, G, G], 1, false);
  const b = start(R);
  const r1 = b.place(1, 0, src, 0);
  ok(r1.water?.spring === true && r1.water.flowing === 1 && r1.water.points === 8, `nascente no nível 1 já corre: +8 (${r1.water?.points})`);
  const r2 = b.place(2, 0, straight(1), 0);
  ok(r2.water?.flowing === 1 && r2.water.points === 8, 'rio no mesmo nível, ligado à nascente: +8');
  const chk = b.checkDef(3, 0, straight(2), 0);
  ok(chk.valid && chk.water?.flows === false && chk.water.gain === 0, 'rio um nível acima do curso: jogada válida, água parada, vale 0');
  const r3 = b.place(3, 0, straight(2), 0);
  ok(r3.water?.flowing === 0 && r3.water.points === 0 && b.waterNow().flow.size === 2, 'rio que sobe não ganha pontos nem muda o curso');
  // Outra partida: a nascente, um rio e o lago (mar) no fim do curso.
  const c = start(R);
  c.place(1, 0, src, 0);
  c.place(2, 0, straight(1), 0);
  const pre = c.checkDef(3, 0, lake, 0);
  ok(pre.water?.sea === true && pre.water.gain === 8 + 60, `a prévia do lago já mostra o mar: +68 (${pre.water?.gain})`);
  const r4 = c.place(3, 0, lake, 0);
  ok(r4.water?.seas === 1 && r4.water.points === 68 && r4.tilesGained >= R.seaTiles, 'chegar ao mar: +8 da peça, +60 e 2 peças');
  const r5 = c.place(3, 1, straight(1), 0);
  ok((r5.water?.seas ?? 0) === 0, 'o mar paga uma vez por nascente');
  // O curso é função do tabuleiro: refazer as mesmas jogadas dá o mesmo estado, e o modo Clássico não paga água.
  const again = start(R);
  again.place(1, 0, src, 0);
  again.place(2, 0, straight(1), 0);
  again.place(3, 0, lake, 0);
  ok(JSON.stringify([...again.waterNow().flow]) === JSON.stringify([...c.waterNow().flow].slice(0, 3)) || again.waterNow().flow.size === 3, 'a água corrente se refaz igual (replay)');
  const classic = start({ ...DEFAULT_RULES, startTiles: 1 });
  const rc = classic.place(1, 0, src, 0);
  ok(rc.water === undefined && classic.waterNow().flow.size === 0, 'fora do Relevo não há nascente nem pontos de água');
}

// ---- 13) Nascentes escondidas: a casa só se revela com uma peça de água ao lado; o rio que pousa nela vira a nascente.
{
  console.log('Cenário 13: nascentes escondidas');
  const relevo = MODES.find((m) => m.id === 'relevo')!;
  const R: Rules = { ...DEFAULT_RULES, ...relevo.rules, startTiles: 1 };
  const G = T.Grass, W = T.Water;
  const def = (edges: T[], level: number): TileDef => {
    for (let seed = 1; seed < 20000; seed++) if (tileProfile(edges, seed).h[0] === level && !isSpring(seed, edges, level)) return { edges, seed, quest: null };
    throw new Error('sem semente');
  };
  const start = () => {
    const b = new Board(R);
    b.placeRaw(0, 0, land(G), 0);
    b.computeGroups();
    b.springSites = [{ q: 2, r: 0 }, { q: -3, r: 0 }];
    return b;
  };
  const b = start();
  ok(b.revealedSprings().length === 0, 'nenhuma nascente escondida aparece sozinha');
  b.place(1, 0, def([W, G, G, G, G, G], 1), 0);
  ok(JSON.stringify(b.revealedSprings()) === JSON.stringify([{ q: 2, r: 0 }]), 'a peça de água ao lado revela a casa (e só ela)');
  const pre = b.checkDef(2, 0, def([W, G, G, W, G, G], 1), 0);
  ok(pre.water?.hidden === true && pre.water.spring === true && pre.water.gain === 2 * R.flowPoints + R.hiddenSpringPoints, `a prévia mostra a nascente escondida: +${2 * R.flowPoints + R.hiddenSpringPoints} (${pre.water?.gain})`);
  const r = b.place(2, 0, def([W, G, G, W, G, G], 1), 0);
  ok(r.placed.spring === true && r.placed.hiddenSpring === true && r.water?.hidden === true && r.water.points === 2 * R.flowPoints + R.hiddenSpringPoints, `o rio sobre a casa vira nascente e rende +${R.hiddenSpringPoints}: ${r.water?.points}`);
  ok(b.revealedSprings().length === 0, 'a casa ocupada some da lista das reveladas');
  // Rio no nível 0 não vira nascente (a água nasce no alto); terra sobre a casa a perde sem pontos; a casa longe da água não se revela.
  const c = start();
  c.place(1, 0, def([W, G, G, G, G, G], 1), 0);
  const low = c.checkDef(2, 0, def([W, G, G, W, G, G], 0), 0);
  ok(low.water?.hidden === false && low.water.spring === false, 'rio no nível 0 sobre a casa não é nascente');
  const d = start();
  const rl = d.place(1, 0, land(G), 0);
  ok(rl.water === undefined && d.revealedSprings().length === 0, 'terra ao lado não revela nada');
  // Preservada pelo clone (a prévia da jogada) e a mesma para quem refaz as jogadas.
  const cl = b.clone();
  ok(JSON.stringify(cl.springSites) === JSON.stringify(b.springSites) && cl.get(2, 0)?.hiddenSpring === true, 'o clone guarda as nascentes escondidas e a que foi achada');
}

// ---- 14) Terra contínua: fechar manchas de 1, 3 e 7 peças, a peça de volta (e seus limites) e a umidade que chega só às peças de antes.
{
  console.log('Cenário 14: Terra contínua');
  const terra = MODES.find((m) => m.id === 'terra')!;
  ok(terra.more === true && terra.rules.terra === true && !MODES.some((m) => m.id !== 'terra' && m.rules.terra), 'o modo Terra contínua existe, fica em "Mais modos" e só ele liga a regra');
  const R: Rules = { ...DEFAULT_RULES, ...terra.rules, eraScores: [0], blessings: false, influence: false, seasonBonus: false, sites: 0 };
  const G = T.Grass, F = T.Forest, Fi = T.Field, W = T.Water;
  const start = (extra: Partial<Rules> = {}) => {
    const b = new Board({ ...R, ...extra }, 7);
    b.placeRaw(0, 0, land(G), 0);
    b.computeGroups();
    return b;
  };
  /** A fórmula do fechamento, escrita aqui à parte: 20·a^1,5·forma, forma = 0,55 + 0,45·min(1, 6√a/P). */
  const closeValue = (a: number, perimeter: number) => Math.round(20 * a ** 1.5 * (0.55 + 0.45 * Math.min(1, (6 * Math.sqrt(a)) / perimeter)));
  /** Põe a mancha de `forest` (terreno Mata) e depois cerca com `ring` (Prado): devolve o resultado de cada jogada do cerco. */
  const enclose = (b: Board, patch: [number, number][], ring: [number, number][]) => {
    for (const [q, r] of patch) b.place(q, r, land(F), 0);
    return ring.map(([q, r]) => b.place(q, r, land(G), 0));
  };

  // Mancha de 1 peça: 20 pontos e 1 peça de volta, só na jogada que fecha a sexta borda.
  {
    const b = start();
    const res = enclose(b, [[1, 0]], [[0, 1], [1, 1], [2, 0], [1, -1], [2, -1]]);
    const last = res[res.length - 1];
    ok(res.slice(0, -1).every((x) => x.terra!.closedPatches === 0 && x.terra!.closePoints === 0), 'mancha de 1: antes da última borda nada fecha');
    ok(last.terra!.closedPatches === 1 && last.terra!.closePoints === closeValue(1, 6) && last.terra!.closePoints === 20, `mancha de 1 fecha: +${last.terra!.closePoints} (20)`);
    ok(last.terra!.backTiles === 1 && last.tilesGained === 1, `mancha de 1: devolve 1 peça (${last.terra!.backTiles}, ganhas ${last.tilesGained})`);
  }
  // Mancha de 3 peças (triângulo): perímetro 12.
  {
    const b = start();
    const res = enclose(b, [[1, 0], [2, -1], [2, 0]], [[0, 1], [1, 1], [1, -1], [3, -1], [3, -2], [2, -2], [3, 0], [2, 1]]);
    const last = res[res.length - 1];
    ok(res.slice(0, -1).every((x) => x.terra!.closedPatches === 0), 'mancha de 3: só a última jogada do cerco fecha');
    ok(last.terra!.closedPatches === 1 && last.terra!.closePoints === closeValue(3, 12), `mancha de 3 fecha: +${last.terra!.closePoints} (${closeValue(3, 12)})`);
    ok(last.terra!.backTiles === 1, 'mancha de 3: devolve 1 peça');
  }
  // Mancha de 7 peças (flor): perímetro 18.
  {
    const b = start();
    const ring2: [number, number][] = [[0, 1], [1, -1], [4, 0], [2, 2], [0, 2], [2, -2], [4, -2], [3, 1], [1, 2], [3, -2], [4, -1]];
    const res = enclose(b, [[1, 0], [1, 1], [2, 0], [2, -1], [2, 1], [3, 0], [3, -1]], ring2);
    const last = res[res.length - 1];
    ok(res.slice(0, -1).every((x) => x.terra!.closedPatches === 0), 'mancha de 7: só a última jogada do cerco fecha');
    ok(last.terra!.closedPatches === 1 && last.terra!.closePoints === Math.min(R.terraCloseCap, closeValue(7, 18)) && closeValue(7, 18) === 351, `mancha de 7 fecha: +${last.terra!.closePoints} (351 sem teto, teto de ${R.terraCloseCap})`);
    ok(last.terra!.backTiles === 1, 'mancha de 7: devolve 1 peça');
    {
      const c = start({ terraCloseCap: 0 });
      const free = enclose(c, [[1, 0], [1, 1], [2, 0], [2, -1], [2, 1], [3, 0], [3, -1]], ring2).pop()!;
      ok(free.terra!.closePoints === 351, `sem teto a mancha de 7 paga ${free.terra!.closePoints} (351)`);
    }
    ok(closeValue(7, 18) > 15 * closeValue(1, 6), 'o prêmio cresce mais que linear com a área (a de 7 vale mais de 15 vezes a de 1)');
  }
  // Limites da peça de volta: área mínima e teto por partida mudam só as peças, nunca os pontos.
  {
    const single: [number, number][] = [[0, 1], [1, 1], [2, 0], [1, -1], [2, -1]];
    const b = start({ terraBackMin: 2 });
    const one = enclose(b, [[1, 0]], single).pop()!;
    ok(one.terra!.closePoints === 20 && one.terra!.backTiles === 0 && one.tilesGained === 0, 'área mínima 2: a mancha de 1 fecha e paga, mas não devolve peça');
    const c = start({ terraBackMin: 2 });
    const tri = enclose(c, [[1, 0], [2, -1], [2, 0]], [[0, 1], [1, 1], [1, -1], [3, -1], [3, -2], [2, -2], [3, 0], [2, 1]]).pop()!;
    ok(tri.terra!.backTiles === 1, 'área mínima 2: a mancha de 3 devolve peça');
    const d = start({ terraBackCap: 1 });
    const first = enclose(d, [[1, 0]], single).pop()!;
    const second = enclose(d, [[-1, 0]], [[-1, 1], [-2, 1], [-2, 0], [-1, -1], [0, -1]]).pop()!;
    ok(first.terra!.backTiles === 1 && second.terra!.closedPatches === 1 && second.terra!.closePoints === 20 && second.terra!.backTiles === 0, `teto de 1 peça por partida: a segunda mancha paga ${second.terra!.closePoints} e devolve ${second.terra!.backTiles}`);
  }
  // Umidade: a água que chega paga às peças de antes (8 na faixa, 11 no meio), nunca à peça nova, e só uma vez.
  {
    const b = start();
    b.place(0, 1, land(Fi), 0);
    b.place(1, 1, land(Fi), 0);
    const river: TileDef = { edges: [W, F, F, F, F, F], seed: 3, quest: null };
    const r = b.place(1, 0, river, 0);
    // Os dois campos estão a 1 casa da água (0,7) e o rio é mata (0,1 de bônus): 0,8, no limite da faixa 0,5 a 0,8, fora do meio: 8 cada um.
    ok(r.terra!.moisture === 16, `a água chega a 2 campos que já estavam lá: +16 (${r.terra!.moisture})`);
    ok(b.get(1, 0)!.moist === 8 && r.terra!.moisture === 16, 'a peça nova de rio e mata guarda os 8 dela como pagos, mas não os recebe');
    ok(b.get(0, 1)!.moist === 8 && b.get(1, 1)!.moist === 8, 'cada campo antigo guarda o que já rendeu');
    const f = b.place(0, 2, land(F), 0);
    ok(f.terra!.moisture === 0 && b.get(0, 1)!.moist === 8, 'mais mata perto não paga de novo (a umidade só rende a diferença para cima)');
  }
  // Campo: cada borda soma 1, o rio fica puro e a peça de um terreno só não se mistura.
  {
    let okSum = true, okPure = true, okRange = true;
    for (let seed = 1; seed <= 300; seed++) {
      const g = generateTile(mulberry32(seed), false, 0.3, 0.2);
      const comp = smearComp(g.edges, g.seed);
      g.edges.forEach((e, i) => {
        const sum = comp[i].reduce((x, y) => x + y, 0);
        if (e === T.Water || e === T.Rail) {
          if (sum !== 0) okPure = false;
        } else if (Math.abs(sum - 1) > 1e-9 || comp[i].some((v) => v < -1e-9 || v > 1 + 1e-9)) okSum = false;
        // Uma borda de terra mistura no máximo 2 × 0,30 com as vizinhas, e nunca vira outro terreno.
        if (e !== T.Water && e !== T.Rail && comp[i][e] < 1 - 0.6 - 1e-9) okRange = false;
      });
    }
    ok(okSum && okPure && okRange, 'campo: bordas de terra somam 1 (entre 0 e 1), rio e trilho ficam em 0, a mistura tira no máximo 0,6 do terreno da borda');
    const u = smearComp(land(F).edges, 5);
    ok(u.every((c) => Math.abs(c[F] - 1) < 1e-9), 'peça de um terreno só não se mistura');
    ok(JSON.stringify(smearComp([G, F, Fi, G, F, T.Village], 99)) === JSON.stringify(smearComp([G, F, Fi, G, F, T.Village], 99)), 'o campo é só da semente da peça');
  }
  // Fora do modo, nada muda: o resultado não traz a regra nova e a peça não guarda campo.
  {
    const b = new Board({ ...DEFAULT_RULES, eraScores: [0] }, 7);
    b.placeRaw(0, 0, land(G), 0);
    b.computeGroups();
    const r = b.place(1, 0, land(F), 0);
    ok(r.terra === undefined && b.get(1, 0)!.comp === undefined, 'fora da Terra contínua o resultado e a peça não trazem nada da regra');
  }
}

console.log(bad ? `\n${bad} FALHA(S)` : '\nTodos os cenários sintéticos passaram');
process.exit(bad ? 1 : 0);
