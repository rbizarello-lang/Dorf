# E1: variações próximas do encaixe

Ponto de partida: 6 bordas, borda igual pontua 10, rio e trilho só encostam neles mesmos, bordas diferentes de terreno comum nunca travam, e 4 pares "conversam" (synergy, +5). As ideias abaixo mudam pouco essa regra e saem da paisagem (estação, rio, trilho, borda esperando, vizinhança), nunca de uma camada solta sobre o mapa. Nenhuma obriga jogada: só premia ou afrouxa.

Achado geral: o guloso NUNCA ficou travado no Clássico (0 descartes em 80 partidas, nem com rio 30% e trilho 20%). Risco de travar a pilha só existe em ideia que ENDUREÇA a validade; nenhuma aqui endurece.

## As 7 ideias

### 1. Vau e ponte (rio×trilho)  [P]
- Como funciona: rio e trilho passam a poder se encostar, e o encontro vira uma ponte (+8 por borda). Rio com rio e trilho com trilho seguem como antes; rio ou trilho contra terreno comum continua proibido.
- O jogador sente: "esse trilho que não tinha onde ir agora cruza o rio". Menos peça morta, mais gosto de desenhar a paisagem.
- Difere do Dorfromantik: pouco, mas o original proíbe esse par; aqui vira cena.
- Na tela: ponte de pedra, madeira ou ferro sobre a água, no meio da borda, com o kit `bridge` que cada tema já tem. Lê de longe como linha que cruza o rio.
- Em `src/core`: `check` aceita Water×Rail; `Rules.bridgePoints` (0 = desligado); `PlaceResult.bridges`. Grupos: trilho não se une ao rio.
- Trava: só diminui. Equilíbrio: +25 pontos por partida, quase nada.

### 2. A estação decide o encaixe  [P]
- Como funciona: a interação da estação (primavera colmeias, verão moinho, outono serraria, inverno pasto) passa a contar como ENCAIXE de verdade: vale 10 e conta para o perfeito, o cerco e as missões. As outras interações continuam em 5.
- O jogador sente: o mesmo mapa muda de leitura a cada 20 jogadas. Em abril a vila junto da floresta é só contraste; em outubro é o melhor encontro. Olha-se a estação antes de girar a peça.
- Difere: bastante. No original o encaixe é fixo; aqui é uma pergunta nova a cada estação.
- Na tela: a borda ganha o sinal da estação (flor, espiga, folha seca, geada) no lugar do pontilhado de interação. A construção da interação já existe (`tileBuilder`, `specialsFor`).
- Em `src/core`: `check`/`place` tratam `synergyOf(a,b) === SEASON_KIND[seasonAt(idx)]` como igual (`edgeState` 1, `matches++`); `isClosedPerfect` e o union-find das missões, idem. `SAVE_VERSION` sobe; o oráculo de `tests/logic.ts` ganha a estação.
- Casa com o tema: Inverno Nórdico fica em inverno, Terraços do Oriente em primavera, Egito em verão. Cada um ganha um encaixe "de casa" fixo, sem `if (theme.id)`: é o `seasonLock` que já existe.
- Trava: nenhuma (só afrouxa). Equilíbrio: baixo, ver a simulação.

### 3. Visada a 2 casas  [M]
- Como funciona: se a sua borda mostra o mesmo terreno que a borda da peça do OUTRO lado de uma peça no meio (a 2 casas, em linha reta), uma visada liga as duas: +4. O meio não pode ter o mesmo terreno (senão já pontua).
- O jogador sente: olha por cima da vizinha e procura corredores de floresta e plantação por entre as vilas.
- Difere: moderado (o original só olha o vizinho direto).
- Na tela: sebe, fileira de árvores ou trilha de pedras que cruza a peça do meio (sebe holandesa, palmeiras no Egito, lanternas no Oriente). Linhas, fáceis de ler de longe.
- Em `src/core`: 6 raios no `check`; `Rules.sightPoints`; `PlaceResult.sights` (o render desenha). Pilha intacta.
- Trava: nenhuma. Equilíbrio: fraco (+43 pontos/partida); quase não aparece.

