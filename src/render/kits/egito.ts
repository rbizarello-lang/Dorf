import * as THREE from 'three/webgpu';
import { mulberry32 } from '../../core/rng';
import { box, cone, cyl, kit, pyramid, taper, type Part } from '../lib';
import { PEAK } from '../relief';

// Kits do Egito do Nilo (T2): falésia de arenito, pilone de entrada, terraço de adobe com toldo, shaduf, ibis, crocodilo,
// boi de chifres de lira e os easter eggs (esfinge, gato, ibis em pé, pirâmide). Tudo procedural, no contrato de lib.ts
// (position, normal, color, tint, glow). O lib.ts importa este arquivo; as funções só rodam depois que os dois módulos carregaram.

type V3 = [number, number, number];

// ---------------------------------------------------------------- falésia de arenito

/** Altura da mesa de arenito em relação à serra do `relief.ts`: a falésia é baixa e de topo quase chato. */
const MESA_H = 0.58;
/**
 * Os blocos da falésia, no espaço do kit (x, z do centro, raio da parede e altura): um maciço alto, um bloco mais baixo
 * encostado nele e uma torre estreita e solta, de alturas diferentes. O conjunto cabe na pegada da serra (`PEAK_REACH`),
 * para o tileBuilder tratar as duas igual.
 */
const MESA_BLOCKS: readonly { x: number; z: number; R: number; H: number; strata: number; n: number; nFar: number }[] = [
  { x: -0.05, z: 0.02, R: 0.31, H: PEAK.h * MESA_H, strata: 6, n: 14, nFar: 8 },
  { x: 0.33, z: 0.2, R: 0.21, H: PEAK.h * MESA_H * 0.62, strata: 4, n: 10, nFar: 6 },
  { x: 0.1, z: -0.34, R: 0.14, H: PEAK.h * MESA_H * 0.92, strata: 4, n: 8, nFar: 6 },
];

/**
 * Falésia de arenito: um conjunto de 3 blocos de alturas diferentes, cada um com o contorno recortado (reentrâncias e
 * esporões vêm de harmônicas e de um entalhe, então a versão leve tem a mesma silhueta), estratos de espessura
 * variável que ora saem, ora recuam (o duro sai, o mole recua), topo levemente inclinado e talude de detritos no pé,
 * com alguns blocos caídos. `tint = 1` na rocha (recebe a cor da instância); o pé e o topo de areia têm cor fixa.
 * A versão leve tem menos lados e menos estratos.
 */
