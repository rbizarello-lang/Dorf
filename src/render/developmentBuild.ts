import { T } from '../core/tiles';
import type { DevelopmentValues } from '../core/development';
import type { TileBuild, Deco } from './tileBuilder';

/** Modifica só o resultado procedural local. As posições-base continuam ligadas à semente. */
export function developBuild(tile: TileBuild, edges: readonly T[], levels: DevelopmentValues) {
  const stage = (terrain: T) => levels[edges.indexOf(terrain)] ?? 0;
  const town = stage(T.Village), forest = stage(T.Forest), field = stage(T.Field);
  const additions: Deco[] = [];
  let tree = 0, crop = 0;
  for (const d of tile.decos) {
    if (d.key.startsWith('wall:') || d.key.startsWith('roof:')) d.sy *= 1 + 0.24 * town;
    if (d.key.startsWith('tree:') && forest) {
      d.sy *= 1 + 0.18 * forest;
      d.sx *= 1 + 0.07 * forest; d.sz *= 1 + 0.07 * forest;
      if (tree++ % 4 < forest) additions.push({ ...d, x: d.x * 0.92, z: d.z * 0.92, sx: d.sx * 0.75, sz: d.sz * 0.75, sy: d.sy * 0.8, ry: d.ry + 0.8 });
    }
    if (d.key.startsWith('crop:') && field) {
      d.sy *= 1 + 0.12 * field;
      if (crop++ % 5 < field) additions.push({ ...d, x: d.x * 0.985, z: d.z * 0.985, sx: d.sx * 0.8, sz: d.sz * 0.8, ry: d.ry + 0.1 });
    }
  }
  if (town) for (let i = 1; i < tile.chimneys.length; i += 4) tile.chimneys[i] *= 1 + 0.24 * town;
  // Um celeiro ocupa um pequeno trecho já cultivado; as plantas sob ele cedem lugar.
  if (field >= 2) {
    const anchor = tile.decos.find((d) => d.key.startsWith('crop:') && Math.hypot(d.x,d.z) > 0.42 && Math.hypot(d.x,d.z) < 0.65);
    if (anchor) {
      tile.decos = tile.decos.filter((d) => !d.key.startsWith('crop:') || Math.hypot(d.x-anchor.x,d.z-anchor.z) > 0.10);
      additions.push({ ...anchor, key: 'granary', sx: 0.65, sy: 0.65 + 0.08 * field, sz: 0.65, color: anchor.color.clone().set('#f3e2bd') });
      if (field === 3) additions.push({ ...anchor, key: 'fence', x: anchor.x * 0.83, z: anchor.z * 0.83, sx: 0.55, sy: 0.7, sz: 0.55 });
    }
  }
  if (field >= 2) {
    const granary = additions.find((d) => d.key === 'granary');
    if (granary) for (let i=additions.length-1;i>=0;i--) if (additions[i].key.startsWith('crop:') && Math.hypot(additions[i].x-granary.x,additions[i].z-granary.z)<0.10) additions.splice(i,1);
  }
  tile.decos.push(...additions);
}

