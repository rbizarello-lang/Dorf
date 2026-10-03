import * as THREE from 'three/webgpu';
import type { Board, Placed } from '../core/board';
import { DIRS, edgeMid, hexToWorld, hkey, opposite } from '../core/hex';
import { T } from '../core/tiles';
import type { Theme } from '../themes/types';
import { instGeometry, setInstColor, type Lib } from './lib';
import { WAKES, WAKE_MAX, WAKE_N } from './materials';
import { railCurve, ROAD_Y, WATER_Y } from './tileBuilder';

// Vida do mapa: tudo que se move depois de assentado.
// - pás de moinho e rodas d'água girando
// - animais pastando (passeio aleatório perto de "casa")
// - barcos percorrendo a rede de rios e veículos a rede de estradas/trilhos
// - bandos de pássaros circulando
// - aldeões trabalhando nas construções e andando pelas estradas (só de perto e de dia)
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
  pool: 'sails' | 'wheel' | 'rotor';
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

interface Worker {
  key: 'folk:axe' | 'folk:hoe' | 'folk:sack';
  anim: 'chop' | 'tend' | 'carry';
  base: THREE.Matrix4;
  color: THREE.Color;
  phase: number;
}

/** Teto de aldeões (nas construções e nas estradas). */
const FOLK_MAX = 120;

interface Mover {
  boat: boolean;
  /** Aldeão a pé na estrada (anda na beira, devagar), com a cor da camisa. */
  folk?: boolean;
  shirt?: THREE.Color;
  tile: Placed;
  /** Borda de entrada (-1 = centro) e de saída (-1 = centro). */
  a: number;
  b: number;
  t: number;
  len: number;
  /** Traçado na peça atual, em coordenadas do mundo (x, z intercalados), e o comprimento acumulado. */
  route: number[];
  cum: number[];
  speed: number;
  wait: number;
  trail: { x: number; z: number }[];
  x: number;
  z: number;
  heading: number;
  /** Força da esteira (0 parado, 1 andando), suavizada para nascer e sumir devagar. */
  wake: number;
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
  /** Bando de passagem (levantou voo num marco): sobe com `vh` e some quando `ttl` acaba. */
  vh?: number;
  ttl?: number;
}

