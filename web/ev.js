// "EV makers" tab: Tesla and BYD reported volumes, Tesla's SEC financials, and forecasts.
// Optional and additive: reads ev.json (scripts/build_ev_data.py); the app is unchanged if it is missing.


const evK = (v) => (v == null ? "n/a" : (v / 1e3).toFixed(0) + "K");

function evBand(id, hx, hy, fx, fc, color, opts = {}) {
  const f = opts.fmt || ((v) => v);
  draw(id, [
    { x: hx, y: hy.map(f), type: "bar", name: "Actual", marker: { color: hy.map((_, i) => (i === hy.length - 1 ? color : rgba(color, 0.55))), cornerradius: 3 }, hovertemplate: opts.hover || "%{y:,.0f}" },
    { x: fx, y: fc.p90.map(f), mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
    { x: fx, y: fc.p10.map(f), mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: rgba(css("--c2"), 0.18), name: "80% range", hoverinfo: "skip" },
    { x: fx, y: fc.mean.map(f), mode: "lines+markers", name: "Expected", line: { color: css("--c2"), width: 2.6, dash: "dash" }, marker: { size: 7, color: css("--c2"), line: { color: css("--surface"), width: 2 } }, hovertemplate: opts.hover || "%{y:,.0f}" },
  ], layout({ bargap: 0.3, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: opts.tickvals, ticktext: opts.ticktext, tickangle: 0, showline: true }, yaxis: opts.yaxis || {},
    shapes: [{ type: "line", xref: "x", x0: hx.length - 0.5, x1: hx.length - 0.5, yref: "paper", y0: 0, y1: 1, line: { color: css("--axis"), width: 1, dash: "dot" } }],
    annotations: [{ x: hx.length - 0.5, xref: "x", y: 1, yref: "paper", text: "Forecast", showarrow: false, xanchor: "left", xshift: 6, yshift: -4, font: { color: css("--muted"), size: 11.5 } }] }));
}

