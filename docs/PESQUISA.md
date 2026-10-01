> Pesquisa de apoio produzida por um agente Sonnet nesta sessão, a partir de buscas na web (o acesso direto às páginas estava bloqueado; os dados vêm dos resumos de busca). Marcação: **[F]** fato com fonte, **[E]** estimativa, **[C]** conhecimento geral. Números de agregadores são indicativos.

# Pesquisa de apoio: mecânicas, técnica, mercado e aspectos legais

Pesquisa de apoio · 30/09/2026 · PT-BR

**Legenda de confiança:** **[F]** fato com fonte (URL); **[E]** estimativa ou inferência minha; **[C]** conhecimento geral que não reverifiquei aqui.

**Nota de método.** O WebFetch foi bloqueado pelo proxy de saída (`EGRESS_BLOCKED`) em todos os domínios que tentei (Wikipedia, Steam, Fandom, docs do Godot, threejs.org, copyright.gov, planalto.gov.br). Toda a evidência vem de resumos do WebSearch; nenhuma página foi lida na íntegra. Números de agregadores (raijin.gg, SteamSpy, Cinevva, Utsubo) são indicativos, não auditados. As pontuações do Dorfromantik vêm de guias da comunidade da era 1.0 e podem ter mudado em patches.

## Resumo executivo

