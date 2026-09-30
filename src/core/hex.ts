// Grade hexagonal "flat-top" em coordenadas axiais (q, r).
// Cantos nos ângulos 0°, 60°, ... e a borda i fica entre o canto i e o i+1
// (ponto médio a 30° + 60°·i). Ângulos medidos no plano XZ com atan2(z, x).

export const SQRT3 = Math.sqrt(3);
/** Raio externo (centro → canto). */
export const HEX_R = 1;
/** Raio interno (centro → meio da borda). */
export const INR = (SQRT3 / 2) * HEX_R;

/** Vizinho do outro lado da borda i. */
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

export const opposite = (i: number) => (i + 3) % 6;

/** Chave numérica compacta; suporta q, r em [-4096, 4095]. */
export const hkey = (q: number, r: number) => ((q + 4096) << 13) | (r + 4096);
export const unkey = (k: number): [number, number] => [(k >> 13) - 4096, (k & 8191) - 4096];

export function hexToWorld(q: number, r: number): { x: number; z: number } {
  return { x: 1.5 * HEX_R * q, z: SQRT3 * HEX_R * (r + q / 2) };
}

export function worldToHex(x: number, z: number): [number, number] {
  const qf = ((2 / 3) * x) / HEX_R;
  const rf = (-x / 3 + (SQRT3 / 3) * z) / HEX_R;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return [q, r];
}

export function corner(i: number): [number, number] {
  const a = (Math.PI / 3) * i;
  return [Math.cos(a) * HEX_R, Math.sin(a) * HEX_R];
}

export function edgeMid(i: number): [number, number] {
  const a = Math.PI / 6 + (Math.PI / 3) * i;
  return [Math.cos(a) * INR, Math.sin(a) * INR];
}

export function hexDistance(q1: number, r1: number, q2: number, r2: number) {
  const dq = q1 - q2;
  const dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
