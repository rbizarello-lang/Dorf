import type { BlessingId } from '../core/blessings';
import type { Rules } from '../core/board';
import type { DayPhase, EggSpec } from '../core/eggs';

// Esquema de tema. Um tema é só dado: paleta, nomes e a escolha de "kits"
// (formas de árvore, casa, plantação, animal, barco, estrada e veículo).
// O renderizador sabe desenhar cada kit; o tema escolhe e colore.
// Índices de terreno (enum T): 0 Prado, 1 Floresta, 2 Plantação, 3 Vila, 4 Rio, 5 Estrada/trilhos.

export type Period = 'antiguidade' | 'medieval' | 'moderna' | 'contemporanea' | 'futuro' | 'fantasia';

export type TreeGeo =
  | 'conifer' // pinheiro em camadas
  | 'round' // copa redonda genérica
  | 'blossom' // copa florida em cachos (cerejeira, ipê)
  | 'palm' // palmeira / buriti / tamareira
  | 'crystal' // cristais (ficção)
  | 'cypress' // cipreste estreito e alto (quina marcada)
  | 'puff' // copa gorda e baixa em um bloco só (o contraste da mata contra o cipreste e o abeto)
  | 'spire' // abeto estreito e alto, de ponta
  | 'olive' // oliveira: copa larga e baixa, tronco retorcido
  | 'oak' // carvalho: copa grande em vários blocos
  | 'birch' // bétula: tronco branco, copa pequena
  | 'cactus' // cacto saguaro
  | 'bamboo' // touceira de bambu
  | 'araucaria' // araucária em "candelabro"
  | 'willow' // salgueiro-chorão: ramos pendentes
  | 'umbrella' // pinheiro-manso: tronco alto e copa chata em guarda-sol
  | 'waxpalm' // palmeira-de-cera: tronco muito alto e claro, copa pequena
  | 'poplar'; // álamo: coluna estreita e alta de três blocos (alamedas e cortinados de pôlder)

/** Corpo da casa (as proporções mudam o caráter da vila). */
export type BodyStyle =
  | 'cottage' // casa comum de dois águas
  | 'long' // casa comprida (viking, rancho)
  | 'cube' // cubo de adobe/pedra (Egito, Mediterrâneo)
  | 'terrace' // adobe em dois níveis: sala em cima, escada externa e terraço (Egito)
  | 'tall' // sobrado estreito de 2-3 andares (Holanda, colonial)
  | 'round' // cilíndrica (cabana andina, módulo marciano)
  | 'annex'; // corpo principal com um volume baixo encostado ao lado (celeiro, cozinha, estábulo)

export type RoofStyle =
  | 'gable' // duas águas
  | 'hip' // quatro águas
  | 'flat' // laje com mureta
  | 'dome' // cúpula
  | 'pagoda' // beirais curvos em camadas
  | 'thatch' // palha grossa e arredondada
  | 'turf' // grama sobre o telhado (use cor verde)
  | 'stepgable' // empena escalonada holandesa
  | 'bell' // empena de sino (barroca holandesa): cintura estreita, remate arredondado, em arenito claro
  | 'neck' // empena de pescoço: ombros em rampa e pescoço reto e alto, de tijolo, com viga de içamento
  | 'steep' // duas águas muito íngreme, com beiral curto (empena alta e estreita)
  | 'cross' // cumeeira cruzada: dois telhados de duas águas em cruz
  | 'cone' // cônico (cabanas redondas)
  | 'awning'; // laje com toldo de cana listrado sobre o terraço (use com `terrace`)

