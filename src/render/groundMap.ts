import * as THREE from 'three/webgpu';
import type { TileBuild } from './tileBuilder';

// Mapa do chão visto de cima, para a luz que não vem do sol nem do céu:
//   RGB = cor do chão (terreno e água), que o chão iluminado rebate nas paredes e nas copas;
//   A = luz dos lampiões em volta das casas com janela, que acende à noite.
// Ao lado vai a cobertura (R8): 255 onde alguma peça já pintou. Os mipmaps do RGB, que tem 0 no
// vazio, saem multiplicados pela cobertura; dividir um pelo outro dá a cor média só das peças
// (a costura de cor entre peças, em makeGroundMaterial).
// A altura do chão (R8, `HEIGHT_RANGE` = 255) fica numa terceira textura: em platô de nível 1 ou 2 os materiais medem o
// ponto a partir do chão da casa (poças de lampião e luz rebatida), não do y absoluto.
// A altura do chão (`relief`, meio ponto flutuante) de cada texel vai numa quarta textura: o material do chão tira dela a normal
// SUAVE (diferença central), no lugar da normal plana de cada triângulo, e as encostas deixam de ter as quinas retas em 60 graus.
// O campo de terreno (`land`, RGBA8) guarda os pesos [prado, mata, plantação, vila] de cada texel, que o material do chão lê
// borrado e deslocado por ruído do mundo: é o que faz as manchas de terreno atravessarem as emendas (modo Relevo).
// Uma textura só, alinhada ao mundo, cobre o tabuleiro inteiro. Como os blocos estáticos, só
// cresce: cada peça que assenta pinta a sua parte, rasterizada na CPU a partir da geometria.

/** Lado da textura em texels e o meio-lado coberto no mundo (texel de 0,1). */
export const GROUND_SIZE = 1024;
export const GROUND_EXTENT = 51.2;
const TEXEL = (GROUND_EXTENT * 2) / GROUND_SIZE;
/** Altura do chão que o byte 255 da textura de alturas representa (o platô mais alto, nível 2, tem 0,6). */
export const HEIGHT_RANGE = 1;
/** Raio da poça de luz de um lampião (desvio da gaussiana, em unidades do mundo). */
const LANTERN_SIGMA = 0.17;

/** Altura de um texel sem peça (o fundo da ilha, -TILE_T). */
const RELIEF_VOID = THREE.DataUtils.toHalfFloat(-0.28);
const to8 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255));

export class GroundMap {
  readonly data = new Uint8Array(GROUND_SIZE * GROUND_SIZE * 4);
  readonly texture: THREE.DataTexture;
  readonly cover = new Uint8Array(GROUND_SIZE * GROUND_SIZE);
  readonly coverTexture: THREE.DataTexture;
  /** Altura do chão da casa (peça) em cada texel, em fração de `HEIGHT_RANGE`; 0 onde não há peça. */
  readonly height = new Uint8Array(GROUND_SIZE * GROUND_SIZE);
  readonly heightTexture: THREE.DataTexture;
  /** Sombra de contato em volta das casas (0 a 255): o chão escurece junto da parede (material do chão). */
  readonly shade = new Uint8Array(GROUND_SIZE * GROUND_SIZE);
  readonly shadeTexture: THREE.DataTexture;
  /** Campo de terreno: pesos por vértice (`TileBuild.splat`) rasterizados no mundo; 0 onde nenhuma peça tem terreno (rio, estrada, vazio). */
  readonly land = new Uint8Array(GROUND_SIZE * GROUND_SIZE * 4);
  readonly landTexture: THREE.DataTexture;
  /** Altura do chão no mundo (half float; `RELIEF_VOID` onde não há peça: o fundo da ilha, para a borda da costa não ganhar um degrau). */
  readonly relief = new Uint16Array(GROUND_SIZE * GROUND_SIZE).fill(RELIEF_VOID);
  readonly reliefTexture: THREE.DataTexture;
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
    const c = new THREE.DataTexture(this.cover, GROUND_SIZE, GROUND_SIZE, THREE.RedFormat, THREE.UnsignedByteType);
    c.wrapS = c.wrapT = THREE.ClampToEdgeWrapping;
    c.magFilter = THREE.LinearFilter;
    c.minFilter = THREE.LinearMipmapLinearFilter;
    c.generateMipmaps = true;
    c.colorSpace = THREE.NoColorSpace;
    c.needsUpdate = true;
    this.coverTexture = c;
    const h = new THREE.DataTexture(this.height, GROUND_SIZE, GROUND_SIZE, THREE.RedFormat, THREE.UnsignedByteType);
    h.wrapS = h.wrapT = THREE.ClampToEdgeWrapping;
    h.magFilter = h.minFilter = THREE.LinearFilter;
    h.generateMipmaps = false;
    h.colorSpace = THREE.NoColorSpace;
    h.needsUpdate = true;
    this.heightTexture = h;
    const sh = new THREE.DataTexture(this.shade, GROUND_SIZE, GROUND_SIZE, THREE.RedFormat, THREE.UnsignedByteType);
    sh.wrapS = sh.wrapT = THREE.ClampToEdgeWrapping;
    sh.magFilter = sh.minFilter = THREE.LinearFilter;
    sh.generateMipmaps = false;
    sh.colorSpace = THREE.NoColorSpace;
    sh.needsUpdate = true;
    this.shadeTexture = sh;
    // Mipmaps: o material lê um nível borrado (a mancha de terreno não tem a quina do hexágono).
    const ld = new THREE.DataTexture(this.land, GROUND_SIZE, GROUND_SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
    ld.wrapS = ld.wrapT = THREE.ClampToEdgeWrapping;
    ld.magFilter = THREE.LinearFilter;
    ld.minFilter = THREE.LinearMipmapLinearFilter;
    ld.generateMipmaps = true;
    ld.colorSpace = THREE.NoColorSpace;
    ld.needsUpdate = true;
    this.landTexture = ld;
    const rl = new THREE.DataTexture(this.relief, GROUND_SIZE, GROUND_SIZE, THREE.RedFormat, THREE.HalfFloatType);
    rl.wrapS = rl.wrapT = THREE.ClampToEdgeWrapping;
    rl.magFilter = rl.minFilter = THREE.LinearFilter;
    rl.generateMipmaps = false;
    rl.colorSpace = THREE.NoColorSpace;
    rl.needsUpdate = true;
    this.reliefTexture = rl;
  }

