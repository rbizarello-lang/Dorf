# Retalhos

Puzzle relaxante de peças hexagonais, no gênero de Dorfromantik, com **14 temas de países e épocas**, **interações entre tipos de borda** e um mundo que se mexe: trigo ondulando ao vento, barcos descendo os rios, trens e caravanas nas estradas, moinhos girando, animais pastando e janelas que acendem à noite. Feito com Three.js (WebGPU, com WebGL2 automático onde não houver WebGPU), TypeScript e Vite, sem nenhum arquivo de arte: peças, casas, plantações, animais e sons são gerados em código.

![Toscana Renascentista](docs/screens/toscana.png)

- **Estudo de viabilidade:** [docs/VIABILIDADE.md](docs/VIABILIDADE.md)
- **Pesquisa de mecânicas, stacks, mercado e aspectos legais:** [docs/PESQUISA.md](docs/PESQUISA.md)
- **Pesquisa dos temas históricos:** [docs/TEMAS.md](docs/TEMAS.md)
- **Para agentes de IA e quem vai mexer no código:** [AGENTS.md](AGENTS.md) (arquitetura, invariantes, como estender e verificar)

## Rodar

```bash
npm install        # Node 22.12 ou mais novo
npm run dev        # servidor de desenvolvimento
npm run build      # gera dist/index.html (arquivo único)
npm run typecheck
npm test           # simula 600 partidas e confere regras, interações, missões e replay
npm run check      # typecheck + testes + build (o mesmo que a CI roda em cada pull request)
```

## Como jogar

Coloque peças encostadas no mapa. A pilha começa com 50 peças. Cada borda que combina com a vizinha vale 10 pontos. **Rio e estrada** precisam continuar: só encostam neles mesmos. Os rios mudam de largura de peça em peça; peças com várias bordas de água vizinhas trazem um lago, e lagos encostados pela boca viram um lago só. Quando a peça encosta em 2 ou mais vizinhas e todas as bordas combinam, o encaixe é **perfeito**. Cercar uma peça com 6 vizinhas encaixadas devolve uma peça à pilha. A partida acaba quando a pilha esvazia.

**Missões** chegam em algumas peças (marcadas com "!") e dão peças extras:

| Missão | O que pede | Recompensa |
|---|---|---|
| Grupo ("9 ou mais", "exatamente 8") | o grupo do terreno chegar ao tamanho; "exatamente" falha se passar | 10 pontos por peça pedida e +5 peças (mais 1 a cada 6), ou +7 na exata |
| Fechar | nenhuma borda do grupo virada para o vazio | 10 pontos por peça do grupo e +6 peças |
| Encaixes perfeitos | N encaixes perfeitos a partir dali | 20 pontos por encaixe pedido e +5 peças |
| Interação ("3× Serraria") | N interações daquele tipo a partir dali | 15 pontos por interação pedida e +5 peças |

Nas primeiras partidas, um cartão curto explica cada coisa na primeira vez que ela acontece (encaixe perfeito, missão, interação, sítio, era, maravilha). A ajuda (`?`) tem abas por assunto e um botão para rever as dicas.

O recorde é guardado por modo e por tema, com a semente; no fim da partida, "Repetir a semente" joga a mesma sequência de peças de novo.

**Eras da vila:** com 500, 1.500 e 3.000 pontos a vila muda de era (os nomes mudam por tema, como Borgo → Comune → Signoria → Rinascimento na Toscana) e ganha +3 peças. A cada era, o Centro da vila (no meio da primeira peça) muda de forma, de fogueira com cabanas a palácio, e uma onda dourada corre pelo mapa. As casas do mapa inteiro mudam junto: na primeira era são menores, de taipa e palha; na segunda, o tema como ele é; na terceira ganham enxaimel ou molduras e o tipo de casa mais raro vira sobrado; na última, os sobrados hasteiam flâmulas na cor da casa e as janelas acendem mais forte à noite. A próxima peça com vila ergue o marco da era, que o fantasma já mostra antes de colocar.

**Influência:** cada interação marca as casas vazias em volta da peça onde nasceu, que ganham um contorno dourado tracejado. Uma peça colocada numa delas ganha pontos por setor do terreno que a construção trabalha: floresta para a serraria, plantação para o moinho, prado para o pasto e os dois para as colmeias. Vale +1 por setor na primeira era, +2 na segunda e na terceira e +3 na última (as colmeias, +1 e, na última era, +2). Cada tipo conta uma vez por casa, e o bônus vai até +8 por peça. Com o fantasma numa casa contornada, a etiqueta mostra o ganho.

