# F2: o encaixe como continuidade da paisagem

Pedido do Roger: um encaixe mais fluido e dinâmico, menos preso ao hexágono. Lição da Colcha: a ideia não pode ser uma camada abstrata por cima do jogo. Aqui, o que se mede é sempre o próprio chão (cor, altura, água, bichos, som). Nenhuma das 20 propostas anteriores é repetida. Ilustrações em `F2-1.svg` a `F2-7.svg`, nesta mesma pasta.

Pesquisa (a busca na web trouxe pouco; o resto é conhecimento prévio, marcado "de memória"): Terra Nil (biomas surgem por condição de solo e água, não por peça); Townscaper (Stålberg: grade irregular e WFC, a forma sai do contexto); Tiny Glade (gridless, detalhe procedural que se adapta ao traço, de memória); Islanders (pontua por raio de vizinhança, de memória); Cascadia (corredores contíguos de habitat, de memória); Proteus e Alba (paisagem como experiência sonora, de memória).

---

## 1. Aquarela (a borda é uma mistura)
- **Regra.** Cada borda comum vira uma mistura de dois terrenos (100/0, 75/25 ou 50/50). Entre duas peças vizinhas, a nota de semelhança é s = 1 menos metade da diferença das misturas. Paga round(10·s) se s ≥ 0,5; "quase igual" vale quase 10. Rio e estrada continuam estritos.
- **Jogada.** Borda 75% prado/25% mata contra prado puro: s = 0,75, +8 (hoje, 0). Duas bordas assim e uma pura: 8+8+10 = 26.
- **Sente.** Alívio: quase nenhuma peça é "errada", e a escolha vira ajuste fino de gradação.
- **Original.** Afasta-se do Dorfromantik (igual ou nada) e vira a Meia-borda (proposta 4) do avesso: ali era binário e ambíguo, aqui é contínuo. Inspiração: Terra Nil (condição graduada).
- **Tela.** O chão já mistura cor entre peças (`seamAt`): a divisa vira degradê de verdade. Fantasma com brilho dourado graduado em cada divisa.
- **Relevo e água.** Intactos; a água segue como hoje.
- **Código.** `core`: `TileDef.mix`, `check`/`place` somam uma nota fracionária, grupos por terreno dominante (≥ 50%). Oráculo: reimplementar a nota. Save v novo. Render: `buildTile` mistura cores e plantas por vértice, e a decoração que já varia por vértice ajuda. Reaproveita ~65%.
- **Riscos.** Inflação de pontos (recalibrar no `balance`); grupos de missão ambíguos; leitura carregada se 40% das bordas forem mistas (limitar a 30%). Trava: nenhuma. Desempenho: nada novo.
- **Tamanho.** M a G.

## 2. Morro e lago (a curva de nível continua)
- **Regra.** Cada peça tem uma curva de nível que cruza duas bordas em um de 3 pontos possíveis (não no meio fixo). As curvas precisam se emendar. Uma volta fechada em 3 ou mais peças ergue um morro (ou, se é água, um lago) e paga pelo número de peças dentro.
- **Jogada.** Você fecha uma volta de 3 peças em duas cotas: 3×6 + 6 do miolo = +24, e o chão sobe um terraço.
- **Sente.** Desenhar à mão livre uma volta que se fecha, como um mapa topográfico.
- **Original.** Afasta-se de Tantrix e da proposta B da Colcha (fio de costura): aqui a linha é altura real e o prêmio é o relevo que se ergue. Inspiração: curvas de nível dos mapas; Townscaper (a forma nasce do conjunto). Cuidado: parece o "Relevo A" por fora, mas aqui a regra é a linha, não a diferença de altura.
- **Tela.** Linha fina de nível sobre o chão (como pincel de lápis). Ao fechar, o morro sobe em ondulação.
- **Relevo e água.** O relevo vira o próprio encaixe; o rio nasce do topo do morro e desce (casa com Águas que descem).
- **Código.** `core`: curva por peça (semente), grafo de curvas, detecção de ciclos (BFS, o oráculo pode usar outro método: união-busca). Render: o relevo já existe (modo Relevo); a altura final sai do ciclo. Reaproveita ~45%.
- **Riscos.** Travar: só se a curva for obrigatória; torná-la só prêmio (como a Colcha, mas nenhuma jogada é barrada). Legibilidade média: curvas em cima de rio e estrada. Calma: boa.
- **Tamanho.** G.

