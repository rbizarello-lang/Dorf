// Paisagem viva (desenho): aplica os estágios de `core/living.ts` à decoração de UMA peça já montada. Só muda escala e acrescenta
// instâncias dos kits que já existem (árvore, plantação, flor), mais um único kit novo, o celeiro `barn`: nenhum pool por estágio.
// A posição-base de tudo continua saindo da semente da peça (invariante 3); aqui não há sorteio novo (as cópias saem da ordem das
// decorações, que é determinística). A era das casas segue valendo: a geometria troca em `Lib.setEra` e a escala por instância
// daqui se compõe com ela (a casa da terceira era também sobe com o estágio).
import { edgeMid } from '../core/hex';
import { T } from '../core/tiles';
import type { Stages } from '../core/living';
import type { Deco, TileBuild } from './tileBuilder';

/** Quanto cada estágio soma (por estágio): altura e largura das casas, das copas e altura das plantas; tamanho do celeiro. */
export const GROW = { house: 0.22, houseWide: 0.05, treeH: 0.18, treeW: 0.08, cropH: 0.12, barn: 0.55 } as const;

const MIDS = [0, 1, 2, 3, 4, 5].map((i) => edgeMid(i));

/** Setor (borda de origem) mais próximo do ponto local da peça. */
function sectorAt(x: number, z: number) {
  let best = 0, bd = -Infinity;
  for (let i = 0; i < 6; i++) {
    const d = x * MIDS[i][0] + z * MIDS[i][1];
    if (d > bd) (bd = d), (best = i);
  }
  return best;
}

const copy = (d: Deco, over: Partial<Deco>): Deco => ({ ...d, color: d.color.clone(), ...over });

/**
 * Desenvolve a peça no lugar. `edges` são as bordas de ORIGEM (a orientação em que a peça é montada), porque as decorações estão
 * nessa orientação; `stages` é por terreno e não depende do giro. Estágios todos 0 não mexem em nada.
 */
export function developBuild(tile: TileBuild, edges: readonly T[], stages: Stages) {
  const town = stages[T.Village], forest = stages[T.Forest], field = stages[T.Field], grass = stages[T.Grass];
  if (!town && !forest && !field && !grass) return;
  const add: Deco[] = [];
  let tree = 0, crop = 0, flower = 0;
  let barnAt: Deco | null = null;
  for (const d of tile.decos) {
    const k = d.key;
    if (town && (k.startsWith('wall:') || k.startsWith('roof:'))) {
      d.sy *= 1 + GROW.house * town;
      d.sx *= 1 + GROW.houseWide * town;
      d.sz *= 1 + GROW.houseWide * town;
    } else if (forest && k.startsWith('tree:') && edges[sectorAt(d.x, d.z)] === T.Forest) {
      d.sy *= 1 + GROW.treeH * forest;
      d.sx *= 1 + GROW.treeW * forest;
      d.sz *= 1 + GROW.treeW * forest;
      // Mais copas: uma árvore em cada seis ganha uma vizinha menor (1, 2 ou 3 em cada 6 conforme o estágio).
      if (tree++ % 6 < forest) add.push(copy(d, { x: d.x * 0.93, z: d.z * 0.93, sx: d.sx * 0.72, sy: d.sy * 0.8, sz: d.sz * 0.72, ry: d.ry + 0.8 }));
    } else if (field && k.startsWith('crop:') && edges[sectorAt(d.x, d.z)] === T.Field) {
      d.sy *= 1 + GROW.cropH * field;
      if (crop++ % 8 < field) add.push(copy(d, { x: d.x * 0.985, z: d.z * 0.985, sx: d.sx * 0.8, sz: d.sz * 0.8, ry: d.ry + 0.1 }));
      const r = Math.hypot(d.x, d.z);
      if (field >= 2 && !barnAt && r > 0.42 && r < 0.65) barnAt = d;
    } else if (grass && k === 'flower' && edges[sectorAt(d.x, d.z)] === T.Grass && flower++ % 3 < grass) {
      add.push(copy(d, { x: d.x + 0.012, z: d.z - 0.01, sx: d.sx * 0.9, sz: d.sz * 0.9 }));
    }
  }
  if (town) for (let i = 1; i < tile.chimneys.length; i += 4) tile.chimneys[i] *= 1 + GROW.house * town;
  // Celeiro (estágios 2 e 3) num trecho já plantado: as plantas sob ele cedem lugar, e ele olha para o centro da peça.
  if (barnAt) {
    const b = barnAt as Deco;
    const near = (d: Deco) => d.key.startsWith('crop:') && Math.hypot(d.x - b.x, d.z - b.z) < 0.1;
    tile.decos = tile.decos.filter((d) => !near(d));
    for (let i = add.length - 1; i >= 0; i--) if (near(add[i])) add.splice(i, 1);
    const s = GROW.barn + 0.1 * (field - 1);
    add.push({ ...b, key: 'barn', color: b.color.clone().set('#ffffff'), ry: Math.atan2(b.x, b.z) + Math.PI, sx: s, sy: s, sz: s });
  }
  tile.decos.push(...add);
}
