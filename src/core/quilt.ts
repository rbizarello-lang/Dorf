import { mulberry32 } from './rng';

// Modo Colcha: nós nos cantos. Além das 6 bordas de terreno, cada peça traz 6 botões de lã, um em
// cada canto, de três cores (2 de cada, em ordem sorteada pela semente da peça). Num canto se
// encontram 3 peças: quando as três mostram a mesma cor ali, o nó se amarra e rende pontos.
// É uma segunda camada de encaixe, independente do terreno: nunca impede uma jogada, só premia.
//
// Cantos: o canto v fica no ângulo 60°·v (hex.ts `corner`), entre as bordas v-1 e v. Girar a peça
// em `rot` leva o canto v para o v+rot, igual às bordas (`rotateEdges`).

export const KNOT_COLORS = 3;

export interface KnotHit {
  /** Canto da peça colocada (posição no mundo, 0 a 5). */
  corner: number;
  /** Cor dos três botões (0 a 2). */
  color: number;
}

/** Cores dos 6 cantos na orientação de origem. Só depende da semente da peça: a sequência de peças não muda. */
export function knotColors(seed: number): number[] {
  const rng = mulberry32((seed ^ 0x6b6e6f74) >>> 0);
  const c = [0, 0, 1, 1, 2, 2];
  for (let i = 5; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

/** Cantos depois de girar a peça em `rot`. */
export function rotateCorners(corners: readonly number[], rot: number): number[] {
  const out = new Array<number>(6);
  for (let i = 0; i < 6; i++) out[(i + rot) % 6] = corners[i];
  return out;
}

/**
 * Os dois vizinhos que dividem o canto `v` com a peça: [direção do vizinho, canto dele que é
 * o mesmo ponto do mapa]. A direção `d` é o índice de `DIRS`; o canto `v` toca as bordas v-1 e v.
 */
export function cornerLinks(v: number): [[number, number], [number, number]] {
  return [
    [(v + 5) % 6, (v + 2) % 6],
    [v, (v + 4) % 6],
  ];
}
