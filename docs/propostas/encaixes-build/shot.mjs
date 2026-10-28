import { launch } from '/home/user/Dorf/scripts/browser.mjs';
import fs from 'node:fs';
const D='/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/encaixe/';
const b=await launch([]); const pg=await b.newPage({viewport:{width:+(process.argv[2]||400),height:900}});
const dark=process.argv[3]==='dark'; if(dark) await pg.emulateMedia({colorScheme:'dark'});
await pg.setContent('<!doctype html><html lang="pt-BR">'+fs.readFileSync(D+'propostas.html','utf8')+'</html>');
await pg.waitForTimeout(500);
const sw=await pg.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]); console.log('scrollW',sw);
fs.mkdirSync(D+'shots',{recursive:true});
const els=await pg.$$('.idea figure:first-child');
// montar contact sheet: screenshot each svg
let i=0; for(const e of els){ await e.screenshot({path:D+`shots/f${String(++i).padStart(2,'0')}${dark?'d':''}.png`}); }
await pg.screenshot({path:D+'shots/top.png',fullPage:false});
await b.close();
