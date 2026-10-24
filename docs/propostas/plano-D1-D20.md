# Plano Dorf: etapas D1 a D20

Fonte: última mensagem do assistente nos eventos da sessão session_0155ezye52RVVVRdd5CuUrB8 (created_at 2026-10-14T03:32:45Z). Não há arquivo nem link de artifact citado com o plano. Os 5 jogos novos foram deixados de fora, como pedido.

## Cabeçalho para colar em todo pedido

> Parta da `main` atualizada. Leia o AGENTS.md. Faça um PR por etapa. Rode `npm run check` e `npm run smoke` antes do commit. Se mexer em `src/render/`, gere capturas antes e depois com `node scripts/shot.mjs` e a mesma `?seed=`, e informe no PR os números de `RUNS=300:high node scripts/stress.mjs`. Não mexa em `src/core` sem que a etapa peça. Não use arte externa.

## Mapa em ordem de valor para o esforço

- **Leveza:** D1, D2, D3, D6, D7, D8, D9, D19.
- **Jogabilidade:** D4, D10, D11, D12, D17, D18.
- **Visual (referências):** D9, D10, D13, D14, D15, D16.
- **Base para o resto:** D5 (comparação de capturas) e D20 (dívidas).

---

**D1 · `?bench` (P)**
- **Fazer:** a partir do `window.__perf` que já existe em `main.ts`, criar `?bench`. Ele monta `seed=7&auto=60`, passa por Baixa, Média, Alta e Ultra, com 15 segundos de câmera girando em cada nível, e mostra uma tabela: placa, nível, FPS mediano, p95 em ms, draw calls. Inclua um botão "copiar".
- **Por quê:** medir antes de cortar.
- **Pronto quando:** a tabela aparece em menos de 2 minutos; o `scripts/smoke.mjs` abre `?bench` sem erro no console.

**D2 · Economia de quadros no computador (P)**
- **Fazer:** estender o `saveBattery` de `main.ts:1324` ao computador. Depois de 4 segundos sem entrada e sem peça caindo, desenhar a 30 quadros por segundo; depois de 15 segundos, a 20. Com a janela sem foco (`blur`), 20. Passar a regra para uma função pura com teste.
- **Por quê:** parado, o jogo gasta a GPU inteira.
- **Pronto quando:** os testes da função passam e o `?debug` mostra a taxa cair quando o jogo fica parado. Não pode haver salto ao voltar a mexer: o mundo anda pelo `dt`, invariante 13.

**D3 · Auto prudente (P)**
- **Fazer:** em `main.ts:1039`, placa desconhecida no computador passa a começar na **Alta**. Revisar `gpuTier.ts` para placas integradas, com testes em `tests/video.ts`.
- **Pronto quando:** os testes passam com casos novos (vazio, Intel UHD, Iris Xe, Radeon Graphics).

**D4 · Instalar e guardar com segurança (M)**
- **Fazer:**
  - manifesto e service worker para o jogo funcionar sem internet, compatíveis com o build de arquivo único;
  - `navigator.storage.persist()` depois da primeira partida;
  - exportar e importar `retalhos.*` num arquivo `.json`, validado campo a campo, no Almanaque.
  - Módulo isolado (`src/ui/storage.ts`), para os jogos novos copiarem.
- **Pronto quando:** um teste de ida e volta passa; o Chrome mostra "Instalar"; o jogo instalado abre com o modo avião ligado.

**D5 · Comparação de capturas (M)**
- **Fazer:** o `scripts/shot.mjs` passa a gravar 6 capturas de referência fixas e compara a diferença por pixel com uma tolerância. Rodar à mão, fora da CI (o SwiftShader varia).
- **Por quê:** as etapas visuais seguintes precisam de um "antes e depois" objetivo.
- **Pronto quando:** rodar duas vezes seguidas dá diferença abaixo da tolerância.

**D6 · Sombra guardada no Ultra e no Cinema (P–M)**
- **Fazer:** com as cascatas, refazer a sombra só quando o sol se move, uma peça assenta ou a câmera anda além de um limite. Hoje ela é refeita a cada quadro.
- **Pronto quando:** num quadro parado, o passe de sombra não desenha nada (medir com `renderer.info`); D5 sem diferença visível.

**D7 · Cinema só para foto e vídeo (P)**
- **Fazer:** o seletor em tempo real vai até o Ultra. A foto (`capture.ts`) liga o Cinema na hora de tirar e volta ao nível anterior; o vídeo já desenha quadro a quadro.
- **Por quê:** o Cinema desenha 2,25× mais pixels (`SUPERSAMPLE` de 1,5).
- **Pronto quando:** a foto sai em qualidade Cinema mesmo com o jogo na Alta.

