# Atlas: riscos e critérios para continuar ou parar

Quatro partes: riscos de design, riscos técnicos, riscos legais e, por último, os **critérios escritos antes de testar**. Os critérios foram congelados em 24/10/2026. Não se mudam depois de ver o resultado de um teste.

Tudo que é número de custo ou de tamanho abaixo é **chute meu, a medir no primeiro protótipo**, e está marcado assim.

## 1. Riscos de design

| # | Risco | Por que importa | O que faço |
|---|---|---|---|
| D1 | **Repetição.** Com 100 bairros e uma dúzia de cartas cada, as cartas começam a parecer iguais. | Quem joga todo dia percebe em três semanas. | Cartas de dois tipos: cartas **do bairro** (poucas, escritas à mão) e **baralhos por tipo de bairro** (orla, ladeira, centro histórico, parque, vila de pesca, aldeia de montanha), que o bairro preenche com a sua ficha. Personagens recorrentes, arcos curtos e o toque do Claude (`CARTAS.md`). |
| D2 | **Escolhas óbvias.** O jogador acaba sempre pegando as cartas "verdes" (Sossego), porque soam melhores. | Sem dúvida não há jogo. | Todo ganho tem custo real (inclusive Sossego, que custa Convivência), a nascença puxa para um lado, há cartas rivais. Teste no portão 2. |
| D3 | **Peso de manter muitos lugares e bairros.** Cerca de cem bairros, cada um com ficha, mapa, marco, moradores e cartas. | O projeto é de uma pessoa com pouco tempo. | Entrar aos poucos: o jogo nasce com 3 bairros do Rio, e o resto vai sendo construído enquanto as cartas abrem (a ordem de abertura dá esse tempo). Mínimo para abrir um bairro: 6 cartas e a ficha. As cidades grandes entram por último. |
| D4 | **A 1ª visita é frágil.** A obra só fica pronta na visita seguinte, e a primeira visita termina em promessa e carimbo. | Se o Roger sentir "não aconteceu nada", ele não volta. | Na 1ª visita há o carimbo, o croqui dourado e operários em ação, e o jogo já tem vida por si (contemplação). Teste no portão 3. Plano B, que não quebra nenhuma regra: encurtar os tempos das obras (pequena em 1 hora, média em 6, grande em 24). |
| D5 | **Bairros esquecidos.** Com 100 bairros e uma visita por dia, cada um é visitado de tempos em tempos. | O bairro perde a sensação de "meu". | Nada se estraga com o tempo (regra 4). O bilhete de chegada recapitula. Teste: mediana de 3 visitas por bairro em 60 dias (portão 3). |
| D6 | **Soar como cartilha de urbanismo.** | Estraga a contemplação. | As cartas são pedidos de gente, nunca de "especialista". Os moradores discordam. O jogo nunca diz o que é "certo". |
| D7 | **Representação cultural.** Vilas tailandesas, chinesas, do Oriente Médio, nomes e costumes. | Estereótipo ou erro de fato. | Personagens inventados, costumes só pela ficha conferida, revisão de alguém que conheça cada região antes de qualquer versão pública. |
| D8 | **Comprimir demais e perder o lugar.** O morador do Rio estranha o mapa. | O encanto é reconhecer. | O minimapa mostra as dobras. Os pontos famosos ficam em escala real. Teste cego no portão 1. |
| D9 | **Cidade que acaba.** Depois de um ano, o que fazer? | Perda de interesse. | O atlas não termina: bairros extras por carta, estações, segundos recortes, cenas raras. Não é prioridade antes de passar nos portões. |
| D10 | **Metrópole demais.** O Roger pediu o contrário. | Já aconteceu uma vez. | Teto de 8 andares, proporção de duas pequenas para cada metrópole, e metrópoles só por trechos de escala humana. |

## 2. Riscos técnicos

### T1. Dados irregulares por país

Os dados abertos de prédios variam muito de país para país: em geral bem mapeados na Europa e em partes das cidades grandes, mais rarefeitos em vilas e em países com pouca comunidade de mapeamento. Altura e forma de telhado quase nunca estão marcadas (a convenção dos renderizadores é 3 m por andar quando falta a altura). A pesquisa técnica **não conseguiu consultar a OpenStreetMap neste ambiente** (os servidores estavam bloqueados) e **não mediu a cobertura** nem de Copacabana. Só consultou, e com sucesso, o catálogo da Overture e arquivos de relevo. O primeiro teste real de dados ainda não foi feito.

