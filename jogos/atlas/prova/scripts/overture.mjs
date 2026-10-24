// Leitura de Parquet da Overture Maps por requisições de faixa HTTP, sem baixar arquivos inteiros.
// 1) lista os arquivos do tipo no bucket S3 público; 2) lê só o rodapé de cada um;
// 3) escolhe os row groups cujas estatísticas de bbox tocam o recorte; 4) lê só as colunas pedidas desses row groups.
import { parquetMetadataAsync, parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

export const BUCKET = 'https://overturemaps-us-west-2.s3.amazonaws.com';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch com nova tentativa (também na leitura do corpo): o proxy às vezes derruba a conexão no meio da transferência. */
export async function fetchRetry(url, init = {}, tries = 7, as = 'response') {
  let last;
  for (let k = 0; k < tries; k++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 || res.status === 429) throw new Error('HTTP ' + res.status);
      if (as === 'buffer') return await res.arrayBuffer();
      if (as === 'text') return await res.text();
      return res;
    } catch (e) {
      last = e;
      await sleep(500 * 2 ** Math.min(k, 4));
    }
  }
  throw last;
}

const CHUNK = 1 << 20;

/** Buffer assíncrono do hyparquet sobre requisições de faixa (em pedaços de 1 MB); `meter.bytes` conta o transferido. */
export async function openRemote(url, meter) {
  const head = await fetchRetry(url, { method: 'HEAD' });
  const byteLength = Number(head.headers.get('content-length'));
  return {
    byteLength,
    async slice(a, b) {
      const end = b ?? byteLength;
      const out = new Uint8Array(end - a);
      for (let p = a; p < end; p += CHUNK) {
        const q = Math.min(end, p + CHUNK);
        const buf = await fetchRetry(url, { headers: { Range: `bytes=${p}-${q - 1}` } }, 7, 'buffer');
        out.set(new Uint8Array(buf), p - a);
        if (meter) meter.bytes += buf.byteLength;
      }
      return out.buffer;
    },
  };
}

export async function latestRelease() {
  const xml = await fetchRetry(`${BUCKET}/?list-type=2&prefix=release/&delimiter=/`, {}, 7, 'text');
  const rels = [...xml.matchAll(/<Prefix>release\/([^<]+)\/<\/Prefix>/g)].map((m) => m[1]).sort();
  return rels[rels.length - 1];
}

export async function listParts(release, theme, type) {
  const prefix = `release/${release}/theme=${theme}/type=${type}/`;
  const xml = await fetchRetry(`${BUCKET}/?list-type=2&prefix=${prefix}`, {}, 7, 'text');
  return [...xml.matchAll(/<Key>([^<]+\.parquet)<\/Key>/g)].map((m) => `${BUCKET}/${m[1]}`);
}

/** Row groups cujas estatísticas de bbox (xmin, xmax, ymin, ymax) cruzam o recorte {w, s, e, n}. */
export function rowGroupsInBbox(md, box) {
  const out = [];
  let start = 0;
  md.row_groups.forEach((rg, i) => {
    const n = Number(rg.num_rows);
    const st = (name) => rg.columns.find((c) => c.meta_data.path_in_schema.join('.') === name)?.meta_data.statistics;
    const xmin = st('bbox.xmin')?.min_value, xmax = st('bbox.xmax')?.max_value, ymin = st('bbox.ymin')?.min_value, ymax = st('bbox.ymax')?.max_value;
    const known = [xmin, xmax, ymin, ymax].every((v) => typeof v === 'number');
    if (!known || (xmax >= box.w && xmin <= box.e && ymax >= box.s && ymin <= box.n)) out.push({ i, start, n });
    start += n;
  });
  return out;
}

/** Rodapé de um arquivo: { file, md, meter } (o meter conta os bytes transferidos). */
async function openParquet(url) {
  const meter = { bytes: 0 };
  const file = await openRemote(url, meter);
  const md = await parquetMetadataAsync(file, { initialFetchSize: 768 << 10 });
  return { url, file, md, meter };
}

