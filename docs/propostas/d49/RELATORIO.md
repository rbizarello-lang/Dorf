# D49: casas vazias sem vidro e legíveis à noite

Itens da avaliação autônoma: P2.3, P2.4, P2.5 e P3.1.

## Causa

A laje das casas vazias (`World.slots`, translúcida, `depthWrite: false`) ficava a meia altura das paredes (`position.y = -0.12`, mais `heightOf` da casa), com as peças indo de 0 a `-TILE_T` (0,28) e o entorno em `-TILE_T - 0.1`. Como ela não grava profundidade e vem depois das peças opacas, a parte da parede e da encosta das vizinhas ABAIXO de -0,12 ficava atrás da laje e era vista através dela, lavada: era o "vidro" da Holanda, do Brasil e o paredão cinza do Egito (P2.4 era a mesma laje, não a parede do `tileBuilder`; nada foi mudado lá). Ordem de desenho e teste de profundidade estavam certos; o raio 1,12 do disco no fluido só aumentava a área afetada. À noite, a cor `line` escura e a opacidade que caía 0,3 deixavam a laje invisível sobre mar e areia escuros (P2.5), e a duna virava marrom chapado.

## Correção (`src/render/world.ts`, `src/render/materials.ts`)

- A laje desce para o pé das peças: `voidMesh.position.y + SLOT_LIFT` (0,012), sem somar a altura do nível. Nada fica abaixo dela, e as paredes opacas a cobrem pelo teste de profundidade normal. Vale nos três entornos e no fluido (o disco `slotBlob` não muda).
- À noite a laje clareia para um tom de luar (`SLOT_MOON`) e perde menos opacidade; sobre mar e areia a opacidade sobe à noite (de 0,4 e 0,65 para até 0,7).
- A duna (`sandLook`) esfria 40% para o `fill` da hora à noite, em vez do marrom chapado.
- Sem `if (theme.id)`, sem `src/core`, sem draw call novo. `infl`, `stamps` e `hoverRing` ficaram na altura de antes (o tracejado continua visível nas capturas e no `compare`).
- AGENTS.md: nota "Laje das casas vazias (D49)".

Compromisso: em platôs (Clássico com `Theme.relief.levels`) a laje fica no pé comum, não na altura do nível; o fantasma e o anel de foco seguem o nível. Vizinhas altas escondem uma faixa da laje em câmera baixa (poço natural).

## Números

`RUNS=300:high` (WebGL2, software, seed 42), main -> branch:

| | draw calls | triângulos | instâncias |
|---|---|---|---|
| main | 117 | 1255 mil | 72425 |
| D49 | 115 | 1254 mil | 72425 |

`npm run compare` (high, `&webgl`, 6 vistas; diferença intencional, concentrada nas lajes e nas paredes vizinhas, conferida nos `diff-*`):

| vista | pixels | média |
|---|---|---|
| holanda | 5,38% | 3,60 |
| egito-entardecer | 14,39% | 5,44 |
| noite | 15,36% | 6,45 |
| zoom-aberto | 6,17% | 3,61 |
| rio-perto | 11,41% | 9,56 |
| vila-perto | 4,34% | 3,91 |

(acima da tolerância de 0,5%, como esperado: a laje cobre boa parte do quadro; o `compare` foi rodado com cópia local que usa `domcontentloaded` e `SHOT_TIMEOUT` maior por lentidão de rede da máquina.)

## Verificação

- `npm run check`: verde.
- `npm run smoke`: todos os casos WebGL2 ok (webgl, relevo, terra, entrepostos, buffers-de-vertice, vida-dos-buffers, ao-vivo). Os casos WebGPU (bench, webgpu, webgpu-alta, webgpu-ultra, hash-invalido, e as variantes webgpu de relevo, terra etc.) falham com "Instance dropped"/"Device Lost": é o WebGPU por software deste ambiente.
- Prancha antes/depois (1200x720, high, `&webgl`, seed 4): `antes-*.jpg` e `depois-*.jpg` aqui mesmo: `holanda` (`__deco('wall:',5,5)`), `egito` (`__river(5)`), `brasil` (`__coast(2,5)`), `holanda-noite`, `egito-noite`, `relevo` (Egito, `#mode=relevo`) e `terra` (`#mode=terra` com o fantasma, a diferença ali é mínima porque o disco fluido é difuso).
