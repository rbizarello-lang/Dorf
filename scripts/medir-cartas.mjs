// Executar isoladamente; janelas de 45 quadros após aquecer cada cena. Os tempos são de apresentação via rAF e submissão em JS.
import fs from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';
import { sail } from '../.cache/voyage.mjs';
let browser;
const results = [];
const study = process.argv[2] || 'regioes';
const file = pathToFileURL(resolve(study === 'edicoes' ? '.cache/benchmark-03.html' : 'dist/index.html')).href;
const prior = process.argv[3] ? pathToFileURL(resolve(process.argv[3])).href : file;
if (study === 'edicoes' && fs.existsSync('.cache/edicoes.json')) results.push(...JSON.parse(fs.readFileSync('.cache/edicoes.json', 'utf8')));
async function scene(url, args) {
  if (browser) await browser.close();
  browser=await launch();
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror', e => console.error(e.message));
  page.on('console', m => {
    if (m.type() === 'error') console.error(m.text().slice(0, 250));
    if (m.text().startsWith('LOAD ')) console.log(m.text());
  });
  await page.addInitScript(() => {
    window.longEntries = [];
    new PerformanceObserver(list => window.longEntries.push(...list.getEntries().map(e => ({t:e.startTime, ms:e.duration})))).observe({type:'longtask',buffered:true});
    let load;
    Object.defineProperty(window, '__load', { configurable: true, get: () => load, set: value => { load = value; console.log('LOAD ' + JSON.stringify(value)); } });
  });
  if(args.includes('viagemcurta')) {
    const {game,moves}=sail(42), partial=new game.constructor(42,game.rules);
    for(const [q,r,rot] of moves.slice(0,8)) { partial.rot=rot;partial.place(q,r);while(partial.discardIfStuck()); }
    await page.addInitScript(s=>localStorage.setItem('entrepostos.save',JSON.stringify(s)),{v:11,seed:42,rulesId:'holanda',mode:'entrepostos',undone:0,score:partial.board.score,specials:[],combinedFreight:false,moves:moves.slice(0,8)});
  }
  await page.goto(url + '?' + args, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.__stats, null, {timeout:90000});
  return page;
}
async function windowOf(page, action) {
  return page.evaluate(async action => {
    const frame = () => new Promise(r => requestAnimationFrame(r));
    for (let i=0;i<45;i++) await frame();
    const times=[], counters=[], start=performance.now();
    let last=await frame(), sync=0;
    for (let i=0;i<60;i++) {
      if(i===8 && action!=='repouso') {
        const t=performance.now();
        if (action==='giro') window.dispatchEvent(new KeyboardEvent('keydown',{key:'r'}));
        if (action==='colocar') window.__placeBest();
        if (action==='qualidade') {
          document.querySelector('#btn-quality').click();
          const medium=[...document.querySelectorAll('#menu button')].find(e=>e.textContent.includes('Média'));
          if(!medium) throw Error('Menu sem qualidade Média');
          medium.click();
        }
        sync=performance.now()-t;
      }
      const f=await frame();times.push(f-last); last=f;
      if(window.__frameCosts) counters.push(window.__frameCosts());
    }
    const s=window.__stats, avg = fn => counters.length ? +(counters.reduce((a,v)=>a+fn(v),0)/counters.length).toFixed(3) : null;
    times.sort((a,b)=>a-b);
    return {backend:s.backend,gpu:s.gpu,tiles:s.tiles,p50:+times[29].toFixed(2),p95:+times[56].toFixed(2),max:+times.at(-1).toFixed(2),
      long:window.longEntries.filter(x=>x.t>=start).map(x=>x.ms), sync:+sync.toFixed(2), calls:avg(x=>x.calls)??s.calls, tris:avg(x=>x.triangles)??s.triangles,
      previewCalls:avg(x=>x.preview.calls),previewTris:avg(x=>x.preview.triangles),previewMs:avg(x=>x.preview.cpu),
      inputMs:avg(x=>x.inputMs),worldMs:avg(x=>x.worldMs),sceneMs:avg(x=>x.sceneMs),postMs:avg(x=>x.postMs)};
  },action);
}
async function record(page, tag, action) {
  const row={...tag, action,...await windowOf(page,action)};
  results.push(row);
  fs.writeFileSync('.cache/'+study+'.json', JSON.stringify(results,null,2));
  console.log(JSON.stringify({ ...tag,action,p95:row.p95,sync:row.sync,tri:Math.round(row.tris) }));
}
try {
  if(study==='regioes') {
    if (process.env.RETOMAR && fs.existsSync('.cache/regioes.json')) results.push(...JSON.parse(fs.readFileSync('.cache/regioes.json','utf8')));
    for(const backend of ['webgpu','webgl2']) for(const zoom of [8,28]) {
      // Alterna a ordem das configurações entre as duas câmeras.
      for(const region of zoom===8?[0,4,8]:[8,4,0]) {
        if(results.filter(r=>r.backend===backend && r.zoom===zoom && r.region===region).length===5) continue;
        console.log(backend,zoom,region);
        const p=await scene(file,`debug&mode=classico&theme=vale&stress=300&quality=high&seed=42&zoom=${zoom}&regiao=${region}${backend==='webgl2'?'&webgl':''}`);
        for(let round=1;round<=5;round++) await record(p,{region,zoom,round},'repouso');
        await p.close();
      }
    }
  } else {
    const actions = ['repouso','giro','qualidade','colocar'];
    const recorded = (tag, action) => results.some(r => r.action === action && Object.keys(tag).every(k => (k === 'cold' ? !!r[k] : r[k]) === tag[k]));
    for(const n of [8,300]) for(let round=1;round<=5;round++) for(const name of round%2?['0.2','0.3']:['0.3','0.2']) {
      const tag = {n,round,name};
      if (actions.every(action => recorded(action === 'qualidade' ? {...tag,cold:false} : tag, action)) &&
          (round !== 1 || recorded({...tag,cold:true}, 'qualidade'))) continue;
      const p=await scene(name==='0.2'?prior:file,n===8?'debug&viagemcurta&theme=holanda&seed=42&quality=high&zoom=8':`debug&mode=classico&stress=${n}&theme=vale&seed=42&quality=high&zoom=8`);
      for(const action of actions) {
        if(action==='qualidade') {
          if(round===1 && !recorded({...tag,cold:true}, action)) await record(p,{...tag,cold:true},action);
          else if(round===1) await windowOf(p,action);
          else await p.evaluate(()=>{ document.querySelector('#btn-quality').click();document.querySelector('#menu [data-id=medium]').click(); });
          await p.waitForTimeout(700);
          await p.evaluate(()=>{document.querySelector('#btn-quality').click();document.querySelector('#menu [data-id=high]').click();});
        }
        if(action==='colocar') {
          await p.evaluate(()=>{document.querySelector('#btn-quality').click();document.querySelector('#menu [data-id=high]').click();});
        }
        const phase = action === 'qualidade' ? {...tag,cold:false} : tag;
        if (!recorded(phase, action)) await record(p,phase,action);
        else if (action === 'repouso' || action === 'giro') await windowOf(p,action);
      }
      await p.close();
    }
  }
} finally { await browser?.close(); }

