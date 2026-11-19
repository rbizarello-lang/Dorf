import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hexToWorld, DIRS, opposite } from '../core/hex';
import { HARBORS, type Port } from '../core/ports';
import { T } from '../core/tiles';
import type { Board, Placed } from '../core/board';

type Point = ReturnType<typeof hexToWorld>;

/** Só busca o trajeto quando sai uma entrega. O desempate segue a ordem fixa das bordas. */
function shippingLane(board: Board, port: Port) {
  const origin = board.list[0];
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

/** Os três cais usam um único desenho. Só o casco de cada entrega em trânsito se move. */
export class HarborView extends THREE.Group {
  private material = new THREE.MeshBasicNodeMaterial({ vertexColors: true });
  private docks = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
  private barges: { mesh: THREE.Mesh; path: Point[]; progress: number }[] = [];
  private state = '';

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
    const path = shippingLane(board, port);
    if (path.length < 2) return;
    const hull = paint(new THREE.SphereGeometry(1, 8, 4).scale(0.12, 0.055, 0.25), '#663f2e');
    const sail = timber(0.024, 0.18, 0, 0.018, 0.22, 0.18, '#fff1bd');
    const cargo = timber(0, 0.081, 0.13, 0.12, 0.09, 0.11, HARBORS[port.id].color);
    const mesh = new THREE.Mesh(combine([hull, sail, cargo]), this.material);
    mesh.position.set(path[0].x, 0.09, path[0].z);
    this.add(mesh);
    this.barges.push({ mesh, path, progress: 0 });
  }

  tick(dt: number) {
    for (let i = this.barges.length - 1; i >= 0; i--) {
      const b = this.barges[i];
      b.progress += dt * 1.8;
      const index = Math.floor(b.progress);
      if (index >= b.path.length - 1) {
        this.remove(b.mesh);
        b.mesh.geometry.dispose();
        this.barges.splice(i, 1);
        continue;
      }
      const a = b.path[index], c = b.path[index + 1], t = b.progress - index;
      b.mesh.position.set(a.x + (c.x - a.x) * t, 0.09, a.z + (c.z - a.z) * t);
      b.mesh.rotation.y = Math.atan2(c.x - a.x, c.z - a.z);
    }
  }
}
