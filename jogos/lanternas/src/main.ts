// Ilha das Lanternas: entrada. Liga o jogo (src/core), o diorama (src/render) e o HUD (src/ui).
// Duas versões das regras (A e B) dividem o mesmo visual; a tela inicial só oferece "Ilha 1" e "Ilha 2" (teste às cegas).
import './ui/style.css';
import { Variant, debugVariant, islandOf, variantOf } from './ab';
import { decide, windMove } from './core/bots';
import { decideB } from './core/botsB';
import { CARD_NAMES, Card, Game, RULES, parseSeed } from './core/game';
import { CARD_NAMES_B, GameB, HOUSE_NAMES_B, LANDMARK_NAMES_B } from './core/gameB';
import { CELLS, CENTER, N, NB, dist } from './core/hex';
import { FIND_NAMES, TERRAIN_NAMES } from './core/map';
import { mulberry32, subSeed } from './core/rng';
import { World, cellX, cellZ } from './render/world';
import { View, viewB } from './render/view';
import { telemetry } from './telemetry';
import { Dicas } from './ui/dicas';
import { bindExport } from './ui/exportar';
import { FpsMeter } from './ui/fps';
import { Hud } from './ui/hud';
import { $, bindMenu } from './ui/hudBase';
import { HudB } from './ui/hudB';

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
const hudA = new Hud({ onSelect: (slot) => select(slot), onDiscard: () => discard(), onWind: () => toggleWind() });
const hudB = new HudB({ onSelect: (slot) => select(slot) });
hudA.reduced = hudB.reduced = reduced;
const exporter = bindExport();
$('ilha1').addEventListener('click', () => begin(variantOf(1)));
$('ilha2').addEventListener('click', () => begin(variantOf(2)));
bindMenu({
  onNew: () => { if (playing) startGame(newSeed()); },
  onChoose: () => showChoose(),
  onExport: () => exporter.open(),
  onSkipHints: () => dicas?.skip(),
});

// ---------- estado ----------
let variant: Variant = 'A';
let playing = false;                // false na tela de escolha
let game!: Game | GameB;
let view!: View;
let hud: Hud | HudB = hudA;
let dicas: Dicas | null = null;
const gA = (): Game => game as Game;
const gB = (): GameB => game as GameB;
const isB = (): boolean => variant === 'B';

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

const cardName = (c: number): string => (isB() ? CARD_NAMES_B[c] : CARD_NAMES[c]);

// ---------- tela de escolha ----------
function showChoose(): void {
  if (playing) telemetry.leave();
  playing = false;
  clearTimeout(nightTimer);
  dicas?.hide();
  document.body.classList.add('choosing');
  hud.hideEnd();
  // Pano de fundo: uma ilha qualquer em andamento (o visual é o mesmo nas duas versões).
  const demo = new Game(3);
  const rng = mulberry32(subSeed(3, 99));
  for (let k = 0; k < 12 && !demo.over; k++) demo.apply(decide('planejador', demo, rng).action);
  world.reset(demo, 'A'); world.sync(demo, { instant: true });
  world.setNight(0, true); world.setDay(8, false, true);
  world.setValid([]); world.setGhost(-1, -1); world.setHover(-1);
  world.setViewX(0, true); world.setViewShift(0);
  world.setCamera({ yaw: -0.42, pol: 0.95, dist: portrait ? 56 : 50, cell: CENTER });
  world.orbit = !reduced;
  ($('ilha1') as HTMLButtonElement).focus({ preventScroll: true });
}

function begin(v: Variant): void {
  variant = v;
  hud = isB() ? hudB : hudA;
  hud.activate();
  document.body.classList.remove('choosing');
  playing = true;
  const island = islandOf(v);
  hud.setMenuInfo(`Ilha ${island}`);
  dicas = new Dicas(v, (on) => hud.showSkipItem(on));
  dicas.onShow = () => telemetry.hint();
  const firstBegin = !first0Done;
  startGame(seed0 ?? newSeed(), auto0, firstBegin);
  seed0 = null; auto0 = 0;
  if (firstBegin) { first0Done = true; applyDebugCamera(); }
  if (params.get('dicas') === '1') dicas.at('inicio');
  if (params.get('exportar') === '1') exporter.open();
  if (dicas.active && !dbg) window.setTimeout(() => { if (playing && selected < 0 && game.turn === 1) dicas?.at('inicio'); }, reduced ? 300 : 1800);
}
let first0Done = false;

