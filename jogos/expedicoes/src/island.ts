// O bloco de terra de um diorama: relevo contínuo por função de altura, contorno irregular (nada de grade),
// corte lateral em camadas, base de nogueira com filete de latão e uma superfície de água com espuma.
import * as THREE from 'three';
import { mulberry32, smooth, vnoise } from './rng';
import { walnutTexture } from './tex';

export interface Strata { color: number; depth: number }
export interface IslandSpec {
  R: number; seed: number; wobble?: number;
  /** y do fundo do corte. */
  base: number;
  h(x: number, z: number): number;
  color(x: number, z: number, h: number, slope: number, out: THREE.Color): void;
  /** Camadas de cima para baixo: depth é a espessura da camada; a última vai até a base. */
  strata: Strata[];
  /** Resolução: radial e angular. */
  nr?: number; ns?: number;
}

const WALNUT = new THREE.MeshStandardMaterial({ map: walnutTexture(), roughness: 0.55, metalness: 0, envMapIntensity: 0.7 });
WALNUT.map!.repeat.set(1, 1);
const BRASS = new THREE.MeshStandardMaterial({ color: 0xc9964a, metalness: 1, roughness: 0.3, envMapIntensity: 1.5 });
const GROUND = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
const SIDE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });

export interface WaterSpec {
  level: number;
  deep: THREE.Color; shallow: THREE.Color; alpha: number;
  /** Espuma na beira (0 a 1) e quanto a superfície ondula. */
  foam?: number; wave?: number; speed?: number;
  /** Faixa de ondas quebrando (costa). */
  surf?: number;
  nr?: number; ns?: number;
}
export interface Water { mesh: THREE.Mesh; update(t: number): void; mat: THREE.MeshStandardMaterial }

export class Island {
  readonly group = new THREE.Group();
  readonly terrain: THREE.Mesh;
  private amps: { k: number; a: number; p: number }[] = [];
  readonly nr: number; readonly ns: number;
  constructor(readonly spec: IslandSpec) {
    const r = mulberry32(spec.seed * 31 + 7);
    const w = spec.wobble ?? 1;
    for (const [k, a] of [[2, 0.05], [3, 0.042], [5, 0.027], [7, 0.016], [11, 0.009]] as const) this.amps.push({ k, a: a * w * (0.6 + 0.8 * r()), p: r() * 6.283 });
    this.nr = spec.nr ?? 64; this.ns = spec.ns ?? 200;
    this.terrain = this.buildTerrain();
    this.group.add(this.terrain);
    this.buildSides();
    this.buildPlinth();
  }

  radiusAt(th: number): number {
    let f = 1;
    for (const a of this.amps) f += a.a * Math.sin(a.k * th + a.p);
    return this.spec.R * f;
  }
  /** Quão dentro do contorno (positivo = dentro), em unidades do mundo. */
  inside(x: number, z: number): number { return this.radiusAt(Math.atan2(z, x)) - Math.hypot(x, z); }
  h(x: number, z: number): number { return this.spec.h(x, z); }

  /** Recalcula as cores do chão (os bairros novos pintam o próprio terreno). */
  recolor(): void {
    const g = this.terrain.geometry, p = g.attributes.position as THREE.BufferAttribute, c = g.attributes.color as THREE.BufferAttribute;
    const col = new THREE.Color();
    for (let k = 0; k < p.count; k++) {
      this.spec.color(p.getX(k), p.getZ(k), p.getY(k), this.slope(p.getX(k), p.getZ(k)), col);
      c.setXYZ(k, col.r, col.g, col.b);
    }
    c.needsUpdate = true;
  }

  private slope(x: number, z: number): number {
    const e = 0.18, h = this.spec.h;
    return Math.hypot(h(x + e, z) - h(x - e, z), h(x, z + e) - h(x, z - e)) / (2 * e);
  }

  private buildTerrain(): THREE.Mesh {
    const { nr, ns, spec } = this;
    const nv = 1 + nr * ns;
    const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const c = new THREE.Color();
    const put = (k: number, x: number, z: number): void => {
      const h = spec.h(x, z);
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      spec.color(x, z, h, this.slope(x, z), c);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    };
    put(0, 0, 0);
    for (let i = 1; i <= nr; i++) for (let j = 0; j < ns; j++) {
      const th = (j / ns) * Math.PI * 2;
      const rr = (i / nr) * this.radiusAt(th);
      put(1 + (i - 1) * ns + j, rr * Math.cos(th), rr * Math.sin(th));
    }
    const idx: number[] = [];
    const V = (i: number, j: number): number => 1 + (i - 1) * ns + (j % ns);
    for (let j = 0; j < ns; j++) idx.push(0, V(1, j + 1), V(1, j));
    for (let i = 1; i < nr; i++) for (let j = 0; j < ns; j++) {
      const a = V(i, j), b = V(i, j + 1), cc = V(i + 1, j), d = V(i + 1, j + 1);
      idx.push(a, b, cc, b, d, cc);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, GROUND);
    m.receiveShadow = true; m.castShadow = true;
    return m;
  }

