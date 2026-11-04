// Mede o custo do modo Relevo contra o Clássico (mesma semente, Alta): tempo de GPU por passe (timestamp query),
// montagem das peças, jogada (tarefas longas e perfil de CPU da thread principal) e o início (compilação dos materiais).
// Uso: node scripts/relevo-medida.mjs <urlBase> <modo> [pecas=100] [nomeDaRodada]
// Variáveis: Q (qualidade, padrão high), W e H (viewport, padrão 960x540), EXTRA (parâmetros a mais na URL), SEG (segundos de GPU, padrão 8).
// Rode num build SEM minificar (npx vite build --minify false --outDir <pasta>) para o perfil trazer os nomes das funções.
// Em SwiftShader o tempo absoluto da GPU não vale nada: valem as razões entre modos e as fatias por passe.
import { launch } from './browser.mjs';

const [base, mode = 'relevo', pecas = '100'] = process.argv.slice(2);
const Q = process.env.Q ?? 'high';
const seg = Number(process.env.SEG ?? 8);
const browser = await launch(['--ignore-gpu-blocklist']);
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 960), height: Number(process.env.H ?? 540) } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript(() => {
  window.__fr = [];
  window.__lt = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]);
    }).observe({ entryTypes: ['longtask'] });
  } catch {}
  // Contadores das chamadas caras à API de GPU (tempo de CPU na thread principal e bytes enviados).
  window.__api = {};
  const hook = (proto, name) => {
    if (!proto || !proto[name]) return;
    const orig = proto[name];
    proto[name] = function (...a) {
      const t = performance.now();
      const r = orig.apply(this, a);
      const o = (window.__api[name] ??= { n: 0, ms: 0, mb: 0, max: 0 });
      const d = performance.now() - t;
      o.n++;
      o.ms += d;
      o.max = Math.max(o.max, d);
      const data = name === 'writeTexture' || name === 'writeBuffer' ? a[name === 'writeBuffer' ? 2 : 1] : null;
      if (data && data.byteLength) o.mb += data.byteLength / 1048576;
      return r;
    };
  };
  for (const n of ['writeTexture', 'writeBuffer']) hook(window.GPUQueue?.prototype, n);
  for (const n of ['createRenderPipeline', 'createComputePipeline', 'createShaderModule', 'createTexture', 'createBindGroup']) hook(window.GPUDevice?.prototype, n);
  let prev = performance.now();
  const loop = (now) => {
    window.__fr.push([Math.round(now), Math.round((now - prev) * 10) / 10]);
    prev = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
const cdp = await page.context().newCDPSession(page);
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
const p95 = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * 0.95))] : 0);
const r1 = (v) => Math.round(v * 10) / 10;

// 1. Início: da navegação ao primeiro quadro desenhado e os quadros lentos até assentar (compilação dos materiais).
const url = `${base.replace(/\/?$/, '/')}?mode=${mode}&theme=holanda&seed=42&quality=${Q}&auto=${pecas}&gpu&economia=0&timescale=4${process.env.EXTRA ?? ''}`;
const t0 = Date.now();
await page.goto(url, { timeout: 180000 });
await page.waitForFunction(() => window.__stats && window.__stats.steps > 0, null, { timeout: 180000 });
const tFirst = Date.now() - t0;
await page.waitForTimeout(12000);
const start = await page.evaluate(() => {
  const fr = window.__fr;
  const api = JSON.parse(JSON.stringify(window.__api));
  return { api, frames: fr.length, slow: fr.filter((f) => f[1] > 250).map((f) => f[1]), lt: window.__lt.filter((l) => l[1] >= 200).map((l) => l[1]), load: window.__load ?? null };
});

// 2. GPU por passe, parado (o ?gpu acumula desde a última chamada).
await page.evaluate(() => window.__gpu());
await page.waitForTimeout(seg * 1000);
const gpu = await page.evaluate(() => window.__gpu());
const passes = gpu.passes.map((p) => ({ label: p.label, ms: r1(med(p.ms)), n: p.ms.length })).sort((a, b) => b.ms - a.ms);
const frameMed = r1(med(gpu.frames));
const frameP95 = r1(p95(gpu.frames));

