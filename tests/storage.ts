// Ida e volta do backup (src/ui/storage.ts) com armazenamento falso, e recusas sem gravar nada.
import { exportKeys, importKeys, MAX_VALUE, type KeyStore } from '../src/ui/storage';
import { cleanProgress } from '../src/ui/progress';

let fails = 0;
const ok = (c: boolean, msg: string) => {
  if (!c) {
    fails++;
    console.error('FALHOU:', msg);
  }
};

class Fake implements KeyStore {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

const THEMES = ['holanda', 'egito'];
const progress = JSON.stringify({ totals: { games: 3, tiles: 90, quests: 2, synergies: 5, sites: 1, perfects: 4, wonders: 0 }, themes: { holanda: { games: 3, era: 2, wonder: false } }, unlocked: ['station'], monuments: [] });
const save = JSON.stringify({ v: 13, seed: 5, moves: [[0, 1, 2]] });
const check = (k: string, v: string) => (k === 'progress' ? cleanProgress(v, THEMES) : k === 'save' ? (JSON.parse(v).v === 13 ? v : null) : v);

// ida e volta
const a = new Fake();
a.setItem('retalhos.progress', progress);
a.setItem('retalhos.save', save);
a.setItem('retalhos.theme', 'egito');
a.setItem('outro.jogo', 'não pode sair');
const bk = exportKeys('retalhos.', 'retalhos', a, new Date('2026-10-14T10:00:00Z'));
ok(bk.app === 'retalhos' && bk.v === 1 && bk.at.startsWith('2026-10-14'), 'cabeçalho do backup');
ok(Object.keys(bk.data).length === 3 && !('outro.jogo' in bk.data), 'só as chaves com o prefixo');
const text = JSON.stringify(bk);
const b = new Fake();
b.setItem('retalhos.velho', 'x');
const r = importKeys(JSON.parse(text), 'retalhos.', check, b, 'retalhos');
ok(r.ok && r.count === 3, 'importa 3 chaves');
ok(b.getItem('retalhos.save') === save && b.getItem('retalhos.theme') === 'egito', 'valores voltam iguais');
ok(JSON.parse(b.getItem('retalhos.progress')!).totals.games === 3, 'progresso volta');

// recusas: nada é gravado
const recusa = (json: unknown, msg: string) => {
  const s = new Fake();
  s.setItem('retalhos.save', 'intacto');
  const res = importKeys(json, 'retalhos.', check, s, 'retalhos');
  ok(!res.ok, `recusa ${msg}`);
  ok(s.length === 1 && s.getItem('retalhos.save') === 'intacto', `nada gravado: ${msg}`);
};
const good = () => JSON.parse(text);
recusa(null, 'nulo');
recusa([], 'lista');
recusa({ ...good(), app: 'outro' }, 'outro jogo');
recusa({ ...good(), v: 99 }, 'versão');
recusa({ ...good(), data: { ...good().data, 'outro.jogo': 'x' } }, 'chave fora do prefixo');
recusa({ ...good(), data: { ...good().data, 'retalhos.n': 5 } }, 'valor que não é texto');
recusa({ ...good(), data: { ...good().data, 'retalhos.grande': 'x'.repeat(MAX_VALUE + 1) } }, 'valor grande');
recusa({ ...good(), data: { ...good().data, 'retalhos.save': JSON.stringify({ v: 3 }) } }, 'save de outra versão');
recusa({ ...good(), data: { ...good().data, 'retalhos.progress': '[1,2]' } }, 'progresso que não é objeto');
recusa({ ...good(), data: { ...good().data, 'retalhos.progress': 'não é json' } }, 'progresso ilegível');

// o progresso importado sai limpo, campo a campo
const sujo = cleanProgress(JSON.stringify({ totals: { games: -4, tiles: 'x', quests: 7 }, themes: { holanda: { games: 2, era: 9 }, 'Falso!': { games: 1 }, vale: { games: 5 } }, unlocked: ['station', 'bomba'] }), THEMES)!;
const p = JSON.parse(sujo);
ok(p.totals.games === 0 && p.totals.tiles === 0 && p.totals.quests === 7, 'totais inválidos viram zero');
ok(p.themes.holanda.era === 3 && !('Falso!' in p.themes), 'era limitada e id fora do formato de tema some');
ok(p.themes.vale?.games === 5, 'tema removido (vale) fica guardado sem uso');
ok(p.unlocked.length === 1 && p.unlocked[0] === 'station', 'só peças conhecidas');

if (fails) {
  console.error(`storage: ${fails} falhas`);
  process.exit(1);
}
console.log('storage: ida e volta e recusas ok');
