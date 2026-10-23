// Geração da ilha (terreno, ponta marcada) e dos achados escondidos. Tudo da semente, sem estado global.
import { CELLS, N, NB, RADIUS, CENTER, dist, hexDist } from './hex';
import { hash2, mulberry32, shuffle, subSeed } from './rng';

export const Terrain = { Water: 0, Beach: 1, Meadow: 2, Wood: 3, Rock: 4 } as const;
export const Find = { None: 0, Ruin: 1, Fish: 2, Orchard: 3, Spring: 4 } as const;

export const TERRAIN_NAMES = ['Água', 'Praia', 'Prado', 'Bosque', 'Rocha'];
export const FIND_NAMES = ['', 'Ruína', 'Cardume', 'Pomar', 'Nascente'];

export interface IslandMap {
  seed: number;
  terrain: Uint8Array;
  /** Achados escondidos (um por hexágono, no máximo). */
  finds: Uint8Array;
  /** Hexágono de terra mais distante do centro: a "ponta marcada". */
  tip: number;
  landCount: number;
}

/** Ruído suave 2D (bilinear com suavização) em [0, 1). */
function vnoise(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, salt), b = hash2(x0 + 1, y0, salt);
  const c = hash2(x0, y0 + 1, salt), d = hash2(x0 + 1, y0 + 1, salt);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, salt: number): number {
  return 0.65 * vnoise(x / 2.6, y / 2.6, salt) + 0.35 * vnoise(x / 1.3 + 17.3, y / 1.3 + 4.1, salt + 1);
}

export function generateIsland(seed: number): IslandMap {
  const s = subSeed(seed, 1) & 0x7fffffff;
  const terrain = new Uint8Array(N);
  const land = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const { q, r } = CELLS[i];
    const d = hexDist(q, r, 0, 0);
    const x = 1.5 * q, y = Math.sqrt(3) * (r + q / 2);
    const e = 1.08 - Math.pow(d / (RADIUS - 0.4), 1.7) * 1.05 + (fbm(x, y, s) - 0.5) * 0.9;
    land[i] = d <= RADIUS - 1 && e > 0.28 ? 1 : 0;
  }
  land[CENTER] = 1;
  // Só fica a terra ligada ao centro (ilhotas soltas viram água).
  const seen = new Uint8Array(N);
  const stack = [CENTER];
  seen[CENTER] = 1;
  while (stack.length) {
    const c = stack.pop()!;
    for (const n of NB[c]) if (land[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
  }
  let landCount = 0;
  for (let i = 0; i < N; i++) {
    if (!seen[i]) { terrain[i] = Terrain.Water; continue; }
    landCount++;
    const { q, r } = CELLS[i];
    const x = 1.5 * q, y = Math.sqrt(3) * (r + q / 2);
    const m = fbm(x + 40, y - 9, s + 7);
    const k = fbm(x - 23, y + 31, s + 13);
    const coast = NB[i].length < 6 || NB[i].some((n) => !seen[n]);
    if (coast && i !== CENTER) terrain[i] = Terrain.Beach;
    else if (i === CENTER) terrain[i] = Terrain.Meadow;
    else if (k > 0.62) terrain[i] = Terrain.Rock;
    else if (m > 0.52) terrain[i] = Terrain.Wood;
    else terrain[i] = Terrain.Meadow;
  }
  // Ponta marcada: terra mais distante do centro (desempate: menor q, depois menor r).
  let tip = CENTER;
  for (let i = 0; i < N; i++) {
    if (terrain[i] === Terrain.Water) continue;
    const di = dist(i, CENTER), dt = dist(tip, CENTER);
    if (di > dt || (di === dt && (CELLS[i].q < CELLS[tip].q || (CELLS[i].q === CELLS[tip].q && CELLS[i].r < CELLS[tip].r)))) tip = i;
  }
  return { seed, terrain, finds: generateFinds(seed, terrain), tip, landCount };
}

/** Quantidade de cada achado (total 6). Gerador à parte, para não mexer no terreno. */
const FIND_PLAN = [Find.Ruin, Find.Ruin, Find.Fish, Find.Orchard, Find.Orchard, Find.Spring];
/** Distância mínima do centro: nada nasce já sob a luz do farol. */
const FIND_MIN_DIST = 4;
const FIND_MIN_DIST_FLOOR = 3;

export function generateFinds(seed: number, terrain: Uint8Array): Uint8Array {
  const rng = mulberry32(subSeed(seed, 2));
  const finds = new Uint8Array(N);
  const taken = new Uint8Array(N);
  // Quanto mais longe do centro, melhor (escondido); se faltar lugar, relaxa a distância mínima.
  const pool = (ok: (i: number) => boolean, minDist: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < N; i++) if (dist(i, CENTER) >= minDist && ok(i)) out.push(i);
    return shuffle(out, rng);
  };
  const okFor: Record<number, (i: number) => boolean> = {
    [Find.Ruin]: (i) => terrain[i] !== Terrain.Water && terrain[i] !== Terrain.Beach,
    [Find.Fish]: (i) => terrain[i] === Terrain.Water && NB[i].some((n) => terrain[n] === Terrain.Beach),
    [Find.Orchard]: (i) => terrain[i] === Terrain.Meadow,
    [Find.Spring]: (i) => terrain[i] === Terrain.Meadow || terrain[i] === Terrain.Wood,
  };
  for (const kind of FIND_PLAN) {
    let pick: number | undefined;
    for (let md = FIND_MIN_DIST; md >= FIND_MIN_DIST_FLOOR && pick === undefined; md--) {
      const cand = pool((i) => !taken[i] && okFor[kind](i), md);
      // Prefere um hexágono que não encoste em outro achado; senão, qualquer um.
      pick = cand.find((i) => !NB[i].some((n) => finds[n])) ?? cand[0];
    }
    if (pick === undefined) continue;
    finds[pick] = kind;
    taken[pick] = 1;
  }
  return finds;
}
