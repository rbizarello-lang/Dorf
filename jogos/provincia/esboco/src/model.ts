// O que existe na província em cada semana: células pintadas, decoração, janelas, fumaça, lampiões, barcos e carroças.
// Puro (sem three): o render só desenha o que sai daqui.
import {
  CELL_REGION, DIRS, H0, HUBS, REGIONS, REGION_BY_ID, ROADS, RIVER, Week, cellX, cellZ, ckey, foundedSet, hash2, hexDist, noise2, resolvePath, rng, Pt, Resolved, Region, regionAt,
} from './data';

export type Kind = 'meadow' | 'forest' | 'field' | 'vineyard' | 'orchard' | 'hill' | 'mountain' | 'village' | 'beach' | 'plaza' | 'town';
export interface Cell { q: number; r: number; x: number; z: number; region: Region; kind: Kind; h: number; col: number; touched: boolean; }
export interface Deco { kit: string; x: number; y: number; z: number; yaw: number; s: number; id: string; sx?: number; sy?: number; sz?: number; }
export interface Light { x: number; y: number; z: number; }
export interface Route { pts: Pt[]; len: number; cum: number[]; }

export interface Model {
  week: Week;
  founded: Set<string>;
  cells: Map<string, Cell>;
  rivers: Resolved[];
  roads: Resolved[];
  decos: Deco[];
  windows: Deco[];
  smoke: Light[];
  lamps: Light[];
  fires: Light[];
  mills: Array<{ x: number; y: number; z: number; yaw: number }>;
  boats: Route[];
  carts: Array<{ route: Route; dir: 1 | -1 }>;
  bridges: Array<{ x: number; z: number; yaw: number }>;
  beacons: Light[];
  focus: Record<string, Pt>;
  stats: { houses: number; capitalLevel: number };
}

const PI = Math.PI;
const route = (pts: Pt[]): Route => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, len: cum[cum.length - 1], cum }; };
export function sampleRoute(rt: Route, d: number): { x: number; z: number; dx: number; dz: number } {
  d = Math.max(0, Math.min(rt.len, d));
  let lo = 0, hi = rt.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rt.cum[m] <= d) lo = m; else hi = m; }
  const a = rt.pts[lo], b = rt.pts[hi], seg = Math.max(1e-6, rt.cum[hi] - rt.cum[lo]), t = (d - rt.cum[lo]) / seg;
  const dx = (b[0] - a[0]) / seg, dz = (b[1] - a[1]) / seg;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx, dz };
}

const COL = {
  meadow: 0x90c056, forest: 0x78a94a, field: 0xb08c54, vineyard: 0x9c7f4c, orchard: 0x88bb52, hill: 0x8cbb55, mountain: 0x9a9a88,
  village: 0xb7bb78, beach: 0xe4d29a, plaza: 0xdbd0b2, town: 0xc0c485,
};

