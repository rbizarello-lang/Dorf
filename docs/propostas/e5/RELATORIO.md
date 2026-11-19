# E5: Encostas no jogo todo

Branch `dorf/e5-encostas` (base `origin/dorf/f3-terra-fantasma`). Modelo: GPT Astra (jogo-entrepostos 75f92e0). O BRIEF.md citado no pedido não existia no scratchpad; segui o texto do pedido e o AGENTS.md.

## O que entrou
- `src/core/hills.ts` (puro): `boardHill`, `handHill`, `hillHeight`, `hillSignature`, sem a trava `riverTrade && crista`. Vale em todos os modos e temas; só aparência (sem `SAVE_VERSION`, pontos e replay intactos).
- `src/render/hillSurface.ts`: cota nos nós da malha. `buildTile` (`opts.hill`, `opts.hand`): chão, decalques assentados na malha (adaptativo), casas no trecho mais plano com fundação, teto de altura junto à água e à estrada, decoração móvel com `Life.groundRise`.
- Relevo e Terra: a altura por peça segue como REGRA (núcleo e água pontuada intactos); o desenho fica no nível 0 com as Encostas (`World.flatDraw`), sem platô por peça, sem saia. A altura lógica soma `LOGIC_RISE` no ombro e na divisa (simétrico), para o encaixe continuar legível. `terrain.ts` e `magra.ts` só vivem atrás de `?encostas=0`.
- Vizinha que muda: `World.baked` + `refreshHills` (refaz a peça e as 6 vizinhas cujo perfil mudou, no lugar). `Chunk.replaceGround`, `Pool.set/remove` e `addUpdateRange` (só a faixa alterada vai à GPU). Documentado no AGENTS.md (exceção à invariante 10).
- Fantasma e queda: a assinatura do perfil entra na chave, então o pouso reaproveita a peça sem pulo.
- `?encostas=0` / `#encostas=0` volta ao desenho de antes (A/B no mesmo build). `window.__hills()`.
- Prévia abre no Clássico; `#mode=relevo`, `#mode=terra`, `#bench` valem.

## Decisões (sem perguntar)
1. Relevo/Terra: o desenho perde a cachoeira (não há platô por peça); a queda pontuada aparece como correnteza. O pedido mandava manter as cachoeiras; mantê-las exigiria platô por peça, que é a origem do "gordo". Em Clássico com platôs (`levelAt`, 4 temas) a cachoeira segue.
2. Água que desce: núcleo intocado (usa `tileProfile`); só o desenho mudou.
3. Rim zerado entre casas de níveis `levelAt` diferentes (há penhasco ali).
4. Malha 6 divisões onde há divisa, patamar ou ombro alto; 4 nas peças baixas e soltas; 12 com água ou trilho (as emendas casam porque divisa não casada vale 0 dos dois lados).
5. Fantasma indicando vizinhas que sobem: NÃO feito (só o perfil da própria peça no fantasma).
6. Capturas em `quality=medium` (não high): no SwiftShader a Alta não terminou um quadro em 25 min. WebGL2 apenas.

## Testes
- `tests/hills.ts` (`npm run hills`, no `npm test`): 36 partidas (12 sementes × Clássico, Relevo, Terra, todos os temas), 2.806 peças: 127.400 amostras de emenda dos dois lados no espaço do mundo contra uma fórmula fechada escrita no teste (cada lado leva o ponto ao local por conta própria), 68.146 amostras de vale (divisa sem par = 0), 68.600 nós da malha, determinismo, 144 ordens de jogada (protocolo "refaz só a peça nova e as 6 vizinhas" = cálculo do zero), 36 replays e desfazer. Patamar máx 3, rim máx 0,515.
- `npm run check` verde. Smoke: casos WebGL verdes (webgl, relevo-webgl, terra-hash-webgl e demais); os casos WebGPU falham aqui com "Instance dropped in popErrorScope", falha de ambiente (também na `main`): o WebGPU NÃO pôde ser conferido nesta máquina; a CI roda os dois.
- Ao vivo (WebGL2, 6 jogadas animadas em Clássico, Relevo e Terra/Egito): 0 erros; vizinhas refeitas por jogada 0 a 2, pior custo 34 ms.
- `npm run compare` não rodado (visual muda de propósito).

## Custo (stress 300:high, SwiftShader, WebGL2, Holanda, seed 42; base = f3-terra-fantasma)
| Modo | Triângulos base → E5 | Montagem base → E5 |
|---|---|---|
| Clássico | 1.476 mil → 1.639 mil (+11%) | 1.234 → 1.783 ms (+44%) |
| Relevo | 1.466 mil → 1.649 mil (+12,5%) | 2.810 → 2.144 ms (−24%) |
| Terra | 1.520 mil → 1.671 mil (+9,9%) | 3.000 → 2.219 ms (−26%) |

