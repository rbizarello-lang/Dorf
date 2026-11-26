# D56: canais de irrigação e a lâmina branca nas bordas de água

Base: `eb39a2b`. Origem: segunda avaliação (`docs/propostas/avaliacao-2/AVALIACAO.md`, itens P2.1 e P2.2). Tudo conferido em WebGL2 por software (`&webgl`), mundo parado (`timescale=0.001`).

## P2.1: canais de irrigação do Egito

**Causa.** O bloco de irrigação desenhava cada canal como uma fita de 2 triângulos por camada (rebordo e água) de lado a lado da parcela, com 0,5 a 0,9 de comprimento. O `Buf.drape` das Encostas só subdivide uma vez (`DRAPE_DEPTH = 1`) e mede o desvio do chão no meio das arestas e no centro: numa parcela sobre encosta ou bancada, uma fita assim atravessa o chão curvo, e cada pedaço sobe (`up = max(0, dev)`) por um valor diferente. Resultado: lascas torcidas, umas acima do trigo e outras enterradas. Havia um segundo defeito: o rebordo e a água ficavam a 0,5 mm um do outro, e como o `up` é calculado por triângulo, a água podia afundar sob o rebordo.

**Correção** (`tileBuilder.ts`, bloco "Canais de irrigação"). Com as Encostas ligadas (`hill`), o canal é quebrado em trechos de `CANAL_STEP` = 0,045 antes do `drape` (a fita `strip` já calcula a tangente pelos vizinhos, então os trechos emendam sem quina). A água passa de `h + 0,0009` para `h + 0,0032`, 3 mm acima do rebordo. Sem as Encostas (`?encostas=0`) o desenho é o de sempre (um trecho só). Não mexe no gerador (`seed ^ 0xca4a1`), então posição e quantidade dos canais não mudam.

**Resultado.** Os canais lêem como sulcos retos e contínuos acompanhando o chão (prancha 02). Ainda há pontos onde o canal fica sob uma planta alta ou sob uma bancada (trechos de 4,5 cm que o chão cobre); não cortei o canal no arrimo.

## P2.2: lâmina branca vertical na borda aberta

Eram duas causas, uma em cada família de modos.

