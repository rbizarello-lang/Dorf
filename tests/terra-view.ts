// Terra contínua, Fase 3: o cache incremental das manchas e o que o fantasma mostra (contorno, bordas abertas, fechamento, umidade).
// Confere, em partidas inteiras do modo `terra`:
//   1. o cache (`PatchCache`) dá o mesmo campo que o `patchField` refeito do zero, a cada jogada e em cada prévia candidata;
//   2. a mancha da `patchViews` (área, bordas para o vazio, fecha) bate com uma busca em largura escrita aqui, sem usar o código testado;
//   3. `terraView` e as candidatas não mudam o tabuleiro de verdade, e os contornos de um pouso que fecha são de manchas que de fato fecham;
//   4. a prévia (clone) dá os mesmos pontos que a jogada de verdade.
import { DEFAULT_RULES, type Rules } from '../src/core/board';
import { Game } from '../src/core/game';
import { DIRS, opposite, unkey } from '../src/core/hex';
import { modeById, modeRules } from '../src/core/modes';
import { patchField, patchViews } from '../src/core/terra';
import { THEMES } from '../src/themes/themes';

const N = Number(process.argv[2] ?? 12);
const fails: string[] = [];
const fail = (m: string) => { if (fails.length < 30) fails.push(m); };
let moves = 0, cands = 0, views = 0, closing = 0, groupViews = 0;

