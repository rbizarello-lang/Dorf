// Codificação do vídeo exportado com WebCodecs: H.264 quando o navegador tem (toca em qualquer
// lugar), senão VP9. Os quadros codificados vão para Blobs (o navegador pode guardá-los em disco)
// e o arquivo final é o cabeçalho de mp4.ts seguido deles.
import { mp4Header, type Mp4Sample } from './mp4';

export interface VideoSize {
  width: number;
  height: number;
  fps: number;
}

/** Bits por segundo por pixel a cada quadro: ~16 Mbit/s em 1080p60, ~60 Mbit/s em 4K60. */
const BITS_PER_PIXEL = 0.13;

/** Candidatos em ordem de preferência, com o nível certo para o tamanho (60 quadros por segundo). */
function candidates(s: VideoSize): { codec: string; kind: 'avc' | 'vp9'; level: number }[] {
  const px = s.width * s.height * s.fps;
  // H.264 High: 4.2 até 1080p60, 5.1 até 1440p60, 5.2 até 4K60. VP9: 4.1, 5.0, 5.1.
  const avc = px <= 1920 * 1088 * 60 ? '2a' : px <= 2560 * 1440 * 60 ? '33' : '34';
  const vp9 = px <= 1920 * 1088 * 60 ? 41 : px <= 2560 * 1440 * 60 ? 50 : 51;
  return [
    { codec: `avc1.6400${avc}`, kind: 'avc', level: 0 },
    { codec: `avc1.4d00${avc}`, kind: 'avc', level: 0 },
    { codec: `vp09.00.${vp9}.08`, kind: 'vp9', level: vp9 },
  ];
}

export interface CodecPick {
  config: VideoEncoderConfig;
  kind: 'avc' | 'vp9';
  level: number;
}

/** Primeira configuração que o navegador codifica, ou null (sem WebCodecs ou sem codec). */
export async function pickCodec(s: VideoSize): Promise<CodecPick | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const c of candidates(s)) {
    const config: VideoEncoderConfig = {
      codec: c.codec,
      width: s.width,
      height: s.height,
      framerate: s.fps,
      bitrate: Math.round(s.width * s.height * s.fps * BITS_PER_PIXEL),
      bitrateMode: 'variable',
      latencyMode: 'quality',
      ...(c.kind === 'avc' ? { avc: { format: 'avc' as const } } : {}),
    };
    try {
      const r = await VideoEncoder.isConfigSupported(config);
      if (r.supported) return { config, kind: c.kind, level: c.level };
    } catch {
      /* configuração recusada: tenta a próxima */
    }
  }
  return null;
}

/** Recebe quadros na ordem e devolve o MP4 pronto. */
export class Mp4Writer {
  private enc: VideoEncoder;
  private blobs: Blob[] = [];
  private samples: Mp4Sample[] = [];
  private desc: Uint8Array | undefined;
  private failure: Error | null = null;
  private count = 0;

  constructor(
    private pick: CodecPick,
    private size: VideoSize,
  ) {
    this.enc = new VideoEncoder({
      output: (chunk, meta) => {
        const d = meta?.decoderConfig?.description;
        if (d && !this.desc) this.desc = ArrayBuffer.isView(d) ? new Uint8Array(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength)) : new Uint8Array(d.slice(0));
        const buf = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buf);
        this.blobs.push(new Blob([buf]));
        this.samples.push({ size: buf.length, key: chunk.type === 'key', time: chunk.timestamp });
      },
      error: (e) => {
        this.failure = e instanceof Error ? e : new Error(String(e));
      },
    });
    this.enc.configure(pick.config);
  }

  /** Codifica um quadro (a imagem atual de `source`). Espera se o codificador estiver atrasado. */
  async add(source: CanvasImageSource) {
    if (this.failure) throw this.failure;
    const us = 1e6 / this.size.fps;
    const frame = new VideoFrame(source, { timestamp: Math.round(this.count * us), duration: Math.round(us) });
    // Um quadro-chave a cada 2 segundos: dá para pular no vídeo sem esperar.
    this.enc.encode(frame, { keyFrame: this.count % (this.size.fps * 2) === 0 });
    frame.close();
    this.count++;
    while (this.enc.encodeQueueSize > 3 && !this.failure) await new Promise((r) => setTimeout(r, 4));
  }

  async finish(): Promise<Blob> {
    await this.enc.flush();
    this.enc.close();
    if (this.failure) throw this.failure;
    if (!this.samples.length || (this.pick.kind === 'avc' && !this.desc)) throw new Error('o codificador não devolveu quadros');
    const head = mp4Header(
      { codec: this.pick.kind, width: this.size.width, height: this.size.height, fps: this.size.fps, avcC: this.desc, vp9: { profile: 0, level: this.pick.level, bitDepth: 8 } },
      this.samples,
    );
    return new Blob([head as BlobPart, ...this.blobs], { type: 'video/mp4' });
  }

  cancel() {
    if (this.enc.state !== 'closed') this.enc.close();
    this.blobs = [];
  }
}
