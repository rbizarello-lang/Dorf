# Patamares de vila

- `astra/e5-patamares`, implementação `774c2a2` sobre `fcc7530`. A malha forma bancadas, faces de pedra e capas em curvas de nível. As casas e a decoração leem a cota dessa malha. O recorte preserva as cotas nas emendas, na água e nas vias, além das regras e do replay.
- `npm run check` passou. A prova nos cinco temas conferiu 18.475 cotas na geometria, 755 faces íngremes, 41 texels do mapa de alturas e a área do chão após o deslocamento do encaixe fluido.
- O `npm run smoke` com SwiftShader esgotou a espera na abertura do `bench`. Os oito cenários passaram em Chrome 157 na RTX 3060, via arquivo local, com WebGPU e WebGL2. Em Zen, a expansão da Paisagem viva, a alternância em Aa, o recarregamento e o desfazer reproduziram o placar e o tabuleiro da base.
- Na prancha, Holanda Dourada em Zen, semente 42, Alta e Paisagem viva, as mesmas 46 peças marcaram 2.133 pontos. No zoom 8,5 as chamadas ficaram em 95 e os triângulos passaram de 310.299 a 328.492 (+5,86%) em WebGPU. De perto, a junção da capa com algumas fundações ainda tem recortes visíveis. [Prancha antes e depois](prancha-holanda.jpg)
- Em WebGPU Alta, o ensaio de 300 jogadas esbarrou no limite de oito buffers de vértices na base e na variante. Em WebGL2, os ensaios de carga em Alta esgotaram o tempo de espera. O comparativo de custo usa a amostra válida de 46 peças em WebGPU.
