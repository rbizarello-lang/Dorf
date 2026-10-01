import * as THREE from 'three/webgpu';
import { mulberry32 } from '../core/rng';

// Texturas de ruído geradas em código na partida (nenhum arquivo de arte).
// São periódicas (repetem sem costura) e servem a vários shaders: sombra das nuvens,
// variação do chão, ondulação da água, estratos das laterais.

const SIZE = 256;

/** Ruído de gradiente (Perlin) periódico: período `period` células, retorna em [-1, 1] aprox. */
function perlin(period: number, seed: number) {
  const rng = mulberry32(seed);
  const gx = new Float32Array(period * period);
  const gy = new Float32Array(period * period);
  for (let i = 0; i < period * period; i++) {
    const a = rng() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x: number, y: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const dot = (ix: number, iy: number, dx: number, dy: number) => {
      const k = (((iy % period) + period) % period) * period + (((ix % period) + period) % period);
      return gx[k] * dx + gy[k] * dy;
    };
    const u = fade(fx), v = fade(fy);
    const a = dot(x0, y0, fx, fy) + (dot(x0 + 1, y0, fx - 1, fy) - dot(x0, y0, fx, fy)) * u;
    const b = dot(x0, y0 + 1, fx, fy - 1) + (dot(x0 + 1, y0 + 1, fx - 1, fy - 1) - dot(x0, y0 + 1, fx, fy - 1)) * u;
    return (a + (b - a) * v) * 1.41;
  };
}

/** Soma de oitavas periódicas sobre a textura inteira (cada oitava dobra a frequência). */
function fbm(base: number, octaves: number, seed: number) {
  const layers = Array.from({ length: octaves }, (_, o) => perlin(base << o, seed + o * 101));
  return (u: number, v: number) => {
    let s = 0, amp = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      const p = base << o;
      s += layers[o](u * p, v * p) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return s / norm;
  };
}

function dataTexture(data: Uint8Array) {
  const t = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * RGBA: R = nuvens (baixa frequência), G = manchas médias, B = detalhe fino,
 * A = fbm de 4 oitavas (uso geral). Todos em [0, 1], média ~0,5.
 */
export function makeNoiseTexture() {
  const r = fbm(4, 3, 11);
  const g = fbm(8, 3, 23);
  const b = fbm(32, 2, 37);
  const a = fbm(4, 5, 53);
  const data = new Uint8Array(SIZE * SIZE * 4);
  const to8 = (v: number) => Math.max(0, Math.min(255, Math.round((v * 0.5 + 0.5) * 255)));
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE, v = y / SIZE;
      const i = (y * SIZE + x) * 4;
      data[i] = to8(r(u, v) * 1.6);
      data[i + 1] = to8(g(u, v) * 1.6);
      data[i + 2] = to8(b(u, v) * 1.5);
      data[i + 3] = to8(a(u, v) * 1.6);
    }
  }
  return dataTexture(data);
}

/**
 * Mapa de normais periódico para a água: RG = inclinação (x, z) codificada em [0, 1],
 * B = altura, A = crista (picos finos, para brilhos e espuma).
 */
export function makeWaterTexture() {
  const h = fbm(6, 4, 71);
  const height = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) height[y * SIZE + x] = h(x / SIZE, y / SIZE);
  const at = (x: number, y: number) => height[(((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)];
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 9;
      const dz = (at(x, y + 1) - at(x, y - 1)) * 9;
      const hh = at(x, y);
      const i = (y * SIZE + x) * 4;
      data[i] = Math.round(Math.max(0, Math.min(1, dx * 0.5 + 0.5)) * 255);
      data[i + 1] = Math.round(Math.max(0, Math.min(1, dz * 0.5 + 0.5)) * 255);
      data[i + 2] = Math.round(Math.max(0, Math.min(1, hh * 0.8 + 0.5)) * 255);
      data[i + 3] = Math.round(Math.max(0, Math.min(1, (Math.abs(hh) < 0.06 ? 1 - Math.abs(hh) / 0.06 : 0))) * 255);
    }
  }
  return dataTexture(data);
}
