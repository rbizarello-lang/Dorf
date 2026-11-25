// Teste de cena (E8): a cena montada jogada a jogada (peça que cai, vizinhas refeitas no lugar, fila da Paisagem viva) precisa ser igual
// à reconstrução integral, peça por peça: decorações (kit, posição, escala, cor), chão, emissores de fumaça (chaminés), corredeira
// (lâmina, espuma e origens da névoa), malha de água (posição e profundidade) e instâncias órfãs. Depois confere a recarga (replay) e o desfazer.
// Roda no navegador, em WebGL2 por software (o WebGPU por software perde o dispositivo nesta máquina; a CI roda os dois nos outros casos).
// Uso: npm run build && node scripts/scene-sync.mjs [filtro]      (SCENE_TIMEOUT em ms; o filtro roda só os casos com esse trecho no nome)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';

const DIST = path.resolve('dist');
const TIMEOUT = Number(process.env.SCENE_TIMEOUT ?? 240000);
const IGNORE = /fonts\.g|ERR_|net::|GL Driver|vertex count of 0/;
const filter = process.argv[2] ?? '';

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const file = path.join(DIST, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return void res.writeHead(404).end();
  res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

// Casos. `moves`: jogadas fixas [q, r, giro]; `fuzz`: n jogadas sorteadas (PRNG com `rng`); `fast`: as jogadas saem uma atrás da outra,
// sem deixar a anterior assentar (todas caem juntas); senão cada uma assenta antes da próxima. `undo`: desfaz a última e a joga de novo.
const cases = [
  // Defeito 1 (issue #115): semente 1, primeira jogada em (1,0) com giro 2 (duas chaminés viram uma).
  { name: 'fumaca-s1', q: 'theme=holanda&seed=1&mode=classico&viva=0', moves: [[1, 0, 2]] },
  { name: 'fumaca-s1-viva', q: 'theme=holanda&seed=1&mode=classico&viva=1', moves: [[1, 0, 2]] },
  // Defeito 2: semente 3, Viva ligada, (1,0) e (2,0) com giro 3, a segunda antes de a primeira assentar.
  { name: 'rapida-s3-viva', q: 'theme=holanda&seed=3&mode=classico&viva=1', moves: [[1, 0, 3], [2, 0, 3]], fast: true },
  { name: 'rapida-s3-sem-viva', q: 'theme=holanda&seed=3&mode=classico&viva=0', moves: [[1, 0, 3], [2, 0, 3]], fast: true },
  // Sequências sorteadas: quantidade que muda, tipos e ordem que mudam, com a Viva ligada e desligada, no Clássico e no Terra.
  { name: 'sorteio-classico-viva', q: 'theme=holanda&seed=11&mode=classico&viva=1', fuzz: 22, rng: 11 },
  { name: 'sorteio-classico-sem-viva', q: 'theme=oriental&seed=12&mode=classico&viva=0', fuzz: 22, rng: 12 },
  { name: 'rapido-classico-viva', q: 'theme=brasil&seed=13&mode=classico&viva=1', fuzz: 14, rng: 13, fast: true },
  { name: 'rapido-classico-sem-viva', q: 'theme=egito&seed=14&mode=classico&viva=0', fuzz: 14, rng: 14, fast: true },
  { name: 'terra-viva', q: 'theme=holanda&seed=21&mode=terra&viva=1', fuzz: 22, rng: 21 },
  { name: 'terra-sem-viva', q: 'theme=inverno&seed=22&mode=terra&viva=0', fuzz: 22, rng: 22 },
  { name: 'terra-rapido-viva', q: 'theme=holanda&seed=23&mode=terra&viva=1', fuzz: 14, rng: 23, fast: true },
  { name: 'terra-rapido-sem-viva', q: 'theme=oriental&seed=24&mode=terra&viva=0', fuzz: 14, rng: 24, fast: true },
  // Defeito 3: corredeira (Holanda, semente 123) no Relevo e na Terra, em lotes rápidos e lentos, preferindo peças com água.
  { name: 'corredeira-terra', q: 'theme=holanda&seed=123&mode=terra&viva=0', fuzz: 26, rng: 123, water: true },
  { name: 'corredeira-relevo', q: 'theme=holanda&seed=123&mode=relevo&viva=0', fuzz: 26, rng: 124, water: true },
  { name: 'corredeira-relevo-rapido', q: 'theme=holanda&seed=123&mode=relevo&viva=1', fuzz: 14, rng: 125, water: true, fast: true, wetRequired: true },
  // Desfazer e recarga a partir de uma sequência rápida.
  { name: 'desfazer-rapido', q: 'theme=holanda&seed=31&mode=classico&viva=1', fuzz: 10, rng: 31, fast: true, undo: true },
].filter((c) => c.name.includes(filter));

const browser = await launch(['--ignore-gpu-blocklist']);
let failed = 0;

const diffPieces = (a, b, checkWater) => {
  const out = [];
  const keys = new Set([...Object.keys(a.pieces), ...Object.keys(b.pieces)]);
  for (const k of [...keys].sort()) {
    const x = a.pieces[k], y = b.pieces[k];
    if (!x || !y) {
      out.push(`${k}: peça só ${x ? 'na cena incremental' : 'na reconstrução'}`);
      continue;
    }
    if (x.decos.length !== y.decos.length) out.push(`${k}: ${x.decos.length} decorações contra ${y.decos.length}`);
    else if (JSON.stringify(x.decos) !== JSON.stringify(y.decos)) {
      const d = x.decos.filter((v, i) => v !== y.decos[i]);
      out.push(`${k}: decorações com posição, tipo ou cor diferente (${d.length}), ex.: ${d[0]} contra ${y.decos[x.decos.indexOf(d[0])]}`);
    }
    if (x.ground !== y.ground) out.push(`${k}: chão ${x.ground} contra ${y.ground}`);
    if (checkWater && x.water !== y.water) out.push(`${k}: água ${x.water} contra ${y.water}`);
    if (JSON.stringify(x.smoke) !== JSON.stringify(y.smoke)) out.push(`${k}: ${x.smoke.length} emissores de fumaça contra ${y.smoke.length}`);
    if (JSON.stringify(x.falls) !== JSON.stringify(y.falls)) out.push(`${k}: corredeira ${JSON.stringify(x.falls)} contra ${JSON.stringify(y.falls)}`);
  }
  return out;
};
const diffTotals = (a, b) => {
  const out = [];
  for (const f of ['orphans', 'smokeTotal', 'mistTotal']) if (a[f] !== b[f]) out.push(`${f}: ${a[f]} contra ${b[f]}`);
  if (JSON.stringify(a.life) !== JSON.stringify(b.life)) out.push(`vida: ${JSON.stringify(a.life)} contra ${JSON.stringify(b.life)}`);
  return out;
};

for (const c of cases) {
  const page = await browser.newPage({ viewport: { width: 480, height: 300 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const t0 = Date.now();
  // A malha da água é comparada com a Paisagem viva ligada e desligada (D52).
  const checkWater = true;
  const problems = [];
  let note = '';
  try {
    await page.goto(`${base}?${c.q}&quality=medium&webgl`);
    await page.waitForFunction(() => typeof window.__sceneSig === 'function' && window.__stats, null, { timeout: TIMEOUT });
    const settle = async () => {
      // Faz as quedas assentarem e espera esvaziar as filas de Encostas e Paisagem viva.
      for (let i = 0; i < 400; i++) {
        await page.evaluate(() => window.__land());
        const p = await page.evaluate(() => window.__pending());
        if (!p.drops && !p.queue) return;
        await page.waitForTimeout(60);
      }
      problems.push('as peças não terminaram de assentar');
    };
    // Sorteio determinístico (mulberry32).
    let st = (c.rng ?? 1) >>> 0;
    const rnd = () => {
      st = (st + 0x6d2b79f5) >>> 0;
      let t = st;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const play = (m) => page.evaluate(([q, r, rot]) => window.__playMove(q, r, rot), m);
    const played = [];
    let wetTouches = 0;
    if (c.moves) {
      for (const m of c.moves) {
        if (!(await play(m))) problems.push(`a jogada ${m} não foi aceita`);
        else played.push(m);
        if (!c.fast) await settle();
      }
    } else {
      for (let i = 0; i < c.fuzz; i++) {
        // Com `water`, prefere uma jogada que encoste água em água (onde a corredeira pode nascer).
        const all = await page.evaluate(() => window.__legalMoves().map((x) => [...x, window.__waterTouch(...x)]));
        const wet = c.water ? all.filter((x) => x[3] > 0) : [];
        const list = wet.length && rnd() < 0.85 ? wet : all;
        if (!list.length) break;
        const m = list[Math.floor(rnd() * list.length)];
        if (!(await play(m.slice(0, 3)))) break;
        played.push(m.slice(0, 3));
        if (m[3] > 0) wetTouches++;
        if (!c.fast) await settle();
      }
    }
    await settle();
    const inc = await page.evaluate(() => window.__sceneSig());
    await page.evaluate(() => window.__rebuildScene());
    await settle();
    const full = await page.evaluate(() => window.__sceneSig());
    for (const [phase, scene] of [['incremental', inc], ['reconstrução', full]]) {
      if (Object.keys(scene.pieces).length !== scene.settled) problems.push(`${phase}: a assinatura não tem uma chave por peça assentada`);
    }
    for (const d of [...diffPieces(inc, full, checkWater), ...diffTotals(inc, full)]) problems.push(`incremental x integral: ${d}`);
    if (inc.orphans || full.orphans) problems.push(`instâncias órfãs: ${inc.orphans} / ${full.orphans}`);
    const wetPieces = Object.values(full.pieces).filter((p) => p.water && !p.water.startsWith('0:')).length;
    if (c.wetRequired && (!wetTouches || wetPieces < 2)) problems.push('o caso dirigido deixou de exercitar um encaixe de água');
    const foam = Object.values(full.pieces).filter((p) => p.falls && p.falls.foam > 0).length;
    note = `${played.length} jogadas, ${Object.keys(full.pieces).length} peças, ${full.smokeTotal} chaminés, ${full.mistTotal} névoas, ${foam} com corredeira, ${wetPieces} com água, ${wetTouches} jogadas com encaixe de água`;
    // Recarga: o replay do save reconstrói a mesma cena.
    await page.evaluate(() => window.__replayScene());
    await settle();
    const rep = await page.evaluate(() => window.__sceneSig());
    if (Object.keys(rep.pieces).length !== rep.settled) problems.push('recarga: a assinatura não tem uma chave por peça assentada');
    for (const d of [...diffPieces(rep, full, checkWater), ...diffTotals(rep, full)]) problems.push(`recarga x integral: ${d}`);
    if (c.undo && played.length) {
      // Desfazer e jogar de novo a última: o resultado é o mesmo (a peça da vez volta a ser a mesma).
      await page.evaluate(() => window.__undoMove());
      await settle();
      if (!(await play(played[played.length - 1]))) problems.push('a última jogada não pôde ser refeita depois do desfazer');
      await settle();
      const redo = await page.evaluate(() => window.__sceneSig());
      if (Object.keys(redo.pieces).length !== redo.settled) problems.push('desfazer e refazer: a assinatura não tem uma chave por peça assentada');
      for (const d of [...diffPieces(redo, full, checkWater), ...diffTotals(redo, full)]) problems.push(`desfazer e refazer x integral: ${d}`);
    }
  } catch (e) {
    problems.push(`erro no teste: ${String(e).slice(0, 300)}`);
  }
  problems.push(...errors);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (problems.length) {
    failed++;
    console.error(`FALHOU ${c.name} (${secs}s) ${note}`);
    for (const p of problems.slice(0, 14)) console.error('  ' + p);
    if (problems.length > 14) console.error(`  ... e mais ${problems.length - 14}`);
  } else console.log(`ok ${c.name} (${secs}s): ${note}`);
  await page.close();
}
await browser.close();
server.close();
if (failed) {
  console.error(`${failed} caso(s) da cena com diferença`);
  process.exit(1);
}
console.log('cena incremental = reconstrução integral em todos os casos');
