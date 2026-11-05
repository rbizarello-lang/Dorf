# Terra contínua: a regra (modo `terra`)

Modo "Terra contínua" (em "Mais modos", em teste). A regra foi calibrada na bancada (`tests/bench/rules/terra.ts`, `npm run bench -- terra 100`) e levada ao núcleo em `src/core/terra.ts` + `Board`. O jogo e a bancada dão os mesmos pontos, jogada a jogada (`npm run terra:bancada`).

## A regra em uma frase

As emendas pagam pela continuidade da paisagem, cada mancha de terra paga de uma vez quando você a fecha (cercada, sem borda aberta; fechar é o contrário de casar) e a água que chega faz render as terras que a esperavam.

## Fórmulas

1. **Campo.** O terreno de cada borda é suavizado com o das duas bordas vizinhas da mesma peça (`smearComp`, λ de 0,08 a 0,30 pela semente da peça). Rio e trilho ficam puros e estritos.
2. **Emenda convexa.** Continuidade `s` (0 a 1, 3 amostras ao longo da borda); `x = max(0, (s−0,5)/0,5)`; paga `round(14·x³)`. Perfeito (todas as emendas com `s ≥ 0,8`, 2 ou mais vizinhas): +28. Cerco da peça (6 vizinhas, todas `s ≥ 0,8`): +30 e 1 peça. Interação entre terrenos: +5 só onde `s < 0,55`.
3. **Mancha.** Área `a` em peças (cunhas ÷ 6), perímetro `P`, `forma = 0,55 + 0,45·min(1, 6√a/P)`.
   - Crescimento: `1,5·a^1,8·forma`, só o aumento sobre a maior marca já alcançada.
   - Fechamento (sem borda virada para o vazio, `a ≥ 1`): `min(200, 20·a^1,5·forma)` por mancha, uma vez, e 1 peça de volta.
4. **Água.** A do Relevo (`water.ts`), com a altura do mundo (`levelAt`) em vez da altura por peça: 8 por peça com água corrente; 60 e 2 peças por curso que chega ao mar. Sem degraus, cachoeiras nem nascentes escondidas.
5. **Umidade.** A do Orvalho (+8 na faixa, +11 no meio), mas só rende às peças que já estavam lá quando a água (ou a mata) chega; a peça nova não recebe a própria.

## Decisões da Fase 2 (feitas sozinhas)

- **Altura:** o modo não liga `Rules.relief` (nada de altura por peça nem degraus): a bancada calibrou com a altura do mundo. A partida usa os platôs da semente (`Theme.relief.levels`) e o encaixe fluido ligado (`World.setPieceRelief(..., fluid)`).
- **Camadas de progressão:** o modo mantém missões, eras, sítios e cartas do jogo (sem maravilha, como o Relevo). A comparação com a bancada roda sobre o encaixe puro (`baseRules()`).
- **Nascentes escondidas:** desligadas (a bancada não as tem).
- **SAVE_VERSION:** fica em 13. 210 partidas gulosas (7 modos antigos × 5 temas × 6 sementes) dão exatamente os mesmos placares, pilhas e pontos jogada a jogada antes e depois da mudança (`hash` conferido contra `origin/dorf/relevo-base`). Os campos novos de `Rules` nascem desligados. Mudar a regra do `terra` depois muda o replay das partidas dele e pede `SAVE_VERSION` novo.
- **Teto do fechamento (cauda alta):** 1.000 partidas do guloso (bancada) sem teto: pontos por jogada p50 36, p99 159, p99,9 392, máximo 918 (25× a mediana; 27% do placar da partida). Com o teto de 200 por mancha: p99 160, p99,9 237, máximo 373 (10×). Custo: 1,2% dos pontos; guloso −2% / −1% / −4% (média, p10, p90) contra o Relevo base, planejador −1% / +4% / −3%, folga 78%, profundidade +13,2% (sem teto +14,2%; Relevo base +11,4%). Botão: `Rules.terraCloseCap`.
- **Abuso da peça de volta:** sem limite. Um jogador que escolhe a cada jogada a que mais devolve peças (1.000 partidas) termina com 63,0 peças em média (guloso 61,8), máximo 89, 13 peças devolvidas por partida (máximo 39). Com olhada na peça seguinte (67 partidas): 68,3 peças, máximo 81, e 41% menos pontos (1.548 contra 2.634): não compensa. Os botões `terraBackMin` (área mínima da mancha que devolve peça) e `terraBackCap` (teto de peças devolvidas por partida) existem, desligados, para o caso de a partida crescer em mãos humanas.
- **Desempenho (300 peças):** `patchField` 0,25 ms; prévia de uma jogada 1,35 ms (Clássico 0,43, Relevo 0,79); `rankMoves(5)` 678 ms (Clássico 170, Relevo 289) e 43 ms com 60 peças. Abaixo dos 2 ms por chamada, então sem cache incremental. O que pesava era o `clone()` recalcular campo e nível de cada peça: ele agora copia o que sai só da semente (`placeRaw(..., from)`).

## Conferências

- `tests/logic.ts`: 60 partidas do modo (5 temas, 4 políticas, o jogo inteiro por cima) contra um oráculo escrito do zero: campo, continuidade por amostras, manchas por busca em largura, umidade pela distância à água, peça de volta, teto, água com `levelAt`.
- `tests/synthetic.ts` (cenário 14): fechar manchas de 1 (20 pontos), 3 (98) e 7 peças (351, 200 com o teto), a peça de volta com área mínima e teto por partida, umidade que chega a duas peças antigas e não à nova.
- `tests/terra-bancada.ts`: 100 partidas, 6.100 jogadas, 69.330 candidatas: diferença zero em todos os termos (também entra no `npm test` com 16 partidas).
- Equilíbrio na bancada: `npm run bench -- terra 100` (padrões = o modo). No jogo inteiro (`npm run balance -- 40`, guloso): Terra 4.258, Relevo 5.346, Clássico 4.492; os jogadores do painel não miram manchas, então é piso, não medida.

## Fica para a Fase 3

O fantasma que mostra a paisagem (contorno da mancha, laço que fecha, umidade que esverdeia). Hoje só há a legenda de pontos na etiqueta ("emendas 28 · perfeito 28 · mancha 7 · fecha +98 +1 peça · umidade 11") e o aviso "Mancha fechada +N · +1 peça".
