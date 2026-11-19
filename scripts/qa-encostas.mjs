// Entrada real de mouse e toque sobre o HTML entregue. A inspeção lê vértices do terreno desenhado.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';

const html = path.resolve(process.env.QA_HTML ?? 'dist/index.html');
const output = path.resolve(process.env.QA_OUT ?? '.cache/capturas/encostas');
const sha = (data) => createHash('sha256').update(data).digest('hex');
const htmlHash = sha(fs.readFileSync(html));
const url = pathToFileURL(html);
const timeout = 120_000;
const desktop = { width: 1280, height: 800 };
const portrait = { width: 390, height: 844 };
const first = [1, 0, 0];
const moves = [first, [-1, 1, 1], [-1, 0, 5]];
const observed = moves[1];
const baseline = process.argv.includes('--referencia');
const loadTest = process.argv.includes('--carga');
const key = baseline ? 'entrepostos.crista.save' : 'entrepostos.encostas.save';
const errors = [];
const previousKey = 'entrepostos.crista.save';
const previousSentinel = '{"conta":"controle-do-qa"}';
fs.mkdirSync(output, { recursive: true });

const report = { htmlHash, browser: '', route: loadTest ? { seed: 42, stress: 60, map: 'crista' } : moves, cases: {}, errors };
const browser = await launch();
report.browser = browser.version();

