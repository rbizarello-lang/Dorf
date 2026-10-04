import type * as THREE from 'three/webgpu';
import type { Sfx } from '../audio';
import { worldToHex } from '../core/hex';
import type { World } from '../render/world';
import type { Capture } from './capture';
import type { Hud } from './hud';

// Entrada no tabuleiro: mouse, toque (um dedo, pinça, dois dedos na vertical) e teclado.
// Os botões da interface ficam no main.ts; aqui só o canvas e as teclas.

type Hex = { q: number; r: number };

export interface InputHost {
  canvas: HTMLCanvasElement;
  world: World;
  hud: Hud;
  sfx: Sfx;
  store: { set(k: string, v: string | null): void };
  capture: Capture;
  hover(): Hex | null;
  setHover(h: Hex | null): void;
  /** O espaço está na fronteira (dá para pôr peça ali). */
  open(q: number, r: number): boolean;
  hasPiece(): boolean;
  gameOver(): boolean;
  place(q: number, r: number): void;
  rotate(dir: 1 | -1): void;
  cycleTime(): void;
  showHelp(): void;
  requestNewGame(): void;
  undo(): void;
  toggleMusic(): void;
}

export interface Input {
  /** Câmera pelas teclas seguradas (WASD, setas, Q/E, PgUp/PgDn), a cada quadro. */
  keyboardCamera(dt: number): void;
  tiltBy(d: number): void;
}

