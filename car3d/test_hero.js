const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 810 } });
  await p.goto('http://127.0.0.1:8765/src/stage.html?w=1440&h=810&color=' + (process.argv[2] || 'mint'));
  await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  const v = JSON.parse(process.argv[3] || '{"az":32,"el":7,"dist":9.2}');
  await p.evaluate((v) => { window.api.view(v); window.api.render(); }, v);
  await p.screenshot({ path: 'out/' + (process.argv[4] || 'hero') + '.png', omitBackground: true });
  await b.close();
})();