export function mesaGeometry(o: { foot: THREE.ColorRepresentation; far?: boolean }): THREE.BufferGeometry {
  const rng = mulberry32(0x3e5a11);
  const pos: number[] = [];
  const col: number[] = [];
  const tint: number[] = [];
  const foot = new THREE.Color(o.foot);
  const cap = new THREE.Color('#dcc58c');
  const c = new THREE.Color();
  const vert = (p: V3, color: THREE.Color, t: number) => {
    pos.push(...p);
    col.push(color.r, color.g, color.b);
    tint.push(t);
  };
  const face = (a: V3, b: V3, d: V3, ca: THREE.Color, cb: THREE.Color, cd: THREE.Color, ta: number, tb: number, td: number, ox: number, oz: number) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (a[0] + b[0] + d[0]) / 3 - ox, mz = (a[2] + b[2] + d[2]) / 3 - oz;
    if (nx * mx + nz * mz + ny * 0.3 < 0) {
      [b, d] = [d, b];
      [cb, cd] = [cd, cb];
      [tb, td] = [td, tb];
    }
    vert(a, ca, ta);
    vert(b, cb, tb);
    vert(d, cd, td);
  };
  MESA_BLOCKS.forEach((blk, k) => {
    const { x: ox, z: oz, R, H } = blk;
    const N = o.far ? blk.nFar : blk.n;
    // Contorno: harmônicas de fases sorteadas e um entalhe fundo (a ravina), os mesmos em todos os anéis e nas duas versões.
    const ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28];
    const am = [0.13 + rng() * 0.07, 0.09 + rng() * 0.06, 0.06 + rng() * 0.05];
    const notchA = rng() * 6.28, notchW = 0.32 + rng() * 0.2, notchD = 0.34 + rng() * 0.12;
    const contour = (a: number) => {
      let dn = Math.abs(a - notchA) % (Math.PI * 2);
      if (dn > Math.PI) dn = Math.PI * 2 - dn;
      return 1 + am[0] * Math.sin(2 * a + ph[0]) + am[1] * Math.sin(3 * a + ph[1]) + am[2] * Math.sin(5 * a + ph[2]) - notchD * Math.exp(-((dn / notchW) ** 2));
    };
    // Estratos de espessura variável: fronteiras entre o talude e o topo, e o valor (claro, escuro...) de cada faixa.
    const talusTop = 0.17 + rng() * 0.07;
    const ws = Array.from({ length: blk.strata }, () => 0.45 + rng());
    const wsum = ws.reduce((a2, b2) => a2 + b2, 0);
    const bounds: number[] = [talusTop];
    ws.forEach((w) => bounds.push(bounds[bounds.length - 1] + (w / wsum) * (0.97 - talusTop)));
    const bandVal = ws.map((_, i) => (i % 2 ? 0.82 : 1.08) * (0.93 + rng() * 0.14));
    const bulge = ws.map((_, i) => (i % 2 ? 0.93 : 1.0) * (0.97 + rng() * 0.06));
    // Topo inclinado: um lado sobe e o outro desce até ~10% da altura.
    const tilt = (0.05 + rng() * 0.05) * (rng() < 0.5 ? -1 : 1), tiltDir = rng() * 6.28;
    // Anéis [fração da altura, raio em frações de R, faixa de cima]; o de baixo afunda no chão.
    const full: [number, number, number][] = [[-0.06, 1.34, -1], [talusTop, 1.04, -1]];
    bounds.slice(1).forEach((hh, i) => full.push([hh, bulge[i], i]));
    full.push([1, 0.86, blk.strata - 1]);
    const rings = o.far ? [full[0], full[1], full[Math.ceil(full.length / 2)], full[full.length - 1]] : full;
    const verts: V3[][] = rings.map(([hh, rr], ri) =>
      Array.from({ length: N }, (_, i) => {
        const a = ((i + (o.far ? 0 : Math.sin(i * 12.9 + k) * 0.18)) / N) * Math.PI * 2;
        const cf = contour(a);
        const r = R * rr * (hh < talusTop - 0.01 ? 1 + (cf - 1) * 0.5 : cf) * (o.far ? 1 : 0.985 + 0.03 * Math.abs(Math.sin(i * 7.7 + ri * 3.1 + k)));
        return [ox + Math.cos(a) * r, H * hh + (hh > 0 ? tilt * H * hh * Math.cos(a - tiltDir) * (r / R) : 0), oz + Math.sin(a) * r] as V3;
      }),
    );
    const put = (a: V3, b: V3, d: V3, band: number) => {
      const yc = (a[1] + b[1] + d[1]) / 3;
      const talus = band < 0;
      const f = (talus ? 1 : bandVal[band]) * (0.97 + rng() * 0.06) * (talus ? 0.98 + 0.12 * (1 - Math.max(0, yc) / (H * talusTop)) : 1);
      // O talude clareia na direção da areia do pé; a parede leva o estrato; o pé afundado (y < 0,015) tem a cor do chão.
      c.setRGB(f * (talus ? 1.06 : 1), f * (talus ? 1.03 : 0.98), f * (talus ? 0.96 : 0.9));
      const base = c.clone();
      const vc = (p: V3) => (p[1] < 0.015 ? foot : base);
      const vt = (p: V3) => (p[1] < 0.015 ? 0 : 1);
      face(a, b, d, vc(a), vc(b), vc(d), vt(a), vt(b), vt(d), ox, oz);
    };
    for (let ri = 0; ri + 1 < rings.length; ri++) {
      const band = rings[ri + 1][2];
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const a = verts[ri][i], b = verts[ri][j], d = verts[ri + 1][j], e = verts[ri + 1][i];
        if ((i + ri + k) % 2) {
          put(a, b, d, band);
          put(a, d, e, band);
        } else {
          put(a, b, e, band);
          put(b, d, e, band);
        }
      }
    }
    // Topo de areia clara, com um leve abaulado no meio.
    const top = verts[verts.length - 1];
    const apex: V3 = [ox, H * 1.02, oz];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      face(top[i], top[j], apex, cap, cap, cap, 0, 0, 0, ox, oz);
    }
    // Blocos caídos no pé do maciço (só na versão cheia): octaedros achatados de rocha, no talude.
    if (k === 0 && !o.far) {
      for (let q = 0; q < 6; q++) {
        const a = 0.4 + q * 1.05 + rng() * 0.4, rr = R * (1.38 + rng() * 0.22) * contour(a), s = 0.022 + rng() * 0.03;
        const cx = ox + Math.cos(a) * rr, cz = oz + Math.sin(a) * rr, cy = s * 0.2;
        const g = new THREE.OctahedronGeometry(s, 0).rotateY(rng() * 3);
        const pp = g.attributes.position as THREE.BufferAttribute;
        const f = 0.9 + rng() * 0.2;
        c.setRGB(f * 1.04, f, f * 0.9);
        const rc = c.clone();
        for (let t = 0; t < pp.count; t += 3) {
          const tv = [0, 1, 2].map((u) => [cx + pp.getX(t + u), cy + pp.getY(t + u) * 0.62, cz + pp.getZ(t + u)] as V3);
          face(tv[0], tv[1], tv[2], rc, rc, rc, 1, 1, 1, cx, cz);
        }
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(tint), 1));
  g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(tint.length), 1));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- pilone (portal da trilha)

