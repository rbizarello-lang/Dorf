# Cidade das Quatro Estações (esboço visual)

Um panorama, não um jogo: uma vila pequena num diorama de vidro com moldura de latão e base de nogueira, que atravessa o ano. Tudo é gerado em código (sem arquivos de arte).

## O que a cena mostra

- **Diorama:** caixa de vidro, moldura e puxador de latão, base de nogueira com plaquinha gravada, fundo escuro e quente. O bloco de terra aparece em corte, em camadas (gramado, húmus, subsolo, argila, cascalho, rocha); o gramado da lateral e a camada de cima seguem a estação.
- **Vila:** 8 casas no ano 1 (chalés e sobrados de enxaimel), moinho de vento no morro, poço, lago com cais, barco e patos, riacho com ponte de madeira, dois campos de trigo, pomar, bosque de pinheiros e árvores de copa, cercado com ovelhas, lampiões.
- **Estações** (mesma geometria, paleta trocando, transição de 1,6 s):
  - primavera: flores, copas em botão e cerejeiras, verde-claro, cordeiros pequenos, pétalas caindo;
  - verão: trigo dourado alto, lago turquesa brilhante, maçãs verdes, vaga-lumes ao anoitecer;
  - outono: copas laranja e vermelhas, folhas caindo, abóboras, fardos de feno, maçãs vermelhas, névoa rasteira de manhã;
  - inverno: neve no chão e nos telhados, lago congelado, árvores nuas com neve, fumaça forte, janelas acesas e fios de lanternas de festa ao anoitecer.
- **Hora:** manhã, tarde, entardecer e noite mudam sol, lua (um astrolábio dentro da caixa), luz, nuvens, janelas e lampiões.
- **Ano 1 / Ano 3:** no ano 3 a vila é maior: 4 casas novas, 4 chalés viram sobrados, praça com torre de relógio, fonte, bancos e barracas listradas, estrada calçada, mais lampiões. As peças crescem uma a uma.
- **Vida pequena:** pássaros, fumaça nas chaminés, folhas/pétalas/neve, ovelhas passeando, patos, pás do moinho, trigo ao vento, nuvens à deriva.
- **Controles:** mostrador de estações em latão (agulha com mola), hora em botões de madeira e latão, alavanca de anos. Câmera orbita devagar sozinha; mouse/toque giram e aproximam, com limites; de perto a câmera passa a olhar para a praça. Teclas 1 a 4 e setas trocam a estação.

## Como abrir

```bash
cd jogos/estacoes
npm install
npm run dev        # desenvolvimento
npm run build      # dist/index.html (arquivo único)
npm run shot       # capturas em docs/screens/ (precisa do build)
```

## Ganchos de URL

`?season=0-3` (ou `primavera|verao|outono|inverno`), `hour=manha|tarde|entardecer|noite`, `year=1|3`, `yaw=` (graus, desliga a órbita automática), `pitch=` (graus), `zoom=` (1 = padrão, maior = mais perto), `still` (sem órbita), `ui=0` (esconde os controles), `timescale=`, `shot=1` (captura). `window.__stats` traz draw calls e triângulos; `window.__ready` indica a cena pronta.

## Desempenho (software, SwiftShader)

Cerca de 79 a 87 draw calls e 178 a 180 mil triângulos por captura, tudo com instancing.

## Copiado e adaptado da Ilha das Lanternas

- `src/geo.ts`: construtor de geometrias low-poly com cor por vértice (cópia).
- `src/pool.ts`: ideia do `Pool` de `InstancedMesh`, reescrito com escala dinâmica e visibilidade animada.
- Estilo dos kits (casas, árvores, nuvens, pássaros) segue o da Ilha, mas foram redesenhados aqui. Nada é importado de fora desta pasta.
