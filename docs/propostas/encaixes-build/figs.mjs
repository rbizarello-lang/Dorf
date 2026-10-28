// Gera as 20 ilustrações SVG (isométrico achatado: hexágonos flat-top vistos de cima, inclinados)
const C = { pr: '#8dbb5a', fl: '#3f7a45', pl: '#d9b44a', vi: '#c9b8a0', ro: '#4f9fc8', tr: '#8a6b4a', te: '#c8553d', gold: '#e3b23c' };
const SQ3 = Math.sqrt(3), K = 0.6, L = 9, BASE = 5;
let S = 34, T = [], O = [];

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
const f1 = v => Math.round(v * 10) / 10;
const ctr = (q, r) => [S * 1.5 * q, S * SQ3 * (r + q / 2) * K];
const P = (q, r, h = 0, dx = 0, dy = 0) => { const [x, y] = ctr(q, r); return [x + dx, y - h * L + dy]; };
const E = (q, r, k, h = 0) => { const [x, y] = ctr(q, r); const a = (60 * k + 30) * Math.PI / 180, ap = S * SQ3 / 2; return [x + ap * Math.cos(a), y + ap * Math.sin(a) * K - h * L]; };
const cor = (k) => { const a = k * Math.PI / 3; return [S * Math.cos(a), S * Math.sin(a) * K]; };
const pt = (p) => f1(p[0]) + ' ' + f1(p[1]);

// ---- decorações (coordenadas absolutas) ----
const pine = (x, y, s = 1) => `<path d="M${f1(x)} ${f1(y - 11 * s)}L${f1(x + 5 * s)} ${f1(y)}L${f1(x - 5 * s)} ${f1(y)}Z" fill="#2c5e34"/>`;
const house = (x, y) => `<rect x="${f1(x - 5)}" y="${f1(y - 4)}" width="10" height="7" fill="#e6dac6" stroke="rgba(40,30,20,.5)" stroke-width=".6"/><path d="M${f1(x - 6.5)} ${f1(y - 4)}L${f1(x)} ${f1(y - 10)}L${f1(x + 6.5)} ${f1(y - 4)}Z" fill="${C.te}"/>`;
const wheat = (x, y) => `<path d="M${f1(x - 5)} ${f1(y + 2)}v-6M${f1(x)} ${f1(y + 2)}v-7M${f1(x + 5)} ${f1(y + 2)}v-6" stroke="#9a7a18" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;
const sprout = (x, y) => `<path d="M${f1(x)} ${f1(y)}v-4m0 1l-3-3m3 3l3-3" stroke="#2f6a3a" stroke-width="1.6" stroke-linecap="round" fill="none"/>`;
const bush = (x, y, r = 3.5, c = '#2f6a3a') => `<circle cx="${f1(x)}" cy="${f1(y - r)}" r="${r}" fill="${c}"/>`;
const star = (x, y, r = 6, c = C.gold) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + f1(x + rr * Math.cos(a)) + ' ' + f1(y + rr * Math.sin(a)); } return `<path d="${d}Z" fill="${c}" stroke="rgba(60,40,0,.55)" stroke-width=".7"/>`; };

// ---- peças ----
function tile(q, r, o = {}) {
  const { c = C.pr, h = 0, v = false, deco, dx = 0, dy = 0, lift = 0, base = BASE } = o;
  const [x0, y0] = ctr(q, r); const x = x0 + dx, y = y0 + dy - lift;
  const top = y - h * L, th = h * L + base;
  const cs = Array.from({ length: 6 }, (_, k) => { const [a, b] = cor(k); return [x + a, top + b]; });
  let s = '';
  if (v) {
    s = `<polygon points="${cs.map(pt).join(' ')}" fill="var(--void)" stroke="var(--voidline)" stroke-width="1.2" stroke-dasharray="4 3" stroke-linejoin="round"/>`;
  } else {
    const col = Array.isArray(c) ? c : Array(6).fill(c);
    let walls = '';
    if (Array.isArray(c)) { for (let k = 0; k < 3; k++) { const a = cs[k], b = cs[k + 1]; walls += `<polygon points="${pt(a)} ${pt(b)} ${pt([b[0], b[1] + th])} ${pt([a[0], a[1] + th])}" fill="${shade(col[k], .68)}"/>`; } }
    else { let d = ''; for (let k = 0; k < 3; k++) { const a = cs[k], b = cs[k + 1]; d += `M${pt(a)}L${pt(b)}L${pt([b[0], b[1] + th])}L${pt([a[0], a[1] + th])}Z`; } walls = `<path d="${d}" fill="${shade(c, .68)}" stroke="rgba(20,30,20,.35)" stroke-width=".8" stroke-linejoin="round"/>`; }
    s += walls;
    if (Array.isArray(c)) { for (let k = 0; k < 6; k++) s += `<polygon points="${pt([x, top])} ${pt(cs[k])} ${pt(cs[(k + 1) % 6])}" fill="${col[k]}" stroke="${col[k]}" stroke-width=".6"/>`; s += `<polygon points="${cs.map(pt).join(' ')}" fill="none" stroke="rgba(20,30,20,.45)" stroke-width="1" stroke-linejoin="round"/>`; }
    else s += `<polygon points="${cs.map(pt).join(' ')}" fill="${c}" stroke="rgba(20,30,20,.45)" stroke-width="1" stroke-linejoin="round"/>`;
  }
  if (deco) s += deco(x, top);
  T.push({ y: y0 + dy, x, top, svg: s, minY: top - S * K, maxY: y + S * K + base });
}
const add = s => O.push(s);

// ---- traços e rótulos ----
function curve(pts) {
  if (pts.length < 3) return 'M' + pt(pts[0]) + 'L' + pt(pts[1]);
  let d = 'M' + pt(pts[0]); const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  d += 'L' + pt(mid(pts[0], pts[1]));
  for (let i = 1; i < pts.length - 1; i++) d += 'Q' + pt(pts[i]) + ' ' + pt(mid(pts[i], pts[i + 1]));
  d += 'L' + pt(pts[pts.length - 1]); return d;
}
const river = (pts, o = {}) => { const d = curve(pts); const { col = C.ro, w = 9 } = o; add(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity="${o.hi ?? .35}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`); };
const rail = (pts) => { const d = curve(pts); add(`<path d="${d}" fill="none" stroke="${C.tr}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#e8d9bd" stroke-width="1.6" stroke-dasharray="2 3.5" stroke-linejoin="round"/>`); };
function arrow(a, b, o = {}) {
  const { col = 'var(--ink)', w = 2.2, dash, head = 7 } = o;
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const ex = b[0] - Math.cos(ang) * head * .6, ey = b[1] - Math.sin(ang) * head * .6;
  const p1 = [b[0] - head * Math.cos(ang - .45), b[1] - head * Math.sin(ang - .45)], p2 = [b[0] - head * Math.cos(ang + .45), b[1] - head * Math.sin(ang + .45)];
  add(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(ex)}" y2="${f1(ey)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/><polygon points="${pt(b)} ${pt(p1)} ${pt(p2)}" fill="${col}"/>`);
}
const label = (x, y, t, o = {}) => add(`<text class="t${o.b ? ' b' : ''}" x="${f1(x)}" y="${f1(y)}" text-anchor="${o.a || 'middle'}" font-size="${o.s || 11.5}"${o.fill ? ` fill="${o.fill}"` : ''}>${t}</text>`);
function badge(x, y, t, o = {}) {
  const w = Math.max(22, t.length * 6.3 + 12); const fill = o.fill || C.gold, fg = o.fg || '#2b2410';
  add(`<rect x="${f1(x - w / 2)}" y="${f1(y - 9)}" width="${f1(w)}" height="17" rx="8.5" fill="${fill}" stroke="rgba(40,30,0,.5)" stroke-width=".8"/><text x="${f1(x)}" y="${f1(y + 3.6)}" text-anchor="middle" font-size="11" font-weight="700" fill="${fg}" class="bt">${t}</text>`);
}
const disc = (x, y, t, o = {}) => add(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${o.r || 8}" fill="${o.fill || 'var(--card)'}" stroke="${o.stroke || 'var(--ink)'}" stroke-width="1.2"/><text x="${f1(x)}" y="${f1(y + 4)}" text-anchor="middle" font-size="${o.s || 11}" font-weight="700" class="bt" fill="${o.fg || 'var(--ink)'}">${t}</text>`);
const ok = (x, y) => disc(x, y, '✓', { fill: '#2f8f4f', stroke: '#17512b', fg: '#fff' });
const no = (x, y) => disc(x, y, '✕', { fill: '#c0432e', stroke: '#6e1f12', fg: '#fff' });
const sun = (x, y) => { let d = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; d += `M${f1(x + 11 * Math.cos(a))} ${f1(y + 11 * Math.sin(a))}L${f1(x + 16 * Math.cos(a))} ${f1(y + 16 * Math.sin(a))}`; } add(`<path d="${d}" stroke="${C.gold}" stroke-width="2" stroke-linecap="round"/><circle cx="${f1(x)}" cy="${f1(y)}" r="8" fill="${C.gold}" stroke="rgba(80,50,0,.6)" stroke-width="1"/>`); };
const topPoly = (q, r, h, fill, op, dx = 0, dy = 0) => { const [x, y] = P(q, r, h, dx, dy); const cs = Array.from({ length: 6 }, (_, k) => { const [a, b] = cor(k); return [x + a, y + b]; }); add(`<polygon points="${cs.map(pt).join(' ')}" fill="${fill}" fill-opacity="${op}"/>`); };
const edgeBar = (q, r, k, which, col, inset = 3, w = 5) => { // metade 0 ou 1 da borda k
  const [cx, cy] = ctr(q, r); const a = cor(k), b = cor((k + 1) % 6); const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const p = which === 0 ? [a, m] : [m, b]; const ang = (60 * k + 30) * Math.PI / 180; const ix = -inset * Math.cos(ang), iy = -inset * Math.sin(ang) * K;
  add(`<line x1="${f1(cx + p[0][0] + ix)}" y1="${f1(cy + p[0][1] + iy)}" x2="${f1(cx + p[1][0] + ix)}" y2="${f1(cy + p[1][1] + iy)}" stroke="${col}" stroke-width="${w}" stroke-linecap="butt"/>`);
};
const walker = (x, y) => add(`<circle cx="${f1(x)}" cy="${f1(y - 12)}" r="3.2" fill="#3a2f26"/><path d="M${f1(x)} ${f1(y - 9)}v7m0 0l-3 5m3-5l3 5m-3-8l-4 3m4-3l4 2" stroke="#3a2f26" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M${f1(x + 7)} ${f1(y - 14)}V${f1(y + 3)}" stroke="#8a6b4a" stroke-width="1.6" stroke-linecap="round"/>`);

