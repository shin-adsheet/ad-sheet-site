// 架空の車「HINATA」の縦型動画（9:16）を1コマずつ描く
// 文字は車の上に重ねない。装飾は車体の横幅の内側に塗らない。
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCar, setCarColor, rollWheels, makeShadow, COLORS } from './car.js';

const FPS = 30;
const W = 1080, H = 1920, SAFE_T = 285, SAFE_B = 1635;
const out = document.getElementById('out');
const c = out.getContext('2d');

const P = {
  cream: '#fbf6ec', paper: '#fffdf8', ink: '#23332d', ink2: '#3a4b44', gray: '#6f7d77', line: '#e6ddcc',
  mint: '#5fae94', mintD: '#3c8770', mintL: '#dcefe6', sun: '#f2c14e', sunL: '#fbe9b5', sky: '#8db6dc', coral: '#ee8c76', white: '#ffffff'
};

// ---------------------------------------------------------------- 3D
const GW = 1080, GH = 820;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(GW, GH);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.setClearColor(0x000000, 0);
renderer.domElement.id = 'gl';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
scene.environmentIntensity = 0.9;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f86, 0.55));
const key = new THREE.DirectionalLight(0xfff6e8, 1.7);
key.position.set(4, 7, 5);
scene.add(key);
const rimL = new THREE.DirectionalLight(0xffffff, 0.55);
rimL.position.set(-5, 3, -4);
scene.add(rimL);
const car = buildCar('mint');
scene.add(car);
const shadow = makeShadow(0.55);
car.add(shadow);
const camera = new THREE.PerspectiveCamera(28, GW / GH, 0.1, 300);
const target = new THREE.Vector3();
function view(o = {}) {
  const az = (o.az ?? 30) * Math.PI / 180, el = (o.el ?? 7) * Math.PI / 180, d = o.dist ?? 9;
  camera.fov = o.fov ?? 28;
  target.set(o.tx ?? 0, o.ty ?? 0.75, o.tz ?? 0);
  camera.position.set(target.x + Math.cos(el) * Math.cos(az) * d, target.y + Math.sin(el) * d, target.z + Math.cos(el) * Math.sin(az) * d);
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}
function glSize(w, h) {
  if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
    renderer.setSize(w, h);
  }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function pose(x = 0, z = 0, yaw = 0) { car.position.set(x, 0, z); car.rotation.y = yaw; }
function renderCar(color) {
  setCarColor(car, color);
  renderer.render(scene, camera);
  return renderer.domElement;
}
function toScreen(x, y, z, ox, oy, obj = car) {
  camera.updateMatrixWorld();
  obj.updateMatrixWorld();
  const v = new THREE.Vector3(x, y, z).applyMatrix4(obj.matrixWorld).project(camera);
  const s = renderer.getSize(new THREE.Vector2());
  return { x: ox + (v.x + 1) / 2 * s.x, y: oy + (1 - v.y) / 2 * s.y };
}

// 小道具：回転半径の円（点線）
const ring = new THREE.Group();
{
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.mintD), transparent: true, opacity: 0.9, depthWrite: false });
  const n = 72;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.07), mat);
    d.rotation.x = -Math.PI / 2;
    d.rotation.z = a + Math.PI / 2;
    d.position.set(Math.cos(a) * 5, 0.01, -Math.sin(a) * 5);
    ring.add(d);
  }
  const ctr = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), mat);
  ctr.rotation.x = -Math.PI / 2;
  ctr.position.y = 0.012;
  ring.add(ctr);
  ring.visible = false;
  scene.add(ring);
}
// 小道具：前方の見守り（地面に広がる波）
const sensor = new THREE.Group();
const sensorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.mint), transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.78, 1.0, 48, 1, -0.6, 1.2), sensorMat.clone());
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  sensor.add(m);
}
sensor.visible = false;
scene.add(sensor);
// 小道具：歩行者（抽象的な形）
const ped = new THREE.Group();
{
  const mat = new THREE.MeshStandardMaterial({ color: '#33443d', roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.62, 6, 16), mat);
  body.position.y = 0.56;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), mat);
  head.position.y = 1.16;
  ped.add(body, head);
  const warn = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.coral), transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }));
  warn.rotation.x = -Math.PI / 2;
  warn.position.y = 0.02;
  ped.add(warn);
  ped.userData.warn = warn;
  ped.visible = false;
  scene.add(ped);
}
// 小道具：道路の白線
const road = new THREE.Group();
{
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(60, 5.2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#e7e1d4'), transparent: true, opacity: 1, depthWrite: false }));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(6, 0.001, 0);
  asphalt.renderOrder = -2;
  road.add(asphalt);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false });
  for (const zz of [-2.25, 2.25]) {
    for (let i = 0; i < 14; i++) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.16), mat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(-20 + i * 3.2, 0.006, zz);
      d.userData.base = -20 + i * 3.2;
      d.renderOrder = -1;
      road.add(d);
    }
  }
  road.visible = false;
  scene.add(road);
}
// 小道具：荷室の箱と荷物
const cargo = new THREE.Group();
{
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.05, 1.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.mint), transparent: true, opacity: 0.12, depthWrite: false }));
  box.position.y = 0.525;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(P.mintD) }));
  edges.position.copy(box.position);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.mintL), transparent: true, opacity: 0.8, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.004;
  cargo.add(box, edges, floor);
  const items = [];
  const defs = [[0.62, 0.42, 0.5, P.sun, -0.4, 0.21, -0.28], [0.55, 0.36, 0.48, P.coral, 0.35, 0.18, -0.3], [0.5, 0.5, 0.42, P.sky, -0.38, 0.25, 0.32], [0.48, 0.3, 0.44, '#f4efe3', 0.36, 0.15, 0.3], [0.6, 0.28, 0.9, '#9fb9ad', 0.0, 0.66, 0.0]];
  for (const [w, h, d, col, x, y, z] of defs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }));
    m.userData.rest = new THREE.Vector3(x, y, z);
    m.position.copy(m.userData.rest);
    cargo.add(m);
    items.push(m);
  }
  cargo.userData.items = items;
  cargo.visible = false;
  scene.add(cargo);
}
function propsOff() { ring.visible = false; sensor.visible = false; ped.visible = false; road.visible = false; cargo.visible = false; shadow.visible = true; car.visible = true; }

