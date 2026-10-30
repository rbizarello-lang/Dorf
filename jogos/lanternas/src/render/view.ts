// O que o diorama precisa ler de uma partida, igual para as duas versões das regras (A e B).
// O render só lê; nenhuma regra mora aqui.
import { NB } from '../core/hex';
import { GameB, HOUSE_NAMES_B, StructB } from '../core/gameB';
import type { IslandMap } from '../core/map';

export interface View {
  map: IslandMap;
  /** Terreno e achados à vista (sem névoa). */
  seen: Uint8Array;
  /** Iluminado pela luz de uma lanterna. */
  revealed: Uint8Array;
  struct: Uint8Array;
  houses: number[];
  houseResidents(i: number): number;
}

export interface ViewB extends View {
  /** Nível da casa (1 a 4: casa, sobrado, casarão, solar). */
  level(i: number): number;
  /** Vilas: grupos de casas encostadas, cada um com os hexágonos e o número de marcos já ganhos. */
  villages(): Array<{ cells: number[]; marks: number }>;
}

/** Na B a luz e a vista são a mesma coisa: o que está iluminado está à vista. Lê o jogo ao vivo. */
export function viewB(g: GameB): ViewB {
  return {
    get map() { return g.map; },
    get seen() { return g.lit; },
    get revealed() { return g.lit; },
    get struct() { return g.struct; },
    get houses() { return g.houses; },
    houseResidents: (i) => g.levelAt(i),
    level: (i) => g.levelAt(i),
    villages: () => {
      const seen = new Set<number>(), out: Array<{ cells: number[]; marks: number }> = [];
      for (const h of g.houses) {
        if (seen.has(h)) continue;
        const cells: number[] = [], stack = [h];
        seen.add(h);
        while (stack.length) {
          const c = stack.pop()!;
          cells.push(c);
          for (const n of NB[c]) if (g.struct[n] === StructB.House && !seen.has(n)) { seen.add(n); stack.push(n); }
        }
        out.push({ cells, marks: GameB.landmarks(cells.length) });
      }
      return out;
    },
  };
}

export const LEVEL_NAME = HOUSE_NAMES_B;