## 3. Argila (a divisa cede)
- **Regra.** Quando dois terrenos diferentes se tocam, a divisa não é reta: ela se move para o lado de menor "massa" (peças do mesmo terreno em volta). Isso muda a área de cada mancha. Cada 10% de área que um grupo ganha rende +1 e o jogador vê a mata avançar.
- **Jogada.** Mata com 3 peças contra prado com 1: a mata avança 30% sobre o prado; você põe uma 4ª peça de mata e o grupo passa de 3,0 para 3,6 peças de área (+6).
- **Sente.** Dinâmico de verdade: a paisagem respira a cada jogada, mas só no desenho; ninguém perde nada.
- **Original.** Afasta-se de todo o gênero (peça fixa). Inspiração: Tiny Glade (o contexto deforma a peça) e modelagem de argila.
- **Tela.** Só no sombreador de costura (`seamAt` com um deslocamento por massa). A geometria não muda, e a invariante 10 (blocos só crescem) se mantém.
- **Relevo e água.** O relevo segue; a água ignora a deformação (rio é estrito).
- **Código.** `core`: massa por grupo e área fracionária (puro). Render: mapa de massa no `groundMap` e leitura no chão. Save: igual, a área sai do replay. Reaproveita ~60%.
- **Riscos.** Legibilidade: a divisa que se mexe pode parecer erro de render; mover só devagar (animar 1 s). A pontuação por área exige oráculo novo. Desempenho: leitura a mais de textura no chão (pequeno).
- **Tamanho.** M.

## 4. Orvalho (a umidade pede o terreno)
- **Regra.** A água do mapa (rio, lago, mar) molha em volta: umidade 1,0 na água, 0,7 a 1 passo, 0,45 a 2, 0,25 a 3, 0,1 além. Cada terreno tem uma faixa que gosta: plantação 0,5 a 0,8; mata 0,4 a 1; prado 0,2 a 0,6; vila 0,1 a 0,4. Peça dentro da faixa ganha +8; no meio da faixa, +11. A mata põe +0,1 de umidade nas vizinhas (segura água).
- **Jogada.** Plantação a 1 passo do rio (0,7): +8 de orvalho mais o encaixe de borda de sempre. Vila a 3 passos (0,25): +8; a 1 passo (0,7), nada, e o chão mostra lama.
- **Sente.** Pensar como jardineiro: onde a terra está viva, ponho o que gosta dela.
- **Original.** Afasta-se do Dorfromantik, que só olha a borda; e de Islanders, que pontua por raio de peças, não por um campo. Inspiração: Terra Nil (solo e água definem o bioma) e SimEarth.
- **Tela.** Nenhuma legenda: o próprio chão fica mais verde onde há umidade, com orvalho e névoa baixa (já existe névoa rasteira). Plantação seca fica palha.
- **Relevo e água.** É a ideia que mais usa o que já existe: a água que desce passa a ser a fonte do campo. Combina com Águas que descem.
- **Código.** `core/moisture.ts` (puro: BFS de distância da água). `check` não muda; `place` soma um bônus. Render: cor do chão por umidade. Reaproveita ~75%.
- **Riscos.** Virar camada abstrata se o campo não aparecer no chão (por isso o chão é o mostrador). Jogador pode ver só um número: usar a cor, não o número. Trava: nenhuma, pois é só prêmio.
- **Tamanho.** M.

