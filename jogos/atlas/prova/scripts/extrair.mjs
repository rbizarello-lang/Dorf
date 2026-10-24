// Extração completa de um lugar: baixa o recorte (se ainda não está no cache), projeta para metros locais,
// recorta, simplifica e grava um JSON compacto em data/<nome>.json, mais as estatísticas de qualidade.
//
// Uso: NODE_USE_ENV_PROXY=1 node scripts/extrair.mjs [--nome urca] [--bbox s,w,n,e] [--refazer] [--com-google]
//   --refazer     baixa de novo, mesmo havendo cache em .cache/<nome>/
//   --com-google  mantém os prédios cuja fonte é o Google Open Buildings (por padrão ficam de fora)
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { baixar, LUGARES } from './baixar.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const nome = arg('nome', 'urca');
const bb = arg('bbox', null);
const final = bb ? Object.fromEntries(['s', 'w', 'n', 'e'].map((k, i) => [k, Number(bb.split(',')[i])])) : LUGARES[nome];
if (!final) throw new Error('lugar desconhecido: ' + nome);
const cacheDir = join(process.cwd(), '.cache', nome);
const outDir = join(process.cwd(), 'data');
await mkdir(outDir, { recursive: true });

const MARGEM = 0.0012;
const lido = { s: final.s - MARGEM, w: final.w - MARGEM, n: final.n + MARGEM, e: final.e + MARGEM };
const temCache = await access(join(cacheDir, 'resumo.json')).then(() => true, () => false);
if (flag('refazer') || !temCache) await baixar({ nome, box: lido, dir: cacheDir });
const L = async (n) => JSON.parse(await readFile(join(cacheDir, n + '.json'), 'utf8'));
const resumo = await L('resumo');

// ---------- projeção: metros locais em torno do centro do recorte (x leste, y norte) ----------
const lat0 = (final.s + final.n) / 2, lon0 = (final.w + final.e) / 2;
const c2 = Math.cos((2 * lat0 * Math.PI) / 180), c4 = Math.cos((4 * lat0 * Math.PI) / 180), c1 = Math.cos((lat0 * Math.PI) / 180), c3 = Math.cos((3 * lat0 * Math.PI) / 180);
const KLAT = 111132.92 - 559.82 * c2 + 1.175 * c4;
const KLON = 111412.84 * c1 - 93.5 * c3;
const toM = ([lon, lat]) => [(lon - lon0) * KLON, (lat - lat0) * KLAT];
const LARG = (final.e - final.w) * KLON, ALT = (final.n - final.s) * KLAT;
const HX = LARG / 2, HY = ALT / 2;
const r1 = (v) => Math.round(v * 10) / 10;
const flat = (pts) => pts.flatMap(([x, y]) => [r1(x), r1(y)]);

