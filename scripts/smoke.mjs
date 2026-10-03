// Teste de fumaça no navegador: abre o build (dist/index.html) no Chromium headless, em
// WebGPU e em WebGL2 (?webgl), deixa a IA colocar 12 peças e falha se o console tiver erro
// ou se o tabuleiro não chegar a 13 peças. Pega o que os testes em Node não veem: um nó TSL
// que não compila num dos backends, um erro de inicialização no main.ts, um recurso que falta.
// Uso: npm run build && node scripts/smoke.mjs   (a CI roda os dois em todo pull request)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';

const DIST = path.resolve('dist');
const TILES = 13; // a peça inicial + ?auto=12
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT ?? 180000);
// Ruído de rede do ambiente (fontes do Google, proxy) e avisos de driver do SwiftShader.
const IGNORE = /fonts\.g|ERR_|net::|GL Driver|vertex count of 0/;

// Servidor estático mínimo: o build é um arquivo só, mas o navegador ainda pede o favicon e afins.
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const file = path.join(DIST, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const cases = [
  { name: 'webgpu', q: 'theme=vale&seed=3&auto=12&quality=low', backend: 'webgpu' },
  { name: 'webgl', q: 'theme=egito&seed=3&auto=12&quality=low&webgl', backend: 'webgl2' },
];

const browser = await launch(['--ignore-gpu-blocklist']);
let failed = 0;
for (const c of cases) {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => r.status() >= 400 && r.url().startsWith(base) && errors.push(`${r.status()} ${r.url()}`));
  const t0 = Date.now();
  await page.goto(base + '?' + c.q);
  let stats = null;
  while (Date.now() - t0 < TIMEOUT && !errors.length) {
    stats = await page.evaluate(() => window.__stats ?? null);
    if (stats?.tiles >= TILES) break;
    await page.waitForTimeout(1000);
  }
  // Mais alguns quadros: pipelines de materiais novos compilam no primeiro desenho e podem falhar depois.
  if (stats?.tiles >= TILES && !errors.length) await page.waitForTimeout(5000);
  const problems = [...errors];
  if (!stats) problems.push('o jogo não desenhou nenhum quadro (window.__stats vazio)');
  else {
    if (stats.tiles < TILES) problems.push(`tabuleiro com ${stats.tiles} peças, esperado ${TILES}`);
    if (stats.backend !== c.backend) problems.push(`backend ${stats.backend}, esperado ${c.backend}`);
  }
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  if (problems.length) {
    failed++;
    console.log(`FALHOU ${c.name} (${s} s):\n  ${problems.slice(0, 8).map((e) => e.slice(0, 600)).join('\n  ')}`);
  } else console.log(`ok: ${c.name} em ${s} s (${stats.tiles} peças, ${stats.calls} draw calls)`);
  await page.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
