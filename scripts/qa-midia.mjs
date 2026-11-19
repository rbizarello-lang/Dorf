// Exercita a ajuda, o Zen e as exportações do HTML jogável no Chrome.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';

const browser = await launch();
const output = '.cache/capturas';
fs.mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const open = async (query) => {
    await page.goto(pathToFileURL(resolve('dist/index.html')).href + '?' + query, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__stats?.tiles > 0, null, { timeout: 120000 });
  };
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('entrepostos.crista.save')));
  await open('debug&theme=riviera&mapa=confluencia&seed=42&quality=medium');
  await page.locator('#btn-help').click();
  assert(await page.getByRole('dialog').isVisible());
  await page.keyboard.press('Escape');
  assert(await page.locator('#btn-help').evaluate((el) => el === document.activeElement));
  await page.locator('#btn-new').click();
  await page.locator('button[data-mode=zen]').click();
  assert.equal((await save()).mode, 'zen');
  assert(await page.evaluate(() => window.__placeBest()));
  await page.waitForFunction(() => window.__stats?.tiles === 2);
  assert.equal((await save()).moves.length, 1);
  await page.evaluate(() => localStorage.setItem('entrepostos.crista.photoSize', 'screen'));
  await open('debug&theme=riviera&quality=medium');
  await page.keyboard.press('p');
  await page.getByRole('button', { name: 'Salvar foto' }).waitFor();
  const download = page.waitForEvent('download', { timeout: 120000 });
  await page.getByRole('button', { name: 'Salvar foto' }).click();
  const png = await download;
  await png.saveAs(output + '/qa-foto.png');
  const photo = fs.readFileSync(output + '/qa-foto.png');
  assert.equal(photo.toString('ascii', 1, 4), 'PNG');
  assert.equal(photo.readUInt32BE(16), 960);
  assert.equal(photo.readUInt32BE(20), 600);
  await page.getByRole('button', { name: 'Sair do modo foto' }).click();
  await page.locator('#scene').focus();
  await page.keyboard.press('v');
  await page.waitForFunction(() => {
    const label = document.querySelector('#btn-camera.rec .long')?.textContent;
    return label && !label.endsWith('0:00');
  }, null, { timeout: 30000 });
  const video = await page.evaluate(() => window.__video({ kind: 'take', height: 144, quality: 'high' }));
  assert(video?.bytes > 3000);
  const mp4 = Buffer.from(video.b64, 'base64');
  assert.equal(mp4.length, video.bytes);
  assert.equal(mp4.toString('ascii', 4, 8), 'ftyp');
  assert(mp4.includes(Buffer.from('moov')) && mp4.includes(Buffer.from('mdat')));
  const decoded = await page.evaluate(async (encoded) => {
    const blob = new Blob([Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('video');
    try {
      await new Promise((resolve, reject) => {
        element.addEventListener('loadeddata', resolve, { once: true });
        element.addEventListener('error', () => reject(new Error(element.error?.message ?? 'MP4 ilegível')), { once: true });
        element.src = url;
      });
      return { height: element.videoHeight, duration: element.duration };
    } finally {
      URL.revokeObjectURL(url);
    }
  }, video.b64);
  assert.equal(decoded.height, 144);
  assert(decoded.duration > 0 && decoded.duration < 10);
  fs.writeFileSync(output + '/qa-gravacao.mp4', mp4);
  assert.equal((await save()).moves.length, 1);
  assert.deepEqual(errors, []);
  console.log('Ajuda, Zen e foto real 960×600. MP4 curto:', video.bytes, 'bytes;', decoded);
} finally {
  await browser.close();
}
