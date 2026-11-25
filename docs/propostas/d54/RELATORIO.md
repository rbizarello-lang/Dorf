# D54: enquadramento sem a pilha cobrindo a ilha, e sombra de contato no pé das peças

Branch `dorf/d54-enquadramento` (a partir da `main` em `e14103a`). Feita por Claude, para revisão do Dorf. Só aparência e câmera: nada em `src/core`, sem `SAVE_VERSION`.

## Parte 1: P3.7, o enquadramento e a pilha

**Causa.** A câmera não acompanha o mapa crescendo: `frameCamera` (`main.ts`) só roda ao começar a partida (e no `?auto`, que a chama no fim) e no fim da partida. Ela centra no centroide das peças e escolhe a distância pelo raio do mapa (`maxR * 2,1 + 5`), sem saber que o HUD existe. Com o mapa grande e alongado (a Terra contínua, com 30 ou 60 peças), a borda da ilha chega ao canto de baixo à direita, sob a pilha, e na perspectiva inclinada a ponta mais próxima também estoura a borda de baixo da janela. Acontece em todos os modos quando o mapa cresce; a Terra só mostra mais porque a ilha é comprida.

**Correção.** `src/ui/frameBoard.ts` (novo), chamado por `frameCamera` no lugar da fórmula pura (a viagem do Entrepostos continua com `frameVoyage`):
- projeta na tela os cantos de todas as casas (o contorno convexo sempre entra, o resto é amostrado até 360 pontos);
- lê os retângulos reais dos cartões com `getBoundingClientRect` (placar, barra de cima, pilha com os botões, missões, minimapa, carta fluvial; o que está escondido ou no modo foto tem retângulo vazio e é ignorado), mais 10 px de folga, e a janela;
- procura o menor deslocamento do centro da vista (grade de 11×11 pontos da tela, convertida para o chão por raio, depois busca binária ao longo da reta até o centro) que deixa todos os pontos livres; se nenhum deslocamento basta, afasta em passos de 6% (no máximo 1,6× a fórmula e o teto de 46 da câmera) e tenta de novo;
- só mexe em `rig.goal` e `rig.goalDist`.

Sem sobreposição nada muda (o centro da ilha segue no centro da tela). Inclinação, giro, `pickHex`, a câmera que quem joga move, o modo foto e o vídeo não são tocados; `?at=`, `__goto`, `__focus`, `__coast` e os outros ganchos escrevem `rig.goal` direto e seguem centralizando exatamente. Como o enquadramento só roda na abertura e no fim, não há salto quando quem joga mexe na câmera. `?enquadra=0` volta à fórmula de antes (para o `compare`).

**Custo.** Cerca de 121 posições × até 11 distâncias × 360 projeções, uma vez por partida nova e uma no fim; imperceptível.

## Parte 2: P3.3, o pé das paredes

**O que já existia.** As laterais já têm estrato em todos os temas (camadas de solo e rocha em `tileBuilder.ts`, desde `d5714ac`), então não mexi nelas. O entorno (`makeVoidMaterial`) já tinha uma sombra de contato pela distância do `seaMap`, mas ela quase não aparecia.

**Causa.** A laje das casas vazias (`World.slots`, clara e meio opaca, D49) cobre toda a faixa onde a sombra cai: em volta de toda peça há uma casa vazia, e a laje ocupa a casa inteira. A sombra do entorno ficava por baixo de um véu claro.

**Correção.** A sombra virou uma função só (`footShade` em `materials.ts`): uma faixa larga e macia (1,3 de alcance, 66% no pé) mais um beiral estreito colado na parede (0,35 de alcance, 40%). O entorno a usa como antes; a laje a usa na cor (`slotFoot`, que lê o mesmo `seaMap`, via `slotMat.colorNode`). Sem malha nova, sem passe novo, sem draw call novo. A opacidade da laje (D49) não mudou: só a cor escurece junto ao pé, então à noite as casas vazias continuam legíveis (conferido na prancha da noite). Na pilha não aparece (não tem o mapa, como o `U.seam`).

Mar, areia, chapada e pergaminho passam pelo mesmo caminho. O efeito é discreto de propósito (diferença máxima de ~50 a 85 em 255, só no pé): lê como peça assentada, não como mancha.

## Medidas

