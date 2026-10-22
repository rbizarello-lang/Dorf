# Dívidas técnicas

Levantamento da etapa D20 (versão reduzida), sobre a `main` de 2026-10-14 (`92736ed`). Nada aqui foi feito no código: o `main.ts` **não** foi quebrado agora porque os PRs D1 a D19 estão abertos e quase todos mexem nele. Quebrar antes geraria conflito em cada um.

## 1. Quebrar o `main.ts` (1742 linhas)

**Quando:** só depois que D1 a D19 entrarem na `main`. Os números abaixo são das linhas atuais e vão mudar; refaça a contagem com `grep -n "^// ----" src/main.ts` antes de começar.

O arquivo já é dividido por comentários de seção. Proposta de destino de cada bloco:

| Linhas atuais | Bloco | Destino | Funções principais |
|---|---|---|---|
| 1530-1738 (~210) | ganchos `window.__*` | `src/debugHooks.ts` | `__over`, `__ghostBest`, `__focus`, `__celebrate`, `__ripple`, `__plaza`, `__era`, `__mark`, `__site`, `__special`, `__wonder`, `__folk`, `__fishing`, `__spur`, `__holdTrade`, `__trade`, `__boat`, `__placeBest`, `__ghostSynergy`, `__video` |
| 763-1021 (~260) | telas e menus | `src/ui/menus.ts` | `showHelp`, `themeBest`, `almanac`, `synergyLegend`, `showGameOver`, `setHouse`, `showCrest`, `pickTheme` |
| 1022-1077 (~55) | qualidade | `src/quality.ts` | `autoNote`, `updateQualityTitle`, `applyQuality`, `adaptQuality`, `pickQ` (linha 219) |
| 1237-1283 (~45) | modos especiais | `src/autoplay.ts` | `autoPlace`, `demoStep` |
| 252-762 (~510) | fluxo da partida | `src/flow.ts` | `newGame`, `persist`, `snapshot`, `validSave`, `readSave`, `requestNewGame`, `startFresh`, `undo`, `place`, `showChoice`, `chooseBlessing`, `noteTurn`, `ensureTurns`, `scheduleGameOver`, `announce`, rotas (`routeLabel`, `refreshTradeMarks`, `refreshRoutePeek`) |
| 33-251 (~220) | estado, mundo, acessibilidade, melhor placar | `src/state.ts` (estado compartilhado) e `src/ui/a11yPanel.ts` | `createWorld`, `shownTheme`, `applyA11y`, `buzz`, `showA11y`, `loadBest`, `rulesFor`, `eraName`, `siteReward` |
| 1078-1236 (~160) | entrada, hora e som | `src/controls.ts` | `setHover`, `setTimeLabel`, `cycleTime`, `setSound` |
| 1284-1529 (~245) | laço e início | fica no `main.ts` | `updateAmbience`, `mapFrame`, `frame`, `step`, `start` |

O `main.ts` ficaria com ~300 linhas: importa os módulos, monta o estado e liga o laço.

**Armadilha principal:** hoje tudo vive em variáveis de módulo (`world`, `game`, `mode`, `theme`, `qualityMode`...). Antes de mover qualquer bloco, crie `src/state.ts` com um objeto `ctx` (ou exports `let` mais setters) para elas. Sem isso, cada módulo novo precisa de uma lista de parâmetros enorme. Os módulos já extraídos (`input.ts` com `InputHost`, `capture.ts` com `CaptureHost`) mostram o padrão: uma interface "host" com só o que o módulo usa.

**Ordem segura (um módulo por commit):**
1. `state.ts` sozinho, sem mover funções (só as variáveis).
2. `debugHooks.ts` (menor risco: ninguém no jogo chama os ganchos; só os scripts de captura).
3. `autoplay.ts`, depois `quality.ts`.
4. `ui/menus.ts`.
5. `controls.ts`.
6. `flow.ts` por último (é o maior e o que os testes do replay mais exercitam).

**A cada commit:** `npm run check`, `npm run build` + `npm run smoke`, e a comparação de capturas do D5 (`scripts/compare.mjs`) contra a build da `main` antes da etapa. Qualquer diferença visual em refatoração é erro. Se `SAVE_VERSION` não mudou, um save antigo precisa carregar igual. Atualize o mapa do código do AGENTS.md no último commit.

## 2. Arquivos grandes

Linhas em 2026-10-14. Passam de ~800 e juntam responsabilidades:

| Arquivo | Linhas | Observação |
|---|---|---|
| `src/render/lib.ts` | 2179 | geometria de todos os kits; poderia virar `lib/` com um arquivo por família (casas, árvores, plantações, animais, barcos e veículos, marcos). Cada `switch` já é independente |
| `src/render/world.ts` | 1894 | cena, luz, céu, blocos, pools, fantasma; candidatos a sair: céu e hora (`skyFor`), pools, animações de queda |
| `src/main.ts` | 1742 | ver a seção 1 |
| `src/render/tileBuilder.ts` | 1426 | chão, água, estradas e decoração numa função só de peça; separar água e estradas |
| `tests/logic.ts` | 1002 | oráculos e simulação juntos; separar oráculos por regra |
| `src/render/life.ts` | 876 | barcos, veículos, animais, aldeões, peixes e pássaros |
| `src/render/materials.ts` | 831 | chão, água, kits, vazio |
| `docs/IDEIAS_AOE.md` | 1090 | as 20 propostas estão feitas; vale arquivar a parte detalhada e deixar só a tabela de andamento |

