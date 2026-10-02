import * as THREE from 'three/webgpu';
import { Sfx } from './audio';
import { DEFAULT_RULES, type PlaceResult, type Rules } from './core/board';
import { Game } from './core/game';
import { MODES, dailySeed, modeById, type Mode, type ModeId } from './core/modes';
import { LOOKOUT_MOVES, SITE_REWARD, type SiteKind } from './core/sites';
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
/** v4: modos, eras, sítios e bônus por tema. Guarda a pontuação para conferir o replay. */
interface Save {
  v: 4;
  seed: number;
  rulesId: string;
  mode: ModeId;
  moves: MoveRec[];
  /** Quantas vezes já desfez nesta partida (o limite vem do modo). */
  undone: number;
  score: number;
}
const SAVE_VERSION = 4;
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
  // ?fx=ao.traa.bloom.dof.ink liga os efeitos um a um (medir custo); só nomes conhecidos.
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
let recordCheered = false;
const special = params.has('stress') || params.has('auto') || params.has('demo');

// Regras: padrão ← tema ← modo. O desafio do dia ignora as regras do tema (é igual para todos).
const rulesFor = (t: Theme, m: Mode = mode): Rules => ({ ...DEFAULT_RULES, ...(m.daily ? {} : t.rules), ...m.rules });
let mode: Mode = modeById(params.get('mode') ?? store.get('mode'));
let undone = 0;
const ERA_NAMES = ['Aldeia', 'Vila', 'Burgo', 'Cidade'];
const eraName = (i: number) => (theme.eras ?? ERA_NAMES)[i] ?? ERA_NAMES[ERA_NAMES.length - 1];
const SITE_LABEL: Record<SiteKind, { name: string; icon: string }> = {
  ruin: { name: 'Ruína', icon: '⌂' },
  treasure: { name: 'Tesouro', icon: '◆' },
  relic: { name: 'Relíquia', icon: '✦' },
  lookout: { name: 'Mirante', icon: '◉' },
};

// ------------------------------------------------------------------ partida

/**
 * Começa uma partida; com `replay`, refaz as jogadas salvas. Devolve false (sem mexer
 * na tela) se o replay não reproduz a partida salva, por exemplo depois de uma
 * atualização do gerador de peças.
 */
const synTimers: number[] = [];

function newGame(seed = mode.daily ? dailySeed() : 1 + Math.floor(Math.random() * 1e9), replay: MoveRec[] = [], expectScore?: number, undos = 0): boolean {
  clearTimeout(overTimer);
  for (const t of synTimers.splice(0)) clearTimeout(t);
  game = new Game(seed, rulesFor(rulesTheme));
  undone = undos;
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
  recordCheered = false;
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
  return { v: SAVE_VERSION, seed: game.seed, rulesId: rulesTheme.id, mode: mode.id, moves, undone, score: game.board.score };
}

/** Aceita só saves completos e da versão atual; qualquer outra coisa é descartada. */
function validSave(raw: unknown): Save | null {
  const s = raw as Partial<Save> | null;
  const okMove = (m: unknown) => Array.isArray(m) && m.length === 3 && m.every(Number.isInteger) && m[2] >= 0 && m[2] < 6;
  if (s && s.v === SAVE_VERSION && Number.isInteger(s.seed) && s.seed! > 0 && typeof s.rulesId === 'string' && MODES.some((m) => m.id === s.mode) && Number.isInteger(s.undone) && s.undone! >= 0 && Array.isArray(s.moves) && s.moves.every(okMove) && Number.isFinite(s.score)) return s as Save;
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
  const warn = !game.over && moves.length >= 3 ? `<p class="muted">A partida atual (${moves.length} peças, ${game.board.score.toLocaleString('pt-BR')} pontos) será descartada.</p>` : '';
  const cards = MODES.map(
    (m) => `<button class="mode-card" type="button" data-act="mode" data-mode="${m.id}" aria-current="${m.id === mode.id}"><strong>${m.name}</strong><span>${m.tagline}</span></button>`,
  ).join('');
  hud.showModal(`
    <h2 id="modal-title">Nova partida</h2>
    <p>Escolha o modo. O tema continua: ${theme.name}.</p>
    <div class="modes">${cards}</div>
    ${warn}
    <div class="row"><button class="secondary" type="button" data-act="close">Continuar jogando</button></div>`);
}

