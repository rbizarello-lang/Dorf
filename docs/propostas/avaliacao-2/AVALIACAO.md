# Segunda avaliação autônoma do Retalhos (D55)

Base: `origin/main` em `eb39a2b` (D54), build local servido na porta 4381, sempre com `?webgl` (SwiftShader, Chromium headless, 1440×860 e 1000×700) e `timescale=0.001`. O `md5` do `dist/index.html` servido conferiu com o do build antes de capturar. Sementes fixas: 11 (Clássico, 7 temas, `auto=45`), 21 (modos) e 3 (ponte). Renderização por software: o FPS não vale, e brilho de água e transparência foram tratados com cautela.

Cobertura real:
- **Temas:** os 7 de dia (Holanda, Egito, Oriental, Brasil, Inverno, Guanabara, Chamonix) e 5 à noite (Holanda, Guanabara, Chamonix, Oriental e Egito; só Holanda e Chamonix entram nas imagens).
- **Modos:** Clássico, Zen com `viva=1`, Relevo, Terra contínua, Entrepostos (no meio da partida e no fim) e Estrada Real.
- **De perto:** vila (Holanda, Oriental, Chamonix), rio (Egito), costa (Brasil, Guanabara), ponte levadiça (Holanda), corredeira e cachoeira do Relevo (Inverno, Oriental), patamares de vila, canais de irrigação (Egito) e um lago com borda aberta.
- **Momentos:** fantasma (Guanabara e Oriental Relevo), peça caindo (Chamonix), virada de era (Egito), chuva (Holanda), neve (Inverno), fim de partida (Brasil, Holanda, Egito, Entrepostos), silhueta (Guanabara).
- **Qualidade e janela:** Baixa e Alta (Oriental), janela 1000×700 (jogo e fim de partida) e 1440×860.

**Não cobri:** WebGPU real e GPU de verdade (só SwiftShader WebGL2), celular (o Roger pediu para ignorar), áudio, cartas da era, Almanaque, Aa e o menu de temas abertos, modo foto e vídeo, Desafio do dia e Exploradores, `?gallery`. Também não joguei uma partida com a mão: as telas vêm de `?auto` e dos ganchos, e `?auto` não passa pelo mesmo caminho de enquadramento de câmera de uma partida normal (ver P2.4).

## 1. Resumo

- O visual geral está muito bom e bem mais coeso que na D48: ilhas legíveis nos 7 temas, vilas com personalidade, costa e pé das peças corretos (a sombra de contato da D54 funciona), a noite agora mostra as casas vazias, e o fim de partida está coerente (sem "recorde 0" nem plural errado).
- **Nenhum erro ou aviso de console** em cerca de 50 URLs, incluindo os ganchos (`__ghostBest`, `__drop`, `__era`, `__weather`, `__over`, `__bridge`, `__pick`, `__goto`).
- Os defeitos que sobram estão de perto: **canais de irrigação do Egito quebrados e flutuando**, uma **linha branca vertical** na borda de lagos e rios voltada para casa vazia, **retângulos translúcidos soltos** nas encostas do Relevo e **enquadramento que corta a ilha embaixo** no Relevo e na Estrada Real.
- O maior ganho visual por esforço está em três pontos: contraste das casas vazias de dia nos temas de fundo claro (Egito, Brasil, Chamonix), as plantações de flores da Holanda (ruído de confete) e as fundações de pedra das casas (lê como placa de cimento).

## 2. P1 — falhas que quebram o jogo

Nenhuma encontrada. Sem erro de console, sem travamento, sem peça sumida, sem tela em branco (limite: WebGL2 por software; o WebGPU real não foi testado).

## 3. P2 — defeitos visuais e de texto

**P2.1 Canais de irrigação do Egito aparecem como lascas soltas, inclinadas e flutuando sobre a plantação.**
Onde: `?webgl&theme=egito&seed=11&auto=45&time=day`, depois `window.__goto(...)` na peça da plantação perto do rio (`__pick(1020,430)` devolve `[4,-4]`; `__goto(4,-4,3.5)`). Imagem: `14-irrigacao-egito.jpg`. Em vez de um canal reto no sentido das fileiras, vê-se uma cruz torta de faixas azul-turquesa, algumas acima do trigo e outras enterradas, e fragmentos de lírios soltos. Os canais parecem não acompanhar a altura do chão das Encostas (D47/E5): a geometria é plana e o chão por baixo é inclinado e em bancadas. Aparece de longe como pontos azuis no campo (ver `02-egito-dia.jpg`, lado direito). Código provável: `src/render/tileBuilder.ts`, bloco "Canais de irrigação (Theme.irrigation)" (~linha 2396 a 2414), que precisa passar pela mesma função de `drape` que as estradas e as parcelas (`Buf.drape`, `HillSurface.at`).

