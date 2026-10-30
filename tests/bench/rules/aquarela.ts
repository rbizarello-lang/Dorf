// Aquarela (proposta F2-1): a borda é uma mistura. Cada borda de terra vira uma mistura de dois terrenos (100/0, 75/25 ou 50/50) e entre
// duas peças vizinhas a nota de semelhança é
//     s = 1 − ½·‖mistura_a − mistura_b‖₁            (0 a 1; mistura = vetor de 4 terrenos que soma 1)
// A borda paga round(10·s) se s ≥ 0,5: "quase igual vale quase tanto quanto igual" (prado 75/mata 25 contra prado puro: s = 0,75, +8).
// Rio e trilho continuam estritos e puros. A interação entre terrenos (vila×mata etc.) só entra onde a borda não paga (s < 0,5), pelos
// terrenos principais. Perfeito e cerco passam a exigir s ≥ 0,75 em todas as bordas ("quase igual").
//
// As misturas nascem no gerador da peça (semente da peça, nunca do jogo): onde o terreno muda dentro da própria peça a borda tem 55% de
// chance de misturar com o vizinho de dentro (a transição natural, 75/25 em 70% dos casos e 50/50 no resto); nas outras, 8% de chance de
// uma mistura solta. Na prática ~30% das bordas de terra saem misturadas (o limite que a proposta pede, para a leitura não pesar).
import { mulberry32 } from '../../../src/core/rng';
import { LAND, T, isStrict, type TileDef } from '../../../src/core/tiles';
import { LiteWorld, STARTER_EDGES, makeLTile, type LTile, type RTile } from '../lite';
import { knobs } from '../knobs';
import { compAux, l1, pure } from '../mix';
import type { Rule } from '../types';

/** Botões `aquarela.*`: chance de misturar numa transição e solta, semelhança mínima que paga e a que vale perfeito/cerco. */
const K = knobs('aquarela', { transition: 0.55, loose: 0.08, payFloor: 0.5, perfectS: 0.75 });
export const P_TRANSITION = K.transition;
export const P_LOOSE = K.loose;
export const SALT = 0xa9a9a9;

/** A composição de cada borda de uma peça de bordas `edges`, gerada só de `seed`. */
export function mixComp(edges: readonly T[], seed: number): number[][] {
  const rng = mulberry32((seed ^ SALT) >>> 0);
  return edges.map((t, i) => {
    const c = pure(t);
    // Sempre consome os mesmos 3 sorteios por borda: a peça não depende de quantas bordas misturam.
    const roll = rng(), pickSec = rng(), pickW = rng();
    if (isStrict(t)) return c;
    const inner = [edges[(i + 5) % 6], edges[(i + 1) % 6]].filter((x) => x !== t && !isStrict(x));
    let sec = -1;
    let w = 1;
    if (inner.length) {
      if (roll < P_TRANSITION) {
        sec = inner[Math.floor(pickSec * inner.length)];
        w = pickW < 0.7 ? 0.75 : 0.5;
      }
    } else if (roll < P_LOOSE) {
      const others = LAND.filter((x) => x !== t);
      sec = others[Math.floor(pickSec * others.length)];
      w = 0.75;
    }
    if (sec >= 0) {
      c[t] = w;
      c[sec] = 1 - w;
    }
    return c;
  });
}

export class AquarelaWorld extends LiteWorld {
  constructor(seed: number) {
    super(seed);
    this.perfectS = K.perfectS;
  }

  protected decorate(def: TileDef): LTile {
    return makeLTile(def.seed, def.edges, compAux(mixComp(def.edges, def.seed)));
  }

  protected makeStarter(seed: number): LTile {
    return makeLTile(seed, [...STARTER_EDGES], compAux(STARTER_EDGES.map(pure)));
  }

  protected sim(a: RTile, i: number, b: RTile, j: number): number {
    if (isStrict(a.edges[i]) || isStrict(b.edges[j])) return a.edges[i] === b.edges[j] ? 1 : 0;
    return 1 - l1(a, i, b, j) / 2;
  }

  protected pay(_a: RTile, _i: number, _b: RTile, _j: number, s: number): number {
    return s >= K.payFloor ? Math.round(this.cfg.matchPoints * s) : 0;
  }

  protected synOpen(s: number): boolean {
    return s < K.payFloor;
  }

  protected spawn(): LiteWorld {
    return new AquarelaWorld(this.seed);
  }
}

export const aquarela: Rule = {
  id: 'aquarela',
  name: 'Aquarela',
  blurb: 'A borda é uma mistura de dois terrenos; "quase igual" paga quase tanto quanto igual (round(10·s), s ≥ 0,5).',
  baseline: 'base',
  create: (seed) => new AquarelaWorld(seed).start(),
};
