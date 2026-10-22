import type { Theme } from './types';

// Brasil Dourado: fusão dos antigos Cerrado Dourado e Minas Colonial num Brasil interior, entre os
// séculos XVIII e XIX e sem ano exato (o café em larga escala e a maria-fumaça mineira são do XIX).
// Do Cerrado vêm os ipês, os buritis, a cana, o café, a luz de fim de tarde e o pólen; do Colonial,
// o casario caiado, o barroco, a tropa na Estrada Real e a ponte de pedra. Saíram a ferrovia e o trem
// (a Estrada Real é a espinha), a araucária dominante, o mar e o azul-acinzentado frio do fundo.

export const brasil: Theme = {
  id: 'brasil',
  name: 'Brasil Dourado',
  era: 'Brasil interior · Minas Gerais e Cerrado, séculos XVIII e XIX',
  period: 'moderna',
  tagline: 'Casario caiado, ipês floridos, buritis e a Estrada Real entre as serras.',
  terrainNames: ['Cerrado', 'Grota', 'Lavoura', 'Arraial', 'Ribeirão', 'Estrada Real'],
  terrainColors: ['#c2b25a', '#387a4a', '#86b04a', '#fbf7ee', '#4f9fa8', '#b9ab94'],
  bg: '#f1dcb4',
  voidFill: '#f5e4c0',
  voidLine: '#faeed6',
  surround: 'areia',
  sun: '#ffe0b0',
  sunIntensity: 2.5,
  sunDir: [-0.55, 0.8, 0.4],
  hemiSky: '#f2f6fb',
  hemiGround: '#a8653e',
  hemiIntensity: 1.3,
  // Cerrado ocre aberto contra a grota verde-escura; a vila fica no tom claro e frio do casario caiado.
  ground: ['#c4b05a', '#4a7d45', '#a5663f', '#cdb98f', '#a8b88a', '#bba690'],
  side: '#9a5a38',
  sideDark: '#57301f',
  water: '#4f9fa8',
  bank: '#e6cfa8',
  road: 'stone',
  roadBed: '#b9ab94',
  roadDetail: '#8a7c68',
  sleeper: '#5a4a3a',
  vehicle: 'caravan',
  vehicleColors: ['#c9a86a', '#3f6fa0'],
  forest: [
    // Cerrado: árvores tortas (oliveira lê como pequi e lixeira) e ipês de quatro cores.
    { geo: 'olive', weight: 0.24, colors: ['#7a9a4a', '#869f55', '#6a8a40'] },
    { geo: 'blossom', weight: 0.14, colors: ['#f2c12e', '#f5cf3a', '#e8b21e'] },
    { geo: 'blossom', weight: 0.09, colors: ['#e96fae', '#d85c9e', '#f18cc0'] },
    { geo: 'blossom', weight: 0.04, colors: ['#f6efe4', '#efe4d2'] },
    { geo: 'blossom', weight: 0.05, colors: ['#c58ad0', '#b872c8', '#d9a0d8'] },
    // Grota: copa redonda e densa, com buriti e jerivá.
    { geo: 'round', weight: 0.2, colors: ['#3f7a44', '#4f8a48', '#35683c'] },
    { geo: 'waxpalm', weight: 0.1, colors: ['#5f9a40', '#6aa545'] },
    { geo: 'palm', weight: 0.12, colors: ['#4f8a3a', '#5f9a40'] },
  ],
  trunk: '#5a3b2a',
  treesPerSector: [3, 6],
  houses: [
    // Sobrado caiado de esquadria azul-colonial.
    { weight: 0.35, body: 'tall', roof: 'hip', walls: ['#fbf7ee', '#f4eedd', '#fffaf0', '#f1e3c0', '#f2a888', '#bfd8e0'], roofs: ['#b5542f', '#c4623a', '#a44a2c', '#8a4a32', '#d07a48', '#6f8f7a'], trim: '#2f6fa8' },
    // Casa térrea de cores do Cerrado, numa gama menor que a de antes.
    { weight: 0.35, body: 'cottage', roof: 'hip', walls: ['#fbf7ee', '#f6e27a', '#8ec3e6', '#f19b8a', '#b9e1a4', '#f1e3c0'], roofs: ['#b5502f', '#c4623a', '#a8452a', '#8a4a32', '#6f9e8e'], trim: '#d19a2e' },
    // Fazenda: casa comprida com varanda.
    { weight: 0.2, body: 'long', roof: 'gable', walls: ['#fbf7ee', '#eee6d6', '#f2a888', '#9fc0d0'], roofs: ['#b5542f', '#c4623a', '#8a4a32', '#d07a48'], trim: '#a8402f' },
    // Paiol e cumeeira cruzada, raros.
    { weight: 0.08, body: 'annex', roof: 'hip', walls: ['#fbf7ee', '#eee6d6', '#f2a888', '#9fc0d0'], roofs: ['#b5542f', '#c4623a', '#8a4a32', '#d07a48'], trim: '#a8402f', minor: true },
    { weight: 0.06, body: 'cottage', roof: 'cross', walls: ['#fbf7ee', '#f1e3c0', '#f2a888', '#f2c88a', '#bfd8e0'], roofs: ['#b5542f', '#c4623a', '#a44a2c', '#8a4a32'], trim: '#d19a2e', minor: true },
  ],
  landmark: 'baroque',
  landmarkChance: 0.13,
  landmarkColors: ['#fbf7ee', '#b5542f', '#c9962e'],
  window: '#ffd98a',
  mill: 'granary',
  bridge: { style: 'stone', colors: ['#b8b0a0', '#9a9284'] },
  crops: [
    // O café é a assinatura; a cana, o milho e o algodão completam.
    { style: 'coffee', weight: 0.35, colors: ['#3f7a3a', '#4a8a40'], soil: '#8a4a30' },
    { style: 'sugarcane', weight: 0.35, colors: ['#86b04a', '#9cc457', '#78a442'], soil: '#a5603a' },
    { style: 'corn', weight: 0.15, colors: ['#93b84a', '#a3c455'], soil: '#a06a44' },
    { style: 'cotton', weight: 0.15, colors: ['#f8f6f0'], soil: '#a86a44' },
  ],
  grass: ['#b9ad52', '#c9bc60', '#a89c48'],
  bush: ['#7a8a3e', '#8e9540', '#5f8a44'],
  flowers: ['#f2c12e', '#e96fae', '#ffffff', '#c58ad0'],
  rock: '#b8805c',
  ore: { color: '#e8c04a', chance: 0.05 },
  berry: '#e8a020',
  // A mula é da tropa da Estrada Real (a caravana usa este bicho).
  animals: { kind: 'donkey', colors: ['#8a6a4a', '#6e5238', '#9a7a58'] },
  boat: 'canoe',
  boatColors: ['#7a5238', '#d9c08a'],
  lily: '#5f9a4a',
  smoke: '#f6f2ea',
  weather: { kind: 'pollen', colors: ['#fff3cf', '#f2c94c'], density: 0.6 },
  sparkle: '#fff1b0',
  ui: { accent: '#b5502f', panel: '#fff8ec', ink: '#3a2418', soft: '#8a6248', frame: 'papel', emblem: 'ipe' },
  grade: { shadow: '#5a5a8c', light: '#ffc070', saturation: 1.06 },
  atmos: { haze: 0.9, hazeColor: '#f0e2c0', wind: 0.85, filter: [1.04, 1, 0.94] },
  roadLamps: true,
  synergy: { lumber: 'Serraria', mill: 'Paiol', pasture: 'Pouso de tropa', apiary: 'Apiário de jataí' },
  blessingNames: { cartographers: 'Bandeirantes', pilgrims: 'Romeiros' },
  folk: { skin: '#a8714a', hat: 'straw', hatColor: '#d8c9a0' },
  music: { scale: [0, 2, 4, 5, 7, 9, 10], timbre: 'pluck' },
  wonder: { name: 'Santuário do Bom Jesus', core: 'church', colors: ['#fbf7ee', '#8a4a32', '#c9962e'] },
  eras: ['Pouso', 'Arraial', 'Vila Rica', 'Cidade'],
  rules: { perfectBonus: 25, synergyBonus: { pasture: 5 } },
  ruleNote: 'Tropeiros: o pouso de tropa (arraial + cerrado) vale 5 pontos a mais, e o encaixe perfeito vale 25.',
};
