# Província: plano

**Estado:** este é um plano e não há jogo ainda. Antes de qualquer código, ele volta ao Roger.
**Documentos irmãos:** `EXPERIENCIA.md` (o que se deve sentir e as 6 regras) e `REFERENCIAS.md` (estudo de 9 jogos).

---

## 1. A decisão: jogo próprio ou camada da Ilha?

**Decisão: a Província será um jogo próprio, com uma porta deixada aberta para a Ilha no futuro.** Ela reaproveita as regras de encaixe e o desenho do Retalhos (o jogo da `main`), sem alterar o Retalhos.

| Critério | Camada da Ilha | Jogo próprio |
|---|---|---|
| Ligação entre regiões | Ilhas são cercadas de água: rio e estrada não passam de uma para outra, e a herança entre regiões teria de ser inventada à parte | Regiões encostam, e as bordas viram fronteira herdada (regra 4) |
| Orçamento de regras | A Ilha já tem cerca de 12 regras e economia de óleo e comida; somar a camada passaria de 15 | 6 regras, nenhuma de economia |
| Risco de dependência | A Ilha ainda não passou nos próprios critérios (o Roger não a jogou); se ela parar, a Província para junto | Independente |
| Duração da sessão | A Ilha já usa os 15 minutos inteiros; a camada empurraria para mais | Uma região de 18 peças leva de 7 a 10 minutos |
| Visual | Renderizador da Ilha em WebGL, mais simples | Pode usar o do Retalhos: WebGPU, água com correnteza, 14 temas, vida animada, filme da partida |
| Custo | Médio (salvar ilhas e montar o mapa por cima) | Médio (regras novas são poucas; o desenho já existe) |

**O motivo, numa frase:** a graça da Província é uma região influenciar a vizinha, e ilhas separadas por mar não fazem isso. Além disso, o Roger pediu poucas regras e nada de economia, e a Ilha tem as duas coisas.

**A porta aberta:** o núcleo da Província trata a região como "uma área com bordas de entrada e de saída". Se a Ilha for aprovada um dia, uma "região-ilha" pode entrar na Província como uma região especial (uma ilha no lago, por exemplo), sem mudar as 6 regras.

---

## 2. As regras (6)

1. **Fundar:** em cada sessão você escolhe uma região vazia vizinha das já fundadas e a preenche colocando, uma a uma, as peças sorteadas nos 18 espaços dela.
2. **Encaixar:** cada borda que encosta numa borda igual vale 1 ponto, inclusive as bordas das regiões vizinhas já fundadas.
3. **Rio e estrada:** rio só encosta em rio e estrada só em estrada, e a peça que não couber em lugar nenhum vira um prado.
4. **Fronteira:** o que sai pela borda de uma região, como rio, estrada ou floresta, já fica pronto na beira da região vizinha e é o começo dela.
5. **Pedido:** cada região chega com um pedido; cumpri-lo vale 1 estrela, e os pontos de encaixe valem até mais 2.
6. **Capital:** cada estrela faz a capital crescer, e a cada 5 estrelas a província ganha uma novidade (um tipo de peça, uma estação ou uma maravilha).

**Forma do mapa:** a província tem 19 regiões em forma de colmeia. A do centro é a capital, já pronta, e restam 18 para fundar, cerca de 18 sessões. Cada região é um hexágono de 19 casas, com o marco da região no meio e 18 espaços a preencher. Na tela, a peça da vez aparece com a seguinte ao lado (como no Retalhos).

**Pedidos (rascunho, a calibrar no simulador):**
- "um rio de 5 peças";
- "uma vila de 6 casas";
- "ligue a estrada à capital";
- "uma floresta que toque 3 bordas";
- "nenhum prado de sobra".

O pedido é sorteado pela semente da região e aparece antes da primeira peça.

**O que fica de fora de propósito:** desfazer, recursos, derrota, tempo, missões diárias. O teste com pessoas diz se falta algum deles.

---

## 3. Critérios de continuar ou parar

Os critérios foram escritos antes de construir e não mudam depois de ver os resultados. Quem decide é o comportamento das pessoas e os registros (telemetria); os robôs só servem para achar defeitos.

**Continuar, se todos estes valerem:**
1. O Roger volta para uma 2ª e uma 3ª sessão, em dias diferentes, sem ninguém pedir (a telemetria registra a data).
2. O Roger explica as regras com as próprias palavras, e a explicação cobre pelo menos 4 das 6.
3. A primeira jogada válida sai em menos de 60 segundos, sem ajuda, para o Roger e para as 2 pessoas de fora.
4. A sessão mediana fica em 15 minutos ou menos (telemetria).
5. As 2 pessoas de fora completam uma região sem ajuda, e pelo menos 1 delas diz que jogaria a seguinte.
6. Na comparação às cegas (região avulsa contra região dentro da província, com a mesma semente), a maioria das 3 pessoas prefere a da província. Se não preferir, a camada da província não está entregando nada e precisa ser repensada.

