// "Where they sell": Tesla's China domestic vs export, BYD home vs overseas, and Europe registrations (regions.json, scripts/build_regions.py).
function renderRegions() {
  if (!RG) { $("rgNote").textContent = "Regional data is not available."; return; }
  const TC = RG.tesla_china, BH = RG.byd_home, EU = RG.europe, c2 = css("--c2"), c1 = css("--c1");
  const n = TC.months.length - 1, expShare = (i) => TC.exports[i] / (TC.exports[i] + TC.domestic[i]);
  const ytd = (arr, ms, y) => sum(arr.filter((_, i) => ms[i].startsWith(y) && ms[i].slice(5) <= TC.months[n].slice(5)));
  const y = TC.months[n].slice(0, 4), y0 = String(+y - 1);
  const t12 = (a) => sum(a.slice(-12)), t12p = (a) => sum(a.slice(-24, -12));
  const bn = BH.months.length - 1;
  $("rgTiles").innerHTML = [
    tile({ label: `Tesla China wholesale, ${fmt.month(TC.months[n])}`, value: fmt.intC(TC.domestic[n] + TC.exports[n]), delta: deltaChip((TC.domestic[n] + TC.exports[n]) / (TC.domestic[n - 12] + TC.exports[n - 12]) - 1, pctTxt), sub: "vs same month last year" }),
    tile({ label: "Tesla exports share, latest month", value: fmt.pct(expShare(n), 0), delta: deltaChip((expShare(n) - expShare(n - 12)) * 100, numTxt(" pts", 0)), sub: `vs ${fmt.month(TC.months[n - 12])}` }),
    tile({ label: "BYD overseas share, latest month", value: fmt.pct(BH.overseas[bn] / (BH.overseas[bn] + BH.home[bn]), 0), delta: deltaChip((BH.overseas[bn] / (BH.overseas[bn] + BH.home[bn]) - BH.overseas[bn - 12] / (BH.overseas[bn - 12] + BH.home[bn - 12])) * 100, numTxt(" pts", 0)), sub: `vs ${fmt.month(BH.months[bn - 12])}` }),
    tile({ label: "BYD home market, last 12 months", value: fmt.intC(t12(BH.home)), delta: deltaChip(t12(BH.home) / t12p(BH.home) - 1, pctTxt), sub: "vs prior 12 months" }),
  ].join("");
  const tick = (ms) => ms.filter((m) => m.endsWith("-01")), tt = (ms) => tick(ms).map((m) => m.slice(0, 4));
  draw("c-rg-tsl", [
    { x: TC.months, y: TC.domestic, type: "bar", name: "Domestic (China)", marker: { color: rgba(c2, 0.55) }, hovertemplate: "%{y:,.0f}" },
    { x: TC.months, y: TC.exports, type: "bar", name: "Exports", marker: { color: c2 }, hovertemplate: "%{y:,.0f}" },
  ], layout({ barmode: "stack", bargap: 0.2, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: tick(TC.months), ticktext: tt(TC.months), tickangle: 0 }, yaxis: { tickformat: ".2s" } }));
  draw("c-rg-byd", [
    { x: BH.months, y: BH.home, type: "bar", name: "Home market and other", marker: { color: rgba(c1, 0.55) }, hovertemplate: "%{y:,.0f}" },
    { x: BH.months, y: BH.overseas, type: "bar", name: "Overseas", marker: { color: c1 }, hovertemplate: "%{y:,.0f}" },
  ], layout({ barmode: "stack", bargap: 0.2, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: tick(BH.months), ticktext: tt(BH.months), tickangle: 0 }, yaxis: { tickformat: ".2s" } }));
  draw("c-rg-share", [
    { x: TC.months.map((m) => m + "-01"), y: TC.months.map((_, i) => expShare(i)), mode: "lines+markers", name: "Tesla: exports / China wholesale", line: line(c2, 2.6), marker: { size: 5 }, hovertemplate: "%{y:.0%}" },
    { x: BH.months.map((m) => m + "-01"), y: BH.months.map((_, i) => BH.overseas[i] / (BH.overseas[i] + BH.home[i])), mode: "lines+markers", name: "BYD: overseas / total", line: line(c1, 2.6), marker: { size: 5 }, hovertemplate: "%{y:.0%}" },
  ], layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "date" }, yaxis: { tickformat: ".0%", rangemode: "tozero" } }));
  const em = EU.months.map((m) => m + "-01");
  draw("c-rg-eu", [
    { x: em, y: EU.tesla, mode: "lines+markers", name: "Tesla", connectgaps: false, line: line(c2, 2.6), marker: { size: 6 }, hovertemplate: "%{y:,.0f}" },
    { x: em, y: EU.byd, mode: "lines+markers", name: "BYD", connectgaps: false, line: line(c1, 2.6), marker: { size: 7 }, hovertemplate: "%{y:,.0f}" },
  ], layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "date" }, yaxis: { tickformat: ".2s" } }));
  const miss = EU.byd.filter((v) => v == null).length;
  const derived = EU.months.filter((_, i) => EU.basis[i].startsWith("derived")).map(fmt.month).join(", ");
  $("rgEuSub").textContent = `Monthly ACEA registrations through ${fmt.month(EU.months.at(-1))}. BYD is missing in ${miss} months (all in 2024) where ACEA did not report it separately, so its line starts mid-2024.${derived ? ` ${derived} is derived from year-to-date totals.` : ""}`;
  $("rgNote").innerHTML = `${esc2(RG.meta.notes.china)} ${esc2(RG.meta.notes.europe)} Sources: <a href="${RG.meta.sources.cpca}">CPCA via CnEVPost</a>, <a href="${RG.meta.sources.acea}">ACEA</a> (<a href="${RG.meta.sources.europe_table}">table</a>), and BYD's own monthly announcements.`;
}
