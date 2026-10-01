import * as THREE from 'three/webgpu';
import { Fn, abs, cameraPosition, dot, exp, float, length, max, mix, output, positionView, positionWorld, select, smoothstep, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { U, noiseTex } from './materials';

// Atmosfera: a névoa da cena, no lugar do THREE.Fog linear de cor única. São três camadas:
//   bruma: ar que fica mais denso perto do chão e azula a distância, mais quente na direção do sol;
//   névoa rasteira: uma camada fina colada no chão (forte no amanhecer), em manchas que andam
//     com o vento; telhados e copas saem por cima dela;
//   alcance: longe do foco, tudo vai para a cor do fundo (a borda da tela some no vazio).
// As duas primeiras somam uma profundidade óptica com a integral exata de uma densidade que
// cai exponencialmente com a altura, ao longo do raio da câmera até o ponto.

/** Uniformes da névoa, atualizados pelo World (hora do dia e zoom). */
export const A = {
  /** Cor do fundo, para onde vai a névoa de alcance. */
  bg: uniform(new THREE.Color()),
  /** Cor da bruma longe do sol. */
  haze: uniform(new THREE.Color()),
  /** Cor da névoa rasteira longe do sol (mais clara que a bruma: a gota espalha muita luz). */
  mistColor: uniform(new THREE.Color()),
  /** Brilho que a bruma ganha olhando na direção do sol (espalhamento para a frente). */
  glow: uniform(new THREE.Color()),
  /** Faixa da névoa de alcance, em distância de vista. */
  near: uniform(10),
  far: uniform(40),
  /** Densidade da bruma ao nível do chão (por unidade de distância). */
  hazeDensity: uniform(0.01),
  /** Densidade da névoa rasteira no chão e espessura da camada. */
  mist: uniform(0),
  mistHeight: uniform(0.14),
};

/** Altura de escala da bruma: metade do ar some a cada ~2 unidades de subida. */
const HAZE_H = 3;
/** Extinção por canal: o azul se perde antes, e a distância puxa para a cor da bruma. */
const EXTINCTION = vec3(0.86, 0.97, 1.17);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/**
 * Profundidade óptica de uma camada ρ(y) = ρ0·e^(−y/h) ao longo de `dist`, do ponto (altura
 * `y`) até a câmera, `dy` mais alta. (1 − e^(−k))/k tende a 1 quando o raio é horizontal.
 */
const layer = (rho0: N, h: N, y: N, dy: N, dist: N) => {
  const k = dy.div(h);
  const f = select(abs(k).lessThan(1e-3), float(1), float(1).sub(exp(k.negate())).div(k));
  return rho0.mul(exp(y.negate().div(h))).mul(dist).mul(f);
};

/** Nó de névoa da cena (`scene.fogNode`): recebe a cor do material em `output`. */
export const fogNode = Fn(() => {
  const toP = positionWorld.sub(cameraPosition);
  const dist = length(toP);
  // O vazio fica abaixo do chão: sem o piso, a névoa rasteira se acumularia nele.
  const y = max(positionWorld.y, -0.06);
  const dy = cameraPosition.y.sub(y);
  // Manchas da névoa rasteira, que andam devagar com o vento.
  const drift = U.wind.mul(U.time.mul(0.012));
  const patch = texture(noiseTex, positionWorld.xz.div(9).add(drift).add(vec2(0.37, 0.11))).a;
  const mist = A.mist.mul(smoothstep(0.35, 0.72, patch).mul(1.6).add(0.15));
  const tMist: N = exp(EXTINCTION.mul(layer(mist, A.mistHeight, y, dy, dist).negate()));
  const tHaze: N = exp(EXTINCTION.mul(layer(A.hazeDensity, float(HAZE_H), y, dy, dist).negate()));
  const fwd = max(dot(toP.div(dist), U.sunDir), 0);
  const glow: N = A.glow.mul(fwd.pow(3).mul(0.45).add(fwd.pow(20).mul(0.55)));
  // Primeiro a névoa colada no chão, depois a bruma do caminho inteiro até a câmera.
  const misted = output.rgb.mul(tMist).add(glow.add(A.mistColor).mul(vec3(1).sub(tMist)));
  const col = misted.mul(tHaze).add(glow.add(A.haze).mul(vec3(1).sub(tHaze)));
  const range = smoothstep(A.near, A.far, positionView.z.negate());
  return vec4(mix(col, A.bg, range), output.a);
})();
