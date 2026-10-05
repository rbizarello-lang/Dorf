import * as THREE from 'three/webgpu';
import { Sfx } from './audio';
import { SEASON_KIND, SEASON_NAME, seasonAt } from './core/seasons';
import { DEFAULT_RULES, type PlaceResult, type Rules } from './core/board';
import { Game } from './core/game';
import { MODES, dailySeed, modeById, type Mode, type ModeId } from './core/modes';
import { LOOKOUT_MOVES, SITE_REWARD, type SiteKind } from './core/sites';
import { SPECIALS, SPECIAL_KINDS, type SpecialKind } from './core/specials';
import { mulberry32 } from './core/rng';
import { T } from './core/tiles';
import { DIRS, hexDistance, hexToWorld, hkey, unkey, worldToHex } from './core/hex';
import { previewRoutes, routeMarks, type RouteHit, type RouteMark } from './core/routes';
import type { Quality, TimeOfDay } from './render/world';
import { PITCH_MAX, PITCH_MIN } from './render/cameraRig';
import { DynRes } from './render/dynres';
import { readGpuInfo } from './render/gpu';
import { gpuName, tierForGpu } from './render/gpuTier';
import { FX_FLAGS } from './render/post';
import { U } from './render/materials';
import { World } from './render/world';
import { THEMES, themeById, type Theme } from './themes/themes';
import { withSafeColors } from './ui/a11y';
import { bannerSvg, dress, validBanner, validHouse, type Banner, type HouseColor } from './ui/banner';
import { Capture, VIDEO_QUALITIES } from './ui/capture';
import { Hud, TIME_ICON, TIME_LABEL, TIME_ORDER, glyph, questLabel, questMarker } from './ui/hud';
import { bindInput } from './ui/input';
import { MONUMENT_KINDS, MONUMENT_NAME, Progress, SPECIAL_NAME, UNLOCKS, type MonumentKind } from './ui/progress';
import { Tutorial } from './ui/tutorial';
import { blessingName, blessingRule, choiceHtml } from './ui/eraChoice';
import { Minimap, timelineSvg, type TurnNote } from './ui/minimap';
import './ui/style.css';

// ------------------------------------------------------------------ estado

type QualityMode = 'auto' | Quality;
/** q, r, giro e as escolhas de era (0 ou 1) feitas logo depois da jogada. */
type MoveRec = number[];
/** v11: a rota da Estrada Real dobrou de peso. Guarda a pontuação para conferir o replay. */
interface Save {
  v: 11;
  seed: number;
  rulesId: string;
  mode: ModeId;
  moves: MoveRec[];
  /** Quantas vezes já desfez nesta partida (o limite vem do modo). */
  undone: number;
  score: number;
  /** Peças especiais que entraram nesta partida (mudam a sequência da pilha). */
  specials: SpecialKind[];
}
const SAVE_VERSION = 11;
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

// Minimapa (proposta 16): o clique leva a câmera; M abre e fecha.
const minimap = new Minimap(document.getElementById('minimap')!, store, (x, z) => world.rig.goal.set(x, 0, z));

// Cor da casa e brasão (proposta 15): a cor troca o destaque do tema no HUD e no mundo.
let house = validHouse(store.get('house'));
let banner = (() => {
  try {
    return validBanner(JSON.parse(store.get('banner') ?? 'null'));
  } catch {
    return validBanner(null);
  }
})();
let theme: Theme = dress(themeById(params.get('theme') ?? store.get('theme')), house);
const a11yText = store.get('a11y-text');
const a11yCalm = store.get('a11y-calm');
const a11y = {
  text: a11yText === 's' || a11yText === 'l' ? a11yText : 'm',
  safe: store.get('a11y-safe') === '1',
  calm: a11yCalm === '1' || (a11yCalm !== '0' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)),
};

/** Tema como a tela mostra: com as cores seguras, quando a opção está ligada. */
function shownTheme(): Theme {
  return a11y.safe ? withSafeColors(theme) : theme;
}

function applyA11y() {
  if (a11y.text === 'm') delete document.documentElement.dataset.text;
  else document.documentElement.dataset.text = a11y.text;
  document.documentElement.classList.toggle('calm', a11y.calm);
  world.reducedMotion = a11y.calm;
  world.rig.snap = a11y.calm;
}

/** Vibração curta. Só chama se o navegador oferece (o iPhone não oferece). */
function buzz(ms: number) {
  const nav = navigator as Navigator & { vibrate?: (pattern: number) => boolean };
  if (typeof nav.vibrate !== 'function') return;
  try {
    nav.vibrate(ms);
  } catch {
    /* a função existe e a chamada é recusada */
  }
}

function showA11y() {
  hud.showModal(`<h2 id="modal-title">Acessibilidade</h2>
    <form class="a11y">
      <fieldset>
        <legend>Tamanho do texto</legend>
        <label><input type="radio" name="text" value="s"${a11y.text === 's' ? ' checked' : ''}> Menor</label>
        <label><input type="radio" name="text" value="m"${a11y.text === 'm' ? ' checked' : ''}> Normal</label>
        <label><input type="radio" name="text" value="l"${a11y.text === 'l' ? ' checked' : ''}> Maior</label>
      </fieldset>
      <label><input type="checkbox" name="safe"${a11y.safe ? ' checked' : ''}> Cores seguras para daltônicos</label>
      <p>As bordas passam a amarelo, verde-azulado, laranja, roxo, azul e cinza, no chão e nos ícones.</p>
      <label><input type="checkbox" name="calm"${a11y.calm ? ' checked' : ''}> Menos movimento</label>
      <p>A onda dourada, os voos da câmera, o bando de pássaros e o quique da peça param. O vento e a água continuam.</p>
      <button type="button" class="secondary">Fechar</button>
    </form>`);
  const form = hud.modalBody.querySelector('form')!;
  form.addEventListener('change', () => {
    const text = (form.querySelector('input[name="text"]:checked') as HTMLInputElement | null)?.value;
    a11y.text = text === 's' || text === 'l' ? text : 'm';
    a11y.safe = (form.querySelector('input[name="safe"]') as HTMLInputElement).checked;
    a11y.calm = (form.querySelector('input[name="calm"]') as HTMLInputElement).checked;
    store.set('a11y-text', a11y.text);
    store.set('a11y-safe', a11y.safe ? '1' : '0');
    store.set('a11y-calm', a11y.calm ? '1' : '0');
    applyA11y();
    const s = shownTheme();
    world.setTheme(s, game.board);
    hud.applyTheme(s);
    hud.renderQuests(game.board.quests, s);
    minimap.rebuild(game.board.list, s.terrainColors);
  });
  form.querySelector('button')!.addEventListener('click', () => hud.hideModal());
}
let rulesTheme: Theme = theme;
let game: Game;
let moves: MoveRec[] = [];
/** Pontuação, grupos e marcas de cada jogada, para o gráfico do fim da partida. */
let turns: TurnNote[] = [];
/** Mercados e portos já colocados (Estrada Real). Recalcula na jogada, não a cada quadro. */
let tradeMarks: RouteMark[] = [];
/** Rota que a peça da vez renderia na casa do fantasma. */
let routePeek: RouteHit[] = [];
let routePeekAt = '';
let rotSteps = 0;
let hover: { q: number; r: number } | null = null;
let scoutPending = false;
/** Recorde por modo e por tema (o Exploradores e o Clássico não disputam o mesmo número), com a semente. */
let best = 0;
let bestSeed = 0;
const bestKey = () => `best.${mode.id}.${rulesTheme.id}`;
function loadBest() {
  best = 0;
  bestSeed = 0;
  try {
    const v = JSON.parse(store.get(bestKey()) ?? 'null') as unknown;
    if (v && typeof v === 'object' && Number.isSafeInteger((v as { score: unknown }).score) && Number.isSafeInteger((v as { seed: unknown }).seed)) {
      best = Math.max(0, (v as { score: number }).score);
      bestSeed = (v as { seed: number }).seed;
    }
  } catch {
    // valor salvo corrompido: começa sem recorde
  }
}
const QUALITIES: QualityMode[] = ['auto', 'cinema', 'ultra', 'high', 'medium', 'low'];
const pickQ = (v: string | null) => (v && (QUALITIES as string[]).includes(v) ? (v as QualityMode) : null);
let qualityMode: QualityMode = pickQ(params.get('quality')) ?? pickQ(store.get('quality')) ?? 'auto';
let gameOverShown = false;
let overTimer = 0;
let bestAtStart = 0;
let recordCheered = false;
const special = params.has('stress') || params.has('auto') || params.has('demo');
const tutorial = new Tutorial(store);
tutorial.enabled = !special;
const progress = new Progress(store, THEMES.map((t) => t.id));
/** A partida atual já entrou no progresso (ao acabar ou ao ser trocada por outra). */
let committed = false;
// ?specials=station.watermill.lighthouse (ou all) põe peças especiais na partida sem liberá-las (capturas).
const forcedSpecials: SpecialKind[] | null = params.has('specials') ? (params.get('specials') === 'all' ? [...SPECIAL_KINDS] : SPECIAL_KINDS.filter((k) => params.get('specials')!.split('.').includes(k))) : null;

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