// ---------------------------------------------------------------- 2D の道具
function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
};

// 刷毛のストローク（a〜b の区間だけ描く。かすれ・毛筋つき）
function brush(x0, y0, x1, y1, w, color, a, b, seed, alpha = 1) {
  if (b - a <= 0.002) return;
  const R = rng(seed);
  const N = 60;
  const nl = [], nr = [];
  for (let i = 0; i <= N; i++) { nl.push(R() - 0.5); nr.push(R() - 0.5); }
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
  const taper = (t) => 0.82 + 0.18 * Math.sin(Math.PI * clamp(t));
  const at = (arr, t) => { const f = t * N, i = Math.floor(f), k = f - i; return arr[Math.min(i, N)] * (1 - k) + arr[Math.min(i + 1, N)] * k; };
  const edge = (t, sgn) => { const nz = sgn > 0 ? at(nl, t) : at(nr, t); const ww = (w / 2) * taper(t) * (1 + nz * 0.14); return [x0 + dx * t + nx * ww * sgn, y0 + dy * t + ny * ww * sgn]; };
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.beginPath();
  const steps = 48;
  for (let i = 0; i <= steps; i++) { const t = a + (b - a) * (i / steps); const [px, py] = edge(t, 1); i ? c.lineTo(px, py) : c.moveTo(px, py); }
  for (let i = steps; i >= 0; i--) { const t = a + (b - a) * (i / steps); const [px, py] = edge(t, -1); c.lineTo(px, py); }
  c.closePath();
  c.fill();
  // 毛筋
  const n = Math.max(6, Math.round(w / 7));
  for (let k = 0; k < n; k++) {
    const o = (k / (n - 1) - 0.5) * w * 0.9;
    const s0 = Math.max(a, R() * 0.15), s1 = Math.min(b, 0.7 + R() * 0.3);
    if (s1 <= s0) { R(); R(); continue; }
    c.globalAlpha = alpha * (0.06 + R() * 0.16);
    c.lineWidth = 1 + R() * 2.4;
    c.strokeStyle = R() < 0.55 ? '#ffffff' : '#000000';
    c.beginPath();
    c.moveTo(x0 + dx * s0 + nx * o, y0 + dy * s0 + ny * o);
    c.lineTo(x0 + dx * s1 + nx * o, y0 + dy * s1 + ny * o);
    c.stroke();
  }
  // 筆先のかすれ
  if (b < 0.999) {
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    for (let k = 0; k < n * 2; k++) {
      const o = (R() - 0.5) * w * 0.95;
      const l = (0.01 + R() * 0.05);
      c.lineWidth = 1.5 + R() * 3;
      c.beginPath();
      c.moveTo(x0 + dx * b + nx * o, y0 + dy * b + ny * o);
      c.lineTo(x0 + dx * Math.min(1, b + l) + nx * o, y0 + dy * Math.min(1, b + l) + ny * o);
      c.stroke();
    }
  }
  c.restore();
}

