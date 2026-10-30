// O pergaminho: um mapa antigo desenhado a tinta num canvas (papel envelhecido, contornos irregulares das regiões,
// letras de mapa, hachuras de montanha, rosa dos ventos, mar com ondas) e usado como textura da mesa.
// As regiões fundadas ficam por baixo do diorama 3D; as vazias aparecem só em tinta, e o rio e a estrada continuam
// em traço a tinta onde a região ainda não foi fundada.
import * as THREE from 'three';
import { CELL_REGION, DIRS, REGIONS, SHEET, Pt, Region, Resolved, Week, ckey, hash2, noise2, rng } from '../data';

const PI = Math.PI;
const INK = 'rgba(56,36,20,';
const INK_BLUE = 'rgba(46,92,116,';
const INK_RED = 'rgba(122,62,34,';

export interface ParchmentOpts { week: Week; founded: Set<string>; rivers: Resolved[]; roads: Resolved[]; W?: number; }

const WASH: Record<string, string> = {
  trigo: '214,190,110', foz: '150,190,140', moinhos: '190,200,120', serra: '170,150,130', bosque: '120,160,100', charneca: '176,160,130',
  pedregal: '168,152,134', marisma: '140,170,120', dunas: '230,200,120', campina: '178,200,120', lago: '130,180,190', mata: '100,150,95', capital: '220,200,150',
};

