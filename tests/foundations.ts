// Fundações das casas sobre as Encostas (D47). A casa assenta num piso horizontal e a fundação de pedra fecha o vão do lado de
// baixo. Em partidas de verdade (5 temas, Clássico, Zen e Relevo, várias sementes) confere, olhando a GEOMETRIA montada e o chão
// desenhado (`HillSurface.at`, o mesmo triângulo que a GPU desenha, com capas e arrimos dos patamares), que a fundação cobre o chão
// em toda a área da casa já crescida pela Paisagem viva (estágio 3, a maior):
//   1. nenhum ponto do chão sob a casa passa do piso (nenhuma capa cobre o topo da fundação: antes ela o cortava em triângulos
//      que se cruzavam);
//   2. onde o chão fica mais de FOOT_SEE abaixo do piso, há topo de pedra cobrindo a área e, em cada lado do bloco, uma parede
//      vertical cuja base fica abaixo da menor cota do chão naquele lado (cantos, meios dos lados e o que houver entre eles).
import assert from 'node:assert/strict';
import { DEFAULT_RULES, type Rules } from '../src/core/board';
import { Game } from '../src/core/game';
import { boardHill, handHill, logicLevels } from '../src/core/hills';
import { modeById, modeRules, type ModeId } from '../src/core/modes';
import { mulberry32 } from '../src/core/rng';
import { BODY } from '../src/render/lib';
import { GROW } from '../src/render/livingBuild';
import { buildTile, DRAPE_RING, DRAPE_STEP, FOOT_HALF } from '../src/render/tileBuilder';
import { THEMES } from '../src/themes/themes';

const N = Number(process.env.FUND_N ?? 3);
const FOOT_SEE = 0.03, TOL = 0.002;
const MODES: ModeId[] = ['classico', 'zen', 'relevo'];
type P = [number, number];

let houses = 0, plinths = 0, walls = 0, maxOver = 0, tallest = 0, bad = 0;
const rows: string[] = [];
const heights: number[] = [];
const complain = (msg: string) => {
  bad++;
  if (rows.length < 20) rows.push(msg);
};

