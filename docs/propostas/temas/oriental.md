# Tema ORIENTAL (fusão de sakura + song + edo)

## 0. Nome e eixo
Eixo escolhido: **"paisagem de rolo pintado" do Leste Asiático**, sem data exata. A China Song dá a escala (rio largo, juncos, pagode de tijolo, bambu, névoa de montanha) e o Japão Edo dá o desenho de vila (machiya, torii, estrada de posta, pinheiro podado). O Japão de hoje (trem-bala) sai; a primavera do Sakura vira estação e easter egg, não o tema. Mistura coerente porque os dois mundos compartilham arroz, chá, bambu e telhado curvo, e porque a pintura de paisagem Song foi a mãe da estampa Edo.
Nomes propostos (em ordem de preferência):
1. **Terraços do Oriente** (fala de arroz em degraus, é neutro entre China e Japão).
2. **Rolo de Seda** (a ideia de pintura em rolo; combina com a moldura `seda` e `washi`).
3. **Caminho do Arroz** (nome mais simples para o menu, fácil de ler).

## 1. Identidade em uma frase
Uma manhã de névoa num vale de arroz em terraços: água espelhada, telhados curvos, sinos de vento e pétalas, com a calma de um quadro que se anda pedaço por pedaço.

## 2. Os 6 terrenos reinterpretados
| T | Hoje | Vira | O que muda de forma (não só de cor) |
|---|---|---|---|
| 0 Prado | Musgo/Campina/Campo | **Colina** (nomes: "Colina") | musgo, pedras de jardim, lanternas de pedra raras, tufos de capim-pampa; sem flores de prado genéricas |
| 1 Floresta | Cerejal/Bambuzal/Bosque | **Bosque de Bambu e Pinho** | mistura de bambu (já existe), pinheiro podado (`umbrella` achatado ou `conifer` baixo), cerejeira e bordo; sem `round` genérico |
| 2 Plantação | Arrozal/Chá | **Arrozal em Terraço** | o grande diferencial: ver abaixo |
| 3 Vila | Vila/Aldeia/Machiya | **Aldeia** | casas de madeira com beiral curvo, pátios com lanterna, rua clara de pedra |
| 4 Rio | Lago/Yangzi/Rio | **Rio** | rio largo e lento, margem de juncos, nenúfares, carpas |
| 5 Estrada | Ferrovia/Calçada/Tōkaidō | **Caminho de Posta** | estrada de terra batida com pedras de passo; `roadLamps` ligado (lanternas de papel) |

**Arrozal (a lavoura que muda a peça).** Hoje `rice` é um tufo baixo sobre lâmina d'água com a mesma altura em toda a peça. Proposta: 3 variantes sorteadas por semente da peça, todas dentro do estilo `rice`/novo `paddy`:
- **Alagado**: lâmina d'água espelhada com mudas verde-claras em fileiras (o céu e as nuvens se refletem; já há reflexo de água no material).
- **Terraço**: a peça ganha 2 ou 3 degraus concêntricos (platôs em curva de nível, taludes de terra com capim), cada degrau com sua lâmina. É mudança de geometria do chão (`buildTile`), não só de decoração.
- **Dourado/colheita**: arroz maduro dourado, curvado ao vento, com espantalho (kakashi) e feixes secando em varais.
Chá fica como 2ª lavoura (sebes arredondadas em curvas de nível, já existe `tea`). Amoreira (`mulberry`) e cevada saem da mistura (cevada era só do Edo; amoreira vira detalhe raro perto de casas).
Opcional: **lótus** (`lotus`) no lugar de uma fração dos alagados, com flores rosa, para o fim de verão.

## 3. Construções
- **Casas** (todas com `pagoda` como beiral curvo, `trim` madeira escura):
  - machiya: `tall` + `hip`, madeira escura e reboco claro (herança Edo, peso 0,35);
  - casa de pátio: `cottage` + `pagoda`, parede de gesso claro e viga vermelha (herança Song, 0,35);
  - nagaya: `long` + `hip` em fileira (0,15);
  - casa de chá: `tall` + `pagoda` com trim vermelho-vermilion (0,1);
  - minor: `annex` + `pagoda` (depósito kura, parede branca) e `cottage` + `cross`.
  Paleta: telhas cinza-esverdeadas e ardósia, paredes creme/madeira, uma casa em dez com telha de cerâmica vermelha. Alterne paletas pelo sorteio de cor, sem `if (theme.id)`.
