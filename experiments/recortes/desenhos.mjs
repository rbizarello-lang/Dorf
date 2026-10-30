// Gera os SVGs: mapas finais, sequência de 6 jogadas, galeria de peças e comparação com o Clássico.
//   node desenhos.mjs <pasta-de-saída> [classico-mapas.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { S, mulberry32 } from './geom.mjs';
import { makePiece, shapeAt } from './pieces.mjs';
import { COL, bounds, galleryPieces, mapGroup, mapSvg } from './svg.mjs';
import { playGame } from './sim.mjs';

const out = process.argv[2];
const classicFile = process.argv[3];
const f1 = (v) => Math.round(v * 10) / 10;
const NAME = { i30: 'costa quantizada 30°', i15: 'costa quantizada 15°', ii: 'contorno livre' };

// ---- mapas finais: 3 partidas por família (guloso, contato mínimo 0,5) ----
const finals = {};
for (const fam of ['i30', 'i15', 'ii']) {
  finals[fam] = [];
  for (const g of [0, 1, 2]) {
    const rec = playGame({ fam, seed: 1000 + g, player: 'greedy', pieces: 40, keep: true, forgive: 'discard' });
    finals[fam].push(rec);
    writeFileSync(`${out}/mapa-${fam}-${g + 1}.svg`, mapSvg(rec.world, { width: 1400, outline: true, uid: `${fam}${g}`, title: `${NAME[fam]} · partida ${g + 1} · 40 peças · nota ${Math.round(rec.score)}` }));
  }
  // versão sem contornos de peça (a "cara" do mapa), só da primeira partida
  writeFileSync(`${out}/mapa-${fam}-limpo.svg`, mapSvg(finals[fam][0].world, { width: 1400, outline: false, uid: `${fam}L` }));
}

// ---- variantes de rigor: o que o encaixe mais justo faz com o mapa ----
const variants = [
  ['i30', 'rigor1', 'costa quantizada 30°, contato mín. 1 lado (2 arestas), com descarte', { minContact: 1.0, forgive: 'discard' }],
  ['ii', 'rigor1-ima', 'contorno livre, contato mín. 1 lado, ímã tolerante e remendo', { minContact: 1.0, forgive: 'patch', world: { tolMul: 2 } }],
  ['ii', 'rigor15-ima', 'contorno livre, contato mín. 1,5 lado, ímã tolerante e remendo', { minContact: 1.5, forgive: 'patch', world: { tolMul: 2 } }],
];
for (const [fam, tag, title, extra] of variants) {
  const rec = playGame({ fam, seed: 1000, player: 'greedy', pieces: 40, keep: true, ...extra });
  writeFileSync(`${out}/mapa-${fam}-${tag}.svg`, mapSvg(rec.world, { width: 1400, outline: true, uid: `${fam}${tag}`, title: `${title} · ${rec.world.pieces.length} peças postas, ${rec.discards} descartes` }));
}

// ---- galeria de peças ----
for (const fam of ['i30', 'i15', 'ii']) {
  const ps = [];
  for (let k = 0; k < 24; k++) ps.push(makePiece(fam, 77, k));
  writeFileSync(`${out}/pecas-${fam}.svg`, galleryPieces(ps, 6, `${NAME[fam]}: 24 peças da semente 77 (rio nas que têm boca azul)`));
}

