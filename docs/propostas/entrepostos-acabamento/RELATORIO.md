# Acabamento do Entrepostos

Branch `astra/entrepostos-acabamento`, implementação `3103d77` sobre `b482d24` (#119).

- A malha dos carimbos só entra no desenho quando contém geometria. O smoke abre o diálogo de frete após seis jogadas e reprova se encontrar aviso de atributo de vértice do Three.
- Cais, balizas e barcas usam `LitMaterial` com luz rebatida do chão, lampiões e oclusão da luz indireta. Cada casa reservada recebe uma baliza da cor do cais, no nível do vazio. A construção aparece no assentamento da peça de rio, e o replay monta o mesmo estado visual.
- A barca espera a água assentar. O cálculo é distribuído por quadros e usa a superfície desenhada, com folga das margens e cotas da malha. No Estaleiro da carta Rio bifurcado, semente 8, o oráculo observou 10/261 centros em terra na versão anterior e 0/258 no novo percurso.
- A [prancha do Egito do Nilo](egito-antes-depois.jpg) compara a mesma abertura em WebGL2. As pranchas da [Feira](baliza-cais-desfazer.jpg) e do [Estaleiro](estaleiro-antes-depois.jpg), em WebGPU, mostram a baliza antes do assentamento e depois de desfazer, e a comparação da chegada da barca.

`npm run check` passou, incluindo 600 partidas simuladas e 24 trajetos geométricos com 7.872 amostras do centro e 125.952 do contorno do casco, todas na água. O caso do diálogo passou em WebGL2. O Chrome headless com SwiftShader nesta máquina caiu para WebGL2 nos casos de WebGPU da suíte geral. A verificação visual em WebGPU usou uma RTX 3060.

No teste de carga em WebGL2, Egito do Nilo, semente 42 e 301 peças em Alta, os quadros sem atualização do mapa de sombras tiveram mediana de 110 chamadas de desenho em ambos os builds. A base desenhou 1.222.034 triângulos e o candidato 1.221.782, com 28.284 instâncias nos dois.
