import type { Rules } from './board';
import { T } from './tiles';

// Versões alternativas do jogo. Um modo é dado: muda regras e o que a interface oferece
// (desfazer, semente do dia). As regras finais são padrão ← tema ← modo.

export type ModeId = 'classico' | 'zen' | 'diario' | 'exploradores' | 'rotas' | 'rapida' | 'relevo';

export interface Mode {
  id: ModeId;
  name: string;
  tagline: string;
  rules: Partial<Rules>;
  /** Quantas vezes dá para desfazer a última jogada. */
  undos: number;
  /** Semente do dia: a mesma sequência de peças para todo mundo, e as regras padrão (sem as do tema). */
  daily?: boolean;
  /** Modo ainda em teste: o menu o põe em "Mais modos", fora da lista principal, até ser equilibrado. */
  more?: boolean;
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
    tagline: 'A mesma sequência de peças e a mesma regra do dia para todo mundo hoje. Sem desfazer.',
    rules: {},
    undos: 0,
    daily: true,
  },
  {
    id: 'exploradores',
    name: 'Exploradores',
    tagline: 'Dez sítios escondidos. Ache todos com o mínimo de peças: cada uma que sobrar vale 20 pontos.',
    // Sítios à metade da distância: com o padrão (até 15 casas), nem quem caça sítios achava os 10 com 60 peças.
    rules: { sites: 10, siteScale: 0.5, startTiles: 60, endOnSites: true },
    undos: 1,
  },
  {
    id: 'rotas',
    name: 'Estrada Real',
    tagline: 'Mais trilhos. Mercados e portos da mesma rede rendem pela distância, e a rota de 6 ou mais casas devolve uma peça.',
    rules: { railChance: 0.2, routes: true },
    undos: 3,
    more: true,
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
  {
    id: 'relevo',
    name: 'Relevo',
    tagline: 'Cada peça traz a sua altura: baixa, alta, em rampa, com morro. A altura das bordas também precisa encaixar (1 degrau vale e rende pontos, 2 não).',
    // Sem maravilha: o canteiro pede o meio da peça plano, e aqui a peça pode ter degraus.
    rules: { relief: true, stepPoints: 3, fallPoints: 5, wonderStages: 0 },
    undos: 3,
    more: true,
  },
];

export const modeById = (id: string | null | undefined): Mode => MODES.find((m) => m.id === id) ?? MODES[0];

/** Semente do desafio do dia (AAAAMMDD, no fuso de quem joga). */
export function dailySeed(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** Uma variação de regra do Desafio do dia: só dados de `Rules`, que o oráculo dos testes já cobre. */
export interface DailyRule {
  id: string;
  name: string;
  /** Uma frase para o jogador, mostrada ao começar. */
  desc: string;
  rules: Partial<Rules>;
}

export const DAILY_RULES: readonly DailyRule[] = [
  { id: 'sinergias', name: 'Interações em dobro', desc: 'Cada interação entre bordas vale 10 pontos em vez de 5.', rules: { synergyPoints: 10 } },
  { id: 'rios', name: 'Rios valorizados', desc: 'Cada borda de rio encaixada rende 5 pontos a mais.', rules: { matchBonus: { [T.Water]: 5 } } },
  { id: 'curta', name: 'Pilha curta', desc: 'A pilha começa com 36 peças em vez de 50: cada jogada pesa.', rules: { startTiles: 36 } },
  { id: 'farta', name: 'Pilha farta', desc: 'A pilha começa com 70 peças em vez de 50.', rules: { startTiles: 70 } },
  { id: 'perfeitos', name: 'Perfeição premiada', desc: 'O encaixe perfeito vale 40 pontos de bônus em vez de 20.', rules: { perfectBonus: 40 } },
  { id: 'cercos', name: 'Cerco fechado', desc: 'Cercar uma peça com seis vizinhas vale 60 pontos em vez de 30.', rules: { closedBonus: 60 } },
  { id: 'verao', name: 'Verão sem fim', desc: 'A estação fica em verão o dia todo: a interação do moinho vale 3 a mais.', rules: { seasonLock: 1 } },
  { id: 'bosques', name: 'Bosques generosos', desc: 'Cada borda de floresta encaixada rende 3 pontos a mais.', rules: { matchBonus: { [T.Forest]: 3 } } },
];

/** Dia (AAAAMMDD) de uma semente do desafio, ou null se a semente não for uma data válida (?seed= qualquer). */
export function dailyDate(seed: number): { y: number; m: number; d: number } | null {
  const y = Math.floor(seed / 10000), m = Math.floor(seed / 100) % 100, d = seed % 100;
  if (y < 1970 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? { y, m, d } : null;
}

/**
 * A regra do dia, sorteada só pela semente do dia (AAAAMMDD da data local de quem joga, a mesma
 * do desafio). Dias seguidos percorrem a lista em ordem, então nunca se repete de um dia para o
 * outro. Uma semente que não é data (um ?seed= qualquer) usa o próprio número como índice.
 * Como a semente vai no save, o replay reconstrói a mesma regra sem guardar mais nada.
 */
export function dailyRule(seed: number): DailyRule {
  const dt = dailyDate(seed);
  const n = dt ? Math.floor(Date.UTC(dt.y, dt.m - 1, dt.d) / 86400000) : seed;
  return DAILY_RULES[((n % DAILY_RULES.length) + DAILY_RULES.length) % DAILY_RULES.length];
}

/** Regras próprias do modo para esta semente: as do modo e, no desafio do dia, as da regra do dia. */
export const modeRules = (m: Mode, seed: number): Partial<Rules> => (m.daily ? { ...m.rules, ...dailyRule(seed).rules } : m.rules);
