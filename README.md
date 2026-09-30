# Retalhos

Protótipo de puzzle relaxante de peças hexagonais, no gênero de Dorfromantik, com **temas trocáveis**, regras configuráveis e visual próprio. Feito com Three.js, TypeScript e Vite, sem nenhum arquivo de arte: peças, árvores, casas, rios e sons são gerados em código.

![Cerrado Dourado](docs/screens/cerrado.png)

- **Estudo de viabilidade:** [docs/VIABILIDADE.md](docs/VIABILIDADE.md)
- **Pesquisa de apoio (mecânicas, stacks, mercado, jurídico):** [docs/PESQUISA.md](docs/PESQUISA.md)

## Rodar

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm run build      # gera dist/index.html (arquivo único, ~640 KB)
npm run typecheck
```

## Como jogar

Coloque peças encostadas no mapa. Cada borda que combina com a vizinha vale 10 pontos. **Rio e trilho** precisam continuar: só encostam neles mesmos. Quando todas as bordas vizinhas combinam, o encaixe é **perfeito**. Cercar uma peça com 6 vizinhas encaixadas devolve uma peça à pilha. **Missões** pedem grupos de certo tamanho ("9 ou mais", "exatamente 8") e dão peças extras. A partida acaba quando a pilha esvazia.

| Ação | Mouse / teclado | Toque |
|---|---|---|
| Colocar | clique | toque no espaço, depois toque de novo ou ✓ |
| Girar peça | `R` / botão direito (`Shift+R` ou `T` para o outro lado) | botões ⟲ ⟳ |
| Mover câmera | arrastar, `WASD` ou setas | arrastar |
| Zoom | roda do mouse, `+` / `-` | pinça |
| Girar câmera | `Q` / `E`, ou arrastar com o botão direito | — |
| Ajuda, nova partida, estatísticas | `H`, `N`, `F` | botões no topo |

## Parâmetros de URL

| Parâmetro | Efeito |
|---|---|
| `?theme=cerrado` | tema inicial (`vale`, `cerrado`, `inverno`, `sakura`, `marte`) |
| `?seed=123` | partida reproduzível |
| `?quality=high` | `auto`, `high`, `medium` ou `low` |
| `?debug` | mostra FPS, draw calls, triângulos e instâncias |
| `?auto=40` | a IA coloca 40 peças de uma vez (tabuleiro de exemplo) |
| `?demo` | a IA joga sozinha, com animação |
| `?stress=2500` | teste de carga com 2.500 peças |

## Estrutura

```
src/core/      regras puras (não importa three.js): hex, peças, tabuleiro, missões, IA
src/themes/    temas como dados
src/render/    gerador procedural de peças, chunks, instancing, pós-processamento
src/ui/        HUD em HTML/CSS
src/main.ts    entrada, fluxo da partida, salvamento, modos de teste
scripts/       capturas de tela e teste de carga com Playwright
```

## Criar um tema

Adicione um objeto em `src/themes/themes.ts`, copiando um tema existente. Os campos principais são:

- `terrainNames` / `terrainColors`: nomes e cores dos 6 terrenos (Prado, Floresta, Plantação, Vila, Rio, Trilhos).
- `ground`, `side`, `water`, `bank`, `railBed`: paleta do chão.
- `forest`: tipos de árvore (`conifer`, `round`, `blossom`, `palm`, `crystal`) com peso e cores.
- `walls`, `roofs`, `roofStyle` (`gable`, `flat`, `dome`, `pagoda`): vilas.
- `field`: cores dos retalhos de plantação.
- `bg`, `sun`, `hemiSky` etc.: fundo e luz.
- `rules` (opcional): sobrescreve `startTiles`, `perfectBonus`, `questChance`...

O tema aparece sozinho no menu.

## Medições

```bash
npm run build
(cd dist && python3 -m http.server 4173) &
node scripts/screenshots.mjs   # docs/screens/*.png
node scripts/stress.mjs        # tabela de desempenho
```

Os scripts usam o Chromium com renderização por software. Para medir FPS de verdade, abra `?stress=1000&debug` num navegador com GPU.
