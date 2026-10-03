import type { Quest } from '../core/board';
import { corner } from '../core/hex';
import type { TileDef } from '../core/tiles';
import { PERIOD_LABEL, PERIOD_ORDER, THEMES, type Theme } from '../themes/themes';
import { CHARGES, HOUSE_COLORS, METALS, ORDINARIES, bannerSvg, type Banner, type HouseColor } from './banner';

const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;

export interface MarkerView {
  id: number;
  x: number;
  y: number;
  visible: boolean;
  text: string;
  color: string;
  /** Sítio escondido (estilo de carimbo), em vez de missão. */
  kind?: string;
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function questLabel(q: Quest, theme: Theme) {
  const name = theme.terrainNames[q.terrain];
  if (q.kind === 'close') return `Fechar ${name}`;
  if (q.kind === 'perfect') return `${q.target} encaixes perfeitos`;
  if (q.kind === 'synergy') return `${q.target}× ${theme.synergy[q.syn!]}`;
  return q.exact ? `${name}: exatamente ${q.target}` : `${name}: ${q.target} ou mais`;
}

/** Título, linha de baixo e cor do cartão de uma missão. */
function questCard(q: Quest, theme: Theme) {
  const count = `${Math.min(q.progress, q.target)}/${q.target}`;
  const color = theme.terrainColors[q.terrain];
  if (q.kind === 'close') {
    const open = q.open ?? 0;
    return { title: `Fechar ${theme.terrainNames[q.terrain]}`, sub: open === 1 ? 'falta 1 borda aberta' : `faltam ${open} bordas abertas`, color };
  }
  if (q.kind === 'perfect') return { title: 'Encaixes perfeitos', sub: `todas as bordas combinando · ${count}`, color: theme.ui.accent };
  if (q.kind === 'synergy') return { title: theme.synergy[q.syn!], sub: `interações · ${count}`, color };
  return { title: theme.terrainNames[q.terrain], sub: `${q.exact ? `exatamente ${q.target}` : `${q.target} ou mais`} · ${count}`, color };
}

/** Texto curto do estandarte da missão no mapa. */
export function questMarker(q: Quest) {
  if (q.kind === 'close') return `◯${q.open ?? 0}`;
  if (q.kind === 'perfect') return `★${q.target - q.progress}`;
  if (q.kind === 'synergy') return `✦${q.target - q.progress}`;
  return q.exact ? `=${q.target}` : `${q.target}+`;
}

/** Seção "Sua casa" no topo do menu de temas: cor da casa e brasão. */
export interface HouseMenu {
  color: HouseColor | null;
  banner: Banner;
  /** Destaque do próprio tema (a opção "Tema"). */
  themeAccent: string;
  onChange: (color: HouseColor | null, banner: Banner) => void;
}

function houseSection(h: HouseMenu) {
  const field = h.color ? HOUSE_COLORS[h.color].hex : h.themeAccent;
  const pressed = (on: boolean) => `aria-pressed="${on}"`;
  const dots = [`<button class="dot" type="button" data-k="color" data-v="tema" style="--c:${h.themeAccent}" title="Cor do tema" ${pressed(!h.color)}></button>`]
    .concat(Object.entries(HOUSE_COLORS).map(([id, c]) => `<button class="dot" type="button" data-k="color" data-v="${id}" style="--c:${c.hex}" title="${c.name}" ${pressed(h.color === id)}></button>`))
    .join('');
  const row = (k: keyof Banner, list: Record<string, string>) =>
    Object.entries(list)
      .map(([id, label]) => `<button type="button" data-k="${k}" data-v="${id}" ${pressed(h.banner[k] === id)}>${k === 'metal' ? id[0].toUpperCase() + id.slice(1) : esc(label)}</button>`)
      .join('');
  return `<h3>Sua casa</h3><div class="house">
    <span class="crest-big">${bannerSvg(field, h.banner, 56)}</span>
    <div class="row">${dots}</div>
    <div class="row">${row('metal', METALS)}</div>
    <div class="row">${row('ordinary', ORDINARIES)}</div>
    <div class="row">${row('charge', CHARGES)}</div>
  </div>`;
}

/** Opção de um menu do topo (qualidade, câmera). */
export interface MenuItem {
  id: string;
  label: string;
  note?: string;
  /** Atalho de teclado mostrado à direita. */
  key?: string;
  current?: boolean;
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
  readonly menu = $('menu');
  private menuBtn: HTMLElement | null = null;
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

