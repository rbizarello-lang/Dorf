// Um palco = o conjunto de pools instanciados de uma vista. As construções são posicionadas por um "Place"
// (posição, giro e escala), de modo que a MESMA função monta o diorama grande e a miniatura do mapa.
import * as THREE from 'three';
import { Pool, type PItem } from './pool';
import { KITS, geoOf } from './kits';
import { glowTexture } from './tex';
import { smooth } from './rng';
import type { Water } from './island';

export interface Env { t: number; dt: number; night: number; dusk: number; wind: number; cam: THREE.Camera }
export interface Place { x: number; y: number; z: number; yaw: number; s: number }
export const HERE: Place = { x: 0, y: 0, z: 0, yaw: 0, s: 1 };

/** Cor noturna das janelas e lanternas: o material soma isto vezes o atributo `glow` de cada vértice. */
export const U_GLOW = { value: new THREE.Color(0, 0, 0) };

function glowify(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = U_GLOW;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGlow;\nvarying float vGlow;')
      .replace('#include <opaque_fragment>', 'outgoingLight += uGlow * vGlow;\n#include <opaque_fragment>');
  };
  return m;
}

export const MATS = {
  lit: glowify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 })),
  metal: glowify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6, envMapIntensity: 1.2 })),
  sail: (() => { const m = glowify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })); return m; })(),
  glow: new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false }),
  beam: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide }),
  puff: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, transparent: true, opacity: 0.9, depthWrite: false }),
};

const PLANE = (() => { const g = new THREE.PlaneGeometry(1, 1); return g; })();

export class Stage {
  readonly group = new THREE.Group();
  readonly pools = new Map<string, Pool>();
  readonly anims: ((e: Env) => void)[] = [];
  readonly waters: Water[] = [];
  /** A capital reage à semana (1 ou 4). */
  weekHook?: (w: number, instant: boolean) => void;
  P: Place = { ...HERE };
  private glows: { it: PItem; size: number; col: THREE.Color; flick: number }[] = [];
  private smokes: { x: number; y: number; z: number; s: number; ph: number; str: number }[] = [];
  private billQ = new THREE.Quaternion();
  /** Quanto os brilhos aparecem à noite (para o mapa, com os postos sempre acesos). */
  glowMin = 0;

  constructor(readonly name: string) { this.group.name = name; }

  /** Muda onde as próximas peças serão postas. */
  at(x: number, y: number, z: number, yaw: number, s: number): void { this.P = { x, y, z, yaw, s }; }

  world(lx: number, ly: number, lz: number): THREE.Vector3 {
    const { x, y, z, yaw, s } = this.P, c = Math.cos(yaw), si = Math.sin(yaw);
    return new THREE.Vector3(x + (lx * c + lz * si) * s, y + ly * s, z + (-lx * si + lz * c) * s);
  }

  pool(kit: string): Pool {
    let p = this.pools.get(kit);
    if (p) return p;
    const def = KITS[kit];
    if (!def) throw new Error('kit desconhecido: ' + kit);
    const mat = def.mat === 'lit' ? MATS.lit : def.mat === 'metal' ? MATS.metal : def.mat === 'sail' ? MATS.sail : def.mat === 'beam' ? MATS.beam : def.mat === 'puff' ? MATS.puff : MATS.glow;
    p = new Pool(def.mat === 'glow' ? PLANE : geoOf(kit), mat, def.cap ?? 600, { cast: def.cast ?? true, receive: def.receive ?? true, name: kit });
    if (def.mat === 'glow') { p.billboard = this.billQ; p.always = true; p.mesh.renderOrder = 6; }
    if (def.mat === 'puff') p.mesh.renderOrder = 4;
    this.pools.set(kit, p);
    this.group.add(p.mesh);
    return p;
  }

  /** Põe uma peça; as coordenadas são locais ao Place atual. */
  put(kit: string, lx: number, ly: number, lz: number, yaw = 0, s = 1, o: Partial<PItem> = {}): PItem {
    const w = this.world(lx, ly, lz);
    return this.pool(kit).add(w.x, w.y, w.z, yaw + this.P.yaw, s * this.P.s, o);
  }

  /** Cor com variação de brilho determinística (sem mexer na sequência de sorteio dos outros). */
  tone(v: number, hue = 0): THREE.Color { return new THREE.Color(v, v * (1 + hue * 0.3), v * (1 - hue * 0.3)); }

  /** Brilho aditivo (janela, lanterna) que acende com a noite. */
  glow(lx: number, ly: number, lz: number, size: number, col: THREE.ColorRepresentation = 0xffb360, flick = 0): PItem {
    const it = this.put('glow', lx, ly, lz, 0, size, { col: new THREE.Color(col) });
    this.glows.push({ it, size: it.bx, col: new THREE.Color(col), flick });
    return it;
  }

  smoke(lx: number, ly: number, lz: number, strength = 1): { str: number } {
    const w = this.world(lx, ly, lz);
    const em = { x: w.x, y: w.y, z: w.z, s: this.P.s, ph: this.smokes.length * 1.7, str: strength };
    this.smokes.push(em);
    const p = this.pool('puff');
    for (let k = 0; k < 7; k++) p.add(w.x, w.y, w.z, 0, 0.0, { col: new THREE.Color(0.8, 0.8, 0.82) });
    return em;
  }

  update(e: Env): void {
    for (const a of this.anims) a(e);
    for (const w of this.waters) w.update(e.t);
    // fumaça
    if (this.smokes.length) {
      const p = this.pools.get('puff')!;
      let n = 0;
      for (const s of this.smokes) {
        for (let k = 0; k < 7; k++) {
          const it = p.items[n++];
          const age = (e.t * 0.22 + k / 7 + s.ph) % 1;
          it.x = s.x + e.wind * age * 0.7 * s.s + Math.sin(age * 7 + s.ph) * 0.03 * s.s;
          it.y = s.y + age * 1.05 * s.s;
          it.z = s.z + e.wind * age * 0.25 * s.s;
          const sz = (0.3 + age * 1.3) * Math.pow(1 - age, 0.7) * s.str * s.s;
          it.bx = it.by = it.bz = Math.max(0, sz);
          const g = 0.84 - age * 0.2;
          it.col.setRGB(g, g, g * 1.03);
        }
      }
      p.dirty = true;
    }
    // brilhos aditivos
    const glowK = Math.max(this.glowMin, smooth(0.05, 0.7, e.night));
    MATS.glow.opacity = 1;
    for (const g of this.glows) {
      const f = 0.88 + 0.12 * Math.sin(e.t * (4 + g.flick * 3) + g.size * 50 + g.it.x * 13) * (g.flick > 0 ? 1 : 0.25);
      const k = glowK * f;
      g.it.bx = g.it.by = g.it.bz = g.size * k;
      g.it.col.copy(g.col).multiplyScalar(0.55 + 0.45 * k);
    }
    e.cam.getWorldQuaternion(this.billQ);
    for (const p of this.pools.values()) { p.step(e.dt); p.refresh(); }
  }

  setVisible(v: boolean): void { this.group.visible = v; }
}
