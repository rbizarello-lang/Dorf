import * as THREE from 'three/webgpu';
import { INR, hexToWorld } from '../core/hex';
import { GROUND_EXTENT } from './groundMap';

// Distância de cada ponto do chão até a peça mais próxima, para o mar e a areia em volta do
// tabuleiro (surround do tema, ver `makeVoidMaterial`). Uma textura de um canal só, alinhada
// ao mundo como o `groundMap`: 0 = em cima de uma peça, 1 = DMAX ou mais longe. Como os
// blocos estáticos, só cresce: cada peça que assenta baixa a distância à sua volta (mínimo
// com o que já havia), sem varrer o tabuleiro.

export const SEA_SIZE = 512;
/** Distância máxima guardada, em unidades do mundo (o resto vale "longe"). */
export const SEA_DMAX = 6;
const TEXEL = (GROUND_EXTENT * 2) / SEA_SIZE;

/** Distância euclidiana de (ax, az) (ambos ≥ 0, relativos ao centro) ao hexágono flat-top de apótema INR; negativa dentro. */
function hexDist(ax: number, az: number): number {
  const kx = -0.8660254, ky = 0.5, kz = 0.57735027;
  const dk = 2 * Math.min(kx * ax + ky * az, 0);
  let px = ax - dk * kx, pz = az - dk * ky;
  px -= Math.max(-kz * INR, Math.min(kz * INR, px));
  pz -= INR;
  return Math.hypot(px, pz) * Math.sign(pz);
}

export class SeaMap {
  readonly data = new Uint8Array(SEA_SIZE * SEA_SIZE).fill(255);
  readonly texture: THREE.DataTexture;
  private dirty = false;
  /**
   * Encaixe fluido: o ponto sem deslocamento de cada texel (x, z). O inverso do deslocamento é um ponto fixo de 4 iterações com 6 senos,
   * e peças vizinhas cobrem os mesmos texels (cada peça varre ~7 unidades em volta): guardado, cada texel é resolvido uma vez só na partida.
   * NaN = ainda não calculado. A função de deslocamento é fixa na partida (`unwarpFn`); trocar de função esvazia o guardado.
   */
  private unwarped: Float32Array | null = null;
  private unwarpFn: ((x: number, z: number) => readonly [number, number]) | null = null;
  /** Pré-visualizações empilhadas: o retângulo (u0, v0, w × h) com o que havia antes. */
  private previews: { u0: number; v0: number; w: number; h: number; data: Uint8Array }[] = [];

  constructor() {
    const t = new THREE.DataTexture(this.data, SEA_SIZE, SEA_SIZE, THREE.RedFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    this.texture = t;
  }

  clear() {
    this.data.fill(255);
    this.previews.length = 0;
    this.dirty = true;
  }

  /** Como `add`, para uma peça que ainda não assentou (fantasma, queda): guarda o que havia e `unpreview` devolve. */
  preview(q: number, r: number, margin = 0, unwarp?: (x: number, z: number) => readonly [number, number]) {
    const { x: cx, z: cz } = hexToWorld(q, r);
    const reach = 1 + SEA_DMAX;
    const u0 = Math.max(0, Math.floor((cx - reach + GROUND_EXTENT) / TEXEL)), u1 = Math.min(SEA_SIZE - 1, Math.ceil((cx + reach + GROUND_EXTENT) / TEXEL));
    const v0 = Math.max(0, Math.floor((cz - reach + GROUND_EXTENT) / TEXEL)), v1 = Math.min(SEA_SIZE - 1, Math.ceil((cz + reach + GROUND_EXTENT) / TEXEL));
    const w = u1 - u0 + 1, h = v1 - v0 + 1;
    if (w <= 0 || h <= 0) return;
    const keep = new Uint8Array(w * h);
    for (let v = 0; v < h; v++) keep.set(this.data.subarray((v0 + v) * SEA_SIZE + u0, (v0 + v) * SEA_SIZE + u0 + w), v * w);
    this.previews.push({ u0, v0, w, h, data: keep });
    this.add(q, r, margin, unwarp);
  }

  unpreview() {
    for (let k = this.previews.length - 1; k >= 0; k--) {
      const p = this.previews[k];
      for (let v = 0; v < p.h; v++) this.data.set(p.data.subarray(v * p.w, (v + 1) * p.w), (p.v0 + v) * SEA_SIZE + p.u0);
    }
    if (this.previews.length) this.dirty = true;
    this.previews.length = 0;
  }

  /**
   * Registra a peça da casa (q, r): a distância ao hexágono dela, até DMAX. `margin` alarga o hexágono (a saia de uma peça alta
   * desce para fora dele: a areia e a espuma começam no pé dela, não na borda da peça).
   */
  add(q: number, r: number, margin = 0, unwarp?: (x: number, z: number) => readonly [number, number]) {
    const { x: cx, z: cz } = hexToWorld(q, r);
    if (unwarp !== this.unwarpFn) {
      this.unwarpFn = unwarp ?? null;
      this.unwarped = unwarp ? new Float32Array(SEA_SIZE * SEA_SIZE * 2).fill(NaN) : null;
    }
    const cache = this.unwarped;
    const reach = 1 + SEA_DMAX;
    const u0 = Math.max(0, Math.floor((cx - reach + GROUND_EXTENT) / TEXEL)), u1 = Math.min(SEA_SIZE - 1, Math.ceil((cx + reach + GROUND_EXTENT) / TEXEL));
    const v0 = Math.max(0, Math.floor((cz - reach + GROUND_EXTENT) / TEXEL)), v1 = Math.min(SEA_SIZE - 1, Math.ceil((cz + reach + GROUND_EXTENT) / TEXEL));
    for (let v = v0; v <= v1; v++) {
      for (let u = u0; u <= u1; u++) {
        // Encaixe fluido: a peça foi desenhada deslocada, então a distância é ao hexágono de origem do ponto que o deslocamento leva até aqui.
        let wx = (u + 0.5) * TEXEL - GROUND_EXTENT, wz = (v + 0.5) * TEXEL - GROUND_EXTENT;
        if (unwarp) {
          const k = (v * SEA_SIZE + u) * 2;
          if (cache![k] !== cache![k]) [cache![k], cache![k + 1]] = unwarp(wx, wz);
          wx = cache![k];
          wz = cache![k + 1];
        }
        const az = Math.abs(wz - cz), ax = Math.abs(wx - cx);
        // Distância ao hexágono flat-top: a "norma hexagonal" menos o raio interno (as linhas de mesma distância são hexágonos
        // maiores). No fluido, a distância de verdade (euclidiana): a espuma e a areia dobram os cantos em arco, sem quina.
        const hd = (unwarp ? hexDist(ax, az) : Math.max(az, ax * 0.8660254 + az * 0.5) - INR) - margin;
        const d = hd <= 0 ? 0 : Math.round(Math.min(1, hd / SEA_DMAX) * 255);
        const i = v * SEA_SIZE + u;
        if (d < this.data[i]) this.data[i] = d;
      }
    }
    this.dirty = true;
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.texture.needsUpdate = true;
  }
}

/** Um só por página, como o `groundMap`: o World preenche, o material do vazio lê. */
export const seaMap = new SeaMap();
