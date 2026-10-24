# Holanda Dourada (`holanda`): aprofundamento

Base lida: `themes.ts` (tema atual), `types.ts`, `lib.ts` (kits), `tileBuilder.ts`, `life.ts`, `audio.ts`. Nada foi alterado no repositório.

## 1. Identidade
Países Baixos, 1600 a 1670 (Século de Ouro): uma terra ganha da água, plana, medida a régua, onde cada canal, dique e moinho foi desenhado. A pessoa deve sentir ordem, riqueza tranquila e o cheiro de terra molhada, com a cor das flores contra o céu pálido.

## 2. Os 6 terrenos reinterpretados
Hoje: Pôlder, Bosque, Tulipas, Aldeia, Canal, Dique. A base já é boa. O que falta é mudar a FORMA, não só a cor.
- **Pôlder (0)**: campo plano cortado em retângulos por valas finas (sloten) e fileiras de salgueiros-podados. Forma nova: o prado ganha 1 ou 2 valas retas e estreitas pintadas no chão (cor da água, mapa do chão) e cercas baixas. Vacas pastam em manchas. Ideia de kit: `ditch` (decoração do prado, linhas retas de água rasa, sem draw call novo se for pintura de vértice no chão).
- **Bosque (1)**: na Holanda real quase não há mata. Vira "alameda e bosque de pôlder": álamos em fileira reta (cipreste/`poplar` alinhado em linha, não espalhado), carvalho e bétula nas dunas. A regra de colocação sai do sorteio livre e passa a seguir uma linha (campo novo `forest.layout: 'rows'`).
- **Tulipas (2)**: o grande diferencial. Hoje 60% tulipa, 25% trigo, 15% cevada. Proposta: faixas largas de cor em bandas retas (já existe `rowColor`), e três variantes de parcela: (a) tulipas, (b) jacintos/narcisos em faixas (kit `bulb`, caule curto e cacho), (c) estufa de vidro baixa do século XVII? (anacrônica, melhor: "cercado de queijo/ervas" não). Manter: tulipa, jacinto, trigo e linho (`flax` já existe, a Holanda era grande no linho e a tinta azul de Delft).
- **Aldeia (3)**: vira ruela de tijolo ao longo do canal, com cais de pedra e fileira de casas coladas (empenas lado a lado). Mudança de forma: casas geminadas em fita (2 a 3 casas encostadas com larguras diferentes), em vez de casas soltas. Um cais de pedra na beira da água quando a aldeia toca o canal (reaproveita o cais de pescador de `__fishing`).
- **Canal (4)**: retilíneo e com margem de pedra/dique, não meandro. Forma nova: `waterShape` com `straight: true` (menos curva) e `bank` de tijolo. Cor de água esverdeada-turva, com nenúfares.
- **Dique (5)**: hoje 'stone' como estrada. Vira dique: aterro elevado e gramado (levemente mais alto que as peças vizinhas), com caminho em cima e ovelhas. É o terreno mais "holandês" que pode mudar de forma. Estilo novo `RoadStyle: 'dike'` (talude gramado em trapézio, caminho de tijolo no topo, estacas na base, bicicleta/carroça por cima).

## 3. Construções
- **Casas**: manter `tall + stepgable` (trapeira/empena escalonada) como principal. Estilos novos de empena, todos como `RoofStyle`: `bell` (empena de sino, barroca), `neck` (empena de pescoço, com ombros), `clock` (empena reta com degrau único). Variação grande de ENTORNO da fachada (larguras 0,8 a 1,3 já existem). Faixas horizontais de tijolo e pedra clara (`trim`). Janelas altas e grandes (mais janela por andar, com vidro que brilha à noite). Gancho de içamento (viga com polia no topo da empena): detalhe pequeno, 4 triângulos, pode ser parte da casa.
- Cores de parede: tijolo vermelho e alaranjado, creme, preto-alcatroado (celeiros), com batentes brancos e persianas verdes. Evitar parede 100% branca (legibilidade).
- **Marcos** (hoje só `windmill`): vários moinhos por época: (a) moinho de pedra tipo torre ("grondzeiler"), (b) moinho de pôlder de pá baixa com roda d'água e parafuso de Arquimedes (`mill: 'polder'`), (c) moinho de serraria "paltrok" (Zaanse Schans, de madeira preta), (d) moinho de peças em ripado branco. Marco novo `canalhouse` (Casa do Canal com guindaste) e `belfry` (torre de sinos de prefeitura com carrilhão, ligada ao timbre `bell`).
- **Interações (`synergy`)**: `lumber` Serraria vira "Moinho serrador" (paltrok); `mill` já é moinho de vento, mas a Holanda é onde o moinho é bomba: ao encostar aldeia em canal, "Moinho de drenagem" com pá lenta; `pasture` "Pasto de vacas" ganha uma queijaria (casa com pilha de queijos amarelos à porta) e um balde; `apiary` pode virar "Estufa de bulbos" ou "Viveiro de tulipas" (muda o nome, geometria nova de colmeia vira cestas de bulbos). Isso exige geometria nova só se quiserem; a mudança de nome é só dado.
- **Portal**: `gate` hoje ausente. Proposta: `stadspoort` (portão de cidade de tijolo com torre e relógio), novo `GateStyle: 'brick'`. Opcional.
- **Ponte**: `bridge` hoje ausente. Proposta forte: **ponte levadiça de contrapeso** (`BridgeStyle: 'draw'`, duas vigas inclinadas e correntes), com animação rara de abrir quando um barco passa (usa `dt`, invariante 13). Segunda opção: arco baixo de tijolo (`stone` com cor de tijolo).
- **Eras da vila** (`eras` já dá nomes): I Aldeia de pôlder (casas de madeira e palha, tijolo só na base, moinho de madeira); II Vila mercante (tijolo, empena em degrau, cais); III Cidade das guildas (fachadas altas de empena de pescoço e sino, sobrados, carrilhão); IV Século de Ouro (Paço Municipal). A `wonder` hoje é `civic` (Paço de Amsterdã): manter. `center: 'spire'` está bom (Westerkerk), ou `stepped`? Não. Manter `spire`.

