import * as THREE from 'three/webgpu';

// Kits do tema Brasil Dourado (geometria procedural, sem arquivo de arte). Os desenhos recebem as primitivas de
// lib.ts por parâmetro (`KitTools`), então este arquivo não importa lib.ts e não há ciclo. Convenções do lib:
// bichos e veículos olham para +x e ficam sobre o chão (y = 0); o portal atravessa a estrada ao longo de z (pilares
// em x); a casa e o engenho têm a frente (porta) em +z; `tint = 1` deixa a cor da instância tingir a parte.

type Col = THREE.ColorRepresentation;

export interface KitPart {
  geo: THREE.BufferGeometry;
  color: Col;
  tint?: number;
  glow?: number;
  grad?: [number, number, number, number];
  bands?: { ys: number[]; f: number[] };
}

export interface KitTools {
  kit(parts: KitPart[]): THREE.BufferGeometry;
  box(w: number, h: number, d: number, x?: number, y?: number, z?: number): THREE.BufferGeometry;
  cyl(rt: number, rb: number, h: number, seg: number, x?: number, y?: number, z?: number): THREE.BufferGeometry;
  jitter(geo: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry;
  roofBands(y0: number, y1: number): KitPart['bands'];
}

const FUR_DARK = '#2a2220';

/** Cone sem fundo de `seg` lados com a base em y = 0 (cupinzeiro, chapéu, cauda). */
const spike = (r: number, h: number, seg: number, x = 0, y = 0, z = 0) => new THREE.ConeGeometry(r, h, seg, 1, true).translate(x, y + h / 2, z);

// ---------------------------------------------------------------- telhado colonial

type V = [number, number, number];

/**
 * Tronco de pirâmide aberto (quatro águas) de y = `yB` (base, `wb` × `db`) a y = `yT` (topo, `wt` × `dt`), com as
 * faces para fora. Serve para a aba do telhado colonial.
 */
function frustum(wb: number, db: number, yB: number, wt: number, dt: number, yT: number) {
  const pos: number[] = [];
  const quad = (a: V, b: V, c: V, d: V) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  const [xb, zb, xt, zt] = [wb / 2, db / 2, wt / 2, dt / 2];
  quad([-xb, yB, zb], [xb, yB, zb], [xt, yT, zt], [-xt, yT, zt]);
  quad([xb, yB, -zb], [-xb, yB, -zb], [-xt, yT, -zt], [xt, yT, -zt]);
  quad([xb, yB, zb], [xb, yB, -zb], [xt, yT, -zt], [xt, yT, zt]);
  quad([-xb, yB, -zb], [-xb, yB, zb], [-xt, yT, zt], [-xt, yT, -zt]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  return g;
}

/**
 * Telhado colonial brasileiro: quatro águas de duas inclinações, com a aba (o beiral mais baixo e aberto, que
 * "arremata" a água e joga a chuva longe da parede caiada) e um friso escuro nas duas frentes (a cachorrada).
 * ~32 triângulos: bem perto do `hip`, mas a silhueta deixa de ser europeia.
 */
export function colonialRoof(T: KitTools, w: number, h: number, d: number): { parts: KitPart[]; top: number } {
  const rh = 0.058; // altura total acima da parede (o hip tem 0,07): telhado baixo e de beiral largo, como no casario de Minas
  const yMid = h + 0.012;
  const upper = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1, true).rotateY(Math.PI / 4).scale(w + 0.012, rh - 0.012, d + 0.012).translate(0, yMid + (rh - 0.012) / 2, 0);
  const skirt = frustum(w + 0.074, d + 0.074, h - 0.005, w + 0.012, d + 0.012, yMid);
  const parts: KitPart[] = [
    { geo: upper, color: '#fff', tint: 1, bands: T.roofBands(yMid, h + rh) },
    { geo: skirt, color: '#fff', tint: 1, bands: T.roofBands(h - 0.007, yMid) },
  ];
  // Friso do beiral: tábua escura na ponta da aba, nas duas frentes (não nas empenas).
  for (const z of [(d + 0.074) / 2, -(d + 0.074) / 2]) parts.push({ geo: T.box(w + 0.074, 0.005, 0.004, 0, h - 0.0095, z), color: '#4a3326' });
  return { parts, top: h + rh };
}

// ---------------------------------------------------------------- fauna e bichos

/** Zebu: vaca com giba, orelhas caídas e chifres curtos (o gado do cerrado). A cor da instância tinge o corpo. */
export function zebuGeometry(T: KitTools): THREE.BufferGeometry {
  const leg = (x: number, z: number) => ({ geo: T.box(0.006, 0.022, 0.006, x, 0, z), color: '#4a3e38' });
  return T.kit([
    { geo: T.box(0.054, 0.026, 0.024, 0, 0.022), color: '#fff', tint: 1 },
    { geo: new THREE.OctahedronGeometry(0.011, 0).scale(1.2, 0.9, 1).translate(0.016, 0.054, 0), color: '#fff', tint: 1, grad: [0.9, 1.05, 0.04, 0.066] },
    { geo: T.box(0.019, 0.017, 0.015, 0.036, 0.03), color: '#fff', tint: 1 },
    { geo: T.box(0.006, 0.005, 0.017, 0.046, 0.032), color: '#d8c0b4' },
    ...[0.011, -0.011].map((z) => ({ geo: T.box(0.004, 0.012, 0.011, 0.034, 0.034, z), color: '#fff', tint: 1 })),
    ...[0.005, -0.005].map((z) => ({ geo: spike(0.0025, 0.012, 3, 0.04, 0.046, z), color: '#e8dcc0' })),
    { geo: T.box(0.003, 0.02, 0.003, -0.028, 0.02), color: '#d8cdbe' },
    leg(0.019, 0.008), leg(0.019, -0.008), leg(-0.019, 0.008), leg(-0.019, -0.008),
  ]);
}

/** Ema: ave alta e corredora, pescoço comprido, penas fofas de cinza e marrom. */
export function rheaGeometry(T: KitTools): THREE.BufferGeometry {
  return T.kit([
    { geo: T.jitter(new THREE.IcosahedronGeometry(0.02, 0), 0.003, 61).scale(1.55, 1, 1.05).translate(-0.004, 0.042, 0), color: '#fff', tint: 1, grad: [0.78, 1.1, 0.025, 0.062] },
    { geo: T.jitter(new THREE.IcosahedronGeometry(0.015, 0), 0.003, 62).scale(1.3, 0.9, 1).translate(-0.022, 0.04, 0), color: '#fff', tint: 1, grad: [0.7, 1, 0.025, 0.06] },
    { geo: T.box(0.006, 0.034, 0.006).rotateZ(-0.22).translate(0.02, 0.05, 0), color: '#cfc4b0' },
    { geo: T.box(0.013, 0.008, 0.009, 0.036, 0.081), color: '#8f8272' },
    { geo: T.box(0.009, 0.003, 0.005, 0.047, 0.0825), color: '#5a4a3c' },
    ...[0.006, -0.006].map((z) => ({ geo: T.box(0.004, 0.03, 0.004, 0.002, 0, z), color: '#a89684' })),
    ...[0.006, -0.006].map((z) => ({ geo: T.box(0.011, 0.003, 0.005, 0.007, 0, z), color: '#8a7a68' })),
  ]);
}

/** Lobo-guará: pernas altas e finas e pretas, pelagem ruiva, orelhas enormes e a crina escura no pescoço. */
export function manedWolfGeometry(T: KitTools): THREE.BufferGeometry {
  const leg = (x: number, z: number) => ({ geo: T.box(0.0045, 0.032, 0.0045, x, 0, z), color: FUR_DARK });
  return T.kit([
    { geo: T.box(0.04, 0.016, 0.014, 0, 0.03), color: '#fff', tint: 1, grad: [0.8, 1.08, 0.03, 0.046] },
    { geo: T.box(0.012, 0.02, 0.01).rotateZ(-0.45).translate(0.02, 0.038, 0), color: '#fff', tint: 1 },
    { geo: T.box(0.016, 0.01, 0.01, 0.033, 0.058), color: '#fff', tint: 1 },
    { geo: T.box(0.01, 0.006, 0.006, 0.045, 0.057), color: FUR_DARK },
    ...[0.0045, -0.0045].map((z) => ({ geo: spike(0.0045, 0.018, 3, 0.03, 0.065, z), color: '#fff', tint: 1 })),
    { geo: T.box(0.034, 0.004, 0.005, 0, 0.0455), color: FUR_DARK },
    { geo: T.box(0.014, 0.006, 0.006).rotateZ(0.6).translate(-0.02, 0.04, 0), color: '#f0e6d4' },
    leg(0.014, 0.005), leg(0.014, -0.005), leg(-0.014, 0.005), leg(-0.014, -0.005),
  ]);
}

/** Tamanduá-bandeira: focinho comprido, faixa preta e branca no ombro e o rabo-bandeira arqueado sobre o dorso. */
export function anteaterGeometry(T: KitTools): THREE.BufferGeometry {
  const leg = (x: number, z: number) => ({ geo: T.box(0.005, 0.016, 0.005, x, 0, z), color: '#3a2e28' });
  return T.kit([
    { geo: T.box(0.044, 0.02, 0.02, 0, 0.014), color: '#fff', tint: 1, grad: [0.8, 1.1, 0.014, 0.034] },
    { geo: T.box(0.009, 0.0215, 0.0215, 0.008, 0.0135).rotateZ(-0.25), color: '#1e1a18' },
    { geo: T.box(0.003, 0.0218, 0.0218, 0.0145, 0.013).rotateZ(-0.25), color: '#f2ece0' },
    { geo: new THREE.ConeGeometry(0.0065, 0.036, 4, 1, true).rotateZ(-Math.PI / 2 - 0.2).translate(0.043, 0.02, 0), color: '#fff', tint: 1 },
    { geo: spike(0.015, 0.056, 5).rotateZ(Math.PI / 2 - 0.5).translate(-0.016, 0.025, 0), color: '#fff', tint: 1, grad: [1.05, 0.6, 0, 0.05] },
    leg(0.016, 0.007), leg(0.016, -0.007), leg(-0.016, 0.007), leg(-0.016, -0.007),
  ]);
}

/** Mula de tropa (cor fixa de pelo, ao contrário dos bichos de pasto) com a carga de fardos e o balaio. */
export function muleGeometry(T: KitTools, det: Col): THREE.BufferGeometry {
  const leg = (x: number, z: number) => ({ geo: T.box(0.005, 0.026, 0.005, x, 0, z), color: '#3a2e26' });
  return T.kit([
    { geo: T.box(0.04, 0.02, 0.016, 0, 0.026), color: '#7a5a42', grad: [0.85, 1.08, 0.026, 0.046] },
    { geo: T.box(0.011, 0.024, 0.011).rotateZ(-0.4).translate(0.022, 0.038, 0), color: '#7a5a42' },
    { geo: T.box(0.018, 0.011, 0.011, 0.036, 0.054), color: '#7a5a42' },
    { geo: T.box(0.008, 0.004, 0.008, 0.045, 0.052), color: '#d8cdbc' },
    ...[0.003, -0.003].map((z) => ({ geo: spike(0.003, 0.018, 3, 0.03, 0.06, z).rotateZ(0.3), color: '#4a3a30' })),
    { geo: T.box(0.004, 0.016, 0.003, -0.022, 0.024), color: '#3a2e26' },
    // Cangalha: duas bruacas penduradas dos lados e um fardo no meio.
    { geo: T.box(0.03, 0.004, 0.02, -0.002, 0.045), color: '#5a4032' },
    ...[0.012, -0.012].map((z) => ({ geo: T.box(0.022, 0.018, 0.008, -0.002, 0.03, z), color: det })),
    { geo: T.box(0.018, 0.012, 0.014, -0.002, 0.049), color: '#d9c08a' },
    leg(0.014, 0.006), leg(0.014, -0.006), leg(-0.014, 0.006), leg(-0.014, -0.006),
  ]);
}

// ---------------------------------------------------------------- carro de boi

/**
 * Carro de boi: a junta de bois sob o canzil, o cabeçalho comprido e o carro de rodas maciças com carga de
 * cana. Os bois e o chassi seguem a cor da instância (a cor do gado do tema); a carga e o resto têm cor fixa.
 */
export function oxcartGeometry(T: KitTools, [body, det]: [string, string]): THREE.BufferGeometry {
  const ox = (z: number): KitPart[] => [
    { geo: T.box(0.042, 0.022, 0.014, 0.058, 0.02, z), color: '#fff', tint: 1 },
    { geo: new THREE.OctahedronGeometry(0.008, 0).translate(0.049, 0.046, z), color: '#fff', tint: 1 },
    { geo: T.box(0.015, 0.015, 0.012, 0.085, 0.026, z), color: '#fff', tint: 1 },
    ...[0.005, -0.005].map((dz) => ({ geo: spike(0.0022, 0.011, 3, 0.088, 0.04, z + dz), color: '#e8dcc0' })),
    ...[0.014, -0.014].flatMap((dx) => [0.004, -0.004].map((dz) => ({ geo: T.box(0.005, 0.02, 0.005, 0.058 + dx, 0, z + dz), color: '#4a3e38' }))),
  ];
  const wheel = (z: number): KitPart[] => [
    { geo: T.cyl(0.018, 0.018, 0.005, 10, 0, 0, 0).rotateX(Math.PI / 2).translate(-0.03, 0.002, z), color: '#6a4a32' },
    { geo: T.box(0.004, 0.036, 0.0055, -0.03, 0.0, z), color: '#4a3326' },
  ];
  return T.kit([
    ...ox(0.012),
    ...ox(-0.012),
    // Canzil (a canga) sobre o pescoço dos dois bois e o cabeçalho até o eixo do carro.
    { geo: T.box(0.006, 0.005, 0.044, 0.078, 0.045), color: '#5a4032' },
    { geo: T.box(0.1, 0.004, 0.004, 0.028, 0.03), color: '#5a4032' },
    // Chassi, eixo e laterais de tábua.
    { geo: T.box(0.064, 0.006, 0.034, -0.03, 0.026), color: '#6a4a32' },
    { geo: T.box(0.004, 0.004, 0.046, -0.03, 0.02), color: '#3e2c22' },
    ...[0.017, -0.017].map((z) => ({ geo: T.box(0.064, 0.016, 0.003, -0.03, 0.032, z), color: '#7a5238' })),
    { geo: T.box(0.003, 0.016, 0.034, 0.002, 0.032), color: '#7a5238' },
    { geo: T.box(0.003, 0.016, 0.034, -0.062, 0.032), color: '#7a5238' },
    // Carga: feixes de cana e uma coberta de palha.
    { geo: T.box(0.056, 0.014, 0.03, -0.03, 0.038), color: '#a8b94a' },
    { geo: T.box(0.05, 0.004, 0.024, -0.03, 0.052), color: det },
    { geo: T.box(0.05, 0.005, 0.005, -0.03, 0.056), color: body },
    ...wheel(0.023),
    ...wheel(-0.023),
  ]);
}

// ---------------------------------------------------------------- araras (bando)

/**
 * Arara em voo, no molde do pássaro do lib (asas planas abertas em z, que o `Life` bate escalando z; olha para +x):
 * corpo e ombro na cor 1, asas na 2 e pontas das asas e cauda na 3. Cada face duas vezes (as duas mãos), sem tint.
 */
export function macawGeometry(T: KitTools, [bodyC, wingC, tipC]: [string, string, string]): THREE.BufferGeometry {
  const tri = (a: V, b: V, c: V) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...a, ...b, ...c, ...c, ...b, ...a]), 3));
    return g;
  };
  const parts: KitPart[] = [];
  for (const s of [1, -1]) {
    const P = (x: number, y: number, z: number): V => [x * 1.35, y * 1.35, z * s * 1.35];
    // Asa: raiz, meio e ponta (a mão da asa é a última faixa).
    parts.push({ geo: tri(P(0.011, 0, 0.003), P(-0.009, 0, 0.003), P(-0.014, 0.003, 0.02)), color: bodyC });
    parts.push({ geo: tri(P(0.011, 0, 0.003), P(-0.014, 0.003, 0.02), P(0.004, 0.002, 0.02)), color: wingC });
    parts.push({ geo: tri(P(0.004, 0.002, 0.02), P(-0.014, 0.003, 0.02), P(-0.022, 0.004, 0.036)), color: tipC });
  }
  parts.push({ geo: new THREE.OctahedronGeometry(0.0075 * 1.35, 0).scale(2.3, 0.8, 0.8).translate(0.0015, 0.0005, 0), color: bodyC });
  parts.push({ geo: new THREE.OctahedronGeometry(0.0045 * 1.35, 0).translate(0.0165, 0.002, 0), color: '#f2ece0' });
  // Cauda comprida em duas penas, o azul por cima do vermelho.
  parts.push({ geo: tri([-0.009, 0, 0.002], [-0.009, 0, -0.002], [-0.042, 0.001, 0]), color: bodyC });
  parts.push({ geo: tri([-0.026, 0.0008, 0.0012], [-0.026, 0.0008, -0.0012], [-0.056, 0.0015, 0]), color: tipC });
  return T.kit(parts);
}

