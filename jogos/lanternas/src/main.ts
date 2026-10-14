// Protótipo jogável com formas simples (three.js). A lógica toda mora em src/core.
import * as THREE from 'three';
import { CARD_NAMES, Game, GOAL_TITLES, RULES, Struct, cardRule, goalLabel, parseSeed } from './core/game';
import { CELLS, N } from './core/hex';
import { FIND_NAMES, Find, TERRAIN_NAMES } from './core/map';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

// ---------- estado ----------
let game: Game;
let selected = -1;           // slot da carta escolhida
let valid = new Set<number>();
let hover = -1;

function newSeed(): number { return Math.floor(Math.random() * 1_000_000_000); }
function startGame(seed: number): void {
  game = new Game(seed);
  selected = -1; valid = new Set(); hover = -1;
  const url = new URL(location.href);
  url.searchParams.set('seed', String(seed));
  history.replaceState(null, '', url);
  $('end').classList.remove('on');
  refresh();
}

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10151c);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
let yaw = 0, zoom = 17;
function placeCamera(): void {
  camera.position.set(Math.sin(yaw) * zoom * 0.55, zoom * 0.85, Math.cos(yaw) * zoom * 0.55);
  camera.lookAt(0, 0, 0);
}
scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x303028, 1.1));
const sun = new THREE.DirectionalLight(0xffe7c2, 1.6);
sun.position.set(6, 12, 4);
scene.add(sun);

const S3 = Math.sqrt(3);
const cellPos = (idx: number): THREE.Vector3 => new THREE.Vector3(1.5 * CELLS[idx].q, 0, S3 * (CELLS[idx].r + CELLS[idx].q / 2));

const HEX = new THREE.CylinderGeometry(0.96, 0.96, 1, 6);
HEX.rotateY(Math.PI / 6);
const mat = (c: number, emissive = 0): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color: c, emissive });
const M = {
  terrain: [mat(0x2f6f9f), mat(0xe2cf92), mat(0x7cb561), mat(0x2f6b3c), mat(0x8b8d93)],
  fog: mat(0x2b2f36),
  house: mat(0xd9a066), roof: mat(0xb34a3c), field: mat(0xe6c84a), olive: mat(0x6a7a3a), dock: mat(0x7a5233),
  lantern: mat(0xf2c14e, 0xf2c14e), pole: mat(0x3b3b3b), ruin: mat(0xb9b3a6), fish: mat(0xffffff, 0x88aaff),
  orchard: mat(0xd9453d), spring: mat(0x7fe3ff, 0x2a8fb0), tip: mat(0xf2c14e, 0xf2c14e),
  hl: new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.55 }),
  hover: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }),
};
const TERRAIN_H = [0.1, 0.25, 0.35, 0.4, 0.6];

interface CellView { base: THREE.Mesh; fog: THREE.Mesh; deco: THREE.Group; hl: THREE.Mesh }
const cells: CellView[] = [];
const pickables: THREE.Object3D[] = [];
const board = new THREE.Group();
scene.add(board);

for (let i = 0; i < N; i++) {
  const p = cellPos(i);
  const g = new THREE.Group();
  g.position.copy(p);
  const base = new THREE.Mesh(HEX, M.terrain[0]);
  base.userData.idx = i;
  const fog = new THREE.Mesh(HEX, M.fog);
  fog.scale.y = 0.9; fog.position.y = 0.45;
  fog.userData.idx = i;
  const hl = new THREE.Mesh(HEX, M.hl);
  hl.scale.set(0.98, 0.06, 0.98); hl.visible = false;
  const deco = new THREE.Group();
  g.add(base, fog, hl, deco);
  board.add(g);
  cells.push({ base, fog, deco, hl });
  pickables.push(base, fog);
}

function box(m: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  return o;
}
function cyl(m: THREE.Material, rt: number, rb: number, h: number, x = 0, y = 0, z = 0, seg = 12): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y, z);
  return o;
}

