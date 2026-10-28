import fs from 'node:fs';
import { F, COUNTS } from './figs.mjs';
import { IDEIAS, FAM } from './ideas.mjs';

const OUT = '/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/encaixe/propostas.html';
const IMG = '/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/encaixe/img/';
const b64 = f => 'data:image/jpeg;base64,' + fs.readFileSync(IMG + f + '.jpg').toString('base64');
const SZ = { P: 'P · dias', M: 'M · 1 a 2 semanas', G: 'G · várias semanas' };
const lv = v => `<span class="lv lv-${v.normalize('NFD').replace(/[^a-z]/g, '')}">${v}</span>`;
const famOf = i => FAM[i.fam].curto;
const num = (i) => IDEIAS.indexOf(i) + 1;

let BB = {}; try { BB = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/encaixe/build/bbox.json', 'utf8')); } catch {}
function fit(id, svg) {
  const b = BB[id]; if (!b) return svg;
  const px = 16, py = 14; let w = b.w + 2 * px, x = b.x - px; if (w < 260) { x -= (260 - w) / 2; w = 260; }
  const y = b.y - py, h = b.h + 2 * py; const r = v => Math.round(v * 10) / 10;
  return svg.replace(/viewBox="[^"]+"/, `viewBox="${r(x)} ${r(y)} ${r(w)} ${r(h)}"`).replace(/<rect class="bg"[^>]*>/, `<rect class="bg" x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="12"/>`);
}
const css = `
:root{--bg:#f2f4ef;--fg:#1d2a24;--muted:#56665d;--card:#fbfcf8;--line:#cdd7cc;--accent:#1f6f8b;--accent-bg:#dcecf2;--gold:#e3b23c;--gold-bg:#fbf0cf;--gold-fg:#4a3604;--ink:#2a3a32;--halo:#fbfcf8;--void:#ece7d6;--voidline:#a89f82;--pencil:#7b7560;--ok:#2d7a4a;--warn:#a8432c;--p:#2d7a4a;--m:#8a6a10;--g:#a8432c;--code:#e6ebe2;--shadow:0 1px 2px rgba(20,40,30,.08);color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#121815;--fg:#e4ebe5;--muted:#9bada2;--card:#1b2420;--line:#31423a;--accent:#7cc3e0;--accent-bg:#1c3641;--gold-bg:#3a3014;--gold-fg:#f3dc92;--ink:#dbe6de;--halo:#1b2420;--void:#2b2a21;--voidline:#6a664d;--pencil:#a39d85;--ok:#6fcf93;--warn:#f08a70;--p:#6fcf93;--m:#e6c25a;--g:#f08a70;--code:#26322c;--shadow:none;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#121815;--fg:#e4ebe5;--muted:#9bada2;--card:#1b2420;--line:#31423a;--accent:#7cc3e0;--accent-bg:#1c3641;--gold-bg:#3a3014;--gold-fg:#f3dc92;--ink:#dbe6de;--halo:#1b2420;--void:#2b2a21;--voidline:#6a664d;--pencil:#a39d85;--ok:#6fcf93;--warn:#f08a70;--p:#6fcf93;--m:#e6c25a;--g:#f08a70;--code:#26322c;--shadow:none;color-scheme:dark}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:400 17px/1.55 'Alegreya Sans','Segoe UI',system-ui,sans-serif}
.wrap{max-width:900px;margin:0 auto;padding-block:28px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1,h2,h3{font-family:'Alegreya','Georgia',serif;line-height:1.15;margin:0;font-weight:700}
h1{font-size:clamp(34px,8vw,52px);letter-spacing:-.01em}
h1 small{display:block;font:italic 500 clamp(17px,4vw,21px)/1.3 'Alegreya',Georgia,serif;color:var(--muted);margin-top:8px;letter-spacing:0}
h2{font-size:clamp(26px,6vw,34px);margin:56px 0 6px;padding-top:14px;border-top:2px solid var(--fg)}
h3{font-size:clamp(22px,5vw,27px)}
h4{font:700 12.5px/1 'Alegreya Sans',sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:0 0 4px}
p{margin:0 0 .8em;max-width:65ch}
a{color:var(--accent)}
code{font:500 .86em ui-monospace,Menlo,Consolas,monospace;background:var(--code);padding:1px 4px;border-radius:4px;overflow-wrap:anywhere}
.lede{font-size:19px;max-width:60ch;margin-top:16px}
.toc{margin:22px 0 0;padding:14px 16px;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow)}
.toc b{font:700 12.5px 'Alegreya Sans',sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);display:block;margin:8px 0 6px}
.toc b:first-child{margin-top:0}
.toc ol,.toc ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 8px}
.toc li a{display:inline-block;padding:3px 9px;border-radius:99px;border:1px solid var(--line);text-decoration:none;font-size:15px;color:var(--fg);background:var(--bg)}
.toc li a:hover,.toc li a:focus-visible{border-color:var(--accent);color:var(--accent)}
.toc li a i{font:italic 700 14px 'Alegreya',serif;color:var(--muted);margin-right:3px}
.sum{margin-top:8px}
.decide{margin:18px 0;padding:16px 18px;border-radius:14px;background:var(--gold-bg);color:var(--gold-fg);border:1.5px solid var(--gold)}
.decide h3{font-size:21px;margin-bottom:6px;color:inherit}
.decide p{max-width:68ch}
.decide ul{margin:6px 0 0;padding-left:20px;max-width:68ch}
.decide a{color:inherit;font-weight:700}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);margin:16px 0}
table{border-collapse:collapse;width:100%;min-width:560px;font-size:15.5px}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:700 12px 'Alegreya Sans',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);background:var(--bg);position:sticky;top:0}
tr:last-child td{border-bottom:0}
td.n{font:italic 700 16px 'Alegreya',serif;color:var(--muted);width:32px}
tr.grp td{background:var(--bg);font:700 13px 'Alegreya Sans',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
tr.mine td{background:var(--gold-bg)}
.lv{white-space:nowrap}
.lv::before{content:'';display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:-1px;background:var(--line);border:1.5px solid var(--muted)}
.lv-alta::before{background:var(--ok);border-color:var(--ok)}
.lv-media::before{background:linear-gradient(90deg,var(--m) 50%,transparent 50%);border-color:var(--m)}
.lv-baixa::before{background:transparent;border-color:var(--warn)}
.sz{display:inline-block;font:700 13px 'Alegreya Sans',sans-serif;padding:1px 9px;border-radius:99px;border:1.5px solid currentColor}
.sz-P{color:var(--p)}.sz-M{color:var(--m)}.sz-G{color:var(--g)}
.leg{font-size:14.5px;color:var(--muted);margin:-6px 0 0;max-width:80ch}
.recs{display:grid;gap:12px;margin:14px 0 0;padding:0;list-style:none;counter-reset:r}
.recs li{counter-increment:r;position:relative;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px 12px 52px;box-shadow:var(--shadow)}
.recs li::before{content:counter(r);position:absolute;left:14px;top:9px;font:italic 700 30px/1 'Alegreya',serif;color:var(--accent)}
.recs b{font-family:'Alegreya',serif;font-size:19px}
.recs p{margin:2px 0 0;font-size:16px;max-width:62ch}
.fam-note{max-width:68ch;color:var(--muted);font-size:17px;margin:4px 0 0}
.idea{margin:34px 0 0;padding:20px 0 0;border-top:1px solid var(--line)}
.idea header{display:flex;flex-direction:column;gap:6px}
.idea .k{font:italic 700 15px 'Alegreya',serif;color:var(--muted)}
.idea .resumo{font:italic 500 19px/1.35 'Alegreya',Georgia,serif;margin:0;max-width:60ch}
.meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:15px;align-items:center;margin-top:4px}
.meta span.m b{font-weight:600;color:var(--muted);margin-right:4px}
.flag{font:700 12.5px 'Alegreya Sans',sans-serif;letter-spacing:.05em;text-transform:uppercase;padding:2px 9px;border-radius:99px;background:var(--gold);color:#2b2410;align-self:flex-start}
.flag.t{background:var(--accent-bg);color:var(--accent)}
.pic{display:grid;gap:12px;margin:14px 0 0}
@media (min-width:760px){.pic.two{grid-template-columns:1fr 1fr}}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:var(--shadow)}
figure svg,figure img{display:block;width:100%;height:auto}
figcaption{font-size:14.5px;line-height:1.4;color:var(--muted);padding:8px 12px 10px;border-top:1px solid var(--line)}
figcaption b{color:var(--fg)}
.cols{display:grid;gap:16px;margin-top:18px}
@media (min-width:760px){.cols{grid-template-columns:1fr 1fr;gap:18px 28px}.cols .wide{grid-column:1/-1}}
.blk ul{margin:0;padding-left:19px;max-width:62ch}
.blk li{margin-bottom:3px}
.blk.ex{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:8px;padding:10px 14px}
.blk.aval{border-left:4px solid var(--gold);padding-left:12px}
.rec-box{margin-top:18px}
.note{margin:46px 0 0;padding:14px 16px;border:1px dashed var(--muted);border-radius:12px;color:var(--muted);max-width:72ch}
.note h3{font-size:19px;color:var(--fg);margin-bottom:4px}
.foot{margin-top:36px;font-size:14px;color:var(--muted)}
svg .bg{fill:var(--void)}
svg .t{font-family:'Alegreya Sans','Segoe UI',sans-serif;font-weight:600;fill:var(--ink);paint-order:stroke;stroke:var(--halo);stroke-width:3.6px;stroke-linejoin:round}
svg .t.b{font-weight:800}
svg .bt{font-family:'Alegreya Sans','Segoe UI',sans-serif}
svg .pn{font-family:'Alegreya',serif;fill:var(--pencil)}
`;

// ---- seções ----
const lis = a => '<ul>' + a.map(x => `<li>${x}</li>`).join('') + '</ul>';
function idea(i) {
  const n = num(i);
  const flags = (i.decidida ? '<span class="flag">Decisão do Roger: gostou</span>' : '') + (i['protótipo'] ? '<span class="flag t">Protótipo em teste</span>' : '');
  const fig = `<figure>${fit(i.id, F[i.id])}<figcaption><b>Esquema.</b> ${i.cap}</figcaption></figure>`;
  const foto = i.foto ? `<figure><img src="${b64(i.foto.f)}" width="600" height="360" loading="lazy" alt="${i.foto.alt}"><figcaption>${i.foto.cap}</figcaption></figure>` : '';
  return `<article class="idea" id="${i.id}">
<header><span class="k">${n} de 20 · ${famOf(i)}</span><h3>${i.nome}</h3>${flags}<p class="resumo">${i.resumo}</p>
<div class="meta"><span class="m"><b>Custo</b><span class="sz sz-${i.size}">${SZ[i.size]}</span></span><span class="m"><b>Originalidade</b>${lv(i.orig)}</span><span class="m"><b>Calma</b>${lv(i.calma)}</span></div></header>
<div class="pic${i.foto ? ' two' : ''}">${fig}${foto}</div>
<div class="cols">
<div class="blk wide"><h4>Como joga</h4>${i.regra.map(r => `<p>${r}</p>`).join('')}</div>
<div class="blk ex wide"><h4>Exemplo de jogada</h4><p>${i.ex}</p></div>
<div class="blk"><h4>O que o jogador sente</h4><p>${i.sente}</p></div>
<div class="blk"><h4>Quanto difere dos outros jogos</h4><p>${i.difere}</p></div>
<div class="blk"><h4>Riscos</h4>${lis(i.riscos)}</div>
<div class="blk aval"><h4>Avaliação de quem propôs</h4><p>${i.aval}</p></div>
</div></article>`;
}

const rows = ['e1', 'e2', 'e3'].map(f => `<tr class="grp"><td colspan="6">${FAM[f].tag} · ${FAM[f].nome}</td></tr>` + IDEIAS.filter(i => i.fam === f).map(i => `<tr${i.decidida ? ' class="mine"' : ''}><td class="n">${num(i)}</td><td><a href="#${i.id}">${i.nome}</a>${i.decidida ? ' <b>(decidida)</b>' : ''}${i['protótipo'] ? ' <b>(em teste)</b>' : ''}</td><td>${famOf(i)}</td><td><span class="sz sz-${i.size}">${i.size}</span></td><td>${lv(i.orig)}</td><td>${lv(i.calma)}</td></tr>`).join('')).join('');

const toc = `<nav class="toc" aria-label="Índice"><b>Começo</b><ul><li><a href="#resumo">Resumo</a></li><li><a href="#recomendacoes">Recomendações</a></li></ul>` +
  ['e1', 'e2', 'e3'].map(f => `<b>${FAM[f].tag} · ${FAM[f].nome}</b><ol>${IDEIAS.filter(i => i.fam === f).map(i => `<li><a href="#${i.id}" title="${i.nome.replace(/^[A-F]\. /, '')}" aria-label="${num(i)}: ${i.nome.replace(/^[A-F]\. /, '')}"><i>${num(i)}</i></a></li>`).join('')}</ol>`).join('') +
  `<b>Fim</b><ul><li><a href="#colcha">Nota: a Colcha</a></li></ul></nav>`;

const html = `<title>Encaixes do Retalhos</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,500;0,700;1,500;1,700&family=Alegreya+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${css}</style>
<div class="wrap">
<header>
<h1>Encaixes do Retalhos<small>vinte jeitos de a peça encontrar a vizinha, cada um com o seu desenho</small></h1>
<p class="lede">O Roger pediu mais detalhes sobre todas as propostas de encaixe e uma imagem de cada uma. Aqui estão as 20 ideias dos três relatórios (7 próximas, 7 radicais e 6 desenhos de relevo na peça): a regra com um exemplo de jogada em números, o que o jogador sente, em que difere do Dorfromantik, o custo, os riscos e o que o agente que a propôs concluiu.</p>
</header>
${toc}

<section id="resumo" class="sum">
<h2 style="margin-top:44px">Resumo</h2>
<div class="decide"><h3>O que o Roger já decidiu</h3>
<ul><li><strong>Água:</strong> gostou de <a href="#aguas-descem">Águas que descem</a> (a água precisa chegar ao mar, e quem manda é o relevo).</li>
<li><strong>Relevo:</strong> quer mais fluido, não reto. O protótipo do modo Relevo (<a href="#relevo-casa">A</a> e <a href="#relevo-degrau">B</a>) está em teste.</li></ul></div>
<h2 id="recomendacoes" style="margin-top:40px">As 3 recomendações</h2>
<ol class="recs">
<li><b><a href="#aguas-descem">Águas que descem</a></b><p>Já decidida pelo Roger e a favorita do agente: reaproveita 85% do que existe, não trava ninguém e liga por <code>Rules.springs</code>. Condição: o relevo precisa aparecer no vazio. O modo Relevo em teste (A e B) é a base natural.</p></li>
<li><b><a href="#estacao-decide">A estação decide o encaixe</a></b><p>A mais "nossa" das próximas: usa estações e <code>seasonLock</code> que já existem, é P no <code>core</code> e neutra no equilíbrio (+1% na média, p10 +5%). Pede <code>SAVE_VERSION</code> novo.</p></li>
<li><b><a href="#vau-ponte">Vau e ponte</a></b><p>P e barata: o kit <code>bridge</code> já existe em todos os temas, e o rio cruzado pelo trilho é a cena mais bonita de longe. Vale pela cena, não pelo equilíbrio.</p></li>
</ol>
<p style="margin-top:12px;color:var(--muted)">Depois delas, na ordem do agente: <a href="#sol-sombra">Sol e sombra</a>, <a href="#peregrino">Peregrino</a> e <a href="#espera-rende">A espera rende</a> (com teto 2). As piores relações entre custo e benefício: <a href="#meia-borda">Meia-borda</a>, <a href="#mapa-lapis">Mapa a lápis</a> e <a href="#sucessao-paisagem">Sucessão da paisagem</a>.</p>
<h2 style="margin-top:40px;font-size:24px">As 20 ideias em uma tabela</h2><div class="tw"><table><thead><tr><th>#</th><th>Ideia</th><th>Família</th><th>Tam.</th><th>Originalidade</th><th>Calma</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="leg"><b>Tamanho:</b> P são dias, M uma a duas semanas, G várias semanas. Originalidade e calma são a leitura de quem escreveu este documento a partir dos relatórios: pontos cheios são o melhor, vazados o pior.</p>

</section>

${['e1', 'e2', 'e3'].map(f => `<section id="${f === 'e1' ? 'proximas' : f === 'e2' ? 'radicais' : 'relevo'}"><h2>${FAM[f].tag} · ${FAM[f].nome}</h2><p class="fam-note">${FAM[f].intro}</p>${f === 'e3' ? `<div class="decide"><h3>Relevo mais fluido, não reto</h3><p>Leitura de quem escreveu: os desenhos A e B hoje fazem degraus de parede reta entre setores. Para o relevo fluir, a borda de cada peça teria altura contínua (uma ladeira que casa com a da vizinha, com parede só onde sobra um degrau). Isso ainda não está desenhado nos relatórios e é o próximo ajuste do protótipo.</p></div>` : ''}${IDEIAS.filter(i => i.fam === f).map(idea).join('')}</section>`).join('\n')}

<aside class="note" id="colcha"><h3>Nota: a Colcha, rejeitada</h3>
<p>Antes destes relatórios houve a proposta dos "nós de colcha" (botões de lã nos cantos das peças: três peças com a mesma cor num canto amarravam um nó e davam +15). O Roger a rejeitou porque era uma camada abstrata, sem ligação com a paisagem. É a razão de todas as ideias acima partirem do que se vê no mapa (rio, estação, morro, sol, gente), e nunca de uma camada solta por cima.</p></aside>
<p class="foot">Ilustrações: esquemas desenhados à mão em SVG, com as cores do jogo; capturas reais do Retalhos em JPEG reduzido. Os números dos exemplos seguem as regras descritas nos relatórios; os valores de bônus ainda sem calibração (por exemplo em B e D) são ilustrativos.</p>
</div>
`;
fs.writeFileSync(OUT, html);
console.log(OUT, (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB');
console.log(JSON.stringify(COUNTS));
