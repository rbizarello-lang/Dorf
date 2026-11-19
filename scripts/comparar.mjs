// Compara dois HTMLs locais em sequência. A mesma câmera, semente e viewport nas duas edições.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';
const [original, edition = 'dist/index.html'] = process.argv.slice(2);
if (!original) throw new Error('Informe o caminho do HTML original.');
const files = { original, entrepostos: edition };
const browser = await launch();
try {
  for (const zoom of [8, 28]) {
    for (const [index, name] of ['original','entrepostos','entrepostos','original'].entries()) {
      const page = await browser.newPage({ viewport: { width:1280, height:800 } });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error' && !/net::ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
      await page.goto(pathToFileURL(resolve(files[name])).href + '?mode=classico&stress=300&seed=42&theme=vale&quality=high&time=day&zoom=' + zoom, {waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => window.__load?.tiles >= 300 && window.__stats, null, { timeout:120000 });
      const row = await page.evaluate(async () => {
        const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
        for (let i=0; i<90; i++) await frame();
        const samples = [];
        let last = await frame();
        for (let i=0; i<180; i++) {
          const t = await frame();
          samples.push(t-last);
          last = t;
        }
        samples.sort((a,b)=>a-b);
        const s = window.__stats;
        return { tiles:s.tiles, backend:s.backend, gpu:s.gpu, calls:s.calls, triangles:s.triangles, instances:s.instances,
          p50:+samples[89].toFixed(1), p95:+samples[170].toFixed(1) };
      });
      console.log(JSON.stringify({zoom, trial:index+1, name, ...row, errors}));
      await page.close();
      if (errors.length) throw new Error(errors.join('\n'));
    }
  }
} finally { await browser.close(); }