- **É viável e o risco técnico é baixo.** O visual do Dorfromantik é modesto em tecnologia: Unity, texturas pintadas, AO e cores por bioma, sem GI pesada. Requisitos mínimos no PC: GT 550M / Intel HD 520 e 3 GB de RAM [F, [gamerequirementslab](https://gamerequirementslab.com/dorfromantik-system-requirements)]; a versão Switch ocupa 388 MB [F, [GoNintendo](https://www.gonintendo.com/comments/5597)].
- **Three.js deve entregar 60 fps [E]** em PC e mobile médio se você respeitar: instancing por chunk (~100 draw calls no mobile), DPR ≤ 2, pós-processamento em meia resolução e sombras em cache.
- **Steam comercial:** Three.js + Electron funciona para escopo pequeno, mas Unity 6 (padrão do gênero) ou Godot 4 (MIT) reduzem o risco de plataforma, console e mobile nativo.
- **Legal:** regras de jogo não são protegidas (Copyright Office; Lei 9.610/98 art. 8º), mas aparência, nome, arte e UI são. Diferenciar é obrigatório. Isto não é aconselhamento jurídico.
- **Esforço [E]:** protótipo 2–4 semanas (1 dev); vertical slice 8–12 semanas (2–3 pessoas); Steam 9–18 meses (3–5 pessoas).
- **Mercado:** o gênero está provado (Dorfromantik ~527 mil cópias na Steam segundo estimativa; Islanders ~1,29 milhão; Tiny Glade 616 mil em menos de um mês), mas é orientado a hits e está saturado.

---

## 1. Mecânicas do Dorfromantik em detalhe

### 1.1 Peça, bordas e encaixe

- Peça hexagonal com 6 arestas; cada aresta (e o centro) recebe um tipo de terreno. O jogo começa com 1 peça inicial de arestas neutras ("barren"/prado) e uma pilha de **40 peças** aleatórias; só se vê as **3 primeiras** da pilha [F, [Wikipedia](https://en.wikipedia.org/wiki/Dorfromantik)].
- A peça deve encostar em pelo menos 1 aresta já existente; a rotação é livre. Arestas que combinam acendem em branco e os grupos que serão conectados são realçados [F, [Fandom](https://dorfromantik.fandom.com/wiki/How_to_play_guide_for_Dorfromantik)].

| Terreno | Encaixe | Observações |
|---|---|---|
| Floresta | livre | missões "N+ árvores" (ex.: 54) |
| Vila (casas) | livre | "15+ casas"; "exatamente 16" |
| Campo (grão) | livre | moinho quer 6 campos vizinhos |
| Prado (neutro) | livre | aresta "vazia"; há variação com flores |
| Água (rio/lago) | **obrigatório** (só liga com água) | forma redes; "Puzzler" mede sequências sem erro |
| Trilho | **obrigatório** (só liga com trilho) | locomotiva quer 10 trilhos |

Fontes: regra de encaixe [F, [Hiew's blog](http://hiewandboardgames.blogspot.com/2023/10/dorfromantik.html)]; exemplos de missões [F, [PC Gamer](https://www.pressreader.com/usa/pc-gamer-us/20210615/281659667977675)].

### 1.2 Pontuação e pilha (modo Classic)

| Evento | Efeito |
|---|---|
| Cada aresta que combina | +10 pts (60 se as 6 combinam) |
| Encaixe perfeito (6/6, inclusive "fechar" uma peça já posta) | +60 pts de bônus e **+1 peça** |
| Missão cumprida | +100 pts e **+5 peças** |
| Bandeira (fechar o grupo, sem arestas abertas daquele tipo) | +5 peças e bônus grande de pontos (valor exato não confirmado) |
| Fim de jogo | a pilha esgota |

Fontes: [Guia Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=2440566562), [SteamAH](https://steamah.com/dorfromantik-quests-rewards-and-tile-placement-for-beginners/), [Steam discussion](https://steamcommunity.com/app/1455840/discussions/0/3073117690260857552/) [F]. Não encontrei penalidade por arestas incompatíveis: elas só deixam de pontuar e impedem o "perfeito" [F/E].

### 1.3 Missões, bandeiras e peças especiais

- **Bolhas numéricas** sobre casas, árvores, campos ou trilhos. **"N+"** = pelo menos N (o grupo pode continuar crescendo). **"N" sem plus** = exatamente N; passar disso deixa a bolha vermelha e a missão falha [F, [guia Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=2440566562)].
- **Bandeira:** após cumprir uma missão, pode surgir uma bandeira no grupo; é preciso fechá-lo por completo [F].
- **Peças especiais com missão própria:** moinho de vento (6 campos de grão vizinhos), locomotiva (10 trilhos conectados), cervo (floresta com 50+ árvores) [F, PC Gamer]. Também existem moinho d'água, celeiro (com skins), barco e uma "water train station" [F, [TheGamer](https://www.thegamer.com/dorfromantik-challenges-tiles-special-unique-unlock-how/), [Exophase](https://www.exophase.com/game/dorfromantik-steam/achievements/)]. **Não encontrei evidência** de "quartel de bombeiros" nem de "estação" isolada.
- **Missão "coroa":** peças especiais pré-colocadas ficam no vazio, primeiro como hexágono só com contorno; ao chegar perto, revelam-se; cumprir a missão desbloqueia um Challenge [F, [Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2515878894)].

### 1.4 Desbloqueios e modos

- **85 Challenges** (abr/2023) desbloqueiam peças, skins e biomas. Exemplos: Landscaper (250/2.000/4.000 peças no total), Heavy Weight (50 a 250 peças seguidas sem girar), Puzzler (até 250 seguidas sem aresta incompatível) [F, [Gamefaqs/Steam](https://gamefaqs.gamespot.com/pc/307604-dorfromantik/achievements)].
- **Biomas:** Midwinter (2021), Sakura (grátis com o lançamento no Switch), Medieval Biome Pack (DLC de US$ 4,99, 02/06/2026, 3 biomas sazonais, "cosmético, sem mudar mecânica") e Night Mode [F, [Game Developer](https://www.gamedeveloper.com/press-release/dorfromantiks-winter-update-with-a-snowy-biome-and-polar-bears-is-out-now-and-10-off-during-winter-sale), [DekuDeals](https://www.dekudeals.com/items/dorfromantik-medieval-biome-pack), [80.lv](https://80.lv/articles/how-dorfromantik-expands-its-cozy-world-through-minimalist-design)]. Ou seja, skins já são o modelo de expansão do original.
- **Modos:** Classic (40 peças), Creative (sem limites), Quick (número fixo de peças), Hard (peças mais difíceis), Monthly (desafio mensal) e Custom (regras próprias, compartilháveis) [F, [Gematsu](https://www.gematsu.com/2025/05/dorfromantik-coming-to-ps5-xbox-series-ps4-xbox-one-and-mobile), [FilmStories](https://filmstories.co.uk/?p=83460)].
- **Jogo de tabuleiro** (Pegasus, 2022; Michael Palm e Lukas Zach): cooperativo, 1–6 jogadores, peças de paisagem e de tarefa, pontos por tarefas, bandeiras e maior trilho/rio; campanha com caixas (legacy). Venceu o **Spiel des Jahres 2023**, o primeiro adaptado de um videogame [F, [Rulespal](https://www.rulespal.com/dorfromantik/rulebook), [Berlin.de](https://www.berlin.de/gamescapital/news/dorfromantik-board-game-is-rewarded-game-of-the-year-1580991.en.php)].

### 1.5 O que torna o loop viciante e relaxante (síntese)

1. **Sem pressão:** o estúdio removeu elementos como timers para focar no ato de encaixar [F, [Game Developer](https://www.gamedeveloper.com/business/sparking-joy-through-tile-placement-in-idyllic-village-builder-i-dorfromantik-i-)].
2. **Três escalas de meta:** encaixe (micro), missão e perfeito (meso, dão peças), bandeiras, challenges e biomas (macro). Cada peça posta cria uma razão para "só mais uma".
3. **Economia autorregulada [E]:** jogar bem estende a pilha (perfeito +1, missão +5); a partida só acaba quando você falha em se sustentar.
4. **Agência com aleatoriedade domada:** 3 próximas peças visíveis, rotação livre, **undo** (10/03/2022) e rebalanceamento das probabilidades de sorteio "contra a frustração do RNG" [F, [Game Developer](https://gamedeveloper.com/press-release/dorfromantik-undo-button-more)].
5. **Regras aprendidas em minutos**, com profundidade vinda das restrições (água/trilho, N exato). Pilar declarado de minimalismo [F, [Berlin.de](https://www.berlin.de/gamescapital/interviews/toukana-interactive-berlin-is-a-network-of-support-and-inspiration-1578184.en.php)].
6. **Resultado estético "seu" [E]:** o mapa vira uma pequena obra, fácil de fotografar e compartilhar.

**Implicação:** 40, 10/60/100 e +1/+5 são parâmetros de balanceamento, não conteúdo protegido. Exponha-os como configuração e ajuste-os por tema.

---

## 2. Direção de arte e técnica visual do Dorfromantik

- **Engine:** Unity [F, [Wikipedia](https://en.wikipedia.org/wiki/Dorfromantik), [Galaxus](https://www.digitec.ch/en/page/dorfromantik-developer-success-has-opened-a-lot-of-doors-for-us-23775)].
- **Referências de estilo:** arte naïf para árvores e casas; pintura impressionista para textura e cor; "a alegria de pintar de Bob Ross com a tatilidade de Carcassonne"; formas básicas, bem compostas, quentes e um pouco lúdicas [F, entrevistas: [Digital Trends](https://www.digitaltrends.com/gaming/dorfromantik-interview/), [GOG](https://www.gog.com/news/binterview_toukana_interactive_tells_us_more_about_dorfromantikb), [Game Developer](https://www.gamedeveloper.com/business/sparking-joy-through-tile-placement-in-idyllic-village-builder-i-dorfromantik-i-)].
- **Pipeline (80.lv, 25/05/2026) [F]:** albedo em tons de cinza pintado à mão (Procreate); outlines feitos em Blender, Substance Painter e por máscara de fresnel no Unity; mapas de AO; cores aplicadas por **"color sets" por bioma e por objeto**; pipeline próprio de **vertex color**. O sistema é "mais modular que procedural": peças curadas, recombinadas por regras. As paletas de cada bioma são feitas à mão e a **cor define o clima, em vez de iluminação complexa** ([80.lv](https://80.lv/articles/how-dorfromantik-expands-its-cozy-world-through-minimalist-design)).
- **O que não achei:** confirmação pública de tilt-shift/DOF, GI ou ray tracing, nem devlog técnico sobre animação/partículas, nem talk de GDC/Unite. As melhores fontes são o [devlog no itch.io](https://toukana.itch.io/dorfromantik-prototype/devlog) (DevlogROMANTIK #2 e #3), [GOG](https://www.gog.com/news/binterview_toukana_interactive_tells_us_more_about_dorfromantikb) e as entrevistas acima.
- **Observação de gameplay [E, não confirmada]:** peça assenta com pequeno bounce, árvores "brotam" com escala elástica, brilho branco no perfeito, fumaça de chaminé, moinho girando, trem/barco animados, fundo claro e vazio ao redor do mapa.

**Receita equivalente em Three.js [E]:**

| Efeito | Técnica | Custo |
|---|---|---|
| Paleta pintada | vertex colors + uma textura cinza de ruído/pincelada × `instanceColor` do tema | ~0 |
| Contorno suave | fresnel/rim no shader, ou "inverted hull" só nos props principais | baixo |
| AO | AO assado em vertex color (Blender) + AO em tela opcional ([N8AO](https://github.com/N8python/n8ao), meia resolução) | 0 / médio |
| Sombras suaves | 1 luz direcional, PCFSoft/VSM, mapa 2048 ajustado ao frustum, atualizado só quando muda | médio |
| Profundidade | névoa na cor do fundo + tilt-shift/DOF opcional ([pmndrs postprocessing](https://react-postprocessing.docs.pmnd.rs/effects/tilt-shift)) | baixo–médio |
| Variedade | seed por coordenada hex → rotação, escala e tint por instância; vento no vertex shader | ~0 |
| Feedback | tween de escala/altura (easeOutBack), poeira/pétalas em `Points` | baixo |

---

## 3. Comparativo de stacks

| Stack | Prós | Contras | Licença / custo | Web / mobile | Curva / maturidade |
|---|---|---|---|---|---|
| **Godot 4.x** (4.7, jun/2026) | Editor completo, GDScript, exporta PC/Android/iOS nativos, sem royalties | Web só com Compatibility (WebGL2), **sem WebGPU**; C# na web não confirmado; wasm de dezenas de MB [E]; consoles via parceiros | MIT, grátis [F] | Web ok no desktop, pesado no mobile; mobile nativo bom | baixa–média / alta em 2D, boa em 3D |
| **Unity 6** (6.6, set/2026) | Padrão do gênero (Dorfromantik, Islanders, Townscaper, Cloud Gardens); URP, Shader Graph, VFX Graph; caminho mais fácil para console | Build web grande (5–15 MB no mínimo; 25–50 MB em projetos reais [F, 3ª parte]), memória no iOS Safari; WebGPU só habilitado à mão | Personal grátis abaixo de US$ 200 mil de receita/funding; Pro US$ 2.310/ano/assento; **Runtime Fee cancelada** (set/2024) [F] | Web WebGL2 por padrão; WebGPU "oficial" no 6.6 segundo blog de terceiros [F]; browsers mobile desde o Unity 6 | média / máxima |
| **Three.js** (r185, jul/2026) | ~0,5–1 MB tree-shaken, iteração instantânea (Vite/TS), UI em HTML/CSS, link compartilhável; WebGLRenderer estável e WebGPURenderer com fallback WebGL2; InstancedMesh/BatchedMesh | Não é engine (sem editor, pipeline de assets, áudio, input); WebGPURenderer tem custo de CPU maior com muitas meshes; API em mudança (PostProcessing virou RenderPipeline no r183 [F, 3ª parte]) | MIT [C] | Web excelente; Steam via Electron; mobile via PWA/Capacitor | média–alta na arquitetura / biblioteca madura, "engine" a montar |
| **Babylon.js** (9.0, mar/2026) | Engine completa (Inspector, Node Material Editor, GUI, Havok); WebGPU de 1ª classe (WGSL nativo); *snapshot rendering* (até ~10× menos CPU em cena estática); clustered lighting no 9.0 | Bundle maior [E]; comunidade menor que a do Three | Apache-2.0 [C] | Web excelente; mobile via wrappers | média / alta |
| **Bevy** (0.19, jun/2026) | ECS em Rust; Tiny Glade usa Bevy modificado (2 devs) | Pré-1.0 (quebra de API a cada release), sem editor, Rust íngreme, wasm pesado [E] | MIT/Apache-2.0 [C] | Web via WebGL2/WebGPU, mobile imaturo | alta / baixa–média |
| **PlayCanvas** (engine 2.19, jun/2026) | Runtime leve, editor colaborativo na nuvem (front-end aberto em 2025), ótimo para web/mobile | WebGL2 primeiro (WebGPU ainda amadurecendo), editor em nuvem, comunidade menor | Engine MIT; editor: grátis (projetos públicos), ~US$ 15/mês, ~US$ 50/assento/mês [F] | Web e mobile-web excelentes; Steam via wrapper | baixa–média / alta na web |

Fontes: [Godot web](https://docs.godotengine.org/en/4.2/tutorials/export/exporting_for_web.html), [Godot 4.7](https://app.cinevva.com/news/2026-06-19-godot-4-7-released), [Unity Runtime Fee](https://unity.com/en/blog/unity-is-canceling-the-runtime-fee), [Unity 6.6 WebGPU](https://app.cinevva.com/news/2026-09-01-unity-6-6-webgpu-production), [Unity Web x Three.js](https://www.utsubo.com/blog/threejs-vs-unity-web-comparison), [Unity mobile web](https://unity.com/blog/engine-platform/web-runtime-updates-enhance-browser-experience), [Three.js 2026](https://www.utsubo.com/blog/threejs-2026-what-changed), [Babylon 8.0](https://blogs.windows.com/blog/2025/03/27/announcing-babylon-js-8-0/), [Babylon 9.0](https://blogs.windows.com/blog/2026/03/26/announcing-babylon-js-9-0/), [Bevy 0.19](https://bevy.org/news/bevy-0-19/), [Tiny Glade/Bevy](https://80.lv/articles/exclusive-tiny-glade-developers-discuss-bevy-proceduralism-publishers-cozy-games), [PlayCanvas](https://playcanvas.com/products/engine), [planos](https://playcanvas.com/plans). Cinevva e Utsubo são blogs comerciais (fontes de terceiros): confirme versões e datas nas release notes oficiais.

### Recomendação por cenário

- **Protótipo rápido:** **Three.js + TS + Vite** (o que você já está fazendo). Zero licença, deploy por link, iteração em segundos. Godot é a alternativa se preferir editor.
- **Jogo comercial na Steam:** **Unity 6 (URP)** se a equipe já domina Unity ou pretende console/mobile via parceiros (é o pipeline do original); **Godot 4** se a equipe é pequena, quer zero risco de licença e builds leves. **Three.js + Electron + steamworks.js** é viável para escopo enxuto ([Phaser](https://phaser.io/news/2025/03/publishing-web-games-on-steam-with-electron)), mas overlay, controle/Steam Deck e memória exigem trabalho. Tauri: um fórum relata que não havia integração Steamworks funcional (data incerta) [F].
- **Web-first:** **Three.js** (tamanho, DOM para UI). Babylon.js se quiser Inspector, editor de materiais e WebGPU de 1ª classe. PlayCanvas se artistas precisarem de editor colaborativo.
- **Portabilidade [E]:** mantenha o **núcleo de regras em TS puro** (sem importar `three`) e os temas como **dados**. Trocar de renderer ou engine passa a custar só a camada de apresentação.

---

## 4. Performance para milhares de peças

**Ordem de grandeza (cálculo ilustrativo [E]):** 1.500 peças × 8 props ≈ 12.000 instâncias; a 150 triângulos cada, ≈ 1,8 M de triângulos no total e ≈ 450 mil visíveis (25%). Sem instancing seriam 12.000 draw calls, inviável. Com ~24 tipos de prop instanciados, mais ~40 chunks de terreno, ficam ~100 draw calls incluindo sombras. A matriz de 12.000 instâncias pesa ~0,75 MB.

| Técnica | Como aplicar | Números / fonte |
|---|---|---|
| **Instancing** | um `InstancedMesh` por tipo de prop, `instanceColor` para o tema | "1.000 objetos = 1 draw call" [F, [Utsubo](https://www.utsubo.com/blog/threejs-best-practices-100-tips)] |
| **Chunks** | grade de ~8×8 hexes; só o chunk afetado é reconstruído | mapas de 56–57 mil hexes fluem com instancing ou merge [F, [fórum Three.js](https://discourse.threejs.org/t/best-rendering-optimization-strategy-for-25-000-hexagons/83602)] |
| **Culling** | `InstancedMesh` só corta como um todo (uma bounding sphere) [C]: use chunks, `BatchedMesh` ou InstancedMesh2 | InstancedMesh2 (lib de terceiros): 1 M de instâncias a 40–70 fps, segundo o autor [F, [fórum](https://discourse.threejs.org/t/instancedmesh2-easy-handling-and-frustum-culling/58622)]; exemplo `webgl_batch_lod_bvh` do three.js (com extensões three.ez): 500 mil instâncias [F, [exemplo](https://threejs.org/examples/webgl_batch_lod_bvh.html)] |
| **LOD / impostores** | 2 níveis bastam (câmera limitada): árvore vira cone e casa vira caixa ao afastar; opcionalmente funde o decor do chunk | [E] |
| **Sombras** | 1 luz fixa; `shadowMap.autoUpdate = false` + `needsUpdate` sob demanda; CSM só se a câmera inclinar muito | [F, [fórum](https://discourse.threejs.org/t/renderer-shadowmap-autoupdate-false/50401)]; CSM: 4 cascatas no desktop e 2 no mobile [F, Utsubo] |
| **AO barato** | AO assado em vertex color; em tela, N8AO/GTAO em meia resolução, só em "alto" | [F, [N8AO](https://github.com/N8python/n8ao)] |
| **Resolução** | `setPixelRatio(min(dpr, 2))`; resolução dinâmica; pós em meia resolução | meia resolução "pode dobrar o fps" em cenas limitadas por fill-rate [F, Utsubo] |
| **Texturas** | KTX2/Basis, atlas, uma paleta compartilhada (1 material = mais batching) | [C] |
| **Render sob demanda** | sem input nem animação, pular frames (bateria) | [E] |

**Draw calls, WebGL2 vs WebGPU:** meta de ~100 por frame no mobile [F, Utsubo; [Codrops](https://tympanus.net/codrops/?p=86572)]; no desktop, algumas centenas a poucos milhares [E]. WebGPU reduz o overhead por draw, mas cada mesh ainda emite 6–10 chamadas de API [F, [fórum Babylon](https://forum.babylonjs.com/t/why-webgpu-backend-is-slower/24091/3)]; *render bundles/snapshot* do Babylon dão até ~10× menos CPU em cenas estáticas [F]. No Three.js r183, o `WebGPURenderer` custou ~2× mais CPU por frame e primeiro frame 5–10× mais lento com 4.000 meshes separadas [F, [fórum](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904)]. Com instancing esse problema some. Cobertura de WebGPU: ~76% globalmente e ~60% no Android, segundo agregadores [F, [Enterno](https://enterno.io/en/s/research-webgpu-adoption-browsers-2026)]; Safari 26 e Firefox 141+ (Windows) já suportam [F, [web.dev](https://web.dev/blog/webgpu-supported-major-browsers)]. **Ficar em WebGL2 por padrão e tratar WebGPU como opcional.**

**Mobile:** GPUs *tile-based* sofrem com banda e fill-rate; cada passe extra de pós-processamento custa caro. Perfis low/med/high: sem AO, 1 sombra a 1024, DPR 1,5, densidade de props reduzida, texturas ≤ 1024 [E].

**Orçamento de referência [E]:**

| | Desktop | Mobile médio |
|---|---|---|
| Triângulos na tela | 1–3 M | 200–500 mil |
| Draw calls | ≤ 300 | ≤ 100 |
| Sombras | 2048, 1–2 cascatas | 1024, 1 mapa ou desligada |
| Pós | AA + AO + bloom | só AA e vinheta |

**Dicas de implementação [E]:** *picking* por matemática (raio-plano para coordenada axial, O(1), guia [Red Blob Games](https://www.redblobgames.com/grids/hexagons/) [C]); grupos e "arestas abertas" por flood-fill incremental; aleatoriedade determinística por hash da coordenada para o mapa ficar estável entre saves.

---

## 5. Jogos similares e o que ensinam

| Jogo | Dados | Lição |
|---|---|---|
| **Dorfromantik** (2021 EA, 2022 v1.0) | ~US$ 14; Steam 96% positivo em ~29 mil reviews; Metacritic 84 ([Wikipedia](https://en.wikipedia.org/wiki/Dorfromantik)); 2 prêmios no Deutscher Computerspielpreis 2021, Melhor Estreia e Game Design ([Berliner Zeitung](https://www.berliner-zeitung.de/article/cloudpunk-und-dorfromantik-computerspiele-aus-berlin-sahnen-hauptpreise-ab-152373)). Vendas: **estimativa** de 526,9 mil cópias / US$ 4,4 M na Steam ([raijin.gg](https://raijin.gg/app/1455840/Dorfromantik)); SteamSpy: 1–2 M de "owners" (faixa ampla) | Loop simples + polimento. O protótipo grátis no itch.io (>20 mil jogadores, bundle beneficente) virou tração; o EA saiu 6 meses antes do planejado e "explodiu" [F, [itch devlog](https://toukana.itch.io/dorfromantik-prototype/devlog), [Galaxus](https://www.digitec.ch/en/page/dorfromantik-developer-success-has-opened-a-lot-of-doors-for-us-23775)] |
| **Islanders** (2019) | US$ 4,99; Unity; 3 pessoas, ~7 meses; **estimativa** de agregadores: 1,29 M de cópias e US$ 6,5 M ([vaporlens](https://vaporlens.app/app/1046030/islanders/stats/details)) | Preço baixo e escopo mínimo geram volume; pontuação por adjacência é legível |
| **Townscaper** (2021) | US$ 4,99; Unity; 380 mil cópias na Steam e >500 mil somando PC/Mac/Switch ([MCV](https://mcvuk.com/business-news/when-we-made-townscaper)); WFC em grade irregular ([Game Developer](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making)) | "Brinquedo, não jogo": o prazer é o ato de colocar; geração procedural faz o resultado sempre parecer bonito |
| **Tiny Glade** (set/2024) | US$ 15; 2 devs; Bevy modificado; 616 mil cópias em <1 mês; 97% positivo em ~8,3 mil reviews; 1,93 M de wishlists ([GameDiscoverCo](https://newsletter.gamediscover.co/p/how-tiny-glade-built-its-way-to-600k)) | Wishlists comandam o lançamento; "delight" em cada interação vende |
| **Cloud Gardens** (2021) | US$ 17,99; Unity; 95% positivo em ~2 mil reviews | Verbo diferente (plantar) e clima; nicho contemplativo tem público fiel |
| **Isle of Arrows** | US$ 12,99; tile placement + tower defense (Daniel Lutz, de Hitman GO) | Hibridizar o loop com outro gênero abre espaço |
| **Tile Cities** (05/2022) | 547 reviews, 94% positivo | Indies pequenos sobrevivem no nicho, sem estourar |
| **Kingdomino** (2016), **Carcassonne** (2000) | Spiel des Jahres 2017 (Kingdomino); Carcassonne, SdJ 2001 [C] | O núcleo "casar bordas" é antigo e livre; a diferença está na apresentação e nos objetivos |
| **Dorfromantik: tabuleiro** (2022) | Spiel des Jahres 2023 | O loop é robusto o bastante para virar jogo de mesa |

Outros títulos do nicho citados em listas de "jogos parecidos": Terra Nil, Urbo, Preserve, Polytopia ([Cozy Gaming Nook](https://thecozygamingnook.com/games-like-dorfromantik/)).

**Padrões:** ~US$ 5–18, 1–3 pessoas, feedback tátil e estético acima de profundidade sistêmica, e Unity domina (com Bevy como exceção autoral). A maioria dos jogos Steam vende pouco: metade dos lançados em 3 anos faturou ≤ US$ 500 ([Gamalytic via WN Hub](https://wnhub.io/news/stores-and-publishing/item-42136)); os casos acima são outliers.

---

## 6. Aspectos legais e propriedade intelectual

> **Aviso:** isto não é aconselhamento jurídico. Consulte advogado de PI antes de lançar.

### 6.1 O que não é protegido

- **EUA:** 17 U.S.C. § 102(b) exclui "qualquer ideia, procedimento, processo, sistema, método de operação, conceito, princípio ou descoberta" ([Circular 33](https://www.copyright.gov/circs/circ33.pdf)). O Copyright Office diz sobre jogos que a lei não protege "a ideia do jogo, seu nome ou título, nem o(s) método(s) de jogar", e que, uma vez público, "ninguém pode reivindicar direitos exclusivos sobre a ideia de jogá-lo" ([folha FL-108 arquivada](https://webharvest.gov/peth04/20041015023438/http://www.copyright.gov/fls/fl108.html); [ABA Landslide](https://www.americanbar.org/groups/intellectual_property_law/resources/landslide/archive/why-videogame-rules-are-not-expression-protected-copyright-law/)) [F; citação reproduzida por fontes secundárias, não consegui abrir o PDF]. *Scènes à faire*: elementos indispensáveis ou padrão do gênero também ficam livres ([Data East v. Epyx, 9th Cir. 1988](https://law.resource.org/pub/us/case/reporter/F2/862/862.F2d.204.87-2294.html)) [F].
- **Brasil:** Lei 9.610/98, art. 8º: não são objeto de proteção "as ideias, procedimentos normativos, sistemas, métodos, projetos ou conceitos matemáticos como tais" (I) e "os esquemas, planos ou regras para realizar atos mentais, **jogar** ou negociar" (II) ([WIPO Lex](https://www.wipo.int/wipolex/es/text/1304)) [F]. O software é protegido como obra literária (Lei 9.609/98, 50 anos), cobrindo a expressão do código, não procedimentos ou métodos ([Lei 9.609](https://cinttec.ufs.br/uploads/page_attach/path/1083/Lei_N__9.609_98_-_Lei_de_programas_de_computador.pdf)) [F].
- **Precedentes de gênero [C]:** casar bordas de peças vem do dominó, de Carcassonne (2000) e de Kingdomino (2016) ([Wikipedia](https://en.wikipedia.org/wiki/Kingdomino) [F] para Kingdomino). O Dorfromantik é ele próprio uma combinação de ideias anteriores.

### 6.2 O que é protegido ou arriscado

- **Tetris Holding v. Xio Interactive** (D.N.J., 30/05/2012): as regras são livres, mas o clone "Mino" **infringiu** ao copiar a expressão audiovisual: forma, cor e estilo das peças, dimensões do campo, aparência geral. Houve também trade dress ([Wikipedia](https://en.wikipedia.org/wiki/Tetris_Holding,_LLC_v._Xio_Interactive,_Inc.), [Loeb](https://www.loeb.com/zh-hans/insights/publications/2012/06/tetris-holding-llc-v-xio-interactive-inc)) [F].
- **Spry Fox v. LOLApps/6waves** (W.D. Wash., 2012): Yeti Town vs. Triple Town. O juiz rejeitou o pedido de arquivamento (o "look and feel" pode ser protegido); acordo confidencial, com Spry Fox ficando com o IP de Yeti Town ([Wikipedia](https://en.wikipedia.org/wiki/Spry_Fox,_LLC_v._Lolapps,_Inc.), [PocketGamer](https://www.pocketgamer.com/news/6waves-settles-with-spry-fox-in-yeti-town-triple-town-clone-debate/)) [F]. Foi decisão preliminar, não julgamento de mérito [C].
- **Patentes:** mecânicas podem ser patenteadas em alguns países. Nintendo e Pokémon Co. processaram a Pocketpair (Palworld) por **patentes**, não por copyright, em Tóquio em 18/09/2024 ([NBC](https://www.nbcnews.com/tech/nintendo-pokemon-company-palworld-pocketpair-lawsuit-rcna171817)) [F]. Não pesquisei bases de patentes; faça busca de anterioridade/FTO antes de comercializar [E].
- **Brasil:** não há lei específica de trade dress; a proteção do "conjunto-imagem" vem da repressão à concorrência desleal (LPI art. 195; art. 209, confusão entre produtos/serviços) e de marcas no INPI ([Dizer o Direito](https://www.dizerodireito.com.br/2019/02/para-analisar-se-houve-imitacao-de.html), [Sturzenegger & Cavalcante](https://www.sturzeneggerecavalcante.com.br/artigos/trade-dress-protecao-pelo-ordenamento-juridico-brasileiro/)) [F]. Como o Dorfromantik é alemão, um litígio na UE também é plausível [E].

### 6.3 Diferenciação prática

| Elemento | Pode | Evitar |
|---|---|---|
| Regras | hex + bordas + missões + pilha + perfeitos; mude números e adicione twists | nada (é gênero) |
| Nome | nome próprio, com busca em INPI, EUIPO, USPTO e Steam | "Dorf-", "romantik", trocadilhos próximos; "Dorfromantik" no título ou ícone |
| Arte | estilo próprio (outra forma, paleta, ângulo) | copiar silhuetas de casas/árvores, ícones ou a combinação reconhecível (fundo branco vazio + bolhas numéricas + bandeiras vermelhas) |
| UI/HUD | layout, tipografia e ícones originais (ex.: missões em cartões laterais) | reproduzir o HUD |
| Som | música e SFX originais ou licenciados | samplear |
| Assets | CC0/CC-BY com licenças arquivadas | assets sem licença clara |
| Marketing | screenshots próprias; comparação honesta | sugerir afiliação |
| Processo | guardar moodboards de referências diversas (pinturas, dioramas, mapas) | referência única e literal |

---

## 7. Ideias de adaptação temática

**Regra de ouro:** manter **2 tipos lineares obrigatórios** (água e linha: rio, ferrovia, duto, ley line), que dão o quebra-cabeça, e **3–4 tipos livres**. Mudam nomes, modelos, paleta, som e strings, não a estrutura. Cada tema é um pacote de dados, com um módulo opcional de regra.

| Tema | Livres: floresta / vila / campo / neutro | Obrigatórios: água / linha | Twist leve |
|---|---|---|---|
| **Brasil: Cerrado e Mata Atlântica** | mata (ipê, buriti, araucária) / arraial colorido / roça (milho, mandioca, café) / campo-cerrado com gado | rio (capivara, boto) / estrada de ferro (maria-fumaça) | **Aceiro:** mata encostada em roça, sem prado ou água no meio, pisca "risco de fogo" (só aviso); isolar com aceiro dá +1 peça |
| **Japão (satoyama)** | bambu e cedro, sakura / vilarejo com santuário / arrozais em terraço / jardim zen | rio com torii e carpas / trem regional | **Hanami:** a cada 25 peças, floração; as 5 seguintes dão +5 pts por aresta de floresta que toque água |
| **Marte: colônia** | estufas / módulos e cúpulas / hidroponia e painéis solares / regolito | dutos de gelo-água / trilho maglev | **Terraformação:** cada encaixe perfeito "esverdeia" um hex vizinho (+1 pt por vizinho verde); o mapa vai do vermelho ao verde |
| **Fundo do mar** | kelp e corais / cidades de concha / fazendas de algas / areia | correntes marinhas / tubos e cabos | **Profundidade:** multiplicador de pontos cresce com a distância ao centro (até ×2), incentivando expandir; paleta escurece com bioluminescência |
| **Outono e inverno nórdico** | pinheiral nevado / chalés com fumaça / abóboras e feno, ou campo congelado / neve | rio que congela / trem de montanha | **Lenha e lareira:** a cada 40 peças, outono vira inverno; no inverno vilas coladas à floresta valem +5 por casa |
| **Fantasia** | floresta com cogumelos luminosos / torres de mago e vilas de anões / hortas de poções e cristais / campo de flores | rio de mana / linhas de ley rúnicas | **Portal:** a cada 40 peças surge um portal-âncora; ligar 2 por linha de ley dá +3 peças |
| **Deserto: vale do Nilo** | palmeirais e oásis / aldeias e templos / campos irrigados / dunas | Nilo / rota de caravana | **Cheia do Nilo:** a cada 30 peças, campos junto ao rio valem 2× nas 5 peças seguintes |
| **Cidade retrofuturista** | parques néon / arranha-céus / fazendas verticais / praças | canais / monotrilho | **Dia e noite:** o ciclo alterna por peça; à noite, casas iluminadas somam +1 nas missões "exatamente N" (margem de erro) |

Nenhum twist pune o jogador; todos só recompensam, para preservar o clima relaxante [E].

**Arquitetura de tema [E]:**

```ts
type Terrain = 'woods' | 'settlement' | 'field' | 'neutral' | 'water' | 'line';
interface Theme {
  id: string; strings: Record<string, string>;
  terrains: Record<Terrain, { palette: string[]; models: string[]; sfx: string }>;
  quests: { label: string; terrain: Terrain; min: number; exact: boolean }[];
  twist?: { onPlace?: Hook; onQuestDone?: Hook; onTick?: Hook };
}
```

---

## 8. Estimativa de esforço (**todas as cifras são estimativas [E]**)

Premissas: US$ 3–8 mil por pessoa-mês (faixa ilustrativa, do Brasil à Europa/EUA). Âncoras reais [F]: Dorfromantik, 4 pessoas, protótipo abr/2020 → EA mar/2021 → 1.0 abr/2022 (~2 anos); Islanders, 3 estudantes, ~7 meses ([WN Hub](https://wnhub.io/news/analytics/item-2245)); Tiny Glade, 2 devs, "mais de dois anos" com tecnologia própria ([80.lv](https://80.lv/articles/exclusive-tiny-glade-developers-discuss-bevy-proceduralism-publishers-cozy-games)).

| Escopo | Equipe e papéis | Prazo | Entregáveis | Custo aproximado |
|---|---|---|---|---|
| **(a) Protótipo jogável** | 1 dev (TS/Three.js) | 2–4 semanas | grid hex, pilha, rotação, encaixe com água/trilho obrigatórios, pontos, missões N/N+, bandeiras, fim de jogo, 1 tema com props procedurais ou CC0 | 0,5–1 pessoa-mês ≈ US$ 1,5–8 mil; assets ~US$ 0 |
| **(b) Vertical slice bonito** | 1 dev gameplay/render, 1 artista 3D/tech-art, ~0,5 UI/UX, ~0,25 som | 8–12 semanas | 1 tema polido (40–80 props com variantes), *juice* (assentar, partículas, SFX), sombras/AO/paleta, 2 modos, save, perf em mobile médio | 3–6 pessoa-mês ≈ US$ 9–48 mil; música/SFX ~US$ 0,5–3 mil (royalty-free de €20–300 por faixa) |
| **(c) Jogo completo Steam** | 1–2 devs, 1–2 artistas 3D, 0,5 UI/UX, som freelancer, 0,5 QA/comunidade | 9–18 meses | 3+ temas, 8–12 peças especiais, 40–80 challenges, modos Classic/Creative/Quick/Hard/Monthly/Custom, conquistas, nuvem, controle e Steam Deck, i18n (EN, PT-BR+), página e marketing | 24–70 pessoa-mês ≈ US$ 72–560 mil; música original de 30–60 min a US$ 200–1.000/min = US$ 6–60 mil; Steam Direct US$ 100; comissão da Steam 30% |

Fontes de custo [F]: [música indie](https://ninichimusic.com/blog/understanding-how-much-an-indie-game-music-composer-costs) e [licenças](https://www.artfolio.com/article/pitching-original-scores-for-indie-games-timelines-asset-packs-and-license-fees) (indies gastam 5–10% do orçamento em áudio); [Steam Direct e revenue share](https://fungies.io/steam-revenue-share-explained/). Marketing, localização e portes para console não foram orçados.

---

## 9. Riscos, mitigação e conclusão

### 9.1 Riscos

| Risco | Prob./impacto [E] | Mitigação |
|---|---|---|
| Loop sem "mágica" (tuning) | alta / alto | playtests desde a semana 2; constantes parametrizáveis; distribuição de peças anti-frustração e undo (o original rebalanceou em mar/2022) |
| Performance em mobile web (Safari iOS, Android médio) | média / alto | ~100 draw calls, instancing por chunk, DPR ≤ 2, pós em meia resolução, perfis low/med/high, testar em aparelhos reais |
| WebGPU fragmentado e mais caro em CPU | média / médio | WebGL2 por padrão; WebGPU opcional com *feature detection* |
| Similaridade legal (visual, nome, UI) | média / alto | checklist da §6.3; revisão jurídica pré-lançamento; identidade própria desde o início |
| Escopo de arte (temas × props) | alta / alto | kit modular + paleta/`instanceColor`; um tema polido antes dos outros; re-skin reaproveitando geometria (como o original faz com color sets) |
| Mercado saturado e descoberta | alta / alto | demo e wishlists (Tiny Glade: 1,93 M para 616 mil vendas em <1 mês); nicho temático (ex.: Brasil) |
| Steam via Electron (overlay, controle, memória) | média / médio | testar o wrapper cedo; plano B: portar a camada de render mantendo o núcleo TS |
| Áudio e atmosfera subestimados | média / médio | música em camadas adaptativas; orçar desde o vertical slice |
| Acessibilidade (daltonismo nos tipos de borda) | média / baixo | ícones e padrões além da cor |
| Bibliotecas em mudança (three r18x) | média / baixo | fixar versão; isolar o renderer atrás de uma interface |

### 9.2 Conclusão

**É viável, e com folga técnica.** O original roda em GPUs de entrada (GT 550M, HD 520) e no Switch, com 388 MB, então o risco de performance está em como você monta a cena (instancing, chunks, sombras em cache, pós em meia resolução), não no gênero. As mecânicas são livres; o que exige cuidado é a **identidade visual, o nome e a UI**.

**Stack recomendada:** **Three.js + TS + Vite** para o protótipo e o vertical slice, com **núcleo de regras em TS puro e temas como dados**. Para o jogo comercial, decida depois do vertical slice: manter Three.js + Electron (escopo enxuto, web-first) ou reimplementar a apresentação em **Unity 6** (mais seguro para console e mobile) ou **Godot 4** (sem risco de licença).

**Principais cuidados:**
1. Parametrizar todas as constantes de balanceamento.
2. Orçamento de draw calls e perfis de qualidade desde o início.
3. Um tema polido antes de multiplicar temas.
4. Distância deliberada do visual, nome e HUD do Dorfromantik.
5. Wishlists e demo antes do lançamento.

---

## Fontes principais

Dorfromantik: [Wikipedia](https://en.wikipedia.org/wiki/Dorfromantik) · [Guia Steam (missões/recompensas)](https://steamcommunity.com/sharedfiles/filedetails/?id=2440566562) · [Challenges (Steam)](https://steamcommunity.com/sharedfiles/filedetails/?id=2515878894) · [80.lv (arte)](https://80.lv/articles/how-dorfromantik-expands-its-cozy-world-through-minimalist-design) · [Digital Trends](https://www.digitaltrends.com/gaming/dorfromantik-interview/) · [Game Developer](https://www.gamedeveloper.com/business/sparking-joy-through-tile-placement-in-idyllic-village-builder-i-dorfromantik-i-) · [Berlin.de](https://www.berlin.de/gamescapital/interviews/toukana-interactive-berlin-is-a-network-of-support-and-inspiration-1578184.en.php) · [itch.io devlog](https://toukana.itch.io/dorfromantik-prototype/devlog) · [Undo/balance](https://gamedeveloper.com/press-release/dorfromantik-undo-button-more) · [Gematsu](https://www.gematsu.com/2025/05/dorfromantik-coming-to-ps5-xbox-series-ps4-xbox-one-and-mobile).
Stacks e performance: [Utsubo 100 tips](https://www.utsubo.com/blog/threejs-best-practices-100-tips) · [Codrops](https://tympanus.net/codrops/?p=86572) · [fórum Three.js (WebGPU custo)](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904) · [web.dev WebGPU](https://web.dev/blog/webgpu-supported-major-browsers) · [Unity licença](https://unity.com/en/blog/unity-is-canceling-the-runtime-fee) · [Babylon 9.0](https://blogs.windows.com/blog/2026/03/26/announcing-babylon-js-9-0/) · [Bevy 0.19](https://bevy.org/news/bevy-0-19/).
Legal: [Circular 33](https://www.copyright.gov/circs/circ33.pdf) · [FL-108](https://webharvest.gov/peth04/20041015023438/http://www.copyright.gov/fls/fl108.html) · [Tetris v. Xio](https://en.wikipedia.org/wiki/Tetris_Holding,_LLC_v._Xio_Interactive,_Inc.) · [Spry Fox](https://en.wikipedia.org/wiki/Spry_Fox,_LLC_v._Lolapps,_Inc.) · [Lei 9.610 (WIPO Lex)](https://www.wipo.int/wipolex/es/text/1304) · [Trade dress no Brasil](https://www.sturzeneggerecavalcante.com.br/artigos/trade-dress-protecao-pelo-ordenamento-juridico-brasileiro/).
