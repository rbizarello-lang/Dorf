# D50: textos do fim de partida e ajustes de interface

Capturas em 1000×760 ou menores, WebGL2 por software (`&webgl`, `quality=low`), semente 7. "Antes" vem do build da `main` antes da etapa; para o menu de modos e o fim de Entrepostos o "antes" são as imagens 13 e 14 da avaliação (`../avaliacao-autonoma/`).

| Item | O que mudou | Capturas |
|---|---|---|
| P2.1 recorde | `noteBest()` (main.ts) guarda o recorde também no fim; a tela usa `record = !special && ...`. Bateu o recorde: "Recorde anterior em ...: N pontos." (ou "Primeiro recorde ..." sem anterior). Não bateu: "Recorde em ...: N pontos (semente S)". Partida de teste (`?auto`, `?stress`, `?demo`, `?bench`): título "Pilha vazia", sem linha de recorde. Sem recorde nenhum, a linha some (não há mais "0 pontos (semente 0)"). Conferido jogando de verdade na Partida rápida com `__placeBest()`, com recorde prévio de 100: "Novo recorde!" e "Recorde anterior ... 100 pontos". | `antes-fim-rapida-auto`, `depois-fim-rapida-auto`, `depois-fim-rapida-real` |
| P2.2 plurais e itens | `src/ui/plural.ts` (`plural`, `pluralWord`): "1 interação", "1 entrega", "1 ponto" etc. O quadro de missões só aparece em modo com missões (`maxQuests` e `questChance` > 0); "N de M sítios" só com sítios no modo; `.final` agora tem uma coluna por quadro (sem célula vazia). Conferido em Clássico, Exploradores, Entrepostos (`__over()`) e Partida rápida (fim real e `?auto`). | `depois-over-classico`, `depois-over-exploradores`, `depois-over-entrepostos` |
| P2.7 debug | O painel `.stats` foi para o meio da borda esquerda e não cobre mais o cartão de pontos. | `antes-debug`, `depois-debug` |
| P3.8 800×600 | Entre 521 e 900 px, o nome do tema vira só a pastilha de cores, os rótulos longos viram os ícones que o celular já usa (o `title` continua) e botões e espaços ficam menores: a barra cabe numa linha. Nada some. | `antes-800x600`, `depois-800x600` |
| P3.9 menu de modos | `.modal:has(.modes)`: fundo a 68% de tinta e leve desfoque, só nesse diálogo. | `depois-menu-modos` (antes: imagem 14 da avaliação) |
| P3.10 contador | De propósito, não é erro nem ícone: `setStack` (hud.ts) põe a classe `low` com 5 peças ou menos e o CSS pinta o número de vermelho. Só deixei um comentário no CSS. | imagem 13 da avaliação |

Observação: a linha "Peças especiais a liberar" do fim de partida segue como estava (fora do escopo).

## Verificação
- `npm run check` verde (depois do merge da `origin/main`, que trouxe a D49 e o #126).
- `npm run smoke`: todos os casos WebGL2 ok; os casos WebGPU (`webgpu`, `webgpu-alta`, `webgpu-ultra`, `hash-invalido`, `bench`, `relevo`, `terra`, `entrepostos`, `vida-dos-buffers`) falham por "WebGPU Device Lost" do SwiftShader, problema do ambiente.
- Console sem erros em todas as capturas.
