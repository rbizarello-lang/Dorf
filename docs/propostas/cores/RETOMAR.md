# Frente de cores e tons: ponto de parada

O Roger suspendeu esta frente. Ela parou na etapa 2 (diagnóstico), antes de mexer nas cores.

Feito:
- capturas "antes" dos 5 temas (dia, entardecer, noite, silhueta), seed 7, 60 peças, Alta, zoom 12: branch `dorf/capturas`, pasta `c1-antes/`;
- `capturas.sh`: o script que gera essas capturas;
- `medida-dL.ts.txt`: script de medida de ΔL (CIELAB) entre os terrenos, no modelo de `tests/legibility.ts` (renomeie para `tests/.dl.ts` para usar).

Falta (pedido original):
1. ver se as skills `dataviz`, `artifact-design` e `maquete-3d-de-fotos` servem ao jogo (o validador de paleta da `dataviz` pode conferir contraste e daltonismo);
2. diagnóstico por tema: harmonia, separação de valor entre terrenos, saturação, temperatura de luz e sombra, `grade`, leitura no zoom aberto, com a tabela de ΔL;
3. melhoras só em dados dos temas (`ground`, `grade`, céu, cores de kits), um commit por tema, `tests/legibility.ts` verde;
4. capturas antes e depois, pranchas por tema e relatório.
