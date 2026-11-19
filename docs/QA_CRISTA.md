# Verificação da Aldeia na Crista

Os ensaios de desktop e toque abriram o HTML 0.4 com SHA-256 `A6CF8C4D8F9CEC3DB14926F12406C41FC2CD54FF7DB6D719B810164CE041448B`, idêntico a `dist/index.html`. O Chrome 157.0.8103.52, no Windows com GeForce RTX 3060, executou o roteiro sem erros de página ou console.

O roteiro abre o HTML compilado pelo protocolo `file:`, em contextos de Chrome com armazenamento isolado. A jogada é feita com rotação pelo teclado e clique no tabuleiro. A projeção de coordenadas axiais serve para localizar a posição do clique. O roteiro usa o save do jogo para verificar rotação, pontuação e desfazer, e usa o estado de inspeção do cenário para comparar estágio e implantação depois da reabertura. As fotografias são PNGs exportados por **Salvar foto**. A captura da prévia preserva o HUD jogável.

Execute os comandos no PowerShell a partir da raiz da edição.

```powershell
npm run build
$env:CHROMIUM_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:RENDER_DEVICE = 'hardware'
node scripts/qa-crista.mjs
```

`QA_HTML` indica o HTML entregue para conferir o mesmo arquivo que será aberto por quem joga. `QA_OUT` permite escolher onde salvar as imagens, a amostra de quadros e `resultados.json`. O roteiro calcula e confere o SHA-256 do HTML antes e depois do ensaio. As capturas ficam por padrão em `.cache/capturas/crista`. Os argumentos `--desktop` e `--toque` isolam os dois trechos do roteiro.

Cada amostra em repouso usa 120 intervalos de `requestAnimationFrame` após 30 quadros de aquecimento. A amostra da jogada começa antes do clique e inclui assentamento. Os tempos de CPU do mundo e de submissão do desenho vêm dos contadores do jogo. Os intervalos dependem da cadência do navegador e da máquina. A amostra em tela móvel usa toque emulado.

## Leitura da paisagem

A revisão visual abriu o enquadramento, aproximou as casas em conjuntos menores e reduziu a altura dos arrimos. Os afloramentos interrompem as faces lisas e as copas maiores ocupam a encosta abaixo dos telhados. A torre marca o ponto alto, e a continuidade das três peças aparece tanto de frente quanto na vista oblíqua. A abertura do desktop dá destaque à aldeia e à Feira. **Ver mapa** abre o enquadramento dos três cais.

A jogada (1, 0) prolonga o canal inicial. A prévia identifica o Campanário e o Belvedere, e o contorno do encaixe indica as bordas em contato. As fotos pareadas mostram a nova fileira de casas abaixo da torre e no patamar da direita com semente, câmera, luz e qualidade fixas. As pontas dos arrimos e as copas também ajudam a reconhecer os mesmos lugares ao comparar as duas imagens.


- [Vista jogável na abertura](screens/0.4-crista-panorama-jogavel.png)
- [Outro ângulo, no modo foto](screens/0.4-crista-outro-angulo.png)
- [Prévia dos estágios Campanário e Belvedere](screens/0.4-crista-previa.png)
- [Antes do encaixe](screens/0.4-crista-antes.png) e [depois do encaixe](screens/0.4-crista-depois.png)
- [Mapa em retrato](screens/0.4-crista-toque-retrato.png) e [depois de girar para paisagem](screens/0.4-crista-toque-paisagem.png)

## Toque emulado

No Chrome em WebGL2 e qualidade Média, o mapa manteve as três etiquetas de cais fora do HUD em 390 × 844, ao girar para 667 × 375, ao voltar para retrato e ao iniciar diretamente em paisagem. O botão **Guiar encaixe na crista** aproximou o terreno em retrato e **Ver mapa** restaurou a vista dos cais. O roteiro tocou na casa (1, 0), girou a peça nas duas direções pelos botões e confirmou o encaixe. O save registrou a casa e o giro esperados.

No ensaio preliminar, a vista de abertura aproximava demais em telas pequenas e a quina da etiqueta da Serraria ficava sob o manifesto após girar. A versão conferida usa o enquadramento dos cais em telas curtas, reserva mais espaço junto ao HUD e estreita o manifesto recolhido. O navegador emulou toque e tamanho de tela num computador com RTX 3060. O ensaio em aparelho físico e a audição dos anúncios em leitor de tela continuam pendentes.

## Encaixe, desfazer e reabrir

A carta pôde ser aberta pela seleção em **Escolher frete** ou pelo link com semente 42. O roteiro passou o mouse sobre (1, 0), girou com **R** e viu o aviso de bordas incompatíveis. **Shift+R** restaurou o encaixe entre a vila e a Feira e exibiu duas etiquetas no mapa. A prévia preservou o save e a implantação. O clique assentou a peça e registrou 50 pontos. O Campanário avançou de estágio 2 para 3 e passou de 12 a 13 casas, enquanto o Belvedere avançou de 1 para 2 e passou de 13 a 14. O Baluarte permaneceu igual.

Recarregar preservou pontuação, giro, câmera do ensaio e todas as transformações do casario. **U** removeu a jogada, restaurou a implantação inicial e devolveu a câmera ao zoom de abertura. Recarregar de novo manteve o estado desfeito. Os estados inicial e ampliado tiveram, respectivamente, SHA-256 `b0f7725fd1d1bbcfa742b1a6c941327bef172c0f89febf2c041944a112fb213a` e `2ceb4135568be9e78486ba45ec959756bc053b9a371e8787e17727f65fe69fe6` no JSON de inspeção. A abertura em WebGL2 reproduziu o estado inicial.

## Medição na RTX 3060

Costa dos Terraços, semente 42, 1280 × 800, qualidade Alta. Os contadores de chamadas e triângulos são os picos em cada amostra de 120 quadros. O tempo de render é o tempo da CPU medido pelo jogo ao submeter o desenho. A comparação com Paisagem viva desativada usa a mesma crista e mede o custo da configuração viva nesse mapa.

| Condição | Intervalo p50 / p95 / máx. (ms) | Render CPU p95 / máx. (ms) | Chamadas | Triângulos |
|---|---:|---:|---:|---:|
| Abertura estabilizada, WebGPU | 16,7 / 16,9 / 17,5 | 6,2 / 9,6 | 71 | 28.049 |
| Encaixe inicial, WebGPU | 16,7 / 17,0 / 1.049,9 | 6,6 / 396,4 | 95 | 33.671 |
| Depois do assentamento, WebGPU | 16,7 / 16,9 / 17,0 | 6,0 / 6,9 | 74 | 33.410 |
| Abertura estabilizada, WebGPU, Paisagem viva desativada | 16,7 / 16,8 / 17,1 | 6,0 / 7,0 | 57 | 27.195 |
| Abertura estabilizada, WebGL2 | 16,7 / 17,0 / 17,1 | 5,8 / 7,3 | 71 | 28.049 |

A cena aberta manteve cadência próxima de 60 Hz nesta máquina. A primeira colocação teve uma pausa de cerca de um segundo entre callbacks em WebGPU. O maior tempo medido na atualização do mundo durante a amostra foi 19 ms. A causa da pausa ficou por isolar. Um ensaio intermediário do mesmo cenário também registrou pausa acima de um segundo. O próximo encaixe, outras GPUs e os tempos de carregamento de página ficaram fora desta amostra.
