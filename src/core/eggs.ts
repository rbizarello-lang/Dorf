import { DIRS, hkey, opposite } from './hex';
import { isStrict, type T } from './tiles';

// Easter eggs genéricos do tema (Theme.eggs): gatilhos puros e testáveis em Node, sem three.js nem
// DOM. O tema só escolhe o gatilho e o efeito (dado); o renderizador sabe executar cada efeito.
//
// Dois tipos de gatilho:
//   - DE PEÇA (pecas, grupo, bordas, sorte): saem só da partida (índice, bordas, semente da peça,
//     grupos de terreno). O `EggTracker` os reavalia na ordem das peças, então o replay, o desfazer
//     e o carregar do save reconstroem exatamente os mesmos ovos, sem guardar nada no save. Só estes
//     podem pôr um kit na peça (invariante 3: a peça depende de (bordas, semente, tema, opts)).
//   - DE RELÓGIO (hora, data): dependem do relógio do aparelho. São só cosméticos (evento, céu,
//     som), ficam fora do save e do replay e nunca mexem na peça nem na pontuação.

/** Bordas de terreno: o mesmo enum de `tiles.ts`. */
export type EggTerrain = T;

export type EggTrigger =
  /** A n-ésima peça colocada (a inicial é a 1ª). Com `min`, vale da n-ésima em diante. */
  | { kind: 'pecas'; n: number; min?: boolean }
  /** Um grupo do terreno chega a `min` peças (dispara na peça que o completa, uma vez por grupo). */
  | { kind: 'grupo'; terrain: EggTerrain; min: number }
  /** A peça tem entre `min` e `max` (padrão 6) bordas do terreno. Várias condições = combinação. */
  | { kind: 'bordas'; terrain: EggTerrain; min: number; max?: number }
  /** Chance rara por peça (0 a 1), sorteada só pela semente da peça e pelo ovo. */
  | { kind: 'sorte'; chance: number }
  /** Hora local do aparelho, de `from` até `to` (0 a 24; `from` > `to` atravessa a meia-noite). Cosmético. */
  | { kind: 'hora'; from: number; to: number }
  /** A data local cai em algum dos `holidays` do ovo. Cosmético. */
  | { kind: 'data' };

/** Dia do ano em que o ovo vale: `until` (opcional) estende o período até aquele dia (pode virar o ano). */
export interface Holiday {
  month: number; // 1 a 12
  day: number; // 1 a 31
  until?: { month: number; day: number };
}

/** Kits decorativos que o efeito 'kit' põe na peça (o desenho está em render/lib.ts, `eggGeometry`). */
export type EggKit = 'bulbo-dourado' | 'estela' | 'queijo' | 'menino-dique' | 'esfinge' | 'gato' | 'ibis' | 'piramide' | 'cerejeira-milenar' | 'lago-carpa' | 'gato-da-sorte' | 'profetas' | 'onca';

/** Eventos animados passageiros (render/life.ts). */
export type EggEvent =
  /** Bando de pássaros dourados que sobe em espiral do lugar da peça. */
  | 'bando-dourado'
  /** Fila de aldeões com lanterna cruzando a peça. */
  | 'procissao'
  /** Locomotiva a vapor atravessando a peça pelos trilhos, soltando fumaça. */
  | 'maria-fumaca'
  /** Balões de São João subindo devagar do foco da câmera, e a fogueira a faiscar. */
  | 'festa-junina'
  /** Bando grande de pássaros do tema (araras) levantando voo da mata. */
  | 'revoada';

/** Sons sintetizados do ovo (audio.ts, `Sfx.egg`). */
export type EggSound = 'sinos' | 'brilho' | 'coro';

export type EggEffect =
  /** Um kit decorativo na peça (determinístico pela semente). Só com gatilhos de peça. */
  | { kind: 'kit'; kit: EggKit; scale?: number; color?: string }
  /** Evento animado passageiro no lugar da peça (ou no foco da câmera, para gatilhos de relógio). */
  | { kind: 'evento'; event: EggEvent; color?: string }
  /** Tom de céu por cima da hora do dia, `seconds` de duração (padrão 20; 0 = enquanto o gatilho valer). */
  | { kind: 'ceu'; tint: string; strength?: number; seconds?: number }
  /** Um som. */
  | { kind: 'som'; sound: EggSound };

