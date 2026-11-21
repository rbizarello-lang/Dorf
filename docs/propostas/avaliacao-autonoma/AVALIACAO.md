# Avaliação autônoma do Retalhos (D48)

Base: `origin/main` em 21/11/2026, build local servido na porta 4310, sempre com `?webgl` (SwiftShader, Chromium headless, 1440×860 e 800×600). Cada captura usa semente fixa e `timescale=0.001`. A renderização é por software: o FPS não vale, e o que dependia de brilho ou transparência foi tratado com cautela.

Cobertura real: 5 temas de dia e à noite (Egito, Holanda, Oriental, Brasil e Inverno), 8 modos com `auto=40`, janela estreita, menu de modos, ajuda, fim de partida (`__over` e fim real da Partida rápida), fantasma, queda, rio, costa, parede de casas, Paisagem viva, silhueta, chuva, qualidades Média e Alta com `?debug`, e o stress. **Não cobri** (tempo e custo do software): Almanaque e Aa abertos, cartas da era, transição de era e de estação, cachoeiras do Relevo de perto, pontes (`__bridge` devolveu `null` na semente usada), barcas e cais de perto, `?gallery`.

## 1. Resumo

- Visual geral muito bom: vales legíveis, vilas com personalidade por tema, água e costa convincentes, noite com janelas acesas.
- Nenhum erro ou aviso de console em todas as URLs testadas (fora os filtrados de fontes/rede do proxy).
- A noite perde o contorno das casas vazias, e no Egito o fundo de areia engole o tabuleiro.
- Tela de fim de partida com texto errado ou inútil (recorde 0, "1 missões", "0 de 0 sítios" em modo sem sítios).
- As casas vazias (lajes translúcidas) cobrem as paredes das peças vizinhas e deixam as laterais com cara de vidro cinza.

## 2. P1 — falhas

Nenhuma encontrada. Sem erro de console, sem travamento, sem peça que sumisse. (Limite: só em WebGL2 por software; WebGPU não foi testado.)

## 3. P2 — defeitos visuais e de texto

**P2.1 Fim de partida diz "Recorde: 0 pontos (semente 0)" logo abaixo de "Novo recorde!".**
Onde: `?webgl&mode=rapida&seed=7&auto=30` (a tela abre sozinha ao fim) e `window.__over()`. Imagem: `01-fim-recorde-zero.jpg`. Código: `src/main.ts`, `showGameOver` (linha com "Recorde em ${mode.name}") lê `best`/`bestSeed`. O placar do HUD mostra o recorde certo (1.035). Ressalva: aconteceu com `?auto`, que não grava o recorde (`special` em main.ts ~346); não confirmei jogando de verdade.

**P2.2 Textos do fim de partida que não servem ao modo.**
"1 MISSÕES" (plural fixo) e, na Partida rápida, "0 MISSÕES" e "0 de 0 sítios" mesmo sem missões nem sítios. Imagem: `01-fim-recorde-zero.jpg`. Código: `src/main.ts` `showGameOver` (`<span>missões</span>` e "Era …, N de M sítios"). Esconder o que o modo não tem e flexionar o plural.

**P2.3 Casas vazias (lajes translúcidas) cortam as paredes das peças e as deixam lavadas.**
Onde: `?webgl&theme=brasil&seed=4&auto=40&time=day` + `__coast(2,5)`; também `theme=egito` + `__fauna(0,4)` e `theme=holanda` + `__deco('wall:',5,5)`. Imagens: `04-brasil-costa-perto.jpg`, `05-egito-fauna-casa-vazia.jpg`, `06-holanda-parede.jpg`. A laje cinza/bege da casa vazia aparece por cima ou na frente da face lateral da peça, que fica pálida e translúcida (parece vidro). Pode ser intencional (camada de aviso), mas de perto lê como erro. Código provável: `src/render/world.ts` (`slotMat`, ~linha 865) e `slotBlob`/`slotAlpha` em `src/render/materials.ts`. Sem certeza se é profundidade, ordem de desenho ou altura da laje.

**P2.4 Paredão liso cinza sob a faixa marrom da peça.**
Onde: `theme=egito&seed=4&auto=30` + `__river(5)`; também no Oriental (`__deco('wall:',8,5)`). Imagens: `07-egito-rio-paredao.jpg`, `16-oriental-perto.jpg`. A lateral tem uma faixa fina de estrato e abaixo um bloco cinza chapado, sem textura nem sombra de contato. Parece a mesma laje do P2.3 ou a parede padrão do Clássico. Código: `src/render/tileBuilder.ts` (parede/estratos) e `materials.ts` (chão). Não tenho certeza da causa.

