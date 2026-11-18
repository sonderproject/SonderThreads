// Renders every SVG in docs/brand/{surfdesk,sonder-project}/logos to PNG (transparent where the SVG has no background).
// Run: NODE_PATH=$(npm root -g) node docs/brand/tools/render_pngs.js
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const widthFor = (f) => (f.startsWith("mark-") ? 1024 : /lockup|stacked/.test(f) ? 1600 : null); // null = native size x2 (x1 for icons)
(async () => {
  const b = await chromium.launch();
  for (const dir of ["surfdesk", "sonder-project"].map((b) => path.join(__dirname, "..", b, "logos")))
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
    const svg = fs.readFileSync(path.join(dir, f), "utf8");
    const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
    const icon = /icon|avatar|favicon/.test(f);
    const outW = widthFor(f) || (icon ? w : w * 2);
    const outH = Math.round((outW * h) / w);
    const p = await b.newPage({ viewport: { width: Math.round(outW), height: outH }, deviceScaleFactor: 1 });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await p.screenshot({ path: path.join(dir, f.replace(/\.svg$/, ".png")), omitBackground: true });
    await p.close();
  }
  await b.close();
})();
