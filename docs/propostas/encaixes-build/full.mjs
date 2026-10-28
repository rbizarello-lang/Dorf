import { launch } from '/home/user/Dorf/scripts/browser.mjs';
import fs from 'node:fs';
const D='/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/encaixe/';
const b=await launch([]);
for (const [w,dark] of [[400,false],[400,true],[1100,false]]){
 const pg=await b.newPage({viewport:{width:w,height:900}}); if(dark) await pg.emulateMedia({colorScheme:'dark'});
 await pg.setContent('<!doctype html><html lang="pt-BR">'+fs.readFileSync(D+'propostas.html','utf8')+'</html>'); await pg.waitForTimeout(400);
 console.log(w,dark,await pg.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]));
 await pg.screenshot({path:D+`shots/full-${w}${dark?'d':''}.png`,fullPage:true,clip:{x:0,y:0,width:w,height:w<500?3000:2400}});
}
await b.close();
