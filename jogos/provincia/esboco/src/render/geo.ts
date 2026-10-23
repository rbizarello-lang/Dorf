// Construtor de geometrias low-poly: junta formas simples numa malha só, com cor por vértice
// (degradê vertical simula oclusão de ambiente) e facetas planas. Tudo gerado em código.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface PartOpts {
  x?: number; y?: number; z?: number;
  rx?: number; ry?: number; rz?: number;
  sx?: number; sy?: number; sz?: number;
  /** Multiplicador de brilho na base e no topo da peça (escurece a base). */
  grad?: [number, number];
  /** Deslocamento aleatório (determinístico) dos vértices, para facetas irregulares. */
  jit?: number;
}

/** Hash determinístico de 3 floats em [0,1). */
function h3(x: number, y: number, z: number, s: number): number {
  let h = Math.imul(Math.round(x * 997) ^ s, 374761393) ^ Math.imul(Math.round(y * 991), 668265263) ^ Math.imul(Math.round(z * 983), 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const tmpC = new THREE.Color();
const tmpM = new THREE.Matrix4();
const tmpE = new THREE.Euler();
const tmpQ = new THREE.Quaternion();

export class Geo {
  private parts: THREE.BufferGeometry[] = [];
  constructor(private seed = 1) {}

  add(src: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PartOpts = {}): this {
    let g = src.clone();
    if (o.jit) {
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        p.setXYZ(i, x + (h3(x, y, z, this.seed) - 0.5) * o.jit, y + (h3(x, y, z, this.seed + 7) - 0.5) * o.jit, z + (h3(x, y, z, this.seed + 13) - 0.5) * o.jit);
      }
    }
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    tmpE.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    tmpQ.setFromEuler(tmpE);
    tmpM.compose(new THREE.Vector3(o.x ?? 0, o.y ?? 0, o.z ?? 0), tmpQ, new THREE.Vector3(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    g.applyMatrix4(tmpM);
    g.computeVertexNormals();
    const p = g.attributes.position as THREE.BufferAttribute;
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const [gb, gt] = o.grad ?? [0.8, 1];
    tmpC.set(color);
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const f = y1 > y0 ? (p.getY(i) - y0) / (y1 - y0) : 1;
      const m = gb + (gt - gb) * f;
      col[i * 3] = tmpC.r * m; col[i * 3 + 1] = tmpC.g * m; col[i * 3 + 2] = tmpC.b * m;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
    return this;
  }

  box(w: number, h: number, d: number, color: THREE.ColorRepresentation, o: PartOpts = {}): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, o);
  }
  cyl(rt: number, rb: number, h: number, color: THREE.ColorRepresentation, seg = 8, o: PartOpts = {}): this {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, o);
  }
  cone(r: number, h: number, color: THREE.ColorRepresentation, seg = 6, o: PartOpts = {}): this {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, o);
  }
  ico(r: number, color: THREE.ColorRepresentation, detail = 1, o: PartOpts = {}): this {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, o);
  }

  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false);
    if (!g) throw new Error('geometria vazia');
    g.computeBoundingSphere();
    return g;
  }
}

/** Prisma triangular deitado ao longo de z (telhado de duas águas): largura em x, altura em y. */
export function gable(w: number, h: number, d: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

/** Cor em vértices a partir de uma geometria indexada já pronta (usado nos hexágonos). */
export function colored(g: THREE.BufferGeometry, rgb: Float32Array): THREE.BufferGeometry {
  g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  return g;
}
