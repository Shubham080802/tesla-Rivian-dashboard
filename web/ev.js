// "Sales & forecast" tab: Tesla and Rivian reported volumes, SEC financials and forecasts (Rivian's section is in rivian.js).
// Optional and additive: reads ev.json (scripts/build_ev_data.py); the app is unchanged if it is missing.


const evK = (v) => (v == null ? "n/a" : (v / 1e3).toFixed(0) + "K");

function evBand(id, hx, hy, fx, fc, color, opts = {}) {
  const f = opts.fmt || ((v) => v);
  draw(id, [
    { x: hx, y: hy.map(f), type: "bar", name: "Actual", marker: { color: hy.map((_, i) => (i === hy.length - 1 ? color : rgba(color, 0.55))), cornerradius: 3 }, hovertemplate: opts.hover || "%{y:,.0f}" },
    { x: fx, y: fc.p90.map(f), mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
    { x: fx, y: fc.p10.map(f), mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: rgba(color, 0.18), name: "80% range", hoverinfo: "skip" },
    { x: fx, y: fc.mean.map(f), mode: "lines+markers", name: "Expected", line: { color, width: 2.6, dash: "dash" }, marker: { size: 7, color, line: { color: css("--surface"), width: 2 } }, hovertemplate: opts.hover || "%{y:,.0f}" },
  ], layout({ bargap: 0.3, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: opts.tickvals, ticktext: opts.ticktext, tickangle: 0, showline: true }, yaxis: opts.yaxis || {},
    shapes: [{ type: "line", xref: "x", x0: hx.length - 0.5, x1: hx.length - 0.5, yref: "paper", y0: 0, y1: 1, line: { color: css("--axis"), width: 1, dash: "dot" } }],
    annotations: [{ x: hx.length - 0.5, xref: "x", y: 1, yref: "paper", text: "Forecast", showarrow: false, xanchor: "left", xshift: 6, yshift: -4, font: { color: css("--muted"), size: 11.5 } }] }));
}