### 4. Meia-borda (borda partida)  [G]
- Como funciona: umas 25% das bordas de terreno comum vêm partidas (metade prado, metade floresta, pela semente da peça). A borda encaixa se QUALQUER metade combina com a metade vizinha: 7 pontos, e conta para o perfeito.
- O jogador sente: transições suaves ("a mata vira prado devagar"), mas leitura mais carregada.
- Difere: bastante; é um gradiente de verdade entre terrenos.
- Na tela: a borda mostra dois terrenos lado a lado e o chão faz a transição (o `groundMap` já mistura cor). Custo de arte alto: `buildTile` com 12 meias-bordas.
- Em `src/core`: `TileDef.halves` derivado da `seed` (sequência intacta); `check`, `place`, `isClosedPerfect`, grupos e todos os oráculos. Grupos de missão ficam ambíguos.
- Trava: nenhuma. Equilíbrio: médio (grupos, missões). Pior custo/benefício.

### 5. Mosaico de fronteiras (synergy protagonista)  [P]
- Como funciona: os dois pares que faltam (floresta×prado "clareira", floresta×plantação "pomar") também conversam; toda interação sobe de 5 para 8; peça com 2 ou mais interações ganha +6 ("fronteira dupla").
- O jogador sente: o contraste deixa de ser erro e vira jogada; o ponto onde 3 terrenos se tocam fica gostoso.
- Difere: moderado, e ainda é "pontuar borda diferente". Perde a tensão "igual vale mais", pois todo par rende.
- Na tela: 2 construções novas por tema (cabana de clareira, pomar): são 6 em vez de 4.
- Em `src/core`: `synergy.ts` (`SynKind`, `SYN_KINDS`, `synergyOf`), `INFLUENCE`, oráculo `SYN_PAIRS`, legenda, missões de interação. `SAVE_VERSION` sobe.
- Trava: nenhuma. Equilíbrio: +383 pontos/partida; sobe o piso (p10 +15%) e achata o alto.

### 6. A espera rende (a borda que cresce)  [M]
- Como funciona: uma borda aberta amadurece. Quando você a fecha com um encaixe, ganha +1 a cada 12 jogadas de espera, até +3 por borda.
- O jogador sente: paciência premiada. Em vez de fechar tudo na hora, deixa uma baía de mata crescer e fecha depois. Calmo.
- Difere: bastante; é um relógio por borda, que o original não tem.
- Na tela: a borda virada para o vazio ganha broto, depois mudas, depois árvores altas ou espigas cheias (3 fases). A idade sai do índice da peça, sem estado novo. De longe lê como "bordas velhas mais viçosas".
- Em `src/core`: `check`/`place` somam `min(3, floor((idx - vizinha.index)/12))` por encaixe; `Rules.ripenEvery`. É função do índice: o replay não guarda nada.
- Trava: nenhuma. Equilíbrio: o mais forte (+11% na média, +15% no p90 do atento); precisa de teto 2 e de teste do incentivo a deixar buracos (o cerco devolve peça).

### 7. Sucessão do miolo (terreno que se transforma ao ser cercado)  [M]
- Como funciona: a peça cercada pelas 6 vizinhas encaixadas "amadurece" e o miolo vira o terreno dominante dela; ganha pontos pelo tamanho do grupo desse terreno (teto 12), além do bônus de cerco que já existe.
- O jogador sente: ver o miolo virar bosque ou praça é recompensa visual e dá vontade de cercar um grupo grande.
- Difere: pouco; é mais um bônus de cerco.
- Na tela: o centro da peça cercada muda (prado vira clareira com flores, floresta vira mata fechada, vila ganha praça). Bonito, mas só se vê de perto.
- Em `src/core`: `place`, quando `closed`, soma pontos de grupo. Não depende de giro.
- Trava: nenhuma. Equilíbrio: fraco (+107 pontos), quase invisível se ninguém cerca de propósito.

