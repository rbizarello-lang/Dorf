# Atlas: o conceito

Este é um documento de design, não de código. Descreve o que o jogador vive. O Atlas é a evolução das Expedições (`jogos/expedicoes/ESBOCO.md`): sai a capital única com postos distantes e entram cidades, vilas e paisagens reais em miniatura, cada uma com seus bairros, seus moradores e suas cartas.

Esta versão já incorpora o retorno do Roger de 24/10/2026 (lugares menores, começar pelo Rio, mapa comprimido de cidade inteira). A tabela no fim registra cada mudança e o motivo.

## A frase do jogo

> **Um atlas de lugares reais em miniatura, que mudam do jeito que você escolhe.**

## Os três verbos

1. **Contemplar.** Chegar a um bairro, mexer na hora e no clima, seguir um morador pela rua. Olhar já é jogar.
2. **Escolher.** Ler as cartas dos moradores e decidir o que o bairro vira. Toda escolha ganha alguma coisa e perde outra.
3. **Descobrir.** Abrir bairros e lugares novos por cartas de viajantes e de moradores, e achar pequenas cenas que ninguém avisou que existiam.

Quem joga não administra, não constrói lote a lote e não corre contra relógio nenhum.

## O que é, em uma imagem

Uma mesa com um atlas aberto. Cada lugar visitado é um **mapa comprimido** de uma cidade, vila ou paisagem reais: uma ilustração aérea, como um mapa turístico ilustrado, em que os pontos famosos aparecem em escala real e os trechos repetitivos entre eles são cortados e costurados por morro, água, praia ou parque. Dentro do mapa há vários **bairros**, cada um com 400 a 800 metros de escala real, e é num bairro que se faz a visita e que as cartas valem.

Exemplo, o Rio de Janeiro: as praias do Leblon, de Ipanema e de Copacabana, a Urca com o Pão de Açúcar, o Corcovado com o Cristo Redentor, o Aterro do Flamengo, o Centro, a Lapa e Santa Teresa, todos no mesmo mapa. Entre um e outro, o que se repete (quadras e mais quadras) encolhe ou some. O relevo, a água e o traçado vêm de dados abertos. O resto é estilizado, como um diorama de mesa. Um lugar pequeno, como uma vila, é só um ou dois bairros e não precisa de corte nenhum.

## O jeito de ver

Referências que o Roger mandou: tiny.london, isometric.nyc e tinygyn.com (Goiânia). O que o jogo toma delas:

- **Vista aérea inclinada**, tipo isométrica, com muito detalhe nas casas. Existe a opção de um filtro "pixel" para quem gosta (resolução baixa e paleta curta); o padrão é a miniatura colorida.
- **Cores alegres e saturadas**, como a Goiânia ilustrada: telhados vermelhos, paredes claras, verde forte, água azul.
- **Um pequeno painel no canto** com a hora e o clima do lugar, no estilo "12:18 CHUVISCO · DIA". A hora é a hora real do lugar (em Sydney pode ser dia enquanto no Brasil é noite), e o jogador pode girá-la.
- **Minimapa com o contorno da cidade real**, que também mostra onde o mapa foi dobrado e quais bairros estão acesos. Mais uma **bússola**.
- **Casas, bairros e parques são o herói.** Prédios altos não são. Nenhuma construção passa de **8 andares** na maquete; torres isoladas só entram quando são marco e ficam sozinhas, sem uma floresta de arranha-céus em volta.

Observação: as quatro páginas de referência não puderam ser abertas na pesquisa técnica (o acesso foi bloqueado). O que consta aqui sobre elas vem da descrição do Roger. A pesquisa técnica também mostra que alguns desses mapas dependem de dados do Google, que o Atlas não usa (ver `RISCOS.md`).

## Uma visita em três momentos

**Minuto 1: a chegada.** A câmera desce do atlas até o mapa da cidade (por exemplo, o Rio). O painel diz "09:41 NUBLADO · MANHÃ". Os bairros acesos têm cor, e os outros ainda são esboço a lápis. O Roger toca num bairro, a câmera desce, e um bilhete diz "desde a sua última visita…": a obra que terminou, quem chegou, que tempo faz. O bairro já está vivo: fumaça de chaminé, gente com rotina, barulho de fundo. Nada pede nada.

**Minuto 5: contemplar.** A câmera é livre, e ele pode voar pelo mapa inteiro, passando de um bairro a outro sem tela de carregamento. Gira a hora (manhã, entardecer, noite) e escolhe o clima. Toca num morador e vê o nome e uma frase. Descobre uma cena pequena: um gato no telhado, uma noiva saindo da igreja, uma roupa no varal que só aparece com sol. É o miolo da visita e pode ser o que o jogador mais goste.

**Minuto 15: as cartas e a despedida.** Ele abre até três cartas do bairro, escolhe uma ou duas e vê o andaime subir no lugar da obra. Se quiser, tira uma foto. Sai, e o bairro ganha um carimbo no atlas.

Uma visita curta de 5 minutos vale: chegar, olhar, atender uma carta e sair. Nada exige terminar nada.

## Uma jornada em três pontos

**1ª visita.** O atlas tem um só lugar aceso: o **Rio de Janeiro**, com três bairros coloridos (Urca e Pão de Açúcar, Santa Teresa e Lapa, Copacabana) e os outros cinco ainda a lápis. O jogador escolhe um bairro. Ele atende uma carta e vê o andaime. A recompensa dessa visita é a promessa ("volte amanhã, vai estar pronto") mais o ritual do carimbo no atlas. É a visita mais frágil do jogo, e o `RISCOS.md` trata disso.

