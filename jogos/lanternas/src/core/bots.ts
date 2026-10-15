// Jogadores simulados: aleatório, guloso e planejador. Determinísticos (só usam o Rng recebido).
import { Action, Game, GoalId, RULES } from './game';
import { CENTER, N, dist } from './hex';
import { Terrain } from './map';
import { Rng } from './rng';

export type BotId = 'aleatorio' | 'guloso' | 'planejador';
export const BOTS: BotId[] = ['aleatorio', 'guloso', 'planejador'];

export interface Decision {
  action: Action;
  /** Melhor valor de cada carta distinta jogável (para medir "escolha apertada"). */
  cardValues: number[];
}

/** Pesos do planejador (ajustados com o simulador; ver docs/simulacao.md). */
export const W = {
  stock: 0.25, greedyLight: 0.15,       // cada recurso em estoque (guloso: linear)
  income: 0.35,      // cada unidade de renda por turno restante (guloso)
  // planejador
  foodStock: 1.0, oilStock: 0.8, stockCap: 4,
  foodInc: 1.3, oilInc: 1.0, incHorizon: 0.16,
  litLand: 0.25, findBonus: 1.2,
  goalShape: 3.0,
  nightLoss: 1.1,
  tipClose: 2.0,
  oilForLantern: 1.0,
  farLight: 0.5,
  upkeep: 1.0,
  satur: 0.9,
  houseRate: 0.3, ratioLo: 0.8, ratioHi: 1.2, foodExtra: 0.1,   // renda de comida a mais que a demanda estimada vale pouco
  feast: 0.9,          // cada morador que a festa da próxima noite promete
};

/** Potencial do guloso: pontos de agora + recursos e renda simples. */
function phiGreedy(g: Game): number {
  return g.score() + W.greedyLight * g.litLand + W.stock * (g.food + g.oil) + W.income * (g.foodIncome() + g.oilIncome()) * Math.min(g.turnsLeft, 10) / 5;
}

/** Potencial do planejador: guloso refinado + luz, metas, noite e óleo para a próxima lanterna. */
function phiPlanner(g: Game): number {
  const tl = g.turnsLeft;
  const hor = Math.min(tl, 14) * W.incHorizon;
  let v = g.residents();
  // Metas: ponto cheio ao cumprir e parte proporcional ao progresso enquanto não cumpre.
  for (const goal of g.goals) {
    const p = g.goalProgress(goal);
    v += p >= 1 ? RULES.goalPoints : W.goalShape * p * p;
    if (goal === GoalId.Tip) v += W.tipClose * (6 - Math.min(6, g.tipDistance())) / 2;
  }
  const cap = W.stockCap;
  v += W.foodStock * Math.min(g.food, cap) * 0.5 + W.oilStock * Math.min(g.oil, cap) * 0.5;
  // Renda vale menos quando o estoque já cobre o que se vai gastar (senão o bot enche campos à toa).
  // Comida que não tem como virar morador (casas e festa) não vale renda: com o estoque projetado acima da demanda estimada, a renda quase não conta.
  // A demanda usa só o que é público: ~W.houseRate casas por turno restante a RULES.houseCostFood cada e o teto da festa nas noites que faltam.
  const festaNight = Math.min(RULES.feastCap, (g.houses.length + W.houseRate * tl * 0.5) * RULES.feastExtra) * RULES.feastFood;
  const demand = W.houseRate * tl * RULES.houseCostFood + g.nightsLeft * festaNight;
  const ratio = (g.food + g.foodIncome() * tl) / Math.max(1, demand);
  const foodSat = g.food >= 2 * RULES.houseCostFood ? W.satur : ratio <= W.ratioLo ? 1 : ratio >= W.ratioHi ? W.foodExtra : 1 - (1 - W.foodExtra) * (ratio - W.ratioLo) / (W.ratioHi - W.ratioLo);
  const oilSat = g.oil >= RULES.lanternCostOil + g.nightUpkeep() ? W.satur : 1;
  v += W.foodInc * g.foodIncome() * hor * foodSat + W.oilInc * g.oilIncome() * hor * oilSat;
  v += W.litLand * g.litLand;
  // Regra pública: os achados ficam longe do centro (distância >= 4). Luz nessa faixa vale a busca.
  let far = 0;
  for (let i = 0; i < N; i++) if (g.revealed[i] && g.map.terrain[i] !== Terrain.Water && dist(i, CENTER) >= 4) far++;
  v += W.farLight * far;
  // Casas expostas à noite (sem lanterna encostada) perdem moradores nas noites que restam.
  const nl = g.nightsLeft;
  if (nl > 0) {
    let exposed = 0;
    for (const h of g.houses) if (!g.houseLit(h)) exposed += Math.min(1, g.houseResidents(h));
    v -= W.nightLoss * exposed * nl;
  }
  // Óleo para as lanternas queimarem na próxima noite (as que apagam deixam as casas no escuro).
  if (nl > 0 && g.houses.length) {
    const nextNight = RULES.nights.find((n) => n >= g.turn)!;
    const projected = g.oil + g.oilIncome() * (nextNight - g.turn + 1);
    v -= W.upkeep * Math.max(0, g.nightUpkeep() - projected);
  }
  // Festa da noite: a comida guardada vira moradores (até o teto) e o resto do estoque se perde.
  if (nl > 0) v += W.feast * g.feastGain();
  // Ter óleo à mão vale: abre a chance de acender mais uma lanterna.
  if (tl > 3 && g.oil >= RULES.lanternCostOil) v += W.oilForLantern;
  return v;
}

