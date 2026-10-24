# Egito do Nilo: aprofundamento (`egito`)

## 1. Identidade
Vale do Nilo no Novo Império (c. 1300 a.C.): uma faixa verde e estreita entre dois desertos dourados, com a água turquesa no meio. A pessoa deve sentir calor, luz alta, silêncio de deserto e a fartura calma da cheia. O contraste "terra negra x terra vermelha" é o que define o tema.

## 2. Os 6 terrenos reinterpretados
| Borda | Hoje | Vira | O que muda de forma |
|---|---|---|---|
| Prado | Várzea | **Várzea / Deserto** (Kemet x Deshret) | Hoje é capim verde. Passa a ter dois humores pela semente da peça: terra negra úmida com juncos e lótus, ou duna vermelha-dourada com pedra, tufos secos e ossos de gado. Ver "campo novo" abaixo. |
| Floresta | Palmeiral | **Palmeiral e Sicômoros** | Tamareira em tufos de 3 troncos (hoje é uma por vez), sicômoro de copa larga, acácia. Sombra densa, sem coníferas. Cachos de tâmaras (bagas laranja). |
| Plantação | Lavoura | **Campo da cheia** | Mantém trigo-emmer, cevada, linho e papiro, mas ganha **canais de irrigação em grade** (sulcos de água turquesa entre os canteiros) e **shadufs** nas bordas. Os canteiros são quadrados baixos com diques, não faixas soltas. |
| Vila | Aldeia | **Aldeia de adobe** | Casas de tijolo cru em terraço, com escada externa, cesto de grão no teto, cortina listrada. Ver seção 3. |
| Rio | Nilo | **Nilo** | Largo, turquesa, com juncos e papiros nas margens, lótus nas curvas, correnteza lenta. |
| Estrada | Trilha | **Trilha de areia com burros** | Mantém `sand`; a caravana passa a ser de burros e cargas em cestos (hoje é camelo, anacrônico: ver seção 4). |

**Campo novo (a ideia central de distinção, como as tulipas da Holanda): a Faixa Fértil.** A cor do chão da Plantação e do Prado depende da distância ao rio. Plantação ou Prado cuja peça tem Rio num vizinho fica **terra negra** (`#4a3a28`, úmida, brilho leve); sem rio por perto, o chão é duna e o canteiro seca em tom de palha (poucas fileiras, mais pedra). O jogador vê a faixa verde acompanhar o rio e o deserto engolir o resto, que é exatamente a geografia do Egito. Pontuação não muda (só visual, invariante 11).

**Cheia do Nilo (visual, por peça, sem estado novo):** na borda de Plantação colada a Rio, a lâmina de água entra no canteiro (reflexo turquesa, como o arroz da Song em `rice`) e os canteiros viram ilhotas com garças. Decidido só por `(edges, seed)`, então respeita a invariante 3. Sem mudar nada no jogo, a estação do tema pode alternar com a regra das estações já existente (a cada 20 jogadas): "Akhet" (cheia, água alta, lâmina nos canteiros), "Peret" (semeadura, verde) e "Shemu" (colheita, dourado). Hoje as estações são ligadas ao `seasons.ts`; o tema só dá nomes e cores.

## 3. Construções
- **Casas** (vocabulário de hoje, ajustado): `cube`+`flat` (55%) com escada externa e abrigo de palha; `cottage`+`flat` baixas; `cube`+`dome` como silo abobadado; `annex` com currais; `long` como oficina de oleiro. Paredes em tons de cal e ocre, **nunca vermelho vivo**. Trim turquesa já existe. **Novo:** `BodyStyle` `'terrace'` (cubo de 2 níveis com terraço e escada) e `RoofStyle` `'awning'` (toldo de cana listrado sobre o terraço).
- **Marcos:** `pylon` (Karnak) fica como o principal. Acrescentar **obelisco** isolado (já existe `obelisk` em `Landmark`, só passar a usar) e **templo de colunas papiriformes** (`temple` com capitel de papiro, variante de `temple`). Pirâmide NÃO é marco de peça; vira **silhueta ao longe** (ver easter eggs e entorno).
- **Interações (synergy):** `lumber` = *Oficina de palmeira* (fica; fibra e cordas); `mill` = **Celeiro real com silos redondos** (fica; `granary`); `pasture` = **Curral de gado com bebedouro** (hoje só o nome, o desenho é de pasto comum: pedir curral de barro com gado de chifres de lira); `apiary` = colmeias de barro empilhadas (fica, é fiel à tumba de Rekhmire). Nova construção opcional: **shaduf** sobre `apiary`... não; o shaduf entra como decoração do Campo da cheia, não como interação.
- **Portal:** novo `GateStyle` `'pylon'` (portal trapezoidal de pilone, dois batentes inclinados) onde a trilha encosta na vila. **Ponte:** sem ponte de pedra no Egito antigo; troque por **passarela de canas sobre o rio** (`BridgeStyle` `'reed'`, plana com corrimão de cordas) ou omita. Recomendo omitir ponte e usar **balsa** de junco (já há `reedboat`).
- **Eras da vila (I a III, reaproveitando `progress.ts`):** I taipa com palha e sem escada; II adobe do tema; III sobrado com terraço, flâmulas de linho e janelas acesas. `eras` já se chama Pré-dinástico, Antigo, Médio e Novo Império (ótimo). **Centro:** `pyramid` (pirâmide com piramídio dourado) é o remate; manter. **Maravilha:** Pilone de Karnak com avenida de esfinges (já existe).

