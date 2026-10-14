import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { pwa } from './scripts/pwa-plugin.mjs';

// `npm run build` gera dist/index.html com todo o JS/CSS embutido,
// o que facilita publicar o protótipo como uma única página. Ao lado dele saem o manifesto,
// os ícones e o service worker (scripts/pwa-plugin.mjs), para instalar e jogar sem internet.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile(), pwa()],
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
