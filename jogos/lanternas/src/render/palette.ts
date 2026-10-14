// Paleta da ilha. Seis cores com nome carregam a direção de arte; o resto são tons derivados delas.
//   Mar de vitrine  (azul-turquesa)  água rasa e funda
//   Areia de maré   (bege quente)    praia, pedra clara, paredes
//   Prado de oliva  (verde fresco)   prado, bosque, oliveiras
//   Telha de barro  (terracota)      telhados, vasos, frutos
//   Chama de lanterna (âmbar)        tudo que brilha
//   Noite de breu   (azul-marinho)   céu da noite, sombras frias, madeira escura
export const PAL = {
  // Mar de vitrine
  seaShallow: 0xa6ecd8, seaMid: 0x5ccdd2, seaDeep: 0x2f86b2,
  // Areia de maré
  sand: 0xeedaa4, sandDark: 0xcfb57c, cream: 0xf5e8c9, stone: 0xd2c8b4, stoneDark: 0x9c9382,
  // Prado de oliva
  meadow: 0xa4d063, meadowDark: 0x74a84a, wood: 0x5e9c52, leafA: 0x3e8c52, leafB: 0x2f7448, leafC: 0x7db55a,
  olive: 0xa9bf9c, oliveDark: 0x879f7d, soil: 0x8b6a47, soilDark: 0x6a4d34,
  // Telha de barro
  clay: 0xdd6b4d, clayDark: 0xb4513b, teal: 0x3f9aa0, mustard: 0xe8b24c, apple: 0xd9453d,
  // Chama de lanterna
  flame: 0xffb84a, flameHot: 0xffe08a,
  // Noite de breu
  night: 0x141b3a, nightSky: 0x2a3866, moon: 0x8ea8ff,
  // Madeira e rocha
  walnut: 0x4d3326, timber: 0x8a5d3b, timberLight: 0xb48455, rock: 0xaaa6a1, rockDark: 0x7d7b82,
  mist: 0xf0f4f9, mistDark: 0xc9d4e4,
} as const;
