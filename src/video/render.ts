// Desenho do vídeo quadro a quadro: refaz o mapa como estava no começo, aplica os eventos no
// instante certo, põe a câmera na pose de cada quadro e avança o mundo exatamente 1/60 s por quadro.
// Nada depende do relógio real, então o vídeo sai liso mesmo que cada quadro leve um segundo.
import type { Rules } from '../core/board';
import { Game } from '../core/game';
import type { Quality, TimeOfDay, World } from '../render/world';
import type { Theme } from '../themes/types';
import { Mp4Writer, type CodecPick, type VideoSize } from './encoder';
import type { Pose } from './path';
import type { TakeEvent } from './take';

export type MoveRec = readonly [number, number, number];

export interface Script {
  theme: Theme;
  seed: number;
  rules: Rules;
  /** Jogadas já feitas quando o vídeo começa. */
  prefix: readonly MoveRec[];
  tod: TimeOfDay;
  /** Eventos em ordem de tempo. */
  events: readonly TakeEvent[];
  /** Uma pose por quadro: o vídeo tem esse número de quadros. */
  poses: readonly Pose[];
  /** Vagas da fronteira e peça flutuando (gravação), ou só o mapa (filme da partida). */
  gameUi: boolean;
}

export interface RenderOptions {
  size: VideoSize;
  quality: Quality;
  /** Pixels desenhados por pixel do vídeo em cada eixo (o Cinema desenha 1,5× e reduz). */
  supersample: number;
}

const TIMES: readonly string[] = ['dawn', 'day', 'golden', 'dusk', 'night'];
/** Quadros desenhados antes do primeiro, com o mundo parado: shaders compilados e TRAA assentado. */
const WARMUP = 30;

/** Espera um quadro da tela; com a aba escondida não há quadros, e o relógio garante que segue. */
function nextPaint(): Promise<void> {
  return new Promise((r) => {
    const done = () => r();
    requestAnimationFrame(done);
    setTimeout(done, 100);
  });
}

/** Devolve a vez ao navegador; de tempos em tempos espera um quadro da tela, para a página não travar. */
let lastPaint = 0;
function breathe(): Promise<void> {
  if (performance.now() - lastPaint > 250) {
    lastPaint = performance.now();
    return nextPaint();
  }
  return new Promise((r) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => r();
    ch.port2.postMessage(0);
  });
}

/**
 * Desenha e codifica o vídeo. Deixa o mundo no estado do fim do vídeo: quem chama restaura o
 * jogo. Devolve null se `cancelled` virar verdadeiro no meio.
 */
export async function renderVideo(world: World, s: Script, o: RenderOptions, pick: CodecPick, progress: (frame: number, total: number) => void, cancelled: () => boolean): Promise<Blob | null> {
  const game = new Game(s.seed, s.rules);
  for (const [q, r, rot] of s.prefix) {
    game.rot = rot;
    if (!game.place(q, r)) break;
    while (game.discardIfStuck());
  }
  world.setQuality(o.quality);
  world.setFixedSize({ w: o.size.width, h: o.size.height, ratio: o.supersample });
  world.setTheme(s.theme, game.board);
  world.setTimeOfDay(s.tod, true);
  world.showSlots = s.gameUi;
  world.clearGhost();
  // O canvas mudou de tamanho: um quadro da tela antes de começar.
  await nextPaint();

  const out = new OffscreenCanvas(o.size.width, o.size.height);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const writer = new Mp4Writer(pick, o.size);
  const total = s.poses.length;
  const dt = 1 / o.size.fps;
  let next = 0;

  const apply = (e: TakeEvent) => {
    if (e.kind === 'place') {
      game.rot = e.rot;
      const res = game.place(e.q, e.r);
      if (!res) return;
      world.placeAnimated(res.placed);
      world.updateFrontier(game.board);
      world.placeFx(res);
      while (game.discardIfStuck());
    } else if (e.kind === 'time') {
      if (TIMES.includes(e.tod)) world.setTimeOfDay(e.tod as TimeOfDay);
    } else if (e.kind === 'ghost') {
      if (!s.gameUi || !game.current) return;
      game.rot = e.rot;
      const c = game.check(e.q, e.r);
      if (c) world.setGhost(game.current, e.rot, e.angle, e.q, e.r, c);
    } else world.clearGhost();
  };

  try {
    for (let f = -WARMUP; f < total; f++) {
      world.timeScale = f < 0 ? 0 : 1;
      const t = Math.max(0, f) * dt;
      if (f >= 0) while (next < s.events.length && s.events[next].t <= t) apply(s.events[next++]);
      const p = s.poses[Math.max(0, f)];
      const rig = world.rig;
      rig.goal.set(p.x, 0, p.z);
      rig.target.copy(rig.goal);
      rig.dist = rig.goalDist = p.dist;
      rig.yaw = rig.goalYaw = p.yaw;
      rig.tilt = rig.goalTilt = p.tilt ?? 0;
      world.tick(dt);
      // O canvas tem o tamanho com supersamplagem; a cópia reduz para o tamanho do vídeo. O
      // aquecimento também copia: no Chromium com WebGPU, as primeiras cópias depois da troca de
      // tamanho saíram de uma cor só, e sem isso elas iam para os primeiros quadros do vídeo.
      ctx.drawImage(world.canvas, 0, 0, o.size.width, o.size.height);
      if (f >= 0) {
        await writer.add(out);
        progress(f + 1, total);
      }
      if (cancelled()) {
        writer.cancel();
        return null;
      }
      await breathe();
    }
    return await writer.finish();
  } catch (err) {
    writer.cancel();
    throw err;
  } finally {
    world.timeScale = 1;
  }
}
