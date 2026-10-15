// Ilha das Lanternas: entrada. Liga o jogo (src/core), o diorama (src/render) e o HUD (src/ui).
import './ui/style.css';
import { decide, windMove } from './core/bots';
import { Card, Game, RULES, Struct, parseSeed } from './core/game';
import { CELLS, CENTER, N, NB, dist } from './core/hex';
import { FIND_NAMES, TERRAIN_NAMES } from './core/map';
import { mulberry32, subSeed } from './core/rng';
import { World, cellX, cellZ } from './render/world';
import { Hud } from './ui/hud';

const params = new URL(location.href).searchParams;
const intParam = (k: string, lo: number, hi: number): number | null => {
  const v = params.get(k);
  if (v === null || !/^-?\d{1,3}$/.test(v)) return null;
  const n = Number.parseInt(v, 10);
  return n >= lo && n <= hi ? n : null;
};
const floatParam = (k: string, lo: number, hi: number): number | null => {
  const v = params.get(k);
  if (v === null || !/^-?\d{1,3}(\.\d{1,3})?$/.test(v)) return null;
  const n = Number.parseFloat(v);
  return n >= lo && n <= hi ? n : null;
};

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.get('reduzir') === '1';
const world = new World(document.body, { reduced });
const hud = new Hud({
  onSelect: (slot) => select(slot),
  onDiscard: () => discard(),
  onNew: () => startGame(newSeed()),
  onWind: () => toggleWind(),
});
hud.reduced = reduced;

let game!: Game;
let selected = -1;
let valid = new Set<number>();
let hover = -1;
let pending = -1;               // toque: primeiro toque mostra o fantasma, o segundo confirma
let windArmed = false;          // sopro do vento armado pelo botão: os alvos ficam marcados
let windPending = -1;           // toque: primeiro toque marca a nuvem, o segundo sopra
let rainTimer = 0;
let nightTimer = 0;
const forcedTurn = intParam('turn', 1, 30);

const wideScreen = (): boolean => innerWidth > 900;
function newSeed(): number { return Math.floor(Math.random() * 1_000_000_000); }

// Celular em pé: câmera mais alta, para a ilha ocupar a largura e a altura úteis.
const portrait = innerWidth / innerHeight < 0.8;
const CAM_DEFAULT = { yaw: -0.42, pol: portrait ? 0.8 : 1.0, dist: 44 };

function startGame(seed: number, auto = 0, first = false): void {
  clearTimeout(nightTimer);
  game = new Game(seed);
  selected = -1; valid = new Set(); hover = -1; pending = -1; windArmed = false; windPending = -1;
  const url = new URL(location.href);
  url.searchParams.set('seed', String(seed));
  if (!first) { url.searchParams.delete('auto'); }
  history.replaceState(null, '', url);
  hud.hideEnd();
  world.setViewX(0, true); world.orbit = false;
  world.reset(game);
  world.sync(game, { instant: true });
  world.setNight(0, true);
  if (auto > 0) {
    // Depuração: o bot planejador joga `auto` turnos sem animação.
    const rng = mulberry32(subSeed(seed, 99));
    for (let k = 0; k < auto && !game.over; k++) game.apply(decide('planejador', game, rng).action);
    world.sync(game, { instant: true });
  }
  world.setDay(forcedTurn ?? game.turn, game.over, true);
  if (game.over || params.get('night') === '1') world.setNight(1, true);
  if (!first) { world.setCamera(CAM_DEFAULT); world.aim({ dist: CAM_DEFAULT.dist }); }
  refresh();
  if (game.over) { hud.showEnd(game, 0); world.setViewX(wideScreen() ? 0.09 : 0, true); }
}

function describe(i: number): string {
  if (i < 0) return '';
  const { q, r } = CELLS[i];
  if (!game.seen[i]) {
    const tip = i === game.map.tip ? ' · a ponta marcada está aqui' : '';
    return game.canBlow(i) ? `Névoa${tip} · toque para soprar o vento (dissolve a névoa num raio 1, sem acender)` : `Névoa${tip}: acenda uma lanterna perto para ver`;
  }
  const parts = [TERRAIN_NAMES[game.map.terrain[i]]];
  if (!game.revealed[i]) parts.push('à vista, sem luz (só a Lanterna cabe aqui)');
  const s = game.struct[i];
  if (s === Struct.House) parts.push(`Casa com ${game.houseResidents(i)} morador(es), ${game.houseLit(i) ? 'junto de uma lanterna' : 'sem lanterna por perto'}`);
  else if (i === CENTER && s === Struct.Lantern) parts.push('Farol velho');
  else if (s !== Struct.None) parts.push(['', 'Casa', 'Campo', 'Oliveiral', 'Lanterna', 'Cais'][s]);
  const f = game.map.finds[i];
  if (f) parts.push(FIND_NAMES[f]);
  if (i === game.map.tip) parts.push('ponta marcada');
  void q; void r;
  return parts.join(' · ');
}

