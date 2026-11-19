import { Color } from 'three/webgpu';
import { ridgePlan, ridgeSection } from '../core/ridge';
import type { Theme } from '../themes/types';
import type { TileBuild } from './tileBuilder';

type Point = [number,number,number];

// O mesmo perfil atravessa as três peças. Cada quebra de cota forma um arrimo
// com passeio horizontal; o último par de faixas desenha o paredão exposto.
const PROFILE = [
  [-1.34,0],[-1.03,.21],[-.88,.43],[-.64,.44],[-.59,.70],[-.34,.72],
  [-.31,1],[.22,1],[.23,.65],[.74,.64],[.78,.43],[.96,.42],[1.02,.25],[1.33,0],
] as const;
const ROCK = ['#928673','#b9aa94','#95a071','#d0c4aa','#87955e','#dfceb0','#d7c8a8','#d1bfa0','#b9b38c','#c8b99c','#8b9b6e','#d9cbb4','#a69c83'];

export function buildRidge(tile: TileBuild, theme: Theme, lot: number, stage: number) {
  const positions:number[] = [], colors:number[] = [];
  const quad = (a:Point,b:Point,c:Point,d:Point,tint:Color) => {
    for (const v of [a,b,c,a,c,d]) { positions.push(...v); colors.push(tint.r,tint.g,tint.b); }
  };
  const section = (step:number, band:number):Point => {
    const u=step/16, s=ridgeSection(lot,u);
    const [offset,level]=PROFILE[band];
    const seam=Math.sin(Math.PI*u);
    const relief=Math.abs(offset)>.75 ? seam*.065*Math.sin(step*1.65+band*1.4) : 0;
    const lateral=s.width*offset+relief;
    return [s.x+s.nx*lateral,.008+s.height*level+relief*.45,s.z+s.nz*lateral];
  };
  for(let step=0;step<16;step++) for(let band=0;band<PROFILE.length-1;band++) {
    const tint=new Color(ROCK[band]).multiplyScalar(.94+.09*Math.sin(step*.92+band*3+lot*16));
    quad(section(step,band),section(step,band+1),section(step+1,band+1),section(step+1,band),tint);
  }
  tile.decos=[]; tile.chimneys=[];
  const deco=(key:string,x:number,y:number,z:number,ry:number,scale:number,color:string,vertical=1) =>
    tile.decos.push({key,x,y,z,ry,sx:scale,sy:scale*vertical,sz:scale,color:new Color(color)});
  for (const h of ridgePlan(lot,stage)) {
    const i=h.variant%theme.houses.length, kit=theme.houses[i];
    deco('wall:'+i,h.x,h.y,h.z,h.yaw,h.scale,kit.walls[h.variant%kit.walls.length],h.vertical);
    deco('roof:'+i,h.x,h.y,h.z,h.yaw,h.scale,kit.roofs[h.variant%kit.roofs.length],h.vertical);
  }
  for(let i=0;i<11;i++) {
    const s=ridgeSection(lot,(i+.45)/11), flank=i%3 ? -.76 : .875;
    const tree=theme.forest.find(f=>f.geo===(i%3?'cypress':'olive')) ?? theme.forest[0];
    if (tree) deco('tree:'+tree.geo,s.x+s.nx*s.width*flank,.008+s.height*(flank<0?.44:.42),s.z+s.nz*s.width*flank,i*.73,.65+(i%3)*.1,tree.colors[i%tree.colors.length],1.22);
  }
  // Oliveras agrupadas no sopé deixam à mostra trechos de rocha entre as copas.
  for(let i=0;i<22;i++) {
    const u=(i+.5)/22, s=ridgeSection(lot,u);
    const cluster=Math.sin((lot+u)*12.5);
    if(cluster<-.48) continue;
    const side=i%5 ? 1 : -1, offset=side*(1.07+.19*Math.sin(i*1.8));
    const tree=theme.forest.find(f=>f.geo===(i%4?'olive':'cypress')) ?? theme.forest[0];
    if(tree) deco('tree:'+tree.geo,s.x+s.nx*s.width*offset,.015+s.height*(Math.abs(offset)<1.05?.34:.13),
      s.z+s.nz*s.width*offset,i*2.1,1.15+.25*cluster,tree.colors[i%tree.colors.length],1.12);
  }
  // Contrafortes estreitos articulam as faces e dão escala aos muros de sustentação.
  for(let i=0;i<8;i++) {
    const u=(i+.35)/8, s=ridgeSection(lot,u);
    const point=(v:number,off:number,h:number):Point=>{
      const t=ridgeSection(lot,v);return [t.x+t.nx*t.width*off,.006+t.height*h,t.z+t.nz*t.width*off];
    };
    const left=u-.01, right=u+.01;
    for(const [back,front,low,high] of [[.22,.27,.65,.99],[.74,.80,.43,.635]]) {
      const a=point(left,front,low), b=point(right,front,low), c=point(right,back+.018,high), d=point(left,back+.018,high);
      const tint=new Color('#c9b89a').multiplyScalar(.91+s.height*.10);
      quad(a,d,c,b,tint); quad(b,c,point(right,back-.012,high),point(right,back,low),tint);
      quad(point(left,back,low),point(left,back-.012,high),d,a,tint);
    }
  }
  if (lot===1) {
    const s=ridgeSection(lot,.50), base=s.height+.006;
    const prism=(x:number,z:number,y:number,w:number,d:number,h:number,top:number,color:string) => {
      const bottom:Point[]=[[-w,y,-d],[w,y,-d],[w,y,d],[-w,y,d]];
      const cap:Point[]=bottom.map(([a,,b])=>[a*top,y+h,b*top]);
      for(const ring of [bottom,cap]) for(const p of ring){p[0]+=s.x+x;p[2]+=s.z+z;}
      for(let k=0;k<4;k++) quad(bottom[(k+1)%4],bottom[k],cap[k],cap[(k+1)%4],new Color(color).multiplyScalar(1-.045*k));
      quad(cap[3],cap[2],cap[1],cap[0],new Color(color));
    };
    prism(0,0,base,.105,.105,.49,1,'#e8cf9d');
    prism(0,0,base+.48,.119,.119,.035,1,'#bb9e71');
    for(const x of [-.081,.081]) for(const z of [-.081,.081]) prism(x,z,base+.515,.022,.022,.18,1,'#f0dcac');
    prism(0,0,base+.695,.123,.123,.035,1,'#e2c496');
    prism(0,0,base+.73,.144,.144,.175,.07,'#b26441');
  }
  function append(original:Float32Array, values:number[]) {
    const combined=new Float32Array(original.length+values.length);
    combined.set(original); combined.set(values,original.length); return combined;
  }
  tile.pos=append(tile.pos,positions); tile.col=append(tile.col,colors);
  tile.splat=append(tile.splat,new Array(positions.length/3*4).fill(0));
}
