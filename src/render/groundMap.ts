import * as THREE from 'three/webgpu';
import type { TileBuild } from './tileBuilder';

// Mapa do chão visto de cima, para a luz que não vem do sol nem do céu:
//   RGB = cor do chão (terreno e água), que o chão iluminado rebate nas paredes e nas copas;
//   A = luz dos lampiões em volta das casas com janela, que acende à noite.
// Uma textura só, alinhada ao mundo, cobre o tabuleiro inteiro. Como os blocos estáticos, só
// cresce: cada peça que assenta pinta a sua parte, rasterizada na CPU a partir da geometria.

/** Lado da textura em texels e o meio-lado coberto no mundo (texel de 0,1). */
export const GROUND_SIZE = 1024;
export const GROUND_EXTENT = 51.2;
const TEXEL = (GROUND_EXTENT * 2) / GROUND_SIZE;
/** Raio da poça de luz de um lampião (desvio da gaussiana, em unidades do mundo). */
const LANTERN_SIGMA = 0.17;

const to8 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255));

export class GroundMap {
  readonly data = new Uint8Array(GROUND_SIZE * GROUND_SIZE * 4);
  readonly texture: THREE.DataTexture;
  private dirty = false;

  constructor() {
    const t = new THREE.DataTexture(this.data, GROUND_SIZE, GROUND_SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter;
    // As mipmaps borram a cor do chão: quanto mais alto o ponto, mais largo o chão que ele vê.
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    this.texture = t;
  }

  clear() {
    this.data.fill(0);
    this.dirty = true;
  }

  /** Pinta o chão e a água de uma peça já posta no mundo pela matriz `m`. */
  add(b: TileBuild, m: THREE.Matrix4, water: THREE.Color) {
    this.raster(b.pos, m, (i, out) => out.setRGB(b.col[i * 3], b.col[i * 3 + 1], b.col[i * 3 + 2]));
    // A água vista de cima: a cor do tema, mais escura que o leito (ela absorve).
    const w = water.clone().multiplyScalar(0.55);
    this.raster(b.water, m, (_, out) => out.copy(w));
    this.dirty = true;
  }

  /** Soma a poça de luz de um lampião em (x, z), com força `amp` no centro (0 a 1). */
  lantern(x: number, z: number, amp: number) {
    const cu = (x + GROUND_EXTENT) / TEXEL - 0.5, cv = (z + GROUND_EXTENT) / TEXEL - 0.5;
    const r = Math.ceil((3 * LANTERN_SIGMA) / TEXEL);
    const k = (TEXEL * TEXEL) / (2 * LANTERN_SIGMA * LANTERN_SIGMA);
    const u0 = Math.round(cu), v0 = Math.round(cv);
    for (let v = Math.max(0, v0 - r); v <= Math.min(GROUND_SIZE - 1, v0 + r); v++) {
      for (let u = Math.max(0, u0 - r); u <= Math.min(GROUND_SIZE - 1, u0 + r); u++) {
        const g = amp * Math.exp(-((u - cu) ** 2 + (v - cv) ** 2) * k);
        const i = (v * GROUND_SIZE + u) * 4 + 3;
        // Poças que se cruzam somam sem estourar: 1 − (1 − a)(1 − g).
        this.data[i] = to8(1 - (1 - this.data[i] / 255) * (1 - g));
      }
    }
    this.dirty = true;
  }

  /** Envia a textura se algo mudou (uma vez por quadro). */
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.texture.needsUpdate = true;
  }

  /**
   * Rasteriza os triângulos virados para cima (o topo da peça; as laterais ficam de fora):
   * cada texel cujo centro cai num triângulo recebe a cor interpolada dos vértices.
   */
  private raster(pos: Float32Array, m: THREE.Matrix4, colorAt: (vertex: number, out: THREE.Color) => void) {
    const e = m.elements;
    const c0 = new THREE.Color(), c1 = new THREE.Color(), c2 = new THREE.Color();
    const u = [0, 0, 0], v = [0, 0, 0];
    for (let t = 0; t < pos.length; t += 9) {
      // Normal da face no espaço da peça: a matriz só gira em torno de y, então o y vale no mundo.
      const ax = pos[t + 3] - pos[t], ay = pos[t + 4] - pos[t + 1], az = pos[t + 5] - pos[t + 2];
      const bx = pos[t + 6] - pos[t], by = pos[t + 7] - pos[t + 1], bz = pos[t + 8] - pos[t + 2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      if (ny < 0.5 * Math.hypot(nx, ny, nz)) continue;
      for (let k = 0; k < 3; k++) {
        const x = pos[t + k * 3], y = pos[t + k * 3 + 1], z = pos[t + k * 3 + 2];
        u[k] = (e[0] * x + e[4] * y + e[8] * z + e[12] + GROUND_EXTENT) / TEXEL - 0.5;
        v[k] = (e[2] * x + e[6] * y + e[10] * z + e[14] + GROUND_EXTENT) / TEXEL - 0.5;
      }
      const area = (u[1] - u[0]) * (v[2] - v[0]) - (u[2] - u[0]) * (v[1] - v[0]);
      if (Math.abs(area) < 1e-9) continue;
      const vi = t / 3;
      colorAt(vi, c0);
      colorAt(vi + 1, c1);
      colorAt(vi + 2, c2);
      const umin = Math.max(0, Math.ceil(Math.min(u[0], u[1], u[2]) - 1e-6));
      const umax = Math.min(GROUND_SIZE - 1, Math.floor(Math.max(u[0], u[1], u[2]) + 1e-6));
      const vmin = Math.max(0, Math.ceil(Math.min(v[0], v[1], v[2]) - 1e-6));
      const vmax = Math.min(GROUND_SIZE - 1, Math.floor(Math.max(v[0], v[1], v[2]) + 1e-6));
      for (let py = vmin; py <= vmax; py++) {
        for (let px = umin; px <= umax; px++) {
          // Coordenadas baricêntricas do centro do texel (com folga para não abrir frestas).
          const w1 = ((px - u[0]) * (v[2] - v[0]) - (u[2] - u[0]) * (py - v[0])) / area;
          const w2 = ((u[1] - u[0]) * (py - v[0]) - (px - u[0]) * (v[1] - v[0])) / area;
          const w0 = 1 - w1 - w2;
          if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
          const i = (py * GROUND_SIZE + px) * 4;
          this.data[i] = to8(c0.r * w0 + c1.r * w1 + c2.r * w2);
          this.data[i + 1] = to8(c0.g * w0 + c1.g * w1 + c2.g * w2);
          this.data[i + 2] = to8(c0.b * w0 + c1.b * w1 + c2.b * w2);
        }
      }
    }
  }
}

/** O mapa do tabuleiro (um só por página): o World pinta, os materiais leem. */
export const groundMap = new GroundMap();
