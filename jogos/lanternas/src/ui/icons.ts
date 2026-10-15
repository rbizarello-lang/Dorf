// Ícones em SVG inline (sem arquivos, sem CDN). Cores da paleta do jogo.
const svg = (vb: string, body: string, cls = ''): string => `<svg class="ic ${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICON = {
  oil: svg('0 0 24 24', '<path d="M12 2.5c3.2 4.2 6 7.4 6 11a6 6 0 0 1-12 0c0-3.6 2.8-6.8 6-11z" fill="#e89a2e"/><path d="M9.2 14.2a3 3 0 0 0 2.2 3.1" stroke="#fff3cf" stroke-width="1.6" fill="none" stroke-linecap="round"/>', 'oil'),
  food: svg('0 0 24 24', '<path d="M12 21V8" stroke="#8a6a2a" stroke-width="1.6" stroke-linecap="round"/><g fill="#e4b341"><ellipse cx="9" cy="8" rx="2" ry="3.2" transform="rotate(-24 9 8)"/><ellipse cx="15" cy="8" rx="2" ry="3.2" transform="rotate(24 15 8)"/><ellipse cx="9" cy="13" rx="2" ry="3.2" transform="rotate(-24 9 13)"/><ellipse cx="15" cy="13" rx="2" ry="3.2" transform="rotate(24 15 13)"/><ellipse cx="12" cy="4.5" rx="1.8" ry="3"/></g>', 'food'),
  people: svg('0 0 24 24', '<path d="M3 11.5 12 4l9 7.5" fill="none" stroke="#c4553a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10.5V20h13v-9.5" fill="#f5e8c9" stroke="#8c6a45" stroke-width="1.4" stroke-linejoin="round"/><rect x="10" y="14" width="4" height="6" fill="#6b4a32"/><rect x="7" y="12.5" width="2.2" height="2.2" fill="#ffc15e"/>', 'people'),
  sun: svg('0 0 24 24', '<circle cx="12" cy="12" r="5" fill="#ffc447"/><g stroke="#ffb02e" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></g>', 'sun'),
  moon: svg('0 0 24 24', '<path d="M19 14.5A8 8 0 0 1 9.5 5 8 8 0 1 0 19 14.5z" fill="#c9d6ff"/>', 'moon'),
  star: svg('0 0 24 24', '<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="#ffc447" stroke="#d9941d" stroke-width="1" stroke-linejoin="round"/>', 'star'),
  check: svg('0 0 24 24', '<path d="m5 12.5 4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>', 'check'),
  flag: svg('0 0 24 24', '<path d="M6 21V3" stroke="#6b4a32" stroke-width="2" stroke-linecap="round"/><path d="M6 4h12l-3 4 3 4H6z" fill="#ffb84a"/>', 'flag'),
  windFull: svg('0 0 24 24', '<circle cx="12" cy="12" r="10.5" fill="#4fb0bd"/><g stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"><path d="M5 9.5h9a2.5 2.5 0 1 0-2.5-2.5"/><path d="M5 13h12.5a2.5 2.5 0 1 1-2.5 2.5"/><path d="M5 16.5h6"/></g>', 'wind'),
  windEmpty: svg('0 0 24 24', '<circle cx="12" cy="12" r="9.6" fill="none" stroke="#9aa6b5" stroke-width="1.6" stroke-dasharray="3 2.6"/><g stroke="#b9c0cc" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M5.5 9.5h8.5a2.3 2.3 0 1 0-2.3-2.3"/><path d="M5.5 13h11.5a2.3 2.3 0 1 1-2.3 2.3"/></g>', 'wind off'),
  rotate: svg('0 0 24 24', '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 3v4h-4M5.5 21v-4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', 'rot'),
};

/** Arte de cada carta (48x48), com o mesmo vocabulário de formas do diorama. */
export const CARD_ART: string[] = [
  // Casa
  svg('0 0 64 64', '<ellipse cx="32" cy="55" rx="24" ry="5" fill="#000" opacity=".12"/><rect x="14" y="30" width="36" height="24" rx="2" fill="#f5e8c9" stroke="#b79a69" stroke-width="1.5"/><path d="M8 33 32 12l24 21z" fill="#dd6b4d" stroke="#a9412c" stroke-width="1.5" stroke-linejoin="round"/><rect x="42" y="12" width="6" height="12" fill="#9c9382"/><rect x="27" y="40" width="10" height="14" rx="1.5" fill="#6b4a32"/><rect x="17" y="37" width="7" height="7" rx="1" fill="#ffc15e" stroke="#8a5d3b" stroke-width="1.2"/><rect x="40" y="37" width="7" height="7" rx="1" fill="#ffc15e" stroke="#8a5d3b" stroke-width="1.2"/>', 'art'),
  // Campo
  svg('0 0 64 64', '<path d="M32 8 56 22v22L32 58 8 44V22z" fill="#8b6a47"/><path d="M32 8 56 22v22L32 58 8 44V22z" fill="none" stroke="#6a4d34" stroke-width="2" stroke-linejoin="round"/><g stroke-linecap="round" stroke-width="5"><path d="M15 27l20-12" stroke="#e8c14d"/><path d="M13 35l32-19" stroke="#c9a238"/><path d="M13 43 49 22" stroke="#e8c14d"/><path d="M20 49l32-19" stroke="#c9a238"/><path d="M32 54l20-12" stroke="#e8c14d"/></g>', 'art'),
  // Oliveiral
  svg('0 0 64 64', '<ellipse cx="32" cy="56" rx="22" ry="4.5" fill="#000" opacity=".12"/><path d="M30 56c1-10-1-16 2-24" stroke="#4d3326" stroke-width="5" fill="none" stroke-linecap="round"/><g fill="#a9bf9c" stroke="#7e977a" stroke-width="1.4"><ellipse cx="22" cy="26" rx="14" ry="9"/><ellipse cx="42" cy="24" rx="14" ry="9"/><ellipse cx="32" cy="15" rx="13" ry="8"/></g><g fill="#3d4a2e"><ellipse cx="22" cy="28" rx="2.2" ry="3"/><ellipse cx="40" cy="27" rx="2.2" ry="3"/><ellipse cx="31" cy="19" rx="2.2" ry="3"/><ellipse cx="48" cy="22" rx="2.2" ry="3"/></g>', 'art'),
  // Lanterna
  svg('0 0 64 64', '<circle cx="32" cy="22" r="20" fill="#ffb84a" opacity=".28"/><circle cx="32" cy="22" r="12" fill="#ffb84a" opacity=".3"/><rect x="30" y="30" width="4" height="26" rx="1.5" fill="#4d3326"/><rect x="24" y="54" width="16" height="4" rx="1.5" fill="#7d7b82"/><path d="M22 17 32 8l10 9z" fill="#2c4a55"/><rect x="24" y="16" width="16" height="16" rx="5" fill="#ffe08a" stroke="#d9941d" stroke-width="1.6"/><path d="M24 24h16" stroke="#d9941d" stroke-width="1.2"/>', 'art'),
  // Cais
  svg('0 0 64 64', '<path d="M0 40q8-5 16 0t16 0 16 0 16 0v24H0z" fill="#3fb0bd"/><path d="M0 46q8-5 16 0t16 0 16 0 16 0v18H0z" fill="#2f95a8"/><g fill="#b48455" stroke="#6b4a32" stroke-width="1.2"><rect x="6" y="30" width="46" height="7" rx="1"/></g><g stroke="#6b4a32" stroke-width="1"><path d="M16 30v7M26 30v7M36 30v7M46 30v7"/></g><g fill="#4d3326"><rect x="9" y="37" width="4" height="12"/><rect x="45" y="37" width="4" height="12"/></g><path d="M44 44h14l-3 7H47z" fill="#f5e8c9" stroke="#dd6b4d" stroke-width="1.5"/><path d="M50 44V32l7 11z" fill="#fff3d6" stroke="#b79a69" stroke-width="1"/>', 'art'),
];

export const CARD_TONE = ['#f6dcc0', '#f1e2a6', '#d8e6c8', '#ffe6b0', '#c8e6ea'];
