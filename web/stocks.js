// "Stock vs business": calendar-year share price changes next to revenue and volume growth (stocks.json, scripts/build_stocks.py).
// Only derived percentage figures are published (see the terms note on the page). Not investment advice.
let SK = null;
function prepStocks(d) { SK = d; }

function renderStocks() {
  if (!SK) { $("skNote").textContent = "Stock data is not available."; return; }
  const C = SK.companies, Y = SK.years, CO_SK = ["Tesla", "Rivian", "Lucid"].filter((co) => C[co]);
  const yrs = [...new Set(Y.map((r) => r.year))].sort(), col = (co) => css({ Tesla: "--c2", Rivian: "--c1", Lucid: "--c3" }[co]);
  const row = (co, y) => Y.find((r) => r.company === co && r.year === y);
  const pctSigned = (v) => (v == null ? "n/a" : pctTxt(v));
  $("skTiles").innerHTML = [
    duoTile(`Share price, 2026 to ${fmt.month(C.Tesla.ytd_through)}`, CO_SK.map((co) => [co, col(co), pctTxt(C[co].ytd_return)]), "price change only"),
    duoTile("Volatility, last 3 years", CO_SK.map((co) => [co, col(co), fmt.pct(C[co].volatility_36m, 0)]), "annualised, from monthly moves"),
  ].join("");
  draw("c-sk-ret", CO_SK.map((co) => ({ x: yrs.map(String), y: yrs.map((y) => row(co, y)?.stock_return ?? null), type: "bar", name: co, marker: { color: col(co) }, hovertemplate: "%{y:.0%}" })),
    layout({ barmode: "group", bargap: 0.25, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category" }, yaxis: { tickformat: ".0%" } }));
  CO_SK.forEach((co) => {
    const ys = yrs.filter((y) => row(co, y)?.revenue_growth != null), vols = ys.filter((y) => row(co, y).volume_growth != null);
    draw(`c-sk-${co.toLowerCase()}`, [
      { x: ys.map(String), y: ys.map((y) => row(co, y).stock_return), type: "bar", name: "Share price", marker: { color: col(co) }, hovertemplate: "%{y:.0%}" },
      { x: ys.map(String), y: ys.map((y) => row(co, y).revenue_growth), type: "bar", name: "Revenue growth", marker: { color: rgba(col(co), 0.45) }, hovertemplate: "%{y:.0%}" },
      { x: vols.map(String), y: vols.map((y) => row(co, y).volume_growth), mode: "lines+markers", name: "Volume growth", line: { color: css("--ink2"), width: 2.4 }, marker: { size: 7 }, hovertemplate: "%{y:.0%}" },
    ], layout({ barmode: "group", bargap: 0.25, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category" }, yaxis: { tickformat: ".0%" } }));
  });
  $("skTable").innerHTML = `<thead><tr><th>Year</th><th>Company</th><th class="n">Share price</th><th class="n">Revenue growth</th><th class="n">Volume growth</th><th>Market vs revenue</th></tr></thead><tbody>` +
    Y.filter((r) => r.revenue_growth != null).sort((a, b) => b.year - a.year || a.company.localeCompare(b.company)).map((r) => {
      const gap = r.stock_return - r.revenue_growth;
      return `<tr><td>${r.year}</td><td><span class="dotk" style="background:${col(r.company)}"></span><b>${r.company}</b></td><td class="n">${pctSigned(r.stock_return)}</td><td class="n">${pctSigned(r.revenue_growth)}</td><td class="n">${pctSigned(r.volume_growth)}</td><td><span class="badge ${gap > 0.1 ? "warn" : gap < -0.1 ? "good" : ""}">${gap > 0.1 ? "Ahead of revenue" : gap < -0.1 ? "Behind revenue" : "About level"}</span></td></tr>`;
    }).join("") + "</tbody>";
  $("skNote").innerHTML = `${esc2(SK.meta.notes.terms)} ${esc2(SK.meta.notes.reading)} Revenue growth is in US dollars from SEC filings; Rivian's 2022 growth is left out because 2021 revenue was too small to compare. "Ahead" means the share price rose more than 10 points more than revenue. <b>This is not investment advice.</b>`;
}
