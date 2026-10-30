// Bancada de testes de encaixe (Fase 1 do plano Terra contínua). Joga uma regra de encaixe inteira, sem gráficos, com três estilos de
// jogador, e mede travamento, riqueza de decisão, profundidade, equilíbrio e tempo por jogada. Não entra no `npm run check`.
//
// Cada ideia é um PLUGIN (`Rule`) com três partes, todas deriváveis da semente da partida:
//   1. o gerador de peça: `LiteWorld.makeTile(índice)` devolve as bordas do núcleo (a mesma sequência do `Game`) mais dados extras
//      por borda (`aux`: mistura de terrenos, altura, composição...), sempre de um gerador derivado da semente da peça;
//   2. a validade da jogada: `LiteWorld.compat(...)` (cada borda contra a vizinha);
//   3. os pontos de uma jogada sobre um estado: `LiteWorld.sim/pay/edgePts/extra` (o ganho imediato) e `onCommit` (o efeito no estado).
// As regras do próprio jogo (Clássico, Relevo) entram pelo `Game` do núcleo (`coreWorld.ts`), sem cópia da lógica.
// Quem joga (`players.ts`) só enxerga a interface `World` abaixo: a lista de jogadas com os pontos imediatos e o que vem depois delas.

/** Uma jogada: casa (q, r), giro e o ganho imediato (pontos que a bancada usa para ordenar as jogadas; não inclui peças extras). */
export interface Move {
  q: number;
  r: number;
  rot: number;
  pts: number;
}

/** O estado de uma partida sob uma regra. O mundo guarda a pilha e a sequência de peças: quem joga só escolhe jogadas. */
export interface World {
  readonly score: number;
  /** Peças colocadas (sem a do centro). */
  readonly placed: number;
  readonly discards: number;
  readonly stack: number;
  /** A pilha acabou. */
  over(): boolean;
  /** Todas as jogadas válidas da peça atual (validade + pontos), em qualquer ordem. Vazio = peça travada. */
  moves(): Move[];
  /** Joga a peça atual; devolve os pontos reais da jogada (os do jogo, com tudo). */
  play(m: Move): number;
  /** A peça atual não cabe em lugar nenhum: descarta. */
  discard(): void;
  /** As jogadas da peça seguinte (que o jogo mostra) depois de `m`. Não mexe neste mundo. Vazio se não houver peça seguinte ou ela travar. */
  after(m: Move): Move[];
  /** Só nos mundos leves: pontos da partida que vieram do termo próprio da ideia (umidade, área, água...), por nome. */
  parts?(): Record<string, number>;
  /** Só nos mundos do núcleo: a jogada da IA do jogo (`Game.bestMove`), para conferir com o `tests/balance.ts`. */
  native?(rand: () => number): Move | null;
}

export interface Rule {
  id: string;
  name: string;
  /** Uma frase: o que a regra muda. */
  blurb: string;
  /** Regra de referência para a "média relativa" (mesmos temas de pontuação: o Clássico cheio, o base ou o Relevo base). */
  baseline: string;
  /** O mundo da partida de semente `seed`. */
  create(seed: number): World;
}

/** Um jogador: escolhe uma das jogadas (a lista nunca vem vazia). Pode olhar adiante com `w.after`. */
export interface Player {
  id: 'guloso' | 'planejador' | 'distraido';
  name: string;
  choose(w: World, moves: Move[], rng: () => number): Move;
}
