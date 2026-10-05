import * as THREE from 'three/webgpu';

/** Inclinação permitida (radianos acima do chão): de quase rasante, com o horizonte, à vista de mapa. */
export const PITCH_MIN = 0.31;
export const PITCH_MAX = 1.31;

/**
 * Lente: campo de visão vertical em graus. `LENS` encurta a distância real da câmera para que
 * cada valor de `dist` enquadre o mesmo pedaço do chão que enquadrava com a lente antiga de 32°;
 * a lente mais aberta dá perspectiva (o perto fica maior que o longe) e tira o achatado.
 */
export const FOV = 40;
export const LENS = Math.tan((32 / 2) * THREE.MathUtils.DEG2RAD) / Math.tan((FOV / 2) * THREE.MathUtils.DEG2RAD);

/** Câmera orbital suave: alvo no chão, distância, giro e inclinação com amortecimento. */
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
  /** Ajuste de inclinação de quem joga, somado à curva do zoom (radianos). */
  tilt = 0;
  goalTilt = 0;
  /** Sem amortecimento: a câmera chega no mesmo quadro (opção "menos movimento"). */
  snap = false;

  /**
   * Ângulo acima do chão. A curva do zoom fica baixa como no Dorfromantik: 32° de perto, ~38° no
   * zoom inicial e no máximo 50° de longe; a vista de mapa fica com quem inclina.
   */
  pitch() {
    return THREE.MathUtils.clamp(this.basePitch(this.dist) + this.tilt, PITCH_MIN, PITCH_MAX);
  }

  basePitch(dist: number) {
    const t = (dist - this.minDist) / (this.maxDist - this.minDist);
    return THREE.MathUtils.lerp(0.56, 0.87, Math.sqrt(THREE.MathUtils.clamp(t, 0, 1)));
  }

  /** Distância real da câmera ao alvo (a lente mais aberta chega mais perto). */
  get eye() {
    return this.dist * LENS;
  }

  update(dt: number) {
    const k = this.snap ? 1 : 1 - Math.exp(-dt * 9);
    this.target.lerp(this.goal, k);
    this.yaw += (this.goalYaw - this.yaw) * k;
    this.dist += (this.goalDist - this.dist) * k;
    this.tilt += (this.goalTilt - this.tilt) * k;
  }

  apply(camera: THREE.PerspectiveCamera) {
    const p = this.pitch();
    const e = this.eye;
    const c = Math.cos(p) * e;
    camera.position.set(this.target.x + Math.sin(this.yaw) * c, this.target.y + Math.sin(p) * e, this.target.z + Math.cos(this.yaw) * c);
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

  /** Inclina (positivo sobe para a vista de mapa). O ajuste fica preso à faixa em toda distância. */
  incline(d: number) {
    this.goalTilt = this.clampTilt(this.goalTilt + d);
  }

  /** Prende o ajuste para que a inclinação final caiba na faixa no zoom de destino. */
  clampTilt(tilt: number) {
    const b = this.basePitch(this.goalDist);
    return THREE.MathUtils.clamp(tilt, PITCH_MIN - b, PITCH_MAX - b);
  }

  private clamp() {
    const r = Math.hypot(this.goal.x, this.goal.z);
    const max = this.bounds + 4;
    if (r > max) this.goal.multiplyScalar(max / r);
  }
}
