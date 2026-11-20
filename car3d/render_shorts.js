// 縦型動画を書き出す
//   node render_shorts.js sheet A 1.2,4.5,8,11,15,18   … 指定秒の静止画を確認用に保存
//   node render_shorts.js video A                      … 全コマを書き出して mp4 に
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const [mode, video, list] = process.argv.slice(2);
const OUT = path.join(__dirname, 'out', 'shorts');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8765/src/shorts.html');
  await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  const total = await p.evaluate((v) => window.api.frames(v), video);
  if (mode === 'sheet') {
    const ts = list.split(',').map(Number);
    for (const t of ts) {
      const url = await p.evaluate(([v, i]) => window.api.frame(v, i, 0.9), [video, Math.min(total - 1, Math.round(t * 30))]);
      fs.writeFileSync(path.join(OUT, `sheet_${video}_${t}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    }
    console.log('frames', total, errs.join(' | '));
  } else {
    const file = path.join(OUT, `hinata_${video}_9x16.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file]);
    ff.stderr.on('data', (d) => process.stderr.write(d));
    const t0 = Date.now();
    for (let i = 0; i < total; i++) {
      const url = await p.evaluate(([v, i]) => window.api.frame(v, i, 0.94), [video, i]);
      const buf = Buffer.from(url.split(',')[1], 'base64');
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 60 === 0) console.log(video, i, '/', total, Math.round((Date.now() - t0) / 1000) + 's');
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    console.log('done', file, errs.join(' | '));
  }
  await b.close();
})();
