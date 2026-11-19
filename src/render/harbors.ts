import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hexToWorld, DIRS, opposite } from '../core/hex';
import { HARBORS, type Port } from '../core/ports';
import { T } from '../core/tiles';
import type { Board, Placed } from '../core/board';

type Point = ReturnType<typeof hexToWorld>;

/** Só busca o trajeto quando sai uma entrega. O desempate segue a ordem fixa das bordas. */
function shippingLane(board: Board, port: Port, origin: Placed) {
  const queue = [origin];
  const parent = new Map<Placed, Placed | null>([[origin, null]]);
  for (let i = 0; i < queue.length; i++) {
    const tile = queue[i];
    if (tile.q === port.q && tile.r === port.r) {
      const points: Point[] = [];
      for (let p: Placed | null = tile; p; p = parent.get(p) ?? null) points.push(hexToWorld(p.q, p.r));
      return points.reverse();
    }
    for (let s = 0; s < 6; s++) {
      if (tile.edges[s] !== T.Water) continue;
      const [dq, dr] = DIRS[s], neighbor = board.get(tile.q + dq, tile.r + dr);
      if (neighbor?.edges[opposite(s)] !== T.Water || parent.has(neighbor)) continue;
      parent.set(neighbor, tile);
      queue.push(neighbor);
    }
  }
  return [];
}

/** Recorta só o miolo da curva para a barca continuar cruzando a borda entre hexágonos. */
function sailingTrack(points: Point[]) {
  const centers = points.map(({ x, z }) => new THREE.Vector2(x, z));
  const track = [centers[0]];
  for (let i = 1; i < centers.length - 1; i++) {
    const center = centers[i];
    const enter = center.clone().lerp(centers[i - 1], 0.22);
    const exit = center.clone().lerp(centers[i + 1], 0.22);
    track.push(...new THREE.QuadraticBezierCurve(enter, center, exit).getPoints(6));
  }
  track.push(centers[centers.length - 1]);
  let length = 0;
  return track.map((point, i) => {
    if (i) length += point.distanceTo(track[i - 1]);
    return { point, length };
  });
}

function paint(geometry: THREE.BufferGeometry, color: string) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  const n = g.getAttribute('position').count;
  const values = new Float32Array(n * 3), c = new THREE.Color(color);
  for (let i = 0; i < n; i++) c.toArray(values, 3 * i);
  g.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return g;
}

function log(x: number, y: number, z: number, radius: number, length: number) {
  return paint(new THREE.CylinderGeometry(radius, radius, length, 7).rotateX(Math.PI / 2).translate(x, y, z), '#986b45');
}

/** Um mercado coberto, uma pilha de toras e um casco no cavalete se distinguem pela silhueta. */
function warehouse(id: number) {
  const parts: THREE.BufferGeometry[] = [
    timber(-0.29, 0.015, -0.19, 0.58, 0.17, 0.48, '#8b8a73'),
    timber(-0.29, 0.105, -0.19, 0.62, 0.055, 0.51, '#d8c394'),
  ];
  if (id === 0) {
    for (const x of [-0.52, -0.06]) for (const z of [-0.37, -0.02]) parts.push(timber(x, 0.30, z, 0.032, 0.38, 0.032, '#744d39'));
    for (let i = 0; i < 5; i++) {
      const x = -0.53 + 0.12 * i;
      for (const sign of [-1, 1]) {
        const roof = new THREE.BoxGeometry(0.121, 0.035, 0.30).rotateX(sign * 0.37).translate(x, 0.49, -0.19 + sign * 0.133);
        parts.push(paint(roof, i % 2 ? '#fff0cc' : '#cd8651'));
      }
    }
    parts.push(timber(-0.28, 0.21, 0, 0.47, 0.15, 0.08, '#aa7952'));
  } else if (id === 1) {
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 3 - layer; i++) {
      parts.push(log(-0.46 + i * 0.15 + layer * 0.075, 0.20 + layer * 0.12, -0.17, 0.08, 0.53));
    }
    parts.push(timber(-0.29, 0.24, -0.36, 0.52, 0.15, 0.035, '#624a34'));
  } else {
    parts.push(paint(new THREE.SphereGeometry(1, 8, 4).scale(0.22, 0.11, 0.34).translate(-0.29, 0.29, -0.16), '#834e37'));
    for (const x of [-0.53, -0.06]) parts.push(timber(x, 0.39, -0.37, 0.045, 0.53, 0.045, '#a67f55'));
    parts.push(timber(-0.30, 0.64, -0.37, 0.58, 0.055, 0.065, '#dec590'));
    parts.push(timber(-0.28, 0.52, -0.37, 0.018, 0.22, 0.018, '#594830'));
  }
  return parts;
}

function combine(parts: THREE.BufferGeometry[]) {
  const mesh = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return mesh;
}

function timber(x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
  return paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color);
}

function sailcloth(outline: THREE.Shape, color: string) {
  return paint(new THREE.ExtrudeGeometry(outline, { depth: 0.008, bevelEnabled: false, curveSegments: 3 }).rotateY(-Math.PI / 2), color);
}

/** Os três cais usam um único desenho. Só o casco de cada entrega em trânsito se move. */
export class HarborView extends THREE.Group {
  private material = new THREE.MeshBasicNodeMaterial({ vertexColors: true });
  private docks = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
  private barges: { mesh: THREE.Mesh; track: ReturnType<typeof sailingTrack>; distance: number; next: number }[] = [];
  private state = '';
  private timberBarge: THREE.Mesh | undefined;

  constructor() {
    super();
    this.add(this.docks);
    this.docks.visible = false;
  }

