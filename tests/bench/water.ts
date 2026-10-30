// A conta da água dos mundos leves: usa o `waterState` do núcleo (função pura sobre a lista de peças com água), então a regra de
// "a água só desce até o mar" é a do jogo. O ganho de uma peça é a diferença entre o estado depois e antes (só cresce).
import { waterState, type WaterState, type WaterTile } from '../../src/core/water';

export interface WaterGain {
  pts: number;
  tiles: number;
}

export class WaterTracker {
  tiles: WaterTile[] = [];
  private cache: WaterState | null = null;

  constructor(
    private flowPoints: number,
    private seaPoints: number,
    private seaTiles: number,
  ) {}

  private state(): WaterState {
    return (this.cache ??= waterState(this.tiles));
  }

  /** O que a peça `w` renderia se entrasse: pontos por água corrente a mais e por nascentes que chegam ao mar, e as peças que o mar traz. */
  gain(w: WaterTile): WaterGain {
    const before = this.state();
    const after = waterState([...this.tiles, w]);
    const flowing = after.flow.size - before.flow.size;
    const seas = after.reached.size - before.reached.size;
    return { pts: flowing * this.flowPoints + seas * this.seaPoints, tiles: seas * this.seaTiles };
  }

  add(w: WaterTile) {
    this.tiles.push(w);
    this.cache = null;
  }

  copyInto(o: WaterTracker) {
    o.tiles = this.tiles.slice();
    o.cache = this.cache;
  }
}