// ---------------------------------------------------------------- cupinzeiro

/**
 * Cupinzeiro: um monte de terra em sino (torneado, 6 faces), com dois menores encostados e uma boca escura na base
 * do maior. A cor da instância é a da terra; o topo fica um pouco mais claro e seco.
 */
export function termiteMoundGeometry(T: KitTools): THREE.BufferGeometry {
  const bell = (k: number, x: number, z: number, seed: number): KitPart => {
    const pts = [[0.024, -0.002], [0.0185, 0.018], [0.0105, 0.04], [0.004, 0.058], [0, 0.066]].map(([r, y]) => new THREE.Vector2(r * k, y * k));
    return { geo: T.jitter(new THREE.LatheGeometry(pts, 6).translate(x, 0, z), 0.0035, seed), color: '#fff', tint: 1, grad: [0.74, 1.16, 0, 0.066 * k] };
  };
  return T.kit([bell(1, 0, 0, 71), bell(0.62, 0.03, 0.01, 72), bell(0.45, -0.022, -0.018, 73), { geo: T.box(0.007, 0.006, 0.004, -0.0005, 0.0, 0.0225), color: '#2a1810' }]);
}

// ---------------------------------------------------------------- porteira

/**
 * Porteira da fazenda sobre a estrada (a via passa ao longo de z, os mourões ficam em x): dois mourões, a travessa
 * de cima com a tabuleta pendurada (cor `top`) e uma folha aberta a 70° com quatro tábuas e a mão-francesa.
 */
