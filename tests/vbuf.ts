// Limite de buffers de vértice do WebGPU (maxVertexBuffers = 8). Cada kit instanciado usa buffers da geometria + `iColor` + a matriz da
// instância (2 buffers com mais de 1000 instâncias: a matriz e a anterior, do TRAA). Os atributos do kit vão intercalados num buffer só
// (`instGeometry`), então nenhum kit de nenhum tema pode passar de 5 buffers de geometria e fica com 1 de folga. Nada de GPU: conta na geometria.
import * as THREE from 'three/webgpu';
import { instGeometry, Lib } from '../src/render/lib';
import { THEMES } from '../src/themes/themes';

const LIMIT = 8;
const INSTANCE = 3; // iColor + matriz + matriz anterior
let fails = 0;
const ok = (c: boolean, msg: string) => {
  if (!c) {
    fails++;
    console.error('FALHOU:', msg);
  }
};

type Attr = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
const buffers = (g: THREE.BufferGeometry) => new Set(Object.values(g.attributes).map((a) => (a as THREE.InterleavedBufferAttribute).data ?? a)).size;
const comp = (a: Attr, i: number, c: number) => (c === 0 ? a.getX(i) : c === 1 ? a.getY(i) : c === 2 ? a.getZ(i) : a.getW(i));

let kits = 0, worst = 0, worstKey = '';
const lib = new Lib();
for (const theme of THEMES) {
  lib.applyTheme(theme);
  const keys = new Set<string>(lib.geos.keys());
  for (const k of [...keys]) if (lib.farGeo(k)) keys.add(`far:${k}`);
  for (const k of keys) {
    const base = k.startsWith('far:') ? lib.farGeo(k.slice(4)) : lib.geo(k);
    if (!base) continue;
    const g = instGeometry(base, 4);
    const geo = buffers(g) - 1; // sem o iColor
    kits++;
    const total = geo + INSTANCE;
    if (total > worst) {
      worst = total;
      worstKey = `${theme.id}/${k}`;
    }
    ok(total <= LIMIT - 1, `${theme.id}/${k}: ${geo} buffers de geometria + ${INSTANCE} da instância = ${total} (deixe 1 de folga: ${LIMIT - 1})`);
    // O intercalado não pode mudar o conteúdo lido pelos materiais.
    for (const [name, a] of Object.entries(base.attributes)) {
      const b = g.getAttribute(name) as Attr | undefined;
      ok(!!b && b.count === a.count && b.itemSize === a.itemSize, `${theme.id}/${k}: atributo ${name} mudou de formato`);
      if (!b || b.count !== a.count) continue;
      const n = Math.min(a.count, 40);
      let same = true;
      for (let i = 0; i < n && same; i++) for (let c = 0; c < a.itemSize; c++) if (comp(a as Attr, i, c) !== comp(b, i, c)) same = false;
      ok(same, `${theme.id}/${k}: atributo ${name} difere do original`);
    }
  }
}
if (fails) {
  console.error(`${fails} falha(s) em ${kits} kits`);
  process.exit(1);
}
console.log(`vbuf ok: ${kits} kits em ${THEMES.length} temas, no máximo ${worst} buffers de vértice (${worstKey}), limite ${LIMIT}`);