export interface HouseKind {
  weight: number;
  body: BodyStyle;
  roof: RoofStyle;
  /** Cores de parede (sorteadas por casa). */
  walls: string[];
  /** Cores de telhado (sorteadas por casa). */
  roofs: string[];
  /** Madeira aparente/enxaimel, molduras ou faixas. Omitir = sem detalhe. */
  trim?: string;
  /** Cor da porta. Omitir = a madeira do `trim` escurecida (ou marrom, sem `trim`). */
  door?: string;
  /** Chaminé com fumaça. */
  chimney?: boolean;
  /** Variante rara de silhueta: fica de fora da escolha do sobrado da terceira era (`risingKind`). */
  minor?: boolean;
  // Os campos abaixo vêm da era da vila (src/themes/progress.ts); o tema não precisa escrevê-los.
  /** Escala da casa inteira (padrão 1). */
  scale?: number;
  /** Tom multiplicado na parede, por cima da cor sorteada (taipa na primeira era). */
  tone?: string;
  /** Flâmula na cumeeira, nesta cor. */
  pennant?: string;
  /** Brilho das janelas à noite (padrão 1). */
  bright?: number;
}

/** Remate do palácio no Centro da vila, na última era. */
/** Timbre da melodia do tema (sintetizado em src/audio.ts). */
export type MusicTimbre =
  | 'flute' // seno com sopro (padrão)
  | 'reed' // palheta: dente-de-serra abafado
  | 'pluck' // corda dedilhada (Karplus-Strong)
  | 'bell' // sino ou carrilhão: parciais inarmônicas
  | 'glass'; // vidro: seno com parcial aguda

/** Forma da maravilha do tema (geometria paramétrica em lib.ts). */
export type WonderCore =
  | 'castle' // torre de menagem e 4 torres de conto
  | 'civic' // paço municipal: bloco com frontão e lanterna
  | 'church' // igreja colonial de duas torres
  | 'ice' // palácio de blocos de gelo que brilham
  | 'tree' // árvore milenar com torii
  | 'elevator' // elevador espacial: cabo alto com anéis de luz
  | 'pylon' // pilone, obeliscos e avenida de esfinges
  | 'pagoda' // pagode octogonal de `stories` andares
  | 'hall' // grande salão com cumeeiras de dragão
  | 'dome' // cúpula de gomos com lanterna e campanário
  | 'trestle' // ponte ferroviária de cavalete
  | 'rings'; // terraços circulares em degraus

/** Chapéu dos aldeões. */
export type HatStyle =
  | 'straw' // palha de aba larga
  | 'cap' // barrete ou boné baixo
  | 'scarf' // lenço amarrado na cabeça
  | 'hood' // capuz pontudo
  | 'helmet' // capacete de vidro
  | 'none';

export type CenterCrown =
  | 'spire' // torre quadrada com flecha
  | 'dome' // tambor e cúpula
  | 'pagoda' // três beirais empilhados
  | 'pyramid' // pirâmide com piramídio dourado
  | 'stepped' // plataforma em degraus com disco do sol
  | 'hall'; // salão de telhado íngreme com tábuas cruzadas

export type Landmark =
  | 'church' // igreja com torre e agulha
  | 'baroque' // igreja barroca de duas torres (colonial)
  | 'tower' // torre de pedra alta (Toscana, castelo)
  | 'pagoda' // pagode de 3 andares
  | 'pyramid' // pirâmide
  | 'obelisk' // obelisco
  | 'windmill' // moinho de vento como marco
  | 'temple' // templo de colunas
  | 'stave' // igreja de madeira escalonada (nórdica)
  | 'dome' // cúpula grande (Marte)
  | 'watertower' // caixa d'água de ferrovia sobre cavalete de madeira
  | 'hall' // salão comprido nórdico com cabeças de dragão nas cumeeiras
  | 'pylon' // templo egípcio: pilone trapezoidal com dois obeliscos
  | 'kancha' // templo inca de pedra, paredes inclinadas e nichos trapezoidais
  | 'none';

