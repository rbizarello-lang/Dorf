// Terra contínua (modo `terra`): o mundo é um campo contínuo de terreno e a pontuação lê o campo, não só as bordas.
// Núcleo puro e determinístico (sem three.js, DOM nem Math.random). A regra foi calibrada na bancada (tests/bench/rules/terra.ts,
// resumo em docs/TERRA.md); os números abaixo são os da calibração vencedora e `tests/terra-bancada.ts` confere que o jogo e a bancada
// dão os mesmos pontos nas mesmas sementes. Em uma frase: as emendas pagam pela continuidade da paisagem, cada mancha de terra paga de
// uma vez quando é FECHADA (cercada, sem borda aberta) e a água que chega faz render as terras que a esperavam.
//
// 1. CAMPO. Cada peça é um carimbo: o terreno de cada borda é suavizado com o das duas bordas vizinhas da MESMA peça,
//        c_i = δ(t_i) + Σ_{vizinhas de terra} λ_i·(δ(t_viz) − δ(t_i)),   λ_i ∈ [0,08; 0,30] sorteado pela semente da peça,
//    um vetor de 4 terrenos (prado, mata, plantação, vila) que soma 1. Rio e trilho ficam puros e estritos. Ao longo de uma borda o campo
//    é linear por trechos: no meio vale c_i; nos cantos, a média com a borda vizinha.
// 2. CONTINUIDADE. Em cada borda encostada, 3 amostras ao longo dela (u = ¼, ½, ¾; a outra peça é lida de trás para frente):
//        s = 1 − ½·média_u ‖F_a(u) − F_b(1−u)‖₁,   0 a 1,       x = max(0, (s − 0,5)/0,5),       a borda paga  round(14·x³).
//    Perfeito (todas as bordas com s ≥ 0,8, a peça encosta em 2 ou mais) e cerco da peça (6 vizinhas, todas com s ≥ 0,8) usam o mesmo 0,8.
//    A interação entre terrenos só entra onde s < 0,55.
// 3. MANCHAS. Mancha = grupo de setores do mesmo terreno (como `Board.computeGroups`), com a massa medida em cunhas (1/6 de peça):
//    área a = cunhas ÷ 6, perímetro P = bordas viradas para o vazio ou para outro terreno, forma = 0,55 + 0,45·min(1, 6√a/P).
//        crescimento:  V = Σ 1,5·a^1,8·forma sobre as manchas de terra; paga o aumento de round(V) sobre a maior marca já alcançada;
//        fechamento:   F = Σ 20·a^1,5·forma sobre as manchas sem borda virada para o vazio; paga o aumento de round(F) sobre a maior marca,
//                      (cada mancha limitada a `Rules.terraCloseCap` pontos, se houver teto) e cada mancha que fecha (a partir de
//                      `Rules.terraBackMin` peças) devolve `terraBackTiles` peça à pilha, até `terraBackCap` por partida.
//    A mancha fechada nunca muda (nada encosta nela), então o prêmio é função do tabuleiro. As marcas vêm do replay (nada vai no save).
// 4. UMIDADE QUE CHEGA. A do Orvalho (a água molha em volta; cada terreno gosta de uma faixa): +8 na faixa, +11 no meio, lida sobre a
//    mistura da peça (média das bordas de terra). Só rende às peças que JÁ estavam lá quando a água (ou a mata) chega: a peça nova não
//    recebe a própria. Cada peça guarda o que já rendeu (`Placed.moist`) e só a diferença paga.
// 5. ÁGUA. A do modo Relevo (src/core/water.ts), mas com a altura do MUNDO (`levelAt`, 0 a 2) no lugar da altura por peça.
import { DIRS, opposite } from './hex';
import { mulberry32 } from './rng';
import { T, isStrict, rotateEdges } from './tiles';

/** Composição de terreno de uma peça: `comp[borda][terreno]`, terreno = T.Grass..T.Village (4 números que somam 1; borda estrita: tudo 0). */
export type Comp = number[][];