export class Life {
  private root = new THREE.Group();
  private pools = new Map<string, AnimPool>();
  private spinners: Spinner[] = [];
  private animals: Animal[] = [];
  private movers: Mover[] = [];
  private wakeList: Mover[] = [];
  private flocks: Flock[] = [];
  private workers: Worker[] = [];
  /** Batedor do começo da partida: vai do Centro até a beira, olha o sítio e volta. */
  private scoutRide: { x0: number; z0: number; x1: number; z1: number; t: number } | null = null;
  /** Os aldeões só aparecem de perto (`World` atualiza a cada quadro). */
  folkNear = true;
  /** 1 de dia; vai a 0 em ~1 s quando a noite passa de 0,6 (os aldeões "vão para casa"). */
  private home = 1;
  night = 0;
  private board: Board | null = null;
  private theme!: Theme;
  /** Cor dos animais de carroça/caravana (as partes de locomotiva ignoram a tinta). */
  private beast = new THREE.Color(1, 1, 1);
  /** Cor da casa (destaque do tema): bandeira dos barcos e camisa de metade dos caminhantes. */
  private house = new THREE.Color(1, 1, 1);
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
    this.workers = [];
    this.scoutRide = null;
    this.theme = theme;
    this.beast.set(theme.animals.colors[0]);
    this.house.set(theme.ui.accent);
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
    if (key !== 'sails' && key !== 'wheel' && key !== 'rotor') return;
    if (!this.pool(key)) return;
    this.spinners.push({ pool: key, base: world.clone(), axis: axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), speed: key === 'sails' ? 0.9 + Math.random() * 0.4 : key === 'rotor' ? 2.2 + Math.random() * 0.6 : 1.4, phase: Math.random() * 6 });
  }

  addAnimal(world: THREE.Matrix4, color: THREE.Color) {
    if (!this.pool('animal')) return;
    const p = new THREE.Vector3().setFromMatrixPosition(world);
    const s = new THREE.Vector3().setFromMatrixScale(world).x;
    this.animals.push({ x: p.x, z: p.z, y: p.y, hx: p.x, hz: p.z, heading: Math.random() * Math.PI * 2, speed: 0, pause: Math.random() * 3, s, color: color.clone(), phase: Math.random() * 6 });
  }

  addWorker(key: string, world: THREE.Matrix4, color: THREE.Color, anim: 'chop' | 'tend' | 'carry') {
    if (key !== 'folk:axe' && key !== 'folk:hoe' && key !== 'folk:sack') return;
    if (this.folkCount() >= FOLK_MAX || !this.pool(key)) return;
    this.workers.push({ key, anim, base: world.clone(), color: color.clone(), phase: Math.random() * 20 });
  }

  scout(x0: number, z0: number, x1: number, z1: number) {
    if (this.pool('scout')) this.scoutRide = { x0, z0, x1, z1, t: 0 };
  }

  private folkCount() {
    let n = this.workers.length;
    for (const m of this.movers) if (m.folk) n++;
    return n;
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
        const have = this.movers.filter((m) => !m.boat && !m.folk && keys.has(m.tile.key)).length;
        const want = Math.min(2, 1 + Math.floor(net.length / 10));
        for (let k = have; k < want && this.movers.filter((m) => !m.boat && !m.folk).length < carsCap; k++) this.spawn(net, false);
      }
    }
    if (this.lib.geo('folk:sack')) {
      for (const net of networks(board, T.Rail)) {
        if (net.length < 3) continue;
        const keys = new Set(net.map((p) => p.key));
        const have = this.movers.filter((m) => m.folk && keys.has(m.tile.key)).length;
        const want = Math.min(3, 1 + Math.floor(net.length / 8));
        for (let k = have; k < want && this.folkCount() < FOLK_MAX; k++) this.spawn(net, false, true);
      }
    }
    if (th.period !== 'futuro' && !this.flocks.some((f) => f.ttl === undefined) && board.list.length >= 6) {
      for (let f = 0; f < 3; f++) {
        const t = board.list[Math.floor(Math.random() * board.list.length)];
        const { x, z } = hexToWorld(t.q, t.r);
        this.flocks.push({ cx: x, cz: z, tx: x, tz: z, r: 1.2 + Math.random() * 1.6, h: 1.5 + Math.random() * 0.8, w: (Math.random() < 0.5 ? -1 : 1) * (0.22 + Math.random() * 0.15), ang: Math.random() * 6, n: 5 + Math.floor(Math.random() * 3), retarget: 10 + Math.random() * 20 });
      }
    }
  }

  private spawn(net: Placed[], boat: boolean, folk = false) {
    const terr = boat ? T.Water : T.Rail;
    const tile = net[Math.floor(Math.random() * net.length)];
    const exits = strictEdges(tile, terr);
    const b = exits[Math.floor(Math.random() * exits.length)];
    // Peça com 2+ bordas: nasce sobre o traçado (borda→borda). Nascer no centro deixaria o
    // mover fora da curva e, se `b` fosse uma borda aberta, preso indo e voltando.
    const others = exits.filter((e) => e !== b);
    const a = others.length ? others[Math.floor(Math.random() * others.length)] : -1;
    const th = this.theme;
    const speed = folk ? 0.045 + Math.random() * 0.015 : boat ? 0.16 + Math.random() * 0.06 : th.vehicle === 'maglev' ? 0.7 : th.vehicle === 'steam' ? 0.42 : 0.17;
    const { x, z } = hexToWorld(tile.q, tile.r);
    const roofs = th.houses.flatMap((h) => h.roofs);
    const shirt = folk ? new THREE.Color(Math.random() < 0.5 ? th.ui.accent : roofs[Math.floor(Math.random() * roofs.length)]) : undefined;
    const m: Mover = { boat, folk, shirt, tile, a, b, t: Math.random() * 0.5, len: 1, route: [], cum: [], speed, wait: 0, trail: [], x, z, heading: 0, wake: 0 };
    this.setRoute(m);
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
    this.updateFolk(dt);
    this.updateScout(dt);
    this.updateBirds(dt);
  }

  private updateScout(dt: number) {
    const p = this.pools.get('scout');
    const r = this.scoutRide;
    if (!p) return;
    if (!r) {
      p.commit(0);
      return;
    }
    // Ida a 0,12 unidade/s, 2,5 s olhando o sítio, volta, e some no Centro.
    const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
    const go = len / 0.12, look = 2.5;
    r.t += dt;
    const back = r.t > go + look;
    const k = r.t < go ? r.t / go : back ? 1 - (r.t - go - look) / go : 1;
    if (k < 0) {
      this.scoutRide = null;
      p.commit(0);
      return;
    }
    const e = k * k * (3 - 2 * k);
    const heading = Math.atan2(r.z1 - r.z0, r.x1 - r.x0) + (back ? Math.PI : 0);
    const moving = r.t < go || back;
    const bob = moving ? Math.abs(Math.sin(this.time * 8)) * 0.005 : 0;
    // Sai e volta crescendo/encolhendo, para não brotar do nada dentro do Centro.
    const s = Math.min(1, k * 6);
    q4.setFromAxisAngle(UP, -heading);
    m4.compose(v3.set(r.x0 + (r.x1 - r.x0) * e, 0.004 + bob, r.z0 + (r.z1 - r.z0) * e), q4, s3.setScalar(1.3 * s));
    p.set(0, m4, this.beast);
    p.commit(1);
  }

  private updateFolk(dt: number) {
    this.home = THREE.MathUtils.clamp(this.home + (this.night > 0.6 ? -dt : dt), 0, 1);
    const show = this.folkNear && this.home > 0;
    const pools = { 'folk:axe': this.pools.get('folk:axe'), 'folk:hoe': this.pools.get('folk:hoe'), 'folk:sack': this.pools.get('folk:sack') };
    for (const p of Object.values(pools)) if (p) p.mesh.visible = show;
    if (!show) return;
    const n = { 'folk:axe': 0, 'folk:hoe': 0, 'folk:sack': 0 };
    const s = this.home;
    const t = this.time;
    for (const w of this.workers) {
      const p = pools[w.key];
      if (!p) continue;
      if (w.anim === 'chop') {
        // Quatro golpes a 1,4 Hz, depois 1 s de pausa.
        const cyc = (t + w.phase) % (4 / 1.4 + 1);
        const a = cyc < 4 / 1.4 ? Math.pow(Math.sin(Math.PI * ((cyc * 1.4) % 1)), 2) * 0.7 : 0;
        m4.copy(w.base).multiply(m4b.makeRotationZ(-a));
      } else if (w.anim === 'tend') {
        const y = 1 - 0.15 * Math.max(0, Math.sin((t + w.phase) * 1.6));
        m4.copy(w.base).multiply(m4b.makeScale(1, y, 1));
      } else {
        // Vai e volta 0,12 a 0,05 unidade/s, com uma parada em cada ponta.
        const per = (0.12 / 0.05) * 2 + 2;
        const c = (t + w.phase) % per;
        const half = per / 2;
        const k = c < half ? c : c - half;
        const d = Math.min(1, Math.max(0, (k - 0.5) / (half - 1))) * 0.12;
        const back = c >= half;
        const walking = k > 0.5 && k < half - 0.5;
        m4.copy(w.base).multiply(m4b.makeTranslation(back ? 0.12 - d : d, walking ? Math.abs(Math.sin((t + w.phase) * 9)) * 0.003 : 0, 0));
        if (back) m4.multiply(m4b.makeRotationY(Math.PI));
      }
      if (s < 1) m4.multiply(m4b.makeScale(s, s, s));
      p.set(n[w.key]++, m4, w.color);
    }
    const sack = pools['folk:sack'];
    if (sack) {
      const roadY = ROAD_Y[this.theme.road];
      for (const m of this.movers) {
        if (!m.folk) continue;
        // Anda pela beira direita da estrada.
        const side = 0.045;
        const ox = -Math.sin(m.heading) * side, oz = Math.cos(m.heading) * side;
        const bob = m.wait > 0 ? 0 : Math.abs(Math.sin(t * 9 + m.speed * 50)) * 0.003;
        q4.setFromAxisAngle(UP, -m.heading);
        m4.compose(v3.set(m.x + ox, roadY + bob, m.z + oz), q4, s3.setScalar(s));
        sack.set(n['folk:sack']++, m4, m.shirt);
      }
    }
    for (const [k, c] of Object.entries(n)) pools[k as keyof typeof n]?.commit(c);
  }

  /** Monta o traçado de borda a borda na peça atual. A via de trem refaz a curva do
   * tileBuilder (mesmas bordas locais e semente) e gira com a peça. */
  private setRoute(m: Mover) {
    const { x: cx, z: cz } = hexToWorld(m.tile.q, m.tile.r);
    const end = (e: number): [number, number] => (e < 0 ? [0, 0] : edgeMid(e));
    let pts: [number, number][];
    if (m.a < 0 || m.b < 0) pts = [end(m.a), end(m.b)];
    else if (!m.boat) {
      const rot = m.tile.rot;
      const c = Math.cos((rot * Math.PI) / 3), s = Math.sin((rot * Math.PI) / 3);
      // Rotação em y de -rot·60°: no plano XZ (atan2(z, x)) o ângulo cresce rot·60°.
      pts = railCurve(m.tile.def.edges, m.tile.def.seed, (m.a - rot + 6) % 6, (m.b - rot + 6) % 6, m.tile.def.special === 'station').map(([x, z]) => [x * c - z * s, x * s + z * c]);
    } else if (strictEdges(m.tile, T.Water).length === 2) {
      const [A, B] = [end(m.a), end(m.b)];
      pts = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16, u = 1 - t;
        pts.push([u * u * A[0] + t * t * B[0], u * u * A[1] + t * t * B[1]]);
      }
    } else pts = [end(m.a), [0, 0], end(m.b)];
    m.route.length = 0;
    m.cum.length = 0;
    let acc = 0;
    pts.forEach(([x, z], k) => {
      if (k) acc += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
      m.route.push(cx + x, cz + z);
      m.cum.push(acc);
    });
    m.len = Math.max(acc, 0.05);
  }

  private pathPos(m: Mover, t: number, out: { x: number; z: number }) {
    const d = t * m.cum[m.cum.length - 1];
    let k = 1;
    while (k < m.cum.length - 1 && m.cum[k] < d) k++;
    const seg = m.cum[k] - m.cum[k - 1];
    const f = seg > 0 ? (d - m.cum[k - 1]) / seg : 0;
    out.x = m.route[2 * k - 2] + (m.route[2 * k] - m.route[2 * k - 2]) * f;
    out.z = m.route[2 * k - 1] + (m.route[2 * k + 1] - m.route[2 * k - 1]) * f;
  }

  /** Posição de um barco andando, ou null (capturas das esteiras). */
  boatPos(): { x: number; z: number } | null {
    const m = this.movers.find((m) => m.boat && m.wait <= 0);
    return m ? { x: m.x, z: m.z } : null;
  }

  /** Posição do i-ésimo aldeão de construção, ou null (capturas). */
  workerPos(i: number): { x: number; z: number } | null {
    const w = this.workers[i];
    return w ? { x: w.base.elements[12], z: w.base.elements[14] } : null;
  }

  /** Esteiras para o shader da água: os barcos andando mais perto de (x, z). */
  wakes(x: number, z: number) {
    const near = this.wakeList;
    near.length = 0;
    for (const m of this.movers) if (m.boat && m.wake > 0.01) near.push(m);
    const d2 = (m: Mover) => (m.x - x) ** 2 + (m.z - z) ** 2;
    if (near.length > WAKE_MAX) near.sort((a, b) => d2(a) - d2(b));
    const n = Math.min(WAKE_MAX, near.length);
    for (let i = 0; i < n; i++) {
      const m = near[i];
      (WAKES.array[i] as THREE.Vector4).set(m.x, m.z, Math.cos(m.heading) * m.wake, Math.sin(m.heading) * m.wake);
    }
    WAKE_N.value = n;
  }

  private advance(m: Mover) {
    const board = this.board!;
    const terr = m.boat ? T.Water : T.Rail;
    if (m.b < 0) {
      // Chegou ao centro de um beco (lago, estação): volta por onde veio.
      m.b = m.a;
      m.a = -1;
      m.wait = m.boat ? 0.5 : m.folk ? 3 : 1.8;
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
        m.wait = m.boat ? 0.4 : m.folk ? 2.5 : 1.2;
      }
    }
    m.t = 0;
    this.setRoute(m);
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
      if (m.folk) continue;
      if (m.boat) {
        m.wake += ((m.wait > 0 ? 0 : 1) - m.wake) * Math.min(1, dt * 1.5);
        const bob = Math.sin(this.time * 2 + m.speed * 40) * 0.003;
        q4.setFromAxisAngle(UP, -m.heading);
        m4.compose(v3.set(m.x, WATER_Y - 0.001 + bob, m.z), q4, s3.setScalar(1));
        m4.multiply(m4b.makeRotationX(Math.sin(this.time * 1.6 + m.speed * 30) * 0.05));
        boats?.set(bi++, m4, this.house);
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

  /** Um bando sai do chão em espiral e vai embora; temas sem pássaros (futuro) ficam sem. */
  flush(x: number, z: number) {
    if (!this.theme || this.theme.period === 'futuro') return;
    if (this.flocks.filter((f) => f.ttl !== undefined).length >= 2) return;
    const w = (Math.random() < 0.5 ? -1 : 1) * 0.9;
    this.flocks.push({ cx: x, cz: z, tx: x + (Math.random() - 0.5) * 8, tz: z + (Math.random() - 0.5) * 8, r: 0.35, h: 0.25, w, ang: Math.random() * 6, n: 9, retarget: 99, vh: 0.55, ttl: 7 });
  }

  private updateBirds(dt: number) {
    const bp = this.flocks.length ? this.pool('bird', false) : null;
    if (!bp) return;
    this.flocks = this.flocks.filter((f) => f.ttl === undefined || f.ttl > 0);
    let i = 0;
    for (const f of this.flocks) {
      if (f.ttl !== undefined) {
        f.ttl -= dt;
        f.h += f.vh! * dt;
        f.r = Math.min(2.4, f.r + dt * 0.5);
        f.w *= Math.exp(-dt * 0.15);
      }
      f.ang += f.w * dt;
      f.retarget -= dt;
      if (f.retarget < 0 && this.board?.list.length) {
        const t = this.board.list[Math.floor(Math.random() * this.board.list.length)];
        const w = hexToWorld(t.q, t.r);
        f.tx = w.x;
        f.tz = w.z;
        f.retarget = 15 + Math.random() * 25;
      }
      const pull = f.ttl !== undefined ? 0.25 : 0.05;
      f.cx += (f.tx - f.cx) * Math.min(1, dt * pull);
      f.cz += (f.tz - f.cz) * Math.min(1, dt * pull);
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
      vehicles: this.movers.filter((m) => !m.boat && !m.folk).length,
      folk: this.folkCount(),
      scout: this.scoutRide ? 1 : 0,
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