const siteReward = (kind: SiteKind) => {
  const r = SITE_REWARD[kind];
  return [r.points ? `+${r.points} pontos` : '', r.tiles ? `+${r.tiles} peça${r.tiles > 1 ? 's' : ''}` : '', kind === 'lookout' ? `próximas peças à vista por ${LOOKOUT_MOVES} jogadas` : ''].filter(Boolean).join(' · ');
};

// ------------------------------------------------------------------ partida

/**
 * Começa uma partida; com `replay`, refaz as jogadas salvas. Devolve false (sem mexer
 * na tela) se o replay não reproduz a partida salva, por exemplo depois de uma
 * atualização do gerador de peças.
 */
const synTimers: number[] = [];

function newGame(seed = mode.daily ? dailySeed() : 1 + Math.floor(Math.random() * 1e9), replay: MoveRec[] = [], expectScore?: number, undos = 0, specials?: readonly SpecialKind[]): boolean {
  // A gravação vale para uma partida só (desfazer refaz a partida pelo replay).
  if (capture.take) capture.stopTake('A gravação terminou aqui: o vídeo não acompanha o desfazer nem uma partida nova.');
  clearTimeout(overTimer);
  for (const t of synTimers.splice(0)) clearTimeout(t);
  // Peças especiais: as liberadas entram em toda partida nova, menos no Desafio do dia (igual para todos).
  game = new Game(seed, rulesFor(rulesTheme), specials ?? forcedSpecials ?? (mode.daily ? [] : progress.unlocked));
  // Partida nova (não um replay do desfazer ou do save): ainda não entrou no progresso.
  if (!replay.length) committed = false;
  undone = undos;
  moves = [];
  turns = [];
  for (const [q, r, rot, ...picks] of replay) {
    game.rot = rot;
    const res = game.place(q, r);
    if (!res) break;
    for (const p of picks) game.choose(p);
    moves.push([q, r, rot, ...picks]);
    noteTurn(res);
    while (game.discardIfStuck());
  }
  game.rot = 0;
  if (moves.length !== replay.length || (expectScore !== undefined && game.board.score !== expectScore)) return false;
  rotSteps = 0;
  hover = null;
  gameOverShown = false;
  loadBest();
  bestAtStart = best;
  recordCheered = false;
  hud.hint.style.opacity = moves.length >= 6 ? '0' : '';
  world.dropGhost();
  world.setTheme(shownTheme(), game.board);
  world.setMonuments(progress.monuments);
  sfx.setStyle(theme.music, game.board.era);
  hud.applyTheme(shownTheme());
  showCrest();
  hud.renderQuests(game.board.quests, shownTheme());
  refreshTradeMarks();
  minimap.rebuild(game.board.list, shownTheme().terrainColors);
  frameCamera(true);
  // Partida nova: o batedor mostra para onde fica o sítio mais perto (quando a ajuda fechar).
  scoutPending = !replay.length;
  if (!replay.length)
    tutorial.offer(
      'inicio',
      'Monte a paisagem',
      `Coloque a peça encostada no mapa: cada borda igual à vizinha vale ${game.rules.matchPoints} pontos. Gire com <kbd>R</kbd> ou o botão direito (no toque, os botões de girar). A partida acaba quando a pilha esvazia.`,
    );
  if (!replay.length && game.rules.routes)
    tutorial.offer(
      'rotas',
      'Estrada Real',
      'As etiquetas marcam mercados e portos. Ligar dois da mesma rede rende pela distância, uma vez: 2 casas valem 22, 4 valem 54 e 6 valem 96 e devolvem uma peça. A prévia mostra o valor antes de colocar.',
    );
  refreshHud(true);
  persist();
  if (game.over) scheduleGameOver();
  return true;
}

function persist() {
  if (special) return;
  if (game.over) store.set('save', null);
  else store.set('save', JSON.stringify(snapshot()));
}

function snapshot(): Save {
  return { v: SAVE_VERSION, seed: game.seed, rulesId: rulesTheme.id, mode: mode.id, moves, undone, score: game.board.score, specials: [...game.specials] };
}

/** Aceita só saves completos e da versão atual; qualquer outra coisa é descartada. */
function validSave(raw: unknown): Save | null {
  const s = raw as Partial<Save> | null;
  const okMove = (m: unknown) => Array.isArray(m) && m.length >= 3 && m.length <= 6 && m.every(Number.isInteger) && m[2] >= 0 && m[2] < 6 && m.slice(3).every((p) => p === 0 || p === 1);
  if (s && s.v === SAVE_VERSION && Number.isInteger(s.seed) && s.seed! > 0 && typeof s.rulesId === 'string' && MODES.some((m) => m.id === s.mode) && Number.isInteger(s.undone) && s.undone! >= 0 && Array.isArray(s.moves) && s.moves.every(okMove) && Number.isFinite(s.score) && Array.isArray(s.specials) && s.specials.every((k) => SPECIAL_KINDS.includes(k))) return s as Save;
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
  commitProgress();
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
  if (!newGame(game.seed, keep, undefined, undone + 1, game.specials)) return;
  sfx.undo();
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
  const season = SEASON_NAME[seasonAt(Math.max(0, b.list.length - 2), game.rules.seasonLock)];
  hud.setEra(es.length > 1 ? `Era ${['I', 'II', 'III', 'IV', 'V', 'VI'][b.era] ?? b.era + 1} · ${eraName(b.era)} · ${season} · ${mode.name}` : `${mode.name} · ${season}`, nextAt === undefined ? null : Math.min(1, (b.score - es[b.era]) / (nextAt - es[b.era])));
  hud.setUndo(Math.min(mode.undos - undone, moves.length ? 99 : 0));
  // Com 1 peça na pilha, a "próxima" só entraria se a jogada render peças: não mostra.
  hud.renderNext(game.stack <= 1 && !game.rules.infinite ? null : game.next, theme, game.board.lookout > 0 ? game.upcoming(3) : []);
  world.setPreview(game.current, rotSteps * (Math.PI / 3), game.stack);
  showInfluence();
  updateGhost();
  if (game.current?.edges.some((e) => e === T.Water || e === T.Rail))
    tutorial.offer('estrito', `${theme.terrainNames[T.Water]} e ${theme.terrainNames[T.Rail]}`, `Estas bordas precisam continuar: só encostam nelas mesmas. Uma borda de ${theme.terrainNames[T.Water].toLowerCase()} não pode encostar num ${theme.terrainNames[T.Grass].toLowerCase()}, por exemplo.`);
}

/** Casas da fronteira onde a peça da vez aproveita a influência de construções (não depende do giro). */
function showInfluence() {
  const cur = game.current;
  const cells: [number, number][] = [];
  if (cur && game.rules.influence) for (const k of game.board.frontier) {
    const [q, r] = unkey(k);
    if (game.board.influenceAt(q, r, cur.edges).points > 0) cells.push([q, r]);
  }
  world.setInfluence(cells);
  if (cells.length) tutorial.offer('influencia', 'Influência', `As casas com contorno dourado ficam perto de construções de interação: uma peça ali ganha pontos por setor do terreno que elas trabalham (${theme.synergy.mill.toLowerCase()} com ${theme.terrainNames[T.Field].toLowerCase()}, ${theme.synergy.lumber.toLowerCase()} com ${theme.terrainNames[T.Forest].toLowerCase()}...). O valor cresce com a era.`);
}

