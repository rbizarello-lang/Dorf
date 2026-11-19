// Registra a mesma peça antes e depois da chegada de uma nova vizinha.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';
import { sail } from '../.cache/voyage.mjs';

const browser = await launch();
const output = '.cache/capturas';
fs.mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const url = pathToFileURL(resolve(process.env.QA_HTML ?? 'dist/index.html')).href;
  await page.goto(url + '?debug&seed=42&theme=riviera&mapa=confluencia&time=day&quality=high&zoom=9.5&pitch=50&focus=4', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__stats?.tiles === 1, null, { timeout: 120000 });
  await page.locator('#toasts').evaluate((toasts) => { toasts.style.display = 'none'; });
  await page.locator('#scene').focus();
  const { moves } = sail(42);
  const project = (q, r) => page.evaluate(([q, r]) => window.__projectTile(q, r), [q, r]);
  const place = async ([q, r, rot], count) => {
    for (let step = 0; step < rot; step++) await page.keyboard.press('r');
    const point = await project(q, r);
    assert(point.visible);
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction((n) => window.__frameCosts().development.tiles === n, count);
    await page.mouse.move(1279, 799);
    await page.waitForTimeout(350);
  };
  const photo = async (name) => {
    await page.locator('#scene').focus();
    await page.keyboard.press('p');
    await page.waitForFunction(() => document.querySelector('.capture-bar:not([hidden])'));
    await page.locator('.capture-bar:not(.export)').evaluate((bar) => { bar.style.display = 'none'; });
    await page.locator('#scene').evaluate((canvas) => canvas.blur());
    await page.screenshot({ path: output + '/riviera-jogada-' + name + '.png' });
    await page.keyboard.press('Escape');
  };
  await place(moves[0], 2);
  const reference = await project(moves[0][0], moves[0][1]);
  await photo('antes');
  await place(moves[1], 3);
  assert.deepEqual(await project(moves[0][0], moves[0][1]), reference, 'Câmera fixa sobre a peça vizinha');
  await photo('depois');
  assert.deepEqual(errors, []);
  console.log('Costa dos Terraços: segunda peça assentada, câmera fixa, primeira peça revisitada.');
} finally {
  await browser.close();
}
