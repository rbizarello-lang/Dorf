// Minimapa e a linha do tempo do fim da partida (proposta 16 do docs/IDEIAS_AOE.md).
// O mapa desenha um hexágono por jogada; o trapézio da câmera sai todo quadro.
// A linha do tempo é um SVG da pontuação, com as marcas da partida.

import { corner, edgeMid, hexToWorld } from '../core/hex';
import type { SiteKind } from '../core/sites';
import { T } from '../core/tiles';

export interface MapTile {
  q: number;
  r: number;
  edges: readonly number[];
}

export interface MapQuest {
  q: number;
  r: number;
  color: string;
}

export interface MapSite {
  q: number;
  r: number;
  kind: SiteKind;
}

export interface MapFrame {
  quests: readonly MapQuest[];
  sites: readonly MapSite[];
  /** Cantos da tela no chão, na ordem do World.viewOnGround. */
  corners: readonly ({ x: number; z: number } | null)[];
}

/** Um ponto da linha do tempo: o tabuleiro depois de uma jogada. */
export interface TurnNote {
  score: number;
  /** Maior grupo de cada um dos 6 terrenos. */
  groups: readonly number[];
  /** Era alcançada nesta jogada (índice a partir de 0), ou null. */
  era: number | null;
  /** Missões cumpridas nesta jogada. */
  quests: number;
  /** A maravilha começou ou ficou pronta. */
  wonder: 'start' | 'done' | null;
}

const NARROW = '(max-width: 520px)';
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function ink(c: string) {
  return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#888888';
}

