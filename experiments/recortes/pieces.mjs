// Geração das peças dos Recortes: polígonos de contorno orgânico, em inteiros.
//
// Famílias:
//   i30  costas quantizadas: toda aresta tem o mesmo comprimento (~500) e direção múltipla de 30°.
//        Giros de 30° são exatos (índices da tabela D24 somam), então o "ímã" é exato.
//   i15  o mesmo com direções de 15° (24 giros).
//   ii   contorno livre: polígono radial com lóbulos e baías, vértices inteiros arbitrários;
//        giro de 15° por matriz inteira e encaixe por tolerância.
//
// Rótulos por aresta: 0 prado, 1 floresta, 2 plantação, 3 vila (terra), 4 rio (boca do rio na costa).

import { D24, HEX_AREA, ROT, S, areaCentroid, boundarySamples, hyp, isSimple, minNeck, mulberry32, randInt, weighted } from './geom.mjs';

export const WATER = 4;
const LAND_WEIGHTS = [[0, 0.24], [1, 0.3], [2, 0.22], [3, 0.24]];
const pickLand = (rng, exclude = -1) => weighted(rng, LAND_WEIGHTS.filter(([t]) => t !== exclude));

export const FAMILIES = {
  i30: { step: 2, rots: 12, mouth: 500, tol: 3, ang: 0.9999, dTol: 3 },
  i15: { step: 1, rots: 24, mouth: 500, tol: 3, ang: 0.9999, dTol: 3 },
  ii: { step: 1, rots: 24, mouth: 400, tol: 50, ang: Math.cos((11 * Math.PI) / 180), dTol: 60 },
};

/** Posições das bocas de rio: 2 (85%) ou 3 (15%), afastadas e sem se tocarem. */
function placeMouths(rng, n, elig) {
  const want = rng() < 0.85 ? 2 : 3;
  for (let tries = 0; tries < 60; tries++) {
    const s = randInt(rng, 0, n - 1);
    const out = [s];
    if (want === 2) out.push((s + Math.round(n / 2) + randInt(rng, -2, 2) + n) % n);
    else {
      out.push((s + Math.round(n / 3) + randInt(rng, -1, 1) + n) % n);
      out.push((s + Math.round((2 * n) / 3) + randInt(rng, -1, 1) + n) % n);
    }
    let ok = out.every((m) => elig(m));
    for (let a = 0; a < out.length && ok; a++)
      for (let b = a + 1; b < out.length; b++) {
        const d = Math.abs(out[a] - out[b]);
        if (Math.min(d, n - d) < 3) ok = false;
      }
    if (ok) return out.sort((a, b) => a - b);
  }
  return null;
}

/** Terrenos das arestas de terra (1 a 3 terrenos no total, trechos contíguos). */
function assignLabels(rng, n, mouths) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const labels = new Array(n).fill(-1);
    for (const m of mouths) labels[m] = WATER;
    if (!mouths.length) {
      const k = weighted(rng, [[1, 0.28], [2, 0.47], [3, 0.25]]);
      const cuts = new Set();
      while (cuts.size < k) cuts.add(randInt(rng, 0, n - 1));
      const sorted = [...cuts].sort((a, b) => a - b);
      let prev = -1;
      for (let j = 0; j < sorted.length; j++) {
        const t = pickLand(rng, prev);
        prev = t;
        const end = j + 1 < sorted.length ? sorted[j + 1] : sorted[0] + n;
        for (let i = sorted[j]; i < end; i++) labels[i % n] = t;
      }
      return labels;
    }
    const start = mouths[0];
    let i = 1;
    while (i <= n) {
      const idx = (start + i) % n;
      if (labels[idx] !== -1) {
        i++;
        continue;
      }
      let len = 0;
      while (i + len <= n && labels[(start + i + len) % n] === -1) len++;
      const t1 = pickLand(rng);
      const split = len >= 2 && rng() < 0.45 ? randInt(rng, 1, len - 1) : len;
      const t2 = pickLand(rng, t1);
      for (let j = 0; j < len; j++) labels[(start + i + j) % n] = j < split ? t1 : t2;
      i += len;
    }
    if (new Set(labels.filter((t) => t !== WATER)).size <= 3) return labels;
  }
  return new Array(n).fill(pickLand(rng));
}