- **Estilo novo de telhado (G)**: `irimoya` (telhado "empena e quatro águas" japonês, com cumeeira curta e beiral longo), para diferenciar da `pagoda` genérica. Pode ser só um parâmetro de `roofGeometry` (curvatura do beiral maior) e custa 0 draw call novo.
- **Marco**: `pagoda` continua. Variante de marco por semente: pagode de tijolo octogonal (Song) ou pagode de cinco andares (Edo). Custa um `Landmark: 'pagoda8'` (M, ~300 tri).
- **Portal**: hoje `gate` é um só. Proposta: `gates?: Gate[]` (lista) sorteado por semente da peça: torii vermelho e paifang convivem. Campo novo no schema, kit já existe.
- **Ponte**: `bridge: wood` (taikobashi/Hongqiao). Mantém. Cor vermelha no corrimão.
- **Interações (`synergy`)**: lumber `Oficina de bambu`, mill `Armazém kura` (`stilt` sobre estacas, melhor que `granary`), pasture `Búfalos no arrozal` (ver animais), apiary `Colmeias`. Construção nova pedida: **roda d'água** (`watermill`, já listada em `docs/TEMAS.md` como kit faltante) para vila + plantação, em vez do celeiro.
- **Eras da vila**: I Mura (taipa e palha, sem terraço decorado); II Shukuba/vila de mercado (tema como é); III Cidade murada (sobrados, lanternas); IV Capital/Edo (flâmulas, janelas acesas, 13 andares). Nomes: `['Mura', 'Vila de mercado', 'Cidade murada', 'Capital']`. Centro `pagoda`. Maravilha: pagode de 5 a 13 andares (`stories`); alternativa mais ousada: `tree` (Cerejeira Milenar do Sakura) com torii, que é um visual já pronto. Sugiro **Pagode** como maravilha e a Cerejeira como easter egg.

## 4. Vegetação, animais, barcos e veículos
- **Árvores**: `bamboo` 0,3; `umbrella` (pinheiro podado, mudar para versão baixa e torcida, M) 0,25; `blossom` 0,2; `willow` 0,1 (junto à água); `round` em vermelho-bordo 0,15 (só em outono). Pinheiro: nova geometria `niwaki` (pinheiro de jardim em nuvens, ~150 tri, M, mesmo pool de árvores, sem draw call novo).
- **Arbustos/flores**: azaleias podadas em bola, hortênsia, lírios-aranha vermelhos (higanbana) em bordas de arrozal no outono.
- **Animais**: búfalo-d'água (`buffalo`, já existe) no arrozal; **garça branca** (`heron`, nova): vida do rio, fica parada de pé na água e levanta voo (usa o pool `bird`, ~40 tri, P); **carpas** (cardumes de `fish` em laranja e branco, só mudar `colors`: é dado); patos; cervo no bosque (sika).
- **Barcos**: `junk` (Song) no rio largo; `rowboat` em sampã raso no lago. Nova: **balsa de cormorão** (barco com pescador e lanterna, P) como `BoatKind: 'sampan'` com variante de lanterna.
- **Veículos**: `cart` com carregadores/cavalos de carga na estrada; troca `caravan` por `cart` + um **palanquim** (kago) como easter egg. O maglev sai.
- **Aldeões**: chapéu `straw` (kasa, cônico). Novo `HatStyle: 'conical'` (P).
- **Vida que se move**: moinho d'água girando, pássaros-garça em bando, pétalas e folhas, sinos de vento (movimento do `U.time`), fumaça de chá.

## 5. Água, entorno, clima, hora, paleta, som
- **Água**: rio verde-jade com cáusticas leves, nenúfares (`lily` rosa em alguns), juncos nas margens. Terraços do arrozal compartilham o reflexo do céu. Cor `#5aa5ad` (entre Song e Sakura), `bank` `#d5e0b8`.
- **Entorno**: `surround: 'mar'` com cor de nanquim/jade e espuma baixa; alternativa mais característica: **'pergaminho'** (a névoa de seda do rolo), com as bordas sumindo em névoa branca. Recomendo manter `mar` por pedir menos testes, e dar o ar de rolo pela bruma.
- **Clima/estação**: `weather: petals` na primavera, `leaves` laranja no outono, `pollen` no verão (vaga-lumes à noite sobre o arrozal), neve fina no inverno (`snow` só em estação, ver easter eggs). A estação inicial é primavera (`season: 0`) como o Sakura.
- **Hora do dia**: o amanhecer de névoa é a hora-assinatura (`atmos.haze 1.1`, cor `#e2ece6`). Lanternas de papel (`roadLamps`) acesas à noite, janelas amareladas.
- **Gradação**: sombras em azul-jade `#4f7f8a`, realces em pêssego `#f6dcc4`, saturação 0,92, filtro [1,1,1].
- **Paleta**: jade `#8fbfa0`, nanquim `#2a2a2c`, vermelho cinabre `#c8402e`, creme `#f3ede2`, rosa sakura `#f4a3c0` só em acentos. UI: `ui.frame 'seda'`, emblema `sakura` ou `selo`, `accent #b23a2e`.
- **Som** (`audio.ts`): escala pentatônica (hoje `[0,2,4,7,9]` Song e `[0,1,5,7,8]` Edo; usar **iwato** do Edo na maioria e a pentatônica maior na era IV, como luz), timbre `pluck` (koto/guzheng). Ambiente novo (dado ou pequeno gerador): sapos e cigarras à noite, água de bambu (shishi-odoshi, um "toc" raro), sino de templo ao subir de era. O `music.timbre` já cobre o timbre; ambiente exige código em `setAmbience`.