export function porteiraGeometry(T: KitTools, [wood, top]: [string, string]): THREE.BufferGeometry {
  const parts: KitPart[] = [];
  for (const x of [-0.12, 0.12]) {
    parts.push({ geo: T.cyl(0.0075, 0.0095, 0.13, 6, x), color: wood }, { geo: T.cyl(0.0055, 0.0075, 0.012, 6, x, 0.13), color: '#6a5a4a' });
  }
  parts.push({ geo: T.box(0.26, 0.009, 0.009, 0, 0.12), color: wood });
  parts.push({ geo: T.box(0.07, 0.022, 0.004, 0, 0.092), color: top });
  for (const x of [-0.025, 0.025]) parts.push({ geo: T.box(0.0015, 0.01, 0.0015, x, 0.112), color: '#3e3028' });
  // Folha aberta: gira sobre o mourão da esquerda e fica quase ao longo da via.
  const leaf: KitPart[] = [0.012, 0.036, 0.06, 0.084].map((y) => ({ geo: T.box(0.11, 0.007, 0.005, 0.055, y), color: wood }));
  leaf.push({ geo: T.box(0.005, 0.088, 0.005, 0.004, 0.0), color: wood }, { geo: T.box(0.005, 0.088, 0.005, 0.108, 0.0), color: wood });
  leaf.push({ geo: new THREE.BoxGeometry(0.128, 0.005, 0.004).rotateZ(0.57).translate(0.055, 0.048, 0), color: wood });
  for (const p of leaf) parts.push({ ...p, geo: p.geo.rotateY(-1.2).translate(-0.12, 0, 0.005) });
  return T.kit(parts);
}

