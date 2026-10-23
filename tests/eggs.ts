// Easter eggs genéricos (src/core/eggs.ts): gatilhos de peça (peças, grupo, bordas, sorte) reavaliados na
// ordem das peças, gatilhos de relógio (hora, data), determinismo do replay e um oráculo de grupos
// independente (BFS sobre o tabuleiro de verdade, sem a união incremental do rastreador).
import { DEFAULT_RULES, type Board, type Placed } from '../src/core/board';
import { Game } from '../src/core/game';
import { DIRS, opposite } from '../src/core/hex';
import { mulberry32 } from '../src/core/rng';
import { isStrict, T } from '../src/core/tiles';
import { THEMES } from '../src/themes/themes';
import { clockEggs, EggTracker, eggRoll, hourOf, inHours, inHoliday, isClockEgg, isTileEgg, phaseOfTod, type EggSpec, type EggTile } from '../src/core/eggs';

let fails = 0;
const ok = (c: boolean, msg: string) => {
  if (!c) {
    fails++;
    console.error('FALHOU:', msg);
  }
};

const tile = (index: number, q: number, r: number, edges: T[], seed = 1): EggTile => ({ index, q, r, edges, seed });
const FFFFFF = [T.Forest, T.Forest, T.Forest, T.Forest, T.Forest, T.Forest];
const spec = (id: string, when: EggSpec['when'], extra: Partial<EggSpec> = {}): EggSpec => ({ id, name: id, when, effect: [{ kind: 'som', sound: 'brilho' }], ...extra });

// --- horas e datas (sempre com Date local, como o jogo usa)
ok(inHours(23, 22, 2) && inHours(1.5, 22, 2) && !inHours(2, 22, 2) && !inHours(12, 22, 2), 'horas atravessam a meia-noite');
ok(inHours(12, 12, 13) && !inHours(13, 12, 13) && !inHours(11.99, 12, 13), 'hora: [from, to)');
ok(hourOf(new Date(2026, 5, 12, 20, 30)) === 20.5, 'hourOf soma os minutos');
const jun = { month: 6, day: 12, until: { month: 6, day: 30 } };
ok(inHoliday(new Date(2026, 5, 12), jun) && inHoliday(new Date(2026, 5, 24), jun) && inHoliday(new Date(2026, 5, 30), jun), 'São João: 12 a 30 de junho valem (pontas incluídas)');
ok(!inHoliday(new Date(2026, 5, 11), jun) && !inHoliday(new Date(2026, 6, 1), jun), 'São João: 11/6 e 1/7 não valem');
const natal = { month: 12, day: 20, until: { month: 1, day: 6 } };
ok(inHoliday(new Date(2026, 11, 25), natal) && inHoliday(new Date(2027, 0, 3), natal) && !inHoliday(new Date(2026, 5, 3), natal) && !inHoliday(new Date(2026, 11, 19), natal), 'período que vira o ano');
ok(inHoliday(new Date(2026, 3, 27), { month: 4, day: 27 }) && !inHoliday(new Date(2026, 3, 28), { month: 4, day: 27 }), 'dia único (sem until)');
ok(phaseOfTod('dawn') === 'dia' && phaseOfTod('aurora') === 'dia' && phaseOfTod('day') === 'dia' && phaseOfTod('golden') === 'tarde' && phaseOfTod('dusk') === 'tarde' && phaseOfTod('night') === 'noite', 'fase do dia pela hora do jogo');

// --- sorte: determinística, uniforme e independente por ovo
{
  const a = eggRoll(12345, 'x'), b = eggRoll(12345, 'x'), c = eggRoll(12345, 'y');
  ok(a === b, 'o mesmo ovo e a mesma semente dão o mesmo número');
  ok(a !== c, 'ovos diferentes sorteiam diferente na mesma peça');
  const r = mulberry32(7);
  let hit = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) if (eggRoll(Math.floor(r() * 4294967296), 'sorte') < 0.05) hit++;
  ok(hit / n > 0.04 && hit / n < 0.06, `chance 5% sai perto de 5% (${((100 * hit) / n).toFixed(2)}%)`);
  ok([...Array(50)].every((_, i) => { const v = eggRoll(i * 977, 'z'); return v >= 0 && v < 1; }), 'o sorteio fica em [0, 1)');
}

