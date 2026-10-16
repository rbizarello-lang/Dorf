// HUD em HTML/CSS: recursos e moradores, régua do dia, metas, mão de cartas e tela de fim.
// Só lê o Game; as ações voltam por callbacks.
import { CARD_NAMES, Card, GOAL_TITLES, Game, RULES, WIND_RULE, cardRule, goalLabel } from '../core/game';
import { CARD_ART, CARD_TONE, ICON } from './icons';
import { $, HudBase } from './hudBase';

const CARD_FX = ['1 a 4, até 8 com festa', '+1 comida por turno', '+1 óleo por turno', 'Acende luz de raio 2', '+1 comida por turno'];
const CARD_WHERE = ['Prado, Bosque ou Praia', 'Só em Prado', 'Prado ou Rocha', 'Qualquer terra', 'Praia junto da água'];

function costHtml(c: number): string {
  if (c === Card.House) return `<span class="cost">${ICON.food}${RULES.houseCostFood}</span>`;
  if (c === Card.Lantern) return `<span class="cost">${ICON.oil}${RULES.lanternCostOil}</span>`;
  return '<span class="cost free">grátis</span>';
}

function why(g: Game, c: number): string {
  if (c === Card.House && g.food < RULES.houseCostFood) return 'Falta comida';
  if (c === Card.Lantern && g.oil < RULES.lanternCostOil) return 'Falta óleo';
  return 'Sem lugar agora';
}

export function dayWord(turn: number): string {
  const p = (turn - 1) / 29;
  return p < 0.22 ? 'manhã' : p < 0.58 ? 'meio-dia' : p < 0.85 ? 'tarde' : 'entardecer';
}

export interface HudCallbacks { onSelect(slot: number): void; onDiscard(): void; onWind(): void }

export class Hud extends HudBase {
  private lastHandKey = '';

  constructor(private cb: HudCallbacks) {
    super();
    $('discard').addEventListener('click', () => cb.onDiscard());
    $('wind').addEventListener('click', () => cb.onWind());
  }

  /** Monta a régua desta versão (três noites) e mostra de novo os botões do descarte e do vento. */
  activate(): void {
    const ruler = $('ruler'); const marks = $('marks');
    ruler.innerHTML = ''; marks.innerHTML = '';
    $('discard').style.display = ''; $('wind').style.display = '';
    this.lastHandKey = '';
    for (let n = 1; n <= RULES.turns; n++) {
      const i = document.createElement('i');
      if (RULES.nights.includes(n)) i.className = 'night';
      ruler.appendChild(i);
    }
    for (const n of RULES.nights) {
      const m = document.createElement('span');
      m.className = 'm'; m.style.left = ((n - 0.5) / RULES.turns) * 100 + '%';
      m.innerHTML = `${ICON.moon}${n}`;
      m.title = `Noite no turno ${n}`;
      marks.appendChild(m);
    }
  }

  render(g: Game, selected: number, windArmed = false): void {
    const turn = Math.min(g.turn, RULES.turns);
    const fi = g.foodIncome(), oi = g.oilIncome();
    const nextNight = RULES.nights.find((n) => n >= g.turn);
    const upkeep = g.nightUpkeep();
    // recursos e moradores
    $('res').innerHTML =
      `<div class="pop" aria-label="Moradores"><b>${g.residents()}</b><span>${ICON.people}moradores</span><span class="score">${ICON.star}${g.score()} pontos</span></div>` +
      `<div class="stock">` +
      `<div class="chip${g.oil < RULES.lanternCostOil && g.oil < upkeep ? ' low' : ''}" title="Óleo: acende lanternas e alimenta a luz nas noites">${ICON.oil}<b>${g.oil}</b><small>+${oi}/turno</small></div>` +
      `<div class="chip${g.food < RULES.houseCostFood ? '' : ''}" title="Comida: constrói casas. Na noite, a que sobrar vira moradores (${RULES.feastFood} comida por morador, até ${RULES.feastCap}) e o estoque zera.">${ICON.food}<b>${g.food}</b><small>+${fi}/turno</small></div>` +
      `</div>`;
    // régua do dia
    const ticks = $('ruler').children;
    for (let i = 0; i < ticks.length; i++) {
      ticks[i].classList.toggle('past', i + 1 < g.turn || g.over);
      ticks[i].classList.toggle('now', i + 1 === turn && !g.over);
    }
    $('sun').style.left = ((Math.min(g.turn, RULES.turns) - 0.5) / RULES.turns) * 100 + '%';
    $('sun').innerHTML = nextNight !== undefined && RULES.nights.includes(g.turn) ? ICON.moon : ICON.sun;
    $('turnTxt').textContent = g.over ? 'Fim da temporada' : `Turno ${turn} de ${RULES.turns}`;
    $('dayTxt').textContent = g.over ? 'noite' : dayWord(g.turn);
    let need = '';
    if (!g.over && nextNight !== undefined) {
      const left = nextNight - g.turn;
      const projected = g.oil + oi * (left + 1);
      const short = Math.max(0, upkeep - projected);
      const gain = g.feastGain(g.food + fi * (left + 1));
      need = `Noite no turno ${nextNight}${left ? ` (em ${left} turno${left > 1 ? 's' : ''})` : ' (agora)'}: ${upkeep ? `as lanternas pedem ${upkeep} de óleo${short > 0 ? `, <b>faltam ${short}</b>` : ''}.` : 'casas sem lanterna encostada perdem morador.'} Festa: a comida vira moradores (${RULES.feastFood} por morador, até ${RULES.feastCap}) e o estoque zera${gain > 0 ? `, previsto <b>+${gain}</b>` : ''}.`;
    } else if (!g.over) need = 'Todas as noites já passaram.';
    $('need').innerHTML = need;
    // metas
    $('goals').innerHTML = `<h3>Metas <span>+${RULES.goalPoints} pontos cada</span></h3><ul>` + g.goals.map((id) => {
      const done = g.goalMet(id);
      const prog = Math.round(g.goalProgress(id) * 100);
      let nu = '';
      if (id === 1) nu = `${g.residents()}/${g.goalTarget}`;
      if (id === 2) nu = `${g.foundCount}/${RULES.findsGoal}`;
      if (id === 3) nu = `${g.longestRow()}/${RULES.rowGoal}`;
      if (id === 4) nu = `${Math.round(g.litFraction() * 100)}%`;
      if (id === 0) nu = done ? 'feita' : `a ${g.tipDistance()} de distância`;
      return `<li class="${done ? 'done' : ''}" title="${goalLabel(id)}"><span class="box">${ICON.check}</span><span class="nm">${GOAL_TITLES[id]}</span><span class="nu">${nu}</span><span class="bar"><i style="width:${prog}%"></i></span></li>`;
    }).join('') + '</ul>';
    this.renderHand(g, selected);
    this.renderWind(g, windArmed);
    const disc = $('discard') as HTMLButtonElement;
    disc.disabled = selected < 0 || g.over;
    disc.style.display = g.over ? 'none' : ''; // fim da partida: nada a descartar
  }

