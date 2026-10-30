# AGENTS.md: guia para agentes de IA

> **Resumo em inglês:** *Retalhos* is a relaxing hex-tile puzzle in the Dorfromantik genre, with 5 historical/regional themes (Holanda, Egito, Oriental, Brasil, Inverno). Stack: TypeScript, three.js r186 (WebGPURenderer with TSL node materials; WebGPU where available, automatic WebGL2 fallback) and Vite, with procedural geometry and no art assets. The build is a single HTML file. Before every commit, run `npm run check`, which does the typecheck, simulates 600 games and builds. UI text, docs, code comments and commit messages are in Brazilian Portuguese.

Este arquivo existe para que qualquer agente (Claude Code, Codex, Cursor, Copilot, Gemini etc.) entenda o projeto e trabalhe nele sem quebrar o que já funciona. O `README.md` é o manual de quem joga e roda o projeto. Este arquivo é o manual de quem mexe no código.

## O projeto em uma tela

- **O que é:** um protótipo jogável (v3) de puzzle de peças hexagonais. Cada peça tem 6 bordas de terreno, e quem joga encaixa a peça no mapa buscando bordas iguais.
- **O que a v3 tem:**
  - 5 temas de países e épocas (Holanda Dourada, o padrão; Egito do Nilo; Terraços do Oriente; Brasil Dourado; Inverno Nórdico), consolidados dos 14 de antes (`docs/TEMAS.md`);
  - interações entre bordas diferentes, que dão pontos e erguem construções;
  - mundo animado: trigo ao vento, barcos, trens, moinhos, animais;
  - ciclo de dia, entardecer e noite.
- **Sem arquivos de arte:** casas, árvores, plantações, animais, barcos e sons são gerados em código. Não existe pasta de assets e não deve passar a existir sem uma decisão explícita.
- **Saída:** `npm run build` gera `dist/index.html`, um arquivo único com JS e CSS embutidos, mais `manifest.webmanifest`, ícones e `sw.js` (instalação e modo sem internet; o SW é rede primeiro, cache se estiver offline, e só se registra em https/localhost e fora de `?stress`/`?auto`/`?demo`/`?bench`).
- **Documentos:**

| Arquivo | Para que serve |
|---|---|
| `README.md` | regras do jogo, controles, temas, parâmetros de URL |
| `docs/VIABILIDADE.md` | decisões de arquitetura, medições de desempenho, histórico das revisões de código, riscos |
| `docs/TEMAS.md` | nota da consolidação de 14 para 5 temas, pesquisa histórica dos temas de época e a **lista priorizada de kits a adicionar** |
| `docs/DIVIDAS.md` | dívidas técnicas: plano para quebrar o `main.ts`, arquivos grandes, exports sem uso, branches antigas |
| `docs/PESQUISA.md` | mecânicas do original, stacks, mercado e aspectos legais |
| `docs/screens/*.png` | capturas de referência, uma por tema e por situação |

## Idioma e convenções

- **Português do Brasil** em toda a interface, nos comentários, na documentação e nas mensagens de commit. Os identificadores do código ficam em inglês (`Board`, `buildTile`, `synergy`).
- **Mensagens de commit:** primeira linha curta no indicativo, como `Corrige…`, `Adiciona…`, `Temas por país e época…`. Explique o porquê no corpo quando não for óbvio.
- **TypeScript estrito** (`strict`, `noUnusedLocals`, `noUnusedParameters`). Não há ESLint nem Prettier. Siga o estilo do arquivo: 2 espaços, aspas simples, ponto e vírgula, linhas longas aceitas.
- **Comentários** explicam a intenção ou uma armadilha, nunca o óbvio. Mantenha a densidade de comentários do arquivo que estiver editando.

## Comandos

```bash
npm install          # Node >= 22.12 (ver .nvmrc)
npm run dev          # servidor de desenvolvimento (Vite)
npm run check        # typecheck + testes + build: rode antes de todo commit
npm run typecheck    # tsc --noEmit
npm test             # 600 partidas simuladas com oráculos independentes, cenários sintéticos, legibilidade das cores (tests/legibility.ts), vídeo/câmera/nível por placa (tests/video.ts) e os gatilhos dos easter eggs (tests/eggs.ts)
npm run balance      # painel de equilíbrio (tests/balance.ts): média, p10/p50/p90 e origem dos pontos, por modo e por tema. Não entra no check. `npm run balance -- 40` muda o tamanho da amostra (padrão 80). Meta dos Exploradores: o jogador "caça sítios" acha os 10 em pelo menos 50% das partidas (linha "todos os sítios"); o guloso puro não mira sítios e fica bem abaixo, de propósito
npm run build        # dist/index.html (arquivo único)
npm run smoke        # depois do build: abre o jogo em WebGPU e WebGL2 e falha com erro no console
node scripts/pwa.mjs http://127.0.0.1:4173/   # depois do build e com o dist servido: service worker, offline, manifesto, exportar/importar
node scripts/artifact.mjs   # depois do build: dist/artifact/retalhos.html (formato de página publicável)
```

A CI (`.github/workflows/ci.yml`) roda typecheck, testes e build em todo pull request e em todo push na `main`, e depois `npm run smoke` (`scripts/smoke.mjs`): abre o build no Chromium em WebGPU e em WebGL2, deixa a IA pôr 12 peças e falha com qualquer erro no console. Rode o mesmo localmente depois do build quando mexer em `src/render/` ou no `main.ts`. No Claude Code na web, o hook `.claude/hooks/session-start.sh` roda `npm install` no início da sessão.

### Verificação visual (Playwright, sem GPU)

Teste de lógica não pega erro visual. **Depois de qualquer mudança em `src/render/`, gere as capturas e olhe as imagens.**

```bash
npm run build
(cd dist && python3 -m http.server 4173) &
SHOTS=vale,noite,interacoes node scripts/screenshots.mjs   # grava docs/screens/<nome>.png e imprime estatísticas e erros do console
RUNS=300:high node scripts/stress.mjs                      # tabela de desempenho
```

- **Navegador:** `scripts/browser.mjs` procura o Chromium nesta ordem:
  1. a variável `CHROMIUM_PATH`;
  2. `/opt/pw-browsers/chromium`, que existe nos contêineres do Claude Code;
  3. o Chromium do Playwright. Se não houver nenhum, instale com `npx playwright-core install chromium`.
- **Renderização por software (SwiftShader):** o FPS medido assim não vale nada. Compare triângulos, draw calls e CPU por quadro.
- **WebGPU sem GPU:** `scripts/browser.mjs` liga o WebGPU do SwiftShader com `--enable-features=Vulkan --use-vulkan=swiftshader` (sem o Vulkan, o canvas perde o dispositivo). Acrescente `&webgl` à URL para conferir o caminho WebGL2; os dois precisam funcionar.
- **Captura avulsa:** `node scripts/shot.mjs <pasta> "nome=query" ...` grava fora de `docs/screens` (ex.: `"rio=theme=egito&seed=4&auto=32&zoom=4&focus=4"`). Com `?seed=`, o `?auto=` monta sempre o mesmo tabuleiro, e as capturas ficam comparáveis.
- **Servidor em outra porta:** `shot.mjs` e `compare.mjs` leem `BASE` (padrão `http://127.0.0.1:4173/`), para vários agentes usarem portas diferentes: `BASE=http://127.0.0.1:4202/ node scripts/shot.mjs ...`.
- **Antes e depois (`npm run compare`):** grava 6 vistas fixas (vale de dia, Egito ao entardecer, noite, zoom aberto, rio de perto, vila de perto; semente fixa e `timescale=0.001`) e mede a diferença por pixel, decodificando os PNGs no próprio Chromium. Roda à mão, fora da CI e do `check` (o SwiftShader varia).
  1. na `main`, com o build servido: `npm run compare -- grava .cache/compare/ref`;
  2. com a sua mudança buildada: `npm run compare -- confere .cache/compare/ref` (ou `compara <pastaA> <pastaB>` para duas pastas já gravadas).
  - Por captura imprime a % de pixels com diferença acima de `CH` (padrão 12 de 255 em algum canal) e a diferença média, e falha (código 1) acima de `TOL_PCT` (0,5%) ou `TOL_MEAN` (0,5). Duas rodadas seguidas do mesmo build dão no máximo ~0,11% e média ~0,05. Grava `diff-<nome>.png` (diferença ×4 em vermelho) na pasta B.
  - As referências ficam em `.cache/compare/` (já ignorada pelo git): 6 PNGs de 1440×860 são pesados e dependem da máquina, então não vão para o repositório. Mudança visual intencional dá diferença acima da tolerância: confira as imagens `diff-*` e as capturas.
- **Capturas:** só faça commit das PNGs de `docs/screens/` quando a mudança visual for intencional. Se gerou capturas apenas para conferir, desfaça com `git checkout docs/screens/`.
- **Rede:** o Chromium tenta acessar domínios do Google. Em ambiente com proxy, essas falhas de conexão são esperadas e inofensivas.

### Ganchos de depuração no navegador