function startFresh(m: Mode = mode) {
  mode = m;
  store.set('mode', m.id);
  rulesTheme = theme;
  newGame();
  hud.toast(m.daily ? `Desafio do dia ${dailySeed()} · ${m.name}` : `Nova partida · ${m.name} · ${theme.name}`);
}

/** Desfaz a última jogada: refaz a partida pelo replay sem ela (o mesmo caminho do save). */
function undo() {
  const left = mode.undos - undone;
  if (left <= 0 || !moves.length || hud.modalOpen) return;
  const keep = moves.slice(0, -1);
  if (!newGame(game.seed, keep, undefined, undone + 1)) return;
  sfx.rotate();
  hud.toast(left - 1 > 0 && left - 1 < 99 ? `Jogada desfeita · restam ${left - 1}` : 'Jogada desfeita');
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
  hud.setStack(game.stack, game.rules.infinite);
  const b = game.board, es = game.rules.eraScores;
  const nextAt = es[b.era + 1];
  hud.setEra(es.length > 1 ? `Era ${['I', 'II', 'III', 'IV', 'V', 'VI'][b.era] ?? b.era + 1} · ${eraName(b.era)} · ${mode.name}` : mode.name, nextAt === undefined ? null : Math.min(1, (b.score - es[b.era]) / (nextAt - es[b.era])));
  hud.setUndo(Math.min(mode.undos - undone, moves.length ? 99 : 0));
  // Com 1 peça na pilha, a "próxima" só entraria se a jogada render peças: não mostra.
  hud.renderNext(game.stack <= 1 && !game.rules.infinite ? null : game.next, theme, game.board.lookout > 0 ? game.upcoming(3) : []);
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
  sfx.rotate(dir);
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
  // Passar do recorde é um momento: comemora uma vez por partida (não na primeira partida).
  if (!recordCheered && bestAtStart > 0 && game.board.score > bestAtStart && !special) {
    recordCheered = true;
    sfx.record();
    hud.bumpScore('record');
    const w = hexToWorld(res.placed.q, res.placed.r);
    world.flushBirds(w.x, w.z);
    hud.toast(`Novo recorde! Passou de ${bestAtStart.toLocaleString('pt-BR')} pontos.`, 'good');
  }
  if (moves.length >= 6) hud.hint.style.opacity = '0';
  refreshHud();
  hud.say(`${res.points > 0 ? `Mais ${res.points} pontos. ` : ''}Total ${game.board.score.toLocaleString('pt-BR')}. ${game.rules.infinite ? '' : `${game.stack} peças na pilha.`}`);
  persist();
  if (game.over && !gameOverShown) {
    gameOverShown = true;
    overTimer = window.setTimeout(() => {
      if (!game.over) return;
      // A câmera recua devagar até mostrar o mapa inteiro antes do placar final.
      frameCamera(false);
      overTimer = window.setTimeout(() => {
        if (game.over) showGameOver();
      }, 900);
    }, 1100);
  }
}