export type CropStyle =
  | 'wheat' // trigo dourado, balança com o vento
  | 'barley' // cevada, espiga curvada
  | 'corn' // milho alto com pendão
  | 'rice' // arroz baixo sobre lâmina d'água
  | 'tulip' // tulipas em faixas de cor
  | 'lavender' // lavanda em fileiras de tufos
  | 'sunflower' // girassol
  | 'vineyard' // vinha em espaldeira
  | 'sugarcane' // cana-de-açúcar alta
  | 'papyrus' // papiro
  | 'tea' // chá em sebes arredondadas
  | 'coffee' // café, arbustos escuros com frutos vermelhos
  | 'cotton' // algodão, arbustos com pontos brancos
  | 'quinoa' // quinoa com panículas coloridas
  | 'potato' // batata: touceira baixa com flores (cor da planta = folhagem)
  | 'flax' // linho: hastes finas com flor azul (cor da planta = flor)
  | 'mulberry' // amoreira podada baixa, para a seda
  | 'hydro' // hidroponia luminosa (ficção)
  | 'bulb'; // jacinto: espiga cônica de florzinhas em fileiras de cor

export interface CropKind {
  style: CropStyle;
  weight: number;
  /** Cores da planta; em tulipas/quinoa cada fileira usa uma cor. */
  colors: string[];
  /** Cor da terra da parcela (em arroz, a lâmina d'água). */
  soil: string;
}

/**
 * Bichos do pasto. Um tipo novo (renas, ema, crocodilo...) entra só com um `case` em `animalGeometry` (render/lib.ts):
 * o compilador cobra a entrada, e `Theme.animals` e `Theme.fauna` já o aceitam.
 */
export type AnimalKind = 'sheep' | 'cow' | 'goat' | 'horse' | 'donkey' | 'buffalo' | 'llama' | 'camel' | 'deer' | 'rover' | 'duck' | 'ibis' | 'crocodile' | 'ox';

/** Onde uma espécie de `Theme.fauna` aparece: no prado, na mata, no campo de cultivo, na beira do rio ou dentro da água. */
export type FaunaWhere = 'prado' | 'floresta' | 'campo' | 'margem' | 'agua';

/** Uma espécie extra do tema (além de `animals`, que fica como o bicho de pasto da vila e das cercas). */
export interface FaunaSpec {
  kind: AnimalKind;
  /** Peso no sorteio entre as espécies do tema (a espécie sorteada vira o bicho da peça). */
  weight: number;
  /** Cores do corpo (sorteadas por bicho). */
  colors: string[];
  /** Quando aparece: 'dia' (amanhecer ao pleno dia), 'tarde' (hora dourada e entardecer) ou 'noite'. Omitir = sempre. Fora da hora o bicho some (escala 0) e volta sozinho. */
  time?: DayPhase;
  /** Onde aparece. Padrão: 'prado'. */
  where?: FaunaWhere;
  /** Chance de a peça elegível ganhar a espécie (0 a 1; padrão 0,25). */
  chance?: number;
}

/** Sons de ambiente sintetizados que um tema pode pedir (audio.ts, `Sfx.setThemeAmbience`). */
export type AmbienceKind = 'aves' | 'sapos' | 'grilos' | 'cigarras' | 'vento' | 'gelo' | 'sinos' | 'agua';

export interface AmbienceSpec {
  kind: AmbienceKind;
  /** Quanto o som pesa (1 = o volume de referência; 0,5 = metade). Soma-se ao ambiente por proximidade que já existe. */
  weight: number;
}
export type BoatKind =
  | 'rowboat'
  | 'sailboat'
  | 'felucca'
  | 'junk'
  | 'longship'
  | 'barge'
  | 'canoe'
  | 'reedboat'
  | 'nile' // barco do Nilo: pontas recurvadas e vela quadrada larga
  | 'tjalk' // tjalk holandês: fundo chato, quilhas laterais em pá e vela de gávea marrom
  | 'paddle' // vapor de roda de pás na popa
  | 'hover';
/** Como a borda "linha" (índice 5) é desenhada. */
export type RoadStyle = 'rail' | 'dirt' | 'stone' | 'sand' | 'maglev' | 'dike';
/** O que anda pela linha: trem, carroça, caravana de animais, maglev. */
export type VehicleKind = 'steam' | 'cart' | 'caravan' | 'maglev';
/** Estrutura construída quando vila encosta em plantação. */
export type MillStyle =
  | 'windmill' // moinho de vento com pás de pano
  | 'granary' // celeiro de silos redondos
  | 'windpump' // moinho-bomba americano: torre de treliça, rotor de aço e caixa d'água
  | 'stilt'; // armazém sobre estacas (estabur, celeiro elevado)