// ---- montagem do SVG ----
function fig(id, titulo, { s = 34, sy = 0, sx = 0, mx = 54, mt = 50, mb = 50, minW = 290 } = {}, build) {
  S = s; T = []; O = []; build();
  const minx = Math.min(...T.map(t => t.x - S)), maxx = Math.max(...T.map(t => t.x + S));
  const miny = Math.min(...T.map(t => t.minY)), maxy = Math.max(...T.map(t => t.maxY));
  const W = Math.round(Math.max(minW, maxx - minx + 2 * mx)), H = Math.round(maxy - miny + mt + mb);
  const tx = W / 2 - (minx + maxx) / 2 + sx, ty = mt - miny + sy;
  T.sort((a, b) => a.y - b.y || a.x - b.x);
  const body = T.map(t => t.svg).join('') + O.join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t-${id}"><title id="t-${id}">${titulo}</title><rect class="bg" x="0" y="0" width="${W}" height="${H}" rx="12"/><g transform="translate(${f1(tx)} ${f1(ty)})">${body}</g></svg>`;
}

export const F = {};

// ===== E1 =====
F['vau-ponte'] = fig('vau', 'Um rio e um trilho se encontram na divisa de duas peças e ali nasce uma ponte', {}, () => {
  tile(-1, 0, { c: C.vi, deco: (x, y) => house(x - 8, y + 2) + house(x + 7, y - 3) });
  tile(0, -1, {}); tile(0, 0, {}); tile(1, 0, {}); tile(1, 1, { deco: (x, y) => pine(x + 14, y + 4) + pine(x + 20, y - 3, .8) });
  tile(1, -1, { c: C.fl, deco: (x, y) => pine(x - 8, y + 3) + pine(x + 6, y - 2) + pine(x + 12, y + 6, .9) });
  river([E(0, -1, 4), P(0, -1), P(0, 0), E(0, 0, 0)]);
  rail([E(1, 0, 3), P(1, 0), P(1, 1), E(1, 1, 1)]);
  const b = E(0, 0, 0);
  add(`<g transform="rotate(-28 ${pt(b)})"><rect x="${f1(b[0] - 13)}" y="${f1(b[1] - 6)}" width="26" height="12" rx="2" fill="#b89868" stroke="#5b4326" stroke-width="1.2"/><path d="M${f1(b[0] - 13)} ${f1(b[1] - 3)}h26M${f1(b[0] - 13)} ${f1(b[1] + 3)}h26" stroke="#5b4326" stroke-width=".9"/></g>`);
  badge(b[0] + 6, b[1] - 34, 'ponte +8'); arrow([b[0] + 3, b[1] - 24], [b[0] + 1, b[1] - 9], { col: 'var(--ink)', w: 1.6, head: 5 });
  label(P(0, -1)[0] - 33, P(0, -1)[1] - 8, 'rio'); label(P(1, 1)[0] - 28, P(1, 1)[1] + 8, 'trilho');
});

