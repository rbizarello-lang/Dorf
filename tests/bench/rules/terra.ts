// TERRA CONTÍNUA, rascunho v0 (plano "Terra contínua", Fase 1). O mundo é um campo contínuo de terreno e a pontuação lê o campo, não as bordas.
// Primeira versão para CALIBRAR na bancada: cada número abaixo é um botão (`TERRA` no fim do arquivo) e nenhum foi ajustado ainda.
//
// 1. CAMPO. Cada peça é um carimbo: o terreno de cada borda é suavizado com o das duas bordas vizinhas da MESMA peça,
//        c_i = δ(t_i) + Σ_{vizinhas de terra} λ_i·(δ(t_viz) − δ(t_i)),    λ_i ∈ [0,08; 0,30] sorteado pela semente da peça,
//    um vetor de 4 terrenos (prado, mata, plantação, vila) que soma 1. Rio e trilho ficam puros e estritos (são caminhos). Ao longo de
//    uma borda o campo é linear por trechos: no meio vale c_i; nos cantos, a média com a borda vizinha. É isso que "atravessa a emenda".
// 2. CONTINUIDADE (gradual nas emendas). Em cada borda encostada, 3 amostras ao longo dela (u = ¼, ½, ¾; a outra peça é lida de trás
//    para frente, u → 1−u):  s = 1 − ½·média_u ‖F_a(u) − F_b(1−u)‖₁,   0 a 1. Paga  round(10·max(0, (s − 0,5)/0,5)):  s = 0,5 vale 0, s = 1 vale 10.
//    Perfeito e cerco exigem s ≥ 0,8 em todas as bordas. A interação entre terrenos só entra onde a borda não paga.
// 3. MANCHAS (área e forma). As manchas são as de `groups.ts` pelo terreno principal de cada borda, e a massa é medida em cunhas (1/6 de
//    peça). Valor da mancha de área a (em peças) e perímetro P (bordas viradas para o vazio ou outro terreno):
//        V = K · a^1,3 · (0,55 + 0,45·compacidade),   compacidade = min(1, 6·√a / P)   (1 num hexágono cheio; ~0,5 numa fila)
//    A jogada paga o aumento do valor total de manchas sobre a maior marca já alcançada (só cresce). K = 4.
// 4. ÁGUA ATÉ O MAR. A altura é do MUNDO, não da peça: o nível da casa é o do relevo de platôs da semente (`levelAt`, 0 a 2). A conta
//    de água é a do núcleo (`waterState`): nascente = peça de rio acima do nível 0 (30% de chance pela semente da peça), a água só desce
//    e chega ao mar num lago (3 bordas de água ou mais) ou no nível 0. 8 pontos por peça com água corrente e 60 (mais 2 peças) por curso
//    que chega ao mar. Não há degrau nem altura no encaixe: a peça não traz cúpula nem altura própria.
// 5. UMIDADE. A de `moisture.ts` (Orvalho), lida sobre a mistura da peça (a média das bordas de terra), não sobre o terreno principal.
//
// Fica de fora desta versão: as missões, as eras e os sítios do jogo (a bancada compara a regra de encaixe, não a progressão), a
// deformação visual das divisas (render) e o "mundo que responde" (a mancha que avança devagar depois da jogada).
import { levelAt } from '../../../src/core/relief';
import { mulberry32 } from '../../../src/core/rng';
import { T, isStrict, type TileDef } from '../../../src/core/tiles';
import { isSpring } from '../../../src/core/water';
import { buildGroups, exposed, find, mass, terrainOf } from '../groups';
import { knobs } from '../knobs';
import { BASE_CFG, LiteWorld, STARTER_EDGES, makeLTile, type LTile, type Placed, type RTile } from '../lite';
import { compAux, pure, tileComp } from '../mix';
import { affected, fitOf, moistureAt } from '../moisture';
import type { Rule } from '../types';
import { WaterTracker } from '../water';

/** Os botões da Terra contínua (tudo o que a calibração mexe; `BENCH_KNOBS` troca sem editar, ver knobs.ts). */
export const TERRA = knobs('terra', {
  waterChance: 0.24,
  lambdaMin: 0.08,
  lambdaMax: 0.3,
  /** Continuidade mínima que paga e a que vale perfeito/cerco. */
  payFloor: 0.5,
  perfectS: 0.8,
  patchK: 4,
  patchExp: 1.3,
  patchShapeBase: 0.55,
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
  private water = new WaterTracker(TERRA.flowPoints, TERRA.seaPoints, TERRA.seaTiles);

  constructor(seed: number) {
    super(seed, { ...BASE_CFG, waterChance: TERRA.waterChance });
    this.perfectS = TERRA.perfectS;
    this.hasExtra = true;
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
    return Math.round((this.cfg.matchPoints * Math.max(0, s - TERRA.payFloor)) / (1 - TERRA.payFloor));
  }

  protected synOpen(s: number): boolean {
    return s < TERRA.payFloor + 0.05;
  }

  /** Valor total das manchas de terra (peças) do mundo agora, arredondado. */
  private patches(): number {
    const n = buildGroups(this);
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (mass[i] === 0 || find(i) !== i || isStrict(terrainOf(this, i))) continue;
      const a = mass[i] / 6;
      const compact = Math.min(1, (6 * Math.sqrt(a)) / Math.max(1, exposed[i]));
      v += TERRA.patchK * a ** TERRA.patchExp * (TERRA.patchShapeBase + (1 - TERRA.patchShapeBase) * compact);
    }
    return Math.round(v);
  }

  private level(p: Placed): number {
    return levelAt(this.seed, p.q, p.r, 2);
  }

  protected extra(p: Placed, commit: boolean): number {
    let pts = 0;
    // 3. manchas
    const v = this.patches();
    const patch = Math.max(0, v - this.patchBest);
    pts += patch;
    this.note('manchas', patch);
    if (commit && v > this.patchBest) this.patchBest = v;
    // 5. umidade
    for (const o of affected(this, p)) {
      const f = fitOf(tileComp(o.v), moistureAt(this, o.q, o.r));
      if (f > this.paid[o.idx]) {
        pts += f - this.paid[o.idx];
        this.note(o === p ? 'umidade da própria peça' : 'umidade levada às peças vizinhas', f - this.paid[o.idx]);
        if (commit) this.paid[o.idx] = f;
      }
    }
    // 4. água até o mar
    if (p.v.edges.includes(T.Water)) {
      const level = this.level(p);
      const g = this.water.gain({ q: p.q, r: p.r, edges: p.v.edges, level, spring: p.idx > 0 && isSpring(p.seed, p.v.edges, level) });
      this.exTiles += g.tiles;
      pts += g.pts;
      this.note('água corrente e mar', g.pts);
    }
    return pts;
  }

  protected onCommit(p: Placed): void {
    if (p.idx === 0) {
      // A peça do centro nasce com o que já tem: não é jogada, não paga.
      this.paid[0] = fitOf(tileComp(p.v), moistureAt(this, p.q, p.r));
      this.patchBest = this.patches();
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
    this.water.copyInto(t.water);
  }
}

export const terra: Rule = {
  id: 'terra',
  name: 'Terra contínua (rascunho)',
  blurb: 'Campo contínuo de terreno: continuidade gradual nas emendas, manchas por área e forma, água até o mar e umidade. Primeira versão, para calibrar.',
  baseline: 'relevo-base',
  create: (seed) => new TerraWorld(seed).start(),
};