**P2.2 Linha branca vertical na borda aberta de lagos e rios (água que dá numa casa vazia).**
Onde: em todo tema que tem lago na borda da ilha, por exemplo `?webgl&theme=egito&seed=11&auto=45` (ao pé da peça de lago, perto de x=622, y=590 a 640 na tela de jogo, visível também em Holanda, Oriental, Brasil e Inverno), e na Terra contínua (`13`/`25`). Imagens: `24-lago-borda-aberta-egito.jpg` (recorte ampliado 4× da captura de jogo; pixels grandes de propósito), `02-egito-dia.jpg`, `03-brasil-dia.jpg`, `10-terra-brasil.jpg` (traços brancos verticais cruzando o lago). É uma lâmina fina branca que desce do lábio da água até a casa vazia, como uma cortina de 4 a 5 px. Lê como erro, não como cachoeira. Código provável: `src/render/tileBuilder.ts`, `OPEN_LIP` (linha 51), `WaterBuf.film` (~linha 952, usado na ~1627) e a espuma de queda aberta (`FallLayer`, `src/render/falls.ts`). Sem certeza de qual dos dois desenha a lâmina.

**P2.3 Retângulos e polígonos translúcidos soltos sobre as encostas, no Relevo e em vilas (parecem vidro).**
Onde: `?webgl&mode=relevo&theme=inverno&seed=21&auto=50&time=day&step=water.0&zoom=4` e `?webgl&mode=relevo&theme=oriental&seed=21&auto=50&fall=1&zoom=4`. Imagens: `15-corredeira-inverno-relevo.jpg` (placas cinza-azuladas à esquerda, em 240 a 470 × 380 a 560) e `16-queda-oriental-relevo.jpg` (placa verde-escura grande à esquerda). Aparecem também, mais discretas, no Clássico sobre prado perto da vila (`13-vila-perto-holanda.jpg`, plano marrom liso à esquerda). São planos chapados e sem textura que não pertencem ao terreno e mudam de cor no meio da encosta. Não identifiquei a causa: pode ser a laje das casas vazias (`World.slots`, `SLOT_LIFT`) vista de cima de um morro alto do Relevo, uma capa dos patamares de vila (`src/render/villageTerraces.ts`) ou uma face do arrimo sem textura. Vale um `__goto` em cada uma e ligar/desligar `?encostas=0` para separar.

**P2.4 O enquadramento inicial corta a ilha na borda de baixo no Relevo e na Estrada Real (e quase no Clássico).**
Onde: `?webgl&mode=relevo&theme=egito&seed=21&auto=40`, `?webgl&mode=rotas&theme=egito&seed=21&auto=40` e `?webgl&mode=classico&theme=holanda&seed=21&auto=40`. Imagens: `09-relevo-egito.jpg` e `11-estrada-real.jpg` (a peça de baixo passa do limite da tela e a pilha cobre o canto), `01-holanda-dia.jpg` e `10-terra-brasil.jpg` para o enquadramento bom. É o ponto que a D54 mexeu (`frameBoard` em `src/render/cameraRig.ts`, chamado por `frameCamera` em `src/main.ts` ~linha 568). Ressalva forte: `?auto=N` pode não passar pelo mesmo caminho de `frameCamera` do jogo real, e a Estrada Real usa `frameVoyage` (não `frameBoard`). Conferir jogando de verdade antes de mexer. O Relevo também pode estar sendo medido com `heightOf` subestimado, já que o desenho agora fica no nível 0 (`World.flatDraw`).

**P2.5 No gráfico do fim de partida, a série "vila" (e a de outro terreno) é quase branca e some sobre o papel creme.**
Onde: `window.__over()` em Brasil (`21-fim-brasil.jpg`, 4º ponto da legenda "maior grupo" branco, linha invisível) e Egito (captura do fim em 1000×700 à noite, não anexada, o 5º ponto da legenda é bege-claro e a linha quase some). Código provável: `src/ui/minimap.ts` (gráfico `maior grupo`, ~linha 76 a 143), que usa a cor do terreno do tema sem garantir contraste com o fundo do cartão. Contornar com um traço escuro fino por fora ou escurecer a cor se a luminância passar de um limite.

