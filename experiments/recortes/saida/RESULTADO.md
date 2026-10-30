# Recortes: teste de viabilidade (Fase 1, simulação sem gráficos)

Branch `dorf/c-recortes-teste`, código em `experiments/recortes/` (só Node, o jogo não foi tocado). Desenhos em `scratchpad/recortes/svg/` (SVG e PNG).

**Pergunta:** um quebra-cabeça de retalhos de contorno livre trava a pilha? Dá decisões boas e calmas? Fica bonito no mapa?

**Resposta curta:** não trava quando basta encostar uma aresta, mas aí o mapa vira um arquipélago esgarçado. Quando se exige encaixe justo, trava. Não achei regra de pontuação nem de perdão que dê as duas coisas. Peça por peça é bonito; o mapa não.

## O que foi montado
- **Peças:** polígono em inteiros (lado do hexágono = 1000), 1 a 3 terrenos em trechos, rio opcional (2 ou 3 bocas na costa), 1,0 a 2,0 hexágonos de área. Famílias: **i30** (todas as arestas com 500 de comprimento e ângulo múltiplo de 30°), **i15** (o mesmo com 15°) e **ii** (contorno livre, giro de 15°, encaixe por tolerância de 50 de sobreposição, 60 de distância e 11° de ângulo).
- **Poses:** giro mais deslocamento em que uma aresta da peça fica contra uma aresta livre do mapa (antiparalela), sem sobrepor peça colocada e com rio só contra rio ou mar. Lista cortada em P=48 (testei 24 e 64).
- **Nota de rascunho:** 10 por lado de costa que casa o terreno, 5 por interação, 10 por boca de rio que continua, +20 se o contato é todo igual (1,5 lado ou mais), e bônus de golfo por perímetro que a peça tira do mapa.
- **Jogadores:** guloso e "ao acaso entre as 3 melhores". Partida de 40 peças (~58 hexágonos de terra); o Clássico foi medido com 58 hexágonos, mesmas sementes, mesmas métricas.
- **Conferência:** oráculo à parte em todas as partidas: vértices inteiros, nenhuma sobreposição além da tolerância, rio só com rio. Zero violações nas ~70 mil jogadas do caso base. Nas execuções com ímã tolerante (~20 mil jogadas) achou 9 casos de rio encostando em terra, por causa da tolerância dobrada; não muda as conclusões. Mesma semente dá o mesmo mapa nas duas rodadas.

## Tabela 1: caso base (basta encostar uma aresta, 300 partidas por linha)
| | Clássico | i30 | i15 | ii |
|---|---|---|---|---|
| jogadas sem pose (guloso e ao acaso) | 0% | 0% | 0% | 0% |
| poses por jogada (todas as válidas) | 101 | 281 | 265 | 429 |
| boas jogadas, a até 10% da melhor (poses / lugares) | 4,0 / 1,7 | 5,9 / 3,1 | 7,5 / 4,5 | 2,9 / 2,1 |
| nota perdida ao jogar entre as 3 melhores | 20% | 14% | 14% | 9% |
| ms por jogada, média (p95) | 6 | 12 (27) | 13 (27) | 62 (135) |
| perímetro do mapa / círculo de mesma área, no fim | 1,9 | 4,4 | 4,9 | 4,7 |
| lagoas por partida (mar cercado, 0,05 hex ou mais) | 0,8 | 6,1 | 1,9 | 12,1 |
| fendas (mar mais estreito que 1 lado) % da terra | 0,9 | 7,8 | 10,2 | 5,8 |
| lagoas % da terra | 1,5 | 4,3 | 2,1 | 7,7 |
| hexômetro da costa (1,00 = só 0°, 60°, 120°) | 1,00 | 0,05 | 0,06 | 0,04 |
| rio que continua (peças de rio, guloso) | - | 36% | 28% | 52% |

Tempos: um processo Node, máquina quieta (`bench-tempo.mjs`); no Clássico é o tempo de listar todas as jogadas. A i30 tem um pico de 30° (m12 = 1,00): não lê hexágono, mas lê "facetas".