## 5. Corredor (o rebanho precisa de passagem)
- **Regra.** Rebanhos nascem em matas e andam por terreno aberto (prado, plantação, estrada), parando em vila, rio sem ponte e vazio. Se acham outra mata, o corredor liga as duas: +5 por casa de percurso. O rebanho anda de verdade pelo `Life`.
- **Jogada.** Duas matas a 4 casas de distância, ligadas por prado: +20. Pôr uma vila no meio fecha o corredor; trocar por plantação o reabre.
- **Sente.** Olhar o caminho do bicho e abrir a passagem. Um brinquedo, não uma conta.
- **Original.** Afasta-se do Cascadia (corredor de habitat só conta peças; aqui há movimento) e do Peregrino (proposta 10, um aldeão a um sítio). Inspiração: Rain World (bichos com rotinas), Cascadia.
- **Tela.** Veados e ovelhas já existem no `Life`. Um rastro leve onde passam; um ponto de brilho quando chegam.
- **Relevo e água.** Subir e descer só desvia o caminho (rampa íngreme fecha); a ponte (kit `bridge`) abre o rio.
- **Código.** `core/herds.ts`: busca de caminho em grafo hexagonal, determinística da semente. `Rules.corridors`. Render: reaproveitar `Life`. Reaproveita ~60%.
- **Riscos.** Parece o trilho da ferrovia; calma média; o caminho muda a cada peça (recalcular só nas vizinhas, desempenho ok).
- **Tamanho.** M.

## 6. Coro (cada terreno é uma voz)
- **Regra.** Cada terreno toca uma voz (mata grave, prado pad, plantação ritmo, vila melodia, rio fluxo). Onde três peças se tocam no mesmo canto, as vozes formam um acorde: se consoante (3 notas da pentatônica), +12 e o som abre uma camada.
- **Jogada.** Mata, prado e plantação num canto fecham uma tríade: +12 e um coro novo entra na música.
- **Sente.** Ouvir o encaixe: o fantasma já toca como soaria; acertar é prazer de ouvido.
- **Original.** Afasta-se de tudo no gênero. Inspiração: Proteus e Alba (paisagem ouvida), Mini Metro (música da rede) e a skill `audio-design` (camadas e ducking).
- **Tela.** Quase nada novo: faíscas de luz pequenas no canto que fecha. Funciona para daltonismo (acerta-se de olhos fechados).
- **Relevo e água.** A altura muda o timbre (mais agudo no alto); a água é a voz de fundo.
- **Código.** `audio.ts` (voz por terreno e acorde); `core` só uma regra de canto consoante, no estilo dos nós da Colcha. Reaproveita ~80% do áudio. Atenção: é uma camada nos cantos como a Colcha; só vale se o som for o prêmio, não só o ponto.
- **Riscos.** Repetir a rejeição da Colcha (camada nos cantos). Música enjoativa. Desempenho: baixo.
- **Tamanho.** P a M.

## 7. Peça rasgada (sem hexágono)
- **Regra.** A peça é um polígono irregular com contorno "rasgado" (curva de ruído por terreno). Gira em qualquer ângulo e desliza; encaixa quando seu contorno casa com o de uma vizinha, e a nota é pela folga (s = 1 menos a área de vão / área do contorno). Sem grade; as vagas vêm do contorno que já existe.
- **Jogada.** Peça de mata gira 37° e fica com vão de 8% contra o prado: s = 0,92, +9 por borda; 3 bordas, +27.
- **Sente.** Quebra-cabeça de verdade, mas sem peça "errada": a que casa mal só rende menos.
- **Original.** Afasta-se do Dorfromantik, do Taluva e de todo jogo de grade. Inspiração: Townscaper (grade irregular) e Tiny Glade (sem grade).
- **Tela.** Toda a malha do mundo muda: peças com borda curva e chão contínuo.
- **Relevo e água.** O relevo pode ser contínuo (um campo de altura global); a água precisa de nova regra de emenda.
- **Código.** Reescreve `hex.ts`, `board.ts`, `tileBuilder`, blocos estáticos, minimapa, clique, fantasma, oráculos, save. Reaproveita ~20%.
- **Riscos.** Todos: travar, legibilidade, desempenho, equilíbrio. É a ideia mais ousada e a mais cara.
- **Tamanho.** GG.

