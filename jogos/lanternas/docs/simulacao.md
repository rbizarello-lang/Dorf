# Simulação e balanceamento

Gerado por `npm test` (`tests/sim.ts`): 300 partidas por jogador simulado, sementes 1..300. O bloco entre os marcadores é reescrito a cada execução; o resto deste arquivo é escrito à mão.

## Jogadores simulados

- **aleatório:** escolhe uma carta jogável e um lugar válido ao acaso.
- **guloso:** avalia cada carta × lugar pelo ganho imediato de pontos (moradores + 5 por meta já cumprida) mais um valor simples de estoque e renda de recursos.
- **planejador:** o guloso mais peso para luz revelada, progresso das metas sorteadas, casas expostas à noite, óleo para a próxima noite e para a próxima lanterna. Os pesos estão em `W` (`src/core/bots.ts`).

Nenhum bot enxerga o baralho nem os achados escondidos: avaliam cada jogada numa cópia "cega" do jogo (`Game.clone(true)`), em que os achados ainda sob a névoa não existem. Só usam o que o jogador veria: a mão, o mapa, os recursos e a ponta marcada. O planejador conhece a regra pública de que os achados ficam a distância 4 ou mais do centro e dá um pequeno valor à luz nessa faixa.

"Escolha apertada" = entre os turnos com pelo menos 2 cartas distintas jogáveis, a fração em que a melhor e a segunda melhor carta (cada uma no seu melhor lugar) ficam a menos de 25% de valor uma da outra.

## Resultados

<!-- RELATORIO:INICIO -->
Resultados de 300 partidas por jogador (sementes 1..300), 30 turnos cada.

### Pontuação

| Jogador | Média | p10 | p50 | p90 | Ilha revelada | Descartes/partida | Escolha apertada | Partidas travadas | Mãos refeitas (partidas) |
|---|---|---|---|---|---|---|---|---|---|
| aleatorio | 21.9 | 15 | 22 | 29 | 57% | 0.0 | 0% | 0% | 60% |
| guloso | 46.4 | 38 | 46 | 57 | 54% | 1.8 | 36% | 0% | 67% |
| planejador | 59.0 | 48 | 59 | 70 | 83% | 0.2 | 35% | 0% | 61% |

### Metas cumpridas (entre as partidas em que a meta foi sorteada)

| Meta | aleatorio | guloso | planejador |
|---|---|---|---|
| Ponta marcada | 0% | 4% | 62% |
| Moradores | 0% | 12% | 40% |
| Achados | 4% | 5% | 72% |
| Fileira de casas | 5% | 68% | 60% |
| Ilha iluminada | 0% | 3% | 75% |

### Cartas escolhidas (parte das jogadas, sem contar descartes)

| Carta | aleatorio | guloso | planejador |
|---|---|---|---|
| Casa | 26% | 46% | 40% |
| Campo | 20% | 18% | 17% |
| Oliveiral | 20% | 16% | 8% |
| Lanterna | 22% | 14% | 27% |
| Cais | 12% | 6% | 9% |

Razão planejador / aleatório: 2.69x. Planejador / guloso: 1.27x.
<!-- RELATORIO:FIM -->

## Ajustes de regra feitos com o simulador

Cada item é uma mudança em relação ao enunciado inicial, com o motivo.

