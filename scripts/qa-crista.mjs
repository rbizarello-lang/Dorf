// Ensaios com entradas de navegador no HTML compilado. Cada contexto tem seu próprio save.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';

const html = path.resolve(process.env.QA_HTML ?? 'dist/index.html');
const output = path.resolve(process.env.QA_OUT ?? '.cache/capturas/crista');
const desktop = { width: 1280, height: 800 };
const portrait = { width: 390, height: 844 };
const landscape = { width: 667, height: 375 };
const timeout = 120_000;
const errors = [];
const digest = (value) => createHash('sha256').update(value).digest('hex');
const htmlHash = digest(fs.readFileSync(html));
const url = pathToFileURL(html).href;
const baseQuery = 'debug&theme=riviera&time=day&quality=high';
fs.mkdirSync(output, { recursive: true });

const browser = await launch();

async function open(query, viewport = desktop, touch = false) {
  const page = await browser.newPage({
    viewport,
    acceptDownloads: true,
    reducedMotion: 'reduce',
    isMobile: touch,
    hasTouch: touch,
  });
  await page.addInitScript(() => {
    localStorage.setItem('entrepostos.encostas.photoSize', 'screen');
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(url + '?' + query, { waitUntil: 'domcontentloaded' });
  await ready(page);
  return page;
}

async function ready(page) {
  await page.waitForFunction(() => window.__stats?.tiles > 0, null, { timeout });
}

async function settle(page, tiles) {
  await page.waitForFunction((n) => window.__stats?.tiles === n, tiles, { timeout });
  await page.waitForTimeout(650);
}

async function readSave(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('entrepostos.encostas.save')));
}

async function project(page, [q, r]) {
  const point = await page.evaluate(([q, r]) => window.__projectTile(q, r), [q, r]);
  assert(point.visible, JSON.stringify({ q, r, point }));
  return point;
}

async function aim(page, move, touch = false) {
  if (!touch) await page.locator('#scene').focus();
  const { x, y } = await project(page, move);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.move(x, y);
  return { x, y };
}

async function drop(page, point, tiles, touch = false) {
  if (touch) await page.locator('#confirm').tap();
  else await page.mouse.click(point.x, point.y);
  if (!touch) await page.mouse.move(1, desktop.height - 1);
  await settle(page, tiles);
}

async function photo(page, name) {
  await page.locator('#scene').focus();
  await page.keyboard.press('p');
  const save = page.getByRole('button', { name: 'Salvar foto' });
  await save.waitFor();
  const downloading = page.waitForEvent('download', { timeout });
  await save.click();
  const file = path.join(output, name + '.png');
  await (await downloading).saveAs(file);
  const png = fs.readFileSync(file);
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [desktop.width, desktop.height]);
  await page.getByRole('button', { name: 'Sair do modo foto' }).click();
}

async function shot(page, name) {
  await page.locator('#stats').evaluate((el) => { el.style.display = 'none'; });
  await page.screenshot({ path: path.join(output, name + '.png') });
}

async function timings(page, warmup = 30, frames = 120) {
  return page.evaluate(async ({ warmup, frames }) => {
    const next = () => new Promise((resolve) => requestAnimationFrame(resolve));
    for (let i = 0; i < warmup; i++) await next();
    let last = await next();
    const samples = [];
    for (let i = 0; i < frames; i++) {
      const now = await next();
      const { worldMs, renderMs, sceneMs, preview, calls, triangles } = window.__frameCosts();
      samples.push({ intervalMs: now - last, worldMs, renderMs, sceneMs, previewMs: preview.cpu, calls, triangles });
      last = now;
    }
    return { stats: window.__stats, costs: window.__frameCosts(), samples };
  }, { warmup, frames });
}

function summarize({ stats, samples, costs }) {
  const percentiles = {};
  for (const key of ['intervalMs', 'worldMs', 'renderMs', 'sceneMs', 'previewMs', 'calls', 'triangles']) {
    const values = samples.map((sample) => sample[key]).filter(Number.isFinite).sort((a, b) => a - b);
    if (!values.length) continue;
    const at = (rank) => Number(values[Math.ceil(values.length * rank) - 1].toFixed(2));
    percentiles[key] = { p50: at(0.50), p95: at(0.95), max: at(1) };
  }
  return { stats, development: costs.development, samples: samples.length, ...percentiles };
}

