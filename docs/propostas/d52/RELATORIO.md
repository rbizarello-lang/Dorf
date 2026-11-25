# D52: água da cena incremental igual à da reconstrução (Viva desligada)

## Causa
Não era a largura herdada pela ordem nem a correnteza: `widths` e `flows` saíram iguais nas duas cenas (conferido com o campo `wf` da assinatura).
Era o `rebakeHill`. Quando uma vizinha muda o perfil da encosta de uma peça, ele refaz o chão, mas só refazia a água (`replaceWater`)
com a Paisagem viva ligada (`channelOn = vivaOn && ...`). Sem a Viva, o chão novo ficava com a água velha, cortada na linha d'água de antes.
Sem a Viva, 6 dos 16 casos divergiam (Clássico, Terra e Relevo, sorteio e corredeira). Exemplos, Oriental seed 12, Clássico:
peça (-2,3), patamar alagado (`Theme.terraces.flooded`, água sem borda de rio): 181 triângulos na incremental, nenhum na reconstrução;
peça (2,-3): 66 contra 152. A água de borda de rio também divergia (ex.: Terra, `-1,0`: 535 contra 487).

## Correção (só `src/render/world.ts`; sem `src/core`, replay, pontuação ou `SAVE_VERSION`)
- `rebakeHill` refaz a água sempre que refaz o chão, com a Viva ligada ou não, e cria a faixa se a peça passou a ter água.
  Largura e correnteza continuam só com a Viva ligada: a largura que o jogador vê não muda.
- `Chunk.appendWater` ficou público para esse caso.
- `sceneSig`: faixa de água esvaziada vale `null` (a reconstrução nem cria a faixa) e a assinatura traz `wf` (largura|correnteza), usada na mensagem de diferença.

## Testes
- `scripts/scene-sync.mjs` compara a água nos dois modos da Viva e ganhou `sorteio-egito-sem-viva` (Egito, Clássico, `viva=0`, jogadas com água; 4 encaixes de água): 17 casos.
- Antes: 6 casos com diferença. Depois: `npm run scene` passa nos 17 (rodado em duas levas por causa do tempo).
- Não foi feito teste em Node das duas ordens: a causa era de render (refazer a peça vizinha), não de largura.
