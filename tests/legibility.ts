// Legibilidade das vilas: de longe, quase de cima, a vila se lê pelo telhado e pela parede contra
// o chão. Mede a diferença de cor (ΔE76 em CIELAB, sem luz) entre cada telhado e parede e o chão
// da vila, ponderada pelo peso das casas, e falha quando uma parte grande das casas some.
import { T } from '../src/core/tiles';
import { THEMES } from '../src/themes/themes';

const ROOF_MIN = 15;
const WALL_MIN = 12;
/** Fração máxima (pelo peso das casas) abaixo do limite. */
const MAX_SHARE = 0.25;

function lab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(n >> 16), g = lin((n >> 8) & 255), b = lin(n & 255);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const dE = (a: string, b: string) => {
  const [l1, a1, b1] = lab(a), [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

let failed = 0;
for (const th of THEMES) {
  const ground = th.ground[T.Village];
  const total = th.houses.reduce((s, h) => s + h.weight, 0);
  const share = (part: 'roofs' | 'walls', min: number) => {
    let low = 0, worst = Infinity;
    for (const h of th.houses) {
      for (const c of h[part]) {
        const d = dE(c, ground);
        worst = Math.min(worst, d);
        if (d < min) low += h.weight / total / h[part].length;
      }
    }
    return { low, worst };
  };
  const roof = share('roofs', ROOF_MIN), wall = share('walls', WALL_MIN);
  const bad = roof.low > MAX_SHARE || wall.low > MAX_SHARE;
  if (bad) failed++;
  const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);
  console.log(`  ${th.id.padEnd(9)} telhado ΔE mín ${roof.worst.toFixed(0).padStart(3)} (${pct(roof.low)} abaixo de ${ROOF_MIN})  parede ΔE mín ${wall.worst.toFixed(0).padStart(3)} (${pct(wall.low)} abaixo de ${WALL_MIN})${bad ? '  ← ilegível' : ''}`);
}
console.log(`Legibilidade: ${THEMES.length} temas, ${failed} com casas que somem no chão da vila`);
if (failed) process.exit(1);
