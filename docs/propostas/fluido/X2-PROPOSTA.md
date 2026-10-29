# Encaixe fluido: menos hexágono, mais paisagem

Pedido do Roger: "um encaixe mais fluido e dinâmico, menos apegado à ideia do hexágono".
No print dele o relevo já esconde parte do hexágono, mas três coisas ainda gritam "hexágono":
1. a costa e o penhasco, que seguem seis retas e seis cantos;
2. os tracejados laranja das casas vazias, hexágonos desenhados em cima do mar;
3. as peças inteiras, que são do mesmo tamanho e da mesma forma.

Regra que guia tudo: o que vier tem de nascer da paisagem e ser calmo. Nada de camada abstrata (a Colcha foi rejeitada).
Os caminhos vão do mais visual ao mais radical.

## (a) Hexágono escondido (só visual, a lógica não muda)
- **Joga/sente:** igual a hoje. A costa vira uma linha ondulada, os cantos se arredondam, as casas vazias viram manchas e não hexágonos. A peça parece um retalho de pano.
- **`src/core`:** nada. Sem save novo, sem oráculo novo.
- **Render/clique:** um deslocamento do chão no plano, função só da posição no mundo (soma de ondas). Duas peças vizinhas leem a mesma função, então a emenda continua fechada. O clique desfaz o deslocamento antes de achar a casa (`pickHex`).
- **Relevo e água:** combina. O relevo já é contínuo por cima das emendas; o rio cruza a borda no mesmo ponto e se desloca junto. A espuma e a areia do mar precisam acompanhar a costa nova.
- **Riscos:** legibilidade (a casa vazia precisa continuar clara); decoração que flutua perto da borda (é deslocada junto); custo quase zero (a conta é feita uma vez, ao assentar a peça).
- **Tamanho: P a M.** Dá para fazer agora, e é desligável.

## (b) Grade irregular estilo Townscaper
- **Joga/sente:** as casas viram quadriláteros de tamanhos variados, sem forma repetida. Cidade que cresceu sozinha, muito bonita, mas é outro jogo.
- **`src/core`:** a vizinhança deixa de ter 6 lados. `hex.ts`, `board`, `tiles` (bordas e giro), `synergy`, `routes`, sítios, save e todos os oráculos são reescritos.
- **Render/clique:** malha própria no lugar do hexágono em `buildTile`, `terrain.ts`, mapa do chão e mar. `pickHex` vira busca por polígono.
- **Relevo e água:** o perfil de 6 setores não serve mais; a emenda do rio muda de lugar.
- **Riscos:** alto em tudo (legibilidade das bordas, pilha, desempenho dos blocos de 8×8, perda dos kits dos 5 temas). Muda o giro, que é a mecânica central.
- **Tamanho: GG.**

## (c) Células de Voronoi
- **Joga/sente:** cada peça é uma célula de 4 a 8 lados, vizinha por lado compartilhado. Mapa de mosaico de campos.
- **`src/core`:** o grafo de vizinhança vem da semente; cada peça tem número de bordas variável. Reescrita de `tiles`, `board`, geração da pilha, giro e oráculos.
- **Render/clique:** mesma dificuldade do (b), com o agravante de que a célula muda de forma quando o vizinho chega.
- **Relevo e água:** só funciona com a água na aresta. Dá certo no papel, mas pede tudo de novo.
- **Riscos:** alto. Girar uma peça de 5 lados num buraco de 6 não tem resposta limpa, e a pilha trava mais.
- **Tamanho: GG.**

