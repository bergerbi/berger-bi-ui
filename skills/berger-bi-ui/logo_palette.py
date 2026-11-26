"""Suggest a Berger BI data palette from a client logo.

Usage:  python -I logo_palette.py <logo.png|logo.svg> [--json]

Reads the logo's colors and ignores white, black, grays and transparent
pixels. Takes the most common colored hue as the client color and builds a
7-step ramp from it. It skips a hue that clashes with the fixed colors
(red = bad, green = good). Ori approves or changes
the suggestion; nothing is applied automatically.
"""
import colorsys, json, re, sys
from collections import Counter

FIXED = {"good": "#2E8555", "bad": "#C2412D"}
FALLBACK = "#17537F"  # Berger navy
# lightness steps for ramp: 9 (darkest) .. 0 (lightest)
STEPS = {"9": .20, "7": .30, "5": .45, "3": .64, "2": .85, "1": .93, "0": .965}


def hex_of(rgb):
    return "#%02X%02X%02X" % tuple(int(round(c)) for c in rgb)


def rgb_of(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def colorful(rgb):
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    return s > .25 and .12 < l < .85


def colors_from_png(path):
    from PIL import Image
    im = Image.open(path).convert("RGBA")
    im.thumbnail((200, 200))
    cnt = Counter()
    for r, g, b, a in (im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata()):
        if a < 200:
            continue
        q = (r // 12 * 12, g // 12 * 12, b // 12 * 12)
        if colorful(q):
            cnt[q] += 1
    return cnt


def colors_from_svg(path):
    txt = open(path, encoding="utf-8", errors="ignore").read()
    cnt = Counter()
    for m in re.findall(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", txt):
        rgb = rgb_of(m)
        if colorful(rgb):
            cnt[rgb] += 1
    return cnt


def group_by_hue(cnt):
    """Merge similar colors (hue within 15 degrees) and keep the most common one."""
    groups = []
    for rgb, n in cnt.most_common():
        h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
        for g in groups:
            if min(abs(g["h"] - h), 1 - abs(g["h"] - h)) < 15 / 360:
                g["n"] += n
                break
        else:
            groups.append({"h": h, "rgb": rgb, "n": n})
    total = sum(g["n"] for g in groups) or 1
    groups.sort(key=lambda g: -g["n"])
    return [{"hex": hex_of(g["rgb"]), "share": round(g["n"] / total, 2), "hue": round(g["h"] * 360)} for g in groups]


def clash(hue):
    if hue < 45 or hue > 340:
        return "close to the red used for 'bad'"
    if 95 <= hue <= 160:
        return "close to the green used for 'good'"
    return None


def lum(hexcol):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
    r, g, b = rgb_of(hexcol)
    return .2126 * ch(r) + .7152 * ch(g) + .0722 * ch(b)


def contrast_white(hexcol):
    return 1.05 / (lum(hexcol) + .05)


def ramp(hexcol):
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb_of(hexcol)))
    out = {}
    for k, L in STEPS.items():
        S = min(s, .75) * (1 if L < .6 else .7)
        out[k] = hex_of(tuple(c * 255 for c in colorsys.hls_to_rgb(h, L, S)))
    # step 3 is --data-l (secondary bars): at least 3:1 against white (WCAG 1.4.11)
    L3 = STEPS["3"]
    while contrast_white(out["3"]) < 3 and L3 > .2:
        L3 -= .02
        out["3"] = hex_of(tuple(c * 255 for c in colorsys.hls_to_rgb(h, L3, min(s, .75) * .85)))
    # step 7 is --brand (white text on it): darken until it reaches 4.5:1
    L = STEPS["7"]
    while contrast_white(out["7"]) < 4.5 and L > .1:
        L -= .02
        out["7"] = hex_of(tuple(c * 255 for c in colorsys.hls_to_rgb(h, L, min(s, .75))))
    return out


def suggest(path):
    cnt = colors_from_svg(path) if path.lower().endswith(".svg") else colors_from_png(path)
    groups = group_by_hue(cnt)
    notes, primary = [], None
    for g in groups:
        c = clash(g["hue"])
        if c is None:
            primary = g
            break
        notes.append(f"{g['hex']} skipped: {c}; used only in the logo, not in data")
    if primary is None:
        notes.append("no usable client hue; fell back to Berger navy")
        primary = {"hex": FALLBACK, "share": 0, "hue": None}
    r = ramp(primary["hex"])
    return {
        "logo": path,
        "logo_colors": groups[:4],
        "client_color": primary["hex"],
        "ramp": r,
        "tokens": {f"--ramp-{k}": v for k, v in r.items()},
        "brand_contrast": round(contrast_white(r["7"]), 2),
        "notes": notes,
    }


if __name__ == "__main__":
    res = suggest(sys.argv[1])
    if "--json" in sys.argv:
        print(json.dumps(res, ensure_ascii=False))
    else:
        print("client color:", res["client_color"])
        print("logo colors :", ", ".join(f"{g['hex']} ({int(g['share']*100)}%)" for g in res["logo_colors"]))
        print("ramp        :", " ".join(f"{k}:{v}" for k, v in res["ramp"].items()))
        print("paste into client.css (inside :root{ }):")
        print("  " + " ".join(f"{k}:{v};" for k, v in res["tokens"].items()))
        print("brand vs white:", res["brand_contrast"], ": 1 (min 4.5)")
        for n in res["notes"]:
            print("note        :", n)
