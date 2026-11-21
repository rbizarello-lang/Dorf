# Sincronia entre agentes (Claude e GPT Astra)

O Roger pediu que os dois agentes trabalhem em sincronia no mesmo repositório. Leia este arquivo inteiro antes de começar e atualize a tabela "Quem faz o quê" ao pegar ou terminar uma tarefa.

## Regras
1. **Cada agente tem as próprias branches.** O Claude usa `dorf/<etapa>` e o Astra usa `astra/<etapa>`. Ninguém faz push na branch do outro. Para aproveitar o trabalho do outro, crie a sua branch a partir da dele, ou faça merge dela na sua (merge, nunca rebase nem force-push).
2. **A base comum é a `main`.** Desde o PR #117 (`5b9b9ed`) ela tem as Encostas no jogo todo, o Relevo, a Terra contínua, a Paisagem viva, os patamares, as baías e a atualização das vizinhas (E8). Cada etapa sai de uma branch própria a partir da `main` e volta por PR; o merge é sempre aprovado pelo Roger. A `dorf/e5-encostas` fica guardada como histórico.
3. **Antes de começar:** `git fetch origin`. Leia este arquivo, o `AGENTS.md` (invariantes) e o `docs/propostas/BRIEF-agentes.md` (rotina de verificação). Não pegue uma tarefa que esteja na tabela com outro dono.
4. **Antes de cada commit:** `npm run check`. Depois do build, rode `npm run smoke`. Quando mexer no visual, gere capturas de antes e depois e olhe as imagens.
5. **Salve tudo no git.** Relatórios e pranchas (JPG, até 1600 px) vão em `docs/propostas/<etapa>/` na própria branch, com push a cada marco verde. Pastas temporárias podem ser apagadas entre as sessões.
6. **Português do Brasil** nos commits, comentários e documentos. Sem caminhos pessoais (`C:/Users/...`) nem notas de processo nos documentos.
7. **Um agente por branch de cada vez.** Dois agentes enviando à mesma branch ao mesmo tempo apagaram o trabalho um do outro (`f09c033` e `39eb6ec`). Para trabalho em paralelo, cada um usa a própria branch e o merge é feito no fim. Antes de qualquer commit numa branch compartilhada, faça `git pull --no-rebase` e confira com `git diff --stat HEAD@{1}` que só os seus arquivos mudaram.
8. **Ao terminar uma tarefa:** marque-a como feita na tabela, com a branch e o commit, e escreva um resumo de 3 a 5 linhas em `docs/propostas/<etapa>/RELATORIO.md`.

## Quem faz o quê
| Tarefa | Dono | Branch | Estado |
|---|---|---|---|
| E5 Encostas no jogo todo (modelo do Astra) | Claude | `dorf/e5-encostas` | na `main` (#117) |
| E6 Paisagem viva no jogo (ideia do Roger, referência do Astra) | Claude | `dorf/e5-encostas` | na `main` (#117); falta: canal mais largo, celeiro com desenho próprio, GPU real |
| Patamares de vila em geometria (muro de arrimo, como a Aldeia na crista) | Astra | `astra/e5-patamares` a partir de `fcc7530` | na `main` (#117), [relatório e prancha](propostas/e5-patamares/RELATORIO.md) |
| E7 Limite de buffers de vértice no WebGPU (árvores com 9 buffers acima de 1000 instâncias; também na `main`) | Claude | `dorf/e5-encostas` | na `main` (#117), com a E7b (um buffer intercalado por geometria) e os casos `buffers-de-vertice` e `vida-dos-buffers` no smoke ([relatório](propostas/e7/RELATORIO.md)); o #116 foi fechado como substituído |
| Casas vazias internas com contorno redondo | Astra | `astra/baias-internas` a partir de `bd371dc` | na `main` (#117), [relatório e pranchas](propostas/baias-internas/RELATORIO.md) |
| E8 Atualização das vizinhas: fumaça, peça que assenta durante a queda, corredeira nas duas ordens, prévia da vizinha que sobe | Claude | `dorf/e5-encostas` | feita (`4081afe` e seguintes; [relatório](propostas/e8/RELATORIO.md)); `npm run scene` compara cena incremental e reconstrução (16 casos ok); falta conferir o WebGPU e a GPU real (issue #115) |
| Entrepostos como modo sobre a base (cais, fretes, oráculo independente do contrato) | Astra | `astra/entrepostos-modo` | feito em `f4ad35f`, integrado à base do #117. [Relatório e prancha](propostas/entrepostos-modo/RELATORIO.md). PR para revisão do Roger |
| Acabamento do Entrepostos (renderização dos cais, balizas e trajeto das barcas) | Astra | `astra/entrepostos-acabamento` | feito em `3103d77`. [Relatório e pranchas](propostas/entrepostos-acabamento/RELATORIO.md). PR para revisão do Roger |

## Coordenação
A conversa entre os agentes fica na issue #115 ("Continuidade das Encostas entre Claude e Codex"). Ao pegar ou terminar uma tarefa, comente lá, com a branch e o commit, e atualize esta tabela.

## Onde está cada coisa
- **Avaliação do Entrepostos:** `docs/propostas/entrepostos/AVALIACAO.md`.
- **Encostas:** `docs/propostas/e5/` (relatório, pranchas, como testar).
- **Paisagem viva:** `docs/propostas/e6/`, quando a E6 terminar.
- **Prévias publicadas pelo Claude:** listadas em `docs/propostas/e5/COMO-TESTAR.md`.
