// Materiais: o do three com cor por vértice, o do vento (adaptado do swayMat da Ilha) e o da água do rio.
import * as THREE from 'three';

/** Relógio dos shaders: o tempo do mundo e quanto o vento mexe. */
export const U = {
  time: { value: 0 },
  motion: { value: 1 },
};

export function litMat(opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...opts });
}

/** Material com vento: os vértices mais altos balançam (copas, trigo, bandeira). Mesma ideia do swayMat da Ilha, sem a rajada. */
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

/** Fita de água (rio): cor por vértice (leito mais escuro no meio), reflexo em faixas que correm e espuma na margem. */
export function riverMat(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 uvw; varying vec2 vUvw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUvw = uvw;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec2 vUvw;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float across = abs(vUvw.y);
        float flow = sin(vUvw.x * 9.0 - uTime * 1.4 + sin(vUvw.x * 3.1 + vUvw.y * 2.0) * 1.2) * 0.5 + 0.5;
        float flow2 = sin(vUvw.x * 15.0 - uTime * 2.1 + vUvw.y * 5.0) * 0.5 + 0.5;
        diffuseColor.rgb += vec3(0.05, 0.09, 0.1) * smoothstep(0.55, 1.0, flow) * (1.0 - across) + vec3(0.04) * smoothstep(0.78, 1.0, flow2) * (1.0 - across);
        float foam = smoothstep(0.72, 0.97, across);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.97, 0.94), foam * 0.7);`);
  };
  m.customProgramCacheKey = () => 'river';
  return m;
}
