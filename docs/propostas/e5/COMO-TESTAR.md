# Como testar as Encostas (E5)

A prévia (`VITE_PREVIEW=relevo npm run build && node scripts/artifact.mjs` gera `dist/artifact/retalhos.html`) abre no **Clássico**: as Encostas valem em todos os modos.

| Hash | O que abre |
|---|---|
| (nenhum) | Clássico com as Encostas |
| `#mode=relevo` | Relevo (altura por peça, regra do encaixe; desenho com Encostas) |
| `#mode=terra` | Terra contínua |
| `#bench` | medida de desempenho (Clássico e Relevo) |
| `#encostas=0` | desliga as Encostas e volta ao desenho de antes (para comparar) |

Em desenvolvimento (`npm run dev`) os mesmos valores valem como `?encostas=0`, `?mode=terra`, `?seed=7&auto=60`.

O que olhar: a encosta atravessa as emendas onde o terreno casa; a cada encaixe igual a divisa sobe um degrau (até 3) e a peça vizinha sobe junto; o fantasma já mostra a encosta que a peça terá naquela casa e giro; casas ficam em fundações; rio e trilho passam no fundo do vale.

## Prévia publicada (E5c, commit 3f2cccf)

https://claude.ai/artifact/VAzXSP1Ed3e5eATBBo53TZ (privada; abre no Clássico)

- `#mode=relevo` e `#mode=terra` abrem os outros modos; `#encostas=0` volta ao desenho de antes das Encostas; `#bench` mede o desempenho.
- A prévia anterior, sem as Encostas e com o Relevo, a Terra e o fantasma da regra, continua em https://claude.ai/artifact/JVT8x1vFLx26qK38YWf33N.

O que falta, segundo a revisão: degrau de geometria nos patamares (hoje são faixas de cor), contorno redondo das casas vazias internas (ainda leem como baías hexagonais) e uma captura clara da corredeira.
