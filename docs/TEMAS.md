# Temas históricos: pesquisa de referência

Pesquisa de apoio aos 8 temas de `src/themes/eras.ts` · 30/09/2026 · PT-BR

**Nota de método.** O WebFetch está bloqueado pelo proxy de saída; toda a evidência vem de resumos do WebSearch (nenhuma página foi lida na íntegra). Onde a busca não confirmou um detalhe, ele vem de conhecimento geral e está marcado **[C]**. Anacronismos e aproximações de kit estão sempre explicitados. Em todos os temas o renderizador só conhece os kits de `src/themes/types.ts`; onde o kit ideal não existe, usei o mais próximo e listei o que faltaria.

**Validação feita nos dados** (script local, fora do repositório): `tsc --noEmit | grep eras.ts` sai vazio; contraste `ui.ink` × `ui.panel` entre 12,7:1 e 14,7:1 (meta era ≥ 7:1); `ui.accent` × `ui.panel` ≥ 4,9:1 e `ui.accent` × branco ≥ 5,3:1; os 6 `ground` de cada tema têm ΔE (CIELAB) mínimo entre si de 12,1 a 18,4; a água fica a ΔE ≥ 21 de qualquer chão; `bg`, `voidFill` e `voidLine` sobem de luminosidade nessa ordem.

## Visão geral

| id | Tema | Época | Assinatura de cor (miniatura) | Regras |
|---|---|---|---|---|
| `egito` | Egito do Nilo | Novo Império, c. 1300 a.C. (antiguidade) | areia dourada + Nilo turquesa | 38 peças, missões 0,28 |
| `song` | Jade Song | China Song, séc. XII (medieval) | jade + tinta nanquim, selo vermelho | padrão |
| `viking` | Terra dos Vikings | Escandinávia, séc. X (medieval) | verde-pinho frio, azul-ardósia | padrão |
| `toscana` | Toscana Renascentista | séc. XV (medieval) | ocre, verde-oliva, terracota, vinho | padrão |
| `edo` | Edo Tranquilo | Japão, séc. XVIII (moderna) | madeira escura, papel claro, índigo | encaixe perfeito 25, missões 0,2 |
| `colonial` | Minas Colonial | Minas Gerais, séc. XVIII (moderna) | branco-cal, azul, ocre, terra vermelha | padrão |
| `oeste` | Velho Oeste | EUA, c. 1880 (contemporânea) | deserto avermelhado, sol baixo | missões 0,3 |
| `andes` | Andes Incas | séc. XV (medieval) | verde de altitude, pedra cinza, céu lilás | padrão |

Os três temas com `rules` variam pouco, de forma coerente com a narrativa: o Egito começa com 2 peças a menos e o faraó pede mais obras; o Edo premia o encaixe perfeito (jardim zen) e tem missões mais raras; o Oeste tem mais missões (encomendas da ferrovia).

---

## 1. Egito do Nilo (`egito`)

