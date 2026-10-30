// Hexômetro: mede o quanto uma captura "lê hexágono". Fase 1 do plano Terra contínua (docs: AGENTS.md, "Bancada de encaixe").
//
// Uso: node scripts/hexometro.mjs [--json] [--esticar=1.6] [--suave=1.5] [--janela=10] [--topo=0.2] [--base=0.14] <png...>
//
// Como funciona (Node puro; o PNG é decodificado com o zlib do próprio Node, sem dependência):
//   1. tons de cinza, borrados com um gaussiano (σ = --suave px) para o ruído fino de folhas, trigo e telhas não pesar;
//   2. Sobel (gx, gy) e, em cada pixel, a orientação da BORDA (perpendicular ao gradiente, módulo 180°). Os gradientes entram num tensor de
//      estrutura (gaussiano de σ = --janela px) e cada pixel pesa magnitude × coerência: folhas, telhas e casas têm bordas em todas as
//      direções nessa escala (coerência baixa); a costa, o penhasco e a borda do hexágono são retas longas (coerência alta);
//   3. as faixas do HUD ficam de fora: o topo (placar, botões), a base (missões, mapa) e o canto da pilha (peça atual);
//   4. o histograma de orientação h(θ), de 1° em 1° e somando 1, vira uma série de Fourier com período de 180°: c_k = Σ h(θ)·e^(-i·2kθ);
//   5. um hexágono tem bordas a 0°, 60° e 120°: o histograma repete a cada 60° e a energia cai nos harmônicos k = 3, 6, 9, 12.
//
// Nota de hexagonalidade (%): energia dos harmônicos de 60° sobre a energia total do histograma (a parcela constante, 1, entra no
// total). Histograma liso (paisagem sem direção preferida) dá perto de 0; seis picos iguais dão perto de 100. A `nota` usa só os
// harmônicos ímpares (k = 3 e 9): as retas horizontais e verticais (horizonte, casas, HUD) excitam os pares (k = 6 e 12) sem terem
// nada de hexágono. A `bruta` (k = 3, 6, 9, 12) sai ao lado, para comparar com a definição direta.
//
// Calibração com as capturas do plano (esticar 1,6; suave 1,5; janela 10): `nota` média 9,4 nas 9 capturas de antes do relevo
// (integra-3b), 7,0 nas 6 do relevo R6 e 4,8 nas 5 do relevo com o hexágono escondido (X2). Nos 4 pares de mesma vista (holanda e oriental,
// de perto e de longe) a nota cai do R6 para o X2 em todos. Com a janela entre 7 e 20 px a ordem dos grupos se mantém; sem a janela (Sobel
// puro, pixel a pixel) as folhas e as casas pesam tanto que o R6 e o X2 empatam. Âncoras sintéticas (imagem 1200×720 só de linhas): grade
// hexagonal 33 a 38 (mesma nota com a grade girada 31°, e a inclinada só dá isso com o `--esticar` certo: sem ele, 12), manchas orgânicas
// 0,2 a 0,7. Os números absolutos das capturas dependem da câmera e do tema: compare capturas da mesma vista, não valores soltos.
//
// Armadilha: a câmera do jogo é inclinada (32° de perto a 50° de longe), então a perspectiva achata o eixo vertical e as bordas do
// hexágono não caem em 0°, 60° e 120° na tela. `--esticar=f` desfaz o achatamento (divide o gradiente vertical por f = 1/sen da
// inclinação, de 1,3 a 1,9) antes de medir. Procurar o melhor f por captura NÃO serve: f grande empurra todas as bordas para
// perto da horizontal e infla a nota de qualquer imagem. O que vale é comparar capturas da mesma câmera com o mesmo f.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// ---------------------------------------------------------------- PNG

/** Decodifica um PNG de 8 bits, sem entrelaçamento (cinza, cinza+alfa, RGB, RGBA, paleta). Devolve { w, h, rgb } (RGB, 3 bytes por pixel). */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('não é PNG');
  let off = 8;
  let w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  let plte = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      ctype = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') plte = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8) throw new Error(`PNG de ${depth} bits não suportado`);
  if (interlace) throw new Error('PNG entrelaçado não suportado');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!ch) throw new Error(`tipo de cor ${ctype} não suportado`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(stride * h);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[dst + x - ch] : 0;
      const b = y > 0 ? px[dst - stride + x] : 0;
      const c = x >= ch && y > 0 ? px[dst - stride + x - ch] : 0;
      const v = raw[src + x];
      px[dst + x] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 255;
    }
  }
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    if (ctype === 0 || ctype === 4) rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = px[i * ch];
    else if (ctype === 3) {
      const k = px[i] * 3;
      rgb[i * 3] = plte[k];
      rgb[i * 3 + 1] = plte[k + 1];
      rgb[i * 3 + 2] = plte[k + 2];
    } else {
      rgb[i * 3] = px[i * ch];
      rgb[i * 3 + 1] = px[i * ch + 1];
      rgb[i * 3 + 2] = px[i * ch + 2];
    }
  }
  return { w, h, rgb };
}