| Gancho | O que faz |
|---|---|
| `?debug` | mostra FPS, draw calls, triângulos e instâncias |
| `?bench` | monta `seed=7` com 60 peças e passa por Baixa, Média, Alta e Ultra (15 s cada, câmera girando devagar); mostra placa, nível, FPS mediano, p95, draw calls e triângulos num painel com botão "Copiar" (markdown); `window.__bench` guarda `{ done, rows }` |
| `?perf` | mede 5 s e mostra o FPS mediano e o p95; `window.__perf(segundos)` devolve o mesmo, com as estatísticas do último quadro |
| `?gallery&theme=<id>` | mostra todos os kits do tema lado a lado; `window.__gallery` lista as chaves. `?gallery=casas` mostra só as casas (parede e telhado juntos, na era atual) |
| `?auto=40` | a IA gulosa coloca 40 peças |
| `?stress=1000` | teste de carga; o resultado fica em `window.__load` |
| `?levels=0` | desliga o relevo (platôs de `Theme.relief.levels`): o tabuleiro sai plano, para comparar capturas |
| `?step=rail` ou `?step=water.1` / `window.__step(tipo, i, zoom)` | centraliza (de frente para a parede, de lado) na i-ésima borda de estrada ou de rio entre níveis diferentes: a rampa ou a cachoeira; devolve `{ q, r, edge, de, para }` ou null |
| `?fall=1` / `window.__fall(i?, zoom?)` | centraliza (de frente, vista da casa mais baixa) na i-ésima cachoeira assentada (R3) e devolve `{ x, z, drop, w }` ou null |
| `?at=q,r` / `window.__goto(q, r, zoom?)` | centraliza a câmera na casa (q, r) |
| `window.__tiles()` | as peças assentadas com `{ q, r, level, edges }`: onde há vila em platô, rio entre níveis etc. |
| `window.__cells()` / `window.__pick(x, y)` | casas vazias da fronteira com `{ q, r, level, x, y }` (nível e ponto da tela) e a casa que o clique em (x, y) escolhe: teste do clique por nível |
| `?focus=4` | centraliza a câmera na peça com mais bordas do terreno (4 = rio); `window.__focus(t, zoom)` |
| `?economia=0` | desliga a economia de quadros (ver Orçamento de desempenho) |
| `?webgl` | força o backend WebGL2 (o padrão é WebGPU quando o navegador oferece) |
| `?demo` | a IA joga sozinha, com animação |
| `?fx=ao.gi.ssr.rays.traa.msaa.bloom.dof.tilt.ink.finish.film` | liga os efeitos de pós um a um (medir custo; `dof` é a profundidade de campo, só do Cinema; `tilt` é o desfoque de miniatura da Alta e do Ultra; `finish` é só o grão e a lente, `film` soma as amostras a mais do Cinema); `?fx=` desliga todos |
| `?timescale=0.05` | desacelera o mundo (animações nas capturas por software) |
| `?silhueta` | decorações pretas sobre chão branco: confere se vilas, construções e marcos leem de longe |
| `?fluido` | terra contínua / encaixe fluido (só visual, `src/render/fluid.ts` e o campo de terreno do material do chão): **ligado por padrão no modo Relevo**; `?fluido=0` desliga e `?fluido` liga em qualquer modo. Chão, água, queda e decoração de cada peça são deslocados no plano por uma função só das coordenadas do mundo (a emenda segue fechada); o terreno vira um campo do mundo (`groundMap.landTexture`, abaixo), a normal do chão sai do mapa de alturas (encostas lisas), a costa do mar (`seaMap`) segue a ilha deslocada com distância euclidiana, as casas vazias viram manchas que se fundem e `pickHex` desfaz o deslocamento. A lógica segue hexagonal; sem save novo. Ainda seguem o hexágono os trajetos de barcos e trens (`Life`). O build da prévia publicável (`VITE_PREVIEW=relevo npm run build`) abre já no Relevo, porque a página não recebe parâmetros de URL |
| `?coast=i` / `window.__coast(i?, zoom?)` | centraliza a câmera na i-ésima peça mais longe do centro (a costa: areia, espuma e saia do mar nas capturas) |
| `window.__placeBest()` | coloca a peça atual na melhor posição, com animação |
| `window.__ripple(idade)` | dispara a onda do chão no foco da câmera, já com essa idade em segundos |
| `window.__weather(tipo, idade?)` | clima tocável: `'rain'`, `'snow'`, `'sun'` ou `null` (encerra); com `idade` em segundos, já entra com essa idade (capturas por software). `scripts/weather.mjs` roda os 5 temas e falha com erro no console (`SHOTS=holanda:rain,inverno:snow,egito:sun` grava capturas) |
| `window.__celebrate()` | anel dourado e bando de pássaros no foco da câmera (efeitos de nova era) |
| `window.__era(era, idade?, zoom?)` | centraliza no Centro da vila e o mostra na era (0 a 3); com `idade`, a onda dourada já com essa idade em segundos |
| `window.__plaza(zoom?)` | mostra os três monumentos na praça do Centro (só a imagem) |
| `window.__mark(zoom?)` | centraliza a câmera no último marco de era erguido |
| `window.__river(zoom?, lago?)` | põe fora do mapa um rio reto de 7 peças e cinco peças de lago e centraliza no rio (ou na peça de lago `lago`, 0 a 4): confere meandros, emendas, enseadas e ilhotas |
| `window.__over()` | abre a tela de fim de partida |
| `window.__spur()` | monta uma linha reta de ferrovia fora do mapa (captura da carga e da moeda) |
| `window.__trade(moeda?, zoom?)` / `window.__holdTrade(zoom?)` | centraliza no veículo da rota (com `moeda`, só com a moeda no ar); `__holdTrade` segura o trem na parada |
| `window.__boat(zoom?)` | centraliza a câmera num barco andando (esteiras na água) |
| `window.__fishing(i?, cais?, zoom?)` | centraliza no i-ésimo cardume de peixes; com `cais = true`, no i-ésimo cais de pescador |
| `window.__folk(i?, zoom?)` | centraliza a câmera no i-ésimo aldeão de construção |
| `window.__fauna(i?, zoom?)` | centraliza no i-ésimo bicho da fauna do tema (`Theme.fauna`) à vista e devolve o kit (`fauna:deer`...). `__stats.life.fauna` conta os que estão à vista na hora do dia e `faunaKinds` separa por espécie |
| `window.__deco(prefixo, i?, zoom?)` | centraliza na i-ésima instância dos kits cuja chave começa com o prefixo (`'gate'`, `'egg:'`, `'wall:'`) e devolve a chave; só enxerga os lotes do mapa, não o `Life` |
| `window.__egg(id)` | toca os efeitos de evento, céu e som de um easter egg do tema no foco da câmera (o kit na peça só nasce numa jogada). `__stats.eggSky` mostra o quanto do tom de céu do ovo já entrou (0 a 1) |
| `window.__relief(i?, zoom?)` | centraliza na i-ésima serra ou morro assentado (`Theme.relief`) e devolve `'peak'` ou `'hill'` |
| `window.__bridge(i?, zoom?)` | centraliza na i-ésima ponte assentada e devolve o giro dela (capturas da ponte levadiça e do mastro baixando) |
| `window.__site(zoom?)` | centraliza no último sítio achado (ou no primeiro escondido) e devolve qual |
| `?specials=all` / `window.__special(i?, zoom?)` | põe as peças especiais na partida sem liberá-las; centraliza na i-ésima colocada e devolve qual |
| `window.__wonder(etapa?, zoom?)` | centraliza no canteiro da maravilha; com `etapa` (0 a 6), mostra a obra nessa etapa |
| `window.__photo({ size })` | tira a foto como o modo foto (`screen`, `4k` ou `8k`) e devolve nível antes/depois, resolução desenhada e final, e o PNG em base64 |
| `?seed=` `?theme=` `?time=` `?quality=` `?zoom=` `?yaw=` `?pitch=` | ver o `README.md` |
| `window.__stats` | estatísticas do último quadro; `shadowDraws` = draw calls dos passes de sombra nesse quadro (0 com a sombra guardada) e `shadowPasses` = passes acumulados |
| `window.__pools()` | relatório dos InstancedMesh |
| `window.__ghostBest()` | põe o fantasma na melhor jogada |
| `window.__ghostSynergy(colocar?)` | põe o fantasma numa jogada com interação e devolve quantas; com `true`, coloca a peça (obra com andaime) |
| `window.__video({ kind, height, quality })` | exporta sem o diálogo o filme da partida (`film`) ou a gravação em andamento (`take`, tecla `V`) e devolve `{ bytes, ms, b64 }`: o MP4 em base64, para conferir com o `ffprobe` |

## Mapa do código

