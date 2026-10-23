import { T } from '../core/tiles';
import type { Theme } from './types';

// Terraços do Oriente: fusão dos antigos Jardim Sakura, Jade Song e Edo Tranquilo numa paisagem de
// rolo pintado do Leste Asiático, sem data exata. A China Song dá a escala (rio largo, arroz, bambu,
// junco, pagode); o Japão Edo dá o desenho da vila (machiya, torii, estrada de posta, pinheiro); a
// primavera do Sakura fica como estação travada. Saíram o trem-bala (anacrônico), a ferrovia, a barcaça,
// as jazidas, o trigo e a amoreira como lavoura. Os motivos estão em docs/TEMAS.md.

export const oriental: Theme = {
  id: 'oriental',
  name: 'Terraços do Oriente',
  era: 'Leste Asiático · paisagem de rolo, da China Song ao Japão Edo',
  period: 'moderna',
  tagline: 'Arrozais em terraço, bambuzais e pinheiros, torii e pagodes numa manhã de névoa.',
  terrainNames: ['Colina', 'Bosque', 'Arrozal', 'Aldeia', 'Rio', 'Via de posta'],
  terrainColors: ['#8fae78', '#4f7a5c', '#8fc07a', '#5b4535', '#4a9aa8', '#c4b48e'],
  bg: '#cfd8ca',
  voidFill: '#d8e0d3',
  voidLine: '#e8eee4',
  surround: 'mar',
  sun: '#fff5e2',
  sunIntensity: 2.1,
  sunDir: [-0.4, 0.9, 0.42],
  hemiSky: '#f1f6f0',
  hemiGround: '#7c8a78',
  hemiIntensity: 1.38,
  // O chão verde fica: a cerejeira rosa contra um chão rosa (o Sakura) e o telhado cinza-esverdeado
  // contra um chão jade (o Song) apertavam o ΔE de tests/legibility.ts. A vila é o tom escuro do Edo.
  ground: ['#8fae78', '#4f7a5c', '#7aa88a', '#8f8474', '#9fb8a8', '#c4b48e'],
  side: '#6f5d4c',
  sideDark: '#3c2f27',
  water: '#5aa5ad',
  bank: '#d5e0b8',
  // Caminho de posta: terra batida com lajes de passo (o 'dirt' desenhava dois sulcos paralelos e lia como trilho de trem).
  road: 'stepstone',
  roadBed: '#c2b08a',
  roadDetail: '#8b8f8a',
  sleeper: '#5a4a3a',
  vehicle: 'cart',
  vehicleColors: ['#7a5238', '#b23a2e'],
  forest: [
    { geo: 'bamboo', weight: 0.3, colors: ['#6f9f4f', '#82b05c', '#5f9048'] },
    { geo: 'niwaki', weight: 0.2, colors: ['#2f5340', '#284836', '#3a6049'] },
    { geo: 'conifer', weight: 0.2, colors: ['#30594a', '#3a6757', '#294d3f'] },
    { geo: 'blossom', weight: 0.15, colors: ['#f7b7cf', '#f4a3c0', '#fbd0de', '#f3c9d2'] },
    { geo: 'willow', weight: 0.08, colors: ['#8fb86a', '#a0c477', '#7fa85e'] },
    { geo: 'round', weight: 0.07, colors: ['#c8583c', '#d9703f', '#b84a34'] },
  ],
  trunk: '#4e3a30',
  treesPerSector: [4, 7],
  houses: [
    // Machiya (Edo): sobrado de madeira escura com reboco claro nas frestas.
    { weight: 0.35, body: 'tall', roof: 'hip', walls: ['#5b4535', '#4e3c2e', '#6a5240', '#53402f', '#8a6a50', '#a88a68'], roofs: ['#4a505a', '#3f454f', '#565c66', '#6a6f78', '#5a6a60', '#7a4a3a', '#2f343c'], trim: '#e2d8c2' },
    // Casa de pátio (Song): gesso claro, beiral curvo e viga cinabre.
    { weight: 0.3, body: 'cottage', roof: 'pagoda', walls: ['#f1ead8', '#e6ddc6', '#efe6d2', '#6e5640', '#8a6a50', '#f6f0e2'], roofs: ['#3e4a5c', '#2f3d4f', '#5a3a3a', '#46536a', '#4b5d5a', '#8a5a4a', '#a85a4a'], trim: '#6b4530' },
    // Nagaya: fileira comprida de madeira.
    { weight: 0.15, body: 'long', roof: 'hip', walls: ['#6a5240', '#5b4535', '#7a6048', '#a88a68', '#e0d4ba'], roofs: ['#4a505a', '#565c66', '#7a4a3a', '#5a6a60', '#2f343c'], trim: '#d8ceb6' },
    // Casa de chá: sobrado claro de beiral curvo e moldura vermelha.
    { weight: 0.1, body: 'tall', roof: 'pagoda', walls: ['#efe4cc', '#fbf6ea', '#b89a74', '#f6f0e2'], roofs: ['#4f5f5c', '#3e4a5c', '#8a4a3a', '#2f343c'], trim: '#a8482f' },
    // Kura (depósito caiado) e a cumeeira cruzada.
    { weight: 0.08, body: 'annex', roof: 'pagoda', walls: ['#f3ede2', '#e6dccb', '#efe4d3', '#7a5a40', '#8a6a4a'], roofs: ['#3e4a5c', '#2f3d4f', '#46536a', '#4b5d5a', '#2f343c'], trim: '#5a3a2e', minor: true },
    { weight: 0.06, body: 'cottage', roof: 'cross', walls: ['#5b4535', '#4e3c2e', '#6a5240', '#8a6a50', '#a88a68'], roofs: ['#4a505a', '#3f454f', '#565c66', '#5a6a60', '#2f343c'], trim: '#e2d8c2', minor: true },
  ],
  landmark: 'pagoda',
  landmarkChance: 0.13,
  landmarkColors: ['#9a4a34', '#3f4650', '#d9b45a'],
  window: '#ffdf9a',
  mill: 'stilt',
  // Torii (Edo) e paifang (Song) convivem: cada portal sorteia o seu estilo pela semente da peça.
  gates: [
    { style: 'torii', colors: ['#c8402e', '#2a2624'] },
    { style: 'paifang', colors: ['#a8362a', '#3f6b5a'] },
  ],
  bridge: { style: 'wood', colors: ['#8a6a4a', '#c8402e'] },
  crops: [
    { style: 'rice', weight: 0.5, colors: ['#8fc07a', '#a3ce86', '#7fb26e'], soil: '#7fb0ab' },
    // Arroz maduro num campo drenado: dourado sobre lama, em vez de lâmina d'água.
    { style: 'rice', weight: 0.1, colors: ['#d9b84a', '#e6c860', '#cfa93e'], soil: '#9a8a5e' },
    { style: 'tea', weight: 0.4, colors: ['#4f8f4a', '#5f9f55', '#437f44'], soil: '#8a7856' },
  ],
  // Arrozais em terraço: cada parcela sobe em 3 patamares de muretas de pedra, com a lâmina d'água em cada degrau.
  terraces: { levels: 3, rise: 2.4 },
  grass: ['#93b080', '#a0c08e', '#86a874'],
  bush: ['#5f8f5a', '#4f6f52', '#f4a3c0'],
  flowers: ['#fbf6ee', '#f3c9d2', '#c9b6e0', '#f0b6c4'],
  rock: '#8f9590',
  animals: { kind: 'buffalo', colors: ['#6d6f6f', '#5c5e5e', '#7d7f7c'] },
  // Fauna: garça-branca na margem de dia, sika no bosque ao fim da tarde, búfalos no arrozal.
  fauna: [
    { kind: 'heron', weight: 1, colors: ['#f4f6f2', '#e8eeea', '#b4bec8'], time: 'dia', where: 'margem', chance: 0.45 },
    { kind: 'deer', weight: 1, colors: ['#a8764a', '#9a6a44', '#b58656'], time: 'tarde', where: 'floresta', chance: 0.3 },
    { kind: 'buffalo', weight: 1, colors: ['#5c5e5e', '#6d6f6f'], time: 'dia', where: 'campo', chance: 0.3 },
  ],
  // Serras de névoa em tinta (rocha cinza-azulada, sem neve, pinheiros na encosta) no estilo de rolo pintado.
  relief: { amp: 1.1, style: 'serra', rock: '#7d8c99', mist: '#dfe8ea', tall: 1.3, slopeTrees: ['conifer', 'niwaki'] },
  ambience: [
    { kind: 'sapos', weight: 0.7 },
    { kind: 'cigarras', weight: 0.6 },
    { kind: 'aves', weight: 0.5 },
    { kind: 'sinos', weight: 0.35 },
    { kind: 'agua', weight: 0.5 },
  ],
  eggs: [
    {
      id: 'cerejeira-milenar',
      name: 'Cerejeira milenar',
      note: 'Um bosque de oito peças floresce: uma cerejeira milenar brota no coração dele.',
      when: [{ kind: 'grupo', terrain: T.Forest, min: 8 }],
      effect: [{ kind: 'kit', kit: 'cerejeira-milenar', scale: 1.25, color: '#f4a3c0' }, { kind: 'ceu', tint: '#f8c3d6', strength: 0.4, seconds: 14 }, { kind: 'som', sound: 'brilho' }],
    },
    {
      id: 'grande-carpa',
      name: 'A Grande Carpa',
      note: 'Num lago do jardim, uma carpa dourada salta e promete boa sorte.',
      when: [{ kind: 'bordas', terrain: T.Grass, min: 4 }, { kind: 'sorte', chance: 0.18 }],
      effect: [{ kind: 'kit', kit: 'lago-carpa', scale: 1.3 }, { kind: 'som', sound: 'brilho' }],
    },
    {
      id: 'gato-da-sorte',
      name: 'Gato da sorte',
      note: 'Cinquenta peças: um maneki-neko acena num santuário à beira do caminho.',
      // A partida clássica tem ~68 peças com os bônus de era: 100 nunca chegaria; 50 cai na reta final.
      when: [{ kind: 'pecas', n: 50 }],
      effect: [{ kind: 'kit', kit: 'gato-da-sorte', scale: 1.35, color: '#f4eee2' }, { kind: 'som', sound: 'sinos' }],
    },
    {
      id: 'noite-de-lanternas',
      name: 'Noite das lanternas',
      note: 'Noite de Obon e da Lua da Colheita: aldeões levam lanternas pelo caminho.',
      when: [{ kind: 'hora', from: 19, to: 23 }, { kind: 'data' }],
      holidays: [{ month: 8, day: 13, until: { month: 8, day: 16 } }, { month: 9, day: 15, until: { month: 9, day: 17 } }],
      effect: [{ kind: 'evento', event: 'procissao', color: '#e8553a' }, { kind: 'ceu', tint: '#ffcf8a', strength: 0.35, seconds: 0 }, { kind: 'som', sound: 'sinos' }],
    },
  ],
  boat: 'junk',
  boatColors: ['#5b4030', '#b98a52'],
  lily: '#6fa86a',
  smoke: '#f2f2ee',
  weather: { kind: 'petals', colors: ['#f8c3d6', '#fbe0ea'], density: 0.7 },
  sparkle: '#fff0f6',
  ui: { accent: '#b23a2e', panel: '#f6f8f2', ink: '#1e2624', soft: '#66756d', frame: 'seda', emblem: 'sakura' },
  grade: { shadow: '#4f7f8a', light: '#f6dcc4', saturation: 0.92 },
  atmos: { haze: 1.1, hazeColor: '#e2ece6', wind: 0.6, filter: [1, 1, 1] },
  season: 0,
  roadLamps: true,
  synergy: { lumber: 'Oficina de bambu', mill: 'Armazém kura', pasture: 'Curral de búfalos', apiary: 'Colmeias' },
  blessingNames: { surveyors: 'Agrimensores imperiais', cartographers: 'Cartógrafos da corte', pilgrims: 'Monges itinerantes' },
  folk: { skin: '#e3b890', hat: 'straw', hatColor: '#b8975a' },
  // Escala iwato (Edo), de som mais escuro; o timbre é a corda dedilhada do koto e do guzheng.
  music: { scale: [0, 1, 5, 7, 8], timbre: 'pluck' },
  wonder: { name: 'Grande Pagode', core: 'pagoda', colors: ['#9a4a34', '#3f4650', '#d9b45a'], stories: 9 },
  eras: ['Mura', 'Vila de mercado', 'Cidade murada', 'Capital'],
  center: 'pagoda',
  rules: { matchBonus: { [T.Field]: 3 }, perfectBonus: 25, seasonLock: 0 },
  ruleNote: 'Arrozal em terraço: cada borda de arrozal encaixada vale 3 pontos a mais, e o encaixe perfeito vale 25. A paisagem fica na primavera, e as colmeias rendem +3.',
};