## (d) Peças de formas variadas (1, 2 ou 3 casas, "L")
- **Joga/sente:** peças maiores e quebra-cabeça de verdade: encaixar o "L" num golfo. Mais pensamento, menos calma.
- **`src/core`:** a peça vira um conjunto de casas com bordas externas. `Board.place`, `check`, `frontier`, pontuação, `bestMove`, desfazer e save mudam; o oráculo é reescrito. A grade continua hexagonal por baixo.
- **Render/clique:** o fantasma vira um grupo; `pickHex` acha a casa-âncora. A emenda entre as duas casas da mesma peça não pode mostrar costura.
- **Relevo e água:** funciona (a peça dupla tem relevo e rio contínuos); o R5 já guarda a altura por peça.
- **Riscos:** a pilha trava mais (peça grande sem encaixe), custo da IA, e ainda parece hexágono, só que maior. A proposta 12 ("Retalhos de dois") já mapeou isso.
- **Tamanho: G.**

## (e) Pintura livre (Roger: pincel de terreno em qualquer ponto)
- **Joga/sente:** muito fluido e muito perto da Colcha: vira "mexer numa camada". Deixo como referência; o (h) abaixo faz o mesmo desejo sem perder o puzzle.
- **`src/core`:** adeus à grade; pontuação lê manchas; determinismo e oráculo difíceis de provar. **Render/clique:** chão por campo de distância, quase nada do `tileBuilder` se reaproveita. **Riscos:** o maior em legibilidade ("onde encaixa?"), desempenho e calma. **Tamanho: GG.**

## (f) Fluxo (a água e a estrada decidem)
- **Joga/sente:** o encaixe é o caminho que atravessa a peça; as bordas de terreno viram transição. Jogar é "conduzir o rio até o mar". Combina com "Águas que descem", que o Roger já aprovou.
- **`src/core`:** `Rules.springs` e o modo Relevo já têm nascente e mar. Falta a regra: a borda de terreno comum deixa de ser exigida e só rio e trilho (estritos) contam. Mexe em `board.check`, pontuação e oráculo. Vai como modo novo, sem `SAVE_VERSION` novo para os outros.
- **Render/clique:** quase igual a hoje; muda a mensagem do fantasma (mostrar o caminho, não a borda). `pickHex` igual.
- **Relevo e água:** é o caminho que mais usa os dois: a água só desce, e o relevo decide para onde.
- **Riscos:** rio sem saída trava a pilha (precisa de descarte e de peça-coringa); equilíbrio de pontos (medir com `npm run balance`). O hexágono continua visível: muda a regra, não a cara.
- **Tamanho: M a G.**

## (g) Recortes: quebra-cabeça de contorno livre (ideia nova, abandona a grade)
- **Joga/sente:** cada peça é um retalho de terra com contorno próprio (pontas, enseadas, península), como uma peça de quebra-cabeça de paisagem. Você gira e arrasta; perto de uma costa compatível ela "puxa" e encaixa. Vale o que encosta: comprimento de costa com o mesmo terreno. Sensação de puxar pedaços de mapa e fechar um golfo.
- **`src/core`:** posição contínua mas discretizada: a cada jogada o jogo lista as poses possíveis (cada ponta da peça contra cada ponta livre, com giro em 12 passos), testa sobreposição por polígonos e pontua pelo comprimento de contato. Isso mantém o replay determinístico (a jogada é "índice da pose"). Reescreve `hex.ts`, `board`, `game.bestMove`, `tiles`, `synergy`, `routes`, sítios, save e oráculos.
- **Render/clique:** o chão vira polígono arbitrário (o `terrain.ts` e a emenda por perfil de borda precisam de outra definição de "borda compartilhada"); o clique é um arrasto com ímã, não uma casa.
- **Relevo e água:** o rio atravessa a costa em pontos marcados (como hoje, no meio da borda), e o relevo é contínuo se o ruído do mundo continuar sendo a base.
- **Riscos:** a pilha trava (nenhuma pose serve) mais que hoje, mas o descarte e as muitas poses amenizam; legibilidade de "onde cabe" pede fantasma muito bom; custo alto do teste de polígonos no `bestMove`.
- **Tamanho: GG.** É o destino mais fiel ao que o Roger pediu se ele quiser largar a grade e manter o puzzle.

