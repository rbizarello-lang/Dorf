# E7: limite de buffers de vértice no WebGPU

## O problema
O WebGPU aceita 8 buffers de vértice por malha (`maxVertexBuffers`). No three r186 só conta o que o material lê, e cada atributo solto da geometria é um buffer, mais o `iColor` e a matriz da instância. Com mais de 1000 instâncias o `InstancedMesh` deixa de usar o buffer uniforme e a matriz vira um buffer de vértice, e o passe de velocidade do TRAA (Alta e Ultra) pede também a matriz anterior: 2 buffers.

As árvores têm `position`, `normal`, `vol`, `color`, `tint`, `glow` e `iColor`: 7 buffers, e com a matriz e a matriz anterior, **9**. O pool de árvores mais usado do tema passa de 1000 instâncias por volta de 300 peças (Holanda: álamo; Egito: palmeira; Inverno: conífera). Aí o pipeline do passe de velocidade não nasce e a árvore some ou dá erro. É o que o Astra viu na RTX 3060. Plantações, capim e flor ficam em 8 (no limite); casas, telhados e o resto, em 6.

Não é culpa da Paisagem viva nem das Encostas: a `origin/main` também passa de 8 (Zen, Alta, 300 peças, Holanda: `tree:poplar` com 9). A correção mexe só no `instGeometry` e pode ir para a `main` por um PR à parte.

## O gancho `?vbuf` / `window.__vbuf(n)`
`src/render/vbuf.ts` embrulha o `createRenderObject` do renderizador e guarda os `RenderObject` vivos. O relatório pergunta a cada um quantos buffers de vértice o pipeline usa (`getVertexBuffers`, a mesma conta que o WebGPU faz) e devolve as malhas com `pior >= n` (padrão 7): `{ key, n, pior, attrs, material }`. `n` é o valor real naquele momento (por passe: cena, sombra, velocidade). `pior` é o caso com mais de 1000 instâncias e TRAA (buffers da geometria + 2), para pegar o problema sem precisar de 300 peças. Não depende do backend: roda em WebGL2 e nesta máquina.

## A correção
`instGeometry()` (`src/render/lib.ts`) agora intercala os atributos float do kit (`position`, `normal`, `color`, `tint`, `glow`, `vol`...) num `InterleavedBuffer` só por geometria-base (cache em `WeakMap`). Os nomes e a leitura nos materiais não mudam (o `InterleavedBufferAttribute` responde ao mesmo `attribute('tint')`), então o visual não muda. Cada kit passa a usar 1 buffer da geometria + `iColor` + 2 da matriz = **4**, com 4 de folga. Nenhum material, kit nem atributo de instância foi tocado. O AGENTS.md (invariante 9, ganchos de URL, mapa de testes) foi atualizado.

## Malhas acima de 8, antes e depois
Alta ou Ultra, `auto=300` (o Clássico, o Relevo e a Terra acabam antes, por falta de peças na pilha), WebGL2, SwiftShader. `n` = buffers de vértice reais.

| Cenário | Antes | Depois |
|---|---|---|
| Zen `viva=1`, Holanda, Alta, 301 peças | `tree:poplar` **9** (passe de velocidade); 8 em `crop:barley`, `crop:wheat`, `crop:bulb`, `crop:tulip`, `flower`, `grass`; 7 nas outras árvores e arbustos | nenhuma malha com pior caso de 7 ou mais (máximo 4) |
| Zen `viva=1`, Egito, Ultra, 301 peças | `tree:palm` **9**; 8 em 6 pools de plantação e flor | idem |
| Clássico, Oriental, Alta, 102 peças | máximo 8 (1 plantação); árvores em 7 (pior caso 9) | idem |
| Relevo `viva=1`, Brasil, Alta, 127 peças | máximo 8 (2 pools); árvores em 7 (pior caso 9) | idem |
| Terra `viva=1`, Inverno, Alta, 72 peças | `tree:conifer` **9** | idem |
| `origin/main`, Zen, Holanda, Alta, 301 peças | `tree:poplar` **9** | (não corrigida aqui) |

Chão, água e cachoeira têm geometria própria, fora do `instGeometry`, e não aparecem acima de 6.

## Proteções
- `tests/vbuf.ts` (dentro do `npm test`, só Node): para os 5 temas, 478 kits (inclusive as versões leves), conta os buffers de `instGeometry` + `iColor` + 2 de matriz. Falha acima de 7 e confere que o intercalado devolve os mesmos valores. Máximo hoje: 4.
- `scripts/smoke.mjs`, caso `buffers-de-vertice`: Holanda, Zen, `viva=1`, Alta, 60 peças, `&vbuf&webgl`; falha se `__vbuf(9)` achar malha com `pior` de 9 ou mais. Roda em WebGL2, então vale aqui e na CI. Conferido contra o build antigo: ele acusa `tree:poplar`, `puff`, `oak`, `birch` (pior caso 9) já com 60 peças.

