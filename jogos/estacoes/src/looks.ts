// A MESMA geometria com a paleta trocando: cada estação e cada hora são só números e cores.
// O mundo interpola entre dois "looks" e reaplica nos pools instanciados.
import * as THREE from 'three';

const C = (h: string): THREE.Color => new THREE.Color(h);

export const SEASONS = ['primavera', 'verao', 'outono', 'inverno'] as const;
export const HOURS = ['manha', 'tarde', 'entardecer', 'noite'] as const;

export interface SeasonLook {
  grassA: THREE.Color; grassB: THREE.Color; soil: THREE.Color; path: THREE.Color; wet: THREE.Color; forest: THREE.Color;
  snow: number;
  leaf0: THREE.Color; leaf1: THREE.Color; leaf2: THREE.Color; canopy: number; blossom: number;
  pine: THREE.Color;
  wheat: THREE.Color; wheatH: number; wheatW: number;
  flowers: number; pumpkin: number; hay: number; apples: number; appleCol: THREE.Color; lamb: number;
  water: THREE.Color; rough: number; ice: number;
  smoke: number;
  fallA: THREE.Color; fallB: THREE.Color; fallC: THREE.Color; fallSize: number; fallCount: number; fallSpeed: number; fallSway: number;
  mist: number; birds: number; cloud: number; cloudCol: THREE.Color;
  sunK: number; elev: number; festival: number; fireflies: number; wind: number;
  fence: THREE.Color; rock: number;
}

export const SEASON_LOOKS: SeasonLook[] = [
  { // primavera: verde-claro, flores, árvores em botão
    grassA: C('#9bd062'), grassB: C('#72b34c'), soil: C('#6d4b2e'), path: C('#cdb07c'), wet: C('#52402b'), forest: C('#6a9a46'),
    snow: 0,
    leaf0: C('#b4dc72'), leaf1: C('#cfe57c'), leaf2: C('#9ad06a'), canopy: 0.66, blossom: 1,
    pine: C('#6fae6a'),
    wheat: C('#86c552'), wheatH: 0.34, wheatW: 0.85,
    flowers: 1, pumpkin: 0, hay: 0, apples: 0, appleCol: C('#a9c75a'), lamb: 0.55,
    water: C('#68b9cc'), rough: 0.14, ice: 0,
    smoke: 0.42,
    fallA: C('#f7bcd2'), fallB: C('#ffe6ee'), fallC: C('#f3a6c0'), fallSize: 0.05, fallCount: 0.5, fallSpeed: 0.2, fallSway: 0.5,
    mist: 0.25, birds: 1, cloud: 0.55, cloudCol: C('#ffffff'),
    sunK: 1, elev: 0, festival: 0, fireflies: 0.35, wind: 0.6,
    fence: C('#a07c52'), rock: 0,
  },
  { // verão: trigo dourado alto, céu limpo, lago brilhante
    grassA: C('#82b53f'), grassB: C('#5a9534'), soil: C('#8d6b32'), path: C('#d6b985'), wet: C('#5d4932'), forest: C('#437a2d'),
    snow: 0,
    leaf0: C('#4a9a3c'), leaf1: C('#368538'), leaf2: C('#62a843'), canopy: 1, blossom: 0,
    pine: C('#4f9455'),
    wheat: C('#e7b73c'), wheatH: 1, wheatW: 1,
    flowers: 0.6, pumpkin: 0, hay: 0, apples: 0.7, appleCol: C('#b9cf52'), lamb: 0.8,
    water: C('#27b4d8'), rough: 0.05, ice: 0,
    smoke: 0.18,
    fallA: C('#ffffff'), fallB: C('#ffffff'), fallC: C('#ffffff'), fallSize: 0.03, fallCount: 0, fallSpeed: 0.1, fallSway: 0.3,
    mist: 0, birds: 0.85, cloud: 0.3, cloudCol: C('#ffffff'),
    sunK: 1.2, elev: 12, festival: 0, fireflies: 1, wind: 0.8,
    fence: C('#a9824f'), rock: 0,
  },
  { // outono: folhas laranja caindo, abóboras, fardos, névoa leve
    grassA: C('#a89a3e'), grassB: C('#8c5d2c'), soil: C('#8a6a3c'), path: C('#bb9663'), wet: C('#4e3b2a'), forest: C('#8a6030'),
    snow: 0,
    leaf0: C('#e5842a'), leaf1: C('#cc4c25'), leaf2: C('#e8b83c'), canopy: 0.92, blossom: 0,
    pine: C('#5a8a52'),
    wheat: C('#c9a45a'), wheatH: 0.16, wheatW: 1,
    flowers: 0, pumpkin: 1, hay: 1, apples: 1, appleCol: C('#d63a2a'), lamb: 0.95,
    water: C('#5f8f98'), rough: 0.12, ice: 0,
    smoke: 0.62,
    fallA: C('#e8792a'), fallB: C('#c9402a'), fallC: C('#e9b53a'), fallSize: 0.075, fallCount: 0.85, fallSpeed: 0.3, fallSway: 1,
    mist: 1, birds: 0.6, cloud: 0.8, cloudCol: C('#ddd6cf'),
    sunK: 0.95, elev: -2, festival: 0, fireflies: 0.05, wind: 1,
    fence: C('#8f6a45'), rock: 0,
  },
  { // inverno: neve, lago congelado, fumaça forte, janelas acesas
    grassA: C('#a8b8a6'), grassB: C('#93a595'), soil: C('#8a7a6c'), path: C('#b4a595'), wet: C('#5b4f45'), forest: C('#98a398'),
    snow: 1,
    leaf0: C('#dfe7ec'), leaf1: C('#cfdae2'), leaf2: C('#e8eef2'), canopy: 0.2, blossom: 0,
    pine: C('#bfd2c8'),
    wheat: C('#eef3f6'), wheatH: 0, wheatW: 1,
    flowers: 0, pumpkin: 0, hay: 0.9, apples: 0, appleCol: C('#d63a2a'), lamb: 1,
    water: C('#36607f'), rough: 0.2, ice: 1,
    smoke: 1,
    fallA: C('#ffffff'), fallB: C('#eef4ff'), fallC: C('#ffffff'), fallSize: 0.04, fallCount: 1, fallSpeed: 0.42, fallSway: 0.28,
    mist: 0.45, birds: 0.25, cloud: 0.75, cloudCol: C('#d3dae2'),
    sunK: 0.82, elev: -10, festival: 1, fireflies: 0, wind: 0.5,
    fence: C('#dde5ea'), rock: 0.65,
  },
];