const HINT = 'Escolha uma carta e toque num hexágono brilhante.';
function updateInfo(): void {
  if (game.over) { hud.setInfo('Gire a ilha para ver as luzes de perto.'); return; }
  if (windArmed && hover < 0) { hud.setInfo('Vento armado: toque numa nuvem marcada, encostada na luz. Esc cancela.'); return; }
  if (windPending >= 0 && hover === windPending) { hud.setInfo('Toque de novo para soprar o vento nesta nuvem.'); return; }
  const d = describe(hover);
  hud.setInfo(d || (selected >= 0 ? (valid.size ? 'Toque num hexágono brilhante para colocar a carta.' : 'Essa carta não cabe agora. Escolha outra ou descarte.') : HINT));
}

/** Nuvens que o sopro alcança agora (encostadas na luz, ainda fechadas). */
function windTargets(): number[] {
  const out: number[] = [];
  if (game.over || game.wind <= 0) return out;
  for (let i = 0; i < N; i++) if (game.canBlow(i)) out.push(i);
  return out;
}

function refresh(): void {
  if (windArmed && (game.wind <= 0 || game.over)) windArmed = false;
  hud.render(game, selected, windArmed);
  world.setValid([...valid]);
  world.setWindMarks(windArmed ? windTargets() : [], [], -1);
  updateInfo();
}

function toggleWind(): void {
  if (game.over) return;
  if (game.wind <= 0) {
    const nextNight = RULES.nights.find((n) => n >= game.turn);
    hud.toast(nextNight !== undefined ? `Sem sopro agora: o vento volta na noite do turno ${nextNight}.` : 'O vento já não volta nesta temporada.', 3200);
    return;
  }
  windArmed = !windArmed; windPending = -1;
  if (windArmed) { selected = -1; valid = new Set(); pending = -1; world.setGhost(-1, -1); world.setHover(-1); }
  refresh();
}

/** Sopro do vento: dissolve a névoa num raio 1 em volta da nuvem (revela, mas não ilumina). Não gasta o turno. */
function blow(cell: number): void {
  if (!game.canBlow(cell)) return;
  const before = game.seen.slice();
  const from = NB[cell].find((n) => game.revealed[n]) ?? CENTER;
  let dx = cellX(cell) - cellX(from), dz = cellZ(cell) - cellZ(from);
  const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
  if (!game.blow(cell)) return;
  windArmed = false; windPending = -1;
  world.blowAt(cell, dx, dz);
  world.sync(game, { origin: cell, wind: { dx, dz } });
  world.setWindMarks([], [], -1);
  world.setCursor('');
  const fresh = [...Array(N).keys()].filter((i) => game.seen[i] && !before[i]);
  const finds = fresh.filter((i) => game.map.finds[i]).map((i) => FIND_NAMES[game.map.finds[i]]);
  const land = fresh.filter((i) => game.map.terrain[i] !== 0).length;
  hud.toast(`Sopro do vento: ${land} hexágono${land === 1 ? '' : 's'} de terra à vista${finds.length ? `, achado: ${finds.join(', ')}` : ''}. Sem luz não dá para construir ali: só uma Lanterna.`, 4800);
  refresh();
}

/** Chuvinha cosmética: tocar no céu vazio. Não muda regra nenhuma. */
function rainOnIsland(): void {
  world.rain();
  hud.setInfo('Chove sobre a ilha por um instante…');
  clearTimeout(rainTimer);
  rainTimer = window.setTimeout(updateInfo, 4300);
}

function select(slot: number): void {
  if (game.over || slot < 0 || slot >= game.hand.length) return;
  if (!game.playable(game.hand[slot]) && selected !== slot) {
    hud.shake(slot);
  }
  selected = selected === slot ? -1 : slot;
  valid = selected >= 0 ? new Set(game.validCells(selected)) : new Set();
  pending = -1; world.setGhost(-1, -1); world.setHover(-1);
  windArmed = false; windPending = -1;
  refresh();
}

/** Dados do que vai acontecer na noite desta jogada, calculados numa cópia (o núcleo não expõe quais lanternas apagaram). */
function predictDark(action: { kind: 'play'; slot: number; idx: number } | { kind: 'discard'; slot: number }): number[] {
  const c = game.clone();
  if (action.kind === 'play') c.place(c.hand[action.slot], action.idx); else c.oil += RULES.discardOil;
  const others = c.lanterns.slice(1);
  const k = Math.min(others.length, Math.max(0, Math.floor((c.oil + c.oilIncome()) / RULES.nightOil)));
  return others.slice(k);
}

