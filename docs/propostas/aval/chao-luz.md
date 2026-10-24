# Avaliação: chão, paleta, luz, névoa e composição (e a água)

Material visto: images/4 (original), images/5 (Roger, Holanda, Ultra), capt/d08, d09, d13, d14. As capturas de `aval/main/` estavam vazias e o mosaico estava preto; usei os "antes-*" (main). Não fiz capturas novas.

## 1. Diagnóstico

1. **O fundo cinza lavado do print 5 é do tema Holanda, não de um bug.** `themes.ts:91` define `bg '#dfe5ea'`, `voidFill '#e7ecf0'`, `voidLine '#f3f6f8'`: três cinzas frios quase iguais. Sobre eles, o vazio (`materials.ts:755-806`) ainda soma um véu branco de 20% e a vinheta de 0,22 (`post.ts:55`). O vale usa `#f3d3c8` e fica rosado e limpo, como o original. No original, o fundo rosado é bem mais escuro que as peças vazias, e o tabuleiro se destaca por contraste de valor. No print 5, o verde das peças e o chão cinza ficam com luminâncias próximas, e a grade branca tem tão pouco contraste que mal se lê. O resultado é "tabuleiro de papel sobre papel". A névoa de alcance (`atmosphere.ts`, near = 1,5×eye e far = 4,2×eye em `world.ts:1690`) puxa tudo para o `bg`, então o cinza avança sobre o próprio tabuleiro em zoom aberto.
2. **O tabuleiro parece um adesivo flutuando.** O plano do vazio fica em `-TILE_T-0.03` (`world.ts:597`), colado no fundo da peça, e é claro e iluminado. Embaixo da lateral marrom aparece uma faixa branca (print 5, sob todas as bordas) sem sombra de contato, enquanto o original tem uma base fina e o rosa escuro ao redor. A espessura (`TILE_T = 0.28`, `tileBuilder.ts:15`) é boa para dar volume, mas a lateral só tem 3 faixas (lábio verde, terra, terra escura, `tileBuilder.ts:752-763`) e acaba num corte seco contra o branco.
3. **O prado grande é vazio por falta de variação em escala média.** A cor do prado é uma só por tema (`ground[T.Grass]`, `tileBuilder.ts:655`), e a mistura entre setores só mistura cores iguais (`:697-720`). A variação vem só do shader: `blot` a cada 2,6 unidades e ±10% (`materials.ts:442-451`), então cada peça lê como verde chapado. O que povoa o prado são tufos, arbustos, pedras e flores, todos minúsculos e com a mesma escala (`tileBuilder.ts:1226-1280`, `lib.ts:2104-2106`). Não há nada entre o "tufo" e a "peça inteira". O original faz o contrário: cada hexágono tem um valor/matiz próprio (oliva escuro, verde-limão, amarelado), as emendas ficam visíveis como degraus tonais, e o prado ganha ritmo com manchas, caminhos, pedras maiores e árvores soltas.
4. **Contraste e saturação gerais.** O nosso é limpo e colorido de perto (vale, d09/d13), mas a gradação tem pouco peso nas sombras: `shade`/`light` entram só abaixo de l=0,3 e acima de 0,35 (`post.ts:112-119`). O original usa verdes mais escuros e quentes nas áreas de mata e prado, e as peças de campo (laranja, ocre) são o ponto de maior saturação. No zoom aberto, o nosso perde isso por causa da névoa de alcance e do desfoque de topo e pé do D9.
5. **O tabuleiro grande no zoom aberto perde leitura.** Em d09/antes-vale-aberto, a ilha ocupa cerca de 40% da tela e o resto é vazio rosado desfocado. A inclinação sobe até 0,87 rad com o zoom (`cameraRig.ts:42-45`), então de longe a vista fica mais de mapa que de maquete. Faltam sinais de massa: sombra de nuvem, luz rasante e uma silhueta de borda legível. O original, já bem aberto, mantém os agrupamentos de floresta e vila legíveis pela diferença de valor entre os terrenos.
6. **A água do nosso é superior, e vale proteger o porquê.** O que a faz boa, em ordem de importância:
   - **Profundidade física:** leito escavado visível, absorção por canal (`ABS_BASE`/`ABS_HUE`, `materials.ts:487`) e atributos `wbed`/`wflow`. A margem é rasa e clara e o centro é fundo, com gradiente natural. No print 5, o lago passa de areia-verde a azul profundo sem linha dura.
   - **Margem sem recorte:** a malha da água repete o leito abaixo da linha d'água, então a borda fica onde a profundidade zera.
   - **Fresnel exato e reflexo do céu** (`:490`) mais cáusticas (`:494`) e esteiras dos barcos.
   - **Correnteza herdada e largura coerente entre peças.**
   - O original é turquesa chapado com recortes a nanquim: bonito pela forma (meandros e ilhotas), não pela luz. A nossa forma é mais simples (rio quase reto e lago oval).
   Prova de que o ganho é do material e não do pós: o par d08 (Ultra com e sem SSGI e SSR) tem a água praticamente igual.