  /** Botão do sopro do vento: carga cheia ou vazia, armado, desabilitado (sem carga ou fim de jogo). */
  private renderWind(g: Game, armed: boolean): void {
    const b = $('wind'), ready = g.wind > 0 && !g.over;
    const nextNight = RULES.nights.find((n) => n >= g.turn);
    const sub = g.wind > 0 ? `${g.wind}/${RULES.windMax} pronto` : nextNight !== undefined ? `volta na noite ${nextNight}` : 'sem sopro';
    b.innerHTML = `${g.wind > 0 ? ICON.windFull : ICON.windEmpty}<span class="wl">Vento<small>${sub}</small></span>`;
    b.classList.toggle('ready', ready);
    b.classList.toggle('armed', armed && ready);
    b.setAttribute('aria-pressed', String(armed && ready));
    b.setAttribute('aria-disabled', String(!ready));
    b.setAttribute('aria-label', `Sopro do vento, tecla V. ${g.wind > 0 ? 'Carga cheia.' : 'Carga vazia, ' + sub + '.'} ${WIND_RULE}`);
    b.title = WIND_RULE;
    b.style.display = g.over ? 'none' : '';
  }

  private renderHand(g: Game, selected: number): void {
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
        b.style.setProperty('--tone', CARD_TONE[c]);
        b.style.setProperty('--r', (slot - 1) * 3 + 'deg');
        b.style.animationDelay = slot * 70 + 'ms';
        b.title = cardRule(c);
        b.innerHTML = `<span class="art">${CARD_ART[c]}<span class="key">${slot + 1}</span></span><span class="body"><span class="nm">${CARD_NAMES[c]}${costHtml(c)}</span><span class="fx">${CARD_FX[c]}</span><span class="where">${CARD_WHERE[c]}</span><span class="why"></span></span>`;
        b.addEventListener('click', () => this.cb.onSelect(slot));
        hand.insertBefore(b, $('discard'));
      });
    }
    hand.querySelectorAll<HTMLElement>('.card').forEach((el, slot) => {
      const c = g.hand[slot], ok = g.playable(c);
      el.classList.toggle('sel', slot === selected);
      el.classList.toggle('off', !ok);
      el.setAttribute('aria-pressed', String(slot === selected));
      el.setAttribute('aria-label', `${CARD_NAMES[c]}. ${CARD_FX[c]}. ${CARD_WHERE[c]}.${ok ? '' : ' ' + why(g, c) + '.'} Tecla ${slot + 1}.`);
      (el.querySelector('.why') as HTMLElement).textContent = ok ? '' : why(g, c);
    });
  }

  showEnd(g: Game, delay = 0): void {
    const s = g.summary();
    const goals = s.goals.map((id, k) => `<li class="${s.goalsMet[k] ? 'ok' : 'no'}"><span class="mk">${ICON.check}</span>${GOAL_TITLES[id]}</li>`).join('');
    $('endBody').innerHTML =
      `<div class="big">${s.score}<small>pontos</small></div>` +
      `<ul>${goals}</ul>` +
      `<div class="row"><span>${s.residents} moradores</span><span>${s.goalsMet.filter(Boolean).length} × ${RULES.goalPoints} das metas</span></div>` +
      `<div class="row" style="border:0;padding-top:2px"><span>Ilha iluminada</span><span>${Math.round(s.litPct * 100)}%</span></div>`;
    window.setTimeout(() => { $('end').classList.add('on'); ($('again') as HTMLButtonElement).focus({ preventScroll: true }); }, delay);
  }
}