/** Portal sobre a estrada na entrada da vila. */
export type GateStyle =
  | 'torii' // dois pilares e duas travessas, a de cima recurvada
  | 'paifang' // três vãos com telhadinhos
  | 'inca' // portal trapezoidal de pedra
  | 'brick' // portão de cidade de tijolo (stadspoort): pilares, frontão de degraus e torrezinha com relógio
  | 'pylon'; // pilone egípcio: duas torres de paredes inclinadas, cornija e travessa
/** Ponte de pedestres sobre o rio, entre a vila e a outra margem. */
export type BridgeStyle =
  | 'stone' // arco de pedra com parapeito
  | 'wood' // arco alto de madeira com guarda-corpo (ponte arco-íris, taikobashi)
  | 'rope' // ponte de corda pênsil, tabuado e cabos
  | 'draw'; // ponte levadiça de contrapeso (fechada): tabuleiro baixo, pórticos e correntes

/** Material dos painéis: o tema escolhe, o CSS desenha sem arquivo. */
export type FrameKind = 'papel' | 'pergaminho' | 'papiro' | 'madeira' | 'seda' | 'washi' | 'metal' | 'pedra';
/** Emblema do tema no placar (um SVG simples, em src/ui/frames.ts). */
export type EmblemId =
  | 'sol'
  | 'lirio'
  | 'tulipa'
  | 'ipe'
  | 'floco'
  | 'planeta'
  | 'selo'
  | 'crisantemo'
  | 'corvo'
  | 'trigo'
  | 'sakura'
  | 'caravela'
  | 'estrela'
  | 'condor';
/** Bruma, vento e filtro de cor do tema, por cima da hora do dia. */
export interface Atmos {
  /** Multiplica a densidade da bruma da hora. 1 deixa a hora como está. */
  haze: number;
  /** Cor para onde a bruma puxa. */
  hazeColor: string;
  /** Força do vento nas copas e nas plantações. 1 é o de sempre. */
  wind: number;
  /** Multiplica a imagem final, canal a canal (vermelho, verde, azul). */
  filter: [number, number, number];
}

/** O que flutua no ar, desenhado pelo shader (sem custo de CPU). */
export type WeatherKind =
  | 'none'
  | 'snow' // flocos redondos caindo devagar
  | 'petals' // pétalas ovais que giram e viram no ar
  | 'leaves' // folhas alongadas, caem rodopiando
  | 'dust' // poeira fina levada pelo vento, quase na horizontal
  | 'pollen' // penugem e pólen flutuando, brilham contra a luz
  | 'rain'; // riscos finos e rápidos: só o clima tocável usa (nenhum tema escolhe)

export interface Theme {
  id: string;
  name: string;
  /** País/região e época, ex.: "Países Baixos · século XVII". */
  era: string;
  period: Period;
  tagline: string;
  terrainNames: [string, string, string, string, string, string];
  /** Cores de legenda/ícone dos 6 terrenos (HUD). */
  terrainColors: [string, string, string, string, string, string];

  // --- ambiente e luz
  bg: string;
  voidFill: string;
  voidLine: string;
  /** O que cerca o tabuleiro: 'mar' (água funda, espuma e faixa de areia nas bordas), 'areia' (dunas, a cor sai do chão do tema) ou 'pergaminho' (a terra incógnita; o padrão). */
  surround?: 'mar' | 'pergaminho' | 'areia';
  sun: string;
  sunIntensity: number;
  sunDir: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;

  // --- chão
  /** Cor do chão de cada terreno (índice = T). */
  ground: [string, string, string, string, string, string];
  side: string;
  sideDark: string;
  water: string;
  bank: string;

  // --- estrada/trilho (terreno 5)
  road: RoadStyle;
  roadBed: string;
  /** Trilho, sulco ou pedra, conforme o estilo. */
  roadDetail: string;
  /** Dormente (só em 'rail'). */
  sleeper: string;
  vehicle: VehicleKind;
  /** [corpo, detalhe]. Em 'caravan' os animais usam `animals`. */
  vehicleColors: [string, string];

