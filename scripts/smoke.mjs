// Teste de fumaça no navegador: abre o build (dist/index.html) no Chromium headless, em
// WebGPU e em WebGL2 (?webgl), deixa a IA colocar 12 peças e falha se o console tiver erro
// ou se o tabuleiro não chegar a 13 peças. Pega o que os testes em Node não veem: um nó TSL
// que não compila num dos backends, um erro de inicialização no main.ts, um recurso que falta.
// Além de Baixa, abre Alta e Ultra (poucas peças, para caber na CI) nos dois backends e, num caso
// à parte, troca a qualidade (Baixa, Alta, Ultra, Média) e a hora (dia, entardecer, noite) em tempo
// real com a partida aberta: é onde um nó TSL de pós ou de noite que só compila nesse nível falha.
// Uso: npm run build && node scripts/smoke.mjs   (a CI roda os dois em todo pull request)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';

const DIST = path.resolve('dist');
const TILES = 13; // a peça inicial + ?auto=12
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT ?? 180000);
// Ruído de rede do ambiente (fontes do Google, proxy) e avisos de driver do SwiftShader.
const IGNORE = /fonts\.g|ERR_|net::|GL Driver|vertex count of 0/;

// Servidor estático mínimo: o build é um arquivo só, mas o navegador ainda pede o favicon e afins.
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const file = path.join(DIST, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const want = (c) => (c.bench ? 61 : c.tiles ?? TILES);
const cases = [
  // ?bench: só confere que abre, monta o tabuleiro e mostra o painel (a tabela inteira leva minutos no SwiftShader).
  { name: 'bench', q: 'bench&quality=low', backend: 'webgpu', bench: true },
  { name: 'webgpu', q: 'theme=holanda&seed=3&auto=12&quality=low', backend: 'webgpu' },
  { name: 'webgl', q: 'theme=egito&seed=3&auto=12&quality=low&webgl', backend: 'webgl2' },
  // Alta e Ultra ligam sombras, GTAO, TRAA, bloom e tilt-shift: poucas peças bastam para compilar tudo.
  { name: 'webgpu-alta', q: 'theme=inverno&seed=5&auto=8&quality=high', backend: 'webgpu', tiles: 9 },
  { name: 'webgpu-ultra', q: 'theme=oriental&seed=5&auto=8&quality=ultra', backend: 'webgpu', tiles: 9 },
  // No WebGL2 (a partida custa ~25 s por caso no SwiftShader) Alta e Ultra entram pela troca ao vivo,
  // que também cobre a mudança de nível com a partida aberta. Troca: qualidade pelo menu do botão e
  // hora pelo botão de hora (ciclo dawn, aurora, day, golden, dusk, night).
  { name: 'ao-vivo-webgl', q: 'theme=holanda&seed=3&auto=6&quality=low&time=day&webgl', backend: 'webgl2', tiles: 7, live: true },
];

// Clica no botão (programaticamente: na janela estreita ele pode estar escondido) e escolhe no menu.
const pick = async (page, id) => {
  await page.evaluate(() => document.getElementById('btn-quality').click());
  await page.evaluate((q) => document.querySelector(`.menu-opt[data-id="${q}"]`)?.click(), id);
};
const cycleTime = (page) => page.evaluate(() => document.getElementById('btn-time').click());

const browser = await launch(['--ignore-gpu-blocklist']);
let failed = 0;
for (const c of cases) {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => r.status() >= 400 && r.url().startsWith(base) && errors.push(`${r.status()} ${r.url()}`));
  const t0 = Date.now();
  await page.goto(base + '?' + c.q);
  let stats = null;
  while (Date.now() - t0 < TIMEOUT && !errors.length) {
    stats = await page.evaluate(() => window.__stats ?? null);
    if (stats?.tiles >= want(c)) break;
    await page.waitForTimeout(1000);
  }
  // Mais alguns quadros: pipelines de materiais novos compilam no primeiro desenho e podem falhar depois. Os casos curtos esperam menos.
  if (stats?.tiles >= want(c) && !errors.length) await page.waitForTimeout(c.tiles ? 2500 : 5000);
  if (c.live && stats?.tiles >= want(c) && !errors.length) {
    // Baixa já está; sobe para Alta, Ultra, desce para Média, e percorre a hora até a noite.
    for (const q of ['high', 'ultra', 'medium']) {
      await pick(page, q);
      await page.waitForTimeout(2000);
    }
    // dia -> dourada -> entardecer -> noite: 3 cliques a partir do dia
    for (let i = 0; i < 3; i++) {
      await cycleTime(page);
      await page.waitForTimeout(1500);
    }
    stats = await page.evaluate(() => window.__stats ?? null);
    const lbl = (id) => page.evaluate((i) => document.getElementById(i)?.textContent?.trim(), id);
    console.log(`  ao vivo: hora final "${await lbl('btn-time')}", qualidade "${await lbl('btn-quality')}"`);
  }
  const problems = [...errors];
  if (!stats) problems.push('o jogo não desenhou nenhum quadro (window.__stats vazio)');
  else {
    if (stats.tiles < want(c)) problems.push(`tabuleiro com ${stats.tiles} peças, esperado ${want(c)}`);
    if (c.bench && !(await page.evaluate(() => !!window.__bench && !!document.querySelector('.bench table')))) problems.push('o painel do ?bench não apareceu');
    if (stats.backend !== c.backend) problems.push(`backend ${stats.backend}, esperado ${c.backend}`);
  }
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  if (problems.length) {
    failed++;
    console.log(`FALHOU ${c.name} (${s} s):\n  ${problems.slice(0, 8).map((e) => e.slice(0, 600)).join('\n  ')}`);
  } else console.log(`ok: ${c.name} em ${s} s (${stats.tiles} peças, ${stats.calls} draw calls)`);
  await page.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