## Visual e custo
- `npm run compare` em WebGL2, Baixa (o Auto do SwiftShader, sem grão): antes contra depois, **todas as 6 vistas dentro da tolerância** (maior: `zoom-aberto` 0,250% e média 0,098; `rio-perto` 0,071%; `vila-perto` 0,000%). Ruído do mesmo build contra ele mesmo: 5 vistas dentro da tolerância e `rio-perto` fora (2,03% e média 0,87, partícula solta), então a medida tem esse ruído.
- Em Alta, WebGL2, o grão de filme muda a cada quadro: a média fica em ~2,3 mesmo com o mesmo build contra ele mesmo, e a tolerância padrão (0,5) não se aplica. Antes×antes e antes×depois dão o mesmo (`holanda` 0,074% e 2,41 contra 0,069% e 2,41; `zoom-aberto` 0,269% e 2,44 contra 0,252% e 2,43). A diferença em `rio-perto` e `vila-perto` é partícula solta (conferido na imagem de diferença).
- Stress `300:high` em WebGL2, antes e depois: 117 draw calls, 1255 mil triângulos e 72.425 instâncias nos dois.
- Em tempo de CPU por quadro não há ganho nem perda mensurável aqui (o SwiftShader dá ruído).

## Verificação
- `npm run check` verde (inclui `tests/vbuf.ts`).
- `npm run smoke`: os casos WebGL2 passaram (`webgl`, `relevo-webgl`, `terra-hash-webgl` e o novo `buffers-de-vertice`). Os casos WebGPU falham aqui por ambiente: o SwiftShader perde o dispositivo (`Instance dropped in popErrorScope`) antes de qualquer outra coisa, e isso acontece também na base. O WebGPU não foi exercitado nesta máquina: a conclusão vem da contagem, que é a regra do WebGPU.
- Falta confirmar numa GPU real (RTX 3060, Alta, 300 jogadas em WebGPU) que as árvores não somem mais.

## E7b: buffer destruído no WebGPU (issue #115)

**Causa (confirmada no código do three r186).** `Geometries.js` (`onDispose`) chama `attributes.delete` em cada atributo da geometria descartada; `Attributes.delete` chama `backend.destroyAttribute`, que em `WebGPUAttributeUtils` faz `backend.get(_getBufferAttribute(attribute)).buffer.destroy()`. Para um `InterleavedBufferAttribute` o dono é `attribute.data` (o `InterleavedBuffer`). Com um buffer por geometria-base dividido entre todos os lotes do kit, descartar UM lote (`Pool.retarget`, lote refeito, peça viva depois do pouso: `LiveTile`) destruía o buffer que os outros ainda desenhavam. Pior: `backend.delete(attribute)` só apaga o registro do atributo-fatia, e o registro do `InterleavedBuffer` guarda o buffer já destruído, então ele nem era recriado. Com `BufferAttribute` soltos (antes da E7) a entrada do próprio atributo caía e era recriada no quadro seguinte.

**Correção.** `interleaved()` em `src/render/lib.ts` guarda por geometria-base só o array intercalado em CPU (`packedOf`) e cria um `InterleavedBuffer` novo a cada `instGeometry`, apontando para o mesmo `Float32Array`. Cada geometria tem o seu buffer de GPU; descartar uma destrói só o dela. Escolha: a alternativa (tirar os atributos da geometria antes do `dispose()`) exigiria achar todos os pontos de descarte (`Pool`, `LiveTile`, `retarget`, kits de `Life`) e quebraria de novo com um ponto esquecido; a de buffer por geometria é local em uma função e não depende de quem descarta. Os `BufferAttribute` soltos (e o índice) continuam compartilhados, como antes da E7: o three só apaga a entrada e recria.
- Custo: CPU, nenhum a mais por lote (o array é o mesmo, só nasce um objeto `InterleavedBuffer`); a cópia intercalada continua feita uma vez por kit. GPU: um buffer de vértices por lote em vez de um por kit (vértices x stride x 4 bytes; kits têm algumas centenas de vértices, então dezenas de KB por lote), parecido com o que o three já alocava por lote quando os atributos eram soltos. Contagem de buffers por malha e draw calls não mudam: `tests/vbuf.ts` segue com máximo 4 (478 kits).

**Proteção.** `scripts/smoke.mjs`, casos `vida-dos-buffers` (WebGPU) e `vida-dos-buffers-webgl`: Terra, Holanda, semente 16, Alta, 15 peças; depois 4 jogadas com queda animada em sequência (`__placeBest`), troca de era 1, 2, 3 e 0 (`__era`), zoom 30 e 6 em cada era (passa o limite 18 das árvores leves), 2 desfazer (`__undoMove`), 2 jogadas e zoom de novo. Falha com qualquer erro no console, inclusive `destroyed`. Não foi possível ver o caso falhar com o código antigo em WebGPU aqui (o SwiftShader perde o dispositivo); a CI do GitHub é quem exercita.

**Resultados.** `npm run check` verde. `npm run smoke`: `webgl`, `relevo-webgl`, `terra-hash-webgl`, `buffers-de-vertice` e `vida-dos-buffers-webgl` ok (esse último leva ~160 s no SwiftShader); os casos WebGPU falham por ambiente (`Instance dropped in popErrorScope`), como na base. O stress `300:high` em WebGPU também não roda aqui por isso; como a geometria, o número de malhas e os atributos não mudam, os draw calls, triângulos e instâncias (72.425) ficam iguais aos da E7 por construção.
