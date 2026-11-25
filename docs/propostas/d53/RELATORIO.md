# D53: casas do estágio 3 e palmeiras na silhueta

Itens P3.5 e P3.6 da [avaliação autônoma](../avaliacao-autonoma/AVALIACAO.md). Branch `dorf/d53-silhuetas`, a partir da `main` em `e14103a`.

## 1. Casas do estágio 3 da Paisagem viva

**Causa.** `developBuild` (`src/render/livingBuild.ts`) multiplicava a altura da casa por `1 + 0,22 × estágio` (+66% no estágio 3) e a largura por `1 + 0,05 × estágio` (+15%). A casa ficava 1,44 vez mais alta em relação à largura, e como a conta era a mesma para toda casa, as empenas saíam todas iguais.

**O que mudou.**
- A altura sobe `GROW.house` = 0,075 por estágio, mais até `GROW.houseTall` = 0,06 por casa: de +20% a +40% no estágio 3 (antes, +66%).
- A largura de cada eixo (x e z, independentes) sobe de 55% a 100% de `GROW.houseWide` (5% por estágio): **no máximo +15%**, o que a fundação da D47 supõe. `FOOT_HALF` e `tests/foundations.ts` ficaram como estavam.
- A proporção de cada casa sai de `houseHash(x, z, sal)`, um hash inteiro da posição dela na peça (sem `Math.random`). Parede e telhado da mesma casa têm o mesmo `x, z` e caem na mesma conta, então a tripla de escala continua igual nos dois. A aparência segue dependendo só de `(edges, seed, theme, opts)` mais o estágio.
- A chaminé sobe com a altura da casa dela (a parede mais próxima da chaminé), não mais com um fator único.
- Nenhum pool novo, nenhuma instância nova, nenhum draw call novo. A escala por instância continua se compondo com a era (que troca só a geometria em `Pool.retarget`).

## 2. Palmeiras e coqueiros

**Causa.** `palm` tinha 7 folhas de cone de raio 0,03 e `waxpalm` 6 de 0,024, sem miolo: de longe viravam traços. A versão leve (`Lib.farGeo`) sai da mesma função com `farTree`, então herda tudo.

**O que mudou** (`src/render/lib.ts`, `treeGeometry`).
- `palm`: coroa cheia (octaedro achatado tingido, raio 0,045) onde as folhas nascem, 9 folhas de raio 0,042 e 0,22 de comprimento (eram 7, 0,03 e 0,2), tronco um pouco mais grosso (0,015 a 0,019).
- `waxpalm`: coroa (raio 0,032), 8 folhas de raio 0,036 (eram 6 de 0,024), tronco 0,011 a 0,015.
- **Temas que usam o kit e, portanto, mudaram:** Brasil (`palm` e `waxpalm`), Egito (`palm`, é a árvore principal do tema, peso 0,63) e Guanabara (`palm`). Nenhum outro tema usa `palm` ou `waxpalm`. Oriental, Holanda, Inverno e Chamonix saem pixel a pixel como antes (conferido no `compare`).

## Números

| Verificação | Resultado |
|---|---|
| `npm run check` (typecheck, 600 partidas, build) | verde, `EXIT=0` |
| `npm run hills` (inclui `tests/foundations.ts`) | verde: fundações em 4321 casas, "o chão nunca passa do piso (maior folga 0.0000)" |
| `npm run living` | verde: 48 partidas, 4173 peças, replays e desfazer |
| `npm run scene` | "cena incremental = reconstrução integral em todos os casos" (17 casos) |
| `npm run smoke` | todos os casos WebGL2 ok; os casos WebGPU falham nesta máquina por "Instance dropped" / "WebGPU Device Lost" (SwiftShader), nenhum por erro do jogo |

### Stress `300:high`, WebGL2, semente 42 (301 peças)

| Cenário | Build | Draw calls | Triângulos | Instâncias |
|---|---|---|---|---|
| `theme=brasil` | `main` | 121 | 1404 mil | 33807 |
| `theme=brasil` | D53 | 118 | 1417 mil | 33807 |
| `theme=holanda&mode=zen&viva=1` | `main` | 118 | 1374 mil | 87184 |
| `theme=holanda&mode=zen&viva=1` | D53 | 118 | 1374 mil | 87184 |

Brasil: +0,9% de triângulos (o limite era ~10%); as instâncias são iguais. A diferença de 3 draw calls no Brasil é do quadro da sombra, que oscila (ver "Orçamento de desempenho" do `AGENTS.md`). Holanda em Zen com Viva: idêntico, porque a mudança das casas é só de escala, não de geometria nem de contagem.

### `compare` (`QUALITY='low&webgl'`, `main` contra a branch)

| Vista | Diferentes | Média | Leitura |
|---|---|---|---|
| holanda | 0,075% | 0,028 | ruído |
| egito-entardecer | 1,26% | 0,285 | mudou: palmeiras do Egito (de propósito) |
| noite | 0,04 a 0,11% | 0,02 a 0,05 | ruído |
| zoom-aberto | 0,25 a 0,30% | 0,10 a 0,13 | ruído (moinhos e o que se move) |
| rio-perto | 4,55% | 1,40 | mudou: palmeiral do Egito (de propósito) |
| vila-perto (Oriental) | 0,000% | 0,000 | igual |

Observação: na primeira gravação da branch, `vila-perto` deu 1,08%; na repetição deu 0,000% contra a `main` (e 1,08% contra a primeira gravação). Foi uma gravação ruim, não uma mudança: o Oriental não usa o kit. Duas gravações seguidas da `main` dão 0,000% nessa vista.

## Pranchas (antes à esquerda, depois à direita; mesma semente, câmera e luz)

- `01-silhueta-brasil.jpg` e `02-silhueta-brasil-zoom-aberto.jpg`: `?silhueta` no Brasil, zoom de jogo e zoom aberto.
- `03-palmeiras-brasil.jpg`, `04-palmeiras-egito.jpg`, `05-palmeiras-guanabara.jpg`: palmeiras de perto (`focus=1&zoom=6`).
- `06-vila-estagio3-dia.jpg` e `07-vila-estagio3-noite.jpg`: Holanda, Zen, `viva=1`, `focus=3&zoom=9`, de dia e `time=night`.

## O que ficou de fora

- Na silhueta o ganho das palmeiras é visível mas moderado: a copa fica mais cheia, mas continua um volume pequeno diante das casas e da mata. Não aumentei a escala das palmeiras (mexeria na proporção de perto e no orçamento).
- As casas ainda são altas em comparação com a largura, porque a base delas já é alta (sobrado da era II). A mudança tirou o alongamento extra do estágio, não a proporção do tema. Subir a largura além de 15% pediria mexer em `FOOT_HALF` e no teste da fundação; não foi preciso.
- Medi só em WebGL2 por software: o FPS e o WebGPU real não foram medidos (como o `AGENTS.md` já avisa).
- Não acrescentei instâncias de outros kits (a mudança de proporção bastou).
