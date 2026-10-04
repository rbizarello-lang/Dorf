import { T } from './tiles';

// Interações entre bordas diferentes. Quando dois terrenos comuns se encostam
// sem combinar, alguns pares ainda "conversam": a borda não pontua como encaixe,
// mas ergue uma pequena construção e rende pontos de interação.
//   vila × floresta   → serraria   (lumber)
//   vila × plantação  → moinho     (mill)
//   vila × prado      → pasto      (pasture)
//   plantação × prado → colmeias   (apiary)

export type SynKind = 'lumber' | 'mill' | 'pasture' | 'apiary';
export const SYN_KINDS: readonly SynKind[] = ['lumber', 'mill', 'pasture', 'apiary'];

export function synergyOf(a: T, b: T): SynKind | null {
  const is = (x: T, y: T) => (a === x && b === y) || (a === y && b === x);
  if (is(T.Village, T.Forest)) return 'lumber';
  if (is(T.Village, T.Field)) return 'mill';
  if (is(T.Village, T.Grass)) return 'pasture';
  if (is(T.Field, T.Grass)) return 'apiary';
  return null;
}

/** Interação numa borda da peça colocada (índice de borda já rotacionado). */
export interface SynHit {
  edge: number;
  kind: SynKind;
}

/**
 * Influência das construções (proposta 7 do docs/IDEIAS_AOE.md): cada interação marca as 6
 * casas vizinhas da peça onde nasceu, e uma peça colocada depois numa delas ganha pontos por
 * setor do terreno que a construção trabalha. O valor por setor cresce com a era (índice).
 */
export const INFLUENCE: Record<SynKind, { terrains: readonly T[]; per: readonly number[] }> = {
  lumber: { terrains: [T.Forest], per: [1, 2, 2, 3] },
  mill: { terrains: [T.Field], per: [1, 2, 2, 3] },
  pasture: { terrains: [T.Grass], per: [1, 2, 2, 3] },
  apiary: { terrains: [T.Grass, T.Field], per: [1, 1, 1, 2] },
};
/** Teto do bônus de influência por peça; influências do mesmo tipo não se somam. */
export const INFLUENCE_CAP = 8;
