import type { Theme } from './types';

// Inverno Nórdico: o Inverno de antes, agora com o melhor da Terra dos Vikings, que saiu da lista. Ficam
// a casa longa de turfa, o estabur, o drakkar, a cevada, o linho, o capuz, a moldura de madeira com o
// corvo e os nomes das cartas. Saem o verde de verão, o carvalho, a data do século X e o trem a vapor
// (a trilha é de terra batida, como era a dos Vikings). As regras ficam como eram, então uma partida
// salva deste tema continua valendo. O que ainda falta (rena, trenó, lago congelado, aurora, igreja
// de madeira como maravilha) está em docs/TEMAS.md.

export const inverno: Theme = {
  id: 'inverno',
  name: 'Inverno Nórdico',
  era: 'Escandinávia · no inverno, sem data',
  period: 'contemporanea',
  tagline: 'Casas longas de turfa, cabanas vermelhas, drakkars no fiorde e pinhais sob a neve.',
  terrainNames: ['Neve', 'Taiga', 'Cevadal', 'Aldeia', 'Fiorde', 'Trilha'],
  terrainColors: ['#e6eef5', '#2e5a4c', '#d9c9a0', '#9a3b2e', '#3a6f88', '#8c7a5c'],
  bg: '#cdd2d8',
  voidFill: '#d6dbe0',
  voidLine: '#e6eaee',
  surround: 'mar',
  sun: '#fff1e0',
  sunIntensity: 2.0,
  sunDir: [-0.4, 0.75, -0.55],
  hemiSky: '#eef4ff',
  hemiGround: '#8f9aa8',
  hemiIntensity: 1.45,
  ground: ['#eef3f7', '#dfe7ee', '#d8dfe6', '#e4e7ea', '#e6eef4', '#eef3f7'],
  side: '#6b7a8a',
  sideDark: '#3b4654',
  water: '#2f6482',
  bank: '#ffffff',
  road: 'dirt',
  roadBed: '#a9b3bf',
  roadDetail: '#6d7886',
  sleeper: '#5b4a3e',
  vehicle: 'cart',
  vehicleColors: ['#6a4a34', '#9a3b2e'],
  forest: [
    { geo: 'conifer', weight: 0.45, colors: ['#2e5a4c', '#3b6b58', '#24493f', '#355f52'] },
    { geo: 'spire', weight: 0.15, colors: ['#24493f', '#2a5446', '#1f4238'] },
    { geo: 'birch', weight: 0.2, colors: ['#dfe9ee', '#cfdde4'] },
    { geo: 'conifer', weight: 0.15, colors: ['#dfe9ee', '#cfdde4'] },
    { geo: 'puff', weight: 0.05, colors: ['#3b6b58', '#4a7a62'] },
  ],
  trunk: '#4b3a30',
  treesPerSector: [5, 8],
  houses: [
    // Stuga vermelha (falu) de moldura branca. Pelo menos três cores de telhado escuras: telhado branco
    // sobre chão branco é o risco de legibilidade do tema (a neve de telhado virá do shader).
    { weight: 0.32, body: 'cottage', roof: 'gable', walls: ['#9a3b2e', '#8c4a2c', '#6b3a2e', '#b8863a', '#2f4a5c', '#d8c8a8', '#c9a77c'], roofs: ['#4f5a66', '#3f4a56', '#8a3a2a', '#2f5a4a', '#6f7f94', '#a84a32', '#f4f7fb'], trim: '#f4f7fb', chimney: true },
    // Casa longa de turfa (Vikings): telhado de grama seca, com um toque de neve.
    { weight: 0.3, body: 'long', roof: 'turf', walls: ['#8a6a48', '#7a5a3e', '#96744e', '#a8845a', '#5e4630', '#b89870'], roofs: ['#5f7a52', '#6e8560', '#7a8a60', '#4f6a4a', '#cfdbe3'], trim: '#4a3626', chimney: true },
    { weight: 0.16, body: 'long', roof: 'gable', walls: ['#9a3b2e', '#7a2e24', '#d8c8a8', '#b8863a', '#2f4a5c'], roofs: ['#4f5a66', '#8a3a2a', '#2f5a4a', '#5a4a3c', '#6f7f94', '#a84a32'], trim: '#f4f7fb', chimney: true },
    // Estabur e celeiro de turfa; casa de mercador de Bergen, estreita e alta.
    { weight: 0.1, body: 'annex', roof: 'turf', walls: ['#8a6a48', '#7a5a3e', '#96744e', '#a8845a', '#5e4630'], roofs: ['#5f7a52', '#6e8560', '#7a8a60', '#4f6a4a'], trim: '#4a3626', chimney: true, minor: true },
    { weight: 0.08, body: 'tall', roof: 'steep', walls: ['#9a3b2e', '#b8863a', '#2f4a5c', '#d8c8a8', '#6b3a2e'], roofs: ['#4f5a66', '#8a3a2a', '#2f5a4a', '#a84a32'], trim: '#f4f7fb', chimney: true, minor: true },
  ],
  landmark: 'stave',
  landmarkChance: 0.1,
  landmarkColors: ['#4a2e22', '#2e2420', '#c9a24a'],
  window: '#ffcf7a',
  mill: 'stilt',
  bridge: { style: 'wood', colors: ['#5a3a26', '#cfd6dc'] },
  crops: [
    // Cevada e linho sob a neve: a parcela fica quase branca (o lago de pesca no gelo virá depois).
    { style: 'barley', weight: 0.7, colors: ['#d9c9a0', '#e6dbc0', '#cbbb92'], soil: '#dfe6ec' },
    { style: 'flax', weight: 0.3, colors: ['#a3b6d6', '#8fa3c8'], soil: '#e6edf2' },
  ],
  grass: ['#e9f0f5', '#d9e3ea', '#f4f8fb'],
  bush: ['#3b6b58', '#dfe9ee'],
  flowers: ['#ffffff', '#cfe3ff'],
  rock: '#8c96a3',
  ore: { color: '#8a5a3a', chance: 0.04 },
  berry: '#b0202a',
  animals: { kind: 'deer', colors: ['#8a6a4e', '#6e5440', '#a08262'] },
  boat: 'longship',
  boatColors: ['#5f4530', '#a9392c'],
  lily: '#f4f9fc',
  smoke: '#ffffff',
  weather: { kind: 'snow', colors: ['#ffffff', '#e8f0fb'], density: 1.0 },
  sparkle: '#ffffff',
  ui: { accent: '#9a3b2e', panel: '#f7fafd', ink: '#1f2a36', soft: '#5f6f80', frame: 'madeira', emblem: 'corvo' },
  grade: { shadow: '#4a78b8', light: '#cfe3ff', saturation: 0.92 },
  atmos: { haze: 1.4, hazeColor: '#d5e4f2', wind: 0.9, filter: [0.94, 0.98, 1.06] },
  season: 3,
  synergy: { lumber: 'Lenhadores', mill: 'Estabur', pasture: 'Curral de renas', apiary: 'Colmeias de hidromel' },
  blessingNames: { cartographers: 'Navegadores', builders: 'Construtores de salões', pilgrims: 'Escaldos' },
  folk: { skin: '#e8c4a8', hat: 'hood', hatColor: '#a83a2e' },
  music: { scale: [0, 2, 3, 5, 7, 8, 10], timbre: 'pluck' },
  wonder: { name: 'Palácio de Gelo', core: 'ice', colors: ['#cfe6f5', '#e8f4fb', '#9fd0ef'] },
  eras: ['Sítio', 'Vilarejo', 'Entreposto', 'Burgo'],
  center: 'hall',
  rules: { startTiles: 55, questChance: 0.28, synergyBonus: { lumber: 3 }, seasonLock: 3 },
  ruleNote: 'Começa com 45 peças e missões um pouco mais raras. Lareira: os lenhadores (aldeia + taiga) valem 3 pontos a mais. A paisagem fica no inverno, e o pasto rende +3.',
};