**Stress `RUNS=300:high`** (301 peças, WebGL2 por software; `main` → branch):

| Cena | Draw calls | Triângulos | Instâncias |
|---|---|---|---|
| holanda seed 42 | 117 → 117 | 1241 mil → 1241 mil | 71434 → 71434 |
| egito seed 42 | 115 → 115 | 1186 mil → 1186 mil | 35555 → 35555 |
| terra seed 7 | 117 → 118 | 1413 mil → 1414 mil | 77677 → 77677 |

A diferença de 1 draw call na Terra é o ruído da cena (o mesmo estado com a mesma semente varia 1 draw call entre rodadas por pássaros e névoa; o código novo não cria malha nem material). Os tempos (CPU, montagem) variam mais que a diferença e não valem: a máquina estava dividida com outros testes.

**`npm run check`**: verde. **`npm run smoke`**: os casos WebGL2 passam (`webgl`, `chamonix-webgl`, `relevo-webgl`, `terra-hash-webgl`, `entrepostos-hash-webgl`, `entrepostos-dialogo-webgl`, `buffers-de-vertice`, `vida-dos-buffers-webgl`, `ao-vivo-webgl`); os casos WebGPU caem com `WebGPU Device Lost: A valid external Instance reference no longer exists` / `Instance dropped in popErrorScope`, a limitação conhecida desta máquina.

**`npm run compare`** (`QUALITY='low&webgl'`, referência gravada na `main`):
- Sem `?enquadra=0`: as 6 vistas ficam acima da tolerância (`holanda` 64%, `noite` 42%, as demais 3 a 10%) porque o `?auto=` chama o `frameCamera` e a câmera muda de lugar, que é o objetivo da parte 1.
- Com `&enquadra=0` (só a sombra): `holanda` 8,1% (média 2,2), `egito-entardecer` 10,1% (2,6), `noite` 6,9% (1,9), `zoom-aberto` 9,0% (2,5), `rio-perto` 8,6% (3,1), `vila-perto` 3,0% (0,85). Todas acima da tolerância de 0,5%, como esperado: nas imagens `diff-*` a diferença fica só nas lajes das casas vazias junto ao pé das peças (anéis e hexágonos internos); os pontinhos soltos em vermelho são fumaça, barcos e fogo (o mundo anda entre as duas gravações). Nada muda sobre as peças, a água ou o céu.

**`npm run scene`**: 17 casos ok, "cena incremental = reconstrução integral em todos os casos" (rodado depois da merge com a `main` da D53). Mexi em `world.ts` só para pôr `colorNode` na laje.

## Pranchas (`docs/propostas/d54/`, antes à esquerda, depois à direita)
- `terra-30-1440x860.jpg`, `terra-60-1440x860.jpg`, `terra-30-1000x760.jpg`, `terra-60-1000x760.jpg`: Terra contínua, seed 7, enquadramento inicial.
- `pe-holanda-mar.jpg`, `pe-egito-areia.jpg`, `pe-chamonix-pergaminho.jpg`: o pé de uma peça de perto (seed 42, `coast=0`, zoom 5).
- `noite-holanda.jpg`: a mesma vista de noite, com as casas vazias.

O que vi: antes, a pilha encobre a ponta da ilha (30 e 60 peças) e, com 60 peças, o pé da ilha vaza pela borda de baixo; depois, a ilha inteira cabe entre a barra, o placar e a pilha, deslocada para a esquerda e um pouco menor (a 1000×760 com 60 peças, uns 35% menor, que é o teto do afastamento). No pé: no mar, uma faixa de sombra macia sob a espuma, com a parede assentada na areia molhada; na areia do Egito e no pergaminho do Chamonix o efeito é mais sutil (a laje clara e o entorno já são de valor próximo), uma faixa curta e macia colada na parede; à noite as casas vazias seguem visíveis.

## O que ficou de fora
- WebGPU: não deu para conferir nesta máquina (Instance dropped); o caminho é o mesmo nó de TSL do WebGL2.
- Zoom por tela de celular em retrato não foi capturado; a lógica usa os mesmos retângulos, mas só conferi 1440×860 e 1000×760.
- O enquadramento não acompanha o mapa crescendo durante a partida (a câmera nunca o fez); se quiser isso, é uma decisão de jogo à parte (a câmera saltaria a cada jogada).
