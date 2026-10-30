// Caixa de vidro com moldura de latão, base de nogueira, plaquinha gravada e a mesa sob a luz.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from './rng';

export const GLASS_HALF = 7.3;
export const GLASS_TOP = 5.1;
export const BASE_TOP = -2;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}
function tex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function walnutTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  const r = mulberry32(5);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#4b2c1b'); grad.addColorStop(0.5, '#583420'); grad.addColorStop(1, '#43271a');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 170; i++) {
    const y0 = r() * 512, amp = 2 + r() * 9, f = 0.004 + r() * 0.012, ph = r() * 6;
    g.strokeStyle = r() < 0.55 ? `rgba(24,12,6,${0.1 + r() * 0.22})` : `rgba(150,92,52,${0.05 + r() * 0.12})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    for (let x = 0; x <= 512; x += 8) {
      const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph * 2) * amp * 0.25;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function plateTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 200);
  const grad = g.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, '#d6ab5c'); grad.addColorStop(0.45, '#b98c3f'); grad.addColorStop(1, '#8e6828');
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 200);
  const r = mulberry32(9);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,236,190,${r() * 0.07})`;
    g.fillRect(0, r() * 200, 1024, 1);
  }
  g.strokeStyle = 'rgba(70,44,12,0.85)'; g.lineWidth = 3; g.strokeRect(16, 16, 992, 168);
  g.strokeStyle = 'rgba(255,230,170,0.5)'; g.lineWidth = 1.5; g.strokeRect(22, 22, 980, 156);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 62px "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif';
  g.fillStyle = 'rgba(255,236,190,0.55)'; g.fillText('CIDADE DAS QUATRO ESTAÇÕES', 513, 84);
  g.fillStyle = '#3a2410'; g.fillText('CIDADE DAS QUATRO ESTAÇÕES', 512, 82);
  g.font = 'italic 34px "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif';
  g.fillStyle = 'rgba(255,236,190,0.5)'; g.fillText('um ano, em miniatura', 513, 143);
  g.fillStyle = '#4a2f14'; g.fillText('um ano, em miniatura', 512, 141);
  return tex(c);
}

export function glowTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return tex(c, false);
}

function tableTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,196,120,0.5)'); gr.addColorStop(0.35, 'rgba(190,120,60,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return tex(c);
}

export function mistTexture(seed: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const r = mulberry32(seed);
  for (let i = 0; i < 46; i++) {
    const x = 40 + r() * 176, y = 40 + r() * 176, rad = 28 + r() * 42;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,255,255,${0.1 + r() * 0.14})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  // máscara radial: some nas bordas
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.7, 'rgba(0,0,0,0.9)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, 256, 256);
  return tex(c);
}

export interface Frame { group: THREE.Group; glass: THREE.Mesh; brass: THREE.Material; wood: THREE.Material }

export function buildFrame(): Frame {
  const group = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9964a, metalness: 1, roughness: 0.3, envMapIntensity: 1.5 });
  const wood = new THREE.MeshStandardMaterial({ map: walnutTexture(), roughness: 0.55, metalness: 0, envMapIntensity: 0.7 });
  const H = GLASS_HALF, T = GLASS_TOP, B = BASE_TOP, bar = 0.17;

  // vidro: só as faces de fora, uma única malha
  const glassGeo = new THREE.BoxGeometry(2 * H, T - B, 2 * H);
  glassGeo.translate(0, (T + B) / 2, 0);
  const glass = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({
    color: 0xeaf4ff, transparent: true, opacity: 0.05, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, depthWrite: false,
  }));
  glass.renderOrder = 5;
  group.add(glass);

  // moldura de latão (uma malha só)
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number): void => { g.translate(x, y, z); parts.push(g.index ? g.toNonIndexed() : g); };
  const len = 2 * H + bar;
  for (const y of [B + 0.06, T]) {
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(len, bar, bar), 0, y, s * H);
      add(new THREE.BoxGeometry(bar, bar, len), s * H, y, 0);
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(bar * 1.15, T - B + 0.1, bar * 1.15), sx * H, (T + B) / 2 + 0.03, sz * H);
    add(new THREE.SphereGeometry(0.2, 12, 10), sx * H, T + 0.16, sz * H);
    add(new THREE.CylinderGeometry(0.15, 0.2, 0.2, 10), sx * H, B + 0.1, sz * H);
  }
  // varetas finas no meio de cada face (como vitrine antiga)
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.07, T - B, 0.07), 0, (T + B) / 2, s * H);
    add(new THREE.BoxGeometry(0.07, T - B, 0.07), s * H, (T + B) / 2, 0);
  }
  // tampa: aro interno e puxador
  add(new THREE.TorusGeometry(0.32, 0.05, 8, 20).rotateX(Math.PI / 2), 0, T + 0.08, 0);
  add(new THREE.SphereGeometry(0.17, 12, 10), 0, T + 0.2, 0);
  add(new THREE.CylinderGeometry(0.06, 0.1, 0.12, 8), 0, T + 0.04, 0);
  const frameMesh = new THREE.Mesh(mergeGeometries(parts, false)!, brass);
  frameMesh.castShadow = false;
  group.add(frameMesh);

  // base de nogueira: platina, corpo e filete de latão
  const baseMain = new THREE.Mesh(new RoundedBoxGeometry(2 * H + 1.5, 0.95, 2 * H + 1.5, 4, 0.14), wood);
  baseMain.position.set(0, B - 0.475, 0);
  baseMain.receiveShadow = true;
  group.add(baseMain);
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(2 * H + 2.0, 0.42, 2 * H + 2.0, 4, 0.12), wood);
  plinth.position.set(0, B - 1.16, 0);
  group.add(plinth);
  const inlay = new THREE.Mesh(new THREE.BoxGeometry(2 * H + 0.6, 0.04, 2 * H + 0.6), brass);
  inlay.position.set(0, B + 0.005, 0);
  group.add(inlay);
  const feet = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.2, 10), brass);
    f.position.set(sx * (H + 0.6), B - 1.47, sz * (H + 0.6));
    feet.add(f);
  }
  group.add(feet);

  // plaquinha na frente (+z)
  const plate = new THREE.Mesh(new RoundedBoxGeometry(6.4, 0.62, 0.1, 2, 0.04), new THREE.MeshStandardMaterial({ map: plateTexture(), metalness: 0.85, roughness: 0.35, envMapIntensity: 1.2 }));
  plate.position.set(0, B - 0.47, H + 0.75 + 0.03);
  group.add(plate);

  // a mesa, iluminada por um halo quente
  const table = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshBasicMaterial({ map: tableTexture(), transparent: true, depthWrite: false }));
  table.rotation.x = -Math.PI / 2;
  table.position.y = B - 1.6;
  group.add(table);

  return { group, glass, brass, wood };
}
