// 架空のコンパクトミニバン「HINATA」
// 単位はメートル。X＝前（+）、Y＝上、Z＝車幅。原点は車体中心の真下（地面）。
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const DIM = { L: 4.26, W: 1.7, H: 1.72, WB: 2.74, R: 0.315, TRACK: 0.73 };

export const COLORS = {
  mint: { name: 'ミストグリーン', body: '#8fbfaa', roof: '#1f2427' },
  pearl: { name: 'パールホワイト', body: '#eeede7', roof: '#1f2427' },
  sun: { name: 'ひだまりイエロー', body: '#e7b84e', roof: '#1f2427' },
  sky: { name: 'スカイブルー', body: '#86aed3', roof: '#f3f2ee' }
};

function shapeFrom(fn) {
  const s = new THREE.Shape();
  fn(s);
  return s;
}

function extrude(shape, width, bevelT, bevelS, segs, curveSegs = 28) {
  const depth = width - bevelT * 2;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevelT,
    bevelSize: bevelS,
    bevelSegments: segs,
    curveSegments: curveSegs
  });
  g.translate(0, 0, -depth / 2);
  return toCreasedNormals(g, Math.PI / 5.5);
}

function rbox(w, h, d, r, seg = 3) {
  // 角の丸い箱（押し出しで作る）
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const bt = Math.min(r, d / 2.2);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0005, d - bt * 2), bevelEnabled: true, bevelThickness: bt, bevelSize: bt * 0.6, bevelSegments: seg, curveSegments: 8 });
  g.translate(0, 0, -(d - bt * 2) / 2);
  return toCreasedNormals(g, Math.PI / 4);
}

export function makeMaterials(colorKey = 'mint') {
  const c = COLORS[colorKey] || COLORS.mint;
  return {
    body: new THREE.MeshPhysicalMaterial({ color: c.body, metalness: 0.28, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.05 }),
    roof: new THREE.MeshPhysicalMaterial({ color: c.roof, metalness: 0.25, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#1c2b33', metalness: 0.2, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02 }),
    lampHouseLight: new THREE.MeshPhysicalMaterial({ color: '#cfd6db', metalness: 0.5, roughness: 0.12, clearcoat: 1 }),
    trim: new THREE.MeshStandardMaterial({ color: '#191c1f', metalness: 0.15, roughness: 0.6 }),
    gloss: new THREE.MeshPhysicalMaterial({ color: '#0e1012', metalness: 0.35, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#dfe3e6', metalness: 1, roughness: 0.1 }),
    tire: new THREE.MeshStandardMaterial({ color: '#191a1c', metalness: 0, roughness: 0.82 }),
    rim: new THREE.MeshStandardMaterial({ color: '#cfd4d8', metalness: 0.95, roughness: 0.22 }),
    rimDark: new THREE.MeshStandardMaterial({ color: '#24282c', metalness: 0.6, roughness: 0.45 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#eef5ff', emissiveIntensity: 2.2, roughness: 0.25 }),
    lampHouse: new THREE.MeshPhysicalMaterial({ color: '#20262c', metalness: 0.6, roughness: 0.08, clearcoat: 1 }),
    tail: new THREE.MeshStandardMaterial({ color: '#b5121f', emissive: '#ff2433', emissiveIntensity: 1.4, roughness: 0.3 }),
    amber: new THREE.MeshStandardMaterial({ color: '#d98a12', emissive: '#ffa21a', emissiveIntensity: 0.6, roughness: 0.3 })
  };
}

export function setCarColor(car, colorKey) {
  const c = COLORS[colorKey] || COLORS.mint;
  car.userData.mats.body.color.set(c.body);
  car.userData.mats.roof.color.set(c.roof);
  car.userData.colorKey = colorKey;
}

function makeWheel(m) {
  const g = new THREE.Group();
  const R = DIM.R;
  // タイヤ（断面を回転させて作る。回転軸はY → あとでZに向ける）
  const prof = [
    [0.205, -0.104], [0.27, -0.106], [0.3, -0.1], [0.313, -0.075], [R, -0.03], [R, 0.03], [0.313, 0.075], [0.3, 0.1], [0.27, 0.106], [0.205, 0.104]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tire = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), m.tire);
  tire.rotation.x = Math.PI / 2;
  g.add(tire);
  // ホイール（外側を+Z）
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.206, 0.206, 0.19, 48, 1, true), m.rimDark);
  barrel.rotation.x = Math.PI / 2;
  g.add(barrel);
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.205, 48), m.rimDark);
  back.position.z = 0.02;
  g.add(back);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 10, 64), m.rim);
  lip.position.z = 0.088;
  g.add(lip);
  const face = new THREE.Group();
  face.position.z = 0.075;
  for (let i = 0; i < 5; i++) {
    for (const off of [-0.11, 0.11]) {
      const sp = new THREE.Mesh(rbox(0.15, 0.03, 0.03, 0.012, 2), m.rim);
      const a = (i / 5) * Math.PI * 2 + off;
      sp.position.set(Math.cos(a) * 0.115, Math.sin(a) * 0.115, 0);
      sp.rotation.z = a;
      face.add(sp);
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.05, 32), m.rim);
  hub.rotation.x = Math.PI / 2;
  face.add(hub);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.056, 24), m.rimDark);
  cap.rotation.x = Math.PI / 2;
  face.add(cap);
  g.add(face);
  return g;
}

