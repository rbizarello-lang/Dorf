# Entrepostos 0.2 · plano de revisão em dez pontos

**17 de novembro de 2026.** Revisão do HTML jogável da pasta Retalhos-Entrepostos-Fretes. A próxima versão deve ajudar quem joga a decidir, no próprio mapa, qual cais alcançar, o que a próxima peça vai liberar e se vale esperar pela próxima carga. A revisão começa pelas situações em que a interface oculta o custo ou o resultado dessas decisões.

## O que foi verificado

| Ensaio | Resultado |
|---|---|
| Partida pela interface | Chrome headless, WebGPU, RTX 3060, Holanda Dourada, semente 42. A viagem com madeira terminou em 14 jogadas. Na quinta, a prévia anunciou 6 peças e o jogo creditou 16, sendo 6 da Serraria e 10 da Feira. O roteiro de interface, as duas orientações móveis e a primeira rodada de carga encerraram sem erros registrados no console ou na página. |
| Duas estratégias de jogo | Nas sementes 1 a 128, o roteiro que reserva os três corredores venceu os dois contratos com jogadas idênticas, em 11 a 17 turnos. A madeira rendeu exatamente 120 pontos a mais em todos. Entre ligar a Feira e receber a madeira passaram de três a seis jogadas. A menor pilha antes do pagamento, por partida, variou de 17 a 20 peças. Em outro ensaio, a IA que prioriza encaixes jogou o frete direto nas sementes 1 a 36. Terminou com zero cais em 21 partidas, um em 11, dois em quatro e três em nenhuma. São comportamentos de estratégias programadas. |
| Interface móvel e teclado | Em 390 × 844, as etiquetas dos cais tinham 10 px e “Ver mapa” tinha 24 px de altura. Em 667 × 375, a carta ocupava aproximadamente 268 × 237 px e encobria o Estaleiro. O problema apareceu ao girar a tela e também ao abrir diretamente em paisagem. No diálogo do frete, o terceiro Tab a partir da primeira opção saiu do diálogo. A referência que deveria fornecer seu nome acessível não encontrava um título. |
| Mudança de qualidade | Na transição manual de Alta para Média, medi o tempo síncrono dentro do acionamento do botão. Em duas execuções com 11 peças, foram 85 e 91 ms. Com 301 peças, foram 583 e 834 ms. Até o segundo callback de animação após o acionamento, o intervalo total ficou em 1,32–1,38 s e 2,73–2,76 s, respectivamente. Essa segunda medida inclui outras etapas do navegador. O ensaio não isola compilação de shader nem mede o instante físico de apresentação. |
| Desenho contínuo | Chrome, RTX 3060, WebGPU, 1280 × 800, qualidade Alta, Clássico, Vale, semente 42, 301 peças e 50.536 instâncias. Duas rodadas por câmera, com 90 quadros de aquecimento e 180 intervalos de `requestAnimationFrame` medidos por rodada. No zoom 8, os p95 foram 66,7 e 16,8 ms. No zoom 28, 16,8 e 50,2 ms. As medianas ficaram entre 16,7 e 16,8 ms. A instrumentação da segunda rodada contou 181 leituras do retângulo da prévia em cada janela, incluindo o quadro inicial. A dispersão pede mais repetições antes de atribuir diferenças ao zoom. |

As verificações usaram o pacote 0.2.0 e o HTML com SHA-256 `80B25876EB962DD02C6408E2501CB5CBB61C17F60CA26A8D3404D2D518D8EA44`. O TypeScript passou nesta revisão. A validação anterior de 600 partidas e 6.600 replays parciais está documentada na edição. O teste móvel atual foi emulado no computador. Falta observar pessoas jogando e medir um telefone físico. [Validação anterior da 0.2](MOTORES_E_FRETE.md)

## As dez prioridades

### 1. Mostrar tudo que uma peça vai entregar

Na quinta jogada da semente 42, a pessoa que confia na prévia espera receber 6 peças e vê a pilha receber 16. Outra situação importante é fechar a ligação por uma peça intermediária, longe dos dois cais. Hoje a mensagem procura o cais sob o ponteiro, enquanto o motor liquida todas as entregas que se tornaram possíveis.

