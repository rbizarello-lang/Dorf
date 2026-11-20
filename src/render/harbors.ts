import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Board } from '../core/board';
import { DIRS } from '../core/hex';
import { HARBORS, type Port } from '../core/ports';
import { T } from '../core/tiles';
import { WATER_Y } from './tileBuilder';

function paint(geometry: THREE.BufferGeometry, hex: string) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  const colors = new Float32Array(g.getAttribute('position').count * 3);
  const color = new THREE.Color(hex);
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function combine(parts: THREE.BufferGeometry[]) {
  const geometry = mergeGeometries(parts)!;
  for (const part of parts) part.dispose();
  return geometry;
}

function beam(x: number, y: number, z: number, w: number, h: number, d: number, tint: string) {
  return paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), tint);
}

function log(x: number, y: number, z: number, radius: number, length: number) {
  return paint(new THREE.CylinderGeometry(radius, radius, length, 7).rotateX(Math.PI / 2).translate(x, y, z), '#986b45');
}

/** Toldo de feira, pilha de toras e casco no cavalete distinguem os cais pela forma. */
function dock(port: Port, settled: boolean) {
  const color = HARBORS[port.id].color;
  const parts = [beam(-0.36, -0.03, 0, 0.56, 0.27, 0.49, '#8b8a73'), beam(-0.36, 0.11, 0, 0.58, 0.05, 0.51, '#d8c394')];
  for (let i = 0; i < 5; i++) parts.push(beam(0.02, 0.09, (i - 2) * 0.075, 0.31, 0.05, 0.07, i % 2 ? '#ae8052' : '#c8a071'));
  for (const z of [-0.14, 0.14]) parts.push(beam(0.14, -0.05, z, 0.045, 0.36, 0.045, '#76563c'));
  parts.push(beam(-0.18, 0.36, 0.17, 0.036, 0.58, 0.036, '#654938'), beam(-0.07, 0.58, 0.17, 0.21, 0.12, 0.027, color));
  if (port.id === 0) {
    for (const x of [-0.58, -0.15]) for (const z of [-0.17, 0.17]) parts.push(beam(x, 0.28, z, 0.032, 0.33, 0.032, '#744d39'));
    for (let i = 0; i < 5; i++) {
      for (const side of [-1, 1]) {
        const panel = new THREE.BoxGeometry(0.108, 0.031, 0.25).rotateX(side * 0.37).translate(-0.58 + 0.109 * i, 0.44, side * 0.112);
        parts.push(paint(panel, i % 2 ? '#fff0cc' : '#cd8651'));
      }
    }
  } else if (port.id === 1) {
    for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) parts.push(log(-0.53 + 0.14 * i + 0.07 * row, 0.21 + 0.12 * row, 0, 0.075, 0.43));
  } else {
    for (const z of [-0.13, 0.13]) parts.push(beam(-0.36, 0.23, z, 0.37, 0.21, 0.04, '#a67f55'));
    parts.push(paint(new THREE.SphereGeometry(1, 10, 5).scale(0.16, 0.105, 0.24).translate(-0.36, 0.36, 0), '#834e37'));
  }
  if (settled && port.delivered) parts.push(beam(0.02, 0.17, 0.07, 0.13, 0.12, 0.13, color));
  return parts;
}

function barge(color: string, timber: boolean) {
  const hull = paint(new THREE.SphereGeometry(1, 10, 5).scale(0.11, 0.056, 0.23), '#71472f');
  const mast = beam(0, 0.15, -0.035, 0.015, 0.27, 0.015, '#795637');
  const sail = beam(0, 0.18, -0.07, 0.022, 0.18, 0.16, timber ? '#91dbb8' : '#fff1bd');
  const cargo = timber ? log(0, 0.06, 0.115, 0.04, 0.17) : beam(0, 0.063, 0.13, 0.12, 0.07, 0.1, color);
  return combine([hull, mast, sail, cargo]);
}

type Coord = (q: number, r: number) => { x: number; z: number };

