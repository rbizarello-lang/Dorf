// Manchas de terreno: união-busca sobre (peça, setor), como o `Board.computeGroups`, mas a massa de uma mancha é medida em CUNHAS (cada
// setor de uma peça é 1/6 dela: a área real de terreno, não o número de peças em que ela toca). Usada pela Argila (a divisa cede para o lado de
// menor massa) e pela Terra contínua (mancha por área e forma).
//
// Refeita do zero a cada chamada (O(6n), ~10 µs com 100 peças): a bancada mede as jogadas de várias peças em cada decisão, e o cache de
// um desfazer seria a maior fonte de erro. As áreas ficam em arrays globais reaproveitados (o motor roda em um só fio).
import { DIRS } from '../../src/core/hex';
import { T, isStrict } from '../../src/core/tiles';
import { opp, type LiteWorld } from './lite';

const SIZE = 6 * 512;
const parent = new Int32Array(SIZE);
/** Cunhas da mancha (só na raiz). */
export const mass = new Int32Array(SIZE);
/** Bordas da mancha viradas para o vazio ou para outro terreno (só na raiz): o "perímetro". */
export const exposed = new Int32Array(SIZE);

export function find(x: number): number {
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
}

function union(a: number, b: number) {
  const ra = find(a), rb = find(b);
  if (ra !== rb) parent[ra] = rb;
}

/** Monta as manchas do mundo `w` (com a peça tentativa já posta, se houver). Devolve quantos setores há (6 por peça). */
export function buildGroups(w: LiteWorld): number {
  const list = w.tilesList;
  const n = list.length * 6;
  for (let i = 0; i < n; i++) {
    parent[i] = i;
    mass[i] = 0;
    exposed[i] = 0;
  }
  for (const t of list) {
    const e = t.v.edges;
    const base = t.idx * 6;
    for (let s = 0; s < 6; s++) {
      const terr = e[s];
      // Dentro da peça: setores vizinhos iguais se unem; rio e trilho se unem pelo centro (como no núcleo).
      if (isStrict(terr)) {
        for (let s2 = s + 1; s2 < 6; s2++) if (e[s2] === terr) union(base + s, base + s2);
      } else if (e[(s + 1) % 6] === terr) union(base + s, base + ((s + 1) % 6));
      const nb = w.at(t.q + DIRS[s][0], t.r + DIRS[s][1]);
      if (nb && nb.idx > t.idx && nb.v.edges[opp(s)] === terr) union(base + s, nb.idx * 6 + opp(s));
    }
  }
  for (let i = 0; i < n; i++) mass[find(i)]++;
  for (const t of list) {
    const e = t.v.edges;
    for (let s = 0; s < 6; s++) {
      const nb = w.at(t.q + DIRS[s][0], t.r + DIRS[s][1]);
      if (!nb || nb.v.edges[opp(s)] !== e[s]) exposed[find(t.idx * 6 + s)]++;
    }
  }
  return n;
}

/** Terreno de uma raiz. */
export const terrainOf = (w: LiteWorld, root: number): T => w.tilesList[(root / 6) | 0].v.edges[root % 6];
