import { holanda } from './holanda';
import { egito } from './egito';
import { oriental } from './oriental';
import { brasil } from './brasil';
import { inverno } from './inverno';
import type { Theme } from './types';

export type * from './types';

// Os 5 temas do jogo, um arquivo por tema (src/themes/<id>.ts). Tudo é dado: nenhum tema tem código
// próprio. O primeiro é o padrão (Holanda Dourada). A consolidação de 14 para 5 está em docs/TEMAS.md.
export const THEMES: Theme[] = [holanda, egito, oriental, brasil, inverno];

export const PERIOD_LABEL: Record<Theme['period'], string> = {
  antiguidade: 'Antiguidade',
  medieval: 'Séculos V a XV',
  moderna: 'Séculos XVI a XVIII',
  contemporanea: 'Séculos XIX a XXI',
  futuro: 'Futuro',
  fantasia: 'Fantasia',
};

export const PERIOD_ORDER: Theme['period'][] = ['antiguidade', 'medieval', 'moderna', 'contemporanea', 'futuro', 'fantasia'];

/**
 * Temas antigos que viraram outro: a fusão (o tema de origem some e o novo herda o recorde) e o id novo.
 * A migração de `?theme=`, do tema escolhido e dos recordes (src/themes/legacy.ts) lê daqui.
 */
export const MERGED_THEMES: Readonly<Record<string, string>> = {
  sakura: 'oriental',
  song: 'oriental',
  edo: 'oriental',
  cerrado: 'brasil',
  colonial: 'brasil',
  viking: 'inverno',
};

/** O tema de um id vindo da URL ou do armazenamento: id atual, id fundido (vai para o novo) ou o padrão (vale, marte, toscana, oeste e andes saíram sem herdeiro). */
export const themeById = (id: string | null | undefined): Theme => {
  const key = typeof id === 'string' && Object.hasOwn(MERGED_THEMES, id) ? MERGED_THEMES[id] : id;
  return THEMES.find((t) => t.id === key) ?? THEMES[0];
};
