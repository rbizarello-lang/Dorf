// TERRA CONTÍNUA, regra v1 (plano "Terra contínua", Fase 2). O mundo é um campo contínuo de terreno e a pontuação lê o campo, não as bordas.
// Em uma frase: as emendas pagam pela continuidade da paisagem (casar muito bem paga bem mais que casar mais ou menos), cada mancha de
// terra paga ao ser FECHADA (cercada, sem borda aberta) pelo tamanho e pela forma, e a água que chega faz render a terra que a esperava.
// Cada número abaixo é um botão (`TERRA`); os padrões são os da calibração vencedora (ver TERRA-REGRA.md). Para reproduzir o rascunho da Fase 1:
//   BENCH_KNOBS='{"terra":{"matchPoints":10,"perfectBonus":20,"contExp":1,"patchK":4,"patchExp":1.3,"closeK":0,"closeTiles":0,"fitSelf":1}}'
//
// 1. CAMPO. Cada peça é um carimbo: o terreno de cada borda é suavizado com o das duas bordas vizinhas da MESMA peça,
//        c_i = δ(t_i) + Σ_{vizinhas de terra} λ_i·(δ(t_viz) − δ(t_i)),    λ_i ∈ [0,08; 0,30] sorteado pela semente da peça,
//    um vetor de 4 terrenos (prado, mata, plantação, vila) que soma 1. Rio e trilho ficam puros e estritos (são caminhos). Ao longo de
//    uma borda o campo é linear por trechos: no meio vale c_i; nos cantos, a média com a borda vizinha. É isso que "atravessa a emenda".
// 2. CONTINUIDADE (gradual e CONVEXA nas emendas). Em cada borda encostada, 3 amostras ao longo dela (u = ¼, ½, ¾; a outra peça é lida de
//    trás para frente, u → 1−u):  s = 1 − ½·média_u ‖F_a(u) − F_b(1−u)‖₁,   0 a 1. Com x = max(0, (s − 0,5)/0,5), a borda paga  round(14·x³):
//    s = 0,5 vale 0, s = 0,9 vale 7, s = 1 vale 14. Perfeito (+28) e cerco da peça (+30 e uma peça de volta) exigem s ≥ 0,8 em todas as bordas.
//    A interação entre terrenos só entra onde a borda não paga.
// 3. MANCHAS (área e forma). As manchas são as de `groups.ts` pelo terreno principal de cada borda, e a massa é medida em cunhas (1/6 de
//    peça). Para a mancha de área a (em peças) e perímetro P (bordas viradas para o vazio ou outro terreno):
//        forma = 0,55 + 0,45·compacidade,   compacidade = min(1, 6·√a / P)   (1 num hexágono cheio; ~0,67 numa fila de 4)
//        crescimento:  V = 1,5 · a^1,8 · forma, paga o aumento do valor total de manchas sobre a maior marca já alcançada (só cresce);
//        FECHAMENTO:   F = 20 · a^1,5 · forma, paga uma vez, quando a mancha (de pelo menos 1 peça de área) fica SEM borda aberta para o
//                      vazio e não cresce mais; devolve 1 peça à pilha. A mancha fechada nunca muda (nada encosta nela), então o prêmio
//                      não precisa de estado: é função do tabuleiro, como a água.
// 4. ÁGUA ATÉ O MAR. A altura é do MUNDO, não da peça: o nível da casa é o do relevo de platôs da semente (`levelAt`, 0 a 2). A conta
//    de água é a do núcleo (`waterState`): nascente = peça de rio acima do nível 0 (30% de chance pela semente da peça), a água só desce
//    e chega ao mar num lago (3 bordas de água ou mais) ou no nível 0. 8 pontos por peça com água corrente e 60 (mais 2 peças) por curso
//    que chega ao mar. Não há degrau nem altura no encaixe: a peça não traz cúpula nem altura própria.
// 5. UMIDADE QUE CHEGA. A de `moisture.ts` (Orvalho), lida sobre a mistura da peça (a média das bordas de terra). Só rende a umidade que
//    a água (ou a mata) leva às peças que JÁ estavam lá: a peça nova não recebe a própria (`fitSelf` = 0), porque um pagamento por peça
//    é um piso que achata a escolha (folga de 66% contra 74%). Peça na faixa: +8; no meio da faixa: +11. Só cresce.
// 6. ARGILA (desligada: `clayPerTile` = 0). A mancha maior avança `clayAdvance` cunhas por divisa sobre a vizinha e paga a área ganha.
//
// O que a bancada chama de "mundo responde": os pontos pagos por estruturas que JÁ estavam no tabuleiro quando a peça pousou, ou seja, o
// fechamento de mancha, a umidade levada às peças vizinhas, a água que chega (peças de antes que passam a correr e o mar) e a Argila.
// O crescimento das manchas fica de fora dessa conta estrita (a coluna "resp+cresc" da varredura o soma).
//
// Fica de fora desta versão: as missões, as eras e os sítios do jogo (a bancada compara a regra de encaixe, não a progressão) e a
// deformação visual das divisas (render).
import { levelAt } from '../../../src/core/relief';
import { mulberry32 } from '../../../src/core/rng';
import { T, isStrict, type TileDef } from '../../../src/core/tiles';
import { isSpring } from '../../../src/core/water';
import { DIRS } from '../../../src/core/hex';
import { buildGroups, exposed, find, mass, terrainOf, voids } from '../groups';
import { knobs } from '../knobs';
import { BASE_CFG, LiteWorld, STARTER_EDGES, makeLTile, opp, type LTile, type Placed, type RTile } from '../lite';
import { compAux, pure, tileComp } from '../mix';
import { affected, fitOf, moistureAt } from '../moisture';
import type { Rule } from '../types';
import { WaterTracker } from '../water';