## Tabela 2: exigir encaixe justo e as regras de perdão (guloso)
Cada célula: % das jogadas sem pose / % das partidas com pelo menos uma jogada sem pose / % das partidas travadas (3 jogadas sem pose seguidas). Perdão = descartar a peça (sempre ligado) + o que a coluna diz.
| contato mínimo | descarte só | + remendo (peça pequena) | + ímã tolerante (e remendo) | + remendo extra por fendas |
|---|---|---|---|---|
| i30, 1 lado (2 arestas) | 1,3 / 21 / 6 | 1,3 / 21 / 5 | 1,1 / 16 / 5 | 1,1 / 16 / 5 |
| i15, 1 lado | 6,2 / 33 / 15 | - | 5,8 / 31 / 15 | - |
| ii, 1 lado | 2,7 / 57 / 5 | 2,9 / 57 / 5 | **0,1 / 3 / 0** | 0,0 / 2 / 0 |
| i30, 1,5 lado (3 arestas) | 90,6 / 100 / 100 | 90,8 / 100 / 100 | 84,7 / 100 / 97 | 84,5 / 100 / 97 |
| ii, 1,5 lado | 95,4 / 100 / 100 | 95,4 / 100 / 100 | 24,1 / 97 / 57 | 24,9 / 99 / 61 |

Ímã tolerante: sobreposição aceita de 100 (i30, i15) ou o dobro das tolerâncias (ii). Remendo: peça de 0,3 a 0,6 hex, 1 terreno. Remendo extra: 1 peça grátis quando o mapa tem 4 ou mais fendas e lagoas (até 8). Jogos: 200 (i30, i15) e 60 a 120 (ii).

## Tabela 3: o que o rigor e a pontuação fazem com o mapa (guloso, fim da partida)
| execução | perímetro / círculo | lagoas | fendas % | partidas sem descarte |
|---|---|---|---|---|
| i30 base (1 aresta) | 4,4 | 6,1 | 7,8 | 100% |
| i30 exigindo 2 arestas | 4,3 | 6,4 | 7,3 | 79% |
| i30 nota que premia o encaixe (+4 por lado que encosta, golfo 16) | 4,3 | 6,9 | 7,1 | 100% |
| ii base | 4,7 | 12,1 | 5,8 | 100% |
| ii exigindo 2 arestas, ímã tolerante | 4,0 | 16,3 | 4,1 | 97% |
| ii exigindo 3 arestas, ímã tolerante (em média 9 das 40 peças descartadas) | 3,3 | 13,4 | 3,0 | 3% |

## Leitura franca
**Trava ou não?**
- Com contato mínimo de meia aresta (uma aresta de 500), não travou em nenhuma das ~70 mil jogadas, nas três famílias. O mar em volta é aberto: sempre há uma costa reta onde uma aresta qualquer encosta.
- O limiar é seco. Exigindo 2 arestas, 21% (i30), 33% (i15) e 57% (ii) das partidas têm ao menos uma peça sem lugar, e 5% a 15% travam de vez. Com 3 arestas o jogo para: 91% a 95% das jogadas ficam sem pose. Nas peças de 30° só há encaixe de 2 arestas onde a costa tem um canto de ângulo certo.
- **Regras de perdão:** descarte sozinho não basta. O remendo quase não muda nada (usado 0,1 vez por partida: ele obedece à mesma regra de contato). O **ímã mais tolerante** é o único que resolve, e só na família livre (57% → 3% das partidas com trava). Na família quantizada a treliça é rígida e quase nada ajuda. O ímã tolerante troca trava por lagoas (6 → 10 na i30, 14 → 16 na ii). Com 3 arestas nem o ímã salva.
- **O bônus de golfo nunca dispara:** o perímetro do mapa cresce em todas as poses. Para tirar perímetro, a peça precisaria encostar em mais da metade do próprio contorno. Esse critério está morto; teria de ser outro (fechar lagoa, estreitar entrada).

**Decisões boas e calmas?**
- Há escolha: 3 a 4,5 lugares bons por jogada na i30 e na i15 contra 1,7 no Clássico; na ii só 2,1. O espalhamento entre a melhor e a mediana é o mesmo do Clássico (0,77). Jogar entre as 3 melhores custa 9% a 14% da nota (Clássico 20%): planejar vale menos, sobretudo na ii.
- Calma é o ponto fraco: de 48 a 430 poses por jogada contra ~3 lugares bons. O jogador precisa de um fantasma que mostre as 3 a 5 melhores e esconda o resto. O Clássico tem ~100 casas por giro e o jogador se vira.
- O tamanho da lista (24, 48 ou 64) não muda o mapa nem a nota dos jogadores simples. Só muda quantas opções aparecem e quase não muda o tempo.

