// O diorama inteiro: cena, luz, pools instanciados, vida pequena e as transições de estação, hora e ano.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mulberry32, smooth, clamp01 } from './rng';
import { SEASON_LOOKS, HOUR_LOOKS, cloneLook, lerpLook, type SeasonLook, type HourLook } from './looks';
import {
  Terrain, heightAt, HALF, HOUSES, FIELDS, ORCHARD, PEN, MILL, PLAZA, ROADS, ROAD_MAIN, LAKE, STREAM_A, STREAM_W,
  distRoads, distStream, distPoly, lakeE, fieldMask, type V2,
} from './terrain';
import * as K from './kits';
import { buildFrame, glowTexture, mistTexture, GLASS_HALF, GLASS_TOP } from './frame';
import { Pool, type PItem } from './pool';

class Tween<T extends object> {
  from: T; to: T; cur: T; p = 1;
  constructor(init: T, readonly dur: number) { this.from = cloneLook(init); this.to = cloneLook(init); this.cur = cloneLook(init); }
  go(target: T, instant: boolean): void {
    this.from = cloneLook(this.cur); this.to = target;
    if (instant) { this.p = 1; this.cur = cloneLook(target); } else this.p = 0;
  }
  step(dt: number): boolean {
    if (this.p >= 1) return false;
    this.p = Math.min(1, this.p + dt / this.dur);
    const e = this.p * this.p * (3 - 2 * this.p);
    lerpLook(this.cur, this.from, this.to, e);
    return true;
  }
}

const lit = (o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...o });
const mix = (a: THREE.Color, b: THREE.Color, t: number, out = new THREE.Color()): THREE.Color => out.copy(a).lerp(b, t);
const WHITE = new THREE.Color(1, 1, 1);