for (let seed = 1; seed <= N && fails.length < 30; seed++) {
  const theme = THEMES[seed % THEMES.length];
  const rules: Rules = { ...DEFAULT_RULES, ...theme.rules, ...modeRules(modeById('terra'), seed) };
  const g = new Game(seed, rules, []);
  let guard = 0;
  while (g.current && guard++ < 400 && fails.length < 30) {
    const b = g.board;
    // 1. o cache do tabuleiro de verdade
    const full = patchField(b, rules.terraBackMin, rules.terraCloseCap);
    const inc = b.patches!.read(rules.terraBackMin, rules.terraCloseCap);
    if (JSON.stringify(full) !== JSON.stringify(inc)) fail(`seed ${seed} jogada ${moves}: cache ${JSON.stringify(inc)} x refeito ${JSON.stringify(full)}`);
    // Algumas candidatas: cache da cópia e a vista contra a busca em largura.
    if (moves % 5 === 2) {
      const snap = () => JSON.stringify([b.list.length, b.score, b.terraBest, b.patches!.n, b.frontier.size, Array.from(b.patches!.mass.subarray(0, b.patches!.n)), b.list.map((t) => t.moist)]);
      const before = snap();
      let k = 0;
      for (const key of b.frontier) {
        if (k++ > 12) break;
        const [q, r] = unkey(key);
        for (let rot = 0; rot < 6; rot++) {
          g.rot = rot;
          if (!g.check(q, r)?.valid) continue;
          cands++;
          const c = b.clone();
          const p = c.placeRaw(q, r, g.current!, rot);
          const a = patchField(c, rules.terraBackMin, rules.terraCloseCap), z = c.patches!.read(rules.terraBackMin, rules.terraCloseCap);
          if (JSON.stringify(a) !== JSON.stringify(z)) fail(`seed ${seed}: candidata ${q},${r},${rot}: cache ${JSON.stringify(z)} x refeito ${JSON.stringify(a)}`);
          for (const v of patchViews(c, c.patches!, p, { w: b, cache: b.patches! }, 80)) {
            views++;
            // A peça pode ter duas manchas do mesmo terreno (setores separados): a vista tem de bater com alguma das componentes da busca em largura.
            const openSegs = v.segs.filter((s) => s.open && !s.ray).length;
            let hit = false;
            for (let first = 0; first < 6 && !hit; first++) {
              if (p.edges[first] !== v.terrain) continue;
              const seen = new Set<number>();
              const stack = [p.index * 6 + first];
              let open = 0;
              while (stack.length) {
                const id = stack.pop()!;
                if (seen.has(id)) continue;
                seen.add(id);
                const t = c.list[(id / 6) | 0], s = id % 6;
                for (const s2 of [(s + 1) % 6, (s + 5) % 6]) if (t.edges[s2] === v.terrain) stack.push(t.index * 6 + s2);
                const nb = c.get(t.q + DIRS[s][0], t.r + DIRS[s][1]);
                if (!nb) open++;
                else if (nb.edges[opposite(s)] === v.terrain) stack.push(nb.index * 6 + opposite(s));
              }
              if (seen.size / 6 === v.area && openSegs === open && v.closes === (open === 0 && seen.size >= 6)) hit = true;
            }
            if (!hit) fail(`seed ${seed}: a mancha da vista (área ${v.area}, ${openSegs} bordas abertas, fecha ${v.closes}) não bate com nenhuma da busca em largura`);
            if (v.closes) closing++;
            // Todo trecho do contorno pertence a um setor da mancha e a divisa é mesmo de outro terreno ou do vazio.
            for (const s of v.segs) {
              const t = c.get(s.q, s.r);
              if (!t) { fail(`seed ${seed}: trecho fora do mapa`); continue; }
              if (!s.ray) {
                const nb = c.get(s.q + DIRS[s.i][0], s.r + DIRS[s.i][1]);
                if (s.open !== !nb) fail(`seed ${seed}: lado ${s.i} marcado ${s.open ? 'aberto' : 'fechado'} com vizinho ${nb ? 'sim' : 'não'}`);
                if (nb && nb.edges[opposite(s.i)] === v.terrain) fail(`seed ${seed}: lado ${s.i} é interno e aparece no contorno`);
                if (t.edges[s.i] !== v.terrain) fail(`seed ${seed}: lado de outro terreno no contorno`);
              } else if (t.edges[s.i] === v.terrain && t.edges[(s.i + 5) % 6] === v.terrain) fail(`seed ${seed}: raio interno no contorno`);
            }
          }
        }
      }
      if (before !== snap()) fail(`seed ${seed} jogada ${moves}: as candidatas mudaram o tabuleiro de verdade`);
    }
    const m = g.bestMove(() => 0.5);
    if (!m) { if (!g.discardIfStuck()) break; continue; }
    g.rot = m.rot;
    const pv = g.preview(m.q, m.r);
    const tv = g.terraView(m.q, m.r);
    const res = g.place(m.q, m.r);
    if (!res || !pv) { fail(`seed ${seed}: jogada recusada`); break; }
    moves++;
    // 4. a prévia e a jogada de verdade dão os mesmos pontos
    if (res.points !== pv.points) fail(`seed ${seed} jogada ${moves}: prévia ${pv.points} x jogada ${res.points}`);
    if (!tv) fail(`seed ${seed}: sem vista para uma jogada válida`);
    else {
      const closes = tv.patches.filter((v) => v.closes).length;
      if (closes !== (res.terra?.closedPatches ?? 0)) fail(`seed ${seed} jogada ${moves}: a vista fecha ${closes}, a jogada fechou ${res.terra?.closedPatches}`);
      const cv = res.terra!.closedViews();
      if (cv.length !== (res.terra?.closedPatches ?? 0) || cv.some((v) => !v.closes)) fail(`seed ${seed} jogada ${moves}: closedViews ${cv.length} x ${res.terra?.closedPatches}`);
      // A umidade que a vista promete é a que a jogada rendeu.
      const moist = tv.moist.reduce((a, o) => a + o.gain, 0);
      if (moist !== res.terra!.moisture) fail(`seed ${seed} jogada ${moves}: umidade da vista ${moist} x jogada ${res.terra!.moisture}`);
    }
    // O contorno da missão de grupo (opção "Mostrar a missão no chão") tem as mesmas bordas abertas que a missão conta.
    for (const q of g.board.quests) {
      if (q.state !== 'active' || (q.kind !== 'group' && q.kind !== 'close')) continue;
      const gv = g.board.groupView(q.anchor, q.sector);
      const open = gv.segs.filter((x) => x.open && !x.ray).length;
      if (open !== g.board.openEdges(q.anchor, q.sector) || gv.area !== g.board.groupSize(q.anchor, q.sector)) fail(`seed ${seed}: groupView ${open} abertas, ${gv.area} peças x missão ${g.board.openEdges(q.anchor, q.sector)}, ${g.board.groupSize(q.anchor, q.sector)}`);
      groupViews++;
    }
    while (g.offers.length) g.choose(0);
    while (g.discardIfStuck());
  }
}

console.log(`terra-view: ${moves} jogadas, ${cands} candidatas, ${views} manchas vistas (${closing} fecham) conferidas na busca em largura, ${groupViews} contornos de missão`);
if (fails.length) {
  for (const f of fails) console.error('FALHA:', f);
  process.exit(1);
}
console.log('OK: cache incremental, contorno, bordas abertas, fechamento e umidade batem com a regra refeita.');
