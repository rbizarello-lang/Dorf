// As regras do próprio jogo, jogadas pelo `Game` do núcleo (sem cópia da lógica): Clássico e Relevo com água, cheios (como no jogo, tema
// Holanda Dourada, o mesmo do `tests/balance.ts`) e na versão BASE (sem missões, eras, sítios, maravilha, cartas, estação nem influência),
// que é a referência das ideias novas escritas no motor leve: elas só mexem no encaixe, então se comparam com o encaixe puro.
import { DEFAULT_RULES, type Rules } from '../../../src/core/board';
import { modeById, modeRules } from '../../../src/core/modes';
import { THEMES } from '../../../src/themes/themes';
import { CoreWorld, baseRules, reliefBaseRules } from '../coreWorld';
import type { Rule } from '../types';

/** As regras de uma partida como o jogo monta: padrão ← tema ← modo (o mesmo `rulesFor` do `tests/balance.ts`). */
export const gameRules = (modeId: string, seed: number): Rules => ({ ...DEFAULT_RULES, ...THEMES[0].rules, ...modeRules(modeById(modeId), seed) });

export const classico: Rule = {
  id: 'classico',
  name: 'Clássico',
  blurb: 'O Clássico do jogo, inteiro (missões, eras, sítios, maravilha), pelo `Game` do núcleo.',
  baseline: 'classico',
  create: (seed) => new CoreWorld(seed, gameRules('classico', seed)),
};

export const relevo: Rule = {
  id: 'relevo',
  name: 'Relevo com água',
  blurb: 'O modo Relevo do jogo, inteiro: altura por peça, degraus, cachoeiras, nascentes (as escondidas também), rio até o mar. Pelo `Game` do núcleo.',
  baseline: 'classico',
  create: (seed) => new CoreWorld(seed, gameRules('relevo', seed)),
};

export const base: Rule = {
  id: 'base',
  name: 'Clássico base',
  blurb: 'O encaixe puro do Clássico: 10 por borda, perfeito, cerco com peça de volta e interações. Sem missões, eras, sítios nem cartas. Referência das ideias leves.',
  baseline: 'base',
  create: (seed) => new CoreWorld(seed, baseRules()),
};

export const relevoBase: Rule = {
  id: 'relevo-base',
  name: 'Relevo base',
  blurb: 'O Relevo com água sobre o encaixe puro (sem missões, eras, sítios nem as nascentes escondidas). Referência do Fluxo e da Terra contínua.',
  baseline: 'relevo-base',
  create: (seed) => new CoreWorld(seed, reliefBaseRules()),
};