// ---------------------------------------------------------------- medida

/** Borrão gaussiano separável (σ em pixels; 0 = nada). */
function blur(src, w, h, sigma) {
  if (!(sigma > 0)) return src;
  const rad = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * rad + 1);
  let sum = 0;
  for (let i = -rad; i <= rad; i++) sum += k[i + rad] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -rad; i <= rad; i++) a += k[i + rad] * src[y * w + Math.min(w - 1, Math.max(0, x + i))];
      tmp[y * w + x] = a;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -rad; i <= rad; i++) a += k[i + rad] * tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x];
      out[y * w + x] = a;
    }
  }
  return out;
}

export const DEFAULTS = {
  /** Fração do alto e da base cobertas pelo HUD (placar e botões; missões e botão do mapa). */
  topo: 0.2,
  base: 0.14,
  /** Canto inferior direito (peça atual e contador da pilha): largura e altura da faixa, em fração da imagem. */
  canto: [0.17, 0.35],
  /** Borrão (px) antes do Sobel. */
  suave: 1.5,
  /** Fator que desfaz o achatamento vertical da perspectiva: 1 / sen(inclinação). A câmera do jogo fica entre 32° (de perto) e 50° (de longe), então 1,3 a 1,9; 1,6 é o zoom inicial (38°). */
  esticar: 1.6,
  /** Janela (σ em px) do tensor de estrutura; 0 = Sobel puro, pixel a pixel. */
  janela: 10,
  /** Expoente da coerência no peso (só com `janela`). */
  coer: 1,
};

/** Harmônicos do histograma (k = 1..KMAX, período de 180°/k): os de 60° são os múltiplos de 3. */
const KMAX = 12;
const BINS = 180;

/**
 * Sobel sobre a região útil, com o eixo vertical dividido por `esticar`. Devolve gx e gy (zerados no HUD) e a máscara dos pixels medidos.
 * Com `janela` > 0, agrupa os gradientes num tensor de estrutura (gaussiano de σ = janela px): o peso de cada pixel passa a
 * ser a magnitude × coerência^`coer`, e a orientação a do tensor. Folhas, telhas e casas têm orientações aleatórias nessa escala
 * (coerência baixa); a costa, o penhasco e a borda do hexágono são retas longas (coerência alta).
 */
function gradients({ w, h, rgb }, o) {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2];
  const g = blur(gray, w, h, o.suave);
  const y0 = Math.max(1, Math.floor(h * o.topo));
  const y1 = Math.min(h - 1, Math.ceil(h * (1 - o.base)));
  const cx = Math.floor(w * (1 - o.canto[0]));
  const cy = Math.floor(h * (1 - o.canto[1]));
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  const use = new Uint8Array(w * h);
  for (let y = y0; y < y1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (x >= cx && y >= cy) continue;
      const a = g[(y - 1) * w + x - 1], b = g[(y - 1) * w + x], c = g[(y - 1) * w + x + 1];
      const d = g[y * w + x - 1], f = g[y * w + x + 1];
      const e = g[(y + 1) * w + x - 1], i = g[(y + 1) * w + x], j = g[(y + 1) * w + x + 1];
      gx[y * w + x] = c + 2 * f + j - (a + 2 * d + e);
      gy[y * w + x] = (e + 2 * i + j - (a + 2 * b + c)) / o.esticar;
      use[y * w + x] = 1;
    }
  }
  if (!(o.janela > 0)) return { gx, gy, use, w, h, tensor: null };
  const jxx = new Float32Array(w * h), jyy = new Float32Array(w * h), jxy = new Float32Array(w * h);
  for (let n = 0; n < w * h; n++) {
    jxx[n] = gx[n] * gx[n];
    jyy[n] = gy[n] * gy[n];
    jxy[n] = gx[n] * gy[n];
  }
  return { gx, gy, use, w, h, tensor: [blur(jxx, w, h, o.janela), blur(jyy, w, h, o.janela), blur(jxy, w, h, o.janela)] };
}