/** Gera polígono da família i: arestas de tamanho fixo, em ordem angular com desordem local. */
function genI(rng, step, patch) {
  const pairsOnly = step === 1;
  for (let attempt = 0; attempt < 600; attempt++) {
    const target = patch ? 8 : weighted(rng, [[12, 1], [14, 3], [16, 2]]);
    const idx = [];
    while (idx.length < target) {
      const k = step * randInt(rng, 0, 24 / step - 1);
      if (!pairsOnly && !patch && rng() < 0.3 && idx.length + 3 <= target + 1) idx.push(k, (k + 8) % 24, (k + 16) % 24);
      else idx.push(k, (k + 12) % 24);
    }
    const keyed = idx.map((k) => [k + (rng() - 0.5) * 2.6, k]).sort((a, b) => a[0] - b[0]);
    const seq = keyed.map((e) => e[1]);
    const swaps = patch ? 0 : randInt(rng, 0, 3);
    for (let s = 0; s < swaps; s++) {
      const a = randInt(rng, 0, seq.length - 2);
      [seq[a], seq[a + 1]] = [seq[a + 1], seq[a]];
    }
    const rot = randInt(rng, 0, seq.length - 1);
    const dirs = seq.slice(rot).concat(seq.slice(0, rot));
    const vx = [], vy = [];
    let x = 0, y = 0;
    for (const k of dirs) {
      vx.push(x);
      vy.push(y);
      x += D24[k][0];
      y += D24[k][1];
    }
    if (x !== 0 || y !== 0) continue; // a tabela garante o fechamento; seguro mesmo assim
    const { area } = areaCentroid(vx, vy);
    const ah = area / HEX_AREA;
    if (patch ? ah < 0.32 || ah > 0.6 : ah < 1.02 || ah > 2.0) continue;
    if (!isSimple(vx, vy) || minNeck(vx, vy) < (patch ? 180 : 260)) continue;
    return { dirs };
  }
  throw new Error('genI: sem polígono');
}

/** Gera polígono da família ii: contorno radial com lóbulos, às vezes uma baía. */
function genII(rng, patch) {
  for (let attempt = 0; attempt < 600; attempt++) {
    const N = patch ? randInt(rng, 8, 10) : randInt(rng, 13, 17);
    const ph = [rng() * 6.283, rng() * 6.283, rng() * 6.283];
    const am = [0.1 + rng() * 0.22, 0.04 + rng() * 0.16, 0.02 + rng() * 0.1];
    const th = [], r = [];
    for (let i = 0; i < N; i++) {
      const t = (2 * Math.PI * (i + (rng() - 0.5) * 0.55)) / N;
      th.push(t);
      r.push(1 + am[0] * Math.sin(t + ph[0]) + am[1] * Math.sin(2 * t + ph[1]) + am[2] * Math.sin(3 * t + ph[2]) + (rng() - 0.5) * 0.12);
    }
    if (!patch && rng() < 0.25) {
      const j = randInt(rng, 0, N - 1);
      r[j] *= 0.62;
      r[(j + 1) % N] *= 0.7;
    }
    const rx = th.map((t, i) => Math.cos(t) * r[i]);
    const ry = th.map((t, i) => Math.sin(t) * r[i]);
    const a0 = areaCentroid(rx, ry).area;
    if (a0 <= 0) continue;
    const target = (patch ? 0.32 + rng() * 0.2 : 1.05 + rng() * 0.9) * HEX_AREA;
    const sc = Math.sqrt(target / a0);
    const bx = rx.map((v) => Math.round(v * sc)), by = ry.map((v) => Math.round(v * sc));
    let minEdge = Infinity;
    for (let i = 0; i < N; i++) minEdge = Math.min(minEdge, hyp(bx[(i + 1) % N] - bx[i], by[(i + 1) % N] - by[i]));
    if (minEdge < (patch ? 170 : 230)) continue;
    if (!isSimple(bx, by) || minNeck(bx, by) < (patch ? 180 : 260)) continue;
    return { bx, by };
  }
  throw new Error('genII: sem polígono');
}

/** Reconstrói o polígono da família ii com uma boca de rio de comprimento `w` no meio de cada aresta em `mouthEdges`. */
function withMouths(bx, by, mouthEdges, w) {
  const n = bx.length, set = new Set(mouthEdges);
  const ox = [], oy = [], isMouth = [];
  for (let i = 0; i < n; i++) {
    ox.push(bx[i]);
    oy.push(by[i]);
    isMouth.push(false);
    if (!set.has(i)) continue;
    const i2 = (i + 1) % n;
    const mx = (bx[i] + bx[i2]) / 2, my = (by[i] + by[i2]) / 2;
    const dx = bx[i2] - bx[i], dy = by[i2] - by[i];
    const l = hyp(dx, dy);
    const ux = dx / l, uy = dy / l;
    ox.push(Math.round(mx - (ux * w) / 2), Math.round(mx + (ux * w) / 2));
    oy.push(Math.round(my - (uy * w) / 2), Math.round(my + (uy * w) / 2));
    isMouth.push(true, false); // aresta p1->p2 é a boca; p2->próximo é terra
  }
  return { bx: ox, by: oy, isMouth };
}

