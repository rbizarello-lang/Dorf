// Roda toda a bateria de simulações dos Recortes, 4 processos por vez.
//   node run-all.mjs <pasta-de-saída> [filtro]
// Cada execução grava <pasta>/<nome>.json (ver tabela.mjs para ler).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
const filter = process.argv[3] ?? '';
mkdirSync(out, { recursive: true });

const jobs = [];
const add = (name, games, args, cost) => jobs.push({ name, args: [...args, '--games', String(games), '--label', name], cost: cost * games });
const FIT = JSON.stringify({ fitPts: 4, gulfPts: 16, gulfCap: 60 });

// A: base (contato mínimo 0,5 lado), duas jogadoras, três famílias.
for (const fam of ['ii', 'i30', 'i15'])
  for (const pl of ['greedy', 'top3']) add(`A-${fam}-${pl}`, 300, ['--fam', fam, '--player', pl, '--forgive', 'discard'], fam === 'ii' ? 4 : 1);

// B: rigor do encaixe (contato mínimo) e regras de perdão, jogador guloso.
for (const fam of ['ii', 'i30']) {
  const g = fam === 'ii' ? 120 : 300;
  const k = fam === 'ii' ? 3 : 1;
  for (const c of fam === 'ii' ? ['0.75', '1.0', '1.5'] : ['1.0', '1.5']) {
    const base = ['--fam', fam, '--player', 'greedy', '--minContact', c];
    add(`B-${fam}-c${c}-descarte`, g, [...base, '--forgive', 'discard'], k);
    if (c === '0.75') continue;
    add(`B-${fam}-c${c}-remendo`, g, [...base, '--forgive', 'patch'], k);
    add(`B-${fam}-c${c}-remendo-ima`, g, [...base, '--forgive', 'patch', '--magnet', '1'], k);
    add(`B-${fam}-c${c}-remendo-ima-fendas`, g, [...base, '--forgive', 'patch', '--magnet', '1', '--patchSlits', '4'], k * 1.3);
  }
}
for (const [n, extra] of [['descarte', ['--forgive', 'discard']], ['remendo-ima', ['--forgive', 'patch', '--magnet', '1']]])
  add(`B-i15-c1.0-${n}`, 300, ['--fam', 'i15', '--player', 'greedy', '--minContact', '1.0', ...extra], 1);

// C: pontuação que premia o encaixe justo (qualquer costa que encosta + golfo mais valioso).
for (const fam of ['ii', 'i30'])
  for (const pl of ['greedy', 'top3']) add(`C-${fam}-${pl}-encaixe`, fam === 'ii' ? 120 : 300, ['--fam', fam, '--player', pl, '--forgive', 'discard', '--world', FIT], fam === 'ii' ? 3 : 1);

// D: todas as poses válidas (sem o corte em P), para contar a riqueza sem o teto.
for (const fam of ['ii', 'i30', 'i15']) add(`D-${fam}-todas`, fam === 'ii' ? 40 : 60, ['--fam', fam, '--player', 'greedy', '--forgive', 'discard', '--exhaustive', '1'], fam === 'ii' ? 9 : 3);

// E: tamanho da lista de poses.
for (const P of ['24', '64']) {
  for (const pl of ['greedy', 'top3']) add(`E-i30-${pl}-P${P}`, 150, ['--fam', 'i30', '--player', pl, '--forgive', 'discard', '--P', P], 1);
  add(`E-ii-greedy-P${P}`, 80, ['--fam', 'ii', '--player', 'greedy', '--forgive', 'discard', '--P', P], 3);
}

const todo = jobs.filter((j) => j.name.includes(filter)).sort((a, b) => b.cost - a.cost);
let running = 0, idx = 0, done = 0;
const t0 = Date.now();
function next() {
  while (running < 4 && idx < todo.length) {
    const j = todo[idx++];
    const file = join(out, `${j.name}.json`);
    if (existsSync(file)) {
      done++;
      continue;
    }
    running++;
    const p = spawn('node', [join(here, 'sim.mjs'), ...j.args, '--out', file], { stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('exit', (code) => {
      running--;
      done++;
      console.log(`[${((Date.now() - t0) / 60000).toFixed(1)} min] ${done}/${todo.length} ${j.name} (código ${code})`);
      next();
    });
  }
}
console.log(`${todo.length} execuções`);
next();
