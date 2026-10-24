# E2: encaixes radicais para o Retalhos

Ângulo: esquecer "borda igual com borda igual" e deixar a PAISAGEM decidir. Nada de camada abstrata
(a Colcha foi recusada por isso). Toda ideia usa algo que já existe: o relevo, os sítios, o sol e as
estações, os aldeões do `Life`. Tamanhos: P = dias, M = 1 a 2 semanas, G = várias semanas, GG = reescreve o jogo.

Achado que abre portas: `src/core/relief.ts` (`levelAt`) já dá o nível (0 a 2) de QUALQUER casa, até das
vazias, como função pura da semente. Hoje só o render lê. O "tabuleiro que já existe por baixo" está
pronto; falta o `core` lê-lo. Isso não altera a pilha nem a sequência de peças.

## 1. Águas que descem (a água precisa chegar ao mar)

- **Regra.** Algumas casas altas (nível 2) escondem uma nascente. Um rio que parte da nascente e só desce
(cada peça de rio com nível igual ou menor que a anterior) vale +8 por peça. Quando o curso toca um lago
ou chega ao nível 0, "chega ao mar": bônus de +60 e 2 peças. Rio que sobe não é proibido, só vira água
parada (vale 0).
- **O jogador sente.** Que desenha um vale. Olha o morro, imagina por onde a água quer ir, e cada peça de rio
ganha um destino. Alívio quando o último trecho encosta no lago e a água "solta".
- **Original.** No Dorfromantik o rio é uma borda como outra. Aqui tem ORIGEM, DIREÇÃO e FIM, e quem manda é o
chão. Carcassonne e Tantrix ligam caminhos sem o terreno opinar. Taluva usa altura só para empilhar.
- **Na tela.** Quase nada novo: o rio já corre e tem cachoeira. A nascente é uma poça brilhante com junco.
Na chegada, o brilho e uma garça (`celebrate` existe). Rio parado perde a correnteza e fica espelhado.
A prévia dourada já mostra o +8.
- **Código.** `core`: `water.ts` novo (nascentes por semente, nível por casa, busca do curso nos grupos de rio
que o `board.ts` já calcula); `Rules.springs` (0 = desligado); pontos em `place()`. Render: poça, e
correnteza zerada no rio parado (`resolveFlow`). Reaproveita ~85%.
- **Riscos.** Trava: nenhuma. Confusão: o relevo tem de ser legível no vazio (hoje só as peças postas mostram
degraus). Calma: boa, é prêmio e não castigo. Só 17% das peças têm rio: subir para ~24% no modo. **M.**

## 2. Sol e sombra (a luz da tarde decide onde cada coisa rende)

- **Regra.** O sol dá um passo ao redor do mapa a cada 10 jogadas (derivado do índice, como as estações; nada
no save). Uma casa fica na sombra se a vizinha do lado do sol é mais alta. Plantação ao sol rende +4 por
borda; floresta e vila na sombra rendem +3. Teto de +12 por peça.
- **Sente.** Que a paisagem é de verdade: o morro faz sombra, o trigo quer sol, a mata fica atrás do morro.
- **Original.** Cascadia e Isle of Skye pontuam por padrões; Tiny Glade tem sol bonito sem regra. Nenhum
puzzle de peças usa a luz como regra, e aqui a sombra que se vê é a que vale.
- **Tela.** O sol do jogo já se move e projeta sombra. Casas válidas mostram um leve claro ou escuro quando o
fantasma passa, e a etiqueta dá o ganho. Sem ícones. Um pequeno relógio de sol diz para onde ele vai.
- **Código.** `core`: função pura `lit(seed, q, r, passo)` (em `relief.ts` ou `sun.ts`), `Rules.sun`. Amarrar o
sol visual ao mesmo passo em `skyFor`. Variante: o VENTO, girando ao contrário (moinho rende com campo
aberto contra o vento). Reaproveita ~90%.
- **Riscos.** Com 3 níveis haverá poucas sombras (talvez mais relevo no modo). Pode virar só tabela de bônus.
A rotação da peça quase não importa (a luz é por casa). **M.**

## 3. Peregrino (alguém caminha, e você abre o caminho)

- **Regra.** A cada 12 jogadas um peregrino sai do Centro rumo a um sítio escondido. Por jogada, anda UMA casa
por terreno aceito (vila, estrada, prado, plantação; floresta só com trilha; rio só com ponte). Sem caminho,
espera sentado, sem castigo. Ao chegar, o sítio paga o dobro e ele volta com +1 peça.
- **Sente.** Cuidado com uma pessoinha: cada peça vira "será que ele passa?". É a mais afetiva.
- **Original.** O trem do Dorfromantik é objetivo estático. Aqui o caminhante é vivo, anda no ritmo das
jogadas e a rota é sua. Townscaper e Tiny Glade têm gente, sem regra.
- **Tela.** Aldeão com cajado (o `Life` já tem aldeões), pegadas que apagam, fogueirinha quando espera.
- **Código.** `core`: `walker.ts` (BFS sobre as casas postas, determinístico; estado derivado do replay, sem
mudar o save). Usa `sites.ts` e a ideia de rede de `routes.ts`. `Life` segue o estado do `core`. ~70%.
- **Riscos.** Sítio longe deixa o peregrino parado por 30 jogadas: sortear a 4 ou 5 casas. Parece a Estrada
Real, então precisa valer pela pessoa e não pela conta de distância. **M.**

