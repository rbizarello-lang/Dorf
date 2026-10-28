import { launch } from '/home/user/Dorf/scripts/browser.mjs';
import fs from 'node:fs';
const D='/tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/encaixe/';
const b=await launch([]); const pg=await b.newPage({viewport:{width:500,height:900}});
await pg.setContent('<!doctype html><html>'+fs.readFileSync(D+'propostas.html','utf8')+'</html>');
const out=await pg.evaluate(()=>{const o={};document.querySelectorAll('.idea').forEach(a=>{const s=a.querySelector('svg');const vb=s.viewBox.baseVal;const sr=s.getBoundingClientRect();const k=vb.width/sr.width;const r=s.querySelector('g').getBoundingClientRect();o[a.id]={x:(r.left-sr.left)*k+vb.x,y:(r.top-sr.top)*k+vb.y,w:r.width*k,h:r.height*k};});return o;});
fs.writeFileSync(D+'build/bbox.json',JSON.stringify(out));
await b.close();
