# Inverno Nórdico (`inverno`): proposta de aprofundamento

Base: `inverno` em `themes.ts` (contemporâneo, trilhos, trem a vapor, cabanas vermelhas, stave, moinho de vento, renas = `deer`) + o melhor de `viking` (casa longa de turfa, hall com dragões, drakkar, estabur, cevada, fiorde, ovelhas, folk com capuz). Observação: `TimeOfDay 'aurora'` hoje é nascer do sol rosado, NÃO aurora boreal. A aurora boreal é efeito novo.

## 1. Identidade
Um fiorde norueguês no meio do inverno, numa época atemporal em que a casa longa de turfa, a igreja de madeira e a cabana vermelha convivem sob neve e luz azulada. A pessoa deve sentir silêncio, aconchego de lareira e a espera da aurora.

## 2. Os 6 terrenos reinterpretados
Troca de época: sai o trem a vapor "moderno", entra um mundo de séculos misturados (fazenda de fiorde). Nomes novos em `terrainNames`.
| Borda | Hoje | Vira | O que muda de forma |
|---|---|---|---|
| 0 Prado | Neve | **Neve** (campo nevado) | Chão com sastrugi e pegadas (detalhe no shader do chão por dado), tufos de capim seco furando a neve, rochas com capa branca, raposa-do-ártico e renas pastando |
| 1 Floresta | Pinhal | **Taiga** | Pinheiros e abetos (`conifer`, `spire`) com neve nos galhos, bétulas peladas de tronco branco (`birch`) e zimbro; clareiras com tocos |
| 2 Plantação | Lavoura | **Lago congelado** (pesca no gelo) | O "campo" deixa de ser lavoura: vira gelo com buracos redondos, tendas/cabanas de pesca e varais de peixe seco (bacalhau, estoque fish). Nova família de plantação `icefield`. Cevada fica só como 1 em 4 parcelas (campo coberto de palha, `barley` com `soil` neve), para não perder o laço com a economia viking |
| 3 Vila | Aldeia | **Aldeia** | Ver seção 3 |
| 4 Rio | Riacho | **Fiorde** | Água azul-escura entre margens de neve, com bordas de gelo fino (`bank` branco), espuma e icebergs pequenos |
| 5 Estrada | Trilhos | **Trilha de trenó** | `road: 'dirt'` (sulcos de patins na neve, em vez de trilhos) com varas-guia fincadas; `vehicle: 'cart'` vira trenó puxado por rena (kit `sled`). O trem a vapor sai (era moderno demais e destoa das casas longas) |

Nomes sugeridos: `['Neve', 'Taiga', 'Lago gelado', 'Aldeia', 'Fiorde', 'Trilha de trenó']`.

