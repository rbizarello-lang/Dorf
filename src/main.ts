import * as THREE from 'three/webgpu';
import { Sfx } from './audio';
import { DEFAULT_RULES, type PlaceResult, type Rules } from './core/board';
import { Game } from './core/game';
import { mulberry32 } from './core/rng';
import { DIRS, hexToWorld, hkey, worldToHex } from './core/hex';
import type { Quality, TimeOfDay } from './render/world';
import { FX_FLAGS } from './render/post';
import { World } from './render/world';
import { themeById, type Theme } from './themes/themes';
import { Hud, questLabel } from './ui/hud';
import './ui/style.css';

// ------------------------------------------------------------------ estado

type QualityMode = 'auto' | Quality;
type MoveRec = [number, number, number];
/** v3: sequência de peças por índice e pontos de interação. Guarda a pontuação para conferir o replay. */
interface Save {
  v: 3;
  seed: number;
  rulesId: string;
  moves: MoveRec[];
  score: number;
}
const SAVE_VERSION = 3;
interface Hot {
  snapshot?: (fn: () => unknown) => void;
  ready?: (fn: (data: unknown) => void) => void;
  data?: unknown;
}

// Fontes entram por JS: uma folha de estilo inserida depois não bloqueia o início do
// jogo se a rede estiver lenta ou presa (o CSS já tem fontes de reserva).
{
  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = 'https://fonts.googleapis.com/css2?family=Caprasimo&family=Nunito:wght@500;700;800&display=swap';
  document.head.appendChild(fonts);
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
async function createWorld(): Promise<World> {
  try {
    // ?webgl força o backend WebGL2 (para comparar com o WebGPU).
    return await World.create(canvas, params.has('webgl'));
  } catch (err) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="modal"><div class="sheet" role="alertdialog" aria-labelledby="no-gl"><h2 id="no-gl">Sem gráficos 3D</h2><p>O navegador não conseguiu iniciar o WebGPU nem o WebGL2, que o jogo usa para desenhar o mapa. Atualize o navegador ou ative a aceleração por hardware nas configurações e recarregue a página.</p></div></div>`,
    );
    throw err;
  }
}
const world = await createWorld();
{
  // ?fx=ao.traa.bloom.dof liga os efeitos um a um (medir custo); só nomes conhecidos.
  const fx = params.get('fx');
  if (fx !== null) world.fx = fx.split('.').filter((f) => (FX_FLAGS as readonly string[]).includes(f));
}
hud.preview.appendChild(world.preview.canvas);

let theme: Theme = themeById(params.get('theme') ?? store.get('theme'));
let rulesTheme: Theme = theme;
let game: Game;
let moves: MoveRec[] = [];
let rotSteps = 0;
let hover: { q: number; r: number } | null = null;
let best = Number(store.get('best')) || 0;
const QUALITIES: QualityMode[] = ['auto', 'ultra', 'high', 'medium', 'low'];
const pickQ = (v: string | null) => (v && (QUALITIES as string[]).includes(v) ? (v as QualityMode) : null);
let qualityMode: QualityMode = pickQ(params.get('quality')) ?? pickQ(store.get('quality')) ?? 'auto';
let gameOverShown = false;
let overTimer = 0;
let bestAtStart = 0;
const special = params.has('stress') || params.has('auto') || params.has('demo');

const rulesFor = (t: Theme): Rules => ({ ...DEFAULT_RULES, ...t.rules });

// ------------------------------------------------------------------ partida

/**
 * Começa uma partida; com `replay`, refaz as jogadas salvas. Devolve false (sem mexer
 * na tela) se o replay não reproduz a partida salva, por exemplo depois de uma
 * atualização do gerador de peças.
 */
const synTimers: number[] = [];

function newGame(seed = 1 + Math.floor(Math.random() * 1e9), replay: MoveRec[] = [], expectScore?: number): boolean {
  clearTimeout(overTimer);
  for (const t of synTimers.splice(0)) clearTimeout(t);
  game = new Game(seed, rulesFor(rulesTheme));
  moves = [];
  for (const [q, r, rot] of replay) {
    game.rot = rot;
    if (!game.place(q, r)) break;
    moves.push([q, r, rot]);
    while (game.discardIfStuck());
  }
  game.rot = 0;
  if (moves.length !== replay.length || (expectScore !== undefined && game.board.score !== expectScore)) return false;
  rotSteps = 0;
  hover = null;
  gameOverShown = false;
  bestAtStart = best;
  hud.hint.style.opacity = moves.length >= 6 ? '0' : '';
  world.dropGhost();
  world.setTheme(theme, game.board);
  hud.applyTheme(theme);
  hud.renderQuests(game.board.quests, theme);
  frameCamera(true);
  refreshHud(true);
  persist();
  return true;
}

function persist() {
  if (special) return;
  if (game.over) store.set('save', null);
  else store.set('save', JSON.stringify(snapshot()));
}

function snapshot(): Save {
  return { v: SAVE_VERSION, seed: game.seed, rulesId: rulesTheme.id, moves, score: game.board.score };
}

/** Aceita só saves completos e da versão atual; qualquer outra coisa é descartada. */
function validSave(raw: unknown): Save | null {
  const s = raw as Partial<Save> | null;
  const okMove = (m: unknown) => Array.isArray(m) && m.length === 3 && m.every(Number.isInteger) && m[2] >= 0 && m[2] < 6;
  if (s && s.v === SAVE_VERSION && Number.isInteger(s.seed) && s.seed! > 0 && typeof s.rulesId === 'string' && Array.isArray(s.moves) && s.moves.every(okMove) && Number.isFinite(s.score)) return s as Save;
  return null;
}

function readSave(): Save | null {
  let save: Save | null = null;
  let old = false;
  try {
    const raw = JSON.parse(store.get('save') ?? 'null') as { v?: unknown } | null;
    save = validSave(raw);
    old = !save && typeof raw?.v === 'number' && raw.v < SAVE_VERSION;
  } catch {
    /* save ilegível */
  }
  if (!save) store.set('save', null);
  if (old) hud.toast('A partida salva vem de uma versão anterior do jogo e foi descartada.');
  return save;
}

/** Nova partida pedida pelo jogador: confirma se há uma partida em andamento. */
function requestNewGame() {
  if (game.over || moves.length < 3) {
    startFresh();
    return;
  }
  hud.showModal(`
    <h2 id="modal-title">Começar outra partida?</h2>
    <p>A partida atual (${moves.length} peças, ${game.board.score.toLocaleString('pt-BR')} pontos) será descartada.</p>
    <div class="row">
      <button class="primary" type="button" data-act="new">Nova partida</button>
      <button class="secondary" type="button" data-act="close">Continuar jogando</button>
    </div>`);
}

function startFresh() {
  rulesTheme = theme;
  newGame();
  hud.toast(`Nova partida · ${theme.name}`);
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
  // Com 1 peça na pilha, a "próxima" só entraria se a jogada render peças: não mostra.
  hud.renderNext(game.stack <= 1 ? null : game.next, theme);
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
  world.setGhost(game.current, game.rot, rotSteps * (Math.PI / 3), hover.q, hover.r, check);
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
      const [water, rail] = [theme.terrainNames[4], theme.terrainNames[5]];
      hud.toast(`${water} só encosta em ${water.toLowerCase()}, e ${rail.toLowerCase()} só em ${rail.toLowerCase()}.`, 'bad');
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
  if (moves.length >= 6) hud.hint.style.opacity = '0';
  refreshHud();
  persist();
  if (game.over && !gameOverShown) {
    gameOverShown = true;
    overTimer = window.setTimeout(() => {
      if (game.over) showGameOver();
    }, 1100);
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
  // Interações: um aviso por borda, perto dela.
  res.synergies.forEach((h, k) => {
    const [dq, dr] = DIRS[h.edge];
    const a = hexToWorld(res.placed.q, res.placed.r);
    const b = hexToWorld(res.placed.q + dq, res.placed.r + dr);
    const p = world.project((a.x + b.x) / 2, 0.35, (a.z + b.z) / 2);
    synTimers.push(window.setTimeout(() => {
      hud.floater(p.x, p.y, `${theme.synergy[h.kind]} +${game.rules.synergyPoints}`, 'syn');
      sfx.note(7 + k * 2, 0, 0.5, 0.08);
    }, 250 + k * 160));
  });
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
      <li><b>Encaixe perfeito</b>: a peça encosta em 2 ou mais vizinhas e todas as bordas combinam (+${game.rules.perfectBonus}).</li>
      <li>Cercar uma peça com 6 vizinhas encaixadas rende <b>+1 peça</b>.</li>
      <li><b>Missões</b> pedem grupos de certo tamanho e dão peças extras. "Exatamente N" falha se passar.</li>
      <li><b>Interações</b>: bordas diferentes que se encostam também contam (+${game.rules.synergyPoints}) e erguem construções. A borda acende em dourado.</li>
    </ul>
    <div class="synergies">${synergyLegend()}</div>
    <ul>
      <li>A partida acaba quando a pilha esvazia.</li>
    </ul>
    <p class="muted">Mouse: clique coloca, botão direito ou <kbd>R</kbd> gira a peça, arrastar move, roda dá zoom, <kbd>Q</kbd>/<kbd>E</kbd> giram a câmera. Toque: toque num espaço para ver a peça, toque de novo (ou ✓) para colocar.</p>
    <div class="row"><button class="primary" type="button" data-act="close">Jogar</button></div>`);
}

