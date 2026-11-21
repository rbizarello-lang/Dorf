# Paisagem viva — celeiros por tema

## Celeiros

O cultivo ganha o armazém próprio do tema nos estágios 2 e 3 da Paisagem viva. A Holanda tem um celeiro escuro de empena, o Egito tem silos de adobe, o Oriente tem um kura rebocado, o Brasil tem um paiol e o Inverno tem um stabbur com neve. Os cinco temas do catálogo escolhem forma e paleta nos dados. O mapa usa a mesma chave `barn` e um pool por região, com a geometria do tema atual.

A posição vem da seleção determinística de uma planta, como na versão anterior. Um ensaio de geometria com duas sementes e os cinco níveis de densidade conferiu ausência no estágio 1, uma instância nos estágios 2 e 3 e a mesma posição após reconstrução. Os kits têm 60 triângulos na Holanda, 164 no Egito, 60 no Oriente, 96 no Brasil e 108 no Inverno.

## Verificação

- `npm run check` passou com 600 partidas, os testes de renderização e o build. Paisagem viva conferiu 48 partidas, 192 ordens e 3.102 prévias. Os 478 kits ficaram em até quatro buffers de vértices.
- No smoke local com SwiftShader, os sete casos WebGL2 passaram. Os oito casos que exigem WebGPU abriram em WebGL2 nesse Chrome.
- No stress pareado em WebGL2 (Zen, Holanda, semente 42, Alta, Paisagem viva ligada, 301 peças), os draw calls ficaram em 115, os triângulos passaram de 1.573 mil para 1.576 mil e as instâncias ficaram em 90.122.
- As capturas em WebGPU na RTX 3060 usam a mesma partida antes e depois. O celeiro de cada imagem foi confirmado no estágio 2 pelas duas bordas de cultivo encaixadas. Veja a [prancha em jogo](celeiro-estagio-2.jpg) e a [galeria dos cinco temas](celeiros-galeria.jpg).

- No stress dirigido em WebGPU na RTX 3060, uma captura do quadro registrou 117 → 120 draw calls e 1.574.033 → 1.576.525 triângulos, com fauna e demais animações ativas. O total foi de 90.122 instâncias em 54 lotes nos dois builds. O lote de celeiros ficou em 85 instâncias.