// --- peças: a n-ésima, com e sem `min`
{
  const t = new EggTracker([spec('exata', [{ kind: 'pecas', n: 3 }]), spec('daqui', [{ kind: 'pecas', n: 3, min: true }], { once: true }), spec('daqui2', [{ kind: 'pecas', n: 3, min: true }])]);
  const got: string[][] = [];
  for (let i = 0; i < 5; i++) got.push(t.add(tile(i, i, 0, FFFFFF)).map((h) => h.egg.id));
  ok(got.map((g) => g.join()).join('|') === '||exata,daqui,daqui2|daqui2|daqui2', `pecas: exata só na 3ª; min a partir dela; once só uma vez (${got.map((g) => g.join('+')).join('|')})`);
  let threw = false;
  try {
    t.add(tile(9, 9, 0, FFFFFF));
  } catch {
    threw = true;
  }
  ok(threw, 'peça fora de ordem é recusada');
  t.reset();
  ok(t.add(tile(0, 0, 0, FFFFFF)).length === 0 && t.count === 1, 'reset recomeça a contagem');
}

// --- bordas: contagem mínima e máxima, e combinação (E)
{
  const e = [spec('seis-prados', [{ kind: 'bordas', terrain: T.Grass, min: 6 }]), spec('rio-e-vila', [{ kind: 'bordas', terrain: T.Water, min: 2, max: 2 }, { kind: 'bordas', terrain: T.Village, min: 1 }])];
  const t = new EggTracker(e);
  const ids = (edges: T[], i: number) => t.add(tile(i, i, 0, edges)).map((h) => h.egg.id).join();
  ok(ids([T.Grass, T.Grass, T.Grass, T.Grass, T.Grass, T.Grass], 0) === 'seis-prados', 'hexágono perfeito de prado');
  ok(ids([T.Grass, T.Grass, T.Grass, T.Grass, T.Grass, T.Forest], 1) === '', '5 de 6 não basta');
  ok(ids([T.Water, T.Village, T.Water, T.Grass, T.Grass, T.Forest], 2) === 'rio-e-vila', 'combinação: 2 bordas de rio e uma de vila');
  ok(ids([T.Water, T.Water, T.Water, T.Village, T.Grass, T.Forest], 3) === '', 'combinação: 3 de rio passa do máximo');
  ok(ids([T.Water, T.Water, T.Forest, T.Grass, T.Grass, T.Forest], 4) === '', 'combinação: falta a vila');
}

// --- sorte por peça: mesma semente = mesmo resultado, em qualquer ordem de avaliação
{
  const e = [spec('raro', [{ kind: 'sorte', chance: 0.1 }])];
  const run = () => {
    const t = new EggTracker(e);
    const r = mulberry32(99);
    const out: number[] = [];
    for (let i = 0; i < 400; i++) if (t.add(tile(i, i, 0, FFFFFF, Math.floor(r() * 4294967296))).length) out.push(i);
    return out;
  };
  const a = run(), b = run();
  ok(a.length > 20 && a.length < 60, `sorte 10% em 400 peças (${a.length})`);
  ok(a.join() === b.join(), 'sorte: o replay dá as mesmas peças');
}

// --- grupo: dispara na peça que completa o grupo, uma vez, e não de novo quando ele cresce ou se funde
{
  const e = [spec('mata', [{ kind: 'grupo', terrain: T.Forest, min: 3 }])];
  const t = new EggTracker(e);
  const F = [T.Forest, T.Forest, T.Forest, T.Forest, T.Forest, T.Forest];
  const G = [T.Grass, T.Grass, T.Grass, T.Grass, T.Grass, T.Grass];
  // Linha de 3 peças de mata em (0,0), (1,0), (2,0): o grupo chega a 3 na terceira.
  ok(t.add(tile(0, 0, 0, F)).length === 0, 'grupo: 1 peça não basta');
  ok(t.add(tile(1, 1, 0, F)).length === 0, 'grupo: 2 peças não bastam');
  ok(t.add(tile(2, 2, 0, F)).length === 1, 'grupo: a 3ª peça completa');
  ok(t.add(tile(3, 3, 0, F)).length === 0, 'grupo: crescer não repete');
  // Outro grupo, separado por prado: dispara de novo quando chega a 3.
  ok(t.add(tile(4, 0, 5, G)).length === 0, 'grupo: peça de outro terreno não conta');
  ok(t.add(tile(5, 0, 8, F)).length === 0 && t.add(tile(6, 1, 7, F)).length === 0 && t.add(tile(7, 2, 6, F)).length === 1, 'grupo: um segundo grupo separado dispara a sua vez');
  // Fundir os dois grupos disparados com uma peça de ponte não repete o ovo.
  const bridge = [T.Forest, T.Forest, T.Forest, T.Forest, T.Forest, T.Forest];
  const merged = t.add(tile(8, 3, 5, bridge)).length + t.add(tile(9, 3, 6, bridge)).length;
  ok(merged === 0, `grupo: fundir grupos já disparados não repete (${merged})`);
}

