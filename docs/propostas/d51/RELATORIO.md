# D51: contorno do fantasma mais fino e marcas no pé das casas vazias

Itens da avaliação autônoma: P2.6 e P3.4 (contorno branco do fantasma e da queda), mais o acerto das marcas e da noite depois da D49.

## O que pesava

- **Os traços brancos da imagem 11 eram o anel de foco** (`World.hoverRing`, hexágono de 0,84 a 0,97 de raio, opacidade 0,9, a -0,1 de altura). Ele fica dentro do poço da casa vazia, então do alto aparece como duas faixas brancas e um "V" no vão entre o fantasma (ou a peça caindo, quando o próximo fantasma já está na mesma casa) e as vizinhas. Com a laje e a água atrás, os 0,13 de largura liam quase opacos, mais grossos que qualquer divisa. As marcas de borda (pílulas sobre o fantasma) também eram largas.
- **Carimbos e tracejado ficaram a meia altura** depois da D49. O carimbo da nascente escondida no Relevo (Egito) flutuava sobre a areia, a uns 0,25 do chão, e o do sítio pairava no vão entre as ilhas. O tracejado de influência ficava no meio das paredes vizinhas.
- **A grade do Egito à noite**: a laje azulada do luar (`SLOT_MOON` a 0,7) contra a duna morna desenhava uma grade forte.

## Mudanças (só `src/render/world.ts` e a nota no `AGENTS.md`)

- Anel de foco: fio de 0,055 (0,9 a 0,955; no fluido 0,79 a 0,845), opacidade 0,4 de perto (`HOVER_OPACITY`) que sobe até 0,8 com o zoom aberto (`HOVER_FAR`, `rig.dist` de 10 a 24): de longe o fio já é fino na tela e precisa voltar a marcar a casa. Marcas de borda com raio 0,02 (era 0,026) e opacidade 0,85.
- Carimbos (`stamps`: sítios, nascentes, postos) e tracejado (`infl`) no pé das peças, um fio acima da laje (`STAMP_LIFT` = laje + 0,02, `INFL_LIFT` = laje + 0,014), sem somar o nível da casa, com o mesmo critério da D49. Os postos da Estrada Real que ficam sob uma peça continuam escondidos (antes pela face de cima, agora por tudo).
- Noite sobre a areia (Egito e chapada do Brasil): luar a 0,3 (mar e papel seguem 0,7) e opacidade noturna de 0,35 do valor de dia (era 0,7). Abaixo de ~0,25 a casa vazia voltava a sumir (testei 0,2 e 0).
- `landTrace.ts` não foi mexido: o contorno da mancha na Terra é de fitas finas e coloridas, sem o problema.
- Sem `src/core`, `tileBuilder.ts`, `main.ts`, `style.css`; sem pontuação nem replay; sem draw call novo.

## Verificação

- `npm run check`: verde (na branch já com a `origin/main` integrada: D50 e D47).
- `npm run smoke`: ver abaixo.
- `npm run scene`: ver abaixo.
- `RUNS=300:high` (WebGL2, `EXTRA=&webgl`, seed 42), main -> D51: 115 -> 115 draw calls, 1241 mil -> 1241 mil triângulos, 71434 -> 71434 instâncias. Sem `&webgl` o stress perde o dispositivo (WebGPU por software deste ambiente).
- `npm run compare` (Alta, `&webgl`, cópia local com `domcontentloaded`; referência = `origin/main` buildada; máquina carregada com o `scene` rodando junto):

| vista | pixels | média | onde |
|---|---|---|---|
| holanda | 0,39% | 2,58 | tracejado e carimbos descidos |
| egito-entardecer | 2,11% | 2,87 | laje sobre a areia (o entardecer já tem parte da noite) |
| noite | 0,37% | 2,47 | tracejado e carimbos |
| zoom-aberto | 0,44% | 2,49 | idem |
| rio-perto | 1,25% | 2,70 | partículas soltas (poeira, vaga-lumes): ruído entre rodadas |
| vila-perto | 1,52% | 3,02 | pétalas caindo e uma árvore ao vento: ruído |

A média alta e uniforme (~2,5) é de carga da máquina; os pontos acima do limiar ficam onde o `diff-*` mostra, conferido nas imagens.

## Prancha (antes à esquerda, depois à direita; 1200×720, Alta, `&webgl`, `timescale=0.05`)

`queda.jpg` (com o tracejado), `perto.jpg`, `longe.jpg`, `sitio.jpg`, `nascente.jpg`, `egito-noite.jpg`, `terra.jpg`. A nascente revelada é rara com a IA gulosa (nenhuma em 4 sementes com 40 a 60 peças); a captura põe o carimbo de gota na casa vazia mais cercada com um gancho temporário, sem commit.

## Para olhar

- O anel continua a meia altura (-0,1 + nível): no poço ele é o que diz "aqui". Se ainda pesar na GPU de verdade, baixar `HOVER_OPACITY` é o botão.
- A nascente agora fica no chão do vão e uma encosta vizinha pode cobrir parte do carimbo em câmera baixa; a etiqueta em DOM continua acima.
