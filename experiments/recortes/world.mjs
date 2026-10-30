// O mapa dos Recortes: peças colocadas, costa exposta, lista de poses e pontuação de rascunho.
//
// Uma POSE é (giro r, deslocamento tx,ty). A jogada guardada no save seria só o índice da pose
// na lista, que sai de uma função pura da semente e do mapa (ver "Invariantes" do AGENTS.md).
// Coordenadas inteiras: vértices e translações são inteiros; comprimentos e tolerâncias de
// distância usam float só com soma, produto e raiz quadrada (IEEE exatos).

import { S, deepInside, hyp, subtractInterval, sumIntervals } from './geom.mjs';
import { FAMILIES, WATER, shapeAt } from './pieces.mjs';

const G = 1500; // célula do hash espacial
const gk = (cx, cy) => (cx + 2048) * 4096 + (cy + 2048);

// Interações como no jogo de hoje (src/core/synergy.ts): vila×floresta, vila×plantação,
// vila×prado, plantação×prado. 0 prado, 1 floresta, 2 plantação, 3 vila.
const SYN = new Set(['1,3', '2,3', '0,3', '0,2']);
const isSyn = (a, b) => SYN.has(a < b ? `${a},${b}` : `${b},${a}`);

export const DEFAULTS = {
  P: 48, // poses por peça (limite da lista)
  minContact: 0.5 * S, // contato mínimo com a costa do mapa
  matchPts: 10, // por lado de hexágono (S) de costa que casa com o mesmo terreno
  synPts: 5, // por S de costa com interação
  riverPts: 10, // por boca de rio que continua
  perfectBonus: 20, // contato todo igual e de pelo menos 1,5 S
  fitPts: 0, // por S de costa de terra que encosta, mesmo sem casar (premia o encaixe justo)
  gulfPts: 8, // por S de perímetro que a peça tira do mapa
  gulfCap: 40,
  exhaustive: false, // não corta a lista em P (para contar todas as poses)
  maxOverlapTests: 700,
  dedupe: 220, // poses do mesmo giro mais próximas que isso contam como a mesma
};

export class World {
  constructor(fam, opts = {}) {
    this.fam = fam;
    this.F = FAMILIES[fam];
    this.o = { ...DEFAULTS, ...opts };
    const tolMul = this.o.tolMul ?? 1;
    this.tol = this.o.tol ?? this.F.tol * tolMul;
    this.dTol = this.o.dTol ?? this.F.dTol * tolMul;
    // com ímã mais tolerante, o ângulo aceito também abre (ii) ; nas famílias exatas fica exato
    this.angCos = fam === 'ii' ? Math.cos((11 * tolMul * Math.PI) / 180) : this.F.ang;
    this.tolerant = fam === 'ii';
    this.pieces = [];
    this.pgrid = new Map();
    this.egrid = new Map();
    this.bins = Array.from({ length: 24 }, () => []);
    this.perim = 0;
    this.area = 0;
    this.stamp = 0;
    this._nb = Array.from({ length: 24 }, () => []);
  }