```
src/core/        regras puras: NÃO importa three.js nem DOM (os testes rodam em Node)
  hex.ts         grade hexagonal flat-top, coordenadas axiais (q, r), DIRS, hkey/unkey
  tiles.ts       enum T (Prado, Floresta, Plantação, Vila, Rio, Estrada), rotateEdges, geração de peças
  board.ts       Rules/DEFAULT_RULES, Board: validação, pontuação, grupos, missões, interações
  synergy.ts     tabela das interações (vila×floresta, vila×plantação, vila×prado, plantação×prado) e a influência delas nas casas vizinhas
  game.ts        Game: semente, pilha, sorteio por peça, descarte, bestMove (IA gulosa), rankMoves (as n melhores casas com os pontos reais, determinística: alimenta o "Onde encaixa", tecla `O`), upcoming (mirante)
  blessings.ts   cartas da virada de era: 1 de 2 por era, oferecidas pela semente; a escolha vai no save junto da jogada
  sites.ts       sítios escondidos (ruína, tesouro, relíquia, mirante), da semente por um gerador à parte
  modes.ts       modos: Clássico, Zen, Desafio do dia, Exploradores, Estrada Real, Partida rápida (regras + desfazer; `fixedStack` = pilha de 30 sem peças de volta; `more: true` manda o modo para "Mais modos" no menu, até ser equilibrado). O recorde é por modo e tema (`best.<modo>.<tema>`). `DAILY_RULES`/`dailyRule(seed)`: a regra do dia sai só da semente AAAAMMDD (data local), por dias seguidos em rodízio; `modeRules(modo, semente)` soma o modo e a regra do dia
  share.ts       texto de compartilhar do desafio (`shareLine`, `shareUrl`, `terrainPoints`): puro
  routes.ts      rotas de comércio do modo Estrada Real: mercados e portos ligados pela mesma rede rendem pela distância
  seasons.ts     estações da partida (a cada 20 jogadas), derivadas do índice da peça: o replay não guarda nada
  specials.ts    peças especiais (estação, moinho d'água, farol): bordas, pontos e posições na pilha
  eggs.ts        easter eggs genéricos (`Theme.eggs`): gatilhos de peça (`EggTracker`, reavaliado na ordem das peças) e de relógio (`clockEggs`), fase do dia (`phaseOfTod`); puro, testado em tests/eggs.ts
  relief.ts      nível de altura de cada casa (`levelAt(seed, q, r, maxLevel)`, 0 a 2): ruído suave de onda longa, vizinhos a no máximo 1 nível, origem no 0, sem casas soltas; só aparência
  rng.ts         mulberry32 e utilitários de sorteio
src/themes/      temas como DADOS
  types.ts       esquema Theme, com cada kit comentado: é a referência de tudo que um tema pode escolher
  themes.ts      índice: THEMES (os 5 temas, Holanda primeiro = padrão), PERIOD_LABEL/ORDER, themeById (ids antigos fundidos levam ao tema novo; MERGED_THEMES)
  holanda.ts, egito.ts, oriental.ts, brasil.ts, inverno.ts   um tema por arquivo (oriental = Sakura + Song + Edo; brasil = Cerrado + Colonial; inverno absorveu o Viking)
  legacy.ts      migração dos recordes `best.<modo>.<tema>` dos temas fundidos para o tema novo (o maior fica; puro, testado em tests/themes.ts)
  progress.ts    housesAtEra: as casas do tema em cada era da vila (taipa e palha, o tema, enxaimel e sobrado, flâmulas)
src/render/
  gpu.ts         cria o WebGPURenderer (WebGPU ou WebGL2)
  materials.ts   materiais em TSL: chão, água, kits instanciados (vento, plantações, janelas), pergaminho do vazio (terra incógnita); uniformes U
  relief.ts      relevo decorativo (`Theme.relief`): geometria dos kits `peak` (serra de rocha com neve opcional, cume + ombros) e `hill` (morro gramado), cada um com a versão leve; só aparência, sem regra; `mist` desbota o pé da serra e escurece o cume (picos de tinta do Oriente); `crown` põe mata no topo da serra no lugar da neve (chapada do Brasil)
  kits/          geometria de kits de um tema só, em arquivo próprio, com um `case` por kit em `lib.ts`: `kits/egito.ts` (falésia de arenito `mesaGeometry` no pool `peak` com `relief.style: 'falesia'`, pilone, terraço e toldo, shaduf, íbis, crocodilo, boi de lira, esfinge, gato, pirâmide), `kits/holanda.ts` (empenas, álamo, bulbo, pato, tjalk, ponte levadiça, portão de tijolo, moinho, queijo e menino do dique), `kits/oriental.ts` (pinheiro `niwaki`, garça, cerejeira milenar, lago da carpa, gato da sorte), `kits/brasil.ts` (telhado colonial, cafezal em florada, engenho, zebu, ema, lobo-guará, tamanduá, arara, mula, carro de boi, porteira, cupinzeiro, profetas, onça; recebe as primitivas por `TOOLS`/`KitTools`), `kits/inverno.ts` (rena, alce, raposa, trenó, gelo, pórtico de dragões, stavkirke, troll; recebe as primitivas por `PRIMS`). Importam as primitivas de `lib.ts`, que as reexporta no fim (o ciclo é inofensivo: só se chamam depois do carregamento)
  noise.ts       texturas de ruído periódicas geradas em código (nuvens, chão, ondulação da água)
  atmosphere.ts  névoa da cena (scene.fogNode): bruma e névoa rasteira por altura, e a névoa de alcance
  groundMap.ts   mapa do chão visto de cima: cor do terreno (luz rebatida) e poças dos lampiões; cobertura (R8) para a costura de cor entre peças; altura do chão da casa (R8, `heightTexture`) para as poças e a luz rebatida medirem o ponto a partir do chão do platô, não do y absoluto; campo de terreno (RGBA8, `landTexture`: pesos [prado, mata, plantação, vila] por texel, rasterizados de `TileBuild.splat`) e mapa de alturas do chão (half float, `reliefTexture`, só até `TileBuild.groundEnd`: sem decalques) para a terra contínua
  falls.ts       cachoeiras assentadas (R3): `FallLayer` junta a lâmina (opaca, `lib.fall`) e a espuma da bacia (transparente, `lib.foam`) de todas as peças em duas malhas só (+2 draw calls), só cresce como os blocos; guarda `spots` (lábio, saída, largura e altura de cada queda) para a névoa, o som e a câmera
  seaMap.ts      distância de cada ponto até a peça mais próxima (1 canal, só cresce): o mar, a espuma e a areia em volta do tabuleiro
  riverMap.ts    distância de cada ponto até a água dos rios (1 canal, só cresce; só é preenchido com `Theme.floodplain`): a várzea do chão
  aurora.ts      aurora boreal em TSL (`Theme.skyFx`): a cortina por direção do olhar, a cúpula do céu, o reflexo no mar e o brilho na névoa de alcance
  clouds.ts      nuvens volumétricas do zoom aberto, marchadas numa laje acima do tabuleiro
  post.ts        pós-processamento por perfil: SSGI ou GTAO, reflexos (SSR), raios de luz, TRAA, bloom,
                 profundidade de campo (Cinema) ou desfoque de miniatura (Alta e Ultra), vinheta, ombro de tons
  lib.ts         geometria dos kits (casas, árvores, plantações, animais, barcos, veículos, marcos), classe Lib,
                 instGeometry (atributo de cor por instância)
  tileBuilder.ts buildTile: monta UMA peça (chão com leito de rio, água com correnteza, estradas, decoração)
                 a partir de bordas + semente + tema. Vilas em quarteirões: uma rua clara do meio de cada borda de vila ao centro,
                 casas (1 por setor, 2 em ~30%) de cumeeira paralela à rua, e pracinha com poço com vila em 3+ bordas
                 Relevo (`Theme.relief`, `amp` 0 ou omitido = sem relevo): uma serra ou um morro por peça de prado ou mata (gerador à parte, `seed ^ RELIEF_SEED`), perto do centro, só em setores sem vila nem lavoura, com a mata subindo a encosta do morro e pedras no pé da serra; reserva o lugar (`reserved`) antes das árvores e das casas
  world.ts       World: cena, luz, céu e hora do dia, blocos estáticos, pools instanciados, fantasma, animações
                 de queda, sentido da correnteza por peça
  liveTile.ts    LiveTile: peça avulsa (fantasma, queda, pilha)
  fx.ts          partículas em sprites: poeira, fumaça e brilhos (CPU); clima do tema e vaga-lumes (no shader); o clima tocável (chuva, neve, sol por 30 s, `World.setWeather`) é uma 2ª camada `Weather` escondida quando ociosa, mais `U.clouds` e a luz do céu por cima, pelo `dt` do mundo, fora do save; `Sprites.mist` é a névoa do pé das cachoeiras e `makeFoamMaterial`, a espuma da bacia
  sky.ts         céu procedural para a luz de ambiente (IBL)
  preview.ts     a peça da vez sobre a pilha, com canvas e renderizador próprios
  life.ts        Life: barcos, veículos, animais, aldeões, moinhos, peixes e pássaros que se movem
  cameraRig.ts   câmera orbital: inclinação baixa pela curva do zoom mais o ajuste de quem joga (`tilt`);
                 lente de 40° com `rig.eye` = distância real (`rig.dist` é o enquadramento)
  nightLight.ts  luz da noite (luar e céu) sem three.js: o `skyFor` e o teste de legibilidade leem a mesma tabela
  gpuTier.ts     nível inicial do Auto pelo nome da placa de vídeo (puro)
  dynres.ts      resolução dinâmica do Auto: degraus de resolução antes de descer o nível (puro)
src/video/       foto e vídeo (o modo foto e a exportação ficam em src/ui/capture.ts)
  take.ts        gravação: a pose da câmera a cada quadro e os eventos (jogadas, hora, fantasma), até 2 min
  path.ts        poses reamostradas a 60 quadros por segundo e suavizadas por um filtro gaussiano sem atraso
  film.ts        plano do filme da partida: quando cada peça cai e por onde a câmera passa
  render.ts      desenha o vídeo quadro a quadro, com world.tick(1/60), e entrega ao codificador
  encoder.ts     WebCodecs: escolhe H.264 ou VP9 e guarda os quadros codificados em Blobs
  mp4.ts         cabeçalho MP4 (ftyp, moov, mdat) escrito à mão, sem biblioteca
src/ui/          HUD em HTML/CSS (hud.ts, style.css); eraChoice.ts: nomes e diálogo das cartas da era; banner.ts: cor da casa e brasão (troca o `ui.accent` do tema); tutorial.ts: dicas das primeiras partidas; progress.ts: progresso entre partidas e liberação das peças especiais; capture.ts: modo foto, gravação, filme da partida e exportação (`Capture`, com o estado da tela em `stage`); input.ts: mouse, toque e teclado no tabuleiro (`bindInput`); minimap.ts: minimapa e linha do tempo do fim da partida; frames.ts: moldura e emblema do tema em CSS e SVG; a11y.ts: paleta para daltonismo; a página é o index.html; storage.ts: `persist()` depois da primeira partida acabada, `exportKeys` e `importKeys` (módulo isolado, sem dependência do jogo, para outros jogos copiarem)
src/audio.ts     sons sintetizados com WebAudio: música, efeitos e ambiente (paisagem perto do foco da câmera, `setAmbience`)
src/main.ts      entrada: fluxo da partida, telas e botões, qualidade, salvamento, parâmetros de URL, ganchos de depuração
tests/logic.ts      simulação de partidas contra oráculos independentes (grupos por BFS, pontuação recalculada, replay)
tests/synthetic.ts  cenários montados à mão (peça travada, descarte, fim de jogo, semente → sequência)
tests/legibility.ts telhados e paredes contra o chão da vila (ΔE em CIELAB, ponderado pelo peso das casas)
tests/relief.ts     níveis de altura: determinismo, vizinhos a ≤1 degrau, origem no 0, distribuição, sem casas soltas
tests/falls.ts      cachoeiras (`buildTile` em Node): lábio e lâmina na peça alta, espuma na baixa, largura igual nas duas metades, água plana, determinismo, nível 0 sem degrau = peça plana
tests/storage.ts    ida e volta do backup com armazenamento falso e recusas sem gravar
tests/eggs.ts       gatilhos dos easter eggs: horas, datas (inclusive virando o ano), sorte por semente, grupos conferidos por BFS numa partida de verdade e replay idêntico
tests/themes.ts     os 5 temas, `?theme=` antigo, migração dos recordes dos temas fundidos e o progresso dos removidos
tests/video.ts      MP4 conferido por um leitor de caixas próprio, resolução dinâmica, nível por placa, câmera e filme
scripts/         capturas, teste de carga, conversão para página publicável; pwa-plugin.mjs (plugin do Vite: manifesto, ícones PNG desenhados em código e sw.js no dist); pwa.mjs (confere SW, offline, manifesto e backup)
```

