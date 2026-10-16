// Teste às cegas: qual ilha (1 ou 2) é a versão A e qual é a B. O sorteio vale por aparelho e fica em localStorage;
// se o armazenamento falhar (janela privada, bloqueio), vale um sorteio por sessão. Nada daqui vai para a interface.
export type Variant = 'A' | 'B';

const KEY = 'lanternas.ab';
let session: Variant | null = null;

/** Versão que a "Ilha 1" tem neste aparelho (a "Ilha 2" é a outra). */
export function island1Variant(): Variant {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'A' || v === 'B') return v;
  } catch { /* sem armazenamento: cai no sorteio da sessão */ }
  if (!session) session = Math.random() < 0.5 ? 'A' : 'B';
  try { localStorage.setItem(KEY, session); } catch { /* ignora */ }
  return session;
}

export function variantOf(island: 1 | 2): Variant {
  const a = island1Variant();
  return island === 1 ? a : a === 'A' ? 'B' : 'A';
}

export function islandOf(v: Variant): 1 | 2 { return variantOf(1) === v ? 1 : 2; }

/** Gancho `?ab=A|B`: só para depuração e capturas; pula a tela de escolha. */
export function debugVariant(params: URLSearchParams): Variant | null {
  const v = params.get('ab');
  return v === 'A' || v === 'B' ? v : null;
}
