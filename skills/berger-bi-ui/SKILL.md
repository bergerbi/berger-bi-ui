---
name: berger-bi-ui
description: Berger BI visual language for client dashboard demos and BI product screens in Hebrew (RTL). Use when building or changing the UI of a Berger BI dashboard, demo, screen or page (layout, KPIs, filters, insights, charts, tables, admin, login). Not for data, DAX, SQL or back-end work. For HTML-in-DAX Power BI visuals use powerbi-html-builder and borrow only the colors and type sizes from here.
---

# Berger BI UI

## Keep it light
- Do the task. No extra planning docs and no self-review loops unless asked.
- **Never read** `bbi-charts.js`, `bbi-shell.js`, `tokens.css` or any `reference.html` into context. Copy them.
- Open docs only when needed:
  - `docs/charts.md` when drawing charts.
  - `docs/rules.md` (Hebrew, full rules) when building a screen type not in the starter.
  - `docs/product.md` only for a real product, not a demo.
- Use the starter's classes and `BBI.*` charts. No custom CSS or SVG for something the kit already has.

## New screen or demo
1. Copy these from `${CLAUDE_SKILL_DIR}` next to the page: `starter.html`, `tokens.css`, `client.css`, `bbi-charts.js`, `bbi-shell.js`, `bbi-logo.png`.
2. Rename `starter.html` and read it (17 KB, it is the template). Replace the demo data inside `draw(state)` and keep the structure: one `.view` per screen with its own KPI band and grid. `draw` runs again on every filter or screen change. Data that isn't real is fine, as long as it carries the "נתוני הדגמה" badge.
3. Client color: run `python -I ${CLAUDE_SKILL_DIR}/logo_palette.py <logo>` (needs Pillow for PNG), then paste the printed line into `client.css` (10 lines). If there is no logo, skip this step.
4. Check: open the page with `?audit` and inject `bbi-audit.js` from the browser console (don't ship it to the client). The result must be an empty list; it also fails on an empty page. To check the page at every size and in dark mode, run `node tools/audit.mjs` from the repo.

## Hard rules
- **Layout:**
  - Top bar: detached, rounded, dark (client ramp-9). Tabs are pills. It also shows data freshness ("עודכן", "הרענון הבא").
  - Admin (users, permissions, log, settings) lives only in the user menu.
  - Right panel: period and compare-to as segmented buttons, then filters. It collapses.
  - Overview: a "דורש טיפול" strip (the top exception with its amount, plus a ranked list), then the KPI band, then the visuals.
  - Each screen has its own KPI band. The lead visual is 2×2. Depth goes into tabs, tables and drill, never into page scroll.
  - Footer: "נבנה על ידי" + the Berger BI logo, and data freshness.
  - Ask-the-data is a round floating button in the bottom-left corner.
  - No page scroll at 1440×900 or 1920×1080.
- **Type:** only 13, 15, 20, and 30 (KPI). Nothing below 13. Wrap numbers in `.n`, and keep Hebrew words outside it.
- **Color:**
  - Client ramp for data.
  - Red = bad (below target, a drop, late). Green = good (variance charts and arrows). Arrows are colored by good/bad, not by direction.
  - Last year is grey. The target is a dark tick. No orange.
- **Banned:** shadows (except menus), gradients (except loading), colored stripes on cards, icon bubbles, pastel pills, emojis, decorative sparklines.
- **Numbers:** `BBI.he = true` writes units in Hebrew (`₪4.97 מיליון`, `₪62 אלף`). The headline total may be exact (`₪14,213,480`).
- **KPI:** one bordered band. The lead KPI comes first and is wider. Each KPI has a change line (`▲ 6% מול אשתקד`) or a definition line (`.kpi-n`).
- **Charts:** one `BBI.*` call per chart, with `title`. Time runs left to right.
- **Trust:** a `.note` line under any card whose number needs it: an open month is not compared, a small base gets no %, holidays fall in different months, and what is excluded.
- **Tables:** `.dtw` > `table.dt`, with sort marks, status as a colored word, and "הצגת כל N". The table scrolls inside its card.
- **Insights:** ranked by money. Each has a kind, a title with a number, the amount, מה קרה / למה / צפי / מומלץ, and "הראה לי" / "פתח תחקור".
- **Demo:** show the "נתוני הדגמה" badge whenever data is not real. Never invent client data.
- **Text:** plain short Hebrew ("לא הצלחנו לטעון את הנתונים", not "Error").