/** Caixa que envolve todos os row groups de um arquivo (das estatísticas de bbox). */
function fileBox(md) {
  const box = { w: Infinity, e: -Infinity, s: Infinity, n: -Infinity };
  for (const rg of md.row_groups) {
    const st = (name) => rg.columns.find((c) => c.meta_data.path_in_schema.join('.') === name)?.meta_data.statistics;
    box.w = Math.min(box.w, st('bbox.xmin')?.min_value ?? -180); box.e = Math.max(box.e, st('bbox.xmax')?.max_value ?? 180);
    box.s = Math.min(box.s, st('bbox.ymin')?.min_value ?? -90); box.n = Math.max(box.n, st('bbox.ymax')?.max_value ?? 90);
  }
  return box;
}
const hit = (b, t) => b.e >= t.w && b.w <= t.e && b.n >= t.s && b.s <= t.n;
const gap = (b, t) => Math.hypot(Math.max(0, b.w - t.e, t.w - b.e), Math.max(0, b.s - t.n, t.s - b.n));

/**
 * Escolhe os arquivos que podem ter linhas no recorte, lendo o mínimo de rodapés.
 * Os arquivos da Overture seguem uma curva espacial (arquivos vizinhos cobrem regiões próximas), então:
 *  - tipos com até 50 arquivos têm todos os rodapés lidos;
 *  - nos maiores, 1 a cada 8 é sondado; os que tocam o recorte (ou, se nenhum toca, os 3 mais próximos)
 *    têm os 7 vizinhos de cada lado sondados também. Heurística: um índice completo por release seria exato.
 */
async function pickParts(parts, box, log, stats) {
  const cache = new Map();
  const open = async (i) => {
    if (!cache.has(i)) {
      const o = await openParquet(parts[i]);
      stats.footerBytes += o.meter.bytes; stats.footers++; o.meter.bytes = 0;
      o.box = fileBox(o.md);
      cache.set(i, o);
    }
    return cache.get(i);
  };
  const many = async (ids) => { for (let k = 0; k < ids.length; k += 4) await Promise.all(ids.slice(k, k + 4).map(open)); };
  if (parts.length <= 50) {
    await many(parts.map((_, i) => i));
    return { idx: parts.map((_, i) => i), open };
  }
  const STRIDE = 8;
  await many(parts.map((_, i) => i).filter((i) => i % STRIDE === 0));
  const probed = () => [...cache.entries()].map(([i, o]) => ({ i, o }));
  let seeds = probed().filter(({ o }) => hit(o.box, box)).map(({ i }) => i);
  if (!seeds.length) seeds = probed().sort((a, b) => gap(a.o.box, box) - gap(b.o.box, box)).slice(0, 3).map(({ i }) => i);
  const near = new Set();
  for (const i of seeds) for (let d = -(STRIDE - 1); d < STRIDE; d++) if (i + d >= 0 && i + d < parts.length) near.add(i + d);
  await many([...near]);
  const idx = probed().filter(({ o }) => hit(o.box, box)).map(({ i }) => i).sort((a, b) => a - b);
  log(`  ${stats.footers} rodapés lidos de ${parts.length} arquivos; arquivos que tocam o recorte: ${idx.join(', ') || 'nenhum'}`);
  return { idx, open };
}

/**
 * Lê as linhas do recorte de um tipo. `columns` são colunas de topo; a bbox sempre é lida.
 * Devolve { rows, stats } com os bytes transferidos.
 */
export async function readType(release, theme, type, box, columns, log = console.log) {
  const parts = await listParts(release, theme, type);
  const rows = [];
  const stats = { parts: parts.length, partsHit: 0, rowGroups: 0, rowsScanned: 0, bytes: 0, footerBytes: 0, footers: 0 };
  const cols = [...new Set([...columns, 'bbox'])];
  const { idx, open } = await pickParts(parts, box, log, stats);
  for (const i of idx) {
    const o = await open(i);
    const rgs = rowGroupsInBbox(o.md, box);
    if (!rgs.length) continue;
    stats.partsHit++;
    o.meter.bytes = 0;
    for (const g of rgs) {
      stats.rowGroups++;
      stats.rowsScanned += g.n;
      const part = await parquetReadObjects({ file: o.file, metadata: o.md, columns: cols, rowStart: g.start, rowEnd: g.start + g.n, compressors });
      for (const r of part) {
        const b = r.bbox;
        if (b && b.xmax >= box.w && b.xmin <= box.e && b.ymax >= box.s && b.ymin <= box.n) rows.push(r);
      }
    }
    stats.bytes += o.meter.bytes;
    log(`  ${o.url.split('/').pop().slice(0, 14)}: ${rgs.length} row group(s), ${(o.meter.bytes / 1e6).toFixed(1)} MB lidos`);
  }
  stats.bytes += stats.footerBytes;
  return { rows, stats };
}
