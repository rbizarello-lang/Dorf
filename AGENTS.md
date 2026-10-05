# AGENTS.md: guia para agentes de IA

> **Resumo em inglês:** *Retalhos* is a relaxing hex-tile puzzle in the Dorfromantik genre, with 14 historical/regional themes. Stack: TypeScript, three.js r186 (WebGPURenderer with TSL node materials; WebGPU where available, automatic WebGL2 fallback) and Vite, with procedural geometry and no art assets. The build is a single HTML file. Before every commit, run `npm run check`, which does the typecheck, simulates 600 games and builds. UI text, docs, code comments and commit messages are in Brazilian Portuguese.

Este arquivo existe para que qualquer agente (Claude Code, Codex, Cursor, Copilot, Gemini etc.) entenda o projeto e trabalhe nele sem quebrar o que já funciona. O `README.md` é o manual de quem joga e roda o projeto. Este arquivo é o manual de quem mexe no código.

## O projeto em uma tela

- **O que é:** um protótipo jogável (v3) de puzzle de peças hexagonais. Cada peça tem 6 bordas de terreno, e quem joga encaixa a peça no mapa buscando bordas iguais.
- **O que a v3 tem:**
  - 14 temas de países e épocas;
  - interações entre bordas diferentes, que dão pontos e erguem construções;
  - mundo animado: trigo ao vento, barcos, trens, moinhos, animais;
  - ciclo de dia, entardecer e noite.
- **Sem arquivos de arte:** casas, árvores, plantações, animais, barcos e sons são gerados em código. Não existe pasta de assets e não deve passar a existir sem uma decisão explícita.
- **Saída:** `npm run build` gera `dist/index.html`, um arquivo único com JS e CSS embutidos.
- **Documentos:**

| Arquivo | Para que serve |
|---|---|
| `README.md` | regras do jogo, controles, temas, parâmetros de URL |
| `docs/VIABILIDADE.md` | decisões de arquitetura, medições de desempenho, histórico das revisões de código, riscos |
| `docs/TEMAS.md` | pesquisa histórica dos 8 temas de época e a **lista priorizada de kits a adicionar** |
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
npm test             # 600 partidas simuladas com oráculos independentes, cenários sintéticos e legibilidade das cores (tests/legibility.ts)
npm run balance      # painel de equilíbrio (tests/balance.ts): média, p10/p50/p90 e origem dos pontos, por modo e por tema. Não entra no check. `npm run balance -- 40` muda o tamanho da amostra (padrão 80)
npm run build        # dist/index.html (arquivo único)
npm run smoke        # depois do build: abre o jogo em WebGPU e WebGL2 e falha com erro no console
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
- **Capturas:** só faça commit das PNGs de `docs/screens/` quando a mudança visual for intencional. Se gerou capturas apenas para conferir, desfaça com `git checkout docs/screens/`.
- **Rede:** o Chromium tenta acessar domínios do Google. Em ambiente com proxy, essas falhas de conexão são esperadas e inofensivas.

### Ganchos de depuração no navegador