// ---------------------------------------------------------------- engenho de açúcar

/**
 * Engenho: casa caiada de telhado de quatro águas, a chaminé de tijolo (a caldeira), a roda d'água de um lado e
 * a cana empilhada à frente. A frente (porta) olha para +z. `walls` e `roofs` vêm do tema.
 */
export function engenhoGeometry(T: KitTools, wall: Col, roof: Col, win: Col): THREE.BufferGeometry {
  const parts: KitPart[] = [
    { geo: T.box(0.13, 0.05, 0.085, 0, 0.0), color: wall, grad: [0.9, 1.03, 0, 0.05] },
    { geo: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1, true).rotateY(Math.PI / 4).scale(0.158, 0.05, 0.112).translate(0, 0.05 + 0.025, 0), color: roof },
    { geo: T.box(0.014, 0.028, 0.004, 0.02, 0, 0.0435), color: '#4a3326' },
    ...[-0.04, -0.012].map((x) => ({ geo: T.box(0.014, 0.014, 0.004, x, 0.022, 0.0435), color: win, glow: 1 })),
    // Chaminé de tijolo da caldeira, com a boca mais larga.
    { geo: T.cyl(0.0085, 0.0125, 0.125, 6, -0.04, 0, -0.018), color: '#a8502e', grad: [0.82, 1.08, 0, 0.125] },
    { geo: T.cyl(0.0115, 0.0095, 0.008, 6, -0.04, 0.117, -0.018), color: '#7a3a24' },
    // Roda d'água no flanco +x: aro, raios e a calha.
    { geo: new THREE.TorusGeometry(0.036, 0.0045, 3, 10).rotateY(Math.PI / 2).translate(0.083, 0.04, 0), color: '#6a4a32' },
    ...[0, 1, 2, 3].map((i) => ({ geo: T.box(0.005, 0.072, 0.004).translate(0, -0.036, 0).rotateX((i * Math.PI) / 4).translate(0.083, 0.04, 0), color: '#7a5238' })),
    { geo: T.box(0.012, 0.01, 0.012, 0.083, 0.0, 0), color: '#5a5a54' },
  ];
  // Cana empilhada à frente: 3 feixes embaixo, 2 no meio e 1 em cima.
  const stack: [number, number][] = [[0.062, 0], [0.078, 0], [0.094, 0], [0.07, 1], [0.086, 1], [0.078, 2]];
  for (const [z, row] of stack) parts.push({ geo: T.box(0.05, 0.009, 0.0165, -0.02, row * 0.0085, z), color: row === 1 ? '#a8b94a' : '#98aa40' });
  return T.kit(parts);
}

