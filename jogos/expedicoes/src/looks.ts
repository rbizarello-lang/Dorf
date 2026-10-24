// Hora do dia (dia, entardecer, noite) e o "clima" próprio de cada vista: a mesma geometria, outra luz.
import * as THREE from 'three';

const C = (h: string): THREE.Color => new THREE.Color(h);
export const HOURS = ['dia', 'entardecer', 'noite'] as const;
export const HOUR_NAMES = ['Dia', 'Entardecer', 'Noite'];
export const VIEWS = ['mapa', 'brejo', 'serra', 'costa', 'capital'] as const;
export type ViewId = (typeof VIEWS)[number];
export const VIEW_NAMES: Record<ViewId, string> = { mapa: 'Mapa da província', brejo: 'Posto no brejo', serra: 'Posto na serra', costa: 'Posto na costa', capital: 'Capital' };

const dir = (azDeg: number, elDeg: number): THREE.Vector3 => {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
};

export interface HourLook {
  lightDir: THREE.Vector3; lightCol: THREE.Color; lightI: number;
  hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number; envI: number; exposure: number;
  night: number; dusk: number;
  /** Cor que as janelas e lanternas somam (multiplicada pelo `glow` de cada vértice). */
  glowCol: THREE.Color;
  bgShift: THREE.Color; bgMul: number; bgMix: number;
  mist: number; mistCol: THREE.Color;
}

export const HOUR_LOOKS: HourLook[] = [
  { // dia
    lightDir: dir(128, 50), lightCol: C('#fff0d4'), lightI: 3.2,
    hemiSky: C('#d4e8ff'), hemiGround: C('#8d7a58'), hemiI: 0.62, envI: 0.62, exposure: 0.95,
    night: 0, dusk: 0, glowCol: C('#000000'), bgShift: C('#000000'), bgMul: 1, bgMix: 0, mist: 0.6, mistCol: C('#f1ead8'),
  },
  { // entardecer
    lightDir: dir(24, 10), lightCol: C('#ff9648'), lightI: 3.0,
    hemiSky: C('#f4a777'), hemiGround: C('#5c4a58'), hemiI: 0.5, envI: 0.42, exposure: 1.0,
    night: 0.75, dusk: 1, glowCol: C('#9a5a22'), bgShift: C('#8a4426'), bgMul: 0.85, bgMix: 0.45, mist: 0.8, mistCol: C('#f2c3a0'),
  },
  { // noite
    lightDir: dir(318, 42), lightCol: C('#a7bcff'), lightI: 0.7,
    hemiSky: C('#243566'), hemiGround: C('#17141f'), hemiI: 0.6, envI: 0.26, exposure: 1.12,
    night: 1, dusk: 0.2, glowCol: C('#ffb15a'), bgShift: C('#1a2038'), bgMul: 0.5, bgMix: 0.7, mist: 0.7, mistCol: C('#8fa0c8'),
  },
];

export interface Mood {
  /** Multiplica a luz principal e o céu: dá a cor do lugar. */
  sun: THREE.Color; sky: THREE.Color;
  /** Fundo (centro, borda) ao meio-dia. */
  bgIn: THREE.Color; bgOut: THREE.Color;
  mist: number; exposure: number;
  /** Extensão da câmera de sombra. */
  shadow: number; center: THREE.Vector3;
}

export const MOODS: Record<ViewId, Mood> = {
  mapa: { sun: C('#fff0d6'), sky: C('#ffe9cc'), bgIn: C('#5a3f2c'), bgOut: C('#120d09'), mist: 0.2, exposure: 1.0, shadow: 14, center: new THREE.Vector3(0, 0, 0) },
  brejo: { sun: C('#f0f4c8'), sky: C('#cfe6d0'), bgIn: C('#3d4a34'), bgOut: C('#0e130d'), mist: 1.0, exposure: 0.98, shadow: 10, center: new THREE.Vector3(0, 0, 0) },
  serra: { sun: C('#e4eeff'), sky: C('#cfe0f6'), bgIn: C('#46566a'), bgOut: C('#0d1118'), mist: 0.55, exposure: 1.0, shadow: 10, center: new THREE.Vector3(0, 1, 0) },
  costa: { sun: C('#fff1d0'), sky: C('#cfe9f4'), bgIn: C('#4f6b73'), bgOut: C('#0c1316'), mist: 0.2, exposure: 0.97, shadow: 10, center: new THREE.Vector3(0, 0.6, 0) },
  capital: { sun: C('#fff0d4'), sky: C('#d8e8f8'), bgIn: C('#5c4332'), bgOut: C('#130e0a'), mist: 0.3, exposure: 0.95, shadow: 11, center: new THREE.Vector3(0, 0.4, 0) },
};
