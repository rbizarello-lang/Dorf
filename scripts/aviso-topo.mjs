// Uso: npm run build && node scripts/aviso-topo.mjs
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';

const browser = await launch();
try {
  const url = pathToFileURL(resolve('dist/index.html')).href + '?theme=holanda&seed=42&time=day&quality=low&webgl';
  const page = await browser.newPage();
  const cases = [
    [1440, 900, 'm'], [768, 550, 'l'], [390, 844, 'm'], [320, 640, 'l'], [667, 375, 'l'],
  ];
  for (const [width, height, text] of cases) {
    await page.setViewportSize({ width, height });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__egg === 'function');
    assert.equal(await page.evaluate(text => {
      document.documentElement.dataset.text = text;
      return window.__egg('ronda-noturna');
    }, text), 'A Ronda Noturna');
    const notice = page.locator('.toast').filter({ hasText: 'A Ronda Noturna' }).last();
    await notice.waitFor();
    await page.waitForTimeout(300);
    const compare = async () => {
      const a = await notice.boundingBox();
      const top = await page.locator('.hud-top').boundingBox();
      assert.ok(a && top, 'o aviso e o cabeçalho estão presentes');
      assert.ok(a.y >= top.y + top.height + 2, 'o aviso cobre o topo');
      assert.ok(a.x >= 0 && a.x + a.width <= width + 1, 'o aviso passa da largura da tela');
      assert.ok(a.y + a.height <= height, 'o aviso passa da altura da tela');
      return a.height;
    };
    const short = await compare();
    await notice.evaluate(el => { el.textContent = (el.textContent + ' ').repeat(4).trim(); });
    if (width <= 390) assert.ok(await compare() > short, 'o aviso longo não quebrou em linhas');
    else await compare();
    await page.evaluate(() => document.body.classList.add('capture'));
    assert.equal(await page.locator('.hud-top .tools').isVisible(), false);
    assert.equal(await notice.isVisible(), true, 'o aviso sumiu no modo foto');
    console.log(`aviso sem sobreposição: ${width}×${height}, texto ${text}`);
  }
} finally {
  await browser.close();
}
