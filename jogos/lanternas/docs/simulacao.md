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
| aleatorio | 35.5 | 25 | 36 | 47 | 58% | 0.0 | 0% | 0% | 64% |
| guloso | 59.2 | 49 | 60 | 70 | 50% | 2.3 | 38% | 0% | 74% |
| planejador | 73.8 | 64 | 74 | 83 | 82% | 0.6 | 37% | 0% | 69% |
| planejador+sopro | 77.2 | 68 | 78 | 86 | 83% | 0.7 | 38% | 0% | 68% |

### Sopro do vento (planejador sem e com o sopro, mesmas 300 sementes)

| Jogador | Média | p10 | p50 | p90 | Sopros/partida | Ilha revelada | Achados (meta) |
|---|---|---|---|---|---|---|---|
| planejador | 73.8 | 64 | 74 | 83 | 0.0 | 82% | 71% |
| planejador+sopro | 77.2 | 68 | 78 | 86 | 3.0 | 83% | 83% |

Ganho do sopro: **+3.40 pontos** em média (±0.80 no intervalo de 95%); partidas que melhoraram 65%, empataram 7%, pioraram 28%. Critério: entre +1 e +6.

### Recursos parados (média por partida)

| Jogador | Comida no turno 20 | Óleo no turno 20 | Comida no fim | Óleo no fim |
|---|---|---|---|---|
| aleatorio | 0.0 | 31.3 | 0.0 | 63.1 |
| guloso | 0.0 | 44.1 | 0.0 | 81.9 |
| planejador | 0.0 | 3.8 | 0.0 | 6.6 |
| planejador+sopro | 0.0 | 3.4 | 0.0 | 6.6 |

### A festa da noite: comida guardada e comida perdida (média por noite 10 / 20 / 30)

| Jogador | Comida no começo do turno da noite (após os turnos 9, 19, 29) | Comida na festa (depois da renda) | Moradores da festa | Comida perdida | Resto da divisão | Perda média por noite (sem o resto) |
|---|---|---|---|---|---|---|
| aleatorio | 10.9 / 35.2 / 62.3 | 13.1 / 40.4 / 70.8 | 1.3 / 5.2 / 8.5 | 4.9 / 12.3 / 26.1 | 1.9 / 2.0 / 2.0 | 14.4 |
| guloso | 7.7 / 23.4 / 45.3 | 8.4 / 26.4 / 51.5 | 1.2 / 4.9 / 9.7 | 0.3 / 0.0 / 1.4 | 2.1 / 1.9 / 1.6 | 0.6 |
| planejador | 13.0 / 40.2 / 56.8 | 14.9 / 45.3 / 63.7 | 2.5 / 8.4 / 11.3 | 0.6 / 1.2 / 5.7 | 2.0 / 1.9 / 1.6 | 2.5 |
| planejador+sopro | 13.4 / 42.1 / 60.0 | 15.3 / 47.4 / 67.3 | 2.5 / 8.8 / 11.6 | 0.6 / 1.2 / 7.5 | 2.1 / 2.0 / 1.8 | 3.1 |

Perda = comida que passa do teto de moradores da noite ou não acha casa iluminada com vaga. O resto da divisão (menos de uma festa de comida) vai em coluna à parte e não entra na perda.

### Metas cumpridas (entre as partidas em que a meta foi sorteada)

| Meta | aleatorio | guloso | planejador | planejador+sopro |
|---|---|---|---|---|
| Ponta marcada | 0% | 4% | 41% | 52% |
| Moradores | 0% | 11% | 58% | 72% |
| Achados | 5% | 1% | 71% | 83% |
| Fileira de casas | 5% | 66% | 33% | 33% |
| Ilha iluminada | 0% | 1% | 71% | 76% |

### Cartas escolhidas (parte das jogadas, sem contar descartes)

| Carta | aleatorio | guloso | planejador | planejador+sopro |
|---|---|---|---|---|
| Casa | 24% | 43% | 34% | 35% |
| Campo | 20% | 19% | 19% | 19% |
| Oliveiral | 21% | 18% | 11% | 10% |
| Lanterna | 23% | 12% | 27% | 26% |
| Cais | 12% | 8% | 10% | 11% |

Razão planejador / aleatório: 2.08x. Planejador / guloso: 1.25x.
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

Observação: a comida no turno 20 e no fim é 0 por construção (a festa zera o estoque), então o critério de comida final sozinho passaria com qualquer festa. Isso foi corrigido na rodada seguinte (próxima seção).

## Medida honesta da festa: quanto de comida se perde por noite

