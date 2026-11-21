# D46: Encostas mais leves

Branch `dorf/d46-encostas-leves`, a partir da `main` b482d24. Só aparência e custo: `src/core` intocado, replay e pontuação iguais, geometria idêntica (soma de verificação do `npm run cpu` e do `npm run hills:custo` igual antes e depois).

## Onde estava o custo (perfil de CPU, Node `--cpu-prof` e CDP no Chromium)
No `buildTile` com Encostas, em ordem: empilhar triângulos em `number[]` com `push(...a)` (`Buf.tri`, ~8% e GC), distância à margem do rio recalculada 3 a 4 vezes no mesmo ponto (`field.e`), `corner`/`edgeMid` com seno e cosseno dentro de laços por vértice, `HillSurface.at` com `atan2` (7 chamadas por triângulo de decalque no `drape`), arrays e `Color` pequenos por vértice (`topColor`, `drape`), `push(...terraces.pos)` com spread de array grande e a conversão `new Float32Array(number[])`. Na jogada, `refreshHills` refazia a peça e até 6 vizinhas no mesmo quadro (1 `buildTile` cada).

## O que mudou
- `src/render/tileBuilder.ts`: chão em vetores `Float64Array` (`Vec`) reaproveitados entre peças (`SCRATCH`), sem spread; `field.e` guarda o último ponto; `nearestParam` sem alocar; `corner`/`edgeMid` guardados por índice; `topColor` mistura no lugar; `drape` sem `map`/`slice`.
- `src/render/hillSurface.ts`: setor por produtos vetoriais (`atan2` só perto da divisa, então o resultado é o mesmo).
- `src/render/world.ts`: a peça que pousou é refeita já; as vizinhas vão para `hillQueue` e `drainHills` as refaz na `tick` com orçamento de 5 ms por quadro (ao menos uma). `hillTotalMs`; `pending().queue` conta a fila (o `npm run scene` espera esvaziar). `src/main.ts`: `__hills()` devolve também `total`.
- `tests/hills-cost.ts`: soma de verificação da geometria. `AGENTS.md` e `docs/ENCOSTAS.md` (novo; a referência do AGENTS agora existe).
- Não mexi em `docs/SINCRONIA.md` (pedido do coordenador).

## Antes e depois (mesma máquina, SwiftShader, WebGL2, Holanda, semente 42)
| Medida | main | D46 |
|---|---|---|
| Montagem 300 peças Clássico `300:high` (3 rodadas) | 2179 / 2277 / 1974 (mediana 2179; com a rodada extra, 2128) | 1386 / 1402 / 1399 (mediana 1399, −34%) |
| Montagem com `?encostas=0` | 1081 | 819 |
| Montagem Terra | 3032 | 2008 (−34%) |
| Triângulos Clássico (`encostas=0` = 1134 mil) | 1255 mil (+10,7%) | 1255 mil (igual) |
| Draw calls / instâncias | 117 / 72425 | 117 / 72425 |
| `npm run cpu` Relevo / Clássico (ms por peça) | 7,8 / 2,6 | 4,5 / 1,9 |
| `npm run hills:custo` com Encostas (ms por peça) | 6,4 | 3,2 a 4 (varia com a carga da máquina) |
| `__hills().ms` ao vivo, 5 jogadas, Holanda | 25,8 21,3 24,8 9,2 39,2 | 17,8 16,6 8,4 5,9 |
| `__hills().ms` ao vivo, 5 jogadas, Egito | 30,1 56,2 35,1 8,8 40,2 | 16,2 15 13,6 17,2 15,9 |

(`ms` = pior lote da jogada; `total` na nova soma os lotes: pior total 31 ms em jogada com 2 vizinhas.)

## Metas
- Montagem: 1,40 s contra a meta de 1,35 s, mas −34% sobre a main (a meta alternativa, −30%, foi cumprida).
- Pior refazer por jogada: −55% a −70% em relação à main (56 para 17 ms no pior caso); não chega a 12 ms porque uma peça refeita sozinha custa 8 a 17 ms em quadro frio por software (um `buildTile` mais envio à GPU). A meta alternativa (−50%) foi cumprida.
- Triângulos: não subiram, mas continuam +10,7% sobre `?encostas=0` (meta ideal ≤ +10% não atingida; exige mudar a malha).

## Fila das vizinhas: cena intermediária
O pouso refaz a peça nova na hora; cada vizinha é refeita 1 por quadro (cada uma custa mais que 5 ms ao vivo), então com 1 a 2 vizinhas afetadas (o que as jogadas medidas tiveram) a vizinha muda 1 a 2 quadros depois (17 a 33 ms a 60 qps; até 6 quadros no pior caso teórico). Não vi emenda aberta nas capturas do `compare`, mas não fiz captura quadro a quadro: a diferença é que a vizinha ainda tem a divisa antiga por esse intervalo. O `npm run scene` compara depois de esvaziar a fila: os 16 casos igual à reconstrução.

## Verificação
- `npm run check`: verde (inclui hills, living, terra, vbuf). Código não mudou depois dele; só docs.
- `npm run smoke`: todos os casos WebGL2 ok; os WebGPU (webgpu, webgpu-alta, webgpu-ultra, relevo, terra, entrepostos, hash-invalido, bench, vida-dos-buffers) falham por "Instance dropped" do WebGPU por software, como na `main`.
- `npm run scene`: 16 casos ok (rodado em 3 etapas, o navegador caiu uma vez no `terra-rapido-viva` e o caso foi repetido ok).
- `npm run compare` (`QUALITY=high`, `&webgl`, cópia local): main contra main já dá média ~2,4 e até 0,9% de pixels (ruído desta máquina). Branch contra main ficou na mesma faixa (0,04 a 1,07%, média 2,2 a 2,9); sem diferença visual identificável. Não gerei pranchas porque a geometria é idêntica.

## O que ficou de fora
Malha de 5 divisões só onde a emenda continua coerente e decalque de estrada em tira única (mudam a geometria); medida em GPU real; WebGPU.
