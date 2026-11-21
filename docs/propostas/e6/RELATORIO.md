# E6: Paisagem viva

A etapa seguinte registra os [celeiros por tema e o ensaio das emendas](../paisagem-viva/RELATORIO.md).

Branch `dorf/e5-encostas`. Ideia do Roger; implementação de referência do GPT Astra (`jogo-entrepostos` 5035a34), refeita aqui como função pura do tabuleiro final. Só aparência: sem `SAVE_VERSION`, sem mudar pontos nem replay.

## Resumo
Cada terreno de uma peça (prado, mata, plantação, vila) tem um estágio de 0 a 3. As casas sobem, a mata ganha copas e densidade, o cultivo cresce e, a partir do estágio 2, ganha um celeiro; o prado ganha flores. Opção em Aa; no jogo normal vem ligada no Zen e na Terra. Ver `COMO-TESTAR.md`.

## Regra e números (`src/core/living.ts`)
- **Encaixes:** estágio de um terreno numa peça = min(3, bordas desse terreno cuja vizinha tem o mesmo terreno do outro lado).
- **Terra (manchas):** mancha = grupo de setores do mesmo terreno (a mesma da regra). Mancha FECHADA (nenhum setor dá para o vazio) leva todas as peças dela ao estágio 3 daquele terreno. Mancha ainda aberta com área ≥ 4 peças (`LIVING.largeArea`, cunhas ÷ 6, a mesma área da regra) sobe um estágio. Fora da Terra só valem os encaixes.
- É função do tabuleiro final: não depende da ordem das jogadas; replay, desfazer e save dão a mesma paisagem.
- Rio e trilho não têm estágio. Os números (4 peças, +22% de altura da casa por estágio etc.) são escolha minha e ficam em `LIVING` e `GROW` (`livingBuild.ts`).

## Desenho (`src/render/livingBuild.ts`)
- Casas: escala por instância (altura +22% e largura +5% por estágio, chaminé junto). A era troca só a geometria, então as duas coisas se compõem sem pool novo.
- Mata: copas maiores (+18% altura, +8% largura por estágio) e uma árvore menor a mais em 1 de cada 6 (estágios 1 a 3 dão 1, 2 e 3 em cada 6). Cultivo: plantas mais altas e uma cópia em 1 de cada 8 por estágio. Prado: flores a mais.
- Celeiro (`barn`): UM pool novo, nas cores das casas do tema, estágios 2 e 3 do cultivo; as plantas sob ele cedem lugar.
- Ao pousar, as peças cujo estágio mudou entram numa fila e `tick` refaz até 2 por quadro (`drainLiving`), reaproveitando `rebakeHill`, que agora refaz só a decoração quando só o estágio mudou. `placeInstant` e `rebuild` saem no estado final.
- Fantasma: a peça já aparece desenvolvida pelos encaixes e a etiqueta de pontos leva " · N crescem" (vizinhas que ganham estágio). As vizinhas não são redesenhadas no fantasma (custaria refazê-las a cada casa).

## Opção
Aa → "Paisagem viva" grava `retalhos.viva` ('0' ou '1', validado). Sem preferência: Zen e Terra ligam, os outros modos não, e a prévia publicada liga em todos. `?viva=0|1` e `#viva=0|1` forçam. A preferência gravada vale para todos os modos.

## Custo (stress `300:high`, WebGL2 por software, Holanda, seed 42; base = cabeça da e5 antes da E6)
| Modo | Draw calls | Triângulos | Instâncias | Montagem (ms) |
|---|---|---|---|---|
| Clássico base | 117 | 1.136 mil | 72.423 | 1.337 |
| Clássico viva | 118 (+1) | 1.285 mil (+13,1%) | 90.122 | 1.494 (+11,7%) |
| Zen base | 117 | 1.136 mil | 72.423 | 1.410 |
| Zen viva | 118 (+1) | 1.285 mil (+13,1%) | 90.122 | 1.250 (−11%) |
| Terra base | 117 | 1.202 mil | 65.143 | 1.765 |
| Terra viva | 121 (+3,4%) | 1.338 mil (+11,3%) | 81.245 | 1.968 (+11,5%) |

