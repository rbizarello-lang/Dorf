import type { EmblemId, FrameKind, Theme } from '../themes/types';

// Moldura e emblema do tema, desenhados em CSS e SVG. Nada de arquivo: o grão é um
// feTurbulence em data URI, e as fibras são gradientes repetidos. A paleta abaixo
// substitui painel e tinta quando o material pede (madeira escura, metal); no papel
// valem as cores do próprio tema. Tinta × painel fica em 7:1 ou mais (tests/legibility.ts).

export const FRAME_KINDS: readonly FrameKind[] = ['papel', 'pergaminho', 'papiro', 'madeira', 'seda', 'washi', 'metal', 'pedra'];

export interface FramePalette {
  panel: string;
  ink: string;
  soft: string;
  /** Acento claro: o do tema some na madeira. */
  accent?: string;
}

export const FRAME_PALETTE: Record<FrameKind, FramePalette | null> = {
  papel: null,
  // Papiro: base #efe0b4, fibras finas (o CSS).
  papiro: { panel: '#efe0b4', ink: '#3a2a14', soft: '#6b5430' },
  // Tábuas #6b4a32. O #f3e7d3 do plano fica em 6,5:1; #fff6ea chega a 7,4:1 no mesmo fundo.
  madeira: { panel: '#6b4a32', ink: '#fff6ea', soft: '#f0ddc6', accent: '#ffd98a' },
  pergaminho: { panel: '#f4e6c8', ink: '#3a2a18', soft: '#7a6248' },
  seda: { panel: '#f6efe4', ink: '#1e2624', soft: '#6a5a58' },
  washi: { panel: '#f7f3ea', ink: '#2a2824', soft: '#6e685c' },
  metal: { panel: '#2a3038', ink: '#f3efe8', soft: '#c4beb4' },
  pedra: { panel: '#e6e1d6', ink: '#2a2824', soft: '#5c584e' },
};

/** Cores que o placar realmente usa (a paleta da moldura, ou as do tema no papel). */
export function frameColors(ui: Theme['ui']): { panel: string; ink: string } {
  const p = FRAME_PALETTE[ui.frame];
  return p ? { panel: p.panel, ink: p.ink } : { panel: ui.panel, ink: ui.ink };
}

