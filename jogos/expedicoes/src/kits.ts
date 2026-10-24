// Registro dos kits: nome -> geometria + material. A geometria é criada uma vez e dividida por todas as vistas.
import * as THREE from 'three';
import { Geo, gable } from './geo';
import * as A from './kits_a';
import * as B from './kits_b';

export interface KitDef { geo: () => THREE.BufferGeometry; mat: 'lit' | 'metal' | 'sail' | 'glow' | 'beam' | 'puff'; cap?: number; cast?: boolean; receive?: boolean }

const built = new Map<string, A.Built>();
function house(name: string, f: () => A.Built): () => THREE.BufferGeometry {
  return () => { const b = f(); built.set(name, b); return b.geo; };
}
/** Metadados (chaminé, janelas) de uma casa; constrói se ainda não existir. */
export function meta(name: string): A.Built {
  if (!built.has(name)) geoOf(name);
  return built.get(name)!;
}

const DARKW = 0x2a3b4c;

function fountainGeo(): THREE.BufferGeometry {
  return new Geo(120)
    .cyl(0.9, 0.95, 0.26, 0xb9b0a2, 14, { y: 0.13, grad: [0.72, 1] })
    .cyl(0.78, 0.78, 0.04, 0x3f7f9a, 14, { y: 0.25, grad: [1, 1] })
    .cyl(0.9, 0.9, 0.05, 0xd2c9ba, 14, { y: 0.28, grad: [1, 1] })
    .cyl(0.16, 0.22, 0.5, 0xc9c0b0, 10, { y: 0.5, grad: [0.75, 1] })
    .cyl(0.34, 0.12, 0.1, 0xd2c9ba, 12, { y: 0.78, grad: [0.85, 1] })
    .ico(0.07, 0xcfe7f2, 0, { y: 0.9, sy: 1.5, grad: [1, 1] })
    .build();
}
function clockGeo(): THREE.BufferGeometry {
  const g = new Geo(121)
    .cyl(0.55, 0.62, 0.14, 0xa59c8e, 4, { y: 0.07, ry: Math.PI / 4, grad: [0.8, 1] })
    .box(0.52, 1.5, 0.52, 0xe6dccb, { y: 0.88, grad: [0.78, 1] })
    .box(0.62, 0.1, 0.62, 0xa59c8e, { y: 1.68, grad: [1, 1] })
    .box(0.58, 0.55, 0.58, 0xe6dccb, { y: 2.0, grad: [0.9, 1] })
    .cone(0.5, 0.62, 0x9c4a30, 4, { y: 2.58, ry: Math.PI / 4, grad: [0.78, 1] })
    .cyl(0.012, 0.012, 0.3, 0xc99a3c, 4, { y: 3.02, grad: [1, 1] })
    .ico(0.045, 0xd9a840, 0, { y: 3.18, grad: [1, 1] });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
    g.cyl(0.2, 0.2, 0.03, 0xf6efdc, 14, { x: s * 0.3, y: 2.0, z: c * 0.3, rx: Math.PI / 2, ry: a, grad: [1, 1], glow: 0.5 });
    g.box(0.02, 0.15, 0.012, 0x2a2018, { x: s * 0.32, y: 2.04, z: c * 0.32, ry: a, grad: [1, 1] });
    g.box(0.12, 0.02, 0.012, 0x2a2018, { x: s * 0.32 + c * 0.05, y: 2.0, z: c * 0.32 - s * 0.05, ry: a, grad: [1, 1] });
  }
  return g.build();
}
function wellGeo(): THREE.BufferGeometry {
  return new Geo(122)
    .cyl(0.3, 0.33, 0.28, 0x9d958a, 10, { y: 0.14, grad: [0.7, 1] })
    .cyl(0.23, 0.23, 0.02, 0x2d5c78, 10, { y: 0.27, grad: [1, 1] })
    .box(0.05, 0.6, 0.05, 0x5b3b24, { x: -0.27, y: 0.55, grad: [1, 1] }).box(0.05, 0.6, 0.05, 0x5b3b24, { x: 0.27, y: 0.55, grad: [1, 1] })
    .add(gable(0.7, 0.22, 0.46), 0x9c4a30, { y: 0.82, ry: Math.PI / 2, grad: [0.8, 1] })
    .cyl(0.014, 0.014, 0.54, 0x3a2a20, 4, { y: 0.72, rz: Math.PI / 2, grad: [1, 1] }).build();
}
function millGeo(): THREE.BufferGeometry {
  return new Geo(123)
    .cyl(0.5, 0.58, 0.18, 0x8a8076, 10, { y: 0.09, grad: [0.7, 1] })
    .cyl(0.36, 0.5, 1.5, 0xf2e8d4, 10, { y: 0.93, grad: [0.78, 1] })
    .cyl(0.4, 0.4, 0.05, 0x6b4a30, 10, { y: 1.5, grad: [1, 1] })
    .cone(0.46, 0.55, 0x9c4a30, 10, { y: 1.8, grad: [0.75, 1] })
    .box(0.2, 0.36, 0.05, 0x5b3b24, { y: 0.36, z: 0.51, grad: [1, 1] })
    .box(0.14, 0.18, 0.04, DARKW, { y: 1.05, z: 0.4, grad: [1, 1], glow: 1 })
    .cyl(0.04, 0.04, 0.28, 0x3a2a20, 6, { y: 1.62, z: 0.4, rx: Math.PI / 2, grad: [1, 1] }).build();
}
function millBladesGeo(): THREE.BufferGeometry {
  const g = new Geo(124).cyl(0.07, 0.07, 0.12, 0x3a2a20, 6, { rx: Math.PI / 2, grad: [1, 1] });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    g.box(0.05, 1.35, 0.04, 0x5b3b24, { x: -s * 0.68, y: c * 0.68, rz: a, grad: [1, 1] });
    g.box(0.2, 0.82, 0.012, 0xe9dcc0, { x: -s * 0.72 + c * 0.16, y: c * 0.72 + s * 0.16, z: 0.025, rz: a, grad: [0.9, 1] });
  }
  return g.build();
}