function synergyLegend() {
  const T4 = theme.terrainNames;
  const C = theme.terrainColors;
  const row = (a: number, b: number, name: string) => `<span><i style="background:${C[a]}"></i><i style="background:${C[b]}"></i>${T4[a]} + ${T4[b]} = <b>${name}</b></span>`;
  return [row(3, 1, theme.synergy.lumber), row(3, 2, theme.synergy.mill), row(3, 0, theme.synergy.pasture), row(2, 0, theme.synergy.apiary)].join('');
}

function showGameOver() {
  const b = game.board;
  const record = b.score > bestAtStart && b.score > 0;
  hud.showModal(`
    <h2 id="modal-title">${record ? 'Novo recorde!' : 'Pilha vazia'}</h2>
    <p class="muted">${theme.name} · semente ${game.seed}</p>
    <div class="final">
      <div><b>${b.score.toLocaleString('pt-BR')}</b><span>pontos</span></div>
      <div><b>${game.placedCount}</b><span>peças</span></div>
      <div><b>${b.questsCompleted}</b><span>missões</span></div>
    </div>
    <p class="muted">${b.perfects} encaixes perfeitos, ${Object.values(b.synergyCount).reduce((a, c) => a + c, 0)} interações. Recorde: ${best.toLocaleString('pt-BR')}.</p>
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
    startFresh();
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

const qualityLabel: Record<QualityMode, string> = { auto: 'Auto', ultra: 'Ultra', high: 'Alta', medium: 'Média', low: 'Baixa' };
const qualityBtn = document.getElementById('btn-quality')!;

// Em telas de toque (celular/tablet) o modo Auto começa em Média; no computador, em Ultra.
const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
const autoStart: Quality = coarsePointer ? 'medium' : 'ultra';
const LOWER: Record<Quality, Quality> = { ultra: 'high', high: 'medium', medium: 'low', low: 'low' };
let autoLevel: Quality = autoStart;

function applyQuality(mode: QualityMode) {
  qualityMode = mode;
  if (mode === 'auto') autoLevel = autoStart;
  world.setQuality(mode === 'auto' ? autoLevel : mode);
  qualityBtn.textContent = qualityLabel[mode];
  frameTimes.length = 0;
}

const frameTimes: number[] = [];
function adaptQuality(dt: number) {
  if (qualityMode !== 'auto' || document.hidden) return;
  frameTimes.push(dt);
  if (frameTimes.length < 150) return;
  frameTimes.sort((a, b) => a - b);
  const median = frameTimes[75];
  frameTimes.length = 0;
  if (median > 1 / 38 && autoLevel !== 'low') {
    autoLevel = LOWER[autoLevel];
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
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
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
  sfx.unlock(); // iOS libera áudio no fim do toque
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
  // Atalhos do navegador (Ctrl/Cmd+R, Cmd+D...) ficam com o navegador.
  if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if (hud.modalOpen && !game.over) store.set('seenHelp', '1');
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
  else if (k === 'l') cycleTime();
  else if (k === 'h' || k === '?') showHelp();
  else if (k === 'n') requestNewGame();
  else if (k === '+' || k === '=') world.rig.zoom(0.85);
  else if (k === '-') world.rig.zoom(1.18);
  else held.add(k);
});
window.addEventListener('keyup', (e) => {
  // Com Cmd pressionado o macOS não envia keyup das outras teclas: evita câmera "presa".
  if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt') held.clear();
  else held.delete(e.key.toLowerCase());
});
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
document.getElementById('btn-new')!.addEventListener('click', requestNewGame);
hud.themeBtn.addEventListener('click', () => {
  if (hud.themeMenu.hidden) hud.openThemeMenu(theme, pickTheme);
  else hud.closeThemeMenu();
});
qualityBtn.addEventListener('click', () => {
  const next = QUALITIES[(QUALITIES.indexOf(qualityMode) + 1) % QUALITIES.length];
  applyQuality(next);
  store.set('quality', next);
  hud.toast(`Qualidade: ${qualityLabel[next]}`);
});
const TIME_LABEL: Record<TimeOfDay, string> = { day: 'Dia', dusk: 'Tarde', night: 'Noite' };
const TIME_ICON: Record<TimeOfDay, string> = { day: '☀', dusk: '◐', night: '☾' };
const setTimeLabel = (t: TimeOfDay) => {
  timeBtn.querySelector('.long')!.textContent = TIME_LABEL[t];
  timeBtn.querySelector('.short')!.textContent = TIME_ICON[t];
};
const timeBtn = document.getElementById('btn-time')!;
function cycleTime() {
  const order: TimeOfDay[] = ['day', 'dusk', 'night'];
  const next = order[(order.indexOf(world.timeOfDay) + 1) % 3];
  world.setTimeOfDay(next);
  setTimeLabel(next);
  store.set('time', next);
}
timeBtn.addEventListener('click', cycleTime);
{
  const saved = (params.get('time') ?? store.get('time')) as TimeOfDay | null;
  if (saved && Object.hasOwn(TIME_LABEL, saved)) {
    world.setTimeOfDay(saved);
    setTimeLabel(saved);
  }
}

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
  // Gerador próprio: com ?seed, o tabuleiro de exemplo sai igual a cada carga (capturas comparáveis).
  const rand = mulberry32(game.seed ^ 0x5eed);
  for (let i = 0; i < n && game.current; i++) {
    const m = game.bestMove(rand);
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
  try {
    step(now);
  } finally {
    requestAnimationFrame(frame);
  }
}

function step(now: number) {
  const realDt = (now - last) / 1000;
  const dt = Math.min(0.05, realDt);
  last = now;
  const c0 = performance.now();
  keyboardCamera(dt);
  if (params.has('demo')) demoStep(dt);
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
}

// ------------------------------------------------------------------ início

function start(data: unknown) {
  const hotData = data as (Partial<Save> & { theme?: string }) | undefined;
  if (hotData?.theme) theme = themeById(hotData.theme);
  applyQuality(qualityMode);
  let saved = special ? null : (validSave(hotData) ?? readSave());
  // Um link com ?seed= (desafio) vence a partida salva de outra semente.
  const wantSeed = Math.floor(Number(params.get('seed'))) || 0;
  if (saved && wantSeed > 0 && saved.seed !== wantSeed) saved = null;
  let resumed = false;
  if (saved) {
    rulesTheme = themeById(saved.rulesId);
    resumed = newGame(saved.seed, saved.moves, saved.score);
    if (resumed && saved.moves.length) hud.toast(`Partida retomada · ${saved.moves.length} peças`);
    else if (!resumed) hud.toast('A partida salva é de uma versão anterior e não pôde ser retomada. Começando outra.');
  }
  if (!resumed) {
    rulesTheme = theme;
    newGame(wantSeed > 0 ? wantSeed : undefined);
  }
  if (params.has('stress')) {
    const r = autoPlace(Number(params.get('stress')) || 1000, true);
    hud.stats.hidden = false;
    hud.toast(`Teste de carga: ${r.tiles} peças · lógica ${r.logic.toFixed(0)} ms · montagem ${r.bake.toFixed(0)} ms`);
    (window as unknown as { __load: unknown }).__load = r;
  } else if (params.has('auto')) autoPlace(Number(params.get('auto')) || 40, false);
  if (params.has('debug')) hud.stats.hidden = false;
  (window as unknown as { __pools: () => unknown }).__pools = () => world.poolReport();
  if (params.has('gallery')) (window as unknown as { __gallery: string[] }).__gallery = world.showGallery();
  if (params.has('yaw')) world.rig.yaw = world.rig.goalYaw = Number(params.get('yaw'));
  if (params.has('zoom')) world.rig.dist = world.rig.goalDist = Number(params.get('zoom'));
  if (params.has('focus')) (window as unknown as { __focus: (t: number) => boolean }).__focus(Number(params.get('focus')));
  if (!special && !store.get('seenHelp') && !(resumed && moves.length)) showHelp();
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
  const { x, z } = hexToWorld(m.q, m.r);
  world.rig.goal.set(x, 0, z);
};

// Centraliza a câmera na peça com mais bordas de um terreno (?focus=4 para rios, nas capturas).
(window as unknown as { __focus: (t: number, zoom?: number) => boolean }).__focus = (t, zoom) => {
  let best: { q: number; r: number; n: number } | null = null;
  for (const p of game.board.list) {
    const n = p.edges.filter((e) => e === t).length;
    if (n && (!best || n > best.n)) best = { q: p.q, r: p.r, n };
  }
  if (!best) return false;
  const { x, z } = hexToWorld(best.q, best.r);
  world.rig.goal.set(x, 0, z);
  world.rig.target.set(x, 0, z);
  if (zoom) world.rig.dist = world.rig.goalDist = zoom;
  return true;
};

// Idem, escolhendo a jogada com mais interações (para ver as construções).
(window as unknown as { __ghostSynergy: () => number }).__ghostSynergy = () => {
  if (!game.current) return 0;
  let best: { q: number; r: number; rot: number; n: number } | null = null;
  for (const k of game.board.frontier) {
    const [q, r] = [(k >> 13) - 4096, (k & 8191) - 4096];
    for (let rot = 0; rot < 6; rot++) {
      game.rot = rot;
      const c = game.check(q, r)!;
      if (c.valid && (!best || c.synergies.length > best.n)) best = { q, r, rot, n: c.synergies.length };
    }
  }
  game.rot = 0;
  rotSteps = 0;
  if (!best) return 0;
  hover = { q: best.q, r: best.r };
  while (game.rot !== best.rot) rotate(1);
  updateGhost();
  const { x, z } = hexToWorld(best.q, best.r);
  world.rig.goal.set(x, 0, z);
  return best.n;
};

const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
hot?.snapshot?.(() => ({ ...snapshot(), theme: theme.id }));
if (hot?.ready) hot.ready(start);
else start(hot?.data);
