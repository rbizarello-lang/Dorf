import type * as THREE from 'three/webgpu';

// Oclusão de ambiente assada na cor dos vértices, calculada uma vez quando o kit é montado.
// É o que o Blender faria num "bake" de AO: cantos, beirais, troncos sob a copa e a base
// dos objetos (contra o chão em y = 0) ficam mais escuros. Não custa nada por quadro e
// aparece em todos os níveis de qualidade, inclusive onde não há GTAO/SSGI.
// Determinístico: raios em direções fixas, então a peça continua igual em toda parte.

const RAYS = 16;
/** Quanto a oclusão total escurece (0 = nada, 1 = preto). */
const STRENGTH = 0.55;

// Direções num hemisfério em torno de +Y (espiral de Fibonacci, com peso de cosseno).
const HEMI: number[] = [];
for (let i = 0; i < RAYS; i++) {
  const u = (i + 0.5) / RAYS;
  const r = Math.sqrt(u), phi = i * 2.399963229728653;
  HEMI.push(r * Math.cos(phi), Math.sqrt(1 - u), r * Math.sin(phi));
}

/**
 * Multiplica `color` pela oclusão. Espera geometria não indexada com normais por face
 * (a saída de `kit()`). `ground`: o chão em y = 0 também oclui (falso para o que voa ou gira no ar).
 */
export function bakeAO(g: THREE.BufferGeometry, ground = true) {
  const pos = g.attributes.position.array as Float32Array;
  const col = g.attributes.color.array as Float32Array;
  const nv = pos.length / 3;
  if (nv % 3) return;
  // A oclusão só depende da forma; o mesmo kit em outra cor (ou outro tema) reaproveita.
  const key = shapeKey(pos, ground);
  let f = cache.get(key);
  if (!f) cache.set(key, (f = occlusion(pos, g.attributes.normal.array as Float32Array, ground)));
  for (let v = 0; v < nv; v++) {
    col[v * 3] *= f[v];
    col[v * 3 + 1] *= f[v];
    col[v * 3 + 2] *= f[v];
  }
  g.attributes.color.needsUpdate = true;
}

const cache = new Map<string, Float32Array>();

function shapeKey(pos: Float32Array, ground: boolean) {
  const u = new Uint32Array(pos.buffer, pos.byteOffset, pos.length);
  let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
  for (let i = 0; i < u.length; i++) {
    h1 = Math.imul(h1 ^ u[i], 0x01000193);
    h2 = Math.imul(h2 ^ u[i], 0x85ebca6b) ^ (h2 >>> 13);
  }
  return `${pos.length}:${h1 >>> 0}:${h2 >>> 0}:${+ground}`;
}

