import * as THREE from 'three/webgpu';
import type { TileDef } from '../core/tiles';
import { instGeometry, setInstColor, type Lib } from './lib';
import { decoMatrix, type Deco, type TileBuild } from './tileBuilder';

const tmpM = new THREE.Matrix4();
const tmpM2 = new THREE.Matrix4();

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
    this.groundGeo.setAttribute('splat', new THREE.BufferAttribute(build.splat, 4));
    const ground = new THREE.Mesh(this.groundGeo, lib.ground);
    ground.castShadow = shadows;
    ground.receiveShadow = true;
    this.waterGeo = new THREE.BufferGeometry();
    this.waterGeo.setAttribute('position', new THREE.BufferAttribute(build.water, 3));
    this.waterGeo.setAttribute('wflow', new THREE.BufferAttribute(build.wflow, 2));
    this.waterGeo.setAttribute('wedge', new THREE.BufferAttribute(build.wedge, 1));
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
      const mesh = new THREE.InstancedMesh(instGeometry(geo, items.length), lib.material(key), items.length);
      mesh.castShadow = shadows && lib.castsShadow(key);
      mesh.receiveShadow = true;
      items.forEach((d, i) => {
        mesh.setMatrixAt(i, decoMatrix(d));
        setInstColor(mesh, i, d.color);
      });
      mesh.computeBoundingSphere();
      this.inner.add(mesh);
      this.meshes.push({ mesh, items });
    }
  }

  /** Escala da decoração com atraso escalonado: árvores "brotam", construções sobem. */
  setDecoScale(fn: (i: number, n: number, key: string) => number | [number, number, number]) {
    for (const { mesh, items } of this.meshes) {
      items.forEach((d, i) => {
        const s = fn(i, items.length, d.key);
        decoMatrix(d, tmpM);
        if (typeof s === 'number') tmpM2.makeScale(s, s, s);
        else tmpM2.makeScale(s[0], s[1], s[2]);
        tmpM.multiply(tmpM2);
        mesh.setMatrixAt(i, tmpM);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Tem alguma das chaves? (construções de interação, para a animação de obra). */
  has(keys: ReadonlySet<string>) {
    return this.build.decos.some((d) => keys.has(d.key));
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.groundGeo.dispose();
    this.waterGeo.dispose();
    for (const { mesh } of this.meshes) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
  }
}

