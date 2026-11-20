# Avaliação do Retalhos Entrepostos (GPT Astra)

Branch `jogo-entrepostos`, cabeça `75f92e0` (edição 0.5 Encostas). Avaliação de 19/11/2026 feita pelo revisor (Claude Opus), com um agente de leitura (Haiku) e um de execução (Sonnet). O relatório da execução está em [EXECUCAO.md](EXECUCAO.md), e as pranchas, nesta pasta.

## Em uma frase

É um jogo derivado sólido, feito a partir do Retalhos de 4 de outubro (`rotas-visuais`, `d22626c`). A regra dele (rota de água até três cais) é bem testada. O que mais vale trazer para a `main` são as Encostas, que resolvem a peça "gorda" do nosso Relevo, e a Paisagem viva. A branch inteira não entra, porque o histórico é separado e a base é antiga: perderíamos o mar, o clima, as estações, a interface calma, as árvores leves, o Relevo e a Terra contínua.

## O que é

| Edição | O que acrescenta |
|---|---|
| 0.1 Entrepostos | Modo de 24 peças para ligar por água a vila a três cais: Feira (+4 peças), Serraria (+6) e Estaleiro (+8). |
| 0.2 Fretes | Contrato "Madeira para a Feira" (a Feira paga 10 se a Serraria abrir antes), barcas e travessia. |
| 0.3 Confluências | Paisagem viva (até 3 estágios por encaixes iguais: casas sobem, mata adensa, cultivo ganha celeiro, canal alarga), tema Costa dos Terraços, teclado e foco. |
| 0.4 Crista | Aldeia na crista: três lotes fixos em encosta, com muro de arrimo, patamares e torre. |
| 0.5 Encostas | Relevo nas peças. A altura sai da "massa" do terreno de cada borda. Onde a terra casa com a vizinha, a encosta atravessa a emenda; onde não casa, desce ao chão. As bancadas suaves seguem a curva de nível, e a encosta sobe com os encaixes. |

## Verificação (execução)

- Passaram: `npm ci`, typecheck, os testes (600 partidas), `cartas` (100 sementes por carta), `desenvolvimento`, `encostas` e o build.
- O smoke em WebGL2 passou. O WebGPU não pôde ser conferido: o WebGPU por software deixou de funcionar nesta máquina, até na `main`.
- Partida jogada por script: na Confluência e na Crista, a primeira entrega saiu na jogada 2, sem erro no console. O guia de 3 jogadas do README confere.
- Clássico, `seed=7`, `auto=40`: o tabuleiro e a pontuação saem idênticos aos da `main`.

## Regras da casa

- `src/core` segue puro: sem three.js nem DOM, e o único `Math.random` é o `bestMove`, que já existia.
- `SAVE_VERSION` foi de 9 a 12. Cada edição usa um prefixo de armazenamento próprio.
- Os oráculos são independentes só em parte. A conexão até os cais é conferida por busca em largura própria (`tests/logic.ts`). Já `tests/charts.ts` usa código de produção (`onMainRiver`) para o valor esperado, e o prêmio de 10 do contrato não tem oráculo.

## Desempenho (software, WebGL, 300 peças, Alta)

| Build | Draw calls | Triângulos | Instâncias |
|---|---:|---:|---:|
| base `d22626c` | 136 | 1.510 mil | 72.262 |
| `main` | 115 | 1.134 mil | 80.461 |
| Entrepostos | 129 | 1.294 mil | 70.969 |

- Com a Paisagem viva o custo sobe bem: no Zen com 61 peças, 298 draw calls e 538 mil triângulos, contra 97 e 275 mil no Clássico.
- Pelo documento dele, numa RTX 3060 real as Encostas somam +12% de triângulos com 64 peças, a montagem passa de 288 para 468 ms e há um pico de 633 ms no primeiro encaixe.

## O que trazer, em ordem

1. **Encostas no jogo todo.** É a etapa E5, em andamento na `dorf/e5-encostas`. Elas substituem a altura por peça e as saias do nosso Relevo, ficando os platôs, as cachoeiras, a água que desce e o chão contínuo. O custo vem do fato de a jogada mudar a vizinha: é preciso refazer o chão e a decoração dela.
2. **Paisagem viva como opção.** É a etapa E6, ligada às manchas da Terra contínua. O custo de draw calls tem de ser contido, porque no Astra o custo triplica.
3. **Envio parcial dos lotes de decoração.** O `Pool.add/flush` com `addUpdateRange` manda à GPU só a faixa nova. Entra com a E5.
4. **Entrepostos como modo**, sobre a `main`, mais adiante. Para isso, falta um oráculo independente do contrato.

## Defeitos achados

- `?stress` com `mode=entrepostos` nunca termina.
- Aviso de console "Vertex attribute position not found" (2×) na Crista.
- O "RECORDE" mostra uma projeção maior que o placar.
- De perto, as faces de rocha entre os patamares ficam facetadas.
- A grade hexagonal do pergaminho fica muito marcada, sobretudo à noite.
- A documentação dele tem caminhos pessoais (`C:/Users/...`) e notas de processo.

## Como o Roger avalia a Paisagem viva

Abra no Chrome o arquivo `dist/index.html` da pasta do Astra (`Retalhos-Entrepostos-Encostas`). Ele roda sem servidor. Depois, **Nova → Zen**: a Paisagem viva vem ligada.
