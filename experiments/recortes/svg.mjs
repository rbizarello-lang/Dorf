// Desenho dos mapas dos Recortes em SVG, nas cores do jogo.
import { hyp } from './geom.mjs';
import { WATER, shapeAt } from './pieces.mjs';
import { mulberry32 } from './geom.mjs';

export const COL = { 0: '#8dbb5a', 1: '#3f7a45', 2: '#d9b44a', 3: '#c9b8a0', 4: '#4f9fc8', sea: '#6fb7d6' };
const f1 = (v) => Math.round(v * 10) / 10;
const pts = (xs, ys) => xs.map((x, i) => `${f1(x)},${f1(ys[i])}`).join(' ');

/** Rótulo efetivo por aresta: a boca de rio herda o terreno da aresta anterior (só para pintar). */
function effLabels(labels) {
  const n = labels.length;
  const out = labels.slice();
  for (let i = 0; i < n; i++) {
    if (out[i] !== WATER) continue;
    let k = 1;
    while (k < n && labels[(i - k + n) % n] === WATER) k++;
    out[i] = labels[(i - k + n) % n] === WATER ? 0 : labels[(i - k + n) % n];
  }
  return out;
}

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return Math.sqrt(qx * qx + qy * qy);
}

function inPoly(px, py, vx, vy) {
  let inside = false;
  for (let i = 0, j = vx.length - 1; i < vx.length; j = i++) if (vy[i] > py !== vy[j] > py && px < ((vx[j] - vx[i]) * (py - vy[i])) / (vy[j] - vy[i]) + vx[i]) inside = !inside;
  return inside;
}

/** Caminho do rio dentro da peça (para desenhar). */
function riverPaths(vx, vy, labels, cx, cy) {
  const n = vx.length;
  const ms = [];
  for (let i = 0; i < n; i++) if (labels[i] === WATER) ms.push([(vx[i] + vx[(i + 1) % n]) / 2, (vy[i] + vy[(i + 1) % n]) / 2]);
  if (!ms.length) return { paths: [], ms };
  if (ms.length === 2) return { paths: [`M${f1(ms[0][0])},${f1(ms[0][1])} Q${f1(cx)},${f1(cy)} ${f1(ms[1][0])},${f1(ms[1][1])}`], ms };
  return { paths: ms.map((m) => `M${f1(m[0])},${f1(m[1])} Q${f1((m[0] + cx) / 2 + (cy - m[1]) * 0.12)},${f1((m[1] + cy) / 2 - (cx - m[0]) * 0.12)} ${f1(cx)},${f1(cy)}`), ms };
}

