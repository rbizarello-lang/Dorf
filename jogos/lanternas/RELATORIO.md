# Ilha das Lanternas: relatório da versão inicial

## O que foi construído

Um jogo de cartas e exploração numa ilha hexagonal coberta de névoa, em 3D, que roda no navegador. Resumo das regras:

- **A ilha:** um mapa de hexágonos (raio 7, cerca de 95 de terra) cercado de água. No centro fica o Farol velho, já aceso. Tudo o que está longe da luz fica escondido sob nuvens baixas.
- **A partida:** 30 turnos, de 10 a 15 minutos. A cada turno o jogador vê 3 cartas, escolhe 1 e a coloca num hexágono brilhante. As outras 2 voltam ao fundo do baralho (58 cartas). Se preferir, descarta uma carta e ganha +1 de óleo, então nunca fica sem jogada.
- **As cinco cartas:**
  - Casa (custa 5 de comida): abriga de 1 a 4 moradores, e quanto mais variados os vizinhos (campo, bosque, água, lanterna, pomar), mais moradores.
  - Campo: rende +1 de comida por turno.
  - Oliveiral: rende +1 de óleo por turno.
  - Lanterna (custa 4 de óleo): acende e revela a névoa num raio de 2 hexágonos.
  - Cais: rende +1 de comida por turno, na praia.
- **Dois recursos:** comida (para construir casas) e óleo (para lanternas).
- **A luz:** as lanternas revelam o mapa (a revelação é permanente) e protegem as casas na noite.
- **Noites nos turnos 10, 20 e 30:** cada lanterna queima 2 de óleo (a que fica sem óleo apaga). A casa sem lanterna encostada perde 1 morador. **Festa:** a comida guardada vira moradores (3 de comida = +1 morador, até 6 por noite, em casas iluminadas com vaga) e o estoque zera.
- **Achados escondidos:** 6 por ilha (2 ruínas, 1 cardume, 2 pomares, 1 nascente), que só aparecem quando a luz chega neles e dão bônus.
- **Três metas por partida**, sorteadas entre cinco (ponta marcada, 52 moradores, 5 achados, fileira de 4 casas, 80% da ilha iluminada). Cada meta cumprida vale +5 pontos. A pontuação final é moradores mais metas.
- **O visual:** um diorama, como uma maquete sobre um pedestal de madeira, com mar recortado, casinhas, campos, árvores, cais e farol. A hora do dia avança do amanhecer ao entardecer, e nas noites as lanternas e janelas acendem. Tudo é desenhado por código, sem arquivos de arte.

![Fim da partida](docs/screens/fim.png)

![Meio da partida](docs/screens/meio.png)

## Como abrir e jogar

- **Mais simples:** o arquivo `jogos/lanternas/dist/index.html` já vem pronto no repositório. Basta baixá-lo e abrir com dois cliques, direto no navegador, sem instalar nada. É um arquivo único e funciona offline. Conferi abrindo por `file://` num Chromium: o jogo carrega, mostra as 3 cartas e não dá nenhum erro no console.
- **Para mexer no código:** `cd jogos/lanternas && npm install && npm run dev`. Para refazer o arquivo único depois de mudar o código: `npm run build`, que sobrescreve `dist/index.html`.
- **Controles:**
  - clicar numa carta para escolhê-la (ou as teclas 1, 2 e 3);
  - clicar num hexágono brilhante para colocar a carta (no celular, o primeiro toque mostra a peça e o segundo confirma);
  - arrastar gira e inclina a ilha (também as setas do teclado);
  - a roda do mouse aproxima e afasta (ou pinça no celular, teclas + e -);
  - "Descartar" (ou a tecla D) joga fora a carta escolhida e dá +1 de óleo; Esc desfaz a escolha;
  - `?seed=N` no endereço repete a mesma ilha (por exemplo `index.html?seed=3`).

## O que os testes mostraram

Foram simuladas 300 partidas completas para cada um de três jogadores automáticos: o aleatório, o guloso (olha só o ganho imediato) e o planejador (pensa em luz, metas e noites). Nenhum deles enxerga o baralho nem os achados sob a névoa.