/** Os botões da Terra contínua (tudo o que a calibração mexe; `BENCH_KNOBS` troca sem editar, ver knobs.ts). Padrões = a regra vencedora. */
export const TERRA = knobs('terra', {
  waterChance: 0.24,
  lambdaMin: 0.08,
  lambdaMax: 0.3,
  /** Pontos de uma emenda perfeita, o bônus de peça perfeita e o de cerco da peça (os números do Clássico: 10, 20 e 30). */
  matchPoints: 14,
  perfectBonus: 28,
  cercoBonus: 30,
  /** Continuidade mínima que paga e a que vale perfeito/cerco. */
  payFloor: 0.5,
  perfectS: 0.8,
  /** Curva do pagamento da emenda: 1 = linear; 2 ou 3 = convexa (casar muito bem paga bem mais que casar mais ou menos). */
  contExp: 3,
  patchK: 1.5,
  patchExp: 1.8,
  patchShapeBase: 0.55,
  /** Prêmio de fechamento: K · área^exp · forma, uma vez, quando a mancha (de pelo menos `closeMin` peças) fica sem borda aberta; `closeTiles` peças de volta por mancha fechada. */
  closeK: 20,
  closeExp: 1.5,
  closeMin: 1,
  closeTiles: 1,
  /** Argila: a mancha maior avança `clayAdvance` cunhas por borda sobre a vizinha e cada peça de área ganha paga `clayPerTile`. */
  clayAdvance: 0.5,
  clayPerTile: 0,
  /** Orvalho: pontos de uma peça na faixa de umidade e no meio da faixa. */
  fitIn: 8,
  fitMid: 11,
  /** Quanto da umidade a própria peça recebe ao pousar (0 = só rende a umidade que chega depois às peças que já estavam lá; 1 = como o Orvalho). */
  fitSelf: 0,
  flowPoints: 8,
  seaPoints: 60,
  seaTiles: 2,
});
const SALT = 0x7e77a;
const MAX = 512;

/** A composição suavizada de cada borda de uma peça de bordas `edges`, só da semente dela. */
export function smearComp(edges: readonly T[], seed: number): number[][] {
  const rng = mulberry32((seed ^ SALT) >>> 0);
  return edges.map((t, i) => {
    const c = pure(t);
    const lam = TERRA.lambdaMin + rng() * (TERRA.lambdaMax - TERRA.lambdaMin);
    if (isStrict(t)) return c;
    for (const n of [edges[(i + 5) % 6], edges[(i + 1) % 6]]) {
      if (isStrict(n)) continue;
      c[t] -= lam;
      c[n] += lam;
    }
    return c;
  });
}

export class TerraWorld extends LiteWorld {
  private paid = new Float32Array(MAX);
  private patchBest = 0;
  private closedBest = 0;
  private closedNBest = 0;
  private clayBest = 0;
  private water = new WaterTracker(TERRA.flowPoints, TERRA.seaPoints, TERRA.seaTiles);

  constructor(seed: number) {
    super(seed, { ...BASE_CFG, waterChance: TERRA.waterChance, matchPoints: TERRA.matchPoints, perfectBonus: TERRA.perfectBonus, closedBonus: TERRA.cercoBonus });
    this.perfectS = TERRA.perfectS;
    this.hasExtra = true;
    this.trackBase = true;
  }

  protected decorate(def: TileDef): LTile {
    return makeLTile(def.seed, def.edges, compAux(smearComp(def.edges, def.seed)));
  }

  protected makeStarter(seed: number): LTile {
    return makeLTile(seed, [...STARTER_EDGES], compAux(smearComp(STARTER_EDGES, seed)));
  }

