// Comparação de capturas: 6 vistas fixas, diferença por pixel entre duas pastas.
// Uso:
//   node scripts/compare.mjs grava <pasta>              grava as 6 capturas de referência
//   node scripts/compare.mjs compara <pastaA> <pastaB>  compara duas pastas já gravadas
//   node scripts/compare.mjs confere <pastaRef>         grava em .cache/compare/agora e compara com a referência
// Variáveis: BASE (URL do servidor, padrão http://127.0.0.1:4173/), WAIT (ms, padrão 9000),
//   TOL_PCT (máx. % de pixels diferentes por captura, padrão 0.5), TOL_MEAN (máx. diferença média 0 a 255, padrão 0.5),
//   CH (limiar por canal, 0 a 255, padrão 12).
// Grava na pasta B uma imagem de diferença ampliada (diff-<nome>.png, ×4) por captura.
// Roda à mão, fora da CI: o SwiftShader varia. Use a mesma máquina e o mesmo servidor nas duas rodadas.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';

// Vistas fixas: semente fixa e mundo quase parado (timescale baixo) para reduzir a variação entre rodadas.
const SHOTS = {
  holanda: 'theme=holanda&seed=7&auto=40&time=day&timescale=0.001',
  'egito-entardecer': 'theme=egito&seed=4&auto=40&time=dusk&timescale=0.001',
  noite: 'theme=holanda&seed=7&auto=40&time=night&timescale=0.001',
  'zoom-aberto': 'theme=holanda&seed=11&auto=60&time=day&zoom=18&timescale=0.001',
  'rio-perto': 'theme=egito&seed=4&auto=32&zoom=4&focus=4&time=day&timescale=0.001',
  'vila-perto': 'theme=oriental&seed=5&auto=40&zoom=4&time=day&timescale=0.001',
};

const base = (process.env.BASE ?? 'http://127.0.0.1:4173/').replace(/\/?$/, '/');
const CH = Number(process.env.CH ?? 12);
const TOL_PCT = Number(process.env.TOL_PCT ?? 0.5);
const TOL_MEAN = Number(process.env.TOL_MEAN ?? 0.5);

async function grava(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await launch(['--ignore-gpu-blocklist']);
  for (const [name, q] of Object.entries(SHOTS)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}?${q}`);
    await page.waitForTimeout(Number(process.env.WAIT ?? 9000));
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
    console.log('gravou', name, errors.length ? `(${errors.length} erro(s) de página)` : '');
    await page.close();
  }
  await browser.close();
}

// Decodifica e compara no próprio Chromium (canvas), sem biblioteca de PNG.
async function compara(a, b) {
  const browser = await launch(['--ignore-gpu-blocklist']);
  const page = await browser.newPage();
  await page.goto('about:blank');
  let falhou = false;
  console.log(`limiar por canal ${CH}; tolerância: ${TOL_PCT}% dos pixels e média ${TOL_MEAN}`);
  for (const name of Object.keys(SHOTS)) {
    const fa = path.join(a, `${name}.png`), fb = path.join(b, `${name}.png`);
    if (!fs.existsSync(fa) || !fs.existsSync(fb)) { console.log(name.padEnd(18), 'FALTA captura'); falhou = true; continue; }
    const r = await page.evaluate(async ({ da, db, ch }) => {
      const load = (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'data:image/png;base64,' + s; });
      const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height); };
      const A = px(await load(da)), B = px(await load(db));
      if (A.width !== B.width || A.height !== B.height) return { erro: 'tamanhos diferentes' };
      const n = A.width * A.height, out = new ImageData(A.width, A.height);
      let diff = 0, soma = 0;
      for (let i = 0; i < n; i++) {
        let m = 0;
        for (let k = 0; k < 3; k++) { const d = Math.abs(A.data[i * 4 + k] - B.data[i * 4 + k]); soma += d; if (d > m) m = d; }
        if (m > ch) diff++;
        // diferença ampliada ×4 em vermelho, sobre a captura B esmaecida
        out.data[i * 4] = Math.min(255, B.data[i * 4] * 0.25 + m * 4);
        out.data[i * 4 + 1] = B.data[i * 4 + 1] * 0.25;
        out.data[i * 4 + 2] = B.data[i * 4 + 2] * 0.25;
        out.data[i * 4 + 3] = 255;
      }
      const c = document.createElement('canvas'); c.width = A.width; c.height = A.height; c.getContext('2d').putImageData(out, 0, 0);
      return { pct: (diff / n) * 100, mean: soma / (n * 3), png: c.toDataURL('image/png').split(',')[1] };
    }, { da: fs.readFileSync(fa).toString('base64'), db: fs.readFileSync(fb).toString('base64'), ch: CH });
    if (r.erro) { console.log(name.padEnd(18), r.erro); falhou = true; continue; }
    fs.writeFileSync(path.join(b, `diff-${name}.png`), Buffer.from(r.png, 'base64'));
    const ok = r.pct <= TOL_PCT && r.mean <= TOL_MEAN;
    if (!ok) falhou = true;
    console.log(name.padEnd(18), `${r.pct.toFixed(3)}% diferentes`.padEnd(22), `média ${r.mean.toFixed(3)}`.padEnd(15), ok ? 'ok' : 'ACIMA DA TOLERÂNCIA');
  }
  await browser.close();
  console.log(falhou ? 'FALHOU' : 'ok: tudo dentro da tolerância');
  process.exitCode = falhou ? 1 : 0;
}

const [cmd, p1, p2] = process.argv.slice(2);
if (cmd === 'grava' && p1) await grava(p1);
else if (cmd === 'compara' && p1 && p2) await compara(p1, p2);
else if (cmd === 'confere' && p1) { const agora = '.cache/compare/agora'; await grava(agora); await compara(p1, agora); }
else { console.error('Uso: compare.mjs grava <pasta> | compara <A> <B> | confere <pastaRef>'); process.exit(2); }
