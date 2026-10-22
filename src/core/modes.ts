import type { Rules } from './board';

// Versões alternativas do jogo. Um modo é dado: muda regras e o que a interface oferece
// (desfazer, semente do dia). As regras finais são padrão ← tema ← modo.

export type ModeId = 'classico' | 'zen' | 'diario' | 'exploradores' | 'rotas' | 'rapida';

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
  {
    id: 'rotas',
    name: 'Estrada Real',
    tagline: 'Mais trilhos. Mercados e portos da mesma rede rendem pela distância, e a rota de 6 ou mais casas devolve uma peça.',
    rules: { railChance: 0.2, routes: true },
    undos: 3,
  },
  {
    id: 'rapida',
    name: 'Partida rápida',
    tagline: '30 peças e nada mais: sem missões nem peças extras. Uma partida inteira em 10 a 12 minutos.',
    // Pilha fixa: com missões, encaixes perfeitos e eras devolvendo peças a partida passaria de 30
    // (a média do Clássico chega a ~100). Sem missões, sítios, maravilha e cartas, que só dão peças.
    rules: { startTiles: 30, fixedStack: true, questChance: 0, sites: 0, wonderStages: 0, blessings: false },
    undos: 1,
  },
];

export const modeById = (id: string | null | undefined): Mode => MODES.find((m) => m.id === id) ?? MODES[0];

/** Semente do desafio do dia (AAAAMMDD, no fuso de quem joga). */
export function dailySeed(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
