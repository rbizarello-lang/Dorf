# E8: atualização das vizinhas

Branch `dorf/e5-encostas`. Só aparência: sem `SAVE_VERSION`, sem mexer em pontos, replay nem regra. Origem: issue #115 (defeitos relatados pelo Astra).

## Causas e correções
1. **Fumaça.** `baked` guardava a posição das chaminés na lista global e o refazer só mudava a altura delas. Agora as chaminés são por peça (`chimMap`, `setChimneys`): refazer a peça troca a lista dela, e o número de emissores acompanha o número de casas de agora.
2. **Peça posta antes da anterior assentar.** A causa não era a fila: `bake` gravava a assinatura (encosta e estágio) da hora do pouso, mas a geometria era a da hora da jogada. Com a vizinha chegando durante a queda, a peça parecia em dia e nunca era refeita (76 decorações contra 69 na reconstrução). A queda guarda `sig`/`vsig` de quando foi montada, e o pouso passa a `bake(..., built)`. A fila (`queueLiving`) é recalculada do estado a cada rodada, então não perde nem duplica.
3. **Corredeira.** Antes só a peça mais nova a desenhava, e a soleira e a névoa só existiam se ela fosse a alta. Agora `rapids` sai só dos níveis: a peça ALTA da borda desenha soleira, espuma e névoa (a baixa não desenha nada ali), seja ela a nova ou a velha. A velha é refeita quando a vizinha chega (`rapids` está na assinatura). `FallLayer` passou a guardar a contribuição por peça (`append(key, ...)` troca, não duplica; remonta uma vez por quadro).
4. **Itens que se movem (achado pelo teste).** Bichos, pás, aldeões, peixes, barcos ancorados e pontes ficavam na `Life` mesmo quando o refazer mudava o conjunto (1 a 2 bichos a mais ou a menos). `Life.owner`/`dropOwner`: o item sabe de que peça veio; refazer a peça troca os dela só quando o conjunto ou o lugar muda (`moversSig`).
5. **Prévia das vizinhas.** Depois de `GHOST_SETTLE_MS` parado numa casa válida, o fantasma calcula uma vez (sobre `Board.clone` + `placeRaw`, mesma assinatura do pouso) quem SOBE (dourado) e quem CRESCE (verde, Viva; na Terra vale a mancha). Cada uma ganha uma MANCHA DE LUZ no chão (`neighborGlow`): disco de borda macia e irregular, não hexágono, cujos vértices seguem a altura do chão (`riseAt`, 7 cm acima), com teste de profundidade e `polygonOffset`, então casas e árvores ficam na frente. Uma malha só, +1 draw call enquanto há prévia. A etiqueta passa a dizer "+100 · 2 sobem" e "· N crescem" (`world.nbInfo`). Mover, girar, colocar ou soltar o fantasma apaga na hora; nada é refeito na cena a cada movimento do mouse. `window.__nbPreview()` devolve `{ rise, grow }`.

## Teste: cena incremental x reconstrução integral
`npm run scene` (`scripts/scene-sync.mjs`, no navegador, WebGL2, uns 90 s por caso no SwiftShader): joga com animação, deixa assentar e compara a cena com a de `rebuild`, peça por peça: decorações (kit sem `~`, matriz e cor arredondadas, sem ordem), chão (triângulos com área e somas), chaminés, corredeira (lâmina, espuma, quedas = névoa), instâncias órfãs nos lotes e a contagem da `Life`. Depois confere a recarga (replay do save) e, em `desfazer-rapido`, desfazer e jogar de novo. Ganchos novos: `__sceneSig`, `__legalMoves`, `__playMove`, `__land`, `__pending`, `__rebuildScene`, `__replayScene`, `__undoMove`, `__waterTouch`, `__nbPreview`.