F['estacao-decide'] = fig('estacao', 'A interação da estação vale 10 como encaixe; as outras continuam valendo 5', { s: 30, mx: 26, mb: 70 }, () => {
  tile(0, 0, { c: C.vi, deco: (x, y) => house(x - 7, y + 3) + house(x + 4, y - 4) });
  tile(1, 0, { c: C.fl, deco: (x, y) => pine(x - 6, y + 4) + pine(x + 8, y - 1) + pine(x - 2, y - 5, .9) });
  tile(4, -2, { c: C.vi, deco: (x, y) => house(x - 7, y + 3) + house(x + 4, y - 4) });
  tile(5, -2, { c: C.pl, deco: (x, y) => wheat(x - 8, y + 4) + wheat(x + 6, y + 1) + wheat(x - 2, y - 5) });
  const a = E(0, 0, 0), b = E(4, -2, 0);
  add(`<rect x="${f1(a[0] - 6)}" y="${f1(a[1] - 5)}" width="12" height="9" fill="#a8855a" stroke="#4d3820" stroke-width="1"/><circle cx="${f1(a[0])}" cy="${f1(a[1] - 1)}" r="3.4" fill="none" stroke="#4d3820" stroke-width="1.2"/>`);
  badge(a[0], a[1] - 30, 'encaixe 10', { fill: C.gold }); badge(b[0], b[1] - 30, 'sinergia 5', { fill: 'var(--card)', fg: 'var(--ink)' });
  label(a[0], a[1] + 32, 'outono: serraria', { s: 11 }); label(b[0], b[1] + 32, 'fora da estação', { s: 11 });
  const y0 = P(1, 0)[1] + 66, x0 = P(0, 0)[0], x3 = P(5, -2)[0], st = (x3 - x0) / 3;
  const nm = ['primavera', 'verão', 'outono', 'inverno'], cl = ['#e9a8c0', '#e6c34a', '#d0773a', '#a9cbe6'], ds = ['colmeias', 'moinho', 'serraria', 'pasto'];
  add(`<path d="M${f1(x0)} ${f1(y0)}H${f1(x3)}" stroke="var(--ink)" stroke-opacity=".3" stroke-width="1.4"/>`);
  nm.forEach((n, i) => { const x = x0 + st * i; add(`<circle cx="${f1(x)}" cy="${f1(y0)}" r="${i === 2 ? 9 : 6}" fill="${cl[i]}" stroke="${i === 2 ? 'var(--ink)' : 'rgba(0,0,0,.3)'}" stroke-width="${i === 2 ? 2 : 1}"/>`); label(x, y0 + 21, n, { s: 10.5 }); label(x, y0 + 33, ds[i], { s: 10 }); });
  label((x0 + x3) / 2, y0 - 14, 'a cada 20 jogadas muda a estação', { s: 10.5 });
});

F['visada'] = fig('visada', 'Duas peças de floresta separadas por uma vila se enxergam por uma fileira de árvores', {}, () => {
  tile(0, 0, { c: C.fl, deco: (x, y) => pine(x - 8, y + 3) + pine(x + 5, y - 3) });
  tile(1, 0, { c: C.vi, deco: (x, y) => house(x - 9, y + 4) + house(x + 8, y + 1) });
  tile(2, 0, { c: C.fl, deco: (x, y) => pine(x + 6, y + 3) + pine(x - 6, y - 2) });
  tile(1, -1, { c: C.pr }); tile(1, 1, { c: C.pl, deco: (x, y) => wheat(x - 5, y + 3) + wheat(x + 7, y - 2) });
  const a = E(0, 0, 0), b = E(2, 0, 3), m = P(1, 0);
  [[a, 0], [[(a[0] + m[0]) / 2, (a[1] + m[1]) / 2], 0], [m, 0], [[(m[0] + b[0]) / 2, (m[1] + b[1]) / 2], 0], [b, 0]].forEach(([p]) => add(`<circle cx="${f1(p[0])}" cy="${f1(p[1] - 2)}" r="3.6" fill="#2f6a3a" stroke="#173a1f" stroke-width=".8"/>`));
  add(`<path d="M${pt(a)}L${pt(b)}" stroke="${C.gold}" stroke-width="2" stroke-dasharray="1 5" stroke-linecap="round" fill="none"/>`);
  badge(m[0], m[1] - 40, 'visada +4'); label(P(0, 0)[0] - 4, P(0, 0)[1] + 44, 'mata'); label(P(2, 0)[0] + 6, P(2, 0)[1] + 44, 'mata'); label(P(1, 0)[0], P(1, 0)[1] + 52, 'vila no meio', { s: 10.5 });
});

