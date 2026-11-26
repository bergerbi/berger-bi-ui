# bbi-charts.js: API

Draw into `<div class="chart" id="x"></div>`, placed inside a `.card`. The chart fills the card and redraws when the card resizes. Text stays 12px.
Units: `'₪'` (shown as ₪14.2M), `'%'`, `'pp'` (נק׳), or none.

| Chart | Call | Use for |
|---|---|---|
| Columns vs target | `BBI.columns(el,{labels,values,target,unit,threshold:.9})` | A month or category against a target. Values under target × threshold turn orange. |
| Trend + forecast | `BBI.line(el,{labels,values,unit,forecast:{labels,values,lo,hi}})` | A time series. The forecast is dashed, with a band and a "today" line. |
| This year vs last | `BBI.compare(el,{labels,cur,prev,unit})` | Period comparison. Last year is grey. A drop of more than 5% turns orange. |
| Ranking | `BBI.ranking(el,{items:[{name,v,exception}],top:2,unit})` | Top N. Names on the right, the top 2 in full color. |
| Bridge | `BBI.waterfall(el,{steps:[{name,v,total}],unit})` | What moved last year to this year. |
| Change by group | `BBI.diverging(el,{items:[{name,v}],unit:'%',exception:-10})` | Plus/minus around zero. Values at or below `exception` turn orange. |
| Gantt | `BBI.gantt(el,{from,to,today,tasks:[{name,start,end,state,label}]})` | Dates as `'YYYY-MM-DD'`. `state` is one of done, active, late, todo, milestone. |

Every chart call:
- Gives real axes with nice ticks and a time axis whose labels never overlap.
- Shows a tooltip that always includes a comparison.
- Dims the other bars on hover.
- Sets `aria-label` from `title`.

Helper: `BBI.fmt(v, unit)` formats a number the same way.

**Charts the kit doesn't have yet:** add a function to `bbi-charts.js` in the same style. Measure the size, use `nice()` ticks, `T()` for text and the `.tx`/`.tv` classes. Do not hand-draw SVG in the page.
