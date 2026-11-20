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

/** O que uma peça contribui (já no mundo): a lâmina, a espuma e as quedas. Guardado por peça para poder ser trocado quando ela é refeita. */
interface FallPart {
  sPos: number[];
  sNrm: number[];
  sDat: number[];
  fPos: number[];
  fDat: number[];
  spots: FallSpot[];
}

export class FallLayer {
  readonly group = new THREE.Group();
  readonly sheet: THREE.Mesh;
  readonly foam: THREE.Mesh;
  /** A contribuição de cada peça assentada (chave da peça). Refazer uma peça troca a dela; a ordem de inserção se mantém. */
  private parts = new Map<number, FallPart>();
  private dirty = false;
  private all: FallSpot[] = [];

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

  /** Quedas assentadas (para a névoa, o som e a câmera). */
  get spots(): readonly FallSpot[] {
    this.flush();
    return this.all;
  }

  /**
   * Guarda as quedas e a espuma de uma peça assentada pela matriz `m` (giro em y e posição). Chamar de novo com a mesma chave
   * (a peça foi refeita: a corredeira mudou porque a vizinha chegou) TROCA a contribuição dela, sem duplicar. A malha só é remontada
   * em `flush` (uma vez por quadro, mesmo que várias peças mudem).
   */
  append(key: number, b: TileBuild, m: THREE.Matrix4) {
    const e = m.elements;
    const hasSheet = b.fall.pos.length > 0, hasFoam = b.foam.pos.length > 0;
    if (!hasSheet && !hasFoam && !b.falls.length) {
      if (this.parts.delete(key)) this.dirty = true;
      return;
    }
    const part: FallPart = { sPos: [], sNrm: [], sDat: [], fPos: [], fDat: [], spots: [] };
    const place = (src: ArrayLike<number>, dst: number[], point: boolean) => {
      for (let i = 0; i < src.length; i += 3) {
        const x = src[i], y = src[i + 1], z = src[i + 2];
        dst.push(e[0] * x + e[4] * y + e[8] * z + (point ? e[12] : 0), e[1] * x + e[5] * y + e[9] * z + (point ? e[13] : 0), e[2] * x + e[6] * y + e[10] * z + (point ? e[14] : 0));
      }
    };
    if (hasSheet) {
      place(b.fall.pos, part.sPos, true);
      place(b.fall.nrm, part.sNrm, false);
      for (const v of b.fall.dat) part.sDat.push(v);
    }
    if (hasFoam) {
      place(b.foam.pos, part.fPos, true);
      for (const v of b.foam.dat) part.fDat.push(v);
    }
    for (let i = 0; i < b.falls.length; i += 6) {
      const x = b.falls[i], z = b.falls[i + 1], nx = b.falls[i + 2], nz = b.falls[i + 3];
      // x, z do lábio no mundo; a água da peça alta fica em WATER_Y (-0,02) sobre o chão da peça.
      part.spots.push({
        x: e[0] * x + e[8] * z + e[12],
        y: e[13],
        z: e[2] * x + e[10] * z + e[14],
        nx: e[0] * nx + e[8] * nz,
        nz: e[2] * nx + e[10] * nz,
        w: b.falls[i + 4],
        drop: b.falls[i + 5],
      });
    }
    this.parts.set(key, part);
    this.dirty = true;
  }

  /** Remonta as malhas e a lista de quedas se alguma peça mudou desde a última vez. */
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const sPos: number[] = [], sNrm: number[] = [], sDat: number[] = [], fPos: number[] = [], fDat: number[] = [];
    this.all = [];
    for (const part of this.parts.values()) {
      for (const v of part.sPos) sPos.push(v);
      for (const v of part.sNrm) sNrm.push(v);
      for (const v of part.sDat) sDat.push(v);
      for (const v of part.fPos) fPos.push(v);
      for (const v of part.fDat) fDat.push(v);
      for (const s of part.spots) this.all.push(s);
    }
    this.upload(this.sheet, sPos.length ? { position: [sPos, 3], normal: [sNrm, 3], fdat: [sDat, 4] } : null);
    this.upload(this.foam, fPos.length ? { position: [fPos, 3], fdat: [fDat, 4] } : null);
  }

  /** Depuração e testes: o que a peça `key` contribui (vértices de lâmina e de espuma, quedas). */
  digest(key: number) {
    const part = this.parts.get(key);
    const r = (v: number) => Math.round(v * 1000) / 1000;
    return part ? { sheet: part.sPos.length / 3, foam: part.fPos.length / 3, sum: r(part.sPos.reduce((a, v) => a + v, 0) + part.fPos.reduce((a, v) => a + v, 0)), spots: part.spots.map((s) => [s.x, s.y, s.z, s.nx, s.nz, s.w, s.drop].map(r).join(',')).sort() } : null;
  }

  private upload(mesh: THREE.Mesh, attrs: Record<string, [number[], number]> | null) {
    const old = mesh.geometry;
    const g = new THREE.BufferGeometry();
    if (attrs) for (const [name, [data, size]] of Object.entries(attrs)) g.setAttribute(name, new THREE.BufferAttribute(Float32Array.from(data), size));
    mesh.geometry = g;
    old.dispose();
    mesh.visible = !!attrs;
  }

  clear() {
    this.parts.clear();
    this.all = [];
    this.dirty = false;
    for (const m of [this.sheet, this.foam]) {
      m.geometry.dispose();
      m.geometry = new THREE.BufferGeometry();
      m.visible = false;
    }
  }
}
