// Grade hexagonal flat-top em coordenadas axiais (q, r). Raio fixo do mapa: RADIUS.
export const RADIUS = 7;
export const SIDE = 2 * RADIUS + 1;
export const DIRS: ReadonlyArray<readonly [number, number]> = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export function hexDist(aq: number, ar: number, bq: number, br: number): number {
  const dq = aq - bq, dr = ar - br;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Índices denso 0..N-1 só para os hexágonos dentro do raio. */
export const CELLS: Array<{ q: number; r: number }> = [];
const byAxial = new Int16Array(SIDE * SIDE).fill(-1);
for (let q = -RADIUS; q <= RADIUS; q++) {
  for (let r = -RADIUS; r <= RADIUS; r++) {
    if (hexDist(q, r, 0, 0) <= RADIUS) {
      byAxial[(q + RADIUS) * SIDE + (r + RADIUS)] = CELLS.length;
      CELLS.push({ q, r });
    }
  }
}
export const N = CELLS.length;

export function idxOf(q: number, r: number): number {
  if (Math.abs(q) > RADIUS || Math.abs(r) > RADIUS) return -1;
  return byAxial[(q + RADIUS) * SIDE + (r + RADIUS)];
}

/** Vizinhos dentro do mapa, na ordem de DIRS. */
export const NB: number[][] = CELLS.map(({ q, r }) =>
  DIRS.map(([dq, dr]) => idxOf(q + dq, r + dr)).filter((i) => i >= 0));
/** Vizinhos por direção (-1 fora do mapa), para conferir fileiras retas. */
export const NB_DIR: number[][] = CELLS.map(({ q, r }) => DIRS.map(([dq, dr]) => idxOf(q + dq, r + dr)));

export const DIST: Uint8Array = new Uint8Array(N * N);
for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) DIST[a * N + b] = hexDist(CELLS[a].q, CELLS[a].r, CELLS[b].q, CELLS[b].r);
export const dist = (a: number, b: number): number => DIST[a * N + b];

/** Quem está a distância <= 2 (inclui o próprio): o alcance da luz de uma lanterna. */
export const LIGHT_RADIUS = 2;
export const LIT: number[][] = CELLS.map((_, a) => {
  const out: number[] = [];
  for (let b = 0; b < N; b++) if (DIST[a * N + b] <= LIGHT_RADIUS) out.push(b);
  return out;
});

export const CENTER = idxOf(0, 0);