/** Números da regra (a calibração vencedora da bancada). Os de encaixe (14, 28 e 30) ficam em `Rules`, no modo. */
export const TERRA = {
  lambdaMin: 0.08,
  lambdaMax: 0.3,
  /** Continuidade mínima que paga, a da peça perfeita e do cerco, e a abaixo da qual a interação entre terrenos entra. */
  payFloor: 0.5,
  perfectS: 0.8,
  synOpen: 0.55,
  contExp: 3,
  patchK: 1.5,
  patchExp: 1.8,
  shapeBase: 0.55,
  closeK: 20,
  closeExp: 1.5,
  /** Área mínima (em peças) da mancha cujo fechamento paga. */
  closeMin: 1,
  fitIn: 8,
  fitMid: 11,
} as const;

const SALT = 0x7e77a;
const LAND_N = 4;

const pure = (t: T): number[] => {
  const c = [0, 0, 0, 0];
  if (!isStrict(t)) c[t] = 1;
  return c;
};

/** A composição suavizada de cada borda de uma peça de bordas `edges` (orientação de origem), só da semente dela. */
export function smearComp(edges: readonly T[], seed: number): Comp {
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

/** Gira a composição junto com as bordas (a mesma conta de `rotateEdges`). Reaproveita os vetores. */
export function rotComp(comp: Comp, rot: number): Comp {
  return rotateEdges(comp as unknown as T[], rot) as unknown as Comp;
}

/** Continuidade (0 a 1) entre a borda `i` da peça A e a `j` da peça B, vistas na orientação do mundo: 3 amostras ao longo da emenda. */
export function continuity(ea: readonly T[], ca: Comp, i: number, eb: readonly T[], cb: Comp, j: number): number {
  if (isStrict(ea[i]) || isStrict(eb[j])) return ea[i] === eb[j] ? 1 : 0;
  const ia = (i + 5) % 6, ib = (i + 1) % 6, ja = (j + 5) % 6, jb = (j + 1) % 6;
  let d = 0;
  for (let k = 0; k < LAND_N; k++) {
    const ai = ca[i][k], bj = cb[j][k];
    // A borda vizinha dentro da peça, se for de terra; senão a própria borda (um caminho não mistura).
    const a0 = isStrict(ea[ia]) ? ai : ca[ia][k], a1 = isStrict(ea[ib]) ? ai : ca[ib][k];
    const b0 = isStrict(eb[ja]) ? bj : cb[ja][k], b1 = isStrict(eb[jb]) ? bj : cb[jb][k];
    d += Math.abs((3 * ai + a0) / 4 - (3 * bj + b1) / 4) + Math.abs(ai - bj) + Math.abs((3 * ai + a1) / 4 - (3 * bj + b0) / 4);
  }
  return 1 - d / 6;
}

/** Pontos de uma emenda de continuidade `s` (a borda perfeita vale `matchPoints`). */
export function seamPoints(s: number, matchPoints: number): number {
  const x = Math.max(0, (s - TERRA.payFloor) / (1 - TERRA.payFloor));
  return Math.round(matchPoints * x ** TERRA.contExp);
}

// ---------------------------------------------------------------------------------------------------------------------
// Manchas
// ---------------------------------------------------------------------------------------------------------------------

/** O que a regra precisa de um tabuleiro: as peças colocadas e a busca por casa. `Board` cumpre. */
export interface TerraTile {
  q: number;
  r: number;
  index: number;
  edges: readonly T[];
}
export interface TerraMap {
  readonly list: readonly TerraTile[];
  get(q: number, r: number): TerraTile | undefined;
}

/** O campo lido sobre as manchas: valor do crescimento, valor do fechamento, quantas manchas fechadas e quantas delas devolvem peça. */
export interface PatchField {
  patch: number;
  closed: number;
  closedN: number;
  backN: number;
}

let parent = new Int32Array(0);
let mass = new Int32Array(0);
let exposed = new Int32Array(0);
let voids = new Int32Array(0);
let nbr = new Int32Array(0);

function find(x: number): number {
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
}

/** Lê o campo das manchas do tabuleiro `w` (união-busca sobre (peça, setor); refeito do zero, O(6n)). `backMin` = área mínima (em peças) para devolver peça; `closeCap` = teto do prêmio de fechamento de UMA mancha (0 = sem teto). */
export function patchField(w: TerraMap, backMin = 1, closeCap = 0): PatchField {
  const list = w.list;
  const n = list.length * 6;
  if (parent.length < n) {
    const cap = Math.max(n, parent.length * 2, 6 * 128);
    parent = new Int32Array(cap);
    mass = new Int32Array(cap);
    exposed = new Int32Array(cap);
    voids = new Int32Array(cap);
    nbr = new Int32Array(cap);
  }
  for (let i = 0; i < n; i++) {
    parent[i] = i;
    mass[i] = 0;
    exposed[i] = 0;
    voids[i] = 0;
  }
  for (const t of list) {
    const e = t.edges;
    const base = t.index * 6;
    for (let s = 0; s < 6; s++) {
      const nb = w.get(t.q + DIRS[s][0], t.r + DIRS[s][1]);
      nbr[base + s] = nb ? nb.index : -1;
      const terr = e[s];
      if (isStrict(terr)) continue;
      // Dentro da peça, setores vizinhos iguais se unem; entre peças, bordas iguais encostadas.
      if (e[(s + 1) % 6] === terr) parent[find(base + s)] = find(base + ((s + 1) % 6));
      if (nb && nb.index > t.index && nb.edges[opposite(s)] === terr) parent[find(base + s)] = find(nb.index * 6 + opposite(s));
    }
  }
  for (let i = 0; i < n; i++) mass[find(i)]++;
  for (const t of list) {
    const base = t.index * 6;
    for (let s = 0; s < 6; s++) {
      if (isStrict(t.edges[s])) continue;
      const k = nbr[base + s];
      const root = find(base + s);
      if (k < 0) {
        exposed[root]++;
        voids[root]++;
      } else if (list[k].edges[opposite(s)] !== t.edges[s]) exposed[root]++;
    }
  }
  let v = 0, c = 0, cn = 0, bn = 0;
  for (let i = 0; i < n; i++) {
    if (mass[i] === 0 || find(i) !== i || isStrict(list[(i / 6) | 0].edges[i % 6])) continue;
    const a = mass[i] / 6;
    const compact = Math.min(1, (6 * Math.sqrt(a)) / Math.max(1, exposed[i]));
    const shape = TERRA.shapeBase + (1 - TERRA.shapeBase) * compact;
    v += TERRA.patchK * a ** TERRA.patchExp * shape;
    if (voids[i] === 0 && a >= TERRA.closeMin) {
      const prize = TERRA.closeK * a ** TERRA.closeExp * shape;
      c += closeCap > 0 ? Math.min(prize, closeCap) : prize;
      cn++;
      if (a >= backMin) bn++;
    }
  }
  return { patch: Math.round(v), closed: Math.round(c), closedN: cn, backN: bn };
}

/**
 * Manchas incrementais: a mesma conta de `patchField`, mas mantida peça a peça (união-busca sobre (peça, setor) com massa, bordas expostas e
 * bordas para o vazio por raiz). `add` custa O(1) por peça posta e `read` só varre as raízes, sem refazer a vizinhança de ninguém; o
 * `Board` guarda um e a cópia da prévia herda o dele (`clone`). A soma vai na mesma ordem de raízes do `patchField`, então o resultado sai
 * igual (conferido em tests/terra-bancada.ts contra o `patchField` e contra o oráculo de busca em largura).
 */
export class PatchCache {
  parent: Int32Array;
  mass: Int32Array;
  exposed: Int32Array;
  voids: Int32Array;
  /** Setores já postos (6 por peça). */
  n = 0;

  constructor(cap = 6 * 128) {
    this.parent = new Int32Array(cap);
    this.mass = new Int32Array(cap);
    this.exposed = new Int32Array(cap);
    this.voids = new Int32Array(cap);
  }

  clone(extra = 6): PatchCache {
    const c = new PatchCache(Math.max(this.parent.length, this.n + extra));
    c.parent.set(this.parent.subarray(0, this.n));
    c.mass.set(this.mass.subarray(0, this.n));
    c.exposed.set(this.exposed.subarray(0, this.n));
    c.voids.set(this.voids.subarray(0, this.n));
    c.n = this.n;
    return c;
  }

  find(x: number): number {
    const parent = this.parent;
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  private union(a: number, b: number) {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    this.parent[ra] = rb;
    this.mass[rb] += this.mass[ra];
    this.exposed[rb] += this.exposed[ra];
    this.voids[rb] += this.voids[ra];
  }

  /** Acrescenta a peça `t`, que acabou de entrar em `w` com o próximo índice. */
  add(w: TerraMap, t: TerraTile) {
    const base = t.index * 6;
    if (base !== this.n) throw new Error('PatchCache: peça fora de ordem');
    if (base + 6 > this.parent.length) {
      const grown = this.clone(Math.max(this.parent.length, 6 * 128));
      this.parent = grown.parent;
      this.mass = grown.mass;
      this.exposed = grown.exposed;
      this.voids = grown.voids;
    }
    this.n = base + 6;
    const e = t.edges;
    for (let s = 0; s < 6; s++) {
      const i = base + s;
      this.parent[i] = i;
      this.mass[i] = isStrict(e[s]) ? 0 : 1;
      this.exposed[i] = 0;
      this.voids[i] = 0;
    }
    // Bordas: a do setor novo e a do setor vizinho que olhava para esta casa (que estava virada para o vazio).
    for (let s = 0; s < 6; s++) {
      const terr = e[s];
      if (isStrict(terr)) continue;
      const nb = w.get(t.q + DIRS[s][0], t.r + DIRS[s][1]);
      if (!nb) {
        this.exposed[base + s]++;
        this.voids[base + s]++;
        continue;
      }
      const o = opposite(s);
      const nt = nb.edges[o];
      if (nt !== terr) this.exposed[base + s]++;
      if (!isStrict(nt)) {
        const root = this.find(nb.index * 6 + o);
        this.voids[root]--;
        if (nt === terr) this.exposed[root]--;
      }
    }
    for (let s = 0; s < 6; s++) {
      const terr = e[s];
      if (isStrict(terr)) continue;
      if (e[(s + 1) % 6] === terr) this.union(base + s, base + ((s + 1) % 6));
      const nb = w.get(t.q + DIRS[s][0], t.r + DIRS[s][1]);
      if (nb && nb.edges[opposite(s)] === terr) this.union(base + s, nb.index * 6 + opposite(s));
    }
  }

  /** O campo lido sobre as manchas (a mesma conta de `patchField`). */
  read(backMin = 1, closeCap = 0): PatchField {
    let v = 0, c = 0, cn = 0, bn = 0;
    const { mass, exposed, voids, parent } = this;
    for (let i = 0; i < this.n; i++) {
      if (mass[i] === 0 || parent[i] !== i) continue;
      const a = mass[i] / 6;
      const compact = Math.min(1, (6 * Math.sqrt(a)) / Math.max(1, exposed[i]));
      const shape = TERRA.shapeBase + (1 - TERRA.shapeBase) * compact;
      v += TERRA.patchK * a ** TERRA.patchExp * shape;
      if (voids[i] === 0 && a >= TERRA.closeMin) {
        const prize = TERRA.closeK * a ** TERRA.closeExp * shape;
        c += closeCap > 0 ? Math.min(prize, closeCap) : prize;
        cn++;
        if (a >= backMin) bn++;
      }
    }
    return { patch: Math.round(v), closed: Math.round(c), closedN: cn, backN: bn };
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// A mancha vista de fora (o fantasma que mostra a paisagem, Fase 3)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Um trecho do contorno de uma mancha, na orientação do mundo: o lado `i` da casa (q, r) (do canto `i` ao `i+1`), ou, com `ray`, o raio do
 * centro da casa ao canto `i` (a divisa entre o setor `i-1` e o `i` dentro da peça). `open` = o lado dá para uma casa vazia (o que falta
 * para fechar); senão dá para outro terreno, rio ou trilho.
 */
export interface PatchSeg {
  q: number;
  r: number;
  ray: boolean;
  i: number;
  open: boolean;
}

/** Uma mancha que a jogada candidata toca, já com a peça incluída. Sai da REGRA (setores de bordas), não do campo suavizado do desenho. */
export interface PatchView {
  terrain: T;
  /** Área (em peças) com a peça incluída e a das manchas que ela juntou (0 = mancha nova: só os setores da própria peça). */
  area: number;
  before: number;
  /** Quantas manchas antigas a peça uniu. */
  merged: number;
  /** A mancha fica cercada, sem borda para o vazio: o fechamento paga. */
  closes: boolean;
  segs: PatchSeg[];
}

/** O que a regra mostra do fantasma numa casa: as manchas, e as terras antigas que a água da jogada vai molhar (a umidade que sobe). */
export interface TerraView {
  patches: PatchView[];
  moist: { q: number; r: number; gain: number }[];
}

/**
 * As manchas que a peça `t` (já posta em `w`, com o cache `cache` em dia) toca. Com `base` (o tabuleiro de antes da peça), cada uma traz a
 * área anterior e quantas manchas uniu, e a mancha só dos setores da própria peça (sem emenda, sem fechar) fica de fora. O contorno vai
 * até `reach` casas da peça (a mancha pode atravessar o mapa); `onlyClosed` devolve só as que fecham.
 */
export function patchViews(
  w: { get(q: number, r: number): TerraTile | undefined },
  cache: PatchCache,
  t: TerraTile,
  base?: { w: { get(q: number, r: number): TerraTile | undefined }; cache: PatchCache },
  reach = 9,
  onlyClosed = false,
): PatchView[] {
  const out: PatchView[] = [];
  const done = new Set<number>();
  const b0 = t.index * 6;
  for (let s = 0; s < 6; s++) {
    const terr = t.edges[s];
    if (isStrict(terr)) continue;
    const root = cache.find(b0 + s);
    if (done.has(root)) continue;
    done.add(root);
    const area = cache.mass[root] / 6;
    const closes = cache.voids[root] === 0 && area >= TERRA.closeMin;
    if (onlyClosed && !closes) continue;
    let before = 0, merged = 0;
    if (base) {
      const seen = new Set<number>();
      for (let k = 0; k < 6; k++) {
        if (t.edges[k] !== terr) continue;
        const nb = base.w.get(t.q + DIRS[k][0], t.r + DIRS[k][1]);
        if (!nb || nb.edges[opposite(k)] !== terr) continue;
        const br = base.cache.find(nb.index * 6 + opposite(k));
        if (seen.has(br)) continue;
        seen.add(br);
        before += base.cache.mass[br] / 6;
        merged++;
      }
      if (merged === 0 && !closes) continue;
    }
    const segs: PatchSeg[] = [];
    for (let dq = -reach; dq <= reach; dq++) {
      for (let dr = Math.max(-reach, -dq - reach); dr <= Math.min(reach, -dq + reach); dr++) {
        const q = t.q + dq, r = t.r + dr;
        const o = w.get(q, r);
        if (!o) continue;
        const ob = o.index * 6;
        for (let k = 0; k < 6; k++) {
          if (isStrict(o.edges[k]) || cache.find(ob + k) !== root) continue;
          const nb = w.get(q + DIRS[k][0], r + DIRS[k][1]);
          if (!nb) segs.push({ q, r, ray: false, i: k, open: true });
          else if (nb.edges[opposite(k)] !== terr) segs.push({ q, r, ray: false, i: k, open: false });
          if (isStrict(o.edges[(k + 5) % 6]) || o.edges[(k + 5) % 6] !== terr) segs.push({ q, r, ray: true, i: k, open: false });
          if (isStrict(o.edges[(k + 1) % 6]) || o.edges[(k + 1) % 6] !== terr) segs.push({ q, r, ray: true, i: (k + 1) % 6, open: false });
        }
      }
    }
    out.push({ terrain: terr, area, before, merged, closes, segs });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Umidade (a do Orvalho)
// ---------------------------------------------------------------------------------------------------------------------

const MOIST = [1.0, 0.7, 0.45, 0.25];
const MOIST_FAR = 0.1;
const FOREST_BOOST = 0.1;
const BOOST_CAP = 0.2;
const REACH = 3;
/** Faixa de umidade que cada terreno gosta (índice = T.Grass..T.Village): prado, mata, plantação, vila. */
const RANGE: readonly (readonly [number, number])[] = [[0.2, 0.6], [0.4, 1.0], [0.5, 0.8], [0.1, 0.4]];

const hasWater = (edges: readonly T[]) => edges.includes(T.Water);
const forestish = (edges: readonly T[]) => edges.filter((e) => e === T.Forest).length >= 3;

/** Umidade da casa (q, r): a água mais próxima (até 3 casas) e a mata em volta. */
export function moistureAt(w: TerraMap, q: number, r: number): number {
  let d = REACH + 1;
  for (let dq = -REACH; dq <= REACH; dq++) {
    for (let dr = Math.max(-REACH, -dq - REACH); dr <= Math.min(REACH, -dq + REACH); dr++) {
      const p = w.get(q + dq, r + dr);
      if (!p || !hasWater(p.edges)) continue;
      const k = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
      if (k < d) d = k;
    }
  }
  let m = d <= REACH ? MOIST[d] : MOIST_FAR;
  let boost = 0;
  for (const [dq, dr] of DIRS) {
    const p = w.get(q + dq, r + dr);
    if (p && forestish(p.edges)) boost += FOREST_BOOST;
  }
  m += Math.min(BOOST_CAP, boost);
  return Math.min(1, m);
}

/** A mistura da peça: a média das bordas de terra (4 números, soma 1; tudo 0 se não houver terra). */
export function tileMix(edges: readonly T[], comp: Comp): number[] {
  const out = [0, 0, 0, 0];
  let n = 0;
  for (let i = 0; i < 6; i++) {
    if (isStrict(edges[i])) continue;
    n++;
    for (let k = 0; k < LAND_N; k++) out[k] += comp[i][k];
  }
  if (n) for (let k = 0; k < LAND_N; k++) out[k] /= n;
  return out;
}

/** Pontos (inteiros) de uma peça de mistura `mix` com umidade `m`. */
export function fitPoints(mix: readonly number[], m: number): number {
  let s = 0;
  for (let k = 0; k < mix.length; k++) {
    const [lo, hi] = RANGE[k];
    if (!mix[k] || m < lo || m > hi) continue;
    const mid = (lo + hi) / 2;
    s += mix[k] * (Math.abs(m - mid) <= (hi - lo) / 4 ? TERRA.fitMid : TERRA.fitIn);
  }
  return Math.round(s);
}

/** Quem pode ter a umidade mudada pela peça `p` recém-posta: ela mesma e as vizinhas até onde a água (3) ou a mata (1) alcança. */
export function moistAffected<P extends TerraTile>(w: { get(q: number, r: number): P | undefined }, p: P): P[] {
  const out: P[] = [p];
  const reach = hasWater(p.edges) ? REACH : forestish(p.edges) ? 1 : 0;
  for (let dq = -reach; dq <= reach; dq++) {
    for (let dr = Math.max(-reach, -dq - reach); dr <= Math.min(reach, -dq + reach); dr++) {
      if (!dq && !dr) continue;
      const o = w.get(p.q + dq, p.r + dr);
      if (o) out.push(o);
    }
  }
  return out;
}
