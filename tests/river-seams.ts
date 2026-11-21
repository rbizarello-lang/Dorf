import { Board, DEFAULT_RULES } from '../src/core/board';
import { T, type TileDef } from '../src/core/tiles';
import { buildTile } from '../src/render/tileBuilder';
import { World } from '../src/render/world';
import { THEMES } from '../src/themes/themes';

type Point = readonly [number, number];
type Mouth = readonly [number, number];
type Placement = { q: number; r: number; def: TileDef; rot: number };
type WaterSlot = {
  start: number;
  count: number;
  chunk: { water: { geometry: {
    drawRange: { start: number; count: number };
    getAttribute(name: 'position' | 'wbed'): { array: ArrayLike<number> };
  } } };
};

const W = T.Water, G = T.Grass;
const theme = THEMES.find((t) => t.id === 'holanda')!;
const root3 = Math.sqrt(3);
const directions: readonly Point[] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const EPS = 0.002;
const MIN_GROWTH = 0.02;

function frame(q: number, r: number, side: number) {
  const angle = Math.PI / 6 + side * Math.PI / 3;
  const x = Math.cos(angle), z = Math.sin(angle);
  return { x, z, mx: 1.5 * q + x * root3 / 2, mz: root3 * (r + q / 2) + z * root3 / 2 };
}

// Projeta a malha real na tangente da borda. Os vértices molhados da emenda pertencem a
// triângulos do rio. A profundidade assinada delimita as margens dentro desses triângulos.
function mouth(vertices: ArrayLike<number>, depths: ArrayLike<number>, start: number, count: number, q: number, r: number, side: number): Mouth {
  const { x, z, mx, mz } = frame(q, r, side);
  const samples = new Map<number, number>();
  for (let i = start * 3; i < (start + count) * 3; i += 3) {
    const dx = vertices[i] - mx, dz = vertices[i + 2] - mz;
    if (Math.abs(dx * x + dz * z) > 1e-5) continue;
    const t = dx * -z + dz * x;
    if (Math.abs(t) > 0.5 + 1e-5) continue;
    const k = Math.round(t * 1e5) / 1e5;
    samples.set(k, Math.max(samples.get(k) ?? -Infinity, depths[i / 3 * 4 + 3]));
  }
  const points = [...samples].sort(([a], [b]) => a - b);
  const first = points.findIndex(([, d]) => d > 0);
  const last = points.length - 1 - [...points].reverse().findIndex(([, d]) => d > 0);
  const shoreline = ([a, da]: number[], [b, db]: number[]) => a + (b - a) * da / (da - db);
  if (first <= 0 || last >= points.length - 1) throw new Error('a profundidade da malha não delimitou as duas margens');
  const left = shoreline(points[first - 1], points[first]);
  const right = shoreline(points[last], points[last + 1]);
  if (right <= left) throw new Error(`boca ausente em (${q},${r}), borda ${side}`);
  return [left, right];
}

const equal = (a: Mouth, b: Mouth) => Math.abs(a[0] - b[0]) <= EPS && Math.abs(a[1] - b[1]) <= EPS;
const width = (m: Mouth) => m[1] - m[0];
const show = (m: Mouth) => width(m).toFixed(4);
const oppositeMouth = (m: Mouth): Mouth => [-m[1], -m[0]];

