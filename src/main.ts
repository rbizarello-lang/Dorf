import * as THREE from 'three';
import { Sfx } from './audio';
import { DEFAULT_RULES, type PlaceResult, type Rules } from './core/board';
import { Game } from './core/game';
import { hexToWorld, hkey, worldToHex } from './core/hex';
import type { Quality } from './render/world';
import { World } from './render/world';
import { themeById, type Theme } from './themes/themes';
import { Hud, questLabel } from './ui/hud';
import './ui/style.css';

// ------------------------------------------------------------------ estado

type QualityMode = 'auto' | Quality;
interface Save {
  v: 1;
  seed: number;
  rulesId: string;
  moves: [number, number, number][];
}
interface Hot {
  snapshot?: (fn: () => unknown) => void;
  ready?: (fn: (data: unknown) => void) => void;
  data?: unknown;
}

const params = new URLSearchParams(location.search);
const store = {
  get(k: string) {
    try {
      return localStorage.getItem(`retalhos.${k}`);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v === null) localStorage.removeItem(`retalhos.${k}`);
      else localStorage.setItem(`retalhos.${k}`, v);
    } catch {
      /* armazenamento indisponível: segue sem salvar */
    }
  },
};

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const hud = new Hud();
const sfx = new Sfx();
const world = new World(canvas);

let theme: Theme = themeById(params.get('theme') ?? store.get('theme'));
let rulesTheme: Theme = theme;
let game: Game;
let moves: [number, number, number][] = [];
let rotSteps = 0;
let hover: { q: number; r: number } | null = null;
let best = Number(store.get('best')) || 0;
let qualityMode: QualityMode = (params.get('quality') as QualityMode) || (store.get('quality') as QualityMode) || 'auto';
let gameOverShown = false;
const special = params.has('stress') || params.has('auto') || params.has('demo');

const rulesFor = (t: Theme): Rules => ({ ...DEFAULT_RULES, ...t.rules });

// ------------------------------------------------------------------ partida

function newGame(seed = Math.floor(Math.random() * 1e9), replay: [number, number, number][] = []) {
  game = new Game(seed, rulesFor(rulesTheme));
  moves = [];
  for (const [q, r, rot] of replay) {
    game.rot = rot;
    if (!game.place(q, r)) break;
    moves.push([q, r, rot]);
    while (game.discardIfStuck());
  }
  rotSteps = 0;
  hover = null;
  gameOverShown = false;
  world.dropGhost();
  world.setTheme(theme, game.board);
  hud.applyTheme(theme);
  hud.renderQuests(game.board.quests, theme);
  frameCamera(true);
  refreshHud(true);
  persist();
}

function persist() {
  if (special) return;
  if (game.over) store.set('save', null);
  else store.set('save', JSON.stringify({ v: 1, seed: game.seed, rulesId: rulesTheme.id, moves } satisfies Save));
}

function frameCamera(instant: boolean) {
  const b = game.board;
  let cx = 0, cz = 0, maxR = 2;
  for (const p of b.list) {
    const { x, z } = hexToWorld(p.q, p.r);
    cx += x;
    cz += z;
  }
  cx /= b.list.length;
  cz /= b.list.length;
  for (const p of b.list) {
    const { x, z } = hexToWorld(p.q, p.r);
    maxR = Math.max(maxR, Math.hypot(x - cx, z - cz));
  }
  world.rig.goal.set(cx, 0, cz);
  // Em retrato (celular) a largura é o limite: afasta a câmera proporcionalmente.
  const aspect = Math.min(1.4, Math.max(0.45, window.innerWidth / Math.max(1, window.innerHeight)));
  world.rig.goalDist = THREE.MathUtils.clamp((maxR * 2.1 + 5) * Math.max(1, 1.25 / aspect), 7, 46);
  if (instant) {
    world.rig.target.copy(world.rig.goal);
    world.rig.dist = world.rig.goalDist;
  }
}

