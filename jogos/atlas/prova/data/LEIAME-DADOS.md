# Dados de Urca (Rio de Janeiro)

`urca.json` é o recorte de Urca que a maquete lê: 1.641 × 1.639 m, em metros locais (x leste, y norte, origem no centro do recorte, lon -43,1620 e lat -22,9496). Foi gerado por `scripts/extrair.mjs` (que chama `scripts/baixar.mjs`), com os dados abertos de **2026-10-21.0 da Overture Maps** e os tiles de relevo **Terrarium** da AWS, baixados em 24/10/2026. `urca.stats.json` guarda as contagens de qualidade de cada extração.

## Fontes e atribuição

Texto obrigatório, que a maquete mostra no canto inferior:

> © OpenStreetMap contributors, Overture Maps Foundation. Relevo: Mapzen/AWS Terrain Tiles (SRTM/USGS, entre outras fontes).

| Camada | Origem | Licença |
|---|---|---|
| Prédios (`predios`) | Overture `buildings/building`: OpenStreetMap (483) e Microsoft ML Buildings (144) | ODbL 1.0 (as duas fontes chegam com `license: ODbL-1.0` na Overture) |
| Ruas, escadarias, trilhas (`ruas`) | Overture `transportation/segment`, derivado do OpenStreetMap | ODbL 1.0 |
| Mar, lagos, piscinas (`agua`) | Overture `base/water` (OpenStreetMap) | ODbL 1.0 |
| Praias, rocha, mata, árvores, picos (`terra`, `arvores`, `picos`) | Overture `base/land` (OpenStreetMap) | ODbL 1.0 |
| Parques, praças, áreas protegidas (`uso`) | Overture `base/land_use` | ODbL 1.0 |
| Teleférico, estações, bancos, muros (`cabos`, `estacoes`, `pontos`, `muros`) | Overture `base/infrastructure` (OpenStreetMap) | ODbL 1.0 |
| Relevo (`relevo`) | AWS Terrain Tiles, formato Terrarium, zoom 15: Mapzen, com SRTM (NASA/USGS) na região | atribuição ao Mapzen e ao USGS; ver `PROVA.md` |

## Aviso de licença: este JSON é uma base derivada sob ODbL

Os dados vieram do OpenStreetMap (por dentro da Overture). Extrair, projetar, recortar e simplificar essas feições para um arquivo novo é criar uma **Derivative Database** no sentido da ODbL 1.0 (seção 1). Então:

- `urca.json` e qualquer arquivo que o inclua (o `dist/index.html` embute o JSON) **devem ser oferecidos sob ODbL 1.0**, com a atribuição acima e o aviso de que o conteúdo vem do OpenStreetMap;
- o código-fonte da maquete (three.js, TypeScript) **não** vira ODbL: a imagem 3D e o código são uma *Produced Work* e um programa separado. A fronteira exata merece leitura jurídica antes de um uso comercial;
- quem redistribui a base derivada tem de dar a quem recebe uma cópia legível por máquina (este JSON já é) e manter a atribuição.

Isto é uma leitura técnica da licença, não parecer jurídico.

## O que foi baixado

Só o recorte, por requisições de faixa HTTP no Parquet (nada de arquivo inteiro):

| Camada | Arquivos do tipo | Arquivos tocados | Linhas lidas | Transferido |
|---|---|---|---|---|
| `buildings/building` | 512 (cerca de 530 MB cada) | 1 (part-00079) | 3.756 | 107 MB, dos quais 98 MB são rodapés de 99 arquivos sondados |
| `transportation/segment` | 128 | 1 (part-00033) | 1.155 | 91 MB, dos quais 88 MB são rodapés |
| `base/water`, `base/land`, `base/land_use`, `base/infrastructure` | 32, 48, 32 e 16 | 1 a 2 de cada | 45, 1.282, 289 e 933 | 40 a 55 MB cada (quase tudo rodapés) |
| relevo Terrarium z15 | 16 tiles | 16 | 1.024 × 1.024 amostras | 705 kB de PNG |

Os arquivos da Overture seguem uma curva espacial: arquivos vizinhos cobrem regiões próximas. O script sonda 1 em cada 8 rodapés, acha os que tocam o recorte e sonda os vizinhos; é uma heurística, e um índice completo por release seria exato. O custo dominante é o rodapé (cerca de 1 MB por arquivo), não os dados.

## Prédios: o que veio e o que não veio

Dos 3.756 prédios lidos na caixa com margem, 901 têm o centro dentro do recorte. Deles:

- **627 ficam** (483 do OpenStreetMap e 144 da Microsoft ML Buildings);
- **273 são do Google Open Buildings e foram deixados de fora de propósito** (o pedido foi não usar nada do Google; o conjunto tem licença própria, mas na Overture esses registros vêm com a licença em branco). `--com-google` os traz de volta;
- 1 foi descartado por ter menos de 8 m².

Cobertura dos 627 que ficam:

| | prédios | % |
|---|---|---|
| com altura (`h`) | 194 | 31% |
| com número de andares (`a`) | 270 | 43% |
| com altura ou andares | 270 | 43% |
| sem nenhum dos dois | 357 | 57% |
| com forma de telhado (`r`) | 0 | 0% |
| com classe (`c`: residencial, apartamentos, escola...) | 268 | 43% |

Todo prédio com altura é do OpenStreetMap, e a altura por andar é 3 m (mediana), o que sugere altura derivada de `building:levels`. Os 144 da Microsoft não trazem altura nem andares. A maquete usa a altura do dado; com só andares, 3 m por andar; sem nenhum dos dois, estima pela área e pela vizinhança (ver `PROVA.md`).

## Formato do JSON

```
v, lugar, atribuicao, licenca, origem {lon0, lat0}, recorte {s,w,n,e}, projecao, larg, alt   (metros)
relevo   { nx, ny, passo (m), min, max, dm }   dm = Int16 em decímetros, base64, linha 0 = norte
picos    [{ n, x, y, ele, dem, x2, y2, correcao }]       cota do OSM, cota no relevo e correção
predios  [{ i, p:[x,y,...], s:'o'|'m', h?, a?, m?, r?, c?, n? }]   altura, andares, min_height, telhado, classe, nome
ruas     [{ c, p, n?, t?, l? }]                          classe, nome, 'rail', -1 túnel / 1 ponte
agua     [{ t:'mar'|'lago'|'piscina'|..., p:[anel, furos...] }]
terra    [{ t:'beach'|'bare_rock'|'wood'|..., p }]       praias, rocha, mata
uso      [{ t:'subtipo/classe', p }]                     parques, praças, áreas protegidas
arvores  [x,y,...]                                       árvores do OSM
pontos   { banco, poste, fonte, mirante }                [x,y,...]
cabos, estacoes, pieres, muros, penhascos                teleférico, estações, píeres, muros, penhascos
```

Coordenadas arredondadas a 0,1 m; polígonos simplificados (Douglas-Peucker, 0,7 m nos prédios, 0,6 a 1,5 m no resto).

## Calibração dos picos (única alteração do relevo)

O SRTM tem 30 m de resolução e achata picos estreitos: o relevo dá 305 m onde o OpenStreetMap marca 392 m no Pão de Açúcar, e 202 m onde marca 220 m no Morro da Urca. Onde o dado do OSM (`ele` do pico) passa do relevo em mais de 3 m, o extrator soma um montículo gaussiano (σ de 55 m) até a cota do dado. A **cota é dado real; a forma do montículo é nossa.** O ajuste fica registrado em `picos[].correcao`.
