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


def read(*p):
    return open(os.path.join(*p), encoding="utf-8").read()


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
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
    for dp, _, fns in os.walk(SK):
        for fn in fns:
            if fn.endswith(".pyc"):
                continue
            full = os.path.join(dp, fn)
            z.write(full, os.path.join("berger-bi-ui", os.path.relpath(full, SK)))
files["@@ZIP@@"] = base64.b64encode(buf.getvalue()).decode()

out = read(ROOT, "src", "reference.src.html")
for k, txt in files.items():
    out = out.replace(k, txt)
import re
local = out.replace("@@ARTIFACT@@", "false")
assert "@@" not in local, "unfilled placeholder"
open(os.path.join(ROOT, "reference.html"), "w", encoding="utf-8").write(local)

# claude.ai Artifact variant: no document wrapper, downloads become copy,
# and the viewer's own dark-mode switch must not flip the product tokens.
art = out.replace("@@ARTIFACT@@", "true").replace('[data-theme="dark"]', '[data-bbi-theme="dark"]')
art = re.sub(r"<!doctype html>\s*", "", art, flags=re.I)
art = re.sub(r"</?html[^>]*>|</?head>|</?body[^>]*>", "", art)
os.makedirs(os.path.join(ROOT, "artifact"), exist_ok=True)
open(os.path.join(ROOT, "artifact", "berger-bi-ui.html"), "w", encoding="utf-8").write(art)
print("built", len(local) // 1024, "KB -> reference.html + artifact/berger-bi-ui.html")
