import * as THREE from 'three/webgpu';
import { abs, attribute, cos, float, fract, length, max, mix, positionGeometry, sin, smoothstep, texture, uniform, uv, vec2, vec3 } from 'three/tsl';
import type { Board } from '../core/board';
import { hexToWorld } from '../core/hex';
import { T } from '../core/tiles';
import type { Theme, WeatherKind } from '../themes/types';
import { U, noiseTex } from './materials';
import { P } from './post';

// Efeitos de partículas, todos em "sprites" voltados para a câmera:
//   Sprites: poeira, fumaça e brilhos, simulados na CPU (algumas centenas);
//   Weather: neve, pétalas, folhas, poeira e pólen, simulados no shader (custo zero de CPU);
//   Fireflies: vaga-lumes sobre prados e matas à noite, também no shader.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/** Eixos da câmera e o ponto que ela olha (atualizados pelo World a cada quadro). */
export const FX = {
  right: uniform(new THREE.Vector3(1, 0, 0)),
  up: uniform(new THREE.Vector3(0, 1, 0)),
  focus: uniform(new THREE.Vector3()),
  /** Meia largura e altura da caixa onde o clima acontece, em volta do foco. */
  box: uniform(new THREE.Vector2(10, 3)),
  /** Escala das partículas (cresce com a distância da câmera, para continuarem visíveis). */
  scale: uniform(1),
  /** Quanto de luz há (as partículas não são iluminadas; escurecem à noite). */
  ambient: uniform(new THREE.Color(1, 1, 1)),
};

/** Geometria de quadrado instanciada (sem InstancedMesh: atributos próprios por instância). */
function quad(n: number, attrs: Record<string, number>) {
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(base.index);
  g.setAttribute('position', base.getAttribute('position'));
  g.setAttribute('uv', base.getAttribute('uv'));
  for (const [name, size] of Object.entries(attrs)) g.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(n * size), size));
  g.instanceCount = 0;
  return g;
}

const billboard = (center: N, local: N) => center.add(FX.right.mul(local.x)).add(FX.up.mul(local.y));

// ---------------------------------------------------------------- sprites na CPU

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
  grow: number;
  color: THREE.Color;
  alpha: number;
  drag: number;
  gravity: number;
  seed: number;
}

class SpriteLayer {
  readonly mesh: THREE.Mesh;
  private list: Particle[] = [];
  private geo: THREE.InstancedBufferGeometry;

