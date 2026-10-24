# Avaliação: árvores e florestas

Base: `images/4.webp` (original), `images/5.webp` (Holanda, Ultra), `capt/d19/*`, `capt/d15/antes-vale-perto.jpg`, `aval/main/holanda-aberto.png`. Recortes ampliados do original em `aval/arv/ref-mata.png` e `ref-outono.png`.
Escala: o hexágono tem raio 1 (`HEX_R`, `src/core/hex.ts`). A casa "cottage" mede ~0,18 de altura com telhado (`lib.ts:167`).

## 1. Diagnóstico

**1. A escala é o maior motivo: nossa árvore é 2 a 3 vezes a casa, a do original é 1 a 1,3 vezes.**
- Nossa copa mede 0,35 a 0,47 de altura base × `TREE_SCALE 1,3` (`tileBuilder.ts:159`) × `randRange(0.9,1.4)` × `sy` 0,9 a 1,15 (`:1186-1188`). Dá 0,5 a 0,85, contra ~0,3 da casa. Na `5.webp` (canto esquerdo) uma árvore é maior que um quarto da peça.
- No original (`ref-mata.png`) cada árvore tem a altura de uma casa ou menos. A mata vira textura, e a casa e a floresta cabem na mesma cena.
- A tela inteira de uma peça de mata nossa tem ~20 a 35 árvores: `treesPerSector` 3 a 8 × 0,7 (`:1232`), com `free(…,0.125)` (`:1235`) como espaçamento mínimo.
- No original há uma centena ou mais por peça, a ~1/3 desse espaçamento.
- Resultado: o original lê como **massa**, com borda recortada e interior fechado. O nosso lê como **árvores soltas sobre grama**, e o chão aparece entre elas (`vale-aberto`, `d19/aberto-antes-vale30`).

**2. A paleta do original tem três valores e um acento. A nossa fica numa faixa de tom e valor só.**
- No `ref-mata.png` a base é verde-azulado escuro (teal) com poucas folhas verde-lima claras. Cerca de 5% são acentos de cor viva: vermelho, lavanda-acinzentado e laranja.
- A copa é escura e saturada contra um chão verde-oliva claro. A mata é a parte mais escura da tela e o resto respira em volta. O contorno escuro (tinta) fecha cada silhueta.
- Nosso Vale: `themes.ts:40-43`. Os verdes ficam entre `#26583a` e `#93b84e`, com 10% de lilás/laranja. No outono o shader puxa 40% para ocre/ferrugem (`materials.ts:317-322`).
- Na Holanda (`themes.ts:111-114`) tudo é verde-oliva `#4f7a3a`~`#9dbb66`, mais o mesmo ocre do outono. Em `holanda-aberto` a mata vira mancha cáqui, quase do valor do chão ao lado. Sem contraste de valor a floresta perde a leitura.
- A pincelada (`materials.ts:366-370`) varia só ±14% no brilho. Pouco para dar vida.

**3. O original usa 3 silhuetas que repetem e contrastam. Nosso conjunto mistura formas parecidas.**
- No original: copa redonda tipo pirulito (a mais comum), cipreste estreito e alto, e ponta de abeto. Uma é gorda, a outra é fina e a diferença de proporção cria ritmo no topo da mata.
- Nosso Vale mistura `conifer` (3 cones de 7 lados, `lib.ts:355-361`), `oak` (3 esferas, `:392-397`) e `round` (esfera única). `oak` e `round` parecem iguais de longe.
- `conifer` é um cone largo e baixo de 3 andares, sem diferença de proporção para o cipreste.
- `softCanopy` (`lib.ts:~451`) deixa as normais muito lisas. As copas ficam borrões de luz, sem uma quina que defina a forma. É por isso que, de longe, a copa do nosso Vale vira "nuvem de oliva" e o abeto vira "cone marrom" (`d19/antes-vale.jpg`, as árvores marrons da esquerda).

**4. A mata do original tem borda e sombra. A nossa tem só um disco de terra por árvore.**
- O original escurece o chão sob a mata inteira, e ela sombreia a si mesma (profundidade). A borda da mata é recortada e as árvores da frente são mais claras que as de dentro.
- Nós gravamos um disco escuro de raio `0,055·s` sob cada árvore (`tileBuilder.ts:1289-1292`). Como as árvores são espaçadas, o disco é uma mancha isolada e não une a massa.
- A sombra da luz principal também ajuda pouco, porque a câmera baixa vê só o lado iluminado.
- Nada compõe a "linha da mata" entre peças: não há árvore menor ou mais rala na borda de uma peça de mata que encosta em prado.