export function buildModel(week: Week): Model {
  const founded = foundedSet(week);
  const rivers = [resolvePath(RIVER, week)];
  const roads = ROADS.map((d) => resolvePath(d, week));
  const solid: Pt[] = []; // amostras do rio e das estradas abertas, para manter as coisas longe delas
  const riverPts: Pt[] = rivers.flatMap((r) => r.runs.flat());
  const roadPts: Pt[] = roads.filter((r) => r.open).flatMap((r) => r.runs.flat());
  void solid;
  const dist = (pts: Pt[], x: number, z: number): number => { let m = 1e9; for (const p of pts) { const d = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z); if (d < m) m = d; } return Math.sqrt(m); };

  // ---------- células ----------
  const cells = new Map<string, Cell>();
  for (const g of REGIONS) {
    if (!founded.has(g.id)) continue;
    g.cells.forEach(([q, r]) => {
      const x = cellX(q), z = cellZ(q, r);
      const touched = dist(riverPts, x, z) < 1.25 || dist(roadPts, x, z) < 1.1;
      cells.set(ckey(q, r), { q, r, x, z, region: g, kind: 'meadow', h: H0, col: COL.meadow, touched });
    });
  }
  const isCoast = (c: Cell): boolean => DIRS.some(([dq, dr]) => !CELL_REGION.has(ckey(c.q + dq, c.r + dr)));

  const decos: Deco[] = [], windows: Deco[] = [], smoke: Light[] = [], lamps: Light[] = [], fires: Light[] = [], beacons: Light[] = [];
  const mills: Model['mills'] = [], bridges: Model['bridges'] = [];
  const occ: Array<{ x: number; z: number; r: number }> = [];
  const place = (kit: string, x: number, z: number, yaw: number, s: number, y = 0, extra: Partial<Deco> = {}): Deco => {
    const d: Deco = { kit, x, y, z, yaw, s, id: kit + ':' + x.toFixed(2) + ':' + z.toFixed(2), ...extra };
    decos.push(d); return d;
  };
  const hAt = (x: number, z: number): number => { const [q, r] = worldToCellFast(x, z); return cells.get(ckey(q, r))?.h ?? H0; };
  const free = (x: number, z: number, rad: number, riv: number, road: number): boolean => {
    if (dist(riverPts, x, z) < riv) return false;
    if (dist(roadPts, x, z) < road) return false;
    for (const o of occ) { const d = Math.hypot(o.x - x, o.z - z); if (d < o.r + rad) return false; }
    return true;
  };
  const inHex = (u: number, v: number, R: number): boolean => Math.abs(v) <= 0.866 * R && Math.abs(u) + Math.abs(v) * 0.5774 <= R;
  const spot = (c: Cell, rnd: () => number, rad: number, riv: number, road: number, R = 0.82): Pt | null => {
    for (let k = 0; k < 14; k++) {
      const u = (rnd() * 2 - 1) * R, v = (rnd() * 2 - 1) * R;
      if (!inHex(u, v, R)) continue;
      const x = c.x + u, z = c.z + v;
      if (CELL_REGION.get(ckey(...worldToCellFast(x, z) as [number, number]))?.id !== c.region.id) continue;
      if (free(x, z, rad, riv, road)) { occ.push({ x, z, r: rad }); return [x, z]; }
    }
    return null;
  };
  const reserve = (x: number, z: number, r: number): void => { occ.push({ x, z, r }); };

  // casas: 'h1a' etc. são casas do nível 1 (a/b/c = telhado), 'h2a'.. níveis 2 a 4
  const addHouse = (x: number, z: number, yaw: number, kit: string, level: number, s = 1, smokeOn = true): void => {
    const y = hAt(x, z);
    place(kit, x, z, yaw, s, y);
    const slots = WIN[level] ?? WIN[1];
    for (const w of slots) {
      const ca = Math.cos(yaw), sa = Math.sin(yaw);
      // R_y(yaw) aplicado a (w.x, w.z)
      const wx = w.x * ca + w.z * sa, wz = -w.x * sa + w.z * ca;
      windows.push({ kit: 'win', x: x + wx * s, y: y + w.y * s, z: z + wz * s, yaw: yaw + w.ry, s, id: 'w' + x.toFixed(2) + z.toFixed(2) + w.x });
    }
    if (smokeOn) {
      const ch = CHIM[level] ?? CHIM[1];
      const ca = Math.cos(yaw), sa = Math.sin(yaw);
      smoke.push({ x: x + (ch.x * ca + ch.z * sa) * s, y: y + ch.y * s + 0.04, z: z + (-ch.x * sa + ch.z * ca) * s });
    }
  };

  // ---------- capital ----------
  const cap = REGION_BY_ID.get('C')!;
  const capCells = [...cells.values()].filter((c) => c.region === cap);
  const wall = week >= 4;
  for (const c of capCells) {
    const d = hexDist(c.q, c.r);
    c.kind = d === 0 ? 'plaza' : d === 1 ? 'town' : 'town';
    c.col = d <= 1 ? COL.plaza : (wall ? COL.town : COL.meadow);
    c.touched = false;
  }
  const rC = rng(77);
  // praça no meio: catedral (semana 4) ou capela com poço (semana 1)
  if (wall) {
    place('cathedral', 0, -0.1, 0, 1.42, H0);
    reserve(0, -0.1, 1.0);
    windowsOf('cathedral', 0, -0.1, H0, 0, 1.42, windows);
    beacons.push({ x: 0, y: H0 + 3.1, z: 0 });
    place('cobble', 0, 0, 0, 1.0, H0);
    // mercado: barracas em duas células da praça, de frente para a catedral
    const stallCols = ['stallA', 'stallB', 'stallC'];
    let si = 0;
    for (let k = 0; k < 16; k++) {
      const a = 0.4 + k * (PI * 2 / 16), x = Math.cos(a) * 2.3, z = Math.sin(a) * 2.3;
      if (dist(roadPts, x, z) < 0.55 || Math.hypot(x + 1.9, z - 1.4) < 0.6 || Math.hypot(x - 2.0, z + 1.5) < 0.6) continue;
      if (z < -0.6) continue; // o mercado fica na frente, do lado da vista
      place(stallCols[si++ % 3], x, z, Math.atan2(-x, -z), 1.0, H0); reserve(x, z, 0.34);
    }
    place('well', -1.9, 1.4, 0, 1.2, H0); reserve(-1.9, 1.4, 0.3);
    place('barrels', 2.0, -1.5, 1, 1.0, H0); reserve(2.0, -1.5, 0.2);
  } else {
    place('cobble', 0, 0, 0, 0.62, H0);
    place('chapel', 0, -0.1, 0, 1.15, H0);
    reserve(0, 0, 0.55);
    windowsOf('chapel', 0, -0.1, H0, 0, 1.15, windows);
    place('well', 1.25, 0.9, 0, 1.15, H0); reserve(1.25, 0.9, 0.3);
    place('plazaTree', -1.15, 1.0, 0, 1.1, H0); reserve(-1.15, 1.0, 0.35);
  }
  // casas da capital
  const capHouses: Array<{ p: Pt; level: number }> = [];
  const wantHouses = wall ? 30 : 7;
  const cellsByD = capCells.filter((c) => hexDist(c.q, c.r) >= 1).sort((a, b) => a.q * 7 + a.r * 13 - (b.q * 7 + b.r * 13));
  for (let tries = 0; tries < 600 && capHouses.length < wantHouses; tries++) {
    const c = cellsByD[Math.floor(rC() * cellsByD.length)];
    const d = hexDist(c.q, c.r);
    if (!wall && d !== 1 && rC() < 0.5) continue;
    const rad = wall ? (d === 1 ? 0.5 : 0.44) : 0.5;
    const p = spot(c, rC, rad, 0.8, 0.55, 0.78);
    if (!p) continue;
    if (wall && Math.hypot(p[0], p[1]) < 2.2) { occ.pop(); continue; } // nada na praça do mercado
    capHouses.push({ p, level: wall ? (d === 1 ? 3 + (rC() < 0.5 ? 1 : 0) : 2 + (rC() < 0.3 ? 1 : 0)) : 1 });
  }
  capHouses.forEach(({ p, level }, i) => {
    const toC = Math.atan2(-p[0], -p[1]);
    const kit = level === 1 ? 'h1' + 'abc'[i % 3] : 'h' + level + (i % 2 ? 'b' : 'a');
    addHouse(p[0], p[1], toC + (rC() - 0.5) * 0.5, kit, level, 1, i % 3 !== 2);
  });
  // lampiões em volta da praça
  const lampN = wall ? 8 : 3;
  for (let i = 0; i < lampN; i++) {
    const a = (i / lampN) * PI * 2 + 0.2, rr = wall ? 1.95 : 1.55;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (!free(x, z, 0.12, 0.3, 0.3) && dist(roadPts, x, z) < 0.3) continue;
    place('lamp', x, z, 0, 0.9, H0); lamps.push({ x, y: H0 + 1.08, z }); reserve(x, z, 0.12);
  }
  // muralha, torres e portões
  if (wall) {
    const capSet = new Set(capCells.map((c) => ckey(c.q, c.r)));
    const verts = new Map<string, { x: number; z: number; n: number }>();
    const gates: Array<{ x: number; z: number; yaw: number }> = [];
    const segs: Array<{ x: number; z: number; yaw: number }> = [];
    for (const c of capCells) {
      DIRS.forEach(([dq, dr], k) => {
        if (capSet.has(ckey(c.q + dq, c.r + dr))) return;
        const a = (30 + 60 * k) * PI / 180;
        const x = c.x + Math.cos(a) * 0.82, z = c.z + Math.sin(a) * 0.82;
        segs.push({ x, z, yaw: -((60 * k + 120) * PI / 180) });
        for (const kk of [k, k + 1]) {
          const va = (60 * kk) * PI / 180, vx = c.x + Math.cos(va) * 0.96, vz = c.z + Math.sin(va) * 0.96;
          const key = vx.toFixed(1) + ',' + vz.toFixed(1);
          const v = verts.get(key) ?? { x: vx, z: vz, n: 0 };
          v.n++; verts.set(key, v);
        }
      });
    }
    // portões: o segmento mais perto de onde cada estrada entra
    const gateAt = new Set<number>();
    for (const rd of roads) {
      if (!rd.open) continue;
      for (const run of rd.runs) for (const p of run) {
        const g = regionAt(p[0], p[1]);
        if (g?.id !== 'C') continue;
        let bi = -1, bd = 1e9;
        segs.forEach((s, i) => { const d = Math.hypot(s.x - p[0], s.z - p[1]); if (d < bd) { bd = d; bi = i; } });
        if (bd < 1.6 && bi >= 0) gateAt.add(bi);
        break;
      }
    }
    segs.forEach((s, i) => { if (gateAt.has(i)) gates.push(s); else place('wall', s.x, s.z, s.yaw, 1.0, H0); });
    for (const g of gates) { place('gate', g.x, g.z, g.yaw, 1.0, H0); lamps.push({ x: g.x, y: H0 + 0.75, z: g.z }); }
    // torres onde a muralha dobra para fora (vértice com uma única casa da capital) e ao lado dos portões
    const tv = [...verts.values()].filter((v) => v.n === 1);
    tv.forEach((v) => { if (gates.some((g) => Math.hypot(g.x - v.x, g.z - v.z) < 0.7)) return; place('tower', v.x, v.z, 0, 1.0, H0); });
  }

  // ---------- as outras regiões ----------
  for (const g of REGIONS) {
    if (!founded.has(g.id) || g.id === 'C') continue;
    const rr = rng(g.cells.length * 131 + g.id.charCodeAt(0) * 17);
    const gc = g.cells.map(([q, r]) => cells.get(ckey(q, r))!);
    const hub = HUBS[g.id];
    const hubCell = gc.slice().sort((a, b) => Math.hypot(a.x - hub[0], a.z - hub[1]) - Math.hypot(b.x - hub[0], b.z - hub[1]))[0];
    const nz = (c: Cell, s: number, f = 0.33): number => noise2(c.x * f, c.z * f, g.id.charCodeAt(0) * 3 + s);
    // tipo de cada célula
    for (const c of gc) {
      const n = nz(c, 1), m = nz(c, 2, 0.5);
      const coast = isCoast(c);
      let k: Kind = 'meadow';
      switch (g.theme) {
        case 'trigo': k = n < 0.58 ? 'field' : n > 0.86 ? 'hill' : m < 0.3 ? 'forest' : 'meadow'; break;
        case 'foz': k = n < 0.5 && !coast ? 'vineyard' : m < 0.28 ? 'forest' : 'meadow'; if (coast) k = 'beach'; break;
        case 'moinhos': k = n < 0.42 ? 'field' : n < 0.58 ? 'orchard' : n > 0.8 ? 'hill' : m < 0.25 ? 'forest' : 'meadow'; break;
        case 'serra': k = n > 0.66 ? 'mountain' : n > 0.46 ? 'hill' : m < 0.45 ? 'forest' : 'meadow'; break;
        case 'bosque': k = n < 0.62 ? 'forest' : n > 0.84 ? 'hill' : 'meadow'; break;
        default: break;
      }
      if (c.touched && (k === 'field' || k === 'vineyard' || k === 'orchard' || k === 'mountain' || k === 'hill')) k = 'meadow';
      c.kind = k;
    }
    hubCell.kind = 'village';
    const around = gc.filter((c) => c !== hubCell && Math.hypot(c.x - hubCell.x, c.z - hubCell.z) < 2.0 && !['hill', 'mountain'].includes(c.kind));
    around.slice(0, 2).forEach((c) => { if (c.kind !== 'forest') c.kind = 'village'; });
    for (const c of gc) {
      c.col = (COL as Record<string, number>)[c.kind] ?? COL.meadow;
      const j = (hash2(c.q, c.r, 3) - 0.5) * 0.1;
      c.col = tint(c.col, 1 + j);
      if (c.kind === 'hill') c.h = H0 + 0.2 + nz(c, 4) * 0.12;
      if (c.kind === 'mountain') c.h = H0 + 0.36 + nz(c, 4) * 0.12;
    }
    // construções especiais
    if (g.theme === 'moinhos') {
      const hc = gc.filter((c) => c.kind === 'hill' || (!c.touched && c.kind !== 'village')).sort((a, b) => nz(b, 4) - nz(a, 4))[0];
      if (hc) { hc.kind = 'hill'; hc.h = H0 + 0.26; hc.col = tint(COL.hill, 1.02); place('mill', hc.x - 0.05, hc.z, 0.4, 1.35, hc.h); mills.push({ x: hc.x - 0.05, y: hc.h, z: hc.z, yaw: 0.4 }); reserve(hc.x, hc.z, 0.7); windows.push({ kit: 'win', x: hc.x - 0.05 + 0.2 * 1.35, y: hc.h + 0.7 * 1.35, z: hc.z + 0.1, yaw: 0.4, s: 1.35, id: 'wm' + g.id }); }
    }
    if (g.theme === 'serra') {
      const hc = gc.filter((c) => c.kind === 'hill').sort((a, b) => nz(b, 4) - nz(a, 4))[0];
      if (hc) { place('shrine', hc.x, hc.z, 0.7, 1.15, hc.h); reserve(hc.x, hc.z, 0.6); lamps.push({ x: hc.x + 0.28, y: hc.h + 0.3, z: hc.z + 0.35 }); }
    }
    if (g.theme === 'bosque') {
      const hc = gc.filter((c) => c.kind === 'meadow' && !c.touched).sort((a, b) => nz(b, 5) - nz(a, 5))[0];
      if (hc) {
        addHouse(hc.x - 0.2, hc.z - 0.1, 0.8, 'h1c', 1, 0.95, true); reserve(hc.x - 0.2, hc.z - 0.1, 0.5);
        place('campfire', hc.x + 0.42, hc.z + 0.25, 0, 1, hc.h); fires.push({ x: hc.x + 0.42, y: hc.h + 0.12, z: hc.z + 0.25 }); reserve(hc.x + 0.42, hc.z + 0.25, 0.2);
        place('logs', hc.x + 0.25, hc.z + 0.55, 0.5, 1, hc.h); reserve(hc.x + 0.25, hc.z + 0.55, 0.15);
      }
    }
    // aldeia
    const base = week >= 4 ? 8 : 5;
    const villageCells = gc.filter((c) => c.kind === 'village');
    place('well', hubCell.x + 0.05, hubCell.z - 0.1, 0, 1.1, hubCell.h); reserve(hubCell.x, hubCell.z - 0.1, 0.32);
    place('lamp', hubCell.x - 0.25, hubCell.z + 0.18, 0, 0.8, hubCell.h); lamps.push({ x: hubCell.x - 0.25, y: hubCell.h + 0.97, z: hubCell.z + 0.18 }); reserve(hubCell.x - 0.25, hubCell.z + 0.18, 0.12);
    let placed = 0;
    for (let tries = 0; tries < 200 && placed < base + (g.theme === 'foz' ? 1 : 0); tries++) {
      const c = villageCells[tries % villageCells.length];
      const p = spot(c, rr, 0.5, 0.85, 0.5, 0.8);
      if (!p) continue;
      const toH = Math.atan2(hubCell.x - p[0], hubCell.z - p[1]);
      const up = week >= 4 && placed >= 4;
      const level = up && rr() < 0.6 ? 2 : 1;
      const kit = level === 1 ? 'h1' + 'abc'[placed % 3] : 'h2' + (placed % 2 ? 'b' : 'a');
      addHouse(p[0], p[1], toH + (rr() - 0.5) * 0.7, kit, level, 0.95 + rr() * 0.12, placed % 2 === 0);
      placed++;
    }
    // porto, farol e barcos: na foz
    if (g.theme === 'foz') {
      const run = rivers[0].runs.filter((r) => r.length > 4).pop();
      if (run) {
        const end = run[run.length - 1];
        const mid = run[Math.max(0, run.length - 26)];
        // cais do lado oeste, entrando na água
        place('dock', mid[0] - 0.34, mid[1], 0, 0.36, H0 + 0.03);
        reserve(mid[0] - 0.3, mid[1], 0.4);
        lamps.push({ x: mid[0] - 0.46, y: H0 + 0.35, z: mid[1] - 0.12 });
        place('lamp', mid[0] - 0.55, mid[1] - 0.14, 0, 0.6, H0); reserve(mid[0] - 0.55, mid[1] - 0.14, 0.12);
        const lx = end[0] - 1.9, lz = end[1] - 0.5;
        place('lighthouse', lx, lz, 0.4, 0.72, hAt(lx, lz)); reserve(lx, lz, 0.7);
        beacons.push({ x: lx - 0.1 * 0.72, y: hAt(lx, lz) + 1.8 * 0.72, z: lz - 0.12 * 0.72 });
        for (const [dx, dz, yy] of [[0.5, 0.15, 0.4]] as Array<[number, number, number]>) { windows.push({ kit: 'win', x: lx + dx * 0.72, y: hAt(lx, lz) + yy * 0.72, z: lz + dz * 0.72 + 0.1, yaw: 0, s: 0.72, id: 'wl' }); }
      }
    }
    // ponte: onde uma estrada abre caminho pelo rio
    // (calculada depois, fora do laço)
    // cobertura de cada célula
    for (const c of gc) {
      const cr = rng(Math.imul(c.q * 73856093 ^ c.r * 19349663, 2654435761) >>> 0);
      const tree = (n: number, mix: number[], scale = 1): void => {
        for (let i = 0; i < n; i++) {
          const p = spot(c, cr, 0.2 * scale, 0.5, 0.4);
          if (!p) continue;
          const t = cr();
          const kit = t < mix[0] ? 'pine' : t < mix[1] ? 'round' : 'tall';
          place(kit, p[0], p[1], cr() * 6.28, (0.78 + cr() * 0.4) * scale, c.h);
        }
      };
      const ground = (n: number): void => {
        for (let i = 0; i < n; i++) {
          const p = spot(c, cr, 0.1, 0.4, 0.28);
          if (!p) continue;
          occ.pop();
          place(cr() < 0.25 ? 'flowers' : 'tuft', p[0], p[1], cr() * 6.28, 0.9 + cr() * 0.5, c.h);
        }
      };
      switch (c.kind) {
        case 'forest': tree(5 + Math.floor(cr() * 3), g.theme === 'serra' ? [0.85, 0.95] : g.theme === 'bosque' ? [0.55, 0.85] : [0.4, 0.8]); ground(2); break;
        case 'meadow': case 'beach': {
          ground(c.kind === 'beach' ? 2 : 5);
          if (c.kind === 'meadow') tree(Math.floor(cr() * 2.4), [0.3, 0.8]);
          if (c.kind === 'meadow' && cr() < 0.3) { const p = spot(c, cr, 0.3, 0.5, 0.4); if (p) place('rock' + (cr() < 0.5 ? 0 : 1), p[0], p[1], cr() * 6.28, 0.9, c.h); }
          if (c.kind === 'meadow' && (g.theme === 'trigo' || g.theme === 'moinhos' || g.theme === 'serra') && cr() < 0.34) {
            for (let k = 0; k < 3; k++) { const p = spot(c, cr, 0.17, 0.5, 0.4, 0.7); if (p) place('sheep', p[0], p[1], cr() * 6.28, 1.0, c.h); }
          }
          break;
        }
        case 'field': place('field', c.x, c.z, Math.floor(cr() * 3) * PI / 3, 1, c.h); reserve(c.x, c.z, 0.75); if (cr() < 0.4) place('hay', c.x + 0.45, c.z + 0.45, 0, 0.9, c.h); break;
        case 'vineyard': place('vine', c.x, c.z, Math.floor(cr() * 3) * PI / 3, 1, c.h); reserve(c.x, c.z, 0.75); break;
        case 'orchard': place('orchard', c.x, c.z, cr() * 6.28, 1.05, c.h); reserve(c.x, c.z, 0.7); ground(2); break;
        case 'hill': ground(3); tree(2, [0.6, 0.9], 1.0); { const p = spot(c, cr, 0.3, 0.5, 0.4); if (p) place('rock1', p[0], p[1], cr() * 6.28, 0.85, c.h); } break;
        case 'mountain': place('mountain' + (c.q + c.r & 1), c.x, c.z, cr() * 6.28, 1.05 + cr() * 0.15, c.h); reserve(c.x, c.z, 0.8); break;
        case 'village': ground(3); break;
        default: break;
      }
    }
  }

  // capital: árvores e canteiros nas bordas internas
  {
    const cr = rng(5);
    for (const c of capCells) {
      if (hexDist(c.q, c.r) < 2) continue;
      for (let i = 0; i < (wall ? 2 : 4); i++) {
        const p = spot(c, cr, wall ? 0.16 : 0.2, 0.5, 0.4, 0.78);
        if (!p) continue;
        place(cr() < 0.5 ? 'round' : 'pine', p[0], p[1], cr() * 6.28, 0.8 + cr() * 0.3, H0);
      }
      for (let i = 0; i < 3; i++) { const p = spot(c, cr, 0.1, 0.4, 0.28); if (!p) continue; occ.pop(); place(cr() < 0.3 ? 'flowers' : 'tuft', p[0], p[1], cr() * 6.28, 1.0, H0); }
      if (!wall && cr() < 0.45) place('field', c.x, c.z, 0, 0.9, H0);
    }
  }

  // ---------- pontes: onde estradas abertas cruzam o rio ----------
  for (const rd of roads) {
    if (!rd.open) continue;
    let best: { p: Pt; i: number; d: number } | null = null;
    for (const run of rd.runs) run.forEach((p, i) => { const d = dist(riverPts, p[0], p[1]); if (d < 0.18 && (!best || d < best.d)) best = { p, i, d }; });
    const b = best as { p: Pt; i: number; d: number } | null;
    if (b) {
      const run = rd.runs.find((r) => r.includes(b.p))!;
      const j = run.indexOf(b.p), a = run[Math.max(0, j - 2)], c = run[Math.min(run.length - 1, j + 2)];
      const yaw = -Math.atan2(c[1] - a[1], c[0] - a[0]);
      bridges.push({ x: b.p[0], z: b.p[1], yaw });
      place('bridge', b.p[0], b.p[1], yaw, 1.0, H0);
      for (const sgn of [-1, 1]) { const lx = b.p[0] + Math.cos(yaw) * 0.52 * sgn + Math.sin(yaw) * 0.0, lz = b.p[1] - Math.sin(yaw) * 0.52 * sgn; lamps.push({ x: lx + Math.sin(yaw) * 0.22, y: H0 + 0.62, z: lz + Math.cos(yaw) * 0.22 }); place('lamp', lx + Math.sin(yaw) * 0.22, lz + Math.cos(yaw) * 0.22, 0, 0.5, H0 + 0.05); }
    }
  }

  // ---------- vida em movimento ----------
  const boats: Route[] = [];
  const rv = rivers[0].runs.slice().sort((a, b) => b.length - a.length)[0];
  if (rv) boats.push(route(rv));
  const carts: Model['carts'] = [];
  for (const rd of roads) {
    if (!rd.open) continue;
    const run = rd.runs.slice().sort((a, b) => b.length - a.length)[0];
    if (!run) continue;
    const rt = route(run);
    if (rt.len < 2) continue;
    carts.push({ route: rt, dir: 1 }, { route: rt, dir: -1 });
  }

  const focus: Record<string, Pt> = { capital: [0, 0], ponte: bridges[0] ? [bridges[0].x, bridges[0].z] : [6.3, -0.55], fronteira: [10.6, -4.2] };
  return {
    week, founded, cells, rivers, roads, decos, windows, smoke, lamps, fires, mills, boats, carts, bridges, beacons, focus,
    stats: { houses: decos.filter((d) => d.kit.startsWith('h')).length, capitalLevel: wall ? 4 : 1 },
  };
}

