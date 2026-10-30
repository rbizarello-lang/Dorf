import * as THREE from 'three/webgpu';
import { mrt, vec3, vec4 } from 'three/tsl';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Board, Check, PlaceResult, Placed } from '../core/board';
import type { WaterState } from '../core/water';
import { EggTracker, phaseOfTod, type EggSpec } from '../core/eggs';
import { DIRS, edgeMid, hexToWorld, hkey, opposite, unkey, worldToHex } from '../core/hex';
import { levelAt, tileProfile, worldHeights } from '../core/relief';
import { seasonAt } from '../core/seasons';
import type { SiteKind } from '../core/sites';
import type { SynHit, SynKind } from '../core/synergy';
import { T, isStrict, rotateEdges, type TileDef } from '../core/tiles';
import type { Theme } from '../themes/types';
import { CameraRig, FOV } from './cameraRig';
import { createRenderer, type Backend } from './gpu';
import { Lib, WONDER_PODIUM, instGeometry, postStampGeometry, setInstColor, stampGeometry } from './lib';
import { Life } from './life';
import { CLOUD_TOP, U, makeVoidMaterial, slotAlpha, slotBlob, softShadowFilter } from './materials';
import { A, fogNode } from './atmosphere';
import { CL, makeCloudMesh } from './clouds';
import { seaMap } from './seaMap';
import { riverMap } from './riverMap';
import { makeAuroraDome } from './aurora';
import { groundMap } from './groundMap';
import { P, buildPost, type Post, type Quality } from './post';
import { SkyEnv } from './sky';
import { FX, Fireflies, Sprites, Weather } from './fx';
import { LiveTile } from './liveTile';
import { PreviewView } from './preview';
import { FallLayer } from './falls';
import { FALL_D } from './relief';
import { skirtWidth } from './terrain';
import { Warp, isWarped, warpBuild } from './fluid';
import { LEVEL_STEP, TILE_T, buildTile, decoMatrix, resolveFlow, tc, waterShape, WATER_Y, type BuildOpts, type TileBuild } from './tileBuilder';
import { NIGHT_LIGHT } from './nightLight';

export type { Quality };
export type TimeOfDay = 'dawn' | 'aurora' | 'day' | 'golden' | 'dusk' | 'night';

const CHUNK = 8;
/**
 * Decoração em super-blocos de 32×32, centrados na vila. Uma partida redonda de até
 * ~700 peças cabe num lote por kit (as chamadas não sobem). O mapa maior transborda,
 * e a câmera (e a sombra) deixam de desenhar o bloco fora de vista.
 */
const REGION = 32;
/**
 * O super-bloco central se estende `REGION_MARGIN` além das bordas: o mapa que passa um pouco de 32 de largura (o Relevo estica para
 * um lado) não abre um lote novo de cada kit só para as peças da ponta, o que somava dezenas de chamadas de desenho.
 */
const REGION_MARGIN = 6;
const regionOf = (v: number) => (v >= -REGION / 2 - REGION_MARGIN && v < REGION / 2 + REGION_MARGIN ? 0 : Math.floor((v + REGION / 2) / REGION));
/** A chave do lote é `kit@cq,cr`. O kit pode ter `:` (`wall:0`), nunca `@`. */
function poolKey(id: string) {
  const at = id.lastIndexOf('@');
  return at < 0 ? id : id.slice(0, at);
}
/** O alto do céu um pouco mais azul que a cor "do céu" do tema (que é quase branca). */
const ZENITH_TINT = new THREE.Color(0.86, 0.93, 1.08);
// Ultra e Cinema passam de 1: mais árvores, capim e plantações de perto (alvo: GPUs acima da atual).
const DETAIL: Record<Quality, number> = { cinema: 1.6, ultra: 1.35, high: 1, medium: 0.65, low: 0.4 };
/** Mapa de sombra por nível. No Ultra e no Cinema, cada uma das cascatas tem esse tamanho. */
// Conta os draw calls dos passes de sombra (um por cascata redesenhada): é o que mostra, em
// `stats().shadowDraws`, que num quadro parado o mapa guardado não é refeito.
const shadowCount = { draws: 0, passes: 0, patched: false };
function countShadowPasses(renderer: THREE.WebGPURenderer) {
  if (shadowCount.patched) return;
  shadowCount.patched = true;
  const proto = THREE.ShadowNode.prototype as unknown as { renderShadow(frame: unknown): void };
  const orig = proto.renderShadow;
  proto.renderShadow = function (this: unknown, frame: unknown) {
    const before = renderer.info.render.drawCalls;
    orig.call(this, frame);
    shadowCount.draws += renderer.info.render.drawCalls - before;
    shadowCount.passes++;
  };
}

const SHADOW_MAP: Record<Quality, number> = { cinema: 4096, ultra: 4096, high: 2048, medium: 1024, low: 1024 };
/**
 * Cascatas da sombra do sol (0 = sombra única) e onde cada uma termina, em frações de maxFar.
 * O Cinema divide o perto em mais faixas: a sombra junto ao alvo fica mais fina.
 */
const CASCADES: Record<Quality, number[]> = { cinema: [0.18, 0.34, 0.56, 1], ultra: [0.3, 0.5, 1], high: [], medium: [], low: [] };
const tmpM = new THREE.Matrix4();
const tmpM2 = new THREE.Matrix4();
const tmpQ = new THREE.Matrix4();
/** Seções de andaime em volta da maravilha (3 por lado). */
const WONDER_SCAFFOLDS = 12;
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
/** O Ultra não tem o SSGI (ver post.ts): o mapa do chão devolve um pouco mais de luz para compensar. */
const BOUNCE_ULTRA = 1.3;
/** À noite o Ultra sobe a luz rebatida até aqui (de dia fica em BOUNCE_ULTRA, para o dia não mudar). */
const BOUNCE_ULTRA_NIGHT = 2.2;
/** E as poças dos lampiões: o SSGI espalhava também a luz das janelas acesas. */
const LAMPS_ULTRA = 9;
/** Halo largo e morno das casas acesas, só no Ultra e só à noite. */
const HALO_ULTRA = 2;
/** Ambiente morno que o Ultra soma à noite (na luz rebatida do chão) no lugar do que o SSGI espalhava. */
const WARM_ULTRA = new THREE.Color(0.45, 0.3, 0.15);
/** Força das poças dos lampiões com a noite fechada. */
const LAMPS = 5;

/** Assinatura dos níveis de uma peça: o que muda a malha dela (alturas, emendas, onde ela está no mundo). */
function levelSig(lvs: BuildOpts['levels']): string {
  if (!lvs) return '';
  const t = lvs.terrain;
  const w = t?.world;
  return `${lvs.own}${lvs.nb.join('')}${lvs.sec?.join('') ?? ''}${lvs.placed?.map(Number).join('') ?? ''}${t ? `|${t.h.join(',')};${t.c};${t.he.join(',')};${t.co.join(',')}` : ''}${w ? `@${w.x.toFixed(2)},${w.z.toFixed(2)},${w.rot}` : ''}`;
}

/** O morro no meio da peça sobe mais que o nível lógico dele (só a aparência; baixo, para o morro não virar uma cúpula por peça). */
const MORRO_BONUS = 0.3;
/**
 * O relevo é do mundo: onde a vizinha já assentada tem a borda mais baixa (ou mais alta), o alvo do setor puxa esta fração do caminho
 * até ela. Sem isso, cada peça cercada de vizinhas mais baixas vira uma almofada (platô no meio e encosta para todos os lados).
 */