interface HouseInst {
  kit: 'cot' | 'hou'; x: number; z: number; yaw: number; s: number;
  wall: PItem; roof: PItem; snow: PItem; win: PItem;
  v1: boolean; v3: boolean; grows: boolean; chim: THREE.Vector3;
  glows: { it: PItem; thr: number; world: THREE.Vector3 }[];
}
interface TreeRec { x: number; z: number; blobs: PItem[]; orchard: boolean; cherry: boolean; apples: PItem[] }

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.5, 120);
  stats = { calls: 0, triangles: 0 };
  timeScale = 1;
  t = 0;
  season = 0; hour = 1; year = 1;
  readonly sTw: Tween<SeasonLook>;
  readonly hTw: Tween<HourLook>;
  private Y = 0; private Yt = 0;
  private needApply = true;
  private lightsDirty = true;

  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private pts: THREE.PointLight[] = [];
  private terrain: Terrain;
  private water: THREE.Mesh; private waterIdx: number[] = []; private waterBase: Float32Array;
  private ice: THREE.Mesh;
  private pools: Pool[] = [];
  private houses: HouseInst[] = [];
  private trees: TreeRec[] = [];
  private pCot!: { wall: Pool; roof: Pool; snow: Pool; win: Pool };
  private pHou!: { wall: Pool; roof: Pool; snow: Pool; win: Pool };
  private trunkP!: Pool; private canopyP!: Pool; private pineP!: Pool; private pines: PItem[] = [];
  private wheatP!: Pool; private tuftP!: Pool; private bloomP!: Pool; private pumpP!: Pool; private hayP!: Pool; private appleP!: Pool;
  private fenceP!: Pool; private rockP!: Pool; private cobP!: Pool;
  private sheepP!: Pool; private sheep: { it: PItem; hx: number; hz: number; r: number; w: number; ph: number; lamb: boolean }[] = [];
  private duckP!: Pool; private ducks: { it: PItem; w: number; ph: number; r: number }[] = [];
  private lampP!: Pool; private lampHeadP!: Pool; private lamps: { x: number; y: number; z: number; y3: boolean; head: PItem; pole: PItem; glow: PItem }[] = [];
  private lanternP!: Pool; private lanterns: { it: PItem; y3: boolean; glow: PItem; col: THREE.Color }[] = [];
  private lanternLine!: THREE.LineSegments;
  private glowP!: Pool;
  private smokeP!: Pool; private smoke: { inst: HouseInst; th: number; ph: number }[] = [];
  private fallP!: Pool; private fall: { it: PItem; r: number[]; ground: number; x: number; z: number }[] = [];
  private birdUp!: Pool; private birdDn!: Pool; private birds: { up: PItem; dn: PItem; cx: number; cz: number; r: number; h: number; w: number; ph: number }[] = [];
  private cloudP!: Pool; private clouds: { it: PItem; sp: number; z: number }[] = [];
  private flies: { it: PItem; x: number; z: number; ph: number; y: number }[] = [];
  private mistM: THREE.Mesh[] = [];
  private sunDisc!: THREE.Mesh; private moonDisc!: THREE.Mesh; private sunHalo!: PItem; private moonHalo!: PItem;
  private millBlades!: THREE.Mesh; private millTower!: THREE.Mesh;
  private wellM!: THREE.Mesh; private plazaM!: THREE.Mesh;
  private boat!: THREE.Mesh;
  private waterMat: THREE.MeshStandardMaterial;
  private winMats: THREE.MeshBasicMaterial[] = [];
  private bgIn = new THREE.Color(); private bgOut = new THREE.Color();
  onBackdrop: (inner: string, outer: string) => void = () => {};
  private billboardQ = new THREE.Quaternion();
  private windDir = new THREE.Vector2(0.8, 0.35);

  constructor(canvas: HTMLCanvasElement, opts: { preserve?: boolean } = {}) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: opts.preserve ?? false });
    this.renderer = r;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(0x000000, 0);
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();

    this.sTw = new Tween(SEASON_LOOKS[0], 1.6);
    this.hTw = new Tween(HOUR_LOOKS[1], 1.4);

    // luzes
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -10.5; sc.right = 10.5; sc.top = 10.5; sc.bottom = -10.5; sc.near = 4; sc.far = 50;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 0.6);
    this.scene.add(this.hemi);
    for (const [x, z] of [[PLAZA.x, PLAZA.z + 0.4], [-3.4, 2.4], [2.4, -1.6]]) {
      const p = new THREE.PointLight(0xffb060, 0, 7, 2);
      p.position.set(x, 1.3, z);
      this.scene.add(p); this.pts.push(p);
    }

    const frame = buildFrame();
    this.scene.add(frame.group);

    // --- chão, água e gelo ---
    this.terrain = new Terrain();
    this.scene.add(this.terrain.mesh, this.terrain.sides, this.terrain.stones);
    this.waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.08, metalness: 0.1, envMapIntensity: 1.6, depthWrite: false });
    const wr = this.buildWater();
    this.water = wr.water; this.ice = wr.ice; this.waterBase = wr.base;
    this.scene.add(this.water, this.ice);

    this.buildFlora();
    this.buildHouses();
    this.buildFarm();
    this.buildProps();
    this.buildLife();
    this.buildSky();

    for (const p of this.pools) this.scene.add(p.mesh);
    this.terrain.setForest(this.trees.filter((t) => !t.orchard).map((t) => ({ x: t.x, z: t.z, r: 0.95 })).concat(this.pines.map((p) => ({ x: p.x, z: p.z, r: 0.8 }))));
    this.setSeason(0, true); this.setHour(1, true); this.setYear(1, true);
  }

  // --- construção ---
  private pool(geo: THREE.BufferGeometry, cap: number, o: { mat?: THREE.Material; cast?: boolean; receive?: boolean; name?: string } = {}): Pool {
    const p = new Pool(geo, o.mat ?? lit(), cap, o);
    this.pools.push(p);
    return p;
  }

  private buildWater(): { water: THREE.Mesh; ice: THREE.Mesh; base: Float32Array } {
    const n = 70, nv = (n + 1) * (n + 1);
    const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 4), nor = new Float32Array(nv * 3);
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i;
      const x = -HALF + (i * 2 * HALF) / n, z = -HALF + (j * 2 * HALF) / n;
      const depth = -heightAt(x, z);
      pos[k * 3] = x; pos[k * 3 + 2] = z;
      nor[k * 3 + 1] = 1;
      const a = smooth(0.0, 0.34, depth);
      const dk = 1 - 0.5 * smooth(0, 0.6, depth);
      col[k * 4] = dk; col[k * 4 + 1] = dk; col[k * 4 + 2] = dk; col[k * 4 + 3] = a * 0.92;
      if (depth > -0.02) this.waterIdx.push(k);
    }
    const idx: number[] = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
      // só os quadrados que tocam a água
      if (col[a * 4 + 3] + col[b * 4 + 3] + col[c * 4 + 3] + col[d * 4 + 3] > 0) idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.setIndex(idx);
    const water = new THREE.Mesh(g, this.waterMat);
    water.renderOrder = 2;
    // gelo: cópia plana, um pouco mais acima
    const g2 = g.clone();
    const p2 = g2.attributes.position as THREE.BufferAttribute;
    const c2 = new Float32Array(nv * 4);
    for (let k = 0; k < nv; k++) { p2.setY(k, 0.025); const a = col[k * 4 + 3] > 0.05 ? 1 : 0; c2[k * 4] = 1; c2[k * 4 + 1] = 1; c2[k * 4 + 2] = 1; c2[k * 4 + 3] = a * smooth(0.04, 0.2, col[k * 4 + 3]); }
    g2.setAttribute('color', new THREE.BufferAttribute(c2, 4));
    const ice = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ color: 0xcfe6f2, vertexColors: true, transparent: true, opacity: 0, roughness: 0.16, metalness: 0.05, envMapIntensity: 1.2, depthWrite: false }));
    ice.renderOrder = 3;
    ice.receiveShadow = true;
    water.receiveShadow = true;
    return { water, ice, base: pos.slice() };
  }

  private free(x: number, z: number, m = 0): boolean {
    if (Math.abs(x) > 6.6 || Math.abs(z) > 6.6) return false;
    if (heightAt(x, z) < 0.2) return false;
    if (distStream(x, z) < STREAM_W + 0.7 + m * 0.5) return false;
    if (lakeE(x, z) < 1.55) return false;
    if (distRoads(x, z) < 0.62 + m) return false;
    if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < 2.3 + m) return false;
    if (Math.hypot(x - MILL.x, z - MILL.z) < 1.0 + m) return false;
    for (const h of HOUSES) if (Math.hypot(x - h.x, z - h.z) < 1.2 + m) return false;
    for (const f of FIELDS) if (fieldMask(f, x, z).m > 0.01 || (Math.abs(x - f.x) < f.w / 2 + 0.3 + m && Math.abs(z - f.z) < f.d / 2 + 0.3 + m)) return false;
    if (Math.abs(x - PEN.x) < PEN.w / 2 + 0.4 + m && Math.abs(z - PEN.z) < PEN.d / 2 + 0.4 + m) return false;
    if (Math.abs(x - ORCHARD.x) < 1.6 + m && Math.abs(z - (ORCHARD.z)) < 2.2 + m) return false;
    return true;
  }

  private buildFlora(): void {
    const rnd = mulberry32(2024);
    this.trunkP = this.pool(K.trunkGeo(), 140, { name: 'tronco' });
    this.canopyP = this.pool(K.canopyGeo(), 340, { name: 'copa' });
    this.pineP = this.pool(K.pineGeo(), 90, { name: 'pinheiro' });
    this.appleP = this.pool(K.appleGeo(), 120, { name: 'maca', receive: false });
    const addTree = (x: number, z: number, s: number, orchard: boolean): void => {
      const y = heightAt(x, z) - 0.02;
      const yaw = rnd() * 6.28;
      this.trunkP.add(x, y, z, yaw, s);
      const cherry = !orchard && rnd() < 0.2;
      const blobs: PItem[] = [];
      const offs: [number, number, number, number][] = orchard
        ? [[0, 0.8, 0, 1], [0.2, 0.64, 0.1, 0.8], [-0.18, 0.66, -0.12, 0.82]]
        : [[0, 0.82, 0, 1.05], [0.2, 0.66, 0.1, 0.85], [-0.2, 0.7, -0.12, 0.9], [0.0, 1.0, -0.05, 0.7]];
      const nb = orchard ? 3 : 3 + (rnd() < 0.5 ? 1 : 0);
      for (let i = 0; i < nb; i++) {
        const [ox, oy, oz, os] = offs[i];
        const b = this.canopyP.add(x + ox * s, y + oy * s, z + oz * s, rnd() * 6.28, s * os, { a: Math.floor(rnd() * 3), b: 0.9 + rnd() * 0.2 });
        b.rx = rnd() * 0.4;
        blobs.push(b);
      }
      const apples: PItem[] = [];
      if (orchard) {
        for (let i = 0; i < 5; i++) {
          const b = blobs[i % blobs.length];
          const a = rnd() * 6.28, e = -0.2 + rnd() * 0.9;
          const rr = 0.36 * b.bx * 0.98;
          apples.push(this.appleP.add(b.x + Math.cos(a) * Math.cos(e) * rr, b.y + Math.sin(e) * rr, b.z + Math.sin(a) * Math.cos(e) * rr, 0, 1.0, { a: rnd() }));
        }
      }
      this.trees.push({ x, z, blobs, orchard, cherry, apples });
    };
    // pomar
    for (let c = 0; c < ORCHARD.cols; c++) for (let r = 0; r < ORCHARD.rows; r++) {
      addTree(ORCHARD.x + (c - 1) * ORCHARD.sp + (rnd() - 0.5) * 0.08, ORCHARD.z + (r - 1.5) * ORCHARD.sp + (rnd() - 0.5) * 0.08, 0.82, true);
    }
    // bosques: [centro x, z, raio, quantas árvores, proporção de pinheiros]
    const groves: [number, number, number, number, number][] = [
      [-5.6, -5.6, 1.9, 13, 0.55], [4.0, -5.9, 1.6, 8, 0.4], [6.1, 3.2, 1.2, 8, 0.3], [-2.3, -5.5, 1.3, 4, 0.5], [-5.9, 5.9, 1.0, 3, 0.2], [3.2, 6.1, 1.0, 4, 0.3],
    ];
    const taken: { x: number; z: number }[] = [];
    for (const [cx, cz, rad, n, pf] of groves) {
      let placed = 0, tries = 0;
      while (placed < n && tries++ < 400) {
        const a = rnd() * 6.28, d = Math.sqrt(rnd()) * rad;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!this.free(x, z, 0.1) || taken.some((q) => Math.hypot(q.x - x, q.z - z) < 0.62)) continue;
        taken.push({ x, z });
        if (rnd() < pf) {
          const s = 0.8 + rnd() * 0.75;
          const it = this.pineP.add(x, heightAt(x, z) - 0.02, z, rnd() * 6.28, s, { b: 0.9 + rnd() * 0.2 });
          this.pines.push(it);
        } else addTree(x, z, 0.85 + rnd() * 0.5, false);
        placed++;
      }
    }
    // árvores soltas perto das casas
    for (const [x, z] of [[-0.8, 3.6], [2.4, -2.8], [-3.2, -0.2], [2.4, 3.9], [-6.1, 1.0]] as V2[]) if (this.free(x, z, 0)) addTree(x, z, 0.8 + rnd() * 0.3, false);

    // capim e flores
    this.tuftP = this.pool(K.tuftGeo(), 520, { name: 'capim', cast: false });
    this.bloomP = this.pool(K.bloomGeo(), 220, { name: 'flor', cast: false });
    const blooms = [0xf27aa6, 0xffd94a, 0xffffff, 0xb59cf0, 0xff8a5c, 0xf7e9a0];
    let nT = 0, tries = 0;
    while (nT < 440 && tries++ < 4000) {
      const x = (rnd() * 2 - 1) * 6.6, z = (rnd() * 2 - 1) * 6.6;
      if (!this.free(x, z, -0.25) && !(Math.hypot(x - PLAZA.x, z - PLAZA.z) > 2.2 && heightAt(x, z) > 0.2 && distRoads(x, z) > 0.55 && lakeE(x, z) > 1.5 && distStream(x, z) > 0.9 && !HOUSES.some((h) => Math.hypot(x - h.x, z - h.z) < 0.9) && FIELDS.every((f) => fieldMask(f, x, z).m < 0.01))) continue;
      const y = heightAt(x, z);
      const flower = rnd() < 0.42;
      const s = (flower ? 1.0 : 0.62) + rnd() * 0.5;
      const tf = this.tuftP.add(x, y - 0.01, z, rnd() * 6.28, s, { a: rnd() });
      tf.b = 0.88 + rnd() * 0.24;
      if (flower) {
        const bl = this.bloomP.add(x, y - 0.01, z, 0, s, { a: blooms[Math.floor(rnd() * blooms.length)] });
        bl.col.setHex(bl.a);
      }
      nT++;
    }
    // pedras
    this.rockP = this.pool(K.rockGeo(), 40, { name: 'pedra' });
    const rr = mulberry32(5);
    let nr = 0; tries = 0;
    while (nr < 16 && tries++ < 800) {
      const x = (rr() * 2 - 1) * 6.5, z = (rr() * 2 - 1) * 6.5;
      const nearWater = distStream(x, z) < 1.1 || lakeE(x, z) < 1.9;
      const hill = Math.hypot(x - MILL.x, z - MILL.z) < 2.4;
      if (!(nearWater || hill) || !this.free(x, z, -0.3) && !(nearWater && heightAt(x, z) > 0.05 && distRoads(x, z) > 0.7)) continue;
      if (lakeE(x, z) < 1.1 || distStream(x, z) < 0.5) continue;
      const it = this.rockP.add(x, heightAt(x, z) - 0.03, z, rr() * 6.28, 0.55 + rr() * 0.9, { a: rr() });
      it.ky = 0.8 + rr() * 0.5;
      nr++;
    }
  }

  private buildHouses(): void {
    const cot = K.cottageKit(), hou = K.houseKit();
    const mk = (kit: K.HouseKit, name: string): { wall: Pool; roof: Pool; snow: Pool; win: Pool } => {
      const wm = new THREE.MeshBasicMaterial({ color: 0xffffff });
      this.winMats.push(wm);
      return {
        wall: this.pool(kit.wall, 20, { name: name + '-parede' }),
        roof: this.pool(kit.roof, 20, { name: name + '-telhado' }),
        snow: this.pool(kit.snow, 20, { name: name + '-neve', receive: false }),
        win: this.pool(kit.win, 20, { name: name + '-janela', mat: wm, cast: false, receive: false }),
      };
    };
    this.pCot = mk(cot, 'casa');
    this.pHou = mk(hou, 'sobrado');
    const rnd = mulberry32(99);
    const tints = [0xf6e3b4, 0xf3d3a0, 0xf4cdb8, 0xdbe4d2, 0xd7e1e6, 0xf8efd8, 0xeed9a0];
    const roofs = [0xb4553a, 0x9a4a32, 0x6f5a52, 0x8c5a3a, 0xb8923f, 0x5f6a72, 0xa04e34];
    const nearRoad = (x: number, z: number): [number, number] => {
      let best = 1e9, bx = 0, bz = 0;
      for (const rd of ROADS) for (let i = 0; i + 1 < rd.length; i++) {
        const [ax, az] = rd[i], [cx, cz] = rd[i + 1];
        const dx = cx - ax, dz = cz - az;
        const t = clamp01(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz));
        const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
        if (d < best) { best = d; bx = px; bz = pz; }
      }
      return [bx, bz];
    };
    const make = (slot: typeof HOUSES[number], kind: 'cot' | 'hou', v1: boolean, v3: boolean, grows: boolean, s: number, ti: number): void => {
      const kit = kind === 'cot' ? cot : hou, P = kind === 'cot' ? this.pCot : this.pHou;
      const [bx, bz] = nearRoad(slot.x, slot.z);
      const yaw = Math.atan2(bx - slot.x, bz - slot.z) + (rnd() - 0.5) * 0.25;
      const y = heightAt(slot.x, slot.z) - 0.02;
      const mkI = (pool: Pool, yy: number): PItem => pool.add(slot.x, yy, slot.z, yaw, s);
      const wall = mkI(P.wall, y), roof = mkI(P.roof, y), snow = mkI(P.snow, y + kit.roofY * s), win = mkI(P.win, y);
      wall.col.setHex(tints[ti % tints.length]);
      roof.col.setHex(roofs[(ti * 3 + 1) % roofs.length]);
      snow.col.copy(WHITE);
      const rot = new THREE.Matrix4().makeRotationY(yaw);
      const chim = kit.chimney.clone().multiplyScalar(s).applyMatrix4(rot).add(new THREE.Vector3(slot.x, y, slot.z));
      const inst: HouseInst = { kit, x: slot.x, z: slot.z, yaw, s, wall, roof, snow, win, v1, v3, grows, chim, glows: [] } as unknown as HouseInst;
      inst.kit = kind;
      for (const wp of kit.winPts) {
        const w = wp.clone().multiplyScalar(s).applyMatrix4(rot).add(new THREE.Vector3(slot.x, y, slot.z));
        inst.glows.push({ it: null as unknown as PItem, thr: 0.05 + rnd() * 0.75, world: w });
      }
      this.houses.push(inst);
    };
    HOUSES.forEach((h, i) => {
      if (h.year === 1 && !h.upgrade) make(h, h.kind === 'cottage' ? 'cot' : 'hou', true, true, h.kind === 'house', h.s, i);
      else if (h.year === 1) { make(h, 'cot', true, false, false, h.s, i); make(h, 'hou', false, true, false, h.s * 1.08, i); }
      else make(h, h.kind === 'cottage' ? 'cot' : 'hou', false, true, false, h.s, i);
    });
  }

  private buildFarm(): void {
    const rnd = mulberry32(31);
    this.wheatP = this.pool(K.wheatGeo(), 520, { name: 'trigo', cast: false });
    this.wheatP.always = true;
    for (const f of FIELDS) {
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      for (let u = -f.w / 2 + 0.12; u <= f.w / 2 - 0.1; u += 0.2) for (let v = -f.d / 2 + 0.12; v <= f.d / 2 - 0.1; v += 0.2) {
        const uu = u + (rnd() - 0.5) * 0.07, vv = v + (rnd() - 0.5) * 0.07;
        const x = f.x + uu * c - vv * s, z = f.z + uu * s + vv * c;
        const it = this.wheatP.add(x, heightAt(x, z) - 0.01, z, rnd() * 6.28, 0.9 + rnd() * 0.35, { a: rnd() * 6.28, b: 0.88 + rnd() * 0.24 });
        it.ky = 1;
      }
    }
    this.pumpP = this.pool(K.pumpkinGeo(), 40, { name: 'abobora' });
    for (const [cx, cz] of [[3.7, -5.6], [-2.7, 6.1]]) {
      for (let i = 0; i < 7; i++) {
        const a = rnd() * 6.28, d = Math.sqrt(rnd()) * 0.65;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!(heightAt(x, z) > 0.15)) continue;
        const it = this.pumpP.add(x, heightAt(x, z) - 0.01, z, rnd() * 6.28, 0.75 + rnd() * 0.6, { a: rnd() });
        it.col.setHSL(0.06 + rnd() * 0.03, 0.9, 0.3 + rnd() * 0.07);
        it.ky = 0;
      }
    }
    this.hayP = this.pool(K.hayGeo(), 20, { name: 'feno' });
    const hayAt: [number, number][] = [[-5.6, 5.0], [-4.9, 6.2], [-3.9, 4.8], [-3.5, 6.2], [0.5, -5.9], [1.8, -4.6], [2.6, -5.9], [0.0, -4.6]];
    for (const [x, z] of hayAt) {
      const it = this.hayP.add(x, heightAt(x, z) - 0.01, z, rnd() * 3.14, 1.0, { a: rnd() });
      it.col.setHex(0xe0bb62);
    }
    // cercado das ovelhas
    this.fenceP = this.pool(K.fenceGeo(), 60, { name: 'cerca' });
    const fx0 = PEN.x - PEN.w / 2, fx1 = PEN.x + PEN.w / 2, fz0 = PEN.z - PEN.d / 2, fz1 = PEN.z + PEN.d / 2;
    for (let x = fx0 + 0.25; x < fx1; x += 0.5) for (const z of [fz0, fz1]) {
      if (z === fz1 && x > 0.9 && x < 1.5) continue; // porteira aberta
      this.fenceP.add(x, heightAt(x, z) - 0.02, z, 0, 1);
    }
    for (let z = fz0 + 0.25; z < fz1; z += 0.475) for (const x of [fx0, fx1]) this.fenceP.add(x, heightAt(x, z) - 0.02, z, Math.PI / 2, 1);
    // ovelhas e cordeiros
    this.sheepP = this.pool(K.sheepGeo(), 14, { name: 'ovelha' });
    this.sheepP.always = true;
    const sp: [number, number, boolean][] = [[0.2, 5.1, false], [1.3, 5.7, false], [2.2, 5.0, false], [0.6, 5.9, false], [1.9, 5.9, false], [1.0, 4.8, false], [0.5, 5.3, true], [1.7, 5.4, true], [2.3, 5.6, true], [1.1, 5.5, true]];
    for (const [x, z, lamb] of sp) {
      const it = this.sheepP.add(x, heightAt(x, z), z, rnd() * 6.28, 1);
      it.col.setHex(lamb ? 0xffffff : [0xfff8ee, 0xf1e8d8, 0xfff1de][Math.floor(rnd() * 3)]);
      this.sheep.push({ it, hx: x, hz: z, r: 0.18 + rnd() * 0.22, w: (0.12 + rnd() * 0.12) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * 6.28, lamb });
    }
    // cobertura de pedras: calçamento do ano 3
    this.cobP = this.pool(K.cobbleGeo(), 900, { name: 'calcamento', cast: false });
    const rc = mulberry32(8);
    const addCob = (x: number, z: number): void => {
      const it = this.cobP.add(x, heightAt(x, z) - 0.005, z, rc() * 3.14, 0.9 + rc() * 0.35, { a: rc() });
      it.col.setHSL(0.07, 0.07 + rc() * 0.05, 0.42 + rc() * 0.18);
      this.cobP.show(it, false, 0, true);
    };
    for (const rd of [ROAD_MAIN, ROADS[1]]) {
      for (let i = 0; i + 1 < rd.length; i++) {
        const [ax, az] = rd[i], [bx, bz] = rd[i + 1];
        const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
        for (let d = 0; d < L; d += 0.17) for (let o = -0.38; o <= 0.38; o += 0.15) {
          const x = ax + dx * d - dz * o + (rc() - 0.5) * 0.04, z = az + dz * d + dx * o + (rc() - 0.5) * 0.04;
          if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < 1.7 || heightAt(x, z) < 0.15) continue;
          if (Math.abs(x) > 6.9 || Math.abs(z) > 6.9) continue;
          if (distStream(x, z) < 0.75 && x > 3.5) continue; // sob a ponte
          addCob(x, z);
        }
      }
    }
    for (let a = 0; a < 6.28; a += 0.1) for (let d = 1.05; d < 1.8; d += 0.17) addCob(PLAZA.x + Math.cos(a) * d * (1 + 0.01 * (rc() - 0.5)), PLAZA.z + Math.sin(a) * d);
  }

  private buildProps(): void {
    const rnd = mulberry32(61);
    // moinho
    const mh = heightAt(MILL.x, MILL.z) - 0.02, myaw = 0.62;
    this.millTower = new THREE.Mesh(K.millTowerGeo(), lit());
    this.millTower.position.set(MILL.x, mh, MILL.z); this.millTower.rotation.y = myaw;
    this.millTower.castShadow = true; this.millTower.receiveShadow = true;
    this.millBlades = new THREE.Mesh(K.millBladesGeo(), lit());
    this.millBlades.castShadow = true;
    const hub = new THREE.Vector3(0, 1.62, 0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), myaw);
    this.millBlades.position.set(MILL.x + hub.x, mh + hub.y, MILL.z + hub.z);
    this.millBlades.rotation.order = 'YXZ';
    this.millBlades.rotation.y = myaw;
    this.scene.add(this.millTower, this.millBlades);

    // ponte sobre o riacho
    const bridge = new THREE.Mesh(K.bridgeGeo(), lit());
    const bp = this.bridgePos();
    bridge.position.set(bp.x, 0.27, bp.z); bridge.rotation.y = bp.yaw;
    bridge.castShadow = true; bridge.receiveShadow = true;
    this.scene.add(bridge);

    // poço (ano 1) e praça (ano 3)
    this.wellM = new THREE.Mesh(K.wellGeo(), lit());
    this.wellM.position.set(PLAZA.x, heightAt(PLAZA.x, PLAZA.z) - 0.01, PLAZA.z);
    this.wellM.castShadow = true; this.wellM.receiveShadow = true;
    this.plazaM = new THREE.Mesh(K.plazaGeo(), lit());
    this.plazaM.position.set(PLAZA.x, heightAt(PLAZA.x, PLAZA.z) - 0.01, PLAZA.z);
    this.plazaM.castShadow = true; this.plazaM.receiveShadow = true;
    this.scene.add(this.wellM, this.plazaM);

    // cais, barco, patos
    const pier = new THREE.Mesh(K.pierGeo(), lit());
    pier.position.set(1.62, 0.1, 1.95); pier.rotation.y = 0.12;
    pier.castShadow = true;
    this.boat = new THREE.Mesh(K.boatGeo(), lit());
    this.boat.position.set(2.95, 0.0, 1.45);
    this.boat.castShadow = true;
    this.scene.add(pier, this.boat);
    this.duckP = this.pool(K.duckGeo(), 6, { name: 'pato' });
    this.duckP.always = true;
    for (let i = 0; i < 3; i++) {
      const it = this.duckP.add(LAKE.x, 0.0, LAKE.z, 0, 1);
      this.ducks.push({ it, w: 0.18 + rnd() * 0.12, ph: i * 2.1, r: 0.55 + i * 0.28 });
    }

    // lampiões
    this.lampP = this.pool(K.lampPoleGeo(), 16, { name: 'poste' });
    this.lampHeadP = this.pool(K.lampHeadGeo(), 16, { name: 'lampiao', mat: new THREE.MeshBasicMaterial({ color: 0xffffff }), cast: false, receive: false });
    const l1: V2[] = [[-1.85, -0.5], [0.55, 0.95], [2.5, -2.15], [-3.9, 2.3]];
    const l3: V2[] = [[-0.25, 2.9], [-2.0, 3.9], [1.25, -1.55], [-5.25, 3.0], [4.1, -3.95]];
    for (const [list, y3] of [[l1, false], [l3, true]] as const) for (const [x, z] of list) {
      const y = heightAt(x, z) - 0.02;
      const pole = this.lampP.add(x, y, z, 0, 1);
      const head = this.lampHeadP.add(x, y, z, 0, 1);
      this.lamps.push({ x, y, z, y3, head, pole, glow: null as unknown as PItem });
      if (y3) { this.lampP.show(pole, false, 0, true); this.lampHeadP.show(head, false, 0, true); }
    }
    // festival de lanternas: fios entre os postes
    this.lanternP = this.pool(K.lanternGeo(), 80, { name: 'lanterna', mat: new THREE.MeshBasicMaterial({ color: 0xffffff }), cast: false, receive: false });
    const cols = [0xe0402e, 0xffb440, 0xff7a3a, 0xffd98a];
    const segs: number[] = [];
    const strings: [number, number][] = [];
    this.lamps.forEach((a, i) => this.lamps.forEach((b, j) => {
      if (j <= i) return;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < 3.4 && a.y3 === b.y3 || (d < 3.0 && b.y3 && !a.y3)) strings.push([i, j]);
    }));
    for (const [i, j] of strings) {
      const a = this.lamps[i], b = this.lamps[j];
      const y3 = a.y3 || b.y3;
      const n = 5;
      let px = a.x, py = a.y + 0.95, pz = a.z;
      for (let k = 1; k <= n + 1; k++) {
        const t = k / (n + 1);
        const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        const y = a.y + (b.y - a.y) * t + 0.95 - Math.sin(t * Math.PI) * 0.22;
        segs.push(px, py, pz, x, y, z);
        px = x; py = y; pz = z;
        if (k <= n) {
          const it = this.lanternP.add(x, y - 0.08, z, 0, 1);
          const c = new THREE.Color(cols[(k + i + j) % cols.length]);
          it.col.copy(c).multiplyScalar(1.7);
          this.lanterns.push({ it, y3, glow: null as unknown as PItem, col: c });
          it.ky = 0;
        }
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
    this.lanternLine = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3a2a20, transparent: true, opacity: 0 }));
    this.scene.add(this.lanternLine);
  }

  private bridgePos(): { x: number; z: number; yaw: number } {
    // onde a estrada principal cruza o riacho
    let bx = 4.55, bz = -3.1;
    let best = 1e9;
    for (let x = 4.0; x < 5.2; x += 0.02) {
      const z = -3.1 - (x - 4.5) * (-0.07);
      const d = distPoly(x, z, STREAM_A);
      if (d < best) { best = d; bx = x; bz = z; }
    }
    return { x: bx, z: bz, yaw: 0.07 };
  }

  private buildLife(): void {
    const rnd = mulberry32(17);
    // fumaça
    this.smokeP = this.pool(K.puffGeo(), 12 * 8 * 2, { name: 'fumaca', mat: new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.62, depthWrite: false, vertexColors: true }), cast: false });
    this.smokeP.always = true;
    this.houses.forEach((h) => {
      this.smoke.push({ inst: h, th: rnd() * 0.45, ph: rnd() });
      for (let k = 0; k < 8; k++) this.smokeP.add(h.chim.x, h.chim.y, h.chim.z, 0, 0.0);
    });
    // partículas que caem (folhas, pétalas, neve)
    const fg = new THREE.CircleGeometry(0.5, 6);
    const fcol = new Float32Array(fg.attributes.position.count * 3).fill(1);
    fg.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
    this.fallP = this.pool(fg, 300, { name: 'queda', mat: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), cast: false, receive: false });
    this.fallP.always = true;
    for (let i = 0; i < 300; i++) {
      const x = (rnd() * 2 - 1) * 6.6, z = (rnd() * 2 - 1) * 6.6;
      const it = this.fallP.add(x, 3, z, 0, 0.05);
      this.fall.push({ it, r: [rnd(), rnd(), rnd(), rnd()], ground: Math.max(0.05, heightAt(x, z)), x, z });
    }
    // pássaros
    this.birdUp = this.pool(K.birdGeo(true), 12, { name: 'passaro-a', cast: false });
    this.birdDn = this.pool(K.birdGeo(false), 12, { name: 'passaro-b', cast: false });
    this.birdUp.always = this.birdDn.always = true;
    for (let i = 0; i < 9; i++) {
      const cx = (rnd() - 0.5) * 5, cz = (rnd() - 0.5) * 5;
      this.birds.push({
        up: this.birdUp.add(0, 4, 0, 0, 1), dn: this.birdDn.add(0, 4, 0, 0, 1),
        cx, cz, r: 2 + rnd() * 3.2, h: 1.9 + rnd() * 1.7, w: (0.28 + rnd() * 0.3) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * 6.28,
      });
    }
    // brilhos aditivos (janelas, lampiões, lanternas, vaga-lumes, sol e lua)
    const gm = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const quad = new THREE.PlaneGeometry(1, 1);
    this.glowP = this.pool(quad, 260, { name: 'brilho', mat: gm, cast: false, receive: false });
    this.glowP.always = true;
    this.glowP.billboard = this.billboardQ;
    for (const h of this.houses) for (const g of h.glows) { g.it = this.glowP.add(g.world.x, g.world.y, g.world.z, 0, 0.0); }
    for (const l of this.lamps) l.glow = this.glowP.add(l.x, l.y + 1.0, l.z, 0, 0);
    for (const l of this.lanterns) l.glow = this.glowP.add(l.it.x, l.it.y, l.it.z, 0, 0);
    for (let i = 0; i < 28; i++) {
      const x = (rnd() * 2 - 1) * 6, z = (rnd() * 2 - 1) * 6;
      this.flies.push({ it: this.glowP.add(x, 0.6, z, 0, 0), x, z, ph: rnd() * 6.28, y: 0.35 + rnd() * 0.8 });
    }
    this.sunHalo = this.glowP.add(0, 0, 0, 0, 0);
    this.moonHalo = this.glowP.add(0, 0, 0, 0, 0);
  }

  private buildSky(): void {
    const rnd = mulberry32(3);
    // sol e lua, como num astrolábio dentro da caixa
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    this.moonDisc = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), new THREE.MeshBasicMaterial({ color: 0xe6ecff, toneMapped: false }));
    this.scene.add(this.sunDisc, this.moonDisc);
    // nuvens
    this.cloudP = this.pool(K.cloudGeo(), 8, { name: 'nuvem', mat: lit({ roughness: 1 }) });
    this.cloudP.always = true;
    for (let i = 0; i < 7; i++) {
      const x = -6 + (i * 12) / 6 + (rnd() - 0.5), z = -2.2 - rnd() * 4.4;
      const it = this.cloudP.add(x, 4.1 + rnd() * 0.5, z, rnd() * 3, 0.34 + rnd() * 0.28);
      it.ky = 0.8;
      this.clouds.push({ it, sp: 0.06 + rnd() * 0.06, z });
    }
    // névoa rasteira
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 15.5), new THREE.MeshBasicMaterial({ map: mistTexture(11 + i * 7), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, color: 0xffffff }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = i * 1.3;
      m.position.y = 0.38 + i * 0.32;
      m.renderOrder = 4;
      this.scene.add(m); this.mistM.push(m);
    }
  }

  // --- controle ---
  setSeason(i: number, instant = false): void { this.season = i; this.sTw.go(SEASON_LOOKS[i], instant); this.needApply = true; }
  setHour(i: number, instant = false): void { this.hour = i; this.hTw.go(HOUR_LOOKS[i], instant); this.needApply = true; this.lightsDirty = true; }
  setYear(y: 1 | 3, instant = false): void {
    this.year = y; this.Yt = y === 3 ? 1 : 0;
    if (instant) this.Y = this.Yt;
    const on3 = y === 3;
    let n = 0;
    const d = (): number => instant ? 0 : 0.05 + (n++ % 12) * 0.07 + Math.random() * 0.08;
    for (const h of this.houses) {
      const on = on3 ? h.v3 : h.v1;
      for (const [P, it] of [[this.poolsOf(h).wall, h.wall], [this.poolsOf(h).roof, h.roof], [this.poolsOf(h).win, h.win]] as [Pool, PItem][]) P.show(it, on, d(), instant);
      this.poolsOf(h).snow.show(h.snow, on, 0, instant);
    }
    for (const l of this.lamps) if (l.y3) { this.lampP.show(l.pole, on3, d(), instant); this.lampHeadP.show(l.head, on3, d(), instant); }
    for (const it of this.cobP.items) this.cobP.show(it, on3, d() * 0.8, instant);
    this.needApply = true;
  }
  private poolsOf(h: HouseInst): { wall: Pool; roof: Pool; snow: Pool; win: Pool } { return h.kit === 'cot' ? this.pCot : this.pHou; }

  resize(w: number, h: number, offsetY = 0): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (offsetY) this.camera.setViewOffset(w, h, 0, offsetY, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  // --- aplicação das estações e horas ---
  private applySeason(L: SeasonLook): void {
    const tmp = new THREE.Color(), tmp2 = new THREE.Color();
    this.terrain.recolor(L, this.Y);
    const leaf = [L.leaf0, L.leaf1, L.leaf2];
    const pink = new THREE.Color('#f7c6d6'), pinkW = new THREE.Color('#fde8ee');
    for (const t of this.trees) {
      for (const b of t.blobs) {
        tmp.copy(leaf[b.a]).multiplyScalar(b.b);
        const bl = L.blossom * (t.orchard ? 1 : t.cherry ? 0.95 : 0);
        if (bl > 0) { mix(pink, pinkW, (b.b - 0.9) * 5, tmp2); tmp.lerp(tmp2, bl); }
        b.col.copy(tmp);
        const k = L.canopy * (t.orchard ? 0.95 : 1) * (t.cherry ? 1 : 1);
        b.kx = b.ky = b.kz = Math.max(k, 0.0001);
      }
      for (const a of t.apples) {
        a.col.copy(L.appleCol).multiplyScalar(0.9 + a.a * 0.2);
        a.kx = a.ky = a.kz = Math.max(L.apples, 0) * (0.8 + 0.2 * a.a);
        if (L.apples < 0.02) a.kx = a.ky = a.kz = 0;
      }
    }
    for (const p of this.pines) { p.col.copy(L.pine).multiplyScalar(p.b); }
    for (const w of this.wheatP.items) {
      w.col.copy(L.wheat).multiplyScalar(w.b);
      w.ky = L.wheatH; w.kx = w.kz = L.wheatW;
    }
    for (const g of this.tuftP.items) {
      g.col.copy(L.grassB).lerp(tmp.setRGB(0.75, 0.8, 0.78), L.snow * 0.6).multiplyScalar(g.b);
      g.ky = 1 - 0.4 * L.snow; g.kx = g.kz = 1;
    }
    for (const b of this.bloomP.items) { const k = L.flowers; b.kx = b.ky = b.kz = k; if (k < 0.02) b.kx = b.ky = b.kz = 0; }
    for (const p of this.pumpP.items) { const k = L.pumpkin; p.kx = p.kz = k; p.ky = k; }
    for (const h of this.hayP.items) { h.col.copy(tmp.setHex(0xe0bb62)).lerp(tmp2.setRGB(0.92, 0.95, 0.97), L.snow * 0.55); h.kx = h.ky = h.kz = L.hay; }
    for (const f of this.fenceP.items) f.col.copy(L.fence);
    for (const r of this.rockP.items) { tmp.setHSL(0.09, 0.06, 0.4 + r.a * 0.2); r.col.copy(tmp).lerp(tmp2.setRGB(0.93, 0.96, 1), L.rock); }
    for (const c of this.cobP.items) { c.col.lerp(c.col, 0); }
    for (const s of this.sheep) if (s.lamb) { s.it.bx = s.it.by = s.it.bz = L.lamb; }
    for (const h of this.houses) h.snow.ky = smooth(0.02, 0.98, L.snow), h.snow.kx = h.snow.kz = L.snow > 0.01 ? 1 : 0;
    this.waterMat.color.copy(L.water);
    this.waterMat.roughness = L.rough;
    (this.ice.material as THREE.MeshStandardMaterial).opacity = clamp01(L.ice) * 0.94;
    this.ice.visible = L.ice > 0.01;
    for (const p of this.pools) p.dirty = true;
  }

  private applyHour(H: HourLook, L: SeasonLook): void {
    // direção da luz: o inverno e o verão mudam a altura do sol
    const d = H.lightDir.clone();
    const el = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    const shift = (L.elev * Math.PI) / 180 * (1 - H.moonVis);
    const el2 = Math.max(0.05, el + shift * (el > 0.03 ? 1 : 0));
    const h = Math.cos(el2) / Math.max(1e-4, Math.cos(el));
    d.set(d.x * h, Math.sin(el2), d.z * h).normalize();
    this.sun.position.copy(d).multiplyScalar(24);
    this.sun.color.copy(H.lightCol);
    this.sun.intensity = H.lightI * L.sunK;
    this.hemi.color.copy(H.hemiSky); this.hemi.groundColor.copy(H.hemiGround); this.hemi.intensity = H.hemiI;
    this.scene.environmentIntensity = H.envI;
    this.renderer.toneMappingExposure = H.exposure;
    // pontos de luz quente da vila à noite
    const festival = L.festival;
    for (const p of this.pts) p.intensity = H.night * (7 + festival * 5) * (0.8 + 0.2 * Math.sin(this.t * 2.3 + p.position.x));
    // sol e lua
    const R = 4.5;
    this.sunDisc.position.copy(H.sunDir).multiplyScalar(R);
    this.moonDisc.position.copy(H.moonDir).multiplyScalar(R);
    (this.sunDisc.material as THREE.MeshBasicMaterial).color.copy(H.sunCol);
    this.sunDisc.scale.setScalar(Math.max(0.0001, H.sunVis));
    this.moonDisc.scale.setScalar(Math.max(0.0001, H.moonVis));
    const sh = this.sunHalo, mh = this.moonHalo;
    sh.x = this.sunDisc.position.x; sh.y = this.sunDisc.position.y; sh.z = this.sunDisc.position.z;
    sh.bx = sh.by = sh.bz = 1.7 * H.sunVis; sh.col.copy(H.sunCol).multiplyScalar(0.55);
    mh.x = this.moonDisc.position.x; mh.y = this.moonDisc.position.y; mh.z = this.moonDisc.position.z;
    mh.bx = mh.by = mh.bz = 2.0 * H.moonVis; mh.col.setRGB(0.5, 0.58, 0.9);
    // janelas
    const dayGlass = new THREE.Color('#566b7c').lerp(new THREE.Color('#9db5c8'), 1 - H.dusk * 0.7);
    const warm = new THREE.Color('#ffb85a');
    for (const hs of this.houses) {
      for (const g of hs.glows) { void g; }
    }
    this.bgIn.copy(H.bgIn); this.bgOut.copy(H.bgOut);
    this.onBackdrop('#' + this.bgIn.getHexString(), '#' + this.bgOut.getHexString());
    (this.cloudP.mesh.material as THREE.MeshStandardMaterial).emissive.copy(H.lightCol).multiplyScalar(0.06 + 0.1 * H.dusk);
    this.hourCache = { dayGlass, warm };
    for (const p of this.pools) if (p === this.cloudP || p === this.lampHeadP || p === this.pCot.win || p === this.pHou.win) p.dirty = true;
  }
  private hourCache = { dayGlass: new THREE.Color(), warm: new THREE.Color() };

  // --- quadro ---
  update(realDt: number): void {
    const rdt = Math.min(realDt, 0.1);
    const dt = rdt * this.timeScale;
    this.t += dt;
    const t = this.t;
    let changed = this.needApply;
    this.needApply = false;
    if (this.sTw.step(rdt)) changed = true;
    if (this.hTw.step(rdt)) changed = true;
    if (Math.abs(this.Y - this.Yt) > 1e-4) { this.Y += Math.sign(this.Yt - this.Y) * Math.min(Math.abs(this.Yt - this.Y), rdt / 1.8); changed = true; }
    const S = this.sTw.cur, H = this.hTw.cur;
    if (changed) { this.applySeason(S); this.applyHour(H, S); }
    // crescimento do ano: casas do tipo "sobrado" aumentam; a praça sobe
    for (const h of this.houses) if (h.grows) { const k = 1 + 0.16 * smooth(0, 1, this.Y); h.wall.kx = h.wall.ky = h.wall.kz = k; h.roof.kx = h.roof.ky = h.roof.kz = k; h.win.kx = h.win.ky = h.win.kz = k; this.poolsOf(h).wall.dirty = this.poolsOf(h).roof.dirty = this.poolsOf(h).win.dirty = true; }
    const pz = smooth(0.35, 1, this.Y);
    this.plazaM.scale.set(Math.max(1e-4, pz), Math.max(1e-4, pz), Math.max(1e-4, pz)); this.plazaM.visible = pz > 0.001;
    const wz = 1 - smooth(0.0, 0.4, this.Y);
    this.wellM.scale.setScalar(Math.max(1e-4, wz)); this.wellM.visible = wz > 0.001;

    for (const p of this.pools) p.step(rdt);

    this.camera.getWorldQuaternion(this.billboardQ);

    // --- vida ---
    const night = H.night;
    this.millBlades.rotation.z = -t * (0.35 + S.wind * 0.55);
    for (const w of this.wheatP.items) {
      const a = Math.sin(t * 1.6 + w.a + w.x * 0.9 + w.z * 0.7) * 0.07 * S.wind + Math.sin(t * 0.7 + w.x * 0.3) * 0.04 * S.wind;
      w.rz = a * 0.9; w.rx = a * 0.6;
    }
    // ovelhas
    for (const s of this.sheep) {
      const a = t * s.w + s.ph;
      const x = s.hx + Math.cos(a) * s.r, z = s.hz + Math.sin(a) * s.r * 0.8;
      const nx = Math.max(PEN.x - PEN.w / 2 + 0.25, Math.min(PEN.x + PEN.w / 2 - 0.25, x)), nz = Math.max(PEN.z - PEN.d / 2 + 0.2, Math.min(PEN.z + PEN.d / 2 - 0.2, z));
      const sgn = Math.sign(s.w);
      s.it.x = nx; s.it.z = nz; s.it.y = heightAt(nx, nz) + Math.abs(Math.sin(a * 7)) * 0.012;
      s.it.yaw = -Math.atan2(-Math.sin(a) * 0.8 * sgn, -Math.cos(a) * sgn) + 0 * s.ph;
    }
    // patos e barco
    const duckVis = 1 - smooth(0.2, 0.8, S.ice);
    for (const d of this.ducks) {
      const a = t * d.w + d.ph;
      d.it.x = LAKE.x + 0.2 + Math.cos(a) * d.r; d.it.z = LAKE.z + 0.1 + Math.sin(a) * d.r * 0.75;
      d.it.y = 0.005 + Math.sin(t * 2 + d.ph) * 0.006;
      d.it.yaw = -a - (d.w > 0 ? Math.PI / 2 : -Math.PI / 2);
      d.it.vis = duckVis;
    }
    this.duckP.dirty = true;
    this.boat.position.y = 0.0 + (S.ice > 0.5 ? 0.03 : Math.sin(t * 1.3) * 0.012);
    this.boat.rotation.set(0, 0.35, Math.sin(t * 1.1) * (S.ice > 0.5 ? 0 : 0.04));
    // água
    this.animateWater(t, S);
    // nuvens
    const cloudCnt = Math.round(S.cloud * 7);
    this.clouds.forEach((c, i) => {
      c.it.x += c.sp * dt; if (c.it.x > 7.4) c.it.x = -7.4;
      const on = i < cloudCnt ? 1 : 0;
      c.it.vis += (on - c.it.vis) * Math.min(1, rdt * 2);
      c.it.col.copy(S.cloudCol);
    });
    // fumaça
    const ws = this.windDir;
    let si = 0;
    for (const s of this.smoke) {
      const strength = clamp01((S.smoke - s.th) / 0.4) * (s.inst.wall.vis);
      for (let k = 0; k < 8; k++) {
        const it = this.smokeP.items[si++];
        const age = (t * (0.2 + 0.1 * S.smoke) + k / 8 + s.ph) % 1;
        const lift = 0.35 + age * (0.95 + 0.7 * S.smoke);
        it.x = s.inst.chim.x + ws.x * age * (0.6 + 0.4 * S.wind) + Math.sin(age * 7 + s.ph * 9) * 0.04;
        it.y = s.inst.chim.y + lift - 0.3;
        it.z = s.inst.chim.z + ws.y * age * 0.5 + Math.cos(age * 6 + s.ph * 5) * 0.04;
        const sz = (0.35 + age * 1.5) * Math.pow(1 - age, 0.7) * strength * (0.75 + 0.45 * S.smoke);
        it.bx = it.by = it.bz = Math.max(0, sz);
        const g = 0.82 - age * 0.18 - 0.1 * S.smoke * (1 - age);
        it.col.setRGB(g, g, g * 1.02);
      }
    }
    // folhas, pétalas e neve
    const fc = Math.round(S.fallCount * this.fall.length);
    const stretch = 1 + 0.7 * (1 - S.snow);
    const cols = [S.fallA, S.fallB, S.fallC];
    this.fall.forEach((f, i) => {
      const it = f.it;
      if (i >= fc) { it.vis = 0; return; }
      const top = 4.7;
      const u = (f.r[0] + t * S.fallSpeed * (0.07 + 0.05 * f.r[1])) % 1;
      it.vis = 1;
      it.y = f.ground + (top - f.ground) * (1 - u);
      it.x = f.x + Math.sin(t * 0.8 + f.r[2] * 9) * S.fallSway * 0.45 + u * 0.8 * ws.x;
      it.z = f.z + Math.cos(t * 0.7 + f.r[3] * 9) * S.fallSway * 0.35;
      it.rx = t * (0.8 + f.r[2] * 2.2) + f.r[1] * 6; it.rz = t * (0.6 + f.r[3] * 1.8); it.yaw = f.r[0] * 6.28;
      const fade = smooth(0.0, 0.08, 1 - u) * smooth(0, 0.06, u);
      const sz = S.fallSize * (0.7 + 0.6 * f.r[3]) * fade;
      it.bx = sz * stretch; it.by = sz; it.bz = sz;
      it.col.copy(cols[i % 3]).multiplyScalar(0.9 + 0.2 * f.r[2]);
    });
    // pássaros
    const bn = Math.round(S.birds * (1 - night * 0.95) * this.birds.length);
    this.birds.forEach((b, i) => {
      const a = t * b.w + b.ph;
      const x = b.cx + Math.cos(a) * b.r, z = b.cz + Math.sin(a) * b.r * 0.7;
      const y = b.h + Math.sin(a * 1.7) * 0.35;
      const sgn = Math.sign(b.w);
      const yaw = Math.atan2(Math.cos(a) * 0.7 * sgn, Math.sin(a) * sgn) * 1 - Math.PI / 2 * 0;
      const flap = Math.sin(t * 9 + b.ph * 3) > 0;
      const on = i < bn ? 1 : 0;
      for (const [it, act] of [[b.up, flap], [b.dn, !flap]] as [PItem, boolean][]) {
        it.x = x; it.y = y; it.z = z; it.yaw = yaw; it.rz = Math.cos(a) * 0.25 * sgn;
        it.vis = act ? on : 0; it.bx = it.by = it.bz = 1.5;
      }
    });
    // brilhos
    this.updateGlows(t, S, H, night);
    // lanternas penduradas
    const fest = S.festival * smooth(0.3, 0.8, night);
    (this.lanternLine.material as THREE.LineBasicMaterial).opacity = S.festival * (this.Y > 0.5 ? 1 : 0.8);
    this.lanternLine.visible = S.festival > 0.01;
    for (const l of this.lanterns) {
      const on = l.y3 ? smooth(0.3, 1, this.Y) : 1 - 0.0;
      l.it.ky = l.it.kx = l.it.kz = Math.max(0, S.festival) * on * (0.55 + 0.45 * fest);
      l.it.col.copy(l.col).multiplyScalar(0.55 + 1.4 * fest);
      l.it.y += (Math.sin(t * 1.4 + l.it.x * 3) * 0.004);
    }
    this.lanternP.dirty = true;
    // névoa
    const mistAmt = S.mist * H.mist;
    this.mistM.forEach((m, i) => {
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = clamp01(mistAmt) * (0.5 - i * 0.1);
      mat.color.copy(H.mistCol);
      m.rotation.z += dt * (0.01 + i * 0.006) * (i % 2 ? -1 : 1);
      m.visible = mat.opacity > 0.004;
    });

    for (const p of this.pools) p.refresh();
    if (this.lightsDirty) this.lightsDirty = false;
    this.sun.target.position.set(0, 0, 0);
  }

  private animateWater(t: number, S: SeasonLook): void {
    if (S.ice > 0.98) return;
    const pos = this.water.geometry.attributes.position as THREE.BufferAttribute;
    const nor = this.water.geometry.attributes.normal as THREE.BufferAttribute;
    const amp = 0.012 * (1 - S.ice);
    for (const k of this.waterIdx) {
      const x = this.waterBase[k * 3], z = this.waterBase[k * 3 + 2];
      const a = x * 3.3 + t * 1.35, b = z * 2.9 - t * 1.1, c = (x + z) * 4.7 + t * 1.9;
      const y = (Math.sin(a) + Math.sin(b) + 0.6 * Math.sin(c)) * amp;
      const dx = (3.3 * Math.cos(a) + 0.6 * 4.7 * Math.cos(c)) * amp, dz = (2.9 * Math.cos(b) + 0.6 * 4.7 * Math.cos(c)) * amp;
      pos.setY(k, y);
      const il = 1 / Math.hypot(dx, 1, dz);
      nor.setXYZ(k, -dx * il * 4, il * 1, -dz * il * 4);
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
  }

  private updateGlows(t: number, S: SeasonLook, H: HourLook, night: number): void {
    const { dayGlass, warm } = this.hourCache;
    // janelas: panos de vidro e brilho
    const warmC = new THREE.Color();
    for (const h of this.houses) {
      const vis = h.wall.vis;
      const P = this.poolsOf(h);
      void P;
      // cor do pano é uma só por casa (instância); o brilho é por janela
      const avg = night * (0.55 + 0.45 * Math.sin(t * 1.7 + h.x * 5));
      void avg;
      let litCount = 0;
      for (const g of h.glows) {
        const on = night > g.thr ? 1 : 0;
        litCount += on;
        const flick = 0.9 + 0.1 * Math.sin(t * 5.3 + g.thr * 40) * (S.festival > 0.5 ? 1 : 0.6);
        warmC.copy(warm).multiplyScalar(on * flick * (0.9 + 0.6 * S.festival * 0));
        g.it.col.copy(warmC);
        const sz = (0.62 + 0.06 * S.festival) * on * vis * smooth(0, 0.2, night);
        g.it.bx = g.it.by = g.it.bz = sz;
      }
      h.win.col.copy(dayGlass).lerp(warm.clone().multiplyScalar(2.4), litCount > 0 ? Math.min(1, litCount / Math.max(1, h.glows.length) * 1.2 + 0.25) * smooth(0, 0.2, night) : 0);
      h.win.col.multiplyScalar(1);
    }
    this.pCot.win.dirty = this.pHou.win.dirty = true;
    for (const l of this.lamps) {
      const vis = l.head.vis;
      l.head.col.copy(new THREE.Color('#a8956a')).lerp(warm.clone().multiplyScalar(3), smooth(0.1, 0.6, night));
      l.glow.col.copy(warm).multiplyScalar(0.9);
      const sz = 1.25 * smooth(0.1, 0.7, night) * vis;
      l.glow.bx = l.glow.by = l.glow.bz = sz;
    }
    this.lampHeadP.dirty = true;
    const fest = S.festival * smooth(0.3, 0.8, night);
    for (const l of this.lanterns) {
      const on = l.it.ky > 0.01 ? 1 : 0;
      l.glow.x = l.it.x; l.glow.y = l.it.y; l.glow.z = l.it.z;
      l.glow.col.copy(l.col).multiplyScalar(0.8);
      const sz = 0.55 * fest * on * (l.y3 ? smooth(0.3, 1, this.Y) : 1);
      l.glow.bx = l.glow.by = l.glow.bz = sz;
    }
    // vaga-lumes
    const ff = S.fireflies * smooth(0.5, 1, night);
    for (const f of this.flies) {
      f.it.x = f.x + Math.sin(t * 0.5 + f.ph) * 0.6; f.it.z = f.z + Math.cos(t * 0.43 + f.ph * 2) * 0.6;
      f.it.y = Math.max(heightAt(f.it.x, f.it.z), 0.1) + f.y + Math.sin(t * 0.9 + f.ph) * 0.15;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + f.ph * 5);
      f.it.col.setRGB(0.75, 1, 0.3).multiplyScalar(pulse * 0.9);
      const sz = 0.2 * ff * (0.4 + 0.6 * pulse);
      f.it.bx = f.it.by = f.it.bz = ff > 0.02 ? sz : 0;
    }
    void H;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
    const i = this.renderer.info.render;
    this.stats.calls = i.calls; this.stats.triangles = i.triangles;
  }

  get busy(): boolean {
    return this.sTw.p < 1 || this.hTw.p < 1 || Math.abs(this.Y - this.Yt) > 1e-3 || this.pools.some((p) => p.items.some((i) => i.dir !== 0));
  }
}

export { GLASS_HALF, GLASS_TOP };
