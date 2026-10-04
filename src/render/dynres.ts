// Resolução dinâmica do modo Auto: antes de descer o nível de qualidade, a resolução interna
// cede um degrau quando o quadro fica lento e volta quando sobra tempo. Lógica pura (os testes
// rodam em Node, tests/video.ts).
//
// A cada janela de quadros vale a mediana. Lenta: desce um degrau. Folgada: sobe um. Numa tela
// de 60 Hz o tempo do quadro só mostra múltiplos de 16,7 ms, então subir pode levar a um quadro
// lento logo em seguida: quando isso acontece, o degrau que acabou de falhar fica proibido por um
// tempo, que dobra a cada nova falha, e a resolução não fica oscilando.

/** Escala do lado da imagem em cada degrau (1 = resolução cheia do nível). */
export const RES_STEPS = [1, 0.9, 0.8, 0.7, 0.6] as const;

/** Quadros por janela. */
const WINDOW = 40;
/** Segundos de proibição na primeira falha de um degrau (depois dobra, até o teto). */
const BAN = 60;
const BAN_MAX = 600;

export type DynResEvent = 'down' | 'up' | 'floor' | null;

export class DynRes {
  step = 0;
  private times: number[] = [];
  /** Janelas a ignorar depois de uma troca: a troca de resolução custa um quadro longo. */
  private grace = 1;
  /** Subiu na última troca: se a janela seguinte vier lenta, o degrau falhou. */
  private rose = false;
  /** Degrau → até quando está proibido (segundos) e quantas vezes já falhou. */
  private banned = new Map<number, { until: number; strikes: number }>();

  /** `slow`: mediana acima disso desce; `fast`: abaixo disso sobe (segundos por quadro). */
  constructor(
    private slow = 1 / 38,
    private fast = 1 / 50,
  ) {}

  get scale() {
    return RES_STEPS[this.step];
  }

  reset() {
    this.step = 0;
    this.times.length = 0;
    this.grace = 1;
    this.rose = false;
    this.banned.clear();
  }

  /** Um quadro de `dt` segundos no instante `now` (segundos). */
  push(dt: number, now: number): DynResEvent {
    this.times.push(dt);
    if (this.times.length < WINDOW) return null;
    this.times.sort((a, b) => a - b);
    const median = this.times[WINDOW >> 1];
    this.times.length = 0;
    if (this.grace > 0) {
      this.grace--;
      return null;
    }
    const rose = this.rose;
    this.rose = false;
    if (median > this.slow) {
      if (rose) {
        const b = this.banned.get(this.step);
        const strikes = (b?.strikes ?? 0) + 1;
        this.banned.set(this.step, { until: now + Math.min(BAN_MAX, BAN * 2 ** (strikes - 1)), strikes });
      }
      if (this.step === RES_STEPS.length - 1) return 'floor';
      return this.change(this.step + 1, 'down');
    }
    if (median < this.fast && this.step > 0 && (this.banned.get(this.step - 1)?.until ?? -Infinity) <= now) {
      this.rose = true;
      return this.change(this.step - 1, 'up');
    }
    return null;
  }

  private change(step: number, ev: 'up' | 'down'): DynResEvent {
    this.step = step;
    this.grace = 1;
    return ev;
  }
}