- **Terrenos.** Prado = *Várzea* (a "Terra Negra" irrigada pela cheia); Floresta = *Palmeiral* (tamareiras, sicômoros e acácias); Plantação = *Lavoura* (trigo-emmer, cevada, papiro, linho); Vila = *Aldeia*; Rio = *Nilo*; Estrada = *Trilha* de areia.
- **Kits.** Casas `cube` + `flat` (adobe de teto plano, terraço como área de convivência), `cottage` + `flat` para as mais baixas e `cube` + `dome` para silos abobadados; `pyramid` como marco (já era antiga em 1300 a.C., mas é o ícone mais legível numa miniatura; o obelisco de Karnak seria mais fiel ao Novo Império); `granary` como celeiro real; `palm` (tamareira), `round` (sicômoro) e `olive` (acácia, copa larga e baixa). Linho = `lavender` (fileiras de tufos com flor azul-pálida, aproximação visual); papiro = `papyrus`.
- **Animais e transporte.** `caravan` + `camel` em rota `sand`, como pedido. **Anacronismo:** o camelo só virou animal de carga comum no período ptolomaico/romano; no Novo Império as caravanas eram de burros. Barco `felucca` (vela latina é posterior; barcos do Novo Império tinham vela quadrada e havia esquifes de papiro, então `reedboat` seria historicamente mais próximo, mas a falua é o que o jogador reconhece).
- **Sinergias.** Colmeias de barro: tubos de barro empilhados aparecem na tumba de Rekhmire (séc. XV a.C.), então a apicultura egípcia é bem documentada. Lótus branco e azul entram como `flowers`.
- **Paleta.** Ouro/areia (`bg`, chão da trilha e da vila), turquesa do Nilo (`water` `#2fb0aa`) e verde-papiro; o Egito antigo pensava em seis grupos de cor (verde, vermelho, azul, amarelo, branco, preto), e azul/turquesa significavam fertilidade e renascimento. Luz forte (`sunIntensity` 2.6, sol alto).
- **Falta no motor.** Burro com carga, shaduf (alavanca de irrigação, chegou com o Novo Império), pilone de templo com obelisco, barco de vela quadrada, casa com terraço e escada externa.
- **Fontes.** [Ancient Egyptian agriculture (Wikipedia)](https://en.wikipedia.org/wiki/Ancient_Egyptian_agriculture) · [Egypt's Golden Empire: farming (PBS)](https://www.pbs.org/empires/egypt/newkingdom/farming.html) · [Colour in Ancient Egypt](https://ancientegyptonline.co.uk/colour/) · [Tears of Re: beekeeping in Ancient Egypt](https://www.apicultural.co.uk/tears-of-re-beekeeping-in-ancient-egypt) · [The Camel in African History](https://www.africanhistoryextra.com/p/the-camel-in-african-history-ancient)

## 2. Jade Song (`song`)

- **Terrenos.** Prado = *Campina*; Floresta = *Bambuzal* (bambu, pinheiros, salgueiros/cânforas e ameixeiras em flor, um tema clássico da pintura Song **[C]**); Plantação = *Arrozal* (arroz de lâmina d'água, chá, trigo do norte); Vila = *Aldeia*; Rio = *Rio Yangzi*; Estrada = *Calçada* de pedra.
- **Kits.** Casas `cottage` + `pagoda` (beiral curvo), `long` + `hip` e um sobrado `tall` + `pagoda` (casa de chá), telhas cinza-esverdeadas e madeira escura, um detalhe vermelho-vermilion no sobrado; `pagoda` como marco (os pagodes octogonais de tijolo e pedra são o símbolo do período); `junk` no rio; `cart` na calçada. A Song tinha o arroz Champa (colheitas rápidas e duplas), por isso arroz é a lavoura principal (0,5).
- **Aproximações.** O búfalo-d'água (animal de tração típico) não existe: usei `cow` em cinza-ardósia. Apicultura existia na Song (registro textual mais forte que nas dinastias anteriores), então `Colmeias` é plausível.
- **Paleta.** Jade/celadon e "seda em branco" nas névoas do vazio (`bg` `#d3e8dc`), tinta nanquim no `ui.ink` e nos telhados, e vermelho-selo (`#b23a2e`) como acento, como os carimbos dos rolos pintados **[C]**. Luz suave (`sunIntensity` 2.1).
- **Falta no motor.** Ponte em arco ou "ponte arco-íris" de madeira (Hongqiao), roda-d'água, salgueiro, amoreira (seda), búfalo, casa sobre estacas nas margens, portão *paifang*.
- **Fontes.** [Architecture of the Song dynasty (Wikipedia)](https://en.wikipedia.org/wiki/Architecture_of_the_Song_dynasty) · [Along the River During the Qingming Festival (Wikipedia)](https://en.wikipedia.org/wiki/Along_the_River_During_the_Qingming_Festival) · [Pagoda (Wikipedia)](https://en.wikipedia.org/wiki/Pagoda) · [The Song Dynasty (arroz Champa)](https://everything-everywhere.com/the-song-dynasty/) · [Bees in China (Univ. de Leeds)](https://eprints.whiterose.ac.uk/140918/1/bees_in_china.pdf)

## 3. Terra dos Vikings (`viking`)

- **Terrenos.** Prado = *Pastagem*; Floresta = *Pinhal* (pinheiros, bétulas, carvalhos); Plantação = *Cevadal* (cevada, centeio/aveia, linho); Vila = *Aldeia*; Rio = *Fiorde*; Estrada = *Trilha* de terra.
- **Kits.** Casas `long` + `turf` (metade das casas), `long` + `gable` de tábuas escuras e `cottage` + `turf`; chaminé com fumaça representa o fogo central da casa longa. `stave` como marco; `longship` no fiorde; `cart` (o carro de Oseberg, único veículo completo da era, existiu); ovelhas em tons de lã natural (branco, cinza, pardo). Centeio/aveia = `wheat` em tom apagado; linho = `lavender` azul-acinzentado.
- **Anacronismo.** A igreja de madeira escalonada (stave) é dos séc. XI–XII, posterior ao séc. X; foi o kit nórdico mais reconhecível. O ideal seria um *salão* (hof/hall) com cumeeiras de dragão. A cobertura de turfa era mais típica da Islândia e do Atlântico Norte; na Noruega e na Dinamarca a madeira foi substituindo a turfa ao longo da era, por isso um terço das casas usa telhado de tábuas.
- **Paleta.** Verde-escuro e azul-ardósia frios (luz `sunIntensity` 1.95, a mais baixa do conjunto); as cores vivas ficam para o tingimento: vermelho (garança), azul (pastel-dos-tintureiros) e amarelo (uva-de-tintureiro) aparecem nas velas e no carro, e as flores de urze roxa em `bush`/`flowers`.
- **Falta no motor.** Salão com dragões, casa longa com fileira de estábulo, estabur (armazém sobre estacas), runestone, ovelhas de chifre, rede de peixe secando.
- **Fontes.** [Medieval Scandinavian architecture (Wikipedia)](https://en.wikipedia.org/wiki/Medieval_Scandinavian_architecture) · [Viking houses (Skjalden)](https://skjalden.com/viking-houses/) · [Life on a Viking farm (History on the Net)](https://www.historyonthenet.com/life-on-a-viking-farm) · [Oseberg ship (Wikipedia)](https://en.wikipedia.org/wiki/Oseberg_ship) · [The Oseberg Wagon](https://www.worldtreeproject.org/items/show/2097) · [Plant dye colors in the Viking Age](https://skjalden.com/plant-dye-colors-in-the-viking-age/)

## 4. Toscana Renascentista (`toscana`)

- **Terrenos.** Prado = *Campina*; Floresta = *Oliveiral* (ciprestes, oliveiras, azinheiras); Plantação = *Vinhedo* (vinha, trigo, cevada, ervas); Vila = *Borgo*; Rio = *Arno*; Estrada = *Via* de pedra clara.
- **Kits.** `cypress` (40%) e `olive` (35%) dominam a floresta; casas `cube` + `hip` (casa colonica de pedra), `tall` + `hip` (palazzetto) e `cottage` + `gable`, todas com telha de terracota; `tower` como marco (São Gimignano chegou a ter 72 torres de famílias no auge); `cart` na estrada de pedra; `barge` no Arno (barcaça de fundo chato, como os navicelli); `cow` branca = boi Chianina, raça toscana com mais de 2.200 anos.
- **Decisão de historicidade.** O pedido incluía girassol, mas ele só chegou à Europa no séc. XVI, depois do Renascimento quatrocentista; troquei por trigo, vinha, cevada e um pouco de lavanda (ervas dos conventos). Basta mudar um item de `crops` para `sunflower` se o ícone visual valer mais que a exatidão.
- **Paleta.** A da própria paisagem: amarelo-trigo, verde-oliva, laranja-terracota e o vermelho profundo do Chianti (vira `ui.accent` `#8a2f3f`). Luz âmbar quente (`sunIntensity` 2.4, sol vindo da direita). Pinheiro-manso (guarda-sol) não existe como kit; `round` faz as vezes.
- **Falta no motor.** Cipreste em alameda (fileira ao longo da estrada), pinheiro-manso, ponte de pedra em arco, muros de contenção (terraços de oliveira), poço, castelo com muralha e ameias.
- **Fontes.** [Cypress trees and rolling hills: the landscapes of Tuscany](https://artisansofleisure.com/luxury-travel-blog/2023/03/cypress-trees-and-rolling-hills-the-landscapes-of-tuscany-italy) · [Chianina (Wikipedia)](https://en.wikipedia.org/wiki/Chianina) · [How the sunflower transformed from a garden novelty (Popular Science)](https://www.popsci.com/sunflowers-brief-history/) · [Chianti e San Gimignano (torres)](https://www.througheternity.com/en/tuscany-tours/Chianti-San-Gimignano.html)

## 5. Edo Tranquilo (`edo`)

- **Terrenos.** Prado = *Campo*; Floresta = *Bosque* (pinheiros, bambu, cerejeiras e bordos); Plantação = *Arrozal* (arroz, chá, cevada de inverno); Vila = *Machiya*; Rio = *Rio*; Estrada = *Tōkaidō* de terra.
- **Kits.** Machiya = `tall` + `hip` em madeira escura com reboco claro nas molduras (casas de comerciantes e artesãos, estreitas, de madeira e gesso); `cottage` + `pagoda` em gesso claro e `long` + `hip` (fileira de nagaya); `pagoda` como marco em marrom-avermelhado (madeira laqueada) e telhado cinza; `caravan` + `horse` na estrada (posta de cavalos de carga e carregadores, com pinheiros, cedros e ciprestes plantados ao longo da via); `barge` = *takasebune*, barco de fundo chato e pouco calado dos rios e canais; arroz em terraço (tanada, já praticado no início do Edo) e chá (Uji, perto de Quioto **[C]**; a expansão do chá em Shizuoka é posterior ao período), com cevada como cultura de inverno **[C]**.
- **Diferença para o tema `sakura`.** Aquele é o Japão de hoje, na primavera (rosa, trem-bala); este é sóbrio: madeira, papel, indigo (`water` `#40709a`, `ui.accent` `#34507a`), bordo em pequena proporção.
- **Paleta.** Cinza-washi no vazio, madeira escura nas paredes, telha cinza-azulada, verde-musgo; vermilion só no marco.
- **Falta no motor.** Torii, ponte de madeira arqueada, casa de fazenda com telhado de palha (gasshō), sala de chá, lanternas de pedra, carregadores/palanquim na estrada, muro de gesso branco.
- **Fontes.** [Machiya (JAANUS)](https://projects.mcah.columbia.edu/jaanus/node/2637) · [The Fifty-three Stations of the Tōkaidō (Wikipedia)](https://en.wikipedia.org/wiki/The_Fifty-three_Stations_of_the_T%C5%8Dkaid%C5%8D) · [Shimada, posto da Tōkaidō e chá](https://kupi.com/en/explore/japan/shimada/history) · [Takase River (Wikipedia)](https://en.wikipedia.org/wiki/Takase_River) · [Take no Tanada, arrozais em terraço (MLIT)](https://www.mlit.go.jp/tagengo-db/en/R2-01967.html)

## 6. Minas Colonial (`colonial`)

- **Terrenos.** Prado = *Pasto*; Floresta = *Mata Atlântica*; Plantação = *Canavial* (cana, milho, algodão, café); Vila = *Arraial* (assentamento minerador); Rio = *Ribeirão*; Estrada = *Estrada Real* de pedra.
- **Kits.** Sobrado `tall` + `hip` com esquadrias azuis, casa `cottage` + `hip` com esquadrias ocre e `long` + `gable` com esquadrias vermelho-óxido: as três compartilham paredes brancas de cal e telha de barro, de modo que "janelas coloridas" vem da troca de `trim` entre os tipos de casa (o esquema só tem uma cor por tipo). `baroque` como marco; `caravan` + `horse` (a tropa de mulas, ver abaixo); `canoe`; `granary` chamado *Paiol* (paiol de milho, típico de Minas); floresta com `round`, `araucaria`, ipê amarelo e roxo (`blossom`) e `palm` (jerivá, palmito).
- **Aproximações e anacronismos.** A mula não existe como animal: `horse` em tons de castanho. O café só chegou a Minas no fim do séc. XVIII e virou o motor da economia no séc. XIX; deixei-o pequeno (0,15) por pedido. Cana (aguardente das engenhocas) e milho são os cultivos dominantes no séc. XVIII; algodão é plausível (tecidos mineiros). Diferente do tema `cerrado` (Brasil de hoje, vilas coloridas, ferrovia), este é branco-cal com pedra e tropa.
- **Paleta.** Branco-cal, azul, ocre e terra vermelha (`ground[2]`, `side`), o vazio em azul-céu de montanha (`bg` `#cfe4ee`) para não brigar com os temas quentes. O casario histórico de Ouro Preto é branco com cor nas portas, janelas e balcões; estudos recentes recuperaram as camadas originais de cor.
- **Falta no motor.** Mula/burro de carga, chafariz de pedra-sabão, ponte de pedra, sobrado com balcão de ferro, mineração (monjolo, cata), engenho de cana com roda-d'água, telha capa e canal em faixas.
- **Fontes.** [Estrada Real (InfoEscola)](https://www.infoescola.com/brasil-colonia/estrada-real) · [The Original Colors: A Study on Ouro Preto (ArchDaily)](https://www.archdaily.com/1044354/the-original-colors-a-study-on-ouro-preto) · [Sabará: roteiro pela cidade histórica (Estado de Minas)](https://www.em.com.br/cidades/sabara/2025/06/amp/7183843-sabara-roteiro-pela-cidade-historica-onde-o-passado-segue-vivo.html) · [Os caminhos que cortam Ouro Preto](https://www.tribunapr.com.br/arquivo/viagem-turismo/os-caminhos-que-cortam-ouro-preto/) · [Cana e aguardente em Minas (UFMG/Cedeplar)](https://diamantina.cedeplar.ufmg.br/portal/download/diamantina-2000/godoy.pdf) · [História de Minas Gerais (governo de MG)](https://www.mg.gov.br/conheca-minas/historia)

## 7. Velho Oeste (`oeste`)

- **Terrenos.** Prado = *Pradaria*; Floresta = *Chaparral* (cactos, pinheiros, choupos, mesquite); Plantação = *Milharal* (milho, trigo, girassol, planta nativa); Vila = *Povoado*; Rio = *Rio*; Estrada = *Ferrovia*.
- **Kits.** Casas `long` + `gable` (rancho de madeira envelhecida), `cottage` + `gable` (casa de tábuas caiadas) e `tall` + `flat` (fachada falsa das ruas principais, típica de cidades de fronteira), com molduras brancas e chaminé; `church` como marco (o ideal seria a torre d'água, ver abaixo); `rail` + `steam` com locomotiva preta e detalhes vermelhos; `windmill` como moinho da sinergia (os moinhos-bomba americanos alimentavam as caixas d'água das ferrovias); vacas longhorn (`cow` em ferrugem e branco); `canoe` no rio.
- **Paleta.** Deserto avermelhado: vazio salmão (`bg` `#e8c8ae`), laterais em vermelho-rosado de rocha (`side`), chão de pradaria em palha, milharal em terra vermelha; sol baixo e quente (`sunDir` `[-0.7, 0.75, 0.45]`, `sunIntensity` 2.55), com sombras longas. Identidade separada do `cerrado` por sombra e pelo rosa do vazio.
- **Ferrovia real.** As locomotivas paravam para tomar água a cada ~20 milhas, daí as torres d'água com moinho-bomba no meio do nada; o trem chegou a Holbrook (Arizona) em 1881, o que ancora "c. 1880".
- **Falta no motor.** Torre d'água, moinho-bomba americano (rotor de aço com leme), vapor de pás no rio, estação de madeira com plataforma, celeiro vermelho, caixa de correio e cerca de arame, cavalo com sela, cabana de troncos.
- **Fontes.** [Lusk Water Tower (Wikipedia)](https://en.wikipedia.org/wiki/Lusk_Water_Tower) · [Railroad water tanks (True West)](https://truewestmagazine.com/railroad-water-tanks/) · [How windmills won the West](https://ouramericanstories.com/podcast/history/how-windmills-won-the-west/) · [1880 Town (South Dakota Magazine)](https://southdakotamagazine.com/1880-town) · [Holbrook e a chegada da ferrovia (Arizona Highways)](https://www.arizonahighways.com/archive/issues/chapter/Doc.913.Chapter.10)

## 8. Andes Incas (`andes`)

- **Terrenos.** Prado = *Puna* (altiplano de ichu); Floresta = *Bosque andino* (queñua/Polylepis, o bosque mais alto do mundo, aliso, palmeira-de-cera e a cantuta, flor sagrada dos incas); Plantação = *Andenes* (terraços de milho, quinoa e batata); Vila = *Aldeia*; Rio = *Rio Sagrado* (o vale do Urubamba); Estrada = *Caminho Inca* (Qhapaq Ñan, pavimentado com pedra).
- **Kits.** `round` + `cone` (palha de ichu) e `cottage` + `thatch` (o edifício retangular inca de telhado de palha em duas águas é o mais comum), `long` + `thatch` para as qollqas (depósitos); `temple` como marco (aproximação: o kit tem colunas, e o templo inca usa pedra talhada com nichos trapezoidais); `granary` = *Qollqa*; `caravan` + `llama`; `reedboat` para as balsas de totora do Titicaca; milho = `corn`, quinoa = `quinoa` (cinco cores por fileira), batata = `lavender` (aproximação: fileira de tufos com flor branca e lilás, já que não há kit de batata). Queñua = `olive` (copa larga, tronco retorcido e avermelhado); cantuta = `blossom` em magenta.
- **Paleta.** Verde de altitude amarelado (ichu) contra pedra cinza, água turquesa profundo do lago, céu lilás-acinzentado no vazio (`bg` `#d8d3e4`, tom único entre os temas), lã em vermelho e amarelo nos animais e na caravana. Luz clara de altitude (`sunIntensity` 2.3).
- **Falta no motor.** Templo trapezoidal sem colunas (Coricancha; há paredes curvas ali e no Templo do Sol de Machu Picchu), ponte de corda, canal de irrigação de pedra, escadas de terraço visíveis, batata e oca (kit de tubérculo), alpaca, cuy (porquinho-da-índia), chasqui (corredor).
- **Fontes.** [Inca Food and Agriculture (World History Encyclopedia)](https://www.worldhistory.org/article/792/inca-food--agriculture/) · [The Inca Road System (World History Encyclopedia)](https://www.worldhistory.org/article/757/the-inca-road-system/) · [Inca kancha (Wikipedia)](https://en.wikipedia.org/wiki/Inca_kancha) · [Inca architecture (Wikipedia)](https://en.wikipedia.org/wiki/Inca_architecture) · [Cantua buxifolia (Wikipedia)](https://en.wikipedia.org/wiki/Cantua_buxifolia)

---

## Kits que valeriam a pena adicionar ao motor (por prioridade)

Critério: quantos dos 8 temas (e dos temas base) melhoram, quanto o kit muda a leitura da miniatura e o custo provável (variar um kit existente é mais barato que um kit novo).

1. **Burro/mula e búfalo (`AnimalKind`: `donkey`, `mule`, `buffalo`).** Corrige três anacronismos ou aproximações de uma vez: Egito (caravana de burros em vez de camelos), Colonial (a tropa de mulas da Estrada Real) e Song (búfalo-d'água). Custo baixo: variante do corpo de `horse`/`cow` com orelhas maiores ou chifres.
2. **Roda-d'água / moinho d'água (`MillStyle`: `watermill`).** A sinergia vila + plantação em Song, Toscana, Edo, Viking e Colonial é hoje um "celeiro" quando historicamente seria um moinho de rio. Serve também ao engenho de cana.
3. **Ponte de pedra ou madeira em arco (decoração sobre o rio).** Aparece em Song (ponte arco-íris), Edo, Toscana, Colonial e como ponte de corda nos Andes; dá vida ao rio e à estrada juntos.
4. **Torre d'água e moinho-bomba (`Landmark`: `watertower`; `MillStyle`: `windpump`).** Marco central do Velho Oeste e conexão direta com a ferrovia a vapor; também útil a qualquer tema do séc. XIX-XX.
5. **Portão marco (`Landmark`: `gate`) com três estilos.** Torii (Edo), paifang (Song) e portal trapezoidal (Andes); barato (poucos volumes) e muito reconhecível.
6. **Estilo de templo parametrizável (`temple` com `colonnade`/`pylon`/`trapezoid`).** Hoje `temple` só tem colunas: um pilone com obelisco resolve o Egito (Novo Império) e um templo de pedra sem colunas resolve os Andes.
7. **Armazém sobre estacas (`MillStyle`: `stilt`).** Estabur viking, kura japonês, qollqa inca e celeiro egípcio; palafitas ribeirinhas (Song do sul) entram como variação.
8. **Salão comprido com dragões (`Landmark`: `hall`).** Marco fiel à Era Viking, no lugar da igreja stave (séc. XI–XII).
9. **Culturas: batata, linho, amoreira (`CropStyle`: `potato`, `flax`, `mulberry`).** Substituem aproximações com `lavender` (Egito, Viking, Andes) e completam a Song (seda).
10. **Árvores: salgueiro, pinheiro-manso, palmeira-de-cera (`TreeGeo`: `willow`, `umbrella`, `waxpalm`).** Melhoram a silhueta da Song, da Toscana e dos Andes; cipreste em alameda (fileira ao longo da estrada) é um extra de layout.
11. **Barcos: vela quadrada do Nilo e vapor de pás (`BoatKind`: `nile`, `paddle`).** Deixam Egito e Velho Oeste fiéis à época; o primeiro tira a dependência da falua, de vela latina.
12. **Estação de fim de linha por tema.** Se ainda não houver, uma plataforma de madeira com caixa d'água no Oeste e um pouso de tropa na Estrada Real reforçariam a identidade da linha (terreno 5) em cada época.
