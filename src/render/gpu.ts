import * as THREE from 'three/webgpu';

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