**P2.6 Casas altas da Era III em Holanda e Oriental ainda leem como torres sobre pedestais de pedra, e uma tem o telhado "mordido".**
Onde: `?webgl&theme=holanda&seed=11&auto=45&time=day` + `window.__deco('wall:',3,5)` e `?webgl&theme=oriental&seed=11&auto=50&time=day` + `window.__deco('wall:',6,4)`. Imagens: `13-vila-perto-holanda.jpg` (torre azul-escura no centro com a ponta do telhado recortada, em 480 a 580 × 270 a 360; casa à direita pendurada para fora da bancada, em 1080 a 1200 × 320 a 440) e a captura do Oriental `p-patamar` (não anexada; a fundação cinza lê como bloco de cimento chapado sob uma torre de enxaimel). A D53 corrigiu as casas do estágio 3 da Paisagem viva, mas o sobrado da Era III do Clássico segue magro. Código provável: `src/render/lib.ts` (`roofGeometry`, estilos `bell`/`neck`), fundação em `src/render/tileBuilder.ts` (`FOOT_HALF`, `FOOT_MIN`) e `src/render/livingBuild.ts`.

## 4. P3 — melhorias, em ordem de valor por esforço

1. **Casas vazias de dia pouco legíveis nos temas de fundo claro (Egito, Brasil, Chamonix).** A laje bege sobre areia ou cinza sobre névoa tem ΔE baixo (ver `02-egito-dia.jpg`, `03-brasil-dia.jpg`, `05-chamonix-dia.jpg`; no mar e no Inverno lê bem). À noite agora está bom, mas talvez forte demais: as lajes ficam mais claras que a terra (`06-holanda-noite.jpg`, `07-chamonix-noite.jpg`). Um tom mais escuro e quente por tema (`slotMat`/`slotBlob`, `src/render/world.ts` e `materials.ts`), mais um fio de contorno só onde o fundo for claro. Esforço: baixo (uma hora). Ganho: alto, porque é onde se joga.
2. **Plantações de flores na Holanda viram confete (manchas granuladas de magenta, amarelo e azul).** Ver `08-zen-viva.jpg` (centro), `06-holanda-noite.jpg` e a pilha da próxima peça (cobre-a de pontos). De perto (`13`, `18`) as tulipas são cones grandes e geométricos. Reduzir a contagem por parcela, agrupar em fileiras e baixar o contraste das cores à distância. Arquivos: `src/render/lib.ts` (`CropStyle bulb`) e `src/render/livingBuild.ts`. Esforço: baixo a médio. Ganho: médio (a Holanda é o tema padrão).
3. **Fundações de pedra das casas lêem como placas.** Faces verticais chapadas de uma cor só (ver `13`, `16`). Dar leve afunilamento, uma faixa de pedra mais escura no pé e um pouco de textura (cor por vértice ou `rockK`). `tileBuilder.ts` (fundação D47) e `hillSurface.ts`. Esforço: médio. Ganho: médio-alto de perto.
4. **Terra contínua: as casas vazias fundidas viram "nuvens de algodão" brancas em volta da ilha** (`10-terra-brasil.jpg`, `25-terra-fantasma-holanda.jpg`). Em fundo de areia competem com a ilha. Tingir pela cor do entorno e reduzir a opacidade. `slotBlob` em `materials.ts`. Esforço: baixo.
5. **Terra contínua: o fantasma que mostra a paisagem** (`25-terra-fantasma-holanda.jpg`) tem pílulas azuis grandes e opacas sobre a encosta lateral da peça (lêem como adesivos) e a peça ganha uma placa translúcida ao lado. Assentar as fitas na superfície (drapeadas) e afinar. `src/render/landTrace.ts`. Esforço: médio.
6. **Chuva e neve fracas.** Poucos traços finos e brancos, e nenhum escurecimento da cena na chuva (`e-chuva` capturada, não anexada; a tela é a mesma de `01-holanda-dia.jpg` com a camada de nuvens e riscos). Mais gotas, um pouco de escurecimento e esfriamento do chão molhado. `src/render/fx.ts` (`Weather`). Esforço: médio. Ganho: médio (clima é um dos recursos mais vistos).
7. **O mar do Inverno brilha com granulado de alta frequência** (`04-inverno-dia.jpg`, e na neve). Pode ser só aliasing do SwiftShader sem TRAA; confirmar numa GPU real antes de mexer (`seaLook` em `materials.ts`). Esforço: baixo, se confirmado.
8. **Anel de foco do fantasma pesado na peça caindo em Chamonix** (`20-queda-chamonix.jpg`: traço branco de ~8 px, opaco) contra o fio fino do Guanabara (`19-fantasma-guanabara.jpg`). O D51 afinou o anel, mas com o zoom aberto (`HOVER_OPACITY`, `HOVER_FAR`, `src/render/world.ts`) o branco sobre fundo claro domina. Esforço: baixo.
9. **Mar dentro dos buracos da ilha mostra um "Y" escuro (as fendas entre as três casas vazias) através da água** (captura `x-lago`, não anexada). Efeito pequeno, de perto. `src/render/world.ts` (`slots`) e `seaMap.ts`. Esforço: baixo.
10. **Janela estreita (1000×700):** a barra do topo quebra em duas linhas, o texto da era em duas, e tudo cabe sem corte (`22-janela-estreita-guanabara.jpg`). Funciona; encurtar o nome do tema ou esconder "Câmera" ganharia uma linha. Esforço: baixo. Ganho: baixo.
11. **O que já está bom, para não mexer:** o fim de partida coerente (`21-fim-brasil.jpg`, e o de Entrepostos mostra entrega e cartas), o Zen com Paisagem viva (`08-zen-viva.jpg`), as costas e o pé das peças (`17-costa-guanabara.jpg`), a ponte levadiça (`18-ponte-holanda.jpg`), a Estrada Real com as etiquetas "mercado" e "porto" (`11-estrada-real.jpg`), o Entrepostos no meio da partida (`12-entrepostos.jpg`), a silhueta do Guanabara (palmeiras agora lêem) e a Alta contra a Baixa: a Alta ganha nuvens, profundidade de campo e cor (`23-qualidade-alta-oriental.jpg`), a Baixa continua legível.

