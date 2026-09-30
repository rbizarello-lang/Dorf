import * as THREE from 'three';

/** Câmera orbital suave: alvo no chão, distância e giro com amortecimento. */
export class CameraRig {
  readonly target = new THREE.Vector3();
  readonly goal = new THREE.Vector3();
  yaw = 0.55;
  goalYaw = 0.55;
  dist = 8.5;
  goalDist = 8.5;
  readonly minDist = 3.2;
  readonly maxDist = 46;
  bounds = 6;

  pitch() {
    const t = (this.dist - this.minDist) / (this.maxDist - this.minDist);
    return THREE.MathUtils.lerp(0.68, 1.12, Math.sqrt(Math.max(0, t)));
  }

  update(dt: number) {
    const k = 1 - Math.exp(-dt * 9);
    this.target.lerp(this.goal, k);
    this.yaw += (this.goalYaw - this.yaw) * k;
    this.dist += (this.goalDist - this.dist) * k;
  }

  apply(camera: THREE.PerspectiveCamera) {
    const p = this.pitch();
    const c = Math.cos(p) * this.dist;
    camera.position.set(this.target.x + Math.sin(this.yaw) * c, this.target.y + Math.sin(p) * this.dist, this.target.z + Math.cos(this.yaw) * c);
    camera.lookAt(this.target);
  }

  panWorld(dx: number, dz: number, immediate = false) {
    this.goal.x += dx;
    this.goal.z += dz;
    this.clamp();
    if (immediate) this.target.copy(this.goal);
  }

  /** Pan relativo à tela (teclado): dx para a direita, dy para frente. */
  panScreen(dx: number, dy: number) {
    const s = this.dist * 0.08;
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    this.panWorld((rx * dx + fx * dy) * s, (rz * dx + fz * dy) * s);
  }

  zoom(factor: number) {
    this.goalDist = THREE.MathUtils.clamp(this.goalDist * factor, this.minDist, this.maxDist);
  }

  rotate(d: number) {
    this.goalYaw += d;
  }

  private clamp() {
    const r = Math.hypot(this.goal.x, this.goal.z);
    const max = this.bounds + 4;
    if (r > max) this.goal.multiplyScalar(max / r);
  }
}
