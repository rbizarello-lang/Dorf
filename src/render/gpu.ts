import * as THREE from 'three/webgpu';
import type { GpuInfo } from './gpuTier';

// Criação do renderizador: WebGPU quando o navegador oferece, WebGL2 nos demais
// (o three.js troca de backend sozinho; os materiais TSL compilam para os dois).

export type Backend = 'webgpu' | 'webgl2';

/**
 * Chromium anterior ao formato final da especificação espera `swizzle` como dicionário
 * e rejeita a string 'rgba' que o three.js envia. 'rgba' é a identidade, então
 * retirar o campo não muda nada nos navegadores atuais e evita o erro nos antigos.
 */
function patchSwizzle() {
  type View = Record<string, unknown> | undefined;
  const G = (globalThis as { GPUTexture?: { prototype: { createView: (d?: View) => unknown; __retalhos?: boolean } } }).GPUTexture;
  if (!G || G.prototype.__retalhos) return;
  const orig = G.prototype.createView;
  G.prototype.createView = function (this: unknown, d?: View) {
    if (d && d.swizzle === 'rgba') {
      const rest = { ...d };
      delete rest.swizzle;
      return orig.call(this, rest);
    }
    return orig.call(this, d);
  };
  G.prototype.__retalhos = true;
}

export async function createRenderer(canvas: HTMLCanvasElement, forceWebGL: boolean) {
  patchSwizzle();
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL, powerPreference: 'high-performance' });
  await renderer.init();
  const backend: Backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  return { renderer, backend };
}

/**
 * Nome e arquitetura da placa de vídeo, para o nível inicial do modo Auto (gpuTier.ts). O nome
 * completo vem do WebGL; com o backend WebGPU, um contexto WebGL de vida curta só para lê-lo.
 */
export function readGpuInfo(renderer: THREE.WebGPURenderer): GpuInfo {
  const backend = renderer.backend as { device?: { adapterInfo?: { vendor?: string; architecture?: string; description?: string } }; gl?: WebGL2RenderingContext };
  const ai = backend.device?.adapterInfo;
  const info: GpuInfo = { vendor: ai?.vendor || undefined, architecture: ai?.architecture || undefined, renderer: ai?.description || undefined };
  try {
    const gl = backend.gl ?? document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && ext) info.renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') || info.renderer;
    if (gl && gl !== backend.gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    /* sem WebGL: fica o que o WebGPU informou */
  }
  return info;
}
