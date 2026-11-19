import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch} from './browser.mjs';
import {sail} from '../.cache/voyage.mjs';
fs.mkdirSync('.cache/capturas',{recursive:true});
const route=sail(42,true), half=new route.game.constructor(42,route.game.rules);
for(const [q,r,rot] of route.moves.slice(0,8)) {half.rot=rot;half.place(q,r);while(half.discardIfStuck());}
const save={v:12,seed:42,rulesId:'holanda',mode:'entrepostos',moves:route.moves.slice(0,8),undone:0,score:half.board.score,specials:[],combinedFreight:true,legacyFreight:false,layout:'confluencia'};
let browser;
const errors=[];
try {
  for(const backend of ['webgpu','webgl2']) {
    browser=await launch();
    for(const theme of ['riviera','vale','egito']) for(const time of ['day','night']) {
      const p=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
      p.on('pageerror',e=>errors.push(e.message));
      p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await p.addInitScript(s=>localStorage.setItem('entrepostos.encostas.save',JSON.stringify(s)),save);
      await p.goto(pathToFileURL(resolve('dist/index.html')).href+`?seed=42&theme=${theme}&time=${time}&quality=high&debug&vivas=1${backend==='webgl2'?'&webgl':''}`,{waitUntil:'domcontentloaded'});
      await p.waitForFunction(()=>window.__stats?.tiles===9,null,{timeout:120000});
      await p.keyboard.press('f');
      await p.getByRole('button',{name:'Ver mapa'}).click();
      await p.waitForTimeout(800);
      assert.equal(await p.evaluate(()=>window.__stats.backend),backend);
      assert.equal(await p.evaluate(()=>window.__frameCosts().development.tiles),9);
      await p.screenshot({path:`.cache/capturas/vivo-${theme}-${time}-${backend}.png`});
      console.log(theme,time,backend,await p.evaluate(()=>({calls:window.__stats.calls,tris:window.__stats.triangles,living:window.__frameCosts().development})));
      await p.close();
    }
    if (backend === 'webgpu') {
      for (const living of [0, 1]) {
        const p = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
        p.on('pageerror', e => errors.push(e.message));
        p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        await p.goto(pathToFileURL(resolve('dist/index.html')).href
          + `?mode=zen&seed=42&theme=riviera&time=day&quality=high&debug&auto=36&zoom=10&pitch=46&focus=4&vivas=${living}`,
          { waitUntil: 'domcontentloaded' });
        await p.waitForFunction(() => window.__stats?.tiles === 37, null, { timeout: 120000 });
        assert.equal(await p.evaluate(() => window.__frameCosts().development.tiles), living ? 37 : 0);
        const frameTimes = await p.evaluate(async () => {
          const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
          for (let i = 0; i < 20; i++) await frame();
          let last = await frame();
          const times = [];
          for (let i = 0; i < 60; i++) {
            const now = await frame();
            times.push(now - last);
            last = now;
          }
          times.sort((a, b) => a - b);
          return { p50: times[29], p95: times[56], ...window.__frameCosts(), gpu: window.__stats.gpu };
        });
        console.log('Zen, 37 peças, zoom 10, Paisagem viva:', living, JSON.stringify(frameTimes));
        await p.keyboard.press('p');
        await p.waitForFunction(() => document.querySelector('.capture-bar:not([hidden])'));
        await p.keyboard.press('Space');
        await p.waitForTimeout(800);
        await p.locator('.capture-bar:not(.export)').evaluate((bar) => bar.style.setProperty('display', 'none', 'important'));
        await p.screenshot({ path: `.cache/capturas/riviera-paisagem-${living ? 'ativa' : 'desativada'}.png` });
        await p.close();
      }
    }
    await browser.close();browser=null;
  }
  assert.deepEqual(errors,[]);
}finally{await browser?.close();}