function refreshHud(instant = false) {
  hud.setScore(game.board.score, Math.max(best, game.board.score), instant);
  hud.setStack(game.stack);
  hud.renderNext(game.over ? null : game.next, theme);
  world.setPreview(game.current, rotSteps * (Math.PI / 3), game.stack);
  updateGhost();
}

function updateGhost() {
  if (!game.current || !hover || !game.board.frontier.has(hkey(hover.q, hover.r)) || hud.modalOpen) {
    world.clearGhost();
    hud.confirm.hidden = true;
    return;
  }
  const check = game.check(hover.q, hover.r)!;
  world.setGhost(game.current, rotSteps * (Math.PI / 3), hover.q, hover.r, check);
}

function rotate(dir: 1 | -1) {
  if (!game.current) return;
  game.rotate(dir);
  rotSteps += dir;
  sfx.rotate();
  world.setPreview(game.current, rotSteps * (Math.PI / 3), game.stack);
  updateGhost();
}

function screenOf(q: number, r: number, y = 0.4) {
  const { x, z } = hexToWorld(q, r);
  return world.project(x, y, z);
}

function place(q: number, r: number) {
  if (!game.current || hud.modalOpen) return;
  const check = game.check(q, r);
  if (!check?.valid) {
    if (check && !check.occupied && check.neighbors > 0) {
      sfx.invalid();
      hud.toast('Rio só encosta em rio, e trilho só em trilho.', 'bad');
    }
    return;
  }
  const rot = game.rot;
  const res = game.place(q, r)!;
  moves.push([q, r, rot]);
  world.placeAnimated(res.placed);
  world.updateFrontier(game.board);
  rotSteps = 0;
  hud.confirm.hidden = true;
  announce(res);
  let discarded = 0;
  while (game.discardIfStuck()) discarded++;
  if (discarded) hud.toast(discarded === 1 ? 'Uma peça não cabia em lugar nenhum e foi descartada.' : `${discarded} peças sem encaixe foram descartadas.`, 'bad');
  if (game.board.score > best) {
    best = game.board.score;
    if (!special) store.set('best', String(best));
  }
  if (moves.length === 6) hud.hint.style.opacity = '0';
  refreshHud();
  persist();
  if (game.over && !gameOverShown) {
    gameOverShown = true;
    setTimeout(showGameOver, 1100);
  }
}

function announce(res: PlaceResult) {
  const s = screenOf(res.placed.q, res.placed.r);
  sfx.place(res.matches);
  if (res.points > 0) hud.floater(s.x, s.y - 10, `+${res.points}`, res.perfect ? 'big' : '');
  const { x, z } = hexToWorld(res.placed.q, res.placed.r);
  if (res.perfect) {
    sfx.perfect();
    world.burst(x, z, 'sparkle', 26);
    hud.floater(s.x, s.y - 46, 'Perfeito!', 'big');
  }
  for (const t of res.closed) {
    const p = screenOf(t.q, t.r);
    hud.floater(p.x, p.y - 20, '+1 peça', 'tiles');
    const w = hexToWorld(t.q, t.r);
    world.burst(w.x, w.z, 'sparkle', 16);
  }
  for (const q of res.questsDone) {
    sfx.quest();
    hud.toast(`Missão cumprida: ${questLabel(q, theme)} · +${q.reward} peças`, 'good');
    const w = hexToWorld(q.anchor.q, q.anchor.r);
    world.burst(w.x, w.z, 'sparkle', 40);
  }
  for (const q of res.questsFailed) {
    sfx.fail();
    hud.toast(`Missão perdida: ${questLabel(q, theme)} (passou de ${q.target})`, 'bad');
  }
  if (res.newQuest) hud.toast(`Nova missão: ${questLabel(res.newQuest, theme)}`);
  hud.renderQuests(game.board.quests, theme);
}

// ------------------------------------------------------------------ telas

