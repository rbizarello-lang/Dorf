// Mede a primeira troca e a repetição Alta → Média em uma sessão nova por HTML.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';

const files = process.argv.slice(2);
const webgl = process.env.QUALIDADE_WEBGL === '1';
const tiles = Number(process.env.QUALIDADE_CARGA ?? 300);
const rounds = Number(process.env.QUALIDADE_RODADAS ?? 1);
const fx = process.env.QUALIDADE_FX;
const url = 'debug&mode=classico&theme=vale&seed=42&quality=high&zoom=8';

for (let round = 1; round <= rounds; round++) {
  const order = round % 2 ? [...files] : [...files].reverse();
  for (const file of order) {
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      const base = pathToFileURL(resolve(file)).href;
      const effects = fx === undefined ? '' : `&fx=${encodeURIComponent(fx)}`;
      await page.goto(`${base}?${url}&stress=${tiles}${webgl ? '&webgl' : ''}${effects}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(n => window.__stats?.tiles === n + 1 && window.__stats.quality === 'high', tiles, { timeout: 90000 });
      const result = await page.evaluate(async () => {
        const tasks = [];
        const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration }))));
        observer.observe({ type: 'longtask' });
        const frame = () => new Promise(r => requestAnimationFrame(r));
        const select = quality => {
          document.querySelector('#btn-quality').click();
          document.querySelector(`#menu [data-id="${quality}"]`).click();
        };
        const measure = async () => {
          for (let i = 0; i < 45; i++) await frame();
          let last = await frame();
          const start = performance.now();
          select('medium');
          const synchronous = performance.now() - start;
          const frames = [];
          for (let i = 0; i < 60; i++) {
            const next = await frame();
            const { sceneMs, postMs, renderMs, worldMs, preview } = window.__frameCosts();
            frames.push({ interval: next - last, sceneMs, postMs, renderMs, worldMs, previewMs: preview.cpu });
            last = next;
          }
          const worstInterval = frames.reduce((a, b) => a.interval > b.interval ? a : b);
          const peak = key => Math.max(...frames.map(row => row[key]));
          return { synchronous, worstInterval, scenePeak: peak('sceneMs'), postPeak: peak('postMs'), worldPeak: peak('worldMs'), previewPeak: peak('previewMs'), tasks: tasks.filter(t => t.start >= start).map(t => t.duration) };
        };
        const cold = await measure();
        select('high');
        const warm = await measure();
        observer.disconnect();
        return { gpu: window.__stats.gpu, backend: window.__stats.backend, tiles: window.__stats.tiles, cold, warm };
      });
      const sha256 = createHash('sha256').update(await readFile(file)).digest('hex');
      console.log(JSON.stringify({ file, sha256, round, fx: fx ?? null, ...result, errors }));
      if (errors.length) process.exitCode = 1;
    } finally {
      await browser.close();
    }
  }
}