export async function run(control = false) {
  const errors: string[] = [];
  const observations: string[] = [];
  const check = (condition: boolean, label: string) => { if (!condition) errors.push(label); };

  // Controle positivo e negativo do oráculo geométrico, com larguras absolutas conhecidas.
  const measure = (half: number, side: number) => {
    const g = buildTile([W, G, G, W, G, G], 11, theme, { detail: 0.4, houses: [], widths: [half, 0, 0, half, 0, 0] });
    return mouth(g.water, g.wbed, 0, g.water.length / 3, 0, 0, side);
  };
  const narrow = measure(0.13, 0), same = oppositeMouth(measure(0.13, 3)), wide = oppositeMouth(measure(0.25, 3));
  check(equal(narrow, same), 'controle: larguras iguais devem casar');
  check(!equal(narrow, wide), 'controle: larguras incompatíveis devem divergir');
  check(Math.abs(width(narrow) - 0.26) < 1 / 12 && Math.abs(width(wide) - 0.50) < 1 / 12,
    `controle: larguras absolutas 0,26 e 0,50, medido ${show(narrow)} e ${show(wide)}`);
  observations.push(`oráculo: igualdade ${show(narrow)}/${show(same)}, incompatibilidade ${show(narrow)}/${show(wide)}`);

  const canvas = document.createElement('canvas');
  const world = await World.create(canvas, true);
  world.timeScale = 0;
  const internal = world as unknown as {
    waterSlots: Map<number, WaterSlot>;
    ghost: { build: { water: Float32Array; wbed: Float32Array } } | null;
    neighborsChanging(def: TileDef, q: number, r: number, rot: number): {
      grow: { q: number; r: number }[]; rise: { q: number; r: number }[];
    };
  };
  const checkRanges = (label: string) => {
    const chunks = new Map<WaterSlot['chunk'], WaterSlot[]>();
    for (const slot of internal.waterSlots.values()) {
      const ranges = chunks.get(slot.chunk) ?? [];
      ranges.push(slot);
      chunks.set(slot.chunk, ranges);
    }
    for (const [chunk, ranges] of chunks) {
      const geometry = chunk.water.geometry;
      const p = geometry.getAttribute('position').array;
      const drawn = geometry.drawRange.start + geometry.drawRange.count;
      const owned = new Uint8Array(drawn);
      for (const { start, count } of ranges) {
        check(start + count <= drawn, label + ': faixa de água fora do desenho');
        for (let v = start; v < start + count; v++) owned[v]++;
      }
      for (let v = 0; v < drawn; v += 3) {
        const i = 3 * v;
        const dead = [0, 1, 2].every(k => p[i + k] === p[i + k + 3] && p[i + k] === p[i + k + 6]);
        if (owned[v] > 1 || (!owned[v] && !dead)) {
          errors.push(label + ': faixa de água sobreposta ou triângulo antigo visível');
          break;
        }
      }
    }
  };
  const stage = (p: Placement, board: Board, side: number) => {
    const slot = internal.waterSlots.get(board.get(p.q, p.r)!.key);
    if (!slot) throw new Error(`água não assentada em ${p.q},${p.r}`);
    const g = slot.chunk.water.geometry;
    return mouth(g.getAttribute('position').array, g.getAttribute('wbed').array, slot.start, slot.count, p.q, p.r, side);
  };
  const paired = (a: Placement, b: Placement, board: Board, side: number, label: string) => {
    const left = stage(a, board, side);
    const right = oppositeMouth(stage(b, board, (side + 3) % 6));
    check(equal(left, right), `${label}: emenda ${show(left)} contra ${show(right)}`);
    return left;
  };
  const play = (board: Board, p: Placement) => {
    check(board.checkDef(p.q, p.r, p.def, p.rot).valid, `jogada inválida em ${p.q},${p.r}, giro ${p.rot}`);
    const { placed } = board.place(p.q, p.r, p.def, p.rot);
    world.placeAnimated(placed);
    world.seekDrops(5);
    for (let i = 0; i < 12; i++) {
      world.tick(0);
      const { drops, queue } = world.pending();
      if (!drops && !queue) return;
    }
    throw new Error('a cena não terminou de assentar');
  };
  const preview = (board: Board, p: Placement, side: number) => {
    world.setGhost(p.def, p.rot, p.rot * Math.PI / 3, p.q, p.r, board.checkDef(p.q, p.r, p.def, p.rot));
    const g = internal.ghost!.build;
    return mouth(g.water, g.wbed, 0, g.water.length / 3, 0, 0, (side - p.rot + 6) % 6);
  };

  for (const side of [0, 1, 5]) {
    const [q, r] = directions[side];
    const a: Placement = { q: 0, r: 0, def: { seed: 11, edges: [W, G, G, W, G, G], quest: null }, rot: side };
    const b: Placement = { q, r, def: { seed: 123, edges: [G, W, G, G, G, G], quest: null }, rot: (side + 2) % 6 };
    const c: Placement = { q: -q, r: -r, def: { seed: 42, edges: [G, G, W, G, G, G], quest: null }, rot: (side + 4) % 6 };
    const widthsByOrder: Mouth[][] = [];
    for (const order of [[a, b, c], [b, a, c]]) {
      const label = `borda ${side}, ${order[0] === a ? 'A/B' : 'B/A'}`;
      const [first, second, third] = order;
      const setup = (viva: boolean) => {
        const board = new Board({ ...DEFAULT_RULES });
        board.placeRaw(first.q, first.r, first.def, first.rot);
        world.setViva(viva, board);
        world.setTheme(theme, board);
        return board;
      };
      const plain = setup(false);
      play(plain, second);
      const base = paired(a, b, plain, side, `${label} sem Viva`);
      const board = setup(true);
      const before = stage(first, board, first === a ? side : (side + 3) % 6);
      const secondSide = second === a ? side : (side + 3) % 6;
      const ghost = preview(board, second, secondSide);
      play(board, second);
      const joined = paired(a, b, board, side, `${label} com Viva`);
      check(equal(ghost, stage(second, board, secondSide)), `${label}: largura do fantasma mudou no pouso`);
      if (!control) check(width(joined) > width(base) + MIN_GROWTH, `${label}: alargamento da emenda ${show(base)} → ${show(joined)}`);
      if (!control) check(width(joined) > width(before) + MIN_GROWTH, `${label}: a peça já assentada não alargou ${show(before)} → ${show(joined)}`);
      const open = stage(a, board, (side + 3) % 6);
      check(equal(stage(a, plain, (side + 3) % 6), open), `${label}: a boca aberta mudou sem um encaixe`);
      const forecast = internal.neighborsChanging(third.def, third.q, third.r, third.rot);
      if (!control) check(forecast.grow.some(({ q, r }) => q === b.q && r === b.r), `${label}: antevisão omitiu a vizinha da vizinha`);
      play(board, third);
      const extended = paired(a, b, board, side, `${label} após a outra conexão`);
      const other = paired(a, c, board, (side + 3) % 6, `${label} na segunda emenda`);
      if (!control) check(width(other) > width(open) + MIN_GROWTH, `${label}: segunda emenda ${show(open)} → ${show(other)}`);
      if (!control) check(width(extended) > width(joined) + MIN_GROWTH,
        `${label}: o estágio novo também deve alargar a emenda anterior ${show(joined)} → ${show(extended)}`);
      checkRanges(label);
      widthsByOrder.push([joined, extended, other]);
      const compareScene = (b2: Board, step: string) => {
        const x = paired(a, b, b2, side, `${label} ${step}`);
        const y = paired(a, c, b2, (side + 3) % 6, `${label} ${step} na segunda emenda`);
        check(equal(x, extended) && equal(y, other), `${label} ${step}: largura final mudou`);
      };
      world.rebuild(board);
      compareScene(board, 'reconstrução');
      const replay = new Board({ ...DEFAULT_RULES });
      replay.placeRaw(first.q, first.r, first.def, first.rot);
      for (const p of [second, third]) replay.place(p.q, p.r, p.def, p.rot);
      world.rebuild(replay);
      compareScene(replay, 'replay');
      observations.push(`${label}: sem Viva ${show(base)}, ligada ${show(joined)}, estendida ${show(extended)}/${show(other)}`);
    }
    if (!control) check(widthsByOrder[0].every((value, i) => equal(value, widthsByOrder[1][i])), `borda ${side}: inverter a ordem mudou a largura`);
  }
  return { observations, errors };
}
