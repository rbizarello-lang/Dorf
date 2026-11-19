# Entrepostos · Cartas fluviais (0.3)

Abra **dist/index.html** no Chrome ou Edge. O jogo roda em um único arquivo, inclusive sem servidor. Na tela inicial, abra **Escolher frete**, selecione a carta e confirme o contrato. Em telas pequenas, o botão **0/3 cais** abre a carta. As setas percorrem as casas livres, **R** gira e **Enter** coloca. **WASD** move a câmera, **U** desfaz e **Ver mapa** enquadra os três cais.

| Carta | Como jogar |
|---|---|
| Confluência | Três braços saem da vila. **Guiar primeira entrega** marca as duas casas até a Feira. Use **Pular guia** para seguir por conta própria. |
| Rio bifurcado | A Feira e a Serraria ficam além de um trecho comum. Reserve espaço para a bifurcação e decida qual ramal abrir primeiro. |
| Cais da enseada | A Serraria fica perto e o Estaleiro está além da curva. A Feira fica no outro braço. |

**Entrega direta** repõe quatro peças quando a Feira abre. Em **Madeira para a Feira**, a Serraria paga seis. Se ela abrir antes da Feira ou no mesmo turno, a Feira paga dez. Se abrir depois, a Feira aguarda a ligação e paga quatro. A prévia informa quais cais a jogada vai abastecer. O placar final registra os turnos de ligação e de pagamento, a reposição e o bônus de estoque. Cada carta e contrato têm seu próprio recorde.

A linha sobre a água mostra a rota da carga. **Rever a travessia** acompanha a barca. **Câmera fixa na travessia** conserva o enquadramento e vem selecionada quando o sistema pede movimento reduzido.

A 0.3 grava suas partidas em `entrepostos.cartas.` no navegador. Na primeira abertura, copia o progresso anterior disponível na mesma origem. Uma viagem de madeira salva pela 0.2 continua com o prêmio antigo. Ao abrir arquivos em pastas diferentes, o navegador pode lhes atribuir armazenamentos separados.

[Revisão e medições da edição 0.3](docs/REVISAO_0_3.md) · [Plano de dez pontos](docs/PLANO_REVISAO_FRETES_0_2.md) · [Pesquisa de motores da 0.2](docs/MOTORES_E_FRETE.md)

## Paisagem viva e Costa dos Terraços

A edição abre com o tema **Costa dos Terraços**, inspirado na referência visual fornecida, com fachadas claras, telhas de terracota, ciprestes, oliveiras, carvalhos e vinhedos.

**Paisagem viva** vem selecionada na preparação da viagem e também atua no modo **Zen**. Cada terreno pode desenvolver três estágios conforme aumenta seu número de bordas encaixadas com o mesmo terreno. A peça nova e as vizinhas recebem o desenvolvimento. As casas crescem em altura, a mata ganha copas e densidade, o cultivo aumenta e recebe um celeiro, e os canais conectados ficam mais largos. A prévia indica o desenvolvimento esperado. Para construir uma cidade sem limite de peças, abra **Nova → Zen**.

O desenvolvimento é derivado do tabuleiro salvo. Suas recompensas atuais são o crescimento visual e o registro no resumo da viagem. As regras de frete e de pontuação continuam descritas abaixo.

## A viagem

A vila começa na confluência de três canais. Você tem **24 peças para abrir uma rota de água até três cais**. A carta no canto mostra o que cada um precisa. Clique no nome do cais para aproximar a câmera. “Ver mapa” reenquadra a região. O tracejado no pergaminho indica a direção do destino. Seu rio pode fazer curvas e chegar por qualquer lado.

| Cais | Entrega | Retorno à pilha |
|---|---|---|
| Feira | Grãos | 4 peças |
| Serraria | Madeira | 6 peças |
| Estaleiro | Ferragens | 8 peças |

Gire a primeira peça e prolongue uma das bocas do rio da vila. As duas primeiras peças são retas. Na Confluência, elas permitem fazer a primeira entrega na Feira em duas jogadas. Em uma partida nova, a semente muda a orientação do mapa, das peças e a paisagem que as acompanha.

Um cais aceita uma peça com rio. Se você construir um trecho isolado, pode ligá-lo à vila por uma jogada posterior. Quando o caminho se completa, o cais exibe a carga e uma embarcação percorre a ligação. O crédito entra quando o caminho e o contrato estiverem completos. A terceira entrega encerra a viagem e cada peça restante vale 20 pontos. A pilha também pode acabar com cais por atender.

**Controles.** Clique para colocar, use R para girar e arraste para mover a câmera. No toque, selecione a casa e confirme com ✓ ou com um segundo toque. A partida permite cinco desfazeres. O menu Nova oferece também Clássico, Zen, Exploradores e Desafio do dia. Os 14 temas, a fotografia e a exportação de vídeo continuam disponíveis.

## Avaliação e decisões desta edição

