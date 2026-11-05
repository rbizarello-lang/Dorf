import * as THREE from 'three/webgpu';
import { abs, attribute, float, length, mix, positionGeometry, positionWorld, sin, smoothstep, uniform, vec2, vec3 } from 'three/tsl';
import type { PatchSeg, PatchView } from '../core/terra';
import { corner, hexToWorld } from '../core/hex';
import { U } from './materials';

// O fantasma que mostra a paisagem (Terra contínua, Fase 3). Tudo sai da REGRA (`patchViews`, em src/core/terra.ts): o contorno da mancha a que a
// peça vai se juntar, as bordas que ainda dão para o vazio (pulsam devagar), o laço dourado quando a jogada fecha e a umidade que esverdeia as
// terras antigas. Técnica: UMA malha de fitas (um draw call) que acompanha o chão (altura lida do mapa do chão, no espaço já deslocado do
// desenho fluido), com um material em TSL que pulsa e brilha pelo `U.time`; mais um InstancedMesh de discos suaves para a umidade. As fitas
// são refeitas só depois que o fantasma para numa casa (o mesmo atraso do campo do chão), nunca a cada quadro.

/** Uma fileira de pontos (x, z) do contorno, aberta ou fechada em laço; `open` = trecho que dá para o vazio. */
export interface Chain {
  p: number[];
  loop: boolean;
  open: boolean;
}

/** Os dois pontos (x, z, x, z) de um trecho do contorno, no mundo sem o deslocamento do desenho fluido. */
function ends(s: PatchSeg): [number, number, number, number] {
  const { x, z } = hexToWorld(s.q, s.r);
  if (s.ray) {
    const c = corner(s.i);
    return [x, z, x + c[0], z + c[1]];
  }
  const a = corner(s.i), b = corner((s.i + 1) % 6);
  return [x + a[0], z + a[1], x + b[0], z + b[1]];
}

const keyOf = (x: number, z: number) => `${Math.round(x * 400)},${Math.round(z * 400)}`;

/** Liga os trechos soltos em fileiras: segue de um ao próximo enquanto o canto é de só dois trechos do mesmo tipo (aberto ou parede). */
export function chainSegs(segs: readonly PatchSeg[]): Chain[] {
  const n = segs.length;
  const pts = segs.map(ends);
  const ka: string[] = [], kb: string[] = [];
  const at = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    ka.push(keyOf(pts[i][0], pts[i][1]));
    kb.push(keyOf(pts[i][2], pts[i][3]));
    for (const k of [ka[i], kb[i]]) {
      const l = at.get(k);
      if (l) l.push(i);
      else at.set(k, [i]);
    }
  }
  const used = new Uint8Array(n);
  const next = (key: string, from: number): number => {
    const l = at.get(key);
    if (!l || l.length !== 2) return -1;
    const o = l[0] === from ? l[1] : l[0];
    return used[o] || segs[o].open !== segs[from].open ? -1 : o;
  };
  const out: Chain[] = [];
  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const fwd: number[] = [pts[i][2], pts[i][3]];
    const back: number[] = [];
    let cur = i, key = kb[i];
    for (let nx = next(key, cur); nx >= 0; nx = next(key, cur)) {
      used[nx] = 1;
      if (ka[nx] === key) {
        fwd.push(pts[nx][2], pts[nx][3]);
        key = kb[nx];
      } else {
        fwd.push(pts[nx][0], pts[nx][1]);
        key = ka[nx];
      }
      cur = nx;
    }
    const startKey = ka[i];
    const endKey = key;
    let loop = false;
    if (startKey === endKey && fwd.length > 4) {
      loop = true;
    } else {
      cur = i;
      key = startKey;
      for (let nx = next(key, cur); nx >= 0; nx = next(key, cur)) {
        used[nx] = 1;
        if (ka[nx] === key) {
          back.push(pts[nx][2], pts[nx][3]);
          key = kb[nx];
        } else {
          back.push(pts[nx][0], pts[nx][1]);
          key = ka[nx];
        }
        cur = nx;
      }
    }
    const p: number[] = [];
    for (let k = back.length - 2; k >= 0; k -= 2) p.push(back[k], back[k + 1]);
    p.push(pts[i][0], pts[i][1], ...fwd);
    if (loop) {
      p.pop();
      p.pop();
    }
    out.push({ p, loop, open: segs[i].open });
  }
  return out;
}

