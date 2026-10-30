// Resolução dinâmica do modo Auto: antes de descer o nível de qualidade, a resolução interna
// cede um degrau quando o quadro fica lento e volta quando sobra tempo. Lógica pura (os testes
// rodam em Node, tests/video.ts).
//
// Meta: 60 quadros por segundo. A cada janela de quadros vale a MÉDIA do tempo do quadro, sem os
// soluços (quadros de mais de 100 ms: compilação de shader, coleta de lixo, aba que acordou). A
// mediana, que o Auto usava antes, escondia a queda: numa tela de 60 Hz o quadro lento chega em
// múltiplos de 16,7 ms, então uma GPU de 20 ms entrega 50 qps com mediana de 16,7 ms ("tudo bem").
// A média vê os 33 ms intercalados e desce o degrau.
//
// Lenta (abaixo de ~54 qps, 18,5 ms) por duas janelas seguidas: desce um degrau (uma só janela, se
// estiver abaixo de ~34 qps). Folgada (acima de ~57 qps, 17,5 ms) por duas janelas: sobe um. O par
// de janelas evita reagir à peça que acabou de assentar (alguns quadros de 40 ms); o espaço entre
// os limiares é a histerese, e numa tela de 60 Hz o quadro cheio mede 16,7 ms, dentro da folga.
// Subir pode levar a um quadro lento logo em seguida: o degrau que falhou fica proibido por um
// tempo, que dobra a cada nova falha, e a resolução não fica oscilando.

/** Escala do lado da imagem em cada degrau (1 = resolução cheia do nível). */
export const RES_STEPS = [1, 0.9, 0.8, 0.7, 0.6] as const;

/** Quadros por janela (0,7 s a 60 qps). */
const WINDOW = 40;
/** Um quadro acima disto (segundos) é soluço: fica fora da média, desde que seja minoria da janela. */
const HITCH = 0.1;
/** Um quadro nunca vale mais que isto (segundos) na média. */
const DT_CAP = 0.25;
/** A janela com média acima de `slow * HARD` desce sem esperar a segunda. */
const HARD = 1.6;
/** Segundos de proibição na primeira falha de um degrau (depois dobra, até o teto). */
const BAN = 60;
const BAN_MAX = 600;

export type DynResEvent = 'down' | 'up' | 'floor' | null;

export class DynRes {
  step = 0;
  private times: number[] = [];
  /** Janelas a ignorar no começo e depois de uma troca de nível: a compilação dos shaders custa quadros longos. */
  private grace = 1;
  /** Janelas seguidas lentas e folgadas. */
  private slowRun = 0;
  private fastRun = 0;
  /** Subiu na última troca: se a janela seguinte vier lenta, o degrau falhou. */
  private rose = false;
  /** Degrau → até quando está proibido (segundos) e quantas vezes já falhou. */
  private banned = new Map<number, { until: number; strikes: number }>();

  /** `slow`: média acima disso é lenta; `fast`: abaixo disso é folgada (segundos por quadro). */
  constructor(
    private slow = 1 / 54,
    private fast = 1 / 57,
  ) {}

  get scale() {
    return RES_STEPS[this.step];
  }

  reset() {
    this.step = 0;
    this.times.length = 0;
    this.grace = 1;
    this.slowRun = this.fastRun = 0;
    this.rose = false;
    this.banned.clear();
  }

  /** Um quadro de `dt` segundos no instante `now` (segundos). */
  push(dt: number, now: number): DynResEvent {
    this.times.push(Math.min(dt, DT_CAP));
    if (this.times.length < WINDOW) return null;
    let sum = 0, n = 0;
    for (const t of this.times) if (t <= HITCH) (sum += t), n++;
    // Soluços em minoria saem da conta; se a janela é quase toda de quadros longos, a lentidão é real.
    if (n < WINDOW * 0.75) {
      sum = 0;
      for (const t of this.times) sum += t;
      n = WINDOW;
    }
    const mean = sum / n;
    this.times.length = 0;
    if (this.grace > 0) {
      this.grace--;
      return null;
    }
    const rose = this.rose;
    this.rose = false;
    if (mean > this.slow) {
      this.fastRun = 0;
      this.slowRun++;
      if (this.slowRun < 2 && mean <= this.slow * HARD && !rose) return null;
      if (rose) {
        const b = this.banned.get(this.step);
        const strikes = (b?.strikes ?? 0) + 1;
        this.banned.set(this.step, { until: now + Math.min(BAN_MAX, BAN * 2 ** (strikes - 1)), strikes });
      }
      this.slowRun = 0;
      if (this.step === RES_STEPS.length - 1) return 'floor';
      return this.change(this.step + 1, 'down');
    }
    this.slowRun = 0;
    if (mean < this.fast && this.step > 0 && (this.banned.get(this.step - 1)?.until ?? -Infinity) <= now) {
      if (++this.fastRun < 2) return null;
      this.fastRun = 0;
      this.rose = true;
      return this.change(this.step - 1, 'up');
    }
    this.fastRun = 0;
    return null;
  }

  private change(step: number, ev: 'up' | 'down'): DynResEvent {
    this.step = step;
    return ev;
  }
}
