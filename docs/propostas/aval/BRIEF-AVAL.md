# Avaliação visual: Retalhos × Dorfromantik (só leitura, sem mudar código)

Você é um dos avaliadores visuais. Cada um cuida de UMA área. O objetivo é um diagnóstico concreto e uma lista de melhorias executáveis depois, como etapas novas (D21 em diante).

## Material
- Referência: `/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/images/4.webp`, um print do Dorfromantik original. Nosso jogo, num print do Roger na GPU real (Holanda, Ultra): `images/5.webp`. Outras referências de direção: `images/1.webp` (Weatherglass), `2.jpg` (ilha hexagonal) e `3.jpg` (Koastalia), descritas em `scratchpad/REFERENCIAS.md`.
- Capturas da `main` atual (qualidade Alta, renderização por software, seed 7, 60 peças), em `scratchpad/aval/main/`: holanda-aberto, holanda-medio, vale-aberto, vale-floresta (perto de floresta), vale-vila (perto de vila), vale-campo (perto de plantação), toscana-medio, viking-medio.
- PRs visuais ainda abertos, com antes/depois em `scratchpad/capt/`:
  - `d09` tilt-shift;
  - `d13` mar em volta;
  - `d14` luz de vitrine;
  - `d15` vilas em quarteirões;
  - `d19` árvores leves de longe;
  - `d08` Ultra mais barato.

  Leve-os em conta: não proponha o que um deles já faz. Diga se algum piora a sua área.
- Código na `/home/user/Dorf` (main). Leia `AGENTS.md` (invariantes, orçamento de desempenho, "Tema é só dado", arte só em código). Os arquivos principais estão em `src/render/` (`lib.ts`, `tileBuilder.ts`, `materials.ts`, `world.ts`, `groundMap.ts`, `post.ts`) e em `src/themes/`.

## Impressões do Roger (ponto de partida, não conclusão)
- A água do nosso é bem superior.
- As árvores do original, embora mais simples, são mais bonitas e deixam o visual mais agradável.
- As casas do original são mais ricas em detalhes e mais variadas.
- Nossos campos de flores são bem superiores, mas a demarcação hexagonal rígida e abrupta deveria virar algo mais suave e integrado.

## Regras
- NÃO edite arquivos do repositório nem faça commit. Escreva só o seu relatório.
- Olhe as imagens com a ferramenta Read. Seja específico: diga o que se vê, onde, e por que funciona ou não (forma, silhueta, cor, valor, saturação, densidade, escala, agrupamento, bordas, luz).
- Ancore cada diagnóstico no código: `arquivo:linha` da geometria, cor ou distribuição responsável.
- Não proponha copiar a arte do Dorfromantik. Proponha direção (forma, cor, composição) implementável em código, sem arte externa nem arte de IA, e respeitando as invariantes (tema é só dado; aparência determinística pela semente; orçamento de ~10% de triângulos e draw calls por mudança, salvo justificativa).
- Se precisar de uma captura a mais, use no máximo 2, na sua PORTA, servindo a `dist/` já construída da main: `(cd /home/user/Dorf/dist && python3 -m http.server PORTA &)`, e copie `scripts/shot.mjs` para `scripts/.shot-PORTA.mjs` com `sed "s/4173/PORTA/"`. Apague a cópia e mate o servidor no fim, pelo PID, com `kill`. Nunca use `pkill -f` com um padrão que apareça na sua própria linha de comando.

## Relatório
Grave em `scratchpad/aval/<area>.md`, em português simples, com até ~120 linhas:
1. **Diagnóstico**, de 3 a 6 pontos: o que o original faz melhor, o que o nosso faz melhor e por quê, com evidência da imagem e `arquivo:linha`.
2. **Propostas**, de 3 a 6, ordenadas por impacto/custo. Cada uma com:
   - o que muda na tela;
   - como fazer (arquivos e técnica);
   - custo estimado (triângulos, draw calls, CPU de montagem);
   - riscos às invariantes;
   - "pronto quando" verificável (captura, número, teste);
   - tamanho P, M ou G.
3. **Não fazer**: o que parece boa ideia mas não vale, e por quê.

Termine respondendo só com o caminho do relatório e as 3 propostas de maior impacto em uma linha cada.