**Fluxo de uma jogada:**
1. `main.ts` chama `Game.place(q, r)`, que chama `Board.place`. O resultado, `PlaceResult`, traz os pontos, os encaixes, as interações e as missões.
2. Em seguida chama `World.placeAnimated(...)`.
3. O `World` chama `buildTile(edges, seed, theme, { detail, synergies, houses })`, que devolve a geometria do chão e uma lista de decorações.
4. Quando a peça pousa, o chão vai para o **bloco estático** da região (8×8 peças), as decorações para os **pools** de `InstancedMesh` (um por chave de kit), e o que se move vai para o `Life`.
5. Na virada de era, `Lib.setEra` troca a geometria das casas (`wall:i`, `roof:i`) e o `World` troca a dos pools delas (`Pool.retarget`): mesmas posições e cores, nada é reconstruído. A decoração sai sempre das casas do tema como ele é (`Lib.houseMeta`), e a fumaça acompanha a altura da chaminé da era (`Lib.chimScale`).

## Invariantes: não quebre

1. **`src/core` é puro e determinístico.** Nada de three.js, DOM ou `Math.random`. A única exceção é `Game.bestMove`, que usa `Math.random` de propósito para não mexer na sequência de peças.
2. **A sequência de peças depende só da semente, do índice e das peças especiais liberadas** (`Game.draw`, `specialSlots`). A mesma semente com as mesmas peças liberadas dá as mesmas peças para qualquer jogador; a peça especial só toma o lugar da peça do seu índice. Só a presença da missão depende do estado da partida.
3. **A aparência de uma peça depende só de `(edges, def.seed, theme, opts)`.** `buildTile` usa `mulberry32(seed)`, então fantasma, queda e mapa mostram a mesma peça. `Math.random` no render é aceitável só em efeitos passageiros, como partículas.
4. **Rotação:**
   - lógica: `rotateEdges` faz `out[(i + rot) % 6] = base[i]`;
   - render: `rotation.y = -rot · π/3`;
   - a borda `i` encosta no vizinho `DIRS[i]`, e o lado oposto é `(i + 3) % 6`.

   Mude os três juntos ou nenhum.
5. **Rio e estrada são estritos** (`isStrict`): só encostam neles mesmos. Os 4 terrenos comuns aceitam qualquer vizinho, mas só pontuam quando iguais. As interações pontuam pares diferentes.
6. **Saves:**
   - o formato é `{ v, seed, rulesId, mode, moves, undone, score, specials }` (v13), guardado em `localStorage` com o prefixo `retalhos.`; cada jogada é `[q, r, giro, ...escolhas]`, com as cartas da era (0 ou 1) escolhidas logo depois dela;
   - o progresso entre partidas (totais, registro por tema e peças especiais liberadas) fica em `retalhos.progress` (`src/ui/progress.ts`), validado campo a campo ao ler;
   - **exportar e importar** (`src/ui/storage.ts`, botões no Almanaque): o arquivo `{ app, v, at, data }` leva todas as chaves `retalhos.*`; ao importar, `save` passa por `validSave` (main.ts) e `progress` por `cleanProgress` (progress.ts), os outros valores só por tipo e tamanho, e nada é gravado se algo falhar. Chave nova de preferência entra no backup sozinha; chave com formato próprio que importe validar ganha um caso em `check` (`importProgress`, main.ts). Se mudar `SAVE_VERSION`, backups antigos trazem um save recusado: o jogador vê o aviso de dado inválido;
   - no Desafio do dia a regra do dia sai da `seed` (AAAAMMDD), então o save não guarda mais nada; mudar `DAILY_RULES` (ordem ou conteúdo) altera o replay e pede `SAVE_VERSION` novo. Variação nova só com campos de `Rules` que o oráculo de `tests/logic.ts` já cobre;
  - **o tema do save:** `validSave` recusa um `rulesId` que não é um dos `THEMES` atuais (a importação do backup aceita o formato do id e deixa o descarte para o carregamento, com o aviso de versão anterior). Foi assim, sem `SAVE_VERSION` novo, que os 14 temas viraram 5: os fundidos e os removidos mudaram de regra ou sumiram e seus saves caem na validação, e os que ficaram (Holanda, Egito, Inverno) mantiveram as `rules`. Mudar as `rules` de um tema que fica altera o replay das partidas dele e pede `SAVE_VERSION` novo. O tema escolhido e `?theme=` passam por `themeById`, que leva o id antigo fundido ao novo e o removido ao padrão; o recorde `best.<modo>.<tema>` migra uma vez na leitura (`migrateBests`), e o registro de `retalhos.progress` de tema removido fica guardado, sem uso;
  - ao carregar, a partida é **reconstruída pelo replay** das jogadas e conferida contra a pontuação.
   - Se você mudar regras, pontuação ou geração de peças de um jeito que altere o replay, **aumente `SAVE_VERSION` em `main.ts`**. Saves antigos mostram um aviso e são descartados.
7. **Os testes têm oráculos independentes.** Ao mudar a pontuação, atualize o oráculo em `tests/logic.ts` reimplementando a regra. Nunca faça o oráculo chamar o código que ele testa.
8. **Tema é só dado.** O renderizador sabe desenhar cada kit; o tema escolhe e colore. Não ponha `if (theme.id === '...')` no render. Crie ou parametrize um kit.
9. **Materiais em TSL (three r186, `three/webgpu` e `three/tsl`):** nada de `onBeforeCompile` nem GLSL; o mesmo nó compila para WebGPU e WebGL2.
   - Importe sempre de `three/webgpu` (não de `three`), para o bundle não levar o WebGLRenderer.
   - Atributos por vértice dos kits: `color`, `tint` (quanto a cor da instância tinge) e `glow` (janelas que acendem com `U.night`). A cor da instância é o atributo `iColor` da geometria criada por `instGeometry()`; não use `mesh.instanceColor`, que o three multiplicaria de novo.
   - Uniformes globais em `U` (`materials.ts`): `time`, `dt`, `wind`, `night`, `clouds`, `sparkle`, `glow`, `water`, `sun`, `sunDir`, `fine`, `bounce`, `lamps`, `eraWave`, `silhouette`, `flood`, `floodReach`, `floodColor` (várzea), `aurora`.
   - No r186 a instância é aplicada **antes** do `positionNode`: ali `positionLocal` já está no espaço do mundo (pools) e `positionGeometry` é o vértice original. Quem desloca vértices (vento) também ajusta `positionPrevious`, senão o antisserrilhado temporal deixa rastro.
   - A água usa os atributos `wflow` (correnteza) e `wbed` (cor do leito e profundidade da coluna): a malha da água repete os triângulos do leito abaixo da linha d'água, então a beira fica exatamente onde a profundidade zera. A correnteza de cada peça herda das vizinhas (`World.flowAt` + `resolveFlow`) e gira junto com a peça no bloco. A largura do rio em cada borda segue a mesma regra (`World.widthsAt`, `BuildOpts.widths`): a peça nova adota a da vizinha já colocada, e perto da borda o campo da água vira o perfil da própria borda, então a emenda casa. Lago ou rio sai de `waterShape` (semente, gerador à parte).
   - Os materiais iluminados do jogo (kits, chão, água) são `LitMaterial`: gravam a parte da cor que veio do céu, e a oclusão de ambiente do pós só escurece essa parte (o sol direto e as janelas acesas ficam de fora). Um material iluminado novo que não seja `LitMaterial` recebe a oclusão inteira, como o vazio.
   - **Costura de cor entre peças** (`seamAt` em `makeGroundMaterial`): a menos de 0,35 da borda do hexágono, o chão mistura a cor de vértice com a cor média do mapa do chão num mip borrado (RGB dividido pela cobertura, `coverTexture`), só onde há peça do outro lado da borda; os dois lados da emenda leem o mesmo valor e a divisa some. A geometria não muda (a invariante 3 vale para ela); a aparência depende do mapa, então a pilha zera `U.seam`, como zera `U.bounce`.
   - O `LitMaterial` também soma na luz indireta o que vem do mapa do chão (`groundMap.ts`): a cor do terreno rebatida nas faces viradas para os lados e para baixo (`U.bounce`) e as poças dos lampiões à noite (`U.lamps`). A pilha (`preview.ts`) zera os dois, porque o mapa é do tabuleiro. A altura do ponto nessas contas é relativa ao chão da casa (`groundMap.heightTexture`): em platô de nível 2 a poça não some.
   - A névoa é um nó (`scene.fogNode`, `atmosphere.ts`), não `THREE.Fog`: bruma e névoa rasteira com densidade que cai com a altura (integral exata ao longo do raio), mais a névoa de alcance para a cor do fundo. Densidades e cores vêm da hora do dia (`skyFor` em `world.ts`).
   - As nuvens do céu (`clouds.ts`) e a sombra delas no chão (`cloudLight`) leem o mesmo ruído (`cloudField`, `cloudPuff`); a sombra é lida no ponto em que o raio até o sol cruza a camada das nuvens. As nuvens ficam numa cena própria, que o pós compõe antes do TRAA (`buildPost(..., clouds)`): no passe da cena, um transparente não grava profundidade nem normal, e a oclusão e a luz rebatida do chão de baixo vazariam nele.
   - Sem tone mapping do renderizador: o pós-processamento aplica um ombro suave que preserva as paletas dos temas.
   - O entorno do tabuleiro é `Theme.surround` (`'mar' | 'areia' | 'pergaminho'`, padrão pergaminho): o próprio `makeVoidMaterial` vira mar (água funda que ganha cor do tema, espuma e faixa de areia lidas do `seaMap`, brilho do céu) ou dunas de areia, sem malha nem draw call a mais, e desbota para a cor do fundo além do raio explorado.
   - Se um nó falhar ao compilar, o erro aparece no console das capturas.
