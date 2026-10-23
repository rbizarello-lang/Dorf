// Capturas do esboço (Chromium com GL por software). Uso:
//   node scripts/shot.mjs                 -> gera as seis capturas de docs/screens
//   node scripts/shot.mjs nome=query ...  -> captura avulsa (ex.: "teste=week=4&hour=noite&zoom=2")
// Sobe um servidor estático próprio sobre dist/, abre 1280x800, espera o gancho __ready e grava as PNG.
// Imprime draw calls e triângulos (quadro inteiro, com o passe de sombra, e só da tela) e qualquer erro de console.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'docs', 'screens');
const exe = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const SHOTS = {
  semana1: 'week=1&hour=dia&yaw=-14&zoom=1.05&t=14',
  semana4: 'week=4&hour=dia&yaw=-14&zoom=1.05&t=14',
  capital: 'week=4&hour=dia&focus=capital&yaw=-22&pitch=36&zoom=3.1&t=14',
  fronteira: 'week=4&hour=dia&focus=fronteira&yaw=-28&pitch=38&zoom=3.2&t=14',
  ponte: 'week=4&hour=dia&focus=ponte&yaw=-35&pitch=33&zoom=5.2&t=14',
  noite: 'week=4&hour=noite&yaw=-14&pitch=42&zoom=1.35&t=14',
};

const args = process.argv.slice(2);
const jobs = args.length ? Object.fromEntries(args.map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; })) : SHOTS;

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = path.join(dist, decodeURIComponent(url.pathname));
  if (p.endsWith(path.sep) || !path.extname(p)) p = path.join(dist, 'index.html');
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('nada'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
let bad = 0;
for (const [name, query] of Object.entries(jobs)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/index.html?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(600);
  const stats = await page.evaluate(() => ({ full: window.__stats(), main: window.__statsMain() }));
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file });
  // erros que não vêm do jogo (rede do ambiente) não contam
  const real = errors.filter((e) => !/google|gstatic|fonts|ERR_(NAME|INTERNET|CONNECTION|PROXY|TUNNEL)|Failed to load resource/i.test(e));
  console.log(`${name}: ${file}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log(`   quadro inteiro: ${stats.full.calls} draw calls, ${stats.full.triangles} triângulos | só a tela: ${stats.main.calls} draw calls, ${stats.main.triangles} triângulos | casas ${stats.full.houses}`);
  console.log(`   console: ${real.length ? real.join('\n            ') : 'sem erros'}`);
  if (real.length) bad++;
  await page.close();
}
await browser.close();
server.close();
if (bad) process.exitCode = 1;
