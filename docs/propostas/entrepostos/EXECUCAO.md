# Avaliação da branch `jogo-entrepostos` (Retalhos Entrepostos 0.5 Encostas)

Cabeça `75f92e0`, base `d22626c`, main `9c5c4c2`. Nada foi commitado nem alterado na branch (o `npm ci` e o build só geraram `node_modules`, `.cache` e `dist` nas worktrees do scratchpad). Todas as capturas: 1200×720, `quality=high`, `timescale=0.05`, `&webgl`, SwiftShader.

Pasta: `/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/entrepostos/` (worktrees `branch/`, `base/`, `main/`; scripts próprios `shot.mjs`, `play.mjs`, `play3.mjs`, `stress.mjs`, `stats.mjs`, `prancha.py`).

## 1. Verificação

| Passo | Resultado | Tempo |
|---|---|---|
| `npm ci` (lockfile próprio) | ok, sem erro | 4 s |
| typecheck | ok | 1 s |
| `npm test` (600 partidas, sintético, legibilidade, vídeo) | ok | 50 s |
| `npm run cartas` | ok: 100 sementes por carta resolvidas (confluência, forquilha, enseada) | 2 s |
| `npm run desenvolvimento` | ok | <1 s |
| `npm run encostas` | ok (cota dos triângulos, emendas rio/terra sob giro, circulação) | 1 s |
| `npm run build` | ok, `dist/index.html` 1,44 MB (main: 1,56 MB; base: 1,38 MB) | 1 s |
| `npm run smoke` | webgl: ok (13 peças, 35 draw calls). webgpu: falha só de ambiente (`Instance dropped in popErrorScope`, perda de dispositivo do SwiftShader/Vulkan) | 20 s |
| `npm run teclado` | falhou no webgpu pelo mesmo erro de ambiente; uma cópia forçando `&webgl` estourou 550 s em Alta por software e foi abortada (sem veredito) | 27 s / 550 s |
| `node scripts/qa-crista.mjs` | não concluiu: os casos webgpu perdem o dispositivo e o script passou de 300 s (o caso WebGL2 inicial rodou e não deu erro) | 300 s (timeout) |

Conclusão: tudo que é lógica, replay, geometria do relevo e build passa. O caminho WebGPU não pôde ser verificado aqui. Os dois scripts de QA de navegador (`teclado`, `qa-crista`) não têm veredito nesta máquina. O único aviso de console visto nas capturas WebGL foi `THREE.AttributeNode: Vertex attribute "position" not found on geometry` (2 vezes por página, só nas cenas com a Crista; não vi na main nas capturas que fiz, mas não o testei de propósito).

## 2. Capturas comentadas (`shots/`, `play/`, `play3/`)