const WORLD_PULL = 0.42;

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
    // A esfera é a da região, não a do kit na origem: sem ela o recorte esconderia o lote inteiro.
    m.frustumCulled = true;
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
    this.boundsDirty = true;
  }

  /** Troca a forma de todas as instâncias (casas na virada de era): mesma posição e mesma cor. */
  retarget(geo: THREE.BufferGeometry) {
    const old = this.mesh;
    this.geo = geo;
    this.mesh = this.make(this.cap, old.geometry.getAttribute('iColor').array as Float32Array);
    (this.mesh.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.boundingSphere = old.boundingSphere;
    this.parent.remove(old);
    old.geometry.dispose();
    old.dispose();
  }

  private boundsDirty = false;

  flush() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.getAttribute('iColor').needsUpdate = true;
    if (!this.boundsDirty || this.count === 0) return;
    this.mesh.computeBoundingSphere();
    // Folga para a árvore na divisa e para o balanço do vento, que o shader empurra para fora da esfera.
    if (this.mesh.boundingSphere) this.mesh.boundingSphere.radius += 1.6;
    this.boundsDirty = false;
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

  append(b: TileBuild, m: THREE.Matrix4): { start: number; count: number } {
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
    return { start: this.wN - wAdd, count: wAdd };
  }

  /** Reescreve a correnteza de uma peça já assentada (mesma malha de água, outro sentido): a água parada passa a correr, ou o contrário. */
  setFlow(slot: { start: number; count: number }, b: TileBuild, m: THREE.Matrix4) {
    if (b.wflow.length / 2 !== slot.count) return;
    const e = m.elements;
    for (let i = 0; i < slot.count; i++) {
      const fx = b.wflow[i * 2], fz = b.wflow[i * 2 + 1];
      this.wFlow[(slot.start + i) * 2] = e[0] * fx + e[8] * fz;
      this.wFlow[(slot.start + i) * 2 + 1] = e[2] * fx + e[10] * fz;
    }
    const a = this.water.geometry.getAttribute('wflow') as THREE.BufferAttribute;
    a.addUpdateRange(slot.start * 2, slot.count * 2);
    a.needsUpdate = true;
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
  /** Altura do chão da casa (relevo): a queda termina aqui. */
  ly: number;
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

/** Clima passageiro (o jogador toca no céu ou no botão): chuva, neve ou sol limpo. */
export type PassingWeather = 'rain' | 'snow' | 'sun';
/** Quanto dura o clima tocável (segundos do mundo) e quanto leva para entrar e sair. */
export const WEATHER_SECONDS = 30;
const WEATHER_FADE = 2.5;
const WX: Record<PassingWeather, { kind: 'rain' | 'snow' | 'pollen'; colors: [string, string]; density: number; size: number; opacity: number; clouds: number; tint: string; tintK: number; sunI: number; hemiI: number; mist: number }> = {
  rain: { kind: 'rain', colors: ['#d8e4f2', '#b4c8de'], density: 1, size: 1, opacity: 0.8, clouds: 0.36, tint: '#9fb0c6', tintK: 0.55, sunI: 0.4, hemiI: 0.9, mist: 0.35 },
  snow: { kind: 'snow', colors: ['#ffffff', '#e6eefa'], density: 1.6, size: 1.5, opacity: 1, clouds: 0.3, tint: '#c4d2e4', tintK: 0.4, sunI: 0.6, hemiI: 0.95, mist: 0.3 },
  sun: { kind: 'pollen', colors: ['#fff3b8', '#ffd47a'], density: 1.5, size: 2.4, opacity: 1, clouds: 0, tint: '#ffe0a0', tintK: 0.28, sunI: 1.2, hemiI: 1.04, mist: -1 },
};

const tmpSnap = new THREE.Vector3();
const tmpGrade = new THREE.Color();
const tmpColor2 = new THREE.Color();
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
  if (tod === 'aurora')
    // Sol ainda mais baixo que o amanhecer, rosado, com sombra comprida.
    return {
      bg: mix(theme.bg, '#f3c2b4', 0.38),
      fill: mix(theme.voidFill, '#f6d2c6', 0.34),
      line: mix(theme.voidLine, '#fbe4da', 0.28),
      sun: C('#ffc9a8'),
      sunI: theme.sunIntensity * 0.78,
      sunDir: sunAt(8, -55),
      hemiSky: mix(theme.hemiSky, '#f0b8b0', 0.4),
      hemiGround: mix(theme.hemiGround, '#6a5048', 0.3),
      hemiI: theme.hemiIntensity * 0.82,
      night: 0.08,
      haze: 0.028,
      mist: 0.35,
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
      sun: C(NIGHT_LIGHT.sun),
      sunI: NIGHT_LIGHT.sunI,
      sunDir: new THREE.Vector3(-dx, 0.9, -dz),
      hemiSky: C(NIGHT_LIGHT.hemiSky),
      hemiGround: C(NIGHT_LIGHT.hemiGround),
      hemiI: NIGHT_LIGHT.hemiI,
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

/** Tracejado da casa vazia com influência: 6 lados com 3 traços cada, um pouco para dentro da borda; no fluido, um anel de 14 traços. */
function dashGeometry(fluid: boolean): THREE.BufferGeometry {
  const dashes: THREE.BufferGeometry[] = [];
  if (fluid) {
    // Contorno de mancha (raio que ondula com o ângulo, o mesmo em toda casa), não um polígono.
    const n = 16, R = (a: number) => 0.76 * (1 + 0.09 * Math.sin(2 * a + 0.7) + 0.06 * Math.sin(3 * a + 2.1) + 0.04 * Math.sin(5 * a + 0.3));
    for (let i = 0; i < n; i++) {
      const a0 = ((i + 0.15) / n) * Math.PI * 2, a1 = ((i + 0.85) / n) * Math.PI * 2;
      const x0 = Math.cos(a0) * R(a0), z0 = Math.sin(a0) * R(a0), x1 = Math.cos(a1) * R(a1), z1 = Math.sin(a1) * R(a1);
      dashes.push(new THREE.PlaneGeometry(Math.hypot(x1 - x0, z1 - z0), 0.07).rotateX(-Math.PI / 2).rotateY(-Math.atan2(z1 - z0, x1 - x0)).translate((x0 + x1) / 2, 0, (z0 + z1) / 2));
    }
    return mergeGeometries(dashes)!;
  }
  for (let i = 0; i < 6; i++) {
    const a0 = (i * Math.PI) / 3, a1 = ((i + 1) * Math.PI) / 3;
    const p0 = new THREE.Vector2(Math.cos(a0), Math.sin(a0)).multiplyScalar(0.8), p1 = new THREE.Vector2(Math.cos(a1), Math.sin(a1)).multiplyScalar(0.8);
    for (let d = 0; d < 3; d++) {
      const t0 = (d + 0.2) / 3, t1 = (d + 0.8) / 3;
      const x0 = p0.x + (p1.x - p0.x) * t0, z0 = p0.y + (p1.y - p0.y) * t0;
      const x1 = p0.x + (p1.x - p0.x) * t1, z1 = p0.y + (p1.y - p0.y) * t1;
      const len = Math.hypot(x1 - x0, z1 - z0);
      dashes.push(new THREE.PlaneGeometry(len, 0.07).rotateX(-Math.PI / 2).rotateY(-Math.atan2(z1 - z0, x1 - x0)).translate((x0 + x1) / 2, 0, (z0 + z1) / 2));
    }
  }
  return mergeGeometries(dashes)!;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
  readonly rig = new CameraRig();
  readonly life: Life;
  theme!: Theme;
  quality: Quality = 'high';
  timeOfDay: TimeOfDay = 'day';

  private readonly staticRoot = new THREE.Group();
  /** Cachoeiras assentadas (R3): lâmina e espuma de todas as peças, em duas malhas. */
  readonly falls: FallLayer;
  private chunks = new Map<number, Chunk>();
  private pools = new Map<string, Pool>();
  private board: Board | null = null;
  private chimneys: number[] = [];
  private sun = new THREE.DirectionalLight();
  /**
   * Alta e Média têm uma sombra só. Ela não redesenha todo quadro: a câmera andou, uma peça
   * assentou, ou passou 0,25 s (barcos, moinhos e o vento da sombra acompanham a 4 Hz).
   * Ultra e Cinema usam cascatas, que o three redesenha sempre.
   */
  private shadowAt = new THREE.Vector2(1e9, 0);
  private shadowDist = 0;
  private shadowClock = 0.25;
  /** Sombra das cascatas guardada: direção do sol e pose da câmera do último redesenho. */
  private csmSun = new THREE.Vector3();
  private csmCamPos = new THREE.Vector3(1e9, 0, 0);
  private csmCamQuat = new THREE.Quaternion();
  private csmGated = false;
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
  /** Raio explorado que o vazio persegue (terra incógnita). */
  private voidGoal = 6;
  /** Carimbos dos sítios ainda escondidos, no plano do vazio. */
  private stamps: THREE.Mesh;
  private stampSig = '';
  private stampMat = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.8, depthWrite: false, fog: false, side: THREE.DoubleSide });
  private slots: THREE.InstancedMesh;
  private slotMat = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.55, depthWrite: false, fog: false });
  private slotCount = 0;
  /** Contorno tracejado dourado nas casas onde a peça da vez aproveita a influência de construções. */
  private infl: THREE.InstancedMesh;
  private inflMat = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.95, depthWrite: false, fog: false });
  private hoverRing: THREE.Mesh;
  /** Encaixe fluido (`?fluido`): o deslocamento do desenho das peças (`fluid.ts`); nulo = hexágonos de sempre. */
  private warp: Warp | null = null;
  /** Liga o desenho fluido (antes da primeira peça): chão, água e decoração deslocados, casas vazias em mancha. */
  setFluid(on: boolean) {
    if (on === !!this.warp) return;
    this.warp = on ? new Warp(0x2a) : null;
    // Terra contínua: o chão lê o campo de terreno do mundo, que só existe com o desenho deslocado.
    U.land.value = on ? 1 : 0;
    this.slots.geometry.dispose();
    // Mancha: um disco largo que esmaece (os vizinhos se fundem); sem o fluido, o hexágono de sempre.
    this.slots.geometry = on ? new THREE.CircleGeometry(1.12, 40).rotateX(-Math.PI / 2) : new THREE.CircleGeometry(0.9, 6).rotateX(-Math.PI / 2);
    this.slotMat.opacityNode = on ? slotBlob() : null;
    this.slotMat.needsUpdate = true;
    this.infl.geometry.dispose();
    this.infl.geometry = dashGeometry(on);
    this.hoverRing.geometry.dispose();
    this.hoverRing.geometry = on ? new THREE.RingGeometry(0.72, 0.86, 28).rotateX(-Math.PI / 2) : new THREE.RingGeometry(0.84, 0.97, 6).rotateX(-Math.PI / 2);
  }
  get fluid() {
    return !!this.warp;
  }
  /** O centro da casa (x, z) já com o deslocamento do desenho fluido. */
  private fl(x: number, z: number): { x: number; z: number } {
    if (!this.warp) return { x, z };
    const d = this.warp.at(x, z);
    return { x: x + d[0], z: z + d[1] };
  }
  private flq(q: number, r: number) {
    const { x, z } = hexToWorld(q, r);
    return this.fl(x, z);
  }
  /** A peça pronta, deslocada para a casa (q, r) girada `rot` (sem o fluido, a mesma). */
  private shaped(b: TileBuild, q: number, r: number, rot: number): TileBuild {
    return this.warp && !isWarped(b) ? warpBuild(b, tileMatrix(q, r, rot, 0).elements, this.warp) : b;
  }
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
  /** Chuva, neve ou pólen do clima tocável: uma segunda camada, escondida quando não há clima. */
  private precip = new Weather();
  private wx: { kind: PassingWeather; age: number } | null = null;
  /** Tipo cuja luz e partículas estão no ar (fica até a saída terminar) e a força atual, de 0 a 1. */
  private wxKind: PassingWeather | null = null;
  private wxAmt = 0;
  private cloudsBase = 0.16;
  private wxSkyBuf: Sky | null = null;
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
  /** Cúpula da aurora boreal (Theme.skyFx), na mesma cena das nuvens: só aparece à noite e quando o tema a pede. */
  private auroraDome = makeAuroraDome();
  private size = new THREE.Vector2(1, 1);
  /** Resolução dinâmica do modo Auto (dynres.ts): fração do lado da imagem do nível. */
  private resScale = 1;
  /** Desenho em tamanho fixo (foto e vídeo): tamanho lógico e pixels por unidade. */
  private fixed: { w: number; h: number; ratio: number } | null = null;
  /** 0 congela o mundo (modo foto); a câmera e a luz continuam respondendo. */
  timeScale = 1;
  /** Menos movimento: sem onda dourada, sem voo de câmera e sem o quique da peça. */
  reducedMotion = false;
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
    this.falls = new FallLayer(this.lib);
    this.staticRoot.add(this.falls.group);
    // Névoa por altura com bruma e névoa rasteira (atmosphere.ts) no lugar do THREE.Fog.
    (this.scene as THREE.Scene & { fogNode?: THREE.Node }).fogNode = fogNode;
    this.life = new Life(this.lib, this.scene);
    this.life.onSplash = (x, z) => this.sprites.splash(x, WATER_Y, z, 7);
    this.life.onTrade = (x, z) => this.burst(x, z, 'sparkle', 12, 0.12);
    this.life.levelOf = (q, r) => this.levelOf(q, r);
    this.life.onSmoke = (x, y, z) => this.sprites.smoke(x, y, z, tc(this.theme.smoke), U.wind.value);

    this.sun.castShadow = true;
    countShadowPasses(this.renderer);
    this.sun.shadow.autoUpdate = false;
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
    voidMesh.position.y = -TILE_T - 0.1; // um palmo abaixo do fundo das peças: elas pousam no entorno, não flutuam
    voidMesh.renderOrder = -1;
    voidMesh.receiveShadow = true;
    this.scene.add(voidMesh);

    this.stamps = new THREE.Mesh(new THREE.BufferGeometry(), this.stampMat);
    this.stamps.position.y = -0.115;
    this.stamps.renderOrder = 1;
    this.stamps.frustumCulled = false;
    this.scene.add(this.stamps);

    const hex = new THREE.CircleGeometry(0.9, 6).rotateX(-Math.PI / 2);
    this.slots = new THREE.InstancedMesh(hex, this.slotMat, 512);
    this.slots.count = 0;
    this.slots.frustumCulled = false;
    this.slots.position.y = -0.12;
    this.scene.add(this.slots);
    this.infl = new THREE.InstancedMesh(dashGeometry(false), this.inflMat, 256);
    this.infl.count = 0;
    this.infl.frustumCulled = false;
    this.infl.position.y = -0.11;
    this.infl.renderOrder = 2;
    this.scene.add(this.infl);

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

    this.precip.mesh.visible = false;
    this.scene.add(this.sprites.group, this.weather.mesh, this.precip.mesh, this.fireflies.mesh);
    this.cloudScene.add(this.clouds, this.auroraDome);
    (this.cloudScene as THREE.Scene & { fogNode?: THREE.Node }).fogNode = fogNode;
  }

  // ---------------------------------------------------------------- tema, luz, qualidade

  /** Entorno do tabuleiro (`surround`): o vazio vira mar, areia ou fica pergaminho; as cores saem da água e do chão do tema. */
  private setSurround(theme: Theme) {
    const mode = theme.surround ?? 'pergaminho';
    this.voidU.sea.value = mode === 'mar' ? 1 : 0;
    this.voidU.sand.value = mode === 'areia' || mode === 'chapada' ? 1 : 0;
    this.voidU.cap.value = mode === 'chapada' ? 1 : 0;
    const hsl = { h: 0, s: 0, l: 0 };
    tmpColor.set(theme.water).getHSL(hsl);
    // Raso: a cor da água, mais clara; fundo: o azul que o tema puxa, saturado e escuro.
    this.voidU.shallow.value.setHSL(hsl.h, Math.min(0.85, hsl.s * 1.1 + 0.1), Math.min(0.62, hsl.l + 0.1));
    this.voidU.deep.value.setHSL(THREE.MathUtils.lerp(hsl.h, 0.6, 0.65), 0.9, 0.27);
    this.voidU.sandCol.value.set(mode === 'areia' || mode === 'chapada' ? theme.ground[0] : '#e9d8aa');
    if (mode === 'areia') this.voidU.sandCol.value.lerp(tmpColor.set('#ead9b0'), 0.4);
    // Chapada: o capim é o prado do tema um pouco mais claro e a terra é a da lavoura.
    if (mode === 'chapada') {
      this.voidU.sandCol.value.lerp(tmpColor.set('#e8d79a'), 0.15);
      this.voidU.earthCol.value.set(theme.ground[2]);
    }
  }

  setTheme(theme: Theme, board: Board) {
    this.theme = theme;
    this.lib.applyTheme(theme);
    this.waterColor.set(theme.water);
    this.cloudsBase = theme.period === 'futuro' ? 0.08 : 0.16;
    U.clouds.value = this.cloudsBase;
    // Várzea (Theme.floodplain): a cor fértil perto do rio; sem ela o chão sai como sempre.
    U.flood.value = theme.floodplain ? 1 : 0;
    if (theme.floodplain) {
      U.floodReach.value = theme.floodplain.reach;
      U.floodColor.value.set(theme.floodplain.color);
    }
    U.fieldSnow.value = theme.fieldSnow ?? 1;
    U.rockColor.value.set(theme.relief?.rock ?? theme.rock);
    for (let k = 0; k < 4; k++) U.landCol[k].value.set(theme.ground[k]);
    this.eggClear();
    this.setSurround(theme);
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
    this.reliefMax = this.levelsEnabled ? (this.pieceRelief ? 2 : theme.relief?.levels ?? 0) : 0;
    this.levelCache.clear();
    this.seams.clear();
    this.rebuild(board);
  }

  /** Troca a hora do dia: a luz passa devagar para a nova, ou na hora com `instant` (vídeo). */
  setTimeOfDay(tod: TimeOfDay, instant = false) {
    this.timeOfDay = tod;
    if (instant) this.life.phase = phaseOfTod(tod);
    if (!this.theme) return;
    this.skyTarget = skyFor(this.theme, tod);
    if (instant) {
      this.sky = skyFor(this.theme, tod);
      this.applySky();
    }
    this.shadowClock = 0.25;
  }

  /** Estação visual: o tema pode travar (Inverno, Sakura); senão segue as jogadas, com o mesmo trinco da pontuação. */
  private applySeason() {
    const n = this.board?.list.length ?? 0;
    // A peça do centro não conta: a estação visível é a da última jogada.
    const s = this.theme?.season ?? seasonAt(Math.max(0, n - 2), this.board?.rules.seasonLock);
    U.season.value = s;
    U.snow.value = s === 3 ? 1 : 0;
  }

  /** Tipo do clima tocável em curso (ou null). */
  get passingWeather(): PassingWeather | null {
    return this.wx?.kind ?? null;
  }

  /** Começa o clima tocável (30 s, com entrada e saída suaves); `null` encerra o que estiver passando. */
  setWeather(kind: PassingWeather | null, age = 0) {
    if (!kind) {
      if (this.wx) this.wx.age = Math.max(this.wx.age, WEATHER_SECONDS - WEATHER_FADE);
      return;
    }
    const w = WX[kind];
    this.wx = { kind, age };
    this.wxKind = kind;
    // Com `age` (capturas por software, onde o quadro é lento), o clima já entra com essa idade.
    if (age > 0) this.wxAmt = Math.min(1, age / WEATHER_FADE);
    this.precip.setKind(w.kind, w.colors, w.density, w.size);
    this.precip.setDetail(this.quality === 'low' ? 0.8 : WEATHER[this.quality]);
  }

  /** Passo do clima tocável pelo tempo do mundo (`dt` já multiplicado por `timeScale`). */
  private stepWeather(dt: number) {
    const w = this.wx;
    if (!w && this.wxAmt === 0) return;
    if (w) w.age += dt;
    const target = w && w.age < WEATHER_SECONDS - WEATHER_FADE ? 1 : 0;
    const d = dt / WEATHER_FADE;
    this.wxAmt = Math.max(0, Math.min(1, this.wxAmt + Math.max(-d, Math.min(d, target - this.wxAmt))));
    const e = this.wxAmt * this.wxAmt * (3 - 2 * this.wxAmt);
    const k = this.wxKind ? WX[this.wxKind] : null;
    this.precip.setAmount(e * (k?.opacity ?? 0));
    this.precip.mesh.visible = e > 1e-3;
    U.clouds.value = THREE.MathUtils.lerp(this.cloudsBase, k?.clouds ?? this.cloudsBase, e);
    if (this.wxAmt === 0 && target === 0) {
      this.wx = null;
      this.wxKind = null;
      U.clouds.value = this.cloudsBase;
    }
  }

  /** O céu do tema com a luz do clima tocável por cima (mais fria e fraca na chuva, quente e limpa no sol). */
  private weatherSky(): Sky {
    const s = this.sky, k = this.wxKind ? WX[this.wxKind] : null;
    const e = this.wxAmt * this.wxAmt * (3 - 2 * this.wxAmt);
    if ((!k || e < 1e-3) && this.eggSky.k < 1e-3) return s;
    if (!k || e < 1e-3) return this.eggSkyOver(s);
    const o = (this.wxSkyBuf ??= { ...s, bg: s.bg.clone(), fill: s.fill.clone(), line: s.line.clone(), sun: s.sun.clone(), sunDir: s.sunDir.clone(), hemiSky: s.hemiSky.clone(), hemiGround: s.hemiGround.clone() });
    const t = tmpColor2.set(k.tint);
    const f = e * k.tintK;
    o.bg.copy(s.bg).lerp(t, f * 0.7);
    o.fill.copy(s.fill).lerp(t, f * 0.5);
    o.line.copy(s.line).lerp(t, f * 0.4);
    o.sun.copy(s.sun).lerp(t, f);
    o.hemiSky.copy(s.hemiSky).lerp(t, f);
    o.hemiGround.copy(s.hemiGround).lerp(t, f * 0.4);
    o.sunDir.copy(s.sunDir);
    o.sunI = s.sunI * THREE.MathUtils.lerp(1, k.sunI, e);
    o.hemiI = s.hemiI * THREE.MathUtils.lerp(1, k.hemiI, e);
    o.night = s.night;
    o.haze = s.haze;
    o.mist = k.mist < 0 ? s.mist * (1 - e) : Math.max(s.mist, k.mist * e);
    return o;
  }

  private applySky() {
    const s = this.weatherSky();
    if (!(this.scene.background instanceof THREE.Color)) this.scene.background = s.bg.clone();
    else this.scene.background.copy(s.bg);
    A.bg.value.copy(s.bg);
    // A bruma tem a cor do horizonte (um pouco do céu sobre o fundo) e brilha contra o sol.
    A.haze.value.copy(s.bg).lerp(s.hemiSky, 0.3);
    // A névoa rasteira é mais clara que o fundo e pega um pouco da cor do sol.
    A.mistColor.value.copy(s.bg).lerp(WHITE, 0.3 * (1 - s.night * 0.7)).add(tmpColor.copy(s.sun).multiplyScalar(0.05 * s.sunI * (1 - s.night)));
    A.glow.value.copy(s.sun).multiplyScalar(0.12 * s.sunI);
    const atmos = this.theme?.atmos;
    A.hazeDensity.value = s.haze * (atmos?.haze ?? 1);
    if (atmos) A.haze.value.lerp(tmpColor.set(atmos.hazeColor), 0.5);
    A.mist.value = s.mist;
    // Luz que o chão recebe (o sol pela altura dele e o céu), devolvida na cor do mapa do chão.
    const up = Math.max(0, s.sunDir.y / s.sunDir.length());
    const nightK = THREE.MathUtils.smoothstep(s.night, 0.25, 0.9);
    const bounceK = this.quality === 'ultra' ? BOUNCE_ULTRA + (BOUNCE_ULTRA_NIGHT - BOUNCE_ULTRA) * nightK : BOUNCE;
    U.bounce.value.copy(s.sun).multiplyScalar(s.sunI * up).add(tmpColor.copy(s.hemiSky).multiplyScalar(s.hemiI)).multiplyScalar(bounceK);
    U.lamps.value = nightK * (this.quality === 'ultra' ? LAMPS_ULTRA : LAMPS);
    // Ovo 'ceu' com `aurora`: a cortina aparece pálida mesmo de dia (solstício do Inverno Nórdico).
    U.aurora.value = Math.max(this.theme?.skyFx === 'aurora' ? nightK : 0, this.eggSky.k * this.eggSky.aurora);
    U.halo.value = this.quality === 'ultra' ? nightK * HALO_ULTRA : 0;
    if (this.quality === 'ultra') U.bounce.value.add(tmpColor.copy(WARM_ULTRA).multiplyScalar(nightK));
    // Nuvens: o topo ao sol um pouco mais claro que o fundo do tema, a base na cor do chão.
    CL.sun.value.copy(s.sun).multiplyScalar(s.sunI * 0.42);
    CL.sky.value.copy(s.hemiSky).multiplyScalar(s.hemiI * 0.35);
    CL.ground.value.copy(s.hemiGround).multiplyScalar(s.hemiI * 0.18);
    this.voidU.bg.value.copy(s.bg);
    this.voidU.sky.value.copy(s.hemiSky).multiplyScalar(Math.min(1, s.hemiI * 0.75));
    this.voidU.fill.value.copy(s.fill);
    this.voidU.line.value.copy(s.line);
    this.slotMat.color.copy(s.line);
    // Nanquim dos carimbos: a tinta do tema diluída no papel.
    if (this.theme) this.stampMat.color.set(this.theme.ui.ink).lerp(s.fill, 0.5);
    // Sobre o mar e a areia as casas livres são só uma sombra leve: o fundo já é cenário, não papel.
    this.slotMat.opacity = (0.55 - s.night * 0.3) * (this.voidU.sea.value ? 0.4 : this.voidU.sand.value ? 0.65 : 1);
    slotAlpha.value = this.slotMat.opacity * 1.8;
    this.inflMat.color.set('#e0981c');
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
    // O reforço da luz rebatida do Ultra vale já; no construtor o céu ainda não existe.
    if (this.sky) this.applySky();
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
    this.precip.setDetail(q === 'low' ? 0.8 : WEATHER[q]);
    if (postChanged) {
      this.post?.dispose();
      // Raios de luz só no Cinema (o Ultra os trocou por barateza); `?fx=` decide quando presente.
      const rays = CASCADES[q].length > 0 && (this.fx ? this.fx.includes('rays') : q === 'cinema');
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
    // Cascatas redesenham sozinhas; a sombra única espera o próximo quadro pedir.
    this.sun.shadow.autoUpdate = !!this.csm;
    this.shadowClock = 0.25;
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
    this.csmGated = false;
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
    // O grão (Ultra, Alta e Cinema) tem o tamanho de um pixel da tela ou do vídeo (post.ts).
    P.grainCell.value = Math.max(1, cell);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- mapa

  // ---------------------------------------------------------------- relevo (R2)

  /** Semente da partida (o jogo a põe antes do `setTheme`): os níveis das casas saem só dela e do tema. */
  reliefSeed = 0;
  /** `?levels=0` desliga o relevo (comparar com a versão plana). */
  levelsEnabled = true;
  /** Nível máximo do tema atual (0 = tabuleiro plano). */
  private reliefMax = 0;
  private levelCache = new Map<number, number>();
  /** Modo Relevo: a altura é da peça (`Placed.heights`), não da casa; os platôs da semente ficam desligados. */
  pieceRelief = false;
  /** Relevo por peça: nível-base da peça da vez (a casa vazia sob o ponteiro é aceita nesse plano). */
  private handLevel = 0;

  /** Quando o encaixe fluido liga: `auto` = só no modo Relevo (`?fluido=0` e `?fluido` forçam). */
  fluidPref: 'auto' | 'on' | 'off' = 'auto';

  setPieceRelief(on: boolean) {
    this.pieceRelief = on;
    this.setFluid(this.fluidPref === 'on' || (this.fluidPref === 'auto' && on));
    U.rock.value = on ? 1 : 0;
    this.seams.clear();
    this.reliefMax = this.levelsEnabled ? (on ? 2 : this.theme?.relief?.levels ?? 0) : 0;
    this.levelCache.clear();
  }

  /** Topo da peça assentada em (q, r): o maior nível entre os setores e o pico (para o clique). */
  private topOf(q: number, r: number): number {
    const p = this.board?.get(q, r);
    return p?.heights ? Math.max(p.hill ?? 0, ...p.heights) : 0;
  }

  /** Nível (0 a 2) da casa (q, r): função pura da semente, vale para casas ainda vazias. */
  levelOf(q: number, r: number): number {
    if (!this.reliefMax) return 0;
    if (this.pieceRelief) {
      const h = this.board?.get(q, r)?.heights;
      return h ? Math.min(...h) : 0;
    }
    const k = hkey(q, r);
    let l = this.levelCache.get(k);
    if (l === undefined) this.levelCache.set(k, (l = levelAt(this.reliefSeed, q, r, this.reliefMax)));
    return l;
  }

  /** Altura do chão da casa (q, r) no mundo. */
  heightOf(q: number, r: number): number {
    return this.reliefMax ? this.levelOf(q, r) * LEVEL_STEP : 0;
  }

  /** Altura do chão sob o ponto (x, z) do mundo (a da casa que o cobre). */
  heightAt(x: number, z: number): number {
    if (!this.reliefMax) return 0;
    const [q, r] = worldToHex(x, z);
    return this.heightOf(q, r);
  }

  /** Perfil de emenda já resolvido de cada peça assentada (relevo contínuo): zera junto com o mapa. */
  private seams = new Map<number, { he: number[]; co: number[] }>();

  /**
   * Perfil da emenda de uma peça em orientação de mundo: altura do meio de cada borda (`he`) e de cada canto (`co`, o canto
   * `k` abre a borda `k`). Sem vizinha antes dela é a altura-alvo da própria peça (cantos: a média das duas bordas); com
   * vizinha de terra já assentada, a borda e os dois cantos dela são os da vizinha, então a emenda casa ponto a ponto e a
   * peça nova faz o talude por dentro. Água e trilho não copiam: a diferença vira cachoeira, não talude.
   */
  private seamOf(q: number, r: number, hw: readonly number[], ew: readonly T[], idx: number) {
    const he = hw.slice(), co = hw.map((v, k) => (hw[(k + 5) % 6] + v) / 2);
    for (let w = 0; w < 6; w++) {
      if (isStrict(ew[w])) continue;
      const n = this.board?.get(q + DIRS[w][0], r + DIRS[w][1]);
      if (!n?.heights || n.index >= idx) continue;
      const rn = this.seamOfPlaced(n), o = opposite(w);
      he[w] = rn.he[o];
      co[w] = rn.co[(o + 1) % 6];
      co[(w + 1) % 6] = rn.co[o];
    }
    return { he, co };
  }

  private seamOfPlaced(p: Placed) {
    let sm = this.seams.get(p.key);
    if (!sm) this.seams.set(p.key, (sm = this.seamOf(p.q, p.r, p.heights!, p.edges, p.index)));
    return sm;
  }

  /**
   * Níveis da casa e das 6 vizinhas, na orientação de origem da peça (`BuildOpts.levels`); sem relevo, indefinido.
   * No modo Relevo a peça traz as alturas: os setores sobem acima do menor deles, e só as vizinhas colocadas ANTES contam
   * para a queda e a rampa (assim a peça sai igual no jogo e na reconstrução, em qualquer ordem).
   */
  private levelsFor(q: number, r: number, rot: number, def?: TileDef): BuildOpts['levels'] {
    if (!this.reliefMax) return undefined;
    if (this.pieceRelief) {
      const here = this.board?.get(q, r);
      let hw: number[], c: number, idx = Infinity, ew: readonly T[];
      if (here?.heights) (hw = here.heights), (c = here.hill ?? Math.max(...hw)), (idx = here.index), (ew = here.edges);
      else if (def) {
        const prof = tileProfile(def.edges, def.seed);
        (hw = worldHeights(prof, rot)), (c = prof.c), (ew = rotateEdges(def.edges, rot));
      } else return undefined;
      const own = Math.min(...hw);
      // Alvo do meio: o pico do morro, ou a média dos setores (o meio de uma encosta não é o topo dela).
      let ct = c > Math.max(...hw) ? c + MORRO_BONUS : hw.reduce((p, v) => p + v, 0) / 6;
      const sm = this.seamOf(q, r, hw, ew, idx);
      // O relevo é do mundo: o alvo de cada setor (e do meio) já puxa para a borda da vizinha assentada, que é de terra (a água não copia).
      const tg = hw.map((v, w) => {
        const n = this.board?.get(q + DIRS[w][0], r + DIRS[w][1]);
        return n?.heights && n.index < idx && !isStrict(ew[w]) ? v + (sm.he[w] - v) * WORLD_PULL : v;
      });
      ct += tg.reduce((p, v) => p + v, 0) / 6 - hw.reduce((p, v) => p + v, 0) / 6;
      const nb: number[] = [], placed: boolean[] = [], sec: number[] = [];
      const loc = (a: readonly number[]) => [0, 1, 2, 3, 4, 5].map((s) => a[(s + rot) % 6] - own);
      for (let s = 0; s < 6; s++) {
        const w = (s + rot) % 6;
        sec.push(hw[w] - own);
        const n = this.board?.get(q + DIRS[w][0], r + DIRS[w][1]);
        const known = !!n && n.index < idx && !!n.heights;
        nb.push(known ? n!.heights![opposite(w)] : hw[w]);
        placed.push(known);
      }
      const { x: wx, z: wz } = hexToWorld(q, r);
      return { own, nb, sec, placed, terrain: { h: loc(tg), c: ct - own, he: loc(sm.he), co: loc(sm.co), world: { x: wx, z: wz, rot, seed: this.reliefSeed } } };
    }
    const own = this.levelOf(q, r);
    return { own, nb: [0, 1, 2, 3, 4, 5].map((s) => {
      const [dq, dr] = DIRS[(s + rot) % 6];
      return this.levelOf(q + dq, r + dr);
    }) };
  }

  private build(def: TileDef, synergies: { sector: number; kind: SynKind }[], flow?: number[], extra?: { center?: boolean; eraMark?: number; site?: SiteKind; wonder?: boolean; widths?: number[]; spring?: boolean; eggs?: BuildOpts['eggs']; levels?: BuildOpts['levels'] }) {
    return buildTile(def.edges, def.seed, this.theme, { detail: DETAIL[this.quality], synergies, houses: this.lib.houseMeta, flow, special: def.special, continuous: !!this.warp, ...extra });
  }

  /** Peça do mapa já colocada: a inicial reserva o Centro, e a do marco o ergue. */
  private buildPlaced(p: Placed) {
    return this.build(p.def, synBase(p.synergies, p.rot), this.settleFlow(p), { center: p.index === 0, eraMark: p.eraMark, site: p.site, wonder: p.wonder, widths: this.settleWidths(p), eggs: this.eggKits.get(p.key), spring: p.spring, levels: this.levelsFor(p.q, p.r, p.rot, p.def) });
  }

  /**
   * Sentido da correnteza (por borda, no mundo) de uma peça em (q, r): herda das vizinhas
   * já colocadas, para o rio descer na mesma direção de peça em peça. Peças assentadas
   * nunca mudam; se duas correntezas opostas se encontram, a peça nova vira remanso.
   */
  private flows = new Map<number, number[]>();
  private flowAt(q: number, r: number, edges: readonly T[], ownLevel?: number, idx = Infinity, spring = false) {
    const known = [0, 0, 0, 0, 0, 0];
    const own = ownLevel ?? this.levelOf(q, r);
    // Águas que descem: a correnteza vem do núcleo (nascentes e curso que só desce); água fora do curso fica parada, sem correnteza.
    if (this.pieceRelief && this.board?.rules.springs) {
      if (!edges.includes(T.Water)) return known;
      const st = idx === Infinity && !this.board.get(q, r) ? this.board.waterNow({ q, r, edges, level: own, spring }) : this.waterOf();
      return st.flow.get(hkey(q, r))?.slice() ?? known;
    }
    for (let i = 0; i < 6; i++) {
      if (edges[i] !== T.Water) continue;
      // Relevo (R2): a água só desce. Onde a vizinha é mais baixa ela sai, onde é mais alta ela entra, sem olhar a ordem
      // (a vizinha chega à mesma conclusão pelo nível, então as duas concordam).
      const nb = this.pieceRelief ? this.board?.get(q + DIRS[i][0], r + DIRS[i][1]) : undefined;
      const nl = this.pieceRelief ? (nb && nb.index < idx ? this.levelOf(nb.q, nb.r) : own) : this.levelOf(q + DIRS[i][0], r + DIRS[i][1]);
      if (nl !== own) {
        known[i] = own > nl ? 1 : -1;
        continue;
      }
      const nf = this.flows.get(hkey(q + DIRS[i][0], r + DIRS[i][1]));
      if (nf && nf[opposite(i)]) known[i] = -nf[opposite(i)];
    }
    return resolveFlow(edges, known);
  }

  /** Estado da água do tabuleiro (núcleo), guardado até a próxima peça. */
  private waterMemo: { board: Board; n: number; st: WaterState } | null = null;
  private waterOf(): WaterState {
    const b = this.board!;
    if (!this.waterMemo || this.waterMemo.board !== b || this.waterMemo.n !== b.list.length) this.waterMemo = { board: b, n: b.list.length, st: b.waterNow() };
    return this.waterMemo.st;
  }

  /** Onde a água de cada peça assentada está no buffer do bloco (para trocar a correnteza sem refazer o mapa). */
  private waterSlots = new Map<number, { chunk: Chunk; start: number; count: number }>();

  /**
   * Águas que descem: uma peça nova pode fazer correr a água de peças que já estavam assentadas (a nascente ou o mar
   * chegou). Refaz só a correnteza delas, no buffer, e dispara a festa quando o curso chega ao mar.
   */
  private syncWater() {
    const b = this.board;
    if (!b || !this.pieceRelief || !b.rules.springs) return;
    const st = this.waterOf();
    for (const p of b.list) {
      if (!p.edges.includes(T.Water)) continue;
      const slot = this.waterSlots.get(p.key);
      const old = this.flows.get(p.key);
      const now = st.flow.get(p.key) ?? [0, 0, 0, 0, 0, 0];
      if (!slot || !old || old.every((v, i) => v === now[i])) continue;
      this.flows.set(p.key, now.slice());
      const m = tileMatrix(p.q, p.r, p.rot, this.heightOf(p.q, p.r));
      slot.chunk.setFlow(slot, this.build(p.def, synBase(p.synergies, p.rot), flowBase(now, p.rot), { center: false, widths: this.settleWidths(p), levels: this.levelsFor(p.q, p.r, p.rot, p.def) }), m);
    }
  }

  /** Registra a correnteza de uma peça colocada e devolve a versão na orientação de origem. */
  private settleFlow(p: Placed) {
    const wf = this.flowAt(p.q, p.r, p.edges, undefined, p.index, !!p.spring);
    this.flows.set(p.key, wf);
    return flowBase(wf, p.rot);
  }

  /**
   * Meia-largura da água por borda (mundo) de uma peça em (q, r): a da vizinha já colocada
   * onde ela existe, senão a da própria peça. Assim o rio muda de largura de peça em peça
   * sem degrau, e a boca larga de um lago emenda com o lago ao lado.
   */
  private widths = new Map<number, number[]>();
  private widthsAt(q: number, r: number, def: TileDef, rot: number) {
    const own = waterShape(def.edges, def.seed).widths;
    const out = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6; i++) {
      const s = (i + rot) % 6;
      out[s] = own[i];
      if (!own[i]) continue;
      const nw = this.widths.get(hkey(q + DIRS[s][0], r + DIRS[s][1]));
      if (nw && nw[opposite(s)]) out[s] = nw[opposite(s)];
    }
    return out;
  }

  /** Registra a largura da água de uma peça colocada e devolve a versão na orientação de origem. */
  private settleWidths(p: Placed) {
    const w = this.widthsAt(p.q, p.r, p.def, p.rot);
    this.widths.set(p.key, w);
    return flowBase(w, p.rot);
  }

  rebuild(board: Board) {
    this.board = board;
    this.applySeason();
    for (const c of this.chunks.values()) c.dispose(this.staticRoot);
    this.chunks.clear();
    this.falls.clear();
    for (const p of this.pools.values()) p.dispose();
    this.pools.clear();
    for (const d of this.drops) d.live.dispose();
    this.drops = [];
    this.chimneys = [];
    this.sprites.clear();
    this.life.reset(this.theme);
    this.life.phase = phaseOfTod(this.timeOfDay);
    this.flows.clear();
    this.waterSlots.clear();
    this.waterMemo = null;
    this.widths.clear();
    groundMap.clear();
    seaMap.clear();
    riverMap.clear();
    this.lib.setEra(board.era);
    this.syncedEra = board.era;
    // Easter eggs de peça: reavaliados na ordem das peças (em silêncio), então o replay mostra os mesmos kits.
    this.eggReset();
    this.feedEggs(board.list);
    for (const p of board.list) this.bake(p, this.buildPlaced(p), false);
    for (const pool of this.pools.values()) pool.flush();
    this.updateFrontier(board);
    this.life.sync(board);
    this.fireflies.sync(board);
    this.centerAnim = -1;
    this.setCenter(board.era);
    this.placeMonuments();
    this.disposeWonder();
    this.syncWonder(board, false);
  }

  // ---------------------------------------------------------------- Centro da vila

  private center: THREE.InstancedMesh | null = null;
  private centerEra = -1;
  /** Monumentos já conquistados, na praça do Centro (fora dos pools, como o próprio Centro). */
  private monumentKinds: string[] = [];
  private monumentMeshes: THREE.InstancedMesh[] = [];
  /** Tempo desde o avanço de era (-1 = parado) e a era que o Centro vai mostrar. */
  private centerAnim = -1;
  private centerNext = 0;
  /** A era do tabuleiro que o mundo já mostra (rebuild, eraUp e lote instantâneo); os ganchos de depuração não mexem nela. */
  private syncedEra = 0;

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
    setInstColor(m, 0, tmpColor.set(this.theme.ui.accent));
    m.castShadow = this.quality !== 'low';
    m.receiveShadow = true;
    m.computeBoundingSphere();
    this.staticRoot.add(m);
    this.center = m;
  }

  /** Mostra na praça os monumentos conquistados. Chamar de novo troca a lista sem reconstruir o mapa. */
  setMonuments(kinds: readonly string[]) {
    this.monumentKinds = [...kinds];
    this.placeMonuments();
  }

  private placeMonuments() {
    for (const m of this.monumentMeshes) {
      this.staticRoot.remove(m);
      m.geometry.dispose();
      m.dispose();
    }
    this.monumentMeshes = [];
    // Entre as cabanas da primeira era (elas ficam a 90°, 210° e 330°).
    const spots: Record<string, number> = { log: Math.PI / 6, statue: (5 * Math.PI) / 6, reliquary: (3 * Math.PI) / 2 };
    for (const k of this.monumentKinds) {
      const geo = this.lib.geo(`monument:${k}`);
      const ang = spots[k];
      if (!geo || ang === undefined) continue;
      const x = Math.cos(ang) * 0.23, z = Math.sin(ang) * 0.23;
      const mesh = new THREE.InstancedMesh(instGeometry(geo, 1), this.lib.material(`monument:${k}`), 1);
      mesh.setMatrixAt(0, tmpM.makeTranslation(x, 0, z).multiply(tmpM2.makeRotationY(Math.atan2(x, z))));
      setInstColor(mesh, 0, tmpColor.set('#ffffff'));
      mesh.castShadow = this.quality !== 'low';
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.staticRoot.add(mesh);
      this.monumentMeshes.push(mesh);
    }
  }

  /**
   * Avanço de era: o Centro afunda, volta na forma nova (com poeira), e uma onda dourada
   * corre pelo mapa a partir dele.
   */
  eraUp(era: number) {
    this.syncedEra = era;
    if (this.reducedMotion) {
      this.centerAnim = -1;
      this.setCenter(era);
      this.setHouseEra(era, false);
      U.eraWave.value.w = 0;
      return;
    }
    this.centerNext = era;
    this.centerAnim = 0;
    U.eraWave.value.set(0, 0, this.time, 1);
  }

  /** Depuração: o Centro numa era, parado, e a onda dourada já com `waveAge` segundos (negativo = sem onda). */
  showEra(era: number, waveAge = -1) {
    this.centerAnim = -1;
    this.setCenter(era);
    this.setHouseEra(era, false);
    if (waveAge >= 0) U.eraWave.value.set(0, 0, this.time - waveAge, 1);
  }

  /**
   * Arquitetura da era (src/themes/progress.ts): as casas do mapa inteiro trocam de forma de uma
   * vez, junto com o Centro, sem reconstruir nada. Com `dust`, levanta poeira nas casas à vista.
   */
  private setHouseEra(era: number, dust: boolean) {
    for (const k of this.lib.setEra(era)) {
      const geo = this.lib.geo(k);
      if (!geo) continue;
      const tx = this.rig.target.x, tz = this.rig.target.z, view = this.rig.dist * 0.8;
      let dustLeft = 8;
      for (const [id, pool] of this.pools) {
        if (poolKey(id) !== k) continue;
        pool.retarget(geo);
        if (!dust || !k.startsWith('wall:') || dustLeft <= 0) continue;
        const a = pool.mesh.instanceMatrix.array;
        for (let i = 0; i < pool.count && dustLeft > 0; i++) {
          const x = a[i * 16 + 12], z = a[i * 16 + 14];
          if (Math.abs(x - tx) > view || Math.abs(z - tz) > view) continue;
          this.burst(x, z, 'dust', 5);
          dustLeft--;
        }
      }
    }
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
        this.setHouseEra(this.centerNext, true);
      }
      const b = Math.min(1, (t - SINK) / RISE);
      y = Math.max(0.02, easeOutBack(b));
      xz = 0.7 + 0.3 * Math.min(1, b * 1.6);
      if (b >= 1) this.centerAnim = -1;
    }
    this.center?.setMatrixAt(0, tmpM.makeScale(xz, y, xz));
    if (this.center) this.center.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- maravilha

  /** Pódio, corpo, remate e andaime da maravilha: objetos avulsos, como o Centro. */
  private wonder: { key: number; x: number; y: number; z: number; base: THREE.InstancedMesh; body: THREE.InstancedMesh; crown: THREE.InstancedMesh; scaffold: THREE.InstancedMesh | null } | null = null;
  /** Etapa mostrada (anda devagar até a etapa da regra) e a etapa alvo. */
  private wonderShown = 0;
  private wonderTarget = 0;

  private disposeWonder() {
    if (!this.wonder) return;
    for (const m of [this.wonder.base, this.wonder.body, this.wonder.crown, this.wonder.scaffold]) {
      if (!m) continue;
      this.staticRoot.remove(m);
      m.geometry.dispose();
      m.dispose();
    }
    this.wonder = null;
  }

  /** Cria a maravilha quando o canteiro assenta e acompanha a etapa; com `animate`, a obra sobe aos poucos e a conclusão é festejada. */
  syncWonder(board: Board, animate: boolean) {
    const w = board.wonder;
    if (!w) {
      this.disposeWonder();
      return;
    }
    if (!this.wonder || this.wonder.key !== w.tile.key) {
      // Só depois que a peça do canteiro pousou (ela ainda pode estar caindo).
      if (this.drops.some((d) => d.placed === w.tile)) return;
      this.disposeWonder();
      const mk = (key: string, shadow = true) => {
        const geo = this.lib.geo(key);
        const n = key === 'scaffold' ? WONDER_SCAFFOLDS : 1;
        const m = new THREE.InstancedMesh(instGeometry(geo ?? new THREE.BufferGeometry(), n), this.lib.material(key), n);
        for (let i = 0; i < n; i++) setInstColor(m, i, tmpColor.set(key === 'scaffold' ? '#ffffff' : this.theme.ui.accent));
        m.castShadow = shadow && this.quality !== 'low';
        m.receiveShadow = true;
        m.frustumCulled = false;
        this.staticRoot.add(m);
        return m;
      };
      const { x, z } = hexToWorld(w.tile.q, w.tile.r);
      this.wonder = { key: w.tile.key, x, y: this.heightOf(w.tile.q, w.tile.r), z, base: mk('wonder:base'), body: mk('wonder:body'), crown: mk('wonder:crown'), scaffold: this.lib.geo('scaffold') ? mk('scaffold') : null };
      this.wonderShown = animate ? 0 : w.stage;
      if (animate) this.burst(x, z, 'dust', 30);
    }
    const before = this.wonderTarget;
    this.wonderTarget = w.stage;
    if (!animate) this.wonderShown = w.stage;
    const full = board.rules.wonderStages;
    if (animate && w.stage === full && before < full) {
      // Maravilha pronta: anel dourado, brilhos e um bando de pássaros.
      this.halo(this.wonder.x, this.wonder.z, 2);
      this.flushBirds(this.wonder.x, this.wonder.z);
      this.burst(this.wonder.x, this.wonder.z, 'sparkle', 70, 0.4);
    }
    this.stepWonder(0, full);
  }

  private stepWonder(dt: number, full = this.board?.rules.wonderStages ?? 6) {
    const W = this.wonder;
    if (!W || full <= 0) return;
    this.wonderShown = Math.min(this.wonderTarget, this.wonderShown + dt * 1.2);
    const k = this.wonderShown / full;
    const { h, w } = this.lib.wonderSize;
    const y0 = WONDER_PODIUM;
    W.base.setMatrixAt(0, tmpM.makeTranslation(W.x, W.y, W.z));
    W.body.setMatrixAt(0, tmpM.makeTranslation(W.x, W.y + y0, W.z).multiply(tmpM2.makeScale(1, Math.max(0.001, k), 1)));
    W.body.visible = k > 0.001;
    const done = this.wonderShown >= full;
    W.crown.visible = done;
    W.crown.setMatrixAt(0, tmpM.makeTranslation(W.x, W.y, W.z));
    if (W.scaffold) {
      // Andaime em volta da obra: três seções por lado, viradas para fora, da altura da obra.
      W.scaffold.visible = !done;
      const half = Math.min(0.36, w / 2 + 0.03), sy = Math.max(0.1, h * k + 0.06);
      let i = 0;
      for (let side = 0; side < 4; side++) {
        const ang = (side * Math.PI) / 2;
        for (const t of [-0.62, 0, 0.62]) {
          const lx = t * half, lz = half;
          const c = Math.cos(ang), sn = Math.sin(ang);
          tmpM.makeTranslation(W.x + lx * c + lz * sn, W.y + y0, W.z - lx * sn + lz * c).multiply(tmpM2.makeRotationY(ang)).multiply(tmpQ.makeScale(1.3, sy, 0.5));
          W.scaffold.setMatrixAt(i++, tmpM);
        }
      }
      W.scaffold.count = i;
      W.scaffold.instanceMatrix.needsUpdate = true;
    }
    for (const m of [W.base, W.body, W.crown]) m.instanceMatrix.needsUpdate = true;
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

  private pool(key: string, q: number, r: number) {
    const cq = regionOf(q);
    const cr = regionOf(r);
    const id = `${key}@${cq},${cr}`;
    let p = this.pools.get(id);
    if (!p) {
      // Chave com "~" = metade "fina" de plantas e capim, escondida de longe (nível de detalhe).
      const fine = key.endsWith('~');
      const base = fine ? key.slice(0, -1) : key;
      const geo = (this.farTrees && !fine && this.lib.farGeo(base)) || this.lib.geo(base);
      if (!geo) return null;
      p = new Pool(geo, fine ? this.lib.fineMaterial(base) : this.lib.material(base), this.staticRoot, this.lib.castsShadow(base));
      this.pools.set(id, p);
    }
    return p;
  }

  /** Árvores, arbustos e pedras de longe: os lotes com versão leve (`Lib.farGeo`) trocam para a geometria leve (mesmas instâncias e cores, `Pool.retarget`). */
  private farTrees = false;
  private setFarTrees(on: boolean) {
    if (on === this.farTrees) return;
    this.farTrees = on;
    for (const [id, pool] of this.pools) {
      const k = poolKey(id);
      if (this.lib.farGeo(k)) pool.retarget((on ? this.lib.farGeo(k) : this.lib.geo(k))!);
    }
  }

  private lodFlip = 0;
  private isLod(key: string) {
    return key.startsWith('crop:') || key === 'grass' || key === 'flower';
  }

  private bake(p: Placed, b0: TileBuild, flush = true) {
    const m = tileMatrix(p.q, p.r, p.rot, this.heightOf(p.q, p.r));
    const b = this.shaped(b0, p.q, p.r, p.rot);
    const ch = this.chunkFor(p.q, p.r);
    const slot = ch.append(b, m);
    if (slot.count) this.waterSlots.set(p.key, { chunk: ch, ...slot });
    groundMap.add(b, m, this.waterColor);
    this.falls.append(b, m);
    // Modo Relevo: a saia das bordas altas avança sobre a casa vazia, e a areia e a espuma do mar começam no pé dela.
    seaMap.add(p.q, p.r, this.pieceRelief && p.heights ? 0.4 * skirtWidth(Math.max(...p.heights)) : 0, this.warp ? (x, z) => this.warp!.inverse(x, z) : undefined);
    if (this.theme.floodplain && b.water.length) riverMap.add(b.water, m, this.theme.floodplain.reach);
    for (const d of b.decos) {
      if (d.transient) continue;
      decoMatrix(d, tmpM);
      tmpM.premultiply(m);
      if (this.lib.lit(d.key)) {
        // Uma poça por casa com janela, umas mais fortes que outras (sorteio pela posição).
        const x = tmpM.elements[12], z = tmpM.elements[14];
        const h = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
        groundMap.lantern(x, z, 0.28 + 0.2 * h);
        // Sombra de contato: o chão escurece em volta da casa (0 draw call; o material do chão lê o mapa).
        groundMap.contact(x, z, 0.65, 0.13 * tmpM.getMaxScaleOnAxis());
      }
      if (d.key === 'bridge') this.life.addBridge(tmpM);
      if (d.anim === 'spin-z' || d.anim === 'spin-x') this.life.addSpinner(d.key, tmpM, d.anim === 'spin-x' ? 'x' : 'z');
      else if (d.anim === 'wander') this.life.addAnimal(d.key, tmpM, d.color, d.when);
      else if (d.anim === 'chop' || d.anim === 'tend' || d.anim === 'carry') this.life.addWorker(d.key, tmpM, d.color, d.anim);
      else if (d.anim === 'swim') this.life.addFish(tmpM, d.color, d.orbit ?? 0);
      else if (d.anim === 'bob') this.life.addBobber(tmpM, d.color);
      else this.pool(this.isLod(d.key) && this.lodFlip++ % 2 ? `${d.key}~` : d.key, p.q, p.r)?.add(tmpM, d.color);
    }
    const v = new THREE.Vector3();
    for (let i = 0; i < b.chimneys.length; i += 4) {
      v.set(b.chimneys[i], b.chimneys[i + 1], b.chimneys[i + 2]).applyMatrix4(m);
      this.chimneys.push(v.x, v.y, v.z, b.chimneys[i + 3]);
    }
    if (flush) for (const pool of this.pools.values()) pool.flush();
    // A peça nova entra na sombra no próximo redesenho, sem esperar o relógio de 0,25 s.
    this.shadowClock = 0.25;
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
      const f = this.fl(x, z);
      this.slots.setMatrixAt(i++, tmpM.makeTranslation(f.x, this.heightOf(q, r), f.z));
    }
    this.slotCount = i;
    this.slots.count = i;
    this.slots.instanceMatrix.needsUpdate = true;
    this.voidGoal = maxR + 1;
    this.updateStamps(board);
    this.rig.bounds = maxR;
  }

  /** Casas (vazias) onde a peça da vez ganharia pontos de influência. */
  setInfluence(cells: readonly (readonly [number, number])[]) {
    let i = 0;
    for (const [q, r] of cells) {
      if (i >= 256) break;
      const { x, z } = hexToWorld(q, r);
      const f = this.fl(x, z);
      this.infl.setMatrixAt(i++, tmpM.makeTranslation(f.x, this.heightOf(q, r), f.z));
    }
    this.infl.count = i;
    this.infl.instanceMatrix.needsUpdate = true;
  }

  /** O batedor sai do Centro na direção do sítio mais perto, olha da beira da peça e volta. */
  scout(board: Board) {
    let best: { x: number; z: number } | null = null;
    for (const st of board.sites) {
      if (st.found) continue;
      const w = hexToWorld(st.q, st.r);
      if (!best || Math.hypot(w.x, w.z) < Math.hypot(best.x, best.z)) best = w;
    }
    if (!best) return;
    const l = Math.hypot(best.x, best.z) || 1;
    const ux = best.x / l, uz = best.z / l;
    this.life.scout(ux * 0.3, uz * 0.3, ux * 0.72, uz * 0.72);
  }

  private updateStamps(board: Board) {
    const left = board.sites.filter((s) => !s.found);
    // Nascentes escondidas que uma peça de água acabou de revelar (a marca some quando uma peça pousa em cima).
    const springs = board.revealedSprings();
    const sig = left.map((s) => `${s.q},${s.r},${s.kind}`).join('|') + '#' + board.posts.map((p) => `${p.q},${p.r}`).join('|') + '#' + springs.map((s) => `${s.q},${s.r}`).join('|');
    if (sig === this.stampSig) return;
    this.stampSig = sig;
    const geos = left.map((s) => {
      const { x, z } = this.flq(s.q, s.r);
      // Cada carimbo um pouco torto, como batido à mão (sem sorteio: vem da posição).
      return stampGeometry(s.kind).rotateY(Math.sin(s.q * 12.9898 + s.r * 78.233) * 0.25).translate(x, this.heightOf(s.q, s.r), z);
    });
    for (const sp of springs) {
      const { x, z } = this.flq(sp.q, sp.r);
      geos.push(stampGeometry('spring').scale(1.35, 1, 1.35).rotateY(Math.sin(sp.q * 12.9898 + sp.r * 78.233) * 0.25).translate(x, this.heightOf(sp.q, sp.r), z));
    }
    for (const p of board.posts) {
      const { x, z } = this.flq(p.q, p.r);
      geos.push(postStampGeometry().rotateY(0.2).translate(x, this.heightOf(p.q, p.r), z));
    }
    this.stamps.geometry.dispose();
    this.stamps.geometry = geos.length ? mergeGeometries(geos)! : new THREE.BufferGeometry();
  }

  /** Coloca com animação: a peça assenta, levanta poeira e depois é "cozida" no bloco. */
  placeAnimated(p: Placed) {
    const syn = synBase(p.synergies, p.rot);
    const flow = this.settleFlow(p);
    const widths = this.settleWidths(p);
    // Ovos de peça desta jogada: o kit entra na peça; o resto (evento, céu, som) dispara quando ela assenta.
    if (this.board) this.feedEggs(this.board.list, p.index + 1, true);
    const eggs = this.eggKits.get(p.key);
    const lvs = this.levelsFor(p.q, p.r, p.rot, p.def);
    const sig = `${p.spring ? 's' : ''}${synSig(syn)}|${flow.join('')}|${widths.join(',')}|${p.eraMark ?? ''}|${p.site ?? ''}|${p.wonder ? 'w' : ''}|${eggs?.map((e) => e.kit).join('+') ?? ''}|${levelSig(lvs)}`;
    let live: LiveTile;
    const ly = this.heightOf(p.q, p.r);
    let y0 = ly + 1.2;
    if (this.ghost && this.ghost.def === p.def && this.ghost.sig === sig && (!this.warp || this.ghostKey.endsWith(`:${p.q},${p.r},${p.rot}`))) {
      live = this.ghost;
      y0 = live.group.position.y;
      this.ghost = null;
      this.ghostKey = '';
    } else {
      live = new LiveTile(p.def, this.shaped(this.build(p.def, syn, flow, { eraMark: p.eraMark, site: p.site, wonder: p.wonder, widths, eggs, spring: p.spring, levels: lvs }), p.q, p.r, p.rot), sig, this.lib, this.quality !== 'low');
      this.scene.add(live.group);
      this.dropGhost();
    }
    live.inner.rotation.y = (-p.rot * Math.PI) / 3;
    const { x, z } = hexToWorld(p.q, p.r);
    live.group.position.set(x, y0, z);
    this.hoverRing.visible = false;
    for (const m of this.markers) m.visible = false;
    this.drops.push({ live, placed: p, t: 0, y0, ly, landed: false, hold: live.has(BUILDS) ? SCAFFOLD_DOWN + 0.3 : 0.55, cleared: false });
  }

  /** Coloca várias peças de uma vez, sem animação (modo automático / teste de carga). */
  placeInstant(list: Placed[], board: Board) {
    this.feedEggs(board.list);
    for (const p of list) this.bake(p, this.buildPlaced(p), false);
    for (const pool of this.pools.values()) pool.flush();
    this.updateFrontier(board);
    this.life.sync(board);
    this.fireflies.sync(board);
    this.syncWonder(board, false);
    // Sem animação não há `eraUp`: o lote termina na era do placar, então o Centro e as casas vão para ela
    // (antes ficavam na primeira, com o placar na terceira).
    if (board.era !== this.syncedEra) {
      this.syncedEra = board.era;
      this.centerAnim = -1;
      this.setCenter(board.era);
      this.setHouseEra(board.era, false);
    }
  }

  // ---------------------------------------------------------------- easter eggs

  private eggs: EggTracker | null = null;
  /** Kits de ovo por peça (chave da peça): decididos pela partida, então o replay os reconstrói. */
  private eggKits = new Map<number, NonNullable<BuildOpts['eggs']>>();
  /** Ovos de uma jogada ao vivo, esperando a peça assentar para dispararem. */
  private eggPending = new Map<number, EggSpec[]>();
  /** Um ovo disparou numa jogada ao vivo (ou pelo relógio): o jogo mostra o aviso e toca os sons. */
  onEgg?: (egg: EggSpec, sounds: ('sinos' | 'brilho' | 'coro')[], announce: boolean) => void;
  /** Tom de céu de um ovo: `k` vai ao `target` aos poucos; `left` > 0 conta os segundos até soltar. */
  private eggSky = { tint: new THREE.Color(), strength: 0.5, k: 0, target: 0, left: 0, aurora: 0 };
  private eggSkyBuf: Sky | null = null;

  private eggReset() {
    this.eggs = null;
    this.eggKits.clear();
    this.eggPending.clear();
  }

  private eggClear() {
    this.eggReset();
    this.eggSky.k = this.eggSky.target = 0;
  }

  /**
   * Alimenta o rastreador com as peças que faltam, na ordem (até `upto`), e guarda os kits. Com `live`, os ovos
   * da jogada ficam pendentes para disparar quando a peça pousar; sem ele (replay, desfazer) só os kits entram.
   */
  private feedEggs(list: readonly Placed[], upto = list.length, live = false) {
    const specs = this.theme?.eggs;
    if (!specs?.length) return;
    const tr = (this.eggs ??= new EggTracker(specs));
    if (tr.count > list.length) {
      tr.reset();
      this.eggKits.clear();
      this.eggPending.clear();
    }
    while (tr.count < Math.min(upto, list.length)) {
      const p = list[tr.count];
      for (const h of tr.add({ q: p.q, r: p.r, index: p.index, edges: p.edges, seed: p.def.seed })) {
        for (const x of h.egg.effect) {
          if (x.kind !== 'kit') continue;
          const kits = this.eggKits.get(p.key) ?? [];
          kits.push({ id: h.egg.id, kit: x.kit, scale: x.scale, color: x.color });
          this.eggKits.set(p.key, kits);
        }
        if (live) this.eggPending.set(p.key, [...(this.eggPending.get(p.key) ?? []), h.egg]);
      }
    }
  }

  /** A peça acabou de pousar: dispara os ovos dela. */
  private fireEggs(p: Placed) {
    const eggs = this.eggPending.get(p.key);
    if (!eggs) return;
    this.eggPending.delete(p.key);
    const { x, z } = hexToWorld(p.q, p.r);
    for (const e of eggs) {
      if (e.effect.some((f) => f.kind === 'kit')) {
        this.burst(x, z, 'sparkle', 30, 0.1);
        this.halo(x, z, 1.4);
      }
      this.playEgg(e, x, z, true, p);
    }
  }

  /** Executa os efeitos visuais de um ovo (evento e céu) em (x, z) e entrega os sons ao jogo. Só cosmético. */
  playEgg(egg: EggSpec, x: number, z: number, announce = true, tile?: Placed) {
    const sounds: ('sinos' | 'brilho' | 'coro')[] = [];
    for (const f of egg.effect) {
      if (f.kind === 'som') sounds.push(f.sound);
      else if (f.kind === 'ceu') this.setEggSky(f.tint, f.strength ?? 0.5, f.seconds ?? 20, f.aurora ?? 0);
      else if (f.kind === 'evento' && !this.reducedMotion) {
        if (f.event === 'bando-dourado') this.life.flush(x, z, true);
        else if (f.event === 'revoada') this.life.flush(x, z, false, 16);
        else if (f.event === 'maria-fumaca') {
          // Atravessa a peça pelos trilhos: de uma borda de trilho à outra (ou ao longo de uma qualquer, sem a peça).
          const rail = tile ? [0, 1, 2, 3, 4, 5].filter((i) => tile.edges[i] === T.Rail) : [];
          const dir = (i: number) => {
            const w = hexToWorld(DIRS[i][0], DIRS[i][1]);
            const l = Math.hypot(w.x, w.z) || 1;
            return [w.x / l, w.z / l];
          };
          const [a, b] = rail.length >= 2 ? [dir(rail[0]), dir(rail[1])] : [[1, 0], [-1, 0]];
          this.life.passage('egg:trem', 1, [x + a[0] * 0.9, z + a[1] * 0.9], [x + b[0] * 0.9, z + b[1] * 0.9], 0.34, 0.1, 0.012, WHITE, 0.002, 0, 0.06);
        } else if (f.event === 'festa-junina') {
          // Balões de papel em quatro cores sobem à deriva do vento, em fila, e a fogueira da festa faísca.
          const a = Math.random() * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
          ['#ff5a4a', '#ffc83a', '#3fa0e8', '#ee6fb0'].forEach((c, i) => this.life.passage('egg:balao', 2, [x + ux * 0.6 + uz * (i - 1.5) * 0.12, z + uz * 0.6 - ux * (i - 1.5) * 0.12], [x + ux * 4.5, z + uz * 4.5], 0.05, 0.5 + i * 0.07, 0.05 + i * 0.1, tc(c), 0.003, 0.11));
          this.burst(x, z, 'sparkle', 40, 0.05);
        } else if (f.event === 'corvos') this.life.flush(x, z, false, 2);
        else if (f.event === 'treno') {
          // Um trenó de rena cruza o céu bem alto, de um lado ao outro do foco, com a luz vermelha à frente.
          const a = Math.random() * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
          this.life.passage('egg:sled', 1, [x - ux * 5, z - uz * 5], [x + ux * 5, z + uz * 5], 0.5, 0.1, 1.5, WHITE, 0.03);
        }
        else if (f.event === 'procissao') {
          // Cinco aldeões com lanterna cruzam a peça numa direção qualquer (cosmético: o sorteio não é da semente).
          const a = Math.random() * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
          this.life.passage('egg:folk', 5, [x - ux * 1.2, z - uz * 1.2], [x + ux * 1.2, z + uz * 1.2], 0.07, 0.075, 0, tc(f.color ?? this.theme.ui.accent), 0.004);
        }
      }
    }
    this.onEgg?.(egg, sounds, announce);
  }

  /** Tom de céu por cima da hora do dia; `seconds` 0 segura até `clearEggSky`. */
  setEggSky(tint: string, strength: number, seconds: number, aurora = 0) {
    this.eggSky.aurora = aurora;
    this.eggSky.tint.set(tint);
    this.eggSky.strength = strength;
    this.eggSky.target = 1;
    this.eggSky.left = seconds;
  }

  clearEggSky() {
    this.eggSky.target = 0;
    this.eggSky.left = 0;
  }

  private stepEggSky(dt: number) {
    const e = this.eggSky;
    if (e.left > 0) {
      e.left -= dt;
      if (e.left <= 0) e.target = 0;
    }
    if (e.k === e.target) return;
    e.k += Math.max(-dt * 0.5, Math.min(dt * 0.5, e.target - e.k));
    this.applySky();
  }

  /** O céu do tema com o tom do ovo por cima (mais fraco que o clima tocável, que tem a vez quando está ativo). */
  private eggSkyOver(s: Sky): Sky {
    const o = (this.eggSkyBuf ??= { ...s, bg: s.bg.clone(), fill: s.fill.clone(), line: s.line.clone(), sun: s.sun.clone(), sunDir: s.sunDir.clone(), hemiSky: s.hemiSky.clone(), hemiGround: s.hemiGround.clone() });
    const k = this.eggSky.k * this.eggSky.k * (3 - 2 * this.eggSky.k);
    const f = k * this.eggSky.strength;
    o.bg.copy(s.bg).lerp(this.eggSky.tint, f * 0.6);
    o.fill.copy(s.fill).lerp(this.eggSky.tint, f * 0.45);
    o.line.copy(s.line).lerp(this.eggSky.tint, f * 0.4);
    o.sun.copy(s.sun).lerp(this.eggSky.tint, f * 0.8);
    o.hemiSky.copy(s.hemiSky).lerp(this.eggSky.tint, f);
    o.hemiGround.copy(s.hemiGround).lerp(this.eggSky.tint, f * 0.3);
    o.sunDir.copy(s.sunDir);
    o.sunI = s.sunI;
    o.hemiI = s.hemiI;
    o.night = s.night;
    o.haze = s.haze;
    o.mist = s.mist;
    return o;
  }

  // ---------------------------------------------------------------- fantasma

  setGhost(def: TileDef, rot: number, angle: number, q: number, r: number, check: Check) {
    const syn = check.valid ? synBase(check.synergies, rot) : [];
    const lvs = this.levelsFor(q, r, rot, def);
    const ew = rotateEdges(def.edges, rot);
    const flow = flowBase(this.flowAt(q, r, ew, this.pieceRelief ? lvs?.own : undefined, Infinity, !!check.water?.spring), rot);
    const widths = flowBase(this.widthsAt(q, r, def, rot), rot);
    // O fantasma já mostra o marco da era que a peça ergueria.
    // A peça especial não ergue marco nem começa a maravilha (Board.place): o fantasma também não.
    const mark = check.valid && !def.special ? (check.eraMark ?? undefined) : undefined;
    const site = check.valid ? check.site?.kind : undefined;
    const wonder = check.valid && check.wonder && !def.special ? true : undefined;
    const sig = `${check.water?.spring ? 's' : ''}${synSig(syn)}|${flow.join('')}|${widths.join(',')}|${mark ?? ''}|${site ?? ''}|${wonder ? 'w' : ''}`;
    const key = `${def.seed}:${this.theme.id}:${sig}:${levelSig(lvs)}${this.warp ? `:${q},${r},${rot}` : ''}`;
    if (!this.ghost || this.ghostKey !== key) {
      const old = this.ghost;
      this.ghost = new LiveTile(def, this.shaped(this.build(def, syn, flow, { eraMark: mark, site, wonder, widths, spring: check.water?.spring, levels: lvs }), q, r, rot), sig, this.lib, this.quality !== 'low');
      this.ghostKey = key;
      this.scene.add(this.ghost.group);
      if (old && old.def === def) {
        // Mesma peça, outras construções: preserva posição e giro para não "pular".
        this.ghost.group.position.copy(old.group.position);
        this.ghost.inner.rotation.y = old.inner.rotation.y;
      } else {
        const { x, z } = hexToWorld(q, r);
        this.ghost.group.position.set(x, 0.5 + (lvs ? lvs.own * LEVEL_STEP : 0), z);
        this.ghost.inner.rotation.y = -angle;
        this.ghostPrev.copy(this.ghost.group.position);
        this.ghostVel.set(0, 0);
      }
      old?.dispose();
    }
    this.ghost.group.visible = true;
    this.ghostAngle = angle;
    const { x, z } = hexToWorld(q, r);
    const ly = lvs ? lvs.own * LEVEL_STEP : 0;
    this.ghostTarget.set(x, 0.32 + ly, z);
    this.hoverRing.visible = true;
    const hf = this.fl(x, z);
    this.hoverRing.position.set(hf.x, -0.1 + ly, hf.z);
    this.hoverMat.color.set(check.valid ? '#ffffff' : '#ff5a4f');
    for (let i = 0; i < 6; i++) {
      const m = this.markers[i];
      const s = check.edgeState[i];
      const hs = check.heightState[i];
      m.visible = s === 1 || s === 3 || s === 4 || hs >= 2;
      if (!m.visible) continue;
      const [mx, mz] = edgeMid(i);
      this.markerLocal[i].set(mx * 0.93, 0.03, mz * 0.93);
      m.rotation.y = -(Math.PI / 6 + (Math.PI / 3) * i) + Math.PI / 2;
      (m.material as THREE.MeshBasicNodeMaterial).color.set(hs === 3 ? '#ff4a3d' : hs === 2 ? '#6fd0ff' : s === 1 ? '#ffffff' : s === 4 ? '#ffc83d' : '#ff4a3d');
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
    if (this.reducedMotion) return;
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
    h.mesh.position.set(x, 0.06 + this.heightAt(x, z), z);
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
    // Águas que descem: a nascente brilha ao nascer; ao chegar ao mar, o anel dourado e o bando de pássaros (a mesma festa das eras).
    if (res.water?.spring) this.burst(x, z, 'sparkle', 20, 0.05);
    if (res.water && res.water.seas > 0) {
      this.burst(x, z, 'sparkle', 60);
      if (!this.reducedMotion) {
        this.halo(x, z, 2);
        this.flushBirds(x, z);
      }
    }
    if (res.eraUp !== null) {
      this.eraUp(res.eraUp);
      if (!this.reducedMotion) {
        this.ripple(x, z, 2.2);
        this.burst(x, z, 'sparkle', 60);
        this.halo(x, z, 2);
        this.flushBirds(x, z);
      }
    }
  }

  /** Bando de pássaros que levanta voo do lugar (marcos da partida). */
  flushBirds(x: number, z: number) {
    if (this.reducedMotion) return;
    this.life.flush(x, z);
  }

  /** Nascentes: um brilho que sobe da poça de tempos em tempos (pelo `dt` do mundo, então a foto congela e o vídeo repete). */
  private springClock = 0;
  private stepSprings(dt: number) {
    if (!this.board?.rules.springs) return;
    this.springClock += dt;
    if (this.springClock < 0.9) return;
    this.springClock = 0;
    for (const p of this.board.list) {
      if (!p.spring) continue;
      const { x, z } = hexToWorld(p.q, p.r);
      this.burst(x, z, 'sparkle', 2, 0.04);
    }
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
    const h = this.heightAt(x, z);
    if (kind === 'dust') this.sprites.dust(x, z, tc(this.theme.smoke), n, h);
    else this.sprites.sparkle(x, z, tc(this.theme.sparkle), n, y + h);
  }

  private smokeCursor = 0;

  /** Névoa no pé das quedas à vista: 2 a 4 bolas vivas por queda, sorteadas pelo `dt` do mundo (parado no modo foto). */
  private spawnMist(dt: number) {
    const spots = this.falls.spots;
    if (!spots.length || dt <= 0 || this.rig.dist > 24) return;
    const tx = this.rig.target.x, tz = this.rig.target.z;
    const reach = this.rig.dist * 1.2 + 3;
    const f0 = this.theme.relief?.fall;
    const col = tc(f0?.mist ?? f0?.foam ?? '#f4f9ff');
    for (const f of spots) {
      if (this.sprites.count > 380) return;
      if (Math.abs(f.x - tx) > reach || Math.abs(f.z - tz) > reach) continue;
      if (Math.random() >= dt * 1.8) continue;
      // Casa vizinha vazia: a queda segue até o mar (ou o vazio); com a peça baixa assentada, a névoa sobe da água dela.
      const [nq, nr] = worldToHex(f.x + f.nx * 0.5, f.z + f.nz * 0.5);
      const y = this.board?.tiles.has(hkey(nq, nr)) ? f.y + WATER_Y - f.drop : -TILE_T - 0.1;
      this.sprites.mist(f.x + f.nx * FALL_D, y + 0.012, f.z + f.nz * FALL_D, f.nx, f.nz, col);
    }
  }

  /** Distância (no plano) de (x, z) à cachoeira mais próxima; Infinity se o mapa não tem nenhuma. */
  nearestFall(x: number, z: number): number {
    let best = Infinity;
    for (const f of this.falls.spots) best = Math.min(best, Math.hypot(f.x + f.nx * FALL_D * 0.5 - x, f.z + f.nz * FALL_D * 0.5 - z));
    return best;
  }

  private spawnSmoke(dt: number) {
    const n = this.chimneys.length / 4;
    if (!n || this.sprites.count > 380) return;
    const winter = U.season.value === 3;
    this.smokeClock += dt * Math.min(n * (winter ? 0.8 : 0.25), winter ? 14 : 7);
    const tx = this.rig.target.x, tz = this.rig.target.z;
    const view = this.rig.dist * 1.1;
    const puff = (i: number) => {
      const x = this.chimneys[i], y = this.chimneys[i + 1] * (this.lib.chimScale[this.chimneys[i + 3]] ?? 1), z = this.chimneys[i + 2];
      if (Math.abs(x - tx) > view || Math.abs(z - tz) > view) return false;
      this.sprites.smoke(x, y, z, tc(this.theme.smoke), U.wind.value);
      return true;
    };
    while (this.smokeClock > 1 && this.sprites.count <= 380) {
      this.smokeClock -= 1;
      if (winter) {
        // Cada chaminé à vista solta fumaça na sua vez.
        for (let k = 0; k < n && this.sprites.count <= 380; k++) if (puff((this.smokeCursor++ % n) * 4)) break;
      } else {
        for (let tries = 0; tries < 6; tries++) if (puff(Math.floor(Math.random() * n) * 4)) break;
      }
    }
  }

  // ---------------------------------------------------------------- utilidades

  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  /** Altura de foco da câmera, suavizada (a da casa sob o alvo). */
  private focusY = 0;
  private ndc = new THREE.Vector2();
  private groundHit = new THREE.Vector3();

  groundPoint(clientX: number, clientY: number, out = new THREE.Vector3()) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.ray.intersectPlane(this.plane, out);
  }

  /**
   * A casa sob o ponteiro, com relevo: testa o plano do topo de cada nível, do mais alto ao chão, e fica com a primeira
   * casa que alcança esse nível (se o raio entra pela parede de um platô, é a casa dele).
   */
  pickHex(clientX: number, clientY: number): [number, number] | null {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    for (let l = this.reliefMax; l >= 0; l--) {
      this.pickPlane.constant = -l * LEVEL_STEP;
      const hit = this.ray.ray.intersectPlane(this.pickPlane, this.groundHit);
      if (!hit) continue;
      const [wx, wz] = this.warp ? this.warp.inverse(hit.x, hit.z) : [hit.x, hit.z];
      const [q, r] = worldToHex(wx, wz);
      if (l === 0) return [q, r];
      if (this.pieceRelief) {
        if (this.board?.get(q, r) ? this.topOf(q, r) >= l : l <= this.handLevel) return [q, r];
      } else if (this.levelOf(q, r) >= l) return [q, r];
    }
    return null;
  }

  /**
   * Os 4 cantos da tela no chão (y = 0): esquerda e direita de baixo, depois as de cima.
   * Um raio que sobe para o céu para no horizonte, e um ponto longe demais fica preso a
   * `maxDist` da câmera, para o trapézio do minimapa não virar uma linha infinita.
   */
  viewOnGround(maxDist = 160): ({ x: number; z: number } | null)[] {
    const cam = this.camera.position;
    const hitAt = (nx: number, ny: number) => {
      this.ndc.set(nx, ny);
      this.ray.setFromCamera(this.ndc, this.camera);
      const hit = this.ray.ray.intersectPlane(this.plane, this.groundHit);
      if (!hit) return null;
      let x = hit.x;
      let z = hit.z;
      const dx = x - cam.x;
      const dz = z - cam.z;
      const d = Math.hypot(dx, dz);
      if (d > maxDist) {
        x = cam.x + (dx / d) * maxDist;
        z = cam.z + (dz / d) * maxDist;
      }
      return { x, z };
    };
    const corner = (nx: number, ny: number) => {
      const direct = hitAt(nx, ny);
      if (direct) return direct;
      let lo = -1;
      let hi = ny;
      let best = hitAt(nx, -1);
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        const h = hitAt(nx, mid);
        if (h) {
          best = h;
          lo = mid;
        } else hi = mid;
      }
      return best;
    };
    return [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  }

  // Chamado a cada quadro para cada marcador do HUD: reaproveita o vetor.
  private projV = new THREE.Vector3();
  project(x: number, y: number, z: number) {
    const v = this.projV.set(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.size.x, y: (-v.y * 0.5 + 0.5) * this.size.y, visible: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 };
  }

  /** Posição da i-ésima instância dos kits cuja chave começa com `prefix` (`gate`, `egg:`, `fauna:`...), ou null (capturas). */
  decoPos(prefix: string, i: number): { x: number; z: number; key: string } | null {
    let n = 0;
    for (const [id, p] of this.pools) {
      const key = poolKey(id);
      if (!key.startsWith(prefix)) continue;
      if (i - n < p.count) {
        const e = p.mesh.instanceMatrix.array as Float32Array;
        return { x: e[(i - n) * 16 + 12], z: e[(i - n) * 16 + 14], key };
      }
      n += p.count;
    }
    return null;
  }

  /** Posição da i-ésima serra ou morro assentado (`window.__relief`), ou null. */
  reliefPos(i: number): { x: number; z: number; kind: string } | null {
    const all: { x: number; z: number; kind: string }[] = [];
    for (const [k, p] of this.pools) {
      const kind = poolKey(k);
      if (kind !== 'peak' && kind !== 'hill') continue;
      for (let j = 0; j < p.count; j++) {
        p.mesh.getMatrixAt(j, tmpM);
        all.push({ x: tmpM.elements[12], z: tmpM.elements[14], kind });
      }
    }
    return all[i] ?? null;
  }

  /** Posição da i-ésima ponte assentada (`window.__bridge`), ou null. */
  bridgePos(i: number): { x: number; y: number; z: number; yaw: number } | null {
    const all: { x: number; y: number; z: number; yaw: number }[] = [];
    for (const [k, p] of this.pools) {
      if (poolKey(k) !== 'bridge') continue;
      for (let j = 0; j < p.count; j++) {
        p.mesh.getMatrixAt(j, tmpM);
        all.push({ x: tmpM.elements[12], y: tmpM.elements[13], z: tmpM.elements[14], yaw: Math.atan2(-tmpM.elements[2], tmpM.elements[0]) });
      }
    }
    return all[i] ?? null;
  }

  /** Custo por kit: instâncias e triângulos (para achar o que pesa). */
  poolReport() {
    return [...this.pools.entries()]
      .map(([k, p]) => {
        const kit = poolKey(k);
        const base = kit.endsWith('~') ? kit.slice(0, -1) : kit;
        return { k, n: p.count, tris: (p.count * (((this.farTrees && this.lib.farGeo(base)) || this.lib.geo(base))?.attributes.position.count ?? 0)) / 3, shadow: p.mesh.castShadow };
      })
      .sort((a, b) => b.tris - a.tris);
  }

  /**
   * Algo se move por conta própria (peça caindo, câmera chegando, fantasma deslizando, troca de
   * hora, avanço de era)? Enquanto sim, a economia de quadros (framePacing.ts) desenha a taxa cheia.
   * As animações contínuas do mundo (vento, água, bichos) não contam: andam bem em menos quadros.
   */
  isSettling() {
    return this.settlingWhy() !== '';
  }

  /** O que está se movendo (vazio = parado); serve ao `?debug` e a quem investiga por que a economia não entra. */
  settlingWhy(): string {
    if (this.drops.length) return 'peça caindo';
    if (this.centerAnim >= 0) return 'era';
    if (U.eraWave.value.w > 0 && this.time - U.eraWave.value.z < 8) return 'onda de era';
    const r = this.rig;
    if (r.target.distanceToSquared(r.goal) > 1e-6 || Math.abs(r.goalYaw - r.yaw) > 1e-3 || Math.abs(r.goalDist - r.dist) > 1e-3 || Math.abs(r.goalTilt - r.tilt) > 1e-3) return 'câmera';
    const g = this.ghost?.group;
    if (g?.visible && (Math.hypot(this.ghostTarget.x - g.position.x, this.ghostTarget.z - g.position.z) > 2e-3 || Math.abs(this.ghostVel.x) + Math.abs(this.ghostVel.y) > 0.02)) return 'fantasma';
    const a = this.sky, b = this.skyTarget;
    if (a && b && (Math.abs(a.night - b.night) > 1e-3 || Math.abs(a.sunI - b.sunI) > 1e-3 || a.sunDir.distanceToSquared(b.sunDir) > 1e-6 || Math.abs(a.haze - b.haze) > 1e-3)) return 'hora';
    return Math.abs(this.voidU.radius.value - this.voidGoal) > 1e-2 ? 'vazio' : '';
  }

  stats() {
    const info = this.renderer.info;
    let tris = 0;
    for (const c of this.chunks.values()) tris += c.triangles();
    let inst = 0;
    for (const p of this.pools.values()) inst += p.count;
    return { calls: info.render.drawCalls, triangles: info.render.triangles, chunks: this.chunks.size, pools: this.pools.size, instances: inst, groundTris: tris, life: this.life.counts(), eggSky: this.eggSky.k, backend: this.backend, shadowDraws: shadowCount.draws, shadowPasses: shadowCount.passes };
  }

  setPreview(def: TileDef | null, angle: number, stack: number) {
    // Relevo por peça: a pilha mostra o relevo da peça da vez (setores em degraus acima do menor, sem vizinhas).
    let levels: BuildOpts['levels'];
    this.handLevel = 0;
    if (def && this.pieceRelief) {
      const prof = tileProfile(def.edges, def.seed);
      const lo = Math.min(...prof.h);
      this.handLevel = lo;
      const sec = prof.h.map((v) => v - lo);
      const mean = prof.h.reduce((p, v) => p + v, 0) / 6 - lo;
      const co = prof.h.map((v, k) => (prof.h[(k + 5) % 6] + v) / 2 - lo);
      levels = { own: 0, nb: sec, sec, placed: sec.map(() => false), terrain: { h: sec, c: prof.c > Math.max(...prof.h) ? prof.c - lo : mean, he: sec, co } };
    }
    this.preview.set(def, () => this.build(def!, [], undefined, { levels }), angle, stack);
  }

  /** Depuração visual: todos os kits do tema lado a lado (?gallery). */
  showGallery(only?: string) {
    // `?gallery=casas` mostra só as casas (parede + telhado de cada tipo), maiores.
    // Qualquer outro valor filtra pelo prefixo da chave (`?gallery=wonder:`, `?gallery=gate`, `?gallery=egg:`), maiores.
    const keys = [...this.lib.geos.keys()].filter((k) => !k.startsWith('roof:') && (only !== 'casas' || k.startsWith('wall:')) && (!only || only === 'casas' || k.startsWith(only)));
    const cols = Math.ceil(Math.sqrt(keys.length));
    const root = new THREE.Group();
    keys.forEach((k, i) => {
      const geo = this.lib.geo(k)!;
      // Parede e telhado da mesma casa (`wall:i` e `roof:i`) vão juntos, na posição da parede.
      const roof = k.startsWith('wall:') ? this.lib.geo(`roof:${k.slice(5)}`) : null;
      const x = (i % cols) * 0.45, z = Math.floor(i / cols) * 0.45;
      const s = k.startsWith('crop:') || k === 'grass' || k === 'flower' || only ? 2.2 : 1.4;
      for (const [kk, gg] of roof ? ([[k, geo], [`roof:${k.slice(5)}`, roof]] as const) : ([[k, geo]] as const)) {
        const mesh = new THREE.InstancedMesh(instGeometry(gg, 1), this.lib.material(kk), 1);
        mesh.setMatrixAt(0, tmpM.makeScale(s, s, s).setPosition(x - (cols * 0.45) / 2, 0, z - (cols * 0.45) / 2));
        mesh.castShadow = true;
        root.add(mesh);
      }
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
    this.rig.dist = this.rig.goalDist = cols * (only === 'casas' ? 1.0 : only ? 1.1 : 0.62);
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
    shadowCount.draws = 0;
    this.renderer.info.reset();
    // A câmera, o fantasma e a troca de hora seguem o tempo real; o resto, o tempo do mundo.
    const dt = realDt * this.timeScale;
    this.time += dt;
    U.time.value = this.time;
    U.dt.value = Math.max(dt, 1e-4);
    // O vento muda de direção devagar.
    const wa = 0.65 + Math.sin(this.time * 0.05) * 0.5;
    U.wind.value.set(Math.cos(wa), Math.sin(wa));
    U.gust.value = this.theme?.atmos?.wind ?? 1;
    this.applySeason();
    this.stepWeather(dt);
    this.stepSky(realDt);
    this.voidU.radius.value += (this.voidGoal - this.voidU.radius.value) * Math.min(1, realDt / 1.2);
    this.rig.snap = this.reducedMotion;
    this.rig.update(realDt);
    // Relevo: a câmera olha à altura da casa sob o alvo, sem pular entre níveis.
    if (this.reliefMax || this.focusY !== 0) {
      const gy = this.heightAt(this.rig.target.x, this.rig.target.z);
      this.focusY += (gy - this.focusY) * (this.rig.snap ? 1 : 1 - Math.exp(-realDt * 5));
      if (Math.abs(this.focusY - gy) < 1e-4) this.focusY = gy;
      this.rig.target.y = this.focusY;
    }
    this.rig.apply(this.camera);

    // Distâncias de verdade até a câmera (rig.eye), não o enquadramento (rig.dist).
    const eye = this.rig.eye;
    // Com o zoom aberto o tabuleiro inteiro cabe na névoa de alcance (que só media a distância do
    // olho): ela começa depois da borda da região explorada, e só o entorno distante desbota.
    // A faixa mantém a largura de antes (2,7×eye); perto (rig.dist <= 14) nada muda.
    const open = THREE.MathUtils.smoothstep(this.rig.dist, 14, 24);
    const near0 = eye * 1.5;
    const near = THREE.MathUtils.lerp(near0, Math.max(near0, eye + this.voidU.radius.value * 2.2), open);
    A.near.value = near;
    A.far.value = near + eye * 2.7;
    groundMap.flush();
    seaMap.flush();
    riverMap.flush();
    // Aurora boreal: a cúpula acompanha a câmera e só existe à noite, quando o tema a pede.
    this.auroraDome.visible = this.quality !== 'low' && U.aurora.value > 0.01;
    this.auroraDome.position.copy(this.camera.position);
    this.stepEggSky(dt);
    // As nuvens aparecem quando a câmera sobe bem acima delas (não no nível Baixo).
    // A laje é marchada de cima: com a câmera inclinada até perto dela, as nuvens somem.
    const cloudHigh = THREE.MathUtils.smoothstep(this.camera.position.y, CLOUD_TOP + 1.5, CLOUD_TOP + 4);
    CL.fade.value = this.quality === 'low' ? 0 : THREE.MathUtils.smoothstep(this.rig.dist, 20, 28) * cloudHigh;
    CL.focus.value.set(this.rig.target.x, this.rig.target.z, this.rig.dist);
    this.clouds.visible = CL.fade.value > 1e-3;

    // Foco da profundidade de campo: o ponto que a câmera olha.
    P.focus.value = eye;
    // De longe a faixa nítida estreita: o mapa inteiro vira maquete (tilt-shift).
    P.focalLength.value = eye * THREE.MathUtils.lerp(0.42, 0.16, THREE.MathUtils.smoothstep(this.rig.dist, 10, 30));
    // Desfoque de miniatura (Alta e Ultra): quase some de perto, é pleno no zoom médio e recua no aberto.
    // Sobe do perto ao zoom médio (pico em rig.dist ~14) e cai de novo no zoom aberto (0,25 a partir de 26):
    // de longe o tabuleiro inteiro tem de continuar legível.
    P.tilt.value = THREE.MathUtils.lerp(0.12, 1, THREE.MathUtils.smoothstep(this.rig.dist, 6, 14)) * THREE.MathUtils.lerp(1, 0.25, THREE.MathUtils.smoothstep(this.rig.dist, 16, 26));
    // O traço é pleno em volta do foco e some antes da névoa, senão o fundo vira hachura.
    // Com a câmera baixa o fundo fica longe: o traço vai até perto de onde a névoa fecha (4,2×).
    P.inkNear.value = eye * 2;
    P.inkFar.value = eye * 3.8;
    // Gradação: realces na cor do sol e sombras no tom oposto (frias com o sol quente da tarde).
    const day = 1 - this.sky.night;
    tintOf(this.sky.sun, -0.14 * day, P.shade.value);
    tintOf(this.sky.sun, 0.08 * day, P.light.value);
    // Gradação do tema por cima da hora: mais leve à noite, que já tem a cor do luar.
    const g = this.theme.grade, gk = 0.55 + 0.45 * day;
    P.shade.value.multiply(tintOf(tmpColor.set(g.shadow), 0.16 * gk, tmpGrade));
    P.light.value.multiply(tintOf(tmpColor.set(g.light), 0.09 * gk, tmpGrade));
    // De longe as cores perdem força na distância: um pouco mais de saturação devolve a leitura.
    P.saturation.value = THREE.MathUtils.lerp(1.06, 1.12, open) * g.saturation;
    const filt = this.theme.atmos?.filter;
    P.filter.value.set(filt?.[0] ?? 1, filt?.[1] ?? 1, filt?.[2] ?? 1);

    // Sol acompanha o alvo; área da sombra acompanha o zoom.
    // Com sombra única, o mapa só é redesenhado quando a câmera anda, o zoom muda, uma peça
    // assenta (shadowClock forçado no bake) ou passam 0,25 s. Entre um redesenho e outro a
    // luz fica parada, senão o mapa velho escorrega em relação ao chão.
    this.shadowClock += realDt;
    const sd = this.sky.sunDir;
    const ext = Math.min(28, this.rig.dist * 0.95 + 2);
    const tx = this.rig.target.x, tz = this.rig.target.z;
    // Com cascatas (Ultra e Cinema) vale a mesma regra, com limiares mais finos: o mapa é de 4096
    // sobre um recorte pequeno. O sol se mover mais de ~0,4°, a câmera andar ou girar, uma peça
    // assentar (shadowClock forçado) ou passarem 0,25 s (árvores ao vento, barcos, moinhos) refaz.
    const cam = this.camera;
    let csmDue = false;
    if (this.csm) {
      const lit = this.csm.lights;
      if (lit.length && !this.csmGated) {
        // As cascatas nascem como cópia da sombra do sol (autoUpdate ligado) e desenham no
        // primeiro quadro; depois disso só quando pedimos.
        this.csmGated = true;
        csmDue = true;
      }
      if (this.csmGated) {
        // O mapa próprio do sol não é lido com cascatas: não há motivo para redesenhá-lo.
        this.sun.shadow.autoUpdate = false;
        for (const l of lit) l.shadow!.autoUpdate = false;
      }
      csmDue ||= this.shadowClock >= 0.25
        || sd.dot(this.csmSun) < 0.99998
        || cam.position.distanceToSquared(this.csmCamPos) > 0.0225
        || cam.quaternion.angleTo(this.csmCamQuat) > 0.006;
    }
    const shadowDue = this.csm ? csmDue
      : this.shadowClock >= 0.25
        || Math.hypot(tx - this.shadowAt.x, tz - this.shadowAt.y) > 0.35
        || Math.abs(this.rig.dist - this.shadowDist) > 0.4;
    if (shadowDue) {
      this.shadowAt.set(tx, tz);
      this.shadowDist = this.rig.dist;
      this.shadowClock = 0;
      if (!this.csm) this.sun.shadow.needsUpdate = true;
      else {
        for (const l of this.csm.lights) l.shadow!.needsUpdate = true;
        this.csmSun.copy(sd);
        this.csmCamPos.copy(cam.position);
        this.csmCamQuat.copy(cam.quaternion);
      }
      // Sem cascatas, o centro da sombra anda de texel em texel no plano da luz: as bordas não
      // tremem quando a câmera desliza (as cascatas do Ultra já se prendem à grade sozinhas).
      const t = this.csm ? this.rig.target : snapToTexel(this.rig.target, sd, (2 * ext) / this.sun.shadow.mapSize.x, tmpSnap);
      this.sun.target.position.copy(t);
      this.sun.position.set(t.x + sd.x * 20, t.y + sd.y * 20, t.z + sd.z * 20);
      if (this.csm) {
        // As cascatas vão da câmera até onde a névoa fecha; acompanham o zoom.
        const far = Math.round(this.rig.eye * 4.7 * 4) / 4;
        if (this.csm.maxFar !== far && this.csm.camera) {
          this.csm.maxFar = far;
          this.csm.updateFrustums();
        }
      }
      if (this.rayLight.parent) {
        // O mapa dos raios também fica guardado: o redesenho acompanha o do sol.
        this.rayLight.shadow.autoUpdate = false;
        this.rayLight.shadow.needsUpdate = true;
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
      }
      const scam = this.sun.shadow.camera;
      if (!this.csm && scam.right !== ext) {
        scam.left = -ext;
        scam.right = ext;
        scam.top = ext;
        scam.bottom = -ext;
        scam.near = 1;
        scam.far = 60;
        scam.updateProjectionMatrix();
      }
    }
    if (this.rayLight.parent) {
      // Feixes só com o sol baixo (entardecer): ao meio-dia viram um véu branco sem forma.
      const low = 1 - THREE.MathUtils.clamp(sd.y / Math.max(1e-3, Math.hypot(sd.x, sd.y, sd.z)), 0, 1);
      P.rays.value = THREE.MathUtils.clamp((low - 0.25) / 0.4, 0, 1) * 0.4 * (1 - this.sky.night) * Math.min(1, this.sky.sunI);
      P.rayColor.value.copy(this.sky.sun);
    }

    // Fantasma: flutua e gira suavemente até a orientação escolhida.
    if (this.ghost && this.ghost.group.visible) {
      const g = this.ghost.group;
      const k = 1 - Math.exp(-realDt * 16);
      g.position.x += (this.ghostTarget.x - g.position.x) * k;
      g.position.z += (this.ghostTarget.z - g.position.z) * k;
      const bob = this.reducedMotion ? 0 : Math.sin(this.time * 2.4) * 0.025;
      g.position.y += (this.ghostTarget.y + bob - g.position.y) * k;
      const inner = this.ghost.inner;
      inner.rotation.y += (-this.ghostAngle - inner.rotation.y) * (1 - Math.exp(-realDt * 18));
      // Inclina na direção em que desliza, como uma bandeja carregada.
      const kv = 1 - Math.exp(-realDt * 10);
      this.ghostVel.x += ((g.position.x - this.ghostPrev.x) / Math.max(realDt, 1e-3) - this.ghostVel.x) * kv;
      this.ghostVel.y += ((g.position.z - this.ghostPrev.z) / Math.max(realDt, 1e-3) - this.ghostVel.y) * kv;
      this.ghostPrev.copy(g.position);
      const lean = this.reducedMotion ? 0 : 0.035;
      g.rotation.x = THREE.MathUtils.clamp(this.ghostVel.y * lean, -0.22, 0.22);
      g.rotation.z = THREE.MathUtils.clamp(-this.ghostVel.x * lean, -0.22, 0.22);
      for (let i = 0; i < 6; i++) if (this.markers[i].visible) this.markers[i].position.copy(g.position).add(this.markerLocal[i]);
    }

    this.stepHalos(dt);
    this.stepSprings(dt);
    this.stepCenter(dt);
    this.stepWonder(dt);

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
        g.position.y = d.ly + (d.y0 - d.ly) * (1 - u * u);
      } else {
        // Assenta com um quique pequeno.
        const ub = Math.min(1, (d.t - fall) / 0.34);
        g.position.y = d.ly + 0.022 * Math.abs(Math.sin(ub * Math.PI)) * (1 - ub);
        if (!d.landed) {
          d.landed = true;
          this.burst(g.position.x, g.position.z, 'dust', 22);
          this.ripple(g.position.x, g.position.z);
          this.fireEggs(d.placed);
        }
        const u = (d.t - fall) / 0.32;
        const squash = this.reducedMotion ? 0 : Math.sin(Math.min(1, u) * Math.PI);
        g.scale.set(1 + squash * 0.03, 1 - squash * 0.08, 1 + squash * 0.03);
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
        this.syncWater();
        d.live.dispose();
        if (this.board) {
          this.life.sync(this.board);
          this.fireflies.sync(this.board);
        }
        this.drops = this.drops.filter((x) => x !== d);
        if (this.board) this.syncWonder(this.board, true);
        this.onBaked?.(d.placed);
      } else still.push(d);
    }
    this.drops = still;

    // Nível de detalhe: de longe, metade das plantas basta (as parcelas já têm a cor da cultura).
    // Entre 11,5 e 14,5 de distância, cada planta dessa metade afunda no chão na sua vez.
    // Ultra e Cinema guardam o detalhe fino até mais longe (a mesma conta da densidade de decoração).
    const reach = this.quality === 'cinema' ? 1.6 : this.quality === 'ultra' ? 1.35 : 1;
    // Primavera: a metade fina das plantas (flores) fica de pé até mais longe.
    const spring = U.season.value === 0 ? 1.35 : 1;
    const fine = 1 - THREE.MathUtils.smoothstep(this.rig.dist, 11.5 * reach * spring, 14.5 * reach * spring);
    U.fine.value = fine;
    for (const [k, p] of this.pools) if (poolKey(k).endsWith('~')) p.mesh.visible = fine > 0;
    // Árvores leves: bem depois de a metade fina sumir, quando a copa já é uma mancha de poucos pixels
    // (com folga de ±0,4, para não piscar no limite).
    const treeEdge = 18 * reach * spring;
    this.setFarTrees(this.rig.dist > treeEdge + (this.farTrees ? -0.4 : 0.4));

    // Aldeões só de perto, com o mesmo limiar da metade fina das plantas.
    this.life.folkNear = this.rig.dist < 13 * reach;
    this.life.night = U.night.value;
    this.life.phase = phaseOfTod(this.timeOfDay);
    this.life.update(dt);
    this.life.wakes(this.rig.target.x, this.rig.target.z);
    this.spawnSmoke(dt);
    this.spawnMist(dt);
    this.sprites.update(dt);
    this.updateFxUniforms();
    this.slots.visible = this.slotCount > 0 && this.showSlots;
    this.infl.visible = this.infl.count > 0 && this.showSlots;
    // Grão: um padrão novo a cada quadro (passageiro, não precisa de semente). Sem o nó, o uniforme não entra no shader.
    P.grainSeed.value = Math.floor(Math.random() * 3e6);

    if (this.post) this.post.pipeline.render();
    else this.renderer.render(this.scene, this.camera);

    this.preview.render(realDt);
  }
}
