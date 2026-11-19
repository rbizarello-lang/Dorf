# Verificação jogável da edição 0.3

A compilação publicada em `dist/index.html` foi comparada byte a byte por SHA-256 com o arquivo usado nos ensaios finais de viagem, enquadramento móvel e fumaça. O hash é `1FBF41C1FE9EB86A80BA340401F594F4763B1DD172D6DCA5031975DCD1AFDD90`. Os roteiros usaram Chrome no Windows, via Playwright, com a GPU identificada pelo jogo como GeForce RTX 3060.

| Ensaio | Resultado |
|---|---|
| Fumaça | 13 peças em WebGPU e em WebGL2, 35 draw calls em ambos, sem erro do navegador capturado. O roteiro abriu o HTML pelo protocolo `file:`; a política de rede deste ambiente bloqueou o HTTP local. |
| Viagens e toque | Entrega direta e Madeira para a Feira concluídas por mouse e teclado, com 14 jogadas e 715 pontos em cada roteiro. Foi possível recarregar, desfazer, continuar e rever a travessia. No WebGL2 por toque emulado, os roteiros giraram e colocaram a peça, localizaram a Feira e voltaram à vista geral. Nas duas condições, as três etiquetas permaneceram livres do HUD em 390 × 844, no giro para 667 × 375, ao retornar ao retrato, após **Ver mapa** e ao iniciar diretamente em paisagem. |
| Teclado e foco | Confluência, Rio bifurcado e Cais da enseada concluídos em 14, 14 e 11 jogadas. O roteiro completou também uma Confluência continuada da v11 em 14 jogadas. Verificou rotação e encaixe inválido, anúncios na árvore de acessibilidade, Tab e Shift+Tab no diálogo com fundo inerte, foco de retorno, guia, foco de cais, desfazer e placar final. Alterar de Alta para Média durante a travessia manteve a contagem de barcas. |
| Migração | v10 com entrega direta e v11 com contrato de madeira retomaram a pontuação, recarregaram e desfizeram uma jogada. Os recordes Direto, Madeira e Madeira legado ficaram separados. Dados antigos permaneceram byte a byte iguais, inclusive com um save v12 corrompido. |
| Ajuda, Zen e mídia | Escape fechou a ajuda e devolveu o foco. Nova → Zen permitiu colocar uma peça e retomar. O modo foto baixou um PNG de 960 × 600. A gravação gerou um MP4 de 36.365 bytes com 144 linhas e 1,083 s. O Chrome decodificou um quadro do arquivo. |
| Temas e luz | Foram abertas 12 combinações com a mesma viagem de nove peças, em qualidade Alta. Costa dos Terraços, Vale Pastel e Egito do Nilo foram desenhados de dia e à noite em WebGPU e WebGL2. A inspeção visual encontrou os três cais, a água contínua e o estado das entregas. As fachadas e copas da Costa dos Terraços têm menos contraste à noite. |

O roteiro de teclado rodou com a compilação `CF813232…`. Migração, mídia e a grade de 12 cenas rodaram em `1C25A37F…`. Depois desses ensaios, a última revisão mudou o encaixe da carta e o enquadramento dos cais em telas baixas. A revisão foi conferida na compilação publicada, com os ensaios específicos de viagem e fumaça.

## Uma jogada, duas capturas

As duas fotos usam Costa dos Terraços, Confluência, semente 42, dia, zoom 9,5 e a mesma câmera. A primeira mostra o canal construído pela jogada anterior. A segunda foi feita após a chegada da nova peça no cais. A calha da peça intermediária já assentada se alarga, o cultivo ao longo da margem direita cresce e a água passa pelo encaixe até a Feira. O contorno luminoso identifica a peça existente que mudou. [Antes de ligar a Feira](screens/0.3-riviera-jogada-antes.png) · [Depois de ligar a Feira](screens/0.3-riviera-jogada-depois.png)

A vista geral registra o mesmo tema em noite de jogo, com a Feira e a Serraria abastecidas e o Estaleiro em aberto. [Costa dos Terraços à noite](screens/0.3-riviera-noite.png)

## Uma medição de cena

No HTML `1C25A37F…`, o ensaio usou uma cena Zen determinística de 37 peças, Costa dos Terraços, semente 42, zoom 10, Alta, 1280 × 800 e WebGPU. Foram observados 60 intervalos de `requestAnimationFrame` depois de 20 quadros de aquecimento por condição.

| Paisagem viva | p50 | p95 | Draw calls no último quadro | Triângulos no último quadro |
|---|---:|---:|---:|---:|
| Desligada | 16,7 ms | 17,0 ms | 104 | 229.681 |
| Ligada | 16,7 ms | 16,8 ms | 190 | 252.092 |

A cadência indicada pelos callbacks ficou em torno de 60 Hz, com aumento de 86 chamadas e 22.411 triângulos. O ensaio cobre uma cena já montada e uma GPU. Os resultados de toque são de emulação. O custo de assentar uma jogada sob carga, o FPS em celular físico e os anúncios ouvidos em leitor de tela seguem sem medição.

## Reprodução

Depois de `npm run check`, use `npm run teclado`, `npm run viagem` e repita a viagem com `FRETE=madeira`. Os roteiros `node scripts/saves.mjs`, `node scripts/qa-midia.mjs`, `node scripts/visual-vivo.mjs` e `node scripts/foto-evolucao.mjs` usam o HTML compilado. `QA_HTML` seleciona outro arquivo nas viagens e fotos de evolução e também permite que `npm run smoke` abra o arquivo diretamente. As capturas dos roteiros ficam em `.cache/capturas`.
