# Ilha das Lanternas: especificação das regras (etapa 1)

Puzzle de cartas e névoa em hexágonos. Uma partida dura 30 turnos (10 a 15 minutos). Tudo vive em `src/core` (puro, determinístico, roda em Node). Os números vivem em `RULES` (`src/core/game.ts`); o motivo de cada um está em `docs/simulacao.md`.

## Mapa

- Hexágonos flat-top, coordenadas axiais (q, r), raio 7 (169 hexágonos). Anel externo sempre água.
- Gerado pela semente por ruído simples. Terrenos: Água, Praia (borda da terra), Prado, Bosque, Rocha. Só fica a terra ligada ao centro. Em média ~95 hexágonos de terra.
- O centro é sempre terra e tem o **Farol velho**, uma lanterna já acesa.
- **Ponta marcada:** o hexágono de terra mais distante do centro (desempate por menor q, depois r). Aparece marcado desde o início, mesmo na névoa.
- Sementes independentes (`subSeed`) para mapa, achados, baralho e metas: mudar um gerador não mexe nos outros.

## Névoa e luz

- **Revelado** = a distância <= 2 de uma lanterna acesa (o Farol conta). A revelação é permanente.
- Um hexágono pode receber peça se está revelado, é terra, está vazio e não tem achado.
- **Regra de socorro:** se a luz não tem mais nenhuma terra vazia, a Lanterna pode ser posta numa terra vazia da névoa encostada na luz.

## Achados escondidos (6 por ilha, gerador à parte)

Nascem a distância >= 4 do centro (relaxa até 3 se faltar lugar). Revelar = entrar na luz. Ocupam o hexágono (não recebem peça). O efeito só vale depois de revelado.

| Achado | Onde | Efeito |
|---|---|---|
| Ruína (2) | terra que não é praia | +3 moradores ao revelar |
| Cardume (1) | água junto de uma praia | Cais vizinho rende +2 comida por turno a mais |
| Pomar (2) | prado | Casa vizinha: +1 morador e conta como tipo na variedade |
| Nascente (1) | prado ou bosque | Campo vizinho rende +1 comida por turno |

## Turno

1. A mão tem as 3 cartas do topo do baralho. **Mão garantida:** se nenhuma cabe em lugar nenhum, a 3ª troca com a primeira carta do baralho que caiba (se nenhuma do baralho inteiro cabe, o turno conta como "travado").
2. O jogador escolhe 1 carta e a coloca num hexágono válido, **ou** descarta uma carta por +1 óleo (nunca trava). A carta escolhida sai de jogo; as outras 2 voltam ao fundo do baralho.
3. Fim do turno: entra a renda (comida e óleo de todos os produtores).
4. Se for turno 10, 20 ou 30: **noite** (abaixo).
5. Turno seguinte, até o 30.

Baralho: 58 cartas, embaralhado pela semente: Casa 16, Campo 10, Oliveiral 10, Lanterna 13, Cais 9. Começo: 2 óleo e 2 comida.

## Cartas

| Carta | Custo | Onde | Efeito |
|---|---|---|---|
| Casa | 5 comida | Prado, Bosque ou Praia | Moradores = 1 + tipos distintos vizinhos entre {Campo, Bosque, Água/Praia, Lanterna, Pomar}, +1 se há Pomar vizinho, no máximo 4 |
| Campo | 0 | Prado | +1 comida por turno (+1 por Nascente vizinha) |
| Oliveiral | 0 | Prado ou Rocha | +1 óleo por turno |
| Lanterna | 4 óleo | qualquer terra | acende com raio 2 e revela a névoa |
| Cais | 0 | Praia com água vizinha | +1 comida por turno (+2 com Cardume vizinho) |

"Bosque" como tipo conta só o hexágono de Bosque ainda sem construção. Os moradores de uma Casa mudam quando os vizinhos mudam.

## Noite (turnos 10, 20 e 30)

- Cada lanterna, exceto o Farol, queima 1 óleo, na ordem em que foi acesa. Sem óleo, apaga naquela noite.
- **Casa que não tem lanterna acesa encostada** (distância 1; o Farol vale) perde 1 morador, permanentemente (mínimo 0).
- A luz que revela a névoa (raio 2) é maior que a que protege à noite (raio 1): é por isso que as casas devem ficar junto de lanternas.

## Metas (3 por partida, sorteadas pela semente; +5 pontos cada, conferidas no fim)

| Meta | Condição |
|---|---|
| Ponta marcada | uma lanterna no hexágono da ponta |
| Moradores | 52 moradores |
| Achados | 5 achados revelados (de 6) |
| Fileira | 4 casas encostadas em linha reta |
| Ilha iluminada | 80% dos hexágonos de terra revelados |

**Pontuação final = moradores (casas + 3 por Ruína) + 5 por meta cumprida.**

## Mudanças em relação ao enunciado inicial

Raio de proteção da noite 1; lanternas queimam óleo à noite; Casa 5 comida (era 1); Lanterna 4 óleo (era 2); baralho de 58 cartas; regra de socorro da Lanterna; mão garantida; achados longe do centro e sempre 6; metas: 52 moradores, 5 achados (era 4), fileira de 4 (era 3), ilha 80% (era 60%). Detalhes e motivos em `docs/simulacao.md`.

## Código

- `src/core/hex.ts`, `rng.ts`, `map.ts` (ilha e achados), `game.ts` (regras, metas, `RULES`), `bots.ts` (aleatório, guloso, planejador).
- Bots decidem numa cópia cega do jogo (`Game.clone(true)`): não espiam achados sob a névoa.
- `tests/sim.ts`: 300 partidas por bot, critérios de aprovação, invariantes (determinismo, casa <= 4, recursos >= 0); grava o relatório em `docs/simulacao.md`.
- `src/main.ts` + `index.html`: protótipo three.js com formas simples. `?seed=` (inteiro de até 9 dígitos, validado).
