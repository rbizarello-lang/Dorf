import { Vector3 } from 'three/webgpu';

/** Faixa da malha de água do bloco, já girada, deformada e na cota da peça. */
export interface FreightWater {
  pos: Float32Array;
  bed: Float32Array;
  start: number;
  count: number;
}

type Point = { x: number; z: number };
type Triangle = { x: number; z: number; ux: number; uz: number; vx: number; vz: number; det: number; y: number; yu: number; yv: number; d: number; du: number; dv: number };

const STEP = 0.04;
const WET = 0.004;
const FLOAT = 0.053;
const key = (x: number, z: number) => x * 0x1000000 + z;
const around = (p: Point) => [Math.round(p.x / STEP), Math.round(p.z / STEP)] as const;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/** A água vai até o corte de profundidade zero no shader, que pode atravessar um triângulo. */
function* waterSurface(water: readonly FreightWater[]) {
  const binSize = 0.2;
  const bins = new Map<number, Triangle[]>();
  let visited = 0;
  for (const { pos, bed, start, count } of water) {
    for (let v = start; v < start + count; v += 3) {
      if (++visited % 512 === 0) yield;
      const i = v * 3;
      const x = pos[i], y = pos[i + 1], z = pos[i + 2], bx = pos[i + 3], bz = pos[i + 5], cx = pos[i + 6], cz = pos[i + 8];
      const d = bed[v * 4 + 3], b = bed[v * 4 + 7], c = bed[v * 4 + 11];
      const ux = bx - x, uz = bz - z, vx = cx - x, vz = cz - z, det = ux * vz - uz * vx;
      if (Math.abs(det) < 1e-8 || Math.max(d, b, c) < WET) continue;
      const t = { x, z, ux, uz, vx, vz, det, y, yu: pos[i + 4] - y, yv: pos[i + 7] - y, d, du: b - d, dv: c - d };
      for (let j = Math.floor(Math.min(z, bz, cz) / binSize); j <= Math.floor(Math.max(z, bz, cz) / binSize); j++) {
        for (let i = Math.floor(Math.min(x, bx, cx) / binSize); i <= Math.floor(Math.max(x, bx, cx) / binSize); i++) {
          const k = key(i, j);
          const bin = bins.get(k);
          if (bin) bin.push(t);
          else bins.set(k, [t]);
        }
      }
    }
  }
  return (x: number, z: number) => {
    let y = NaN, depth = WET;
    const bin = bins.get(key(Math.floor(x / binSize), Math.floor(z / binSize)));
    for (const t of bin ?? []) {
      const dx = x - t.x, dz = z - t.z;
      const u = (dx * t.vz - dz * t.vx) / t.det, v = (t.ux * dz - t.uz * dx) / t.det;
      if (u < -1e-5 || v < -1e-5 || u + v > 1 + 1e-5) continue;
      const d = t.d + t.du * u + t.dv * v;
      if (d < depth) continue;
      depth = d;
      y = t.y + t.yu * u + t.yv * v;
    }
    return y;
  };
}

interface Cell extends Point {
  i: number;
  j: number;
  y: number;
  clearance: number;
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]] as const;

