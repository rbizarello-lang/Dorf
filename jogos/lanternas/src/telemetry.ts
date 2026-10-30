// Telemetria local do teste às cegas. Tudo fica só neste aparelho (localStorage); nada sai pela rede.
// Uma partida = um registro, com o id anônimo do aparelho, a ilha (1 ou 2), a versão real (A ou B), a semente, a hora de
// início e de fim e, por turno, o que foi oferecido, o que foi escolhido, onde, em quantos segundos e se havia dica.
// O texto exportado mostra a versão real: exporte só no fim do teste.
export type Variant = 'A' | 'B';

export interface TurnRec {
  /** Número do turno (1 a 30). */
  t: number;
  /** Peças oferecidas, por nome. */
  oferecidas: string[];
  /** Peça escolhida (nome) ou null se o turno foi só um descarte. */
  escolhida: string | null;
  /** Hexágono (q, r) ou null (descarte). */
  lugar: [number, number] | null;
  /** Segundos até decidir, contando só o tempo com a aba à vista. */
  segundos: number;
  /** Havia uma dica de uma linha na tela durante este turno. */
  dica: boolean;
  desfez: boolean;
  descartou: boolean;
  /** Sopros do vento dados neste turno (só a versão com vento). */
  sopros?: number;
}

export interface GameRec {
  id: number;
  ilha: 1 | 2;
  versao: Variant;
  semente: number;
  inicio: string;
  fim: string | null;
  terminou: boolean;
  /** Fechou a página ou saiu (nova partida, outra ilha) antes do fim. */
  abandonada: boolean;
  /** Depois de terminar esta, o jogador começou outra partida (na mesma ilha ou em outra); false se não começou. */
  recomecou: false | 'mesma-ilha' | 'outra-ilha';
  /** Esta partida começou depois de o jogador terminar a anterior. */
  veioDeFim: boolean;
  pontos: number | null;
  turnos: TurnRec[];
}

interface Store { v: 1; aparelho: string; partidas: GameRec[] }

const KEY = 'lanternas.registro';
const MAX_GAMES = 20;

function randId(): string {
  const a = new Uint8Array(8);
  try { crypto.getRandomValues(a); } catch { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let memory: Store | null = null;       // cópia da sessão (vale também se o armazenamento falhar)

function load(): Store {
  if (memory) return memory;
  let st: Store | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw) as Store;
      if (o && o.v === 1 && typeof o.aparelho === 'string' && Array.isArray(o.partidas)) st = o;
    }
  } catch { /* corrompido ou bloqueado: recomeça */ }
  if (!st) st = { v: 1, aparelho: randId(), partidas: [] };
  // Partidas de uma visita anterior que ficaram sem fim: o jogador fechou a página.
  for (const g of st.partidas) if (!g.terminou && !g.abandonada) g.abandonada = true;
  memory = st;
  save();
  return st;
}

function save(): void {
  if (!memory) return;
  while (memory.partidas.length > MAX_GAMES) memory.partidas.shift();
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* sem armazenamento: fica só na sessão */ }
}

class Telemetry {
  private cur: GameRec | null = null;
  private turn: { t: number; oferecidas: string[]; at: number; hint: boolean; sopros: number } | null = null;
  private waited = 0;            // ms com a aba escondida dentro do turno
  private hiddenAt = 0;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.hiddenAt = performance.now();
        // Se a página for fechada agora, a partida conta como abandonada; se voltar, desfaz.
        if (this.cur && !this.cur.terminou) { this.cur.abandonada = true; this.cur.fim = new Date().toISOString(); save(); }
      } else {
        if (this.hiddenAt) { this.waited += performance.now() - this.hiddenAt; this.hiddenAt = 0; }
        if (this.cur && !this.cur.terminou) { this.cur.abandonada = false; this.cur.fim = null; save(); }
      }
    });
    addEventListener('pagehide', () => {
      if (this.cur && !this.cur.terminou) { this.cur.abandonada = true; this.cur.fim = new Date().toISOString(); save(); }
    });
    addEventListener('pageshow', (e) => {
      if (e.persisted && this.cur && !this.cur.terminou) { this.cur.abandonada = false; this.cur.fim = null; save(); }
    });
  }

  /** Começa o registro de uma partida; a anterior, se não terminou, vira abandonada. */
  begin(ilha: 1 | 2, versao: Variant, semente: number): void {
    const st = load();
    if (this.cur && !this.cur.terminou) { this.cur.abandonada = true; this.cur.fim = new Date().toISOString(); }
    // A anterior pode ser de uma visita passada (a página recarrega ao trocar de ilha): vale o que está guardado.
    const last = st.partidas[st.partidas.length - 1];
    const veioDeFim = !!last && last.terminou;
    if (last && last.terminou) last.recomecou = last.ilha === ilha ? 'mesma-ilha' : 'outra-ilha';
    this.cur = {
      id: (st.partidas.length ? Math.max(...st.partidas.map((g) => g.id)) : 0) + 1,
      ilha, versao, semente, inicio: new Date().toISOString(), fim: null,
      terminou: false, abandonada: false, recomecou: false, veioDeFim, pontos: null, turnos: [],
    };
    st.partidas.push(this.cur);
    this.turn = null;
    save();
  }

  /** Uma mão nova apareceu: começa a contar o tempo do turno. */
  offer(t: number, oferecidas: string[]): void {
    if (!this.cur) return;
    this.turn = { t, oferecidas, at: performance.now(), hint: false, sopros: 0 };
    this.waited = 0; this.hiddenAt = document.hidden ? performance.now() : 0;
  }

  /** Havia uma dica na tela neste turno. */
  hint(): void { if (this.turn) this.turn.hint = true; }
  wind(): void { if (this.turn) this.turn.sopros++; }

  private seconds(): number {
    if (!this.turn) return 0;
    const hidden = this.waited + (this.hiddenAt ? performance.now() - this.hiddenAt : 0);
    return Math.max(0, Math.round((performance.now() - this.turn.at - hidden) / 100) / 10);
  }

  private push(escolhida: string | null, lugar: [number, number] | null, descartou: boolean): void {
    if (!this.cur || !this.turn) return;
    const r: TurnRec = { t: this.turn.t, oferecidas: this.turn.oferecidas, escolhida, lugar, segundos: this.seconds(), dica: this.turn.hint, desfez: false, descartou };
    if (this.turn.sopros) r.sopros = this.turn.sopros;
    this.cur.turnos.push(r);
    this.turn = null;
    save();
  }

  play(escolhida: string, q: number, r: number): void { this.push(escolhida, [q, r], false); }
  discard(escolhida: string): void { this.push(escolhida, null, true); }

  /** A partida acabou (a noite caiu). */
  finish(pontos: number): void {
    if (!this.cur) return;
    this.cur.terminou = true; this.cur.abandonada = false; this.cur.fim = new Date().toISOString(); this.cur.pontos = pontos;
    save();
  }

  /** Marca a saída para a escolha de outra ilha. */
  leave(): void {
    if (this.cur && !this.cur.terminou) { this.cur.abandonada = true; this.cur.fim = new Date().toISOString(); save(); }
  }

  /** Texto JSON da sessão (as últimas 20 partidas). */
  exportText(): string {
    const st = load();
    return JSON.stringify({
      app: 'ilha-das-lanternas', formato: 1, aparelho: st.aparelho, exportadoEm: new Date().toISOString(),
      leia: 'ilha = o que a pessoa viu (1 ou 2); versao = A ou B de verdade; segundos = tempo até decidir; dica = havia dica na tela.',
      partidas: st.partidas,
    }, null, 1);
  }
}

export const telemetry = new Telemetry();
