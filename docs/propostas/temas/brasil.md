# Tema BRASIL (fusão de `cerrado` + `colonial`)

## 0. Nome (3 propostas)
1. **Brasil das Gerais** (recomendado): "Gerais" é o nome antigo e real do cerrado mineiro e também de Minas. Junta chapada e casario numa palavra só.
2. **Estrada Real**: o caminho do ouro, do café e das tropas. Já é o nome do modo de rotas, então pode confundir.
3. **Brasil Dourado**: ouro do barroco, ouro do capim seco, ouro do ipê. Simples, mas é mais genérico.

Id sugerido: `brasil`. Mantém `colonial` e `cerrado` fora do menu.

## 1. Identidade
Minas Gerais entre o século XVIII e o XIX, vista de cima da chapada: casario caiado e igrejas barrocas nas ladeiras de pedra, cercados por cerrado de árvores tortas, ipês floridos e buritis, com tropeiros, carros de boi e cachoeiras. A pessoa deve sentir calor de fim de tarde, cheiro de café coado, sino de igreja e festa de junho: um Brasil interior, sereno e festivo.

Escolha de vegetação (coerência): **cerrado + mata de grota (mata atlântica de montanha)**. Araucária sai: é do Sul e destoa de Minas. Ela vira, no máximo, um easter egg raro.

## 2. Os 6 terrenos
Nomes (`terrainNames`): **Cerrado, Grota, Lavoura, Arraial, Ribeirão, Estrada Real**.
| Borda | O que vira (forma, não só cor) |
|---|---|
| Prado = **Cerrado** | Capim dourado ralo com árvores tortas esparsas, **cupinzeiros** (montinhos de terra vermelha, kit novo), flores-do-campo e touceiras de capim-dos-pampas. Chão ocre com terra vermelha aparecendo. Visualmente "aberto", em contraste com a Grota. |
| Floresta = **Grota** | Mata fechada e verde-escura nos vales: copas redondas, quaresmeiras (roxas), **ipês** amarelo/rosa/branco (`blossom`), jerivás (`palm`), embaúbas e samambaias. Só aqui o verde é denso. |
| Plantação = **Lavoura** | O campo vira **terraço de café** (fileiras em curva de nível, frutos vermelhos), **canavial** alto e ondulante, milharal e algodão. Novo: **cafezal em floração** (flores brancas, easter egg de estação). O café é a assinatura: é o que tira o Brasil do "campo de trigo". |
| Vila = **Arraial** | Casario colado, ruas de pedra (pé-de-moleque) subindo, igreja no alto. Ver seção 3. |
| Rio = **Ribeirão** | Água cor de chá-mate clara, leito de pedra rosada, margem de **buritis** (vereda) e, onde cabe, **cachoeira** (queda curta com espuma). |
| Estrada = **Estrada Real** | Calçada de pedra irregular (`stone`), com a **tropa de mulas** e o **carro de boi** (kit novo) em vez do trem. A maria-fumaça sai da linha comum e vira easter egg (seção 6). |

## 3. Construções
- **Casas** (3 tipos principais, vocabulário de hoje): 
  - sobrado `tall` + `hip`, parede branco-cal, esquadrias azul-colonial, beiral "beira-seveira";
  - casa térrea `cottage` + `hip` em ocre/rosa/azul-pastel (herança do cerrado: casinhas coloridas), esquadria ocre;
  - `long` + `gable` com varanda: a **fazenda** (ver estilo novo abaixo);
  - raros: `annex` (cozinha/paiol), `cross`.
