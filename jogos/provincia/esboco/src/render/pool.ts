// Pool: um InstancedMesh com a lista de itens (posição, giro, escala, animação de entrada).
import * as THREE from 'three';

export interface Item {
  cell: number; tag: string;
  x: number; y: number; z: number; yaw: number; s: number;
  t0: number;
  anim: 'pop' | 'drop' | 'grow' | 'none';
  col?: THREE.Color;
  parent?: Item; local?: THREE.Matrix4;
  m: THREE.Matrix4;
  /** Escalas não uniformes extras (janelas altas). */
  sx?: number; sy?: number; sz?: number;
  /** Balanço de boia (barcos) em amplitude. */
  bob?: number;
  /** Balanço de pêndulo em torno do eixo x (sino), em radianos. */
  swing?: number;
}

const easeOutBack = (p: number): number => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };

/** Queda com quique: desce, achata no impacto, sobe um pouco e assenta. */
export function dropCurve(t: number): { dy: number; sy: number; sxz: number } {
  if (t < 0) return { dy: 3, sy: 0.001, sxz: 0.001 };
  if (t < 0.4) { const u = t / 0.4; return { dy: 2.2 * (1 - u * u), sy: 1 + 0.1 * u, sxz: 1 - 0.04 * u }; }
  if (t < 0.6) { const u = (t - 0.4) / 0.2; return { dy: 0.24 * Math.sin(u * Math.PI), sy: 1 - 0.22 * (1 - u) * (1 - u), sxz: 1 + 0.1 * (1 - u) * (1 - u) }; }
  if (t < 0.78) { const u = (t - 0.6) / 0.18; return { dy: 0.06 * Math.sin(u * Math.PI), sy: 1, sxz: 1 }; }
  return { dy: 0, sy: 1, sxz: 1 };
}

const WHITE = new THREE.Color(1, 1, 1);
const P = new THREE.Vector3(), S = new THREE.Vector3(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), MZ = new THREE.Matrix4().makeScale(0, 0, 0);

export class Pool {
  readonly mesh: THREE.InstancedMesh;
  items: Item[] = [];
  dirty = true;
  /** Sempre atualiza (barcos balançando, janelas que seguem a casa). */
  always = false;
  private until = 0;
  reduced = false;

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, readonly cap: number, o: { cast?: boolean; receive?: boolean; name?: string } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = o.cast ?? true;
    this.mesh.receiveShadow = o.receive ?? true;
    this.mesh.name = o.name ?? '';
    const w = new THREE.Color(1, 1, 1);
    for (let i = 0; i < cap; i++) this.mesh.setColorAt(i, w);
  }

  make(cell: number, tag: string, x: number, y: number, z: number, yaw: number, s: number, t0: number, anim: Item['anim']): Item {
    const it: Item = { cell, tag, x, y, z, yaw, s, t0, anim, m: new THREE.Matrix4() };
    if (this.items.length >= this.cap) return it; // sem espaço: não desenha, mas não quebra
    this.items.push(it);
    this.dirty = true;
    this.until = Math.max(this.until, t0 + 1.4);
    return it;
  }

  removeCell(cell: number, tag?: string): void {
    const n = this.items.length;
    this.items = this.items.filter((it) => !(it.cell === cell && (tag === undefined || it.tag === tag)));
    if (this.items.length !== n) this.dirty = true;
  }

  clear(): void { this.items = []; this.dirty = true; }

  refresh(time: number): void {
    if (!(this.dirty || this.always || time < this.until)) return;
    const mesh = this.mesh;
    mesh.count = this.items.length;
    this.items.forEach((it, n) => {
      const age = time - it.t0;
      let sc = it.s, dy = 0, sy = 1, sxz = 1;
      if (age < 0) sc = 0;
      else if (this.reduced) sc = it.s;
      else if (it.anim === 'pop') sc = it.s * easeOutBack(Math.min(1, age / 0.55));
      else if (it.anim === 'grow') sc = it.s * (0.78 + 0.22 * easeOutBack(Math.min(1, age / 0.5)));
      else if (it.anim === 'drop') { const d = dropCurve(age); dy = d.dy; sy = d.sy; sxz = d.sxz; }
      if (it.parent) {
        if (sc === 0 || it.parent.m.elements[0] === 0) it.m.copy(MZ);
        else it.m.multiplyMatrices(it.parent.m, it.local!);
      } else {
        P.set(it.x, it.y + dy + (it.bob ? Math.sin(time * 1.3 + it.x * 3) * it.bob : 0), it.z);
        Q.setFromAxisAngle(Y, it.yaw);
        if (it.bob) { const r = Math.sin(time * 1.1 + it.z * 2) * it.bob * 1.2; Q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), r)); }
        if (it.swing) Q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.sin(time * 2.6 + it.x * 5) * it.swing));
        S.set(sc * sxz * (it.sx ?? 1), sc * sy * (it.sy ?? 1), sc * sxz * (it.sz ?? 1));
        it.m.compose(P, Q, S);
        if (sc === 0) it.m.copy(MZ);
      }
      mesh.setMatrixAt(n, it.m);
      mesh.setColorAt(n, it.col ?? WHITE);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.dirty = false;
  }
}