## (h) Sementes: o jogador planta os pontos, o mapa vira Voronoi (ideia nova, abandona a grade)
- **Joga/sente:** em vez de uma peça hexagonal, você recebe uma semente de terreno (prado, mata, rio, vila) e a planta num ponto livre, a certa distância do que existe. O mapa é a divisão de Voronoi das sementes, com contorno suavizado: as células nascem e crescem da sua escolha, nenhuma é igual. Pontos por manchas contíguas do mesmo terreno e por fronteiras que combinam (as interações de hoje). Cada semente pode vir com uma direção, que alonga a célula (lembra o giro).
- **`src/core`:** conjunto de pontos com regra de distância mínima e máxima; vizinhança vem da triangulação de Delaunay (determinística, em ponto fixo para não variar entre máquinas); pontuação por grupos conectados no grafo. `Board` e `hex.ts` viram um grafo. Oráculo novo, mais simples que o atual.
- **Render/clique:** as células mudam de forma quando um vizinho chega (o chão de uma peça já posta é recalculado, ao contrário de hoje, que só acrescenta): quebra a invariante 10 dos blocos que só crescem. O clique é um ponto no chão. Rio vira uma linha entre sementes de água.
- **Relevo e água:** o relevo é a distância à semente mais perto (colinas por célula), a água escorre pelo grafo.
- **Riscos:** sem giro e sem casa, perde o encaixe de borda (o coração do gênero); o jogador pode fazer um mapa feio; recalcular chão a cada jogada pesa nos blocos de 8×8.
- **Tamanho: GG.**

## Quadro comparativo
| | Some a grade? | Muda o núcleo? | Risco de travar | Mantém giro e encaixe? | Tamanho |
|---|---|---|---|---|---|
| (a) escondido | só na cara | não | nenhum | sim | P a M |
| (b) Townscaper | sim | tudo | alto | sim | GG |
| (c) Voronoi fixo | sim | tudo | alto | pouco | GG |
| (d) formas | pouco | muito | médio | sim | G |
| (e) pintura | sim | tudo | alto | não | GG |
| (f) fluxo | não | pouco | médio | sim | M a G |
| (g) recortes | sim | tudo | médio | sim | GG |
| (h) sementes | sim | tudo | baixo | não | GG |

## Recomendação franca
Peso cada caminho pelo que o Roger pediu (fluido, menos preso ao hexágono), sem dar bônus a quem mantém a grade.
- **O destino que mais acerta é o (g) Recortes.** Só ele sai da grade e mantém o que o jogo tem de melhor: girar a peça e casar a costa. (h) é mais fluido, mas troca o puzzle por um editor de mapa; (e) idem; (b) e (c) são grades irregulares que o jogador não sente como diferença de jogo.
- **Mas o (g) é GG** e reescreve o núcleo, o clique, o terreno e todos os oráculos. Pelo que sei, não cabe num protótipo jogável honesto nesta rodada, e fazer uma versão pela metade enganaria o teste.
- **O passo que cabe agora é o (a), e ele não é um desvio:** testa a pergunta da qual o (g) depende ("um contorno orgânico faz o jogador esquecer a grade?") sem gastar o núcleo, e a função de deslocamento do mundo, a costa e as casas vazias em mancha servem ao (g) depois. Se o Roger olhar e disser "ainda é hexágono", é o sinal de ir ao (g); se disser "agora sim", economizamos um GG.
- **(f) Fluxo** é a melhor mudança de regra pequena e combina com "Águas que descem", mas não mexe na cara. **(d)** continua parecendo hexágono, só maior.
- Limite honesto do (a): a grade ainda existe por baixo; de perto, a divisa de cor e de altura entre peças aparece, mais na planície que no relevo ondulado.

## O protótipo deste passo
`?fluido` (qualquer modo): a costa e as divisas são deslocadas por uma função das coordenadas do mundo, as casas vazias viram manchas arredondadas e o clique desfaz o deslocamento. Resultado e números no relatório do passo.
