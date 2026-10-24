# E3: relevo na peça (altura que encaixa)

Pedido do Roger: a altura deixa de ser enfeite da casa e passa a ser da PEÇA. Cada peça sorteada traz o seu relevo, e quem joga escolhe onde e em que giro encaixá-la. A altura da borda entra no encaixe, como o terreno.

## Base comum aos seis desenhos

- **Perfil da peça:** seis alturas (uma por borda/setor, nível 0 a 2) mais a altura do pico no meio. Sai de um gerador à parte, derivado só da semente da peça e das bordas (`tileProfile`, `src/core/relief.ts`). Não mexe na sequência de peças nem no replay dos outros modos.
- **Formas sorteadas:** plana (34%), morro no meio (8%), barranco (uma borda alta), canto, meia (metade alta), rampa (alta numa ponta, baixa na outra), espinhaço, sela (duas bordas altas opostas) e vale (uma borda baixa). Em todas, setores vizinhos diferem no máximo 1 degrau.
- **Rio e trilho:** peças com água ou trilho saem planas (água e trilho não atravessam um penhasco dentro da peça). Rio no nível 1 em 80%, trilho sempre no 1.
- **Na tela (todos):** chão em degraus por setor, com parede de penhasco entre setores e nas bordas; a rampa de estrada, o penhasco e a cachoeira da R2/R3 são reaproveitados.

## Desenho A: a borda precisa casar (±1)

- **Regra:** vizinhos diferem no máximo 1 nível; 2 níveis não encaixam. Trilho exige igual.
- **Sorteio:** o perfil acima.
- **Tela:** o fantasma marca em azul a borda com degrau e em vermelho a que não casa.
- **Risco de travar:** médio. Com a base concentrada no nível 1 só 0 contra 2 conflita (~18% por emenda entre peças planas). Descarte da pilha resolve o resto.
- **`src/core`:** `Rules.relief`, `Board.check` ganha `heights`, `Placed.heights`.
- **`SAVE_VERSION`:** não, é modo novo (os outros replays ficam idênticos).
- **Invariante 15:** convive; o modo desliga os platôs da semente.

## Desenho B: degrau pontua (mirante) e queda de rio pontua (cachoeira)

- **Regra:** A mais `stepPoints` por borda com degrau de 1 nível e `fallPoints` por degrau de rio. Dá motivo para procurar o desnível, não só evitá-lo.
- **Risco:** nenhum de travar; risco de equilíbrio (inflação de pontos). Medir no `npm run balance`.
- **`src/core`:** `Check.steps/falls`, dois campos em `Rules`. Oráculo reescrito em `tests/logic.ts`.
- **Save:** não (modo novo). **Invariante 15:** soma ao A.

## Desenho C: a água só corre para baixo

- **Regra:** rio só emenda com rio de altura igual ou 1 nível abaixo, com o sentido da correnteza forçado. O núcleo não conhece a correnteza (é do render), então exigiria mover `flowAt` para `src/core`.
- **Risco:** alto (rios sem saída, lago só).
- **Save:** sim, se a correnteza entrar na regra. **Invariante 15:** compatível; não recomendado agora.

## Desenho D: vila gosta de alto, plantação de baixo

- **Regra:** bônus por vila em setor de nível 2 e por plantação em nível 0, ligado ao terreno de cada borda.
- **Risco:** baixo de travar, alto de dominar o jogo (o jogador só caça nível). Pede nova tabela no tema (invariante 8).
- **Save:** sim se entrar nos modos atuais. Em modo novo, não.

## Desenho E: vento e sombra

- **Regra:** moinho em nível alto rende mais; vila na sombra de um paredão ao sul perde pontos. Exige simular o sol no núcleo, que não conhece hora do dia.
- **Risco:** alto (ruído), pouco legível. Não recomendado.

## Desenho F: só visual, a altura continua da casa (o que existe hoje)

- Sem regra, sem risco, sem decisão nova para quem joga. É o ponto de comparação.

## Recomendação: A + B (modo Relevo)

- É o menor conjunto em que a altura decide a jogada: o encaixe restringe, o degrau recompensa.
- Fica atrás de `more: true`, os outros modos não mudam e nenhum replay antigo muda.
- O trilho e a praça central ficam planos, então o que já funciona (vida, veículos, centro da vila) não precisa mudar.
- Próximo passo se o Roger gostar: C (rio desce) com a correnteza movida para o núcleo.

## Protótipo (modo Relevo)

- Regras: `src/core/relief.ts`, `board.ts`, `game.ts`, `modes.ts`.
- Oráculo independente: `tests/logic.ts` (encaixe de altura, degraus e quedas recalculados sem o Board); perfis em `tests/relief.ts`.
- Equilíbrio: `npm run balance` contra o Clássico (resultados no relatório).
- Desenho: setores em degraus, penhasco nas bordas altas, fantasma com marcas de altura, pilha mostra o relevo.
