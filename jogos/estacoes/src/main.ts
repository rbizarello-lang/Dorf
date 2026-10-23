// Cidade das Quatro Estações (esboço visual): entrada, ganchos de URL e laço de desenho.
import './style.css';
import { World } from './world';
import { Rig } from './rig';
import { createUI } from './ui';
import { SEASONS, HOURS } from './looks';

declare global {
  interface Window { __stats?: { calls: number; triangles: number }; __ready?: boolean; __world?: World }
}

const q = new URLSearchParams(location.search);
const pickIdx = (v: string | null, names: readonly string[]): number | null => {
  if (v == null) return null;
  const n = names.indexOf(v as never);
  if (n >= 0) return n;
  return /^[0-9]$/.test(v) && Number(v) < names.length ? Number(v) : null;
};
const season0 = pickIdx(q.get('season'), SEASONS) ?? 0;
const hour0 = pickIdx(q.get('hour'), HOURS) ?? 1;
const year0: 1 | 3 = q.get('year') === '3' ? 3 : 1;
const num = (k: string): number | null => { const v = q.get(k); if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

const canvas = document.getElementById('view') as HTMLCanvasElement;
const world = new World(canvas, { preserve: q.has('shot') });
const rig = new Rig(world.camera, canvas);
window.__world = world;

const yaw = num('yaw'), zoom = num('zoom'), pitch = num('pitch');
if (yaw != null) rig.yaw = (yaw * Math.PI) / 180;
if (pitch != null) rig.pitch = (pitch * Math.PI) / 180;
if (zoom != null) rig.setZoom(zoom);
if (q.has('shot') || yaw != null || q.has('still')) rig.auto = false;
const ts = num('timescale');
if (ts != null) world.timeScale = ts;

const root = document.getElementById('ui') as HTMLElement;
const ui = createUI(root, {
  season: (i) => { if (i !== world.season) { world.setSeason(i); sync(); } },
  hour: (i) => { if (i !== world.hour) { world.setHour(i); sync(); } },
  year: (y) => { if (y !== world.year) { world.setYear(y); sync(); } },
});
function sync(): void { ui.set(world.season, world.hour, world.year); }

world.onBackdrop = (a, b) => { document.documentElement.style.setProperty('--bg-in', a); document.documentElement.style.setProperty('--bg-out', b); };
world.setSeason(season0, true); world.setHour(hour0, true); world.setYear(year0, true);
sync();

// ganchos de URL de captura: sem barra de interface quando ?ui=0
if (q.get('ui') === '0') root.style.display = 'none';

function fit(): void {
  const w = innerWidth, h = innerHeight;
  const narrow = w < 760;
  // empurra a imagem para cima: o painel de instrumentos ocupa a base
  world.resize(w, h, Math.round(h * (narrow ? 0.12 : 0.095)));
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
