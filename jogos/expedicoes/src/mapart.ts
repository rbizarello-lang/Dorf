// O mapa da província desenhado a tinta num canvas: pergaminho, costa, serras, brejo, rios, rotas pontilhadas e terra incógnita.
import * as THREE from 'three';
import { canvas, tex } from './tex';
import { mulberry32 } from './rng';
import type { V2 } from './structs';
import { curve } from './common';

export const MAP_W = 20, MAP_D = 13;
export const POS = { capital: [-0.4, 0.2] as V2, brejo: [-5.7, 2.2] as V2, serra: [4.8, -2.6] as V2, costa: [6.2, 2.5] as V2 };
/** Rotas que ligam a capital aos postos (mundo do mapa). */
export const ROUTES: Record<'brejo' | 'serra' | 'costa', V2[]> = {
  brejo: curve([[-1.7, 0.9], [-2.8, 1.6], [-3.8, 1.3], [-4.6, 2.2], [-4.5, 2.6]], 6),
  serra: curve([[0.9, -0.6], [1.9, -1.5], [2.7, -1.2], [3.5, -2.2], [3.6, -2.5]], 6),
  costa: curve([[0.7, 1.4], [2.0, 2.4], [3.4, 2.1], [4.6, 3.0], [5.0, 2.8]], 6),
};
const SEA_X = (z: number): number => 8.4 + 0.5 * Math.sin(z * 1.1) + 0.3 * Math.sin(z * 2.7);
export const KNOWN = { rx: 7.9, rz: 4.7 };
const knownR = (th: number): number => 1 + 0.045 * Math.sin(3 * th + 1) + 0.035 * Math.sin(5 * th + 2) + 0.02 * Math.sin(9 * th);

const FONT = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif';
export const SCRIPT = '"Snell Roundhand","Segoe Script","Apple Chancery","URW Chancery L","Z003","Lucida Handwriting","Brush Script MT",cursive';

