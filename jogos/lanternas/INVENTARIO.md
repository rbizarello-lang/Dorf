# Inventário das regras da versão A

Reconstruído em 2026-10-16 lendo `src/core/game.ts` e `src/core/map.ts` (números em `RULES`). Cada regra numa frase. **[E]** marca uma exceção (regra que existe para consertar outra regra). São 9 exceções.

Classes: **S** serve à experiência; **M** só existe para passar numa métrica do simulador; **E** exceção.
Destino na B: **mantém**, **simplifica** ou **sai**.

Observação: o "100" do enunciado conta também detalhes de interface e visual; aqui estão as regras de jogo que o código aplica (cerca de 60), que são as que a B pode manter ou cortar.

## Mapa e névoa

| # | Regra | Classe | Na B |
|---|---|---|---|
| 1 | A ilha é um mapa hexagonal de raio 7, gerado pela semente. | S | mantém |
| 2 | Só fica a terra ligada ao centro; ilhotas soltas viram água. | S | mantém |
| 3 | Os terrenos são Água, Praia (costa), Prado, Bosque e Rocha. | S | simplifica: sem Rocha (vira Prado) |
| 4 | O Farol velho fica no centro, já aceso. | S | mantém |
| 5 | Uma lanterna acende e revela tudo a distância até 2. | S | mantém |
| 6 | Só se pode pôr peça em hexágono iluminado. | S | mantém |
| 7 | **[E]** Depois do sopro, uma Lanterna pode ir em terra vista mas não iluminada. | E | sai (sem sopro) |
| 8 | **[E]** Regra de socorro: sem terra vazia sob a luz, a Lanterna vai em terra vazia encostada na luz. | E | simplifica: vira a regra geral da Lanterna (cabe encostada na luz) |
| 9 | A "ponta marcada" é a terra mais longe do centro. | M | sai (era alvo de uma meta) |

## Achados

| # | Regra | Classe | Na B |
|---|---|---|---|
| 10 | Cada ilha esconde 6 achados: 2 Ruínas, 1 Cardume, 2 Pomares, 1 Nascente. | S | mantém |
| 11 | Achados nascem a pelo menos 4 do centro (3 se faltar lugar). | S | mantém |
| 12 | Cada tipo de achado tem um terreno próprio (Ruína em terra firme, Cardume na água junto à praia etc.). | S | mantém |
| 13 | Um achado é revelado quando a luz o alcança. | S | mantém |
| 14 | A Ruína revelada dá +3 moradores. | S | mantém |
| 15 | **[E]** Nenhuma peça pode ir num hexágono com achado. | E | simplifica: só vale depois de revelado (achado fica como está) |
| 16 | O Pomar revelado vale como um tipo para as casas vizinhas. | S | mantém |
| 17 | **[E]** O Pomar conta em dobro para a casa (tipo e +1 extra). | E | sai (conta uma vez) |
| 18 | A Nascente dá +1 comida por Campo vizinho. | S | simplifica: faz as casas a até 2 contarem Campo |
| 19 | O Cardume dá +2 de comida ao Cais vizinho. | S | simplifica: faz as casas a até 2 contarem Água |

## Turno, mão e baralho

| # | Regra | Classe | Na B |
|---|---|---|---|
| 20 | A partida tem 30 turnos. | S | mantém |
| 21 | Cada turno mostra 3 cartas; joga-se 1. | S | mantém |
| 22 | As 2 não jogadas voltam ao fundo do baralho. | S | mantém |
| 23 | O baralho tem 58 cartas em composição fixa (16 Casa, 10 Campo, 10 Oliveiral, 13 Lanterna, 9 Cais), embaralhado pela semente. | M | simplifica: 41 cartas (12/8/8/9/4) |
| 24 | **[E]** Mão garantida: se nenhuma das 3 cabe, a terceira troca com a primeira do baralho que caiba. | E | simplifica: refaz a mão inteira (regra geral, sem exceção por carta) |
| 25 | Se nada do baralho cabe, o turno fica travado (só é contado). | M | simplifica: a noite cai antes |
| 26 | Descartar uma carta dá +1 óleo e gasta o turno. | M | sai |

## Recursos