function renderEv() {
  if (!EV) return;
  const T = EV.tesla.quarters, R = EV.rivian.quarters, ft = EV.tesla.forecast_deliveries, fr_ = EV.rivian.forecast_deliveries;
  const tl = T.at(-1), tp = T.at(-5), rl = R.at(-1);
  const yoy = (a, b) => a / b - 1;

  // ---- freshness
  const ageQ = monthsAgo(tl.q, 2), rFin = R.filter((r) => r.revenue != null).at(-1);
  const finLast = T.filter((r) => r.revenue != null).at(-1);
  const rows = [
    ["Tesla deliveries and production", "Tesla 8-K (Exhibit 99.1)", evQ(tl.q), ageQ, "Quarterly; the latest quarter is read from the filing"],
    ["Tesla financials", "SEC EDGAR (10-Q, 10-K)", evQ(finLast.q), monthsAgo(finLast.q, 2), "Quarterly, about a month after quarter end"],
    ["Rivian deliveries and production", "Rivian 8-K releases", evQ(rl.q), monthsAgo(rl.q, 2), "Quarterly, in the first days after quarter end"],
    ["Rivian financials", "SEC EDGAR (10-Q, 10-K)", evQ(rFin.q), monthsAgo(rFin.q, 2), "Quarterly, about a month after quarter end"],
  ];
  $("evFresh").innerHTML = `<table><thead><tr><th>Source</th><th>Publisher</th><th>Latest data</th><th>Age</th><th></th></tr></thead><tbody>` +
    rows.map(([n, p, latest, age, note]) => `<tr><td><b>${n}</b><span class="sub2">${note}</span></td><td>${p}</td><td>${latest}</td><td>${ageText(age)}</td><td>${ageBadge(age)}</td></tr>`).join("") + "</tbody></table>";

  // ---- head to head: trailing 12 months
  const t12 = sum(T.slice(-4).map((r) => r.deliveries)), t12p = sum(T.slice(-8, -4).map((r) => r.deliveries));
  const r12 = sum(R.slice(-4).map((r) => r.deliveries)), r12p = sum(R.slice(-8, -4).map((r) => r.deliveries));
  const nx = (fc) => sum(fc.fc.mean.slice(0, 4));
  $("evTiles").innerHTML = [
    tile({ label: "Tesla, last 4 quarters", value: fmt.intC(t12), delta: deltaChip(yoy(t12, t12p), pctTxt), sub: "deliveries vs prior 4 quarters" }),
    tile({ label: "Rivian, last 4 quarters", value: fmt.intC(r12), delta: deltaChip(yoy(r12, r12p), pctTxt), sub: "deliveries vs prior 4 quarters" }),
    tile({ label: "Tesla vs Rivian", value: Math.round(t12 / r12) + "×", sub: "Tesla vehicles per Rivian vehicle" }),
    tile({ label: "Rivian's share of the pair, next 4 quarters", value: fmt.pct(nx(fr_) / (nx(fr_) + nx(ft)), 1), delta: deltaChip((nx(fr_) / (nx(fr_) + nx(ft)) - r12 / (r12 + t12)) * 100, numTxt(" pts", 1)), sub: `expected, vs ${fmt.pct(r12 / (r12 + t12), 1)} in the last 4` }),
  ].join("");
  const roll = (Q) => Q.map((_, i) => (i >= 3 ? sum(Q.slice(i - 3, i + 1).map((r) => r.deliveries)) : null));
  draw("c-ev-h2h", [
    { x: T.map((r) => r.q + "-01"), y: roll(T), mode: "lines+markers", name: "Tesla", connectgaps: false, line: line(css("--c2"), 2.6), marker: { size: 6 }, hovertemplate: "Tesla: %{y:,.0f}<extra></extra>" },
    { x: R.map((r) => r.q + "-01"), y: roll(R), mode: "lines+markers", name: "Rivian", connectgaps: false, line: line(css("--c1"), 2.6), marker: { size: 6 }, hovertemplate: "Rivian: %{y:,.0f}<extra></extra>" },
  ], layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, hovermode: "x unified", xaxis: { type: "date", range: ["2019-10-01", T.at(-1).q + "-15"] }, yaxis: { tickformat: ".2s", rangemode: "tozero" } }));

  // ---- Tesla
  const rev = (r) => r.revenue, om = (r) => (r.revenue ? r.operating_income / r.revenue : null);
  const fr = T.filter((r) => r.revenue != null), frl = fr.at(-1), frp = fr.at(-5);
  const mix = T.filter((r) => r.model_3y != null).at(-1);
  $("tslTiles").innerHTML = [
    tile({ label: `Deliveries, ${evQ(tl.q)}`, value: fmt.intC(tl.deliveries), delta: deltaChip(yoy(tl.deliveries, tp.deliveries), pctTxt), sub: "vs same quarter last year" }),
    tile({ label: "Production minus deliveries", value: (tl.production - tl.deliveries >= 0 ? "+" : "−") + fmt.intC(Math.abs(tl.production - tl.deliveries)), sub: tl.production >= tl.deliveries ? "inventory building" : "inventory drawing down" }),
    tile({ label: `Revenue, ${evQ(frl.q)}`, value: "$" + (frl.revenue / 1e3).toFixed(1) + "B", delta: deltaChip(yoy(frl.revenue, frp.revenue), pctTxt), sub: "vs same quarter last year" }),
    tile({ label: `Operating margin, ${evQ(frl.q)}`, value: fmt.pct(om(frl)), delta: deltaChip((om(frl) - om(frp)) * 100, numTxt(" pts", 1)), sub: `vs ${fmt.pct(om(frp))} a year earlier` }),
  ].join("");
  const hx = T.map((r) => evQ(r.q)), fx = ft.fc.month.map(evQ), lastYr = (q) => q.slice(0, 4);
  const tv = [...hx, ...fx].filter((l) => l.startsWith("Q1")), tt = tv.map((l) => l.slice(3));
  evBand("c-tsl-del", hx, T.map((r) => r.deliveries), fx, ft.fc, css("--c2"), { tickvals: tv, ticktext: tt, yaxis: { tickformat: ".2s" } });
  $("tslSub").textContent = `Reported quarterly deliveries and the model's outlook for the next ${fx.length} quarters (backtest error ${fmt.pct(ft.wmape, 0)}; 80% range held ${fmt.pct(ft.coverage80, 0)} of the time in testing).`;
  draw("c-tsl-gap", [
    { x: hx, y: T.map((r) => r.production), type: "bar", name: "Production", marker: { color: rgba(css("--c3"), 0.75) }, hovertemplate: "%{y:,.0f}" },
    { x: hx, y: T.map((r) => r.deliveries), type: "bar", name: "Deliveries", marker: { color: css("--c2") }, hovertemplate: "%{y:,.0f}" },
  ], layout({ barmode: "group", bargap: 0.25, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: hx.filter((l) => l.startsWith("Q1")), ticktext: hx.filter((l) => l.startsWith("Q1")).map((l) => l.slice(3)), tickangle: 0 }, yaxis: { tickformat: ".2s" } }));
  draw("c-tsl-fin", [
    { x: fr.map((r) => evQ(r.q)), y: fr.map((r) => r.revenue / 1e3), type: "bar", name: "Revenue ($B)", marker: { color: rgba(css("--c2"), 0.7) }, hovertemplate: "$%{y:.1f}B" },
    { x: fr.map((r) => evQ(r.q)), y: fr.map(om), mode: "lines+markers", name: "Operating margin (right axis)", yaxis: "y2", line: line(css("--c3"), 2.4), marker: { size: 5 }, hovertemplate: "%{y:.1%}" },
  ], layout({ bargap: 0.3, margin: { l: 8, r: 40, t: 28, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: fr.filter((r) => r.q.endsWith("-01")).map((r) => evQ(r.q)), ticktext: fr.filter((r) => r.q.endsWith("-01")).map((r) => r.q.slice(0, 4)), tickangle: 0 },
    yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f" }, yaxis2: { overlaying: "y", side: "right", tickformat: ".0%", showgrid: false, zeroline: false } }));
  const mx = T.filter((r) => r.model_3y != null);
  draw("c-tsl-mix", [{ x: mx.map((r) => evQ(r.q)), y: mx.map((r) => r.model_3y / r.deliveries), mode: "lines+markers", name: "Model 3 and Y share", line: line(css("--c2"), 2.6), marker: { size: 6 }, hovertemplate: "%{y:.1%}" }],
    layout({ margin: { l: 8, r: 16, t: 16, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: mx.filter((r) => r.q.endsWith("-01")).map((r) => evQ(r.q)), ticktext: mx.filter((r) => r.q.endsWith("-01")).map((r) => r.q.slice(0, 4)), tickangle: 0 }, yaxis: { tickformat: ".0%", range: [0.8, 1.0] }, showlegend: false }));

  $("evNote").innerHTML = `${EV.meta.notes.tesla} ${esc2(EV.rivian.note || "")} Sources: <a href="${EV.meta.tesla_sources.deliveries}">Tesla deliveries (datahub, from Tesla's 8-Ks)</a>, <a href="${EV.meta.tesla_sources.sec}">SEC EDGAR (Tesla)</a>, <a href="${EV.rivian.sources.sec}">SEC EDGAR (Rivian)</a>. These companies do not publish product or customer-level open data, so there are no product, rating or lifecycle views here.`;
  if (typeof renderRivian === "function") renderRivian();
}
