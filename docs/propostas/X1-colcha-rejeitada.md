# X1: um encaixe próprio para o Retalhos

Hoje: 6 bordas de terreno, borda igual pontua, rio e estrada estritos. É o desenho do Dorfromantik.
Meta: um jeito de encaixar que seja nosso, calmo, legível e que não trave a pilha.
Direção: o nome é Retalhos, então a identidade é a COLCHA: peças são retalhos, o que une é costura e nó.

## Proposta A (escolhida): Nós de colcha nos cantos

**Como funciona.**
1. Além das 6 bordas, cada peça tem 6 botões de lã, um em cada canto, de três cores (vermelho, azul e marfim, 2 de cada, em ordem sorteada pela semente da peça).
2. Em cada canto do mapa se encontram até 3 peças. Quando as três mostram a mesma cor naquele canto, o nó se amarra: +15 pontos e um nó dourado aparece no canto.
3. O terreno continua valendo como sempre. Os botões são uma segunda camada de encaixe: nunca impedem uma jogada, só premiam.

**Por que é diferente.** Dorfromantik, Carcassonne, Cascadia e Isle of Skye encaixam por BORDA (ou por centro da peça, como os animais do Cascadia). Taluva encaixa por altura e vulcão. Aqui o encaixe também acontece no VÉRTICE, onde três peças se tocam, e isso pede girar a peça olhando para os cantos, não só para as bordas. Dá o mesmo tipo de decisão calma ("onde e girada como?"), mas com uma pergunta nova.

**Na tela.** Botões pequenos (vermelho e azul, com aro claro) em cada canto de cada peça. O fantasma mostra o nó dourado se a jogada amarra, e um anel da cor pedida nos cantos em que as duas vizinhas já combinam e a peça não. A etiqueta de pontos soma os nós. Ao colocar: brilho e aviso "Nó +15".

**O que muda em `core`.** Arquivo novo `quilt.ts` (cores dos cantos por `def.seed`, vizinhos de cada canto). `Rules.knots` (0 = desligado), `Placed.corners/knots`, `Check.knots/wants`, `PlaceResult.knots`. Sequência de peças, missões e save intactos (modo novo no formato v13).

**Risco de equilíbrio.** Com duas cores o guloso amarrava ~75 nós por partida (fácil demais), então foram três cores e nó de 15: jogando sem olhar os cantos saem ~12 nós; o guloso que olha, ~45. Ajustado pelo `npm run balance` (ver relatório). **Risco de trava:** nenhum, pois os botões não restringem a jogada.

## Proposta B: Fio de costura

Cada peça tem de 0 a 3 bordas com um fio colorido que atravessa a divisa. Fios que se encontram formam uma linha contínua, e laços fechados pagam bônus e uma peça. Bonito (pontos de costura sobre a divisa) e muito na identidade, mas parece Tantrix/Carcassonne com estradas e repete o trilho e as rotas que já temos. Risco de trava baixo se o fio não for obrigatório.

## Proposta C: Blocos de colcha (Jardim da Vovó)

Cada peça ganha um tecido (liso, listrado, xadrez, floral). Um bloco pedido (flor de 7 peças: miolo e 6 pétalas, ou faixa de 5) vale muito quando completado em qualquer lugar. Tradição real da colcha de hexágonos, mas é pontuação por padrão (Cascadia) e a camada de tecido precisa de material novo no chão, o mais caro de desenhar.

## Por que A

É a que mais muda a pergunta de encaixe (vértice, nada parecido no gênero), é a mais barata de ler (um botão por canto, um nó dourado quando dá certo), reaproveita a linguagem de prévia que já existe (dourado = bom) e é só dados derivados da semente: a pilha, os outros modos e os saves não mudam.
