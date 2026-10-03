import { mulberry32, type Rng } from './rng';
import { T, type TileDef } from './tiles';

// Peças especiais, como no Dorfromantik: liberadas entre partidas (o progresso fica no
// navegador, não aqui) e, uma vez liberadas, entram na pilha das partidas seguintes. Cada
// uma rende pontos pelo terreno à volta quando é colocada. As posições na pilha saem da
// semente por um gerador à parte: a mesma semente com as mesmas peças liberadas dá a mesma
// sequência para qualquer jogador.

export type SpecialKind = 'station' | 'watermill' | 'lighthouse';
/** Ordem de liberação (e de sorteio das posições). */
export const SPECIAL_KINDS: readonly SpecialKind[] = ['station', 'watermill', 'lighthouse'];

export interface SpecialSpec {
  /** Bordas na orientação de origem (a peça é sempre a mesma; só a decoração varia). */
  edges: readonly T[];
  /** Conta as peças a até `radius` hexágonos que tenham ao menos uma borda deste terreno. */
  terrain: T;
  radius: number;
  /** Pontos por peça contada. */
  per: number;
  /** Peças que entram na pilha ao colocar. */
  tiles: number;
  /** Jogadas em que as próximas peças ficam à vista (o farol enxerga longe). */
  lookout: number;
}

export const SPECIALS: Record<SpecialKind, SpecialSpec> = {
  // Estação: trilho atravessando, vila de um lado; vale pelos trilhos por perto.
  station: { edges: [T.Rail, T.Village, T.Village, T.Rail, T.Field, T.Grass], terrain: T.Rail, radius: 2, per: 12, tiles: 2, lookout: 0 },
  // Moinho d'água: rio atravessando, vila e plantação nas margens; vale pelas plantações vizinhas.
  watermill: { edges: [T.Water, T.Village, T.Field, T.Water, T.Field, T.Field], terrain: T.Field, radius: 1, per: 20, tiles: 1, lookout: 0 },
  // Farol: lago no meio de um prado (rio de uma borda só); vale pelos rios por perto e mostra as próximas peças.
  lighthouse: { edges: [T.Water, T.Grass, T.Grass, T.Forest, T.Grass, T.Grass], terrain: T.Water, radius: 2, per: 10, tiles: 0, lookout: 5 },
};

/** Primeira aparição de cada peça liberada e o intervalo até a segunda. */
const FIRST = 10;
const STEP = 13;
const AGAIN = 34;

/**
 * Índices da pilha (contando a partir de 1, como `Game.draw`) em que cada peça especial
 * liberada aparece: duas vezes por partida, sem coincidir.
 */
export function specialSlots(seed: number, kinds: readonly SpecialKind[]): Map<number, SpecialKind> {
  const rng = mulberry32((seed ^ 0x5bec1a15) >>> 0);
  const out = new Map<number, SpecialKind>();
  let k = 0;
  for (const kind of SPECIAL_KINDS) {
    if (!kinds.includes(kind)) continue;
    let at = FIRST + STEP * k++ + Math.floor(rng() * 6);
    for (let n = 0; n < 2; n++, at += AGAIN) {
      while (out.has(at)) at++;
      out.set(at, kind);
    }
  }
  return out;
}

/** Peça especial: bordas fixas, decoração da semente da peça, sem missão. */
export function specialTile(rng: Rng, kind: SpecialKind): TileDef {
  return { edges: [...SPECIALS[kind].edges], seed: Math.floor(rng() * 2 ** 31), quest: null, special: kind };
}