  // --- floresta
  forest: { geo: TreeGeo; weight: number; colors: string[] }[];
  trunk: string;
  treesPerSector: [number, number];
  /**
   * Mata em fileiras: as árvores de uma peça de floresta se alinham em 2 ou 3 fileiras retas e paralelas (alamedas e
   * cortinados de pôlder), em vez de se espalharem. Omitir = espalhadas, como sempre foram.
   */
  forestRows?: boolean;

  // --- vila
  houses: HouseKind[];
  landmark: Landmark;
  /** Chance de uma peça com 3+ setores de vila ganhar o marco no centro. */
  landmarkChance: number;
  /** Paleta do marco: [parede, telhado, detalhe]. */
  landmarkColors: [string, string, string];
  /** Cor das janelas (de dia) e do brilho à noite. */
  window: string;
  mill: MillStyle;
  /** Portal sobre a estrada onde ela encosta na vila: [estrutura, topo]. Omitir = sem portal. Atalho de `gates` com um estilo só. */
  gate?: { style: GateStyle; colors: [string, string] };
  /**
   * Vários estilos de portal no mesmo tema (torii e paifang convivem): cada peça com portal sorteia um pela semente dela
   * (sem gastar o gerador da peça). Omitir = vale `gate`.
   */
  gates?: { style: GateStyle; colors: [string, string] }[];
  /** Ponte sobre rio de 2 bordas com vila numa margem: [estrutura, detalhe]. Omitir = sem ponte. */
  bridge?: { style: BridgeStyle; colors: [string, string] };

  // --- plantação e prado
  crops: CropKind[];
  grass: string[];
  bush: string[];
  flowers: string[];
  rock: string;
  /** Jazida no prado: cor do minério e chance por setor; com vila encostada na peça, vira mina. Omitir = sem jazidas. */
  ore?: { color: string; chance: number };
  /** Cor das frutas dos arbustos do prado (6% por setor). Omitir = sem frutas. */
  berry?: string;
  animals: { kind: AnimalKind; colors: string[] };
  /**
   * Fauna extra: 2 a 3 espécies que aparecem por peça (gerador à parte da semente, então as peças dos temas sem `fauna`
   * ficam como sempre foram), andam pelo mesmo passeio dos `animals` e respeitam a hora do dia e o lugar (`FaunaSpec`).
   */
  fauna?: FaunaSpec[];
  /**
   * Degraus nas parcelas de plantação: cada parcela vira 2 ou 3 patamares concêntricos baixos, com mureta, e as plantas
   * sobem com eles. A borda da peça fica na altura 0 (a emenda com a vizinha não muda). `styles` limita às culturas
   * listadas (omitir = todas). A parcela cresce em altura até `levels` × 0,012.
   */
  terraces?: { levels: number; styles?: CropStyle[] };
  /**
   * Chão pela distância ao rio (várzea): o prado e a plantação perto da água ganham a cor `color`, e a cor volta ao normal
   * a `reach` unidades do rio (1,7 ≈ uma peça de ponta a ponta). Vem de um mapa de distância (render/riverMap.ts) lido pelo
   * shader do chão, então não importa a ordem das peças: um rio posto depois também fertiliza o campo que já estava lá.
   */
  floodplain?: { reach: number; color: string };
  /**
   * Canais de irrigação (Egito): cada parcela de plantação ganha um canal de água em fileira (às vezes com um canal
   * cruzado), e as plantas abrem espaço para ele. `color` é a água do canal; `cross` é a chance do canal cruzado.
   * Só geometria do chão da parcela (o gerador da peça não gasta nada; os canais saem de um gerador à parte).
   */
  irrigation?: { color: string; cross: number };
  /** Efeito de céu: 'aurora' = cortina boreal verde e violeta animada por `U.time`, só à noite: refletida no mar (`surround: 'mar'`), como brilho no fundo da névoa e na cúpula do céu quando o horizonte entra na tela (câmera baixa). O nível Baixo não a desenha. */
  skyFx?: 'aurora';
  /** Sons de ambiente do tema (aves, sapos, grilos, cigarras, vento, gelo, sinos, água), sintetizados. */
  ambience?: AmbienceSpec[];
  /** Easter eggs do tema (src/core/eggs.ts): gatilhos puros (peças, grupo, bordas, sorte, hora, data) e efeitos (kit, evento, céu, som). */
  eggs?: EggSpec[];
  // --- água
  boat: BoatKind;
  /** [casco, vela/detalhe]. */
  boatColors: [string, string];
  lily: string;

