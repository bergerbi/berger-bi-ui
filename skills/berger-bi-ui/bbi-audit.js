/* ============================================================================
   bbi-audit.js · checks a Berger BI page against the hard rules, no model needed
   Use: add <script src="bbi-audit.js"></script> and open the page with #audit,
        or paste this file into the browser console. Then call BBIaudit().
   Prints a table and returns the list of problems ([] = clean).
   Checks: allowed text sizes, nothing under 12px, no page scroll / clipped main,
   no shadows (except menus) or gradients (except loading), no emoji, no colored
   stripes on cards, text contrast >= 4.5:1, chart labels that overlap.
   ============================================================================ */
(function () {
  function rgb(c) { const m = c.match(/[\d.]+/g); return m ? m.slice(0, 4).map(Number) : [0, 0, 0, 0]; }
  function lum([r, g, b]) { const f = v => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); }
  function bgOf(el) { while (el && el.nodeType === 1) { const c = rgb(getComputedStyle(el).backgroundColor); if (c[3] === undefined || c[3] > .5) return c; el = el.parentElement; } return [255, 255, 255]; }
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
  const name = el => (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || el.tagName.toLowerCase();

  window.BBIaudit = function () {
    const out = [], add = (rule, where, detail) => out.push({ rule, where, detail });
    const root = getComputedStyle(document.documentElement);
    const allowed = ["--fs-s", "--fs-m", "--fs-l", "--fs-kpi"].map(v => Math.round(parseFloat(root.getPropertyValue(v)) * 2) / 2);

    document.querySelectorAll("body *").forEach(el => {
      if (el.closest("script,style,.tip,[hidden]")) return;
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      const cs = getComputedStyle(el);
      if (own && visible(el)) {
        const fs = Math.round(parseFloat(cs.fontSize) * 2) / 2;
        if (fs < 12) add("text under 12px", name(el), fs + "px: " + el.textContent.trim().slice(0, 30));
        else if (!allowed.includes(fs) && !el.closest("svg")) add("size outside the 4 sizes", name(el), fs + "px: " + el.textContent.trim().slice(0, 30));
        if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(el.textContent)) add("emoji", name(el), el.textContent.trim().slice(0, 30));
        if (!el.closest("svg")) {
          const fg = rgb(cs.color), bg = bgOf(el), a = lum(fg), b = lum(bg);
          const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
          if (ratio < 4.5 && !el.closest("[aria-disabled='true'],:disabled")) add("contrast < 4.5:1", name(el), ratio.toFixed(2) + ": " + el.textContent.trim().slice(0, 30));
        }
      }
      if (cs.boxShadow !== "none" && !el.closest(".menu,.pop,.ask-panel,.ask-fab,.modal,.tour,.tour-hole")) add("shadow", name(el), cs.boxShadow);
      if (/gradient/.test(cs.backgroundImage) && !el.closest(".sk")) add("gradient", name(el), cs.backgroundImage.slice(0, 40));
      const bw = parseFloat(cs.borderInlineStartWidth || cs.borderRightWidth);
      if (bw >= 3 && el.matches(".card,.ins,.kpi")) add("colored stripe on a card", name(el), bw + "px");
    });

    const se = document.scrollingElement;
    if (se.scrollHeight > innerHeight + 1 && innerWidth >= 760) add("page scrolls", "document", se.scrollHeight + " > " + innerHeight);
    if (se.scrollWidth > innerWidth + 1) add("horizontal scroll", "document", se.scrollWidth + " > " + innerWidth);
    document.querySelectorAll(".mn,.card").forEach(el => { if (el.scrollHeight > el.clientHeight + 2) add("content clipped", name(el), el.scrollHeight + " > " + el.clientHeight); });

    document.querySelectorAll(".bbi-chart svg").forEach(svg => {
      const els = [...svg.querySelectorAll("text")].filter(t => t.textContent.trim() && t.getAttribute("x") !== "-9999");
      const ts = els.map(t => t.getBoundingClientRect());
      for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
        const a = ts[i], b = ts[j];
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) { add("chart labels overlap", svg.getAttribute("aria-label") || "chart", `"${els[i].textContent}" / "${els[j].textContent}"`); i = ts.length; break; }
      }
    });
    // an empty page must not pass: a screen must be visible and every visible chart drawn
    const views = [...document.querySelectorAll("[data-screen-view]")];
    if (views.length && !views.some(v => !v.hidden && visible(v))) add("no screen visible", "data-screen-view", "check the URL hash");
    document.querySelectorAll(".chart").forEach(c => { if (visible(c) && !c.querySelector("svg")) add("chart not drawn", c.id || "chart", "no BBI.* call for this element?"); });
    const shown = [...document.querySelectorAll(".chart")].filter(c => c.offsetParent);   // only the visible screen
    if (shown.length && !shown.some(c => c.querySelector("svg"))) add("no charts drawn", "page", "");
    console.table(out);
    return out;
  };
  // run with ?audit (or #audit) in the URL. Check-only: do not ship this file to clients.
  if (/[?&#]audit/.test(location.search + location.hash)) addEventListener("load", () => setTimeout(() => window.BBIaudit(), 500));
})();