function showHelp() {
  const legend = theme.terrainNames.map((n, i) => `<span><i style="background:${theme.terrainColors[i]}"></i>${n}</span>`).join('');
  hud.showModal(`
    <h2 id="modal-title">Retalhos</h2>
    <p>Monte uma paisagem peça por peça. Cada borda que combina com a vizinha vale ${game.rules.matchPoints} pontos.</p>
    <div class="legend">${legend}</div>
    <ul>
      <li><b>${theme.terrainNames[4]}</b> e <b>${theme.terrainNames[5]}</b> precisam continuar: só encostam neles mesmos.</li>
      <li><b>Encaixe perfeito</b>: todas as bordas vizinhas combinam (+${game.rules.perfectBonus}).</li>
      <li>Cercar uma peça com 6 vizinhas encaixadas rende <b>+1 peça</b>.</li>
      <li><b>Missões</b> pedem grupos de certo tamanho e dão peças extras. "Exatamente N" falha se passar.</li>
      <li>A partida acaba quando a pilha esvazia.</li>
    </ul>
    <p class="muted">Mouse: clique coloca, botão direito ou <kbd>R</kbd> gira a peça, arrastar move, roda dá zoom, <kbd>Q</kbd>/<kbd>E</kbd> giram a câmera. Toque: toque num espaço para ver a peça, toque de novo (ou ✓) para colocar.</p>
    <div class="row"><button class="primary" type="button" data-act="close">Jogar</button></div>`);
}

function showGameOver() {
  const b = game.board;
  const record = b.score >= best && b.score > 0;
  hud.showModal(`
    <h2 id="modal-title">${record ? 'Novo recorde!' : 'Pilha vazia'}</h2>
    <p class="muted">${theme.name} · semente ${game.seed}</p>
    <div class="final">
      <div><b>${b.score.toLocaleString('pt-BR')}</b><span>pontos</span></div>
      <div><b>${game.placedCount}</b><span>peças</span></div>
      <div><b>${b.questsCompleted}</b><span>missões</span></div>
    </div>
    <p class="muted">${b.perfects} encaixes perfeitos. Recorde: ${best.toLocaleString('pt-BR')}.</p>
    <div class="row">
      <button class="primary" type="button" data-act="new">Jogar de novo</button>
      <button class="secondary" type="button" data-act="theme">Trocar tema</button>
    </div>`);
}

hud.modal.addEventListener('click', (e) => {
  const act = (e.target as HTMLElement).closest('button')?.dataset.act;
  if (e.target === hud.modal || act === 'close') {
    hud.hideModal();
    store.set('seenHelp', '1');
  } else if (act === 'new') {
    hud.hideModal();
    rulesTheme = theme;
    newGame();
  } else if (act === 'theme') {
    hud.hideModal();
    hud.openThemeMenu(theme, pickTheme);
  }
});

function pickTheme(t: Theme) {
  theme = t;
  store.set('theme', t.id);
  hud.applyTheme(t);
  world.setTheme(t, game.board);
  hud.renderQuests(game.board.quests, t);
  refreshHud(true);
  if (game.over) {
    rulesTheme = t;
    newGame();
  } else if (JSON.stringify(rulesFor(t)) !== JSON.stringify(game.rules)) {
    hud.toast(`${t.ruleNote ?? 'Regras padrão.'} Vale a partir da próxima partida.`);
  }
}

// ------------------------------------------------------------------ qualidade

const qualityLabel: Record<QualityMode, string> = { auto: 'Auto', high: 'Alta', medium: 'Média', low: 'Baixa' };
const qualityBtn = document.getElementById('btn-quality')!;

function applyQuality(mode: QualityMode) {
  qualityMode = mode;
  world.setQuality(mode === 'auto' ? 'high' : mode);
  qualityBtn.textContent = qualityLabel[mode];
  frameTimes.length = 0;
}

