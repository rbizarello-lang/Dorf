// Filme da partida: a partida inteira refeita peça por peça, com a câmera se afastando conforme
// o mapa cresce e girando devagar em volta dele. Só o plano (tempos e poses); quem desenha é o
// main.ts. Puro, sem three.js (testes em tests/video.ts).
import { hexToWorld } from '../core/hex';
import type { Pose } from './path';

export interface FilmPlan {
  /** Instante (segundos) em que cada jogada cai, na ordem das jogadas. */
  placeAt: number[];
  duration: number;
  /** Poses-chave da câmera e seus instantes, para `resample` e `smooth`. */
  times: number[];
  poses: Pose[];
}

/** Segundos parados na peça inicial antes da primeira jogada e girando no mapa pronto no fim. */
const INTRO = 1.6;
const OUTRO = 6;
/** Duração alvo da parte das jogadas, e o intervalo mínimo e máximo entre duas peças. */
const BODY = 100;
const MIN_GAP = 0.1;
const MAX_GAP = 0.6;
/** Giro da câmera em volta do mapa (radianos por segundo). */
const ORBIT = 0.045;

/** Distância que enquadra o mapa de raio `r` (a mesma conta do `frameCamera` do main.ts, em 16:9). */
export const fitDist = (r: number) => Math.min(46, Math.max(7, r * 2.1 + 5));

/** Plano do filme para as jogadas `moves` ([q, r, giro]) a partir da peça inicial em (0, 0). */
export function planFilm(moves: readonly (readonly number[])[], yaw0: number): FilmPlan {
  const n = moves.length;
  const gap = Math.min(MAX_GAP, Math.max(MIN_GAP, BODY / Math.max(1, n)));
  const placeAt = moves.map((_, i) => INTRO + i * gap);
  const duration = INTRO + n * gap + OUTRO;
  const times: number[] = [0];
  const start = { x: 0, z: 0, dist: fitDist(2) * 0.8, yaw: yaw0 };
  const poses: Pose[] = [start];
  // O centro e o raio do mapa depois de cada jogada; o alvo puxa um pouco para a peça nova.
  let sx = 0, sz = 0;
  const pts: { x: number; z: number }[] = [{ x: 0, z: 0 }];
  for (let i = 0; i < n; i++) {
    const p = hexToWorld(moves[i][0], moves[i][1]);
    pts.push(p);
    sx += p.x;
    sz += p.z;
    const cx = sx / pts.length, cz = sz / pts.length;
    let r = 2;
    for (const q of pts) r = Math.max(r, Math.hypot(q.x - cx, q.z - cz));
    const t = placeAt[i] + gap * 0.5;
    times.push(t);
    poses.push({ x: cx * 0.75 + p.x * 0.25, z: cz * 0.75 + p.z * 0.25, dist: fitDist(r) * 0.9, yaw: yaw0 + t * ORBIT });
  }
  // Fim: o mapa todo enquadrado, ainda girando.
  const last = poses[poses.length - 1];
  const cx = sx / pts.length, cz = sz / pts.length;
  let r = 2;
  for (const q of pts) r = Math.max(r, Math.hypot(q.x - cx, q.z - cz));
  times.push(duration);
  poses.push({ x: cx, z: cz, dist: Math.max(last.dist, fitDist(r)), yaw: yaw0 + duration * ORBIT });
  return { placeAt, duration, times, poses };
}
