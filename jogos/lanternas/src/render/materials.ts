// Materiais compartilhados e o relógio global dos shaders. Só materiais simples do three (sem arquivos).
import * as THREE from 'three';
import { PAL } from './palette';

/** Uniformes globais: o tempo do mundo e quanto o vento/ondas mexem (0 com movimento reduzido). */
export const U = {
  time: { value: 0 },
  motion: { value: 1 },
};

export function litMat(opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...opts });
}

/** Material com vento: os vértices mais altos balançam (copas, trigo, bandeira). */
export function swayMat(amp: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  const m = litMat(opts);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.uniforms.uMotion = U.motion;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uMotion;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float ph = uTime * 1.6 + instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.7;
        #else
        float ph = uTime * 1.6;
        #endif
        float kk = max(position.y - 0.04, 0.0);
        transformed.x += sin(ph + position.y * 2.5) * ${amp.toFixed(4)} * kk * uMotion;
        transformed.z += cos(ph * 0.83 + position.y * 2.0) * ${(amp * 0.6).toFixed(4)} * kk * uMotion;`);
  };
  m.customProgramCacheKey = () => 'sway' + amp;
  return m;
}

export function basicMat(opts: Partial<THREE.MeshBasicMaterialParameters> = {}): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true, ...opts });
}

export interface SeaMat extends THREE.MeshStandardMaterial { }

/** Mar: ondulação no vértice, cor por profundidade (raso perto da terra já revelada) e espuma na costa. */
export function seaMaterial(): SeaMat {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.0 });
  const c = (h: number): THREE.Color => new THREE.Color(h);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.uniforms.uMotion = U.motion;
    sh.uniforms.cShallow = { value: c(PAL.seaShallow) };
    sh.uniforms.cMid = { value: c(PAL.seaMid) };
    sh.uniforms.cDeep = { value: c(PAL.seaDeep) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float shore; uniform float uTime; uniform float uMotion;
        uniform vec3 cShallow; uniform vec3 cMid; uniform vec3 cDeep;
        varying float vShore; varying vec3 vSea; varying vec2 vXZ;`)
      .replace('#include <beginnormal_vertex>', `
        float dwx = (cos(position.x * 1.3 + uTime * 0.9) * 1.3 * 0.02 + cos((position.x + position.z) * 0.8 + uTime * 0.5) * 0.8 * 0.012) * uMotion;
        float dwz = (-sin(position.z * 1.7 - uTime * 0.7) * 1.7 * 0.016 + cos((position.x + position.z) * 0.8 + uTime * 0.5) * 0.8 * 0.012) * uMotion;
        vec3 objectNormal = normalize(vec3(-dwx, 1.0, -dwz));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y += (sin(position.x * 1.3 + uTime * 0.9) * 0.02 + cos(position.z * 1.7 - uTime * 0.7) * 0.016 + sin((position.x + position.z) * 0.8 + uTime * 0.5) * 0.012) * uMotion;
        float rad = length(position.xz);
        vShore = shore; vXZ = position.xz;
        vSea = mix(cShallow, mix(cMid, cDeep, smoothstep(5.0, 14.0, rad)), smoothstep(0.0, 2.3, shore));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; varying float vShore; varying vec3 vSea; varying vec2 vXZ;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = vSea;
        float wob = 0.035 * sin(vXZ.x * 5.0 + uTime * 1.1) + 0.03 * sin(vXZ.y * 6.0 - uTime * 0.9);
        float edge = 1.0 - smoothstep(0.02, 0.17, vShore + wob);
        float band = (sin((vShore + wob) * 15.0 - uTime * 1.5) * 0.5 + 0.5) * (1.0 - smoothstep(0.12, 0.8, vShore)) * 0.3;
        float sp = smoothstep(0.55, 1.0, sin(vXZ.x * 1.7 + vXZ.y * 0.9 + uTime * 0.45) * sin(vXZ.y * 1.3 - vXZ.x * 0.6 - uTime * 0.35)) * 0.07;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.98, 0.92), clamp(edge * 0.92 + band + sp, 0.0, 1.0));`);
  };
  return m;
}
