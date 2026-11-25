import * as THREE from 'three/webgpu';
import { CameraRig } from '../render/cameraRig';

/** Elementos do HUD que cobrem o tabuleiro (medidos na hora: valem em qualquer janela e tamanho de texto). */
const HUD_BOXES = ['.score-block', '.tools', '.stack', '.quests', '#minimap', '#voyage'];
/** Folga entre a ilha e um cartão, e entre a ilha e a borda da janela (px). */
const GAP = 10;
/** Até quanto o enquadramento pode se afastar do que a fórmula de `frameCamera` pediu. */
const MAX_GROW = 1.6;
/** Pontos projetados por avaliação (o contorno convexo sempre entra). */
const MAX_POINTS = 360;

interface Box { left: number; top: number; right: number; bottom: number }

/** Retângulos (px) dos cartões do HUD que estão à vista agora; vazio no modo foto e no vídeo. */
export function hudBoxes(): Box[] {
  const out: Box[] = [];
  for (const sel of HUD_BOXES) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    out.push({ left: r.left - GAP, top: r.top - GAP, right: r.right + GAP, bottom: r.bottom + GAP });
  }
  return out;
}

/** Contorno convexo (monotone chain) de pontos no plano, para nunca perder as pontas da ilha ao reduzir a amostra. */
function hull(pts: readonly THREE.Vector3[]): THREE.Vector3[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lo: THREE.Vector3[] = [], up: THREE.Vector3[] = [];
  for (const v of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], v) <= 0) lo.pop();
    lo.push(v);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const v = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], v) <= 0) up.pop();
    up.push(v);
  }
  lo.pop();
  up.pop();
  return lo.concat(up);
}

/**
 * Enquadramento automático que respeita o HUD: acha o menor deslocamento do centro da vista (na
 * tela, convertido para o chão) e, se ainda precisar, o menor afastamento, para que nenhum ponto da
 * ilha caia sob um cartão ou fora da janela. Sem sobreposição, nada muda (o centro da ilha segue no
 * centro da tela). Só mexe em `rig.goal` e `rig.goalDist`: inclinação, giro e o zoom de quem joga
 * ficam como estão, e quem centraliza a câmera numa casa (`?at=`, `__goto`...) não passa por aqui.
 * `points` são pontos do tabuleiro no mundo (cantos das casas, na altura do chão).
 */
export function frameBoard(rig: CameraRig, source: THREE.PerspectiveCamera, points: readonly THREE.Vector3[], boxes = hudBoxes()) {
  const w = innerWidth, h = innerHeight;
  if (!points.length || w < 100 || h < 100) return;
  const edge = { left: GAP, top: GAP, right: w - GAP, bottom: h - GAP };
  const hv = hull(points);
  const rest = points.filter((p) => !hv.includes(p));
  const step = Math.max(1, Math.ceil(rest.length / Math.max(1, MAX_POINTS - hv.length)));
  const sample = hv.concat(rest.filter((_, i) => i % step === 0));

  const probe = new CameraRig();
  probe.yaw = rig.goalYaw;
  probe.tilt = rig.goalTilt;
  const camera = new THREE.PerspectiveCamera(source.fov, w / h, source.near, source.far);
  const ray = new THREE.Raycaster();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const coords = new THREE.Vector2(), v = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const ground = (x: number, y: number, out: THREE.Vector3) => {
    ray.setFromCamera(coords.set(x / w * 2 - 1, 1 - y / h * 2), camera);
    return ray.ray.intersectPlane(floor, out);
  };

  /** Quantos pontos ficam fora da janela ou sob um cartão com o alvo em `target` e a distância `d`. */
  const bad = (target: THREE.Vector3, d: number, limit = Infinity) => {
    probe.target.copy(target);
    probe.dist = d;
    probe.apply(camera);
    camera.updateMatrixWorld();
    let n = 0;
    for (const p of sample) {
      v.copy(p).project(camera);
      const x = (v.x + 1) * w / 2, y = (1 - v.y) * h / 2;
      if (v.z < -1 || v.z > 1 || x < edge.left || x > edge.right || y < edge.top || y > edge.bottom || boxes.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) {
        if (++n >= limit) return n;
      }
    }
    return n;
  };

  const d0 = rig.goalDist;
  const base = rig.goal.clone();
  const cand = new THREE.Vector3();
  let best: { target: THREE.Vector3; d: number; n: number; len: number } | null = null;
  const dMax = Math.min(rig.maxDist, d0 * MAX_GROW);
  for (let d = d0; d <= dMax + 1e-6; d = d >= dMax ? Infinity : Math.min(dMax, d * 1.06)) {
    probe.target.copy(base);
    probe.dist = d;
    probe.apply(camera);
    camera.updateMatrixWorld();
    if (!ground(w / 2, h / 2, a)) continue;
    // Desloca o centro da vista numa grade de pontos da tela; vale o de menor deslocamento sem sobreposição.
    // Antes de qualquer teste (que move a câmera de prova): o chão sob cada ponto da grade, na vista base.
    const shifts: { shift: THREE.Vector3; len: number }[] = [];
    for (let iy = -5; iy <= 5; iy++) {
      for (let ix = -5; ix <= 5; ix++) {
        const dx = ix * w * 0.08, dy = iy * h * 0.08;
        if (!ground(w / 2 + dx, h / 2 + dy, b)) continue;
        shifts.push({ shift: b.clone().sub(a), len: Math.hypot(dx / w, dy / h) });
      }
    }
    shifts.sort((p, q) => p.len - q.len);
    let hit: { target: THREE.Vector3; n: number; len: number } | null = null;
    for (const s of shifts) {
      if (hit && hit.n === 0) break;
      cand.copy(base).add(s.shift);
      const n = bad(cand, d);
      if (!hit || n < hit.n) hit = { target: cand.clone(), n, len: s.len };
    }
    if (!hit) continue;
    if (hit.n === 0 && hit.len === 0) {
      best = { target: hit.target, d, n: 0, len: 0 };
      break;
    }
    if (hit.n === 0) {
      // Reduz o deslocamento ao mínimo que ainda livra tudo (busca binária ao longo da reta até o centro).
      let lo = 0, hi = 1;
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        cand.copy(base).lerp(hit.target, mid);
        if (bad(cand, d, 1) === 0) hi = mid;
        else lo = mid;
      }
      cand.copy(base).lerp(hit.target, hi);
      best = { target: cand.clone(), d, n: 0, len: hit.len };
      break;
    }
    if (!best || hit.n < best.n) best = { target: hit.target, d, n: hit.n, len: hit.len };
  }
  if (!best) return;
  rig.goal.copy(best.target);
  rig.goalDist = best.d;
}
