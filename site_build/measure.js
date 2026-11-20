// セクションごとの高さを測る:  node measure.js /path/ 390
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, 'dist');
const [route, w] = process.argv.slice(2);
const LOCAL_FONTS = `@font-face{font-family:'Noto Sans JP';font-weight:400;src:local('Noto Sans CJK JP')}@font-face{font-family:'Noto Sans JP';font-weight:500;src:local('Noto Sans CJK JP Medium')}@font-face{font-family:'Noto Sans JP';font-weight:700;src:local('Noto Sans CJK JP Bold')}@font-face{font-family:'Noto Sans JP';font-weight:900;src:local('Noto Sans CJK JP Black')}@font-face{font-family:'Zen Kaku Gothic New';font-weight:400;src:local('Noto Sans CJK JP')}@font-face{font-family:'Zen Kaku Gothic New';font-weight:700;src:local('Noto Sans CJK JP Bold')}@font-face{font-family:'Zen Kaku Gothic New';font-weight:900;src:local('Noto Sans CJK JP Black')}`;
const srv = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIST, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } const t = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream'; res.writeHead(200, { 'content-type': t }); fs.createReadStream(f).pipe(res); });
srv.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: Number(w), height: 844 } });
  await page.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  await page.goto(base + route, { waitUntil: 'load' });
  await page.addStyleTag({ content: LOCAL_FONTS });
  await page.waitForTimeout(1200);
  const rows = await page.evaluate(() => {
    const root = document.querySelector('[data-dc]') || document.body;
    // 直下の大きなブロックを拾う
    let kids = [...document.querySelectorAll('section, header, footer, main > div')].filter(e => !e.parentElement.closest('section'));
    return kids.map(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { tag: e.tagName.toLowerCase(), id: e.id || '', cls: (e.className && e.className.baseVal === undefined ? e.className : '').toString().slice(0, 30), top: Math.round(r.top + scrollY), h: Math.round(r.height), pt: cs.paddingTop, pb: cs.paddingBottom }; });
  });
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(route, w, 'total', total);
  for (const r of rows) if (r.h > 40) console.log(String(r.h).padStart(6), String(r.top).padStart(6), r.tag, r.id, r.cls, 'pad', r.pt, r.pb);
  await b.close(); srv.close();
});