/** Desenha uma peça colocada (dentro de um <g> recortado pelo contorno). */
function pieceSvg(pc, uid, o) {
  const { vx, vy, piece } = pc;
  const n = vx.length;
  const labels = piece.labels;
  const eff = effLabels(labels);
  const cx = pc.cx, cy = pc.cy;
  let out = `<clipPath id="c${uid}"><polygon points="${pts(vx, vy)}"/></clipPath>`;
  out += `<g clip-path="url(#c${uid})">`;
  out += `<rect x="${f1(pc.minx - 10)}" y="${f1(pc.miny - 10)}" width="${f1(pc.maxx - pc.minx + 20)}" height="${f1(pc.maxy - pc.miny + 20)}" fill="${COL[0]}"/>`;
  // cunhas por trecho de mesmo terreno
  let i = 0;
  const runs = [];
  const start = eff.findIndex((t, k) => t !== eff[(k - 1 + n) % n]);
  if (start < 0) runs.push({ t: eff[0], a: 0, b: n });
  else {
    i = 0;
    while (i < n) {
      const a = (start + i) % n;
      let len = 1;
      while (i + len < n && eff[(start + i + len) % n] === eff[a]) len++;
      runs.push({ t: eff[a], a, b: a + len });
      i += len;
    }
  }
  for (const run of runs) {
    const ring = [`${f1(cx)},${f1(cy)}`];
    for (let k = run.a; k <= run.b; k++) {
      const v = k % n;
      ring.push(`${f1(cx + (vx[v] - cx) * 2.6)},${f1(cy + (vy[v] - cy) * 2.6)}`);
    }
    out += `<polygon points="${ring.join(' ')}" fill="${COL[run.t]}" stroke="${COL[run.t]}" stroke-width="16" stroke-linejoin="round"/>`;
  }
  // rio
  const rv = riverPaths(vx, vy, labels, cx, cy);
  for (const d of rv.paths) {
    out += `<path d="${d}" fill="none" stroke="${COL[4]}" stroke-width="170" stroke-linecap="round" stroke-linejoin="round"/>`;
    out += `<path d="${d}" fill="none" stroke="#86c3e6" stroke-width="60" stroke-linecap="round" opacity=".7"/>`;
  }
  // decoração
  const rng = mulberry32(piece.seedDeco);
  const area = (pc.maxx - pc.minx) * (pc.maxy - pc.miny);
  const count = Math.round(area / 380000) + 4;
  let placed = 0;
  for (let tries = 0; tries < 700 && placed < count; tries++) {
    const px = pc.minx + rng() * (pc.maxx - pc.minx), py = pc.miny + rng() * (pc.maxy - pc.miny);
    if (!inPoly(px, py, vx, vy)) continue;
    let best = 1e9, bi = 0;
    for (let k = 0; k < n; k++) {
      const d = distSeg(px, py, vx[k], vy[k], vx[(k + 1) % n], vy[(k + 1) % n]);
      if (d < best) {
        best = d;
        bi = k;
      }
    }
    if (best < 70) continue;
    let nearRiver = false;
    for (const m of rv.ms) {
      if (hyp(px - m[0], py - m[1]) < 260) nearRiver = true;
      if (distSeg(px, py, m[0], m[1], cx, cy) < 150) nearRiver = true;
    }
    if (nearRiver) continue;
    const t = eff[bi];
    placed++;
    if (t === 1) out += `<circle cx="${f1(px)}" cy="${f1(py)}" r="62" fill="#2c6338"/><circle cx="${f1(px - 14)}" cy="${f1(py - 16)}" r="30" fill="#4d8f55" opacity=".8"/>`;
    else if (t === 2) out += `<path d="M${f1(px - 90)},${f1(py - 30)}h180M${f1(px - 90)},${f1(py + 10)}h180M${f1(px - 90)},${f1(py + 50)}h180" stroke="#c19a2e" stroke-width="16" stroke-linecap="round"/>`;
    else if (t === 3) out += `<rect x="${f1(px - 45)}" y="${f1(py - 30)}" width="90" height="62" fill="#efe3cf"/><polygon points="${f1(px - 56)},${f1(py - 28)} ${f1(px)},${f1(py - 72)} ${f1(px + 56)},${f1(py - 28)}" fill="#b45f45"/>`;
    else out += `<circle cx="${f1(px)}" cy="${f1(py)}" r="20" fill="#a8cf74"/>`;
  }
  out += `</g>`;
  return out;
}

/**
 * Mapa inteiro como <g>. opts: { outline, snap (exposições por peça), only (n primeiras peças),
 * highlight (id da peça), ghosts [{piece, pose}] , scale (px por unidade, para espessuras) }
 */
export function mapGroup(world, uidPrefix, o = {}) {
  const pcs = o.only != null ? world.pieces.slice(0, o.only) : world.pieces;
  let out = '';
  // mar raso e espuma
  out += `<g fill="none" stroke-linejoin="round">`;
  for (const pc of pcs) out += `<polygon points="${pts(pc.vx, pc.vy)}" fill="#8ccbe3" stroke="#8ccbe3" stroke-width="900"/>`;
  for (const pc of pcs) out += `<polygon points="${pts(pc.vx, pc.vy)}" fill="#a9dcee" stroke="#a9dcee" stroke-width="470"/>`;
  for (const pc of pcs) out += `<polygon points="${pts(pc.vx, pc.vy)}" fill="#e9f7fb" stroke="#e9f7fb" stroke-width="150"/>`;
  out += `</g>`;
  // base de terra (cobre frestas de antialiasing entre peças)
  for (const pc of pcs) out += `<polygon points="${pts(pc.vx, pc.vy)}" fill="${COL[0]}" stroke="${COL[0]}" stroke-width="30" stroke-linejoin="round"/>`;
  for (const pc of pcs) out += pieceSvg(pc, `${uidPrefix}_${pc.id}`, o);
  if (o.outline) for (const pc of pcs) out += `<polygon points="${pts(pc.vx, pc.vy)}" fill="none" stroke="#1f3a22" stroke-opacity=".38" stroke-width="12" stroke-linejoin="round"/>`;
  // costa exposta (areia)
  out += `<g stroke="#efe6bd" stroke-width="46" stroke-linecap="round" fill="none">`;
  for (const pc of pcs) {
    const snap = o.snap ? o.snap[pc.id] : null;
    for (let k = 0; k < pc.edges.length; k++) {
      const e = pc.edges[k];
      const ex = snap ? snap[k] : e.exp;
      for (let q = 0; q < ex.length; q += 2) {
        const t0 = ex[q] / e.len, t1 = ex[q + 1] / e.len;
        if (ex[q + 1] - ex[q] < 20) continue;
        const col = e.label === WATER ? COL[4] : '#efe6bd';
        const w = e.label === WATER ? 150 : 46;
        out += `<line x1="${f1(e.ax + (e.bx - e.ax) * t0)}" y1="${f1(e.ay + (e.by - e.ay) * t0)}" x2="${f1(e.ax + (e.bx - e.ax) * t1)}" y2="${f1(e.ay + (e.by - e.ay) * t1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="${e.label === WATER ? 'butt' : 'round'}"/>`;
      }
    }
  }
  out += `</g>`;
  if (o.highlight != null) {
    const pc = world.pieces[o.highlight];
    if (pc) out += `<polygon points="${pts(pc.vx, pc.vy)}" fill="#ffffff" fill-opacity=".10" stroke="#ffffff" stroke-width="34" stroke-linejoin="round"/>`;
  }
  if (o.ghosts) {
    for (const g of o.ghosts) {
      const sh = shapeAt(g.piece, g.pose.r);
      const vx = sh.vx.map((v) => v + g.pose.tx), vy = sh.vy.map((v) => v + g.pose.ty);
      out += `<polygon points="${pts(vx, vy)}" fill="${g.fill ?? 'none'}" fill-opacity=".18" stroke="${g.stroke ?? '#ffffff'}" stroke-width="${g.w ?? 22}" stroke-dasharray="${g.dash ?? '70 50'}" stroke-linejoin="round" opacity=".85"/>`;
    }
  }
  return out;
}

