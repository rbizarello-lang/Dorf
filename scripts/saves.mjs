// Verifica migração, replay e isolamento de recordes no armazenamento local.
// Requer npm run build e .cache/voyage.mjs; executar somente quando o navegador estiver liberado.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';
import { sail } from '../.cache/voyage.mjs';

const DIST = resolve('dist/index.html');
if (!fs.existsSync(DIST)) throw new Error('Build ausente: gere dist/index.html antes de rodar este roteiro.');
const url = pathToFileURL(DIST).href;
const seed = 42;
const legacyBestKey = 'entrepostos.best.entrepostos.holanda.confluencia.madeira-v11';
const modernBestKey = 'entrepostos.best.entrepostos.holanda.confluencia.madeira';
const directBestKey = 'entrepostos.best.entrepostos.holanda.confluencia.direto';
const oldBestKey = 'entrepostos.best.entrepostos.holanda';

function fixture(combinedFreight, version, count = 8) {
  const route = sail(seed, combinedFreight, 'confluencia');
  assert.ok(route.moves.length >= count, `roteiro deve fornecer ${count} jogadas`);
  const Game = route.game.constructor;
  const game = new Game(seed, { ...route.game.rules, combinedFreight, legacyFreight: true }, [...route.game.specials]);
  const moves = route.moves.slice(0, count);
  const deliveries = [];
  for (const [i, [q, r, rot]] of moves.entries()) {
    game.rot = rot;
    const result = game.place(q, r);
    assert.ok(result, `replay legado recusou a jogada ${i + 1}`);
    if (result.deliveries.length) deliveries.push(...result.deliveries.map((p) => ({ turn: i + 1, id: p.id, reward: p.reward })));
  }
  const save = {
    v: version,
    seed,
    rulesId: 'holanda',
    mode: 'entrepostos',
    moves,
    undone: 0,
    score: game.board.score,
    specials: [...game.specials],
  };
  if (version === 11) save.combinedFreight = combinedFreight;
  return { save, deliveries, score: game.board.score, moves: game.moves };
}

const v11 = fixture(true, 11);
assert.ok(v11.deliveries.some((p) => p.id === 0 && p.reward === 10), 'v11 deve preservar o pagamento legado de 10 peças');
const v11AfterUndo = fixture(true, 11, 7);
const v10 = fixture(false, 10);
const v10AfterUndo = fixture(false, 10, 7);

const browser = await launch();
const pageErrors = [];

