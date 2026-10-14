// Economia de quadros: com o jogo parado, desenha menos vezes por segundo (a GPU descansa e a
// bateria dura mais). Lógica pura, sem DOM (os testes rodam em Node, tests/video.ts).
//
// Parado de verdade = sem entrada de quem joga e sem nada se movendo por conta própria (peça
// caindo, câmera chegando, fantasma deslizando, troca de hora, onda de era). O mundo continua
// animado, só em menos quadros: o chamador passa a `dt` real decorrido ao `World.tick`
// (invariante 13 do AGENTS.md), então nada salta nem acelera ao voltar à taxa cheia.

/** Segundos sem entrada até cair para 30 qps. */
export const IDLE_30_MS = 4000;
/** Segundos sem entrada até cair para 20 qps. */
export const IDLE_20_MS = 15000;
export const FPS_IDLE = 30;
export const FPS_DEEP = 20;

export interface PacingState {
  /** Falso em gravação, foto, medição e testes de carga: a economia falsearia o que se mede. */
  enabled: boolean;
  /** Ms desde a última entrada (mouse, toque, tecla, roda). */
  idleMs: number;
  /** A janela tem o foco. */
  focused: boolean;
  /** Algo se move sozinho (peça caindo, câmera, fantasma, hora, onda de era). */
  busy: boolean;
}

/** Taxa-alvo em quadros por segundo; 0 = sem limite (a do monitor). */
export function targetFps(s: PacingState): number {
  if (!s.enabled) return 0;
  if (!s.focused) return FPS_DEEP;
  if (s.busy) return 0;
  if (s.idleMs > IDLE_20_MS) return FPS_DEEP;
  if (s.idleMs > IDLE_30_MS) return FPS_IDLE;
  return 0;
}

/**
 * Este quadro do navegador deve ser desenhado? A folga (ms) deixa passar o quadro que chega um
 * pouco antes do prazo: a 60 Hz, 2 quadros de 16,67 ms dão os 33,3 ms de 30 qps sem pular um terceiro.
 */
export function shouldRender(now: number, lastRender: number, fps: number, slackMs = 2): boolean {
  if (fps <= 0) return true;
  return now - lastRender >= 1000 / fps - slackMs;
}

/** Teto do `dt` de um passo: com economia ligada o intervalo normal já passa de 50 ms. */
export function dtCap(fps: number): number {
  return fps > 0 ? 0.1 : 0.05;
}
