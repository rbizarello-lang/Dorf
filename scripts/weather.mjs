// Clima tocável nos 14 temas: dispara chuva, neve e sol por window.__weather e falha com erro no console.
// Uso: npm run build && (cd dist && python3 -m http.server 4173 &) && node scripts/weather.mjs [baseUrl]
// Variáveis: SHOTS=vale:rain,inverno:snow,egito:sun grava capturas em SHOT_DIR (padrão ./weather-shots);
// WAIT (ms por clima, padrão 2500); THEMES=vale,egito limita os temas.
import { mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const themes = ['vale', 'holanda', 'cerrado', 'inverno', 'sakura', 'marte', 'egito', 'song', 'viking', 'toscana', 'edo', 'colonial', 'oeste', 'andes'];
const kinds = ['rain', 'snow', 'sun'];
const wait = Number(process.env.WAIT ?? 2500);
const shots = Object.fromEntries((process.env.SHOTS ?? '').split(',').filter(Boolean).map((s) => s.split(':')));
const dir = process.env.SHOT_DIR ?? 'weather-shots';
if (Object.keys(shots).length) mkdirSync(dir, { recursive: true });
const only = (process.env.THEMES ?? '').split(',').filter(Boolean);

const browser = await launch(['--ignore-gpu-blocklist']);
let failed = 0;
for (const theme of themes.filter((t) => !only.length || only.includes(t))) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}?theme=${theme}&seed=3&auto=8&quality=low&time=day&debug`);
  await page.waitForFunction(() => typeof window.__weather === 'function', null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  for (const k of kinds) {
    // Nas capturas o clima já entra com 10 s de idade (o quadro por software é lento demais para esperar a entrada).
    await page.evaluate(([kind, age]) => window.__weather(kind, age), [k, shots[theme] === k ? 10 : 0]);
    // A captura espera a entrada suave terminar (2,5 s do mundo; no software o quadro é lento).
    await page.waitForTimeout(shots[theme] === k ? Number(process.env.SHOT_WAIT ?? 6000) : wait);
    if (shots[theme] === k) await page.screenshot({ path: `${dir}/${theme}-${k}.png` });
  }
  await page.evaluate(() => window.__weather(null));
  await page.waitForTimeout(wait);
  const errs = errors.filter((e) => !/fonts\.g|ERR_|net::|404|vertex count of 0|GL Driver/.test(e));
  if (errs.length) failed++;
  console.log(theme.padEnd(8), errs.length ? 'ERRO\n  ' + errs.slice(0, 5).map((e) => e.slice(0, 400)).join('\n  ') : 'ok');
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