/** Corta as quinas (Chaikin): o contorno da regra anda por lados e raios de hexágono; arredondado, lê como o limite de uma mancha. */
export function smoothChain(c: Chain, iters = 2): Chain {
  let p = c.p;
  for (let it = 0; it < iters; it++) {
    const n = p.length / 2;
    const q: number[] = [];
    const last = c.loop ? n : n - 1;
    if (!c.loop) q.push(p[0], p[1]);
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n;
      const ax = p[i * 2], az = p[i * 2 + 1], bx = p[j * 2], bz = p[j * 2 + 1];
      q.push(ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25, ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75);
    }
    if (!c.loop) q.push(p[n * 2 - 2], p[n * 2 - 1]);
    p = q;
  }
  return { p, loop: c.loop, open: c.open };
}

/** Como a fita sabe do mundo: o deslocamento fluido (ponto → ponto) e a altura do chão (ponto → y, ou NaN onde não há chão). */
export interface TraceWorld {
  warp: (x: number, z: number) => readonly [number, number];
  ground: (x: number, z: number) => number;
  /** Altura de reserva (a da casa) quando o ponto cai fora do chão. */
  levelAt: (x: number, z: number) => number;
  /** Quanto subir o ponto (x, z) acima do chão: o fantasma flutua, e o contorno que passa sobre a casa dele sobe junto (senão a peça o esconde). */
  lift?: (x: number, z: number) => number;
}

/** Quanto cada tipo de mancha clareia na cor do contorno (a cor do terreno puxada para o branco). */
const BRIGHT = 0.45;

const MAX_VERTS = 12000;

/** A malha das fitas: um draw call, geometria reescrita a cada vista nova. */
class Ribbon {
  readonly mesh: THREE.Mesh;
  private readonly geo = new THREE.BufferGeometry();
  private readonly pos = new Float32Array(MAX_VERTS * 3);
  private readonly side = new Float32Array(MAX_VERTS);
  private readonly meta = new Float32Array(MAX_VERTS * 4);
  private readonly col = new Float32Array(MAX_VERTS * 3);
  private readonly idx = new Uint32Array(MAX_VERTS * 3);
  private n = 0;
  private ni = 0;
  /** Cor do laço dourado e quanto cada brilho vale; `age` e `fade` guiam o laço que corre no pouso. */
  readonly u = {
    center: uniform(new THREE.Vector2(0, 0)),
    reach: uniform(9),
    /** Idade (s) do laço que corre; negativo = sem corrida (o laço do fantasma só respira). */
    age: uniform(-1),
    dim: uniform(1),
  };

