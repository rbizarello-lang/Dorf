import { T } from '../core/tiles';
import type { Theme } from './types';

// Brasil Dourado: fusão dos antigos Cerrado Dourado e Minas Colonial num Brasil interior, entre os
// séculos XVIII e XIX e sem ano exato (o café em larga escala e a maria-fumaça mineira são do XIX).
// Do Cerrado vêm os ipês, os buritis, a cana, o café, a luz de fim de tarde e o pólen; do Colonial,
// o casario caiado, o barroco, a tropa de mulas no caminho de pedra e a ponte de pedra. Saíram a ferrovia e o trem
// (o caminho de pedra é a espinha), a araucária dominante, o mar e o azul-acinzentado frio do fundo.
//
// Etapa T4, o aprofundamento: o café em terraço (com cafezal em florada) e o canavial com engenho são a assinatura
// dos campos; o prado é de cerrado (árvores tortas, cupinzeiros); a fauna é ema, lobo-guará e tamanduá, com bandos de
// araras no céu; o carro de boi e a tropa de mulas andam pelo caminho de pedra ("Estrada Real" é o nome de um modo de
// jogo, por isso nenhum elemento do tema usa esse nome); serras de rocha vermelha com mata no topo; o entorno é a chapada de capim.

export const brasil: Theme = {
  id: 'brasil',
  name: 'Brasil Dourado',
  era: 'Brasil interior · Minas Gerais e Cerrado, séculos XVIII e XIX',
  period: 'moderna',
  tagline: 'Casario caiado, ipês floridos, buritis e o caminho de pedra dos tropeiros entre as serras.',
  terrainNames: ['Cerrado', 'Grota', 'Lavoura', 'Arraial', 'Ribeirão', 'Caminho de Pedra'],
  terrainColors: ['#c2b25a', '#387a4a', '#86b04a', '#fbf7ee', '#4f9fa8', '#b9ab94'],
  bg: '#f1dcb4',
  voidFill: '#f5e4c0',
  voidLine: '#faeed6',
  surround: 'chapada',
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
  // Carro de boi com a mula de tropa atrás: [corda e jugo, palha da coberta e bruacas da mula].
  vehicle: 'oxcart',
  vehicleColors: ['#7a5238', '#d9c08a'],
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
    // Sobrado caiado de esquadria azul-colonial (Ouro Preto, Tiradentes): dois andares mais largos que altos, com sacada de ferro.
    { weight: 0.35, body: 'sobrado', trimStyle: 'caiado', roof: 'colonial', walls: ['#fbf7ee', '#f4eedd', '#fffaf0', '#f1e3c0', '#f2a888', '#bfd8e0'], roofs: ['#b5542f', '#c4623a', '#a44a2c', '#8a4a32', '#d07a48', '#6f8f7a'], trim: '#2f6fa8' },
    // Casa térrea de cores do Cerrado, numa gama menor que a de antes.
    { weight: 0.35, body: 'cottage', trimStyle: 'caiado', roof: 'colonial', walls: ['#fbf7ee', '#f6e27a', '#8ec3e6', '#f19b8a', '#b9e1a4', '#f1e3c0'], roofs: ['#b5502f', '#c4623a', '#a8452a', '#8a4a32', '#6f9e8e'], trim: '#d19a2e' },
    // Fazenda: casa comprida com varanda.
    { weight: 0.2, body: 'long', trimStyle: 'caiado', roof: 'colonial', walls: ['#fbf7ee', '#eee6d6', '#f2a888', '#9fc0d0'], roofs: ['#b5542f', '#c4623a', '#8a4a32', '#d07a48'], trim: '#a8402f' },
    // Paiol e cumeeira cruzada, raros.
    { weight: 0.08, body: 'annex', trimStyle: 'caiado', roof: 'colonial', walls: ['#fbf7ee', '#eee6d6', '#f2a888', '#9fc0d0'], roofs: ['#b5542f', '#c4623a', '#8a4a32', '#d07a48'], trim: '#a8402f', minor: true },
    { weight: 0.06, body: 'cottage', trimStyle: 'caiado', roof: 'cross', walls: ['#fbf7ee', '#f1e3c0', '#f2a888', '#f2c88a', '#bfd8e0'], roofs: ['#b5542f', '#c4623a', '#a44a2c', '#8a4a32'], trim: '#2f7a52', minor: true },
  ],
  landmark: 'baroque',
  landmarkChance: 0.13,
  landmarkColors: ['#fbf7ee', '#b5542f', '#c9962e'],
  window: '#ffd98a',
  mill: 'engenho',
  // Porteira da fazenda onde a estrada entra na vila.
  gates: [{ style: 'porteira', colors: ['#7a5238', '#d8b24a'] }],
  bridge: { style: 'stone', colors: ['#b8b0a0', '#9a9284'] },
  crops: [
    // O café é a assinatura; a cana, o milho e o algodão completam.
    { style: 'coffee', weight: 0.3, colors: ['#3f7a3a', '#4a8a40'], soil: '#8a4a30' },
    { style: 'coffeebloom', weight: 0.14, colors: ['#3f7a3a', '#4a8a40'], soil: '#8a4a30' },
    { style: 'sugarcane', weight: 0.3, colors: ['#86b04a', '#9cc457', '#78a442'], soil: '#a5603a' },
    { style: 'corn', weight: 0.13, colors: ['#93b84a', '#a3c455'], soil: '#a06a44' },
    { style: 'cotton', weight: 0.13, colors: ['#f8f6f0'], soil: '#a86a44' },
  ],
  // O café sobe a encosta em patamares de curva de nível; canavial, milho e algodão ficam no plano.
  terraces: { levels: 3, styles: ['coffee', 'coffeebloom'] },
  // Cupinzeiros de terra vermelha pelo cerrado.
  groundKits: [{ kit: 'cupinzeiro', chance: 0.55, colors: ['#a55a38', '#b06a42', '#94502e', '#bf7448'], count: [1, 3] }],
  grass: ['#b9ad52', '#c9bc60', '#a89c48'],
  bush: ['#7a8a3e', '#8e9540', '#5f8a44'],
  flowers: ['#f2c12e', '#e96fae', '#ffffff', '#c58ad0'],
  rock: '#b8805c',
  ore: { color: '#e8c04a', chance: 0.05 },
  berry: '#e8a020',
  // O zebu do pasto (e dos bois do carro): branco-acinzentado. A mula da tropa tem pelo próprio.
  animals: { kind: 'zebu', colors: ['#d8d0c4', '#c8bdac', '#e4ddd0'] },
  // Fauna do cerrado: a ema de dia, o lobo-guará na hora dourada e o tamanduá-bandeira de dia.
  fauna: [
    { kind: 'rhea', weight: 0.4, colors: ['#8a7d6c', '#9a8c78', '#7a6e60'], time: 'dia', chance: 0.22 },
    { kind: 'maned', weight: 0.3, colors: ['#d4692a', '#c85a24', '#dc7a34'], time: 'tarde', chance: 0.22 },
    { kind: 'anteater', weight: 0.3, colors: ['#7a6e62', '#8a7e70', '#6a6056'], time: 'dia', chance: 0.22 },
  ],
  // Os bandos de pássaros do céu são de araras, em pares: [corpo vermelho, asa amarela, ponta azul].
  skyBirds: { kit: 'arara', colors: ['#d8262c', '#f2c12e', '#2a5fc4'], n: [2, 4] },
  // Serras e chapadões de rocha avermelhada com mata no topo (sem neve).
  relief: { amp: 0.75, style: 'serra', levels: 2, rock: '#b0583a', crown: '#3f7a44' },
  ambience: [
    { kind: 'cigarras', weight: 0.8 },
    { kind: 'aves', weight: 0.55 },
    { kind: 'agua', weight: 0.4 },
    { kind: 'sinos', weight: 0.35 },
  ],
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
  synergy: { lumber: 'Serraria', mill: 'Engenho', pasture: 'Pouso de tropa', apiary: 'Apiário de jataí' },
  blessingNames: { cartographers: 'Bandeirantes', pilgrims: 'Romeiros' },
  folk: { skin: '#a8714a', hat: 'straw', hatColor: '#d8c9a0' },
  music: { scale: [0, 2, 4, 5, 7, 9, 10], timbre: 'pluck' },
  wonder: { name: 'Santuário do Bom Jesus', core: 'church', colors: ['#fbf7ee', '#8a4a32', '#c9962e'] },
  eras: ['Pouso', 'Arraial', 'Vila Rica', 'Cidade'],
  rules: { perfectBonus: 25, synergyBonus: { pasture: 5 } },
  // Easter eggs: a festa de São João (data), a maria-fumaça, os Doze Profetas, a onça na vereda e a revoada de araras.
  eggs: [
    {
      id: 'sao-joao',
      name: 'São João',
      note: 'É junho: balões de papel sobem do arraial e a fogueira estala.',
      when: [{ kind: 'data' }],
      holidays: [{ month: 6, day: 12, until: { month: 6, day: 30 } }],
      effect: [{ kind: 'evento', event: 'festa-junina' }, { kind: 'ceu', tint: '#ff9a3c', strength: 0.22, seconds: 25 }, { kind: 'som', sound: 'brilho' }],
    },
    {
      id: 'maria-fumaca',
      name: 'Maria-fumaça',
      note: 'Apita a maria-fumaça: a primeira ferrovia da Estrada cruza o arraial.',
      when: [{ kind: 'bordas', terrain: T.Rail, min: 2, max: 2 }, { kind: 'grupo', terrain: T.Rail, min: 5 }],
      once: true,
      effect: [{ kind: 'evento', event: 'maria-fumaca' }, { kind: 'som', sound: 'sinos' }],
    },
    {
      id: 'doze-profetas',
      name: 'Doze Profetas',
      note: 'Doze profetas de pedra-sabão sobem à escadaria do santuário (o sétimo traz chapéu de tropeiro).',
      when: [{ kind: 'grupo', terrain: T.Village, min: 12 }],
      effect: [{ kind: 'kit', kit: 'profetas', scale: 1.6 }, { kind: 'som', sound: 'sinos' }],
    },
    {
      id: 'onca-na-vereda',
      name: 'Onça na vereda',
      note: 'Uma onça-pintada cochila num tronco, à beira do ribeirão.',
      when: [{ kind: 'bordas', terrain: T.Forest, min: 1 }, { kind: 'bordas', terrain: T.Water, min: 1 }, { kind: 'sorte', chance: 0.05 }],
      effect: [{ kind: 'kit', kit: 'onca' }],
    },
    {
      id: 'revoada-das-araras',
      name: 'Revoada das araras',
      note: 'A grota é tão grande que as araras levantam voo, gritando.',
      when: [{ kind: 'grupo', terrain: T.Forest, min: 14 }],
      effect: [{ kind: 'evento', event: 'revoada' }, { kind: 'som', sound: 'brilho' }],
    },
  ],
  ruleNote: 'Tropeiros: o pouso de tropa (arraial + cerrado) vale 5 pontos a mais, e o encaixe perfeito vale 25.',
};
