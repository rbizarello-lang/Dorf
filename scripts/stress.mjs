// Teste de carga: coloca N peças com a IA gulosa e mede custo de CPU e volume de desenho.
// Uso: npm run build && node scripts/stress.mjs [baseUrl]
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const runs = [
  { n: 300, quality: 'high' },
  { n: 1000, quality: 'high' },
  { n: 2500, quality: 'high' },
  { n: 2500, quality: 'low' },
];
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--ignore-certificate-errors', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
console.log('peças | qualidade | lógica (ms) | montagem (ms) | draw calls | triângulos | instâncias | CPU JS/quadro (ms) | heap JS (MB)');
for (const r of runs) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}?stress=${r.n}&quality=${r.quality}&seed=42`);
  await page.waitForFunction(() => window.__load && window.__stats, null, { timeout: 120000 });
  await page.waitForTimeout(6000);
  const { load, stats, heap } = await page.evaluate(() => ({ load: window.__load, stats: window.__stats, heap: performance.memory?.usedJSHeapSize ?? 0 }));
  if (r.n === 2500 && r.quality === 'high') await page.screenshot({ path: 'docs/screens/stress.png' });
  console.log(
    [load.tiles, r.quality, load.logic.toFixed(0), load.bake.toFixed(0), stats.calls, Math.round(stats.triangles / 1000) + ' mil', stats.instances, stats.cpu.toFixed(2), (heap / 1e6).toFixed(0)].join(' | '),
    errors.length ? `ERROS: ${errors.join(' ; ')}` : '',
  );
  await page.close();
}
await browser.close();
