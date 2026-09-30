// Converte dist/index.html (documento completo) no formato de página publicável:
// sem <!doctype>, <html>, <head> e <body>; título, fontes, estilo, conteúdo e script em sequência.
import fs from 'node:fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
const links = [...head.matchAll(/<link [^>]*>/g)].map((m) => m[0]).join('\n');
const styles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const scripts = [...head.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n');
const bodyNoScript = body.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
const out = [title, links, styles, bodyNoScript.trim(), scripts].join('\n');
fs.mkdirSync('dist/artifact', { recursive: true });
fs.writeFileSync('dist/artifact/retalhos.html', out);
console.log('dist/artifact/retalhos.html', (out.length / 1024).toFixed(0), 'KB');