| # | Regra | Classe | Na B |
|---|---|---|---|
| 27 | Começa-se com 2 comida e 2 óleo. | M | sai |
| 28 | Cada Campo dá +1 comida por turno. | M | sai |
| 29 | Cada Cais dá +1 comida por turno. | M | sai |
| 30 | Cada Oliveiral dá +1 óleo por turno. | M | sai (vira Bosque, sem produção) |
| 31 | A Casa custa 5 comida. | M | sai |
| 32 | A Lanterna custa 4 óleo. | M | sai |

## Cartas

| # | Regra | Classe | Na B |
|---|---|---|---|
| 33 | Casa: em Prado, Bosque ou Praia. | S | simplifica: em qualquer terra iluminada |
| 34 | Campo: só em Prado. | S | simplifica: em qualquer terra iluminada |
| 35 | Oliveiral: em Prado ou Rocha. | M | sai (troca por Bosque) |
| 36 | Lanterna: em qualquer terra (iluminada). | S | mantém, também encostada na luz |
| 37 | Cais: em Praia junto da água. | S | mantém, em Praia iluminada |

## Moradores

| # | Regra | Classe | Na B |
|---|---|---|---|
| 38 | Moradores da casa = 1 + tipos diferentes encostados (Campo, Bosque, Água/Praia, Lanterna, Pomar), até 4. | S | mantém (é a regra central) |
| 39 | O Bosque conta só se for Bosque natural sem peça em cima. | S | simplifica: conta Bosque natural ou peça Bosque |
| 40 | A Praia ou Água conta como Água. | S | simplifica: Água ou Cais |
| 41 | A casa sobe de nível ao ser posto algo ao lado (recalculado sempre). | S | mantém, escrito na regra |

## Noite

| # | Regra | Classe | Na B |
|---|---|---|---|
| 42 | Há noites nos turnos 10, 20 e 30. | M | simplifica: uma noite, no fim |
| 43 | Cada lanterna queima 2 óleo por noite; sem óleo, apaga. | M | sai |
| 44 | **[E]** O Farol não queima óleo. | E | sai |
| 45 | Casa sem lanterna acesa encostada perde 1 morador por noite. | M | sai |
| 46 | Festa: cada 5 comida guardada vira +1 morador. | M | sai |
| 47 | **[E]** A festa tem teto de 14 moradores por noite. | E | sai |
| 48 | **[E]** Cada casa guarda no máximo 4 convidados da festa, e só se estiver ao lado de lanterna acesa. | E | sai |
| 49 | A festa zera o estoque de comida. | M | sai |

## Sopro do vento

| # | Regra | Classe | Na B |
|---|---|---|---|
| 50 | Há 1 sopro guardado; toque numa nuvem encostada na luz a dissolve num raio 1. | S | sai (a luz já revela; menos coisas para aprender) |
| 51 | O sopro não ilumina nem conta achado nas metas. | M | sai |
| 52 | O sopro recarrega a cada noite. | M | sai |

## Metas e pontuação

| # | Regra | Classe | Na B |
|---|---|---|---|
| 53 | Três metas por partida, sorteadas de 5 pela semente. | S | simplifica: 3 de 4 |
| 54 | Cada meta cumprida vale +5 pontos, conferida no fim. | S | mantém |
| 55 | Meta "Ponta marcada": lanterna na ponta. | M | sai |
| 56 | Meta "66 moradores". | M | sai (troca por Solar) |
| 57 | Meta "5 achados". | S | simplifica: 4 |
| 58 | Meta "Fileira de 4 casas retas". | M | sai (troca por Vila com praça) |
| 59 | Meta "80% da ilha iluminada". | S | simplifica: 70% |
| 60 | Pontuação = moradores + 5 por meta. | S | mantém |
| 61 | A partida pode ser refeita a partir da semente e das jogadas (replay). | S | mantém |

## Resumo

- Mantém: 20 regras. Simplifica: 16. Saem: 25. Exceções: 9 (itens 7, 8, 15, 17, 24, 44, 47, 48 e a regra de que a pontuação do sopro não ilumina, contada em 51), das quais nenhuma sobra na B.
- A B acrescenta uma só ideia, que a A não tem: a vila (3 casas encostadas) com marcos.