function xml(s: string) {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

/**
 * Gráfico da partida: a pontuação em traço grosso, o maior grupo de cada terreno
 * em traço fino (escala própria) e marcas de era, missão e maravilha.
 */
export function timelineSvg(turns: readonly TurnNote[], colors: readonly string[], accent: string, names: readonly string[] = []): string {
  if (!turns.length) return '';
  const W = 320;
  const H = 128;
  const L = 8;
  const R = 8;
  const top = 16;
  const bottom = 30;
  const iw = W - L - R;
  const ih = H - top - bottom;
  const n = turns.length;
  const xAt = (i: number) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const maxS = Math.max(1, ...turns.map((t) => t.score));
  let maxG = 1;
  for (const t of turns) for (const g of t.groups) if (g > maxG) maxG = g;
  const yS = (s: number) => top + ih - (s / maxS) * ih;
  const yG = (g: number) => top + ih - (g / maxG) * ih;
  const accentInk = ink(accent);
  const line = (values: readonly number[], y: (v: number) => number) => values.map((v, i) => `${xAt(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  let groups = '';
  for (let terr = 0; terr < Math.min(6, colors.length); terr++) {
    let peak = 0;
    for (const t of turns) if ((t.groups[terr] ?? 0) > peak) peak = t.groups[terr] ?? 0;
    if (!peak) continue;
    const pts = turns.map((t, i) => `${xAt(i).toFixed(1)},${yG(t.groups[terr] ?? 0).toFixed(1)}`).join(' ');
    const title = names[terr] ? `<title>${xml(names[terr])}</title>` : '';
    groups += `<polyline points="${pts}" fill="none" stroke="${ink(colors[terr])}" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round">${title}</polyline>`;
  }

  let marks = '';
  turns.forEach((t, i) => {
    const x = xAt(i);
    const y = yS(t.score);
    if (t.quests) {
      const ty = Math.min(y + 6.5, top + ih + 4);
      marks += `<path data-mark="quest" d="M${x.toFixed(1)} ${ty.toFixed(1)} l2.6 4.4 h-5.2 z" fill="${accentInk}"/>`;
    }
    if (t.era !== null) {
      const label = ROMAN[t.era] ?? String(t.era + 1);
      const above = y > top + 11;
      marks += `<circle data-mark="era" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.1" fill="#c8962a" stroke="#fff8e8" stroke-width="1"/>`;
      marks += `<text data-mark="era" x="${x.toFixed(1)}" y="${(above ? y - 5.5 : y + 11).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="800" fill="#c8962a">${label}</text>`;
    }
    if (t.wonder) {
      const above = y > top + 11;
      const wy = above ? y - (t.era !== null ? 15 : 6) : y + (t.era !== null ? 20 : 11);
      marks += `<text data-mark="wonder" x="${x.toFixed(1)}" y="${wy.toFixed(1)}" text-anchor="middle" font-size="9" fill="#c8962a">${t.wonder === 'done' ? '★' : '☆'}</text>`;
    }
  });

  const last = turns[n - 1];
  const swatches = colors.slice(0, 6).map((c, i) => {
    const title = names[i] ? `<title>${xml(names[i])}</title>` : '';
    return `<rect x="${132 + i * 12}" y="${H - 13}" width="8" height="8" rx="1.5" fill="${ink(c)}">${title}</rect>`;
  }).join('');
  const label = `Linha do tempo da pontuação, ${last.score} pontos no fim`;

  return `<svg class="timeline" viewBox="0 0 ${W} ${H}" role="img" aria-label="${xml(label)}">
    ${groups}
    <polyline points="${line(turns.map((t) => t.score), yS)}" fill="none" stroke="${accentInk}" stroke-width="2.15" stroke-linejoin="round" stroke-linecap="round"/>
    ${marks}
    <line x1="${L}" y1="${H - 9}" x2="${L + 14}" y2="${H - 9}" stroke="${accentInk}" stroke-width="2.15" stroke-linecap="round"/>
    <text x="${L + 18}" y="${H - 6}" font-size="9" font-weight="700" fill="currentColor">pontos</text>
    <text x="78" y="${H - 6}" font-size="9" font-weight="700" fill="currentColor">maior grupo</text>
    ${swatches}
  </svg>`;
}

interface Store {
  get(k: string): string | null;
  set(k: string, v: string | null): void;
}

/** Canvas hexagonal do mapa: peças, rios, trilhos, flâmulas, carimbos e a câmera. */
export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly btn: HTMLButtonElement;
  private readonly base: HTMLCanvasElement;
  private readonly bctx: CanvasRenderingContext2D;
  private readonly vctx: CanvasRenderingContext2D;
  private tiles: MapTile[] = [];
  private colors: readonly string[] = [];
  private last: MapFrame | null = null;
  private ox = -2;
  private oz = -2;
  private span = 4;
  private px = 140;
  private dpr = 1;
  collapsed = true;

  constructor(
    private readonly root: HTMLElement,
    private readonly store: Store,
    private readonly onGoto: (x: number, z: number) => void,
  ) {
    this.canvas = root.querySelector('canvas') as HTMLCanvasElement;
    this.btn = root.querySelector('button') as HTMLButtonElement;
    this.base = document.createElement('canvas');
    const bctx = this.base.getContext('2d');
    const vctx = this.canvas.getContext('2d');
    if (!bctx || !vctx) throw new Error('Canvas 2D indisponível para o minimapa');
    this.bctx = bctx;
    this.vctx = vctx;
    this.btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.collapsed || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * this.px;
      const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * this.px;
      const w = this.unproject(x, y);
      this.onGoto(w.x, w.z);
    });
    const saved = store.get('map');
    const open = saved === '0' || saved === '1' ? saved === '1' : !window.matchMedia(NARROW).matches;
    this.layout(false);
    this.setCollapsed(!open, false);
  }

  toggle() {
    this.setCollapsed(!this.collapsed, true);
  }

  /** Lado do canvas em px de CSS: 96 no celular, 140 no resto. */
  private cssPx() {
    return window.matchMedia(NARROW).matches ? 96 : 140;
  }

  /** Ajusta o bitmap ao tamanho e à densidade da tela. Se o lado mudou, redesenha. */
  layout(redraw = true) {
    const px = this.cssPx();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const changed = px !== this.px || dpr !== this.dpr;
    this.px = px;
    this.dpr = dpr;
    if (!this.collapsed) {
      this.root.style.width = `${px}px`;
      this.root.style.height = `${px}px`;
    }
    if (!changed && redraw) return;
    this.sizeTo(this.base);
    this.sizeTo(this.canvas);
    if (redraw && this.tiles.length) {
      this.redrawAll();
      if (!this.collapsed) this.paint();
    }
    if (!this.collapsed) document.documentElement.style.setProperty('--map-lift', `${px + 10}px`);
  }

  private sizeTo(c: HTMLCanvasElement) {
    c.width = Math.round(this.px * this.dpr);
    c.height = Math.round(this.px * this.dpr);
  }

  private setCollapsed(collapsed: boolean, save: boolean) {
    this.collapsed = collapsed;
    this.root.classList.toggle('collapsed', collapsed);
    this.btn.setAttribute('aria-expanded', String(!collapsed));
    this.btn.setAttribute('aria-label', collapsed ? 'Abrir o minimapa' : 'Fechar o minimapa');
    this.btn.textContent = collapsed ? 'Mapa' : '✕';
    this.btn.title = collapsed ? 'Abrir o minimapa (M)' : 'Fechar o minimapa (M)';
    if (collapsed) {
      this.root.style.width = '';
      this.root.style.height = '';
    } else {
      this.root.style.width = `${this.px}px`;
      this.root.style.height = `${this.px}px`;
    }
    document.documentElement.style.setProperty('--map-lift', collapsed ? '46px' : `${this.px + 10}px`);
    if (save) this.store.set('map', collapsed ? '0' : '1');
    if (!collapsed) this.paint();
  }

  /** Troca de tema, partida nova ou desfazer: repinta tudo de uma vez. */
  rebuild(tiles: readonly MapTile[], colors: readonly string[]) {
    this.colors = colors;
    this.tiles = tiles.slice();
    this.fitTiles();
    this.redrawAll();
    if (!this.collapsed) this.paint();
  }

  /**
   * Uma peça a mais. Se ela cabe no enquadramento, só ela é desenhada; senão o
   * mapa afasta e as peças todas voltam (uma vez, não a cada quadro).
   */
  add(tile: MapTile) {
    this.tiles.push(tile);
    if (this.tiles.length > 1 && this.fits(tile)) this.drawTile(this.bctx, tile);
    else {
      this.fitTiles();
      this.redrawAll();
    }
    if (!this.collapsed) this.paint();
  }

  /** Flâmulas, carimbos e o trapézio. As peças ficam no canvas de baixo. */
  frame(view: MapFrame) {
    this.last = view;
    if (!this.collapsed) this.paint();
  }

  private fits(tile: MapTile) {
    const { x, z } = hexToWorld(tile.q, tile.r);
    const m = 1.08;
    return x - m >= this.ox && x + m <= this.ox + this.span && z - m >= this.oz && z + m <= this.oz + this.span;
  }

  private fitTiles() {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const t of this.tiles) {
      const { x, z } = hexToWorld(t.q, t.r);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    if (!Number.isFinite(minX)) {
      minX = -1;
      maxX = 1;
      minZ = -1;
      maxZ = 1;
    }
    const pad = 1.22;
    minX -= pad;
    maxX += pad;
    minZ -= pad;
    maxZ += pad;
    const side = Math.max(maxX - minX, maxZ - minZ, 2.8);
    this.ox = (minX + maxX) / 2 - side / 2;
    this.oz = (minZ + maxZ) / 2 - side / 2;
    this.span = side;
  }

  private project(x: number, z: number) {
    const k = this.px / this.span;
    return { x: (x - this.ox) * k, y: (z - this.oz) * k };
  }

  private unproject(x: number, y: number) {
    const k = this.span / this.px;
    return { x: this.ox + x * k, z: this.oz + y * k };
  }

  private redrawAll() {
    const ctx = this.bctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.px, this.px);
    for (const t of this.tiles) this.drawTile(ctx, t);
  }

  private drawTile(ctx: CanvasRenderingContext2D, tile: MapTile) {
    const { x, z } = hexToWorld(tile.q, tile.r);
    const c = this.project(x, z);
    const hexPx = this.px / this.span;
    for (let i = 0; i < 6; i++) {
      const [ax, az] = corner(i);
      const [bx, bz] = corner((i + 1) % 6);
      const A = this.project(x + ax, z + az);
      const B = this.project(x + bx, z + bz);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.closePath();
      ctx.fillStyle = ink(this.colors[tile.edges[i]] ?? '');
      ctx.fill();
    }
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const [ax, az] = corner(i);
      const p = this.project(x + ax, z + az);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.lineWidth = Math.max(0.4, hexPx * 0.05);
    ctx.strokeStyle = 'rgba(0,0,0,0.38)';
    ctx.stroke();
    const lw = Math.max(1, hexPx * 0.2);
    for (let i = 0; i < 6; i++) {
      const terr = tile.edges[i];
      if (terr !== T.Water && terr !== T.Rail) continue;
      const [mx, mz] = edgeMid(i);
      const M = this.project(x + mx, z + mz);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(M.x, M.y);
      ctx.lineWidth = terr === T.Water ? lw : Math.max(0.8, lw * 0.7);
      ctx.strokeStyle = terr === T.Water ? 'rgba(255,255,255,0.92)' : 'rgba(28,18,12,0.9)';
      ctx.setLineDash(terr === T.Rail ? [lw * 1.3, lw * 0.8] : []);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private paint() {
    const ctx = this.vctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.px, this.px);
    ctx.drawImage(this.base, 0, 0, this.px, this.px);
    const view = this.last;
    if (!view) return;
    for (const s of view.sites) this.stamp(ctx, s);
    for (const q of view.quests) this.pennant(ctx, q);
    this.trapezoid(ctx, view.corners);
  }

  private pennant(ctx: CanvasRenderingContext2D, q: MapQuest) {
    const { x, z } = hexToWorld(q.q, q.r);
    const p = this.project(x, z);
    const s = Math.max(3.4, Math.min(7.2, (this.px / this.span) * 0.62));
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 0.15);
    ctx.lineTo(p.x, p.y + s * 0.95);
    ctx.strokeStyle = 'rgba(255,248,240,0.92)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 1.15);
    ctx.lineTo(p.x + s, p.y - s * 0.32);
    ctx.lineTo(p.x + s, p.y + s * 0.42);
    ctx.lineTo(p.x + s * 0.46, p.y + s * 0.1);
    ctx.lineTo(p.x, p.y + s * 0.5);
    ctx.closePath();
    ctx.fillStyle = ink(q.color);
    ctx.fill();
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.stroke();
  }

  private stamp(ctx: CanvasRenderingContext2D, s: MapSite) {
    const { x, z } = hexToWorld(s.q, s.r);
    const p = this.project(x, z);
    const r = Math.max(2.3, Math.min(4.4, (this.px / this.span) * 0.3));
    ctx.beginPath();
    if (s.kind === 'ruin') ctx.rect(p.x - r, p.y - r, r * 2, r * 2);
    else if (s.kind === 'treasure') {
      ctx.moveTo(p.x, p.y - r * 1.2);
      ctx.lineTo(p.x + r, p.y);
      ctx.lineTo(p.x, p.y + r * 1.2);
      ctx.lineTo(p.x - r, p.y);
      ctx.closePath();
    } else if (s.kind === 'lookout') {
      ctx.moveTo(p.x, p.y - r * 1.25);
      ctx.lineTo(p.x + r, p.y + r * 0.85);
      ctx.lineTo(p.x - r, p.y + r * 0.85);
      ctx.closePath();
    } else ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#f3e2bc';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = '#5a3d28';
    ctx.stroke();
  }

  private trapezoid(ctx: CanvasRenderingContext2D, corners: readonly ({ x: number; z: number } | null)[]) {
    const pts = [];
    for (const c of corners) if (c) pts.push(this.project(c.x, c.z));
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();
    ctx.lineWidth = 1.35;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
}
