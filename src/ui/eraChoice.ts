// Cartas da virada de era (proposta 3 do docs/IDEIAS_AOE.md): nomes, o que cada uma faz numa
// frase e o diálogo com as duas cartas. A regra está em src/core/blessings.ts.

import { BLESSING, type BlessingId } from '../core/blessings';
import type { Theme } from '../themes/types';

const NAME: Record<BlessingId, string> = {
  lumber: 'Guilda dos carpinteiros',
  mill: 'Moleiros',
  pasture: 'Pastores',
  apiary: 'Apicultores',
  surveyors: 'Agrimensores',
  builders: 'Mestres de obras',
  pilgrims: 'Peregrinos',
  cartographers: 'Cartógrafos',
};

const ICON: Record<BlessingId, string> = {
  lumber: '🪓',
  mill: '🌾',
  pasture: '🐑',
  apiary: '🐝',
  surveyors: '📐',
  builders: '🧱',
  pilgrims: '🕯️',
  cartographers: '🧭',
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const blessingName = (id: BlessingId, theme: Theme) => theme.blessingNames?.[id] ?? NAME[id];

/** O efeito em uma frase, com os nomes das construções do tema. */
export function blessingRule(id: BlessingId, theme: Theme) {
  switch (id) {
    case 'lumber':
    case 'mill':
    case 'pasture':
    case 'apiary':
      return `Cada ${theme.synergy[id].toLowerCase()} vale +${BLESSING.synergy} pontos.`;
    case 'surveyors':
      return `Cada encaixe perfeito vale +${BLESSING.perfect} pontos.`;
    case 'builders':
      return `Cada peça cercada devolve +${BLESSING.closed} peça a mais.`;
    case 'pilgrims':
      return `Cada missão cumprida dá +${BLESSING.quest} peças a mais.`;
    case 'cartographers':
      return `Mostra as próximas peças por ${BLESSING.lookout} jogadas, e cada sítio descoberto dá +${BLESSING.site} peça.`;
  }
}

/** O diálogo com as duas cartas (teclas 1 e 2). */
export function choiceHtml(offer: readonly [BlessingId, BlessingId], eraName: string, theme: Theme) {
  const card = (id: BlessingId, i: number) => `<button class="blessing" type="button" data-act="bless" data-pick="${i}">
      <span class="blessing-icon" aria-hidden="true">${ICON[id]}</span>
      <strong>${esc(blessingName(id, theme))}</strong>
      <span>${esc(blessingRule(id, theme))}</span>
      <kbd>${i + 1}</kbd>
    </button>`;
  return `<h2>${esc(eraName)}</h2>
    <p class="muted">A vila escolhe um caminho para esta era. Vale até o fim da partida.</p>
    <div class="blessings">${offer.map(card).join('')}</div>`;
}
