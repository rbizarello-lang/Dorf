import { MERGED_THEMES } from './themes';

// Migração dos 14 temas para 5 (etapa T0). Módulo puro, sem DOM, para os testes rodarem em Node.

interface Store {
  get(k: string): string | null;
  set(k: string, v: string | null): void;
}

/** Um recorde guardado: só vale se pontos e semente forem inteiros seguros (como `loadBest` em main.ts). */
function parseBest(raw: string | null): { score: number; seed: number } | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as { score?: unknown; seed?: unknown } | null;
    if (v && typeof v === 'object' && Number.isSafeInteger(v.score) && Number.isSafeInteger(v.seed)) return { score: Math.max(0, v.score as number), seed: v.seed as number };
  } catch {
    // valor corrompido: é como se não houvesse recorde
  }
  return null;
}

/**
 * Passa o recorde `best.<modo>.<tema>` de cada tema fundido para o tema novo, ficando o maior (empate fica
 * com o que já estava no tema novo). A chave antiga é apagada: a migração roda uma vez, na leitura, e
 * repetir não muda nada. Os recordes dos temas que saíram sem herdeiro ficam guardados, sem uso.
 * Devolve quantas chaves antigas foram passadas.
 */
export function migrateBests(store: Store, modeIds: readonly string[]): number {
  let moved = 0;
  for (const mode of modeIds) {
    for (const [old, next] of Object.entries(MERGED_THEMES)) {
      const oldKey = `best.${mode}.${old}`;
      const raw = store.get(oldKey);
      if (raw === null) continue;
      const incoming = parseBest(raw);
      const newKey = `best.${mode}.${next}`;
      const current = parseBest(store.get(newKey));
      if (incoming && (!current || incoming.score > current.score)) store.set(newKey, JSON.stringify(incoming));
      store.set(oldKey, null);
      moved++;
    }
  }
  return moved;
}
