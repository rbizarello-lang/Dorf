# Como testar a Paisagem viva (E6)

A Paisagem viva é uma opção de aparência: as casas sobem, a mata adensa, o cultivo ganha celeiro e o prado ganha flores conforme as bordas iguais se encaixam. Os pontos não mudam.

## Na prévia publicada

A prévia (`VITE_PREVIEW=relevo npm run build && node scripts/artifact.mjs` gera `dist/artifact/retalhos.html`) abre no Clássico, com a viva LIGADA em todos os modos (no jogo normal ela só vem ligada no Zen e na Terra).

| Hash | O que abre |
|---|---|
| (nenhum) | Clássico com a viva |
| `#mode=zen` | Zen (peças sem fim: o melhor lugar para ver a paisagem crescer) |
| `#mode=terra` | Terra contínua (a viva também segue as manchas: fechar uma mancha leva as peças dela ao estágio máximo) |
| `#viva=0` | desliga a viva (comparar) |
| `#mode=zen&viva=0` | Zen sem a viva |
| `#encostas=0`, `#bench` | como na E5 |

Em desenvolvimento (`npm run dev`) os mesmos valores valem como `?viva=0`, `?mode=zen&seed=7&auto=60`.

## No jogo normal

- Opção **Aa → Paisagem viva**: grava a preferência (vale para todos os modos). Sem preferência gravada, liga no Zen e na Terra e desliga nos outros.
- `?viva=1` / `?viva=0` (ou `#viva=...`) forçam, sem gravar.

## O que olhar

1. Jogue o Zen. Cada borda que encaixa com o mesmo terreno sobe um estágio (até 3): as casas ficam mais altas e largas, as árvores maiores e mais cheias, as plantas mais altas e, a partir do estágio 2, aparece um celeiro no campo.
2. Ao pousar uma peça, as vizinhas cujo estágio mudou crescem logo depois (uma ou duas por quadro, então não há engasgo).
3. O fantasma já mostra a peça desenvolvida pelos encaixes e a etiqueta de pontos leva " · N crescem" (quantas vizinhas ganhariam um estágio).
4. Na Terra: feche uma mancha (cerque com outros terrenos) e todas as peças dela, mesmo as distantes, vão ao estágio 3 daquele terreno; uma mancha ainda aberta com 4 peças ou mais sobe um estágio.
5. Desfazer e carregar o save dão a mesma paisagem (o estágio é função do tabuleiro, não da ordem).

## Ganchos

`window.__living()` devolve `{ on, rebakes, maxMs, stages }`. Teste: `npm run living` (também no `npm test`).