export function worldToCellFast(x: number, z: number): [number, number] {
  const qf = x / 1.5, rf = (z - 0.8660254 * qf) / 1.7320508, sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return [q, r];
}

function tint(c: number, k: number): number {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k)), g = Math.min(255, Math.round(((c >> 8) & 255) * k)), b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

// janelas por nível de casa (espaço local da casa); copiadas da Ilha
const WIN: Array<Array<{ x: number; y: number; z: number; ry: number }>> = [
  [],
  [{ x: -0.14, y: 0.26, z: 0.215, ry: 0 }, { x: 0.14, y: 0.26, z: 0.215, ry: 0 }, { x: 0.255, y: 0.26, z: -0.08, ry: PI / 2 }, { x: 0.255, y: 0.26, z: 0.08, ry: PI / 2 }],
  [{ x: -0.14, y: 0.26, z: 0.215, ry: 0 }, { x: 0.14, y: 0.26, z: 0.215, ry: 0 }, { x: -0.12, y: 0.55, z: 0.195, ry: 0 }, { x: 0.12, y: 0.55, z: 0.195, ry: 0 }],
  [{ x: -0.28, y: 0.3, z: 0.225, ry: 0 }, { x: 0.08, y: 0.3, z: 0.225, ry: 0 }, { x: 0.34, y: 0.24, z: 0.215, ry: 0 }, { x: -0.1, y: 0.72, z: 0.155, ry: 0 }],
  [{ x: -0.28, y: 0.3, z: 0.225, ry: 0 }, { x: 0.08, y: 0.3, z: 0.225, ry: 0 }, { x: 0.34, y: 0.24, z: 0.215, ry: 0 }, { x: -0.38, y: 0.6, z: 0.0, ry: 0 }],
];
const CHIM = [{ x: 0, y: 0, z: 0 }, { x: 0.14, y: 0.66, z: -0.09 }, { x: 0.15, y: 1.0, z: -0.1 }, { x: -0.3, y: 0.86, z: -0.1 }, { x: -0.3, y: 0.86, z: -0.1 }];