// --- grupo: uma peça com mata em dois pedaços separados (rio no meio) não junta os pedaços
{
  const e = [spec('mata2', [{ kind: 'grupo', terrain: T.Forest, min: 2 }])];
  const t = new EggTracker(e);
  const split = [T.Forest, T.Water, T.Forest, T.Water, T.Grass, T.Grass];
  ok(t.add(tile(0, 0, 0, split)).length === 0, 'peça com mata em dois pedaços não forma grupo sozinha');
}

// --- relógio: hora, data e peças `min` (E)
{
  const noite = spec('ronda', [{ kind: 'hora', from: 22, to: 2 }, { kind: 'pecas', n: 30, min: true }]);
  const dia27 = spec('rei', [{ kind: 'data' }], { holidays: [{ month: 4, day: 27 }] });
  const misto = spec('misto', [{ kind: 'hora', from: 0, to: 24 }, { kind: 'sorte', chance: 1 }]);
  ok(isClockEgg(noite) && isClockEgg(dia27) && !isTileEgg(noite) && !isTileEgg(misto), 'classifica ovos de relógio e de peça');
  const all = [noite, dia27, misto];
  const ids = (d: Date, tiles: number) => clockEggs(all, d, tiles).map((s) => s.id).join();
  ok(ids(new Date(2026, 3, 27, 23, 0), 40) === 'ronda,rei', 'noite de 27/4 com 40 peças: os dois');
  ok(ids(new Date(2026, 3, 27, 23, 0), 10) === 'rei', 'poucas peças: sem a ronda');
  ok(ids(new Date(2026, 3, 28, 1, 0), 40) === 'ronda', 'madrugada fora da data: só a ronda');
  ok(ids(new Date(2026, 3, 28, 12, 0), 40) === '', 'meio-dia fora da data: nada');
  ok(!ids(new Date(2026, 3, 28, 1, 0), 40).includes('misto'), 'gatilho de peça misturado com relógio nunca dispara');
  // O rastreador ignora os ovos de relógio.
  const t = new EggTracker(all);
  ok(t.add(tile(0, 0, 0, FFFFFF)).length === 0, 'o rastreador ignora ovos de relógio e mistos');
}

// --- partida de verdade: o rastreador acompanha os grupos do tabuleiro (oráculo por BFS) e reproduz igual
{
  const orig = Math.random;
  const MIN = 7;
  const terrains = [T.Forest, T.Grass, T.Field, T.Village];
  const eggs = terrains.map((terr) => spec(`g${terr}`, [{ kind: 'grupo', terrain: terr, min: MIN }]));
  const play = (seed: number) => {
    Math.random = mulberry32(5); // o desempate da IA gulosa usa Math.random: o mesmo em cada partida
    const game = new Game(seed, { ...DEFAULT_RULES, startTiles: 160 }, []);
    const tracker = new EggTracker(eggs);
    const fired: string[] = [];
    const firstAt = new Map<string, number>();
    for (let i = 0; game.board.list.length < 160 && i < 400; i++) {
      const m = game.bestMove();
      if (!m) break;
      game.rot = m.rot;
      const res = game.place(m.q, m.r);
      if (!res) break;
      const p = res.placed;
      // Alimenta o rastreador com as peças novas, na ordem (a inicial entra antes da primeira jogada).
      while (tracker.count < game.board.list.length) {
        const t = game.board.list[tracker.count];
        for (const h of tracker.add({ q: t.q, r: t.r, index: t.index, edges: t.edges, seed: t.def.seed })) {
          const terr = Number(h.egg.id.slice(1)) as T;
          if (bfsLargest(game.board, terr) < MIN) fail(`disparou ${h.egg.id} na peça ${t.index}, mas o maior grupo do terreno tem menos de ${MIN}`);
          fired.push(`${h.egg.id}@${t.index}`);
          if (!firstAt.has(h.egg.id)) firstAt.set(h.egg.id, t.index);
        }
      }
      // Oráculo: o maior grupo de cada terreno (BFS no tabuleiro) quando a peça `p` foi posta.
      for (const terr of terrains) {
        if (firstAt.has(`g${terr}`)) continue;
        if (bfsLargest(game.board, terr) >= MIN) {
          fail(`terreno ${terr} chegou a ${MIN} na peça ${p.index} e o rastreador não disparou`);
          firstAt.set(`g${terr}`, -1);
        }
      }
    }
    return { fired, firstAt, board: game.board };
  };
  const fail = (m: string) => ok(false, m);
  const a = play(11);
  ok(a.fired.length > 0, `a partida de 160 peças dispara algum grupo de ${MIN} (${a.fired.length})`);
  // Cada disparo é a peça que levou o grupo a MIN: logo, antes dela o maior grupo do terreno era menor.
  const b = play(11);
  ok(a.fired.join() === b.fired.join(), 'o replay da mesma semente dispara os mesmos ovos nas mesmas peças');
  // Reavaliar do zero sobre a lista final dá o mesmo resultado (carregar o save / desfazer).
  const t2 = new EggTracker(eggs);
  const again: string[] = [];
  for (const t of a.board.list) for (const h of t2.add({ q: t.q, r: t.r, index: t.index, edges: t.edges, seed: t.def.seed })) again.push(`${h.egg.id}@${t.index}`);
  ok(again.join() === a.fired.join(), 'reavaliar a lista final dá os mesmos ovos que jogar peça a peça');
  Math.random = orig;
}

