# Terra contínua: a regra (modo `terra`)

Modo "Terra contínua" (em "Mais modos", em teste): o Relevo (altura por peça, encostas, saias, costa redonda, fluido, águas que descem, nascentes escondidas) com a pontuação abaixo. A regra foi calibrada na bancada (`tests/bench/rules/terra.ts`, `npm run bench -- terra 100`) e levada ao núcleo em `src/core/terra.ts` + `Board`. O jogo e a bancada dão os mesmos pontos, jogada a jogada (`npm run terra:bancada`).

## A regra em uma frase

As emendas pagam pela continuidade da paisagem, cada mancha de terra paga de uma vez quando você a fecha (cercada, sem borda aberta; fechar é o contrário de casar) e a água que chega faz render as terras que a esperavam.

## Fórmulas

1. **Campo.** O terreno de cada borda é suavizado com o das duas bordas vizinhas da mesma peça (`smearComp`, λ de 0,08 a 0,30 pela semente da peça). Rio e trilho ficam puros e estritos.
2. **Emenda convexa.** Continuidade `s` (0 a 1, 3 amostras ao longo da borda); `x = max(0, (s−0,5)/0,5)`; paga `round(12·x³)`. Perfeito (todas as emendas com `s ≥ 0,8`, 2 ou mais vizinhas): +28. Cerco da peça (6 vizinhas, todas `s ≥ 0,8`): +30 e 1 peça. Interação entre terrenos: +5 só onde `s < 0,55`.
3. **Mancha.** Área `a` em peças (cunhas ÷ 6), perímetro `P`, `forma = 0,55 + 0,45·min(1, 6√a/P)`.
   - Crescimento: `1,5·a^1,8·forma`, só o aumento sobre a maior marca já alcançada.
   - Fechamento (sem borda virada para o vazio, `a ≥ 1`): `min(200, 20·a^1,5·forma)` por mancha, uma vez, e 1 peça de volta.
4. **Água e altura.** As do Relevo, inteiras: altura por peça (`tileProfile`; a altura da borda também precisa encaixar), degrau +2 e cachoeira +3 (no Relevo, 3 e 5), 8 por peça com água corrente, 60 e 2 peças por curso que chega ao mar, nascentes escondidas (4, +30). A água pontuada é a desenhada.
5. **Umidade.** A do Orvalho (+8 na faixa, +11 no meio), mas só rende às peças que já estavam lá quando a água (ou a mata) chega; a peça nova não recebe a própria.

## Decisões da Fase 2 (feitas sozinhas)

- **Correção (revisão):** a primeira versão usava a altura do MUNDO na água (como a bancada A2) e, sem relevo por peça, o jogo saía com placas retas, paredes e costa em hexágono. Agora o modo liga `Rules.relief`, e a bancada ganhou o botão `reliefH` (1 = altura por peça, o padrão).
- **Calibração com a altura por peça** (100 partidas, contra Relevo base): com `matchPoints` 14 a média subia +11% e a profundidade caía para +10,4%. Ficou `matchPoints` 12, degrau 2 e cachoeira 3: guloso −2% / −5% / −4% (média, p10, p90), planejador 0% / +6% / −2%, folga 73%, profundidade +13,7% (Relevo base +11,4%), travadas 0%. As 4 metas passam. Alternativa testada: `matchPoints` 11 com degrau 3/5 (folga 71,6%, abaixo de 72).
- **Maravilha:** fica desligada, como no Relevo (o canteiro pede o meio da peça plano).
- **Nascentes escondidas:** ligadas, como no Relevo; a bancada não as tem, então a prova bancada × jogo roda com elas desligadas.
- **Camadas de progressão:** missões, eras, sítios e cartas do jogo mantidos. A comparação com a bancada roda sobre o encaixe puro (`baseRules()`).
- **SAVE_VERSION:** fica em 13. 210 partidas gulosas (7 modos antigos × 5 temas × 6 sementes) dão exatamente os mesmos placares, pilhas e pontos jogada a jogada antes e depois da mudança (`hash` conferido contra `origin/dorf/relevo-base`). Os campos novos de `Rules` nascem desligados. Mudar a regra do `terra` depois muda o replay das partidas dele e pede `SAVE_VERSION` novo.
- **Teto do fechamento (cauda alta):** 1.000 partidas do guloso (bancada) sem teto: pontos por jogada p50 36, p99 159, p99,9 392, máximo 918 (25× a mediana; 27% do placar da partida). Com o teto de 200 por mancha: p99 160, p99,9 237, máximo 373 (10×). Custo: 1,2% dos pontos. Refeito com a altura por peça (1.000 partidas): sem teto o máximo é 824 (26× a mediana de 32); com teto 200, 420 (13×), p99,9 236. O teto continua fazendo sentido. Botão: `Rules.terraCloseCap`.
- **Abuso da peça de volta:** sem limite. Um jogador que escolhe a cada jogada a que mais devolve peças termina, com a altura por peça (300 partidas), com 64,7 peças em média (guloso 63,4), máximo 95, 14,7 peças devolvidas por partida (máximo 45). Com olhada na peça seguinte (67 partidas, medido antes da correção): 68,3 peças e 41% menos pontos: não compensa. Os botões `terraBackMin` (área mínima da mancha que devolve peça) e `terraBackCap` (teto de peças devolvidas por partida) existem, desligados, para o caso de a partida crescer em mãos humanas.
- **Desempenho (300 peças):** `patchField` 0,27 ms; prévia de uma jogada 1,40 ms (Clássico 0,51, Relevo 0,91); `rankMoves(5)` 635 ms (Clássico 202, Relevo 314) e ~45 ms com 60 peças (partida típica de ~63 peças). Cada chamada fica abaixo dos 2 ms, mas o "Onde encaixa" com 300 peças trava quase um segundo: cache incremental das manchas fica como pendência da Fase 3. O que pesava era o `clone()` recalcular campo e nível de cada peça: ele agora copia o que sai só da semente (`placeRaw(..., from)`).

