import { T } from '../core/tiles';
import type { Theme } from './types';

// Inverno Nórdico: o Inverno de antes, agora com o melhor da Terra dos Vikings, que saiu da lista. Ficam
// a casa longa de turfa, o estabur, o drakkar, o capuz, a moldura de madeira com o corvo e os nomes das
// cartas. Saem o verde de verão, o carvalho, a data do século X e o trem a vapor. As regras ficam como
// eram, então uma partida salva deste tema continua valendo.
//
// Um fiorde no meio do inverno, sem data: o campo de cultivo virou LAGO CONGELADO (rachaduras, buracos de
// pesca, tenda e varal de peixe seco), a trilha é de trenó puxado por rena, a noite tem aurora boreal e
// a maravilha é uma stavkirke. Os kits novos estão em src/render/kits/inverno.ts. O que ainda falta
// (casa de sauna, segundo marco, neve de telhado por shader) está em docs/TEMAS.md.

export const inverno: Theme = {
  id: 'inverno',
  name: 'Inverno Nórdico',
  era: 'Escandinávia · no inverno, sem data',
  period: 'contemporanea',
  tagline: 'Casas longas de turfa, cabanas vermelhas, drakkars no fiorde e pinhais sob a neve.',
  terrainNames: ['Neve', 'Taiga', 'Lago gelado', 'Aldeia', 'Fiorde', 'Trilha de trenó'],
  terrainColors: ['#e6eef5', '#2e5a4c', '#a9cfe3', '#9a3b2e', '#2e5f78', '#8c7a5c'],
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
  ground: ['#eef3f7', '#dfe7ee', '#d2e0ea', '#e4e7ea', '#e6eef4', '#eef3f7'],
  side: '#6b7a8a',
  sideDark: '#3b4654',
  water: '#2e5f78',
  bank: '#ffffff',
  road: 'dirt',
  roadBed: '#a9b3bf',
  roadDetail: '#6d7886',
  sleeper: '#5b4a3e',
  // Trilha de trenó: sulcos de patins na neve e um trenó de rena (o trem a vapor saiu).
  vehicle: 'sled',
  vehicleColors: ['#6a4a34', '#a83a2e'],
  forest: [
    { geo: 'conifer', weight: 0.48, colors: ['#2e5a4c', '#3b6b58', '#24493f', '#355f52'] },
    { geo: 'spire', weight: 0.17, colors: ['#24493f', '#2a5446', '#1f4238'] },
    { geo: 'birch', weight: 0.2, colors: ['#dfe9ee', '#cfdde4'] },
    { geo: 'conifer', weight: 0.15, colors: ['#dfe9ee', '#cfdde4'] },
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
  // Pórtico de dragões na entrada da vila (madeira escura e neve na travessa).
  gate: { style: 'dragon', colors: ['#4a2e22', '#e6eef5'] },
  bridge: { style: 'wood', colors: ['#5a3a26', '#cfd6dc'] },
  crops: [
    // O lago congelado no lugar da lavoura: gelo azulado com rachaduras e buracos de pesca, e um pesqueiro
    // (tenda, varal) em muitas parcelas. É a primeira cultura: a aba da emenda herda a cor dela.
    { style: 'icefield', weight: 0.78, colors: ['#d4ebf8', '#c2e0f2', '#e4f3fb'], soil: '#5c96bb' },
    // Um campo em cada quatro continua de cevada sob a neve (o laço com a economia dos vikings).
    { style: 'barley', weight: 0.22, colors: ['#d9c9a0', '#e6dbc0', '#cbbb92'], soil: '#dfe6ec' },
  ],
  grass: ['#e9f0f5', '#d9e3ea', '#f4f8fb'],
  bush: ['#3b6b58', '#dfe9ee'],
  flowers: ['#ffffff', '#cfe3ff'],
  rock: '#8c96a3',
  ore: { color: '#8a5a3a', chance: 0.04 },
  berry: '#b0202a',
  animals: { kind: 'reindeer', colors: ['#a39482', '#8c7c69', '#b8aa97'] },
  // Bichos de passagem: o alce (raro e solitário, na mata ao entardecer) e a raposa-do-ártico no campo nevado.
  fauna: [
    { kind: 'moose', weight: 1, colors: ['#5a4636', '#4a3a2e', '#68503c'], time: 'tarde', where: 'floresta', chance: 0.14 },
    { kind: 'fox', weight: 1, colors: ['#f2f6f9', '#dfe6ec', '#d6c8b4'], time: 'tarde', where: 'prado', chance: 0.18 },
  ],
  // Vento uivando, gelo que estala e, ao longe, o sino da vila.
  ambience: [
    { kind: 'vento', weight: 0.8 },
    { kind: 'gelo', weight: 0.55 },
    { kind: 'sinos', weight: 0.3 },
  ],
  // Aurora boreal à noite (U.aurora, só no céu e no reflexo do mar).
  skyFx: 'aurora',
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
  fieldSnow: 0.12,
  relief: { amp: 0.9, style: 'serra', snow: true, rock: '#56616f' },
  synergy: { lumber: 'Lenhadores e serraria', mill: 'Estabur de peixe', pasture: 'Curral de renas', apiary: 'Colmeias de hidromel' },
  blessingNames: { cartographers: 'Navegadores', builders: 'Construtores de salões', pilgrims: 'Escaldos' },
  folk: { skin: '#e8c4a8', hat: 'hood', hatColor: '#a83a2e' },
  music: { scale: [0, 2, 3, 5, 7, 8, 10], timbre: 'pluck' },
  wonder: { name: 'Grande Stavkirke', core: 'stave', colors: ['#4a3226', '#3d4652', '#c9a24a'] },
  eras: ['Sítio', 'Vilarejo', 'Entreposto', 'Burgo'],
  center: 'hall',
  rules: { startTiles: 55, questChance: 0.28, synergyBonus: { lumber: 3 }, seasonLock: 3 },
  // Easter eggs: só cosméticos (data e hora do aparelho) ou decididos pela partida (peças, grupos, bordas, sorte).
  eggs: [
    {
      id: 'aurora-solsticio',
      name: 'Aurora do solstício',
      note: 'Solstício de inverno: a aurora boreal acorda mesmo de dia.',
      when: [{ kind: 'data' }],
      holidays: [{ month: 12, day: 20, until: { month: 12, day: 22 } }],
      effect: [{ kind: 'ceu', tint: '#7fe6c0', strength: 0.3, seconds: 0, aurora: 0.55 }, { kind: 'som', sound: 'coro' }],
    },
    {
      id: 'treno-do-natal',
      name: 'Trenó de rena',
      note: 'Uma luz vermelha cruza o céu: é o trenó de rena.',
      when: [{ kind: 'data' }],
      holidays: [{ month: 12, day: 24, until: { month: 12, day: 25 } }],
      once: true,
      effect: [{ kind: 'evento', event: 'treno' }, { kind: 'som', sound: 'sinos' }],
    },
    {
      id: 'hugin-e-munin',
      name: 'Hugin e Munin',
      note: 'Hugin e Munin, os corvos de Odin, sobrevoam o lago congelado.',
      when: [{ kind: 'grupo', terrain: T.Field, min: 5 }],
      effect: [{ kind: 'evento', event: 'corvos' }, { kind: 'som', sound: 'brilho' }],
    },
    {
      id: 'troll-da-ponte',
      name: 'Troll da ponte',
      note: 'Um troll de pedra espreita ao lado da ponte.',
      when: [{ kind: 'bordas', terrain: T.Water, min: 2, max: 2 }, { kind: 'bordas', terrain: T.Village, min: 1 }, { kind: 'sorte', chance: 0.2 }],
      once: true,
      effect: [{ kind: 'kit', kit: 'troll', scale: 1.3, color: '#8c96a3' }],
    },
  ],
  ruleNote: 'Começa com 45 peças e missões um pouco mais raras. Lareira: os lenhadores (aldeia + taiga) valem 3 pontos a mais. A paisagem fica no inverno, e o pasto rende +3.',
};
