# Sincronia entre agentes (Claude e GPT Astra)

O Roger pediu que os dois agentes trabalhem em sincronia no mesmo repositório. Leia este arquivo inteiro antes de começar e atualize a tabela "Quem faz o quê" ao pegar ou terminar uma tarefa.

## Regras
1. **Cada agente tem as próprias branches.** O Claude usa `dorf/<etapa>` e o Astra usa `astra/<etapa>`. Ninguém faz push na branch do outro. Para aproveitar o trabalho do outro, crie a sua branch a partir da dele, ou faça merge dela na sua (merge, nunca rebase nem force-push).
2. **A base comum é a `dorf/e5-encostas`.** Ela tem as Encostas no jogo todo, o Relevo, a Terra contínua e o fantasma da regra. A `main` é o jogo publicado: só recebe trabalho por PR, com o merge aprovado pelo Roger.
3. **Antes de começar:** `git fetch origin`. Leia este arquivo, o `AGENTS.md` (invariantes) e o `docs/propostas/BRIEF-agentes.md` (rotina de verificação). Não pegue uma tarefa que esteja na tabela com outro dono.
4. **Antes de cada commit:** `npm run check`. Depois do build, rode `npm run smoke`. Quando mexer no visual, gere capturas de antes e depois e olhe as imagens.
5. **Salve tudo no git.** Relatórios e pranchas (JPG, até 1600 px) vão em `docs/propostas/<etapa>/` na própria branch, com push a cada marco verde. Pastas temporárias podem ser apagadas entre as sessões.
6. **Português do Brasil** nos commits, comentários e documentos. Sem caminhos pessoais (`C:/Users/...`) nem notas de processo nos documentos.
7. **Ao terminar uma tarefa:** marque-a como feita na tabela, com a branch e o commit, e escreva um resumo de 3 a 5 linhas em `docs/propostas/<etapa>/RELATORIO.md`.

## Quem faz o quê
| Tarefa | Dono | Branch | Estado |
|---|---|---|---|
| E5 Encostas no jogo todo (modelo do Astra) | Claude | `dorf/e5-encostas` | E5c feita (`3f2cccf`); espera o olhar do Roger |
| E6 Paisagem viva no jogo (ideia do Roger, referência do Astra) | Claude | `dorf/e5-encostas` | feita (`a2b9157`; relatório em `docs/propostas/e6/`); falta: canal mais largo, celeiro com desenho próprio, conferir o WebGPU e a GPU real |
| Patamares de vila em geometria (muro de arrimo, como a Aldeia na crista) | Astra | `astra/e5-patamares` a partir de `fcc7530` | feita (`774c2a2`), [relatório e prancha](propostas/e5-patamares/RELATORIO.md); juntada à `dorf/e5-encostas` (`91084f3`) |
| E7 Limite de buffers de vértice no WebGPU (árvores com 9 buffers acima de 1000 instâncias; também na `main`) | Claude | `dorf/e5-encostas` | feita; atributos do kit intercalados em `instGeometry`, gancho `?vbuf`, teste e caso no smoke ([relatório](propostas/e7/RELATORIO.md)); falta conferir na GPU real; na `main` pelo PR #116 (`dorf/d43-webgpu-buffers`) |
| Casas vazias internas com contorno redondo | Astra | `astra/baias-internas` a partir de `bd371dc` | feita (`f702699`), [relatório e pranchas](propostas/baias-internas/RELATORIO.md), issue #115 |
| E8 Atualização das vizinhas: fumaça, peça que assenta durante a queda, corredeira nas duas ordens, prévia da vizinha que sobe | Claude | `dorf/e5-encostas` | feita (`4081afe` e seguintes; [relatório](propostas/e8/RELATORIO.md)); `npm run scene` compara cena incremental e reconstrução (16 casos ok); falta conferir o WebGPU e a GPU real (issue #115) |
| Entrepostos como modo sobre a base (cais, fretes, oráculo independente do contrato) | livre (sugestão: Astra) | `astra/entrepostos-modo` | livre, depois da E6 |

## Coordenação
A conversa entre os agentes fica na issue #115 ("Continuidade das Encostas entre Claude e Codex"). Ao pegar ou terminar uma tarefa, comente lá, com a branch e o commit, e atualize esta tabela.

## Onde está cada coisa
- **Avaliação do Entrepostos:** `docs/propostas/entrepostos/AVALIACAO.md`.
- **Encostas:** `docs/propostas/e5/` (relatório, pranchas, como testar).
- **Paisagem viva:** `docs/propostas/e6/`, quando a E6 terminar.
- **Prévias publicadas pelo Claude:** listadas em `docs/propostas/e5/COMO-TESTAR.md`.
