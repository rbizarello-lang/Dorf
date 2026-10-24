# Relevo no Retalhos: pesquisa e proposta (rodada 3)

Só leitura do código; nada foi alterado. Referências: `images/2.jpg` (ilha com serra e cachoeira caindo no mar), `images/1.webp` (Weatherglass: pico, cachoeira, lago), `images/4.webp` (Dorfromantik: chão plano, sem montanha).

## O que o código tem hoje (e importa aqui)
- Chão plano em y = 0. Só o rio escava o leito (`groundY` = `field.ground`) e `WATER_Y` é fixo (-0,02). Peça = 6 setores + lateral de terra e rocha até -0,28 (`TILE_T`) em **todas** as 6 bordas, inclusive as que ficarão escondidas.
- A emenda do rio é resolvida por **dado da vizinha já colocada** (`widthsAt`, `flowAt`), registrado no `World` na hora do assentamento. Peça assentada nunca muda.
- A escolha do clique é por plano (`intersectPlane`, `world.ts` ~1704/1717): com altura, vira raio contra colunas.
- Regras (`core`) não sabem nada de altura. Tema é dado (invariante 8).

## 1. Formas de relevo
**(a) Decoração pura (morros, picos, pedras grandes dentro da peça).**
- Tela: kit `peak`/`hill` em vértice colorido (rocha + neve por altura), como árvore ou casa. Entra em peças de Prado/Floresta com peso baixo, onde `clear()` deixa espaço.
- Regras: nenhuma. `core` intacto, replay intacto, **sem `SAVE_VERSION`**. Invariante 3 preservada (sai de `edges`, `seed`, `theme`).
- Limite: não muda a decisão de quem joga e some de longe. Barato, mas é "enfeite".

**(b) Altura por peça (degraus) com cachoeira onde o rio desce.**
- Tela: a ilha de `2.jpg`: platôs, penhascos, rio que cai. Muda a leitura do tabuleiro inteiro.
- Regras: pode ser só visual (nível sai de uma função da semente) ou entrar na pontuação depois. Visual puro: **sem `SAVE_VERSION`**. Se pontuar (ver 7, etapa G), bump.
- Cuidado: mexe em câmera, clique, sombra, água, vida (barcos, trens). É a mais rica e a mais arriscada.

**(c) Terreno novo "Serra" (`T.Mountain`).**
- Tela: a peça é montanha de verdade, 1 a 3 bordas.
- Regras: mexe em `T` (enum e `TERRAIN_COUNT`), `LAND_WEIGHTS`, `ground[6]` e nomes em **14 temas**, `synergy.ts` (serra×rio = nascente, serra×vila = mina), missões, paleta de daltonismo, `tests/legibility.ts`, oráculos de `tests/logic.ts`. Muda o sorteio das peças, então **`SAVE_VERSION` 14** e saves antigos caem.
- Borda: **não estrita** (como os 4 terrenos comuns), pontua em grupo. Estrita deixaria peças sem encaixe e a pilha trava. Rio entra na serra só por interação, não por borda.
- É a mais cara e a de maior risco de equilíbrio (`npm run balance`). Só vale depois de (b) provar que o relevo agrada.

## 2. Emendas com altura sem quebrar o determinismo
Ideia central: **o nível de cada casa sai de uma função pura da semente, `levelAt(seed, q, r)`, e não da jogada.** Assim a peça sabe o nível de **todos** os vizinhos, presentes ou futuros, ao ser montada. Não precisa de `widthsAt` para altura.
- `core/relief.ts` (puro, sem three): ruído suave e de comprimento de onda longo, arredondado a níveis 0, 1, 2. Passo de ruído por casa < 0,5, então vizinhos diferem no máximo 1 degrau. A origem (peça 0) fica no nível 0.
- A peça é montada deslocada por `level * STEP` (STEP ~0,30, quase `TILE_T`). O topo da borda fica plano na altura do nível: a emenda entre mesmo nível é a de hoje.
- **Parede do penhasco:** a lateral já desce até -0,28 em toda borda. A peça mais alta passa a descer do **seu** nível até o fundo; a vizinha baixa esconde a parte de baixo. Quem é mais alto desenha a parede toda, sem depender de quem foi colocada antes. Sem z-fighting porque o degrau é sempre inteiro.
- **Estrada e trilho:** ficam no meio da borda, na altura do próprio nível. Entre níveis iguais, nada muda. Entre níveis diferentes, a via sobe na peça alta por uma rampa de 1 degrau que acaba na borda (degrau de pedra na costura). Trilho: no primeiro corte segue plano na peça alta, com corte de trincheira no setor, e aceita o degrau de 0,3 na emenda; o `maglev` elevado é o precedente de viaduto.
- **Rio:** a água fica em `WATER_Y + nível*STEP` dentro de cada peça. Entre níveis diferentes, **cada lado constrói a sua metade**: a alta termina o rio num lábio e abre a queda; a baixa abre a bacia de espuma. Nada depende de ordem.
- **Correnteza:** em `flowAt`, a borda com degrau passa a ser **forçada** (sai da alta, entra na baixa). As outras bordas seguem `resolveFlow` (se entra por uma, sai por outras). Conflito (a vizinha já assentada manda água morro acima) já cai no "remanso" que o código tem; no pior caso aparece uma peça de nascente ou lago, aceitável.
- Largura (`widthsAt`) nas bordas com degrau: a da vizinha, como hoje.
- Mapa do chão (`groundMap.ts`) e costura de cor: ficam em 2D; a costura entre níveis diferentes **não** deve borrar (parede é outra superfície): `seamAt` só liga quando os níveis são iguais.

