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

/** Resolução do volume de cáusticas: lado (x, z) e quadros do ciclo de tempo. */
export const CAUSTIC_SIZE = 128;
export const CAUSTIC_FRAMES = 32;

/**
 * Cáusticas: a luz do sol refratada por uma superfície ondulada e concentrada no fundo.
 * Um campo de ondas periódico no espaço (repete sem costura) e no tempo (o ciclo fecha)
 * desvia fótons de uma grade regular; onde a superfície focaliza, os fótons se juntam
 * nas linhas brilhantes típicas. São `F` quadros de lado `S`, um byte por texel:
 * valor × 4 = intensidade relativa (média 1).
 *
 * Autossuficiente de propósito (nada de fora, nem o mulberry32 do core): o texto da função
 * vira o código de um Web Worker, então o cálculo (~150 ms) não pesa na abertura do jogo.
 */
function causticVolume(S: number, F: number, seed: number): Uint8Array {
  let st = seed >>> 0;
  const rng = () => {
    st = (st + 0x6d2b79f5) >>> 0;
    let t = st;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = new Uint8Array(S * S * F);
  const G = S * 2; // fótons por lado
  const TAU = Math.PI * 2;
  // Vetores de onda inteiros (periódicos na textura) e frequências inteiras no ciclo.
  // As direções se espalham pelo círculo (sem direção dominante, que daria listras);
  // amplitude ∝ 1/k²: todas as escalas curvam a superfície por igual.
  const NW = 12;
  const waves: { kx: number; ky: number; a: number; n: number; ph: number }[] = [];
  for (let w = 0; w < NW; w++) {
    const ang = ((w + rng() * 0.8) / NW) * TAU;
    const k = 3 + rng() * 3.5;
    const kx = Math.round(Math.cos(ang) * k), ky = Math.round(Math.sin(ang) * k);
    waves.push({ kx, ky, a: 1 / (kx * kx + ky * ky), n: rng() < 0.75 ? 1 : 2, ph: rng() * TAU });
  }
  // Tabelas separáveis: sen/cos(2π·kx·i/S) por onda; o termo em y (com a fase do quadro) é refeito por quadro.
  const cx = waves.map((w) => Float64Array.from({ length: S }, (_, i) => Math.cos((TAU * w.kx * i) / S)));
  const sx = waves.map((w) => Float64Array.from({ length: S }, (_, i) => Math.sin((TAU * w.kx * i) / S)));
  const gx = new Float32Array(S * S), gy = new Float32Array(S * S);
  const acc = new Float32Array(S * S);
  // Força do foco: escolhida para as dobras (linhas) aparecerem sem virar só ruído.
  let focus = 0;
  for (let f = 0; f < F; f++) {
    gx.fill(0);
    gy.fill(0);
    waves.forEach((w, k) => {
      const amp = w.a * TAU;
      for (let j = 0; j < S; j++) {
        const b = (TAU * w.ky * j) / S + w.ph - (TAU * w.n * f) / F;
        const cb = Math.cos(b), sb = Math.sin(b);
        const row = j * S;
        for (let i = 0; i < S; i++) {
          // ∂/∂(x, y) de a·cos(A + B) = −a·sen(A + B)·2π·(kx, ky)
          const s = (sx[k][i] * cb + cx[k][i] * sb) * amp;
          gx[row + i] -= s * w.kx;
          gy[row + i] -= s * w.ky;
        }
      }
    });
    if (f === 0) {
      // Curvatura média (divergência da inclinação) do primeiro quadro, para normalizar o foco.
      let sum = 0;
      for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
          const d = (gx[j * S + ((i + 1) % S)] - gx[j * S + ((i + S - 1) % S)] + gy[((j + 1) % S) * S + i] - gy[((j + S - 1) % S) * S + i]) * (S / 2);
          sum += d * d;
        }
      }
      focus = 0.85 / Math.sqrt(sum / (S * S));
    }
    acc.fill(0);
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        // Inclinação no fóton (bilinear na grade de texels) e o desvio da refração.
        const u = ((i + 0.5) / G) * S - 0.5, v = ((j + 0.5) / G) * S - 0.5;
        const i0 = Math.floor(u), j0 = Math.floor(v);
        const fu = u - i0, fv = v - j0;
        const a0 = ((j0 + S) % S) * S, a1 = ((j0 + 1) % S) * S;
        const b0 = (i0 + S) % S, b1 = (i0 + 1) % S;
        const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
        const dx = gx[a0 + b0] * w00 + gx[a0 + b1] * w10 + gx[a1 + b0] * w01 + gx[a1 + b1] * w11;
        const dy = gy[a0 + b0] * w00 + gy[a0 + b1] * w10 + gy[a1 + b0] * w01 + gy[a1 + b1] * w11;
        // Onde cai o fóton (em texels), espalhado bilinearmente nos 4 vizinhos.
        const x = u + dx * focus * S, y = v + dy * focus * S;
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const px = x - x0, py = y - y0;
        const r0 = (((y0 % S) + S) % S) * S, r1 = ((((y0 + 1) % S) + S) % S) * S;
        const c0 = ((x0 % S) + S) % S, c1 = (((x0 + 1) % S) + S) % S;
        acc[r0 + c0] += (1 - px) * (1 - py);
        acc[r0 + c1] += px * (1 - py);
        acc[r1 + c0] += (1 - px) * py;
        acc[r1 + c1] += px * py;
      }
    }
    // Média 1, um borrão leve [1 2 1] (tira o serrilhado das dobras) e 8 bits (× 64).
    const norm = (S * S) / (G * G) / 16;
    const base = f * S * S;
    for (let j = 0; j < S; j++) {
      const jm = ((j + S - 1) % S) * S, j0 = j * S, jp = ((j + 1) % S) * S;
      for (let i = 0; i < S; i++) {
        const im = (i + S - 1) % S, ip = (i + 1) % S;
        const b = acc[jm + im] + 2 * acc[jm + i] + acc[jm + ip] + 2 * (acc[j0 + im] + 2 * acc[j0 + i] + acc[j0 + ip]) + acc[jp + im] + 2 * acc[jp + i] + acc[jp + ip];
        out[base + j0 + i] = Math.min(255, Math.round(b * norm * 64));
      }
    }
  }
  return out;
}