O critério "comida final < 15" passava por construção (a festa zera o estoque). O relatório agora mede, por noite (10, 20 e 30), a comida no começo do turno da noite, a comida na hora da festa, os moradores que a festa pôs e a **comida perdida**: a que passa do teto de moradores da noite ou não acha casa iluminada com vaga (o resto da divisão por `feastFood` vai à parte). Critério novo: perda média por noite do planejador <= 4.

**Medida antes do ajuste** (festa de 3 comida por morador, teto 6 por noite, 1 convidado por casa por noite, casa até 4): o planejador perdia **35,6 de comida por noite** (11,6 / 35,7 / 59,4 nas três noites; guardava 12 / 35 / 56 e a festa só punha ~1 morador por noite). A festa quase não consumia comida: o limite era a vaga nas casas (poucas casas, já cheias), não a comida. A comida sobrava porque a renda dos campos e cais (19 cartas de 58) é umas 3 vezes o que casas e festa gastam.

O que foi tentado (planejador, 150 a 300 partidas): Casa a 7 ou 9 comida (a perda só caiu a ~31 e a meta Moradores quebrou); conversão 2 por 1 com teto 10 (sem efeito: o gargalo era a vaga); menos campos e cais no baralho (perda ~7, mas o planejador virava um jogador de lanternas, 39%, e as metas Luz e Achados passavam de 95%); mais vagas sozinhas (perda ~27). A saída mais simples foi **mexer na festa (teto, conversão e vagas juntos)**, mais uma noção de demanda no planejador:

- Festa: **5 comida = +1 morador, até 14 por noite** (era 3 por 1, até 6; o teto subiu de 12 para 14 quando o sopro do vento fez o planejador guardar mais comida na última noite). Cada casa iluminada recebe até **4 convidados** além do teto de 4 da variedade (antes: a festa dividia as 4 vagas com a variedade e dava 1 por casa por noite); os convidados entram em rodízio entre as casas. Uma casa chega a 8 moradores.
- Por que 5 por 1: com 3 por 1 e teto alto a festa virava a melhor jogada do jogo (pontos de graça por comida); a 5 por 1 uma Casa (5 comida, 1 a 4 moradores) continua sendo o melhor destino da comida e a festa é o escoadouro do que sobra.
- Metas: Moradores subiu de 52 para **66**, porque a festa maior sobe a pontuação do planejador de ~57 para ~74 (a meta cumpria em 96%; agora 49%).
- Planejador: a renda de comida só vale cheio enquanto o estoque projetado fica abaixo da demanda estimada (casas ainda por construir mais a festa das noites que faltam, só com o que é público); acima de 1,2 vezes a demanda vale 10% (`ratioLo`, `ratioHi`, `foodExtra`, `houseRate` em `W`).

| Planejador (300 partidas) | Antes | Depois |
|---|---|---|
| Média | 56,7 | 73,8 |
| Comida no começo do turno da noite (9, 19, 29) | 11,8 / 35,0 / 55,6 | 13,0 / 40,2 / 56,8 |
| Moradores postos pela festa por noite (10 / 20 / 30) | 0,5 / 1,2 / 1,1 | 2,5 / 8,4 / 11,3 |
| Comida perdida por noite (10 / 20 / 30) | 11,6 / 35,7 / 59,4 | 0,6 / 1,2 / 5,7 |
| **Perda média por noite** | **35,6** | **2,5** |

(A coluna "antes" conta o resto da divisão como perda; a "depois" não, como no critério. O resto vale ~2 por noite nas duas.)

O que o número mostra com honestidade: a comida continua sobrando em volume (o planejador guarda ~40 a 55 antes das noites 2 e 3) e quase nunca é o gargalo; o que mudou é que a festa a escoa. A última noite ainda perde 5,7 (bate no teto de 14 moradores). Se a comida deve ser escassa de verdade, o caminho é cortar a renda (menos campos e cais, ou campo que rende menos), não a festa; fica nos próximos passos.

## Sopro do vento

Clima que se toca, na linha do Weatherglass. Quem joga tem 1 sopro: tocar numa nuvem de névoa encostada na área iluminada dissolve a névoa num raio 1 em volta dela (7 hexágonos). Revela o terreno e os achados, mas **não ilumina**: casa, campo, oliveiral e cais não cabem ali, e a área não conta como iluminada para as metas (Ilha iluminada, Achados) nem para os efeitos dos achados (Pomar, Nascente, Cardume, Ruína só valem quando a luz chega). O sopro **não gasta o turno**, recarrega em cada noite e guarda no máximo 1 (`RULES.windMax`). Na lógica (`src/core/game.ts`) o estado é `seen` (névoa dissolvida) ao lado de `revealed` (iluminado); a ação `{ kind: 'wind', idx }` entra no `history` junto das jogadas e `Game.replay(seed, ações)` refaz a partida.