**Mudança.** Derivar a prévia e a confirmação da mesma regra pura de conexão e pagamento. Para o exemplo, mostrar “Serraria +6 · Feira +10” junto à peça ou à carta. Mostrar o saldo líquido da pilha separadamente, caso ele seja exibido, pois a jogada também consome uma peça. **Aceite.** A prévia deve acertar os destinos e os suprimentos no frete direto, na espera por madeira, na entrega dupla, na ligação remota e ao desfazer. Consultar seis rotações precisa preservar semente, pilha e save. Conferir o resultado com um oráculo independente. [Sid Meier sobre decisão e informação ao jogador](https://www.gdcvault.com/play/1015756/)

### 2. Enquadrar o mapa na área que sobra ao redor da interface

Em paisagem, a carta permanece legível, mas cobre justamente um dos destinos que ajuda a encontrar. O reenquadramento atual considera o tamanho da janela. Ao girar o aparelho, o jogo redimensiona o desenho e conserva a câmera anterior. [Captura da abertura em 667 × 375](screens/revisao-fretes-paisagem.png)

**Mudança.** Em telas baixas, começar com uma faixa recolhível que mostre objetivo, progresso e acesso aos três cais. Fazer “Ver mapa” usar a área livre entre carta, placar e pilha. Ao mudar de orientação, recalcular a vista geral se o jogador estiver nela. Preservar o ponto de interesse se estiver inspecionando um cais. **Aceite.** Abrir e girar em 390 × 844 e 667 × 375, além de jogar em 1280 × 800. Os três destinos devem ficar reconhecíveis na vista geral, o hexágono em foco deve aceitar o toque e a carta deve abrir com uma ação. Adotar 44 × 44 px como alvo de projeto para os controles principais. [W3C sobre alvos de toque](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)

### 3. Remover a pausa ao trocar a qualidade gráfica

A redução de qualidade é um recurso de recuperação do modo Auto. Hoje, quando muda a densidade de decoração, `World.setQuality` pode reconstruir o tabuleiro inteiro. `World.rebuild` também limpa as barcas em movimento e o acompanhamento da câmera. A pausa já apareceu com 11 peças, e o custo síncrono cresceu nos mapas de 301.

**Mudança.** Medir separadamente reconstrução das peças, troca de sombras e criação dos passes. Aplicar de imediato os ajustes baratos. Dividir em lotes o trabalho de decoração que precisar ser refeito, mantendo os canais, a seleção e a barca ativos. **Aceite.** Como meta inicial para a máquina medida, nenhuma tarefa síncrona superior a 50 ms durante a transição Alta → Média com 301 peças, em cinco repetições aquecidas. Registrar também a primeira troca a frio e o maior intervalo entre quadros. Durante a troca, girar uma peça e assistir a uma entrega em curso. O comando deve ser aceito uma única vez e a barca deve chegar ao destino. [Chrome sobre tarefas longas](https://web.dev/articles/optimize-long-tasks)

### 4. Completar uma viagem usando apenas o teclado

As setas hoje movem a câmera, e R gira a peça. A seleção do hexágono depende do ponteiro ou do toque. O diálogo de frete recebe foco inicial, mas Tab alcança a interface de fundo e o título acessível fica sem correspondência.

**Mudança.** Oferecer um cursor de tabuleiro com posição, giro, validade e consequência anunciáveis. Uma opção é navegar entre casas da fronteira, confirmar com Enter e manter o movimento de câmera em WASD. Prender o foco no diálogo, dar-lhe um nome e devolver o foco ao controle que o abriu ou ao tabuleiro quando esse controle desaparecer. **Aceite.** Escolher o contrato, localizar um cais, colocar, desfazer e encerrar a semente 42 com teclado. Tab e Shift+Tab devem circular pelas opções do diálogo. Testar os anúncios com leitor de tela, inclusive uma tentativa inválida. [Xbox sobre métodos de entrada](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107) · [W3C sobre diálogos modais](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

### 5. Fazer o contrato mudar a estratégia e a leitura do recorde

Nos 128 pares testados, o mesmo percurso levou aos mesmos três cais. As seis peças adicionais do contrato valeram 120 pontos no fim. O recorde está agrupado por modo e tema. É possível bater a própria marca repetindo o percurso e trocando apenas o contrato. Ainda é plausível que jogadores iniciantes valorizem o abastecimento imediato.

**Mudança.** Prototipar uma encomenda que pague as dez peças quando o rio alcançar a Serraria antes da Feira ou na mesma jogada. Se a Feira for ligada primeiro, o pagamento ao completar o frete cai para quatro. A carta deve antecipar essa consequência. Conservar a entrega direta para quem prefere repor o estoque cedo e identificar o contrato no recorde. Preservar como históricas as marcas antigas cujo contrato é desconhecido. **Aceite.** Comparar estratégias que priorizam Feira, Serraria ou Estaleiro nas mesmas sementes. A decisão deve alterar a melhor ordem em parte dos mapas. Nos testes com pessoas, pedir que expliquem o motivo da escolha antes de revelar o resultado. Versionar mudanças de regras para que partidas v10/v11 continuem interpretáveis. [Sid Meier sobre escolhas e suas consequências](https://www.gdcvault.com/play/1015756/)

### 6. Ensinar a navegação nas primeiras duas peças e explicá-la no placar

Quem vem de um puzzle de encaixe já sabe procurar bordas iguais. Entrepostos pede que acompanhe uma rede. A diferença aparece no ensaio das duas estratégias. Na primeira partida, a carta dá a instrução em texto. No fim de uma vitória fluvial, o placar ainda diz “0 de 0 sítios” e apresenta desbloqueios de missões desativadas nesse modo.

**Mudança.** Oferecer uma primeira entrega guiada e pulável. Mostrar a boca de rio da vila, deixar a pessoa girar a peça e só revelar outra pista depois de uma tentativa. No placar, reconstruir a viagem com a ordem dos cais, o que cada um pagou e o bônus da pilha restante. **Aceite.** Numa rodada formativa com cinco jogadores novos, buscar que pelo menos quatro abram a Feira e expliquem a espera pela Serraria sem intervenção do observador. Registrar onde procuraram ajuda, quais termos confundiram e em qual turno houve o primeiro erro de conexão. Essa amostra serve para descobrir dificuldades de uso. [Game Accessibility Guidelines sobre ensino interativo](https://gameaccessibilityguidelines.com/include-interactive-tutorials/)

### 7. Variar a geografia dos fretes

A semente orienta o mapa, mas os cais sempre ocupam três raios alternados, a duas, três e quatro casas da vila. Nas 128 sementes apareceram as seis rotações dessa disposição. O baralho muda, e a estratégia de reservar três retas continuou suficiente em todas as viagens dirigidas.

**Mudança.** Conservar a confluência para aprender e prototipar duas disposições adicionais. Em uma, dois cais compartilham um trecho e o jogador decide onde bifurcar. Em outra, alcançar primeiro um cais lateral muda o acesso ao terceiro. **Aceite.** Gerar ao menos 100 sementes por disposição. Registrar rotas viáveis, quantidade de tronco compartilhado, ordens de entrega, duração e menor estoque. O roteiro automatizado deve encontrar solução em cada semente aprovada para o catálogo inicial. Comparar os mapas após normalizar rotação e verificar em partidas observadas se as decisões também mudam. [Smith e Whitehead sobre avaliação de geradores de níveis](https://www.pcgworkshop.com/archive/smith2010analyzing.pdf)

### 8. Dar uma linguagem visual à espera, à conexão e à entrega

Os três cais já têm boas silhuetas, números e cargas. Na vista geral, parte da informação decisiva fica em etiquetas de 10–11 px. Na entrega dupla, os dois destinos mudam para concluído, mas o trajeto da madeira é pequeno nessa escala. “Rever a travessia” aproxima a câmera diretamente até a distância 4,5. A preferência por movimento reduzido já atua no CSS e em parte do HUD. [Barca vista de perto](screens/frete.png) · [Carta fluvial à noite](screens/frete-noite.png)

**Mudança.** Desenhar na Feira um sinal de carga reservada e indicar por um instante o canal efetivamente percorrido quando a madeira parte. Combinar forma, ícone e texto curto. Diferenciar o rumo pontilhado sobre o pergaminho de um canal realmente navegável. Oferecer a travessia com câmera fixa e reduzir deslocamentos automáticos quando a pessoa preferir movimento reduzido. **Aceite.** Identificar os três estados em zoom geral e próximo, de dia e à noite, em três temas de paletas distintas. Repetir em escala de cinza, com áudio desligado e movimento reduzido. A foto e o vídeo devem reproduzir a rota com o relógio do mundo. [Xbox sobre sinais por múltiplos canais](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/103) · [Xbox sobre câmera e movimento](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117)

### 9. Medir a fluidez da partida inteira, incluindo a pilha

O contador de desenho em `World.stats` consulta o renderizador principal. A peça da vez tem outro renderizador, mede o retângulo do seu contêiner e desenha durante os quadros de jogo. Medi a repetição dessas leituras. Falta isolar seu impacto no tempo de quadro. Também houve variação grande de p95 entre rodadas com a mesma câmera.

**Mudança.** Instrumentar separadamente mundo, prévia, pós-processamento e entrada. Testar guardar as dimensões da prévia com `ResizeObserver` e baixar a frequência somente quando a pilha estiver em repouso. Rodar controle e variante em ordem alternada, com câmera parada, rotação e colocação de peça. **Aceite.** Publicar mediana, p95, maior intervalo, longas tarefas e custo de ambos os renderizadores em cinco repetições por cenário, com uma viagem curta e com 301 peças. Conservar o primeiro quadro de giro responsivo, a câmera de foto e o vídeo a 60 quadros simulados por segundo. A meta inicial é p95 de até 33,3 ms por quadro em Alta na RTX 3060. Medir também um telefone físico antes de definir seu perfil padrão. [Chrome DevTools sobre análise de quadros](https://developer.chrome.com/docs/devtools/performance/reference)

### 10. Desenhar menos vegetação fora da câmera sem empobrecer o panorama

O chão já está dividido em blocos. As decorações repetidas usam conjuntos de instâncias por kit, com descarte por campo de visão desativado nessa malha. Na câmera próxima do cenário de carga, o renderizador principal informou aproximadamente 1,71 milhão de triângulos e 147 chamadas. Na distante, 1,29 milhão e 135. Esses números incluem os passes do renderizador. A hipótese é que parte do trabalho desapareça ao agrupar a vegetação densa por região.

**Mudança.** Experimentar primeiro com os kits que concentram mais triângulos. Dar a cada região um volume conservador que inclua o balanço das árvores e a projeção das sombras. Comparar dois tamanhos de região com a implementação atual nos dois backends. **Aceite.** Meta experimental de pelo menos 20% menos triângulos no zoom próximo, com melhora repetível do p95 ou do tempo de GPU nessa câmera. Aceitar até 5% de piora no p95 panorâmico e verificar sombra, vento e transições de detalhe em movimento. Expandir para outros kits apenas se o ganho compensar as chamadas extras. [Three.js sobre instâncias e volumes de visibilidade](https://threejs.org/docs/pages/InstancedMesh.html)

## Sequência de trabalho

**Na primeira rodada**, corrigir a prévia e o enquadramento móvel, completar a navegação por teclado e instrumentar a troca de qualidade. A partir dessas medições, tratar a pausa registrada no ponto 3. **Na segunda**, observar novatos no ponto 6 e comparar protótipos de contrato e geografia com as mesmas sementes. **Na terceira**, consolidar os sinais visuais e selecionar as otimizações de renderização que mostrarem ganho repetível.

A circulação fluvial continua sendo o eixo da edição. Também há espaço para otimizar a reconstrução dos grupos lógicos, hoje feita a cada jogada. Num microteste Node com tabuleiros sintéticos de prado, o p95 isolado dessa rotina foi de 0,007 ms com 15 peças, 0,091 ms com 301 e 0,372 ms com mil. Isso dá prioridade à pausa observada na troca de qualidade. Reavaliaria os grupos se um perfil de uma partida real mostrar que passaram a consumir o orçamento da jogada.
