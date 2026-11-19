# Desempenho de Entrepostos 0.3

Ensaio de 17/11/2026 em Windows, Chrome headless, viewport 1280 × 800, GeForce RTX 3060 reportada pelo navegador. A comparação de edições usa WebGPU, semente 42, qualidade Alta e zoom 8. A cena curta parte de um replay de oito jogadas em Entrepostos/Holanda (9 peças com a inicial). A cena de carga usa o modo Clássico/Vale e `stress=300` (301 peças com a inicial).

- **0.2.0** — HTML de `Retalhos-Entrepostos-Fretes/dist/index.html`, SHA-256 `80b25876eb962dd02c6408e2501cb5bb61c17f60ca26a8d3404d2d518d8ea44`.
- **0.3 (infraestrutura)** — HTML de `.cache/benchmark-03.html`, SHA-256 `78b7698aefb87fd62abeed02f0ffe6aca062eba7b64e5142864269e0b612e90c`. A medição antecede Costa dos Terraços e Paisagem viva. [Snapshot compactado](medicoes/benchmark-infra-2026-11-17.html.gz)

## Comparação de edições

O roteiro alternou a ordem das edições por rodada e abriu um navegador por combinação de cenário, edição e rodada. Cada janela tem 45 callbacks de espera e 60 intervalos de `requestAnimationFrame` (rAF). A ação é disparada depois dos oito primeiros intervalos. A troca fria é a primeira ida de Alta para Média naquela sessão, medida uma vez em cada combinação. A quente ocorre depois da primeira ida a Média e do retorno a Alta. As duas janelas quentes da primeira rodada com 301 peças foram coletadas em nova sessão, repetindo o repouso, o giro e a primeira troca. A tabela apresenta a mediana das janelas para cada métrica. Todos os tempos estão em milissegundos.

| Peças iniciais | Ação | Janelas por edição | p95 rAF 0.2 → 0.3 | Maior intervalo por janela 0.2 → 0.3 | Chamada síncrona 0.2 → 0.3 |
|---:|---|---:|---:|---:|---:|
| 9 | Repouso | 5 | 16,9 → 16,9 | 17,1 → 17,0 | — |
| 9 | Giro | 5 | 16,9 → 16,9 | 116,4 → 150,2 | 112,9 → 90,0 |
| 9 | Troca fria | 1 | 83,3 → 17,1 | 3.533,2 → 3.449,8 | 79,3 → 7,6 |
| 9 | Troca quente | 5 | 33,2 → 17,0 | 1.650,1 → 283,4 | 70,5 → 3,9 |
| 9 | Colocação (10ª peça) | 5 | 50,0 → 150,0 | 966,4 → 649,9 | 17,3 → 18,4 |
| 301 | Repouso | 5 | 50,0 → 16,9 | 50,2 → 33,4 | — |
| 301 | Giro | 5 | 33,6 → 17,0 | 116,6 → 100,2 | 91,4 → 97,4 |
| 301 | Troca fria | 1 | 16,9 → 17,0 | 3.399,9 → 4.049,8 | 636,0 → 5,5 |
| 301 | Troca quente | 5 | 183,4 → 17,5 | 1.983,1 → 216,7 | 556,1 → 2,9 |

A troca aquecida reduziu o tempo síncrono e a duração das travadas observadas. A primeira troca ainda gerou um intervalo de 3,45 s na cena curta e 4,05 s no mapa cheio da revisão 0.3. O p95 de uma janela de 60 intervalos pode deixar esse pico de fora. Na carga com 301 peças, o teste de colocação manteve a contagem em 301 nas duas versões e foi excluído da comparação de jogadas. A colocação confirmada na cena curta teve resultado misto. Os tempos de submissão mostram trabalho do lado de CPU. O intervalo entre callbacks rAF mede a cadência e inclui esperas, com cerca de 16,7 ms no patamar de 60 Hz. O ensaio prescinde de timestamps da GPU.

Em repouso com 301 peças, os contadores de draw calls ficaram em 147 → 149 e os triângulos em 1,71 → 1,55 milhão. A 0.2 expõe a leitura do último quadro para esses contadores. O snapshot da 0.3 expõe a média da janela e inclui medidas separadas do renderizador da pilha. Os dados individuais guardam p50, p95, máximos, tarefas longas observadas e os contadores disponíveis. [Dados por edição](desempenho-0.3-edicoes.json) · [Roteiro](../scripts/medir-cartas.mjs)

## Agrupamento experimental de vegetação

Ensaio no protótipo de infraestrutura, em repouso, modo Clássico/Vale, 301 peças, semente 42, Alta. Cinco janelas sequenciais por condição, na mesma página. O roteiro inverte a ordem dos tamanhos de região no zoom 28. Cada linha mostra medianas por janela.

| Backend | Zoom | Agrupamento | Draw calls | Triângulos | CPU cena (ms) | p95 rAF (ms) |
|---|---:|---|---:|---:|---:|---:|
| WebGPU | 8 | Global | 148 | 1.551.128 | 5,49 | 16,7 |
| WebGPU | 8 | 4 × 4 | 322 | 972.928 | 12,28 | 16,8 |
| WebGPU | 8 | 8 × 8 | 222 | 1.092.010 | 8,53 | 16,7 |
| WebGPU | 28 | Global | 136 | 1.125.827 | 5,22 | 16,7 |
| WebGPU | 28 | 4 × 4 | 369 | 1.006.260 | 14,19 | 16,7 |
| WebGPU | 28 | 8 × 8 | 235 | 1.112.175 | 9,36 | 16,7 |
| WebGL2 | 8 | Global | 149 | 1.551.187 | 5,38 | 16,8 |

Em WebGPU, o descarte por região reduz a geometria enviada, principalmente no zoom 8. O ganho veio com mais draw calls e mais tempo de submissão da cena em ambos os zooms, no mesmo patamar de cadência. Por isso, o agrupamento global continua como padrão da vegetação comum. No WebGL2, as tentativas com região 4 ou 8 esgotaram o tempo de espera pelas estatísticas. Há dados apenas para o agrupamento global no zoom 8. A causa do tempo limite ficou em aberto. O HTML exato carregado no ensaio regional veio do `dist/index.html` do estágio de infraestrutura e seu hash não foi registrado durante a coleta. [Dados regionais](desempenho-0.3-regioes.json)

A Paisagem viva usa regiões pequenas para recompor as peças afetadas pelo desenvolvimento. Seu custo precisa de ensaio próprio com jogadas que alterem a vizinhança, contagem de regiões reconstruídas e mapas longos. As conclusões acima se limitam à RTX 3060, aos cenários fixados e à infraestrutura medida.

## Reprodução da comparação

Com as dependências locais instaladas, execute na raiz da edição 0.3. Use o caminho do HTML da 0.2 conferido pelo hash acima. O roteiro grava em `.cache/edicoes.json` e retoma as janelas presentes nesse arquivo.

```powershell
New-Item -ItemType Directory -Force .cache | Out-Null
node -e "const fs=require('node:fs'),z=require('node:zlib');fs.writeFileSync('.cache/benchmark-03.html',z.gunzipSync(fs.readFileSync('docs/medicoes/benchmark-infra-2026-11-17.html.gz')))"
node_modules/.bin/rolldown.cmd tests/voyage.ts --file .cache/voyage.mjs --format esm --platform node --logLevel silent
$env:CHROMIUM_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:RENDER_DEVICE = 'hardware'
node scripts/medir-cartas.mjs edicoes 'C:/Users/User/Documents/Retalhos-Entrepostos-Fretes/dist/index.html'
```