export interface EggSpec {
  id: string;
  /** Nome curto, mostrado no aviso e no Almanaque. */
  name: string;
  /** Frase do aviso quando o ovo aparece. Omitir = só o efeito, sem texto. */
  note?: string;
  /** Todos os gatilhos precisam valer (E). Gatilhos de relógio não se misturam com `kit`. */
  when: EggTrigger[];
  /** Datas do gatilho `data`. */
  holidays?: Holiday[];
  /** No máximo uma vez por partida (padrão: `pecas` e `grupo` já são únicos por natureza). */
  once?: boolean;
  effect: EggEffect[];
}

/** Hora local de 0 a 24 (com fração). */
export const hourOf = (d: Date) => d.getHours() + d.getMinutes() / 60;

/** `h` cai em [from, to)? Atravessa a meia-noite quando `from` > `to`. */
export function inHours(h: number, from: number, to: number) {
  return from <= to ? h >= from && h < to : h >= from || h < to;
}

const dayIndex = (month: number, day: number) => month * 32 + day;

/** A data (local) cai neste período? Períodos que viram o ano (dezembro a janeiro) valem. */
export function inHoliday(d: Date, h: Holiday) {
  const x = dayIndex(d.getMonth() + 1, d.getDate());
  const a = dayIndex(h.month, h.day);
  const b = h.until ? dayIndex(h.until.month, h.until.day) : a;
  return a <= b ? x >= a && x <= b : x >= a || x <= b;
}

