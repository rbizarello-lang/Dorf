# Rodada 3: 5 temas aprofundados (só pesquisa e proposta, sem mudar código)

## Decisão do Roger
O jogo passa de 14 para **5 temas**, e cada um vai ficar bem mais distinto:
1. **Holanda Dourada**: aprofundar.
2. **Egito do Nilo**: aprofundar.
3. **Oriental**: fusão de Jardim Sakura, Jade Song e Edo Tranquilo. O nome ainda precisa ser escolhido; proponha 3.
4. **Brasil**: fusão de Cerrado Dourado e Minas Colonial. Proponha o nome.
5. **Inverno Nórdico**: fica este nome, com o melhor da Terra dos Vikings.

Saem: Vale Pastel (o tema padrão de hoje), Colônia Marciana, Toscana, Velho Oeste e Andes.

Nas palavras do Roger: "a escolha [do tema] deve alterar de forma ainda mais acentuada o estilo das construções, a vegetação, os animais etc. Podemos pensar em alterar inclusive o estilo das peças: os campos serem substituídos por outros elementos a depender do local (assim como a Holanda firma em flores, os demais também podem ter suas peculiaridades mais marcadas). Podemos pensar inclusive em easter eggs relativos a cada um deles. Aprofundar a distinção."

## Material
- Código em `/home/user/Dorf` (main). Leia `AGENTS.md` inteiro: as invariantes, em especial a 8 ("tema é só dado") e a 3 (determinismo), e o orçamento de desempenho.
- `src/themes/types.ts` define tudo o que um tema pode escolher hoje. Os temas atuais estão em `src/themes/themes.ts` e `src/themes/eras.ts`. Os kits ficam em `src/render/lib.ts`, e o uso deles em `src/render/tileBuilder.ts`.
- Leia também `docs/TEMAS.md` (pesquisa histórica e kits que faltam), `src/themes/progress.ts` (eras da vila) e `src/ui/frames.ts`/`banner.ts` (interface por tema).
- Capturas dos temas: `docs/screens/*.png` e `?gallery&theme=<id>`. Se precisar de captura nova, use no máximo 2, na SUA porta: sirva uma CÓPIA do `dist` construído numa pasta sua do scratchpad, com `python3 -m http.server PORTA`. Mate o servidor pelo PID com `kill`, nunca com `pkill -f`.
- Não edite o repositório e não faça commit.

## O que entregar
Um relatório em `scratchpad/temas/<id>.md`, em português simples, com até ~150 linhas:
1. **Identidade em uma frase**: lugar, época e o que a pessoa deve sentir.
2. **Os 6 terrenos reinterpretados**, ou seja, o que cada borda vira neste tema. Os nomes de hoje estão em `terrainNames`. Deixe claro o que muda de forma, e não só de cor. Os campos podem virar outra coisa, como na Holanda as tulipas.
3. **Construções**: tipos de casa e silhuetas (com o vocabulário de `types.ts` e os estilos novos que forem precisos), marcos, construções das interações (`synergy`), portal, ponte e as eras da vila (o que muda da era I à III).
4. **Vegetação, animais, barcos e veículos**, e o que se move (`life.ts`).
5. **Água, entorno (`surround`), clima, hora do dia, paleta, gradação e som** (o que muda em `audio.ts`).
6. **Easter eggs**: 3 a 5, cada um com como dispara (combinação de peças, hora, data, número de peças) e o que aparece, sempre determinístico pela semente quando for visual na peça.
7. **Do que vem dos temas que somem**: o que aproveitar, o que descartar e por quê, se o tema for uma fusão.
8. **Lista de trabalho**: kits novos (tipo P, M ou G, triângulos estimados e se precisam de draw call novo), campos novos no schema de `Theme`, e o que é só dado. Ordem sugerida de implementação.
9. **Riscos**: legibilidade (`tests/legibility.ts`), orçamento e invariantes.

Termine respondendo só com o caminho do relatório e as 3 ideias mais fortes, em uma linha cada.
