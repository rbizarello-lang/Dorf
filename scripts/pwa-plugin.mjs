// Plugin do Vite: gera ao lado do dist/index.html (arquivo único) o que o jogo precisa para ser
// instalado e abrir sem internet: manifesto, ícones PNG desenhados aqui em código (sem arte) e o
// service worker. Só roda no build. O ícone é o mesmo hexágono em retalhos da aba do navegador.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const BG = [0xf1, 0xe6, 0xcf];
const STROKE = [0x4a, 0x2c, 0x1d];
const HEX = [[16, 2], [28, 9], [28, 23], [16, 30], [4, 23], [4, 9]];
// Os seis retalhos: centro, dois vértices consecutivos e a cor do terreno.
const PATCHES = [
  [[16, 2], [28, 9], [0x89, 0xb8, 0x4a]],
  [[28, 9], [28, 23], [0xe8, 0xb8, 0x3a]],
  [[28, 23], [16, 30], [0xd9, 0x64, 0x3f]],
  [[16, 30], [4, 23], [0x3f, 0x8f, 0x5a]],
  [[4, 23], [4, 9], [0x3f, 0x8f, 0xb8]],
  [[4, 9], [16, 2], [0xb9, 0xa3, 0x7a]],
];

const cross = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
function inTri(px, py, a, b) {
  const d1 = cross(16, 16, a[0], a[1], px, py);
  const d2 = cross(a[0], a[1], b[0], b[1], px, py);
  const d3 = cross(b[0], b[1], 16, 16, px, py);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
function distSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}

/** Cor de um ponto do desenho (coordenadas do viewBox 32×32), ou null fora do hexágono. */
function sample(x, y) {
  let edge = Infinity;
  for (let i = 0; i < 6; i++) edge = Math.min(edge, distSeg(x, y, HEX[i], HEX[(i + 1) % 6]));
  if (edge <= 0.8) return STROKE;
  for (const [a, b, c] of PATCHES) if (inTri(x, y, a, b)) return c;
  return null;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** PNG RGB quadrado; `scale` é a fração do lado que o hexágono ocupa (o resto é margem segura do ícone mascarável). */
export function iconPng(size, scale) {
  const ss = 4;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const half = size / 2;
  const unit = (size * scale) / 32; // pixels por unidade do viewBox
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const x = 16 + (px + (sx + 0.5) / ss - half) / unit;
          const y = 16 + (py + (sy + 0.5) / ss - half) / unit;
          const c = sample(x, y) ?? BG;
          r += c[0]; g += c[1]; b += c[2];
        }
      const o = py * (size * 3 + 1) + 1 + px * 3;
      raw[o] = Math.round(r / (ss * ss));
      raw[o + 1] = Math.round(g / (ss * ss));
      raw[o + 2] = Math.round(b / (ss * ss));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const MANIFEST = {
  name: 'Retalhos',
  short_name: 'Retalhos',
  description: 'Puzzle relaxante de peças hexagonais, com 14 temas de países e épocas.',
  lang: 'pt-BR',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'any',
  background_color: '#f1e6cf',
  theme_color: '#f3d3c8',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

// Rede primeiro, cache se estiver sem internet: quem joga nunca fica preso numa versão velha.
// Só o próprio jogo (mesma origem) passa por aqui; as fontes do Google ficam de fora (há reserva no CSS).
const swSource = (version) => `// Gerado por scripts/pwa-plugin.mjs. Versão do build: ${version}
const CACHE = 'retalhos-${version}';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('retalhos-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Os parâmetros de URL (?theme=, ?seed=...) não mudam o arquivo: o cache guarda a página sem eles.
  const nav = req.mode === 'navigate';
  const key = nav ? new Request(new URL('./index.html', self.location).href) : req;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(key, { ignoreSearch: true });
      try {
        // Com cópia guardada, uma rede lenta espera no máximo 4 s antes de abrir a cópia.
        const fresh = fetch(nav ? new Request(new URL('./index.html', self.location).href + url.search, { cache: 'no-cache' }) : req, { cache: 'no-cache' });
        const res = await (cached ? Promise.race([fresh, new Promise((_, no) => setTimeout(no, 4000))]) : fresh);
        if (res.ok) cache.put(key, res.clone());
        return res;
      } catch {
        return cached || Response.error();
      }
    })(),
  );
});
`;

export function pwa() {
  let outDir = 'dist';
  return {
    name: 'retalhos-pwa',
    apply: 'build',
    configResolved(cfg) {
      outDir = path.resolve(cfg.root, cfg.build.outDir);
    },
    // Injeção por tag: o Vite não tenta resolver nem embutir esses caminhos.
    transformIndexHtml() {
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: 'manifest.webmanifest' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: 'icon-192.png' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: MANIFEST.theme_color }, injectTo: 'head' },
      ];
    },
    // O vite-plugin-singlefile mexe no index.html até o fim: a versão sai do arquivo final.
    closeBundle: {
      order: 'post',
      handler() {
        const index = path.join(outDir, 'index.html');
        if (!fs.existsSync(index)) return;
        const version = crypto.createHash('sha1').update(fs.readFileSync(index)).digest('hex').slice(0, 10);
        fs.writeFileSync(path.join(outDir, 'manifest.webmanifest'), JSON.stringify(MANIFEST, null, 2));
        fs.writeFileSync(path.join(outDir, 'icon-192.png'), iconPng(192, 0.86));
        fs.writeFileSync(path.join(outDir, 'icon-512.png'), iconPng(512, 0.86));
        fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), iconPng(512, 0.62));
        fs.writeFileSync(path.join(outDir, 'sw.js'), swSource(version));
      },
    },
  };
}