async function checkMap(page) {
  const collisions = await page.evaluate(() => {
    const rects = [...document.querySelectorAll('.score-block,.tools,#manifest,.stack')].map((el) => el.getBoundingClientRect());
    const overlap = (a, b) => a.width && b.width && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const fits = (r) => r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
    const markers = [...document.querySelectorAll('.marker.port')].filter((el) => /Feira|Serraria|Estaleiro/.test(el.textContent));
    const hiddenPorts = markers.filter((el) => {
      const r = el.getBoundingClientRect();
      return !fits(r) || rects.some((b) => overlap(r, b));
    }).map((el) => el.textContent);
    const clippedTools = [...document.querySelectorAll('.tools button')].filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && (!fits(rect) || overlap(rect, rects[0]));
    }).map((el) => el.id);
    return { ports: markers.length, hiddenPorts, clippedTools };
  });
  assert.deepEqual(collisions, { ports: 3, hiddenPorts: [], clippedTools: [] }, JSON.stringify(page.viewportSize()));
}


async function snapshot(page) {
  return page.evaluate(() => window.__crista());
}

async function undo(page, tiles) {
  await page.locator('#scene').focus();
  await page.keyboard.press('u');
  await settle(page, tiles);
}

const query = baseQuery + '&mode=entrepostos&mapa=crista&seed=42';
const desktopQuery = query + '&yaw=0.23&zoom=10.2&pitch=45';
const move = [1, 0, 0];
const tilesBefore = 4;
const tilesAfter = tilesBefore + 1;
const neighbors = [[0, 1], [1, 1]];
const report = { html, htmlHash, browser: browser.version(), frames: {} };

async function collect(page, name, warmup, frames) {
  const result = await timings(page, warmup, frames);
  report.frames[name] = summarize(result);
  fs.writeFileSync(path.join(output, name + '-quadros.json'), JSON.stringify(result.samples));
}

async function revised() {
  const overview = await open(query);
  assert.equal(await overview.evaluate(() => window.__stats.backend), 'webgpu');
  assert.match(await overview.locator('#chart-name').textContent(), /crista/i);
  await settle(overview, tilesBefore);
  await shot(overview, '01-panorama-jogavel');
  await photo(overview, '02-panorama');
  await collect(overview, 'inicial-webgpu');
  report.overviewCamera = await Promise.all(neighbors.map((pos) => project(overview, pos)));
  await overview.getByRole('button', { name: 'Ver mapa' }).click();
  await overview.waitForTimeout(650);
  await checkMap(overview);
  await overview.close();

  const game = await open(desktopQuery);
  const initial = await snapshot(game);
  const initialSave = await readSave(game);
  assert(initial, 'A inspeção do relevo precisa fornecer o estado do cenário');
  await photo(game, '03-antes');
  const reference = await Promise.all(neighbors.map((pos) => project(game, pos)));
  const point = await aim(game, move);
  await game.keyboard.press('r');
  assert.match(await game.locator('#sailing-order').textContent(), /Gire para alinhar/);
  await game.keyboard.press('Shift+r');
  await game.waitForTimeout(300);
  report.preview = await game.locator('#development-order').textContent();
  assert.match(report.preview, /Campanário \d → \d/);
  assert.match(report.preview, /Belvedere \d → \d/);
  for (const name of ['Campanário 2 → 3', 'Belvedere 1 → 2']) {
    await game.locator('.marker.port').filter({ hasText: name }).waitFor({ state: 'visible', timeout: 8_000 });
  }
  assert.deepEqual(await snapshot(game), initial, 'A prévia não deve alterar a aldeia');
  assert.deepEqual(await readSave(game), initialSave, 'A prévia não deve alterar o save');
  await shot(game, '04-previa-encaixe');
  const sampling = timings(game, 0, 120);
  await drop(game, point, tilesAfter);
  const placement = await sampling;
  report.frames['jogada-webgpu'] = summarize(placement);
  fs.writeFileSync(path.join(output, 'jogada-webgpu-quadros.json'), JSON.stringify(placement.samples));

  const advanced = await snapshot(game);
  assert.equal(initial.length, 3);
  assert.equal(advanced.length, 3);
  for (const before of initial) {
    const after = advanced.find((lot) => lot.q === before.q && lot.r === before.r);
    if (neighbors.some(([q, r]) => before.q === q && before.r === r)) {
      assert.equal(after.stage, before.stage + 1, before.name);
      assert(after.buildings.length > before.buildings.length, before.name);
    } else assert.deepEqual(after, before);
  }
  const advancedSave = await readSave(game);
  assert.deepEqual(advancedSave.moves[0].slice(0, 3), move);
  assert.deepEqual(await Promise.all(neighbors.map((pos) => project(game, pos))), reference, 'A câmera deve continuar fixa');
  await photo(game, '05-depois');
  await collect(game, 'assentado-webgpu');

  await game.reload({ waitUntil: 'domcontentloaded' });
  await settle(game, tilesAfter);
  assert.deepEqual(await readSave(game), advancedSave);
  assert.deepEqual(await snapshot(game), advanced, 'Reabertura deve restaurar estágios e implantações');
  assert.deepEqual(await Promise.all(neighbors.map((pos) => project(game, pos))), reference, 'A reabertura deve manter o enquadramento do ensaio');
  await photo(game, '06-reabertura');
  await undo(game, tilesBefore);
  assert.equal((await readSave(game)).moves.length, 0);
  assert.equal((await readSave(game)).undone, 1);
  assert.deepEqual(await snapshot(game), initial, 'Desfazer deve restaurar estágios e implantações');
  report.undoCamera = await Promise.all(neighbors.map((pos) => project(game, pos)));
  await photo(game, '07-desfeito');
  await game.reload({ waitUntil: 'domcontentloaded' });
  await settle(game, tilesBefore);
  assert.deepEqual(await snapshot(game), initial);
  report.referenceCamera = reference;
  report.initial = initial;
  report.advanced = advanced;
  report.initialHash = digest(JSON.stringify(initial));
  report.advancedHash = digest(JSON.stringify(advanced));
  report.advancedSave = advancedSave;
  await game.close();

  const baseline = await open(query + '&vivas=0');
  await settle(baseline, tilesBefore);
  await collect(baseline, 'inicial-webgpu-paisagem-desativada');
  await baseline.close();

  const secondAngle = await open(query + '&yaw=1.2&zoom=11&pitch=44');
  await settle(secondAngle, tilesBefore);
  await photo(secondAngle, '08-segundo-angulo');
  await secondAngle.close();

  const webgl = await open(query + '&webgl');
  assert.equal(await webgl.evaluate(() => window.__stats.backend), 'webgl2');
  assert.deepEqual(await snapshot(webgl), initial);
  await shot(webgl, '09-webgl2-jogavel');
  await collect(webgl, 'inicial-webgl2');
  await webgl.close();

  const ui = await open(baseQuery + '&mode=entrepostos&mapa=confluencia&seed=42');
  await ui.getByRole('button', { name: 'Escolher frete' }).click();
  await ui.locator('#voyage-map').selectOption('crista');
  await ui.getByRole('button', { name: /^Entrega direta/ }).click();
  await settle(ui, tilesBefore);
  assert.match(await ui.locator('#chart-name').textContent(), /crista/i);
  assert.deepEqual(await snapshot(ui), initial);
  await ui.close();
}

