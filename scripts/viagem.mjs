// Joga o HTML entregue com mouse e teclado, recarrega o save, desfaz a entrega e chega ao fim.
// O roteiro de entradas vem de tests/voyage.ts. Gere-o com npm run viagem.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';
import { sail } from '../.cache/voyage.mjs';

const output = '.cache/capturas';
fs.mkdirSync(output, { recursive: true });
const url = pathToFileURL(path.resolve('dist/index.html')).href;
const seed = 42;
const combined = process.env.FRETE === 'madeira';
const { game, moves } = sail(seed, combined);
assert(game.over && game.board.ports.every((p) => p.delivered));
const errors = [];
const browser = await launch();
const report = (p) => {
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
};
try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  report(desktop);
  await desktop.addInitScript(() => { if (!localStorage.getItem('retalhos.save')) localStorage.setItem('retalhos.save', 'partida anterior'); });
  await desktop.goto(url + '?debug&seed=42&quality=high', {waitUntil:'domcontentloaded'});
  await desktop.waitForFunction(() => window.__stats?.tiles === 1, null, {timeout:90000});
  await desktop.keyboard.press('f');
  assert.equal(await desktop.locator('#modal').isVisible(), false);
  assert.equal(await desktop.locator('#ports button').count(), 3);
  if (combined) {
    await desktop.getByRole('button', { name: 'Escolher frete' }).click();
    await desktop.getByRole('button', { name: /^Madeira para a Feira/ }).click();
  }
  const baseStats = await desktop.evaluate(() => window.__stats);
  console.log('Desktop', baseStats.backend, baseStats.gpu);
  await desktop.screenshot({ path: output + '/abertura.png' });
  async function play(move) {
    const [q,r,rot] = move;
    for (let j=0; j<rot; j++) await desktop.keyboard.press('r');
    const pos = await desktop.evaluate(([x,y]) => window.__projectTile(x,y), [q,r]);
    assert(pos.visible, 'A jogada do roteiro precisa estar na tela');
    await desktop.mouse.click(pos.x,pos.y);
  }
  const saved = () => desktop.evaluate(() => JSON.parse(localStorage.getItem('entrepostos.save')));
  await play(moves[0]);
  await play(moves[1]);
  assert.equal((await saved()).moves.length, 2);
  assert.equal(await desktop.locator('#ports .delivered').count(), combined ? 0 : 1);
  if (combined) assert.match(await desktop.locator('#ports').innerText(), /Em espera/);
  else await desktop.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('entrepostos.save'));
    s.v = 10;
    delete s.combinedFreight;
    localStorage.setItem('entrepostos.save', JSON.stringify(s));
  });
  await desktop.reload({waitUntil:'domcontentloaded'});
  await desktop.waitForFunction(() => window.__stats?.tiles === 3);
  assert.equal(await desktop.locator('#ports .delivered').count(), combined ? 0 : 1);
  assert.equal((await saved()).v, 11);
  assert.equal((await saved()).combinedFreight, combined);
  await desktop.locator('#btn-undo').click();
  assert.equal((await saved()).moves.length, 1);
  assert.equal((await saved()).combinedFreight, combined);
  assert.equal(await desktop.locator('#ports .delivered').count(), 0);
  await desktop.keyboard.press('f');
  let sawFreight = false;
  for (let i=1; i<moves.length; i++) {
    await play(moves[i]);
    if (combined && !sawFreight && await desktop.locator('#ports .delivered').count() === 2) {
      const state = await saved();
      await desktop.getByRole('button', { name: 'Rever a travessia' }).click();
      await desktop.waitForTimeout(450);
      await desktop.screenshot({ path: output + '/frete.png' });
      assert.deepEqual(await saved(), state);
      await desktop.getByRole('button', { name: 'Ver mapa' }).click();
      await desktop.waitForTimeout(1200);
      sawFreight = true;
    }
    if (i < moves.length - 1) assert.equal((await saved()).moves.length, i+1, 'Jogada ' + i);
    if (i === 9) {
      await desktop.mouse.move(1,799);
      await desktop.waitForTimeout(1000);
      await desktop.screenshot({ path: output + '/viagem.png' });
    }
  }
  await desktop.getByRole('heading', { name: 'Os três cais estão abastecidos!' }).waitFor();
  if (combined) assert(sawFreight, 'A Serraria e a Feira precisam estar entregues antes da última jogada');
  assert.equal(await desktop.locator('.final [data-count]').getAttribute('data-count'), String(game.board.score));
  console.log('Vitória na interface', moves.length, 'jogadas,', game.board.score, 'pontos');
  assert.equal(await desktop.evaluate(() => localStorage.getItem('retalhos.save')), 'partida anterior');
  await desktop.close();

  const mobile = await browser.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  report(mobile);
  await mobile.goto(url + '?seed=42&quality=medium&webgl&debug' + (combined ? '&time=night' : ''), {waitUntil:'domcontentloaded'});
  await mobile.waitForFunction(() => window.__stats?.tiles === 1);
  await mobile.keyboard.press('f');
  if (combined) {
    await mobile.getByRole('button', {name: 'Escolher frete'}).tap();
    await mobile.getByRole('button', {name: /^Madeira para a Feira/}).tap();
  }
  const [q,r,rot] = moves[0];
  for (let j=0; j<rot; j++) await mobile.locator('#rot-right').tap();
  const point = await mobile.evaluate(([x,y]) => window.__projectTile(x,y), [q,r]);
  await mobile.touchscreen.tap(point.x,point.y);
  await mobile.locator('#confirm').tap();
  await mobile.waitForFunction(() => window.__stats?.tiles === 2);
  await mobile.getByRole('button', {name:/Localizar Feira/}).tap();
  await mobile.getByRole('button', {name:'Ver mapa'}).tap();
  await mobile.waitForTimeout(1000);
  await mobile.screenshot({path:output+(combined ? '/frete-noite.png' : '/celular.png')});
  console.log('Toque', await mobile.evaluate(()=>window.__stats.backend), 'rotação, encaixe e carta');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
