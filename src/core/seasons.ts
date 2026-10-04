import type { SynKind } from './synergy';

// Estações da partida: a cada 20 jogadas, nesta ordem. A conta é o índice da peça
// (0 na primeira), então o replay e o desfazer reconstroem a estação sem guardá-la.

export const SEASON_NAME = ['Primavera', 'Verão', 'Outono', 'Inverno'] as const;

/** Interação que ganha o bônus da estação: colmeias, moinho, serraria, pasto. */
export const SEASON_KIND: readonly SynKind[] = ['apiary', 'mill', 'lumber', 'pasture'];

export const SEASON_BONUS = 3;

/** Estação da jogada `index`. `lock` (0 a 3) fixa um tema que já é uma estação. */
export function seasonAt(index: number, lock?: number): 0 | 1 | 2 | 3 {
  if (lock === 0 || lock === 1 || lock === 2 || lock === 3) return lock;
  return (Math.floor(index / 20) % 4) as 0 | 1 | 2 | 3;
}
