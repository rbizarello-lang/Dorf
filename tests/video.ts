// Testes do vídeo, da resolução dinâmica e do nível pela placa de vídeo (lógica pura, em Node).
// O MP4 é conferido por um leitor de caixas escrito aqui, independente do gravador.
import { DynRes, RES_STEPS } from '../src/render/dynres';
import { gpuName, tierForGpu } from '../src/render/gpuTier';
import { fitDist, planFilm } from '../src/video/film';
import { mp4Header, type Mp4Sample } from '../src/video/mp4';
import { resample, smooth, type Pose } from '../src/video/path';

let bad = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    bad++;
    console.log('  FALHA: ' + m);
  } else console.log('  ok: ' + m);
};

// ---------------------------------------------------------------- leitor de MP4 (oráculo)

interface Box {
  type: string;
  start: number;
  size: number;
  body: number;
  kids: Box[];
}
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf', 'edts']);

function readBoxes(b: Uint8Array, start: number, end: number): Box[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Box[] = [];
  let p = start;
  while (p + 8 <= end) {
    let size = v.getUint32(p);
    const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    let body = p + 8;
    if (size === 1) {
      size = v.getUint32(p + 8) * 2 ** 32 + v.getUint32(p + 12);
      body = p + 16;
    }
    const box: Box = { type, start: p, size, body, kids: [] };
    if (CONTAINERS.has(type)) box.kids = readBoxes(b, body, Math.min(end, p + size));
    // stsd: caixa cheia + contagem, depois a entrada visual (78 bytes de campos) com caixas filhas.
    if (type === 'stsd') {
      const entry = readBoxes(b, body + 8, p + size)[0];
      if (entry) {
        entry.kids = readBoxes(b, entry.body + 78, entry.start + entry.size);
        box.kids = [entry];
      }
    }
    out.push(box);
    if (size < 8) break;
    p += size;
  }
  return out;
}
const find = (list: Box[], path: string[]): Box | undefined => {
  let cur: Box | undefined;
  let kids = list;
  for (const t of path) {
    cur = kids.find((k) => k.type === t);
    if (!cur) return undefined;
    kids = cur.kids;
  }
  return cur;
};

console.log('MP4: H.264 com quadros B');
{
  // 8 quadros em ordem de decodificação I P B B P B B P, com os instantes de apresentação.
  const fps = 60;
  const us = 1e6 / fps;
  const order = [0, 3, 1, 2, 6, 4, 5, 7];
  const sizes = [5000, 800, 300, 310, 900, 280, 290, 700];
  const samples: Mp4Sample[] = order.map((f, i) => ({ size: sizes[i], key: i === 0, time: f * us }));
  const avcC = new Uint8Array([1, 0x64, 0, 0x34, 0xff, 0xe1, 0, 4, 0x67, 0x64, 0, 0x34, 1, 0, 4, 0x68, 0xee, 0x3c, 0x80]);
  const head = mp4Header({ codec: 'avc', width: 3840, height: 2160, fps, avcC }, samples);
  const file = new Uint8Array(head.length + sizes.reduce((a, b) => a + b, 0));
  file.set(head);
  const top = readBoxes(file, 0, file.length);
  const v = new DataView(file.buffer);
  ok(top.map((b) => b.type).join() === 'ftyp,moov,mdat', `caixas do topo: ${top.map((b) => b.type).join()}`);
  const mdat = top[2];
  ok(mdat.start + mdat.size === file.length, 'o mdat vai até o fim do arquivo');
  ok(mdat.body === head.length, 'os quadros começam logo depois do cabeçalho');
  const mvhd = find(top, ['moov', 'mvhd'])!;
  ok(v.getUint32(mvhd.body + 12) === fps * 1000 && v.getUint32(mvhd.body + 16) === 8 * 1000, 'mvhd: escala e duração (8 quadros)');
  const tkhd = find(top, ['moov', 'trak', 'tkhd'])!;
  ok(v.getUint32(tkhd.body + 76) === 3840 * 65536 && v.getUint32(tkhd.body + 80) === 2160 * 65536, 'tkhd: 3840×2160');
  const stbl = ['moov', 'trak', 'mdia', 'minf', 'stbl'];
  const entry = find(top, [...stbl, 'stsd', 'avc1']);
  ok(!!entry, 'stsd com avc1');
  const avcBox = entry?.kids.find((k) => k.type === 'avcC');
  ok(!!avcBox && avcBox.size === 8 + avcC.length && file.subarray(avcBox.body, avcBox.body + avcC.length).every((x, i) => x === avcC[i]), 'avcC copiado sem mudança');
  const stsz = find(top, [...stbl, 'stsz'])!;
  const n = v.getUint32(stsz.body + 8);
  const got = Array.from({ length: n }, (_, i) => v.getUint32(stsz.body + 12 + 4 * i));
  ok(n === 8 && got.join() === sizes.join(), 'stsz: os 8 tamanhos na ordem');
  const stco = find(top, [...stbl, 'stco'])!;
  ok(v.getUint32(stco.body + 8) === head.length, 'stco aponta para o começo dos quadros');
  const stss = find(top, [...stbl, 'stss'])!;
  ok(v.getUint32(stss.body + 4) === 1 && v.getUint32(stss.body + 8) === 1, 'stss: só o primeiro quadro é chave');
  // Apresentação = decodificação + deslocamento - atraso da lista de edição: tem que dar a ordem original.
  const ctts = find(top, [...stbl, 'ctts']);
  const elst = find(top, ['moov', 'trak', 'edts', 'elst']);
  ok(!!ctts && !!elst, 'quadros B: ctts e lista de edição presentes');
  if (ctts && elst) {
    const delay = v.getInt32(elst.body + 12);
    const pres = Array.from({ length: 8 }, (_, i) => (i * 1000 + v.getUint32(ctts.body + 12 + 8 * i) - delay) / 1000);
    ok(pres.join() === order.join(), `ordem de apresentação refeita: ${pres.join(' ')}`);
  }
}

