# Entrepostos no Dorf

O modo Entrepostos começa com 24 peças para abastecer três cais pela rede de água da vila. Em **Nova → Entrepostos**, escolha Confluência, Rio bifurcado ou Cais da enseada e um dos dois fretes.
No contrato Madeira para a Feira, a Serraria recebe seis peças. A Feira recebe dez com a ligação da Serraria antes ou no mesmo turno. Se a Feira se ligar primeiro, aguarda a Serraria e recebe quatro.
Os cais têm construções próprias e a animação das barcas segue a rota calculada pelo jogo. Carta, contrato e peças especiais entram no save. Desfazer reconstitui o frete pelo replay. Cada carta e frete tem recorde próprio por tema.
A branch `astra/entrepostos-modo` integra a `main` do PR #117, com a E7b, E8 e as baías. A Aldeia na crista e seus três lotes fixos pertencem à edição independente `jogo-entrepostos`.

## Verificação

- `npm run check` passou na integração. O TypeScript, as baías e as demais suítes passaram, com 720 replays completos e 7.920 parciais sem divergências.
- O oráculo dos fretes percorreu 72 viagens dirigidas nos seis pares de carta e frete. Conferiu caminho da água, ordem dos pagamentos, prévia, pontos, pilha e replay em 993 jogadas. A amostra usa uma estratégia dirigida de teste.
- **Viagens no navegador.** Na Holanda, semente 42, Confluência/Madeira levou 14 jogadas em WebGPU/Alta na RTX 3060. Ligar a Feira primeiro a deixou esperando pela Serraria. O jogo pagou 4, 6 e 8 peças, com 718 pontos no fim, dos quais 560 vieram da pilha. No Rio bifurcado/Madeira em WebGL2, a Serraria chegou primeiro. O jogo pagou 6, 10 e 8 peças em 14 jogadas, com 858 pontos no fim, dos quais 680 vieram da pilha. Os roteiros conferiram recarga e desfazer antes da última entrega. [Prancha após as duas primeiras entregas](prancha-entrepostos.jpg)
- Uma partida real v13 da base foi retomada e desfeita em v14. O menu de Entrepostos leu recordes distintos ao trocar de carta e frete. O teste de save rejeitou uma carta inválida.
- **Regressão WebGPU.** Em Terra contínua, Holanda, semente 16, qualidade Alta e RTX 3060, o preenchimento de (2,0) levou o tabuleiro de 15 peças e 311 pontos a 16 peças e 382 pontos. A recarga manteve o resultado e desfazer voltou a 311 pontos. A recolocação reproduziu os 382 pontos. Zero mensagens de buffer destruído no controle `5b9b9ed` e no candidato. O controle histórico anterior à E7b reproduziu 94 avisos.
- **Smoke.** A matriz da CI ganhou um caso de Entrepostos em WebGPU e um em WebGL2 por hash. No Windows de teste, o SwiftShader abriu os casos esperados em WebGPU com o backend WebGL2. Os ensaios de viagem e Terra acima foram feitos no Chrome com WebGPU nativo.
- **Trajeto das barcas.** Uma amostragem geométrica de 24 fretes achou cerca de 1% dos pontos fora da malha de água, principalmente em emendas e na chegada ao Estaleiro no Rio bifurcado de semente 8. A amostragem mede a geometria num tabuleiro plano. Os pagamentos usam as conexões lógicas entre as bordas de água.
