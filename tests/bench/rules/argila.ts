// Argila (proposta F2-3): a divisa cede. Quando dois terrenos de terra se tocam, a divisa não é reta: ela anda para o lado de MENOR massa, e
// a mancha de maior massa avança sobre a vizinha. Só a pontuação por área (o desenho da divisa é do render e fica de fora):
//
//   massa de uma mancha = cunhas dela (cada setor de peça é 1/6 de peça; `groups.ts`);
//   em cada borda entre duas manchas de terra de terrenos diferentes, com massas a > b, a maior ganha  0,5·(a − b)/(a + b)  cunhas;
//   área ganha = Σ desses avanços; pontos = 10 por peça de área = (10/6) por cunha, arredondado.
//
// Rio e trilho são estritos e ignoram a deformação. O placar da Argila é a marca máxima da área ganha (só cresce): a jogada paga a
// diferença entre a área depois e a maior já alcançada, e nunca menos que 0.
import { DIRS } from '../../../src/core/hex';
import { isStrict } from '../../../src/core/tiles';
import { buildGroups, find, mass } from '../groups';
import { LiteWorld, opp, type Placed } from '../lite';
import type { Rule } from '../types';

export const ADVANCE = 0.5;
export const POINTS_PER_TILE = 10;

/** Área ganha (em pontos, já arredondada) pelas manchas do mundo `w`. */
export function clayPoints(w: LiteWorld): number {
  buildGroups(w);
  let total = 0;
  for (const t of w.tilesList) {
    const e = t.v.edges;
    for (let s = 0; s < 6; s++) {
      if (isStrict(e[s])) continue;
      const nb = w.at(t.q + DIRS[s][0], t.r + DIRS[s][1]);
      if (!nb) continue;
      const other = nb.v.edges[opp(s)];
      if (other === e[s] || isStrict(other)) continue;
      const ra = find(t.idx * 6 + s), rb = find(nb.idx * 6 + opp(s));
      const a = mass[ra], b = mass[rb];
      if (a > b) total += (ADVANCE * (a - b)) / (a + b);
    }
  }
  return Math.round((total * POINTS_PER_TILE) / 6);
}

export class ArgilaWorld extends LiteWorld {
  /** Maior área (em pontos) já alcançada. */
  private best = 0;

  constructor(seed: number) {
    super(seed);
    this.hasExtra = true;
  }

  protected extra(_p: Placed, commit: boolean): number {
    const now = clayPoints(this);
    const gain = Math.max(0, now - this.best);
    if (commit && now > this.best) this.best = now;
    return gain;
  }

  protected spawn(): LiteWorld {
    return new ArgilaWorld(this.seed);
  }

  protected copyInto(w: LiteWorld): void {
    super.copyInto(w);
    (w as ArgilaWorld).best = this.best;
  }
}

export const argila: Rule = {
  id: 'argila',
  name: 'Argila',
  blurb: 'A divisa cede para o lado de menor massa e a mancha maior avança: +10 por peça de área ganha (só a pontuação; o desenho da divisa fica de fora).',
  baseline: 'base',
  create: (seed) => new ArgilaWorld(seed).start(),
};
