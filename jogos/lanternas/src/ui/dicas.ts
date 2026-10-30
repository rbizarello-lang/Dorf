// Primeiro minuto que ensina jogando: dicas de uma linha, uma de cada vez, na hora em que a regra importa.
// Só na primeira partida de cada ilha; "Pular dicas" apaga todas. O que já foi visto fica em localStorage.
import type { Variant } from '../ab';
import { $ } from './hudBase';

export const HINTS: Record<Variant, Record<string, string>> = {
  A: {
    inicio: 'Toque numa peça e depois num lugar brilhante.',
    lugar: 'Agora toque num lugar brilhante para colocar a peça.',
    luz: 'Lanternas acendem a névoa. Só dá para construir onde há luz.',
    casa: 'A Casa custa 5 de comida. Campos e cais dão comida a cada turno.',
    lanterna: 'A Lanterna custa 4 de óleo. Oliveirais dão óleo a cada turno.',
    descarte: 'Faltou recurso? Descartar uma peça rende +1 de óleo.',
    vento: 'O vento: toque numa nuvem junto da luz para soprar e espiar o que há lá.',
    noite: 'A noite chega logo: as lanternas gastam óleo e a comida guardada vira festa.',
  },
  B: {
    inicio: 'Toque numa peça e depois num lugar brilhante.',
    lugar: 'Agora toque num lugar brilhante para colocar a peça.',
    luz: 'A Lanterna acende a névoa e abre lugares novos.',
    casa: 'A Casa sobe de nível ao lado de campo, bosque, água e lanterna.',
    vila: 'Três casas encostadas formam uma vila, que ganha um poço.',
    achado: 'Os achados dão um presente quando a luz chega neles.',
    noite: 'Faltam poucas peças: ao fim cai a noite e a ilha se acende.',
  },
};

const hideAfter = 9000;

export class Dicas {
  private key: string;
  private seen = new Set<string>();
  private done = false;
  private timer = 0;
  /** Chamado quando uma dica aparece (a telemetria marca o turno). */
  onShow: (id: string) => void = () => {};
  /** Capturas de tela: a dica não some sozinha. */
  sticky = false;

  constructor(private variant: Variant, private skipMenu: (on: boolean) => void) {
    this.key = 'lanternas.dicas.' + variant;
    try {
      const o = JSON.parse(localStorage.getItem(this.key) || 'null') as { done?: boolean; seen?: string[] } | null;
      if (o) { this.done = !!o.done; (o.seen || []).forEach((s) => typeof s === 'string' && this.seen.add(s)); }
    } catch { /* sem armazenamento: vale só nesta sessão */ }
    $('dicaSkip').addEventListener('click', () => this.skip());
    this.skipMenu(this.active);
  }

  get active(): boolean { return !this.done; }

  private save(): void {
    try { localStorage.setItem(this.key, JSON.stringify({ done: this.done, seen: [...this.seen] })); } catch { /* ignora */ }
  }

  /** Mostra a dica `id` se ainda não foi vista (e só na primeira partida). */
  at(id: string): void {
    if (this.done || this.seen.has(id)) return;
    const text = HINTS[this.variant][id];
    if (!text) return;
    this.seen.add(id); this.save();
    $('dicaTxt').textContent = text;
    $('dica').classList.add('on');
    this.onShow(id);
    clearTimeout(this.timer);
    if (!this.sticky) this.timer = window.setTimeout(() => this.hide(), hideAfter);
  }

  /** A jogada que a dica pedia aconteceu: some. */
  hide(): void { $('dica').classList.remove('on'); clearTimeout(this.timer); }

  /** A 1ª partida acabou: as dicas não voltam nesta ilha. */
  finish(): void { this.done = true; this.save(); this.hide(); this.skipMenu(false); }

  skip(): void { this.finish(); }
}
