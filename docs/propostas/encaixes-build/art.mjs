import { launch } from '/home/user/Dorf/scripts/browser.mjs';
import fs from 'node:fs';
const D='/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/encaixe/';
const b=await launch([]);
for (const w of [400,1000]){
 const pg=await b.newPage({viewport:{width:w,height:900}});
 await pg.setContent('<!doctype html><html lang="pt-BR">'+fs.readFileSync(D+'propostas.html','utf8')+'</html>'); await pg.waitForTimeout(400);
 const el=await pg.$('#aguas-descem'); await el.screenshot({path:D+`shots/art-${w}.png`});
}
await b.close();
