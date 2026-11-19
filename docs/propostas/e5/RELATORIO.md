# E5: Encostas no jogo todo

Branch `dorf/e5-encostas` (base `origin/dorf/f3-terra-fantasma`). Modelo: GPT Astra (jogo-entrepostos 75f92e0). O BRIEF.md citado no pedido não existia no scratchpad; segui o texto do pedido e o AGENTS.md.

## O que entrou
- `src/core/hills.ts` (puro): `boardHill`, `handHill`, `hillHeight`, `hillSignature`, sem a trava `riverTrade && crista`. Vale em todos os modos e temas; só aparência (sem `SAVE_VERSION`, pontos e replay intactos).
- `src/render/hillSurface.ts`: cota nos nós da malha. `buildTile` (`opts.hill`, `opts.hand`): chão, decalques assentados na malha (adaptativo), casas no trecho mais plano com fundação, teto de altura junto à água e à estrada, decoração móvel com `Life.groundRise`.
- Relevo e Terra: a altura por peça segue como REGRA (núcleo e água pontuada intactos); o desenho fica no nível 0 com as Encostas (`World.flatDraw`), sem platô por peça, sem saia. A altura lógica soma `LOGIC_RISE` no ombro e na divisa (simétrico), para o encaixe continuar legível. `terrain.ts` e `magra.ts` só vivem atrás de `?encostas=0`.
- Vizinha que muda: `World.baked` + `refreshHills` (refaz a peça e as 6 vizinhas cujo perfil mudou, no lugar). `Chunk.replaceGround`, `Pool.set/remove` e `addUpdateRange` (só a faixa alterada vai à GPU). Documentado no AGENTS.md (exceção à invariante 10).
- Fantasma e queda: a assinatura do perfil entra na chave, então o pouso reaproveita a peça sem pulo.
- `?encostas=0` / `#encostas=0` volta ao desenho de antes (A/B no mesmo build). `window.__hills()`.
- Prévia abre no Clássico; `#mode=relevo`, `#mode=terra`, `#bench` valem.

## Decisões (sem perguntar)
1. Relevo/Terra: o desenho perde a cachoeira (não há platô por peça); a queda pontuada aparece como correnteza. O pedido mandava manter as cachoeiras; mantê-las exigiria platô por peça, que é a origem do "gordo". Em Clássico com platôs (`levelAt`, 4 temas) a cachoeira segue.
2. Água que desce: núcleo intocado (usa `tileProfile`); só o desenho mudou.
3. Rim zerado entre casas de níveis `levelAt` diferentes (há penhasco ali).
4. Malha 6 divisões onde há divisa, patamar ou ombro alto; 4 nas peças baixas e soltas; 12 com água ou trilho (as emendas casam porque divisa não casada vale 0 dos dois lados).
5. Fantasma indicando vizinhas que sobem: NÃO feito (só o perfil da própria peça no fantasma).
6. Capturas em `quality=medium` (não high): no SwiftShader a Alta não terminou um quadro em 25 min. WebGL2 apenas.

## Testes
- `tests/hills.ts` (`npm run hills`, no `npm test`): 36 partidas (12 sementes × Clássico, Relevo, Terra, todos os temas), 2.806 peças: 127.400 amostras de emenda dos dois lados no espaço do mundo contra uma fórmula fechada escrita no teste (cada lado leva o ponto ao local por conta própria), 68.146 amostras de vale (divisa sem par = 0), 68.600 nós da malha, determinismo, 144 ordens de jogada (protocolo "refaz só a peça nova e as 6 vizinhas" = cálculo do zero), 36 replays e desfazer. Patamar máx 3, rim máx 0,515.
- `npm run check` verde. Smoke: casos WebGL verdes (webgl, relevo-webgl, terra-hash-webgl e demais); os casos WebGPU falham aqui com "Instance dropped in popErrorScope", falha de ambiente (também na `main`): o WebGPU NÃO pôde ser conferido nesta máquina; a CI roda os dois.
- Ao vivo (WebGL2, 6 jogadas animadas em Clássico, Relevo e Terra/Egito): 0 erros; vizinhas refeitas por jogada 0 a 2, pior custo 34 ms.
- `npm run compare` não rodado (visual muda de propósito).

## Custo (stress 300:high, SwiftShader, WebGL2, Holanda, seed 42; base = f3-terra-fantasma)
| Modo | Triângulos base → E5 | Montagem base → E5 |
|---|---|---|
| Clássico | 1.476 mil → 1.639 mil (+11%) | 1.234 → 1.783 ms (+44%) |
| Relevo | 1.466 mil → 1.649 mil (+12,5%) | 2.810 → 2.144 ms (−24%) |
| Terra | 1.520 mil → 1.671 mil (+9,9%) | 3.000 → 2.219 ms (−26%) |

Metas: triângulos ≤ +10%: Terra ok, Clássico e Relevo ficam 1 a 2 pontos acima. Montagem ≤ +25%: ok no Relevo e na Terra (mais rápidos que a base), NÃO no Clássico (+44%). Antes das otimizações (decalques por corte em grade, malha 6 sempre) eram +37% de triângulos e +97% de montagem. O custo vem de mais vértices no chão (malha 6) e dos decalques que seguem a encosta. Pendente: medir o pior quadro da jogada em GPU de verdade (aqui o quadro leva ~2 s); o refazer de vizinhas custou até 34 ms de CPU. Ideias: malha 5 só com emendas coerentes, cache de `topColor`, decalques de estrada em tira única.

## Visual
Pranchas (base × E5; `base` = `?encostas=0`): `prancha-temas-longe.jpg`, `prancha-temas-perto.jpg`, `prancha-relevo-terra.jpg`, `prancha-astra-x-e5.jpg`. Observações: as vilas leem como colinas cinza (a rocha tinge o chão; reduzi a tinta para 0,14); no Relevo/Terra a costa deixou de ser o contorno redondo (sem as saias o contorno segue o hexágono, a água e o mar do "fluido" continuam); a crista que atravessa emendas aparece na prancha do Astra.

## Arquivos
Código: `src/core/hills.ts`, `src/render/hillSurface.ts`, `tileBuilder.ts`, `world.ts`, `life.ts`, `lib.ts` (export BODY), `main.ts`. Testes: `tests/hills.ts`, `tests/hills-cost.ts` (`npm run hills:custo`). Prévia: `/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/e5/retalhos-encostas.html` (abre sem erro em Clássico, `#mode=relevo`, `#mode=terra`).