## 3. Outras dívidas

- **Scripts de captura duplicados:** `scripts/shot.mjs` (23 linhas) e `scripts/screenshots.mjs` (79) repetem o laço de abrir a página, esperar e coletar erros do console. A porta `4173` está fixa em `shot.mjs`, `screenshots.mjs` e `stress.mjs` (só os dois últimos aceitam argumento); faça `shot.mjs` ler a base de `BASE` ou de argumento, como o `stress.mjs`, e dispensar as cópias por porta.
- **Exports sem uso fora do próprio arquivo** (candidatos a deixar de exportar ou apagar; checado com grep por nome em `src`, `tests` e `scripts`): `makeCausticData` (`render/noise.ts`), `brushTex`, `waterTex`, `causticTex`, `cloudField`, `cloudLight` (`render/materials.ts`), `shoulder` (`render/post.ts`), `pathsFor` e `railPaths` (`render/tileBuilder.ts`), `generateEdges` (`core/tiles.ts`), `isPort` (`core/routes.ts`), `LENS` (`render/cameraRig.ts`), `BASE_THEMES` (`themes/themes.ts`), `TAKE_MAX` (`video/take.ts`), `SQRT3` e `HEX_R` (`core/hex.ts`), `FRAME_KINDS`, `FRAME_PALETTE` e `EMBLEM_SVG` (`ui/frames.ts`), `TIP_IDS` (`ui/tutorial.ts`), `DEFAULT_BANNER` (`ui/banner.ts`), `RESOLUTIONS` (`ui/capture.ts`), `BLESSING_IDS` (`core/blessings.ts`). Alguns são usados dentro do arquivo e só precisam perder o `export`; confirme um a um. Mais de 40 tipos e interfaces exportados também só são usados no próprio arquivo. O `tsc` (`noUnusedLocals`) não pega isso porque o símbolo está exportado.
- **Código morto:** o `tsc` estrito passa limpo, então não há variável ou parâmetro local sem uso. Falta uma ferramenta para exports (por exemplo `knip`) no CI, se o Roger quiser.
- **Tipagem dos ganchos:** cada gancho repete `(window as unknown as {...})`. Em `debugHooks.ts`, declare uma interface `DebugWindow` uma vez.
- **Sem lint nem formatador** (decisão registrada no AGENTS.md). Ao quebrar o `main.ts`, o estilo precisa ser seguido na mão.
- **Documentação:** o AGENTS.md foi auditado nesta etapa (mapa do código, tabela de ganchos, modos, `?demo`, `msaa`). O README (`src/main.ts` na árvore de arquivos, linha 164) ainda não lista os módulos novos; confira junto com a quebra do `main.ts`.
- **FPS em GPU real** continua sem medida (o D1 `?bench` ajuda).

## 4. Branches antigas (para o Roger decidir)

Nenhuma foi apagada. Não estão listadas as `dorf/d*` e `dorf/capturas` desta rodada. Datas são do último commit; "na main" vem de `git branch -r --merged origin/main` depois de um `git fetch` completo.

| Branch | Último commit | Na main? | Observação |
|---|---|---|---|
| `cursor/acabamento-ultra-alta-6a4c` | 2026-10-05 | sim | pode apagar |
| `cursor/celular-acessibilidade-6a4c` | 2026-10-05 | sim | pode apagar |
| `cursor/corte-regiao-6a4c` | 2026-10-05 | sim | pode apagar |
| `cursor/paginas-github-6a4c` | 2026-10-05 | sim | pode apagar |
| `cursor/painel-equilibrio-6a4c` | 2026-10-05 | sim | pode apagar |
| `cursor/previa-pontos-6a4c` | 2026-10-05 | sim | pode apagar |
| `cursor/atmosferas-estacoes-3e55` | 2026-10-04 | sim | pode apagar |
| `cursor/interface-por-tema-3e55` | 2026-10-04 | sim | pode apagar |
| `cursor/minimapa-linha-do-tempo-3e55` | 2026-10-04 | sim | pode apagar |
| `cursor/modo-estrada-real-3e55` | 2026-10-04 | sim | pode apagar |
| `cursor/monumentos-conquista-3e55` | 2026-10-04 | sim | pode apagar |
| `cursor/une-plano-aoe-6a4c` | 2026-10-04 | sim | pode apagar |
| `rotas-visuais` | 2026-10-04 | sim | pode apagar |
| `claude/charming-einstein-dx4vav` | 2026-10-04 | não (3 commits à frente) | "Une as estações com a moldura, os monumentos e a Estrada Real"; as propostas 15, 17, 19 e 14 já constam como feitas na main, então provavelmente entrou por outro caminho (squash). Confira antes de apagar |
| `claude/project-thread-aez0su` | 2026-10-02 | não (1 commit) | "Protótipo: assa oclusão de ambiente na cor dos vértices dos kits"; protótipo abandonado ou ainda a avaliar |
| `ferramentas-claude` | 2026-10-14 | não (4 commits) | "Adiciona skills do Claude Code em .claude/skills"; trabalho recente, decidir se vira PR |
| `jogo-lanternas` | 2026-10-14 | não (5 commits) | "Versiona o HTML único da Ilha das Lanternas"; trabalho recente, fora do escopo do Retalhos |
