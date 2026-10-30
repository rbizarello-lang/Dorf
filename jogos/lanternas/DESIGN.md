# Ilha das Lanternas: especificação das regras (etapa 1)

Puzzle de cartas e névoa em hexágonos. Uma partida dura 30 turnos (10 a 15 minutos). Tudo vive em `src/core` (puro, determinístico, roda em Node). Os números vivem em `RULES` (`src/core/game.ts`); o motivo de cada um está em `docs/simulacao.md`.

## Mapa

- Hexágonos flat-top, coordenadas axiais (q, r), raio 7 (169 hexágonos). Anel externo sempre água.
- Gerado pela semente por ruído simples. Terrenos: Água, Praia (borda da terra), Prado, Bosque, Rocha. Só fica a terra ligada ao centro. Em média ~95 hexágonos de terra.
- O centro é sempre terra e tem o **Farol velho**, uma lanterna já acesa.
- **Ponta marcada:** o hexágono de terra mais distante do centro (desempate por menor q, depois r). Aparece marcado desde o início, mesmo na névoa.
- Sementes independentes (`subSeed`) para mapa, achados, baralho e metas: mudar um gerador não mexe nos outros.

## Névoa e luz

- **Revelado** = a distância <= 2 de uma lanterna acesa (o Farol conta). A revelação é permanente.
- Um hexágono pode receber peça se está revelado, é terra, está vazio e não tem achado.
- **Regra de socorro:** se a luz não tem mais nenhuma terra vazia, a Lanterna pode ser posta numa terra vazia da névoa encostada na luz.

## Achados escondidos (6 por ilha, gerador à parte)

Nascem a distância >= 4 do centro (relaxa até 3 se faltar lugar). Revelar = entrar na luz. Ocupam o hexágono (não recebem peça). O efeito só vale depois de revelado.

| Achado | Onde | Efeito |
|---|---|---|
| Ruína (2) | terra que não é praia | +3 moradores ao revelar |
| Cardume (1) | água junto de uma praia | Cais vizinho rende +2 comida por turno a mais |
| Pomar (2) | prado | Casa vizinha: +1 morador e conta como tipo na variedade |
| Nascente (1) | prado ou bosque | Campo vizinho rende +1 comida por turno |

## Turno

1. A mão tem as 3 cartas do topo do baralho. **Mão garantida:** se nenhuma cabe em lugar nenhum, a 3ª troca com a primeira carta do baralho que caiba (se nenhuma do baralho inteiro cabe, o turno conta como "travado").
2. O jogador escolhe 1 carta e a coloca num hexágono válido, **ou** descarta uma carta por +1 óleo (nunca trava). A carta escolhida sai de jogo; as outras 2 voltam ao fundo do baralho.
3. Fim do turno: entra a renda (comida e óleo de todos os produtores).
4. Se for turno 10, 20 ou 30: **noite** (abaixo). A comida só serve para casas e para a festa da noite: não dá para guardá-la.
5. Turno seguinte, até o 30.

Baralho: 58 cartas, embaralhado pela semente: Casa 16, Campo 10, Oliveiral 10, Lanterna 13, Cais 9. Começo: 2 óleo e 2 comida.

## Sopro do vento (clima que se toca)

- Quem joga tem **1 sopro**. Tocar numa nuvem de névoa encostada na área iluminada dissolve a névoa num raio 1 em volta dela (7 hexágonos): revela o terreno e os achados, mas **não ilumina**. Ali não cabe Casa, Campo, Oliveiral nem Cais; a área não conta como iluminada para as metas nem ativa o efeito dos achados. A **Lanterna** cabe na terra soprada (é como se ganha o chão), com o custo de sempre.
- O sopro **não gasta o turno**, recarrega em cada noite (turnos 10 e 20; no 30 já não serve) e guarda no máximo 1.
- Lógica em `src/core` (`seen`, `canBlow`, `blow`, `Game.windArea`); a ação `{ kind: 'wind', idx }` entra no `history` e `Game.replay(seed, ações)` refaz a partida.
- **Interface:** botão "Vento" no HUD (carga cheia ou vazia, armado, foco, desabilitado; tecla V). Passar o cursor numa nuvem válida a faz balançar e marca a área; tocar solta a rajada (fiapos de vento, copas e trigo vizinhos se curvam por 1 s, a névoa é empurrada). No toque, o primeiro toque marca a nuvem e o segundo sopra. Terra à vista sem luz ganha um véu azulado até uma lanterna chegar. `prefers-reduced-motion` desliga balanço, rajada e chuva animada (a névoa some rápido).
- **Chuvinha cosmética:** tocar no céu vazio, fora do tampo da ilha, faz chover por 4 s (riscos de chuva, mar mais agitado, luz mais cinza). Não muda regra nenhuma.

