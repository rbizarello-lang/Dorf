# Encostas · relevo das peças na edição 0.5

Na carta **Aldeia na crista**, a primeira peça na mão já tem uma margem alta e outra baixa. Ao girar um canal no tabuleiro, o jogo calcula as margens que poderão continuar no terreno vizinho. As partes secas da peça podem ganhar altura ao receber novos encaixes de prado, mata, cultivo ou vila. A água e a ferrovia atravessam as peças pelo fundo do vale. No espaço dos cais, o centro continua livre para a construção.

O relevo precisa da opção **Paisagem viva**, ativada na abertura da edição. A aldeia de três peças da 0.4 conserva sua silhueta. A progressão nova aparece nas peças acrescentadas à carta. A mesma semente, peças e giros reconstroem a mesma paisagem. Os encaixes também conservam a pontuação e as regras dos fretes.

## O vinhedo em três jogadas

O [guia de abertura](../README.md) identifica as casas sem coordenadas. Para repetir exatamente o ensaio, use a semente **42**, o tema **Costa dos Terraços** e a carta **Aldeia na crista**. As casas abaixo são coordenadas axiais. O giro é contado em passos de 60° a partir da orientação em que cada peça chegou.

| Jogada | Casa | Giro | O que observar |
|---|---|---|---|
| 1 | 1, 0 | Inicial | A margem do canal se acomoda à aldeia e a prévia informa o patamar. |
| 2 | −1, 1 | Um à direita | O vinhedo começa na outra margem da confluência. |
| 3 | −1, 0 | Um à esquerda | O vinhedo já plantado recebe seu primeiro patamar e se une à terra da terceira peça. |

[Peça na mão](screens/0.5-encostas-mao.png) · [Prévia do encaixe](screens/0.5-encostas-primeiro-encaixe.png) · [Prévia do vinhedo](screens/0.5-encostas-previa-vinhedo.png) · [Antes](screens/0.5-encostas-antes.png) · [Depois](screens/0.5-encostas-depois.png) · [Partida por toque](screens/0.5-encostas-toque.png)

## Como foi verificado

O roteiro usa Playwright no HTML compilado aberto por arquivo. Ele aponta, gira e coloca as três peças com o mouse e repete o percurso com toque emulado. A leitura da depuração amostra os próprios nós que formam o terreno, antes da rotação no espaço. Para cada colocação, verifica a identidade da peça e compara a assinatura da malha prevista com a assentada. O teste confirma que recarregar conserva as alturas, que **Desfazer** restaura as anteriores e que o armazenamento da Crista 0.4 fica íntegro. As fotografias de antes e depois saíram do botão **Salvar foto**, com a posição da câmera conferida e fixa.

O ensaio de lógica atravessa as divisas de terrenos, rios e vias em seis giros de cada peça. O ensaio de geometria compara os valores numéricos com os triângulos do chão e cobre a posição de casas, a circulação e o nível de água. `npm run check` reúne essas provas, as simulações anteriores, a checagem de tipos e a geração do HTML. `npm run smoke` faz outras 12 colocações em cada backend.

Para reproduzir o roteiro de tela, em PowerShell:

```powershell
npm ci
npm run check
$env:CHROMIUM_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:RENDER_DEVICE = 'hardware'
node scripts/qa-encostas.mjs
```

Para o mapa de 64 peças, use `node scripts/qa-encostas.mjs --carga`. Para comparar com a 0.4, aponte `QA_HTML` para o arquivo antigo e acrescente `--referencia`. Use um diretório diferente em `QA_OUT` para conservar cada resultado. O toque foi emulado em 390 × 844. O desempenho em aparelho físico e a leitura do relevo por jogadores ainda precisam de observação.

## Resultado da edição entregue

O HTML tem SHA-256 `df2c5ebe0eaae566c536e872f6a2c06f15c83657bc49b6ebe0fc838c36ac60ac`. Nesse arquivo, o pico da primeira peça passou de **0,159** na mão para **0,182** na prévia e conservou a mesma malha após a queda. O vinhedo da segunda peça passou de **0,183** para **0,294** com a terceira jogada, atingindo o patamar 1. As alturas são dadas no espaço do jogo, onde a distância do centro a um vértice do hexágono é 1. O roteiro conferiu os 546 nós amostrados no canal antes e depois do replay, a persistência do cultivo e a reversão ao desfazer. Os dois percursos terminaram sem erros no console. [Medição das jogadas na 0.5](medicoes/encostas-0.5-jogadas.json)

Em `npm run check`, passaram a verificação de tipos, 600 partidas simuladas, os ensaios de cartas e desenvolvimento, as 11.016 amostras de emendas do modelo e as verificações dos triângulos efetivamente desenhados, inclusive para casas, circulação e água. O teste de fumaça confirmou 13 peças e 35 chamadas de desenho nos dois backends, em 7,9 s no WebGPU e 14,2 s no WebGL2.

### Custo observado

O Chrome 157 utilizou uma GeForce RTX 3060, WebGPU, qualidade Alta, luz do dia e janela de 1280 × 800. No mapa de sete peças, as duas versões receberam as mesmas três jogadas e o mesmo enquadramento. Na carga de 64, a IA acrescentou 60 peças com a semente 42 e a câmera em zoom 18. A tabela apresenta um ensaio por edição e por tamanho. O p95 é o percentil 95 do intervalo entre chamadas de animação do navegador após o aquecimento.

| Mapa | Edição | Chamadas | Triângulos | p95 | Montagem das 60 peças |
|---|---|---:|---:|---:|---:|
| 7 peças | Crista 0.4 | 95 | 47.926 | 16,8 ms | — |
| 7 peças | Encostas 0.5 | 95 | 50.249 | 16,8 ms | — |
| 64 peças | Crista 0.4 | 345 | 505.809 | 16,8 ms | 287,6 ms |
| 64 peças | Encostas 0.5 | 347 | 567.539 | 16,8 ms | 468,3 ms |

O acréscimo foi de **4,8% de triângulos** no mapa de sete peças e **12,2%** no de 64. A carga de 64 ultrapassa a referência de aproximadamente 10% do projeto. Esta edição usa mais subdivisões no chão seco, recorta vinhedos e caminhos sobre o terreno e sustenta casas com fundações. O ensaio mediu o conjunto dessas mudanças. O custo individual de cada operação ainda precisa de medição. As duas chamadas adicionais correspondem a uma variação de 0,6%.

O primeiro encaixe da 0.5 registrou pico de **633,3 ms** no intervalo entre quadros. O ensaio em repouso atingiu a cadência de 60 Hz do navegador. Os picos de compilação e o desempenho em outras GPUs permanecem questões distintas. [Jogadas da 0.4](medicoes/encostas-0.4-jogadas.json) · [Carga com 64 peças na 0.4](medicoes/encostas-0.4-carga.json) · [Carga com 64 peças na 0.5](medicoes/encostas-0.5-carga.json)
