// Dicas das primeiras partidas: um cartão curto por vez, que aparece quando o assunto acontece
// (primeiro encaixe perfeito, primeira missão, primeira interação...) e nunca volta. Substitui
// a leitura da ajuda inteira antes de jogar.

/** Assuntos das dicas, na ordem em que costumam aparecer. A lista fixa valida o que vem do armazenamento. */
export const TIP_IDS = ['inicio', 'estrito', 'perfeito', 'missao', 'interacao', 'sitio', 'era', 'pilha', 'maravilha'] as const;
export type TipId = (typeof TIP_IDS)[number];

export interface TipStore {
  get(k: string): string | null;
  set(k: string, v: string | null): void;
}

export class Tutorial {
  private seen = new Set<TipId>();
  private queue: { id: TipId; title: string; html: string }[] = [];
  private el: HTMLElement;
  private timer = 0;
  /** Desligado nos modos especiais (?auto, ?stress, ?demo) e na exportação de vídeo. */
  enabled = true;

  constructor(private store: TipStore) {
    for (const id of (store.get('tips') ?? '').split(',')) if ((TIP_IDS as readonly string[]).includes(id)) this.seen.add(id as TipId);
    this.el = document.getElementById('tip')!;
    this.el.querySelector('button')!.addEventListener('click', () => this.close());
  }

  /** Pede uma dica; se já foi vista ou já está na fila, não faz nada. */
  offer(id: TipId, title: string, html: string) {
    if (!this.enabled || this.seen.has(id) || this.queue.some((t) => t.id === id)) return;
    this.queue.push({ id, title, html });
  }

  /** Chamado a cada quadro: mostra a próxima dica quando a tela está livre. */
  tick(blocked: boolean) {
    if (!this.el.hidden || blocked || !this.queue.length) return;
    const t = this.queue.shift()!;
    this.seen.add(t.id);
    this.store.set('tips', [...this.seen].join(','));
    this.el.querySelector('b')!.textContent = t.title;
    this.el.querySelector('p')!.innerHTML = t.html;
    this.el.hidden = false;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.close(), 11000);
  }

  close() {
    clearTimeout(this.timer);
    this.el.hidden = true;
  }

  /** Esquece as dicas vistas (botão na ajuda). */
  reset() {
    this.seen.clear();
    this.queue.length = 0;
    this.store.set('tips', null);
    this.close();
  }

  get done() {
    return this.seen.size === TIP_IDS.length;
  }
}