/** Pilone de entrada da vila: duas torres de paredes inclinadas, cornija na cor do topo, travessa com o disco solar alado e dois mastros com flâmulas. */
export function pylonGateGeometry([main, top]: [string, string]): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    const x = s * 0.128;
    parts.push(
      { geo: taper(box(0.078, 0.17, 0.054, x, 0), 0.8), color: main, grad: [0.84, 1.06, 0, 0.17] },
      // Cornija (garganta egípcia) e um friso fino abaixo dela.
      { geo: box(0.09, 0.008, 0.064, x, 0.166), color: main },
      { geo: box(0.066, 0.007, 0.056, x, 0.152), color: top },
      // Mastro e flâmula: a flâmula é a cor do topo (lápis-lazúli).
      { geo: cyl(0.0022, 0.0022, 0.12, 4, x + s * 0.026, 0.17, 0.03), color: '#6a4a2a' },
      { geo: box(0.0015, 0.026, 0.014, x + s * 0.026, 0.262, 0.037), color: top },
    );
  }
  parts.push(
    // Travessa entre as torres e o disco alado no centro.
    { geo: box(0.2, 0.024, 0.04, 0, 0.12), color: main, grad: [0.9, 1.05, 0.12, 0.144] },
    { geo: box(0.2, 0.004, 0.046, 0, 0.144), color: main, grad: [0.85, 0.85, 0, 1] },
    { geo: box(0.2, 0.004, 0.042, 0, 0.12), color: top },
    { geo: cyl(0.012, 0.012, 0.004, 8, 0, 0).rotateX(Math.PI / 2).translate(0, 0.132, 0.021), color: '#e0b84a', glow: 0.3 },
    ...[-1, 1].map((s) => ({ geo: box(0.036, 0.007, 0.004, s * 0.03, 0.131, 0.021), color: top })),
  );
  return kit(parts);
}

// ---------------------------------------------------------------- casa de terraço e toldo

/** Medidas da casa de terraço (a mesma entrada de BODY em lib.ts). */
export const TERRACE = { w: 0.13, h: 0.085, d: 0.12 };
/** Sala do andar de cima: ocupa o fundo do terraço. */
const ROOM = { w: 0.074, h: 0.05, d: 0.058, x: -0.022, z: -0.026 };
const SLAB = 0.014;

