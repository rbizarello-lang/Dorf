# Avaliação: campos, plantações e transição entre terrenos

Material visto: `images/4.webp` (original), `images/5.webp` (Roger, Holanda Ultra), `capt/d15/antes-vale-medio.jpg` e `antes-vale-perto.jpg` (renders da main). `aval/main/` estava vazia. Não gerei capturas novas.

## 1. Diagnóstico

1. **O chão do original é uma pintura contínua; o nosso muda de terreno em degrau.** Em `4.webp` o verde passa ao marrom-oliva e ao amarelo-claro em manchas largas e irregulares, e não se vê a divisa entre peças. No nosso (`5.webp`) a vila é um marrom chapado que acaba numa linha reta contra o prado. Em `antes-vale-medio` o marrom da vila tem uma borda quase reta e as fendas entre peças aparecem. A causa está em `tileBuilder.ts:696-720` (`topColor`):
   - a mistura com o setor vizinho vale só nos primeiros 30% do arco do setor (`smooth(0, 0.3, sAng)`, linhas 703-704) e no máximo 0,5, então 70% do setor tem a cor pura;
   - a malha do chão tem N=4 (`:686`), com triângulos de 0,25 e `flatShading`: o gradiente sai em facetas, sem borda orgânica;
   - **na emenda entre peças não há mistura nenhuma.** O vértice de borda de uma peça tem a cor `own` do terreno daquela borda, e a vizinha tem a dela, então o degrau entre terrenos diferentes é inteiro. A peça é montada antes de saber os vizinhos, e hoje nada corrige isso depois.
2. **O detalhe do shader repete a mesma dureza.** `makeGroundMaterial` (`materials.ts:432-466`) mistura prado, floresta, plantação e vila por `splat` linear por vértice (`:456`). O "pincel" da plantação (`:445-452`) e a terra batida da vila só valem onde o peso do vértice cobre, e o peso tem o mesmo recorte de 30%. Não há nenhum ruído torcendo a fronteira.
3. **As parcelas são recortes de papel.** Em `tileBuilder.ts:1106-1175`:
   - cada parcela é um polígono de 4 a 6 lados, com raio entre 0,15 e 0,22 e 3 a 5 por setor;
   - o topo é um leque chapado sobre o chão, a 0,006 + k·0,002 de altura (`:1143`);
   - tem parede lateral escura (`:1151`, `dark = shade(sc, 0.72)`), que desenha um contorno duro ao redor;
   - as plantas só nascem dentro do polígono encolhido a 86% (`:1157`, `insidePoly`) e têm escala uniforme até a borda (`:1167-1168`). A transição é "tem planta / não tem planta".

   Em `5.webp` e `antes-vale-medio` as fileiras de tulipas e trigo terminam em retângulos de borda viva. Isso é o que o Roger chamou de demarcação rígida.
4. **Os campos nunca atravessam a emenda entre peças.** O polígono é preso a `INR - 0.02` (`:1131-1137`) e `samplePoint` usa margem de 0,03 (`:1116`). Árvores, grama e casas também respeitam margens (`:1234-1253`). Toda peça de plantação termina um dedo antes da vizinha, mesmo quando a vizinha também é plantação. O original funde campos de peças vizinhas em um polígono maior, que é o que os faz parecer campos de verdade.
5. **O nosso faz melhor a textura da plantação.** Fileiras reais de plantas instanciadas, com vento e cor por parcela (`:1160-1173`), contra os campos do original, que são polígonos pintados e lisos. Isso deve ser mantido. A tarefa é suavizar a borda e fundir peças, não achatar o campo.
6. **O mapa do chão (`groundMap.ts`) já guarda o que precisamos.** Ele tem a cor do terreno de todas as peças já postas, em 1024², com texel de 0,1 e mipmaps (`groundMap.ts:14-15`, `:28-41`). Hoje só alimenta a luz rebatida (`materials.ts:222`). Como o shader o lê ao vivo, ele resolve "montei antes de saber o vizinho": a peça vizinha, quando assenta, atualiza a textura e a peça antiga muda de aparência sozinha, sem reconstruir geometria. É o análogo do que `widthsAt`/`flowAt` fazem para o rio, só que no shader. Atenção: a textura vale como cor do chão (`b.col`), que inclui o leque das parcelas, mas não o detalhe do shader.

## 2. Propostas (por impacto sobre custo)