## 4. Vegetação, animais, barcos, veículos
- **Vegetação**: álamo em fileira (`cypress` esguio vira `poplar` se quiserem copa mais afilada), salgueiro (`willow`, que já existe) podado nas valas, carvalho e bétula nas dunas. Arbustos de sebe aparada (cubos arredondados, `hedge`). Junco e taboa na beira do canal (`reed`, finos, instanciados, mesmo draw call do capim). Flores de prado: botão-de-ouro e margarida (já ok).
- **Animais**: vaca preta e branca (frísia) já existe, é a assinatura. Ovelhas nos diques (`sheep`, dados). Cavalos de tração nas ruas (`horse`). Cisnes e patos nos canais (usa o sistema de `fish`/pássaros de `life.ts`, kit novo `duck`, ~20 tri). Garças (`bird` parado em pé). Gansos.
- **Barcos**: `barge` hoje (barcaça). Variantes: o "tjalk" (barco de fundo chato com leeboards e vela marrom) como `BoatKind: 'tjalk'` (~120 tri), e veleiro de pescador "botter". Pequeno barco de remo com um remador (`rowboat`). Reaproveitar `sailboat`.
- **Veículos**: `cart` hoje. Melhor: carroça de leite com lata prateada e **bicicleta** (kit novo `bike`, ~60 tri, ciclista de chapéu/boné no dique; sendo século XVII é anacronismo, então é mais um easter egg, ver abaixo) e **trenó de patinação**: no inverno os canais viram pista (clima/estação). Para o XVII: carroça de queijo e trenó puxado por cavalo no gelo.
- **Aldeões**: boné e camisas azuis, saia vermelha: manter `cap` e cor. Tamancos (não visível). O de "mulher com touca branca" é um chapéu novo `coif` (HatStyle).

## 5. Água, entorno, clima, paleta, som
- **Água**: verde-azulada turva, `water: '#6f9fb8'` está claro demais para canal. Propor `#5f8f93` com leito mais barrento (`bank` areia-barro). Canais retos. Reflexo de céu forte (SSR já só no Cinema).
- **Entorno**: `surround: 'mar'` está certo (Mar do Norte). Proposta: faixa de dunas com capim (areia clara) e um dique contínuo na borda; é dado de cor do `seaMap`, sem custo de draw call.
- **Clima**: hoje pólen. Trocar por `none` + o clima tocável (chuva é a Holanda!). Pedido: padrão de chuva fina e nuvem baixa; nuvens volumétricas com `atmos.haze` alto e `clouds` já existe. Dois momentos do dia fortes: manhã de neblina baixa nos canais (névoa rasteira por altura) e entardecer dourado do Século de Ouro (luz de Vermeer: sol baixo e quente, sombras frias). Estação travada: `season: 0` (primavera, quando a tulipa floresce) deixa o tema sempre florido, mas perde variedade; alternativa melhor: não travar e fazer as faixas de tulipa só na primavera e jacinto/trigo no verão.
- **Gradação**: puxar para a luz de Vermeer: `shadow` azul-esverdeado frio (`#5a6a7a`), `light` âmbar (`#ffd889` já serve), saturação 1,0, `filter` quase neutro. Hoje shadow `#6a5a3c` é quente demais; frio nas sombras e quente na luz dá o efeito de óleo flamengo.
- **Som**: `bell` já é o timbre; escala maior de 7 notas já está (jônica). Adicionar: carrilhão de sinos de hora cheia (3 notas) quando a vila entra na era III, vento mais grave e constante, quacar de patos distante e gotas de chuva se tocar o clima. Moinho com ranger lento (ruído filtrado a 0,3 Hz) perto do foco. Isso mexe em `audio.ts` com um campo novo `Theme.ambience` (opcional): ver lista.