/** Partes que a `wallGeometry` acrescenta ao cubo: sala do andar de cima, escada externa e vão da porta de cima. */
export function terraceWallParts(win: THREE.ColorRepresentation, door: THREE.ColorRepresentation, bright = 1): Part[] {
  const { w, h, d } = TERRACE;
  const y0 = h + SLAB;
  const parts: Part[] = [
    { geo: box(ROOM.w, ROOM.h, ROOM.d, ROOM.x, y0, ROOM.z), color: '#fff', tint: 1, bands: { ys: [y0 + ROOM.h * 0.25], f: [0.85, 1] } },
    // Porta e janelinha da sala (planos colados à parede da frente).
    { geo: new THREE.PlaneGeometry(0.02, 0.03).translate(ROOM.x - 0.014, y0 + 0.015, ROOM.z + ROOM.d / 2 + 0.0035), color: door },
    { geo: new THREE.PlaneGeometry(0.016, 0.02).translate(ROOM.x + 0.018, y0 + 0.026, ROOM.z + ROOM.d / 2 + 0.0035), color: win, glow: bright },
  ];
  // Escada externa pela lateral +x: sobe de frente para trás, até a altura do terraço.
  const n = 5;
  for (let i = 0; i < n; i++) {
    const hh = ((i + 1) / n) * (h + 0.004);
    parts.push({ geo: box(0.024, hh, 0.02, w / 2 + 0.012, 0, d / 2 - 0.016 - i * 0.02), color: '#fff', tint: 1, grad: [0.88, 1, 0, 0.09] });
  }
  return parts;
}

/**
 * Telhado do terraço (`awning`): laje do cubo, laje da sala do andar de cima e o toldo de cana listrado em lapis-lazúli,
 * marfim e ocre sobre a frente do terraço, com dois esteios. Laje com `tint = 1`; toldo e esteios têm cor fixa.
 */
export function awningRoofParts(): { parts: Part[]; top: number } {
  const { w, h, d } = TERRACE;
  const y0 = h + SLAB;
  const parts: Part[] = [
    { geo: box(w + 0.01, SLAB, d + 0.01, 0, h), color: '#fff', tint: 1 },
    // Mureta baixa no lado da escada e no fundo.
    { geo: box(0.008, 0.01, d + 0.01, -w / 2 - 0.001, h + SLAB), color: '#fff', tint: 1 },
    { geo: box(w + 0.01, 0.01, 0.008, 0, h + SLAB, -d / 2), color: '#fff', tint: 1 },
    { geo: box(ROOM.w + 0.008, 0.012, ROOM.d + 0.008, ROOM.x, y0 + ROOM.h), color: '#fff', tint: 1 },
  ];
  // Toldo: sobre a metade da frente do terraço, caindo para a frente, com listras no sentido do declive.
  const colors = ['#2a4b8d', '#efe6cf', '#b5533a', '#efe6cf'];
  const z0 = d / 2 + 0.012, z1 = 0.012, yHi = y0 + 0.052, yLo = y0 + 0.034;
  const len = Math.hypot(z0 - z1, yHi - yLo), tilt = Math.atan2(yHi - yLo, z0 - z1);
  const sw = 0.02;
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * sw + 0.012;
    if (x - sw / 2 < -w / 2 || x + sw / 2 > w / 2 + 0.004) continue;
    parts.push({ geo: new THREE.BoxGeometry(sw * 0.96, 0.003, len).rotateX(tilt).translate(x, (yHi + yLo) / 2, (z0 + z1) / 2), color: colors[i % colors.length] });
  }
  // Esteios na beira da frente.
  for (const x of [-0.044, 0.05]) parts.push({ geo: cyl(0.0026, 0.0026, yLo - y0 + 0.004, 4, x, y0 - 0.002, z0 - 0.006), color: '#5a4026' });
  return { parts, top: y0 + ROOM.h + 0.012 };
}

// ---------------------------------------------------------------- shaduf