  /**
   * `ball`: bolas de fumaça como no Dorfromantik, opacas, com borda nítida, sombreadas como uma
   * esfera (luz de cima à esquerda) e contornadas de tinta; crescem e encolhem em vez de sumir.
   */
  constructor(
    private cap: number,
    additive: boolean,
    private ball = false,
  ) {
    this.geo = quad(cap, { sPos: 4, sCol: 4, sSeed: 1 });
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true });
    const sp = attribute('sPos', 'vec4');
    const sc = attribute('sCol', 'vec4');
    const seed = attribute('sSeed', 'float');
    m.positionNode = billboard(sp.xyz, positionGeometry.xy.mul(sp.w));
    const d = length(uv().sub(0.5));
    if (ball) {
      // Raio 1 na borda do disco; a normal da esfera sai da posição no disco.
      const q = uv().sub(0.5).mul(2.05);
      const r = length(q);
      const n = vec3(q, float(1).sub(r.mul(r)).max(0).sqrt());
      const lit = n.dot(vec3(-0.45, 0.6, 0.66)).max(0).mul(0.36).add(0.6);
      const ring = smoothstep(0.82, 0.87, r);
      m.colorNode = mix(sc.rgb.mul(lit).mul(FX.ambient), P.inkColor, ring.mul(0.9));
      m.opacityNode = sc.a.mul(smoothstep(1, 0.95, r));
    } else {
      // Bordas irregulares (fumaça "fofa"): o ruído come o contorno do disco.
      const puff = texture(noiseTex, uv().mul(0.35).add(vec2(seed, seed.mul(1.7)))).a;
      const soft = smoothstep(0.5, 0.12, d.add(puff.sub(0.5).mul(additive ? 0 : 0.35)));
      m.colorNode = additive ? sc.rgb : sc.rgb.mul(FX.ambient);
      m.opacityNode = sc.a.mul(soft);
    }
    this.mesh = new THREE.Mesh(this.geo, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  get count() {
    return this.list.length;
  }

  add(p: Particle) {
    if (this.list.length < this.cap) this.list.push(p);
  }

  update(dt: number) {
    const pos = this.geo.getAttribute('sPos') as THREE.InstancedBufferAttribute;
    const col = this.geo.getAttribute('sCol') as THREE.InstancedBufferAttribute;
    const sd = this.geo.getAttribute('sSeed') as THREE.InstancedBufferAttribute;
    const out: Particle[] = [];
    let i = 0;
    for (const p of this.list) {
      p.age += dt;
      if (p.age >= p.life) continue;
      // Idade negativa: a bola ainda vai sair da chaminé (as de um mesmo rolo saem em fila).
      if (p.age < 0) {
        out.push(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vz *= k;
      p.vy = p.vy * k - p.gravity * dt;
      const t = p.age / p.life;
      // A bola não fica transparente: no fim encolhe até sumir.
      const fade = this.ball ? Math.min(1, t * 12) : Math.min(1, t * 6) * (1 - t) * (1 - t);
      const shrink = this.ball ? 1 - Math.max(0, (t - 0.55) / 0.45) ** 1.5 : 1;
      pos.setXYZW(i, p.x, p.y, p.z, p.size * (1 + p.grow * t) * shrink);
      col.setXYZW(i, p.color.r, p.color.g, p.color.b, p.alpha * fade);
      sd.setX(i, p.seed);
      out.push(p);
      i++;
    }
    this.list = out;
    this.geo.instanceCount = i;
    pos.needsUpdate = col.needsUpdate = sd.needsUpdate = true;
  }

  clear() {
    this.list = [];
    this.geo.instanceCount = 0;
  }
}

const WHITE = new THREE.Color(1, 1, 1);
const SPLASH = new THREE.Color(0.95, 0.97, 1);

/** Poeira (normal), brilhos (aditivos) e fumaça em bolas. */
export class Sprites {
  readonly group = new THREE.Group();
  private soft = new SpriteLayer(420, false);
  private glow = new SpriteLayer(260, true);
  private balls = new SpriteLayer(240, false, true);

  constructor() {
    this.group.add(this.soft.mesh, this.glow.mesh, this.balls.mesh);
  }

  get count() {
    return this.soft.count + this.glow.count + this.balls.count;
  }

  /** Anel de poeira quando a peça assenta. */
  dust(x: number, z: number, color: THREE.Color, n: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const r = 0.82 + Math.random() * 0.15;
      const sp = 0.35 + Math.random() * 0.45;
      this.soft.add({ x: x + Math.cos(a) * r, y: 0.02, z: z + Math.sin(a) * r, vx: Math.cos(a) * sp, vy: 0.12 + Math.random() * 0.18, vz: Math.sin(a) * sp, age: 0, life: 0.8 + Math.random() * 0.5, size: 0.16 + Math.random() * 0.12, grow: 1.6, color, alpha: 0.55, drag: 3, gravity: 0.05, seed: Math.random() });
    }
  }

  /** Faíscas douradas que sobem e caem (encaixe perfeito, missão, peça cercada). */
  sparkle(x: number, z: number, color: THREE.Color, n: number, y = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.6;
      const sp = 0.2 + Math.random() * 0.4;
      this.glow.add({ x: x + Math.cos(a) * r, y: y + 0.1 + Math.random() * 0.2, z: z + Math.sin(a) * r, vx: Math.cos(a) * sp, vy: 0.9 + Math.random() * 0.9, vz: Math.sin(a) * sp, age: 0, life: 0.9 + Math.random() * 0.7, size: 0.05 + Math.random() * 0.05, grow: -0.6, color, alpha: 1.6, drag: 0.8, gravity: 1.6, seed: Math.random() });
    }
  }

  /** Respingo de peixe: gotas brancas que sobem um palmo e caem de volta na água. */
  splash(x: number, y: number, z: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.05 + Math.random() * 0.08;
      this.glow.add({ x: x + Math.cos(a) * 0.01, y: y + 0.005, z: z + Math.sin(a) * 0.01, vx: Math.cos(a) * sp, vy: 0.35 + Math.random() * 0.25, vz: Math.sin(a) * sp, age: 0, life: 0.45 + Math.random() * 0.2, size: 0.012 + Math.random() * 0.01, grow: -0.4, color: SPLASH, alpha: 0.9, drag: 0.5, gravity: 2.2, seed: Math.random() });
    }
  }

  /** Um rolo de fumaça de chaminé: três bolas claras (a cor do tema puxada para o branco) em fila, que sobem e derivam com o vento. */
  smoke(x: number, y: number, z: number, color: THREE.Color, wind: THREE.Vector2) {
    const c = color.clone().lerp(WHITE, 0.6);
    for (let k = 0; k < 3; k++) {
      this.balls.add({ x, y, z, vx: wind.x * 0.06, vy: 0.14 + Math.random() * 0.04, vz: wind.y * 0.06, age: -k * 0.5, life: 2.6 + Math.random() * 0.8, size: 0.05 + Math.random() * 0.015, grow: 1.5, color: c, alpha: 1, drag: 0.4, gravity: -0.01, seed: Math.random() });
    }
  }

  update(dt: number) {
    this.soft.update(dt);
    this.glow.update(dt);
    this.balls.update(dt);
  }

  clear() {
    this.soft.clear();
    this.glow.clear();
    this.balls.clear();
  }
}

