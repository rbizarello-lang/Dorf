// Câmera orbital: gira sozinha, devagar; mouse e toque giram e aproximam, com limites.
import * as THREE from 'three';
import { PLAZA } from './terrain';

export class Rig {
  yaw = 0.5; pitch = 0.52; dist = 33;
  private vyaw = 0; private vpitch = 0;
  private tDist = 33;
  auto = true;
  private idle = 10;
  private readonly center = new THREE.Vector3(0, 0.7, 0);
  private readonly near = new THREE.Vector3(PLAZA.x, 0.9, PLAZA.z + 0.2);
  private pts = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  readonly MIN = 8.5; readonly MAX = 44;

  constructor(private cam: THREE.PerspectiveCamera, el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.idle = 0; this.vyaw = this.vpitch = 0;
      if (this.pts.size === 2) this.pinch = this.span();
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      this.idle = 0;
      if (this.pts.size === 1) {
        this.yaw -= dx * 0.0055; this.pitch += dy * 0.0042;
        this.vyaw = -dx * 0.0055 * 60; this.vpitch = dy * 0.0042 * 60;
      } else if (this.pts.size === 2) {
        const s = this.span();
        if (this.pinch > 0) this.tDist *= this.pinch / s;
        this.pinch = s;
      }
      this.clamp();
    });
    const up = (e: PointerEvent): void => { this.pts.delete(e.pointerId); this.pinch = 0; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.tDist *= Math.exp(e.deltaY * 0.0012); this.idle = 0; this.clamp(); }, { passive: false });
    this.update(0);
  }

  private span(): number {
    const a = [...this.pts.values()];
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
  }
  private clamp(): void {
    this.pitch = Math.max(0.1, Math.min(1.38, this.pitch));
    this.tDist = Math.max(this.MIN, Math.min(this.MAX, this.tDist));
  }
  setZoom(z: number): void { this.tDist = this.dist = Math.max(this.MIN, Math.min(this.MAX, 33 / Math.max(0.3, z))); }

  update(dt: number): void {
    this.idle += dt;
    if (this.pts.size === 0) {
      this.yaw += this.vyaw * dt; this.pitch += this.vpitch * dt;
      const f = Math.exp(-dt * 4);
      this.vyaw *= f; this.vpitch *= f;
      if (this.auto && this.idle > 4) this.yaw += 0.05 * dt * Math.min(1, (this.idle - 4) / 2);
    }
    this.clamp();
    this.dist += (this.tDist - this.dist) * (1 - Math.exp(-dt * 7));
    // de perto, a câmera passa a olhar para a praça da vila
    const k = THREE.MathUtils.smoothstep(22, 12, this.dist);
    const tgt = this.center.clone().lerp(this.near, k);
    const cp = Math.cos(this.pitch);
    this.cam.position.set(tgt.x + this.dist * cp * Math.sin(this.yaw), tgt.y + this.dist * Math.sin(this.pitch), tgt.z + this.dist * cp * Math.cos(this.yaw));
    this.cam.lookAt(tgt);
  }
}
