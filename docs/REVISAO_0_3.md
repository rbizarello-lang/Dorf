# Entrepostos 0.3 · Cartas fluviais e paisagem viva

Esta edição reúne a revisão de dez pontos e o protótipo de desenvolvimento das peças sugerido durante a execução. O projeto foi preparado em uma cópia independente. O HTML contém o jogo completo.

## O que mudou

| Ponto | Implementação |
|---|---|
| 1. Prévia das entregas | Consulta pura do canal virtual, usada também ao pagar as cargas. Exibe entregas remotas e simultâneas. |
| 2. Enquadramento | Projeta os três cais no maior retângulo livre do HUD. Carta recolhível, nova composição móvel e alvos principais de 44 px. |
| 3. Qualidade | Densidade organizada por faixas contíguas de instâncias. Trocar o nível ajusta a quantidade exibida e conserva a travessia em curso. |
| 4. Teclado | Setas percorrem a fronteira, R gira e Enter coloca. Anúncios de coordenadas, validade e efeitos. Diálogos com foco contido, título e fundo inerte. |
| 5. Contrato | A encomenda de madeira paga dez peças se a Serraria abrir primeiro ou simultaneamente. Abrir a Feira antes rende quatro ao completar a ligação. Recordes por carta, contrato e regras legadas. |
| 6. Aprendizagem | Primeira entrega guiada e pulável. Resumo da viagem com turnos, cargas e bônus da pilha. |
| 7. Geografia | Confluência, Rio bifurcado e Cais da enseada. Rotas com zero, três e duas casas de tronco compartilhado, respectivamente. |
| 8. Sinais visuais | Reserva de carga representada no cais e na etiqueta, linha da rota sobre a água, câmera fixa e preferência por movimento reduzido. |
| 9. Instrumentação | Contadores do mundo, entrada, submissão da cena, pós e segundo renderizador. Dimensões da pilha por ResizeObserver e repouso a até 12 desenhos por segundo. |
| 10. Descarte regional | Experimentos com vegetação em regiões de quatro e oito casas e volumes conservadores. Seleção do padrão orientada pelas medições. |

## Peças que se desenvolvem

Cada peça conta seus encaixes externos por terreno. Um, dois e três encaixes produzem estágios sucessivos. O cálculo é refeito para a peça colocada e as vizinhas afetadas. A origem da evolução permanece legível no tabuleiro e é reconstruída ao carregar a partida.

A vila aumenta a altura das casas. A mata ganha copas adicionais e árvores mais altas. Os cultivos crescem e ganham celeiro e cercado. Rios conectados alargam as duas bocas da fronteira pelo mesmo fator e os lagos ganham área. O primeiro protótipo usa a evolução como consequência visual da decisão e informa seu progresso no resumo da viagem.

O modo Entrepostos oferece a opção **Paisagem viva** ao preparar a viagem. O modo Zen permite explorar esse desenvolvimento sem limite de peças. As peças assentadas ficam agrupadas por região, e somente regiões afetadas pelo desenvolvimento são reconstruídas. A densidade gráfica continua selecionável sem refazer a paisagem.

A referência visual enviada orientou o tema **Costa dos Terraços**, composto com os kits procedurais do projeto. Foram incorporados terracota, fachadas claras, copas sobrepostas, ciprestes, oliveiras, vinhedos, luz quente e sombras azuladas. O tema passou pelo teste de contraste de telhados, paredes e terrenos.

## Compatibilidade

Os saves v10 e v11 são interpretados com a Confluência e suas regras de pagamento originais. A versão v12 registra carta e contrato. O espaço `entrepostos.cartas.` recebe uma cópia inicial dos dados anteriores disponíveis na mesma origem. Repetir a semente conserva as peças especiais da viagem repetida.

## Verificação

A tabela final de execução, as capturas e as medições acompanham esta entrega. Os ensaios de soluções são roteiros automatizados. A rodada formativa com cinco pessoas, a medição em telefone físico e a escuta dos anúncios em leitor de tela dependem dessas sessões adicionais.

