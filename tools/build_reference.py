"""Build the visual reference page.

Usage (from the repo root):  python -I tools/build_reference.py

Reads src/reference.src.html and fills in the current skill files:
- tokens.css and bbi-charts.js, inlined so the page works offline
- SKILL.md, docs/rules.md, tokens.css, bbi-charts.js and logo_palette.py,
  embedded for the download buttons

Writes reference.html at the repo root. Edit the source, never the output.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SK = os.path.join(ROOT, "skills", "berger-bi-ui")


def read(*p):                                   # LF everywhere, so Windows and CI build the same bytes
    return open(os.path.join(*p), encoding="utf-8").read().replace("\r\n", "\n")


files = {
    "@@TOKENS@@": read(SK, "tokens.css"),
    "@@CHARTS@@": read(SK, "bbi-charts.js"),
    "@@SKILL@@": read(SK, "SKILL.md"),
    "@@RULES@@": read(SK, "docs", "rules.md"),
    "@@PALETTE@@": read(SK, "logo_palette.py"),
}
for k, txt in files.items():
    assert "</script" not in txt.lower(), f"{k} contains </script, cannot embed"

# the whole skill as one zip (drop-in folder for ~/.claude/skills/)
import base64, io, zipfile
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:      # fixed dates: same input -> same bytes
    for dp, dns, fns in sorted(os.walk(SK)):
        dns.sort()
        for fn in sorted(fns):
            if fn.endswith(".pyc"):
                continue
            full = os.path.join(dp, fn)
            zi = zipfile.ZipInfo(os.path.join("berger-bi-ui", os.path.relpath(full, SK)).replace(os.sep, "/"), (2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            data = open(full, "rb").read()
            if not fn.endswith((".png", ".jpg", ".zip")):
                data = data.replace(b"\r\n", b"\n")
            z.writestr(zi, data)
files["@@ZIP@@"] = base64.b64encode(buf.getvalue()).decode()

out = read(ROOT, "src", "reference.src.html")
for k, txt in files.items():
    out = out.replace(k, txt)
import re
local = out.replace("@@ARTIFACT@@", "false")
assert "@@" not in local, "unfilled placeholder"
for name in ("reference.html", "index.html"):                    # index.html = GitHub Pages home
    open(os.path.join(ROOT, name), "w", encoding="utf-8", newline="\n").write(local)

# claude.ai Artifact variant: no document wrapper, downloads become copy,
# and the viewer's own dark-mode switch must not flip the product tokens.
art = out.replace("@@ARTIFACT@@", "true").replace('[data-theme="dark"]', '[data-bbi-theme="dark"]')
art = re.sub(r"<!doctype html>\s*", "", art, flags=re.I)
art = re.sub(r"</?html[^>]*>|</?head>|</?body[^>]*>", "", art)
os.makedirs(os.path.join(ROOT, "artifact"), exist_ok=True)
open(os.path.join(ROOT, "artifact", "berger-bi-ui.html"), "w", encoding="utf-8", newline="\n").write(art)
print("built", len(local) // 1024, "KB -> reference.html, index.html, artifact/berger-bi-ui.html")
