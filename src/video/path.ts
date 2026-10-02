// Caminho da câmera do vídeo: as poses gravadas (ou planejadas) viram uma pose por quadro, com a
// suavização escolhida. Funções puras (testes em tests/video.ts).

/** Pose da câmera orbital (cameraRig.ts): alvo no chão, distância e giro. */
export interface Pose {
  x: number;
  z: number;
  dist: number;
  yaw: number;
}

/** Suavização: segundos de desvio do filtro gaussiano (0 = como gravada). */
export const SMOOTHING = { off: 0, light: 0.12, cinematic: 0.45 } as const;
export type Smoothing = keyof typeof SMOOTHING;

/**
 * Poses nos instantes `times` (segundos, crescentes) → uma pose por quadro, de 0 a `duration`,
 * interpolando entre as amostras vizinhas (antes da primeira e depois da última, fica parada).
 */
export function resample(times: readonly number[], poses: readonly Pose[], fps: number, duration: number): Pose[] {
  const n = Math.max(1, Math.round(duration * fps));
  const out: Pose[] = [];
  let j = 0;
  for (let f = 0; f < n; f++) {
    const t = f / fps;
    while (j < times.length - 2 && times[j + 1] <= t) j++;
    if (times.length < 2 || t <= times[0]) {
      out.push({ ...poses[0] });
      continue;
    }
    const t0 = times[j], t1 = times[j + 1];
    const k = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1;
    const a = poses[j], b = poses[j + 1];
    out.push({
      x: a.x + (b.x - a.x) * k,
      z: a.z + (b.z - a.z) * k,
      // O zoom anda em escala logarítmica: aproximar de 4 para 8 parece tão rápido quanto de 20 para 40.
      dist: a.dist * Math.pow(b.dist / a.dist, k),
      yaw: a.yaw + (b.yaw - a.yaw) * k,
    });
  }
  return out;
}

/**
 * Filtro gaussiano de mão dupla (sem atraso): `sigma` em quadros. As pontas repetem a primeira e
 * a última pose, para o vídeo não começar nem terminar puxando a câmera.
 */
export function smooth(poses: readonly Pose[], sigma: number): Pose[] {
  if (sigma < 0.5 || poses.length < 3) return poses.map((p) => ({ ...p }));
  const r = Math.ceil(sigma * 3);
  const w: number[] = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    w.push(v);
    sum += v;
  }
  const n = poses.length;
  return poses.map((_, f) => {
    let x = 0, z = 0, ld = 0, yaw = 0;
    for (let i = -r; i <= r; i++) {
      const p = poses[Math.min(n - 1, Math.max(0, f + i))];
      const k = w[i + r] / sum;
      x += p.x * k;
      z += p.z * k;
      ld += Math.log(p.dist) * k;
      yaw += p.yaw * k;
    }
    return { x, z, dist: Math.exp(ld), yaw };
  });
}