console.log('MP4: VP9 sem reordenação');
{
  const samples: Mp4Sample[] = Array.from({ length: 120 }, (_, i) => ({ size: 100 + i, key: i % 60 === 0, time: (i * 1e6) / 60 }));
  const head = mp4Header({ codec: 'vp9', width: 1920, height: 1080, fps: 60, vp9: { profile: 0, level: 41, bitDepth: 8 } }, samples);
  const top = readBoxes(head, 0, head.length);
  const v = new DataView(head.buffer);
  const stbl = ['moov', 'trak', 'mdia', 'minf', 'stbl'];
  const vpcC = find(top, [...stbl, 'stsd', 'vp09'])?.kids.find((k) => k.type === 'vpcC');
  ok(!!vpcC && head[vpcC.body] === 1 && head[vpcC.body + 4] === 0 && head[vpcC.body + 5] === 41 && head[vpcC.body + 6] >> 4 === 8, 'vpcC versão 1, perfil 0, nível 4.1, 8 bits');
  ok(!find(top, [...stbl, 'ctts']) && !find(top, ['moov', 'trak', 'edts']), 'sem quadros B: nem ctts nem lista de edição');
  const stss = find(top, [...stbl, 'stss'])!;
  ok(v.getUint32(stss.body + 4) === 2 && v.getUint32(stss.body + 12) === 61, 'stss: quadros 1 e 61');
  const mdat = top.find((b) => b.type === 'mdat')!;
  ok(v.getUint32(mdat.start) === 8 + samples.reduce((a, s) => a + s.size, 0), 'tamanho do mdat = soma dos quadros + 8');
}

// ---------------------------------------------------------------- resolução dinâmica

