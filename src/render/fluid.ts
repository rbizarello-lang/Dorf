// Encaixe fluido (`?fluido`): o hexágono continua sendo a lógica, mas o desenho dele se dissolve. O chão, a água, a queda e a
// decoração de cada peça são deslocados no plano por UMA função só das coordenadas do mundo (soma de ondas). Duas peças vizinhas
// leem a mesma função na divisa, então a emenda continua fechada, e a costa deixa de ser seis retas. Sem three.js: só contas.
import { mulberry32 } from '../core/rng';
import type { Deco, TileBuild } from './tileBuilder';

/** Amplitude do deslocamento (unidades do mundo). O gradiente máximo fica abaixo de 1 (a malha não dobra sobre si). */
export const FLUID_AMP = 0.3;

/** Ondas: [peso, kx, kz] do deslocamento em x e em z (comprimentos de onda de ~1,4 a ~3,8). */
const WX: ReadonlyArray<readonly [number, number, number]> = [[0.55, 0.92, 1.37], [0.3, 2.1, -1.6], [0.15, 2.2, 3.9]];
const WZ: ReadonlyArray<readonly [number, number, number]> = [[0.55, 1.31, -0.95], [0.3, 1.7, 2.2], [0.15, 4.1, -2.0]];

export class Warp {
  private readonly px: number[];
  private readonly pz: number[];
  constructor(seed: number, readonly amp = FLUID_AMP) {
    const rng = mulberry32((seed ^ 0x51d1f) >>> 0);
    this.px = WX.map(() => rng() * Math.PI * 2);
    this.pz = WZ.map(() => rng() * Math.PI * 2);
  }

  /** Deslocamento (dx, dz) do ponto (x, z) do mundo, gravado em `out`. */
  at(x: number, z: number, out: [number, number] = [0, 0]): [number, number] {
    let dx = 0, dz = 0;
    for (let i = 0; i < WX.length; i++) {
      dx += WX[i][0] * Math.sin(WX[i][1] * x + WX[i][2] * z + this.px[i]);
      dz += WZ[i][0] * Math.sin(WZ[i][1] * x + WZ[i][2] * z + this.pz[i]);
    }
    out[0] = dx * this.amp;
    out[1] = dz * this.amp;
    return out;
  }

  /** Inverso aproximado: o ponto do mundo "sem deslocamento" que cai em (x, z) (ponto fixo; o gradiente é < 1). */
  inverse(x: number, z: number): [number, number] {
    let qx = x, qz = z;
    const d: [number, number] = [0, 0];
    for (let i = 0; i < 4; i++) {
      this.at(qx, qz, d);
      qx = x - d[0];
      qz = z - d[1];
    }
    return [qx, qz];
  }
}

const done = new WeakSet<object>();
/** A peça já passou por `warpBuild` (a peça viva já vem deslocada; o `bake` não desloca duas vezes). */
export const isWarped = (b: TileBuild) => done.has(b);

/**
 * A peça pronta com o deslocamento aplicado, para a peça pousada pela matriz `e` (elementos da matriz de giro em y e posição).
 * Devolve uma cópia rasa: só os vetores de posição e a decoração mudam; cores, correnteza e o resto são os mesmos objetos.
 */
export function warpBuild(b: TileBuild, e: ArrayLike<number>, w: Warp): TileBuild {
  const d: [number, number] = [0, 0];
  /** Desloca um ponto local (x, z): o deslocamento do mundo volta para o local pela transposta do giro. */
  const shift = (x: number, z: number): [number, number] => {
    w.at(e[0] * x + e[8] * z + e[12], e[2] * x + e[10] * z + e[14], d);
    return [e[0] * d[0] + e[2] * d[1], e[8] * d[0] + e[10] * d[1]];
  };
  const pts = (src: Float32Array): Float32Array => {
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 3) {
      const [sx, sz] = shift(src[i], src[i + 2]);
      out[i] = src[i] + sx;
      out[i + 1] = src[i + 1];
      out[i + 2] = src[i + 2] + sz;
    }
    return out;
  };
  const decos: Deco[] = b.decos.map((o) => {
    const [sx, sz] = shift(o.x, o.z);
    return { ...o, x: o.x + sx, z: o.z + sz };
  });
  const chimneys = b.chimneys.slice();
  for (let i = 0; i < chimneys.length; i += 4) {
    const [sx, sz] = shift(chimneys[i], chimneys[i + 2]);
    chimneys[i] += sx;
    chimneys[i + 2] += sz;
  }
  const falls = b.falls.slice();
  for (let i = 0; i < falls.length; i += 6) {
    const [sx, sz] = shift(falls[i], falls[i + 1]);
    falls[i] += sx;
    falls[i + 1] += sz;
  }
  const out: TileBuild = { ...b, pos: pts(b.pos), water: pts(b.water), decos, chimneys, falls, fall: { ...b.fall, pos: pts(b.fall.pos) }, foam: { ...b.foam, pos: pts(b.foam.pos) } };
  done.add(out);
  return out;
}
