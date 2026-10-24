// Expedições (esboço visual): entrada, ganchos de URL e laço de desenho.
// ?view=mapa|brejo|serra|costa|capital|chegada &week=1|4 &hour=dia|entardecer|noite &yaw= &zoom= &pitch= &ui=0
import './style.css';
import { World, RIGS } from './world';
import { Rig } from './rig';
import { createUI } from './ui';
import { HOURS, VIEWS, type ViewId } from './looks';

declare global {
  interface Window { __stats?: { calls: number; triangles: number }; __ready?: boolean; __world?: World }
}

const q = new URLSearchParams(location.search);
const num = (k: string): number | null => { const v = q.get(k); if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const view0: ViewId = (VIEWS as readonly string[]).includes(q.get('view') ?? '') ? (q.get('view') as ViewId) : 'mapa';
const hourQ = q.get('hour');
const hour0 = hourQ && (HOURS as readonly string[]).includes(hourQ) ? (HOURS as readonly string[]).indexOf(hourQ) : 0;
const week0 = q.get('week') === '1' ? 1 : 4;

const canvas = document.getElementById('view') as HTMLCanvasElement;
const world = new World(canvas, { preserve: q.has('shot') });
const rig = new Rig(world.camera, canvas);
window.__world = world;
const root = document.getElementById('ui') as HTMLElement;
const veil = document.getElementById('veil') as HTMLElement;
const yaw = num('yaw'), zoom = num('zoom'), pitch = num('pitch');
const ts = num('timescale');
if (ts != null) world.timeScale = ts;

const ui = createUI(root, {
  view: (id) => go(id),
  hour: (i) => { if (i !== world.hour) { world.setHour(i); sync(); } },
  week: (w) => { if (w !== world.week) { world.setWeek(w); sync(); } },
});
function sync(): void { ui.set(world.view, world.hour, world.week); }
world.onBackdrop = (a, b) => { document.documentElement.style.setProperty('--bg-in', a); document.documentElement.style.setProperty('--bg-out', b); };

function frame(id: ViewId, first: boolean): void {
  rig.goto(RIGS[id], { zoom: first ? zoom : null, yaw: first ? yaw : null, pitch: first ? pitch : null, instant: first });
  if (first && (yaw != null || q.has('shot') || q.has('still'))) rig.auto = false;
}
let busyGo = false;
function go(id: ViewId): void {
  if (id === world.view || busyGo) return;
  busyGo = true;
  veil.classList.add('on');
  setTimeout(() => { world.setView(id); frame(id, false); sync(); veil.classList.remove('on'); busyGo = false; }, 400);
}

world.setHour(hour0, true);
world.setWeek(week0, true);
world.setView(view0);
frame(view0, true);
sync();
if (q.get('ui') === '0') root.style.display = 'none';

function fit(): void {
  const w = innerWidth, h = innerHeight;
  world.resize(w, h, Math.round(h * (w < 760 ? 0.11 : 0.1)));
}
addEventListener('resize', fit);
fit();

let last = performance.now(), frames = 0;
function loop(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  rig.update(dt);
  world.update(dt);
  world.render();
  window.__stats = world.stats;
  frames++;
  if (frames >= 3 && !world.busy) window.__ready = true;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
