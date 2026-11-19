import type * as THREE from 'three/webgpu';

/**
 * Conferência do limite de buffers de vértices do WebGPU (`maxVertexBuffers` = 8 por padrão): uma malha que passa disso
 * não cria o pipeline e some. Só conta o que o material realmente lê, por passe (cena, sombra, velocidade do TRAA),
 * do jeito que o `RenderObject` do three monta os buffers (instanceMatrix = 1; atributos intercalados do mesmo buffer = 1).
 * O gancho `window.__vbuf()` (`?vbuf`) devolve as malhas com `pior` >= `perto`. Não depende do backend: vale em WebGL2.
 */
export const VBUF_LIMIT = 8;

interface RenderObjectLike {
  object: THREE.Object3D;
  material: THREE.Material;
  getVertexBuffers(): unknown[];
  geometry: THREE.BufferGeometry;
  getNodeBuilderState(): { nodeAttributes: { name: string; node?: { attribute?: unknown } }[] };
}

interface ObjectsLike {
  createRenderObject: (...args: unknown[]) => RenderObjectLike;
}

export interface VbufRow {
  /** Chave do pool (ou o nome da malha). */
  key: string;
  /** Buffers de vértice distintos que o pipeline usa agora. */
  n: number;
  /** O pior caso da malha instanciada: buffers da geometria + matriz da instância + matriz anterior (TRAA), com 1000 instâncias ou mais. */
  pior: number;
  /** Nomes dos atributos lidos pelo material. */
  attrs: string[];
  material: string;
}

export class VertexBufferWatch {
  private live = new Set<RenderObjectLike>();

  constructor(renderer: THREE.WebGPURenderer, private nameOf: (o: THREE.Object3D) => string) {
    const objs = (renderer as unknown as { _objects: ObjectsLike })._objects;
    const make = objs.createRenderObject.bind(objs);
    objs.createRenderObject = (...args: unknown[]) => {
      const ro = make(...args);
      this.live.add(ro);
      const prev = (ro as unknown as { onDispose: (() => void) | null }).onDispose;
      (ro as unknown as { onDispose: () => void }).onDispose = () => {
        this.live.delete(ro);
        prev?.();
      };
      return ro;
    };
  }

  /** Malhas com `pior` >= `perto` (padrão 7), sem repetir a mesma chave, as piores primeiro. */
  report(perto = VBUF_LIMIT - 1): VbufRow[] {
    const rows = new Map<string, VbufRow>();
    for (const ro of this.live) {
      let n = 0, pior = 0, attrs: string[] = [];
      try {
        n = ro.getVertexBuffers().length;
        const na = ro.getNodeBuilderState().nodeAttributes;
        attrs = na.map((a) => a.name);
        // Só a geometria: a matriz da instância vira 1 buffer (2 no passe de velocidade) quando passa de 1000 instâncias.
        const geo = new Set<unknown>();
        for (const a of na) {
          if (a.node?.attribute) continue;
          const at = ro.geometry.getAttribute(a.name) as (THREE.BufferAttribute & { data?: unknown }) | undefined;
          if (at) geo.add(at.data ?? at);
        }
        pior = Math.max(n, geo.size + ((ro.object as THREE.InstancedMesh).isInstancedMesh ? 2 : 0));
      } catch { continue; }
      if (pior < perto) continue;
      const key = this.nameOf(ro.object);
      const material = ro.material.name || ro.material.type;
      const id = `${key}|${material}|${n}|${pior}`;
      if (!rows.has(id)) rows.set(id, { key, n, pior, attrs, material });
    }
    return [...rows.values()].sort((a, b) => b.pior - a.pior || b.n - a.n);
  }
}
