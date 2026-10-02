// Gravação: enquanto a pessoa joga, guarda só a pose da câmera a cada quadro e os eventos (jogadas,
// hora do dia, peça flutuando). O vídeo é desenhado depois, quadro a quadro (render.ts), então a
// gravação não pesa no jogo e o resultado sai liso mesmo que o jogo tenha engasgado.
import type { Pose } from './path';

/** Duração máxima de uma gravação, em segundos. */
export const TAKE_MAX = 120;

export type TakeEvent =
  | { t: number; kind: 'place'; q: number; r: number; rot: number }
  | { t: number; kind: 'time'; tod: string }
  | { t: number; kind: 'ghost'; q: number; r: number; rot: number; angle: number }
  | { t: number; kind: 'noghost' };

/** Eventos sem o instante (quem grava não precisa saber o relógio da gravação). */
type Untimed<E> = E extends unknown ? Omit<E, 't'> : never;

export class Take {
  /** Segundos desde o começo. */
  t = 0;
  readonly times: number[] = [];
  readonly poses: Pose[] = [];
  readonly events: TakeEvent[] = [];
  private lastGhost = '';

  /** Um quadro do jogo: avança o relógio e guarda a pose. Devolve false quando chega ao limite. */
  frame(dt: number, pose: Pose): boolean {
    // Um quadro muito longo (aba escondida, engasgo) não abre um buraco no vídeo.
    this.t += Math.min(dt, 0.25);
    this.times.push(this.t);
    this.poses.push(pose);
    return this.t < TAKE_MAX;
  }

  event(e: Untimed<TakeEvent>) {
    // A peça flutuando muda a cada movimento do mouse, mas só importa quando muda de lugar ou de giro.
    if (e.kind === 'ghost' || e.kind === 'noghost') {
      const key = e.kind === 'ghost' ? `${e.q},${e.r},${e.rot},${e.angle}` : '-';
      if (key === this.lastGhost) return;
      this.lastGhost = key;
    } else if (e.kind === 'place') this.lastGhost = '';
    this.events.push({ ...e, t: this.t } as TakeEvent);
  }
}
