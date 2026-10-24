// Fase 1 da extração: baixa SÓ o recorte de cada camada da Overture Maps e os tiles de relevo Terrarium,
// e grava tudo cru (WGS84) em .cache/<nome>/. A fase 2 (extrair.mjs) lê esse cache e gera o JSON da maquete.
//
// Uso: NODE_USE_ENV_PROXY=1 node scripts/baixar.mjs [--nome urca] [--bbox s,w,n,e] [--so building,segment]
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { latestRelease, readType, fetchRetry } from './overture.mjs';

/** Recortes conhecidos. A caixa é a final (o que a maquete mostra) mais uma margem para os dados que cruzam a borda. */
export const LUGARES = {
  // Urca (Rio de Janeiro): bairro, Morro da Urca, Pão de Açúcar, Praia Vermelha e a ponta da enseada de Botafogo.
  urca: { s: -22.957, w: -43.170, n: -22.9422, e: -43.154 },
};
export const MARGEM = 0.0012; // graus (~130 m) lidos além do recorte, para não cortar prédios e ruas na borda

const CAMADAS = [
  ['buildings', 'building', ['id', 'height', 'min_height', 'num_floors', 'roof_shape', 'roof_height', 'roof_color', 'roof_material', 'facade_color', 'facade_material', 'class', 'subtype', 'is_underground', 'has_parts', 'names', 'sources', 'geometry']],
  ['transportation', 'segment', ['id', 'subtype', 'class', 'subclass', 'names', 'road_surface', 'level_rules', 'geometry']],
  ['base', 'water', ['id', 'subtype', 'class', 'names', 'is_salt', 'is_intermittent', 'geometry']],
  ['base', 'land', ['id', 'subtype', 'class', 'names', 'elevation', 'geometry']],
  ['base', 'land_use', ['id', 'subtype', 'class', 'names', 'geometry']],
  ['base', 'infrastructure', ['id', 'subtype', 'class', 'names', 'height', 'geometry']],
];

const json = (v) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? Number(x) : x));

export async function baixar({ nome, box, so = null, dir }) {
  await mkdir(dir, { recursive: true });
  const release = await latestRelease();
  console.log('release Overture:', release, 'recorte lido:', box);
  const resumo = { release, box, camadas: {}, relevo: null, quando: new Date().toISOString() };
  for (const [th, ty, cols] of CAMADAS) {
    if (so && !so.includes(th) && !so.includes(ty)) continue;
    const t0 = Date.now();
    console.log(`\n${th}/${ty}`);
    const { rows, stats } = await readType(release, th, ty, box, cols);
    await writeFile(join(dir, `${th}_${ty}.json`), json(rows));
    const st = { linhas: rows.length, ...stats, segundos: Math.round((Date.now() - t0) / 100) / 10 };
    await writeFile(join(dir, `${th}_${ty}.stats.json`), json(st));
    console.log(`  => ${rows.length} linhas; ${stats.partsHit}/${stats.parts} arquivos tocados, ${stats.rowGroups} row groups, ${(stats.bytes / 1e6).toFixed(1)} MB transferidos (${(stats.footerBytes / 1e6).toFixed(1)} MB deles em ${stats.footers} rodapés)`);
  }

  // Relevo: tiles Terrarium da AWS, zoom 15 (cerca de 4,4 m por pixel em Urca). Elevação = (R*256 + G + B/256) - 32768.
  const Z = 15;
  const tx = (lon) => Math.floor(((lon + 180) / 360) * 2 ** Z);
  const tyf = (lat) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z); };
  const x0 = tx(box.w), x1 = tx(box.e), y0 = tyf(box.n), y1 = tyf(box.s);
  console.log(`\nrelevo Terrarium z${Z}: tiles x ${x0}..${x1}, y ${y0}..${y1}`);
  const W = (x1 - x0 + 1) * 256, H = (y1 - y0 + 1) * 256;
  const elev = new Float32Array(W * H);
  let bytes = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
    const buf = Buffer.from(await fetchRetry(url, {}, 7, 'buffer'));
    bytes += buf.length;
    const png = PNG.sync.read(buf);
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
      const k = (j * 256 + i) * 4;
      elev[((y - y0) * 256 + j) * W + (x - x0) * 256 + i] = png.data[k] * 256 + png.data[k + 1] + png.data[k + 2] / 256 - 32768;
    }
  }
  await writeFile(join(dir, 'relevo.f32'), Buffer.from(elev.buffer));
  resumo.relevo = { z: Z, x0, x1, y0, y1, W, H, bytes, tiles: (x1 - x0 + 1) * (y1 - y0 + 1) };
  await writeFile(join(dir, 'resumo.json'), json(resumo));
  console.log(`relevo: ${W}x${H} amostras, ${(bytes / 1e3).toFixed(0)} kB de PNG`);
  console.log('\ncache em', dir);
  return resumo;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const nome = arg('nome', 'urca');
  const bb = arg('bbox', null);
  const base = bb ? Object.fromEntries(['s', 'w', 'n', 'e'].map((k, i) => [k, Number(bb.split(',')[i])])) : LUGARES[nome];
  const box = { s: base.s - MARGEM, w: base.w - MARGEM, n: base.n + MARGEM, e: base.e + MARGEM };
  await baixar({ nome, box, so: arg('so', null)?.split(',') ?? null, dir: join(process.cwd(), '.cache', nome) });
}