Metas: triângulos ≤ +10%: Terra ok, Clássico e Relevo ficam 1 a 2 pontos acima. Montagem ≤ +25%: ok no Relevo e na Terra (mais rápidos que a base), NÃO no Clássico (+44%). Antes das otimizações (decalques por corte em grade, malha 6 sempre) eram +37% de triângulos e +97% de montagem. O custo vem de mais vértices no chão (malha 6) e dos decalques que seguem a encosta. Pendente: medir o pior quadro da jogada em GPU de verdade (aqui o quadro leva ~2 s); o refazer de vizinhas custou até 34 ms de CPU. Ideias: malha 5 só com emendas coerentes, cache de `topColor`, decalques de estrada em tira única.

## Visual
Pranchas (base × E5; `base` = `?encostas=0`): `prancha-temas-longe.jpg`, `prancha-temas-perto.jpg`, `prancha-relevo-terra.jpg`, `prancha-astra-x-e5.jpg`. Observações: as vilas leem como colinas cinza (a rocha tinge o chão; reduzi a tinta para 0,14); no Relevo/Terra a costa deixou de ser o contorno redondo (sem as saias o contorno segue o hexágono, a água e o mar do "fluido" continuam); a crista que atravessa emendas aparece na prancha do Astra.

## Arquivos
Código: `src/core/hills.ts`, `src/render/hillSurface.ts`, `tileBuilder.ts`, `world.ts`, `life.ts`, `lib.ts` (export BODY), `main.ts`. Testes: `tests/hills.ts`, `tests/hills-cost.ts` (`npm run hills:custo`). Prévia: `/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/e5/retalhos-encostas.html` (abre sem erro em Clássico, `#mode=relevo`, `#mode=terra`).

# E5b: correção das regressões visuais

Commit `5c36983` e seguintes. Pranchas novas: `prancha-e5b-costa.jpg`, `prancha-e5b-vilas.jpg`, `prancha-e5b-astra.jpg`, `prancha-e5b-rio.jpg` (capturas em `quality=medium`, WebGL2).

## O que mudou
1. **Costa (Relevo e Terra):** a borda aberta volta a ter a costa da base. `BuildOpts.skirt` (por borda, só com as Encostas em Relevo/Terra) reaproveita a saia de `skirtFor`: como a borda aberta fica em altura 0, ela desce curta até a areia no nível do mar, sem parede e sem saia alta, e o contorno segue o `seaMap` (margem `0,4 · skirtWidth(0)`). Quando a vizinha chega, a peça é refeita sem a saia desse lado (a assinatura do chão agora inclui as bordas abertas). No Clássico a placa hexagonal fica.
2. **Vilas:** massa e subida baixas (`MASS` mata 0,30, cultivo 0,22, vila 0,26; `RISE` 0,10/0,09/0,09); sem tinta de rocha em vila, cultivo e prado (rocha só em mata com subida forte, até 10%); na subida entre dois patamares o chão da vila toma a cor de parede do tema (`hillRiser`, 70%), como muro de arrimo; fundação só no lado de baixo da casa.
3. **Água (Relevo e Terra):** `BuildOpts.rapids`: onde a água pontuada desce de nível para uma vizinha assentada antes, a peça que chega depois desenha um degrau de pedra baixo atravessando o rio, espuma, pedras e a névoa da queda existente. O núcleo não muda. Só a peça mais nova desenha (a mais velha não é refeita, para não duplicar espuma).
4. **Custo:** decoração foge de subida forte (`HILL_STEEP` 0,75, como o `steep` da base), decalques adaptativos, parede inteira numa só faixa nas bordas baixas, fundações só do lado baixo.

## Custo (stress 300:high, WebGL2 por software, Holanda, seed 42, contra `f3-terra-fantasma`)
| Modo | Triângulos | Montagem |
|---|---|---|
| Clássico | 1.476 mil → 1.428 mil (−3%) | 1.234 → 1.511 ms (+22%) |
| Relevo | 1.466 mil → 1.493 mil (+1,8%) | 2.810 → 2.228 ms (−21%) |
| Terra | 1.520 mil → 1.509 mil (−0,7%) | 3.000 → 2.223 ms (−26%) |

Metas de custo atendidas. Parte da queda vem da decoração que agora foge da encosta forte (instâncias do Clássico 80 mil → 72 mil).

