import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RoofStyle, Theme } from '../themes/themes';

// Geometrias low-poly da decoração e materiais compartilhados.
// Cada tipo vira um InstancedMesh: milhares de árvores custam 1 draw call.

export type DecoKind =
  | 'trunk'
  | 'conifer'
  | 'round'
  | 'blossom'
  | 'palm'
  | 'crystal'
  | 'wall'
  | 'roof'
  | 'spire'
  | 'bush'
  | 'rock'
  | 'flower'
  | 'lily'
  | 'station';

export const DECO_KINDS: DecoKind[] = [
  'trunk',
  'conifer',
  'round',
  'blossom',
  'palm',
  'crystal',
  'wall',
  'roof',
  'spire',
  'bush',
  'rock',
  'flower',
  'lily',
  'station',
];

const SWAY: ReadonlySet<DecoKind> = new Set(['conifer', 'round', 'blossom', 'palm', 'bush']);

function flat(geo: THREE.BufferGeometry) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

function jitter(geo: THREE.BufferGeometry, amount: number, seed: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  // Mesmo vértice (mesma posição) recebe o mesmo deslocamento: a malha não abre frestas.
  const h = (x: number, y: number, z: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453;
    return s - Math.floor(s) - 0.5;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setXYZ(i, x + h(x, y, z) * amount, y + h(y, z, x) * amount * 0.6, z + h(z, x, y) * amount);
  }
  return geo;
}

function roofGeometry(style: RoofStyle) {
  switch (style) {
    case 'flat':
      return new THREE.BoxGeometry(0.17, 0.03, 0.15).translate(0, 0.125, 0);
    case 'dome':
      return new THREE.SphereGeometry(0.085, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.11, 0);
    case 'pagoda': {
      const a = new THREE.ConeGeometry(0.15, 0.07, 4, 1).rotateY(Math.PI / 4).translate(0, 0.145, 0);
      const b = new THREE.ConeGeometry(0.09, 0.07, 4, 1).rotateY(Math.PI / 4).translate(0, 0.19, 0);
      return mergeGeometries([flat(a), flat(b)])!;
    }
    default: {
      // Prisma triangular com a cumeeira no eixo X.
      const g = new THREE.CylinderGeometry(0.1, 0.1, 0.18, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2);
      g.scale(1, 0.62, 1);
      return g.translate(0, 0.11 + 0.031, 0);
    }
  }
}

function buildGeometries(roofStyle: RoofStyle): Record<DecoKind, THREE.BufferGeometry> {
  const conifer = mergeGeometries([
    flat(new THREE.ConeGeometry(0.11, 0.2, 7).translate(0, 0.19, 0)),
    flat(new THREE.ConeGeometry(0.085, 0.17, 7).translate(0, 0.29, 0)),
    flat(new THREE.ConeGeometry(0.055, 0.14, 7).translate(0, 0.38, 0)),
  ])!;
  const round = mergeGeometries([
    flat(jitter(new THREE.IcosahedronGeometry(0.1, 1), 0.018, 1).scale(1, 1.1, 1).translate(0, 0.21, 0)),
  ])!;
  const blossom = mergeGeometries([
    flat(jitter(new THREE.IcosahedronGeometry(0.085, 1), 0.02, 2).translate(0.035, 0.2, 0.01)),
    flat(jitter(new THREE.IcosahedronGeometry(0.075, 1), 0.02, 3).translate(-0.045, 0.22, -0.02)),
    flat(jitter(new THREE.IcosahedronGeometry(0.065, 1), 0.02, 4).translate(0.0, 0.28, 0.02)),
  ])!;
  const leaves: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.ConeGeometry(0.035, 0.2, 3, 1);
    leaf.rotateZ(-Math.PI / 2 - 0.45).translate(0.09, 0.33, 0).rotateY((i / 6) * Math.PI * 2 + 0.3);
    leaves.push(flat(leaf));
  }
  const palm = mergeGeometries(leaves)!;
  const crystal = mergeGeometries([
    flat(new THREE.OctahedronGeometry(0.06, 0).scale(1, 2.6, 1).translate(0, 0.15, 0)),
    flat(new THREE.OctahedronGeometry(0.04, 0).scale(1, 2.4, 1).rotateZ(0.35).translate(0.06, 0.09, 0.02)),
    flat(new THREE.OctahedronGeometry(0.035, 0).scale(1, 2.2, 1).rotateZ(-0.4).translate(-0.05, 0.08, -0.03)),
  ])!;
  return {
    trunk: flat(new THREE.CylinderGeometry(0.016, 0.024, 0.14, 5).translate(0, 0.07, 0)),
    conifer,
    round,
    blossom,
    palm,
    crystal,
    wall: flat(new THREE.BoxGeometry(0.14, 0.11, 0.12).translate(0, 0.055, 0)),
    roof: flat(roofGeometry(roofStyle)),
    spire: flat(new THREE.ConeGeometry(0.075, 0.2, 4).rotateY(Math.PI / 4).translate(0, 0.1, 0)),
    bush: flat(jitter(new THREE.IcosahedronGeometry(0.05, 0), 0.01, 5).translate(0, 0.03, 0)),
    rock: flat(new THREE.DodecahedronGeometry(0.04, 0).scale(1, 0.6, 1).translate(0, 0.012, 0)),
    flower: flat(new THREE.OctahedronGeometry(0.016, 0).translate(0, 0.025, 0)),
    lily: flat(new THREE.CylinderGeometry(0.035, 0.035, 0.006, 7).translate(0, 0.014, 0)),
    station: flat(new THREE.BoxGeometry(0.26, 0.09, 0.14).translate(0, 0.045, 0)),
  };
}

