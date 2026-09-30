import type { Quest } from '../core/board';
import { corner } from '../core/hex';
import type { TileDef } from '../core/tiles';
import { THEMES, type Theme } from '../themes/themes';

const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;

export interface MarkerView {
  id: number;
  x: number;
  y: number;
  visible: boolean;
  text: string;
  color: string;
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function questLabel(q: Quest, theme: Theme) {
  const name = theme.terrainNames[q.terrain];
  return q.exact ? `${name}: exatamente ${q.target}` : `${name}: ${q.target} ou mais`;
}

export class Hud {
  readonly score = $('score');
  readonly best = $('best');
  readonly stack = $('stack');
  readonly preview = $('preview');
  readonly quests = $('quests');
  readonly toasts = $('toasts');
  readonly floaters = $('floaters');
  readonly markers = $('markers');
  readonly modal = $('modal');
  readonly modalBody = $('modal-body');
  readonly themeMenu = $('theme-menu');
  readonly themeBtn = $('btn-theme');
  readonly stats = $<HTMLPreElement>('stats');
  readonly hint = $('hint');
  readonly confirm = $<HTMLButtonElement>('confirm');
  private questEls = new Map<number, HTMLElement>();
  private markerEls = new Map<number, HTMLElement>();
  private shownScore = 0;
  private targetScore = 0;

  applyTheme(theme: Theme) {
    const root = document.documentElement.style;
    root.setProperty('--bg', theme.bg);
    root.setProperty('--panel', theme.ui.panel);
    root.setProperty('--ink', theme.ui.ink);
    root.setProperty('--soft', theme.ui.soft);
    root.setProperty('--accent', theme.ui.accent);
    root.setProperty('color-scheme', theme.id === 'marte' ? 'dark' : 'light');
    $('theme-name').textContent = theme.name;
    $('theme-swatch').innerHTML = theme.terrainColors.slice(0, 5).map((c) => `<i style="background:${c}"></i>`).join('');
    for (const el of this.questEls.values()) el.remove();
    this.questEls.clear();
    for (const el of this.markerEls.values()) el.remove();
    this.markerEls.clear();
  }

  setScore(score: number, best: number, instant = false) {
    this.targetScore = score;
    if (instant) this.shownScore = score;
    this.best.textContent = `recorde ${best.toLocaleString('pt-BR')}`;
  }

  /** Contador de pontos que "rola" até o valor novo. */
  tick(dt: number) {
    if (this.shownScore !== this.targetScore) {
      const diff = this.targetScore - this.shownScore;
      const step = Math.max(1, Math.ceil(Math.abs(diff) * Math.min(1, dt * 8)));
      this.shownScore += Math.sign(diff) * Math.min(step, Math.abs(diff));
    }
    const text = this.shownScore.toLocaleString('pt-BR');
    if (this.score.textContent !== text) this.score.textContent = text;
  }

  setStack(n: number) {
    this.stack.textContent = String(Math.max(0, n));
    this.stack.parentElement!.classList.toggle('low', n <= 5);
    this.stack.parentElement!.classList.toggle('wide', n >= 1000);
  }

  renderNext(def: TileDef | null, theme: Theme) {
    const svg = $('next');
    svg.parentElement!.hidden = !def;
    if (!def) {
      svg.innerHTML = '';
      return;
    }
    let out = '';
    for (let i = 0; i < 6; i++) {
      const [ax, az] = corner(i);
      const [bx, bz] = corner((i + 1) % 6);
      out += `<polygon points="0,0 ${ax.toFixed(3)},${az.toFixed(3)} ${bx.toFixed(3)},${bz.toFixed(3)}" fill="${theme.terrainColors[def.edges[i]]}" stroke="${theme.ui.panel}" stroke-width="0.05" stroke-linejoin="round"/>`;
    }
    if (def.quest) out += `<circle r="0.28" fill="${theme.ui.panel}"/><text y="0.12" text-anchor="middle" font-size="0.36" font-weight="800" fill="${theme.ui.ink}">!</text>`;
    svg.innerHTML = out;
  }

