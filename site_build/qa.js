// 書き出したサイトの動作チェック（ハイドレーション・クリック操作・表示）
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, 'dist');
const OUT = path.join(__dirname, 'qa');
fs.mkdirSync(OUT, { recursive: true });

const LOCAL_FONTS = `@font-face{font-family:'Noto Sans JP';font-weight:400;src:local('Noto Sans CJK JP')}
@font-face{font-family:'Noto Sans JP';font-weight:500;src:local('Noto Sans CJK JP Medium')}
@font-face{font-family:'Noto Sans JP';font-weight:700;src:local('Noto Sans CJK JP Bold')}
@font-face{font-family:'Noto Sans JP';font-weight:900;src:local('Noto Sans CJK JP Black')}
@font-face{font-family:'Zen Kaku Gothic New';font-weight:400;src:local('Noto Sans CJK JP')}
@font-face{font-family:'Zen Kaku Gothic New';font-weight:500;src:local('Noto Sans CJK JP Medium')}
@font-face{font-family:'Zen Kaku Gothic New';font-weight:700;src:local('Noto Sans CJK JP Bold')}
@font-face{font-family:'Zen Kaku Gothic New';font-weight:900;src:local('Noto Sans CJK JP Black')}`;

function serve() {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    let f = path.join(DIST, p);
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) { res.writeHead(301, { location: encodeURI(p + '/') }); res.end(); return; }
    if (!fs.existsSync(f)) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(path.join(DIST, '404.html')).pipe(res); return; }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

const results = [];
const ok = (name, cond, info) => { results.push(`${cond ? 'OK ' : 'NG '} ${name}${info ? ' — ' + info : ''}`); };

