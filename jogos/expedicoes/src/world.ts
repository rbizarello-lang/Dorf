// O mundo: renderizador, luz por hora e por vista, palcos construídos sob demanda e a troca de vista.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HOUR_LOOKS, MOODS, type ViewId, type HourLook } from './looks';
import { Stage, U_GLOW, type Env } from './stage';
import { buildBrejo } from './v_brejo';
import { buildSerra } from './v_serra';
import { buildCosta } from './v_costa';
import { buildCapital } from './v_capital';
import { buildMap } from './v_mapa';
import { buildChegada } from './v_chegada';
import type { RigCfg } from './rig';

export const RIGS: Record<ViewId, RigCfg> = {
  mapa: { target: [0, 0, 0.6], dist: 24, pitch: 0.92, yaw: 0, min: 9, max: 30, sway: 0.28, pitchMin: 0.45, pitchMax: 1.4 },
  brejo: { target: [0, 0.2, 0], dist: 24, pitch: 0.5, yaw: 0.55, min: 8, max: 30 },
  serra: { target: [0.4, 0.8, 0], dist: 26, pitch: 0.46, yaw: 0.35, min: 8, max: 32 },
  costa: { target: [0.8, 0.5, 0.2], dist: 25, pitch: 0.5, yaw: 0.2, min: 8, max: 32 },
  capital: { target: [0.2, 0.4, 0.2], dist: 28, pitch: 0.62, yaw: 0.45, min: 9, max: 36 },
  chegada: { target: [0.5, 0, 0.2], dist: 22, pitch: 1.02, yaw: 0, min: 9, max: 32, sway: 0.22, pitchMin: 0.45, pitchMax: 1.4 },
};