**O que faço:** uma **ficha de qualidade de dados** por bairro (quanto dos prédios existe, quanto tem altura, se o relevo e a água estão certos). Se os dados faltam, o bairro vem de um traçado procedural a partir de ruas e quarteirões, e o marco é feito à mão. O estilo do jogo (casinhas coloridas, telhados legíveis) tolera isso, porque nunca promete fidelidade de prédio por prédio.

### T2. O custo de montar um mapa comprimido por cidade

Este é o risco novo trazido pelo pedido do Roger. Um recorte de 800 m era um trabalho; um mapa de cidade com 8 bairros e 7 costuras é outro. **Estimativa (chute a medir):**

| Peça | Dias de trabalho (uma pessoa) |
|---|---|
| Um bairro de metrópole (dados, limpeza, estilização, marco à mão, ficha, 10 a 12 cartas, cenas) | 2 a 3 |
| Um bairro de vila ou de cidade pequena | 1 a 2 |
| Uma costura nova (corte e emenda natural entre dois bairros) | 1 a 2 |
| Minimapa, bússola, voo entre bairros, integração | 3 por lugar |
| **Os 3 bairros iniciais do Rio** (portão 1) | cerca de 14 |
| **O Rio completo** (8 bairros, 7 costuras) | 25 a 40 |
| Uma cidade média de 3 bairros | 6 a 10 |
| Uma vila | 1 a 3 |
| **Os 31 lugares mais as 12 surpresas** | 250 a 350, mais de um ano de uma pessoa |

As metrópoles pesam a maior parte da conta. O pedido do Roger por lugares menores **reduz** o custo.

**O que faço:**

- **Fatia vertical primeiro:** só os 3 bairros iniciais do Rio, Paraty (uma vila) e Gimmelwald (um isolado). Testa a compressão, o pipeline e o jogo com o mínimo de trabalho.
- **Construir sob demanda.** Um bairro só precisa existir pronto quando a carta que o abre estiver para sair. Os bairros a lápis custam quase nada.
- **Reaproveitar:** a costura, o minimapa e a ficha são feitos uma vez e viram ferramenta.
- **Medir o custo real no Rio** antes de aceitar a próxima metrópole (portão 1).

### T3. Outros riscos técnicos

| # | Risco | O que faço |
|---|---|---|
| T3a | **Relevo grosseiro.** O relevo aberto de satélite tem cerca de 30 m por ponto, ou seja, 20 pontos num bairro de 600 m, e costuma incluir copa de árvore e prédio. | Suavizar e esculpir à mão os pontos famosos. Usar o relevo para o desenho geral e não para detalhe. (O 30 m do SRTM está na pesquisa técnica; o resto é conhecimento geral, a conferir.) |
| T3b | **Desempenho.** Um mapa de 3 a 4 km com 8 bairros é grande. | Usar a régua do Retalhos como limite: cerca de 136 draw calls e 1,46 milhão de triângulos para 300 peças em qualidade Alta (medido por software; o FPS em GPU real ainda é pendência do projeto). Bairros a lápis custam quase nada, e cada bairro só carrega quando abre. |
| T3c | **Tamanho do download.** Cem bairros pré-gravados podem pesar. | Gravar cada bairro à parte, carregar quando abre. Orçamento a medir; meta de partida: 3 MB por bairro (chute). |
| T3d | **Costura que parece falsa.** Uma rua que entra de um lado do corte e não sai do outro. | O corte só cai em quebras reais (água, morro, parque) e é revisto à mão. Teste cego (portão 1). |
| T3e | **Toque do Claude na hora.** Latência, falta de internet, custo, fato inventado. | O jogo funciona sem ele (a carta sai do modelo). Conferidor de regras, texto guardado, fatos só pela ficha. Teste no portão 5. |
| T3f | **Relógio do aparelho.** Quem muda a hora do aparelho adianta as obras. | Aceitar. Não há ranking nem prêmio, e o jogo é de uma pessoa só. |
| T3g | **Teto de 8 andares.** Depende de saber a altura dos prédios, que muitas vezes não existe. | O teto vale na estilização (qualquer prédio é cortado em 8 andares), então a falta de dado não atrapalha. |

## 3. Riscos legais

Leitura minha, não parecer jurídico. O Roger lê melhor que eu as cláusulas, e por isso indico onde olhar.

### L1. OpenStreetMap (licença ODbL)