async function open(browser, base, url, vp, js = true) {
  const ctx = await browser.newContext({ viewport: vp, javaScriptEnabled: js, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  await page.addInitScript(() => {
    window.__muts = 0;
    document.addEventListener('DOMContentLoaded', () => {}, { once: true });
    const start = () => {
      const root = document.getElementById('dc-root');
      if (!root) return;
      new MutationObserver((list) => { for (const m of list) if (m.type === 'childList') window.__muts += m.addedNodes.length + m.removedNodes.length; })
        .observe(root, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('readystatechange', function f() { if (document.readyState === 'interactive') { start(); document.removeEventListener('readystatechange', f); } });
    else start();
  });
  await page.goto(base + url, { waitUntil: 'load' });
  await page.addStyleTag({ content: LOCAL_FONTS });
  return { ctx, page, errors };
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();

  // ---- /tool/ -------------------------------------------------------------
  {
    const { ctx, page, errors } = await open(browser, base, '/tool/', { width: 1440, height: 900 });
    await page.waitForSelector('#dc-root[data-dc="live"]');
    await page.waitForTimeout(400);
    const muts = await page.evaluate(() => window.__muts);
    ok('tool: ハイドレーションでDOMを作り直していない', muts === 0, `変化したノード ${muts}`);

    // FAQ
    const faqBtn = page.locator('.fq button').first();
    const before = await page.locator('.fq p').count();
    await faqBtn.click();
    await page.waitForTimeout(100);
    const after = await page.locator('.fq p').count();
    ok('tool: よくある質問が開く', after === before + 1, `${before}→${after}`);
    await faqBtn.click();
    await page.waitForTimeout(100);
    ok('tool: よくある質問が閉じる', (await page.locator('.fq p').count()) === before);

    // 料金の切り替え
    const priceText = async () => page.evaluate(() => (document.querySelector('#price') || document.body).innerText.slice(0, 2000));
    const p1 = await priceText();
    const monthBtn = page.locator('#price button', { hasText: '月' }).first();
    if (await monthBtn.count()) {
      await monthBtn.click();
      await page.waitForTimeout(120);
      const p2 = await priceText();
      ok('tool: 料金の年払い/月払いが切り替わる', p1 !== p2 && /1,237|4,375|7,375/.test(p2));
    } else ok('tool: 料金の切り替えボタンが見つかる', false);

    // 計算機
    const calcText = async () => page.evaluate(() => document.querySelector('#calc').innerText);
    const c1 = await calcText();
    const plus = page.locator('#calc button[aria-label="アカウント数を増やす"]');
    await plus.click();
    await page.waitForTimeout(120);
    const c2 = await calcText();
    ok('tool: 年間時間の計算機が動く', c1 !== c2);

    // レポートの例のタブ
    const tabs = page.locator('.rtabs button');
    const n = await tabs.count();
    const t1 = await page.evaluate(() => document.querySelector('#reports').innerText.slice(0, 600));
    await tabs.nth(Math.min(2, n - 1)).click();
    await page.waitForTimeout(120);
    const t2 = await page.evaluate(() => document.querySelector('#reports').innerText.slice(0, 600));
    ok('tool: レポート例のタブが切り替わる', n >= 3 && t1 !== t2, `タブ${n}個`);

    // アニメーション要素が作り直されていない（クリック後も同じ要素）
    const same = await page.evaluate(() => { const a = document.querySelector('.hero2'); a.__mark = 1; return true; });
    await faqBtn.click();
    await page.waitForTimeout(80);
    const kept = await page.evaluate(() => document.querySelector('.hero2').__mark === 1);
    ok('tool: 状態が変わってもファーストビューは作り直されない', same && kept);

    ok('tool: エラーなし', errors.length === 0, errors.join(' / '));
    await page.screenshot({ path: path.join(OUT, 'tool_1440.png') });
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open(browser, base, '/tool/', { width: 390, height: 844 });
    await page.waitForSelector('#dc-root[data-dc="live"]');
    await page.evaluate(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch (e) {} });
    const share = page.locator('button.only-sp').first();
    await share.click();
    await page.waitForTimeout(300);
    const msg = await page.evaluate(() => document.body.innerText.match(/リンクをコピーしました。|PCで www\.ad-sheet\.com\/tool を開いてください。/));
    ok('tool(スマホ): 「PCに送る」でメッセージが出る', !!msg, msg && msg[0]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, 'tool_390.png') });
    ok('tool(スマホ): 横スクロールが出ない', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
    ok('tool(スマホ): エラーなし', errors.length === 0, errors.join(' / '));
    await ctx.close();
  }

  // ---- / (セカンドオピニオン) ------------------------------------------------
  {
    const { ctx, page, errors } = await open(browser, base, '/', { width: 1440, height: 900 });
    await page.waitForSelector('#dc-root[data-dc="live"]');
    await page.waitForTimeout(500);
    const muts = await page.evaluate(() => window.__muts);
    ok('top: ハイドレーションでDOMを作り直していない', muts === 0, `変化したノード ${muts}`);
    const cv = await page.evaluate(() => { const c = document.getElementById('adv3d'); return c ? c.width : -1; });
    ok('top: 3Dグラフ（canvas）が動き出す', cv > 300, `canvas幅 ${cv}`);
    // スクロールで目次の現在地が変わる
    const cur0 = await page.evaluate(() => { const a = document.querySelector('.stab[aria-current="true"]'); return a && a.textContent; });
    await page.evaluate(() => document.getElementById('s-plan').scrollIntoView());
    await page.waitForTimeout(700);
    const cur1 = await page.evaluate(() => { const a = document.querySelector('.stab[aria-current="true"]'); return a && a.textContent; });
    ok('top: スクロールで下の目次の現在地が変わる', cur0 !== cur1, `${cur0}→${cur1}`);
    const cvAfter = await page.evaluate(() => { const c = document.getElementById('adv3d'); return c && c.isConnected && c.width; });
    ok('top: 状態が変わっても canvas は同じ要素のまま', cvAfter > 300);
    // FAQ
    const fq = page.locator('button.fq');
    const nq = await fq.count();
    const exp0 = await fq.nth(1).getAttribute('aria-expanded');
    await fq.nth(1).click();
    await page.waitForTimeout(120);
    const exp1 = await fq.nth(1).getAttribute('aria-expanded');
    ok('top: よくある質問が開閉する', exp0 !== exp1, `${nq}問 ${exp0}→${exp1}`);
    // 資料DLが消えている
    ok('top: 無料資料のブロックを隠している', (await page.locator('#s-dl').count()) === 0 && (await page.locator('a[href="#s-dl"]').count()) === 0);
    // リンク
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')));
    ok('top: 予約ボタンがお問い合わせ（無料診断）へ', hrefs.includes('/inquiry/?type=shindan'));
    ok('top: LinkedInのURLが本人のもの', hrefs.filter((h) => h && h.includes('linkedin.com/in/')).length === 2);
    ok('top: フッターの特商法・プライバシー', hrefs.includes('/tokusho/') && hrefs.includes('/privacy/') && hrefs.includes('/tool/'));
    ok('top: エラーなし', errors.length === 0, errors.join(' / '));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'top_1440.png') });
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open(browser, base, '/', { width: 390, height: 844 });
    await page.waitForSelector('#dc-root[data-dc="live"]');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, 'top_390.png') });
    ok('top(スマホ): 横スクロールが出ない', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
    ok('top(スマホ): エラーなし', errors.length === 0, errors.join(' / '));
    await ctx.close();
  }
  // JSなしでも中身が見える（SSR）：HTMLそのものに本文が入っているか
  for (const [f, name] of [['index.html', 'top'], ['tool/index.html', 'tool']]) {
    const html = fs.readFileSync(path.join(DIST, f), 'utf8');
    const root = html.slice(html.indexOf('<div id="dc-root">'), html.indexOf('<script src="/assets/js/dc-lite.js'));
    const text = root.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
    ok(`${name}: JSなしでも本文が出る（検索エンジン向け）`, text.length > 3000, `${text.length}文字`);
  }

  // ---- 移したページ ---------------------------------------------------------
  for (const [url, name] of [['/tos/', 'tos'], ['/privacy/', 'privacy'], ['/tokusho/', 'tokusho'], ['/faq/', 'faq'], ['/how-to-use/', 'how'], ['/inquiry/?type=shindan', 'inquiry'], ['/nai-page', '404']]) {
    for (const w of [390, 1280]) {
      const { ctx, page, errors } = await open(browser, base, url, { width: w, height: 900 });
      await page.waitForTimeout(300);
      if (w === 390) ok(`${name}: 横スクロールが出ない`, (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
      if (name === 'inquiry' && w === 390) {
        ok('inquiry: 無料診断の案内が出る', await page.locator('#shindan').isVisible());
        const src = await page.getAttribute('#gform', 'src');
        ok('inquiry: フォームに予約用の内容が入る', /other_option_response=/.test(src) && /entry\.1665734970=/.test(src));
      }
      ok(`${name}(${w}): エラーなし`, errors.length === 0, errors.join(' / '));
      await page.screenshot({ path: path.join(OUT, `${name}_${w}.png`), fullPage: w === 390 && ['tokusho', 'inquiry', '404'].includes(name) });
      await ctx.close();
    }
  }
  {
    const { ctx, page } = await open(browser, base, '/%E3%83%9B%E3%83%BC%E3%83%A0', { width: 800, height: 600 });
    await page.waitForTimeout(500);
    ok('旧ホームURLは /tool/ へ移動', page.url().endsWith('/tool/'), page.url());
    await ctx.close();
  }

  await browser.close();
  srv.close();
  console.log(results.join('\n'));
  if (results.some((r) => r.startsWith('NG'))) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