A base examinada foi a branch `rotas-visuais`, commit `d22626c`. O original tem uma boa solução para um problema difícil de jogos de peças. A mesma semente reconstrói as jogadas, enquanto a aparência de uma peça acompanha o giro da prévia até o mapa. Isso permitiu experimentar com as regras e ainda conferir a partida por replay.

A sobreposição com Dorfromantik aparece no primeiro turno. O jogador gira um hexágono para combinar bordas, cumprir missões e estender a paisagem. No Retalhos original, uma carroça já podia parar para comerciar, mas esperar ou prolongar aquela viagem não fazia a entrega entrar nas regras. Aqui o jogador pode deixar de lado um encaixe mais lucrativo para abrir a passagem que abastece uma vila. O resultado que se procura no mapa também determina quando a partida termina. [Descrição de Dorfromantik pela Toukana](https://www.toukana.com/dorfromantik)

| Componente | Decisão implementada | Consequência |
|---|---|---|
| Regras e baralho | A semente orienta os cais e a peça inicial. Duas de cada três posições normais oferecem canais. O índice de grupos existente confere a conexão. | O jogador consegue planejar a navegação. O replay, o desfazer, o mirante e o filme usam a mesma sequência de peças. |
| Leitura do tabuleiro | Cada cais tem silhueta, número, nome e carga. O fantasma informa se o canal prolonga o rio da vila. | A carta funciona de dia e à noite e oferece foco por toque. |
| Efeitos | O mercado tem toldo listrado, a serraria empilha toras e o estaleiro tem um casco no cavalete. A entrega anima uma embarcação ao longo das peças conectadas. | A animação responde à jogada e segue o relógio do mundo para a foto e o vídeo. A malha estática dos três cais é combinada. |
| Pós-processamento | Alta conserva TRAA, oclusão, tinta e bloom. O desfoque de profundidade fica nos perfis Ultra e Cinema. As nuvens volumétricas deixam a carta de jogo desimpedida e reaparecem na foto. | Bordas e destinos distantes ficam legíveis na vista de planejamento. |
| Bateria e dados da GPU | O repouso usa prazos de 30 e 20 quadros por segundo. O Auto mede intervalos de jogo ativo. Os pools enviam as faixas acrescentadas de matrizes e cores. | Repousar em uma tela de 120 Hz respeita o mesmo limite que em uma de 60 Hz. Colocar uma peça requer atualizar apenas os dados alterados nos pools já alocados. |
| Som de ambiente | O jogo consulta os 37 hexágonos no raio do foco pelo índice do tabuleiro. | O custo dessa consulta tem o mesmo limite em mapas pequenos e grandes. |

## Como verificar

- `npm run cartas` joga as três cartas em 100 sementes e compara a previsão com as entregas.
- `npm run teclado` percorre os mapas por teclado e verifica a retomada de um frete da edição 0.2.
- `node scripts/medir-cartas.mjs regioes` mede as regiões 0, 4 e 8 nos dois backends. Para comparar edições, use `node scripts/medir-cartas.mjs edicoes "caminho/da/0.2/dist/index.html"` depois de gerar o roteiro com `npm run viagem`. As medições brutas ficam em `.cache/`.

Com Node 22.12 ou superior, execute `npm ci` nesta pasta. Para desenvolvimento, `npm run dev`. Para reconstruir o arquivo jogável, `npm run build`.

- `npm run check` confere os tipos, simula 600 partidas, verifica o replay, as cores e o vídeo e gera o HTML.
- Os cenários de navegação cobrem um cais isolado, uma ligação tardia, entrega única e 36 viagens completas com uma estratégia que reserva o leito dos três rios.
- `npm run smoke` confere o backend recebido e os erros do navegador tanto em WebGPU quanto em WebGL2.
- `npm run viagem` usa mouse e teclado no HTML compilado, fecha os três cais, recarrega o save, desfaz uma entrega e testa o toque em uma viewport de celular. As capturas ficam em `.cache/capturas`.
- `node scripts/comparar.mjs "caminho/do/original/dist/index.html"` compara o Clássico com o mesmo tabuleiro, qualidade e câmera. O teste aquece cada cena por 90 quadros e mede os 180 seguintes. Ele alterna a ordem das edições.

Para usar a GPU do sistema no Windows, defina `$env:RENDER_DEVICE = 'hardware'` e `$env:CHROMIUM_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'` no PowerShell antes dos testes gráficos. O motor é Three.js r186 com TSL. O roteiro de interface usa Playwright. A busca de integrações de Three.js no catálogo de plugins retornou serviços de outros produtos. O projeto usa o Three.js instalado pelo arquivo de dependências e pode ser jogado offline.

## Próximo experimento de jogo

Testaria **dois pedidos alternativos no mesmo cais**. A Feira poderia aceitar uma entrega curta de grãos para repor peças agora ou pedir um caminho que também passe pela Serraria e dê uma recompensa maior depois. Isso acrescentaria uma escolha de compromisso com o território usando as construções que o jogador já enxerga. Antes de ampliar aos 14 temas, observaria se jogadores novos conseguem explicar o pedido, prever a entrega no fantasma e escolher rotas diferentes na mesma semente.