  /** Pulso no placar ao ganhar pontos; 'big' para encaixes especiais, 'record' ao passar do recorde. */
  bumpScore(kind: '' | 'big' | 'record' = '') {
    const el = this.score;
    el.classList.remove('bump', 'big', 'record');
    void el.offsetWidth; // reinicia a animação mesmo com pontos em sequência
    el.classList.add('bump');
    if (kind) el.classList.add(kind);
  }

  /** Anuncia ao leitor de tela; o placar em si não é região viva porque rola número a número. */
  say(text: string) {
    $('sr').textContent = text;
  }

  /** Número que sobe de 0 até o valor (placar final); sem animação se o sistema pede menos movimento. */
  countUp(el: HTMLElement, to: number, ms = 1200) {
    if (to <= 0 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t0 = performance.now();
    const frame = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('pt-BR');
      if (k < 1 && el.isConnected) requestAnimationFrame(frame);
    };
    el.textContent = '0';
    requestAnimationFrame(frame);
  }

  setStack(n: number, infinite = false) {
    this.stack.textContent = infinite ? '∞' : String(Math.max(0, n));
    this.stack.parentElement!.classList.toggle('low', !infinite && n <= 5);
    this.stack.parentElement!.classList.toggle('wide', !infinite && n >= 1000);
  }

  /** Era da vila: nome e quanto falta para a próxima (0 a 1; null = última era). */
  setEra(label: string, progress: number | null) {
    const el = $('era');
    el.hidden = !label;
    (el.querySelector('.era-name') as HTMLElement).textContent = label;
    const bar = el.querySelector('.era-bar') as HTMLElement;
    bar.hidden = progress === null;
    (bar.querySelector('i') as HTMLElement).style.width = `${Math.round((progress ?? 1) * 100)}%`;
  }

  setUndo(left: number) {
    const b = $<HTMLButtonElement>('btn-undo');
    b.hidden = left <= 0;
    $('undo-n').textContent = left >= 99 ? '' : String(left);
  }

  private hexSvg(def: TileDef, theme: Theme) {
    let out = '';
    for (let i = 0; i < 6; i++) {
      const [ax, az] = corner(i);
      const [bx, bz] = corner((i + 1) % 6);
      out += `<polygon points="0,0 ${ax.toFixed(3)},${az.toFixed(3)} ${bx.toFixed(3)},${bz.toFixed(3)}" fill="${theme.terrainColors[def.edges[i]]}" stroke="${theme.ui.panel}" stroke-width="0.05" stroke-linejoin="round"/>`;
    }
    if (def.quest) out += `<circle r="0.28" fill="${theme.ui.panel}"/><text y="0.12" text-anchor="middle" font-size="0.36" font-weight="800" fill="${theme.ui.ink}">!</text>`;
    return out;
  }

  /** A próxima peça e, com o mirante, as seguintes (menores). */
  renderNext(def: TileDef | null, theme: Theme, upcoming: TileDef[] = []) {
    const svg = $('next');
    svg.parentElement!.hidden = !def;
    svg.innerHTML = def ? this.hexSvg(def, theme) : '';
    const up = $('upcoming');
    up.hidden = !def || !upcoming.length;
    up.innerHTML = upcoming.map((d) => `<svg viewBox="-1.1 -1.1 2.2 2.2" aria-hidden="true">${this.hexSvg(d, theme)}</svg>`).join('');
  }

