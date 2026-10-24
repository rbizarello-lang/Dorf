// Texturas desenhadas em canvas: nogueira, brilhos, névoa. Nada de arquivo de arte.
import * as THREE from 'three';
import { mulberry32 } from './rng';

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}
export function tex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function walnutTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  const r = mulberry32(5);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#4b2c1b'); grad.addColorStop(0.5, '#583420'); grad.addColorStop(1, '#43271a');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 170; i++) {
    const y0 = r() * 512, amp = 2 + r() * 9, f = 0.004 + r() * 0.012, ph = r() * 6;
    g.strokeStyle = r() < 0.55 ? `rgba(24,12,6,${0.1 + r() * 0.22})` : `rgba(150,92,52,${0.05 + r() * 0.12})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    for (let x = 0; x <= 512; x += 8) {
      const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph * 2) * amp * 0.25;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function glowTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return tex(c, false);
}

/** Halo quente da mesa, sob o diorama. */
export function tableTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,196,120,0.5)'); gr.addColorStop(0.35, 'rgba(190,120,60,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return tex(c);
}

export function mistTexture(seed: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const r = mulberry32(seed);
  for (let i = 0; i < 46; i++) {
    const x = 40 + r() * 176, y = 40 + r() * 176, rad = 28 + r() * 42;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,255,255,${0.1 + r() * 0.14})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.7, 'rgba(0,0,0,0.9)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, 256, 256);
  return tex(c);
}