**Parar ou repensar, se qualquer um destes acontecer:**
- O Roger fica 7 dias sem voltar depois da 1ª sessão.
- Depois de 1 rodada de ajuste, a sessão mediana continua acima de 15 minutos.
- Alguém pergunta "o que eu faço agora?" mais de 2 vezes numa sessão, mesmo depois do ajuste das dicas.
- No simulador, o planejador fica abaixo de 1,15 vez o guloso. Isso significa que pensar não adianta e não há desafio.

**Faixas para os robôs (só para pegar erros):**

| Medida | Faixa aceita |
|---|---|
| Pedido cumprido pelo guloso | entre 40% e 75% |
| Pedido cumprido pelo jogador aleatório | abaixo de 25% |
| Peças que viram prado por não caber | abaixo de 8% por região |
| Escolha apertada (2 jogadas com diferença de até 1 ponto) | entre 25% e 65% |
| Arrependimento médio do guloso contra o planejador | entre 2 e 6 pontos por região |

Arrependimento é quanto a escolha feita perdeu para a melhor escolha possível. Se ele for quase zero, as escolhas não importam; se for enorme, o jogo pune demais.

---

## 4. Etapas de construção (nesta ordem)

Os papéis seguem a regra do projeto: o Opus planeja e audita, o Sonnet escreve o código e os agentes Haiku pesquisam e conferem. Tudo fica na pasta `jogos/provincia/` da branch `jogo-provincia`. O código do Retalhos é só lido e importado, nunca alterado.

### Etapa 1: regras com formas simples e simulador

**O que fica pronto:**
- o núcleo das regras em TypeScript puro (`jogos/provincia/src/core/`), com a mesma semente dando o mesmo jogo;
- o simulador com 3 robôs (aleatório, guloso e planejador que olha uma peça à frente), jogando a província inteira, as 18 regiões em sequência, e medindo:
  - arrependimento;
  - pedidos cumpridos;
  - peças que viraram prado;
  - escolha apertada;
  - quanto uma região herda da anterior;
- uma página jogável com formas simples (hexágonos coloridos, sem arte), para conferir as regras com os olhos;
- a telemetria local: cada sessão grava início, fim, tempo até a 1ª jogada, peças, estrelas e pedido. O botão "exportar registro" baixa um arquivo, e nada sai do aparelho sem o Roger mandar;
- o relatório `docs/simulacao.md`.

**Como saber que ficou pronto:**
- o simulador roda 300 províncias por robô sem travar;
- todas as faixas da tabela acima são atendidas, com no máximo 2 rodadas de ajuste dos pedidos;
- a página joga uma região do começo ao fim.

**Custo estimado:** de 8% a 12% da cota semanal (Sonnet, com auditoria do Opus).

### Etapa 2: um canto bonito do mapa

**O que fica pronto:**
- a capital e 4 regiões, desenhadas com o renderizador do Retalhos (importado sem alterações);
- o pergaminho nas regiões vazias e a costura das fronteiras;
- o momento em que a região "acende" quando se completa;
- os 3 primeiros degraus da capital;
- 1 estação trocando;
- 3 detalhes raros;
- a vitrine (a província vista como diorama sobre uma base, na linha do Weatherglass);
- as capturas lado a lado com as referências.

O primeiro dia é um pico curto, para saber se o desenho do Retalhos aceita regiões sem alterar a `main`. Se não aceitar, copiamos para a pasta só o mínimo necessário e anotamos o motivo.

**Como saber que ficou pronto:**
- o painel de capturas, com o canto da província ao lado do Weatherglass, da ilha do @hakimieiqbal e de Lands of Koastalia, é aprovado pelo Roger antes de jogar;
- o teste automático (`smoke`) abre a página em WebGPU e WebGL2 sem erro;
- o FPS medido no aparelho do Roger fica em 30 ou mais com 5 regiões fundadas.

**Custo estimado:** de 15% a 25% da cota semanal. É a etapa mais cara, porque o visual pede várias rodadas de captura.

### Etapa 3: o Roger joga

**O que fica pronto:**
- a versão publicada no GitHub Pages ou como página do claude.ai, com a província inteira jogável;
- o roteiro de teste (seção 5) aplicado ao Roger e a 2 pessoas de fora;
- a comparação às cegas;
- a leitura dos registros de telemetria exportados.

**Como saber que ficou pronto:** os 6 critérios de continuar foram conferidos um a um, com o registro de onde veio cada resposta.