/** Mantém as emendas da viagem lógica e escolhe o lado navegável das ilhas e dos meandros. */
export function* freightRoute(water: readonly FreightWater[], waypoints: readonly Point[]): Generator<void, Vector3[]> {
  const surface = yield* waterSurface(water);
  const cells = new Map<number, Cell | null>();
  const heights = new Map<number, number>();
  const gridHeight = (i: number, j: number) => {
    const k = key(i, j);
    const old = heights.get(k);
    if (old !== undefined) return old;
    const y = surface(i * STEP, j * STEP);
    heights.set(k, y);
    return y;
  };
  const cellAt = (i: number, j: number) => {
    const k = key(i, j);
    const old = cells.get(k);
    if (old !== undefined) return old;
    const x = i * STEP, z = j * STEP, y = gridHeight(i, j);
    let clearance = 0;
    if (Number.isFinite(y)) {
      for (let d = 1; d <= 3; d++) {
        if (!DIRS.every(([a, b]) => Number.isFinite(gridHeight(i + a * d, j + b * d)))) break;
        clearance = d * STEP;
      }
    }
    const cell = Number.isFinite(y) ? { i, j, x, z, y, clearance } : null;
    cells.set(k, cell);
    return cell;
  };
  function* nearest(p: Point, radius: number) {
    const [ix, iz] = around(p);
    let best: Cell | null = null, cost = Infinity, candidates = 0;
    for (let j = -radius; j <= radius; j++) for (let i = -radius; i <= radius; i++) {
      if (++candidates % 64 === 0) yield;
      const c = cellAt(ix + i, iz + j);
      if (!c) continue;
      const n = distance(c, p) + 3 * Math.max(0, 0.12 - c.clearance);
      if (n < cost) {
        best = c;
        cost = n;
      }
    }
    return best;
  }
  const anchors: Cell[] = [];
  for (const [i, p] of waypoints.entries()) {
    const anchor = yield* nearest(p, i === 0 || i === waypoints.length - 1 ? 10 : 2);
    if (!anchor) return [];
    anchors.push(anchor);
  }
  const route: Cell[] = [];
  const edgeWet = (a: Cell, b: Cell) => Number.isFinite(surface((a.x + b.x) / 2, (a.z + b.z) / 2));
  function* search(source: Cell, goal: Cell): Generator<void, Cell[]> {
    const open = [{ cell: source, score: distance(source, goal) }];
    const costs = new Map([[source, 0]]);
    const parents = new Map<Cell, Cell>();
    let explored = 0;
    while (open.length) {
      if (++explored % 32 === 0) yield;
      let best = 0;
      for (let i = 1; i < open.length; i++) if (open[i].score < open[best].score) best = i;
      const current = open.splice(best, 1)[0].cell;
      if (current === goal) {
        const path = [goal];
        while (path.at(-1) !== source) path.push(parents.get(path.at(-1)!)!);
        return path.reverse();
      }
      for (const [i, j] of DIRS) {
        const next = cellAt(current.i + i, current.j + j);
        if (!next || !edgeWet(current, next)) continue;
        const g = costs.get(current)! + distance(current, next) * (1 + 18 * Math.max(0, 0.12 - next.clearance));
        if (g >= (costs.get(next) ?? Infinity)) continue;
        costs.set(next, g);
        parents.set(next, current);
        const item = open.find((e) => e.cell === next);
        const score = g + distance(next, goal);
        if (item) item.score = score;
        else open.push({ cell: next, score });
      }
    }
    return [];
  }
  for (let i = 1; i < anchors.length; i++) {
    const path = yield* search(anchors[i - 1], anchors[i]);
    if (!path.length) return [];
    route.push(...(i === 1 ? path : path.slice(1)));
  }
  // Encurta as escadinhas da grade sem cortar margem. Reamostra em trechos curtos
  // para preservar a cota desenhada, inclusive quando a superfície muda de altura.
  const points: Vector3[] = [];
  const samples = (a: Cell, b: Cell, cut: boolean) => {
    const d = distance(a, b);
    const n = Math.ceil(d / (STEP * 0.5));
    const out: Vector3[] = [];
    const margin = 0.105;
    const ox = ((b.z - a.z) / d) * margin, oz = ((a.x - b.x) / d) * margin;
    for (let i = 1; i <= n; i++) {
      const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
      const y = surface(x, z);
      if (!Number.isFinite(y) || (cut && (!Number.isFinite(surface(x + ox, z + oz)) || !Number.isFinite(surface(x - ox, z - oz))))) return [];
      out.push(new Vector3(x, y + FLOAT, z));
    }
    return out;
  };
  if (route.length) points.push(new Vector3(route[0].x, route[0].y + FLOAT, route[0].z));
  let simplified = 0;
  for (let i = 0; i + 1 < route.length;) {
    if (++simplified % 8 === 0) yield;
    let j = Math.min(i + 12, route.length - 1), line: Vector3[] = [];
    for (; j > i; j--) {
      line = samples(route[i], route[j], j > i + 1);
      if (line.length) break;
    }
    if (!line.length) return [];
    points.push(...line);
    i = j;
  }
  return points;
}

/** Distância acumulada da polilinha, sem criar uma curva por amostra. */
export class FreightTrack {
  private readonly cum = [0];
  private readonly back = new Vector3();
  private readonly next = new Vector3();
  readonly length: number;

  constructor(private readonly points: readonly Vector3[]) {
    for (let i = 1; i < points.length; i++) this.cum.push(this.cum[i - 1] + points[i].distanceTo(points[i - 1]));
    this.length = this.cum[this.cum.length - 1];
  }

  private point(distance: number, out: Vector3) {
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= distance) lo = mid;
      else hi = mid;
    }
    out.lerpVectors(this.points[lo], this.points[hi], (distance - this.cum[lo]) / (this.cum[hi] - this.cum[lo]));
  }

  pose(distance: number, out: Vector3) {
    this.point(distance, out);
    // Um rumo médio evita que a vela gire a cada degrau da amostragem.
    this.point(Math.max(0, distance - 0.12), this.back);
    this.point(Math.min(this.length, distance + 0.12), this.next);
    return Math.atan2(this.next.x - this.back.x, this.next.z - this.back.z);
  }
}