**Uma decisão de regra a registrar:** a Lanterna pode ser posta na terra que o vento mostrou (com o óleo de sempre). Sem isso o sopro era só informação e valia +0,3 ponto ao planejador (o planejador já ilumina ~80% da ilha, então saber onde ficam os achados pouco muda). Com a Lanterna na terra soprada, o sopro é alcance: acende-se a até 4 hexágonos da luz atual em vez de 2, ao preço de uma carta e de 4 de óleo. Casa, campo, oliveiral e cais continuam exigindo luz, como no enunciado.

**O planejador aprende a soprar só com o que se vê** (`windMove` em `src/core/bots.ts`): escolhe a nuvem encostada na luz cujo raio 1 mostra mais hexágonos novos na faixa dos achados (distância >= 4 do centro, regra pública) e sopra assim que houver ganho; usa a carga antes da noite que a recarrega. Duas mudanças para ele não espiar: (a) a cópia cega (`Game.clone(true)`) também esconde o terreno sob a névoa (o que não está à vista vale um palpite: terra até a distância 5 do centro, `BLIND_LAND_RADIUS`); os lugares válidos vêm do jogo real, só o valor é cego; (b) a luz sobre névoa que o vento já mostrou não vale mais o bônus de "achado provável" (`farLight`), porque quem soprou já sabe se há achado ali, e `findBonus` passou a valer de fato (antes não era usado). O planejador sem sopro quase não sentiu: com o terreno cego a média foi de 73,0 para 72,4 (a de 73,8 da tabela já traz o teto de festa de 14).

| Planejador (300 sementes, mesmas partidas) | Sem sopro | Com sopro |
|---|---|---|
| Média | 73,8 | 77,2 |
| p10 / p50 / p90 | 64 / 74 / 83 | 68 / 78 / 86 |
| Sopros por partida | 0 | 3,0 (usa todos: início, depois das noites 10 e 20) |
| Meta Achados | 71% | 83% |
| Meta Ponta marcada | 41% | 52% |
| Meta Moradores | 58% | 72% |
| Ilha revelada | 82% | 83% |

**Ganho: +3,40 pontos (±0,80, intervalo de 95%)**; melhora em 65% das partidas, empata em 8% e piora em 27%. Critério: entre +1 e +6. Abaixo disso é enfeite, acima é forte demais. Todos os critérios antigos passam também para o planejador com sopro (o teste confere os dois). O teste ainda cobre: o sopro não gasta o turno nem a mão, não ilumina nem conta achado, só vale em nuvem fechada encostada na luz, não deixa soprar sem carga, recarrega na noite com no máximo 1 guardado, e o replay (semente + ações, com sopros no meio) reproduz a pontuação e a névoa.

O que ficou de fora: o aleatório e o guloso não sopram (só o planejador), e o sopro não entrou no cálculo de "escolha apertada". A chuva ao tocar o céu é só visual e não aparece no simulador.

## Versão B

<!-- VERSAO_B:INICIO -->
Resultados de 300 partidas por jogador (sementes 1..300), 30 peças cada.

### Pontuação da B

| Jogador | Média | p10 | p50 | p90 | Ilha iluminada | Escolha apertada | Partidas travadas | Mãos refeitas por partida |
|---|---|---|---|---|---|---|---|---|
| aleatorio | 35.1 | 27 | 35 | 43 | 66% | 0% | 0% | 0.00 |
| guloso | 73.0 | 67 | 73 | 78 | 93% | 31% | 0% | 0.00 |
| planejador | 72.4 | 67 | 73 | 78 | 92% | 35% | 0% | 0.00 |

Razão planejador / aleatório: 2.06x. Planejador / guloso: 0.99x.

### De onde vêm os pontos na B (média por partida)

| Jogador | Casas | Moradores | Solares | Maior vila | Achados revelados |
|---|---|---|---|---|---|
| aleatorio | 9.0 | 35.0 | 3.3 | 3.2 | 3.4 |
| guloso | 12.0 | 62.4 | 11.5 | 8.3 | 5.3 |
| planejador | 11.9 | 62.0 | 11.6 | 8.1 | 5.3 |

### Metas da B cumpridas (entre as partidas em que a meta foi sorteada)

