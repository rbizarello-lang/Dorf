// Campo de altura contínuo de UMA peça (modo Relevo). Substitui os setores planos em degraus: a altura de cada ponto sai
// das alturas-alvo das 6 bordas e do pico do meio (kernel gaussiano normalizado: encostas arredondadas, sem quinas) mais
// um ruído baixo da semente da peça, e uma correção que prende a borda ao perfil COMPARTILHADO com a vizinha.
//
// Emenda: o perfil de uma borda é função só de (altura do canto de cada ponta, altura do meio da borda), nunca da peça.
// Duas peças que concordam nesses três números têm a mesma borda, ponto a ponto, e não há fresta. Onde a vizinha já estava
// assentada, a peça nova adota o perfil dela (`he`, `co`) e a encosta desce em talude suave até a altura-alvo do interior.
//
// Sem three.js: a altura é em NÍVEIS (1 nível = LEVEL_STEP), relativa ao `own` da peça. Só o render usa isto.
import { corner, edgeMid, INR } from '../core/hex';

export interface TerrainSpec {
  /** Altura-alvo de cada borda/setor (origem) e do meio da peça, em níveis relativos ao `own`. */
  h: readonly number[];
  c: number;
  /** Perfil da emenda (origem): altura do meio de cada borda e do canto `k` (o começo da borda `k`). Iguais a `h` sem vizinha. */
  he: readonly number[];
  co: readonly number[];
  /** Peso de vila de cada setor (0 ou 1): a vila aplaina um platô pequeno em volta de si. */
  vil: readonly number[];
  seed: number;
}

export interface Terrain {
  /** Altura em níveis no ponto (x, z) da peça. */
  at(x: number, z: number): number;
  /** Módulo da inclinação (níveis por unidade do mundo): a decoração foge do que é íngreme. */
  slope(x: number, z: number): number;
}

const SIGMA = 0.72;
/** Peso do pico do meio no kernel: segura o morro, que o vizinho de borda dilui. */
const CENTER_W = 2.2;
/** Largura (da borda para dentro) em que a correção da emenda some: o talude. */
const TALUS = 0.62;
/** Amplitude do ruído (níveis) e o comprimento de onda dele no mundo. */
const NOISE_AMP = 0.16;
const NOISE_WAVE = 0.7;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function lattice(seed: number, ix: number, iz: number): number {
  let n = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

/** Ruído de valor suave em [-1, 1]. */
function vnoise(seed: number, x: number, z: number): number {
  const fx = Math.floor(x), fz = Math.floor(z);
  const u = smooth(0, 1, x - fx), v = smooth(0, 1, z - fz);
  const a = lattice(seed, fx, fz), b = lattice(seed, fx + 1, fz), c = lattice(seed, fx, fz + 1), d = lattice(seed, fx + 1, fz + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

const CORNERS = [0, 1, 2, 3, 4, 5].map((i) => corner(i));
const MIDS = [0, 1, 2, 3, 4, 5].map((i) => edgeMid(i));
/** Direção unitária do meio de cada borda (a normal para fora). */
const NORMS = MIDS.map(([x, z]) => [x / INR, z / INR] as const);

/** A peça é plana: nada a levantar (a malha fica a de sempre). */
export function isFlat(s: TerrainSpec): boolean {
  const v = s.h[0];
  return s.c === v && s.h.every((x) => x === v) && s.he.every((x) => x === v) && s.co.every((x) => x === v);
}

/** Perfil da borda `i` na fração `t` (0 no canto `i`, 1 no canto `i + 1`): parábola pelos dois cantos e pelo meio. */
function edgeProfile(s: TerrainSpec, i: number, t: number): number {
  const a = s.co[i], b = s.co[(i + 1) % 6];
  return a + (b - a) * t + (s.he[i] - (a + b) / 2) * 4 * t * (1 - t);
}

export function makeTerrain(s: TerrainSpec): Terrain {
  const nv = s.vil.reduce((p, v) => p + v, 0);
  const base = (x: number, z: number): number => {
    let sw = CENTER_W * Math.exp(-(x * x + z * z) / (SIGMA * SIGMA));
    let sv = sw * s.c;
    for (let i = 0; i < 6; i++) {
      const dx = x - MIDS[i][0], dz = z - MIDS[i][1];
      const w = Math.exp(-(dx * dx + dz * dz) / (SIGMA * SIGMA));
      sw += w;
      sv += w * s.h[i];
    }
    return sv / sw;
  };
  const centerBase = base(0, 0);
  /** Platô da vila: perto do meio, nos setores de vila, o chão puxa para o valor do centro. */
  const plateau = (x: number, z: number): number => {
    if (!nv) return 0;
    const r = Math.hypot(x, z);
    if (r < 1e-6) return 0.85;
    let wsum = 0;
    for (let i = 0; i < 6; i++) {
      const cos = (x * NORMS[i][0] + z * NORMS[i][1]) / r;
      wsum += s.vil[i] * smooth(0.2, 0.9, cos);
    }
    return Math.min(0.85, (wsum / 1.6) * 0.85) * (1 - smooth(0.5, 0.88, r));
  };
  const at = (x: number, z: number): number => {
    let b = base(x, z);
    const pl = plateau(x, z);
    if (pl > 0) b += (centerBase - b) * pl;
    // Distância às 6 retas das bordas e fração ao longo de cada uma.
    let num = 0, den = 0, dmin = Infinity;
    for (let i = 0; i < 6; i++) {
      const d = Math.max(0, INR - (x * NORMS[i][0] + z * NORMS[i][1]));
      dmin = Math.min(dmin, d);
      const w = 1 / (d * d + 1e-12);
      den += w;
      const lam = 1 - smooth(0, TALUS, d);
      if (lam <= 0) continue;
      const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
      const ex = ax + (bx - ax) * t, ez = az + (bz - az) * t;
      const r = edgeProfile(s, i, t) - base(ex, ez);
      num += w * lam * r;
    }
    const corr = num / den;
    // Ruído só no interior: a borda é o perfil da emenda, sem sobra.
    const n = vnoise(s.seed, x / NOISE_WAVE + 3.1, z / NOISE_WAVE - 1.7) * 0.7 + vnoise(s.seed ^ 0x9e37, x / (NOISE_WAVE * 0.45), z / (NOISE_WAVE * 0.45)) * 0.3;
    return b + corr + n * NOISE_AMP * smooth(0.1, 0.45, dmin) * (1 - 0.6 * pl);
  };
  const slope = (x: number, z: number): number => {
    const e = 0.04;
    const gx = (at(x + e, z) - at(x - e, z)) / (2 * e), gz = (at(x, z + e) - at(x, z - e)) / (2 * e);
    return Math.hypot(gx, gz);
  };
  return { at, slope };
}