## 6. Easter eggs (determinísticos)
1. **Sakura em flor**: quando o jogador completa um grupo de 8+ peças de floresta, uma cerejeira milenar nasce no centro do maior grupo (visual por semente da peça maior). Pétalas caem mais forte por 30 s.
2. **Lua do Colheita (data)**: na noite do 15º dia lunar, ou numa data fixa do calendário solar (por ex. 15 de setembro), com a hora entre 20h e 23h, a lua é enorme, as lanternas flutuam pelo rio (Tōrō nagashi) e os coelhos da lua aparecem. Fora da data, em `?time=` nunca dispara.
3. **A Grande Carpa**: peça de lago/rio com 3+ bordas de rio e semente múltipla de 7; uma carpa dourada (`koi`) salta e some. Combina com `Life.addFish`.
4. **Torii submerso**: um rio de 6 bordas contínuas com uma peça de vila na ponta forma um torii nas águas (Itsukushima). Pontos extras zero (invariante 11), só visual.
5. **Gato da sorte**: com 100 peças colocadas, uma casa por vila ganha um maneki-neko no telhado (acena com a pata no `U.time`); 1 por tabuleiro, sorteado pela semente.

## 7. O que vem de cada tema
- **Sakura**: cerejeira, pétalas, primavera travada, `washi`, emblema; **descartar** trem-bala/maglev (anacrônico para um tema histórico), `ferrovia` e a regra `matchBonus Rail`.
- **Song**: arroz, salgueiro, `junk`, `paifang`, ponte `wood`, pagode de tijolo, búfalo, regra de borda de arrozal (+3), colmeias. **Descartar** trigo e amoreira como lavoura (a amoreira vira detalhe).
- **Edo**: machiya, torii, estrada de posta, pinheiro, chá, `horse`, nomes de eras (`Mura`…). **Descartar** `barge` (o junco serve) e `ore` (sem jazidas), e a regra "missões raras" (perde sentido). A regra `perfectBonus 25` pode ficar como "jardim zen".
- Regra do tema: unir `matchBonus {Field:3}` + `perfectBonus: 15` (valores a conferir com `npm run balance`).

## 8. Lista de trabalho
| Item | Tipo | Tri | Draw call novo? |
|---|---|---|---|
| `paddy` terraços (geometria do chão em degraus, 3 variantes) | G | ~600 por peça | não (é chão) |
| arroz alagado/dourado (cores do `rice`, reflexo) | P | 0 | não |
| `niwaki` pinheiro de jardim | M | ~150 | não |
| `heron` garça | P | ~40 | sim, 1 pool (`bird` pode ser reaproveitado) |
| `watermill` roda d'água | M | ~250 | sim, 1 |
| `irimoya` telhado + `pagoda8` marco | M | ~300 | não / sim |
| `sampan`, `HatStyle conical`, lótus | P | ~60 | sim (lótus) |
| `gates?: Gate[]` no schema | dado | 0 | não |
| ambiente sonoro (sapos, cigarras, shishi-odoshi) | código | 0 | não |
Campos novos em `Theme`: `gates` (lista), `terraces?: boolean` (peça de plantação ganha degraus), `holidays?: { month, day, kind }[]` para easter egg de data (puro, validado). O restante é só dado.
Ordem: (1) fundir os dados (tema novo `oriental` com todas as casas, cores, regras); (2) `gates` lista; (3) `niwaki` + `heron` (visual barato, grande efeito); (4) `paddy` terraços e variantes; (5) `watermill`; (6) easter eggs; (7) áudio.

## 9. Riscos
- **Legibilidade** (`tests/legibility.ts`): paredes creme contra o chão claro da aldeia e telhado cinza-esverdeado contra o chão jade já deram ΔE apertado no Song. Machiya escura ajuda; testar rápido depois de fundir. Cerejeira rosa contra o chão rosa-pastel do Sakura: manter o chão verde.
- **Orçamento**: terraços aumentam triângulos do chão (~+10% se todo arrozal tiver 3 degraus). Limitar a 2 degraus no Alta e a 1 na Baixa, e medir com `stress.mjs` (regra de 10%).
- **Invariantes**: terraços e variantes de arroz precisam sair de `(edges, seed, theme, opts)` (3); o easter egg de data/hora é só visual (não mexe em sequência/pontuação, 2 e 11); nada de `if (theme.id)` (8): usar os campos `terraces`/`holidays`; mudar regra do tema pede `SAVE_VERSION` novo se alterar o replay (regra `perfectBonus`).
- **Duplicação**: o Inverno Nórdico tem neve; não repetir neve forte aqui, só como estação.
- **Fusão confusa**: se torii e paifang no mesmo tabuleiro parecer ruído, voltar ao eixo Edo puro nos portais e deixar o paifang só na estação de comércio da era III.
