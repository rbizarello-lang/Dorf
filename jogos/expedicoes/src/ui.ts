// Controles com ar de instrumento: mostrador de vistas em latão, teclas de hora e alavanca das semanas.
import { HOUR_NAMES, VIEWS, VIEW_NAMES, type ViewId } from './looks';

export interface UIHandlers { view(id: ViewId): void; hour(i: number): void; week(w: 1 | 4): void }

export const CAPTIONS: Record<ViewId, { t: string; rende: string }> = {
  mapa: { t: 'A província vista da mesa: a capital no centro e três postos já acesos, ligados por rotas a tinta. O resto ainda é bruma.', rende: 'Cada ponto aceso é uma sessão de 10 a 15 minutos.' },
  brejo: { t: 'Palafitas, passarelas de tábua sobre a água, juncos, garças e barquinhos chatos sob a névoa baixa.', rende: 'Rende junco, peixe de lagoa e a arte das passarelas.' },
  serra: { t: 'Chalés de pedra num patamar nevado, trilha em ziguezague, mina de trilhos e uma ponte de corda sobre o desfiladeiro.', rende: 'Rende pedra, minério e as torres de vigia.' },
  costa: { t: 'Falésia com farol, cais, barcos de pesca, redes secando e casas caiadas sob as gaivotas.', rende: 'Rende peixe, sal e o jeito caiado de construir.' },
  capital: { t: 'A capital em close. Na semana 4 ganhou bairros que vieram das expedições: o que você trouxe muda a cara dela.', rende: 'Pescadores, torres de pedra, canal com passarelas e um mercado das três origens.' },
  chegada: { t: 'Cartas dos moradores e o que mudou enquanto você esteve fora: o mundo anda sem você.', rende: 'Uma carta pede resposta antes da neve.' },
};

const ICONS = [
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 8v2M5 11l1.5 1.5M19 11l-1.5 1.5M2 14.5h2M20 14.5h2"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/></svg>',
];
const TINT = ['#d8b27a', '#8fb36a', '#a9bfd6', '#6fc0cc', '#e7a45a', '#e8d6a0'];
const SHORT = ['MAPA', 'BREJO', 'SERRA', 'COSTA', 'CAPITAL', 'CHEGADA'];
const ANG = [-125, -75, -25, 25, 75, 125];

function wedge(a0: number, a1: number, r: number): string {
  const p = (a: number): string => `${(Math.sin((a * Math.PI) / 180) * r).toFixed(2)},${(-Math.cos((a * Math.PI) / 180) * r).toFixed(2)}`;
  return `M0,0 L${p(a0)} A${r},${r} 0 0 1 ${p(a1)} Z`;
}

