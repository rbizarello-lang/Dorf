# Integração da `dorf/e5-encostas` com a `main`

Resumo para quem revisa o PR. Tudo abaixo já está na branch `dorf/e5-encostas`, que recebeu a `main` (`f8a4458`) por merge. O jogo publicado muda em dois pontos: as Encostas aparecem em todo mapa, e há dois modos novos em "Mais modos".

## O que entra na `main`
- **Relevo:** modo em "Mais modos". Cada peça tem uma altura (baixa, alta, rampa, morro) e a altura das bordas também precisa encaixar: 1 degrau vale pontos, 2 não.
- **Águas que descem:** no Relevo, o rio que desce rende pontos por peça, chegar ao mar rende mais e peças de volta, e há nascentes escondidas que o rio revela.
- **Terra contínua, F2 e F3:** F2 é a regra nova de pontos, em que a paisagem é um campo só (emenda contínua, mancha que cresce, mancha fechada). F3 é o fantasma que mostra essa paisagem (contorno da mancha, bordas abertas, laço dourado ao fechar) e o "Onde encaixa" mais rápido. Regra em `docs/TERRA.md`.
- **R7:** peça magra (menos triângulos no Relevo), fantasma fiel (a prévia é a mesma peça que pousa) e jogo mais leve (já na `main` pelo PR #112).
- **E5 Encostas:** o chão de toda peça ganha morros e encostas suaves, em todos os modos e temas. Só aparência (`docs/propostas/e5/`).
- **E6 Paisagem viva:** casas que sobem, mata que adensa e cultivo com celeiro conforme os encaixes. Só aparência, opção em Aa (`docs/propostas/e6/`).
- **Patamares e baías do Astra:** patamares de vila em geometria (muro de arrimo) e casas vazias internas com contorno redondo (`docs/propostas/e5-patamares/`, `docs/propostas/baias-internas/`).
- **E7 e E7b, buffers do WebGPU:** os kits instanciados passaram de 8 buffers de vértice (limite do WebGPU, o que o Astra viu na RTX 3060). Atributos intercalados em `instGeometry`, gancho `?vbuf`, teste e caso no smoke (`docs/propostas/e7/`). A E7b deu a cada geometria o seu buffer intercalado e cobre a vida útil dos buffers.
- **E8 vizinhas:** fumaça, peça que assenta durante a queda, corredeira nas duas ordens e prévia da vizinha que sobe. `npm run scene` compara cena incremental e reconstrução (`docs/propostas/e8/`).
- **Merge da `main`:** os PRs #113 (smoke em Alta e Ultra, aviso quando não dá para salvar, piso de cor à noite) e #114 (AGENTS.md corrigido) foram juntados sem perder nada dos dois lados.

## Padrões
- As Encostas valem em todos os modos e temas. `?encostas=0` (na prévia, `#encostas=0`) volta ao desenho de antes.
- A Paisagem viva vem ligada no Zen e na Terra contínua e desligada nos outros modos (opção em Aa, gravada em `retalhos.viva`; `?viva=0|1` força). Na prévia publicada (`VITE_PREVIEW=relevo`) ela vem ligada em todos os modos.
- O Relevo e a Terra contínua ficam em "Mais modos" (`more: true`).
- O build normal (sem `VITE_PREVIEW`) abre como antes: no modo salvo ou no Clássico. A prévia abre no Clássico e só recebe `#hash`.

## SAVE_VERSION
Não mudou: segue 13, igual à `main`. Os modos novos têm id próprio, a regra do Clássico e dos outros modos não mudou, e Encostas, Paisagem viva, patamares e baías são só aparência (a altura e o nível saem da semente). Quem tinha um save antigo continua com ele.

## Números (stress `300:high`, WebGL2 por software, Holanda, seed 42)
Medidos na cabeça da integração contra a `main` `f8a4458`, na mesma máquina, uma rodada. A `main` não tem Relevo nem Terra.

| Caso | Draw calls | Triângulos | Instâncias | Montagem (ms) | CPU JS/quadro (ms) |
|---|---|---|---|---|---|
| `main` Clássico | 117 | 1134 mil | 80461 | 980 | 10,6 |
| `main` Zen | 117 | 1134 mil | 80461 | 951 | 11,9 |
| branch Clássico (Encostas) | 120 | 1255 mil | 72425 | 1920 | 26,2* |
| branch Clássico `?encostas=0` | 117 | 1134 mil | 80461 | 977 | 12,6 |
| branch Zen com Viva | 121 | 1403 mil | 90122 | 1995 | 12,0 |
| branch Relevo | 117 | 1322 mil | 67630 | 2615 | 11,9 |
| branch Terra | 118 | 1452 mil | 81245 | 2516 | 37,2* |

\* A CPU por quadro no SwiftShader inclui a espera pelo desenho por software e oscila muito; não vale como medida. As contagens de draw calls e triângulos são as que valem. Com as Encostas desligadas, o Clássico da branch dá exatamente os números da `main`. Com elas ligadas: +3 draw calls (+2,6%) e +10,7% de triângulos; a montagem dobra (≈1 s a mais para 300 peças). A Paisagem viva no Zen soma +24% de triângulos sobre a `main` (já com as Encostas). A "lógica" do Relevo e da Terra (1,5 e 1,8 s para 300 peças) vem da regra de alturas e da Terra, e é o custo conhecido desses modos.

## Comparação de capturas (`npm run compare`)
`mode=classico&encostas=0`, Baixa, WebGL2, as 6 vistas fixas, `main` contra a branch (limiar 12 por canal, tolerância 0,5% e média 0,5). O ruído entre duas rodadas da própria `main` foi de até 0,293% dos pixels e média 0,122 (`zoom-aberto`). A branch contra a `main` deu entre 0,008% e 0,316% e média entre 0,016 e 0,207: tudo dentro da tolerância e na faixa do ruído. Com as Encostas ligadas o visual muda de propósito e não se compara por esse script.

## Verificação
- `npm run check` verde (typecheck, testes, build).
- `npm run smoke`: todos os casos WebGL verdes (`webgl`, `relevo-webgl`, `terra-hash-webgl`, `buffers-de-vertice`, `ao-vivo-webgl`), em 3 min 14 s no SwiftShader. Os casos WebGPU (`bench`, `webgpu`, `relevo`, `terra`, `hash-invalido`, `webgpu-alta`, `webgpu-ultra`) falham aqui só por "WebGPU Device Lost" do SwiftShader; a `main` falha igual nesta máquina. A CI do GitHub roda o WebGPU.
- Os casos `vida-dos-buffers` e `vida-dos-buffers-webgl` citados no pedido não existem na branch: a E7b cobre a vida dos buffers no `buffers-de-vertice` e no `tests/`.

## Pendências conhecidas
- Celeiro da Paisagem viva sem desenho próprio: hoje é uma caixa com telhado de quatro águas nas cores das casas e lê mal de perto.
- Canal de rio mais largo onde os rios se ligam (Paisagem viva): não feito, porque a largura de cada borda é herdada da vizinha e alargar pede refazer a emenda de toda a cadeia de rio.
- A mancha verde da prévia do fantasma (a vizinha que cresce, Paisagem viva) não foi capturada em imagem; só a dourada (a que sobe) foi.
- WebGPU e GPU real: nada disto foi medido em GPU de verdade nem no WebGPU por software desta máquina. Conferir na CI e na RTX 3060 (issue #115): FPS, tempo de GPU (`?bench`) e o `?vbuf`.