**P2.5 À noite as casas vazias somem.**
Onde: `?webgl&theme=holanda&seed=4&auto=40&time=night`, `theme=egito` e `theme=inverno` à noite. Imagens: `03-holanda-noite.jpg`, `02-egito-noite.jpg`. Quase não se vê onde dá para jogar; no Egito o mar de areia fica marrom chapado com sombra vertical escura sob as peças. Código: `slotBlob`/`slotAlpha` em `src/render/materials.ts`, `skyFor` em `world.ts`.

**P2.6 Peça no fim do pouso mostra lâmina branca (fantasma).**
`11-queda.jpg` (`__ghostBest(8)`, `__placeGhost()`, `__drop(0.05)`): a peça em queda flutua sobre a casa com dois traços brancos grossos e um "V" branco que parecem o contorno do encaixe; funciona, mas o traço é pesado frente ao resto. Só estética.

**P2.7 Em `?debug` o painel cobre o cartão de pontos** (`08-alta-debug.jpg`, `?quality=high&debug`). Só diagnóstico; baixo valor.

## 4. P3 — melhorias (em ordem de valor por esforço)

1. **Realçar as casas vazias à noite** (mais contraste ou um traço leve): P2.5. Esforço baixo. `src/render/materials.ts`.
2. **Fim de partida contextual:** esconder sítios, missões e recorde sem sentido; corrigir plural. Esforço baixo. `src/main.ts`.
3. **Paredes laterais com estrato e sombra de contato** onde a peça encosta no mar/areia (P2.4). `tileBuilder.ts`.
4. **Fantasma/queda:** afinar o contorno branco (P2.6). `src/render/world.ts`.
5. **Casas da Paisagem viva em Zen com viva=1 (estágio 3)** ficam muito altas e estreitas, com repetição de empenas (`?mode=zen&viva=1`, `m-zen`/barn). Variar largura ou altura. `src/render/livingBuild.ts`.
6. **Silhueta (`?silhueta`, Brasil, `09-silhueta-brasil.jpg`):** as vilas leem bem, mas as palmeiras e coqueiros viram traços finos que se perdem de longe; reforçar o volume do topo. `src/render/kits/brasil.ts`.
7. **Terra contínua (`12-terra.jpg`):** o monte de peças em pilha no canto inferior direito cobre a borda da ilha; empurrar o enquadramento inicial para a esquerda quando o mapa cresce. `src/render/cameraRig.ts`.
8. **Janela estreita 800×600 (`15-janela-estreita.jpg`):** barra em duas linhas, tudo cabe, sem corte. Melhoria: encolher o nome do tema para ganhar uma linha.
9. **Menu de modos (`14-menu-modos.jpg`):** limpo; atrás dele os botões do topo aparecem pela borda do diálogo; escurecer mais o fundo.
10. **Entrepostos (`13-entrepostos.jpg`):** o contador de peças mostra um ícone vermelho no lugar do número no fim da pilha; confirmar se é "0" intencional.

## 5. Números

Stress (`RUNS=300:high,300:ultra`, WebGL2, 1280×800, software):

| Peças | Qualidade | Lógica (ms) | Montagem (ms) | Draw calls | Triângulos | Instâncias | CPU JS/quadro | Heap |
|---|---|---|---|---|---|---|---|---|
| 301 | ultra | 105 | 1988 | 117 | 1419 mil | 95064 | 15,2 ms | 204 MB |
| 301 | alta | 117 | 1481 | 117 | 1255 mil | 72425 | 14,8 ms | 237 MB |

O AGENTS.md cita ~136 calls e 1,46 milhão na Alta; ficou abaixo (WebGL2, sem os passes de sombra contados). Ultra com as mesmas 117 calls não confirma o orçamento de ~248: provável que o software contabilize diferente; sem certeza.

`?debug` com 41 peças, Oriental, semente 4: Alta = 86 draw calls, 166 mil triângulos, 2.846 instâncias, 4 blocos. Média = 65 calls, 160 mil tris. Baixa (padrão no software) = 57 a 66 calls, 119 a 171 mil tris conforme o tema. Relevo na Alta (Inverno) = 83 calls, 157 mil.

Console: 0 erros e 0 avisos em cerca de 40 URLs (todas listadas acima, WebGL2).

## 6. Imagens

`01` a `16` `.jpg` nesta pasta, cada uma com até 190 KB.
