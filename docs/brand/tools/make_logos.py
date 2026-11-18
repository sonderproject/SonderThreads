"""Builds every logo SVG in docs/brand/logos from the traced mark and the brand fonts (text is outlined, no font needed).
Run: python3 docs/brand/tools/make_logos.py   (needs: pip install fonttools brotli)"""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(ROOT, "docs", "brand", "logos")
FONTS = os.path.join(ROOT, "docs", "marketing", "video", "surfdesk-15", "fonts")
os.makedirs(OUT, exist_ok=True)

with open(os.path.join(HERE, "mark-path.txt")) as f:
    MW, MH = map(int, f.readline().split()); MARK = f.read().strip()

def font(name, wght):
    return instantiateVariableFont(TTFont(os.path.join(FONTS, name)), {"wght": wght})
OUTFIT_300, INTER_500 = font("outfit.woff2", 300), font("inter.woff2", 500)

def text_path(fnt, text, size, x, baseline, tracking=0.0):
    """Outlined text as an SVG path d, plus its advance width."""
    gs, cmap, hmtx = fnt.getGlyphSet(), fnt.getBestCmap(), fnt["hmtx"]
    upm = fnt["head"].unitsPerEm; s = size / upm
    pen = SVGPathPen(gs); cx = 0.0; chars = list(text)
    for i, ch in enumerate(chars):
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x + cx, baseline)))
        cx += hmtx[g][0] * s + (tracking * size if i < len(chars) - 1 else 0)
    return pen.getCommands(), cx

def cap_height(fnt, size):
    return fnt["OS/2"].sCapHeight / fnt["head"].unitsPerEm * size

def mark(x, y, h, fill):
    s = h / MH
    return f'<path transform="translate({x:.2f},{y:.2f}) scale({s:.5f})" fill="{fill}" fill-rule="evenodd" d="{MARK}"/>'

def svg(name, w, h, body, bg=None):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    with open(os.path.join(OUT, name), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}">{rect}{body}</svg>\n')

COLORS = {  # name: (mark, text, muted)
    "blue": ("#1C77B5", "#141412", "#6E5F4D"),       # on light / sand / white
    "on-dark": ("#62B4E6", "#F3F0EB", "#AEA08D"),    # on obsidian / dark
    "black": ("#141412", "#141412", "#141412"),      # one-color print
    "white": ("#FFFFFF", "#FFFFFF", "#FFFFFF"),      # one-color reversed
}

# 1. The mark alone (S wave), every color incl. the reference surf blue.
for n, c in {"surf-blue": "#3E9BD4", "blue": "#1C77B5", "light-blue": "#62B4E6", "black": "#141412", "white": "#FFFFFF", "sand": "#F6F4EF"}.items():
    svg(f"mark-{n}.svg", MW, MH, mark(0, 0, MH, c))

