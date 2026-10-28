# Pesquisa visual: levar o resto do mundo ao nível da água

Pedido do Roger: "aprimoramento dos demais relevos, tal como a água". Porta 4275, branch `dorf/v1-visual`.

## Por que a água ganha das outras coisas

A água tem profundidade física (leito, absorção por canal), Fresnel, cáusticas e movimento. O chão, as árvores e as casas têm cor boa, mas ficam parados e planos na luz. Cada técnica abaixo copia uma virtude da água: **movimento coerente**, **luz que atravessa** ou **forma que muda com o ângulo**.

## Como a pesquisa foi feita (e os limites)

Busquei exemplos oficiais do three.js (WebGPU/TSL), fóruns e artigos de jogos estilizados. A busca **não achou** um making-of de Tiny Glade, Townscaper, Islanders nem Bad North com os shaders. O que está abaixo vem de tutoriais e shaders abertos; onde não achei fonte, digo "prática comum".

Fontes:
- Exemplos WebGPU do three.js (ver `webgpu_tsl_*`, `webgpu_ocean`, `webgpu_postprocessing_ao`): https://threejs.org/examples/?q=webgpu
- Grama WebGPU com TSL (vento em arco, rajadas, translucência, variação macro): https://discourse.threejs.org/t/high-performance-grass-rendering-in-three-js-webgpu/94175
- Skill de vegetação procedural em three.js: https://moltchat-agent-commons.onrender.com/wiki/threejs-procedural-vegetation_skill_(Threejs-Awesome-Graphics-Agent-Skills).md
- Folhagem com subsurface falso (método de Alan Zucconi, sigma ~0,02): https://godotshaders.com/shader/simple-foliage-subsurface-scattering-shader/
- Folhagem low-poly em Shader Graph (translucência, normal de dois lados, vento): https://nedmakesgames.medium.com/creating-a-foliage-shader-in-unity-urp-shader-graph-5854bf8dc4c2
- Grama estilo Zelda com vento por ruído: https://godotshaders.com/shader/stylized-grass-with-wind-and-deformation/
- Manchas de vento e sombra de nuvem deslizando: https://godotshaders.com/shader/animated-grassy-wind-or-cloud-shadow-pixel-patches-overlay/
- Iluminação de folhagem só com normais ajustadas: https://kops.uni-konstanz.de/entities/publication/d642d76b-a9f3-4e38-bedb-1f8f7d144622/full
- TSLFX (efeitos em TSL): https://github.com/verekia/tslfx

Os esboços usam nomes do r186 (`positionWorld`, `normalWorld`, `cameraPosition`, `U.sunDir`).

## Chão e relevo

**1. Ondas de vento na luz do chão.** Uma mancha clara e escura de ruído desliza pelo prado, pela mata e pelo campo na direção do vento, na mesma direção da onda que dobra o trigo.
- Ganho: alto. O chão passa a respirar, como a água. É o que dá vida ao prado de longe.
- Custo: 1 amostra de ruído no shader do chão. Zero triângulo.
- TSL: `w = texture(noiseTex, p.mul(0.07).sub(U.wind.mul(U.time.mul(0.12)))).g; ground.mul(w.sub(0.5).mul(0.22).add(1))`.
- No projeto: parcial. `cloudLight` leva sombra de nuvem ao chão e as plantas dobram em onda, mas o chão em si fica parado.

**2. Estratos e escurecimento do pé na rocha.** Faixas horizontais de tom, mais escuras nas frestas e perto do pé, mais claras no topo.
- Ganho: alto nas serras, hoje de cor única com pincelada.
- Custo: 1 a 2 amostras. Zero triângulo.
- TSL: `strata = texture(noiseTex, vec2(p.x.add(p.z).mul(.9), p.y.mul(9))).g; base.mul(strata.mul(.3).add(.85))`, e `smoothstep(0, .5, positionGeometry.y)` para o pé.
- No projeto: a lateral das peças já tem `strata` (`makeGroundMaterial`), as serras (`relief`) não.

**3. Mistura por inclinação (grama, terra, rocha).** O tom muda com `normalWorld.y`: topo plano verde, encosta íngreme terrosa ou rochosa.
- Ganho: médio. Nos morros e nas serras a encosta ganha leitura de terreno.
- Custo: baixo. TSL: `slope = smoothstep(.85, .45, normalWorld.y); mix(grass, rock, slope)`.
- No projeto: a neve já usa `normalWorld.y`; a mistura de terra não existe.

**4. Normal de micro-relevo.** Inclinar a normal com ruído para a luz rasante revelar grão.
- Ganho: médio. Custo: 1 amostra.
- No projeto: já faz (declive da `waterTex` no chão).

**5. Luz de borda em arestas (curvatura).** Realçar as quinas dos blocos.
- Ganho: médio. Custo: precisa de atributo de curvatura gravado na geometria; com `flatShading` a derivada da normal é nula dentro da face.
- No projeto: não faz.

