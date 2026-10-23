// A cena: mesa de nogueira com o pergaminho, as regiões fundadas em diorama, a vida em movimento e a hora do dia.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { H0, REGION_BY_ID, REGIONS, SHEET, Week, regionAt, worldToCell, Region, ckey, CELL_REGION } from './data';
import { buildModel, Deco, Model, sampleRoute } from './model';
import { PAL } from './render/palette';
import { Pool } from './render/pool';
import { U, litMat, riverMat, swayMat } from './render/materials';
import { regionGeometry } from './render/terrain';
import { drawParchment } from './render/parchment';
import { ribbon } from './render/ribbon';
import * as K from './render/kits';
import * as K2 from './render/kits2';
import { Geo } from './render/geo';

const PI = Math.PI;
export type Hour = 'dia' | 'entardecer' | 'noite';

interface HourDef { sunCol: number; sunI: number; sunPos: [number, number, number]; hemiSky: number; hemiGround: number; hemiI: number; exp: number; night: number; env: number; bg: [string, string, string]; }
const HOURS: Record<Hour, HourDef> = {
  dia: { sunCol: 0xffe9c8, sunI: 2.7, sunPos: [-18, 34, 24], hemiSky: 0xe4ecfc, hemiGround: 0x8a7352, hemiI: 0.5, exp: 0.88, night: 0, env: 0.3, bg: ['#5a4330', '#2a1d14', '#0f0a07'] },
  entardecer: { sunCol: 0xff9548, sunI: 2.7, sunPos: [-34, 11, 16], hemiSky: 0xd89a86, hemiGround: 0x5a3a38, hemiI: 0.55, exp: 0.95, night: 0.55, env: 0.22, bg: ['#7a4632', '#35192a', '#0d0710'] },
  noite: { sunCol: 0x93aefc, sunI: 0.75, sunPos: [16, 28, -12], hemiSky: 0x33447a, hemiGround: 0x17121f, hemiI: 0.5, exp: 1.12, night: 1, env: 0.1, bg: ['#26304f', '#0d1226', '#04050b'] },
};
export const HOUR_NAMES: Hour[] = ['dia', 'entardecer', 'noite'];