## Cartas

| Carta | Custo | Onde | Efeito |
|---|---|---|---|
| Casa | 5 comida | Prado, Bosque ou Praia | Moradores = 1 + tipos distintos vizinhos entre {Campo, Bosque, Água/Praia, Lanterna, Pomar}, +1 se há Pomar vizinho, no máximo 4 |
| Campo | 0 | Prado | +1 comida por turno (+1 por Nascente vizinha) |
| Oliveiral | 0 | Prado ou Rocha | +1 óleo por turno |
| Lanterna | 4 óleo | qualquer terra | acende com raio 2 e revela a névoa |
| Cais | 0 | Praia com água vizinha | +1 comida por turno (+2 com Cardume vizinho) |

"Bosque" como tipo conta só o hexágono de Bosque ainda sem construção. Os moradores de uma Casa mudam quando os vizinhos mudam.

## Noite (turnos 10, 20 e 30)

- Cada lanterna, exceto o Farol, queima 2 óleo, na ordem em que foi acesa. Sem óleo, apaga naquela noite.
- **Festa:** depois das lanternas, a comida guardada vira moradores: cada 5 comida = +1 morador, no máximo 14 por noite, em casas com lanterna acesa encostada e com vaga (cada casa recebe até 4 convidados além dos 4 da variedade, em rodízio). **O estoque de comida zera**, sobre ou não. Por isso vale gastar a comida em casas antes da noite e só guardar o que a festa aproveita.
- **Casa que não tem lanterna acesa encostada** (distância 1; o Farol vale) perde 1 morador, permanentemente (mínimo 0).
- A luz que revela a névoa (raio 2) é maior que a que protege à noite (raio 1): é por isso que as casas devem ficar junto de lanternas.

## Metas (3 por partida, sorteadas pela semente; +5 pontos cada, conferidas no fim)

| Meta | Condição |
|---|---|
| Ponta marcada | uma lanterna no hexágono da ponta |
| Moradores | 66 moradores |
| Achados | 5 achados revelados (de 6) |
| Fileira | 4 casas encostadas em linha reta |
| Ilha iluminada | 80% dos hexágonos de terra revelados |

**Pontuação final = moradores (casas, festas + 3 por Ruína) + 5 por meta cumprida.**

## Mudanças em relação ao enunciado inicial

Raio de proteção da noite 1; lanternas queimam 2 óleo à noite; festa da noite (5 comida = +1 morador, até 14 por noite, 4 convidados por casa além dos 4 da variedade; o estoque zera); Casa 5 comida (era 1); Lanterna 4 óleo (era 2); baralho de 58 cartas; regra de socorro da Lanterna; mão garantida; achados longe do centro e sempre 6; metas: 66 moradores, 5 achados (era 4), fileira de 4 (era 3), ilha 80% (era 60%). Detalhes e motivos em `docs/simulacao.md`.

## Código

- `src/core/hex.ts`, `rng.ts`, `map.ts` (ilha e achados), `game.ts` (regras, metas, `RULES`), `bots.ts` (aleatório, guloso, planejador).
- Bots decidem numa cópia cega do jogo (`Game.clone(true)`): não espiam achados sob a névoa.
- `tests/sim.ts`: 300 partidas por bot, critérios de aprovação (inclui perda média de comida por noite do planejador <= 4 e óleo final médio < 10), invariantes (determinismo, casa <= 8 (4 da variedade + 4 de festa), recursos >= 0); grava o relatório em `docs/simulacao.md`.
- `src/main.ts` + `index.html`: entrada do jogo. `?seed=` (inteiro de até 9 dígitos, validado).

