// Capturas do diorama: sobe o dist/ num servidor estático próprio, abre no Chromium (SwiftShader, sem GPU),
// tira PNGs 1280x800 e imprime erros do console e os draw calls/triângulos de cada uma.
// Uso: npm run build && node scripts/shot.mjs [nome ...]        (sem nomes: todas)
//      node scripts/shot.mjs "nome::season=2&hour=tarde&zoom=2"  (captura avulsa)
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = process.env.OUT || join(root, 'docs', 'screens');
const SHOTS = {
  primavera: 'season=0&hour=tarde&year=1&yaw=28',
  verao: 'season=1&hour=tarde&year=1&yaw=28',
  outono: 'season=2&hour=manha&year=1&yaw=28',
  'inverno-noite': 'season=3&hour=noite&year=1&yaw=28',
  ano3: 'season=1&hour=tarde&year=3&yaw=28',
  perto: 'season=2&hour=tarde&year=1&yaw=20&zoom=2.3&pitch=24',
};
const want = process.argv.slice(2);
for (const w of want) { const k = w.indexOf('::'); if (k > 0) SHOTS[w.slice(0, k)] = w.slice(k + 2); }
const names = want.length ? want.map((w) => (w.includes('::') ? w.slice(0, w.indexOf('::')) : w)) : Object.keys(SHOTS);

const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const p = req.url.split('?')[0];
    const body = await readFile(join(dist, p === '/' ? 'index.html' : p));
    const ext = p.slice(p.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': types[ext] || 'text/html; charset=utf-8' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath: existsSync(exe) ? exe : undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
await mkdir(out, { recursive: true });
let bad = 0;
for (const name of names) {
  const q = SHOTS[name];
  if (q === undefined) { console.log('desconhecida:', name); bad++; continue; }
  const mobile = name.startsWith('celular');
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 780 } : { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: mobile });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/?shot=1&${q}`);
  try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }); } catch { errs.push('timeout esperando __ready'); }
  // alguns quadros a mais para a fumaça, a neve e a água assentarem
  await page.waitForTimeout(Number(process.env.WAIT || 2500));
  const stats = await page.evaluate(() => window.__stats);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log(`${name}: ${stats.calls} draw calls, ${(stats.triangles / 1000).toFixed(1)} mil triângulos${errs.length ? '  ERROS: ' + errs.join(' | ') : '  (console limpo)'}`);
  if (errs.length) bad++;
  await page.close();
}
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