## Simulação rápida
Script (sem commit, só `src/core`): `/home/user/Dorf/.claude/worktrees/agent-a94fbccb8095f9645/tests/.sim-encaixe.ts`. Rodar: `npx rolldown tests/.sim-encaixe.ts --file .cache/sim-encaixe.mjs --format esm --platform node && node .cache/sim-encaixe.mjs 80` (variáveis `IDS`, `RULES`, `LOCK`, `NOPERFECT`).
Como: 80 partidas (sementes 1 a 80), regras padrão, guloso que escolhe pelo valor da jogada de agora. A regra entra como pontos extras (ou validade diferente, na ponte) sobre o `Game`/`Board` reais. "Atento" soma o extra da regra à nota; "distraído" a ignora.

| Ideia | Jogador | Média | p10 | p90 | Pts da regra | Travadas | Peças |
|---|---|---|---|---|---|---|---|
| Clássico (base) | guloso | 5063 | 2796 | 7631 | 0 | 0 | 102 |
| 1 Vau e ponte | atento | 5368 | 2884 | 8343 | 25 | 0 | 105 |
| 1 Vau e ponte | distraído | 5122 | 2897 | 7400 | 9 | 0 | 102 |
| 2 Estação, com perfeito sazonal* | atento | 4837 | 3186 | 6402 | 935 | 0 | 90 |
| 2 Estação, sem perfeito sazonal | atento | 5121 | 2925 | 7657 | 90 | 0 | 101 |
| 2 Estação, sem perfeito sazonal | distraído | 5148 | 2861 | 7698 | 41 | 0 | 102 |
| 3 Visada | atento | 5210 | 2865 | 7316 | 43 | 0 | 103 |
| 4 Meia-borda | atento | 4987 | 2953 | 6679 | 692 | 0 | 95 |
| 5 Mosaico | atento | 5412 | 3226 | 7504 | 383 | 0 | 103 |
| 6 A espera rende | atento | 5646 | 2923 | 8769 | 189 | 0 | 107 |
| 7 Sucessão | atento | 5203 | 2826 | 7817 | 107 | 0 | 102 |

Extras medidos:
- Estação com a estação travada (`seasonLock`), atento, com o perfeito sazonal: primavera 4543, verão 4572, outono 4566, inverno 4708 (base 5058 a 5063 em cada uma).
- Mundo molhado (rio 30%, trilho 20%): Clássico 4351 (p10 2548, p90 6665); Vau e ponte atento 4625 (p10 2705, p90 6875); 0 travadas nos dois.

Leitura:
- Todas as "travadas" dão 0, inclusive no mundo molhado: a ponte não resolve problema real de pilha. O valor dela é a cena (rio e trilho se cruzando), não o equilíbrio.
- *O perfeito sazonal derrubou as peças jogadas (102 para 90) porque, na simulação, paga +20 mas NÃO conta como encaixe para cerco e missões, que devolvem peças; o guloso troca peça por ponto. Na implementação real a borda sazonal é encaixe de verdade, então a linha "sem perfeito sazonal" é a leitura realista: média +1%, p10 +5%, sem travar. Mesmo assim, o perfeito sazonal precisa de olhar no `npm run balance` real.
- Limites: o guloso olha uma jogada e não persegue missões. Os números dizem se o equilíbrio explode, não se é divertido. A estação travada não foi rodada sem o perfeito sazonal.

## Ranking e recomendação
1. **Estação decide o encaixe (2)**: a mais "nossa". Já temos estações, construções e `seasonLock` por tema, então Inverno Nórdico, Terraços do Oriente e Egito ganham um encaixe de casa sem código por tema. Muda a pergunta do jogador sem mudar o resto; P no `core`; equilíbrio neutro na simulação.
2. **Vau e ponte (1)**: segunda melhor; P, usa o kit `bridge` que já existe, e o rio cruzado pelo trilho é a cena mais bonita de longe. Pode vir logo depois.
3. A espera rende (6): a mais original no sentimento; pede teto 2 e teste dos buracos.
4. Mosaico (5), Visada (3), Sucessão (7): pequenos ou fracos. Meia-borda (4): G e o pior custo.

Recomendação: Estação decide o encaixe, depois Vau e ponte. A primeira pede `SAVE_VERSION` novo e o oráculo atualizado.