10. **Blocos estáticos só crescem** (append-only), e o mapa do chão (`groundMap.ts`) também: cada peça pinta a sua parte quando assenta. Os pools são indexados pela chave do kit. Chaves que **terminam em `~`** são a metade "fina" de plantas e capim (nível de detalhe): entre `rig.dist` 11,5 e 14,5 cada planta dessa metade afunda no chão na sua vez (`U.fine`, material `cropFine`), e mais longe o pool fica escondido. No Ultra e no Cinema a faixa vai 1,35× e 1,6× mais longe. Quem consulta geometria pela chave precisa tirar o `~`. Árvores, arbustos, pedras, serras e morros (`peak`, `hill`) têm também uma **versão leve** (`Lib.farGeo`, octaedros e cones de 3 lados, mesmas cores por instância): além de `rig.dist` 18 (×1,35 no Ultra, ×1,6 no Cinema, ×1,35 na primavera), `World.setFarTrees` troca a geometria dos lotes com `Pool.retarget` (mesmas instâncias, sem lote novo, as chamadas não sobem; histerese de ±0,4). `Lib.geo` devolve sempre a versão cheia, e `pool()` já cria o lote na versão da hora.
11. **Construções internas não pontuam.** A roda d'água (vila na beira do rio), a irrigação, a estação e o silo (junto à ferrovia) são só visuais. Pontos de interação vêm apenas de `synergy.ts` × `Rules.synergyPoints`.
12. **Parâmetros de URL e valores salvos são validados** contra listas fixas (ver `pickQ` e o uso de `Object.hasOwn` para `time`). Mantenha esse padrão ao criar um parâmetro novo.
13. **O mundo anda pelo `dt` do `World.tick`.** O vídeo é desenhado depois da gravação, quadro a quadro, cada um com `world.tick(1/60)`, e o modo foto congela o mundo com `world.timeScale = 0`.
    - Animação nova usa o `dt` que o `tick` calcula (já multiplicado por `timeScale`) ou `U.time`. Nunca `performance.now()` nem o `time` embutido do TSL: no vídeo ela saltaria e na foto não pararia.
    - A câmera, o fantasma e a troca de hora seguem o tempo real (`realDt`), para responderem no modo foto com o mundo parado.
    - Efeito de jogada que o vídeo também deve mostrar vai em `World.placeFx`, que o jogo e o vídeo chamam do mesmo jeito.
    - Foto e vídeo copiam o canvas logo depois do `tick`, no mesmo passo do desenho.

14. **Easter eggs: a partida decide a peça, o relógio só enfeita.** Gatilho de peça (`pecas`, `grupo`, `bordas`, `sorte`) sai só do índice, das bordas e da semente da peça: o `EggTracker` os reavalia na ordem, então replay, desfazer e carregar o save reconstroem os mesmos kits (invariante 3) sem guardar nada. Gatilho de relógio (`hora`, `data`) só dispara evento, céu e som, nunca põe kit na peça, fica fora do save e do replay e roda em `main.ts` (`eggClock`). Nada de `if (theme.id)`: o ovo é dado do tema.

15. **O nível da casa sai só da semente.** `levelAt(seed, q, r, maxLevel)` (`core/relief.ts`) é pura: a peça sabe o nível de todos os vizinhos, colocados ou não, então a emenda não depende da ordem das jogadas e nada entra no save, no replay nem no `SAVE_VERSION`. É só aparência, por `Theme.relief.levels` (0 ou omitido = plano; 1 ou 2 = platôs).
    - **Modo Relevo (`relevo`, em "Mais modos"):** a altura é da PEÇA. `tileProfile(edges, seed)` (`core/relief.ts`, gerador à parte, não toca a sequência de peças) dá 6 alturas (0 a 2) e o pico do meio; peça com rio ou trilho sai plana. `Rules.relief` liga o encaixe de altura em `Board.check(q, r, edges, heights)` (1 degrau vale, 2 não; trilho exige igual; `checkDef` junta bordas e alturas) e os pontos `stepPoints` (degrau) e `fallPoints` (degrau de rio). Os platôs da semente ficam desligados nesse modo (`World.setPieceRelief`); a peça é desenhada como um campo de altura contínuo (`src/render/terrain.ts`, abaixo), e só as vizinhas colocadas ANTES dela contam para a queda (o jogo e a reconstrução saem iguais). Sem `SAVE_VERSION` novo: os outros modos não mudam. Oráculo próprio em `tests/logic.ts`; perfis em `tests/relief.ts`.
    - **Relevo fluido (E4):** o chão da peça é um campo de altura contínuo (`terrain.ts`, sem three.js, em níveis relativos ao `own`): kernel gaussiano das 6 alturas de borda e do pico do meio, o ondulado do mundo (`swellAt`, abaixo) e platô de vila, mais uma correção que prende a borda a um perfil de emenda compartilhado. O perfil da borda é função só da altura do canto de cada ponta e do meio da borda (`BuildOpts.levels.terrain.co/he`): duas peças que concordam nesses números casam ponto a ponto. Onde a vizinha de terra já estava assentada (`World.seamOf`, por índice), a peça nova adota o perfil dela e faz o talude por dentro; água e trilho não copiam (a diferença vira cachoeira). Malha de 8 divisões por setor só nas peças com relevo (4 nas planas, 12 com água). A borda de terra sem vizinha já assentada não vira parede: ganha uma saia (abaixo). A decoração assenta na altura do ponto (`liftAt`) e foge de encosta íngreme (`STEEP_MAX`); a vila aplaina um platô. A rocha vem do shader do chão pela inclinação (`U.rock`, `U.rockColor`, estratos por altura), só nesse modo.
    - **Ondulação (R5): sem paredão, terreno contínuo.** O relevo é uma colina só por cima do tabuleiro inteiro, e duas regras garantem isso sem tocar nas peças já assentadas (invariantes 3 e 10):
      - **Ondulado do mundo** (`swellAt(seed, X, Z)`, `terrain.ts`): o relevo miúdo (~0,95 nível de amplitude, 3 oitavas) é ruído do MUNDO, não da peça (`TerrainSpec.world` leva o centro, o giro e a semente da partida); a divisa lê o mesmo valor dos dois lados, então a emenda continua casando com ele ligado. O morro do meio sobe `MORRO_BONUS` acima do nível lógico (só aparência).
      - **Saia** (toda borda sem vizinha já assentada, de qualquer altura; `skirtFor` em `tileBuilder.ts`): em vez do paredão, a peça ganha uma encosta em curva de morro (`skirtDrop`: reta com ombro e pé arredondados, inclinação média ~35°, largura `skirtWidth` até `SKIRT_MAX` = 1,0) que desce do lado de fora, DENTRO da casa vizinha, até o fundo da peça nas bordas baixas (`skirtEnd`: o pé fica sempre na mesma altura absoluta, então não há paredinha no nível 0) e com um beiral curto nas altas. É uma faixa paralela à normal da borda mais um leque de 30° em cada canto (o limite com a casa do lado é o raio do canto). A altura da saia é a do vértice da borda (perfil mais ondulado, e o leito perto da água); a cor vai do chão à terra só no flanco. Borda de trilho também ganha saia. Na borda de rio ou lago a água não acaba em corte de vidro: o fundo sobe a um lábio raso (`OPEN_LIP`), a encosta sob a boca cai logo (`SKIRT_CHUTE`, como a queda que a vizinha mais baixa fará, no mesmo lugar da lâmina dela) e uma película de espuma (`WaterBuf.film`) a acompanha. O ondulado nunca baixa o chão abaixo da linha d'água (`liftAt`): sem poça solta nem casa dentro da água (`tests/terrain.ts`).
      - **A peça que chega depois já sabe da saia** (`TerrainSpec.env`, uma flag por borda com vizinha de terra mais velha): o chão dela nunca passa abaixo da mesma curva (`Math.max`, a mesma função dos dois lados, lida com a altura da borda já com o ondulado), então a saia some embaixo do chão novo e nada fura, em qualquer ordem de colocação. A saia da peça velha desce `SKIRT_UNDER` a mais para não ficar no mesmo plano que o chão da nova (cintilação). Em casa vazia entre platôs as saias das vizinhas se somam: sobra uma baía clara e baixa de encostas em curva, não um poço. A areia e a espuma do mar começam no pé da saia (`SeaMap.add(q, r, margin)`).
      - **Rocha** só nas encostas íngremes (a partir de ~40°, `rockK` em `materials.ts`), com um tanto da cor do vértice.
      - Conferido em `tests/terrain.ts`: curva da saia, emenda com o ondulado e a saia nunca acima do chão da peça nova.
    - **Terra contínua (B1, Fase 1 do plano de encaixe):** com o fluido ligado (padrão no Relevo) o terreno deixa de seguir os setores do hexágono. (1) **Campo de terreno:** `groundMap.landTexture` guarda os pesos de terreno de cada texel do mundo; `makeGroundMaterial` o lê num nível borrado do mip (`LAND_LOD`), num ponto deslocado por ruído do mundo (`LAND_WARP`), soma um ruído próprio a cada peso e deixa vencer o terreno de maior peso, com borda mole (`LAND_SOFT`): o contorno das manchas ondula e atravessa as emendas (a mesma conta nos dois lados). Os pesos do vértice (`sp0`) viram os do campo (`sp`) só onde há terreno (rio e estrada ficam como estavam), e a cor do vértice recebe só a diferença entre a mistura do campo e a dos vértices (`landShift`, com as cores dos terrenos do tema em `U.landCol`); a costura do hexágono (`seamAt`) fica de fora (`U.land`). `BuildOpts.continuous` tira o sorteio de tom do prado por peça (o degrau entre vizinhas lia como hexágono) e espalha a mata em franja irregular pelo prado vizinho (gerador à parte). A pilha zera `U.land`, como zera `U.seam`. O chão do campo é um **material à parte** (`makeGroundMaterial(true)`, escolhido por `Lib.land` no `World.setFluid`): na mesma malha de nós o campo mudava o sombreamento dos outros modos mesmo com `U.land` em 0 (o `compare` do Clássico acusava o Egito ao pé do rio), então os outros modos compilam o chão de sempre. (2) **Normal suave:** a normal do chão sai da diferença central do mapa de alturas (`RELIEF_E`), no lugar da normal plana de cada triângulo; as quinas retas das encostas, em 60° e em 120°, somem; a areia de margem de rio (pouco terreno) e a lateral íngreme mantêm a normal do triângulo. (3) **Peça menos gorda:** o ondulado do mundo tem colinas largas de topo chato (`SWELL`: comprimentos de onda de 9, 4 e 1,7, saturação por tanh), o morro do meio sobe `MORRO_BONUS` = 0,3 (kernel `CENTER_W` = 1,5) e o alvo de cada setor puxa `WORLD_PULL` (42%) para a borda da vizinha já assentada (`World.levelsFor`: só aparência, a mesma conta no jogo e na reconstrução), então a peça cercada de vizinhas baixas não vira almofada; a saia mistura a curva em S com um talude (`SKIRT_TALUS`: o topo mais firme e o pé comprido e suave). (4) **Costa e casas vazias:** `SeaMap.add(q, r, margin, unwarp)` mede a distância euclidiana ao hexágono de origem do ponto (a espuma e a areia dobram os cantos em arco); as casas vazias são discos que esmaecem e se fundem (`slotBlob`), e o tracejado de influência é um anel de contorno ondulado.
    - **Águas que descem (E4):** `src/core/water.ts` (puro). `Rules.springs`, `flowPoints` (8), `seaPoints` (60), `seaTiles` (2). Nascente = peça de rio com 1 ou 2 bordas de água e nível 1 ou 2, sorteada por hash da semente da própria peça (`isSpring`, gerador à parte: a sequência não muda; a nascente já aparece na pilha). O curso desce de água para água vizinha no mesmo nível ou abaixo; cada peça com água corrente rende `flowPoints`, e o curso que chega ao mar (lago de 3+ bordas ou água no nível 0) rende `seaPoints` e `seaTiles` peças, uma vez por nascente. Água fora do curso é parada: 0 ponto, sem proibir a jogada. O estado é função do tabuleiro (`Board.waterNow`) e os pontos são a diferença antes e depois da peça, então replay, desfazer e prévia batem; `Check.water` e `PlaceResult.water` trazem o ganho. O render lê a correnteza de lá (`World.flowAt`); água parada tem correnteza zero, e a peça nova refaz só o buffer de água das peças antigas que passaram a correr (`World.syncWater`). Oráculo em `tests/logic.ts` (`oWater`) e cenário 12 em `tests/synthetic.ts`. **Nascentes escondidas (R5):** além das que vêm na peça, `generateHiddenSprings(seed, Rules.hiddenSprings)` (gerador à parte, como `sites.ts`; 4 no Relevo) sorteia casas de altura máxima do relevo da semente (`levelAt` = 2, a 4 a 12 casas do Centro, sem duas coladas). A casa se revela quando uma peça com água encosta nela (`Board.revealedSprings`, função do tabuleiro, sem estado) e vira carimbo de gota no mapa com etiqueta; uma peça de rio no nível 1 ou mais, com 1 ou 2 bordas de água, que pouse ali vira a nascente e rende `Rules.hiddenSpringPoints` (30) além da água (`Board.springKind`, `Placed.hiddenSpring`, `water.hidden` no `Check` e no `PlaceResult`). Oráculo em `tests/logic.ts` (`oWater`, nascentes reveladas e gerador). Sem `SAVE_VERSION` novo: o Relevo ainda não saiu da lista "Mais modos". Ganchos: `?spring=i` ou `?spring=mar.i`, `window.__water(i, zoom, mar)`, `window.__ghostWater()`.
    - `World` guarda a semente (`reliefSeed`, posta pelo `newGame`) e tira o nível de `levelOf`/`heightOf`/`heightAt` (`LEVEL_STEP` = 0,3 de altura por nível). A peça é montada em y local 0 e levantada pela matriz (`tileMatrix`): decorações, vida e efeitos herdam a altura; a pilha e a galeria ficam no 0. O que for desenhado numa casa fora de uma peça (marcas, estandartes, fantasma, maravilha, estampas) soma `heightOf`.
    - `buildTile` recebe `BuildOpts.levels` (nível próprio e das 6 vizinhas, na orientação de origem). Peça no nível 0 sai idêntica à de antes. Em platô: a parede desce sempre até o fundo comum (sem fresta em qualquer ordem), em rocha de camadas (`relief.rock`) onde a vizinha é mais baixa; estrada e trilho descem em rampa (`RAMP_ROAD`) até o nível da vizinha mais baixa, com o chão acompanhando a mesma função (`rampY`). O rio não desce em rampa: cai em cachoeira (R3, abaixo).
    - A correnteza é forçada pelo nível (`flowAt`): a água sai pela borda da peça alta e entra pela da baixa, igual dos dois lados. O barco trata o degrau como fim de linha e a rota dele acaba antes do lábio (`Life.fallPull`, 0,18) e antes da espuma da bacia (0,27).
    - **Cachoeira (R3):** onde a borda de rio dá numa casa mais baixa (`opts.levels.nb[i] < own`), a peça alta sobe o fundo do rio até um lábio de pedra na borda (`FALL_LIP`, `LIP_Y`: 12 mm de água por cima, laje de pedra, pedras nos dois lados) e constrói a lâmina (`TileBuild.fall`, curva de lançamento que avança `FALL_D` além da borda, vertical até o chão do mundo: com a vizinha assentada o resto fica sob a água dela, com a casa vazia a queda segue até o mar e leva a espuma dele); onde dá numa casa mais alta, a peça baixa põe o anel de espuma na água (`TileBuild.foam`) e pedras na bacia. Cada lado sai só dos níveis, na orientação de origem, então a emenda não depende da ordem. A correnteza acelera perto do lábio. O `World` guarda as quedas assentadas em `falls` (`FallLayer`): névoa em sprites (`spawnMist`, 2 a 4 por queda, pelo `dt` do mundo, só perto da câmera) e som (`Ambience.fall`, ruído filtrado com volume pela distância do foco à queda mais próxima, `nearestFall`). Cores por tema: `relief.fall` (`tint`, `foam`, `mist`). Peça com rio entre níveis na galeria ou na pilha (sem `levels`) sai sem cachoeira.
    - O clique usa `World.pickHex` (um plano por nível, do mais alto ao chão); a câmera segue a altura da casa sob o alvo (`focusY`). O mapa do chão e a costura de cor continuam 2D.

