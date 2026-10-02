// Sons sintetizados com WebAudio: nenhum arquivo, alguns KB.
// Só inicia depois do primeiro gesto do jogador (exigência dos navegadores).

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

export type Mood = 'dawn' | 'day' | 'golden' | 'dusk' | 'night';
/** Música ambiente por hora do dia: escala (semitons), duração da batida e chance de nota por batida. */
const MOODS: Record<Mood, { scale: number[]; beat: number; density: number; root: number }> = {
  dawn: { scale: [0, 2, 4, 7, 9], beat: 0.82, density: 0.28, root: 2 },
  day: { scale: [0, 2, 4, 7, 9], beat: 0.62, density: 0.42, root: 0 },
  golden: { scale: [0, 2, 4, 7, 11], beat: 0.68, density: 0.38, root: -2 },
  dusk: { scale: [0, 2, 5, 7, 9], beat: 0.74, density: 0.34, root: -3 },
  night: { scale: [0, 3, 5, 7, 10], beat: 0.9, density: 0.26, root: -5 },
};
const PAD_BEATS = 16;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private echo: DelayNode | null = null;
  private musicBus: GainNode | null = null;
  private nextBeat = 0;
  private beat = 0;
  private lastDeg = 2;
  private mood: Mood = 'day';
  enabled = true;
  /** Música ambiente ligada (só toca com `enabled`). */
  music = true;

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
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.enabled && this.music ? 1 : 0;
      this.musicBus.connect(this.master);
      this.nextBeat = this.ctx.currentTime + 0.4;
      // Agenda com folga de meio segundo: um quadro lento não atrasa a música.
      window.setInterval(() => this.scheduleMusic(), 200);
    } catch {
      this.ctx = null;
    }
  }

  /** Liga ou desliga efeitos e música; a música some e volta em rampa, sem estalo. */
  setOutput(enabled: boolean, music: boolean) {
    this.enabled = enabled;
    this.music = music;
    if (!this.ctx || !this.musicBus) return;
    const g = this.musicBus.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(enabled && music ? 1 : 0, t + 0.6);
  }

  setMood(m: Mood) {
    this.mood = m;
  }

  /** Aba oculta: suspende o áudio inteiro (a música não fica tocando em segundo plano). */
  pause(hidden: boolean) {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else
      void this.ctx.resume().then(() => {
        if (this.ctx) this.nextBeat = Math.max(this.nextBeat, this.ctx.currentTime + 0.2);
      });
  }

  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || ctx.state !== 'running') return;
    if (!this.enabled || !this.music) {
      this.nextBeat = ctx.currentTime + 0.3;
      return;
    }
    const m = MOODS[this.mood];
    while (this.nextBeat < ctx.currentTime + 0.5) {
      const t = this.nextBeat;
      if (this.beat % PAD_BEATS === 0) this.pad(t, m.beat * PAD_BEATS, m);
      if (Math.random() < m.density) {
        // Passeio pela escala em passos curtos: soa como melodia, não como notas soltas.
        this.lastDeg = Math.max(0, Math.min(9, this.lastDeg + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        const semi = m.root + m.scale[this.lastDeg % 5] + 12 * Math.floor(this.lastDeg / 5);
        this.voice(392 * Math.pow(2, semi / 12), t, 2.2, 'sine', 0.032, this.musicBus, 0.03, true);
      }
      this.beat++;
      this.nextBeat += m.beat;
    }
  }

  /** Acorde longo e grave, abafado, que dá o "chão" da música. */
  private pad(t: number, dur: number, m: (typeof MOODS)[Mood]) {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    f.connect(this.musicBus!);
    const deg = [0, 2, 3][Math.floor(Math.random() * 3)];
    for (const step of [0, 2, 4]) {
      const semi = m.root + m.scale[(deg + step) % 5] + (deg + step >= 5 ? 12 : 0);
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = 130.81 * Math.pow(2, semi / 12);
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.012, t + dur * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.1);
        o.connect(g).connect(f);
        o.start(t);
        o.stop(t + dur * 1.1 + 0.1);
      }
    }
  }

  private voice(freq: number, t: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, attack: number, echo: boolean) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    if (echo && this.echo) g.connect(this.echo);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private ready() {
    return this.enabled && this.ctx && this.master ? this.ctx : null;
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, echo = false) {
    const ctx = this.ready();
    if (!ctx) return;
    this.voice(freq, ctx.currentTime + at, dur, type, vol, this.master!, 0.012, echo);
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

  /** Tique de giro: mais agudo para a direita, mais grave para a esquerda. */
  rotate(dir: 1 | -1 = 1) {
    this.tone(dir > 0 ? 880 : 740, 0, 0.05, 'sine', 0.04);
  }

  /** Passou do recorde no meio da partida. */
  record() {
    [0, 7, 12, 16, 19].forEach((s, i) => this.note(s, 0.05 + i * 0.07, 0.8, 0.1));
  }

  /** Fim de partida: cadência que desce até a tônica, ou sobe se foi recorde. */
  gameOver(record: boolean) {
    (record ? [0, 4, 7, 12, 16, 24] : [12, 9, 7, 4, 0]).forEach((s, i) => this.note(s - 12, 0.1 + i * 0.16, 1.4, 0.1));
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