/** Shaduf: poste de dois esteios, braço com o balde de couro numa ponta (sobre a água, +x) e o contrapeso de barro na outra. */
export function shadufGeometry(): THREE.BufferGeometry {
  const wood = '#6a4a2a';
  const mud = '#8a6a44';
  return kit([
    { geo: box(0.05, 0.008, 0.03, 0, 0), color: mud, grad: [0.8, 1, 0, 0.008] },
    // Dois esteios de barro e a travessa de cima.
    ...[-0.008, 0.008].map((z) => ({ geo: box(0.01, 0.07, 0.008, 0, 0.004, z), color: mud, grad: [0.85, 1.05, 0, 0.07] as [number, number, number, number] })),
    { geo: box(0.012, 0.008, 0.028, 0, 0.074), color: mud },
    // Braço: levemente inclinado, a ponta do balde mais baixa.
    { geo: box(0.1, 0.004, 0.004, 0.008, 0.08).rotateZ(-0.12), color: wood },
    // Contrapeso (bola de barro) na ponta de trás.
    { geo: new THREE.IcosahedronGeometry(0.01, 0).translate(-0.04, 0.092, 0), color: mud },
    // Corda e balde.
    { geo: cyl(0.0007, 0.0007, 0.04, 3, 0.058, 0.042), color: '#cdb98a' },
    { geo: cyl(0.0065, 0.005, 0.01, 6, 0.058, 0.034), color: '#7a5030' },
  ]);
}

// ---------------------------------------------------------------- animais

/** Íbis sagrado: corpo branco, cabeça e ponta da cauda pretas, bico longo e curvo, pernas finas. A cor da instância tinge o corpo. */
export function ibisGeometry(): THREE.BufferGeometry {
  const dark = '#2a2628';
  return kit([
    { geo: new THREE.IcosahedronGeometry(0.0105, 0).scale(1.7, 1, 1).translate(0, 0.034, 0), color: '#fff', tint: 1 },
    { geo: box(0.006, 0.026, 0.006, 0.013, 0.036).rotateZ(-0.35), color: '#fff', tint: 1 },
    { geo: box(0.009, 0.008, 0.008, 0.02, 0.063), color: dark },
    // Bico em foice: dois segmentos que descem.
    { geo: cone(0.0028, 0.016, 3).rotateZ(-Math.PI / 2 - 0.15).translate(0.025, 0.063, 0), color: dark },
    { geo: cone(0.002, 0.01, 3).rotateZ(-Math.PI / 2 - 0.95).translate(0.038, 0.06, 0), color: dark },
    { geo: box(0.01, 0.004, 0.008, -0.019, 0.033), color: dark },
    ...[0.004, -0.004].map((z) => ({ geo: cyl(0.0009, 0.0009, 0.026, 3, 0.002, 0.006, z), color: '#4a3a34' })),
  ]);
}

/** Crocodilo do Nilo: corpo baixo e comprido, cauda afilada, focinho largo, olhos salientes e escudos no dorso. A cor da instância tinge o couro. */
export function crocodileGeometry(): THREE.BufferGeometry {
  const parts: Part[] = [
    { geo: box(0.05, 0.011, 0.021, 0, 0.004), color: '#fff', tint: 1 },
    // Cauda: dois segmentos que afinam para trás.
    { geo: box(0.03, 0.008, 0.015, -0.038, 0.004), color: '#fff', tint: 1 },
    { geo: box(0.026, 0.006, 0.009, -0.066, 0.004), color: '#fff', tint: 1 },
    { geo: box(0.03, 0.007, 0.012, 0.037, 0.004), color: '#fff', tint: 1 },
    { geo: box(0.014, 0.006, 0.014, 0.027, 0.011), color: '#fff', tint: 1 },
    ...[0.007, -0.007].map((z) => ({ geo: box(0.004, 0.004, 0.004, 0.027, 0.016, z), color: '#e8d890' })),
    // Escudos do dorso: fileira de cubinhos escuros.
    ...[-0.022, -0.012, -0.002, 0.008, 0.018].map((x) => ({ geo: box(0.006, 0.004, 0.009, x, 0.015), color: '#3a4a32' })),
  ];
  // Patas curtas e abertas.
  for (const [x, z] of [[0.016, 0.014], [0.016, -0.014], [-0.014, 0.014], [-0.014, -0.014]]) parts.push({ geo: box(0.01, 0.005, 0.006, x, 0, z), color: '#4a5a3a' });
  return kit(parts);
}

