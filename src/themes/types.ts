import type { Rules } from '../core/board';

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
  | 'cypress' // cipreste estreito e alto
  | 'olive' // oliveira: copa larga e baixa, tronco retorcido
  | 'oak' // carvalho: copa grande em vários blocos
  | 'birch' // bétula: tronco branco, copa pequena
  | 'cactus' // cacto saguaro
  | 'bamboo' // touceira de bambu
  | 'araucaria'; // araucária em "candelabro"

/** Corpo da casa (as proporções mudam o caráter da vila). */
export type BodyStyle =
  | 'cottage' // casa comum de dois águas
  | 'long' // casa comprida (viking, rancho)
  | 'cube' // cubo de adobe/pedra (Egito, Mediterrâneo)
  | 'tall' // sobrado estreito de 2-3 andares (Holanda, colonial)
  | 'round'; // cilíndrica (cabana andina, módulo marciano)

export type RoofStyle =
  | 'gable' // duas águas
  | 'hip' // quatro águas
  | 'flat' // laje com mureta
  | 'dome' // cúpula
  | 'pagoda' // beirais curvos em camadas
  | 'thatch' // palha grossa e arredondada
  | 'turf' // grama sobre o telhado (use cor verde)
  | 'stepgable' // empena escalonada holandesa
  | 'cone'; // cônico (cabanas redondas)

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
  /** Chaminé com fumaça. */
  chimney?: boolean;
}

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
  | 'hydro'; // hidroponia luminosa (ficção)

export interface CropKind {
  style: CropStyle;
  weight: number;
  /** Cores da planta; em tulipas/quinoa cada fileira usa uma cor. */
  colors: string[];
  /** Cor da terra da parcela (em arroz, a lâmina d'água). */
  soil: string;
}

export type AnimalKind = 'sheep' | 'cow' | 'goat' | 'horse' | 'donkey' | 'buffalo' | 'llama' | 'camel' | 'deer' | 'rover';
export type BoatKind = 'rowboat' | 'sailboat' | 'felucca' | 'junk' | 'longship' | 'barge' | 'canoe' | 'reedboat' | 'hover';
/** Como a borda "linha" (índice 5) é desenhada. */
export type RoadStyle = 'rail' | 'dirt' | 'stone' | 'sand' | 'maglev';
/** O que anda pela linha: trem, carroça, caravana de animais, maglev. */
export type VehicleKind = 'steam' | 'cart' | 'caravan' | 'maglev';
/** Estrutura construída quando vila encosta em plantação. */
export type MillStyle = 'windmill' | 'granary';

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

  // --- plantação e prado
  crops: CropKind[];
  grass: string[];
  bush: string[];
  flowers: string[];
  rock: string;
  animals: { kind: AnimalKind; colors: string[] };

  // --- água
  boat: BoatKind;
  /** [casco, vela/detalhe]. */
  boatColors: [string, string];
  lily: string;

  // --- efeitos e interface
  smoke: string;
  sparkle: string;
  ui: { accent: string; panel: string; ink: string; soft: string };
  /** Nomes das interações entre bordas neste tema. */
  synergy: { lumber: string; mill: string; pasture: string; apiary: string };
  rules?: Partial<Rules>;
  ruleNote?: string;
}