## Visual e sensação (etapa 2)

Tudo gerado em código (sem arquivos de arte), WebGLRenderer do three, ACESFilmic + sRGB, uma luz direcional com sombra de 2048.

- **Paleta (6 cores nomeadas, em `src/render/palette.ts`):** Mar de vitrine (turquesa), Areia de maré, Prado de oliva, Telha de barro, Chama de lanterna (âmbar), Noite de breu (azul-marinho).
- **Diorama:** ilha sobre pedestal de madeira torneada, mar raso recortado dentro de um tampo, fundo liso em degradê que acompanha a hora do dia. Câmera orbital limitada (arrastar gira e inclina, roda ou pinça aproxima, setas e +/- no teclado); nunca passa do chão.
- **Peças de terra:** hexágonos chanfrados com relevo leve e alturas por terreno (praia < prado < bosque < rocha). A espuma da costa só aparece para a terra já revelada (não entrega o formato da ilha escondida).
- **Kits (`src/render/kits.ts`, instanciados por `Pool`):** 3 árvores, casas de 3 cores de telhado com chaminé (cada morador acende uma das 4 janelas), campo em fileiras, oliveiral, cais com barquinho, lanterna, Farol velho com casa do faroleiro e feixe, rocha, ruína, pomar, nascente, cardume.
- **Névoa:** nuvens baixas low-poly que se dissolvem em ~0,85 s quando a área é revelada; a ponta marcada é uma bandeira com estrela acima das nuvens.
- **Hora do dia:** do turno 1 ao 30 a luz vai de manhã a entardecer. Nas noites (10, 20, 30) há um anoitecer curto: lanternas com halo e poça de luz no chão, janelas acesas, lanternas sem óleo apagadas e "−1 morador" sobre as casas que perderam gente. No fim da partida a ilha fica à noite, com a câmera girando devagar.
- **Vento e chuva (`world.ts`, `materials.ts`):** `U.gustPos/gustDir/gustAmp` curvam copas e trigo perto da rajada (no vertex shader dos materiais com vento); `U.rain` agita o mar; a névoa soprada voa na direção da rajada em vez de subir; um véu azulado cobre a terra à vista sem luz; fiapos de vento e riscos de chuva são `InstancedMesh` próprios (+4 draw calls no pior caso).
- **Cardume:** peixes maiores, prateados com nadadeira laranja, 14 por cardume, uma mancha escura sob o cardume (vista de cima), saltos com respingo de vez em quando e, à noite, um brilho azulado fraco.
- **Celular em pé:** a câmera sobe (inclinação 0,8 em vez de 1,0) e o enquadramento fecha para a ilha ocupar a largura útil; no fim da partida a ilha sobe para o espaço livre acima do painel de resultado; o botão de vento vira um ícone no canto do painel de recursos.
- **Sensação:** peça cai com quique e poeira, "+N moradores" flutuando, hexágonos válidos realçados em âmbar, fantasma da peça sob o cursor (no toque: primeiro toque mostra, segundo confirma). `prefers-reduced-motion` desliga queda, poeira, vento, órbita e acelera a névoa.
- **HUD (`src/ui/`):** cartas desenhadas com ícone em SVG inline, recursos e moradores em bloco, régua de dia e noite com aviso do óleo que a próxima noite pede, metas com barra e marca, tela de fim ao lado da ilha. Fontes do sistema, sem CDN: o build é um HTML único e funciona offline.
- **Orçamento medido:** 37 a 65 draw calls e 147 a 178 mil triângulos nas capturas, com a ilha cheia e as camadas do vento e da chuva (limite: 150 e 300 mil).

### Ganchos de depuração

`?seed=N`, `?auto=N` (o planejador joga N turnos ao abrir, sem animação), `?blow=1` (sopra o vento no melhor alvo e congela a rajada no meio; `&hold=S` escolhe quantos segundos de mundo deixar andar), `?rain=1` (congela a chuva no meio), `?turn=N` (hora do dia fixa), `?night=1`, `?yaw= ?pitch= ?zoom=`, `?focus=vila`, `?select=0..2`, `?hover=valid`, `?reduzir=1`. `window.__stats` (draw calls e triângulos do último quadro), `window.__ready`, `window.__world`, `window.__game()`.

