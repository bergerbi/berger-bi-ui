/* ============================================================================
   bbi-shell.js · Berger BI shell behaviour · no dependencies
   Wires the standard shell in starter.html. Everything is driven by data-* attributes:
     data-pop="id"        toggles #id (menus: user, bell, views, export); click outside closes
     data-act="collapse"  collapses/expands the right panel (remembered per browser)
     data-act="sheet"     opens the filter sheet on tablet/phone (.fbtn)
     data-act="ask"       opens/closes the ask-the-data panel
     data-act="theme"     dark mode on/off (products only; remembered)
     data-act="ceo"       CEO mode (larger type) on/off
     data-f="key" data-v="value" on a .chip   toggles a filter value
     .tabs a[data-screen="name"]               switches screen
   Filter state is shared by all tabs, kept in sessionStorage and in the URL hash
   (#screen?key=a,b&period=ytd), so refresh and shared links open the same view.
   Listen:  document.addEventListener('bbi:state', e => render(e.detail))
   API:     BBIShell.state, BBIShell.set(key, values), BBIShell.toast(msg, undoFn)
   ============================================================================ */
(function () {
  const html = document.documentElement, app = () => document.querySelector(".app");
  const store = {
    get: (k, s) => { try { return (s ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set: (k, v, s) => { try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (e) { } }
  };
  const state = { screen: "", f: {} };

  function readHash() {
    const dec = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };   // a broken link never kills the page
    const h = location.hash.slice(1); if (!h || h === "audit") return false;
    const [screen, q] = h.split("?"); state.screen = dec(screen); state.f = {};
    (q || "").split("&").filter(Boolean).forEach(p => { const [k, v] = p.split("="); state.f[dec(k)] = v ? v.split(",").map(dec) : []; });
    return true;
  }
  function validScreen() {                              // unknown / old screen names fall back to the first tab
    const tabs = [...document.querySelectorAll(".tabs a[data-screen]")].map(a => a.dataset.screen);
    if (tabs.length && !tabs.includes(state.screen)) state.screen = tabs[0];
  }
  function writeHash() {
    const q = Object.entries(state.f).filter(([, v]) => v.length).map(([k, v]) => encodeURIComponent(k) + "=" + v.map(encodeURIComponent).join(",")).join("&");
    history.replaceState(null, "", "#" + state.screen + (q ? "?" + q : ""));
    store.set("bbi-state", JSON.stringify(state), true);
  }
  function paint() {
    validScreen();
    document.querySelectorAll(".chip[data-f]").forEach(c => { const on = (state.f[c.dataset.f] || []).includes(c.dataset.v); c.classList.toggle("on", on); c.setAttribute("aria-pressed", on); });
    document.querySelectorAll(".tabs a[data-screen]").forEach(a => { const on = a.dataset.screen === state.screen; a.classList.toggle("on", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
    document.querySelectorAll("[data-screen-view]").forEach(v => v.hidden = v.dataset.screenView !== state.screen);
    const SYS = ["period", "cmp"];                       // period + comparison are not "filters"
    const active = Object.entries(state.f).filter(([k]) => !SYS.includes(k));
    const n = active.reduce((s, [, v]) => s + v.length, 0);
    document.querySelectorAll("[data-count='filters']").forEach(e => { e.textContent = n; e.hidden = !n; });
    // period / comparison pickers: mark the choice and show its label
    [["period", "data-period"], ["cmp", "data-cmp"]].forEach(([k, attr]) => {
      const cur = (state.f[k] || [])[0];
      document.querySelectorAll("[" + attr + "]").forEach(b => {
        const on = cur ? b.getAttribute(attr) === cur : b.hasAttribute("data-default");
        b.classList.toggle("on", on);
        if (on) document.querySelectorAll("[" + attr + "-label]").forEach(l => l.textContent = b.textContent.trim());
      });
    });
    // applied-filters row under the title
    document.querySelectorAll("[data-applied]").forEach(row => {
      row.innerHTML = ""; row.hidden = !n; if (!n) return;
      row.append("מסונן לפי:");
      active.forEach(([k, vals]) => vals.forEach(v => {
        const src = document.querySelector(`.chip[data-f="${CSS.escape(k)}"][data-v="${CSS.escape(v)}"]`);
        const b = document.createElement("button"); b.className = "chip on"; b.dataset.unset = k + "|" + v;
        b.textContent = src ? src.textContent.trim() : v; b.setAttribute("aria-label", "הסרת " + b.textContent); row.append(b);
      }));
      const c = document.createElement("a"); c.className = "lnk"; c.dataset.act = "clear"; c.textContent = "נקה הכל"; row.append(c);
    });
    document.dispatchEvent(new CustomEvent("bbi:state", { detail: JSON.parse(JSON.stringify(state)) }));
  }
  function set(key, values) { state.f[key] = values; writeHash(); paint(); }

  function toast(msg, undo) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.innerHTML = ""; t.append(msg);
    if (undo) { const b = document.createElement("button"); b.textContent = "ביטול"; b.onclick = () => { undo(); t.hidden = true; }; t.append(b); }
    t.hidden = false;
    const arm = () => { clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 5000); };
    t.onmouseenter = () => clearTimeout(toast.t); t.onmouseleave = arm; arm();   // hover pauses the undo window
  }

  let opener = null;                                     // focus goes back here when a menu closes
  function closePops(except) {
    document.querySelectorAll("[data-popup]").forEach(p => { if (p !== except && !p.hidden) { p.hidden = true; document.querySelector(`[data-pop="${p.id}"]`)?.setAttribute("aria-expanded", "false"); } });
  }

  document.addEventListener("click", e => {
    const pop = e.target.closest("[data-pop]");
    if (pop) {
      const t = document.getElementById(pop.dataset.pop);
      if (t) { t.setAttribute("data-popup", ""); closePops(t); t.hidden = !t.hidden; pop.setAttribute("aria-expanded", String(!t.hidden)); opener = pop;
        if (!t.hidden) t.querySelector("button,a,input")?.focus(); }
      e.stopPropagation(); return;
    }
    if (!e.target.closest("[data-popup]")) closePops();
    const act = e.target.closest("[data-act]"), a = app();
    if (act) {
      const k = act.dataset.act;
      if (k === "collapse" && a) { a.classList.toggle("col"); store.set("bbi-col", a.classList.contains("col") ? "1" : ""); }
      if (k === "sheet" && a) a.classList.toggle("sheet");
      if (k === "ask") { const p = document.querySelector(".ask-panel"); if (p) { p.hidden = !p.hidden; opener = document.querySelector(".ask-fab"); if (!p.hidden) p.querySelector("input")?.focus(); else opener?.focus(); } }
      if (k === "theme") { const d = html.dataset.theme === "dark"; d ? delete html.dataset.theme : html.dataset.theme = "dark"; store.set("bbi-theme", d ? "" : "dark"); }
      if (k === "ceo") html.classList.toggle("ceo");
    }
    if (e.target.closest(".sheet-bg") && a) a.classList.remove("sheet");
    const chip = e.target.closest(".chip[data-f]");
    if (chip) {
      const k = chip.dataset.f, v = chip.dataset.v, before = (state.f[k] || []).slice();
      set(k, before.includes(v) ? before.filter(x => x !== v) : before.concat(v));
    }
    const un = e.target.closest("[data-unset]");
    if (un) { const [k, v] = un.dataset.unset.split("|"); set(k, (state.f[k] || []).filter(x => x !== v)); }
    const per = e.target.closest("[data-period]"), cmp = e.target.closest("[data-cmp]");
    if (per) { set("period", [per.dataset.period]); closePops(); }
    if (cmp) { set("cmp", [cmp.dataset.cmp]); closePops(); }
    const clear = e.target.closest("[data-act='clear']");
    if (clear) {                                        // clears filters, keeps period + comparison
      e.preventDefault();
      const before = JSON.parse(JSON.stringify(state.f));
      const had = Object.entries(state.f).some(([k, v]) => k !== "period" && k !== "cmp" && v.length);
      Object.keys(state.f).forEach(k => { if (k !== "period" && k !== "cmp") delete state.f[k]; });
      writeHash(); paint();
      if (had) toast("הפילטרים נוקו", () => { state.f = before; writeHash(); paint(); });
    }
    const tab = e.target.closest(".tabs a[data-screen]");
    if (tab) { e.preventDefault(); state.screen = tab.dataset.screen; writeHash(); paint(); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closePops(); const p = document.querySelector(".ask-panel"); if (p) p.hidden = true; app()?.classList.remove("sheet");
      opener?.focus(); opener = null;
    }
    // "Enter" on role=button elements (show-me links, clear) works like a click
    if (e.key === "Enter" && e.target.matches("[role='button']:not(button)")) e.target.click();
  });
  function decorate() {                                  // ARIA for menus that the markup may have left out
    document.querySelectorAll("[data-pop]").forEach(b => { b.setAttribute("aria-haspopup", "true"); if (!b.hasAttribute("aria-expanded")) b.setAttribute("aria-expanded", "false"); });
    document.querySelectorAll(".lnk:not([href]),.ins .show").forEach(l => { l.setAttribute("role", "button"); l.setAttribute("tabindex", "0"); });
    document.querySelector(".ask-panel")?.setAttribute("role", "dialog");
  }
  window.addEventListener("hashchange", () => { if (readHash()) paint(); });

  function init() {
    if (store.get("bbi-col") && app()) app().classList.add("col");
    if (store.get("bbi-theme") === "dark" || /[?&]dark/.test(location.search)) html.dataset.theme = "dark";
    if (/[?&]ceo/.test(location.search)) html.classList.add("ceo");
    if (!readHash()) { try { Object.assign(state, JSON.parse(store.get("bbi-state", true) || "{}")); } catch (e) { } }
    if (!state.screen) state.screen = document.querySelector(".tabs a[data-screen]")?.dataset.screen || "";
    decorate(); validScreen(); writeHash(); paint();
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
  window.BBIShell = { state, set, toast };
})();
