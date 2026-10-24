# Rodada 3: relevo (só pesquisa e proposta, sem mudar código)

O Roger perguntou: "O que acha de adicionar diferenciação de relevo? Montanhas, cachoeiras etc. Explore essa ideia."

## Material
- Código em `/home/user/Dorf` (main). Leia `AGENTS.md` inteiro: invariantes 1 a 13, o orçamento, a emenda de rio (`widthsAt`, `flowAt`), o mapa do chão, o `seaMap`, a costura de cor e os blocos estáticos.
- `src/core` (regras puras: `tiles.ts`, `board.ts`, `game.ts`, `synergy.ts`), `src/render/tileBuilder.ts` (chão, leito, água, laterais), `world.ts`, `materials.ts` (água e chão), `cameraRig.ts`, `life.ts`.
- A referência é o print do Dorfromantik em `/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/images/4.webp`, sem montanhas. Na ilha hexagonal de `images/2.jpg` há montanhas com cachoeira. Veja também `images/1.webp`, do Weatherglass, com montanhas, cachoeira e lago.
- Não edite o repositório e não faça commit.

## Perguntas a responder
1. **Que formas de relevo cabem no jogo?**
   - (a) Só decoração: morros e montanhas como kit de decoração dentro de uma peça, sem mudar regra nenhuma.
   - (b) Altura por peça: o terreno sobe em degraus, e cachoeiras aparecem onde o rio desce de uma peça alta para uma baixa.
   - (c) Um terreno novo de Montanha, com regras próprias (borda estrita ou não, pontuação, interação com rio, mina etc.).
   - Para cada uma, diga como fica na tela, como encaixa nas regras e no `core`, e o efeito no replay e no `SAVE_VERSION`.
2. **Emendas.** Com altura por peça, como casar as laterais, os rios, as estradas e a ferrovia entre peças de alturas diferentes, sem quebrar o determinismo (a peça é montada antes de os vizinhos futuros existirem)? Pense em como `widthsAt`/`flowAt` resolvem o rio hoje.
3. **Cachoeiras.** Como desenhar e animar: geometria, material TSL da água já existente, espuma, partículas e som. E onde aparecem.
4. **Câmera, sombras, legibilidade e "Onde encaixa"**: o que muda com o relevo.
5. **Custo**: triângulos, draw calls e CPU de montagem, contra o orçamento.
6. **Temas.** Como o relevo serve aos 5 temas novos (Holanda, Egito, Oriental, Brasil, Inverno Nórdico)? Por exemplo: Holanda plana com diques, Oriental com montanhas e terraços, Nórdico com fiordes, Egito com falésias do Nilo, Brasil com serras e cachoeiras. Diga se o relevo deve ser dado do tema.
7. **Recomendação**: qual caminho seguir, em etapas (P, M ou G), com o "pronto quando" de cada uma, e o que NÃO fazer.

Grave o relatório em `scratchpad/temas/relevo.md`, em português simples, com até ~150 linhas. Termine respondendo só com o caminho e a recomendação em 3 linhas.