- **Atribuição.** Quem usa publicamente uma obra produzida (imagem, vídeo, texto) com conteúdo da base precisa avisar que o conteúdo veio dela e que está sob a ODbL (cláusula 4.3 do texto lido). No jogo: tela de créditos, e o **verso de cada foto (cartão-postal)** traz a atribuição "© colaboradores do OpenStreetMap, ODbL".
- **Banco derivado (o ponto sério).** Um arquivo de prédios, ruas ou relevo **extraído** do OSM, mesmo comprimido ou deformado pelo mapa comprimido, pode ser um "banco de dados derivado" (cláusula 4.4). Se o jogo distribui esse arquivo, ele precisa sair sob ODbL (ou licença compatível), com uma cópia legível por máquina (4.6). Já a imagem final desenhada a partir dos dados é uma "obra produzida" e não obriga a isso (4.5 b). A fronteira entre os dois, no caso de geometria gravada dentro do jogo, **precisa de leitura jurídica**.
- **Uso privado é outra coisa.** O texto lido diz que o uso interno, não público, fica fora da regra de compartilhamento (4.5 c). O risco real começa quando o jogo é **publicado**, e o repositório publica páginas na internet.

**Opções, da mais barata à mais cara:**

| Opção | O que faz | Custo | Risco |
|---|---|---|---|
| A | Gravar só malhas e imagens prontas, sem arquivo de dados separado. | Zero | Incerto: a malha pode ser vista como dados extraídos. |
| B | **Publicar os dados extraídos de cada bairro como um conjunto aberto sob ODbL**, em arquivo separado do código e da arte do jogo. | Baixo | Baixo; é o caminho padrão de quem usa OSM. |
| C | Redesenhar os prédios à mão, usando o OSM só como consulta. | Alto | Baixo, mas o custo é enorme para cem bairros. |

**Recomendação:** B, com decisão do Roger **antes de qualquer publicação**. Enquanto isso, só uso privado.

### L2. Outras fontes de dados

- **Overture Maps.** A licença de cada tema **não foi confirmada**: os trechos de busca dizem que o padrão é CDLA Permissive 2.0 e que temas derivados da OSM seguem a ODbL. A página de atribuição não abriu. Não usar um tema sem conferir.
- **Microsoft Building Footprints.** O README e o arquivo de licença lidos dizem CDLA Permissive 2.0, mas trechos de busca dizem ODbL em dois catálogos. O conflito não foi resolvido. Conferir o conjunto que for usado.
- **Relevo.** SRTM e Terrarium (AWS): atribuição do Serviço Geológico dos EUA, com o texto do arquivo de atribuição do projeto joerd. A licença do Copernicus DEM não foi lida.
- **Manifesto por bairro:** uma lista de fonte, licença e atribuição de cada dado que entrou, e uma tela de créditos que sai dela.

### L3. Google: não usar

Os termos do Google Maps Platform lidos vedam baixar e guardar tiles em massa, guardar em cache fora das APIs listadas e **criar conteúdo com base em conteúdo do Google** (cláusulas 3.2.3 a, b e c), e o texto lido não traz exceção para uso não comercial. As páginas de referência do Roger (tiny.london, isometric.nyc), segundo trechos de busca, usam o Google Photorealistic 3D Tiles. O Atlas **usa só dados abertos e desenho à mão**. Regra de trabalho: nenhum bairro é desenhado olhando a tela do Google Maps, Earth ou Street View para decalcar. (A política específica dos 3D Tiles não foi lida; o certo é conferir.)

### L4. Marcos, direitos autorais e marcas

| Item | Observação |
|---|---|
| **Cristo Redentor** | O escultor (Landowski) morreu em 1961, e a obra ainda estaria protegida por direitos autorais; a Arquidiocese administra a imagem. [conferir] Plano B: silhueta estilizada, sem copiar a escultura. |
| **Calçadão de Copacabana e Aterro do Flamengo** | Obras de Burle Marx (e do Aterro, também de Reidy), autores do século XX. [conferir] |
| **Lei 9.610/1998, art. 48** | Segundo meu conhecimento, as obras situadas permanentemente em logradouros públicos podem ser representadas livremente por pintura, desenho, fotografia e procedimentos audiovisuais. [conferir se cobre um jogo 3D] |
| **Sagrada Família, Sacré-Cœur, Arcos da Lapa** | Autores já falecidos há muito tempo; em princípio sem proteção. [conferir] |
| **Marcos de fora do Brasil** | Cada país tem uma regra de "panorama" diferente, e alguns, como a França, não têm liberdade ampla para prédios recentes [verificar]. |
| **Marcas de loja** | Todas fictícias. |
| **Pessoas** | Moradores inventados. Nenhum é pessoa real. |
| **Referências visuais** | As páginas de referência do Roger inspiram o estilo, nada se copia. |
| **O nome "Atlas"** | É genérico demais. Antes de publicar, conferir marca registrada. |