function afterMove(prevTurn: number, resBefore: number, lostBefore: Uint8Array, feastBefore: Uint8Array, cell: number, dark: number[]): void {
  selected = -1; valid = new Set(); pending = -1; windArmed = false; windPending = -1;
  world.setGhost(-1, -1); world.setHover(-1);
  world.sync(game, { origin: cell });
  if (forcedTurn === null) world.setDay(game.turn, game.over);
  const night = RULES.nights.includes(prevTurn);
  // texto flutuante: moradores ganhos pela jogada (antes da noite), na peça colocada
  const nightLoss = night ? game.houses.reduce((n, h) => n + (game.lost[h] - lostBefore[h]), 0) : 0;
  const feastHouses = night ? game.houses.filter((h) => game.feast[h] > feastBefore[h]) : [];
  const feastGain = feastHouses.reduce((n, h) => n + (game.feast[h] - feastBefore[h]), 0);
  if (cell >= 0) {
    const gain = game.residents() + nightLoss - feastGain - resBefore;
    if (gain > 0) {
      const p = world.screenPos(cell, 1.4);
      hud.float(p.x, p.y, `+${gain} morador${gain > 1 ? 'es' : ''}`, false, 380);
    }
  }
  if (night) {
    world.setDarkLanterns(dark);
    world.setNight(1);
    const lostHouses = game.houses.filter((h) => game.lost[h] > lostBefore[h]);
    window.setTimeout(() => {
      lostHouses.forEach((h, k) => { const p = world.screenPos(h, 1.2); hud.float(p.x, p.y, '−1 morador', true, k * 120); });
      feastHouses.forEach((h, k) => { const p = world.screenPos(h, 1.6); hud.float(p.x, p.y, `+${game.feast[h] - feastBefore[h]} festa`, false, 400 + k * 120); });
      hud.toast(`Noite do turno ${prevTurn}: ` + (lostHouses.length ? `${lostHouses.length} casa${lostHouses.length > 1 ? 's' : ''} sem lanterna por perto perdeu morador.` : 'todas as casas estavam sob a luz.') + (dark.length ? ` ${dark.length} lanterna${dark.length > 1 ? 's' : ''} apagou por falta de óleo.` : '') + (feastGain ? ` Festa: a comida guardada virou +${feastGain} morador${feastGain > 1 ? 'es' : ''}.` : ' A comida guardada se perdeu.'), 5600);
    }, reduced ? 100 : 1500);
    if (!game.over) {
      nightTimer = window.setTimeout(() => { world.setNight(0); world.setDarkLanterns([]); }, reduced ? 3500 : 6200);
    }
  }
  refresh();
  if (game.over) {
    hud.showEnd(game, reduced ? 200 : 2600);
    window.setTimeout(() => { world.setViewX(wideScreen() ? 0.09 : 0); world.orbit = !reduced; }, reduced ? 200 : 2600);
  }
}

function play(slot: number, idx: number): void {
  if (game.over) return;
  const t = game.turn, res = game.residents(), lost = game.lost.slice(), feast = game.feast.slice();
  const dark = RULES.nights.includes(t) ? predictDark({ kind: 'play', slot, idx }) : [];
  if (game.play(slot, idx)) afterMove(t, res, lost, feast, idx, dark);
}
function discard(): void {
  if (selected < 0 || game.over) return;
  const t = game.turn, res = game.residents(), lost = game.lost.slice(), feast = game.feast.slice();
  const dark = RULES.nights.includes(t) ? predictDark({ kind: 'discard', slot: selected }) : [];
  if (game.discard(selected)) afterMove(t, res, lost, feast, -1, dark);
}

