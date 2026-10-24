// Câmera orbital: gira sozinha, devagar; mouse e toque giram e aproximam, com limites. Cada vista tem o seu enquadramento.
import * as THREE from 'three';

export interface RigCfg {
  target: [number, number, number]; dist: number; pitch: number; yaw: number;
  min: number; max: number;
  /** Se definido, a órbita automática balança em torno do giro inicial em vez de dar a volta. */
  sway?: number;
  pitchMin?: number; pitchMax?: number;
}

export class Rig {
  yaw = 0.5; pitch = 0.52; dist = 20;
  cfg!: RigCfg;
  private vyaw = 0; private vpitch = 0;
  private tDist = 20;
  auto = true;
  private idle = 10;
  private tgt = new THREE.Vector3();
  private tgtGoal = new THREE.Vector3();
  private pts = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  private clock = 0;
  private swayBase = 0;

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
  }

  private span(): number {
    const a = [...this.pts.values()];
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
  }
  private clamp(): void {
    const c = this.cfg;
    this.pitch = Math.max(c.pitchMin ?? 0.12, Math.min(c.pitchMax ?? 1.4, this.pitch));
    this.tDist = Math.max(c.min, Math.min(c.max, this.tDist));
    if (c.sway !== undefined) this.yaw = Math.max(this.swayBase - c.sway * 1.6, Math.min(this.swayBase + c.sway * 1.6, this.yaw));
  }

  /** Vai para o enquadramento de uma vista; `zoom` e `yaw` (graus) vêm dos ganchos de URL. */
  goto(c: RigCfg, o: { zoom?: number | null; yaw?: number | null; pitch?: number | null; instant?: boolean } = {}): void {
    this.cfg = c;
    this.tgtGoal.set(...c.target);
    this.yaw = o.yaw != null ? (o.yaw * Math.PI) / 180 : c.yaw;
    this.swayBase = o.yaw != null ? this.yaw : c.yaw;
    this.pitch = o.pitch != null ? (o.pitch * Math.PI) / 180 : c.pitch;
    const d = Math.max(c.min, Math.min(c.max, c.dist / Math.max(0.25, o.zoom ?? 1)));
    this.tDist = d;
    this.dist = o.instant ? d : d * 1.28;
    if (o.instant) this.tgt.copy(this.tgtGoal);
    this.idle = 10; this.clock = 0;
    this.vyaw = this.vpitch = 0;
    this.update(0);
  }

  update(dt: number): void {
    this.idle += dt; this.clock += dt;
    if (this.pts.size === 0) {
      this.yaw += this.vyaw * dt; this.pitch += this.vpitch * dt;
      const f = Math.exp(-dt * 4);
      this.vyaw *= f; this.vpitch *= f;
      if (this.auto && this.idle > 3) {
        const k = Math.min(1, (this.idle - 3) / 2);
        if (this.cfg.sway !== undefined) this.yaw += Math.cos(this.clock * 0.18) * this.cfg.sway * 0.18 * dt * k;
        else this.yaw += 0.05 * dt * k;
      }
    }
    this.clamp();
    this.dist += (this.tDist - this.dist) * (1 - Math.exp(-dt * 4));
    this.tgt.lerp(this.tgtGoal, 1 - Math.exp(-dt * 5));
    const cp = Math.cos(this.pitch);
    this.cam.position.set(this.tgt.x + this.dist * cp * Math.sin(this.yaw), this.tgt.y + this.dist * Math.sin(this.pitch), this.tgt.z + this.dist * cp * Math.cos(this.yaw));
    this.cam.lookAt(this.tgt);
  }
}