export interface Uniforms {
  uTime: { value: number };
  uSparkle: { value: THREE.Color };
}

/** Balanço das copas pelo vento; barato porque roda no vertex shader. */
function addSway(mat: THREE.Material, u: Uniforms) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
  float ph = ip.x * 1.7 + ip.z * 1.3;
  float bend = max(transformed.y - 0.08, 0.0);
  transformed.x += sin(uTime * 1.6 + ph) * 0.06 * bend;
  transformed.z += cos(uTime * 1.3 + ph * 1.2) * 0.045 * bend;
#endif`,
      );
  };
  mat.customProgramCacheKey = () => 'sway';
}

/** Variação "pincelada" do chão em coordenadas de mundo: sem costuras entre peças. */
function addGroundNoise(mat: THREE.Material) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 p = vWPos.xz;
  float n = vnoise(p * 2.3) * 0.6 + vnoise(vec2(p.x * 7.0 + p.y * 2.0, p.y * 3.0) ) * 0.4;
  diffuseColor.rgb *= 0.9 + 0.2 * n;
}`,
      );
  };
  mat.customProgramCacheKey = () => 'groundNoise';
}

function addWaterShimmer(mat: THREE.Material, u: Uniforms) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uSparkle = u.uSparkle;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nuniform vec3 uSparkle;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 p = vWPos.xz;
  float w = sin(p.x * 5.0 + uTime * 1.1 + sin(p.y * 3.0)) * sin(p.y * 6.0 - uTime * 0.9 + sin(p.x * 2.0));
  diffuseColor.rgb *= 0.94 + 0.08 * w;
  float s = smoothstep(0.93, 1.0, sin(p.x * 11.0 + uTime * 1.7) * sin(p.y * 13.0 - uTime * 1.3 + p.x));
  diffuseColor.rgb = mix(diffuseColor.rgb, uSparkle, s * 0.55);
}`,
      );
  };
  mat.customProgramCacheKey = () => 'water';
}

export class Lib {
  readonly uniforms: Uniforms = { uTime: { value: 0 }, uSparkle: { value: new THREE.Color('#ffffff') } };
  geos!: Record<DecoKind, THREE.BufferGeometry>;
  readonly ground: THREE.MeshStandardMaterial;
  readonly water: THREE.MeshStandardMaterial;
  readonly deco: THREE.MeshStandardMaterial;
  readonly foliage: THREE.MeshStandardMaterial;
  readonly crystal: THREE.MeshStandardMaterial;
  readonly glass: THREE.MeshStandardMaterial;
  private roofStyle: RoofStyle | null = null;

  constructor() {
    this.ground = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
    addGroundNoise(this.ground);
    this.water = new THREE.MeshStandardMaterial({ color: '#63b1dc', roughness: 0.35, metalness: 0.05 });
    addWaterShimmer(this.water, this.uniforms);
    this.deco = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85, metalness: 0 });
    this.foliage = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0 });
    addSway(this.foliage, this.uniforms);
    this.crystal = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.25, metalness: 0.1, emissive: '#3a2a66', emissiveIntensity: 0.6 });
    this.glass = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.2, metalness: 0.2, emissive: '#1a3a5a', emissiveIntensity: 0.4 });
  }

  applyTheme(theme: Theme) {
    if (this.roofStyle !== theme.roofStyle) {
      if (this.geos) for (const g of Object.values(this.geos)) g.dispose();
      this.geos = buildGeometries(theme.roofStyle);
      this.roofStyle = theme.roofStyle;
    }
    this.water.color.set(theme.water);
    this.uniforms.uSparkle.value.set(theme.sparkle);
  }

  materialFor(kind: DecoKind, theme: Theme): THREE.Material {
    if (SWAY.has(kind)) return this.foliage;
    if (kind === 'crystal') return this.crystal;
    if (kind === 'roof' && theme.roofStyle === 'dome') return this.glass;
    return this.deco;
  }
}
