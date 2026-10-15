// O diorama: ilha sobre um pedestal, mar, névoa de nuvens, kits instanciados, luz do dia e da noite.
// Lê o estado de Game (somente leitura) e o desenha; nenhuma regra mora aqui.
import * as THREE from 'three';
import { CELLS, CENTER, DIRS, N, NB_DIR, dist } from '../core/hex';
import { Card, Game, Struct } from '../core/game';
import { Find, Terrain } from '../core/map';
import * as K from './kits';
import { basicMat, litMat, seaMaterial, swayMat, U } from './materials';
import { PAL } from './palette';
import { Item, Pool } from './pool';

const S3 = Math.sqrt(3);
const PI = Math.PI;
export const cellX = (i: number): number => 1.5 * CELLS[i].q;
export const cellZ = (i: number): number => S3 * (CELLS[i].r + CELLS[i].q / 2);
const hashN = (a: number, b: number): number => {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul((b + 17) | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const smooth = (x: number): number => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ---------- peças de terra ----------
// Índice = Terrain (0 = névoa/"mist", que também cobre a água ainda não revelada).
const TILE_SPECS: K.TileSpec[] = [
  { bottom: -0.5, top: 0.16, bevel: 0.08, bump: 0.03, jag: 0, topCol: 0xdceaf2, lipCol: 0xeef6fa, sideCol: 0xa9c4d8, seed: 1 },
  { bottom: -0.5, top: 0.2, bevel: 0.07, bump: 0.025, jag: 0, topCol: PAL.sand, lipCol: 0xf8ebc0, sideCol: PAL.sandDark, seed: 2 },
  { bottom: -0.5, top: 0.36, bevel: 0.08, bump: 0.07, jag: 0, topCol: PAL.meadow, lipCol: 0xc0e684, sideCol: PAL.soil, seed: 3 },
  { bottom: -0.5, top: 0.4, bevel: 0.08, bump: 0.06, jag: 0, topCol: PAL.wood, lipCol: 0x86bb68, sideCol: PAL.soilDark, seed: 4 },
  { bottom: -0.5, top: 0.58, bevel: 0.09, bump: 0.16, jag: 0.11, topCol: PAL.rock, lipCol: 0xcbc7bf, sideCol: PAL.rockDark, seed: 5 },
];
const surf = (t: number): number => TILE_SPECS[t].top + TILE_SPECS[t].bump * 0.5;

// ---------- hora do dia ----------
interface Key { p: number; elev: number; az: number; sun: THREE.Color; sunI: number; hs: THREE.Color; hg: THREE.Color; hI: number; top: THREE.Color; bot: THREE.Color; exp: number }
const col = (h: number | string): THREE.Color => new THREE.Color(h);
const KEYS: Key[] = [
  { p: 0.0, elev: 22, az: -78, sun: col(0xffd2a0), sunI: 2.5, hs: col(0xc9e4ff), hg: col(0x9aa77a), hI: 1.25, top: col('#8fcbe6'), bot: col('#fbe3c4'), exp: 1.0 },
  { p: 0.35, elev: 54, az: -28, sun: col(0xfff0d6), sunI: 3.0, hs: col(0xd6ecff), hg: col(0xa8b88a), hI: 1.3, top: col('#74bde6'), bot: col('#ecf6ee'), exp: 1.0 },
  { p: 0.72, elev: 32, az: 42, sun: col(0xffd59a), sunI: 2.8, hs: col(0xf3dfd0), hg: col(0xa8987a), hI: 1.2, top: col('#97bde6'), bot: col('#fcdcb8'), exp: 1.0 },
  { p: 1.0, elev: 11, az: 82, sun: col(0xff9558), sunI: 2.4, hs: col(0xf2b69c), hg: col(0x7c6b6c), hI: 1.0, top: col('#cf9ab4'), bot: col('#fbc088'), exp: 0.98 },
];
const NIGHT = { elev: 48, az: -135, sun: col(0x9db2ff), sunI: 1.5, hs: col(0x4a60aa), hg: col(0x262e5a), hI: 1.25, top: col('#0b1230'), bot: col('#2a3a6a'), exp: 1.05 };

const WATER_DIR = (g: Game, i: number): number => {
  for (let d = 0; d < 6; d++) { const n = NB_DIR[i][d]; if (n >= 0 && g.map.terrain[n] === Terrain.Water) return d; }
  return 0;
};

interface LightRec { cell: number; x: number; y: number; z: number; farol: boolean; t0: number }
interface Emitter { cell: number; x: number; y: number; z: number; next: number }

export interface WorldOpts { reduced: boolean }

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(33, 1, 4, 200);
  time = 0;
  reduced: boolean;
  frames = 0;
  stats = { calls: 0, triangles: 0, geometries: 0, textures: 0 };

  private game!: Game;
  private sun = new THREE.DirectionalLight(0xffffff, 3);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.2);
  // câmera
  private yaw = -0.42; private pol = 1.0; private dist = 44;
  private tYaw = -0.42; private tPol = 1.0; private tDist = 44;
  private target = new THREE.Vector3(0, 0.3, 0);
  private tTarget = new THREE.Vector3(0, 0.3, 0);
  private viewShift = 0.04;
  private viewX = 0; private viewXT = 0;
  orbit = false;
  /** Segundos de mundo que ainda podem andar (-1 = sem limite); a 0 o mundo fica congelado. */
  private hold = -1;
  holdAfter(sec: number): void { this.hold = sec; }
  get held(): boolean { return this.hold === 0; }
  // estado visual
  private shown = new Uint8Array(N);
  private revT = new Float32Array(N).fill(Infinity);
  private structShown = new Uint8Array(N);
  private tileActive = new Set<number>();
  private tiles: THREE.InstancedMesh[] = [];
  private tileYaw = new Float32Array(N);
  private puffs!: THREE.InstancedMesh;
  private puffData: Array<{ cell: number; x: number; y: number; z: number; r: number; ph: number }> = [];
  private sea!: THREE.Mesh;
  private seaShore!: Float32Array;
  private seaN = 0; private seaStep = 0.34; private seaR = 14.6;
  private pools: Pool[] = [];
  private P: Record<string, Pool> = {};
  private lights: LightRec[] = [];
  private emitters: Emitter[] = [];
  private darkLanterns = new Set<number>();
  private halo!: THREE.InstancedMesh;
  private glow!: THREE.InstancedMesh;
  private beam!: THREE.Mesh;
  private flag!: THREE.Mesh; private star!: THREE.Mesh; private tipCell = -1;
  private hl!: THREE.InstancedMesh; private hlMat!: THREE.MeshBasicMaterial;
  // vento: marcas dos alvos, véu da terra à vista sem luz, rajada e chuva
  windMark!: THREE.InstancedMesh;
  private veil!: THREE.InstancedMesh;
  private veilCells = new Map<number, { off: number }>();
  private sweepX = new Float32Array(N); private sweepZ = new Float32Array(N);
  private windHoverCell = -1; private windHoverK = 0;
  private gust = { t: 9, x: 0, z: 0, dx: 1, dz: 0 };
  private streaks!: THREE.InstancedMesh;
  private streakData: Array<{ lane: number; h: number; d: number; len: number; ph: number }> = [];
  private rainMesh!: THREE.InstancedMesh;
  private rainData: Array<{ x: number; z: number; y: number; v: number }> = [];
  private rainT = 99; private rainK = 0;
  private hover!: THREE.Mesh;
  private ghost: THREE.Group | null = null; private ghostCell = -1;
  private ghostMat!: THREE.MeshStandardMaterial; private ghostBasic!: THREE.MeshBasicMaterial;
  private fishData: Array<{ it: Item; cell: number; a: number; r: number; sp: number; ph: number }> = [];
  private gulls!: THREE.InstancedMesh;
  private dust!: THREE.InstancedMesh;
  private parts: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; life: number; s0: number; s1: number; g: number }> = [];
  private later: Array<{ t: number; fn: () => void }> = [];
  private windowMat = basicMat();
  private lastNight = -1;
  private haloK = 0.3;
  // hora do dia
  private dayTarget = 0; private day = 0;
  private nightTarget = 0; night = 0;
  private cssTop = ''; private cssBot = '';
  private pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.38);
  private ray = new THREE.Raycaster();
  private dpr = 1;
  onTap: (cell: number, e: PointerEvent) => void = () => {};
  onHover: (cell: number) => void = () => {};

  constructor(host: HTMLElement, opts: WorldOpts) {
    this.reduced = opts.reduced;
    U.motion.value = this.reduced ? 0.2 : 1;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    host.prepend(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', 'Ilha das Lanternas');

    this.buildLights();
    this.buildPedestal();
    this.buildSea();
    this.buildTiles();
    this.buildClouds();
    this.buildPools();
    this.buildOverlays();
    this.bindInput();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  // =====================================================================
  // construção
  // =====================================================================
  private buildLights(): void {
    this.scene.add(this.hemi, this.sun, this.sun.target);
    const s = this.sun;
    s.castShadow = true;
    s.shadow.mapSize.set(2048, 2048);
    const c = s.shadow.camera;
    c.left = -15.5; c.right = 15.5; c.top = 15.5; c.bottom = -15.5; c.near = 5; c.far = 110;
    s.shadow.bias = -0.0005; s.shadow.normalBias = 0.04; s.shadow.radius = 2.5;
  }

  private buildPedestal(): void {
    const m = litMat({ roughness: 0.62, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(K.pedestal(), m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
    // sombra suave no "tampo" sob o pedestal
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d')!;
    const gr = cx.createRadialGradient(64, 64, 18, 64, 64, 64);
    gr.addColorStop(0, 'rgba(20,24,50,0.5)'); gr.addColorStop(0.6, 'rgba(20,24,50,0.2)'); gr.addColorStop(1, 'rgba(20,24,50,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(46, 46).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    sh.position.y = -4.25;
    this.scene.add(sh);
  }

  private buildSea(): void {
    const R = this.seaR, st = this.seaStep, n = Math.ceil((R * 2) / st) + 1;
    this.seaN = n;
    const pos = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let x = -R + i * st, z = -R + j * st;
      const r = Math.hypot(x, z);
      if (r > R) { x *= R / r; z *= R / r; }
      const k = (j * n + i) * 3; pos[k] = x; pos[k + 1] = 0; pos[k + 2] = z;
    }
    const idx: number[] = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      const x = -R + i * st, z = -R + j * st;
      if (Math.hypot(x + st / 2, z + st / 2) > R + st) continue;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * n * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    this.seaShore = new Float32Array(n * n).fill(9);
    g.setAttribute('shore', new THREE.BufferAttribute(this.seaShore, 1));
    g.setIndex(idx);
    this.sea = new THREE.Mesh(g, seaMaterial());
    this.sea.receiveShadow = true;
    this.sea.frustumCulled = false;
    this.scene.add(this.sea);
  }

  /** A costa só aparece para a terra já revelada (a espuma não entrega o formato da ilha escondida). */
  private updateShore(cell: number): void {
    const cx = cellX(cell), cz = cellZ(cell), n = this.seaN, st = this.seaStep, R = this.seaR;
    const span = Math.ceil(3.6 / st);
    const i0 = Math.round((cx + R) / st), j0 = Math.round((cz + R) / st);
    const attr = this.sea.geometry.getAttribute('shore') as THREE.BufferAttribute;
    for (let j = Math.max(0, j0 - span); j <= Math.min(n - 1, j0 + span); j++) for (let i = Math.max(0, i0 - span); i <= Math.min(n - 1, i0 + span); i++) {
      const k = j * n + i;
      const dx = Math.abs(this.sea.geometry.attributes.position.getX(k) - cx), dz = this.sea.geometry.attributes.position.getZ(k) - cz;
      const s = Math.max(Math.abs(dz), Math.abs(dx) * 0.866 + Math.abs(dz) * 0.5);
      const d = Math.max(0, s - 0.866);
      if (d < this.seaShore[k]) this.seaShore[k] = d;
    }
    attr.needsUpdate = true;
  }

  private buildTiles(): void {
    for (let k = 0; k < 5; k++) {
      const m = litMat({ roughness: 0.95 });
      const mesh = new THREE.InstancedMesh(K.tileGeometry(TILE_SPECS[k]), m, N);
      mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
      const c = new THREE.Color();
      for (let i = 0; i < N; i++) {
        const v = 0.94 + hashN(i, 40 + k) * 0.12;
        c.setRGB(v, v * (0.98 + hashN(i, 55) * 0.04), v);
        mesh.setColorAt(i, c);
        mesh.setMatrixAt(i, this.tileMatrix(i, 0, 0));
      }
      this.scene.add(mesh);
      this.tiles.push(mesh);
    }
    for (let i = 0; i < N; i++) this.tileYaw[i] = Math.floor(hashN(i, 3) * 6) * PI / 3;
    // recompõe com o giro
    for (let i = 0; i < N; i++) this.setTile(i, 1, 0);
  }

  private tileMatrix(i: number, s: number, yaw: number): THREE.Matrix4 {
    const m = new THREE.Matrix4();
    if (s <= 0.001) return m.makeScale(0, 0, 0);
    m.compose(new THREE.Vector3(cellX(i), -0.5 * (1 - s), cellZ(i)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, s, 1));
    return m;
  }

  private setTile(i: number, sMist: number, sTerr: number): void {
    const t = this.game ? this.game.map.terrain[i] : 0;
    this.tiles[0].setMatrixAt(i, this.tileMatrix(i, dist(CENTER, i) >= 7 ? 0 : sMist, this.tileYaw[i]));
    for (let k = 1; k < 5; k++) this.tiles[k].setMatrixAt(i, this.tileMatrix(i, k === t ? sTerr : 0, this.tileYaw[i]));
  }

  private buildClouds(): void {
    const PER = 5;
    const mat = litMat({ roughness: 1, flatShading: true, emissive: new THREE.Color(0x9aa6c0), emissiveIntensity: 0.5 });
    this.puffs = new THREE.InstancedMesh(K.puff(), mat, N * PER + 8);
    this.puffs.frustumCulled = false; this.puffs.castShadow = false; this.puffs.receiveShadow = false;
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < PER; k++) {
        const a = hashN(i, 100 + k) * PI * 2, rr = Math.sqrt(hashN(i, 120 + k)) * 0.8;
        this.puffData.push({ cell: i, x: cellX(i) + Math.cos(a) * rr, z: cellZ(i) + Math.sin(a) * rr, y: 0.5 + hashN(i, 140 + k) * 0.4, r: 0.5 + hashN(i, 160 + k) * 0.28, ph: hashN(i, 180 + k) * 6.28 });
        const v = 0.93 + hashN(i, 200 + k) * 0.07;
        c.setRGB(v * 0.98, v, v * 1.02);
        this.puffs.setColorAt(i * PER + k, c);
      }
    }
    this.puffs.count = N * PER;
    this.scene.add(this.puffs);
  }

  private buildPools(): void {
    const tree = (g: THREE.BufferGeometry): Pool => this.addPool(g, swayMat(0.05), 260);
    this.P.pine = tree(K.pine());
    this.P.round = tree(K.roundTree());
    this.P.tall = tree(K.tallTree());
    this.P.tuft = this.addPool(K.tuft(), swayMat(0.06), 400, { cast: false });
    this.P.flowers = this.addPool(K.flowers(), swayMat(0.04), 200, { cast: false });
    this.P.rock0 = this.addPool(K.rockPile(0), litMat({ roughness: 0.95 }), 80);
    this.P.rock1 = this.addPool(K.rockPile(1), litMat({ roughness: 0.95 }), 80);
    const roofs = [PAL.clay, PAL.teal, PAL.mustard];
    roofs.forEach((c, v) => { this.P['house' + v] = this.addPool(K.house(c), litMat(), 40); });
    this.P.win = this.addPool(K.windowPane(), this.windowMat, 4 * 120, { cast: false, receive: false });
    this.P.win.always = true;
    this.P.field = this.addPool(K.field(), swayMat(0.05), 60);
    this.P.olive = this.addPool(K.oliveGrove(), swayMat(0.025), 60);
    this.P.dock = this.addPool(K.dock(), litMat(), 40);
    this.P.boat = this.addPool(K.boat(), swayMat(0.02), 40);
    this.P.boat.always = true;
    this.P.pole = this.addPool(K.lanternPole(), litMat(), 80);
    this.P.glass = this.addPool(K.lanternGlass(), basicMat(), 80, { cast: false, receive: false });
    this.P.lh = this.addPool(K.lighthouse(), litMat(), 2);
    this.P.lhGlass = this.addPool(K.lighthouseGlass(), basicMat(), 2, { cast: false, receive: false });
    this.P.ruin = this.addPool(K.ruin(), litMat(), 12);
    this.P.orchard = this.addPool(K.orchard(), swayMat(0.02), 12);
    this.P.springStone = this.addPool(K.springStones(), swayMat(0.03), 8);
    this.P.springWater = this.addPool(K.springWater(), litMat({ emissive: new THREE.Color(0x4cc8d6), emissiveIntensity: 0.5, roughness: 0.2 }), 8, { cast: false });
    this.P.fish = this.addPool(K.fish(), basicMat(), 40, { cast: false, receive: false });
    this.P.fish.always = true;
    for (const p of this.pools) p.reduced = this.reduced;
    // parts do farol (sempre lá desde o início)
  }

  private addPool(g: THREE.BufferGeometry, m: THREE.Material, cap: number, o: { cast?: boolean; receive?: boolean } = {}): Pool {
    const p = new Pool(g, m, cap, o);
    this.pools.push(p);
    this.scene.add(p.mesh);
    return p;
  }

  private buildOverlays(): void {
    // brilho de lanterna (sprites de ponto, aditivos)
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d')!;
    const gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    // halos: quadrados que olham para a câmera, com brilho aditivo (um só draw call)
    this.halo = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 64);
    this.halo.frustumCulled = false; this.halo.count = 0; this.halo.renderOrder = 6;
    const w1 = new THREE.Color(1, 1, 1);
    for (let i = 0; i < 64; i++) this.halo.setColorAt(i, w1);
    this.scene.add(this.halo);
    // poça de luz no chão
    this.glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: tex, color: PAL.flame, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }), 64);
    this.glow.frustumCulled = false; this.glow.count = 0;
    this.scene.add(this.glow);
    // feixe do farol
    this.beam = new THREE.Mesh(K.cone(), new THREE.MeshBasicMaterial({ color: PAL.flameHot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.beam.frustumCulled = false; this.beam.visible = false;
    this.scene.add(this.beam);
    // ponta marcada
    this.flag = new THREE.Mesh(K.flag(), basicMat({ side: THREE.DoubleSide }));
    this.star = new THREE.Mesh(K.star(), basicMat({ side: THREE.DoubleSide }));
    this.flag.visible = this.star.visible = false;
    this.scene.add(this.flag, this.star);
    // realce dos hexágonos válidos
    this.hlMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, opacity: 0.8, toneMapped: false });
    this.hl = new THREE.InstancedMesh(K.hexRing(0.95, 0.74, 0.34, [1, 0.42, 0.04]), this.hlMat, N);
    this.hl.frustumCulled = false; this.hl.count = 0; this.hl.renderOrder = 4;
    this.scene.add(this.hl);
    // vento: anéis acima das nuvens nos alvos do sopro e na área que ele dissolve
    this.windMark = new THREE.InstancedMesh(K.hexRing(0.95, 0.76, 0.3, [0.8, 0.95, 1]), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }), N);
    this.windMark.frustumCulled = false; this.windMark.count = 0; this.windMark.renderOrder = 7;
    const wc = new THREE.Color(1, 1, 1);
    for (let i = 0; i < N; i++) this.windMark.setColorAt(i, wc);
    this.scene.add(this.windMark);
    // véu azulado sobre a terra que o vento mostrou mas a luz ainda não alcança
    this.veil = new THREE.InstancedMesh(K.hexRing(0.985, 0.04, 0.9, [0.2, 0.26, 0.5]), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.34, depthWrite: false, toneMapped: false }), N);
    this.veil.frustumCulled = false; this.veil.count = 0; this.veil.renderOrder = 3;
    this.scene.add(this.veil);
    // fiapos de vento da rajada: tiras finas com brilho nas pontas
    const sc = document.createElement('canvas'); sc.width = 128; sc.height = 8;
    const sx = sc.getContext('2d')!;
    const sg = sx.createLinearGradient(0, 0, 128, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.55, 'rgba(255,255,255,0.9)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    sx.fillStyle = sg; sx.fillRect(0, 2, 128, 4);
    const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
    this.streaks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.13).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: stex, color: 0x9fd9f2, transparent: true, depthWrite: false, toneMapped: false }), 20);
    this.streaks.frustumCulled = false; this.streaks.count = 0; this.streaks.renderOrder = 8;
    for (let i = 0; i < 20; i++) { this.streaks.setColorAt(i, new THREE.Color(1, 1, 1)); this.streakData.push({ lane: (hashN(i, 701) - 0.5) * 5, h: 0.55 + hashN(i, 702) * 1.3, d: hashN(i, 703) * 0.32, len: 2.2 + hashN(i, 704) * 1.8, ph: hashN(i, 705) * 6.28 }); }
    this.scene.add(this.streaks);
    // chuva: riscos verticais que olham para a câmera
    this.rainMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.022, 0.8), new THREE.MeshBasicMaterial({ color: 0xd6e8ff, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }), 280);
    this.rainMesh.frustumCulled = false; this.rainMesh.count = 0; this.rainMesh.renderOrder = 9;
    for (let i = 0; i < 280; i++) { const a = hashN(i, 711) * PI * 2, r = Math.sqrt(hashN(i, 712)) * 13; this.rainData.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: hashN(i, 713) * 10, v: 11 + hashN(i, 714) * 5 }); }
    this.scene.add(this.rainMesh);
    this.hover = new THREE.Mesh(K.hexRing(0.98, 0.62, 0.5, [1, 0.8, 0.3]), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
    this.hover.visible = false; this.hover.renderOrder = 5;
    this.scene.add(this.hover);
    this.ghostMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.58, depthWrite: false, roughness: 0.9 });
    this.ghostBasic = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false });
    // gaivotas
    this.gulls = new THREE.InstancedMesh(K.gull(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), 4);
    this.gulls.frustumCulled = false;
    this.scene.add(this.gulls);
    // poeira, fumaça e faíscas
    this.dust = new THREE.InstancedMesh(K.dustBall(), new THREE.MeshBasicMaterial({ vertexColors: true }), 260);
    this.dust.frustumCulled = false; this.dust.count = 0;
    const w = new THREE.Color(1, 1, 1);
    for (let i = 0; i < 260; i++) this.dust.setColorAt(i, w);
    this.scene.add(this.dust);
  }

  // =====================================================================
  // entrada: câmera orbital limitada
  // =====================================================================
  private bindInput(): void {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    const ptrs = new Map<number, { x: number; y: number }>();
    let pinch = 0, moved = false, startX = 0, startY = 0, downId = -1;
    el.addEventListener('pointerdown', (e) => {
      this.orbit = false;
      el.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { moved = false; startX = e.clientX; startY = e.clientY; downId = e.pointerId; }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); moved = true; }
    });
    el.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (p) {
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (ptrs.size === 1) {
          if (Math.hypot(e.clientX - startX, e.clientY - startY) > 6) moved = true;
          if (moved) { this.tYaw -= dx * 0.0062; this.tPol = Math.min(1.22, Math.max(0.3, this.tPol - dy * 0.0042)); }
        } else if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch > 0) this.tDist = Math.min(64, Math.max(10, this.tDist * (pinch / d)));
          pinch = d;
        }
      } else if (e.pointerType === 'mouse') {
        this.onHover(this.pick(e.clientX, e.clientY));
      }
    });
    const up = (e: PointerEvent): void => {
      if (ptrs.has(e.pointerId)) {
        ptrs.delete(e.pointerId);
        if (e.pointerId === downId && !moved && e.type === 'pointerup') this.onTap(this.pick(e.clientX, e.clientY), e);
        if (ptrs.size === 0) { pinch = 0; downId = -1; }
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.onHover(-1); });
    el.addEventListener('wheel', (e) => { this.tDist = Math.min(64, Math.max(10, this.tDist * (e.deltaY > 0 ? 1.09 : 0.92))); e.preventDefault(); }, { passive: false });
  }

  rotate(dYaw: number, dPol = 0): void { this.tYaw += dYaw; this.tPol = Math.min(1.22, Math.max(0.3, this.tPol + dPol)); }
  zoomBy(f: number): void { this.tDist = Math.min(64, Math.max(10, this.tDist * f)); }
  /** Ganchos de captura: posição da câmera, sem animação. */
  setCamera(o: { yaw?: number; pol?: number; dist?: number; cell?: number }): void {
    if (o.yaw !== undefined) this.tYaw = this.yaw = o.yaw;
    if (o.pol !== undefined) this.tPol = this.pol = Math.min(1.22, Math.max(0.3, o.pol));
    if (o.dist !== undefined) this.tDist = this.dist = Math.min(60, Math.max(8, o.dist));
    if (o.cell !== undefined && o.cell >= 0) { this.tTarget.set(cellX(o.cell), 0.4, cellZ(o.cell)); this.target.copy(this.tTarget); }
  }
  /** Muda só o alvo da câmera (ela chega suave). */
  aim(o: { yaw?: number; pol?: number; dist?: number }): void {
    if (o.yaw !== undefined) this.tYaw = o.yaw;
    if (o.pol !== undefined) this.tPol = o.pol;
    if (o.dist !== undefined) this.tDist = o.dist;
  }
  /** Sobe (f > 0) ou desce a ilha na tela, para centrar no espaço livre entre o topo e a mão do HUD. */
  setViewShift(f: number): void { this.viewShift = f; this.resize(); }
  /** Desloca a ilha para o lado (x > 0 move para a esquerda), p.ex. para abrir espaço ao painel do fim. */
  setViewX(x: number, snap = false): void { this.viewXT = x; if (snap || this.reduced) { this.viewX = x; this.resize(); } }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // Retrato: a ilha enche a largura útil (meia largura visível ~8,5 unidades); em tela larga, o enquadramento de sempre.
    const aspectK = Math.min(1.6, Math.max(1, 1.45 / this.camera.aspect));
    this.fit = aspectK;
    this.camera.setViewOffset(w, h, Math.round(w * this.viewX), Math.round(h * this.viewShift), w, h);
    this.camera.updateProjectionMatrix();
  }
  fit = 1;

  pick(clientX: number, clientY: number): number {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.pickPlane, p)) return -1;
    let best = -1, bd = 1e9;
    for (let i = 0; i < N; i++) { const d = (cellX(i) - p.x) ** 2 + (cellZ(i) - p.z) ** 2; if (d < bd) { bd = d; best = i; } }
    return bd <= 0.95 * 0.95 ? best : -1;
  }

  /** Posição do hexágono na tela (px), para os textos flutuantes do HUD. */
  screenPos(cell: number, up = 1): { x: number; y: number } {
    const v = new THREE.Vector3(cellX(cell), this.topY(cell) + up, cellZ(cell)).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  // =====================================================================
  // estado do jogo -> visual
  // =====================================================================
  topY(i: number): number {
    if (!this.shown[i] || !this.game) return TILE_SPECS[0].top + TILE_SPECS[0].bump * 0.5;
    return surf(this.game.map.terrain[i]);
  }

  /** Esquece tudo e recomeça (nova ilha). */
  reset(g: Game): void {
    this.game = g;
    this.shown.fill(0); this.revT.fill(Infinity); this.structShown.fill(0);
    this.tileActive.clear();
    for (const p of this.pools) p.clear();
    this.lights = []; this.emitters = []; this.fishData = []; this.darkLanterns.clear();
    this.parts = []; this.later = [];
    this.seaShore.fill(9);
    (this.sea.geometry.getAttribute('shore') as THREE.BufferAttribute).needsUpdate = true;
    for (let i = 0; i < N; i++) this.setTile(i, 1, 0);
    for (const t of this.tiles) t.instanceMatrix.needsUpdate = true;
    this.hl.count = 0; this.hover.visible = false; this.setGhost(-1, -1);
    this.tipCell = g.map.tip;
    this.flag.visible = this.star.visible = true;
    this.beam.visible = false;
    this.windowCols = new Map();
    this.veilCells.clear(); this.sweepX.fill(0); this.sweepZ.fill(0); this.veil.count = 0;
    this.windHoverCell = -1; this.windHoverK = 0; this.windMark.count = 0;
    this.gust.t = 9; U.gustAmp.value = 0; this.streaks.count = 0;
    this.rainT = 99; this.rainK = 0; U.rain.value = 0; this.rainMesh.count = 0;
  }

  private windowCols = new Map<number, Item[]>();

  sync(g: Game, o: { instant?: boolean; origin?: number; wind?: { dx: number; dz: number } } = {}): void {
    this.game = g;
    const inst = !!o.instant, now = this.time, origin = o.origin ?? CENTER;
    const fresh: number[] = [];
    for (let i = 0; i < N; i++) {
      if (g.seen[i] && !this.shown[i]) {
        this.shown[i] = 1;
        // Névoa soprada pelo vento: as nuvens voam na direção da rajada em vez de subir.
        if (o.wind && !g.revealed[i]) { this.sweepX[i] = o.wind.dx; this.sweepZ[i] = o.wind.dz; } else { this.sweepX[i] = 0; this.sweepZ[i] = 0; }
        this.revT[i] = inst ? -100 : now + (this.reduced ? 0 : dist(origin, i) * (o.wind ? 0.05 : 0.07));
        fresh.push(i); this.tileActive.add(i);
      }
    }
    for (let i = 0; i < N; i++) {
      if (g.struct[i] !== this.structShown[i]) this.buildStruct(i, g.struct[i], inst);
    }
    for (const i of fresh) {
      if (g.map.terrain[i] !== Terrain.Water) this.updateShore(i);
      const t0 = inst ? -100 : this.revT[i] + 0.3 + hashN(i, 9) * 0.25;
      this.buildDecor(i, t0);
      this.buildFind(i, t0);
    }
    // Véu: terra que o vento mostrou e a luz ainda não alcança (some quando uma lanterna a ilumina).
    for (let i = 0; i < N; i++) {
      const v = this.veilCells.get(i);
      if (g.seen[i] && !g.revealed[i]) { if (!v) this.veilCells.set(i, { off: -1 }); }
      else if (v && v.off < 0) v.off = inst ? -100 : now;
    }
    this.refreshWindows();
    this.placeTip();
  }

  private buildDecor(i: number, t0: number): void {
    const g = this.game;
    if (g.struct[i] !== Struct.None) return;
    const t = g.map.terrain[i], y = surf(t), cx = cellX(i), cz = cellZ(i);
    const anim = 'pop' as const;
    if (t === Terrain.Wood) {
      const pts: Array<[number, number]> = [];
      for (let k = 0; k < 40 && pts.length < 6; k++) {
        const a = hashN(i, 300 + k) * PI * 2, r = Math.sqrt(hashN(i, 340 + k)) * 0.78;
        const p: [number, number] = [Math.cos(a) * r, Math.sin(a) * r];
        if (pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.38)) pts.push(p);
      }
      pts.forEach(([dx, dz], k) => {
        const r = hashN(i, 400 + k);
        const pool = r < 0.45 ? this.P.pine : r < 0.8 ? this.P.round : this.P.tall;
        const it = pool.make(i, 'decor', cx + dx, y, cz + dz, hashN(i, 420 + k) * PI * 2, 0.85 + hashN(i, 440 + k) * 0.45, t0 + k * 0.05, anim);
        const v = 0.86 + hashN(i, 460 + k) * 0.3;
        it.col = new THREE.Color(v, v * (0.96 + hashN(i, 470 + k) * 0.08), v * 0.96);
      });
    } else if (t === Terrain.Rock) {
      const a = this.P['rock' + (hashN(i, 7) < 0.5 ? 0 : 1)];
      a.make(i, 'decor', cx + (hashN(i, 8) - 0.5) * 0.3, y + 0.02, cz + (hashN(i, 9) - 0.5) * 0.3, hashN(i, 10) * PI * 2, 1.1 + hashN(i, 11) * 0.3, t0, anim);
    } else if (t === Terrain.Meadow) {
      const n = 2 + Math.floor(hashN(i, 12) * 3);
      for (let k = 0; k < n; k++) {
        const a = hashN(i, 500 + k) * PI * 2, r = 0.25 + hashN(i, 520 + k) * 0.5;
        this.P.tuft.make(i, 'decor', cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, hashN(i, 540 + k) * 6, 0.9 + hashN(i, 560 + k) * 0.6, t0 + k * 0.04, anim);
      }
      if (hashN(i, 13) > 0.35) {
        const a = hashN(i, 14) * PI * 2, r = 0.3 + hashN(i, 15) * 0.4;
        this.P.flowers.make(i, 'decor', cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, hashN(i, 16) * 6, 1.2, t0 + 0.1, anim);
      }
    }
  }

  private buildFind(i: number, t0: number): void {
    const g = this.game, f = g.map.finds[i];
    if (f === Find.None) return;
    const t = g.map.terrain[i], y = surf(t), cx = cellX(i), cz = cellZ(i);
    const yaw = hashN(i, 21) * PI * 2;
    if (f === Find.Ruin) this.P.ruin.make(i, 'find', cx, y, cz, yaw, 1.15, t0, 'pop');
    else if (f === Find.Orchard) this.P.orchard.make(i, 'find', cx, y, cz, yaw, 1.05, t0, 'pop');
    else if (f === Find.Spring) {
      this.P.springStone.make(i, 'find', cx, y, cz, yaw, 1, t0, 'pop');
      this.P.springWater.make(i, 'find', cx, y, cz, yaw, 1, t0, 'pop');
    } else if (f === Find.Fish) {
      for (let k = 0; k < 9; k++) {
        const it = this.P.fish.make(i, 'find', cx, 0.0, cz, 0, 1, t0 + k * 0.05, 'pop');
        this.fishData.push({ it, cell: i, a: hashN(i, 600 + k) * 6.28, r: 0.25 + hashN(i, 620 + k) * 0.45, sp: (0.5 + hashN(i, 640 + k) * 0.6) * (k % 2 ? 1 : -1), ph: hashN(i, 660 + k) * 6.28 });
      }
    }
    if (!this.reduced) this.later.push({ t: t0 + 0.2, fn: () => this.burst(cx, y + 0.5, cz, 14, 0xffe08a, 1.4, true) });
  }

  private buildStruct(i: number, s: number, inst: boolean): void {
    const g = this.game, now = this.time;
    this.structShown[i] = s;
    for (const p of this.pools) { p.removeCell(i, 'struct'); p.removeCell(i, 'decor'); }
    this.lights = this.lights.filter((l) => l.cell !== i);
    this.emitters = this.emitters.filter((e) => e.cell !== i);
    this.windowCols.delete(i);
    if (s === Struct.None) return;
    const t = g.map.terrain[i], y = surf(t), cx = cellX(i), cz = cellZ(i);
    const t0 = inst ? -100 : now;
    const yaw = Math.floor(hashN(i, 31) * 6) * PI / 3 + (hashN(i, 32) - 0.5) * 0.25;
    const drop = 'drop' as const;
    const land = (): void => { if (!inst && !this.reduced) this.later.push({ t: t0 + 0.4, fn: () => this.burst(cx, y + 0.1, cz, 9, 0xe7d8b5, 1) }); };
    switch (s) {
      case Struct.House: {
        const v = Math.floor(hashN(i, 33) * 3);
        const it = this.P['house' + v].make(i, 'struct', cx, y, cz, yaw, 1.3, t0, drop);
        const wins: Item[] = [];
        K.WINDOW_SLOTS.forEach((w) => {
          const wi = this.P.win.make(i, 'struct', 0, 0, 0, 0, 1, t0, 'none');
          wi.parent = it;
          wi.local = new THREE.Matrix4().compose(new THREE.Vector3(w.x, w.y, w.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), w.ry), new THREE.Vector3(1, 1, 1));
          wins.push(wi);
        });
        this.windowCols.set(i, wins);
        const cs = Math.cos(yaw), sn = Math.sin(yaw);
        this.emitters.push({ cell: i, x: cx + (0.14 * cs + 0.09 * sn) * 1.3, y: y + 0.9, z: cz + (-0.14 * sn + 0.09 * cs) * 1.3, next: this.time + 0.5 + hashN(i, 34) });
        land();
        break;
      }
      case Struct.Field: this.P.field.make(i, 'struct', cx, y, cz, Math.floor(hashN(i, 35) * 6) * PI / 3, 1, t0, drop); land(); break;
      case Struct.Olive: this.P.olive.make(i, 'struct', cx, y, cz, yaw, 1, t0, drop); land(); break;
      case Struct.Dock: {
        const d = WATER_DIR(g, i), dq = DIRS[d][0], dr = DIRS[d][1];
        const dx = 1.5 * dq, dz = S3 * (dr + dq / 2), ang = -Math.atan2(dz, dx);
        const dy = TILE_SPECS[Terrain.Beach].top + 0.06;
        this.P.dock.make(i, 'struct', cx, dy, cz, ang, 1, t0, drop);
        const len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
        const b = this.P.boat.make(i, 'struct', cx + ux * 1.3 - uz * 0.5, 0.02, cz + uz * 1.3 + ux * 0.5, ang + 0.15, 1, t0 + 0.2, 'pop');
        b.bob = 0.025;
        land();
        break;
      }
      case Struct.Lantern: {
        if (i === CENTER) {
          this.P.lh.make(i, 'struct', cx, y, cz, 0, 1, -100, 'none');
          this.P.lhGlass.make(i, 'struct', cx, y, cz, 0, 1, -100, 'none');
          this.lights.push({ cell: i, x: cx + K.LIGHTHOUSE_TOP.x, y: y + K.LIGHTHOUSE_TOP.y, z: cz + K.LIGHTHOUSE_TOP.z, farol: true, t0: -100 });
        } else {
          this.P.pole.make(i, 'struct', cx, y, cz, yaw, 1.3, t0, drop);
          this.P.glass.make(i, 'struct', cx, y, cz, yaw, 1.3, t0, drop);
          this.lights.push({ cell: i, x: cx, y: y + 1.27, z: cz, farol: false, t0: t0 + 0.4 });
          if (!inst && !this.reduced) this.later.push({ t: t0 + 0.42, fn: () => this.burst(cx, y + 1.25, cz, 18, 0xffd36a, 1.6, true) });
        }
        break;
      }
    }
    this.applyLanternColors();
  }

  /** Lanternas apagadas por falta de óleo (só durante a noite). */
  setDarkLanterns(cells: number[]): void {
    this.darkLanterns = new Set(cells);
    this.applyLanternColors();
  }
  private applyLanternColors(): void {
    for (const it of this.P.glass.items) {
      const dark = this.darkLanterns.has(it.cell);
      it.col = dark ? new THREE.Color(0.22, 0.24, 0.3) : new THREE.Color(1.05 + this.night * 0.5, 1.0 + this.night * 0.25, 0.9);
    }
    this.P.glass.dirty = true;
  }

  private refreshWindows(): void {
    const g = this.game;
    const n = this.night;
    const lit = new THREE.Color(lerp(0.95, 1.7, n), lerp(0.78, 1.15, n), lerp(0.45, 0.5, n));
    const off = new THREE.Color(lerp(0.5, 0.07, n), lerp(0.64, 0.09, n), lerp(0.72, 0.15, n));
    for (const [cell, wins] of this.windowCols) {
      const r = g.houseResidents(cell);
      wins.forEach((w, k) => { w.col = k < r ? lit : off; });
    }
    this.P.win.dirty = true;
  }

  private placeTip(): void {
    const i = this.tipCell;
    if (i < 0) return;
    const y = this.topY(i);
    const x = cellX(i) + 0.42, z = cellZ(i) - 0.3;
    this.flag.position.set(x, y, z);
    this.star.position.set(x, y + 1.72, z);
  }

  // =====================================================================
  // realce, fantasma e efeitos pontuais
  // =====================================================================
  setValid(cells: number[]): void {
    const m = new THREE.Matrix4();
    cells.forEach((c, k) => { m.makeTranslation(cellX(c), this.topY(c) + 0.1, cellZ(c)); this.hl.setMatrixAt(k, m); });
    this.hl.count = cells.length;
    this.hl.instanceMatrix.needsUpdate = true;
  }

  /** Alvos do sopro (anéis suaves, com o vento armado) e a área que o sopro dissolveria sob o cursor (anéis fortes). */
  setWindMarks(targets: number[], area: number[], hoverCell = -1): void {
    this.windHoverCell = hoverCell;
    if (hoverCell >= 0) this.windWigCell = hoverCell;
    const m = new THREE.Matrix4(), c = new THREE.Color();
    let k = 0;
    const put = (cell: number, bright: number): void => {
      m.makeTranslation(cellX(cell), this.shown[cell] ? this.topY(cell) + 0.14 : 1.45, cellZ(cell));
      this.windMark.setMatrixAt(k, m); this.windMark.setColorAt(k, c.setRGB(bright, bright, bright)); k++;
    };
    for (const t of targets) if (!area.includes(t)) put(t, 0.55);
    for (const a of area) put(a, 1);
    this.windMark.count = k;
    this.windMark.instanceMatrix.needsUpdate = true;
    if (this.windMark.instanceColor) this.windMark.instanceColor.needsUpdate = true;
  }
  private windWigCell = -1;

  /** Rajada do sopro: fiapos de vento atravessam a nuvem, as copas perto se curvam por 1 s e a névoa é empurrada. */
  blowAt(cell: number, dx: number, dz: number): void {
    if (this.reduced) return;
    this.gust = { t: 0, x: cellX(cell), z: cellZ(cell), dx, dz };
    U.gustPos.value.set(this.gust.x, this.gust.z); U.gustDir.value.set(dx, dz);
    for (let k = 0; k < 14 && this.parts.length < 240; k++) {
      const sp = 2 + Math.random() * 2.6;
      this.parts.push({ x: this.gust.x - dx * 1.2 + (Math.random() - 0.5) * 1.6, y: 0.7 + Math.random() * 0.8, z: this.gust.z - dz * 1.2 + (Math.random() - 0.5) * 1.6, vx: dx * sp, vz: dz * sp, vy: 0.1, t: 0, life: 0.8 + Math.random() * 0.4, s0: 0.1, s1: 0.26, g: 0 });
      this.dust.setColorAt(this.parts.length - 1, new THREE.Color(0.96, 0.98, 1));
    }
    if (this.dust.instanceColor) this.dust.instanceColor.needsUpdate = true;
  }

  /** Chuva cosmética de 4 s sobre a ilha (não muda regra nenhuma). */
  rain(): void { this.rainT = 0; }
  get raining(): boolean { return this.rainT < 4.4; }

  /** O ponto da tela é céu vazio (fora do tampo do diorama)? */
  isSky(clientX: number, clientY: number): boolean {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.pickPlane, p)) return true;
    return Math.hypot(p.x, p.z) > 16;
  }

  setCursor(c: string): void { this.renderer.domElement.style.cursor = c; }

  setHover(cell: number): void {
    if (cell < 0) { this.hover.visible = false; return; }
    this.hover.visible = true;
    this.hover.position.set(cellX(cell), this.topY(cell) + 0.12, cellZ(cell));
  }

  /** Fantasma da carta sobre o hexágono sob o cursor (card = -1 apaga). */
  setGhost(card: number, cell: number): void {
    if (this.ghost && this.ghostCell === cell && (this.ghost.userData.card as number) === card) return;
    if (this.ghost) { this.scene.remove(this.ghost); this.ghost = null; }
    this.ghostCell = cell;
    if (card < 0 || cell < 0) return;
    const grp = new THREE.Group();
    const part = (geo: THREE.BufferGeometry, basic = false, s = 1): void => { const m = new THREE.Mesh(geo, basic ? this.ghostBasic : this.ghostMat); m.scale.setScalar(s); grp.add(m); };
    switch (card) {
      case Card.House: part(this.P.house0.mesh.geometry, false, 1.3); break;
      case Card.Field: part(this.P.field.mesh.geometry); break;
      case Card.Olive: part(this.P.olive.mesh.geometry); break;
      case Card.Lantern: part(this.P.pole.mesh.geometry, false, 1.3); part(this.P.glass.mesh.geometry, true, 1.3); break;
      case Card.Dock: {
        part(this.P.dock.mesh.geometry);
        const d = WATER_DIR(this.game, cell), dq = DIRS[d][0], dr = DIRS[d][1];
        grp.rotation.y = -Math.atan2(S3 * (dr + dq / 2), 1.5 * dq);
        break;
      }
    }
    grp.userData.card = card;
    const y = card === Card.Dock ? TILE_SPECS[Terrain.Beach].top + 0.06 : this.topY(cell);
    grp.position.set(cellX(cell), y + 0.05, cellZ(cell));
    grp.userData.y = y;
    this.scene.add(grp);
    this.ghost = grp;
  }

  /** Poeira, fumaça ou faíscas num ponto. */
  burst(x: number, y: number, z: number, n: number, color: number, power = 1, spark = false): void {
    if (this.reduced) return;
    const c = new THREE.Color(color);
    for (let k = 0; k < n && this.parts.length < 250; k++) {
      const a = Math.random() * PI * 2, sp = (0.5 + Math.random() * 0.8) * power;
      this.parts.push({ x, y, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: spark ? 0.8 + Math.random() * 1.4 : 0.3 + Math.random() * 0.6, t: 0, life: spark ? 0.9 + Math.random() * 0.5 : 0.6 + Math.random() * 0.3, s0: spark ? 0.045 : 0.07, s1: spark ? 0.0 : 0.17, g: spark ? -1.6 : -0.4 });
      this.dust.setColorAt(this.parts.length - 1, spark ? new THREE.Color(1.8, 1.4, 0.6) : c);
    }
    if (this.dust.instanceColor) this.dust.instanceColor.needsUpdate = true;
  }

  // =====================================================================
  // hora do dia
  // =====================================================================
  setDay(turn: number, over: boolean, snap = false): void {
    this.dayTarget = over ? 1 : clamp01((turn - 1) / 29);
    if (snap) this.day = this.dayTarget;
  }
  setNight(n: number, snap = false): void {
    this.nightTarget = n;
    if (snap || this.reduced) this.night = n;
  }

  private applyLighting(): void {
    const p = this.day;
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let k = 0; k < KEYS.length - 1; k++) if (p >= KEYS[k].p && p <= KEYS[k + 1].p) { a = KEYS[k]; b = KEYS[k + 1]; }
    const t = smooth((p - a.p) / (b.p - a.p || 1));
    const n = smooth(this.night);
    const mix = (k: 'sun' | 'hs' | 'hg' | 'top' | 'bot', out: THREE.Color): THREE.Color => out.copy(a[k]).lerp(b[k], t).lerp(NIGHT[k], n);
    const elev = lerp(lerp(a.elev, b.elev, t), NIGHT.elev, n) * PI / 180, az = lerp(lerp(a.az, b.az, t), NIGHT.az, n) * PI / 180;
    const d = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));
    this.sun.position.copy(d).multiplyScalar(52);
    this.sun.color = mix('sun', this.sun.color);
    this.sun.intensity = lerp(lerp(a.sunI, b.sunI, t), NIGHT.sunI, n) * (1 - 0.4 * this.rainK);
    mix('hs', this.hemi.color); mix('hg', this.hemi.groundColor);
    this.hemi.intensity = lerp(lerp(a.hI, b.hI, t), NIGHT.hI, n);
    this.renderer.toneMappingExposure = lerp(lerp(a.exp, b.exp, t), NIGHT.exp, n);
    const rainTint = new THREE.Color(0x8e9bb0);
    const top = mix('top', new THREE.Color()).lerp(rainTint, 0.5 * this.rainK).getStyle(), bot = mix('bot', new THREE.Color()).lerp(rainTint, 0.4 * this.rainK).getStyle();
    if (top !== this.cssTop || bot !== this.cssBot) {
      this.cssTop = top; this.cssBot = bot;
      const st = document.documentElement.style;
      st.setProperty('--sky-top', top); st.setProperty('--sky-bot', bot); st.setProperty('--night', n.toFixed(3));
    }
    // lanternas ficam mais fortes ao anoitecer
    this.haloK = n * n;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.05 + 0.85 * n;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.11 * n;
    if (Math.abs(n - this.lastNight) > 0.01) {
      this.lastNight = n;
      this.refreshWindows();
      this.applyLanternColors();
    }
  }

  // =====================================================================
  // quadro
  // =====================================================================
  frame(dtReal: number): void {
    const dtc = Math.min(dtReal, 0.1);
    let dt = dtc;
    // Gancho de captura: deixa o mundo andar `hold` segundos e o congela (a câmera e o desenho seguem).
    if (this.hold >= 0) { dt = Math.min(dtc, this.hold); this.hold -= dt; }
    this.time += dt;
    U.time.value = this.time;
    const t = this.time;
    // câmera
    const kc = 1 - Math.exp(-dtc * 9);
    this.yaw += (this.tYaw - this.yaw) * kc;
    this.pol += (this.tPol - this.pol) * kc;
    this.dist += (this.tDist - this.dist) * kc;
    this.target.lerp(this.tTarget, kc);
    if (this.orbit) this.tYaw += dtc * 0.05;
    if (Math.abs(this.viewX - this.viewXT) > 0.0004) { this.viewX += (this.viewXT - this.viewX) * (1 - Math.exp(-dtc * 2)); this.resize(); }
    const dd = this.dist * this.fit;
    this.camera.position.set(this.target.x + Math.sin(this.pol) * Math.sin(this.yaw) * dd, this.target.y + Math.cos(this.pol) * dd, this.target.z + Math.sin(this.pol) * Math.cos(this.yaw) * dd);
    this.camera.lookAt(this.target);
    // dia e noite
    this.day += (this.dayTarget - this.day) * (1 - Math.exp(-dtc * 2.2));
    this.night += (this.nightTarget - this.night) * (this.reduced ? 1 : 1 - Math.exp(-dtc * 1.7));
    this.applyLighting();
    this.sun.target.position.set(0, 0, 0);

    this.windHoverK += ((this.windHoverCell >= 0 && !this.reduced ? 1 : 0) - this.windHoverK) * (1 - Math.exp(-dtc * 10));
    if (this.windHoverK < 0.01 && this.windHoverCell < 0) this.windWigCell = -1;
    this.updateTiles();
    this.updateVeil(t);
    this.updateGust(dt);
    this.updateRain(dt);
    this.updateClouds(t);
    this.updateFish(t);
    for (const p of this.pools) p.refresh(t);
    this.updateLights(t);
    this.updateParticles(dt, t);
    this.updateMisc(t);
    this.renderer.render(this.scene, this.camera);
    const inf = this.renderer.info;
    this.stats = { calls: inf.render.calls, triangles: inf.render.triangles, geometries: inf.memory.geometries, textures: inf.memory.textures };
    this.frames++;
  }

  private updateTiles(): void {
    if (!this.tileActive.size) return;
    const t = this.time;
    for (const i of [...this.tileActive]) {
      const age = t - this.revT[i];
      const fast = this.reduced ? 0.2 : 1;
      if (age < 0) continue;
      const sMist = 1 - smooth(age / (0.5 * fast));
      const q = clamp01((age - 0.12 * fast) / (0.65 * fast));
      const e = q <= 0 ? 0 : 1 + 2.70158 * Math.pow(q - 1, 3) + 1.70158 * Math.pow(q - 1, 2);
      this.setTile(i, sMist, e <= 0 ? 0 : Math.max(0.001, e));
      if (age > 1.5 * fast) { this.setTile(i, 0, 1); this.tileActive.delete(i); }
    }
    for (const m of this.tiles) m.instanceMatrix.needsUpdate = true;
  }

  private updateVeil(t: number): void {
    const m = new THREE.Matrix4();
    let k = 0;
    for (const [i, v] of this.veilCells) {
      if (!this.shown[i]) continue;
      let s = smooth((t - this.revT[i] - 0.45) / 0.5);
      if (v.off >= 0) { const u = (t - v.off) / 0.7; if (u >= 1) { this.veilCells.delete(i); continue; } s *= 1 - smooth(u); }
      m.makeScale(s, 1, s).setPosition(cellX(i), this.topY(i) + 0.075, cellZ(i));
      this.veil.setMatrixAt(k++, m);
    }
    this.veil.count = k;
    this.veil.instanceMatrix.needsUpdate = true;
  }

  private updateGust(dt: number): void {
    const g = this.gust;
    if (g.t >= 1.4) { if (U.gustAmp.value !== 0) { U.gustAmp.value = 0; this.streaks.count = 0; } return; }
    g.t += dt;
    U.gustAmp.value = this.reduced ? 0 : Math.sin(Math.PI * Math.min(1, g.t / 1.0));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    const ax = new THREE.Vector3(0, 1, 0), base = -Math.atan2(g.dz, g.dx);
    this.streakData.forEach((d, k) => {
      const lt = g.t - d.d;
      const u = lt / 1.0;
      if (u < 0 || u > 1) { this.streaks.setMatrixAt(k, m.makeScale(0, 0, 0)); return; }
      const along = -5 + u * 11, fade = Math.pow(Math.sin(Math.PI * u), 0.7);
      p.set(g.x + g.dx * along - g.dz * d.lane, d.h + Math.sin(u * 6 + d.ph) * 0.12, g.z + g.dz * along + g.dx * d.lane);
      q.setFromAxisAngle(ax, base + Math.sin(u * 9 + d.ph) * 0.22);
      sc.set(d.len * (0.6 + 0.4 * fade), 1, 1);
      this.streaks.setMatrixAt(k, m.compose(p, q, sc));
      this.streaks.setColorAt(k, col.setRGB(fade, fade, fade));
    });
    this.streaks.count = 20;
    this.streaks.instanceMatrix.needsUpdate = true;
    if (this.streaks.instanceColor) this.streaks.instanceColor.needsUpdate = true;
  }

  private updateRain(dt: number): void {
    if (this.rainT >= 4.4) { if (this.rainK !== 0) { this.rainK = 0; U.rain.value = 0; this.rainMesh.count = 0; } return; }
    this.rainT += dt;
    const k = Math.max(0, Math.min(1, this.rainT / 0.6) * Math.min(1, (4 - this.rainT) / 0.9));
    this.rainK = k;
    U.rain.value = this.reduced ? 0 : k;
    const n = Math.floor((this.reduced ? 70 : 280) * k);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const slow = this.reduced ? 0.35 : 1;
    for (let i = 0; i < n; i++) {
      const d = this.rainData[i];
      d.y -= d.v * slow * dt;
      if (d.y < 0) { d.y += 10; const a = hashN(i, Math.floor(this.rainT * 7)) * PI * 2, r = Math.sqrt(hashN(i, 3 + Math.floor(this.rainT * 5))) * 13; d.x = Math.cos(a) * r; d.z = Math.sin(a) * r; }
      m.compose(p.set(d.x, d.y, d.z), q, one);
      this.rainMesh.setMatrixAt(i, m);
    }
    this.rainMesh.count = n;
    this.rainMesh.instanceMatrix.needsUpdate = true;
    (this.rainMesh.material as THREE.MeshBasicMaterial).opacity = (this.reduced ? 0.3 : 0.5) * Math.min(1, k * 1.4);
  }

  private updateClouds(t: number): void {
    const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    this.puffData.forEach((p, n) => {
      const age = t - this.revT[p.cell];
      let s = 1, lift = 0, px = 0, pz = 0;
      if (age >= 0) {
        const d = age / (this.reduced ? 0.25 : 0.85);
        const sx = this.sweepX[p.cell], sz = this.sweepZ[p.cell];
        if (d >= 1) s = 0;
        else if (sx !== 0 || sz !== 0) { s = 1 - d * d; lift = d * 0.3; px = sx * d * d * 3.4; pz = sz * d * d * 3.4; }
        else { s = 1 - d * d * d; lift = d * 0.9; }
      }
      const wig = p.cell === this.windWigCell ? this.windHoverK : 0;
      const bob = Math.sin(t * 0.55 + p.ph) * 0.05 * U.motion.value;
      const r = p.r * s * (1 + Math.sin(t * 0.4 + p.ph * 2) * 0.03 * U.motion.value + Math.sin(t * 13 + p.ph) * 0.06 * wig);
      pos.set(p.x + px + Math.sin(t * 0.2 + p.ph) * 0.05 * U.motion.value + Math.sin(t * 11 + p.ph * 3) * 0.1 * wig, p.y + bob + lift, p.z + pz + Math.cos(t * 9 + p.ph) * 0.07 * wig);
      sc.set(r, r * 0.72, r);
      m.compose(pos, q.identity(), sc);
      if (s <= 0.001) m.makeScale(0, 0, 0);
      this.puffs.setMatrixAt(n, m);
    });
    this.puffs.instanceMatrix.needsUpdate = true;
  }

  private updateFish(t: number): void {
    for (const f of this.fishData) {
      const a = f.a + t * f.sp;
      f.it.x = cellX(f.cell) + Math.cos(a) * f.r;
      f.it.z = cellZ(f.cell) + Math.sin(a) * f.r;
      f.it.y = -0.02 + Math.sin(t * 2 + f.ph) * 0.01;
      f.it.yaw = -a + (f.sp > 0 ? -PI / 2 : PI / 2);
      f.it.s = 1.5 + 1.1 * Math.max(0, Math.sin(t * 3.1 + f.ph * 3));
    }
  }

  private updateLights(t: number): void {
    const gm = new THREE.Matrix4(), gp = new THREE.Vector3(), gs = new THREE.Vector3(), gq = new THREE.Quaternion();
    let gn = 0, hn = 0;
    let beamAt: LightRec | null = null;
    const cam = this.camera.quaternion;
    const col = new THREE.Color();
    const halo = (x: number, y: number, z: number, size: number, k: number, r: number, g: number, b: number): void => {
      gp.set(x, y, z); gs.set(size, size, size);
      gm.compose(gp, cam, gs);
      this.halo.setMatrixAt(hn, gm);
      this.halo.setColorAt(hn, col.setRGB(r * k, g * k, b * k));
      hn++;
    };
    for (const l of this.lights) {
      if (t < l.t0) continue;
      const dark = this.darkLanterns.has(l.cell) && !l.farol;
      if (dark) continue;
      const flick = 1 + Math.sin(t * 7 + l.x * 3) * 0.03 * U.motion.value;
      const appear = Math.min(1, (t - l.t0) / 0.5 + 0.05);
      if (l.farol) { halo(l.x, l.y, l.z, 5.2 * appear, this.haloK * 0.9, 1, 0.72, 0.3); beamAt = l; } else halo(l.x, l.y, l.z, 2.3 * flick * appear, this.haloK, 1, 0.72, 0.3);
      const rad = (l.farol ? 5.4 : 4.4) * flick * appear;
      gp.set(cellX(l.cell), this.topY(l.cell) + 0.07, cellZ(l.cell));
      gs.set(rad, 1, rad);
      gm.compose(gp, gq.identity(), gs);
      this.glow.setMatrixAt(gn++, gm);
    }
    if (this.star.visible) halo(this.star.position.x, this.star.position.y, this.star.position.z, 1.5, 0.5 * this.night, 1, 0.85, 0.4);
    this.glow.count = gn; this.glow.instanceMatrix.needsUpdate = true;
    this.halo.count = hn; this.halo.instanceMatrix.needsUpdate = true;
    if (this.halo.instanceColor) this.halo.instanceColor.needsUpdate = true;
    // feixe do farol gira devagar
    this.beam.visible = !!beamAt;
    if (beamAt) {
      this.beam.position.set(beamAt.x, beamAt.y, beamAt.z);
      this.beam.scale.setScalar(0.65);
      this.beam.rotation.y = t * 0.55;
    }
    // ponta marcada: estrela que gira e flutua
    if (this.star.visible) {
      this.star.rotation.y = t * 1.2;
      this.star.position.y = this.topY(this.tipCell) + 1.72 + Math.sin(t * 1.6) * 0.06 * U.motion.value;
    }
    // realce pulsa
    this.hlMat.opacity = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(t * 3.2)) * (this.reduced ? 0.4 : 1);
    if (this.ghost) {
      const y = (this.ghost.userData.y as number) + 0.05 + (this.reduced ? 0 : Math.sin(t * 3) * 0.035);
      this.ghost.position.y = y;
    }
  }

  private updateParticles(dt: number, t: number): void {
    // fumaça das chaminés
    if (!this.reduced) for (const e of this.emitters) {
      if (t >= e.next) {
        e.next = t + 1.4 + Math.random() * 0.8;
        if (this.parts.length < 240) {
          this.parts.push({ x: e.x, y: e.y, z: e.z, vx: 0.07, vz: 0.03, vy: 0.22, t: 0, life: 3, s0: 0.03, s1: 0.11, g: 0.02 });
          this.dust.setColorAt(this.parts.length - 1, new THREE.Color(0.8, 0.82, 0.88));
          if (this.dust.instanceColor) this.dust.instanceColor.needsUpdate = true;
        }
      }
    }
    while (this.later.length && this.later[0].t <= t) this.later.shift()!.fn();
    this.later.sort((a, b) => a.t - b.t);
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const keep: typeof this.parts = [];
    const cols: THREE.Color[] = [];
    const tmp = new THREE.Color();
    // compacta preservando as cores
    this.parts.forEach((_a, n) => { if (this.dust.instanceColor) { tmp.fromBufferAttribute(this.dust.instanceColor, n); cols.push(tmp.clone()); } else cols.push(new THREE.Color(1, 1, 1)); });
    const keepCols: THREE.Color[] = [];
    this.parts.forEach((a, n) => {
      a.t += dt;
      if (a.t >= a.life) return;
      a.vy += a.g * dt; a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
      a.vx *= 1 - dt * 1.2; a.vz *= 1 - dt * 1.2;
      keep.push(a); keepCols.push(cols[n]);
    });
    this.parts = keep;
    keep.forEach((a, n) => {
      const u = a.t / a.life;
      const sz = lerp(a.s0, a.s1, Math.min(1, u * 1.4)) * (u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1);
      p.set(a.x, a.y, a.z); s.setScalar(Math.max(0.0001, sz));
      m.compose(p, q.identity(), s);
      this.dust.setMatrixAt(n, m);
      this.dust.setColorAt(n, keepCols[n]);
    });
    this.dust.count = keep.length;
    this.dust.instanceMatrix.needsUpdate = true;
    if (this.dust.instanceColor) this.dust.instanceColor.needsUpdate = true;
  }

  private updateMisc(t: number): void {
    // gaivotas em órbita
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), y = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < 4; k++) {
      const a = t * (0.12 + k * 0.025) + k * 1.7, r = 9 + k * 1.6;
      p.set(Math.cos(a) * r, 4.2 + k * 0.7 + Math.sin(t * 0.7 + k) * 0.3, Math.sin(a) * r);
      q.setFromAxisAngle(y, -a - PI);
      const flap = 0.6 + 0.4 * Math.sin(t * 5 + k * 2) * (this.reduced ? 0.1 : 1);
      s.set(1.2, 1.2, 1.2 * flap);
      m.compose(p, q, s);
      this.gulls.setMatrixAt(k, m);
    }
    this.gulls.instanceMatrix.needsUpdate = true;
  }

  /** Efeitos pós-captura/depuração. */
  get info(): { calls: number; triangles: number } { return this.stats; }
  /** Hexágonos com casas, para o foco da câmera. */
  focusVillage(): number {
    const g = this.game;
    let best = -1, bs = -1;
    for (const h of g.houses) {
      let sc = 0;
      for (const o of g.houses) if (dist(h, o) <= 2) sc += 3 - dist(h, o);
      if (sc > bs) { bs = sc; best = h; }
    }
    return best;
  }
}
