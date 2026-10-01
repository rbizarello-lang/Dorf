import * as THREE from 'three/webgpu';

// Céu procedural para iluminação por ambiente (IBL). A câmera quase nunca enxerga o
// céu (olha de cima para o tabuleiro), mas ele ilumina tudo: o difuso vem da cúpula
// (azul de cima, cor do chão de baixo) e os reflexos mostram o horizonte e o brilho do
// sol na água e nos telhados. É uma textura equirretangular pequena, refeita na CPU
// quando a luz muda; o three gera o PMREM sozinho.

const W = 64;
const H = 32;

export interface SkyColors {
  zenith: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  sun: THREE.Color;
  sunDir: THREE.Vector3;
  /** Intensidade do ambiente (equivale à da luz hemisférica). */
  intensity: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class SkyEnv {
  readonly texture: THREE.DataTexture;
  private data = new Float32Array(W * H * 4);
  private last = '';

  constructor() {
    this.texture = new THREE.DataTexture(this.data, W, H, THREE.RGBAFormat, THREE.FloatType);
    this.texture.mapping = THREE.EquirectangularReflectionMapping;
    this.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
  }

  /** Refaz a textura se as cores mudaram de forma visível (evita PMREM a cada quadro). */
  update(c: SkyColors) {
    const q = (v: number) => Math.round(v * 60);
    const key = [c.zenith, c.horizon, c.ground, c.sun].map((k) => `${q(k.r)},${q(k.g)},${q(k.b)}`).join('|') + `|${q(c.sunDir.x)},${q(c.sunDir.y)},${q(c.sunDir.z)}|${q(c.intensity)}`;
    if (key === this.last) return;
    this.last = key;
    const k = c.intensity / Math.PI;
    const sd = c.sunDir.clone().normalize();
    const d = new THREE.Vector3();
    const col = new THREE.Color();
    for (let j = 0; j < H; j++) {
      const elev = ((j + 0.5) / H - 0.5) * Math.PI;
      const up = Math.sin(elev);
      for (let i = 0; i < W; i++) {
        const phi = ((i + 0.5) / W - 0.5) * Math.PI * 2;
        d.set(Math.cos(phi) * Math.cos(elev), up, Math.sin(phi) * Math.cos(elev));
        if (up >= 0) col.copy(c.horizon).lerp(c.zenith, smooth(0, 0.65, up));
        else col.copy(c.horizon).lerp(c.ground, smooth(0, 0.3, -up));
        const s = Math.max(0, d.dot(sd));
        col.r += c.sun.r * (Math.pow(s, 48) * 1.6 + Math.pow(s, 6) * 0.22);
        col.g += c.sun.g * (Math.pow(s, 48) * 1.6 + Math.pow(s, 6) * 0.22);
        col.b += c.sun.b * (Math.pow(s, 48) * 1.6 + Math.pow(s, 6) * 0.22);
        const o = (j * W + i) * 4;
        this.data[o] = col.r * k;
        this.data[o + 1] = col.g * k;
        this.data[o + 2] = col.b * k;
        this.data[o + 3] = 1;
      }
    }
    this.texture.needsUpdate = true;
    this.texture.needsPMREMUpdate = true;
  }
}
