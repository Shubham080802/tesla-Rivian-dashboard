// "Head to head": Tesla, Rivian and Lucid scoreboard, finances, attention and charging build-out. All three are U.S.-listed and report to the SEC in US dollars.
// Reads versus.json (scripts/build_versus_data.py) and ev.json (scripts/build_ev_data.py).

const TSL = () => css("--c2"), RIVc = () => css("--c1"), LUCc = () => css("--c3");
const usdB = (m) => (m < 0 ? "−$" : "$") + (Math.abs(m) / 1e3).toFixed(1) + "B";
const CO = [["tsl", "Tesla", TSL], ["riv", "Rivian", RIVc], ["luc", "Lucid", LUCc]];

function renderVersus() {
  if (!VS || !EV) return;
  const T = EV.tesla.quarters, R = EV.rivian.quarters, L = EV.lucid.quarters, F_ = VS.fin, yrs = F_.years, last = yrs.length - 1;
  const ix = (a, y) => a[yrs.indexOf(y)];
  const sumK = (a, k) => sum(a.map((r) => r[k]));
  const Q = { tsl: T, riv: R, luc: L };
  const vol = Object.fromEntries(Object.entries(Q).map(([k, x]) => [k, [sumK(x.slice(-4), "deliveries"), sumK(x.slice(-8, -4), "deliveries")]]));
  const fin = { tsl: F_.tesla, riv: F_.rivian, luc: F_.lucid };
  const y = yrs[last];
  const at = (k, m) => ix(fin[k][m], y), prev = (k, m) => ix(fin[k][m], yrs[last - 1]);
  const avg12 = (co) => mean(VS.pageviews[co].views.slice(-12)), avgP = (co) => mean(VS.pageviews[co].views.slice(-24, -12));
  const pvKey = { tsl: "tesla", riv: "rivian", luc: "lucid" };
  // last four quarters of reported financials, so the scoreboard is as current as the filings
  const q4 = (k, m) => { const f = Q[k].filter((r) => r.revenue != null).slice(-4); return f.length === 4 ? sum(f.map((r) => r[m])) : null; };
  const qEnd = (k) => evQ(Q[k].filter((r) => r.revenue != null).at(-1).q);

  // each row: label, value per company, formatter, note
  const rows = [
    ["Vehicles delivered, last 4 quarters", (k) => vol[k][0], fmt.intC, `to ${evQ(T.at(-1).q)}`],
    ["Delivery growth vs prior 4 quarters", (k) => vol[k][0] / vol[k][1] - 1, pctTxt, ""],
    ["Revenue, last 4 quarters", (k) => q4(k, "revenue"), usdB, `to ${qEnd("tsl")}, from 10-Q and 10-K filings`],
    [`Revenue growth, ${y}`, (k) => at(k, "revenue") / prev(k, "revenue") - 1, pctTxt, "full year"],
    ["Net income, last 4 quarters", (k) => q4(k, "net_income"), usdB, "attributable to shareholders; Rivian and Lucid are loss-making"],
    ["Net margin, last 4 quarters", (k) => q4(k, "net_income") / q4(k, "revenue"), (v) => fmt.pct(v), ""],
    ["Gross margin, last 4 quarters", (k) => q4(k, "gross_profit") / q4(k, "revenue"), (v) => fmt.pct(v), ""],
    ["Revenue per vehicle delivered, last 4 quarters", (k) => (q4(k, "revenue") * 1e6) / q4(k, "deliveries"), (v) => "$" + fmt.int(Math.round(v / 100) * 100), `same quarters as revenue; includes energy, services, credits and software, not just cars`],
    ["Wikipedia attention, monthly average (last 12 months)", (k) => avg12(pvKey[k]), fmt.intC, "English Wikipedia only"],
  ];
  const badge = (k) => { const c = CO.find((x) => x[0] === k); return `<span class="badge" style="min-width:64px;text-align:center;background:${rgba(c[2](), 0.16)};color:var(--ink)">${c[1]}</span>`; };
  $("vsSub").textContent = `Latest data: deliveries ${evQ(T.at(-1).q)}, quarterly financials ${qEnd("tsl")}, annual financials ${y}. "Leads" means the larger number on that row.`;
  $("vsTable").innerHTML = `<thead><tr><th>Measure</th>${CO.map(([, n, c]) => `<th class="n"><span class="dotk" style="background:${c()}"></span>${n}</th>`).join("")}<th>Leads</th></tr></thead><tbody>` +
    rows.map(([m, val, f, note]) => {
      const v = CO.map(([k]) => val(k)), okv = v.map((x) => (ok(x) ? x : -Infinity)), lead = CO[okv.indexOf(Math.max(...okv))][0];
      return `<tr><td><b>${m}</b>${note ? `<span class="sub2">${note}</span>` : ""}</td>${v.map((x) => `<td class="n">${ok(x) ? f(x) : "n/a"}</td>`).join("")}<td>${badge(lead)}</td></tr>`;
    }).join("") + "</tbody>";

  // plain-language reading of the numbers above
  const tN = fin.tsl.net_income, nm = (k) => q4(k, "net_income") / q4(k, "revenue");
  const firstPos = R.filter((r) => r.revenue > 100).find((r) => r.gross_profit > 0);
  $("vsFacts").innerHTML = [
    `Over the last 4 quarters Tesla delivered <b>${fmt.intC(vol.tsl[0])}</b> vehicles, Rivian <b>${fmt.intC(vol.riv[0])}</b> and Lucid <b>${fmt.intC(vol.luc[0])}</b>: Tesla delivers about ${Math.round(vol.tsl[0] / vol.riv[0])}× as many as Rivian and ${Math.round(vol.tsl[0] / vol.luc[0])}× as many as Lucid. All three sell only battery-electric vehicles.`,
    `Delivery growth vs the prior 4 quarters: Tesla ${pctTxt(vol.tsl[0] / vol.tsl[1] - 1)}, Rivian <b>${pctTxt(vol.riv[0] / vol.riv[1] - 1)}</b> (helped by the R2 launch in mid-2026), Lucid ${pctTxt(vol.luc[0] / vol.luc[1] - 1)}.`,
    `Revenue over the last 4 quarters: Tesla <b>${usdB(q4("tsl", "revenue"))}</b>, Rivian <b>${usdB(q4("riv", "revenue"))}</b>, Lucid <b>${usdB(q4("luc", "revenue"))}</b>. Net margin: Tesla ${fmt.pct(nm("tsl"))}, Rivian ${fmt.pct(nm("riv"))}, Lucid ${fmt.pct(nm("luc"))}.`,
    `Rivian and Lucid have lost money every year. Rivian's gross profit ${firstPos ? `turned positive in ${evQ(firstPos.q)}` : "is still negative"}; Lucid still sells each car below its cost (gross margin ${fmt.pct(q4("luc", "gross_profit") / q4("luc", "revenue"))} over the last 4 quarters). Tesla's net income fell from ${usdB(ix(tN, 2023))} in 2023 to ${usdB(at("tsl", "net_income"))} in ${y}.`,
    `English Wikipedia attention vs the prior 12 months: Tesla ${pctTxt(avg12("tesla") / avgP("tesla") - 1)}, Rivian ${pctTxt(avg12("rivian") / avgP("rivian") - 1)}, Lucid ${pctTxt(avg12("lucid") / avgP("lucid") - 1)}. Attention is not demand, so read it as context.`,
  ].map((t) => `<li>${t}</li>`).join("");

  // money: one measure per chart, one axis each
  const cat = yrs.map(String), m0 = { l: 8, r: 16, t: 28, b: 8 };
  draw("c-vs-rev", CO.map(([k, n, c]) => ({ x: cat, y: fin[k].revenue.map((v) => (v == null ? null : v / 1e3)), type: "bar", name: n, marker: { color: c() }, hovertemplate: `${n} %{x}: $%{y:.1f}B<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.25, bargroupgap: 0.08, margin: m0, xaxis: { type: "category" }, yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f" } }));
  draw("c-vs-net", CO.map(([k, n, c]) => ({ x: cat, y: fin[k].net_income.map((v) => (v == null ? null : v / 1e3)), type: "bar", name: n, marker: { color: c() }, hovertemplate: `${n} %{x}: $%{y:.1f}B<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.25, bargroupgap: 0.08, margin: m0, xaxis: { type: "category" }, yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f", zeroline: true } }));
  const ratio = (k, m) => fin[k][m].map((v, i) => (v == null || !fin[k].revenue[i] || fin[k].revenue[i] < 500 ? null : v / fin[k].revenue[i]));
  draw("c-vs-gm", [
    ...CO.map(([k, n, c]) => ({ x: cat, y: ratio(k, "gross_profit"), mode: "lines+markers", name: `${n} gross`, line: line(c(), 2.6), marker: { size: 7, color: c(), line: { color: css("--surface"), width: 2 } }, hovertemplate: `${n} gross %{x}: %{y:.1%}<extra></extra>` })),
    ...CO.map(([k, n, c]) => ({ x: cat, y: ratio(k, "net_income"), mode: "lines+markers", name: `${n} net`, line: { color: c(), width: 2, dash: "dot" }, marker: { size: 6, color: c(), symbol: "diamond" }, hovertemplate: `${n} net %{x}: %{y:.1%}<extra></extra>` })),
  ], layout({ margin: m0, xaxis: { type: "category" }, yaxis: { tickformat: ".0%", zeroline: true, range: [-1.3, 0.4] } }));
  const off = CO.flatMap(([k, n]) => ["gross_profit", "net_income"].flatMap((m) => ratio(k, m).map((v, i) => (v != null && v < -1.3 ? `${n} ${m === "gross_profit" ? "gross" : "net"} ${yrs[i]} ${fmt.pct(v, 0)}` : null)).filter(Boolean)));
  $("vsGmSub").textContent = `Solid lines are gross profit as a share of revenue; dotted lines are net income as a share of revenue.${off.length ? ` Off the bottom of the chart: ${off.join(", ")}.` : ""} Years with under $0.5B revenue are left out.`;

  // attention: 12-month rolling mean
  const pv = (co) => ({ x: VS.pageviews[co].months.map((m) => m + "-01"), y: rolling(VS.pageviews[co].views, 12).map((v, i) => (i >= 11 ? v : null)) });
  draw("c-vs-pop", CO.map(([k, n, c]) => ({ ...pv(pvKey[k]), mode: "lines", name: n, connectgaps: false, line: line(c(), 2.6), hovertemplate: "%{y:,.0f}" })),
    layout({ margin: m0, hovermode: "x", xaxis: { type: "date" }, yaxis: { tickformat: ".2s" } }));

  // chargers: stations open today, cumulative by opening year (one axis)
  const C = VS.chargers, RC = VS.chargers_rivian || { years: [], stations: [] };
  const allY = [...new Set([...C.years, ...RC.years])].sort(), thisYear = String(allY.at(-1));
  const per = (src) => allY.map((yy) => { const i = src.years.indexOf(yy); return i < 0 ? 0 : src.stations[i]; });
  const cumOf = (a) => a.map((_, i) => sum(a.slice(0, i + 1)));
  const tS = per(C), rS = per(RC);
  $("vsChSub").textContent = `${fmt.int(sum(tS))} public Tesla and ${fmt.int(sum(rS))} public Rivian Adventure Network stations are open in the U.S. today, counted by the year each opened (Lucid has no charging network of its own; its cars use Tesla's Superchargers and third-party networks). ${thisYear} is a partial year. Stations that closed are missing, so older years are understated.`;
  draw("c-vs-ch", [
    { x: allY.map(String), y: cumOf(tS), mode: "lines+markers", name: "Tesla", line: line(TSL(), 2.6), marker: { size: 6 }, fill: "tozeroy", fillcolor: rgba(TSL(), 0.08), customdata: tS, hovertemplate: "Tesla %{x}: %{y:,} open (+%{customdata:,} that year)<extra></extra>" },
    { x: allY.map(String), y: cumOf(rS), mode: "lines+markers", name: "Rivian", line: line(RIVc(), 2.6), marker: { size: 6 }, customdata: rS, hovertemplate: "Rivian %{x}: %{y:,} open (+%{customdata:,} that year)<extra></extra>" },
  ], layout({ margin: m0, xaxis: { type: "category" }, yaxis: { tickformat: ",.0f", rangemode: "tozero" } }));

  $("vsNote").innerHTML = `${esc2(VS.meta.notes.fin)} ${esc2(VS.meta.notes.pageviews)} Sources: <a href="${VS.meta.sources.sec}">SEC EDGAR (Tesla)</a>, <a href="${VS.meta.sources.sec_rivian}">SEC EDGAR (Rivian)</a>, <a href="${VS.meta.sources.sec_lucid}">SEC EDGAR (Lucid)</a>, <a href="${VS.meta.sources.pageviews}">Wikimedia page views</a>, <a href="${VS.meta.sources.chargers}">U.S. station locator</a>, plus the volume sources on the Sales tab.`;
}
