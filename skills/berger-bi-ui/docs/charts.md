# bbi-charts.js: API

Draw into `<div class="chart" id="x"></div>`, placed inside a `.card`. The chart fills the card, redraws on resize, and uses `--fs-s` for text, so CEO mode scales it too.

Every call can take these options:
| Option | What it does |
|---|---|
| `title` | Accessible name for the chart. Always pass it. |
| `yTitle` | Axis title, shown above the y axis. |
| `unit` | `'₪'` (shows ₪14.2M), `'%'`, `'pp'` (נק׳), or none. |
| `onClick(i, datum)` | Click handler, for example to filter the screen (`BBIShell.set(...)`). |

Every chart shows a tooltip with a comparison, dims the other marks on hover, and runs a label-collision pass. Empty data shows "אין נתונים".

| Chart | Call | Notes |
|---|---|---|
| Columns vs target | `BBI.columns(el,{labels,values,target,threshold:.9,emphasis:'last',partialLast})` | `target` is a number or an array. The target is drawn as a dark tick. A value below target × threshold is red. `emphasis`: `'last'` (default; the rest are light), `'all'`, or `highlight:[i]`. `partialLast` hatches a month that isn't closed yet. |
| Trend + forecast | `BBI.line(el,{labels,values,forecast:{labels,values,lo,hi}})` | The forecast is dashed, with a band and a "today" line. The crosshair tooltip shows the change from the previous point. |
| This year vs last | `BBI.compare(el,{labels,cur,prev,curName,prevName,threshold:.95})` | Last year is grey. A drop below `threshold` is red. Draws a small key with the 2 series. |
| Ranking | `BBI.ranking(el,{items:[{name,v,exception}],top:2})` | Names on the right. The top N are dark. Extra rows fold into "אחרים (n)". |
| Bridge | `BBI.waterfall(el,{steps:[{name,v,total}],good:'up'})` | Totals are dark, increases green, decreases red. With `good:'down'` (for costs) the colors swap. |
| Change by group | `BBI.diverging(el,{items:[{name,v}],good:'up'})` | Plus or minus around 0. Bad is red, good is green. |
| Gantt | `BBI.gantt(el,{from,to,today,tasks:[{name,start,end,state,label}]})` | Dates are `'YYYY-MM-DD'`. `state` is one of done, active, late (red), todo, or milestone. Months switch to quarters when the range is long. Rows that don't fit show "+n שורות". |

To format numbers the same way elsewhere, use `BBI.fmt(v, unit)`. It never uses `Intl` he-IL, which puts ₪ after the number.

To add a chart type, add it to `bbi-charts.js` **in the shared repo**, not in a project's copy. Use the same helpers: `mount`, `nice`, `yAxis`, `xLabels`, `bind`, `tw`.