**Escolha da era:** a cada era nova a vila escolhe 1 de 2 cartas (clique ou teclas `1` e `2`), e a carta vale até o fim da partida. São 8: Guilda dos carpinteiros, Moleiros, Pastores e Apicultores (+5 por interação do tipo), Agrimensores (+10 por encaixe perfeito), Mestres de obras (+1 peça por peça cercada), Peregrinos (+2 peças por missão cumprida) e Cartógrafos (próximas peças à vista por 10 jogadas e +1 peça por sítio). Alguns temas dão nomes próprios, como os Escribas do faraó no Egito. A próxima peça espera a escolha.

**Maravilha:** na última era, a próxima peça com 2 ou mais bordas de vila vira o canteiro da maravilha do tema (Castelo de Conto no Vale, Pilone de Karnak no Egito, Cúpula de Brunelleschi na Toscana, Terraços de Moray nos Andes etc.). Cada peça colocada depois avança uma etapa da obra, que sobe dentro do andaime; com as 6 etapas ela fica pronta e rende +300 pontos e +6 peças.

**Sua casa:** no topo do menu de temas, escolha uma das 8 cores da casa (ou a do tema) e monte o brasão (metal, peça e móvel). A cor aparece no placar, nos estandartes das missões, nas bandeiras do Centro, dos marcos e dos barcos e nas camisas de metade dos aldeões.

**Moldura do tema:** os painéis mudam de material com o lugar (papiro no Egito, tábuas na Terra dos Vikings, seda na Dinastia Song, washi no Japão Edo, metal em Marte, cartaz no Oeste). O emblema ao lado do nome diz o tema antes do texto.

**Monumentos:** conquistas enfeitam a praça do Centro e ficam para as partidas seguintes. Dez serrarias numa partida erguem uma tora entalhada, a primeira maravilha uma estátua dourada, e vinte relíquias no total um relicário. O almanaque mostra quais já estão na praça.

**Sítios escondidos:** carimbos no mapa marcam ruínas (+60 pontos), tesouros (+2 peças), relíquias (+100 pontos e +1 peça) e mirantes (+20 pontos e as próximas 3 peças à vista por 10 jogadas). Com a peça em cima, uma etiqueta mostra a recompensa; coloque para descobrir, e o sítio vira uma ruína, um baú, um relicário ou uma torre de vigia na peça. Ficam em anéis cada vez mais longe do centro. O vazio é um mapa antigo: a tinta desbota longe das peças e uma névoa clara cobre o desconhecido. No começo da partida, um batedor sai do Centro na direção do sítio mais perto.

**Peças especiais:** liberadas jogando, valem para as partidas seguintes e entram duas vezes em cada uma (menos no Desafio do dia, que é igual para todos). A **Estação** (8 missões cumpridas no total) vale +12 por peça com trilho a até 2 casas e +2 peças; o **Moinho d'água** (30 interações) vale +20 por vizinha com plantação e +1 peça; o **Farol** (6 sítios descobertos) vale +10 por peça com rio a até 2 casas e mostra as próximas peças por 5 jogadas. O fim da partida mostra quanto falta para a próxima.

**Almanaque:** a aba Almanaque da ajuda (`H`, ou o botão no fim da partida) soma tudo o que já se fez entre as partidas: peças, missões, interações, sítios por tipo, peças especiais (liberadas e quanto falta para as outras) e, por tema, partidas, maior era, maravilha e recorde.

**Bônus de cada tema:** cada época tem uma regra curta, como a Dádiva do Nilo (borda de rio encaixada vale +5) no Egito ou os Moinhos de pôlder (+5 por moinho) na Holanda. Aparece no menu de temas.

**Desfazer:** `U` ou o botão desfaz a última jogada (3 vezes no Clássico).

**Modos:**

| Modo | Como é |
|---|---|
| Clássico | missões, eras e sítios; acaba quando a pilha esvazia |
| Zen | peças sem fim; pontos e eras por gosto |
| Desafio do dia | semente do dia e regras padrão, iguais para todo mundo; sem desfazer |
| Exploradores | 10 sítios e 60 peças; achar o último encerra, e cada peça que sobrou vale 20 pontos |

**Interações:** algumas bordas diferentes também "conversam". Quando se encostam, rendem +5 e erguem uma construção na borda. A prévia acende em dourado antes de você colocar a peça.

| Encontro | Construção (nome muda por tema) |
|---|---|
| vila + floresta | serraria / carpintaria |
| vila + plantação | moinho de vento ou celeiro |
| vila + prado | pasto com animais |
| plantação + prado | colmeias |

Algumas construções aparecem sozinhas dentro das peças, sem pontuar: vila à beira do rio ganha roda d'água, plantação irrigada fica mais verde e alta, vila junto à ferrovia ganha estação e plantação junto dela ganha silo.

