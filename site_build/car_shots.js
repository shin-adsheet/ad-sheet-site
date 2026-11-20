const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, 'dist'), OUT = path.join(__dirname, 'qa');
const LOCAL_FONTS = `@font-face{font-family:'Noto Sans JP';font-weight:400;src:local('Noto Sans CJK JP')}@font-face{font-family:'Noto Sans JP';font-weight:500;src:local('Noto Sans CJK JP Medium')}@font-face{font-family:'Noto Sans JP';font-weight:700;src:local('Noto Sans CJK JP Bold')}@font-face{font-family:'Noto Sans JP';font-weight:900;src:local('Noto Sans CJK JP Black')}`;
const srv = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIST, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } const t = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp4': 'video/mp4' }[path.extname(f)] || 'application/octet-stream'; res.writeHead(200, { 'content-type': t }); fs.createReadStream(f).pipe(res); });
srv.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch();
  const [w, h] = (process.argv[2] || '1440x900').split('x').map(Number);
  const ids = (process.argv[3] || 'c-top').split(',');
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  await page.goto(base + '/lp/car/', { waitUntil: 'load' });
  await page.addStyleTag({ content: LOCAL_FONTS });
  await page.waitForTimeout(1200);
  for (const id of ids) {
    const [sel, off] = id.split('@');
    await page.evaluate(([s, o]) => { const el = document.getElementById(s); const y = el.getBoundingClientRect().top + window.scrollY + (Number(o) || 0) - 64; window.scrollTo(0, Math.max(0, y)); }, [sel, off]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `cs_${w}_${id.replace('@', '_')}.png`) });
  }
  await b.close(); srv.close();
});