F['meia-borda'] = fig('meia', 'Uma borda partida em duas metades encaixa se alguma metade combina com a vizinha', {}, () => {
  tile(0, 0, { c: C.pr }); tile(1, 0, { c: C.pr }); tile(0, 1, { c: C.fl, deco: (x, y) => pine(x - 7, y + 3) + pine(x + 8, y) });
  tile(-1, 0, { c: C.pl, deco: (x, y) => wheat(x - 6, y + 3) + wheat(x + 6, y - 1) });
  // borda 0 de A: metade 0 prado, metade 1 floresta; borda 3 de B: lado de A(corner1)=floresta, A(corner0)=plantação
  edgeBar(0, 0, 0, 0, C.pr, 4); edgeBar(0, 0, 0, 1, C.fl, 4);
  edgeBar(1, 0, 3, 0, C.fl, 4); edgeBar(1, 0, 3, 1, C.pl, 4);
  const [cx, cy] = ctr(0, 0), c0 = cor(0), c1 = cor(1);
  const p0 = [cx + (c0[0] * 3 + c1[0]) / 4 + 0, cy + (c0[1] * 3 + c1[1]) / 4], p1 = [cx + (c0[0] + c1[0] * 3) / 4, cy + (c0[1] + c1[1] * 3) / 4];
  no(p0[0] + 18, p0[1] - 12); ok(p1[0] + 12, p1[1] + 10);
  const m = E(0, 0, 0); badge(m[0] + 40, m[1] - 40, 'encaixa: 7');
  label(m[0] + 52, m[1] - 4, 'prado | floresta', { a: 'start', s: 10 });
  label(m[0] + 52, m[1] + 9, 'floresta | plantação', { a: 'start', s: 10 });
});

F['mosaico'] = fig('mosaico', 'Floresta cercada por prado, plantação e vila: três interações e a fronteira dupla', {}, () => {
  tile(0, 0, { c: C.fl, deco: (x, y) => pine(x - 8, y + 3) + pine(x + 8, y + 2) + pine(x, y - 5, .9) });
  tile(1, 0, { c: C.pr }); tile(0, 1, { c: C.pl, deco: (x, y) => wheat(x - 6, y + 3) + wheat(x + 7, y) });
  tile(-1, 1, { c: C.vi, deco: (x, y) => house(x - 7, y + 4) + house(x + 7, y - 2) });
  const a = E(0, 0, 0), b = E(0, 0, 1), c = E(0, 0, 2);
  add(`<rect x="${f1(a[0] - 4)}" y="${f1(a[1] - 4)}" width="9" height="7" fill="#a8855a" stroke="#4d3820" stroke-width=".9"/><path d="M${f1(a[0] - 6)} ${f1(a[1] - 4)}L${f1(a[0])} ${f1(a[1] - 10)}L${f1(a[0] + 6)} ${f1(a[1] - 4)}Z" fill="#7a5a36"/>`);
  add(`<circle cx="${f1(b[0] - 5)}" cy="${f1(b[1])}" r="3.2" fill="#d9553d"/><circle cx="${f1(b[0] + 3)}" cy="${f1(b[1] - 3)}" r="3.2" fill="#e08a3a"/><circle cx="${f1(b[0] + 6)}" cy="${f1(b[1] + 2)}" r="3.2" fill="#d9553d"/>`);
  badge(a[0] + 40, a[1] - 16, 'clareira 8'); badge(b[0] + 38, b[1] + 22, 'pomar 8'); badge(c[0] - 42, c[1] + 22, 'vila 8');
  badge(P(0, 0)[0] - 36, P(0, 0)[1] - 38, 'fronteira dupla +6', { fill: C.gold });
});

F['espera-rende'] = fig('espera', 'A borda aberta de uma peça cresce de broto a árvore alta, e fechá-la mais tarde rende mais', {}, () => {
  const stages = [[0, 'jogada 10', '+0'], [2, 'jogada 22', '+1'], [4, 'jogada 34', '+2']];
  stages.forEach(([q, t, p], i) => {
    const qq = q, rr = -q / 2;
    tile(qq, rr, { c: C.pr, deco: (x, y) => {
      const bx = x + 14, by = y + 2; let s = '';
      if (i === 0) s += sprout(bx - 4, by + 2) + sprout(bx + 5, by - 3) + sprout(bx + 3, by + 6);
      if (i === 1) s += bush(bx - 5, by + 3, 3.2) + bush(bx + 4, by - 2, 3.6) + bush(bx + 5, by + 7, 3);
      if (i === 2) s += pine(bx - 6, by + 5, 1.3) + pine(bx + 6, by - 1, 1.5) + pine(bx + 7, by + 9, 1.2);
      s += house(x - 12, y + 2);
      return s;
    } });
    const [x, y] = P(qq, rr); badge(x, y + 40, p, { fill: i === 2 ? C.gold : 'var(--card)', fg: i === 2 ? '#2b2410' : 'var(--ink)' }); label(x, y - 32, t, { s: 10.5 });
  });
  const a = P(0, 0), b = P(4, -2); arrow([a[0] - 20, a[1] + 66], [b[0] + 24, b[1] + 66], { w: 1.8 }); label((a[0] + b[0]) / 2, a[1] + 84, 'a borda espera, depois você a fecha', { s: 10.5 });
});

F['sucessao-miolo'] = fig('miolo', 'Uma peça cercada pelas seis vizinhas ganha mata fechada no miolo', { s: 30 }, () => {
  const ring = [[1, 0, C.fl], [0, 1, C.fl], [-1, 1, C.pr], [-1, 0, C.fl], [0, -1, C.fl], [1, -1, C.pl]];
  ring.forEach(([q, r, c]) => tile(q, r, { c, deco: c === C.fl ? (x, y) => pine(x - 5, y + 2, .9) + pine(x + 6, y - 2, .9) : c === C.pl ? (x, y) => wheat(x - 4, y + 2) + wheat(x + 5, y - 1) : undefined }));
  tile(0, 0, { c: '#35703f', deco: (x, y) => pine(x - 10, y + 5, 1.1) + pine(x + 10, y + 5, 1.1) + pine(x, y + 6, 1.1) + pine(x - 6, y - 3, 1) + pine(x + 6, y - 3, 1) + `<circle cx="${f1(x - 13)}" cy="${f1(y - 2)}" r="1.8" fill="${C.gold}"/><circle cx="${f1(x + 14)}" cy="${f1(y - 1)}" r="1.8" fill="${C.gold}"/><circle cx="${f1(x)}" cy="${f1(y + 11)}" r="1.8" fill="${C.gold}"/>` });
  const c = P(0, 0); badge(c[0] + 78, c[1] - 24, 'miolo amadurece', { fill: C.gold }); arrow([c[0] + 54, c[1] - 20], [c[0] + 15, c[1] - 6], { w: 1.6, head: 5 });
  label(c[0] + 78, c[1] + 2, 'grupo de 9 → +9', { s: 11 }); label(c[0] + 78, c[1] + 15, '(teto 12)', { s: 10 });
  label(c[0], c[1] - 64, '6 vizinhas encaixadas', { s: 10.5 });
});

