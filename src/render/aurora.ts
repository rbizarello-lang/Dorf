import * as THREE from 'three/webgpu';
import { Fn, abs, atan, cameraPosition, exp, float, mix, normalize, positionWorld, smoothstep, texture, vec2, vec3, vec4 } from 'three/tsl';
import { U, noiseTex } from './materials';

// Aurora boreal (Theme.skyFx = 'aurora'): uma cortina verde e violeta que ondula no céu da noite.
// É uma função só da direção do olhar (azimute e elevação) e de `U.time`, então não tem malha de
// verdade: a cúpula do céu (`makeAuroraDome`) a desenha por cima da cena, na cena das nuvens, e a
// névoa de alcance (atmosphere.ts) toma emprestado um brilho fraco dela, para a aurora aparecer
// também nas vistas de cima, em que o horizonte fica fora da tela. `U.aurora` (0 a 1) a acende à noite.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

const GREEN = vec3(0.18, 1.0, 0.5);
const VIOLET = vec3(0.62, 0.28, 0.95);

/** Cortina e raios na direção `rd` (unitária): 0 a 1 de intensidade e a altura relativa dentro da cortina. */
const curtain = (rd: N) => {
  const az = atan(rd.z, rd.x).div(Math.PI * 2).add(0.5);
  const t = U.time;
  // Forma da cortina (onda larga que anda devagar) e raios verticais (ruído fino que cintila).
  const wave = texture(noiseTex, vec2(az.mul(2), t.mul(0.004))).r;
  const rays = texture(noiseTex, vec2(az.mul(9).add(t.mul(0.011)), 0.37)).g;
  const flick = texture(noiseTex, vec2(az.mul(5).sub(t.mul(0.017)), t.mul(0.006).add(0.6))).b;
  const base = wave.mul(0.12).add(0.05);
  const top = base.add(rays.mul(0.22).add(0.16));
  const k = rd.y.sub(base).div(top.sub(base).max(0.01));
  const body = smoothstep(0.0, 0.08, k).mul(float(1).sub(smoothstep(0.35, 1.0, k)));
  const present = smoothstep(0.34, 0.6, wave.add(flick.mul(0.25)));
  return { v: body.mul(rays.mul(0.7).add(0.3)).mul(present), k };
};

/** Radiância da cortina vista na direção `rd` (só acima do horizonte). */
export const auroraSky = (rd: N): N => {
  const c = curtain(rd);
  const col = mix(GREEN, VIOLET, smoothstep(0.25, 1.0, c.k));
  return col.mul(c.v).mul(smoothstep(0.0, 0.03, rd.y)).mul(U.aurora).mul(1.6);
};

/**
 * A cortina refletida: o chão e o mar distantes devolvem a aurora como um espelho (a direção do olhar com a
 * altura espelhada). É o que se vê nas vistas de cima, em que o céu fica fora da tela; a névoa de alcance
 * (atmosphere.ts) soma isto ao fundo. Um brilho largo e fraco no horizonte une as faixas.
 */
export const auroraHaze = (rd: N): N => {
  const mirror = vec3(rd.x, abs(rd.y), rd.z);
  const az = atan(rd.z, rd.x).div(Math.PI * 2).add(0.5);
  const wave = texture(noiseTex, vec2(az.mul(2), U.time.mul(0.004))).r;
  const glow = mix(GREEN, VIOLET, wave.mul(0.8)).mul(exp(abs(rd.y).mul(-9))).mul(smoothstep(0.3, 0.7, wave).mul(0.5).add(0.1)).mul(U.aurora).mul(0.05);
  return auroraSky(mirror).mul(0.6).add(glow);
};

/** Cúpula do céu que desenha a cortina: segue a câmera, soma luz à imagem e não recebe névoa. */
export function makeAuroraDome() {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide });
  m.fog = false;
  // Soma a luz sem escurecer o que está atrás (o alfa de saída fica em 0, e o passe compõe somando o RGB).
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  m.colorNode = Fn(() => {
    const rd = normalize(positionWorld.sub(cameraPosition));
    return vec4(auroraSky(rd), 0);
  })();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.visible = false;
  return mesh;
}