function syncCell(i: number): void {
  const v = cells[i];
  const t = game.map.terrain[i];
  const h = TERRAIN_H[t];
  const revealed = game.revealed[i] === 1;
  v.base.material = M.terrain[t];
  v.base.scale.y = h; v.base.position.y = h / 2 - 0.5 + 0.5;
  // A névoa cobre o que não foi revelado.
  v.fog.visible = !revealed;
  v.fog.position.y = h + 0.3; v.fog.scale.y = 0.6;
  v.hl.position.y = h + 0.04;
  v.deco.clear();
  v.deco.position.y = h;
  const top = 0;
  const s = game.struct[i];
  if (revealed) {
    if (s === Struct.House) {
      const r = game.houseResidents(i);
      v.deco.add(box(M.house, 0.8, 0.35 + 0.12 * r, 0.8, 0, (0.35 + 0.12 * r) / 2 + top, 0));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.35, 4), M.roof);
      roof.rotation.y = Math.PI / 4; roof.position.y = 0.35 + 0.12 * r + 0.17;
      v.deco.add(roof);
    } else if (s === Struct.Field) {
      v.deco.add(box(M.field, 1.2, 0.08, 1.2, 0, 0.04, 0));
    } else if (s === Struct.Olive) {
      v.deco.add(cyl(M.pole, 0.06, 0.06, 0.4, 0, 0.2, 0, 6), new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), M.olive));
      v.deco.children[1].position.y = 0.55;
    } else if (s === Struct.Lantern) {
      v.deco.add(cyl(M.pole, 0.08, 0.08, 0.9, 0, 0.45, 0, 8));
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), M.lantern);
      lamp.position.y = 1.0;
      v.deco.add(lamp);
    } else if (s === Struct.Dock) {
      v.deco.add(box(M.dock, 1.1, 0.1, 0.5, 0, 0.1, 0));
    }
    const f = game.map.finds[i];
    if (f === Find.Ruin) v.deco.add(cyl(M.ruin, 0.3, 0.4, 0.7, 0, 0.35, 0, 5));
    if (f === Find.Fish) v.deco.add(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 6, 14), M.fish));
    if (f === Find.Orchard) { v.deco.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.orchard)); v.deco.children[v.deco.children.length - 1].position.y = 0.4; }
    if (f === Find.Spring) v.deco.add(cyl(M.spring, 0.4, 0.4, 0.12, 0, 0.06, 0));
    if (f === Find.Fish) v.deco.children[v.deco.children.length - 1].rotation.x = Math.PI / 2;
  }
  // A ponta marcada aparece mesmo sob a névoa.
  if (i === game.map.tip && s !== Struct.Lantern) {
    const m = cyl(M.tip, 0.05, 0.05, 1.6, 0, 0.8 + (revealed ? 0 : 0.3), 0, 6);
    const ball = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), M.tip);
    ball.position.y = 1.7 + (revealed ? 0 : 0.3);
    v.deco.add(m, ball);
  }
  v.hl.visible = valid.has(i);
}

// ---------- HUD ----------
function describe(i: number): string {
  if (i < 0) return '';
  const { q, r } = CELLS[i];
  if (!game.revealed[i]) return `(${q}, ${r}) névoa${i === game.map.tip ? ' · ponta marcada' : ''}`;
  const parts = [TERRAIN_NAMES[game.map.terrain[i]]];
  const s = game.struct[i];
  if (s === Struct.House) parts.push(`Casa com ${game.houseResidents(i)} morador(es)${game.houseLit(i) ? ', sob a luz' : ', fora da luz'}`);
  else if (s !== Struct.None) parts.push(['', 'Casa', 'Campo', 'Oliveiral', 'Lanterna', 'Cais'][s]);
  const f = game.map.finds[i];
  if (f) parts.push(FIND_NAMES[f]);
  if (i === game.map.tip) parts.push('ponta marcada');
  return `(${q}, ${r}) ` + parts.join(' · ');
}