// ---------- geometria ----------
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let dmax = 0, im = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const t = l2 ? Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / l2)) : 0;
      const d = Math.hypot(pts[i][0] - (ax + dx * t), pts[i][1] - (ay + dy * t));
      if (d > dmax) { dmax = d; im = i; }
    }
    if (dmax > tol && im > 0) { keep[im] = 1; st.push([a, im], [im, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function simplifyRing(ring, tol) {
  let p = ring.slice(); // anel aberto (sem repetir o primeiro ponto)
  if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
  if (p.length < 4) return p;
  // quebra o anel no ponto mais distante do primeiro para o DP não degenerar
  let far = 0, dm = 0;
  for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]); if (d > dm) { dm = d; far = i; } }
  const a = dp(p.slice(0, far + 1), tol), b = dp([...p.slice(far), p[0]], tol);
  const out = [...a, ...b.slice(1, -1)];
  return out.length >= 3 ? out : p;
}
const area = (ring) => { let s = 0; for (let i = 0; i < ring.length; i++) { const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length]; s += x0 * y1 - x1 * y0; } return s / 2; };
function clipPoly(ring, hx, hy) {
  let out = ring;
  const edges = [[(p) => p[0] >= -hx, (a, b) => [-hx, a[1] + ((b[1] - a[1]) * (-hx - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= hx, (a, b) => [hx, a[1] + ((b[1] - a[1]) * (hx - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= -hy, (a, b) => [a[0] + ((b[0] - a[0]) * (-hy - a[1])) / (b[1] - a[1]), -hy]],
    [(p) => p[1] <= hy, (a, b) => [a[0] + ((b[0] - a[0]) * (hy - a[1])) / (b[1] - a[1]), hy]]];
  for (const [inside, cut] of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b));
    }
    if (!out.length) return [];
  }
  return out;
}
function clipLine(pts, hx, hy) {
  const out = []; let cur = [];
  const seg = (a, b) => {
    let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] + hx], [dx, hx - a[0]], [-dy, a[1] + hy], [dy, hy - a[1]]]) {
      if (p === 0) { if (q < 0) return null; } else { const t = q / p; if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; } }
    }
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
  };
  for (let i = 0; i + 1 < pts.length; i++) {
    const s = seg(pts[i], pts[i + 1]);
    if (!s) { if (cur.length > 1) out.push(cur); cur = []; continue; }
    if (!cur.length) cur.push(s[0]); else if (Math.hypot(cur[cur.length - 1][0] - s[0][0], cur[cur.length - 1][1] - s[0][1]) > 0.01) { out.push(cur); cur = [s[0]]; }
    cur.push(s[1]);
  }
  if (cur.length > 1) out.push(cur);
  return out;
}
const inside = ([x, y], m = 0) => Math.abs(x) <= HX + m && Math.abs(y) <= HY + m;
const centroid = (ring) => { let x = 0, y = 0; for (const p of ring) { x += p[0]; y += p[1]; } return [x / ring.length, y / ring.length]; };
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const dataset = (r) => (r.sources ?? []).map((s) => s.dataset);
const srcCode = (r) => { const d = dataset(r).join('+'); return d.includes('Google') ? 'g' : d.includes('OpenStreetMap') ? 'o' : d.includes('Microsoft') ? 'm' : '?'; };
const nameOf = (r) => r.names?.primary ?? undefined;
const pushPoly = (arr, r, extra, tol = 1.2) => {
  for (const p of polysOf(r.geometry)) {
    const rings = [];
    p.forEach((ring, k) => {
      const m = ring.map(toM);
      const c = clipPoly(m, HX + 4, HY + 4);
      if (c.length < 3) return;
      const s = simplifyRing(c, tol);
      if (s.length < 3 || Math.abs(area(s)) < 4) return;
      if (k === 0 || Math.abs(area(s)) > 30) rings.push(flat(s));
    });
    if (rings.length && rings[0]) arr.push({ ...extra, p: rings });
  }
};

