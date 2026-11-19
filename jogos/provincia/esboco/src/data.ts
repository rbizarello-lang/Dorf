// Dados da província: a grade hexagonal, as 19 regiões em colmeia, os caminhos do rio e das estradas
// e o que está fundado em cada semana. Puro (sem three nem DOM), tudo determinístico.

// ---------- grade hexagonal (topo plano, raio 1) ----------
export const DIRS: Array<[number, number]> = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
export const cellX = (q: number): number => 1.5 * q;
export const cellZ = (q: number, r: number): number => 0.8660254 * q + 1.7320508 * r;
export const ckey = (q: number, r: number): string => q + ',' + r;
export const hexDist = (q: number, r: number): number => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));

/** Do ponto do mundo para a célula (arredondamento cúbico). */
export function worldToCell(x: number, z: number): [number, number] {
  const qf = x / 1.5, rf = (z - 0.8660254 * qf) / 1.7320508, sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return [q, r];
}

// ---------- ruído e acaso ----------
export function hash2(a: number, b: number, s = 0): number {
  let h = Math.imul(Math.round(a * 1000) | 0, 374761393) ^ Math.imul(Math.round(b * 1000) | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x: number, y: number, s = 0): number {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, s), b = hash2(x0 + 1, y0, s), c = hash2(x0, y0 + 1, s), d = hash2(x0 + 1, y0 + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- regiões ----------
export type Theme = 'capital' | 'trigo' | 'foz' | 'moinhos' | 'serra' | 'bosque' | 'charneca' | 'pedregal' | 'marisma' | 'dunas' | 'campina' | 'lago' | 'mata';
export interface Region {
  id: string; name: string; theme: Theme;
  q: number; r: number; x: number; z: number;
  cells: Array<[number, number]>;
}

const SUPER: Array<[number, number]> = [[3, 2], [-2, 5], [-5, 3], [-3, -2], [2, -5], [5, -3]];
// id, nome, tema. Os 7 primeiros são o centro e o primeiro anel; os 12 de fora são o segundo anel.
const RING1 = [
  ['A', 'Foz do Lume', 'foz'], ['B', 'Campos de Moinho', 'moinhos'], ['W', 'Serra Pequena', 'serra'],
  ['D', 'Charneca Cinzenta', 'charneca'], ['E', 'Bosque Fundo', 'bosque'], ['F', 'Vale do Trigo', 'trigo'],
] as const;
const RING2: Array<[string, string, Theme]> = [
  ['A2', 'Dunas do Sul', 'dunas'], ['AB', 'Enseada Quieta', 'lago'], ['B2', 'Várzea Mansa', 'campina'], ['BW', 'Brejo dos Juncos', 'marisma'],
  ['W2', 'Penhasco do Vento', 'pedregal'], ['WD', 'Mata Fechada', 'mata'], ['D2', 'Alto da Neblina', 'pedregal'], ['DE', 'Campina Velha', 'campina'],
  ['E2', 'Serrania do Corvo', 'pedregal'], ['EF', 'Pedregal do Corvo', 'pedregal'], ['F2', 'Lagoa dos Patos', 'lago'], ['FA', 'Colina do Sino', 'campina'],
];

function buildRegions(): Region[] {
  const defs: Array<{ id: string; name: string; theme: Theme; q: number; r: number }> = [{ id: 'C', name: 'Alvorada', theme: 'capital', q: 0, r: 0 }];
  RING1.forEach(([id, name, theme], i) => defs.push({ id, name, theme, q: SUPER[i][0], r: SUPER[i][1] }));
  // anel de fora: 2V_i e V_i + V_{i+1}, na ordem em volta do mapa (A2, AB, B2, BW, W2, WD, D2, DE, E2, EF, F2, FA)
  for (let i = 0; i < 6; i++) {
    const a = SUPER[i], b = SUPER[(i + 1) % 6];
    const [id1, n1, t1] = RING2[i * 2], [id2, n2, t2] = RING2[i * 2 + 1];
    defs.push({ id: id1, name: n1, theme: t1, q: 2 * a[0], r: 2 * a[1] });
    defs.push({ id: id2, name: n2, theme: t2, q: a[0] + b[0], r: a[1] + b[1] });
  }
  const regions: Region[] = defs.map((d) => ({ ...d, x: cellX(d.q), z: cellZ(d.q, d.r), cells: [] }));
  // Os 19 espaços da capital são exatos; o resto é um Voronoi com a borda torcida por ruído, o que dá regiões irregulares.
  const owner = new Map<string, number>();
  const R = 12;
  for (let q = -R; q <= R; q++) for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
    const x = cellX(q), z = cellZ(q, r);
    if (hexDist(q, r) <= 2) { owner.set(ckey(q, r), 0); continue; }
    const wx = x + (noise2(x * 0.23, z * 0.23, 5) - 0.5) * 2.4, wz = z + (noise2(x * 0.23 + 9, z * 0.23 + 3, 6) - 0.5) * 2.4;
    let best = -1, bd = 1e9, d2min = 1e9;
    regions.forEach((g, i) => {
      if (i === 0) { const dd = Math.hypot(wx - g.x, wz - g.z) + 0.5; d2min = Math.min(d2min, dd); if (dd < bd) { bd = dd; best = i; } return; }
      const dd = Math.hypot(wx - g.x, wz - g.z);
      if (dd < bd) { bd = dd; best = i; }
    });
    const dc = Math.hypot(x, z);
    const near = Math.hypot(x - regions[best].x, z - regions[best].z);
    const coast = 3.3 + noise2(x * 0.17, z * 0.17, 11) * 2.2 - Math.max(0, dc - 14) * 0.1;
    const inner = dc < 12.6 && near < 4.6;
    if (inner || near < coast) owner.set(ckey(q, r), best);
  }
  for (const [k, i] of owner) { const [q, r] = k.split(',').map(Number); regions[i].cells.push([q, r]); }
  return regions;
}

export const REGIONS: Region[] = buildRegions();
export const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]));
export const CELL_REGION = new Map<string, Region>();
for (const g of REGIONS) for (const [q, r] of g.cells) CELL_REGION.set(ckey(q, r), g);
export const regionAt = (x: number, z: number): Region | undefined => { const [q, r] = worldToCell(x, z); return CELL_REGION.get(ckey(q, r)); };

