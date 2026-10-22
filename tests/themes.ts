// Os 5 temas e a migração dos 14 antigos (etapa T0): ids, `?theme=` e tema salvo antigos, recordes dos
// temas fundidos (fica o maior, uma vez só) e o progresso dos temas removidos, que fica guardado sem uso.
import { THEMES, themeById } from '../src/themes/themes';
import { migrateBests } from '../src/themes/legacy';
import { MODES } from '../src/core/modes';
import { cleanProgress, Progress } from '../src/ui/progress';

let fails = 0;
const ok = (c: boolean, msg: string) => {
  if (!c) {
    fails++;
    console.error('FALHOU:', msg);
  }
};

class Mem {
  m = new Map<string, string>();
  get(k: string) {
    return this.m.get(k) ?? null;
  }
  set(k: string, v: string | null) {
    if (v === null) this.m.delete(k);
    else this.m.set(k, v);
  }
}
const modeIds = MODES.map((m) => m.id);
const rec = (score: number, seed: number) => JSON.stringify({ score, seed });

// --- os 5 temas
ok(THEMES.map((t) => t.id).join() === 'holanda,egito,oriental,brasil,inverno', 'os 5 temas, a Holanda primeiro (padrão)');
ok(new Set(THEMES.map((t) => t.id)).size === THEMES.length, 'ids únicos');
ok(themeById(null).id === 'holanda' && themeById(undefined).id === 'holanda' && themeById('').id === 'holanda', 'sem id vale o padrão');
for (const t of THEMES) {
  ok(themeById(t.id) === t, `${t.id}: o id atual devolve o próprio tema`);
  ok(t.houses.length >= 3 && t.houses.length <= 6, `${t.id}: 3 a 6 tipos de casa`);
  ok(t.houses.every((h) => h.walls.length > 0 && h.roofs.length > 0 && h.weight > 0), `${t.id}: casas com cores e peso`);
  ok(Math.abs(t.forest.reduce((s, f) => s + f.weight, 0) - 1) < 0.05, `${t.id}: pesos das árvores somam ~1`);
  ok(!!t.eras && t.eras.length === 4 && !!t.wonder && !!t.music && !!t.folk, `${t.id}: eras, maravilha, música e aldeões`);
}

// --- ?theme= e tema salvo antigos
const alvo: Record<string, string> = { sakura: 'oriental', song: 'oriental', edo: 'oriental', cerrado: 'brasil', colonial: 'brasil', viking: 'inverno', vale: 'holanda', marte: 'holanda', toscana: 'holanda', oeste: 'holanda', andes: 'holanda' };
for (const [velho, novo] of Object.entries(alvo)) ok(themeById(velho).id === novo, `?theme=${velho} cai em ${novo}`);
ok(themeById('constructor').id === 'holanda' && themeById('__proto__').id === 'holanda' && themeById('toString').id === 'holanda', 'ids de protótipo não escapam da validação');
ok(themeById('inexistente').id === 'holanda', 'id desconhecido vale o padrão');

