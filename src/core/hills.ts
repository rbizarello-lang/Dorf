// Encostas: o relevo de cada peça como função PURA do tabuleiro (sem three.js, DOM nem Math.random). Só aparência: nada daqui
// entra em regra, pontuação, replay nem save (invariante 15).
//
// Modelo do GPT Astra (jogo-entrepostos 75f92e0, `src/core/hills.ts`), trazido para o jogo todo e sem a trava do modo dele:
//  1. A altura de cada borda sai da "massa" do terreno dela: vila e mata altas, prado e cultivo formam o sopé, rio e trilho
//     passam no fundo do vale (altura 0). O lado alto da peça sai da massa e de um viés da semente.
//  2. Divisa: onde a borda de terra casa com a vizinha do mesmo terreno, a encosta atravessa a emenda. O "rim" (a altura na
//     divisa) vem da dupla de sementes (`seed ^ seedVizinha`) e do terreno comum, então é IGUAL dos dois lados. Onde não casa
//     (ou a vizinha ainda não veio), o perfil desce ao chão: nada de saia nem de bolo.
//  3. Bancadas suaves que seguem a curva de nível (faixas de 0,16 com transição suavizada).
//  4. O mundo responde: a cada encaixe igual a borda sobe um degrau (até 3), e a peça vizinha também muda.
//
// O perfil de uma peça depende só dela e das vizinhas ASSENTADAS (o conjunto, nunca a ordem): refeito do zero a cada vez, o
// estado final é o mesmo em qualquer ordem de jogadas, no replay e no desfazer.
import type { Board } from './board';
import { DIRS, INR, opposite } from './hex';
import { tileProfile } from './relief';
import { isStrict, type TileDef } from './tiles';

/** Cotas na orientação original da peça (origem), inclusive depois que ela gira no mapa. */
export interface HillProfile {
  landform: 'Várzea' | 'Encosta' | 'Colina';
  /** Patamar da peça: o maior número de encaixes iguais de um mesmo terreno (0 a 3). */
  stage: number;
  shoulders: number[];
  rims: number[];
}

/** Normal para fora de cada borda (a borda `i` está a 30° + 60°·i). */
export const NORMAL = Array.from({ length: 6 }, (_, i) => {
  const angle = ((i + 0.5) * Math.PI) / 3;
  return [Math.cos(angle), Math.sin(angle)] as const;
});
/** Altura própria de cada terreno (índice = `T`): mata e casario têm mais massa; prado e cultivo formam o sopé; rio e trilho, o vale. */
export const MASS: readonly number[] = [0.16, 0.36, 0.25, 0.43, 0, 0];
/** Quanto o ombro de uma borda sobe a cada encaixe igual (até 3). */
export const RISE: readonly number[] = [0.085, 0.13, 0.12, 0.16, 0, 0];
/** Altura da faixa da bancada. */
export const BAND = 0.16;
/** Relevo por peça (Relevo e Terra): quanto cada nível lógico de altura da borda ergue o ombro e a divisa (só aparência). */
export const LOGIC_RISE = 0.05;