// ---------------------------------------------------------------- cafezal em florada

/** Cafezal florido: o mesmo arbusto escuro do café, com a copa salpicada de flores brancas (e sem os frutos). */
export function coffeeBloomGeometry(T: KitTools): THREE.BufferGeometry {
  const flower = (x: number, y: number, z: number): KitPart => ({ geo: new THREE.TetrahedronGeometry(0.0078, 0).translate(x, y, z), color: '#f8f6ef' });
  return T.kit([
    { geo: T.jitter(new THREE.IcosahedronGeometry(0.028, 0), 0.006, 15).scale(1, 1.3, 1).translate(0, 0.035, 0), color: '#fff', tint: 1, grad: [0.7, 1.05, 0, 0.07] },
    flower(0.02, 0.04, 0.01), flower(-0.019, 0.045, -0.011), flower(0.005, 0.058, 0.02), flower(-0.008, 0.052, -0.022),
    flower(0.022, 0.05, -0.012), flower(-0.02, 0.036, 0.014), flower(0.002, 0.068, 0),
  ]);
}

// ---------------------------------------------------------------- easter eggs

/** Os Doze Profetas de Congonhas: doze estátuas de pedra-sabão em fila nos dois terraços da escadaria (a sétima, de chapéu de tropeiro). */
export function profetasGeometry(T: KitTools): THREE.BufferGeometry {
  const stone = '#c3cabb', soap = '#b3c0ad';
  const parts: KitPart[] = [
    { geo: T.box(0.3, 0.01, 0.1), color: '#cfc6b4', grad: [0.85, 1, 0, 0.01] },
    { geo: T.box(0.27, 0.01, 0.066, 0, 0.01), color: '#d8d0be' },
    { geo: T.box(0.292, 0.012, 0.004, 0, 0.02, 0.05), color: '#bdb4a2' },
  ];
  for (let i = 0; i < 12; i++) {
    const x = -0.121 + i * 0.022;
    const z = i % 2 ? 0.014 : -0.012;
    parts.push({ geo: T.box(0.011, 0.012, 0.011, x, 0.02, z), color: '#c8c0ae' });
    parts.push({ geo: new THREE.ConeGeometry(0.0095, 0.038, 4, 1, true).rotateY(Math.PI / 4).translate(x, 0.032 + 0.019, z), color: i % 3 ? stone : soap });
    parts.push({ geo: new THREE.TetrahedronGeometry(0.0062, 0).translate(x, 0.077, z), color: '#a8b0a0' });
    // Braços abertos (o gesto de cada profeta).
    parts.push({ geo: T.box(0.026, 0.004, 0.004, x, 0.058, z), color: stone });
    if (i === 6) {
      parts.push({ geo: T.cyl(0.0125, 0.0125, 0.002, 7, x, 0.0795, z), color: '#d8c9a0' });
      parts.push({ geo: T.cyl(0.0065, 0.0075, 0.007, 6, x, 0.081, z), color: '#c4b488' });
    }
  }
  return T.kit(parts);
}

