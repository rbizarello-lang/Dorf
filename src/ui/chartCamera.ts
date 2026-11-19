import * as THREE from 'three/webgpu';
import { CameraRig } from '../render/cameraRig';
import { hexToWorld } from '../core/hex';

/** Procura a maior área livre do HUD e projeta os cais nela. Só roda ao enquadrar ou redimensionar. */
export function fitChart(rig: CameraRig, source: THREE.PerspectiveCamera, points: { q: number; r: number }[]) {
  const w = innerWidth, h = innerHeight;
  const obstacles = [...document.querySelectorAll('.score-block,.tools,#manifest,.stack')].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
  const gutter = h <= 530 ? 12 : 4;
  const xs = [4, w - 4], ys = [4, h - 4];
  for (const r of obstacles) { xs.push(Math.max(4, r.left - gutter), Math.min(w - 4, r.right + gutter)); ys.push(Math.max(4, r.top - gutter), Math.min(h - 4, r.bottom + gutter)); }
  const free: { x: number; y: number; width: number; height: number; score: number }[] = [];
  for (const x of xs) for (const right of xs) for (const y of ys) for (const bottom of ys) {
    const width = right - x, height = bottom - y;
    if (width < 90 || height < 65 || obstacles.some((r) => x < r.right && right > r.left && y < r.bottom && bottom > r.top)) continue;
    const score = Math.min(width / 1.5, height) * Math.sqrt(width * height);
    free.push({ x, y, width, height, score });
  }
  free.sort((a, b) => b.score - a.score);
  const camera = source.clone(), probe = new CameraRig();
  camera.aspect = w / h; camera.updateProjectionMatrix();
  probe.yaw = rig.goalYaw; probe.tilt = rig.goalTilt;
  const marks = points.map(({ q, r }) => { const { x, z } = hexToWorld(q, r); return new THREE.Vector3(x, 0.42, z); });
  const target = marks.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / marks.length);
  target.y = 0;
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function ground(x: number, y: number) {
    ray.setFromCamera(new THREE.Vector2(2 * x / w - 1, 1 - 2 * y / h), camera);
    return ray.ray.intersectPlane(plane, new THREE.Vector3());
  }
  for (const safe of free) {
    // Um retângulo contido em outro oferece menos espaço para as mesmas etiquetas.
    if (free.some((other) => other.score > safe.score && other.x <= safe.x && other.y <= safe.y
      && other.x + other.width >= safe.x + safe.width && other.y + other.height >= safe.y + safe.height)) continue;
    for (let d = 7; ; d = Math.min(rig.maxDist, d * 1.12)) {
      probe.target.copy(target); probe.dist = d;
      for (let i = 0; i < 6; i++) {
        probe.apply(camera); camera.updateMatrixWorld();
        const pos = marks.map((v) => v.clone().project(camera));
        const xx = pos.map((v) => (v.x + 1) * w / 2), yy = pos.map((v) => (1 - v.y) * h / 2);
        const l = Math.min(...xx) - 44, r = Math.max(...xx) + 44, t = Math.min(...yy) - 45, b = Math.max(...yy) + 12;
        if (l >= safe.x && r <= safe.x + safe.width && t >= safe.y && b <= safe.y + safe.height) {
          rig.goal.copy(probe.target); rig.goalDist = d; return;
        }
        const a = ground((l + r) / 2, (t + b) / 2), c = ground(safe.x + safe.width / 2, safe.y + safe.height / 2);
        if (a && c) probe.target.add(a.sub(c));
      }
      if (d === rig.maxDist) break;
    }
  }
}

