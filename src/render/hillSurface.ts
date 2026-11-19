import { corner, INR } from '../core/hex';
import type { HillProfile } from '../core/hills';

const corners = Array.from({ length: 6 }, (_, i) => corner(i));

/** Guarda a cota nos nós da malha. Quem pisa no chão lê o mesmo triângulo que a GPU desenha. */
export class HillSurface {
  private stride: number;
  private values: Float32Array;
  readonly peak: number;

  constructor(readonly profile: HillProfile, readonly divisions: number, height: (x: number, z: number, side: number, boundary: boolean) => number) {
    this.stride = divisions + 1;
    this.values = new Float32Array(6 * this.stride * this.stride);
    let peak = 0;
    for (let side = 0; side < 6; side++) {
      const [ax, az] = corners[side], [bx, bz] = corners[(side + 1) % 6];
      const sample = (a: number, b: number) => height((a * ax + b * bx) / divisions, (a * az + b * bz) / divisions, side, a + b === divisions);
      for (let a = 0; a <= divisions; a++) for (let b = 0; b <= divisions - a; b++) {
        // O rio tem 12 subdivisões, a terra tem 6. A boca do leito continua na malha fina.
        const y = divisions === 12 && a + b === divisions && a % 2 ? (sample(a-1,b+1) + sample(a+1,b-1)) / 2 : sample(a,b);
        this.values[(side * this.stride + a) * this.stride + b] = y;
        peak = Math.max(peak, y);
      }
    }
    this.peak = Math.fround(peak);
  }

  node(side: number, a: number, b: number) {
    return this.values[(side * this.stride + a) * this.stride + b];
  }

  at(x: number, z: number) {
    const side = (Math.floor(Math.atan2(z,x) * 3 / Math.PI) + 6) % 6;
    const [ax,az] = corners[side], [bx,bz] = corners[(side+1)%6];
    let u = Math.max(0,(x*bz-z*bx) * this.divisions / INR), v = Math.max(0,(z*ax-x*az) * this.divisions / INR);
    const sum = u + v;
    if (sum > this.divisions) { u *= this.divisions / sum; v *= this.divisions / sum; }
    const a = Math.floor(u), b = Math.floor(v), i = (side*this.stride+a)*this.stride+b;
    if (a+b >= this.divisions) return this.values[i];
    const du = u-a, dv = v-b, h1 = this.values[i+this.stride], h2 = this.values[i+1];
    if (du+dv <= 1 || a+b+1 === this.divisions) return this.values[i]*(1-du-dv) + h1*du + h2*dv;
    return (1-dv)*h1 + (1-du)*h2 + (du+dv-1)*this.values[i+this.stride+1];
  }

  snapshot(seed: number) {
    const samples: number[] = [];
    for (let side=0; side<6; side++) for (let a=0; a<=this.divisions; a++) {
      for (let b=0; b<=this.divisions-a; b++) samples.push(this.node(side,a,b));
    }
    return { seed, stage: this.profile.stage, landform: this.profile.landform, peak: this.peak, samples };
  }
}