### L5. Dados do jogador

O toque do Claude envia ao serviço só o texto da carta e o contexto da partida (obras, hora, clima), sem nome nem dado pessoal. O jogador é "o visitante". O save é local.

## 4. Critérios para continuar ou parar (escritos antes de testar)

Congelados em **24/10/2026**.

### Portão 1: o visual do Rio (os 3 bairros iniciais)

- **Teste.** Cinco pessoas (duas que conhecem o Rio, três que não), sem legenda: a) mostrar o mapa do Rio e perguntar "que cidade é?"; b) mostrar o bairro da Urca por 10 s e perguntar "que lugar é?".
- **Continuar se:** pelo menos 4 de 5 reconhecem a Urca e pelo menos 3 de 5 reconhecem o mapa como o Rio.
- **Rever a compressão se:** menos de 3 de 5 reconhecem o mapa. Menos cortes, mais pontos famosos.
- **Custo.** Os 3 bairros iniciais em no máximo **28 dias de trabalho** (o dobro da estimativa de 14). Acima disso, **parar de abrir metrópoles**: o Rio fica com 5 bairros, e os próximos lugares são só vilas e cidades pequenas.

### Portão 2: as cartas e as escolhas

- **Teste.** O Roger e mais uma pessoa jogam 10 visitas cada, com as 16 cartas mais as 3 de abertura.
- **Continuar se:** em pelo menos metade das mesas o jogador diz que **hesitou**; nenhuma carta é escolhida em mais de **75%** das vezes em que aparece; a leitura das cartas leva menos de **5 minutos** por visita.
- **Rever se:** 80% ou mais das escolhas caem num mesmo tipo de carta (por exemplo, as de Sossego).

### Portão 3: o retorno e a recompensa

- **Teste.** O Roger joga 14 dias, sem avisos do jogo.
- **Continuar se:** volta em pelo menos **8 de 14 dias**; a visita mediana tem no máximo **15 minutos**; na 2ª visita ele diz que esperar valeu a pena; cada bairro aceso tem uma mediana de pelo menos 3 visitas em 60 dias.
- **Rever se:** na 2ª semana ele volta em menos de **4 dias** sem ter viajado, ou descreve a 1ª visita como "não aconteceu nada". Primeiro remédio: encurtar os tempos das obras (D4).

### Portão 4: desempenho

- **Teste.** O bairro mais denso (Copacabana) e o mapa do Rio com os 3 bairros acesos, na régua do Retalhos.
- **Continuar se:** o bairro fica dentro de cerca de 150 draw calls e 1,5 milhão de triângulos em qualidade Alta, e o mapa com 3 bairros não passa de 2× isso. Medir também em GPU real e no celular, que é pendência do projeto (o FPS ainda não foi medido).
- **Parar e rever se:** o mapa passa de 2× a régua. Cortar mais, carregar por bairro.

### Portão 5: o toque do Claude

- **Teste.** 200 textos conferidos à mão contra as fichas dos lugares.
- **Continuar se:** **nenhum** fato inventado, pelo menos 90% passam no conferidor, a latência mediana é de até 3 segundos.
- **Se falhar:** o toque é **desligado** e o jogo segue com os modelos. Isso não é motivo para parar o jogo.

### Portão 6: o legal (antes de qualquer publicação)

- **Exige:** decisão escrita sobre a ODbL (opção B ou C), tela de créditos e cartão-postal com atribuição funcionando, lista de marcos protegidos conferida, licença de cada fonte de dados confirmada.
- **Se não estiver pronto:** nada é publicado. Uso privado continua.

### Portão 7: dados em três países

- **Teste.** Um bairro de cada, com qualidade de dado diferente: Brasil (Urca), Noruega (Bryggen) e Tailândia (Koh Panyi).
- **Continuar se:** cada bairro fica **legível** com no máximo 1 dia de ajuste manual além do automático.
- **Rever se:** algum precisa de mais, e então os países com pouco dado passam a ser feitos à mão desde o começo.

### Quando parar de vez

Se **dois dos portões 1, 2 e 3** falharem, **para-se de investir em lugares novos**. O Atlas encolhe para um só lugar (o Rio) como brinquedo de contemplação, ou volta para as Expedições. Falha do portão 5 desliga o toque. Falha do portão 6 impede a publicação. Falha do portão 4 ou 7 corta o escopo, não o jogo.
