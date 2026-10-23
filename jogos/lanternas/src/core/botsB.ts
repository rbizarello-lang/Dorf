// Jogadores simulados da versão B: aleatório, guloso e planejador. Determinísticos (só usam o Rng recebido).
// Mesma ideia da A: decidem numa cópia "cega" do jogo (sem espiar a névoa).
import { ActionB, GameB, RULES_B } from './gameB';
import { CENTER, N, dist } from './hex';
import { Terrain } from './map';
import { Rng } from './rng';

export type BotIdB = 'aleatorio' | 'guloso' | 'planejador';
export const BOTS_B: BotIdB[] = ['aleatorio', 'guloso', 'planejador'];

export interface DecisionB { action: ActionB; cardValues: number[] }

/** Pesos do planejador da B (ajustados com o simulador; ver docs/simulacao.md). */
export const WB = {
  greedyLight: 0.15,
  litLand: 0.25, findBonus: 1.2, farLight: 0.5,
  goalShape: 3.0,
  /** Valor dos melhores lugares ainda livres para uma casa (o que Campo, Bosque e Lanterna preparam). */
  slotTop: 3, slot: 0.35,
};

/** O que já estava à vista no começo da decisão (o planejador só valoriza luz sobre névoa de verdade). */
let seen0: Uint8Array = new Uint8Array(N);

function phiGreedy(g: GameB): number { return g.score() + WB.greedyLight * g.litLand; }

function phiPlanner(g: GameB): number {
  let v = g.residents();
  for (const goal of g.goals) {
    const p = g.goalProgress(goal);
    v += p >= 1 ? RULES_B.goalPoints : WB.goalShape * p * p;
  }
  v += WB.litLand * g.litLand + WB.findBonus * g.foundCount;
  // Os achados ficam longe do centro (regra pública: distância >= 4): luz nessa faixa vale a busca.
  let far = 0;
  for (let i = 0; i < N; i++) if (g.lit[i] && !seen0[i] && g.map.terrain[i] !== Terrain.Water && dist(i, CENTER) >= 4) far++;
  v += WB.farLight * far;
  // Lugares livres para casas: os melhores valem pelo nível que a casa teria ali.
  if (g.turnsLeft > 2) {
    const top: number[] = [];
    for (let i = 0; i < N; i++) {
      if (!g.lit[i] || g.struct[i] !== 0 || g.map.terrain[i] === Terrain.Water || g.map.finds[i]) continue;
      const l = g.levelAt(i);
      if (top.length < WB.slotTop) { top.push(l); top.sort((a, b) => a - b); } else if (l > top[0]) { top[0] = l; top.sort((a, b) => a - b); }
    }
    for (const l of top) v += WB.slot * l;
  }
  return v;
}

export const phiB = (bot: BotIdB, g: GameB): number => (bot === 'planejador' ? phiPlanner(g) : phiGreedy(g));

/** Valor de uma jogada para o regret da simulação: pega o que já estava à vista antes da jogada. */
export function phiWith(bot: BotIdB, g: GameB, seenBefore: Uint8Array): number { seen0 = seenBefore; return phiB(bot, g); }

export function decideB(bot: BotIdB, real: GameB, rng: Rng): DecisionB {
  const hand = real.hand;
  if (bot === 'aleatorio') {
    const options: Array<{ slot: number; cells: number[] }> = [];
    hand.forEach((c, slot) => { const cells = real.placements(c); if (cells.length) options.push({ slot, cells }); });
    const o = options[Math.floor(rng() * options.length)];
    return { action: { slot: o.slot, idx: o.cells[Math.floor(rng() * o.cells.length)] }, cardValues: [] };
  }
  const game = real.clone(true);
  seen0 = real.lit;
  const base = phiB(bot, game);
  const best = new Map<number, { v: number; slot: number; idx: number }>();
  hand.forEach((card, slot) => {
    for (const idx of real.placements(card)) {
      const g2 = game.clone();
      g2.place(card, idx);
      const v = phiB(bot, g2) - base;
      const cur = best.get(card);
      if (!cur || v > cur.v) best.set(card, { v, slot, idx });
    }
  });
  const entries = [...best.values()].sort((a, b) => b.v - a.v);
  return { action: { slot: entries[0].slot, idx: entries[0].idx }, cardValues: entries.map((e) => e.v) };
}