  constructor() {
    const g = this.geo;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSide', new THREE.BufferAttribute(this.side, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aMeta', new THREE.BufferAttribute(this.meta, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(this.idx, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const side = attribute('aSide', 'float');
    const meta = attribute('aMeta', 'vec4');
    const col = attribute('color', 'vec3');
    // meta: x = 1 se o trecho dá para o vazio, y = força, z = posição no laço (0 a 1, pelo ângulo em volta da mancha), w = 1 se fecha (dourado).
    const across = float(1).sub(abs(side));
    const body = smoothstep(0.0, 0.55, across);
    const slow = sin(U.time.mul(2.1).add(meta.z.mul(6.2832))).mul(0.5).add(0.5);
    const pulse = mix(float(1), slow.mul(0.75).add(0.25), meta.x);
    const dist = length(positionWorld.xz.sub(vec2(this.u.center.x, this.u.center.y)));
    const near = float(1).sub(smoothstep(this.u.reach.mul(0.55), this.u.reach, dist));
    // Laço que corre no pouso: a cabeça anda 0,9 volta por segundo e deixa um rastro; no fim o conjunto apaga.
    const run = this.u.age.greaterThanEqual(0);
    const behind = float(1).sub(smoothstep(0.0, 0.42, this.u.age.mul(0.9).sub(meta.z).mod(1.0)));
    const trail = mix(float(1), behind.mul(0.9).add(0.12), run.select(float(1), float(0)));
    const out = float(1).sub(smoothstep(1.35, 2.1, this.u.age));
    const life = run.select(out, float(1));
    const shimmer = meta.w.mul(slow.mul(0.25).add(0.75));
    const alpha = body.mul(meta.y).mul(pulse).mul(near).mul(trail).mul(life).mul(this.u.dim).mul(mix(float(1), shimmer, meta.w));
    const gold = vec3(1.0, 0.8, 0.28);
    const c = mix(col, gold, meta.w).mul(mix(float(1.15), float(1.3), meta.w));
    const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
    mat.colorNode = c;
    mat.opacityNode = alpha;
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
  }

  /** Vértices montados hoje. */
  get verts() {
    return this.mesh.visible ? this.n : 0;
  }

  clear() {
    this.n = 0;
    this.ni = 0;
    this.geo.setDrawRange(0, 0);
    this.mesh.visible = false;
  }

  /** Reescreve a malha com as manchas; `tint[terreno]` = cor do contorno; `strong[i]` = força da mancha i (0 a 1). */
  build(views: readonly PatchView[], tint: readonly THREE.Color[], tw: TraceWorld, strong: (v: PatchView) => number) {
    this.n = 0;
    this.ni = 0;
    for (const v of views) {
      if (this.n > MAX_VERTS - 600) break;
      const str = strong(v);
      if (str <= 0 || !v.segs.length) continue;
      // O centro da mancha (para o ângulo do laço e para procurar chão do lado de dentro).
      let cx = 0, cz = 0;
      for (const s of v.segs) {
        const e = ends(s);
        cx += e[0] + e[2];
        cz += e[1] + e[3];
      }
      cx /= v.segs.length * 2;
      cz /= v.segs.length * 2;
      const base = tint[v.terrain] ?? tint[0];
      const c = base.clone().lerp(new THREE.Color(1, 1, 1), BRIGHT);
      for (const raw of chainSegs(v.segs)) {
        const ch = smoothChain(raw, 2);
        this.ribbon(ch, v, c, str, cx, cz, tw);
      }
    }
    this.geo.getAttribute('position').needsUpdate = true;
    this.geo.getAttribute('aSide').needsUpdate = true;
    this.geo.getAttribute('aMeta').needsUpdate = true;
    this.geo.getAttribute('color').needsUpdate = true;
    this.geo.index!.needsUpdate = true;
    this.geo.setDrawRange(0, this.ni);
    this.mesh.visible = this.ni > 0;
  }

  private ribbon(ch: Chain, v: PatchView, c: THREE.Color, str: number, cx: number, cz: number, tw: TraceWorld) {
    const n = ch.p.length / 2;
    if (n < 2 || this.n + n * 2 > MAX_VERTS) return;
    const half = (ch.open ? 0.07 : 0.05) * (0.8 + 0.4 * str);
    let lastY = NaN;
    const wp: number[] = [];
    for (let i = 0; i < n; i++) {
      const [dx, dz] = tw.warp(ch.p[i * 2], ch.p[i * 2 + 1]);
      wp.push(ch.p[i * 2] + dx, ch.p[i * 2 + 1] + dz);
    }
    const v0 = this.n;
    for (let i = 0; i < n; i++) {
      const prev = ch.loop ? (i + n - 1) % n : Math.max(0, i - 1);
      const nxt = ch.loop ? (i + 1) % n : Math.min(n - 1, i + 1);
      let tx = wp[nxt * 2] - wp[prev * 2], tz = wp[nxt * 2 + 1] - wp[prev * 2 + 1];
      const len = Math.hypot(tx, tz) || 1;
      tx /= len;
      tz /= len;
      const nx = -tz, nz = tx;
      const x = wp[i * 2], z = wp[i * 2 + 1];
      // Altura do chão: no ponto; na borda da peça de fora o mapa ainda é o vazio, então procura um pouco para dentro da mancha.
      let y = tw.ground(x, z);
      if (!(y > -0.1)) {
        const ix = cx - ch.p[i * 2], iz = cz - ch.p[i * 2 + 1];
        const il = Math.hypot(ix, iz) || 1;
        for (const k of [0.14, 0.3]) {
          y = tw.ground(x + (ix / il) * k, z + (iz / il) * k);
          if (y > -0.1) break;
        }
      }
      if (!(y > -0.1)) y = Number.isNaN(lastY) ? tw.levelAt(x, z) : lastY;
      lastY = y;
      const run = (((Math.atan2(ch.p[i * 2 + 1] - cz, ch.p[i * 2] - cx) / (Math.PI * 2)) % 1) + 1) % 1;
      for (const sd of [-1, 1]) {
        const k = this.n++;
        this.pos[k * 3] = x + nx * half * sd;
        this.pos[k * 3 + 1] = y + 0.06 + (tw.lift ? tw.lift(x, z) : 0);
        this.pos[k * 3 + 2] = z + nz * half * sd;
        this.side[k] = sd;
        this.meta[k * 4] = ch.open ? 1 : 0;
        this.meta[k * 4 + 1] = str;
        this.meta[k * 4 + 2] = run;
        this.meta[k * 4 + 3] = v.closes ? 1 : 0;
        this.col[k * 3] = c.r;
        this.col[k * 3 + 1] = c.g;
        this.col[k * 3 + 2] = c.b;
      }
    }
    const segs = ch.loop ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = v0 + i * 2, b = v0 + ((i + 1) % n) * 2;
      this.idx[this.ni++] = a;
      this.idx[this.ni++] = a + 1;
      this.idx[this.ni++] = b;
      this.idx[this.ni++] = a + 1;
      this.idx[this.ni++] = b + 1;
      this.idx[this.ni++] = b;
    }
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** Disco suave da umidade: esverdeia de leve a terra que a água vai molhar. */
const MOIST_MAX = 48;

/** O conjunto do fantasma da paisagem e do laço do pouso: o `World` cria um e chama `show`, `play` e `step`. */
export class LandTrace {
  readonly group = new THREE.Group();
  private readonly ghost = new Ribbon();
  private readonly fx = new Ribbon();
  /** A missão escolhida na lista (opção desligada por padrão): o contorno do grupo dela, por 8 s. */
  private readonly quest = new Ribbon();
  private questAge = Infinity;
  private readonly moist: THREE.InstancedMesh;
  private readonly moistMat: THREE.MeshBasicNodeMaterial;
  private moistN = 0;
  /** Idade do laço do pouso (s; negativa = esperando a peça cair) e se a malha dele já foi montada. */
  private fxAge = Infinity;
  private fxViews: PatchView[] | null = null;
  private fxBuilt = false;
  private readonly moistAmt = uniform(1);

  constructor() {
    this.group.add(this.ghost.mesh, this.fx.mesh, this.quest.mesh);
    const disc = new THREE.CircleGeometry(1.15, 36).rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
    const r = length(positionGeometry.xz);
    const breath = sin(U.time.mul(1.6)).mul(0.5).add(0.5);
    m.colorNode = vec3(0.38, 0.95, 0.22).mul(1.2);
    m.opacityNode = smoothstep(1.1, 0.3, r).mul(this.moistAmt).mul(breath.mul(0.35).add(0.65)).mul(0.5);
    this.moistMat = m;
    this.moist = new THREE.InstancedMesh(disc, m, MOIST_MAX);
    this.moist.count = 0;
    this.moist.frustumCulled = false;
    this.moist.renderOrder = 2;
    this.moist.visible = false;
    this.group.add(this.moist);
    this.fx.u.reach.value = 1e4;
    this.quest.u.reach.value = 1e4;
  }

  /** O contorno do grupo de uma missão (a mesma camada do fantasma): fica 8 s e some aos poucos, pelo `dt` do mundo. */
  showQuest(view: PatchView, tint: readonly THREE.Color[], tw: TraceWorld) {
    this.quest.build([view], tint, tw, () => 0.9);
    this.questAge = 0;
    this.quest.u.dim.value = 1;
  }

  /** Esconde o que o fantasma mostrava. */
  hide() {
    this.ghost.clear();
    this.moistN = 0;
    this.moist.count = 0;
    this.moist.visible = false;
  }

  /**
   * Mostra a jogada candidata. A mancha que a peça só junta com os setores dela fica fora (o `patchViews` já tira); a que CRESCE a uma mancha
   * antiga aparece forte, e a que une duas ou mais, mais forte ainda. Quem fecha é dourada e firme.
   */
  show(view: { patches: readonly PatchView[]; moist: readonly { q: number; r: number; gain: number }[] }, tint: readonly THREE.Color[], tw: TraceWorld, cx: number, cz: number) {
    this.ghost.u.center.value.set(cx, cz);
    this.ghost.build(view.patches, tint, tw, (v) => (v.closes ? 1 : v.merged > 1 ? 0.95 : v.before > 0 ? 0.7 : 0.35));
    let i = 0;
    const m = new THREE.Matrix4();
    for (const o of view.moist) {
      if (i >= MOIST_MAX) break;
      const { x, z } = hexToWorld(o.q, o.r);
      const [dx, dz] = tw.warp(x, z);
      const y = tw.ground(x + dx, z + dz);
      m.makeTranslation(x + dx, (y > -0.1 ? y : tw.levelAt(x, z)) + 0.04, z + dz);
      this.moist.setMatrixAt(i++, m);
    }
    this.moistN = i;
    this.moist.count = i;
    this.moist.instanceMatrix.needsUpdate = true;
    this.moist.visible = i > 0;
  }

  /** O laço do pouso: começa a correr `delay` segundos depois (a peça ainda está caindo); a malha é montada no primeiro `step` depois disso. */
  play(views: readonly PatchView[], delay: number) {
    this.fxViews = views.filter((v) => v.closes);
    this.fxAge = -delay;
    this.fxBuilt = false;
    this.fx.clear();
  }

  /** Depuração (`window.__land`): põe o laço do pouso na idade `age` (s), montando a malha se preciso. */
  seek(age: number, tint: readonly THREE.Color[], tw: TraceWorld) {
    if (!this.fxViews) return false;
    this.fxAge = age;
    if (age >= 0 && !this.fxBuilt) {
      this.fx.build(this.fxViews, tint, tw, () => 1);
      this.fxBuilt = true;
    }
    this.fx.u.age.value = age;
    return true;
  }

  /** Algo anda (o laço do pouso ou o contorno da missão): o `step` só precisa rodar então. */
  get busy() {
    return this.fxViews !== null || this.questAge < 8;
  }

  /** Há um laço do pouso rodando (ou esperando a peça cair). */
  get playing() {
    return this.fxViews !== null;
  }

  /** Avança o laço do pouso pelo `dt` do mundo; devolve a idade dele em segundos (negativa = esperando), ou null se não há. */
  step(dt: number, tint: readonly THREE.Color[], tw: TraceWorld): number | null {
    if (this.questAge < 8) {
      this.questAge += dt;
      this.quest.u.dim.value = 1 - THREE.MathUtils.smoothstep(this.questAge, 6, 8);
      if (this.questAge >= 8) this.quest.clear();
    }
    if (!this.fxViews) return null;
    this.fxAge += dt;
    if (this.fxAge >= 0 && !this.fxBuilt) {
      this.fx.build(this.fxViews, tint, tw, () => 1);
      this.fxBuilt = true;
    }
    this.fx.u.age.value = this.fxAge;
    if (this.fxAge > 2.2) {
      this.fx.clear();
      this.fxViews = null;
      return null;
    }
    return this.fxAge;
  }

  /** O centro (x, z, no mundo sem deslocamento) das manchas fechadas do pouso, ou null. */
  fxCenter(): { x: number; z: number } | null {
    if (!this.fxViews || !this.fxViews.length) return null;
    let x = 0, z = 0, n = 0;
    for (const v of this.fxViews) {
      for (const s of v.segs) {
        const e = ends(s);
        x += e[0] + e[2];
        z += e[1] + e[3];
        n += 2;
      }
    }
    return n ? { x: x / n, z: z / n } : null;
  }

  /** Depuração (`window.__trace`): o que está montado hoje (vértices das fitas do fantasma e do pouso, discos de umidade). */
  get stats() {
    return { ghost: this.ghost.verts, fx: this.fx.verts, quest: this.quest.verts, moist: this.moistN };
  }

  dispose() {
    this.ghost.dispose();
    this.fx.dispose();
    this.quest.dispose();
    this.moist.geometry.dispose();
    this.moistMat.dispose();
  }
}

export { ends as segEnds };