// ---------- prédios ----------
const stats = { fonte: { release: resumo.release, quando: resumo.quando }, recorte: final, projecao: { lat0, lon0, mPorGrauLat: KLAT, mPorGrauLon: KLON }, largura_m: Math.round(LARG), altura_m: Math.round(ALT) };
const bRows = await L('buildings_building');
const predios = [];
const q = { lidos: bRows.length, dentro: 0, porFonte: { o: 0, m: 0, g: 0 }, google_excluidos: 0, subterraneos: 0, pequenos: 0 };
for (const r of bRows) {
  const g = polysOf(r.geometry)[0];
  if (!g) continue;
  const ring = g[0].map(toM);
  if (!inside(centroid(ring))) continue;
  q.dentro++;
  const s = srcCode(r);
  q.porFonte[s] = (q.porFonte[s] ?? 0) + 1;
  if (s === 'g' && !flag('com-google')) { q.google_excluidos++; continue; }
  if (r.is_underground) { q.subterraneos++; continue; }
  const sp = simplifyRing(ring, 0.7);
  const a = Math.abs(area(sp));
  if (sp.length < 3 || a < 8) { q.pequenos++; continue; }
  const o = { i: String(r.id).slice(0, 8), p: flat(sp), s };
  if (r.height != null) o.h = r1(r.height);
  if (r.num_floors != null) o.a = r.num_floors;
  if (r.min_height) o.m = r1(r.min_height);
  if (r.roof_shape) o.r = r.roof_shape;
  if (r.class) o.c = r.class; else if (r.subtype) o.c = r.subtype;
  if (nameOf(r)) o.n = nameOf(r);
  predios.push(o);
}
const comH = predios.filter((b) => b.h != null), comA = predios.filter((b) => b.a != null);
const algum = predios.filter((b) => b.h != null || b.a != null);
const areaDe = (b) => { const pts = []; for (let i = 0; i < b.p.length; i += 2) pts.push([b.p[i], b.p[i + 1]]); return Math.abs(area(pts)); };
const med = (v) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const qs = (v, p) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const porFonte = {};
for (const s of ['o', 'm', 'g']) { const l = predios.filter((b) => b.s === s); if (l.length) porFonte[s] = { n: l.length, comAltura: l.filter((b) => b.h != null).length, comAndares: l.filter((b) => b.a != null).length }; }
// coerência entre altura e andares (onde há os dois)
const ambos = predios.filter((b) => b.h != null && b.a != null);
const razao = ambos.map((b) => b.h / b.a);
const areasTodas = predios.map(areaDe);
const areaComH = comH.map(areaDe), areaSemH = predios.filter((b) => b.h == null).map(areaDe);
stats.predios = {
  ...q, mantidos: predios.length, comAltura: comH.length, comAndares: comA.length, comAlturaOuAndares: algum.length,
  semNenhum: predios.length - algum.length, comFormaDeTelhado: predios.filter((b) => b.r).length, comClasse: predios.filter((b) => b.c).length, nomeados: predios.filter((b) => b.n).length,
  porFonte, alturaMediana: med(comH.map((b) => b.h)), alturaP10: qs(comH.map((b) => b.h), 0.1), alturaP90: qs(comH.map((b) => b.h), 0.9), alturaMax: Math.max(...comH.map((b) => b.h)),
  areaMediana: Math.round(med(areasTodas)), areaMedianaComAltura: Math.round(med(areaComH)), areaMedianaSemAltura: Math.round(med(areaSemH)),
  alturaPorAndarMediana: med(razao), alturaPorAndarForaDe2a6m: razao.filter((v) => v < 2 || v > 6).length, comAlturaEAndares: ambos.length,
  alturaMenorQue2m: comH.filter((b) => b.h < 2).length, alturaMaiorQue60m: comH.filter((b) => b.h > 60).length,
};

// ---------- ruas ----------
const tRows = await L('transportation_segment');
const ruas = [];
const rq = { lidas: tRows.length, porClasse: {} };
for (const r of tRows) {
  if (r.geometry.type !== 'LineString') continue;
  const lr = (r.level_rules ?? []).map((x) => x.value);
  const sub = r.subtype === 'rail' ? 'rail' : 'road';
  const cls = r.class ?? 'unknown';
  const pts = r.geometry.coordinates.map(toM);
  for (const part of clipLine(pts, HX + 4, HY + 4)) {
    const s = dp(part, 0.8);
    if (s.length < 2) continue;
    const o = { c: cls, p: flat(s) };
    if (sub === 'rail') o.t = 'rail';
    if (lr.some((v) => v < 0)) o.l = -1; else if (lr.some((v) => v > 0)) o.l = 1; // túnel ou ponte
    if (nameOf(r)) o.n = nameOf(r);
    ruas.push(o);
    rq.porClasse[cls] = (rq.porClasse[cls] ?? 0) + 1;
  }
}
stats.ruas = { ...rq, mantidas: ruas.length };

// ---------- água ----------
const wRows = await L('base_water');
const agua = [], rios = [];
for (const r of wRows) {
  const t = r.class === 'swimming_pool' ? 'piscina' : r.subtype === 'ocean' || r.class === 'ocean' || r.subtype === 'physical' ? 'mar' : r.subtype === 'pond' || r.class === 'pond' ? 'lago' : r.subtype;
  if (r.geometry.type === 'LineString') {
    for (const part of clipLine(r.geometry.coordinates.map(toM), HX + 4, HY + 4)) rios.push({ t: r.subtype, n: nameOf(r), p: flat(dp(part, 1)) });
  } else if (t === 'mar') {
    // o polígono do oceano é enorme: só o pedaço dentro do recorte interessa; furos (ilhotas) vêm junto
    pushPoly(agua, r, { t: 'mar' }, 1.5);
  } else pushPoly(agua, r, { t, n: nameOf(r) }, 0.6);
}
stats.agua = { poligonos: agua.length, porTipo: Object.fromEntries([...new Set(agua.map((a) => a.t))].map((t) => [t, agua.filter((a) => a.t === t).length])), linhas: rios.length };

