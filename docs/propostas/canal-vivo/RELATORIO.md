# Canal da Paisagem viva

Quando duas bocas de rio se encontram, a largura comum parte da maior largura natural da dupla. O ganho cresce com a quantidade de encaixes de rio dos dois lados, até três, e mantém margem antes dos cantos. Uma boca aberta continua com a largura natural. A opção «Paisagem viva» também controla esse efeito.

Um encaixe pode alargar outras bocas já ligadas. A fila das Encostas atualiza o leito, a água, a correnteza e a corredeira nas peças afetadas. A prévia mostra a nova largura e destaca as peças que serão atualizadas. Os barcos do cenário seguem a curva do rio e contornam a ilhota quando ela cruza esse caminho. A barca do Entrepostos lê as faixas assentadas quando a fila do seu trajeto termina.

## Verificação

- `npm run check` passou, incluindo 600 partidas, a navegação pelo rio e o build de página única. No `npm run smoke` local, o Chrome headless usou WebGL2 também nos casos que exigiam WebGPU. O teste em hardware abaixo exercitou o WebGPU na RTX 3060.
- Na base D46 (`2ef6955`), o teste dirigido mediu larguras totais de 0,4255 e 0,5595 para as duas ordens de encaixe. A versão com o canal deu 0,6146 nas duas ordens e 0,6719 após a segunda conexão. O teste mediu as duas margens em três orientações e conferiu a prévia, a atualização da vizinha da vizinha, as faixas antigas, a reconstrução e o replay.
- O teste de cena dirigido no Relevo cruzou quatro emendas de rio em lances rápidos. Comparou 15 peças, cinco malhas de água e duas corredeiras entre a cena incremental, a reconstrução e o replay. O teste verifica se a assinatura tem uma chave distinta por peça assentada.
- A inspeção de 29 trajetos de barco ambiente no Zen e na Terra contínua encontrou 1.421 amostras sobre água. O teste da ilhota compara ambos os sentidos com larguras anteriores e atuais.
- Em WebGPU na RTX 3060, a viagem Confluência/Da Madeira, semente 42, com a Paisagem viva ligada, fez três entregas em 14 jogadas e atingiu 718 pontos. A camada de fretes calculou três trajetos. As duas primeiras barcas ficaram visíveis na inspeção.
- No stress pareado em WebGL2 (`f411920` e o candidato, 301 peças, qualidade Alta, Holanda, Zen, semente 42), os draw calls foram de 169 para 168, os triângulos de 2.087 mil para 2.061 mil e as instâncias de 90.122 para 88.298.
- No mesmo tabuleiro em WebGPU na RTX 3060, em quadros sem redesenho das sombras, os draw calls foram de 119 para 116 e os triângulos de 1.574.077 para 1.553.784. A geometria do chão subiu de 461.454 para 462.197 triângulos (+0,16%). A decoração recua junto às margens mais largas.

[Prancha comparativa de Zen e Terra contínua](canal-vivo-comparado.jpg)