## 2. Avaliação dos PRs

- **D13 (mar em volta):** é o maior ganho nesta área. Resolve o cinza e o "adesivo" do ponto 2 e o ponto 1 para Holanda, vale, inverno, sakura, viking, edo e colonial (`surround: 'mar'`), e dá areia nos desérticos (d13/depois-egito14, bonito). Cuidado: o mar claro e turquesa fica mais brilhante que a água de rio azul-escura; confira a emenda onde um rio chega à borda do mapa, para o corte da água na lateral e o mar não brigarem. Mantenha os temas sem `surround` (pergaminho) corretos.
- **D14 (luz de vitrine):** só afeta o vale (`light: 'vitrine'`). Reduz o contraste em 17% (`P.contrast`) e levanta o preto em âmbar. Em d14/antes-dia e depois-dia, a diferença é pequena e mais quente. Isso **piora o ponto 4** se virar padrão: lava a água e as sombras, e é contrário ao que falta. Não estenda a Holanda sem rever.
- **D9 (tilt-shift):** troca o `dof` por faixa nítida de 22% da altura (`post.ts`). Dá ar de maquete, mas no zoom aberto cerca de 70% da tela fica borrada, inclusive o tabuleiro grande em d09/depois-vale-aberto; piora o ponto 5. Sugiro `P.tilt` cair a zero conforme o zoom abre e atenuar a máscara no topo, ou limitar a 0,5.
- **D8 (Ultra barato):** sem SSR e SSGI, a água continua boa (ver acima). Risco real: a luz rebatida e o AO deixam de dar o volume do tabuleiro; confirme a compensação de `BOUNCE` (`world.ts:73`) olhando o prado e a lateral.

## 3. Propostas (ordem de impacto/custo)

**P1. Fundo e vazio com valor próprio (P).**
- *Tela:* o fundo deixa de ser cinza claro e vira um tom mais escuro e quente que o tabuleiro; a grade sobe de contraste. O print 5 passa a parecer o original.
- *Como:* em `themes.ts`, Holanda e os temas frios (`bg`, `voidFill`, `voidLine`) com 8 a 12% menos luminância e um pouco de croma; no vazio, trocar o véu branco de 20% pela cor `bg` mais clara (`materials.ts:~799`); `vignette` para 0,28 só no vazio. Com o D13, vale também para o tema cujo `surround` for pergaminho.
- *Custo:* zero triângulos e zero draw calls.
- *Riscos:* `tests/legibility.ts` mede casa contra chão, não contra o fundo; nenhuma invariante.
- *Pronto quando:* capturas de holanda-aberto e vale-aberto com ΔL entre prado e fundo ≥ 20 (CIELAB), lado a lado com images/4.

**P2. Variação tonal por peça e por região no prado (P/M).**
- *Tela:* cada hexágono de prado tem um valor e um matiz próprios, com degraus suaves, e manchas grandes (oliva, limão) cruzando peças.
- *Como:* em `tileBuilder.ts:655` (`groundCols`), deslocar o valor e o matiz de cada cor por `mulberry32(seed)` (±6% L, ±8° H) e tornar o amplitude do `blot` em escala de ~12 unidades (`materials.ts:442`, nova leitura de `noiseTex` com amplitude 0,25). A cor sai da semente da peça, então a invariante 3 é mantida.
- *Custo:* zero triângulos; 1 amostra de textura a mais no shader do chão.
- *Riscos:* o mapa do chão (`groundMap.ts`) usa essa cor; a emenda entre peças vizinhas fica como degrau, de propósito, mas deve ser suave nos setores internos.
- *Pronto quando:* a captura de prado grande mostra pelo menos 3 tons distintos; `npm test` (legibilidade) passa.

