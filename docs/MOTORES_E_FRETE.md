# Motores, ferramentas e o frete da Serraria

## O que o protótipo pede

Uma peça pode abrir rios, pagar contratos, ser desfeita e reaparecer em uma gravação. O custo de trocar de motor depende de quantas dessas operações podem ser reaproveitadas. A edição 0.2 precisa conservar a partida determinística em TypeScript e os 14 temas procedurais, abrir em um só HTML e funcionar nos dois backends gráficos. A avaliação das alternativas foi documental. Os ensaios desta edição usaram Three.js.

| Motor | O que oferece para este jogo | Trabalho de adoção e decisão |
|---|---|---|
| Three.js r186 | O mesmo grafo TSL pode gerar WGSL ou GLSL. O renderizador já usa WebGPU e recorre a WebGL2. Os cais compartilham material, e o jogo já controla o relógio da foto e do filme. | Mantive o motor. A nova carga usa geometria procedural, a rota usa uma curva da biblioteca e o navegador executa o mesmo HTML. [Manual do renderizador](https://threejs.org/manual/pages/webgpurenderer) |
| Babylon.js | Oferece WebGPU, WebGL e materiais de nós. A inicialização de WebGPU é assíncrona. É um candidato para um projeto que queira adotar seu sistema de materiais e ferramentas de inspeção. | As regras puras poderiam ser conservadas. Água, iluminação indireta, vegetação instanciada, passes de pós e exportação do filme precisariam de uma prova própria de equivalência. O manual de migração entre backends do Babylon descreve um projeto que **já usa Babylon**. [Documentação oficial](https://doc.babylonjs.com/setup/support/webGPU) |
| PlayCanvas | O motor pode ser usado isoladamente. O Editor dispõe de um MCP que edita entidades e componentes e permite verificar a cena aberta. Isso favorece uma equipe que queira compor níveis no editor. | Nesta edição, o cais, o terreno e os pontos da rota surgem da semente. Para o MCP do Editor beneficiar esse fluxo, seria preciso representar e sincronizar esses objetos em um projeto PlayCanvas. [Motor](https://developer.playcanvas.com/user-manual/engine/) · [MCP do Editor](https://developer.playcanvas.com/user-manual/editor/mcp-server/) |
| Godot 4 | O editor, a árvore de cenas e as animações oferecem um fluxo para autoria de jogos e exportação. Na web, a documentação descreve WebAssembly e o renderizador Compatibility com WebGL2. | Uma edição nativa para desktop seria um experimento distinto. Para o protótipo atual a conversão envolveria reconstruir a cena, a interface, os shaders e a distribuição web. [Exportação oficial para web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html) |

## MCP e skills

| Opção examinada | Aplicação na edição |
|---|---|
| Chrome DevTools MCP, do projeto Chrome DevTools | Instalado em `tools/inspecao`, com versão **1.13.0** e integridade fixada no lockfile. O cliente de verificação negociou o protocolo por entrada e saída padrão, abriu os builds, consultou o DOM acessível, clicou no frete, verificou o console e mediu as escritas de cor. O servidor abre um perfil temporário do Chrome com telemetria e consulta CrUX desligadas. [Servidor e ferramentas](https://github.com/ChromeDevTools/chrome-devtools-mcp) |
| Playwright MCP, da Microsoft | Permite conduzir um navegador pela árvore de acessibilidade. Para repetir as mesmas 14 jogadas e os toques na mesma ordem, a suíte existente usa Playwright por código. O MCP do Chrome acrescentou a inspeção da interface e a instrumentação. [Servidor da Microsoft](https://github.com/microsoft/playwright-mcp) |
| Skill comunitária `threejs-performance`, de CloudAI-X | Instalada no Codex pela revisão `0e181866f095b5f06d005133876e926515390d95`, com licença MIT. Apliquei as orientações sobre trabalho por quadro, geometrias combinadas e descarte da geometria da barca. A orientação específica para r186 cobre WebGPU e TSL. [Coleção e autoria](https://github.com/CloudAI-X/threejs-skills) |
| Skills `threejs-geometry` e `threejs-animation` da mesma coleção | A geometria do casco e da carga cabe no construtor procedural existente. Para contornar uma dobra do canal, bastam pontos de entrada e saída e uma curva quadrática. O relógio de simulação já sincroniza o movimento com o vídeo. [Coleção](https://github.com/CloudAI-X/threejs-skills) · [Curva quadrática no Three.js](https://threejs.org/docs/pages/QuadraticBezierCurve.html) |

## Da pesquisa à jogada

Na edição anterior, ligar a Feira era sempre uma forma de receber peças cedo. Agora o jogador pode reservar o armazém para madeira. Na semente 42, quem abre primeiro a Feira chega à segunda jogada com **26 peças** na entrega direta ou **22 peças** no contrato. É possível abrir a Serraria primeiro ou unir duas redes com uma única peça. O suprimento é pago uma única vez. O Estaleiro mantém sua encomenda de ferragens.

A barca procura um caminho pelos lados de água que realmente se tocam. O frete de madeira parte da Serraria e pode atravessar a vila para chegar à Feira. Na partida anterior todas as barcas saíam da vila. O jogo amostra as curvas na partida da embarcação, conserva as distâncias acumuladas e desloca uma malha por quadro. A câmera de acompanhamento pode ser interrompida a qualquer momento. O arquivo da partida guarda o acordo e as jogadas.

[Travessia na Serraria](screens/frete.png) · [Trecho de vídeo exportado pelo jogo](screens/travessia.mp4) · [Carta fluvial à noite em tela de celular](screens/frete-noite.png)

## Como reproduzir

1. Na pasta da edição, instale as dependências com `npm ci` e rode `npm run check`. Para o navegador, use `npm run smoke` e `npm run viagem`. No PowerShell, defina `$env:FRETE = 'madeira'` para testar a encomenda, a câmera de acompanhamento e o toque à noite.
2. O MCP é independente das dependências do jogo. Para reinstalá-lo em outra máquina, use `npm ci --prefix tools/inspecao --ignore-scripts`. O comando do servidor para um cliente MCP é `node tools/inspecao/servidor.mjs`, executado a partir da pasta da edição. A variável opcional `CHROMIUM_PATH` seleciona o executável do Chrome.
3. Rode `node tools/inspecao/conferir.mjs` para testar a abertura, a escolha e o console via MCP. Um argumento adicional com o caminho do HTML anterior inclui a comparação das etiquetas na mesma execução.

Nesta máquina, o registro global do Codex se chama `entrepostos-chrome` e aponta para o servidor instalado na pasta desta edição. A skill `threejs-performance` também está instalada no perfil do usuário. Ambos ficam fora do HTML jogável.

### Ensaios desta edição

- O teste geral simulou 600 partidas e 52.694 jogadas. Os 600 replays completos e 6.600 parciais reproduziram o estado esperado. Em 36 sementes adicionais do roteiro fluvial, os dois fretes chegaram ao fim. Os testes também cobrem ordem invertida, abertura simultânea e pagamento único.
- Na mesma semente 42, no Chrome com GeForce RTX 3060, a viagem terminou em 14 jogadas com 715 pontos na entrega direta e 835 no frete de madeira. A diferença de 120 pontos vem das seis peças adicionais a 20 pontos por peça restante. O teste retomou a reserva após recarregar e desfez uma jogada. O teste direto também abriu um save v10 e verificou a migração para v11.
- Na abertura em qualidade Alta e WebGPU, o MCP instrumentou as três etiquetas durante 90 quadros de navegador. Mediu **270 chamadas** para reaplicar a cor na edição anterior e **zero** na nova. O contador se refere às escritas dessa propriedade no DOM. A comparação de FPS entre motores e a autonomia de um telefone físico seguem sem medição.
- A verificação de toque usa uma viewport de 390 × 844 no Chrome do desktop. Os 36 mapas seguem uma estratégia programada que reserva espaço para os três canais. A dificuldade e a preferência de jogadores pelos dois fretes ainda precisam de sessões com pessoas.
- Na carga de 301 peças em Alta, com a GPU do sistema, o quadro amostrado teve 130 chamadas de desenho, cerca de 1,51 milhão de triângulos e 72.262 instâncias. É uma medição isolada do cenário de carga, com semente 42. O teste de inicialização concluiu 12 jogadas em WebGPU e em WebGL2.
- O exportador do jogo reconstituiu a ação **Rever a travessia** em WebGL2. O trecho de 1,05 segundo foi exportado em MP4 de 960 × 540 e reproduzido no Chrome. Foram inspecionados um quadro do mapa e outro da câmera aproximada com a embarcação em trânsito.
