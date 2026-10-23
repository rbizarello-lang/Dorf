import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Kits do Inverno Nórdico: rena, alce e raposa-do-ártico, trenó, lago congelado (gelo, buracos de pesca e
// o pesqueiro com tenda e varal), pórtico de dragões, stavkirke da maravilha e o troll do easter egg.
// Ficam num arquivo à parte para não disputar o lib.ts com os outros temas. As primitivas (box, cyl,
// cone...) vêm do lib.ts por injeção (`Prims`), sem import em ciclo: elas dependem de estado do módulo
// dele (a versão leve das árvores).

type Col = THREE.ColorRepresentation;

/** Parte de um kit: mesma forma do `Part` do lib.ts (cor por vértice, `tint` = a cor da instância tinge, `glow` = acende à noite). */
export interface KPart {
  geo: THREE.BufferGeometry;
  color: Col;
  tint?: number;
  glow?: number;
  grad?: [number, number, number, number];
}

/** As primitivas do lib.ts de que os kits precisam. */
export interface Prims {
  kit(parts: KPart[]): THREE.BufferGeometry;
  box(w: number, h: number, d: number, x?: number, y?: number, z?: number): THREE.BufferGeometry;
  cyl(rt: number, rb: number, h: number, seg: number, x?: number, y?: number, z?: number): THREE.BufferGeometry;
  cone(r: number, h: number, seg: number, x?: number, y?: number, z?: number): THREE.BufferGeometry;
  oct(r: number): THREE.BufferGeometry;
  ico(r: number, detail?: number): THREE.BufferGeometry;
  jitter(geo: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry;
  strut(a: [number, number, number], b: [number, number, number], t: number): THREE.BufferGeometry;
  taper(geo: THREE.BufferGeometry, k: number): THREE.BufferGeometry;
  pyramid(w: number, h: number, d: number, y: number): THREE.BufferGeometry;
}

/** Gira a forma em torno da própria base (x, depois y, depois z) e só então a põe no lugar: com a forma já transladada, o giro a deslocaria em torno da origem. */
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => g.rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z);

const DARK = '#2e2724';
const BONE = '#d8c9ac';

// ---------------------------------------------------------------- animais

/** Pernas de um bicho de quatro patas, com a pata (casco) mais escura. */
const legs = (P: Prims, lx: number, lz: number, h: number, c: Col, w = 0.006): KPart[] =>
  [lx, -lx].flatMap((x) => [lz, -lz].map((z) => ({ geo: P.box(w, h, w, x, 0, z), color: c })));

/** Rena: corpo claro de barriga branca, pescoço e cabeça de focinho escuro, galhada de dois ramos. A instância tinge o pelo. */
export function reindeerGeometry(P: Prims): THREE.BufferGeometry {
  const antler = (z: number): KPart[] => [
    { geo: P.strut([0.032, 0.07, z], [0.024, 0.1, z * 2.4], 0.0026), color: BONE },
    { geo: P.strut([0.03, 0.085, z * 1.5], [0.042, 0.094, z * 2.2], 0.002), color: BONE },
    { geo: P.strut([0.026, 0.096, z * 2], [0.016, 0.108, z * 2.9], 0.002), color: BONE },
  ];
  return P.kit([
    { geo: P.box(0.044, 0.019, 0.015, 0, 0.03), color: '#fff', tint: 1 },
    { geo: P.box(0.036, 0.006, 0.012, 0, 0.027), color: '#efe9dd' },
    { geo: at(P.box(0.01, 0.03, 0.011), 0.018, 0.038, 0, 0, 0, -0.5), color: '#fff', tint: 1 },
    { geo: P.box(0.017, 0.009, 0.009, 0.034, 0.062), color: '#fff', tint: 1 },
    { geo: P.box(0.006, 0.007, 0.008, 0.045, 0.06), color: DARK },
    { geo: P.box(0.005, 0.006, 0.006, -0.025, 0.04), color: '#f2efe8' },
    ...antler(0.004),
    ...antler(-0.004),
    ...legs(P, 0.016, 0.005, 0.03, '#4a3a2e'),
  ]);
}

/** Alce: o dobro da rena, de ombro alto e focinho comprido, com a galhada em pás. */
export function mooseGeometry(P: Prims): THREE.BufferGeometry {
  return P.kit([
    { geo: P.box(0.05, 0.026, 0.02, 0, 0.044), color: '#fff', tint: 1 },
    { geo: P.box(0.022, 0.02, 0.018, 0.012, 0.062), color: '#fff', tint: 1 },
    { geo: at(P.box(0.012, 0.032, 0.013), 0.026, 0.056, 0, 0, 0, -0.55), color: '#fff', tint: 1 },
    { geo: P.box(0.026, 0.014, 0.012, 0.05, 0.078), color: '#fff', tint: 1 },
    { geo: P.box(0.008, 0.012, 0.01, 0.063, 0.074), color: DARK },
    ...[1, -1].flatMap((s) => [
      { geo: at(P.box(0.026, 0.003, 0.014), 0.04, 0.094, s * 0.02, 0, s * 0.4), color: BONE },
      { geo: P.strut([0.042, 0.088, s * 0.006], [0.044, 0.095, s * 0.016], 0.003), color: BONE },
    ]),
    ...legs(P, 0.019, 0.007, 0.044, '#3a2e26', 0.008),
  ]);
}

/** Raposa-do-ártico: bolinha de pelo branco, focinho fino, cauda grossa. A instância tinge o pelo. */
export function foxGeometry(P: Prims): THREE.BufferGeometry {
  return P.kit([
    { geo: P.box(0.026, 0.013, 0.011, 0, 0.012), color: '#fff', tint: 1 },
    { geo: P.box(0.012, 0.011, 0.01, 0.017, 0.02), color: '#fff', tint: 1 },
    { geo: at(P.cone(0.004, 0.011, 4), 0.022, 0.018, 0, 0, 0, -Math.PI / 2 + 0.2), color: '#fff', tint: 1 },
    { geo: P.cone(0.003, 0.008, 3, 0.018, 0.03), color: '#fff', tint: 1 },
    { geo: P.cone(0.003, 0.008, 3, 0.014, 0.03), color: '#fff', tint: 1 },
    { geo: P.box(0.003, 0.003, 0.003, 0.03, 0.019), color: DARK },
    { geo: P.ico(0.008, 0).scale(1.6, 0.9, 0.9).translate(-0.02, 0.016, 0), color: '#fff', tint: 1 },
    ...legs(P, 0.009, 0.0035, 0.012, DARK, 0.003),
  ]);
}

// ---------------------------------------------------------------- trenó

/**
 * Trenó de rena: a cabeça é a rena com arreio e guizo, o vagão é o trenó de patins curvos com banco, manta, saco e
 * uma caixa de peixe (a carga vem no kit; o trenó não leva caixotes por cima).
 */
export function sledGeometry(P: Prims, [body, det]: [string, string]): { head: THREE.BufferGeometry; car: THREE.BufferGeometry } {
  const head = mergeGeometries([
    reindeerGeometry(P),
    P.kit([
      { geo: P.box(0.016, 0.003, 0.017, 0.016, 0.036), color: det },
      { geo: P.oct(0.0035).translate(0.026, 0.045, 0.0), color: '#e8c24a' },
    ]),
  ])!;
  const runner = (z: number): KPart[] => [
    { geo: P.box(0.064, 0.004, 0.004, 0, 0.001, z), color: '#3a2e28' },
    { geo: at(P.box(0.016, 0.004, 0.004), 0.03, 0.001, z, 0, 0, 0.55), color: '#3a2e28' },
    { geo: P.box(0.004, 0.012, 0.004, 0.012, 0.004, z), color: '#3a2e28' },
    { geo: P.box(0.004, 0.012, 0.004, -0.018, 0.004, z), color: '#3a2e28' },
  ];
  const car = P.kit([
    ...runner(0.012),
    ...runner(-0.012),
    { geo: P.box(0.054, 0.004, 0.034, 0, 0.014), color: body },
    ...[1, -1].map((s) => ({ geo: P.box(0.054, 0.01, 0.003, 0, 0.018, s * 0.0185), color: body })),
    { geo: P.box(0.004, 0.02, 0.03, -0.028, 0.018), color: body },
    { geo: P.box(0.016, 0.004, 0.028, -0.014, 0.018), color: det },
    { geo: P.ico(0.01, 0).scale(1.2, 0.8, 1).translate(0.008, 0.026, 0.004), color: '#c9b9a0' },
    { geo: P.box(0.012, 0.008, 0.014, 0.018, 0.018, -0.006), color: '#8a6a48' },
  ]);
  return { head, car };
}

// ---------------------------------------------------------------- lago congelado

/**
 * Um trecho do lago gelado: três rachaduras claras em estrela e um buraco redondo de pesca, de lábio de neve, fora do
 * centro. A instância tinge as rachaduras (azul-claro); o buraco é sempre água escura. Chato como uma decalque.
 */
export function icefieldGeometry(P: Prims): THREE.BufferGeometry {
  const crack = (len: number, ang: number, dx: number, dz: number): KPart => ({ geo: P.box(len, 0.0012, 0.0048).rotateY(ang).translate(dx, 0.0006, dz), color: '#fff', tint: 1 });
  return P.kit([
    crack(0.095, 0.2, 0, 0),
    crack(0.07, 1.3, 0.012, -0.004),
    crack(0.06, -0.9, -0.014, 0.006),
    { geo: P.cyl(0.027, 0.027, 0.002, 7, -0.025, 0, 0.026), color: '#f4fbff' },
    { geo: P.cyl(0.0185, 0.0185, 0.002, 7, -0.025, 0.0005, 0.026), color: '#0f2c42' },
  ]);
}

/**
 * Pesqueiro no gelo (um por parcela): tenda de lona sobre o buraco, varal de peixe seco e um banquinho. A cor da
 * instância tinge a lona (ocre, vermelho, azul-ardósia). Origem no chão da parcela, frente da tenda para +z.
 */
export function iceCampGeometry(P: Prims): THREE.BufferGeometry {
  const parts: KPart[] = [
    { geo: P.cyl(0.03, 0.03, 0.002, 8, 0.045, 0, 0.05), color: '#f1f8fc' },
    { geo: P.cyl(0.019, 0.019, 0.002, 8, 0.045, 0.0005, 0.05), color: '#16344a' },
    // Tenda: pirâmide baixa de lona, com a porta escura na frente e o pé de neve no chão.
    { geo: P.pyramid(0.082, 0.068, 0.082, 0.0), color: '#fff', tint: 1, grad: [0.8, 1.12, 0, 0.068] },
    { geo: P.box(0.016, 0.03, 0.004, 0, 0, 0.037), color: '#2a2018' },
    { geo: P.box(0.09, 0.006, 0.09, 0, 0, 0), color: '#f4fbff' },
    { geo: P.box(0.006, 0.014, 0.006, 0.0, 0.066, 0), color: '#4a3a30' },
    // Varal: dois postes e uma travessa, com seis bacalhaus pendurados.
    { geo: P.box(0.004, 0.056, 0.004, 0.07, 0, -0.045), color: '#5a4636' },
    { geo: P.box(0.004, 0.056, 0.004, 0.07, 0, 0.012), color: '#5a4636' },
    { geo: P.box(0.004, 0.004, 0.066, 0.07, 0.052, -0.0165), color: '#5a4636' },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ geo: P.box(0.0035, 0.02, 0.006, 0.07, 0.032, -0.042 + i * 0.0105), color: i % 2 ? '#e4dccb' : '#cfc3ac' })),
    // Banquinho e a vara de pesca fincada no gelo.
    { geo: P.cyl(0.007, 0.007, 0.008, 5, 0.03, 0.0, 0.07), color: '#6a4a32' },
    { geo: P.strut([0.045, 0.0, 0.05], [0.07, 0.04, 0.085], 0.0018), color: '#3a2e28' },
  ];
  return P.kit(parts);
}