O controle de foco segue o padrão de diálogo modal do W3C. As dimensões da pilha são atualizadas quando o contêiner muda. Os volumes dos conjuntos instanciados acompanham suas instâncias. [Diálogos modais](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) · [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) · [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)

## Ferramentas

Foram usados a skill `threejs-performance`, TypeScript, Three.js r186, Playwright e o Chrome com a GPU identificada como RTX 3060. A cópia inclui os scripts do MCP de inspeção já adotado na edição anterior em `tools/inspecao`.


## Continuidade de produto

Na próxima observação, manter câmera, luz e semente fixas e apresentar a mesma peça antes do encaixe e nos três estágios. Antes de confirmar a jogada, pedir à pessoa que indique qual vizinha mudará e o que espera ver. Registrar a previsão e a primeira alteração que ela percebe. Repetir depois de desfazer e ao retomar o save. Se a mata ou o campo parecerem apenas mais altos, experimentar silhuetas e espaçamentos mais distintos e repetir o teste no mesmo enquadramento. Novos efeitos sobre pontos, estoque ou missões dependem de uma comparação de jogo que demonstre benefício além da evolução visual.

A Costa dos Terraços traduz a referência de Èze para uma maquete 3D procedural. O conjunto combina pedra clara, telhados em terracota e massas verdes verticais. O relevo e a densidade que cada mapa exibe dependem da semente e das peças escolhidas. A aquarela orienta a composição e a paleta.

Na sessão formativa, convidar cinco pessoas que ainda não conheçam Entrepostos. Observar a escolha do contrato, a primeira entrega sem ajuda, a explicação da espera pela Serraria e o primeiro erro. Registrar em que turno e com qual carta ocorreu. O critério inicial é que quatro das cinco pessoas abram a Feira e expliquem a espera. Em telefone físico, verificar as duas orientações, o toque no hexágono, o espaço dos três destinos e o tempo de quadro após aquecimento. Conferir os anúncios de giro, jogada inválida, entrega e fechamento de diálogo com leitor de tela.

## Evidência dos dez pontos

| Ponto | O que a verificação cobre |
|---|---|
| 1 | As seis rotações preservaram pilha, peça, cais e pontuação nas viagens testadas. O oráculo comparou a previsão e o pagamento por destino nos roteiros de madeira. Cenários dirigidos cobriram ligação remota e entrega dupla. |
| 2 | Ao girar para 667 × 375, o ensaio encontrou dois destinos encostando no HUD. O enquadramento passou a testar outras áreas livres e a carta em paisagem ficou mais compacta. O candidato final manteve os três rótulos livres aos 500 ms, aos três segundos e depois de “Ver mapa”; as duas bordas antes sobrepostas ganharam 12 e 14 px de folga. A validação de toque e orientação em aparelho físico segue pendente. |
| 3 | No protótipo de infraestrutura, a mediana da troca aquecida com 301 peças caiu de 556,1 para 2,9 ms. Na primeira troca, o maior intervalo entre quadros chegou a 4,05 s. O orçamento por tarefa do jogo final com Paisagem viva requer nova medição. |
| 4 | No build `CF813232`, o teste de teclado encerrou as três cartas em 14, 14 e 11 jogadas e retomou uma viagem v11 em 14. Também verificou foco modal, rejeição de jogada inválida, desfazer e continuidade da barca ao trocar de qualidade. A sessão com leitor de tela é necessária para avaliar se o anúncio orienta uma jogada real. |
| 5 | O prêmio mudou conforme a ordem de conexão. Entre as estratégias concluídas, a ordem premium ocorreu 99 vezes na Confluência, 89 no Rio bifurcado e 200 na Enseada. Os roteiros solicitaram três ordens por semente. |
| 6 | A missão inicial é pulável e o placar expõe a sequência de entregas. A meta de compreensão por quatro de cinco iniciantes depende da rodada formativa. |
| 7 | O roteiro completou 100 de 100 sementes em cada carta. Intervalos de 11–17, 10–17 e 10–11 jogadas, respectivamente. As menores pilhas observadas nas soluções foram 16, 13 e 16 peças. |
| 8 | Os estados da carga usam sinais no mapa, texto e rota. Reconhecimento por pessoas em escala de cinza e reprodução da rota no vídeo precisam de evidência própria. |
| 9 | O roteiro registrou cinco janelas aquecidas por condição e uma fria. Há medidas distintas para cadência, submissão de CPU e desenho da pilha. Os dados comparativos correspondem ao snapshot de infraestrutura arquivado. |
| 10 | No WebGPU da RTX 3060, zoom 8, o agrupamento global usou 148 chamadas e 5,49 ms de submissão. As regiões 4 × 4 usaram 322 chamadas e 12,28 ms. Os grupos globais ficaram como padrão da vegetação comum. As regiões da Paisagem viva permitem substituir geometria durante o jogo. A comparação regional em WebGL2 ficou incompleta. |