export function bounds(world, only) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  const pcs = only != null ? world.pieces.slice(0, only) : world.pieces;
  for (const pc of pcs) {
    minx = Math.min(minx, pc.minx);
    maxx = Math.max(maxx, pc.maxx);
    miny = Math.min(miny, pc.miny);
    maxy = Math.max(maxy, pc.maxy);
  }
  return { minx, miny, maxx, maxy };
}

/** Um SVG completo de um mapa. */
export function mapSvg(world, o = {}) {
  const b = o.view ?? bounds(world, o.only);
  const m = o.margin ?? 1500;
  const w = b.maxx - b.minx + 2 * m, h = b.maxy - b.miny + 2 * m;
  const W = o.width ?? 1400;
  const H = Math.round((W * h) / w);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${f1(b.minx - m)} ${f1(b.miny - m)} ${f1(w)} ${f1(h)}">`;
  s += `<rect x="${f1(b.minx - m)}" y="${f1(b.miny - m)}" width="${f1(w)}" height="${f1(h)}" fill="${COL.sea}"/>`;
  s += mapGroup(world, o.uid ?? 'm', o);
  if (o.title) s += `<text x="${f1(b.minx - m + 260)}" y="${f1(b.miny - m + 700)}" font-family="sans-serif" font-size="560" fill="#0d2b3a" opacity=".85">${o.title}</text>`;
  return s + '</svg>';
}

/** Grade de peças soltas (galeria para julgar o formato). */
export function galleryPieces(pieces, cols = 6, label = '') {
  const cell = 3800;
  const rows = Math.ceil(pieces.length / cols);
  const W = cols * cell, H = rows * cell + 600;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W / 4)}" height="${Math.round(H / 4)}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${COL.sea}"/>`;
  s += `<text x="150" y="480" font-family="sans-serif" font-size="400" fill="#0d2b3a">${label}</text>`;
  pieces.forEach((p, i) => {
    const sh = shapeAt(p, 0);
    const ox = (i % cols) * cell + cell / 2 - sh.cx, oy = Math.floor(i / cols) * cell + cell / 2 + 600 - sh.cy;
    const vx = sh.vx.map((v) => v + ox), vy = sh.vy.map((v) => v + oy);
    const pc = { piece: p, vx, vy, cx: sh.cx + ox, cy: sh.cy + oy, minx: sh.minx + ox, maxx: sh.maxx + ox, miny: sh.miny + oy, maxy: sh.maxy + oy, id: i, edges: [] };
    s += `<polygon points="${pts(vx, vy)}" fill="#e9f7fb" stroke="#e9f7fb" stroke-width="150" stroke-linejoin="round"/>`;
    s += `<polygon points="${pts(vx, vy)}" fill="${COL[0]}"/>`;
    s += pieceSvg(pc, `g${i}`, {});
    s += `<polygon points="${pts(vx, vy)}" fill="none" stroke="#1f3a22" stroke-opacity=".4" stroke-width="14" stroke-linejoin="round"/>`;
    for (let k = 0; k < p.n; k++) {
      if (p.labels[k] !== WATER) continue;
      const k2 = (k + 1) % p.n;
      s += `<line x1="${f1(vx[k])}" y1="${f1(vy[k])}" x2="${f1(vx[k2])}" y2="${f1(vy[k2])}" stroke="${COL[4]}" stroke-width="150"/>`;
    }
  });
  return s + '</svg>';
}