| Jogador | Média | p10 | p50 | p90 | Ilha revelada | Escolha apertada |
|---|---|---|---|---|---|---|
| Aleatório | 22,8 | 16 | 22 | 31 | 58% | 0% |
| Guloso | 46,2 | 38 | 46 | 57 | 53% | 38% |
| Planejador | 56,7 | 48 | 56 | 68 | 81% | 35% |

(p10, p50 e p90: a pontuação abaixo da qual ficam 10%, 50% e 90% das partidas. "Escolha apertada": nos turnos em que a melhor e a segunda melhor carta valem quase o mesmo, a fração de turnos em que o jogador tem uma decisão difícil de verdade.)

- **Jogar bem compensa:** o planejador faz 2,48 vezes a pontuação do aleatório e 1,23 vez a do guloso.
- **Metas (entre as partidas em que foram sorteadas), planejador:** ponta marcada 48%, moradores 30%, achados 65%, fileira 66%, ilha iluminada 75%. Nenhuma é automática e nenhuma é impossível.
- **Uso das cartas, planejador:** Casa 37%, Lanterna 25%, Campo 18%, Cais 10%, Oliveiral 10%. Nenhuma carta passa de 45%, então a escolha não é óbvia.
- **Partidas travadas:** 0% nos três jogadores.
- **Invariantes (verificações de sanidade):** a mesma semente dá sempre a mesma partida, casa nunca passa de 4 moradores, recursos nunca ficam negativos. Todas passaram.
- **Desempenho (render por software, sem placa de vídeo):** de 37 a 64 draw calls e de 147 a 169 mil triângulos, dentro do limite que fixamos (150 e 300 mil). O FPS numa placa de vídeo de verdade ainda não foi medido.
- **Console:** sem erros em nenhuma das 7 capturas. O comando de verificação (`npm run check`: tipos, simulação e build) passa.
- **Comida e óleo no fim:** a sobra de comida (era 98 em média, 88 na captura) foi resolvida pela festa da noite: o estoque zera e a comida guardada vira moradores. O óleo final do planejador é 5,8 em média. Critérios novos no simulador: comida final média < 15 e óleo < 10.

## Avaliação dos 5 jogos

| Jogo | Potencial para o Roger | Custo | Riscos | Ideia que diferencia |
|---|---|---|---|---|
| Ilha das Lanternas | Alto: construir + explorar + metas curtas numa mesma tela | Baixo (reaproveita a experiência hexagonal do Retalhos) | Parecer "mais um Dorfromantik"; a economia virar conta | A luz como recurso: acender revela o mapa e protege as casas na noite |
| Cidade das Quatro Estações | Alto no visual (Weatherglass) | Médio | A economia sazonal ficar complexa; ritmo lento | O ano como relógio da partida: cada estação muda o que rende |
| Diário de Bordo | Médio-alto (exploração pura) | Médio | Pouca construção, que é o que o Roger mais gosta; comida limitada pode frustrar | O diário ilustrado que se preenche com os achados |
| Mascates do Vale | Médio | Médio-alto (caminho e carroças animadas) | Virar quebra-cabeça de rotas frio | Desenhar trilhas e ver a vida passar por elas |
| Província | Médio sozinho, alto como camada | Alto | Sem desafio próprio; muitas telas | O mapa de regiões como coleção das ilhas já jogadas |

**Melhor para começar: Ilha das Lanternas** (mantive a ordem anterior). Motivos: é a única que junta as três coisas que o Roger mais gosta (construir, explorar, meta simples) com o menor custo; a regra cabe em 5 cartas e 2 recursos; e a recompensa visual (a ilha acesa à noite) é forte e barata.

## Ordem dos esboços e critérios

**Ordem:** Ilha (feito) > Quatro Estações enxuta (2 recursos, sem trabalhadores) > Diário de Bordo > Mascates > Província como camada da Ilha (cada ilha jogada vira uma região).

