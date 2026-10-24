# Roteiro comum para cada etapa Dn do Dorf (leia inteiro antes de começar)

Você executa UMA etapa do plano em `plano.md` (mesma pasta deste arquivo). O revisor (Opus) só revisa; quem escreve o código é você. Ninguém vai responder perguntas: tome as decisões sozinho, com bom senso, e registre-as no relatório.

## Preparação
1. Você está numa worktree git isolada. Rode `git fetch origin main` e crie a branch a partir do ponto indicado no pedido (normalmente `origin/main`): `git checkout -B dorf/dNN-nome origin/main`.
2. Dependências: `ln -s /home/user/Dorf/node_modules node_modules` (o link e as cópias `scripts/.shot-*` já estão no exclude do git). Nunca faça commit do link. Use `git add` com arquivos explícitos, nunca `git add -A`.
3. Leia `AGENTS.md` inteiro. Siga as invariantes. Português do Brasil em comentários, docs, UI e commits; identificadores em inglês; estilo do arquivo (2 espaços, aspas simples, ponto e vírgula).

## Regras
- Não mexa em `src/core` a não ser que a etapa peça. Sem arte externa nem arte gerada por IA (texturas CC0 do Poly Haven são permitidas, mas prefira código).
- Faça o mínimo que cumpre o "Pronto quando" da etapa, com qualidade. Não refatore o que a etapa não pede.
- Se a mudança alterar o replay das partidas, aumente `SAVE_VERSION` em `main.ts`.
- Atualize AGENTS.md/README.md quando a etapa mudar algo que eles descrevem (ganchos de URL, qualidade, modos etc.).

## Verificação (obrigatória antes do commit)
- `npm run check` (≈2 min) e `npm run smoke` (depois do build). Os dois precisam passar.
- A máquina é compartilhada com outro agente: use a PORTA indicada no pedido para servir o build:
  `(cd dist && python3 -m http.server PORTA >/dev/null 2>&1 &)`
  Para capturas, faça uma cópia do script com a sua porta, SEM commitar: `sed "s/4173/PORTA/" scripts/shot.mjs > scripts/.shot-PORTA.mjs` e rode `node scripts/.shot-PORTA.mjs <pasta> "nome=query" ...`. Apague a cópia no fim.
- Se mexer em `src/render/` (ou no visual): capturas ANTES (build da main, faça antes de editar) e DEPOIS, com a mesma query e `seed=`, por exemplo `"vale=theme=vale&seed=7&auto=40&time=day"`. Grave em `/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/dNN/` com nomes `antes-<x>.png` e `depois-<x>.png`. OLHE as imagens (ferramenta Read) e confira que o resultado é o pretendido.
- Também nesse caso: `RUNS=300:high node scripts/stress.mjs http://127.0.0.1:PORTA/` antes e depois (e `300:ultra` se a etapa mexe no Ultra). O stress grava docs/screens/stress.png só no caso 2500:high; não faça commit de capturas em docs/screens a não ser que a etapa peça (`git checkout docs/screens/`).
- Mate o servidor http da sua porta no fim.

## Commit e push
- Commits em português, primeira linha no indicativo (`Adiciona…`, `Corrige…`), corpo com o porquê. Termine CADA mensagem de commit com estas duas linhas, exatamente:

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FTBbUPfLmc3fM8RoRZbM6J

- `git push -u origin dorf/dNN-nome` (se falhar por rede, tente de novo com espera 2s, 4s, 8s, 16s).
- NÃO abra PR e NÃO faça merge: o revisor abre o PR.

## Relatório final (curto, em português, é o que o revisor lê)
- branch e hash do último commit;
- o que mudou (arquivos e decisões tomadas sozinho);
- resultado do `npm run check` e do `npm run smoke` (uma linha cada);
- números do stress antes/depois, quando houver (copie as linhas da tabela);
- caminhos das capturas;
- se cumpriu o "Pronto quando" e, se não, o que faltou;
- o que o Roger precisa decidir ou olhar.

## Comparação de capturas (D5) nas etapas visuais
Se a sua branch não tiver `scripts/compare.mjs`, copie a ferramenta sem commitar: `cp /tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/compare.mjs scripts/.compare.mjs`. Uso: `BASE=http://127.0.0.1:PORTA/ node scripts/.compare.mjs grava <pasta-antes>` com o build ANTES da mudança, depois `... compara <pasta-antes> <pasta-depois>` (grava `diff-*.png`). Guarde as pastas em scratchpad/dNN/. Em mudança que deveria ser invisível, a comparação precisa passar; em mudança visual proposital, use-a para mostrar onde mudou.
Referências visuais do Roger (Weatherglass, ilha hexagonal, Koastalia): leia scratchpad/REFERENCIAS.md e as imagens citadas. Guia de luz, cor e composição; não copie arte.

## Rodada 2 (D21 em diante)
- Relatórios de base em scratchpad/aval/ (arvores.md, casas.md, campos.md, chao-luz.md) e o resumo PLANO-VISUAL.md. Leia o relatório da sua área antes de começar.
- Máquina compartilhada com outros 4 agentes: capturas só as necessárias, em 1200×720, com `quality=high` e `timescale=0.05`; se o screenshot estourar o tempo, acrescente `timeout: 180000` ao `page.screenshot` na SUA cópia do script.
- Para encerrar processos, use `kill <PID>` pelo número; nunca `pkill -f` com um padrão que apareça na sua própria linha de comando (isso derruba o seu shell).

## Rodada 3 (temas e relevo)
- Plano em scratchpad/temas/PLANO-RODADA3.md; relatórios de cada tema e do relevo em scratchpad/temas/<id>.md e relevo.md. Leia o plano e o relatório da sua etapa.
- Decisões do Roger: 5 temas — Holanda Dourada (`holanda`, PADRÃO), Egito do Nilo (`egito`), Terraços do Oriente (`oriental`: Sakura + Jade Song + Edo), Brasil Dourado (`brasil`: Cerrado + Minas Colonial), Inverno Nórdico (`inverno`, absorve Terra dos Vikings). Saem Vale Pastel, Colônia Marciana, Toscana, Velho Oeste e Andes.
- Para servir o build, use uma CÓPIA do dist numa pasta sua do scratchpad (o `vite build` recria o dist e o servidor fica sem arquivos).

## Rodada 3b (segunda passada e relevo R2) — a partir de 23/10
- A rodada 3 (5 temas, I1, R1) já está na `main` (#100). Parta de `origin/main` atualizada.
- Os kits de cada tema ficam em `src/render/kits/<id>.ts`; os temas em `src/themes/<id>.ts`. Em arquivos comuns, só acréscimos desligados por padrão.
- Capturas: antes e depois com a mesma query (`seed=7&auto=60&quality=high&timescale=0.05`, 1200×720), em scratchpad/<etapa>/. Stress `RUNS=300:high` do tema mexido (cópia local do stress.mjs com `&theme=<id>&seed=42`, sem commitar).
- Se o `page.goto` do smoke estourar 30 s só por carga da máquina, repita numa cópia local com timeout maior e registre; não mude o script commitado.
