import * as THREE from 'three/webgpu';
import type { Board, Placed } from '../core/board';
import { DIRS, edgeMid, hexToWorld, hkey, opposite } from '../core/hex';
import { T } from '../core/tiles';
import type { Theme } from '../themes/types';
import { instGeometry, setInstColor, type Lib } from './lib';
import { ROAD_Y, WATER_Y } from './tileBuilder';

// Vida do mapa: tudo que se move depois de assentado.
// - pás de moinho e rodas d'água girando
// - animais pastando (passeio aleatório perto de "casa")
// - barcos percorrendo a rede de rios e veículos a rede de estradas/trilhos
// - bandos de pássaros circulando
// Cada tipo é um InstancedMesh cujas matrizes são reescritas a cada quadro (poucas centenas).

const m4 = new THREE.Matrix4();
const m4b = new THREE.Matrix4();
const q4 = new THREE.Quaternion();
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const WHITE = new THREE.Color(1, 1, 1);

class AnimPool {
  mesh: THREE.InstancedMesh;
  count = 0;
  private cap: number;
  constructor(
    private geo: THREE.BufferGeometry,
    private mat: THREE.Material,
    private parent: THREE.Object3D,
    cap = 32,
    private shadows = true,
  ) {
    this.cap = cap;
    this.mesh = this.make(cap);
  }

  private make(cap: number, colors?: Float32Array) {
    const m = new THREE.InstancedMesh(instGeometry(this.geo, cap, colors), this.mat, cap);
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = this.shadows;
    m.receiveShadow = true;
    this.parent.add(m);
    return m;
  }

