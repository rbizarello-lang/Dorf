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
    this.dirty = true;
  }

  /**
   * Registra a peça da casa (q, r): a distância ao hexágono dela, até DMAX. `margin` alarga o hexágono (a saia de uma peça alta
   * desce para fora dele: a areia e a espuma começam no pé dela, não na borda da peça).
   */
  add(q: number, r: number, margin = 0, unwarp?: (x: number, z: number) => readonly [number, number]) {
    const { x: cx, z: cz } = hexToWorld(q, r);
    const reach = 1 + SEA_DMAX;
    const u0 = Math.max(0, Math.floor((cx - reach + GROUND_EXTENT) / TEXEL)), u1 = Math.min(SEA_SIZE - 1, Math.ceil((cx + reach + GROUND_EXTENT) / TEXEL));
    const v0 = Math.max(0, Math.floor((cz - reach + GROUND_EXTENT) / TEXEL)), v1 = Math.min(SEA_SIZE - 1, Math.ceil((cz + reach + GROUND_EXTENT) / TEXEL));
    for (let v = v0; v <= v1; v++) {
      for (let u = u0; u <= u1; u++) {
        // Encaixe fluido: a peça foi desenhada deslocada, então a distância é ao hexágono de origem do ponto que o deslocamento leva até aqui.
        let wx = (u + 0.5) * TEXEL - GROUND_EXTENT, wz = (v + 0.5) * TEXEL - GROUND_EXTENT;
        if (unwarp) [wx, wz] = unwarp(wx, wz);
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
