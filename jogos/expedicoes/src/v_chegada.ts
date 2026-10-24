// Chegada: a mesa depois de uma ausência. O mapa com a caravana parada na porta da capital, três cartas lacradas,
// uma carta aberta com dois botões de latão e o bilhete "Desde a sua última visita…".
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MATS, type Stage, type Env } from './stage';
import { buildMap } from './v_mapa';
import { canvas, tex } from './tex';
import { SCRIPT } from './mapart';
import { mulberry32 } from './rng';

const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif';
const INK = '#3a2412';

function paper(g: CanvasRenderingContext2D, w: number, h: number, base: string, seed: number): void {
  const r = mulberry32(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = r() * w, y = r() * h, rad = 30 + r() * 110;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, r() < 0.6 ? `rgba(150,110,50,${0.03 + r() * 0.05})` : `rgba(255,248,220,${0.05 + r() * 0.07})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,55,15,0.35)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
}

/** Escrita à mão: cada letra com um leve desvio de linha, giro e tamanho, para não parecer fonte de computador. */
function hand(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, seed: number, align: 'left' | 'center' = 'left'): void {
  const r = mulberry32(seed);
  g.font = `italic ${size}px ${SCRIPT}`;
  const widths = [...text].map((ch) => g.measureText(ch).width * 0.96);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? x - total / 2 : x;
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  [...text].forEach((ch, i) => {
    g.save();
    g.translate(cx, y + (r() - 0.5) * size * 0.08 + Math.sin(cx * 0.01) * size * 0.04);
    g.rotate((r() - 0.5) * 0.1 - 0.04);
    g.font = `italic ${Math.round(size * (0.94 + r() * 0.12))}px ${SCRIPT}`;
    g.fillText(ch, 0, 0);
    g.restore();
    cx += widths[i];
  });
}

function envelopeTex(base: string, name: string, line: string, seed: number): THREE.CanvasTexture {
  const [c, g] = canvas(640, 420);
  paper(g, 640, 420, base, seed);
  // abas do envelope
  g.strokeStyle = 'rgba(70,45,20,0.45)'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(8, 8); g.lineTo(320, 200); g.lineTo(632, 8); g.stroke();
  g.beginPath(); g.moveTo(8, 412); g.lineTo(240, 230); g.moveTo(632, 412); g.lineTo(400, 230); g.stroke();
  g.strokeStyle = 'rgba(70,45,20,0.7)'; g.lineWidth = 4; g.strokeRect(5, 5, 630, 410);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = INK; hand(g, name, 320, 306, 80, name.length * 7, 'center');
  g.font = `italic 600 24px ${SERIF}`; g.fillStyle = 'rgba(58,36,18,0.85)'; g.fillText(line, 320, 360);
  return tex(c);
}

function openLetterTex(): THREE.CanvasTexture {
  const [c, g] = canvas(720, 920);
  paper(g, 720, 920, '#f1e3bf', 7);
  // dobras
  g.strokeStyle = 'rgba(120,85,40,0.25)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 306); g.lineTo(720, 306); g.moveTo(0, 612); g.lineTo(720, 612); g.stroke();
  g.strokeStyle = 'rgba(255,250,230,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 309); g.lineTo(720, 309); g.moveTo(0, 615); g.lineTo(720, 615); g.stroke();
  // selo de mina e rabisco de picareta
  g.save(); g.translate(600, 110); g.rotate(-0.15);
  g.strokeStyle = 'rgba(52,86,126,0.75)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 52, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 44, 0, 7); g.stroke();
  g.fillStyle = 'rgba(52,86,126,0.8)'; g.font = `700 13px ${SERIF}`; g.textAlign = 'center'; g.fillText('MINA DA SERRA', 0, 4);
  g.beginPath(); g.moveTo(-18, -22); g.lineTo(0, -34); g.lineTo(18, -22); g.stroke();
  g.restore();
  g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const lines = ['Senhor,', 'na serra acharam uma', 'veia de prata. Se mandar', 'gente antes da neve,', 'levantamos um posto novo.', 'Fico no aguardo.'];
  lines.forEach((l, i) => hand(g, l, 64 + (i === 0 ? 0 : 18), 190 + i * 96, 60, 40 + i));
  hand(g, 'Tobias', 430, 830, 78, 90);
  // filete de tinta e uma mancha
  g.strokeStyle = 'rgba(58,36,18,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(420, 850); g.quadraticCurveTo(520, 870, 640, 846); g.stroke();
  const gr = g.createRadialGradient(150, 780, 0, 150, 780, 30); gr.addColorStop(0, 'rgba(40,25,10,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(100, 730, 100, 100);
  return tex(c);
}

function noteTex(): THREE.CanvasTexture {
  const [c, g] = canvas(640, 740);
  paper(g, 640, 740, '#efe1bb', 13);
  g.strokeStyle = 'rgba(80,110,150,0.22)'; g.lineWidth = 2;
  for (let y = 190; y < 720; y += 62) { g.beginPath(); g.moveTo(40, y); g.lineTo(600, y); g.stroke(); }
  g.strokeStyle = 'rgba(160,60,40,0.35)'; g.beginPath(); g.moveTo(84, 120); g.lineTo(84, 720); g.stroke();
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.fillStyle = '#5a1c10'; hand(g, 'Desde a sua', 100, 100, 62, 71); hand(g, 'última visita…', 100, 160, 62, 72);
  g.fillStyle = INK;   const L = [['A caravana do sal chegou', 'à capital'], ['O bairro dos pescadores', 'ganhou uma praça'], ['Uma garça fez ninho', 'no posto do brejo']];
  L.forEach(([a, b], i) => {
    const y = 250 + i * 150;
    g.fillStyle = '#9a2a18'; g.beginPath(); g.arc(62, y - 10, 9, 0, 7); g.fill();
    g.fillStyle = INK; hand(g, a, 100, y, 40, 100 + i); hand(g, b, 100, y + 50, 40, 110 + i);
  });
  return tex(c);
}

function buttonTex(label: string, primary: boolean): THREE.CanvasTexture {
  const [c, g] = canvas(520, 170);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 50px ${SERIF}`;
  g.fillStyle = 'rgba(255,236,190,0.6)'; g.fillText(label, 261, 88);
  g.fillStyle = primary ? '#3a1d08' : '#4a2c10'; g.fillText(label, 260, 86);
  return tex(c);
}

export function buildChegada(S: Stage): void {
  const r = mulberry32(5);
  const K = 1;
  buildMap(S, { x: -4.6, z: 0.1, s: 0.5, arrival: true });
  S.at(0, 0, 0, 0, 1);
  const root = new THREE.Group();
  root.scale.setScalar(K);
  S.group.add(root);

  const flat = (w: number, d: number, t: number, map: THREE.Texture, x: number, z: number, rot: number, y = 0.02, _side?: THREE.Color): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
    m.position.set(x, y + t / 2, z); m.rotation.y = rot; m.castShadow = true; m.receiveShadow = true;
    root.add(m);
    return m;
  };
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9964a, metalness: 1, roughness: 0.3, envMapIntensity: 1.5 });

  // cartas lacradas
  const seal = (x: number, y: number, z: number, col: number): void => {
    const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.1 });
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.07, 18), m);
    a.position.set(x, y + 0.04, z);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 14), new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.6), roughness: 0.4 }));
    b.position.set(x, y + 0.085, z);
    const dr = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), m); dr.scale.set(1, 0.5, 1); dr.position.set(x + 0.17, y + 0.03, z + 0.16);
    root.add(a, b);
    void dr;
  };
  const env: [string, string, string, string, number, number, number, number][] = [
    ['#cdd8ad', 'Rosa', 'Da barqueira Rosa, Brejo das Garças', '', 6.5, -3.2, 0.1, 0x4f7a3a],
    ['#c1cbdb', 'Tobias', 'Do mestre Tobias, Mina da Serra', '', 9.0, -3.5, -0.07, 0x34567e],
    ['#f2e4bd', 'Inês', 'Da faroleira Inês, Costa do Lume', '', 7.8, -1.3, 0.05, 0xd0573a],
  ];
  env.forEach(([base, name, line, , x, z, rot, col], i) => {
    flat(2.4, 1.58, 0.05, envelopeTex(base, name, line, 30 + i), x, z, rot, 0.02, new THREE.Color(base).multiplyScalar(0.9));
    seal(x - Math.sin(rot) * 0.03, 0.07, z + 0.02, col);
  });
  // carta aberta (a de Tobias) e o bilhete
  flat(4.1, 5.2, 0.035, openLetterTex(), 2.8, 0.2, -0.05);
  flat(3.3, 3.8, 0.035, noteTex(), 8.7, 2.1, -0.06, 0.02);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), brass); pin.position.set(8.65, 0.3, 0.3);  root.add(pin);
  // botões de latão
  [['Enviar caravana', true, 5.9, 1.9], ['Guardar carta', false, 5.9, 3.45]].forEach(([label, prim, x, z]) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(3.0, 0.3, 1.1, 4, 0.16), new THREE.MeshStandardMaterial({ color: prim ? 0xe0b863 : 0xc9964a, metalness: 1, roughness: 0.32, envMapIntensity: 1.5 }));
    b.position.set(x as number, 0.17, z as number); b.rotation.y = -0.03; b.receiveShadow = true; root.add(b);
    const t = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.78), new THREE.MeshBasicMaterial({ map: buttonTex(label as string, prim as boolean), transparent: true, depthWrite: false, toneMapped: false }));
    t.rotation.x = -Math.PI / 2; t.rotation.z = 0.03; t.position.set(x as number, 0.335, z as number); root.add(t);
  });
  // tinteiro com pena
  const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.4, 16), brass); ink.position.set(2.0, 0.2, -3.7); 
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 14), new THREE.MeshStandardMaterial({ color: 0x120a06, roughness: 0.2 })); cap.position.set(2.0, 0.41, -3.7);
  const quill = new THREE.Mesh(new THREE.ConeGeometry(0.06, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.9 }));
  quill.position.set(2.7, 1.05, -3.7); quill.rotation.z = -0.9; quill.rotation.x = 0.1; quill.castShadow = true;
  root.add(ink, quill);
  void cap;
  // vela: luz quente na mesa
  const cx = 10.7, cz = -0.3;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.16, 16), brass); stick.position.set(cx, 0.08, cz);
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.9, 14), new THREE.MeshStandardMaterial({ color: 0xf4ead0, roughness: 0.7 })); wax.position.set(cx, 1.15, cz); wax.castShadow = true;
  root.add(stick, wax);
  const flame = S.put('lantern', cx * K, 1.72 * K, cz * K, 0, 2.2 * K);
  const halo = S.glow(cx * K, 1.75 * K, cz * K, 3.6 * K, 0xffb75a, 1.5);
  void halo; void r;
  S.glowMin = 0.5;
  S.anims.push((e: Env) => {
    flame.by = 2.2 * K * (1.2 + 0.2 * Math.sin(e.t * 9)); flame.bx = flame.bz = 1.9 * K; S.pools.get('lantern')!.dirty = true;
    void MATS;
  });
}