for (let seed = 1; seed <= N; seed++) {
  for (const theme of THEMES) {
    for (const mode of MODES) {
      const rules: Rules = { ...DEFAULT_RULES, ...theme.rules, ...modeRules(modeById(mode), seed) };
      const g = new Game(seed, rules, []);
      const rnd = mulberry32(seed * 7 + 1);
      for (let guard = 0; g.current && guard < 36; guard++) {
        const m = g.bestMove(rnd);
        if (!m) break;
        g.rot = m.rot;
        if (!g.place(m.q, m.r)) break;
      }
      for (const p of g.board.list) {
        const hand = handHill(p.def, logicLevels(g.board, p.def));
        const hill = boardHill(g.board, p.q, p.r, p.def, p.rot);
        const tile = buildTile(p.def.edges, p.def.seed, theme, { detail: 0.65, hill, hand, houses: [] });
        const surface = tile.hill!;
        // O bloco de pedra de qualquer casa da peça: todos os vértices do triângulo dentro do retângulo da fundação e sobre a borda dele.
        const blocks = tile.decos.filter((o) => o.key.startsWith('wall:')).map((o) => {
          const b = BODY[theme.houses[Number(o.key.slice(5))].body];
          return { o, hw: b.w * o.sx * FOOT_HALF, hd: b.d * o.sz * FOOT_HALF, cs: Math.cos(o.ry), sn: Math.sin(o.ry) };
        });
        const isBlock = (v: number[][]) => blocks.some(({ o, hw, hd, cs, sn }) => v.every(([x, , z]) => {
          const u = Math.abs((x - o.x) * cs - (z - o.z) * sn), w = Math.abs((x - o.x) * sn + (z - o.z) * cs);
          return u <= hw + 2e-4 && w <= hd + 2e-4 && (u >= hw - 2e-4 || w >= hd - 2e-4 || v.every(([, y]) => Math.abs(y - v[0][1]) < 1e-6));
        }));
        for (const d of tile.decos) {
          if (!d.key.startsWith('wall:')) continue;
          houses++;
          const body = BODY[theme.houses[Number(d.key.slice(5))].body];
          const cs = Math.cos(d.ry), sn = Math.sin(d.ry), grow = 1 + GROW.houseWide * 3;
          // O ponto (a, b) em [-1, 1]² de um retângulo de meia-largura `k` vezes a da parede.
          const at = (k: number, a: number, b: number): P => {
            const u = a * body.w * d.sx * k, v = b * body.d * d.sz * k;
            return [d.x + u * cs + v * sn, d.z - u * sn + v * cs];
          };
          const where = `${theme.id} semente ${seed} ${mode} ${p.q},${p.r} ${d.key}`;
          const floor = d.y;
          // 1. o chão sob a casa crescida
          let low = Infinity, over = -Infinity;
          const GRID = 24;
          for (let i = 0; i <= GRID; i++) {
            for (let j = 0; j <= GRID; j++) {
              const [x, z] = at(0.5 * grow, (2 * i) / GRID - 1, (2 * j) / GRID - 1);
              const y = surface.at(x, z);
              over = Math.max(over, y - floor);
              low = Math.min(low, y);
            }
          }
          maxOver = Math.max(maxOver, over);
          if (over > TOL) complain(`${where}: o chão passa do piso em ${over.toFixed(3)} (piso ${floor.toFixed(3)})`);
          if (floor - low < FOOT_SEE) continue;
          plinths++;
          tallest = Math.max(tallest, floor - low);
          heights.push(floor - low);
          // 2. a geometria da fundação: os triângulos soltos depois do chão, dentro do retângulo da fundação
          const corner = (a: number, b: number) => at(FOOT_HALF, a, b);
          const rect = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
          const near = (x: number, z: number) => rect.some(([rx, rz]) => Math.hypot(rx - x, rz - z) < 2e-4) ||
            rect.some((a, k) => {
              const b = rect[(k + 1) % 4], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
              const t = ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (l * l);
              return t >= -1e-3 && t <= 1 + 1e-3 && Math.abs((x - a[0]) * (b[1] - a[1]) - (z - a[1]) * (b[0] - a[0])) / l < 2e-4;
            });
          const tops: [P, P, P][] = [];
          const sideBase = [Infinity, Infinity, Infinity, Infinity];
          for (let i = tile.groundEnd; i < tile.pos.length; i += 9) {
            const v = [0, 3, 6].map((o) => [tile.pos[i + o], tile.pos[i + o + 1], tile.pos[i + o + 2]]);
            if (!v.every(([x, , z]) => near(x, z))) continue;
            if (v.every(([, y]) => Math.abs(y - floor) < 1e-5)) {
              tops.push([[v[0][0], v[0][2]], [v[1][0], v[1][2]], [v[2][0], v[2][2]]]);
              continue;
            }
            // Parede vertical de um lado do bloco: os três vértices sobre a mesma aresta do retângulo.
            for (let k = 0; k < 4; k++) {
              const a = rect[k], b = rect[(k + 1) % 4], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
              if (v.every(([x, , z]) => Math.abs((x - a[0]) * (b[1] - a[1]) - (z - a[1]) * (b[0] - a[0])) / l < 2e-4)) {
                sideBase[k] = Math.min(sideBase[k], ...v.map(([, y]) => y));
              }
            }
          }
          const inside = ([x, z]: P) => tops.some(([a, b, c]) => {
            const s = (p: P, q: P) => (q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0]);
            const w0 = s(a, b), w1 = s(b, c), w2 = s(c, a);
            return (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) || (w0 <= 1e-6 && w1 <= 1e-6 && w2 <= 1e-6);
          });
          for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]]) {
            if (!inside(at(0.5 * grow, a, b))) complain(`${where}: o topo da fundação não cobre a casa em (${a}, ${b})`);
          }
          // Nenhum decalque (rua, parcela, praça) fura o topo da pedra dentro do retângulo da fundação.
          for (let i = tile.groundEnd; i < tile.pos.length; i += 9) {
            const v = [0, 3, 6].map((o) => [tile.pos[i + o], tile.pos[i + o + 1], tile.pos[i + o + 2]]);
            if (isBlock(v)) continue; // o bloco de pedra de uma casa
            for (const [x, y, z] of v) {
              const dx = x - d.x, dz = z - d.z, u = dx * cs + -dz * sn, w = dx * sn + dz * cs;
              if (Math.abs(u) < body.w * d.sx * FOOT_HALF - 1e-4 && Math.abs(w) < body.d * d.sz * FOOT_HALF - 1e-4 && y > floor + 1e-4) complain(`${where}: decalque ${(y - floor).toFixed(3)} acima do topo da fundação`);
            }
          }
          // Nada de decoração enterrada sob o piso: o que nasce do chão não fica sobre a pedra e o resto não afunda nela.
          for (const o of tile.decos) {
            if (o === d || o.key.startsWith('wall:') || o.key.startsWith('roof:')) continue;
            const dx = o.x - d.x, dz = o.z - d.z;
            const within = Math.abs(dx * cs - dz * sn) < body.w * d.sx * FOOT_HALF - 1e-4 && Math.abs(dx * sn + dz * cs) < body.d * d.sz * FOOT_HALF - 1e-4;
            // O que se move não nasce sobre a pedra nem ganha o piso (a `Life` soma a altura do chão: contaria em dobro).
            if (within && o.anim) complain(`${where}: ${o.key} (anim) dentro da fundação`);
            if (within && o.y < floor - 1e-4) complain(`${where}: ${o.key} sobre a fundação, ${(floor - o.y).toFixed(3)} abaixo do piso`);
          }
          // Em volta da fundação o decalque não escala o arrimo: nenhum triângulo (fora do retângulo, que fica sob a pedra) tem os vértices
          // em cotas de chão mais de DRAPE_STEP distantes, que o vê em pé como uma lasca solta.
          for (let i = tile.groundEnd; i < tile.pos.length; i += 9) {
            const v = [0, 3, 6].map((o) => [tile.pos[i + o], tile.pos[i + o + 1], tile.pos[i + o + 2]]);
            if (isBlock(v)) continue;
            const cx = (v[0][0] + v[1][0] + v[2][0]) / 3 - d.x, cz = (v[0][2] + v[1][2] + v[2][2]) / 3 - d.z;
            if (Math.abs(cx * cs - cz * sn) > body.w * d.sx * FOOT_HALF + DRAPE_RING - 0.01 || Math.abs(cx * sn + cz * cs) > body.d * d.sz * FOOT_HALF + DRAPE_RING - 0.01) continue;
            if (v.some(([x, , z]) => Math.abs((x - d.x) * cs - (z - d.z) * sn) <= body.w * d.sx * FOOT_HALF + 1e-4 && Math.abs((x - d.x) * sn + (z - d.z) * cs) <= body.d * d.sz * FOOT_HALF + 1e-4)) continue;
            // Os degraus das ruas (villageAccess, desenhados depois do drape) são pisos horizontais e espelhos verticais: não são decalque deitado.
            if (v.every(([, y]) => Math.abs(y - v[0][1]) < 1e-6) || v.some((p, k) => v.some((q, j) => j !== k && Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[2] - q[2]) < 1e-6))) continue;
            const r = v.map(([x, , z]) => surface.at(x, z));
            if (Math.max(...r) - Math.min(...r) > DRAPE_STEP + 1e-3) complain(`${where}: decalque escala o arrimo (${(Math.max(...r) - Math.min(...r)).toFixed(3)})`);
          }
          for (let k = 0; k < 4; k++) {
            const a = rect[k], b = rect[(k + 1) % 4];
            let sideLow = Infinity;
            for (let i = 0; i <= 32; i++) sideLow = Math.min(sideLow, surface.at(a[0] + ((b[0] - a[0]) * i) / 32, a[1] + ((b[1] - a[1]) * i) / 32));
            if (floor - sideLow < FOOT_SEE) continue;
            walls++;
            if (!(sideBase[k] < sideLow)) complain(`${where}: lado ${k} sem parede abaixo do chão (base ${sideBase[k].toFixed(3)}, chão ${sideLow.toFixed(3)})`);
          }
        }
      }
    }
  }
}
if (bad) {
  console.error(rows.join('\n'));
  assert.fail(`fundações: ${bad} falhas em ${houses} casas`);
}
heights.sort((a, b) => a - b);
const pct = (q: number) => heights[Math.floor(q * (heights.length - 1))].toFixed(3);
console.log(`blocos: p50 ${pct(0.5)}, p90 ${pct(0.9)}, p99 ${pct(0.99)}, > 0,15: ${heights.filter((h) => h > 0.15).length}`);
console.log(`fundações ok: ${houses} casas, ${plinths} com bloco de pedra, ${walls} paredes abaixo do chão; o chão nunca passa do piso (maior folga ${maxOver.toFixed(4)}); bloco mais alto ${tallest.toFixed(3)}`);