Resultado final, 16 casos, todos ok (nas rodadas parciais os que falharam só por bichos da `Life` passaram depois da correção 4):
| Caso | Jogadas | Resultado |
|---|---|---|
| fumaca-s1 (defeito 1) | 1 | ok, 1 chaminé |
| fumaca-s1-viva | 1 | ok |
| rapida-s3-viva (defeito 2) | 2 em sequência | ok |
| rapida-s3-sem-viva | 2 em sequência | ok |
| sorteio-classico-viva | 22 | ok, 37 chaminés |
| sorteio-classico-sem-viva | 22 | ok (falhou antes da correção 4) |
| rapido-classico-viva / sem-viva | 14 em lote | ok / ok |
| terra-viva / terra-sem-viva | 22 | ok / ok (falhavam antes da correção 4) |
| terra-rapido-viva / sem-viva | 14 em lote | ok / ok |
| corredeira-terra (defeito 3) | 26 | ok, 1 névoa (falhava antes da correção 4) |
| corredeira-relevo | 26 | ok, 2 corredeiras |
| corredeira-relevo-rapido | 14 em lote | ok, 3 névoas |
| desfazer-rapido | 10 + desfazer + refazer + replay | ok |

Prova de que o teste pega o defeito 2: com `bake` voltando à assinatura da hora do pouso, `rapida-s3-viva` falha com "1,0: 56 decorações contra 61" e chão diferente; `rapida-s3-sem-viva`, 52 contra 54.

Limites: as duas ordens da corredeira são cobertas por sorteio (a assinatura depende só do tabuleiro final), não por um par de jogadas fixas; não achei uma partida curta que exponha a semente 123 do relato, então uso sorteios com preferência por água. A recarga e o `rebuild` são testados pela cena, não por GPU real.

## Verificação
- `npm run check` verde. `npm run smoke`: casos WebGL (`webgl`, `relevo-webgl`, `terra-hash-webgl`, `buffers-de-vertice`) ok; os WebGPU falham aqui por ambiente ("Instance dropped"), como na base. O WebGPU NÃO foi conferido.
- Stress `300:high`, WebGL2, Holanda, seed 42, Clássico (base `bd371dc` x E8): 117 draw calls, 1.255 mil triângulos, 72.425 instâncias nos dois; com Viva 118 / 1.403 mil / 90.122 nos dois. Montagem 1.466 x 1.634 ms (a máquina varia mais que isso entre rodadas). Sem piora.
- Capturas (WebGL2, `quality=medium`, olhadas com Read): `prancha-chamine.jpg` (semente 1, antes e depois da jogada em (1,0) giro 2: uma chaminé), `prancha-corredeira.jpg` (Terra e Relevo, soleira de pedra, espuma e névoa), `prancha-fantasma.jpg` (realce dourado na vila vizinha que vai subir/crescer e o mesmo fantasma depois de mudar).

## O que fecha e o que não fecha
Fecha: os 3 defeitos com teste; a prévia das vizinhas; sem custo medido.
Não fecha: o realce é uma mancha no chão (não a forma nova da vizinha) e fica sutil na vila, onde as casas cobrem quase todo o chão; só conferi a mancha dourada (sobe), a verde (cresce) não foi capturada; a corredeira só aparece com a peça alta, a baixa não ganha espuma própria; WebGPU e GPU real sem medir; o item da `Life` refeito reinicia de posição inicial (só quando o conjunto muda).

## Junção com as baías do Astra
Merge de `astra/baias-internas` (`843cffc`) em `f8bd7a3`. Conflito só em `world.ts` (`hillFor`, o laço das bordas e `hillSig`) e no `SINCRONIA.md`: ficam as duas coisas (a cena por peça da E8 e o `bay` do Astra, que entrou na assinatura e no retorno de `hillFor`). `npm run check` verde (inclui `tests/inner-bays.ts`); `npm run scene` ok em `fumaca-s1`, `fumaca-s1-viva`, `rapida-s3-viva` e `terra-viva`; smoke WebGL ok. O caso do placar da Terra, semente 16, (2,0) (311 → 382 → 311) NÃO foi conferido por mim.