// ---------- terra, uso do solo, árvores, picos ----------
const lRows = await L('base_land');
const terra = [], arvores = [], picos = [], penhascos = [];
for (const r of lRows) {
  if (r.geometry.type === 'Point') {
    const [x, y] = toM(r.geometry.coordinates);
    if (r.class === 'tree' && inside([x, y])) arvores.push(r1(x), r1(y));
    else if (r.class === 'peak' && inside([x, y], 40)) picos.push({ n: nameOf(r) ?? null, x: r1(x), y: r1(y), ele: r.elevation ?? null });
  } else if (r.geometry.type === 'LineString') {
    if (r.class === 'cliff') for (const part of clipLine(r.geometry.coordinates.map(toM), HX + 4, HY + 4)) penhascos.push({ p: flat(dp(part, 1)) });
  } else if (['beach', 'bare_rock', 'wood', 'shrubbery', 'scrub', 'islet', 'land'].includes(r.class) || ['sand', 'rock', 'forest', 'shrub'].includes(r.subtype)) {
    pushPoly(terra, r, { t: r.class, n: nameOf(r) }, 1.5);
  }
}
const uRows = await L('base_land_use');
const uso = [];
for (const r of uRows) pushPoly(uso, r, { t: r.subtype + '/' + r.class, n: nameOf(r) }, 1.5);
stats.terra = { arvoresOSM: arvores.length / 2, poligonos: terra.length, porClasse: Object.fromEntries([...new Set(terra.map((a) => a.t))].map((t) => [t, terra.filter((a) => a.t === t).length])), uso: uso.length, picos: picos.length, penhascos: penhascos.length };

// ---------- infraestrutura ----------
const iRows = await L('base_infrastructure');
const pts = { banco: [], poste: [], fonte: [], mirante: [] };
const cabos = [], estacoes = [], pieres = [], muros = [];
for (const r of iRows) {
  const g = r.geometry;
  const cl = r.class;
  if (g.type === 'Point') {
    const [x, y] = toM(g.coordinates);
    if (!inside([x, y])) continue;
    if (cl === 'bench') pts.banco.push(r1(x), r1(y));
    else if (cl === 'street_lamp') pts.poste.push(r1(x), r1(y));
    else if (cl === 'fountain') pts.fonte.push(r1(x), r1(y));
    else if (cl === 'viewpoint') pts.mirante.push(r1(x), r1(y));
  } else if (g.type === 'LineString') {
    if (cl === 'cable_car' || r.subtype === 'aerialway') for (const part of clipLine(g.coordinates.map(toM), HX + 4, HY + 4)) cabos.push({ n: nameOf(r), p: flat(part) });
    else if (cl === 'wall' || cl === 'retaining_wall') for (const part of clipLine(g.coordinates.map(toM), HX + 4, HY + 4)) muros.push({ c: cl, p: flat(dp(part, 0.8)) });
  } else if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
    if (cl === 'aerialway_station') pushPoly(estacoes, r, { n: nameOf(r) }, 0.6);
    else if (cl === 'pier' || cl === 'quay' || cl === 'platform' && r.subtype === 'pier') pushPoly(pieres, r, { c: cl }, 0.8);
  }
}
// estações dadas só como ponto (o OSM às vezes marca a estação num nó)
stats.infra = { bancos: pts.banco.length / 2, postes: pts.poste.length / 2, fontes: pts.fonte.length / 2, miradouros: pts.mirante.length / 2, cabos: cabos.length, estacoes: estacoes.length, pieres: pieres.length, muros: muros.length };