export interface HourLook {
  /** Direção da luz principal (do chão para o sol ou a lua). */
  lightDir: THREE.Vector3; lightCol: THREE.Color; lightI: number;
  hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number; envI: number; exposure: number;
  /** Quanto as janelas e lampiões estão acesos (0 a 1). */
  night: number;
  sunDir: THREE.Vector3; sunVis: number; sunCol: THREE.Color;
  moonDir: THREE.Vector3; moonVis: number;
  bgIn: THREE.Color; bgOut: THREE.Color;
  mist: number; mistCol: THREE.Color; dusk: number;
}

const dir = (azDeg: number, elDeg: number): THREE.Vector3 => {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
};

export const HOUR_LOOKS: HourLook[] = [
  { // manhã
    lightDir: dir(155, 26), lightCol: C('#ffd7a3'), lightI: 2.7,
    hemiSky: C('#cfe3ff'), hemiGround: C('#8f7b5c'), hemiI: 0.55, envI: 0.55, exposure: 0.94,
    night: 0, sunDir: dir(155, 26), sunVis: 1, sunCol: C('#ffcf8a'), moonDir: dir(330, -12), moonVis: 0,
    bgIn: C('#6a4a36'), bgOut: C('#150f0b'), mist: 1, mistCol: C('#f1ead8'), dusk: 0.3,
  },
  { // tarde
    lightDir: dir(130, 56), lightCol: C('#fff1d6'), lightI: 3.3,
    hemiSky: C('#d4e8ff'), hemiGround: C('#8d7a58'), hemiI: 0.62, envI: 0.62, exposure: 0.92,
    night: 0, sunDir: dir(130, 56), sunVis: 1, sunCol: C('#fff4cf'), moonDir: dir(330, -12), moonVis: 0,
    bgIn: C('#5c4332'), bgOut: C('#130e0a'), mist: 0.1, mistCol: C('#f4f1e6'), dusk: 0,
  },
  { // entardecer
    lightDir: dir(18, 9), lightCol: C('#ff9648'), lightI: 2.9,
    hemiSky: C('#f4a777'), hemiGround: C('#5c4a58'), hemiI: 0.5, envI: 0.42, exposure: 1.0,
    night: 0.82, sunDir: dir(18, 9), sunVis: 1, sunCol: C('#ff7a30'), moonDir: dir(215, -4), moonVis: 0.15,
    bgIn: C('#8a4426'), bgOut: C('#1a0d0a'), mist: 0.35, mistCol: C('#f2c3a0'), dusk: 1,
  },
  { // noite
    lightDir: dir(318, 40), lightCol: C('#a7bcff'), lightI: 0.62,
    hemiSky: C('#243566'), hemiGround: C('#17141f'), hemiI: 0.55, envI: 0.24, exposure: 1.12,
    night: 1, sunDir: dir(18, -16), sunVis: 0, sunCol: C('#ff7a30'), moonDir: dir(318, 40), moonVis: 1,
    bgIn: C('#202a45'), bgOut: C('#07080d'), mist: 0.3, mistCol: C('#8fa0c8'), dusk: 0.2,
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Bag = Record<string, any>;

export function cloneLook<T extends object>(l: T): T {
  const o: Bag = {};
  for (const [k, v] of Object.entries(l as Bag)) o[k] = typeof v === 'number' ? v : v.clone();
  return o as T;
}

/** Interpola número a número, cor a cor, vetor a vetor. */
export function lerpLook<T extends object>(out: T, a: T, b: T, t: number): void {
  const o = out as Bag, A = a as Bag, B = b as Bag;
  for (const k in A) {
    const va = A[k];
    if (typeof va === 'number') o[k] = va + (B[k] - va) * t;
    else if (va.isColor) o[k].lerpColors(va, B[k], t);
    else if (va.isVector3) { o[k].lerpVectors(va, B[k], t); o[k].normalize(); }
  }
}

export const SEASON_NAMES = ['Primavera', 'Verão', 'Outono', 'Inverno'];
export const HOUR_NAMES = ['Manhã', 'Tarde', 'Entardecer', 'Noite'];