Metas (draw calls ≤ +10%, triângulos ≤ +15%, montagem ≤ +25%) atendidas nos três modos. A primeira versão do desenho (cópias de árvores em 1 de 4 e de plantas em 1 de 5) dava +20,7% de triângulos no Clássico e +17,9% na Terra; reduzi as cópias e aumentei a escala das copas. O Astra passou de 97 para 298 draw calls no Zen; aqui o aumento é de 1 a 4.

**Pior quadro de uma jogada que desenvolve vizinhas.** Medido com `?demo` (a IA joga com animação, `quality=low`, software): `window.__living().maxMs` ficou em 19,5 ms no Zen (4 peças refeitas, 2 por quadro) e 5 ms na Terra (1 peça). É CPU de uma rodada de até 2 peças; o custo na GPU real e o de uma mancha grande que fecha (dezenas de peças, espalhadas por 15 ou mais quadros) NÃO foram medidos.

## Verificação
- `npm run check` verde no `317f1b7` (typecheck, 600 partidas, oráculos, `tests/living.ts`, build).
- `npm run smoke`: casos `webgl`, `relevo-webgl` e `terra-hash-webgl` verdes. Os casos WebGPU (`bench`, `webgpu`, `relevo`, `terra`, `hash-invalido`) falham aqui com "Instance dropped in popErrorScope" / "WebGPU Device Lost": é o ambiente (o WebGPU por software perde o dispositivo, também na `main`). O WebGPU NÃO foi conferido; a CI roda os dois.
- `tests/living.ts` (`npm run living`): oráculo próprio (vizinhos, encaixes e manchas por busca em largura, escritos no teste), 48 partidas (4 modos, todos os temas, 4.131 peças), 192 ordens embaralhadas, 48 replays, 48 desfazer, prévia do fantasma, pontuação intacta; uma mutação do limiar (4 para 5) derruba o teste.
- A prévia (`VITE_PREVIEW=relevo`) abre sem erro em WebGL2 no Clássico, em `#mode=zen`, `#mode=terra` e `#mode=zen&viva=0` (viva ligada por padrão e desligável).

## Capturas (WebGL2, `quality=medium`, 1200×720, `timescale=0.05`; a Alta não fecha quadro por software)
- `prancha-zen-temas.jpg`: Zen `auto=60`, Holanda, Oriental e Brasil, desligada × ligada. A diferença está nas casas mais altas das vilas e nas copas; no zoom aberto é sutil.
- `prancha-perto.jpg`: casas desligada × ligada (diferença clara), mata densa e cultivo com celeiro.
- `prancha-terra.jpg`: Terra `auto=50`, desligada × ligada.

## O que fecha e o que não fecha
Fecha: núcleo puro e testado com oráculo independente; independência da ordem, replay e desfazer; opção, `?viva=`/`#viva=` e `#mode=zen` na prévia; orçamento de draw calls, triângulos e montagem; casas, mata e cultivo; celeiro com um pool só; Terra ligada às manchas.

Não fecha:
- **Canal mais largo onde os rios se ligam: não feito.** A largura de cada borda já é herdada da vizinha (`World.widthsAt`); alargá-la por estágio exigiria refazer a emenda de toda a cadeia de rio. Documentado.
- **O celeiro lê mal:** na captura de perto é uma casinha pequena de telhado alaranjado junto ao campo, não um celeiro claro. Falta um desenho próprio (hoje é caixa com telhado de quatro águas nas cores das casas).
- **Fantasma das vizinhas:** só o aviso " · N crescem"; as vizinhas não aparecem crescendo.
- **Terra com mancha fechada:** a captura mostra a paisagem desenvolvida (vários terrenos em estágio 3), mas não isolei uma mancha específica fechando antes e depois; quem confere o efeito das manchas é o teste.
- **Medidas só em software:** FPS, GPU e o pior quadro de uma mancha grande em GPU real não foram medidos; o WebGPU não pôde ser conferido aqui.
- A viva segue desligada por padrão no Clássico, no Desafio do dia e nos outros modos até o Roger decidir.
