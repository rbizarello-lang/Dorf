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
| aleatorio | 22.8 | 16 | 22 | 31 | 58% | 0.0 | 0% | 0% | 64% |
| guloso | 46.2 | 38 | 46 | 57 | 53% | 1.8 | 38% | 0% | 71% |
| planejador | 56.7 | 48 | 56 | 68 | 81% | 0.2 | 35% | 0% | 71% |

### Recursos parados (média por partida)

| Jogador | Comida no turno 20 | Óleo no turno 20 | Comida no fim | Óleo no fim |
|---|---|---|---|---|
| aleatorio | 0.0 | 31.3 | 0.0 | 63.1 |
| guloso | 0.0 | 43.2 | 0.0 | 78.1 |
| planejador | 0.0 | 3.8 | 0.0 | 5.8 |

### Metas cumpridas (entre as partidas em que a meta foi sorteada)

| Meta | aleatorio | guloso | planejador |
|---|---|---|---|
| Ponta marcada | 0% | 3% | 48% |
| Moradores | 0% | 13% | 30% |
| Achados | 5% | 3% | 65% |
| Fileira de casas | 5% | 56% | 66% |
| Ilha iluminada | 0% | 2% | 75% |

### Cartas escolhidas (parte das jogadas, sem contar descartes)

| Carta | aleatorio | guloso | planejador |
|---|---|---|---|
| Casa | 24% | 43% | 37% |
| Campo | 20% | 19% | 18% |
| Oliveiral | 21% | 17% | 10% |
| Lanterna | 23% | 13% | 25% |
| Cais | 12% | 8% | 10% |

Razão planejador / aleatório: 2.48x. Planejador / guloso: 1.23x.
<!-- RELATORIO:FIM -->

## Ajustes de regra feitos com o simulador

Cada item é uma mudança em relação ao enunciado inicial, com o motivo.

1. **Luz da noite com raio 1.** No enunciado a névoa revela até distância 2 e "casa fora da luz" perde morador na noite. Mas toda casa só pode ser posta onde há luz (distância <= 2), então nenhuma casa jamais ficaria fora da luz e a noite não faria nada. Agora a revelação continua em raio 2, mas à noite só protege a casa uma lanterna **encostada** (distância 1).
2. **Lanternas queimam óleo à noite.** Com os números do enunciado (casa 1 comida, lanterna 2 óleo) o planejador terminava a partida com mais de 20 de óleo e mais de 100 de comida sobrando: os recursos não limitavam nada. Passamos a cobrar 1 óleo por lanterna (menos o Farol velho) em cada noite; a que fica sem óleo apaga naquela noite, na ordem em que foi acesa. Isso liga a economia (oliveiral) à noite.
3. **Custos maiores:** Casa 1 -> 5 comida; Lanterna 2 -> 4 óleo (a queima da noite subiu depois a 2 óleo por lanterna, ver "A comida que sobra" no fim). Mesmo motivo do item 2: sobra de recursos fazia Campo e Oliveiral valerem quase zero e a escolha da carta ficava óbvia (escolha apertada em torno de 20%).
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

## Comida que sobra: a festa da noite

Problema: com as regras acima o planejador terminava com 98 de comida e 8,6 de óleo em média (88 de comida na captura do fim). A comida só limitava no começo; depois o gargalo era o baralho e o lugar, e um recurso que não limita é uma escolha morta. Novos critérios do simulador: comida final média do planejador < 15 e óleo final médio < 10 (o relatório traz agora comida e óleo no turno 20 e no fim, para cada bot).

Testamos três famílias de regra. Os bots só passaram a avaliar o novo valor da comida (nada de espiar baralho ou névoa): o planejador ganhou o termo `feast` (valor dos moradores que a festa renderia com a comida de agora, via `Game.feastGain`) e, nas opções a e c, o custo/consumo novo no lugar do custo fixo. 300 partidas, planejador:

| Opção | Média | Razão vs aleatório | Escolha apertada | Casa (parte das jogadas) | Comida final | Óleo final | Critérios |
|---|---|---|---|---|---|---|---|
| antes (Casa 5, 1 óleo por lanterna) | 59,0 | 2,69x | 35% | 40% | 98,0 | 8,6 | reprova comida |
| a1) Casa 5 + ⌊casas/3⌋ | 58,8 | 2,68x | 34% | 39% | 81,5 | 8,8 | reprova comida |
| a2) Casa 3 + casas | 58,0 | 2,62x | 35% | 39% | 59,1 | 8,2 | reprova comida |
| a3) Casa 3 + 2 por casa | 52,4 | 2,44x | 37% | 34% | 42,3 | 10,4 | reprova comida, óleo e meta Moradores (4%) |
| c1) cada casa come 1 por morador por noite | 54,9 | 2,54x | 34% | 36% | 40,6 | 10,0 | reprova comida e meta Moradores (18%) |
| c2) cada casa come 2 por morador por noite | 46,3 | 2,25x | 33% | 30% | 22,0 | 12,3 | reprova comida, óleo e meta Moradores (1%) |
| b) festa: 3 comida = +1 morador, até 6 por noite | 57,4 | 2,50x | 35% | 36% | 0,0 | 11,0 | reprova só óleo |
| **b + lanterna queima 2 óleo (escolhida)** | **56,7** | **2,48x** | **35%** | **37%** | **0,0** | **5,8** | **passa tudo** |

Uso das cartas na escolhida (planejador): Casa 37%, Lanterna 25%, Campo 18%, Cais 10%, Oliveiral 10%. Comida e óleo no turno 20 (depois da noite 20): 0,0 e 3,8.

Por que a festa e não as outras:

- **a) Casa mais cara** não resolve: o planejador compra menos casas, mas o limite das casas continua sendo carta e lugar, não comida; a renda dos campos segue acumulando. Para derrubar a comida a conta ficava tão cara (a3) que a meta de 52 moradores quebrava.
- **c) Fome** é difícil de explicar (a vila come por morador, a casa perde gente em silêncio) e castiga justamente quem tem mais moradores: com consumo baixo sobra comida, com consumo alto a vila encolhe e as metas quebram.
- **b) Festa** dá um destino à comida: quem guarda demais perde o estoque na noite, quem gasta tudo em casas antes dela também não perde nada. Explica-se numa frase ("na noite, a comida guardada vira moradores e o estoque zera"). Zerar o estoque é o que mata a sobra; a conversão (3 por morador) é generosa o bastante para a festa valer a pena sem substituir a Casa (uma Casa de 5 comida rende até 4 moradores e dura a partida inteira).
- **Óleo:** com a festa o planejador comprava menos casas e o óleo final subiu a 11,0 (limite 10). A mesma lógica pedia um custo que pese a partida toda: a lanterna passou a queimar 2 óleo por noite (era 1), o que liga o Oliveiral à noite com mais força. Mexer nos pesos do planejador em vez da regra (renda do óleo 0,6) também passava no óleo, mas empurrava a escolha apertada para 25%, no limite do critério; a regra é mais honesta e mais simples.

Detalhes da regra: a festa roda depois das lanternas queimarem e só põe morador em casa com lanterna acesa encostada e vaga (a casa chega a 4 no máximo, contando festas); o morador da festa fica (é permanente, mas a casa sem lanterna numa noite futura perde 1 morador como sempre). Na noite 30 a festa conta para a pontuação final. Os critérios ficam em `tests/sim.ts`.

Observação: a comida no turno 20 e no fim é 0 por construção (a festa zera o estoque), então o critério de comida final sozinho passaria com qualquer festa. O que mostra que a comida pesa é a mudança de comportamento: o planejador ainda faz 37% de Casas e a pontuação cai só 2,3 pontos.
