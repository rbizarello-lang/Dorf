// Botões de calibração das regras. Cada regra tem os seus números no topo do arquivo; para testar outros sem editar código:
//   BENCH_KNOBS='{"terra":{"patchK":6,"payFloor":0.35},"orvalho":{"fitIn":5}}' npm run bench -- terra,orvalho 60
// Só aceita chaves que a regra já tem e valores numéricos (o resto é ignorado com um aviso). Os fios de trabalho herdam o ambiente.
export function knobs<T extends Record<string, number>>(rule: string, defaults: T): T {
  const out = { ...defaults };
  const raw = process.env.BENCH_KNOBS;
  if (!raw) return out;
  let over: Record<string, Record<string, unknown>>;
  try {
    over = JSON.parse(raw);
  } catch {
    throw new Error('BENCH_KNOBS não é um JSON válido');
  }
  for (const [k, v] of Object.entries(over[rule] ?? {})) {
    if (!(k in defaults) || typeof v !== 'number' || !Number.isFinite(v)) {
      console.error(`BENCH_KNOBS: "${rule}.${k}" ignorado (chaves de ${rule}: ${Object.keys(defaults).join(', ')})`);
      continue;
    }
    (out as Record<string, number>)[k] = v;
  }
  return out;
}
