# Plano visual D21 em diante (consolidado de arvores.md, casas.md, campos.md e chao-luz.md)

| Etapa | O que | Tam. | Custo | Base |
|---|---|---|---|---|
| D21 | Cor de telhado e parede sorteada por casa (5 a 7 cores por tipo); Holanda clareada | P | 0 tris | casas P1 |
| D22 | Fundo e vazio com valor próprio nos temas frios; tirar o véu branco do vazio | P | 0 | chão P1 |
| D23 | Árvores menores (~0,85×) e 2 a 3× mais numerosas, rng derivado; paleta de mata escura com 5 a 8% de acentos; franja na borda da mata | M | ≤ +10% com D19 | árvores P1, P3, P5, P6 |
| D24 | Campos com borda macia: parcela sem parede escura, bisel, plantas que diminuem perto da borda, fronteira de terreno com ruído | P–M | ~0 | campos P2, P3, P4 |
| D25 | Emenda de cor entre peças pelo groundMap no shader do chão | M | 0 tris, +1 textura | campos P1 |
| D26 | Prado com tom próprio por peça, manchas grandes e 1 elemento âncora | P–M | +2% | chão P2, P3 |
| D27 | Mais tipos e proporções de casa por tema (escala anisotrópica, empena íngreme, cumeeira cruzada, anexo) | M | +2 draw calls por tipo | casas P2, P5 |
| D28 | Detalhe de casa legível de longe (base de pedra, enxaimel grosso, janelas maiores, faixas de telha) | M | +30 a 60 tris por casa | casas P3 |
| D29 | Vila mais densa e escalonada por cima do D15 (tamanhos, giros, anexos) | M | +2% | casas P4 |
| D30 | Três silhuetas de árvore por tema (redonda, esguia, pontuda) | M | neutro | árvores P2 |
| D31 | Base do tabuleiro: sombra de contato e lateral com mais camadas | M | +3% | chão P4 |
| D32 | Zoom aberto legível: névoa relativa ao tabuleiro, tilt-shift cai com o zoom | P | 0 | chão P5 |
| D33 | Campo que atravessa a emenda entre peças de plantação | M | pequeno | campos P5 |
| D34 | Água com mais forma (meandros, ilhotas), sem mexer no material | M | +3% nas peças com rio | chão P6 |

Ajustes nos PRs abertos antes do merge:
- D9 (#63): o tilt deve cair com o zoom aberto (hoje borra ~70% da tela).
- D14 (#70): não estender a outros temas; o contraste −17% vai contra o que falta.
- D15 (#73): manter as ruas; os giros e tamanhos variados ficam para a D29.
- D19 (#75): vira obrigatório com a D23; talvez descer o corte de 18 para 14.
