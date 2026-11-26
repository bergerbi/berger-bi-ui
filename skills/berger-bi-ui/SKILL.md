---
name: berger-bi-ui
description: Berger BI visual language for dashboard demos and product screens. Use only when building or changing the UI of a Berger BI screen, page or demo (layout, KPIs, filters, insights, charts, tables, admin, login). Not for data, DAX, SQL or back-end work.
---

# Berger BI UI · v1.1

## Keep it light (read first)
- Do the task. No ceremony, no extra planning docs, no self-review loops unless asked.
- **Never read** `bbi-charts.js`, `tokens.css` or `reference.html` into context. Copy or link them.
- Open `docs/rules.md` (full rules, Hebrew) only when building a new screen from scratch or when asked to review against the standard. Open `docs/charts.md` only when drawing a chart.
- Use existing classes and `BBI.*` charts. Do not write custom CSS or SVG for something the kit already has.

## Start a screen
1. Copy `tokens.css` and `bbi-charts.js` next to the page. Link both. `<html lang="he" dir="rtl">`.
2. Client color: run `python -I logo_palette.py <logo>`, then paste its `--ramp-*` line into the CLIENT block of `tokens.css`. Change nothing else.
3. Shell: `.app > .hd + .rp + .mn + .ft`. Markup pattern: `reference.html`, part א.

## Fixed layout
- Header: client logo and product name on the right, business screens as top tabs, then search, bell and user on the left.
- Admin (users, permissions, activity log, settings, metric glossary) lives only in the user menu.
- Right panel, top to bottom: period, filters, insights. It collapses to a 44px rail.
- Main: title row (title, one-line summary, demo badge, then views and export at the end). Below it the KPI band, then 6 visuals. The lead visual spans 2×2.
- Footer: "נבנה על ידי" + Berger BI logo, and data freshness.
- "Ask the data" is a floating round button (`.ask-fab`), bottom-left. It opens the chat panel.
- No page scroll at 1440×900 or 1920×1080. Tables show the rows that fit, then pages.
- More than 7 screens: use `.app.nav-side` (screens move to a right sidebar).

## Hard rules
- **Type:** only 12, 13, 19 and 28 (KPI numbers). Nothing below 12. Numbers use `.num`, and are wrapped in `.n`.
- **Color:** client ramp for data. Orange only for exceptions. Green and red only for change arrows, colored by good/bad, not by direction. Grey for target and comparison.
- **Banned:** shadows (except menus), gradients (except loading), colored stripes on cards, icon bubbles, pastel pills, emojis, decorative sparklines.
- **KPI:** one bordered band. Lead KPI is first and wider. Values have at most 3 significant digits: `₪14.2M`, `8.41K`. Each has a change line: `▲ 6% מול אשתקד`.
- **Charts:** one `BBI.*` call per chart. Time runs left to right. Highlight at most 3 items. Labels on the data, no legend.
- **Insights:** kind (word) / title with number / מה קרה / למה / צפי / מומלץ / "הראה לי". No insight that only repeats a number.
- **Filters:** shared across tabs, kept in sessionStorage and in the URL hash.
- **Demo:** "נתוני הדגמה" badge whenever data is not real. Never invent client data. Lock the demo with `lock.py`.
- **Text:** plain short Hebrew. "לא הצלחנו לטעון את הנתונים", not "Error".

## Every product also has
Ask-the-data answers (number, mini chart, source, "show me"), bell alerts with user rules, saved views and share link, export (Excel / PDF / image / scheduled mail), metric definitions on hover, targets and thresholds, users, permissions matrix, append-only activity log, login with 2FA, first-login tour, and states: loading, empty, error, stale, no permission, partial. Details are in `docs/rules.md` §11.

## Changing this skill
Anyone on the team may edit. Bump `version` in `.claude-plugin/plugin.json`, add one line to `CHANGELOG.md`, run `python -I tools/build_reference.py`, and push.
