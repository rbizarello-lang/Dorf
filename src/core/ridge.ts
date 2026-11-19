import { DIRS, INR } from './hex';
import { T } from './tiles';
import type { Board } from './board';
import { developmentAt } from './development';

export const RIDGE_LOTS = [
  { q: -1, r: 2, entry: 2, exit: 5, name: 'Baluarte' },
  { q: 0, r: 1, entry: 2, exit: 0, name: 'Campanário' },
  { q: 1, r: 1, entry: 3, exit: 0, name: 'Belvedere' },
] as const;

export function ridgeStage(levels: readonly number[], edges: readonly T[]) {
  return Math.max(0, ...levels.map((n,i) => edges[i] === T.Village ? n : 0));
}

export function ridgeEdges(q: number, r: number) {
  return DIRS.map(([dq,dr]) => q+dq === 0 && r+dr === 0 ? T.Field : T.Village);
}

// As seções nas divisas têm a mesma normal, largura e cota nas duas peças.
export function ridgeSection(lot: number, u: number) {
  const { entry, exit } = RIDGE_LOTS[lot];
  const a = Math.PI/6 + entry*Math.PI/3, b = Math.PI/6 + exit*Math.PI/3;
  const ax = Math.cos(a)*INR, az = Math.sin(a)*INR, bx = Math.cos(b)*INR, bz = Math.sin(b)*INR;
  const dx = -(1-u)*ax + u*bx, dz = -(1-u)*az + u*bz, len = Math.hypot(dx,dz);
  const s = lot+u;
  const fade = Math.min(1,s*2.9,(3-s)*2.9);
  return { x: ax*(1-u)**2+bx*u*u, z: az*(1-u)**2+bz*u*u, nx: -dz/len, nz: dx/len,
    height: (.54+.43*Math.sin(Math.PI*s/3))*fade, width: .36+.16*Math.sin(Math.PI*u)**2 };
}

export function ridgePlan(lot: number, stage: number) {
  // Dois renques desalinhados acompanham as curvas de nível. Cada apoio
  // acrescenta uma casa no patamar baixo sem deslocar as que já existem.
  const buildings = [];
  const upper = [.11,.20,.36,.47,.57,.74,.83,.93];
  const lower = [.14,.24,.53,.62,.82,.42,.92];
  for (let row=0; row<2; row++) {
    const positions = row ? lower.slice(0,4+stage) : upper;
    for (const [i,u] of positions.entries()) {
      if (lot===1 && !row && Math.abs(u-.5)<.10) continue;
      const s = ridgeSection(lot,u);
      const jitter = Math.sin(17*i+lot*3);
      const offset = s.width*(row ? .51+.085*jitter : -.04+.08*jitter);
      buildings.push({ x:s.x+s.nx*offset, z:s.z+s.nz*offset, y:.007+s.height*(row ? .64 : 1),
        yaw:Math.atan2(s.nx,s.nz)+jitter*.19, scale:(row ? 1.24 : 1.38)+.13*jitter,
        vertical:.91+.16*Math.cos(i*3+lot), variant:(lot+i+row)%3 });
    }
  }
  return buildings;
}

export function ridgeSnapshot(board: Board, living = true) {
  if (board.rules.layout !== 'crista') return [];
  return RIDGE_LOTS.map((p,i) => {
    const placed = board.get(p.q,p.r)!;
    const stage = living ? ridgeStage(developmentAt(board,p.q,p.r).levels,placed.edges) : 0;
    return { ...p, stage, buildings:ridgePlan(i,stage) };
  });
}
