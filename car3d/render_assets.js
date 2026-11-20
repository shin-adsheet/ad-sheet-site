// 架空の車の静止画素材（360度・横向き・タイヤ）を書き出す
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out', 'assets');
fs.mkdirSync(OUT, { recursive: true });
const save = (dataUrl, file) => fs.writeFileSync(path.join(OUT, file), Buffer.from(dataUrl.split(',')[1], 'base64'));
const only = process.argv[2] || 'all';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (w, h, color = 'mint') => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto(`http://127.0.0.1:8765/src/stage.html?w=${w}&h=${h}&color=${color}`);
    await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    return p;
  };
  // 360度（色ごと36コマ）
  if (only === 'all' || only === 'spin') {
    const p = await open(640, 360);
    for (const color of ['mint', 'pearl', 'sun', 'sky']) {
      await p.evaluate((c) => window.api.setColor(c), color);
      fs.mkdirSync(path.join(OUT, 'spin', color), { recursive: true });
      for (let i = 0; i < 36; i++) {
        const url = await p.evaluate((az) => { window.api.view({ az, el: 11, dist: 12.2, ty: 0.74, fov: 16 }); return window.api.shot(); }, 90 - i * 10);
        save(url, `spin/${color}/${String(i).padStart(2, '0')}.png`);
      }
      console.log('spin', color);
    }
    await p.close();
  }
  // 横向き（ボディだけ／タイヤ1本／全体）
  if (only === 'all' || only === 'side') {
    for (const color of ['mint', 'pearl', 'sun', 'sky']) {
      const p = await open(1600, 660, color);
      const info = await p.evaluate(() => {
        const a = window.api;
        a.view({ az: 90, el: 0.01, dist: 30, fov: 4.15, ty: 0.9 });
        a.shadow.visible = true;
        const full = a.shot();
        a.showWheels(false); a.wells.visible = true;
        const bodyOnly = a.shot();
        a.wells.visible = false; a.showBody(false); a.shadow.visible = false; a.showWheels(true, 0);
        const wheel = a.shot();
        const fw = a.project(1.37, 0.315, 0.73), rw = a.project(-1.37, 0.315, 0.73), top = a.project(1.37, 0.63, 0.73);
        a.showBody(true); a.showWheels(true); a.shadow.visible = true;
        return { full, bodyOnly, wheel, fw, rw, rpx: fw.y - top.y };
      });
      save(info.full, `side_full_${color}.png`);
      save(info.bodyOnly, `side_body_${color}.png`);
      if (color === 'mint') save(info.wheel, `side_wheel_raw.png`);
      fs.writeFileSync(path.join(OUT, `side_${color}.json`), JSON.stringify({ fw: info.fw, rw: info.rw, rpx: info.rpx, w: 1600, h: 660 }));
      await p.close();
      console.log('side', color, JSON.stringify({ fw: info.fw, rw: info.rw, rpx: info.rpx }));
    }
  }
  // 斜め前（色ごと）
  if (only === 'all' || only === 'hero') {
    const p = await open(1600, 1000);
    for (const color of ['mint', 'pearl', 'sun', 'sky']) {
      await p.evaluate((c) => window.api.setColor(c), color);
      const url = await p.evaluate(() => { window.api.view({ az: 30, el: 7, dist: 11.2, ty: 0.74 }); return window.api.shot(); });
      save(url, `hero_${color}.png`);
    }
    await p.close();
    console.log('hero done');
  }
  await b.close();
})();
