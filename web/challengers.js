// Rivian and Lucid sections of the "Sales" tab: deliveries with forecast, then revenue and net income (ev.json -> rivian, lucid).
// Both are drawn by one function, so the two sections always read the same way.
const CHALLENGERS = [["rivian", "Rivian", "riv", "--c1"], ["lucid", "Lucid", "luc", "--c3"]];

function renderChallenger(key, name, id, colorVar) {
  const D = EV && EV[key];
  if (!D) return;
  const R = D.quarters, fc = D.forecast_deliveries, c = css(colorVar);
  const l = R.at(-1), p = R.at(-5), fr = R.filter((r) => r.revenue != null), fl = fr.at(-1), fp = fr.at(-5);
  const gm = (r) => r.gross_profit / r.revenue;
  $(`${id}Tiles`).innerHTML = [
    tile({ label: `Deliveries, ${evQ(l.q)}`, value: fmt.intC(l.deliveries), delta: deltaChip(l.deliveries / p.deliveries - 1, pctTxt), sub: "vs same quarter last year" }),
    tile({ label: "Production minus deliveries", value: (l.production - l.deliveries >= 0 ? "+" : "−") + fmt.intC(Math.abs(l.production - l.deliveries)), sub: l.production >= l.deliveries ? "inventory building" : "inventory drawing down" }),
    tile({ label: `Revenue, ${evQ(fl.q)}`, value: "$" + (fl.revenue / 1e3).toFixed(2) + "B", delta: deltaChip(fl.revenue / fp.revenue - 1, pctTxt), sub: "vs same quarter last year" }),
    tile({ label: `Gross margin, ${evQ(fl.q)}`, value: fmt.pct(gm(fl)), delta: deltaChip((gm(fl) - gm(fp)) * 100, numTxt(" pts", 1)), sub: `net margin ${fmt.pct(fl.net_income / fl.revenue)}` }),
  ].join("");
  const hx = R.map((r) => evQ(r.q)), fx = fc.fc.month.map(evQ), tv = [...hx, ...fx].filter((x) => x.startsWith("Q1"));
  evBand(`c-${id}-del`, hx, R.map((r) => r.deliveries), fx, fc.fc, c, { tickvals: tv, ticktext: tv.map((x) => x.slice(3)), yaxis: { tickformat: ".2s" } });
  $(`${id}Sub`).textContent = `Reported quarterly deliveries since ${name} began volume production, with the model's outlook for the next ${fx.length} quarters (backtest error ${fmt.pct(fc.wmape, 0)}; short history, so treat the range with care).`;
  const q = fr.map((r) => evQ(r.q)), ticks = q.filter((x) => x.startsWith("Q1"));
  draw(`c-${id}-fin`, [
    { x: q, y: fr.map((r) => r.revenue / 1e3), type: "bar", name: "Revenue", marker: { color: c }, hovertemplate: "Revenue: $%{y:.2f}B<extra></extra>" },
    { x: q, y: fr.map((r) => (r.net_income == null ? null : r.net_income / 1e3)), type: "bar", name: "Net income", marker: { color: rgba(css("--muted"), 0.55) }, hovertemplate: "Net income: $%{y:.2f}B<extra></extra>" },
  ], layout({ barmode: "group", bargap: 0.25, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: ticks, ticktext: ticks.map((x) => x.slice(3)), tickangle: 0 },
    yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".1f", zeroline: true, zerolinecolor: css("--axis") } }));
}

function renderChallengers() { CHALLENGERS.forEach((a) => renderChallenger(...a)); }
