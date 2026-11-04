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
  /** Teto de quadros por segundo da taxa cheia (`capFor`); 0 ou ausente = a taxa do monitor. */
  cap?: number;
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
  if (s.busy) return s.cap ?? 0;
  if (s.idleMs > IDLE_20_MS) return FPS_DEEP;
  if (s.idleMs > IDLE_30_MS) return FPS_IDLE;
  return s.cap ?? 0;
}

/** A taxa é de economia (parado ou sem foco)? Só nela o tempo do quadro não diz nada sobre a velocidade da placa. */
export const isEconomy = (fps: number) => fps > 0 && fps <= FPS_IDLE;

/** Piso do teto: abaixo de 58 qps o movimento já não parece fluido. */
export const CAP_FLOOR = 58;

/**
 * Teto de quadros por segundo do Auto para um monitor de `hz`: o submúltiplo exato do refresh que
 * fica a partir de 58 qps (144 Hz → 72, 120 Hz → 60, 240 Hz → 60; 165 Hz → 82,5). Quadros a cada
 * 2, 3 ou 4 atualizações do monitor mantêm o ritmo parelho. Em 60, 75 e 100 Hz não há teto (0): já
 * estão perto da meta de 60 qps, e dividir ao meio daria 30 a 50. Um jogo casual não precisa de
 * 144 qps, que deixariam a GPU a 100% o tempo todo.
 */
export function capFor(hz: number): number {
  if (!(hz > 0)) return 0;
  const k = Math.floor(hz / CAP_FLOOR);
  return k >= 2 ? hz / k : 0;
}

/** Taxas de monitor conhecidas, para a estimativa do `RefreshMeter` não tomar um quadro lento por uma taxa. */
const KNOWN_HZ = [60, 75, 90, 100, 120, 144, 165, 180, 240, 360];

/**
 * Estima a taxa de atualização do monitor pelos intervalos do `requestAnimationFrame` (todos os que
 * chegam, também os que o jogo pula). Com a GPU ou a CPU no limite os intervalos crescem e a
 * estimativa não casa com nenhuma taxa conhecida: devolve 0 (sem teto), o lado seguro.
 */
export class RefreshMeter {
  private ring = new Float32Array(120);
  private n = 0;

  /** Um intervalo (ms) entre dois quadros do navegador. */
  push(delta: number) {
    if (delta > 0 && delta < 100) this.ring[this.n++ % this.ring.length] = delta;
  }

  /** Taxa estimada (Hz) ou 0 se ainda faltam amostras ou os intervalos não são limpos. */
  get hz(): number {
    const len = Math.min(this.n, this.ring.length);
    if (len < 90) return 0;
    const sorted = Array.from(this.ring.subarray(0, len)).sort((a, b) => a - b);
    const raw = 1000 / sorted[len >> 1];
    // Jitter de 2% a 3% é normal; o quartil de cima precisa estar perto da mediana (intervalos limpos).
    const spread = sorted[Math.floor(len * 0.75)] / sorted[len >> 1];
    if (spread > 1.1) return 0;
    return KNOWN_HZ.find((h) => Math.abs(raw - h) / h < 0.03) ?? 0;
  }
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