const ROOF = { a: PAL.clay, b: PAL.teal, c: PAL.mustard };
interface KitDef { geo: () => THREE.BufferGeometry; mat: 'lit' | 'sway' | 'swayS' | 'win' | 'glass'; cast?: boolean; receive?: boolean; }
const KITS: Record<string, KitDef> = {
  h1a: { geo: () => K.house(ROOF.a), mat: 'lit' }, h1b: { geo: () => K.house(ROOF.b), mat: 'lit' }, h1c: { geo: () => K.house(ROOF.c), mat: 'lit' },
  h2a: { geo: () => K.houseB(2, ROOF.a), mat: 'lit' }, h2b: { geo: () => K.houseB(2, ROOF.b), mat: 'lit' },
  h3a: { geo: () => K.houseB(3, ROOF.a), mat: 'lit' }, h3b: { geo: () => K.houseB(3, ROOF.b), mat: 'lit' },
  h4a: { geo: () => K.houseB(4, ROOF.a), mat: 'lit' }, h4b: { geo: () => K.houseB(4, ROOF.b), mat: 'lit' },
  pine: { geo: K.pine, mat: 'sway' }, round: { geo: K.roundTree, mat: 'sway' }, tall: { geo: K.tallTree, mat: 'sway' },
  tuft: { geo: K.tuft, mat: 'swayS', cast: false }, flowers: { geo: K.flowers, mat: 'swayS', cast: false },
  field: { geo: () => K.field(), mat: 'swayS' }, vine: { geo: K2.vineyard, mat: 'lit' }, orchard: { geo: K.orchard, mat: 'sway' },
  rock0: { geo: () => K.rockPile(0), mat: 'lit' }, rock1: { geo: () => K.rockPile(1), mat: 'lit' },
  mountain0: { geo: () => K2.mountain(0), mat: 'lit' }, mountain1: { geo: () => K2.mountain(1), mat: 'lit' },
  hay: { geo: K2.hay, mat: 'lit' }, sheep: { geo: K2.sheep, mat: 'lit' }, campfire: { geo: K2.campfire, mat: 'lit', cast: false }, logs: { geo: K2.logs, mat: 'lit' },
  shrine: { geo: K2.shrine, mat: 'lit' }, mill: { geo: K2.windmillBody, mat: 'lit' }, well: { geo: K.well, mat: 'lit' }, lamp: { geo: K2.lampPost, mat: 'lit' },
  lampGlass: { geo: K2.lampGlass, mat: 'glass', cast: false, receive: false },
  chapel: { geo: K.chapel, mat: 'lit' }, plazaTree: { geo: K.plaza, mat: 'sway' }, cathedral: { geo: K2.cathedral, mat: 'lit' }, cobble: { geo: K2.cobble, mat: 'lit', cast: false },
  wall: { geo: K2.wallSeg, mat: 'lit' }, tower: { geo: K2.wallTower, mat: 'lit' }, gate: { geo: K2.gate, mat: 'lit' }, bridge: { geo: K2.bridge, mat: 'lit' },
  stallA: { geo: K2.stallA, mat: 'lit' }, stallB: { geo: K2.stallB, mat: 'lit' }, stallC: { geo: K2.stallC, mat: 'lit' }, barrels: { geo: K2.barrels, mat: 'lit' },
  dock: { geo: K.dock, mat: 'lit' }, lighthouse: { geo: K.lighthouse, mat: 'lit' },
  win: { geo: K.windowPane, mat: 'win', cast: false, receive: false },
};

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache: Record<string, THREE.Material> = {};
function material(kind: KitDef['mat'], winMat: THREE.MeshBasicMaterial, glassMat: THREE.MeshBasicMaterial): THREE.Material {
  switch (kind) {
    case 'win': return winMat;
    case 'glass': return glassMat;
    case 'sway': return (matCache.sway ??= swayMat(0.05));
    case 'swayS': return (matCache.swayS ??= swayMat(0.07));
    default: return (matCache.lit ??= litMat());
  }
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lc = (a: THREE.Color, b: THREE.Color, t: number): void => { a.lerp(b, t); };

export class Province {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly host: HTMLElement;
  model!: Model;
  week: Week = 4;
  hourName: Hour = 'dia';
  time = 0;
  fixedT: number | null = null;
  frozen = false;

  private sun = new THREE.DirectionalLight(0xffffff, 3);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  private lamps: THREE.PointLight[] = [];
  private content = new THREE.Group();
  private paper!: THREE.Mesh;
  private pools = new Map<string, Pool>();
  private regionMeshes = new Map<string, { mesh: THREE.Mesh; t0: number }>();
  private prevIds = new Set<string>();
  private prevFounded = new Set<string>();
  private hour: HourDef = { ...HOURS.dia, sunPos: [...HOURS.dia.sunPos] as [number, number, number] };
  private cur = {
    sunCol: new THREE.Color(), sunPos: new THREE.Vector3(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(),
    sunI: 3, hemiI: 1, exp: 1, night: 0, env: 0.5, bg: [new THREE.Color(), new THREE.Color(), new THREE.Color()],
  };
  private winMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  private glassMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  private glow!: THREE.Points;
  private glowMat!: THREE.PointsMaterial;
  private beam: THREE.Mesh | null = null;
  private beamMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  // dinâmicos
  private boatMesh: THREE.InstancedMesh | null = null;
  private cartMesh: THREE.InstancedMesh | null = null;
  private bladeMesh: THREE.InstancedMesh | null = null;
  private smokeMesh: THREE.InstancedMesh | null = null;
  private birdBody!: THREE.InstancedMesh;
  private birdL!: THREE.InstancedMesh;
  private birdR!: THREE.InstancedMesh;
  private birds: Array<{ cx: number; cz: number; r: number; h: number; sp: number; ph: number; ell: number }> = [];
  private smokeSrc: Array<{ x: number; y: number; z: number; k: number }> = [];
  private smokeMat = new THREE.MeshStandardMaterial({ color: 0xf0ebe0, roughness: 1, transparent: true, opacity: 0.38, depthWrite: false });
  private ray = new THREE.Raycaster();
  private D0 = 50;
  private lastInteract = 0;
  autoDrift = true;
  yawParam = false;
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpS = new THREE.Vector3();
  private tmpP = new THREE.Vector3();
  private tmpE = new THREE.Euler();
  private onResize: () => void;

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    host.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 400);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.minPolarAngle = 0.12; this.controls.maxPolarAngle = 1.42;
    this.controls.screenSpacePanning = false;
    this.controls.addEventListener('start', () => { this.lastInteract = performance.now(); this.autoDrift = false; });
    this.controls.addEventListener('change', () => this.clampTarget());

    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();

    this.scene.add(this.hemi, this.sun, this.sun.target, this.content);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const ext = Math.max(SHEET.w, SHEET.d) * 0.56 + 4;
    const sc = this.sun.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 140;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.05; this.sun.shadow.radius = 2.5;
    this.sun.target.position.set(SHEET.cx, 0, SHEET.cz);

    for (const [x, z] of [[0, 0], [8.2, -0.2], [5.5, 8.5]] as Array<[number, number]>) {
      const l = new THREE.PointLight(0xffb458, 0, 9, 1.6);
      l.position.set(x, 1.6, z);
      this.lamps.push(l); this.scene.add(l);
    }
    this.buildTable();
    this.buildBirds();
    this.glowMat = new THREE.PointsMaterial({ size: 0.9, map: glowTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc070, sizeAttenuation: true });
    this.glow = new THREE.Points(new THREE.BufferGeometry(), this.glowMat);
    this.glow.frustumCulled = false;
    this.scene.add(this.glow);
    this.beam = new THREE.Mesh(K2.beam(), this.beamMat);
    this.beam.visible = false; this.beam.frustumCulled = false;
    this.scene.add(this.beam);

    this.onResize = (): void => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
    this.snapHour('dia');
  }

  // ---------- mesa, moldura e chão ----------
  private buildTable(): void {
    const w = SHEET.w, d = SHEET.d;
    const mk = (hw: number, hd: number, r: number): THREE.Shape => {
      const s = new THREE.Shape();
      s.moveTo(-hw + r, -hd); s.lineTo(hw - r, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd + r); s.lineTo(hw, hd - r); s.quadraticCurveTo(hw, hd, hw - r, hd);
      s.lineTo(-hw + r, hd); s.quadraticCurveTo(-hw, hd, -hw, hd - r); s.lineTo(-hw, -hd + r); s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
      return s;
    };
    const wood = woodTexture();
    const walnutMat = new THREE.MeshStandardMaterial({ map: wood, color: 0xffffff, roughness: 0.62, metalness: 0.0 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xd9ab52, roughness: 0.3, metalness: 0.92 });
    const grp = new THREE.Group();
    grp.position.set(SHEET.cx, 0, SHEET.cz);
    // tampo
    const bw = w / 2 + 2.4, bd = d / 2 + 2.4, th = 1.5;
    const board = new THREE.ExtrudeGeometry(mk(bw, bd, 1.6), { depth: th, bevelEnabled: true, bevelSize: 0.22, bevelThickness: 0.22, bevelSegments: 3, curveSegments: 12 });
    board.rotateX(-PI / 2); board.translate(0, -th - 0.26, 0);
    const wmap = wood; wmap.repeat.set(1 / 40, 1 / 26);
    const boardM = new THREE.Mesh(board, walnutMat); boardM.receiveShadow = true; boardM.castShadow = true; grp.add(boardM);
    // filete de latão em volta do papel e na borda do tampo
    const ring = (hw: number, hd: number, r: number, wdt: number, h: number, y: number): THREE.Mesh => {
      const s = mk(hw + wdt, hd + wdt, r + wdt); s.holes.push(new THREE.Path(mk(hw, hd, r).getPoints(12)));
      const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 12 });
      g.rotateX(-PI / 2); g.translate(0, y, 0);
      const m = new THREE.Mesh(g, brass); m.castShadow = true; m.receiveShadow = true; return m;
    };
    grp.add(ring(w / 2 + 0.02, d / 2 + 0.02, 0.1, 0.2, 0.09, -0.05));
    grp.add(ring(bw - 0.6, bd - 0.6, 1.0, 0.07, 0.06, -0.06));
    // parafusos e pés
    const studs: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const s = new THREE.SphereGeometry(0.2, 12, 8); s.scale(1, 0.55, 1); s.translate(sx * (bw - 0.9), -0.05, sz * (bd - 0.9)); studs.push(s);
      const f = new THREE.CylinderGeometry(0.7, 0.9, 0.55, 20); f.translate(sx * (bw - 1.6), -th - 0.3, sz * (bd - 1.6)); studs.push(f);
    }
    const studM = new THREE.Mesh(mergeGeometries(studs)!, brass); studM.castShadow = true; grp.add(studM);
    this.scene.add(grp);
    // papel
    const pg = new THREE.PlaneGeometry(w, d); pg.rotateX(-PI / 2);
    this.paper = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0, color: 0xffeccd }));
    this.paper.position.set(SHEET.cx, 0, SHEET.cz); this.paper.receiveShadow = true;
    this.scene.add(this.paper);
    // chão da vitrine: pega a sombra do tampo e um halo de luz
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160).rotateX(-PI / 2), new THREE.ShadowMaterial({ opacity: 0.5 }));
    floor.position.set(SHEET.cx, -th - 0.62, SHEET.cz); floor.receiveShadow = true; this.scene.add(floor);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(130, 130).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, depthWrite: false, opacity: 0.9 }));
    halo.position.set(SHEET.cx, -th - 0.6, SHEET.cz); this.scene.add(halo);
  }

  // ---------- passarinhos ----------
  private buildBirds(): void {
    const n = 9, lit = litMat({ side: THREE.DoubleSide });
    this.birdBody = new THREE.InstancedMesh(K2.birdBody(), lit, n);
    this.birdL = new THREE.InstancedMesh(K2.birdWing(-1), lit, n);
    this.birdR = new THREE.InstancedMesh(K2.birdWing(1), lit, n);
    for (const m of [this.birdBody, this.birdL, this.birdR]) { m.frustumCulled = false; m.castShadow = false; this.scene.add(m); }
    const centers: Array<[number, number]> = [[0, 0], [7, -1], [4, 7], [-3, 6], [-7, 1], [3, -7], [10, -6], [-2, -2], [8, 4]];
    for (let i = 0; i < n; i++) this.birds.push({ cx: centers[i][0], cz: centers[i][1], r: 3 + (i % 4) * 1.6, h: 3.2 + (i % 3) * 0.9, sp: (0.28 + (i % 3) * 0.07) * (i % 2 ? 1 : -1), ph: i * 1.3, ell: 0.7 + (i % 3) * 0.12 });
  }

  // ---------- semana ----------
  setWeek(w: Week, instant = false): void {
    this.week = w;
    this.build(instant);
  }

  private build(instant: boolean): void {
    const model = buildModel(this.week);
    this.model = model;
    this.disposeContent();
    const now = this.time;
    // pergaminho
    const tex = drawParchment({ week: this.week, founded: model.founded, rivers: model.rivers, roads: model.roads });
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const pm = this.paper.material as THREE.MeshStandardMaterial;
    pm.map?.dispose(); pm.map = tex; pm.needsUpdate = true;

    // chão por região
    const newRegions = new Set<string>();
    for (const id of model.founded) if (!this.prevFounded.has(id)) newRegions.add(id);
    const lit = (matCache.lit ??= litMat());
    for (const id of model.founded) {
      const g = regionGeometry(model, id);
      const mesh = new THREE.Mesh(g, id === 'C' ? litMat() : (matCache.lit as THREE.Material));
      mesh.castShadow = true; mesh.receiveShadow = true;
      const isNew = newRegions.has(id);
      const delay = id === 'C' ? 0.1 : 0.3 + dist(REGION_BY_ID.get(id)!, 0, 0) * 0.04;
      if (isNew && !instant) mesh.scale.y = 0.001;
      this.content.add(mesh);
      this.regionMeshes.set(id, { mesh, t0: isNew && !instant ? now + delay : -10 });
    }
    void lit;

    // rio e estradas
    const water = riverMat(); water.side = THREE.DoubleSide;
    const runs = model.rivers.flatMap((r) => r.runs);
    const widen = (t: number): number => 0.5 * (1 + 0.9 * smooth(0.8, 1, t));
    const rg = ribbon(runs, { y: H0 + 0.02, width: widen, center: 0x2f8fb0, edge: 0x6fcfd0, uvw: true });
    const bank = ribbon(runs, { y: H0 + 0.008, width: (t) => widen(t) + 0.26, center: 0x8a6f48, edge: 0x7c6540, jitter: 0.08 });
    const mkRibbon = (g: THREE.BufferGeometry | null, m: THREE.Material, order: number): void => {
      if (!g) return;
      const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.renderOrder = order; this.content.add(mesh);
    };
    const bankMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    water.polygonOffset = true; water.polygonOffsetFactor = -2; water.polygonOffsetUnits = -2;
    mkRibbon(bank, bankMat, 1); mkRibbon(rg, water, 2);
    // estradas: cortadas onde há ponte
    const bridges = model.bridges;
    const roadRuns: Array<Array<[number, number]>> = [];
    for (const rd of model.roads) {
      if (!rd.open) continue;
      for (const run of rd.runs) {
        let cur: Array<[number, number]> = [];
        for (const p of run) {
          if (bridges.some((b) => Math.hypot(b.x - p[0], b.z - p[1]) < 0.62)) { if (cur.length > 1) roadRuns.push(cur); cur = []; } else cur.push(p);
        }
        if (cur.length > 1) roadRuns.push(cur);
      }
    }
    const roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const rEdge = ribbon(roadRuns, { y: H0 + 0.012, width: () => 0.4, center: 0xa38558, edge: 0x8d7347, jitter: 0.08 });
    const rBody = ribbon(roadRuns, { y: H0 + 0.02, width: () => 0.3, center: 0xdcc08a, edge: 0xcfb078, jitter: 0.1 });
    mkRibbon(rEdge, bankMat, 3); mkRibbon(rBody, roadMat, 4);

    // decoração em pools
    const counts = new Map<string, number>();
    const all: Deco[] = [...model.decos, ...model.windows];
    for (const d of model.decos) if (d.kit === 'lamp') all.push({ ...d, kit: 'lampGlass', y: d.y + 0.0 });
    for (const d of all) counts.set(d.kit, (counts.get(d.kit) ?? 0) + 1);
    this.pools.clear();
    const ids = new Set<string>();
    const rr = mulberry(9);
    for (const [kit, n] of counts) {
      const def = KITS[kit];
      if (!def) continue;
      let geo = geoCache.get(kit);
      if (!geo) { geo = def.geo(); geoCache.set(kit, geo); }
      const pool = new Pool(geo, material(def.mat, this.winMat, this.glassMat), n + 2, { cast: def.cast ?? true, receive: def.receive ?? true, name: kit });
      this.pools.set(kit, pool); this.content.add(pool.mesh);
    }
    for (const d of all) {
      const pool = this.pools.get(d.kit);
      if (!pool) continue;
      const id = d.id; ids.add(id + ':' + d.kit);
      const isNewId = !this.prevIds.has(id + ':' + d.kit);
      const dc = Math.hypot(d.x, d.z);
      const t0 = instant || !isNewId ? -10 : now + 0.9 + dc * 0.045 + rr() * 0.35;
      const it = pool.make(0, d.kit, d.x, d.y, d.z, d.yaw, d.s, t0, d.kit === 'field' || d.kit === 'vine' || d.kit === 'cobble' ? 'grow' : 'pop');
      if (d.sx) it.sx = d.sx; if (d.sy) it.sy = d.sy; if (d.sz) it.sz = d.sz;
    }
    this.prevIds = ids;
    this.prevFounded = new Set(model.founded);
    this.buildLife(model);
    this.buildGlow(model);
    this.applyWindows();
  }

  private disposeContent(): void {
    for (const ch of [...this.content.children]) {
      this.content.remove(ch);
      const m = ch as THREE.Mesh;
      if (m.geometry && !(ch as THREE.InstancedMesh).isInstancedMesh) m.geometry.dispose();
      if ((ch as THREE.InstancedMesh).isInstancedMesh) (ch as THREE.InstancedMesh).dispose();
    }
    this.regionMeshes.clear();
    for (const m of [this.boatMesh, this.cartMesh, this.bladeMesh, this.smokeMesh]) { if (m) { this.scene.remove(m); m.dispose(); } }
    this.boatMesh = this.cartMesh = this.bladeMesh = this.smokeMesh = null;
  }

  // ---------- vida: barcos, carroças, pás, fumaça ----------
  private buildLife(model: Model): void {
    const lit = (matCache.lit ??= litMat());
    const boatN = model.boats.length ? (this.week >= 4 ? 4 : 2) : 0;
    if (boatN) { const g = geoCache.get('boat') ?? K.boat(); geoCache.set('boat', g); this.boatMesh = new THREE.InstancedMesh(g, lit, boatN); this.boatMesh.castShadow = true; this.boatMesh.frustumCulled = false; this.scene.add(this.boatMesh); }
    if (model.carts.length) { const g = geoCache.get('cart') ?? K2.cart(); geoCache.set('cart', g); this.cartMesh = new THREE.InstancedMesh(g, lit, model.carts.length); this.cartMesh.castShadow = true; this.cartMesh.frustumCulled = false; this.scene.add(this.cartMesh); }
    if (model.mills.length) { const g = geoCache.get('blades') ?? K2.windmillBlades(); geoCache.set('blades', g); this.bladeMesh = new THREE.InstancedMesh(g, lit, model.mills.length); this.bladeMesh.castShadow = true; this.bladeMesh.frustumCulled = false; this.scene.add(this.bladeMesh); }
    this.smokeSrc = [];
    for (const s of model.smoke) for (let k = 0; k < 3; k++) this.smokeSrc.push({ x: s.x, y: s.y, z: s.z, k });
    for (const f of model.fires) for (let k = 0; k < 3; k++) this.smokeSrc.push({ x: f.x, y: f.y, z: f.z, k });
    if (this.smokeSrc.length) {
      const g = geoCache.get('puff') ?? K.puff(); geoCache.set('puff', g);
      this.smokeMesh = new THREE.InstancedMesh(g, this.smokeMat, this.smokeSrc.length);
      this.smokeMesh.frustumCulled = false; this.smokeMesh.castShadow = false; this.smokeMesh.receiveShadow = false; this.scene.add(this.smokeMesh);
    }
  }

  private buildGlow(model: Model): void {
    const pts: number[] = [];
    const seen: Array<[number, number]> = [];
    const add = (x: number, y: number, z: number): void => { for (const s of seen) if (Math.hypot(s[0] - x, s[1] - z) < 0.15) return; seen.push([x, z]); pts.push(x, y, z); };
    for (const l of model.lamps) add(l.x, l.y, l.z);
    for (const d of model.decos) if (d.kit === 'lamp') add(d.x, d.y + 0.9 * d.s, d.z);
    for (const f of model.fires) add(f.x, f.y + 0.1, f.z);
    for (const b of model.beacons) add(b.x, b.y, b.z);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.glow.geometry.dispose(); this.glow.geometry = g;
    const lh = model.decos.find((d) => d.kit === 'lighthouse');
    if (lh && this.beam) { this.beam.visible = true; this.beam.position.set(lh.x - 0.1 * lh.s, lh.y + 1.8 * lh.s, lh.z - 0.12 * lh.s); } else if (this.beam) this.beam.visible = false;
    // luzes de ponto: capital, aldeia do Vale, porto
    const lp: Array<[number, number]> = [[0, 0], [8.7, -0.7], [4.4, 7.5]];
    lp.forEach(([x, z], i) => { this.lamps[i].position.set(x, H0 + 1.4, z); });
  }

  // ---------- hora ----------
  setHour(h: Hour, instant = false): void {
    this.hourName = h;
    this.hour = { ...HOURS[h], sunPos: [...HOURS[h].sunPos] as [number, number, number] };
    if (instant) this.snapHour(h);
  }
  private snapHour(h: Hour): void {
    this.hourName = h;
    const t = HOURS[h], c = this.cur;
    c.sunCol.setHex(t.sunCol); c.sunPos.set(...t.sunPos); c.hemiSky.setHex(t.hemiSky); c.hemiGround.setHex(t.hemiGround);
    c.sunI = t.sunI; c.hemiI = t.hemiI; c.exp = t.exp; c.night = t.night; c.env = t.env;
    c.bg.forEach((b, i) => b.set(t.bg[i]));
    this.hour = { ...t, sunPos: [...t.sunPos] as [number, number, number] };
    this.applyHour();
  }
  private stepHour(dt: number): void {
    const t = this.hour, c = this.cur, k = 1 - Math.exp(-dt * 3.2);
    c.sunCol.lerp(new THREE.Color(t.sunCol), k); c.sunPos.lerp(new THREE.Vector3(...t.sunPos), k);
    c.hemiSky.lerp(new THREE.Color(t.hemiSky), k); c.hemiGround.lerp(new THREE.Color(t.hemiGround), k);
    c.sunI = lerp(c.sunI, t.sunI, k); c.hemiI = lerp(c.hemiI, t.hemiI, k); c.exp = lerp(c.exp, t.exp, k); c.night = lerp(c.night, t.night, k); c.env = lerp(c.env, t.env, k);
    c.bg.forEach((b, i) => lc(b, new THREE.Color(t.bg[i]), k));
    this.applyHour();
  }
  private applyHour(): void {
    const c = this.cur;
    this.sun.color.copy(c.sunCol); this.sun.intensity = c.sunI;
    this.sun.position.copy(this.sun.target.position).add(c.sunPos.clone().multiplyScalar(1.3));
    this.hemi.color.copy(c.hemiSky); this.hemi.groundColor.copy(c.hemiGround); this.hemi.intensity = c.hemiI;
    this.renderer.toneMappingExposure = c.exp;
    this.scene.environmentIntensity = c.env;
    this.host.style.background = `radial-gradient(ellipse at 50% 34%, ${css(c.bg[0])} 0%, ${css(c.bg[1])} 52%, ${css(c.bg[2])} 100%)`;
    this.applyWindows();
    this.glowMat.opacity = Math.min(1, c.night * 1.15);
    this.beamMat.opacity = c.night * 0.07;
    this.lamps.forEach((l) => { l.intensity = c.night * 16; });
    this.smokeMat.color.setRGB(lerp(0.94, 0.55, c.night), lerp(0.92, 0.57, c.night), lerp(0.88, 0.68, c.night));
  }
  private applyWindows(): void {
    const n = this.cur.night;
    // de dia o vidro é azul-escuro; à noite, âmbar acima de 1 (o ACES segura e brilha)
    const day = new THREE.Color(0x53697a), dusk = new THREE.Color(1.5, 0.95, 0.42), night = new THREE.Color(2.2, 1.4, 0.55);
    const c = day.clone().lerp(dusk, Math.min(1, n * 1.4)).lerp(night, Math.max(0, n - 0.5) * 2);
    this.winMat.color.copy(c);
    this.glassMat.color.copy(new THREE.Color(0xffe9b0).multiplyScalar(0.6 + n * 2.0));
  }

  // ---------- câmera ----------
  setCamera(o: { yaw?: number; pitch?: number; zoom?: number; target?: [number, number] }): void {
    const aspect = this.camera.aspect;
    const vf = (this.camera.fov * PI) / 180;
    const el = ((o.pitch ?? 46) * PI) / 180;
    const halfW = SHEET.w / 2 + 2.6, halfD = SHEET.d / 2 + 2.6;
    const dW = (halfW * 1.04) / (Math.tan(vf / 2) * aspect);
    const dD = (halfD * Math.sin(el) + 2.2) / Math.tan(vf / 2);
    this.D0 = Math.max(dW, dD);
    const dist = this.D0 / (o.zoom ?? 1);
    const yaw = ((o.yaw ?? 0) * PI) / 180;
    const [tx, tz] = o.target ?? [SHEET.cx, SHEET.cz];
    const target = new THREE.Vector3(tx, 0.3, tz);
    this.controls.target.copy(target);
    this.camera.position.set(tx + Math.sin(yaw) * Math.cos(el) * dist, 0.3 + Math.sin(el) * dist, tz + Math.cos(yaw) * Math.cos(el) * dist);
    this.controls.minDistance = 4.5; this.controls.maxDistance = this.D0 * 1.25;
    this.controls.update();
  }
  private clampTarget(): void {
    const t = this.controls.target;
    t.x = Math.max(SHEET.cx - SHEET.w / 2, Math.min(SHEET.cx + SHEET.w / 2, t.x));
    t.z = Math.max(SHEET.cz - SHEET.d / 2, Math.min(SHEET.cz + SHEET.d / 2, t.z));
    t.y = Math.max(0, Math.min(2, t.y));
  }
  cameraDistance(): number { return this.camera.position.distanceTo(this.controls.target); }

  resize(): void {
    const w = this.host.clientWidth || window.innerWidth, h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // empurra a imagem um pouco para cima, para o painel de controles não cobrir o diorama
    this.camera.setViewOffset(w, h, 0, Math.round(h * 0.055), w, h);
    this.camera.updateProjectionMatrix();
  }

  // ---------- escolha de região (passar o cursor) ----------
  pick(clientX: number, clientY: number): Region | undefined {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -H0 * 0.6);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(plane, hit)) return undefined;
    // tenta acertar o chão elevado primeiro: se o ponto cai numa região fundada, ótimo; senão cai no pergaminho
    const g = regionAt(hit.x, hit.z);
    if (g) return g;
    const p2 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (!this.ray.ray.intersectPlane(p2, hit)) return undefined;
    return regionAt(hit.x, hit.z);
  }
  project(x: number, y: number, z: number): { x: number; y: number; behind: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * r.width + r.left, y: ((1 - v.y) / 2) * r.height + r.top, behind: v.z > 1 };
  }

  // ---------- quadro ----------
  frame(realDt: number): void {
    if (this.fixedT !== null) { this.time = this.fixedT; } else if (!this.frozen) { this.time += realDt; }
    U.time.value = this.time;
    this.stepHour(this.fixedT !== null ? 5 : realDt);
    // deriva lenta da câmera quando ninguém mexe
    if (this.autoDrift && !this.yawParam && this.fixedT === null) {
      const idle = performance.now() - this.lastInteract;
      if (idle > 6000) {
        const off = this.camera.position.clone().sub(this.controls.target);
        const a = 0.035 * realDt;
        const x = off.x * Math.cos(a) - off.z * Math.sin(a), z = off.x * Math.sin(a) + off.z * Math.cos(a);
        this.camera.position.set(this.controls.target.x + x, this.camera.position.y, this.controls.target.z + z);
      }
    }
    this.controls.update();
    // rampa dos chãos novos
    for (const { mesh, t0 } of this.regionMeshes.values()) {
      if (t0 < 0) continue;
      const k = Math.max(0, Math.min(1, (this.time - t0) / 0.9));
      mesh.scale.y = Math.max(0.001, 1 - Math.pow(1 - k, 3) * 1 + (k < 1 ? 0 : 0));
      if (k >= 1) mesh.scale.y = 1;
    }
    for (const p of this.pools.values()) p.refresh(this.time);
    this.animate(this.time);
    this.renderer.render(this.scene, this.camera);
  }

  private animate(T: number): void {
    const M = this.tmpM, Q = this.tmpQ, S = this.tmpS, P = this.tmpP;
    const yawQ = (yaw: number): THREE.Quaternion => Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const model = this.model;
    if (this.boatMesh) {
      const rt = model.boats[0];
      const n = this.boatMesh.count;
      for (let i = 0; i < n; i++) {
        const v = 0.42, per = rt.len * 2;
        let d = ((T * v + (i * per) / n + 1.5) % per + per) % per;
        const back = d > rt.len; if (back) d = per - d;
        const s = sampleRoute(rt, d);
        const dir = back ? -1 : 1;
        const yaw = Math.atan2(-s.dz * dir, s.dx * dir);
        P.set(s.x, H0 + 0.045 + Math.sin(T * 1.3 + i) * 0.008, s.z);
        S.setScalar(0.72);
        M.compose(P, yawQ(yaw), S);
        this.boatMesh.setMatrixAt(i, M);
      }
      this.boatMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.cartMesh) {
      model.carts.forEach((c, i) => {
        const rt = c.route, per = rt.len * 2, v = 0.5;
        const off = (i >> 1) * 1.7 + (c.dir < 0 ? rt.len : 0);
        let d = ((T * v + off) % per + per) % per;
        const back = d > rt.len; if (back) d = per - d;
        const s = sampleRoute(rt, d);
        const dir = back ? -1 : 1;
        const yaw = Math.atan2(-s.dz * dir, s.dx * dir);
        P.set(s.x - s.dz * dir * 0.0, H0 + 0.03 + Math.abs(Math.sin(T * 5 + i)) * 0.004, s.z);
        S.setScalar(0.85);
        M.compose(P, yawQ(yaw), S);
        this.cartMesh!.setMatrixAt(i, M);
      });
      this.cartMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.bladeMesh) {
      model.mills.forEach((m, i) => {
        const s = 1.35;
        const base = new THREE.Matrix4().compose(new THREE.Vector3(m.x, m.y, m.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), m.yaw), new THREE.Vector3(s, s, s));
        const hub = new THREE.Matrix4().makeTranslation(0, 0.93, 0.28);
        const rot = new THREE.Matrix4().makeRotationZ(T * 0.6 * U.motion.value);
        this.bladeMesh!.setMatrixAt(i, base.multiply(hub).multiply(rot));
      });
      this.bladeMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.smokeMesh) {
      this.smokeSrc.forEach((s, i) => {
        const life = ((T * 0.32 + s.k / 3 + (s.x * 3.1 + s.z * 1.7) % 1 + 2) % 1);
        const rise = life * 0.85;
        const sz = (0.028 + life * 0.05) * (1 - smooth(0.7, 1, life));
        P.set(s.x + Math.sin(life * 5 + s.x) * 0.04 + life * 0.22, s.y + rise, s.z + Math.cos(life * 4 + s.z) * 0.03);
        S.setScalar(Math.max(0.0001, sz));
        M.compose(P, Q.identity(), S);
        this.smokeMesh!.setMatrixAt(i, M);
      });
      this.smokeMesh.instanceMatrix.needsUpdate = true;
    }
    // pássaros
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i], a = T * b.sp + b.ph;
      const x = b.cx + Math.cos(a) * b.r, z = b.cz + Math.sin(a) * b.r * b.ell, y = H0 + b.h + Math.sin(T * 0.7 + i) * 0.25;
      const dx = -Math.sin(a) * b.sp, dz = Math.cos(a) * b.sp * b.ell;
      const yaw = Math.atan2(dx, dz);
      P.set(x, y, z); S.setScalar(0.9);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      M.compose(P, q, S); this.birdBody.setMatrixAt(i, M);
      const flap = Math.sin(T * 8 + i * 2) * 0.7;
      for (const [mesh, sgn] of [[this.birdL, -1], [this.birdR, 1]] as Array<[THREE.InstancedMesh, number]>) {
        const wq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), flap * sgn));
        M.compose(P, wq, S); mesh.setMatrixAt(i, M);
      }
    }
    this.birdBody.instanceMatrix.needsUpdate = true; this.birdL.instanceMatrix.needsUpdate = true; this.birdR.instanceMatrix.needsUpdate = true;
    if (this.beam && this.beam.visible) { this.beam.rotation.y = T * 0.9; this.beam.scale.set(0.8, 0.8, 1.6); }
    void this.tmpE;
  }

  // ---------- medidas ----------
  stats(): { calls: number; triangles: number; geometries: number; week: Week; hour: Hour; houses: number } {
    const i = this.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, week: this.week, hour: this.hourName, houses: this.model.stats.houses };
  }
  /** Medida da cena sem o passe de sombra (só o que a tela vê). */
  statsMain(): { calls: number; triangles: number } {
    const was = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.enabled = false;
    this.renderer.render(this.scene, this.camera);
    const i = this.renderer.info.render;
    const r = { calls: i.calls, triangles: i.triangles };
    this.renderer.shadowMap.enabled = was;
    return r;
  }

  founded(): Region[] { return REGIONS.filter((g) => this.model.founded.has(g.id)); }
  cellOf(x: number, z: number): string { const [q, r] = worldToCell(x, z); return CELL_REGION.get(ckey(q, r))?.id ?? ''; }
}

// ---------- utilitários ----------
function dist(r: Region, x: number, z: number): number { return Math.hypot(r.x - x, r.z - z); }
function smooth(a: number, b: number, x: number): number { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function css(c: THREE.Color): string { return '#' + c.getHexString(); }
function mulberry(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.18, 'rgba(255,200,110,0.75)'); g.addColorStop(0.5, 'rgba(255,150,60,0.18)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function haloTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,214,150,0.22)'); g.addColorStop(0.55, 'rgba(170,110,60,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function woodTexture(): THREE.CanvasTexture {
  const w = 1024, h = 512;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.fillStyle = '#3d281b'; x.fillRect(0, 0, w, h);
  const r = mulberry(5);
  for (let i = 0; i < 380; i++) {
    const y = r() * h, th = 1 + r() * 4, a = r();
    x.strokeStyle = a < 0.5 ? `rgba(24,12,6,${0.08 + r() * 0.18})` : `rgba(128,84,46,${0.05 + r() * 0.1})`;
    x.lineWidth = th; x.beginPath(); x.moveTo(0, y);
    for (let k = 1; k <= 8; k++) x.lineTo((w * k) / 8, y + Math.sin(k * 0.9 + i) * 6 + (r() - 0.5) * 3);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
void Geo;
