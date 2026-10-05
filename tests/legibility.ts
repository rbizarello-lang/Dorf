// Legibilidade das vilas: de longe, quase de cima, a vila se lê pelo telhado e pela parede contra
// o chão. Mede a diferença de cor (ΔE76 em CIELAB, sem luz) entre cada telhado e parede e o chão
// da vila, ponderada pelo peso das casas, e falha quando uma parte grande das casas some.
import { T } from '../src/core/tiles';
import { THEMES } from '../src/themes/themes';
import { NIGHT_LIGHT } from '../src/render/nightLight';
import { frameColors } from '../src/ui/frames';
import { SAFE_TERRAIN } from '../src/ui/a11y';

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

// Noite: prado, mata e plantação precisam continuar distintos. Modelo simples de luz (difusa do
// sol ou do luar mais o céu, em RGB linear) sobre a cor do chão de cada terreno; a menor diferença
// entre os três à noite tem de ficar em pelo menos metade da do dia.
const NIGHT_SHARE = 0.5;
const linRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return [lin(n >> 16), lin((n >> 8) & 255), lin(n & 255)];
};
const labOf = ([r, g, b]: number[]) => {
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
let darkFailed = 0;
for (const th of THEMES) {
  const minPair = (sun: string, sunI: number, sky: string, skyI: number) => {
    const s = linRgb(sun), k = linRgb(sky);
    const lit = [T.Grass, T.Forest, T.Field].map((t) => labOf(linRgb(th.ground[t]).map((v, i) => (v * (s[i] * sunI * 0.8 + k[i] * skyI * 0.5) * 1.6) / Math.PI)));
    const d = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    return Math.min(d(lit[0], lit[1]), d(lit[0], lit[2]), d(lit[1], lit[2]));
  };
  const day = minPair(th.sun, th.sunIntensity, th.hemiSky, th.hemiIntensity);
  const night = minPair(NIGHT_LIGHT.sun, NIGHT_LIGHT.sunI, NIGHT_LIGHT.hemiSky, NIGHT_LIGHT.hemiI);
  const bad = night < day * NIGHT_SHARE;
  if (bad) darkFailed++;
  console.log(`  ${th.id.padEnd(9)} noite: prado, mata e plantação ΔE mín ${night.toFixed(1).padStart(5)} (dia ${day.toFixed(1).padStart(5)}, ${Math.round((night / day) * 100)}%)${bad ? '  ← somem no escuro' : ''}`);
}
console.log(`Noite: ${THEMES.length} temas, ${darkFailed} com terrenos que se confundem no escuro`);

// Painéis do tema: a tinta sobre a moldura em 7:1 ou mais (WCAG AAA para texto).
const rel = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const r = lin(n >> 16), g = lin((n >> 8) & 255), b = lin(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const x = rel(a), y = rel(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
let frameFailed = 0;
for (const th of THEMES) {
  const { panel, ink } = frameColors(th.ui);
  const c = ratio(panel, ink);
  const bad = c < 7;
  if (bad) frameFailed++;
  console.log(`  ${th.id.padEnd(9)} ${th.ui.frame.padEnd(11)} tinta × painel ${c.toFixed(1)}:1${bad ? '  ← abaixo de 7:1' : ''}`);
}
console.log(`Molduras: ${THEMES.length} temas, ${frameFailed} com contraste abaixo de 7:1`);
let safeFailed = 0;
for (let i = 0; i < SAFE_TERRAIN.length; i++) {
  for (let j = i + 1; j < SAFE_TERRAIN.length; j++) {
    const d = dE(SAFE_TERRAIN[i], SAFE_TERRAIN[j]);
    if (d < 25) safeFailed++;
  }
}
console.log(`Cores seguras: ${SAFE_TERRAIN.length} terrenos, ${safeFailed} pares com ΔE abaixo de 25`);
if (failed || darkFailed || frameFailed || safeFailed) process.exit(1);