const frameTimes: number[] = [];
let autoLevel: Quality = 'high';
function adaptQuality(dt: number) {
  if (qualityMode !== 'auto' || document.hidden) return;
  frameTimes.push(dt);
  if (frameTimes.length < 150) return;
  frameTimes.sort((a, b) => a - b);
  const median = frameTimes[75];
  frameTimes.length = 0;
  if (median > 1 / 38 && autoLevel !== 'low') {
    autoLevel = autoLevel === 'high' ? 'medium' : 'low';
    world.setQuality(autoLevel);
    hud.toast(`Qualidade ajustada para ${qualityLabel[autoLevel]} para manter a fluidez.`);
  }
}

// ------------------------------------------------------------------ entrada

const pointers = new Map<number, { x: number; y: number }>();
let drag: { button: number; x: number; y: number; moved: boolean; ground: THREE.Vector3 | null; touch: boolean } | null = null;
let pinch: { d: number; mx: number; my: number } | null = null;

function hoverAt(clientX: number, clientY: number) {
  const p = world.groundPoint(clientX, clientY);
  if (!p) return null;
  const [q, r] = worldToHex(p.x, p.z);
  return { q, r };
}

function setHover(h: { q: number; r: number } | null) {
  const same = h && hover && h.q === hover.q && h.r === hover.r;
  hover = h;
  if (!same) updateGhost();
}

canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  hud.closeThemeMenu();
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    drag = null;
    return;
  }
  drag = { button: e.button, x: e.clientX, y: e.clientY, moved: false, ground: world.groundPoint(e.clientX, e.clientY), touch: e.pointerType !== 'mouse' };
});

canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    world.rig.zoom(pinch.d / Math.max(d, 1));
    const before = world.groundPoint(pinch.mx, pinch.my);
    const after = world.groundPoint(mx, my);
    if (before && after) world.rig.panWorld(before.x - after.x, before.z - after.z, true);
    pinch = { d, mx, my };
    return;
  }
  if (drag) {
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > (drag.touch ? 10 : 5)) drag.moved = true;
    if (drag.moved) {
      if (drag.button === 2 || (drag.button === 0 && e.shiftKey)) {
        world.rig.rotate(-(e.movementX || 0) * 0.006);
      } else if (drag.ground) {
        const now = world.groundPoint(e.clientX, e.clientY);
        if (now) {
          world.rig.panWorld(drag.ground.x - now.x, drag.ground.z - now.z, true);
          world.rig.apply(world.camera);
          world.camera.updateMatrixWorld();
        }
      }
      canvas.style.cursor = 'grabbing';
      return;
    }
  }
  if (e.pointerType === 'mouse') setHover(hoverAt(e.clientX, e.clientY));
});

function endPointer(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  canvas.style.cursor = '';
  const d = drag;
  drag = null;
  if (!d || d.moved || e.type === 'pointercancel') return;
  if (d.button === 2) {
    rotate(1);
    return;
  }
  const h = hoverAt(e.clientX, e.clientY);
  if (!h) return;
  if (d.touch) {
    // Toque: primeiro mostra a peça no espaço, o segundo toque confirma.
    if (hover && hover.q === h.q && hover.r === h.r && game.board.frontier.has(hkey(h.q, h.r))) place(h.q, h.r);
    else {
      setHover(h);
      hud.confirm.hidden = !(game.current && game.board.frontier.has(hkey(h.q, h.r)));
    }
    return;
  }
  setHover(h);
  place(h.q, h.r);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse' && !drag) setHover(null);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    world.rig.zoom(Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
  },
  { passive: false },
);

const held = new Set<string>();
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    hud.hideModal();
    hud.closeThemeMenu();
    return;
  }
  if (hud.modalOpen) return;
  sfx.unlock();
  if (k === 'r' || k === ' ') {
    e.preventDefault();
    rotate(e.shiftKey ? -1 : 1);
  } else if (k === 't') rotate(-1);
  else if (k === 'f') hud.stats.hidden = !hud.stats.hidden;
  else if (k === 'h' || k === '?') showHelp();
  else if (k === 'n') {
    rulesTheme = theme;
    newGame();
  } else if (k === '+' || k === '=') world.rig.zoom(0.85);
  else if (k === '-') world.rig.zoom(1.18);
  else held.add(k);
});
window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => held.clear());

