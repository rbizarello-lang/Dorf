// Capturas do jogo: sobe o dist/ num servidor estático próprio, abre no Chromium (SwiftShader, sem GPU),
// tira PNGs 1280x800 e imprime erros do console e o window.__stats de cada uma.
// Uso: npm run build && node scripts/shot.mjs [nome ...]   (sem nomes: todas)
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'docs', 'screens');
const SHOTS = {
  // Teste às cegas: a tela inicial (sem `ab`) e as duas versões com o mesmo visual (`ab=A|B` pula a escolha).
  escolha: '',
  'a-meio': 'ab=A&seed=3&auto=15&aves=1',
  'b-meio': 'ab=B&seed=3&auto=15&aves=1',
  'b-fim': 'ab=B&seed=3&auto=30',
  'b-perto': 'ab=B&seed=3&auto=24&focus=marco&zoom=14&pitch=0.8&yaw=-0.5',
  'celular-b': 'ab=B&seed=3&auto=15',
  'celular-a': 'ab=A&seed=3&auto=12',
  'b-jogando': 'ab=B&seed=3&auto=6&select=0&hover=valid',
  'b-dicas': 'ab=B&seed=3&dicas=1',
  'celular-dica': 'ab=A&seed=3&dicas=1',
  exportar: 'ab=B&seed=3&auto=8&exportar=1',
  inicio: 'ab=A&seed=3',
  meio: 'ab=A&seed=3&auto=15',
  fim: 'ab=A&seed=3&auto=30',
  perto: 'ab=A&seed=3&auto=15&focus=vila&zoom=14&pitch=0.85',
  jogando: 'ab=A&seed=3&auto=8&select=0&hover=valid',
  noite: 'ab=A&seed=3&auto=20&night=1',
  celular: 'ab=A&seed=3&auto=12',
  celularfim: 'ab=A&seed=3&auto=30',
  vento: 'ab=A&seed=3&auto=15&blow=1&zoom=21&pitch=0.95&yaw=-0.7',
  ventoveu: 'ab=A&seed=3&auto=15&blow=1&hold=3&zoom=21&pitch=0.95&yaw=-0.7',
  chuva: 'ab=A&seed=3&auto=18&rain=1',
  cardume: 'ab=A&seed=3&auto=8&blow=1&hold=3&zoom=14&pitch=0.95',
  cardumenoite: 'ab=A&seed=3&auto=8&blow=1&hold=3&zoom=14&pitch=0.95&night=1',
};
// Captura avulsa: `nome::consulta` (ex.: tmp::ab=B&seed=3&auto=24&zoom=9).
const want = process.argv.slice(2);
for (const w of want) { const k = w.indexOf('::'); if (k > 0) SHOTS[w.slice(0, k)] = w.slice(k + 2); }
const names = want.length ? want.map((w) => (w.includes('::') ? w.slice(0, w.indexOf('::')) : w)) : Object.keys(SHOTS);

const server = createServer(async (req, res) => {
  try {
    const p = req.url.split('?')[0];
    const body = await readFile(join(dist, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath: existsSync(exe) ? exe : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
await mkdir(out, { recursive: true });
let bad = 0;
for (const name of names) {
  const q = SHOTS[name];
  if (q === undefined) { console.log('desconhecida:', name); bad++; continue; }
  const mobile = name.startsWith('celular');
  // ?fps nas capturas não, para não sujar a imagem
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 780 } : { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: mobile });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/${q ? '?' + q : ''}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  // deixa a névoa/queda/intro assentarem: o tempo do mundo anda com os quadros
  // vento e chuva congelam o mundo no meio do efeito (?blow=1, ?rain=1); as outras esperam a intro assentar
  if (name === 'vento' || name === 'ventoveu' || name === 'chuva' || name.startsWith('cardume')) await page.waitForFunction(() => window.__held === true, null, { timeout: 120000 });
  else await page.waitForFunction(() => window.__world.time > 5, null, { timeout: 120000 });
  await page.waitForTimeout(500);
  const stats = await page.evaluate(() => ({ ...window.__stats, frames: window.__frames }));
  await page.screenshot({ path: join(out, name + '.png') });
  console.log(`${name}: ${JSON.stringify(stats)}`);
  const real = errors.filter((e) => !/GPU stall|swiftshader|ReadPixels|GL Driver Message/i.test(e));
  if (real.length) { bad++; console.log('  ERROS DO CONSOLE:\n  ' + real.join('\n  ')); }
  else if (errors.length) console.log('  (avisos do driver ignorados: ' + errors.length + ')');
  await page.close();
}
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