### P1. Costura de cor entre peças pelo mapa do chão (tamanho M)
- **Na tela:** o marrom da vila escorre para o prado e a floresta escurece o prado vizinho numa faixa de uns 0,3 a 0,4 de largura dos dois lados da emenda. As duas peças calculam a mesma cor no mesmo ponto, então a divisa some sem mexer em nenhuma delas.
- **Como:**
  - em `makeGroundMaterial` (`materials.ts:465`), antes do detalhe, `vc = mix(vertexColor, texture(groundMap.texture, uv).level(~2).rgb / cobertura, k)`;
  - `k = 1 - smoothstep(0, 0.35, distToHexEdge)`. A distância à borda do hexágono sai de `positionWorld.xz` com a conta hexagonal inversa de `hexToWorld` (HEX_R em `hex.ts`), sem atributo novo;
  - o mip do nível 2 cobre ~0,4 e é simétrico na emenda, o que garante a continuidade;
  - **cobertura:** o canal A já é dos lampiões. Onde o vizinho não existe o RGB é 0 e o mip escureceria a borda do mapa. Soluções: textura R8 de cobertura à parte (a mais limpa), ou normalizar por `max(lum, ε)` e pular a mistura quando a luminância cai.
- **Custo:** +1 textura lida por fragmento do chão. Zero triângulo, zero draw call, zero CPU de montagem. A textura já sobe uma vez por quadro (`flush`).
- **Invariantes:**
  - a invariante 3 vale para a geometria (`buildTile` não muda); a aparência na tela passa a depender do mapa do mundo. O fantasma e a pilha (`preview.ts`) não têm mapa e ficam como hoje, o que está certo, mas confirme que `U.bounce`/`k` zerados na pilha deixam a peça igual;
  - blocos estáticos continuam append-only;
  - a foto e o vídeo leem o mesmo material.
- **Pronto quando:** captura do `?auto=40&seed=7` mostra a divisa vila×prado e floresta×prado sem degrau; uma peça isolada (sem vizinhos) sai igual à de hoje; `RUNS=300:high node scripts/stress.mjs` com triângulos e draw calls iguais; `npm run smoke` sem erro nos dois backends.

### P2. Fronteira de terreno orgânica dentro da peça (tamanho P a M)
- **Na tela:** o recorte reto do setor vira uma mancha com contorno de ruído, e o gradiente deixa de ser facetado.
- **Como:**
  - `tileBuilder.ts:703-704`: alargar a faixa de mistura de 0,3 para ~0,6 do arco e somar a `sAng` um ruído determinístico da posição (valor-noise por `seed`, já há geradores à parte), de ±0,15;
  - no shader (`materials.ts:456`), antes de somar os kits, "endurecer" os pesos com ruído: `w = smoothstep(.3, .7, sp + (ruido - .5) * .4)` e renormalizar. O detalhe de pincel e de terra batida passa a invadir o vizinho em lóbulos;
  - se a faceta ainda aparecer, subir o N de 4 para 6 só nas peças sem água. Isso custa cerca de +125% de triângulos de chão (96 para 216 por peça, uns +36k em 300 peças, ~2,5% do total).
- **Custo:** a mudança de cor é de graça; o N=6 custa ~2,5% de triângulos, abaixo do limite de 10%. Sem draw call novo.
- **Invariantes:** o ruído usa só `seed` e posição local, sem `Math.random`, então a invariante 3 vale. Mudança só visual, sem `SAVE_VERSION`.
- **Pronto quando:** captura `vale-vila` com a borda da vila irregular, sem trecho reto maior que ~1 casa; teste de `buildTile` repetido com a mesma entrada continua produzindo os mesmos bytes.

### P3. Parcela de borda macia: sem parede, com aba que afunda no chão (tamanho P)
- **Na tela:** a parcela deixa de ser um recorte com contorno escuro e vira uma mancha de terra pintada que se funde ao prado.
- **Como:** em `tileBuilder.ts:1141-1153`:
  - tirar o `g.quad` das paredes escuras (ou reduzi-lo a ~0,002 de altura, sem `dark`);
  - fazer o leque em dois anéis: o anel interno com a cor `sc` e o externo com `sc` misturado ~60% com `groundCols[i]` e altura 0. Isso dá um bisel macio de ~0,04. Custo: +`sides` triângulos por parcela;
  - no shader o pincel `field` já está ligado ao `splat.z`; subir o peso de `splat` para plantação nos vértices do leque aproveita isso sem material novo.
- **Custo:** ~+4 a 6 triângulos por parcela, contra −`sides` das paredes retiradas; saldo próximo de zero. Zero draw call. CPU de montagem igual.
- **Invariantes:** nenhuma, é só mais geometria no `buildTile`, sem rng novo. Se for preciso sortear algo, usar uma subsemente (`seed ^ constante`) para não mexer na sequência do resto da peça.
- **Pronto quando:** `?focus=` num campo de trigo e tulipa não mostra contorno escuro; contagem de triângulos do `RUNS=300:high` dentro de ±2%.