/** Histograma (180 bins de 1°, soma 1) da orientação das bordas, ponderado pela magnitude. */
function histogram({ gx, gy, use, w, h, tensor }, o) {
  const hist = new Float64Array(BINS);
  let total = 0;
  const add = (angle, weight) => {
    // Orientação da borda = perpendicular ao gradiente, módulo 180°.
    let deg = ((angle * 180) / Math.PI + 90) % 180;
    if (deg < 0) deg += 180;
    hist[Math.min(BINS - 1, Math.floor(deg))] += weight;
    total += weight;
  };
  for (let n = 0; n < w * h; n++) {
    if (!use[n]) continue;
    if (!tensor) {
      const m = Math.hypot(gx[n], gy[n]);
      if (m > 0) add(Math.atan2(gy[n], gx[n]), m);
      continue;
    }
    const xx = tensor[0][n], yy = tensor[1][n], xy = tensor[2][n];
    const tr = xx + yy;
    if (tr <= 1e-6) continue;
    const coh = Math.hypot(xx - yy, 2 * xy) / tr;
    add(0.5 * Math.atan2(2 * xy, xx - yy), Math.sqrt(tr) * coh ** o.coer);
  }
  if (total > 0) for (let b = 0; b < BINS; b++) hist[b] /= total;
  return { hist, total };
}

/** Amplitudes |c_k| (k = 1..KMAX) da série de Fourier do histograma, com período de 180°. */
function spectrum(hist) {
  const c = [];
  for (let k = 1; k <= KMAX; k++) {
    let re = 0, im = 0;
    for (let b = 0; b < BINS; b++) {
      const t = ((b + 0.5) * Math.PI) / BINS;
      re += hist[b] * Math.cos(2 * k * t);
      im += hist[b] * Math.sin(2 * k * t);
    }
    c.push(Math.hypot(re, im));
  }
  return c;
}

/** Energia de um conjunto de harmônicos sobre a energia total (a parcela constante, que vale 1, entra no total), em %. */
function ratio(c, ks) {
  let part = 0, all = 1;
  for (let k = 1; k <= KMAX; k++) {
    all += c[k - 1] ** 2;
    if (ks.includes(k)) part += c[k - 1] ** 2;
  }
  return (100 * part) / all;
}

/**
 * Nota de hexagonalidade de uma imagem RGB. Devolve:
 *   nota   energia dos harmônicos de 60° ÍMPARES (k = 3 e 9) sobre a energia total, em %. Os pares (k = 6 e 12) também são
 *          harmônicos de 60°, mas um par de retas horizontal e vertical (horizonte, paredes e janelas das casas, o HUD) já os
 *          excita, então ficam de fora da nota;
 *   bruta  a mesma razão com os quatro harmônicos de 60° (k = 3, 6, 9, 12), para comparar com a definição direta;
 *   h      o histograma de 180 bins (soma 1);
 *   c      as amplitudes |c_k| (k = 1..12).
 */
export function hexScore(img, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const grad = gradients(img, o);
  const { hist, total } = histogram(grad, o);
  if (total === 0) return { nota: 0, bruta: 0, h: Array.from(hist), c: [] };
  const c = spectrum(hist);
  return { nota: ratio(c, [3, 9]), bruta: ratio(c, [3, 6, 9, 12]), h: Array.from(hist), c };
}

// ---------------------------------------------------------------- linha de comando

function main(argv) {
  const opts = {};
  const files = [];
  let json = false;
  for (const a of argv) {
    if (a === '--json') json = true;
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (!(k in DEFAULTS) || v === undefined || !Number.isFinite(Number(v))) throw new Error(`opção inválida: ${a}`);
      opts[k] = Number(v);
    } else files.push(a);
  }
  if (!files.length) {
    console.error('uso: node scripts/hexometro.mjs [--json] [--esticar=1.6] [--suave=1.5] [--janela=10] [--topo=0.2] [--base=0.14] <png...>');
    process.exit(2);
  }
  const rows = files.map((f) => {
    const r = hexScore(decodePng(readFileSync(f)), opts);
    return { arquivo: f, nota: r.nota, bruta: r.bruta };
  });
  if (json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  const width = Math.max(...rows.map((r) => r.arquivo.length));
  console.log(`${'arquivo'.padEnd(width)}   nota  bruta`);
  for (const r of rows) console.log(`${r.arquivo.padEnd(width)}  ${r.nota.toFixed(3).padStart(6)}  ${r.bruta.toFixed(3).padStart(5)}`);
  const mean = rows.reduce((a, r) => a + r.nota, 0) / rows.length;
  console.log(`${'média'.padEnd(width)}  ${mean.toFixed(3).padStart(6)}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main(process.argv.slice(2));
