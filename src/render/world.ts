import * as THREE from 'three/webgpu';
import { mrt, vec3, vec4 } from 'three/tsl';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import type { Board, Check, PlaceResult, Placed } from '../core/board';
import { DIRS, edgeMid, hexToWorld, hkey, opposite, unkey } from '../core/hex';
import type { SynHit, SynKind } from '../core/synergy';
import { T, rotateEdges, type TileDef } from '../core/tiles';
import type { Theme } from '../themes/types';
import { CameraRig } from './cameraRig';
import { createRenderer, type Backend } from './gpu';
import { Lib, instGeometry, setInstColor } from './lib';
import { Life } from './life';
import { U, makeVoidMaterial, softShadowFilter } from './materials';
import { A, fogNode } from './atmosphere';
import { CL, makeCloudMesh } from './clouds';
import { groundMap } from './groundMap';
import { P, buildPost, type Post, type Quality } from './post';
import { SkyEnv } from './sky';
import { FX, Fireflies, Sprites, Weather } from './fx';
import { LiveTile } from './liveTile';
import { PreviewView } from './preview';
import { TILE_T, buildTile, decoMatrix, resolveFlow, tc, type TileBuild } from './tileBuilder';

export type { Quality };
export type TimeOfDay = 'dawn' | 'day' | 'golden' | 'dusk' | 'night';

const CHUNK = 8;
/** O alto do céu um pouco mais azul que a cor "do céu" do tema (que é quase branca). */
const ZENITH_TINT = new THREE.Color(0.86, 0.93, 1.08);
// Ultra e Cinema passam de 1: mais árvores, capim e plantações de perto (alvo: GPUs acima da atual).
const DETAIL: Record<Quality, number> = { cinema: 1.6, ultra: 1.35, high: 1, medium: 0.65, low: 0.4 };
/** Mapa de sombra por nível. No Ultra e no Cinema, cada uma das cascatas tem esse tamanho. */
const SHADOW_MAP: Record<Quality, number> = { cinema: 4096, ultra: 4096, high: 2048, medium: 1024, low: 1024 };
/**
 * Cascatas da sombra do sol (0 = sombra única) e onde cada uma termina, em frações de maxFar.
 * O Cinema divide o perto em mais faixas: a sombra junto ao alvo fica mais fina.
 */
const CASCADES: Record<Quality, number[]> = { cinema: [0.18, 0.34, 0.56, 1], ultra: [0.3, 0.5, 1], high: [], medium: [], low: [] };
const tmpM = new THREE.Matrix4();
const tmpColor = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);
/** Densidade do clima por qualidade. */
const WEATHER: Record<Quality, number> = { cinema: 1, ultra: 1, high: 1, medium: 0.5, low: 0 };
// Teto de densidade de pixels e orçamento de pixels desenhados por qualidade. Sem o orçamento,
// uma tela 4K renderiza 8 milhões de pixels em qualquer nível, e descer de Ultra para Alta
// não alivia a GPU (o custo do GTAO, do TRAA e do desfoque cresce com a área).
// O Cinema desenha 1,5× acima da densidade da tela em cada eixo (supersamplagem): até 4K × 2,25.
const DPR_MAX: Record<Quality, number> = { cinema: 3, ultra: 2, high: 2, medium: 1.5, low: 1 };
const PIXELS: Record<Quality, number> = { cinema: 3840 * 2160 * 2.25, ultra: 3840 * 2160, high: 2560 * 1440, medium: 1920 * 1080, low: 1920 * 1080 };
const SUPERSAMPLE: Record<Quality, number> = { cinema: 1.5, ultra: 1, high: 1, medium: 1, low: 1 };
/** Lado máximo de textura garantido pelo WebGPU: o desenho nunca passa disso. */
const MAX_SIDE = 8192;
/** Quanto da luz que chega ao chão ele devolve para paredes e copas (a cor vem do mapa do chão). */
const BOUNCE = 0.7;
/** Força das poças dos lampiões com a noite fechada. */
const LAMPS = 5;

function tileMatrix(q: number, r: number, rot: number, y = 0, out = new THREE.Matrix4()) {
  const { x, z } = hexToWorld(q, r);
  return out.makeRotationY((-rot * Math.PI) / 3).setPosition(x, y, z);
}