### P4. Plantas que diminuem perto da borda do campo (tamanho P)
- **Na tela:** as fileiras terminam em plantas menores e mais esparsas, como uma plantação que vai falhando até o prado, em vez de um corte de tesoura.
- **Como:** em `tileBuilder.ts:1166-1173`, calcular a distância `d` do ponto a `inner` (dá para medir como a menor distância às arestas, já que `insidePoly` percorre as arestas). Então `edgeT = smooth(0, 0.07, d)`, `s *= 0.45 + 0.55 * edgeT`, e descartar com probabilidade `(1 - edgeT) * 0.55` usando um `rng()` que já se consome hoje (mantendo a ordem de sorteios para não alterar o resto). Estender `inner` para 100% do polígono e deixar a escala fazer o recuo. Espalhar 1 ou 2 "plantas soltas" pelo prado vizinho (reuso de `D('crop:...')` com escala pequena) quebra o contorno.
- **Custo:** instâncias iguais ou menos (~−5% nas plantações); zero draw call.
- **Invariantes:** a ordem de consumo do rng da peça muda se se trocar o número de chamadas. Faça o sorteio da falha com o mesmo `rng()` já chamado em `randRange` ou use um gerador derivado da posição, para a aparência continuar função de `(edges, seed, theme, opts)`.
- **Pronto quando:** captura `vale-campo` com bordas de fileira em degradê; a soma de instâncias do `window.__pools()` não sobe.

### P5. Campos que atravessam a emenda: "aba" de campo no meio de cada borda de plantação (tamanho M)
- **Na tela:** quando duas peças de plantação se encostam, as parcelas se juntam num polígono só sobre a emenda; sozinha, a peça mostra meia aba que acaba na borda.
- **Como:** para cada borda `T.Field`, adicionar uma parcela simétrica centrada no `edgeMid(i)`: elipse de largura fixa (~0,5 ao longo da borda) e profundidade (~0,18 para dentro), com altura e cor fixas do tema (`theme.crops[0].soil`) e sem sorteio, para as duas peças gerarem metades idênticas. Prender o polígono ao plano da borda em `INR` em vez de `INR - 0.02` (`:1131-1137`). As plantas da aba usam o `crop` da própria peça (as duas culturas se misturam na emenda, e isso lembra o patchwork do original). Onde a vizinha não for plantação, a meia aba termina na borda, sendo disfarçada por P1 e P3.
- **Custo:** ~+8 a 12 triângulos de terra por borda de plantação; ~+10 a 15 plantas por borda. Pequeno.
- **Invariantes:** a aba tem de ser função só de `(i, theme)`, e não de `seed`, para a emenda casar. Rotação: usa `edgeMid`, então vale a invariante 4. Verifique que a peça girada (`rotateEdges`) gera a aba no mesmo lugar.
- **Pronto quando:** captura com 2 peças de plantação vizinhas mostra uma parcela contínua sobre a emenda; sem sobreposição de plantas com árvores (`free` já protege).

### P6 (opcional). Prado que invade o campo: manchas de capim e flores nas bordas (tamanho P)
Hoje o capim sai só nas peças de prado e floresta (`:1241`, `:1253`, `:1259`). Acrescentar capim ralo (`D('grass')`, com escala pequena) numa faixa de ~0,06 em volta de cada parcela e nas bordas de vila e de plantação do chão. Custo: ~+3% de instâncias. "Pronto quando": a faixa entre plantação e prado tem capim em degradê.

## 3. Não fazer

- **Não achatar o campo numa textura pintada como a do original.** As fileiras instanciadas e o vento são o que o Roger acha melhor. O ganho está na borda, não no miolo.
- **Não subir o N da malha do chão em todas as peças** (por exemplo, N=12 em todas). O ganho é pequeno diante do custo: com ~+400k triângulos a mais, estouraria o orçamento de 10% sem melhorar o que P1 e P2 resolvem em cor.
- **Não deslocar a geometria da emenda por ruído** (relevo na divisa). A emenda precisa coincidir exatamente com a vizinha, e as paredes laterais (`:737-760`) e a água dependem disso. Resolva a transição em cor, não em altura.
- **Não ler o mapa do chão para mudar geometria ou plantas.** Seria função do estado do mundo e quebraria a invariante 3 e o "append-only" dos blocos. Só o shader pode olhar o mapa.
- **Não usar `Math.random` no ruído da borda**, nem `performance.now()`. Valor-noise por posição e semente, no estilo de `waterField`.

## PRs abertos

Nenhum dos PRs listados (`d09`, `d13`, `d14`, `d15`, `d19`, `d08`) mexe na cor do chão, nas parcelas ou na emenda. O `d13` (mar em volta) e o `d14` (luz de vitrine) não pioram esta área, mas o `d14` realça o contraste do chão: o degrau de P1 fica mais visível sob luz forte, o que é mais um motivo para resolvê-lo. O `d15` (vilas em quarteirões) mexe na distribuição de casas dentro do setor de vila e é compatível com P1 e P2.
