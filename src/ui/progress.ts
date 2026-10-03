import type { Board } from '../core/board';
import type { SiteKind } from '../core/sites';
import { SPECIAL_KINDS, type SpecialKind } from '../core/specials';

// Progresso entre partidas, guardado no navegador: totais que liberam as peças especiais e o
// registro de cada tema (o almanaque lê daqui). Uma partida entra nos totais uma vez só, ao
// acabar ou ao ser trocada por outra; as liberações valem já durante a partida, para a próxima.

export const SPECIAL_NAME: Record<SpecialKind, string> = { station: 'Estação', watermill: "Moinho d'água", lighthouse: 'Farol' };

type Counted = 'quests' | 'synergies' | 'sites';
/** O que libera cada peça especial (total somado de todas as partidas). */
export const UNLOCKS: Record<SpecialKind, { what: Counted; need: number; label: string }> = {
  station: { what: 'quests', need: 8, label: 'missões cumpridas' },
  watermill: { what: 'synergies', need: 30, label: 'interações' },
  lighthouse: { what: 'sites', need: 6, label: 'sítios descobertos' },
};

const SITE_KINDS: readonly SiteKind[] = ['ruin', 'treasure', 'relic', 'lookout'];

export interface Totals {
  games: number;
  tiles: number;
  quests: number;
  synergies: number;
  sites: number;
  perfects: number;
  wonders: number;
}

export interface ThemeRecord {
  games: number;
  /** Maior era alcançada (0 a 3). */
  era: number;
  wonder: boolean;
}

export interface ProgressData {
  totals: Totals;
  siteKinds: Record<SiteKind, number>;
  specialsPlaced: Record<SpecialKind, number>;
  themes: Record<string, ThemeRecord>;
  unlocked: SpecialKind[];
}

interface Store {
  get(k: string): string | null;
  set(k: string, v: string | null): void;
}

const zero = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
const nat = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);

function empty(): ProgressData {
  return {
    totals: { games: 0, tiles: 0, quests: 0, synergies: 0, sites: 0, perfects: 0, wonders: 0 },
    siteKinds: zero(SITE_KINDS),
    specialsPlaced: zero(SPECIAL_KINDS),
    themes: {},
    unlocked: [],
  };
}

/** Lê o que veio do armazenamento campo a campo, contra listas fixas; o que não confere vira zero. */
function sanitize(raw: unknown, themeIds: readonly string[]): ProgressData {
  const d = empty();
  const r = (raw ?? {}) as { totals?: Record<string, unknown>; siteKinds?: Record<string, unknown>; specialsPlaced?: Record<string, unknown>; themes?: Record<string, unknown>; unlocked?: unknown };
  for (const k of Object.keys(d.totals) as (keyof Totals)[]) d.totals[k] = nat(r.totals?.[k]);
  for (const k of SITE_KINDS) d.siteKinds[k] = nat(r.siteKinds?.[k]);
  for (const k of SPECIAL_KINDS) d.specialsPlaced[k] = nat(r.specialsPlaced?.[k]);
  for (const id of themeIds) {
    const t = r.themes?.[id] as Partial<ThemeRecord> | undefined;
    if (t) d.themes[id] = { games: nat(t.games), era: Math.min(3, nat(t.era)), wonder: t.wonder === true };
  }
  const un = r.unlocked;
  if (Array.isArray(un)) d.unlocked = SPECIAL_KINDS.filter((k) => un.includes(k));
  return d;
}

/** Contagens de uma partida, tiradas do tabuleiro (a peça inicial não conta). */
function countBoard(b: Board, wonderDone: boolean) {
  const siteKinds = zero(SITE_KINDS);
  for (const s of b.sites) if (s.found) siteKinds[s.kind]++;
  const specialsPlaced = zero(SPECIAL_KINDS);
  for (const t of b.list) if (t.def.special) specialsPlaced[t.def.special]++;
  return {
    totals: {
      games: 1,
      tiles: b.list.length - 1,
      quests: b.questsCompleted,
      synergies: Object.values(b.synergyCount).reduce((a, c) => a + c, 0),
      sites: b.sites.filter((s) => s.found).length,
      perfects: b.perfects,
      wonders: wonderDone ? 1 : 0,
    },
    siteKinds,
    specialsPlaced,
  };
}

export class Progress {
  data: ProgressData;

  constructor(
    private store: Store,
    themeIds: readonly string[],
  ) {
    let raw: unknown = null;
    try {
      raw = JSON.parse(store.get('progress') ?? 'null');
    } catch {
      /* ilegível: começa do zero */
    }
    this.data = sanitize(raw, themeIds);
  }

  private save() {
    this.store.set('progress', JSON.stringify(this.data));
  }

  /** Peças liberadas, na ordem fixa. */
  get unlocked(): SpecialKind[] {
    return SPECIAL_KINDS.filter((k) => this.data.unlocked.includes(k));
  }

  /**
   * Libera as peças cujo total (o guardado mais a partida em andamento) chegou à meta.
   * Devolve as recém-liberadas, para avisar na hora.
   */
  unlockLive(b: Board): SpecialKind[] {
    const cur = countBoard(b, false).totals;
    const fresh: SpecialKind[] = [];
    for (const k of SPECIAL_KINDS) {
      const u = UNLOCKS[k];
      if (!this.data.unlocked.includes(k) && this.data.totals[u.what] + cur[u.what] >= u.need) {
        this.data.unlocked.push(k);
        fresh.push(k);
      }
    }
    if (fresh.length) this.save();
    return fresh;
  }

  /** Soma a partida aos totais e ao registro do tema (uma vez por partida). */
  commit(b: Board, themeId: string, wonderDone: boolean): SpecialKind[] {
    const fresh = this.unlockLive(b);
    const c = countBoard(b, wonderDone);
    for (const k of Object.keys(c.totals) as (keyof Totals)[]) this.data.totals[k] += c.totals[k];
    for (const k of SITE_KINDS) this.data.siteKinds[k] += c.siteKinds[k];
    for (const k of SPECIAL_KINDS) this.data.specialsPlaced[k] += c.specialsPlaced[k];
    const t = (this.data.themes[themeId] ??= { games: 0, era: 0, wonder: false });
    t.games++;
    t.era = Math.max(t.era, b.era);
    t.wonder ||= wonderDone;
    this.save();
    return fresh;
  }

  /** As peças ainda presas e quanto falta para cada uma (com a partida em andamento, se houver). */
  pending(b: Board | null): { kind: SpecialKind; have: number; need: number; label: string }[] {
    const cur = b ? countBoard(b, false).totals : null;
    return SPECIAL_KINDS.filter((k) => !this.data.unlocked.includes(k)).map((k) => {
      const u = UNLOCKS[k];
      return { kind: k, have: Math.min(u.need, this.data.totals[u.what] + (cur?.[u.what] ?? 0)), need: u.need, label: u.label };
    });
  }
}