**5. Onde o nosso é melhor: iluminação e detalhe de perto.**
- Em `d15/antes-vale-perto` as copas têm gradiente, pincelada, balanço ao vento e rim light. Isso é bom e deve ficar.
- O problema é que esse acabamento está em poucas árvores gigantes, e não em muitas pequenas.
- Os temas fora do Vale e da Holanda têm formas ricas e já legíveis (bétula, salgueiro, guarda-sol, palma, cerrado). Esse trabalho não se perde.

**6. O PR D19 (árvores leves de longe) não piora a área, mas também não resolve.**
- Troca copas por octaedros/tetraedros e cones de 3 lados quando `rig.dist > 18` (`world.ts`, `setFarTrees`). O antes/depois é praticamente igual: `d19/aberto-antes-vale30` × `aberto-depois-vale30`.
- A mancha é de poucos pixels, então a perda de faces não aparece. Os cones de 3 lados dão levemente mais "pontas" aos abetos do Vale, o que é bom.
- Risco: se a Proposta 1 trouxer 3 a 4× mais árvores, o D19 passa a ser **obrigatório**, e o corte em `18·reach` talvez precise cair para ~14 para pagar o orçamento. Combinar as duas.

## 2. Propostas (ordem: impacto / custo)

**P1. Árvores menores e mais numerosas, com copa de 1 a 1,3× a casa (M).**
- Tela: a mata vira massa fechada com borda recortada, e a casa deixa de ser comida pela árvore.
- Como:
  - em `tileBuilder.ts:1186` baixar `TREE_SCALE` para ~0,85 e `randRange` para (0,85–1,25);
  - em `:1232` multiplicar `n` por ~2,5, em vez de 0,7;
  - em `:1235` baixar `free(…,0.125)` para ~0,07 e `clear` para ~0,03;
  - acrescentar uma passada com amostragem de disco de Poisson por setor (`samplePoint`, `:598`), para não sortear no escuro.
- Custo: sem D19 sobe de ~1,5 a 2× os triângulos de mata. Mitigar com uma copa de poucas faces (`ico(r,0)` octaedro ou 12 faces) no lugar de `ico(r,1)` (80 faces): abeto de 2 cones com 5 lados e `oak` de 1 esfera de `detail 0`. Resultado: ≤ +10% no total, com D19 em vigor. CPU de montagem: ~2,5× mais chamadas `D()` nas peças de mata.
- Riscos: aparência continua dependendo só de `(edges, seed, theme, opts)`. Mudar o número de sorteios altera o `rng` da peça inteira, e as vilas e plantações seguintes do mesmo `rng` saem diferentes. Sortear árvores num `mulberry32` derivado (`seed ^ 0xF0E5`), para não mexer no resto. Sem impacto em saves, pois a geração é só visual.
- Pronto quando: `vale-floresta` e `holanda-aberto` mostram mata sem chão visível entre copas, com altura de árvore ≤ 1,3× a da casa vizinha. Triângulos e draw calls em `RUNS=300:high stress.mjs` ≤ +10%. `npm run check` e o smoke passam.

**P2. Três silhuetas por tema: redonda, esguia e pontuda (M).**
- Tela: o topo da mata ganha ritmo (copas gordas entre ciprestes finos e abetos de ponta), e cada forma se lê de longe sem "pele de oliva".
- Como:
  - em `lib.ts:352`, cada tema (mesmo as de `themes.ts`) escolhe uma razão altura/largura por forma, e os `kind.geo` do Vale viram `round` (copa gorda), `cypress` (esguia, já existe `:384`) e `conifer` com 2 cones estreitos;
  - em `themes.ts:39`, pesos 0,5/0,25/0,25;
  - `softCanopy` passa a ter um parâmetro `soft` (0,75 hoje, 0,45 nas formas esguias), para a copa ter quina.
- Custo: neutro em triângulos (troca de geometria, não soma). Sem draw call novo se os pools já existem (`cypress` e `round` já existem).
- Riscos: tema é só dado (kits já existem), sem `if (theme.id)`. Nenhum.
- Pronto quando: captura `vale-floresta` com 3 silhuetas distinguíveis em preto e branco (`?silhueta`), com `?gallery&theme=vale` mostrando as formas lado a lado.