### Interface calma

O HUD mostra, além do placar, no máximo um cartão: as missões são um único cartão ("N missões ›", `quest-fold` em `hud.ts`) que abre a lista; clicar numa missão leva a câmera até ela. Os estandartes (`.marker`, DOM) são pequenos e levam a classe `far` (opacidade 0) quando o zoom está aberto (`rig.dist` > `QUEST_FLAG_DIST`), a peça está longe do centro (`QUEST_FLAG_REACH`) e a lista está fechada. A opção "Interface mínima" (`retalhos.minimal`, ligada por padrão; só `'0'` a desliga; fica em Aa) põe `html.min-ui`: esconde o brasão do placar (segue no menu de temas), abre o minimapa fechado e apaga a faixa de dicas depois da 1ª jogada. O Almanaque tem a tecla `I` e um item no menu ⋯. Não esconda nada de que se precisa para jogar (placar, pilha, desfazer).

## Orçamento de desempenho

Medido com `RUNS=300:high node scripts/stress.mjs`, renderização por software:

| Peças | Qualidade | Draw calls | Triângulos | Instâncias |
|---|---|---|---|---|
| 300 | alta | ~136 | ~1,46 milhão | ~53 mil |
| 300 | ultra | ~248 | ~2,82 milhões | ~69 mil |

