// Registro das regras da bancada. Para uma ideia nova: escreva um `LiteWorld` (ver `tests/bench/lite.ts` e `rules/aquarela.ts`, o menor exemplo),
// exporte uma `Rule` e acrescente aqui. `npm run bench -- <id> [partidas]` já a joga.
import type { Rule } from '../types';
import { aquarela } from './aquarela';
import { argila } from './argila';
import { base, classico, relevo, relevoBase } from './core';
import { orvalho } from './orvalho';
import { fluxo, relevoLite } from './relief';
import { terra } from './terra';
import { BaseWorld } from './baseLite';

export const baseLite: Rule = {
  id: 'base-lite',
  name: 'Clássico base (motor leve)',
  blurb: 'O encaixe puro do Clássico reescrito no motor leve da bancada: serve para conferir o motor contra o núcleo.',
  baseline: 'base',
  create: (seed) => new BaseWorld(seed).start(),
};

/** As regras que `todas` joga, na ordem da tabela: as de referência primeiro. */
export const ALL: Rule[] = [classico, base, relevo, relevoBase, aquarela, orvalho, argila, fluxo, terra];
/** Também jogáveis pelo nome, mas só para conferir o motor. */
export const TWINS: Rule[] = [baseLite, relevoLite];
export const BY_ID = new Map<string, Rule>([...ALL, ...TWINS].map((r) => [r.id, r]));