- `01-abertura.png`: primeira partida, Aldeia na crista, Costa dos Terraços. Lê muito bem: a encosta de patamares com muro de arrimo, casas terracota, ciprestes e torre é a imagem mais forte da edição, bem acima do Clássico. Os cais (Feira com toldo listrado, Serraria com toras) leem de longe e a linha tracejada aponta o caminho. Ressalvas: o cartão da carta (inferior esquerdo) cobre a Serraria; o grid hexagonal do pergaminho fica muito evidente no vazio ao redor (ajuda a achar casas, mas é ruído e deixa o entorno "vazio").
- `02-crista42.png`: idêntica à abertura (a semente 42 é a padrão da Crista), como pretendido.
- Guia de três jogadas (`play3/`; moves (1,0,0), (−1,1,giro dir.), (−1,0,giro esq.)): bate com o README e com o `docs/ENCOSTAS.md`. Prévia 1: "Encosta · patamar 2 · Belvedere 1 → 2 · Campanário 2 → 3", com rótulos flutuando sobre os lotes. Prévia 3: "Colina · patamar 1 · Vinhedo · patamar 1", com o rótulo "Vinhedo · patamar 1" no lugar. A mudança de altura do vinhedo é visível (terraço sobe e encosta atravessa a divisa). O fantasma, a margem elevada e o realce branco da borda leem bem; o texto da prévia é denso (o cartão repete o que o rótulo já diz).
- Cartas (`03/04/05`): Confluência, Rio bifurcado e Cais da enseada abrem com uma só peça com vila no centro, três cais com número, nome e cor, tracejado indicando direção. Muito legível e barato, mas visualmente mais pobre que a Crista: peça solitária num mar de hexágonos cor de pergaminho; na enseada o Estaleiro fica quase sob a barra de dicas.
- `06-avancada20.png` (auto=20, 660 pts, Era II): rio e terra em mosaico, muito bonito, cais com rota; o brilho dourado nas bordas da vila marca o encaixe. Já poluído: rótulos de missão, cartão da carta, barra de dicas e botões ocupam as quatro bordas.
- `07-zen60.png` (Zen, Paisagem viva, 2.790 pts, Era III): cidade densa com casas que crescem, matas e várzea; a "Paisagem viva" funciona e é a cena mais rica. Mas as 4 missões em cartões grandes a esquerda e os estandartes poluem (a main resolveu isso com "N missões ›"). Clareira e nuvens ok.
- `08-encosta-perto.png` (zoom 6): casas de fachada clara e telhado terracota apoiadas nos patamares, muro de arrimo legível. Defeito: as encostas entre os patamares são facetadas em "estilhaços" de rocha cinza, bem angulosos, que lembram ruído de malha; ficam estranhos quando a câmera chega perto.
- `09-noite.png`: janelas acendem e o tom azulado lê bem; o grid hexagonal do vazio fica muito contrastado (linhas claras sobre cinza), o que sobra mais do que a paisagem.

## 3. Branch × main (`cmp/`, `pranchas/prancha-3-branch-x-main.png`)

Clássico, seed 7, auto=40, Holanda, Alta, WebGL: o tabuleiro e a pontuação são idênticos (1.445), então o núcleo de regras preservou o Clássico. A diferença é a apresentação: a main tem mar com espuma, clima, estações, botões "Clima", "Onde encaixa" e "Aa", cartão único de missões e minimapa; a branch tem entorno de pergaminho, quatro cartões de missão abertos, casas mais escuras e sem Verão/estações. Ou seja, a branch é a versão antiga do Clássico com o miolo de Entrepostos por cima.

## 4. Desempenho (`RUNS=300:high` em cópia do `stress.mjs`, WebGL, Holanda, seed 42, 301 peças)

| Build | Draw calls | Triângulos | Instâncias | Montagem (ms) | Lógica (ms) | CPU JS/quadro (ms) |
|---|---|---|---|---|---|---|
| base `d22626c` | 136 | 1,510 mil | 72.262 | 667 | 79 | 35,7 |
| main | 115 | 1,134 mil | 80.461 | 920 | 111 | 24,0 |
| branch (Clássico, Holanda) | 129 | 1,294 mil | 70.969 | 952 | 96 | 35,9 |
| branch (Clássico, Riviera) | 132 | 1,310 mil | 42.834 | 889 | 119 | 21,2 |

A CPU por quadro é muito ruidosa em software (varia 18 a 36 ms entre rodadas da mesma build), não vale. A branch fica +12% em draw calls e +14% em triângulos sobre a main; é melhor que a base nos triângulos (-14%), mas a main já cortou 25% sobre a base.

`?stress` com `mode=entrepostos` explícito não termina (o `__load` nunca aparece; falha por timeout de 120 s): o teste de carga da branch só mede o Clássico. O custo de Entrepostos foi medido com `auto=` (24 peças no estado, Alta):

| Cena | Peças | Draw calls | Triângulos | Instâncias |
|---|---|---|---|---|
| Entrepostos Crista (auto=20) | 24 | 174 | 169.573 | 2.537 |
| Entrepostos Confluência (auto=20) | 21 | 135 | 131.934 | 2.506 |
| Clássico Riviera (auto=20) | 21 | 86 | 87.846 | 2.096 |
| Clássico Holanda (auto=24) | 25 | 81 | 106.447 | 4.505 |
| base, Clássico Holanda (auto=24) | 25 | 91 | 128.981 | 4.608 |
| Zen Riviera, Paisagem viva (auto=60) | 61 | 298 | 537.655 | 11.774 |
| Clássico Holanda (auto=60) | 61 | 97 | 274.543 | 14.917 |
| base, Clássico Holanda (auto=60) | 61 | 107 | 330.486 | 15.209 |

