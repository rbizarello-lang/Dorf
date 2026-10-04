// Nível de qualidade inicial do modo Auto pelo nome da placa de vídeo: não começa no Ultra numa
// placa integrada nem na Média numa placa de sobra. Só escolhe o começo; se o quadro ficar lento,
// o Auto ainda baixa a resolução e depois o nível. Funções puras (testes em tests/video.ts).

export type StartTier = 'ultra' | 'high' | 'medium' | 'low';

export interface GpuInfo {
  /** WebGPU (`device.adapterInfo`): fabricante e arquitetura, ex.: 'amd' e 'gcn-4'. */
  vendor?: string;
  architecture?: string;
  /** WebGL (`WEBGL_debug_renderer_info`): o nome completo, ex.: 'ANGLE (AMD, AMD Radeon RX 580 …)'. */
  renderer?: string;
}

/** Nome legível da placa (para o menu), sem o invólucro do ANGLE nem a marca registrada. */
export function gpuName(info: GpuInfo): string {
  let s = info.renderer ?? '';
  if (/swiftshader/i.test(s)) return 'SwiftShader';
  const angle = s.match(/^ANGLE \((.*)\)$/);
  if (angle) {
    // "fabricante, placa (0x…) Direct3D11 vs_5_0 ps_5_0, D3D11" → "placa"
    const parts = angle[1].split(', ');
    s = parts.length >= 2 ? parts[1] : parts[0];
  }
  s = s
    .replace(/^ANGLE Metal Renderer:\s*/i, '')
    .replace(/\(0x[0-9a-f]+\)/gi, '')
    .replace(/\b(Direct3D\d*|OpenGL|Vulkan|Metal|Unspecified Version)\b.*$/i, '')
    .replace(/\((TM|R)\)|™|®/gi, '')
    .replace(/^(AMD|ATI|NVIDIA|Intel)\s+(?=\S)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s) return s;
  if (info.vendor) return [info.vendor.toUpperCase(), info.architecture].filter(Boolean).join(' ');
  return '';
}

/** Nível inicial sugerido para a placa, ou null quando o nome não diz o bastante. */
export function tierForGpu(info: GpuInfo): StartTier | null {
  const r = (info.renderer ?? '').toLowerCase();
  const arch = (info.architecture ?? '').toLowerCase();
  const vendor = (info.vendor ?? '').toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(r)) return 'low';

  // NVIDIA: RTX 3060 em diante (e 2070 em diante) no Ultra; RTX 2060, x050, GTX 16 e GTX 1060+ na Alta.
  if (/titan|quadro rtx|rtx a\d{4}/.test(r)) return 'ultra';
  const rtx = r.match(/rtx\s*(\d{1,2})(\d)0\b/);
  if (rtx) {
    const gen = Number(rtx[1]), tier = Number(rtx[2]);
    return tier >= (gen === 20 ? 7 : 6) ? 'ultra' : 'high';
  }
  if (/gtx\s*16\d0/.test(r)) return 'high';
  const gtx10 = r.match(/gtx\s*10(\d)0/);
  if (gtx10) return Number(gtx10[1]) >= 6 ? 'high' : 'medium';
  if (/gtx|geforce\s*(mx|\d{3}m?\b)/.test(r)) return 'medium';

  // AMD de quatro dígitos: RX 7600, 6600 e acima no Ultra (RDNA 2 em diante), 5700 também.
  // A série 9000 (RDNA 4) só tem placas grandes, e a classe vem no terceiro dígito (9070, 9060).
  const rx = r.match(/\brx\s*(\d)(\d)\d0\b/);
  if (rx) {
    const series = Number(rx[1]), tier = Number(rx[2]);
    if (series === 9) return 'ultra';
    if (series >= 6) return tier >= 6 ? 'ultra' : tier === 5 ? 'high' : 'medium';
    if (series === 5) return tier >= 7 ? 'ultra' : tier >= 5 ? 'high' : 'medium';
  }
  // Polaris (RX 470 a 590): da 570 para cima na Alta, como a RX 580.
  const polaris = r.match(/\brx\s*[45](\d)0\b/);
  if (polaris) return Number(polaris[1]) >= 7 ? 'high' : 'medium';
  if (/radeon\s*vii/.test(r)) return 'ultra';
  if (/rx\s*vega|vega\s*(56|64)/.test(r)) return 'high';
  // Gráficos integrados dos Ryzen ("Radeon Graphics", "Vega 8", "780M"): Média.
  if (/radeon(\s*\(tm\))?\s*graphics|vega\s*\d+\b|radeon\s*\d{3}m\b/.test(r)) return 'medium';

  // Intel Arc dedicada: A750/A770 e as B no Ultra, A5xx na Alta; o resto (integradas) na Média;
  // os gráficos UHD e HD, mais fracos, na Baixa.
  const arc = r.match(/arc.*?\b([ab])(\d)\d0\b/);
  if (arc) return arc[1] === 'b' || Number(arc[2]) >= 7 ? 'ultra' : Number(arc[2]) >= 5 ? 'high' : 'medium';
  if (/arc|iris|xe graphics/.test(r)) return 'medium';
  if (/uhd|hd graphics/.test(r)) return 'low';

  // Apple: M Pro, Max e Ultra no Ultra; o chip básico na Alta.
  const m = r.match(/apple m(\d)(\s*(pro|max|ultra))?/);
  if (m) return m[3] ? 'ultra' : 'high';

  // Celulares (e o "Apple GPU" que o Safari informa): Média, como antes.
  if (/adreno|mali|powervr|immortalis|xclipse|apple gpu/.test(r)) return 'medium';

  // Sem nome (só o WebGPU): pela arquitetura.
  if (vendor === 'nvidia') return /blackwell|lovelace|ada|ampere/.test(arch) ? 'ultra' : /turing|pascal/.test(arch) ? 'high' : arch ? 'medium' : null;
  if (vendor === 'amd') return /rdna-?[234]/.test(arch) ? 'ultra' : /rdna-?1|gcn-?[45]/.test(arch) ? 'high' : arch ? 'medium' : null;
  if (vendor === 'intel') return /xe-?hpg|xe2|xe-?3/.test(arch) ? 'high' : 'medium';
  if (vendor === 'apple') return 'high';
  return null;
}
