// HUD da versão B: moradores e pontos, turno e régua do dia, as 3 metas e a mão de 3 peças (ícone e uma frase).
// Só lê o GameB; as ações voltam por callbacks. Sem óleo, comida, descarte nem vento: a B não tem nada disso.
import { CARD_NAMES_B, GameB, GoalIdB, RULES_B, goalLabelB } from '../core/gameB';
import { $, HudBase } from './hudBase';
import { CARD_ART_B, CARD_TONE_B, ICON } from './icons';

const CARD_FX_B = ['Sobe de nível ao lado de coisas diferentes', 'Dá variedade às casas vizinhas', 'Dá variedade às casas vizinhas', 'Acende a névoa a 2 hexágonos', 'Vira água para a casa ao lado'];
const CARD_WHERE_B = ['Terra iluminada', 'Terra iluminada', 'Terra iluminada', 'Onde há luz ou ao lado dela', 'Praia iluminada'];
const GOAL_SHORT_B = ['Solares', 'Vila grande', 'Achados', 'Ilha iluminada'];

export function dayWordB(turn: number): string {
  const p = (turn - 1) / 29;
  return p < 0.22 ? 'manhã' : p < 0.58 ? 'meio-dia' : p < 0.85 ? 'tarde' : 'entardecer';
}

export interface HudBCallbacks { onSelect(slot: number): void }

export class HudB extends HudBase {
  private lastHandKey = '';

  constructor(private cb: HudBCallbacks) {
    super();
  }

  /** Monta a régua desta versão (uma noite só, no fim) e esconde o que a B não tem. */
  activate(): void {
    const ruler = $('ruler'), marks = $('marks');
    ruler.innerHTML = ''; marks.innerHTML = '';
    this.lastHandKey = '';
    for (let n = 1; n <= RULES_B.turns; n++) {
      const i = document.createElement('i');
      if (n === RULES_B.turns) i.className = 'night';
      ruler.appendChild(i);
    }
    const m = document.createElement('span');
    m.className = 'm'; m.style.left = ((RULES_B.turns - 0.5) / RULES_B.turns) * 100 + '%';
    m.innerHTML = `${ICON.moon}${RULES_B.turns}`;
    m.title = 'A noite cai ao fim da última peça';
    marks.appendChild(m);
  }

  render(g: GameB, selected: number): void {
    const turn = Math.min(g.turn, RULES_B.turns);
    const s = g.summary();
    $('res').innerHTML =
      `<div class="pop" aria-label="Moradores"><b>${s.residents}</b><span>${ICON.people}moradores</span><span class="score">${ICON.star}${s.score} pontos</span></div>`;
    const ticks = $('ruler').children;
    for (let i = 0; i < ticks.length; i++) {
      ticks[i].classList.toggle('past', i + 1 < g.turn || g.over);
      ticks[i].classList.toggle('now', i + 1 === turn && !g.over);
    }
    $('sun').style.left = ((turn - 0.5) / RULES_B.turns) * 100 + '%';
    $('sun').innerHTML = g.over ? ICON.moon : ICON.sun;
    $('turnTxt').textContent = g.over ? 'Fim da partida' : `Peça ${turn} de ${RULES_B.turns}`;
    $('dayTxt').textContent = g.over ? 'noite' : dayWordB(g.turn);
    $('need').textContent = g.over ? '' : g.turnsLeft <= 3 ? 'A noite está chegando: depois da última peça, a ilha se acende.' : 'Ao fim das 30 peças cai a noite e a ilha se acende. Sem derrota.';
    // metas
    $('goals').innerHTML = `<h3>Metas <span>+${RULES_B.goalPoints} pontos cada</span></h3><ul>` + g.goals.map((id) => {
      const done = g.goalMet(id);
      const prog = Math.round(g.goalProgress(id) * 100);
      let nu = '';
      if (id === GoalIdB.Manor) nu = `${g.manors()}/${RULES_B.manorGoal}`;
      else if (id === GoalIdB.Plaza) nu = `${g.biggestVillage()}/${RULES_B.plazaGoal} casas`;
      else if (id === GoalIdB.Finds) nu = `${g.foundCount}/${RULES_B.findsGoal}`;
      else nu = `${Math.round(g.litFraction() * 100)}%`;
      return `<li class="${done ? 'done' : ''}" title="${goalLabelB(id)}"><span class="box">${ICON.check}</span><span class="nm">${GOAL_SHORT_B[id]}</span><span class="nu">${nu}</span><span class="bar"><i style="width:${prog}%"></i></span></li>`;
    }).join('') + '</ul>';
    this.renderHand(g, selected);
    // A B não tem descarte nem vento.
    $('discard').style.display = 'none';
    $('wind').style.display = 'none';
  }

  private renderHand(g: GameB, selected: number): void {
    const hand = $('hand'), cards = hand.querySelectorAll<HTMLElement>('.card');
    const key = g.hand.join(',') + '|' + g.turn + '|' + g.seed;
    const fresh = key !== this.lastHandKey;
    this.lastHandKey = key;
    if (g.over) { cards.forEach((c) => c.remove()); return; }
    if (fresh || cards.length !== g.hand.length) {
      cards.forEach((c) => c.remove());
      g.hand.forEach((c, slot) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'card' + (fresh && !this.reduced ? ' deal' : '');
        b.style.setProperty('--tone', CARD_TONE_B[c]);
        b.style.setProperty('--r', (slot - 1) * 3 + 'deg');
        b.style.animationDelay = slot * 70 + 'ms';
        b.innerHTML = `<span class="art">${CARD_ART_B[c]}<span class="key">${slot + 1}</span></span><span class="body"><span class="nm">${CARD_NAMES_B[c]}</span><span class="fx">${CARD_FX_B[c]}</span><span class="where">${CARD_WHERE_B[c]}</span><span class="why"></span></span>`;
        b.addEventListener('click', () => this.cb.onSelect(slot));
        hand.insertBefore(b, $('discard'));
      });
    }
    hand.querySelectorAll<HTMLElement>('.card').forEach((el, slot) => {
      const c = g.hand[slot], ok = g.playable(c);
      el.classList.toggle('sel', slot === selected);
      el.classList.toggle('off', !ok);
      el.setAttribute('aria-pressed', String(slot === selected));
      el.setAttribute('aria-label', `${CARD_NAMES_B[c]}. ${CARD_FX_B[c]}. ${CARD_WHERE_B[c]}.${ok ? '' : ' Sem lugar agora.'} Tecla ${slot + 1}.`);
      (el.querySelector('.why') as HTMLElement).textContent = ok ? '' : 'Sem lugar agora';
    });
  }

  showEnd(g: GameB, delay = 0): void {
    const s = g.summary();
    const goals = s.goals.map((id, k) => `<li class="${s.goalsMet[k] ? 'ok' : 'no'}"><span class="mk">${ICON.check}</span>${goalLabelB(id)}</li>`).join('');
    $('endBody').innerHTML =
      `<div class="big">${s.score}<small>pontos</small></div>` +
      `<ul>${goals}</ul>` +
      `<div class="row"><span>${s.residents} moradores</span><span>${s.goalsMet.filter(Boolean).length} × ${RULES_B.goalPoints} das metas</span></div>` +
      `<div class="row" style="border:0;padding-top:2px"><span>Ilha iluminada</span><span>${Math.round(s.litPct * 100)}%</span></div>`;
    window.setTimeout(() => { $('end').classList.add('on'); ($('again') as HTMLButtonElement).focus({ preventScroll: true }); }, delay);
  }
}