  renderQuests(quests: Quest[], theme: Theme) {
    for (const q of quests) {
      let el = this.questEls.get(q.id);
      if (q.state === 'active' && !el) {
        el = document.createElement('div');
        el.className = 'quest';
        el.innerHTML = `<i class="ico" style="background:${questCard(q, theme).color}"></i><b></b><span class="reward">+${q.reward} peças</span><span class="bar"><i></i></span>`;
        this.quests.appendChild(el);
        this.questEls.set(q.id, el);
      }
      if (!el) continue;
      const b = el.querySelector('b')!;
      const card = questCard(q, theme);
      b.textContent = card.title;
      const sub = document.createElement('small');
      sub.textContent = card.sub;
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
        el.className = m.kind ? `marker site ${m.kind}` : 'marker';
        this.markers.appendChild(el);
        this.markerEls.set(m.id, el);
      }
      if (el.dataset.text !== m.text) {
        el.dataset.text = m.text;
        if (m.kind) el.textContent = m.text;
        else {
          // Estandarte: o pano (com a bolinha do terreno) leva o número.
          const span = document.createElement('span');
          span.append(document.createElement('i'), m.text);
          el.replaceChildren(span);
        }
      }
      el.style.setProperty('--c', m.color);
      el.style.display = m.visible ? '' : 'none';
      // O pé do mastro (ou a ponta da etiqueta do sítio) fica no ponto da peça.
      el.style.transform = m.kind ? `translate(${(m.x - 4).toFixed(1)}px, ${(m.y - 44).toFixed(1)}px)` : `translate(${(m.x - 1).toFixed(1)}px, ${(m.y - 64).toFixed(1)}px)`;
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

  /** Brasão no placar. */
  setCrest(svg: string) {
    $('crest').innerHTML = svg;
  }

  openThemeMenu(current: Theme, onPick: (t: Theme) => void, house?: HouseMenu) {
    this.closeMenu();
    const opt = (t: Theme) => `<button class="theme-opt" type="button" data-id="${t.id}" aria-current="${t.id === current.id}" title="${esc(t.tagline)}">
        <span class="swatch">${t.terrainColors.slice(0, 5).map((c) => `<i style="background:${c}"></i>`).join('')}</span>
        <strong>${esc(t.name)}</strong>
        <span>${esc(t.era)}</span>
        ${t.ruleNote ? `<em>${esc(t.ruleNote)}</em>` : ''}
      </button>`;
    this.themeMenu.innerHTML =
      (house ? houseSection(house) : '') +
      PERIOD_ORDER.map((p) => {
        const list = THEMES.filter((t) => t.period === p);
        return list.length ? `<h3>${PERIOD_LABEL[p]}</h3>${list.map(opt).join('')}` : '';
      }).join('');
    if (house) {
      this.themeMenu.querySelectorAll<HTMLButtonElement>('.house button').forEach((b) =>
        b.addEventListener('click', () => {
          const { k, v } = b.dataset as { k: string; v: string };
          const banner = { ...house.banner };
          let color = house.color;
          if (k === 'color') color = v === 'tema' ? null : (v as HouseColor);
          else (banner as Record<string, string>)[k] = v;
          house.onChange(color, banner);
          const top = this.themeMenu.scrollTop;
          this.openThemeMenu(current, onPick, { ...house, color, banner });
          this.themeMenu.scrollTop = top;
        }),
      );
    }
    this.themeMenu.hidden = false;
    this.themeBtn.setAttribute('aria-expanded', 'true');
    this.themeMenu.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
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
    this.closeMenu();
  }

  /** Menu preso a um botão do topo; clicar de novo no mesmo botão fecha. */
  toggleMenu(btn: HTMLElement, items: MenuItem[], onPick: (id: string) => void) {
    const same = this.menuBtn === btn && !this.menu.hidden;
    this.closeThemeMenu();
    if (same) return;
    this.menu.innerHTML = items
      .map(
        (it) => `<button class="menu-opt" type="button" data-id="${esc(it.id)}" aria-current="${!!it.current}">
        <strong>${esc(it.label)}</strong>${it.key ? `<kbd>${esc(it.key)}</kbd>` : ''}
        ${it.note ? `<span>${esc(it.note)}</span>` : ''}
      </button>`,
      )
      .join('');
    this.menu.hidden = false;
    this.menuBtn = btn;
    btn.setAttribute('aria-expanded', 'true');
    this.menu.querySelectorAll<HTMLButtonElement>('.menu-opt').forEach((b) =>
      b.addEventListener('click', () => {
        this.closeMenu();
        onPick(b.dataset.id!);
      }),
    );
  }

  closeMenu() {
    this.menu.hidden = true;
    this.menuBtn?.setAttribute('aria-expanded', 'false');
    this.menuBtn = null;
  }
}
