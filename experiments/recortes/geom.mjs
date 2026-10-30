// Geometria dos Recortes em coordenadas inteiras (ponto fixo).
// Unidade: o lado do hexágono de hoje = S = 1000. Tudo que decide (vértices, translações,
// vetores de aresta) é inteiro; só comprimentos e distâncias de tolerância usam float
// (somas, produtos e raiz quadrada, que são exatas em IEEE, sem sin/cos no caminho das jogadas).

export const S = 1000;
export const HEX_AREA = 1.5 * Math.sqrt(3) * S * S; // ~2,598 milhões

/** Mesmo gerador do jogo (src/core/rng.ts), copiado para o experimento ser autônomo. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export function weighted(rng, items) {
  let total = 0;
  for (const [, w] of items) total += w;
  let x = rng() * total;
  for (const [v, w] of items) {
    x -= w;
    if (x <= 0) return v;
  }
  return items[items.length - 1][0];
}

// Tabela de 24 direções (passos de 15°) com vetores de comprimento ~500, em inteiros.
// O primeiro quadrante é fixo; os outros saem de giros EXATOS de 90°. Os índices pares
// (30°) obedecem d[k+4] = d[k+2] - d[k], então todo polígono fechado na treliça de 30°
// continua fechado depois de qualquer giro de 30° (ver pieces.mjs).
const Q1 = [[500, 0], [483, 129], [433, 250], [354, 354], [250, 433], [129, 483]];
export const D24 = [];
for (let q = 0; q < 4; q++) {
  for (const [x0, y0] of Q1) {
    let x = x0, y = y0;
    for (let k = 0; k < q; k++) [x, y] = [-y, x];
    D24.push([x, y]);
  }
}

// Giro de vértices livres (família ii): matriz inteira com escala 4096, 24 passos de 15°.
export const ROT = [];
for (let a = 0; a < 24; a++) ROT.push([Math.round(4096 * Math.cos((a * Math.PI) / 12)), Math.round(4096 * Math.sin((a * Math.PI) / 12))]);

export const hyp = (x, y) => Math.sqrt(x * x + y * y);

/** Área com sinal (positiva em sentido anti-horário) e centroide de um polígono. */
export function areaCentroid(vx, vy) {
  const n = vx.length;
  let a2 = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const c = vx[i] * vy[j] - vx[j] * vy[i];
    a2 += c;
    cx += (vx[i] + vx[j]) * c;
    cy += (vy[i] + vy[j]) * c;
  }
  if (a2 === 0) return { area: 0, cx: vx[0], cy: vy[0] };
  return { area: a2 / 2, cx: cx / (3 * a2), cy: cy / (3 * a2) };
}

/** Interseção própria de segmentos (só cruzamento verdadeiro, em inteiros exatos). */
export function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** O polígono é simples (sem cruzamentos entre arestas não adjacentes)? */
export function isSimple(vx, vy) {
  const n = vx.length;
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const j2 = (j + 1) % n;
      if (segCross(vx[i], vy[i], vx[i2], vy[i2], vx[j], vy[j], vx[j2], vy[j2])) return false;
    }
  }
  return true;
}

function distSeg2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}

/** Menor distância entre arestas não adjacentes (para recusar gargalos finos demais). */
export function minNeck(vx, vy) {
  const n = vx.length;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const j2 = (j + 1) % n;
      const d = Math.min(
        distSeg2(vx[i], vy[i], vx[j], vy[j], vx[j2], vy[j2]),
        distSeg2(vx[i2], vy[i2], vx[j], vy[j], vx[j2], vy[j2]),
        distSeg2(vx[j], vy[j], vx[i], vy[i], vx[i2], vy[i2]),
        distSeg2(vx[j2], vy[j2], vx[i], vy[i], vx[i2], vy[i2]),
      );
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

/**
 * Ponto (px, py) dentro do polígono E a mais de `tol` de qualquer aresta?
 * É o núcleo do teste de sobreposição com tolerância: encostar na borda não conta,
 * entrar além de `tol` conta. `tol2` = tol ao quadrado.
 */
export function deepInside(px, py, vx, vy, tol2) {
  const n = vx.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vx[i], yi = vy[i], xj = vx[j], yj = vy[j];
    const dx = xi - xj, dy = yi - yj;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - xj) * dx + (py - yj) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = xj + t * dx - px, qy = yj + t * dy - py;
    if (qx * qx + qy * qy <= tol2) return false;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Pontos de amostra no contorno: os vértices e pontos a cada ~`step` ao longo das arestas. */
export function boundarySamples(vx, vy, step) {
  const n = vx.length;
  const sx = [], sy = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = vx[j] - vx[i], dy = vy[j] - vy[i];
    const l = hyp(dx, dy);
    const k = Math.max(1, Math.round(l / step));
    for (let m = 0; m < k; m++) {
      sx.push(vx[i] + (dx * m) / k);
      sy.push(vy[i] + (dy * m) / k);
    }
  }
  return { sx, sy };
}

/** Retira o trecho [a, b] de uma lista de intervalos [s0, s1, s0, s1, ...] (ordenada). */
export function subtractInterval(list, a, b) {
  const out = [];
  for (let i = 0; i < list.length; i += 2) {
    const s0 = list[i], s1 = list[i + 1];
    if (b <= s0 || a >= s1) {
      out.push(s0, s1);
      continue;
    }
    if (a > s0) out.push(s0, a);
    if (b < s1) out.push(b, s1);
  }
  return out;
}
export const sumIntervals = (list) => {
  let t = 0;
  for (let i = 0; i < list.length; i += 2) t += list[i + 1] - list[i];
  return t;
};