  /** Normal de cima (y>0) dos triângulos: confere o sentido do enrolamento e inverte se preciso. */
  private fixWinding(g: THREE.BufferGeometry, wantOut: (x: number, z: number) => [number, number]): void {
    const p = g.attributes.position as THREE.BufferAttribute;
    const ix = g.index!;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let bad = 0, tot = 0;
    for (let t = 0; t < ix.count; t += 3) {
      a.fromBufferAttribute(p, ix.getX(t)); b.fromBufferAttribute(p, ix.getX(t + 1)); c.fromBufferAttribute(p, ix.getX(t + 2));
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      const [ox, oz] = wantOut(a.x, a.z);
      if (n.x * ox + n.z * oz < 0) bad++;
      tot++;
    }
    if (bad > tot / 2) for (let t = 0; t < ix.count; t += 3) { const x = ix.getX(t + 1); ix.setX(t + 1, ix.getX(t + 2)); ix.setX(t + 2, x); }
  }

  private buildSides(): void {
    const { ns, spec } = this;
    const K = spec.strata.length;
    const pos: number[] = [], col: number[] = [], nor: number[] = [], idx: number[] = [];
    const cc = new THREE.Color();
    const cum: number[] = []; let acc = 0;
    for (let k = 0; k < K - 1; k++) { acc += spec.strata[k].depth; cum.push(acc); }
    const top = (j: number): [number, number, number, number] => {
      const th = ((j % ns) / ns) * Math.PI * 2, rr = this.radiusAt(th);
      const x = rr * Math.cos(th), z = rr * Math.sin(th);
      return [x, spec.h(x, z), z, th];
    };
    const bound = (j: number, k: number, y0: number): number => {
      if (k === 0) return y0;
      if (k >= K) return spec.base;
      const n = vnoise(j * 0.21 + k * 17, k * 3.1, spec.seed) * 0.16 + vnoise(j * 0.9, k * 7.7, spec.seed + 3) * 0.05;
      return Math.max(spec.base + 0.02, y0 - cum[k - 1] - n);
    };
    for (let j = 0; j < ns; j++) {
      const A = top(j), B = top(j + 1);
      const sh = 0.9 + 0.2 * vnoise(j * 0.3, 5, spec.seed + 9);
      for (let k = 0; k < K; k++) {
        const base = pos.length / 3;
        const ya0 = bound(j, k, A[1]), yb0 = bound(j, k + 1, A[1]), ya1 = bound(j + 1, k, B[1]), yb1 = bound(j + 1, k + 1, B[1]);
        pos.push(A[0], ya0, A[2], B[0], ya1, B[2], A[0], yb0, A[2], B[0], yb1, B[2]);
        cc.set(spec.strata[k].color);
        const dk = 1 - 0.28 * (k / K);
        for (let q = 0; q < 4; q++) {
          const f = (q < 2 ? 1 : 0.9) * sh * dk;
          col.push(cc.r * f, cc.g * f, cc.b * f);
          const th = q % 2 ? B[3] : A[3];
          nor.push(Math.cos(th), 0, Math.sin(th));
        }
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    this.fixWinding(g, (x, z) => [x, z]);
    const m = new THREE.Mesh(g, SIDE);
    m.receiveShadow = true; m.castShadow = true;
    this.group.add(m);
  }

  private ringWall(scale: number, y0: number, y1: number, mat: THREE.Material, uv = true): THREE.Mesh {
    const { ns } = this;
    const pos: number[] = [], nor: number[] = [], uvs: number[] = [], idx: number[] = [];
    for (let j = 0; j <= ns; j++) {
      const th = ((j % ns) / ns) * Math.PI * 2, rr = this.radiusAt(th) * scale;
      const x = rr * Math.cos(th), z = rr * Math.sin(th);
      pos.push(x, y1, z, x, y0, z);
      nor.push(Math.cos(th), 0, Math.sin(th), Math.cos(th), 0, Math.sin(th));
      if (uv) uvs.push(j / ns * 5, 0.6, j / ns * 5, 0);
      if (j < ns) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    this.fixWinding(g, (x, z) => [x, z]);
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    return m;
  }

  private buildPlinth(): void {
    const b = this.spec.base;
    this.group.add(this.ringWall(1.07, b - 0.6, b, WALNUT));
    // prateleira de nogueira em volta do corte
    const { ns } = this;
    const pos: number[] = [], nor: number[] = [], uvs: number[] = [], idx: number[] = [];
    for (let j = 0; j <= ns; j++) {
      const th = ((j % ns) / ns) * Math.PI * 2, r0 = this.radiusAt(th);
      for (const s of [1.0, 1.07]) {
        const x = r0 * s * Math.cos(th), z = r0 * s * Math.sin(th);
        pos.push(x, b, z); nor.push(0, 1, 0); uvs.push(x * 0.2, z * 0.2);
      }
      if (j < ns) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    const ix = g.index!;
    // normal para cima
    const p = g.attributes.position as THREE.BufferAttribute;
    const a = new THREE.Vector3(), bb = new THREE.Vector3(), c = new THREE.Vector3();
    a.fromBufferAttribute(p, ix.getX(0)); bb.fromBufferAttribute(p, ix.getX(1)); c.fromBufferAttribute(p, ix.getX(2));
    if (bb.sub(a).cross(c.sub(a)).y < 0) for (let t = 0; t < ix.count; t += 3) { const x = ix.getX(t + 1); ix.setX(t + 1, ix.getX(t + 2)); ix.setX(t + 2, x); }
    const shelf = new THREE.Mesh(g, WALNUT);
    shelf.receiveShadow = true;
    this.group.add(shelf);
    // filete de latão
    this.group.add(this.ringWall(1.073, b - 0.2, b + 0.015, BRASS, false));
    this.group.add(this.ringWall(1.073, b - 0.62, b - 0.56, BRASS, false));
  }

  /** Superfície de água com profundidade por vértice (alfa), espuma na beira e uma parede translúcida no corte. */
  water(ws: WaterSpec): Water {
    const nr = ws.nr ?? 44, ns = ws.ns ?? 140;
    const spec = this.spec;
    const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
    const depthOf: number[] = [], baseXZ: number[] = [], surfIdx: number[] = [];
    const lvl = ws.level;
    const addV = (x: number, y: number, z: number, d: number): number => {
      pos.push(x, y, z); nor.push(0, 1, 0); col.push(1, 1, 1, 1); depthOf.push(d); baseXZ.push(x, z);
      return pos.length / 3 - 1;
    };
    const centerD = lvl - spec.h(0, 0);
    const ctr = addV(0, lvl, 0, centerD); surfIdx.push(ctr);
    const ring: number[][] = [];
    for (let i = 1; i <= nr; i++) {
      const row: number[] = [];
      for (let j = 0; j < ns; j++) {
        const th = (j / ns) * Math.PI * 2, rr = (i / nr) * this.radiusAt(th);
        const x = rr * Math.cos(th), z = rr * Math.sin(th);
        const k = addV(x, lvl, z, lvl - spec.h(x, z)); surfIdx.push(k); row.push(k);
      }
      ring.push(row);
    }
    const wet = (k: number): boolean => depthOf[k] > -0.06;
    const tri = (a: number, b: number, c: number): void => { if (wet(a) || wet(b) || wet(c)) idx.push(a, c, b); };
    for (let j = 0; j < ns; j++) tri(ctr, ring[0][j], ring[0][(j + 1) % ns]);
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < ns; j++) {
      const a = ring[i][j], b = ring[i][(j + 1) % ns], c = ring[i + 1][j], d = ring[i + 1][(j + 1) % ns];
      tri(a, b, c); tri(b, d, c);
    }
    // parede do corte, onde a água chega à borda
    const wallStart = pos.length / 3;
    const rim = ring[nr - 1];
    for (let j = 0; j < ns; j++) {
      const a = rim[j], b = rim[(j + 1) % ns];
      if (depthOf[a] <= 0 && depthOf[b] <= 0) continue;
      const base = pos.length / 3;
      const pa = [pos[a * 3], pos[a * 3 + 2]], pb = [pos[b * 3], pos[b * 3 + 2]];
      pos.push(pa[0], lvl, pa[1], pb[0], lvl, pb[1], pa[0], lvl - Math.max(0.01, depthOf[a]), pa[1], pb[0], lvl - Math.max(0.01, depthOf[b]), pb[1]);
      const th = (j / ns) * Math.PI * 2;
      for (let q = 0; q < 4; q++) { nor.push(Math.cos(th), 0, Math.sin(th)); depthOf.push(1); baseXZ.push(0, 0); col.push(ws.deep.r * 0.8, ws.deep.g * 0.8, ws.deep.b * 0.85, ws.alpha * 0.8); }
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
    void wallStart;
    const g = new THREE.BufferGeometry();
    const posA = new THREE.Float32BufferAttribute(pos, 3), norA = new THREE.Float32BufferAttribute(nor, 3), colA = new THREE.Float32BufferAttribute(col, 4);
    g.setAttribute('position', posA); g.setAttribute('normal', norA); g.setAttribute('color', colA);
    g.setIndex(idx);
    // enrolamento: a superfície precisa olhar para cima
    const ix = g.index!;
    {
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      let up = 0, dn = 0;
      for (let t = 0; t < Math.min(ix.count, 600); t += 3) {
        if (ix.getX(t) >= wallStart || ix.getX(t + 1) >= wallStart || ix.getX(t + 2) >= wallStart) continue;
        a.fromBufferAttribute(posA, ix.getX(t)); b.fromBufferAttribute(posA, ix.getX(t + 1)); c.fromBufferAttribute(posA, ix.getX(t + 2));
        if (b.clone().sub(a).cross(c.clone().sub(a)).y > 0) up++; else dn++;
      }
      if (dn > up) for (let t = 0; t < ix.count; t += 3) { const x = ix.getX(t + 1); ix.setX(t + 1, ix.getX(t + 2)); ix.setX(t + 2, x); }
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.1, metalness: 0.15, envMapIntensity: 1.7, depthWrite: false });
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = 2; mesh.receiveShadow = true;
    const amp = ws.wave ?? 0.012, sp = ws.speed ?? 1, foam = ws.foam ?? 0.6, surf = ws.surf ?? 0;
    const sh = new THREE.Color(), dp = new THREE.Color();
    const update = (t: number): void => {
      for (const k of surfIdx) {
        const d = depthOf[k], x = baseXZ[k * 2], z = baseXZ[k * 2 + 1];
        const a = x * 3.3 + t * 1.35 * sp, b = z * 2.9 - t * 1.1 * sp, c = (x + z) * 4.7 + t * 1.9 * sp;
        const e = Math.max(0, Math.min(1, d * 3 + 0.2));
        const y = lvl + (Math.sin(a) + Math.sin(b) + 0.6 * Math.sin(c)) * amp * e;
        const dx = (3.3 * Math.cos(a) + 0.6 * 4.7 * Math.cos(c)) * amp * e, dz = (2.9 * Math.cos(b) + 0.6 * 4.7 * Math.cos(c)) * amp * e;
        posA.setY(k, y);
        const il = 1 / Math.hypot(dx * 4, 1, dz * 4);
        norA.setXYZ(k, -dx * 4 * il, il, -dz * 4 * il);
        // cor: raso verde-claro, fundo escuro; alfa cresce com a profundidade
        const m = smooth(0, 0.7, d);
        sh.copy(ws.shallow); dp.copy(ws.deep);
        sh.lerp(dp, m);
        let alpha = ws.alpha * smooth(-0.02, 0.2, d);
        let f = 0;
        if (foam > 0 && d > -0.04) {
          const ph = Math.sin(d * 22 - t * 1.7 * sp + (x + z) * 1.3) * 0.5 + 0.5;
          f = foam * smooth(0.16, 0.0, d) * (0.35 + 0.65 * ph);
        }
        if (surf > 0 && d > 0.16 && d < 0.7) {
          const w = Math.sin(d * 9 - t * 1.3 * sp + Math.sin(x * 2 + z) * 0.6) * 0.5 + 0.5;
          f = Math.max(f, surf * smooth(0.12, 0.2, d) * smooth(0.7, 0.3, d) * Math.pow(w, 5));
        }
        const r = sh.r + (1 - sh.r) * f, gg = sh.g + (1 - sh.g) * f, bb = sh.b + (1 - sh.b) * f;
        alpha = alpha + (1 - alpha) * f * 0.8;
        colA.setXYZW(k, r, gg, bb, alpha);
      }
      posA.needsUpdate = true; norA.needsUpdate = true; colA.needsUpdate = true;
    };
    update(0);
    return { mesh, update, mat };
  }
}