console.log('Resolução dinâmica');
{
  const d = new DynRes(1 / 38, 1 / 50);
  let now = 0;
  const run = (dt: number, frames: number) => {
    const evs: string[] = [];
    for (let i = 0; i < frames; i++) {
      now += dt;
      const e = d.push(dt, now);
      if (e) evs.push(e);
    }
    return evs;
  };
  // A primeira janela é ignorada (carência), depois desce um degrau por janela, também com carência.
  let evs = run(0.04, 40 * 12);
  ok(evs.slice(0, RES_STEPS.length - 1).every((e) => e === 'down') && d.step === RES_STEPS.length - 1, `quadros de 40 ms: desce até ${RES_STEPS[d.step]} (${evs.join(' ')})`);
  ok(evs.includes('floor'), 'no menor degrau e ainda lento: pede para descer o nível');
  d.reset();
  ok(d.step === 0 && d.scale === 1, 'reset volta à resolução cheia');
  // Meio-termo (22 ms): fica onde está.
  evs = run(0.022, 40 * 6);
  ok(evs.length === 0 && d.step === 0, 'quadros de 22 ms em resolução cheia: nada muda');
  // Desce dois degraus, depois folga: sobe um por vez.
  d.reset();
  run(0.04, 40 * 5);
  const low = d.step;
  evs = run(0.012, 40 * 8);
  ok(low >= 2 && d.step === 0 && evs.every((e) => e === 'up'), `com folga volta ao topo (${evs.join(' ')})`);
  // Oscilação: sobe e logo fica lento → o degrau é proibido por 60 s, e por 120 s na segunda vez.
  const when = (dt: number, seconds: number, ev: string) => {
    for (const end = now + seconds; now < end; ) {
      now += dt;
      if (d.push(dt, now) === ev) return now;
    }
    return NaN;
  };
  d.reset();
  run(0.04, 40 * 3); // desce para o degrau 1
  ok(d.step === 1, 'um degrau abaixo');
  when(0.012, 5, 'up');
  ok(d.step === 0, 'sobe com folga');
  const t0 = when(0.04, 5, 'down');
  ok(d.step === 1, 'lento logo depois de subir: desce de novo');
  const up0 = when(0.012, 120, 'up');
  ok(up0 - t0 >= 59.9 && up0 - t0 < 61, `o degrau que falhou fica proibido por 60 s (${(up0 - t0).toFixed(1)} s)`);
  const t1 = when(0.04, 5, 'down');
  const up1 = when(0.012, 300, 'up');
  ok(up1 - t1 >= 119.9 && up1 - t1 < 121, `segunda falha: proibido por 120 s (${(up1 - t1).toFixed(1)} s)`);
  // Lento sem ter subido antes (a cena ficou pesada): desce sem proibir nada.
  d.reset();
  const t2 = when(0.04, 5, 'down');
  const up2 = when(0.012, 5, 'up');
  ok(up2 - t2 < 1.5 && d.step === 0, 'uma descida comum não proíbe o degrau de cima');
}

// ---------------------------------------------------------------- nível pela placa

