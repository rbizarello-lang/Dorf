import type { Rules } from '../core/board';

// Um tema troca paleta, nomes, formas da decoração e, opcionalmente, regras.
// A lógica do jogo não conhece temas: tudo aqui é dado.

export type TreeGeo = 'conifer' | 'round' | 'palm' | 'crystal' | 'blossom';
export type RoofStyle = 'gable' | 'flat' | 'dome' | 'pagoda';

export interface ForestKind {
  geo: TreeGeo;
  weight: number;
  colors: string[];
}

export interface Theme {
  id: string;
  name: string;
  tagline: string;
  /** Índice = enum T: Prado, Floresta, Plantação, Vila, Rio, Trilhos. */
  terrainNames: [string, string, string, string, string, string];
  terrainColors: [string, string, string, string, string, string];
  bg: string;
  voidFill: string;
  voidLine: string;
  sun: string;
  sunIntensity: number;
  sunDir: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  ground: [string, string, string, string, string, string];
  side: string;
  sideDark: string;
  water: string;
  bank: string;
  railBed: string;
  rail: string;
  sleeper: string;
  forest: ForestKind[];
  trunk: string;
  treesPerSector: [number, number];
  walls: string[];
  roofs: string[];
  roofStyle: RoofStyle;
  towerChance: number;
  field: string[];
  bush: string[];
  flowers: string[];
  rock: string;
  lily: string;
  smoke: string;
  sparkle: string;
  ui: { accent: string; panel: string; ink: string; soft: string };
  rules?: Partial<Rules>;
  ruleNote?: string;
}