function refresh(): void {
  const g = game;
  for (let i = 0; i < N; i++) syncCell(i);
  const fi = g.foodIncome(), oi = g.oilIncome();
  $('stats').innerHTML =
    `<span>Turno <b>${Math.min(g.turn, RULES.turns)}</b>/${RULES.turns}</span>` +
    `<span>Óleo <b>${g.oil}</b> <small>(+${oi})</small></span>` +
    `<span>Comida <b>${g.food}</b> <small>(+${fi})</small></span>` +
    `<span>Moradores <b>${g.residents()}</b></span>` +
    `<span>Pontos <b>${g.score()}</b></span>`;
  $('goals').innerHTML = '<h3>Metas (+' + RULES.goalPoints + ' cada)</h3><ul>' + g.goals.map((id) => {
    const done = g.goalMet(id);
    let prog = '';
    if (id === 1) prog = `${g.residents()}/${g.goalTarget}`;
    if (id === 2) prog = `${g.foundCount}/${RULES.findsGoal}`;
    if (id === 3) prog = `${g.longestRow()}/${RULES.rowGoal}`;
    if (id === 4) prog = `${Math.round(g.litFraction() * 100)}%`;
    return `<li class="${done ? 'done' : ''}">${done ? '✔' : '○'} ${goalLabel(id)} <small>${prog}</small></li>`;
  }).join('') + '</ul>';
  $('seed').textContent = 'semente ' + g.seed;
  const hand = $('hand');
  hand.innerHTML = '';
  if (!g.over) {
    g.hand.forEach((c, slot) => {
      const ok = g.playable(c);
      const b = document.createElement('button');
      b.className = 'card' + (slot === selected ? ' sel' : '') + (ok ? '' : ' off');
      b.innerHTML = `<kbd>${slot + 1}</kbd><h4>${CARD_NAMES[c]}</h4><p>${cardRule(c)}${ok ? '' : '<br><em>Sem lugar ou recurso agora.</em>'}</p>`;
      b.onclick = () => select(slot);
      hand.appendChild(b);
    });
  }
  ($('discard') as HTMLButtonElement).disabled = selected < 0 || g.over;
  $('info').textContent = describe(hover);
  if (g.over) {
    const s = g.summary();
    $('endText').innerHTML = `<p>Pontuação final: <b>${s.score}</b> (${s.residents} moradores + ${s.goalsMet.filter(Boolean).length} meta(s) × ${RULES.goalPoints})</p>` +
      `<p>${s.goals.map((id, k) => `${s.goalsMet[k] ? '✔' : '✘'} ${GOAL_TITLES[id]}`).join('<br>')}</p><p>Ilha revelada: ${Math.round(s.litPct * 100)}%</p>`;
    $('end').classList.add('on');
  }
}

function select(slot: number): void {
  if (game.over || slot >= game.hand.length) return;
  selected = selected === slot ? -1 : slot;
  valid = selected >= 0 ? new Set(game.validCells(selected)) : new Set();
  refresh();
}

let toastTimer = 0;
function toast(text: string): void {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('on'), 3500);
}

function afterMove(prevTurn: number): void {
  selected = -1; valid = new Set();
  if (RULES.nights.includes(prevTurn)) toast(`Noite do turno ${prevTurn}: lanternas queimaram óleo; casas fora da luz perderam moradores.`);
  refresh();
}

$('discard').onclick = () => {
  if (selected < 0) return;
  const t = game.turn;
  game.discard(selected);
  afterMove(t);
};
$('new').onclick = () => startGame(newSeed());
$('again').onclick = () => startGame(newSeed());
addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '3') select(Number(e.key) - 1);
  if (e.key === 'Escape') { selected = -1; valid = new Set(); refresh(); }
});

// ---------- entrada no tabuleiro ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(ev: PointerEvent): number {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, false).find((h) => (h.object as THREE.Mesh).visible !== false);
  return hit ? (hit.object.userData.idx as number) : -1;
}
let drag: { x: number; yaw: number; moved: boolean } | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, yaw, moved: false }; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (drag) {
    if (Math.abs(e.clientX - drag.x) > 5) drag.moved = true;
    if (drag.moved) { yaw = drag.yaw - (e.clientX - drag.x) * 0.006; placeCamera(); return; }
  }
  const i = pick(e);
  if (i !== hover) { hover = i; $('info').textContent = describe(hover); }
});
renderer.domElement.addEventListener('pointerup', (e) => {
  const moved = drag?.moved;
  drag = null;
  if (moved || game.over || selected < 0) return;
  const i = pick(e);
  if (i >= 0 && valid.has(i)) {
    const t = game.turn;
    game.play(selected, i);
    afterMove(t);
  }
});
renderer.domElement.addEventListener('wheel', (e) => {
  zoom = Math.min(30, Math.max(8, zoom * (e.deltaY > 0 ? 1.08 : 0.92)));
  placeCamera();
  e.preventDefault();
}, { passive: false });

function resize(): void {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// Hexágonos válidos pulsam de leve.
renderer.setAnimationLoop((t) => {
  M.hl.opacity = 0.45 + 0.2 * Math.sin(t / 250);
  renderer.render(scene, camera);
});

resize();
placeCamera();


startGame(parseSeed(new URL(location.href).searchParams.get('seed')) ?? newSeed());