async function open(backend, touch = false) {
  const page = await browser.newPage({ viewport: touch ? portrait : desktop, acceptDownloads: true, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(({ name, sentinel, baseline }) => {
    if (!baseline && localStorage.getItem(name) === null) localStorage.setItem(name, sentinel);
    localStorage.setItem(baseline ? 'entrepostos.crista.photoSize' : 'entrepostos.encostas.photoSize', 'screen');
  }, { name: previousKey, sentinel: previousSentinel, baseline });
  const query = new URLSearchParams({ debug: '', seed: '42', theme: 'riviera', mode: 'entrepostos', mapa: 'crista', quality: touch ? 'medium' : 'high', time: 'day' });
  if (!touch) { query.set('zoom', '7.6'); query.set('yaw', '-1.9'); query.set('pitch', '36'); }
  if (backend === 'webgl2') query.set('webgl', '');
  if (loadTest) { query.set('stress', '60'); query.set('zoom', '18'); }
  await page.goto(url.href + '?' + query, { waitUntil: 'domcontentloaded' });
  if (loadTest) await page.waitForFunction(() => window.__load?.tiles > 4 && window.__stats?.tiles === window.__load.tiles, null, { timeout });
  else await ready(page, 4);
  assert.equal(await page.evaluate(() => window.__stats.backend), backend);
  return page;
}

async function ready(page, placed) {
  await page.waitForFunction(({ n, baseline }) => window.__stats?.tiles === n && (baseline || window.__encostas?.()?.offered?.samples?.length), { n: placed, baseline }, { timeout });
  await page.waitForTimeout(320);
}
const readSave = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
const snapshot = (page) => page.evaluate(() => window.__encostas());
const shape = ({ samples, peak, seed, stage }) => ({ samples, peak, seed, stage });
const summary = ({ samples, peak, seed, stage }) => ({ nodes: samples.length, hash: sha(JSON.stringify(samples)), peak, seed, stage });
const tileAt = (tiles, [q, r]) => {
  const tile = tiles.find((t) => t.q === q && t.r === r);
  assert.ok(tile, 'Malha ausente da inspeção em (' + q + ', ' + r + ')');
  return tile;
};

async function project(page, [q, r]) {
  const point = await page.evaluate(([q, r]) => window.__projectTile(q, r), [q, r]);
  assert.ok(point.visible, 'Centro fora da câmera: ' + JSON.stringify({ q, r, point }));
  return point;
}

async function center(page, cell) {
  const p = await project(page, cell);
  // Arraste na área livre central para evitar que o painel de viagem receba o clique.
  const mid = { x: desktop.width / 2, y: desktop.height / 2 };
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.move(2 * mid.x - p.x, 2 * mid.y - p.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(350);
}
async function aim(page, [q, r, rot], touch = false) {
  const point = await project(page, [q, r]);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else {
    await page.locator('#scene').focus();
    await page.mouse.move(point.x, point.y);
  }
  for (let i = 0; i < Math.min(rot, 6 - rot); i++) {
    if (touch) await page.locator(rot > 3 ? '#rot-left' : '#rot-right').tap();
    else await page.keyboard.press(rot > 3 ? 'Shift+r' : 'r');
  }
  if (!baseline) await page.waitForFunction(([q, r, rot]) => {
    const g = window.__encostas()?.ghost;
    return g && g.q === q && g.r === r && g.rot === rot;
  }, [q, r, rot], { timeout: 8000 });
  return point;
}
async function place(page, move, point, count, touch) {
  const before = baseline ? null : (await snapshot(page)).ghost;
  if (touch) await page.locator('#confirm').tap();
  else {
    await page.mouse.click(point.x, point.y);
    await page.mouse.move(16, 16);
  }
  await ready(page, count);
  const saved = await readSave(page);
  assert.deepEqual(saved.moves.at(-1).slice(0, 3), move);
  if (baseline) return;
  await page.waitForFunction(([q, r]) => window.__encostas().tiles.some((t) => t.q === q && t.r === r), move, { timeout });
  const actual = tileAt((await snapshot(page)).tiles, move);
  assert.deepEqual(summary(actual), summary(before), 'A peça assentada deve repetir o relevo da prévia nessa posição');
  return actual;
}
async function screenshot(page, filename) {
  await page.locator('#stats').evaluate((el) => { el.style.display = 'none'; });
  await page.screenshot({ path: path.join(output, filename + '.png') });
}
async function photo(page, filename) {
  await page.locator('#scene').focus();
  await page.keyboard.press('p');
  const button = page.getByRole('button', { name: 'Salvar foto' });
  await button.waitFor();
  const wait = page.waitForEvent('download', { timeout });
  await button.click();
  const file = path.join(output, filename + '.png');
  await (await wait).saveAs(file);
  const data = fs.readFileSync(file);
  assert.equal(data.toString('ascii', 1, 4), 'PNG');
  assert.deepEqual([data.readUInt32BE(16), data.readUInt32BE(20)], [desktop.width, desktop.height]);
  await page.getByRole('button', { name: 'Sair do modo foto' }).click();
}
async function intervals(page, warmup = 25, count = 90) {
  return page.evaluate(async ({ warmup, count }) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    for (let i = 0; i < warmup; i++) await frame();
    let last = await frame();
    const samples = [];
    for (let i = 0; i < count; i++) {
      const now = await frame(); samples.push(now - last); last = now;
    }
    samples.sort((a, b) => a - b);
    const percentile = (p) => Number(samples[Math.ceil(count * p) - 1].toFixed(2));
    const { calls, triangles, tiles, gpu, backend } = window.__stats;
    return { count, rAFms: { p50: percentile(0.5), p95: percentile(0.95), max: percentile(1) }, calls, triangles, tiles, gpu, backend };
  }, { warmup, count });
}

async function run(backend, touch) {
  const page = await open(backend, touch);
  const name = backend + (touch ? '-toque' : '');
  const result = report.cases[name] = {};
  console.log(name, 'abertura');
  const initial = await snapshot(page);
  const initialSave = await readSave(page);
  assert(initial.offered.peak > 0 && initial.offered.samples.length > 2, 'A peça na mão deve conter relevo antes da seleção');
  result.offered = summary(initial.offered);
  if (!touch) {
    await center(page, observed);
    await screenshot(page, '01-peca-oferecida');
  }
  const point = await aim(page, first, touch);
  const originalGhost = shape((await snapshot(page)).ghost);
  assert.equal(initial.offered.seed, originalGhost.seed, 'A prévia deve usar a peça exibida na pilha');
  if (touch) {
    await page.locator('#rot-right').tap();
    await page.locator('#rot-left').tap();
  } else {
    await page.keyboard.press('r');
    await page.keyboard.press('Shift+r');
  }
  assert.deepEqual(shape((await snapshot(page)).ghost), originalGhost, 'Girar e reverter deve restaurar o relevo previsto');
  assert.deepEqual((await snapshot(page)).tiles, initial.tiles);
  assert.deepEqual(await readSave(page), initialSave);
  result.preview = summary(originalGhost);
  if (!touch) await screenshot(page, '02-encaixe-previsto');
  const [sample] = await Promise.all([touch ? null : intervals(page, 0, 120), place(page, first, point, 5, touch)]);
  if (sample) result.firstPlacement = sample;
  console.log(name, 'primeira colocação');
  let beforeLast, beforeSave, reference;
  for (let i = 1; i < moves.length; i++) {
    const move = moves[i], last = i + 1 === moves.length;
    if (last) {
      beforeLast = (await snapshot(page)).tiles;
      beforeSave = await readSave(page);
      reference = await project(page, observed);
      if (!touch) {
        await page.waitForTimeout(3500);
        await photo(page, '03-antes');
        result.settledBefore = await intervals(page);
      }
    }
    const p = await aim(page, move, touch);
    if (last) {
      result.growthPreview = await page.locator('#development-order').textContent();
      assert.match(result.growthPreview, /Vinhedo\s*·\s*patamar 1/i);
      if (!touch) await screenshot(page, '04-previa-crescimento');
    }
    await place(page, move, p, i + 5, touch);
  }
  const after = (await snapshot(page)).tiles;
  const a = tileAt(beforeLast, observed), b = tileAt(after, observed);
  assert(b.stage > a.stage, 'Um encaixe seguinte deve desenvolver a peça comum já colocada');
  assert(b.peak > a.peak, 'O estágio novo precisa aumentar a elevação da peça comum');
  assert.notDeepEqual(a.samples, b.samples);
  result.growth = { from: summary(a), to: summary(b) };
  const afterSave = await readSave(page);
  if (!touch) {
    assert.deepEqual(await project(page, observed), reference, 'As fotos devem ter a mesma câmera');
    await page.waitForTimeout(3500);
    await photo(page, '05-depois');
    result.settledAfter = await intervals(page);
  } else await screenshot(page, '06-toque');
  console.log(name, 'crescimento', a.peak, b.peak);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page, 4 + moves.length);
  assert.deepEqual(await readSave(page), afterSave);
  assert.deepEqual((await snapshot(page)).tiles, after, 'O replay deve recompor o relevo inteiro');
  if (touch) await page.locator('#btn-undo').tap();
  else { await page.locator('#scene').focus(); await page.keyboard.press('u'); }
  await ready(page, 3 + moves.length);
  const undone = await readSave(page);
  assert.deepEqual(undone.moves, beforeSave.moves);
  assert.equal(undone.score, beforeSave.score);
  assert.deepEqual((await snapshot(page)).tiles, beforeLast, 'Desfazer deve recuperar o relevo anterior');
  assert.equal(await page.evaluate((k) => localStorage.getItem(k), previousKey), previousSentinel);
  result.replayed = true; result.undone = true; result.keptPreviousStorage = true;
  await page.close();
}
async function reference() {
  const page = await open('webgpu');
  const result = report.cases.referencia = {};
  await center(page, observed);
  for (const [i, move] of moves.entries()) {
    const point = await aim(page, move);
    const sampling = i === 0 ? intervals(page, 0, 120) : null;
    await place(page, move, point, 5 + i, false);
    if (sampling) result.firstPlacement = await sampling;
    if (i + 2 === moves.length) result.settledBefore = await intervals(page);
  }
  result.settledAfter = await intervals(page);
  await photo(page, 'referencia-0.4');
  await page.close();
}

async function load() {
  const page = await open('webgpu');
  const result = report.cases.carga = { load: await page.evaluate(() => window.__load) };
  const board = await page.evaluate(() => {
    const save = localStorage.getItem('entrepostos.encostas.save') ?? localStorage.getItem('entrepostos.crista.save');
    return save ? JSON.parse(save).moves ?? [] : [];
  });
  if (board.length) result.routeHash = sha(JSON.stringify(board));
  result.stable = await intervals(page, 75, 120);
  console.log('Carga', result.load.tiles, result.stable.calls, result.stable.triangles, result.stable.rAFms);
  await page.close();
}

try {
  if (loadTest) await load();
  else if (baseline) await reference();
  else {
    if (!process.argv.includes('--toque')) await run('webgpu', false);
    if (!process.argv.includes('--desktop')) await run('webgl2', true);
  }
  assert.deepEqual(errors, []);
  assert.equal(sha(fs.readFileSync(html)), htmlHash);
  report.passed = true;
} finally {
  fs.writeFileSync(path.join(output, 'resultados.json'), JSON.stringify(report, null, 2));
  console.log('HTML', htmlHash, '|', output, '|', errors);
  await browser.close();
}