// caixa da folha de pergaminho
export const SHEET = (() => {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const g of REGIONS) for (const [q, r] of g.cells) { x0 = Math.min(x0, cellX(q)); x1 = Math.max(x1, cellX(q)); z0 = Math.min(z0, cellZ(q, r)); z1 = Math.max(z1, cellZ(q, r)); }
  const m = 4.6;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0 + 2 * m, d = z1 - z0 + 2 * m;
  return { cx, cz, w, d };
})();

// ---------- semanas ----------
export type Week = 1 | 4;
export const FOUNDED: Record<Week, string[]> = {
  1: ['C', 'F', 'A'],
  4: ['C', 'F', 'A', 'E', 'B', 'W'],
};
export const H0 = 0.72; // altura do chão fundado sobre o pergaminho

// ---------- rio e estradas ----------
export type Pt = [number, number];
export interface PathDef { id: string; kind: 'river' | 'road'; from?: string; width: number; ctrl: Pt[]; }

// O rio nasce em tinta no Pedregal do Corvo, entra no Vale do Trigo, desce pela Foz do Lume e some no mar.
export const RIVER: PathDef = {
  id: 'rio', kind: 'river', width: 0.5,
  ctrl: [[12.9, -11.2], [11.6, -8.9], [10.1, -6.6], [9.0, -4.7], [8.0, -3.3], [7.0, -2.0], [6.3, -0.4], [6.1, 1.4], [6.4, 3.0], [6.2, 4.7], [6.9, 6.2], [6.6, 7.9], [7.2, 9.5], [7.5, 11.0], [8.0, 12.5], [8.8, 14.0]],
};
export const ROADS: PathDef[] = [
  // a estrada do Vale do Trigo cruza o rio e segue em tinta para o nordeste
  { id: 'estrada-F', kind: 'road', from: 'F', width: 0.3, ctrl: [[13.4, -9.4], [12.2, -7.2], [11.2, -5.0], [10.0, -2.9], [8.8, -0.9], [7.7, -0.35], [6.3, -0.55], [5.0, -0.9], [3.6, -0.6], [2.4, -0.3], [1.5, -0.1]] },
  { id: 'estrada-A', kind: 'road', from: 'A', width: 0.3, ctrl: [[4.1, 8.1], [4.0, 6.3], [3.3, 4.6], [2.5, 3.1], [1.7, 1.9], [1.1, 0.9]] },
  { id: 'estrada-B', kind: 'road', from: 'B', width: 0.3, ctrl: [[-3.6, 8.0], [-3.1, 6.2], [-2.5, 4.4], [-1.7, 2.8], [-1.0, 1.5], [-0.5, 0.9]] },
  { id: 'estrada-W', kind: 'road', from: 'W', width: 0.3, ctrl: [[-9.6, 1.6], [-8.0, 1.1], [-6.4, 0.5], [-4.6, 0.3], [-3.0, 0.2], [-1.8, 0.1], [-1.2, 0.0]] },
  { id: 'estrada-E', kind: 'road', from: 'E', width: 0.3, ctrl: [[2.6, -8.6], [2.4, -6.7], [1.9, -4.8], [1.2, -3.2], [0.7, -1.9], [0.3, -1.2]] },
];