  clear() {
    this.data.fill(0);
    this.cover.fill(0);
    this.height.fill(0);
    this.shade.fill(0);
    this.land.fill(0);
    this.relief.fill(RELIEF_VOID);
    this.dirty = true;
  }

  /** Pinta o chão e a água de uma peça já posta no mundo pela matriz `m`. */
  add(b: TileBuild, m: THREE.Matrix4, water: THREE.Color) {
    this.raster(b.pos, m, (i, out) => out.setRGB(b.col[i * 3], b.col[i * 3 + 1], b.col[i * 3 + 2]), b.splat, b.groundEnd);
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

  /** Soma a sombra de contato de uma casa em (x, z): mancha macia de desvio `sigma` e força `amp` (0 a 1) no centro. */
  contact(x: number, z: number, amp: number, sigma: number) {
    const cu = (x + GROUND_EXTENT) / TEXEL - 0.5, cv = (z + GROUND_EXTENT) / TEXEL - 0.5;
    const r = Math.ceil((2.5 * sigma) / TEXEL);
    const k = (TEXEL * TEXEL) / (2 * sigma * sigma);
    const u0 = Math.round(cu), v0 = Math.round(cv);
    for (let v = Math.max(0, v0 - r); v <= Math.min(GROUND_SIZE - 1, v0 + r); v++) {
      for (let u = Math.max(0, u0 - r); u <= Math.min(GROUND_SIZE - 1, u0 + r); u++) {
        const g = amp * Math.exp(-((u - cu) ** 2 + (v - cv) ** 2) * k);
        const i = v * GROUND_SIZE + u;
        this.shade[i] = to8(1 - (1 - this.shade[i] / 255) * (1 - g));
      }
    }
    this.dirty = true;
  }

  /** Envia a textura se algo mudou (uma vez por quadro). */
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.texture.needsUpdate = true;
    this.coverTexture.needsUpdate = true;
    this.heightTexture.needsUpdate = true;
    this.shadeTexture.needsUpdate = true;
    this.landTexture.needsUpdate = true;
    this.reliefTexture.needsUpdate = true;
  }

  /**
   * Rasteriza os triângulos virados para cima (o topo da peça; as laterais ficam de fora):
   * cada texel cujo centro cai num triângulo recebe a cor interpolada dos vértices.
   */
  private raster(pos: Float32Array, m: THREE.Matrix4, colorAt: (vertex: number, out: THREE.Color) => void, splat?: Float32Array, groundEnd = 0) {
    const e = m.elements;
    const level = to8(e[13] / HEIGHT_RANGE);
    const c0 = new THREE.Color(), c1 = new THREE.Color(), c2 = new THREE.Color();
    const u = [0, 0, 0], v = [0, 0, 0], wy = [0, 0, 0];
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
      const hasLand = !!splat && splat[vi * 4] + splat[vi * 4 + 1] + splat[vi * 4 + 2] + splat[vi * 4 + 3] + splat[vi * 4 + 4] + splat[vi * 4 + 5] + splat[vi * 4 + 6] + splat[vi * 4 + 7] + splat[vi * 4 + 8] + splat[vi * 4 + 9] + splat[vi * 4 + 10] + splat[vi * 4 + 11] > 0.05;
      colorAt(vi, c0);
      colorAt(vi + 1, c1);
      colorAt(vi + 2, c2);
      // Altura de cada vértice no mundo (só o chão: os decalques acima de `groundEnd` — parcelas, ruas — não entram no relevo).
      const hasRelief = t < groundEnd;
      if (hasRelief) for (let k = 0; k < 3; k++) wy[k] = e[1] * pos[t + k * 3] + e[5] * pos[t + k * 3 + 1] + e[9] * pos[t + k * 3 + 2] + e[13];
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
          this.cover[py * GROUND_SIZE + px] = 255;
          this.height[py * GROUND_SIZE + px] = level;
          if (hasRelief) this.relief[py * GROUND_SIZE + px] = THREE.DataUtils.toHalfFloat(wy[0] * w0 + wy[1] * w1 + wy[2] * w2);
          // Triângulo sem terreno (estrada, trilho: pesos 0) deixa o campo como estava: o terreno por baixo continua valendo.
          if (hasLand) {
            const si = vi * 4;
            for (let c = 0; c < 4; c++) this.land[i + c] = to8(splat![si + c] * w0 + splat![si + 4 + c] * w1 + splat![si + 8 + c] * w2);
          }
        }
      }
    }
  }
}

/** O mapa do tabuleiro (um só por página): o World pinta, os materiais leem. */
export const groundMap = new GroundMap();