  /** Continuidade (0 a 1) entre a borda `i` de `a` e a `j` de `b`: 3 amostras ao longo da emenda. */
  protected sim(a: RTile, i: number, b: RTile, j: number): number {
    if (isStrict(a.edges[i]) || isStrict(b.edges[j])) return a.edges[i] === b.edges[j] ? 1 : 0;
    const ia = (i + 5) % 6, ib = (i + 1) % 6, ja = (j + 5) % 6, jb = (j + 1) % 6;
    let d = 0;
    for (let k = 0; k < 4; k++) {
      const A = a.aux['c' + k], B = b.aux['c' + k];
      const ai = A[i], bj = B[j];
      // A borda vizinha dentro da peça, se for de terra; senão a própria borda (um caminho não mistura).
      const a0 = isStrict(a.edges[ia]) ? ai : A[ia], a1 = isStrict(a.edges[ib]) ? ai : A[ib];
      const b0 = isStrict(b.edges[ja]) ? bj : B[ja], b1 = isStrict(b.edges[jb]) ? bj : B[jb];
      d += Math.abs((3 * ai + a0) / 4 - (3 * bj + b1) / 4) + Math.abs(ai - bj) + Math.abs((3 * ai + a1) / 4 - (3 * bj + b0) / 4);
    }
    return 1 - d / 6;
  }

  protected pay(_a: RTile, _i: number, _b: RTile, _j: number, s: number): number {
    const x = Math.max(0, (s - TERRA.payFloor) / (1 - TERRA.payFloor));
    return Math.round(this.cfg.matchPoints * x ** TERRA.contExp);
  }

  protected synOpen(s: number): boolean {
    return s < TERRA.payFloor + 0.05;
  }

  /** O campo lido sobre as manchas do mundo agora (a peça tentativa já posta): valor das manchas, valor e número das fechadas, e a área ganha pela Argila. */
  private field(): { patch: number; closed: number; closedN: number; clay: number } {
    const n = buildGroups(this);
    let v = 0, c = 0, cn = 0;
    for (let i = 0; i < n; i++) {
      if (mass[i] === 0 || find(i) !== i || isStrict(terrainOf(this, i))) continue;
      const a = mass[i] / 6;
      const compact = Math.min(1, (6 * Math.sqrt(a)) / Math.max(1, exposed[i]));
      const shape = TERRA.patchShapeBase + (1 - TERRA.patchShapeBase) * compact;
      v += TERRA.patchK * a ** TERRA.patchExp * shape;
      if (voids[i] === 0 && a >= TERRA.closeMin) {
        c += TERRA.closeK * a ** TERRA.closeExp * shape;
        cn++;
      }
    }
    let adv = 0;
    if (TERRA.clayPerTile > 0) {
      // Argila: em cada divisa entre manchas de terreno diferente, a de maior massa avança sobre a menor.
      for (const t of this.tilesList) {
        const e = t.v.edges;
        for (let k = 0; k < 6; k++) {
          if (isStrict(e[k])) continue;
          const nb = this.at(t.q + DIRS[k][0], t.r + DIRS[k][1]);
          if (!nb) continue;
          const other = nb.v.edges[opp(k)];
          if (other === e[k] || isStrict(other)) continue;
          const a = mass[find(t.idx * 6 + k)], b = mass[find(nb.idx * 6 + opp(k))];
          if (a > b) adv += (TERRA.clayAdvance * (a - b)) / (a + b);
        }
      }
    }
    return { patch: Math.round(v), closed: Math.round(c), closedN: cn, clay: Math.round((adv * TERRA.clayPerTile) / 6) };
  }

  /**
   * Conferência do `field()`: o mesmo cálculo das manchas por uma busca em largura sobre (peça, setor), sem o `groups.ts` (união-busca,
   * perímetro e bordas abertas). Devolve as duas leituras para o `verifica.ts` comparar a cada jogada.
   */
  audit(): { fast: { patch: number; closed: number; closedN: number }; slow: { patch: number; closed: number; closedN: number } } {
    const f = this.field();
    const seen = new Set<number>();
    let v = 0, c = 0, cn = 0;
    for (const t of this.tilesList) {
      for (let s0 = 0; s0 < 6; s0++) {
        if (isStrict(t.v.edges[s0]) || seen.has(t.idx * 6 + s0)) continue;
        let cunhas = 0, perim = 0, open = 0;
        const stack: [Placed, number][] = [[t, s0]];
        seen.add(t.idx * 6 + s0);
        while (stack.length) {
          const [u, s] = stack.pop()!;
          const terr = u.v.edges[s];
          cunhas++;
          for (const k of [(s + 5) % 6, (s + 1) % 6]) {
            if (u.v.edges[k] === terr && !seen.has(u.idx * 6 + k)) {
              seen.add(u.idx * 6 + k);
              stack.push([u, k]);
            }
          }
          const nb = this.at(u.q + DIRS[s][0], u.r + DIRS[s][1]);
          if (!nb) {
            perim++;
            open++;
          } else if (nb.v.edges[opp(s)] === terr) {
            if (!seen.has(nb.idx * 6 + opp(s))) {
              seen.add(nb.idx * 6 + opp(s));
              stack.push([nb, opp(s)]);
            }
          } else perim++;
        }
        const a = cunhas / 6;
        const shape = TERRA.patchShapeBase + (1 - TERRA.patchShapeBase) * Math.min(1, (6 * Math.sqrt(a)) / Math.max(1, perim));
        v += TERRA.patchK * a ** TERRA.patchExp * shape;
        if (open === 0 && a >= TERRA.closeMin) {
          c += TERRA.closeK * a ** TERRA.closeExp * shape;
          cn++;
        }
      }
    }
    return { fast: { patch: f.patch, closed: f.closed, closedN: f.closedN }, slow: { patch: Math.round(v), closed: Math.round(c), closedN: cn } };
  }

