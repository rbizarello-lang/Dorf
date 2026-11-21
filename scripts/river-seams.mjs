// Caso dirigido de emendas da Paisagem viva. Usa o navegador para criar o World e medir a malha já assentada.
// Uso: node scripts/river-seams.mjs [--controle]
// --controle mantém as verificações de geometria e reconstrução, sem exigir o novo alargamento.
import { createServer } from 'vite';
import { launch } from './browser.mjs';

const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  browser = await launch(['--ignore-gpu-blocklist']);
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  await page.route(base + 'emendas.html', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Emendas de rio</title>' }));
  await page.goto(base + 'emendas.html');
  const result = await page.evaluate(async (control) => (await import('/tests/river-seams.ts')).run(control), process.argv.includes('--controle'));
  for (const line of result.observations) console.log(line);
  for (const error of result.errors) console.error('FALHOU:', error);
  process.exitCode = result.errors.length ? 1 : 0;
} finally {
  await browser?.close();
  await server.close();
}