// 3. Jogadas: perfil de CPU (inclusive por função) e tarefas longas. A 1ª é a primeira depois do carregamento (shaders da queda).
const NAMES = ['bake', 'raster', 'add', 'buildPlaced', 'build', 'buildTile', 'warpBuild', 'shaped', 'placeAnimated', 'flush', 'tick', 'render', 'LiveTile', 'append', 'setPieceRelief', 'updateFrontier', 'syncWonder', 'sync', 'check', 'place', 'refreshHud', 'onLanded', 'placeFx', 'waterNow', 'waterState', 'rankMoves', 'bestMove', 'inverse', 'seaMap'];
const jogadas = [];
const resume = (profile, nomes) => {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const incl = new Map();
  for (const [id, t] of self) {
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
      const nm = byId.get(cur).callFrame.functionName || '(anon)';
      if (seen.has(nm)) continue;
      seen.add(nm);
      incl.set(nm, (incl.get(nm) ?? 0) + t);
    }
  }
  return nomes.filter((n) => incl.has(n)).map((n) => `${n} ${r1(incl.get(n) / 1000)}`);
};
// Passeio do mouse sobre a fronteira: o fantasma troca de casa (no fluido, cada casa é uma peça nova).
const hover = [];
if (process.env.HOVER !== '0' && !process.env.ONLY_GPU) {
  const cells = (await page.evaluate(() => window.__cells())).filter((c) => c.x > 20 && c.x < 380 && c.y > 20 && c.y < 205).slice(0, 5);
  for (const c of cells) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
    await page.evaluate(() => { window.__fr.length = 0; });
    await page.mouse.move(c.x, c.y, { steps: 2 });
    await page.waitForTimeout(Number(process.env.HOVER_MS ?? 6000));
    const { profile } = await cdp.send('Profiler.stop');
    const fr = await page.evaluate(() => window.__fr.map((f) => f[1]));
    hover.push({ q: c.q, r: c.r, maxFrame: Math.max(0, ...fr), named: resume(profile, ['setGhost', 'updateGhost', 'build', 'buildTile', 'LiveTile', 'shaped', 'warpBuild', 'dispose', 'check', 'waterState', 'tick', 'render']) });
  }
}
for (let k = 0; k < (process.env.ONLY_GPU ? 0 : 3); k++) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await page.evaluate(() => {
    window.__fr.length = 0;
    window.__lt.length = 0;
    window.__api0 = JSON.parse(JSON.stringify(window.__api));
    window.__t0 = performance.now();
    window.__placeBest();
  });
  await page.waitForTimeout(4500);
  const { profile } = await cdp.send('Profiler.stop');
  const r = await page.evaluate(() => {
    const d = {};
    for (const [k, v] of Object.entries(window.__api)) {
      const a = window.__api0[k] ?? { n: 0, ms: 0, mb: 0 };
      if (v.n > a.n) d[k] = { n: v.n - a.n, ms: Math.round((v.ms - a.ms) * 10) / 10, mb: Math.round((v.mb - a.mb) * 10) / 10, max: Math.round(v.max * 10) / 10 };
    }
    return { fr: window.__fr.map((f) => f[1]), lt: window.__lt.map((l) => l[1]), api: d };
  });
  // Inclusivo por nome de função.
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const incl = new Map();
  for (const [id, t] of self) {
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
      const nm = byId.get(cur).callFrame.functionName || '(anon)';
      if (seen.has(nm)) continue;
      seen.add(nm);
      incl.set(nm, (incl.get(nm) ?? 0) + t);
    }
  }
  const selfBy = new Map();
  for (const [id, t] of self) {
    const f = byId.get(id).callFrame;
    const nm = `${f.functionName || '(anon)'}`;
    selfBy.set(nm, (selfBy.get(nm) ?? 0) + t);
  }
  const top = [...selfBy].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, t]) => `${n} ${r1(t / 1000)}`);
  const named = NAMES.filter((n) => incl.has(n)).map((n) => `${n} ${r1(incl.get(n) / 1000)}`);
  const lt = r.lt.filter((d) => d >= 50);
  jogadas.push({ n: k + 1, maxFrame: Math.max(0, ...r.fr), frames50: r.fr.filter((d) => d > 50).length, longTasks: lt, longTotal: lt.reduce((a, b) => a + b, 0), api: r.api, named, topSelf: top });
  await page.waitForTimeout(1500);
}

const stats = await page.evaluate(() => window.__stats);
const real = errors.filter((e) => !/fonts\.g|ERR_|net::|404|vertex count of 0|GL Driver/.test(e));
console.log(JSON.stringify({ hover, mode, pecas, Q, tFirstMs: tFirst, start, gpuFrameMs: { med: frameMed, p95: frameP95, n: gpu.frames.length }, passes, calls: stats.calls, triangles: stats.triangles, jogadas, erros: real.slice(0, 5) }, null, 1));
await browser.close();