// ---------- partida ----------
function startGame(seed: number, auto = 0, first = false): void {
  clearTimeout(nightTimer);
  game = isB() ? new GameB(seed) : new Game(seed);
  view = isB() ? viewB(gB()) : gA();
  selected = -1; valid = new Set(); hover = -1; pending = -1; windArmed = false; windPending = -1;
  const url = new URL(location.href);
  url.searchParams.set('seed', String(seed));
  if (!first) { url.searchParams.delete('auto'); }
  try { history.replaceState(null, '', url); } catch { /* página dentro de moldura: sem histórico */ }
  hud.hideEnd();
  world.setViewX(0, true); world.orbit = false;
  world.reset(view, variant);
  world.sync(view, { instant: true });
  world.setNight(0, true);
  telemetry.begin(islandOf(variant), variant, seed);
  hud.setMenuInfo(`Ilha ${islandOf(variant)} · semente ${seed}`);
  if (auto > 0) {
    // Depuração: o bot planejador joga `auto` turnos sem animação.
    const rng = mulberry32(subSeed(seed, 99));
    for (let k = 0; k < auto && !game.over; k++) {
      if (isB()) gB().apply(decideB('planejador', gB(), rng).action); else gA().apply(decide('planejador', gA(), rng).action);
    }
    world.sync(view, { instant: true });
  }
  world.setDay(forcedTurn ?? game.turn, game.over, true);
  if (game.over || params.get('night') === '1') world.setNight(1, true);
  if (!first) { world.setCamera(CAM_DEFAULT); world.aim({ dist: CAM_DEFAULT.dist }); }
  newHand();
  refresh();
  if (game.over) { endGame(0); world.setViewX(wideScreen() ? 0.09 : 0, true); }
}

/** Uma mão nova na mesa: a telemetria começa a contar o tempo do turno. */
function newHand(): void {
  if (!game.over) telemetry.offer(game.turn, game.hand.map(cardName));
}

function endGame(delay: number): void {
  telemetry.finish(game.score());
  dicas?.finish();
  if (isB()) hudB.showEnd(gB(), delay); else hudA.showEnd(gA(), delay);
}

// ---------- texto do hexágono sob o cursor ----------
function describe(i: number): string {
  if (i < 0) return '';
  if (isB()) return describeB(i);
  const game = gA();
  if (!game.seen[i]) {
    const tip = i === game.map.tip ? ' · a ponta marcada está aqui' : '';
    return game.canBlow(i) ? `Névoa${tip} · toque para soprar o vento (dissolve a névoa num raio 1, sem acender)` : `Névoa${tip}: acenda uma lanterna perto para ver`;
  }
  const parts = [TERRAIN_NAMES[game.map.terrain[i]]];
  if (!game.revealed[i]) parts.push('à vista, sem luz (só a Lanterna cabe aqui)');
  const s = game.struct[i];
  if (s === 1) parts.push(`Casa com ${game.houseResidents(i)} morador(es), ${game.houseLit(i) ? 'junto de uma lanterna' : 'sem lanterna por perto'}`);
  else if (i === CENTER && s === 4) parts.push('Farol velho');
  else if (s !== 0) parts.push(['', 'Casa', 'Campo', 'Oliveiral', 'Lanterna', 'Cais'][s]);
  const f = game.map.finds[i];
  if (f) parts.push(FIND_NAMES[f]);
  if (i === game.map.tip) parts.push('ponta marcada');
  return parts.join(' · ');
}

function describeB(i: number): string {
  const g = gB();
  if (!g.lit[i]) return 'Névoa: acenda uma lanterna perto para ver';
  const parts = [TERRAIN_NAMES[g.map.terrain[i]]];
  const s = g.struct[i];
  if (s === 1) { const l = g.levelAt(i); parts.push(`${HOUSE_NAMES_B[l - 1]} com ${l} morador${l > 1 ? 'es' : ''}`); }
  else if (i === CENTER && s === 4) parts.push('Farol velho');
  else if (s !== 0) parts.push(['', 'Casa', 'Campo', 'Bosque', 'Lanterna', 'Cais'][s]);
  const f = g.map.finds[i];
  if (f) parts.push(FIND_NAMES[f]);
  return parts.join(' · ');
}

const HINT = 'Arraste para girar a ilha; a roda ou os dois dedos aproximam.';
function updateInfo(): void {
  if (game.over) { hud.setInfo('Gire a ilha para ver as luzes de perto.'); return; }
  if (!isB()) {
    if (windArmed && hover < 0) { hud.setInfo('Vento armado: toque numa nuvem marcada, encostada na luz. Esc cancela.'); return; }
    if (windPending >= 0 && hover === windPending) { hud.setInfo('Toque de novo para soprar o vento nesta nuvem.'); return; }
  }
  const d = describe(hover);
  hud.setInfo(d || (selected >= 0 ? (valid.size ? 'Toque num hexágono brilhante para colocar a peça.' : 'Essa peça não cabe agora. Escolha outra' + (isB() ? '.' : ' ou descarte.')) : HINT));
}

