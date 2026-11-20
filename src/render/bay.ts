import { DIRS, INR, edgeMid } from '../core/hex';

/** Raio do pé da saia na casa vazia, antes do deslocamento fluido. */
export const BAY_RADIUS = 0.55;

/** Casa cercada: -1 se fechada, ou a única borda que abre para fora. */
export function bayMouth(q: number, r: number, occupied: (q: number, r: number) => boolean): number | undefined {
  if (occupied(q, r)) return undefined;
  let mouth = -1;
  for (let i = 0; i < 6; i++) {
    const [dq, dr] = DIRS[i];
    if (occupied(q + dq, r + dr)) continue;
    if (mouth >= 0) return undefined;
    mouth = i;
  }
  return mouth;
}

/** Na boca, a curva devolve a faixa da costa original antes de alcançar a casa seguinte. */
export function bayBlend(mouth: number, x: number, z: number): number {
  if (mouth < 0) return 1;
  const [mx, mz] = edgeMid(mouth);
  const t = Math.min(1, Math.max(0, ((x * mx + z * mz) / INR - 0.15) / 0.65));
  return 1 - t * t * (3 - 2 * t);
}

/** Distância dentro da lâmina arredondada. Quando aberta, a lâmina continua pelo canal da boca. */
export function bayWaterDistance(mouth: number, x: number, z: number): number {
  if (mouth >= 0) {
    const [mx, mz] = edgeMid(mouth);
    const t = Math.max(0, (mx * x + mz * z) / (INR * INR));
    x -= t * mx;
    z -= t * mz;
  }
  return Math.max(0, BAY_RADIUS - Math.hypot(x, z));
}
