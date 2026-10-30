// Bancada de testes de encaixe: `npm run bench -- <regras> [partidas]`.
//   <regras>   `todas` ou uma lista separada por vírgulas de ids: classico, base, relevo, relevo-base, aquarela, orvalho, argila, fluxo, terra
//              (também base-lite e relevo-lite, os gêmeos do motor leve, só para conferir). Padrão: todas.
//   [partidas] por regra e por jogador (sementes 1 a N). Padrão: 100.
//   --jogadores=guloso,planejador,distraido   quais jogam (padrão: os três)
//   --fios=N          fios em paralelo (padrão: núcleos − 1)
//   --saida=<pasta>   onde gravar RESULTADO.md e resultado.json (padrão: .cache/bench, ou a variável BENCH_OUT)
//   --sem-ref         não joga as regras de referência (nem o Clássico): só o que foi pedido, para varreduras de calibração
//   --relatorio       só refaz o RESULTADO.md a partir do resultado.json da pasta (e do leitura.md, se houver), sem jogar de novo
//   --verifica[=N]    (N partidas, padrão 40) confere o motor leve contra o núcleo e a coerência de cada regra (não joga o painel)
//   --paridade[=N]    confere a IA do jogo no Clássico contra o laço do tests/balance.ts (N partidas, padrão 30)
// Não entra no `npm run check`. A mesma linha de comando dá a mesma tabela (sementes fixas; o distraído usa gerador de semente fixa).
// Os trabalhos (regra × jogador) rodam em paralelo, um por núcleo da máquina.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { ALL_PLAYERS, PLAYERS } from './players';
import { ALL, BY_ID } from './rules/index';
import { playGame, type GameRec } from './sim';
import { paired, summarize, type Summary } from './stats';
import { parity, verifyAll } from './verifica';

/** Um pedaço do trabalho: as partidas de semente `from` a `to` de uma regra com um jogador (pedaços pequenos equilibram a carga entre os fios). */
interface Job {
  rule: string;
  player: string;
  from: number;
  to: number;
}
interface Done {
  job: Job;
  recs: GameRec[];
  seconds: number;
}

function runJob(job: Job): Done {
  const rule = BY_ID.get(job.rule)!;
  const player = ALL_PLAYERS.find((p) => p.id === job.player)!;
  const t0 = performance.now();
  const recs: GameRec[] = [];
  for (let seed = job.from; seed <= job.to; seed++) recs.push(playGame(rule, player, seed));
  return { job, recs, seconds: (performance.now() - t0) / 1000 };
}

// ------------------------------------------------------------------ painel

const num = (x: number, d = 0) => x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x: number, d = 0) => `${x >= 0 ? '+' : ''}${num(100 * x, d)}%`;

async function runAll(jobs: Job[], threads: number): Promise<Done[]> {
  const n = Math.max(1, Math.min(threads, jobs.length));
  const queue = jobs.slice();
  const results: Done[] = [];
  const url = fileURLToPath(import.meta.url);
  const started = Date.now();
  await Promise.all(
    Array.from({ length: n }, () =>
      new Promise<void>((resolve, reject) => {
        const w = new Worker(url);
        const next = () => {
          const job = queue.shift();
          if (!job) {
            void w.terminate();
            resolve();
          } else w.postMessage(job);
        };
        w.on('message', (d: Done) => {
          results.push(d);
          process.stderr.write(`  ${d.job.rule} · ${d.job.player} ${d.job.from}-${d.job.to}: ${num(d.seconds, 1)} s (${results.length}/${jobs.length}, ${num((Date.now() - started) / 1000)} s)\n`);
          next();
        });
        w.on('error', reject);
        next();
      }),
    ),
  );
  return results;
}