1. **Clássico (e todo tema com `relief.levels`, como o Egito).** Não era a `WaterBuf.film` nem a `OPEN_LIP`: era a cachoeira de R3. Onde o rio ou lago está num platô e a casa vizinha, ainda vazia, é mais baixa (nível da semente), a peça alta constrói o lábio e a lâmina que "continua até o mar" (`fallHi`, `floorY`), com a espuma do mar no pé. Vista de fora, é uma fita fina de água que desce a lateral da peça até a areia, com brilho branco embaixo. Confirmei pintando o corte de água de magenta (não era ele) e depois pela ausência da fita na captura com a correção (prancha 04). **Correção:** `BuildOpts.lone` (por borda, só bordas de água sem peça assentada do outro lado), calculado em `World.hillFor` e incluído na assinatura (`hillSig`). Com `lone`, a peça fica só com o lábio de pedra e as pedras; a lâmina, a espuma e a névoa saem. Quando a vizinha chega, a assinatura muda e a peça alta é refeita no lugar (o mesmo caminho das corredeiras do Relevo: `FallLayer.append` troca a parte da peça), então a queda aparece junto com a vizinha. `lone` só vale nas bordas de água, para não refazer toda vizinha a cada jogada. O aquário (corte de água da lateral) passa a ser desenhado também nessa borda.
2. **Relevo e Terra contínua.** A `WaterBuf.film` (película d'água sobre a saia da boca aberta) entra na malha da água e, no material da água, a água rasa vira espuma: lia como a mesma fita branca (prancha 05, à direita do rio, no antes). Removi a película e o código (`film`, `OPEN_FILM`). A água acaba no lábio raso (`OPEN_LIP`) e a encosta cai logo (`SKIRT_CHUTE`), como já estava. A emenda com a vizinha não depende disso (a saia some quando ela chega): `npm run hills`, `river-seams` e `scene` abaixo.

Nas capturas de Holanda e Brasil no Clássico (pranchas 07 e 08) não aparecia a fita na vista escolhida, nem antes nem depois (esses lagos estão em casas de nível 0). Não achei um caso que reproduza a fita no Holanda/Brasil Clássico; a correção vale para os temas com `relief.levels`.

## Números

Stress (`RUNS=300:high EXTRA='&webgl&theme=egito&seed=42'`, 301 peças):

| | draw calls | triângulos | instâncias | CPU JS/quadro |
|---|---|---|---|---|
| antes (main) | 115 | 1219 mil | 35555 | 10,60 ms |
| depois | 115 | 1259 mil | 35555 | 10,70 ms |

Triângulos +3,3% (os canais em trechos); draw calls iguais. Dentro dos ~10%.

`npm run compare` (Baixa, `&webgl`, referência gravada da `main` e conferida com o build novo): holanda 0,154%, egito-entardecer 0,117%, noite 0,134%, zoom-aberto 0,288%, todos dentro da tolerância. `rio-perto` (3,8%) e `vila-perto` (4,3%, depois 1,0% com espera maior) passaram da tolerância, mas **o mesmo acontece comparando a `main` com ela mesma** em duas rodadas seguidas (rio-perto 3,825% e média 1,611; vila-perto 1,037% e 0,706; contra o build novo deu 3,823% e 1,037%): a máquina estava carregada (outro agente) e a câmera assenta com deslocamento de poucos pixels entre rodadas (o diff mostra só contornos, em tudo). Ou seja, a diferença não vem da mudança. O rio-perto tem canal de irrigação e boca de rio, e mesmo ali o resultado é igual ao ruído de base. Um `compare` limpo precisa de máquina quieta.

## Verificação

- `npm run check` verde (typecheck, 600 partidas e demais testes, build).
- `npm run hills`, `node scripts/river-seams.mjs` e `npm run scene` (todos os casos, "cena incremental = reconstrução integral"): verdes, com o build final. O `scene` cobre o caminho novo: a peça alta refeita quando a vizinha de água chega (`lone` na assinatura).
- `npm run smoke`: todos os casos em WebGL2 passam (`webgl`, `chamonix-webgl`, `relevo-webgl`, `terra-hash-webgl`, `entrepostos-*`, `buffers-de-vertice`, `vida-dos-buffers-webgl`, `ao-vivo-webgl`). Os casos em WebGPU (`bench`, `webgpu`, `guanabara`, `relevo`, `terra`, `entrepostos`, `hash-invalido`, `webgpu-alta`, `webgpu-ultra`) falham com "WebGPU Device Lost" / `createBuffer` no SwiftShader desta máquina, que não tem WebGPU utilizável (limite do ambiente, o que o enunciado já previa). O smoke completo só dá verde numa máquina com WebGPU.

## Pranchas (antes à esquerda, depois à direita)

- `01-irrigacao-egito-perto.jpg`, `02-irrigacao-egito-detalhe.jpg`: canais de perto (`?webgl&theme=egito&seed=11&auto=45&time=day&quality=high`, `__goto(4,-4,3.5)`).
- `03-egito-longe.jpg`: o mesmo tabuleiro de longe (sem pontos azuis soltos novos; a fita do lago à esquerda some).
- `04-lago-egito-lamina.jpg`: recorte do canto do lago (2,0) no Egito Clássico, onde a fita descia até a areia.
- `05-boca-terra-continua.jpg`, `06-boca-relevo.jpg`: bocas abertas no Terra contínua (Holanda, semente 5) e no Relevo (Egito, semente 5).
- `07-lago-holanda.jpg`, `08-lago-brasil.jpg`: lagos do Clássico, sem regressão visível.

## Sem verificar

- Não rodei na GPU real nem em WebGPU (a máquina só tem WebGL2 por software).
- Não achei, no Holanda, Oriental, Brasil e Inverno do Clássico, uma vista em que a fita aparecesse no `main`; a correção da cachoeira para casa vazia vale para todos com `relief.levels`, mas só vi o antes e depois no Egito.
- O `compare` limpo (abaixo de 0,5%) não foi obtido por causa da carga da máquina; ficou o argumento do controle (`main` contra `main`).