**5ª visita.** Já viu duas obras prontas, o bairro tem um apelido novo (a Santa Teresa que começou bairro boêmio virou "cidade-jardim", depois da praça e das árvores) e o mapa do Rio ganhou cor em mais um bairro por causa de uma carta. Uma carta de viajante abriu o segundo lugar: uma vila de casario colonial ali perto. O jogador já tem favoritos e já hesitou diante de uma carta.

**20ª visita.** O Rio tem todos os bairros acesos e seu retrato aparece no minimapa, bairro a bairro. O atlas tem uns oito lugares, em três continentes, quase todos pequenos. Um bairro mostra o "antes e depois" numa linha do tempo. Um país ganhou cor. Uma ideia aprendida num lugar apareceu em outro, vestida com o estilo local. O jogador tem um álbum de fotos e um caderno de cenas achadas. Já se surpreendeu pelo menos uma vez com um lugar que não pediu.

## O momento de recompensa

Há três, em escalas diferentes:

1. **O desvelamento** (todo dia). Ao voltar a um bairro, a lona da obra cai, os moradores saem para ver, o som muda, e o jogo escolhe a hora do dia em que a obra fica mais bonita. É o centro do jogo: semear hoje, ver amanhã.
2. **O apelido** (de tempos em tempos). O bairro ganha um nome para o jeito que tomou, e o brasão no atlas muda. Nunca é "nota": nenhum apelido é melhor que outro.
3. **O bairro ou o lugar novo** (a cada poucas visitas). Uma carta abre um pedaço novo do mapa, e a cor entra no esboço a lápis.

## O que mantém a calma

- Não há derrota, pontos, ranking, moeda nem cronômetro.
- Nada se estraga enquanto o jogador está fora. As obras só terminam.
- A sessão cabe em 15 minutos e pode ser interrompida em qualquer ponto.
- O jogo só conta o que o jogador vê: gente, luzes, árvores, casario.

## Retorno do Roger (24/10/2026): o que mudou e por quê

| # | O que o Roger disse | O que mudou | Por quê |
|---|---|---|---|
| 1 | Não gostou dos arranha-céus de Nova York; prefere lugares menores (vilas, bairros, cidades médias, casario). | Teto de **8 andares** na maquete. Torres sozinhas só como marco. Nas metrópoles só entram trechos de escala humana: Nova York só com sobrados e parque, Dubai pelo bairro antigo, Xangai pelas vielas e pela margem baixa do rio. O mapa comprimido trata arranha-céu como trecho repetitivo, que encolhe ou some. Na ordem de abertura, cada metrópole vem acompanhada de duas cidades pequenas ou vilas. As surpresas também ficaram pequenas. | Foi a preferência dele. Há um bom motivo de desenho: o jogo trata de escala humana (Gehl, Ewing e Handy), e um arranha-céu tira o sentido de "gente na rua". |
| 2 | Começar pelo Rio de Janeiro. | O atlas começa com um só lugar aceso, o Rio, com 3 bairros coloridos de 8. A ordem de abertura sugerida passa a começar por ele. | É o lugar que ele conhece e o que mais lhe diz. Também reduz o trabalho inicial: um único mapa a construir antes do primeiro teste. |
| 3 | 400 a 800 m é pequeno demais. O lugar é um mapa comprimido da cidade, com cortes naturais entre pontos famosos. | O "lugar" virou uma **região** com vários **bairros**. Os 400 a 800 m passaram a ser o tamanho de cada bairro. Os pontos famosos ficam em escala real, e os trechos entre eles são cortados e costurados por morro, água, praia ou parque. A visita agora escolhe um bairro. As cartas valem num bairro. | O Rio real tem mais de dez quilômetros entre esses pontos (a conferir). Um recorte de 800 m mostraria só um. Mantive o bairro como unidade de visita para a sessão continuar curta e o bairro continuar legível. |
| 4 | Referências (tiny.london, isometric.nyc, tinygyn.com): vista aérea, painel com hora e clima, minimapa, bússola. O que mais gostou: casas, bairros e parques. | Direção de arte (seção "O jeito de ver"). Hora real do lugar, minimapa com o contorno da cidade, bússola, filtro "pixel" opcional. Parques entram como bairros (Aterro do Flamengo, Heath de Londres, Park Güell e outros). | É o que ele disse que gosta. A hora real do lugar já estava no design e se encaixa no painel. |

### Mudanças anteriores do enquadramento (mantidas)

| Mudança | Motivo |
|---|---|
| **"Prosperidade" virou "Sustento".** | "Prosperidade" lembra dinheiro e acaba virando contador. "Sustento" é o que as pessoas fazem para viver (loja, barco, horta, feira), e dá para ver. O Roger decide o nome. |
| **Cada bairro tem um jeito de nascença.** | A Urca e uma vila alpina não começam iguais. Um bairro já quieto não precisa de mais sossego; seus pedidos giram em torno de quanto abrir. |
| **"Agora não" em vez de ignorar.** | Carta recusada volta mais tarde, com outra roupa. Cartas não se acumulam nem expiram. |
| **Cartas novas só chegam quando a obra do bairro termina.** | Impede abrir o jogo cinco vezes no mesmo dia para forçar cartas. Quem quer mais passa a outro bairro. |
| **Um desejo opcional por bairro.** | Dá um desafio leve, sem prêmio nem castigo (ver `FORMA.md`). |
| **Ideias viajam entre lugares.** | O jogador leva o que aprendeu num lugar a outro, e a ideia chega com o jeito local. Conecta os mapas. |

O resto do enquadramento (atlas de mesa, visita de 5 a 15 minutos, até três cartas, quatro dimensões visíveis na cena, obras em tempo real, lugares novos por cartas) fica como estava.
