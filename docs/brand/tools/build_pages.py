"""Builds each brand's visual kit page from its template, the traced mark and the brief in its BRAND-KIT.md.
Run: python3 docs/brand/tools/build_pages.py"""
import html, os, re
HERE = os.path.dirname(os.path.abspath(__file__)); BRAND = os.path.dirname(HERE)
with open(os.path.join(HERE, "mark-path.txt")) as f:
    mw, mh = f.readline().split(); mark = f.read().strip()
for brand in ["surfdesk", "sonder-project"]:
    t = open(os.path.join(HERE, f"{brand}-kit.template.html")).read()
    md = open(os.path.join(BRAND, brand, "BRAND-KIT.md")).read()
    brief = re.search(r"## 0\. Paste-this brief.*?```\n(.*?)```", md, re.S).group(1).strip()
    t = t.replace("__MW__", mw).replace("__MH__", mh).replace("__MARK__", mark).replace("__BRIEF__", html.escape(brief))
    open(os.path.join(BRAND, brand, "brand-kit.html"), "w").write(t)
    print(brand, len(t))