/** Janelas altas (vitrais) da catedral e da capela. */
function windowsOf(kind: 'cathedral' | 'chapel', x: number, z: number, y: number, yaw: number, s: number, out: Deco[]): void {
  const spots: Array<{ x: number; y: number; z: number; ry: number; sy: number; sx: number }> = [];
  if (kind === 'cathedral') {
    for (const zz of [-0.28, -0.04, 0.2, 0.44]) for (const sx of [-1, 1]) spots.push({ x: 0.235 * sx, y: 0.3, z: zz, ry: PI / 2, sy: 2.6, sx: 1.1 });
    spots.push({ x: 0, y: 0.7, z: 0.572, ry: 0, sy: 2.2, sx: 3.0 });
    spots.push({ x: 0, y: 0.34, z: 0.575, ry: 0, sy: 2.6, sx: 1.2 });
  } else {
    spots.push({ x: 0, y: 0.22, z: 0.347, ry: 0, sy: 1.1, sx: 1.4 });
  }
  const ca = Math.cos(yaw), sa = Math.sin(yaw);
  spots.forEach((w, i) => {
    const wx = w.x * ca + w.z * sa, wz = -w.x * sa + w.z * ca;
    out.push({ kit: 'win', x: x + wx * s, y: y + w.y * s, z: z + wz * s, yaw: yaw + w.ry, s, sx: w.sx, sy: w.sy, sz: 1, id: kind + i });
  });
}
