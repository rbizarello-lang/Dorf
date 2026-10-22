import * as THREE from 'three/webgpu';
import { GROUND_EXTENT } from './groundMap';

// Distância de cada ponto do chão até a água dos rios e lagos, para a várzea (Theme.floodplain):
// perto do rio o prado e a plantação ficam com a cor fértil do tema, e longe a cor volta ao normal.
// Uma textura de um canal só alinhada ao mundo, como o `seaMap`: 0 = em cima da água, 1 = RIVER_DMAX
// ou mais longe. Só cresce (cada peça de água baixa a distância à sua volta, mínimo com o que havia),
// então a ordem das peças não importa: um rio posto depois também fertiliza o campo que já estava lá.
// O material do chão lê o mapa (materials.ts); sem `floodplain` no tema, ninguém o preenche.

export const RIVER_SIZE = 512;
/** Distância máxima guardada, em unidades do mundo (o resto vale "longe"). */
export const RIVER_DMAX = 6;
const TEXEL = (GROUND_EXTENT * 2) / RIVER_SIZE;
/** Pontos da água mais próximos que isto contam como um só. */
const GRID = 0.07;

export class RiverMap {
  readonly data = new Uint8Array(RIVER_SIZE * RIVER_SIZE).fill(255);
  readonly texture: THREE.DataTexture;
  private dirty = false;

  constructor() {
    const t = new THREE.DataTexture(this.data, RIVER_SIZE, RIVER_SIZE, THREE.RedFormat, THREE.UnsignedByteType);
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
   * Registra a água de uma peça já posta no mundo pela matriz `m`: `water` são os triângulos da água
   * (x, y, z de cada vértice, na peça). `reach` é até onde a distância interessa (em unidades do mundo).
   */
  add(water: Float32Array, m: THREE.Matrix4, reach: number) {
    if (!water.length) return;
    const e = m.elements;
    const seen = new Set<number>();
    const pts: number[] = [];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < water.length; i += 3) {
      const x = water[i], y = water[i + 1], z = water[i + 2];
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const k = Math.round(wx / GRID) * 65536 + Math.round(wz / GRID);
      if (seen.has(k)) continue;
      seen.add(k);
      pts.push(wx, wz);
      x0 = Math.min(x0, wx);
      x1 = Math.max(x1, wx);
      z0 = Math.min(z0, wz);
      z1 = Math.max(z1, wz);
    }
    const R = Math.min(RIVER_DMAX, reach);
    const u0 = Math.max(0, Math.floor((x0 - R + GROUND_EXTENT) / TEXEL)), u1 = Math.min(RIVER_SIZE - 1, Math.ceil((x1 + R + GROUND_EXTENT) / TEXEL));
    const v0 = Math.max(0, Math.floor((z0 - R + GROUND_EXTENT) / TEXEL)), v1 = Math.min(RIVER_SIZE - 1, Math.ceil((z1 + R + GROUND_EXTENT) / TEXEL));
    const R2 = R * R;
    for (let v = v0; v <= v1; v++) {
      const z = (v + 0.5) * TEXEL - GROUND_EXTENT;
      for (let u = u0; u <= u1; u++) {
        const x = (u + 0.5) * TEXEL - GROUND_EXTENT;
        let best = R2;
        for (let k = 0; k < pts.length; k += 2) {
          const d = (pts[k] - x) ** 2 + (pts[k + 1] - z) ** 2;
          if (d < best) best = d;
        }
        if (best >= R2) continue;
        const q = Math.round(Math.min(1, Math.sqrt(best) / RIVER_DMAX) * 255);
        const i = v * RIVER_SIZE + u;
        if (q < this.data[i]) this.data[i] = q;
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

/** Um só por página, como o `seaMap`: o World preenche, o material do chão lê. */
export const riverMap = new RiverMap();