Achado: o modo Entrepostos/Paisagem viva dobra os draw calls e sobe 60 a 100% dos triângulos com a mesma contagem de peças (Zen 61 peças: 3× os draw calls do Clássico, 2× os triângulos). O `docs/ENCOSTAS.md` da branch admite +12,2% de triângulos a 64 peças só pelo relevo; o custo total do modo é bem maior que isso e ultrapassa a regra dos ~10% do projeto.

## 5. Partida jogada por script (Playwright, `?debug`, `__projectTile`, mouse + R)

- Confluência (roteiro de `tests/voyage.ts`, semente 42): 3 peças, duas jogadas de canal, primeira entrega (Feira) na jogada 2, 20 pontos, "✓ Entregue". A prévia diz "Este canal prolonga o rio da vila." e depois "Feira +4 peças de suprimento." antes do clique: informativa e correta. A rota tracejada e a ligação leem bem. Nenhum erro de console, o save grava, 5 desfazeres disponíveis.
- Crista (mesmo método): primeira entrega também na jogada 2, 49 pontos, sem erro de console. A seção de guia (3 jogadas) confirmou o texto do README.
- Pequenos desvios de UX: o placar "RECORDE" acompanha a pontuação durante a partida, mostrando valores maiores que o placar (50 com 27 pontos; 70 com 50) numa partida limpa, ou seja, é uma projeção, não um recorde, e confunde; a barca quase não aparece com `timescale=0.05`, então não pude conferir a animação da entrega.

## 6. Erros e riscos encontrados

1. `npm run teclado` e `qa-crista.mjs` não rodam aqui (WebGPU por software); em WebGL o teclado passa dos 550 s. Sem veredito de navegador desses roteiros.
2. `?stress=` com `mode=entrepostos` explícito nunca conclui: o tester de carga não cobre o modo novo.
3. Custo de renderização do modo novo acima do orçamento (seção 4).
4. Aviso de console `Vertex attribute "position" not found on geometry` (2×) nas cenas com a Crista.
5. Facetas de rocha estilhaçadas nas encostas de perto; grid do pergaminho muito marcado, sobretudo à noite.
6. "RECORDE" mostra uma projeção em vez de um valor guardado.
7. A branch não tem histórico em comum com a `main` e perdeu a versão atual do Clássico (mar, clima, estações, minimapa, "Onde encaixa", interface calma, árvores leves de longe): trazê-la inteira seria regressão.
8. Uso de `Math.random`/estado de save: não verifiquei; o save v12 tem prefixo próprio (`entrepostos.encostas.`), então não conversa com os saves `retalhos.*`.

## 7. Opinião: o que vale aproveitar

- Vale levar: a ideia do jogo de Entrepostos (cais com carga, rota de água, replay determinístico, `core/ports.ts`, cartas com seeds testadas em 100 sementes por `npm run cartas`) e a Aldeia na crista como cena de abertura, com o relevo em patamares (`core/ridge.ts`, `development`, `docs/ENCOSTAS.md`). Está bem coberto de testes e o resultado visual da Crista é o melhor da edição.
- Levar como módulo novo sobre a `main` atual (um modo, não uma base), reaproveitando as regras puras e a geometria do relevo, e reconciliando com `Theme.relief`/cachoeiras que a main já tem.
- Não levar: a base de render e a interface antiga (perderia mar, clima, estações, interface calma e o corte de triângulos), nem a Paisagem viva sem medir e reduzir o custo (3× draw calls). Antes de qualquer integração: consertar o `stress` para o modo, medir o custo em GPU de verdade e rodar o QA de navegador num ambiente com WebGPU.

Pranchas: `pranchas/prancha-1-abertura-e-guia.png`, `prancha-2-cartas.png`, `prancha-3-branch-x-main.png`, `prancha-4-estados.png`.
