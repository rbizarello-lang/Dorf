import type { Theme } from '../themes/types';

/**
 * Seis cores que se separam para quem não distingue verde de vermelho
 * (a paleta de Okabe e Ito, com a estrada em cinza escuro no lugar do preto puro).
 * A ordem é a dos terrenos: prado, mata, plantação, vila, rio, estrada.
 */
export const SAFE_TERRAIN: [string, string, string, string, string, string] = ['#f0e442', '#009e73', '#e69f00', '#cc79a7', '#0072b2', '#333333'];

/** O chão e a legenda passam a usar a mesma cor, para a borda na peça bater com o ícone. */
export function withSafeColors(theme: Theme): Theme {
  return { ...theme, terrainColors: SAFE_TERRAIN, ground: SAFE_TERRAIN, water: SAFE_TERRAIN[4] };
}
