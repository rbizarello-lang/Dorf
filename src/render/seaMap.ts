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
  add(q: number, r: number, margin = 0) {
    const { x: cx, z: cz } = hexToWorld(q, r);
    const reach = 1 + SEA_DMAX;
    const u0 = Math.max(0, Math.floor((cx - reach + GROUND_EXTENT) / TEXEL)), u1 = Math.min(SEA_SIZE - 1, Math.ceil((cx + reach + GROUND_EXTENT) / TEXEL));
    const v0 = Math.max(0, Math.floor((cz - reach + GROUND_EXTENT) / TEXEL)), v1 = Math.min(SEA_SIZE - 1, Math.ceil((cz + reach + GROUND_EXTENT) / TEXEL));
    for (let v = v0; v <= v1; v++) {
      const az = Math.abs((v + 0.5) * TEXEL - GROUND_EXTENT - cz);
      for (let u = u0; u <= u1; u++) {
        const ax = Math.abs((u + 0.5) * TEXEL - GROUND_EXTENT - cx);
        // Distância ao hexágono flat-top: a "norma hexagonal" menos o raio interno
        // (um pouco curta nos cantos, onde o contorno vira arredondado).
        const hd = Math.max(az, ax * 0.8660254 + az * 0.5) - INR - margin;
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