| Gancho | O que faz |
|---|---|
| `?debug` | mostra FPS, draw calls, triângulos e instâncias |
| `?perf` | mede 5 s e mostra o FPS mediano e o p95; `window.__perf(segundos)` devolve o mesmo, com as estatísticas do último quadro |
| `?gallery&theme=<id>` | mostra todos os kits do tema lado a lado; `window.__gallery` lista as chaves |
| `?auto=40` | a IA gulosa coloca 40 peças |
| `?stress=1000` | teste de carga; o resultado fica em `window.__load` |
| `?focus=4` | centraliza a câmera na peça com mais bordas do terreno (4 = rio); `window.__focus(t, zoom)` |
| `?webgl` | força o backend WebGL2 (o padrão é WebGPU quando o navegador oferece) |
| `?fx=ao.gi.ssr.rays.traa.bloom.dof.ink.film` | liga os efeitos de pós um a um (medir custo; `film` é o acabamento do Cinema: mais amostras, grão e aberração); `?fx=` desliga todos |
| `?timescale=0.05` | desacelera o mundo (animações nas capturas por software) |
| `?silhueta` | decorações pretas sobre chão branco: confere se vilas, construções e marcos leem de longe |
| `window.__placeBest()` | coloca a peça atual na melhor posição, com animação |
| `window.__ripple(idade)` | dispara a onda do chão no foco da câmera, já com essa idade em segundos |
| `window.__celebrate()` | anel dourado e bando de pássaros no foco da câmera (efeitos de nova era) |
| `window.__era(era, idade?, zoom?)` | centraliza no Centro da vila e o mostra na era (0 a 3); com `idade`, a onda dourada já com essa idade em segundos |
| `window.__plaza(zoom?)` | mostra os três monumentos na praça do Centro (só a imagem) |
| `window.__mark(zoom?)` | centraliza a câmera no último marco de era erguido |
| `window.__boat(zoom?)` | centraliza a câmera num barco andando (esteiras na água) |
| `window.__fishing(i?, cais?, zoom?)` | centraliza no i-ésimo cardume de peixes; com `cais = true`, no i-ésimo cais de pescador |
| `window.__folk(i?, zoom?)` | centraliza a câmera no i-ésimo aldeão de construção |
| `window.__site(zoom?)` | centraliza no último sítio achado (ou no primeiro escondido) e devolve qual |
| `?specials=all` / `window.__special(i?, zoom?)` | põe as peças especiais na partida sem liberá-las; centraliza na i-ésima colocada e devolve qual |
| `window.__wonder(etapa?, zoom?)` | centraliza no canteiro da maravilha; com `etapa` (0 a 6), mostra a obra nessa etapa |
| `?seed=` `?theme=` `?time=` `?quality=` `?zoom=` `?yaw=` `?pitch=` | ver o `README.md` |
| `window.__stats` | estatísticas do último quadro |
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
  game.ts        Game: semente, pilha, sorteio por peça, descarte, bestMove (IA gulosa), upcoming (mirante)
  blessings.ts   cartas da virada de era: 1 de 2 por era, oferecidas pela semente; a escolha vai no save junto da jogada
  sites.ts       sítios escondidos (ruína, tesouro, relíquia, mirante), da semente por um gerador à parte
  modes.ts       modos: Clássico, Zen, Desafio do dia, Exploradores (regras + desfazer)
  specials.ts    peças especiais (estação, moinho d'água, farol): bordas, pontos e posições na pilha
  rng.ts         mulberry32 e utilitários de sorteio
src/themes/      temas como DADOS
  types.ts       esquema Theme, com cada kit comentado: é a referência de tudo que um tema pode escolher
  themes.ts      6 temas base, THEMES, PERIOD_LABEL/ORDER, themeById
  eras.ts        8 temas históricos (Egito, Song, Vikings, Toscana, Edo, Colonial, Oeste, Andes)
  progress.ts    housesAtEra: as casas do tema em cada era da vila (taipa e palha, o tema, enxaimel e sobrado, flâmulas)
src/render/
  gpu.ts         cria o WebGPURenderer (WebGPU ou WebGL2)
  materials.ts   materiais em TSL: chão, água, kits instanciados (vento, plantações, janelas), pergaminho do vazio (terra incógnita); uniformes U
  noise.ts       texturas de ruído periódicas geradas em código (nuvens, chão, ondulação da água)
  atmosphere.ts  névoa da cena (scene.fogNode): bruma e névoa rasteira por altura, e a névoa de alcance
  groundMap.ts   mapa do chão visto de cima: cor do terreno (luz rebatida) e poças dos lampiões
  clouds.ts      nuvens volumétricas do zoom aberto, marchadas numa laje acima do tabuleiro
  post.ts        pós-processamento por perfil: SSGI ou GTAO, reflexos (SSR), raios de luz, TRAA, bloom,
                 profundidade de campo, vinheta, ombro de tons
  lib.ts         geometria dos kits (casas, árvores, plantações, animais, barcos, veículos, marcos), classe Lib,
                 instGeometry (atributo de cor por instância)
  tileBuilder.ts buildTile: monta UMA peça (chão com leito de rio, água com correnteza, estradas, decoração)
                 a partir de bordas + semente + tema
  world.ts       World: cena, luz, céu e hora do dia, blocos estáticos, pools instanciados, fantasma, animações
                 de queda, sentido da correnteza por peça
  liveTile.ts    LiveTile: peça avulsa (fantasma, queda, pilha)
  fx.ts          partículas em sprites: poeira, fumaça e brilhos (CPU); clima do tema e vaga-lumes (no shader)
  sky.ts         céu procedural para a luz de ambiente (IBL)
  preview.ts     a peça da vez sobre a pilha, com canvas e renderizador próprios
  life.ts        Life: barcos, veículos, animais, aldeões, moinhos, peixes e pássaros que se movem
  cameraRig.ts   câmera orbital: inclinação baixa pela curva do zoom mais o ajuste de quem joga (`tilt`);
                 lente de 40° com `rig.eye` = distância real (`rig.dist` é o enquadramento)
  gpuTier.ts     nível inicial do Auto pelo nome da placa de vídeo (puro)
  dynres.ts      resolução dinâmica do Auto: degraus de resolução antes de descer o nível (puro)
src/video/       foto e vídeo (o modo foto e a exportação ficam em src/ui/capture.ts)
  take.ts        gravação: a pose da câmera a cada quadro e os eventos (jogadas, hora, fantasma), até 2 min
  path.ts        poses reamostradas a 60 quadros por segundo e suavizadas por um filtro gaussiano sem atraso
  film.ts        plano do filme da partida: quando cada peça cai e por onde a câmera passa
  render.ts      desenha o vídeo quadro a quadro, com world.tick(1/60), e entrega ao codificador
  encoder.ts     WebCodecs: escolhe H.264 ou VP9 e guarda os quadros codificados em Blobs
  mp4.ts         cabeçalho MP4 (ftyp, moov, mdat) escrito à mão, sem biblioteca
src/ui/          HUD em HTML/CSS (hud.ts, style.css); eraChoice.ts: nomes e diálogo das cartas da era; banner.ts: cor da casa e brasão (troca o `ui.accent` do tema); tutorial.ts: dicas das primeiras partidas; progress.ts: progresso entre partidas e liberação das peças especiais; capture.ts: modo foto, gravação, filme da partida e exportação (`Capture`, com o estado da tela em `stage`); input.ts: mouse, toque e teclado no tabuleiro (`bindInput`); a página é o index.html
src/audio.ts     sons sintetizados com WebAudio: música, efeitos e ambiente (paisagem perto do foco da câmera, `setAmbience`)
src/main.ts      entrada: fluxo da partida, telas e botões, qualidade, salvamento, parâmetros de URL, ganchos de depuração
tests/logic.ts      simulação de partidas contra oráculos independentes (grupos por BFS, pontuação recalculada, replay)
tests/synthetic.ts  cenários montados à mão (peça travada, descarte, fim de jogo, semente → sequência)
tests/legibility.ts telhados e paredes contra o chão da vila (ΔE em CIELAB, ponderado pelo peso das casas)
tests/video.ts      MP4 conferido por um leitor de caixas próprio, resolução dinâmica, nível por placa, câmera e filme
scripts/         capturas, teste de carga, conversão para página publicável
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
   - o formato é `{ v, seed, rulesId, mode, moves, undone, score, specials }` (v11), guardado em `localStorage` com o prefixo `retalhos.`; cada jogada é `[q, r, giro, ...escolhas]`, com as cartas da era (0 ou 1) escolhidas logo depois dela;
   - o progresso entre partidas (totais, registro por tema e peças especiais liberadas) fica em `retalhos.progress` (`src/ui/progress.ts`), validado campo a campo ao ler;
   - ao carregar, a partida é **reconstruída pelo replay** das jogadas e conferida contra a pontuação.
   - Se você mudar regras, pontuação ou geração de peças de um jeito que altere o replay, **aumente `SAVE_VERSION` em `main.ts`**. Saves antigos mostram um aviso e são descartados.
7. **Os testes têm oráculos independentes.** Ao mudar a pontuação, atualize o oráculo em `tests/logic.ts` reimplementando a regra. Nunca faça o oráculo chamar o código que ele testa.
8. **Tema é só dado.** O renderizador sabe desenhar cada kit; o tema escolhe e colore. Não ponha `if (theme.id === '...')` no render. Crie ou parametrize um kit.
9. **Materiais em TSL (three r186, `three/webgpu` e `three/tsl`):** nada de `onBeforeCompile` nem GLSL; o mesmo nó compila para WebGPU e WebGL2.
   - Importe sempre de `three/webgpu` (não de `three`), para o bundle não levar o WebGLRenderer.
   - Atributos por vértice dos kits: `color`, `tint` (quanto a cor da instância tinge) e `glow` (janelas que acendem com `U.night`). A cor da instância é o atributo `iColor` da geometria criada por `instGeometry()`; não use `mesh.instanceColor`, que o three multiplicaria de novo.
   - Uniformes globais em `U` (`materials.ts`): `time`, `dt`, `wind`, `night`, `clouds`, `sparkle`, `glow`, `water`, `sun`, `sunDir`, `fine`, `bounce`, `lamps`, `eraWave`, `silhouette`.
   - No r186 a instância é aplicada **antes** do `positionNode`: ali `positionLocal` já está no espaço do mundo (pools) e `positionGeometry` é o vértice original. Quem desloca vértices (vento) também ajusta `positionPrevious`, senão o antisserrilhado temporal deixa rastro.
   - A água usa os atributos `wflow` (correnteza) e `wbed` (cor do leito e profundidade da coluna): a malha da água repete os triângulos do leito abaixo da linha d'água, então a beira fica exatamente onde a profundidade zera. A correnteza de cada peça herda das vizinhas (`World.flowAt` + `resolveFlow`) e gira junto com a peça no bloco. A largura do rio em cada borda segue a mesma regra (`World.widthsAt`, `BuildOpts.widths`): a peça nova adota a da vizinha já colocada, e perto da borda o campo da água vira o perfil da própria borda, então a emenda casa. Lago ou rio sai de `waterShape` (semente, gerador à parte).
   - Os materiais iluminados do jogo (kits, chão, água) são `LitMaterial`: gravam a parte da cor que veio do céu, e a oclusão de ambiente do pós só escurece essa parte (o sol direto e as janelas acesas ficam de fora). Um material iluminado novo que não seja `LitMaterial` recebe a oclusão inteira, como o vazio.
   - O `LitMaterial` também soma na luz indireta o que vem do mapa do chão (`groundMap.ts`): a cor do terreno rebatida nas faces viradas para os lados e para baixo (`U.bounce`) e as poças dos lampiões à noite (`U.lamps`). A pilha (`preview.ts`) zera os dois, porque o mapa é do tabuleiro.
   - A névoa é um nó (`scene.fogNode`, `atmosphere.ts`), não `THREE.Fog`: bruma e névoa rasteira com densidade que cai com a altura (integral exata ao longo do raio), mais a névoa de alcance para a cor do fundo. Densidades e cores vêm da hora do dia (`skyFor` em `world.ts`).
   - As nuvens do céu (`clouds.ts`) e a sombra delas no chão (`cloudLight`) leem o mesmo ruído (`cloudField`, `cloudPuff`); a sombra é lida no ponto em que o raio até o sol cruza a camada das nuvens. As nuvens ficam numa cena própria, que o pós compõe antes do TRAA (`buildPost(..., clouds)`): no passe da cena, um transparente não grava profundidade nem normal, e a oclusão e a luz rebatida do chão de baixo vazariam nele.
   - Sem tone mapping do renderizador: o pós-processamento aplica um ombro suave que preserva as paletas dos temas.
   - Se um nó falhar ao compilar, o erro aparece no console das capturas.
10. **Blocos estáticos só crescem** (append-only), e o mapa do chão (`groundMap.ts`) também: cada peça pinta a sua parte quando assenta. Os pools são indexados pela chave do kit. Chaves que **terminam em `~`** são a metade "fina" de plantas e capim (nível de detalhe): entre `rig.dist` 11,5 e 14,5 cada planta dessa metade afunda no chão na sua vez (`U.fine`, material `cropFine`), e mais longe o pool fica escondido. No Ultra e no Cinema a faixa vai 1,35× e 1,6× mais longe. Quem consulta geometria pela chave precisa tirar o `~`.
11. **Construções internas não pontuam.** A roda d'água (vila na beira do rio), a irrigação, a estação e o silo (junto à ferrovia) são só visuais. Pontos de interação vêm apenas de `synergy.ts` × `Rules.synergyPoints`.
12. **Parâmetros de URL e valores salvos são validados** contra listas fixas (ver `pickQ` e o uso de `Object.hasOwn` para `time`). Mantenha esse padrão ao criar um parâmetro novo.
13. **O mundo anda pelo `dt` do `World.tick`.** O vídeo é desenhado depois da gravação, quadro a quadro, cada um com `world.tick(1/60)`, e o modo foto congela o mundo com `world.timeScale = 0`.
    - Animação nova usa o `dt` que o `tick` calcula (já multiplicado por `timeScale`) ou `U.time`. Nunca `performance.now()` nem o `time` embutido do TSL: no vídeo ela saltaria e na foto não pararia.
    - A câmera, o fantasma e a troca de hora seguem o tempo real (`realDt`), para responderem no modo foto com o mundo parado.
    - Efeito de jogada que o vídeo também deve mostrar vai em `World.placeFx`, que o jogo e o vídeo chamam do mesmo jeito.
    - Foto e vídeo copiam o canvas logo depois do `tick`, no mesmo passo do desenho.

## Orçamento de desempenho

Medido com `RUNS=300:high node scripts/stress.mjs`, renderização por software:

| Peças | Qualidade | Draw calls | Triângulos | Instâncias |
|---|---|---|---|---|
| 300 | alta | ~136 | ~1,46 milhão | ~53 mil |
| 300 | ultra | ~248 | ~2,82 milhões | ~69 mil |

Números de 2026-10-02, depois do traço, do pincel, dos aldeões, dos estandartes e da maravilha (a Alta tinha ~94 draw calls na v4 e ~111 no PR #5). No WebGPU por software, a CPU por quadro inclui a espera pelo SwiftShader e não serve de medida.

- **Regra prática:** uma mudança visual não deve subir triângulos ou draw calls em mais de ~10% sem justificativa escrita no commit.
- **Qualidade:** Cinema (placas de topo, fotos e vídeos: desenha 1,5× acima da tela e reduz, SSGI e reflexos com mais amostras, 4 cascatas de sombra, 60% mais vegetação, grão de filme e aberração de lente), Ultra (pensado para GPUs acima da RX 580: sombras em 3 cascatas de 4096, luz indireta SSGI, reflexos na água, raios de luz no entardecer, TRAA, bloom, profundidade de campo, DPR até 2 e 35% mais vegetação), Alta (GTAO em meia resolução, sombra única de 2048), Média (MSAA, sem pós pesado) e Baixa (sem pós e sem sombras). Cada nível tem um teto de pixels desenhados (Cinema 4K × 2,25, Ultra 4K, Alta 1440p, Média e Baixa 1080p; `PIXELS` em `world.ts`): numa tela 4K, descer de nível também reduz a resolução interna. A densidade de decoração é multiplicada por 1,6 (cinema), 1,35 (ultra), 1 (alta), 0,65 (média) ou 0,4 (baixa).
- **Modo automático:** começa pelo nome da placa de vídeo (`gpuTier.ts`: Alta na RX 580, Ultra da RTX 3060 e da RX 6600 para cima, Média no Iris Xe e nos celulares); sem um nome conhecido, começa em Ultra no computador e em Média nas telas de toque. Nunca escolhe o Cinema. Se o quadro passar de ~26 ms, primeiro baixa a resolução interna em degraus de 10% até 60% (`dynres.ts`) e só no último degrau desce de nível.
- **Ainda não foi medido:** o FPS numa GPU de verdade.

## Tarefas comuns

### Novo tema

1. Copie um tema de `src/themes/eras.ts`.
2. Troque `id`, nomes, cores e kits, e a gradação (`grade`: tom das sombras, dos realces e saturação). Os campos estão comentados em `types.ts`.
3. Confira as formas com `?gallery&theme=<id>`.
4. Adicione o tema em `scripts/screenshots.mjs` e gere a captura.

O menu agrupa os temas pelo campo `period` sem nenhuma outra mudança. Os testes já rodam as regras de todos os temas (`THEMES`). Se o tema tiver `rules` próprias, rode `npm test`.

### Novo kit (árvore, casa, telhado, marco, plantação, animal, barco, veículo, estilo de estrada)

1. Acrescente o valor ao tipo de união em `src/themes/types.ts`, com um comentário de uma linha.
2. Desenhe o kit no `switch` correspondente de `src/render/lib.ts`: `treeGeometry`, `roofGeometry`, `landmarkGeometry`, `cropGeometry`, `animalGeometry`, `boatGeometry`, `vehicleGeometry`. Em `BODY` e em `CROP_LAYOUT`, que são `Record`, o compilador já cobra a entrada.
3. Use `kit()` com cores por vértice. Use `tint` só nas partes que devem receber a cor do tema.
4. Mantenha poucos triângulos: veja o orçamento acima.
5. Use o kit em algum tema. Gere a galeria e as capturas.

A lista priorizada de kits que faltam está no fim de `docs/TEMAS.md`.

### Portal e ponte

São opcionais no tema (`gate`, `bridge`) e não pontuam. O `buildTile` decide onde entram sem sorteio: o portal na primeira borda de estrada vizinha de vila, a ponte no meio de um rio de 2 bordas com vila numa margem. Para um tema novo, basta escolher o estilo e as duas cores.

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

## Estado atual e próximos passos

- **Feito (outubro de 2026, depois da v4):** água física (leito visível, cáusticas, esteiras); acabamento (oclusão só na luz indireta, nitidez, cor por hora, sombra firme); luz e céu (amanhecer e hora dourada, névoa por altura, lampiões, luz rebatida do chão, nuvens volumétricas); cinema e vídeo (nível Cinema, Auto pela placa com resolução dinâmica, modo foto, gravação e filme da partida em MP4). Detalhes em `docs/VIABILIDADE.md`.
- **Feito (v4, outubro de 2026):** renderização WebGPU/TSL com GTAO, TRAA, bloom e profundidade de campo; rios escavados com correnteza; céu procedural (IBL); chão com detalhe por terreno; clima por tema; vilas com trilhas; eras da vila, sítios, bônus por tema, desfazer e 4 modos. O andamento do plano de Age of Empires está no topo de `docs/IDEIAS_AOE.md`; faltam a regra das rotas num modo próprio, interface por tema, atmosferas e estações, e monumentos por conquista. O minimapa e a linha do tempo da partida já existem (proposta 16).
- **Feito (v3):** 14 temas, kits detalhados, 4 interações com prévia em dourado, mundo animado, dia/entardecer/noite, qualidade adaptativa, save v3 com replay, duas rodadas de revisão de código com correções. O histórico está em `docs/VIABILIDADE.md`, Apêndice A.
- **Pendente:**
  - medir o FPS numa GPU real (`?stress=1000&quality=high&perf`, ou `window.__perf(5)` com a tecla `F`) no PC e no celular;
  - kits de fidelidade histórica que ainda faltam (`docs/TEMAS.md`, fim): roda-d'água como `MillStyle`, cipreste em alameda, estação de fim de linha por tema;
  - funções de jogo: bandeiras (`docs/VIABILIDADE.md` §12); as peças especiais já existem (`specials.ts`). Desfazer e as 3 próximas peças já existem na v4: as próximas peças aparecem como recompensa do mirante;
  - otimizações com folga conhecida: LOD de árvores distantes, sombra em cache no Ultra e no Cinema, renderizar sob demanda no computador (`docs/VIABILIDADE.md` §5). O corte por super-bloco de 32×32 e a sombra única a 4 Hz já existem.
- **Publicação:** o build de página única (`scripts/artifact.mjs`) é o que vai para o link público do protótipo.
