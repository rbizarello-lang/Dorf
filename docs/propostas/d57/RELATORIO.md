# D57: legibilidade (segunda avaliação, itens P2.5, P3.1, P3.4, P3.8, P3.9)

Executor: Sonnet (Claude Code). Base: `eb39a2b`. Tudo só de cor e material: nenhuma regra, nenhum `src/core`, nenhum `SAVE_VERSION`. Nada de `theme.id` no render: a escolha sai do `surround` e do `fill` do entorno, dados do tema.

## O que mudou

**P2.5, gráfico do fim (`src/ui/minimap.ts`, `src/main.ts`).** `timelineSvg` recebe a cor do cartão (`theme.ui.panel`) e passa cada série por `seriesInk`: se o contraste (WCAG) contra o cartão é menor que 2,6, a cor escurece no mesmo matiz até chegar; as que já passam ficam como estão. Os quadradinhos da legenda ganharam contorno fino (`currentColor`, 45%). Conferido por conta para os 7 temas: todas as 42 séries ficam com contraste de 2,6 ou mais (a vila do Brasil `#fbf7ee` vira `#97948f`, a 5ª série do Egito `#e0cfa0` vira `#a19573`). Séries que já liam bem (verdes escuros, vermelho da Holanda etc.) não mudaram; as que ficavam entre 2,0 e 2,6 escureceram um pouco.

**P3.1, laje das casas vazias (`src/render/world.ts`, `applySky`).**
- De dia, fora do mar (areia, chapada, papel), a laje deixa de ser a `line` clara e vira o `fill` do entorno escurecido e esquentado: `SLOT_DAY` (0,74 / 0,68 / 0,60) no papel (Chamonix) e `SLOT_DAY_SAND` (0,62 / 0,54 / 0,44) na areia e na chapada, com a mesma opacidade do papel (`over` = 1). Revisão do coordenador: a primeira versão (0,48 / 0,39 / 0,28, ×1,1) lia como mancha marrom suja; as pranchas `egito-dia`, `brasil-dia` e `terra-brasil` agora têm três painéis (antes, 1º depois, novo). Sobre o mar continua a `line` clara, que já lia bem (Holanda, Inverno, Oriental, Guanabara).
- À noite: a mistura com o luar cai (mar 0,7 para 0,5; papel 0,7 para 0,55; areia 0,3 como estava) e a opacidade noturna cai 0,2 em vez de 0,17. Na prancha, Holanda e Chamonix à noite ficam um pouco mais baixas que a terra; é uma moderação pequena de propósito (abaixo disso a casa vazia sumia sobre o mar escuro, D49/D51).

**P3.4, Terra contínua.** As manchas usam o mesmo `slotMat.color`, então herdam o tom do entorno. Além disso `slotAlpha` passa de opacidade × 1,8 para × 1,15: o centro do disco chegava a ~1,0 (branco opaco, "algodão"). Agora a borda da ilha é uma sombra tingida (prancha `terra-brasil`).

**P3.8, anel de foco.** `hoverLight` (0 a 1, do `fill` da hora, 0 no mar) e `HOVER_LIGHT_CUT` = 0,35 (era 0,5 na 1ª versão, que quase apagava o fio): sobre fundo claro o anel perde até 35% da opacidade, de perto e com o zoom aberto. O fio do hexágono passa de 0,055 para 0,045 de espessura. À noite o `fill` escurece e o anel volta ao normal. A versão fluida (arco) não mudou de geometria.

**P3.9, "Y" escuro no mar: só causa, sem correção.** A laje é um hexágono de raio 0,9 numa casa de raio 1,0, então as três lajes que se encontram deixam uma fresta em Y por onde se vê a água funda, escura (visível em `holanda-dia`, de mar). É a mesma fresta que desenha a grade; fechá-la (raio ~0,97) apagaria a grade das casas vazias no mar, que hoje lê bem. Uma correção segura passa por pintar a fresta com a cor da laje só nos nós do Y (shader próprio) ou por clarear a água sob a laje, e isso mexe no desenho da grade inteira; **Decisão do coordenador: fica como está**, para não apagar a grade das casas vazias no mar.

## Verificação

- `npm run check`: verde (typecheck, 600 partidas, legibilidade, build).
- `npm run smoke`: todos os casos WebGL passam (webgl, chamonix, relevo, terra, entrepostos, buffers de vértice, vida dos buffers, ao vivo). Os casos WebGPU falham aqui com "WebGPU Device Lost" (a máquina não tem GPU; já avisado), sem erro de página, e não passam por esta mudança.
- **compare** (`QUALITY='low&webgl'`, referência de `origin/main` = `eb39a2b` na 4392; as 6 vistas foram regravadas com tempo longo de navegação por causa da máquina carregada):

| vista | % pixels | média | leitura |
|---|---|---|---|
| holanda (dia, mar) | 0,127 | 0,057 | só o ruído (dentro da tolerância) |
| egito-entardecer | 21,15 | 4,84 | laje na areia, esperado |
| noite (Holanda) | 0,092 | 0,989 | laje à noite, poucos pixels |
| zoom-aberto | 0,262 | 0,107 | dentro da tolerância |
| rio-perto (Egito) | 5,04 | 1,52 | laje na areia, esperado |
| vila-perto (Oriental) | 0,000 | 0,000 | igual (veja a nota) |

  Nota: a primeira gravação de referência da `vila-perto` deu 1,07% contra o meu build; regravada a referência, ficou 0,000%. A variação era das árvores ao vento (carga da máquina), não da mudança. O compare falha as vistas de Egito e noite por desenho: a diferença é só nas casas vazias.
- **stress** (`RUNS=300:high EXTRA='&webgl&theme=egito&seed=42'`): antes 115 draw calls, 1219 mil triângulos, 35 555 instâncias; depois, os mesmos 115, 1219 mil e 35 555. Igual (a mudança é de cor e material).
- Pranchas (antes à esquerda, depois à direita, `&webgl&timescale=0.001`; as 10 vistas conferidas a olho): `egito-dia`, `brasil-dia`, `chamonix-dia`, `holanda-dia` (não piorou, mar igual), `holanda-noite`, `chamonix-noite`, `terra-brasil`, `anel-chamonix` (zoom 22 com `__ghostBest`; na revisão o fantasma caiu na mesma casa dos dois lados e o fio branco aparece), `fim-brasil`, `fim-egito-noite`.

## O que ficou sem verificar

- WebGPU de verdade (sem GPU aqui): os materiais são os mesmos nós TSL e só mudam uniformes e cores, mas o `smoke` WebGPU não rodou.
- No Egito de dia a laje agora é uma sombra leve; o botão é `SLOT_DAY_SAND`. No Brasil a laje é mais discreta que no Egito (o fundo da chapada é mais escuro e mosqueado).
- Qualidades Alta e Ultra: as capturas foram na Baixa (SwiftShader); a laje é a mesma, mas o pós (GTAO, bloom) pode somar tom.
- Anel do Guanabara e dos temas de mar: não mudam (`hoverLight` = 0), só conferido pelo código.

Nota da revisão: os números de compare e stress acima são da 1ª versão; a revisão só afrouxou a laje na areia/chapada e o corte do anel (draw calls e triângulos não mudam; o compare de Egito e rio-perto continua diferindo só nas casas vazias, em menor grau). Check verde; smoke WebGL verde (WebGPU sem GPU, como antes).
