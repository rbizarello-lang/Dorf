// Conteúdo das 20 ideias. size: P, M ou G. orig/calma: baixa, média, alta.
export const FAM = {
  e1: { nome: 'Variações próximas', curto: 'Próximas', tag: 'E1', intro: 'Mudam pouco a regra de hoje (seis bordas, borda igual vale 10, rio e trilho só encostam neles mesmos, quatro pares conversam por 5). Nenhuma obriga jogada: só premia ou afrouxa. Achado geral da simulação: o jogador guloso nunca ficou com a pilha travada no Clássico (0 descartes em 80 partidas), e nenhuma destas ideias endurece a validade, então o risco de travar é nulo.' },
  e2: { nome: 'Encaixes radicais', curto: 'Radicais', tag: 'E2', intro: 'Esquecem o "borda igual com borda igual" e deixam a paisagem decidir: o relevo, os sítios, o sol, as estações, os aldeões. Tudo usa algo que já existe no jogo. O relevo, por exemplo, já é função pura da semente em <code>src/core/relief.ts</code> (<code>levelAt</code>), mas hoje só o render o lê. Tamanhos: P são dias, M uma a duas semanas, G várias semanas.' },
  e3: { nome: 'Relevo na peça', curto: 'Relevo', tag: 'E3', intro: 'A altura deixa de ser enfeite da casa e passa a ser da peça: cada peça sorteada traz um perfil de seis alturas (uma por borda, nível 0 a 2) mais o pico do meio, e quem joga escolhe onde e em que giro encaixá-la. As seis variações abaixo (A a F) diferem em como a altura entra na regra.' }
};