/**
 * Uma peça sorteada por (semente, índice), igual para quem joga a mesma semente.
 * `patch` = o "remendo": peça pequena de um terreno só, para tapar fendas.
 */
export function makePiece(fam, seed, k, patch = false) {
  const F = FAMILIES[fam];
  const rng = mulberry32((seed + Math.imul(k + 1, 0x9e3779b1)) >>> 0);
  const piece = { fam, step: F.step, rots: F.rots, patch, cache: [], mouths: [], seedDeco: Math.floor(rng() * 2 ** 31), k };
  const wantRiver = !patch && rng() < 0.17;
  if (fam === 'ii') {
    const g = genII(rng, patch);
    let bx = g.bx.slice(), by = g.by.slice();
    let isMouth = bx.map(() => false);
    if (wantRiver) {
      const n0 = bx.length;
      const elig = (e) => hyp(bx[(e + 1) % n0] - bx[e], by[(e + 1) % n0] - by[e]) >= F.mouth + 130;
      const mouths = placeMouths(rng, n0, elig);
      if (mouths) ({ bx, by, isMouth } = withMouths(bx, by, mouths, F.mouth));
    }
    piece.n = bx.length;
    // centra no centroide para o giro ficar simétrico
    const c = areaCentroid(bx, by);
    const ox = Math.round(c.cx), oy = Math.round(c.cy);
    piece.bx = bx.map((v) => v - ox);
    piece.by = by.map((v) => v - oy);
    piece.mouths = isMouth.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
    piece.labels = assignLabels(rng, bx.length, piece.mouths);
  } else {
    const g = genI(rng, F.step, patch);
    const n = g.dirs.length;
    piece.n = n;
    piece.dirs = g.dirs;
    let mouths = [];
    if (wantRiver) mouths = placeMouths(rng, n, () => true) ?? [];
    piece.mouths = mouths;
    piece.labels = assignLabels(rng, n, mouths);
  }
  const sh = shapeAt(piece, 0);
  piece.area = sh.area;
  piece.perim = sh.perim;
  piece.terrains = [...new Set(piece.labels)].sort();
  return piece;
}

/** Forma da peça no giro r (0..rots-1), com a origem no vértice 0. Em cache. */
export function shapeAt(p, r) {
  const hit = p.cache[r];
  if (hit) return hit;
  const n = p.n;
  const vx = new Array(n), vy = new Array(n), bin = new Array(n);
  let aIdx;
  if (p.dirs) {
    const shift = r * p.step;
    aIdx = shift;
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) {
      vx[i] = x;
      vy[i] = y;
      const k = (p.dirs[i] + shift) % 24;
      bin[i] = k;
      x += D24[k][0];
      y += D24[k][1];
    }
  } else {
    const [c, s] = ROT[r];
    aIdx = r;
    const rx = [], ry = [];
    for (let i = 0; i < n; i++) {
      rx.push(Math.round((p.bx[i] * c - p.by[i] * s) / 4096));
      ry.push(Math.round((p.bx[i] * s + p.by[i] * c) / 4096));
    }
    for (let i = 0; i < n; i++) {
      vx[i] = rx[i] - rx[0];
      vy[i] = ry[i] - ry[0];
    }
  }
  const ex = new Array(n), ey = new Array(n), len = new Array(n), ux = new Array(n), uy = new Array(n);
  let perim = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    ex[i] = vx[j] - vx[i];
    ey[i] = vy[j] - vy[i];
    len[i] = hyp(ex[i], ey[i]);
    ux[i] = ex[i] / len[i];
    uy[i] = ey[i] / len[i];
    perim += len[i];
    if (!p.dirs) bin[i] = (((Math.round(Math.atan2(ey[i], ex[i]) / (Math.PI / 12)) % 24) + 24) % 24);
  }
  const { area, cx, cy } = areaCentroid(vx, vy);
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (let i = 0; i < n; i++) {
    if (vx[i] < minx) minx = vx[i];
    if (vx[i] > maxx) maxx = vx[i];
    if (vy[i] < miny) miny = vy[i];
    if (vy[i] > maxy) maxy = vy[i];
  }
  const sm = boundarySamples(vx, vy, 150);
  const sh = { r, aIdx, n, vx, vy, ex, ey, len, ux, uy, bin, area, perim, cx, cy, minx, miny, maxx, maxy, sx: sm.sx, sy: sm.sy };
  p.cache[r] = sh;
  return sh;
}

export const hexes = (area) => area / HEX_AREA;
export { S };
