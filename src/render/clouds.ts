import * as THREE from 'three/webgpu';
import { Break, Discard, Fn, If, Loop, cameraPosition, exp, float, frameId, interleavedGradientNoise, max, mix, normalize, positionWorld, screenCoordinate, smoothstep, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { GROUND_EXTENT, groundMap } from './groundMap';
import { CLOUD_BASE, CLOUD_TOP, U, cloudPuff, noiseTex } from './materials';

// Nuvens volumétricas: cúmulos de base plana numa laje acima do tabuleiro, que aparecem quando a
// câmera se afasta além do enquadramento de jogo. A cobertura vem do mesmo ruído da
// sombra das nuvens no chão (materials.ts), então cada nuvem paira sobre a própria sombra.
// Vistas sempre de cima, as nuvens são um campo de altura: o topo sobe com a cobertura e ganha
// calombos de um ruído fino. O raio de cada pixel atravessa a laje em passos, soma a luz que a
// nuvem espalha e para quando ela fica opaca. As nuvens nunca cobrem o tabuleiro na tela: onde o
// olhar do pixel chega a uma peça (o mapa do chão, groundMap.ts), elas se abrem. Uma malha só (um
// plano no topo da laje), numa cena própria que o pós-processamento compõe por cima (post.ts).

/** Passos do raio dentro da laje. */
const STEPS = 22;
/** Densidade dentro da nuvem (por unidade de distância) e quanto ela apaga o sol. */
const SIGMA = 2.5;
const SUN_SIGMA = 2;
/** Distância da amostra na direção do sol: as faces viradas para ele ficam claras. */
const SUN_PROBE = 0.45;
/** Opacidade máxima: mesmo a nuvem mais densa deixa ver um pouco o que está embaixo. */
const MAX_ALPHA = 0.85;
/**
 * Nível da mipmap do mapa do chão que diz onde há peça (texel de 3,2 unidades): a nuvem se abre
 * a essa distância da beira do tabuleiro, e as vagas da fronteira ficam à vista.
 */
const BOARD_LOD = 5;

/** Uniformes das nuvens, atualizados pelo World. */
export const CL = {
  /** 0 com a câmera perto, 1 longe: as nuvens aparecem aos poucos com o zoom. */
  fade: uniform(0),
  /** Foco da câmera (x, z) e distância dela: as nuvens se abrem em volta do foco. */
  focus: uniform(new THREE.Vector3()),
  /** Luz do sol, do céu (por cima) e do chão (por baixo) que chega às nuvens. */
  sun: uniform(new THREE.Color()),
  sky: uniform(new THREE.Color()),
  ground: uniform(new THREE.Color()),
  /** 1 com TRAA: o começo do raio muda a cada quadro e a média apaga o ruído; 0 deixa o ruído parado. */
  temporal: uniform(1),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/**
 * Densidade (0 a 1) no ponto: abaixo do topo do campo de altura e acima da base. O topo sobe
 * com a cobertura e ganha calombos de um ruído fino que anda devagar. Perto do foco da câmera
 * a nuvem também se abre (quando quem joga olha o vazio fora do tabuleiro).
 */
const density = (p: N) => {
  const clear = smoothstep(CL.focus.z.mul(0.06), CL.focus.z.mul(0.22), p.xz.sub(CL.focus.xy).length());
  const c = cloudPuff(p.xz).mul(clear);
  const bump = texture(noiseTex, p.xz.mul(0.16).add(vec2(U.time.mul(0.021), U.time.mul(0.011)))).a;
  // No máximo até o topo da laje (acima dele o raio nem começa).
  const top = float(CLOUD_BASE).add(c.sqrt().mul(bump.mul(0.42).add(0.56)).mul(CLOUD_TOP - CLOUD_BASE));
  return smoothstep(-0.08, 0.3, top.sub(p.y)).mul(smoothstep(CLOUD_BASE, CLOUD_BASE + 0.25, p.y)).mul(smoothstep(0, 0.08, c));
};

export function makeCloudMesh() {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  m.colorNode = Fn(() => {
    const ro = cameraPosition;
    const rd = normalize(positionWorld.sub(ro));
    // A malha é o topo da laje: o raio entra por ela e sai pela base.
    const t0 = float(CLOUD_TOP).sub(ro.y).div(rd.y);
    const t1 = float(CLOUD_BASE).sub(ro.y).div(rd.y);
    const pIn = ro.add(rd.mul(t0)).xz, pOut = ro.add(rd.mul(t1)).xz;
    // Onde este olhar chega ao chão há peça? Então a nuvem se abre (o vazio fica em 0 no mapa).
    const pGround = ro.add(rd.mul(ro.y.negate().div(rd.y))).xz;
    const g = texture(groundMap.texture, pGround.div(GROUND_EXTENT * 2).add(0.5)).level(float(BOARD_LOD)).rgb;
    const open = float(1).sub(smoothstep(0.004, 0.03, max(g.r, max(g.g, g.b))));
    // Sem nuvem no caminho (a maior parte da tela): sai antes de marchar.
    If(cloudPuff(pIn).add(cloudPuff(pOut)).add(cloudPuff(pIn.add(pOut).mul(0.5))).mul(open).lessThan(1e-3), () => {
      Discard();
    });
    const dt = t1.sub(t0).div(STEPS);
    // Começo sorteado por pixel (e por quadro, com TRAA): troca as faixas dos passos por ruído fino.
    const jitter = interleavedGradientNoise(screenCoordinate.xy.add(float(frameId).mul(5.588).mul(CL.temporal)));
    const t = t0.add(dt.mul(jitter)).toVar();
    const T = float(1).toVar();
    const col = vec3(0).toVar();
    const sunDir = U.sunDir.normalize();
    Loop(STEPS, () => {
      const p = ro.add(rd.mul(t));
      const d = density(p);
      If(d.greaterThan(1e-3), () => {
        // Um passo curto na direção do sol: se ainda há nuvem lá, este ponto está na sombra dela.
        const sunT = exp(density(p.add(sunDir.mul(SUN_PROBE))).mul(-SUN_SIGMA));
        // Céu por cima e chão por baixo; um pouco do sol chega espalhado também à sombra.
        const h = smoothstep(CLOUD_BASE, CLOUD_TOP, p.y);
        const light = CL.sun.mul(sunT.mul(0.85).add(0.15)).add(mix(CL.ground, CL.sky, h));
        const stepT = exp(d.mul(SIGMA).mul(dt).negate());
        col.addAssign(light.mul(T.mul(float(1).sub(stepT))));
        T.mulAssign(stepT);
      });
      If(T.lessThan(0.03), () => {
        Break();
      });
      t.addAssign(dt);
    });
    const a = float(1).sub(T);
    return vec4(col.div(a.max(1e-4)), a.mul(CL.fade).mul(MAX_ALPHA).mul(open));
  })();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2), m);
  mesh.position.y = CLOUD_TOP;
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}
