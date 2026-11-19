# Primeira troca de qualidade

A [medição da infraestrutura da 0.3](DESEMPENHO_0_3.md) encontrou um intervalo de 4,05 s entre quadros ao trocar de Alta para Média pela primeira vez em uma cena de 301 peças. Repetimos a ação no HTML publicado da 0.3 com o hash `1fbf41c1fe9eb86a80ba340401f594f4763b1dd172d6dca5031975dcd1afdd90`.

| Sessão | Troca | Clique síncrono | Maior intervalo rAF | Pico de submissão da cena |
|---|---|---:|---:|---:|
| 1 | Primeira | 5,5 ms | 5.800 ms | 1.893 ms |
| 1 | Repetição | 4,6 ms | 150 ms | 11 ms |
| 2 | Primeira | 4,0 ms | 3.950 ms | 2.144 ms |
| 2 | Repetição | 2,5 ms | 184 ms | 13 ms |

O Chrome headless usou WebGPU e identificou uma GeForce RTX 3060. O roteiro abriu uma sessão nova para cada repetição, com Vale Pastel no Clássico, semente 42, zoom 8 e viewport 1280 × 800. Cada janela começa com 45 callbacks de espera e mede 60 intervalos após o clique. A repetição de Alta para Média ocorre após retornar a Alta. A duração do clique cobre a atualização síncrona do jogo. A submissão mede o tempo passado no desenho da cena no processo do navegador, incluindo esperas dentro dessa chamada. Os intervalos entre callbacks e os picos de submissão podem ocorrer em quadros distintos. [Dados brutos](medicoes/qualidade-0.3-publicada.jsonl)

Alta usa múltiplas saídas para o antisserrilhado temporal e a oclusão. Média muda a configuração do alvo para MSAA de quatro amostras e retira essas saídas. A troca recria o grafo de pós-processamento. No Three.js r186, o caminho de desenho do WebGPU pode criar pipelines síncronos na primeira vez que encontra essa configuração. O pico de submissão é compatível com esse caminho. Os dados não permitem atribuir todo o intervalo entre quadros à compilação.

## Isolamento do custo

Em uma cena de 31 peças, repetimos a primeira troca em três sessões independentes. Nas duas últimas, o parâmetro de depuração fixou a configuração de efeitos entre os níveis. A troca de qualidade ainda atualizou a resolução e o tamanho do mapa de sombras.

| Efeitos | Maior intervalo rAF | Pico de submissão da cena |
|---|---:|---:|
| Configuração padrão de cada nível | 5.600 ms | 1.329 ms |
| MSAA nos dois níveis (`fx=msaa`) | 267 ms | 8 ms |
| FXAA nos dois níveis (`fx=off`) | 333 ms | 9 ms |

O ensaio indica que a mudança do alvo da cena e dos efeitos concentra a maior parte do atraso. Cada condição teve uma sessão, com o mesmo navegador, placa e enquadramento. Fixar os efeitos eliminaria parte da diferença visual entre os níveis. Um teste futuro de compilação antecipada precisa medir o tempo de abertura, o primeiro quadro após a troca e o consumo adicional de memória. [Dados brutos](medicoes/qualidade-0.3-isolamento.jsonl)

Como critério para esse experimento, em pelo menos cinco sessões novas por variante e backend, reduzir pela metade a mediana do maior intervalo da primeira troca Alta → Média com 301 peças. Medir também da abertura ao primeiro quadro jogável e tentar uma jogada antes de trocar de qualidade. A abertura e a primeira jogada devem ficar dentro da variação observada na linha de base. As mesmas cenas devem preservar a imagem de cada nível e passar pela detecção de erros do navegador. Registrar a memória dos alvos mantidos durante a partida para avaliar a viabilidade em aparelhos mais limitados.

## Confirmação na 0.4

Uma sessão na compilação candidata `94304c9c…`, antes da revisão final da interface móvel, repetiu o cenário Clássico de 301 peças. O clique levou 4,7 ms. A primeira troca teve pico de 2.007 ms na submissão da cena e intervalo de 5.517 ms entre callbacks. Na repetição, o maior intervalo caiu a 167 ms. A cena não usa a carta da Crista. O resultado confirma que o atraso persiste na 0.4 e tem magnitude semelhante à observada na 0.3 publicada. Os perfis gráficos da edição conservam suas configurações. [Dados brutos](medicoes/qualidade-0.4-candidata.jsonl)

Para repetir o ensaio com o Chrome do Windows e a GPU do sistema:

```powershell
$env:CHROMIUM_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:RENDER_DEVICE = 'hardware'
$env:QUALIDADE_RODADAS = '2'
node scripts/medir-qualidade.mjs 'dist/index.html'
```

Para repetir o isolamento, ajuste `QUALIDADE_CARGA` para `30` e rode o roteiro com `QUALIDADE_FX` ausente, igual a `msaa` e igual a `off`, em sessões separadas.