---

## Ranking
1. **Orvalho** (M): usa o que já existe (relevo e água), nunca trava, o chão é o mostrador, e não repete nada.
2. **Aquarela** (M a G): a resposta direta a "fluido, menos apegado ao hexágono"; a nota gradual troca "igual ou nada" por ajuste fino.
3. **Argila** (M): a mais dinâmica de ver; sem mexer em geometria; boa para combinar com a Aquarela (a divisa mistura *e* cede).
4. **Corredor** (M): vivo e bonito, mas lembra ferrovia e Peregrino.
5. **Morro e lago** (G): a mais ligada ao relevo, mas cara e parecida com Tantrix.
6. **Coro** (P a M): bom em acessibilidade, mas é camada nos cantos (risco Colcha).
7. **Peça rasgada** (GG): a mais original, mas é outro jogo.

## Recomendação franca
Faça **Orvalho + Aquarela** como dois modos pequenos, nesta ordem. O Orvalho é barato, usa o relevo e a água que o Roger já gosta, e testa se "o chão pede" funciona. Se o Roger quer sair do hexágono de verdade, a Peça rasgada é a única que o faz, mas é GG e pede decisão de projeto, não protótipo. O Coro é bom como acréscimo de áudio, nunca como o encaixe principal.

---

## Partida 1: Aquarela, 10 jogadas
Centro: prado puro (P100). Notas: P = prado, F = mata, C = plantação.
1. P75/F25 ao norte do Centro: s = 0,75, +8 (total 8).
2. P100 ao sul: s = 1, +10 (18).
3. P50/F50 entre 1 e o Centro: com a 1, s = 0,75, +8; com o Centro, s = 0,5, +5 (31).
4. F75/P25 ao lado da 3 (F50): s = 0,75, +8 (39).
5. F100 junto da 4: s = 0,75, +8 (47).
6. F100 entre a 5 (F100, +10) e a 4 (F75, +8): +18 (65).
7. Vila ao lado do Centro: borda diferente, nota 0; interação vila×prado, +5 (70).
8. Plantação ao lado do prado: interação, +5 (75).
9. Fecha buraco: P75/F25 com três contatos, 8+8+10: +26 (101).
10. Rio liga com rio (estrito): +10 (111).
O jogador nunca travou, e a partida inteira lê como um degradê de verde. Ao fim, 4 jogadas "quase" valeram 8, que antes valiam 0.

## Partida 2: Orvalho, 10 jogadas
Rio corre do Centro para o mar. Umidade: 1,0 / 0,7 / 0,45 / 0,25 / 0,1.
1. Plantação a 1 passo (0,7): borda 10 + orvalho +8 = 18.
2. Outra plantação a 1 passo, ao lado: 10 + 8 = 18 (36).
3. Vila a 3 passos (0,25): borda 0, interação 5, orvalho +8 = 13 (49).
4. Mata a 2 passos (0,45): borda 10 + orvalho +8 = 18 (67). A mata sobe a umidade das vizinhas em +0,1.
5. Prado a 2 passos: agora 0,55, na faixa: 10 + 8 = 18 (85).
6. Vila a 1 passo (0,7): fora da faixa: só borda 10, o chão vira lama (95).
7. Vila trocada pelo jogador para o morro seco (0,25): 10 + 8 = 18 (113).
8. Plantação a 3 passos (0,25): fora da faixa: só 10 (123).
9. Mata a 3 passos (0,25): fora da faixa (0,4 a 1), mas a mata da 4 a acompanha para 0,35: ainda fora; só 10 (133).
10. Lago novo: a umidade sobe ao redor; 3 peças entram na faixa: +8×3 = 24, e 10 do encaixe: 34 (167).
O jogador sente a água "andando" pelo mapa, e a 10ª jogada recompensa quem pensou na água, não só na borda.
