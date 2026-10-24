# Plano da rodada 3: 5 temas profundos e relevo

Base: relatórios em scratchpad/temas/ (holanda, egito, oriental, brasil, inverno, relevo).

## T0: consolidar os temas (M, base de tudo)
- Ficam 5 temas: holanda, egito, oriental (Sakura + Song + Edo), brasil (Cerrado + Colonial) e inverno (com o Viking). Cada tema passa a ter um arquivo próprio (`src/themes/<id>.ts`), para as etapas seguintes rodarem em paralelo sem conflito.
- As fusões nascem só de dados e kits que já existem: o melhor de cada tema de origem.
- Tema padrão: Holanda (o Vale sai).
- Migração:
  - save em andamento de tema removido ou fundido é descartado com aviso;
  - os recordes dos temas fundidos passam para o tema novo, ficando o maior;
  - o progresso dos temas removidos fica guardado, sem uso;
  - `?theme=` antigo cai no tema novo correspondente.
- Atualizar testes, scripts (screenshots, weather), README, AGENTS.md e TEMAS.md (de 14 para 5).
- Pronto quando: check, smoke e weather.mjs verdes; capturas dos 5 temas.

## I1: estrutura comum para os temas (M)
Campos novos de `Theme`, todos opcionais, para não haver `if (theme.id)`:
- `fauna` (lista de bichos com peso e hora);
- `gates` (lista de portais);
- `ambience` (sons);
- `eggs` (easter eggs ativos);
- `holidays` (datas: São João, lua cheia, solstício);
- `skyFx: 'aurora'`;
- `floodplain` (chão pela distância ao rio);
- `terraces` (plantação em degraus).

Cada campo vem com um renderizador genérico, pronto para todos os temas. Easter egg por data é só cosmético: não entra no replay nem no save.

## T1 a T5: um PR por tema, em paralelo (cada um M a G)
- **Holanda:** dique de verdade no lugar da estrada, canais retos de pedra, casas geminadas com empenas (sino, pescoço, relógio), três moinhos (torre, paltrok, drenagem), ponte levadiça que abre com barco, tjalk, cisnes, bicicleta, bulbos. Ovos: tulipa dourada, menino do dique, Ronda Noturna.
- **Egito:** faixa fértil (terra negra e canais perto do Nilo, duna longe), cheia nos canteiros, shaduf, tamareiras e juncos, íbis, crocodilo, burros, casa em terraço com toldo, portal pilono, pirâmides no horizonte. Ovos: pirâmide completa por número de peças, barco solar ao meio-dia, Esfinge.
- **Oriental:** arrozais em terraço (alagado, degraus, dourado), torii e paifang juntos, pinheiro de jardim, garças, roda d'água, telhado irimoya, pagode, sampan, lótus. Ovos: cerejeira milenar, noite de lanternas, carpa dourada, maneki-neko.
- **Brasil:** café em terraço com florada e canavial com engenho, prado de cerrado (árvores tortas, cupinzeiros), ema, lobo-guará, tamanduá, araras, carro de boi e tropa, porteira, telhado colonial, buritis na vereda, entorno de chapada. Ovos: São João em junho, maria-fumaça, Doze Profetas.
- **Inverno Nórdico:** lago congelado no lugar da lavoura (buracos de pesca, tendas, varais), trenó de rena no lugar do trem, casa longa de turfa, igreja de madeira, drakkar, alce, sauna, aurora boreal. Ovos: aurora no solstício e outros.

## R: relevo
- **R1 (P, junto com os temas):** picos e morros decorativos como dado (`Theme.relief`, kit `peak` com versão leve). Sem mudar regras nem `SAVE_VERSION`.
- **R2 (M, depois dos temas):** níveis de altura por casa vindos de uma função pura da semente (`core/relief.ts`, `levelAt`), com degraus de no máximo 1 nível entre vizinhos e 2 no total. A peça alta desenha a parede inteira, estrada e trilho sobem por rampa, e o clique é feito por nível. Só aparência.
- **R3 (M):** cachoeiras onde o rio desce (cada lado monta a sua metade), espuma, névoa, som, barco dá meia-volta. Variante de cachoeira no mar nos temas com `surround: 'mar'`.
- **R4 (G, opcional, depois de jogar):** relevo que pontua (interação cachoeira) ou terreno Serra. Pede `SAVE_VERSION` 14.
- Relevo por tema: Holanda plana com diques; Egito com falésias do Nilo; Oriental com terraços e picos de névoa; Brasil com serras e cachoeira larga; Nórdico com picos nevados e fiorde.

## Ordem
T0 → I1 → (T1–T5 e R1 em paralelo, com integração e prévia no fim) → R2 → R3 → decidir R4.