**6. AO de contato (pé de casa, árvore e pedra).** Escurecer o chão ao redor dos objetos.
- Ganho: alto de perto. Custo: pintar no `groundMap` (append-only, invariante 10) ou halo no chão.
- No projeto: o GTAO do pós cobre na Alta e no Ultra. Falta na Baixa e na Média.

## Árvores e vegetação

**7. Translucência da copa (subsurface falso).** Contra o sol, a folha deixa passar luz: verde amarelado brilhante. De costas para o sol, nada muda.
- Ganho: alto. É o "brilho de dentro" que falta às árvores, e muda com o ângulo da câmera, como o Fresnel da água.
- Custo: só conta, sem textura e sem triângulo.
- TSL: `back = max(dot(v, sunDir.negate()), 0).pow(4); emissive.add(U.sun.mul(base).mul(back).mul(espessura))`, com `v` o vetor para a câmera.
- No projeto: faz luz de contorno (`rim`, `rimSun`), que é só borda. Translucência não.

**8. Gradiente vertical e AO de copa.** Pé da copa escuro, topo claro. No projeto: já faz (`grad` em `lib.ts`, por vértice).

**9. Cor por instância e pincelada.** No projeto: já faz (`iColor`, `paint: 'canopy'`).

**10. Vento hierárquico (tronco, galho, folha).** Três frequências somadas.
- Ganho: médio. Custo: conta no vértice.
- No projeto: `treeSway` tem uma frequência só, com rajada. Pode ganhar uma segunda, mais rápida, nas pontas.

**11. Normais arredondadas da copa.** No projeto: já faz (`smooth`).

## Casas

**12. Desgaste e sujeira no pé da parede.** Escurecer a parede perto do chão e variar por ruído.
- Ganho: médio. Custo: baixo (gradiente de `positionGeometry.y`). No projeto: só pincelada vertical.

**13. Janelas.** No projeto: já faz (`glow` com acendimento escalonado).

## Campos

**14. Brilho anisotrópico do trigo.** O campo reflete mais quando a câmera olha contra o vento.
- Ganho: médio. Custo: só conta.
- No projeto: `sheen` cobre a rajada (+22%), mas não depende do ângulo da câmera.

## Luz global

**15. Céu hemisférico, névoa em altura, sombra colorida.** No projeto: já faz (`sky.ts`, `atmosphere.ts`, `skyFor`).

## Ranking: as 6 que mais aproximam o resto da água (ganho dividido por custo)

| # | Técnica | Ganho | Custo | Situação |
|---|---|---|---|---|
| 1 | Translucência da copa (7) | alto | quase zero | feito, commit 1 |
| 2 | Ondas de vento na luz do chão (1) | alto | 1 amostra | feito, commit 2 |
| 3 | Estratos, pé escuro e encosta na rocha (2 e 3) | alto nas serras | 2 amostras | feito, commit 3 |
| 4 | Desgaste no pé das paredes (12) | médio | quase zero | sobra |
| 5 | Brilho do trigo contra o vento (14) | médio | quase zero | sobra |
| 6 | Vento hierárquico nas pontas (10) | médio | conta no vértice | sobra |

Ficaram fora do ranking o AO de contato (6) e a luz de borda por curvatura (5): exigem mexer no `groundMap` ou na geometria, e o AO do pós já cobre boa parte.

## O que veio das skills instaladas (~/.claude/skills)

Li `threejs-materials-lighting`, `shader-programming`, `threejs-scene-setup` e `performance-optimization`, com as pastas `references/`. Quase tudo é GLSL e WebGLRenderer; pelo AGENTS.md vale TSL e `three/webgpu`. O que aproveitei:
- **Fresnel/rim (shader-programming, padrão 4):** `1 - max(dot(N, V), 0)` elevado a uma potência. É a base da luz de contorno que o projeto já tem; a translucência (técnica 7) usa o mesmo vetor `V`, só que contra o sol (`dot(V, -sunDir)`).
- **UV com scroll e `fract` (padrão 2):** a mesma ideia das ondas de vento no chão (técnica 1); o ruído periódico `noiseTex` já repete sozinho.
- **Luminância Rec.709 (effects.md):** usei `luminance()` para a neve da serra quase não levar as faixas de rocha (técnica 2).
- **Checklist de shader (effects.md):** poucas amostras de textura (o maior custo), conta em vez de ramo, cálculo no vértice quando dá. Por isso o chão ganhou só 2 amostras e a rocha 2, sem ramos.
- **Luz hemisférica e sombras (materials-lighting):** o projeto já tem (`sky.ts`, cascatas). A skill confirma o viés de sombra (`bias`, `normalBias`) como remédio do acne; nada a mudar.
- **Método de desempenho (performance-optimization):** medir antes e depois, separar CPU e GPU, usar orçamento. Apliquei com o `stress.mjs` (draw calls e triângulos, que é o que vale no SwiftShader). Nenhuma das 3 técnicas muda draw calls nem triângulos.
- **Contrários ao AGENTS.md (ignorados):** GLSL/`ShaderMaterial`, `WebGLRenderer`, `EffectComposer`, `OrbitControls`, `setAnimationLoop` próprio.