[Testes jogáveis, fotos da evolução e versões testadas](QA_JOGAVEL_0_3.md) · [Desempenho, limites do ensaio e dados brutos](DESEMPENHO_0_3.md) · [Direção de arte](DIRECAO_DE_ARTE.md)

A suíte completa passou com 600 partidas, 600 replays completos, 6.600 replays parciais e 120 continuações verificadas. Os testes de geometria procedural reproduziram os três estágios de mata, campo e vila usando a mesma semente. Uma peça construída com a aparência anterior e assentada depois de outro encaixe foi corrigida uma vez. A atualização local visitou apenas as casas indicadas. Um ensaio adicional no cálculo de largura usou quatro peças de rio com rotações diferentes. As duas bocas de cada junção tiveram a mesma largura em cada estágio e as larguras se repetiram ao reconstruir a sequência.

O HTML distribuído tem um script e uma folha de estilos embutidos. O analisador de HTML encontrou zero dependências externas em atributos de recurso. A instalação limpa das 33 dependências opcionais e obrigatórias resolvidas para esta máquina passou com o arquivo de lock e o cache npm local. O TypeScript passou nessa instalação e o Vite reproduziu byte a byte o HTML publicado, com SHA-256 `1FBF41C1FE9EB86A80BA340401F594F4763B1DD172D6DCA5031975DCD1AFDD90`. O jogo abre diretamente por `dist/index.html`.

No HTML publicado, os roteiros de desktop concluíram os contratos Entrega direta e Madeira para a Feira em 14 jogadas e 715 pontos cada. Com toque emulado em WebGL2, foi possível girar e colocar uma peça. Os três cais permaneceram livres do HUD em retrato (390 × 844) e em paisagem (667 × 375). O teste de fumaça abriu o arquivo local e verificou 13 peças em WebGPU e 13 em WebGL2, sem erros do navegador. [Resultados e condições de cada ensaio](QA_JOGAVEL_0_3.md)

### Custo da paisagem no build 1C25A37F

Na cena Zen com 37 peças, qualidade Alta e RTX 3060, ativar Paisagem viva elevou as chamadas de desenho de 104 para 190 (+83%) e os triângulos de 229.681 para 252.092 (+9,8%). O p95 dos intervalos entre quadros foi de 17,0 ms com a opção desligada e 16,8 ms com ela ligada, na cadência de 60 Hz. A vantagem das regiões é permitir que uma vizinha já assentada seja redesenhada quando evolui. Uma colocação consulta até 19 posições, incluindo as bocas de rio no segundo anel, e remonta as regiões cuja assinatura mudou.

Antes de recomendar a opção em telefone ou em Zen de longa duração, medir o custo das reconstruções em mapas de 300 e 1.000 peças no aparelho alvo. Registrar tamanho da vizinhança, regiões reconstruídas, tempo de submissão, chamadas e maior intervalo entre quadros. Comparar as alternativas de manter as decorações imóveis nos grupos globais ou reuni-las em regiões maiores, preservando a evolução das casas que mudaram. A opção entrega crescimento visual e deixa a economia da partida sob as regras de frete. A travada de até 4,05 s na primeira troca de qualidade continua em aberto.
