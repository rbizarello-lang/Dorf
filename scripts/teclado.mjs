import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch} from './browser.mjs';
import {sail} from '../.cache/voyage.mjs';
const browser=await launch(), errors=[];
const url=pathToFileURL(resolve('dist/index.html')).href, seed=42;
fs.mkdirSync('.cache/capturas',{recursive:true});
try {
  for(const [layout,theme,time,legacy] of [['confluencia','holanda','day',false],['forquilha','egito','night',false],['enseada','vale','day',false],['confluencia','holanda','night',true]]) {
    const p=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
    p.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
    p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
    const route=sail(seed,true,layout,undefined,false,theme), first=route.moves[0];
    if(legacy) {
      // O save v11 guardava a pontuação, os giros e o contrato. A cópia antiga precisa continuar intacta.
      const direct=sail(seed,false,layout);
      const old=new direct.game.constructor(seed,{...direct.game.rules,combinedFreight:true,legacyFreight:true});
      old.rot=first[2];old.place(first[0],first[1]);
      await p.addInitScript(s => {
        const raw = JSON.stringify(s);
        localStorage.setItem('entrepostos.save', raw);
        localStorage.setItem('entrepostos.encostas.save', raw);
      }, {v:11,seed,rulesId:'holanda',mode:'entrepostos',undone:0,score:old.board.score,specials:[],combinedFreight:true,moves:[first]});
    }
    await p.goto(url+`?debug&seed=42&theme=${theme}&time=${time}&quality=high`,{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>window.__stats);
    const key=k=>p.keyboard.press(k);
    async function tabTo(selector,back=false) {
      for(let i=0;i<80;i++) {
        if(await p.evaluate(s=>document.activeElement?.matches(s),selector)) return;
        await key(back?'Shift+Tab':'Tab');
      }
      throw Error('Sem acesso por Tab: '+selector);
    }
    const save=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('entrepostos.encostas.save')));
    if(!legacy) {
      await tabTo('#choose-freight');await key('Enter');
      const dialog=p.getByRole('dialog',{name:'Preparar a viagem'});
      assert(await dialog.isVisible());
      assert.equal(await dialog.getAttribute('aria-modal'),'true');
      assert(await p.evaluate(()=>[...document.body.children].filter(e=>e.id!=='modal').every(e=>e.inert)),'O fundo deve ficar inerte no diálogo modal');
      await key('Shift+Tab');assert(await p.locator('[data-act=close]').evaluate(e=>document.activeElement===e));
      await key('Tab');assert(await p.locator('#voyage-map').evaluate(e=>document.activeElement===e));
      await key('Escape');assert(await p.locator('#choose-freight').evaluate(e=>document.activeElement===e));
      await key('Enter');await key('Home');
      for(let i=0;i<['crista','confluencia','forquilha','enseada'].indexOf(layout);i++)await key('ArrowDown');
      await key('Tab');await key('Tab');await key('Tab');await key('Enter');
      assert.equal((await save()).layout,layout);
      assert.equal((await save()).combinedFreight,true);
      await tabTo('#ports button');await key('Enter');
      await tabTo('#chart-fit');await key('Enter');await tabTo('#scene');
      if(layout==='confluencia') {await tabTo('#guide-route');await key('Enter');assert.match(await p.locator('#guide-route').innerText(),/Pular/);}
    } else {assert.equal((await save()).legacyFreight,true);await tabTo('#scene');}
    for(let i=legacy?1:0;i<route.moves.length;i++) {
      const [q,r,rot]=route.moves[i];
      let found=false;
      for(let j=0;j<100;j++) {
        await key('ArrowRight');
        if((await p.locator('#sr').textContent()).startsWith(`Casa ${q}, ${r}.`)){found=true;break;}
      }
      assert(found,'Cursor precisa alcançar '+[q,r]);
      for(let j=0;j<rot;j++) await key('r');
      if(i===0) {
        let turns=0;
        while((await p.locator('#sr').textContent()).includes('Pode colocar') && turns<6){await key('r');turns++;}
        assert(turns<6);
        await key('Enter');assert.equal((await save()).moves.length,0);
        const cdp=await p.context().newCDPSession(p);
        const ax=await cdp.send('Accessibility.getFullAXTree');
        assert(ax.nodes.some(n=>n.name?.value?.includes('Encaixe inválido')));
        await cdp.detach();
        for(let j=turns;j<6;j++)await key('r');
      }
      await key('Enter');
      if(i===0 && !legacy && !p.didUndo) {await key('u');assert.equal((await save()).moves.length,0);i=-1; p.didUndo=true; }
      if(i===1 && layout==='confluencia') {
        await p.screenshot({path:'.cache/capturas/espera-'+theme+'-'+time+'.png'});
      }
      if(i>=4 && layout==='confluencia' && !p.sawBarge && await p.locator('#watch-freight').isVisible()) {
        p.sawBarge=true;
        await tabTo('#watch-freight');await key('Enter');
        assert(await p.locator('#fixed-camera').isChecked());
        const transit=await p.evaluate(()=>{
          const before=window.__frameCosts().barges;
          document.querySelector('#btn-quality').click();document.querySelector('#menu [data-id=medium]').click();
          return [before,window.__frameCosts().barges];
        });
        assert(transit[0]>0);assert.equal(transit[0],transit[1]);
        await p.screenshot({path:'.cache/capturas/canal-'+time+'.png'});
        await p.waitForFunction(()=>window.__frameCosts().barges===0);
        await tabTo('#scene');
      }
    }
    await p.getByRole('heading',{name:'Os três cais estão abastecidos!'}).waitFor();
    assert.equal(await p.locator('.voyage-log li').count(),3);
    if(!legacy) assert.equal(Number(await p.locator('.final [data-count]').getAttribute('data-count')),route.game.board.score);
    if(legacy) {
      assert.match(await p.locator('.voyage-log').innerText(),/Feira.*\+10 peças/);
      assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('entrepostos.save')).v),11);
    }
    await p.screenshot({path:'.cache/capturas/final-'+layout+'.png'});
    console.log(layout,theme,time,legacy?'v11':'v12',route.moves.length,'jogadas no teclado');
    await p.close();
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}