const CAUSTIC_SEED = 97;

/** O volume inteiro, na hora (scripts e testes). */
export function makeCausticData(): Uint8Array {
  return causticVolume(CAUSTIC_SIZE, CAUSTIC_FRAMES, CAUSTIC_SEED);
}

/**
 * Quadros das cáusticas para o shader, um por camada (o shader interpola no tempo). Nasce
 * neutro (intensidade 1 em tudo, ou seja, sem cáusticas) e recebe os quadros quando o Web
 * Worker termina; sem worker, calcula na thread principal logo depois da abertura. Camadas
 * em vez de uma textura 3D: o WebGPU envia o volume fatia por fatia, e em alguns drivers
 * cada envio parcial de uma textura 3D falha.
 */
export function makeCausticTexture() {
  const data = new Uint8Array(CAUSTIC_SIZE * CAUSTIC_SIZE * CAUSTIC_FRAMES).fill(64);
  const t = new THREE.DataArrayTexture(data, CAUSTIC_SIZE, CAUSTIC_SIZE, CAUSTIC_FRAMES);
  t.format = THREE.RedFormat;
  t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  const done = (d: Uint8Array) => {
    data.set(d);
    t.needsUpdate = true;
  };
  const args = [CAUSTIC_SIZE, CAUSTIC_FRAMES, CAUSTIC_SEED];
  try {
    const src = `const causticVolume = ${causticVolume.toString()};\nonmessage = (e) => { const d = causticVolume(...e.data); postMessage(d, [d.buffer]); };`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = (e: MessageEvent<Uint8Array>) => {
      done(e.data);
      w.terminate();
      URL.revokeObjectURL(url);
    };
    w.onerror = () => {
      w.terminate();
      setTimeout(() => done(makeCausticData()), 0);
    };
    w.postMessage(args);
  } catch {
    setTimeout(() => done(makeCausticData()), 0);
  }
  return t;
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
