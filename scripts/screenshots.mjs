// Captura telas e métricas do protótipo com o Chromium headless.
// Uso: npm run build && node scripts/screenshots.mjs [baseUrl]
import { launch } from './browser.mjs';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const out = 'docs/screens';
fs.mkdirSync(out, { recursive: true });

const shots = (process.env.SHOTS ?? '').split(',').filter(Boolean);
const all = [
  { name: 'vale', q: 'theme=vale&seed=7&auto=32&quality=high', wait: 12000 },
  { name: 'holanda', q: 'theme=holanda&seed=12&auto=32&quality=high', wait: 12000 },
  { name: 'cerrado', q: 'theme=cerrado&seed=11&auto=32&quality=high', wait: 12000 },
  { name: 'inverno', q: 'theme=inverno&seed=5&auto=32&quality=high', wait: 12000 },
  { name: 'sakura', q: 'theme=sakura&seed=3&auto=32&quality=high', wait: 12000 },
  { name: 'marte', q: 'theme=marte&seed=9&auto=32&quality=high', wait: 12000 },
  { name: 'egito', q: 'theme=egito&seed=4&auto=32&quality=high', wait: 12000 },
  { name: 'song', q: 'theme=song&seed=8&auto=32&quality=high', wait: 12000 },
  { name: 'viking', q: 'theme=viking&seed=6&auto=32&quality=high', wait: 12000 },
  { name: 'toscana', q: 'theme=toscana&seed=10&auto=32&quality=high', wait: 12000 },
  { name: 'edo', q: 'theme=edo&seed=14&auto=32&quality=high', wait: 12000 },
  { name: 'colonial', q: 'theme=colonial&seed=15&auto=32&quality=high', wait: 12000 },
  { name: 'oeste', q: 'theme=oeste&seed=16&auto=32&quality=high', wait: 12000 },
  { name: 'andes', q: 'theme=andes&seed=17&auto=32&quality=high', wait: 12000 },
  { name: 'noite', q: 'theme=holanda&seed=12&auto=32&quality=high&time=night', wait: 14000 },
  { name: 'tarde', q: 'theme=toscana&seed=10&auto=32&quality=high&time=dusk', wait: 14000 },
  { name: 'amanhecer', q: 'theme=vale&seed=7&auto=32&quality=high&time=dawn', wait: 14000 },
  { name: 'dourada', q: 'theme=toscana&seed=10&auto=32&quality=high&time=golden', wait: 14000 },
  // Cinema: cada quadro leva ~30 s no SwiftShader. A espera dá uns 6 quadros para o TRAA assentar, e a
  // captura em si leva mais uns 3 minutos.
  { name: 'cinema', q: 'theme=toscana&seed=10&auto=32&quality=cinema&time=golden', wait: 240000, timeout: 600000 },
  { name: 'nuvens', q: 'theme=vale&seed=7&auto=60&quality=high&zoom=44', wait: 14000 },
  { name: 'close', q: 'theme=vale&seed=7&auto=32&quality=high&zoom=4.5', wait: 12000 },
  { name: 'trigo', q: 'theme=vale&seed=21&auto=40&quality=high&zoom=3.6', wait: 12000 },
  { name: 'ghost', q: 'theme=sakura&seed=21&auto=14&quality=high&zoom=7', wait: 9000, ghost: true },
  { name: 'interacoes', q: 'theme=vale&seed=33&auto=18&quality=high&zoom=5', wait: 9000, synergy: true },
  { name: 'vida', q: 'theme=holanda&seed=5&auto=90&quality=high&zoom=9', wait: 14000 },
  { name: 'mobile', q: 'theme=cerrado&seed=11&auto=22&quality=medium', wait: 12000, mobile: true },
];
const list = shots.length ? all.filter((s) => shots.includes(s.name)) : all;

const browser = await launch(['--ignore-gpu-blocklist']);
for (const s of list) {
  const ctx = await browser.newContext(
    s.mobile ? { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 860 } },
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}?${s.q}`);
  await page.waitForTimeout(s.wait);
  if (s.ghost) {
    await page.evaluate(() => window.__ghostBest());
    await page.waitForTimeout(8000);
  }
  if (s.synergy) {
    const n = await page.evaluate(() => window.__ghostSynergy());
    console.log('interações na prévia:', n);
    await page.waitForTimeout(8000);
  }
  await page.screenshot({ path: `${out}/${s.name}.png`, timeout: s.timeout ?? 120000 });
  const stats = await page.evaluate(() => window.__stats);
  console.log(s.name, JSON.stringify(stats), errors.length ? `ERR ${errors.join(' | ')}` : '');
  await ctx.close();
}
await browser.close();
