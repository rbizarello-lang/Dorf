// Confere o jogo instalável e offline, e o backup do Almanaque, no Chromium headless.
// Uso: depois do build, sirva o dist (ex.: `cd dist && python3 -m http.server 4203`) e rode
// `node scripts/pwa.mjs http://127.0.0.1:4203/`. O botão "Instalar" do Chrome não aparece em headless.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch } from './browser.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
let fails = 0;
const ok = (c, msg) => {
  console.log(c ? '  ok:' : '  FALHOU:', msg);
  if (!c) fails++;
};

const browser = await launch(['--ignore-gpu-blocklist']);
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// Manifesto
const man = await (await context.request.get(`${base}manifest.webmanifest`)).json();
ok(man.name === 'Retalhos' && man.start_url === './' && man.display === 'standalone', 'manifesto: name, start_url ./, display standalone');
ok(man.icons.some((i) => i.sizes === '192x192') && man.icons.some((i) => i.sizes === '512x512'), 'manifesto: ícones 192 e 512');
for (const i of man.icons) {
  const r = await context.request.get(base + i.src);
  const b = await r.body();
  ok(r.ok() && b.subarray(1, 4).toString() === 'PNG', `ícone ${i.src} é PNG (${b.length} bytes)`);
}

// Service worker
await page.goto(base);
await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 20000 });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload(); // a recarga já nasce controlada pelo SW
await page.waitForTimeout(3000);
ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker registrado e controlando a página');
ok(await page.evaluate(() => document.querySelector('link[rel=manifest]')?.getAttribute('href') === 'manifest.webmanifest'), 'link do manifesto no HTML');

// Offline: a página abre do cache (inclusive com parâmetros na URL)
await context.setOffline(true);
const off = await context.newPage();
await off.goto(`${base}?seed=3`, { waitUntil: 'load' });
await off.waitForTimeout(4000);
ok((await off.title()) === 'Retalhos' && (await off.locator('#scene').count()) === 1, 'offline: o jogo abre');
await off.close();
await context.setOffline(false);

// Modos de medida não registram o SW (contexto novo, sem SW prévio)
const ctx2 = await browser.newContext();
const p2 = await ctx2.newPage();
await p2.goto(`${base}?auto=5`);
await p2.waitForTimeout(3000);
ok((await p2.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))) === 0, '?auto não registra o service worker');
await ctx2.close();

// Backup do Almanaque (a ajuda abre sozinha na primeira visita)
const openAlmanac = async () => {
  const tab = page.locator('#modal [data-tab="almanaque"]');
  if (!(await tab.first().isVisible())) await page.click('#btn-help');
  await tab.first().click();
};
await page.evaluate(() => {
  localStorage.setItem('retalhos.theme', 'egito');
  localStorage.setItem('retalhos.progress', JSON.stringify({ totals: { games: 7, tiles: 100, quests: 1, synergies: 2, sites: 0, perfects: 0, wonders: 0 } }));
});
await page.goto(base);
await page.waitForTimeout(2500);
await openAlmanac();
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"]')]);
ok(/^retalhos-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), `exporta ${dl.suggestedFilename()}`);
const file = path.join(os.tmpdir(), `retalhos-pwa-${process.pid}.json`);
await dl.saveAs(file);
const bk = JSON.parse(fs.readFileSync(file, 'utf8'));
ok(bk.app === 'retalhos' && bk.data['retalhos.theme'] === 'egito', 'o arquivo traz as chaves retalhos.*');

// Apaga, importa o arquivo, confirma e confere que voltou
await page.evaluate(() => localStorage.clear());
await page.setInputFiles('input[type=file]', file);
await page.waitForSelector('[data-act="import-go"]');
await Promise.all([page.waitForNavigation(), page.click('[data-act="import-go"]')]);
ok((await page.evaluate(() => JSON.parse(localStorage.getItem('retalhos.progress')).totals.games)) === 7, 'importar restaura o progresso e recarrega');

// Arquivo inválido: nada é gravado
await page.evaluate(() => localStorage.clear());
await page.waitForTimeout(1500);
const bad = path.join(os.tmpdir(), `retalhos-pwa-ruim-${process.pid}.json`);
fs.writeFileSync(bad, JSON.stringify({ ...bk, data: { ...bk.data, 'retalhos.progress': 'lixo' } }));
await openAlmanac();
await page.setInputFiles('input[type=file]', bad);
await page.waitForTimeout(800);
ok((await page.locator('[data-act="import-go"]').count()) === 0 && (await page.evaluate(() => localStorage.getItem('retalhos.theme'))) === null, 'arquivo inválido é recusado sem gravar');
fs.rmSync(file);
fs.rmSync(bad);

const errs = errors.filter((e) => !/fonts\.g|ERR_|net::|404|vertex count of 0|GL Driver/.test(e));
ok(errs.length === 0, `sem erros no console ${errs.slice(0, 3).join(' | ')}`);
await browser.close();
process.exit(fails ? 1 : 0);
