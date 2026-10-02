// MP4 mínimo para o vídeo exportado: uma faixa de vídeo (H.264 ou VP9), quadros na ordem em que o
// codificador os entrega, índice (moov) antes dos dados (mdat), para tocar enquanto baixa.
// Só monta o cabeçalho: o arquivo é o cabeçalho seguido dos quadros na ordem, e quem chama junta
// as partes (um Blob guarda os quadros sem ocupar a memória do script). Sem dependências e sem
// DOM: os testes rodam em Node (tests/video.ts).

export interface Mp4Video {
  codec: 'avc' | 'vp9';
  width: number;
  height: number;
  /** Quadros por segundo (inteiro). */
  fps: number;
  /** avcC do H.264 (`decoderConfig.description` do VideoEncoder). */
  avcC?: Uint8Array;
  /** Perfil, nível (ex.: 51 = 5.1) e bits por cor do VP9. */
  vp9?: { profile: number; level: number; bitDepth: number };
}

export interface Mp4Sample {
  /** Tamanho do quadro codificado, em bytes. */
  size: number;
  key: boolean;
  /** Instante de apresentação em microssegundos (o `timestamp` do EncodedVideoChunk). */
  time: number;
}

/** Unidades de tempo por segundo da faixa: 1000 por quadro a qualquer taxa inteira. */
const TICKS = 1000;

class Writer {
  private buf = new Uint8Array(256);
  private view = new DataView(this.buf.buffer);
  private n = 0;
  private reserve(k: number) {
    if (this.n + k <= this.buf.length) return;
    const b = new Uint8Array(Math.max(this.buf.length * 2, this.n + k));
    b.set(this.buf.subarray(0, this.n));
    this.buf = b;
    this.view = new DataView(b.buffer);
  }
  get length() {
    return this.n;
  }
  u8(v: number) {
    this.reserve(1);
    this.view.setUint8(this.n, v);
    this.n += 1;
  }
  u16(v: number) {
    this.reserve(2);
    this.view.setUint16(this.n, v);
    this.n += 2;
  }
  u32(v: number) {
    this.reserve(4);
    this.view.setUint32(this.n, v >>> 0);
    this.n += 4;
  }
  i32(v: number) {
    this.reserve(4);
    this.view.setInt32(this.n, v);
    this.n += 4;
  }
  u64(v: number) {
    this.u32(Math.floor(v / 2 ** 32));
    this.u32(v % 2 ** 32);
  }
  ascii(s: string) {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
  }
  bytes(b: Uint8Array) {
    this.reserve(b.length);
    this.buf.set(b, this.n);
    this.n += b.length;
  }
  zeros(k: number) {
    this.reserve(k);
    this.buf.fill(0, this.n, this.n + k);
    this.n += k;
  }
  /** Caixa: tamanho e tipo na frente, conteúdo escrito por `body`. */
  box(type: string, body: () => void) {
    const start = this.n;
    this.u32(0);
    this.ascii(type);
    body();
    this.view.setUint32(start, this.n - start);
  }
  /** Caixa "cheia": versão e bandeiras depois do tipo. */
  full(type: string, version: number, flags: number, body: () => void) {
    this.box(type, () => {
      this.u32((version << 24) | flags);
      body();
    });
  }
  done() {
    return this.buf.slice(0, this.n);
  }
}

const UNITY = [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000];