  // --- efeitos e interface
  smoke: string;
  /** Partículas no ar e sua densidade (1 = padrão). */
  weather: { kind: WeatherKind; colors: [string, string]; density: number };
  sparkle: string;
  ui: { accent: string; panel: string; ink: string; soft: string; frame: FrameKind; emblem: EmblemId };
  /** Gradação de cor do tema na imagem final: matiz puxado nas sombras e nos realces (só o tom conta, não o brilho) e saturação (1 = neutra). */
  grade: { shadow: string; light: string; saturation: number };
  /** Atmosfera por cima da hora: bruma, vento e um filtro leve na imagem. */
  atmos?: Atmos;
  /**
   * Relevo decorativo (R1): serras e morros dentro das peças de prado e floresta, sem mudar regra nem
   * replay (só a aparência). `amp` é a quantidade (0 ou omitido = sem relevo, como antes; ~0,6 = cerca
   * de uma em cada três peças elegíveis). Peças com vila, plantação, marco, sítio ou peça especial ficam
   * de fora, e rios e estradas são respeitados. `style`: 'serra' = serras de rocha e morros; 'suave' = só
   * morros gramados; 'terraco', 'falesia' e 'dique' são reservados para as próximas etapas e, por ora,
   * valem como 'suave'. `snow` põe neve nos cumes; `rock` troca a cor da rocha (padrão: `rock` do tema).
   */
  relief?: { amp: number; style: 'suave' | 'serra' | 'terraco' | 'falesia' | 'dique'; snow?: boolean; rock?: string };
  /** Trava a paisagem numa estação (0 primavera, 1 verão, 2 outono, 3 inverno). A pontuação usa `rules.seasonLock`. */
  season?: 0 | 1 | 2 | 3;
  /** Lanternas ao longo da estrada, acesas à noite. */
  roadLamps?: boolean;
  /** Nomes das interações entre bordas neste tema. */
  synergy: { lumber: string; mill: string; pasture: string; apiary: string };
  rules?: Partial<Rules>;
  /** Nomes das 4 eras da vila (padrão: Aldeia, Vila, Burgo, Cidade). */
  eras?: [string, string, string, string];
  /** Nomes próprios do tema para as cartas da virada de era (src/core/blessings.ts). */
  blessingNames?: Partial<Record<BlessingId, string>>;
  /** `false` = as casas não mudam com a era (módulos pré-fabricados não começam como taipa e palha). */
  eraHouses?: false;
  /** Remate do Centro da vila na última era (padrão: 'spire'). */
  center?: CenterCrown;
  /** Maravilha da última era: nome, forma, cores [principal, telhado, detalhe] e andares (pagode). */
  wonder?: { name: string; core: WonderCore; colors: [string, string, string]; stories?: number };
  /** Escala da música (semitons a partir da tônica, em ordem) e timbre da melodia; a fanfarra de era também usa. */
  music?: { scale: number[]; timbre: MusicTimbre };
  /** Aldeões: cor da pele, chapéu e cor do chapéu (padrão: sem chapéu). A camisa usa as cores dos telhados. */
  folk?: { skin: string; hat: HatStyle; hatColor: string };
  ruleNote?: string;
}

/** Portais do tema: `gates` se houver, senão o `gate` sozinho, senão nenhum. */
export const gatesOf = (t: Pick<Theme, 'gate' | 'gates'>) => t.gates ?? (t.gate ? [t.gate] : []);