/** Hash de 32 bits de uma semente com o texto do ovo (o mesmo ovo e a mesma peça dão sempre o mesmo número). */
export function eggRoll(seed: number, id: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const TILE_KINDS = new Set(['pecas', 'grupo', 'bordas', 'sorte']);
export const isTileTrigger = (t: EggTrigger) => TILE_KINDS.has(t.kind);
/** O ovo se decide só pela partida (nenhum gatilho de relógio)? Então pode pôr kit na peça. */
export const isTileEgg = (e: EggSpec) => e.when.length > 0 && e.when.every(isTileTrigger);
/** O ovo depende do relógio? */
export const isClockEgg = (e: EggSpec) => e.when.some((t) => t.kind === 'hora' || t.kind === 'data');

/** O que o rastreador precisa saber de cada peça, na ordem em que foram colocadas. */
export interface EggTile {
  q: number;
  r: number;
  index: number;
  /** Bordas no mundo (já giradas). */
  edges: readonly T[];
  /** Semente da decoração da peça. */
  seed: number;
}

export interface EggHit {
  egg: EggSpec;
  tile: EggTile;
}

/**
 * Avalia os gatilhos de peça, uma peça por vez e na ordem. Mantém os grupos de terreno por
 * união (as mesmas regras de `Board.computeGroups`, só que incremental), para saber a peça que
 * completa cada grupo.
 */
export class EggTracker {
  private tiles = new Map<number, EggTile>();
  private parent: number[] = [];
  /** Peças (índices) de cada grupo, pela raiz: o tamanho do grupo é o número de peças distintas. */
  private members = new Map<number, Set<number>>();
  private fired = new Set<string>();
  /** Raízes de grupo que já dispararam, por ovo (um grupo não repete o ovo ao crescer). */
  private groupsDone = new Map<string, Set<number>>();
  count = 0;

  constructor(private specs: readonly EggSpec[]) {}

  reset() {
    this.tiles.clear();
    this.parent = [];
    this.members.clear();
    this.fired.clear();
    this.groupsDone.clear();
    this.count = 0;
  }

  private find(x: number): number {
    const p = this.parent;
    while (p[x] !== x) {
      p[x] = p[p[x]];
      x = p[x];
    }
    return x;
  }

  private union(a: number, b: number) {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    this.parent[ra] = rb;
    const from = this.members.get(ra)!, into = this.members.get(rb)!;
    for (const i of from) into.add(i);
    this.members.delete(ra);
    // Dois grupos que se fundem: se um deles já tinha disparado o ovo, o grupo novo não dispara de novo.
    for (const done of this.groupsDone.values()) {
      if (done.delete(ra) || done.has(rb)) done.add(rb);
    }
  }

  /** Registra a próxima peça (índice = `count`) e devolve os ovos de peça que ela dispara. */
  add(t: EggTile): EggHit[] {
    if (t.index !== this.count) throw new Error(`EggTracker: esperava a peça ${this.count}, veio ${t.index}`);
    this.count++;
    this.tiles.set(hkey(t.q, t.r), t);
    for (let s = 0; s < 6; s++) {
      this.parent[t.index * 6 + s] = t.index * 6 + s;
      this.members.set(t.index * 6 + s, new Set([t.index]));
    }
    for (let s = 0; s < 6; s++) {
      const terr = t.edges[s];
      if (isStrict(terr)) {
        for (let s2 = s + 1; s2 < 6; s2++) if (t.edges[s2] === terr) this.union(t.index * 6 + s, t.index * 6 + s2);
      } else if (t.edges[(s + 1) % 6] === terr) this.union(t.index * 6 + s, t.index * 6 + ((s + 1) % 6));
      const nb = this.tiles.get(hkey(t.q + DIRS[s][0], t.r + DIRS[s][1]));
      if (nb && nb !== t && nb.edges[opposite(s)] === terr) this.union(t.index * 6 + s, nb.index * 6 + opposite(s));
    }
    const hits: EggHit[] = [];
    for (const egg of this.specs) {
      if (!isTileEgg(egg) || (egg.once && this.fired.has(egg.id))) continue;
      if (this.holds(egg, t)) {
        this.fired.add(egg.id);
        hits.push({ egg, tile: t });
      }
    }
    return hits;
  }

  private holds(egg: EggSpec, t: EggTile): boolean {
    let groupRoot = -1;
    for (const w of egg.when) {
      if (w.kind === 'pecas') {
        if (w.min ? t.index + 1 < w.n : t.index + 1 !== w.n) return false;
      } else if (w.kind === 'bordas') {
        let n = 0;
        for (const e of t.edges) if (e === w.terrain) n++;
        if (n < w.min || n > (w.max ?? 6)) return false;
      } else if (w.kind === 'sorte') {
        if (eggRoll(t.seed, egg.id) >= w.chance) return false;
      } else if (w.kind === 'grupo') {
        // Algum setor desta peça de `terrain` num grupo que chegou a `min` peças agora (e ainda não disparou).
        let ok = -1;
        for (let s = 0; s < 6; s++) {
          if (t.edges[s] !== w.terrain) continue;
          const root = this.find(t.index * 6 + s);
          if (this.groupsDone.get(egg.id)?.has(root)) continue;
          if ((this.members.get(root)?.size ?? 0) >= w.min) {
            ok = root;
            break;
          }
        }
        if (ok < 0) return false;
        groupRoot = ok;
      }
    }
    if (groupRoot >= 0) {
      let set = this.groupsDone.get(egg.id);
      if (!set) this.groupsDone.set(egg.id, (set = new Set()));
      set.add(groupRoot);
    }
    return true;
  }
}

/** Ovos de relógio que valem agora: todos os gatilhos de hora e data (e `pecas` com `min`, pelo total de peças). */
export function clockEggs(specs: readonly EggSpec[], now: Date, tiles: number): EggSpec[] {
  const out: EggSpec[] = [];
  for (const egg of specs) {
    if (!isClockEgg(egg)) continue;
    let ok = true;
    for (const w of egg.when) {
      if (w.kind === 'hora') ok = ok && inHours(hourOf(now), w.from, w.to);
      else if (w.kind === 'data') ok = ok && (egg.holidays ?? []).some((h) => inHoliday(now, h));
      else if (w.kind === 'pecas') ok = ok && (w.min ? tiles >= w.n : tiles === w.n);
      else ok = false; // gatilhos de peça não se misturam com o relógio
    }
    if (ok) out.push(egg);
  }
  return out;
}

/** Período do dia para a fauna e os ovos: dia (amanhecer a pleno dia), tarde (hora dourada e entardecer) e noite. */
export type DayPhase = 'dia' | 'tarde' | 'noite';

/** Fase do dia a partir da hora do jogo (`TimeOfDay` do World). */
export function phaseOfTod(tod: string): DayPhase {
  return tod === 'golden' || tod === 'dusk' ? 'tarde' : tod === 'night' ? 'noite' : 'dia';
}
