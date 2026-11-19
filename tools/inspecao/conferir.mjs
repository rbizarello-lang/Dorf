// Confere o contrato e o custo das etiquetas pelo mesmo protocolo que o cliente MCP usa.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

const server = spawn(process.execPath, [fileURLToPath(new URL('./servidor.mjs', import.meta.url))], {
  stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true,
});
const lines = createInterface({ input: server.stdout })[Symbol.asyncIterator]();
let id = 0;
let pageId;
const current = fileURLToPath(new URL('../../dist/index.html', import.meta.url));
const files = process.argv[2] ? [resolve(process.argv[2]), current] : [current];
const roots = files.map((f) => ({ uri: pathToFileURL(dirname(f)).href }));
async function request(method, params) {
  const current = ++id;
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: current, method, params }) + '\n');
  for (;;) {
    const line = await lines.next();
    if (line.done) throw new Error('O servidor encerrou a conexão MCP');
    const reply = JSON.parse(line.value);
    if (reply.method === 'roots/list') {
      server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: reply.id, result: { roots } }) + '\n');
      continue;
    }
    if (reply.id !== current) continue;
    if (reply.error) throw new Error(JSON.stringify(reply.error));
    return reply.result;
  }
}
async function call(name, args) {
  const result = await request('tools/call', { name, arguments: { pageId, ...args } });
  const message = result.content.map((item) => item.text ?? '').join('\n');
  assert(!result.isError, name + ' · ' + message);
  return message;
}

// Conta chamadas de escrita de cor nas etiquetas enquanto a câmera fica parada.
async function measureLabels() {
  const deadline = performance.now() + 40000;
  while (document.querySelectorAll('#markers .marker').length < 3 && performance.now() < deadline) await new Promise(requestAnimationFrame);
  const styles = new Set([...document.querySelectorAll('#markers .marker')].map((el) => el.style));
  const proto = CSSStyleDeclaration.prototype, original = proto.setProperty;
  let writes = 0;
  proto.setProperty = function (name, ...args) {
    if (name === '--c' && styles.has(this)) writes++;
    return original.call(this, name, ...args);
  };
  try {
    for (let i = 0; i < 90; i++) await new Promise(requestAnimationFrame);
    return { backend: window.__stats.backend, gpu: window.__stats.gpu, labels: styles.size, writes };
  } finally { proto.setProperty = original; }
}

const timeout = setTimeout(() => server.kill(), 120000);
try {
  const hello = await request('initialize', { protocolVersion: '2025-06-18', capabilities: { roots: {} }, clientInfo: { name: 'entrepostos', version: '1' } });
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const { tools } = await request('tools/list', {});
  console.log(hello.serverInfo.name, hello.serverInfo.version, tools.length, 'ferramentas');
  const pages = await call('list_pages', {});
  const first = pages.match(/(?:^|\n)(\d+):/);
  assert(first, pages);
  pageId = Number(first[1]);
  for (const file of files) {
    await call('navigate_page', { type: 'url', url: pathToFileURL(file).href + '?seed=42&quality=high&debug' });
    await call('wait_for', { text: ['Ver mapa'], timeout: 45000 });
    const measurement = await call('evaluate_script', { function: measureLabels.toString() });
    console.log(file, measurement);
    assert.match(measurement, /"labels"\s*:\s*3/);
    if (file === current) {
      assert.match(measurement, /"writes"\s*:\s*0\b/);
      const tree = await call('take_snapshot', {});
      const choice = tree.match(/uid=([\d_]+) button "Escolher frete"/);
      assert(choice, 'A carta deve oferecer a escolha inicial');
      await call('click', { uid: choice[1] });
      assert.match(await call('take_snapshot', {}), /Madeira para a Feira/);
      const errors = await call('list_console_messages', { types: ['error'] });
      assert.doesNotMatch(errors, /msgid=/);
    }
  }
} finally {
  clearTimeout(timeout);
  server.stdin.end();
}
