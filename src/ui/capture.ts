import type { Game } from '../core/game';
import type { Quality, TimeOfDay, World } from '../render/world';
import type { Theme } from '../themes/themes';
import { pickCodec, type VideoSize } from '../video/encoder';
import { planFilm } from '../video/film';
import { SMOOTHING, resample, smooth, type Smoothing } from '../video/path';
import { renderVideo, type MoveRec, type Script } from '../video/render';
import { Take, type TakeEvent } from '../video/take';
import { TIME_ICON, TIME_LABEL, TIME_ORDER, type Hud } from './hud';

// Foto e vídeo: o modo foto (P), a gravação (V), o filme da partida e a exportação em MP4.
// O jogo entra pelo `CaptureHost`; daqui só sai o estado da tela (`stage`) e a gravação.

/** O que a tela está fazendo: o jogo, o modo foto, ou um vídeo sendo desenhado (o laço não desenha). */
export type Stage = 'play' | 'photo' | 'export';
/** O estado do jogo quando a gravação começou. */
type TakeStart = Pick<Script, 'theme' | 'seed' | 'rules' | 'specials' | 'prefix' | 'tod'>;

export interface CaptureHost {
  canvas: HTMLCanvasElement;
  world: World;
  hud: Hud;
  store: { get(k: string): string | null; set(k: string, v: string | null): void };
  theme(): Theme;
  game(): Game;
  moves(): readonly MoveRec[];
  /** Nível em uso no jogo (o do Auto ou o escolhido), para voltar depois do vídeo. */
  liveQuality(): Quality;
  qualityLabel(q: Quality): string;
  cycleTime(): void;
  /** A interface some: sem fantasma nem peça sob o cursor. */
  clearHover(): void;
  updateGhost(): void;
  resetDynres(): void;
  refreshHud(instant: boolean): void;
}

/** "1:05" para durações. */
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
/** Carimbo de data e hora para nomes de arquivo. */
const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 120_000);
}

const PHOTO_SIZES = { screen: 'Tela', '4k': '4K', '8k': '8K' } as const;
type PhotoSize = keyof typeof PHOTO_SIZES;

/** Tamanho da foto: o lado maior da tela levado a 4K ou 8K (no máximo 8192, o limite das texturas). */
function photoPixels(size: PhotoSize) {
  const w = window.innerWidth, h = window.innerHeight;
  const long = size === 'screen' ? Math.max(w, h) * (window.devicePixelRatio || 1) : size === '4k' ? 3840 : 7680;
  const ratio = Math.min(long, 8192) / Math.max(w, h);
  return { w, h, ratio, pw: Math.floor(w * ratio), ph: Math.floor(h * ratio) };
}

export const RESOLUTIONS = { 1080: '1080p', 1440: '1440p', 2160: '4K' } as const;
export const VIDEO_QUALITIES = ['cinema', 'ultra', 'high'] as const;
const CAMERAS: Record<Smoothing, string> = { off: 'Como gravada', light: 'Suave', cinematic: 'Cinematográfica' };

export class Capture {
  stage: Stage = 'play';
  /** Gravação em andamento (tecla V). */
  take: Take | null = null;
  /** A foto está sendo desenhada (o laço não desenha). */
  shooting = false;
  private takeStart: TakeStart | null = null;
  /** A última gravação, para exportar (de novo, em outro tamanho ou câmera). */
  private pendingTake: { take: Take; start: TakeStart } | null = null;
  private exportCancel = false;
  private photoSize: PhotoSize;
  private photoFrozen = false;
  private readonly photoBar = document.createElement('div');
  private readonly exportBar = document.createElement('div');
  private readonly cameraBtn = document.getElementById('btn-camera')!;

