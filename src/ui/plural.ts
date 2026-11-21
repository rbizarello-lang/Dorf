/** "1 missão", "2 missões": singular só para 1 (o zero e os demais vão no plural, como em "0 missões"). */
export function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString('pt-BR')} ${pluralWord(n, um, varios)}`;
}

/** Só o rótulo, para quando o número já está em outro elemento. */
export function pluralWord(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios;
}