export function drawParchment(o: ParchmentOpts): THREE.CanvasTexture {
  const W = o.W ?? 4096;
  const H = Math.round(W * SHEET.d / SHEET.w);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const sc = W / SHEET.w; // pixels por unidade do mundo
  const px = (x: number): number => (x - (SHEET.cx - SHEET.w / 2)) * sc;
  const pz = (z: number): number => (z - (SHEET.cz - SHEET.d / 2)) * sc;
  const r = rng(1234);

  // ---------- papel ----------
  const base = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.62);
  base.addColorStop(0, '#ecdcb0'); base.addColorStop(0.65, '#e0c993'); base.addColorStop(1, '#b8935a');
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  // manchas largas
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H, rad = 60 + r() * 380;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.6;
    g.addColorStop(0, dark ? 'rgba(120,80,30,0.10)' : 'rgba(255,240,200,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // fibras
  ctx.lineWidth = 1;
  for (let i = 0; i < 9000; i++) {
    const x = r() * W, y = r() * H, a = r() * PI, l = 6 + r() * 26;
    ctx.strokeStyle = r() < 0.5 ? 'rgba(110,80,40,0.06)' : 'rgba(255,248,225,0.07)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  // dobras do papel
  ctx.strokeStyle = 'rgba(90,60,30,0.10)'; ctx.lineWidth = 3;
  for (const f of [0.33, 0.66]) { ctx.beginPath(); ctx.moveTo(W * f, 0); ctx.lineTo(W * f, H); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, H * 0.5); ctx.lineTo(W, H * 0.5); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,245,215,0.12)'; ctx.lineWidth = 2;
  for (const f of [0.33, 0.66]) { ctx.beginPath(); ctx.moveTo(W * f + 3, 0); ctx.lineTo(W * f + 3, H); ctx.stroke(); }

  // ---------- geometria das células ----------
  const hexPath = (x: number, z: number, R: number): void => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * PI / 3; const X = px(x + Math.cos(a) * R), Z = pz(z + Math.sin(a) * R); if (k) ctx.lineTo(X, Z); else ctx.moveTo(X, Z); }
    ctx.closePath();
  };
  const cellXY = (q: number, rr: number): Pt => [1.5 * q, 0.8660254 * q + 1.7320508 * rr];
  const isLand = (q: number, rr: number): boolean => CELL_REGION.has(ckey(q, rr));
  // deslocamento por posição (igual nos dois lados de uma aresta): contornos irregulares sem rachaduras
  const jig = (x: number, z: number, amp: number): Pt => [(noise2(x * 1.7, z * 1.7, 31) - 0.5) * amp, (noise2(x * 1.7 + 50, z * 1.7 + 20, 32) - 0.5) * amp];

  // ---------- mar: lavado azul-acinzentado fora da terra ----------
  const sea = document.createElement('canvas'); sea.width = W; sea.height = H;
  const sx = sea.getContext('2d')!;
  sx.fillStyle = 'rgba(86,132,150,0.33)'; sx.fillRect(0, 0, W, H);
  sx.globalCompositeOperation = 'destination-out';
  sx.fillStyle = '#000';
  for (const g of REGIONS) for (const [q, rr] of g.cells) {
    const [x, z] = cellXY(q, rr);
    sx.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * PI / 3; const X = px(x + Math.cos(a) * 1.05), Z = pz(z + Math.sin(a) * 1.05); if (k) sx.lineTo(X, Z); else sx.moveTo(X, Z); }
    sx.closePath(); sx.fill();
  }
  sx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.filter = 'blur(6px)'; ctx.drawImage(sea, 0, 0); ctx.restore();
  // mar mais escuro perto das bordas da folha
  const edge = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, W * 0.6);
  edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(60,80,92,0.28)');
  ctx.fillStyle = edge; ctx.fillRect(0, 0, W, H);

  // ondas do mar: pequenos "s" espalhados fora da terra
  ctx.strokeStyle = INK_BLUE + '0.38)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let i = 0; i < 1500; i++) {
    const x = SHEET.cx - SHEET.w / 2 + 1.2 + r() * (SHEET.w - 2.4), z = SHEET.cz - SHEET.d / 2 + 1.2 + r() * (SHEET.d - 2.4);
    const [q, rr] = worldCell(x, z);
    let near = false;
    for (const [dq, dr] of [[0, 0], ...DIRS] as Array<[number, number]>) if (isLand(q + dq, rr + dr)) near = true;
    if (near) continue;
    const X = px(x), Z = pz(z), L = 16 + r() * 16;
    ctx.beginPath(); ctx.moveTo(X - L, Z); ctx.quadraticCurveTo(X - L / 2, Z - 9, X, Z); ctx.quadraticCurveTo(X + L / 2, Z + 9, X + L, Z); ctx.stroke();
  }

  // ---------- regiões ----------
  for (const g of REGIONS) {
    const found = o.founded.has(g.id);
    // lavado de cor da região vazia
    if (!found) {
      const wc = WASH[g.theme] ?? '200,180,130';
      ctx.fillStyle = `rgba(${wc},0.30)`;
      for (const [q, rr] of g.cells) { const [x, z] = cellXY(q, rr); hexPath(x, z, 1.03); ctx.fill(); }
      // a grade pontilhada dos 19 espaços: "à espera"
      ctx.strokeStyle = INK + '0.20)'; ctx.lineWidth = 1.8; ctx.setLineDash([3, 7]);
      for (const [q, rr] of g.cells) { const [x, z] = cellXY(q, rr); hexPath(x, z, 0.93); ctx.stroke(); }
      ctx.setLineDash([]);
    } else {
      // sombra de contato do diorama sobre o papel
      ctx.save(); ctx.shadowColor = 'rgba(40,24,10,0.55)'; ctx.shadowBlur = 38; ctx.fillStyle = 'rgba(40,24,10,0.55)';
      for (const [q, rr] of g.cells) { const [x, z] = cellXY(q, rr); hexPath(x, z, 1.0); ctx.fill(); }
      ctx.restore();
    }
  }

  // contornos: arestas entre regiões (tracejado) e costa (traço cheio + linhas d'água)
  const edgePoints = (x: number, z: number, k: number): [Pt, Pt] => {
    const a0 = k * PI / 3, a1 = (k + 1) * PI / 3;
    return [[x + Math.cos(a0), z + Math.sin(a0)], [x + Math.cos(a1), z + Math.sin(a1)]];
  };
  const wobbly = (p0: Pt, p1: Pt, amp: number): Pt[] => {
    const out: Pt[] = [];
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = p0[0] + (p1[0] - p0[0]) * t, z = p0[1] + (p1[1] - p0[1]) * t;
      const j = jig(x, z, amp);
      out.push([x + j[0], z + j[1]]);
    }
    return out;
  };
  const strokeLine = (pts: Pt[]): void => { ctx.beginPath(); pts.forEach((p, i) => { const X = px(p[0]), Z = pz(p[1]); if (i) ctx.lineTo(X, Z); else ctx.moveTo(X, Z); }); ctx.stroke(); };
  const coastRings: Array<{ pts: Pt[]; normal: Pt }> = [];
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const g of REGIONS) for (const [q, rr] of g.cells) {
    const [x, z] = cellXY(q, rr);
    for (let k = 0; k < 6; k++) {
      const nb = CELL_REGION.get(ckey(q + DIRS[k][0], rr + DIRS[k][1]));
      const [p0, p1] = edgePoints(x, z, k);
      if (nb === g) continue;
      const line = wobbly(p0, p1, 0.34);
      if (!nb) {
        ctx.strokeStyle = INK + '0.82)'; ctx.lineWidth = 3.4; ctx.setLineDash([]);
        strokeLine(line);
        const a = (30 + 60 * k) * PI / 180;
        coastRings.push({ pts: line, normal: [Math.cos(a), Math.sin(a)] });
      } else {
        // cada aresta é visitada pelos dois lados; desenha só de um (ordem do id)
        if (g.id > nb.id) continue;
        ctx.strokeStyle = INK + '0.62)'; ctx.lineWidth = 3; ctx.setLineDash([22, 7, 3, 7]);
        strokeLine(line);
        ctx.setLineDash([]);
      }
    }
  }
  // linhas d'água paralelas à costa
  ctx.strokeStyle = INK_BLUE + '0.5)'; ctx.lineWidth = 2.4;
  for (const off of [0.16, 0.34]) for (const c of coastRings) {
    const pts = c.pts.map((p): Pt => [p[0] + c.normal[0] * off, p[1] + c.normal[1] * off]);
    ctx.globalAlpha = off < 0.2 ? 0.9 : 0.5;
    strokeLine(pts);
  }
  ctx.globalAlpha = 1;

  // ---------- rabiscos das regiões vazias ----------
  const near = (x: number, z: number): boolean => {
    for (const p of o.rivers) for (const pt of p.pts) if (Math.abs(pt[0] - x) < 0.55 && Math.abs(pt[1] - z) < 0.55) return true;
    for (const p of o.roads) for (const pt of p.pts) if (Math.abs(pt[0] - x) < 0.4 && Math.abs(pt[1] - z) < 0.4) return true;
    return false;
  };
  const ink = (a: number): string => INK + a + ')';
  const mountain = (x: number, z: number, s: number): void => {
    const X = px(x), Z = pz(z), w = 34 * s, h = 36 * s;
    ctx.strokeStyle = ink(0.8); ctx.lineWidth = 2.6;
    ctx.fillStyle = 'rgba(232,218,184,0.9)';
    ctx.beginPath(); ctx.moveTo(X - w, Z + h * 0.35); ctx.lineTo(X - w * 0.1, Z - h); ctx.lineTo(X + w * 0.35, Z - h * 0.3); ctx.lineTo(X + w * 0.6, Z - h * 0.6); ctx.lineTo(X + w * 1.1, Z + h * 0.35); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.8; ctx.strokeStyle = ink(0.6);
    for (let i = 0; i < 6; i++) { const t = i / 6; ctx.beginPath(); ctx.moveTo(X - w * 0.1 + w * 0.05 * i, Z - h * (0.9 - t * 0.85)); ctx.lineTo(X - w * 0.1 + w * 0.5 * (1 - t * 0.2) + w * 0.12 * i * 0, Z - h * 0.3 + h * 0.65 * t); ctx.stroke(); }
  };
  const tree = (x: number, z: number, s: number, fir: boolean): void => {
    const X = px(x), Z = pz(z), w = 13 * s;
    ctx.strokeStyle = ink(0.75); ctx.lineWidth = 2.2;
    ctx.fillStyle = fir ? 'rgba(98,128,80,0.5)' : 'rgba(120,150,84,0.5)';
    ctx.beginPath();
    if (fir) { ctx.moveTo(X, Z - w * 1.9); ctx.lineTo(X + w * 0.9, Z + w * 0.3); ctx.lineTo(X - w * 0.9, Z + w * 0.3); ctx.closePath(); }
    else ctx.arc(X, Z - w * 0.7, w, 0, PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X, Z + w * 0.3); ctx.lineTo(X, Z + w * 1.0); ctx.stroke();
  };
  const hill = (x: number, z: number, s: number): void => {
    const X = px(x), Z = pz(z), w = 28 * s;
    ctx.strokeStyle = ink(0.7); ctx.lineWidth = 2.3;
    ctx.beginPath(); ctx.moveTo(X - w, Z); ctx.quadraticCurveTo(X, Z - w * 1.1, X + w, Z); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = ink(0.4);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(X - w * 0.4 + i * w * 0.3, Z - w * 0.5 + i * 2); ctx.lineTo(X - w * 0.5 + i * w * 0.3, Z - w * 0.1); ctx.stroke(); }
  };
  const reeds = (x: number, z: number): void => {
    const X = px(x), Z = pz(z);
    ctx.strokeStyle = INK_BLUE + '0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X - 18, Z); ctx.lineTo(X + 18, Z); ctx.stroke();
    ctx.strokeStyle = ink(0.6);
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(X + i * 8, Z); ctx.lineTo(X + i * 8 + i * 2, Z - 16); ctx.stroke(); }
  };
  const dune = (x: number, z: number): void => {
    const X = px(x), Z = pz(z);
    ctx.strokeStyle = ink(0.55); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X, Z, 22, PI * 1.1, PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(X + 20, Z + 8, 16, PI * 1.1, PI * 1.9); ctx.stroke();
  };
  const lake = (x: number, z: number): void => {
    const X = px(x), Z = pz(z);
    ctx.fillStyle = 'rgba(110,160,180,0.45)'; ctx.strokeStyle = INK_BLUE + '0.7)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(X, Z, 70, 46, 0.3, 0, PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = INK_BLUE + '0.5)';
    ctx.beginPath(); ctx.ellipse(X, Z, 48, 30, 0.3, 0, PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X - 18, Z); ctx.quadraticCurveTo(X - 8, Z - 6, X, Z); ctx.quadraticCurveTo(X + 8, Z + 6, X + 18, Z); ctx.stroke();
  };
  const field = (x: number, z: number): void => {
    const X = px(x), Z = pz(z);
    ctx.strokeStyle = ink(0.4); ctx.lineWidth = 1.6;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(X - 32, Z + i * 7); ctx.lineTo(X + 32, Z + i * 7); ctx.stroke(); }
    ctx.strokeStyle = ink(0.55); ctx.strokeRect(X - 34, Z - 26, 68, 52);
  };
  const village = (x: number, z: number): void => {
    const X = px(x), Z = pz(z);
    ctx.fillStyle = 'rgba(232,218,184,0.9)'; ctx.strokeStyle = ink(0.8); ctx.lineWidth = 2.2;
    for (const [dx, dz, s] of [[-22, 0, 1], [6, -6, 1.2], [26, 8, 0.9]] as Array<[number, number, number]>) {
      ctx.beginPath(); ctx.rect(X + dx - 10 * s, Z + dz - 6 * s, 20 * s, 14 * s); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X + dx - 13 * s, Z + dz - 6 * s); ctx.lineTo(X + dx, Z + dz - 20 * s); ctx.lineTo(X + dx + 13 * s, Z + dz - 6 * s); ctx.closePath(); ctx.fillStyle = 'rgba(190,100,70,0.55)'; ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(232,218,184,0.9)';
    }
  };
  for (const g of REGIONS) {
    if (o.founded.has(g.id)) continue;
    const rr = rng(g.cells.length * 77 + g.id.charCodeAt(0));
    const cx = g.cells.reduce((a, c) => a + 1.5 * c[0], 0) / g.cells.length, cz = g.cells.reduce((a, c) => a + 0.8660254 * c[0] + 1.7320508 * c[1], 0) / g.cells.length;
    g.cells.forEach(([q, rrr], idx) => {
      const [x0, z0] = cellXY(q, rrr);
      const jx = (rr() - 0.5) * 0.9, jz = (rr() - 0.5) * 0.7, x = x0 + jx, z = z0 + jz;
      if (near(x, z) || Math.hypot(x - cx, z - cz) < 1.0) return;
      const t = g.theme, v = rr();
      switch (t) {
        case 'pedregal': case 'serra': if (v < 0.6) mountain(x, z, 0.8 + rr() * 0.5); else if (v < 0.8) hill(x, z, 0.9); break;
        case 'mata': case 'bosque': if (v < 0.8) { tree(x, z, 0.9 + rr() * 0.4, rr() < 0.5); if (rr() < 0.5) tree(x + 0.35, z + 0.1, 0.8, true); } break;
        case 'marisma': if (v < 0.6) reeds(x, z); break;
        case 'dunas': if (v < 0.6) dune(x, z); break;
        case 'lago': if (idx === 0) lake(cx, cz + 0.4); else if (v < 0.3) reeds(x, z); break;
        case 'campina': case 'trigo': case 'moinhos': if (v < 0.35) field(x, z); else if (v < 0.55) hill(x, z, 0.8); else if (v < 0.7) tree(x, z, 0.8, false); break;
        case 'charneca': if (v < 0.45) hill(x, z, 0.8); else if (v < 0.7) tree(x, z, 0.7, rr() < 0.5); break;
        default: if (v < 0.5) hill(x, z, 0.8); break;
      }
    });
    if (g.theme !== 'lago') village(cx + 0.9, cz - 0.9);
  }

  // ---------- rio e estrada a tinta onde a região ainda não foi fundada ----------
  const inkRiver = (pts: Pt[], w0: number, w1: number): void => {
    // faixa de água lavada + duas margens
    const left: Pt[] = [], right: Pt[] = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const t = i / (pts.length - 1), w = (w0 + (w1 - w0) * t) / 2;
      left.push([p[0] - dz * w, p[1] + dx * w]); right.push([p[0] + dz * w, p[1] - dx * w]);
    });
    ctx.fillStyle = 'rgba(78,156,196,0.7)';
    ctx.beginPath(); left.forEach((p, i) => { const X = px(p[0]), Z = pz(p[1]); if (i) ctx.lineTo(X, Z); else ctx.moveTo(X, Z); }); for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(px(right[i][0]), pz(right[i][1])); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK_BLUE + '0.85)'; ctx.lineWidth = 2.6; strokeLine(left); strokeLine(right);
    ctx.strokeStyle = INK_BLUE + '0.55)'; ctx.lineWidth = 1.6;
    for (let i = 6; i < pts.length - 4; i += 14) { const p = pts[i]; ctx.beginPath(); ctx.moveTo(px(p[0]) - 10, pz(p[1])); ctx.quadraticCurveTo(px(p[0]), pz(p[1]) - 6, px(p[0]) + 10, pz(p[1])); ctx.stroke(); }
  };
  for (const rv of o.rivers) {
    // trecho de tinta com um pouco de sobreposição em cima do 3D (fica escondido pelo diorama)
    for (const seg of rv.ink) {
      const full = rv.pts.length;
      const i0 = rv.pts.indexOf(seg[0]), i1 = rv.pts.indexOf(seg[seg.length - 1]);
      const a = Math.max(0, i0 - 6), b = Math.min(full - 1, i1 + 6);
      const part = rv.pts.slice(a, b + 1);
      const w0 = rv.def.width * (a / full < 0.3 ? 0.55 : 1), w1 = a / full > 0.5 ? rv.def.width * 1.7 : rv.def.width * 0.9;
      inkRiver(part, w0, w1);
    }
    if (rv.ink.length === 0 && rv.runs.length === 0) inkRiver(rv.pts, rv.def.width, rv.def.width);
  }
  const bandOf = (pts: Pt[], w: number): [Pt[], Pt[]] => {
    const left: Pt[] = [], right: Pt[] = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      left.push([p[0] - dz * w / 2, p[1] + dx * w / 2]); right.push([p[0] + dz * w / 2, p[1] - dx * w / 2]);
    });
    return [left, right];
  };
  for (const rd of o.roads) {
    const segs = rd.open ? rd.ink : [rd.pts];
    for (const seg of segs) {
      const full = rd.pts.length;
      const i0 = rd.pts.indexOf(seg[0]), i1 = rd.pts.indexOf(seg[seg.length - 1]);
      const part = rd.open ? rd.pts.slice(Math.max(0, i0 - 4), Math.min(full, i1 + 5)) : seg;
      if (rd.open) {
        // estrada aberta que segue em tinta: faixa de terra com as duas margens tracejadas, como a estrada 3D que ela continua
        const [l, rr] = bandOf(part, 0.24);
        ctx.strokeStyle = 'rgba(214,184,128,0.8)'; ctx.lineWidth = sc * 0.24; ctx.setLineDash([]); strokeLine(part);
        ctx.strokeStyle = INK_RED + '0.85)'; ctx.lineWidth = 3; ctx.setLineDash([20, 9]); strokeLine(l); strokeLine(rr); ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = INK_RED + '0.42)'; ctx.lineWidth = 3.2; ctx.setLineDash([3, 12]); strokeLine(part); ctx.setLineDash([]);
      }
    }
  }

  // ---------- nomes ----------
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const serif = '"Palatino Linotype","Book Antiqua",Palatino,"URW Palladio L","Liberation Serif",Georgia,serif';
  for (const g of REGIONS) {
    if (o.founded.has(g.id)) continue;
    const cx = g.cells.reduce((a, c) => a + 1.5 * c[0], 0) / g.cells.length, cz = g.cells.reduce((a, c) => a + 0.8660254 * c[0] + 1.7320508 * c[1], 0) / g.cells.length;
    const rot = (hash2(cx, cz, 4) - 0.5) * 0.22;
    ctx.save(); ctx.translate(px(cx), pz(cz)); ctx.rotate(rot);
    // halo de papel para a letra ler sobre os rabiscos
    ctx.font = `italic 700 ${Math.round(sc * 0.46)}px ${serif}`;
    (ctx as unknown as { letterSpacing: string }).letterSpacing = Math.round(sc * 0.1) + 'px';
    ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(232,215,172,0.8)'; ctx.lineWidth = 9;
    const label = g.name.toUpperCase();
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = ink(0.92); ctx.fillText(label, 0, 0);
    (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';
    ctx.font = `italic 400 ${Math.round(sc * 0.28)}px ${serif}`;
    ctx.strokeText('à espera', 0, sc * 0.52); ctx.fillStyle = ink(0.55); ctx.fillText('à espera', 0, sc * 0.52);
    ctx.restore();
  }

  // ---------- rosa dos ventos ----------
  const rose = (x: number, z: number, R: number): void => {
    ctx.save(); ctx.translate(x, z);
    ctx.strokeStyle = ink(0.8); ctx.lineWidth = 2.4;
    for (const rr of [R * 0.98, R * 0.82, R * 0.5]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, PI * 2); ctx.stroke(); }
    for (let i = 0; i < 72; i++) { const a = i * PI / 36; ctx.lineWidth = i % 6 === 0 ? 2.4 : 1.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.82, Math.sin(a) * R * 0.82); ctx.lineTo(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98); ctx.stroke(); }
    const star = (len: number, wid: number, rot: number, fillA: string, fillB: string): void => {
      for (let k = 0; k < 4; k++) {
        const a = rot + k * PI / 2;
        const tip = [Math.cos(a) * len, Math.sin(a) * len], l = [Math.cos(a - PI / 4) * wid, Math.sin(a - PI / 4) * wid], rr2 = [Math.cos(a + PI / 4) * wid, Math.sin(a + PI / 4) * wid];
        ctx.fillStyle = fillA; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(l[0], l[1]); ctx.lineTo(tip[0], tip[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = fillB; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(rr2[0], rr2[1]); ctx.lineTo(tip[0], tip[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    };
    ctx.lineWidth = 2;
    star(R * 0.62, R * 0.17, PI / 4, 'rgba(232,218,184,0.9)', 'rgba(122,62,34,0.55)');
    star(R * 0.95, R * 0.14, 0, 'rgba(232,218,184,0.95)', 'rgba(56,36,20,0.7)');
    ctx.fillStyle = ink(0.85); ctx.beginPath(); ctx.arc(0, 0, R * 0.05, 0, PI * 2); ctx.fill();
    ctx.font = `italic 700 ${Math.round(R * 0.3)}px ${serif}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = ink(0.9);
    ctx.fillText('N', 0, -R * 1.14); ctx.fillText('S', 0, R * 1.14); ctx.fillText('L', R * 1.14, 0); ctx.fillText('O', -R * 1.14, 0);
    ctx.restore();
  };
  rose(px(SHEET.cx - SHEET.w / 2 + 4.0), pz(SHEET.cz + SHEET.d / 2 - 4.0), sc * 1.55);

  // ---------- navio e monstro no mar ----------
  const ship = (x: number, z: number, s: number): void => {
    ctx.save(); ctx.translate(px(x), pz(z)); ctx.scale(s, s);
    ctx.strokeStyle = ink(0.8); ctx.lineWidth = 2.4; ctx.fillStyle = 'rgba(236,222,186,0.95)';
    ctx.beginPath(); ctx.moveTo(-34, 6); ctx.quadraticCurveTo(0, 26, 34, 6); ctx.lineTo(28, -2); ctx.lineTo(-28, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -52); ctx.stroke();
    for (const [dx, h, w] of [[0, 36, 24], [0, 20, 18]] as Array<[number, number, number]>) { ctx.beginPath(); ctx.moveTo(dx - 2, -50 + (36 - h)); ctx.quadraticCurveTo(dx + w, -34 + (36 - h) * 0.5, dx - 2, -14 - (20 - h) * -0.4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.strokeStyle = INK_BLUE + '0.6)'; ctx.beginPath(); ctx.moveTo(-44, 20); ctx.quadraticCurveTo(-30, 14, -16, 20); ctx.quadraticCurveTo(0, 26, 14, 20); ctx.quadraticCurveTo(30, 14, 44, 20); ctx.stroke();
    ctx.restore();
  };
  ship(SHEET.cx + SHEET.w / 2 - 6.4, SHEET.cz + SHEET.d / 2 - 2.6, 1.7);
  ship(SHEET.cx - SHEET.w / 2 + 6.0, SHEET.cz - SHEET.d / 2 + 2.6, 1.3);
  {
    const x = px(SHEET.cx + SHEET.w / 2 - 5.2), z = pz(SHEET.cz - SHEET.d / 2 + 3.2);
    ctx.strokeStyle = ink(0.7); ctx.lineWidth = 3; ctx.fillStyle = 'rgba(110,150,130,0.35)';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + i * 46, z + 8, 20, PI, 0); ctx.stroke(); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(x + 144, z + 8); ctx.quadraticCurveTo(x + 156, z - 34, x + 176, z - 28); ctx.lineTo(x + 190, z - 22); ctx.quadraticCurveTo(x + 168, z - 16, x + 164, z + 8); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 176, z - 26, 3, 0, PI * 2); ctx.fillStyle = ink(0.8); ctx.fill();
  }

  // ---------- moldura, cartela e escala ----------
  ctx.strokeStyle = ink(0.85); ctx.lineWidth = 6; ctx.strokeRect(52, 52, W - 104, H - 104);
  ctx.lineWidth = 2.2; ctx.strokeRect(70, 70, W - 140, H - 140);
  // régua de graus nas margens
  ctx.lineWidth = 2;
  for (let i = 0; i <= 80; i++) { const x = 70 + (W - 140) * i / 80, l = i % 5 === 0 ? 20 : 10; ctx.beginPath(); ctx.moveTo(x, 52); ctx.lineTo(x, 52 + (i % 5 === 0 ? 18 : 9)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, H - 52); ctx.lineTo(x, H - 52 - l * 0.9); ctx.stroke(); }
  for (let i = 0; i <= 70; i++) { const y = 70 + (H - 140) * i / 70, l = i % 5 === 0 ? 20 : 10; ctx.beginPath(); ctx.moveTo(52, y); ctx.lineTo(52 + l * 0.9, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(W - 52, y); ctx.lineTo(W - 52 - l * 0.9, y); ctx.stroke(); }
  // cartela com o título do mapa
  {
    const x = 150, y = 150, w = sc * 9.4, h = sc * 2.7;
    ctx.fillStyle = 'rgba(232,216,172,0.88)'; ctx.strokeStyle = ink(0.85); ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 12, y + 12, w - 24, h - 24, 12); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 400 ${Math.round(sc * 0.32)}px ${serif}`; ctx.fillStyle = ink(0.7);
    ctx.fillText('Carta da', x + w / 2, y + h * 0.24);
    ctx.font = `italic 700 ${Math.round(sc * 0.78)}px ${serif}`; (ctx as unknown as { letterSpacing: string }).letterSpacing = Math.round(sc * 0.06) + 'px'; ctx.fillStyle = ink(0.92);
    ctx.fillText('PROVÍNCIA', x + w / 2, y + h * 0.55);
    (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';
    ctx.font = `italic 400 ${Math.round(sc * 0.28)}px ${serif}`; ctx.fillStyle = ink(0.62);
    ctx.fillText(o.week === 1 ? 'primeira semana: duas regiões fundadas' : `quarta semana: ${o.founded.size - 1} regiões fundadas`, x + w / 2, y + h * 0.84);
  }
  // escala
  {
    const x = px(SHEET.cx + SHEET.w / 2 - 12), y = pz(SHEET.cz + SHEET.d / 2 - 2.0), L = sc * 6;
    ctx.strokeStyle = ink(0.85); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + L, y); ctx.stroke();
    for (let i = 0; i <= 3; i++) { ctx.fillStyle = i % 2 ? 'rgba(232,218,184,1)' : ink(0.85); ctx.fillRect(x + (L / 3) * i, y - 9, L / 3, 9); ctx.strokeRect(x + (L / 3) * i, y - 9, L / 3, 9); }
    ctx.font = `italic 400 ${Math.round(sc * 0.26)}px ${serif}`; ctx.fillStyle = ink(0.75); ctx.textAlign = 'center';
    ctx.fillText('uma sessão de caminho', x + L / 2, y + 34);
  }
  // vinheta final: escurece os cantos como papel que já viveu bastante
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.66);
  vg.addColorStop(0, 'rgba(60,30,8,0)'); vg.addColorStop(1, 'rgba(60,30,8,0.38)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function worldCell(x: number, z: number): [number, number] {
  const qf = x / 1.5, rf = (z - 0.8660254 * qf) / 1.7320508, sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return [q, r];
}

export type { Region };