// ---------------------------------------------------------------- clima no shader

/** Parâmetros de cada tipo de clima (o tema escolhe o tipo, as cores e a densidade). */
const KINDS: Record<Exclude<WeatherKind, 'none'>, { size: number; fall: [number, number]; drift: number; sway: number; spin: number; flutter: number; aspect: number; glow: number; count: number }> = {
  snow: { size: 0.035, fall: [0.22, 0.4], drift: 0.15, sway: 0.12, spin: 0, flutter: 0, aspect: 1, glow: 0.15, count: 900 },
  petals: { size: 0.07, fall: [0.18, 0.32], drift: 0.35, sway: 0.25, spin: 2.2, flutter: 0.85, aspect: 0.62, glow: 0.05, count: 520 },
  leaves: { size: 0.075, fall: [0.25, 0.42], drift: 0.3, sway: 0.3, spin: 2.8, flutter: 0.8, aspect: 0.42, glow: 0, count: 380 },
  dust: { size: 0.022, fall: [0.02, 0.06], drift: 0.9, sway: 0.08, spin: 0, flutter: 0, aspect: 1, glow: 0.05, count: 700 },
  pollen: { size: 0.022, fall: [0.015, 0.05], drift: 0.25, sway: 0.18, spin: 0, flutter: 0, aspect: 1, glow: 0.45, count: 420 },
};

export class Weather {
  readonly mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private max = 1000;
  private u = {
    size: uniform(0.03),
    fallMin: uniform(0.2),
    fallMax: uniform(0.4),
    drift: uniform(0.2),
    sway: uniform(0.1),
    spin: uniform(0),
    flutter: uniform(0),
    aspect: uniform(1),
    glow: uniform(0),
    c1: uniform(new THREE.Color('#ffffff')),
    c2: uniform(new THREE.Color('#ffffff')),
  };
  private want = 0;