**P3. Paleta com valor e acento: base escura e saturada, 5 a 8% de cor viva (P).**
- Tela: a mata é o elemento mais escuro e frio, o prado fica claro ao lado, e pontinhos de vermelho/laranja/lavanda quebram a massa.
- Como:
  - em `themes.ts:40-43` e `:112-114` (e os temas de `eras.ts` que usam o mesmo padrão): trocar para base teal-verde escuro (`#245a4a`~`#2f7a52`) em 70% dos pesos, e um tipo de `round` com os acentos `#d95a3d`, `#e0873a`, `#8a86b8` e peso 0,06;
  - em `materials.ts:317-322`, `seasonFoliage` tinge só 0,25 (hoje 0,4) e sem ferrugem em toda copa: o `hash(instanceIndex)` deve selecionar ~15% das árvores, para o resto manter o verde;
  - ampliar a pincelada `dab` de ±14% para ±22% (`:369`).
- Custo: zero em geometria e draw calls.
- Riscos: `npm test` roda `tests/legibility.ts` para casas e chão, não para árvores. Conferir à mão que o teal não confunde com a água dos temas (`theme.water`).
- Pronto quando: `holanda-aberto` e `vale-floresta` têm mata mais escura que o prado vizinho (ΔL ≥ 15 em CIELAB, medido na captura), com acentos visíveis em ~1 de cada 15 árvores.

**P4. Sombra de mata: chão escuro contínuo e borda mais clara (M).**
- Tela: a mata assenta no chão como um único corpo, com o interior mais escuro e a fileira da frente mais clara, ao estilo de "luz que entra pela borda".
- Como:
  - em `tileBuilder.ts:1289`, trocar os discos individuais (raio `0,055·s`) por um disco por árvore bem maior (`0,11·s`) com a cor `floor` variando pelo número de vizinhas (`trees` já guarda x, z, s: densidade local por contagem de vizinhas num raio de 0,2);
  - árvores com poucas vizinhas (borda) têm `vary` +8% de brilho; as de dentro, -10% (cor da instância, não material novo);
  - o mapa do chão (`groundMap.ts`) pode receber o mesmo escurecimento para a luz rebatida.
- Custo: discos maiores somam poucos triângulos (7 lados × até ~100 árvores/peça ≈ 0,7 mil), ~+1% no total. Montagem: contagem de vizinhas O(n²) com n ≤ ~100, aceitável.
- Riscos: o bloco estático só cresce e o chão é montado na peça, sem mudar depois. Mas a vizinha ainda não colocada não conta: a borda entre duas peças de mata pode ficar clara no meio. Aceitar, ou escurecer a borda que encosta em vizinha de mata (`opts` já traz as vizinhas).
- Pronto quando: captura com duas peças de mata lado a lado, sem faixa clara visível na emenda, e o interior ≥ 10% mais escuro que a borda.

**P5. Borda da mata: árvores menores e mais ralas na beira que encosta em prado (P).**
- Tela: a mata deixa de acabar num corte reto e ganha franja com árvores baixas, arbustos e moitas.
- Como: em `tileBuilder.ts:1232`, o escalar `s` fica ×0,75 e a chance de nascer ×0,6 quando `samplePoint` está perto da borda de um setor vizinho de prado (`edges[(i±1)%6] !== T.Forest`). Também usar o `bush` (já existe, `lib.ts:2124`) como borda.
- Custo: neutro (troca de tamanho e densidade, não soma).
- Riscos: nenhum além do sorteio (usar o `rng` derivado da P1).
- Pronto quando: captura com peça de mata encostando em prado mostra uma transição em duas a três linhas.

**P6. D19 acompanhar a P1 (P).**
- Depois da P1, medir o custo. Se passar de +10%, baixar `treeEdge` de `18·reach` para ~14 em `world.ts` e conferir que a troca não pisca (a histerese de ±0,4 já está lá).
- Pronto quando: `window.__pools()` mostra o total de triângulos de árvores ≤ o da main +10% no zoom aberto.

## 3. Não fazer

- **Contorno de tinta por árvore, geometria à parte para cada árvore (casca invertida).** O pós já tem `ink` (`post.ts:81`) com alcance por distância. Um casco extra dobraria os triângulos das árvores, e a proposta P1 já os multiplica.
- **Copiar as três formas exatas do original.** O ritmo vem da proporção (gorda, esguia, pontuda), não do desenho. Basta a P2.
- **Aumentar `TREE_SCALE` ou reduzir a densidade para "ler de longe".** Foi a decisão que criou o problema (comentário em `tileBuilder.ts:157-158`). A massa de árvores pequenas lê melhor de longe que a árvore solta grande, pois a mancha de cor é maior que a de uma árvore, e a casa não some.
- **Tirar `softCanopy`.** O gradiente de luz é a nossa vantagem sobre o original. Só afrouxar o suavizado nas formas esguias (P2).
- **Um tipo novo de árvore por tema agora.** O dado de forma dos 14 temas já tem variedade; o gargalo é escala, densidade, paleta e agrupamento, que valem para todos.
