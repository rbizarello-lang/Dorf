// Guardar com segurança: pede ao navegador que não apague os dados e leva o progresso para um
// arquivo .json e de volta. Módulo isolado, sem dependência do jogo: copie para outros jogos.
// Só toca nas chaves do localStorage que começam com o prefixo informado.

export interface Backup {
  app: string;
  v: number;
  /** Quando foi exportado (ISO 8601). */
  at: string;
  data: Record<string, string>;
}

/** Armazenamento mínimo (o localStorage serve; os testes passam um falso). */
export interface KeyStore {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export const BACKUP_VERSION = 1;
/** Tamanho máximo de um valor importado (UTF-16). Uma partida de 1000 jogadas fica bem abaixo. */
export const MAX_VALUE = 1_000_000;
export const MAX_KEYS = 200;

/**
 * Pede ao navegador armazenamento persistente (o localStorage não é varrido sob pouco espaço).
 * Chame depois da primeira partida acabada, quando já há o que perder. Devolve se foi concedido.
 */
export async function persist(): Promise<boolean> {
  try {
    const s = navigator.storage;
    if (!s?.persist) return false;
    if (await s.persisted?.()) return true;
    return await s.persist();
  } catch {
    return false;
  }
}

/** Reúne todas as chaves com o prefixo num objeto serializável. */
export function exportKeys(prefix: string, app = prefix.replace(/\.$/, ''), store: KeyStore = localStorage, now = new Date()): Backup {
  const data: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k === null || !k.startsWith(prefix)) continue;
    const v = store.getItem(k);
    if (v !== null) data[k] = v;
  }
  return { app, v: BACKUP_VERSION, at: now.toISOString(), data };
}

/**
 * Valida o arquivo inteiro e só então grava. `validate(chave sem prefixo, valor)` devolve o valor a
 * gravar (o mesmo, ou uma versão limpa) ou null para recusar. Se qualquer campo falhar, nada é gravado.
 */
export function importKeys(
  json: unknown,
  prefix: string,
  validate: (key: string, value: string) => string | null = (_k, v) => v,
  store: KeyStore = localStorage,
  app = prefix.replace(/\.$/, ''),
): { ok: true; count: number } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  const b = json as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || Array.isArray(b)) return fail('O arquivo não é um backup.');
  if (b.app !== app) return fail('O arquivo é de outro jogo.');
  if (b.v !== BACKUP_VERSION) return fail('O backup é de uma versão que este jogo não conhece.');
  const data = b.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('O backup está sem dados.');
  const entries = Object.entries(data);
  if (entries.length > MAX_KEYS) return fail('O backup tem chaves demais.');
  const clean: [string, string][] = [];
  for (const [k, v] of entries) {
    if (!k.startsWith(prefix) || k.length === prefix.length) return fail(`Chave fora do jogo: ${k.slice(0, 40)}`);
    if (typeof v !== 'string') return fail(`Valor inválido em ${k}.`);
    if (v.length > MAX_VALUE) return fail(`Valor grande demais em ${k}.`);
    const ok = validate(k.slice(prefix.length), v);
    if (ok === null) return fail(`Dado inválido em ${k}.`);
    clean.push([k, ok]);
  }
  try {
    for (const [k, v] of clean) store.setItem(k, v);
  } catch {
    return fail('Não deu para gravar no navegador (espaço cheio?).');
  }
  return { ok: true, count: clean.length };
}