/** Nuvens que o sopro alcança agora (encostadas na luz, ainda fechadas). */
function windTargets(): number[] {
  const out: number[] = [];
  if (isB() || game.over || gA().wind <= 0) return out;
  for (let i = 0; i < N; i++) if (gA().canBlow(i)) out.push(i);
  return out;
}

function refresh(): void {
  if (isB()) hudB.render(gB(), selected);
  else {
    if (windArmed && (gA().wind <= 0 || game.over)) windArmed = false;
    hudA.render(gA(), selected, windArmed);
  }
  world.setValid([...valid]);
  world.setWindMarks(windArmed ? windTargets() : [], [], -1);
  updateInfo();
}

function toggleWind(): void {
  if (isB() || game.over) return;
  const game_ = gA();
  if (game_.wind <= 0) {
    const nextNight = RULES.nights.find((n) => n >= game_.turn);
    hud.toast(nextNight !== undefined ? `Sem sopro agora: o vento volta na noite do turno ${nextNight}.` : 'O vento já não volta nesta temporada.', 3200);
    return;
  }
  windArmed = !windArmed; windPending = -1;
  if (windArmed) { selected = -1; valid = new Set(); pending = -1; world.setGhost(-1, -1); world.setHover(-1); }
  refresh();
}

/** Sopro do vento: dissolve a névoa num raio 1 em volta da nuvem (revela, mas não ilumina). Não gasta o turno. */
function blow(cell: number): void {
  const game = gA();
  if (isB() || !game.canBlow(cell)) return;
  const before = game.seen.slice();
  const from = NB[cell].find((n) => game.revealed[n]) ?? CENTER;
  let dx = cellX(cell) - cellX(from), dz = cellZ(cell) - cellZ(from);
  const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
  if (!game.blow(cell)) return;
  telemetry.wind();
  windArmed = false; windPending = -1;
  world.blowAt(cell, dx, dz);
  world.sync(view, { origin: cell, wind: { dx, dz } });
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
  if (!playing || game.over || slot < 0 || slot >= game.hand.length) return;
  const card = game.hand[slot];
  if (!game.playable(card) && selected !== slot) hud.shake(slot);
  selected = selected === slot ? -1 : slot;
  valid = selected >= 0 ? new Set(game.validCells(selected)) : new Set();
  pending = -1; world.setGhost(-1, -1); world.setHover(-1);
  windArmed = false; windPending = -1;
  refresh();
  if (selected >= 0 && dicas?.active) {
    if (game.turn === 1 && valid.size) dicas.at('lugar');
    else if (card === Card.House) dicas.at('casa');
    else if (card === Card.Lantern) dicas.at(isB() ? 'luz' : 'lanterna');
    else if (!isB() && !game.playable(card)) dicas.at('descarte');
  }
}

/** Dados do que vai acontecer na noite desta jogada, calculados numa cópia (o núcleo não expõe quais lanternas apagaram). */
function predictDark(action: { kind: 'play'; slot: number; idx: number } | { kind: 'discard'; slot: number }): number[] {
  const c = gA().clone();
  if (action.kind === 'play') c.place(c.hand[action.slot], action.idx); else c.oil += RULES.discardOil;
  const others = c.lanterns.slice(1);
  const k = Math.min(others.length, Math.max(0, Math.floor((c.oil + c.oilIncome()) / RULES.nightOil)));
  return others.slice(k);
}

function afterMove(prevTurn: number, resBefore: number, lostBefore: Uint8Array, feastBefore: Uint8Array, cell: number, dark: number[]): void {
  const game = gA();
  selected = -1; valid = new Set(); pending = -1; windArmed = false; windPending = -1;
  world.setGhost(-1, -1); world.setHover(-1);
  world.sync(view, { origin: cell });
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
  newHand();
  refresh();
  dicas?.hide();
  if (dicas?.active && !game.over) {
    if (game.turn === 2) dicas.at('luz');
    else if (game.turn === 4 && game.wind > 0) dicas.at('vento');
    else if (game.turn >= 8 && game.turn <= 10) dicas.at('noite');
  }
  if (game.over) {
    endGame(reduced ? 200 : 2600);
    window.setTimeout(() => { world.setViewX(wideScreen() ? 0.09 : 0); world.orbit = !reduced; }, reduced ? 200 : 2600);
  }
}