export const THEMES: Theme[] = [
  {
    id: 'vale',
    name: 'Vale Pastel',
    tagline: 'Vilarejos, bosques e plantações sob um céu de pêssego.',
    terrainNames: ['Prado', 'Floresta', 'Plantação', 'Vila', 'Rio', 'Trilhos'],
    terrainColors: ['#8fbf5a', '#2f7a45', '#f0a53a', '#d9653b', '#58a8d6', '#7d6a58'],
    bg: '#f3d3c8',
    voidFill: '#f7dfd6',
    voidLine: '#fbeee8',
    sun: '#fff0d8',
    sunIntensity: 2.3,
    sunDir: [-0.55, 1, 0.35],
    hemiSky: '#fff4f0',
    hemiGround: '#9a8f78',
    hemiIntensity: 1.35,
    ground: ['#8cbd57', '#5d8f3f', '#b99a55', '#bba27c', '#8fbd5c', '#8cbd57'],
    side: '#8a6048',
    sideDark: '#4d3528',
    water: '#63b1dc',
    bank: '#d9e3a2',
    railBed: '#9b8c7c',
    rail: '#5a4a44',
    sleeper: '#7a5a3e',
    forest: [
      { geo: 'conifer', weight: 0.55, colors: ['#2e6a3c', '#3b7c45', '#26583a', '#46864a'] },
      { geo: 'round', weight: 0.35, colors: ['#5c9b3d', '#79ae45', '#4c8a48', '#93b84e'] },
      { geo: 'round', weight: 0.1, colors: ['#8a70b4', '#a07cc4', '#d98a3d'] },
    ],
    trunk: '#6b4a32',
    treesPerSector: [5, 8],
    walls: ['#f3e5cc', '#ead3b2', '#dcc4a4', '#f6ecdc'],
    roofs: ['#d9653b', '#c8553a', '#e07b45', '#b94a3a', '#5f8fb5'],
    roofStyle: 'gable',
    towerChance: 0.06,
    field: ['#f2a43a', '#f7c44c', '#e8913a', '#f3b24a', '#c47ed4'],
    bush: ['#5c9b3d', '#6eaa45'],
    flowers: ['#ffffff', '#ffd84a', '#f58fb0', '#b9a4ff'],
    rock: '#a79f97',
    lily: '#6aa84a',
    smoke: '#ffffff',
    sparkle: '#fff6c4',
    ui: { accent: '#c8553a', panel: '#fff8f3', ink: '#3b2a24', soft: '#8a6e62' },
  },
  {
    id: 'cerrado',
    name: 'Cerrado Dourado',
    tagline: 'Ipês floridos, buritis, roças e a maria-fumaça cortando a chapada.',
    terrainNames: ['Campo', 'Mata', 'Roça', 'Vila', 'Rio', 'Ferrovia'],
    terrainColors: ['#c2b25a', '#e9b92c', '#7fb34a', '#f19b8a', '#2f96b0', '#a0694a'],
    bg: '#f4cf9a',
    voidFill: '#f7dcb2',
    voidLine: '#fbe9cd',
    sun: '#ffe1b0',
    sunIntensity: 2.5,
    sunDir: [0.7, 0.85, 0.3],
    hemiSky: '#fff1dc',
    hemiGround: '#a8653e',
    hemiIntensity: 1.3,
    ground: ['#c4b05a', '#8e9540', '#a9884a', '#c29266', '#b9b35e', '#c4b05a'],
    side: '#b0532e',
    sideDark: '#6e2e1a',
    water: '#2f9fb8',
    bank: '#e6d38a',
    railBed: '#a0694a',
    rail: '#4a3a36',
    sleeper: '#6a4430',
    forest: [
      { geo: 'round', weight: 0.35, colors: ['#f2c12e', '#f5cf3a', '#e8b21e'] },
      { geo: 'blossom', weight: 0.2, colors: ['#e96fae', '#d85c9e', '#f18cc0'] },
      { geo: 'palm', weight: 0.25, colors: ['#4f8a3a', '#5f9a40', '#6aa545'] },
      { geo: 'round', weight: 0.2, colors: ['#6f9a3a', '#7ea845', '#5f8a35'] },
    ],
    trunk: '#5a3b2a',
    treesPerSector: [3, 6],
    walls: ['#fbf6ee', '#f6e27a', '#8ec3e6', '#f19b8a', '#b9e1a4'],
    roofs: ['#b5502f', '#c4623a', '#a8452a'],
    roofStyle: 'gable',
    towerChance: 0.08,
    field: ['#7fb34a', '#9cc957', '#d8b94a', '#6aa23f', '#e3c65a'],
    bush: ['#8e9540', '#a3a94a'],
    flowers: ['#f2c12e', '#e96fae', '#ffffff', '#ff8a3d'],
    rock: '#b8805c',
    lily: '#5f9a40',
    smoke: '#fff6ea',
    sparkle: '#fff1b0',
    ui: { accent: '#b5502f', panel: '#fff7ea', ink: '#3a2418', soft: '#8a6248' },
    rules: { perfectBonus: 25 },
    ruleNote: 'Encaixe perfeito vale 25 pontos.',
  },
  {
    id: 'inverno',
    name: 'Inverno Nórdico',
    tagline: 'Pinheiros nevados, cabanas vermelhas e lagos quase congelados.',
    terrainNames: ['Neve', 'Pinhal', 'Estufa', 'Aldeia', 'Riacho', 'Trilhos'],
    terrainColors: ['#e6eef5', '#2e5a4c', '#b8c9dc', '#9a3b2e', '#7fc1d8', '#5a5f6a'],
    bg: '#d9e4ef',
    voidFill: '#e3ebf4',
    voidLine: '#f1f6fb',
    sun: '#fff1e0',
    sunIntensity: 2.0,
    sunDir: [-0.4, 0.75, -0.55],
    hemiSky: '#eef4ff',
    hemiGround: '#8f9aa8',
    hemiIntensity: 1.45,
    ground: ['#eef3f7', '#dfe7ee', '#d4dde6', '#e4e7ea', '#e6eef4', '#eef3f7'],
    side: '#6b7a8a',
    sideDark: '#3b4654',
    water: '#86c6da',
    bank: '#ffffff',
    railBed: '#8d939c',
    rail: '#3f434b',
    sleeper: '#5b4a3e',
    forest: [
      { geo: 'conifer', weight: 0.85, colors: ['#2e5a4c', '#3b6b58', '#24493f', '#355f52'] },
      { geo: 'conifer', weight: 0.15, colors: ['#dfe9ee', '#cfdde4'] },
    ],
    trunk: '#4b3a30',
    treesPerSector: [5, 8],
    walls: ['#9a3b2e', '#8c4a2c', '#6b3a2e', '#b8863a', '#2f4a5c'],
    roofs: ['#f4f7fb', '#e9eef3', '#dde5ec'],
    roofStyle: 'gable',
    towerChance: 0.05,
    field: ['#c9d6e3', '#b8c9dc', '#e0c9a6', '#d6e2ec'],
    bush: ['#3b6b58', '#dfe9ee'],
    flowers: ['#ffffff', '#cfe3ff'],
    rock: '#8c96a3',
    lily: '#f4f9fc',
    smoke: '#ffffff',
    sparkle: '#ffffff',
    ui: { accent: '#9a3b2e', panel: '#f7fafd', ink: '#1f2a36', soft: '#5f6f80' },
    rules: { startTiles: 45, questChance: 0.2 },
    ruleNote: 'Começa com 45 peças, missões um pouco mais raras.',
  },
  {
    id: 'sakura',
    name: 'Jardim Sakura',
    tagline: 'Cerejeiras, arrozais espelhados e telhados de pagode.',
    terrainNames: ['Musgo', 'Cerejal', 'Arrozal', 'Vila', 'Lago', 'Trilhos'],
    terrainColors: ['#9cc37a', '#f4a3c0', '#a8d08d', '#3e4a5c', '#6fbfd0', '#6d5a50'],
    bg: '#eedcea',
    voidFill: '#f3e6f0',
    voidLine: '#faf2f8',
    sun: '#fff0f4',
    sunIntensity: 2.2,
    sunDir: [-0.3, 0.9, 0.6],
    hemiSky: '#fff5fb',
    hemiGround: '#8a7d8f',
    hemiIntensity: 1.4,
    ground: ['#9cc37a', '#86ad6c', '#8fb87a', '#b2a489', '#9cc37a', '#9cc37a'],
    side: '#7a5d4c',
    sideDark: '#44332b',
    water: '#72bfd0',
    bank: '#c9e2b0',
    railBed: '#a39585',
    rail: '#4d423e',
    sleeper: '#6e5646',
    forest: [
      { geo: 'blossom', weight: 0.65, colors: ['#f7b7cf', '#f4a3c0', '#fbd0de', '#f09ab8'] },
      { geo: 'conifer', weight: 0.35, colors: ['#3d6b4a', '#2f5a3e', '#4a7a52'] },
    ],
    trunk: '#4e3a33',
    treesPerSector: [4, 7],
    walls: ['#f3ede2', '#e6dccb', '#efe4d3'],
    roofs: ['#3e4a5c', '#2f3d4f', '#5a3a3a', '#46536a'],
    roofStyle: 'pagoda',
    towerChance: 0.08,
    field: ['#a8d08d', '#c5e0a0', '#8cc07c', '#b7dc9a'],
    bush: ['#6e9a5a', '#f4a3c0'],
    flowers: ['#fbd0de', '#ffffff', '#f7b7cf'],
    rock: '#9d958f',
    lily: '#78a65a',
    smoke: '#ffffff',
    sparkle: '#fff0f6',
    ui: { accent: '#c2466e', panel: '#fff8fb', ink: '#2e2230', soft: '#7c6378' },
  },
  {
    id: 'marte',
    name: 'Colônia Marciana',
    tagline: 'Cúpulas pressurizadas, cristais e canais sob um céu violeta.',
    terrainNames: ['Regolito', 'Cristais', 'Hidroponia', 'Cúpulas', 'Canal', 'Maglev'],
    terrainColors: ['#c9683f', '#7ee0f2', '#6fe08a', '#dfe6f2', '#36d1d1', '#b9c0cc'],
    bg: '#34264a',
    voidFill: '#3b2c54',
    voidLine: '#6a58a0',
    sun: '#ffd9c2',
    sunIntensity: 2.6,
    sunDir: [0.6, 0.8, -0.4],
    hemiSky: '#a58ae0',
    hemiGround: '#5a2a22',
    hemiIntensity: 1.2,
    ground: ['#c46a42', '#a4543a', '#8a4a36', '#b0725a', '#c47a4a', '#c46a42'],
    side: '#7a3326',
    sideDark: '#3e1a15',
    water: '#3fe0e0',
    bank: '#e8a070',
    railBed: '#6a3a30',
    rail: '#e3e8f0',
    sleeper: '#9aa3b2',
    forest: [
      { geo: 'crystal', weight: 1, colors: ['#7ee0f2', '#b58cf5', '#f28bd2', '#9af0ff'] },
    ],
    trunk: '#5a3b2a',
    treesPerSector: [3, 5],
    walls: ['#e8e6ea', '#cfd3da', '#f2f0f4'],
    roofs: ['#9fd9ff', '#bfe6ff', '#8fc9f5'],
    roofStyle: 'dome',
    towerChance: 0.12,
    field: ['#6fe08a', '#9af0a0', '#4cc37a', '#b6f5b0'],
    bush: ['#e39a6a', '#b85f3a'],
    flowers: ['#9af0ff', '#f28bd2'],
    rock: '#8a4a36',
    lily: '#9af0ff',
    smoke: '#e8e0ff',
    sparkle: '#b8fff6',
    ui: { accent: '#36b7c9', panel: '#241a36', ink: '#f1eaff', soft: '#b3a3d4' },
    rules: { startTiles: 36, questChance: 0.32, maxQuests: 5 },
    ruleNote: 'Começa com 36 peças, mas recebe mais missões.',
  },
];

export const themeById = (id: string | null | undefined) => THEMES.find((t) => t.id === id) ?? THEMES[0];