function renderEv() {
  if (!EV) return;
  const T = EV.tesla.quarters, B = EV.byd.months, ft = EV.tesla.forecast_deliveries, fb = EV.byd.forecast_total, fo = EV.byd.forecast_overseas;
  const tl = T.at(-1), tp = T.at(-5), bl = B.at(-1), bp = B.at(-13);
  const yoy = (a, b) => a / b - 1;

  // ---- freshness
  const ageQ = monthsAgo(tl.q, 2), ageM = monthsAgo(bl.m);
  const finLast = T.filter((r) => r.revenue != null).at(-1);
  const rows = [
    ["Tesla deliveries and production", "Tesla 8-K (Exhibit 99.1)", evQ(tl.q), ageQ, "Quarterly; the latest quarter is read from the filing"],
    ["Tesla financials", "SEC EDGAR (10-Q, 10-K)", evQ(finLast.q), monthsAgo(finLast.q, 2), "Quarterly, about a month after quarter end"],
    ["BYD monthly sales", "BYD announcements to HKEX", fmt.month(bl.m), ageM, "Monthly, on the 1st of the next month; unaudited"],
  ];
  $("evFresh").innerHTML = `<table><thead><tr><th>Source</th><th>Publisher</th><th>Latest data</th><th>Age</th><th></th></tr></thead><tbody>` +
    rows.map(([n, p, latest, age, note]) => `<tr><td><b>${n}</b><span class="sub2">${note}</span></td><td>${p}</td><td>${latest}</td><td>${ageText(age)}</td><td>${ageBadge(age)}</td></tr>`).join("") + "</tbody></table>";

  // ---- head to head: trailing 12 months
  const t12 = sum(T.slice(-4).map((r) => r.deliveries)), t12p = sum(T.slice(-8, -4).map((r) => r.deliveries));
  const b12 = sum(B.slice(-12).map((r) => r.total)), b12p = sum(B.slice(-24, -12).map((r) => r.total));
  $("evTiles").innerHTML = [
    tile({ label: "BYD, last 12 months (NEVs)", value: fmt.intC(b12), delta: deltaChip(yoy(b12, b12p), pctTxt), sub: "vs prior 12 months" }),
    tile({ label: "Tesla, last 4 quarters (deliveries)", value: fmt.intC(t12), delta: deltaChip(yoy(t12, t12p), pctTxt), sub: "vs prior 4 quarters" }),
    tile({ label: "BYD vs Tesla", value: (b12 / t12).toFixed(2) + "×", sub: "BYD volume per Tesla vehicle" }),
    tile({ label: "BYD overseas share, latest month", value: fmt.pct(bl.overseas / bl.total, 0), delta: deltaChip((bl.overseas / bl.total - bp.overseas / bp.total) * 100, numTxt(" pts", 0)), sub: `vs ${fmt.month(bp.m)}` }),
  ].join("");
  const bx = B.map((r) => r.m + "-01"), br = B.map((_, i) => (i >= 11 ? sum(B.slice(i - 11, i + 1).map((r) => r.total)) : null));
  const tx = T.map((r) => r.q + "-01"), tr = T.map((_, i) => (i >= 3 ? sum(T.slice(i - 3, i + 1).map((r) => r.deliveries)) : null));
  draw("c-ev-h2h", [
    { x: bx, y: br, mode: "lines", name: "BYD (NEVs)", connectgaps: false, line: line(css("--c1"), 2.6), hovertemplate: "%{y:,.0f}" },
    { x: tx, y: tr, mode: "lines+markers", name: "Tesla (deliveries)", connectgaps: false, line: line(css("--c2"), 2.6), marker: { size: 6 }, hovertemplate: "%{y:,.0f}" },
  ], layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, hovermode: "x", xaxis: { type: "date", range: ["2020-01-01", bx.at(-1)] }, yaxis: { tickformat: ".2s" } }));

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
  evBand("c-tsl-del", hx, T.map((r) => r.deliveries), fx, ft.fc, css("--c1"), { tickvals: tv, ticktext: tt, yaxis: { tickformat: ".2s" } });
  $("tslSub").textContent = `Reported quarterly deliveries and the model's outlook for the next ${fx.length} quarters (backtest error ${fmt.pct(ft.wmape, 0)}; 80% range held ${fmt.pct(ft.coverage80, 0)} of the time in testing).`;
  draw("c-tsl-gap", [
    { x: hx, y: T.map((r) => r.production), type: "bar", name: "Production", marker: { color: rgba(css("--c3"), 0.75) }, hovertemplate: "%{y:,.0f}" },
    { x: hx, y: T.map((r) => r.deliveries), type: "bar", name: "Deliveries", marker: { color: css("--c1") }, hovertemplate: "%{y:,.0f}" },
  ], layout({ barmode: "group", bargap: 0.25, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: hx.filter((l) => l.startsWith("Q1")), ticktext: hx.filter((l) => l.startsWith("Q1")).map((l) => l.slice(3)), tickangle: 0 }, yaxis: { tickformat: ".2s" } }));
  draw("c-tsl-fin", [
    { x: fr.map((r) => evQ(r.q)), y: fr.map((r) => r.revenue / 1e3), type: "bar", name: "Revenue ($B)", marker: { color: rgba(css("--c1"), 0.7) }, hovertemplate: "$%{y:.1f}B" },
    { x: fr.map((r) => evQ(r.q)), y: fr.map(om), mode: "lines+markers", name: "Operating margin (right axis)", yaxis: "y2", line: line(css("--c2"), 2.4), marker: { size: 5 }, hovertemplate: "%{y:.1%}" },
  ], layout({ bargap: 0.3, margin: { l: 8, r: 40, t: 28, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: fr.filter((r) => r.q.endsWith("-01")).map((r) => evQ(r.q)), ticktext: fr.filter((r) => r.q.endsWith("-01")).map((r) => r.q.slice(0, 4)), tickangle: 0 },
    yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f" }, yaxis2: { overlaying: "y", side: "right", tickformat: ".0%", showgrid: false, zeroline: false } }));
  const mx = T.filter((r) => r.model_3y != null);
  draw("c-tsl-mix", [{ x: mx.map((r) => evQ(r.q)), y: mx.map((r) => r.model_3y / r.deliveries), mode: "lines+markers", name: "Model 3 and Y share", line: line(css("--c1"), 2.6), marker: { size: 6 }, hovertemplate: "%{y:.1%}" }],
    layout({ margin: { l: 8, r: 16, t: 16, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: mx.filter((r) => r.q.endsWith("-01")).map((r) => evQ(r.q)), ticktext: mx.filter((r) => r.q.endsWith("-01")).map((r) => r.q.slice(0, 4)), tickangle: 0 }, yaxis: { tickformat: ".0%", range: [0.8, 1.0] }, showlegend: false }));

  // ---- BYD
  const ytd = (y) => sum(B.filter((r) => r.m.startsWith(y) && r.m.slice(5) <= bl.m.slice(5)).map((r) => r.total));
  const y0 = bl.m.slice(0, 4), y1 = String(+y0 - 1);
  $("bydTiles").innerHTML = [
    tile({ label: `NEV sales, ${fmt.month(bl.m)}`, value: fmt.intC(bl.total), delta: deltaChip(yoy(bl.total, bp.total), pctTxt), sub: "vs same month last year" }),
    tile({ label: `Year to date, ${y0}`, value: fmt.intC(ytd(y0)), delta: deltaChip(yoy(ytd(y0), ytd(y1)), pctTxt), sub: `vs ${y1} same months` }),
    tile({ label: "Overseas, latest month", value: fmt.intC(bl.overseas), delta: deltaChip(yoy(bl.overseas, bp.overseas), pctTxt), sub: "vs same month last year" }),
    tile({ label: `Next month outlook, ${fmt.month(fb.fc.month[0])}`, value: fmt.intC(fb.fc.mean[0]), sub: `range ${fmt.intC(fb.fc.p10[0])} to ${fmt.intC(fb.fc.p90[0])}` }),
  ].join("");
  const bh = B.map((r) => r.m), bf = fb.fc.month, bt = [...bh, ...bf].filter((l) => l.endsWith("-01"));
  evBand("c-byd-sales", bh, B.map((r) => r.total), bf, fb.fc, css("--c3"), { tickvals: bt, ticktext: bt.map((l) => l.slice(0, 4)), yaxis: { tickformat: ".2s" } });
  $("bydSub").textContent = `Monthly NEV sales from BYD's announcements, with the outlook for the next ${bf.length} months (backtest error ${fmt.pct(fb.wmape, 0)}; 80% range held ${fmt.pct(fb.coverage80, 0)} of the time).`;
  const Bs = B.filter((r) => r.overseas != null), bsh = Bs.map((r) => r.m);          // the split exists from January 2023
  draw("c-byd-over", [
    { x: bsh, y: Bs.map((r) => r.total - r.overseas), type: "bar", name: "Home market and other", marker: { color: rgba(css("--c3"), 0.7) }, hovertemplate: "%{y:,.0f}" },
    { x: bsh, y: Bs.map((r) => r.overseas), type: "bar", name: "Overseas", marker: { color: css("--c2") }, hovertemplate: "%{y:,.0f}" },
  ], layout({ barmode: "stack", bargap: 0.2, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: bsh.filter((m) => m.endsWith("-01")), ticktext: bsh.filter((m) => m.endsWith("-01")).map((m) => m.slice(0, 4)), tickangle: 0 }, yaxis: { tickformat: ".2s" } }));
  const ov = Bs.slice(-24);
  draw("c-byd-overfc", [
    { x: ov.map((r) => r.m), y: ov.map((r) => r.overseas), mode: "lines+markers", name: "Actual", line: line(css("--c2"), 2.6), marker: { size: 5 }, hovertemplate: "%{y:,.0f}" },
    { x: fo.fc.month, y: fo.fc.p90, mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
    { x: fo.fc.month, y: fo.fc.p10, mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: rgba(css("--c2"), 0.18), name: "80% range", hoverinfo: "skip" },
    { x: fo.fc.month, y: fo.fc.mean, mode: "lines", name: "Expected", line: { color: css("--c2"), width: 2.4, dash: "dash" }, hovertemplate: "%{y:,.0f}" },
  ], layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", nticks: 10, tickangle: 0 }, yaxis: { tickformat: ".2s" } }));
  $("bydOverSub").textContent = `Overseas sales are growing fast and unevenly, so this model is the least reliable here (backtest error ${fmt.pct(fo.wmape, 0)}). Read the range, not the line.`;

  $("evNote").innerHTML = `${EV.meta.notes.byd} ${EV.meta.notes.tesla} Sources: <a href="${EV.meta.tesla_sources.deliveries}">Tesla deliveries (datahub, from Tesla's 8-Ks)</a>, <a href="${EV.meta.tesla_sources.sec}">SEC EDGAR</a>, <a href="${EV.meta.byd_sources.monthly}">BYD monthly sales (CnEVPost, from HKEX announcements)</a>. These companies do not publish product or customer-level open data, so there are no product, rating or lifecycle views here.`;
}
