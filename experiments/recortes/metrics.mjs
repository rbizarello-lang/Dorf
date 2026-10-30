// Métricas do mapa por rasterização: lagoas (mar cercado) e fendas (baías e frestas estreitas).
// A mesma conta serve ao mapa dos Recortes e ao mapa hexagonal do Clássico (comparação justa).
import { HEX_AREA } from './geom.mjs';

/** Distância ao conjunto `src` (1 = fonte) por chanfro 3-4; devolve em células (float). */
function chamfer(src, W, H) {
  const INF = 1 << 28;
  const d = new Int32Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = src[i] ? 0 : INF;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = d[i];
      if (x > 0 && d[i - 1] + 3 < v) v = d[i - 1] + 3;
      if (y > 0) {
        if (d[i - W] + 3 < v) v = d[i - W] + 3;
        if (x > 0 && d[i - W - 1] + 4 < v) v = d[i - W - 1] + 4;
        if (x < W - 1 && d[i - W + 1] + 4 < v) v = d[i - W + 1] + 4;
      }
      d[i] = v;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (x < W - 1 && d[i + 1] + 3 < v) v = d[i + 1] + 3;
      if (y < H - 1) {
        if (d[i + W] + 3 < v) v = d[i + W] + 3;
        if (x < W - 1 && d[i + W + 1] + 4 < v) v = d[i + W + 1] + 4;
        if (x > 0 && d[i + W - 1] + 4 < v) v = d[i + W - 1] + 4;
      }
      d[i] = v;
    }
  return d;
}

function components(mask, W, H) {
  const seen = new Uint8Array(W * H);
  const out = [];
  const stack = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    let size = 0;
    stack.length = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop();
      size++;
      const x = i % W, y = (i / W) | 0;
      if (x > 0 && mask[i - 1] && !seen[i - 1]) (seen[i - 1] = 1), stack.push(i - 1);
      if (x < W - 1 && mask[i + 1] && !seen[i + 1]) (seen[i + 1] = 1), stack.push(i + 1);
      if (y > 0 && mask[i - W] && !seen[i - W]) (seen[i - W] = 1), stack.push(i - W);
      if (y < H - 1 && mask[i + W] && !seen[i + W]) (seen[i + W] = 1), stack.push(i + W);
    }
    out.push(size);
  }
  return out;
}

/**
 * polys: [{vx, vy}] em unidades do mundo (lado do hexágono = 1000).
 * cell: lado da célula; closeR: raio da "régua" que define fenda (frestas mais estreitas que 2*closeR).
 */
export function rasterStats(polys, cell = 100, closeR = 500, minHex = 0.05) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const p of polys)
    for (let i = 0; i < p.vx.length; i++) {
      minx = Math.min(minx, p.vx[i]);
      maxx = Math.max(maxx, p.vx[i]);
      miny = Math.min(miny, p.vy[i]);
      maxy = Math.max(maxy, p.vy[i]);
    }
  const pad = closeR * 2 + cell * 4;
  minx -= pad;
  miny -= pad;
  const W = Math.ceil((maxx - minx + pad) / cell), H = Math.ceil((maxy - miny + pad) / cell);
  const land = new Uint8Array(W * H);
  for (const p of polys) {
    const n = p.vx.length;
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      y0 = Math.min(y0, p.vy[i]);
      y1 = Math.max(y1, p.vy[i]);
    }
    for (let row = Math.max(0, Math.floor((y0 - miny) / cell) - 1); row <= Math.min(H - 1, Math.ceil((y1 - miny) / cell) + 1); row++) {
      const yc = miny + (row + 0.5) * cell;
      const xs = [];
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = p.vy[i], yj = p.vy[j];
        if (yi > yc !== yj > yc) xs.push(p.vx[i] + ((yc - yi) * (p.vx[j] - p.vx[i])) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.ceil((xs[k] - minx) / cell - 0.5), c1 = Math.floor((xs[k + 1] - minx) / cell - 0.5);
        for (let c = Math.max(0, c0); c <= Math.min(W - 1, c1); c++) land[row * W + c] = 1;
      }
    }
  }
  let landCells = 0;
  for (let i = 0; i < land.length; i++) landCells += land[i];
  // mar de fora
  const outer = new Uint8Array(W * H);
  const stack = [0];
  outer[0] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i / W) | 0;
    if (x > 0 && !land[i - 1] && !outer[i - 1]) (outer[i - 1] = 1), stack.push(i - 1);
    if (x < W - 1 && !land[i + 1] && !outer[i + 1]) (outer[i + 1] = 1), stack.push(i + 1);
    if (y > 0 && !land[i - W] && !outer[i - W]) (outer[i - W] = 1), stack.push(i - W);
    if (y < H - 1 && !land[i + W] && !outer[i + W]) (outer[i + W] = 1), stack.push(i + W);
  }
  const lag = new Uint8Array(W * H);
  for (let i = 0; i < lag.length; i++) lag[i] = !land[i] && !outer[i] ? 1 : 0;
  const cellHex = (cell * cell) / HEX_AREA;
  const minCells = minHex / cellHex;
  const lagComps = components(lag, W, H);
  // fechamento morfológico com disco closeR: dilata e erode
  const dl = chamfer(land, W, H);
  const rr = (closeR / cell) * 3;
  const dil = new Uint8Array(W * H);
  const notDil = new Uint8Array(W * H);
  for (let i = 0; i < dil.length; i++) {
    dil[i] = dl[i] <= rr ? 1 : 0;
    notDil[i] = dil[i] ? 0 : 1;
  }
  const de = chamfer(notDil, W, H);
  const slit = new Uint8Array(W * H);
  for (let i = 0; i < slit.length; i++) slit[i] = de[i] > rr && !land[i] && outer[i] ? 1 : 0;
  const slitComps = components(slit, W, H);
  const sum = (a, f = () => true) => a.filter(f).reduce((s, v) => s + v, 0);
  return {
    landHex: landCells * cellHex,
    lagoons: lagComps.filter((c) => c >= minCells).length,
    lagoonHex: sum(lagComps) * cellHex,
    slits: slitComps.filter((c) => c >= minCells).length,
    slitHex: sum(slitComps) * cellHex,
  };
}