let cached: THREE.CanvasTexture | null = null;
export function mapTexture(): THREE.CanvasTexture {
  if (cached) return cached;
  const PX = 110; // pixels por unidade do mundo
  const W = MAP_W * PX, H = MAP_D * PX;
  const [c, g] = canvas(W, H);
  const r = mulberry32(99);
  const X = (x: number): number => (x + MAP_W / 2) * PX, Z = (z: number): number => (z + MAP_D / 2) * PX;
  const INK = '#3c2814', INK2 = 'rgba(60,40,20,0.55)';

  // pergaminho
  g.fillStyle = '#e8d7a8'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = r() * H, rad = 40 + r() * 160;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.6;
    gr.addColorStop(0, dark ? `rgba(150,110,50,${0.04 + r() * 0.07})` : `rgba(255,244,210,${0.05 + r() * 0.08})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // mar a leste
  g.save();
  g.beginPath(); g.moveTo(X(SEA_X(-6.5)), 0);
  for (let z = -6.5; z <= 6.5; z += 0.2) g.lineTo(X(SEA_X(z)), Z(z));
  g.lineTo(W, H); g.lineTo(W, 0); g.closePath();
  g.fillStyle = 'rgba(96,140,150,0.34)'; g.fill();
  g.clip();
  g.strokeStyle = 'rgba(40,80,95,0.42)'; g.lineWidth = 2;
  for (let k = 0; k < 150; k++) {
    const x = X(8.4) + r() * (W - X(8.4)), y = r() * H, l = 18 + r() * 34;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 7, x + l, y); g.stroke();
  }
  g.restore();
  g.beginPath();
  for (let z = -6.5; z <= 6.5; z += 0.1) { const x = X(SEA_X(z)), y = Z(z); if (z === -6.5) g.moveTo(x, y); else g.lineTo(x, y); }
  g.strokeStyle = INK; g.lineWidth = 3.5; g.stroke();
  g.strokeStyle = INK2; g.lineWidth = 1.5; g.translate(14, 0); g.stroke(); g.translate(-14, 0);

  // lavagens de cor: brejo (verde), serra (cinza-azul), campos da capital (ocre)
  const wash = (cx: number, cz: number, rx: number, rz: number, col: string): void => {
    const gr = g.createRadialGradient(X(cx), Z(cz), 0, X(cx), Z(cz), rx * PX);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(X(cx), Z(cz)); g.scale(1, rz / rx); g.translate(-X(cx), -Z(cz));
    g.fillStyle = gr; g.fillRect(X(cx) - rx * PX, Z(cz) - rx * PX, rx * 2 * PX, rx * 2 * PX); g.restore();
  };
  wash(POS.brejo[0], POS.brejo[1], 4.0, 3.0, 'rgba(110,140,80,0.45)');
  wash(POS.serra[0] + 0.5, POS.serra[1] - 0.5, 4.4, 3.2, 'rgba(120,130,150,0.42)');
  wash(0, 0, 4.2, 3.2, 'rgba(190,160,70,0.28)');
  wash(POS.costa[0] - 1, POS.costa[1], 3, 2.6, 'rgba(210,190,130,0.35)');

  // rios: da serra à capital e ao mar
  const river = curve([[3.6, -5.0], [2.6, -3.6], [1.2, -2.0], [-0.6, -1.4], [-1.4, -0.2], [-0.6, 1.8], [0.8, 3.0], [2.6, 3.8], [4.6, 4.2], [7.0, 4.6], [8.6, 4.8]], 8);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [w, col] of [[7, 'rgba(70,115,130,0.42)'], [3.4, 'rgba(60,100,120,0.8)']] as [number, string][]) { g.beginPath(); river.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.strokeStyle = col; g.lineWidth = w; g.stroke(); }
  g.restore();

  // símbolos
  const peak = (x: number, z: number, s: number): void => {
    const px = X(x), py = Z(z), w = 26 * s, h = 34 * s;
    g.fillStyle = 'rgba(214,206,190,0.9)'; g.strokeStyle = INK; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(px - w, py); g.lineTo(px - w * 0.15, py - h); g.lineTo(px + w * 0.35, py - h * 0.55); g.lineTo(px + w * 0.6, py - h * 0.75); g.lineTo(px + w, py); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(70,70,90,0.35)'; g.beginPath(); g.moveTo(px - w * 0.15, py - h); g.lineTo(px + w * 0.35, py - h * 0.55); g.lineTo(px + w * 0.6, py - h * 0.75); g.lineTo(px + w, py); g.lineTo(px + w * 0.1, py); g.closePath(); g.fill();
    g.strokeStyle = INK2; g.lineWidth = 1;
    for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(px + w * (0.1 + k * 0.14), py - h * 0.1); g.lineTo(px + w * (0.2 + k * 0.1), py - h * (0.3 + k * 0.06)); g.stroke(); }
  };
  const tree = (x: number, z: number, s = 1): void => {
    const px = X(x), py = Z(z);
    g.strokeStyle = INK; g.fillStyle = 'rgba(90,120,60,0.55)'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(px, py - 17 * s); g.lineTo(px - 8 * s, py); g.lineTo(px + 8 * s, py); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + 5 * s); g.stroke();
  };
  const reedG = (x: number, z: number): void => {
    const px = X(x), py = Z(z);
    g.strokeStyle = 'rgba(40,70,40,0.85)'; g.lineWidth = 1.5;
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(px + k * 5, py); g.lineTo(px + k * 8, py - 15); g.stroke(); }
    g.strokeStyle = 'rgba(60,40,20,0.7)'; g.beginPath(); g.moveTo(px - 12, py + 3); g.lineTo(px + 12, py + 3); g.stroke();
  };
  // serra
  for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = 0.4 + Math.sqrt(r()) * 3.0; const x = POS.serra[0] + 0.5 + Math.cos(a) * d * 1.2, z = POS.serra[1] - 0.8 + Math.sin(a) * d * 0.75; if (Math.hypot(x - POS.serra[0], z - POS.serra[1]) > 1.9 && z < -0.6 && Math.abs(x) < 8 && Math.abs(z) < 4.6) peak(x, z, 0.7 + r() * 0.7); }
  // florestas ao redor da capital e da serra
  for (let i = 0; i < 90; i++) { const a = r() * 6.28, d = 2.8 + r() * 4.2; const x = Math.cos(a) * d * 1.45, z = Math.sin(a) * d * 0.85; if (Math.abs(x) < 7.4 && Math.abs(z) < 4.3 && x < SEA_X(z) - 0.5 && Object.values(POS).every((p) => Math.hypot(p[0] - x, p[1] - z) > 2.1) && (z > -2.8 || x < 3)) tree(x, z, 0.7 + r() * 0.5); }
  // brejo
  for (let i = 0; i < 18; i++) { const a = r() * 6.28, d = 1.9 + r() * 1.6; const x = POS.brejo[0] + Math.cos(a) * d * 1.2, z = POS.brejo[1] + Math.sin(a) * d * 0.8; if (x > -7.4 && z < 4.4) reedG(x, z); }
  g.fillStyle = 'rgba(70,110,110,0.45)';
  for (const [x, z, rx, rz] of [[-7.0, 0.5, 0.7, 0.3], [-4.0, 4.0, 0.8, 0.35], [-6.7, 4.0, 0.5, 0.25]] as number[][]) { g.beginPath(); g.ellipse(X(x), Z(z), rx * PX, rz * PX, 0.3, 0, 7); g.fill(); g.strokeStyle = INK2; g.lineWidth = 1.3; g.stroke(); }

  // pequenos barcos no mar
  const ship = (x: number, z: number): void => {
    const px = X(x), py = Z(z);
    g.strokeStyle = INK; g.fillStyle = 'rgba(236,224,190,0.9)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(px - 14, py); g.lineTo(px + 14, py); g.lineTo(px + 8, py + 8); g.lineTo(px - 9, py + 8); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - 30); g.stroke();
    g.beginPath(); g.moveTo(px + 1, py - 29); g.lineTo(px + 16, py - 8); g.lineTo(px + 1, py - 8); g.closePath(); g.fill(); g.stroke();
  };
  ship(9.0, -1.2); ship(8.9, 4.6);

  // rotas pontilhadas a tinta
  g.save(); g.lineCap = 'round';
  for (const k of ['brejo', 'serra', 'costa'] as const) {
    const pts = ROUTES[k];
    g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.strokeStyle = 'rgba(120,36,20,0.9)'; g.lineWidth = 4.5; g.setLineDash([2, 13]); g.stroke();
  }
  // rotas para o desconhecido, que somem na bruma
  g.setLineDash([2, 15]); g.lineWidth = 3.4;
  for (const pts of [curve([[-1.7, -0.6], [-3.4, -1.8], [-5.2, -3.2], [-6.6, -4.4]], 6), curve([[0.5, 1.8], [0.9, 3.2], [1.6, 4.6], [2.0, 5.8]], 6), curve([[-3.8, 1.4], [-6.4, 0.0], [-8.2, -1.0], [-9.4, -1.4]], 6)]) {
    g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.strokeStyle = 'rgba(120,36,20,0.55)'; g.stroke();
  }
  g.restore();

  // terra incógnita: o que está fora do contorno conhecido escurece em tinta e névoa
  const [u, ug] = canvas(W, H);
  ug.fillStyle = '#6b563f'; ug.fillRect(0, 0, W, H);
  for (let i = 0; i < 400; i++) {
    const x = r() * W, y = r() * H, rad = 30 + r() * 120;
    const gr = ug.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, r() < 0.5 ? 'rgba(30,20,12,0.16)' : 'rgba(170,150,120,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ug.fillStyle = gr; ug.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // rabiscos de tinta (hachuras)
  ug.strokeStyle = 'rgba(30,20,10,0.35)'; ug.lineWidth = 1.4;
  for (let i = 0; i < 1500; i++) { const x = r() * W, y = r() * H; ug.beginPath(); ug.moveTo(x, y); ug.lineTo(x + 18, y - 18); ug.stroke(); }
  ug.globalCompositeOperation = 'destination-out';
  ug.filter = 'blur(26px)';
  ug.beginPath();
  for (let i = 0; i <= 180; i++) { const th = (i / 180) * 6.2832, rr = knownR(th); const x = X(Math.cos(th) * KNOWN.rx * rr), y = Z(Math.sin(th) * KNOWN.rz * rr); if (i) ug.lineTo(x, y); else ug.moveTo(x, y); }
  ug.closePath(); ug.fillStyle = '#000'; ug.fill();
  ug.filter = 'none';
  g.globalAlpha = 0.93; g.drawImage(u, 0, 0); g.globalAlpha = 1;
  // contorno tracejado do conhecido
  g.save(); g.setLineDash([10, 9]); g.strokeStyle = 'rgba(40,26,12,0.45)'; g.lineWidth = 2.2;
  g.beginPath();
  for (let i = 0; i <= 180; i++) { const th = (i / 180) * 6.2832, rr = knownR(th); const x = X(Math.cos(th) * KNOWN.rx * rr * 1.03), y = Z(Math.sin(th) * KNOWN.rz * rr * 1.03); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  g.closePath(); g.stroke(); g.restore();

  // letras
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const label = (t: string, x: number, z: number, px: number, col = INK, ls = 0, italic = true): void => {
    g.font = `${italic ? 'italic ' : ''}600 ${px}px ${FONT}`;
    (g as unknown as { letterSpacing: string }).letterSpacing = `${ls}px`;
    g.fillStyle = 'rgba(255,244,214,0.55)'; g.fillText(t, X(x) + 1.5, Z(z) + 1.5);
    g.fillStyle = col; g.fillText(t, X(x), Z(z));
    (g as unknown as { letterSpacing: string }).letterSpacing = '0px';
  };
  label('Brejo das Garças', POS.brejo[0], POS.brejo[1] + 2.0, 34);
  label('Serra Alva', POS.serra[0] + 0.1, POS.serra[1] - 2.0, 34);
  label('Costa do Lume', POS.costa[0] + 0.3, POS.costa[1] + 2.0, 34);
  label('ALVORADA', POS.capital[0], POS.capital[1] + 3.15, 40, '#5a1c10', 6, false);
  label('Mar das Lanternas', 9.0, 1.2, 28, 'rgba(30,70,90,0.9)', 2);
  label('T E R R A   I N C Ó G N I T A', 0, -5.65, 30, 'rgba(235,222,190,0.8)', 4, false);
  label('aqui ainda não há caminho', -8.9, 3.6, 24, 'rgba(235,222,190,0.7)');
  label('?', -9.2, -3.6, 70, 'rgba(235,222,190,0.5)');
  label('?', 1.8, 5.8, 60, 'rgba(235,222,190,0.5)');
  label('?', 9.0, -4.8, 60, 'rgba(235,222,190,0.5)');

  // cartucho do título
  g.save(); g.translate(X(-6.0), Z(-5.3));
  g.fillStyle = 'rgba(240,226,184,0.88)'; g.strokeStyle = INK; g.lineWidth = 3;
  g.beginPath(); g.roundRect(-3 * PX / 2 * 1.1, -0.55 * PX, 3.3 * PX, 1.1 * PX, 16); g.fill(); g.stroke();
  g.lineWidth = 1.2; g.beginPath(); g.roundRect(-3 * PX / 2 * 1.1 + 8, -0.55 * PX + 8, 3.3 * PX - 16, 1.1 * PX - 16, 11); g.stroke();
  g.restore();
  label('PROVÍNCIA', -6.0, -5.5, 30, INK, 7, false);
  label('de Alvorada', -6.0, -5.1, 32, '#5a1c10');
  // rosa dos ventos
  g.save(); g.translate(X(8.4), Z(-4.9));
  const R0 = 0.78 * PX;
  g.strokeStyle = INK; g.fillStyle = 'rgba(240,226,184,0.5)'; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, R0 * 0.62, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(0, 0, R0 * 0.5, 0, 7); g.stroke();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, L = k % 2 ? R0 * 0.62 : R0;
    g.beginPath(); g.moveTo(Math.sin(a - 0.2) * R0 * 0.14, -Math.cos(a - 0.2) * R0 * 0.14); g.lineTo(Math.sin(a) * L, -Math.cos(a) * L); g.lineTo(Math.sin(a + 0.2) * R0 * 0.14, -Math.cos(a + 0.2) * R0 * 0.14); g.closePath();
    g.fillStyle = k % 2 ? 'rgba(60,40,20,0.35)' : k === 0 ? '#9a2a18' : INK; g.fill(); g.stroke();
  }
  g.restore();
  label('N', 8.4, -5.95, 30, INK, 0, false);
  // moldura dupla
  g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(22, 22, W - 44, H - 44);
  g.lineWidth = 2; g.strokeRect(36, 36, W - 72, H - 72);
  // escala
  g.save(); g.translate(X(-3.4), Z(5.7)); g.strokeStyle = INK; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(3 * PX, 0); g.stroke();
  for (let k = 0; k <= 3; k++) { g.beginPath(); g.moveTo(k * PX, -7); g.lineTo(k * PX, 7); g.stroke(); }
  g.restore();
  label('três dias de marcha', -1.9, 5.4, 22);
  // bordas manchadas
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(70,40,10,0.55)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);

  cached = tex(c);
  cached.anisotropy = 8;
  return cached;
}