// onde os pontos vivos do mundo (aldeias, portos) ficam, em cada região
export const HUBS: Record<string, Pt> = {
  F: [8.7, -0.7], A: [4.0, 6.5], B: [-3.3, 6.6], W: [-8.2, 1.0], E: [2.5, -6.4],
};

export function foundedSet(week: Week): Set<string> { return new Set(FOUNDED[week]); }

/** Resolve a curva suave de um caminho e marca cada ponto como dentro de região fundada ou não. */
export interface Sampled { x: number; z: number; in3d: boolean; }
export function catmull(ctrl: Pt[], n: number): Pt[] {
  const out: Pt[] = [];
  const P = (i: number): Pt => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  const segs = ctrl.length - 1;
  for (let s = 0; s < segs; s++) {
    const p0 = P(s - 1), p1 = P(s), p2 = P(s + 1), p3 = P(s + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(2, Math.round(len / 0.1));
    for (let i = 0; i < steps; i++) {
      const t = i / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  void n;
  return out;
}

export interface Resolved { def: PathDef; pts: Pt[]; open: boolean; runs: Pt[][]; ink: Pt[][]; }

/** Divide a curva em trechos 3D (dentro de regiões fundadas) e trechos de tinta (fora delas). */
export function resolvePath(def: PathDef, week: Week): Resolved {
  const founded = foundedSet(week);
  const pts = catmull(def.ctrl, 0);
  const open = def.kind === 'river' || (def.from !== undefined && founded.has(def.from));
  const runs: Pt[][] = [], ink: Pt[][] = [];
  let cur: Pt[] = [], curIn: boolean | null = null;
  const flush = (): void => { if (cur.length > 1) (curIn ? runs : ink).push(cur); cur = []; };
  for (const p of pts) {
    const g = regionAt(p[0], p[1]);
    const inside = open && !!g && founded.has(g.id);
    if (curIn === null) curIn = inside;
    if (inside !== curIn) { cur.push(p); flush(); curIn = inside; cur = [p]; } else cur.push(p);
  }
  flush();
  return { def, pts, open, runs, ink };
}
