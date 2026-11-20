// 最初の表示で読み込まれるファイルと大きさ:  node netcheck.js /tool/ 1440
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, 'dist');
const [route, w, scrollSel] = process.argv.slice(2);
const srv = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIST, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } const t = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.mp4': 'video/mp4' }[path.extname(f)] || 'application/octet-stream'; res.writeHead(200, { 'content-type': t, 'content-length': fs.statSync(f).size }); fs.createReadStream(f).pipe(res); });
srv.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: Number(w), height: Number(w) < 600 ? 844 : 900 } });
  const got = new Map();
  page.on('requestfinished', async (r) => { const u = r.url(); if (!u.startsWith(base)) return; const p = u.slice(base.length); const f = path.join(DIST, decodeURIComponent(p.split('?')[0]).replace(/\/$/, '/index.html')); got.set(p.split('?')[0], fs.existsSync(f) ? fs.statSync(f).size : 0); });
  await page.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  let tot = 0; const rows = [...got.entries()].sort((a, b) => b[1] - a[1]);
  for (const [u, n] of rows) tot += n;
  console.log(route, w, 'files', rows.length, 'KB', Math.round(tot / 1024));
  for (const [u, n] of rows.slice(0, 12)) console.log(String(Math.round(n / 1024)).padStart(6), u);
  if (scrollSel) {
    await page.evaluate((s) => document.querySelector(s).scrollIntoView(), scrollSel);
    await page.waitForTimeout(1500);
    console.log('after scroll to', scrollSel, 'hero3d loaded:', got.has('/assets/img/adsheet/hero3d.webp'));
  }
  await b.close(); srv.close();
});