1. **Luz da noite com raio 1.** No enunciado a névoa revela até distância 2 e "casa fora da luz" perde morador na noite. Mas toda casa só pode ser posta onde há luz (distância <= 2), então nenhuma casa jamais ficaria fora da luz e a noite não faria nada. Agora a revelação continua em raio 2, mas à noite só protege a casa uma lanterna **encostada** (distância 1).
2. **Lanternas queimam óleo à noite.** Com os números do enunciado (casa 1 comida, lanterna 2 óleo) o planejador terminava a partida com mais de 20 de óleo e mais de 100 de comida sobrando: os recursos não limitavam nada. Passamos a cobrar 1 óleo por lanterna (menos o Farol velho) em cada noite; a que fica sem óleo apaga naquela noite, na ordem em que foi acesa. Isso liga a economia (oliveiral) à noite.
3. **Custos maiores:** Casa 1 -> 5 comida; Lanterna 2 -> 4 óleo. Mesmo motivo do item 2: sobra de recursos fazia Campo e Oliveiral valerem quase zero e a escolha da carta ficava óbvia (escolha apertada em torno de 20%).
4. **Baralho de 58 cartas** (Casa 16, Campo 10, Oliveiral 10, Lanterna 13, Cais 9) em vez de um baralho curto. Com ~34 cartas e 30 turnos o jogador acabava jogando quase todas as cartas do baralho, então "escolher" só mudava a ordem. Com 58, as cartas que ficam sobrando são de fato uma escolha. Mesma razão: a Casa passava de 45% das jogadas do planejador.
5. **Regra de socorro da Lanterna.** O guloso travou numa partida (semente 94): toda a terra iluminada ficou ocupada e não restava onde pôr nem a Lanterna. Agora, se a luz não tem mais nenhuma terra vazia, a Lanterna pode ir a uma terra vazia da névoa encostada na luz. Só vale nesse caso.
6. **Mão garantida.** Se nenhuma das 3 cartas da mão cabe em lugar nenhum (falta de comida, de óleo ou de espaço), a 3ª troca com a primeira carta do baralho que caiba. Se nenhuma do baralho inteiro cabe, o turno conta como travado (o jogador descarta por +1 óleo). A tabela traz a fração de partidas em que a regra agiu.
7. **Achados mais longe e todos os 6 sempre.** Achados nascem a distância >= 4 do centro (se faltar lugar, relaxa até 3), para que valham um esforço de luz. São sempre 6: 2 Ruínas, 1 Cardume, 2 Pomares, 1 Nascente. Ruína, Pomar e Nascente ocupam o hexágono (não recebem peça); o efeito de Pomar, Nascente e Cardume só vale depois de revelados.
8. **Metas calibradas** (o planejador estava em 90 a 100% nas metas do enunciado): moradores 52 (o enunciado deixava N aberto), achados **5** (de 6) em vez de 4, fileira de **4** casas em vez de 3, ilha iluminada **80%** em vez de 60%. "Ilha" = hexágonos de terra revelados.
9. **Pesos do planejador.** Valor de luz 0.45 -> 0.25 por hexágono (revelava quase tudo, 87 a 90% da ilha); renda de recursos só perde valor quando o estoque já cobre o gasto (`satur`, 0.9: quase sem desconto; com 0.25 a escolha apertada caía para 20%).
10. **Bots sem trapaça.** Na primeira versão o bot avaliava uma lanterna numa cópia do jogo em que a luz revelava os achados de verdade (era um espião da névoa: sabia que uma Ruína valia +3 moradores antes de acender). Agora a avaliação roda numa cópia cega (`Game.clone(true)`). Com isso o planejador perdeu a meta de achados (14% com 6 de 6) e passou a precisar de um incentivo público: a regra "achados ficam a distância >= 4" gera o peso `farLight`. A meta de achados caiu para 5 de 6 para voltar à faixa de 20 a 85%.
11. **Ponta marcada no planejador.** O bônus de proximidade da ponta sumia ao acender a lanterna na ponta, e o planejador deixava de completar a meta (1%). Agora o bônus de proximidade fica também com a meta cumprida (62%).
12. **Guloso com estoque barato e uma noção de luz.** O guloso era nulo sem o espião da névoa (nunca acendia lanterna). Ganhou 0.15 por hexágono de terra iluminado, como "valor simples de recurso".
13. **Estoque do guloso barato.** O peso linear de estoque em 0.6 por unidade fazia o guloso nunca construir uma casa (custa 5 comida) e descartar quase sempre; baixamos para 0.25 para ele ser um adversário razoável.

Observação conhecida: mesmo assim, no fim da partida o planejador costuma ter comida sobrando (a comida só limita no começo). O que limita depois é o baralho e o lugar. Fica como ponto a rever com jogadores de verdade.