export function bindInput(h: InputHost): Input {
  const { canvas, world, hud, sfx, capture } = h;
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { button: number; x: number; y: number; moved: boolean; ground: THREE.Vector3 | null; touch: boolean } | null = null;
  // Dois dedos: decide no começo do gesto se é pinça (zoom e pan) ou arraste vertical (inclinação).
  let pinch: { d: number; mx: number; my: number; mode: 'pending' | 'zoom' | 'tilt'; ad: number; ax: number; ay: number } | null = null;

  /** Inclina a câmera e guarda o ajuste para a próxima partida (gravado quando o gesto para). */
  let tiltSave = 0;
  function tiltBy(d: number) {
    world.rig.incline(d);
    clearTimeout(tiltSave);
    tiltSave = window.setTimeout(() => h.store.set('tilt', world.rig.goalTilt.toFixed(3)), 400);
  }

  function hoverAt(clientX: number, clientY: number) {
    const p = world.groundPoint(clientX, clientY);
    if (!p) return null;
    const [q, r] = worldToHex(p.x, p.z);
    return { q, r };
  }

  canvas.addEventListener('pointerdown', (e) => {
    sfx.unlock();
    hud.closeThemeMenu();
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, mode: 'pending', ad: 0, ax: 0, ay: 0 };
      drag = null;
      return;
    }
    drag = { button: e.button, x: e.clientX, y: e.clientY, moved: false, ground: world.groundPoint(e.clientX, e.clientY), touch: e.pointerType !== 'mouse' };
  });

  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch.mode === 'pending') {
        // Os dois dedos subindo ou descendo juntos, sem abrir nem fechar: inclinação.
        pinch.ad += d - pinch.d;
        pinch.ax += mx - pinch.mx;
        pinch.ay += my - pinch.my;
        if (Math.hypot(pinch.ad, pinch.ax, pinch.ay) > 14) pinch.mode = Math.abs(pinch.ay) > 2 * Math.abs(pinch.ad) && Math.abs(pinch.ay) > Math.abs(pinch.ax) ? 'tilt' : 'zoom';
      } else if (pinch.mode === 'tilt') tiltBy((my - pinch.my) * 0.006);
      else {
        world.rig.zoom(pinch.d / Math.max(d, 1));
        const before = world.groundPoint(pinch.mx, pinch.my);
        const after = world.groundPoint(mx, my);
        if (before && after) world.rig.panWorld(before.x - after.x, before.z - after.z, true);
      }
      pinch.d = d;
      pinch.mx = mx;
      pinch.my = my;
      return;
    }
    if (drag) {
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > (drag.touch ? 10 : 5)) drag.moved = true;
      if (drag.moved) {
        if (drag.button === 2 || (drag.button === 0 && e.shiftKey)) {
          // Na horizontal gira; na vertical inclina (arrastar para cima abaixa a câmera rumo ao horizonte, como nos mapas).
          world.rig.rotate(-(e.movementX || 0) * 0.006);
          if (e.movementY) tiltBy(e.movementY * 0.004);
        } else if (drag.ground) {
          const now = world.groundPoint(e.clientX, e.clientY);
          if (now) {
            world.rig.panWorld(drag.ground.x - now.x, drag.ground.z - now.z, true);
            world.rig.apply(world.camera);
            world.camera.updateMatrixWorld();
          }
        }
        canvas.style.cursor = 'grabbing';
        return;
      }
    }
    if (e.pointerType === 'mouse' && capture.stage === 'play') h.setHover(hoverAt(e.clientX, e.clientY));
  });

  function endPointer(e: PointerEvent) {
    sfx.unlock(); // iOS libera áudio no fim do toque
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    canvas.style.cursor = '';
    const d = drag;
    drag = null;
    if (!d || d.moved || e.type === 'pointercancel' || capture.stage !== 'play') return;
    if (d.button === 2) {
      h.rotate(1);
      return;
    }
    const t = hoverAt(e.clientX, e.clientY);
    if (!t) return;
    if (d.touch) {
      // Toque: primeiro mostra a peça no espaço, o segundo toque confirma.
      const hover = h.hover();
      if (hover && hover.q === t.q && hover.r === t.r && h.open(t.q, t.r)) h.place(t.q, t.r);
      else {
        h.setHover(t);
        hud.confirm.hidden = !(h.hasPiece() && h.open(t.q, t.r));
      }
      return;
    }
    h.setHover(t);
    h.place(t.q, t.r);
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !drag) h.setHover(null);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (capture.stage === 'export') return;
      world.rig.zoom(Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
    },
    { passive: false },
  );

  const held = new Set<string>();
  window.addEventListener('keydown', (e) => {
    // Atalhos do navegador (Ctrl/Cmd+R, Cmd+D...) ficam com o navegador.
    if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (capture.stage === 'export') {
      if (k === 'escape') capture.cancelExport();
      return;
    }
    if (capture.stage === 'photo') {
      // No modo foto só a câmera, a hora, a pausa e a foto.
      if (k === 'escape' || k === 'p') capture.exitPhoto();
      else if (k === ' ') {
        e.preventDefault();
        capture.togglePhotoFreeze();
      } else if (k === 'l') h.cycleTime();
      else if (k === 'enter') void capture.shootPhoto();
      else if (k === '+' || k === '=') world.rig.zoom(0.85);
      else if (k === '-') world.rig.zoom(1.18);
      else if (k === 'home') tiltBy(-world.rig.goalTilt);
      else held.add(k);
      return;
    }
    if (k === 'escape') {
      if (hud.modalOpen && !h.gameOver()) h.store.set('seenHelp', '1');
      hud.hideModal();
      hud.closeThemeMenu();
      return;
    }
    if (hud.modalOpen) return;
    sfx.unlock();
    if (k === 'r' || k === ' ') {
      e.preventDefault();
      h.rotate(e.shiftKey ? -1 : 1);
    } else if (k === 't') h.rotate(-1);
    else if (k === 'f') hud.stats.hidden = !hud.stats.hidden;
    else if (k === 'l') h.cycleTime();
    else if (k === 'h' || k === '?') h.showHelp();
    else if (k === 'n') h.requestNewGame();
    else if (k === 'u') h.undo();
    else if (k === 'm') h.toggleMusic();
    else if (k === 'p') capture.enterPhoto();
    else if (k === 'v') {
      if (capture.take) capture.stopTake();
      else capture.startTake();
    } else if (k === '+' || k === '=') world.rig.zoom(0.85);
    else if (k === '-') world.rig.zoom(1.18);
    else if (k === 'home') tiltBy(-world.rig.goalTilt);
    else {
      if (k === 'pageup' || k === 'pagedown') e.preventDefault();
      held.add(k);
    }
  });
  window.addEventListener('keyup', (e) => {
    // Com Cmd pressionado o macOS não envia keyup das outras teclas: evita câmera "presa".
    if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt') held.clear();
    else held.delete(e.key.toLowerCase());
  });
  window.addEventListener('blur', () => held.clear());

  function keyboardCamera(dt: number) {
    let dx = 0, dy = 0;
    if (held.has('a') || held.has('arrowleft')) dx -= 1;
    if (held.has('d') || held.has('arrowright')) dx += 1;
    if (held.has('w') || held.has('arrowup')) dy += 1;
    if (held.has('s') || held.has('arrowdown')) dy -= 1;
    if (dx || dy) world.rig.panScreen(dx * dt * 12, dy * dt * 12);
    if (held.has('q')) world.rig.rotate(dt * 1.6);
    if (held.has('e')) world.rig.rotate(-dt * 1.6);
    if (held.has('pageup')) tiltBy(dt * 0.9);
    if (held.has('pagedown')) tiltBy(-dt * 0.9);
  }

  return { keyboardCamera, tiltBy };
}
