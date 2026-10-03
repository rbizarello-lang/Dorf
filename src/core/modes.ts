import type { Rules } from './board';

// Versões alternativas do jogo. Um modo é dado: muda regras e o que a interface oferece
// (desfazer, semente do dia). As regras finais são padrão ← tema ← modo.

export type ModeId = 'classico' | 'zen' | 'diario' | 'exploradores';

export interface Mode {
  id: ModeId;
  name: string;
  tagline: string;
  rules: Partial<Rules>;
  /** Quantas vezes dá para desfazer a última jogada. */
  undos: number;
  /** Semente do dia: a mesma sequência de peças para todo mundo, e as regras padrão (sem as do tema). */
  daily?: boolean;
}

export const MODES: readonly Mode[] = [
  {
    id: 'classico',
    name: 'Clássico',
    tagline: 'Missões, eras da vila e sítios escondidos. A partida acaba quando a pilha esvazia.',
    rules: {},
    undos: 3,
  },
  {
    id: 'zen',
    name: 'Zen',
    tagline: 'Peças sem fim e sem pressa. A pontuação e as eras continuam, por gosto.',
    rules: { infinite: true },
    undos: 99,
  },
  {
    id: 'diario',
    name: 'Desafio do dia',
    tagline: 'A mesma sequência de peças para todo mundo hoje, com as regras padrão. Sem desfazer.',
    rules: {},
    undos: 0,
    daily: true,
  },
  {
    id: 'exploradores',
    name: 'Exploradores',
    tagline: 'Dez sítios escondidos. Ache todos com o mínimo de peças: cada uma que sobrar vale 20 pontos.',
    rules: { sites: 10, startTiles: 60, endOnSites: true },
    undos: 1,
  },
];

export const modeById = (id: string | null | undefined): Mode => MODES.find((m) => m.id === id) ?? MODES[0];

/** Semente do desafio do dia (AAAAMMDD, no fuso de quem joga). */
export function dailySeed(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
