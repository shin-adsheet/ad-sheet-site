// ページを上から順にスクロールしながら撮って、4枚ずつ並べた確認用の画像を作る
//   node audit.js /lp/car/ 390x844 car_m
const fs = require('fs'), path = require('path'), http = require('http');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, 'dist'), OUT = path.join(__dirname, 'qa', 'audit');
fs.mkdirSync(OUT, { recursive: true });
const [route, vp, name, stepArg] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const LOCAL_FONTS = `@font-face{font-family:'Noto Sans JP';font-weight:400;src:local('Noto Sans CJK JP')}@font-face{font-family:'Noto Sans JP';font-weight:500;src:local('Noto Sans CJK JP Medium')}@font-face{font-family:'Noto Sans JP';font-weight:700;src:local('Noto Sans CJK JP Bold')}@font-face{font-family:'Noto Sans JP';font-weight:900;src:local('Noto Sans CJK JP Black')}@font-face{font-family:'Zen Kaku Gothic New';font-weight:400;src:local('Noto Sans CJK JP')}@font-face{font-family:'Zen Kaku Gothic New';font-weight:500;src:local('Noto Sans CJK JP Medium')}@font-face{font-family:'Zen Kaku Gothic New';font-weight:700;src:local('Noto Sans CJK JP Bold')}@font-face{font-family:'Zen Kaku Gothic New';font-weight:900;src:local('Noto Sans CJK JP Black')}`;
const srv = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIST, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } const t = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.mp4': 'video/mp4' }[path.extname(f)] || 'application/octet-stream'; res.writeHead(200, { 'content-type': t }); fs.createReadStream(f).pipe(res); });
srv.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  await page.goto(base + route, { waitUntil: 'load' });
  await page.addStyleTag({ content: LOCAL_FONTS });
  await page.waitForTimeout(1500);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.round(H * (Number(stepArg) || 0.92));
  const shots = [];
  for (let y = 0, i = 0; y < total; y += step, i++) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(450);
    const f = path.join(OUT, `${name}_${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: f });
    shots.push(f);
    if (y + H >= total) break;
  }
  await b.close(); srv.close();
  // 4枚ずつ並べる
  const per = 4;
  const py = `
from PIL import Image
import sys, json
shots = json.loads(sys.argv[1]); W=${W}; H=${H}; per=${per}; name='${name}'; out='${OUT}'
scale = 1 if W < 500 else 0.5
for k in range(0, len(shots), per):
    grp = shots[k:k+per]
    w=int(W*scale); h=int(H*scale)
    s = Image.new('RGB', (w*len(grp)+12*(len(grp)-1), h), (70,70,70))
    for i,f in enumerate(grp):
        s.paste(Image.open(f).convert('RGB').resize((w,h)), (i*(w+12), 0))
    s.save(f'{out}/{name}_sheet{k//per}.jpg', quality=80)
print(len(shots), 'shots', (len(shots)+per-1)//per, 'sheets')
`;
  console.log('height', total, execFileSync('python3', ['-c', py, JSON.stringify(shots)]).toString().trim());
});
