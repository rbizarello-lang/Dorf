import { mulberry32 } from './rng';
import type { SynKind } from './synergy';

// Escolha na virada de era (proposta 3 do docs/IDEIAS_AOE.md): a cada era nova a vila
// escolhe 1 de 2 cartas, e o efeito vale até o fim da partida. As opções vêm da semente
// e das cartas já escolhidas, então o replay oferece sempre as mesmas.

export type BlessingId = 'lumber' | 'mill' | 'pasture' | 'apiary' | 'surveyors' | 'builders' | 'pilgrims' | 'cartographers';

export const BLESSING_IDS: readonly BlessingId[] = ['lumber', 'mill', 'pasture', 'apiary', 'surveyors', 'builders', 'pilgrims', 'cartographers'];

/** Os números de cada carta (o oráculo dos testes reimplementa os efeitos com os mesmos valores). */
export const BLESSING = {
  /** Pontos a mais por interação do tipo da carta (serraria, moinho, pasto, colmeias). */
  synergy: 5,
  /** Agrimensores: pontos a mais por encaixe perfeito. */
  perfect: 10,
  /** Mestres de obras: peças a mais por peça cercada. */
  closed: 1,
  /** Peregrinos: peças a mais por missão cumprida. */
  quest: 2,
  /** Cartógrafos: jogadas com as próximas peças à vista, e peças a mais por sítio descoberto. */
  lookout: 10,
  site: 1,
} as const;

/** Cartas que somam pontos a uma interação. */
export const SYN_BLESSING: Record<SynKind, BlessingId> = { lumber: 'lumber', mill: 'mill', pasture: 'pasture', apiary: 'apiary' };

/** As 2 cartas oferecidas na era `era`, sem as já escolhidas. */
export function blessingOffer(seed: number, era: number, taken: readonly BlessingId[]): [BlessingId, BlessingId] {
  const rng = mulberry32((seed ^ Math.imul(era, 0x9e3779b1)) >>> 0);
  const pool = BLESSING_IDS.filter((b) => !taken.includes(b));
  const a = pool.splice(Math.floor(rng() * pool.length), 1)[0];
  const b = pool[Math.floor(rng() * pool.length)];
  return [a, b];
}
