// Teste de ponta a ponta pela interface: escolhe a ilha, joga uma partida inteira com cliques de verdade,
// confere a telemetria local e o painel de exportação, e falha com qualquer erro no console.
// Uso: npm run build && node scripts/jogar.mjs [1|2] [turnos]   (sem argumentos: as duas ilhas, partida inteira)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const soAbandono = process.argv[2] === 'abandono';
const ilhas = soAbandono ? [] : process.argv[2] ? [Number(process.argv[2])] : [1, 2];
const maxTurns = Number(process.argv[3] || 40);

const server = createServer(async (req, res) => {
  try {
    const p = req.url.split('?')[0];
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await readFile(join(dist, p === '/' ? 'index.html' : p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
let bad = 0;
const fail = (m) => { bad++; console.log('FALHA: ' + m); };

for (const n of ilhas) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/?fps`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  const texto = await page.locator('#escolha').innerText();
  console.log(`Ilha ${n}: tela de escolha diz: ${JSON.stringify(texto.replace(/\s+/g, ' '))}`);
  if (/versão|versao|óleo|oleo|festa|comida/i.test(texto) || /\b[AB]\b/.test(texto)) fail('a tela de escolha revela algo');
  await page.click(n === 1 ? '#ilha1' : '#ilha2');
  await page.waitForFunction(() => window.__game && window.__game().turn === 1 && !document.body.classList.contains('choosing'));
  const versao = await page.evaluate(() => window.__variant());
  console.log(`  versão real: ${versao}`);
  // dica de abertura
  await page.waitForSelector('#dica.on', { timeout: 15000 });
  console.log('  dica 1: ' + (await page.locator('#dicaTxt').innerText()));
  let turns = 0;
  for (; turns < maxTurns; turns++) {
    const st = await page.evaluate(() => { const g = window.__game(); return { over: g.over, turn: g.turn, hand: g.hand.length }; });
    if (st.over) break;
    // escolhe a primeira peça que cabe e o primeiro lugar válido
    const move = await page.evaluate(() => {
      const g = window.__game(), w = window.__world;
      for (let s = 0; s < g.hand.length; s++) {
        if (!g.playable(g.hand[s])) continue;
        const cells = g.validCells(s);
        if (!cells.length) continue;
        // um lugar que esteja de fato sobre o tabuleiro (não por baixo de um painel do HUD)
        for (const c of [...cells].sort((a, b) => Math.hypot(w.screenPos(a).x - 640, w.screenPos(a).y - 380) - Math.hypot(w.screenPos(b).x - 640, w.screenPos(b).y - 380))) {
          const p = w.screenPos(c, 0.2);
          const el = document.elementFromPoint(p.x, p.y);
          if (el && el.tagName === 'CANVAS') return { s, x: p.x, y: p.y };
        }
      }
      return null;
    });
    if (!move) { fail('sem jogada na mão (turno ' + st.turn + ')'); break; }
    await page.keyboard.press(String(move.s + 1));
    await page.waitForTimeout(60);
    await page.mouse.move(move.x, move.y);
    await page.mouse.click(move.x, move.y);
    await page.waitForFunction((t) => window.__game().turn > t || window.__game().over, st.turn, { timeout: 30000 }).catch(async () => { fail('a jogada não andou no turno ' + st.turn + ' ' + JSON.stringify(move) + ' ' + JSON.stringify(await page.evaluate(() => ({ hand: window.__game().hand, info: document.getElementById('info').textContent, sel: [...document.querySelectorAll('.card')].map((c) => c.className) })))); });
    if (turns === 1) console.log('  dica depois: ' + JSON.stringify(await page.locator('#dicaTxt').innerText()) + ' visível=' + await page.locator('#dica.on').count());
  }
  const over = await page.evaluate(() => window.__game().over);
  console.log(`  jogadas: ${turns}, terminou: ${over}`);
  if (maxTurns >= 30 && !over) fail('a partida não terminou');
  await page.waitForTimeout(3600);
  console.log('  fim visível: ' + (await page.locator('#end.on').count()) + '; pontos: ' + (await page.locator('#end .big').innerText().catch(() => '?')).replace(/\s+/g, ' '));
  const fps = await page.locator('#fps').innerText();
  console.log('  medidor: ' + fps);
  await page.click('#menuBtn');
  await page.click('#mExport');
  const json = await page.locator('#expTxt').inputValue();
  const o = JSON.parse(json);
  const g = o.partidas[o.partidas.length - 1];
  console.log(`  exportação: ${json.length} bytes, aparelho ${o.aparelho}, ilha ${g.ilha}, versão ${g.versao}, turnos ${g.turnos.length}, terminou ${g.terminou}, pontos ${g.pontos}`);
  console.log('  turno 1: ' + JSON.stringify(g.turnos[0]));
  if (g.turnos.length !== turns) fail('telemetria com número de turnos diferente das jogadas');
  if (maxTurns >= 30 && !g.terminou) fail('telemetria sem o fim');
  await page.click('#expClose');
  // jogar de novo e abandonar, para conferir o registro
  await page.click('#again');
  await page.waitForTimeout(500);
  await page.click('#menuBtn'); await page.click('#mExport');
  const o2 = JSON.parse(await page.locator('#expTxt').inputValue());
  console.log('  depois de recomeçar: ' + JSON.stringify(o2.partidas.map((p) => ({ id: p.id, terminou: p.terminou, abandonada: p.abandonada, recomecou: p.recomecou, veioDeFim: p.veioDeFim }))));
  await page.click('#expClose');
  if (errors.length) fail('erros no console: ' + errors.join(' | '));
  await page.close();
}
// Abandono: joga 2 turnos e fecha a página; na visita seguinte o registro deve dizer que a partida foi abandonada.
{
  const p1 = await ctx.newPage();
  await p1.goto(`http://127.0.0.1:${port}/?ab=B&seed=5`);
  await p1.waitForFunction(() => window.__ready === true && window.__world.time > 4, null, { timeout: 120000 });
  for (let k = 0; k < 2; k++) {
    const m = await p1.evaluate(() => {
      const g = window.__game(), w = window.__world;
      for (let s = 0; s < g.hand.length; s++) {
        if (!g.playable(g.hand[s])) continue;
        for (const c of g.validCells(s)) { const p = w.screenPos(c, 0.2); const el = document.elementFromPoint(p.x, p.y); if (el && el.tagName === 'CANVAS') return { s, x: p.x, y: p.y, t: g.turn }; }
      }
      return null;
    });
    await p1.keyboard.press(String(m.s + 1)); await p1.waitForTimeout(60);
    await p1.mouse.move(m.x, m.y); await p1.mouse.click(m.x, m.y);
    await p1.waitForFunction((t) => window.__game().turn > t, m.t, { timeout: 30000 });
  }
  await p1.close();
  const p2 = await ctx.newPage();
  await p2.goto(`http://127.0.0.1:${port}/?ab=A&seed=6`);
  await p2.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await p2.click('#menuBtn'); await p2.click('#mExport');
  const o = JSON.parse(await p2.locator('#expTxt').inputValue());
  const ab = o.partidas.find((g) => g.semente === 5);
  console.log('abandono: ' + JSON.stringify({ versao: ab.versao, turnos: ab.turnos.length, terminou: ab.terminou, abandonada: ab.abandonada, fim: !!ab.fim }));
  if (!ab.abandonada || ab.turnos.length !== 2) fail('o registro da partida fechada não ficou como abandonada com 2 turnos');
  await p2.close();
}
await browser.close();
server.close();
console.log(bad ? `${bad} falha(s)` : 'tudo certo');
process.exit(bad ? 1 : 0);