/** Interações de uma peça colocada, convertidas para a orientação de origem da peça. */
function synBase(hits: SynHit[], rot: number): { sector: number; kind: SynKind }[] {
  return hits.map((h) => ({ sector: (h.edge - rot + 6) % 6, kind: h.kind }));
}
/** Correnteza por borda (mundo) convertida para a orientação de origem da peça. */
const flowBase = (f: readonly number[], rot: number) => f.map((_, s) => f[(s + rot) % 6]);
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

  private make(cap: number, colors?: Float32Array) {
    const m = new THREE.InstancedMesh(instGeometry(this.geo, cap, colors), this.mat, cap);
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
      this.mesh = this.make(this.cap, old.geometry.getAttribute('iColor').array as Float32Array);
      (this.mesh.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
      this.parent.remove(old);
      old.geometry.dispose();
      old.dispose();
    }
    this.mesh.setMatrixAt(this.count, m);
    setInstColor(this.mesh, this.count, c);
    this.count++;
    this.mesh.count = this.count;
  }

  flush() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.getAttribute('iColor').needsUpdate = true;
  }

  dispose() {
    this.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
/** Buffer de vértices "somente acrescenta" para o chão e a água de um bloco de 8×8 peças. */
class Chunk {
  readonly ground: THREE.Mesh;
  readonly water: THREE.Mesh;
  private gPos = new Float32Array(0);
  private gCol = new Float32Array(0);
  private gSpl = new Float32Array(0);
  private wPos = new Float32Array(0);
  private wFlow = new Float32Array(0);
  private wBed = new Float32Array(0);
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
      const sp = new Float32Array(cap * 4);
      sp.set(this.gSpl.subarray(0, this.gN * 4));
      this.gPos = p;
      this.gCol = c;
      this.gSpl = sp;
      this.ground.geometry.dispose();
      this.ground.geometry.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.ground.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
      this.ground.geometry.setAttribute('splat', new THREE.BufferAttribute(sp, 4));
    }
    if (growW) {
      const cap = Math.max(1024, (this.wN + wAdd) * 2);
      const p = new Float32Array(cap * 3);
      p.set(this.wPos.subarray(0, this.wN * 3));
      const f = new Float32Array(cap * 2);
      f.set(this.wFlow.subarray(0, this.wN * 2));
      const bd = new Float32Array(cap * 4);
      bd.set(this.wBed.subarray(0, this.wN * 4));
      this.wPos = p;
      this.wFlow = f;
      this.wBed = bd;
      this.water.geometry.dispose();
      this.water.geometry.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.water.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(cap * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      this.water.geometry.setAttribute('wflow', new THREE.BufferAttribute(f, 2));
      this.water.geometry.setAttribute('wbed', new THREE.BufferAttribute(bd, 4));
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
    this.gSpl.set(b.splat, this.gN * 4);
    for (const [name, size] of [
      ['position', 3],
      ['color', 3],
      ['splat', 4],
    ] as const) {
      const a = this.ground.geometry.getAttribute(name) as THREE.BufferAttribute;
      if (!growG) a.addUpdateRange(this.gN * size, gAdd * size);
      a.needsUpdate = true;
    }
    this.gN += gAdd;
    this.ground.geometry.setDrawRange(0, this.gN);
    if (wAdd) {
      xf(b.water, this.wPos, this.wN * 3);
      // A correnteza gira junto com a peça.
      for (let i = 0; i < wAdd; i++) {
        const fx = b.wflow[i * 2], fz = b.wflow[i * 2 + 1];
        this.wFlow[(this.wN + i) * 2] = e[0] * fx + e[8] * fz;
        this.wFlow[(this.wN + i) * 2 + 1] = e[2] * fx + e[10] * fz;
      }
      this.wBed.set(b.wbed, this.wN * 4);
      const attrs: [string, number][] = [
        ['position', 3],
        ['wflow', 2],
        ['wbed', 4],
      ];
      for (const [name, size] of attrs) {
        const a = this.water.geometry.getAttribute(name) as THREE.BufferAttribute;
        if (!growW) a.addUpdateRange(this.wN * size, wAdd * size);
        a.needsUpdate = true;
      }
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

interface Drop {
  live: LiveTile;
  placed: Placed;
  t: number;
  y0: number;
  landed: boolean;
  /** Quanto tempo a peça fica viva depois de assentar (mais longo quando há obra). */
  hold: number;
  /** O andaime já desmontou (poeira lançada). */
  cleared: boolean;
}

/** Construções de interação: sobem do chão depois que a peça assenta. */
const BUILDS: ReadonlySet<string> = new Set(['logs', 'mill', 'sails', 'rotor', 'fence', 'apiary', 'landmark', 'pennant']);
/** Instante (depois de assentar) em que o andaime começa a desmontar. */
const SCAFFOLD_DOWN = 0.9;
const easeOutBack = (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);

/** Estado da iluminação: interpolado suavemente entre as horas do dia. */
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
  /** Densidade da bruma no chão e da névoa rasteira (atmosphere.ts). */
  haze: number;
  mist: number;
}

const tmpSnap = new THREE.Vector3();
const axX = new THREE.Vector3();
const axY = new THREE.Vector3();
const axZ = new THREE.Vector3();

/**
 * Leva `p` ao ponto mais perto na grade de texels de uma sombra ortográfica que olha na direção
 * `-dir` (os mesmos eixos do `lookAt` da câmera de sombra, com o "para cima" do mundo).
 */
function snapToTexel(p: THREE.Vector3, dir: THREE.Vector3, texel: number, out: THREE.Vector3) {
  axZ.copy(dir).normalize();
  axX.set(0, 1, 0).cross(axZ).normalize();
  axY.copy(axZ).cross(axX);
  const x = p.dot(axX);
  const y = p.dot(axY);
  return out.copy(p).addScaledVector(axX, Math.round(x / texel) * texel - x).addScaledVector(axY, Math.round(y / texel) * texel - y);
}

/** Matiz de uma cor (com a luminância normalizada em 1) aplicada com força `k`; `k` negativo dá o tom oposto. */
function tintOf(c: THREE.Color, k: number, out: THREE.Color) {
  const l = Math.max(1e-4, c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722);
  return out.setRGB(1 + (c.r / l - 1) * k, 1 + (c.g / l - 1) * k, 1 + (c.b / l - 1) * k);
}

function skyFor(theme: Theme, tod: TimeOfDay): Sky {
  const C = (h: string) => new THREE.Color(h);
  const mix = (a: string, b: string, t: number) => C(a).lerp(C(b), t);
  const [dx, dy, dz] = theme.sunDir;
  /** Sol com elevação `elev` e o azimute do tema girado de `turn` (graus). */
  const sunAt = (elev: number, turn: number) => {
    const a = Math.atan2(dz, dx) + THREE.MathUtils.degToRad(turn), e = THREE.MathUtils.degToRad(elev);
    return new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
  };
  if (tod === 'dawn')
    // Sol rasante do outro lado do céu, luz rosada, céu lilás e névoa no chão; algumas janelas ainda acesas.
    return {
      bg: mix(theme.bg, '#e3c6d6', 0.45),
      fill: mix(theme.voidFill, '#ead2de', 0.4),
      line: mix(theme.voidLine, '#f6e2ea', 0.35),
      sun: C('#ffc6a4'),
      sunI: theme.sunIntensity * 0.72,
      sunDir: sunAt(13, -95),
      hemiSky: mix(theme.hemiSky, '#aeb8ec', 0.5),
      hemiGround: mix(theme.hemiGround, '#56506a', 0.35),
      hemiI: theme.hemiIntensity * 0.85,
      night: 0.15,
      haze: 0.03,
      mist: 0.8,
    };
  if (tod === 'golden')
    // Fim de tarde: sol baixo e dourado, sombras compridas, ar morno.
    return {
      bg: mix(theme.bg, '#f2cf96', 0.3),
      fill: mix(theme.voidFill, '#f5d9a8', 0.26),
      line: mix(theme.voidLine, '#fbe8c4', 0.22),
      sun: C('#ffcf88'),
      sunI: theme.sunIntensity * 1.02,
      sunDir: sunAt(26, 18),
      hemiSky: mix(theme.hemiSky, '#ffdcb0', 0.35),
      hemiGround: mix(theme.hemiGround, '#6a5040', 0.25),
      hemiI: theme.hemiIntensity * 0.9,
      night: 0,
      haze: 0.022,
      mist: 0,
    };
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
      haze: 0.03,
      mist: 0.5,
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
      haze: 0.02,
      mist: 0.3,
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
    haze: 0.008,
    mist: 0,
  };
}

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  readonly rig = new CameraRig();
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
  /** Sombras em cascata do sol (Ultra e Cinema): nítidas perto da câmera, cobrindo até a névoa. */
  private csm: CSMShadowNode | null = null;
  /**
   * Luz sem intensidade que só existe para os raios de luz (Ultra e Cinema): o pós-processamento
   * percorre o mapa de sombra dela, já que as cascatas não têm um mapa único.
   */
  private rayLight = new THREE.DirectionalLight('#ffffff', 0);
  /** Luz de ambiente: céu procedural (IBL) no lugar da antiga luz hemisférica. */
  private env = new SkyEnv();
  private sky!: Sky;
  private skyTarget!: Sky;
  private voidU: ReturnType<typeof makeVoidMaterial>['u'];
  private voidMat: THREE.MeshStandardNodeMaterial;
  private slots: THREE.InstancedMesh;
  private slotMat = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.55, depthWrite: false, fog: false });
  private slotCount = 0;
  private hoverRing: THREE.Mesh;
  private hoverMat = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  private markers: THREE.Mesh[] = [];
  /** Anéis dourados que se abrem em volta da peça (encaixe perfeito, nova era); cada um com o próprio material para apagar sozinho. */
  private halos: { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicNodeMaterial>; t: number; dur: number; grow: number }[] = [];
  /** Posição das marcas de borda relativa ao fantasma (elas acompanham a peça flutuando). */
  private markerLocal: THREE.Vector3[] = [];
  private ghost: LiveTile | null = null;
  private ghostKey = '';
  private ghostTarget = new THREE.Vector3();
  private ghostAngle = 0;
  private drops: Drop[] = [];
  private sprites = new Sprites();
  private weather = new Weather();
  private fireflies = new Fireflies();
  private smokeClock = 0;
  /** Velocidade suavizada do fantasma (inclina na direção do movimento). */
  private ghostVel = new THREE.Vector2();
  private ghostPrev = new THREE.Vector3();
  private post: Post | null = null;
  private time = 0;
  /** Cor da água do tema, para o mapa do chão. */
  private waterColor = new THREE.Color();
  /** Nuvens volumétricas (clouds.ts): só com a câmera longe, numa cena que o pós compõe por cima. */
  private clouds = makeCloudMesh();
  private cloudScene = new THREE.Scene();
  private size = new THREE.Vector2(1, 1);
  /** Resolução dinâmica do modo Auto (dynres.ts): fração do lado da imagem do nível. */
  private resScale = 1;
  /** Desenho em tamanho fixo (foto e vídeo): tamanho lógico e pixels por unidade. */
  private fixed: { w: number; h: number; ratio: number } | null = null;
  /** 0 congela o mundo (modo foto); a câmera e a luz continuam respondendo. */
  timeScale = 1;
  /** Vagas da fronteira, aro e marcas do fantasma (o modo foto e o vídeo podem esconder). */
  showSlots = true;

  /** A peça da vez sobre a pilha (canvas próprio, posto no HUD por main.ts). */
  readonly preview: PreviewView;

  onBaked?: (p: Placed) => void;
  /** Depuração: efeitos ligados um a um (?fx=ao.traa.bloom.dof). */
  fx?: string[];

  /** Cria o renderizador (WebGPU ou WebGL2) e o mundo. */
  static async create(canvas: HTMLCanvasElement, forceWebGL = false) {
    const { renderer, backend } = await createRenderer(canvas, forceWebGL);
    const lib = new Lib();
    const preview = await PreviewView.create(backend === 'webgl2', lib);
    return new World(canvas, renderer, backend, lib, preview);
  }

  private constructor(
    readonly canvas: HTMLCanvasElement,
    readonly renderer: THREE.WebGPURenderer,
    readonly backend: Backend,
    readonly lib: Lib,
    preview: PreviewView,
  ) {
    this.preview = preview;
    // Sem tone mapping do renderizador: o pós-processamento aplica um ombro suave (post.ts).
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;

    this.scene.add(this.staticRoot);
    // Névoa por altura com bruma e névoa rasteira (atmosphere.ts) no lugar do THREE.Fog.
    (this.scene as THREE.Scene & { fogNode?: THREE.Node }).fogNode = fogNode;
    this.life = new Life(this.lib, this.scene);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 1.6;
    (this.sun.shadow as THREE.LightShadow & { filterNode?: unknown }).filterNode = softShadowFilter;
    this.scene.add(this.sun, this.sun.target);
    this.rayLight.castShadow = false;
    this.rayLight.shadow.mapSize.set(1024, 1024);
    this.rayLight.shadow.camera.near = 1;
    this.rayLight.shadow.camera.far = 60;
    this.scene.environment = this.env.texture;

    // Vazio com a grade hexagonal que desbota longe do tabuleiro.
    const voidM = makeVoidMaterial();
    this.voidU = voidM.u;
    this.voidMat = voidM.material;
    const voidMesh = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), voidM.material);
    voidMesh.position.y = -TILE_T - 0.03;
    voidMesh.renderOrder = -1;
    voidMesh.receiveShadow = true;
    this.scene.add(voidMesh);

    const hex = new THREE.CircleGeometry(0.9, 6).rotateX(-Math.PI / 2);
    this.slots = new THREE.InstancedMesh(hex, this.slotMat, 512);
    this.slots.count = 0;
    this.slots.frustumCulled = false;
    this.slots.position.y = -0.12;
    this.scene.add(this.slots);

    this.hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.84, 0.97, 6).rotateX(-Math.PI / 2), this.hoverMat);
    this.hoverRing.visible = false;
    this.scene.add(this.hoverRing);

    const pill = new THREE.CapsuleGeometry(0.026, 0.5, 3, 8).rotateZ(Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(pill, new THREE.MeshBasicNodeMaterial({ fog: false, transparent: true, opacity: 0.95 }));
      m.visible = false;
      this.markers.push(m);
      this.markerLocal.push(new THREE.Vector3());
      this.scene.add(m);
    }

    this.scene.add(this.sprites.group, this.weather.mesh, this.fireflies.mesh);
    this.cloudScene.add(this.clouds);
    (this.cloudScene as THREE.Scene & { fogNode?: THREE.Node }).fogNode = fogNode;
  }

  // ---------------------------------------------------------------- tema, luz, qualidade

  setTheme(theme: Theme, board: Board) {
    this.theme = theme;
    this.lib.applyTheme(theme);
    this.waterColor.set(theme.water);
    U.clouds.value = theme.period === 'futuro' ? 0.08 : 0.16;
    this.skyTarget = skyFor(theme, this.timeOfDay);
    this.sky = skyFor(theme, this.timeOfDay);
    this.applySky();
    this.preview.setTheme(theme);
    this.weather.setTheme(theme);
    this.weather.setDetail(WEATHER[this.quality]);
    // O fantasma guarda cores e decoração do tema antigo: descarta em vez de só esconder.
    this.dropGhost();
    this.clearGhost();
    // Mapa refeito do zero (outra partida, desfazer, fim de um vídeo): a onda de uma era passada não continua.
    U.eraWave.value.w = 0;
    this.rebuild(board);
  }

  /** Troca a hora do dia: a luz passa devagar para a nova, ou na hora com `instant` (vídeo). */
  setTimeOfDay(tod: TimeOfDay, instant = false) {
    this.timeOfDay = tod;
    if (!this.theme) return;
    this.skyTarget = skyFor(this.theme, tod);
    if (instant) {
      this.sky = skyFor(this.theme, tod);
      this.applySky();
    }
  }

  private applySky() {
    const s = this.sky;
    if (!(this.scene.background instanceof THREE.Color)) this.scene.background = s.bg.clone();
    else this.scene.background.copy(s.bg);
    A.bg.value.copy(s.bg);
    // A bruma tem a cor do horizonte (um pouco do céu sobre o fundo) e brilha contra o sol.
    A.haze.value.copy(s.bg).lerp(s.hemiSky, 0.3);
    // A névoa rasteira é mais clara que o fundo e pega um pouco da cor do sol.
    A.mistColor.value.copy(s.bg).lerp(WHITE, 0.3 * (1 - s.night * 0.7)).add(tmpColor.copy(s.sun).multiplyScalar(0.05 * s.sunI * (1 - s.night)));
    A.glow.value.copy(s.sun).multiplyScalar(0.12 * s.sunI);
    A.hazeDensity.value = s.haze;
    A.mist.value = s.mist;
    // Luz que o chão recebe (o sol pela altura dele e o céu), devolvida na cor do mapa do chão.
    const up = Math.max(0, s.sunDir.y / s.sunDir.length());
    U.bounce.value.copy(s.sun).multiplyScalar(s.sunI * up).add(tmpColor.copy(s.hemiSky).multiplyScalar(s.hemiI)).multiplyScalar(BOUNCE);
    U.lamps.value = THREE.MathUtils.smoothstep(s.night, 0.25, 0.9) * LAMPS;
    // Nuvens: o topo ao sol um pouco mais claro que o fundo do tema, a base na cor do chão.
    CL.sun.value.copy(s.sun).multiplyScalar(s.sunI * 0.42);
    CL.sky.value.copy(s.hemiSky).multiplyScalar(s.hemiI * 0.35);
    CL.ground.value.copy(s.hemiGround).multiplyScalar(s.hemiI * 0.18);
    this.voidU.bg.value.copy(s.bg);
    this.voidU.fill.value.copy(s.fill);
    this.voidU.line.value.copy(s.line);
    this.slotMat.color.copy(s.line);
    this.slotMat.opacity = 0.55 - s.night * 0.3;
    this.sun.color.copy(s.sun);
    this.sun.intensity = s.sunI;
    U.sun.value.copy(s.sun);
    U.sunDir.value.copy(s.sunDir).normalize();
    this.envColors.zenith.copy(s.hemiSky).multiply(ZENITH_TINT);
    this.envColors.horizon.copy(s.hemiSky).lerp(s.bg, 0.45);
    this.envColors.ground.copy(s.hemiGround);
    this.envColors.sun.copy(s.sun).multiplyScalar(s.sunI * 0.12);
    this.envColors.sunDir.copy(s.sunDir);
    this.envColors.intensity = s.hemiI;
    this.env.update(this.envColors);
    U.night.value = s.night;
  }

  private envColors = { zenith: new THREE.Color(), horizon: new THREE.Color(), ground: new THREE.Color(), sun: new THREE.Color(), sunDir: new THREE.Vector3(), intensity: 1 };

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
    a.haze += (b.haze - a.haze) * k;
    a.mist += (b.mist - a.mist) * k;
    this.applySky();
  }

  setQuality(q: Quality) {
    const detailChanged = DETAIL[q] !== DETAIL[this.quality];
    const postChanged = q !== this.quality || !this.post;
    this.quality = q;
    const shadows = q !== 'low';
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      // Materiais precisam recompilar quando sombras ligam/desligam.
      this.recompile();
    }
    this.sun.castShadow = shadows;
    const map = SHADOW_MAP[q];
    if (this.sun.shadow.mapSize.x !== map) {
      this.sun.shadow.mapSize.set(map, map);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.setCascades(CASCADES[q]);
    this.weather.setDetail(WEATHER[q]);
    if (postChanged) {
      this.post?.dispose();
      const rays = CASCADES[q].length > 0 && (!this.fx || this.fx.includes('rays'));
      this.setRayLight(rays);
      this.post = q === 'low' ? null : buildPost(this.renderer, this.scene, this.camera, q, this.fx, rays ? this.rayLight : undefined, this.cloudScene);
      CL.temporal.value = this.post?.temporal ? 1 : 0;
      // O vazio quase todo emissivo clarearia a luz indireta: ele não entra como cor difusa,
      // e o alfa 1 mantém a oclusão inteira nele, como nos materiais sem luz indireta separada.
      // Só vale com a saída `diffuse` na cena (sem ela, o mrtNode viraria a única saída).
      const voidMrt = this.post?.gi ? mrt({ diffuse: vec4(0, 0, 0, 1) }) : null;
      if (this.voidMat.mrtNode !== voidMrt) {
        this.voidMat.mrtNode = voidMrt;
        this.voidMat.needsUpdate = true;
      }
    }
    if (detailChanged && this.board && this.theme) {
      this.dropGhost();
      this.rebuild(this.board);
    }
    this.resize();
  }

  /** Liga, troca ou desliga as cascatas; os materiais recompilam para trocar o nó de sombra. */
  private cascadeSplits: number[] = [];
  private setCascades(splits: number[]) {
    if (splits.join() === this.cascadeSplits.join()) return;
    this.cascadeSplits = splits;
    if (this.csm) {
      (this.sun.shadow as THREE.LightShadow & { shadowNode?: unknown }).shadowNode = undefined;
      this.csm.dispose();
      this.csm = null;
    }
    if (splits.length) {
      // A cascata nasce como cópia da sombra do sol (filtro, viés), então vem depois do mapSize.
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 200;
      // A câmera orbita olhando para baixo: perto dela só há ar. As divisões se concentram
      // em volta do alvo (frações de maxFar, que world.tick mantém em ~4,7× a distância).
      this.csm = new CSMShadowNode(this.sun, {
        cascades: splits.length,
        maxFar: 60,
        mode: 'custom',
        lightMargin: 40,
        customSplitsCallback: (_n: number, _near: number, _far: number, out: number[]) => out.push(...splits),
      });
      this.csm.fade = true;
      (this.sun.shadow as THREE.LightShadow & { shadowNode?: unknown }).shadowNode = this.csm;
    } else {
      this.sun.shadow.camera.far = 60;
    }
    this.recompile();
  }

  private setRayLight(on: boolean) {
    if (on === !!this.rayLight.parent) return;
    this.rayLight.castShadow = on;
    if (on) this.scene.add(this.rayLight, this.rayLight.target);
    else this.scene.remove(this.rayLight, this.rayLight.target);
    this.recompile();
  }

  private recompile() {
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
  }

  /** Resolução dinâmica: escala do lado da imagem (1 = a do nível). */
  setResolutionScale(s: number) {
    if (s === this.resScale) return;
    this.resScale = s;
    this.resize();
  }

  /**
   * Desenha num tamanho fixo, sem olhar a janela (foto e vídeo): `w`×`h` lógicos com `ratio`
   * pixels por unidade, que é a supersamplagem. `null` volta ao tamanho da tela.
   */
  setFixedSize(size: { w: number; h: number; ratio: number } | null) {
    this.fixed = size;
    this.resize();
  }

  resize() {
    let w: number, h: number, dpr: number, cell: number;
    if (this.fixed) {
      ({ w, h } = this.fixed);
      dpr = Math.min(this.fixed.ratio, MAX_SIDE / Math.max(w, h));
      cell = dpr;
    } else {
      w = this.canvas.clientWidth || window.innerWidth;
      h = this.canvas.clientHeight || window.innerHeight;
      const q = this.quality;
      dpr = Math.min((window.devicePixelRatio || 1) * SUPERSAMPLE[q], DPR_MAX[q], Math.sqrt(PIXELS[q] / (w * h)), MAX_SIDE / Math.max(w, h)) * this.resScale;
      cell = dpr / (window.devicePixelRatio || 1);
    }
    this.size.set(w, h);
    this.renderer.setPixelRatio(Math.max(0.5, dpr));
    // O grão do Cinema tem o tamanho de um pixel da tela ou do vídeo (post.ts).
    P.grainCell.value = Math.max(1, cell);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- mapa

  private build(def: TileDef, synergies: { sector: number; kind: SynKind }[], flow?: number[], extra?: { center?: boolean; eraMark?: number }) {
    return buildTile(def.edges, def.seed, this.theme, { detail: DETAIL[this.quality], synergies, houses: this.lib.houseMeta, flow, ...extra });
  }

  /** Peça do mapa já colocada: a inicial reserva o Centro, e a do marco o ergue. */
  private buildPlaced(p: Placed) {
    return this.build(p.def, synBase(p.synergies, p.rot), this.settleFlow(p), { center: p.index === 0, eraMark: p.eraMark });
  }

  /**
   * Sentido da correnteza (por borda, no mundo) de uma peça em (q, r): herda das vizinhas
   * já colocadas, para o rio descer na mesma direção de peça em peça. Peças assentadas
   * nunca mudam; se duas correntezas opostas se encontram, a peça nova vira remanso.
   */
  private flows = new Map<number, number[]>();
  private flowAt(q: number, r: number, edges: readonly T[]) {
    const known = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6; i++) {
      if (edges[i] !== T.Water) continue;
      const nf = this.flows.get(hkey(q + DIRS[i][0], r + DIRS[i][1]));
      if (nf && nf[opposite(i)]) known[i] = -nf[opposite(i)];
    }
    return resolveFlow(edges, known);
  }

  /** Registra a correnteza de uma peça colocada e devolve a versão na orientação de origem. */
  private settleFlow(p: Placed) {
    const wf = this.flowAt(p.q, p.r, p.edges);
    this.flows.set(p.key, wf);
    return flowBase(wf, p.rot);
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
    this.sprites.clear();
    this.life.reset(this.theme);
    this.flows.clear();
    groundMap.clear();
    for (const p of board.list) this.bake(p, this.buildPlaced(p), false);
    for (const pool of this.pools.values()) pool.flush();
    this.updateFrontier(board);
    this.life.sync(board);
    this.fireflies.sync(board);
    this.centerAnim = -1;
    this.setCenter(board.era);
  }

  // ---------------------------------------------------------------- Centro da vila

  private center: THREE.InstancedMesh | null = null;
  private centerEra = -1;
  /** Tempo desde o avanço de era (-1 = parado) e a era que o Centro vai mostrar. */
  private centerAnim = -1;
  private centerNext = 0;

  /** O Centro é um objeto avulso sobre a peça inicial, fora dos pools: trocar de era não reconstrói nada. */
  private setCenter(era: number) {
    if (this.center) {
      this.staticRoot.remove(this.center);
      this.center.geometry.dispose();
      this.center.dispose();
      this.center = null;
    }
    this.centerEra = era;
    const geo = this.lib.geo(`center:${era}`);
    if (!geo) return;
    const m = new THREE.InstancedMesh(instGeometry(geo, 1), this.lib.material('center'), 1);
    m.setMatrixAt(0, tmpM.identity());
    m.castShadow = this.quality !== 'low';
    m.receiveShadow = true;
    m.computeBoundingSphere();
    this.staticRoot.add(m);
    this.center = m;
  }

  /**
   * Avanço de era: o Centro afunda, volta na forma nova (com poeira), e uma onda dourada
   * corre pelo mapa a partir dele.
   */
  eraUp(era: number) {
    this.centerNext = era;
    this.centerAnim = 0;
    U.eraWave.value.set(0, 0, this.time, 1);
  }

  /** Depuração: o Centro numa era, parado, e a onda dourada já com `waveAge` segundos (negativo = sem onda). */
  showEra(era: number, waveAge = -1) {
    this.centerAnim = -1;
    this.setCenter(era);
    if (waveAge >= 0) U.eraWave.value.set(0, 0, this.time - waveAge, 1);
  }

  private stepCenter(dt: number) {
    if (this.centerAnim < 0 || !this.center) return;
    const t = (this.centerAnim += dt);
    const SINK = 0.22, RISE = 0.9;
    let xz = 1, y = 1;
    if (t < SINK) y = Math.max(0.02, 1 - (t / SINK) ** 2);
    else {
      if (this.centerEra !== this.centerNext) {
        this.setCenter(this.centerNext);
        this.burst(0, 0, 'dust', 34);
      }
      const b = Math.min(1, (t - SINK) / RISE);
      y = Math.max(0.02, easeOutBack(b));
      xz = 0.7 + 0.3 * Math.min(1, b * 1.6);
      if (b >= 1) this.centerAnim = -1;
    }
    this.center?.setMatrixAt(0, tmpM.makeScale(xz, y, xz));
    if (this.center) this.center.instanceMatrix.needsUpdate = true;
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
      const fine = key.endsWith('~');
      const base = fine ? key.slice(0, -1) : key;
      const geo = this.lib.geo(base);
      if (!geo) return null;
      p = new Pool(geo, fine ? this.lib.fineMaterial(base) : this.lib.material(base), this.staticRoot, this.lib.castsShadow(base));
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
    groundMap.add(b, m, this.waterColor);
    for (const d of b.decos) {
      if (d.transient) continue;
      decoMatrix(d, tmpM);
      tmpM.premultiply(m);
      if (this.lib.lit(d.key)) {
        // Uma poça por casa com janela, umas mais fortes que outras (sorteio pela posição).
        const x = tmpM.elements[12], z = tmpM.elements[14];
        const h = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
        groundMap.lantern(x, z, 0.28 + 0.2 * h);
      }
      if (d.anim === 'spin-z' || d.anim === 'spin-x') this.life.addSpinner(d.key, tmpM, d.anim === 'spin-x' ? 'x' : 'z');
      else if (d.anim === 'wander') this.life.addAnimal(tmpM, d.color);
      else if (d.anim === 'chop' || d.anim === 'tend' || d.anim === 'carry') this.life.addWorker(d.key, tmpM, d.color, d.anim);
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
    this.voidU.radius.value = maxR + 1;
    this.rig.bounds = maxR;
  }

  /** Coloca com animação: a peça assenta, levanta poeira e depois é "cozida" no bloco. */
  placeAnimated(p: Placed) {
    const syn = synBase(p.synergies, p.rot);
    const flow = this.settleFlow(p);
    const sig = `${synSig(syn)}|${flow.join('')}|${p.eraMark ?? ''}`;
    let live: LiveTile;
    let y0 = 1.2;
    if (this.ghost && this.ghost.def === p.def && this.ghost.sig === sig) {
      live = this.ghost;
      y0 = live.group.position.y;
      this.ghost = null;
      this.ghostKey = '';
    } else {
      live = new LiveTile(p.def, this.build(p.def, syn, flow, { eraMark: p.eraMark }), sig, this.lib, this.quality !== 'low');
      this.scene.add(live.group);
      this.dropGhost();
    }
    live.inner.rotation.y = (-p.rot * Math.PI) / 3;
    const { x, z } = hexToWorld(p.q, p.r);
    live.group.position.set(x, y0, z);
    this.hoverRing.visible = false;
    for (const m of this.markers) m.visible = false;
    this.drops.push({ live, placed: p, t: 0, y0, landed: false, hold: live.has(BUILDS) ? SCAFFOLD_DOWN + 0.3 : 0.55, cleared: false });
  }

  /** Coloca várias peças de uma vez, sem animação (modo automático / teste de carga). */
  placeInstant(list: Placed[], board: Board) {
    for (const p of list) this.bake(p, this.buildPlaced(p), false);
    for (const pool of this.pools.values()) pool.flush();
    this.updateFrontier(board);
    this.life.sync(board);
    this.fireflies.sync(board);
  }

  // ---------------------------------------------------------------- fantasma

  setGhost(def: TileDef, rot: number, angle: number, q: number, r: number, check: Check) {
    const syn = check.valid ? synBase(check.synergies, rot) : [];
    const flow = flowBase(this.flowAt(q, r, rotateEdges(def.edges, rot)), rot);
    // O fantasma já mostra o marco da era que a peça ergueria.
    const mark = check.valid ? (check.eraMark ?? undefined) : undefined;
    const sig = `${synSig(syn)}|${flow.join('')}|${mark ?? ''}`;
    const key = `${def.seed}:${this.theme.id}:${sig}`;
    if (!this.ghost || this.ghostKey !== key) {
      const old = this.ghost;
      this.ghost = new LiveTile(def, this.build(def, syn, flow, { eraMark: mark }), sig, this.lib, this.quality !== 'low');
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
        this.ghostPrev.copy(this.ghost.group.position);
        this.ghostVel.set(0, 0);
      }
      old?.dispose();
    }
    this.ghost.group.visible = true;
    this.ghostAngle = angle;
    const { x, z } = hexToWorld(q, r);
    this.ghostTarget.set(x, 0.32, z);
    this.hoverRing.visible = true;
    this.hoverRing.position.set(x, -0.1, z);
    this.hoverMat.color.set(check.valid ? '#ffffff' : '#ff5a4f');
    for (let i = 0; i < 6; i++) {
      const m = this.markers[i];
      const s = check.edgeState[i];
      m.visible = s === 1 || s === 3 || s === 4;
      if (!m.visible) continue;
      const [mx, mz] = edgeMid(i);
      this.markerLocal[i].set(mx * 0.93, 0.03, mz * 0.93);
      m.rotation.y = -(Math.PI / 6 + (Math.PI / 3) * i) + Math.PI / 2;
      (m.material as THREE.MeshBasicNodeMaterial).color.set(s === 1 ? '#ffffff' : s === 4 ? '#ffc83d' : '#ff4a3d');
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

  /** Anel dourado que sai das bordas da peça e se apaga; acima de 1 a cor alimenta o bloom. */
  halo(x: number, z: number, strength = 1) {
    let h = this.halos.find((o) => !o.mesh.visible);
    if (!h) {
      if (this.halos.length >= 6) h = this.halos[0];
      else {
        const geo = this.halos[0]?.mesh.geometry ?? new THREE.RingGeometry(0.93, 1.0, 6, 1).rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 2;
        this.scene.add(mesh);
        h = { mesh, t: 0, dur: 1, grow: 1 };
        this.halos.push(h);
      }
    }
    h.mesh.material.color.copy(tc(this.theme.sparkle)).multiplyScalar(1.1 + strength * 0.4);
    h.mesh.position.set(x, 0.06, z);
    h.mesh.visible = true;
    h.t = 0;
    h.dur = 0.8 + strength * 0.35;
    h.grow = 0.35 + strength * 0.4;
  }

  /**
   * Efeitos de uma jogada no mapa: brilhos do encaixe perfeito, do marco da era, das peças
   * cercadas, das missões e dos sítios, e a festa da nova era (o Centro muda de forma e a onda
   * dourada corre). O jogo e o vídeo usam os mesmos.
   */
  placeFx(res: PlaceResult) {
    const { x, z } = hexToWorld(res.placed.q, res.placed.r);
    if (res.perfect) {
      this.burst(x, z, 'sparkle', 26);
      this.halo(x, z);
    }
    if (res.placed.eraMark !== undefined) {
      this.burst(x, z, 'sparkle', 30, 0.3);
      this.halo(x, z, 1.5);
    }
    for (const t of res.closed) {
      const w = hexToWorld(t.q, t.r);
      this.burst(w.x, w.z, 'sparkle', 16);
    }
    for (const q of res.questsDone) {
      const w = hexToWorld(q.anchor.q, q.anchor.r);
      this.burst(w.x, w.z, 'sparkle', 40);
    }
    if (res.site) this.burst(x, z, 'sparkle', 46);
    if (res.eraUp !== null) {
      this.eraUp(res.eraUp);
      this.ripple(x, z, 2.2);
      this.burst(x, z, 'sparkle', 60);
      this.halo(x, z, 2);
      this.flushBirds(x, z);
    }
  }

  /** Bando de pássaros que levanta voo do lugar (marcos da partida). */
  flushBirds(x: number, z: number) {
    this.life.flush(x, z);
  }

  private stepHalos(dt: number) {
    for (const h of this.halos) {
      if (!h.mesh.visible) continue;
      h.t += dt;
      const u = Math.min(1, h.t / h.dur);
      const e = 1 - Math.pow(1 - u, 3);
      h.mesh.scale.setScalar(1 + e * h.grow);
      h.mesh.material.opacity = (1 - u) * (1 - u);
      if (u >= 1) h.mesh.visible = false;
    }
  }

  burst(x: number, z: number, kind: 'dust' | 'sparkle', n: number, y = 0) {
    if (kind === 'dust') this.sprites.dust(x, z, tc(this.theme.smoke), n);
    else this.sprites.sparkle(x, z, tc(this.theme.sparkle), n, y);
  }

  private spawnSmoke(dt: number) {
    const n = this.chimneys.length / 3;
    if (!n || this.sprites.count > 380) return;
    this.smokeClock += dt * Math.min(n * 0.25, 7);
    const tx = this.rig.target.x, tz = this.rig.target.z;
    const view = this.rig.dist * 1.1;
    while (this.smokeClock > 1) {
      this.smokeClock -= 1;
      for (let tries = 0; tries < 6; tries++) {
        const i = Math.floor(Math.random() * n) * 3;
        const x = this.chimneys[i], y = this.chimneys[i + 1], z = this.chimneys[i + 2];
        if (Math.abs(x - tx) > view || Math.abs(z - tz) > view) continue;
        this.sprites.smoke(x, y, z, tc(this.theme.smoke), U.wind.value);
        break;
      }
    }
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

  // Chamado a cada quadro para cada marcador do HUD: reaproveita o vetor.
  private projV = new THREE.Vector3();
  project(x: number, y: number, z: number) {
    const v = this.projV.set(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.size.x, y: (-v.y * 0.5 + 0.5) * this.size.y, visible: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 };
  }

  /** Custo por kit: instâncias e triângulos (para achar o que pesa). */
  poolReport() {
    return [...this.pools.entries()]
      .map(([k, p]) => {
        const base = k.endsWith('~') ? k.slice(0, -1) : k;
        return { k, n: p.count, tris: (p.count * (this.lib.geo(base)?.attributes.position.count ?? 0)) / 3, shadow: p.mesh.castShadow };
      })
      .sort((a, b) => b.tris - a.tris);
  }

  stats() {
    const info = this.renderer.info;
    let tris = 0;
    for (const c of this.chunks.values()) tris += c.triangles();
    let inst = 0;
    for (const p of this.pools.values()) inst += p.count;
    return { calls: info.render.drawCalls, triangles: info.render.triangles, chunks: this.chunks.size, instances: inst, groundTris: tris, life: this.life.counts(), backend: this.backend };
  }

  setPreview(def: TileDef | null, angle: number, stack: number) {
    this.preview.set(def, () => this.build(def!, []), angle, stack);
  }

  /** Depuração visual: todos os kits do tema lado a lado (?gallery). */
  showGallery() {
    const keys = [...this.lib.geos.keys()];
    const cols = Math.ceil(Math.sqrt(keys.length));
    const root = new THREE.Group();
    keys.forEach((k, i) => {
      const geo = this.lib.geo(k)!;
      const mesh = new THREE.InstancedMesh(instGeometry(geo, 1), this.lib.material(k), 1);
      const x = (i % cols) * 0.45, z = Math.floor(i / cols) * 0.45;
      const s = k.startsWith('crop:') || k === 'grass' || k === 'flower' ? 2.2 : 1.4;
      mesh.setMatrixAt(0, tmpM.makeScale(s, s, s).setPosition(x - (cols * 0.45) / 2, 0, z - (cols * 0.45) / 2));
      mesh.castShadow = true;
      root.add(mesh);
    });
    const floorMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.9 });
    floorMat.colorNode = vec3(0.48, 0.58, 0.28);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(cols * 0.5, cols * 0.5).rotateX(-Math.PI / 2), floorMat);
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

  /** Eixos da câmera, foco e escala para as partículas, e a luz que elas recebem. */
  private updateFxUniforms() {
    const e = this.camera.matrixWorld.elements;
    FX.right.value.set(e[0], e[1], e[2]);
    FX.up.value.set(e[4], e[5], e[6]);
    FX.focus.value.copy(this.rig.target);
    const d = this.rig.dist;
    FX.box.value.set(THREE.MathUtils.clamp(d * 1.25, 5, 32), THREE.MathUtils.clamp(d * 0.42, 1.8, 7));
    FX.scale.value = 0.55 + d / 13;
    const s = this.sky;
    FX.ambient.value.copy(s.hemiSky).multiplyScalar(0.45 * s.hemiI).add(tmpColor.copy(s.sun).multiplyScalar(0.3 * s.sunI));
  }

  /** Onda que corre pelo chão em volta da peça que acabou de assentar. */
  ripple(x: number, z: number, strength = 1, age = 0) {
    U.ripple.value.set(x, z, this.time - age, strength);
  }

  tick(realDt: number) {
    this.renderer.info.reset();
    // A câmera, o fantasma e a troca de hora seguem o tempo real; o resto, o tempo do mundo.
    const dt = realDt * this.timeScale;
    this.time += dt;
    U.time.value = this.time;
    U.dt.value = Math.max(dt, 1e-4);
    // O vento muda de direção devagar.
    const wa = 0.65 + Math.sin(this.time * 0.05) * 0.5;
    U.wind.value.set(Math.cos(wa), Math.sin(wa));
    this.stepSky(realDt);
    this.rig.update(realDt);
    this.rig.apply(this.camera);

    A.near.value = this.rig.dist * 1.5;
    A.far.value = this.rig.dist * 4.2;
    groundMap.flush();
    // As nuvens aparecem quando a câmera sobe bem acima delas (não no nível Baixo).
    CL.fade.value = this.quality === 'low' ? 0 : THREE.MathUtils.smoothstep(this.rig.dist, 20, 28);
    CL.focus.value.set(this.rig.target.x, this.rig.target.z, this.rig.dist);
    this.clouds.visible = CL.fade.value > 1e-3;

    // Foco da profundidade de campo: o ponto que a câmera olha.
    P.focus.value = this.rig.dist;
    // De longe a faixa nítida estreita: o mapa inteiro vira maquete (tilt-shift).
    P.focalLength.value = this.rig.dist * THREE.MathUtils.lerp(0.42, 0.16, THREE.MathUtils.smoothstep(this.rig.dist, 10, 30));
    // O traço é pleno em volta do foco e some antes da névoa, senão o fundo vira hachura.
    P.inkNear.value = this.rig.dist * 1.6;
    P.inkFar.value = this.rig.dist * 3.2;
    // Gradação: realces na cor do sol e sombras no tom oposto (frias com o sol quente da tarde).
    const day = 1 - this.sky.night;
    tintOf(this.sky.sun, -0.14 * day, P.shade.value);
    tintOf(this.sky.sun, 0.08 * day, P.light.value);

    // Sol acompanha o alvo; área da sombra acompanha o zoom.
    const sd = this.sky.sunDir;
    const ext = Math.min(28, this.rig.dist * 0.95 + 2);
    // Sem cascatas, o centro da sombra anda de texel em texel no plano da luz: as bordas não
    // tremem quando a câmera desliza (as cascatas do Ultra já se prendem à grade sozinhas).
    const t = this.csm ? this.rig.target : snapToTexel(this.rig.target, sd, (2 * ext) / this.sun.shadow.mapSize.x, tmpSnap);
    this.sun.target.position.copy(t);
    this.sun.position.set(t.x + sd.x * 20, t.y + sd.y * 20, t.z + sd.z * 20);
    if (this.csm) {
      // As cascatas vão da câmera até onde a névoa fecha; acompanham o zoom.
      const far = Math.round(this.rig.dist * 4.7 * 4) / 4;
      if (this.csm.maxFar !== far && this.csm.camera) {
        this.csm.maxFar = far;
        this.csm.updateFrustums();
      }
    }
    if (this.rayLight.parent) {
      this.rayLight.target.position.copy(t);
      this.rayLight.position.copy(this.sun.position);
      const rc = this.rayLight.shadow.camera;
      if (rc.right !== ext) {
        rc.left = -ext;
        rc.right = ext;
        rc.top = ext;
        rc.bottom = -ext;
        rc.updateProjectionMatrix();
      }
      // Feixes só com o sol baixo (entardecer): ao meio-dia viram um véu branco sem forma.
      const low = 1 - THREE.MathUtils.clamp(sd.y / Math.max(1e-3, Math.hypot(sd.x, sd.y, sd.z)), 0, 1);
      P.rays.value = THREE.MathUtils.clamp((low - 0.25) / 0.4, 0, 1) * 0.4 * (1 - this.sky.night) * Math.min(1, this.sky.sunI);
      P.rayColor.value.copy(this.sky.sun);
    }
    const cam = this.sun.shadow.camera;
    if (!this.csm && cam.right !== ext) {
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
      const k = 1 - Math.exp(-realDt * 16);
      g.position.x += (this.ghostTarget.x - g.position.x) * k;
      g.position.z += (this.ghostTarget.z - g.position.z) * k;
      g.position.y += (this.ghostTarget.y + Math.sin(this.time * 2.4) * 0.025 - g.position.y) * k;
      const inner = this.ghost.inner;
      inner.rotation.y += (-this.ghostAngle - inner.rotation.y) * (1 - Math.exp(-realDt * 18));
      // Inclina na direção em que desliza, como uma bandeja carregada.
      const kv = 1 - Math.exp(-realDt * 10);
      this.ghostVel.x += ((g.position.x - this.ghostPrev.x) / Math.max(realDt, 1e-3) - this.ghostVel.x) * kv;
      this.ghostVel.y += ((g.position.z - this.ghostPrev.z) / Math.max(realDt, 1e-3) - this.ghostVel.y) * kv;
      this.ghostPrev.copy(g.position);
      g.rotation.x = THREE.MathUtils.clamp(this.ghostVel.y * 0.035, -0.22, 0.22);
      g.rotation.z = THREE.MathUtils.clamp(-this.ghostVel.x * 0.035, -0.22, 0.22);
      for (let i = 0; i < 6; i++) if (this.markers[i].visible) this.markers[i].position.copy(g.position).add(this.markerLocal[i]);
    }

    this.stepHalos(dt);
    this.stepCenter(dt);

    // Peças caindo.
    const still: Drop[] = [];
    for (const d of this.drops) {
      d.t += dt;
      const g = d.live.group;
      // A inclinação do fantasma se desfaz na queda.
      g.rotation.x *= Math.exp(-dt * 14);
      g.rotation.z *= Math.exp(-dt * 14);
      const fall = 0.16;
      if (d.t < fall) {
        const u = d.t / fall;
        g.position.y = d.y0 * (1 - u * u);
      } else {
        // Assenta com um quique pequeno.
        const ub = Math.min(1, (d.t - fall) / 0.34);
        g.position.y = 0.022 * Math.abs(Math.sin(ub * Math.PI)) * (1 - ub);
        if (!d.landed) {
          d.landed = true;
          this.burst(g.position.x, g.position.z, 'dust', 22);
          this.ripple(g.position.x, g.position.z);
        }
        const u = (d.t - fall) / 0.32;
        g.scale.set(1 + Math.sin(Math.min(1, u) * Math.PI) * 0.03, 1 - Math.sin(Math.min(1, u) * Math.PI) * 0.08, 1 + Math.sin(Math.min(1, u) * Math.PI) * 0.03);
        const tt = d.t - fall;
        if (!d.cleared && tt >= SCAFFOLD_DOWN) {
          // A obra acabou: o andaime some numa nuvem de poeira.
          d.cleared = true;
          for (const p of d.live.worldOf('scaffold')) this.burst(p.x, p.z, 'dust', 8);
        }
        d.live.setDecoScale((i, n, key) => {
          if (key === 'scaffold') {
            // Andaime: firme enquanto a obra sobe; depois desmonta para baixo em 0,2 s.
            const k = Math.max(0, Math.min(1, (tt - SCAFFOLD_DOWN) / 0.2));
            return [1, Math.max(0.001, 1 - k * k), 1];
          }
          if (BUILDS.has(key)) {
            // Obra: sobe do chão com um leve passo além do ponto e assenta.
            const b = Math.max(0, Math.min(1, (tt - 0.08) / 0.8));
            const y = Math.max(0.02, easeOutBack(b));
            const xz = 0.7 + 0.3 * Math.min(1, b * 1.6);
            return [xz, y, xz];
          }
          const local = Math.max(0, Math.min(1, (tt - (i / n) * 0.18) / 0.3));
          return 1 + Math.sin(local * Math.PI) * 0.18;
        });
      }
      if (d.t > fall + d.hold) {
        this.bake(d.placed, d.live.build);
        d.live.dispose();
        if (this.board) {
          this.life.sync(this.board);
          this.fireflies.sync(this.board);
        }
        this.onBaked?.(d.placed);
      } else still.push(d);
    }
    this.drops = still;

    // Nível de detalhe: de longe, metade das plantas basta (as parcelas já têm a cor da cultura).
    // Entre 11,5 e 14,5 de distância, cada planta dessa metade afunda no chão na sua vez.
    const fine = 1 - THREE.MathUtils.smoothstep(this.rig.dist, 11.5, 14.5);
    U.fine.value = fine;
    for (const [k, p] of this.pools) if (k.endsWith('~')) p.mesh.visible = fine > 0;

    // Aldeões só de perto, com o mesmo limiar da metade fina das plantas.
    this.life.folkNear = this.rig.dist < 13;
    this.life.night = U.night.value;
    this.life.update(dt);
    this.life.wakes(this.rig.target.x, this.rig.target.z);
    this.spawnSmoke(dt);
    this.sprites.update(dt);
    this.updateFxUniforms();
    this.slots.visible = this.slotCount > 0 && this.showSlots;
    // Grão do Cinema: um padrão novo a cada quadro (passageiro, não precisa de semente).
    P.grainSeed.value = Math.floor(Math.random() * 3e6);

    if (this.post) this.post.pipeline.render();
    else this.renderer.render(this.scene, this.camera);

    this.preview.render(realDt);
  }
}
