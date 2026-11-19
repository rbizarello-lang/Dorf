# Entrepostos 0.4 · Aldeia na Crista

A nova carta usa a Costa dos Terraços para explorar a forma da aldeia. Três hexágonos ocupados desde a abertura compõem uma encosta contínua, com casas em dois patamares, muros de arrimo, ciprestes, oliveiras e uma torre no Campanário. O joelho da crista e a diferença de altura entre seus extremos formam a silhueta. Os três cais continuam no plano fluvial e a confluência permanece a origem das rotas.

| Elemento | Confluências 0.3 | Crista 0.4, na nova carta |
|---|---|---|
| Abertura | Um hexágono com três canais | Confluência e três hexágonos adicionais, sem custo de estoque |
| Implantação | Casas e vegetação distribuídas pelo terreno baixo | Casas seguem os patamares, com o campanário como ponto focal |
| Primeira peça | Canal reto com margens sorteadas | Canal reto com duas bordas de vila definidas para encaixar junto aos patamares |
| Leitura do encaixe | Prévia por tipo de terreno | Prévia pelo nome e pelo estágio dos patamares que ganham casario |
| Reabertura | Desenvolvimento derivado dos encaixes salvos | A mesma regra recompõe a posição das casas da crista a partir do replay |

Na semente 42, a primeira peça sem giro encaixa entre a vila e a Feira. O Campanário avança de 2 para 3 e o Belvedere, de 1 para 2. Cada um recebe uma casa adicional. O Baluarte conserva o casario inicial. O guia marca essa posição e a prévia nomeia os dois avanços. A abertura usa o estoque e os contratos de Entrepostos.

O relevo usa geometria procedural. A altura, a largura e a direção do perfil são coincidentes nas duas emendas. A evolução recompõe as regiões afetadas e insere as novas casas na área definida pelo patamar. A 0.4 tem um namespace de armazenamento próprio.

O ensaio de lógica simula 600 partidas e 7.200 replays integrais e parciais. Cada uma das quatro cartas é percorrida por roteiros determinísticos em 100 sementes. A Crista chegou a todos os cais nas 100 sementes, com viagens de 11 a 17 jogadas entre os roteiros concluídos. A [verificação jogável](QA_CRISTA.md) registra a experiência no navegador, as capturas e o custo observado na abertura e no primeiro encaixe. A [medição da primeira troca de qualidade](QUALIDADE_0_4.md) investiga separadamente a compilação da cena ao mudar de Alta para Média.

No candidato `94304c9c…`, as simulações de saves v10 e v11 no namespace da Crista passaram no Chrome com recarga e desfazer. Um save inválido da Crista foi descartado sem modificar os dados preparados nos namespaces das edições anteriores. O ensaio usa os formatos legados como amostras de compatibilidade do replay. O armazenamento da Crista começa separado.

Na compilação publicada `a6cf8c4d…`, o teste de fumaça chegou a 13 peças e 35 chamadas de desenho em WebGPU e WebGL2. Uma janela de Chrome headless recém-aberta por backend, com RTX 3060, Alta, 1280 × 800 e semente 42, levou 9,62 s em WebGPU e 30,43 s em WebGL2 da navegação até a primeira leitura de `window.__stats` com as quatro peças iniciais. Essa amostra única inclui inicialização, compilação e espera pela atualização dos contadores de depuração. [Dados da abertura](medicoes/abertura-0.4.jsonl)

A crista permanece no mapa fluvial. Os talhões agrícolas e o mar ao fundo são propostas da [direção de arte](DIRECAO_DE_ARTE.md). A compreensão dos estágios durante uma partida inteira e o desempenho em celular físico ficam para teste com jogadores e aparelhos reais.