export function createUI(root: HTMLElement, h: UIHandlers): { set(view: ViewId, hour: number, week: number): void } {
  let ticks = '';
  for (let a = -135; a <= 135; a += 7.5) {
    const big = a % 50 === 25 || a % 25 === 0, rad = (a * Math.PI) / 180, r0 = big ? 78 : 81, r1 = 85;
    ticks += `<line x1="${(Math.sin(rad) * r0).toFixed(2)}" y1="${(-Math.cos(rad) * r0).toFixed(2)}" x2="${(Math.sin(rad) * r1).toFixed(2)}" y2="${(-Math.cos(rad) * r1).toFixed(2)}" stroke="#c9a15a" stroke-width="${big ? 1.8 : 0.8}" opacity="${big ? 0.95 : 0.5}"/>`;
  }
  let screws = '';
  for (let a = 22.5; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    screws += `<circle cx="${(Math.sin(rad) * 92).toFixed(2)}" cy="${(-Math.cos(rad) * 92).toFixed(2)}" r="1.9" fill="url(#ex-screw)"/>`;
  }
  const lblPos = ANG.map((a) => ({ x: Math.sin((a * Math.PI) / 180) * 63, y: -Math.cos((a * Math.PI) / 180) * 63 + 3 }));
  root.innerHTML = `
    <header class="title"><h1>Expedições <span>(esboço visual)</span></h1><p id="ex-sub"></p></header>
    <aside class="card" id="ex-card"><b id="ex-name"></b><p id="ex-text"></p><p class="rende" id="ex-rende"></p></aside>
    <aside class="legend" id="ex-legend" aria-label="Bairros da semana 4"><b>Bairros trazidos pelas caravanas</b>
      <span><i style="background:#2f78b6"></i>Pescadores · estilo da costa</span>
      <span><i style="background:#56606e"></i>Torres de pedra · estilo da serra</span>
      <span><i style="background:#6f8a46"></i>Canal e passarelas · estilo do brejo</span>
      <span><i style="background:#c9a24a"></i>Mercado · barracas das três origens</span></aside>
    <div class="hint">arraste para girar · role ou belisque para aproximar</div>
    <section class="panel" aria-label="Controles do diorama">
      <div class="group hours">
        <div class="cap">Hora do dia</div>
        <div class="seg" role="group" aria-label="Hora do dia">
          ${HOUR_NAMES.map((n, i) => `<button type="button" data-hour="${i}" aria-pressed="false">${ICONS[i]}<span>${n}</span></button>`).join('')}
        </div>
      </div>
      <div class="dialwrap">
        <svg class="dial" viewBox="-100 -100 200 200" role="group" aria-label="Vista">
          <defs>
            <radialGradient id="ex-brass" cx="35%" cy="28%" r="85%"><stop offset="0" stop-color="#f0cf8a"/><stop offset="0.45" stop-color="#c0914a"/><stop offset="1" stop-color="#6f4d1f"/></radialGradient>
            <radialGradient id="ex-face" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#3a2619"/><stop offset="1" stop-color="#170e08"/></radialGradient>
            <radialGradient id="ex-cap" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff0c0"/><stop offset="0.5" stop-color="#cfa050"/><stop offset="1" stop-color="#6a481c"/></radialGradient>
            <radialGradient id="ex-screw" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#f3dca0"/><stop offset="1" stop-color="#7d5a26"/></radialGradient>
            <linearGradient id="ex-needle" x1="0" x2="1"><stop offset="0" stop-color="#8e6528"/><stop offset="0.5" stop-color="#f6dc9a"/><stop offset="1" stop-color="#8e6528"/></linearGradient>
          </defs>
          <circle r="97" fill="url(#ex-brass)"/>
          <circle r="94" fill="none" stroke="#4f3513" stroke-width="1.2" opacity="0.8"/>
          <circle r="88" fill="url(#ex-face)" stroke="#2a1b0a" stroke-width="2"/>
          ${screws}
          ${ANG.map((a, i) => `<path class="wedge" data-view="${i}" d="${wedge(a - 25, a + 25, 86)}" fill="${TINT[i]}"/>`).join('')}
          ${ticks}
          <circle r="50" fill="none" stroke="#c9a15a" stroke-width="0.6" opacity="0.4"/>
          ${lblPos.map((l, i) => `<text class="lbl" data-view="${i}" x="${l.x.toFixed(1)}" y="${l.y.toFixed(1)}" text-anchor="middle">${SHORT[i]}</text>`).join('')}
          <text x="0" y="46" text-anchor="middle" class="eng">VISTAS</text>
          <g id="ex-needle" class="needle"><polygon points="0,-48 4.6,2 0,10 -4.6,2" fill="url(#ex-needle)" stroke="#3b2810" stroke-width="0.8"/><polygon points="0,-48 0,10 -4.6,2" fill="#000" opacity="0.18"/></g>
          <circle r="8.5" fill="url(#ex-cap)" stroke="#3b2810" stroke-width="0.8"/>
          <circle r="2.4" fill="#2a1b0a"/>
        </svg>
      </div>
      <div class="group weeks">
        <div class="cap" id="ex-wcap">Semana da capital</div>
        <div class="seg lever" role="group" aria-label="Semana da capital">
          <button type="button" data-week="1" aria-pressed="false"><span>Semana 1</span></button>
          <button type="button" data-week="4" aria-pressed="false"><span>Semana 4</span></button>
        </div>
        <div class="plaque" id="ex-plaque"></div>
      </div>
    </section>`;

  const q = <T extends Element>(s: string): T => root.querySelector(s) as T;
  const qa = <T extends Element>(s: string): T[] => [...root.querySelectorAll(s)] as T[];
  const needle = q<SVGGElement>('#ex-needle');
  const sub = q<HTMLElement>('#ex-sub');
  let cur = 0;
  const set = (view: ViewId, hour: number, week: number): void => {
    const vi = VIEWS.indexOf(view);
    cur = vi;
    needle.style.transform = `rotate(${ANG[vi]}deg)`;
    qa<SVGElement>('[data-view]').forEach((e) => e.classList.toggle('on', Number(e.dataset.view) === vi));
    qa<HTMLButtonElement>('[data-hour]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.hour) === hour)));
    qa<HTMLButtonElement>('[data-week]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.week) === week)));
    sub.textContent = `${VIEW_NAMES[view]} · ${HOUR_NAMES[hour]}${view === 'capital' ? ` · Semana ${week}` : ''}`;
    q<HTMLElement>('#ex-name').textContent = VIEW_NAMES[view];
    q<HTMLElement>('#ex-text').textContent = CAPTIONS[view].t;
    q<HTMLElement>('#ex-rende').textContent = view === 'capital' || view === 'mapa' || view === 'chegada' ? CAPTIONS[view].rende : 'O posto ' + CAPTIONS[view].rende.toLowerCase();
    root.classList.toggle('is-capital', view === 'capital');
    root.classList.toggle('w4', week === 4);
    q<HTMLElement>('#ex-wcap').textContent = view === 'capital' ? 'Semana da capital' : 'Rende para a capital';
    q<HTMLElement>('#ex-plaque').textContent = view === 'capital' ? '' : CAPTIONS[view].rende;
  };
  qa<SVGElement>('[data-view]').forEach((e) => e.addEventListener('click', () => h.view(VIEWS[Number(e.dataset.view)])));
  qa<HTMLButtonElement>('[data-hour]').forEach((b) => b.addEventListener('click', () => h.hour(Number(b.dataset.hour))));
  qa<HTMLButtonElement>('[data-week]').forEach((b) => b.addEventListener('click', () => h.week(Number(b.dataset.week) === 4 ? 4 : 1)));
  addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '6') h.view(VIEWS[Number(e.key) - 1]);
    else if (e.key === 'ArrowRight') h.view(VIEWS[(cur + 1) % VIEWS.length]);
    else if (e.key === 'ArrowLeft') h.view(VIEWS[(cur + VIEWS.length - 1) % VIEWS.length]);
  });
  return { set };
}
