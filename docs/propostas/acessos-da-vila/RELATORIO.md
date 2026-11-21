# Acessos entre patamares da vila

O piloto encaixa um lance de dois a quatro degraus de pedra no eixo de uma rua. Só aparece quando encontra dois pisos vizinhos com desnível moderado e uma passagem livre na largura da escada. As duas transições acompanham a cota do chão. A peça mantém as fundações e os arrimos fora dessa passagem. As amostras respeitam o setor de vila e as margens de água, via, divisa e construções.

Na Holanda Dourada, em Zen com Paisagem viva ligada, semente 42 e 60 jogadas automáticas, a escada da peça (0, 1) liga os dois pisos entre as casas. Os dois degraus se distinguem de perto. No zoom de jogo o conjunto aparece como uma faixa curta de pedra no fim da rua e pode ficar encoberto por casas em alguns ângulos. [Prancha antes e depois](acesso-vila-comparado.jpg)

## Aviso da Ronda

O aviso acompanha a altura real do cabeçalho, inclusive quando os controles quebram em linhas e o texto está ampliado. `node scripts/aviso-topo.mjs` mede a Ronda real e uma mensagem longa em cinco tamanhos, de 320×640 a 1440×900, incluindo celular na horizontal. O teste também confere que o aviso continua visível em modo foto. [Prancha em desktop e celular](aviso-hud-comparado.jpg)

## Custo e verificação

- Stress de 301 peças na Holanda, Zen, seed 42, Paisagem viva, Alta e zoom 16, no WebGPU da RTX 3060. A geometria de chão passou de 461.454 para 461.474 triângulos (+0,0043%). O quadro medido teve 119 → 117 draw calls e 1.574.077 → 1.574.049 triângulos totais, com variação da fauna entre quadros. O mapa manteve 90.122 instâncias e a mesma sequência de peças.
- Ensaio CPU pareado com `tests/hills-cost.ts`, usando `[T.Grass, T.Village, T.Village, T.Village]` como população dos setores livres. Em três repetições de 400 peças, a mediana com Encostas foi de 5,04 ms/peça na base `f411920` e 4,88 ms no piloto. As amostras se sobrepõem. O topo e as laterais ficaram em 1.542 triângulos médios por peça e decalques e fundações passaram de 336 para 337.
- `tests/village-access.ts`, incluído em `npm run hills`, cobre determinismo, ambos os sentidos da rua, desnível e obstáculos internos e laterais. O jogo compartilha a malha entre fantasma, pouso e reconstrução.
- `npm run check` passou com verificação de tipos, 600 partidas e build.