function updateGhost() {
  if (!game.current || !hover || !game.board.frontier.has(hkey(hover.q, hover.r)) || hud.modalOpen || capture.stage !== 'play') {
    world.clearGhost();
    routePeek = [];
    routePeekAt = '';
    hud.confirm.hidden = true;
    capture.take?.event({ kind: 'noghost' });
    return;
  }
  const check = game.check(hover.q, hover.r)!;
  world.setGhost(game.current, game.rot, rotSteps * (Math.PI / 3), hover.q, hover.r, check);
  capture.take?.event({ kind: 'ghost', q: hover.q, r: hover.r, rot: game.rot, angle: rotSteps * (Math.PI / 3) });
  refreshRoutePeek();
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
  lastInput = performance.now();
  if (!game.current || hud.modalOpen) return;
  // A escolha de era fica na mesa até a vila escolher: a próxima peça espera.
  if (game.offers.length) {
    showChoice();
    return;
  }
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
  buzz(res.perfect ? 20 : 12);
  moves.push([q, r, rot]);
  noteTurn(res);
  refreshTradeMarks();
  minimap.add(res.placed);
  capture.take?.event({ kind: 'place', q, r, rot });
  world.placeAnimated(res.placed);
  world.updateFrontier(game.board);
  rotSteps = 0;
  hud.confirm.hidden = true;
  announce(res);
  if (!special) {
    for (const k of progress.unlockLive(game.board)) unlockedToast(k);
    const wonder = game.board.wonder;
    const fresh = progress.unlockMonuments(game.board, !!wonder && wonder.stage >= game.rules.wonderStages);
    if (fresh.length) {
      world.setMonuments(progress.monuments);
      for (const k of fresh) monumentToast(k);
    }
  }
  let discarded = 0;
  while (game.discardIfStuck()) discarded++;
  if (discarded) hud.toast(discarded === 1 ? 'Uma peça não cabia em lugar nenhum e foi descartada.' : `${discarded} peças sem encaixe foram descartadas.`, 'bad');
  const sp = game.current?.special;
  if (sp) {
    hud.toast(`Peça especial: ${SPECIAL_NAME[sp]}. ${specialRule(sp)}`, 'good');
    tutorial.offer('especial', 'Peça especial', `${SPECIAL_NAME[sp]}: ${specialRule(sp).toLowerCase()} As peças especiais são liberadas jogando e entram duas vezes em cada partida.`);
  }
  if (game.board.score > best) {
    best = game.board.score;
    bestSeed = game.seed;
    if (!special) store.set(bestKey(), JSON.stringify({ score: best, seed: bestSeed }));
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
  if (res.eraUp !== null && game.offers.length && !game.over) {
    clearTimeout(choiceTimer);
    // Primeiro a onda dourada e a fanfarra, depois as cartas.
    choiceTimer = window.setTimeout(() => !hud.modalOpen && showChoice(), 1500);
  }
  scheduleGameOver();
}

let choiceTimer = 0;

/** As duas cartas da escolha de era mais antiga ainda na mesa. */
function showChoice() {
  const offer = game.offers[0];
  if (!offer || game.over) return;
  clearTimeout(choiceTimer);
  // A era da carta: a atual menos as escolhas que ainda vêm depois desta.
  hud.showModal(choiceHtml(offer, `Era ${eraName(game.board.era - game.offers.length + 1)}`, theme));
}

/** Escolhe a carta 0 ou 1; a escolha fica gravada junto da última jogada (replay e desfazer). */
function chooseBlessing(pick: number) {
  if (!game.offers.length || !moves.length) return false;
  const id = game.choose(pick)!;
  moves[moves.length - 1].push(pick);
  capture.take?.event({ kind: 'choose', pick });
  hud.hideModal();
  sfx.quest();
  hud.toast(`${blessingName(id, theme)}: ${blessingRule(id, theme)}`, 'good');
  refreshHud();
  persist();
  if (game.offers.length) showChoice();
  return true;
}

/** Dicas das primeiras partidas, conforme o que a jogada fez acontecer. */
function offerTips(res: PlaceResult) {
  const R = game.rules;
  if (res.perfect) tutorial.offer('perfeito', 'Encaixe perfeito', `Todas as bordas que encostam em vizinhas combinaram: +${R.perfectBonus}. Cercar uma peça com 6 vizinhas encaixadas devolve uma peça à pilha.`);
  if (res.newQuest)
    tutorial.offer('missao', 'Nova missão', `${questLabel(res.newQuest, theme)}: cumprida, rende +${res.newQuest.reward} peças. Peças com "!" trazem missões; as ativas ficam no canto e com um estandarte no mapa.`);
  if (res.synergies.length) tutorial.offer('interacao', 'Interação', `Bordas diferentes que "conversam" também pontuam (+${R.synergyPoints}) e erguem uma construção. A prévia acende em dourado antes de colocar.`);
  if (res.site) tutorial.offer('sitio', 'Sítio descoberto', 'Os carimbos no mapa escondem ruínas (pontos), tesouros (peças), relíquias (os dois) e mirantes (mostram as próximas peças). Coloque uma peça em cima para descobrir.');
  if (res.eraUp !== null) tutorial.offer('era', 'Nova era', `A vila mudou de era e ganhou +${R.eraTiles} peças. O Centro mudou de forma, e a próxima peça com vila ergue o marco da era.`);
  if (res.wonder?.started) tutorial.offer('maravilha', 'Maravilha', `Esta peça virou o canteiro da maravilha. Cada peça colocada depois avança uma etapa; pronta, rende +${R.wonderPoints} pontos e +${R.wonderTiles} peças.`);
  if (!R.infinite && game.stack > 0 && game.stack <= 10) tutorial.offer('pilha', 'Pilha acabando', 'Missões, peças cercadas, sítios e eras devolvem peças à pilha. Vale mirar a missão mais perto de terminar.');
}

/** O que a peça especial rende, em uma frase (os nomes dos terrenos vêm do tema). */
function specialRule(k: SpecialKind) {
  const s = SPECIALS[k];
  const near = s.radius === 1 ? 'vizinha' : `a até ${s.radius} casas`;
  return `Vale +${s.per} por peça ${near} com ${theme.terrainNames[s.terrain].toLowerCase()}${s.tiles ? ` e +${s.tiles} peça${s.tiles > 1 ? 's' : ''}` : ''}${s.lookout ? ` e mostra as próximas peças por ${s.lookout} jogadas` : ''}.`;
}

function unlockedToast(k: SpecialKind) {
  hud.toast(`Peça especial liberada: ${SPECIAL_NAME[k]}! Entra na pilha a partir da próxima partida.`, 'good');
  sfx.quest();
}

function monumentToast(k: MonumentKind) {
  hud.toast(`Monumento na praça do Centro: ${MONUMENT_NAME[k]}.`, 'good');
  sfx.quest();
}

/** Soma a partida ao progresso uma vez: ao acabar, ou ao ser trocada por outra depois de 5 jogadas. */
function commitProgress() {
  if (special || committed || (!game.over && moves.length < 5)) return;
  committed = true;
  const w = game.board.wonder;
  for (const k of progress.commit(game.board, rulesTheme.id, !!w && w.stage >= game.rules.wonderStages)) unlockedToast(k);
}

/** Fim de partida: as peças especiais que faltam liberar e quanto falta para cada uma. */
function specialsLine() {
  const left = progress.pending(null);
  if (!left.length) return `<p class="muted">Todas as peças especiais liberadas: ${progress.unlocked.map((k) => SPECIAL_NAME[k]).join(', ')}.</p>`;
  return `<p class="muted">Peças especiais a liberar: ${left.map((n) => `<b>${SPECIAL_NAME[n.kind]}</b> ${n.have} de ${n.need} ${n.label}`).join(' · ')}.</p>`;
}

/** Anota a jogada para o gráfico do fim: pontos, maior grupo e o que aconteceu. */
function noteTurn(res: PlaceResult, score = game.board.score, groups = game.board.largestGroups()) {
  const w = res.wonder;
  turns.push({
    score,
    groups,
    era: res.eraUp,
    quests: res.questsDone.length,
    wonder: w?.done ? 'done' : w?.started ? 'start' : null,
  });
}

/** Se alguma jogada não foi anotada, refaz o gráfico pelo replay antes de abrir o placar. */
function ensureTurns() {
  if (turns.length || !moves.length) return;
  const g = new Game(game.seed, game.rules, game.specials);
  for (const [q, r, rot, ...picks] of moves) {
    g.rot = rot;
    const res = g.place(q, r);
    if (!res) break;
    for (const p of picks) g.choose(p);
    noteTurn(res, g.board.score, g.board.largestGroups());
    while (g.discardIfStuck());
  }
}

/** Placar final em qualquer fim: peça à mão, descarte da última ou preenchimento automático. */
function scheduleGameOver() {
  if (!game.over || gameOverShown) return;
  gameOverShown = true;
  commitProgress();
  overTimer = window.setTimeout(() => {
    if (!game.over) return;
    // A câmera recua devagar até mostrar o mapa inteiro antes do placar final.
    frameCamera(false);
    overTimer = window.setTimeout(() => {
      if (game.over) showGameOver();
    }, 900);
  }, 1100);
}

function routeLabel(h: RouteHit) {
  const name = h.kind === 'market' ? 'Mercado' : 'Porto';
  return `${name}: ${h.d} casas, +${h.points}${h.tiles ? ' e +1 peça' : ''}`;
}

function refreshTradeMarks() {
  tradeMarks = routeMarks(game.board);
}

/** Prévia da rota na casa do fantasma. Só recalcula quando a casa ou o giro mudam. */
function refreshRoutePeek() {
  if (!game.rules.routes || !hover || !game.current) {
    routePeek = [];
    routePeekAt = '';
    return;
  }
  const key = `${hover.q}:${hover.r}:${game.rot}`;
  if (key === routePeekAt) return;
  routePeekAt = key;
  const edges = game.currentEdges();
  const check = edges ? game.check(hover.q, hover.r) : null;
  routePeek = edges && check?.valid ? previewRoutes(game.board, hover.q, hover.r, edges, game.current.special) : [];
}

function announce(res: PlaceResult) {
  const s = screenOf(res.placed.q, res.placed.r);
  world.placeFx(res);
  offerTips(res);
  sfx.place(res.matches);
  const e = res.placed.edges;
  sfx.land({ water: e.includes(T.Water), forest: e.includes(T.Forest), rail: e.includes(T.Rail) });
  if (res.points > 0) {
    hud.floater(s.x, s.y - 10, `+${res.points}`, res.perfect ? 'big' : '');
    hud.bumpScore(res.perfect || res.synergies.length ? 'big' : '');
  }
  if (res.perfect) {
    sfx.perfect();
    hud.floater(s.x, s.y - 46, 'Perfeito!', 'big');
  }
  res.routes.forEach((rt, i) => {
    hud.toast(`${rt.kind === 'market' ? 'Rota de mercado' : 'Rota de porto'}: ${rt.d} casas, +${rt.points}${rt.tiles ? ' e +1 peça' : ''}.`, 'good');
    hud.floater(s.x, s.y - (res.perfect ? 78 : 46) - i * 28, routeLabel(rt), 'route');
  });
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
  if (res.placed.eraMark !== undefined) hud.toast(`Marco da era erguido: ${eraName(res.placed.eraMark)}`, 'good');
  for (const t of res.closed) {
    const p = screenOf(t.q, t.r);
    hud.floater(p.x, p.y - 20, '+1 peça', 'tiles');
  }
  for (const q of res.questsDone) {
    sfx.quest();
    hud.toast(`Missão cumprida: ${questLabel(q, theme)} · +${q.reward} peças`, 'good');
  }
  for (const q of res.questsFailed) {
    sfx.fail();
    hud.toast(`Missão perdida: ${questLabel(q, theme)} (passou de ${q.target})`, 'bad');
  }
  if (res.newQuest) hud.toast(`Nova missão: ${questLabel(res.newQuest, theme)}`);
  if (res.site) {
    hud.toast(`${SITE_LABEL[res.site.kind].name} descoberta: ${siteReward(res.site.kind)}`, 'good');
    sfx.discover();
  }
  if (res.eraUp !== null) {
    hud.toast(`Nova era: ${eraName(res.eraUp)} · +${game.rules.eraTiles} peças · a próxima vila ergue o marco`, 'good');
    sfx.eraFanfare(res.eraUp);
    sfx.hammer(0.45);
    const el = document.getElementById('era')!;
    el.classList.remove('up');
    void el.offsetWidth;
    el.classList.add('up');
  }
  if (res.wonder?.started) {
    hud.toast(`Canteiro da maravilha: ${theme.wonder?.name ?? 'Maravilha'}. Cada peça colocada avança uma etapa (${game.rules.wonderStages} no total)`, 'good');
    sfx.hammer(0.2);
  } else if (res.wonder?.done) {
    hud.toast(`${theme.wonder?.name ?? 'Maravilha'} concluída: +${game.rules.wonderPoints} pontos · +${game.rules.wonderTiles} peças · P para a foto`, 'good');
    sfx.eraFanfare(game.board.era);
  } else if (res.wonder) sfx.hammer(0.4);
  if (res.special) {
    const sp = res.special;
    hud.toast(`${SPECIAL_NAME[sp.kind]}: ${sp.count} ${sp.count === 1 ? 'peça' : 'peças'} com ${theme.terrainNames[SPECIALS[sp.kind].terrain].toLowerCase()} por perto · +${sp.points} pontos${sp.tiles ? ` · +${sp.tiles} peça${sp.tiles > 1 ? 's' : ''}` : ''}${SPECIALS[sp.kind].lookout ? ` · próximas peças à vista por ${SPECIALS[sp.kind].lookout} jogadas` : ''}`, 'good');
    sfx.special(sp.kind);
  }
  if (res.leftoverBonus) hud.toast(`Todos os sítios achados! Peças que sobraram: +${res.leftoverBonus} pontos`, 'good');
  if (game.rules.seasonBonus && theme.season === undefined && game.rules.seasonLock === undefined && res.placed.index > 1 && (res.placed.index - 1) % 20 === 0) {
    const s = seasonAt(res.placed.index - 1);
    hud.toast(`${SEASON_NAME[s]}: ${theme.synergy[SEASON_KIND[s]]} rende +3.`, 'good');
  }
  hud.renderQuests(game.board.quests, shownTheme());
}

// ------------------------------------------------------------------ telas

/** Ajuda em abas: o básico primeiro, o resto por assunto. */
function showHelp(tab = 'basico') {
  const R = game.rules;
  const legend = theme.terrainNames.map((n, i) => `<span><i style="background:${shownTheme().terrainColors[i]}">${glyph(`t${i}`, shownTheme().terrainColors[i])}</i>${n}</span>`).join('');
  const wonder = R.wonderStages > 0 && R.eraScores.length > 1;
  const tabs: [string, string, string][] = [
    [
      'basico',
      'Básico',
      `<p>Monte uma paisagem peça por peça. Cada borda que combina com a vizinha vale ${R.matchPoints} pontos.</p>
      <div class="legend">${legend}</div>
      <ul>
        <li><b>${theme.terrainNames[4]}</b> e <b>${theme.terrainNames[5]}</b> precisam continuar: só encostam neles mesmos.</li>
        <li><b>Encaixe perfeito</b>: a peça encosta em 2 ou mais vizinhas e todas as bordas combinam (+${R.perfectBonus}).</li>
        <li>Cercar uma peça com 6 vizinhas encaixadas rende <b>+${R.closedTiles} peça</b>.</li>
        <li>A cada 20 jogadas a estação muda (primavera, verão, outono, inverno) e uma interação rende +3: colmeias, moinho, serraria e pasto, nessa ordem.</li>
        ${R.routes ? `<li><b>Estrada Real</b>: mercados e portos da mesma rede rendem pela distância, uma vez. 2 casas valem 22, 4 valem 54 e 6 valem 96 e devolvem uma peça. A etiqueta marca cada um no mapa, e a prévia mostra o valor antes de colocar.</li>` : ''}
        <li>A partida acaba quando a pilha esvazia. <kbd>U</kbd> desfaz a última jogada (o número de vezes depende do modo).</li>
      </ul>`,
    ],
    [
      'missoes',
      'Missões',
      `<p>Peças marcadas com "!" trazem uma missão. Cumprida, ela devolve peças à pilha.</p>
      <ul>
        <li><b>Grupo</b>: o terreno chegar a N peças. "Exatamente N" falha se passar.</li>
        <li><b>Fechar</b>: nenhuma borda do grupo virada para o vazio.</li>
        <li><b>Encaixes perfeitos</b>: N encaixes perfeitos a partir dali.</li>
        <li><b>Interação</b>: N interações daquele tipo a partir dali.</li>
      </ul>
      <p><b>Interações</b>: bordas diferentes que se encostam também contam (+${R.synergyPoints}) e erguem construções. A borda acende em dourado.</p>
      <div class="synergies">${synergyLegend()}</div>`,
    ],
    [
      'eras',
      'Eras',
      `<ul>
        <li>Com ${R.eraScores.slice(1).map((v) => v.toLocaleString('pt-BR')).join(', ')} pontos a vila muda de era e ganha +${R.eraTiles} peças. O Centro, no meio da primeira peça, muda de forma, as casas mudam de estilo, e a próxima peça com vila ergue o marco da era.</li>
        ${R.influence ? `<li><b>Influência</b>: cada interação marca as casas em volta da peça dela, com contorno dourado. Uma peça colocada ali ganha pontos por setor do terreno que a construção trabalha (até +8), e o valor cresce com a era.</li>` : ''}
        ${R.blessings ? `<li><b>Escolha da era</b>: a cada era nova a vila escolhe 1 de 2 cartas (teclas <kbd>1</kbd> e <kbd>2</kbd>), como ${blessingName('mill', theme)} ou ${blessingName('surveyors', theme)}. A carta vale até o fim da partida.</li>` : ''}
        ${wonder ? `<li><b>Maravilha</b>: na última era, a próxima peça com 2 ou mais bordas de vila vira o canteiro da maravilha do tema. Cada peça colocada depois avança uma etapa, e as ${R.wonderStages} etapas rendem +${R.wonderPoints} pontos e +${R.wonderTiles} peças.</li>` : ''}
        <li><b>Peças especiais</b>: ${SPECIAL_KINDS.map((k) => `${SPECIAL_NAME[k]} (${specialRule(k).toLowerCase().replace(/\.$/, '')}; libera com ${UNLOCKS[k].need} ${UNLOCKS[k].label})`).join('; ')}. Liberadas, entram duas vezes em cada partida, menos no Desafio do dia.</li>
        <li><b>Sítios</b>: carimbos no mapa marcam ruínas (pontos), tesouros (peças), relíquias (os dois) e mirantes (mostram as próximas peças). Coloque uma peça em cima para descobrir.</li>
      </ul>`,
    ],
    ['almanaque', 'Almanaque', almanac()],
    [
      'controles',
      'Controles',
      `<ul>
        <li>Mouse: clique coloca, botão direito ou <kbd>R</kbd> gira a peça, arrastar move, roda dá zoom, <kbd>Q</kbd>/<kbd>E</kbd> giram a câmera.</li>
        <li>Inclinar a câmera: arrastar com o botão direito para cima ou para baixo, ou <kbd>PgUp</kbd>/<kbd>PgDn</kbd>; <kbd>Home</kbd> volta ao ângulo padrão. No toque, dois dedos para cima ou para baixo. Torcer os dois dedos gira a câmera.</li>
        <li>Toque: toque num espaço para ver a peça, toque de novo (ou ✓) para colocar. No celular o topo fica com o tema, o desfazer e o menu ⋯, e as missões cabem num botão.</li>
        <li>O botão Aa (no ⋯, no celular) abre o tamanho do texto, as cores para daltônicos e o menos movimento.</li>
        <li>O botão de som alterna entre música e efeitos, só efeitos e mudo.</li>
        <li><kbd>M</kbd> abre ou fecha o minimapa. Um clique ou toque nele leva a câmera até ali. No celular ele começa fechado.</li>
        <li>O botão Câmera tira fotos sem a interface (<kbd>P</kbd>) e grava vídeos de até 2 minutos (<kbd>V</kbd>), salvos em MP4 de até 4K.</li>
      </ul>`,
    ],
  ];
  const pick = tabs.some(([id]) => id === tab) ? tab : 'basico';
  hud.showModal(`
    <h2 id="modal-title">Retalhos</h2>
    <div class="tabs" role="tablist">${tabs.map(([id, name]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === pick}">${name}</button>`).join('')}</div>
    ${tabs.map(([id, , html]) => `<section class="tab" data-tab="${id}"${id === pick ? '' : ' hidden'}>${html}</section>`).join('')}
    <div class="row"><button class="primary" type="button" data-act="close">Jogar</button><button class="secondary" type="button" data-act="tips">Rever as dicas</button></div>`);
}

/** Maior recorde do tema entre os modos (cada modo guarda o seu). */
function themeBest(id: string) {
  let top = 0;
  for (const m of MODES) {
    try {
      const v = JSON.parse(store.get(`best.${m.id}.${id}`) ?? 'null') as { score?: unknown } | null;
      if (v && Number.isSafeInteger(v.score)) top = Math.max(top, v.score as number);
    } catch {
      // valor corrompido: ignora
    }
  }
  return top;
}

/** Almanaque: o que já se fez em todas as partidas, lido do progresso guardado no navegador. */
function almanac() {
  const d = progress.data;
  const t = d.totals;
  const n = (v: number) => v.toLocaleString('pt-BR');
  const cell = (v: number, label: string) => `<div><b>${n(v)}</b><span>${label}</span></div>`;
  const left = new Map(progress.pending(special ? null : game.board).map((p) => [p.kind, p]));
  const specials = SPECIAL_KINDS.map((k) => {
    const p = left.get(k);
    return p
      ? `<li class="locked"><b>${SPECIAL_NAME[k]}</b>: presa, ${p.have} de ${p.need} ${p.label}.</li>`
      : `<li><b>${SPECIAL_NAME[k]}</b>: liberada, colocada ${n(d.specialsPlaced[k])} ${d.specialsPlaced[k] === 1 ? 'vez' : 'vezes'}. ${specialRule(k)}</li>`;
  }).join('');
  const sites = (Object.keys(SITE_LABEL) as SiteKind[]).map((k) => `<span><i>${SITE_LABEL[k].icon}</i>${SITE_LABEL[k].name} <b>${n(d.siteKinds[k])}</b></span>`).join('');
  const rows = THEMES.map((th) => {
    const r = d.themes[th.id];
    const top = themeBest(th.id);
    if (!r && !top) return `<tr class="locked"><td>${th.name}</td><td colspan="3" class="none">ainda não jogado</td></tr>`;
    const era = (th.eras ?? ERA_NAMES)[r?.era ?? 0] ?? ERA_NAMES[0];
    const wonder = r?.wonder ? ` · ${th.wonder?.name ?? 'maravilha'}` : '';
    return `<tr><td>${th.name}</td><td>${n(r?.games ?? 0)}</td><td>${era}${wonder}</td><td>${top ? n(top) : '–'}</td></tr>`;
  }).join('');
  return `<p class="muted">Tudo o que você já fez, somado entre as partidas (a atual entra quando acaba).</p>
    <div class="final small">${cell(t.games, 'partidas')}${cell(t.tiles, 'peças')}${cell(t.quests, 'missões')}${cell(t.synergies, 'interações')}${cell(t.perfects, 'perfeitos')}${cell(t.wonders, 'maravilhas')}</div>
    <h3>Sítios descobertos</h3>
    <div class="legend sites">${sites}</div>
    <h3>Peças especiais</h3>
    <ul class="almanac-specials">${specials}</ul>
    <h3>Monumentos da praça</h3>
    <ul class="almanac-specials">${MONUMENT_KINDS.map((k) => {
      const on = d.monuments.includes(k);
      const how = k === 'log' ? '10 serrarias numa partida' : k === 'statue' ? 'a primeira maravilha' : '20 relíquias no total';
      return on ? `<li><b>${MONUMENT_NAME[k]}</b>: na praça do Centro.</li>` : `<li class="locked"><b>${MONUMENT_NAME[k]}</b>: preso, ${how}.</li>`;
    }).join('')}</ul>
    <h3>Temas</h3>
    <table class="almanac"><thead><tr><th>Tema</th><th>Partidas</th><th>Maior era</th><th>Recorde</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function synergyLegend() {
  const T4 = theme.terrainNames;
  const C = shownTheme().terrainColors;
  const row = (a: number, b: number, name: string) => `<span><i style="background:${C[a]}"></i><i style="background:${C[b]}"></i>${T4[a]} + ${T4[b]} = <b>${name}</b></span>`;
  return [row(3, 1, theme.synergy.lumber), row(3, 2, theme.synergy.mill), row(3, 0, theme.synergy.pasture), row(2, 0, theme.synergy.apiary)].join('');
}

function showGameOver() {
  ensureTurns();
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
    ${timelineSvg(turns, shownTheme().terrainColors, theme.ui.accent, theme.terrainNames)}
    <p class="muted">Era ${eraName(b.era)}, ${b.sites.filter((x) => x.found).length} de ${b.sites.length} sítios, ${b.perfects} encaixes perfeitos, ${Object.values(b.synergyCount).reduce((a, c) => a + c, 0)} interações.</p>
    ${b.blessings.length ? `<p class="muted">Cartas da vila: ${b.blessings.map((id) => blessingName(id, theme)).join(', ')}.</p>` : ''}
    <p class="muted">Recorde em ${mode.name} · ${rulesTheme.name}: ${best.toLocaleString('pt-BR')} pontos (semente ${bestSeed}).</p>
    ${special ? '' : specialsLine()}
    <div class="row">
      <button class="primary" type="button" data-act="new">Jogar de novo</button>
      ${mode.daily ? '' : `<button class="secondary" type="button" data-act="replay-seed">Repetir a semente</button>`}
      <button class="secondary" type="button" data-act="theme">Trocar tema</button>
      ${special ? '' : `<button class="secondary" type="button" data-act="almanac">Almanaque</button>`}
    </div>
    ${moves.length ? `<div class="row"><button class="secondary" type="button" data-act="film">Gravar o filme da partida</button></div>` : ''}`);
  if (record) hud.modalBody.querySelector('h2')!.classList.add('record');
  sfx.gameOver(record);
  hud.countUp(hud.modalBody.querySelector<HTMLElement>('[data-count]')!, b.score);
}

hud.modal.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  const act = btn?.dataset.act;
  if (btn?.dataset.tab) {
    // Abas da ajuda: troca a seção visível sem refazer o modal.
    for (const el of hud.modalBody.querySelectorAll<HTMLElement>('[data-tab]')) {
      const on = el.dataset.tab === btn.dataset.tab;
      if (el.tagName === 'SECTION') el.hidden = !on;
      else el.setAttribute('aria-selected', String(on));
    }
    return;
  }
  if (act === 'bless') {
    chooseBlessing(Number(btn?.dataset.pick));
    return;
  }
  if (act === 'film') {
    // O diálogo de exportação toma o lugar do placar final.
    capture.showExportDialog('film');
    return;
  }
  if (act === 'almanac') {
    showHelp('almanaque');
    return;
  }
  if (act === 'tips') {
    tutorial.reset();
    hud.hideModal();
    store.set('seenHelp', '1');
    hud.toast('As dicas voltam a aparecer conforme você joga.');
    return;
  }
  // A escolha de era não fecha clicando fora: fica para a próxima peça.
  if (e.target === hud.modal && game.offers.length && hud.modalBody.querySelector('.blessings')) return;
  if (e.target === hud.modal || act === 'close') {
    hud.hideModal();
    store.set('seenHelp', '1');
  } else if (act === 'new') {
    hud.hideModal();
    startFresh();
  } else if (act === 'replay-seed') {
    // A mesma sequência de peças, para tentar de novo com o que se aprendeu.
    hud.hideModal();
    commitProgress();
    const seed = game.seed;
    rulesTheme = theme;
    newGame(seed);
    hud.toast(`Mesma semente (${seed}) · ${mode.name} · ${theme.name}`);
  } else if (act === 'mode') {
    hud.hideModal();
    startFresh(modeById((e.target as HTMLElement).closest('button')?.dataset.mode));
  } else if (act === 'theme') {
    hud.hideModal();
    hud.openThemeMenu(theme, pickTheme);
  } else if (act === 'export') {
    capture.submitExport();
  }
});

/** Troca a cor da casa ou o brasão: o tema é "vestido" de novo e o mundo refeito. */
function setHouse(color: HouseColor | null, b: Banner) {
  const recolor = color !== house;
  house = color;
  banner = b;
  store.set('house', color);
  store.set('banner', JSON.stringify(b));
  if (recolor) {
    theme = dress(themeById(theme.id), house);
    hud.applyTheme(shownTheme());
    world.setTheme(shownTheme(), game.board);
    hud.renderQuests(game.board.quests, shownTheme());
    minimap.rebuild(game.board.list, shownTheme().terrainColors);
    refreshHud(true);
  }
  showCrest();
}

function showCrest() {
  hud.setCrest(bannerSvg(theme.ui.accent, banner, 34));
}

function pickTheme(t: Theme) {
  if (capture.take) capture.stopTake('A gravação terminou aqui: o vídeo fica no tema em que começou.');
  theme = dress(t, house);
  store.set('theme', t.id);
  hud.applyTheme(shownTheme());
  showCrest();
  world.setTheme(shownTheme(), game.board);
  sfx.setStyle(t.music, game.board.era);
  hud.renderQuests(game.board.quests, shownTheme());
  minimap.rebuild(game.board.list, shownTheme().terrainColors);
  refreshHud(true);
  if (game.over) {
    rulesTheme = t;
    newGame();
  } else if (!mode.daily && JSON.stringify(rulesFor(t)) !== JSON.stringify(game.rules)) {
    hud.toast(`${t.ruleNote ?? 'Regras padrão.'} Vale a partir da próxima partida.`);
  }
}

// ------------------------------------------------------------------ qualidade

const qualityLabel: Record<QualityMode, string> = { auto: 'Auto', cinema: 'Cinema', ultra: 'Ultra', high: 'Alta', medium: 'Média', low: 'Baixa' };
const QUALITY_NOTE: Record<Quality, string> = {
  cinema: 'Desenha 1,5× acima da tela, com grão de filme e lente. Para placas de topo (classe RTX 4080)',
  ultra: 'Luz indireta, reflexos na água e raios de sol. Para placas acima da RX 580',
  high: 'Oclusão, bloom e profundidade de campo',
  medium: 'Leve, para notebooks e celulares',
  low: 'Sem sombras nem pós-processamento',
};
const qualityBtn = document.getElementById('btn-quality')!;

// O modo Auto começa pelo nome da placa de vídeo (gpuTier.ts). Sem um nome conhecido, começa em
// Média nas telas de toque (celular, tablet) e em Ultra no computador.
const gpu = readGpuInfo(world.renderer);
const gpuLabel = gpuName(gpu);
const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
const autoStart: Quality = tierForGpu(gpu) ?? (coarsePointer ? 'medium' : 'ultra');
const LOWER: Record<Quality, Quality> = { cinema: 'ultra', ultra: 'high', high: 'medium', medium: 'low', low: 'low' };
let autoLevel: Quality = autoStart;
/** Resolução dinâmica do Auto: cede antes de o nível descer. */
const dynres = new DynRes();

function autoNote() {
  return `${qualityLabel[autoLevel]}${dynres.step ? `, resolução ${Math.round(dynres.scale * 100)}%` : ''}`;
}

function updateQualityTitle() {
  qualityBtn.title = `Qualidade gráfica: ${qualityLabel[qualityMode]}${qualityMode === 'auto' ? ` (${autoNote()})` : ''}${gpuLabel ? ` · ${gpuLabel}` : ''}`;
}

function applyQuality(mode: QualityMode) {
  qualityMode = mode;
  if (mode === 'auto') autoLevel = autoStart;
  dynres.reset();
  world.setResolutionScale(1);
  world.setQuality(mode === 'auto' ? autoLevel : mode);
  qualityBtn.textContent = qualityLabel[mode];
  updateQualityTitle();
}

/** Modo Auto: com o quadro lento, a resolução cede um degrau por vez; no menor degrau, o nível desce. */
function adaptQuality(dt: number, now: number) {
  if (qualityMode !== 'auto' || document.hidden || capture.stage !== 'play') return;
  const ev = dynres.push(dt, now / 1000);
  if (ev === 'up' || ev === 'down') world.setResolutionScale(dynres.scale);
  else if (ev === 'floor' && autoLevel !== 'low') {
    autoLevel = LOWER[autoLevel];
    dynres.reset();
    world.setResolutionScale(1);
    world.setQuality(autoLevel);
    hud.toast(`Qualidade ajustada para ${qualityLabel[autoLevel]} para manter a fluidez.`);
  }
  if (ev) updateQualityTitle();
}

// ------------------------------------------------------------------ entrada

/** Foto, gravação e vídeo (src/ui/capture.ts): o estado da tela e a gravação em andamento. */
const capture = new Capture({
  canvas,
  world,
  hud,
  store,
  theme: () => theme,
  game: () => game,
  moves: () => moves,
  liveQuality: () => (qualityMode === 'auto' ? autoLevel : qualityMode),
  qualityLabel: (q) => qualityLabel[q],
  cycleTime,
  clearHover: () => (hover = null),
  updateGhost,
  resetDynres: () => dynres.reset(),
  refreshHud,
});

function setHover(h: { q: number; r: number } | null) {
  const same = h && hover && h.q === hover.q && h.r === hover.r;
  hover = h;
  if (!same) updateGhost();
}

const input = bindInput({
  canvas,
  world,
  hud,
  sfx,
  store,
  capture,
  hover: () => hover,
  setHover,
  open: (q, r) => game.board.frontier.has(hkey(q, r)),
  hasPiece: () => !!game.current,
  gameOver: () => game.over,
  place,
  rotate,
  cycleTime,
  showHelp: () => showHelp(),
  requestNewGame,
  undo,
  toggleMap: () => minimap.toggle(),
  choose: (pick) => !!hud.modalBody.querySelector('.blessings') && chooseBlessing(pick),
});

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
document.getElementById('btn-help')!.addEventListener('click', () => showHelp());
document.getElementById('btn-a11y')!.addEventListener('click', () => showA11y());
document.getElementById('btn-new')!.addEventListener('click', requestNewGame);
document.getElementById('btn-undo')!.addEventListener('click', undo);
hud.themeBtn.addEventListener('click', () => {
  if (hud.themeMenu.hidden) hud.openThemeMenu(theme, pickTheme, { color: house, banner, themeAccent: themeById(theme.id).ui.accent, onChange: setHouse });
  else hud.closeThemeMenu();
});
qualityBtn.addEventListener('click', () => {
  if (capture.stage !== 'play') return;
  const items = QUALITIES.map((q) => ({
    id: q,
    label: q === 'auto' ? `Auto · ${autoNote()}` : qualityLabel[q],
    note: q === 'auto' ? `Escolhe pela placa de vídeo${gpuLabel ? ` (${gpuLabel})` : ''} e baixa a resolução antes de tirar efeitos` : QUALITY_NOTE[q],
    current: q === qualityMode,
  }));
  hud.toggleMenu(qualityBtn, items, (id) => {
    const next = pickQ(id);
    if (!next) return;
    applyQuality(next);
    store.set('quality', next);
    hud.toast(`Qualidade: ${qualityLabel[next]}${next === 'cinema' ? ' · pede uma placa de vídeo de topo' : ''}`);
  });
});
const setTimeLabel = (t: TimeOfDay) => {
  timeBtn.querySelector('.long')!.textContent = TIME_LABEL[t];
  timeBtn.querySelector('.short')!.textContent = TIME_ICON[t];
};
const timeBtn = document.getElementById('btn-time')!;
function cycleTime() {
  const next = TIME_ORDER[(TIME_ORDER.indexOf(world.timeOfDay) + 1) % TIME_ORDER.length];
  world.setTimeOfDay(next);
  setTimeLabel(next);
  sfx.setMood(next === 'aurora' ? 'dawn' : next);
  store.set('time', next);
  capture.take?.event({ kind: 'time', tod: next });
  capture.timeChanged();
}
timeBtn.addEventListener('click', cycleTime);
{
  const saved = (params.get('time') ?? store.get('time')) as TimeOfDay | null;
  if (saved && Object.hasOwn(TIME_LABEL, saved)) {
    world.setTimeOfDay(saved);
    setTimeLabel(saved);
    sfx.setMood(saved === 'aurora' ? 'dawn' : saved);
  }
}

// Som em três estados: música e efeitos ('1'), só efeitos ('sfx'), mudo ('0').
type SoundMode = '1' | 'sfx' | '0';
const SOUND: Record<SoundMode, { long: string; short: string; title: string }> = {
  '1': { long: 'Som', short: '♫', title: 'Som: música e efeitos (clique alterna)' },
  sfx: { long: 'Efeitos', short: '♪', title: 'Som: só efeitos (clique alterna)' },
  '0': { long: 'Mudo', short: '✕', title: 'Som desligado (clique alterna)' },
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
soundBtn.addEventListener('click', () => {
  sfx.unlock();
  setSound(({ '1': 'sfx', sfx: '0', '0': '1' } as const)[soundMode]);
});
{
  const saved = store.get('sound');
  setSound(saved === '0' || saved === 'sfx' ? saved : '1', false);
}
document.getElementById('btn-more')!.addEventListener('click', () => {
  const btn = document.getElementById('btn-more')!;
  hud.toggleMenu(
    btn,
    [
      { id: 'time', label: 'Hora do dia', note: TIME_LABEL[world.timeOfDay] },
      { id: 'quality', label: 'Qualidade', note: qualityLabel[qualityMode] },
      { id: 'camera', label: 'Foto e vídeo' },
      { id: 'sound', label: 'Som', note: soundBtn.querySelector('.long')!.textContent ?? '' },
      { id: 'help', label: 'Como jogar' },
      { id: 'new', label: 'Nova partida' },
      { id: 'a11y', label: 'Acessibilidade' },
    ],
    (id) => {
      if (id === 'a11y') showA11y();
      else document.getElementById(`btn-${id}`)?.click();
    },
  );
});
document.addEventListener('visibilitychange', () => sfx.pause(document.hidden));

window.addEventListener('resize', () => {
  world.resize();
  minimap.layout();
});

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
    // As jogadas entram na lista: o filme e a gravação refazem o mapa por elas.
    moves.push([m.q, m.r, m.rot]);
    noteTurn(res);
    while (game.discardIfStuck());
  }
  const logic = performance.now() - t0;
  const t1 = performance.now();
  world.placeInstant(placed, game.board);
  const bake = performance.now() - t1;
  hud.renderQuests(game.board.quests, shownTheme());
  refreshTradeMarks();
  minimap.rebuild(game.board.list, shownTheme().terrainColors);
  frameCamera(true);
  refreshHud(true);
  scheduleGameOver();
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
let ambienceAt = 0;

/**
 * Som de ambiente: a paisagem num raio de 3 casas em volta do foco da câmera. Cada terreno
 * pesa pela fração das bordas, vezes o quanto do raio já tem peça (o vazio é só vento).
 */
function updateAmbience(now: number) {
  if (now - ambienceAt < 500) return;
  ambienceAt = now;
  const [fq, fr] = worldToHex(world.rig.target.x, world.rig.target.z);
  const n = [0, 0, 0, 0, 0, 0];
  let tiles = 0;
  for (const p of game.board.list) {
    if (hexDistance(p.q, p.r, fq, fr) > 3) continue;
    tiles++;
    for (const t of p.edges) n[t]++;
  }
  const area = 37 * 6;
  const share = (t: T, k: number) => Math.min(1, (n[t] / area) * k);
  sfx.setAmbience({
    open: Math.min(1, share(T.Grass, 1.2) + share(T.Field, 1.2)),
    forest: share(T.Forest, 2),
    water: share(T.Water, 4),
    village: share(T.Village, 2.5),
    rail: share(T.Rail, 4),
    near: tiles ? THREE.MathUtils.clamp(1 - (world.rig.dist - world.rig.minDist) / 20, 0, 1) : 0,
  });
}

// Bateria: em tela de toque, com o jogo parado (sem toque, tecla ou peça caindo), desenha a 30
// quadros e, depois de 15 s, a 20. O mundo continua animado; no computador nada muda.
const saveBattery = window.matchMedia?.('(pointer: coarse)').matches ?? false;
let lastInput = 0;
let frameNo = 0;
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'])
  window.addEventListener(ev, () => (lastInput = performance.now()), { capture: true, passive: true });

/** Peças já estão no canvas; aqui só o que muda sem jogada: missões, sítios e a câmera. */
function mapFrame() {
  const quests = [];
  for (const q of game.board.quests) {
    if (q.state !== 'active') continue;
    quests.push({ q: q.anchor.q, r: q.anchor.r, color: q.kind === 'perfect' ? theme.ui.accent : shownTheme().terrainColors[q.terrain] });
  }
  minimap.frame({
    quests,
    sites: game.board.sites.filter((s) => s.found).map((s) => ({ q: s.q, r: s.r, kind: s.kind })),
    nodes: tradeMarks,
    corners: world.viewOnGround(),
  });
}

function frame(now: number) {
  try {
    const idle = now - lastInput;
    const skip = saveBattery && !special && capture.stage === 'play' && !capture.take && !capture.shooting && idle > 4000 ? (idle > 15000 ? 3 : 2) : 1;
    if (++frameNo % skip === 0) step(now);
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
  // A foto e o vídeo desenham por conta própria.
  if (capture.stage === 'export' || capture.shooting) return;
  tutorial.tick(hud.modalOpen || capture.stage !== 'play' || capture.take !== null);
  const c0 = performance.now();
  input.keyboardCamera(dt);
  if (params.has('demo')) demoStep(dt);
  if (scoutPending && !hud.modalOpen) {
    scoutPending = false;
    world.scout(game.board);
  }
  world.tick(dt);
  mapFrame();
  updateAmbience(now);
  if (capture.take && !capture.take.frame(realDt, { x: world.rig.target.x, z: world.rig.target.z, dist: world.rig.dist, yaw: world.rig.yaw, tilt: world.rig.tilt })) capture.stopTake('A gravação chegou a 2 minutos.');
  hud.tick(dt);
  const markers = [];
  for (const q of game.board.quests) {
    if (q.state !== 'active') continue;
    const s = screenOf(q.anchor.q, q.anchor.r, 0.55);
    // O estandarte não tapa a jogada: apaga quando o fantasma passa na peça dele ou numa vizinha.
    const dim = !!hover && hexDistance(hover.q, hover.r, q.anchor.q, q.anchor.r) <= 1;
    markers.push({ id: q.id, x: s.x, y: s.y, visible: s.visible, text: questMarker(q), color: q.kind === 'perfect' ? theme.ui.accent : shownTheme().terrainColors[q.terrain], dim });
  }
  // Maravilha em obra: etiqueta com a etapa sobre o canteiro.
  const wd = game.board.wonder;
  if (wd && wd.stage < game.rules.wonderStages) {
    const s = screenOf(wd.tile.q, wd.tile.r, 0.9);
    markers.push({ id: 900000, x: s.x, y: s.y, visible: s.visible, text: `⛫ ${wd.stage}/${game.rules.wonderStages}`, color: '#8a6a3a', kind: 'wonder' });
  }
  // Os sítios são carimbos no mapa (World); a etiqueta com a recompensa só aparece com o fantasma em cima.
  const st = hover && game.current ? game.board.siteAt(hover.q, hover.r) : null;
  if (st) {
    const s = screenOf(st.q, st.r, 0.05);
    markers.push({ id: 100000 + st.q * 1000 + st.r, x: s.x, y: s.y + 30, visible: s.visible, text: `${SITE_LABEL[st.kind].icon} ${SITE_LABEL[st.kind].name}: ${siteReward(st.kind)}`, color: '#8a6a3a', kind: st.kind });
  }
  for (const m of tradeMarks) {
    const s = screenOf(m.q, m.r, 0.2);
    const dim = !!hover && hexDistance(hover.q, hover.r, m.q, m.r) <= 1;
    const text = m.kind === 'both' ? 'mercado · porto' : m.kind === 'market' ? 'mercado' : 'porto';
    markers.push({ id: 500000 + hkey(m.q, m.r), x: s.x, y: s.y, visible: s.visible, text, color: m.kind === 'port' ? '#2f6f8f' : '#6b5344', dim, kind: m.kind });
  }
  // Prévia da rota: o valor aparece com o fantasma numa casa que ligaria mercados ou portos.
  if (routePeek.length && hover) {
    const s = screenOf(hover.q, hover.r, 0.05);
    const y = s.y + (st ? 62 : 30);
    markers.push({ id: 210000, x: s.x, y, visible: s.visible, text: routePeek.map(routeLabel).join(' · '), color: theme.ui.accent, kind: 'route' });
  }
  // Influência das construções: o ganho aparece com o fantasma numa casa contornada.
  const inf = hover && game.current && !st ? game.board.influenceAt(hover.q, hover.r, game.current.edges) : null;
  if (inf?.points) {
    const s = screenOf(hover!.q, hover!.r, 0.05);
    const y = s.y + 30 + (st ? 32 : 0) + (routePeek.length ? 32 : 0);
    markers.push({ id: 200000, x: s.x, y, visible: s.visible, text: `✦ +${inf.points} · ${inf.kinds.map((k) => theme.synergy[k.kind]).join(', ')}`, color: theme.ui.accent, kind: 'influence' });
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
        `qualidade ${qualityLabel[qualityMode]}${qualityMode === 'auto' ? ` (${autoNote()})` : ''}`,
        `placa ${gpuLabel || '?'}`,
      ].join('\n');
    }
    (window as unknown as { __stats: unknown }).__stats = { ...statsText, ...world.stats(), tiles: game.board.list.length, quality: world.quality, res: dynres.scale, gpu: gpuLabel };
    if (capture.take) capture.updateCameraBtn();
  }
  adaptQuality(realDt, now);
}

// ------------------------------------------------------------------ início

function start(data: unknown) {
  const hotData = data as (Partial<Save> & { theme?: string }) | undefined;
  if (hotData?.theme) theme = dress(themeById(hotData.theme), house);
  applyQuality(qualityMode);
  let saved = special ? null : (validSave(hotData) ?? readSave());
  // Um link com ?seed= (desafio) vence a partida salva de outra semente.
  const wantSeed = Math.floor(Number(params.get('seed'))) || 0;
  if (saved && wantSeed > 0 && saved.seed !== wantSeed) saved = null;
  let resumed = false;
  if (saved) {
    rulesTheme = themeById(saved.rulesId);
    mode = modeById(saved.mode);
    resumed = newGame(saved.seed, saved.moves, saved.score, saved.undone, saved.specials);
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
  applyA11y();
  // Legibilidade: decorações pretas sobre chão branco (vilas, construções e marcos precisam ler de longe).
  if (params.has('silhueta')) U.silhouette.value = 1;
  (window as unknown as { __pools: () => unknown }).__pools = () => world.poolReport();
  if (params.has('gallery')) (window as unknown as { __gallery: string[] }).__gallery = world.showGallery();
  if (params.has('yaw')) world.rig.yaw = world.rig.goalYaw = Number(params.get('yaw'));
  if (params.has('zoom')) world.rig.dist = world.rig.goalDist = Number(params.get('zoom'));
  // Inclinação guardada (ajuste em radianos) ou pedida pela URL (graus acima do chão, para capturas).
  const savedTilt = Number(store.get('tilt'));
  if (store.get('tilt') !== null && Number.isFinite(savedTilt) && Math.abs(savedTilt) <= 1) world.rig.tilt = world.rig.goalTilt = world.rig.clampTilt(savedTilt);
  const pitchDeg = Number(params.get('pitch'));
  if (params.has('pitch') && Number.isFinite(pitchDeg) && pitchDeg >= PITCH_MIN * THREE.MathUtils.RAD2DEG - 1e-6 && pitchDeg <= PITCH_MAX * THREE.MathUtils.RAD2DEG + 1e-6) {
    world.rig.tilt = world.rig.goalTilt = pitchDeg * THREE.MathUtils.DEG2RAD - world.rig.basePitch(world.rig.goalDist);
  }
  if (params.has('focus')) (window as unknown as { __focus: (t: number) => boolean }).__focus(Number(params.get('focus')));
  if (!special && !store.get('seenHelp') && !(resumed && moves.length)) showHelp();
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

// Ajuda para capturas de tela automatizadas: mostra a peça atual na melhor posição.
(window as unknown as { __over: () => void }).__over = () => showGameOver();

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
// Mostra os três monumentos na praça do Centro (só a imagem; não grava o progresso).
(window as unknown as { __plaza: (zoom?: number) => string[] }).__plaza = (zoom) => {
  const kinds = [...MONUMENT_KINDS];
  world.setMonuments(kinds);
  world.showEra(Math.max(game.board.era, 0), -1);
  world.rig.goal.set(0, 0, 0);
  world.rig.target.set(0, 0, 0);
  if (zoom) world.rig.dist = world.rig.goalDist = zoom;
  return kinds;
};

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
(window as unknown as { __site: (zoom?: number) => string | null }).__site = (zoom) => {
  const found = [...game.board.list].reverse().find((p) => p.site);
  const st = found ?? game.board.sites.find((x) => !x.found);
  if (!st) return null;
  const { x, z } = hexToWorld(st.q, st.r);
  world.rig.goal.set(x, 0, z);
  world.rig.target.set(x, 0, z);
  if (zoom) world.rig.dist = world.rig.goalDist = zoom;
  return found ? `achado:${found.site}` : `escondido:${(st as { kind: string }).kind}`;
};
// Peça especial: centraliza na i-ésima colocada (estação, moinho d'água ou farol) e devolve qual.
(window as unknown as { __special: (i?: number, zoom?: number) => string | null }).__special = (i = 0, zoom) => {
  const p = game.board.list.filter((t) => t.def.special)[i];
  if (!p) return null;
  const { x, z } = hexToWorld(p.q, p.r);
  world.rig.goal.set(x, 0, z);
  world.rig.target.set(x, 0, z);
  if (zoom) world.rig.dist = world.rig.goalDist = zoom;
  return p.def.special!;
};
// Maravilha: centraliza no canteiro; com `stage`, mostra a obra nessa etapa (0 a 6, só a imagem).
(window as unknown as { __wonder: (stage?: number, zoom?: number) => boolean }).__wonder = (stage, zoom) => {
  const w = game.board.wonder;
  if (!w) return false;
  const { x, z } = hexToWorld(w.tile.q, w.tile.r);
  world.rig.goal.set(x, 0, z);
  world.rig.target.set(x, 0, z);
  if (zoom) world.rig.dist = world.rig.goalDist = zoom;
  if (stage !== undefined) world.syncWonder({ wonder: { tile: w.tile, stage }, rules: game.rules } as typeof game.board, false);
  return true;
};
(window as unknown as { __folk: (i?: number, zoom?: number) => boolean }).__folk = (i = 0, zoom) => {
  const f = world.life.workerPos(i);
  if (!f) return false;
  world.rig.goal.set(f.x, 0, f.z);
  world.rig.target.set(f.x, 0, f.z);
  if (zoom) world.rig.dist = world.rig.goalDist = zoom;
  return true;
};
// Centraliza no i-ésimo cardume, ou no i-ésimo cais de pescador com `pier` (capturas da pesca).
(window as unknown as { __fishing: (i?: number, pier?: boolean, zoom?: number) => boolean }).__fishing = (i = 0, pier = false, zoom) => {
  const f = world.life.fishingPos(i, pier);
  if (!f) return false;
  world.rig.goal.set(f.x, 0, f.z);
  world.rig.target.set(f.x, 0, f.z);
  if (zoom) world.rig.dist = world.rig.goalDist = zoom;
  return true;
};
// Linha reta de ferrovia, fora do mapa, para a captura da carga e da moeda.
(window as unknown as { __spur: () => boolean }).__spur = () => {
  const edges = [T.Rail, T.Village, T.Grass, T.Rail, T.Grass, T.Grass];
  for (let i = 0; i < 4; i++) if (game.board.tiles.has(hkey(12 + i, 0))) return false;
  const placed = [0, 1, 2, 3].map((i) => game.board.placeRaw(12 + i, 0, { edges: [...edges], seed: 9000 + i, quest: null }, 0));
  world.placeInstant(placed, game.board);
  return true;
};
// Segura o trem na parada e centraliza (captura da carga e da moeda).
(window as unknown as { __holdTrade: (zoom?: number) => boolean }).__holdTrade = (zoom) => {
  if (!world.life.holdTrade()) return false;
  const p = world.life.tradePos(true);
  if (!p) return false;
  world.rig.goal.set(p.x, 0, p.z);
  world.rig.target.set(p.x, 0, p.z);
  if (zoom) world.rig.dist = world.rig.goalDist = zoom;
  return true;
};
// Centraliza no veículo da rota. Com `coin`, só quando a moeda está no ar (captura da parada).
(window as unknown as { __trade: (coin?: boolean, zoom?: number) => boolean }).__trade = (coin = false, zoom) => {
  const p = world.life.tradePos(coin);
  if (!p) return false;
  world.rig.goal.set(p.x, 0, p.z);
  world.rig.target.set(p.x, 0, p.z);
  if (zoom) world.rig.dist = world.rig.goalDist = zoom;
  return true;
};
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

// Exporta um vídeo sem o diálogo (teste no contêiner): o filme da partida ou a gravação em andamento
// (tecla V), em `height` linhas, e devolve o MP4 em base64 para conferir com o ffprobe.
(window as unknown as { __video: (o?: { kind?: string; height?: number; quality?: string }) => Promise<unknown> }).__video = async (o = {}) => {
  const kind = o.kind === 'take' ? 'take' : 'film';
  if (kind === 'take') {
    if (!capture.take) return null;
    capture.stopTake();
    hud.hideModal();
  }
  const height = Math.round(THREE.MathUtils.clamp(Number(o.height) || 360, 144, 2160) / 2) * 2;
  const q = (VIDEO_QUALITIES as readonly string[]).includes(o.quality ?? '') ? (o.quality as Quality) : 'high';
  const t0 = performance.now();
  const blob = await capture.exportVideo(kind, height, q, 'cinematic', world.timeOfDay);
  if (!blob) return null;
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { bytes: blob.size, ms: performance.now() - t0, b64: btoa(bin) };
};

const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
hot?.snapshot?.(() => ({ ...snapshot(), theme: theme.id }));
if (hot?.ready) hot.ready(start);
else start(hot?.data);
