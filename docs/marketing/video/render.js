const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const dir = __dirname;
  const fps = Number(process.argv[2] || 30), dur = 16.5;
  const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(dir, 'promo.html'), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  const times = only || Array.from({ length: Math.round(dur * fps) }, (_, i) => i / fps);
  let n = 0;
  for (const t of times) {
    await p.evaluate((t) => window.render(t), t);
    const name = only ? `check-${t}.png` : `frames/f${String(n).padStart(4, '0')}.png`;
    await p.screenshot({ path: path.join(dir, name) });
    n++;
  }
  await b.close();
})();
