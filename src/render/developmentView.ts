import * as THREE from 'three/webgpu';
import type { Placed } from '../core/board';
import { hexToWorld } from '../core/hex';
import { Lib, instGeometry, setInstColor } from './lib';
import type { Deco, TileBuild } from './tileBuilder';

type Tile = { placed: Placed; build: TileBuild; signature: string };
type DecoItem = { deco: Deco; seed: number; placed: Placed; band: number };
type DecoMesh = { key: string; mesh: THREE.InstancedMesh; bands: number[] };
type Region = {
  id: string;
  tiles: Set<number>;
  ground: THREE.Mesh | null;
  water: THREE.Mesh | null;
  decos: Map<string, DecoMesh>;
};

const REGION_SIDE = 4;
const MAX_BAND = 4;
const _up = new THREE.Vector3(0, 1, 0);
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _rotation = new THREE.Quaternion();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

function geometry(positions: Float32Array, attributes: Record<string, { array: Float32Array; itemSize: number }>) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  for (const [name, a] of Object.entries(attributes)) g.setAttribute(name, new THREE.BufferAttribute(a.array, a.itemSize));
  return g;
}

function joined(arrays: Float32Array[], length: number) {
  const out = new Float32Array(length);
  let at = 0;
  for (const a of arrays) { out.set(a, at); at += a.length; }
  return out;
}

/** Paisagem viva: malhas de chão/água e vegetação reunidas em regiões que podem ser refeitas. */
export class LivingLandscape {
  private readonly tiles = new Map<number, Tile>();
  private readonly regions = new Map<string, Region>();
  private readonly dirtyRegions = new Set<string>();
  private band = MAX_BAND;

  constructor(
    private readonly lib: Lib,
    private readonly parent: THREE.Object3D,
    private readonly bandOf: (d: Deco, seed: number) => number,
  ) {}

  private regionId(p: Placed) {
    return `${Math.floor(p.q / REGION_SIDE)},${Math.floor(p.r / REGION_SIDE)}`;
  }

  private ensureRegion(id: string) {
    let region = this.regions.get(id);
    if (!region) {
      region = { id, tiles: new Set(), ground: null, water: null, decos: new Map() };
      this.regions.set(id, region);
    }
    return region;
  }

  add(p: Placed, build: TileBuild, signature: string) {
    this.tiles.set(p.key, { placed: p, build, signature });
    const region = this.ensureRegion(this.regionId(p));
    region.tiles.add(p.key);
    this.dirtyRegions.add(region.id);
  }

  sync(keys: Iterable<number>, signature: (p: Placed) => string, build: (p: Placed) => TileBuild) {
    for (const key of keys) {
      const tile = this.tiles.get(key);
      if (!tile) continue;
      const next = signature(tile.placed);
      if (next !== tile.signature) this.add(tile.placed, build(tile.placed), next);
    }
    this.flush();
  }

  setBand(value: number) {
    this.band = Math.max(0, Math.min(MAX_BAND, Math.floor(value)));
    for (const region of this.regions.values()) for (const item of region.decos.values()) {
      item.mesh.count = this.countAtBand(item.bands, this.band);
    }
  }

  /** Aplica geometrias de era novas sem perder matrizes, cores ou cortes de detalhe. */
  retarget() {
    for (const region of this.regions.values()) for (const item of region.decos.values()) {
      const base = this.lib.geo(item.key);
      if (!base) continue;
      const old = item.mesh.geometry;
      const color = (old.getAttribute('iColor') as THREE.InstancedBufferAttribute).array as Float32Array;
      const next = instGeometry(base, item.bands.length, color);
      item.mesh.geometry = next;
      old.dispose();
      item.mesh.boundingSphere = this.regionSphere(region);
    }
  }

  stats() {
    let calls = 0, instances = 0, triangles = 0, tiles = this.tiles.size;
    for (const region of this.regions.values()) {
      if (region.ground) { calls++; triangles += (region.ground.geometry.getAttribute('position')?.count ?? 0) / 3; }
      if (region.water?.visible) { calls++; triangles += (region.water.geometry.getAttribute('position')?.count ?? 0) / 3; }
      for (const item of region.decos.values()) {
        if (!item.mesh.count) continue;
        calls++;
        instances += item.mesh.count;
        triangles += (item.mesh.geometry.getAttribute('position')?.count ?? 0) / 3 * item.mesh.count;
      }
    }
    return { calls, instances, triangles, tiles };
  }

  getBuild(key: number) {
    return this.tiles.get(key)?.build;
  }

  reset() {
    for (const region of this.regions.values()) this.clearRegion(region);
    this.dirtyRegions.clear();
    this.regions.clear();
    this.tiles.clear();
  }

  dispose() {
    this.reset();
  }

