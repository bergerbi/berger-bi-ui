/* ============================================================================
   bbi-charts.js · Berger BI chart kit · v1.0 · no dependencies
   Draws at the element's real pixel size (text is always 12px), redraws on
   resize, uses tokens.css colors. Every chart has real axes, ticks and titles.

   BBI.columns(el, {labels, values, target, highlight, unit, yTitle})
   BBI.line(el,    {labels, values, forecast:{values,lo,hi}, unit, yTitle, partialLast})
   BBI.compare(el, {labels, cur, prev, curName, prevName, unit, yTitle})
   BBI.ranking(el, {items:[{name,v}], top, unit})
   BBI.waterfall(el,{steps:[{name,v,total}], unit})
   BBI.diverging(el,{items:[{name,v}], unit, exception})
   BBI.gantt(el,   {from, to, today, tasks:[{name,start,end,state}]})   dates 'YYYY-MM-DD'
   Every option except the data is optional. highlight = array of indexes.
   ============================================================================ */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const FS = 12, CH = 6.6;                       // font size, approx px per char (Heebo 12)
  const MON = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];

  function S(tag, a, p) {
    const e = document.createElementNS(NS, tag);
    for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]);
    if (p) p.appendChild(e);
    return e;
  }
  function T(p, x, y, s, cls, anchor, extra) {
    const t = S("text", Object.assign({ x, y, class: cls || "tx", "text-anchor": anchor || "start" }, extra || {}), p);
    t.textContent = s; return t;
  }
  const minus = s => String(s).replace(/^-/, "−");
  function fmt(v, unit) {
    if (v == null || isNaN(v)) return "";
    const a = Math.abs(v), sg = v < 0 ? "−" : "";
    if (unit === "%") return sg + (+a.toFixed(a < 10 ? 1 : 0)) + "%";
    if (unit === "pp") return sg + (+a.toFixed(1)) + " נק׳";
    const cur = unit === "₪" ? "₪" : "";
    let s;
    if (a >= 1e6) s = (+(a / 1e6).toPrecision(3)) + "M";
    else if (a >= 1e4) s = Math.round(a / 1e3) + "K";
    else if (a >= 1e3) s = (+(a / 1e3).toPrecision(3)) + "K";
    else s = (+a.toPrecision(3)).toString();
    return sg + cur + s + (unit && unit !== "₪" && unit !== "%" && unit !== "pp" ? " " + unit : "");
  }
  function nice(min, max, n) {                     // nice axis ticks
    if (min === max) { max = min + 1; }
    const span = max - min, step0 = span / Math.max(1, n);
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
    return out;
  }
  const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / (d1 - d0 || 1) * (r1 - r0);

  /* ---------- tooltip + mount ---------- */
  let tip;
  function showTip(ev, html) {
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; document.body.appendChild(tip); }
    tip.innerHTML = html; tip.style.display = "block";
    const r = tip.getBoundingClientRect();
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  const hideTip = () => { if (tip) tip.style.display = "none"; };
  const row = (k, v, cls) => `<div style="display:flex;justify-content:space-between;gap:14px"><span>${k}</span><span class="n ${cls || ""}">${v}</span></div>`;

  function mount(el, draw, title) {
    if (typeof el === "string") el = document.querySelector(el);
    if (!el) return;
    el.classList.add("bbi-chart");
    const render = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      el.innerHTML = "";
      const svg = S("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": title || "" }, el);
      svg.style.cssText = "direction:ltr;display:block;overflow:visible;font-size:" + FS + "px";
      draw(svg, w, h);
    };
    if (el._bbiRO) el._bbiRO.disconnect();
    el._bbiRO = new ResizeObserver(render); el._bbiRO.observe(el);
    render();
  }

  /* ---------- axes ---------- */
  function yAxis(g, ticks, y, x0, x1, unit, title) {
    ticks.forEach(v => {
      S("line", { x1: x0, x2: x1, y1: y(v), y2: y(v), class: v === 0 ? "ax" : "gl" }, g);
      T(g, x0 - 6, y(v) + 4, fmt(v, unit), "tx", "end");
    });
    if (title) T(g, x0 - 6, y(ticks[ticks.length - 1]) - 10, title, "tx", "end");
  }
  function yLeft(ticks, unit) {                       // width needed for y labels
    return Math.max(...ticks.map(v => fmt(v, unit).length)) * CH + 10;
  }
  function xLabels(g, labels, xc, yBase, maxW) {      // skip labels so they never overlap
    const need = Math.max(...labels.map(l => String(l).length)) * CH + 8;
    const every = Math.max(1, Math.ceil(need / maxW));
    labels.forEach((l, i) => { if (i % every === 0 || i === labels.length - 1) T(g, xc(i), yBase + 16, l, "tx", "middle"); });
  }
  const dim = (g, on) => g.querySelectorAll("[data-i]").forEach(e => e.style.opacity = on == null || +e.dataset.i === on ? 1 : .38);

  /* ---------- 1. columns vs target ---------- */
  function columns(el, o) {
    mount(el, (svg, w, h) => {
      const v = o.values, n = v.length, hi = new Set(o.highlight || []);
      const all = v.concat(o.target || []).filter(x => x != null);
      const ticks = nice(Math.min(0, ...all), Math.max(...all) * 1.08, Math.max(2, Math.floor(h / 55)));
      const L = yLeft(ticks, o.unit), R = 34, top = 22, bot = 24;
      const y = lin(ticks[0], ticks[ticks.length - 1], h - bot, top);
      const bw = (w - L - R) / n, bar = Math.max(6, Math.min(26, bw * .5));
      const xc = i => L + bw * i + bw / 2;
      yAxis(svg, ticks, y, L, w - R, o.unit, o.yTitle);
      if (o.target) {
        const pts = o.target.map((t, i) => `${xc(i) - bw / 2 + 4},${y(t)} ${xc(i) + bw / 2 - 4},${y(t)}`).join(" ");
        S("polyline", { points: pts, fill: "none", style: "stroke:var(--text-3);stroke-width:2;stroke-dasharray:4 3" }, svg);
        T(svg, w - R + 4, y(o.target[n - 1]) + 4, "יעד", "tx");
      }
      v.forEach((val, i) => {
        const exc = o.target ? val < o.target[i] * (o.threshold || .9) : hi.has(i);
        const r = S("rect", { x: xc(i) - bar / 2, y: Math.min(y(val), y(0)), width: bar, height: Math.abs(y(val) - y(0)), rx: 3, "data-i": i,
          style: "fill:" + (exc ? "var(--accent)" : (o.partialLast && i === n - 1 ? "var(--data-l)" : "var(--data)")) }, svg);
        if (exc || i === n - 1) T(svg, xc(i), y(val) - 6, fmt(val, o.unit), "tv", "middle", exc ? { style: "fill:var(--accent-ink)" } : null);
        r.addEventListener("mousemove", ev => { dim(svg, i); showTip(ev, `<b>${o.labels[i]}</b>` + row("בפועל", fmt(val, o.unit)) + (o.target ? row("יעד", fmt(o.target[i], o.unit)) + row("פער", fmt((val / o.target[i] - 1) * 100, "%"), val < o.target[i] ? "acc" : "") : "")); });
        r.addEventListener("mouseleave", () => { dim(svg); hideTip(); });
      });
      xLabels(svg, o.labels, xc, h - bot, bw);
    }, o.title);
  }

  /* ---------- 2. line + forecast (time axis) ---------- */
  function line(el, o) {
    mount(el, (svg, w, h) => {
      const v = o.values, f = o.forecast, nA = v.length, nF = f ? f.values.length : 0, n = nA + nF;
      const all = v.concat(f ? f.lo.concat(f.hi) : []);
      const ticks = nice(Math.min(...all) * .96, Math.max(...all) * 1.04, Math.max(2, Math.floor(h / 55)));
      const L = yLeft(ticks, o.unit), R = 46, top = 22, bot = 24;
      const y = lin(ticks[0], ticks[ticks.length - 1], h - bot, top);
      const step = (w - L - R) / Math.max(1, n - 1), x = i => L + step * i;
      yAxis(svg, ticks, y, L, w - R, o.unit, o.yTitle);
      const last = nA - 1;
      if (f) {
        const up = f.hi.map((t, i) => `${x(last + 1 + i)},${y(t)}`), dn = f.lo.map((t, i) => `${x(last + 1 + i)},${y(t)}`).reverse();
        S("polygon", { points: [`${x(last)},${y(v[last])}`].concat(up, dn).join(" "), style: "fill:var(--data-xl)" }, svg);
        S("polyline", { points: [`${x(last)},${y(v[last])}`].concat(f.values.map((t, i) => `${x(last + 1 + i)},${y(t)}`)).join(" "), fill: "none", style: "stroke:var(--data);stroke-width:2;stroke-dasharray:5 4" }, svg);
        S("line", { x1: x(last), x2: x(last), y1: top - 6, y2: h - bot, style: "stroke:var(--ink);stroke-dasharray:3 3" }, svg);
        T(svg, x(last) + 4, top - 8, "היום", "tx");
        T(svg, x(n - 1), y(f.values[nF - 1]) - 8, fmt(f.values[nF - 1], o.unit), "tv", "end");
      }
      S("polyline", { points: v.map((t, i) => `${x(i)},${y(t)}`).join(" "), fill: "none", style: "stroke:var(--data);stroke-width:2" }, svg);
      S("circle", { cx: x(last), cy: y(v[last]), r: 3.5, style: "fill:var(--data)" }, svg);
      T(svg, x(last) + 6, y(v[last]) + 16, fmt(v[last], o.unit), "tv");
      const labels = o.labels.concat(f ? f.labels : []);
      xLabels(svg, labels, x, h - bot, step);
      // crosshair
      const ch = S("line", { y1: top, y2: h - bot, style: "stroke:var(--text-3);display:none" }, svg);
      const hit = S("rect", { x: L, y: top, width: w - L - R, height: h - top - bot, style: "fill:transparent" }, svg);
      hit.addEventListener("mousemove", ev => {
        const b = svg.getBoundingClientRect(), i = Math.max(0, Math.min(n - 1, Math.round((ev.clientX - b.left - L) / step)));
        ch.setAttribute("x1", x(i)); ch.setAttribute("x2", x(i)); ch.style.display = "";
        const isF = i > last, val = isF ? f.values[i - nA] : v[i];
        showTip(ev, `<b>${labels[i]}</b>` + row(isF ? "תחזית" : "בפועל", fmt(val, o.unit)) + (isF ? row("טווח", fmt(f.lo[i - nA], o.unit) + "–" + fmt(f.hi[i - nA], o.unit)) : ""));
      });
      hit.addEventListener("mouseleave", () => { ch.style.display = "none"; hideTip(); });
    }, o.title);
  }

  /* ---------- 3. this year vs last year ---------- */
  function compare(el, o) {
    mount(el, (svg, w, h) => {
      const n = o.cur.length, all = o.cur.concat(o.prev);
      const ticks = nice(0, Math.max(...all) * 1.1, Math.max(2, Math.floor(h / 55)));
      const L = yLeft(ticks, o.unit), R = 10, top = 22, bot = 24;
      const y = lin(ticks[0], ticks[ticks.length - 1], h - bot, top);
      const bw = (w - L - R) / n, bar = Math.max(5, Math.min(18, bw * .3)), xc = i => L + bw * i + bw / 2;
      yAxis(svg, ticks, y, L, w - R, o.unit, o.yTitle);
      for (let i = 0; i < n; i++) {
        S("rect", { x: xc(i) - bar - 1, y: y(o.prev[i]), width: bar, height: y(0) - y(o.prev[i]), rx: 3, style: "fill:var(--cmp)" }, svg);
        const exc = o.cur[i] < o.prev[i] * .95;
        const r = S("rect", { x: xc(i) + 1, y: y(o.cur[i]), width: bar, height: y(0) - y(o.cur[i]), rx: 3, "data-i": i, style: "fill:" + (exc ? "var(--accent)" : "var(--data)") }, svg);
        r.addEventListener("mousemove", ev => showTip(ev, `<b>${o.labels[i]}</b>` + row(o.curName || "השנה", fmt(o.cur[i], o.unit)) + row(o.prevName || "אשתקד", fmt(o.prev[i], o.unit)) + row("שינוי", fmt((o.cur[i] / o.prev[i] - 1) * 100, "%"), o.cur[i] < o.prev[i] ? "dn" : "up")));
        r.addEventListener("mouseleave", hideTip);
      }
      T(svg, xc(0) - bar / 2 - 1, y(o.prev[0]) - 5, o.prevName || "אשתקד", "tx", "middle");
      T(svg, xc(0) + bar / 2 + 1, y(o.cur[0]) - 5, o.curName || "השנה", "tv", "middle");
      xLabels(svg, o.labels, xc, h - bot, bw);
    }, o.title);
  }

  /* ---------- 4. ranking (names on the right, RTL) ---------- */
  function ranking(el, o) {
    mount(el, (svg, w, h) => {
      const it = o.items.slice().sort((a, b) => b.v - a.v), n = it.length, top = o.top == null ? 2 : o.top;
      const nameW = Math.max(...it.map(d => d.name.length)) * CH + 10, valW = Math.max(...it.map(d => fmt(d.v, o.unit).length)) * CH + 8;
      const rh = Math.min(28, (h - 4) / n), bh = Math.min(16, rh * .62), xR = w - nameW, max = it[0].v;
      const len = v => (xR - valW - 4) * v / max;
      it.forEach((d, i) => {
        const yc = 2 + rh * i + rh / 2;
        T(svg, w - 2, yc + 4, d.name, "tx", "end");
        S("rect", { x: xR - len(d.v), y: yc - bh / 2, width: len(d.v), height: bh, rx: 3, style: "fill:" + (d.exception ? "var(--accent)" : i < top ? "var(--data)" : "var(--data-l)") }, svg);
        T(svg, xR - len(d.v) - 5, yc + 4, fmt(d.v, o.unit), "tv", "end");
      });
    }, o.title);
  }

  /* ---------- 5. waterfall / bridge ---------- */
  function waterfall(el, o) {
    mount(el, (svg, w, h) => {
      let run = 0; const seg = o.steps.map(s => { if (s.total) { run = s.v; return { s, a: 0, b: s.v }; } const a = run; run += s.v; return { s, a, b: run }; });
      const all = seg.flatMap(d => [d.a, d.b]);
      const ticks = nice(Math.min(0, ...all), Math.max(...all) * 1.1, Math.max(2, Math.floor(h / 55)));
      const L = yLeft(ticks, o.unit), R = 8, top = 22, bot = 24;
      const y = lin(ticks[0], ticks[ticks.length - 1], h - bot, top);
      const n = seg.length, bw = (w - L - R) / n, bar = Math.min(44, bw * .62), xc = i => L + bw * i + bw / 2;
      yAxis(svg, ticks, y, L, w - R, o.unit, o.yTitle);
      const big = Math.max(...seg.filter(d => !d.s.total).map(d => Math.abs(d.s.v)));
      seg.forEach((d, i) => {
        const neg = !d.s.total && d.s.v < 0;
        const fill = d.s.total ? "var(--strong)" : neg ? (Math.abs(d.s.v) >= big * .6 ? "var(--accent)" : "var(--data-l)") : "var(--data)";
        S("rect", { x: xc(i) - bar / 2, y: y(Math.max(d.a, d.b)), width: bar, height: Math.max(1, Math.abs(y(d.a) - y(d.b))), rx: 3, style: "fill:" + fill }, svg);
        if (i < n - 1) S("line", { x1: xc(i) + bar / 2, x2: xc(i + 1) - bar / 2, y1: y(d.b), y2: y(d.b), style: "stroke:var(--ghost);stroke-dasharray:2 2" }, svg);
        const lab = d.s.total ? fmt(d.s.v, o.unit) : (d.s.v > 0 ? "+" : "") + fmt(d.s.v, o.unit);
        T(svg, xc(i), y(Math.max(d.a, d.b)) - 6, lab, "tv", "middle", neg && fill === "var(--accent)" ? { style: "fill:var(--accent-ink)" } : null);
      });
      xLabels(svg, o.steps.map(s => s.name), xc, h - bot, bw);
    }, o.title);
  }

  /* ---------- 6. diverging change (names right) ---------- */
  function diverging(el, o) {
    mount(el, (svg, w, h) => {
      const it = o.items, n = it.length, nameW = Math.max(...it.map(d => d.name.length)) * CH + 12;
      const m = Math.max(...it.map(d => Math.abs(d.v))) * 1.15, lab = 7 * CH;
      const x0 = lab, x1 = w - nameW - lab, x = lin(-m, m, x0, x1), rh = Math.min(28, (h - 18) / n), bh = Math.min(16, rh * .62);
      S("line", { x1: x(0), x2: x(0), y1: 0, y2: rh * n + 2, class: "ax" }, svg);
      const ex = o.exception == null ? -Infinity : o.exception;
      it.forEach((d, i) => {
        const yc = rh * i + rh / 2 + 1, a = Math.min(x(0), x(d.v)), wd = Math.abs(x(d.v) - x(0));
        const fill = d.v <= ex ? "var(--accent)" : d.v < 0 ? "var(--ghost)" : "var(--data)";
        T(svg, w - 2, yc + 4, d.name, "tx", "end");
        S("rect", { x: a, y: yc - bh / 2, width: Math.max(1, wd), height: bh, rx: 3, style: "fill:" + fill }, svg);
        const s = (d.v > 0 ? "+" : "") + fmt(d.v, o.unit || "%");
        T(svg, d.v >= 0 ? x(d.v) + 5 : x(d.v) - 5, yc + 4, s, "tv", d.v >= 0 ? "start" : "end", fill === "var(--accent)" ? { style: "fill:var(--accent-ink)" } : null);
      });
      T(svg, x(0), h - 2, "0", "tx", "middle");
    }, o.title);
  }

  /* ---------- 7. gantt with a real date axis ---------- */
  function gantt(el, o) {
    mount(el, (svg, w, h) => {
      const D = s => new Date(s + "T00:00:00").getTime(), day = 864e5;
      const f = D(o.from), t = D(o.to), tasks = o.tasks;
      const nameW = Math.max(...tasks.map(d => d.name.length)) * CH + 12, top = 22, bot = 6;
      const x = lin(f, t, 4, w - nameW - 4), rh = Math.min(30, (h - top - bot) / tasks.length), bh = Math.min(14, rh * .55);
      // month grid + labels (and week ticks)
      const d0 = new Date(f); d0.setDate(1);
      for (let d = new Date(d0); d.getTime() <= t; d.setMonth(d.getMonth() + 1)) {
        const xm = x(Math.max(f, d.getTime()));
        S("line", { x1: xm, x2: xm, y1: top - 4, y2: h - bot, class: "gl" }, svg);
        const nx = new Date(d); nx.setMonth(nx.getMonth() + 1);
        const mid = x((Math.max(f, d.getTime()) + Math.min(t, nx.getTime())) / 2);
        T(svg, mid, top - 8, MON[d.getMonth()] + (d.getMonth() === 0 ? " " + String(d.getFullYear()).slice(2) : ""), "tx", "middle");
      }
      for (let d = f; d <= t; d += 7 * day) S("line", { x1: x(d), x2: x(d), y1: top - 2, y2: top + 2, class: "ax" }, svg);
      const col = { done: "var(--data-l)", active: "var(--data)", late: "var(--accent)", todo: "var(--grid)" };
      tasks.forEach((k, i) => {
        const yc = top + rh * i + rh / 2;
        T(svg, w - 2, yc + 4, k.name, "tx", "end");
        if (k.state === "milestone") {
          const xm = x(D(k.start));
          S("rect", { x: xm - 6, y: yc - 6, width: 12, height: 12, rx: 2, transform: `rotate(45 ${xm} ${yc})`, style: "fill:var(--strong)" }, svg);
          T(svg, xm - 12, yc + 4, k.label || "", "tx", "end");
          return;
        }
        const a = x(D(k.start)), b = x(D(k.end));
        S("rect", { x: a, y: yc - bh / 2, width: Math.max(3, b - a), height: bh, rx: 3, style: "fill:" + col[k.state || "todo"] + (k.state === "todo" ? ";stroke:var(--ghost)" : "") }, svg);
        if (k.label) T(svg, a - 6, yc + 4, k.label, "tv", "end", k.state === "late" ? { style: "fill:var(--accent-ink)" } : null);
      });
      if (o.today) {
        const xt = x(D(o.today));
        S("line", { x1: xt, x2: xt, y1: top - 4, y2: h - bot, style: "stroke:var(--ink);stroke-dasharray:3 3" }, svg);
        T(svg, xt + 4, h - bot - 2, "היום", "tv");
      }
    }, o.title);
  }

  window.BBI = { columns, line, compare, ranking, waterfall, diverging, gantt, fmt, MON };
})();