  constructor() {
    this.geo = quad(this.max, { wSeed: 4 });
    const seeds = this.geo.getAttribute('wSeed') as THREE.InstancedBufferAttribute;
    for (let i = 0; i < this.max; i++) seeds.setXYZW(i, Math.random(), Math.random(), Math.random(), Math.random());
    const u = this.u;
    const s = attribute('wSeed', 'vec4');
    const t = U.time;
    const W = FX.box.x.mul(2);
    const H = FX.box.y;
    const speed = mix(u.fallMin, u.fallMax, s.w);
    const drift = U.wind.mul(u.drift.mul(t));
    // Presa ao mundo, mas sempre dentro de uma caixa em volta do foco da câmera.
    const wrap = (seed: N, d: N, c: N) => c.add(fract(seed.mul(W).add(d).sub(c).div(W)).sub(0.5).mul(W));
    const px = wrap(s.x, drift.x, FX.focus.x).add(sin(t.mul(1.3).add(s.w.mul(20))).mul(u.sway));
    const pz = wrap(s.z, drift.y, FX.focus.z).add(cos(t.mul(1.1).add(s.x.mul(20))).mul(u.sway));
    const py = float(1).sub(fract(s.y.add(t.mul(speed).div(H)))).mul(H).sub(0.15);
    const ang = t.mul(u.spin).mul(s.y.sub(0.5).mul(2)).add(s.z.mul(6.283));
    const flip = mix(float(1), abs(sin(t.mul(3.1).add(s.x.mul(30)))).max(0.15), u.flutter);
    const sz = u.size.mul(FX.scale).mul(s.w.mul(0.6).add(0.7));
    const lx = positionGeometry.x.mul(sz).mul(u.aspect).mul(flip);
    const ly = positionGeometry.y.mul(sz);
    const rx = lx.mul(cos(ang)).sub(ly.mul(sin(ang)));
    const ry = lx.mul(sin(ang)).add(ly.mul(cos(ang)));
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
    m.positionNode = billboard(vec3(px, py, pz), vec2(rx, ry));
    const d = length(uv().sub(0.5).mul(2));
    const edge = max(abs(px.sub(FX.focus.x)), abs(pz.sub(FX.focus.z))).div(FX.box.x);
    const fade = smoothstep(1, 0.75, edge).mul(smoothstep(-0.15, 0.08, py)).mul(smoothstep(H.sub(0.15), H.sub(0.6), py));
    m.colorNode = mix(u.c1, u.c2, s.x).mul(FX.ambient.mul(float(1).sub(u.glow)).add(u.glow));
    m.opacityNode = smoothstep(1, 0.55, d).mul(fade).mul(0.9);
    this.mesh = new THREE.Mesh(this.geo, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  setTheme(theme: Theme) {
    const w = theme.weather;
    if (w.kind === 'none') {
      this.want = 0;
      return;
    }
    const k = KINDS[w.kind];
    const u = this.u;
    u.size.value = k.size;
    u.fallMin.value = k.fall[0];
    u.fallMax.value = k.fall[1];
    u.drift.value = k.drift;
    u.sway.value = k.sway;
    u.spin.value = k.spin;
    u.flutter.value = k.flutter;
    u.aspect.value = k.aspect;
    u.glow.value = k.glow;
    u.c1.value.set(w.colors[0]);
    u.c2.value.set(w.colors[1]);
    this.want = Math.min(this.max, Math.round(k.count * w.density));
  }

  /** Densidade pela qualidade (1 = cheia, 0 = desliga). */
  setDetail(f: number) {
    this.geo.instanceCount = Math.round(this.want * f);
  }

  get count() {
    return this.geo.instanceCount;
  }
}

// ---------------------------------------------------------------- vaga-lumes

export class Fireflies {
  readonly mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private max = 140;

  constructor() {
    this.geo = quad(this.max, { fBase: 4 });
    const b = attribute('fBase', 'vec4');
    const t = U.time;
    const ph = b.w;
    const p = b.xyz.add(vec3(sin(t.mul(0.55).add(ph.mul(7))).mul(0.16), sin(t.mul(1.2).add(ph.mul(3))).mul(0.05).add(0.1), cos(t.mul(0.47).add(ph.mul(5))).mul(0.16)));
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
    m.positionNode = billboard(p, positionGeometry.xy.mul(FX.scale.mul(0.03)));
    const blink = smoothstep(0.55, 0.95, sin(t.mul(1.7).add(ph.mul(20))).mul(0.5).add(0.5));
    const night = smoothstep(0.55, 0.9, U.night);
    const d = length(uv().sub(0.5).mul(2));
    m.colorNode = vec3(0.85, 1, 0.45).mul(2.2);
    m.opacityNode = smoothstep(1, 0.1, d).mul(blink).mul(night);
    this.mesh = new THREE.Mesh(this.geo, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  /** Espalha os vaga-lumes sobre peças com prado ou floresta (refeito quando o mapa cresce). */
  sync(board: Board) {
    const spots: { x: number; z: number }[] = [];
    for (const p of board.list) {
      const green = p.edges.filter((e) => e === T.Grass || e === T.Forest).length;
      if (green >= 2) spots.push(hexToWorld(p.q, p.r));
    }
    const a = this.geo.getAttribute('fBase') as THREE.InstancedBufferAttribute;
    const n = spots.length ? Math.min(this.max, spots.length * 3) : 0;
    for (let i = 0; i < n; i++) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      const r = Math.random() * 0.75, ang = Math.random() * Math.PI * 2;
      a.setXYZW(i, s.x + Math.cos(ang) * r, 0.02 + Math.random() * 0.12, s.z + Math.sin(ang) * r, Math.random());
    }
    a.needsUpdate = true;
    this.geo.instanceCount = n;
  }
}
