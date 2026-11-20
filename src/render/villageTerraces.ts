type Triple<T> = readonly [T, T, T];

export interface TerracePoint {
  u: number;
  v: number;
  y: number;
  strength: number;
}

export interface TerraceFace {
  kind: 'bench' | 'wall' | 'coping';
  points: Triple<TerracePoint>;
}

const STEP = 0.11;
const PROFILE = [
  { at: 0.40, y: 0.04, kind: 'bench' },
  { at: 0.49, y: 0.94, kind: 'wall' },
  { at: 0.66, y: 0.97, kind: 'coping' },
  { at: 1, y: 1, kind: 'bench' },
] as const;

/** Recorta um triângulo pelas curvas de nível, sem alterar seu contorno em XZ. `u` e `v` são pesos dos vértices 1 e 2. */
export function terraceFaces(ys: Triple<number>, strengths: Triple<number>): TerraceFace[] {
  const lo = Math.min(...ys), hi = Math.max(...ys);
  let remaining: TerracePoint[] = ys.map((y, i) => ({ u: Number(i === 1), v: Number(i === 2), y, strength: strengths[i] }));
  const faces: TerraceFace[] = [];
  for (let band = Math.floor(lo / STEP); remaining.length >= 3; band++) {
    let from = band * STEP, foot = from;
    for (const cut of PROFILE) {
      const to = (band + cut.at) * STEP, top = (band + cut.y) * STEP;
      if (to >= lo) {
        let strip = remaining, next: TerracePoint[] = [];
        if (to < hi) {
          strip = [];
          for (let i = 0; i < remaining.length; i++) {
            const a = remaining[i], b = remaining[(i + 1) % remaining.length];
            if (a.y <= to) strip.push(a);
            if (a.y >= to) next.push(a);
            if ((a.y < to && b.y > to) || (a.y > to && b.y < to)) {
              const t = (to - a.y) / (b.y - a.y);
              const p = { u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t, y: to, strength: a.strength + (b.strength - a.strength) * t };
              strip.push(p);
              next.push(p);
            }
          }
        }
        remaining = next;
        if (strip.length >= 3) {
          const points = strip.map((p) => ({ ...p, y: Math.fround(p.y + (foot + (top - foot) * (p.y - from) / (to - from) - p.y) * p.strength) }));
          const a = points[0];
          for (let i = 1; i + 1 < points.length; i++) {
            const b = points[i], c = points[i + 1];
            if (Math.abs((b.u - a.u) * (c.v - a.v) - (b.v - a.v) * (c.u - a.u)) > 1e-10) faces.push({ kind: cut.kind, points: [a, b, c] });
          }
        }
        if (remaining.length < 3) break;
      }
      from = to;
      foot = top;
    }
  }
  return faces;
}

/** Cota no mesmo subtriângulo que o render usa. Na linha de corte qualquer uma das duas faces dá a mesma cota. */
export function terraceHeight(faces: readonly TerraceFace[], u: number, v: number) {
  for (const { points: [a, b, c] } of faces) {
    const ux = b.u - a.u, uz = b.v - a.v, vx = c.u - a.u, vz = c.v - a.v;
    const x = u - a.u, z = v - a.v, det = ux * vz - uz * vx;
    const s = (x * vz - z * vx) / det, t = (ux * z - uz * x) / det;
    if (s >= -1e-8 && t >= -1e-8 && s + t <= 1 + 1e-8) return a.y + (b.y - a.y) * s + (c.y - a.y) * t;
  }
  return undefined;
}
