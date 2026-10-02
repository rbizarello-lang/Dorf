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

/** Estilo musical do tema (Theme.music). Sem ele, a escala da hora do dia e a flauta. */
export interface MusicStyle {
  scale: number[];
  timbre: 'flute' | 'reed' | 'pluck' | 'bell' | 'glass';
}

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private echo: DelayNode | null = null;
  private musicBus: GainNode | null = null;
  private nextBeat = 0;
  private beat = 0;
  private lastDeg = 2;
  private mood: Mood = 'day';
  private style: MusicStyle | null = null;
  /** Era da vila (0 a 3): a música ganha bordão, cordas e sinos, como a trilha do AoE IV. */
  private era = 0;
  private plucks = new Map<number, AudioBuffer>();
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

  /** Escala e timbre do tema, e a era atual (as camadas da música). */
  setStyle(style: MusicStyle | undefined, era: number) {
    this.style = style ?? null;
    this.era = era;
  }

  /** Escala em uso: a do tema ou a da hora do dia. */
  private scale(m: (typeof MOODS)[Mood]) {
    return this.style?.scale ?? m.scale;
  }

  /** Grau da escala (pode passar do tamanho dela: sobe oitavas) em semitons. */
  private degree(sc: number[], deg: number) {
    return sc[((deg % sc.length) + sc.length) % sc.length] + 12 * Math.floor(deg / sc.length);
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
    const sc = this.scale(m);
    const top = sc.length * 2 - 1;
    while (this.nextBeat < ctx.currentTime + 0.5) {
      const t = this.nextBeat;
      if (this.beat % PAD_BEATS === 0) {
        this.pad(t, m.beat * PAD_BEATS, m);
        // Camadas da era: bordão na tônica (II), acorde de sinos (IV).
        if (this.era >= 1) this.drone(130.81 * Math.pow(2, (m.root - 12) / 12), t, m.beat * PAD_BEATS);
        if (this.era >= 3) [0, 2, 4].forEach((d, i) => this.bell(523.25 * Math.pow(2, (m.root + this.degree(sc, d)) / 12), t + i * 0.09, 3.5, 0.012, this.musicBus!));
      }
      if (Math.random() < m.density) {
        // Passeio pela escala em passos curtos: soa como melodia, não como notas soltas.
        this.lastDeg = Math.max(0, Math.min(top, this.lastDeg + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        this.melody(392 * Math.pow(2, (m.root + this.degree(sc, this.lastDeg)) / 12), t, 2.2, 0.032, this.musicBus);
      } else if (this.era >= 2 && Math.random() < 0.3) {
        // Cordas dedilhadas (III): notas do acorde uma oitava abaixo, entre as da melodia.
        this.pluck(196 * Math.pow(2, (m.root + this.degree(sc, [0, 2, 4][Math.floor(Math.random() * 3)])) / 12), t, 0.05, this.musicBus);
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
    const sc = this.scale(m);
    const deg = [0, 2, 3][Math.floor(Math.random() * 3)];
    for (const step of [0, 2, 4]) {
      const semi = m.root + this.degree(sc, deg + step);
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

  /** Nota da melodia no timbre do tema. */
  private melody(freq: number, t: number, dur: number, vol: number, dest: AudioNode) {
    const tb = this.style?.timbre ?? 'flute';
    if (tb === 'pluck') this.pluck(freq, t, vol * 1.6, dest);
    else if (tb === 'bell') this.bell(freq, t, dur * 1.4, vol, dest);
    else if (tb === 'reed') this.reed(freq, t, dur * 0.8, vol, dest);
    else {
      this.voice(freq, t, dur, 'sine', vol, dest, 0.03, true);
      if (tb === 'glass') this.voice(freq * 4.02, t, dur * 0.5, 'sine', vol * 0.18, dest, 0.01, true);
    }
  }

  /** Palheta: dente-de-serra com filtro passa-baixa e ataque macio. */
  private reed(freq: number, t: number, dur: number, vol: number, dest: AudioNode) {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq * 3;
    f.Q.value = 2;
    f.connect(dest);
    if (this.echo) f.connect(this.echo);
    this.voice(freq, t, dur, 'sawtooth', vol * 0.6, f, 0.06, false);
  }

  /** Sino: parciais inarmônicas que somem em tempos diferentes. */
  private bell(freq: number, t: number, dur: number, vol: number, dest: AudioNode) {
    for (const [k, v, d] of [[1, 1, 1], [2.76, 0.4, 0.5], [5.4, 0.2, 0.3]]) this.voice(freq * k, t, dur * d, 'sine', vol * v, dest, 0.004, true);
  }

  /** Bordão: dente-de-serra grave e abafado, que entra e sai devagar com o acorde. */
  private drone(freq: number, t: number, dur: number) {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    f.connect(this.musicBus!);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.01, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
    o.connect(g).connect(f);
    o.start(t);
    o.stop(t + dur * 1.05 + 0.1);
  }

  /** Corda dedilhada (Karplus-Strong): ruído que passa por uma linha de atraso com média. */
  private pluck(freq: number, t: number, vol: number, dest: AudioNode) {
    const ctx = this.ctx!;
    const key = Math.round(freq);
    let buf = this.plucks.get(key);
    if (!buf) {
      const sr = ctx.sampleRate, len = Math.floor(sr * 1.6), n = Math.max(2, Math.round(sr / freq));
      buf = ctx.createBuffer(1, len, sr);
      const out = buf.getChannelData(0);
      const ring = new Float32Array(n);
      for (let i = 0; i < n; i++) ring[i] = Math.random() * 2 - 1;
      for (let i = 0, j = 0; i < len; i++, j = (j + 1) % n) {
        out[i] = ring[j];
        ring[j] = 0.5 * (ring[j] + ring[(j + 1) % n]) * 0.996;
      }
      this.plucks.set(key, buf);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol * 3;
    src.connect(g).connect(dest);
    if (this.echo) g.connect(this.echo);
    src.start(t);
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

  /**
   * Fanfarra de nova era na escala do tema: três notas curtas que sobem e uma longa na
   * oitava. A instrumentação cresce com a era: voz; + bordão; + cordas; + acorde de sinos.
   */
  eraFanfare(era: number) {
    const ctx = this.ready();
    if (!ctx) return;
    this.era = era;
    const m = MOODS[this.mood];
    const sc = this.scale(m);
    const t0 = ctx.currentTime + 0.12;
    const semi = (d: number) => this.degree(sc, d);
    const steps: [number, number, number][] = [[0, 0, 0.18], [2, 0.16, 0.18], [4, 0.32, 0.18], [sc.length, 0.52, 1.8]];
    for (const [d, at, dur] of steps) this.melody(523.25 * Math.pow(2, semi(d) / 12), t0 + at, dur, 0.09, this.master!);
    if (era >= 1) this.voice(130.81, t0, 2.4, 'triangle', 0.06, this.master!, 0.08, false);
    if (era >= 2) [0, 2, 4, sc.length].forEach((d, i) => this.pluck(261.63 * Math.pow(2, semi(d) / 12), t0 + 0.52 + i * 0.05, 0.08, this.master!));
    if (era >= 3) [0, 2, 4].forEach((d) => this.bell(1046.5 * Math.pow(2, semi(d) / 12), t0 + 0.54, 3, 0.035, this.master!));
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