**O mapa fica bonito?**
- **Peça por peça, sim** (`svg/pecas-*.svg`): bordas orgânicas, rio que sai pela costa, nada de hexágono (hexômetro 0,05; só 1,9% das peças i30 usam só direções a 60°).
- **O mapa, não.** Perímetro 4,4 a 4,9 vezes o de um círculo (Clássico 1,9), 6 a 12 lagoas por partida (Clássico 0,8), fendas de 6% a 10% da terra (Clássico 0,9%), e isso já aparece com 10 peças. Cada peça encosta no mapa em 1 a 1,4 lado de costa, contra 2,3 no hexágono: a grade obriga a vizinhança, o plano livre não. Os mapas leem como arquipélago de seixos (`svg/comparacao.png`, `svg/mapa-*-limpo.png`).
- A nota não corrige isso (Tabela 3): premiar o encaixe justo não compacta o mapa, porque faltam poses de encaixe justo para escolher. Só exigir 3 arestas compacta, e aí o jogo trava e descarta 1 peça em cada 3.
- A ii (seixos redondos) é a mais "orgânica" e a que mais deixa lagoas e buracos pequenos. A i30 é a mais fiel ao jogo (uma aresta casa exato, sem tolerância), mas tem facetas de 30° e aparecem hexágonos de vez em quando.

## Custo para levar ao jogo de verdade
Estimativa minha, por leitura do código, não medida:
- núcleo em `src/core` (geometria inteira, peças, poses, pontuação, replay, save v14, oráculos novos): 4 a 5 semanas;
- render (chão de polígono livre no lugar dos blocos 8x8, costura de cor, relevo por ponto, rios com bocas, decoração por polígono, costa): 5 a 7 semanas;
- clique como arrasto com ímã, fantasma das melhores poses, "Onde encaixa", minimapa: 3 a 4 semanas;
- religar missões, sítios, eras, maravilha, peças especiais, rotas e desfazer: 3 a 4 semanas;
- desempenho: 12 ms (i30) e 62 ms (ii) por jogada no PC, o que pode ser 3 a 6 vezes pior no celular. Pede worker e candidatos incrementais: 1 a 2 semanas;
- equilíbrio, testes e capturas: 2 a 3 semanas.
Total: **18 a 25 semanas** para chegar ao que o Clássico tem; um protótipo jogável enxuto (núcleo, render mínimo, fantasma, sem missões e eras) em 8 a 10 semanas. O "um mês ou mais" do cartão está curto.

## Vale o projeto?
**Não como próximo projeto.** O teste não achou o risco que o plano temia (a pilha travar com encaixe fácil); achou outro, que o plano não via: o plano livre não obriga vizinhança, e o mapa esgarça. O que seguraria o mapa (exigir encaixe justo) é justamente o que trava.

Eu só abriria um protótipo jogável de 2 a 3 semanas se **todas** estas condições valerem:
1. o Roger jogar a prévia do Terra contínua e ainda disser "é hexágono", ou seja, o visual escondido não bastou;
2. aparecer uma regra nova que segure o mapa sem travar (ex.: a costa preencher sozinha fendas de menos de 1 lado, ou uma peça "remendo" que obedeça a outra regra de contato que não seja a da peça comum) e ela passar na bancada com metas escritas: **perímetro/círculo até 2,5, lagoas até 2 por partida, fendas até 3% da terra, partidas com trava até 5% sem perdão manual, até 30 ms por jogada no celular**;
3. a família escolhida for a i30 com ímã tolerante, ou a ii com contorno que encaixa melhor (menos redondo). Os seixos redondos da ii são os que mais deixam buraco.
Sem isso, o plano B das Fatias (grade de triângulos) segue sendo o caminho mais seguro: a grade força vizinhança como a do hexágono, que é o que faltou aos Recortes (isso eu não testei).

## Limites do teste
- Só dois jogadores simples. Um jogador que planeja e enche baías de propósito pode compactar mais; a bancada dos modos novos (planejador) não entrou aqui.
- A nota é um rascunho; o resto do jogo (missões, eras, relevo, água física) não entrou. Ninguém jogou: "bonito" e "calmo" são leitura dos desenhos e de proxies.
- Tamanhos de amostra: base 300 partidas por linha; rigor e perdão 200 (i30, i15) e 60 a 120 (ii); nota que premia encaixe 200 e 60; todas as poses 50 e 20; tamanho da lista 100 e 40. A família ii custa ~5 vezes mais por jogada.
- Fendas e lagoas vêm de rasterização (célula 100, régua de 500) e valem igual para os dois lados da comparação. Tempos em Node numa VM, uma thread.
- Reproduzir: `node experiments/recortes/run-all.mjs <pasta>` (bateria), `tabela.mjs`, `bench-tempo.mjs`, `hexometro.mjs`, `desenhos.mjs`, `svg2png.sh`; linha de base: `baseline.ts` (ver o cabeçalho).