  private level(p: Placed): number {
    return levelAt(this.seed, p.q, p.r, 2);
  }

  protected extra(p: Placed, commit: boolean): number {
    let pts = 0;
    // 3. manchas: crescimento, fechamento e a área que a Argila dá a quem avança
    const f = this.field();
    const patch = Math.max(0, f.patch - this.patchBest);
    const close = Math.max(0, f.closed - this.closedBest);
    const clay = Math.max(0, f.clay - this.clayBest);
    pts += patch + close + clay;
    this.note('manchas (crescimento)', patch);
    this.note('fechamento de mancha', close);
    this.note('avanço da mancha (Argila)', clay);
    this.exTiles += Math.max(0, f.closedN - this.closedNBest) * TERRA.closeTiles;
    if (commit) {
      if (f.patch > this.patchBest) this.patchBest = f.patch;
      if (f.closed > this.closedBest) this.closedBest = f.closed;
      if (f.closedN > this.closedNBest) this.closedNBest = f.closedN;
      if (f.clay > this.clayBest) this.clayBest = f.clay;
    }
    // 5. umidade
    for (const o of affected(this, p)) {
      const fit = fitOf(tileComp(o.v), moistureAt(this, o.q, o.r), TERRA.fitIn, TERRA.fitMid);
      if (fit > this.paid[o.idx]) {
        // A peça nova recebe `fitSelf` do que cabe a ela; o que ela não recebe fica registrado como pago (só o que a água traz depois rende).
        const gain = o === p ? Math.round((fit - this.paid[o.idx]) * TERRA.fitSelf) : fit - this.paid[o.idx];
        pts += gain;
        this.note(o === p ? 'umidade da própria peça' : 'umidade levada às peças vizinhas', gain);
        if (commit) this.paid[o.idx] = fit;
      }
    }
    // 4. água até o mar
    if (p.v.edges.includes(T.Water)) {
      const level = this.level(p);
      const g = this.water.gain({ q: p.q, r: p.r, edges: p.v.edges, level, spring: p.idx > 0 && isSpring(p.seed, p.v.edges, level) });
      this.exTiles += g.tiles;
      pts += g.pts;
      this.note('água corrente (própria peça)', g.own);
      this.note('água que chega (peças de antes e mar)', g.pts - g.own);
    }
    return pts;
  }

  protected onCommit(p: Placed): void {
    if (p.idx === 0) {
      // A peça do centro nasce com o que já tem: não é jogada, não paga.
      this.paid[0] = fitOf(tileComp(p.v), moistureAt(this, p.q, p.r), TERRA.fitIn, TERRA.fitMid);
      const f = this.field();
      this.patchBest = f.patch;
      this.closedBest = f.closed;
      this.closedNBest = f.closedN;
      this.clayBest = f.clay;
    }
    if (p.v.edges.includes(T.Water)) {
      const level = this.level(p);
      this.water.add({ q: p.q, r: p.r, edges: p.v.edges, level, spring: p.idx > 0 && isSpring(p.seed, p.v.edges, level) });
    }
  }

  protected spawn(): LiteWorld {
    return new TerraWorld(this.seed);
  }

  protected copyInto(w: LiteWorld): void {
    super.copyInto(w);
    const t = w as TerraWorld;
    t.paid = this.paid.slice();
    t.patchBest = this.patchBest;
    t.closedBest = this.closedBest;
    t.closedNBest = this.closedNBest;
    t.clayBest = this.clayBest;
    this.water.copyInto(t.water);
  }
}

export const terra: Rule = {
  id: 'terra',
  name: 'Terra contínua',
  blurb: 'Emendas por continuidade (convexa), manchas que pagam ao se fechar (tamanho e forma, com peça de volta), água que chega e umidade que a água leva às terras que a esperavam.',
  baseline: 'relevo-base',
  create: (seed) => new TerraWorld(seed).start(),
};