### Capturas

`npm run build && npm run shot` (ou `node scripts/shot.mjs [nome ...]`) sobe o `dist/` num servidor próprio, abre no Chromium com SwiftShader e grava `docs/screens/*.png` (1280x800; `celular` e `celularfim` em 390x780), imprimindo os erros do console e o `__stats` de cada uma.

Capturas do vento, da chuva e do cardume: `vento` (rajada no meio, mundo congelado por `?blow=1`), `ventoveu` (3 s depois, com o véu sobre a terra à vista), `chuva` (`?rain=1`), `cardume` e `cardumenoite`. O `shot.mjs` espera `window.__held` nelas, em vez da intro assentar.

## Página do teste às cegas (etapa 3)

Uma página só (`dist/index.html`) em que a pessoa joga "Ilha 1" e "Ilha 2". Uma é a versão A (regras de `game.ts`) e a outra a B (`gameB.ts`); o visual é o mesmo, só mudam as regras e o que decorre delas.

- **Escolha às cegas (`src/ab.ts`):** a correspondência é sorteada uma vez por aparelho e fica em `localStorage` (`lanternas.ab`); se falhar, vale um sorteio por sessão. A tela de escolha só diz "Ilha 1" e "Ilha 2". Gancho `?ab=A|B` pula a escolha (depuração e capturas). `?seed=`, `?auto=` etc. seguem valendo.
- **Uma View para as duas versões (`src/render/view.ts`):** o diorama lê `seen`, `revealed`, `struct`, `houses` e `houseResidents`; a B entra por um adaptador (`viewB`) que lê o `GameB` ao vivo, sem mexer no `src/core`.
- **O que decorre das regras:** só a B tem casas que mudam de forma com o nível (térrea, sobrado, casarão, solar), marcos da vila (poço, praça, capela), Bosque como peça, e o final aceso sem noites no meio. A A tem óleo, comida, descarte, vento e noites; o HUD de cada uma segue as próprias regras (`hud.ts` e `hudB.ts`, sobre `hudBase.ts`).
- **Achados com brilho e presente:** nas duas versões, o achado revelado ganha coluna de luz, poça dourada e um presente que flutua.
- **Direção visual Weatherglass (nas duas):** fundo escuro e quente por hora do dia; ilha num pedestal de nogueira com aros de latão (metal com reflexo de uma sala de estúdio gerada em código, só nesse material); corte lateral em camadas (terra, argila, pedra) nas bordas da terra, com o mar abaixo do topo das peças; bando de pássaros que cruza a ilha de vez em quando; fumaça nas chaminés; controles de nogueira e latão (painéis com parafusos, régua do dia como escala de mostrador, peças como plaquetas, botões de latão). Texto creme sobre madeira escura e tinta escura sobre latão, para manter o contraste.
- **Dicas (`src/ui/dicas.ts`):** na 1ª partida de cada ilha, dicas de uma linha, uma por vez, na hora em que a regra importa; "Pular dicas" (na dica e no menu). O que já foi visto fica em `lanternas.dicas.A|B`.
- **Telemetria local (`src/telemetry.ts`):** `lanternas.registro` guarda as 20 últimas partidas: id anônimo do aparelho, ilha, versão, semente, início e fim, por turno as peças oferecidas, a escolhida, o lugar, os segundos até decidir (só com a aba à vista), se havia dica, se descartou, e se a partida foi abandonada. Também `recomecou` (começou outra partida depois de terminar). Nada sai do aparelho. "Exportar minha sessão" (menu) abre o texto JSON com um botão Copiar.
- **Medidor de FPS:** `?fps` mostra o FPS mediano dos últimos 5 s e o nome da placa de vídeo (quando o navegador informa).
- **Orçamento medido (capturas, renderização por software):** ver `docs/screens` e o relatório da etapa; limite de 150 draw calls e 300 mil triângulos.
- **Teste de ponta a ponta:** `node scripts/jogar.mjs` joga as duas ilhas inteiras pela interface (cliques de verdade) e confere a telemetria e a exportação.