## Verificação
`npm run check` verde (inclui `tests/hills.ts`). Smoke: `webgl`, `relevo-webgl` e `terra-hash-webgl` ok; os casos WebGPU falham aqui ("Instance dropped", ambiente; a `main` também). Prévia regenerada e aberta sem erro no Clássico, `#mode=relevo` e `#mode=terra`.

## Critérios de aceite (conferidos nas imagens com Read)
- **(i) Costa Terra e Relevo longe:** fecha em parte. A costa voltou a ser redonda e contínua, sem parede, como na base (`prancha-e5b-costa.jpg`). Ainda sobram algumas casas vazias que leem como baías hexagonais claras (uma no centro-direita da Terra), mais visíveis que as da base.
- **(ii) Vila de perto, 5 temas:** NÃO fecha por completo. A vila já não é morro de pedreira, mas Holanda, Oriental e Inverno ainda leem como colina cinza-acastanhada (a cor de chão da vila desses temas já é cinza na base) e os patamares com muro de arrimo quase não aparecem na malha de 6 divisões. Egito e Brasil estão melhores.
- **(iii) Vista de perto ao lado do Astra:** NÃO fecha. A captura de perto é uma vila (Holanda), não uma crista com rio como a dele. A corredeira não apareceu nas capturas (sem desnível de água na vista); só foi conferida por execução sem erros.

## Pendências
Patamares legíveis (bancada e muro maiores na vila, ou degrau em geometria), baías das casas vazias e uma captura da corredeira.

# E5c: facetas, cor da encosta e patamares

Pranchas: `prancha-e5c-vilas.jpg` (base × E5c, 5 temas), `prancha-e5c-costa.jpg` (Terra e Relevo longe), `prancha-e5c-rio-astra.jpg` (Astra, rio e vila, queda de rio). Capturas em `quality=medium`, WebGL2.

## O que mudou
1. **Normal suave:** o chão lê a normal do mapa de alturas também fora do fluido (`U.hillN`, só no topo e sem inclinação forte, para não borrar os paredões dos platôs). No fluido já valia. Não vale na Média e na Baixa (chão enxuto).
2. **Cor da encosta:** sem rocha em vila, cultivo e prado; o plano do patamar mantém o calçamento do tema; terra do tema na subida de cultivo e prado.
3. **Patamares:** bancada baixa (0,075) com degrau curto (patamar plano, subida estreita) em `hillHeight`, e no material o muro de arrimo é a faixa de altura do PIXEL (cor de parede do tema, capa um pouco mais clara), então fica nítido em qualquer malha (`U.terrace`, `U.wall`).
4. Corredeira e crista capturadas (abaixo).

## Custo (stress 300:high, contra `f3-terra-fantasma`)
Clássico 1.476 mil → 1.445 mil triângulos (−2%), montagem 1.234 → 1.733 ms (+40% nesta rodada, 1.511 ms na anterior: a máquina varia mais de 15% entre rodadas); Relevo 1.466 mil → 1.509 mil (+2,9%), montagem −21%; Terra 1.520 mil → 1.509 mil (−0,7%), montagem −29%. Triângulos dentro da meta nos três modos; a montagem do Clássico passa de +25% em parte das rodadas.

## Verificação
`npm run check` verde; smoke: `webgl`, `relevo-webgl`, `terra-hash-webgl` ok (WebGPU falha por ambiente); prévia regenerada, abre no Clássico, `#mode=relevo` e `#mode=terra` sem erro.

## Critérios, com franqueza
- **(i) costa longe:** fecha em parte, como na E5b: a costa é redonda e contínua, mas ainda há casas vazias internas que leem como baías de contorno hexagonal (centro-direita da Terra). NÃO tratei o item 4 (contorno das casas vazias pelo `seaMap`).
- **(ii) vila em encosta suave com patamares e muros:** fecha em parte. Há patamares legíveis como faixas de muro na cor de parede nos 5 temas, mas são só COR sobre a malha (contornos de nível), não degrau de geometria com muro vertical e capa; isso não foi feito. Holanda e Oriental ainda têm o chão de vila cinza-acastanhado do tema.
- **(iii) vista comparável à do Astra:** fecha em parte. A vista do rio com vila na margem (Holanda e Oriental) é parecida em espírito, sem a crista alta de muro do Astra.
- **(iv) nenhuma encosta lê como pedra facetada:** fecha no Clássico e no Relevo/Terra em Alta e acima; não conferi a Média/Baixa com chão enxuto, que seguem facetadas.
- **(v) patamares leem a 1200×720 de perto:** fecha como faixas de cor, não como degraus.
- **Corredeira:** NÃO confirmada. Na captura do Relevo (seed 7, `step=water.0`) aparece a queda de boca aberta que já existia e a névoa, mas não identifiquei o degrau de pedra e a espuma da corredeira nova.
