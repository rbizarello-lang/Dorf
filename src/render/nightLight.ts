// Luz da noite (luar e céu), sem three.js: o World a usa em `skyFor` e o teste de legibilidade
// confere com ela se prado, mata e plantação ainda se distinguem no escuro.
export const NIGHT_LIGHT = {
  // Luar forte e pouco azul: com o luar fraco e muito azul, todos os verdes viravam um só.
  sun: '#c4cef0',
  sunI: 1.2,
  hemiSky: '#5d6b96',
  hemiGround: '#242a3a',
  hemiI: 1.2,
} as const;