const svg = (inner: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;

/** Um traço só, na cor da tinta, para ler a 16 px. */
export const EMBLEM_SVG: Record<EmblemId, string> = {
  sol: svg('<circle cx="12" cy="12" r="3.2" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 2.2v3.2M12 18.6v3.2M2.2 12h3.2M18.6 12h3.2M5.1 5.1l2.2 2.2M16.7 16.7l2.2 2.2M18.9 5.1l-2.2 2.2M7.3 16.7l-2.2 2.2"/></g>'),
  lirio: svg('<path fill="currentColor" d="M12 21.2V14s2.6.8 4.2-1.4C17.6 10.2 15.2 6.6 12 7.2 8.8 6.6 6.4 10.2 7.8 12.6 9.4 14.8 12 14 12 14v7.2z"/><path fill="currentColor" d="M12 7.4c.4-2.6 2.2-4.8 2.2-4.8S13.2 5.2 12 7.4C10.8 5.2 9.8 2.6 9.8 2.6S11.6 4.8 12 7.4z"/>'),
  tulipa: svg('<path fill="currentColor" d="M8 10.2c0-3.2 1.6-6 4-6s4 2.8 4 6c0 2-1.2 3.6-2.4 4.2V20h-3.2v-5.6C9.2 13.8 8 12.2 8 10.2z"/><path fill="currentColor" d="M11.2 20h1.6v2h-1.6zM7.2 20h9.6v1.3H7.2z"/>'),
  ipe: svg('<g fill="currentColor"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="5.2" rx="2.1" ry="3.2"/><ellipse cx="12" cy="18.8" rx="2.1" ry="3.2"/><ellipse cx="5.2" cy="12" rx="3.2" ry="2.1"/><ellipse cx="18.8" cy="12" rx="3.2" ry="2.1"/><ellipse cx="7.1" cy="7.1" rx="2" ry="3" transform="rotate(-45 7.1 7.1)"/><ellipse cx="16.9" cy="16.9" rx="2" ry="3" transform="rotate(-45 16.9 16.9)"/><ellipse cx="16.9" cy="7.1" rx="2" ry="3" transform="rotate(45 16.9 7.1)"/><ellipse cx="7.1" cy="16.9" rx="2" ry="3" transform="rotate(45 7.1 16.9)"/></g>'),
  floco: svg('<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2.4v19.2M3.6 7.2l16.8 9.6M3.6 16.8l16.8-9.6"/><path d="M12 5.2l-1.6-2.2M12 5.2l1.6-2.2M12 18.8l-1.6 2.2M12 18.8l1.6 2.2M6.2 8.6L4 7.2M6.2 8.6L5.4 6M17.8 15.4L20 16.8M17.8 15.4l.8 2.6M6.2 15.4L4 16.8M6.2 15.4L5.4 18M17.8 8.6L20 7.2M17.8 8.6l.8-2.6"/></g>'),
  planeta: svg('<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.7"/><ellipse cx="12" cy="12" rx="10" ry="3.6" fill="none" stroke="currentColor" stroke-width="1.5" transform="rotate(-24 12 12)"/>'),
  selo: svg('<rect x="4" y="4" width="16" height="16" rx="1.2" fill="currentColor"/><rect x="7.2" y="7.2" width="9.6" height="9.6" fill="none" stroke="#f6efe4" stroke-width="1.2"/>'),
  crisantemo: svg('<g fill="currentColor"><circle cx="12" cy="12" r="2.2"/>' + Array.from({ length: 12 }, (_, i) => `<ellipse cx="12" cy="5.4" rx="1.5" ry="3.3" transform="rotate(${i * 30} 12 12)"/>`).join('') + '</g>'),
  corvo: svg('<path fill="currentColor" d="M3 15.5c3.2-1 5.4-3.6 7.2-6.2C12 6.2 14.2 3.6 18.5 3c-1.2 2.2-1 4.2-.2 5.6 1.6.4 3.2 1.6 3.2 3.4 0 2.2-2.4 3.6-4.6 3.2-1.2 2.4-3.6 3.8-6.4 3.8-3.6 0-6.2-2-7.5-3.5z"/>'),
  trigo: svg('<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 22V6"/><path d="M12 8c-2.2-.2-3.4-1.6-3.6-3.2C10.2 5 11.4 6.2 12 8zM12 8c2.2-.2 3.4-1.6 3.6-3.2C13.8 5 12.6 6.2 12 8zM12 12c-2.2-.2-3.4-1.6-3.6-3.2C10.2 9 11.4 10.2 12 12zM12 12c2.2-.2 3.4-1.6 3.6-3.2C13.8 9 12.6 10.2 12 12zM12 16c-2.2-.2-3.4-1.6-3.6-3.2C10.2 13 11.4 14.2 12 16zM12 16c2.2-.2 3.4-1.6 3.6-3.2C13.8 13 12.6 14.2 12 16z"/></g>'),
  sakura: svg('<g fill="currentColor"><circle cx="12" cy="12" r="1.7"/>' + Array.from({ length: 5 }, (_, i) => `<ellipse cx="12" cy="6.2" rx="2.3" ry="3.6" transform="rotate(${i * 72} 12 12)"/>`).join('') + '</g>'),
  caravela: svg('<path fill="currentColor" d="M4 17.5h16l-1.6 2.2H5.6z"/><path fill="currentColor" d="M11.2 16.5V5.2L4.5 16.5zM12.8 16.5V7.2l6.2 9.3z"/>'),
  estrela: svg('<path fill="currentColor" d="M12 2.4l2.4 6.2 6.6.4-5 4.2 1.7 6.4L12 16.2 6.3 19.6 8 13.2 3 9l6.6-.4z"/>'),
  condor: svg('<path fill="currentColor" d="M12 13.5c2.2-3.4 5.2-5.6 9.2-6.6-2.4 2.8-3.2 5.2-3.2 7.4 1.8.2 3.4 1.2 3.4 3 0 1.8-2 2.8-4.2 2.4-1 1.6-2.8 2.6-5.2 2.6s-4.2-1-5.2-2.6c-2.2.4-4.2-.6-4.2-2.4 0-1.8 1.6-2.8 3.4-3-.0-2.2-.8-4.6-3.2-7.4 4 1 7 3.2 9.2 6.6z"/>'),
};

/** Aplica a moldura no documento. Chamar depois de pintar as cores do tema. */
export function applyFrame(ui: Theme['ui']) {
  const root = document.documentElement;
  root.classList.add('framed');
  for (const f of FRAME_KINDS) root.classList.toggle(`frame-${f}`, f === ui.frame);
  // Oeste: o papel vira cartaz (borda dupla). Os outros papéis ficam lisos.
  root.classList.toggle('poster', ui.frame === 'papel' && ui.emblem === 'estrela');
  const pal = FRAME_PALETTE[ui.frame];
  if (pal) {
    root.style.setProperty('--panel', pal.panel);
    root.style.setProperty('--ink', pal.ink);
    root.style.setProperty('--soft', pal.soft);
    if (pal.accent) root.style.setProperty('--accent', pal.accent);
  }
  const emblem = document.getElementById('emblem');
  if (emblem) emblem.innerHTML = EMBLEM_SVG[ui.emblem];
}