## 4. Vegetação, animais, barcos, veículos, o que se move
- **Vegetação:** `palm` 55%, `round` (sicômoro) 25%, `olive`→ acácia 10%, e **juncos/papiro nas margens do rio** (uma moita `reed` em toda borda de rio). Lótus (`lily`) azul e branco abundantes, `flowers` lótus. Arbustos de henna (`bush` em verde-prata).
- **Animais:** trocar `camel` por **`donkey`** (já existe) como padrão; camelo fica como raro para o easter egg do Ptolomeu. Acrescentar **gado de chifres de lira** (`AnimalKind` `'ox'` ou cor/orelha do `cow`, kit P), **íbis sagrado** (pássaro branco de bico curvo, no bando e parado na margem) e **crocodilo** (corpo baixo e comprido, flutua na borda do rio, some ao ver barco; kit M). Aldeões com `scarf` e saiote (já há `folk` skin/`scarf`).
- **Barcos:** `nile` (vela quadrada) como padrão; **balsa de papiro** (`reedboat`) e, raro, **barco solar cerimonial** (casco de crescente, `BoatKind` `'solar'`, kit M). Os barcos puxam peixes (já há `fish`).
- **Veículos:** `caravan` com burros e cestos; trocar o fardo por **ânforas e sacos de grão**.
- **O que se move (`life.ts`):** shaduf balança (contrapeso, dt do tick; usa pool novo), gado bebe, íbis alça voo se um barco passa, crocodilo submerge, pó de areia no deserto, moinho de mão não; **sem moinho de vento** (anacrônico).

## 5. Água, entorno, clima, hora, paleta, som
- **Água:** `water #2fb0aa` (turquesa) com leito **marrom-terra** perto da margem (`bank #5a4a30`, mais escuro que hoje) para o turquesa pular da faixa negra. Lótus e juncos. A cheia sobe a lâmina em Akhet.
- **Entorno:** `surround: 'areia'` (já é) com **pirâmides de Gizé como silhueta no horizonte** (3 pirâmides pequenas desenhadas no `makeVoidMaterial` ou como uma malha única em volta do mapa, fora do raio explorado; uma única draw call). Efeito: o jogador sente "estou na faixa fértil e o deserto cerca". Sem tipo novo de `surround`; só um campo `skyline?: 'piramides'`.
- **Clima:** `dust` (poeira) vira **`sandstorm` rara** (nuvem de areia baixa que escurece o fundo por 10 s) e vento quente (`atmos.wind` 0,65 já combina). Sem chuva (o clima tocável existe, mas chuva no Egito é anedota: ver easter egg).
- **Hora do dia / luz:** sol alto e forte (`sunIntensity` 2.6 fica), sombras curtas ao meio-dia, **entardecer laranja-rosado** com siluetas, noite estrelada nítida (céu seco) com **lamparinas de óleo** nas terraços (`roadLamps` ligado). Luz da noite com mais estrelas.
- **Paleta:** areia dourada `#efdfa8`, turquesa, **verde-papiro, ocre vermelho, lápis-lazúli `#2a4b8d`** (cor de detalhes de templo), branco-cal, preto da terra negra. Hoje falta o **lápis-lazúli** e o **vermelho de ocre** como acentos; usar em trim, faixas de tecido e `landmarkColors`. `grade.shadow` azulado (já), `saturation` 1.08.
- **Som (`audio.ts`):** escala frígia/hijaz `[0,1,4,5,7,8,10]` já está (bom). Trocar `timbre` de `reed` para **flauta de junco** com sopro mais aberto, e acrescentar **sistro** (`pluck` curto agudo, pulso de chocalho) na camada de era ≥2. Ambiente: **gafanhotos/grilos e água corrente à noite**, sino de templo na virada de era, **burro zurrando** raro. Campo novo sugerido: `music.rattle?: boolean` (só dado) e `Ambience` já existente.