## 5. Números

Stress (`RUNS=300:high`, WebGL2, 1280×800, software, semente 42):

| Tema | Peças | Qualidade | Lógica (ms) | Montagem (ms) | Draw calls | Triângulos | Instâncias | CPU JS/quadro | Heap |
|---|---|---|---|---|---|---|---|---|---|
| Holanda | 301 | alta | 96 | 1834 | 117 | 1241 mil | 71434 | 10,7 ms | 232 MB |
| Guanabara | 301 | alta | 81 | 1531 | 99 | 1377 mil | 37706 | 8,8 ms | 182 MB |

Na D48 a Alta com 301 peças deu 117 calls e 1255 mil triângulos (tema padrão da época): a Holanda ficou igual em calls e 1% abaixo em triângulos. O Guanabara tem metade das instâncias e mais triângulos (chão e patamares das Encostas pesam mais que a decoração). O AGENTS.md cita ~136 calls e ~1,46 milhão na Alta; ambos ficam abaixo, dentro do orçamento.

`__stats` por captura (41 a 45 peças, 1440×860): Baixa Oriental = 70 calls, 172 mil triângulos, 2068 instâncias; Alta Oriental = 94 calls, 182 mil, 3211. Relevo Egito (40 peças) = 64 calls, 155 mil, CPU 12,4 ms por quadro; Terra Brasil = 70 calls, 183 mil, CPU 11,5 ms. O CPU por quadro no software inclui a espera pelo SwiftShader e não é medida de jogo.

Console: 0 erros e 0 avisos em todas as capturas (fontes e rede do proxy filtrados).

## 6. Imagens

`01` a `25` `.jpg` nesta pasta, cada uma com até 150 KB (JPG a 1440 de largura, qualidade 56 a 80).

| Imagem | O que mostra |
|---|---|
| `01-holanda-dia` a `05-chamonix-dia` | Visão de jogo (seed 11, 45 peças) de Holanda, Egito, Brasil, Inverno e Chamonix de dia |
| `06-holanda-noite`, `07-chamonix-noite` | Noite, com as casas vazias legíveis |
| `08-zen-viva` | Zen com `viva=1` |
| `09-relevo-egito`, `10-terra-brasil`, `11-estrada-real`, `12-entrepostos` | Modos |
| `13-vila-perto-holanda`, `14-irrigacao-egito` | De perto: vila (P2.6) e canais quebrados (P2.1) |
| `15-corredeira-inverno-relevo`, `16-queda-oriental-relevo` | Corredeira e queda no Relevo (P2.3) |
| `17-costa-guanabara`, `18-ponte-holanda` | Costa e ponte levadiça |
| `19-fantasma-guanabara`, `20-queda-chamonix` | Fantasma e peça caindo |
| `21-fim-brasil`, `22-janela-estreita-guanabara` | Fim de partida e janela estreita |
| `23-qualidade-alta-oriental` | Alta (a Baixa do mesmo tabuleiro tem 70 calls e 172 mil triângulos; ficou de fora das imagens) |
| `24-lago-borda-aberta-egito` | Recorte do P2.2 |
| `25-terra-fantasma-holanda` | Terra contínua com fantasma |

Capturadas e vistas, mas não anexadas (limite de 25): Oriental e Guanabara de dia e à noite, Egito à noite (a linha branca do P2.2 aparece também ali, em 622, 590), chuva, neve, virada de era (Egito), silhueta (Guanabara), fantasma do Relevo, Entrepostos no fim da partida, Baixa do Oriental e o fim de partida em 1000×700.
