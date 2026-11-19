# Província (esboço visual)

Um panorama, não um jogo: mostra como o mapa da Província pode ficar e até onde pode ir.

## O que a cena mostra

- Uma mesa de nogueira com filete de latão e, sobre ela, um pergaminho desenhado a tinta: contornos irregulares das 19 regiões, nomes em letra de mapa antigo, hachuras de montanha, mar com ondas e navios, rosa dos ventos, cartela e escala.
- No centro, a capital Alvorada. Em volta, regiões fundadas que saltam do papel como diorama de hexágonos chanfrados (vilas, trigais, vinhedos, bosques, colinas, moinho, farol), com o corte lateral da terra em camadas (relva, terra, argila, pedra).
- As regiões vazias ficam só em tinta, com a grade pontilhada dos 19 espaços e "à espera".
- Continuidade: o rio nasce em tinta no Pedregal do Corvo, entra no Vale do Trigo, desce pela Foz do Lume e some no mar; a estrada do Vale cruza o rio numa ponte e liga à capital. Onde a região ainda não foi fundada, rio e estrada seguem como traço a tinta.
- Vida: barcos no rio, carroças nas estradas, pássaros, fumaça, pás do moinho, ovelhas, feixe do farol à noite.
- Semana 1: capital pequena (capela e 7 casas) e 2 regiões. Semana 4: capital com muralha, portões, mercado e catedral (a maravilha), e 5 regiões, com as aldeias maiores.
- Hora: dia, entardecer, noite (janelas, lampiões e fogueira acesos, luzes de ponto).
- Cursor sobre uma região mostra o nome; placas com os nomes das fundadas aparecem no zoom aberto.

## Como abrir

```bash
cd jogos/provincia/esboco
npm install
npm run dev          # desenvolvimento
npm run build        # dist/index.html (arquivo único)
node scripts/shot.mjs   # gera as seis capturas em docs/screens
```

Atalhos: `1` e `4` trocam a semana; `d`, `e`, `n` trocam a hora.

## Ganchos de URL

`?week=1|4 &hour=dia|entardecer|noite &yaw=<graus> &pitch=<graus> &zoom=<fator> &focus=capital|ponte|fronteira &t=<segundos> (congela o relógio) &ui=0 (sem interface) &debug (draw calls e triângulos)`

## Desempenho (1280x800, software)

| Captura | Draw calls (quadro inteiro / só a tela) | Triângulos (inteiro / só a tela) |
|---|---|---|
| semana1 | 75 / 47 | 70 mil / 44 mil |
| semana4, capital, noite | 112 / 66 | 142 mil / 88 mil |
| fronteira, ponte | 110 / 64 | 140 mil / 86 mil |

"Quadro inteiro" inclui o passe de sombra. Tudo com instancing (um InstancedMesh por kit).

## O que foi copiado da Ilha das Lanternas

De `jogos/lanternas/src/render/` (branch `jogo-lanternas`), copiados e adaptados: `geo.ts` (construtor low-poly), `palette.ts`, `pool.ts` (instancing com animação de entrada; ganhou escala não uniforme), `kits.ts` (casas, árvores, plantação, poço, capela, farol, cais, barco, janelas, fumaça) e a ideia do `swayMat` (vento) em `materials.ts`. Novos aqui: catedral, muralha, torres, portão, ponte, carroça, barracas, vinhedo, montanha, moinho, ovelhas, terreno com corte em camadas, fitas de rio e estrada, o pergaminho em canvas e o modelo das regiões.
Nada do Retalhos foi usado.