/** Maior grupo de peças do terreno, por BFS sobre as arestas (independente da união do rastreador). */
function bfsLargest(board: Board, terr: T): number {
  // Nó = (peça, setor). Setores vizinhos do mesmo terreno se ligam dentro da peça (rio e trilho se ligam todos
  // pelo centro) e atravessam a aresta quando a peça vizinha tem o mesmo terreno do outro lado.
  const seen = new Set<string>();
  let best = 0;
  const key = (p: Placed, s: number) => `${p.index}:${s}`;
  for (const p of board.list) {
    for (let s0 = 0; s0 < 6; s0++) {
      if (p.edges[s0] !== terr || seen.has(key(p, s0))) continue;
      const tiles = new Set<number>();
      const stack: [Placed, number][] = [[p, s0]];
      seen.add(key(p, s0));
      while (stack.length) {
        const [t, s] = stack.pop()!;
        tiles.add(t.index);
        const next: [Placed, number][] = [];
        for (let s2 = 0; s2 < 6; s2++) {
          if (s2 === s || t.edges[s2] !== terr) continue;
          if (isStrict(terr) || s2 === (s + 1) % 6 || s2 === (s + 5) % 6) next.push([t, s2]);
        }
        const nb = board.get(t.q + DIRS[s][0], t.r + DIRS[s][1]);
        if (nb && nb.edges[opposite(s)] === terr) next.push([nb, opposite(s)]);
        for (const [n, ns] of next) if (!seen.has(key(n, ns))) (seen.add(key(n, ns)), stack.push([n, ns]));
      }
      best = Math.max(best, tiles.size);
    }
  }
  return best;
}

// --- os ovos que os temas trazem: gatilhos válidos e ids únicos
for (const th of THEMES) {
  const eggs = th.eggs ?? [];
  ok(new Set(eggs.map((e) => e.id)).size === eggs.length, `${th.id}: ids de ovos únicos`);
  for (const e of eggs) {
    ok(e.when.length > 0 && e.effect.length > 0, `${th.id}/${e.id}: tem gatilho e efeito`);
    ok(!(isClockEgg(e) && e.effect.some((x) => x.kind === 'kit')), `${th.id}/${e.id}: kit na peça não vale com gatilho de relógio`);
    ok(!e.when.some((w) => w.kind === 'data') || (e.holidays?.length ?? 0) > 0, `${th.id}/${e.id}: gatilho de data pede holidays`);
    for (const w of e.when) if (w.kind === 'sorte') ok(w.chance > 0 && w.chance <= 1, `${th.id}/${e.id}: chance entre 0 e 1`);
  }
}

if (fails) {
  console.error(`${fails} falha(s) nos easter eggs.`);
  process.exit(1);
}
console.log('Easter eggs OK.');
