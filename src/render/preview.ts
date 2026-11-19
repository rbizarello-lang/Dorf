import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';
import type { TileDef } from '../core/tiles';
import type { Theme } from '../themes/types';
import { createRenderer } from './gpu';
import { instGeometry, setInstColor, type Lib } from './lib';
import { LiveTile } from './liveTile';
import { U } from './materials';
import { TILE_T, tc, type TileBuild } from './tileBuilder';

const tmpM = new THREE.Matrix4();
const tmpBounce = new THREE.Color();

/**
 * A peça da vez sobre a pilha, no canto do HUD. Tem canvas e renderizador próprios:
 * o pipeline de pós-processamento desenha direto no canvas principal, e uma viewport
 * recortada por cima dele não funciona no WebGPU. Usa os mesmos materiais do mapa.
 */
export class PreviewView {
  readonly canvas = document.createElement('canvas');
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  private sun = new THREE.DirectionalLight();
  private hemi = new THREE.HemisphereLight();
  private pillar: THREE.InstancedMesh;
  private tile: LiveTile | null = null;
  private def: TileDef | null = null;
  private angle = 0;
  private drop = 0;
  private time = 0;
  private w = 0;
  private h = 0;
  private resizePending = true;
  private idle = 0;
  private dirty = true;
  private dpr = 0;
  readonly stats = { draws: 0, calls: 0, triangles: 0, cpu: 0 };
  observe(element: HTMLElement) {
    new ResizeObserver(([entry]) => {
      this.w = entry.contentRect.width; this.h = entry.contentRect.height;
      this.resizePending = true;
    }).observe(element);
  }

  static async create(forceWebGL: boolean, lib: Lib) {
    const canvas = document.createElement('canvas');
    const { renderer } = await createRenderer(canvas, forceWebGL);
    return new PreviewView(canvas, renderer, lib);
  }

  private constructor(
    canvas: HTMLCanvasElement,
    private renderer: THREE.WebGPURenderer,
    private lib: Lib,
  ) {
    this.canvas = canvas;
    this.canvas.className = 'preview-canvas';
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene.add(this.sun, this.hemi);
    this.sun.position.set(-2, 4, 3);
    const slab = new THREE.CylinderGeometry(1, 1, 0.07, 6).rotateY(Math.PI / 6);
    const mat = new THREE.MeshStandardNodeMaterial({ flatShading: true, roughness: 0.95 });
    mat.colorNode = attribute('iColor', 'vec3');
    this.pillar = new THREE.InstancedMesh(instGeometry(slab, 40), mat, 40);
    this.scene.add(this.pillar);
    this.cam.position.set(0, 3.2, 4.4);
    this.cam.lookAt(0, -0.55, 0);
  }

  setTheme(theme: Theme) {
    this.sun.color.set(theme.sun);
    this.sun.intensity = theme.sunIntensity;
    this.hemi.color.set(theme.hemiSky);
    this.hemi.groundColor.set(theme.hemiGround);
    this.hemi.intensity = theme.hemiIntensity;
    for (let i = 0; i < 40; i++) setInstColor(this.pillar, i, tc(theme.side).clone().lerp(tc(theme.sideDark), i % 2 ? 0.45 : 0.1));
    this.pillar.geometry.getAttribute('iColor').needsUpdate = true;
    this.tile?.dispose();
    this.tile = null;
    this.def = null;
  }

  invalidateDetail() { this.def = null; }

  /** Troca a peça mostrada (com uma pequena queda) e ajusta a altura da pilha. */
  set(def: TileDef | null, build: () => TileBuild, angle: number, stack: number) {
    if (def !== this.def) {
      this.tile?.dispose();
      this.tile = null;
      this.def = def;
      if (def) {
        this.tile = new LiveTile(def, build(), '', this.lib, false);
        this.scene.add(this.tile.group);
        this.drop = 0.6;
      }
    }
    this.dirty = true;
    this.angle = angle;
    const n = Math.min(40, Math.max(0, stack - 1));
    for (let i = 0; i < n; i++) this.pillar.setMatrixAt(i, tmpM.makeTranslation(0, -TILE_T - 0.035 - i * 0.075, 0));
    this.pillar.count = n;
    this.pillar.instanceMatrix.needsUpdate = true;
  }

  render(dt: number) {
    const start = performance.now();
    this.stats.calls = this.stats.triangles = this.stats.cpu = 0;
    if (this.w < 4 || this.h < 4 || !this.tile) return;
    this.time += dt;
    this.idle += dt;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.resizePending || dpr !== this.dpr) {
      this.resizePending = false; this.dirty = true; this.dpr = dpr;
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(this.w, this.h, false);
      this.cam.aspect = this.w / this.h;
      this.cam.updateProjectionMatrix();
    }
    const tile = this.tile;
    if (!this.dirty && this.drop === 0 && Math.abs(tile.inner.rotation.y + this.angle) < 0.002 && this.idle < 1 / 12) return;
    dt = this.idle; this.idle = 0; this.dirty = false;
    this.drop = Math.max(0, this.drop - dt * 2.4);
    tile.group.position.y = this.drop * this.drop * 2.5 + Math.sin(this.time * 1.6) * 0.02;
    tile.inner.rotation.y += (-this.angle - tile.inner.rotation.y) * (1 - Math.exp(-dt * 16));
    // A pilha usa sempre luz de dia, para a peça da vez ficar legível.
    // Sem o mapa do chão: ele é do tabuleiro, não da pilha.
    const night = U.night.value, clouds = U.clouds.value, lamps = U.lamps.value;
    const bounce = tmpBounce.copy(U.bounce.value);
    U.night.value = 0;
    U.clouds.value = 0;
    U.lamps.value = 0;
    U.bounce.value.setRGB(0, 0, 0);
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.cam);
    this.stats.draws++; this.stats.calls = this.renderer.info.render.drawCalls;
    this.stats.triangles = this.renderer.info.render.triangles; this.stats.cpu = performance.now() - start;
    U.night.value = night;
    U.clouds.value = clouds;
    U.lamps.value = lamps;
    U.bounce.value.copy(bounce);
  }
}
