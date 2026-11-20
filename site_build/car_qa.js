const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, 'dist');
const OUT = path.join(__dirname, 'qa');
const LOCAL_FONTS = `@font-face{font-family:'Noto Sans JP';font-weight:400;src:local('Noto Sans CJK JP')}
@font-face{font-family:'Noto Sans JP';font-weight:500;src:local('Noto Sans CJK JP Medium')}
@font-face{font-family:'Noto Sans JP';font-weight:700;src:local('Noto Sans CJK JP Bold')}
@font-face{font-family:'Noto Sans JP';font-weight:900;src:local('Noto Sans CJK JP Black')}`;
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIST, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(f);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.mp4': 'video/mp4' };
  const stat = fs.statSync(f);
  const range = req.headers.range;
  if (range && ext === '.mp4') {
    const [a, b] = range.replace('bytes=', '').split('-');
    const start = +a, end = b ? +b : stat.size - 1;
    res.writeHead(206, { 'content-type': 'video/mp4', 'content-range': `bytes ${start}-${end}/${stat.size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    fs.createReadStream(f, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'content-length': stat.size, 'accept-ranges': 'bytes' });
  fs.createReadStream(f).pipe(res);
});
const R = [];
const ok = (n, c, i) => R.push(`${c ? 'OK ' : 'NG '} ${n}${i ? ' — ' + i : ''}`);
srv.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch();
  for (const w of [1440, 390]) {
    const ctx = await b.newContext({ viewport: { width: w, height: w > 500 ? 900 : 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await page.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
    await page.addInitScript(() => { window.__muts = 0; document.addEventListener('readystatechange', () => { if (document.readyState === 'interactive') { const root = document.getElementById('dc-root'); new MutationObserver((l) => { for (const m of l) if (m.type === 'childList') window.__muts += m.addedNodes.length + m.removedNodes.length; }).observe(root, { childList: true, subtree: true }); } }); });
    await page.goto(base + '/lp/car/', { waitUntil: 'load' });
    await page.addStyleTag({ content: LOCAL_FONTS });
    await page.waitForSelector('#dc-root[data-dc="live"]');
    await page.waitForTimeout(800);
    if (w === 1440) {
      ok('car: ハイドレーションでDOMを作り直していない', (await page.evaluate(() => window.__muts)) === 0, String(await page.evaluate(() => window.__muts)));
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      ok('car: ページの高さ', true, h + 'px');
      fs.writeFileSync(path.join(OUT, 'car_height.txt'), String(h));
      // あるある
      const items = page.locator('.ai');
      await items.nth(0).click(); await items.nth(2).click(); await items.nth(4).click();
      await page.waitForTimeout(150);
      const st = await page.evaluate(() => ({ n: document.querySelector('.gnum .num').textContent, lamps: document.querySelectorAll('.lamp.on').length, msg: document.querySelector('.dmsg').textContent }));
      ok('car: あるあるで点検ランプがつく', st.n === '3' && st.lamps === 3, JSON.stringify(st));
      // 8か所
      await page.locator('.spot').nth(3).click();
      await page.waitForTimeout(120);
      const t1 = await page.textContent('.ckPanel h3');
      await page.locator('.ckNav button').nth(1).click();
      await page.waitForTimeout(120);
      const t2 = await page.textContent('.ckPanel h3');
      ok('car: 点検ポイントが切り替わる', t1 === '計測' && t2 === '自動の設定', `${t1}→${t2}`);
      // ボディカラー
      await page.locator('.paint .sw').nth(2).click();
      await page.waitForTimeout(120);
      ok('car: ファーストビューの色が変わる', await page.evaluate(() => document.querySelectorAll('.cb.on').length === 1 && document.querySelectorAll('.cb')[2].classList.contains('on')));
      // 360度
      const box = await page.locator('.spin').boundingBox();
      await page.locator('.spin').scrollIntoViewIfNeeded();
      const bp0 = await page.evaluate(() => document.querySelector('.spin').style.backgroundPosition);
      const bb = await page.locator('.spin').boundingBox();
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await page.mouse.down();
      await page.mouse.move(bb.x + bb.width / 2 - 120, bb.y + bb.height / 2, { steps: 6 });
      await page.mouse.up();
      const bp1 = await page.evaluate(() => document.querySelector('.spin').style.backgroundPosition);
      ok('car: 360度ビューをドラッグで回せる', bp0 !== bp1 && !!bp1, `${bp0} → ${bp1}`);
      await page.locator('.spinRow .sw').nth(3).click();
      await page.waitForTimeout(120);
      ok('car: 360度ビューの色が変わる', await page.evaluate(() => document.querySelector('.spin').classList.contains('c-sky') && !!document.querySelector('.spin').style.backgroundPosition));
      // FAQ
      const fq = page.locator('.fqB');
      const e0 = await fq.nth(2).getAttribute('aria-expanded');
      await fq.nth(2).click();
      await page.waitForTimeout(100);
      ok('car: よくある質問が開く', e0 === 'false' && (await fq.nth(2).getAttribute('aria-expanded')) === 'true');
      // 動画
      const v = await page.evaluate(() => [...document.querySelectorAll('video.pv')].map((x) => ({ src: x.getAttribute('src'), muted: x.muted, poster: x.getAttribute('poster') })));
      ok('car: 縦型動画が2本ある（音なし）', v.length === 2 && v.every((x) => x.muted && x.src.endsWith('.mp4')), JSON.stringify(v));
      const links = await page.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')));
      ok('car: 予約ボタンが無料診断のフォームへ', links.includes('/inquiry/?type=shindan&from=car'));
      // 画面写真（全体）
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, 'car_1440_full.png'), fullPage: true });
    } else {
      ok('car(スマホ): 横スクロールが出ない', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, String(await page.evaluate(() => document.documentElement.scrollWidth)));
      await page.screenshot({ path: path.join(OUT, 'car_390_full.png'), fullPage: true });
    }
    ok(`car(${w}): エラーなし`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
  await b.close();
  srv.close();
  console.log(R.join('\n'));
});
