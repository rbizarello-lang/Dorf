// Peças de HUD comuns às duas versões das regras: aviso, texto flutuante, dica de jogada, menu e botões do fim.
// Quem desenha os recursos, as metas e a mão de cartas é o Hud (A) ou o HudB (B).
export const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

export interface MenuCallbacks {
  /** Nova partida na mesma ilha. */
  onNew(): void;
  /** Volta à tela de escolha (Ilha 1 / Ilha 2). */
  onChoose(): void;
  onExport(): void;
  onSkipHints(): void;
}

/** Liga o menu e os botões do fim, uma vez só (o jogo troca de ilha sem recarregar a página). */
export function bindMenu(menu: MenuCallbacks): void {
  $('again').addEventListener('click', () => menu.onNew());
  $('other').addEventListener('click', () => menu.onChoose());
  const btn = $('menuBtn'), pop = $('menuPop');
  const close = (): void => { pop.classList.remove('on'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !pop.classList.contains('on');
    pop.classList.toggle('on', open);
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => { if (!pop.contains(e.target as Node)) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  const bind = (id: string, fn: () => void): void => $(id).addEventListener('click', () => { close(); fn(); });
  bind('mNew', menu.onNew); bind('mChoose', menu.onChoose); bind('mExport', menu.onExport); bind('mSkip', menu.onSkipHints);
}

export abstract class HudBase {
  private toastTimer = 0;
  reduced = false;

  /** Linha do menu: "Ilha 1 · semente 123". Nunca diz qual versão é. */
  setMenuInfo(text: string): void { $('mInfo').textContent = text; }
  showSkipItem(on: boolean): void { $('mSkip').style.display = on ? '' : 'none'; }

  setInfo(text: string): void { $('info').textContent = text; }

  toast(text: string, ms = 4200): void {
    const t = $('toast');
    t.textContent = text; t.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('on'), ms);
  }

  float(x: number, y: number, text: string, lost = false, delay = 0): void {
    window.setTimeout(() => {
      const d = document.createElement('div');
      d.className = 'float' + (lost ? ' lost' : '');
      d.textContent = text;
      d.style.left = x + 'px'; d.style.top = y + 'px';
      document.body.appendChild(d);
      window.setTimeout(() => d.remove(), this.reduced ? 2600 : 2000);
    }, delay);
  }

  shake(slot: number): void {
    const el = $('hand').querySelectorAll<HTMLElement>('.card')[slot];
    if (!el || this.reduced) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }

  hideEnd(): void { $('end').classList.remove('on'); }
}
