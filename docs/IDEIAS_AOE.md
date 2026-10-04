# Ideias de Age of Empires para o Retalhos

Pesquisa de inspiração (visual e mecânica) na série Age of Empires · 01/10/2026 · PT-BR

> Pedido do dono do projeto: "beba de Age of Empires. Pinçe de lá visual, ideias. Eu sei que são jogos completamente diferentes, mas a ideia aqui é explorar."

**Nota de método.** O WebFetch continua bloqueado pelo proxy de saída: o wiki do fandom e a Wikipedia recusam a conexão. Por isso, toda a evidência sobre a série vem de resumos do WebSearch, e as páginas estão listadas em [Fontes](#8-fontes). Usei três marcas:

- **[C]**: conhecimento geral que esta pesquisa não confirmou.
- **[M]**: medido neste repositório com scripts locais, fora do repositório. Foram 400 partidas jogadas pela IA gulosa (`Game.bestMove`) e o contraste CIELAB entre as cores de `src/themes`.
- **Custo**: P é até 1 dia, M de 2 a 5 dias e G de 1 a 3 semanas, para quem já conhece o código, contando testes e capturas.

**Tipo** indica se a proposta é visual, mecânica ou ambos.

## Andamento (04/10/2026)

| Proposta | Estado |
|---|---|
| 1 Avanço de eras | feita (#12) |
| 2 Arquitetura por era | feita (#38) |
| 3 Escolha na virada de era | feita (#39) |
| 4 Andaimes | feita (#13) |
| 5 Legibilidade | feita (#16) |
| 6 Bônus por tema | já existia |
| 7 Influência das construções | feita (#40, save v9) |
| 8 Aldeões | feita (#18) |
| 9 Paisagem trabalhada | feita (#41) |
| 10 Pesca e cardumes | feita (#42) |
| 11 e 12 Sítios e terra incógnita | feitas (#21) |
| 13 Maravilha | feita (#24) |
| 14 Rotas de comércio | feita (visual no clássico; regra completa no modo Estrada Real) |
| 15 Cor da casa, estandartes, brasão e monumentos | feita (#23; monumentos) |
| 16 Minimapa e linha do tempo | feita (#44) |
| 17 Interface por tema | feita |
| 18 Som por era | feita (18a #22; 18b/c #34) |
| 19 Atmosferas, fogo e estações | **a fazer** |
| 20 Almanaque | feita (#33) |

Próximo passo, na ordem do documento: 19. Um PR por proposta, saindo do `main`, com `npm run check` e `npm run smoke` antes do commit.

## Resumo

- **O que trazer do AoE.** Nem a guerra nem a economia de quatro recursos. Valem quatro coisas:
  - **progresso que se vê**: a vila muda de cara a cada era;
  - **identidade**: arquitetura própria e uma regra curta para cada civilização;
  - **economia à vista**: aldeões, recursos e carroças no mapa;
  - **descoberta**: ruínas, relíquias e tesouros no desconhecido.
- **Proposta central: eras da vila.** São quatro eras (I a IV), com nomes por tema, que avançam por pontuação: 500, 1.500 e 3.000 pontos. Cada avanço:
  - muda o **Centro**, uma construção nova na peça inicial;
  - ergue um **marco da era**;
  - dá +3 peças.

  Com a IA gulosa, a partida mediana chega à Era III, e as boas chegam à IV [M].
- **As cinco primeiras, por impacto e esforço:**
  1. eras com Centro (M);
  2. andaimes (P);
  3. bônus de civilização por tema (P–M);
  4. legibilidade no estilo do AoE IV, com teste automático (P);
  5. aldeões trabalhando (M).
- **Duas medições mudam prioridades:**
  - No Inverno Nórdico, 100% dos telhados têm ΔE < 15 contra o chão da vila e somem de longe [M].
  - As redes de rio e trilho são curtas (mediana de 1 peça). Por isso, rota comercial só rende num modo próprio [M].
- **Restrições respeitadas.** Tudo cabe nas regras do projeto:
  - geometria procedural;
  - tema como dado;
  - núcleo puro e determinístico;
  - efeitos como nós TSL no pipeline WebGPU que está entrando agora;
  - um único arquivo HTML.

---

## 1. O que torna Age of Empires marcante

**A era se vê.** No AoE II, os prédios comuns têm o mesmo visual na Idade das Trevas. A partir da Feudal, cada civilização assume um dos 13 conjuntos de arquitetura regionais (56 civilizações na contagem atual do wiki). Os prédios mudam de novo na Idade dos Castelos, e o Centro da Cidade, o Mercado e a Universidade mudam uma última vez na Imperial. Já fazendas, armadilhas de peixe e paliçadas são iguais em todas as eras e civilizações.

O AoE IV vai além. O diretor de arte trata os prédios como "personagens", que saem do pau-a-pique com palha na Idade das Trevas para algo "completamente diferente" na Imperial. Os aldeões ingleses falam inglês antigo no começo e chegam ao inglês moderno inicial no fim. A trilha começa esparsa e escura, ganha cordas na terceira era e orquestra completa depois. Para os japoneses, o koto é afinado mais grave na primeira era, e shakuhachi e shamisen entram nas seguintes.

O momento de maior prazer da série é ver a cidade inteira "trocar de roupa".

**Avançar é escolher.** Três jogos chegaram ao mesmo padrão por caminhos diferentes:

- **AoE III:** cada avanço oferece "políticos". O Naturalista traz 4 vacas; o General, 12 mosqueteiros e um canhão.
- **Age of Mythology:** cada era oferece 2 deuses menores, com tecnologias e poderes diferentes.
- **AoE IV:** cada era oferece 2 marcos (*landmarks*) com bônus diferentes, e a era só avança quando o marco fica pronto. O AoE II também exige construir dois prédios da era atual antes de avançar.

É uma decisão rara, binária e cheia de sabor.

**A civilização é uma regra curta, muitas vezes de vizinhança.** Exemplos:

- **Poloneses (AoE II):** recolhem 10% da comida das fazendas novas construídas em volta do Folwark.
- **Gurjaras:** guardam ovelhas dentro do moinho e recebem comida aos poucos, com retorno decrescente.
- **Ingleses (AoE IV):** fazendas a até 2 tiles do moinho rendem 15%, 20%, 25% e 30% a mais, conforme a era.
- **Rus:** ganham ouro pelas árvores num raio de 5 tiles da cabana de caça, também com retorno decrescente.
- **Malianos:** a mina rende +25% por casa ou acampamento de mineração por perto.
- **Bizantinos:** cisternas ligadas por aquedutos ampliam a aura de coleta (de +10% a +26%).
- **Abássidas:** prédios em volta da Casa da Sabedoria sobem os níveis da Idade de Ouro.

Influência e adjacência são a língua natural de um jogo de peças.

**A economia se vê no mapa.** Recursos são objetos:

- arbustos de frutas (125 de comida cada);
- peixes da margem (200);
- árvores avulsas (125 de madeira);
- veios de ouro e de pedra;
- cervos, javalis e ovelhas.

O aldeão do AoE II muda de aparência conforme a tarefa: lenhador, fazendeiro, pescador, coletor, mineiro, pastor ou construtor.

O comércio também paga pela distância:

- No AoE II, a carroça rende ouro quase pelo quadrado da distância entre mercados: `0,46 · d · (d / tamanho do mapa + 0,3)`.
- No AoE III, a rota é um traçado fixo, com postos que ganham XP ou recursos quando a caravana passa.
- No AoE IV, mercadores rendem mais quanto mais longe está o posto de troca.

Relíquias na igreja do AoE II pingam 30 de ouro por minuto.

**Legibilidade acima do realismo.** No AoE IV, a direção de arte pôs "legibilidade e jogabilidade no topo da lista". A arte é estilizada para ler de longe e de perto, com armas maiores, cores mais destacadas do ambiente e identificação por telhados, estandartes e símbolos que casam com o HUD. Um exemplo pequeno e revelador: as ovelhas brancas foram tiradas dos biomas de neve.

O AoE II usa 8 cores de jogador em roupas e bandeiras. Seu minimapa mostra:

- o inexplorado em preto;
- a névoa mais escura;
- a área visível mais clara;
- um contorno branco onde a câmera está.

**O desconhecido tem tesouro.** Cada jogo põe algo a descobrir no mapa:

- **AoE I:** cinco artefatos e as ruínas dão vitória a quem os segura.
- **AoE II:** relíquias.
- **AoE III:** tesouros guardados por animais pagam recursos, XP ou unidades.
- **AoE IV:** sítios sagrados rendem 100 de ouro por minuto.

As maravilhas são prédios reais (Hagia Sophia, Catedral de Chartres, Tōdai-ji), com contagem regressiva para vencer: 200 anos no AoE II e 15 minutos no AoE IV.

**Presença, luz e história.** Cada jogo trouxe algo:

- **AoE III:** iluminação HDR e bloom "de sonho", com física de destruição.
- **AoE IV:**
  - 20 biomas fixos, além de biomas sazonais em eventos (Inverno, Hallow's Hearth, Enchanted Grove);
  - atmosferas com ângulo do sol, névoa e vento;
  - tochas e fogueiras que se destacam na pouca luz;
  - 28 curtas *Hands on History*, de 3 a 5 minutos, destravados na campanha.
- **Age of Mythology: Retold:** fez dos poderes divinos espetáculo visual.
- **Age of Empires Online:** foi o mais próximo do tom do Retalhos, com arte colorida e cartunesca e uma cidade-capital persistente que se enfeitava entre partidas.

**O que não trazer.** Nada disto entra: combate, relógio (a contagem da maravilha), microgestão, quatro recursos, teto de população por casas, destruição física e qualquer punição.

A tradução usada em todas as propostas é esta: **recurso vira ponto ou peça, tempo vira jogada e conquista vira descoberta.**

---

## 2. O Retalhos hoje, visto pelas lentes do AoE

| No AoE | No Retalhos hoje | O que falta |
|---|---|---|
| Eras que mudam a cidade | nenhuma: a partida só acaba quando a pilha esvazia | um arco dentro da partida |
| Centro da Cidade | peça inicial (0, 0), igual às outras | um coração para a vila |
| Bônus de civilização | `Theme.rules` com poucos números (peças, missões, perfeito) | uma regra temática por tema |
| Acampamento de madeira, moinho, pasto | interações vila×floresta, vila×plantação, vila×prado, plantação×prado | influência em volta |
| Aldeões e recursos no mapa | animais pastando, barcos, trens, carroças, pás girando | gente trabalhando, recursos à vista |
| Construção com andaime | a peça cai e a decoração "brota" | a obra |
| Comércio | barcos e trens percorrem as redes de rio e trilho (só visual) | regra de distância |
| Ruínas, relíquias, tesouros | nada | descoberta |
| Névoa e minimapa | vazio com grade hexagonal que desbota | mapa do desconhecido, minimapa |
| Maravilha | marco aleatório no centro de vilas (`landmarkChance`) | objetivo de longo prazo |
| Cor do jogador, brasão | `ui.accent` do tema | identidade ligando HUD e mundo |
| Música e vozes por era | sons sintetizados (toque de madeira, notas pentatônicas com eco) | trilha que evolui |
| Biomas e atmosferas | 14 temas, dia, entardecer e noite, sombras de nuvem | estações, fogo à noite |
| *Hands on History* | `docs/TEMAS.md` com fontes, fora do jogo | almanaque dentro do jogo |

**Medições usadas para calibrar as propostas** [M]. São 400 partidas da IA gulosa, que não persegue missões nem interações; um humano vai mais longe (VIABILIDADE, Apêndice B).

| Medida | Valor |
|---|---|
| Peças por partida | mediana 50 (p25 45, p75 58, p90 67) |
| Pontos após 20, 40 e 60 peças | 595, 1.465 e 2.690 (medianas) |
| Pontuação final | mediana 1.910, p90 3.050 |
| Raio do mapa após 20, 40 e 60 peças | 4, 6 e 7 hexágonos |
| Interações por partida | mediana 3 |
| Peças com 2 ou mais setores de vila | 17,9 por partida |
| Tamanho das redes de rio e de trilho | mediana 1 peça (p90: 3 e 2) |

---

## 3. As propostas em uma tabela

| # | Proposta | Tipo | Custo | Risco | No AoE |
|---|---|---|---|---|---|
| 1 | Avanço de eras, com o Centro e o marco da era | ambos | M | baixo | eras do AoE II e IV, marcos do AoE IV |
| 2 | Arquitetura que muda com a era | visual | M | médio | conjuntos de arquitetura do AoE II |
| 3 | Escolha na virada de era (1 de 2) | mecânica | M | médio | políticos (AoE III), deuses menores (AoM), marcos (AoE IV) |
| 4 | Andaimes e obra animada | visual | P | baixo | construção no AoE IV |
| 5 | Legibilidade: contraste, silhueta e teste | visual | P | baixo | direção de arte do AoE IV |
| 6 | Bônus de civilização por tema | mecânica | P–M | médio | bônus de civilização |
| 7 | Influência das construções | ambos | M | médio | moinho inglês, Folwark, cisternas |
| 8 | Aldeões trabalhando | visual | M | médio | aldeão por tarefa |
| 9 | Paisagem trabalhada: pegadas, trilhas, tocos, jazidas, frutas | visual | P–M | baixo | recursos à vista |
| 10 | Pesca e cardumes | visual | P–M | baixo | peixes, barcos de pesca |
| 11 | Sítios: ruínas, tesouros, relíquia e mirante | ambos | M | médio | ruínas e artefatos, relíquias, tesouros |
| 12 | Terra incógnita: o vazio vira mapa antigo | visual | M | baixo | névoa de guerra |
| 13 | Maravilha por tema | ambos | M–G | médio | maravilhas |
| 14 | Rotas de comércio | ambos | M | alto (frequência) | carroças (AoE II), rota (AoE III) |
| 15 | Cor da casa, estandartes, brasão e monumentos | visual e interface | P–M | baixo | cores de jogador, brasões e monumentos do AoE IV |
| 16 | Minimapa e linha do tempo | interface | P–M | baixo | minimapa, gráfico de fim de jogo |
| 17 | Interface por tema | interface | M | médio | painéis por região e emblema por civilização |
| 18 | Som que evolui com a era | áudio | M | baixo | trilha e vozes por era (AoE IV) |
| 19 | Atmosferas, fogo à noite e estações | ambos | M | médio | biomas e atmosferas do AoE IV |
| 20 | Almanaque e informação ao tocar | conteúdo | P–M | baixo | *Hands on History* |

---

## 4. Propostas detalhadas

### 1. Avanço de eras, com o Centro e o marco da era

**O quê.** A partida passa a ter quatro eras, que avançam pela pontuação: a II com 500 pontos, a III com 1.500 e a IV com 3.000. Cada avanço:

1. dá **+3 peças**;
2. muda a forma do **Centro**, uma construção nova no meio da peça inicial (o Centro da Cidade do AoE II também muda a cada era);
3. marca a **próxima peça com vila** para erguer o **marco da era**, e o fantasma já mostra o marco antes de colocar;
4. toca uma fanfarra curta e passa uma **onda dourada** pelo mapa, a partir do Centro.

**Por quê.** É o gesto mais reconhecível da série (seção 1). Dá ao Retalhos o que falta hoje: um arco dentro da partida e metas intermediárias além das missões.

Com a IA gulosa, 500 pontos chegam por volta da peça 17, 1.500 por volta da 40 e 3.000 por volta da 65 [M]. A partida mediana termina na Era III, e a IV fica como meta para as boas.

**Como fazer.**

**Núcleo e regras:**

- **`src/core/board.ts`:**
  - Em `Rules`, `eraScores: [number, number, number, number]` (padrão `[0, 500, 1500, 3000]`) e `eraTiles` (3), com valores em `DEFAULT_RULES`.
  - Em `Board`, os campos `era` (de 0 a 3) e `markPending`.
  - No começo de `place()`: se `markPending` e a peça tem setor de vila, então `placed.eraMark = this.era` e `markPending = false`.
  - Depois de somar os pontos: `while (era < 3 && score >= eraScores[era + 1]) { era++; tilesGained += eraTiles; markPending = true }`.
  - `PlaceResult` ganha `eraUp: number | null`, e `Check` ganha `eraMark`, para o fantasma.
- **`src/main.ts`:** aviso com o nome da era, `sfx.era()` e **`SAVE_VERSION` de 3 para 4** (a pilha muda no replay).
- **`tests/logic.ts`:** o oráculo recalcula a era pelos limiares e confere a pilha (+3 por avanço) sem chamar `Board`.
- **`src/themes/types.ts`:**
  - `eraNames?: [string, string, string, string]` (padrão: Aldeia, Vila, Burgo, Cidade);
  - `center?: 'dome' | 'spire' | 'pagoda' | 'pyramid' | 'stepped' | 'hall'`, o remate do Centro na Era IV.

**Renderização:**

- **`src/render/lib.ts`:** `centerGeometry(era, style, colors)`, com quatro kits que usam `landmarkColors` e `houses[0]`:

| Era | Centro | Altura | Triângulos |
|---|---|---|---|
| I | fogueira comunal: 3 cabanas `round` + `cone` em triângulo de raio 0,12; fogo de 2 cones #ff9a3c com `glow` 1 | 0,12 | ~250 |
| II | salão comprido (corpo `long` × 1,6, ou seja 0,38 × 0,14 × 0,18) com duas flâmulas | 0,20 | ~300 |
| III | paço com torre quadrada (0,10 × 0,36, telhado `hip`, janela acesa) e muro baixo em U | 0,42 | ~500 |
| IV | palácio com o remate do tema, 4 torreões e remate dourado #d9b44a (`glow` 0,3, que o bloom pega) | 0,60 | ~900 |

- **`src/render/world.ts`:**
  - O Centro é um objeto avulso sobre a peça (0, 0), fora dos pools. Como os pools só crescem (invariante 10), trocar de era não exige reconstruir nada.
  - A peça inicial passa a reservar o centro: `opts.center` em `buildTile`, com raio 0,24. Isso muda a decoração da peça inicial uma vez, sem afetar saves.
- **`src/render/tileBuilder.ts`:** `opts.eraMark` desenha o marco no setor de vila: o kit `landmark` do tema × 1,25, um anel de pedra clara e uma flâmula na cor da casa (proposta 15). Entram `eraMark` na assinatura `sig` do fantasma e em `build()`.
- **`src/render/materials.ts`:**
  - Novo uniforme `U.eraWave` (x, z, raio).
  - Nos materiais de chão e de decoração, uma faixa de 0,6 de largura corre a 6 unidades/s durante 2 s. Ela soma emissivo dourado e estica as construções em y (+15% a partir do chão).
  - Ajustar `positionPrevious` como já é feito no vento, para o TRAA não deixar rastro.

**Nomes de era por tema** (sugestão; a Era IV costuma ser a própria época do tema):

| Tema | I | II | III | IV |
|---|---|---|---|---|
| Vale Pastel | Aldeia | Vila | Burgo | Cidade |
| Holanda Dourada | Aldeia de pôlder | Vila mercante | Cidade das guildas | Século de Ouro |
| Cerrado Dourado | Pouso | Arraial | Vila | Cidade |
| Inverno Nórdico | Fazenda | Aldeia | Vila | Cidade |
| Jardim Sakura | Vilarejo | Bairro | Cidade | Metrópole |
| Colônia Marciana | Módulo | Posto | Colônia | Cidade-domo |
| Egito do Nilo | Pré-dinástico | Antigo Império | Médio Império | Novo Império |
| Jade Song | Aldeia | Vila de mercado | Cidade murada | Capital |
| Terra dos Vikings | Herdade | Povoado | Entreposto | Jarlado |
| Toscana Renascentista | Borgo | Comune | Signoria | Rinascimento |
| Edo Tranquilo | Mura | Shukuba (vila de posta) | Jōkamachi (cidade-castelo) | Edo |
| Minas Colonial | Arraial | Vila | Vila Rica | Capital da capitania |
| Velho Oeste | Acampamento | Povoado | Cidade da ferrovia | Cidade do boom |
| Andes Incas | Ayllu | Marka | Wamani | Tawantinsuyu |

**Custo** M. **Risco** baixo. Os +6 a +9 peças por partida alongam o jogo em uns 12% a 18%; se ficar longo, `eraTiles` = 2. **Tipo** ambos.

### 2. Arquitetura que muda com a era

**O quê.** Na virada de era, as casas do mapa inteiro trocam de estilo de uma vez, sem sair do lugar, como no AoE II. Plantações, cercas e estradas continuam iguais, como fazendas e paliçadas no AoE II.

**Por quê.** É o momento em que "a cidade mudou de roupa". O modelo certo é o do AoE IV: os prédios evoluem de pau-a-pique com palha para pedra e enxaimel, mas cada civilização é reconhecível desde o começo. No AoE II, todas dividem o visual da Idade das Trevas; aqui isso apagaria a identidade dos temas nas primeiras jogadas, justamente as das capturas de tela.

**Como fazer.**

- **`src/themes/progress.ts`** (novo, transforma dado em dado): `themeAtEra(theme, era): Theme`. As regras padrão abaixo podem ser sobrescritas por `Theme.eraHouses?`, quando o tema quiser.

| Era | Mudança nas casas |
|---|---|
| I | Telhados `gable`, `hip` e `stepgable` viram `thatch`; os outros (`flat`, `dome`, `pagoda`, `turf`, `cone`) já são do lugar e ficam. Sem `trim`. Paredes 25% em direção a #b9a27c (taipa). Casas 15% menores (campo novo `HouseKind.scale?`). |
| II | O tema como é hoje. |
| III | `trim` em todas as casas, na cor `landmarkColors[2]`. O 3º tipo de casa vira `tall`. Soco (base) de 0,012 para 0,02. |
| IV | Flâmula na cumeeira das casas `tall`, em posição fixa e sem sorteio. Janelas com o dobro de brilho. |

- **Pré-requisito, sem o qual a ideia não funciona.** A transformação **não pode mudar o número de tipos de casa, os pesos nem a quantidade de sorteios** de `buildTile`. Se mudar, árvores e plantas de cada peça trocam de lugar na virada. Dois pontos a cuidar:
  - Em `addHouse` há um sorteio condicional, `if (meta?.chimney && rng() < 0.7)`. Ele deve virar um sorteio sempre feito: `const smoke = rng(); if (meta?.chimney && smoke < 0.7)`.
  - O `landmarkRoll` já é incondicional, mas o `rng()` do giro do marco só acontece quando o marco nasce. Por isso, a era não deve mexer em `landmarkChance`.

  A troca do sorteio muda a decoração atual uma vez, sem afetar saves (a invariante 3 continua valendo).
- **Aplicação:** `lib.applyTheme(themeAtEra(theme, era))` seguido de `world.rebuild(board)`, escondido pela onda dourada. A montagem levava 116 ms com 301 peças na v1; com a água nova deve levar mais. Se passar de ~150 ms, reconstruir em fatias de 40 peças por quadro num segundo `staticRoot` e trocar no fim.
- **Densidade local, opcional e não retroativa.** Uma peça de vila que entra num grupo de vila de 8 ou mais peças ganha 3 casas por setor e 30% de chance de `tall`. O valor vem de `opts.villageTier`, calculado em `Board.check` somando os grupos vizinhos distintos mais 1. Como depende só do estado na hora da jogada, o replay reproduz.

**Custo** M. **Risco** médio: o tranco do rebuild e a memória no celular (medir com `?stress=300` antes de ligar). **Tipo** visual.

### 3. Escolha na virada de era (1 de 2)

**O quê.** A cada avanço aparecem 2 cartas. Escolher uma muda um número até o fim da partida.

**Por quê.** É o padrão comum a AoE III (políticos), Age of Mythology (deuses menores) e AoE IV (dois marcos por era): uma decisão rara, sem pressa e com sabor. Três por partida não pesam num jogo relaxante.

**Como fazer.**

- **`src/core/blessings.ts`** (puro, sem three.js nem DOM):

| id | Efeito | Nome padrão |
|---|---|---|
| `lumber` | serraria +5 | Guilda dos carpinteiros |
| `mill` | moinho +5 | Moleiros |
| `pasture` | pasto +5 | Pastores |
| `apiary` | colmeias +5 | Apicultores |
| `surveyors` | encaixe perfeito +10 | Agrimensores |
| `builders` | peça cercada dá 1 peça a mais | Mestres de obras |
| `pilgrims` | missão cumprida dá +2 peças | Peregrinos |
| `cartographers` | revela os sítios (proposta 11) e mostra as 3 próximas peças por 10 jogadas | Cartógrafos |

- **Opções de cada era.** Na era k, 2 ids sorteados com `mulberry32(seed ^ (k * 0x9e3779b1))`, de `theme.blessings ?? todos`. Os nomes por tema ficam em `Theme.blessingNames?`; por exemplo, Egito chama os cartógrafos de "Escribas do faraó".
- **Save.** Passa a ser `{ v: 4, seed, rulesId, moves, choices, score }`. `choices` é validado: inteiros 0 ou 1, no máximo 3. O replay aplica as escolhas em ordem, e o oráculo reimplementa os efeitos.
- **Interface.** Um modal com 2 cartões grandes (ícone, nome, uma linha) e as teclas 1 e 2. A jogada seguinte espera a escolha, que custa um toque.

**Custo** M. **Risco** médio: complexidade. Manter só 8 cartas, cada uma com frase de uma linha. **Tipo** mecânica.

### 4. Andaimes e obra animada

**O quê.** As construções de interação (serraria, moinho, pasto, colmeias), o marco da era e a maravilha nascem dentro de um andaime e "sobem" em ~0,9 s depois que a peça assenta. No fim, o andaime some com uma nuvem de poeira e três batidas de martelo.

**Por quê.**

- No AoE IV, os marcos são "divertidos de ver construir, com andaimes e trabalhadores virtuais subindo do chão", e aldeões-fantasma representam o trabalho coletivo.
- No AoE II, a fundação fica semitransparente até a obra começar.
- No Retalhos de hoje, a construção aparece pronta junto com a peça, e o prazer da interação dura só o texto dourado.

**Como fazer.**

1. **Kit `scaffold` em `lib.ts`:** 4 postes `box(0.006, H, 0.006)`, 2 anéis de travessas, 1 diagonal e uma plataforma de tábuas, na cor `theme.trunk`. São ~40 triângulos, com `H` igual à altura da construção mais 0,03; basta escalar em y.
2. **Andaime fora dos blocos:** `Deco` (em `tileBuilder.ts`) ganha `transient?: boolean`. Cada construção empurra também um `D('scaffold', …)` com `transient: true`, e `World.bake()` ignora decorações transitórias. Assim, o andaime nunca entra nos pools.
3. **Animação:** `LiveTile` ganha `setKeyScale(key, fn)`, ou `setDecoScale` passa a receber a chave. No bloco "Peças caindo" de `World.tick()`:
   - construções vão de 0,15 a 1 em y, com `easeOutBack`, entre 0,16 s e 1,1 s;
   - o andaime fica em escala 1 até 0,9 s e depois vai a 0 em y em 0,2 s, com `burst(..., 'dust', 8)`.

   A peça viva só fica mais tempo (1,2 s em vez de 0,55 s) quando tem construção.
4. **Som:** `sfx.hammer()`, três cliques de ruído com passa-banda em 1,6 kHz, 110 ms entre eles.
5. **Opcional:** dois aldeões-fantasma (kit `folk` da proposta 8, opacidade 0,5) em volta do andaime, que somem junto.

**Custo** P. **Risco** baixo: só a peça viva muda, nada nos blocos. **Tipo** visual.

### 5. Legibilidade: contraste, silhueta e teste

**O quê.** Regras de contraste e silhueta para os 14 temas, conferidas por script, e um modo de depuração `?silhueta`.

**Por quê.** A direção de arte do AoE IV pôs a legibilidade em primeiro lugar e chegou a tirar as ovelhas brancas da neve (seção 1).

No Retalhos, a câmera inclina de 39° (perto) a 64° (longe), conforme `CameraRig.pitch()`. De longe, quase de cima, a vila se lê pelo telhado. Com GTAO, bloom e profundidade de campo entrando agora, é a hora de ter uma régua.

**O que a medição mostra** [M] (cores dos temas em CIELAB, sem luz):

| Tema | Telhado × chão da vila: menor ΔE (peso das casas abaixo de 15) | Parede × chão da vila: menor ΔE (peso abaixo de 12) |
|---|---|---|
| Inverno Nórdico | **3 (100%)**: os telhados nevados somem | 60 (0%) |
| Egito do Nilo | 17 (0%) | **1 (65%)** |
| Jade Song | 35 (0%) | **4 (100%)** |
| Andes Incas | 34 (0%) | **4 (88%)** |
| Velho Oeste | 32 (0%) | 8 (30%) |
| Toscana | 33 (0%) | 9 (10%) |
| Os outros 8 temas | 17 ou mais (0%) | 13 ou mais (0%) |

**Correções conferidas** [M]:

- **Inverno:** metade dos telhados em ardósia #4f5a66 (ΔE 54) ou vermelho falun #8a3a2a (ΔE 71), e beiral escuro #3a3f47 nos que continuam nevados.
- **Andes:** paredes de adobe #b98a5e (ΔE 27).
- **Egito, Song, Oeste e Toscana**, onde parede clara encontra chão claro: subir o soco de 0,012 para 0,02 e pintá-lo com o `sideDark` do tema, ou escurecer o chão da vila de 6 a 8 pontos de L.

**Silhueta.** A casa tem ~0,23 de altura. Já a serraria tem ~0,06, o pasto ~0,03 e as colmeias ~0,05. Na distância 20 (~94 px por unidade numa tela de 1080 px), as três ficam com 3 a 6 px e somem. Duas regras:

- Toda construção de interação ganha um elemento vertical de pelo menos 0,14:
  - na serraria, um galpão de telhado de uma água;
  - no pasto, um mastro com flâmula;
  - nas colmeias, colmeias de palha cônicas e altas.
- Marco com pelo menos 1,8× a altura da casa, o que já vale hoje.

**Como fazer.**

- **`scripts/legibility.mjs`** (ou um teste em `tests/`), com a mesma conta. Ele falha quando, ponderado pelo peso das casas:
  - mais de 25% dos telhados têm ΔE < 15 contra o chão da vila; ou
  - mais de 25% das paredes têm ΔE < 12.
- **`?silhueta`:** um uniforme `U.silhouette` em `materials.ts` força `colorNode` preto nas decorações e branco no chão. Olhar cada tema nas distâncias 8,5 e 20 com `scripts/screenshots.mjs`.
- **Correções de cor:** são só dado (`themes.ts`, `eras.ts`). Refazer as capturas de `docs/screens/`.

**Custo** P. **Risco** baixo (só as capturas mudam). **Tipo** visual.

### 6. Bônus de civilização por tema

**O quê.** Cada tema ganha um bônus curto e temático, mostrado no menu de temas como na tela de escolha de civilização do AoE.

**Por quê.** No AoE, o bônus ensina a jogar a civilização. Folwark, cabana de caça e moinho inglês (seção 1) são regras de uma linha que mudam onde se põe cada coisa. No Retalhos, os `rules` por tema já existem, mas só mexem em tamanho da pilha, missões e perfeito, que não pedem um jogo diferente.

**Como fazer.**

- **`src/core/board.ts`:** dois campos em `Rules`, com padrão `{}` em `DEFAULT_RULES`:
  - `matchBonus: Partial<Record<T, number>>`: pontos extras por borda encaixada do terreno T;
  - `synergyBonus: Partial<Record<SynKind, number>>`: pontos extras por interação do tipo K.

  Os dois são somados em `Board.place()`.
- **`src/main.ts`:**
  - O texto flutuante da interação hoje mostra `game.rules.synergyPoints` fixo; passa a mostrar o valor do tipo.
  - **`SAVE_VERSION`** sobe, porque o replay de um tema com bônus muda.
- **`tests/logic.ts`:** reimplementa os dois somatórios.
- **Temas:** `ruleNote` passa a descrever o bônus.

| Tema | Bônus | Regra |
|---|---|---|
| Vale Pastel | nenhum (referência) | — |
| Holanda Dourada | Moinhos de pôlder | `synergyBonus.mill` +5, ou a influência do moinho (proposta 7) |
| Cerrado Dourado | já tem: perfeito vale 25 | — |
| Inverno Nórdico | já tem 45 peças; mais Lareira | `synergyBonus.lumber` +3 |
| Jardim Sakura | Trem-bala | `matchBonus[T.Rail]` +5 |
| Colônia Marciana | já tem: 36 peças e mais missões | — |
| Egito do Nilo | Dádiva do Nilo | `matchBonus[T.Water]` +5 |
| Jade Song | Arroz Champa | `matchBonus[T.Field]` +3 |
| Terra dos Vikings | Carpintaria naval | `synergyBonus.lumber` +5 |
| Toscana Renascentista | Borghi | `matchBonus[T.Village]` +3 |
| Edo Tranquilo | já tem: jardim sereno | — |
| Minas Colonial | Tropeiros (pouso de tropa) | `synergyBonus.pasture` +5 |
| Velho Oeste | já tem: mais missões | — |
| Andes Incas | Andenes (horta de altitude) | `synergyBonus.apiary` +5 |

**Balanceamento.** Pela minha estimativa, cada bônus muda de 2% a 4% a pontuação da IA gulosa; o que importa é mudar o que o jogador procura. Rodar `npm test` e uma média de pontos por tema, mantendo cada tema a ±8% do Vale.

**Custo** P–M. **Risco** médio (balanceamento), com números pequenos. **Tipo** mecânica.

### 7. Influência das construções

**O quê.** Cada interação cria uma área de influência nas 6 casas vizinhas da peça onde a construção nasceu. Uma peça colocada depois dentro da área ganha pontos pelos setores do terreno certo:

| Construção | Bônus para a peça nova dentro da área |
|---|---|
| Moinho | +2 por setor de plantação |
| Serraria | +2 por setor de floresta |
| Pasto | +2 por setor de prado |
| Colmeias | +1 por setor de prado ou de plantação |

O teto é +8 por peça, e influências do mesmo tipo não se somam (vale a maior). Como no moinho inglês, que sobe de 15% para 30% ao longo das eras, o bônus pode crescer com a era: +1, +2, +2 e +3.

**Por quê.** É a língua do AoE IV: o moinho inglês, as cisternas bizantinas e a Casa da Sabedoria abássida. No AoE II, as fazendas ficam em volta do moinho; os poloneses ganham com o Folwark. E isso transforma a interação, que hoje é um bônus pontual, num lugar do mapa.

**Como fazer.**

- **`Board`:** guarda `influence: Map<number, Set<SynKind>>`, alimentado quando `place()` cria uma interação.
- **`check()`:** calcula o bônus da posição, para o fantasma; `place()` soma o bônus. Oráculo e `SAVE_VERSION`.
- **Interface:** ao segurar uma peça, as áreas que ela aproveitaria aparecem como contorno hexagonal tracejado dourado no chão. É um `InstancedMesh` de anéis, como os `slots`. O ganho entra na prévia ("+6 moinho"), como o AoE IV mostra a influência ao posicionar um prédio.
- **Visual de brinde:** as pás do moinho giram mais rápido conforme a quantidade de plantação vizinha.

**Custo** M. **Risco** médio: mais uma regra para ensinar. Vale ligar só por tema (Holanda com o moinho) ou só no modo com eras. **Tipo** ambos.

### 8. Aldeões trabalhando

**O quê.** Bonequinhos de 0,045 de altura, com camisa na cor da casa, fazendo o trabalho de cada construção e andando pelas estradas de terra, pedra e areia.

**Por quê.** No AoE II, o aldeão muda de aparência conforme a tarefa, e a economia se vê. É o sinal de "vida" mais reconhecível da série.

**Como fazer.**

- **Kits em `lib.ts`:**
  - `folk`: corpo em cilindro de 6 lados (raio 0,011, altura 0,026, `tint` 1 para a cor da camisa), cabeça em icosaedro (raio 0,008, cor de pele do tema) e chapéu do tema;
  - variantes com ferramenta: `folk:axe`, `folk:sack`, `folk:hoe`, de 24 a 40 triângulos cada.
- **Tema** (`src/themes/types.ts`): `folk?: { skin: string[]; hat: 'straw' | 'cap' | 'scarf' | 'hood' | 'none' | 'helmet'; hatColor: string }`. Exemplos de chapéu:
  - palha larga em Song, Edo e Colonial;
  - lenço claro no Egito;
  - capuz de lã nos Vikings;
  - barrete vermelho na Toscana;
  - touca colorida (*chullo*) nos Andes;
  - capacete de vidro em Marte.
- **`src/render/life.ts`:** um tipo `Worker`, com quatro animações:

| Animação | Movimento |
|---|---|
| `chop` | rotação em x de 0 a 0,7 rad a 1,4 Hz, com pausa de 1 s a cada 4 golpes |
| `carry` | vai e volta entre dois pontos a 0,05 unidade/s, balançando 0,003 |
| `tend` | agacha, com escala y de 0,85 periódica |
| `walk` | usa a lógica de `Mover`: 1 por rede de estrada de 3 ou mais peças |

- **Quantidade:** 1 por construção de interação e 1 a cada 4 peças de vila, com teto de 120.
- **Quando aparecem:**
  - só de perto, com `rig.dist < 13`, o mesmo limiar da metade fina das plantas;
  - à noite "vão para casa": encolhem e somem em 1 s quando `U.night` passa de 0,6.
- **Custo de GPU:** 120 × ~32, ou ~4 mil triângulos, e +3 draw calls. CPU: 120 matrizes por quadro (~0,05 ms).

**Custo** M. **Risco** médio:

- objetos pequenos que se movem podem deixar rastro no TRAA; conferir com os barcos e animais que já existem, e a solução que servir para eles serve aqui;
- 0,045 dá ~10 px na distância padrão (8,5) numa tela de 1080 px.

**Tipo** visual.

### 9. Paisagem trabalhada: pegadas, trilhas, tocos, jazidas e frutas

**O quê.** Marcas do trabalho humano no chão e recursos visíveis no mapa.

| Item | Visual | Onde e quando |
|---|---|---|
| **Pegada de terra** | disco de 8 lados, raio 0,1, cor `mix(chão da vila, roadBed, 0,5)` | no chão estático, sob casas e construções (+8 triângulos por casa, ~+0,7% no total) |
| **Trilhas** | `strip()` de 0,012 de largura, cor `mix(chão, roadBed, 0,35)` | ligando as casas ao centro do setor de vila |
| **Clareira da serraria** | árvores viram tocos (kit `stump`: cilindro de 7 lados, 0,02 × 0,015, topo claro, 14 triângulos) e uma tora caída | na peça colocada, as árvores a menos de 0,25 da borda da serraria |
| **Jazidas** | kit `ore`: 3 pedras (`rock`) e 4 pepitas em octaedro de raio 0,008 na cor do minério, com `glow` 0,2 (o bloom pega de leve) | em prado, 4% por setor (`Theme.ore?: { color: string; chance: number }`) |
| **Mina** | kit `mine`: galpão, carrinho em 2 trilhos curtos e monte de minério | quando a vila encosta na jazida dentro da peça (só visual, como a roda d'água; invariante 11) |
| **Arbustos de frutas** | kit `berry`: arbusto e 6 bolinhas na cor `Theme.berry` | em prado, 6% por setor |

Minério por tema: ouro #e8c04a em Minas Colonial (ouro de aluvião), Velho Oeste e Andes; prata #cfd3d6; cobre #b87333; ferro de pântano #8a5a3a nos Vikings; cristal em Marte.

Frutas por tema: vermelho #c0283a no Vale, uva #5a2a5a na Toscana, tâmara #8a4a1a no Egito.

**Por quê.** No AoE, recursos são objetos (arbustos de 125 de comida, árvores avulsas, ouro, pedra), e os acampamentos ficam colados ao recurso. No AoE IV, os mongóis constroem o Ovoo sobre o afloramento de pedra.

**Como fazer.** Tudo em `buildTile` e `lib.ts`, com os campos novos no tema. Novos sorteios só afetam peças novas; nada é retroativo.

**Custo** P–M. **Risco** baixo: medir triângulos, e cada item deve ficar abaixo de 1%. **Tipo** visual.

### 10. Pesca e cardumes

**O quê.**

- **Cardumes.** Lagos (peça com uma borda de rio) e remansos ganham 3 "peixes" nadando em círculo sob a superfície, com raio de 0,12 a 0,2 e 0,15 rad/s. O kit `fish` é um losango achatado de 2 triângulos, numa cor 60% mais escura que a água. A cada 6 a 12 s, um peixe salta: `world.burst` de 6 partículas brancas.
- **Cais de pescador.** Quando um setor de vila encosta no rio ou no lago dentro da peça, nasce o cais, alternando com a roda d'água de hoje:
  - kit `pier`: 6 tábuas de 0,03 × 0,1 sobre 2 estacas;
  - kit `fishrack`: varal em A com 4 peixinhos;
  - um barco de pesca ancorado, balançando (reuso de `boat`, com rede).

**Por quê.** No AoE II, a pesca está à vista: peixes da margem (200 de comida), armadilhas de peixe e barcos pescando.

**Como fazer.** Os peixes vivem no `Life`, num pool `fish` com teto de 60. O cais é uma construção interna de `buildTile`, só visual.

**Custo** P–M. **Risco** baixo. **Tipo** visual.

### 11. Sítios: ruínas, tesouros, relíquia e mirante

**O quê.** Cada partida tem 6 sítios no desconhecido. Quem coloca uma peça sobre um sítio o descobre:

| Sítio | Quantos | Recompensa | Decoração na peça |
|---|---|---|---|
| Ruína | 2 | +50 pontos e 1 cartão do Almanaque (proposta 20) | kit `ruins`: 4 colunas quebradas (cilindros de 6 lados, de 0,03 a 0,12) e um bloco caído, cor `rock`, musgo #6a8a4a no topo |
| Tesouro | 2 | +2 peças | kit `chest`: baú de 0,05 × 0,035 × 0,035 com faixas douradas, tampa aberta e 5 moedas; ao lado, um "guardião" dormindo (o animal do tema), sem luta |
| Relíquia | 1 | +3 pontos por jogada até o fim, se a peça tiver vila; senão, +1 peça | kit `relic`: relicário dourado #d9b44a (`glow` 0,4) sobre pedestal |
| Mirante | 1 | revela os outros sítios e mostra as 3 próximas peças por 10 jogadas | kit `lookout`: torre de vigia de madeira de 0,3 |

- **Posição.** Dois sítios a 4–5 hexágonos da origem, dois a 6–7 e dois a 8–10, com pelo menos 3 de distância entre eles.

  O raio do mapa da IA chega a 4 na peça 20, 6 na 40 e 7 na 60 [M]. Assim, o primeiro anel cai no meio da partida, e o terceiro fica para partidas longas ou para quem decide "explorar".

**Por quê.** É o "o desconhecido tem tesouro" da seção 1:

- ruínas e artefatos (AoE I);
- relíquias que rendem ouro aos poucos (30 por minuto no AoE II);
- tesouros guardados (AoE III);
- sítios sagrados (AoE IV).

Hoje, o vazio do Retalhos não tem motivo para ser visitado.

**Como fazer.**

- **`src/core/sites.ts`** (puro): `generateSites(seed): Site[]`, com `mulberry32(seed ^ 0x51735173)`. É um fluxo separado do das peças, então a sequência fica intacta (invariante 2).
- **`Board`:** `Board.sites`, recompensa aplicada em `place()` e `PlaceResult.site`.
- **`Game`:** passa os sítios ao `Board` no construtor.
- **Testes e save:**
  - o oráculo reimplementa as recompensas;
  - um teste próprio confere anéis, espaçamento e determinismo (mesma semente, mesmos sítios);
  - `SAVE_VERSION` sobe.
- **Renderização:** `buildTile` recebe `opts.site` e desenha o kit.
- **Fantasma:** sobre um sítio, mostra a recompensa ("Ruína: +50").
- **Batedor:** no começo da partida, um cavaleiro (`horse` com `folk`) sai do Centro até o sítio mais próximo e volta. É só visual, mas ensina a ideia, como a abertura com batedor do AoE.

**Custo** M. **Risco** médio: semelhança com as peças especiais pré-colocadas do Dorfromantik (a "missão coroa", um hexágono de contorno no vazio). Para diferenciar: sítios não são peças nem missões; aparecem como carimbos num mapa de pergaminho (proposta 12) e premiam a descoberta. **Tipo** ambos.

### 12. Terra incógnita: o vazio vira mapa antigo

**O quê.** O vazio em volta das peças vira pergaminho, em três faixas a partir do mapa:

- **Perto (até R):** papel limpo e grade hexagonal a nanquim.
- **Mais longe (de R a R+4):** a tinta desbota.
- **Além (de R+4):** uma névoa clara cobre o desconhecido e recua quando o mapa cresce.

R é o raio explorado: a maior distância das peças, mais 1,5.

**Por quê.** O AoE mostra o inexplorado em preto, a névoa em cinza e a área visível em cor. Num jogo relaxante, o preto vira o mapa de um cartógrafo, e o recuo da névoa vira recompensa por expandir.

**Como fazer** (`makeVoidMaterial()` em `materials.ts`, em TSL):

- **Uniformes novos:**
  - `explored`: o raio R, que persegue o alvo com amortecimento de 1,2 s;
  - `ink`: `mix(ui.ink, voidFill, 0,75)`;
  - `paper`: `voidFill`.
- **Textura de papel:** grão com `texture(noiseTex, p / 0.9)` (±3%) e fibras com `texture(noiseTex, vec2(p.x * 6, p.y * 0.6))`.
- **Grade a mão:** tremido de `(n − 0,5) · 0,015` na distância ao hexágono.
- **Faixas:**
  - entre R e R+4, a tinta some e o papel puxa 35% para sépia #c9b58a;
  - além de R+4, duas oitavas de ruído rolando a 0,01 unidade/s misturam 20% de branco.
- **Carimbos:** os sítios já revelados aparecem como glifos chapados de 10 a 30 triângulos no plano do vazio, na cor `ink`:
  - ruína: arco quebrado;
  - tesouro: um "X";
  - relíquia: estrela de 8 pontas;
  - mirante: torre triangular.

**Custo** M. **Risco** baixo: os `slots` brancos de colocação continuam por cima e precisam seguir legíveis. **Tipo** visual.

### 13. Maravilha por tema

**O quê.** Um objetivo de longo prazo na Era IV:

1. A próxima peça com 2 ou mais setores de vila vira o canteiro da maravilha (uma peça assim aparece 17,9 vezes por partida [M]).
2. A obra avança uma etapa a cada peça colocada depois, em 6 etapas, com o andaime da proposta 4 subindo.
3. Ao completar: +300 pontos, +6 peças, fogos de artifício se for noite e um convite para a foto.

**Por quê.** As maravilhas do AoE são prédios reais de cada civilização, com contagem para vencer (200 anos no AoE II; 15 minutos no AoE IV). Aqui não há relógio, nem ataque: a contagem é em jogadas.

**Lista sugerida**, evitando os mesmos prédios que o AoE II usa. Lá, Tōdai-ji é a maravilha dos japoneses, a igreja de madeira de Borgund a dos vikings, o Templo do Sol de Machu Picchu a dos incas e a Catedral de Gênova a dos italianos.

| Tema | Maravilha | Forma procedural |
|---|---|---|
| Vale Pastel | Castelo de conto | 5 torres (`cyl` + `cone`) em tons pastel, muralha baixa |
| Holanda Dourada | Paço Municipal de Amsterdã (1655) | bloco 0,6 × 0,3 × 0,22 com frontão e lanterna no topo |
| Cerrado Dourado | Matriz de Pirenópolis (1728–1732) | igreja colonial branca grande, com duas torres |
| Inverno Nórdico | Palácio de gelo | blocos azulados em material `glass`, `glow` 0,4 |
| Jardim Sakura | Cerejeira milenar com torii | árvore `blossom` × 5 com pétalas caindo |
| Colônia Marciana | Elevador espacial | cabo até 1,5 de altura com anel luminoso |
| Egito do Nilo | Pilone de Karnak com obeliscos | 2 trapézios, 2 obeliscos e uma avenida de 8 esfinges em bloco |
| Jade Song | Pagode de Ferro de Kaifeng (1049) | 13 andares octogonais com beirais |
| Terra dos Vikings | Grande salão com cumeeiras de dragão | casa longa de 0,7, telhado curvo, 2 cabeças de dragão (o "salão" que o TEMAS.md já pede) |
| Toscana | Cúpula de Brunelleschi (Florença, 1436) | tambor octogonal, cúpula de 8 gomos, lanterna e campanário |
| Edo Tranquilo | Pagode do Tō-ji (reconstruído em 1644) | 5 andares de beirais largos |
| Minas Colonial | São Francisco de Assis, Ouro Preto (1766–1794) | fachada barroca com torres redondas |
| Velho Oeste | Ponte ferroviária de cavalete | treliça de madeira em vigas cruzadas |
| Andes Incas | Terraços circulares de Moray | 6 anéis concêntricos em degraus, com plantas |

**Como fazer.**

- **Núcleo:** `Board.wonder: { tileIndex, stage }`; `place()` avança a etapa. Oráculo e `SAVE_VERSION`.
- **Renderização:** `WonderView` avulso, como o Centro, fora dos pools, com 6 estágios:
  - etapa 0: pódio em degraus de 0,9 × 0,9;
  - etapas 1 a 5: o corpo cresce dentro do andaime;
  - etapa 6: completo, com remate dourado e 4 flâmulas.
- **Geometria paramétrica:** `wonderGeometry(style)` lê `Theme.wonder: { core: 'dome' | 'pagoda' | 'pylon' | 'hall' | 'rings' | 'tower' | 'tree' | 'spire'; colors; scale }`.
- **Orçamento:** teto de 3 mil triângulos. Fazer uma maravilha caprichada só para o tema-âncora e as outras paramétricas.

**Custo** M–G. **Risco** médio: geometria para 14 temas. **Tipo** ambos.

### 14. Rotas de comércio

**O quê.** Mercados e portos ligados pela mesma rede rendem pontos pela distância, uma vez por par:

- **Mercado:** peça com estação, ou seja, trilho de uma borda ou vila colada ao trilho dentro da peça.
- **Porto:** vila colada ao rio ou ao lago dentro da peça.
- **Quanto rende:** `pts = round(4 · d · (d / 6 + 1))`, com d a distância em hexágonos entre os dois:

| d | Pontos |
|---|---|
| 2 | 11 |
| 4 | 27 |
| 6 | 48 (+1 peça) |
| 8 | 75 (+1 peça) |
| 10 | 107 (+1 peça) |

- **Regras do par:** só conta par novo com d ≥ 2, como o AoE II, que exige mercados a 5 tiles para render ouro. Ao conectar um mercado, paga só o par com o mercado mais distante da mesma rede.

**Por quê.** É a curva quase quadrática da carroça do AoE II. Também vem do AoE III a rota com postos e caravanas que pagam ao passar.

**O que a medição diz** [M]. Com o sorteio atual, as redes são curtas:

- rio com mediana de 1 peça (p90 3) e trilho com mediana de 1 (p90 2);
- 2,9 "mercados" e 3,8 "portos" por partida;
- distância mediana entre mercados da mesma rede: 1.

No modo clássico, a regra quase nunca dispararia. A recomendação:

1. **No clássico:** só a camada visual. Carroças e trens com carga (kit `cargo`, caixotes), parada de 0,8 s em cada mercado e uma moeda brilhando. **Feito:** a carga senta no vagão (a caravana já leva fardo); a parada é no meio da peça de passagem, ou na espera que o beco já tinha; a moeda sobe com faíscas. A pontuação não muda.
2. **A regra completa:** num modo próprio (seção 6), com mais trilho. **Ainda por fazer.**

**Como fazer.**

- `generateEdges` passa a receber as chances de rio e trilho por `Rules` (`waterChance` hoje ~0,15; `railChance` ~0,09).
- `networks()` vai para o núcleo (hoje existe só em `life.ts`), e `Board.routesPaid: Set<string>` guarda os pares pagos.
- Oráculo e `SAVE_VERSION`. Mudar as chances muda as sequências, mas só no modo ou tema que mudar.

**Custo** M. **Risco** alto (frequência baixa fora do modo). **Tipo** ambos.

### 15. Cor da casa, estandartes, brasão e monumentos

**O quê.** Uma "cor da casa" que liga o HUD ao mundo. O padrão é o `ui.accent` do tema, e o jogador pode escolher entre 8 cores. Ela aparece:

- em flâmulas no Centro, nos marcos e nas construções;
- nas camisas dos aldeões;
- numa faixa nas velas dos barcos;
- nos estandartes de missão.

**Por quê.** No AoE, a cor do jogador está em roupas e bandeiras, e o AoE IV identifica prédios por telhados, estandartes e símbolos que casam com o HUD. Nas "maestrias" do AoE IV (15 por civilização), o jogador desbloqueia brasões personalizáveis e monumentos exibidos no Centro da Cidade.

**Detalhes.**

- **Paleta própria**, para não repetir as 8 cores puras do AoE II:

| Cor | Hex |
|---|---|
| anil | #34508f |
| carmim | #a8323a |
| musgo | #4d7a3e |
| açafrão | #d99a1e |
| turquesa | #2a8c8c |
| ameixa | #6e3b6e |
| ardósia | #4f5a66 |
| cobre | #b8612e |

- **Kit `pennant`:** mastro (cilindro de 4 lados, 0,003 × 0,09) e bandeira de 2 triângulos (0,035 × 0,022, `tint` 1), balançando com o material `foliage`.
- **Estandartes de missão.** Trocar o balão (`.marker` em `style.css`, uma bolha com borda colorida) por:
  - uma flâmula de rabo de andorinha, `clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)`, de 34 × 44 px;
  - presa a um mastro de 2 px;
  - com o ícone do terreno e o número.

  Isso também resolve a pendência de VIABILIDADE §8: afastar os marcadores das bolhas do original.
- **Brasão.** Um SVG de 40 × 48 px no placar, montado com quatro escolhas:
  - campo na cor da casa;
  - metal: ouro #d9b44a ou prata #e8e4da;
  - peça: faixa, pala, banda, asna, cruz ou sautor;
  - móvel: estrela, roda, feixe de trigo, árvore, peixe ou torre.

  São 72 combinações por cor. Fica em `localStorage` (`retalhos.banner`), validado contra listas fixas (invariante 12).
- **Monumentos.** Conquistas desbloqueiam o enfeite da praça do Centro. Exemplos:
  - "10 serrarias numa partida" dá uma tora entalhada;
  - "primeira maravilha" dá uma estátua dourada;
  - "20 relíquias" dá um relicário.

**Custo** P–M. **Risco** baixo. **Tipo** visual e interface.

### 16. Minimapa e linha do tempo

**O quê.**

- **Minimapa.** Um canvas 2D hexagonal de 140 px (96 px no celular, recolhido por padrão), que mostra:
  - cada peça como 6 cunhas nas cores `terrainColors`;
  - rios e trilhos como linhas;
  - missões como flâmulas;
  - sítios revelados como carimbos;
  - o trapézio branco da câmera, que é a interseção dos 4 raios dos cantos da tela com o chão (y = 0).

  Clique ou toque leva a câmera; a tecla é M. A atualização é incremental: desenha um hexágono por jogada e o trapézio a cada quadro.
- **Linha do tempo.** Na tela de fim, um gráfico SVG da pontuação por jogada, com marcas de era, missões e maravilha, e uma linha "maior grupo por terreno".

**Por quê.** O minimapa do AoE junta as cores do terreno, o inexplorado em preto e o contorno branco da câmera. O gráfico de fim de jogo do AoE II conta a partida.

**Como fazer.** `src/ui/minimap.ts`, chamado em `place()` e no laço de quadros; `showGameOver()` ganha o gráfico, com dados acumulados em `main.ts`.

**Custo** P–M. **Risco** baixo: não poluir o HUD no celular. **Tipo** interface.

### 17. Interface por tema

**O quê.** Painéis com "material" do tema, definidos por `ui.frame` e `ui.emblem`:

- `ui.frame: 'papel' | 'pergaminho' | 'papiro' | 'madeira' | 'seda' | 'washi' | 'metal' | 'pedra'`;
- `ui.emblem`: um SVG simples por tema (sol, lírio de Florença, tulipa, ipê, floco de neve, planeta).

**Por quê.** O AoE II original tinha um painel por civilização. O DE agrupa os painéis por região, com um emblema por civilização. A moldura diz "onde você está" antes de qualquer texto.

**Como fazer.** CSS sem arquivos: gradientes repetidos, um filtro SVG `feTurbulence` embutido em *data URI* para o grão e ornamentos de canto com `::before` e `::after`.

| Tema | Moldura |
|---|---|
| Egito | papiro: base #efe0b4, fibras a 0° e 90° de 2 px com alfa 0,06 |
| Vikings | madeira: `repeating-linear-gradient(90deg …)` com tábuas de 28 px, base #6b4a32, texto claro #f3e7d3 |
| Toscana | pergaminho com selo de cera na cor da casa |
| Song | seda com selo quadrado vermelho #b23a2e |
| Edo | washi, com fibras |
| Marte | metal escovado |
| Oeste | cartaz de papel |

**Custo** M. **Risco** médio:

- contraste: manter `ui.ink` × painel em 7:1 ou mais, como validado em TEMAS.md;
- desempenho: evitar `backdrop-filter` em muitos elementos no celular.

**Tipo** interface.

### 18. Som que evolui com a era

**O quê.** Três camadas, todas sintetizadas em `src/audio.ts`.

**a) Fanfarra de era.** Usa a escala do tema, definida em `Theme.music: { scale: number[]; timbre }`:

| Tema | Escala (semitons) |
|---|---|
| Egito | 0, 1, 4, 5, 7, 8, 10 |
| Song | 0, 2, 4, 7, 9 |
| Edo | 0, 1, 5, 7, 8 |
| Vikings | 0, 2, 3, 5, 7, 9, 10 |
| Andes | 0, 3, 5, 7, 10 |
| Marte | tons inteiros |
| Holanda | carrilhão |

A instrumentação cresce com a era, como a trilha do AoE IV:

| Era | Instrumentação |
|---|---|
| I | uma voz |
| II | + bordão |
| III | + cordas dedilhadas (Karplus-Strong) |
| IV | + acorde de sinos |

**b) Ambiente:**

- vento: ruído rosa, passa-baixa em 400 Hz, LFO de 0,1 Hz;
- água: ruído passa-banda em 1,2 kHz, proporcional à água na tela;
- pássaros de dia: chilreios de 2,5 a 4 kHz;
- grilos à noite: 4,5 kHz.

O volume sobe com o zoom.

**c) Som por ação:**

| Ação | Som |
|---|---|
| serraria | 2 golpes de machado: ruído de 600 a 1.200 Hz, 60 ms |
| moinho | rangido: dente-de-serra de 90 Hz com glissando e filtro |
| pasto | balido: dente-de-serra com formantes em 700 e 1.200 Hz, vibrato de 6 Hz |
| colmeias | zumbido: dente-de-serra de 200 Hz com trêmolo de 30 Hz |
| peça com rio | respingo |

**Controles:** volume geral, de efeitos e de ambiente, validados no `localStorage`.

**Por quê.** No AoE, cada ação tem som. No AoE IV, a música muda por era e por civilização (koto, shakuhachi e shamisen para os japoneses), e a língua dos aldeões evolui por era.

**Custo** M. **Risco** baixo, com dois cuidados para não cansar o ouvido: variação de altura de ±3% e no máximo 1 som de cada tipo a cada 120 ms. **Tipo** áudio.

### 19. Atmosferas, fogo à noite e estações

**O quê.**

**a) Atmosfera por tema.** `Theme.atmos?: { haze: number; hazeColor: string; wind: number; filter: [number, number, number] }` e um quarto horário, "aurora", com sol baixo rosado #ffc9a8 e sombras longas.

**b) Fogo à noite.**

- Fogueiras nas construções: kit `fire`, 2 cones emissivos #ff9a3c, cintilando em TSL com `0,8 + 0,2 · sin(t · 9 + hash)`.
- Tochas nas portas dos marcos.
- Lanternas a cada ~0,3 ao longo das estradas de pedra (Song, Edo, Toscana, Colonial), ligadas por um campo `roadLamps` no tema.

**c) Estações por jogada.** A cada 20 jogadas, primavera, verão, outono e inverno. É determinístico pelo número da jogada, e a estação aparece pelo uniforme `U.season`:

| Estação | Efeito em TSL |
|---|---|
| Primavera | flores em dobro (pela metade fina das plantas) e copas floridas mais claras |
| Verão | o tema como é hoje |
| Outono | copas puxadas 40% para #d9822b ou #b8432a, variando por `hash(instanceIndex)` |
| Inverno | neve nas superfícies com normal y > 0,7 (`mix(cor, #f4f8fb, smoothstep(0,7, 0,9, n.y) · U.snow · ruído)`), beira dos rios congelada e fumaça em todas as chaminés |

Os temas que já são uma estação (Inverno Nórdico, Jardim Sakura) ficam fixos. Como regra leve, opcional e só de recompensa, cada estação dá +3 a uma interação: primavera para colmeias, verão para moinho, outono para serraria e inverno para pasto.

**Por quê.** O AoE IV tem 20 biomas, biomas sazonais em eventos (Inverno, Hallow's Hearth, Enchanted Grove) e atmosferas com ângulo do sol, névoa e vento. Na pouca luz, tochas e fogueiras chamam o olho. O Age of Mythology fez do clima um poder visível (a Chuva acelera as fazendas em 150%).

**Custo** M. **Risco** médio:

- shaders em três materiais;
- capturas a refazer;
- na neve, telhados brancos voltam a sumir: aplicar as correções da proposta 5.

**Tipo** ambos.

### 20. Almanaque e informação ao tocar

**O quê.**

- **Informação ao tocar.** Tocar ou clicar numa construção abre um cartão com o nome que ela tem no tema ("Qollqa") e uma linha de história, de `Theme.lore`. O raycast do `InstancedMesh` devolve o `instanceId`, e a chave do pool diz o tipo de construção.
- **Almanaque.** Seis cartões por tema, de ~120 palavras, com a fonte, escritos a partir de `docs/TEMAS.md`. Ruínas, eras e maravilha destravam os cartões. Cada um ganha um "cartão-postal": a câmera enquadra a construção no mapa do próprio jogador e grava uma imagem.

**Por quê.** São 28 curtas *Hands on History* de 3 a 5 minutos, destravados na campanha do AoE IV, mais os textos de história das civilizações no AoE II. O Retalhos já tem a pesquisa histórica com fontes; falta levá-la para dentro do jogo.

**Custo** P–M. **Risco** baixo; os textos precisam de revisão. **Tipo** conteúdo e interface.

---

## 5. As 5 primeiras a fazer

1. **Avanço de eras, com o Centro e o marco da era (proposta 1, M).**
   - É a assinatura do AoE e o maior ganho de "arco" de partida.
   - Não depende de nada.
   - Como o Centro é um objeto avulso, a virada não exige rebuild.
   - A troca de estilo das casas (proposta 2) vem depois, quando o `rebuild` estiver medido no WebGPU.
2. **Andaimes e obra animada (proposta 4, P).**
   - Dá corpo às interações, o sistema mais original do Retalhos, por um custo mínimo.
   - Mexe só na peça viva.
   - Serve depois ao marco da era e à maravilha.
3. **Bônus de civilização por tema (proposta 6, P–M).**
   - Transforma os 14 temas em 14 jeitos de jogar com 2 campos novos em `Rules`.
   - Usa o caminho que já existe: `rules` por tema, oráculo e `SAVE_VERSION`.
4. **Legibilidade com teste automático (proposta 5, P).**
   - Protege tudo o que vem depois. Com GTAO, bloom e profundidade de campo entrando agora, o teste de contraste e o `?silhueta` pegam regressões cedo.
   - Corrige o Inverno, onde todos os telhados somem de longe [M].
5. **Aldeões trabalhando (proposta 8, M).**
   - É o sinal de vida mais forte do AoE.
   - Reaproveita o `Life` (pools animados).
   - Só aparece de perto e cabe no orçamento: +3 draw calls e ~4 mil triângulos.

**Orçamento das cinco juntas:** cerca de +6 draw calls (Centro 2, andaime transitório 1, aldeões 3) e +5 mil triângulos, contra ~94 draw calls e ~1,37 milhão de triângulos com 300 peças (AGENTS.md). Fica dentro da regra de no máximo ~10% sem justificativa.

**Verificação a cada passo:**

- `npm run check`;
- `SHOTS=… node scripts/screenshots.mjs`, olhando as imagens;
- `RUNS=300:high node scripts/stress.mjs`, antes e depois.

**Logo depois, nesta ordem:**

1. sítios e terra incógnita (11 e 12) juntos, que dão um motivo para expandir e mudam a cara do vazio;
2. a fanfarra e as camadas de som da era (18a);
3. os estandartes de missão (15), que também resolvem a pendência jurídica de VIABILIDADE §8;
4. a maravilha (13).

---

## 6. Versões alternativas do jogo

| Modo | Inspiração no AoE | Regras | Reaproveita | Custo |
|---|---|---|---|---|
| **Corrida da Maravilha** | Wonder Race (AoE II: The Conquerors) | começa na Era III com 35 peças; termina quando a maravilha completa; nota = peças que sobraram × 50 + pontos | propostas 1, 4 e 13 | P depois da 13 |
| **Império Pronto** | Empire Wars (AoE II DE: começa com a economia montada e 27 aldeões já trabalhando) | 12 peças já colocadas pela IA gulosa (o código de `?auto=`), Era II, 25 peças na pilha; partida de ~10 min, boa para o celular | `autoPlace`, proposta 1 | P |
| **Exploradores** | ruínas e artefatos (AoE I), Capture the Relic (AoE II), tesouros (AoE III) | 10 sítios e pilha de 50; termina quando acha todos; medalha pelas peças usadas | propostas 11 e 12 | P depois da 11 |
| **Estrada Real / Rota da Seda** | rota de comércio com postos (AoE III) | `railChance` de 0,20; rota desenhada no pergaminho com 4 postos; rotas valem pontos e peças | propostas 12 e 14 | M |
| **Arena de bênçãos** | Arena of the Gods (AoM: Retold), The Crucible (AoE IV, modo *roguelite* de 2025) | jornada de 5 mapas de 25 peças; depois de cada um, uma bênção que passa adiante; sem derrota, só pontuação acumulada | proposta 3 | M |
| **Crônicas** | campanhas históricas e *Hands on History* | 14 capítulos (um por tema), semente fixa, 3 objetivos cada (Egito: "3 Celeiros Reais", "Nilo com 8 ou mais peças", "pirâmide numa vila de 10 ou mais"); medalhas bronze, prata e ouro por pontuação, sem cronômetro, como as do Art of War do AoE II DE; cada capítulo termina num cartão do Almanaque | propostas 1, 6 e 20 | G |
| **Mapa livre** | editor de cenários (AoE II) | escolher as bordas de cada peça, montar e compartilhar por link `?mapa=` (base64url de q, r, 6 bordas e rotação, validado com limites, invariante 12) | núcleo e render | M |
| **Desafio da semana** | medalhas do Art of War (AoE II DE) | semente da semana ISO; medalhas por pontuação guardadas no aparelho | `?seed=` | P |

Todos mantêm o clima: nenhum tem relógio, derrota punitiva ou oponente.

---

## 7. Cuidados jurídicos

*Isto não é aconselhamento jurídico; consulte um advogado de propriedade intelectual antes de lançar.*

- **Ideias e regras são livres.** Tudo o que este documento tira do AoE é ideia ou regra de jogo. Alguns exemplos:
  - avançar de era por pontos;
  - escolher 1 de 2 na virada;
  - rendimento que cresce com a distância;
  - relíquia que rende por jogada;
  - influência em volta de um prédio.

  Nos EUA, ideias, sistemas e métodos ficam fora do direito autoral (17 U.S.C. §102(b)). No Brasil, a Lei 9.610/98, art. 8º, I e II, exclui ideias, sistemas e "regras para jogar". É o mesmo argumento de PESQUISA.md §6.
- **O que não pode vir do AoE:**
  - nomes e marcas: Age of Empires, Age of Mythology, AoE;
  - arte: sprites, modelos, ícones, retratos, telas de carregamento;
  - interface: o painel inferior, a barra de quatro recursos com os ícones de carne, madeira, ouro e pedra, o minimapa em losango com a moldura deles;
  - sons: o "Wololo", que é o canto do sacerdote do AoE I, as vozes dos aldeões e as fanfarras;
  - música e textos: descrições de civilizações, textos de história.
- **Regras de uso de conteúdo da Microsoft.** As *Game Content Usage Rules* permitem uso pessoal e não comercial; não valem para um produto vendido. O Retalhos não deve usar nenhum asset nem captura do AoE, nem no marketing.
- **Nomes de era.** Não usar a sequência "Idade das Trevas, Feudal, dos Castelos, Imperial" como rótulo. Usar os nomes por tema da proposta 1.
- **Cores do jogador.** Não reproduzir o conjunto e a ordem do AoE II (azul, vermelho, verde, amarelo, verde-azulado, roxo, cinza, laranja) com os mesmos tons puros. A paleta da proposta 15 é própria.
- **Maravilhas.** Prédios antigos são de domínio público, e a lista da proposta 13 evita os mesmos prédios do AoE II para não parecer lista copiada. Obras modernas têm direito autoral de arquitetura. No Brasil, o art. 48 da Lei 9.610 permite representar obras em logradouros públicos "por meio de pinturas, desenhos, fotografias e procedimentos audiovisuais", mas a regra varia por país. Por isso a lista usa só prédios históricos ou genéricos (a Catedral de Brasília, de 1970, ficou de fora de propósito).
- **Marketing.** Nunca usar "Age of Empires" em título, tags, ícone, descrição de loja ou anúncio (por exemplo, "o Age of Empires dos puzzles"). Comparações feitas pela imprensa são outra coisa.
- **Som.** Tudo continua sintetizado, como hoje. Não imitar motivos melódicos conhecidos (o canto de conversão, a fanfarra de avanço de era).
- **Patentes.** Não encontrei patentes do AoE sobre essas mecânicas, mas mecânicas podem ser patenteadas em alguns países (caso Nintendo × Pocketpair). Faça a busca de anterioridade recomendada em PESQUISA.md §6.2 antes de vender.

---

## 8. Fontes

**AoE IV: arte, legibilidade, construção, música e línguas**
- [Windows Central: entrevista sobre o AoE IV (legibilidade, prédios como personagens, do pau-a-pique à Era Imperial)](https://www.windowscentral.com/age-empires-4-preview-event-interview)
- [MobileSyrup: entrevista com a Relic](https://mobilesyrup.com/2021/04/10/age-of-empires-iv-relic-developer-interview/)
- [Gamepressure: desenvolvedores respondem às críticas ao visual](https://www.gamepressure.com/newsroom/age-of-empires-4-takes-flak-for-visuals-devs-respond/z13167)
- [PCGamesN: a discussão sobre os gráficos do AoE IV](https://www.pcgamesn.com/age-of-empires-4/graphics)
- [Windows Central: análise do AoE IV (marcos construídos com andaimes)](https://www.windowscentral.com/age-of-empires-iv)
- [Fórum oficial: construtores e prédios em obra (aldeões-fantasma)](https://forums.ageofempires.com/t/age4-as-for-builders-and-buildings-under-construction/127254)
- [Fandom: falas dos aldeões ingleses (AoE IV)](https://ageofempires.fandom.com/wiki/Villager_(Age_of_Empires_IV)/English_dialogue_lines)
- [Site oficial: ingleses no AoE IV](https://www.ageofempires.com/games/age-of-empires-iv/civilizations/english/)
- [Audiokinetic: a música do AoE IV](https://blog.audiokinetic.com/en/the-music-of-age-of-empires-iv)
- [Dynamedion: bizantinos e japoneses (koto, shakuhachi, shamisen)](https://dynamedion.com/news/age-of-empires-iv-byzantines-japanese/)

**AoE IV: marcos, vitória, influência e civilizações**
- [Fandom: Landmark](https://ageofempires.fandom.com/wiki/Landmark)
- [Fandom: Victory](https://ageofempires.fandom.com/wiki/Victory)
- [Fandom: Dynasty (chineses)](https://ageofempires.fandom.com/wiki/Dynasty)
- [Fandom: Mill (AoE IV)](https://ageofempires.fandom.com/wiki/Mill_(Age_of_Empires_IV))
- [Fandom: Hunting Cabin](https://ageofempires.fandom.com/wiki/Hunting_Cabin)
- [Fandom: Cistern](https://ageofempires.fandom.com/wiki/Cistern)
- [Fandom: Aqueduct (AoE IV)](https://ageofempires.fandom.com/wiki/Aqueduct_(Age_of_Empires_IV))
- [Fandom: Golden Age](https://ageofempires.fandom.com/wiki/Golden_Age)
- [Fandom: Pit Mine](https://ageofempires.fandom.com/wiki/Pit_Mine)
- [Fandom: Ovoo](https://ageofempires.fandom.com/wiki/Ovoo)
- [Fandom: Mongols (AoE IV)](https://ageofempires.fandom.com/wiki/Mongols_(Age_of_Empires_IV))
- [Fandom: Trade Caravan](https://ageofempires.fandom.com/wiki/Trade_Caravan)

**AoE IV: biomas, atmosfera, eventos e cosméticos**
- [Fandom: Random map (biomas; ovelhas brancas fora da neve)](https://ageofempires.fandom.com/wiki/Random_map)
- [Suporte oficial: Ultimate Atmosphere Guide](https://support.ageofempires.com/hc/en-us/articles/8330758084628-Ultimate-Atmosphere-Guide)
- [PCGamesN: Enchanted Grove, temporada 4](https://www.pcgamesn.com/age-of-empires-4/season-4-enchanted-grove-update)
- [Wccftech: temporada 4 (Enchanted Grove, modo Nômade)](https://wccftech.com/age-of-empires-iv-season-4-enchanted-grove-details-release-date/)
- [Fandom: Mastery](https://ageofempires.fandom.com/wiki/Mastery)
- [Fórum oficial: brasões e monumentos](https://forums.ageofempires.com/t/coat-of-arms-and-monuments/134968)

**AoE IV: história e lançamentos**
- [GamesRadar: mais de uma hora de minidocumentários](https://www.gamesradar.com/age-of-empires-4-features-more-than-an-hour-of-mini-historical-documentaries/)
- [PCGamesN: Hands on History](https://www.pcgamesn.com/age-of-empires-4/hands-on-history-videos)
- [TechRaptor: a história por trás do Hands on History](https://techraptor.net/gaming/features/age-of-empires-4-hands-on-history-interview)
- [Fandom: Dynasties of the East (04/11/2025, modo The Crucible)](https://ageofempires.fandom.com/wiki/Age_of_Empires_IV:_Dynasties_of_the_East)
- [Site oficial: o que vem em 2026](https://www.ageofempires.com/news/whats-coming-in-2026-for-age-of-empires-and-age-of-mythology/)
- [Windows Central: expansões de 2026](https://www.windowscentral.com/gaming/xbox/age-of-empires-and-age-of-mythology-2026-expansions)

**AoE II: arquitetura, eras, economia e interface**
- [Fandom: Architecture set (AoE II)](https://ageofempires.fandom.com/wiki/Architecture_set_(Age_of_Empires_II))
- [Fandom: Building (AoE II)](https://ageofempires.fandom.com/wiki/Building_(Age_of_Empires_II))
- [Site oficial: avançar de era no AoE II](https://www.ageofempires.com/learn-to-play/advancing-aoe2/)
- [Fandom: Trade Cart (fórmula do ouro por viagem)](https://ageofempires.fandom.com/wiki/Trade_Cart_(Age_of_Empires_II))
- [Fandom: Market (AoE II)](https://ageofempires.fandom.com/wiki/Market_(Age_of_Empires_II))
- [Fandom: Relic (AoE II)](https://ageofempires.fandom.com/wiki/Relic_(Age_of_Empires_II))
- [Fandom: Folwark](https://ageofempires.fandom.com/wiki/Folwark_(Age_of_Empires_II))
- [Fandom: Gurjaras, estratégia](https://ageofempires.fandom.com/wiki/Gurjaras/Strategy)
- [Fandom: Villager (AoE II)](https://ageofempires.fandom.com/wiki/Villager_(Age_of_Empires_II))
- [Fandom: Berry Bush](https://ageofempires.fandom.com/wiki/Berry_Bush)
- [Fandom: Shore Fish](https://ageofempires.fandom.com/wiki/Shore_Fish)
- [Fandom: Fishing](https://ageofempires.fandom.com/wiki/Fishing)
- [Fandom: Tree (árvores avulsas)](https://ageofempires.fandom.com/wiki/Tree)
- [Fandom: Wonder (AoE II)](https://ageofempires.fandom.com/wiki/Wonder_(Age_of_Empires_II))
- [Fandom: Player (cores)](https://ageofempires.fandom.com/wiki/Player)
- [Fandom: Mini map](https://ageofempires.fandom.com/wiki/Mini_map)
- [Age of Notes: como funciona a névoa de guerra no AoE II DE](https://ageofnotes.com/faq/how-does-the-fog-of-war-work-in-age-of-empires-ii-definitive-edition/)
- [Fandom: User interface](https://ageofempires.fandom.com/wiki/User_interface)
- [Windows Central: análise do AoE II DE](https://www.windowscentral.com/age-empires-ii-definitive-edition-review)
- [Fandom: The Last Chieftains (17/02/2026, Mapuche, Muisca e Tupi)](https://ageofempires.fandom.com/wiki/Age_of_Empires_II:_Definitive_Edition_-_The_Last_Chieftains)

**AoE II: modos**
- [Liquipedia: Empire Wars](https://liquipedia.net/ageofempires/Empire_Wars/Age_of_Empires_II)
- [Fandom: The Art of War](https://ageofempires.fandom.com/wiki/The_Art_of_War_(Age_of_Empires_II))
- [Fandom: Capture the Relic](https://ageofempires.fandom.com/wiki/Capture_the_Relic)
- [Fandom: King of the Hill](https://ageofempires.fandom.com/wiki/King_of_the_Hill)
- [PC Gamer: por que o editor de cenários do AoE II é tão amado](https://www.pcgamer.com/why-i-love-age-of-empire-2s-scenario-editor/)

**AoE I**
- [AoE Heaven: Ruins and Artifacts](https://aoe.heavengames.com/theacademy/multiplayerstrategies/ruins-and-artifacts/)
- [Fandom: Ruins](https://ageofempires.fandom.com/wiki/Ruins)
- [Fandom: Artifact](https://ageofempires.fandom.com/wiki/Artifact)
- [Fandom: Priest (AoE II), sobre o "Wololo"](https://ageofempires.fandom.com/wiki/Priest_(Age_of_Empires_II))

**AoE III**
- [Fandom: Trade Route](https://ageofempires.fandom.com/wiki/Trade_Route)
- [Fandom: Trading Post (AoE III)](https://ageofempires.fandom.com/wiki/Trading_Post_(Age_of_Empires_III))
- [Fandom: Home City Card](https://ageofempires.fandom.com/wiki/Home_City_Card)
- [Fandom: Experience](https://ageofempires.fandom.com/wiki/Experience)
- [Fandom: Politician](https://ageofempires.fandom.com/wiki/Politician)
- [Fandom: Treasures](https://ageofempires.fandom.com/wiki/Treasures)
- [GameSpot: perguntas e respostas sobre a tecnologia do AoE III](https://www.gamespot.com/articles/age-of-empires-iii-qanda-technology-overview/1100-6120033/)
- [Hardcore Gaming 101: Age of Empires III](https://www.hardcoregaming101.net/age-of-empires-iii/)

**Age of Mythology e Retold**
- [Fandom: Gaia, estratégia (Lush)](https://ageofempires.fandom.com/wiki/Gaia_(goddess)/Strategy)
- [Fandom: Rain](https://ageofempires.fandom.com/wiki/Rain)
- [Fandom: Gaia Forest](https://ageofempires.fandom.com/wiki/Gaia_Forest)
- [Fandom: Favor](https://ageofempires.fandom.com/wiki/Favor)
- [Game Rant: deuses maiores e menores no Retold](https://gamerant.com/age-of-mythology-retold-major-minor-god-norse-greek-egyptian/)
- [Windows Central: análise do Retold](https://www.windowscentral.com/gaming/xbox/age-of-mythology-retold-review-a-wonderful-remake-that-lays-the-foundation-for-years-of-expansions)
- [Gamereactor: análise do Retold](https://www.gamereactor.eu/age-of-mythology-retold-1425313/)
- [PCGamesN: Arena of the Gods](https://www.pcgamesn.com/age-of-mythology-retold/new-mode-arena-of-the-gods)
- [Fandom: Age of Mythology: Retold (Immortal Pillars e Heavenly Spear)](https://ageofempires.fandom.com/wiki/Age_of_Mythology:_Retold)
- [Neowin: Heavenly Spear lançado](https://www.neowin.net/news/age-of-mythology-retold-heavenly-spear-expansion-launches-with-a-massive-free-update/)

**Age of Empires Online**
- [Remember Ensemble Studios: análise da direção de arte do AoE Online](https://remember-ensemblestudios.com/2011/08/age-of-empires-online-review-%E2%80%93-part-3-%E2%80%93-art-design/)
- [Wikipedia: Age of Empires Online](https://en.wikipedia.org/wiki/Age_of_Empires_Online)

**Jurídico**
- [Xbox: Game Content Usage Rules](https://www.xbox.com/en-us/developers/rules)
- [Xbox Wire: esclarecimento sobre as regras de uso de conteúdo](https://news.xbox.com/en-us/2015/01/15/game-content-usage-rules-clarification/)
- [U.S. Copyright Office: Circular 33](https://www.copyright.gov/circs/circ33.pdf)
- [WIPO Lex: Lei 9.610/98 (Brasil)](https://www.wipo.int/wipolex/es/text/1304)

**Documentos do próprio projeto**
- `AGENTS.md`: invariantes, orçamento de desempenho e como estender.
- `docs/TEMAS.md`: pesquisa histórica dos temas e a lista de kits que faltam (salão viking, portais, templos por cultura).
- `docs/PESQUISA.md`: mecânicas do gênero e aspectos legais (§6).
- `docs/VIABILIDADE.md`: medições, a pendência dos marcadores de missão (§8) e o balanceamento (Apêndice B).
