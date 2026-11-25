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
| E6 Paisagem viva no jogo (ideia do Roger, referência do Astra) | Claude | `dorf/e5-encostas` | na `main` (#117); continuidade nas linhas de celeiros e canais |
| Patamares de vila em geometria (muro de arrimo, como a Aldeia na crista) | Astra | `astra/e5-patamares` a partir de `fcc7530` | na `main` (#117), [relatório e prancha](propostas/e5-patamares/RELATORIO.md) |
| E7 Limite de buffers de vértice no WebGPU (árvores com 9 buffers acima de 1000 instâncias; também na `main`) | Claude | `dorf/e5-encostas` | na `main` (#117), com a E7b (um buffer intercalado por geometria) e os casos `buffers-de-vertice` e `vida-dos-buffers` no smoke ([relatório](propostas/e7/RELATORIO.md)); o #116 foi fechado como substituído |
| D46 Encostas mais leves (montagem 34% mais rápida, vizinhas refeitas em fila) | Claude | `dorf/d46-encostas-leves` | na `main` (#123), [relatório](propostas/d46/RELATORIO.md) |
| D47 Fundações das casas nos patamares (sem recortes na junção com a capa) | Claude | `dorf/d47-fundacoes` | na `main` (#129, `5017a19`), [relatório](propostas/d47/RELATORIO.md) |
| Piloto de acessos entre patamares e aviso abaixo do cabeçalho | Astra | `astra/acessos-da-vila` | na `main` (#126, `d9e56e7`). [Relatório e prancha](propostas/acessos-da-vila/RELATORIO.md) |
| Casas vazias internas com contorno redondo | Astra | `astra/baias-internas` a partir de `bd371dc` | na `main` (#117), [relatório e pranchas](propostas/baias-internas/RELATORIO.md) |
| E8 Atualização das vizinhas: fumaça, peça que assenta durante a queda, corredeira nas duas ordens, prévia da vizinha que sobe | Claude | `dorf/e5-encostas` | feita (`4081afe` e seguintes; [relatório](propostas/e8/RELATORIO.md)); `npm run scene` compara cena incremental e reconstrução (16 casos ok); falta conferir o WebGPU e a GPU real (issue #115) |
| Entrepostos como modo sobre a base (cais, fretes, oráculo independente do contrato) | Astra | `astra/entrepostos-modo` | feito em `f4ad35f`, integrado à base do #117. [Relatório e prancha](propostas/entrepostos-modo/RELATORIO.md). PR para revisão do Roger |
| Acabamento do Entrepostos (renderização dos cais, balizas e trajeto das barcas) | Astra | `astra/entrepostos-acabamento` | na `main` (#121, `f411920`). [Relatório e pranchas](propostas/entrepostos-acabamento/RELATORIO.md) |
| Paisagem viva: celeiros por tema | Astra | `astra/paisagem-viva` | na `main` nos cinco temas (#122, `c126e2a`). [Relatório](propostas/paisagem-viva/RELATORIO.md) |
| Paisagem viva: alargamento dos canais | Astra | `astra/canal-vivo` | na `main` (#125, `721bde7`), com emenda simétrica, atualização da malha e teste de reconstrução. [Relatório e prancha](propostas/canal-vivo/RELATORIO.md) |
| Guanabara e Chamonix com kits procedurais do jogo | Astra | `astra/temas-guanabara-chamonix` | na `main` (#130, `93c9813`). [Relatório e pranchas](propostas/temas-guanabara-chamonix/RELATORIO.md) |
| D48 Avaliação autônoma do jogo (16 capturas e a lista priorizada P1 a P3) | Claude | `dorf/d48-avaliacao` | na `main` (#124, `1d21c3f`), [avaliação](propostas/avaliacao-autonoma/AVALIACAO.md) |
| D49 Casas vazias no pé das peças (sem paredes de vidro, visíveis à noite) | Claude | `dorf/d49-casas-vazias` | na `main` (#127, `bb1fc78`), [relatório](propostas/d49/RELATORIO.md) |
| D50 Fim de partida coerente e ajustes de interface | Claude | `dorf/d50-interface` | na `main` (#128, `bda5bee`), [relatório](propostas/d50/RELATORIO.md) |
| D51 Contorno do fantasma mais fino e carimbos no pé das casas vazias | Claude | `dorf/d51-fantasma` | na `main` (#131, `7e3b128`), [relatório](propostas/d51/RELATORIO.md) |
| D52 Água refeita junto com o chão, também sem a Paisagem viva | Claude | `dorf/d52-agua-cena` | na `main` (#132, `e14103a`), [relatório](propostas/d52/RELATORIO.md) |
| D53 Casas do estágio 3 da Paisagem viva sem forma de torre e palmeiras que leem na silhueta | Claude | `dorf/d53-silhuetas` | feita na branch, para revisão do Dorf. [Relatório e pranchas](propostas/d53/RELATORIO.md) |
| D54 Enquadramento automático sem a pilha cobrir a ilha e sombra de contato no pé das peças (P3.7 e P3.3 da avaliação autônoma) | Claude | `dorf/d54-enquadramento` | feita na branch, para revisão do Dorf. [Relatório e pranchas](propostas/d54/RELATORIO.md) |

## Coordenação
A conversa entre os agentes fica na issue #115 ("Continuidade das Encostas entre Claude e Codex"). Ao pegar ou terminar uma tarefa, comente lá, com a branch e o commit, e atualize esta tabela.

## Onde está cada coisa
- **Avaliação do Entrepostos:** `docs/propostas/entrepostos/AVALIACAO.md`.
- **Encostas:** `docs/propostas/e5/` (relatório, pranchas, como testar).
- **Paisagem viva:** `docs/propostas/e6/`, quando a E6 terminar.
- **Prévias publicadas pelo Claude:** listadas em `docs/propostas/e5/COMO-TESTAR.md`.
