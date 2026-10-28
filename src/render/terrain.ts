// Campo de altura contínuo de UMA peça (modo Relevo). Substitui os setores planos em degraus: a altura de cada ponto sai
// das alturas-alvo das 6 bordas e do pico do meio (kernel gaussiano normalizado: encostas arredondadas, sem quinas) mais
// um ruído baixo da semente da peça, e uma correção que prende a borda ao perfil COMPARTILHADO com a vizinha.
//
// Emenda: o perfil de uma borda é função só de (altura do canto de cada ponta, altura do meio da borda), nunca da peça.
// Duas peças que concordam nesses três números têm a mesma borda, ponto a ponto, e não há fresta. Onde a vizinha já estava
// assentada, a peça nova adota o perfil dela (`he`, `co`) e a encosta desce em talude suave até a altura-alvo do interior.
//
// Borda virada para o vazio: a peça não termina num paredão. Ela ganha uma SAIA, uma encosta arredondada que desce da altura da
// borda até o chão comum, do lado de fora, na casa vizinha (`skirtDrop`). A peça que chegar depois nessa casa já nasce sabendo
// da saia (`env`): o chão dela nunca passa abaixo dela, então a saia some embaixo e nada fura o chão novo. Os dois lados usam a
// mesma função, que só depende do perfil da borda compartilhada.
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
  /** Nível do chão local (a origem da peça no mundo): as saias são medidas em níveis do mundo. */
  own?: number;
  /**
   * Onde a peça está no mundo (centro, giro e semente da partida): o relevo miúdo (o ondulado) é um ruído do MUNDO, não da peça,
   * então duas peças vizinhas leem o mesmo valor na divisa e o terreno é contínuo por cima das emendas, sem pontos de costura.
   * Sem isto (testes), não há ondulado.
   */
  world?: { x: number; z: number; rot: number; seed: number };
  /** Bordas (origem) em que a vizinha já assentada tem uma saia dentro desta peça (terra com terra, a vizinha veio antes). */
  env?: readonly boolean[];
}

export interface Terrain {
  /** Altura em níveis no ponto (x, z) da peça; `k` (0 a 1) atenua o relevo, mas a saia da vizinha não some (a peça de rio segura as margens). */
  at(x: number, z: number, k?: number): number;
  /** Módulo da inclinação (níveis por unidade do mundo): a decoração foge do que é íngreme. */
  slope(x: number, z: number): number;
}

/** Saia (borda sobre o vazio): onde ela acaba (níveis abaixo do chão comum, o 0), largura por nível de altura da borda e largura máxima. */
export const SKIRT_END = 0.3;
const SKIRT_K = 0.5;
const SKIRT_MAX = 0.95;
/** Largura da saia numa borda de altura `hb` (níveis do mundo): zero no chão comum, e o paredão da ilha continua sendo a espessura dela. */
export const skirtWidth = (hb: number) => Math.min(SKIRT_MAX, SKIRT_K * Math.max(0, hb));
/**
 * Quanto a saia desce da altura da borda (`hb`, níveis do mundo) a `rho` de distância dela: de 0 até `hb + SKIRT_END`. A curva é
 * a de um morro (parte plana e vai ficando mais íngreme até o pé, onde a rocha aparece), não a de uma rampa.
 */
export function skirtDrop(hb: number, rho: number): number {
  const w = skirtWidth(hb);
  const total = Math.max(0, hb) + SKIRT_END;
  if (rho <= 0) return 0;
  if (w < 1e-6 || rho >= w) return total;
  const t = rho / w;
  return total * t * t;
}

const SIGMA = 0.72;
/** Peso do pico do meio no kernel: segura o morro, que o vizinho de borda dilui. */
const CENTER_W = 2.2;
/** Largura (da borda para dentro) em que a correção da emenda some: o talude. */
const TALUS = 0.85;
/** O ondulado do mundo: amplitude (níveis) e as três oitavas (peso, comprimento de onda em unidades do mundo). */
const SWELL_AMP = 0.95;
const SWELL: ReadonlyArray<readonly [number, number]> = [[0.7, 3.6], [0.25, 1.6], [0.05, 0.8]];

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