## 3. Cachoeiras
- **Onde:** só na borda de **rio com degrau** (`levelAt` difere, ambos com água). Mais um caso por conta própria: rio que chega à borda aberta do mapa e cai no mar/vazio (como em `2.jpg`), só em tema `surround: 'mar'`.
- **Geometria:** lâmina de água vertical de ~6 a 10 triângulos (leve curvatura no lábio, largura = `widths`), mais uma pedra em cada lado. Vai para um pool `fall` (instanciado), não para o bloco estático, para animar.
- **Material:** o da água existente com `wflow` apontado para baixo e a velocidade subindo com a queda (listras alongadas, faixas brancas pelo ruído de `noise.ts`). Sem GLSL, TSL como o resto (invariante 9). Cor e espuma vêm do tema (`water`, `bank`).
- **Espuma e névoa:** anel de espuma no pé (já há espuma no `seaMap` e nas esteiras), uma névoa leve em sprites do `fx.ts`: 2 a 4 partículas por queda, com o `dt` do mundo (invariante 13).
- **Som:** `audio.ts` já tem `setAmbience` por proximidade do foco: acrescentar um ruído filtrado (passa-faixa, sem arquivo) com volume pela distância à cachoeira mais próxima. Respeita o silêncio do modo foto.
- **Vida:** barco não sobe nem desce queda: `life.ts` trata o degrau como fim de linha (o barco dá meia-volta). Peixes só na bacia.

## 4. Câmera, sombras, legibilidade, "Onde encaixa"
- **Câmera:** o enquadramento (`rig.dist`) segue; a altura de foco passa a ser o nível da peça focada. Picos altos de 1 a 2 degraus (0,3 a 0,6) mais pico (~0,5) tapam, no máximo, uma casa atrás com a inclinação baixa. Limite: altura total ≤ 0,9 acima do chão. A peça atrás de um morro é dita pelo fantasma e pelas marcas por cima (sem teste de profundidade).
- **Clique:** trocar o plano único por busca no raio: testa o plano de cada nível (0, 1, 2) e aceita o hexágono cujo nível bate. Barato. O fantasma sobe com o nível da casa.
- **Sombra:** o sol baixo à tarde projeta sombra do platô na vizinha: vale e até ajuda a leitura. O cache da sombra (4 Hz, só refaz com peça nova) não muda. As cascatas precisam cobrir a altura extra: conferir `shadowDraws`.
- **Legibilidade:** parede de penhasco em rocha escura sobe o contraste; testar `?silhueta` (picos pretos sobre branco) e `tests/legibility.ts` para o chão em cada nível (sombra de parede cai sobre a vila ao lado: risco para casas legíveis). Regra: vila em casa de nível 2 é ok; vila encostada numa parede de 2 degraus ao sul fica sombreada, então o `levelAt` limita degraus a 1 e platô com mais de 3 casas.
- **"Onde encaixa" (`rankMoves`):** não muda (é `core`). Só desenhar a marca na altura do nível. Se o relevo virar pontuação (etapa G), `rankMoves` já conta os pontos reais.

## 5. Custo contra o orçamento (Alta, 300 peças: ~136 draw calls, ~1,46 M triângulos)
- Degrau + parede: as laterais já existem; só ficam mais altas. **+0 draw calls**, triângulos ~+0.
- Relevo interno suave (morro dentro da peça) exige malha mais fina (N=8 em vez de 4: 96 para 384 tris de topo). Só nas peças com morro (~15%): ~+45 mil tris (+3%).
- Pico decorativo (kit `peak`, ~80 tris, 1 pool): +1 draw call, +20 a 40 mil tris com 300 peças.
- Cachoeira: pool `fall` +1 draw call, poucas centenas de tris, +partículas do `fx`.
- Soma estimada: **+2 a 3 draw calls (~2%) e +5 a 8% de triângulos**, dentro da regra de 10%. No Ultra e Cinema as cascatas de sombra repetem tudo (~+8%). CPU de montagem: `levelAt` é O(1) por casa (ruído); o resto é geometria já existente. Árvores leves de longe (`Lib.farGeo`) valem para o pico também: dar a ele uma versão de 3 lados.
- Medir com `RUNS=300:high node scripts/stress.mjs` e `?zoom=` fixo antes e depois.

