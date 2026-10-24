// Prévia 2D do cache cru (ou do JSON final) para escolher o recorte e conferir os dados.
// Uso: node scripts/previa.mjs [nome] [saida.png] [s,w,n,e] [m_por_pixel]
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const nome = process.argv[2] ?? 'urca';
const out = process.argv[3] ?? '/tmp/previa.png';
const dir = join(process.cwd(), '.cache', nome);
const L = async (n) => JSON.parse(await readFile(join(dir, n + '.json'), 'utf8'));
const resumo = await L('resumo');
const box = process.argv[4] ? Object.fromEntries(['s', 'w', 'n', 'e'].map((k, i) => [k, Number(process.argv[4].split(',')[i])])) : resumo.box;
const MPP = Number(process.argv[5] ?? 2);
const lat0 = (box.s + box.n) / 2, lon0 = (box.w + box.e) / 2;
const KLAT = 111195, KLON = 111195 * Math.cos((lat0 * Math.PI) / 180);
const W = Math.round(((box.e - box.w) * KLON) / MPP), H = Math.round(((box.n - box.s) * KLAT) / MPP);
const px = (lon, lat) => [((lon - box.w) * KLON) / MPP, ((box.n - lat) * KLAT) / MPP];
const png = new PNG({ width: W, height: H });
const set = (x, y, c, a = 1) => {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const k = (y * W + x) * 4;
  for (let i = 0; i < 3; i++) png.data[k + i] = png.data[k + i] * (1 - a) + c[i] * a;
  png.data[k + 3] = 255;
};
// relevo
const R = resumo.relevo;
const elev = new Float32Array((await readFile(join(dir, 'relevo.f32'))).buffer.slice(0));
const tileXY = (lon, lat) => {
  const n = 2 ** R.z, r = (lat * Math.PI) / 180;
  return [((lon + 180) / 360) * n * 256 - R.x0 * 256, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * 256 - R.y0 * 256];
};
const E = (lon, lat) => {
  const [tx, ty] = tileXY(lon, lat);
  const x = Math.max(0, Math.min(R.W - 2, tx)), y = Math.max(0, Math.min(R.H - 2, ty));
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const a = elev[j * R.W + i], b = elev[j * R.W + i + 1], c = elev[(j + 1) * R.W + i], d = elev[(j + 1) * R.W + i + 1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};
const ll = (x, y) => [box.w + (x * MPP) / KLON, box.n - (y * MPP) / KLAT];
const Z = new Float32Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [lo, la] = ll(x, y); Z[y * W + x] = E(lo, la); }
let zmin = Infinity, zmax = -Infinity;
for (const v of Z) { zmin = Math.min(zmin, v); zmax = Math.max(zmax, v); }
console.log('relevo no recorte: min', zmin.toFixed(1), 'max', zmax.toFixed(1));
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
  const dx = (Z[y * W + x + 1] - Z[y * W + x - 1]) / (2 * MPP), dy = (Z[(y + 1) * W + x] - Z[(y - 1) * W + x]) / (2 * MPP);
  const shade = Math.max(0, Math.min(1, 0.55 + 1.6 * (-dx * 0.6 + dy * 0.8) / Math.hypot(1, dx, dy)));
  const h = Z[y * W + x];
  const base = h <= 0.5 ? [150, 190, 215] : [120 + h * 0.25, 150 + h * 0.1, 100];
  set(x, y, base.map((v) => Math.min(255, v * (0.55 + 0.6 * shade))));
}
// polígonos (even-odd, varredura)
function fill(rings, color, a = 1) {
  const pts = rings.map((r) => r.map(([lo, la]) => px(lo, la)));
  let y0 = Infinity, y1 = -Infinity;
  for (const r of pts) for (const p of r) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
    const xs = [];
    for (const r of pts) for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length];
      if ((p[1] <= y + 0.5) !== (q[1] <= y + 0.5)) xs.push(p[0] + ((y + 0.5 - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(W - 1, Math.floor(xs[k + 1])); x++) set(x, y, color, a);
  }
}
function line(pts, color, a = 1, w = 1) {
  const p = pts.map(([lo, la]) => px(lo, la));
  for (let i = 0; i + 1 < p.length; i++) {
    const n = Math.ceil(Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) * 2) + 1;
    for (let k = 0; k <= n; k++) { const t = k / n; const x = p[i][0] + (p[i + 1][0] - p[i][0]) * t, y = p[i][1] + (p[i + 1][1] - p[i][1]) * t; for (let u = 0; u < w; u++) for (let v = 0; v < w; v++) set(x + u, y + v, color, a); }
  }
}
const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const sources = (r) => (r.sources ?? []).map((s) => s.dataset).join('+');