/** Um desenho para os cais; só as barcas em trânsito têm uma malha por frete. */
export class HarborLayer {
  private material = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.88 });
  private docks: THREE.Mesh | null = null;
  private signature = '';
  private ships: { mesh: THREE.Mesh; track: THREE.CurvePath<THREE.Vector3>; progress: number; length: number }[] = [];

  constructor(private readonly scene: THREE.Object3D) {}

  reset() {
    for (const ship of this.ships) {
      ship.mesh.removeFromParent();
      ship.mesh.geometry.dispose();
    }
    this.ships = [];
    this.signature = '';
    this.docks?.removeFromParent();
    this.docks?.geometry.dispose();
    this.docks = null;
  }

  sync(board: Board, settled: (q: number, r: number) => boolean, at: Coord, ground: (x: number, z: number) => number) {
    if (!board.ports.length) return;
    const docks = board.ports.map((port) => {
      const tile = settled(port.q, port.r) ? board.get(port.q, port.r) : undefined;
      const { x, z } = at(port.q, port.r);
      const last = tile ? board.riverPath(port.q, port.r).at(-2) : undefined;
      const edge = last ? DIRS.findIndex(([q, r]) => port.q + q === last[0] && port.r + r === last[1]) : tile?.edges.indexOf(T.Water) ?? -1;
      const yaw = edge < 0 ? 0 : (edge - 1) * Math.PI / 3;
      const y = tile ? ground(x - 0.36 * Math.cos(yaw), z - 0.36 * Math.sin(yaw)) : -0.08;
      return { port, tile, x, y, z, yaw };
    });
    const state = docks.map(({ port, tile, x, y, z, yaw }) => [x, y.toFixed(3), z, yaw, +!!tile, +port.delivered].join(',')).join('|');
    if (state === this.signature) return;
    this.signature = state;
    this.docks?.removeFromParent();
    this.docks?.geometry.dispose();
    const parts = docks.flatMap(({ port, tile, x, y, z, yaw }) => dock(port, !!tile).map((g) => g.rotateY(-yaw).translate(x, y, z)));
    this.docks = new THREE.Mesh(combine(parts), this.material);
    this.docks.name = 'Entrepostos';
    this.scene.add(this.docks);
  }

  depart(board: Board, port: Port, at: Coord, heightOf: (q: number, r: number) => number) {
    const mill = board.ports[1];
    const timber = board.rules.freight === 'madeira' && port.id === 0;
    const from = timber ? [mill.q, mill.r] as const : undefined;
    const path = board.riverPath(port.q, port.r, from).map(([q, r]) => {
      const { x, z } = at(q, r);
      return new THREE.Vector3(x, heightOf(q, r) + WATER_Y + 0.053, z);
    });
    if (path.length < 2) return;
    const track = new THREE.CurvePath<THREE.Vector3>();
    let prev = path[0];
    for (let i = 1; i < path.length - 1; i++) {
      const center = path[i], enter = center.clone().lerp(path[i - 1], 0.19), leave = center.clone().lerp(path[i + 1], 0.19);
      track.add(new THREE.LineCurve3(prev, enter));
      track.add(new THREE.QuadraticBezierCurve3(enter, center, leave));
      prev = leave;
    }
    track.add(new THREE.LineCurve3(prev, path[path.length - 1]));
    const mesh = new THREE.Mesh(barge(HARBORS[port.id].color, timber), this.material);
    mesh.name = 'Frete fluvial';
    mesh.visible = false;
    this.scene.add(mesh);
    this.ships.push({ mesh, track, length: track.getLength(), progress: -0.22 });
  }

  tick(dt: number) {
    for (let i = this.ships.length - 1; i >= 0; i--) {
      const ship = this.ships[i];
      ship.progress += dt;
      if (ship.progress < 0) continue;
      const t = (ship.progress * 2.5) / ship.length;
      if (t >= 1) {
        ship.mesh.removeFromParent();
        ship.mesh.geometry.dispose();
        this.ships.splice(i, 1);
        continue;
      }
      ship.mesh.visible = true;
      ship.track.getPoint(t, ship.mesh.position);
      const next = ship.track.getPoint(Math.min(1, t + 0.002));
      ship.mesh.rotation.y = Math.atan2(next.x - ship.mesh.position.x, next.z - ship.mesh.position.z);
    }
  }
}