  constructor(private h: CaptureHost) {
    const v = h.store.get('photoSize');
    this.photoSize = v && Object.hasOwn(PHOTO_SIZES, v) ? (v as PhotoSize) : '4k';
    this.photoBar.className = 'capture-bar';
    this.photoBar.hidden = true;
    document.body.appendChild(this.photoBar);
    this.photoBar.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.photo;
      if (this.shooting || !act) return;
      if (act === 'freeze') this.togglePhotoFreeze();
      else if (act === 'time') h.cycleTime();
      else if (act === 'size') {
        const keys = Object.keys(PHOTO_SIZES) as PhotoSize[];
        this.photoSize = keys[(keys.indexOf(this.photoSize) + 1) % keys.length];
        h.store.set('photoSize', this.photoSize);
        this.renderPhotoBar();
      } else if (act === 'shoot') void this.shootPhoto();
      else if (act === 'exit') this.exitPhoto();
    });
    this.exportBar.className = 'capture-bar export';
    this.exportBar.hidden = true;
    document.body.appendChild(this.exportBar);
    this.exportBar.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) this.exportCancel = true;
    });
    this.cameraBtn.addEventListener('click', () => this.cameraMenu());
  }

  /** Esc durante a exportação: o vídeo para no próximo quadro. */
  cancelExport() {
    this.exportCancel = true;
  }

  /** A hora mudou: o botão da barra de foto mostra a nova. */
  timeChanged() {
    if (this.stage === 'photo') this.renderPhotoBar();
  }

  /** Esconde a interface do jogo (foto e vídeo) ou volta com ela. */
  private setCaptureUi(on: boolean) {
    const { hud, world } = this.h;
    document.body.classList.toggle('capture', on);
    hud.closeThemeMenu();
    world.showSlots = !on;
    if (on) {
      this.h.clearHover();
      world.clearGhost();
      hud.confirm.hidden = true;
    }
  }

  updateCameraBtn() {
    const take = this.take, btn = this.cameraBtn;
    btn.classList.toggle('rec', !!take);
    btn.querySelector('.long')!.textContent = take ? `● ${clock(take.t)}` : 'Câmera';
    btn.querySelector('.short')!.textContent = take ? '●' : '◉';
    btn.title = take ? 'Parar a gravação (V)' : 'Foto e vídeo';
  }

  private cameraMenu() {
    if (this.take) {
      this.stopTake();
      return;
    }
    if (this.stage !== 'play') return;
    const moves = this.h.moves();
    const pending = this.pendingTake;
    this.h.hud.toggleMenu(
      this.cameraBtn,
      [
        { id: 'photo', label: 'Foto', key: 'P', note: 'Esconde a interface e salva a imagem em até 8K' },
        { id: 'take', label: 'Gravar vídeo', key: 'V', note: 'Grava até 2 minutos do que você fizer; o vídeo sai liso, em até 4K' },
        { id: 'film', label: 'Filme da partida', note: moves.length ? `A partida inteira, peça por peça (${moves.length} jogadas)` : 'Faça algumas jogadas primeiro' },
        ...(pending ? [{ id: 'last', label: 'Última gravação', note: `${clock(pending.take.t)} · exportar de novo, em outro tamanho ou câmera` }] : []),
      ],
      (id) => {
        if (id === 'photo') this.enterPhoto();
        else if (id === 'take') this.startTake();
        else if (id === 'last') this.showExportDialog('take');
        else if (this.h.moves().length) this.showExportDialog('film');
        else this.h.hud.toast('O filme precisa de pelo menos uma jogada.');
      },
    );
  }

  // ---- modo foto (P): sem interface, mundo parado ou animado, PNG em até 8K

  private renderPhotoBar() {
    const p = photoPixels(this.photoSize);
    const tod = this.h.world.timeOfDay;
    this.photoBar.innerHTML = `
    <button type="button" data-photo="freeze" title="Pausar ou animar o mundo (Espaço)">${this.photoFrozen ? '▶ Animar' : '❚❚ Pausar'}</button>
    <button type="button" data-photo="time" title="Hora do dia (L)">${TIME_ICON[tod]} ${TIME_LABEL[tod]}</button>
    <button type="button" data-photo="size" title="Tamanho da foto">${PHOTO_SIZES[this.photoSize]} · ${p.pw}×${p.ph}</button>
    <button type="button" class="primary" data-photo="shoot" title="Salvar a foto (Enter)">Salvar foto</button>
    <button type="button" data-photo="exit" title="Sair do modo foto (Esc)" aria-label="Sair do modo foto">✕</button>`;
  }

  enterPhoto() {
    const { hud, world } = this.h;
    if (this.stage !== 'play' || hud.modalOpen) return;
    if (this.take) {
      hud.toast('Pare a gravação antes (V).');
      return;
    }
    this.stage = 'photo';
    this.setCaptureUi(true);
    world.timeScale = this.photoFrozen ? 0 : 1;
    this.renderPhotoBar();
    this.photoBar.hidden = false;
    hud.toast('Modo foto · Espaço pausa · Enter salva · Esc sai');
  }

  exitPhoto() {
    if (this.stage !== 'photo' || this.shooting) return;
    this.stage = 'play';
    this.photoBar.hidden = true;
    this.h.world.timeScale = 1;
    this.setCaptureUi(false);
    this.h.updateGhost();
  }

  togglePhotoFreeze() {
    this.photoFrozen = !this.photoFrozen;
    this.h.world.timeScale = this.photoFrozen ? 0 : 1;
    this.renderPhotoBar();
  }

  /** Desenha a cena parada no tamanho da foto, deixa o TRAA assentar e salva um PNG. */
  async shootPhoto() {
    if (this.stage !== 'photo' || this.shooting) return;
    const { hud, world, canvas } = this.h;
    this.shooting = true;
    this.photoBar.classList.add('busy');
    const p = photoPixels(this.photoSize);
    hud.toast(`Salvando a foto em ${p.pw}×${p.ph}…`);
    world.timeScale = 0;
    world.setFixedSize({ w: p.w, h: p.h, ratio: p.ratio });
    try {
      // Com o tamanho novo o antisserrilhado temporal recomeça: alguns quadros parados para ele assentar.
      const out = document.createElement('canvas');
      for (let i = 0; i < 24; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        world.tick(1 / 60);
      }
      // A cópia sai no mesmo passo do último desenho, antes de o navegador trocar o quadro do canvas.
      out.width = canvas.width;
      out.height = canvas.height;
      out.getContext('2d')!.drawImage(canvas, 0, 0);
      const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/png'));
      if (!blob) throw new Error('imagem vazia');
      download(blob, `retalhos-${this.h.theme().id}-${stamp()}.png`);
      hud.toast(`Foto salva · ${out.width}×${out.height}`, 'good');
    } catch (err) {
      console.error(err);
      hud.toast('A foto não pôde ser salva (memória de vídeo?). Tente um tamanho menor.', 'bad');
    } finally {
      world.setFixedSize(null);
      world.timeScale = this.photoFrozen ? 0 : 1;
      this.shooting = false;
      this.photoBar.classList.remove('busy');
    }
  }

  // ---- gravação (V) e filme da partida

  startTake() {
    const { hud, world } = this.h;
    if (this.stage !== 'play' || this.take || hud.modalOpen) return;
    const game = this.h.game();
    this.take = new Take();
    this.takeStart = { theme: this.h.theme(), seed: game.seed, rules: game.rules, specials: game.specials, prefix: this.h.moves().slice(), tod: world.timeOfDay };
    // A peça que já está flutuando entra na gravação desde o começo.
    this.h.updateGhost();
    this.updateCameraBtn();
    hud.toast('Gravando · V para parar (até 2 minutos)');
  }

  stopTake(reason?: string) {
    if (!this.take || !this.takeStart) return;
    const t = this.take, start = this.takeStart;
    this.take = null;
    this.takeStart = null;
    this.updateCameraBtn();
    if (reason) this.h.hud.toast(reason);
    if (t.t < 1) {
      this.h.hud.toast('A gravação foi curta demais para virar vídeo.');
      return;
    }
    this.pendingTake = { take: t, start };
    this.showExportDialog('take');
  }

  /** Escolhas do vídeo: tamanho, nível, câmera (gravação) ou hora (filme). */
  showExportDialog(kind: 'take' | 'film') {
    const { world } = this.h;
    const moves = this.h.moves();
    const dur = kind === 'take' ? this.pendingTake!.take.t : planFilm(moves, world.rig.yaw).duration;
    const seg = (name: string, value: string, label: string, on: boolean) => `<label class="seg"><input type="radio" name="${name}" value="${value}"${on ? ' checked' : ''}><span>${label}</span></label>`;
    const group = (legend: string, html: string) => `<fieldset class="segs"><legend>${legend}</legend><div>${html}</div></fieldset>`;
    this.h.hud.showModal(`
    <h2 id="modal-title">${kind === 'take' ? 'Gravação pronta' : 'Filme da partida'}</h2>
    <p class="muted">${clock(dur)} de vídeo · ${Math.round(dur * 60).toLocaleString('pt-BR')} quadros a 60 por segundo${kind === 'film' ? ` · ${moves.length} jogadas` : ''}</p>
    <form class="export" data-kind="${kind}">
      ${group('Tamanho', Object.entries(RESOLUTIONS).map(([v, l]) => seg('res', v, l, v === '2160')).join(''))}
      ${group('Qualidade', VIDEO_QUALITIES.map((q) => seg('q', q, this.h.qualityLabel(q), q === 'cinema')).join(''))}
      ${
        kind === 'take'
          ? group('Câmera', (Object.keys(CAMERAS) as Smoothing[]).map((c) => seg('cam', c, CAMERAS[c], c === 'cinematic')).join(''))
          : group('Hora', TIME_ORDER.map((t) => seg('tod', t, TIME_LABEL[t], t === world.timeOfDay)).join(''))
      }
    </form>
    <p class="muted">Cada quadro é desenhado com calma, então o vídeo sai liso mesmo numa placa lenta. Em 4K no Cinema leva um bom tempo; dá para cancelar.</p>
    <div class="row"><button class="primary" type="button" data-act="export">Exportar MP4</button><button class="secondary" type="button" data-act="close">${kind === 'take' ? 'Descartar' : 'Cancelar'}</button></div>`);
  }

  /** Botão Exportar do diálogo: lê as escolhas (só valores das listas fixas) e desenha o vídeo. */
  submitExport() {
    const form = this.h.hud.modalBody.querySelector<HTMLFormElement>('form.export');
    const val = (name: string) => (form?.elements.namedItem(name) as RadioNodeList | null)?.value ?? '';
    const res = Number(val('res'));
    const q = val('q');
    const cam = val('cam');
    const tod = val('tod');
    this.h.hud.hideModal();
    if (!form) return;
    void this.exportVideo(
      form.dataset.kind === 'film' ? 'film' : 'take',
      Object.hasOwn(RESOLUTIONS, res) ? res : 1080,
      (VIDEO_QUALITIES as readonly string[]).includes(q) ? (q as Quality) : 'high',
      Object.hasOwn(CAMERAS, cam) ? (cam as Smoothing) : 'cinematic',
      Object.hasOwn(TIME_LABEL, tod) ? (tod as TimeOfDay) : this.h.world.timeOfDay,
    );
  }

  /** Monta o roteiro do vídeo: a gravação suavizada, ou o filme da partida desde a peça inicial. */
  private buildScript(kind: 'take' | 'film', cam: Smoothing, tod: TimeOfDay, fps: number): Script | null {
    if (kind === 'take') {
      if (!this.pendingTake) return null;
      const { take: t, start } = this.pendingTake;
      const poses = smooth(resample(t.times, t.poses, fps, t.t), SMOOTHING[cam] * fps);
      return { ...start, events: t.events, poses, gameUi: true };
    }
    const moves = this.h.moves();
    if (!moves.length) return null;
    const game = this.h.game();
    const plan = planFilm(moves, this.h.world.rig.yaw);
    const poses = smooth(resample(plan.times, plan.poses, fps, plan.duration), 0.8 * fps);
    const events: TakeEvent[] = moves.map(([q, r, rot, ...picks], i) => ({ t: plan.placeAt[i], kind: 'place', q, r, rot, picks }));
    return { theme: this.h.theme(), seed: game.seed, rules: game.rules, specials: game.specials, prefix: [], tod, events, poses, gameUi: false };
  }

  /**
   * Desenha o vídeo quadro a quadro e baixa o MP4. O mapa do jogo é refeito no fim (o vídeo
   * reconstrói o mapa do começo da gravação), com a câmera, a hora e o nível de antes.
   */
  async exportVideo(kind: 'take' | 'film', height: number, quality: Quality, cam: Smoothing, tod: TimeOfDay) {
    if (this.stage !== 'play') return null;
    const { hud, world, canvas } = this.h;
    const size: VideoSize = { width: Math.round((height * 16) / 9 / 2) * 2, height, fps: 60 };
    const pick = await pickCodec(size);
    if (!pick) {
      hud.toast('Este navegador não grava vídeo (falta o WebCodecs com H.264 ou VP9). Use o Chrome ou o Edge.', 'bad');
      return null;
    }
    const script = this.buildScript(kind, cam, tod, size.fps);
    if (!script) return null;
    const rig = world.rig;
    const live = { tod: world.timeOfDay, goal: rig.goal.clone(), target: rig.target.clone(), dist: rig.goalDist, yaw: rig.goalYaw, tilt: rig.goalTilt };
    this.stage = 'export';
    this.exportCancel = false;
    this.setCaptureUi(true);
    // O vídeo é 16:9: na tela, o canvas mostra o quadro inteiro com faixas, sem esticar.
    canvas.classList.add('letterbox');
    const exportBar = this.exportBar;
    exportBar.hidden = false;
    exportBar.innerHTML = `<span class="label">Preparando…</span><span class="bar"><i></i></span><button type="button">Cancelar</button>`;
    const label = exportBar.querySelector<HTMLElement>('.label')!;
    const bar = exportBar.querySelector<HTMLElement>('.bar i')!;
    const t0 = performance.now();
    let blob: Blob | null = null;
    try {
      blob = await renderVideo(
        world,
        script,
        { size, quality, supersample: quality === 'cinema' ? 1.5 : 1 },
        pick,
        (f, total) => {
          if (f % 10 && f !== total) return;
          const left = ((performance.now() - t0) / f) * (total - f) / 1000;
          label.textContent = `Quadro ${f.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} · ${f < 30 ? 'calculando o tempo' : `faltam ~${left > 90 ? `${Math.round(left / 60)} min` : `${Math.ceil(left)} s`}`}`;
          bar.style.width = `${((f / total) * 100).toFixed(1)}%`;
        },
        () => this.exportCancel,
      );
      if (blob) {
        download(blob, `retalhos-${script.theme.id}-${stamp()}.mp4`);
        hud.toast(`Vídeo salvo · ${clock(script.poses.length / size.fps)} em ${RESOLUTIONS[height as keyof typeof RESOLUTIONS] ?? `${height}p`} · ${(blob.size / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: blob.size < 1e7 ? 1 : 0 })} MB`, 'good');
      } else hud.toast('Exportação cancelada.');
    } catch (err) {
      console.error(err);
      hud.toast(`O vídeo não pôde ser exportado: ${err instanceof Error ? err.message : String(err)}`, 'bad');
    } finally {
      exportBar.hidden = true;
      canvas.classList.remove('letterbox');
      world.setFixedSize(null);
      world.setTimeOfDay(live.tod, true);
      world.setQuality(this.h.liveQuality());
      world.setTheme(this.h.theme(), this.h.game().board);
      rig.goal.copy(live.goal);
      rig.target.copy(live.target);
      rig.dist = rig.goalDist = live.dist;
      rig.yaw = rig.goalYaw = live.yaw;
      rig.tilt = rig.goalTilt = live.tilt;
      this.h.resetDynres();
      world.setResolutionScale(1);
      this.stage = 'play';
      this.setCaptureUi(false);
      this.h.refreshHud(true);
    }
    return blob;
  }
}
