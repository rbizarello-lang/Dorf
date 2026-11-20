# Baías internas no Relevo e na Terra

Branch `astra/baias-internas`, implementação `f702699`, base `dorf/e5-encostas` em `bd371dc`.
O pé da saia do terreno e a linha de espuma agora fazem a curva nas casas vazias cercadas por cinco ou seis vizinhas. Com uma boca, o arco acompanha a margem e a lâmina de água se liga ao mar. A orla comum mantém o perfil original.
O contorno acompanha a chegada da quinta ou sexta vizinha, o preenchimento da casa e a reconstrução da partida. As saias continuam partindo das mesmas divisas e a película da boca dos rios permanece no lugar.
O ajuste vale no desenho fluido com Encostas. Uma abertura com duas ou mais saídas, ou um vazio maior sem casa cercada por cinco vizinhas, conserva o desenho da costa comum.

## Verificação

`npm run check` passou, com 600 partidas simuladas e testes do arco, da boca em seis direções, da película de rio e da cobertura pelo fantasma. A revisão de quatro anéis com riachos ou terreno seco confirmou o encontro das saias nas seis bissetrizes e igualdade dos mapas de chão após o assentamento e a reconstrução.

As nove verificações do smoke passaram em WebGPU e WebGL2 com o HTML lido do disco. O `npm run smoke` no servidor local expirou na abertura do primeiro cenário. No teste interativo da qualidade Alta em WebGPU, alguns pousos e recarregamentos emitem um erro de buffer destruído que também ocorre na base `bd371dc`. O erro apareceu após a E7 em uma comparação com o mesmo replay em `91084f3`.

Os três percursos de navegador confirmaram a rotação por teclado, a prévia, a colocação com clique, o recarregamento com a casa ocupada, o desfazer e o novo recarregamento. Os placares foram 311 → 382 → 311, 568 → 626 → 568 e 546 → 738 → 546. Em Chrome com toque simulado, 390 × 700 e WebGL2, o primeiro toque abriu a prévia na baía da Terra e o segundo confirmou a peça com os 71 pontos previstos.

As capturas usam a Holanda Dourada, nas mesmas posições e câmeras antes e depois. Na Terra, semente 16, 15 peças e casa `(2,0)`, a baía tem uma boca. No Relevo, semente 16, 20 peças e casa `(2,-2)`, há seis vizinhas. A Terra da semente 4, casa `(-3,2)`, verifica duas entradas de rio na baía. Compare a linha d’água e o pé da encosta. O tracejado dourado continua mostrando a área de influência do encaixe.

- [Baía aberta, lago interno e controle da costa](prancha-baias.jpg)
- [Prévia, preenchimento, desfazer e recarregamento](prancha-percurso-baia.jpg)
- [Bocas dos rios e orla externa](prancha-controles-baia.jpg)

| Modo, 301 peças na Holanda, semente 42 | Montagem (ms) | Chamadas de desenho | Triângulos |
|---|---:|---:|---:|
| Terra, base → correção | 2.849 → 2.949 | 168 → 116 | 1.798 mil → 1.451 mil |
| Relevo, base → correção | 3.574 → 4.119 | 168 → 168 | 1.803 mil → 1.795 mil |

Stress em Alta com WebGL2 por software. As chamadas e triângulos são amostras de um quadro, com variação entre passes de sombra e de pós-processamento. A montagem do Relevo subiu 15% nesta amostra, sob carga de verificações concorrentes. Os números não medem FPS nem isolam o custo da curva. Nas capturas em hardware, os triângulos do chão ficaram em 29.818 → 29.578 na baía da Terra e 40.141 → 39.541 no lago do Relevo.

## Prévia

`VITE_PREVIEW=relevo npm run build` gera o HTML jogável em `dist/index.html`. Sem hash, abre no Clássico. Use `#mode=terra` ou `#mode=relevo` para jogar a prévia de cada modo. `node scripts/artifact.mjs` gera o fragmento `dist/artifact/retalhos.html`, no formato usado para publicação.
