import { T } from '../core/tiles';
import type { Theme } from './types';

// Egito do Nilo: Novo Império, c. 1300 a.C. A Dádiva do Nilo (borda de rio encaixada vale +5) é a regra do tema.
// Peça-assinatura (T2): a várzea. O chão perto do rio vira terra negra e fértil (Kemet) e o resto é duna dourada (Deshret):
// a faixa verde acompanha o Nilo e o deserto cerca tudo. Falésias de arenito longe do rio, canais de irrigação com shaduf,
// terraços de adobe com toldo listrado, pilone na entrada da vila, ibis e crocodilo na margem, gado de chifres de lira.

export const egito: Theme = {
  id: 'egito',
  name: 'Egito do Nilo',
  era: 'Egito Antigo · Novo Império, c. 1300 a.C.',
  period: 'antiguidade',
  tagline: 'Falucas no Nilo turquesa, tamareiras e casas de adobe sob o sol dourado.',
  terrainNames: ['Várzea', 'Palmeiral', 'Campo da cheia', 'Aldeia', 'Nilo', 'Trilha'],
  terrainColors: ['#4f4326', '#5f8a3f', '#dcb04e', '#e0cfa0', '#2fb0aa', '#deb066'],
  bg: '#efdfa8',
  voidFill: '#f3e5bb',
  voidLine: '#f9efd2',
  surround: 'areia',
  sun: '#fff0c4',
  sunIntensity: 2.6,
  sunDir: [-0.3, 1, 0.25],
  hemiSky: '#fff6dc',
  hemiGround: '#b8965a',
  hemiIntensity: 1.3,
  ground: ['#d4bc86', '#7d8f52', '#b08a48', '#b8a274', '#d2c48c', '#deb066'],
  side: '#a67c4a',
  sideDark: '#5e4128',
  water: '#2fb0aa',
  bank: '#7a6038',
  road: 'sand',
  roadBed: '#ecd49a',
  roadDetail: '#b8925a',
  sleeper: '#8a6a3e',
  vehicle: 'caravan',
  vehicleColors: ['#b5533a', '#2a4b8d'],
  forest: [
    { geo: 'palm', weight: 0.63, colors: ['#5f8f3c', '#6ea044', '#4f8238'] },
    { geo: 'round', weight: 0.25, colors: ['#7a9c46', '#8aaa4e', '#6f9040'] },
    // Acácia de copa chata em guarda-sol, a sombra do deserto.
    { geo: 'umbrella', weight: 0.12, colors: ['#8fa060', '#9caa68', '#7f9256'] },
  ],
  trunk: '#7a5a3a',
  treesPerSector: [3, 5],
  houses: [
    // Terraço de adobe com toldo listrado: o corpo de duas camadas, escada externa e sala em cima.
    { weight: 0.3, body: 'terrace', roof: 'awning', walls: ['#eadbb8', '#e0c898', '#f0e4c4', '#e8d8b4', '#fbf4e0', '#f6eed8'], roofs: ['#8e6e46', '#7e6040', '#7a5a38', '#6f8f7a', '#a8704a', '#6b5a44'], trim: '#2a4b8d', door: '#3a2a1e' },
    { weight: 0.29, body: 'cube', roof: 'flat', walls: ['#eadbb8', '#e0c898', '#f0e4c4', '#e8d8b4', '#fbf4e0', '#f6eed8'], roofs: ['#8e6e46', '#7e6040', '#7a5a38', '#6f8f7a', '#a8704a', '#6b5a44'], trim: '#2a4b8d' },
    { weight: 0.2, body: 'cottage', roof: 'flat', walls: ['#e6d3a8', '#dcc59a', '#efe0bc', '#fff6e0', '#f2e8cc'], roofs: ['#8a6a44', '#7e6040', '#7a5a38', '#a8704a', '#6f8f7a'] },
    { weight: 0.12, body: 'cube', roof: 'dome', walls: ['#e8d6b0', '#dcc596', '#f2e6c8', '#fff4dc'], roofs: ['#f4e8c0', '#6f9ab0', '#e8cc90', '#8a5a3a', '#a8c0b8'] },
    { weight: 0.07, body: 'annex', roof: 'flat', walls: ['#e6d3a8', '#dcc59a', '#efe0bc', '#fff6e0', '#f2e8cc'], roofs: ['#8a6a44', '#7e6040', '#7a5a38', '#a8704a', '#6f8f7a'], minor: true },
  ],
  landmark: 'pylon',
  landmarkChance: 0.12,
  landmarkColors: ['#e8d3a0', '#c9a24a', '#2a4b8d'],
  window: '#ffcf7a',
  mill: 'granary',
  // Portal de pilone onde a trilha encosta na vila (não pontua). Sem ponte: o Egito antigo cruzava o Nilo de barco.
  gate: { style: 'pylon', colors: ['#e6d2a0', '#2a4b8d'] },
  crops: [
    { style: 'wheat', weight: 0.35, colors: ['#e6b84a', '#d9a93c', '#efc65a'], soil: '#9a7440' },
    { style: 'barley', weight: 0.3, colors: ['#cfb85a', '#c2aa4c', '#d8c266'], soil: '#8f6e3e' },
    { style: 'papyrus', weight: 0.2, colors: ['#6f9a48', '#7fae55', '#5c8a3e'], soil: '#6f7a45' },
    { style: 'flax', weight: 0.15, colors: ['#8aa6d8', '#7896cc', '#9db6e2'], soil: '#8f7444' },
  ],
  grass: ['#a8a85c', '#b8b66a', '#98984e'],
  bush: ['#7f9a4e', '#8fa85a'],
  flowers: ['#fbf6ee', '#f4d35a', '#e9b25c', '#9ccbe0'],
  rock: '#b8a482',
  ore: { color: '#b87333', chance: 0.04 },
  berry: '#8a4a1a',
  animals: { kind: 'donkey', colors: ['#8a7a68', '#7a6a5a', '#9a8a76'] },
  // Gado de chifres de lira nos pastos de várzea, ibis e crocodilo na margem do Nilo (só de dia, o crocodilo toma sol).
  fauna: [
    { kind: 'ox', weight: 1, colors: ['#f0e8d8', '#7a4a2a', '#2f2a28', '#c8a070'], where: 'prado', chance: 0.25 },
    { kind: 'ibis', weight: 0.65, colors: ['#f4f0e6', '#ece6d8'], time: 'dia', where: 'margem', chance: 0.4 },
    { kind: 'crocodile', weight: 0.35, colors: ['#5f7a4a', '#6b8452', '#586a40'], time: 'dia', where: 'margem', chance: 0.4 },
  ],
  // Canais de irrigação nos canteiros e shaduf na margem: a água do Nilo levada ao campo.
  irrigation: { color: '#3fb8b4', cross: 0.55 },
  // Várzea: o chão perto do Nilo vira terra negra; longe do rio vale a duna de `ground`.
  floodplain: { reach: 1.7, color: '#4f4326' },
  // Falésias de arenito (estilo 'falesia') longe do rio, sem neve.
  relief: { amp: 0.4, style: 'falesia', rock: '#c9a26a' },
  // O Egito não tem inverno de neve: a paisagem fica em verão (Shemu, a seca e a colheita).
  season: 1,
  ambience: [
    { kind: 'cigarras', weight: 0.6 },
    { kind: 'grilos', weight: 0.9 },
    { kind: 'agua', weight: 0.5 },
    { kind: 'vento', weight: 0.35 },
  ],
  boat: 'nile',
  boatColors: ['#8a6238', '#f4ecd8'],
  lily: '#5aa070',
  smoke: '#efe6d0',
  weather: { kind: 'dust', colors: ['#e8cf9a', '#d9b874'], density: 0.55 },
  sparkle: '#fff2b8',
  ui: { accent: '#94600f', panel: '#fbf5e6', ink: '#3a2a14', soft: '#7d6640', frame: 'papiro', emblem: 'sol' },
  grade: { shadow: '#4a6a9a', light: '#ffc86a', saturation: 1.04 },
  atmos: { haze: 1.45, hazeColor: '#e6d2a4', wind: 0.65, filter: [1.05, 1, 0.9] },
  synergy: { lumber: 'Oficina de palmeira', mill: 'Celeiro real', pasture: 'Curral de gado', apiary: 'Colmeias de barro' },
  blessingNames: { cartographers: 'Escribas do faraó', builders: 'Construtores de pirâmides', pilgrims: 'Peregrinos de Karnak' },
  folk: { skin: '#a8714a', hat: 'scarf', hatColor: '#f2ead6' },
  music: { scale: [0, 1, 4, 5, 7, 8, 10], timbre: 'flute' },
  wonder: { name: 'Pilone de Karnak', core: 'pylon', colors: ['#e8d3a0', '#c9b088', '#3a5a8a'] },
  eras: ['Pré-dinástico', 'Antigo Império', 'Médio Império', 'Novo Império'],
  center: 'pyramid',
  // Easter eggs (src/core/eggs.ts), sem data inventada: dois por contagem de peças, um por combinação de bordas, um por
  // sorte da peça e um pela hora do aparelho (meio-dia).
  eggs: [
    {
      id: 'esfinge',
      name: 'Esfinge',
      note: 'A 38ª peça: uma esfinge desperta na areia e olha para a vila.',
      when: [{ kind: 'pecas', n: 38 }],
      effect: [{ kind: 'kit', kit: 'esfinge', scale: 1.15, color: '#d8c08a' }, { kind: 'som', sound: 'brilho' }],
    },
    {
      id: 'cheia-perfeita',
      name: 'Cheia perfeita',
      note: 'Cheia perfeita: o campo inteiro bebe do Nilo e um íbis desce para pescar.',
      when: [{ kind: 'bordas', terrain: T.Field, min: 3 }, { kind: 'bordas', terrain: T.Water, min: 1 }],
      once: true,
      effect: [{ kind: 'kit', kit: 'ibis', scale: 1.9 }, { kind: 'som', sound: 'brilho' }],
    },
    {
      id: 'gato-de-bastet',
      name: 'Gato de Bastet',
      note: 'Um gato preto se senta entre as casas, vigiando o grão.',
      when: [{ kind: 'bordas', terrain: T.Village, min: 3 }, { kind: 'sorte', chance: 0.1 }],
      once: true,
      effect: [{ kind: 'kit', kit: 'gato', scale: 1.7 }],
    },
    {
      id: 'piramide-de-gize',
      name: 'Pirâmide',
      note: 'A centésima peça: uma pirâmide de piramídio dourado se ergue no horizonte do campo.',
      when: [{ kind: 'pecas', n: 100 }],
      effect: [{ kind: 'kit', kit: 'piramide', scale: 1.25, color: '#ead6a0' }, { kind: 'som', sound: 'sinos' }],
    },
    {
      id: 'ra-a-pino',
      name: 'Rá a pino',
      note: 'Meio-dia: Rá cruza o céu e o deserto arde em ouro.',
      when: [{ kind: 'hora', from: 11.75, to: 12.25 }],
      effect: [{ kind: 'ceu', tint: '#ffd566', strength: 0.35, seconds: 0 }, { kind: 'evento', event: 'bando-dourado' }, { kind: 'som', sound: 'brilho' }],
    },
  ],
  rules: { startTiles: 48, questChance: 0.36, matchBonus: { [T.Water]: 5 }, seasonLock: 1 },
  ruleNote: 'Dádiva do Nilo: cada borda de rio encaixada vale 5 pontos a mais. Começa com 38 peças, e o faraó pede obras com mais frequência.',
};