async function touchQA() {
  const mobile = await open(query.replace('quality=high', 'quality=medium') + '&webgl', portrait, true);
  await settle(mobile, tilesBefore);
  await checkMap(mobile);
  await shot(mobile, '10-toque-retrato');
  await mobile.locator('#chart-toggle').tap();
  await mobile.getByRole('button', { name: 'Guiar encaixe na crista' }).tap();
  await mobile.waitForTimeout(650);
  await shot(mobile, '10a-toque-guia');
  await mobile.getByRole('button', { name: 'Ver mapa' }).tap();
  await mobile.waitForTimeout(650);
  await checkMap(mobile);
  await mobile.setViewportSize(landscape);
  await mobile.waitForTimeout(550);
  await shot(mobile, '11-toque-paisagem');
  await checkMap(mobile);
  await mobile.setViewportSize(portrait);
  await mobile.waitForTimeout(550);
  await checkMap(mobile);
  const touch = await aim(mobile, move, true);
  await mobile.locator('#rot-right').tap();
  await mobile.locator('#rot-left').tap();
  await drop(mobile, touch, tilesAfter, true);
  assert.deepEqual((await readSave(mobile)).moves[0].slice(0, 3), move);
  await shot(mobile, '12-toque-jogada');
  await mobile.close();

  const newLandscape = await open(query.replace('quality=high', 'quality=medium') + '&webgl', landscape, true);
  await settle(newLandscape, tilesBefore);
  await checkMap(newLandscape);
  await newLandscape.close();
}

try {
  if (!process.argv.includes('--toque')) await revised();
  if (!process.argv.includes('--desktop')) await touchQA();
  assert.deepEqual(errors, []);
  assert.equal(digest(fs.readFileSync(html)), htmlHash, 'O HTML mudou durante o ensaio');
} finally {
  report.errors = errors;
  fs.writeFileSync(path.join(output, 'resultados.json'), JSON.stringify(report, null, 2));
  console.log('SHA-256', htmlHash, '|', browser.version(), '|', output);
  for (const [name, frame] of Object.entries(report.frames)) console.log(name, frame.stats.gpu, JSON.stringify({ intervalMs: frame.intervalMs, renderMs: frame.renderMs, calls: frame.calls, triangles: frame.triangles }));
  if (errors.length) console.log(errors);
  await browser.close();
}