// 縁のかすれた帯
function band(x, y, w, h, color, p, seed) {
  if (p <= 0) return;
  const R = rng(seed);
  const ww = w * E.out(clamp(p));
  c.save();
  c.fillStyle = color;
  c.beginPath();
  const n = 26;
  for (let i = 0; i <= n; i++) { const xx = x + (ww * i) / n; const yy = y + (R() - 0.5) * 5; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
  for (let i = 0; i <= 8; i++) c.lineTo(x + ww + (R() - 0.5) * 10, y + (h * i) / 8);
  for (let i = n; i >= 0; i--) { const xx = x + (ww * i) / n; const yy = y + h + (R() - 0.5) * 5; c.lineTo(xx, yy); }
  c.closePath();
  c.fill();
  c.globalAlpha = 0.12;
  c.strokeStyle = '#ffffff';
  for (let i = 0; i < 9; i++) { c.lineWidth = 1 + R() * 2; const yy = y + R() * h; c.beginPath(); c.moveTo(x + R() * ww * 0.3, yy); c.lineTo(x + ww * (0.6 + R() * 0.4), yy); c.stroke(); }
  c.restore();
}

function font(size, weight = 900) { return `${weight} ${size}px J`; }
function textW(t, size, weight = 900) { c.save(); c.font = font(size, weight); const w = c.measureText(t).width; c.restore(); return w; }

// 1文字ずつ弾んで入る文字
function bounce(text, x, y, size, color, t, o = {}) {
  const weight = o.weight ?? 900, st = o.stagger ?? 0.045, dur = o.dur ?? 0.36, align = o.align ?? 'left';
  c.save();
  c.font = font(size, weight);
  c.fillStyle = color;
  c.textBaseline = 'alphabetic';
  const chars = [...text];
  const ws = chars.map((ch) => c.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + (o.spacing ?? 0) * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  chars.forEach((ch, i) => {
    const k = clamp((t - i * st) / dur);
    if (k > 0) {
      const s = E.back(k);
      const yy = y + (1 - E.out(k)) * size * 0.5;
      c.save();
      c.translate(cx + ws[i] / 2, yy);
      c.scale(s, s);
      c.globalAlpha = Math.min(1, k * 3);
      c.fillText(ch, -ws[i] / 2, 0);
      c.restore();
    }
    cx += ws[i] + (o.spacing ?? 0);
  });
  c.restore();
  return total;
}

// 見出し：帯が伸びてから文字が弾む（1行ずつ）
function headline(lines, x, y, t, o = {}) {
  const size = o.size ?? 84, padX = o.padX ?? 26, gap = o.gap ?? 16, h = size * 1.32;
  lines.forEach((ln, i) => {
    const t0 = i * 0.32;
    const tw = textW(ln.text, size);
    const bw = tw + padX * 2;
    const bx = o.align === 'center' ? x - bw / 2 : x;
    band(bx, y + i * (h + gap), bw, h, ln.bg, seg(t, t0, t0 + 0.32), 50 + i * 7 + (o.seed || 0));
    bounce(ln.text, bx + padX, y + i * (h + gap) + h * 0.76, size, ln.fg || P.white, t - t0 - 0.2);
  });
  return y + lines.length * (h + gap);
}

function note(text, x, y, size = 27, color = P.gray, align = 'left', alpha = 1) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  c.font = font(size, 500);
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(text, x, y);
  c.restore();
}

function roundRect(x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function pill(text, cx, cy, size, bg, fg, p, o = {}) {
  if (p <= 0) return;
  const s = E.back(clamp(p));
  const tw = textW(text, size, 900);
  const w = tw + (o.arrow ? size * 2.3 : size * 1.6), h = size * 2.05;
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.globalAlpha = Math.min(1, p * 3);
  c.fillStyle = 'rgba(0,0,0,.14)';
  roundRect(-w / 2 + 4, -h / 2 + 8, w, h, h / 2);
  c.fill();
  c.fillStyle = bg;
  roundRect(-w / 2, -h / 2, w, h, h / 2);
  c.fill();
  c.fillStyle = fg;
  c.font = font(size, 900);
  c.textBaseline = 'middle';
  c.fillText(text, -w / 2 + size * 0.8, 2);
  if (o.arrow) {
    c.strokeStyle = fg;
    c.lineWidth = size * 0.16;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const ax = w / 2 - size * 0.95;
    c.beginPath();
    c.moveTo(ax - size * 0.25, -size * 0.32);
    c.lineTo(ax + size * 0.1, 0);
    c.lineTo(ax - size * 0.25, size * 0.32);
    c.stroke();
  }
  c.restore();
}

function chip(text, x, y, size, p, o = {}) {
  if (p <= 0) return { w: 0, h: 0 };
  const tw = textW(text, size, 900);
  const w = tw + size * 1.3, h = size * 1.75;
  const s = E.back(clamp(p));
  c.save();
  c.translate(x + w / 2, y + h / 2);
  c.scale(s, s);
  c.globalAlpha = Math.min(1, p * 3);
  c.fillStyle = o.bg || P.white;
  roundRect(-w / 2, -h / 2, w, h, 14);
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = o.border || P.ink;
  c.stroke();
  if (o.no) {
    c.fillStyle = o.noBg || P.mint;
    c.beginPath();
    c.arc(-w / 2, -h / 2, size * 0.62, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = P.white;
    c.font = font(size * 0.78, 900);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(o.no, -w / 2, -h / 2 + 2);
  }
  c.fillStyle = o.fg || P.ink;
  c.font = font(size, 900);
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(text, -w / 2 + size * 0.65, 2);
  c.restore();
  return { w, h };
}

// 背景（クリーム色＋上下の塗り跡の帯）
function backdrop(seed, accent = P.mint, accent2 = P.sun) {
  c.fillStyle = P.cream;
  c.fillRect(0, 0, W, H);
  // うっすら紙の質感
  const R = rng(seed);
  c.save();
  c.globalAlpha = 0.05;
  c.fillStyle = '#a89c80';
  for (let i = 0; i < 260; i++) c.fillRect(R() * W, R() * H, 2, 2);
  c.restore();
  // 上下の帯（9:16のときだけ見える部分）
  brush(-60, 120, W + 60, 70, 210, accent, 0, 1, seed + 1, 1);
  brush(-60, 210, W + 60, 250, 70, accent2, 0, 1, seed + 2, 0.95);
  brush(-60, H - 120, W + 60, H - 170, 220, accent, 0, 1, seed + 3, 1);
  brush(-60, H - 255, W + 60, H - 215, 64, accent2, 0, 1, seed + 4, 0.95);
}

// 車の左右だけに塗るストローク（車体の横幅の内側には塗らない）
function sideStrokes(t, carL, carR, yTop, yBot, colA, colB, seed) {
  const pA = E.out(seg(t, 0.1, 0.7)), pB = E.out(seg(t, 0.25, 0.85));
  if (carL > 30) {
    brush(carL * 0.5, yBot, carL * 0.5 - 10, yTop, Math.min(110, carL * 0.95), colA, 0, pA, seed, 0.95);
  }
  if (W - carR > 30) {
    const cx = carR + (W - carR) * 0.5;
    brush(cx, yTop, cx + 10, yBot, Math.min(110, (W - carR) * 0.95), colB, 0, pB, seed + 9, 0.95);
  }
}

// 場面転換：刷毛で画面を塗りつぶす／はがす
function wipe(p, color, seed, mode) {
  // mode 'cover' (0→1で覆う) / 'reveal' (0→1ではがす)
  const n = 7, bh = H / (n - 1.6);
  for (let i = 0; i < n; i++) {
    const d = i * 0.06;
    const q = clamp((p - d) / (1 - (n - 1) * 0.06));
    const y = -bh * 0.4 + i * (H / (n - 1)) * 1.02;
    const a = mode === 'cover' ? 0 : E.io(q);
    const b = mode === 'cover' ? E.io(q) : 1;
    if (mode === 'cover' && q <= 0) continue;
    if (mode === 'reveal' && q >= 1) continue;
    brush(-120, y + 60, W + 120, y - 60, bh * 1.25, color, a, b, seed + i * 13, 1);
  }
}

// 色見本
function swatches(keys, active, cx, cy, p) {
  const r = 30, gap = 34, total = keys.length * r * 2 + (keys.length - 1) * gap;
  keys.forEach((k, i) => {
    const q = E.back(clamp(p * 1.4 - i * 0.12));
    if (q <= 0) return;
    const x = cx - total / 2 + r + i * (r * 2 + gap);
    c.save();
    c.translate(x, cy);
    c.scale(q, q);
    const on = active === k;
    c.fillStyle = 'rgba(0,0,0,.12)';
    c.beginPath(); c.arc(2, 5, r + (on ? 10 : 2), 0, Math.PI * 2); c.fill();
    if (on) { c.fillStyle = P.ink; c.beginPath(); c.arc(0, 0, r + 9, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = P.white; c.beginPath(); c.arc(0, 0, r + 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = COLORS[k].body; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = COLORS[k].roof; c.beginPath(); c.arc(0, 0, r, Math.PI * 1.1, Math.PI * 1.9); c.fill();
    c.restore();
  });
}

// 店舗の設備アイコン（線画）
function icon(type, cx, cy, s, p) {
  if (p <= 0) return;
  const q = E.back(clamp(p));
  c.save();
  c.translate(cx, cy);
  c.scale(q, q);
  c.fillStyle = P.white;
  c.beginPath(); c.arc(0, 0, s, 0, Math.PI * 2); c.fill();
  c.lineWidth = 6; c.strokeStyle = P.mintD; c.stroke();
  c.strokeStyle = P.ink; c.fillStyle = P.ink; c.lineWidth = s * 0.075; c.lineCap = 'round'; c.lineJoin = 'round';
  const u = s / 10;
  if (type === 'kids') { // すべり台と積み木
    c.beginPath(); c.moveTo(-5.2 * u, 4 * u); c.lineTo(-5.2 * u, -4 * u); c.lineTo(-2.4 * u, -4 * u); c.lineTo(3.8 * u, 4 * u); c.stroke();
    c.beginPath(); c.moveTo(-5.2 * u, 0); c.lineTo(-2.6 * u, 0); c.stroke();
    c.fillStyle = P.sun; c.fillRect(1.2 * u, -4.8 * u, 3.4 * u, 3.4 * u); c.strokeRect(1.2 * u, -4.8 * u, 3.4 * u, 3.4 * u);
  } else if (type === 'milk') { // 哺乳びん
    roundRect(-2.4 * u, -2.2 * u, 4.8 * u, 7 * u, 1.4 * u); c.stroke();
    c.beginPath(); c.moveTo(-1.6 * u, -2.2 * u); c.lineTo(-1.2 * u, -4 * u); c.lineTo(1.2 * u, -4 * u); c.lineTo(1.6 * u, -2.2 * u); c.stroke();
    c.beginPath(); c.arc(0, -5 * u, 0.9 * u, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(-2.4 * u, 0.6 * u); c.lineTo(2.4 * u, 0.6 * u); c.stroke();
  } else if (type === 'diaper') { // おむつ替えの台
    c.beginPath(); c.moveTo(-5.4 * u, 1.2 * u); c.lineTo(5.4 * u, 1.2 * u); c.stroke();
    c.beginPath(); c.moveTo(-4.4 * u, 1.2 * u); c.lineTo(-4.4 * u, 4.6 * u); c.moveTo(4.4 * u, 1.2 * u); c.lineTo(4.4 * u, 4.6 * u); c.stroke();
    c.beginPath(); c.arc(-2.6 * u, -1.4 * u, 1.5 * u, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(-0.8 * u, -0.6 * u); c.quadraticCurveTo(2.5 * u, -2.8 * u, 4.4 * u, -0.4 * u); c.stroke();
  } else if (type === 'key') { // 試乗
    c.beginPath(); c.arc(-2.4 * u, 0, 2.6 * u, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(0.2 * u, 0); c.lineTo(5.2 * u, 0); c.lineTo(5.2 * u, 2 * u); c.moveTo(3.4 * u, 0); c.lineTo(3.4 * u, 1.6 * u); c.stroke();
  }
  c.restore();
}

// 店のイラスト（架空の販売店）
function storeArt(x, y, w, h, p) {
  if (p <= 0) return;
  const q = E.out(clamp(p));
  c.save();
  c.globalAlpha = Math.min(1, p * 2);
  c.translate(0, (1 - q) * 40);
  // 建物
  c.fillStyle = '#ffffff';
  roundRect(x, y + h * 0.22, w, h * 0.78, 18); c.fill();
  c.lineWidth = 4; c.strokeStyle = P.ink2; c.stroke();
  // 屋根の帯（ストライプ）
  const sh = h * 0.16;
  for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? P.white : P.mint; c.fillRect(x + (w / 10) * i, y + h * 0.22, w / 10 + 1, sh); }
  c.strokeRect(x, y + h * 0.22, w, sh);
  // 看板
  c.fillStyle = P.ink;
  roundRect(x + w * 0.24, y, w * 0.52, h * 0.18, 12); c.fill();
  c.fillStyle = P.white;
  c.font = font(h * 0.085, 900);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('SAMPLE MOTORS', x + w / 2, y + h * 0.093);
  // 窓
  c.fillStyle = '#d7e9f2';
  for (let i = 0; i < 3; i++) { roundRect(x + w * 0.06 + i * w * 0.3, y + h * 0.45, w * 0.26, h * 0.4, 10); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,.6)';
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + w * 0.09 + i * w * 0.3, y + h * 0.8); c.lineTo(x + w * 0.18 + i * w * 0.3, y + h * 0.48); c.lineTo(x + w * 0.22 + i * w * 0.3, y + h * 0.48); c.lineTo(x + w * 0.13 + i * w * 0.3, y + h * 0.8); c.closePath(); c.fill(); }
  c.restore();
}

// 3Dの車を描いて貼る（色の切り替えは斜めのかすれた境界で）
function drawCar(y, colorA, colorB = null, wp = 0, seed = 1, h = GH) {
  glSize(GW, h);
  const a = renderCar(colorA);
  c.drawImage(a, 0, y);
  if (colorB && wp > 0) {
    const b = renderCar(colorB);
    const R = rng(seed);
    const slant = 260;
    const xEdge = -slant + (W + slant * 2) * E.io(wp);
    c.save();
    c.beginPath();
    c.moveTo(-10, y - 10);
    const n = 30;
    for (let i = 0; i <= n; i++) { const yy = y + (h * i) / n; const xx = xEdge + slant * 0.5 - (slant * i) / n + (R() - 0.5) * 26; c.lineTo(xx, yy); }
    c.lineTo(-10, y + h + 10);
    c.closePath();
    c.clip();
    c.drawImage(b, 0, y);
    c.restore();
    // 境界の白いかすれ（車の上だけ）
    if (!drawCar.fx) drawCar.fx = document.createElement('canvas');
    const fx = drawCar.fx;
    fx.width = W; fx.height = h;
    const g = fx.getContext('2d');
    g.clearRect(0, 0, W, h);
    g.globalAlpha = 0.75 * Math.sin(Math.PI * wp);
    g.strokeStyle = '#ffffff';
    for (let i = 0; i < 12; i++) {
      g.lineWidth = 2 + R() * 4;
      const o = (R() - 0.5) * 30;
      g.beginPath();
      g.moveTo(xEdge + slant * 0.5 + o, 0);
      g.lineTo(xEdge - slant * 0.5 + o, h);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(b, 0, 0);
    g.globalCompositeOperation = 'source-over';
    c.drawImage(fx, 0, y);
  }
}

// ---------------------------------------------------------------- 場面
const KEYS = ['mint', 'sun', 'sky', 'pearl'];

// 共通：車の左右（ピクセル）を求める
function carSpan(oy) {
  const pts = [[2.2, 0.6, 0.9], [2.2, 0.6, -0.9], [-2.2, 0.6, 0.9], [-2.2, 0.6, -0.9], [2.2, 1.7, 0.85], [-2.2, 1.7, -0.85]];
  let l = 1e9, r = -1e9;
  for (const [x, y, z] of pts) { const p = toScreen(x, y, z, 0, oy); l = Math.min(l, p.x); r = Math.max(r, p.x); }
  return [l, r];
}

const VIDEO = {};

// パターンA：機能と家族
VIDEO.A = [
  { dur: 3.6, draw(t) { // カラー切り替え
    backdrop(11);
    propsOff();
    const az = 22 + t * 5;
    view({ az, el: 7, dist: 10.9, ty: 0.8 });
    pose();
    const cy = 560;
    const [l, r] = carSpan(cy);
    sideStrokes(t, l - 10, r + 10, cy + 120, cy + 700, P.mint, P.sun, 21);
    const ws = [[0.95, 1.45], [1.85, 2.35], [2.75, 3.25]];
    let cur = 0, nxt = null, wp = 0;
    ws.forEach(([a, b], i) => { if (t >= b) cur = i + 1; else if (t > a) { cur = i; nxt = i + 1; wp = seg(t, a, b); } });
    drawCar(cy, KEYS[cur], nxt != null ? KEYS[nxt] : null, wp, 31 + cur);
    bounce('NEW  HINATA', 78, 345, 34, P.mintD, t - 0.05, { weight: 900, spacing: 3 });
    headline([{ text: '家族の、', bg: P.ink }, { text: 'ちょうどいい。', bg: P.mint }], 60, 372, t - 0.1, { size: 82 });
    const shown = nxt != null && wp > 0.5 ? KEYS[nxt] : KEYS[cur];
    swatches(KEYS, shown, W / 2, 1448, seg(t, 0.35, 1.1));
    const nameP = seg(t, 0.6, 1.0);
    note(COLORS[shown].name + (shown === 'sky' ? '×ホワイトルーフ' : '×ブラックルーフ'), W / 2, 1535, 36, P.ink, 'center', nameP);
    note('※架空の車種です', W / 2, 1600, 26, P.gray, 'center', nameP);
  } },
  { dur: 3.4, draw(t) { // 荷室
    backdrop(12, P.sun, P.mint);
    propsOff();
    cargo.visible = true;
    cargo.position.set(-2.1, 0, -1.9);
    view({ az: 148, el: 15, dist: 12.6, ty: 0.75, tx: -0.55, tz: -0.75 });
    pose(0.5, 0.6, 0);
    cargo.userData.items.forEach((m, i) => {
      const k = seg(t, 0.35 + i * 0.28, 0.85 + i * 0.28);
      const drop = (1 - E.out(k)) * 3.2;
      const bounceY = k > 0.7 ? Math.sin((k - 0.7) / 0.3 * Math.PI) * 0.08 : 0;
      m.position.set(m.userData.rest.x, m.userData.rest.y + drop + bounceY, m.userData.rest.z);
      m.visible = k > 0;
    });
    drawCar(560, 'sun');
    // 荷室の箱から車の後ろへ、点線の矢印
    {
      const k = E.out(seg(t, 1.9, 2.5));
      if (k > 0) {
        const a = toScreen(0.75, 1.15, 0.0, 0, 560, cargo);
        const b = toScreen(-2.25, 1.0, 0.0, 0, 560);
        const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 120;
        c.save();
        c.strokeStyle = P.mintD; c.lineWidth = 6; c.setLineDash([4, 14]); c.lineCap = 'round';
        c.beginPath();
        const N = 30;
        for (let i = 0; i <= N * k; i++) { const u = i / N; const x = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mx + u * u * b.x; const y = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * my + u * u * b.y; i ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
        c.restore();
      }
    }
    headline([{ text: '荷物も、', bg: P.ink }, { text: 'たっぷり。', bg: P.mint }], 60, 340, t - 0.15, { size: 82 });
    chip('2列目も3列目も、たためる', 120, 1420, 40, seg(t, 1.2, 1.6), { no: '1' });
    note('※架空の車種です。図はイメージです。', W / 2, 1600, 26, P.gray, 'center', seg(t, 1.3, 1.7));
  } },
  { dur: 3.3, draw(t) { // 小回り
    backdrop(13);
    propsOff();
    ring.visible = true;
    shadow.visible = true;
    view({ az: 90, el: 62, dist: 24, ty: 0, fov: 30 });
    const th = -Math.PI * 0.15 + t * 0.95;
    const R = 5;
    const x = R * Math.cos(th), z = -R * Math.sin(th);
    const tx = -Math.sin(th), tz = -Math.cos(th);
    pose(x, z, Math.atan2(-tz, tx));
    rollWheels(car, R * th);
    drawCar(560, 'sky', null, 0, 1, 900);
    headline([{ text: 'せまい道も、', bg: P.ink }, { text: 'すいすい。', bg: P.mint }], 60, 330, t - 0.15, { size: 82 });
    const p = seg(t, 0.9, 1.3);
    chip('最小回転半径 5.0m', 260, 1478, 42, p, { no: '2' });
    note('※架空の車種のイメージです。', W / 2, 1600, 26, P.gray, 'center', p);
  } },
  { dur: 3.4, draw(t) { // 安全
    backdrop(14, P.mint, P.coral);
    propsOff();
    road.visible = true;
    sensor.visible = true;
    ped.visible = true;
    const stopT = 2.0;
    const v = t < stopT ? 4.2 : 4.2 * Math.max(0, 1 - (t - stopT) / 0.4);
    const dist = t < stopT ? v * t : 4.2 * stopT + 4.2 * 0.2 * (1 - Math.pow(1 - clamp((t - stopT) / 0.4), 2));
    road.children.forEach((d) => { if (d.userData.base == null) return; d.position.x = ((d.userData.base + 20 - dist) % 44.8 + 44.8) % 44.8 - 20; });
    view({ az: 30, el: 11, dist: 12.2, ty: 0.7, tx: 2.3 });
    pose();
    rollWheels(car, dist);
    ped.position.set(6.7, 0, -0.35);
    const wv = seg(t, 1.6, 2.2);
    ped.userData.warn.material.opacity = wv > 0 ? 0.85 * (0.6 + 0.4 * Math.sin(t * 14)) : 0;
    sensor.children.forEach((m, i) => {
      const k = ((t * 1.25 + i / 3) % 1);
      const s = 1.2 + k * 3.6;
      m.scale.set(s, s, s);
      m.position.set(2.3, 0.015, 0);
      m.material.opacity = 0.75 * (1 - k);
    });
    drawCar(560, 'mint');
    headline([{ text: '見守る目が、', bg: P.ink }, { text: 'いつも前に。', bg: P.mint }], 60, 330, t - 0.15, { size: 82 });
    chip('衝突被害軽減ブレーキ', 200, 1440, 42, seg(t, 1.0, 1.4), { no: '3' });
    note('※図はイメージです。作動には条件があります。', W / 2, 1565, 26, P.gray, 'center', seg(t, 1.1, 1.5));
    note('過信せず、安全運転を心がけてください。', W / 2, 1605, 26, P.gray, 'center', seg(t, 1.1, 1.5));
  } },
  { dur: 3.3, draw(t) { // お店
    backdrop(15, P.sun, P.mint);
    propsOff();
    headline([{ text: 'お子さま連れでも、', bg: P.ink }, { text: 'ゆっくり。', bg: P.mint }], 60, 330, t - 0.1, { size: 78 });
    storeArt(150, 640, 780, 470, seg(t, 0.2, 0.8));
    const items = [['kids', 'キッズコーナー'], ['milk', '授乳室'], ['diaper', 'おむつ交換シート']];
    items.forEach(([k, label], i) => {
      const x = 210 + i * 330, p = seg(t, 0.7 + i * 0.18, 1.1 + i * 0.18);
      icon(k, x, 1250, 74, p);
      note(label, x, 1375, 32, P.ink, 'center', p);
    });
    note('※設備は店舗により異なります。（架空の販売店）', W / 2, 1600, 26, P.gray, 'center', seg(t, 1.3, 1.7));
  } },
  { dur: 3.6, draw(t) { // 試乗へ
    backdrop(16);
    propsOff();
    view({ az: 34 - t * 4, el: 7, dist: 9.4, ty: 0.78 });
    pose();
    const cy = 600;
    const [l, r] = carSpan(cy);
    sideStrokes(t, l - 10, r + 10, cy + 120, cy + 700, P.sun, P.mint, 41);
    drawCar(cy, 'mint');
    headline([{ text: '週末は、家族で', bg: P.ink }, { text: '試乗へ。', bg: P.mint }], 60, 330, t - 0.1, { size: 82 });
    pill('ご来店予約はこちら', W / 2, 1468, 44, P.ink, P.white, seg(t, 0.9, 1.4), { arrow: true });
    note('サンプル販売店（架空）', W / 2, 1565, 30, P.ink2, 'center', seg(t, 1.2, 1.6));
    note('※架空の車種・架空の販売店のサンプル動画です。', W / 2, 1610, 25, P.gray, 'center', seg(t, 1.2, 1.6));
  } }
];

// パターンB：新型と月々
VIDEO.B = [
  { dur: 3.4, draw(t) { // 登場
    backdrop(21, P.sun, P.mint);
    propsOff();
    view({ az: 90, el: 4, dist: 14, ty: 0.85, fov: 24 });
    const k = E.out(seg(t, 0.15, 1.6));
    const x = -9 + 9 * k;
    pose(x, 0, 0);
    rollWheels(car, x);
    const cy = 620;
    if (t > 1.5) {
      const [l, r] = carSpan(cy);
      sideStrokes(t - 1.5, l - 6, r + 6, cy + 160, cy + 640, P.mint, P.sun, 51);
    }
    drawCar(cy, 'sun');
    headline([{ text: '新しい家族の車、', bg: P.ink }, { text: 'HINATA 登場。', bg: P.mint }], 60, 330, t - 0.5, { size: 80 });
    note('※架空の車種です', W / 2, 1520, 30, P.ink2, 'center', seg(t, 1.6, 2.0));
  } },
  { dur: 4.0, draw(t) { // ここが新しい
    backdrop(22);
    propsOff();
    view({ az: 32, el: 8, dist: 9.8, ty: 0.8 });
    pose();
    const cy = 600;
    drawCar(cy, 'sun');
    headline([{ text: 'ここが、新しい。', bg: P.ink }], 60, 330, t - 0.1, { size: 82 });
    const pts = [
      { p: toScreen(2.1, 0.8, 0.55, 0, cy), label: 'LEDライト', at: [770, 1330], no: '1', t0: 0.6 },
      { p: toScreen(-0.9, 0.75, 0.86, 0, cy), label: '両側スライドドア', at: [70, 1420], no: '2', t0: 1.3 },
      { p: toScreen(-1.0, 1.72, 0.0, 0, cy), label: '2トーンのルーフ', at: [560, 520], no: '3', t0: 2.0 }
    ];
    pts.forEach((o) => {
      const k = seg(t, o.t0, o.t0 + 0.4);
      if (k <= 0) return;
      const cw = textW(o.label, 38, 900) + 38 * 1.3, ch = 38 * 1.75;
      const ax = o.at[0] + cw / 2, ay = o.at[1] + (o.at[1] < o.p.y ? ch : 0);
      // 引き出し線（文字は車に重ねない）
      c.save();
      c.strokeStyle = P.ink; c.lineWidth = 4; c.setLineDash([2, 10]); c.lineCap = 'round';
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + (o.p.x - ax) * E.out(k), ay + (o.p.y - ay) * E.out(k)); c.stroke();
      c.setLineDash([]);
      c.fillStyle = P.mint; c.beginPath(); c.arc(o.p.x, o.p.y, 12 * E.back(k), 0, Math.PI * 2); c.fill();
      c.strokeStyle = P.white; c.lineWidth = 4; c.stroke();
      c.restore();
      chip(o.label, o.at[0], o.at[1], 38, k, { no: o.no });
    });
    note('※架空の車種です。', 1020, 1625, 24, P.gray, 'right', seg(t, 0.8, 1.2));
  } },
  { dur: 6.4, draw(t) { // 月々のお支払い例（金額と条件を同時に出す）
    backdrop(23, P.mint, P.sun);
    propsOff();
    headline([{ text: '月々のお支払い例', bg: P.ink }], 60, 318, t - 0.1, { size: 74 });
    view({ az: 28, el: 6, dist: 12, ty: 0.75 });
    pose();
    glSize(GW, 520);
    const img = renderCar('sun');
    c.drawImage(img, 300, 430, 1080 * 0.62, 520 * 0.62);
    const p = E.out(seg(t, 0.3, 0.8));
    c.save();
    c.globalAlpha = p;
    c.translate(0, (1 - p) * 40);
    const x = 70, y = 770, w = 940, h = 840;
    c.fillStyle = 'rgba(0,0,0,.10)'; roundRect(x + 6, y + 12, w, h, 30); c.fill();
    c.fillStyle = P.white; roundRect(x, y, w, h, 30); c.fill();
    c.lineWidth = 4; c.strokeStyle = P.ink; c.stroke();
    c.fillStyle = P.ink; c.font = font(34, 900); c.fillText('HINATA（架空）　車両本体価格 2,500,000円（税込）', x + 40, y + 70);
    c.fillStyle = P.sunL; roundRect(x + 30, y + 100, w - 60, 200, 22); c.fill();
    c.fillStyle = P.ink; c.font = font(38, 900); c.fillText('月々のお支払い（2回目以降）', x + 60, y + 165);
    c.font = font(110, 900); c.fillText('45,929', x + 60, y + 278);
    c.font = font(46, 900); c.fillText('円', x + 60 + textW('45,929', 110) + 10, y + 278);
    const rows = [['初回', '45,906円'], ['支払回数', '60回（5年）'], ['頭金', '0円'], ['ボーナス加算', 'なし'], ['実質年率', '3.9%'], ['割賦支払総額', '2,755,717円']];
    rows.forEach(([k, v], i) => {
      const ry = y + 368 + i * 66;
      c.fillStyle = i % 2 ? '#ffffff' : '#f6f2e8';
      c.fillRect(x + 30, ry - 44, w - 60, 62);
      c.fillStyle = P.ink2; c.font = font(34, 700); c.fillText(k, x + 60, ry);
      c.fillStyle = P.ink; c.font = font(36, 900); c.textAlign = 'right'; c.fillText(v, x + w - 60, ry); c.textAlign = 'left';
    });
    c.fillStyle = P.gray; c.font = font(27, 500);
    c.fillText('※架空の車種・架空の条件によるサンプルです。', x + 40, y + h - 46);
    c.restore();
  } },
  { dur: 3.4, draw(t) { // 試乗へ
    backdrop(24, P.sun, P.mint);
    propsOff();
    view({ az: 36 - t * 4, el: 7, dist: 9.4, ty: 0.78 });
    pose();
    const cy = 600;
    const [l, r] = carSpan(cy);
    sideStrokes(t, l - 10, r + 10, cy + 120, cy + 700, P.mint, P.sun, 61);
    drawCar(cy, 'sun');
    headline([{ text: 'まずは、', bg: P.ink }, { text: '試乗から。', bg: P.mint }], 60, 330, t - 0.1, { size: 82 });
    pill('試乗を予約する', W / 2, 1468, 46, P.ink, P.white, seg(t, 0.9, 1.4), { arrow: true });
    note('サンプル販売店（架空）', W / 2, 1565, 30, P.ink2, 'center', seg(t, 1.2, 1.6));
    note('※架空の車種・架空の販売店のサンプル動画です。', W / 2, 1610, 25, P.gray, 'center', seg(t, 1.2, 1.6));
  } }
];

// ---------------------------------------------------------------- 書き出し用
function frameAt(video, i) {
  const list = VIDEO[video];
  let tt = i / FPS;
  let k = 0;
  while (k < list.length - 1 && tt >= list[k].dur) { tt -= list[k].dur; k++; }
  const sc = list[k];
  c.save();
  sc.draw(tt);
  c.restore();
  // 場面の切り替え（終わり0.32秒で覆い、次の頭0.32秒ではがす）
  const TR = 0.32;
  const colors = [P.mint, P.sun, P.ink];
  if (k < list.length - 1 && tt > sc.dur - TR) wipe(seg(tt, sc.dur - TR, sc.dur), colors[k % 3], 300 + k * 17, 'cover');
  if (k > 0 && tt < TR) wipe(seg(tt, 0, TR), colors[(k - 1) % 3], 300 + (k - 1) * 17, 'reveal');
}

window.api = {
  frames: (video) => Math.round(VIDEO[video].reduce((a, s) => a + s.dur, 0) * FPS),
  frame: (video, i, q = 0.93) => { frameAt(video, i); return out.toDataURL('image/jpeg', q); },
  draw: (video, i) => frameAt(video, i)
};
document.fonts.load('900 40px J').then(() => document.fonts.load('500 40px J')).then(() => document.fonts.load('700 40px J')).then(() => { window.__ready = true; });