for n, (mc, tc, mu) in COLORS.items():
    # 2. Surfdesk horizontal lockup: mark + "Surfdesk" (Outfit Light, -0.02em).
    H = 100; mw = MW / MH * H; size = 92; ch = cap_height(OUTFIT_300, size)
    base = H / 2 + ch / 2; gap = H * 0.32
    d, tw = text_path(OUTFIT_300, "Surfdesk", size, mw + gap, base, -0.02)
    svg(f"surfdesk-lockup-{n}.svg", mw + gap + tw + 2, H, mark(0, 0, H, mc) + f'<path fill="{tc}" d="{d}"/>')

    # 3. Surfdesk stacked: mark over wordmark over "BY SONDER PROJECT".
    H2 = 160; mw2 = MW / MH * H2; size2 = 110; ch2 = cap_height(OUTFIT_300, size2)
    d2, tw2 = text_path(OUTFIT_300, "Surfdesk", 0 and size2 or size2, 0, 0, -0.02)
    small = 26; d3, tw3 = text_path(INTER_500, "BY SONDER PROJECT", small, 0, 0, 0.22)
    W = max(tw2, tw3, mw2) + 20
    y_word = H2 + 48 + ch2; y_by = y_word + 30 + cap_height(INTER_500, small) + 16
    d2, _ = text_path(OUTFIT_300, "Surfdesk", size2, (W - tw2) / 2, y_word, -0.02)
    d3, _ = text_path(INTER_500, "BY SONDER PROJECT", small, (W - tw3) / 2, y_by, 0.22)
    svg(f"surfdesk-stacked-{n}.svg", W, y_by + 8, mark((W - mw2) / 2, 0, H2, mc) + f'<path fill="{tc}" d="{d2}"/><path fill="{mu}" d="{d3}"/>')

    # 4. Sonder Project lockup: mark + "SONDER PROJECT" (Outfit Light, uppercase, +0.25em).
    H = 100; mw = MW / MH * H; size = 46; ch = cap_height(OUTFIT_300, size)
    d, tw = text_path(OUTFIT_300, "SONDER PROJECT", size, mw + H * 0.36, H / 2 + ch / 2, 0.25)
    svg(f"sonder-project-lockup-{n}.svg", mw + H * 0.36 + tw + 2, H, mark(0, 0, H, mc) + f'<path fill="{tc}" d="{d}"/>')

    # 5. Surfdesk small-caps lockup used in the app header (mark + "SURFDESK", +0.25em).
    d, tw = text_path(OUTFIT_300, "SURFDESK", size, mw + H * 0.36, H / 2 + ch / 2, 0.25)
    svg(f"surfdesk-header-lockup-{n}.svg", mw + H * 0.36 + tw + 2, H, mark(0, 0, H, mc) + f'<path fill="{tc}" d="{d}"/>')

# 6. Square icons and avatars (full-bleed backgrounds).
def square(name, size, bg, mc, scale=0.62):
    h = size * scale / (MW / MH); w = size * scale
    svg(name, size, size, mark((size - w) / 2, (size - h) / 2, h, mc), bg)
square("surfdesk-app-icon.svg", 1024, "#0A0A09", "#62B4E6")
square("surfdesk-avatar-sand.svg", 400, "#F6F4EF", "#1C77B5")
square("surfdesk-avatar-dark.svg", 400, "#0A0A09", "#62B4E6")
square("sonder-project-avatar.svg", 400, "#0A0A09", "#F3F0EB")
square("favicon.svg", 64, None, "#1C77B5", 0.96)

# 7. LinkedIn covers, 1512x256 (logo overlaps bottom-left, so content sits right).
def cover(name, line1, line2, bg, fg, accent, muted):
    W, H = 1512, 256
    d1, w1 = text_path(OUTFIT_300, line1, 46, 0, 0, -0.02)
    d2, w2 = text_path(OUTFIT_300, line2, 46, 0, 0, -0.02)
    small = 15; tag = "THESURFDESK.APP" if "surfdesk" in name else "MAKERS OF SURFDESK"
    x = W - 80 - max(w1, w2)
    d1, _ = text_path(OUTFIT_300, line1, 46, x, 112, -0.02)
    d2, _ = text_path(OUTFIT_300, line2, 46, x, 168, -0.02)
    ds, _ = text_path(INTER_500, tag, small, x, 212, 0.22)
    big = mark(380, -60, 380, accent).replace('fill="', 'fill-opacity="0.09" fill="')
    svg(name, W, H, big + f'<path fill="{fg}" d="{d1}"/><path fill="{accent}" d="{d2}"/><path fill="{muted}" d="{ds}"/>', bg)
cover("surfdesk-linkedin-cover.svg", "Every task. Every client.", "Every follow-up. Organized.", "#F6F4EF", "#141412", "#1C77B5", "#6E5F4D")
cover("sonder-project-linkedin-cover.svg", "We build calm software", "for busy people.", "#0A0A09", "#F3F0EB", "#62B4E6", "#AEA08D")
print("ok", len(os.listdir(OUT)))