// ===== E2 =====
F['aguas-descem'] = fig('aguas', 'A água desce de nível a cada peça e rende; o rio que sobe vira água parada', { s: 31 }, () => {
  const hs = [2, 1, 1, 0];
  hs.forEach((h, i) => tile(0, i, { h, c: C.pr, deco: i === 0 ? (x, y) => pine(x - 14, y + 3, .9) + pine(x + 12, y - 5, .9) + `<circle cx="${f1(x)}" cy="${f1(y - 1)}" r="5" fill="#bfe7f7" stroke="${C.ro}" stroke-width="1.6"/>` : undefined }));
  tile(1, 3, { h: 0, c: C.ro, deco: (x, y) => `<path d="M${f1(x - 12)} ${f1(y)}q6-3 12 0t12 0M${f1(x - 8)} ${f1(y + 6)}q5-3 10 0t10 0" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" fill="none"/>` });
  const rh = [0, 1, 1, 2];
  rh.forEach((h, i) => tile(2, i - 1, { h, c: C.pr }));
  river([P(0, 0, 2), P(0, 1, 1), P(0, 2, 1), P(0, 3, 0), P(1, 3, 0)]);
  river(rh.map((h, i) => P(2, i - 1, h)), { col: '#8fa3ad', hi: .15 });
  [0, 1, 2].forEach(i => { const a = P(0, i, hs[i], 0, 4), b = P(0, i + 1, hs[i + 1], 0, -6); arrow([a[0] + 10, a[1]], [b[0] + 10, b[1]], { col: '#17517a', w: 2.2, head: 6 }); });
  [0, 1, 2].forEach(i => { const a = P(2, i - 1, rh[i], 0, 4), b = P(2, i, rh[i + 1], 0, -6); arrow([a[0] + 10, a[1]], [b[0] + 10, b[1]], { col: 'rgba(90,100,105,.75)', w: 2, dash: '3 3', head: 6 }); });
  [P(0, 1, 1, 46), P(0, 2, 1, 46), P(0, 3, 0, 46)].forEach(p => badge(p[0], p[1] + 2, '+8', { fill: C.gold }));
  const m = P(1, 3, 0); badge(m[0] + 6, m[1] + 31, 'chegou: +60', { fill: C.gold });
  hs.forEach((h, i) => disc(P(0, i, h)[0] - 36, P(0, i, h)[1] + 2, h, { r: 7, s: 10 }));
  label(P(0, 0, 2)[0] + 16, P(0, 0, 2)[1] - 26, 'nascente', { s: 11 });
  label(P(2, -1, 0)[0] + 4, P(2, -1, 0)[1] - 30, 'sobe: água parada, 0', { s: 10.5 });
});

F['sol-sombra'] = fig('sol', 'O morro faz sombra sobre as casas do lado oposto ao sol: floresta rende na sombra, plantação ao sol', { s: 33 }, () => {
  tile(1, -1, { c: C.pl, deco: (x, y) => wheat(x - 8, y + 3) + wheat(x + 7, y - 1) + wheat(x - 1, y - 5) });
  tile(0, 0, { c: C.pr, h: 2, deco: (x, y) => `<path d="M${f1(x - 11)} ${f1(y + 4)}l9-14 6 8 5-6 7 12z" fill="#9a9a8c" stroke="#5a5a4c" stroke-width=".9" stroke-linejoin="round"/>` });
  tile(-1, 1, { c: C.fl, deco: (x, y) => pine(x - 8, y + 3) + pine(x + 8, y - 1) + pine(x, y - 5, .9) });
  tile(-2, 2, { c: C.vi, deco: (x, y) => house(x - 7, y + 3) + house(x + 7, y - 2) });
  topPoly(-1, 1, 0, '#101a2e', .38); topPoly(-2, 2, 0, '#101a2e', .3);
  const s = P(1, -1, 0, 40, -42); sun(s[0], s[1]); arrow([s[0] - 10, s[1] + 8], [P(0, 0, 2)[0] + 18, P(0, 0, 2)[1] - 8], { col: C.gold, w: 2.4 });
  badge(P(1, -1)[0] - 2, P(1, -1)[1] + 30, 'ao sol +4'); badge(P(-1, 1)[0] - 6, P(-1, 1)[1] + 30, 'sombra +3'); badge(P(-2, 2)[0] - 6, P(-2, 2)[1] + 30, 'sombra longa +3');
  label(P(0, 0, 2)[0] - 10, P(0, 0, 2)[1] - 24, 'morro (nível 2)', { s: 10.5 });
  label(s[0] - 8, s[1] - 18, 'sol deste passo', { s: 10.5 });
});

F['peregrino'] = fig('peregrino', 'Um peregrino sai do Centro e anda uma casa por jogada em direção a um sítio escondido', { s: 32 }, () => {
  const T5 = i => [i, -Math.floor(i / 2)];
  tile(...T5(0), { c: C.vi, deco: (x, y) => house(x - 8, y + 3) + house(x + 6, y - 3) });
  tile(...T5(1), { c: C.pr }); tile(...T5(2), { c: C.pl, deco: (x, y) => wheat(x - 7, y + 3) + wheat(x + 7, y - 2) });
  tile(...T5(3), { v: true });
  tile(...T5(4), { c: C.pr, deco: (x, y) => `<path d="M${f1(x - 11)} ${f1(y + 4)}v-10m7 10v-12m7 12v-9m7 9v-10" stroke="#d9d2c0" stroke-width="3" stroke-linecap="round"/>` + `<ellipse cx="${f1(x)}" cy="${f1(y - 4)}" rx="19" ry="9" fill="#fff" fill-opacity=".42"/>` });
  const p = i => P(...T5(i));
  add(`<path d="${curve([p(0), p(1), p(2)])}" fill="none" stroke="#6b5a3e" stroke-width="2.4" stroke-dasharray="1 5" stroke-linecap="round"/>`);
  walker(p(2)[0] + 1, p(2)[1] + 8);
  label(p(0)[0], p(0)[1] + 36, 'Centro', { s: 11 }); label(p(2)[0], p(2)[1] + 36, 'peregrino', { s: 11 });
  disc(p(3)[0], p(3)[1] + 2, '?', { r: 9, s: 13 }); label(p(3)[0], p(3)[1] + 36, 'espera a peça', { s: 10.5 });
  star(p(4)[0], p(4)[1] - 20, 7); label(p(4)[0], p(4)[1] + 36, 'sítio: paga o dobro', { s: 10.5 }); badge(p(4)[0], p(4)[1] - 40, '+1 peça');
  add(`<path d="M${f1(p(2)[0] + 22)} ${f1(p(2)[1] + 8)}l-3-4h6z" fill="#c8553d"/>`);
});