  // ---------- estrutura espacial ----------
  _insert(map, obj, minx, miny, maxx, maxy) {
    const x0 = Math.floor(minx / G), x1 = Math.floor(maxx / G), y0 = Math.floor(miny / G), y1 = Math.floor(maxy / G);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const k = gk(cx, cy);
        const l = map.get(k);
        if (l) l.push(obj);
        else map.set(k, [obj]);
      }
  }

  /** Coloca a primeira peça (sem exigir contato). */
  placeFirst(piece, r = 0) {
    return this._commit(piece, { r, tx: 0, ty: 0, contacts: [], score: 0, parts: {}, contact: 0 });
  }

  // ---------- poses ----------
  /** Lista as poses válidas da peça, da melhor para a pior. Devolve também estatísticas do cálculo. */
  poses(piece) {
    const o = this.o;
    const stats = { candidates: 0, evaluated: 0, overlapTests: 0, valid: 0 };
    if (!this.pieces.length) return { poses: [{ r: 0, tx: 0, ty: 0, score: 0, contacts: [], parts: {}, contact: 0 }], stats };
    const seen = new Set();
    const cands = [];
    const tolerant = this.tolerant;
    const dbs = tolerant ? [-1, 0, 1] : [0];
    const angCos = this.angCos;
    const anchorMin = tolerant ? 250 : 150;
    for (let r = 0; r < piece.rots; r++) {
      const sh = shapeAt(piece, r);
      for (let j = 0; j < sh.n; j++) {
        if (sh.len[j] < 150) continue;
        const wj = piece.labels[j] === WATER;
        const tb = (sh.bin[j] + 12) % 24;
        const j2 = (j + 1) % sh.n;
        const Ax = sh.vx[j], Ay = sh.vy[j], Bx = sh.vx[j2], By = sh.vy[j2];
        for (const db of dbs) {
          const list = this.bins[(tb + db + 24) % 24];
          for (let q = 0; q < list.length; q++) {
            const f = list[q];
            if (f.expLen < 0.3 * f.len || (f.label === WATER) !== wj) continue;
            if (Math.min(sh.len[j], f.expLen) < anchorMin) continue;
            if (sh.ux[j] * f.ux + sh.uy[j] * f.uy > -angCos) continue; // não é antiparalela dentro da tolerância
            // (1) início da aresta da peça sobre o fim da aresta do mapa
            this._cand(cands, seen, r, f.bx - Ax, f.by - Ay, stats);
            if (tolerant) {
              // (2) fim da peça sobre o início do mapa; (3) pontos médios só se os comprimentos diferem muito
              this._cand(cands, seen, r, f.ax - Bx, f.ay - By, stats);
              const ratio = sh.len[j] / f.len;
              if (ratio > 1.4 || ratio < 0.7) this._cand(cands, seen, r, Math.round((f.ax + f.bx) / 2 - (Ax + Bx) / 2), Math.round((f.ay + f.by) / 2 - (Ay + By) / 2), stats);
            }
          }
        }
      }
    }
    // fase A: contato, rio e pontuação (barato)
    const scored = [];
    for (const c of cands) {
      const ev = this._contactEval(piece, c.r, c.tx, c.ty);
      stats.evaluated++;
      if (ev) scored.push(ev);
    }
    scored.sort((a, b) => b.score - a.score || a.r - b.r || a.tx - b.tx || a.ty - b.ty);
    // fase B: sobreposição (caro), do melhor para o pior, com deduplicação
    const poses = [];
    const D2 = o.dedupe * o.dedupe;
    for (const ev of scored) {
      if (!o.exhaustive && poses.length >= o.P) break;
      if (stats.overlapTests >= o.maxOverlapTests && !o.exhaustive) break;
      let dup = false;
      for (const p of poses) {
        if (p.r === ev.r && (p.tx - ev.tx) ** 2 + (p.ty - ev.ty) ** 2 < D2) {
          dup = true;
          break;
        }
      }
      if (dup) continue;
      stats.overlapTests++;
      if (this._overlaps(piece, ev.r, ev.tx, ev.ty)) continue;
      poses.push(o.exhaustive ? ev : this._contactEval(piece, ev.r, ev.tx, ev.ty, true));
    }
    stats.valid = poses.length;
    return { poses, stats };
  }

  _cand(cands, seen, r, tx, ty, stats) {
    const sh = this.tolerant ? 5 : 2;
    const k = (r * 8192 + ((tx >> sh) + 4096)) * 8192 + ((ty >> sh) + 4096);
    if (seen.has(k)) return;
    seen.add(k);
    stats.candidates++;
    cands.push({ r, tx, ty });
  }

  /** Contato com a costa, validade do rio, contato mínimo e pontuação. null = pose inválida. */
  _contactEval(piece, r, tx, ty, record = false) {
    const o = this.o;
    const sh = shapeAt(piece, r);
    const dT = this.dTol;
    const minx = sh.minx + tx - dT, maxx = sh.maxx + tx + dT, miny = sh.miny + ty - dT, maxy = sh.maxy + ty + dT;
    // arestas expostas do mapa na caixa
    const stamp = ++this.stamp;
    const nb = this._nb;
    for (let b = 0; b < 24; b++) nb[b].length = 0;
    let anyNear = false;
    for (let cx = Math.floor(minx / G); cx <= Math.floor(maxx / G); cx++)
      for (let cy = Math.floor(miny / G); cy <= Math.floor(maxy / G); cy++) {
        const l = this.egrid.get(gk(cx, cy));
        if (!l) continue;
        for (const e of l) {
          if (e.stamp === stamp || e.expLen < 5) continue;
          e.stamp = stamp;
          nb[e.bin].push(e);
          anyNear = true;
        }
      }
    if (!anyNear) return null;
    const tolerantBins = this.tolerant;
    const cosT = this.angCos;
    const contacts = [];
    let cTotal = 0, matchLen = 0, synLen = 0, mism = 0, riverOk = 0;
    const n = sh.n;
    for (let j = 0; j < n; j++) {
      const L = sh.len[j];
      const ax = sh.vx[j] + tx, ay = sh.vy[j] + ty, ux = sh.ux[j], uy = sh.uy[j];
      const lab = piece.labels[j];
      const tb = (sh.bin[j] + 12) % 24;
      for (let bi = tolerantBins ? -1 : 0; bi <= (tolerantBins ? 1 : 0); bi++) {
       const near = nb[(tb + bi + 24) % 24];
       for (let q = 0; q < near.length; q++) {
        const f = near[q];
        if (ux * f.ux + uy * f.uy > -cosT) continue;
        const cxr = f.ax - ax, cyr = f.ay - ay, dxr = f.bx - ax, dyr = f.by - ay;
        const dc = ux * cyr - uy * cxr, dd = ux * dyr - uy * dxr;
        if (dc * dd > 0 && Math.abs(dc) > dT && Math.abs(dd) > dT) continue;
        const tc = ux * cxr + uy * cyr, td = ux * dxr + uy * dyr;
        let lo = Math.max(0, Math.min(tc, td)), hi = Math.min(L, Math.max(tc, td));
        if (hi - lo < 1) continue;
        const dtc = tc - td;
        if (dtc < 1e-9) continue;
        // dist(t) = dd + sl * (t - td), linear entre td e tc
        const sl = (dc - dd) / dtc;
        if (Math.abs(sl) < 1e-9) {
          if (Math.abs(dd) > dT) continue;
        } else {
          const t1 = td + (-dT - dd) / sl, t2 = td + (dT - dd) / sl;
          lo = Math.max(lo, Math.min(t1, t2));
          hi = Math.min(hi, Math.max(t1, t2));
          if (hi - lo < 1) continue;
        }
        const qf = dtc / f.len; // unidades de t por unidade de s
        const ex = f.exp;
        for (let k = 0; k < ex.length; k += 2) {
          const ta = tc - ex[k + 1] * qf, tb = tc - ex[k] * qf;
          const a = Math.max(ta, lo), b = Math.min(tb, hi);
          if (b - a < 1) continue;
          const len = b - a;
          const lf = f.label;
          // rio é estrito: rio só com rio (ou com o mar); terra só com terra
          if ((lab === WATER) !== (lf === WATER)) {
            if (len > 40) return null;
            continue;
          }
          if (lab === WATER) {
            if (len < 0.6 * Math.min(L, f.len)) {
              if (len > 40) return null;
              continue;
            }
            riverOk++;
          } else if (lab === lf) matchLen += len;
          else if (isSyn(lab, lf)) synLen += len;
          else mism += len;
          cTotal += len;
          if (record) contacts.push({ j, f, t0: a, t1: b, s0: (tc - b) / qf, s1: (tc - a) / qf, len });
        }
       }
      }
    }
    if (cTotal < o.minContact) return null;
    const landC = matchLen + synLen + mism;
    const parts = {
      match: (o.matchPts * matchLen) / S,
      syn: (o.synPts * synLen) / S,
      river: o.riverPts * riverOk,
      perfect: landC >= 1.5 * S && mism + synLen <= 0.1 * landC ? o.perfectBonus : 0,
      fit: (o.fitPts * landC) / S,
      gulf: 0,
    };
    const dPer = sh.perim - 2 * cTotal;
    if (dPer < 0) parts.gulf = Math.min(o.gulfCap, (o.gulfPts * -dPer) / S);
    const score = parts.match + parts.syn + parts.river + parts.perfect + parts.fit + parts.gulf;
    return { r, tx, ty, score, parts, contact: cTotal, dPer, contacts, matchLen, synLen, mism };
  }

  /** A pose faz a peça entrar mais do que `tol` numa peça já colocada? */
  _overlaps(piece, r, tx, ty) {
    const sh = shapeAt(piece, r);
    const tol = this.tol, tol2 = tol * tol;
    const minx = sh.minx + tx, maxx = sh.maxx + tx, miny = sh.miny + ty, maxy = sh.maxy + ty;
    const stamp = ++this.stamp;
    let pvx = null, pvy = null;
    for (let cx = Math.floor(minx / G); cx <= Math.floor(maxx / G); cx++)
      for (let cy = Math.floor(miny / G); cy <= Math.floor(maxy / G); cy++) {
        const l = this.pgrid.get(gk(cx, cy));
        if (!l) continue;
        for (const Q of l) {
          if (Q.stamp === stamp) continue;
          Q.stamp = stamp;
          if (Q.maxx < minx - tol || Q.minx > maxx + tol || Q.maxy < miny - tol || Q.miny > maxy + tol) continue;
          // amostras da peça dentro de Q
          const sx = sh.sx, sy = sh.sy;
          for (let i = 0; i < sx.length; i++) {
            const px = sx[i] + tx, py = sy[i] + ty;
            if (px < Q.minx || px > Q.maxx || py < Q.miny || py > Q.maxy) continue;
            if (deepInside(px, py, Q.vx, Q.vy, tol2)) return true;
          }
          // amostras de Q dentro da peça
          if (!pvx) {
            pvx = sh.vx.map((v) => v + tx);
            pvy = sh.vy.map((v) => v + ty);
          }
          const qx = Q.sx, qy = Q.sy;
          for (let i = 0; i < qx.length; i++) {
            const px = qx[i], py = qy[i];
            if (px < minx || px > maxx || py < miny || py > maxy) continue;
            if (deepInside(px, py, pvx, pvy, tol2)) return true;
          }
        }
      }
    return false;
  }

  // ---------- colocar ----------
  place(piece, pose) {
    return this._commit(piece, pose);
  }

  _commit(piece, pose) {
    if (pose.contact > 0 && !pose.contacts.length) pose = this._contactEval(piece, pose.r, pose.tx, pose.ty, true);
    const sh = shapeAt(piece, pose.r);
    const tx = pose.tx, ty = pose.ty;
    const n = sh.n;
    const vx = sh.vx.map((v) => v + tx), vy = sh.vy.map((v) => v + ty);
    const pc = {
      id: this.pieces.length,
      piece,
      r: pose.r,
      tx,
      ty,
      vx,
      vy,
      minx: sh.minx + tx,
      maxx: sh.maxx + tx,
      miny: sh.miny + ty,
      maxy: sh.maxy + ty,
      sx: sh.sx.map((v) => v + tx),
      sy: sh.sy.map((v) => v + ty),
      cx: sh.cx + tx,
      cy: sh.cy + ty,
      stamp: 0,
      edges: [],
      score: pose.score,
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const e = {
        pc,
        i,
        ax: vx[i],
        ay: vy[i],
        bx: vx[j],
        by: vy[j],
        ux: sh.ux[i],
        uy: sh.uy[i],
        len: sh.len[i],
        label: piece.labels[i],
        bin: sh.bin[i],
        exp: [0, sh.len[i]],
        expLen: sh.len[i],
        stamp: 0,
      };
      pc.edges.push(e);
    }
    for (const c of pose.contacts) {
      const e = pc.edges[c.j];
      e.exp = subtractInterval(e.exp, c.t0, c.t1);
      c.f.exp = subtractInterval(c.f.exp, c.s0, c.s1);
    }
    this._insert(this.pgrid, pc, pc.minx, pc.miny, pc.maxx, pc.maxy);
    for (const e of pc.edges) {
      e.expLen = sumIntervals(e.exp);
      this._insert(this.egrid, e, Math.min(e.ax, e.bx) - this.dTol, Math.min(e.ay, e.by) - this.dTol, Math.max(e.ax, e.bx) + this.dTol, Math.max(e.ay, e.by) + this.dTol);
      this.bins[e.bin].push(e);
    }
    let per = 0;
    for (const c of pose.contacts) c.f.expLen = sumIntervals(c.f.exp);
    for (const q of this.pieces) for (const e of q.edges) per += e.expLen;
    for (const e of pc.edges) per += e.expLen;
    this.perim = per;
    this.area += sh.area;
    this.pieces.push(pc);
    for (let b = 0; b < 24; b++) if (this.bins[b].length > 64) this.bins[b] = this.bins[b].filter((e) => e.expLen > 5);
    return pc;
  }
}
