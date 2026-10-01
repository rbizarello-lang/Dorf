// Sons sintetizados com WebAudio: nenhum arquivo, alguns KB.
// Só inicia depois do primeiro gesto do jogador (exigência dos navegadores).

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private echo: DelayNode | null = null;
  enabled = true;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      // Eco curto dá "ambiente" aos sinos.
      this.echo = this.ctx.createDelay(1);
      this.echo.delayTime.value = 0.23;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.28;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.3;
      this.echo.connect(fb).connect(this.echo);
      this.echo.connect(wet).connect(this.master);
    } catch {
      this.ctx = null;
    }
  }

  private ready() {
    return this.enabled && this.ctx && this.master ? this.ctx : null;
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, echo = false) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    if (echo && this.echo) g.connect(this.echo);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** "Toc" de madeira ao assentar a peça. */
  place(matches: number) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900 + Math.random() * 300;
    const g = ctx.createGain();
    g.gain.value = 0.7;
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    this.tone(150 + Math.random() * 20, 0, 0.14, 'sine', 0.35);
    for (let i = 0; i < Math.min(matches, 6); i++) this.note(PENTA[i], 0.05 + i * 0.055, 0.35, 0.07);
  }

  /** Três batidas de martelo (construção que sobe ao assentar a peça). */
  hammer(at = 0) {
    const ctx = this.ready();
    if (!ctx) return;
    for (let k = 0; k < 3; k++) {
      const t = ctx.currentTime + at + k * 0.11;
      const len = Math.floor(ctx.sampleRate * 0.035);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1500 + Math.random() * 300;
      f.Q.value = 2.5;
      const g = ctx.createGain();
      g.gain.value = 0.5 - k * 0.08;
      src.connect(f).connect(g).connect(this.master!);
      src.start(t);
    }
  }

  note(semi: number, at: number, dur = 0.5, vol = 0.1) {
    this.tone(523.25 * Math.pow(2, semi / 12), at, dur, 'triangle', vol, true);
  }

  rotate() {
    this.tone(880, 0, 0.05, 'sine', 0.04);
  }

  perfect() {
    [7, 12, 16].forEach((s, i) => this.note(s, 0.12 + i * 0.08, 0.7, 0.1));
  }

  quest() {
    [0, 4, 7, 12, 16].forEach((s, i) => this.note(s, 0.1 + i * 0.09, 0.9, 0.11));
  }

  fail() {
    [4, 0].forEach((s, i) => this.tone(261.63 * Math.pow(2, s / 12), 0.1 + i * 0.14, 0.4, 'sine', 0.1));
  }

  invalid() {
    this.tone(180, 0, 0.12, 'square', 0.03);
  }
}