async function pageFor(caseId, entries) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(({ id, values }) => {
    const marker = '__saves_test_case';
    if (localStorage.getItem(marker) === id) return;
    localStorage.clear();
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    // Encostas lê o formato legado somente em seu próprio armazenamento.
    if (id !== 'v12-corrupt') {
      for (const [key, value] of Object.entries(values)) {
        localStorage.setItem(key.replace('entrepostos.', 'entrepostos.encostas.'), value);
      }
    }
    localStorage.setItem(marker, id);
  }, { id: caseId, values: entries });
  await page.goto(`${url}?quality=low&seed=${seed}&saves=${caseId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window).__stats, null, { timeout: 120000 });
  return page;
}

async function waitForSave(page, expected) {
  await page.waitForFunction((want) => {
    const raw = localStorage.getItem('entrepostos.encostas.save');
    if (!raw) return false;
    try {
      const save = JSON.parse(raw);
      return save.v === 12 && save.moves.length === want.moves && save.score === want.score
        && save.combinedFreight === want.combinedFreight && save.legacyFreight === true;
    } catch { return false; }
  }, expected, { timeout: 30000 });
  return page.evaluate(() => JSON.parse(localStorage.getItem('entrepostos.encostas.save')));
}

try {
  // A origem v11 continua intacta; o namespace novo guarda o replay já migrado a v12.
  {
    const oldRaw = JSON.stringify(v11.save);
    const oldBest = JSON.stringify({ score: 123, seed });
    const legacyBest = JSON.stringify({ score: 1111, seed });
    const modernBest = JSON.stringify({ score: 9999, seed });
    const page = await pageFor('v11-partial', {
      'entrepostos.save': oldRaw,
      'entrepostos.best.entrepostos.holanda': oldBest,
      [legacyBestKey]: legacyBest,
      [modernBestKey]: modernBest,
    });
    const expected = { moves: 8, score: v11.score, combinedFreight: true };
    const saved = await waitForSave(page, expected);
    assert.equal(saved.layout, 'confluencia');
    assert.equal(saved.legacyFreight, true);
    assert.match(await page.locator('#best').innerText(), /1\.111/, 'carrega o recorde específico v11, não o recorde Madeira atual');
    assert.equal(await page.locator('#best').getAttribute('title'), 'Confluência · Madeira');
    assert.equal(await page.evaluate(() => localStorage.getItem('entrepostos.save')), oldRaw, 'save antigo permanece intacto');
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), legacyBestKey.replace('entrepostos.', 'entrepostos.encostas.')), legacyBest);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), modernBestKey.replace('entrepostos.', 'entrepostos.encostas.')), modernBest);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window).__stats, null, { timeout: 120000 });
    await waitForSave(page, expected);
    await page.locator('#btn-undo').click();
    const undone = await waitForSave(page, { moves: 7, score: v11AfterUndo.score, combinedFreight: true });
    assert.equal(undone.undone, 1);
    assert.equal(undone.legacyFreight, true, 'desfazer conserva pagamento legado');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window).__stats, null, { timeout: 120000 });
    await waitForSave(page, { moves: 7, score: v11AfterUndo.score, combinedFreight: true });
    await page.close();
    console.log('v11 parcial: pagamento, migração, reload, undo e recorde segregado');
  }

  // A v10 tinha entrega direta. A migração mantém o score e não adota os recordes Madeira.
  {
    const oldRaw = JSON.stringify(v10.save);
    const oldBest = JSON.stringify({ score: 123, seed });
    const directBest = JSON.stringify({ score: 333, seed });
    const page = await pageFor('v10-partial', {
      'entrepostos.save': oldRaw,
      'entrepostos.best.entrepostos.holanda': oldBest,
      [directBestKey]: directBest,
      [modernBestKey]: JSON.stringify({ score: 9999, seed }),
      [legacyBestKey]: JSON.stringify({ score: 8888, seed }),
    });
    const expected = { moves: 8, score: v10.score, combinedFreight: false };
    const saved = await waitForSave(page, expected);
    assert.equal(saved.layout, 'confluencia');
    assert.equal(saved.legacyFreight, true);
    assert.match(await page.locator('#best').innerText(), /333/, 'carrega recorde direto, sem misturar Madeira');
    assert.equal(await page.evaluate(() => localStorage.getItem('entrepostos.save')), oldRaw, 'save v10 antigo permanece intacto');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window).__stats, null, { timeout: 120000 });
    await waitForSave(page, expected);
    await page.locator('#btn-undo').click();
    const undone = await waitForSave(page, { moves: 7, score: v10AfterUndo.score, combinedFreight: false });
    assert.equal(undone.undone, 1);
    assert.equal(undone.legacyFreight, true);
    await page.close();
    console.log('v10 parcial: migração, score direto, reload e undo');
  }

  // O descarte local preserva o armazenamento das duas edições anteriores.
  {
    const oldRaw = JSON.stringify(v10.save);
    const corrupt = JSON.stringify({ v: 12, layout: 'inventado', seed, rulesId: 'holanda', mode: 'entrepostos', moves: 'inválidas', undone: 0, score: 90, specials: [] });
    const page = await pageFor('v12-corrupt', {
      'entrepostos.save': oldRaw,
      'entrepostos.cartas.save': oldRaw,
      'entrepostos.crista.save': oldRaw,
      'entrepostos.encostas.save': corrupt,
    });
    const save = await page.waitForFunction(() => {
      const raw = localStorage.getItem('entrepostos.encostas.save');
      if (!raw) return null;
      try { const value = JSON.parse(raw); return value.v === 12 && value.moves.length === 0 ? value : null; }
      catch { return null; }
    }, null, { timeout: 30000 });
    const fresh = await save.jsonValue();
    assert.equal(fresh.seed, seed);
    assert.equal(await page.evaluate(() => localStorage.getItem('entrepostos.save')), oldRaw, 'migração não altera a cópia antiga mesmo quando o destino está corrompido');
    assert.equal(await page.evaluate(() => localStorage.getItem('entrepostos.cartas.save')), oldRaw, 'Encostas preserva o namespace da Confluências');
    assert.equal(await page.evaluate(() => localStorage.getItem('entrepostos.crista.save')), oldRaw, 'Encostas preserva o namespace da Crista');
    await page.close();
    console.log('v12 corrompido: descarte local sem apagar a origem antiga');
  }

  assert.deepEqual(pageErrors, [], `erros de página: ${pageErrors.join(' | ')}`);
  console.log('Migração de saves concluída sem erros de página.');
} finally {
  await browser.close();
}
