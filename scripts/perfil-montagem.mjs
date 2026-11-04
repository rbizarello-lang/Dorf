// Perfil de CPU da montagem de N peças (`?stress=N`): tempo inclusivo por função, para ver onde o modo Relevo gasta a mais.
// Uso: node scripts/perfil-montagem.mjs <urlBase> <modo> [pecas=300]   (build sem minificar: npx vite build --minify false --outDir <pasta>)
import { launch } from './browser.mjs';

const [base, mode = 'relevo', n = '300'] = process.argv.slice(2);
const browser = await launch(['--ignore-gpu-blocklist']);
const page = await browser.newPage({ viewport: { width: 400, height: 225 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 300 });
await cdp.send('Profiler.start');
await page.goto(`${base.replace(/\/?$/, '/')}?stress=${n}&quality=high&seed=42&mode=${mode}&theme=holanda${process.env.EXTRA ?? ''}`, { timeout: 180000 });
await page.waitForFunction(() => window.__load, null, { timeout: 180000 });
const load = await page.evaluate(() => window.__load);
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map((x) => [x.id, x]));
const self = new Map();
profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
const parent = new Map();
for (const x of profile.nodes) for (const c of x.children ?? []) parent.set(c, x.id);
const incl = new Map(), selfBy = new Map();
const key = (f) => `${f.functionName || '(anon)'}@${f.url.split('/').pop()}:${f.lineNumber}`;
for (const [id, t] of self) {
  selfBy.set(key(byId.get(id).callFrame), (selfBy.get(key(byId.get(id).callFrame)) ?? 0) + t);
  const seen = new Set();
  for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
    const k = key(byId.get(cur).callFrame);
    if (seen.has(k)) continue;
    seen.add(k);
    incl.set(k, (incl.get(k) ?? 0) + t);
  }
}
// Funções do jogo (não do three.js), pelo nome: o tempo inclusivo de cada uma.
const NOMES = ['autoPlace', 'placeInstant', 'buildPlaced', 'build', 'buildTile', 'bake', 'shaped', 'warpBuild', 'raster', 'add', 'lantern', 'contact', 'inverse', 'append', 'flush', 'updateFrontier', 'sync', 'waterState', 'waterNow', 'checkDef', 'bestMove', 'at', 'tick'];
const porNome = new Map();
for (const [k, t] of incl) {
  const nm = k.split('@')[0];
  const f = k.split('@')[1] ?? '';
  if (NOMES.includes(nm) && !f.startsWith('?')) continue;
  if (NOMES.includes(nm)) porNome.set(nm, Math.max(porNome.get(nm) ?? 0, t));
}
const fmt = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([a, t]) => `${(t / 1000).toFixed(0).padStart(6)} ms  ${a}`).join('\n');
console.log(`modo ${mode}: lógica ${load.logic.toFixed(0)} ms, montagem ${load.bake.toFixed(0)} ms, peças ${load.tiles}`);
console.log('--- por nome (maior ocorrência)\n' + [...porNome].sort((a, b) => b[1] - a[1]).map(([a, t]) => `${(t / 1000).toFixed(0).padStart(6)} ms  ${a}`).join('\n'));
console.log('--- inclusivo\n' + fmt(incl, 45));
console.log('--- próprio\n' + fmt(selfBy, 25));
await browser.close();
