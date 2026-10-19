// Rivian section of the "Sales & forecast" tab: deliveries with forecast, revenue and margins (ev.json -> rivian).
function renderRivian() {
  if (!EV || !EV.rivian) return;
  const R = EV.rivian.quarters, fc = EV.rivian.forecast_deliveries, c = css("--c4");
  const l = R.at(-1), p = R.at(-5), fr = R.filter((r) => r.revenue != null), fl = fr.at(-1), fp = fr.at(-5);
  const gm = (r) => r.gross_profit / r.revenue;
  $("rivTiles").innerHTML = [
    tile({ label: `Deliveries, ${evQ(l.q)}`, value: fmt.intC(l.deliveries), delta: deltaChip(l.deliveries / p.deliveries - 1, pctTxt), sub: "vs same quarter last year" }),
    tile({ label: "Production minus deliveries", value: (l.production - l.deliveries >= 0 ? "+" : "−") + fmt.intC(Math.abs(l.production - l.deliveries)), sub: l.production >= l.deliveries ? "inventory building" : "inventory drawing down" }),
    tile({ label: `Revenue, ${evQ(fl.q)}`, value: "$" + (fl.revenue / 1e3).toFixed(2) + "B", delta: deltaChip(fl.revenue / fp.revenue - 1, pctTxt), sub: "vs same quarter last year" }),
    tile({ label: `Gross margin, ${evQ(fl.q)}`, value: fmt.pct(gm(fl)), delta: deltaChip((gm(fl) - gm(fp)) * 100, numTxt(" pts", 1)), sub: `net margin ${fmt.pct(fl.net_income / fl.revenue)}` }),
  ].join("");
  const hx = R.map((r) => evQ(r.q)), fx = fc.fc.month.map(evQ), tv = [...hx, ...fx].filter((x) => x.startsWith("Q1"));
  evBand("c-riv-del", hx, R.map((r) => r.deliveries), fx, fc.fc, c, { tickvals: tv, ticktext: tv.map((x) => x.slice(3)), yaxis: { tickformat: ".2s" } });
  $("rivSub").textContent = `Reported quarterly deliveries since Rivian began volume production, with the model's outlook for the next ${fx.length} quarters (backtest error ${fmt.pct(fc.wmape, 0)}; short history, so treat the range with care).`;
  const q = fr.map((r) => evQ(r.q));
  draw("c-riv-fin", [
    { x: q, y: fr.map((r) => r.revenue / 1e3), type: "bar", name: "Revenue ($B)", marker: { color: rgba(c, 0.7) }, hovertemplate: "$%{y:.2f}B" },
    { x: q, y: fr.map((r) => (r.revenue > 100 ? gm(r) : null)), mode: "lines+markers", name: "Gross margin (right)", yaxis: "y2", line: line(css("--c2"), 2.2), marker: { size: 5 }, hovertemplate: "%{y:.0%}" },
    { x: q, y: fr.map((r) => (r.revenue > 100 ? r.net_income / r.revenue : null)), mode: "lines+markers", name: "Net margin (right)", yaxis: "y2", line: line(css("--muted"), 2), marker: { size: 4 }, hovertemplate: "%{y:.0%}" },
  ], layout({ bargap: 0.3, margin: { l: 8, r: 40, t: 40, b: 8 }, legend: { y: 1.25 }, xaxis: { type: "category", tickmode: "array", tickvals: q.filter((x) => x.startsWith("Q1")), ticktext: q.filter((x) => x.startsWith("Q1")).map((x) => x.slice(3)), tickangle: 0 },
    yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".1f" }, yaxis2: { overlaying: "y", side: "right", tickformat: ".0%", showgrid: false, zeroline: true, range: [-2.5, 0.5] } }));
}