  /** Garante espaço para o índice i (cresce dobrando). */
  ensure(i: number) {
    if (i < this.cap) return;
    const old = this.mesh;
    while (this.cap <= i) this.cap *= 2;
    this.mesh = this.make(this.cap, old.geometry.getAttribute('iColor').array as Float32Array);
    (this.mesh.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
    this.parent.remove(old);
    old.geometry.dispose();
    old.dispose();
  }

  set(i: number, m: THREE.Matrix4, c?: THREE.Color) {
    this.ensure(i);
    this.mesh.setMatrixAt(i, m);
    if (c) setInstColor(this.mesh, i, c);
    if (i >= this.count) this.count = i + 1;
  }

  commit(count = this.count) {
    this.count = count;
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.getAttribute('iColor').needsUpdate = true;
  }

  dispose() {
    this.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

interface Spinner {
  pool: 'sails' | 'wheel';
  base: THREE.Matrix4;
  axis: THREE.Vector3;
  speed: number;
  phase: number;
}

interface Animal {
  x: number;
  z: number;
  y: number;
  hx: number;
  hz: number;
  heading: number;
  speed: number;
  pause: number;
  s: number;
  color: THREE.Color;
  phase: number;
}

interface Mover {
  boat: boolean;
  tile: Placed;
  /** Borda de entrada (-1 = centro) e de saída (-1 = centro). */
  a: number;
  b: number;
  t: number;
  len: number;
  speed: number;
  wait: number;
  trail: { x: number; z: number }[];
  x: number;
  z: number;
  heading: number;
}

interface Flock {
  cx: number;
  cz: number;
  tx: number;
  tz: number;
  r: number;
  h: number;
  w: number;
  ang: number;
  n: number;
  retarget: number;
}

export class Life {
  private root = new THREE.Group();
  private pools = new Map<string, AnimPool>();
  private spinners: Spinner[] = [];
  private animals: Animal[] = [];
  private movers: Mover[] = [];
  private flocks: Flock[] = [];
  private board: Board | null = null;
  private theme!: Theme;
  /** Cor dos animais de carroça/caravana (as partes de locomotiva ignoram a tinta). */
  private beast = new THREE.Color(1, 1, 1);
  private time = 0;

  constructor(
    private lib: Lib,
    parent: THREE.Object3D,
  ) {
    parent.add(this.root);
  }

  reset(theme: Theme) {
    for (const p of this.pools.values()) p.dispose();
    this.pools.clear();
    this.spinners = [];
    this.animals = [];
    this.movers = [];
    this.flocks = [];
    this.theme = theme;
    this.beast.set(theme.animals.colors[0]);
  }

  private pool(key: string, shadows = true) {
    let p = this.pools.get(key);
    if (!p) {
      const geo = this.lib.geo(key);
      if (!geo) return null;
      p = new AnimPool(geo, this.lib.material(key), this.root, 32, shadows);
      this.pools.set(key, p);
    }
    return p;
  }

  addSpinner(key: string, world: THREE.Matrix4, axis: 'x' | 'z') {
    if (key !== 'sails' && key !== 'wheel') return;
    if (!this.pool(key)) return;
    this.spinners.push({ pool: key, base: world.clone(), axis: axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), speed: key === 'sails' ? 0.9 + Math.random() * 0.4 : 1.4, phase: Math.random() * 6 });
  }

  addAnimal(world: THREE.Matrix4, color: THREE.Color) {
    if (!this.pool('animal')) return;
    const p = new THREE.Vector3().setFromMatrixPosition(world);
    const s = new THREE.Vector3().setFromMatrixScale(world).x;
    this.animals.push({ x: p.x, z: p.z, y: p.y, hx: p.x, hz: p.z, heading: Math.random() * Math.PI * 2, speed: 0, pause: Math.random() * 3, s, color: color.clone(), phase: Math.random() * 6 });
  }

  /** Recalcula as redes de rio/estrada e cria barcos, veículos e pássaros que faltam. */
  sync(board: Board) {
    this.board = board;
    const th = this.theme;
    const boatsCap = 14, carsCap = 8;
    if (this.lib.geo('boat')) {
      for (const net of networks(board, T.Water)) {
        if (net.length < 3) continue;
        const keys = new Set(net.map((p) => p.key));
        const have = this.movers.filter((m) => m.boat && keys.has(m.tile.key)).length;
        const want = Math.min(3, 1 + Math.floor(net.length / 6));
        for (let k = have; k < want && this.movers.filter((m) => m.boat).length < boatsCap; k++) this.spawn(net, true);
      }
    }
    if (this.lib.geo('vehicle:head')) {
      for (const net of networks(board, T.Rail)) {
        if (net.length < 3) continue;
        const keys = new Set(net.map((p) => p.key));
        const have = this.movers.filter((m) => !m.boat && keys.has(m.tile.key)).length;
        const want = Math.min(2, 1 + Math.floor(net.length / 10));
        for (let k = have; k < want && this.movers.filter((m) => !m.boat).length < carsCap; k++) this.spawn(net, false);
      }
    }
    if (th.period !== 'futuro' && !this.flocks.length && board.list.length >= 6) {
      for (let f = 0; f < 3; f++) {
        const t = board.list[Math.floor(Math.random() * board.list.length)];
        const { x, z } = hexToWorld(t.q, t.r);
        this.flocks.push({ cx: x, cz: z, tx: x, tz: z, r: 1.2 + Math.random() * 1.6, h: 1.5 + Math.random() * 0.8, w: (Math.random() < 0.5 ? -1 : 1) * (0.22 + Math.random() * 0.15), ang: Math.random() * 6, n: 5 + Math.floor(Math.random() * 3), retarget: 10 + Math.random() * 20 });
      }
    }
  }

  private spawn(net: Placed[], boat: boolean) {
    const terr = boat ? T.Water : T.Rail;
    const tile = net[Math.floor(Math.random() * net.length)];
    const exits = strictEdges(tile, terr);
    const b = exits[Math.floor(Math.random() * exits.length)];
    // Peça com 2+ bordas: nasce sobre o traçado (borda→borda). Nascer no centro deixaria o
    // mover fora da curva e, se `b` fosse uma borda aberta, preso indo e voltando.
    const others = exits.filter((e) => e !== b);
    const a = others.length ? others[Math.floor(Math.random() * others.length)] : -1;
    const th = this.theme;
    const speed = boat ? 0.16 + Math.random() * 0.06 : th.vehicle === 'maglev' ? 0.7 : th.vehicle === 'steam' ? 0.42 : 0.17;
    const { x, z } = hexToWorld(tile.q, tile.r);
    const m: Mover = { boat, tile, a, b, t: Math.random() * 0.5, len: a < 0 ? 0.87 : Math.abs(a - b) === 3 ? 1.73 : 1.45, speed, wait: 0, trail: [], x, z, heading: 0 };
    this.movers.push(m);
  }

  update(dt: number) {
    this.time += dt;
    // Pás e rodas.
    const counts: Record<string, number> = {};
    for (const s of this.spinners) {
      const p = this.pools.get(s.pool)!;
      const i = (counts[s.pool] = (counts[s.pool] ?? -1) + 1);
      q4.setFromAxisAngle(s.axis, this.time * s.speed + s.phase);
      m4.makeRotationFromQuaternion(q4);
      m4b.copy(s.base).multiply(m4);
      p.set(i, m4b);
    }
    for (const [k, c] of Object.entries(counts)) this.pools.get(k)!.commit(c + 1);

    // Animais: andam um pouco, param, pastam.
    const ap = this.pools.get('animal');
    if (ap && this.animals.length) {
      this.animals.forEach((a, i) => {
        if (a.pause > 0) {
          a.pause -= dt;
          a.speed = Math.max(0, a.speed - dt * 0.1);
        } else {
          a.speed = Math.min(0.025, a.speed + dt * 0.05);
          const dx = a.hx - a.x, dz = a.hz - a.z;
          if (dx * dx + dz * dz > 0.07 * 0.07) a.heading += angleDiff(a.heading, Math.atan2(dz, dx)) * Math.min(1, dt * 2);
          else a.heading += (Math.random() - 0.5) * dt * 2;
          if (Math.random() < dt * 0.35) a.pause = 1 + Math.random() * 3.5;
        }
        a.x += Math.cos(a.heading) * a.speed * dt;
        a.z += Math.sin(a.heading) * a.speed * dt;
        const bob = a.speed > 0.005 ? Math.abs(Math.sin(this.time * 9 + a.phase)) * 0.004 : 0;
        const graze = a.pause > 0 ? Math.sin(this.time * 1.3 + a.phase) * 0.12 - 0.08 : 0;
        q4.setFromAxisAngle(UP, -a.heading);
        m4.compose(v3.set(a.x, a.y + bob, a.z), q4, s3.setScalar(a.s));
        if (graze) m4.multiply(m4b.makeRotationZ(graze));
        ap.set(i, m4, a.color);
      });
      ap.commit(this.animals.length);
    }

    this.updateMovers(dt);
    this.updateBirds(dt);
  }

  private pathPos(m: Mover, t: number, out: { x: number; z: number }) {
    const { x: cx, z: cz } = hexToWorld(m.tile.q, m.tile.r);
    const A = m.a < 0 ? [cx, cz] : [cx + edgeMid(m.a)[0], cz + edgeMid(m.a)[1]];
    const B = m.b < 0 ? [cx, cz] : [cx + edgeMid(m.b)[0], cz + edgeMid(m.b)[1]];
    if (m.a < 0 || m.b < 0) {
      out.x = A[0] + (B[0] - A[0]) * t;
      out.z = A[1] + (B[1] - A[1]) * t;
    } else if (m.boat || strictEdges(m.tile, T.Rail).length === 2) {
      const u = 1 - t;
      out.x = u * u * A[0] + 2 * u * t * cx + t * t * B[0];
      out.z = u * u * A[1] + 2 * u * t * cz + t * t * B[1];
    } else if (t < 0.5) {
      out.x = A[0] + (cx - A[0]) * t * 2;
      out.z = A[1] + (cz - A[1]) * t * 2;
    } else {
      out.x = cx + (B[0] - cx) * (t - 0.5) * 2;
      out.z = cz + (B[1] - cz) * (t - 0.5) * 2;
    }
  }

  private advance(m: Mover) {
    const board = this.board!;
    const terr = m.boat ? T.Water : T.Rail;
    if (m.b < 0) {
      // Chegou ao centro de um beco (lago, estação): volta por onde veio.
      m.b = m.a;
      m.a = -1;
      m.wait = m.boat ? 0.5 : 1.8;
    } else {
      const [dq, dr] = DIRS[m.b];
      const n = board.tiles.get(hkey(m.tile.q + dq, m.tile.r + dr));
      if (n && n.edges[opposite(m.b)] === terr) {
        const entry = opposite(m.b);
        const exits = strictEdges(n, terr).filter((e) => e !== entry);
        m.tile = n;
        m.a = entry;
        m.b = exits.length ? exits[Math.floor(Math.random() * exits.length)] : -1;
      } else {
        // Borda aberta (fim do mapa): meia-volta.
        const a = m.a;
        m.a = m.b;
        m.b = a;
        m.wait = m.boat ? 0.4 : 1.2;
      }
    }
    m.t = 0;
    m.len = m.a < 0 || m.b < 0 ? 0.87 : Math.abs(m.a - m.b) === 3 ? 1.73 : 1.45;
  }

  private updateMovers(dt: number) {
    const boats = this.pool('boat');
    const head = this.pool('vehicle:head');
    const car = this.pool('vehicle:car');
    if (!this.movers.length) {
      boats?.commit(0);
      head?.commit(0);
      car?.commit(0);
      return;
    }
    const th = this.theme;
    const cars = th.vehicle === 'cart' ? 1 : 2;
    const spacing = th.vehicle === 'steam' ? 0.078 : th.vehicle === 'maglev' ? 0.074 : th.vehicle === 'cart' ? 0.058 : 0.068;
    const roadY = ROAD_Y[th.road];
    let bi = 0, hi = 0, ci = 0;
    const pos = { x: 0, z: 0 };
    const ahead = { x: 0, z: 0 };
    for (const m of this.movers) {
      if (m.wait > 0) m.wait -= dt;
      else {
        m.t += (m.speed * dt) / m.len;
        let guard = 0;
        while (m.t >= 1 && guard++ < 4) this.advance(m);
      }
      this.pathPos(m, Math.min(m.t, 1), pos);
      this.pathPos(m, Math.min(m.t + 0.02, 1), ahead);
      if (Math.hypot(ahead.x - pos.x, ahead.z - pos.z) > 1e-5) m.heading = Math.atan2(ahead.z - pos.z, ahead.x - pos.x);
      m.x = pos.x;
      m.z = pos.z;
      if (m.boat) {
        const bob = Math.sin(this.time * 2 + m.speed * 40) * 0.003;
        q4.setFromAxisAngle(UP, -m.heading);
        m4.compose(v3.set(m.x, WATER_Y - 0.001 + bob, m.z), q4, s3.setScalar(1));
        m4.multiply(m4b.makeRotationX(Math.sin(this.time * 1.6 + m.speed * 30) * 0.05));
        boats?.set(bi++, m4);
        continue;
      }
      // Rastro para os vagões seguirem a locomotiva.
      const last = m.trail[0];
      if (!last || Math.hypot(last.x - m.x, last.z - m.z) > 0.006) {
        m.trail.unshift({ x: m.x, z: m.z });
        if (m.trail.length > 120) m.trail.length = 120;
      }
      const bounce = th.vehicle === 'caravan' ? Math.abs(Math.sin(this.time * 7)) * 0.004 : 0;
      q4.setFromAxisAngle(UP, -m.heading);
      m4.compose(v3.set(m.x, roadY + bounce, m.z), q4, s3.setScalar(1));
      head?.set(hi++, m4, this.beast);
      for (let k = 1; k <= cars; k++) {
        const p = trailAt(m.trail, spacing * k);
        if (!p) break;
        q4.setFromAxisAngle(UP, -p.heading);
        const b2 = th.vehicle === 'caravan' ? Math.abs(Math.sin(this.time * 7 + k)) * 0.004 : 0;
        m4.compose(v3.set(p.x, roadY + b2, p.z), q4, s3.setScalar(1));
        car?.set(ci++, m4, this.beast);
      }
    }
    boats?.commit(bi);
    head?.commit(hi);
    car?.commit(ci);
  }

  private updateBirds(dt: number) {
    const bp = this.flocks.length ? this.pool('bird', false) : null;
    if (!bp) return;
    let i = 0;
    for (const f of this.flocks) {
      f.ang += f.w * dt;
      f.retarget -= dt;
      if (f.retarget < 0 && this.board?.list.length) {
        const t = this.board.list[Math.floor(Math.random() * this.board.list.length)];
        const w = hexToWorld(t.q, t.r);
        f.tx = w.x;
        f.tz = w.z;
        f.retarget = 15 + Math.random() * 25;
      }
      f.cx += (f.tx - f.cx) * Math.min(1, dt * 0.05);
      f.cz += (f.tz - f.cz) * Math.min(1, dt * 0.05);
      const x = f.cx + Math.cos(f.ang) * f.r;
      const z = f.cz + Math.sin(f.ang) * f.r;
      const heading = f.ang + (f.w > 0 ? Math.PI / 2 : -Math.PI / 2);
      const hx = Math.cos(heading), hz = Math.sin(heading);
      for (let k = 0; k < f.n; k++) {
        const row = Math.ceil(k / 2), side = k % 2 ? 1 : -1;
        const bx = x - hx * row * 0.07 - hz * side * row * 0.06;
        const bz = z - hz * row * 0.07 + hx * side * row * 0.06;
        const flap = 0.35 + 0.65 * Math.abs(Math.sin(this.time * 7 + k * 1.3));
        q4.setFromAxisAngle(UP, -heading);
        m4.compose(v3.set(bx, f.h + Math.sin(this.time * 1.5 + k) * 0.03, bz), q4, s3.set(1, 1, flap));
        bp.set(i++, m4, WHITE);
      }
    }
    bp.commit(i);
  }

  counts() {
    return {
      boats: this.movers.filter((m) => m.boat).length,
      vehicles: this.movers.filter((m) => !m.boat).length,
      animals: this.animals.length,
      spinners: this.spinners.length,
      birds: this.flocks.reduce((a, f) => a + f.n, 0),
    };
  }

  dispose() {
    for (const p of this.pools.values()) p.dispose();
    this.pools.clear();
  }
}

function angleDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function strictEdges(p: Placed, terr: T) {
  const out: number[] = [];
  for (let i = 0; i < 6; i++) if (p.edges[i] === terr) out.push(i);
  return out;
}

/** Componentes conexas da rede de um terreno contínuo (rio ou estrada). */
function networks(board: Board, terr: T): Placed[][] {
  const seen = new Set<number>();
  const out: Placed[][] = [];
  for (const start of board.list) {
    if (seen.has(start.key) || !start.edges.includes(terr)) continue;
    const net: Placed[] = [];
    const stack = [start];
    seen.add(start.key);
    while (stack.length) {
      const t = stack.pop()!;
      net.push(t);
      for (let i = 0; i < 6; i++) {
        if (t.edges[i] !== terr) continue;
        const n = board.tiles.get(hkey(t.q + DIRS[i][0], t.r + DIRS[i][1]));
        if (n && !seen.has(n.key) && n.edges[opposite(i)] === terr) {
          seen.add(n.key);
          stack.push(n);
        }
      }
    }
    out.push(net);
  }
  return out;
}

/** Ponto a uma distância `d` para trás no rastro, com a direção do trecho. */
function trailAt(trail: { x: number; z: number }[], d: number) {
  let acc = 0;
  for (let i = 0; i < trail.length - 1; i++) {
    const a = trail[i], b = trail[i + 1];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (acc + seg >= d) {
      const t = (d - acc) / (seg || 1);
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(a.z - b.z, a.x - b.x) };
    }
    acc += seg;
  }
  return null;
}