F['mapa-lapis'] = fig('lapis', 'O vazio mostra um esboço a lápis; peça que bate com o esboço o pinta a tinta', { s: 32 }, () => {
  const sk = (x, y, t) => `<path d="M${f1(x - 14)} ${f1(y + 5)}l9-9m-4 13l13-13m-7 17l16-16m-6 18l11-11" stroke="var(--pencil)" stroke-width="1.1" stroke-linecap="round" fill="none"/><text x="${f1(x)}" y="${f1(y + 2)}" text-anchor="middle" font-size="10" font-style="italic" class="pn">${t}</text>`;
  tile(0, 0, { c: C.fl, deco: (x, y) => pine(x - 8, y + 3) + pine(x + 8, y + 1) + pine(x, y - 5, .9) });
  tile(1, 0, { c: C.pr });
  tile(0, 1, { v: true, deco: (x, y) => sk(x, y, 'campo') });
  tile(-1, 1, { v: true, deco: (x, y) => sk(x, y, 'vila') });
  tile(1, -1, { v: true, deco: (x, y) => sk(x, y, 'mata') });
  tile(2, -1, { v: true, deco: (x, y) => sk(x, y, 'rio') });
  badge(P(0, 0)[0], P(0, 0)[1] - 30, 'bate: +6'); badge(P(1, 0)[0] + 4, P(1, 0)[1] + 30, 'bate: +6');
  const sp = P(2, -1); add(`<circle cx="${f1(sp[0] + 40)}" cy="${f1(sp[1] - 36)}" r="19" fill="none" stroke="${C.te}" stroke-width="2" stroke-dasharray="3 2.5"/><text x="${f1(sp[0] + 40)}" y="${f1(sp[1] - 33)}" text-anchor="middle" font-size="11" font-weight="700" fill="${C.te}" class="bt">obra</text>`);
  label(sp[0] + 40, sp[1] - 8, 'selo se tudo pintado', { s: 9.5 });
});

F['retalhos-dois'] = fig('dois', 'A peça dupla cai inteira ou se parte em duas peças comuns, uma por jogada', { s: 30 }, () => {
  tile(0, 0, { c: C.pr }); tile(1, 0, { c: C.pr, deco: (x, y) => house(x + 8, y + 2) });
  tile(4, -1, { c: C.pr, dx: -10, dy: 3 }); tile(5, -1, { c: C.pr, dx: 12, dy: -3, deco: (x, y) => house(x + 8, y + 2) });
  river([E(0, 0, 3), P(0, 0), E(0, 0, 0), P(1, 0), E(1, 0, 0)]);
  river([E(4, -1, 3, 0).map((v, i) => i ? v + 3 : v - 10), P(4, -1, 0, -10, 3), E(4, -1, 0).map((v, i) => i ? v + 3 : v - 10)]);
  river([E(5, -1, 3).map((v, i) => i ? v - 3 : v + 12), P(5, -1, 0, 12, -3), E(5, -1, 0).map((v, i) => i ? v - 3 : v + 12)]);
  const a = [E(0, 0, 0)]; const [ca, cb] = [cor(0), cor(1)], c0 = ctr(0, 0);
  add(`<path d="M${f1(c0[0] + ca[0])} ${f1(c0[1] + ca[1])}L${f1(c0[0] + cb[0])} ${f1(c0[1] + cb[1])}" stroke="#f6efdc" stroke-width="2.2" stroke-dasharray="3.5 3"/>`);
  const m = E(0, 0, 0); label(m[0], m[1] - 38, 'dupla: 12 giros', { s: 11 }); badge(m[0], m[1] + 42, '4+ bordas: +30', { fill: C.gold });
  const n = E(4, -1, 0); label(n[0] + 12, n[1] - 38, 'ou se parte', { s: 11 }); badge(n[0] + 14, n[1] + 52, '−1 peça da pilha', { fill: 'var(--card)', fg: 'var(--ink)' });
  const q = ctr(2, 0); arrow([q[0] - 8, q[1] + 2], [q[0] + 24, q[1] + 2], { w: 2.2 });
  label(P(5, -1)[0] + 12, P(5, -1)[1] + 30, 'na jogada seguinte', { s: 10 });
});

F['remendo'] = fig('remendo', 'Um retalho novo cobre uma peça sem nenhum encaixe e passa a encaixar nas vizinhas', { s: 30 }, () => {
  tile(0, 0, { c: C.pl, deco: (x, y) => wheat(x - 7, y + 3) + wheat(x + 7, y - 1) });
  tile(1, 0, { c: C.fl, deco: (x, y) => pine(x - 6, y + 3) + pine(x + 7, y - 1) }); tile(0, 1, { c: C.fl, deco: (x, y) => pine(x - 6, y + 3) + pine(x + 7, y - 1) });
  no(E(0, 0, 0)[0], E(0, 0, 0)[1]); no(E(0, 0, 1)[0], E(0, 0, 1)[1]);
  label(P(0, 0)[0] - 4, P(0, 0)[1] - 30, 'sem encaixe', { s: 11 });
  tile(4, 0, { c: C.pl }); tile(5, 0, { c: C.fl, deco: (x, y) => pine(x - 6, y + 3) + pine(x + 7, y - 1) }); tile(4, 1, { c: C.fl, deco: (x, y) => pine(x - 6, y + 3) + pine(x + 7, y - 1) });
  tile(4, 0, { c: C.fl, lift: 6, base: 2, deco: (x, y) => pine(x - 7, y + 3) + pine(x + 6, y - 2) + `<polygon points="${[0, 1, 2, 3, 4, 5].map(k => { const a = cor(k); return pt([x + a[0] * .86, y + a[1] * .86]); }).join(' ')}" fill="none" stroke="#f6efdc" stroke-width="1.6" stroke-dasharray="3 2.5"/>` });
  ok(E(4, 0, 0)[0], E(4, 0, 0)[1] - 6); ok(E(4, 0, 1)[0], E(4, 0, 1)[1] - 6);
  badge(P(4, 0)[0], P(4, 0, 0, 0, -6)[1] - 28, '+20'); label(P(4, 0)[0] - 6, P(4, 0)[1] + 66, 'retalho: 1 de 3', { s: 10.5 });
  const q = ctr(2, 0); arrow([q[0] - 12, q[1] + 18], [q[0] + 18, q[1] + 18], { w: 2.2 }); label(q[0] + 3, q[1] + 4, '−1 peça', { s: 10.5 });
});

