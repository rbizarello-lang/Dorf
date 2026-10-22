import { DIRS, hkey, opposite } from './hex';
import { DEFAULT_RULES, type Board, type Rules } from './board';
import { dailyDate } from './modes';
import { T } from './tiles';

// Texto de compartilhar do Desafio do dia. Puro: sem DOM, sem three.js.

const EMOJI: Record<T, string> = {
  [T.Grass]: '🌿',
  [T.Forest]: '🌲',
  [T.Field]: '🌾',
  [T.Village]: '🏘',
  [T.Water]: '🌊',
  [T.Rail]: '🚂',
};

/** Pontos de borda encaixada por terreno (cada par de bordas iguais conta uma vez), do maior para o menor. */
export function terrainPoints(board: Board, rules: Pick<Rules, 'matchPoints' | 'matchBonus'> = DEFAULT_RULES): [T, number][] {
  const sum = new Map<T, number>();
  for (const p of board.list) {
    DIRS.forEach(([dq, dr], i) => {
      const n = board.tiles.get(hkey(p.q + dq, p.r + dr));
      if (!n || n.index < p.index || n.edges[opposite(i)] !== p.edges[i]) return;
      const t = p.edges[i];
      sum.set(t, (sum.get(t) ?? 0) + rules.matchPoints + (rules.matchBonus[t] ?? 0));
    });
  }
  return [...sum].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
}

/** Milhar com ponto, igual em qualquer ambiente (o `toLocaleString` depende do ICU). */
const thousands = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** `Retalhos 14/10 · 1.240 · 🌲🌾🏘`: o dia sai da semente do desafio. */
export function shareLine(seed: number, score: number, top: readonly T[]): string {
  const dt = dailyDate(seed);
  const day = dt ? `${String(dt.d).padStart(2, '0')}/${String(dt.m).padStart(2, '0')}` : `#${seed}`;
  const icons = top.slice(0, 3).map((t) => EMOJI[t]).join('');
  return `Retalhos ${day} · ${thousands(score)}${icons ? ` · ${icons}` : ''}`;
}

/** Link que reproduz o desafio: o modo e a semente do dia (quem abre outro dia ainda joga o mesmo). */
export const shareUrl = (base: string, seed: number) => `${base}?mode=diario&seed=${seed}`;
