/* ============================================================================
   bbi-charts.js · Berger BI chart kit · no dependencies
   Draws at the element's real pixel size and redraws on resize. Chart text uses
   --fs-s (12px, larger in CEO mode). Colors come from tokens.css. Every chart
   has real axes, a tooltip with comparison, hover dimming, optional onClick,
   and a collision pass so labels never sit on each other.
   API and options: docs/charts.md. Change the kit HERE (the shared repo), never
   in a project's copy.
   ============================================================================ */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const MON = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  const EXC = "var(--bad-mark)", GOOD = "var(--good-mark)", DATA = "var(--data)", DATAL = "var(--data-l)";

  /* ---------- helpers ---------- */
  function S(tag, a, p) {
    const e = document.createElementNS(NS, tag);
    for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]);
    if (p) p.appendChild(e);
    return e;
  }
  function T(p, x, y, s, cls, anchor, style) {
    const t = S("text", { x, y, class: cls || "tx", "text-anchor": anchor || "start", style }, p);
    t.textContent = s; return t;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = v => typeof v === "number" && isFinite(v);
  const arr = (v, n) => Array.isArray(v) ? v : (v == null ? null : Array(n).fill(v));   // scalar target -> array

  /* number format: rounds first, then picks K / M / B; 3 significant digits */
  function fmt(v, unit) {
    if (!num(v)) return "–";
    const a = Math.abs(v);
    if (unit === "%" || unit === "pp") {
      let r = a < 100 ? Math.round(a * 10) / 10 : Math.round(a);          // 3 significant digits: 31.4%, 4.2%, 112%
      if (r === 0) return unit === "%" ? "0%" : "0 נק׳";
      return (v < 0 ? "−" : "") + r + (unit === "%" ? "%" : " נק׳");
    }
    const sig = x => +x.toPrecision(3);
    let s;
    if (a < 1000) s = String(Number.isInteger(a) ? a : sig(a));
    else {
      const steps = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
      let i = steps.findIndex(([d]) => a >= d);
      let r = sig(a / steps[i][0]);
      if (r >= 1000 && i > 0) { i--; r = sig(a / steps[i][0]); }        // 999,600 -> 1M, not 1000K
      s = r + steps[i][1];
    }
    if (s === "0") return "0";
    return (v < 0 ? "−" : "") + (unit === "₪" ? "₪" : "") + s + (unit && !["₪", "%", "pp"].includes(unit) ? " " + unit : "");
  }
  /* 4-6 nice ticks covering [min, max] */
  function nice(min, max, n) {
    if (!num(min) || !num(max)) { min = 0; max = 1; }
    if (min === max) { max = min === 0 ? 1 : min * 1.2; if (max < min) [min, max] = [max, min]; }
    const step0 = (max - min) / Math.max(3, Math.min(6, n));
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step - 1e-9) * step, out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
    return out;
  }
  const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / ((d1 - d0) || 1) * (r1 - r0);

  /* text width, measured in the chart's own font */
  let meas;
  function tw(svg, s, cls) {
    if (!meas || meas.ownerSVGElement !== svg) meas = S("text", { x: -9999, y: -9999, class: cls || "tx" }, svg);
    meas.setAttribute("class", cls || "tx"); meas.textContent = s;
    return meas.getComputedTextLength();
  }
  function ellipsis(svg, s, max, cls) {
    s = String(s); if (tw(svg, s, cls) <= max) return s;
    while (s.length > 1 && tw(svg, s + "…", cls) > max) s = s.slice(0, -1);
    return s + "…";
  }

  /* ---------- tooltip ---------- */
  let tip;
  function showTip(ev, title, rows) {
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; tip.setAttribute("role", "status"); document.body.appendChild(tip); }
    tip.innerHTML = `<b>${esc(title)}</b>` + rows.map(([k, v, c]) => `<div style="display:flex;justify-content:space-between;gap:14px"><span>${esc(k)}</span><span class="n ${c || ""}">${esc(v)}</span></div>`).join("");
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
    tip.style.left = Math.max(4, x) + "px"; tip.style.top = Math.max(4, y) + "px";
  }
  const hideTip = () => { if (tip) tip.hidden = true; };
  function dim(svg, i) { svg.querySelectorAll("[data-i]").forEach(e => e.style.opacity = i == null || +e.dataset.i === i ? 1 : .38); }
  /* hover + touch + click on one mark (or a group of marks with the same index) */
  function bind(svg, el, i, title, rows, o, datum) {
    el.setAttribute("data-i", i);
    el.addEventListener("pointermove", ev => { dim(svg, i); showTip(ev, title, rows()); });
    el.addEventListener("pointerdown", ev => { if (ev.pointerType !== "mouse") { dim(svg, i); showTip(ev, title, rows()); } });
    el.addEventListener("pointerleave", () => { dim(svg); hideTip(); });
    if (o.onClick) {                                      // clickable marks are keyboard-reachable too
      el.style.cursor = "pointer"; el.setAttribute("tabindex", "0"); el.setAttribute("role", "button");
      el.setAttribute("aria-label", title);
      el.addEventListener("click", () => o.onClick(i, datum));
      el.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); o.onClick(i, datum); } });
    }
  }
  let UID = 0;                                            // unique ids for patterns per chart

  /* ---------- mount ---------- */
  function mount(el, o, draw, empty) {
    if (typeof el === "string") el = document.querySelector(el);
    if (!el) return;
    el.classList.add("bbi-chart");
    let lw = 0, lh = 0;
    const render = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h || (w === lw && h === lh)) return;
      lw = w; lh = h; el.innerHTML = "";
      const svg = S("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": o.title || "" }, el);
      svg.style.cssText = "direction:ltr;display:block;overflow:visible";
      meas = null;
      if (empty) { T(svg, w / 2, h / 2, "אין נתונים לתקופה שנבחרה", "tx", "middle"); return; }
      try { draw(svg, w, h, parseFloat(getComputedStyle(el).fontSize) || 12); }
      catch (err) {                                     // one bad chart never stops the others
        console.error("BBI chart:", o.title || el.id, err);
        svg.innerHTML = ""; T(svg, w / 2, h / 2, "לא הצלחנו להציג את הגרף", "tx", "middle");
      }
    };
    if (el._bbiRO) el._bbiRO.disconnect();
    el._bbiRO = new ResizeObserver(() => requestAnimationFrame(render)); el._bbiRO.observe(el);
    render();
  }

  /* ---------- axes ---------- */
  function yAxis(svg, ticks, y, x0, x1, unit, title, fs) {
    const gap = ticks.length > 1 ? Math.abs(y(ticks[0]) - y(ticks[1])) : 99;
    const every = Math.max(1, Math.ceil(fs * 1.5 / Math.max(1, gap)));   // short chart: label every 2nd/3rd line
    ticks.forEach((v, i) => {
      S("line", { x1: x0, x2: x1, y1: y(v), y2: y(v), class: v === 0 ? "ax" : "gl" }, svg);
      if (i % every === 0) T(svg, x0 - 6, y(v) + fs / 3, fmt(v, unit), "tx", "end");
    });
    if (title) T(svg, x0 - 6, y(ticks[ticks.length - 1]) - fs, title, "tx", "end");
  }
  const yLeft = (svg, ticks, unit) => Math.max(...ticks.map(v => tw(svg, fmt(v, unit)))) + 10;
  /* x labels: keep first, skip so nothing overlaps; last only if it fits; edges anchored inside */
  function xLabels(svg, labels, xc, yb, x0, x1, fs) {
    const ws = labels.map(l => tw(svg, l) + 8), n = labels.length;
    let prevEnd = -Infinity;
    const put = i => {
      let a = "middle", x = xc(i), w = ws[i];
      if (x - w / 2 < x0 - 2) { a = "start"; x = Math.max(x0, x - w / 2); }
      if (x + w / 2 > x1 + 2) { a = "end"; x = Math.min(x1, x + w / 2); }
      const left = a === "start" ? x : a === "end" ? x - w : x - w / 2;
      if (left < prevEnd) return false;
      T(svg, x, yb + fs + 4, labels[i], "tx", a); prevEnd = left + w; return true;
    };
    const step = Math.max(1, Math.ceil(Math.max(...ws) / Math.max(1, (x1 - x0) / n)));
    for (let i = 0; i < n; i += step) put(i);
    if ((n - 1) % step) {                       // the last label, only if it does not collide
      const x = xc(n - 1), w = ws[n - 1];
      if (x - w <= prevEnd) return;
      put(n - 1);
    }
  }

  /* ---------- 1. columns vs target ---------- */
  function columns(el, o) {
    const v = o.values || [], n = v.length;
    mount(el, o, (svg, w, h, fs) => {
      const hid = "bbi-h" + (++UID);
      const tg = arr(o.target, n), thr = o.threshold || .9, hi = new Set(o.highlight || []);
      const fin = v.concat(tg || []).filter(num);
      const L0 = 8, top = fs * 2, bot = fs + 12, R = tg ? tw(svg, o.targetName || "יעד") + 10 : 8;
      const ticks = nice(Math.min(0, ...fin), Math.max(0, ...fin), Math.floor((h - top - bot) / Math.max(34, fs * 2.8)));
      const L = Math.max(L0, yLeft(svg, ticks, o.unit));
      const y = lin(ticks[0], ticks[ticks.length - 1], h - bot, top);
      const bw = (w - L - R) / n, bar = Math.max(4, Math.min(28, bw * .55)), xc = i => L + bw * i + bw / 2;
      yAxis(svg, ticks, y, L, w - R, o.unit, o.yTitle, fs);
      if (tg) {                                   // IBCS: target = dark tick, grey is reserved for last year
        tg.forEach((t, i) => { if (num(t)) S("line", { x1: xc(i) - bar / 2 - 4, x2: xc(i) + bar / 2 + 4, y1: y(t), y2: y(t), style: "stroke:var(--ink);stroke-width:2" }, svg); });
        // "יעד" sits right of the last bar; if the last value label would reach it, it moves above the first bar
        const lastLab = num(v[n - 1]) ? xc(n - 1) + tw(svg, fmt(v[n - 1], o.unit), "tv") / 2 : 0;
        if (lastLab < w - R + 2) T(svg, w - R + 4, y(tg[n - 1]) + fs / 3, o.targetName || "יעד", "tx");
        else T(svg, xc(0) - bw / 2 + 2, y(tg[0]) - 6, o.targetName || "יעד", "tx");
      }
      const emph = o.emphasis || "last", placed = [];
      v.forEach((val, i) => {
        if (!num(val)) return;
        const exc = tg ? num(tg[i]) && val < tg[i] * thr : hi.has(i);
        const strong = emph === "all" || hi.has(i) || (emph === "last" && i === n - 1);
        const fill = exc ? EXC : (o.partialLast && i === n - 1 ? "url(#" + hid + ")" : strong ? DATA : DATAL);
        const r = S("rect", { x: xc(i) - bar / 2, y: Math.min(y(val), y(0)), width: bar, height: Math.max(1, Math.abs(y(val) - y(0))), rx: 3, style: "fill:" + fill }, svg);
        if (exc || i === n - 1) {
          const neg = val < 0, s = fmt(val, o.unit), lw = tw(svg, s, "tv");
          const ly = neg ? y(val) + fs + 3 : Math.min(y(val), tg && num(tg[i]) ? y(tg[i]) : Infinity) - 5;
          // collision pass: a label that would touch an earlier one is dropped (exceptions come first)
          if (!placed.some(p => Math.abs(p.x - xc(i)) < (p.w + lw) / 2 + 4 && Math.abs(p.y - ly) < fs + 2)) {
            T(svg, xc(i), ly, s, "tv", "middle", exc ? "fill:var(--bad)" : null);
            placed.push({ x: xc(i), y: ly, w: lw });
          }
        }
        bind(svg, r, i, o.labels[i], () => [["בפועל", fmt(val, o.unit)]].concat(tg && num(tg[i]) ? [["יעד", fmt(tg[i], o.unit)], ["פער", fmt((val / tg[i] - 1) * 100, "%"), val < tg[i] ? "acc" : ""]] : []), o, { label: o.labels[i], value: val });
      });
      if (o.partialLast) {
        const d = S("defs", {}, svg), p = S("pattern", { id: hid, width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, d);
        S("rect", { width: 5, height: 5, style: "fill:var(--data-xl)" }, p); S("line", { x1: 0, y1: 0, x2: 0, y2: 5, style: "stroke:var(--data);stroke-width:2" }, p);
      }
      xLabels(svg, o.labels, xc, h - bot, L, w - R, fs);
    }, !n);
  }

  /* ---------- 2. line + forecast (time axis) ---------- */
  function line(el, o) {
    const v = o.values || [], f = o.forecast, nA = v.length, nF = f ? f.values.length : 0, n = nA + nF;
    let lastReal = nA - 1; while (lastReal > 0 && !num(v[lastReal])) lastReal--;
    mount(el, o, (svg, w, h, fs) => {
      const lo = f ? f.lo || f.values : [], hi = f ? f.hi || f.values : [];
      const fin = v.concat(f ? lo.concat(hi, f.values) : []).filter(num);
      const top = fs * 2, bot = fs + 12;
      const ticks = nice(Math.min(...fin), Math.max(...fin), Math.floor((h - top - bot) / Math.max(34, fs * 2.8)));
      const L = yLeft(svg, ticks, o.unit), last = lastReal;
      const endLab = f ? fmt(f.values[nF - 1], o.unit) : fmt(v[last], o.unit), R = tw(svg, endLab, "tv") + 12;
      const y = lin(ticks[0], ticks[ticks.length - 1], h - bot, top);
      const step = (w - L - R) / Math.max(1, n - 1), x = i => L + step * i;
      yAxis(svg, ticks, y, L, w - R, o.unit, o.yTitle, fs);
      if (f) {
        const up = hi.map((t, i) => `${x(last + 1 + i)},${y(t)}`), dn = lo.map((t, i) => `${x(last + 1 + i)},${y(t)}`).reverse();
        S("polygon", { points: [`${x(last)},${y(v[last])}`].concat(up, dn).join(" "), style: "fill:var(--data-xl)" }, svg);
        S("polyline", { points: [`${x(last)},${y(v[last])}`].concat(f.values.map((t, i) => `${x(last + 1 + i)},${y(t)}`)).join(" "), fill: "none", style: "stroke:var(--data);stroke-width:2;stroke-dasharray:5 4" }, svg);
        S("line", { x1: x(last), x2: x(last), y1: top - 4, y2: h - bot, style: "stroke:var(--ink);stroke-dasharray:3 3" }, svg);
        T(svg, x(last) + 4, top - 6, "היום", "tx");
        T(svg, x(n - 1) + 6, y(f.values[nF - 1]) + fs / 3, endLab, "tv");
      }
      let seg = [];                                       // a gap in the data is a gap in the line
      v.forEach((t, i) => { if (num(t)) seg.push(`${x(i)},${y(t)}`); if ((!num(t) || i === nA - 1) && seg.length) { S("polyline", { points: seg.join(" "), fill: "none", style: "stroke:var(--data);stroke-width:2" }, svg); seg = []; } });
      if (nA === 1 || !f) S("circle", { cx: x(last), cy: y(v[last]), r: 3.5, style: "fill:var(--data)" }, svg);
      if (!f) T(svg, x(last) + 6, y(v[last]) + fs / 3, fmt(v[last], o.unit), "tv");
      else T(svg, x(last) - 6, y(v[last]) - 8, fmt(v[last], o.unit), "tv", "end");
      const labels = o.labels.concat(f && f.labels ? f.labels : []);
      xLabels(svg, labels, x, h - bot, L, w - R, fs);
      const ch = S("line", { y1: top, y2: h - bot, style: "stroke:var(--text-3)", visibility: "hidden" }, svg);
      const hit = S("rect", { x: L, y: top, width: Math.max(1, w - L - R), height: Math.max(1, h - top - bot), style: "fill:transparent" }, svg);
      const at = ev => { const b = svg.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.round((ev.clientX - b.left - L) / step))); };
      const move = ev => {
        const i = at(ev), isF = i > last, val = isF ? f.values[i - nA] : v[i];
        ch.setAttribute("x1", x(i)); ch.setAttribute("x2", x(i)); ch.setAttribute("visibility", "visible");
        showTip(ev, labels[i] || "", [[isF ? "תחזית" : "בפועל", fmt(val, o.unit)]].concat(isF ? [["טווח", fmt(lo[i - nA], o.unit) + "–" + fmt(hi[i - nA], o.unit)]] : i > 0 ? [["שינוי", fmt(v[i] - v[i - 1], o.unit === "%" ? "pp" : o.unit)]] : []));
      };
      hit.addEventListener("pointermove", move); hit.addEventListener("pointerdown", move);
      hit.addEventListener("pointerleave", () => { ch.setAttribute("visibility", "hidden"); hideTip(); });
      if (o.onClick) { hit.style.cursor = "pointer"; hit.addEventListener("click", ev => { const i = at(ev); o.onClick(i, { label: labels[i], value: i > last ? f.values[i - nA] : v[i] }); }); }
    }, !nA);
  }

  /* ---------- 3. this year vs last year ---------- */
  function compare(el, o) {
    const n = (o.cur || []).length;
    mount(el, o, (svg, w, h, fs) => {
      const prevA = o.prev || [], hid = "bbi-h" + (++UID);
      const fin = o.cur.concat(prevA).filter(num), top = fs * 2 + 4, bot = fs + 12;
      const ticks = nice(Math.min(0, ...fin), Math.max(0, ...fin), Math.floor((h - top - bot) / Math.max(34, fs * 2.8)));
      const L = yLeft(svg, ticks, o.unit), R = 8;
      const y = lin(ticks[0], ticks[ticks.length - 1], h - bot, top);
      const bw = (w - L - R) / n, bar = Math.max(4, Math.min(20, bw * .32)), xc = i => L + bw * i + bw / 2;
      yAxis(svg, ticks, y, L, w - R, o.unit, o.yTitle, fs);
      // two-item key (the one place a key beats direct labels: grouped bars)
      const cn = o.curName || "השנה", pn = o.prevName || "אשתקד", kx = w - R;
      S("rect", { x: kx - 10, y: 2, width: 10, height: 10, rx: 2, style: "fill:var(--data)" }, svg); T(svg, kx - 14, 11, cn, "tx", "end");
      const k2 = kx - 24 - tw(svg, cn);
      S("rect", { x: k2 - 10, y: 2, width: 10, height: 10, rx: 2, style: "fill:var(--cmp)" }, svg); T(svg, k2 - 14, 11, pn, "tx", "end");
      for (let i = 0; i < n; i++) {
        const p = prevA[i], c = o.cur[i], g = S("g", {}, svg);
        if (num(p)) S("rect", { x: xc(i) - bar - 1, y: Math.min(y(p), y(0)), width: bar, height: Math.max(1, Math.abs(y(p) - y(0))), rx: 3, style: "fill:var(--cmp)" }, g);
        const partial = o.partialLast && i === n - 1;            // open period: hatched, never judged red
        const exc = !partial && num(c) && num(p) && p > 0 && c < p * (o.threshold || .95);
        if (num(c)) S("rect", { x: xc(i) + 1, y: Math.min(y(c), y(0)), width: bar, height: Math.max(1, Math.abs(y(c) - y(0))), rx: 3, style: "fill:" + (partial ? "url(#" + hid + ")" : exc ? EXC : DATA) }, g);
        bind(svg, g, i, o.labels[i], () => [[cn, fmt(c, o.unit)], [pn, fmt(p, o.unit)], ["שינוי", partial ? "תקופה פתוחה" : num(p) && p !== 0 ? fmt((c / p - 1) * 100, "%") : "–", partial ? "" : c < p ? "dn" : "up"]], o, { label: o.labels[i], cur: c, prev: p });
      }
      if (o.partialLast) {
        const d = S("defs", {}, svg), pt = S("pattern", { id: hid, width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, d);
        S("rect", { width: 5, height: 5, style: "fill:var(--data-xl)" }, pt); S("line", { x1: 0, y1: 0, x2: 0, y2: 5, style: "stroke:var(--data);stroke-width:2" }, pt);
      }
      const labs = o.partialLast ? o.labels.map((l, i) => i === n - 1 ? l + " (" + (o.partialLabel || "חלקי") + ")" : l) : o.labels;
      xLabels(svg, labs, xc, h - bot, L, w - R, fs);
    }, !n);
  }

  /* ---------- 4. ranking (names on the right, RTL) ---------- */
  function ranking(el, o) {
    const items0 = (o.items || []).filter(d => num(d.v));
    mount(el, o, (svg, w, h, fs) => {
      let it = items0.slice().sort((a, b) => b.v - a.v);
      const fit = Math.max(2, Math.floor(h / (fs + 10)));
      if (it.length > fit) {                                  // too many rows: top N + "others"
        const rest = it.slice(fit - 1);
        it = it.slice(0, fit - 1).concat([{ name: (o.othersName || "אחרים") + " (" + rest.length + ")", v: rest.reduce((s, d) => s + d.v, 0), others: true }]);
      }
      const n = it.length, top = o.top == null ? 2 : o.top;
      const nameW = Math.min(w * .4, Math.max(...it.map(d => tw(svg, d.name))) + 10);
      const valW = Math.max(...it.map(d => tw(svg, fmt(d.v, o.unit), "tv"))) + 8;
      const rh = h / n, bh = Math.min(16, rh * .62), xR = w - nameW;
      const max = Math.max(...it.map(d => Math.abs(d.v)), 1e-9);
      const len = v => Math.max(1, (xR - valW - 4) * Math.min(1, Math.abs(v) / max));
      it.forEach((d, i) => {
        const yc = rh * i + rh / 2, g = S("g", {}, svg);
        T(g, w - 2, yc + fs / 3, ellipsis(svg, d.name, nameW - 8), "tx", "end");
        const fill = d.others ? "var(--ghost)" : d.exception || d.v < 0 ? EXC : i < top ? DATA : DATAL;
        S("rect", { x: xR - len(d.v), y: yc - bh / 2, width: len(d.v), height: bh, rx: 3, style: "fill:" + fill }, g);
        T(g, xR - len(d.v) - 5, yc + fs / 3, fmt(d.v, o.unit), "tv", "end");
        bind(svg, g, i, d.name, () => [["ערך", fmt(d.v, o.unit)], ["מקום", d.others ? "–" : String(i + 1)]], o, d);
      });
    }, !items0.length);
  }

  /* ---------- 5. waterfall / bridge ---------- */
  function waterfall(el, o) {
    const steps = o.steps || [];
    mount(el, o, (svg, w, h, fs) => {
      let st = steps;
      const fitW = Math.max(4, Math.floor(w / 52));
      if (st.length > fitW) {                            // keep totals + the biggest moves, merge the rest
        const mid = st.filter(d => !d.total), keep = new Set(mid.slice().sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, fitW - 3));
        const out = []; let other = 0, oc = 0;
        st.forEach((d, i) => { if (d.total || keep.has(d)) { if (oc && (d.total && i === st.length - 1)) { out.push({ name: (o.othersName || "אחרים") + " (" + oc + ")", v: other }); oc = 0; } out.push(d); } else { other += d.v; oc++; } });
        if (oc) out.push({ name: (o.othersName || "אחרים") + " (" + oc + ")", v: other });
        st = out;
      }
      let run = 0;
      const seg = st.map(s => { if (s.total) { run = s.v; return { s, a: 0, b: s.v }; } const a = run; run += s.v; return { s, a, b: run }; });
      const all = seg.flatMap(d => [d.a, d.b]), top = fs * 2, bot = fs + 12;
      const ticks = nice(Math.min(0, ...all), Math.max(...all), Math.floor((h - top - bot) / Math.max(34, fs * 2.8)));
      const L = yLeft(svg, ticks, o.unit), R = 8;
      const y = lin(ticks[0], ticks[ticks.length - 1], h - bot, top);
      const n = seg.length, bw = (w - L - R) / n, bar = Math.min(44, bw * .62), xc = i => L + bw * i + bw / 2;
      yAxis(svg, ticks, y, L, w - R, o.unit, o.yTitle, fs);
            // value labels: drop the currency sign when labels would touch
      const labOf = (d, cur) => (d.s.total ? "" : d.s.v > 0 ? "+" : "") + fmt(d.s.v, cur ? o.unit : (o.unit === "₪" ? null : o.unit));
      const cur = seg.every(d => tw(svg, labOf(d, true), "tv") < bw - 4);
      seg.forEach((d, i) => {
        const neg = !d.s.total && d.s.v < 0, g = S("g", {}, svg);
        const bad = o.good === "down" ? !neg : neg;
        const fill = d.s.total ? "var(--strong)" : bad ? EXC : GOOD;
        S("rect", { x: xc(i) - bar / 2, y: y(Math.max(d.a, d.b)), width: bar, height: Math.max(1, Math.abs(y(d.a) - y(d.b))), rx: 3, style: "fill:" + fill }, g);
        if (i < n - 1) S("line", { x1: xc(i) + bar / 2, x2: xc(i + 1) - bar / 2, y1: y(d.b), y2: y(d.b), style: "stroke:var(--ghost);stroke-dasharray:2 2" }, svg);
        T(g, xc(i), y(Math.max(d.a, d.b)) - 5, labOf(d, cur), "tv", "middle", fill === EXC ? "fill:var(--bad)" : null);
        T(svg, xc(i), h - bot + fs + 4, ellipsis(svg, d.s.name, bw - 4), "tx", "middle");   // every step keeps its name
        bind(svg, g, i, d.s.name, () => [[d.s.total ? "סה״כ" : "שינוי", fmt(d.s.v, o.unit)]].concat(d.s.total ? [] : [["אחרי השלב", fmt(d.b, o.unit)]]), o, d.s);
      });
    }, !steps.length);
  }

  /* ---------- 6. diverging change (names right) ---------- */
  function diverging(el, o) {
    const it0 = (o.items || []).filter(d => num(d.v));
    mount(el, o, (svg, w, h, fs) => {
      const fitN = Math.max(2, Math.floor(h / (fs + 10)));
      let it = it0;
      if (it0.length > fitN) {
        const byAbs = it0.slice().sort((a, b) => Math.abs(b.v) - Math.abs(a.v)), rest = byAbs.slice(fitN - 1);
        it = byAbs.slice(0, fitN - 1).concat([{ name: (o.othersName || "אחרים") + " (" + rest.length + ")", v: rest.reduce((t, d) => t + d.v, 0) }]);
      }
      const n = it.length, unit = o.unit || "%";
      const nameW = Math.min(w * .35, Math.max(...it.map(d => tw(svg, d.name))) + 12);
      const labW = Math.max(...it.map(d => tw(svg, (d.v > 0 ? "+" : "") + fmt(d.v, unit), "tv"))) + 8;
      const m = Math.max(...it.map(d => Math.abs(d.v)), 1e-9);
      const x = lin(-m, m, labW, w - nameW - labW), rh = h / n, bh = Math.min(16, rh * .62);
      S("line", { x1: x(0), x2: x(0), y1: 0, y2: h, class: "ax" }, svg);
      it.forEach((d, i) => {
        const yc = rh * i + rh / 2, a = Math.min(x(0), x(d.v)), wd = Math.abs(x(d.v) - x(0)), g = S("g", {}, svg);
        const isBad = o.good === "down" ? d.v > 0 : d.v < 0;
        const fill = d.v === 0 ? "var(--ghost)" : isBad ? EXC : GOOD;
        T(g, w - 2, yc + fs / 3, ellipsis(svg, d.name, nameW - 8), "tx", "end");
        S("rect", { x: a, y: yc - bh / 2, width: Math.max(1, wd), height: bh, rx: 3, style: "fill:" + fill }, g);
        T(g, d.v >= 0 ? x(d.v) + 5 : x(d.v) - 5, yc + fs / 3, (d.v > 0 ? "+" : "") + fmt(d.v, unit), "tv", d.v >= 0 ? "start" : "end", fill === EXC ? "fill:var(--bad)" : null);
        bind(svg, g, i, d.name, () => [["שינוי", (d.v > 0 ? "+" : "") + fmt(d.v, unit), isBad ? "dn" : "up"]], o, d);
      });
    }, !it0.length);
  }

  /* ---------- 7. gantt with a real date axis ---------- */
  function gantt(el, o) {
    const tasks0 = o.tasks || [];
    mount(el, o, (svg, w, h, fs) => {
      const D = s => new Date(s + "T00:00:00").getTime(), day = 864e5, f = D(o.from), t = D(o.to);
      const top = fs + 12, bot = fs + 8;
      const fit = Math.max(1, Math.floor((h - top - bot) / (fs + 10)));
      const tasks = tasks0.slice(0, fit);                  // rows that fit; the rest goes to "show me"
      const nameW = Math.min(w * .35, Math.max(...tasks.map(d => tw(svg, d.name))) + 12);
      const x = lin(f, t, 4, w - nameW - 4), rh = (h - top - bot) / tasks.length, bh = Math.min(14, rh * .55);
      // months, or quarters when months are too narrow
      const monthW = (x(f + 30 * day) - x(f)), every = monthW < tw(svg, "ספט 26") + 8 ? (monthW * 3 < tw(svg, "Q4 26") + 8 ? 12 : 3) : 1;
      const d0 = new Date(f); d0.setDate(1);
      let k = 0;
      for (let d = new Date(d0); d.getTime() <= t; d.setMonth(d.getMonth() + 1), k++) {
        const xm = x(Math.max(f, d.getTime()));
        S("line", { x1: xm, x2: xm, y1: top - 4, y2: h - bot, class: every === 1 || d.getMonth() % every === 0 ? "gl" : null }, svg);
        if (every === 1 || d.getMonth() % every === 0) {
          const nx = new Date(d); nx.setMonth(nx.getMonth() + every);
          const mid = x((Math.max(f, d.getTime()) + Math.min(t, nx.getTime())) / 2);
          const lab = every === 12 ? String(d.getFullYear()) : every === 1 ? MON[d.getMonth()] + (d.getMonth() === 0 || k === 0 ? " " + String(d.getFullYear()).slice(2) : "") : "Q" + (Math.floor(d.getMonth() / 3) + 1) + " " + String(d.getFullYear()).slice(2);
          T(svg, mid, top - 8, lab, "tx", "middle");
        }
      }
      const col = { done: DATAL, active: DATA, late: EXC, todo: "var(--grid)" };
      tasks.forEach((tk, i) => {
        const yc = top + rh * i + rh / 2, g = S("g", {}, svg);
        T(g, w - 2, yc + fs / 3, ellipsis(svg, tk.name, nameW - 8), "tx", "end");
        if (tk.state === "milestone") {
          const xm = x(D(tk.start));
          S("rect", { x: xm - 6, y: yc - 6, width: 12, height: 12, rx: 2, transform: `rotate(45 ${xm} ${yc})`, style: "fill:var(--strong)" }, g);
          if (tk.label) T(g, xm - 12, yc + fs / 3, tk.label, "tx", "end");
        } else {
          const a = x(D(tk.start)), b = x(D(tk.end));
          S("rect", { x: a, y: yc - bh / 2, width: Math.max(3, b - a), height: bh, rx: 3, style: "fill:" + col[tk.state || "todo"] + (tk.state === "todo" || !tk.state ? ";stroke:var(--ghost)" : "") }, g);
          if (tk.label) {
            // label left of the bar, else right of it, else nowhere (the tooltip has it); never over the names
            const lw = tw(svg, tk.label, "tv"), left = a - 6 - lw >= 0, right = b + 6 + lw <= w - nameW - 4;
            if (left || right) T(g, left ? a - 6 : b + 6, yc + fs / 3, tk.label, "tv", left ? "end" : "start", tk.state === "late" ? "fill:var(--bad)" : null);
          }
        }
        const ds = s => s ? s.split("-").reverse().join(".") : "–";
        bind(svg, g, i, tk.name, () => [["התחלה", ds(tk.start)], ["סיום", ds(tk.end || tk.start)], ["מצב", { done: "הושלם", active: "בעבודה", late: "באיחור", todo: "טרם התחיל", milestone: "אבן דרך" }[tk.state] || "–", tk.state === "late" ? "acc" : ""]], o, tk);
      });
      if (o.today) {
        const xt = x(D(o.today));
        S("line", { x1: xt, x2: xt, y1: top - 4, y2: h - bot, style: "stroke:var(--ink);stroke-dasharray:3 3" }, svg);
        T(svg, xt, h - 2, "היום", "tv", "middle");
      }
      if (tasks0.length > tasks.length) T(svg, 4, h - 2, "+" + (tasks0.length - tasks.length) + " שורות", "tx");
    }, !tasks0.length);
  }

  window.BBI = { version: "1.2", columns, line, compare, ranking, waterfall, diverging, gantt, fmt, MON };
})();