const phi = (bot: BotId, g: Game): number => (bot === 'planejador' ? phiPlanner(g) : phiGreedy(g));

export function decide(bot: BotId, real: Game, rng: Rng): Decision {
  const hand = real.hand;
  if (bot === 'aleatorio') {
    const options: Array<{ slot: number; cells: number[] }> = [];
    hand.forEach((c, slot) => { const cells = real.placements(c); if (cells.length) options.push({ slot, cells }); });
    if (!options.length) return { action: { kind: 'discard', slot: Math.floor(rng() * hand.length) }, cardValues: [] };
    const o = options[Math.floor(rng() * options.length)];
    return { action: { kind: 'play', slot: o.slot, idx: o.cells[Math.floor(rng() * o.cells.length)] }, cardValues: [] };
  }
  // Os bots só decidem com o que o jogador vê: a cópia cega esconde os achados da névoa.
  const game = real.clone(true);
  const base = phi(bot, game);
  // Melhor jogada de cada carta distinta.
  const best = new Map<number, { v: number; slot: number; idx: number }>();
  hand.forEach((card, slot) => {
    for (const idx of game.placements(card)) {
      const g2 = game.clone();
      g2.place(card, idx);
      const v = phi(bot, g2) - base;
      const cur = best.get(card);
      if (!cur || v > cur.v) best.set(card, { v, slot, idx });
    }
  });
  // Descartar: +1 óleo; sai a carta de menor valor (as sem lugar primeiro).
  const g3 = game.clone();
  g3.oil += RULES.discardOil;
  const discardValue = phi(bot, g3) - base;
  let discardSlot = 0, worst = Infinity;
  hand.forEach((card, slot) => { const b = best.get(card); const v = b ? b.v : -Infinity; if (v < worst) { worst = v; discardSlot = slot; } });
  const entries = [...best.values()].sort((a, b) => b.v - a.v);
  const cardValues = entries.map((e) => e.v);
  if (!entries.length || entries[0].v < discardValue) return { action: { kind: 'discard', slot: discardSlot }, cardValues };
  return { action: { kind: 'play', slot: entries[0].slot, idx: entries[0].idx }, cardValues };
}