function keyboardCamera(dt: number) {
  let dx = 0, dy = 0;
  if (held.has('a') || held.has('arrowleft')) dx -= 1;
  if (held.has('d') || held.has('arrowright')) dx += 1;
  if (held.has('w') || held.has('arrowup')) dy += 1;
  if (held.has('s') || held.has('arrowdown')) dy -= 1;
  if (dx || dy) world.rig.panScreen(dx * dt * 12, dy * dt * 12);
  if (held.has('q')) world.rig.rotate(dt * 1.6);
  if (held.has('e')) world.rig.rotate(-dt * 1.6);
}

document.getElementById('rot-left')!.addEventListener('click', () => {
  sfx.unlock();
  rotate(-1);
});
document.getElementById('rot-right')!.addEventListener('click', () => {
  sfx.unlock();
  rotate(1);
});
hud.confirm.addEventListener('click', () => {
  if (hover) place(hover.q, hover.r);
});
document.getElementById('btn-help')!.addEventListener('click', showHelp);
document.getElementById('btn-new')!.addEventListener('click', () => {
  rulesTheme = theme;
  newGame();
  hud.toast(`Nova partida · ${theme.name}`);
});
hud.themeBtn.addEventListener('click', () => {
  if (hud.themeMenu.hidden) hud.openThemeMenu(theme, pickTheme);
  else hud.closeThemeMenu();
});
qualityBtn.addEventListener('click', () => {
  const order: QualityMode[] = ['auto', 'high', 'medium', 'low'];
  const next = order[(order.indexOf(qualityMode) + 1) % order.length];
  applyQuality(next);
  autoLevel = 'high';
  store.set('quality', next);
  hud.toast(`Qualidade: ${qualityLabel[next]}`);
});
const soundBtn = document.getElementById('btn-sound')!;
soundBtn.addEventListener('click', () => {
  sfx.enabled = !sfx.enabled;
  sfx.unlock();
  soundBtn.setAttribute('aria-pressed', String(sfx.enabled));
  store.set('sound', sfx.enabled ? '1' : '0');
});
if (store.get('sound') === '0') {
  sfx.enabled = false;
  soundBtn.setAttribute('aria-pressed', 'false');
}

window.addEventListener('resize', () => world.resize());

// ------------------------------------------------------------------ modos especiais

/** Joga N peças instantaneamente com a IA gulosa (captura de tela e teste de carga). */
function autoPlace(n: number, infinite: boolean) {
  if (infinite) game.stack = n + 10;
  const t0 = performance.now();
  const placed = [];
  for (let i = 0; i < n && game.current; i++) {
    const m = game.bestMove();
    if (!m) break;
    game.rot = m.rot;
    const res = game.place(m.q, m.r);
    if (!res) break;
    placed.push(res.placed);
    while (game.discardIfStuck());
  }
  const logic = performance.now() - t0;
  const t1 = performance.now();
  world.placeInstant(placed, game.board);
  const bake = performance.now() - t1;
  hud.renderQuests(game.board.quests, theme);
  frameCamera(true);
  refreshHud(true);
  return { logic, bake, tiles: game.board.list.length };
}

let demoClock = 0;
function demoStep(dt: number) {
  demoClock += dt;
  if (demoClock < 0.9 || !game.current) return;
  demoClock = 0;
  const m = game.bestMove();
  if (!m) return;
  hover = { q: m.q, r: m.r };
  while (game.rot !== m.rot) rotate(1);
  updateGhost();
  setTimeout(() => place(m.q, m.r), 380);
}

// ------------------------------------------------------------------ laço

const statsText = { fps: 0, ms: 0, cpu: 0 };
let statsClock = 0;
let frames = 0;
let cpuAcc = 0;
let last = performance.now();