## 6. Easter eggs (determinísticos)
1. **Tulipomania (1637)**: se a partida tem 3 ou mais peças de tulipa vizinhas com TODAS as seis cores presentes no mesmo grupo, uma tulipa dourada (kit pequeno, ~25 tri, brilho) surge no meio e o texto do Almanaque diz "um bulbo vale uma casa". Gatilho sai do grupo (já calculado em `Board`); a posição e a cor saem da semente da peça.
2. **Menino do dedo no dique**: em um dique (5) com água dos dois lados, 1 em 30 peças (pela semente da peça) ganha um menino agachado com o dedo no buraco do dique, e uma gota. Referência à lenda de Haarlem.
3. **A Ronda Noturna**: entre 22h e 2h (relógio local) e com 30 ou mais peças, três aldeões de capa e chapéu passam em fila por uma rua de aldeia com lanterna. Só visual.
4. **Bicicleta no dique**: 1 vez por partida, depois da 50ª peça, um ciclista de roupa atual cruza o dique (anacronismo de propósito, para sorrir). Pelo `dt`, sem relógio real.
5. **Vaca nas nuvens / queijo gigante**: tirar uma peça de pasto com 6 bordas de pôlder iguais (hexágono perfeito) faz uma roda de queijo gigante amarelo repousar no meio do pasto (ligado ao nome "Pasto de vacas"). Determinístico pelo padrão das bordas.
(Bônus: dia 27 de abril, Dia do Rei: tudo em laranja, bandeirolas laranja nas casas, só a data local.)

## 7. Fusão
Não é fusão. O que aproveitar do que sai: da **Toscana**, o cipreste em alameda (vira álamo em fileira) e a ideia de torre de relógio; do **Velho Oeste**, nada; dos **Andes**, nada. Do Vale Pastel (saí), as cores suaves de prado ficam como base do pôlder. O moinho de vento marco ficou na Holanda (e o Egito/Oriental não usam). Linho e `flax`: já existe.

## 8. Lista de trabalho
Kits novos (P pequeno ≤60 tri, M médio ≤200, G grande >200):
| Kit | Tam. | Draw call novo? |
|---|---|---|
| `RoofStyle` bell, neck, clock | P cada | não (entram nos pools `roof:i`) |
| Moinho paltrok e moinho torre (marco) | M | sim, 1 por marco (pool de marco) |
| Moinho de drenagem (synergy `mill`) com parafuso | M | sim, 1 |
| `RoadStyle: 'dike'` (talude e caminho) | M, no chão | não (geometria da peça) |
| Ponte levadiça `BridgeStyle: 'draw'` | M | sim, 1 |
| Cisne/pato, garça | P | sim, 1 (pool de vida) |
| Barco `tjalk`, botter | M | não (pool do barco do tema) |
| Bicicleta/ciclista, carroça de leite | P/M | sim, 1 (veículo) |
| `CropStyle: 'bulb'` (jacinto/narciso) | P | sim, 1 (pool de plantação) |
| Junco/taboa | P | não (pool de capim) |
| Queijaria (synergy `pasture`), estufa de bulbos (`apiary`) | M | 1 cada |
| Portão `brick` e `belfry` | M | 1 cada, opcional |
Campos novos em `Theme`: `forest.layout: 'rows' | 'free'`; `Theme.ambience?` (lista de sons de ambiente); `waterStyle?: 'canal' | 'rio'` (reto e com bordas de pedra); `houseRow?: true` (casas geminadas em fita); `eggs?` (lista de ids de easter egg ativos, para o código não ter `if (theme.id)`, invariante 8). Só dado: nomes, cores, gradação, clima, `eras`, `synergy`, pesos, `season`, `ground`.
Ordem sugerida: (1) dados (cores frias, clima, nomes, sons simples, `ground` e `water`); (2) roofs `bell/neck` e casas geminadas; (3) dique e canal reto; (4) álamos em fileira, vala no pôlder; (5) moinhos e marcos; (6) tjalk, patos, bicicleta; (7) ponte levadiça; (8) easter eggs.

## 9. Riscos
- **Legibilidade** (`tests/legibility.ts`): parede de tijolo contra pôlder verde e telhado cinza contra tijolo; o telhado vermelho `#d9693c` sobre parede `#c66a44` já está no limite (ΔE). Evitar parede laranja com telhado laranja; checar o preto-alcatroado de noite.
- **Orçamento**: casas geminadas e junco sobem triângulos nas vilas (que já são o maior pool). Meta: ≤10% de alta em triângulos/draw calls (`stress.mjs`). Pássaros/patos e moinho novo somam ~6 draw calls: aceitável se compensarem com `farGeo`.
- **Invariantes**: 3 (a vala e as casas em fita precisam sair de `(edges, seed, theme, opts)`; a continuidade com a peça vizinha, como na largura do rio, exige `opts`, e isso exige mexer no `World`); 4 (rotação do dique); 8 (os easter eggs não podem testar `theme.id`); 13 (ponte levadiça e ciclista só pelo `dt`); 6 (mudar `synergy` ou regra não muda replay, mas trocar `rules` sim e pede `SAVE_VERSION`); invariante 10 (junco com `~` se for fino). A ponte que abre só com barco depende do `Life`, não do estado de jogo, para não quebrar o replay.
- Anacronismo da bicicleta: é piada, só um easter egg raro.