**D8 · Ultra mais barato (M; o Roger escolhe vendo as capturas)**
- **Fazer:** no Ultra, trocar a luz indireta SSGI pela oclusão GTAO em meia resolução mais a luz rebatida do chão (`groundMap`), que já existe. Trocar o reflexo na água (SSR) pelo reflexo do céu com fresnel. Deixar os raios de luz só no Cinema.
- **Pronto quando:** o `?bench` mostra o Ultra pelo menos 30% mais leve, e o Roger aprova 3 pares de capturas lado a lado.

**D9 · Desfoque de miniatura (tilt-shift) no lugar da profundidade de campo (P–M)**
- **Fazer:** em `post.ts`, um desfoque em meia resolução que cresce para o alto e para o pé da tela, nas qualidades Alta e Ultra. Deixar o desfoque atual (`dof`) só no Cinema.
- **Por quê:** é mais barato e dá o ar de diorama das referências.
- **Pronto quando:** custo menor no `?bench` e captura aprovada.

**D10 · Interface calma (P)**
- **Fazer:**
  - as missões viram um único cartão que abre a lista (o celular já faz assim);
  - bandeiras menores, que só aparecem perto da missão;
  - uma opção "interface mínima", ligada por padrão, que esconde o almanaque e o brasão do HUD.
- **Pronto quando:** a captura do Vale mostra, além do placar, no máximo um cartão.

**D11 · "Onde encaixa" (P)**
- **Fazer:** um botão e a tecla `?` destacam as 3 melhores casas da peça atual, com os pontos de cada uma. Precisa de uma função de ranking determinística em `src/core`, porque `bestMove` usa `Math.random` de propósito. Não muda o replay.
- **Pronto quando:** um teste mostra que a 1ª sugestão é a jogada de maior pontuação.

**D12 · Partida rápida (P)**
- **Fazer:** modo de 30 peças em `modes.ts`, com recorde próprio.
- **Pronto quando:** a média da IA fica em 12 minutos ou menos (estimativa de 20 a 25 segundos por peça) e os testes do modo passam.

**D13 · Mar em volta da ilha (M)**
- **Fazer:** o tema escolhe o entorno do tabuleiro: `surround: 'mar' | 'pergaminho' | 'areia'`. É só dado (invariante 8). O mar é um plano de água raso em volta das peças, com espuma onde ele encontra as laterais e uma faixa de areia nas bordas externas. O pergaminho fica para longe.
- **Por quê:** é a maior mudança de identidade na direção do jogo de ilha e do Koastalia.
- **Pronto quando:** capturas do Vale, do Egito e de Marte aprovadas; no máximo 2 draw calls a mais; smoke verde.

**D14 · Luz de vitrine (P–M)**
- **Fazer:** uma gradação "vitrine" com sombra mais suave e clara, luz de preenchimento morna e um leve reflexo de vidro nas bordas da tela (opcional). Testar no Vale primeiro.
- **Pronto quando:** o Roger aprova a captura comparada com o Weatherglass.

**D15 · Vilas em quarteirões (M–G)**
- **Fazer:** em `tileBuilder.ts`, menos casas e maiores, agrupadas em volta de ruas e de uma pracinha, ainda deterministas pela semente (invariante 3).
- **Pronto quando:** `tests/legibility.ts` passa, `?silhueta` lê melhor e o número de triângulos não sobe.

**D16 · Clima tocável (M)**
- **Fazer:** clicar no céu ou num botão faz passar chuva, neve ou sol por 30 segundos, com som. Reaproveitar o clima por tema que já existe em `fx.ts`.
- **Pronto quando:** funciona nos 14 temas sem erro no console.

**D17 · Desafio do dia com regra do dia (M)**
- **Fazer:** a regra sai da data, de forma determinista. No fim, o resultado em texto para compartilhar (`Retalhos 14/10 · 1.240 · 🌲🌾🏘`) e o link.
- **Pronto quando:** a mesma data dá a mesma regra nos testes, e o texto vai para a área de transferência.

**D18 · Modos fracos (P–M; decisão do Roger)**
- **Fazer:** nos Exploradores, sítios mais perto ou mais peças, até a IA achar os 10 em pelo menos 50% das partidas do `tests/balance.ts`. A Estrada Real vai para "Mais modos" até ser equilibrada.
- **Pronto quando:** o relatório de equilíbrio mostra a meta.

**D19 · Árvores leves de longe (M)**
- **Fazer:** cartões (impostores) além da faixa `~`.
- **Pronto quando:** pelo menos 20% menos triângulos no `stress.mjs` no zoom aberto, com D5 aprovado.

**D20 · Dívidas (M)**
- **Fazer:** quebrar o `main.ts` em módulos (fluxo da partida, menus, ganchos de depuração) sem mudar o comportamento. Atualizar o AGENTS.md. Apagar as branches antigas, com o ok do Roger.
- **Pronto quando:** `check` e smoke verdes, D5 sem diferença e AGENTS.md sem trechos desatualizados.