export function ease(low: number, high: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

/** A direção alta acompanha um trecho de terra. O viés da semente desempata trechos semelhantes. */
export function handHill(def: TileDef, levels?: readonly number[]): HillProfile {
  const aspect = ((def.seed >>> 0) / 0x100000000) * Math.PI * 4;
  const scale = 0.88 + (0.25 * ((def.seed >>> 8) % 251)) / 250;
  const mass = def.edges.map((t) => MASS[t]);
  let high = 0, best = -Infinity;
  for (let side = 0; side < 6; side++) {
    const score = mass[side] * 2 + mass[(side + 5) % 6] + mass[(side + 1) % 6] + 0.09 * Math.cos(aspect - (side * Math.PI) / 3);
    if (score > best) {
      best = score;
      high = side;
    }
  }
  const shoulders = mass.map((value, side) => {
    const exposure = (1 + Math.cos(((side - high) * Math.PI) / 3)) / 2;
    return value * scale * (0.65 + 0.6 * exposure);
  });
  // Relevo por peça: o nível lógico da borda (0 a 2) ergue só o ombro de terra, para a altura da regra ser legível no chão.
  if (levels) for (let i = 0; i < 6; i++) if (!isStrict(def.edges[i])) shoulders[i] += LOGIC_RISE * (levels[i] ?? 0);
  const peak = Math.max(...shoulders);
  const landform = peak < 0.24 ? 'Várzea' : def.edges.some(isStrict) ? 'Encosta' : 'Colina';
  return { landform, stage: 0, shoulders, rims: [0, 0, 0, 0, 0, 0] };
}

/** Os níveis lógicos das 6 bordas (origem) de uma peça no modo Relevo; sem o modo, nada. */
export function logicLevels(board: Board, def: TileDef): readonly number[] | undefined {
  return board.rules.relief ? tileProfile(def.edges, def.seed).h : undefined;
}

/**
 * O perfil da peça de definição `def` em (q, r) com giro `rot`, dadas as vizinhas assentadas. Serve para a peça já posta, para o
 * fantasma (a casa e o giro candidatos: a peça ainda não está no tabuleiro) e para a prévia.
 *
 * `levelOf` (opcional): nível de platô da casa (`levelAt`). Entre casas de níveis diferentes há um penhasco, então a encosta não
 * atravessa a divisa (o `rim` fica em 0 dos dois lados).
 */
export function boardHill(board: Board, q: number, r: number, def: TileDef, rot: number, levelOf?: (q: number, r: number) => number): HillProfile {
  // Relevo: os níveis lógicos de ESTA peça nesta casa (a já assentada traz os dela, a inicial inclusive; o fantasma, os do perfil dela).
  const placed = board.get(q, r);
  const world = board.rules.relief ? (placed && placed.def === def ? placed.heights : board.heightsOf(def, rot)) : undefined;
  const levels = world ? [0, 1, 2, 3, 4, 5].map((i) => world[(i + rot) % 6]) : undefined;
  const profile = handHill(def, levels);
  const matches = [0, 0, 0, 0];
  const here = levelOf?.(q, r);
  for (let i = 0; i < 6; i++) {
    const terrain = def.edges[i];
    if (isStrict(terrain)) continue;
    const worldSide = (i + rot) % 6;
    const [dq, dr] = DIRS[worldSide];
    const adjacent = board.get(q + dq, r + dr);
    if (!adjacent || adjacent.edges[opposite(worldSide)] !== terrain) continue;
    matches[terrain]++;
    if (here !== undefined && levelOf!(adjacent.q, adjacent.r) !== here) continue;
    const pair = (def.seed ^ adjacent.def.seed) >>> 0;
    let rim = (0.12 + MASS[terrain] * 0.6) * (0.9 + (0.2 * (pair % 191)) / 190);
    // No Relevo a divisa também sobe com a média dos níveis lógicos dos dois lados (simétrica: a vizinha lê os mesmos dois números).
    const nb = adjacent.heights?.[opposite(worldSide)];
    if (levels && nb !== undefined) rim += (LOGIC_RISE * (levels[i] + nb)) / 2;
    profile.rims[i] = rim;
  }
  profile.stage = Math.min(3, Math.max(...matches));
  for (let i = 0; i < 6; i++) {
    const t = def.edges[i];
    if (!isStrict(t)) profile.shoulders[i] += Math.min(3, matches[t]) * RISE[t];
  }
  return profile;
}

/** A peça não tem relevo nenhum (só rio e trilho): a malha fica a de sempre. */
export function hillFlat(p: HillProfile) {
  return p.shoulders.every((v) => v <= 0) && p.rims.every((v) => v <= 0);
}

/**
 * O centro recebe a mistura dos ombros. A aproximação da divisa converge para um único perfil transversal, com derivada nula
 * nas quinas e no encontro entre peças. (x, z) em coordenadas locais da peça, na orientação de origem.
 */
export function hillHeight(profile: HillProfile, x: number, z: number) {
  let edge = 0, projection = -Infinity, sum = 0, weights = 0;
  for (let i = 0; i < 6; i++) {
    const [nx, nz] = NORMAL[i];
    const dot = x * nx + z * nz;
    if (dot > projection) {
      projection = dot;
      edge = i;
    }
    const dx = x - 0.64 * nx, dz = z - 0.64 * nz;
    const proximity = Math.max(0, 1 - (dx * dx + dz * dz) / 1.42);
    const weight = proximity * proximity * proximity;
    sum += weight * profile.shoulders[i];
    weights += weight;
  }
  // A pequena bancada acompanha a curva de nível. Esta curva é contínua e monótona.
  const raw = sum / weights;
  const band = Math.floor(raw / BAND), phase = raw / BAND - band;
  const inner = BAND * (band + 0.38 * phase + 0.62 * ease(0.18, 0.82, phase));
  const radius = Math.max(0, projection / INR);
  const [nx, nz] = NORMAL[edge];
  // No miolo, a largura acompanha o setor triangular. Na divisa, ela fica fixa no espaço para que se possa cruzar o ombro sem
  // uma dobra entre os hexágonos.
  const breadth = radius + (1 - radius) * ease(0.8, 1, radius);
  const across = radius > 0 ? Math.abs(z * nx - x * nz) / (0.5 * breadth) : 0;
  const rim = profile.rims[edge] * (1 - ease(0.38, 0.8, across));
  const boundary = ease(0.56, 1, radius);
  return inner * (1 - boundary) + rim * boundary;
}

/** Identifica o perfil: duas peças com a mesma assinatura têm o mesmo chão (o mundo só refaz a peça quando ela muda). */
export function hillSignature(profile: HillProfile | undefined) {
  return profile ? `${profile.shoulders.map((v) => v.toFixed(4)).join(',')}/${profile.rims.map((v) => v.toFixed(4)).join(',')}` : '';
}