## 6. Easter eggs (determinísticos)
1. **Rota de Rá (hora):** ao meio-dia exato (hora do jogo `time` ≈ 0,5), numa peça com Vila e Rio, o disco solar do `eraWave` brilha no pilone e o barco solar passa devagar no rio uma única vez por partida. Dispara por hora + semente da peça.
2. **Cheia perfeita (combinação):** 3 peças de Rio seguidas formando uma curva ligando uma Plantação inteira (todas as bordas da peça de campo tocam o rio nos dois lados): a lâmina enche, os canteiros viram ilhotas e aparece um **íbis** parado. Regra: peça `Plantação` em 4 de 6 bordas com vizinhos de Rio.
3. **Pirâmide na linha do horizonte (número de peças):** a 38ª peça (número de peças iniciais) faz surgir a **Esfinge** pequena na borda do mapa, olhando para o Centro. Ao 100, a pirâmide de Gizé aparece completa com o piramídio dourado brilhando.
4. **Gato sagrado (data):** em 20 de fevereiro (Dia do Gato? data fictícia) ou no dia 1º de qualquer mês: um **gato** (silhueta preta) senta no terraço de uma casa da aldeia, só em uma casa por partida. Gato fica seguro de usar sem data: a semente de dia (`AAAAMMDD`) escolhe a casa.
5. **Chuva no deserto (clima tocável):** se o jogador dispara `chuva`/`rain` no Egito, as pessoas **saem de casa para olhar** e um arco-íris aparece; fala-se "nunca choveu aqui". Só no tocável, fora do save.
(Extra, sem custo: **hieróglifos no pergaminho do vazio**: sequência de cartuchos com o nome do jogador em transliteração aparece ao pausar; só HTML/CSS em `frames.ts`.)

## 7. De temas que somem
Egito não é fusão. Aproveitar de **Andes** o *kancha* (templo de pedra) como padrão para o templo de pedra sem colunas, **Toscana** o cipreste em alameda para a avenida de esfinges (cipreste ≠ Egito, descartar a árvore) e **Colônia Marciana** nada. **Toscana/Oeste**: nada que valha, descartar.

## 8. Lista de trabalho
| Item | Tipo | Triângulos | Draw call nova? |
|---|---|---|---|
| Chão negro x duna pela proximidade do rio (uso de `ground` + mapa) | dado + 1 campo | 0 | não |
| Canal de irrigação nos canteiros | M, `tileBuilder` | ~120/peça de campo | não (usa pool existente) |
| Shaduf | P | ~60 | sim (1 pool) |
| Cheia (lâmina no campo) | shader/água | 0 | não |
| Tamareira em tufo, juncos nas margens | P | ~80 | não |
| Íbis, crocodilo | P/M | ~50 / ~90 | sim (1 pool cada, ou um pool de "fauna") |
| Burros na caravana, cestos | dado + P | ~40 | não |
| `BodyStyle` terrace, `RoofStyle` awning | M | ~150 | não (2 draws por tipo de casa) |
| `GateStyle` pylon, ponte de canas (opcional) | P | ~100 | não |
| Silhueta das pirâmides no `surround` | M | ~40 total | não (mesmo material do vazio) |
| Sistro e grilos (`audio.ts`) | dado + código leve | 0 | não |
| Campos novos em `Theme` | | | `skyline?`, `floodplain?: boolean` (chão por distância ao rio), `music.rattle?` |

**Ordem sugerida:** (1) dados: burro, paleta, lápis-lazúli, nomes, ambiente; (2) chão negro x duna + `floodplain`; (3) canal de irrigação e cheia; (4) tamareira em tufo, juncos, shaduf; (5) íbis e crocodilo; (6) terraço, toldo, portal; (7) pirâmides no horizonte; (8) som; (9) easter eggs.

## 9. Riscos
- **Legibilidade (`tests/legibility.ts`):** casas de cal/areia contra chão de vila de areia já são o par mais frágil do jogo. Lápis-lazúli e toldos listrados ajudam, mas **terra negra** deixa a vila MAIS legível (bom) e **duna dourada** a deixa menos: medir ΔE antes. Adobe claro sobre chão `#b8a274` precisa de sombra de beiral.
- **Orçamento:** pool novo por criatura soma draw calls; juntar íbis+crocodilo+gato num pool de "fauna pequena" para ficar abaixo de +10% (AGENTS.md). Canal de irrigação por peça sobe triângulos em campos: limitar a 2 canais por peça.
- **Invariantes:** 3 (a cheia e o chão negro precisam sair de `(edges, seed)` e do mapa de rios vizinhos, o que já é permitido via `opts`, mas **o chão por proximidade do rio muda a aparência conforme os vizinhos, igual à costura de cor**: seguir o padrão do `seamAt`, nunca a geometria); 8 (sem `if (theme.id === 'egito')`: tudo via `floodplain` e `skyline`); 11 (shaduf e irrigação são visuais); 13 (shaduf e crocodilo andam pelo `dt`); `SAVE_VERSION` não muda (nada de regra).
- **Anacronismo:** camelo (Ptolomeu), vela latina, moinho de vento. Evitar.
