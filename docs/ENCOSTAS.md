# Encostas

Relevo de toda peça, em todos os modos e temas, só aparência: nada disso entra na regra, na pontuação, no replay nem no `SAVE_VERSION`. Este arquivo é o mapa curto; o histórico e as imagens estão em `docs/propostas/e5/` (E5), `docs/propostas/e8/` (cena incremental) e `docs/propostas/d46/` (custo).

## O que são
Cada peça ganha uma superfície de chão (`HillProfile`: ombros por borda, divisa com a vizinha, patamar de 0 a 3) calculada só pela peça e pelas vizinhas já assentadas. O encaixe igual sobe a divisa dos dois lados, então a emenda casa em qualquer ordem. A vila ganha patamares com muro de arrimo; estrada, parcela e praça seguem o chão (`Buf.drape`); casas assentam no trecho mais plano do lote.

## Onde está o código
- `src/core/hills.ts`: o perfil (`boardHill`, `handHill`, `hillHeight`, `hillSignature`). Puro.
- `src/render/hillSurface.ts`: a cota nos nós da malha; `at(x, z)` lê o mesmo triângulo que a GPU desenha.
- `src/render/villageTerraces.ts`: patamares de vila em geometria.
- `src/render/tileBuilder.ts`: `buildTile` com `opts.hill`/`opts.hand` (levanta o chão, recorta decalques, assenta casas).
- `src/render/world.ts`: `refreshHills`, `hillQueue`/`drainHills` (vizinhas que mudam), `rebakeHill`, `drainLiving`.
- Testes: `tests/hills.ts` (`npm run hills`), `tests/village-terraces.ts`, `tests/foundations.ts` (fundações das casas, D47: `docs/propostas/d47/`), `tests/hills-cost.ts` (`npm run hills:custo`, com soma de verificação da geometria), `npm run scene` (cena incremental × reconstrução).
- Ganchos: `?encostas=0` desliga; `window.__hills()` devolve `{ rebakes, ms, total }`.

## Custo e a etapa D46 (Encostas mais leves)
Desde o PR #117 a montagem de 300 peças no Clássico tinha dobrado e cada jogada refazia a peça e até 6 vizinhas de uma vez. A D46 não mudou a geometria (a soma de verificação do `hills:custo` e do `cpu` é a mesma antes e depois). Onde estava o custo, pelo perfil de CPU do `buildTile`: empilhar triângulos em `number[]` com `push(...)`, a distância à margem do rio pedida 3 a 4 vezes no mesmo ponto, seno e cosseno de `corner`/`edgeMid` dentro de laços por vértice, `atan2` em cada leitura de `HillSurface.at` (7 por triângulo de decalque) e alocação de arrays pequenos por vértice. Medidas (stress `300:high`, WebGL2 por software, Holanda, semente 42, mesma máquina; o SwiftShader varia ~15% entre rodadas):

| | `main` (b482d24) | D46 |
|---|---|---|
| Montagem, Clássico (mediana de 3) | 2128 ms | 1399 ms (−34%) |
| Montagem, Clássico com `?encostas=0` | 1081 ms | 819 ms |
| Montagem, Terra | 3032 ms | 2008 ms (−34%) |
| Triângulos, Clássico (com / sem Encostas) | 1255 mil / 1134 mil (+10,7%) | iguais |
| Pior refazer de vizinhas numa jogada (`__hills().ms`, ao vivo) | 26 a 56 ms | 14 a 18 ms |
| `npm run cpu` (Relevo / Clássico, ms por peça) | 7,8 / 2,6 | 4,5 / 1,9 |
| `npm run hills:custo` (com Encostas, ms por peça) | 6,4 | 3,2 a 4 |

Sobra: os triângulos (+10,7%) vêm da malha de 6 divisões e dos decalques que seguem a encosta; baixar isso muda a geometria. O próximo passo é a malha de 5 divisões só onde a emenda continua coerente, e uma tira única de decalque de estrada.