export function buildCar(colorKey = 'mint') {
  const m = makeMaterials(colorKey);
  const car = new THREE.Group();
  car.userData.mats = m;
  car.userData.colorKey = colorKey;
  const body = new THREE.Group();
  car.add(body);

  // ---- 下半分のボディ（横から見た形を押し出す。タイヤの切り欠きつき）
  const AX = DIM.WB / 2; // 前後の車軸
  const AR = 0.41; // 切り欠きの半径
  const ACY = 0.33;
  const a0 = Math.asin((0.3 - ACY) / AR);
  const lower = shapeFrom((s) => {
    s.moveTo(1.97, 0.3);
    s.lineTo(AX + AR * Math.cos(a0), 0.3);
    s.absarc(AX, ACY, AR, a0, Math.PI - a0, false);
    s.lineTo(-AX + AR * Math.cos(a0), 0.3);
    s.absarc(-AX, ACY, AR, a0, Math.PI - a0, false);
    s.lineTo(-1.97, 0.3);
    s.quadraticCurveTo(-2.075, 0.3, -2.08, 0.42);
    s.lineTo(-2.085, 0.97);
    s.quadraticCurveTo(-2.085, 1.035, -2.02, 1.035);
    s.lineTo(1.2, 1.02);
    s.quadraticCurveTo(1.3, 1.02, 1.36, 1.0);
    s.quadraticCurveTo(1.66, 0.97, 1.9, 0.88);
    s.quadraticCurveTo(2.05, 0.82, 2.07, 0.7);
    s.lineTo(2.085, 0.52);
    s.quadraticCurveTo(2.09, 0.31, 1.97, 0.3);
  });
  const lowerMesh = new THREE.Mesh(extrude(lower, DIM.W, 0.13, 0.05, 8), m.body);
  body.add(lowerMesh);

  // ---- ガラスの部分（少し細くして肩をつくる）
  const green = shapeFrom((s) => {
    s.moveTo(-1.99, 1.0);
    s.lineTo(1.27, 1.0);
    s.lineTo(0.47, 1.585);
    s.quadraticCurveTo(0.34, 1.665, 0.16, 1.668);
    s.lineTo(-1.84, 1.676);
    s.quadraticCurveTo(-1.995, 1.672, -2.0, 1.55);
    s.lineTo(-2.03, 1.06);
    s.quadraticCurveTo(-2.03, 1.0, -1.99, 1.0);
  });
  const greenMesh = new THREE.Mesh(extrude(green, 1.5, 0.1, 0.02, 6), m.glass);
  body.add(greenMesh);

  // ---- ルーフ（2トーン）
  const roof = shapeFrom((s) => {
    s.moveTo(0.42, 1.625);
    s.quadraticCurveTo(0.3, 1.705, 0.12, 1.71);
    s.lineTo(-1.84, 1.718);
    s.quadraticCurveTo(-2.01, 1.715, -2.02, 1.6);
    s.lineTo(-2.0, 1.585);
    s.lineTo(-1.84, 1.645);
    s.lineTo(0.14, 1.635);
    s.closePath();
  });
  const roofMesh = new THREE.Mesh(extrude(roof, 1.54, 0.1, 0.012, 6), m.roof);
  body.add(roofMesh);
  // ルーフレール
  for (const z of [-0.6, 0.6]) {
    const rail = new THREE.Mesh(rbox(1.7, 0.035, 0.05, 0.015), m.trim);
    rail.position.set(-0.95, 1.745, z);
    body.add(rail);
  }

  // ---- ピラー（黒）とガラスの縁
  const bp = new THREE.Mesh(rbox(0.09, 0.6, 1.515, 0.02), m.gloss);
  bp.position.set(-0.18, 1.31, 0);
  body.add(bp);
  const cp = new THREE.Mesh(rbox(0.08, 0.6, 1.515, 0.02), m.gloss);
  cp.position.set(-1.42, 1.31, 0);
  body.add(cp);
  for (const z of [-1, 1]) {
    const dp = new THREE.Mesh(rbox(0.2, 0.63, 0.26, 0.05), m.body);
    dp.position.set(-1.93, 1.315, z * 0.64);
    body.add(dp);
  }
  const garnish = new THREE.Mesh(rbox(0.02, 0.03, 0.62, 0.012), m.chrome);
  garnish.position.set(-2.14, 0.72, 0);
  body.add(garnish);
  for (const z of [-0.752, 0.752]) {
    const belt = new THREE.Mesh(rbox(2.95, 0.018, 0.012, 0.006, 2), m.chrome);
    belt.position.set(-0.5, 1.012, z);
    body.add(belt);
  }

  // ---- 黒い樹脂の部分（サイドの下とタイヤまわり）
  for (const z of [-1, 1]) {
    const sill = new THREE.Mesh(rbox(1.86, 0.12, 0.05, 0.03), m.trim);
    sill.position.set(0, 0.34, z * 0.855);
    body.add(sill);
    for (const ax of [AX, -AX]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(AR - 0.03, 0.035, 10, 40, Math.PI + 0.14), m.trim);
      arch.position.set(ax, ACY, z * 0.84);
      arch.rotation.z = -0.07;
      arch.scale.set(1, 1, 0.9);
      body.add(arch);
    }
    // キャラクターライン
    const cl = new THREE.Mesh(rbox(3.6, 0.026, 0.014, 0.008, 2), m.body);
    cl.position.set(-0.05, 0.79, z * 0.856);
    body.add(cl);
    // ドアの線
    for (const [x, y0, y1] of [[1.22, 0.5, 1.0], [-0.17, 0.42, 1.0], [-1.44, 0.46, 1.0]]) {
      const ln = new THREE.Mesh(new THREE.BoxGeometry(0.008, y1 - y0, 0.006), m.gloss);
      ln.position.set(x, (y0 + y1) / 2, z * 0.853);
      body.add(ln);
    }
    // スライドドアのレール
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.01, 0.006), m.gloss);
    rail.position.set(-0.82, 0.985, z * 0.85);
    body.add(rail);
    // ドアハンドル
    for (const x of [0.62, -0.36]) {
      const h = new THREE.Mesh(rbox(0.16, 0.035, 0.02, 0.012), m.chrome);
      h.position.set(x, 0.9, z * 0.858);
      body.add(h);
    }
    // ミラー
    const mir = new THREE.Group();
    const mh = new THREE.Mesh(rbox(0.13, 0.11, 0.17, 0.04), m.body);
    mh.position.set(0, 0, 0.06);
    const mt = new THREE.Mesh(rbox(0.012, 0.012, 0.11, 0.004), m.amber);
    mt.position.set(0.06, -0.035, 0.07);
    const stalk = new THREE.Mesh(rbox(0.06, 0.04, 0.1, 0.015), m.trim);
    stalk.position.set(-0.02, -0.04, -0.03);
    mir.add(mh, mt, stalk);
    mir.position.set(1.16, 1.1, z * 0.82);
    mir.scale.z = z;
    body.add(mir);
  }

  // ---- 前まわり（やさしい顔つき）
  const front = new THREE.Group();
  for (const z of [-1, 1]) {
    const house = new THREE.Mesh(rbox(0.07, 0.15, 0.34, 0.05), m.lampHouseLight);
    house.position.set(2.085, 0.78, z * 0.53);
    house.rotation.z = -0.32;
    house.rotation.y = z * 0.2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 10, 28), m.lamp);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0.036, -0.005, z * -0.06);
    house.add(ring);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), m.lamp);
    core.position.set(0.03, -0.005, z * -0.06);
    house.add(core);
    const drl = new THREE.Mesh(rbox(0.014, 0.02, 0.2, 0.008), m.lamp);
    drl.position.set(0.034, 0.045, z * 0.05);
    house.add(drl);
    front.add(house);
    const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 20), m.lamp);
    fog.rotation.z = Math.PI / 2;
    fog.position.set(2.1, 0.43, z * 0.68);
    front.add(fog);
  }
  const grille = new THREE.Mesh(rbox(0.04, 0.07, 0.6, 0.03), m.gloss);
  grille.position.set(2.11, 0.68, 0);
  grille.rotation.z = -0.2;
  front.add(grille);
  const emb = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 10, 32), m.chrome);
  emb.position.set(2.135, 0.685, 0);
  emb.rotation.y = Math.PI / 2;
  front.add(emb);
  const smile = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.095, 0.5, -0.56), new THREE.Vector3(2.115, 0.44, -0.3), new THREE.Vector3(2.12, 0.425, 0),
    new THREE.Vector3(2.115, 0.44, 0.3), new THREE.Vector3(2.095, 0.5, 0.56)
  ]);
  const intake = new THREE.Mesh(new THREE.TubeGeometry(smile, 40, 0.038, 12, false), m.gloss);
  front.add(intake);
  const lowLip = new THREE.Mesh(rbox(0.06, 0.06, 1.3, 0.03), m.trim);
  lowLip.position.set(2.07, 0.32, 0);
  front.add(lowLip);
  body.add(front);

  // ---- 後ろまわり
  for (const z of [-1, 1]) {
    const tl = new THREE.Mesh(rbox(0.04, 0.5, 0.1, 0.03), m.tail);
    tl.position.set(-2.045, 1.2, z * 0.66);
    body.add(tl);
    const tl2 = new THREE.Mesh(rbox(0.04, 0.045, 0.22, 0.018), m.tail);
    tl2.position.set(-2.13, 0.92, z * 0.6);
    body.add(tl2);
  }
  const tbar = new THREE.Mesh(rbox(0.03, 0.022, 0.9, 0.01), m.tail);
  tbar.position.set(-2.135, 0.97, 0);
  body.add(tbar);
  const rb = new THREE.Mesh(rbox(0.06, 0.12, 1.5, 0.04), m.trim);
  rb.position.set(-2.12, 0.38, 0);
  body.add(rb);
  const spoiler = new THREE.Mesh(rbox(0.16, 0.035, 1.3, 0.015), m.roof);
  spoiler.position.set(-1.98, 1.69, 0);
  body.add(spoiler);

  // ---- タイヤ
  const wheels = [];
  for (const [x, z] of [[AX, 1], [AX, -1], [-AX, 1], [-AX, -1]]) {
    const w = makeWheel(m);
    w.position.set(x, DIM.R, z * DIM.TRACK);
    if (z < 0) w.rotation.y = Math.PI;
    car.add(w);
    wheels.push(w);
  }
  car.userData.wheels = wheels;
  car.userData.body = body;
  car.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return car;
}

// 進んだ距離に合わせてタイヤを回す
export function rollWheels(car, distance) {
  const a = -distance / DIM.R;
  for (const w of car.userData.wheels) {
    const dir = w.rotation.y === 0 ? 1 : -1;
    w.rotation.z = a * dir;
  }
}

// 地面の影（やわらかい楕円）
export function makeShadow(opacity = 0.55) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 0.5, 256, 128);
  const grd = g.createRadialGradient(0, 0, 8, 0, 0, 248);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)');
  grd.addColorStop(0.42, 'rgba(0,0,0,0.5)');
  grd.addColorStop(0.75, 'rgba(0,0,0,0.16)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(-256, -256, 512, 512);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.6), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.002;
  plane.renderOrder = -1;
  return plane;
}