| Meta | aleatorio | guloso | planejador |
|---|---|---|---|
| Um solar | 0% | 91% | 95% |
| Vila com praça | 1% | 77% | 75% |
| Achados | 3% | 31% | 26% |
| Ilha iluminada | 0% | 83% | 80% |

### Peças escolhidas na B (parte das jogadas)

| Peça | aleatorio | guloso | planejador |
|---|---|---|---|
| Casa | 30% | 40% | 40% |
| Campo | 19% | 16% | 15% |
| Bosque | 20% | 13% | 14% |
| Lanterna | 22% | 26% | 25% |
| Cais | 9% | 6% | 7% |

### A × B

Mesmas 300 sementes. A tem o planejador sem o sopro do vento (a coluna "A+sopro" da seção acima fica de fora aqui). Arrependimento: 16 sementes por jogador; turno de decisão: 40 sementes.

| Versão | Jogador | Média | p10 | p90 | Razão contra o aleatório | Escolha apertada | Arrependimento médio por turno |
|---|---|---|---|---|---|---|---|
| A | aleatorio | 35.5 | 25 | 47 | 1.00x | 0% | 4.31 |
| A | guloso | 59.2 | 49 | 70 | 1.67x | 38% | 3.09 |
| A | planejador | 73.8 | 64 | 83 | 2.08x | 37% | 1.11 |
| B | aleatorio | 35.1 | 27 | 43 | 1.00x | 0% | 6.33 |
| B | guloso | 73.0 | 67 | 78 | 2.08x | 31% | 2.33 |
| B | planejador | 72.4 | 67 | 78 | 2.06x | 35% | 1.11 |

Arrependimento = em cada turno, quanto a jogada escolhida valia menos que a melhor jogada de um turno à frente (a jogada, a mão seguinte e a melhor resposta), na régua do planejador de cada versão, com a névoa à vista. Unidade: pontos de potencial (cerca de 1 ponto de pontuação). O aleatório mostra o piso; um jogador que escolhe bem fica perto de 0.

#### Turno de decisão

Do começo de cada turno, completa a partida com o planejador e com o aleatório. A diferença média dos finais é quanto as jogadas que faltam ainda mudam o resultado. Turno de decisão = primeiro turno em que ela cai a 10% (ou 25%) da diferença do turno 1.

| Versão | turno 1 | turno 5 | turno 10 | turno 15 | turno 20 | turno 25 | turno 28 | turno 30 | Decisão (10%) | Decisão (25%) |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 39.2 | 35.7 | 32.7 | 26.9 | 18.1 | 11.6 | 6.2 | 2.5 | turno 30 | turno 27 |
| B | 38.9 | 37.3 | 32.9 | 23.9 | 14.2 | 5.4 | 2.2 | 0.7 | turno 27 | turno 23 |

#### Uso de peças do planejador

| Versão | Casa | Campo | Oliveiral / Bosque | Lanterna | Cais |
|---|---|---|---|---|---|
| A | Casa 34% | Campo 19% | Oliveiral 11% | Lanterna 27% | Cais 10% |
| B | Casa 40% | Campo 15% | Bosque 14% | Lanterna 25% | Cais 7% |
<!-- VERSAO_B:FIM -->

### Ajustes da B (só números, nenhuma regra nova)

1. **Primeira rodada (300 sementes):** todos os critérios passaram, mas as metas eram fáceis demais: o planejador cumpria 100% de "Um solar" (2 solares), "Achados" (4) e "Ilha iluminada" (70%), e a pontuação ficava colada no teto (p50 = p90 = 78, planejador = guloso). Com meta que sempre sai, o desafio some e o final já está decidido.
2. **Metas endurecidas:** solares de 2 para 11; achados de 4 para 6 (todos); luz de 70% para 90%; vila com praça passou a pedir 8 casas (`plazaGoal`, antes lia o marco da praça aos 6). Resultado do planejador em 100 sementes: solar 97%, vila 78%, achados 28%, luz 83%. O baralho (12/8/8/9/4) e os marcos (3, 6, 10) ficaram como estavam, porque os critérios do simulador já passavam.
3. **Efeito:** média do planejador 77,0 para 72,4; p10-p90 de 74-78 para 67-78; o turno de decisão passou do 25 para o 27 (10%) e do 21 para o 23 (25%), ou seja, a partida segue aberta mais tempo.

Limite conhecido: na B o planejador não supera o guloso (razão 0,99x). A regra "1 + tipos diferentes" é fácil de otimizar com uma boa heurística simples, então a profundidade vem mais de **como** a vila é desenhada do que de calcular. Isso combina com "nada complexo" do Roger, mas é um risco para quem quer desafio e fica para o teste com pessoas decidir.
