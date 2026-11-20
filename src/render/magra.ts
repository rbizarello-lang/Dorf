// Estudo R7a, "Peça magra" (modo Relevo): chaves de liga e desliga para a impressão de que a peça é "gorda".
// Nada aqui muda o jogo sem o parâmetro `?magra=` (ou `#magra=` no hash, o único que a prévia publicada recebe): o objeto `MAGRA`
// nasce com os valores da base e as predefinições só o sobrescrevem. O id é validado contra a lista fixa `MAGRA_IDS` (invariante 12).
// Só aparência: nada disto toca regra, pontuação, replay nem save.

export interface Magra {
  /** Altura de um nível (a base é 0,3, o `LEVEL_STEP` de tileBuilder) e espessura do fundo comum (`TILE_T`, 0,28). */
  levelStep: number;
  tileT: number;
  /** Peso do pico do meio no kernel da peça e quanto o morro sobe acima do nível lógico (a cúpula por peça). */
  centerW: number;
  morro: number;
  /** Multiplicador do ondulado do mundo (a amplitude base é 0,8 nível). */
  swell: number;
  /** Saia das bordas abertas: largura máxima, inclinação média alvo (altura por largura) e fôlego do talude. */
  skirtMax: number;
  skirtSlope: number;
  skirtTalus: number;
  /** 1 = o beiral de sempre (o pé da saia termina um pouco acima do fundo); 0 = o pé da saia desce até o fundo comum, sem beiral. */
  beiral: number;
  /** Multiplicador da largura da faixa de areia do mar (a cor clara no pé da saia). */
  sand: number;
  /** Quanto o pé da saia puxa para a cor de terra escura (0,7 na base): menos terra, a encosta fica gramada e lê como morro, não como parede. */
  soil: number;
  /** Diagnóstico: sem sombra projetada (separa a sombra no pé das encostas do resto). */
  noShadow: boolean;
  /** O fantasma e a peça caindo mostram a peça já assentada: sem a laje de baixo e perto do chão. */
  ghost: boolean;
  /** Multiplicador da altura da coluna da pilha (0 = só a base da peça). */
  pile: number;
}

export const BASE: Magra = {
  levelStep: 0.3, tileT: 0.28, centerW: 1.5, morro: 0.3, swell: 1,
  skirtMax: 1.0, skirtSlope: 0.7, skirtTalus: 1.4, beiral: 1, sand: 1, soil: 0.7, noShadow: false, ghost: false, pile: 1,
};

/** Predefinições: as letras são as variantes do estudo, `x-*` mexem numa causa só (diagnóstico). */
const PRESETS: Record<string, Partial<Magra>> = {
  // Variantes
  a: { levelStep: 0.2, centerW: 0.3, morro: 0, skirtMax: 0.7, skirtSlope: 0.9, skirtTalus: 1.2 }, // fatia fina: níveis baixos, cúpula quase zero, saia mais curta
  b: { skirtMax: 0.8, skirtSlope: 0.9, skirtTalus: 1.2, beiral: 0.4, sand: 0.5, soil: 0.35 }, // costa rente: a saia desce à areia, quase sem beiral, a faixa clara só cor
  c: { ghost: true, pile: 0.25 }, // fantasma fiel (e pilha baixa)
  d: { centerW: 0, morro: 0, swell: 0.6 }, // sem almofada: o centro segue a média das bordas
  e: { levelStep: 0.2, tileT: 0.2, centerW: 0.2, morro: 0, swell: 0.7, skirtMax: 0.8, skirtSlope: 0.9, skirtTalus: 1.2, beiral: 0.4, sand: 0.5, soil: 0.35, ghost: true, pile: 0.25 }, // combinação
  // Diagnóstico: uma causa por vez
  'x-fantasma': { ghost: true },
  'x-pilha': { pile: 0.25 },
  'x-saia': { skirtMax: 0.5, skirtSlope: 1.3, skirtTalus: 1.0 },
  'x-beiral': { beiral: 0 },
  'x-areia': { sand: 0.45 },
  'x-cupula': { centerW: 0, morro: 0 },
  'x-degrau': { levelStep: 0.15 },
  'x-fundo': { tileT: 0.12 },
  'x-ondulado': { swell: 0.4 },
  'x-terra': { soil: 0.2 },
  'x-sombra': { noShadow: true },
};

export const MAGRA_IDS = ['base', ...Object.keys(PRESETS)] as const;

/** A variante recomendada pelo estudo, ligada por padrão só no build de prévia (e só no modo Relevo, ver `setMagra`). */
const PREVIEW_ID = 'e';

/** Lê `?magra=` e `#magra=` (a prévia publicada só recebe o hash); valor fora da lista = base. */
function pick(): string {
  let id = 'base';
  try {
    // `globalThis.__MAGRA`: só para as medidas em Node (scripts do estudo); no navegador não existe.
    const forced = (globalThis as { __MAGRA?: string }).__MAGRA;
    const fromQ = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('magra');
    const fromH = typeof location === 'undefined' ? null : new URLSearchParams(location.hash.replace(/^#/, '')).get('magra');
    const v = forced ?? fromQ ?? fromH ?? null;
    if (v && (MAGRA_IDS as readonly string[]).includes(v)) id = v;
    // A prévia publicada (`VITE_PREVIEW=relevo`) abre com a variante recomendada; `#magra=base` volta ao desenho anterior.
    else if (v === null && import.meta.env?.VITE_PREVIEW === 'relevo') id = PREVIEW_ID;
  } catch {
    /* sem location (testes em Node) */
  }
  return id;
}

export const MAGRA_ID = pick();
/**
 * Valores vivos: lidos na hora de usar. Nascem como a base (o Clássico e os testes em Node saem idênticos) e só `setMagra(true)`,
 * chamado pelo mundo ao entrar no modo Relevo, aplica a variante escolhida.
 */
export const MAGRA: Magra = { ...BASE };
const subs: ((m: Magra) => void)[] = [];
/** Quem guarda um valor derivado (constante de módulo) se inscreve aqui: roda já e a cada `setMagra`. */
export function onMagra(fn: (m: Magra) => void) {
  subs.push(fn);
  fn(MAGRA);
}
/** Aplica a variante (modo Relevo) ou volta à base (Clássico). Chamar antes de montar qualquer peça. */
export function setMagra(relevo: boolean) {
  Object.assign(MAGRA, BASE, relevo ? PRESETS[MAGRA_ID] ?? {} : {});
  for (const fn of subs) fn(MAGRA);
}
