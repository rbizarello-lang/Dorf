# Etapas T1 a T5: aprofundar UM tema (execução)

Leia primeiro o roteiro comum, /tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/BRIEF.md (inclusive "Rodada 3"). Depois leia, inteiros:
- o relatório do SEU tema, em `scratchpad/temas/<id>.md`;
- a seção 6 de `scratchpad/temas/relevo.md`;
- a seção "Mecanismos de tema" do AGENTS.md, que descreve `fauna`, `gates`, `ambience`, `eggs`, `skyFx`, `floodplain`, `terraces` e `relief`. Esses mecanismos já existem.

## Base
Crie a branch a partir da `dorf/base-temas`, que já tem os 5 temas, a estrutura comum e as serras:

```
git fetch origin && git checkout -B dorf/<tN>-<id> origin/dorf/base-temas
```

## Paralelo: outros 4 agentes mexem nos outros temas agora
Para o merge final ser fácil:
- Mude à vontade o arquivo do SEU tema, `src/themes/<id>.ts`. Não mexa nos arquivos dos outros temas.
- Kits novos (geometria) vão num arquivo SEU, `src/render/kits/<id>.ts`. Nos arquivos compartilhados entra só o mínimo, sempre como acréscimo e nunca reescrevendo trechos existentes:
  - `types.ts`: o valor novo na união, com comentário;
  - `lib.ts`: uma linha de `case` chamando o seu arquivo;
  - `CROP_LAYOUT`: a entrada do kit.
- Se precisar mudar um mecanismo comum (`tileBuilder.ts`, `life.ts`, `world.ts`, `audio.ts`), prefira acrescentar uma opção nova, que vem desligada por padrão, a mudar o comportamento de hoje. Descreva cada mudança desse tipo no relatório, porque elas podem conflitar com as dos outros agentes.
- Não use `if (theme.id)` (invariante 8). Para comportamento próprio do tema, crie um campo ou um kit.

## O que fazer
Implemente a lista de trabalho do relatório do seu tema (seção 8), na ordem sugerida, até onde der com qualidade:
- a reinterpretação dos terrenos, sobretudo a peça-assinatura: o que os campos, as estradas e o prado viram;
- casas e eras;
- fauna;
- portais, ponte e marcos;
- 3 a 5 easter eggs pelo mecanismo `eggs`;
- `ambience`, `relief`, paleta e gradação.

Se faltar tempo, priorize o que mais distingue o tema na tela. Deixe o restante listado no relatório.

## Orçamento e verificação
- Rode o stress `RUNS=300:high` com o seu tema antes (na base) e depois. Para isso, rode `scripts/stress.mjs` numa cópia local com `&theme=<id>` na URL. O limite é triângulos e draw calls ≤ +10% sobre a base do mesmo tema.
- Capturas antes e depois em `scratchpad/<tN>/`, todas com `seed=7&auto=60` e `quality=high`:
  - zoom 12;
  - de perto na peça-assinatura (`zoom=6&focus=<terreno>`);
  - uma vila;
  - noite ou entardecer;
  - pelo menos 2 easter eggs, disparados por `window.__egg` ou pelo gatilho.

  OLHE todas e itere até ficar bonito e com identidade própria.
- `npm run check`, `npm run smoke` e `node scripts/weather.mjs` verdes.
- Atualize o README (texto do tema) e o `docs/TEMAS.md` (seção do tema).

## Relatório
Curto. Diga o que ficou pronto e o que ficou para depois, as mudanças nos arquivos compartilhados, os números do stress, os caminhos das capturas e as decisões que tomou sozinho.
