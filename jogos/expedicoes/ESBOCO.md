# Expedições (esboço visual)

Panorama visual, não jogo: mostra como o conceito pode ficar. Terreno orgânico e contínuo (relevo por ruído, margens irregulares, corte lateral da terra em camadas), construções em pontos livres, como um diorama feito à mão. Nada de grade hexagonal, de peças que se encaixam por bordas ou de tabuleiro em quadrados.

## O conceito

Uma **capital** fica fixa num mapa. Em cada sessão curta (10 a 15 minutos) o jogador escolhe um destino e envia uma caravana a um lugar novo, onde funda um pequeno posto, e **cada lugar tem um jeito próprio de construir**. O que o posto rende volta para a capital, que cresce à vista ao longo de semanas, e o mapa ganha um ponto aceso. Desafio leve, sem economia complexa.

A ideia central: **o que você trouxe muda a cara da capital**. Na semana 4 a capital tem um bairro de pescadores com o estilo da costa, torres de pedra com o estilo da serra, um canal com passarelas com o estilo do brejo e um mercado com barracas das três origens.

## O que cada vista mostra

1. **Mapa da província.** Pergaminho sobre a mesa de nogueira, entre dois rolos de latão. A capital no centro, em miniatura 3D, e três postos acesos (brejo, serra, costa) ligados por rotas pontilhadas a tinta. Uma caravana (carroça e dois bois) anda numa rota. O resto é terra incógnita em tinta e névoa.
2. **Posto no brejo.** Palafitas, passarelas de tábua sobre a água, juncos que balançam, garças (duas voando), barquinhos chatos com lanterna, vitórias-régias, névoa baixa e vaga-lumes à noite.
3. **Posto na serra.** Encosta nevada, chalés de pedra e tora num patamar, trilha em ziguezague, boca de mina com trilhos e vagoneta que vai e volta, cabras, pinheiros com neve, ponte de corda sobre o desfiladeiro, neve caindo e uma águia.
4. **Posto na costa.** Falésia com farol (o feixe gira à noite), cais, barcos de pesca, veleiro que sai e volta, redes e varais, casas caiadas com capela de cúpula azul, gaivotas e ondas quebrando na praia.
5. **Capital.** Close da capital, com o seletor **Semana 1 / Semana 4**. Na semana 4 os bairros novos nascem com animação e o chão ao redor muda de cor. Uma legenda no canto explica de onde veio cada bairro.
6. **Chegada.** A mesa depois de uma ausência: o mapa com a caravana parada na porta da capital e pequenos brilhos nas novidades; três cartas lacradas com cera (verde do brejo, azul da serra, coral da costa), uma carta aberta de Tobias com os botões de latão "Enviar caravana" e "Guardar carta" (só visuais) e o bilhete "Desde a sua última visita…".

Em todas: controle de hora (dia, entardecer, noite, com janelas e lanternas acesas), seletor de vistas num mostrador de latão com transição suave, câmera em órbita lenta e automática, com mouse e toque para girar e aproximar dentro de limites.

## Como abrir

```bash
cd jogos/expedicoes
npm install
npm run dev          # servidor de desenvolvimento
npm run build        # dist/index.html, arquivo único
npm run shot         # depois do build: capturas em docs/screens/
```

`dist/index.html` está versionado: dá para abrir o arquivo direto no navegador.

## Ganchos de URL

`?view=mapa|brejo|serra|costa|capital|chegada` `&week=1|4` `&hour=dia|entardecer|noite` `&yaw=<graus>` `&zoom=<fator>` `&pitch=<graus>` `&ui=0` (sem a interface) `&timescale=` (desacelera o mundo). Teclas: 1 a 6 trocam de vista, setas passam de uma a outra.

## Decisão sobre as cartas (Roger)

História base em modelos escritos antes (personagens, arcos, o que cada carta oferece) com toques gerados por Claude na hora (estilo do personagem, menções ao que aconteceu na província); se Claude não responder, a carta sai só do modelo; cartas de 2 a 4 linhas com uma ação clara no fim.

A carta de Tobias na vista Chegada segue isso: 4 linhas, termina com a ação ("Se mandar gente antes da neve, levantamos um posto novo.").

## Medidas (SwiftShader, 1280×800, contando também a passada de sombra)

| Vista | Draw calls | Triângulos |
|---|---|---|
| Mapa | 117 | 140 mil |
| Brejo | 59 | 183 mil |
| Serra | 50 | 121 mil |
| Costa | 56 | 111 mil |
| Capital (semana 4) | 112 | 184 mil |
| Chegada | 145 | 143 mil |

## Como é feito

TypeScript estrito, three (WebGLRenderer, ACESFilmic, sRGB), Vite com arquivo único. Tudo gerado em código, sem arquivos de arte.

- `island.ts`: bloco de terra em grade polar (contorno irregular por harmônicos), altura e cor por função, corte lateral em camadas, base de nogueira com filete de latão, água com espuma e ondas por vértice.
- `kits_a.ts`, `kits_b.ts`, `structs.ts`: casas por estilo, torres, farol, bichos, barcos, passarelas, píer e ponte de corda. O material soma uma cor noturna vezes o atributo `glow` de cada vértice (janelas e lanternas).
- `stage.ts`: um palco por vista, com pools instanciados; a mesma função monta o diorama grande e a miniatura do mapa.
- `v_*.ts`: as seis vistas. `mapart.ts`: o mapa desenhado em canvas.