Números de 2026-10-02, depois do traço, do pincel, dos aldeões, dos estandartes e da maravilha (a Alta tinha ~94 draw calls na v4 e ~111 no PR #5). No WebGPU por software, a CPU por quadro inclui a espera pelo SwiftShader e não serve de medida.

- **Árvores leves de longe (D19):** com a câmera aberta (`?zoom=30`, Alta, 300 peças, 25 s de espera para a câmera assentar) os triângulos caem de ~965 mil para ~771 mil (-20%); no Ultra, de ~2,36 milhões para ~1,41 milhão (-40%, as cascatas de sombra repetem as árvores). O `stress.mjs` com o enquadramento padrão passou de 1284 mil para 770 mil (Alta) e de 2356 mil para 1409 mil (Ultra), mas ali o número oscila com o quadro da sombra: confie na medida com `zoom=` fixo.
- **Regra prática:** uma mudança visual não deve subir triângulos ou draw calls em mais de ~10% sem justificativa escrita no commit.
- **Qualidade:** o seletor em tempo real vai até o Ultra; `?quality=cinema` e um `cinema` salvo viram Ultra, e o Cinema ao vivo só vale com `debug`, `perf`, `stress`, `auto` ou `demo` na URL (`stress.mjs` e `screenshots.mjs` já têm). A foto (`Capture.renderPhoto`) liga o Cinema só para tirar, desenha 1,5× acima do tamanho final, reduz e volta ao nível anterior; o vídeo escolhe a qualidade no diálogo. Cinema (fotos e vídeos: desenha 1,5× acima da tela e reduz, SSGI, reflexos SSR e raios de luz com mais amostras, 4 cascatas de sombra, 60% mais vegetação, grão de filme e aberração de lente), Ultra (pensado para GPUs acima da RX 580: sombras em 3 cascatas de 4096, GTAO em meia resolução com 16 amostras mais a luz rebatida do chão reforçada (`BOUNCE_ULTRA`, `LAMPS_ULTRA` em `world.ts`), o céu na água só pelo Fresnel do material (sem SSR), sem raios de luz, TRAA, bloom, desfoque de miniatura (tilt-shift em meia resolução, nítido na faixa central da tela e mais forte com o zoom aberto, `P.tilt`; a profundidade de campo fica só no Cinema), o mesmo grão e a mesma lente, DPR até 2 e 35% mais vegetação; SSGI, SSR e raios de luz ficam só no Cinema, e o Ultra custa cerca de 40% menos por quadro que antes), Alta (GTAO em meia resolução, sombra única de 2048, bloom, o mesmo desfoque de miniatura, TRAA, o mesmo grão e a mesma lente), Média (MSAA, sem pós pesado) e Baixa (sem pós e sem sombras). Cada nível tem um teto de pixels desenhados (Cinema 4K × 2,25, Ultra 4K, Alta 1440p, Média e Baixa 1080p; `PIXELS` em `world.ts`): numa tela 4K, descer de nível também reduz a resolução interna. A densidade de decoração é multiplicada por 1,6 (cinema), 1,35 (ultra), 1 (alta), 0,65 (média) ou 0,4 (baixa).
- **Economia de quadros:** com o jogo parado (4 s sem entrada e nada se movendo: peça caindo, câmera, fantasma, troca de hora), desenha a 30 qps e, depois de 15 s, a 20; janela sem foco, 20; qualquer entrada volta à taxa cheia. A regra é pura (`framePacing.ts`, testada em `tests/video.ts`) e o `dt` do tick segue o tempo real, então o mundo não salta. Gravação, foto, `?perf`, `?stress`, `?auto`, `?demo`, `?economia=0` e `window.__perf` desligam a economia, para a medida não ser falseada; o `?debug` mostra a taxa-alvo.
- **Sombra guardada:** com ou sem cascatas, o mapa de sombra (e o dos raios) só é refeito quando o sol anda ~0,4°, a câmera anda ~0,15 ou gira ~0,35°, uma peça assenta ou passam 0,25 s (árvores ao vento, barcos e moinhos ficam com a sombra a 4 Hz). Num quadro parado `shadowDraws` é 0; ao redesenhar, é o das cascatas.
- **Modo automático:** começa pelo nome da placa de vídeo (`gpuTier.ts`: Alta na RX 580, Ultra da RTX 3060 e da RX 6600 para cima, Média no Iris Xe e nos celulares); sem um nome conhecido (`autoStartTier`), começa em Alta no computador e em Média nas telas de toque; integradas (Intel UHD/HD/Iris Xe, Ryzen "Radeon Graphics") ficam na Média. Nunca escolhe o Cinema. Se o quadro passar de ~26 ms, primeiro baixa a resolução interna em degraus de 10% até 60% (`dynres.ts`) e só no último degrau desce de nível.
- **Ainda não foi medido:** o FPS numa GPU de verdade.

## Tarefas comuns

### Novo tema

1. Copie um dos arquivos de `src/themes/` (ex.: `oriental.ts`) para `src/themes/<id>.ts` e acrescente o tema à lista `THEMES` de `src/themes/themes.ts`.
2. Troque `id`, nomes, cores e kits, e a gradação (`grade`: tom das sombras, dos realces e saturação). Os campos estão comentados em `types.ts`.
3. Confira as formas com `?gallery&theme=<id>`.
4. Adicione o tema em `scripts/screenshots.mjs` e `scripts/weather.mjs` e gere a captura.

O menu agrupa os temas pelo campo `period` sem nenhuma outra mudança. Os testes já rodam as regras de todos os temas (`THEMES`). Se o tema tiver `rules` próprias, rode `npm test`.

### Variantes de casa

Cada tema tem 3 a 6 tipos de casa (`houses`); as variantes de silhueta (`steep`, `cross` e o corpo `annex`) entram com peso baixo (0,06 a 0,14) e `minor: true`, que as deixa de fora do sobrado da terceira era (`risingKind`). Parede e telhado de cada tipo são os pools `wall:i` e `roof:i`, então um tipo novo custa 2 draw calls só onde aparece. A proporção de cada casa (largura e profundidade, 0,8 a 1,3) sai de um gerador à parte em `addHouse`, com a mesma tripla de escala na parede e no telhado.

### Novo kit (árvore, casa, telhado, marco, plantação, animal, barco, veículo, estilo de estrada)

1. Acrescente o valor ao tipo de união em `src/themes/types.ts`, com um comentário de uma linha.
2. Desenhe o kit no `switch` correspondente de `src/render/lib.ts`: `treeGeometry`, `roofGeometry`, `landmarkGeometry`, `cropGeometry`, `animalGeometry`, `boatGeometry`, `vehicleGeometry`. Em `BODY` e em `CROP_LAYOUT`, que são `Record`, o compilador já cobra a entrada.
3. Use `kit()` com cores por vértice. Use `tint` só nas partes que devem receber a cor do tema.
4. Mantenha poucos triângulos: veja o orçamento acima.
5. Use o kit em algum tema. Gere a galeria e as capturas.

**`CropStyle` novo** não pede mais nada além disso: o valor no tipo, a entrada em `CROP_LAYOUT` (o compilador cobra) e o `case` em `cropGeometry`, tudo em `lib.ts`. O `tileBuilder` já planta qualquer cultura em parcelas (`Theme.terraces` também vale para ela). Só dois ajustes são opcionais e ficam no `tileBuilder`: `tintAmt` (quanto a terra puxa a cor da planta, 0,42 por padrão) e `hedge` (culturas em sebe, com as plantas alinhadas à fileira).

A lista priorizada de kits que faltam está no fim de `docs/TEMAS.md`.

### Portal e ponte

São opcionais no tema (`gate` ou a lista `gates`, `bridge`) e não pontuam. O `buildTile` decide onde entram sem sorteio: o portal na primeira borda de estrada vizinha de vila, a ponte no meio de um rio de 2 bordas com vila numa margem. Para um tema novo, basta escolher o estilo e as duas cores.

### Nova interação entre bordas

1. Acrescente o par em `src/core/synergy.ts`: o tipo `SynKind`, `SYN_KINDS` e `synergyOf`.
2. Acrescente o nome do par em `Theme.synergy` (`types.ts`) em **todos** os temas.
3. Desenhe a construção em `tileBuilder.ts`, no trecho que trata `opts.synergies`, perto do meio da borda.
4. Acrescente a geometria em `specialsFor` (`lib.ts`).
5. Atualize o oráculo `SYN_PAIRS` em `tests/logic.ts` e a legenda de ajuda em `main.ts`.

### Mudar regra ou pontuação

1. Edite `Rules`/`DEFAULT_RULES` e `Board`.
2. Atualize o oráculo em `tests/logic.ts`.
3. Aumente `SAVE_VERSION` se o replay mudar.
4. Atualize a seção "Como jogar" do `README.md`.

## Mecanismos de tema

Campos opcionais de `Theme` (comentados em `src/themes/types.ts`) que dão a cada tema um jeito próprio sem `if (theme.id)` (invariante 8). Com o campo ausente o tema sai exatamente como saía (o `npm run compare` e o `stress.mjs` não mudam). Cada um tem um renderizador genérico: o tema só preenche dados.

| Campo | API (o que o tema escreve) | Onde roda |
|---|---|---|
| `fauna` | `{ kind: AnimalKind; weight; colors[]; time?: 'dia' \| 'tarde' \| 'noite'; where?: 'prado' \| 'floresta' \| 'campo' \| 'margem' \| 'agua'; chance? }[]`. Uma espécie por lugar e por peça, sorteada pelo peso; `chance` (padrão 0,25) é a da peça ganhar o bicho. Fora da `time` o bicho some aos poucos e volta sozinho (`dia` = amanhecer ao pleno dia, `tarde` = hora dourada e entardecer, `noite`). | `tileBuilder` (gerador à parte `seed ^ 0xfa07a`, depois de tudo) e `Life` (mesmo passeio dos `animals`, pool `fauna:<kind>`) |
| `gates` | `{ style: GateStyle; colors: [estrutura, topo] }[]`; cada peça com portal sorteia um estilo pela própria semente (gerador à parte). `gate` continua valendo como atalho de um estilo só; `gatesOf(theme)` junta os dois. | `tileBuilder` (pools `gate:<i>`), `Lib.applyTheme` |
| `ambience` | `{ kind: 'aves' \| 'sapos' \| 'grilos' \| 'cigarras' \| 'vento' \| 'gelo' \| 'sinos' \| 'agua'; weight }[]`; o peso escala a chance e o volume. Soma-se ao ambiente por proximidade (`Sfx.setAmbience`): sapos ao entardecer e à noite perto de água, cigarras de dia, grilos à noite, uivo de vento, estalo de gelo, sino de vila ao longe, pingos. Tudo sintetizado. | `audio.ts` (`Sfx.setThemeAmbience`, `themeSound`) |
| `eggs` | `EggSpec[]` (`src/core/eggs.ts`): `{ id, name, note?, when: EggTrigger[], holidays?, once?, effect: EggEffect[] }`. Gatilhos (todos precisam valer): `pecas {n, min?}`, `grupo {terrain, min}`, `bordas {terrain, min, max?}`, `sorte {chance}` (de peça, puros e deterministas) e `hora {from, to}`, `data` (usa `holidays: {month, day, until?}[]`, local, cosméticos). Efeitos: `kit {kit, scale?, color?}` (só com gatilho de peça; kits em `eggGeometry`, `lib.ts`), `evento {event: 'bando-dourado' \| 'procissao' \| 'corvos' \| 'treno'}`, `ceu {tint, strength?, seconds?, aurora?}` (0 segundos = enquanto o gatilho de relógio valer; `aurora` 0 a 1 acende a cortina boreal pálida mesmo de dia), `som {sound: 'sinos' \| 'brilho' \| 'coro'}`. Exemplo ligado: Holanda, `mil-pecas` (a milésima peça solta um bando dourado e toca sinos). Eventos extras do Brasil: `maria-fumaca` (locomotiva atravessando a peça pelas bordas de trilho, com fumaça; `Life.passage(..., smokeY)`), `festa-junina` (balões subindo à deriva, `Life.passage(..., rise)`) e `revoada` (bando grande de `skyBirds`); kits `profetas` e `onca`. Evento novo: `EggEvent` + o `case` em `World.playEgg`; kit novo: `EggKit` + o `case` em `eggGeometry`. | `EggTracker` em `World.feedEggs` (kit na peça, reavaliado em silêncio no replay; evento, céu e som ao pousar, ao vivo), `eggClock` em `main.ts` (hora e data), `Life.flush/passage` |
| `skyFx` | `'aurora'`: cortina verde e violeta animada por `U.time`, só à noite (`U.aurora` sobe com a noite). Aparece no reflexo do mar (`surround: 'mar'`), no brilho do fundo da névoa e na cúpula do céu quando o horizonte entra na tela (câmera baixa). Sem GPU de verdade, o custo no Ultra só se mede no PC. Nível Baixo não tem a cúpula. | `aurora.ts`, `atmosphere.ts`, `materials.ts` (`seaLook`), `World` (cúpula na cena das nuvens) |
| `floodplain` | `{ reach, color }`: o prado e a plantação a menos de `reach` unidades da água (1,7 ≈ uma peça) puxam para `color`; mais longe vale a cor de `ground`. Mapa de distância ao rio (`riverMap.ts`, só cresce) lido pelo chão: independe da ordem das peças e não mexe na geometria nem na semente. A pilha não mostra a várzea (como a costura de cor). | `riverMap.ts`, `makeGroundMaterial`, `World.bake` |
| `irrigation` | `{ color, cross }`: cada parcela de plantação ganha um canal reto de água no sentido das fileiras e, com chance `cross`, um canal cruzado; as plantas abrem espaço (a menos de 0,024) para ele. Mais o shaduf (`shaduf`, estático, `kits/egito.ts`) na margem de todo campo que toca o rio. Só geometria do chão da parcela e um pool de decoração; os canais saem de um gerador à parte (`seed ^ 0xca4a1`), então o resto da peça não muda. | `tileBuilder` (bloco das plantações e construções internas), `Lib` |
| `terraces` | `{ levels: 2 \| 3; styles?: CropStyle[]; rise?: number }`: cada parcela de plantação vira patamares concêntricos baixos (12 mm cada, vezes `rise`: o Oriental usa 2,4) com mureta e beiral de 4 mm, e as plantas sobem com eles. A borda da peça fica na altura 0 (a emenda não muda) e o gerador da peça não gasta nada. Sem `styles`, todas as culturas. | `tileBuilder` (bloco das plantações) |
| `forestRows` | `true`: a mata de cada peça de floresta vira 2 ou 3 fileiras retas e paralelas à borda, cada uma de uma espécie só (alameda de álamos da Holanda, `TreeGeo` `poplar`). Tudo sai do gerador da mata (`frng`): o resto da peça não muda. Omitir = mata espalhada, como sempre. | `tileBuilder` (bloco da floresta) |
| `relief.style: 'dique'` | O relevo vira um aterro baixo e comprido (o morro achatado em x e z, 20% da altura), sem serras: `{ amp, style: 'dique' }`. Nas vias, `road: 'dike'` (`RoadStyle`) ergue o aterro gramado com o caminho de tijolo por cima (`ROAD_Y.dike`: os veículos andam em cima). | `tileBuilder` (relevo e estradas), `life.ts` (altura do veículo) |
| `groundKits` | `{ kit: GroundKit; chance; colors[]; count?: [min, max] }[]`: tufos de 1 a 3 do kit (hoje só `cupinzeiro`) num setor de prado da peça, por um gerador à parte (`seed ^ 0xc0b1d0`, depois da fauna). Kit em `ground:<kit>`; a cor da instância tinge o kit. | `tileBuilder` (bloco logo antes dos ovos de peça), `Lib.applyTheme` |
| `skyBirds` | `{ kit: 'arara'; colors: [corpo, asa, ponta]; n?: [min, max] }`: os bandos que dão voltas no céu (pool `bird`) usam esse kit no lugar do pássaro escuro; `n` é o tamanho do bando (padrão 2 a 4 com o campo, 5 a 7 sem ele). O evento `revoada` dos ovos solta um bando maior. | `Lib.applyTheme`, `Life.sync` |
| `surround: 'chapada'` | O entorno vira capim seco com manchas de terra vermelha (`u.cap` no `makeVoidMaterial`, a cor sai de `ground[0]` e `ground[2]`); mesmo material, sem malha nem draw call a mais. | `materials.ts`, `World.setSurround` |
| `relief.crown` | Cor da mata no topo da serra (facetas altas de cor fixa, linha irregular), no lugar da neve. | `relief.ts` (`peakGeometry`) |
| `relief.fall` | `{ tint?, foam?, mist? }`: cor da água da cachoeira (padrão: a água do tema, mais clara), das faixas e da espuma da bacia (padrão: branco azulado) e da névoa do pé (padrão: a da espuma). A cachoeira existe em todo tema com `relief.levels` (onde o rio muda de nível). | `materials.ts` (`makeFallMaterial`, `FALL`), `fx.ts` (`makeFoamMaterial`), `lib.ts` (`applyTheme`), `world.ts` (`spawnMist`) |
| `fieldSnow` | `number` (0 a 1, padrão 1): quanto da neve de inverno cobre as parcelas de plantação do chão (`U.fieldSnow`, `makeGroundMaterial`). O lago congelado (`crops: icefield`) usa 0,12; as rachaduras e o pesqueiro (`icecamp`) usam o material `ice`, quase sem neve por cima. Kits do Inverno Nórdico (rena, alce, raposa, trenó, gelo, pórtico de dragões, stavkirke, troll) em `src/render/kits/inverno.ts`, que recebe as primitivas do `lib.ts` por injeção (`PRIMS`). | `materials.ts`, `world.ts` (`setTheme`), `lib.ts`, `tileBuilder` (pesqueiro por parcela) |

Kits da Holanda (T1, `src/render/kits/holanda.ts`, só dado de geometria, chamado por um `case` em `lib.ts`): empenas `bell` e `neck` (`RoofStyle`), `poplar`, plantação `bulb`, `duck` (`AnimalKind`), barco `tjalk`, ponte `draw`, portão `brick` e o moinho de vento (torre octogonal). Kits de ovo novos: `queijo` e `menino-dique` (`EggKit`).

Outros campos e kits que vieram com o Oriental (todos opcionais, o tema sem eles sai como saía):
- `relief.mist` (cor): a rocha da serra desbota para ela do pé a ~60% da altura (e a cor da instância tinge menos) e escurece para o cume, como a tinta; `relief.tall` (padrão 1) deixa as serras mais altas e estreitas; `relief.slopeTrees` (lista de `geo`) limita as árvores que sobem a encosta (pinheiros), com um gerador próprio.
- `RoadStyle 'stepstone'`: terra batida com lajes de passo alternadas e tufos na beira (gerador à parte, `seed ^ 0x57e95`); não desenha trilhos nem sulcos paralelos, então não lê como ferrovia (o `dirt` desenha dois sulcos e parecia trilho).
- Copas perenes (`EVERGREEN` em `lib.ts`: conífera, abeto, cipreste, pinheiro-manso, araucária e `niwaki`) usam o material `evergreen`: a estação não as tinge, só a neve. Sem isso a primavera misturava 35% de rosa-pálido na copa verde-escura e a deixava cinza-lavanda nos temas de primavera travada.
- `TreeGeo 'niwaki'`, `AnimalKind 'heron'` e os `EggKit` `cerejeira-milenar`, `lago-carpa` e `gato-da-sorte` são desenhados em `src/render/kits/oriental.ts`.

Ao ligar um mecanismo num tema:
- **Confira na imagem**, com `?time=` e as capturas: `window.__fauna`, `__deco('gate', i)`, `__deco('egg:', i)` e `__egg(id)` levam a câmera até o efeito. `?auto=40&seed=` monta sempre o mesmo tabuleiro. Em software o mundo anda devagar (`timescale=4` com janela pequena acelera os eventos e o tom de céu).
- **Orçamento**: cada espécie de `fauna` e cada estilo de `gates` é um pool, ou seja, um draw call a mais onde aparece; `terraces` soma triângulos de chão (uns 30 a 60 por parcela). Meça com `RUNS=300:high node scripts/stress.mjs` (regra dos ~10%).
- **Legibilidade**: `floodplain`, `terraces` e a cor dos bichos mudam o contraste com a vila; rode `npm test` (`tests/legibility.ts`) e olhe `?silhueta`.
- **Sem `SAVE_VERSION`**: nenhum deles mexe em regra, pontuação nem replay. Um ovo de peça que mude o jogo (pontos, peças) já não é easter egg: vira regra e pede `SAVE_VERSION`.

## Estado atual e próximos passos

- **Feito (outubro de 2026, depois da v4):** água física (leito visível, cáusticas, esteiras); acabamento (oclusão só na luz indireta, nitidez, cor por hora, sombra firme); luz e céu (amanhecer e hora dourada, névoa por altura, lampiões, luz rebatida do chão, nuvens volumétricas); cinema e vídeo (nível Cinema, Auto pela placa com resolução dinâmica, modo foto, gravação e filme da partida em MP4). Detalhes em `docs/VIABILIDADE.md`.
- **Feito (v4, outubro de 2026):** renderização WebGPU/TSL com GTAO, TRAA, bloom e profundidade de campo; rios escavados com correnteza; céu procedural (IBL); chão com detalhe por terreno; clima por tema; vilas com trilhas; eras da vila, sítios, bônus por tema, desfazer e 6 modos (o Estrada Real tem a regra das rotas). O andamento do plano de Age of Empires está no topo de `docs/IDEIAS_AOE.md`; as vinte propostas estão feitas, inclusive minimapa e linha do tempo, interface por tema, estações e monumentos.
- **Feito (v3):** 14 temas (consolidados em 5 na rodada 3, etapa T0), kits detalhados, 4 interações com prévia em dourado, mundo animado, dia/entardecer/noite, qualidade adaptativa, save v3 com replay, duas rodadas de revisão de código com correções. O histórico está em `docs/VIABILIDADE.md`, Apêndice A.
- **Pendente:**
  - medir o FPS numa GPU real (`?stress=1000&quality=high&perf`, ou `window.__perf(5)` com a tecla `F`) no PC e no celular;
  - kits de fidelidade histórica que ainda faltam (`docs/TEMAS.md`, fim): roda-d'água como `MillStyle`, cipreste em alameda, estação de fim de linha por tema;
  - funções de jogo: bandeiras (`docs/VIABILIDADE.md` §12); as peças especiais já existem (`specials.ts`). Desfazer e as 3 próximas peças já existem na v4: as próximas peças aparecem como recompensa do mirante;
  - otimizações com folga conhecida: sombra em cache no Ultra e no Cinema, renderizar sob demanda no computador (`docs/VIABILIDADE.md` §5). O corte por super-bloco de 32×32 (com 6 casas de margem no central: o Relevo estica o mapa para um lado) e a sombra única a 4 Hz já existem.
- **Publicação:** o GitHub Pages (`.github/workflows/pages.yml`) publica o `dist/` da `main` em `https://rbizarello-lang.github.io/Dorf/`. O ambiente `github-pages` precisa incluir a branch `main` nas regras de deploy. O `base` do Vite fica em `'./'` de propósito, para o arquivo único funcionar nesse caminho. `scripts/artifact.mjs` continua gerando a página sem as tags de documento, para outro formato.