const water = await L('base_water');
for (const r of water) for (const p of polys(r.geometry)) fill(p, r.class === 'swimming_pool' ? [80, 200, 220] : [70, 120, 170], 0.85);
const use = await L('base_land_use');
for (const r of use) for (const p of polys(r.geometry)) {
  if (r.subtype === 'protected') { fill(p, [40, 110, 50], 0.18); continue; }
  if (['park', 'managed', 'horticulture'].includes(r.subtype)) fill(p, [90, 170, 80], 0.6);
  else if (r.subtype === 'recreation') fill(p, [150, 190, 110], 0.6);
  else if (r.subtype === 'pedestrian') fill(p, [220, 215, 200], 0.6);
}
const land = await L('base_land');
for (const r of land) for (const p of polys(r.geometry)) fill(p, r.subtype === 'sand' ? [235, 215, 150] : r.subtype === 'forest' ? [30, 110, 50] : r.subtype === 'rock' ? [130, 125, 120] : [90, 150, 70], 0.8);
const roads = await L('transportation_segment');
const RC = { footway: [255, 255, 255], steps: [255, 230, 230], path: [240, 230, 200], cycleway: [200, 255, 200] };
for (const r of roads) if (r.geometry.type === 'LineString') line(r.geometry.coordinates, RC[r.class] ?? [250, 250, 250], 0.9, r.class === 'primary' || r.class === 'trunk' ? 3 : 1);
const infra = await L('base_infrastructure');
for (const r of infra) {
  if (r.geometry.type === 'Polygon' && ['pier', 'quay'].includes(r.subtype)) fill(r.geometry.coordinates, [120, 90, 60], 0.9);
  if (r.geometry.type === 'LineString' && (r.subtype === 'aerialway' || r.class === 'cable_car')) line(r.geometry.coordinates, [255, 0, 255], 1, 2);
  if (r.geometry.type === 'LineString' && r.class === 'wall') line(r.geometry.coordinates, [255, 120, 0], 1, 1);
}
const bld = await L('buildings_building');
for (const r of bld) {
  const g = sources(r).includes('Google') ? [230, 40, 40] : r.height != null ? [90 + Math.min(150, r.height * 4), 70, 70] : [110, 110, 120];
  for (const p of polys(r.geometry)) fill(p, g, 1);
}
for (const r of land) if (r.geometry.type === 'Point' && r.class === 'tree') { const [x, y] = px(...r.geometry.coordinates); set(x, y, [20, 90, 20], 1); set(x + 1, y, [20, 90, 20], 1); }
for (const r of land) if (r.class === 'peak' && r.geometry.type === 'Point') { const [x, y] = px(...r.geometry.coordinates); for (let i = -3; i <= 3; i++) { set(x + i, y, [255, 255, 0]); set(x, y + i, [255, 255, 0]); } if (r.names?.primary) console.log('pico', r.names.primary, r.geometry.coordinates.map((v) => v.toFixed(5)).join(','), 'z=', E(...r.geometry.coordinates).toFixed(0)); }
// grade de 500 m
for (let gx = 0; gx < W; gx++) for (let gy = 0; gy < H; gy++) if ((Math.round(gx * MPP) % 500 === 0) || (Math.round(gy * MPP) % 500 === 0)) set(gx, gy, [0, 0, 0], 0.15);
await writeFile(out, PNG.sync.write(png));
console.log('prévia', out, W + 'x' + H, 'bbox', JSON.stringify(box));
