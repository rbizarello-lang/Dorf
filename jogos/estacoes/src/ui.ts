// Controles com ar de instrumento: mostrador de estações em latão, seletor de hora e alavanca dos anos.
import { SEASON_NAMES, HOUR_NAMES } from './looks';

export interface UIHandlers { season(i: number): void; hour(i: number): void; year(y: 1 | 3): void }

const SEASON_TINT = ['#9bd062', '#e7b73c', '#d9702a', '#bcd6ec'];

function wedge(a0: number, a1: number, r: number): string {
  const p = (a: number): string => `${(Math.sin((a * Math.PI) / 180) * r).toFixed(2)},${(-Math.cos((a * Math.PI) / 180) * r).toFixed(2)}`;
  return `M0,0 L${p(a0)} A${r},${r} 0 0 1 ${p(a1)} Z`;
}

const ICONS = [
  // manhã: sol nascendo
  '<svg viewBox="0 0 24 24"><path d="M3 17h18M6 17a6 6 0 0 1 12 0M12 5v3M4.5 9.5l2 2M19.5 9.5l-2 2" /></svg>',
  // tarde: sol alto
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></svg>',
  // entardecer: sol baixo
  '<svg viewBox="0 0 24 24"><path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 8v2M5 11l1.5 1.5M19 11l-1.5 1.5M2 14.5h2M20 14.5h2"/></svg>',
  // noite: lua
  '<svg viewBox="0 0 24 24"><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/></svg>',
];

