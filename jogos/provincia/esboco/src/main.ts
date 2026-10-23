// Entrada: monta a cena, liga os controles (semana, hora), o nome da região ao passar o cursor e os ganchos de URL.
// Ganchos: ?week=1|4 &hour=dia|entardecer|noite &yaw= &pitch= &zoom= &focus=capital|ponte|fronteira &t= (congela o relógio) &ui=0 &debug
import { Province, HOUR_NAMES, Hour } from './scene';
import { REGIONS, SHEET, Week } from './data';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number, lo: number, hi: number): number => { const v = parseFloat(q.get(k) ?? ''); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const week: Week = q.get('week') === '1' ? 1 : 4;
const hourQ = q.get('hour') ?? '';
const hour: Hour = (HOUR_NAMES as string[]).includes(hourQ) ? (hourQ as Hour) : 'dia';
const FOCI = ['capital', 'ponte', 'fronteira'] as const;
const focusQ = FOCI.find((f) => f === q.get('focus'));

const host = document.getElementById('stage')!;
const app = new Province(host);
if (q.get('ui') === '0') document.body.classList.add('ui-off');
const t = parseFloat(q.get('t') ?? '');
if (Number.isFinite(t)) app.fixedT = t;
app.setHour(hour, true);
app.setWeek(week, Number.isFinite(t));

const hasCam = q.has('yaw') || q.has('zoom') || q.has('focus') || q.has('pitch');
app.yawParam = hasCam || Number.isFinite(t);
function aimCamera(): void {
  const target = focusQ ? app.model.focus[focusQ] : undefined;
  const defZoom = focusQ === 'capital' ? 2.4 : focusQ ? 3 : 1;
  app.setCamera({ yaw: num('yaw', 0, -720, 720), pitch: num('pitch', focusQ ? 42 : 46, 8, 85), zoom: num('zoom', defZoom, 0.3, 12), target });
}
aimCamera();

// ---------- controles ----------
function moveThumb(seg: HTMLElement): void {
  const on = seg.querySelector<HTMLElement>('button[aria-pressed="true"]');
  const th = seg.querySelector<HTMLElement>('.thumb');
  if (!on || !th) return;
  th.style.width = on.offsetWidth + 'px';
  th.style.transform = `translateX(${on.offsetLeft - 3}px)`;
}
const weeksEl = document.getElementById('weeks')!, hoursEl = document.getElementById('hours')!;
function paint(): void {
  weeksEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.w) === app.week)));
  hoursEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.h === app.hourName)));
  moveThumb(weeksEl); moveThumb(hoursEl);
  const m = app.model;
  const regs = m.founded.size - 1;
  document.getElementById('readWeek')!.innerHTML = app.week === 1
    ? `Capital: <i>aldeia</i> · ${regs} regiões fundadas`
    : `Capital: <i>cidade murada</i> · ${regs} regiões fundadas`;
  const hr = { dia: 'luz do meio-dia', entardecer: 'luz baixa, janelas acendendo', noite: 'janelas e lanternas acesas' }[app.hourName];
  document.getElementById('readHour')!.textContent = hr;
  rebuildPlaques();
}
weeksEl.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (!b) return; app.setWeek(Number(b.dataset.w) as Week); paint(); });
hoursEl.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (!b) return; app.setHour(b.dataset.h as Hour); paint(); });
window.addEventListener('keydown', (e) => {
  if (e.key === '1') { app.setWeek(1); paint(); } else if (e.key === '4') { app.setWeek(4); paint(); }
  else if (e.key === 'd') { app.setHour('dia'); paint(); } else if (e.key === 'e') { app.setHour('entardecer'); paint(); } else if (e.key === 'n') { app.setHour('noite'); paint(); }
});

// ---------- nome da região ao passar o cursor ----------
const tip = document.getElementById('tip')!;
host.addEventListener('pointermove', (e) => {
  if (e.buttons) { tip.style.opacity = '0'; return; }
  const g = app.pick(e.clientX, e.clientY);
  if (!g) { tip.style.opacity = '0'; return; }
  const found = app.model.founded.has(g.id);
  tip.className = found ? '' : 'vazia';
  tip.querySelector('b')!.textContent = g.name;
  tip.querySelector('span')!.textContent = g.id === 'C' ? 'capital' : found ? 'região fundada' : 'vazia · à espera';
  tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; tip.style.opacity = '1';
});
host.addEventListener('pointerleave', () => { tip.style.opacity = '0'; });

// ---------- placas das regiões fundadas ----------
const plaques = document.getElementById('plaques')!;
let plaqueEls: Array<{ el: HTMLElement; x: number; z: number }> = [];
function rebuildPlaques(): void {
  plaques.innerHTML = ''; plaqueEls = [];
  for (const g of REGIONS) {
    if (!app.model.founded.has(g.id)) continue;
    const el = document.createElement('div');
    el.className = 'plaque' + (g.id === 'C' ? ' cap' : '');
    el.textContent = g.id === 'C' ? 'Alvorada · capital' : g.name;
    plaques.appendChild(el);
    plaqueEls.push({ el, x: g.id === 'C' ? 0 : g.x, z: g.id === 'C' ? 0 : g.z });
  }
}
function updatePlaques(): void {
  const d = app.cameraDistance();
  const show = d > 20;
  for (const p of plaqueEls) {
    const s = app.project(p.x, p.x === 0 && p.z === 0 ? (app.week >= 4 ? 4.2 : 2.1) : 2.0, p.z);
    p.el.style.opacity = show && !s.behind ? '1' : '0';
    p.el.style.left = s.x + 'px'; p.el.style.top = s.y + 'px';
  }
}

paint();
document.fonts?.ready.then(() => { moveThumb(weeksEl); moveThumb(hoursEl); });
window.addEventListener('load', () => { moveThumb(weeksEl); moveThumb(hoursEl); });
window.addEventListener('resize', () => { aimIfIdle(); moveThumb(weeksEl); moveThumb(hoursEl); });
function aimIfIdle(): void { /* a câmera do usuário é respeitada ao redimensionar */ }
void SHEET;

// ---------- laço ----------
let last = performance.now();
const dbg = document.getElementById('dbg')!;
const showDbg = q.has('debug');
function loop(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  app.frame(dt);
  updatePlaques();
  if (showDbg) { const s = app.stats(); dbg.textContent = `draw calls ${s.calls}\ntriângulos ${s.triangles}\ncasas ${s.houses}`; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- ganchos para as capturas ----------
declare global { interface Window { __ready: boolean; __stats: () => unknown; __statsMain: () => unknown; __app: Province; } }
window.__app = app;
window.__stats = () => app.stats();
window.__statsMain = () => app.statsMain();
let frames = 0;
const probe = (): void => { frames++; if (frames > 4) window.__ready = true; else requestAnimationFrame(probe); };
requestAnimationFrame(probe);