## 4. Mapa a lápis (o quebra-cabeça de verdade)
- **Regra.** A semente esconde uma paisagem-gabarito: o que um guloso determinístico jogaria com a MESMA
pilha (logo, existe solução). O vazio mostra um esboço a lápis do que cada casa quer ser. Peça cuja cor
dominante bate com o esboço "passa o lápis a tinta": +6 por casa. Desenho todo pintado dá o selo "obra".
- **Sente.** Que restaura um quadro. Pode ignorar o esboço e jogar como hoje; ele só sugere um rumo.
- **Original.** Nenhum jogo de peças dá um ALVO visual no mapa: é a figura na tampa da caixa. No Desafio do
dia todos restauram o MESMO quadro e comparam a foto.
- **Tela.** Traços de lápis e sépia no pergaminho do vazio (`makeVoidMaterial`); ao pousar, vira cor.
- **Código.** `core`: `sketch.ts` (guloso sem `Math.random`, versão fixada), `Rules.sketch`. Render: textura
do esboço no mapa do vazio (`groundMap`). ~50%.
- **Riscos.** O maior do lote. Pode poluir o mapa como a Colcha e levar a copiar em vez de olhar. Se o guloso
mudar, o quadro muda (fixar versão). Só como modo à parte. **G.**

## 5. Retalhos de dois (peças de duas casas que se partem)
- **Regra.** Uma peça em cinco vem dupla: duas casas coladas, emenda resolvida (o rio atravessa). Coloca-se
a dupla inteira (12 giros) ou se PARTE: cada metade vira peça comum, uma agora e outra na jogada seguinte,
ao custo de 1 peça da pilha. Dupla com 4+ bordas encaixadas paga +30.
- **Sente.** Dilema leve: o par grande ou o seguro. Vê a paisagem em trechos maiores.
- **Original.** Carcassonne e Dorfromantik jogam uma peça por vez; Taluva tem 3 casas, mas fixas. Aqui a peça
se DIVIDE (o retalho rasgado).
- **Tela.** Dois hexágonos que descem juntos, com costura clara na emenda; ao partir, a costura se solta.
- **Código.** Cada dupla são DUAS `TileDef` ligadas (`pair`) com a borda interna igual; `place()` roda duas
vezes. Faltam validar o par, tipos de peça na pilha e fantasma de duas casas (`liveTile`, `preview`).
Lógica ~65%; `draw()` e fantasma mudam muito.
- **Riscos.** Travar: não, partir sempre vale. Confusão: 12 giros num jogo calmo; limitar as duplas. **G.**

## 6. Remendo (cobrir uma peça ruim com um retalho)

- **Regra.** Uma peça sem nenhum encaixe pode ser coberta por um retalho novo que encaixe melhor, ao custo de
1 peça. Os grupos são refeitos. Máximo de 3 por partida, uma vez por casa.
- **Sente.** Perdão: errar deixa de ser definitivo, com uma reviravolta suave. Combina com o nome.
- **Original.** Taluva cobre peças para atacar; aqui é para consertar. Nenhum jogo tem o conserto como ação.
- **Tela.** O retalho pousa 0,15 acima, com costura de linha clara. O mapa guarda a história dos erros.
- **Código.** `Board.cover()` refaz grupos. O bloco estático é append-only (invariante 10), então o retalho
é uma peça por cima, mais alta. Jogada nova no save (`SAVE_VERSION`). ~75%.
- **Riscos.** Abuso (por isso o limite). Peça sobre peça pode ficar torta com o relevo. **M.**

## 7. Sucessão (a paisagem muda depois que você sai)

- **Regra.** Prado cercado por 4+ bordas de floresta durante 12 jogadas vira mata jovem. Plantação sem vila
por perto vira pousio. Cada mudança paga +5 e os grupos se refazem.
- **Sente.** Que o mundo respira; voltar a um canto revela algo novo.
- **Original.** Em todos os jogos de peças a peça é fixa. Aqui o tempo trabalha.
- **Tela.** Brotos que crescem em árvores, capim no campo abandonado; transição de cor (existe `eraWave`).
- **Código.** `Placed.edges` passa a mudar (quebra a premissa de borda fixa); replay obrigatório; o render
não troca a decoração depois que a peça pousa. ~40%.
- **Riscos.** Alto: o grupo planejado muda sozinho, oráculo e save complicam, e a calma vira ansiedade se
algo for "perdido". Só vale se toda mudança for sempre boa. **G.**