## Conferências

- `tests/logic.ts`: 60 partidas do modo (5 temas, 4 políticas, o jogo inteiro por cima) contra um oráculo escrito do zero: campo, continuidade por amostras, manchas por busca em largura, umidade pela distância à água, peça de volta, teto, água com `levelAt`.
- `tests/synthetic.ts` (cenário 14): fechar manchas de 1 (20 pontos), 3 (98) e 7 peças (351, 200 com o teto), a peça de volta com área mínima e teto por partida, umidade que chega a duas peças antigas e não à nova.
- `tests/terra-bancada.ts`: 100 partidas, 6.231 jogadas, 60.157 candidatas, com a altura por peça: diferença zero em todos os termos (também entra no `npm test` com 16 partidas).
- Equilíbrio na bancada: `npm run bench -- terra 100` (padrões = o modo). No jogo inteiro (`npm run balance -- 40`, guloso): Terra 4.095, Relevo 5.346, Clássico 4.492; os jogadores do painel não miram manchas, então é piso, não medida.

## Fase 3: o fantasma que mostra a paisagem, e o "Onde encaixa" rápido

**O que o fantasma mostra (só no modo `terra`).** Tudo sai da REGRA, não do campo suavizado do desenho: `patchViews` (`src/core/terra.ts`) devolve, para a jogada candidata, cada mancha que a peça toca já com a peça incluída (área, área de antes, quantas manchas uniu, se fecha) e o contorno dela em trechos (lado da casa ou raio do centro ao canto, aberto ou parede). `Game.terraView(q, r)` junta isso com a umidade que sobe (as terras antigas cuja faixa de umidade melhora). Não muda a pontuação: roda numa cópia.
- **Contorno** da mancha a que a peça se junta, de cada terreno que ela toca; mais forte quando a peça junta duas manchas ou mais (0,95), depois quando cresce uma mancha antiga (0,7). A mancha só dos setores da própria peça (sem emenda e sem fechar) não aparece.
- **Bordas abertas** (trechos que dão para o vazio) pulsam devagar (ciclo de ~3 s): é o que falta para fechar.
- **Fechamento:** a mancha que a jogada fecha ganha um laço dourado firme (a etiqueta diz "fecha").
- **Água:** as terras antigas que a umidade da jogada melhora esverdeiam de leve (disco suave verde com respiração lenta).
- **Etiqueta:** só o total da jogada e " · fecha". Os termos (emendas, mancha, umidade) deixaram de aparecer; o "Como jogar" do modo explica o desenho.
- **Técnica:** UMA malha de fitas (um draw call, `src/render/landTrace.ts`) que acompanha o chão (altura lida do mapa do chão, já no espaço do desenho fluido, com o fantasma estampado), com material em TSL (`U.time`); os trechos são ligados em fileiras e arredondados (Chaikin), então o contorno não lê como grade de hexágonos. Mais um `InstancedMesh` de discos para a umidade. A malha é refeita só depois que o fantasma para na casa (`World.GHOST_SETTLE_MS`, 120 ms), nunca a cada quadro.
- **No pouso que fecha** (`World.placeFx`, então o vídeo também mostra): depois da queda (0,5 s), o laço dourado corre pelo contorno (0,9 volta por segundo, com rastro) e some; o chão respira com a onda de `ripple`; uma peça sobe da mancha e voa até o canto da tela onde fica a pilha. Tudo pelo `dt` do mundo.

**Cache incremental das manchas.** `PatchCache` (`terra.ts`) mantém a união-busca por (peça, setor) com massa, bordas expostas e bordas para o vazio por raiz; `add` custa O(1) por peça e `read` só varre as raízes, na mesma ordem do `patchField` (que fica como referência e para a medida). O `Board` guarda um (`patches`) e a cópia da prévia herda o dele. Junto: `Board.clone()` copia as peças, o mapa, a fronteira e os grupos em vez de repor peça por peça, e `place` estende os grupos (`extendGroups`) em vez de refazê-los. O placar e o replay são os mesmos (bancada × jogo, oráculo de `tests/logic.ts` e `tests/terra-view.ts`).

| 300 peças, ms por chamada | antes | depois |
|---|---|---|
| `rankMoves(5)` Terra | 617 | 177 |
| `rankMoves(5)` Relevo | 315 | 101 |
| `rankMoves(5)` Clássico | 176 | 37 |
| prévia de uma jogada, Terra | 1,42 | 0,41 |
| `clone()` Terra | 0,61 | 0,17 |

**Conferências novas** (`tests/terra-view.ts`, `npm run terra:view`): cache incremental × `patchField` refeito (a cada jogada e em cada candidata), mancha da vista (área, bordas abertas, fecha) × busca em largura escrita no teste, candidatas que não mexem no tabuleiro de verdade, prévia × jogada, `closedViews` × manchas fechadas e umidade da vista × umidade da jogada.