## 3. Construções
**Casas (mistura das duas listas):** vila nórdica de madeira com três famílias e silhuetas reconhecíveis.
- `long` + `turf` (casa longa, peso 0,32): cumeeira baixa, telhado de turfa com neve por cima. Cores de telhado: branco-azulado (neve) e verde-seco manchado. Já existe.
- `cottage` + `gable` vermelha com moldura branca (peso 0,3): a cabana "stuga" sueca, `falu red` (#9a3b2e). Já existe; reforçar variação de cores ocre, azul-ardósia e branca.
- `annex` + `turf` (peso 0,12): estabur/celeiro elevado, com `mill: 'stilt'`.
- `tall` + `steep` pequena (peso 0,1, `minor`): casa de mercador de Bergen (Bryggen), fileira de frontões coloridos. Corpo `tall` com `steep`, tudo já existe.
- Estilo novo `RoofStyle: 'sod'`? Não precisa: `turf` já serve. Estilo novo opcional **`BodyStyle: 'sauna'`**: cabaninha baixa quadrada junto ao lago/fiorde, com fumaça mais forte e porta em destaque (ver synergy).
- Estilo novo **`HouseKind.snow?: number`**: capa de neve (0 a 1) sobre o telhado, calculada no shader por normal vertical, sem malha extra. Hoje a neve vem só da cor do telhado.

**Marcos (`Landmark`):** hoje 1 só por tema. Proposta de **2 marcos** (campo novo `landmarks2`, ou sorteio por semente):
1. `stave` (igreja de madeira escalonada, stavkirke): manter como marco principal, mais rara (chance 0,10).
2. `hall` (salão comprido com dragões): o marco do "melhor dos vikings", só com chance menor (0,05); evita o anacronismo declarado em `TEMAS.md`, porque o tema agora é atemporal.
3. Opcional: farol de pedra (`tower`) em borda de fiorde.

**Interações (`synergy`)**, nomes novos e construções:
- lumber (aldeia + taiga): `Lenhadores e serraria`: pilhas de toras, cavalete de serra e rena puxando tora.
- mill (aldeia + lago/lavoura): **`Pesca no gelo e defumadouro`** (no lugar de moinho): tenda sobre o buraco no gelo, varal de peixe seco, defumadouro. Reaproveita a lógica de `cais de pescador` do `tileBuilder.ts` (~linha 1119).
- pasture (aldeia + neve): **`Curral de renas`** (cerca em aro, feno, sino de rena).
- apiary (aldeia + prado): **`Sauna`**: casinha de tora com fumaça e vapor, perto de fiorde ou lago; cai bem no tom aconchegante.

**Portal:** `gate` hoje ausente. Proposta: arco de madeira com cabeças de dragão (`GateStyle: 'dragon'`, ~120 triângulos, P), na entrada da vila.
**Ponte:** `bridge: { style: 'wood', colors: ['#5a3a26', '#cfd6dc'] }` (ponte de madeira com neve, parapeito baixo). Já existe o estilo `wood`.
**Eras da vila (`eras`):** `['Fazenda', 'Povoado', 'Vila', 'Cidade']` hoje. Proposta `['Sítio', 'Vilarejo', 'Entreposto', 'Burgo']`:
- I: turfa e palha, poucas luzes, fumaça fraca.
- II: toras empilhadas e cabanas vermelhas, estabur.
- III: casas de mercador de Bergen, frontões coloridos, flâmulas.
- Maravilha: trocar `Palácio de Gelo` (`ice`) por **Grande Stavkirke** (`WonderCore: 'stave'`, novo, ~350 triângulos, M) ou manter o Palácio de Gelo se for caro. O `center: 'hall'` já existe.

## 4. Vegetação, animais, barcos, veículos, vida
- Árvores: `conifer` (taiga), `spire` (abeto alto), `birch` (bétula pelada, tronco claro, quase sem copa), `puff` para zimbro baixo. Tirar `oak`, que pertencia ao viking verde. A neve sobre o galho é cor de instância (variante `conifer` branca já existe).
- Prado: capim seco curto, arbustos pelados, rochas com capa de neve, bagas vermelhas (`berry` sorvas, já existe).
- Animais (`AnimalKind`): **`reindeer`** novo (rena: galhada em dois ramos, corpo mais claro, ~45 tri, P) no lugar de `deer`; alce (`moose`, grande, ~60 tri, P) raro e solitário; ovelha nórdica (`sheep`) no curral. Os `animals` do tema aceitam só um tipo; proposta de campo novo **`animals2?`** (segundo bicho raro).
- Barcos: `longship` (drakkar de listra vermelha e branca) como barco principal do fiorde; **`rowboat`** (barco de pesca/pescador) como segundo tipo. Campo novo `boat2?` para ter os dois no mesmo rio. Esteira, vela quadrada listrada.
- Veículos: trenó de rena (`VehicleKind: 'sled'`, novo, ~70 tri, P). Viaja pela trilha com guizos.
- Aldeões: capuz de lã (`hood`) já existe; cores vermelho e azul. Pescador parado ao lado do buraco no gelo (aldeão posicionado fixo na synergy).
- Vida (`life.ts`): fumaça mais densa no inverno (já existe `winter` no `spawnSmoke`), raposa passando, pássaros (corvos, em bando, dão o "corvo" do emblema).

## 5. Água, entorno, clima, paleta, som
- Água: fiorde profundo `#2e5f78` com bordas de gelo fino (`bank` branco azulado); mais escuro que hoje, que é turquesa demais e parece lago de verão. Em lago congelado a água sai e entra gelo.
- `surround: 'mar'` (mar polar cinza-azulado, espuma branca). Manter.
- Clima: `snow` com `density` 1,0; vento forte nas copas (`wind` 0,9). Clima tocável tem `window.__weather('snow')` já.
- Hora do dia: a `aurora` de hoje é o nascer rosado. Proposta nova: **aurora boreal** à `night` (campo `Theme.skyFx?: 'aurora'`): cortina verde e violeta no céu, lida pelo shader das nuvens (`clouds.ts`/`sky.ts`), com reflexo fraco na neve (usar `U.sparkle` e `hemiSky`). Sem malha nova; um nó TSL no fundo.
- Paleta: manter `#e6eef5` neve, `#2e5a4c` taiga, `#9a3b2e` vermelho Falu, `#d9c9a0` palha. Esquentar a luz de janelas (`#ffcf7a`) para contrastar com o azul frio da noite.
- `grade`: sombras azuis `#4a78b8`, realces quentes ao entardecer; `saturation` 0,92 está bom.
- Som (`audio.ts`): escala `[0,2,3,5,7,8,10]` (eólio) e timbre `glass` hoje. Proposta: `timbre: 'pluck'` para uma harpa/kantele e adicionar um ambiente de **vento uivando e sino de rena** perto do foco (`setAmbience` já tem `wind`); ao tirar uma peça de lago, "gelo estalando" curto. Tudo sintetizado.

## 6. Easter eggs (determinísticos)
1. **Aurora no solstício**: em 21/12 (data local) ou com 21 peças de rio juntas, a aurora boreal aparece mesmo de dia (pálida) e o som ganha um coro de vidro. Dispara por data/contagem; sem efeito na semente.
2. **Rena do Papai Noel**: em 24 e 25/12, um trenó de rena (`sled`) com uma luz vermelha atravessa o céu uma vez a cada partida (bando de pássaros já existe como `__celebrate`). Só visual.
3. **Odin e os corvos**: se o jogador fecha um lago congelado de 5+ peças, dois corvos (`Huginn` e `Muninn`) passam rodando o foco; sorteados pela semente do lago (cada lago tem a mesma hora e posição).
4. **Troll sob a ponte**: toda ponte com índice de peça múltiplo de 13 mostra um troll de pedra (cone cinza com olho âmbar) debaixo do arco, visível só no zoom fechado. O sorteio é `mulberry32(def.seed)`.
5. **Sauna e mergulho**: sauna encostada em lago congelado solta mais vapor e um aldeão pula no buraco no gelo (animação única, uma por partida).

## 7. O que vem dos Vikings (que somem) e o que fica
- Aproveitar: casa longa de turfa (`long` + `turf`), estabur (`mill: 'stilt'`), drakkar (`longship`), salão com dragões (`hall`), cevada (`barley`), linho (`flax`, virar tecido na vila), ovelha, capuz, `frame: 'madeira'`/`emblem: 'corvo'`, `blessingNames` (Navegadores, Construtores de salões, Escaldos), `synergyBonus` de carpintaria.
- Descartar: o verde de verão (`ground` verde, folhas caindo), `oak`, `dirt` verde-oliva, e a data "século X" (virou atemporal). Chão verde e Era Viking estrita não combinam com neve.
- Regras: `rules` mistura `startTiles: 55`, `questChance: 0.28`, `seasonLock: 3` (inverno) com bônus de lenhadores 3 e agora o de pesca (`synergyBonus: { mill: 3 }`)? Manter só `lumber: 3` (ou 5) e documentar. Mudar regras exige `SAVE_VERSION`+oráculo.

## 8. Lista de trabalho
Dado puro (sem código de render): nomes, paleta, `houses`, `bridge`, `landmark` extra via sorteio, `surround`, `grade`, `atmos`, `music.timbre`, `eras`, `blessingNames`, `folk`, `synergy` nomes.
Kits novos (tipo / triângulos / draw call):
| Kit | Tipo | Tri | Draw call novo |
|---|---|---|---|
| `AnimalKind: 'reindeer'` | P | ~45 | não (pool de animais) |
| `AnimalKind: 'moose'` | P | ~60 | sim, raro |
| `VehicleKind: 'sled'` | P | ~70 | sim (1) |
| `CropStyle: 'icefield'` (gelo, buracos, tenda, varal) | M | ~120 por parcela | sim |
| `GateStyle: 'dragon'` | P | ~120 | sim |
| `WonderCore: 'stave'` | M | ~350 | sim, só na era IV |
| synergy: tenda de pesca, curral, sauna | P/M | ~80 cada | não, se reaproveitar pools |
| `BodyStyle: 'sauna'` | P | ~40 | sim (1 par wall/roof) |
| Aurora boreal (nó TSL em sky/clouds) | M | 0 | não |
Campos novos em `Theme`: `animals2?`, `boat2?`, `skyFx?: 'aurora'`, `HouseKind.snow?`. Tipos de união acrescidos (`reindeer`, `moose`, `sled`, `icefield`, `dragon`, `stave`).
Ordem sugerida: (1) dados e nomes; (2) reindeer + sled + trilha de trenó; (3) lago congelado (`icefield`) e synergy de pesca; (4) neve no telhado e portal; (5) aurora boreal + som; (6) maravilha stave; (7) easter eggs.

## 9. Riscos
- **Legibilidade** (`tests/legibility.ts`): telhado branco sobre chão branco é o risco principal. Manter `roofs` com ao menos 3 cores escuras e a neve de telhado só por shader (a base fica escura), e conferir ΔE. O `?silhueta` deve mostrar casas longas e stave de longe.
- **Orçamento**: lago congelado com tendas pode somar triângulos em 300 peças (alvo: +10%). Usar a versão leve de longe. Aurora no shader não custa triângulos, mas confira o custo no Ultra.
- **Invariantes**: 8 (sem `if (theme.id)`): aurora, trenó e easter eggs precisam entrar por campo de dado, não por `id`. 3 (determinismo): troll e corvos por `mulberry32(def.seed)`; data só para efeitos não ligados à peça. 13: o tempo da aurora usa `U.time`, nunca `performance.now()`. 6: mudar regras pede `SAVE_VERSION`.
- Remover o trem exige checar `rail` nos testes (`tests/logic.ts` não depende do estilo); a estrada fica `dirt` como no viking.
- Sem GPU real, o custo da aurora no Ultra só se mede no PC do Roger.
