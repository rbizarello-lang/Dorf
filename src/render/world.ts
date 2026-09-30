import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { Board, Check, Placed } from '../core/board';
import { edgeMid, hexToWorld, unkey } from '../core/hex';
import type { SynHit, SynKind } from '../core/synergy';
import type { TileDef } from '../core/tiles';
import type { Theme } from '../themes/types';
import { CameraRig } from './cameraRig';
import { Lib } from './lib';
import { Life } from './life';
import { TILE_T, buildTile, decoMatrix, tc, type Deco, type TileBuild } from './tileBuilder';

export type Quality = 'high' | 'medium' | 'low';
export type TimeOfDay = 'day' | 'dusk' | 'night';

const CHUNK = 8;
const DETAIL: Record<Quality, number> = { high: 1, medium: 0.65, low: 0.4 };
const tmpM = new THREE.Matrix4();
const tmpM2 = new THREE.Matrix4();

function tileMatrix(q: number, r: number, rot: number, y = 0, out = new THREE.Matrix4()) {
  const { x, z } = hexToWorld(q, r);
  return out.makeRotationY((-rot * Math.PI) / 3).setPosition(x, y, z);
}

/** Interações de uma peça colocada, convertidas para a orientação de origem da peça. */
function synBase(hits: SynHit[], rot: number): { sector: number; kind: SynKind }[] {
  return hits.map((h) => ({ sector: (h.edge - rot + 6) % 6, kind: h.kind }));
}
const synSig = (s: { sector: number; kind: SynKind }[]) =>
  s
    .map((x) => `${x.sector}${x.kind[0]}`)
    .sort()
    .join('');

/** InstancedMesh estático que cresce sob demanda (dobra a capacidade). */
class Pool {
  mesh: THREE.InstancedMesh;
  count = 0;
  constructor(
    private geo: THREE.BufferGeometry,
    private mat: THREE.Material,
    private parent: THREE.Object3D,
    private shadows: boolean,
    private cap = 128,
  ) {
    this.mesh = this.make(cap);
  }

  private make(cap: number) {
    const m = new THREE.InstancedMesh(this.geo, this.mat, cap);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    m.count = this.count;
    m.castShadow = this.shadows;
    m.receiveShadow = true;
    m.frustumCulled = false;
    this.parent.add(m);
    return m;
  }

  add(m: THREE.Matrix4, c: THREE.Color) {
    if (this.count >= this.cap) {
      const old = this.mesh;
      this.cap *= 2;
      this.mesh = this.make(this.cap);
      (this.mesh.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
      (this.mesh.instanceColor!.array as Float32Array).set(old.instanceColor!.array as Float32Array);
      this.parent.remove(old);
      old.dispose();
    }
    this.mesh.setMatrixAt(this.count, m);
    this.mesh.setColorAt(this.count, c);
    this.count++;
    this.mesh.count = this.count;
  }

  flush() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }

  dispose() {
    this.parent.remove(this.mesh);
    this.mesh.dispose();
  }
}
/** Buffer de vértices "somente acrescenta" para o chão e a água de um bloco de 8×8 peças. */
class Chunk {
  readonly ground: THREE.Mesh;
  readonly water: THREE.Mesh;
  private gPos = new Float32Array(0);
  private gCol = new Float32Array(0);
  private wPos = new Float32Array(0);
  private gN = 0;
  private wN = 0;
  private centerSum = new THREE.Vector3();
  private tiles = 0;

  constructor(lib: Lib, parent: THREE.Object3D) {
    this.ground = new THREE.Mesh(new THREE.BufferGeometry(), lib.ground);
    this.ground.receiveShadow = true;
    this.water = new THREE.Mesh(new THREE.BufferGeometry(), lib.water);
    this.water.receiveShadow = true;
    parent.add(this.ground, this.water);
  }