## 6. Temas (o relevo deve ser **dado do tema**)
Campo novo `Theme.relief?: { amp: number; style: 'suave' | 'serra' | 'terraco' | 'falesia' | 'dique'; peak: kit; fall: boolean }`. O renderizador sabe desenhar cada estilo; o tema só escolhe (sem `if (theme.id === ...)`). `amp = 0` desliga: o jogo fica como hoje.
- **Holanda:** `dique`. Nível 0 quase todo; o relevo é a borda: diques baixos (um degrau de 0,1 em linha) e moinho em montículo. Sem cachoeira. Fica fiel ao tema plano.
- **Egito:** `falesia`. Falésias do Nilo nos dois lados do rio: platô nível 1 de cada lado de uma faixa baixa (arenito, sem neve); sem cachoeira, com catarata discreta (corredeira) só no Alto Nilo.
- **Oriental:** `terraco` e `serra`. Picos de névoa tipo ink-wash e arrozais em degraus (plantação em níveis 0, 1, 2 com muretas); cachoeira fina entre pagodes. É o que mais ganha.
- **Brasil:** `serra`. Serras e chapadas, cachoeira alta e larga, com tema tropical (rocha vermelha, mata no topo). Boa vitrine da queda.
- **Inverno Nórdico:** `serra` + fiorde. Picos com neve, paredes de falésia para o mar (`surround: 'mar'`), cachoeira que cai direto no fiorde.
- **Temas antigos (14):** `amp` padrão baixo (0 a 0,3); Marte e Cristais com picos de cristal pelo mesmo kit com outra cor.
- O relevo nunca muda o sorteio das peças: só a aparência. Tema novo = escolher `relief`, como `gate` e `bridge` hoje.

## 7. Recomendação em etapas
**Etapa 1 (P): Picos e morros decorativos (forma a).**
- Kit `peak`/`hill` (com `farGeo`), campo `Theme.relief` com `amp` e `peak`, só nos 5 temas novos e no Oriental/Brasil primeiro.
- Pronto quando: `?gallery` mostra o kit nos 5 temas, `?silhueta` lê, `npm run check` verde sem `SAVE_VERSION` novo, triângulos +≤5% no `stress.mjs`, uma captura por tema.

**Etapa 2 (M): `levelAt` + degraus e paredes (forma b, sem água).**
- `core/relief.ts` puro com teste (diferença ≤1 entre vizinhos, determinismo por semente, origem no nível 0); `tileBuilder` desloca a peça e alarga a parede; clique por nível; fantasma e marcas no nível; câmera segue.
- Pronto quando: tabuleiro de 60 peças com platôs bonito de perto e de longe, o clique acerta em todos os níveis, estrada sobe sem fresta, `compare` só muda o esperado, `check` e `smoke` (WebGPU e WebGL2) verdes, sem `SAVE_VERSION`.

**Etapa 3 (M): Cachoeiras e rio entre níveis.**
- Água por nível, queda de cada lado, `flowAt` forçado, pool `fall` com material TSL, espuma, partículas, som, barco dá meia-volta.
- Pronto quando: `window.__river` ganha variante com degrau, sem frestas na emenda a 3 zooms, `scripts/weather.mjs` sem erro nos 14 temas, +≤3 draw calls.

**Etapa 4 (G, opcional): Serra como terreno ou bônus de relevo.**
- Só depois de jogar as etapas 1 a 3 e decidir que vale a regra. Opção leve: bônus de interação "cachoeira" (rio com degrau × vila = +pontos) em `synergy.ts`, que exige `SAVE_VERSION` 14 e oráculo novo. Opção pesada: `T.Mountain`.
- Pronto quando: oráculo independente em `tests/logic.ts`, `npm run balance` sem queda de média nem de partidas travadas, 14 temas com nome e cor, aviso de save antigo.

**NÃO fazer:**
- Não pôr altura em `core` que dependa da **jogada** (ordem de colocação): quebraria replay e emenda. O nível sai só da semente.
- Não fazer rio subir morro nem trilho em rampa íngreme; não dar nível diferente sem parede inteira (frestas).
- Não pôr `if (theme.id)` no render; não carregar arquivo de arte (modelos, texturas): tudo procedural.
- Não começar pela Serra como terreno (etapa 4): é a mais cara, mexe em 14 temas e no equilíbrio.
- Não passar de 2 degraus nem de ~0,9 de altura: a câmera baixa esconderia peças.
- Não bumpar `SAVE_VERSION` nas etapas 1 a 3 (são só aparência).