// ---------------------------------------------------------------- pórtico de dragões

/**
 * Pórtico de entrada da vila: dois pilares de madeira escura, travessa com tábuas cruzadas e uma cabeça de dragão
 * (pescoço curvo e focinho) no alto de cada pilar, olhando para fora. A neve (`top`) pousa na travessa e nas cabeças.
 */
export function dragonGateGeometry(P: Prims, [main, top]: [string, string]): THREE.BufferGeometry {
  const parts: KPart[] = [];
  for (const s of [1, -1]) {
    const x = s * 0.12;
    parts.push(
      { geo: P.cyl(0.0095, 0.012, 0.15, 6, x), color: main, grad: [0.8, 1.05, 0, 0.15] },
      { geo: P.box(0.03, 0.01, 0.03, x, 0), color: '#6a645c' },
      // Pescoço que sobe e cabeça de dragão que se projeta para fora (s), com chifre e olho âmbar.
      // Pescoço que sobe e se curva para fora, cabeça de focinho comprido, chifre para trás e olhos âmbar.
      { geo: at(P.box(0.012, 0.034, 0.012), x, 0.146, 0, 0, 0, -s * 0.35), color: main },
      { geo: at(P.box(0.034, 0.014, 0.014), x + s * 0.026, 0.172, 0, 0, 0, -s * 0.2), color: main },
      { geo: at(P.cone(0.0075, 0.016, 4), x + s * 0.043, 0.176, 0, 0, 0, -s * Math.PI / 2), color: main },
      { geo: at(P.cone(0.004, 0.024, 3), x + s * 0.01, 0.184, 0, 0, 0, s * 0.5), color: '#c9a24a' },
      { geo: P.box(0.004, 0.004, 0.004, x + s * 0.034, 0.18, 0.0078), color: '#ffb84a', glow: 0.8 },
      { geo: P.box(0.004, 0.004, 0.004, x + s * 0.034, 0.18, -0.0078), color: '#ffb84a', glow: 0.8 },
      { geo: P.box(0.022, 0.004, 0.02, x, 0.15), color: top },
    );
  }
  parts.push(
    { geo: P.box(0.26, 0.014, 0.018, 0, 0.12), color: main },
    { geo: P.box(0.28, 0.01, 0.02, 0, 0.142), color: main },
    // Tábuas cruzadas sob a travessa.
    { geo: P.strut([-0.1, 0.12, 0.011], [-0.03, 0.098, 0.011], 0.006), color: main },
    { geo: P.strut([0.1, 0.12, 0.011], [0.03, 0.098, 0.011], 0.006), color: main },
    { geo: P.box(0.27, 0.004, 0.024, 0, 0.152), color: top },
  );
  return P.kit(parts);
}