F['sucessao-paisagem'] = fig('sucessao', 'Depois de doze jogadas cercado de mata, o prado vira mata jovem', { s: 22 }, () => {
  const ring = (ox, mid, mdeco) => {
    [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]].forEach(([q, r]) => tile(q + ox, r - ox / 2, { c: C.fl, deco: (x, y) => pine(x - 4, y + 2, .8) + pine(x + 5, y - 1, .8) }));
    tile(ox, -ox / 2, { c: mid, deco: mdeco });
  };
  ring(0, C.pr, (x, y) => `<circle cx="${f1(x - 5)}" cy="${f1(y + 2)}" r="1.5" fill="#fff"/><circle cx="${f1(x + 6)}" cy="${f1(y - 2)}" r="1.5" fill="#f3d36a"/>`);
  ring(6, '#5f9a54', (x, y) => sprout(x - 6, y + 4) + sprout(x + 4, y + 1) + sprout(x - 1, y - 4) + sprout(x + 8, y + 5));
  const a = ctr(0, 0), b = ctr(6, -3); const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 2];
  arrow([m[0] - 18, m[1]], [m[0] + 18, m[1]], { w: 2.2 }); label(m[0], m[1] - 10, '12 jogadas', { s: 10.5 }); badge(m[0], m[1] + 20, '+5', { fill: C.gold });
  label(a[0], a[1] + 62, 'prado, 4 bordas de mata', { s: 10 }); label(b[0], b[1] + 62, 'mata jovem', { s: 10 });
});

// ===== E3 =====
const hnum = (q, r, h, dx, dy, n) => { const p = P(q, r, h, dx, dy); disc(p[0], p[1], n, { r: 7, s: 10 }); };
F['relevo-casa'] = fig('rcasa', 'A altura da borda precisa casar com a da vizinha: diferença de um nível encaixa, de dois não', { s: 24 }, () => {
  const pairs = [[0, 0, 1, 1, true], [3, -2, 1, 2, true], [6, -3, 0, 2, false]];
  pairs.forEach(([q, r, ha, hb, good]) => {
    tile(q, r, { c: C.pr, h: ha }); tile(q + 1, r, { c: C.pr, h: hb, deco: good ? undefined : (x, y) => '' });
    const m = E(q, r, 0, ha); const mb = E(q, r, 0, hb);
    hnum(q, r, ha, 10, 6, ha); hnum(q + 1, r, hb, -10, 6, hb);
    good ? ok(m[0], m[1] - 24) : no(m[0], m[1] - 28);
    label(m[0], m[1] + 44, good ? (ha === hb ? 'igual: encaixa' : 'degrau de 1: encaixa') : 'degrau de 2: não', { s: 10 });
  });
});

F['relevo-degrau'] = fig('rdegrau', 'Degrau de um nível entre peças e queda de rio pagam pontos', { s: 28 }, () => {
  [2, 1, 0].forEach((h, i) => tile(i, 0, { c: C.pr, h, deco: i === 1 ? (x, y) => pine(x - 4, y + 2, .9) : undefined }));
  tile(4, -1, { c: C.pr, h: 1 }); tile(5, -1, { c: C.pr, h: 0 });
  river([P(4, -1, 1, -6, -2), P(4, -1, 1), E(4, -1, 0, 1)], {});
  const f0 = E(4, -1, 0, 1), f1_ = E(4, -1, 0, 0);
  river([[f0[0], f0[1]], [f1_[0], f1_[1] + 1], P(5, -1, 0), E(5, -1, 0, 0)]);
  add(`<path d="M${f1(f0[0] - 5)} ${f1(f0[1])}v${L}M${f1(f0[0])} ${f1(f0[1])}v${L}M${f1(f0[0] + 5)} ${f1(f0[1])}v${L}" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-opacity=".85"/>`);
  const a = E(0, 0, 0, 2), b = E(1, 0, 0, 1);
  badge(a[0], a[1] - 30, 'degrau +3'); badge(b[0], b[1] - 28, 'degrau +3');
  badge(f0[0] + 6, f0[1] - 34, 'queda +5', { fill: C.gold });
  [2, 1, 0].forEach((h, i) => hnum(i, 0, h, -22, 8, h));
  label(P(1, 0)[0] - 2, P(1, 0)[1] + 52, 'mirante', { s: 11 }); label(f0[0] + 6, P(4, -1)[1] + 50, 'cachoeira', { s: 11 });
});

