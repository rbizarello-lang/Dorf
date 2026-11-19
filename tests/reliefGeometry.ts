import assert from 'node:assert/strict';
import { Board, DEFAULT_RULES } from '../src/core/board';
import { corner, DIRS } from '../src/core/hex';
import { boardHill, handHill, type HillProfile } from '../src/core/hills';
import { T, type TileDef } from '../src/core/tiles';
import { buildTile, railCurve, WATER_Y, type TileBuild } from '../src/render/tileBuilder';
import { themeById } from '../src/themes/themes';

const theme = themeById('riviera');
const houses = theme.houses.map(() => ({h:.11,top:.2,chimney:null}));
const piece = (edges: T[],seed: number): TileDef => ({edges,seed,quest:null});
const build = (def: TileDef,hill?: HillProfile) => buildTile(def.edges,def.seed,theme,{ detail:.4,houses,hill });
const near = (a: number,b: number,tolerance = .000005) => assert.ok(Math.abs(a-b)<tolerance,`${a} diferente de ${b}`);
const board = new Board({...DEFAULT_RULES,riverTrade:true,layout:'crista'});
const town = piece(Array<T>(6).fill(T.Village),12765);
const hand = build(town,handHill(town));

// Conferência pela posição dos três vértices do topo, em cada centroide da malha enviada ao renderizador.
const N = hand.hill!.divisions;
for (let i=0; i<6; i++) {
  const sector = i * (N*N + 6*N) * 9;
  for (let t=0; t<N*N; t++) {
    const p = sector+t*9, pos=hand.pos;
    const x=(pos[p]+pos[p+3]+pos[p+6])/3, z=(pos[p+2]+pos[p+5]+pos[p+8])/3;
    near(hand.hill!.at(x,z),(pos[p+1]+pos[p+4]+pos[p+7])/3);
  }
}
const walls=hand.decos.filter(d=>d.key.startsWith('wall:'));
assert.ok(walls.length>0 && walls.some(w=>w.y>.12));
for (const wall of walls) {
  const roof = hand.decos.find(d=>d.key.startsWith('roof:') && d.x===wall.x && d.z===wall.z);
  assert.equal(roof?.y,wall.y);
  assert.ok(wall.y+.000001>=hand.hill!.at(wall.x,wall.z));
}
assert.ok(hand.pos.every(Number.isFinite));

for (const seed of [7,23,89,237,1087172121]) {
  const land=piece([T.Forest,T.Village,T.Village,T.Grass,T.Village,T.Field],seed);
  const garden=new Board({...DEFAULT_RULES,riverTrade:true,layout:'crista'});
  garden.placeRaw(5,4,land,0);
  const begin=build(land,boardHill(garden,5,4,land,0));
  garden.placeRaw(5,5,town,0);
  const later=build(land,boardHill(garden,5,4,land,0));
  const footprint=(tile: TileBuild)=>tile.decos.filter(d=>d.key.startsWith('wall:')).map(d=>[d.key,d.x,d.z,d.ry]);
  assert.deepEqual(footprint(begin),footprint(later),'A encosta cresceu sem mudar o terreno das casas');
  for (const tile of [begin,later]) {
    for (const wall of tile.decos.filter(d=>d.key.startsWith('wall:'))) {
      const roof=tile.decos.find(d=>d.key.startsWith('roof:') && d.x===wall.x && d.z===wall.z)!;
      near(wall.y,roof.y);
      assert.ok(wall.y-tile.hill!.at(wall.x,wall.z)<=.045001,'Aterro no centro da moradia excedeu o desnível de meio piso');
    }
  }
}

// Lê o topo da face vertical real. O rio usa o dobro da resolução do vizinho seco.
function boundaryMesh(tile: TileBuild,side: number,steps: number) {
  const [ax,az]=corner(side),[bx,bz]=corner((side+1)%6);
  const values = Array<number>(steps+1).fill(-Infinity);
  for (let i=0; i<tile.pos.length; i+=3) {
    const x=tile.pos[i],z=tile.pos[i+2],dx=bx-ax,dz=bz-az;
    if (Math.abs((x-ax)*dz-(z-az)*dx)>1e-6) continue;
    const t=(x-ax)*dx+(z-az)*dz, at=Math.round(t*steps);
    if (at>=0 && at<=steps && Math.abs(at/steps-t)<1e-6) values[at]=Math.max(values[at],tile.pos[i+1]);
  }
  assert.ok(values.every(Number.isFinite));
  return values;
}
for (let worldSide=0; worldSide<6; worldSide++) {
  const [dq,dr]=DIRS[worldSide], q=14+worldSide*4, r=10, rotA=(worldSide+2)%6,rotB=(worldSide+4)%6;
  const sideA=(worldSide-rotA+6)%6, sideB=(worldSide+3-rotB+6)%6;
  const river=piece(Array<T>(6).fill(T.Village),17554013);
  river.edges[(sideA+2)%6]=river.edges[(sideA+4)%6]=T.Water;
  board.placeRaw(q,r,river,rotA);
  const before=build(river,boardHill(board,q,r,river,rotA));
  board.placeRaw(q+dq,r+dr,town,rotB);
  const a=build(river,boardHill(board,q,r,river,rotA)), b=build(town,boardHill(board,q+dq,r+dr,town,rotB));
  const dotted=boundaryMesh(a,sideA,12),solid=boundaryMesh(b,sideB,6).reverse();
  assert.ok(dotted[6]>.15 && before.hill!.at(...corner(sideA))<.001);
  for (let k=0; k<=12; k++) near(dotted[k],(solid[Math.floor(k/2)]+solid[Math.ceil(k/2)])*.5);
  assert.deepEqual(a.water,build(river).water);
  assert.deepEqual(a.wflow,build(river).wflow);
  for (let i=1; i<a.water.length; i+=3) near(a.water[i],WATER_Y);
}
// A estrada dá passagem aos veículos mesmo numa peça com casas nos quatro lados.
const rail=piece([T.Rail,T.Village,T.Village,T.Rail,T.Village,T.Village],813414);
const route=build(rail,handHill(rail));
for (const [x,z] of railCurve(rail.edges,rail.seed,0,3)) assert.ok(route.hill!.at(x,z)<.055);
assert.ok(route.hill!.peak>.16);
assert.equal(build(rail).hill,undefined);
console.log('Encostas: cota real dos triângulos, emendas rio/terra sob giro, moradias, circulação e nível de água conferidos.');
