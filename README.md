# Retalhos · Entrepostos

Abra **dist/index.html** no Chrome ou no Edge para jogar. O arquivo contém o jogo, as regras, a interface, os modelos e os materiais procedurais. A edição usa o espaço `entrepostos.` no armazenamento do navegador. Para retomar uma partida, abra o mesmo arquivo no mesmo navegador.

[Validação, medições e capturas da edição](docs/VALIDACAO.md)

## A viagem

A vila começa na confluência de três canais. Você tem **24 peças para abrir uma rota de água até três cais**. A carta no canto mostra o que cada um precisa. Clique no nome do cais para aproximar a câmera. “Ver mapa” reenquadra a região. O tracejado no pergaminho indica a direção do destino. Seu rio pode fazer curvas e chegar por qualquer lado.

| Cais | Entrega | Retorno à pilha |
|---|---|---|
| Feira | Grãos | 4 peças |
| Serraria | Madeira | 6 peças |
| Estaleiro | Ferragens | 8 peças |

Gire a primeira peça e prolongue uma das bocas do rio da vila. As duas primeiras peças são retas. Elas permitem fazer a primeira entrega na Feira em duas jogadas. Em uma partida nova, a semente muda a orientação do mapa, das peças e a paisagem que as acompanha.

Um cais aceita uma peça com rio. Se você construir um trecho isolado, pode ligá-lo à vila por uma jogada posterior. Quando o caminho se completa, o cais exibe a carga e uma embarcação percorre a ligação. O crédito entra no turno da conexão. A terceira entrega encerra a viagem e cada peça restante vale 20 pontos. A pilha também pode acabar com cais por atender.

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

Com Node 22.12 ou superior, execute `npm ci` nesta pasta. Para desenvolvimento, `npm run dev`. Para reconstruir o arquivo jogável, `npm run build`.

- `npm run check` confere os tipos, simula 600 partidas, verifica o replay, as cores e o vídeo e gera o HTML.
- Os cenários de navegação cobrem um cais isolado, uma ligação tardia, entrega única e 36 viagens completas com uma estratégia que reserva o leito dos três rios.
- `npm run smoke` confere o backend recebido e os erros do navegador tanto em WebGPU quanto em WebGL2.
- `npm run viagem` usa mouse e teclado no HTML compilado, fecha os três cais, recarrega o save, desfaz uma entrega e testa o toque em uma viewport de celular. As capturas ficam em `.cache/capturas`.
- `node scripts/comparar.mjs "caminho/do/original/dist/index.html"` compara o Clássico com o mesmo tabuleiro, qualidade e câmera. O teste aquece cada cena por 90 quadros e mede os 180 seguintes. Ele alterna a ordem das edições.

Para usar a GPU do sistema no Windows, defina `$env:RENDER_DEVICE = 'hardware'` e `$env:CHROMIUM_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'` no PowerShell antes dos testes gráficos. O motor é Three.js r186 com TSL. O roteiro de interface usa Playwright. A busca de integrações de Three.js no catálogo de plugins retornou serviços de outros produtos. O projeto usa o Three.js instalado pelo arquivo de dependências e pode ser jogado offline.

## Próximo experimento de jogo

Testaria **dois pedidos alternativos no mesmo cais**. A Feira poderia aceitar uma entrega curta de grãos para repor peças agora ou pedir um caminho que também passe pela Serraria e dê uma recompensa maior depois. Isso acrescentaria uma escolha de compromisso com o território usando as construções que o jogador já enxerga. Antes de ampliar aos 14 temas, observaria se jogadores novos conseguem explicar o pedido, prever a entrega no fantasma e escolher rotas diferentes na mesma semente.

