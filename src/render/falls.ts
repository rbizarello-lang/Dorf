import * as THREE from 'three/webgpu';
import type { Lib } from './lib';
import type { TileBuild } from './tileBuilder';

// Cachoeiras (R3): a lâmina d'água (opaca) e o anel de espuma da bacia (transparente) de todas as peças assentadas ficam
// em duas malhas só, no mundo (+2 draw calls no tabuleiro inteiro). Como os blocos estáticos, só crescem: cada peça com
// queda acrescenta a sua parte quando assenta (são poucas, algumas dezenas de triângulos cada).

/** Geometria da lâmina (posição, normal e `fdat`) a partir dos vetores achatados do `TileBuild`. */
export function sheetGeometry(pos: ArrayLike<number>, nrm: ArrayLike<number>, dat: ArrayLike<number>) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(nrm), 3));
  g.setAttribute('fdat', new THREE.BufferAttribute(Float32Array.from(dat), 4));
  return g;
}

/** Geometria do anel de espuma (posição e `fdat`). */
export function foamGeometry(pos: ArrayLike<number>, dat: ArrayLike<number>) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
  g.setAttribute('fdat', new THREE.BufferAttribute(Float32Array.from(dat), 4));
  return g;
}

/** Uma queda assentada, no mundo: o lábio, a saída (direção para fora da peça alta), a meia-largura e a altura da queda. */
export interface FallSpot {
  /** Meio do lábio (x, z) e a altura da água ali. */
  x: number;
  y: number;
  z: number;
  nx: number;
  nz: number;
  w: number;
  drop: number;
}

export class FallLayer {
  readonly group = new THREE.Group();
  readonly sheet: THREE.Mesh;
  readonly foam: THREE.Mesh;
  /** Quedas assentadas (para a névoa, o som e a câmera). */
  readonly spots: FallSpot[] = [];
  private sPos: number[] = [];
  private sNrm: number[] = [];
  private sDat: number[] = [];
  private fPos: number[] = [];
  private fDat: number[] = [];

  constructor(lib: Lib) {
    this.sheet = new THREE.Mesh(new THREE.BufferGeometry(), lib.fall);
    this.sheet.receiveShadow = true;
    this.sheet.frustumCulled = false;
    this.foam = new THREE.Mesh(new THREE.BufferGeometry(), lib.foam);
    this.foam.frustumCulled = false;
    this.foam.renderOrder = 1;
    this.sheet.visible = this.foam.visible = false;
    this.group.add(this.sheet, this.foam);
  }

  /** Acrescenta as quedas e a espuma de uma peça assentada pela matriz `m` (giro em y e posição). */
  append(b: TileBuild, m: THREE.Matrix4) {
    const e = m.elements;
    const hasSheet = b.fall.pos.length > 0, hasFoam = b.foam.pos.length > 0;
    if (!hasSheet && !hasFoam && !b.falls.length) return;
    const place = (src: ArrayLike<number>, dst: number[], point: boolean) => {
      for (let i = 0; i < src.length; i += 3) {
        const x = src[i], y = src[i + 1], z = src[i + 2];
        dst.push(e[0] * x + e[4] * y + e[8] * z + (point ? e[12] : 0), e[1] * x + e[5] * y + e[9] * z + (point ? e[13] : 0), e[2] * x + e[6] * y + e[10] * z + (point ? e[14] : 0));
      }
    };
    if (hasSheet) {
      place(b.fall.pos, this.sPos, true);
      place(b.fall.nrm, this.sNrm, false);
      for (const v of b.fall.dat) this.sDat.push(v);
      this.upload(this.sheet, { position: [this.sPos, 3], normal: [this.sNrm, 3], fdat: [this.sDat, 4] });
    }
    if (hasFoam) {
      place(b.foam.pos, this.fPos, true);
      for (const v of b.foam.dat) this.fDat.push(v);
      this.upload(this.foam, { position: [this.fPos, 3], fdat: [this.fDat, 4] });
    }
    for (let i = 0; i < b.falls.length; i += 6) {
      const x = b.falls[i], z = b.falls[i + 1], nx = b.falls[i + 2], nz = b.falls[i + 3];
      // x, z do lábio no mundo; a água da peça alta fica em WATER_Y (-0,02) sobre o chão da peça.
      this.spots.push({
        x: e[0] * x + e[8] * z + e[12],
        y: e[13],
        z: e[2] * x + e[10] * z + e[14],
        nx: e[0] * nx + e[8] * nz,
        nz: e[2] * nx + e[10] * nz,
        w: b.falls[i + 4],
        drop: b.falls[i + 5],
      });
    }
  }

  private upload(mesh: THREE.Mesh, attrs: Record<string, [number[], number]>) {
    const old = mesh.geometry;
    const g = new THREE.BufferGeometry();
    for (const [name, [data, size]] of Object.entries(attrs)) g.setAttribute(name, new THREE.BufferAttribute(Float32Array.from(data), size));
    mesh.geometry = g;
    old.dispose();
    mesh.visible = true;
  }

  clear() {
    this.spots.length = 0;
    this.sPos = [];
    this.sNrm = [];
    this.sDat = [];
    this.fPos = [];
    this.fDat = [];
    for (const m of [this.sheet, this.foam]) {
      m.geometry.dispose();
      m.geometry = new THREE.BufferGeometry();
      m.visible = false;
    }
  }
}