function play(slot: number, idx: number): void {
  if (game.over) return;
  if (isB()) { playB(slot, idx); return; }
  const g = gA();
  const t = g.turn, res = g.residents(), lost = g.lost.slice(), feast = g.feast.slice();
  const dark = RULES.nights.includes(t) ? predictDark({ kind: 'play', slot, idx }) : [];
  const name = CARD_NAMES[g.hand[slot]];
  if (g.play(slot, idx)) { telemetry.play(name, CELLS[idx].q, CELLS[idx].r); afterMove(t, res, lost, feast, idx, dark); }
}
function discard(): void {
  if (isB() || selected < 0 || game.over) return;
  const g = gA();
  const t = g.turn, res = g.residents(), lost = g.lost.slice(), feast = g.feast.slice();
  const dark = RULES.nights.includes(t) ? predictDark({ kind: 'discard', slot: selected }) : [];
  const name = CARD_NAMES[g.hand[selected]];
  if (g.discard(selected)) { telemetry.discard(name); afterMove(t, res, lost, feast, -1, dark); }
}

// ---------- jogada da B ----------
function playB(slot: number, idx: number): void {
  const g = gB();
  const res = g.residents(), lvl = new Map(g.houses.map((h) => [h, g.levelAt(h)]));
  const litBefore = g.lit.slice(), marksBefore = g.landmarkCount();
  const card = g.hand[slot];
  if (!g.play(slot, idx)) return;
  telemetry.play(CARD_NAMES_B[card], CELLS[idx].q, CELLS[idx].r);
  selected = -1; valid = new Set(); pending = -1;
  world.setGhost(-1, -1); world.setHover(-1);
  world.sync(view, { origin: idx });
  if (forcedTurn === null) world.setDay(g.turn, g.over);
  const p0 = world.screenPos(idx, 1.4);
  const gain = g.residents() - res;
  if (gain > 0) hud.float(p0.x, p0.y, `+${gain} morador${gain > 1 ? 'es' : ''}`, false, 380);
  // casas que subiram de nível
  let k = 0;
  for (const [h, l] of lvl) {
    const l2 = g.levelAt(h);
    if (l2 > l) { const p = world.screenPos(h, 1.7); hud.float(p.x, p.y, `${HOUSE_NAMES_B[l2 - 1]}!`, false, 700 + k++ * 140); }
  }
  // marco novo na vila
  if (g.landmarkCount() > marksBefore) {
    const v = (view as ReturnType<typeof viewB>).villages().find((vv) => vv.cells.includes(idx));
    const nm = v ? LANDMARK_NAMES_B[Math.max(0, v.marks - 1)] : 'um marco';
    hud.toast(`A vila ganhou ${nm.toLowerCase() === 'praça' ? 'uma praça' : nm.toLowerCase() === 'capela' ? 'uma capela' : 'um poço'}! Cada marco vale +3 moradores.`, 4800);
  }
  // achados revelados pela luz: o presente
  const gifts: number[] = [];
  for (let i = 0; i < N; i++) if (g.lit[i] && !litBefore[i] && g.map.finds[i]) gifts.push(i);
  if (gifts.length) {
    const txt = gifts.map((i) => {
      const f = g.map.finds[i];
      return `${FIND_NAMES[f]}: ` + ['', '+3 moradores', 'as casas a 2 hexágonos contam Água', 'conta como tipo para as casas vizinhas', 'as casas a 2 hexágonos contam Campo'][f];
    }).join(' · ');
    hud.toast(`Achado! ${txt}.`, 5200);
  }
  newHand();
  refresh();
  dicas?.hide();
  if (dicas?.active && !g.over) {
    if (g.turn === 2) dicas.at('luz');
    else if (gifts.length) dicas.at('achado');
    else if (g.houses.length === 2) dicas.at('vila');
    else if (g.turn >= 27) dicas.at('noite');
  }
  if (g.over) {
    world.setNight(1);
    world.finale();
    endGame(reduced ? 200 : 3200);
    window.setTimeout(() => { world.setViewX(wideScreen() ? 0.09 : 0); world.orbit = !reduced; }, reduced ? 200 : 3200);
  }
}

