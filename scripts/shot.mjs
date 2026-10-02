// Capturas avulsas para conferência (não grava em docs/screens).
// Uso: node scripts/shot.mjs <pasta> "<nome>=<query>" ["<nome>=<query>" ...]
// Variáveis: WAIT (ms, padrão 9000), W e H (viewport, padrão 1440×860).
import { launch } from './browser.mjs';

const [dir, ...specs] = process.argv.slice(2);
const wait = Number(process.env.WAIT ?? 9000);
const browser = await launch(['--ignore-gpu-blocklist']);
for (const spec of specs) {
  const [name, q] = [spec.slice(0, spec.indexOf('=')), spec.slice(spec.indexOf('=') + 1)];
  const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 860) } });
  const errors = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:4173/?${q}`);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${dir}/${name}.png` });
  const stats = await page.evaluate(() => window.__stats);
  const errs = errors.filter((e) => !/fonts\.g|ERR_|net::|404|vertex count of 0|GL Driver/.test(e));
  console.log(name, JSON.stringify(stats), errs.length ? '\n  ' + errs.slice(0, 5).map((e) => e.slice(0, 500)).join('\n  ') : '');
  await page.close();
}
await browser.close();
