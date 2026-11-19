import type { Board } from './board';
import { DIRS, INR, opposite } from './hex';
import { RIDGE_LOTS } from './ridge';
import { isStrict, type TileDef } from './tiles';

/** Cotas na orientação original da peça, inclusive depois que ela gira no mapa. */
export interface HillProfile {
  landform: 'Várzea' | 'Encosta' | 'Colina';
  stage: number;
  shoulders: number[];
  rims: number[];
  harbor: boolean;
}

const NORMAL = Array.from({ length: 6 }, (_, i) => {
  const angle = (i + .5) * Math.PI / 3;
  return [Math.cos(angle), Math.sin(angle)] as const;
});
// As bordas de mata e casario têm mais massa. Prado e cultivo formam o sopé.
const MASS = [.16, .36, .25, .43, 0, 0];
const RISE = [.085, .13, .12, .16, 0, 0];

function ease(low: number, high: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

/** A direção alta acompanha um trecho de terra. O viés da semente desempata trechos semelhantes. */
export function handHill(def: TileDef): HillProfile {
  const aspect = (def.seed >>> 0) / 0x100000000 * Math.PI * 4;
  const scale = .88 + .25 * ((def.seed >>> 8) % 251) / 250;
  const mass = def.edges.map(t => MASS[t]);
  let high = 0, best = -Infinity;
  for (let side = 0; side < 6; side++) {
    const score = mass[side] * 2 + mass[(side + 5) % 6] + mass[(side + 1) % 6]
      + .09 * Math.cos(aspect - side * Math.PI / 3);
    if (score > best) { best = score; high = side; }
  }
  const shoulders = mass.map((value, side) => {
    const exposure = (1 + Math.cos((side - high) * Math.PI / 3)) / 2;
    return value * scale * (.65 + .6 * exposure);
  });
  const peak = Math.max(...shoulders);
  const landform = peak < .24 ? 'Várzea' : def.edges.some(isStrict) ? 'Encosta' : 'Colina';
  return { landform, stage: 0, shoulders, rims: [0, 0, 0, 0, 0, 0], harbor: false };
}

function historicLot(q: number, r: number) {
  return (q === 0 && r === 0) || RIDGE_LOTS.some(lot => lot.q === q && lot.r === r);
}

/** As duas faces de uma divisa nascem da mesma dupla de sementes e do terreno em comum.
 * Nas divisas da aldeia inicial, o sopé chega a zero e encontra o pé da escarpa já modelada. */
export function boardHill(board: Board, q: number, r: number, def: TileDef, rot: number): HillProfile | undefined {
  if (!board.rules.riverTrade || board.rules.layout !== 'crista' || historicLot(q, r)) return undefined;
  const profile = handHill(def);
  const matches = [0, 0, 0, 0];
  for (let i = 0; i < 6; i++) {
    const terrain = def.edges[i];
    if (isStrict(terrain)) continue;
    const worldSide = (i + rot) % 6;
    const [dq, dr] = DIRS[worldSide];
    const adjacent = board.get(q + dq, r + dr);
    if (adjacent?.edges[opposite(worldSide)] !== terrain) continue;
    matches[terrain]++;
    if (!historicLot(adjacent.q, adjacent.r)) {
      const pair = (def.seed ^ adjacent.def.seed) >>> 0;
      profile.rims[i] = (.12 + MASS[terrain] * .6) * (.90 + .2 * (pair % 191) / 190);
    }
  }
  profile.stage = Math.min(3, Math.max(...matches));
  for (let i = 0; i < 6; i++) {
    const t = def.edges[i];
    if (!isStrict(t)) profile.shoulders[i] += Math.min(3, matches[t]) * RISE[t];
  }
  profile.harbor = board.ports.some(p => p.q === q && p.r === r);
  return profile;
}

/** O centro recebe a mistura dos ombros. A aproximação da divisa converge para um
 * único perfil transversal, com derivada nula nas quinas e no encontro entre peças. */
export function hillHeight(profile: HillProfile, x: number, z: number) {
  let edge = 0, projection = -Infinity, sum = 0, weights = 0;
  for (let i = 0; i < 6; i++) {
    const [nx, nz] = NORMAL[i];
    const dot = x * nx + z * nz;
    if (dot > projection) { projection = dot; edge = i; }
    const dx = x - .64 * nx, dz = z - .64 * nz;
    const proximity = Math.max(0, 1 - (dx * dx + dz * dz) / 1.42);
    const weight = proximity * proximity * proximity;
    sum += weight * profile.shoulders[i];
    weights += weight;
  }
  // A pequena bancada acompanha a curva de nível. Esta curva é contínua e monótona.
  const raw = sum / weights;
  const band = Math.floor(raw / .16), phase = raw / .16 - band;
  const inner = .16 * (band + .38 * phase + .62 * ease(.18, .82, phase));
  const radius = Math.max(0, projection / INR);
  const [nx, nz] = NORMAL[edge];
  // No miolo, a largura acompanha o setor triangular. Na divisa, ela fica fixa
  // no espaço para que se possa cruzar o ombro sem uma dobra entre os hexágonos.
  const breadth = radius + (1 - radius) * ease(.8, 1, radius);
  const across = radius > 0 ? Math.abs(z * nx - x * nz) / (.5 * breadth) : 0;
  const rim = profile.rims[edge] * (1 - ease(.38, .80, across));
  const boundary = ease(.56, 1, radius);
  const height = inner * (1 - boundary) + rim * boundary;
  // Os armazéns e pontões ocupam a planície central junto ao rio.
  return profile.harbor ? height * ease(.65, .86, Math.hypot(x, z)) : height;
}

export function hillSignature(profile: HillProfile | undefined) {
  return profile ? `${+profile.harbor}/${profile.shoulders.join(',')}/${profile.rims.join(',')}` : '';
}
