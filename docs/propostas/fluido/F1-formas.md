# F1 · A forma da peça e do tabuleiro (menos hexágono, mais paisagem)

Pedido do Roger: um encaixe mais fluido, menos preso ao hexágono, sem só dissolver o visual. Aqui eu mexo na geometria de verdade. Sete ideias, uma ilustração cada (F1-1.svg a F1-7.svg, nesta pasta). Tamanhos: P dias, M 1 a 2 semanas, G várias, GG um mês ou mais.

**Pesquisa feita:** [como o Townscaper funciona](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making) (grade torta de quadriláteros, peças de "wave function collapse", nascido do Brick Block) e [Islanders](https://en.wikipedia.org/wiki/Islanders_(video_game)) (pontos por vizinhança, prévia dos pontos antes de pôr). As buscas sobre Tiny Glade e Taluva não devolveram nada útil. O que digo de Dorfromantik, Carcassonne, Taluva, Cascadia, Kingdomino, Patchwork, Calico, Mini Metro, Terra Nil e dos mosaicos de Penrose e octógonos vem do meu conhecimento, não de fonte conferida agora. Os números dos exemplos são de mesa, não simulados.

**Lição da Colcha:** toda ideia abaixo muda o chão que o jogador já enxerga (peça, contorno, ilha, região). Nenhuma põe uma camada de símbolos por cima.

---

## 1. Fatias (tabuleiro de triângulos) · SVG F1-1
- **Regra.** O hexágono vira seis triângulos soltos. Cada fatia tem um terreno e três lados. A peça é um grupo de 1 a 4 fatias coladas (20% uma, 40% duas, 30% três, 10% quatro), com 6 giros. Lado igual com lado igual paga +3; rio e estrada continuam estritos (a fatia de rio tem duas bordas de água e uma margem livre, então uma fila de fatias faz um rio em zigue-zague).
- **Exemplo.** Jogada 5: você tem um losango (prado + floresta). Gira até a floresta ficar contra uma floresta (+3) e o prado contra o prado do Centro (+3), e o lado de baixo ainda toca uma plantação, sem par (0). Total +6. Antes (hexágono) esse prado só entraria com um giro perfeito de seis bordas.
- **Sente.** Cada peça é um recorte pequeno, então quase sempre cabe: a calma vem de nunca ficar sem jogada. O mapa fica com manchas de terreno de contorno diagonal, não em favos.
- **Original.** Dorfromantik, Carcassonne e Taluva têm peça de tamanho fixo. Aqui o tamanho varia dentro da mesma grade, e o hexágono antigo é só mais uma peça de 6 fatias (seu equivalente cabe no jogo).
- **Tela.** Chão por triângulo com mistura de cor nas divisas (a costura de cor que já existe, `seamAt`, vale para qualquer divisa). Árvores e casas por fatia. Rio sai por curva suave pelos centros das fatias.
- **Relevo e água.** Melhora: o relevo passa a ficar nos vértices do triângulo (compartilhados por 6 fatias), e a água segue as bordas que descem. Rio de fatias é meandro natural.
- **Código.** `hex.ts` ganha uma grade triangular (`tri.ts`: índice, vizinhos, vértices); `board.ts` troca "6 bordas" por "3 lados" mas a lógica de grupos, missões e fechamento de cerco se reaproveita (~60%). `pickHex` vira `pickTri` (mesma conta de `worldToHex` com uma divisão a mais). `buildTile` precisa de uma versão por fatia, e os blocos 8x8 viram regiões em triângulos. Oráculo de `tests/logic.ts` reescrito; `SAVE_VERSION` novo.
- **Riscos.** Legibilidade (triângulos pequenos demais; começar com fatia de ~0,6 do raio atual), desempenho (3 a 4 vezes mais células por área, então decoração por fatia deve ser mais rala), equilíbrio (refazer tabelas de pontos). Pilha travar: quase nunca (a fatia única cabe em qualquer lado aberto).
- **Tamanho: GG.**

## 2. Cacos (malha irregular que cresce) · SVG F1-2
- **Regra.** O mapa é uma malha de Voronoi relaxada, de células com 4 a 7 lados, gerada pela semente em anéis conforme o jogador avança (a terra incógnita revela as células). A peça sempre tem 6 setores de terreno; ao pousar numa célula de n lados, ela se estica: com n = 5 dois setores vizinhos se fundem (vale o do terreno mais frequente na peça), com n = 7 um setor se divide.
- **Exemplo.** Peça com setores prado, prado, floresta, floresta, rio, rio cai numa célula de 5 lados: prado e prado ficam em 1 lado, e as 2 florestas e 2 águas ficam 1 lado cada ou 2 e 2 conforme o giro. Se 3 lados encostam em terreno igual: +30.
- **Sente.** Ruas tortas de cidade antiga; cada célula tem cara própria e "pede" um tipo de peça (célula de 7 lados quer uma peça de 3 terrenos).
- **Original.** É o Townscaper sem o clique livre, com a regra do Dorfromantik. Nenhum jogo de peças que eu conheça estica a peça para a célula.
- **Tela.** Chão por polígono, bordas suaves; as cercas e trilhas vão pelas arestas. As casas giram para ficar paralelas ao lado mais longo.
- **Relevo e água.** Bom: o relevo e a água podem seguir as arestas do Voronoi, e o rio sobe pelo vale entre dois cacos.
- **Código.** O core vira um grafo em vez de `DIRS` (14 usos em `board.ts`, 26 no oráculo, ~40 no render). `pickHex` vira busca do ponto dentro do polígono. Reaproveita grupos e missões (~45%). Malha determinística: Voronoi por pontos da semente com 3 relaxamentos (como na ilustração), precisa de inteiros para o replay não divergir entre navegadores.
- **Riscos.** Confusão ao esticar (a prévia deve mostrar a peça já esticada), células pequenas demais, peça com rio numa célula de 4 lados (decidir que rio nunca se funde: se não cabe, a célula some da lista de jogadas válidas, e precisa de descarte).
- **Tamanho: GG.**

## 3. Contorno livre (quebra-cabeça sem grade) · SVG F1-3
- **Regra.** Peças são manchas de contorno ondulado (um terreno grande, às vezes uma ponta de outro). Você arrasta e gira livre; ao soltar perto, a peça "gruda" no melhor ajuste entre os contornos (o jogo calcula uma lista fixa de até 24 poses de encaixe por peça, então o save guarda só o número da pose). Pontos pelo comprimento de contorno que casa: +10 por unidade de comprimento igual.
- **Exemplo.** Mancha de plantação de contorno 9 unidades: a pose A casa 4 com outra plantação (+40), a pose B casa 6 com plantação e 2 com vila na interação (+60 +10). Você escolhe a B.
- **Sente.** Quebra-cabeça de verdade, de mesa, de olhar o encaixe e sentir ele entrar.
- **Original.** Dorfromantik é uma grade com visual de natureza; aqui a forma é o jogo. Lembra Patchwork e Calico só no tato do recorte.
- **Tela.** Contornos com borda de terra, rios que atravessam a divisa como curva única, estradas por spline.
- **Relevo e água.** O melhor casamento de todos com a água contínua, mas o relevo tem de ser contínuo (campo de altura por ponto), o que o `relief.ts` já dá.
- **Código.** Core novo (geometria contínua, interseção de polígonos, lista de poses, inteiros fixos). Reaproveita só ~25%: missões, sítios e partes de pontuação. `pickHex` vira picking por polígono; blocos 8x8 viram células de hash espacial; oráculo novo.
- **Riscos.** O maior: a pilha travar (contorno sem espaço) e a legibilidade da pontuação. Determinismo entre máquinas.
- **Tamanho: GG, e a mais arriscada.**

## 4. Losangos de Penrose · SVG F1-4
- **Regra.** O tabuleiro é feito de dois losangos de lados iguais, o gordo (72°) e o fino (36°), na proporção de ouro (~62% gordos). Cada lado carrega um terreno. Como todos os lados têm o mesmo tamanho, qualquer lado aceita qualquer losango, e vale só o que cabe no ângulo (soma 360°, sem sobreposição). Lado igual +10.
- **Exemplo.** Em volta de um vértice já há 288° ocupados; sobram 72°: só o losango gordo cabe (pelo ângulo de 72°), e girado de duas maneiras. Uma das duas leva 2 lados iguais: +20.
- **Sente.** A simetria de cinco pontas mostra uma estrela de dez braços e o mapa nunca se repete: um jogo "de matemática bonita".
- **Original.** Penrose em jogo de peças é raro; o jogador decide pelo ângulo, não pelo giro.
- **Tela.** Cada losango é um campo comprido; o fino (36°) é estreito e serve de rio, trilha ou muro. Casas só nos gordos.
- **Relevo e água.** Neutro; rio em losango fino é uma boa curva.
- **Código.** Geometria de polígonos regulares de lados iguais (um `pen.ts` com vértices em inteiros no corpo Z[φ]). Reaproveita ~35%.
- **Riscos.** Há configurações "mortas" (um ângulo de 36° ou 144° que nenhuma peça fecha), então precisa regra de perdão. Pouca "paisagem" legível nas pontas finas.
- **Tamanho: GG.** Fica bonito, mas é o mais "mesa de matemática" do lote.

## 5. Costura de ilhas (mapa que se costura) · SVG F1-5
- **Regra.** O mapa começa em três ilhotas soltas no mar (5, 4 e 3 peças hexagonais, as de hoje). Você joga como sempre em qualquer ilha. A cada 8 jogadas ganha uma **agulha**: escolhe uma ilha e o jogo mostra as poses possíveis para colá-la em outra (deslocamento mais giro de 60°, no máximo 12 poses, sem sobreposição); a prévia dá os pontos. Cada borda que casa paga +10 e o nó (a costura) paga +25.
- **Exemplo.** A ilha B (4 peças) e a ilha A têm 3 poses viáveis. A melhor gira 120° e casa 2 bordas de floresta e 1 de rio: 3 × 10 + 25 = +55, e o rio de B passa a ser o mesmo grupo do rio de A. Se você ignora a agulha, perde só a oportunidade.
- **Sente.** Trabalho de colcha: remendar pedaços. O mapa deixa de ser um bloco só crescendo do Centro e vira arquipélago que se junta.
- **Original.** Taluva e Dorfromantik só crescem a partir do que está lá. Aqui os pedaços se movem. Fora do hexágono só no destino (as ilhas são hexagonais, mas o conjunto não).
- **Tela.** Mar entre as ilhas (o `Theme.surround 'mar'` já existe); a ilha escolhida "flutua" um pouco e desliza com sombra até a pose; ao colar, uma linha de pontos dourados marca a costura.
- **Relevo e água.** Excelente: o rio que termina na praia de uma ilha vira queda para o mar; costurar ligas dois rios. Cada ilha tem seu nível de base, e a costura precisa de ±1 de diferença (o modo Relevo A/B já mede isso).
- **Código.** Giro e deslocamento de um conjunto de hexágonos é só aritmética axial: `{ q, r } → rotação → soma`. `Board` ganha `islands: Placed[][]` ou uma `islandId`, a `place` não muda, e a jogada nova `['costura', ilha, pose]` entra no save. Reaproveita ~85%. O bloco estático é só de acrescentar (invariante 10), então a ilha movida precisa de bloco novo (ou o bloco sai da ilha ao se colar: ver riscos).
- **Riscos.** Os blocos 8x8 e o mapa do chão só crescem; mover uma ilha pede reconstruir seus blocos (o caro é pouco: poucas peças por ilha). Câmera precisa abrir para o arquipélago. Equilíbrio das agulhas.
- **Tamanho: M.**

## 6. Fusão em regiões (peças que viram uma só) · SVG F1-6
- **Regra.** Sete peças formando uma flor (centro mais seis ao redor), com o mesmo terreno dominante, se fundem em uma **região**: as divisas somem, a decoração vira um bosque, lago ou aldeia só, e o contorno fica suave (um superhexágono torto, como o "floco" de Gosper, que gira ~19°). A região conta como uma peça grande de 18 bordas e paga o tamanho: +4 por peça fundida.
- **Exemplo.** Floresta de 7 peças cercada: +28 e a região fica com 18 bordas abertas, e cada uma vale +10 como as demais. Uma peça vizinha agora encosta numa borda larga de floresta.
- **Sente.** Ver o mapa "assentar": seis peças que eram favos viram uma mata de verdade. Recompensa visual de cuidado.
- **Original.** A peça cresce de escala; no Dorfromantik o grupo só pontua, não muda de forma.
- **Tela.** O chão da região tem cor e relevo contínuos, copas em rede, e o contorno externo é redesenhado, então o mapa perde o aspecto de favo nos pontos fundidos.
- **Relevo e água.** Bom: rio fundido fica um lago ou um rio largo contínuo.
- **Código.** Detecção da flor de 7 (como o cerco, `closed`), `Placed.region`, grupos já cobrem a soma. O render de região é o trabalho: um bloco de chão novo cobrindo 7 peças (append-only: a região vai por cima, como o remendo da proposta 13, ~0,02 mais alto). Reaproveita ~75%.
- **Riscos.** Raro demais se exigir 7 iguais (usar "dominante em 5 das 7"); regiões sobrepostas; confusão com o cerco.
- **Tamanho: M.**

## 7. Octógonos e praças (duas escalas, quadrados a 45°) · SVG F1-7
- **Regra.** Tabuleiro de ladrilho 4.8.8: octógonos (peça grande, 8 bordas: 4 retas e 4 diagonais) e quadradinhos girados 45° nas frestas entre quatro octógonos (peça pequena, 4 bordas). A pilha traz os dois tipos (3 grandes para 1 pequena). A praça sempre toca 4 octógonos, e quando as 4 bordas casam paga +40.
- **Exemplo.** Frestas abertas entre 4 octógonos: prado, prado, plantação, plantação. A praça de plantação e prado girada 90° casa as 4: 4 × 10 + 40 = +80, só dela.
- **Sente.** Duas velocidades: peça grande para o desenho, praça pequena para o "arremate".
- **Original.** Nenhum jogo de peças mistura duas escalas com um ladrilho arquimediano.
- **Tela.** Octógonos de campo largo, praças como pracinhas, poços, chafarizes, pontes pequenas.
- **Relevo e água.** O rio passa pelas frestas, o que dá curvas de 45° quase de graça.
- **Código.** Grade quadrada rotacionada, dois tipos de célula; `board.ts` quase refeito (~30% reaproveitado).
- **Riscos.** Parece tabuleiro "de xadrez", pouco fluido, e o objetivo do Roger é o oposto. Pior encaixe com o pedido.
- **Tamanho: G.**

---

## Ranking e recomendação franca
| # | Ideia | Fluidez | Calma | Tamanho | Aproveita |
|---|---|---|---|---|---|
| 1 | Fatias | alta | alta | GG | 60% |
| 2 | Costura de ilhas | média | alta | M | 85% |
| 3 | Fusão em regiões | média | alta | M | 75% |
| 4 | Cacos | alta | média | GG | 45% |
| 5 | Penrose | alta | média | GG | 35% |
| 6 | Contorno livre | muito alta | baixa | GG | 25% |
| 7 | Octógonos e praças | baixa | média | G | 30% |

Francamente: **Fatias** é a que responde ao pedido ("menos apegado ao hexágono") sem perder o que faz o jogo funcionar (uma regra simples, sem trava), e dá de brinde um relevo em vértices. Custa um mês. **Costura de ilhas** é o caminho barato: é a única que mexe na forma do mapa e cabe em duas semanas, e pode vir antes para o Roger sentir. Dá para combinar: Costura agora, Fatias como projeto. Contorno livre é o mais bonito no papel e o mais perigoso para o código e para a calma; só com um protótipo à parte.

## Partida 1 · Fatias (10 jogadas, números de mesa)
Centro: 6 fatias (2 vila, 2 prado, 2 plantação), relevo suave.
1. Losango de plantação, gira para casar 2 lados com as plantações: +6.
2. Fatia de prado, 1 lado com o prado do Centro: +3.
3. Trio de rio (nascente no morro): duas bordas de água, margens no prado: +3.
4. Fatia de vila junto à vila do Centro, 2 lados: +6; interação vila × plantação perto: +2. Total +8.
5. Losango prado/floresta: floresta contra a floresta que ainda não existe, então gira o prado para o prado (2 lados): +6.
6. Trio de rio estendendo o rio de 3 para 6 fatias, água sai de bordas coladas: +6 (2 lados de água).
7. Tetra de floresta (4 fatias) gruda no prado de 5, 1 lado: +3; sobrou uma fatia isolada na ponta e a pilha traz uma fatia de floresta para ela.
8. Fatia de floresta fecha a ponta (3 lados com floresta): +9.
9. Losango de plantação junto ao rio com irrigação: 2 lados +6, interação plantação × prado +2: +8.
10. Trio de vila fecha uma praça de 3 fatias de vila: +9 e a era vira (aviso de nova era).
Total: 61 pontos. O jogador sente que sempre havia onde pôr e que o rio ficou com cara de rio.

## Partida 2 · Costura de ilhas (10 jogadas)
Início: ilha A (Centro, 5 peças), B (4), C (3), com 3 casas de mar entre elas.
1 a 4. Quatro peças na ilha A (prado, floresta, floresta, plantação): +10 +10 +20 +10 = 50.
5. Duas peças de rio na ilha B (rio encosta em rio): +10 (uma borda) e a ponta do rio chega à praia: nada ainda.
6. A agulha chega. Ilha B tem 3 poses viáveis contra A; a prévia mostra +55 (3 bordas: 2 floresta e 1 rio, mais o nó de 25). Você escolhe: a ilha desliza e gira 120°, o rio de B e o de A se ligam: +55. Agora são 9 peças no mesmo grupo de rio.
7. Peça de vila na ilha C: +10 com a vila de C.
8. Peça de rio que fecha o rio ligado até a praia de A: +10 e queda para o mar.
9. Peça de floresta na costura: casa duas bordas: +20.
10. Peça de plantação na ilha A: +10.
Total: 50 + 10 + 55 + 10 + 10 + 20 + 10 = 165 no dia dessa mesa. A agulha seguinte (jogada 14) trará a ilha C. O jogador sente "remendar": ver duas ilhas virarem um continente com um só rio.