function frame(now: number) {
  const realDt = (now - last) / 1000;
  const dt = Math.min(0.05, realDt);
  last = now;
  const c0 = performance.now();
  keyboardCamera(dt);
  if (params.has('demo')) demoStep(dt);
  world.previewRect = hud.preview.getBoundingClientRect();
  world.tick(dt);
  hud.tick(dt);
  const markers = [];
  for (const q of game.board.quests) {
    if (q.state !== 'active') continue;
    const s = screenOf(q.anchor.q, q.anchor.r, 0.55);
    markers.push({ id: q.id, x: s.x, y: s.y, visible: s.visible, text: q.exact ? `=${q.target}` : `${q.target}+`, color: theme.terrainColors[q.terrain] });
  }
  hud.updateMarkers(markers);
  cpuAcc += performance.now() - c0;
  frames++;
  statsClock += realDt;
  if (statsClock >= 0.5) {
    statsText.fps = frames / statsClock;
    statsText.ms = (statsClock / frames) * 1000;
    statsText.cpu = cpuAcc / frames;
    frames = 0;
    statsClock = 0;
    cpuAcc = 0;
    if (!hud.stats.hidden) {
      const s = world.stats();
      hud.stats.textContent = [
        `FPS ${statsText.fps.toFixed(0)}  (${statsText.ms.toFixed(1)} ms)`,
        `CPU/quadro ${statsText.cpu.toFixed(2)} ms`,
        `draw calls ${s.calls}`,
        `triângulos ${(s.triangles / 1000).toFixed(0)} mil`,
        `peças ${game.board.list.length} · blocos ${s.chunks}`,
        `instâncias ${s.instances.toLocaleString('pt-BR')}`,
        `qualidade ${qualityLabel[qualityMode]}${qualityMode === 'auto' ? ` (${qualityLabel[autoLevel]})` : ''}`,
      ].join('\n');
    }
    (window as unknown as { __stats: unknown }).__stats = { ...statsText, ...world.stats(), tiles: game.board.list.length, quality: world.quality };
  }
  adaptQuality(realDt);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ início

function start(data: unknown) {
  const hot = data as Partial<Save & { theme: string }> | undefined;
  if (hot?.theme) theme = themeById(hot.theme);
  applyQuality(qualityMode);
  world.onBaked = () => {};
  const saved = !special ? (hot?.moves ? hot : (JSON.parse(store.get('save') ?? 'null') as Save | null)) : null;
  if (saved?.moves && saved.seed) {
    rulesTheme = themeById(saved.rulesId);
    newGame(saved.seed, saved.moves);
    if (saved.moves.length) hud.toast(`Partida retomada · ${saved.moves.length} peças`);
  } else {
    rulesTheme = theme;
    newGame(Number(params.get('seed')) || undefined);
  }
  if (params.has('stress')) {
    const r = autoPlace(Number(params.get('stress')) || 1000, true);
    hud.stats.hidden = false;
    hud.toast(`Teste de carga: ${r.tiles} peças · lógica ${r.logic.toFixed(0)} ms · montagem ${r.bake.toFixed(0)} ms`);
    (window as unknown as { __load: unknown }).__load = r;
  } else if (params.has('auto')) autoPlace(Number(params.get('auto')) || 40, false);
  if (params.has('debug')) hud.stats.hidden = false;
  if (params.has('yaw')) world.rig.yaw = world.rig.goalYaw = Number(params.get('yaw'));
  if (params.has('zoom')) world.rig.dist = world.rig.goalDist = Number(params.get('zoom'));
  if (!special && !store.get('seenHelp') && !saved?.moves?.length) showHelp();
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

// Ajuda para capturas de tela automatizadas: mostra a peça atual na melhor posição.
(window as unknown as { __ghostBest: () => void }).__ghostBest = () => {
  const m = game.bestMove();
  if (!m) return;
  hover = { q: m.q, r: m.r };
  while (game.rot !== m.rot) rotate(1);
  updateGhost();
};

const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
hot?.snapshot?.(() => ({ v: 1, seed: game.seed, rulesId: rulesTheme.id, moves, theme: theme.id }));
if (hot?.ready) hot.ready(start);
else start(hot?.data);