  renderQuests(quests: Quest[], theme: Theme) {
    for (const q of quests) {
      let el = this.questEls.get(q.id);
      if (q.state === 'active' && !el) {
        el = document.createElement('div');
        el.className = 'quest';
        el.innerHTML = `<i class="ico" style="background:${theme.terrainColors[q.terrain]}"></i><b></b><span class="reward">+${q.reward} peças</span><span class="bar"><i></i></span>`;
        this.quests.appendChild(el);
        this.questEls.set(q.id, el);
      }
      if (!el) continue;
      const b = el.querySelector('b')!;
      b.textContent = theme.terrainNames[q.terrain];
      const sub = document.createElement('small');
      sub.textContent = `${q.exact ? `exatamente ${q.target}` : `${q.target} ou mais`} · ${Math.min(q.progress, q.target)}/${q.target}`;
      b.appendChild(sub);
      (el.querySelector('.bar i') as HTMLElement).style.width = `${Math.min(100, (q.progress / q.target) * 100)}%`;
      if (q.state !== 'active' && !el.classList.contains('done') && !el.classList.contains('failed')) {
        el.classList.add(q.state === 'done' ? 'done' : 'failed');
        const dead = el;
        setTimeout(() => dead.remove(), 950);
        this.questEls.delete(q.id);
      }
    }
  }

  updateMarkers(list: MarkerView[]) {
    const alive = new Set<number>();
    for (const m of list) {
      alive.add(m.id);
      let el = this.markerEls.get(m.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'marker';
        this.markers.appendChild(el);
        this.markerEls.set(m.id, el);
      }
      if (el.textContent !== m.text) el.textContent = m.text;
      el.style.setProperty('--c', m.color);
      el.style.display = m.visible ? '' : 'none';
      el.style.transform = `translate(${(m.x - 4).toFixed(1)}px, ${(m.y - 44).toFixed(1)}px)`;
    }
    for (const [id, el] of this.markerEls) {
      if (!alive.has(id)) {
        el.remove();
        this.markerEls.delete(id);
      }
    }
  }

  toast(text: string, kind: '' | 'good' | 'bad' = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild!.remove();
    setTimeout(() => el.remove(), 3300);
  }

  floater(x: number, y: number, text: string, cls = '') {
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.floaters.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  showModal(html: string) {
    this.modalBody.innerHTML = html;
    this.modal.hidden = false;
    (this.modalBody.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  hideModal() {
    this.modal.hidden = true;
  }

  get modalOpen() {
    return !this.modal.hidden;
  }

  openThemeMenu(current: Theme, onPick: (t: Theme) => void) {
    this.themeMenu.innerHTML = THEMES.map(
      (t) => `<button class="theme-opt" type="button" data-id="${t.id}" aria-current="${t.id === current.id}">
        <span class="swatch">${t.terrainColors.slice(0, 5).map((c) => `<i style="background:${c}"></i>`).join('')}</span>
        <strong>${esc(t.name)}</strong>
        <span>${esc(t.tagline)}</span>
        ${t.ruleNote ? `<em>${esc(t.ruleNote)}</em>` : '<em>Regras padrão.</em>'}
      </button>`,
    ).join('');
    this.themeMenu.hidden = false;
    this.themeBtn.setAttribute('aria-expanded', 'true');
    this.themeMenu.querySelectorAll<HTMLButtonElement>('.theme-opt').forEach((b) =>
      b.addEventListener('click', () => {
        this.closeThemeMenu();
        onPick(THEMES.find((t) => t.id === b.dataset.id)!);
      }),
    );
  }

  closeThemeMenu() {
    this.themeMenu.hidden = true;
    this.themeBtn.setAttribute('aria-expanded', 'false');
  }
}
