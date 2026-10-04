// Arquitetura que muda com a era (proposta 2 do docs/IDEIAS_AOE.md): transforma dado em dado.
// A vila começa de taipa e palha, chega ao tema como ele é na segunda era, ganha acabamento e
// sobrados na terceira e flâmulas e janelas mais acesas na última. Só a forma e o tom mudam:
// o número de tipos de casa e os pesos ficam, então cada peça continua com as casas nos mesmos
// lugares e com as mesmas cores sorteadas (invariante 3), e a troca não reconstrói o mapa.

import type { HouseKind, RoofStyle, Theme } from './types';

/** Telhados trabalhados que, na primeira era, ainda são de palha. Os outros já são do lugar. */
const EARLY_THATCH = new Set<RoofStyle>(['gable', 'hip', 'stepgable']);
/** Telhados que cabem num sobrado (palha, grama, cone e cúpula não). */
const TALL_ROOFS = new Set<RoofStyle>(['gable', 'hip', 'flat', 'stepgable', 'pagoda']);
/** Parede de taipa: o tom multiplica a cor sorteada da parede. */
const ADOBE = '#e6d6b6';

/** O tipo de casa que vira sobrado na terceira era: o mais raro dos que cabem num sobrado. */
function risingKind(houses: HouseKind[]) {
  let best = -1;
  houses.forEach((k, i) => {
    if (k.weight > 0.35 || k.body === 'tall' || k.body === 'round' || !TALL_ROOFS.has(k.roof)) return;
    if (best < 0 || k.weight < houses[best].weight) best = i;
  });
  return best;
}

/** As casas do tema numa era (0 a 3). */
export function housesAtEra(theme: Theme, era: number): HouseKind[] {
  if (theme.eraHouses === false || era === 1) return theme.houses;
  if (era <= 0) {
    return theme.houses.map((k) => ({
      ...k,
      body: k.body === 'tall' ? 'cottage' : k.body,
      roof: EARLY_THATCH.has(k.roof) ? 'thatch' : k.roof,
      trim: undefined,
      tone: ADOBE,
      scale: 0.85,
    }));
  }
  const rise = risingKind(theme.houses);
  return theme.houses.map((k, i) => {
    const body = i === rise ? 'tall' : k.body;
    const out: HouseKind = { ...k, body, trim: k.trim ?? theme.landmarkColors[2] };
    if (era >= 3) {
      out.bright = 1.5;
      if (body === 'tall') out.pennant = theme.ui.accent;
    }
    return out;
  });
}
