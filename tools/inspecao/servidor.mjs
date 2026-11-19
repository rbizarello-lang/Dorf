// Inicia o servidor MCP instalado ao lado deste arquivo, em um perfil temporário do Chrome.
import { readFileSync } from 'node:fs';

const base = new URL('./node_modules/chrome-devtools-mcp/', import.meta.url);
const pacote = JSON.parse(readFileSync(new URL('package.json', base), 'utf8'));
const entrada = new URL(pacote.bin['chrome-devtools-mcp'], base);
process.argv.push('--isolated', '--headless', '--no-usage-statistics', '--no-performance-crux');
if (process.env.CHROMIUM_PATH) process.argv.push('--executablePath', process.env.CHROMIUM_PATH);
await import(entrada.href);