## Resumo
| # | Ideia | Afasta-se de | Tam. | Calma | Risco |
|---|---|---|---|---|---|
| 1 | Águas que descem | Dorfromantik (rio-borda), Taluva (altura) | M | alta | baixo |
| 2 | Sol e sombra | Cascadia (padrões), Tiny Glade (sol sem regra) | M | alta | médio |
| 3 | Peregrino | Dorfromantik (trem fixo), Townscaper | M | alta | médio |
| 4 | Mapa a lápis | todos (nenhum tem alvo) | G | média | alto |
| 5 | Retalhos de dois | Carcassonne, Taluva | G | média | médio |
| 6 | Remendo | Taluva (cobrir para atacar) | M | alta | baixo |
| 7 | Sucessão | todos (peça fixa) | G | baixa | alto |

## As duas mais promissoras
### A. Águas que descem: regra detalhada
1. **Nascentes.** 3 a 5 casas de nível 2, a 4+ casas do Centro, sorteadas por um gerador à parte (como
   `sites.ts`). Ficam sob a névoa até uma peça encostar, mas o morro já se vê.
2. **Curso.** Grupo de rio que contém a peça da nascente. Desce se, andando a partir dela, o nível nunca sobe.
3. **Pontos.** Peça de rio que se liga a um curso descendo: +8. Chegada: o curso toca um lago (3+ bordas de
   água) ou uma peça de rio em nível 0: +60 e +2 peças, uma vez por curso.
4. **Rio que sobe:** "água parada", +0, sem correnteza. Nunca bloqueia.
5. **Sem nascente:** nada muda. Quem não quiser seguir a água joga como hoje.
6. **Modo.** Entra como modo à parte (`Rules.springs`), `waterChance` 0,24; Clássico intocado no começo.
**Dez jogadas narradas** (semente fixa, Holanda):
1. O Centro está no nível 0. Ao nordeste há um morro com um brilho: uma nascente a 5 casas. Ele põe um prado.
2. Sai um rio reto. Ele o põe na borda leste do prado, apontando para o morro.
3. Floresta: vai do outro lado, fechando o vale. +10 de encaixe.
4. Rio curvo. Ele o encaixa subindo a encosta e a água fica espelhada: +0. Percebe que sobe. Desfaz (`U`).
5. Põe a curva para o outro lado. O rio desce: "+8 curso" em dourado e a correnteza volta.
6. Vila: na margem. A roda d'água (já existe) gira.
7. Outro rio liga a nascente ao curso. +8.
8. Sai um lago (3 bordas de água). Ele o guarda para a boca do vale e põe uma plantação.
9. Rio reto alinha com o lago e pousa: a água solta, a garça sobe, anel dourado. +8, +60 e +2 peças.
10. Com a pilha mais cheia, ele olha a segunda nascente, a sudeste, e a próxima água começa.

### B. Sol e sombra: regra detalhada
1. **Sol.** `passo = floor(índice / 10) % 6`, uma das 6 direções do hexágono. Nada no save.
2. **Sombra.** Casa na sombra se a vizinha na direção do sol tem nível maior. Se for 2 níveis acima, a
   sombra também cobre a casa seguinte.
3. **Pontos.** +4 por borda de plantação ao sol; +3 por borda de floresta ou vila na sombra; teto +12.
4. **Dica.** O chão das casas válidas clareia ou escurece com o fantasma, e a etiqueta dá o ganho.
5. **Vento.** Variante: gira ao contrário, moinho com campo aberto contra o vento rende +4.
**Dez jogadas narradas** (semente fixa, Egito):
1. Sol a leste, Centro plano. Plantação ao sol: +4 por borda.
2. Floresta a oeste da plantação, onde um morro de nível 1 faz sombra: +3.
3. Vila entre as duas. Sem extra, mas encaixa bem.
4. Rio no vale entre os morros: não depende de luz, corre normal.
5. Nova plantação. A melhor casa está na sombra; ele a leva ao outro lado do rio, ao sol.
6. Sai uma floresta e ele a põe atrás do morro alto, onde a sombra é longa: +6 em duas bordas.
7. Vila na sombra fresca ao pé do morro: +3 por borda.
8. Mais rio e mais encaixe, sem ganho de luz; o relógio de sol avisa que o sol vira para o sul.
9. O sol vira. A plantação antiga agora está na sombra (os pontos já foram pagos, nada se perde).
   Nova plantação na outra face do morro.
10. Fecha uma peça de 6 vizinhos e ganha a peça de volta. A luz do jogo vira entardecer e as sombras longas
    pagam a mata nas faces opostas.

## Recomendação franca
**Prototipe primeiro as Águas que descem (1).** O rio já é a coisa mais bonita do jogo, o relevo já existe, a
regra cabe numa frase ("a água só desce até o mar"), não trava ninguém e reaproveita ~85%. É M e liga e
desliga por `Rules.springs`. Condição: o relevo precisa aparecer no vazio, senão ninguém vê a descida.

Depois, **Sol e sombra (2)**, que divide com ela o trabalho de mostrar o relevo. **Peregrino (3)** é o mais
carinhoso e merece um teste. **Mapa a lápis (4)** é a mais ousada e a que mais lembra o risco da Colcha: só
como modo à parte. **Remendo (6)** é barato e serve de apoio a qualquer uma.