**Custo estimado:** de 3% a 6% da cota semanal para ler os registros e fazer uma rodada de ajuste. Do Roger, pede cerca de 3 sessões de 15 minutos em dias diferentes, mais 20 minutos com cada pessoa de fora.

---

## 5. Roteiro de teste com pessoas (para quem nunca aplicou um)

Imprima esta seção ou deixe-a aberta no celular.

**Antes**
- Abra o jogo numa província nova. Deixe papel e caneta, ou o gravador do celular, ao seu lado.
- Diga à pessoa só isto: *"É um jogo. Quero ver como você joga. Fale em voz alta o que está pensando, mesmo que pareça bobo. Eu não posso ajudar, e se travar não é culpa sua, é do jogo."*

**Durante (de 10 a 15 minutos)**
- **Não ajude, não aponte e não explique.** Se a pessoa perguntar, responda: *"O que você acha?"*
- Anote, com o minuto:
  1. quando fez a primeira jogada;
  2. cada vez que pareceu perdida ou perguntou algo;
  3. cada vez que sorriu, comentou algo bonito ou disse "ah!";
  4. se completou a região.
- Se ficar travada por mais de 2 minutos, ajude com uma frase só e anote: *"ajudei aqui"*.

**Depois (5 minutos)**
1. *"Me explique as regras como se eu nunca tivesse visto."* Anote do jeito que ela disser.
2. *"O que você mais gostou de ver?"*
3. *"O que foi chato ou confuso?"*
4. *"Você jogaria a próxima região? Por quê?"*
5. Mostre as duas versões (A e B) com a mesma semente, sem dizer qual é qual: *"Qual você prefere?"*

**Para entregar ao Opus:** as anotações, mais o arquivo de registro do botão "exportar registro".

**Não vale:** testar com quem viu o jogo sendo feito, explicar antes ou depois de cada jogada, ou perguntar "gostou?". Todo mundo diz que sim.

---

## 6. Métodos usados

- **MDA (mecânica, dinâmica e estética).** A mecânica são as 6 regras. Elas geram as dinâmicas de herdar fronteiras, completar pedidos e escolher onde fundar. A estética buscada é a descoberta, a coleção e a contemplação, sem competição nem domínio de sistema.
- **Ciclo dos verbos:** escolher região, encaixar peças, olhar a região acender, e a capital cresce. A curiosidade pela próxima região fecha o ciclo e leva à escolha seguinte.
- **Simulador com robôs e arrependimento** (Etapa 1).
- **Telemetria local exportável** (Etapa 1).
- **Duas versões lado a lado com a mesma semente:** região avulsa contra região na província (Etapa 3).
- **Teste com pessoas pensando em voz alta** (seção 5).
- **Painel de capturas contra as referências** (Etapa 2).
- **FPS no aparelho real** (Etapa 2).

---

## 7. Riscos

| Risco | Chance | Como percebemos | O que fazer |
|---|---|---|---|
| Parecer "o Retalhos com cercas" | Média | Na comparação às cegas, ninguém prefere a versão na província | Reforçar o que é só da Província: herança de fronteira, capital, álbum de raridades, filme |
| A região é pequena demais e o sorteio frustra | Média | O simulador mostra muitas peças virando prado; as pessoas reclamam de "peça que não serve" | Mostrar 2 peças à frente, ou aumentar a região para 24 espaços |
| As escolhas não importam (sem desafio) | Baixa | O planejador fica abaixo de 1,15 vez o guloso | Pedidos mais exigentes; fronteiras com mais rio e estrada |
| O renderizador do Retalhos não aceita regiões sem mudar a `main` | Média | O pico do 1º dia da Etapa 2 | Copiar o mínimo para a pasta, ou pedir ao Roger licença para mudar a `main` |
| O salvamento se perde (navegador limpo) | Média | — | Botão para exportar e importar a província como arquivo |
| Lento no celular | Baixa a média | FPS abaixo de 30 no aparelho | O Retalhos já desce a qualidade sozinho; a província tem no máximo cerca de 360 peças, e o Retalhos já aguenta 300 na Alta |
| O Roger não volta | — | Critério de parar nº 1 | Parar e conversar antes de gastar mais |

---

## 8. Resumo de custo

| Etapa | Cota semanal | Tempo do Roger |
|---|---|---|
| 0. Este plano | cerca de 3% a 5% | ler o plano e responder 4 perguntas |
| 1. Regras e simulador | 8% a 12% | nenhum (pode olhar a página de formas simples) |
| 2. Canto bonito | 15% a 25% | aprovar o painel de capturas e medir o FPS no aparelho |
| 3. O Roger joga | 3% a 6% | 3 sessões em dias diferentes e 2 testes de 20 minutos |

As estimativas de cota são aproximadas: a Etapa 2 pode variar bastante conforme o número de rodadas de captura.
