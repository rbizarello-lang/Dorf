# Critérios de decisão

**Texto fixado em 2026-10-16. Não pode mudar depois do teste.**

## Decisão (só pessoas contam)

Valem para a versão B (enxuta). Quem decide é o Roger e as pessoas de fora, jogando de verdade.

- (a) O Roger começa uma 2ª partida sem ninguém pedir.
- (b) A primeira jogada certa sai em menos de 60 s, sem ajuda.
- (c) Ele explica, com as próprias palavras, pelo menos 4 das 6 regras da B.
- (d) A partida dura no máximo 15 min.
- (e) Às cegas (sem saber qual é A e qual é B), a B vence se o Roger e pelo menos 1 de 2 pessoas de fora a preferirem.

## Parada

Se, depois de 2 rodadas, nenhuma versão fizer o Roger voltar sozinho em outro dia, a Ilha para e o esforço vai para a Província.

## Simulador (só para pegar erros; não decide nada)

Valem para a B (e, com seus números antigos, continuam valendo para a A):

- o planejador faz pelo menos 1,2x a pontuação do aleatório;
- escolha apertada entre 25% e 65%;
- 0 partidas travadas;
- nenhuma peça passa de 45% das escolhas do planejador.

Estes quatro viram asserções em `tests/simB.ts`. O relatório está em `docs/simulacao.md`, seção "Versão B".