/** Cabeçalho do arquivo (ftyp, moov e o começo do mdat); os quadros vêm logo depois, na ordem. */
export function mp4Header(v: Mp4Video, samples: Mp4Sample[]): Uint8Array {
  const n = samples.length;
  const dur = n * TICKS;
  // Ordem de decodificação = ordem de chegada; a de apresentação vem do timestamp. Com quadros B,
  // a diferença vira deslocamento de composição (ctts), e a lista de edição tira o atraso.
  const pts = samples.map((s) => Math.round((s.time * v.fps * TICKS) / 1e6));
  const offsets = pts.map((p, i) => p - i * TICKS);
  const delay = Math.max(0, ...offsets.map((o) => -o));
  const reordered = offsets.some((o) => o !== 0);
  let dataSize = 0;
  for (const s of samples) dataSize += s.size;
  const big = dataSize + 16 > 0xffffffff;

  const header = (chunkOffset: number) => {
    const w = new Writer();
    w.box('ftyp', () => {
      w.ascii('isom');
      w.u32(0x200);
      w.ascii('isom');
      w.ascii('iso2');
      if (v.codec === 'avc') w.ascii('avc1');
      w.ascii('mp41');
    });
    w.box('moov', () => {
      w.full('mvhd', 0, 0, () => {
        w.u32(0);
        w.u32(0);
        w.u32(v.fps * TICKS);
        w.u32(dur);
        w.u32(0x10000);
        w.u16(0x100);
        w.zeros(10);
        for (const m of UNITY) w.u32(m);
        w.zeros(24);
        w.u32(2);
      });
      w.box('trak', () => {
        w.full('tkhd', 0, 3, () => {
          w.u32(0);
          w.u32(0);
          w.u32(1);
          w.u32(0);
          w.u32(dur);
          w.zeros(8);
          w.u16(0);
          w.u16(0);
          w.u16(0);
          w.u16(0);
          for (const m of UNITY) w.u32(m);
          w.u32(v.width * 0x10000);
          w.u32(v.height * 0x10000);
        });
        if (reordered && delay > 0)
          w.box('edts', () =>
            w.full('elst', 0, 0, () => {
              w.u32(1);
              w.u32(dur);
              w.i32(delay);
              w.u32(0x10000);
            }),
          );
        w.box('mdia', () => {
          w.full('mdhd', 0, 0, () => {
            w.u32(0);
            w.u32(0);
            w.u32(v.fps * TICKS);
            w.u32(dur);
            w.u16(0x55c4); // 'und'
            w.u16(0);
          });
          w.full('hdlr', 0, 0, () => {
            w.u32(0);
            w.ascii('vide');
            w.zeros(12);
            w.ascii('Retalhos\0');
          });
          w.box('minf', () => {
            w.full('vmhd', 0, 1, () => w.zeros(8));
            w.box('dinf', () =>
              w.full('dref', 0, 0, () => {
                w.u32(1);
                w.full('url ', 0, 1, () => {});
              }),
            );
            w.box('stbl', () => {
              w.full('stsd', 0, 0, () => {
                w.u32(1);
                w.box(v.codec === 'avc' ? 'avc1' : 'vp09', () => {
                  w.zeros(6);
                  w.u16(1);
                  w.zeros(16);
                  w.u16(v.width);
                  w.u16(v.height);
                  w.u32(0x480000);
                  w.u32(0x480000);
                  w.u32(0);
                  w.u16(1);
                  w.zeros(32);
                  w.u16(0x18);
                  w.u16(0xffff);
                  if (v.codec === 'avc') w.box('avcC', () => w.bytes(v.avcC!));
                  else
                    w.full('vpcC', 1, 0, () => {
                      const p = v.vp9 ?? { profile: 0, level: 41, bitDepth: 8 };
                      w.u8(p.profile);
                      w.u8(p.level);
                      // Bits por cor, 4:2:0 e faixa limitada; cores "não especificadas" (2).
                      w.u8((p.bitDepth << 4) | (1 << 1));
                      w.u8(2);
                      w.u8(2);
                      w.u8(2);
                      w.u16(0);
                    });
                });
              });
              w.full('stts', 0, 0, () => {
                w.u32(1);
                w.u32(n);
                w.u32(TICKS);
              });
              if (reordered)
                w.full('ctts', 0, 0, () => {
                  w.u32(n);
                  for (const o of offsets) {
                    w.u32(1);
                    w.u32(o + delay);
                  }
                });
              if (samples.some((s) => !s.key))
                w.full('stss', 0, 0, () => {
                  const keys = samples.flatMap((s, i) => (s.key ? [i + 1] : []));
                  w.u32(keys.length);
                  for (const k of keys) w.u32(k);
                });
              w.full('stsc', 0, 0, () => {
                w.u32(1);
                w.u32(1);
                w.u32(n);
                w.u32(1);
              });
              w.full('stsz', 0, 0, () => {
                w.u32(0);
                w.u32(n);
                for (const s of samples) w.u32(s.size);
              });
              // Um bloco só, logo depois do cabeçalho: o deslocamento sempre cabe em 32 bits.
              w.full('stco', 0, 0, () => {
                w.u32(1);
                w.u32(chunkOffset);
              });
            });
          });
        });
      });
    });
    // Cabeçalho do mdat (16 bytes com o tamanho de 64 bits, se o arquivo passar de 4 GB).
    if (big) {
      w.u32(1);
      w.ascii('mdat');
      w.u64(dataSize + 16);
    } else {
      w.u32(dataSize + 8);
      w.ascii('mdat');
    }
    return w.done();
  };

  // O tamanho do cabeçalho não depende do deslocamento: a segunda passada já sabe onde os dados começam.
  return header(header(0).length);
}
