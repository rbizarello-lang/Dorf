import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Arquivo único (dist/index.html), com JS e CSS embutidos.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
