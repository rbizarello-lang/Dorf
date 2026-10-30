// `?fps`: mostra no canto o FPS mediano dos últimos 5 s e o nome da placa de vídeo (quando o navegador informa).
import type * as THREE from 'three';

export class FpsMeter {
  private el: HTMLElement;
  private samples: Array<{ t: number; fps: number }> = [];
  private last = 0;
  private gpu: string;

  constructor(renderer: THREE.WebGLRenderer) {
    this.el = document.getElementById('fps')!;
    this.el.style.display = 'block';
    this.gpu = gpuName(renderer);
    this.el.textContent = `FPS … · ${this.gpu}`;
  }

  /** Chamar a cada quadro, com o relógio em ms. */
  tick(now: number): void {
    if (this.last) {
      const dt = now - this.last;
      if (dt > 0) this.samples.push({ t: now, fps: 1000 / dt });
    }
    this.last = now;
    while (this.samples.length && now - this.samples[0].t > 5000) this.samples.shift();
    if (this.samples.length && Math.floor(now / 500) !== Math.floor((now - 16) / 500)) {
      const v = this.samples.map((s) => s.fps).sort((a, b) => a - b);
      const med = v[Math.floor(v.length / 2)];
      this.el.textContent = `FPS ${Math.round(med)} · ${this.gpu}`;
      (window as unknown as { __fps: number }).__fps = med;
    }
  }
}

function gpuName(renderer: THREE.WebGLRenderer): string {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const n = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
      if (n) return n.replace(/^ANGLE \((.*)\)$/, '$1');
    }
    const r = gl.getParameter(gl.RENDERER) as string;
    if (r) return r;
  } catch { /* o navegador não informa */ }
  return 'placa de vídeo não informada';
}