world.onHover = (cell) => {
  hover = cell;
  const ok = selected >= 0 && valid.has(cell);
  world.setHover(ok ? cell : -1);
  world.setGhost(ok ? game.hand[selected] : -1, ok ? cell : -1);
  // Nuvem alcançável pelo sopro: ela balança e a área que seria dissolvida se marca.
  const wind = !ok && cell >= 0 && !game.over && game.canBlow(cell);
  world.setWindMarks(windArmed ? windTargets() : [], wind ? Game.windArea(cell) : [], wind ? cell : -1);
  world.setCursor(wind ? 'pointer' : '');
  updateInfo();
};
world.onTap = (cell, e) => {
  if (cell < 0) {
    hover = -1; world.setHover(-1); world.setGhost(-1, -1); windPending = -1;
    if (world.isSky(e.clientX, e.clientY)) rainOnIsland(); else updateInfo();
    return;
  }
  const touch = e.pointerType !== 'mouse';
  const cardOk = !game.over && selected >= 0 && valid.has(cell);
  if (!cardOk && !game.over && game.canBlow(cell)) {
    if (touch && windPending !== cell) {
      windPending = cell; hover = cell;
      world.setWindMarks(windArmed ? windTargets() : [], Game.windArea(cell), cell);
      updateInfo();
      return;
    }
    blow(cell);
    return;
  }
  windPending = -1;
  if (game.over || selected < 0 || !valid.has(cell)) { hover = cell; updateInfo(); return; }
  if (touch && pending !== cell) {
    pending = cell; hover = cell;
    world.setHover(cell); world.setGhost(game.hand[selected], cell); updateInfo();
    return;
  }
  play(selected, cell);
};

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.key >= '1' && e.key <= '3') select(Number(e.key) - 1);
  else if (e.key === 'Escape') { selected = -1; valid = new Set(); windArmed = false; windPending = -1; world.setGhost(-1, -1); world.setHover(-1); refresh(); }
  else if (e.key === 'v' || e.key === 'V') toggleWind();
  else if (e.key === 'ArrowLeft') world.rotate(-0.18);
  else if (e.key === 'ArrowRight') world.rotate(0.18);
  else if (e.key === 'ArrowUp') world.rotate(0, 0.08);
  else if (e.key === 'ArrowDown') world.rotate(0, -0.08);
  else if (e.key === '+' || e.key === '=') world.zoomBy(0.88);
  else if (e.key === '-') world.zoomBy(1.12);
  else if (e.key === 'd' || e.key === 'D') discard();
});

// A ilha fica centrada no espaço livre entre o topo e a mão de cartas.
function fitView(): void {
  const top = document.getElementById('hud-top')!.getBoundingClientRect().height + 12;
  // No fim, em tela estreita, o painel do resultado cobre o rodapé: a ilha sobe para o espaço livre acima dele.
  const endPanel = document.getElementById('end')!;
  const hand = (game.over && !wideScreen() ? endPanel.getBoundingClientRect().height : document.getElementById('hand-wrap')!.getBoundingClientRect().height) + 10;
  world.setViewShift((hand - top) / (2 * innerHeight));
}
new ResizeObserver(fitView).observe(document.getElementById('hand-wrap')!);
new ResizeObserver(fitView).observe(document.getElementById('end')!);
new ResizeObserver(fitView).observe(document.getElementById('hud-top')!);

// ---------- partida inicial e ganchos de depuração ----------
const seed0 = parseSeed(params.get('seed')) ?? newSeed();
const auto0 = intParam('auto', 0, 60) ?? 0;
const dbg = auto0 > 0 || params.get('blow') === '1' || params.get('rain') === '1' || params.has('yaw') || params.has('pitch') || params.has('zoom') || params.has('focus') || params.has('select') || params.has('night') || params.has('turn');
startGame(seed0, auto0, true);

{
  const yaw = floatParam('yaw', -7, 7), pol = floatParam('pitch', 0.3, 1.22), zoom = floatParam('zoom', 8, 60);
  const focus = params.get('focus');
  let cell = -1;
  if (focus === 'vila') cell = world.focusVillage();
  // Ganhos de captura: `?blow=1` sopra o vento no melhor alvo e congela a rajada no meio; `?rain=1` congela a chuva no meio.
  if (params.get('blow') === '1') {
    const t = windMove(game);
    const target = t >= 0 ? t : windTargets()[0] ?? -1;
    if (target >= 0) { blow(target); cell = target; world.holdAfter(floatParam('hold', 0.1, 9) ?? 0.5); }
  } else if (params.get('rain') === '1') { world.rain(); world.holdAfter(2.2); }
  const sel = intParam('select', 0, 2);
  world.setCamera({ yaw: yaw ?? CAM_DEFAULT.yaw, pol: pol ?? CAM_DEFAULT.pol, dist: zoom ?? (dbg ? CAM_DEFAULT.dist : CAM_DEFAULT.dist * 1.35), cell });
  if (!dbg && !reduced) world.aim({ dist: CAM_DEFAULT.dist });
  if (sel !== null) select(sel);
  if (params.get('hover') === 'valid' && selected >= 0 && valid.size) {
    const c = [...valid].sort((a, b) => dist(a, CENTER) - dist(b, CENTER))[0];
    world.onHover(c);
  }
}

Object.defineProperty(window, '__stats', { get: () => world.stats });
Object.defineProperty(window, '__ready', { get: () => world.frames >= 4 });
Object.defineProperty(window, '__held', { get: () => world.held && world.frames >= 6 });
Object.defineProperty(window, '__frames', { get: () => world.frames });
Object.assign(window, { __world: world, __game: () => game, __cell: (i: number) => ({ x: cellX(i), z: cellZ(i) }), __cards: Card, __N: N });

let last = performance.now();
world.renderer.setAnimationLoop((now) => {
  const dt = (now - last) / 1000; last = now;
  world.frame(dt);
});