/** Boi de chifres de lira (gado do Egito antigo): o corpo da vaca com chifres que sobem e se fecham. A cor da instância tinge o couro. */
export function oxGeometry(): THREE.BufferGeometry {
  const leg = (x: number, z: number) => ({ geo: box(0.006, 0.022, 0.006, x, 0, z), color: '#3a3230' });
  const horn = (s: number): Part[] => [
    { geo: cone(0.003, 0.02, 4).rotateX(-s * 0.7).translate(0.036, 0.04, s * 0.008), color: '#e8dcc0' },
    { geo: cone(0.002, 0.016, 4).rotateX(s * 0.35).translate(0.036, 0.057, s * 0.02), color: '#e8dcc0' },
  ];
  return kit([
    { geo: box(0.054, 0.027, 0.024, 0, 0.022), color: '#fff', tint: 1 },
    { geo: box(0.018, 0.018, 0.016, 0.034, 0.03), color: '#fff', tint: 1 },
    { geo: box(0.006, 0.006, 0.016, 0.044, 0.028), color: '#2a2220' },
    ...horn(1),
    ...horn(-1),
    { geo: box(0.004, 0.018, 0.003, -0.028, 0.024), color: '#3a3230' },
    leg(0.019, 0.008), leg(0.019, -0.008), leg(-0.019, 0.008), leg(-0.019, -0.008),
  ]);
}

// ---------------------------------------------------------------- easter eggs

/** Esfinge deitada (cor da arenito pela instância), sobre um soco de pedra; olha para +x. */
export function sphinxGeometry(): THREE.BufferGeometry {
  return kit([
    { geo: box(0.1, 0.008, 0.05), color: '#a89a78', grad: [0.85, 1, 0, 0.008] },
    { geo: box(0.074, 0.026, 0.03, -0.004, 0.008), color: '#fff', tint: 1, grad: [0.9, 1.05, 0.008, 0.034] },
    // Patas dianteiras estendidas e a garupa.
    ...[0.011, -0.011].map((z) => ({ geo: box(0.036, 0.012, 0.009, 0.044, 0.008, z), color: '#fff', tint: 1 })),
    { geo: box(0.026, 0.034, 0.028, -0.026, 0.008), color: '#fff', tint: 1 },
    // Peito, cabeça com o toucado (nemes em listras de lápis-lazúli) e a barba.
    { geo: box(0.016, 0.034, 0.022, 0.022, 0.008), color: '#fff', tint: 1 },
    { geo: box(0.02, 0.022, 0.02, 0.026, 0.04), color: '#fff', tint: 1 },
    { geo: box(0.024, 0.016, 0.03, 0.022, 0.044), color: '#2a4b8d' },
    { geo: box(0.004, 0.012, 0.01, 0.038, 0.034), color: '#d8c48a' },
  ]);
}

/** Gato sagrado (Bastet): silhueta preta sentada, olhos dourados que brilham. */
export function catGeometry(): THREE.BufferGeometry {
  const fur = '#1c1819';
  return kit([
    { geo: new THREE.IcosahedronGeometry(0.0095, 0).scale(0.9, 1.35, 0.9).translate(0, 0.0125, 0), color: fur },
    { geo: new THREE.IcosahedronGeometry(0.0062, 0).translate(0.002, 0.03, 0), color: fur },
    ...[0.0035, -0.0035].map((z) => ({ geo: cone(0.0022, 0.0055, 3).translate(0.002, 0.0335, z * 1.0), color: fur })),
    ...[0.0022, -0.0022].map((z) => ({ geo: box(0.0012, 0.0012, 0.0016, 0.0078, 0.0305, z), color: '#e8b830', glow: 0.7 })),
    // Cauda curva em volta do corpo.
    { geo: new THREE.TorusGeometry(0.008, 0.0016, 3, 8, Math.PI * 1.2).rotateX(Math.PI / 2).translate(-0.002, 0.0016, 0), color: fur },
  ]);
}

/** Pirâmide pequena de calcário, com o piramídio dourado que brilha; a cor da instância tinge a pedra. */
export function miniPyramidGeometry(): THREE.BufferGeometry {
  const w = 0.17, h = 0.12;
  return kit([
    { geo: pyramid(w, h, w, 0), color: '#fff', tint: 1, grad: [0.85, 1.12, 0, h], bands: { ys: [0.03, 0.06, 0.09], f: [0.92, 1, 0.95, 1.04] } },
    { geo: pyramid(0.026, 0.026, 0.026, h - 0.02), color: '#e8c24a', glow: 0.8 },
  ]);
}