**P3. Elementos de escala média no prado (M).**
- *Tela:* o prado ganha ritmo com sebes curtas, árvore solitária, fardo de feno, trecho de muro de pedra, moita de flores maior (já existente, ampliada) e pasto aparado em mancha.
- *Como:* em `tileBuilder.ts:~1226-1280`, no ramo `T.Grass`, 1 elemento "âncora" por peça com probabilidade ~0,35 (ao lado da peça de floresta ou vila, para formar bordas), reutilizando kits de `lib.ts` (árvore, `bush` escalado a 2,2×, rocha a 2×). Nada de kit novo se possível; flor em manchas de 10 a 14 (hoje 3 a 6).
- *Custo:* +2% de triângulos; zero draw calls (pools existentes).
- *Riscos:* mantém o `free()` e `clear()` para não cobrir rio e estrada; muda a aparência e não o replay, então sem mudança de `SAVE_VERSION`.
- *Pronto quando:* 300 peças em `stress.mjs` com aumento de triângulos < 10%; captura do prado grande sem área de 1/4 de peça vazia.

**P4. Base do tabuleiro com sombra de contato e lateral mais rica (M).**
- *Tela:* some a faixa branca sob as peças; a lateral ganha mais camadas e uma pontinha de raiz e pedra, e uma sombra suave no chão ao redor.
- *Como:* afundar o plano do vazio (ou do mar do D13) ~0,12 abaixo de `-TILE_T` (`world.ts:597`) com um halo escuro suave no `groundMap`; no `tileBuilder.ts:752-763`, 2 camadas a mais (solo, rocha) com cor sorteada pela semente e faixa de pedras já no shader (`materials.ts:463`).
- *Custo:* +4 a 6 quads por borda, ~+3% de triângulos.
- *Riscos:* o `groundMap` é append-only (invariante 10); a sombra de contato deve pintar na hora da peça.
- *Pronto quando:* captura de borda mostra sombra de contato sem faixa branca; triângulos < +5%.

**P5. Zoom aberto legível (M).**
- *Tela:* de longe, o tabuleiro mantém contraste entre floresta, vila, campo e água, sem névoa nem desfoque comendo as peças.
- *Como:* `world.ts:1690`: `A.near`/`A.far` relativos ao tamanho da região explorada (`voidU.radius`) em vez de só `eye`; D9: `P.tilt` ≤ 0,5 e menos desfoque nos 20% de topo; leve saturação extra (`P.saturation` 1,06 para 1,12) conforme o zoom.
- *Custo:* zero.
- *Riscos:* o uniforme de `fog` é compartilhado com a cena de nuvens; teste em dia, entardecer e noite.
- *Pronto quando:* capturas de zoom 4 e zoom 30 com a mesma região legível, sem borrar mais de 30% da área do tabuleiro.

**P6. Água: mais forma, sem mexer na luz (M).**
- *Tela:* rios com meandros, ilhotas e braços, lagos com enseadas; o mesmo visual de água de hoje.
- *Como:* só `waterShape`/`waterPaths` (`tileBuilder.ts:363`), com ruído de baixa frequência nas curvas e uma ilhota ocasional no lago; sem tocar em `makeWaterMaterial`.
- *Custo:* ~+3% de triângulos nas peças com rio.
- *Riscos:* a emenda entre peças depende de `widths`/`flow`; o teste de cenário com rio contínuo deve ser rodado.
- *Pronto quando:* captura de rio longo com pelo menos 2 curvas fechadas e a emenda sem degrau.

## 4. Não fazer

- **Não copiar o rosa do original em todos os temas:** o bg é dado do tema (invariante 8); o que importa é o contraste de valor, não a cor.
- **Não achatar a água para turquesa chapado** nem trocar o leito escavado por plano: é o que a torna superior. Ao mexer em D8, D13 e D14, preservar `wbed`/`wflow`, a absorção e o Fresnel, e não aplicar o `contrast` e o `lift` do D14 na água.
- **Não aumentar a névoa para "dar profundidade":** já é o que lava o print 5.
- **Não fazer um prado com mais tufos pequenos:** só sobe os triângulos, e o vazio vem da escala, não da quantidade.
- **Não engrossar `TILE_T`:** a espessura atual já é boa; falta acabamento (P4), não volume.
- **Não estender o D14 (vitrine) a todos os temas** sem fixar o contraste: ele reduz o que falta.
