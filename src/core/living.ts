// Paisagem viva: o estágio de desenvolvimento de cada terreno de cada peça. Só aparência: não entra na pontuação, no replay nem no save
// (sem SAVE_VERSION). Ideia do Roger; implementação de referência do GPT Astra (jogo-entrepostos 5035a34), refeita aqui como função pura
// do TABULEIRO FINAL: o resultado não depende da ordem das jogadas, então replay, desfazer e carregar o save dão a mesma paisagem.
//
// Regra (números em `LIVING`):
//   1. ENCAIXES. Para cada terreno de terra (prado, mata, plantação, vila) de uma peça, conta-se em quantas das bordas desse terreno a
//      vizinha tem o mesmo terreno do outro lado. Estágio = min(3, encaixes). Zero encaixe = estágio 0 (a peça como sempre foi).
//   2. MANCHAS (só no modo Terra contínua, `rules.terra`). Mancha = grupo de setores do mesmo terreno, como `Board.computeGroups` e a
//      mancha da regra (terra.ts). A área é em peças (cunhas ÷ 6, a mesma `a` da regra). Uma mancha FECHADA (nenhum setor dela dá para o
//      vazio) leva todas as peças dela ao estágio máximo daquele terreno; uma mancha GRANDE (área ≥ `largeArea`) ainda aberta sobe um
//      estágio em todas as peças dela. Assim o mundo responde nos pontos (a mancha paga ao crescer e ao fechar) e na paisagem.
//   3. Rio e trilho (terrenos estritos) não têm estágio neste mapa. O renderizador alarga as emendas dos rios de forma independente.
import { DIRS, opposite } from './hex';
import type { Board } from './board';
import { LAND, T, isStrict } from './tiles';

export const LIVING = {
  /** Estágio máximo. */
  maxStage: 3,
  /** Terra: área mínima (em peças) da mancha ainda aberta que sobe um estágio. */
  largeArea: 4,
} as const;

/** Estágio de cada terreno (indexado por `T`; rio e trilho sempre 0) de uma peça. */
export type Stages = readonly number[];

/** Estágio de cada peça do tabuleiro, pela chave dela (`Placed.key`). */
export type StageMap = Map<number, Stages>;

const ZERO: Stages = [0, 0, 0, 0, 0, 0];

/** Estágio zero para tudo (viva desligada, ou peça sem estágio). */
export const NO_STAGES: Stages = ZERO;

/** Os estágios dos 4 terrenos de terra em texto (entra na assinatura da peça: mudou, a peça é refeita). */
export const stageSig = (s: Stages) => `${s[0]}${s[1]}${s[2]}${s[3]}`;

/** Encaixes por terreno de uma peça: bordas do terreno cuja vizinha tem o mesmo terreno do outro lado. */
function matches(board: Board, q: number, r: number, edges: readonly T[]): number[] {
  const m = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6; i++) {
    const nb = board.get(q + DIRS[i][0], r + DIRS[i][1]);
    if (nb && nb.edges[opposite(i)] === edges[i]) m[edges[i]]++;
  }
  return m;
}

/** Os estágios de toda peça assentada. Puro: só lê as bordas e as posições. */
export function livingStages(board: Board): StageMap {
  const out: StageMap = new Map();
  const n = board.list.length;
  // Posição de cada peça na lista (não depende de `Placed.index`: a ordem em que as peças foram postas é irrelevante).
  const at = new Map<number, number>();
  board.list.forEach((p, i) => at.set(p.key, i));
  const base: number[][] = new Array(n);
  const stage = new Array<number[]>(n);
  board.list.forEach((p, i) => {
    base[i] = matches(board, p.q, p.r, p.edges);
    stage[i] = base[i].map((c) => Math.min(LIVING.maxStage, c));
  });

  if (board.rules.terra) {
    // Manchas por união-busca sobre (peça, setor), feita aqui do zero (não depende do cache da regra).
    const parent = new Int32Array(n * 6);
    for (let i = 0; i < parent.length; i++) parent[i] = i;
    const find = (x: number): number => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    const union = (a: number, b: number) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };
    board.list.forEach((p, i) => {
      for (let s = 0; s < 6; s++) {
        const terr = p.edges[s];
        if (isStrict(terr)) continue;
        if (p.edges[(s + 1) % 6] === terr) union(i * 6 + s, i * 6 + ((s + 1) % 6));
        const nb = board.get(p.q + DIRS[s][0], p.r + DIRS[s][1]);
        if (nb && nb.edges[opposite(s)] === terr) union(i * 6 + s, at.get(nb.key)! * 6 + opposite(s));
      }
    });
    const wedges = new Map<number, number>();
    const open = new Set<number>();
    board.list.forEach((p, i) => {
      for (let s = 0; s < 6; s++) {
        if (isStrict(p.edges[s])) continue;
        const root = find(i * 6 + s);
        wedges.set(root, (wedges.get(root) ?? 0) + 1);
        if (!board.get(p.q + DIRS[s][0], p.r + DIRS[s][1])) open.add(root);
      }
    });
    board.list.forEach((p, i) => {
      for (let s = 0; s < 6; s++) {
        const t = p.edges[s];
        if (isStrict(t)) continue;
        const root = find(i * 6 + s);
        let v: number;
        if (!open.has(root)) v = LIVING.maxStage;
        else if ((wedges.get(root) ?? 0) / 6 >= LIVING.largeArea) v = Math.min(LIVING.maxStage, base[i][t] + 1);
        else continue;
        if (v > stage[i][t]) stage[i][t] = v;
      }
    });
  }
  for (const [i, p] of board.list.entries()) {
    const s = stage[i];
    // Só terra tem estágio.
    for (let t = 0; t < 6; t++) if (!LAND.includes(t as T)) s[t] = 0;
    out.set(p.key, s);
  }
  return out;
}

/** Peças cujos estágios mudaram de um mapa para o outro (peça nova incluída). */
export function stageChanges(before: StageMap, after: StageMap): number[] {
  const keys: number[] = [];
  for (const [k, s] of after) {
    const b = before.get(k);
    if (!b || stageSig(b) !== stageSig(s)) keys.push(k);
  }
  return keys;
}

/**
 * Estágios que a peça de bordas `edges` (mundo) teria na casa vazia (q, r): só os encaixes, sem as manchas da Terra (o fantasma mostra o
 * que já se sabe sem refazer as manchas). Usada no fantasma; ao pousar, `livingStages` dá o valor final.
 */
export function previewStages(board: Board, q: number, r: number, edges: readonly T[]): Stages {
  return matches(board, q, r, edges).map((c, t) => (LAND.includes(t as T) ? Math.min(LIVING.maxStage, c) : 0));
}

/**
 * As peças vizinhas da casa (q, r) cujo estágio base (encaixes) muda se a peça de bordas `edges` pousar ali: alimenta o aviso do fantasma
 * ("N vizinhas crescem"). Conta só encaixes, como `previewStages`.
 */
export function previewGrowth(board: Board, q: number, r: number, edges: readonly T[]): number {
  let n = 0;
  for (let i = 0; i < 6; i++) {
    const nb = board.get(q + DIRS[i][0], r + DIRS[i][1]);
    if (!nb || isStrict(edges[i]) || nb.edges[opposite(i)] !== edges[i]) continue;
    const t = edges[i];
    const before = matches(board, nb.q, nb.r, nb.edges)[t];
    if (Math.min(LIVING.maxStage, before + 1) > Math.min(LIVING.maxStage, before)) n++;
  }
  return n;
}