// --- recordes: o maior fica no tema novo, a chave antiga some, e repetir não muda nada
{
  const s = new Mem();
  s.set('best.classico.sakura', rec(900, 11));
  s.set('best.classico.song', rec(1500, 22));
  s.set('best.classico.edo', rec(1200, 33));
  s.set('best.classico.colonial', rec(700, 44));
  s.set('best.classico.cerrado', rec(700, 55)); // empate com o colonial: fica o primeiro migrado (o cerrado)
  s.set('best.zen.viking', rec(300, 66));
  s.set('best.zen.inverno', rec(800, 77)); // o tema novo já tinha um recorde maior
  s.set('best.classico.vale', rec(5000, 88)); // removido sem herdeiro: fica guardado, sem uso
  s.set('best.classico.holanda', rec(10, 99));
  const moved = migrateBests(s, modeIds);
  ok(moved === 6, `migrou 6 chaves de temas fundidos (foram ${moved})`);
  ok(s.get('best.classico.oriental') === rec(1500, 22), 'oriental fica com o maior dos três (Song, 1500)');
  ok(s.get('best.classico.brasil') === rec(700, 55), 'brasil: o empate fica com o primeiro migrado (cerrado)');
  ok(s.get('best.zen.inverno') === rec(800, 77), 'inverno: o recorde maior que já estava lá não é pisado');
  ok(['sakura', 'song', 'edo', 'colonial', 'cerrado'].every((t) => s.get(`best.classico.${t}`) === null) && s.get('best.zen.viking') === null, 'as chaves antigas dos fundidos somem');
  ok(s.get('best.classico.vale') === rec(5000, 88) && s.get('best.classico.holanda') === rec(10, 99), 'tema removido fica guardado e não vai para a Holanda');
  const antes = JSON.stringify([...s.m]);
  ok(migrateBests(s, modeIds) === 0 && JSON.stringify([...s.m]) === antes, 'rodar de novo não muda nada');
}
{
  // recorde ilegível ou de formato errado nunca vira recorde, mas a chave antiga também sai
  const s = new Mem();
  s.set('best.classico.song', 'não é json');
  s.set('best.classico.edo', JSON.stringify({ score: 'muito', seed: 1 }));
  s.set('best.classico.sakura', JSON.stringify({ score: 1.5, seed: 1 }));
  s.set('best.classico.oriental', rec(40, 3));
  migrateBests(s, modeIds);
  ok(s.get('best.classico.oriental') === rec(40, 3), 'valor corrompido não vira recorde');
  ok(s.get('best.classico.song') === null && s.get('best.classico.edo') === null && s.get('best.classico.sakura') === null, 'e a chave corrompida é apagada');
  const t = new Mem();
  t.set('best.classico.edo', rec(350, 9));
  migrateBests(t, modeIds);
  ok(t.get('best.classico.oriental') === rec(350, 9), 'sem recorde no tema novo, o antigo é copiado');
}

// --- progresso: o registro dos temas removidos fica guardado, sem uso, e o validador não o joga fora nem quebra
{
  const ids = THEMES.map((t) => t.id);
  const bruto = JSON.parse(
    '{"totals":{"games":9,"tiles":300,"quests":4,"synergies":12,"sites":2,"perfects":3,"wonders":1},' +
      '"themes":{"holanda":{"games":4,"era":2,"wonder":false},"sakura":{"games":3,"era":3,"wonder":true},"marte":{"games":2,"era":9,"wonder":"sim"},' +
      '"Falso!":{"games":1},"__proto__":{"games":1},"toString":{"games":1}},"unlocked":["station"]}',
  );
  const limpo = JSON.parse(cleanProgress(JSON.stringify(bruto), ids)!);
  ok(limpo.totals.games === 9 && limpo.themes.holanda.games === 4, 'os totais e os temas atuais passam');
  ok(limpo.themes.sakura?.games === 3 && limpo.themes.sakura.wonder === true, 'o registro de um tema removido fica guardado');
  ok(limpo.themes.marte?.era === 3 && limpo.themes.marte.wonder === false, 'e é validado campo a campo como os outros');
  ok(!('Falso!' in limpo.themes) && !Object.hasOwn(limpo.themes, '__proto__') && !Object.hasOwn(limpo.themes, 'toString'), 'ids fora do formato de tema não entram');
  const s = new Mem();
  s.set('progress', JSON.stringify(limpo));
  const p = new Progress(s, ids);
  ok(p.data.themes.sakura?.games === 3 && p.data.totals.games === 9, 'o Progress lê o registro dos removidos sem quebrar');
  s.set('progress', '{"themes": "quebrado", "totals": 7}');
  ok(new Progress(s, ids).data.totals.games === 0, 'progresso quebrado começa do zero');
}

if (fails) {
  console.error(`temas: ${fails} falhas`);
  process.exit(1);
}
console.log(`temas: ${THEMES.length} temas, migração de tema, recordes e progresso ok`);
