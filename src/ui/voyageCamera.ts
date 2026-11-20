import * as THREE from 'three/webgpu';
import { CameraRig } from '../render/cameraRig';

/** Enquadra a vila e os cais entre os controles. Só roda na abertura e ao pedir a vista da carta. */
export function frameVoyage(rig: CameraRig, source: THREE.PerspectiveCamera, marks: readonly THREE.Vector3[]) {
  const w = innerWidth, h = innerHeight;
  const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
  const panel = box('#voyage'), stack = box('.stack');
  const hint = document.getElementById('hint')!;
  const hintBox = hint.getBoundingClientRect();
  const top = Math.max(box('.score-block').bottom, box('.tools').bottom) + 12;
  const bottom = hintBox.height && hint.style.opacity !== '0' ? hintBox.top - 10 : h - 12;
  const side = { left: panel.right + 10, right: stack.left - 10, top, bottom };
  const upper = { left: 12, right: w - 12, top, bottom: Math.min(panel.top, stack.top) - 10 };
  const areas = [side, upper].filter((a) => a.right - a.left >= 140 && a.bottom - a.top >= 100);
  const span = (a: typeof side) => Math.min((a.right - a.left) / 1.45, a.bottom - a.top);
  areas.sort((a, b) => span(b) - span(a));

  const probe = new CameraRig();
  probe.yaw = rig.goalYaw;
  probe.tilt = rig.goalTilt;
  const camera = new THREE.PerspectiveCamera(source.fov, w / h, source.near, source.far);
  const ray = new THREE.Raycaster();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3(), coords = new THREE.Vector2();
  const from = new THREE.Vector3(), to = new THREE.Vector3();
  const ground = (x: number, y: number, out: THREE.Vector3) => {
    ray.setFromCamera(coords.set(x / w * 2 - 1, 1 - y / h * 2), camera);
    return ray.ray.intersectPlane(floor, out);
  };
  for (const a of areas) {
    for (let d = Math.max(6, rig.goalDist * 0.55); ; d = Math.min(rig.maxDist, d * 1.16)) {
      probe.target.copy(rig.goal);
      probe.dist = d;
      for (let i = 0; i < 4; i++) {
        probe.apply(camera);
        camera.updateMatrixWorld();
        let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
        for (const mark of marks) {
          point.copy(mark).project(camera);
          if (point.z < -1 || point.z > 1) {
            left = -Infinity;
            break;
          }
          const x = (point.x + 1) * w / 2, y = (1 - point.y) * h / 2;
          left = Math.min(left, x - 48);
          right = Math.max(right, x + 48);
          top = Math.min(top, y - 35);
          bottom = Math.max(bottom, y + 22);
        }
        if (!Number.isFinite(left)) break;
        if (left >= a.left && right <= a.right && top >= a.top && bottom <= a.bottom) {
          rig.goal.copy(probe.target);
          rig.goalDist = d;
          return;
        }
        // Move o centro da projeção até o centro do espaço livre, no plano do tabuleiro.
        if (!ground((left + right) / 2, (top + bottom) / 2, from) || !ground((a.left + a.right) / 2, (a.top + a.bottom) / 2, to)) break;
        probe.target.add(from.sub(to));
      }
      if (d === rig.maxDist) break;
    }
  }
}