const T = (g: () => THREE.BufferGeometry, mat: KitDef['mat'] = 'lit', o: Partial<KitDef> = {}): KitDef => ({ geo: g, mat, ...o });
const HOUSE = (name: string, f: () => A.Built, cap = 200): KitDef => ({ geo: house(name, f), mat: 'lit', cap });

export const KITS: Record<string, KitDef> = {
  // casas e construções
  capCot: HOUSE('capCot', () => A.timberHouse(11, { W: 1.0, D: 0.76, H: 0.5, RH: 0.42, wall: 0xf3e6c8, roof: 0xb5532f })),
  capHouse: HOUSE('capHouse', () => A.timberHouse(12, { W: 1.05, D: 0.82, H: 0.95, RH: 0.5, wall: 0xf5ebd2, roof: 0x8f5a3a, two: true, beams: 0x5b3b24, wing: true })),
  capHouse2: HOUSE('capHouse2', () => A.timberHouse(13, { W: 0.96, D: 0.8, H: 0.88, RH: 0.46, wall: 0xe9d9ac, roof: 0xb5532f, two: true, beams: 0x6b4a30, shut: 0x3f6e7a })),
  capCot2: HOUSE('capCot2', () => A.timberHouse(14, { W: 0.9, D: 0.7, H: 0.46, RH: 0.4, wall: 0xe8c9a0, roof: 0x9c4a30, shut: 0x3f6e7a })),
  caiA: HOUSE('caiA', () => A.caicada(15, 0)),
  caiB: HOUSE('caiB', () => A.caicada(16, 1)),
  chapel: T(() => A.chapel(17), 'lit', { cap: 20 }),
  chaletA: HOUSE('chaletA', () => A.chalet(18, false, true)),
  chaletB: HOUSE('chaletB', () => A.chalet(19, true, true)),
  chaletA0: HOUSE('chaletA0', () => A.chalet(20, false, false)),
  stiltA: HOUSE('stiltA', () => A.stilt(21, 0)),
  stiltB: HOUSE('stiltB', () => A.stilt(22, 1)),
  tower0: HOUSE('tower0', () => A.stoneTower(23, 1.35, false), 40),
  tower1: HOUSE('tower1', () => A.stoneTower(24, 1.85, false), 40),
  towerS: HOUSE('towerS', () => A.stoneTower(25, 1.6, true), 40),
  lighthouse: T(() => A.lighthouse(26), 'lit', { cap: 20 }),
  beam: T(() => A.lightBeam(), 'beam', { cap: 4, cast: false, receive: false }),
  mineMouth: T(() => A.mineMouth(27), 'lit', { cap: 10 }),
  fountain: T(fountainGeo, 'lit', { cap: 10 }),
  clock: T(clockGeo, 'lit', { cap: 10 }),
  well: T(wellGeo, 'lit', { cap: 20 }),
  mill: T(millGeo, 'lit', { cap: 10 }),
  millBlades: T(millBladesGeo, 'lit', { cap: 10 }),
  // plantas
  pine: T(() => B.pineGeo(false), 'lit', { cap: 900 }),
  pineD: T(() => B.pineGeo(false, 0x2f5a3c), 'lit', { cap: 600 }),
  pineS: T(() => B.pineGeo(true), 'lit', { cap: 900 }),
  oak: T(B.oakGeo, 'lit', { cap: 300 }),
  willow: T(B.willowGeo, 'lit', { cap: 60 }),
  dead: T(B.deadTreeGeo, 'lit', { cap: 60 }),
  reed: T(() => B.reedGeo(1), 'lit', { cap: 700, receive: false }),
  reedT: T(() => B.reedGeo(1.5), 'lit', { cap: 300, receive: false }),
  lily: T(() => B.lilyGeo(false), 'lit', { cap: 200, cast: false }),
  lilyF: T(() => B.lilyGeo(true), 'lit', { cap: 100, cast: false }),
  tuft: T(() => B.tuftGeo(0x7aa04a), 'lit', { cap: 900, cast: false }),
  tuftD: T(() => B.tuftGeo(0xb8a463), 'lit', { cap: 600, cast: false }),
  shrub: T(() => B.shrubGeo(0x58803f), 'lit', { cap: 300 }),
  bush: T(B.bushBerryGeo, 'lit', { cap: 100 }),
  rock: T(() => B.rockGeo(false), 'lit', { cap: 300 }),
  rockBig: T(() => B.rockGeo(true, 0x84807a), 'lit', { cap: 200 }),
  mound: T(B.snowMoundGeo, 'lit', { cap: 200, cast: false }),
  flower: T(B.flowerGeo, 'lit', { cap: 300, cast: false }),
  barrel: T(B.barrelGeo, 'lit', { cap: 80 }),
  crate: T(() => B.crateGeo(false), 'lit', { cap: 80 }),
  crateF: T(() => B.crateGeo(true), 'lit', { cap: 80 }),
  hay: T(B.hayGeo, 'lit', { cap: 60 }),
  fence: T(() => B.fenceGeo(), 'lit', { cap: 300 }),
  wall: T(B.wallGeo, 'lit', { cap: 200 }),
  wallS: T(B.wallSnowGeo, 'lit', { cap: 200 }),
  cobble: T(B.cobbleGeo, 'lit', { cap: 500, cast: false }),
  // bichos
  heron: T(() => B.heronGeo(0), 'lit', { cap: 20 }),
  heronA: T(() => B.heronGeo(1), 'lit', { cap: 10 }),
  heronB: T(() => B.heronGeo(2), 'lit', { cap: 10 }),
  goat: T(B.goatGeo, 'lit', { cap: 40 }),
  gull: T(() => B.gullGeo(0), 'lit', { cap: 30 }),
  gullA: T(() => B.gullGeo(1), 'lit', { cap: 30 }),
  gullB: T(() => B.gullGeo(2), 'lit', { cap: 30 }),
  birdA: T(() => B.birdGeo(true), 'lit', { cap: 30 }),
  birdB: T(() => B.birdGeo(false), 'lit', { cap: 30 }),
  sheep: T(B.sheepGeo, 'lit', { cap: 40 }),
  ox: T(B.oxGeo, 'lit', { cap: 20 }),
  wagon: T(B.wagonGeo, 'sail', { cap: 10 }),
  cart: T(B.cartGeo, 'lit', { cap: 10 }),
  rail: T(B.railGeo, 'lit', { cap: 160, cast: false }),
  // barcos
  flat: T(B.flatBoatGeo, 'lit', { cap: 20 }),
  fishB: T(() => B.fishBoatGeo(0x2d70b2, 0xf4efe4), 'lit', { cap: 20 }),
  fishR: T(() => B.fishBoatGeo(0xb5472f, 0xf0e0b8), 'lit', { cap: 20 }),
  sail: T(B.sailBoatGeo, 'sail', { cap: 20 }),
  row: T(B.rowBoatGeo, 'lit', { cap: 20 }),
  // adereços
  stallFish: T(() => B.stallGeo('fish'), 'lit', { cap: 20 }),
  stallOre: T(() => B.stallGeo('ore'), 'lit', { cap: 20 }),
  stallReed: T(() => B.stallGeo('reed'), 'lit', { cap: 20 }),
  banBrejo: T(() => B.bannerGeo(0x56733a, 0xd2b75e), 'lit', { cap: 20 }),
  banSerra: T(() => B.bannerGeo(0x56606e, 0xf3f8fc), 'lit', { cap: 20 }),
  banCosta: T(() => B.bannerGeo(0x2f78b6, 0xf4efe4), 'lit', { cap: 20 }),
  banCap: T(() => B.bannerGeo(0xb3402b, 0xc9a24a), 'lit', { cap: 20 }),
  lamp: T(B.lampPostGeo, 'lit', { cap: 60 }),
  lpost: T(B.lanternPostGeo, 'lit', { cap: 120 }),
  sign: T(B.signGeo, 'lit', { cap: 20 }),
  netrack: T(B.netRackGeo, 'lit', { cap: 20 }),
  fishrack: T(B.fishRackGeo, 'lit', { cap: 20 }),
  flake: T(B.flakeGeo, 'lit', { cap: 400, cast: false, receive: false }),
  puff: T(B.puffGeo, 'puff', { cap: 400, cast: false, receive: false }),
  lantern: T(B.lanternGeo, 'lit', { cap: 80, cast: false }),
  glow: { geo: () => new THREE.PlaneGeometry(1, 1), mat: 'glow', cap: 300, cast: false, receive: false },
};

const cache = new Map<string, THREE.BufferGeometry>();
export function geoOf(kit: string): THREE.BufferGeometry {
  let g = cache.get(kit);
  if (!g) { const d = KITS[kit]; if (!d) throw new Error('kit: ' + kit); g = d.geo(); cache.set(kit, g); }
  return g;
}