| Ação | Mouse / teclado | Toque |
|---|---|---|
| Colocar | clique | toque no espaço, depois toque de novo ou ✓ |
| Girar peça | `R` / botão direito (`Shift+R` ou `T` para o outro lado) | botões ⟲ ⟳ |
| Mover câmera | arrastar, `WASD` ou setas | arrastar |
| Zoom | roda do mouse, `+` / `-` | pinça |
| Girar câmera | `Q` / `E`, ou arrastar com o botão direito | — |
| Inclinar câmera (do horizonte à vista de mapa) | arrastar com o botão direito para cima ou para baixo, `PgUp` / `PgDn`; `Home` volta ao ângulo padrão | dois dedos para cima ou para baixo |
| Amanhecer, dia, hora dourada, entardecer e noite | `L` ou botão ☀ | botão ☀ |
| Som: música e efeitos, só efeitos, mudo | botão Som; `M` liga ou desliga a música | botão ♫ |
| Ajuda, nova partida, estatísticas | `H`, `N`, `F` | botões no topo |
| Cor da casa e brasão | menu de temas, seção "Sua casa" | o mesmo |
| Foto sem a interface | `P` (Espaço pausa, `L` muda a hora, Enter salva, Esc sai) | botão Câmera |
| Gravar vídeo (até 2 minutos) | `V` começa e para | botão Câmera |

**Som de ambiente:** vem da paisagem em volta do foco da câmera: vento nos campos abertos (mais forte de longe), água correndo perto dos rios, pássaros nas florestas de dia, grilos e coruja à noite, sinos da vila e apito de trem. Colocar a peça também soa pelo terreno (respingo, folhas, trilho), e sítios, peças especiais e o desfazer têm som próprio. Fica ligado em "só efeitos".

## Foto e vídeo

O botão **Câmera** abre três opções:

- **Foto** (`P`): a interface some, o mundo pode ficar parado ou continuar animado, e a imagem sai em PNG no tamanho da tela, em 4K ou em 8K.
- **Gravar vídeo** (`V`): grava até 2 minutos do que você fizer. Ao parar, você escolhe o tamanho (1080p, 1440p ou 4K), a qualidade (Cinema, Ultra ou Alta) e a câmera: como foi gravada, suave ou cinematográfica.
- **Filme da partida**: a partida inteira refeita peça por peça, com a câmera se afastando conforme o mapa cresce, na hora do dia que você escolher.

Durante a gravação, o jogo anota só a câmera e as jogadas, então não fica mais pesado. O vídeo é desenhado depois, quadro a quadro, a 60 quadros por segundo, e sai em MP4 (H.264, ou VP9 onde não houver H.264). Por isso ele sai liso mesmo numa placa que não roda o Cinema em tempo real; só demora mais para exportar. Precisa de um navegador com WebCodecs, como o Chrome e o Edge; nos outros, o jogo avisa.

## Qualidade gráfica

O botão de qualidade abre a lista: **Auto**, **Cinema**, **Ultra**, **Alta**, **Média** e **Baixa**, cada uma com uma linha dizendo para que placa serve.

- **Auto** escolhe o começo pelo nome da placa de vídeo (por exemplo, Alta numa RX 580 e Ultra numa RTX 3060). Se o quadro ficar lento, primeiro baixa a resolução interna, em degraus até 60%, e só depois desce de nível. O nome da placa e o nível escolhido aparecem no título do botão.
- **Celular e tablet:** com a tela parada (sem toque e sem peça caindo), o jogo desenha a 30 quadros e, depois de 15 s, a 20, para poupar bateria; o mundo continua animado. No computador nada muda. Em tela estreita, as missões viram linhas finas (um toque abre os detalhes) e os estandartes encolhem.
- **Cinema** é para placas de topo e para fotos e vídeos: desenha 1,5× acima da tela, com mais amostras de luz e de reflexo, sombras mais finas, mais vegetação, grão de filme e uma leve aberração de lente. O Auto nunca escolhe o Cinema.

## Temas

| Época | Temas |
|---|---|
| Antiguidade | Egito do Nilo |
| Séculos V a XV | Jade Song (China), Terra dos Vikings, Toscana Renascentista, Andes Incas |
| Séculos XVI a XVIII | Holanda Dourada, Edo Tranquilo (Japão), Minas Colonial |
| Séculos XIX a XXI | Velho Oeste, Cerrado Dourado, Inverno Nórdico, Jardim Sakura |
| Futuro | Colônia Marciana |
| Fantasia | Vale Pastel |

## Parâmetros de URL

