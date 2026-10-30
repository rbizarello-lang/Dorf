// Relevo com água e Fluxo, sobre o motor leve.
//
// `ReliefWorld` com `landPay = 10` é o Relevo com água do núcleo (altura por peça, degrau de 1 nível vale e rende, rio que só desce até o
// mar): conferido contra o `Game` em `verifica.ts`, jogada a jogada. Com `landPay = 0` e sem perfeito nem cerco é o FLUXO
// (docs de propostas, "Fluxo", caminho (f)): a borda de terreno comum deixa de ser exigida e de pontuar, e só rio e trilho (estritos),
// a altura e a água corrente contam. As interações entre terrenos diferentes (`synergyOf`) continuam, como "transição".
import { isSpring } from '../../../src/core/water';
import { STARTER_PROFILE, heightFit, tileProfile } from '../../../src/core/relief';
import { T, isStrict, type TileDef } from '../../../src/core/tiles';
import { BASE_CFG, STARTER_EDGES, LiteWorld, makeLTile, type LTile, type LiteCfg, type Placed, type RTile } from '../lite';
import type { Rule } from '../types';
import { WaterTracker } from '../water';

export interface ReliefCfg extends LiteCfg {
  stepPoints: number;
  fallPoints: number;
  flowPoints: number;
  seaPoints: number;
  seaTiles: number;
  /** Pontos de uma borda de terreno comum que encaixa (rio e trilho valem sempre `matchPoints`). */
  landPay: number;
  perfect: boolean;
  closed: boolean;
}

/** Os números do modo Relevo do jogo (src/core/modes.ts), sem as nascentes escondidas. */
export const RELIEF_CFG: ReliefCfg = {
  ...BASE_CFG,
  waterChance: 0.24,
  stepPoints: 3,
  fallPoints: 5,
  flowPoints: 8,
  seaPoints: 60,
  seaTiles: 2,
  landPay: BASE_CFG.matchPoints,
  perfect: true,
  closed: true,
};

export class ReliefWorld extends LiteWorld {
  private water: WaterTracker;

  constructor(seed: number, protected rc: ReliefCfg = RELIEF_CFG) {
    super(seed, rc);
    this.usePerfect = rc.perfect;
    this.useClosed = rc.closed;
    this.hasExtra = true;
    this.water = new WaterTracker(rc.flowPoints, rc.seaPoints, rc.seaTiles);
  }

  /** Altura de cada borda: o perfil do núcleo (mesma função da semente da peça), girando junto com as bordas. */
  protected decorate(def: TileDef): LTile {
    return makeLTile(def.seed, def.edges, { h: tileProfile(def.edges, def.seed).h });
  }

  protected makeStarter(seed: number): LTile {
    return makeLTile(seed, [...STARTER_EDGES], { h: [...STARTER_PROFILE.h] });
  }

  protected compat(a: RTile, i: number, b: RTile, j: number): boolean {
    return super.compat(a, i, b, j) && heightFit(a.aux.h[i], b.aux.h[j], a.edges[i]) !== 3;
  }

  protected pay(a: RTile, i: number, _b: RTile, _j: number, s: number): number {
    if (s < 1) return 0;
    return isStrict(a.edges[i]) ? this.cfg.matchPoints : this.rc.landPay;
  }

  /** Degrau de 1 nível entre terras rende (mirante) e o de rio, mais (cachoeira). */
  protected edgePts(a: RTile, i: number, b: RTile, j: number): number {
    const x = a.edges[i], y = b.edges[j];
    if (Math.abs(a.aux.h[i] - b.aux.h[j]) !== 1 || x === T.Rail || y === T.Rail) return 0;
    return this.rc.stepPoints + (x === T.Water && y === T.Water ? this.rc.fallPoints : 0);
  }

  protected extra(p: Placed, _commit: boolean): number {
    const edges = p.v.edges;
    const iw = edges.indexOf(T.Water);
    if (iw < 0) return 0;
    const level = p.v.aux.h[iw];
    const g = this.water.gain({ q: p.q, r: p.r, edges, level, spring: p.idx > 0 && isSpring(p.seed, edges, level) });
    this.exTiles += g.tiles;
    return g.pts;
  }

  protected onCommit(p: Placed): void {
    const edges = p.v.edges;
    const iw = edges.indexOf(T.Water);
    if (iw < 0) return;
    const level = p.v.aux.h[iw];
    this.water.add({ q: p.q, r: p.r, edges, level, spring: p.idx > 0 && isSpring(p.seed, edges, level) });
  }

  protected spawn(): LiteWorld {
    return new ReliefWorld(this.seed, this.rc);
  }

  protected copyInto(w: LiteWorld): void {
    super.copyInto(w);
    this.water.copyInto((w as ReliefWorld).water);
  }
}

const make = (cfg: ReliefCfg) => (seed: number) => new ReliefWorld(seed, cfg).start();

/** O Relevo com água sobre o motor leve (só para conferir contra o núcleo). */
export const relevoLite: Rule = {
  id: 'relevo-lite',
  name: 'Relevo base (motor leve)',
  blurb: 'O Relevo com água do núcleo, sem missões, eras nem sítios, reescrito no motor leve da bancada: serve para conferir o motor.',
  baseline: 'relevo-base',
  create: make(RELIEF_CFG),
};

/** Fluxo: só o caminho (rio, trilho, altura, água até o mar) pontua; a borda de terreno comum não. */
export const FLUXO_CFG: ReliefCfg = { ...RELIEF_CFG, landPay: 0, perfect: false, closed: false };

export const fluxo: Rule = {
  id: 'fluxo',
  name: 'Fluxo',
  blurb: 'A borda de terreno comum não é exigida nem paga: só o caminho conta (rio e trilho estritos, altura, água até o mar). As interações entre terrenos viram transição.',
  baseline: 'relevo-base',
  create: make(FLUXO_CFG),
};