interface RuleRow {
  id: string;
  name: string;
  blurb: string;
  baseline: string;
  by: Record<string, Summary>;
  /** Planejador menos guloso, pareado por semente. */
  depth: { mean: number; se: number; rel: number; wins: number } | null;
  /** Planejador de 3 peças menos guloso (só se jogou: `--jogadores=...,planejador3`). */
  depth3?: { mean: number; se: number; rel: number; wins: number } | null;
  /** Distraído menos guloso. */
  slip: { mean: number; se: number; rel: number; wins: number } | null;
}

function table(head: string[], rows: string[][]): string {
  return [`| ${head.join(' | ')} |`, `|${head.map((_, i) => (i === 0 ? '---' : '---:')).join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

const mark = (ok: boolean) => (ok ? '✓' : '✗');

function report(rows: RuleRow[], games: number, wall: number, threads: number, leitura: string): string {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const G = (r: RuleRow) => r.by.guloso;
  const ref = (r: RuleRow) => byId.get(r.baseline) ?? r;
  const classico = byId.get('classico');
  const baseRow = byId.get('base');
  const L: string[] = [];
  L.push('# Bancada de testes de encaixe: resultado', '');
  L.push(
    `${games} partidas por regra e por jogador, sementes 1 a ${games}, tema Holanda Dourada, sem peças especiais; a carta da era é sempre a primeira. Gerado por \`npm run bench -- todas ${games}\` em ${num(wall / 60, 1)} min (${threads} fios).`,
    'Mesma semente = mesma sequência de peças para todo jogador e toda regra (o gerador de peças é o do núcleo). O distraído usa gerador de semente fixa.',
    '',
  );
  L.push('## Quem joga', '');
  L.push('- **guloso**: a melhor jogada imediata (os pontos da própria jogada).');
  L.push('- **planejador**: olha a peça seguinte, que o jogo mostra, em profundidade 2; expande só as 8 melhores jogadas imediatas (poda por largura) e para quando uma jogada mais fraca não alcançaria a melhor mesmo somando o maior ganho possível da próxima peça.');
  L.push('- **distraído**: escolhe ao acaso entre as 3 melhores jogadas imediatas.', '');
  L.push('## As regras', '');
  for (const r of rows) L.push(`- **${r.name}** (\`${r.id}\`, referência \`${r.baseline}\`): ${r.blurb}`);
  L.push(
    '',
    'As regras do núcleo (`classico`, `relevo`, `base`, `relevo-base`) rodam pelo `Game` do próprio jogo. As ideias novas (Aquarela, Orvalho, Argila, Fluxo, Terra contínua) rodam no motor leve da bancada, conferido contra o núcleo jogada a jogada (`--verifica`). ' +
      'Como o motor leve só mexe no encaixe, elas se comparam com a **referência**: o Clássico base (encaixe, perfeito, cerco e interações, sem missões, eras, sítios nem cartas) ou, as que têm água e relevo, o Relevo base. O Clássico cheio tem missões e eras que somam pontos e peças, então a média dele é bem maior.',
    '',
  );

  L.push('## 1. Equilíbrio (meta do plano: média, p10 e p90 a ±10% da referência)', '');
  L.push(
    table(
      ['Regra', 'Jogador', 'Média', 'p10', 'p50', 'p90', 'Peças', 'Média ÷ ref.', 'p10 ÷ ref.', 'p90 ÷ ref.', '±10%', 'Média ÷ base', 'Média ÷ Clássico'],
      rows.flatMap((r) =>
        ['guloso', 'planejador'].filter((p) => r.by[p]).map((p) => {
          const s = r.by[p], b = ref(r).by[p];
          const rel = (x: number, y: number) => (y ? x / y : NaN);
          const m = rel(s.score.mean, b.score.mean), lo = rel(s.score.p10, b.score.p10), hi = rel(s.score.p90, b.score.p90);
          const same = r.id === r.baseline;
          const ok = [m, lo, hi].every((x) => Math.abs(x - 1) <= 0.1);
          return [r.name, p, num(s.score.mean), num(s.score.p10), num(s.score.p50), num(s.score.p90), num(s.placed.mean, 0), same ? '(ref.)' : pct(m - 1), same ? '(ref.)' : pct(lo - 1), same ? '(ref.)' : pct(hi - 1), same ? '' : mark(ok), baseRow?.by[p] ? pct(s.score.mean / baseRow.by[p].score.mean - 1) : '', classico && classico.by[p] ? pct(s.score.mean / classico.by[p].score.mean - 1) : ''];
        }),
      ),
    ),
    '',
  );

  const origin = rows.filter((r) => G(r) && Object.keys(G(r).parts).length);
  if (origin.length) {
    L.push('### De onde vêm os pontos do termo novo (jogador guloso, média por partida)', '');
    L.push(
      table(
        ['Regra', 'Termo', 'Pontos/partida', '% da média'],
        origin.flatMap((r) => Object.entries(G(r).parts).map(([k, v]) => [r.name, k, num(v, 0), `${num((100 * v) / G(r).score.mean, 1)}%`])),
      ),
      '',
    );
  }

  L.push('## 2. Riqueza de decisão e profundidade', '');
  L.push(
    '- **Boas**: nas decisões em que a melhor jogada vale mais que 0, quantas jogadas valem pelo menos 90% da melhor (entre parênteses, em quantas casas diferentes). Muitas = muitas saídas boas e diferentes.',
    '- **Folga**: distância relativa entre a melhor jogada e a mediana, (melhor − mediana) ÷ melhor. Alta = a escolha pesa; baixa = tanto faz.',
    '- **Em jogo**: pontos da melhor jogada, em média, nas decisões que contam (o peso de cada escolha).',
    '- **Vazias**: % das decisões (2 ou mais jogadas) em que a melhor vale 0: escolher não muda nada. **Forçadas**: só uma jogada possível.',
    '- **Profundidade**: quanto o planejador ganha do guloso, pareado por semente (diferença média ± erro padrão, e em % da média do guloso). **Distraído**: o quanto se perde escolhendo ao acaso entre as 3 melhores.',
    '',
  );
  const any3 = rows.some((r) => r.depth3);
  const depthCell = (d: RuleRow['depth']) => (d ? `${d.mean >= 0 ? '+' : ''}${num(d.mean, 0)} ± ${num(d.se, 0)} (${pct(d.rel, 1)}; ganha em ${num(100 * d.wins, 0)}%)` : '-');
  L.push(
    table(
      ['Regra', 'Opções/jogada', 'Boas (casas)', 'Folga', 'Em jogo', 'Vazias', 'Forçadas', 'Profundidade (planej. − guloso; % das sementes em que ganha)', ...(any3 ? ['Profundidade com 3 peças'] : []), 'Distraído − guloso'],
      rows.filter((r) => G(r)).map((r) => {
        const g = G(r).rich;
        return [r.name, num(g.options, 0), `${num(g.good, 1)} (${num(g.goodCells, 1)})`, `${num(100 * g.gap, 0)}%`, `${num(g.stake, 0)} pts`, `${num(g.emptyPct, 1)}%`, `${num(g.forcedPct, 1)}%`, depthCell(r.depth), ...(any3 ? [depthCell(r.depth3 ?? null)] : []), r.slip ? pct(r.slip.rel, 1) : '-'];
      }),
    ),
    '',
  );

  L.push('## 3. Travamento e tempo', '');
  L.push('Travada = partida com pelo menos um descarte (a peça não coube em lugar nenhum e saiu da pilha). Tempo = escolher uma jogada (no PC desta máquina, um núcleo; serve para comparar custo entre regras, não como medida de desempenho do jogo).', '');
  L.push(
    table(
      ['Regra', 'Jogador', 'Travadas', 'Descartes/partida', 'ms/jogada'],
      rows.flatMap((r) => ALL_PLAYERS.filter((p) => r.by[p.id]).map((p) => [r.name, p.id, `${num(r.by[p.id].stuckPct, 1)}%`, num(r.by[p.id].discardsPerGame, 2), num(r.by[p.id].msPerMove, 2)])),
    ),
    '',
  );

  L.push('## 4. Quadro do plano: cada regra contra a referência', '');
  L.push(
    'Metas do plano: travamento ≤ referência; riqueza ≥ referência; profundidade ≥ referência; equilíbrio ±10%. A riqueza passa se **boas** e **folga** não caem mais de 5% e as **vazias** não sobem mais de 2 pontos percentuais. As metas de hexômetro e desempenho gráfico não se medem aqui.',
    '',
  );
  L.push(
    table(
      ['Regra', 'Travamento', 'Riqueza', 'Profundidade', 'Equilíbrio', 'Resumo'],
      rows
        .filter((r) => r.id !== r.baseline && G(r) && ref(r).by.guloso)
        .map((r) => {
          const g = G(r), b = ref(r).by.guloso;
          const dRef = ref(r).depth;
          const trav = g.stuckPct <= b.stuckPct + 1e-9;
          const rich = g.rich.good >= 0.95 * b.rich.good && g.rich.gap >= 0.95 * b.rich.gap && g.rich.emptyPct <= b.rich.emptyPct + 2;
          const depth = !!r.depth && !!dRef && r.depth.rel >= dRef.rel - 1e-9;
          const eq = [g.score.mean / b.score.mean, g.score.p10 / b.score.p10, g.score.p90 / b.score.p90].every((x) => Math.abs(x - 1) <= 0.1);
          return [r.name, `${mark(trav)} ${num(g.stuckPct, 1)}% × ${num(b.stuckPct, 1)}%`, `${mark(rich)} ${num(g.rich.good, 1)}/${num(100 * g.rich.gap, 0)}%/${num(g.rich.emptyPct, 0)}% × ${num(b.rich.good, 1)}/${num(100 * b.rich.gap, 0)}%/${num(b.rich.emptyPct, 0)}%`, `${mark(depth)} ${r.depth ? pct(r.depth.rel, 1) : '-'} × ${dRef ? pct(dRef.rel, 1) : '-'}`, `${mark(eq)} ${pct(g.score.mean / b.score.mean - 1)}`, `${[trav, rich, depth, eq].filter(Boolean).length}/4`];
        }),
    ),
    '',
    '(em cada célula: a regra × a referência; riqueza = boas / folga / vazias)',
    '',
  );

  L.push('## 5. Placar completo por regra e jogador', '');
  L.push(
    table(
      ['Regra', 'Jogador', 'Média', 'Desvio', 'p10', 'p50', 'p90', 'Peças (média)', 'Peças (p50)'],
      rows.flatMap((r) => ALL_PLAYERS.filter((p) => r.by[p.id]).map((p) => {
        const s = r.by[p.id];
        return [r.name, p.id, num(s.score.mean), num(s.score.sd), num(s.score.p10), num(s.score.p50), num(s.score.p90), num(s.placed.mean, 1), num(s.placed.p50)];
      })),
    ),
    '',
  );
  if (leitura) L.push(leitura.trim(), '');
  return L.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const pos = args.filter((a) => !a.startsWith('--'));
  const flag = (name: string) => flags.find((f) => f === `--${name}` || f.startsWith(`--${name}=`))?.split('=')[1];
  const has = (name: string) => flags.some((f) => f === `--${name}` || f.startsWith(`--${name}=`));

  if (has('verifica')) process.exit(verifyAll(Number(flag('verifica')) || 40) ? 0 : 1);
  if (has('paridade')) process.exit(parity(Number(flag('paridade')) || 30) ? 0 : 1);

  const outDir = flag('saida') ?? process.env.BENCH_OUT ?? '.cache/bench';
  if (has('relatorio')) {
    const j = JSON.parse(readFileSync(join(outDir, 'resultado.json'), 'utf8')) as { games: number; seconds: number; threads?: number; rules: RuleRow[] };
    const leituraFile = join(outDir, 'leitura.md');
    writeFileSync(join(outDir, 'RESULTADO.md'), report(j.rules, j.games, j.seconds, j.threads ?? 1, existsSync(leituraFile) ? readFileSync(leituraFile, 'utf8') : ''));
    process.stderr.write(`Refeito ${outDir}/RESULTADO.md\n`);
    return;
  }

  const wanted = !pos[0] || pos[0] === 'todas' ? ALL.map((r) => r.id) : pos[0].split(',');
  for (const id of wanted) if (!BY_ID.has(id)) throw new Error(`regra desconhecida: ${id} (as que existem: ${[...BY_ID.keys()].join(', ')})`);
  const games = pos[1] ? Number(pos[1]) : 100;
  if (!Number.isInteger(games) || games < 1) throw new Error(`número de partidas inválido: ${pos[1]}`);
  const players = (flag('jogadores') ?? PLAYERS.map((p) => p.id).join(',')).split(',');
  for (const p of players) if (!ALL_PLAYERS.some((x) => x.id === p)) throw new Error(`jogador desconhecido: ${p}`);
  // As referências entram sempre (a tabela compara com elas), e o planejador, o trabalho mais pesado, sai primeiro.
  // `--sem-ref` joga só o que foi pedido (para varreduras de calibração, que comparam com um resultado já gravado).
  const ids = new Set(wanted);
  if (!has('sem-ref')) {
    for (const id of wanted) ids.add(BY_ID.get(id)!.baseline);
    if (ids.has('relevo') || ids.has('terra') || ids.has('fluxo')) ids.add('classico');
  }
  const order = (id: string) => ALL.findIndex((r) => r.id === id);
  const rules = [...ids].sort((a, b) => order(a) - order(b));
  const chunk = Math.max(1, Math.min(10, Math.ceil(games / 4)));
  const jobs: Job[] = [];
  for (const p of ['planejador3', 'planejador', 'guloso', 'distraido'].filter((x) => players.includes(x))) for (let from = 1; from <= games; from += chunk) for (const r of rules) jobs.push({ rule: r, player: p, from, to: Math.min(games, from + chunk - 1) });
  const threads = Number(flag('fios')) || Math.max(1, cpus().length - 1);

  process.stderr.write(`Bancada: ${rules.length} regras × ${players.length} jogadores × ${games} partidas = ${jobs.length} pedaços em ${Math.min(threads, jobs.length)} fios\n`);
  const t0 = Date.now();
  const done = await runAll(jobs, threads);
  const wall = (Date.now() - t0) / 1000;

  const rows: RuleRow[] = rules.map((id) => {
    const rule = BY_ID.get(id)!;
    const by: Record<string, Summary> = {};
    for (const p of players) {
      const recs = done.filter((x) => x.job.rule === id && x.job.player === p).flatMap((x) => x.recs);
      if (recs.length) by[p] = summarize(id, p, recs);
    }
    const depth = by.guloso && by.planejador ? paired(by.guloso.scores, by.planejador.scores) : null;
    const depth3 = by.guloso && by.planejador3 ? paired(by.guloso.scores, by.planejador3.scores) : null;
    const slip = by.guloso && by.distraido ? paired(by.guloso.scores, by.distraido.scores) : null;
    return { id, name: rule.name, blurb: rule.blurb, baseline: rule.baseline, by, depth, depth3, slip };
  });

  mkdirSync(outDir, { recursive: true });
  const leituraFile = join(outDir, 'leitura.md');
  const leitura = existsSync(leituraFile) ? readFileSync(leituraFile, 'utf8') : '';
  const md = report(rows, games, wall, threads, leitura);
  writeFileSync(join(outDir, 'RESULTADO.md'), md);
  writeFileSync(join(outDir, 'resultado.json'), JSON.stringify({ games, seeds: [1, games], players, seconds: wall, threads, rules: rows }, null, 2));
  console.log(md);
  process.stderr.write(`Gravado em ${outDir}/RESULTADO.md e resultado.json (${num(wall / 60, 1)} min)\n`);
}

if (!isMainThread) {
  parentPort!.on('message', (job: Job) => parentPort!.postMessage(runJob(job)));
} else {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
