/** Agenda quadros pelo relógio do RAF. O atraso de uma pausa não vira uma fila de quadros. */
export class FramePacer {
  private next = 0;
  private interval = 0;

  due(now: number, interval: number) {
    if (interval === 0 || this.interval !== interval) {
      this.interval = interval;
      this.next = now + interval;
      return true;
    }
    // Um milissegundo absorve o arredondamento dos timestamps em telas de 60 e 120 Hz.
    if (now + 1 < this.next) return false;
    this.next += interval * Math.max(1, Math.floor((now + 1 - this.next) / interval) + 1);
    return true;
  }
}
