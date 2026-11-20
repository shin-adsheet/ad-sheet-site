const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8765/src/stage.html?w=960&h=540&color=' + (process.argv[2] || 'mint'));
  await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  const views = [{ az: 35, el: 8 }, { az: 90, el: 2 }, { az: 150, el: 10 }, { az: -20, el: 25, dist: 11 }];
  for (let i = 0; i < views.length; i++) {
    const t0 = Date.now();
    await p.evaluate((v) => { window.api.view(v); window.api.render(); }, views[i]);
    await p.screenshot({ path: `out/view${i}.png`, omitBackground: true });
    console.log('view', i, Date.now() - t0, 'ms');
  }
  console.log(errs.slice(0, 8).join('\n'));
  await b.close();
})();
