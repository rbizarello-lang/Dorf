// Abre o Chromium headless com WebGPU e WebGL2 por software (SwiftShader) para os
// scripts de captura e de carga. O WebGPU por software precisa do Vulkan do SwiftShader
// (sem ele o canvas perde o dispositivo); ?webgl na URL força o backend WebGL2.
// Ordem de busca do navegador:
//   1. CHROMIUM_PATH (qualquer Chromium ou Chrome);
//   2. o atalho /opt/pw-browsers/chromium dos contêineres do Claude Code na web;
//   3. o Chromium do próprio Playwright (instale com `npx playwright-core install chromium`).
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CONTAINER = '/opt/pw-browsers/chromium';

export function launch(extraArgs = []) {
  const executablePath = process.env.CHROMIUM_PATH ?? (fs.existsSync(CONTAINER) ? CONTAINER : undefined);
  return chromium.launch({
    executablePath,
    args: [
      '--ignore-certificate-errors',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--enable-unsafe-webgpu',
      '--use-webgpu-adapter=swiftshader',
      '--enable-features=Vulkan',
      '--use-vulkan=swiftshader',
      ...extraArgs,
    ],
  });
}