function announce(res: PlaceResult) {
  const s = screenOf(res.placed.q, res.placed.r);
  sfx.place(res.matches);
  if (res.points > 0) {
    hud.floater(s.x, s.y - 10, `+${res.points}`, res.perfect ? 'big' : '');
    hud.bumpScore(res.perfect || res.synergies.length ? 'big' : '');
  }
  const { x, z } = hexToWorld(res.placed.q, res.placed.r);
  if (res.perfect) {
    sfx.perfect();
    world.burst(x, z, 'sparkle', 26);
    world.halo(x, z);
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
  if (res.synergies.length || res.placed.eraMark !== undefined) sfx.hammer(0.3);
  if (res.placed.eraMark !== undefined) {
    hud.toast(`Marco da era erguido: ${eraName(res.placed.eraMark)}`, 'good');
    world.burst(x, z, 'sparkle', 30, 0.3);
    world.halo(x, z, 1.5);
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
  if (res.site) {
    const r = SITE_REWARD[res.site.kind];
    const what = [r.points ? `+${r.points} pontos` : '', r.tiles ? `+${r.tiles} peça${r.tiles > 1 ? 's' : ''}` : '', res.site.kind === 'lookout' ? `próximas peças à vista por ${LOOKOUT_MOVES} jogadas` : ''].filter(Boolean).join(' · ');
    hud.toast(`${SITE_LABEL[res.site.kind].name} descoberta: ${what}`, 'good');
    sfx.quest();
    world.burst(x, z, 'sparkle', 46);
  }
  if (res.eraUp !== null) {
    hud.toast(`Nova era: ${eraName(res.eraUp)} · +${game.rules.eraTiles} peças · a próxima vila ergue o marco`, 'good');
    sfx.perfect();
    sfx.quest();
    sfx.hammer(0.45);
    world.eraUp(res.eraUp);
    world.ripple(x, z, 2.2);
    world.burst(x, z, 'sparkle', 60);
    world.halo(x, z, 2);
    world.flushBirds(x, z);
    const el = document.getElementById('era')!;
    el.classList.remove('up');
    void el.offsetWidth;
    el.classList.add('up');
  }
  if (res.leftoverBonus) hud.toast(`Todos os sítios achados! Peças que sobraram: +${res.leftoverBonus} pontos`, 'good');
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
      <li><b>Eras</b>: com ${game.rules.eraScores.slice(1).map((v) => v.toLocaleString('pt-BR')).join(', ')} pontos a vila muda de era e ganha +${game.rules.eraTiles} peças. O Centro, no meio da primeira peça, muda de forma, e a próxima peça com vila ergue o marco da era.</li>
      <li><b>Sítios</b>: carimbos no mapa marcam ruínas (pontos), tesouros (peças), relíquias (os dois) e mirantes (mostram as próximas peças). Coloque uma peça em cima para descobrir.</li>
      <li><kbd>U</kbd> desfaz a última jogada (o número de vezes depende do modo).</li>
      <li>O botão de som alterna entre música e efeitos, só efeitos e mudo; <kbd>M</kbd> liga ou desliga a música.</li>
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
    <h2 id="modal-title">${record ? 'Novo recorde!' : b.sites.length && !b.sitesLeft() && game.rules.endOnSites ? 'Todos os sítios achados!' : 'Pilha vazia'}</h2>
    <p class="muted">${mode.name} · ${theme.name} · semente ${game.seed}</p>
    <div class="final">
      <div><b data-count="${b.score}">${b.score.toLocaleString('pt-BR')}</b><span>pontos</span></div>
      <div><b>${game.placedCount}</b><span>peças</span></div>
      <div><b>${b.questsCompleted}</b><span>missões</span></div>
    </div>
    <p class="muted">Era ${eraName(b.era)}, ${b.sites.filter((x) => x.found).length} de ${b.sites.length} sítios, ${b.perfects} encaixes perfeitos, ${Object.values(b.synergyCount).reduce((a, c) => a + c, 0)} interações. Recorde: ${best.toLocaleString('pt-BR')}.</p>
    <div class="row">
      <button class="primary" type="button" data-act="new">Jogar de novo</button>
      <button class="secondary" type="button" data-act="theme">Trocar tema</button>
    </div>`);
  if (record) hud.modalBody.querySelector('h2')!.classList.add('record');
  sfx.gameOver(record);
  hud.countUp(hud.modalBody.querySelector<HTMLElement>('[data-count]')!, b.score);
}

hud.modal.addEventListener('click', (e) => {
  const act = (e.target as HTMLElement).closest('button')?.dataset.act;
  if (e.target === hud.modal || act === 'close') {
    hud.hideModal();
    store.set('seenHelp', '1');
  } else if (act === 'new') {
    hud.hideModal();
    startFresh();
  } else if (act === 'mode') {
    hud.hideModal();
    startFresh(modeById((e.target as HTMLElement).closest('button')?.dataset.mode));
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
  } else if (!mode.daily && JSON.stringify(rulesFor(t)) !== JSON.stringify(game.rules)) {
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
  else if (k === 'u') undo();
  else if (k === 'm') toggleMusic();
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
document.getElementById('btn-undo')!.addEventListener('click', undo);
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
const TIME_LABEL: Record<TimeOfDay, string> = { dawn: 'Amanhecer', day: 'Dia', golden: 'Hora dourada', dusk: 'Entardecer', night: 'Noite' };
const TIME_ICON: Record<TimeOfDay, string> = { dawn: '◒', day: '☀', golden: '☼', dusk: '◐', night: '☾' };
/** Ordem do botão e da tecla L: o dia passa uma hora por vez. */
const TIME_ORDER: TimeOfDay[] = ['dawn', 'day', 'golden', 'dusk', 'night'];
const setTimeLabel = (t: TimeOfDay) => {
  timeBtn.querySelector('.long')!.textContent = TIME_LABEL[t];
  timeBtn.querySelector('.short')!.textContent = TIME_ICON[t];
};
const timeBtn = document.getElementById('btn-time')!;
function cycleTime() {
  const next = TIME_ORDER[(TIME_ORDER.indexOf(world.timeOfDay) + 1) % TIME_ORDER.length];
  world.setTimeOfDay(next);
  setTimeLabel(next);
  sfx.setMood(next);
  store.set('time', next);
}
timeBtn.addEventListener('click', cycleTime);
{
  const saved = (params.get('time') ?? store.get('time')) as TimeOfDay | null;
  if (saved && Object.hasOwn(TIME_LABEL, saved)) {
    world.setTimeOfDay(saved);
    setTimeLabel(saved);
    sfx.setMood(saved);
  }
}

// Som em três estados: música e efeitos ('1'), só efeitos ('sfx'), mudo ('0').
type SoundMode = '1' | 'sfx' | '0';
const SOUND: Record<SoundMode, { long: string; short: string; title: string }> = {
  '1': { long: 'Som', short: '♫', title: 'Som: música e efeitos (M liga ou desliga a música)' },
  sfx: { long: 'Efeitos', short: '♪', title: 'Som: só efeitos (M liga a música)' },
  '0': { long: 'Mudo', short: '✕', title: 'Som desligado' },
};
const soundBtn = document.getElementById('btn-sound')!;
let soundMode: SoundMode = 'sfx';
function setSound(m: SoundMode, save = true) {
  soundMode = m;
  sfx.setOutput(m !== '0', m === '1');
  soundBtn.setAttribute('aria-pressed', String(m !== '0'));
  soundBtn.title = SOUND[m].title;
  soundBtn.querySelector('.long')!.textContent = SOUND[m].long;
  soundBtn.querySelector('.short')!.textContent = SOUND[m].short;
  if (save) store.set('sound', m);
}
function toggleMusic() {
  setSound(soundMode === '1' ? 'sfx' : '1');
  hud.toast(soundMode === '1' ? 'Música ligada' : 'Música desligada');
}
soundBtn.addEventListener('click', () => {
  sfx.unlock();
  setSound(({ '1': 'sfx', sfx: '0', '0': '1' } as const)[soundMode]);
});
{
  const saved = store.get('sound');
  setSound(saved === '0' || saved === 'sfx' ? saved : '1', false);
}
document.addEventListener('visibilitychange', () => sfx.pause(document.hidden));

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

// ?timescale=0.05 desacelera o mundo (depuração de animações nas capturas por software).
const timeScale = THREE.MathUtils.clamp(Number(params.get('timescale')) || 1, 0.01, 4);

function step(now: number) {
  const realDt = (now - last) / 1000;
  const dt = Math.min(0.05, realDt) * timeScale;
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
  for (const st of game.board.sites) {
    if (st.found) continue;
    const s = screenOf(st.q, st.r, 0.05);
    markers.push({ id: 100000 + st.q * 1000 + st.r, x: s.x, y: s.y + 30, visible: s.visible, text: SITE_LABEL[st.kind].icon, color: '#8a6a3a', kind: st.kind });
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
    mode = modeById(saved.mode);
    resumed = newGame(saved.seed, saved.moves, saved.score, saved.undone);
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

// Dispara a onda do chão no foco da câmera, já com `age` segundos (capturas com ?timescale=0.01).
(window as unknown as { __celebrate: () => void }).__celebrate = () => {
  world.halo(world.rig.target.x, world.rig.target.z, 2);
  world.flushBirds(world.rig.target.x, world.rig.target.z);
};
(window as unknown as { __ripple: (age: number) => void }).__ripple = (age) => world.ripple(world.rig.target.x, world.rig.target.z, 1, age);

// Centraliza a câmera no Centro e o mostra numa era (0 a 3); com `age`, a onda dourada já com essa idade em segundos.
(window as unknown as { __era: (era: number, age?: number, zoom?: number) => void }).__era = (era, age, zoom) => {
  world.showEra(era, age ?? -1);
  world.rig.goal.set(0, 0, 0);
  world.rig.target.set(0, 0, 0);
  if (zoom) world.rig.dist = world.rig.goalDist = zoom;
};

// Centraliza a câmera no último marco de era erguido (capturas do marco).
(window as unknown as { __mark: (zoom?: number) => boolean }).__mark = (zoom) => {
  const p = game.board.list.filter((t) => t.eraMark !== undefined).pop();
  if (!p) return false;
  const { x, z } = hexToWorld(p.q, p.r);
  world.rig.goal.set(x, 0, z);
  world.rig.target.set(x, 0, z);
  if (zoom) world.rig.dist = world.rig.goalDist = zoom;
  return true;
};

// Centraliza a câmera num barco andando (capturas das esteiras na água).
(window as unknown as { __boat: (zoom?: number) => boolean }).__boat = (zoom) => {
  const b = world.life.boatPos();
  if (!b) return false;
  world.rig.goal.set(b.x, 0, b.z);
  world.rig.target.set(b.x, 0, b.z);
  if (zoom) world.rig.dist = world.rig.goalDist = zoom;
  return true;
};

// Coloca a peça atual na melhor posição, com animação (capturas da queda e da onda).
(window as unknown as { __placeBest: () => boolean }).__placeBest = () => {
  const m = game.bestMove();
  if (!m) return false;
  const { x, z } = hexToWorld(m.q, m.r);
  world.rig.goal.set(x, 0, z);
  world.rig.target.set(x, 0, z);
  while (game.rot !== m.rot) rotate(1);
  place(m.q, m.r);
  return true;
};

// Idem, escolhendo a jogada com mais interações (para ver as construções).
// Com `commit`, coloca a peça ali (capturas da obra subindo com andaime).
(window as unknown as { __ghostSynergy: (commit?: boolean) => number }).__ghostSynergy = (commit) => {
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
  if (commit) {
    world.rig.target.set(x, 0, z);
    place(best.q, best.r);
  }
  return best.n;
};

const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
hot?.snapshot?.(() => ({ ...snapshot(), theme: theme.id }));
if (hot?.ready) hot.ready(start);
else start(hot?.data);