// ---------- relevo ----------
const R = resumo.relevo;
const elevRaw = new Float32Array((await readFile(join(cacheDir, 'relevo.f32'))).buffer.slice(0));
const tileXY = (lon, lat) => { const n = 2 ** R.z, r = (lat * Math.PI) / 180; return [((lon + 180) / 360) * n * 256 - R.x0 * 256, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * 256 - R.y0 * 256]; };
const demAt = (lon, lat) => {
  const [tx, ty] = tileXY(lon, lat);
  const x = Math.max(0, Math.min(R.W - 2, tx)), y = Math.max(0, Math.min(R.H - 2, ty));
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const a = elevRaw[j * R.W + i], b = elevRaw[j * R.W + i + 1], c = elevRaw[(j + 1) * R.W + i], d = elevRaw[(j + 1) * R.W + i + 1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};
const PASSO = 6; // metros entre as amostras da grade
const NX = Math.ceil(LARG / PASSO) + 1, NY = Math.ceil(ALT / PASSO) + 1;
const grade = new Float32Array(NX * NY);
for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
  const x = -HX + Math.min(LARG, i * PASSO), y = HY - Math.min(ALT, j * PASSO); // linha 0 = norte
  const lon = lon0 + x / KLON, lat = lat0 + y / KLAT;
  grade[j * NX + i] = Math.max(-30, demAt(lon, lat));
}
// calibração dos picos: o SRTM (30 m) achata picos estreitos. Onde o OSM dá a cota (tag ele) acima do que o relevo mostra,
// soma-se um montículo gaussiano até a cota do dado. A cota é do dado; a forma do montículo é nossa.
const SIGMA = 55;
const picosCal = [];
for (const p of picos) {
  if (p.ele == null) continue;
  // máximo local do relevo num raio de 60 m em volta do ponto do OSM
  let best = -1e9, bx = p.x, by = p.y;
  for (let dy = -60; dy <= 60; dy += 6) for (let dx = -60; dx <= 60; dx += 6) {
    const x = p.x + dx, y = p.y + dy;
    const v = demAt(lon0 + x / KLON, lat0 + y / KLAT);
    if (v > best) { best = v; bx = x; by = y; }
  }
  const amp = p.ele - best;
  picosCal.push({ ...p, dem: r1(best), x2: r1(bx), y2: r1(by), correcao: amp > 3 ? r1(amp) : 0 });
  if (amp <= 3 || !inside([bx, by], 60)) continue;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = -HX + Math.min(LARG, i * PASSO), y = HY - Math.min(ALT, j * PASSO);
    const d2 = (x - bx) ** 2 + (y - by) ** 2;
    if (d2 < (4 * SIGMA) ** 2) grade[j * NX + i] += amp * Math.exp(-d2 / (2 * SIGMA * SIGMA));
  }
}
let zmin = Infinity, zmax = -Infinity;
const dm = new Int16Array(NX * NY);
for (let k = 0; k < grade.length; k++) { zmin = Math.min(zmin, grade[k]); zmax = Math.max(zmax, grade[k]); dm[k] = Math.round(grade[k] * 10); }
const b64 = Buffer.from(dm.buffer).toString('base64');
stats.relevo = { fonte: `Terrarium z${R.z} (Mapzen/AWS)`, tilesBaixados: R.tiles, bytesPNG: R.bytes, passo_m: PASSO, nx: NX, ny: NY, min: r1(zmin), max: r1(zmax), picosCalibrados: picosCal.filter((p) => p.correcao > 0).map((p) => `${p.n ?? '?'}: ${p.dem} m no relevo, ${p.ele} m no OSM, +${p.correcao}`) };

// ---------- saída ----------
const out = {
  v: 1,
  lugar: 'Urca, Rio de Janeiro',
  atribuicao: '© OpenStreetMap contributors, Overture Maps Foundation. Relevo: Mapzen/AWS Terrain Tiles (SRTM/USGS, entre outras fontes).',
  licenca: 'Base derivada do OpenStreetMap: ODbL 1.0 (https://opendatacommons.org/licenses/odbl/1-0/).',
  origem: { lon0, lat0 }, recorte: final, projecao: stats.projecao, larg: r1(LARG), alt: r1(ALT),
  relevo: { nx: NX, ny: NY, passo: PASSO, min: r1(zmin), max: r1(zmax), dm: b64 },
  picos: picosCal,
  predios, ruas, agua, rios, terra, penhascos, uso, arvores,
  pontos: pts, cabos, estacoes, pieres, muros,
};
const texto = JSON.stringify(out);
await writeFile(join(outDir, `${nome}.json`), texto);
stats.arquivo = { bytes: texto.length, relevoBytes: b64.length, prediosBytes: JSON.stringify(predios).length, ruasBytes: JSON.stringify(ruas).length };
await writeFile(join(outDir, `${nome}.stats.json`), JSON.stringify(stats, null, 2));
console.log(JSON.stringify(stats, null, 2));
console.log(`\ndata/${nome}.json: ${(texto.length / 1024).toFixed(0)} kB`);