/** Onça-pintada deitada num tronco caído: pelo amarelo com rosetas pretas, a cauda pendente. */
export function jaguarGeometry(T: KitTools): THREE.BufferGeometry {
  const fur = '#e0a42c', spot = '#2a1c10';
  const spots: [number, number, number][] = [[-0.014, 0.043, 0.004], [0.002, 0.044, -0.005], [-0.006, 0.0435, 0.0], [0.012, 0.042, 0.005], [-0.02, 0.04, -0.008], [0.005, 0.034, 0.0095], [-0.012, 0.033, -0.0095]];
  return T.kit([
    // O tronco: um cilindro deitado com um toco de galho.
    { geo: T.cyl(0.013, 0.015, 0.13, 6).rotateZ(Math.PI / 2).translate(0, 0.013, 0), color: '#5a3b2a' },
    { geo: T.cyl(0.004, 0.006, 0.03, 4).rotateZ(0.9).translate(0.05, 0.02, 0.01), color: '#5a3b2a' },
    { geo: T.box(0.052, 0.016, 0.018, -0.004, 0.024), color: fur, grad: [0.85, 1.08, 0.024, 0.04] },
    { geo: T.box(0.018, 0.015, 0.015, 0.034, 0.028), color: fur },
    { geo: T.box(0.006, 0.006, 0.01, 0.045, 0.027), color: '#f0dcb4' },
    ...[0.005, -0.005].map((z) => ({ geo: spike(0.0035, 0.007, 3, 0.03, 0.042, z), color: fur })),
    // Cauda pendendo do tronco e as patas caídas.
    { geo: T.box(0.005, 0.034, 0.005, -0.034, 0.0).rotateZ(0.2).translate(0, 0.036, 0), color: fur },
    ...[0.012, -0.012].flatMap((z) => [0.016, -0.018].map((x) => ({ geo: T.box(0.006, 0.013, 0.005, x, 0.017, z), color: fur }))),
    ...spots.map(([x, y, z]) => ({ geo: new THREE.TetrahedronGeometry(0.0034, 0).translate(x, y, z), color: spot })),
  ]);
}