**Critérios comuns a todos os jogos.**
- Continuar se: o Roger joga 2 partidas seguidas por vontade própria; o simulador mostra planejador > guloso em pelo menos 1,2 vez e escolha apertada entre 25% e 65%; e uma captura sozinha já dá vontade de jogar.
- Parar se: depois de 2 rodadas de ajuste as escolhas continuam óbvias (uma carta acima de 45%) ou a partida passa de 15 minutos; ou se o Roger acha a conta mais interessante que a paisagem.

**Critérios específicos.**
- Estações: parar se precisar de um 3º recurso.
- Diário: parar se a fome decidir mais que a curiosidade.
- Mascates: parar se traçar trilhas não for gostoso no toque.
- Província: só começar quando a Ilha tiver 10 partidas jogadas.

**Os 3 primeiros pedidos de maior valor de cada jogo** (para a Ilha, são os próximos passos):

- **Ilha:**
  1. O Roger joga 3 partidas e anota onde ficou sem saber o que fazer. Pronto quando houver 3 anotações.
  2. (feito) Sobra de comida resolvida com a festa da noite; ver `docs/simulacao.md`.
  3. Clima tocável, à moda do Weatherglass: tocar no céu chama chuva, que faz os campos renderem +1 naquele turno. Pronto quando aparecer na captura e no simulador.
- **Estações:** (1) regra com formas simples e simulador (4 estações × 6 turnos, 2 recursos); (2) um canto do mapa bonito em cada estação; (3) o Roger joga.
- **Diário:** (1) regra de navegação e comida com simulador; (2) a página do diário desenhada; (3) o Roger joga.
- **Mascates:** (1) traçar trilha no toque com formas simples; (2) carroças andando; (3) o Roger joga.
- **Província:** (1) salvar cada ilha jogada; (2) o mapa de regiões com as ilhas; (3) uma meta que atravessa ilhas.

## Decisões tomadas

- **WebGL, não WebGPU**, por robustez: funciona em mais aparelhos e navegadores.
- **Projeto independente** em `jogos/lanternas`, sem mexer no Retalhos.
- **Regras em código puro**, sem tela, testável com semente: a mesma semente dá a mesma partida, por isso o simulador é confiável.
- **Números ajustados pelo simulador** (os motivos estão em `docs/simulacao.md`):
  - Casa passou de 1 para 5 de comida e Lanterna de 2 para 4 de óleo, porque os recursos sobravam e Campo e Oliveiral não valiam nada;
  - baralho de 58 cartas, para que as cartas que sobram sejam uma escolha de verdade;
  - a noite queima 2 de óleo por lanterna, o que liga a economia à noite;
  - festa da noite: a comida guardada vira moradores e o estoque zera, para a comida pesar a partida inteira (testadas também casa mais cara e fome; ver `docs/simulacao.md`);
  - socorro da lanterna: se a luz não tem mais terra vazia, a lanterna pode ir à névoa encostada, o que resolveu a única partida travada;
  - mão garantida: se nenhuma das 3 cartas cabe, a 3ª é trocada por uma que caiba;
  - jogadores automáticos sem espiar a névoa: a primeira versão trapaceava, e as metas foram recalibradas depois disso (52 moradores, 5 achados, fileira de 4, 80% da ilha).
- **Arte toda em código**, sem arquivos de imagem ou modelo.
- **Fontes do sistema**, sem baixar nada da internet.
- **HTML único**, que abre offline.

## Próximos 3 passos

1. O Roger joga 3 partidas e anota onde ficou sem saber o que fazer (pronto com 3 anotações).
2. (feito) A sobra de comida foi resolvida com a festa da noite (comida final média 0, óleo 5,8, todos os critérios passando).
3. Clima tocável: tocar no céu chama chuva, que faz os campos renderem +1 naquele turno (pronto quando aparecer na captura e no simulador).

## Quem fez o quê

- **Opus 5.5:** avaliou, planejou e auditou (rodou o check e olhou as capturas, apontou o botão Descartar na tela final e a sobra de comida).
- **Haiku:** leu e resumiu as skills threejs-* e frontend-design.
- **Sonnet 5.5:** construiu as regras, o simulador, o protótipo, a passada visual, as capturas e este relatório.