export function createUI(root: HTMLElement, h: UIHandlers): { set(season: number, hour: number, year: number): void } {
  const labels = [
    { t: 'PRIMAVERA', x: 0, y: -50 }, { t: 'VERÃO', x: 53, y: 3 }, { t: 'OUTONO', x: 0, y: 58 }, { t: 'INVERNO', x: -53, y: 3 },
  ];
  let ticks = '';
  for (let a = 0; a < 360; a += 7.5) {
    const big = a % 90 === 0, rad = (a * Math.PI) / 180, r0 = big ? 78 : 81, r1 = 85;
    ticks += `<line x1="${(Math.sin(rad) * r0).toFixed(2)}" y1="${(-Math.cos(rad) * r0).toFixed(2)}" x2="${(Math.sin(rad) * r1).toFixed(2)}" y2="${(-Math.cos(rad) * r1).toFixed(2)}" stroke="#c9a15a" stroke-width="${big ? 1.8 : 0.8}" opacity="${big ? 0.95 : 0.55}"/>`;
  }
  let screws = '';
  for (let a = 22.5; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    screws += `<circle cx="${(Math.sin(rad) * 92).toFixed(2)}" cy="${(-Math.cos(rad) * 92).toFixed(2)}" r="1.9" fill="url(#cd-screw)"/>`;
  }
  root.innerHTML = `
    <header class="title"><h1>Cidade das Quatro Estações <span>(esboço visual)</span></h1><p id="cd-sub"></p></header>
    <div class="hint">arraste para girar · role ou belisque para aproximar</div>
    <section class="panel" aria-label="Controles do diorama">
      <div class="group hours">
        <div class="cap">Hora do dia</div>
        <div class="seg" role="group" aria-label="Hora do dia">
          ${HOUR_NAMES.map((n, i) => `<button type="button" data-hour="${i}" aria-pressed="false">${ICONS[i]}<span>${n}</span></button>`).join('')}
        </div>
      </div>
      <div class="dialwrap">
        <svg class="dial" viewBox="-100 -100 200 200" role="group" aria-label="Estação do ano">
          <defs>
            <radialGradient id="cd-brass" cx="35%" cy="28%" r="85%"><stop offset="0" stop-color="#f0cf8a"/><stop offset="0.45" stop-color="#c0914a"/><stop offset="1" stop-color="#6f4d1f"/></radialGradient>
            <radialGradient id="cd-face" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#3a2619"/><stop offset="1" stop-color="#170e08"/></radialGradient>
            <radialGradient id="cd-cap" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff0c0"/><stop offset="0.5" stop-color="#cfa050"/><stop offset="1" stop-color="#6a481c"/></radialGradient>
            <radialGradient id="cd-screw" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#f3dca0"/><stop offset="1" stop-color="#7d5a26"/></radialGradient>
            <linearGradient id="cd-needle" x1="0" x2="1"><stop offset="0" stop-color="#8e6528"/><stop offset="0.5" stop-color="#f6dc9a"/><stop offset="1" stop-color="#8e6528"/></linearGradient>
          </defs>
          <circle r="97" fill="url(#cd-brass)"/>
          <circle r="94" fill="none" stroke="#4f3513" stroke-width="1.2" opacity="0.8"/>
          <circle r="88" fill="url(#cd-face)" stroke="#2a1b0a" stroke-width="2"/>
          ${screws}
          ${[0, 1, 2, 3].map((i) => `<path class="wedge" data-season="${i}" d="${wedge(i * 90 - 45, i * 90 + 45, 86)}" fill="${SEASON_TINT[i]}"/>`).join('')}
          ${ticks}
          <circle r="61" fill="none" stroke="#c9a15a" stroke-width="0.6" opacity="0.4"/>
          ${labels.map((l, i) => `<text class="lbl" data-season="${i}" x="${l.x}" y="${l.y}" text-anchor="middle">${l.t}</text>`).join('')}
          <g id="cd-needle" class="needle"><polygon points="0,-66 5.5,2 0,13 -5.5,2" fill="url(#cd-needle)" stroke="#3b2810" stroke-width="0.8"/><polygon points="0,-66 0,13 -5.5,2" fill="#000" opacity="0.18"/></g>
          <circle r="9.5" fill="url(#cd-cap)" stroke="#3b2810" stroke-width="0.8"/>
          <circle r="2.6" fill="#2a1b0a"/>
        </svg>
      </div>
      <div class="group years">
        <div class="cap">Anos da vila</div>
        <div class="seg lever" role="group" aria-label="Ano da vila">
          <span class="knob" aria-hidden="true"></span>
          <button type="button" data-year="1" aria-pressed="false"><span>Ano 1</span></button>
          <button type="button" data-year="3" aria-pressed="false"><span>Ano 3</span></button>
        </div>
      </div>
    </section>`;

  const q = <T extends Element>(s: string): T => root.querySelector(s) as T;
  const qa = <T extends Element>(s: string): T[] => [...root.querySelectorAll(s)] as T[];
  const needle = q<SVGGElement>('#cd-needle');
  const sub = q<HTMLElement>('#cd-sub');
  const lever = q<HTMLElement>('.lever');
  let ang = 0, curS = 0;
  const set = (season: number, hour: number, year: number): void => {
    const target = season * 90;
    ang += ((target - ang + 540) % 360) - 180;
    curS = season;
    needle.style.transform = `rotate(${ang}deg)`;
    qa<SVGElement>('[data-season]').forEach((e) => e.classList.toggle('on', Number(e.dataset.season) === season));
    qa<HTMLButtonElement>('[data-hour]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.hour) === hour)));
    qa<HTMLButtonElement>('[data-year]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.year) === year)));
    lever.dataset.pos = year === 3 ? 'r' : 'l';
    sub.textContent = `${SEASON_NAMES[season]} · ${HOUR_NAMES[hour]} · Ano ${year}`;
  };
  qa<SVGElement>('.wedge').forEach((e) => e.addEventListener('click', () => h.season(Number(e.dataset.season))));
  qa<SVGElement>('.lbl').forEach((e) => e.addEventListener('click', () => h.season(Number(e.dataset.season))));
  qa<HTMLButtonElement>('[data-hour]').forEach((b) => b.addEventListener('click', () => h.hour(Number(b.dataset.hour))));
  qa<HTMLButtonElement>('[data-year]').forEach((b) => b.addEventListener('click', () => h.year(Number(b.dataset.year) === 3 ? 3 : 1)));
  addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '4') h.season(Number(e.key) - 1);
    else if (e.key === 'ArrowRight') h.season((curS + 1) % 4);
    else if (e.key === 'ArrowLeft') h.season((curS + 3) % 4);
  });
  return { set };
}