// ---------- entrada no tabuleiro ----------
world.onHover = (cell) => {
  if (!playing) return;
  hover = cell;
  const ok = selected >= 0 && valid.has(cell);
  world.setHover(ok ? cell : -1);
  world.setGhost(ok ? game.hand[selected] : -1, ok ? cell : -1);
  // Nuvem alcançável pelo sopro: ela balança e a área que seria dissolvida se marca.
  const wind = !isB() && !ok && cell >= 0 && !game.over && gA().canBlow(cell);
  world.setWindMarks(windArmed ? windTargets() : [], wind ? Game.windArea(cell) : [], wind ? cell : -1);
  world.setCursor(wind ? 'pointer' : '');
  updateInfo();
};
world.onTap = (cell, e) => {
  if (!playing) return;
  if (cell < 0) {
    hover = -1; world.setHover(-1); world.setGhost(-1, -1); windPending = -1;
    if (world.isSky(e.clientX, e.clientY)) rainOnIsland(); else updateInfo();
    return;
  }
  const touch = e.pointerType !== 'mouse';
  const cardOk = !game.over && selected >= 0 && valid.has(cell);
  if (!isB() && !cardOk && !game.over && gA().canBlow(cell)) {
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
  if (!playing || $('exp').classList.contains('on')) return;
  if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.key >= '1' && e.key <= '3') select(Number(e.key) - 1);
  else if (e.key === 'Escape') { selected = -1; valid = new Set(); windArmed = false; windPending = -1; world.setGhost(-1, -1); world.setHover(-1); refresh(); }
  else if ((e.key === 'v' || e.key === 'V') && !isB()) toggleWind();
  else if (e.key === 'ArrowLeft') world.rotate(-0.18);
  else if (e.key === 'ArrowRight') world.rotate(0.18);
  else if (e.key === 'ArrowUp') world.rotate(0, 0.08);
  else if (e.key === 'ArrowDown') world.rotate(0, -0.08);
  else if (e.key === '+' || e.key === '=') world.zoomBy(0.88);
  else if (e.key === '-') world.zoomBy(1.12);
  else if ((e.key === 'd' || e.key === 'D') && !isB()) discard();
});

// A ilha fica centrada no espaço livre entre o topo e a mão de cartas.
function fitView(): void {
  if (!playing) return;
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
let seed0: number | null = parseSeed(params.get('seed'));
let auto0 = intParam('auto', 0, 60) ?? 0;
const dbg = auto0 > 0 || params.get('blow') === '1' || params.get('rain') === '1' || params.has('yaw') || params.has('pitch') || params.has('zoom') || params.has('focus') || params.has('select') || params.has('night') || params.has('turn') || params.has('aves');

function applyDebugCamera(): void {
  const yaw = floatParam('yaw', -7, 7), pol = floatParam('pitch', 0.3, 1.22), zoom = floatParam('zoom', 8, 60);
  const focus = params.get('focus');
  let cell = -1;
  if (focus === 'vila') cell = world.focusVillage();
  // Ganchos de captura: `?blow=1` sopra o vento no melhor alvo e congela a rajada no meio; `?rain=1` congela a chuva no meio.
  if (!isB() && params.get('blow') === '1') {
    const t = windMove(gA());
    const target = t >= 0 ? t : windTargets()[0] ?? -1;
    if (target >= 0) { blow(target); cell = target; world.holdAfter(floatParam('hold', 0.1, 9) ?? 0.5); }
  } else if (params.get('rain') === '1') { world.rain(); world.holdAfter(2.2); }
  if (params.has('aves')) world.flockNow();
  const sel = intParam('select', 0, 2);
  world.setCamera({ yaw: yaw ?? CAM_DEFAULT.yaw, pol: pol ?? CAM_DEFAULT.pol, dist: zoom ?? (dbg ? CAM_DEFAULT.dist : CAM_DEFAULT.dist * 1.35), cell });
  if (!dbg && !reduced) world.aim({ dist: CAM_DEFAULT.dist });
  if (sel !== null) select(sel);
  if (params.get('hover') === 'valid' && selected >= 0 && valid.size) {
    const c = [...valid].sort((a, b) => dist(a, CENTER) - dist(b, CENTER))[0];
    world.onHover(c);
  }
}

const forced = debugVariant(params);
if (forced) begin(forced);
else showChoose();

Object.defineProperty(window, '__stats', { get: () => world.stats });
Object.defineProperty(window, '__ready', { get: () => world.frames >= 4 });
Object.defineProperty(window, '__held', { get: () => world.held && world.frames >= 6 });
Object.defineProperty(window, '__frames', { get: () => world.frames });
Object.assign(window, { __world: world, __game: () => game, __cell: (i: number) => ({ x: cellX(i), z: cellZ(i) }), __cards: Card, __N: N, __variant: () => variant, __variantOf: variantOf, __begin: begin });

const fps = params.has('fps') ? new FpsMeter(world.renderer) : null;
let last = performance.now();
world.renderer.setAnimationLoop((now) => {
  const dt = (now - last) / 1000; last = now;
  world.frame(dt);
  fps?.tick(now);
});