export const IDEIAS = [
  // ---------------- E1 ----------------
  { id: 'vau-ponte', fam: 'e1', nome: 'Vau e ponte', resumo: 'Rio e trilho passam a poder se encostar, e o encontro vira uma ponte que paga pontos.',
    size: 'P', orig: 'baixa', calma: 'alta', foto: null,
    cap: 'O rio chega à divisa, o trilho começa do outro lado, e a ponte nasce no meio da borda.',
    regra: [
      'Hoje rio só encosta em rio e trilho só em trilho (peças estritas). Aqui a borda de rio pode ficar de frente para a borda de trilho, e a divisa vira uma ponte que vale <strong>+8 por borda</strong>. Não é o encaixe comum de 10: é outro pagamento, e a ponte não une os dois grupos (rio continua grupo de rio, trilho grupo de trilho).',
      'Nada mais muda: rio ou trilho contra terreno comum continua proibido, rio com rio e trilho com trilho valem como sempre. A ponte usa o kit <code>bridge</code> que cada tema já tem (pedra, madeira ou ferro), no meio da borda.'
    ],
    ex: 'Você tem uma peça de trilho com duas bordas de trilho. O rio corre na casa ao lado e termina numa borda virada para ela. Você gira a peça até uma borda de trilho ficar de frente para a ponta do rio: <strong>+8 pela ponte</strong>. A outra borda de trilho encosta em outra peça de trilho: <strong>+10</strong>. Total 18. Antes, essa peça não tinha onde ir, e a regra não deixava pôr o trilho ali.',
    sente: 'Alívio e gosto de desenhar: o trilho que não tinha para onde ir agora cruza o rio. Menos peça morta e mais cena para olhar de longe, como uma linha que atravessa a água.',
    difere: 'Pouco. O original proíbe esse par; aqui ele vira cena, mas a mecânica continua sendo "borda com borda".',
    riscos: ['Equilíbrio: quase nada (+25 pontos de regra por partida na simulação).', 'Trava: só diminui. Simulação com rio 30% e trilho 20%: 0 travadas com e sem ponte.', 'A ponte não resolve problema real de pilha; o valor dela é a cena.'],
    aval: 'Segunda melhor das próximas. Custa P no <code>core</code> (<code>check</code> aceita Água×Trilho, <code>Rules.bridgePoints</code>, <code>PlaceResult.bridges</code>) e usa um kit pronto. Simulação (80 partidas): média 5063 no Clássico contra 5368 com jogador atento; o jogador distraído fica em 5122.' },

  { id: 'estacao-decide', fam: 'e1', nome: 'A estação decide o encaixe', resumo: 'A interação da estação do momento passa a valer como encaixe de verdade, 10 pontos, e o mapa muda de leitura a cada 20 jogadas.',
    size: 'P', orig: 'média', calma: 'alta', foto: { f: 'inverno', alt: 'Captura do jogo no Inverno Nórdico, com pastos congelados e vilas na neve', cap: 'Captura real: Inverno Nórdico no inverno. As estações já existem (a cada 20 jogadas); a ideia só dá a uma delas peso de encaixe.' },
    cap: 'No outono a serraria (vila junto da floresta) vale 10, como encaixe; o par fora da estação segue em 5.',
    regra: [
      'As estações já existem e mudam a cada 20 jogadas (primavera colmeias, verão moinho, outono serraria, inverno pasto). A interação da estação do momento passa a contar como <strong>encaixe</strong>: vale 10 por borda e conta para o perfeito, o cerco e as missões. As outras interações continuam valendo 5.',
      'A estação sai do índice da peça, então o replay não guarda nada novo. Os temas ganham um encaixe "de casa" sem código por tema: Inverno Nórdico fica em inverno, Terraços do Oriente em primavera, Egito em verão, pelo <code>seasonLock</code> que já existe.'
    ],
    ex: 'Jogada 45, outono (serraria). Sua peça tem duas bordas de vila de frente para floresta. Hoje seria 2 × 5 = 10. Com a regra, são dois encaixes: <strong>2 × 10 = 20</strong>, e ainda contam para o cerco. Na jogada 65, já no inverno, o mesmo par volta a 5 e quem passa a valer 10 é o pasto. Em abril a vila junto da floresta é só contraste; em outubro é o melhor encontro.',
    sente: 'O mesmo mapa muda de leitura a cada 20 jogadas, e você olha a estação antes de girar a peça. Dá ritmo de calendário, sem pressa: nada é castigo, só muda o que rende.',
    difere: 'Bastante. No original o encaixe é fixo; aqui ele é uma pergunta nova a cada estação, e vem de uma mecânica que só o Retalhos tem.',
    riscos: ['Pede <code>SAVE_VERSION</code> novo e o oráculo de <code>tests/logic.ts</code> com a estação.', 'Trava: nenhuma, só afrouxa.', 'O "perfeito sazonal" (+20) precisa de olhar no <code>npm run balance</code> real: na simulação ele derrubou as peças jogadas (102 para 90), porque lá não contava como encaixe para cerco e missões.'],
    aval: 'A mais "nossa" e a primeira recomendada. Simulação sem perfeito sazonal (a leitura realista): média 5121 contra 5063 (+1%), p10 2925 contra 2796 (+5%), sem travar.' },

  { id: 'visada', fam: 'e1', nome: 'Visada a 2 casas', resumo: 'Duas bordas do mesmo terreno que se enxergam por cima de uma peça no meio ganham uma visada de +4.',
    size: 'M', orig: 'média', calma: 'alta', foto: null,
    cap: 'Floresta, vila, floresta em linha reta: uma fileira de árvores cruza a vila e liga as duas matas.',
    regra: [
      'Se a sua borda mostra o mesmo terreno que a borda da peça do outro lado de uma peça no meio, em linha reta (6 raios), uma visada liga as duas: <strong>+4</strong>. O terreno do meio não pode ser o mesmo, senão o encaixe comum já pontua.',
      'Na tela vira uma sebe, uma fileira de árvores ou uma trilha de pedras que cruza a peça do meio (sebe na Holanda, palmeiras no Egito, lanternas no Oriente). A pilha fica intacta.'
    ],
    ex: 'Há uma floresta no leste do mapa e uma vila logo ao lado dela. Você tem uma peça com borda de floresta e a põe do outro lado da vila, em linha reta. Ganha o encaixe comum que houver mais <strong>+4</strong> pela visada. Se a vila do meio tivesse floresta nessa borda, não haveria visada: já seria encaixe de 10.',
    sente: 'Olha por cima da vizinha e procura corredores de floresta e plantação por entre as vilas. É um olhar de mapa, não de peça.',
    difere: 'Moderado. O original só olha o vizinho direto; aqui a jogada olha duas casas adiante.',
    riscos: ['Equilíbrio: fraco (+43 pontos por partida) e quase não aparece.', 'Trava: nenhuma.', 'Linhas lêem bem de longe, mas o jogador pode nem notar que a regra existe.'],
    aval: 'Pequena demais para ser o carro-chefe. Simulação: média 5210 contra 5063. Fica como ideia de apoio.' },

  { id: 'meia-borda', fam: 'e1', nome: 'Meia-borda (borda partida)', resumo: 'Parte das bordas vem dividida ao meio entre dois terrenos, e encaixa se qualquer metade combina.',
    size: 'G', orig: 'média', calma: 'média', foto: null,
    cap: 'A borda de A (prado | floresta) encontra a de B (floresta | plantação): só uma metade casa, e ainda assim encaixa por 7.',
    regra: [
      'Cerca de 25% das bordas de terreno comum vêm partidas: metade prado, metade floresta, por exemplo, sorteado pela semente da peça (<code>TileDef.halves</code>, a sequência de peças não muda). A borda encaixa se <strong>qualquer metade</strong> combina com a metade vizinha: <strong>7 pontos</strong> (e conta para o perfeito), contra 10 do encaixe cheio.',
      'O chão faz a transição entre as duas metades, aproveitando o que o <code>groundMap</code> já mistura. O custo grande é de arte: o <code>buildTile</code> teria 12 meias-bordas.'
    ],
    ex: 'Sua peça tem uma borda prado | floresta e a vizinha mostra, na mesma divisa, floresta | plantação. A metade de floresta casa; a de prado com plantação não. Resultado: <strong>7 pontos</strong> em vez de 10. Se as duas metades casassem, continuaria 7; se nenhuma casasse, a borda não pontua (mas também não trava).',
    sente: 'Transições suaves ("a mata vira prado devagar"), com uma leitura mais carregada: cada borda pode ter duas respostas.',
    difere: 'Bastante: é um gradiente de verdade entre terrenos, coisa que o original e os parecidos não fazem.',
    riscos: ['Grupos de missão ficam ambíguos (a metade conta?).', 'Mexe em <code>check</code>, <code>place</code>, <code>isClosedPerfect</code>, grupos e todos os oráculos.', 'Arte: 12 meias-bordas no <code>buildTile</code>.'],
    aval: 'Pior custo e benefício do lote (G). Simulação: média 4987 contra 5063, 692 pontos vindos da regra e partidas mais curtas (95 peças contra 102).' },

  { id: 'mosaico', fam: 'e1', nome: 'Mosaico de fronteiras', resumo: 'Os dois pares que faltam também conversam, toda interação sobe a 8 e a peça com duas ou mais interações ganha +6.',
    size: 'P', orig: 'média', calma: 'alta', foto: null,
    cap: 'Floresta com prado, plantação e vila ao redor: três interações de 8 mais a fronteira dupla.',
    regra: [
      'Hoje quatro pares conversam por 5 (vila×floresta, vila×plantação, vila×prado, plantação×prado). Aqui entram floresta×prado ("clareira") e floresta×plantação ("pomar"), toda interação sobe de 5 para <strong>8</strong>, e a peça com <strong>2 ou mais interações</strong> ganha <strong>+6</strong> ("fronteira dupla").',
      'São seis construções por tema em vez de quatro: uma cabana de clareira e um pomar novos. A tabela está em <code>synergy.ts</code> (<code>SynKind</code>, <code>SYN_KINDS</code>, <code>synergyOf</code>, <code>INFLUENCE</code>) e no oráculo <code>SYN_PAIRS</code>.'
    ],
    ex: 'Você põe uma floresta com o prado ao leste, a plantação ao sul e a vila a sudoeste. São três interações: <strong>3 × 8 = 24</strong>, mais <strong>+6</strong> de fronteira dupla: <strong>30</strong>. Hoje essa mesma peça renderia só <strong>5</strong>: a única interação que já existe ali é a da vila, e clareira e pomar não valem nada.',
    sente: 'O contraste deixa de ser erro e vira jogada. O ponto onde três terrenos se tocam fica gostoso de procurar.',
    difere: 'Moderado, e continua sendo "pontuar borda diferente". Perde a tensão "igual vale mais", porque agora todo par rende.',
    riscos: ['Pede <code>SAVE_VERSION</code> novo, legenda de ajuda e missões de interação atualizadas.', 'Equilíbrio: +383 pontos por partida; sobe o piso (p10 +15%) e achata o alto.', 'Trava: nenhuma.'],
    aval: 'Pequena. Simulação: média 5412 (+7%), p10 3226, p90 7504. Funciona, mas empobrece a diferença entre "igual" e "diferente".' },

  { id: 'espera-rende', fam: 'e1', nome: 'A espera rende (a borda que cresce)', resumo: 'Uma borda aberta amadurece com o tempo, e fechá-la depois paga mais: paciência premiada.',
    size: 'M', orig: 'alta', calma: 'alta', foto: null,
    cap: 'A mesma borda aberta em três momentos: broto, mudas e árvores altas. Fechar depois rende +0, +1, +2.',
    regra: [
      'Uma borda virada para o vazio amadurece. Quando você a fecha com um encaixe, ganha <strong>+1 a cada 12 jogadas de espera</strong>, até <strong>+3</strong> por borda: <code>min(3, floor((idx − vizinha.index) / 12))</code>. É função do índice da peça, então o replay não guarda nada.',
      'Na tela a borda ganha três fases: broto, mudas, árvores altas ou espigas cheias. De longe lê como "bordas velhas mais viçosas". A configuração é <code>Rules.ripenEvery</code>.'
    ],
    ex: 'Você põe uma peça de mata na jogada 10 e deixa uma borda aberta. Na jogada 34 a fecha com um encaixe de floresta: 24 jogadas de espera, <code>floor(24/12) = 2</code>, então o encaixe vale <strong>10 + 2 = 12</strong>. Se fechasse na jogada 50 (40 de espera) seria 10 + 3 = 13; se fechasse na 12, 10 + 0.',
    sente: 'Calma e paciência. Em vez de fechar tudo na hora, você deixa uma baía de mata crescer e fecha depois. A borda aberta deixa de ser pendência e vira investimento.',
    difere: 'Bastante: é um relógio por borda, coisa que o original não tem.',
    riscos: ['É a regra de equilíbrio mais forte do lote: precisa de teto 2 (em vez de 3).', 'Pode incentivar deixar buracos; o cerco devolve peça, então é preciso testar o incentivo.', 'Trava: nenhuma.'],
    aval: 'A mais original no sentimento. Simulação: média 5646 (+11%), p90 8769 (+15% no jogador atento), 107 peças. Terceira no ranking das próximas.' },

  { id: 'sucessao-miolo', fam: 'e1', nome: 'Sucessão do miolo', resumo: 'A peça cercada pelas seis vizinhas amadurece: o miolo vira o terreno dominante e paga pelo tamanho do grupo.',
    size: 'M', orig: 'baixa', calma: 'alta', foto: null,
    cap: 'Seis vizinhas encaixadas em volta: o miolo vira mata fechada e paga o tamanho do grupo.',
    regra: [
      'Quando uma peça fica cercada pelas seis vizinhas encaixadas, o miolo dela "amadurece" e vira o terreno dominante da própria peça. Ganha pontos pelo <strong>tamanho do grupo</strong> desse terreno (teto 12), somados ao bônus de cerco que já existe.',
      'Não depende do giro, e a conta entra no <code>place</code> quando <code>closed</code> é verdadeiro. Na tela: prado vira clareira com flores, floresta vira mata fechada, vila ganha praça.'
    ],
    ex: 'Você fecha o sexto lado de uma peça cujo terreno dominante é floresta, e o grupo de floresta que a inclui tem 9 peças. O miolo vira mata fechada e paga <strong>+9</strong>, além do bônus de cerco de sempre. Um grupo de 15 pagaria o teto: +12.',
    sente: 'Ver o miolo virar bosque ou praça é recompensa visual e dá vontade de cercar um grupo grande.',
    difere: 'Pouco: é mais um bônus de cerco, com uma imagem bonita.',
    riscos: ['Só se vê de perto.', 'Equilíbrio fraco (+107 pontos por partida); quase invisível se ninguém cerca de propósito.', 'Trava: nenhuma.'],
    aval: 'Fraca. Simulação: média 5203 contra 5063. Bonita, mas não muda a decisão de quem joga.' },

  // ---------------- E2 ----------------
  { id: 'aguas-descem', fam: 'e2', nome: 'Águas que descem', resumo: 'A água precisa chegar ao mar: um rio que parte de uma nascente e só desce rende por peça e solta um bônus na chegada.',
    size: 'M', orig: 'alta', calma: 'alta', decidida: true,
    foto: { f: 'orb1', alt: 'Captura do jogo: rio com cachoeira entre dois níveis, nos Terraços do Oriente', cap: 'Captura real: a cachoeira já existe no jogo (Terraços do Oriente). A ideia dá a ela uma regra.' },
    cap: 'À esquerda o rio desce do morro ao lago (+8 por peça, +60 na chegada). À direita o rio sobe: vira água parada e vale 0.',
    regra: [
      '<strong>Nascentes.</strong> 3 a 5 casas de nível 2, a 4 casas ou mais do Centro, sorteadas por um gerador à parte (como <code>sites.ts</code>). Ficam sob a névoa até uma peça encostar, mas o morro já se vê. <strong>Curso:</strong> o grupo de rio que contém a peça da nascente desce se, andando a partir dela, o nível nunca sobe.',
      '<strong>Pontos.</strong> Peça de rio ligada a um curso que desce: <strong>+8</strong>. Chegada: o curso toca um lago (3 bordas de água ou mais) ou uma peça de rio no nível 0: <strong>+60 e +2 peças</strong>, uma vez por curso. Rio que sobe não é proibido, só vira água parada (0, sem correnteza, espelhada). Quem não quer seguir a água joga como hoje.',
      'Entra como modo à parte (<code>Rules.springs</code>, <code>waterChance</code> 0,24; o Clássico fica intocado no começo). Reaproveita cerca de 85% do que existe: o relevo, o rio que corre, a cachoeira, a garça do <code>celebrate</code>.'
    ],
    ex: 'Semente fixa, Holanda. Jogada 1: há um morro com brilho a 5 casas, e você põe um prado. Jogada 2: um rio reto, apontado para o morro. Jogada 4: um rio curvo que, do jeito que você o encaixou, sobe a encosta; a água fica espelhada (+0) e você desfaz com <code>U</code>. Jogada 5: gira a curva para o outro lado e a água desce: <strong>+8</strong> em dourado e a correnteza volta. Jogada 7: outro rio liga a nascente ao curso: <strong>+8</strong>. Jogada 8 sai um lago, que você guarda. Jogada 9: o rio reto alinha com o lago, a água solta, a garça sobe: <strong>+8, +60 e +2 peças</strong>. Soma da água nessas dez jogadas: 84 pontos e duas peças.',
    sente: 'Que desenha um vale. Olha o morro, imagina por onde a água quer ir, e cada peça de rio ganha um destino. Alívio quando o último trecho encosta no lago e a água "solta". É prêmio, não castigo.',
    difere: 'Muito. No Dorfromantik o rio é uma borda como outra; aqui tem origem, direção e fim, e quem manda é o chão. Carcassonne e Tantrix ligam caminhos sem o terreno opinar, e o Taluva usa altura só para empilhar.',
    riscos: ['Condição: o relevo precisa aparecer no vazio, senão ninguém vê a descida (hoje só as peças postas mostram degraus).', 'Só 17% das peças têm rio: o modo sobe para cerca de 24%.', 'Trava: nenhuma. Confusão e calma: boas.'],
    aval: 'Recomendação do agente: <strong>prototipar primeiro</strong>. O rio é a coisa mais bonita do jogo, o relevo já existe, a regra cabe numa frase ("a água só desce até o mar"), não trava ninguém e liga e desliga por <code>Rules.springs</code>. Tamanho M.' },

  { id: 'sol-sombra', fam: 'e2', nome: 'Sol e sombra', resumo: 'O sol dá um passo ao redor do mapa a cada 10 jogadas, e a luz decide onde plantação, floresta e vila rendem.',
    size: 'M', orig: 'alta', calma: 'alta', foto: null,
    cap: 'O sol vem do alto à direita. O morro sombreia as duas casas atrás dele: floresta e vila rendem na sombra, plantação rende ao sol.',
    regra: [
      '<code>passo = floor(índice / 10) % 6</code>: o sol aponta para uma das 6 direções do hexágono, e nada vai para o save. Uma casa fica <strong>na sombra</strong> se a vizinha do lado do sol é mais alta; se for 2 níveis acima, a sombra também cobre a casa seguinte.',
      'Plantação ao sol rende <strong>+4 por borda</strong>; floresta e vila na sombra rendem <strong>+3</strong>. Teto de +12 por peça. As casas válidas clareiam ou escurecem quando o fantasma passa, e a etiqueta dá o ganho; um pequeno relógio de sol diz para onde ele vai. Variante: o vento, girando ao contrário, faz o moinho com campo aberto contra o vento render +4.'
    ],
    ex: 'Semente fixa, Egito, sol a leste, Centro plano. Jogada 1: plantação ao sol com uma borda de plantação, <strong>+4</strong>. Jogada 2: floresta atrás do morro de nível 1, <strong>+3</strong>. Jogada 6: floresta atrás do morro alto, onde a sombra é longa, e duas bordas pagam: <strong>+6</strong>. Jogada 9: o sol virou, a plantação antiga já está na sombra, mas os pontos foram pagos e nada se perde; você faz uma plantação nova do outro lado do morro.',
    sente: 'Que a paisagem é de verdade: o morro faz sombra, o trigo quer sol, a mata fica atrás do morro. A sombra que se vê é a que vale.',
    difere: 'Muito. Cascadia e Isle of Skye pontuam por padrões; Tiny Glade tem sol bonito sem regra. Nenhum puzzle de peças usa a luz como regra.',
    riscos: ['Com 3 níveis haverá poucas sombras (talvez mais relevo no modo).', 'Pode virar só tabela de bônus.', 'A rotação da peça quase não importa, porque a luz é por casa.'],
    aval: 'Segunda a prototipar. Divide com as Águas que descem o trabalho de mostrar o relevo; funções puras <code>lit(seed, q, r, passo)</code> e <code>Rules.sun</code>, amarrando o sol visual ao mesmo passo em <code>skyFor</code>. Reaproveita cerca de 90%. M.' },

  { id: 'peregrino', fam: 'e2', nome: 'Peregrino', resumo: 'Um aldeão sai do Centro rumo a um sítio escondido, anda uma casa por jogada, e você abre o caminho.',
    size: 'M', orig: 'alta', calma: 'alta', foto: null,
    cap: 'O peregrino já andou duas casas; a próxima é um vazio, e ele espera sentado até você pôr uma peça. Ao fim, o sítio.',
    regra: [
      'A cada 12 jogadas um peregrino sai do Centro rumo a um sítio escondido, sorteado a 4 ou 5 casas. Por jogada anda <strong>uma casa</strong> por terreno aceito: vila, estrada, prado e plantação; floresta só com trilha; rio só com ponte. Sem caminho, <strong>espera sentado</strong>, sem castigo.',
      'Ao chegar, o sítio <strong>paga o dobro</strong> e o peregrino volta com <strong>+1 peça</strong>. O estado é derivado do replay (BFS sobre as casas postas, <code>walker.ts</code>), sem mudar o save. Na tela: aldeão com cajado (o <code>Life</code> já tem aldeões), pegadas que apagam, fogueirinha quando espera.'
    ],
    ex: 'Jogada 12: o peregrino sai do Centro, com o sítio a 4 casas. Jogadas 13 e 14: anda duas casas, por prado e plantação. Jogada 15: a casa seguinte está vazia e ele senta. Jogada 16: você põe uma peça de estrada ali, e ele anda de novo. Jogada 18: chega ao sítio, que <strong>paga o dobro</strong>, e você recebe <strong>+1 peça</strong> na pilha. Cada peça que você coloca vira "será que ele passa?".',
    sente: 'Cuidado com uma pessoinha. É a mais afetiva do lote: o caminho é seu, e o ritmo é o das jogadas, sem relógio.',
    difere: 'Muito. O trem do Dorfromantik é um objetivo estático; aqui o caminhante é vivo, anda no ritmo das jogadas e a rota é sua. Townscaper e Tiny Glade têm gente, sem regra.',
    riscos: ['Sítio longe deixa o peregrino parado por 30 jogadas: por isso sortear a 4 ou 5 casas.', 'Parece a Estrada Real; precisa valer pela pessoa e não pela conta de distância.', 'Trava: nenhuma (esperar não custa nada).'],
    aval: 'Merece um teste. Usa <code>sites.ts</code> e a ideia de rede de <code>routes.ts</code>; reaproveita cerca de 70%. M.' },

  { id: 'mapa-lapis', fam: 'e2', nome: 'Mapa a lápis', resumo: 'O vazio mostra um esboço a lápis de uma paisagem possível, e peça que bate com ele passa o lápis a tinta.',
    size: 'G', orig: 'alta', calma: 'média', foto: null,
    cap: 'Duas peças pintadas batem com o esboço (+6 cada); as outras casas ainda são traços de lápis no pergaminho.',
    regra: [
      'A semente esconde uma <strong>paisagem-gabarito</strong>: o que um guloso determinístico jogaria com a mesma pilha (logo, existe solução). O vazio mostra um esboço a lápis do que cada casa quer ser. Peça cuja cor dominante bate com o esboço "passa o lápis a tinta": <strong>+6 por casa</strong>. Desenho todo pintado dá o selo "obra".',
      'Você pode ignorar o esboço e jogar como hoje; ele só sugere um rumo. No Desafio do dia, todos restauram o mesmo quadro e comparam a foto. Render: textura do esboço no mapa do vazio (<code>makeVoidMaterial</code>, <code>groundMap</code>). O guloso precisa ficar com versão fixada e sem <code>Math.random</code>.'
    ],
    ex: 'O esboço de um trecho tem 15 casas. Você acerta 11 e as outras 4 ficam livres porque a pilha foi para outro lado: 11 × 6 = <strong>+66</strong>. Se pintasse as 15, o selo "obra" vira marca da partida e a foto vai para o compartilhamento do dia.',
    sente: 'Que restaura um quadro. É uma figura na tampa da caixa: não obriga, mas dá um rumo.',
    difere: 'Muito: nenhum jogo de peças dá um alvo visual no próprio mapa.',
    riscos: ['O maior risco do lote: pode poluir o mapa como a Colcha e levar a copiar em vez de olhar.', 'Se o guloso mudar, o quadro muda: fixar versão.', 'Só como modo à parte.'],
    aval: 'A mais ousada, e a que mais lembra o risco da Colcha. Reaproveita cerca de 50%. G.' },

  { id: 'retalhos-dois', fam: 'e2', nome: 'Retalhos de dois', resumo: 'Uma peça em cinco vem dupla, duas casas coladas, e pode ser posta inteira ou partida em duas.',
    size: 'G', orig: 'alta', calma: 'média', foto: null,
    cap: 'À esquerda a dupla colada, com o rio cruzando a costura. À direita, partida: uma metade agora, a outra na jogada seguinte.',
    regra: [
      'Uma peça em cinco vem dupla: duas casas coladas com a emenda resolvida (o rio atravessa). Coloca-se a dupla inteira (<strong>12 giros</strong>) ou se <strong>parte</strong>: cada metade vira uma peça comum, uma agora e outra na jogada seguinte, ao custo de <strong>1 peça da pilha</strong>. Dupla com 4 ou mais bordas encaixadas paga <strong>+30</strong>.',
      'Por dentro, cada dupla são duas <code>TileDef</code> ligadas por <code>pair</code>, com a borda interna igual, e <code>place()</code> roda duas vezes. Faltam validar o par, tipos de peça na pilha e o fantasma de duas casas (<code>liveTile</code>, <code>preview</code>).'
    ],
    ex: 'Sai uma dupla de prado com um rio atravessando a costura. Você acha um lugar onde as quatro bordas externas encaixam: <strong>4 × 10 + 30 = 70 pontos</strong> numa só jogada. Se não achar, parte a dupla: põe a primeira metade agora (encaixe comum), e a segunda na jogada seguinte, pagando 1 peça da pilha.',
    sente: 'Dilema leve: o par grande ou o seguro. Vê a paisagem em trechos maiores.',
    difere: 'Muito. Carcassonne e Dorfromantik jogam uma peça por vez; o Taluva tem peças de 3 casas, mas fixas. Aqui a peça se divide, como um retalho rasgado.',
    riscos: ['Travar: não, partir sempre vale.', 'Confusão: 12 giros num jogo calmo; é preciso limitar as duplas.', 'O <code>draw()</code> e o fantasma mudam muito.'],
    aval: 'Boa ideia, mas G. A lógica reaproveita cerca de 65%; a parte visual é o grosso do trabalho.' },

  { id: 'remendo', fam: 'e2', nome: 'Remendo', resumo: 'Uma peça sem nenhum encaixe pode ser coberta por um retalho novo, ao custo de uma peça da pilha.',
    size: 'M', orig: 'alta', calma: 'alta', foto: null,
    cap: 'À esquerda a plantação sem encaixe. À direita, um retalho de floresta pousa por cima, com costura clara, e encaixa em duas bordas.',
    regra: [
      'Uma peça que ficou <strong>sem nenhum encaixe</strong> pode ser coberta por um retalho novo que encaixe melhor, ao custo de <strong>1 peça</strong> da pilha. Os grupos são refeitos. Limite: <strong>3 remendos por partida</strong> e uma vez por casa.',
      'Como o bloco estático é só de acrescentar (invariante 10), o retalho é uma peça por cima, 0,15 mais alta, com costura de linha clara; o mapa guarda a história dos erros. É uma jogada nova no save (<code>SAVE_VERSION</code>) e usa <code>Board.cover()</code>.'
    ],
    ex: 'Na jogada 48 você põe uma plantação que não encaixa em nada: 0 ponto. Mais adiante sai uma floresta, que encaixa com as duas vizinhas de floresta. Você remenda: a peça nova cobre a antiga, pagando 1 peça da pilha, e ganha <strong>2 × 10 = +20</strong>. Contador: remendo 1 de 3.',
    sente: 'Perdão. Errar deixa de ser definitivo, com uma reviravolta suave. Combina com o nome do jogo.',
    difere: 'Muito. O Taluva cobre peças para atacar; aqui é para consertar. Nenhum jogo tem o conserto como ação.',
    riscos: ['Abuso (por isso o limite de 3).', 'Peça sobre peça pode ficar torta com o relevo.', 'Trava: não.'],
    aval: 'Barata e serve de apoio a qualquer outra ideia. Reaproveita cerca de 75%. M.' },

  { id: 'sucessao-paisagem', fam: 'e2', nome: 'Sucessão da paisagem', resumo: 'A paisagem muda depois que você sai: prado cercado de mata vira mata jovem, plantação sem vila vira pousio.',
    size: 'G', orig: 'alta', calma: 'baixa', foto: null,
    cap: 'Prado cercado por quatro bordas de mata: passadas 12 jogadas, vira mata jovem e paga +5.',
    regra: [
      'Prado cercado por <strong>4 bordas ou mais de floresta</strong> durante 12 jogadas vira mata jovem. Plantação sem vila por perto vira pousio. Cada mudança paga <strong>+5</strong> e os grupos se refazem.',
      'Por dentro isso quebra uma premissa: <code>Placed.edges</code> passa a mudar, o replay é obrigatório, e o render não troca a decoração depois que a peça pousa. Na tela, brotos crescem em árvores e o campo abandonado ganha capim (<code>eraWave</code> existe).'
    ],
    ex: 'Você cerca um prado com quatro bordas de floresta na jogada 30. Na jogada 42 ele vira mata jovem: <strong>+5</strong>, e o grupo de floresta ganha uma peça. O que você planejava como prado (e talvez como parte de um grupo) agora é floresta. Se isso for sempre bom, ótimo; se for "perdido", vira ansiedade.',
    sente: 'Que o mundo respira; voltar a um canto revela algo novo. Mas se o grupo planejado muda sozinho, a calma vira ansiedade.',
    difere: 'Muito. Em todos os jogos de peças a peça é fixa; aqui o tempo trabalha.',
    riscos: ['Alto: oráculo e save complicam.', 'Só vale se toda mudança for sempre boa.', 'Reaproveita só cerca de 40%.'],
    aval: 'A mais arriscada. G, e só com a garantia de que a mudança nunca prejudica quem jogou.' },

  // ---------------- E3 ----------------
  { id: 'relevo-casa', fam: 'e3', nome: 'A. A borda precisa casar (±1)', resumo: 'A altura da borda entra no encaixe: vizinhos diferem no máximo 1 nível, e 2 níveis não encaixam.',
    size: 'M', orig: 'média', calma: 'média', protótipo: true,
    foto: { f: 'holanda-longe', alt: 'Captura do protótipo do modo Relevo na Holanda: peças em degraus com paredes de penhasco', cap: 'Captura real do protótipo (modo Relevo, Holanda): cada peça com seus degraus, paredes de penhasco entre setores e nas bordas altas.' },
    cap: 'Três emendas: nível 1 com 1 e 1 com 2 encaixam; 0 contra 2 não.',
    regra: [
      '<strong>Perfil da peça:</strong> seis alturas (uma por borda, nível 0 a 2) mais o pico do meio, gerado só pela semente da peça e das bordas (<code>tileProfile</code> em <code>src/core/relief.ts</code>). Formas sorteadas: plana (34%), morro no meio (8%), barranco, canto, meia, rampa, espinhaço, sela e vale; setores vizinhos diferem no máximo 1 degrau.',
      '<strong>Encaixe:</strong> vizinhos diferem no máximo <strong>1 nível</strong>; 2 níveis não encaixam; trilho exige igual. O fantasma marca em azul a borda com degrau e em vermelho a que não casa. Peças com água ou trilho saem planas (rio no nível 1 em 80%, trilho sempre no 1). É modo novo (<code>Rules.relief</code>, atrás de <code>more: true</code>), então não pede <code>SAVE_VERSION</code>.'
    ],
    ex: 'Você tem uma peça com a borda leste no nível 2. A vizinha tem a borda de contato no nível 1: <strong>encaixa</strong> (degrau de um). Se a vizinha estivesse no nível 0, o fantasma ficaria vermelho: <strong>não encaixa</strong>, e você gira a peça para outro lado. Com a base concentrada no nível 1, só 0 contra 2 conflita (cerca de 18% por emenda entre peças planas). O descarte resolve o resto.',
    sente: 'A altura vira o terreno de uma segunda dimensão do encaixe: você lê o morro antes de girar a peça. Calma média, porque o fantasma vermelho aparece mais.',
    difere: 'Médio. O Taluva usa altura para empilhar; aqui ela é uma restrição de encaixe lida da paisagem.',
    riscos: ['Trava: média; descartar a peça resolve.', 'O modo desliga os platôs da semente (invariante 15 convive).', 'Equilíbrio: o protótipo rende cerca de 20% menos que o Clássico.'],
    aval: 'Recomendado, junto com B, como o menor conjunto em que a altura decide a jogada. <strong>Protótipo jogado (Holanda, 40 partidas por jogador):</strong> Relevo guloso média 3.650 (Clássico 4.492), 81 peças contra 100, 0,0% travadas; jogador que persegue missões 4.918 contra 6.221. Desenho: 300 peças em Alta, 118 draw calls e 1,07 milhão de triângulos (Clássico 165 e 1,48 milhão).' },

  { id: 'relevo-degrau', fam: 'e3', nome: 'B. Degrau pontua, queda de rio pontua', resumo: 'Em vez de só evitar o desnível, o jogador ganha pontos por degraus de 1 nível e por quedas de rio.',
    size: 'P', orig: 'média', calma: 'alta', protótipo: true, foto: null,
    cap: 'Três peças em escada pagam degrau (mirante); o rio que cai de um nível a outro forma cachoeira e paga a queda.',
    regra: [
      'Soma-se ao desenho A: <strong>+<code>stepPoints</code> por borda</strong> com degrau de 1 nível (um mirante) e <strong>+<code>fallPoints</code> por degrau de rio</strong> (uma cachoeira). Dá motivo para procurar o desnível, não só evitá-lo. Os valores são parâmetros a calibrar no <code>npm run balance</code>; os da figura (+3 e +5) são só ilustração.',
      'Em <code>src/core</code>: <code>Check.steps/falls</code> e dois campos em <code>Rules</code>. O oráculo de <code>tests/logic.ts</code> é reescrito, recalculando encaixe de altura, degraus e quedas sem o <code>Board</code>.'
    ],
    ex: 'Você põe uma peça no nível 1 ao lado de uma no nível 2 e outra no nível 0: dois degraus de um nível, e cada um paga o valor do degrau (na figura, 2 × 3 = 6). Numa emenda de rio, se uma peça de rio no nível 1 encosta numa de nível 0, a água cai: a cachoeira paga a queda (+5 na figura).',
    sente: 'Procura-se o desnível com prazer: o penhasco vira mirante e a cachoeira vira recompensa. Calmo.',
    difere: 'Médio, como A: a recompensa por desnível é parente do bônus por altura do Taluva, mas aqui acompanha o rio.',
    riscos: ['Nenhum risco de travar.', 'Risco de equilíbrio (inflação de pontos): medir no <code>npm run balance</code>.'],
    aval: 'Recomendado com A: "o encaixe restringe, o degrau recompensa". É um complemento barato (P) sobre o que já foi feito.' },

  { id: 'relevo-agua', fam: 'e3', nome: 'C. A água só corre para baixo', resumo: 'O rio só emenda com rio do mesmo nível ou um nível abaixo, com o sentido da correnteza forçado.',
    size: 'G', orig: 'alta', calma: 'média', foto: null,
    cap: 'Três peças de rio em descida emendam (igual, depois um nível abaixo). A quarta, um nível acima, não emenda.',
    regra: [
      'O rio só emenda com rio de <strong>altura igual ou 1 nível abaixo</strong>, com o sentido da correnteza forçado. O núcleo hoje não conhece a correnteza (ela é decidida no render, em <code>World.flowAt</code> e <code>resolveFlow</code>), então a regra exigiria mover o <code>flowAt</code> para <code>src/core</code>. Se a correnteza entrar na regra, o <code>SAVE_VERSION</code> sobe.',
      'É parente das Águas que descem (E2, 1), mas obrigatória: lá a água que sobe só rende 0; aqui nem emenda. Compatível com o modo Relevo.'
    ],
    ex: 'Três peças de rio em sequência, nos níveis 1, 1 e 0: emendam, e a água corre do primeiro ao terceiro. Uma quarta, no nível 1, depois da do nível 0: não emenda, porque a água teria de subir. O perigo: rios sem saída, que só terminam em lago, e peças de rio impossíveis de colocar.',
    sente: 'Rigor de geografia: a água não perdoa. Em compensação, o rio sai muito convincente.',
    difere: 'Alto: o rio ganha direção física, coisa que Carcassonne e Taluva não têm.',
    riscos: ['Alto: rios sem saída e lago só.', 'Pede mover a correnteza para o <code>core</code>.', 'Pode endurecer a pilha: precisa de teste de travamento.'],
    aval: 'Não recomendado agora. A versão amigável é a das Águas que descem (E2, 1): em vez de proibir, premia. Próximo passo, se o Roger gostar do Relevo, é este desenho com a correnteza movida para o núcleo.' },

  { id: 'relevo-vila-planta', fam: 'e3', nome: 'D. Vila gosta de alto, plantação de baixo', resumo: 'Bônus por vila em setor de nível 2 e por plantação em nível 0, ligado ao terreno de cada borda.',
    size: 'M', orig: 'média', calma: 'alta', foto: null,
    cap: 'Vila no alto e plantação embaixo rendem; a inversa (vila embaixo, plantação no alto) vale 0.',
    regra: [
      'A altura do setor liga ao terreno da borda: <strong>vila em nível 2 rende bônus, plantação em nível 0 rende bônus</strong>. Pede uma nova tabela no tema (invariante 8: tema é só dado), com o bônus escolhido por terreno e nível.',
      'Em modo novo não pede <code>SAVE_VERSION</code>. Se entrar nos modos atuais, sim.'
    ],
    ex: 'Você tem uma peça de vila e acha um setor de nível 2: <strong>bônus de vila alta</strong> (na figura, +4). Uma plantação no vale rende o bônus de plantação baixa. Já a plantação no morro e a vila no vale valem 0. O jogador acaba caçando o nível certo para cada terreno.',
    sente: 'Lógica natural (vilas nos morros, plantações no vale), mas pode virar caça-nível.',
    difere: 'Médio.',
    riscos: ['Baixo risco de travar, alto de dominar o jogo: só se caça nível.', 'Pede tabela no tema.', 'Save: sim, se entrar nos modos atuais.'],
    aval: 'Não está na recomendação: o risco é o jogador trocar a paisagem por uma tabela.' },

  { id: 'relevo-vento', fam: 'e3', nome: 'E. Vento e sombra', resumo: 'Moinho em nível alto rende mais; vila na sombra de um paredão ao sul perde pontos.',
    size: 'G', orig: 'alta', calma: 'baixa', foto: null,
    cap: 'O moinho no alto pega o vento (+); a vila atrás do paredão fica na sombra (−).',
    regra: [
      'Moinho em nível alto rende mais; vila na sombra de um paredão ao sul perde pontos. Exige simular o sol no núcleo, que não conhece hora do dia. É o primo da ideia Sol e sombra (E2, 2), mas por penalidade e não por bônus.'
    ],
    ex: 'O moinho está no alto, com vento: bônus. A vila logo atrás do paredão ao sul fica à sombra: perde pontos. O jogador vê pontos perdidos sem poder fazer nada pela rotação da peça.',
    sente: 'Ruído: muitos fatores ao mesmo tempo, pouco legíveis, e o ganho é uma punição.',
    difere: 'Alto, mas por razão ruim.',
    riscos: ['Alto: ruído e baixa legibilidade.', 'Exige simular o sol no núcleo.'],
    aval: 'Não recomendado. Se o Roger quiser luz como regra, a versão boa é Sol e sombra (E2, 2), com bônus e sem punição.' },

  { id: 'relevo-visual', fam: 'e3', nome: 'F. Só visual (o que existe hoje)', resumo: 'A altura continua sendo da casa e do render: platôs e degraus bonitos, sem nenhuma regra.',
    size: 'P', orig: 'baixa', calma: 'alta',
    foto: { f: 'fantasma-classico', alt: 'Captura do jogo no modo Clássico: platôs e degraus de terreno sem regra', cap: 'Captura real do Clássico hoje (Holanda): platôs de relevo da semente, só decoração.' },
    cap: 'Cada peça tem seu degrau, mas nenhuma regra paga ou proíbe por causa da altura.',
    regra: [
      'É o ponto de comparação: <code>levelAt</code> dá o nível de qualquer casa, o render faz platôs, rampas de estrada, penhasco e cachoeira, e o <code>core</code> não lê nada disso.'
    ],
    ex: 'Você põe uma peça num platô de nível 2 e outra no vale: a pontuação é a mesma. A decisão de jogada é a mesma de um mapa plano.',
    sente: 'Calma máxima, e nenhuma decisão nova.',
    difere: 'Nada além do que o jogo já mostra.',
    riscos: ['Nenhum.'],
    aval: 'Existe hoje. Serve de comparação para medir o quanto A, B e as demais acrescentam.' }
];