  private countAtBand(bands: number[], band: number) {
    let lo = 0, hi = bands.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (bands[mid] <= band) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private regionSphere(region: Region) {
    const center = new THREE.Vector3();
    let count = 0, radius = 0;
    for (const key of region.tiles) {
      const tile = this.tiles.get(key);
      if (!tile) continue;
      const { x, z } = hexToWorld(tile.placed.q, tile.placed.r);
      center.x += x; center.z += z; count++;
    }
    if (count) center.multiplyScalar(1 / count);
    for (const key of region.tiles) {
      const tile = this.tiles.get(key);
      if (!tile) continue;
      const { x, z } = hexToWorld(tile.placed.q, tile.placed.r);
      radius = Math.max(radius, Math.hypot(x - center.x, z - center.z));
    }
    return new THREE.Sphere(center, radius + 1.45); // inclui a copa além do contorno das peças.
  }

  private disposeMesh(mesh: THREE.Mesh | THREE.InstancedMesh) {
    this.parent.remove(mesh);
    mesh.geometry.dispose();
    if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
  }

  private clearRegion(region: Region) {
    if (region.ground) this.disposeMesh(region.ground);
    if (region.water) this.disposeMesh(region.water);
    for (const item of region.decos.values()) this.disposeMesh(item.mesh);
    region.ground = region.water = null;
    region.decos.clear();
  }

  private flush() {
    for (const id of this.dirtyRegions) {
      const region = this.regions.get(id)!;
      this.clearRegion(region);
      if (!region.tiles.size) { this.regions.delete(id); continue; }
      this.buildRegion(region);
    }
    this.dirtyRegions.clear();
  }

  private buildRegion(region: Region) {
    const tiles = [...region.tiles].map((key) => this.tiles.get(key)!).filter(Boolean);
    const gPos: Float32Array[] = [], gCol: Float32Array[] = [], gSplat: Float32Array[] = [];
    const wPos: Float32Array[] = [], wFlow: Float32Array[] = [], wBed: Float32Array[] = [];
    const items = new Map<string, DecoItem[]>();
    let gLength = 0, wLength = 0;
    for (const tile of tiles) {
      const { placed: p, build: b } = tile;
      const angle = -p.rot * Math.PI / 3, c = Math.cos(angle), s = Math.sin(angle);
      const { x: ox, z: oz } = hexToWorld(p.q, p.r);
      const transform = (src: Float32Array) => {
        const out = new Float32Array(src.length);
        for (let i = 0; i < src.length; i += 3) {
          const x = src[i], y = src[i + 1], z = src[i + 2];
          out[i] = ox + c * x + s * z;
          out[i + 1] = y;
          out[i + 2] = oz - s * x + c * z;
        }
        return out;
      };
      gPos.push(transform(b.pos)); gCol.push(b.col); gSplat.push(b.splat); gLength += b.pos.length;
      if (b.water.length) {
        wPos.push(transform(b.water));
        const flow = b.wflow.slice();
        for (let i = 0; i < flow.length; i += 2) {
          const x = flow[i], z = flow[i + 1];
          flow[i] = c * x + s * z;
          flow[i + 1] = -s * x + c * z;
        }
        wFlow.push(flow); wBed.push(b.wbed); wLength += b.water.length;
      }
      for (const d of b.allDecos ?? b.decos) {
        if (d.anim || d.transient) continue;
        const list = items.get(d.key) ?? [];
        list.push({ deco: d, seed: p.def.seed, placed: p, band: Math.max(0, Math.min(MAX_BAND, Math.floor(this.bandOf(d, p.def.seed)))) });
        items.set(d.key, list);
      }
    }
    const sphere = this.regionSphere(region);
    const ground = new THREE.Mesh(geometry(joined(gPos, gLength), {
      color: { array: joined(gCol, gLength), itemSize: 3 },
      splat: { array: joined(gSplat, (gLength / 3) * 4), itemSize: 4 },
    }), this.lib.ground);
    ground.receiveShadow = true;
    ground.geometry.boundingSphere = sphere;
    this.parent.add(ground);
    region.ground = ground;

    if (wLength) {
      const waterPos = joined(wPos, wLength);
      const normal = new Float32Array(wLength).map((_, i) => (i % 3 === 1 ? 1 : 0));
      const water = new THREE.Mesh(geometry(waterPos, {
        normal: { array: normal, itemSize: 3 },
        wflow: { array: joined(wFlow, (wLength / 3) * 2), itemSize: 2 },
        wbed: { array: joined(wBed, (wLength / 3) * 4), itemSize: 4 },
      }), this.lib.water);
      water.receiveShadow = true;
      water.geometry.boundingSphere = sphere;
      this.parent.add(water);
      region.water = water;
    }

    for (const [key, list] of items) {
      const base = this.lib.geo(key);
      if (!base || !list.length) continue;
      list.sort((a, b) => a.band - b.band);
      const mesh = new THREE.InstancedMesh(instGeometry(base, list.length), this.lib.material(key), list.length);
      mesh.castShadow = this.lib.castsShadow(key);
      mesh.receiveShadow = true;
      for (let i = 0; i < list.length; i++) {
        const { deco: d, placed: p } = list[i];
        const angle = -p.rot * Math.PI / 3, c = Math.cos(angle), s = Math.sin(angle);
        const { x: ox, z: oz } = hexToWorld(p.q, p.r);
        _position.set(ox + c * d.x + s * d.z, d.y, oz - s * d.x + c * d.z);
        _rotation.setFromAxisAngle(_up, d.ry + angle);
        _scale.set(d.sx, d.sy, d.sz);
        _matrix.compose(_position, _rotation, _scale);
        mesh.setMatrixAt(i, _matrix);
        setInstColor(mesh, i, _color.copy(d.color));
      }
      mesh.instanceMatrix.needsUpdate = true;
      (mesh.geometry.getAttribute('iColor') as THREE.InstancedBufferAttribute).needsUpdate = true;
      mesh.count = this.countAtBand(list.map((x) => x.band), this.band);
      mesh.boundingSphere = sphere;
      this.parent.add(mesh);
      region.decos.set(key, { key, mesh, bands: list.map((x) => x.band) });
    }
  }
}