console.log('Nível pela placa de vídeo');
{
  const cases: [string, string | null, string][] = [
    ['ANGLE (AMD, AMD Radeon RX 580 2048SP (0x00006FDF) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'high', 'Radeon RX 580 2048SP'],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ultra', 'GeForce RTX 3060'],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 (0x00001F08) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'high', 'GeForce RTX 2060'],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Laptop GPU (0x00002717) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ultra', 'GeForce RTX 4090 Laptop GPU'],
    ['ANGLE (NVIDIA, NVIDIA GeForce GTX 1070 (0x00001B81) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'high', 'GeForce GTX 1070'],
    ['ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti (0x00001C82) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'medium', 'GeForce GTX 1050 Ti'],
    ['ANGLE (AMD, AMD Radeon RX 6700 XT (0x000073DF) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ultra', 'Radeon RX 6700 XT'],
    ['ANGLE (AMD, AMD Radeon RX 9070 XT (0x00007550) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ultra', 'Radeon RX 9070 XT'],
    ['ANGLE (AMD, AMD Radeon RX 5500 XT (0x00007340) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'high', 'Radeon RX 5500 XT'],
    ['ANGLE (AMD, Radeon RX Vega (0x0000687F) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'high', 'Radeon RX Vega'],
    ['ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'medium', 'Radeon Graphics'],
    ['ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'low', 'UHD Graphics 620'],
    ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'medium', 'Iris Xe Graphics'],
    ['ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ultra', 'Arc A770 Graphics'],
    ['ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)', 'ultra', 'Apple M2 Pro'],
    ['ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)', 'high', 'Apple M1'],
    ['Apple GPU', 'medium', 'Apple GPU'],
    ['Adreno (TM) 740', 'medium', 'Adreno 740'],
    ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', 'low', 'SwiftShader'],
  ];
  for (const [renderer, tier, name] of cases) {
    const t = tierForGpu({ renderer });
    const n = gpuName({ renderer });
    ok(t === tier && n === name, `${name}: ${t} (esperado ${tier})${n === name ? '' : `, nome "${n}"`}`);
  }
  ok(tierForGpu({ vendor: 'amd', architecture: 'gcn-4' }) === 'high', 'só WebGPU: AMD GCN 4 na Alta');
  ok(tierForGpu({ vendor: 'nvidia', architecture: 'ampere' }) === 'ultra', 'só WebGPU: NVIDIA Ampere no Ultra');
  ok(tierForGpu({}) === null && gpuName({ vendor: 'amd', architecture: 'rdna-3' }) === 'AMD rdna-3', 'sem nada: sem palpite; nome pelo fabricante');
}

// ---------------------------------------------------------------- caminho da câmera e filme

console.log('Caminho da câmera');
{
  const times = [0, 1, 2];
  const poses: Pose[] = [
    { x: 0, z: 0, dist: 10, yaw: 0 },
    { x: 6, z: -3, dist: 20, yaw: 1 },
    { x: 6, z: -3, dist: 20, yaw: 1 },
  ];
  const r = resample(times, poses, 60, 2);
  ok(r.length === 120, '2 s a 60 quadros = 120 poses');
  ok(Math.abs(r[30].x - 3) < 1e-9 && Math.abs(r[30].dist - Math.sqrt(200)) < 1e-9, 'meio do trecho: posição linear, zoom geométrico');
  const flat = smooth(Array.from({ length: 50 }, () => ({ x: 2, z: 3, dist: 9, yaw: 0.5 })), 10);
  ok(flat.every((p) => Math.abs(p.x - 2) < 1e-9 && Math.abs(p.dist - 9) < 1e-9), 'suavizar uma câmera parada não muda nada');
  const ramp = Array.from({ length: 200 }, (_, i) => ({ x: i, z: 0, dist: 10, yaw: 0 }));
  const sm = smooth(ramp, 8);
  ok(sm.slice(30, 170).every((p, i) => Math.abs(p.x - (i + 30)) < 1e-6), 'longe das pontas, a suavização não atrasa um movimento constante');
  const step = Array.from({ length: 101 }, (_, i) => ({ x: i < 50 ? 0 : i > 50 ? 1 : 0.5, z: 0, dist: 10, yaw: 0 }));
  const ss = smooth(step, 6);
  ok(Math.abs(ss[50].x - 0.5) < 1e-9 && Math.abs(ss[40].x + ss[60].x - 1) < 1e-9, 'filtro simétrico: um degrau fica centrado (sem atraso)');
  const tilted = resample([0, 1], [{ x: 0, z: 0, dist: 10, yaw: 0, tilt: -0.2 }, { x: 0, z: 0, dist: 10, yaw: 0, tilt: 0.2 }], 60, 1);
  ok(Math.abs(tilted[30].tilt! - 0) < 1e-9 && Math.abs(tilted[15].tilt! + 0.1) < 1e-9, 'a inclinação gravada anda linear entre as poses');
  ok(Math.abs(resample([0, 1], [{ x: 0, z: 0, dist: 10, yaw: 0 }, { x: 0, z: 0, dist: 10, yaw: 0, tilt: 0.4 }], 60, 1)[30].tilt! - 0.2) < 1e-9, 'pose sem inclinação (gravação antiga) conta como 0');
  ok(smooth(Array.from({ length: 50 }, () => ({ x: 0, z: 0, dist: 9, yaw: 0, tilt: 0.3 })), 10).every((p) => Math.abs(p.tilt! - 0.3) < 1e-9), 'suavizar não muda uma inclinação parada');
}

console.log('Filme da partida');
{
  const moves: [number, number, number][] = [];
  for (let i = 1; i <= 60; i++) moves.push([i % 7, Math.floor(i / 7), i % 6]);
  const f = planFilm(moves, 0.5);
  ok(f.placeAt.length === 60 && f.placeAt.every((t, i) => i === 0 || t > f.placeAt[i - 1]), 'uma jogada por vez, em ordem');
  ok(f.duration > f.placeAt[59] + 3 && f.duration < 140, `duração ${f.duration.toFixed(1)} s, com o fim girando no mapa pronto`);
  ok(f.times.length === f.poses.length && f.times.every((t, i) => i === 0 || t >= f.times[i - 1]), 'poses-chave em ordem de tempo');
  ok(f.poses.every((p) => p.dist >= 7 * 0.8 - 1e-9 && p.dist <= 46), 'distâncias dentro do alcance da câmera');
  ok(fitDist(2) === 9.2 && fitDist(100) === 46, 'enquadramento: 9,2 para o mapa pequeno, 46 no máximo');
  const long = planFilm(Array.from({ length: 2000 }, (_, i) => [i, 0, 0] as [number, number, number]), 0);
  ok(long.duration < 220, `partida longa: as peças caem mais rápido (${long.duration.toFixed(0)} s)`);
}

if (bad) {
  console.log(`\n${bad} falha(s)`);
  process.exit(1);
}
console.log('\nVídeo, resolução dinâmica e placas: tudo certo');