// ---- sequência de 6 jogadas (da 13ª em diante, com o mapa já formado) ----
for (const fam of ['i30', 'ii']) {
  const rec = playGame({ fam, seed: 1002, player: 'greedy', pieces: 40, keep: true, snap: true, forgive: 'discard' });
  const steps = rec.steps.filter((s) => s.pcId >= 12).slice(0, 6);
  const world = rec.world;
  const lastM = steps[steps.length - 1].pcId + 1;
  const b = bounds(world, lastM);
  const m = 1800;
  const vw = b.maxx - b.minx + 2 * m, vh = b.maxy - b.miny + 2 * m;
  const PW = 760, PH = Math.round((PW * vh) / vw);
  const cols = 3, rows = 2, gap = 16, head = 70;
  const W = cols * PW + (cols + 1) * gap, H = rows * (PH + head) + (rows + 1) * gap;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#f4f1ea"/>`;
  steps.forEach((st, i) => {
    const x = gap + (i % cols) * (PW + gap), y = gap + Math.floor(i / cols) * (PH + head + gap);
    const ghosts = st.poses.filter((_, k) => k !== st.chosen).slice(0, 7).map((p) => ({ piece: st.piece, pose: p, w: 26, dash: '80 60' }));
    s += `<svg x="${x}" y="${y + head}" width="${PW}" height="${PH}" viewBox="${f1(b.minx - m)} ${f1(b.miny - m)} ${f1(vw)} ${f1(vh)}">`;
    s += `<rect x="${f1(b.minx - m)}" y="${f1(b.miny - m)}" width="${f1(vw)}" height="${f1(vh)}" fill="${COL.sea}"/>`;
    // o mapa até esta jogada, a peça escolhida em branco e as outras melhores poses tracejadas
    s += mapGroup(world, `${fam}s${i}`, { only: st.pcId + 1, snap: st.snap, highlight: st.pcId, ghosts });
    s += `</svg>`;
    s += `<text x="${x}" y="${y + 28}" font-family="sans-serif" font-size="22" font-weight="bold" fill="#222">jogada ${st.pcId}: +${Math.round(st.score)} pontos, ${st.n} poses</text>`;
    s += `<text x="${x}" y="${y + 54}" font-family="sans-serif" font-size="18" fill="#444">branco: a peça posta; tracejado: as 7 outras melhores poses</text>`;
  });
  s += `</svg>`;
  writeFileSync(`${out}/sequencia-${fam}.svg`, s);
}

// ---- comparação com o Clássico, na mesma escala ----
if (classicFile) {
  const games = JSON.parse(readFileSync(classicFile, 'utf8'));
  const g0 = games[0];
  const hexWorld = { pieces: [] };
  const key = new Set(g0.tiles.map((t) => `${t.q},${t.r}`));
  const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  g0.tiles.forEach((t, id) => {
    const cx = 1.5 * t.q * S, cy = Math.sqrt(3) * (t.r + t.q / 2) * S;
    const vx = [], vy = [];
    for (let i = 0; i < 6; i++) {
      vx.push(Math.round(cx + S * Math.cos((Math.PI / 3) * i)));
      vy.push(Math.round(cy + S * Math.sin((Math.PI / 3) * i)));
    }
    // T do jogo: 0 prado, 1 floresta, 2 plantação, 3 vila, 4 água, 5 trilho (trilho vira prado aqui)
    const labels = t.edges.map((e) => (e === 5 ? 0 : e));
    const edges = [];
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      const open = !key.has(`${t.q + DIRS[i][0]},${t.r + DIRS[i][1]}`);
      edges.push({ ax: vx[i], ay: vy[i], bx: vx[j], by: vy[j], len: S, exp: open ? [0, S] : [], label: labels[i] });
    }
    hexWorld.pieces.push({ id, vx, vy, cx, cy, minx: Math.min(...vx), maxx: Math.max(...vx), miny: Math.min(...vy), maxy: Math.max(...vy), edges, piece: { labels, seedDeco: 100 + id } });
  });
  writeFileSync(`${out}/mapa-classico-1.svg`, mapSvg(hexWorld, { width: 1400, outline: true, uid: 'cl', title: 'Clássico (hexágonos de hoje) · 58 peças' }));
  // lado a lado, mesma escala
  const worlds = [hexWorld, finals.i30[0].world, finals.ii[0].world];
  const titles = ['hoje: hexágonos', NAME.i30, NAME.ii];
  const bs = worlds.map((w) => bounds(w));
  const mm = 1200;
  const widths = bs.map((bb) => bb.maxx - bb.minx + 2 * mm), heights = bs.map((bb) => bb.maxy - bb.miny + 2 * mm);
  const Hh = Math.max(...heights);
  const scale = 0.055;
  const Wt = widths.reduce((a, v) => a + v, 0) * scale, Ht = (Hh + 1400) * scale;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(Wt)}" height="${Math.round(Ht)}" viewBox="0 0 ${Wt / scale} ${Ht / scale}"><rect width="${Wt / scale}" height="${Ht / scale}" fill="${COL.sea}"/>`;
  let x = 0;
  worlds.forEach((w, i) => {
    s += `<g transform="translate(${f1(x - bs[i].minx + mm)} ${f1(1400 - bs[i].miny + (Hh - heights[i]) / 2 + mm)})">${mapGroup(w, `cmp${i}`, { outline: true })}</g>`;
    s += `<text x="${f1(x + 300)}" y="900" font-family="sans-serif" font-size="640" fill="#0d2b3a">${titles[i]}</text>`;
    x += widths[i];
  });
  writeFileSync(`${out}/comparacao.svg`, s + '</svg>');
}
console.log('desenhos gravados em', out);