- **Estilo novo de telhado: `colonial`** (`RoofStyle`): telhado de capa-e-canal com **beiral duplo em "cachorrada"** e ponta levemente levantada (a "aba" do telhado colonial brasileiro). Custa quase nada a mais que `hip` (+~20 triângulos). Sem ele, o `hip` parece europeu.
- **Marco**: `baroque` (já existe, duas torres). Pedir ao kit **fachada com frontão curvo, óculo e cruz** (variante `baroque` por parâmetro), e uma segunda opção de marco: **capela de uma torre só** (`church`), para variar. `landmarkChance` ~0,13.
- **Interações** (`synergy`): Serraria (vila×floresta), **Engenho** (vila×plantação; roda d'água com chaminé e cana empilhada, em vez do silo; `mill: 'granary'` hoje, ideal um `MillStyle` novo `'engenho'`), **Curral/Pouso de tropa** (vila×prado: cercado com ranchos de tropeiro e mulas), **Apiário de jataí** (caixinhas de abelha-sem-ferrão).
- **Portal** (`gate`): novo `GateStyle: 'porteira'` (porteira de madeira com mourão e arco simples). Pequeno, 1 pool.
- **Ponte** (`bridge`): `stone` (ponte de pedra de arco único, já existe). Variante `wood` coberta fica fora.
- **Eras** (`eras`): **Pouso, Arraial, Vila Rica, Cidade**.
  - I: casa de **pau-a-pique/taipa com sapê** (o `housesAtEra` já faz taipa e palha), poucas e baixas, só uma capelinha de pau.
  - II: casario caiado, telhado colonial, igreja matriz.
  - III: sobrados com **balcões de ferro** (usa o `tall`) e chafariz.
  - IV: flâmulas e janelas mais acesas, **Centro** com praça de pelourinho/chafariz. Maravilha: **Santuário do Bom Jesus de Matosinhos** (`core: 'church'`; os **Doze Profetas** em soapstone na escadaria são um detalhe novo pequeno) ou "Matriz de Ouro Preto". Preferir o Santuário: visual único, fácil de reconhecer.
- `center: 'spire'` (campanário) funciona; `folk`: chapéu de palha, pele variada.

## 4. Vegetação, bichos e o que se move
- **Árvores** (`forest`, pesos sugeridos): `olive` 0,22 (cerrado tortuoso: tronco retorcido, cor verde-oliva/acinzentada, é o kit que melhor imita pequi e lixeira), `blossom` ipês 0,25 (amarelo `#f2c12e`, rosa `#e96fae`, branco, roxo), `round` 0,2 (copa da grota), `waxpalm` 0,13 (**buriti**, só junto de água ou na grota), `palm` 0,12 (jerivá), `araucaria` 0,08 (raro).
- **Cupinzeiro** (decoração nova): cone de terra vermelha de 0,03 a 0,06 de altura, em tufos de 1 a 3, no Cerrado. ~10 triângulos cada.
- **Animal de fazenda** (`animals.kind`): hoje só 1 por tema. Usar `'cow'` (cores do zebu: branco-acinzentado) e deixar o `donkey/horse` para a tropa.
- **Fauna selvagem** (campo novo, ver seção 8): **ema** (ave alta com pescoço, andando em dupla no Cerrado, foge devagar), **lobo-guará** (pernas altas, pelo laranja, ao entardecer), **tamanduá-bandeira** (cauda grande, de manhã), **araras** (bando vermelho e azul, no lugar dos pássaros comuns, voam em pares) e **tucano** raro. Mexem com o `Life` como os `animals` de hoje, poucas instâncias.
- **Barcos**: `canoe` (já existe), + **balsa** de passagem (`barge`) em rio largo. Peixes: dourado e pacu nos cardumes (cor).
- **Veículos**: `caravan` (tropa de mulas) na Estrada Real; **carro de boi** (kit novo `'oxcart'`: eixo de madeira, rodas maciças, 2 bois) como segundo veículo, mais raro. Aldeões: lavadeiras no ribeirão, tropeiro com chapéu.
- **Sino** da matriz balança na cena quando uma peça de vila é posta (só animação de dt).

## 5. Água, entorno, clima, paleta, som
- **Água**: `water` `#4f9fa8` (verde-chá, mais quente que o `colonial`), `bank` areia rosada. **Cachoeira**: onde um Ribeirão encosta numa borda de Grota, o leito ganha um degrau de ~0,05 com espuma (reaproveita `wflow`/`wbed`; é só geometria do leito, sem draw call novo). Buritis sobre a margem formam a **vereda**.
- **Entorno** (`surround`): hoje `'areia'` (cerrado) e `'mar'` (colonial) não servem. Proposta: novo valor **`'chapada'`**, o `makeVoidMaterial` vira um "mar de capim" dourado com manchas de terra vermelha, silhueta de serras azuis ao longe pela bruma. Sem malha nova. Alternativa barata: manter `'areia'` com cor ocre e `atmos.haze` alto.
- **Clima**: `pollen` (já existe) como pólen de capim, com densidade baixa. **Chuva de verão** tocável já existe. Outra: **fumaça de queimada distante** só como bruma `hazeColor` âmbar na hora dourada (dado).
- **Hora do dia**: tarde longa e dourada. `sunDir` baixo `[-0.55,0.8,0.4]`, `sun` `#ffe0b0`, `sunIntensity` ~2,5; `grade.shadow` roxo-azulado (`#5a5a8c`) e `light` âmbar; `saturation` 1,06. Céu azul intenso (`hemiSky` `#f2f6fb`).
- **Paleta**: ouro seco, terra vermelha, branco-cal, azul-colonial. Evitar verde-pastel: o Brasil se separa do Vale pelo contraste (verde-escuro da grota contra o ouro do campo).
- **UI**: `frame: 'papel'` (ou nova moldura de **azulejo** `FrameKind: 'azulejo'` em CSS, só dado), `emblem: 'ipe'` (já existe).
- **Som** (`audio.ts`): escala mixolídia com timbre `pluck` (viola caipira; o `cerrado` já usa `[0,2,4,5,7,9,10]`); ambiente de **cigarras**, **bem-te-vi** (curto), sinos de igreja ao completar uma era (`bell`), **carro de boi rangendo** perto do veículo, cachoeira perto de queda. Sanfona opcional no fim de partida.

## 6. Easter eggs (3 a 5)
1. **São João** (data): de 12 a 30 de junho (data local), a vila ganha **bandeirinhas** de papel cruzando as ruas, **fogueira** (luz laranja à noite, faíscas) e **balões** que sobem devagar. Mexe no render só como camada visual (como o clima tocável), fora do save.
2. **Maria-fumaça** (combinação): 3 peças de Estrada Real em linha reta, saindo de uma vila e chegando em Cerrado, ganham dormentes e trilhos e uma **locomotiva** passa. Determinístico pela semente da peça.
3. **Doze Profetas** (maravilha): ao erguer a maravilha, 12 estátuas de pedra-sabão surgem na escadaria, e ao zoom máximo uma delas (a 7ª) tem um chapéu de tropeiro.
4. **Onça-pintada na vereda** (raro, ~1 em 40 peças de Grota com Ribeirão, pela semente): uma pequena silhueta pintada deitada num galho sobre o rio.
5. **Florada do café** (hora/estação): na primavera dentro da partida (`seasons.ts`), os cafezais viram **brancos** por uma estação; e **cupinzeiro luminoso** (vaga-lume de cupim, bioluminescência) em noite de lua nova, no Cerrado.
Opcional: Zé do Boi / Saci (um redemoinho de poeira que sobe e some no Cerrado ao meio-dia).

## 7. O que vem de cada tema
- **De `cerrado`**: ipês, buritis, canavial/café, cor quente do fim de tarde, `pollen`, trilha pluck. Descartar a **ferrovia e o trem a vapor** como padrão (a Estrada Real é a espinha), as casas coloridas demais (reduzir a gama) e o `surround: 'areia'`.
- **De `colonial`**: casario caiado, `baroque`, a tropa (`caravan`), ponte de pedra, `ruleNote` dos tropeiros, eras Pouso→Cidade, "Estrada Real", Santuário. Descartar o `mar` e a `araucaria` dominante, e o fundo azul-acinzentado (frio demais para o dourado).
- **Regras**: `rules: { perfectBonus: 25, synergyBonus: { pasture: 5 } }`. Pede `SAVE_VERSION`? Só se o tema novo mudar rotas de replay; como as regras já existem nos dois temas antigos, deve bastar rodar `npm test`. Confirmar.

## 8. Lista de trabalho
| Item | Tipo / custo | Draw call novo? |
|---|---|---|
| Telhado `colonial` (beiral duplo) | P, +~20 tri/casa | não (pools `roof:i`) |
| Cupinzeiro | P, ~10 tri | sim, 1 pool |
| Carro de boi (`VehicleKind: 'oxcart'`) | M, ~120 tri | pequeno (dentro de `Life`) |
| Fauna: ema, lobo-guará, tamanduá, arara, tucano | M cada, 60 a 100 tri | sim, pools no `Life` (1 por espécie, só quando aparecem) |
| `MillStyle: 'engenho'` | M, ~150 tri | não, mesmo pool do moinho |
| `GateStyle: 'porteira'` | P, ~40 tri | pequeno |
| Cafezal em terraço (`CropStyle: 'terrace'` ou `coffee` com curva) + florada | M, plantas já instanciadas | não |
| Cachoeira (degrau do leito + espuma) | M (lógica no `tileBuilder`) | não |
| Bandeirinhas, fogueira, balões (São João) | M, sprites e fios | 1 pool |
| Locomotiva (easter egg) | reaproveita `steam` | não |
| `surround: 'chapada'` | M, só shader | não |
| `FrameKind: 'azulejo'` | P, CSS | não |
**Campos novos em `Theme`**: `fauna?: { kind: WildKind; weight: number; colors: string[]; time?: 'dia'|'tarde'|'noite' }[]`, `festa?: { month: number; days: [number, number]; kind: 'junina' }`, `surround: 'chapada'`, `RoofStyle: 'colonial'`. O resto é dado.
**Ordem**: (1) tema só com dados (paleta, nomes, eras, casas existentes); (2) telhado colonial + cupinzeiro + cachoeira; (3) fauna e carro de boi; (4) engenho, porteira, `chapada`; (5) easter eggs e São João; (6) som.

## 9. Riscos
- **Legibilidade** (`tests/legibility.ts`): paredes brancas contra chão claro (vila `#cdb98f`) já passam no `colonial`; telhado terracota contra Cerrado ocre é o ponto frágil. Manter o chão da vila mais frio/claro (`#d6c9a4`) e telhados escuros. Rodar o teste com todas as cores de casa.
- **Orçamento**: ipês e fauna somam instâncias; manter `treesPerSector` [4,7] e o `farGeo` ligado. Fauna só perto da câmera. Regra dos 10%: conferir com `RUNS=300:high node scripts/stress.mjs` antes e depois.
- **Invariante 3**: cupinzeiro, onça e cachoeira têm de sair de `(edges, seed, theme, opts)`. A cachoeira depende da vizinhança (como a largura do rio): usar `opts`, como `widths`.
- **Invariante 8**: nada de `if (theme.id === 'brasil')`. São João e florada entram por campos do tema (`festa`) e o render só lê o campo.
- **Invariante 13**: bandeirinhas, balões e fauna só andam pelo `dt` / `U.time`.
- **Contraste verde**: Grota e Cerrado precisam de ΔE ≥ 12 entre si e para a água (ver `docs/TEMAS.md`).
- **Anacronismo declarado**: café em larga escala é do XIX e a maria-fumaça mineira também; o tema trata os dois como "Brasil interior" sem ano exato. Registrar em `docs/TEMAS.md`.