  append(b: TileBuild, m: THREE.Matrix4) {
    const e = m.elements;
    const gAdd = b.pos.length / 3;
    const wAdd = b.water.length / 3;
    const growG = this.gN + gAdd > this.gPos.length / 3;
    const growW = this.wN + wAdd > this.wPos.length / 3;
    if (growG) {
      const cap = Math.max(4096, (this.gN + gAdd) * 2);
      const p = new Float32Array(cap * 3);
      p.set(this.gPos.subarray(0, this.gN * 3));
      const c = new Float32Array(cap * 3);
      c.set(this.gCol.subarray(0, this.gN * 3));
      this.gPos = p;
      this.gCol = c;
      this.ground.geometry.dispose();
      this.ground.geometry.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.ground.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    if (growW) {
      const cap = Math.max(1024, (this.wN + wAdd) * 2);
      const p = new Float32Array(cap * 3);
      p.set(this.wPos.subarray(0, this.wN * 3));
      this.wPos = p;
      this.water.geometry.dispose();
      this.water.geometry.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.water.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(cap * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    }
    const xf = (src: Float32Array, dst: Float32Array, at: number) => {
      for (let i = 0; i < src.length; i += 3) {
        const x = src[i], y = src[i + 1], z = src[i + 2];
        dst[at + i] = e[0] * x + e[4] * y + e[8] * z + e[12];
        dst[at + i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        dst[at + i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
    };
    xf(b.pos, this.gPos, this.gN * 3);
    this.gCol.set(b.col, this.gN * 3);
    const gp = this.ground.geometry.getAttribute('position') as THREE.BufferAttribute;
    const gc = this.ground.geometry.getAttribute('color') as THREE.BufferAttribute;
    if (!growG) {
      gp.addUpdateRange(this.gN * 3, gAdd * 3);
      gc.addUpdateRange(this.gN * 3, gAdd * 3);
    }
    gp.needsUpdate = true;
    gc.needsUpdate = true;
    this.gN += gAdd;
    this.ground.geometry.setDrawRange(0, this.gN);
    if (wAdd) {
      xf(b.water, this.wPos, this.wN * 3);
      const wp = this.water.geometry.getAttribute('position') as THREE.BufferAttribute;
      if (!growW) wp.addUpdateRange(this.wN * 3, wAdd * 3);
      wp.needsUpdate = true;
      this.wN += wAdd;
      this.water.geometry.setDrawRange(0, this.wN);
    }
    this.water.visible = this.wN > 0;
    // Esfera envolvente aproximada a partir dos centros das peças (frustum culling por bloco).
    this.centerSum.x += e[12];
    this.centerSum.z += e[14];
    this.tiles++;
    const c = this.centerSum.clone().multiplyScalar(1 / this.tiles);
    const radius = CHUNK * 1.9 + 1.5;
    for (const g of [this.ground.geometry, this.water.geometry]) g.boundingSphere = new THREE.Sphere(c, radius);
  }

  triangles() {
    return (this.gN + this.wN) / 3;
  }

  dispose(parent: THREE.Object3D) {
    parent.remove(this.ground, this.water);
    this.ground.geometry.dispose();
    this.water.geometry.dispose();
  }
}

/** Peça "viva": fantasma sob o cursor, peça caindo e a peça da pilha. */
export class LiveTile {
  readonly group = new THREE.Group();
  readonly inner = new THREE.Group();
  private readonly groundGeo: THREE.BufferGeometry;
  private readonly waterGeo: THREE.BufferGeometry;
  private readonly meshes: { mesh: THREE.InstancedMesh; items: Deco[] }[] = [];

  constructor(
    readonly def: TileDef,
    readonly build: TileBuild,
    readonly sig: string,
    lib: Lib,
    shadows = true,
  ) {
    this.group.add(this.inner);
    this.groundGeo = new THREE.BufferGeometry();
    this.groundGeo.setAttribute('position', new THREE.BufferAttribute(build.pos, 3));
    this.groundGeo.setAttribute('color', new THREE.BufferAttribute(build.col, 3));
    const ground = new THREE.Mesh(this.groundGeo, lib.ground);
    ground.castShadow = shadows;
    ground.receiveShadow = true;
    this.waterGeo = new THREE.BufferGeometry();
    this.waterGeo.setAttribute('position', new THREE.BufferAttribute(build.water, 3));
    this.waterGeo.computeVertexNormals();
    const water = new THREE.Mesh(this.waterGeo, lib.water);
    this.inner.add(ground, water);
    const byKey = new Map<string, Deco[]>();
    for (const d of build.decos) {
      let arr = byKey.get(d.key);
      if (!arr) byKey.set(d.key, (arr = []));
      arr.push(d);
    }
    for (const [key, items] of byKey) {
      const geo = lib.geo(key);
      if (!geo) continue;
      const mesh = new THREE.InstancedMesh(geo, lib.material(key), items.length);
      mesh.castShadow = shadows && lib.castsShadow(key);
      mesh.receiveShadow = true;
      items.forEach((d, i) => {
        mesh.setMatrixAt(i, decoMatrix(d));
        mesh.setColorAt(i, d.color);
      });
      mesh.computeBoundingSphere();
      this.inner.add(mesh);
      this.meshes.push({ mesh, items });
    }
  }

  /** Escala da decoração (0 → 1) com atraso escalonado: árvores "brotam". */
  setDecoScale(fn: (i: number, n: number) => number) {
    for (const { mesh, items } of this.meshes) {
      items.forEach((d, i) => {
        const s = fn(i, items.length);
        decoMatrix(d, tmpM);
        tmpM2.makeScale(s, s, s);
        tmpM.multiply(tmpM2);
        mesh.setMatrixAt(i, tmpM);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.groundGeo.dispose();
    this.waterGeo.dispose();
    for (const { mesh } of this.meshes) mesh.dispose();
  }
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  color: THREE.Color;
  kind: 0 | 1;
}

interface Drop {
  live: LiveTile;
  placed: Placed;
  t: number;
  y0: number;
  landed: boolean;
}

const TILT_SHIFT = {
  uniforms: {
    tDiffuse: { value: null },
    uDir: { value: new THREE.Vector2(1, 0) },
    uAmount: { value: 1.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uDir; uniform float uAmount; varying vec2 vUv;
    void main(){
      float d = abs(vUv.y - 0.46);
      float b = smoothstep(0.16, 0.55, d) * uAmount;
      vec2 o = uDir * b;
      vec4 c = texture2D(tDiffuse, vUv) * 0.2270270;
      c += (texture2D(tDiffuse, vUv + o * 1.3846) + texture2D(tDiffuse, vUv - o * 1.3846)) * 0.3162162;
      c += (texture2D(tDiffuse, vUv + o * 3.2308) + texture2D(tDiffuse, vUv - o * 3.2308)) * 0.0702703;
      gl_FragColor = c;
    }`,
};

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.22 } },
  vertexShader: TILT_SHIFT.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uVignette; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 p = vUv - 0.5;
      float v = smoothstep(0.9, 0.25, length(p * vec2(1.0, 1.15)));
      c.rgb *= mix(1.0 - uVignette, 1.0, v);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, 1.08);
      gl_FragColor = c;
    }`,
};

/** Estado da iluminação: interpolado suavemente entre dia, entardecer e noite. */
interface Sky {
  bg: THREE.Color;
  fill: THREE.Color;
  line: THREE.Color;
  sun: THREE.Color;
  sunI: number;
  sunDir: THREE.Vector3;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiI: number;
  night: number;
}

function skyFor(theme: Theme, tod: TimeOfDay): Sky {
  const C = (h: string) => new THREE.Color(h);
  const mix = (a: string, b: string, t: number) => C(a).lerp(C(b), t);
  const [dx, dy, dz] = theme.sunDir;
  if (tod === 'dusk')
    return {
      bg: mix(theme.bg, '#f09a74', 0.42),
      fill: mix(theme.voidFill, '#f4ae88', 0.4),
      line: mix(theme.voidLine, '#fbd0b4', 0.35),
      sun: C('#ffb074'),
      sunI: theme.sunIntensity * 0.95,
      sunDir: new THREE.Vector3(dx * 1.8, 0.42, dz * 1.8),
      hemiSky: mix(theme.hemiSky, '#ffc2a0', 0.55),
      hemiGround: mix(theme.hemiGround, '#5a3a4a', 0.4),
      hemiI: theme.hemiIntensity * 0.8,
      night: 0.35,
    };
  if (tod === 'night')
    return {
      bg: mix(theme.bg, '#18203e', 0.9),
      fill: mix(theme.voidFill, '#1f2848', 0.88),
      line: mix(theme.voidLine, '#34426e', 0.82),
      sun: C('#b4c6ff'),
      sunI: 0.75,
      sunDir: new THREE.Vector3(-dx, 0.9, -dz),
      hemiSky: C('#51639c'),
      hemiGround: C('#1c2130'),
      hemiI: 1.05,
      night: 1,
    };
  return {
    bg: C(theme.bg),
    fill: C(theme.voidFill),
    line: C(theme.voidLine),
    sun: C(theme.sun),
    sunI: theme.sunIntensity,
    sunDir: new THREE.Vector3(dx, dy, dz),
    hemiSky: C(theme.hemiSky),
    hemiGround: C(theme.hemiGround),
    hemiI: theme.hemiIntensity,
    night: 0,
  };
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  readonly rig = new CameraRig();
  readonly lib = new Lib();
  readonly life: Life;
  theme!: Theme;
  quality: Quality = 'high';
  timeOfDay: TimeOfDay = 'day';

  private readonly staticRoot = new THREE.Group();
  private chunks = new Map<number, Chunk>();
  private pools = new Map<string, Pool>();
  private board: Board | null = null;
  private chimneys: number[] = [];
  private sun = new THREE.DirectionalLight();
  private hemi = new THREE.HemisphereLight();
  private sky!: Sky;
  private skyTarget!: Sky;
  private voidMat: THREE.ShaderMaterial;
  private slots: THREE.InstancedMesh;
  private slotCount = 0;
  private hoverRing: THREE.Mesh;
  private markers: THREE.Mesh[] = [];
  /** Posição das marcas de borda relativa ao fantasma (elas acompanham a peça flutuando). */
  private markerLocal: THREE.Vector3[] = [];
  private ghost: LiveTile | null = null;
  private ghostKey = '';
  private ghostTarget = new THREE.Vector3();
  private ghostAngle = 0;
  private drops: Drop[] = [];
  private particles: Particle[] = [];
  private particleMesh: THREE.InstancedMesh;
  private smokeClock = 0;
  private composer: EffectComposer;
  private tiltH: ShaderPass;
  private tiltV: ShaderPass;
  private time = 0;
  private size = new THREE.Vector2(1, 1);

  // Pilha de peças (canto inferior direito), desenhada numa viewport separada.
  private previewScene = new THREE.Scene();
  private previewCam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  private previewTile: LiveTile | null = null;
  private previewDef: TileDef | null = null;
  private previewAngle = 0;
  private previewPillar: THREE.InstancedMesh;
  private previewSun = new THREE.DirectionalLight();
  private previewHemi = new THREE.HemisphereLight();
  previewRect: DOMRect | null = null;
  previewDrop = 0;

  onBaked?: (p: Placed) => void;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;

    this.scene.add(this.staticRoot);
    this.scene.fog = new THREE.Fog('#ffffff', 10, 40);
    this.life = new Life(this.lib, this.scene);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target, this.hemi);

    // Vazio com a grade hexagonal que desbota longe do tabuleiro.
    this.voidMat = new THREE.ShaderMaterial({
      uniforms: {
        uBg: { value: new THREE.Color() },
        uFill: { value: new THREE.Color() },
        uLine: { value: new THREE.Color() },
        uCenter: { value: new THREE.Vector2() },
        uRadius: { value: 6 },
      },
      vertexShader: `varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform vec3 uBg; uniform vec3 uFill; uniform vec3 uLine; uniform vec2 uCenter; uniform float uRadius; varying vec2 vP;
        void main(){
          vec2 p = vP;
          float qf = 2.0/3.0 * p.x; float rf = -p.x/3.0 + 0.57735027 * p.y;
          vec3 c = vec3(qf, -qf-rf, rf); vec3 rc = floor(c + 0.5); vec3 d = abs(rc - c);
          if (d.x > d.y && d.x > d.z) rc.x = -rc.y - rc.z; else if (d.y > d.z) rc.y = -rc.x - rc.z; else rc.z = -rc.x - rc.y;
          vec2 ctr = vec2(1.5 * rc.x, 1.7320508 * (rc.z + rc.x * 0.5));
          vec2 a = abs(p - ctr);
          float hd = max(a.y, 0.8660254 * a.x + 0.5 * a.y);
          float aa = fwidth(hd) * 1.2;
          float line = smoothstep(0.866 - 0.035 - aa, 0.866 - 0.035, hd);
          float inner = 1.0 - smoothstep(0.80 - aa, 0.80, hd);
          float fade = 1.0 - smoothstep(uRadius, uRadius + 7.0, length(p - uCenter));
          vec3 col = mix(uBg, uFill, inner * fade * 0.9);
          col = mix(col, uLine, line * fade);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const voidMesh = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), this.voidMat);
    voidMesh.position.y = -TILE_T - 0.03;
    voidMesh.renderOrder = -1;
    this.scene.add(voidMesh);

    const hex = new THREE.CircleGeometry(0.9, 6).rotateX(-Math.PI / 2);
    this.slots = new THREE.InstancedMesh(hex, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false, fog: false }), 512);
    this.slots.count = 0;
    this.slots.frustumCulled = false;
    this.slots.position.y = -0.12;
    this.scene.add(this.slots);

    this.hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.84, 0.97, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    this.hoverRing.visible = false;
    this.scene.add(this.hoverRing);

    const pill = new THREE.CapsuleGeometry(0.026, 0.5, 3, 8).rotateZ(Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(pill, new THREE.MeshBasicMaterial({ fog: false, transparent: true, opacity: 0.95 }));
      m.visible = false;
      this.markers.push(m);
      this.markerLocal.push(new THREE.Vector3());
      this.scene.add(m);
    }

    this.particleMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 }), 400);
    this.particleMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(400 * 3), 3);
    this.particleMesh.count = 0;
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);

    // Pós-processamento: tilt-shift (efeito maquete) + vinheta.
    // Alvo em meio-float quando a GPU consegue renderizar nele; senão, 8 bits.
    const ext = this.renderer.extensions;
    const halfOk = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: halfOk ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.tiltH = new ShaderPass(TILT_SHIFT);
    this.tiltV = new ShaderPass(TILT_SHIFT);
    this.composer.addPass(this.tiltH);
    this.composer.addPass(this.tiltV);
    this.composer.addPass(new ShaderPass(GRADE));
    this.composer.addPass(new OutputPass());

    this.previewScene.add(this.previewSun, this.previewHemi);
    this.previewSun.position.set(-2, 4, 3);
    const slab = new THREE.CylinderGeometry(1, 1, 0.07, 6).rotateY(Math.PI / 6);
    this.previewPillar = new THREE.InstancedMesh(slab, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95 }), 40);
    this.previewPillar.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(40 * 3), 3);
    this.previewScene.add(this.previewPillar);
    this.previewCam.position.set(0, 3.2, 4.4);
    this.previewCam.lookAt(0, -0.55, 0);
  }

  // ---------------------------------------------------------------- tema, luz, qualidade

  setTheme(theme: Theme, board: Board) {
    this.theme = theme;
    this.lib.applyTheme(theme);
    this.lib.uniforms.uClouds.value = theme.period === 'futuro' ? 0.08 : 0.16;
    this.skyTarget = skyFor(theme, this.timeOfDay);
    this.sky = skyFor(theme, this.timeOfDay);
    this.applySky();
    this.previewSun.color.set(theme.sun);
    this.previewSun.intensity = theme.sunIntensity;
    this.previewHemi.color.set(theme.hemiSky);
    this.previewHemi.groundColor.set(theme.hemiGround);
    this.previewHemi.intensity = theme.hemiIntensity;
    for (let i = 0; i < 40; i++) {
      const c = tc(theme.side).clone().lerp(tc(theme.sideDark), i % 2 ? 0.45 : 0.1);
      this.previewPillar.setColorAt(i, c);
    }
    this.previewPillar.instanceColor!.needsUpdate = true;
    this.previewTile?.dispose();
    this.previewTile = null;
    this.previewDef = null;
    // O fantasma guarda cores e decoração do tema antigo: descarta em vez de só esconder.
    this.dropGhost();
    this.clearGhost();
    this.rebuild(board);
  }

  setTimeOfDay(tod: TimeOfDay) {
    this.timeOfDay = tod;
    if (this.theme) this.skyTarget = skyFor(this.theme, tod);
  }

  private applySky() {
    const s = this.sky;
    (this.scene.background as THREE.Color | null)?.copy?.(s.bg);
    if (!(this.scene.background instanceof THREE.Color)) this.scene.background = s.bg.clone();
    (this.scene.fog as THREE.Fog).color.copy(s.bg);
    this.voidMat.uniforms.uBg.value.copy(s.bg);
    this.voidMat.uniforms.uFill.value.copy(s.fill);
    this.voidMat.uniforms.uLine.value.copy(s.line);
    (this.slots.material as THREE.MeshBasicMaterial).color.copy(s.line);
    this.sun.color.copy(s.sun);
    this.sun.intensity = s.sunI;
    this.hemi.color.copy(s.hemiSky);
    this.hemi.groundColor.copy(s.hemiGround);
    this.hemi.intensity = s.hemiI;
    this.lib.uniforms.uNight.value = s.night;
  }

  private stepSky(dt: number) {
    const a = this.sky, b = this.skyTarget;
    if (!a || !b) return;
    const k = 1 - Math.exp(-dt * 1.6);
    a.bg.lerp(b.bg, k);
    a.fill.lerp(b.fill, k);
    a.line.lerp(b.line, k);
    a.sun.lerp(b.sun, k);
    a.hemiSky.lerp(b.hemiSky, k);
    a.hemiGround.lerp(b.hemiGround, k);
    a.sunDir.lerp(b.sunDir, k);
    a.sunI += (b.sunI - a.sunI) * k;
    a.hemiI += (b.hemiI - a.hemiI) * k;
    a.night += (b.night - a.night) * k;
    this.applySky();
  }

  setQuality(q: Quality) {
    const detailChanged = DETAIL[q] !== DETAIL[this.quality];
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(dpr, 2) : q === 'medium' ? Math.min(dpr, 1.5) : 1);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const map = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== map) {
      this.sun.shadow.mapSize.set(map, map);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    // Materiais precisam recompilar quando sombras ligam/desligam.
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
    if (detailChanged && this.board && this.theme) {
      this.dropGhost();
      this.rebuild(this.board);
    }
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.size.set(w, h);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const px = 1.6;
    this.tiltH.uniforms.uDir.value.set(px / w, 0);
    this.tiltV.uniforms.uDir.value.set(0, px / h);
  }

  // ---------------------------------------------------------------- mapa

  private build(def: TileDef, synergies: { sector: number; kind: SynKind }[]) {
    return buildTile(def.edges, def.seed, this.theme, { detail: DETAIL[this.quality], synergies, houses: this.lib.houseMeta });
  }

  rebuild(board: Board) {
    this.board = board;
    for (const c of this.chunks.values()) c.dispose(this.staticRoot);
    this.chunks.clear();
    for (const p of this.pools.values()) p.dispose();
    this.pools.clear();
    for (const d of this.drops) d.live.dispose();
    this.drops = [];
    this.chimneys = [];
    this.particles = [];
    this.life.reset(this.theme);
    for (const p of board.list) this.bake(p, this.build(p.def, synBase(p.synergies, p.rot)), false);
    for (const pool of this.pools.values()) pool.flush();
    this.updateFrontier(board);
    this.life.sync(board);
  }

  private chunkFor(q: number, r: number) {
    const k = ((Math.floor(q / CHUNK) + 512) << 10) | (Math.floor(r / CHUNK) + 512);
    let c = this.chunks.get(k);
    if (!c) {
      c = new Chunk(this.lib, this.staticRoot);
      this.chunks.set(k, c);
    }
    return c;
  }

  private pool(key: string) {
    let p = this.pools.get(key);
    if (!p) {
      // Chave com "~" = metade "fina" de plantas e capim, escondida de longe (nível de detalhe).
      const base = key.endsWith('~') ? key.slice(0, -1) : key;
      const geo = this.lib.geo(base);
      if (!geo) return null;
      p = new Pool(geo, this.lib.material(base), this.staticRoot, this.lib.castsShadow(base));
      this.pools.set(key, p);
    }
    return p;
  }

  private lodFlip = 0;
  private isLod(key: string) {
    return key.startsWith('crop:') || key === 'grass' || key === 'flower';
  }

  private bake(p: Placed, b: TileBuild, flush = true) {
    const m = tileMatrix(p.q, p.r, p.rot);
    this.chunkFor(p.q, p.r).append(b, m);
    for (const d of b.decos) {
      decoMatrix(d, tmpM);
      tmpM.premultiply(m);
      if (d.anim === 'spin-z' || d.anim === 'spin-x') this.life.addSpinner(d.key, tmpM, d.anim === 'spin-x' ? 'x' : 'z');
      else if (d.anim === 'wander') this.life.addAnimal(tmpM, d.color);
      else this.pool(this.isLod(d.key) && this.lodFlip++ % 2 ? `${d.key}~` : d.key)?.add(tmpM, d.color);
    }
    const v = new THREE.Vector3();
    for (let i = 0; i < b.chimneys.length; i += 3) {
      v.set(b.chimneys[i], b.chimneys[i + 1], b.chimneys[i + 2]).applyMatrix4(m);
      this.chimneys.push(v.x, v.y, v.z);
    }
    if (flush) for (const pool of this.pools.values()) pool.flush();
  }

  updateFrontier(board: Board) {
    this.board = board;
    let i = 0;
    let maxR = 3;
    for (const k of board.frontier) {
      const [q, r] = unkey(k);
      const { x, z } = hexToWorld(q, r);
      maxR = Math.max(maxR, Math.hypot(x, z));
      if (i >= 512) continue;
      this.slots.setMatrixAt(i++, tmpM.makeTranslation(x, 0, z));
    }
    this.slotCount = i;
    this.slots.count = i;
    this.slots.instanceMatrix.needsUpdate = true;
    this.voidMat.uniforms.uRadius.value = maxR + 1;
    this.rig.bounds = maxR;
  }

  /** Coloca com animação: a peça assenta, levanta poeira e depois é "cozida" no bloco. */
  placeAnimated(p: Placed) {
    const syn = synBase(p.synergies, p.rot);
    const sig = synSig(syn);
    let live: LiveTile;
    let y0 = 1.2;
    if (this.ghost && this.ghost.def === p.def && this.ghost.sig === sig) {
      live = this.ghost;
      y0 = live.group.position.y;
      this.ghost = null;
      this.ghostKey = '';
    } else {
      live = new LiveTile(p.def, this.build(p.def, syn), sig, this.lib, this.quality !== 'low');
      this.scene.add(live.group);
      this.dropGhost();
    }
    live.inner.rotation.y = (-p.rot * Math.PI) / 3;
    const { x, z } = hexToWorld(p.q, p.r);
    live.group.position.set(x, y0, z);
    this.hoverRing.visible = false;
    for (const m of this.markers) m.visible = false;
    this.drops.push({ live, placed: p, t: 0, y0, landed: false });
  }

  /** Coloca várias peças de uma vez, sem animação (modo automático / teste de carga). */
  placeInstant(list: Placed[], board: Board) {
    for (const p of list) this.bake(p, this.build(p.def, synBase(p.synergies, p.rot)), false);
    for (const pool of this.pools.values()) pool.flush();
    this.updateFrontier(board);
    this.life.sync(board);
  }

  // ---------------------------------------------------------------- fantasma

  setGhost(def: TileDef, rot: number, angle: number, q: number, r: number, check: Check) {
    const syn = check.valid ? synBase(check.synergies, rot) : [];
    const sig = synSig(syn);
    const key = `${def.seed}:${this.theme.id}:${sig}`;
    if (!this.ghost || this.ghostKey !== key) {
      const old = this.ghost;
      this.ghost = new LiveTile(def, this.build(def, syn), sig, this.lib, this.quality !== 'low');
      this.ghostKey = key;
      this.scene.add(this.ghost.group);
      if (old && old.def === def) {
        // Mesma peça, outras construções: preserva posição e giro para não "pular".
        this.ghost.group.position.copy(old.group.position);
        this.ghost.inner.rotation.y = old.inner.rotation.y;
      } else {
        const { x, z } = hexToWorld(q, r);
        this.ghost.group.position.set(x, 0.5, z);
        this.ghost.inner.rotation.y = -angle;
      }
      old?.dispose();
    }
    this.ghost.group.visible = true;
    this.ghostAngle = angle;
    const { x, z } = hexToWorld(q, r);
    this.ghostTarget.set(x, 0.32, z);
    this.hoverRing.visible = true;
    this.hoverRing.position.set(x, -0.1, z);
    (this.hoverRing.material as THREE.MeshBasicMaterial).color.set(check.valid ? '#ffffff' : '#ff5a4f');
    for (let i = 0; i < 6; i++) {
      const m = this.markers[i];
      const s = check.edgeState[i];
      m.visible = s === 1 || s === 3 || s === 4;
      if (!m.visible) continue;
      const [mx, mz] = edgeMid(i);
      this.markerLocal[i].set(mx * 0.93, 0.03, mz * 0.93);
      m.rotation.y = -(Math.PI / 6 + (Math.PI / 3) * i) + Math.PI / 2;
      (m.material as THREE.MeshBasicMaterial).color.set(s === 1 ? '#ffffff' : s === 4 ? '#ffc83d' : '#ff4a3d');
    }
  }

  clearGhost() {
    if (this.ghost) this.ghost.group.visible = false;
    this.hoverRing.visible = false;
    for (const m of this.markers) m.visible = false;
  }

  dropGhost() {
    this.ghost?.dispose();
    this.ghost = null;
    this.ghostKey = '';
  }

  // ---------------------------------------------------------------- efeitos

  burst(x: number, z: number, kind: 'dust' | 'sparkle', n: number, y = 0) {
    const color = kind === 'dust' ? tc(this.theme.smoke) : tc(this.theme.sparkle);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = kind === 'dust' ? 0.95 : Math.random() * 0.7;
      const sp = kind === 'dust' ? 0.5 + Math.random() * 0.6 : 0.2 + Math.random() * 0.4;
      this.particles.push({
        x: x + Math.cos(a) * r,
        y: y + (kind === 'dust' ? 0.02 : 0.1 + Math.random() * 0.2),
        z: z + Math.sin(a) * r,
        vx: Math.cos(a) * sp,
        vy: kind === 'dust' ? 0.25 + Math.random() * 0.3 : 0.9 + Math.random() * 0.8,
        vz: Math.sin(a) * sp,
        age: 0,
        life: kind === 'dust' ? 0.7 + Math.random() * 0.4 : 0.9 + Math.random() * 0.6,
        size: kind === 'dust' ? 0.9 + Math.random() * 0.8 : 0.35 + Math.random() * 0.3,
        color,
        kind: kind === 'dust' ? 0 : 1,
      });
    }
  }

  private spawnSmoke(dt: number) {
    const n = this.chimneys.length / 3;
    if (!n || this.particles.length > 360) return;
    this.smokeClock += dt * Math.min(n * 0.25, 7);
    const tx = this.rig.target.x, tz = this.rig.target.z;
    const view = this.rig.dist * 1.1;
    while (this.smokeClock > 1) {
      this.smokeClock -= 1;
      for (let tries = 0; tries < 6; tries++) {
        const i = Math.floor(Math.random() * n) * 3;
        const x = this.chimneys[i], y = this.chimneys[i + 1], z = this.chimneys[i + 2];
        if (Math.abs(x - tx) > view || Math.abs(z - tz) > view) continue;
        const w = this.lib.uniforms.uWind.value;
        this.particles.push({ x, y, z, vx: w.x * 0.07, vy: 0.2, vz: w.y * 0.07, age: 0, life: 2.6 + Math.random(), size: 0.45, color: tc(this.theme.smoke), kind: 0 });
        break;
      }
    }
  }

  private updateParticles(dt: number) {
    const out: Particle[] = [];
    let i = 0;
    for (const p of this.particles) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const drag = p.kind === 0 ? 2.2 : 0.8;
      if (p.age > 0.4 || p.kind === 1) {
        p.vx *= Math.exp(-drag * dt);
        p.vz *= Math.exp(-drag * dt);
      }
      if (p.kind === 1) p.vy -= 1.6 * dt;
      const t = p.age / p.life;
      const s = p.size * (p.kind === 0 ? Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.6 + t) : 1 - t);
      if (i < 400) {
        tmpM.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
        this.particleMesh.setMatrixAt(i, tmpM);
        this.particleMesh.setColorAt(i, p.color);
        i++;
      }
      out.push(p);
    }
    this.particles = out;
    this.particleMesh.count = i;
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- utilidades

  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private ndc = new THREE.Vector2();

  groundPoint(clientX: number, clientY: number, out = new THREE.Vector3()) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.ray.intersectPlane(this.plane, out);
  }

  project(x: number, y: number, z: number) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.size.x, y: (-v.y * 0.5 + 0.5) * this.size.y, visible: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 };
  }

  /** Custo por kit: instâncias e triângulos (para achar o que pesa). */
  poolReport() {
    return [...this.pools.entries()]
      .map(([k, p]) => ({ k, n: p.count, tris: (p.count * (this.lib.geo(k)?.attributes.position.count ?? 0)) / 3, shadow: p.mesh.castShadow }))
      .sort((a, b) => b.tris - a.tris);
  }

  stats() {
    const info = this.renderer.info;
    let tris = 0;
    for (const c of this.chunks.values()) tris += c.triangles();
    let inst = 0;
    for (const p of this.pools.values()) inst += p.count;
    return { calls: info.render.calls, triangles: info.render.triangles, chunks: this.chunks.size, instances: inst, groundTris: tris, life: this.life.counts() };
  }

  setPreview(def: TileDef | null, angle: number, stack: number) {
    if (def !== this.previewDef) {
      this.previewTile?.dispose();
      this.previewTile = null;
      this.previewDef = def;
      if (def) {
        this.previewTile = new LiveTile(def, this.build(def, []), '', this.lib, false);
        this.previewScene.add(this.previewTile.group);
        this.previewDrop = 0.6;
      }
    }
    this.previewAngle = angle;
    const n = Math.min(40, Math.max(0, stack - 1));
    for (let i = 0; i < n; i++) this.previewPillar.setMatrixAt(i, tmpM.makeTranslation(0, -TILE_T - 0.035 - i * 0.075, 0));
    this.previewPillar.count = n;
    this.previewPillar.instanceMatrix.needsUpdate = true;
  }

  /** Depuração visual: todos os kits do tema lado a lado (?gallery). */
  showGallery() {
    const keys = [...this.lib.geos.keys()];
    const cols = Math.ceil(Math.sqrt(keys.length));
    const root = new THREE.Group();
    keys.forEach((k, i) => {
      const geo = this.lib.geo(k)!;
      const mesh = new THREE.Mesh(geo, this.lib.material(k));
      const x = (i % cols) * 0.45, z = Math.floor(i / cols) * 0.45;
      mesh.position.set(x - (cols * 0.45) / 2, 0, z - (cols * 0.45) / 2);
      mesh.scale.setScalar(k.startsWith('crop:') || k === 'grass' || k === 'flower' ? 2.2 : 1.4);
      mesh.castShadow = true;
      root.add(mesh);
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(cols * 0.5, cols * 0.5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b8c890' }));
    floor.receiveShadow = true;
    root.add(floor);
    this.scene.add(root);
    this.staticRoot.visible = false;
    this.rig.goal.set(0, 0, 0);
    this.rig.target.set(0, 0, 0);
    this.rig.dist = this.rig.goalDist = cols * 0.62;
    return keys;
  }

  // ---------------------------------------------------------------- quadro

  tick(dt: number) {
    this.renderer.info.reset();
    this.time += dt;
    this.lib.uniforms.uTime.value = this.time;
    // O vento muda de direção devagar.
    const wa = 0.65 + Math.sin(this.time * 0.05) * 0.5;
    this.lib.uniforms.uWind.value.set(Math.cos(wa), Math.sin(wa));
    this.stepSky(dt);
    this.rig.update(dt);
    this.rig.apply(this.camera);

    const fog = this.scene.fog as THREE.Fog;
    fog.near = this.rig.dist * 1.5;
    fog.far = this.rig.dist * 4.2;

    // Sol acompanha o alvo; área da sombra acompanha o zoom.
    const t = this.rig.target;
    const sd = this.sky.sunDir;
    const ext = Math.min(28, this.rig.dist * 0.95 + 2);
    this.sun.target.position.copy(t);
    this.sun.position.set(t.x + sd.x * 20, t.y + sd.y * 20, t.z + sd.z * 20);
    const cam = this.sun.shadow.camera;
    if (cam.right !== ext) {
      cam.left = -ext;
      cam.right = ext;
      cam.top = ext;
      cam.bottom = -ext;
      cam.near = 1;
      cam.far = 60;
      cam.updateProjectionMatrix();
    }

    // Fantasma: flutua e gira suavemente até a orientação escolhida.
    if (this.ghost && this.ghost.group.visible) {
      const g = this.ghost.group;
      const k = 1 - Math.exp(-dt * 16);
      g.position.x += (this.ghostTarget.x - g.position.x) * k;
      g.position.z += (this.ghostTarget.z - g.position.z) * k;
      g.position.y += (this.ghostTarget.y + Math.sin(this.time * 2.4) * 0.025 - g.position.y) * k;
      const inner = this.ghost.inner;
      inner.rotation.y += (-this.ghostAngle - inner.rotation.y) * (1 - Math.exp(-dt * 18));
      for (let i = 0; i < 6; i++) if (this.markers[i].visible) this.markers[i].position.copy(g.position).add(this.markerLocal[i]);
    }

    // Peças caindo.
    const still: Drop[] = [];
    for (const d of this.drops) {
      d.t += dt;
      const g = d.live.group;
      const fall = 0.16;
      if (d.t < fall) {
        const u = d.t / fall;
        g.position.y = d.y0 * (1 - u * u);
      } else {
        g.position.y = 0;
        if (!d.landed) {
          d.landed = true;
          this.burst(g.position.x, g.position.z, 'dust', 14);
        }
        const u = (d.t - fall) / 0.32;
        g.scale.set(1 + Math.sin(Math.min(1, u) * Math.PI) * 0.03, 1 - Math.sin(Math.min(1, u) * Math.PI) * 0.08, 1 + Math.sin(Math.min(1, u) * Math.PI) * 0.03);
        const tt = d.t - fall;
        d.live.setDecoScale((i, n) => {
          const local = Math.max(0, Math.min(1, (tt - (i / n) * 0.18) / 0.3));
          return 1 + Math.sin(local * Math.PI) * 0.18;
        });
      }
      if (d.t > fall + 0.55) {
        this.bake(d.placed, d.live.build);
        d.live.dispose();
        if (this.board) this.life.sync(this.board);
        this.onBaked?.(d.placed);
      } else still.push(d);
    }
    this.drops = still;

    // Nível de detalhe: de longe, metade das plantas basta (as parcelas já têm a cor da cultura).
    const fine = this.rig.dist < 13;
    for (const [k, p] of this.pools) if (k.endsWith('~')) p.mesh.visible = fine;

    this.life.update(dt);
    this.spawnSmoke(dt);
    this.updateParticles(dt);
    this.slots.visible = this.slotCount > 0;

    if (this.quality === 'high') this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);

    this.renderPreview(dt);
  }

  private renderPreview(dt: number) {
    const rect = this.previewRect;
    if (!rect || !this.previewTile || rect.width < 4) return;
    const tile = this.previewTile;
    this.previewDrop = Math.max(0, this.previewDrop - dt * 2.4);
    tile.group.position.y = this.previewDrop * this.previewDrop * 2.5 + Math.sin(this.time * 1.6) * 0.02;
    tile.inner.rotation.y += (-this.previewAngle - tile.inner.rotation.y) * (1 - Math.exp(-dt * 16));
    const r = this.renderer;
    const h = this.size.y;
    this.previewCam.aspect = rect.width / rect.height;
    this.previewCam.updateProjectionMatrix();
    r.setScissorTest(true);
    r.setViewport(rect.left, h - rect.bottom, rect.width, rect.height);
    r.setScissor(rect.left, h - rect.bottom, rect.width, rect.height);
    const auto = r.autoClear;
    r.autoClear = false;
    r.clearDepth();
    // A pilha usa sempre luz de dia, para a peça da vez ficar legível.
    const night = this.lib.uniforms.uNight.value;
    this.lib.uniforms.uNight.value = 0;
    r.render(this.previewScene, this.previewCam);
    this.lib.uniforms.uNight.value = night;
    r.autoClear = auto;
    r.setScissorTest(false);
    r.setViewport(0, 0, this.size.x, this.size.y);
  }
}