F['relevo-agua'] = fig('ragua', 'O rio só emenda com rio do mesmo nível ou um nível abaixo; subir não emenda', { s: 28 }, () => {
  tile(0, 0, { c: C.pr, h: 1 }); tile(1, 0, { c: C.pr, h: 1 }); tile(2, 0, { c: C.pr, h: 0 }); tile(3, 0, { c: C.pr, h: 1, deco: (x, y) => '' });
  topPoly(3, 0, 1, '#c0432e', .22);
  river([E(0, 0, 3, 1), P(0, 0, 1), P(1, 0, 1), P(2, 0, 0)]);
  river([P(2, 0, 0), E(2, 0, 0, 0)], { col: '#8fa3ad', hi: .1 });
  river([P(3, 0, 1, -4), P(3, 0, 1, 12)], { col: '#8fa3ad', hi: .1 });
  const g = (p, q) => arrow(p, q, { col: '#17517a', w: 2.2, head: 6 });
  g([P(0, 0, 1)[0] + 4, P(0, 0, 1)[1] - 12], [P(1, 0, 1)[0] - 4, P(1, 0, 1)[1] - 12]);
  g([P(1, 0, 1)[0] + 4, P(1, 0, 1)[1] - 12], [P(2, 0, 0)[0] - 4, P(2, 0, 0)[1] - 12]);
  ok(P(0, 0, 1)[0] + 20, P(0, 0, 1)[1] + 20); ok(P(1, 0, 1)[0] + 22, P(1, 0, 1)[1] + 20);
  no(E(2, 0, 0, 0.5)[0] + 2, E(2, 0, 0, 0.5)[1] - 14);
  label(P(1, 0, 1)[0] + 4, P(1, 0, 1)[1] - 44, 'desce: emenda', { s: 11 }); label(P(3, 0, 1)[0] + 4, P(3, 0, 1)[1] + 42, 'sobe: não emenda', { s: 10.5 });
  label(P(2, 0, 0)[0] - 6, P(2, 0, 0)[1] + 44, 'rio sem saída é o risco', { s: 10, a: 'end' });
});

F['relevo-vila-planta'] = fig('rvp', 'Vila rende no alto e plantação rende embaixo', { s: 30 }, () => {
  tile(0, 0, { c: C.vi, h: 2, deco: (x, y) => house(x - 8, y + 3) + house(x + 7, y - 2) });
  tile(1, 0, { c: C.pr, h: 1 }); tile(2, 0, { c: C.pl, h: 0, deco: (x, y) => wheat(x - 8, y + 3) + wheat(x + 6, y - 1) + wheat(x - 1, y - 5) });
  tile(0, 1, { c: C.pl, h: 2, deco: (x, y) => wheat(x - 7, y + 3) + wheat(x + 7, y - 1) }); tile(3, -1, { c: C.vi, h: 0, deco: (x, y) => house(x - 6, y + 3) + house(x + 7, y - 2) });
  const a = P(0, 0, 2), b = P(2, 0, 0), c = P(0, 1, 2), d = P(3, -1, 0);
  badge(a[0], a[1] - 28, 'vila alta +4'); badge(b[0], b[1] + 28, 'plantação baixa +4'); badge(c[0] + 6, c[1] + 28, 'plantação alta: 0', { fill: 'var(--card)', fg: 'var(--ink)' }); badge(d[0], d[1] - 28, 'vila baixa: 0', { fill: 'var(--card)', fg: 'var(--ink)' });
});

F['relevo-vento'] = fig('rvento', 'Moinho no alto pega o vento; vila na sombra do paredão perde pontos', { s: 30 }, () => {
  tile(0, -1, { c: C.pr, h: 2, deco: (x, y) => `<path d="M${f1(x - 13)} ${f1(y + 5)}l9-15 6 9 5-7 8 13z" fill="#9a9a8c" stroke="#5a5a4c" stroke-width=".9" stroke-linejoin="round"/>` });
  tile(0, 0, { c: C.vi, deco: (x, y) => house(x - 8, y + 4) + house(x + 7, y - 1) });
  topPoly(0, 0, 0, '#101a2e', .34);
  tile(2, -1, { c: C.pr, h: 2, deco: (x, y) => `<rect x="${f1(x - 4)}" y="${f1(y - 12)}" width="8" height="14" fill="#e6dac6" stroke="rgba(40,30,20,.5)" stroke-width=".7"/><path d="M${f1(x)} ${f1(y - 13)}l-12-7m12 7l12-7m-12 7l-7 12m7-12l7 12" stroke="#5b4326" stroke-width="2" stroke-linecap="round"/>` });
  const s = P(0, -1, 2, -28, -34); sun(s[0] + 8, s[1]);
  arrow([s[0] + 16, s[1] + 10], [P(0, -1, 2)[0] + 8, P(0, -1, 2)[1] - 14], { col: C.gold, w: 2.2, head: 6 });
  add(`<path d="M${f1(P(2, -1, 2)[0] + 40)} ${f1(P(2, -1, 2)[1] - 8)}q-14 -5 -28 0M${f1(P(2, -1, 2)[0] + 40)} ${f1(P(2, -1, 2)[1] + 4)}q-14 -5 -28 0" stroke="#6c8aa0" stroke-width="2" fill="none" stroke-linecap="round"/>`);
  badge(P(2, -1, 2)[0], P(2, -1, 2)[1] - 38, 'moinho alto: bônus'); badge(P(0, 0)[0], P(0, 0)[1] + 30, 'na sombra: perde', { fill: '#e8b3a6' });
  label(P(0, -1, 2)[0] - 6, P(0, -1, 2)[1] - 24, 'paredão ao sul', { s: 10.5, a: 'start' });
  label(P(2, -1, 2)[0] + 44, P(2, -1, 2)[1] + 22, 'vento', { s: 10.5, a: 'end' });
});

F['relevo-visual'] = fig('rvis', 'A altura é só enfeite da casa: platôs e degraus aparecem, mas nenhuma regra os lê', { s: 30 }, () => {
  [[0, 0, 2], [1, 0, 1], [2, 0, 0]].forEach(([q, r, h], i) => tile(q, r, { c: i === 1 ? C.fl : C.pr, h, deco: i === 1 ? (x, y) => pine(x - 6, y + 3) + pine(x + 7, y - 1) : (x, y) => house(x - 7, y + 3) + house(x + 7, y - 2) }));
  [2, 1, 0].forEach((h, i) => { const p = P(i, 0, h); badge(p[0], p[1] + 34, '0', { fill: 'var(--card)', fg: 'var(--ink)' }); });
  label(P(1, 0, 1)[0], P(1, 0, 1)[1] - 40, 'cada peça tem seu degrau', { s: 11 }); label(P(1, 0, 1)[0], P(1, 0, 1)[1] + 78, 'pontos pela altura: nenhum', { s: 11 });
});

export const COUNTS = Object.fromEntries(Object.entries(F).map(([k, v]) => [k, (v.match(/<(path|rect|circle|polygon|line|text|ellipse|polyline)\b/g) || []).length]));
