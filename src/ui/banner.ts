// Cor da casa e brasão de quem joga (proposta 15 do docs/IDEIAS_AOE.md). A cor da casa
// troca o destaque do tema (`ui.accent`): o mesmo tom aparece no HUD, nas flâmulas dos
// marcos, nas camisas dos aldeões e nas bandeiras dos barcos. Tudo validado contra listas
// fixas antes de usar (o que vem do localStorage pode ser qualquer coisa).

import type { Theme } from '../themes/types';

/** Paleta própria, sem as 8 cores puras de outros jogos. */
export const HOUSE_COLORS = {
  anil: { name: 'Anil', hex: '#34508f' },
  carmim: { name: 'Carmim', hex: '#a8323a' },
  musgo: { name: 'Musgo', hex: '#4d7a3e' },
  acafrao: { name: 'Açafrão', hex: '#d99a1e' },
  turquesa: { name: 'Turquesa', hex: '#2a8c8c' },
  ameixa: { name: 'Ameixa', hex: '#6e3b6e' },
  ardosia: { name: 'Ardósia', hex: '#4f5a66' },
  cobre: { name: 'Cobre', hex: '#b8612e' },
} as const;
export type HouseColor = keyof typeof HOUSE_COLORS;

export const METALS = { ouro: '#d9b44a', prata: '#e8e4da' } as const;
export const ORDINARIES = { faixa: 'Faixa', pala: 'Pala', banda: 'Banda', asna: 'Asna', cruz: 'Cruz', sautor: 'Sautor' } as const;
export const CHARGES = { estrela: 'Estrela', roda: 'Roda', trigo: 'Feixe de trigo', arvore: 'Árvore', peixe: 'Peixe', torre: 'Torre' } as const;

export interface Banner {
  metal: keyof typeof METALS;
  ordinary: keyof typeof ORDINARIES;
  charge: keyof typeof CHARGES;
}

export const DEFAULT_BANNER: Banner = { metal: 'ouro', ordinary: 'asna', charge: 'estrela' };

export function validHouse(v: unknown): HouseColor | null {
  return typeof v === 'string' && Object.hasOwn(HOUSE_COLORS, v) ? (v as HouseColor) : null;
}

export function validBanner(raw: unknown): Banner {
  const b = raw as Partial<Banner> | null;
  const ok = <T extends object>(list: T, v: unknown): v is keyof T => typeof v === 'string' && Object.hasOwn(list, v);
  return {
    metal: ok(METALS, b?.metal) ? b!.metal! : DEFAULT_BANNER.metal,
    ordinary: ok(ORDINARIES, b?.ordinary) ? b!.ordinary! : DEFAULT_BANNER.ordinary,
    charge: ok(CHARGES, b?.charge) ? b!.charge! : DEFAULT_BANNER.charge,
  };
}

/** O tema com a cor da casa no lugar do destaque (sem cor escolhida, o tema fica como é). */
export function dress(t: Theme, house: HouseColor | null): Theme {
  return house ? { ...t, ui: { ...t.ui, accent: HOUSE_COLORS[house].hex } } : t;
}

const SHIELD = 'M2 2 H38 V24 C38 36 28 43 20 46 C12 43 2 36 2 24 Z';

/** Brasão em SVG (40 × 48): campo na cor da casa, peça e móvel no metal. */
export function bannerSvg(field: string, b: Banner, size = 40) {
  const m = METALS[b.metal];
  const ord: Record<Banner['ordinary'], string> = {
    faixa: '<rect x="0" y="17" width="40" height="11"/>',
    pala: '<rect x="15" y="0" width="10" height="48"/>',
    banda: '<path d="M-2 6 L6 -2 L46 38 L38 46 Z"/>',
    asna: '<path d="M0 34 L20 14 L40 34 L40 44 L20 24 L0 44 Z"/>',
    cruz: '<rect x="16" y="0" width="8" height="48"/><rect x="0" y="16" width="40" height="8"/>',
    sautor: '<path d="M-2 4 L4 -2 L42 40 L36 46 Z"/><path d="M42 4 L36 -2 L-2 40 L4 46 Z"/>',
  };
  // O móvel fica num disco do campo, para não se perder em cima da peça.
  const ch: Record<Banner['charge'], string> = {
    estrela: '<path d="M20 6 L22.4 12.6 L29.5 12.9 L24 17.3 L25.9 24 L20 20.1 L14.1 24 L16 17.3 L10.5 12.9 L17.6 12.6 Z"/>',
    roda: '<circle cx="20" cy="15" r="7" fill="none" stroke-width="2"/><path d="M20 8 V22 M13 15 H27 M15 10 L25 20 M25 10 L15 20" stroke-width="1.5"/>',
    trigo: '<path d="M20 23 V7" stroke-width="1.6"/><path d="M20 9 L16 6 M20 9 L24 6 M20 13 L15.5 10 M20 13 L24.5 10 M20 17 L15.5 14 M20 17 L24.5 14" stroke-width="1.6"/>',
    arvore: '<path d="M20 5 L27 15 L23.5 15 L28 21 L12 21 L16.5 15 L13 15 Z"/><rect x="19" y="21" width="2" height="3"/>',
    peixe: '<path d="M10 15 C14 9 22 9 26 15 C22 21 14 21 10 15 Z M26 15 L31 11 L31 19 Z"/>',
    torre: '<path d="M14 23 V10 H16 V7 H18 V10 H22 V7 H24 V10 H26 V23 Z"/>',
  };
  return `<svg viewBox="0 0 40 48" width="${size}" height="${(size * 48) / 40}" aria-hidden="true">
    <defs><clipPath id="shield-${size}"><path d="${SHIELD}"/></clipPath></defs>
    <g clip-path="url(#shield-${size})"><rect width="40" height="48" fill="${field}"/><g fill="${m}">${ord[b.ordinary]}</g></g>
    <circle cx="20" cy="15" r="9.5" fill="${field}"/>
    <g fill="${m}" stroke="${m}" stroke-linecap="round">${ch[b.charge]}</g>
    <path d="${SHIELD}" fill="none" stroke="${m}" stroke-width="2"/>
  </svg>`;
}