| Parâmetro | Efeito |
|---|---|
| `?theme=toscana` | tema inicial (ids em `src/themes/themes.ts` e `eras.ts`) |
| `?seed=123` | partida reproduzível: a mesma semente dá a mesma sequência de peças |
| `?time=night` | `dawn`, `day`, `golden`, `dusk` ou `night` |
| `?quality=high` | `auto`, `cinema`, `ultra`, `high`, `medium` ou `low` |
| `?webgl` | força o WebGL2 em vez do WebGPU |
| `?mode=zen` | modo inicial: `classico`, `zen`, `diario` ou `exploradores` |
| `?debug` | mostra FPS, draw calls, triângulos e instâncias |
| `?auto=40` | a IA coloca 40 peças de uma vez (tabuleiro de exemplo) |
| `?demo` | a IA joga sozinha, com animação |
| `?stress=1000` | teste de carga com 1.000 peças |
| `?gallery` | mostra todos os kits do tema lado a lado (depuração visual) |
| `?specials=all` | põe as peças especiais na partida sem liberá-las (`station`, `watermill`, `lighthouse`, separadas por ponto) |
| `?zoom=12` `?yaw=0.5` | distância e giro iniciais da câmera |
| `?pitch=25` | inclinação inicial em graus acima do chão, de 18 a 75 (fora disso, ignorado) |

## Estrutura

```
src/core/      regras puras (não importa three.js): hex, peças, tabuleiro, missões, interações, IA
src/themes/    temas como dados: types.ts (esquema), themes.ts (base), eras.ts (históricos)
src/render/    lib.ts (kits e shaders), tileBuilder.ts (peça procedural), world.ts (cena, luz,
               blocos estáticos, fantasma), life.ts (barcos, veículos, animais, moinhos, pássaros)
src/video/     gravação, filme da partida e exportação em MP4 (WebCodecs)
src/ui/        HUD em HTML/CSS
src/main.ts    entrada, fluxo da partida, salvamento, modos de teste
scripts/       capturas de tela e teste de carga com Playwright
tests/         simulação de partidas com oráculos independentes
```

## Criar um tema

Um tema é um objeto de dados (`Theme`, em `src/themes/types.ts`, com comentários em cada campo). Copie um tema de `eras.ts` e troque:

- **nomes e cores** dos 6 terrenos, do chão, da água, do fundo e da luz;
- **floresta:** formas de árvore (`conifer`, `oak`, `cypress`, `olive`, `palm`, `bamboo`, `araucaria`, `cactus`, `birch`, `blossom`, `round`, `willow`, `umbrella`, `waxpalm`, `crystal`) com peso e cores;
- **vila:** tipos de casa (corpo `cottage`/`long`/`cube`/`tall`/`round` + telhado `gable`/`hip`/`flat`/`dome`/`pagoda`/`thatch`/`turf`/`stepgable`/`cone`, com enxaimel e chaminé opcionais) e um marco (`church`, `baroque`, `tower`, `pagoda`, `pyramid`, `obelisk`, `windmill`, `temple`, `stave`, `hall`, `pylon`, `kancha`, `watertower`, `dome`);
- **construções opcionais:** a da interação vila + plantação (`windmill`, `granary`, `windpump`, `stilt`), um portal sobre a estrada na entrada da vila (`torii`, `paifang`, `inca`) e uma ponte sobre o rio (`stone`, `wood`, `rope`);
- **plantações:** `wheat`, `barley`, `corn`, `rice`, `tulip`, `lavender`, `sunflower`, `vineyard`, `sugarcane`, `papyrus`, `tea`, `coffee`, `cotton`, `quinoa`, `potato`, `flax`, `mulberry`, `hydro`;
- **aldeões** (`folk`: pele, chapéu `straw`/`cap`/`scarf`/`hood`/`helmet`/`none` e cor do chapéu) e **música** (`music`: a escala em semitons e o timbre `flute`/`reed`/`pluck`/`bell`/`glass`; a fanfarra de nova era usa a mesma escala, e a música ganha bordão, cordas e sinos a cada era);
- **animais, barco, estilo de estrada e veículo**, nomes das interações e, se quiser, regras próprias (`rules`).

O tema aparece sozinho no menu, agrupado pela época. Para conferir as formas, abra `?gallery&theme=<id>`.

## Medições

```bash
npm run build
(cd dist && python3 -m http.server 4173) &
node scripts/screenshots.mjs   # docs/screens/*.png (SHOTS=egito,noite para escolher)
node scripts/stress.mjs        # tabela de desempenho (RUNS=300:high para um caso)
npm run smoke                  # abre o build em WebGPU e WebGL2 e falha com erro no console (roda na CI)
```

Os scripts usam o Chromium com renderização por software. Para medir FPS de verdade, abra `?stress=1000&debug` num navegador com GPU. Para escolher o navegador, defina `CHROMIUM_PATH`; sem ele, os scripts usam o Chromium do Playwright (`npx playwright-core install chromium`).
