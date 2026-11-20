const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  for (const n of ['top', 'tool', 'car']) {
    await p.goto('file://' + path.join(__dirname, n + '.html'));
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(__dirname, 'og-' + n + '.png') });
  }
  await b.close();
})();