/** Fator de cor (1 = sem oclusão) de cada vértice. */
function occlusion(pos: Float32Array, nrm: Float32Array, ground: boolean) {
  const nv = pos.length / 3, nt = nv / 3;
  const out = new Float32Array(nv);

  // Alcance dos raios proporcional ao tamanho do kit: oclusão é um efeito de proximidade.
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < nv; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const R = Math.min(0.05, Math.max(0.01, 0.2 * Math.hypot(x1 - x0, y1 - y0, z1 - z0)));

  // Caixa de cada triângulo, para descartar rápido o que está longe do vértice.
  const box = new Float32Array(nt * 6);
  for (let t = 0; t < nt; t++) {
    const o = t * 9;
    box[t * 6] = Math.min(pos[o], pos[o + 3], pos[o + 6]);
    box[t * 6 + 1] = Math.min(pos[o + 1], pos[o + 4], pos[o + 7]);
    box[t * 6 + 2] = Math.min(pos[o + 2], pos[o + 5], pos[o + 8]);
    box[t * 6 + 3] = Math.max(pos[o], pos[o + 3], pos[o + 6]);
    box[t * 6 + 4] = Math.max(pos[o + 1], pos[o + 4], pos[o + 7]);
    box[t * 6 + 5] = Math.max(pos[o + 2], pos[o + 5], pos[o + 8]);
  }

  const near: number[] = [];
  const dirs = new Float32Array(RAYS * 3);
  for (let v = 0; v < nv; v++) {
    const nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
    // Recuo ao longo da normal para o raio não acertar a própria face.
    const eps = R * 0.02;
    const px = pos[v * 3] + nx * eps, py = pos[v * 3 + 1] + ny * eps, pz = pos[v * 3 + 2] + nz * eps;

    near.length = 0;
    const self = (v / 3) | 0;
    for (let t = 0; t < nt; t++) {
      if (t === self) continue;
      const b = t * 6;
      if (px + R < box[b] || px - R > box[b + 3] || py + R < box[b + 1] || py - R > box[b + 4] || pz + R < box[b + 2] || pz - R > box[b + 5]) continue;
      // Triângulo inteiro atrás do plano do vértice: nenhum raio do hemisfério chega nele.
      const o = t * 9;
      if ((pos[o] - px) * nx + (pos[o + 1] - py) * ny + (pos[o + 2] - pz) * nz < 0 &&
        (pos[o + 3] - px) * nx + (pos[o + 4] - py) * ny + (pos[o + 5] - pz) * nz < 0 &&
        (pos[o + 6] - px) * nx + (pos[o + 7] - py) * ny + (pos[o + 8] - pz) * nz < 0) continue;
      near.push(t);
    }

    // Base ortonormal com a normal no lugar de +Y.
    const sx = Math.abs(nx) < 0.9 ? 1 : 0, sz = 1 - sx;
    let tx = ny * sz, ty = nz * sx - nx * sz, tz = -ny * sx;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
    for (let k = 0; k < RAYS; k++) {
      const a = HEMI[k * 3], h = HEMI[k * 3 + 1], c = HEMI[k * 3 + 2];
      dirs[k * 3] = tx * a + nx * h + bx * c;
      dirs[k * 3 + 1] = ty * a + ny * h + by * c;
      dirs[k * 3 + 2] = tz * a + nz * h + bz * c;
    }

    let occ = 0;
    for (let k = 0; k < RAYS; k++) {
      const dx = dirs[k * 3], dy = dirs[k * 3 + 1], dz = dirs[k * 3 + 2];
      let best = R;
      if (ground && dy < 0 && py > -1e-4) best = Math.min(best, -Math.max(py, 0) / dy);
      for (const t of near) {
        const d = hit(pos, t * 9, px, py, pz, dx, dy, dz, best);
        if (d < best) best = d;
      }
      // Perto oclui mais que longe: o canto escurece, a parede distante quase não.
      if (best < R) occ += 1 - best / R;
    }
    out[v] = 1 - STRENGTH * (occ / RAYS);
  }
  return out;
}

/** Möller–Trumbore, dos dois lados. Devolve a distância ou Infinity. */
function hit(p: Float32Array, o: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number) {
  const e1x = p[o + 3] - p[o], e1y = p[o + 4] - p[o + 1], e1z = p[o + 5] - p[o + 2];
  const e2x = p[o + 6] - p[o], e2y = p[o + 7] - p[o + 1], e2z = p[o + 8] - p[o + 2];
  const qx = dy * e2z - dz * e2y, qy = dz * e2x - dx * e2z, qz = dx * e2y - dy * e2x;
  const det = e1x * qx + e1y * qy + e1z * qz;
  if (det > -1e-12 && det < 1e-12) return Infinity;
  const inv = 1 / det;
  const sx = ox - p[o], sy = oy - p[o + 1], sz = oz - p[o + 2];
  const u = (sx * qx + sy * qy + sz * qz) * inv;
  if (u < 0 || u > 1) return Infinity;
  const rx = sy * e1z - sz * e1y, ry = sz * e1x - sx * e1z, rz = sx * e1y - sy * e1x;
  const w = (dx * rx + dy * ry + dz * rz) * inv;
  if (w < 0 || u + w > 1) return Infinity;
  const d = (e2x * rx + e2y * ry + e2z * rz) * inv;
  return d > 0 && d < max ? d : Infinity;
}
