// Renders promo.html to PNG frames, then: ffmpeg -framerate 30 -i frames/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 surfdesk-15s-4x5.mp4
// Usage: node render.js [fps] [t1,t2,...]   (times = check frames only)
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
(async () => {
  const dir = __dirname;
  const fps = Number(process.argv[2] || 30);
  const dur = 15;
  const only = process.argv[3] ? process.argv[3].split(",").map(Number) : null;
  fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await p.goto("file://" + path.join(dir, "promo.html"), { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const times = only || Array.from({ length: Math.round(dur * fps) }, (_, i) => i / fps);
  let n = 0;
  for (const t of times) {
    await p.evaluate((t) => window.render(t), t);
    const name = only ? `check-${t}.png` : `frames/f${String(n).padStart(4, "0")}.png`;
    await p.screenshot({ path: path.join(dir, name) });
    n++;
  }
  await b.close();
})();
