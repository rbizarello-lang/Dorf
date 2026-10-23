// Pool: um InstancedMesh com a lista de itens. Adaptado do Pool da Ilha das Lanternas:
// aqui cada item tem escala-base, fator dinâmico (a estação mexe nele) e visibilidade animada (o ano).
import * as THREE from 'three';

export interface PItem {
  x: number; y: number; z: number; yaw: number; rx: number; rz: number;
  bx: number; by: number; bz: number;
  kx: number; ky: number; kz: number;
  vis: number; p: number; dir: number; wait: number;
  col: THREE.Color;
  /** Livre para o chamador (variante de cor, fase, etc.). */
  a: number; b: number;
}

const easeOutBack = (p: number): number => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };

const Pq = new THREE.Vector3(), Sq = new THREE.Vector3(), Qq = new THREE.Quaternion(), Eq = new THREE.Euler(0, 0, 0, 'YXZ');
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const WHITE = new THREE.Color(1, 1, 1);

export class Pool {
  readonly mesh: THREE.InstancedMesh;
  items: PItem[] = [];
  dirty = true;
  /** Sempre recompõe as matrizes (itens que se mexem a cada quadro). */
  always = false;
  /** Se definido, todos os itens olham para a câmera (brilhos). */
  billboard: THREE.Quaternion | null = null;

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, readonly cap: number, o: { cast?: boolean; receive?: boolean; name?: string } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = o.cast ?? true;
    this.mesh.receiveShadow = o.receive ?? true;
    this.mesh.name = o.name ?? '';
    this.mesh.setColorAt(0, WHITE);
  }

  add(x: number, y: number, z: number, yaw = 0, s = 1, o: Partial<PItem> = {}): PItem {
    const it: PItem = { x, y, z, yaw, rx: 0, rz: 0, bx: s, by: s, bz: s, kx: 1, ky: 1, kz: 1, vis: 1, p: 1, dir: 0, wait: 0, col: new THREE.Color(1, 1, 1), a: 0, b: 0, ...o };
    if (this.items.length < this.cap) this.items.push(it);
    this.dirty = true;
    return it;
  }

  /** Nasce ou some com animação (o ano, a estação). */
  show(it: PItem, on: boolean, delay = 0, instant = false): void {
    if (instant) { it.p = on ? 1 : 0; it.vis = it.p; it.dir = 0; it.wait = 0; this.dirty = true; return; }
    const d = on ? 1 : -1;
    if (it.dir === d || (it.dir === 0 && (it.p >= 1) === on)) return;
    it.dir = d; it.wait = delay;
  }

  step(dt: number): void {
    for (const it of this.items) {
      if (it.dir === 0) continue;
      if (it.wait > 0) { it.wait -= dt; continue; }
      it.p += (it.dir * dt) / 0.9;
      if (it.p >= 1 || it.p <= 0) { it.p = it.p >= 1 ? 1 : 0; it.dir = 0; }
      it.vis = it.dir >= 0 && it.p > 0 && it.p < 1 ? easeOutBack(it.p) : it.p * it.p;
      if (it.dir === 0) it.vis = it.p;
      this.dirty = true;
    }
  }

  refresh(): void {
    if (!(this.dirty || this.always)) return;
    const m = this.mesh;
    m.count = this.items.length;
    const mat = new THREE.Matrix4();
    for (let n = 0; n < this.items.length; n++) {
      const it = this.items[n];
      const sx = it.bx * it.kx * it.vis, sy = it.by * it.ky * it.vis, sz = it.bz * it.kz * it.vis;
      if (sx < 1e-4 || sy < 1e-4 || sz < 1e-4) { m.setMatrixAt(n, ZERO); continue; }
      if (this.billboard) Qq.copy(this.billboard); else { Eq.set(it.rx, it.yaw, it.rz); Qq.setFromEuler(Eq); }
      Pq.set(it.x, it.y, it.z); Sq.set(sx, sy, sz);
      mat.compose(Pq, Qq, Sq);
      m.setMatrixAt(n, mat);
      m.setColorAt(n, it.col);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    this.dirty = false;
  }
}
