import { corner, INR } from '../core/hex';
import type { HillProfile } from '../core/hills';
import { terraceFaces, terraceHeight, type TerraceFace } from './villageTerraces';

const corners = Array.from({ length: 6 }, (_, i) => corner(i));

/**
 * Guarda a cota nos nós da malha do chão (Encostas, modelo do GPT Astra em jogo-entrepostos 75f92e0). Quem pisa no chão (casas,
 * árvores, barcos, aldeões) lê o mesmo triângulo que a GPU desenha, em vez de reavaliar a função de altura.
 * Os nós seguem a grade dos 6 setores: (lado, a, b) com a + b ≤ divisões, o mesmo `V(a, b)` do `buildTile`.
 */
export class HillSurface {
  private stride: number;
  private values: Float32Array;
  private terraces?: Map<number, TerraceFace[]>;
  peak: number;

  constructor(readonly profile: HillProfile, readonly divisions: number, height: (x: number, z: number, side: number, boundary: boolean) => number) {
    this.stride = divisions + 1;
    this.values = new Float32Array(6 * this.stride * this.stride);
    let peak = 0;
    for (let side = 0; side < 6; side++) {
      const [ax, az] = corners[side], [bx, bz] = corners[(side + 1) % 6];
      const sample = (a: number, b: number) => height((a * ax + b * bx) / divisions, (a * az + b * bz) / divisions, side, a + b === divisions);
      for (let a = 0; a <= divisions; a++) {
        for (let b = 0; b <= divisions - a; b++) {
          // O rio tem 12 subdivisões, a terra tem 6. A boca do leito continua na malha fina: os nós ímpares da borda interpolam os pares.
          const y = divisions === 12 && a + b === divisions && a % 2 ? (sample(a - 1, b + 1) + sample(a + 1, b - 1)) / 2 : sample(a, b);
          this.values[(side * this.stride + a) * this.stride + b] = y;
          peak = Math.max(peak, y);
        }
      }
    }
    this.peak = Math.fround(peak);
  }

  node(side: number, a: number, b: number) {
    return this.values[(side * this.stride + a) * this.stride + b];
  }

  /** Subdivide só o triângulo que ganhou patamar. A grade original ainda governa as emendas. */
  terrace(side: number, a: number, b: number, upper: boolean, strength: readonly [number, number, number]) {
    const n = this.node(side, a + 1, b), m = this.node(side, a, b + 1);
    const heights = upper ? [n, this.node(side, a + 1, b + 1), m] as const : [this.node(side, a, b), n, m] as const;
    const faces = terraceFaces(heights, strength);
    for (const { points } of faces) for (const p of points) this.peak = Math.max(this.peak, p.y);
    const index = (side * this.stride + a) * this.stride + b;
    (this.terraces ??= new Map()).set(index * 2 + Number(upper), faces);
    return faces;
  }

  /** Altura no ponto local (x, z) (origem da peça), pela interpolação dos triângulos da malha. */
  at(x: number, z: number, base = false) {
    // Setor de 60° por produtos vetoriais (o `atan2` pesava: o desenho dos decalques chama `at` sete vezes por triângulo). Perto da
    // divisa entre dois setores o sinal é incerto e vale o `atan2`, então o resultado é sempre o de antes.
    let side = -1;
    for (let k = 0; k < 6; k++) {
      const c0 = corners[k], c1 = corners[(k + 1) % 6];
      const s0 = c0[0] * z - c0[1] * x, s1 = c1[0] * z - c1[1] * x;
      if (s0 >= 0 && s1 < 0) {
        if (s0 > 1e-9 && -s1 > 1e-9) side = k;
        break;
      }
    }
    if (side < 0) side = (Math.floor((Math.atan2(z, x) * 3) / Math.PI) + 6) % 6;
    const [ax, az] = corners[side], [bx, bz] = corners[(side + 1) % 6];
    let u = Math.max(0, ((x * bz - z * bx) * this.divisions) / INR), v = Math.max(0, ((z * ax - x * az) * this.divisions) / INR);
    const sum = u + v;
    if (sum > this.divisions) {
      u *= this.divisions / sum;
      v *= this.divisions / sum;
    }
    const a = Math.min(this.divisions, Math.floor(u)), b = Math.min(this.divisions, Math.floor(v)), i = (side * this.stride + a) * this.stride + b;
    if (a + b >= this.divisions) return this.values[i];
    const du = u - a, dv = v - b, h1 = this.values[i + this.stride], h2 = this.values[i + 1];
    const upper = du + dv > 1 && a + b + 1 < this.divisions;
    const faces = base ? undefined : this.terraces?.get(i * 2 + Number(upper));
    if (faces) {
      const h = terraceHeight(faces, upper ? du + dv - 1 : du, upper ? 1 - du : dv);
      if (h !== undefined) return h;
    }
    if (!upper) return this.values[i] * (1 - du - dv) + h1 * du + h2 * dv;
    return (1 - dv) * h1 + (1 - du) * h2 + (du + dv - 1) * this.values[i + this.stride + 1];
  }

  snapshot(seed: number) {
    const samples: number[] = [];
    for (let side = 0; side < 6; side++) {
      const [ax, az] = corners[side], [bx, bz] = corners[(side + 1) % 6];
      for (let a = 0; a <= this.divisions; a++) for (let b = 0; b <= this.divisions - a; b++) samples.push(this.at((a * ax + b * bx) / this.divisions, (a * az + b * bz) / this.divisions));
    }
    return { seed, stage: this.profile.stage, landform: this.profile.landform, peak: this.peak, samples };
  }
}
