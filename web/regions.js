// "Where they sell": Tesla's China domestic vs export, export share, and Europe registrations (regions.json, scripts/build_regions.py).
function renderRegions() {
  if (!RG) { $("rgNote").textContent = "Regional data is not available."; return; }
  const TC = RG.tesla_china, EU = RG.europe, c2 = css("--c2");
  const n = TC.months.length - 1, expShare = (i) => TC.exports[i] / (TC.exports[i] + TC.domestic[i]);
  const ytd = (arr, ms, y) => sum(arr.filter((_, i) => ms[i].startsWith(y) && ms[i].slice(5) <= TC.months[n].slice(5)));
  const y = TC.months[n].slice(0, 4), y0 = String(+y - 1);
  const t12 = (a) => sum(a.slice(-12)), t12p = (a) => sum(a.slice(-24, -12));
  $("rgTiles").innerHTML = [
    tile({ label: `Tesla China wholesale, ${fmt.month(TC.months[n])}`, value: fmt.intC(TC.domestic[n] + TC.exports[n]), delta: deltaChip((TC.domestic[n] + TC.exports[n]) / (TC.domestic[n - 12] + TC.exports[n - 12]) - 1, pctTxt), sub: "vs same month last year" }),
    tile({ label: "Tesla exports share, latest month", value: fmt.pct(expShare(n), 0), delta: deltaChip((expShare(n) - expShare(n - 12)) * 100, numTxt(" pts", 0)), sub: `vs ${fmt.month(TC.months[n - 12])}` }),
    tile({ label: `Tesla China wholesale, ${y} to date`, value: fmt.intC(ytd(TC.domestic, TC.months, y) + ytd(TC.exports, TC.months, y)), delta: deltaChip((ytd(TC.domestic, TC.months, y) + ytd(TC.exports, TC.months, y)) / (ytd(TC.domestic, TC.months, y0) + ytd(TC.exports, TC.months, y0)) - 1, pctTxt), sub: `vs same months of ${y0}` }),
    tile({ label: "Tesla Europe registrations, last 12 months", value: fmt.intC(t12(EU.tesla)), delta: deltaChip(t12(EU.tesla) / t12p(EU.tesla) - 1, pctTxt), sub: `to ${fmt.month(EU.months.at(-1))}, vs prior 12 months` }),
  ].join("");
  const tick = (ms) => ms.filter((m) => m.endsWith("-01")), tt = (ms) => tick(ms).map((m) => m.slice(0, 4));
  draw("c-rg-tsl", [
    { x: TC.months, y: TC.domestic, type: "bar", name: "Domestic (China)", marker: { color: rgba(c2, 0.55) }, hovertemplate: "%{y:,.0f}" },
    { x: TC.months, y: TC.exports, type: "bar", name: "Exports", marker: { color: c2 }, hovertemplate: "%{y:,.0f}" },
  ], layout({ barmode: "stack", bargap: 0.2, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: tick(TC.months), ticktext: tt(TC.months), tickangle: 0 }, yaxis: { tickformat: ".2s" } }));
  const sh = TC.months.map((_, i) => expShare(i)), sh3 = sh.map((_, i) => (i < 2 ? null : (sh[i] + sh[i - 1] + sh[i - 2]) / 3));
  draw("c-rg-share", [
    { x: TC.months.map((m) => m + "-01"), y: sh, mode: "markers", name: "Monthly", marker: { size: 8, color: rgba(c2, 0.45) }, hovertemplate: "%{y:.0%}" },
    { x: TC.months.map((m) => m + "-01"), y: sh3, mode: "lines", name: "3-month average", line: line(c2, 2.6), hovertemplate: "%{y:.0%}" },
  ], layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "date" }, yaxis: { tickformat: ".0%", rangemode: "tozero" } }));
  const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], eys = [...new Set(EU.months.map((m) => m.slice(0, 4)))];
  draw("c-rg-eu", eys.map((yy, k) => {
    const last = k === eys.length - 1, op = last ? 1 : 0.25 + 0.5 * (k / Math.max(1, eys.length - 1));
    const ms = EU.months.filter((m) => m.startsWith(yy));
    return { x: ms.map((m) => MN[+m.slice(5) - 1]), y: ms.map((m) => EU.tesla[EU.months.indexOf(m)]), mode: "lines+markers", name: yy, line: line(rgba(c2, op), last ? 3 : 2), marker: { size: last ? 8 : 6, color: rgba(c2, op) }, hovertemplate: `${yy} %{x}: %{y:,.0f}<extra></extra>` };
  }), layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", categoryorder: "array", categoryarray: MN }, yaxis: { tickformat: ".2s", rangemode: "tozero" } }));
  const derived = EU.months.filter((_, i) => EU.basis[i].startsWith("derived")).map(fmt.month).join(", ");
  $("rgEuSub").textContent = `Tesla's monthly ACEA registrations, one line per year, through ${fmt.month(EU.months.at(-1))}. The darkest line is the latest year.${derived ? ` ${derived} is derived from year-to-date totals.` : ""}`;
  $("rgNote").innerHTML = `${esc2(RG.meta.notes.china)} ${esc2(RG.meta.notes.europe)} Sources: <a href="${RG.meta.sources.cpca}">CPCA via CnEVPost</a>, <a href="${RG.meta.sources.acea}">ACEA</a> (earlier months from <a href="${RG.meta.sources.europe_table}">CnEVPost</a>'s table of ACEA data).`;
}