const C = (c: THREE.Color): THREE.Color => c.clone();
interface Look { sunCol: THREE.Color; sunI: number; dir: THREE.Vector3; sky: THREE.Color; ground: THREE.Color; hemiI: number; env: number; exposure: number; night: number; dusk: number; glow: THREE.Color; bgIn: THREE.Color; bgOut: THREE.Color }
function lookFor(h: HourLook, v: ViewId): Look {
  const m = MOODS[v];
  const bgIn = m.bgIn.clone().multiplyScalar(h.bgMul).lerp(h.bgShift, h.bgMix * 0.8);
  const bgOut = m.bgOut.clone().multiplyScalar(0.6 + 0.4 * h.bgMul).lerp(h.bgShift.clone().multiplyScalar(0.12), h.bgMix * 0.6);
  return { sunCol: C(h.lightCol).multiply(m.sun), sunI: h.lightI, dir: h.lightDir.clone(), sky: C(h.hemiSky).multiply(m.sky), ground: C(h.hemiGround), hemiI: h.hemiI, env: h.envI, exposure: h.exposure * m.exposure, night: h.night, dusk: h.dusk, glow: C(h.glowCol), bgIn, bgOut };
}
function lerpLook(o: Look, a: Look, b: Look, t: number): void {
  o.sunCol.lerpColors(a.sunCol, b.sunCol, t); o.sky.lerpColors(a.sky, b.sky, t); o.ground.lerpColors(a.ground, b.ground, t);
  o.glow.lerpColors(a.glow, b.glow, t); o.bgIn.lerpColors(a.bgIn, b.bgIn, t); o.bgOut.lerpColors(a.bgOut, b.bgOut, t);
  o.dir.lerpVectors(a.dir, b.dir, t).normalize();
  for (const k of ['sunI', 'hemiI', 'env', 'exposure', 'night', 'dusk'] as const) o[k] = a[k] + (b[k] - a[k]) * t;
}
const copyLook = (a: Look): Look => ({ ...a, sunCol: a.sunCol.clone(), dir: a.dir.clone(), sky: a.sky.clone(), ground: a.ground.clone(), glow: a.glow.clone(), bgIn: a.bgIn.clone(), bgOut: a.bgOut.clone() });

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.5, 160);
  stats = { calls: 0, triangles: 0 };
  timeScale = 1;
  t = 0;
  view: ViewId = 'mapa'; hour = 0; week = 4;
  private stages = new Map<ViewId, Stage>();
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private from!: Look; private to!: Look; private cur!: Look; private p = 1;
  private env: Env;
  onBackdrop: (a: string, b: string) => void = () => {};
  private yShift = 0;

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
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 0.6);
    this.scene.add(this.hemi);
    this.env = { t: 0, dt: 0, night: 0, dusk: 0, wind: 0.6, cam: this.camera };
    this.cur = lookFor(HOUR_LOOKS[0], 'mapa');
  }

  stage(id: ViewId): Stage {
    let s = this.stages.get(id);
    if (s) return s;
    s = new Stage(id);
    s.at(0, 0, 0, 0, 1);
    switch (id) {
      case 'brejo': buildBrejo(s, false); break;
      case 'serra': buildSerra(s, false); break;
      case 'costa': buildCosta(s, false); break;
      case 'capital': buildCapital(s, false); break;
      case 'mapa': buildMap(s, { x: 0, z: 0, s: 1, arrival: false }); break;
      case 'chegada': buildChegada(s); break;
    }
    s.at(0, 0, 0, 0, 1);
    s.setVisible(false);
    this.scene.add(s.group);
    this.stages.set(id, s);
    s.weekHook?.(this.week, true);
    return s;
  }

  setView(id: ViewId): void {
    const s = this.stage(id);
    for (const [k, st] of this.stages) st.setVisible(k === id);
    this.view = id;
    s.weekHook?.(this.week, true);
    this.retarget(true);
  }

  setHour(i: number, instant = false): void { this.hour = i; this.retarget(instant); }

  setWeek(w: number, instant = false): void {
    this.week = w;
    for (const s of this.stages.values()) s.weekHook?.(w, instant);
  }

  private retarget(instant: boolean): void {
    const L = lookFor(HOUR_LOOKS[this.hour], this.view);
    if (instant || !this.cur) { this.cur = copyLook(L); this.from = copyLook(L); this.to = copyLook(L); this.p = 1; }
    else { this.from = copyLook(this.cur); this.to = L; this.p = 0; }
    const m = MOODS[this.view];
    const sc = this.sun.shadow.camera;
    sc.left = -m.shadow; sc.right = m.shadow; sc.top = m.shadow; sc.bottom = -m.shadow; sc.near = 4; sc.far = 70;
    sc.updateProjectionMatrix();
    this.sun.target.position.copy(m.center);
    this.apply();
  }

  private apply(): void {
    const L = this.cur;
    this.sun.color.copy(L.sunCol); this.sun.intensity = L.sunI;
    this.sun.position.copy(this.sun.target.position).addScaledVector(L.dir, 30);
    this.hemi.color.copy(L.sky); this.hemi.groundColor.copy(L.ground); this.hemi.intensity = L.hemiI;
    this.scene.environmentIntensity = L.env;
    this.renderer.toneMappingExposure = L.exposure;
    U_GLOW.value.copy(L.glow);
    const css = (c: THREE.Color): string => '#' + c.getHexString(THREE.SRGBColorSpace);
    this.onBackdrop(css(L.bgIn), css(L.bgOut));
    this.env.night = L.night; this.env.dusk = L.dusk;
  }

  resize(w: number, h: number, shift: number): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.yShift = shift;
    this.camera.setViewOffset(w, h, 0, shift, w, h);
  }

  update(realDt: number): void {
    const rdt = Math.min(realDt, 0.1), dt = rdt * this.timeScale;
    this.t += dt;
    if (this.p < 1) {
      this.p = Math.min(1, this.p + rdt / 1.3);
      const e = this.p * this.p * (3 - 2 * this.p);
      lerpLook(this.cur, this.from, this.to, e);
      this.apply();
    }
    this.env.t = this.t; this.env.dt = dt;
    this.stages.get(this.view)?.update(this.env);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
    const i = this.renderer.info.render;
    this.stats.calls = i.calls; this.stats.triangles = i.triangles;
  }

  get busy(): boolean { return this.p < 1; }
  get shift(): number { return this.yShift; }
}