/** A peça é plana: nada a levantar (a malha fica a de sempre). Com o ondulado do mundo ligado nenhuma é: a divisa tem de casar com a vizinha. */
export function isFlat(s: TerrainSpec): boolean {
  if (s.world) return false;
  const v = s.h[0];
  return s.c === v && s.h.every((x) => x === v) && s.he.every((x) => x === v) && s.co.every((x) => x === v);
}

/** Perfil da borda `i` na fração `t` (0 no canto `i`, 1 no canto `i + 1`): parábola pelos dois cantos e pelo meio. */
export function edgeProfile(s: TerrainSpec, i: number, t: number): number {
  const a = s.co[i], b = s.co[(i + 1) % 6];
  return a + (b - a) * t + (s.he[i] - (a + b) / 2) * 4 * t * (1 - t);
}

/** O ponto da borda `i` (origem) mais perto de (x, z): a fração `t` ao longo dela e a distância. */
export function nearestOnEdge(i: number, x: number, z: number): { t: number; rho: number } {
  const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return { t, rho: Math.hypot(x - (ax + dx * t), z - (az + dz * t)) };
}

/** Ondulado do mundo (níveis) no ponto (X, Z): colinas largas com um pouco de textura, contínuas entre as peças. */
export function swellAt(seed: number, X: number, Z: number): number {
  let v = 0;
  for (let k = 0; k < SWELL.length; k++) v += SWELL[k][0] * vnoise((seed ^ Math.imul(k + 1, 0x9e3779b1)) | 0, X / SWELL[k][1] + 3.1 * k, Z / SWELL[k][1] - 1.7 * k);
  // Os vales são mais rasos que os morros são altos: o chão de nível 0 nunca afunda perto da água do mar nem dos rios.
  v *= SWELL_AMP;
  return v >= 0 ? v : v * 0.4;
}

export function makeTerrain(s: TerrainSpec): Terrain {
  const own = s.own ?? 0;
  const wd = s.world;
  /** Ondulado no ponto local (x, z): o ponto vai para o mundo pelo giro da peça. */
  const swell = (x: number, z: number): number => {
    if (!wd) return 0;
    const th = (-wd.rot * Math.PI) / 3, c = Math.cos(th), sn = Math.sin(th);
    return swellAt(wd.seed, wd.x + x * c + z * sn, wd.z - x * sn + z * c);
  };
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
  /** Chão mínimo imposto pelas saias das vizinhas que vieram antes (níveis relativos a `own`; -Infinity sem nenhuma). */
  const env = (x: number, z: number): number => {
    let m = -Infinity;
    for (let i = 0; i < 6; i++) {
      if (!s.env?.[i]) continue;
      const { t, rho } = nearestOnEdge(i, x, z);
      if (rho > SKIRT_MAX) continue;
      const hb = own + edgeProfile(s, i, t);
      const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
      m = Math.max(m, hb + swell(ax + (bx - ax) * t, az + (bz - az) * t) - skirtDrop(hb, rho) - own);
    }
    return m;
  };
  const soft = (x: number, z: number): number => {
    let b = base(x, z);
    const pl = plateau(x, z);
    if (pl > 0) b += (centerBase - b) * pl;
    // Distância às 6 retas das bordas e fração ao longo de cada uma.
    let num = 0, den = 0;
    for (let i = 0; i < 6; i++) {
      const d = Math.max(0, INR - (x * NORMS[i][0] + z * NORMS[i][1]));
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
    // O ondulado é do mundo (a vizinha lê o mesmo valor na divisa); a vila o aplaina.
    return b + corr + swell(x, z) * (1 - 0.6 * pl);
  };
  const hasEnv = !!s.env?.some(Boolean);
  const at = (x: number, z: number, k = 1): number => (hasEnv ? Math.max(soft(x, z) * k, env(x, z)) : soft(x, z) * k);
  const slope = (x: number, z: number): number => {
    const e = 0.04;
    const gx = (at(x + e, z) - at(x - e, z)) / (2 * e), gz = (at(x, z + e) - at(x, z - e)) / (2 * e);
    return Math.hypot(gx, gz);
  };
  return { at, slope };
}