// ---------------------------------------------------------------- maravilha: stavkirke

/**
 * Partes da grande stavkirke (maravilha da era IV): galeria baixa em volta (svalgang), nave de empena íngreme,
 * três andares escalonados de telhado em pirâmide, flecha com cruz e cabeças de dragão nas cumeeiras.
 * `c0` = madeira escura das paredes, `c1` = telhado de ripas, `c2` = detalhe (ouro, cruz, dragões).
 */
export function staveWonderParts(P: Prims, [c0, c1, c2]: [string, string, string], win: Col): KPart[] {
  const gable = (w: number, rh: number, d: number, y: number) => new THREE.CylinderGeometry(1, 1, 1, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(w, rh / 1.5, d / 1.732).translate(0, y + rh / 3, 0);
  const parts: KPart[] = [];
  // Galeria baixa: parede e telhado de uma água em volta da nave.
  parts.push(
    { geo: P.box(0.42, 0.07, 0.3), color: c0, grad: [0.8, 1.05, 0, 0.07] },
    { geo: P.pyramid(0.5, 0.07, 0.38, 0.07), color: c1 },
  );
  // Nave: o corpo e o telhado íngreme de duas águas, com a cumeeira para a frente.
  parts.push({ geo: P.box(0.3, 0.1, 0.2, 0, 0.07), color: c0, grad: [0.85, 1.05, 0.07, 0.17] }, { geo: gable(0.34, 0.14, 0.24, 0.17), color: c1 });
  // Três andares escalonados de torre central, cada um menor, com telhado em pirâmide.
  let y = 0.2;
  for (let i = 0; i < 3; i++) {
    const s = 1 - i * 0.26;
    parts.push(
      { geo: P.box(0.15 * s, 0.1, 0.15 * s, 0, y), color: c0, grad: [0.85, 1.05, y, y + 0.1] },
      { geo: P.pyramid(0.24 * s, 0.085, 0.24 * s, y + 0.08), color: c1 },
      { geo: P.box(0.008, 0.026, 0.004, 0, y + 0.036, 0.0755 * s + 0.001), color: win, glow: 1 },
    );
    y += 0.15;
  }
  // Flecha, cruz e a ponta dourada.
  parts.push(
    { geo: P.cone(0.022, 0.14, 4, 0, y - 0.04).rotateY(Math.PI / 4), color: c1 },
    { geo: P.box(0.004, 0.04, 0.004, 0, y + 0.1), color: c2 },
    { geo: P.box(0.022, 0.004, 0.004, 0, y + 0.122), color: c2 },
  );
  // Cabeças de dragão nas duas pontas da cumeeira da nave e nos cantos dos andares.
  for (const s of [1, -1]) {
    parts.push(
      { geo: P.strut([0, 0.31, s * 0.12], [0, 0.345, s * 0.15], 0.012), color: c0 },
      { geo: at(P.cone(0.007, 0.034, 4), 0, 0.345, s * 0.15, s * 1.25), color: c2 },
      { geo: at(P.cone(0.004, 0.026, 3), 0, 0.352, s * 0.14, -s * 0.4), color: c2 },
    );
  }
  for (const [x, z] of [[0.09, 0.09], [-0.09, 0.09], [0.09, -0.09], [-0.09, -0.09]]) parts.push({ geo: at(P.cone(0.006, 0.03, 4), x, 0.255, z, 0, 0, -Math.sign(x) * 0.7), color: c2 });
  // Portal e janelas da nave.
  parts.push({ geo: P.box(0.045, 0.06, 0.008, 0, 0.0, 0.152), color: '#2a1e16' }, { geo: P.pyramid(0.06, 0.03, 0.02, 0.06).translate(0, 0, 0.152), color: c1 });
  for (const x of [-0.09, -0.045, 0.045, 0.09]) parts.push({ geo: P.box(0.014, 0.024, 0.004, x, 0.1, 0.1005), color: win, glow: 1 });
  return parts;
}

// ---------------------------------------------------------------- easter egg: troll

/** Troll de pedra de cócoras, com o nariz grande e um olho âmbar que acende à noite. A instância tinge a pedra. */
export function trollGeometry(P: Prims): THREE.BufferGeometry {
  return P.kit([
    { geo: P.jitter(P.ico(0.026, 0), 0.006, 51).scale(1.1, 0.95, 1).translate(0, 0.03, 0), color: '#fff', tint: 1, grad: [0.8, 1.05, 0.005, 0.06] },
    { geo: P.jitter(P.ico(0.016, 0), 0.004, 52).translate(0.002, 0.066, 0.006), color: '#fff', tint: 1 },
    { geo: at(P.cone(0.006, 0.016, 4), 0.002, 0.064, 0.016, Math.PI / 2 - 0.3), color: '#fff', tint: 1 },
    { geo: P.oct(0.0042).translate(-0.006, 0.07, 0.019), color: '#ffb84a', glow: 1 },
    { geo: at(P.box(0.012, 0.03, 0.012), 0.026, 0.006, 0.006, 0, 0, -0.25), color: '#fff', tint: 1 },
    { geo: at(P.box(0.012, 0.03, 0.012), -0.026, 0.006, 0.006, 0, 0, 0.25), color: '#fff', tint: 1 },
    { geo: P.box(0.03, 0.007, 0.02, 0, 0, 0.002), color: '#fff', tint: 1 },
    { geo: P.cone(0.004, 0.01, 4, 0.012, 0.08, 0), color: '#5f7a52' },
  ]);
}

/** Trenó do Natal para o céu: rena à frente, trenó atrás e uma lanterna vermelha que brilha. Maior que o do chão (visto de longe). */
export function skySledGeometry(P: Prims, colors: [string, string]): THREE.BufferGeometry {
  const { head, car } = sledGeometry(P, colors);
  const lamp = P.kit([
    { geo: P.oct(0.006).translate(0.034, 0.05, 0), color: '#ff3a2a', glow: 1 },
    { geo: P.oct(0.004).translate(-0.02, 0.04, 0), color: '#ffe2a8', glow: 1 },
  ]);
  const g = mergeGeometries([head, car.translate(-0.064, 0, 0), lamp])!;
  return g.scale(2.4, 2.4, 2.4);
}
