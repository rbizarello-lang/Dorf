# Guanabara e Chamonix

Na branch `astra/temas-guanabara-chamonix`, dois temas entram no seletor de Retalhos, cada um com seu nome, paleta, trilha e recordes. Ambos usam os kits procedurais existentes e as regras padrão do modo escolhido.

- Guanabara reúne restinga, morros de granito, casario claro e veleiros na orla. [Prancha](guanabara.jpg)
- Chamonix reúne chalés escuros, hospedarias claras e uma ferrovia a vapor no vale verde, com neve nos cumes. [Prancha](chamonix.jpg)

As pranchas registram o jogo em Alta, com a mesma semente (7) e câmera, sobre `5017a19`. A entrega já inclui a atualização dos canais da `main` (`721bde7`, #125).

Para reproduzir a composição, sirva o `dist` e abra `/?theme=guanabara&seed=7&auto=60&quality=high&time=day&zoom=10` ou troque `guanabara` por `chamonix`. O teste de fumaça confere o nome exibido, nove peças e o renderizador em Guanabara (WebGPU) e em Chamonix no modo Terra contínua (WebGL2).

Os dois casos passaram no Chrome local com a RTX 3060, com 41 chamadas de desenho em Guanabara e 40 em Chamonix na qualidade Baixa. Na execução com SwiftShader, o Chrome local caiu para WebGL2 nos casos que pediam WebGPU. A CI usa o Chromium em Linux para verificar esse caminho.
