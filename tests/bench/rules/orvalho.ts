// Orvalho (proposta F2-4): a umidade pede o terreno. O encaixe é o de sempre (`check` não muda); `place` soma um bônus por peça que cai na faixa
// de umidade do terreno dela (fórmulas em `moisture.ts`). A água do mapa (rio e lago) é a fonte: peça de água nova faz entrar na faixa
// peças que já estavam lá, e a diferença é paga a quem jogou. Só cresce, nunca barra uma jogada.
import type { TileDef } from '../../../src/core/tiles';
import { LiteWorld, STARTER_EDGES, makeLTile, type LTile, type Placed } from '../lite';
import { affected, fitOf, moistureAt } from '../moisture';
import { pureAux, tileComp } from '../mix';
import type { Rule } from '../types';

const MAX = 512;

export class OrvalhoWorld extends LiteWorld {
  /** O que cada peça já recebeu de orvalho. */
  protected paid = new Float32Array(MAX);

  constructor(seed: number) {
    super(seed);
    this.hasExtra = true;
  }

  /** Composição da peça: sem mistura, é a parte de cada terreno entre as bordas de terra. */
  private comp(p: Placed): number[] {
    return tileComp(p.v);
  }

  protected makeStarter(seed: number): LTile {
    return makeLTile(seed, [...STARTER_EDGES], pureAux(STARTER_EDGES));
  }

  protected decorate(def: TileDef): LTile {
    return makeLTile(def.seed, def.edges, pureAux(def.edges));
  }

  protected extra(p: Placed, commit: boolean): number {
    let total = 0;
    for (const o of affected(this, p)) {
      const f = fitOf(this.comp(o), moistureAt(this, o.q, o.r));
      const gain = f - this.paid[o.idx];
      if (gain > 0) {
        total += gain;
        if (commit) this.paid[o.idx] = f;
      }
    }
    return total;
  }

  /** A peça do centro nasce com o orvalho que já tem: não é jogada, não paga. */
  protected onCommit(p: Placed): void {
    if (p.idx === 0) this.paid[0] = fitOf(this.comp(p), moistureAt(this, p.q, p.r));
  }

  protected spawn(): LiteWorld {
    return new OrvalhoWorld(this.seed);
  }

  protected copyInto(w: LiteWorld): void {
    super.copyInto(w);
    (w as OrvalhoWorld).paid = this.paid.slice();
  }
}

export const orvalho: Rule = {
  id: 'orvalho',
  name: 'Orvalho',
  blurb: 'A água do mapa molha em volta e cada terreno gosta de uma faixa de umidade: +8 (ou +11 no meio da faixa) por peça no lugar certo.',
  baseline: 'base',
  create: (seed) => new OrvalhoWorld(seed).start(),
};
