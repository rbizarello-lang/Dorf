type Point = readonly [number, number];
export interface VillageLane {
  from: Point;
  to: Point;
  halfWidth: number;
}

interface AccessTread {
  start: number;
  end: number;
  y: number;
}

export interface VillageAccess {
  from: Point;
  along: Point;
  across: Point;
  halfWidth: number;
  landing: number;
  treads: AccessTread[];
}

const LANDING = 0.034;
const SURFACE_OFFSET = 0.006;
const LENGTHS = [0.23, 0.19, 0.28] as const;
const LANDING_SAMPLES = [0, 0.5, 1] as const;
const TREAD_SAMPLES = [0, 1 / 6, 1 / 3, 0.5, 2 / 3, 5 / 6, 1] as const;

/** Procura um lance curto entre dois pisos em uma rua existente. A escada ocupa a largura da passagem. */
export function villageAccess(
  lanes: readonly VillageLane[],
  height: (x: number, z: number) => number,
  free: (x: number, z: number) => boolean,
): VillageAccess | null {
  for (const { from, to, halfWidth } of lanes) {
    const dx = to[0] - from[0], dz = to[1] - from[1], length = Math.hypot(dx, dz);
    if (length < LENGTHS[1] + 2 * LANDING) continue;
    const ux = dx / length, uz = dz / length;
    const hw = halfWidth * 0.96;
    const elevation = (t: number, side: number) => height(from[0] + t * ux - side * uz, from[1] + t * uz + side * ux);
    const fit = (t: number, side: number) => free(from[0] + t * ux - side * uz, from[1] + t * uz + side * ux);
    for (const run of LENGTHS) {
      for (let at = LANDING; at + run + LANDING <= length; at += 0.025) {
        const end = at + run;
        const yA = elevation(at, 0), yB = elevation(end, 0);
        const rise = Math.abs(yB - yA);
        if (rise < 0.048 || rise > 0.132) continue;
        const direction = yB > yA ? 1 : -1;
        const entry = direction === 1 ? at : end;
        const count = Math.min(4, Math.round(rise / 0.028));
        const sides = [-hw, 0, hw];
        const landing = (t: number, toward: number, y: number) => sides.every(side => LANDING_SAMPLES.every(s =>
          fit(t + toward * LANDING * s, side) && Math.abs(elevation(t + toward * LANDING * s, side) - y) <= 0.013,
        ));
        if (!landing(at, -1, yA) || !landing(end, 1, yB)) continue;

        // O degrau é horizontal: o piso fica acima da rua de baixo, toca o piso de cima e mantém a passagem livre.
        const low = Math.min(yA, yB), step = run / count;
        const treads: AccessTread[] = [];
        for (let i = 0; i < count; i++) {
          const start = i * step, end = start + step, y = low + rise * (i + 1) / count;
          const valid = sides.every(side => TREAD_SAMPLES.every(s => {
            const t = entry + direction * (start + s * step);
            const ground = elevation(t, side);
            return ground <= y + 0.004 && ground >= y - 0.072 && fit(t, side);
          }));
          if (!valid) break;
          treads.push({ start, end, y: y + SURFACE_OFFSET });
        }
        if (treads.length === count) return {
          from: [from[0] + entry * ux, from[1] + entry * uz],
          along: [direction * ux, direction * uz],
          across: [-direction * uz, direction * ux],
          halfWidth: hw,
          landing: LANDING,
          treads,
        };
      }
    }
  }
  return null;
}
