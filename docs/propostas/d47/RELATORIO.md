# D47: fundações das casas nos patamares

- Branch `dorf/d47-fundacoes` a partir da `main` em `f411920`. Prancha antes e depois: [prancha-fundacoes.jpg](prancha-fundacoes.jpg) (Holanda, Zen, semente 42, Alta, Paisagem viva, 46 peças, as mesmas casas e a mesma câmera). Saída do teste falhando na `main`: [teste-na-main.txt](teste-na-main.txt).

## Causa
Reproduzida com `window.__deco('wall:', i, zoom)` e confirmada na geometria (`tests/foundations.ts`). Eram quatro defeitos juntos, todos na junção da pedra com o chão em degraus:
1. **Piso abaixo do chão.** O piso da casa era `min(seat + 0,045, max(seat, high - 0,055))` sobre 4 cantos: em 1.507 das 2.351 casas amostradas o chão desenhado (capas e arrimos inclusive) passava do piso, até 0,125. A capa cortava o topo da fundação em triângulos que se cruzavam.
2. **Pedra menor que a casa.** A pedra era 0,52 da parede; a Paisagem viva alarga a casa até 15% depois da montagem, então a casa crescida passava da pedra.
3. **Saia reta sobre chão em degraus.** O lábio e a saia de terra eram quadriláteros retos entre 4 cantos, e o chão entre eles sobe e desce nos arrimos: a saia furava a capa e a capa furava a saia.
4. **Furos de decalque e capim.** Ruas, parcelas e a praça (decalques draped uma vez só) sobem sobre as encostas dos arrimos e o capim nasce no pé da casa: ambos furavam o topo da pedra em lascas soltas. Um decalque que escala um arrimo inteiro vira uma lasca em pé.

Também havia uma diferença de cota: o piso da casa somava o leito (`groundY`), o topo da pedra não.

## Correção (só `src/render/tileBuilder.ts`)
- O piso é a cota mais alta do chão sob a casa mais 4 mm: grade 17×17, os 4 lados e um refino no ponto mais alto, em cota absoluta (parede, telhado e chaminé), a mesma do topo da pedra.
- A fundação é um bloco de pedra de paredes verticais, de 0,58 da parede, que afunda 2 cm abaixo da menor cota de cada lado. Só entra se o desnível passa de 12 mm; o lado onde o chão já encosta no piso não tem parede. Some a saia de terra.
- Os decalques com vértice dentro do retângulo descem para baixo do piso; o capim, as flores, as plantas e as árvores dentro dele somem (o que se move (bicho, aldeão) também some, e o resto estático (poço, lampião) sobe ao piso); num anel de 0,12 em volta, o decalque que escalaria um arrimo de mais de 5 cm não é desenhado (a face de pedra aparece).
- Não mexi em `src/core`, na emenda, na água, no replay nem no `SAVE_VERSION`. A aparência segue só de `(edges, seed, theme, opts)`.
- Efeito colateral intencional: as casas de patamar íngreme ficam mais altas (o piso passa a ser o ponto mais alto): bloco de pedra com mediana de 0,11, p90 de 0,21 e máximo de 0,38 de altura. Se o Roger achar alto, o botão é `FOOT_HALF` (menor área medida) ou limitar o piso, o que reabre o furo da capa.

## Teste
`tests/foundations.ts`, no `npm run hills` (e no `npm test`): 3 sementes × 5 temas × Clássico, Zen e Relevo, 36 jogadas, 3.077 casas, medindo a geometria montada e o chão desenhado (`HillSurface.at`) sobre a casa crescida (estágio 3): o chão nunca passa do piso; o topo cobre cantos, meios dos lados e centro; cada lado visível tem parede com base abaixo da menor cota; nenhum decalque fura o topo; nada enterrado sob o piso; nenhum decalque escala o arrimo junto da casa. Na `main` falha com 144.210 pontos em 3.077 casas; depois da correção passa (2.614 casas com bloco, 8.770 paredes). Cada checagem foi vista falhar desligando a parte da correção.

## Números (stress `300:high`, WebGL2 por software, Holanda, semente 42)
| | main | D47 |
|---|---|---|
| Draw calls | 115 | 115 |
| Triângulos | 1.254 mil | 1.241 mil (−1,0%) |
| Instâncias | 72.425 | 71.434 (−1,4%) |
| Montagem | 2.022 ms | 2.000 ms |

## Verificação
- `npm run check` verde (tipos, testes, build).
- `npm run smoke`: todos os casos WebGL2 verdes (`webgl`, `relevo-webgl`, `terra-hash-webgl`, `entrepostos-*`, `buffers-de-vertice`, `vida-dos-buffers-webgl`, `ao-vivo-webgl`). Os casos WebGPU falham com "Instance dropped" do WebGPU por software, como na `main`.
- `npm run scene`: 16 casos, cena incremental igual à reconstrução integral.
- `npm run compare` (Alta, WebGL2, `main` × branch): holanda 2,449% / média 3,018; egito-entardecer 2,708% / 2,899; noite 1,463% / 2,635; zoom-aberto 7,914% / 4,194; rio-perto 13,633% / 7,233; vila-perto 1,623% / 2,973. Acima da tolerância, como esperado: as imagens `diff-*` mostram a diferença só nas casas (mais altas, com a pedra nova); chão, água e vegetação longe das casas não mudam.

## Correção da revisão
- A primeira versão levantava ao piso também o que se move, e a `Life` soma `groundRise` na hora: o boi do `rio-perto` ficava no ar. Agora o que tem `anim` dentro do bloco some, e o teste confere que nenhum `anim` cai no retângulo.
- Vistas do compare olhadas depois disso (rio-perto, zoom-aberto, vila-perto, egito-entardecer, noite): a diferença está nas casas e fundações; sem bicho ou aldeão no ar. O resto (pétalas, pássaros, nuvens) é movimento que muda entre gravações.
- Merge da `main` (#122, #126, #127): o teste de decalque junto da casa isenta os degraus de `villageAccess` (pisos horizontais e espelhos verticais, desenhados depois do `drape`). Os degraus evitam a casa a 0,60 da parede e a pedra vai a 0,58. Não consegui uma captura de rua com degraus junto de casa nesta semente; a conferência é o `tests/village-access.ts` e o `tests/foundations.ts` passando juntos.
- Custo: `npm run hills:custo` com Encostas deu 3,9 a 4,1 ms por peça (main com D46: cerca de 3,45; carga da máquina varia). Reduzir `FOOT_GRID` de 16 para 10 não mudou o tempo de forma mensurável, então ficou 16.

## Pendente
- Não medido em GPU real. Casas muito grandes (`long`) em encosta forte ficam com bloco alto.
- A prévia do fantasma da Paisagem viva (item menor) não foi capturada: sobrou pouco tempo, e a máquina estava disputada.
