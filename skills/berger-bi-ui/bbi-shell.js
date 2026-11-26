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
    const h = decodeURIComponent(location.hash.slice(1)); if (!h) return false;
    const [screen, q] = h.split("?"); state.screen = screen; state.f = {};
    (q || "").split("&").filter(Boolean).forEach(p => { const [k, v] = p.split("="); state.f[k] = v ? v.split(",") : []; });
    return true;
  }
  function writeHash() {
    const q = Object.entries(state.f).filter(([, v]) => v.length).map(([k, v]) => k + "=" + v.join(",")).join("&");
    history.replaceState(null, "", "#" + state.screen + (q ? "?" + q : ""));
    store.set("bbi-state", JSON.stringify(state), true);
  }
  function paint() {
    document.querySelectorAll(".chip[data-f]").forEach(c => c.classList.toggle("on", (state.f[c.dataset.f] || []).includes(c.dataset.v)));
    document.querySelectorAll(".tabs a[data-screen]").forEach(a => a.classList.toggle("on", a.dataset.screen === state.screen));
    document.querySelectorAll("[data-screen-view]").forEach(v => v.hidden = v.dataset.screenView !== state.screen);
    const n = Object.values(state.f).reduce((s, v) => s + v.length, 0);
    document.querySelectorAll("[data-count='filters']").forEach(e => { e.textContent = n; e.hidden = !n; });
    document.dispatchEvent(new CustomEvent("bbi:state", { detail: JSON.parse(JSON.stringify(state)) }));
  }
  function set(key, values) { state.f[key] = values; writeHash(); paint(); }

  function toast(msg, undo) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.innerHTML = ""; t.append(msg);
    if (undo) { const b = document.createElement("button"); b.textContent = "ביטול"; b.onclick = () => { undo(); t.hidden = true; }; t.append(b); }
    t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 5000);
  }

  function closePops(except) { document.querySelectorAll("[data-popup]").forEach(p => { if (p !== except) p.hidden = true; }); }

  document.addEventListener("click", e => {
    const pop = e.target.closest("[data-pop]");
    if (pop) { const t = document.getElementById(pop.dataset.pop); if (t) { t.setAttribute("data-popup", ""); closePops(t); t.hidden = !t.hidden; } e.stopPropagation(); return; }
    if (!e.target.closest("[data-popup]")) closePops();
    const act = e.target.closest("[data-act]"), a = app();
    if (act) {
      const k = act.dataset.act;
      if (k === "collapse" && a) { a.classList.toggle("col"); store.set("bbi-col", a.classList.contains("col") ? "1" : ""); }
      if (k === "sheet" && a) a.classList.toggle("sheet");
      if (k === "ask") { const p = document.querySelector(".ask-panel"); if (p) { p.hidden = !p.hidden; if (!p.hidden) p.querySelector("input")?.focus(); } }
      if (k === "theme") { const d = html.dataset.theme === "dark"; d ? delete html.dataset.theme : html.dataset.theme = "dark"; store.set("bbi-theme", d ? "" : "dark"); }
      if (k === "ceo") html.classList.toggle("ceo");
    }
    if (e.target.closest(".sheet-bg") && a) a.classList.remove("sheet");
    const chip = e.target.closest(".chip[data-f]");
    if (chip) {
      const k = chip.dataset.f, v = chip.dataset.v, before = (state.f[k] || []).slice();
      set(k, before.includes(v) ? before.filter(x => x !== v) : before.concat(v));
    }
    const clear = e.target.closest("[data-act='clear']");
    if (clear) { const before = JSON.parse(JSON.stringify(state.f)); state.f = {}; writeHash(); paint(); toast("הפילטרים נוקו", () => { state.f = before; writeHash(); paint(); }); }
    const tab = e.target.closest(".tabs a[data-screen]");
    if (tab) { e.preventDefault(); state.screen = tab.dataset.screen; writeHash(); paint(); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closePops(); const p = document.querySelector(".ask-panel"); if (p) p.hidden = true; app()?.classList.remove("sheet"); } });
  window.addEventListener("hashchange", () => { if (readHash()) paint(); });

  function init() {
    if (store.get("bbi-col") && app()) app().classList.add("col");
    if (store.get("bbi-theme") === "dark" || /[?&]dark/.test(location.search)) html.dataset.theme = "dark";
    if (/[?&]ceo/.test(location.search)) html.classList.add("ceo");
    if (!readHash()) { try { Object.assign(state, JSON.parse(store.get("bbi-state", true) || "{}")); } catch (e) { } }
    if (!state.screen) state.screen = document.querySelector(".tabs a[data-screen]")?.dataset.screen || "";
    writeHash(); paint();
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
  window.BBIShell = { state, set, toast };
})();