  reset() {
    for (const b of this.barges) {
      this.remove(b.mesh);
      b.mesh.geometry.dispose();
    }
    this.barges.length = 0;
    this.timberBarge = undefined;
  }

  sync(ports: readonly Port[]) {
    const state = ports.map((p) => [p.q, p.r, +p.delivered].join(',')).join('|');
    if (this.state === state) return;
    this.state = state;
    this.docks.visible = ports.length > 0;
    const parts: THREE.BufferGeometry[] = [];
    for (const p of ports) {
      const { x, z } = hexToWorld(p.q, p.r), color = HARBORS[p.id].color;
      const local = warehouse(p.id);
      for (let i = 0; i < 5; i++) local.push(timber(0.26, 0.095, i * 0.09 - 0.18, 0.43, 0.055, 0.082, i % 2 ? '#ae8052' : '#c8a071'));
      for (const dx of [0.1, 0.42]) for (const dz of [-0.16, 0.16]) local.push(timber(dx, 0, dz, 0.045, 0.32, 0.045, '#76563c'));
      local.push(timber(0.43, 0.40, 0.13, 0.035, 0.72, 0.035, '#654938'));
      local.push(timber(0.56, 0.65, 0.13, 0.27, 0.16, 0.018, color));
      local.push(timber(0.49, 0.65, 0.13, 0.038, 0.16, 0.026, '#fff2c8'));
      if (p.delivered) {
        for (let i = 0; i <= p.id; i++) local.push(timber(0.16 + i * 0.1, 0.19, -0.02, 0.095, 0.14, 0.12, color));
      } else {
        // Rumo cartográfico sob o tabuleiro. As peças cobrem a tinta à medida que o rio avança.
        const length = Math.hypot(x, z);
        for (let d = 1.05; d < length - 0.82; d += 0.36) {
          const dash = new THREE.PlaneGeometry(0.035, 0.18).rotateX(-Math.PI / 2).rotateY(Math.atan2(x, z));
          parts.push(paint(dash.translate(x * d / length, -0.115, z * d / length), '#7b9287'));
        }
        local.push(paint(new THREE.RingGeometry(0.72, 0.76, 6).rotateX(-Math.PI / 2).translate(0, -0.10, 0), color));
      }
      for (const g of local) parts.push(g.translate(x, 0, z));
    }
    this.docks.geometry.dispose();
    this.docks.geometry = parts.length ? combine(parts) : new THREE.BufferGeometry();
  }

  depart(board: Board, port: Port) {
    const timberFreight = board.rules.combinedFreight && port.id === 0;
    const sawmill = board.ports[1];
    const origin = timberFreight ? board.get(sawmill.q, sawmill.r) : board.list[0];
    if (!origin) return;
    const path = shippingLane(board, port, origin);
    if (path.length < 2) return;
    if (timberFreight && this.timberBarge) {
      const old = this.barges.findIndex((b) => b.mesh === this.timberBarge);
      if (old >= 0) {
        const [b] = this.barges.splice(old, 1);
        this.remove(b.mesh);
        b.mesh.geometry.dispose();
      }
    }
    const hull = paint(new THREE.SphereGeometry(1, 8, 4).scale(0.12, 0.055, 0.25), '#663f2e');
    const mast = timber(0, 0.20, -0.065, 0.016, 0.37, 0.016, '#795637');
    const sheet = new THREE.Shape();
    sheet.moveTo(-0.06, 0.32);
    sheet.quadraticCurveTo(0.00, 0.25, 0.15, 0.14);
    sheet.quadraticCurveTo(0.02, 0.09, -0.06, 0.13);
    sheet.closePath();
    const sail = sailcloth(sheet, timberFreight ? '#63c5a3' : '#fff1bd');
    const flag = new THREE.Shape();
    flag.moveTo(-0.065, 0.385);
    flag.lineTo(0.07, 0.36);
    flag.lineTo(-0.065, 0.34);
    flag.closePath();
    const cargo = timberFreight
      ? [log(-0.045, 0.08, 0.08, 0.045, 0.21), log(0.045, 0.08, 0.08, 0.045, 0.21), sailcloth(flag, '#f4c663')]
      : [timber(0, 0.081, 0.13, 0.12, 0.09, 0.11, HARBORS[port.id].color)];
    const mesh = new THREE.Mesh(combine([hull, mast, sail, ...cargo]), this.material);
    mesh.position.set(path[0].x, 0.09, path[0].z);
    this.add(mesh);
    mesh.rotation.y = Math.atan2(path[1].x - path[0].x, path[1].z - path[0].z);
    this.barges.push({ mesh, track: sailingTrack(path), distance: 0, next: 1 });
    if (timberFreight) this.timberBarge = mesh;
    return mesh;
  }

  tick(dt: number) {
    for (let i = this.barges.length - 1; i >= 0; i--) {
      const b = this.barges[i];
      b.distance += dt * 3.1;
      while (b.next < b.track.length && b.track[b.next].length <= b.distance) b.next++;
      if (b.next >= b.track.length) {
        this.remove(b.mesh);
        b.mesh.geometry.dispose();
        if (b.mesh === this.timberBarge) this.timberBarge = undefined;
        this.barges.splice(i, 1);
        continue;
      }
      const a = b.track[b.next - 1], c = b.track[b.next];
      const t = (b.distance - a.length) / (c.length - a.length);
      const dx = c.point.x - a.point.x, dz = c.point.y - a.point.y;
      b.mesh.position.set(a.point.x + dx * t, 0.09, a.point.y + dz * t);
      b.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }
}
