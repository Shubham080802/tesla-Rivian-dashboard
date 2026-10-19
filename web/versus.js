// "Head to head": Tesla vs BYD vs Rivian scoreboard, finances, attention and charging build-out.
// Reads versus.json (scripts/build_versus_data.py) and ev.json (scripts/build_ev_data.py).

const TSL = () => css("--c2"), BYDc = () => css("--c1"), RIVc = () => css("--c4");
const usdB = (m) => (m < 0 ? "−$" : "$") + (Math.abs(m) / 1e3).toFixed(1) + "B";
const CO = [["tsl", "Tesla", TSL], ["byd", "BYD", BYDc], ["riv", "Rivian", RIVc]];

function renderVersus() {
  if (!VS || !EV) return;
  const T = EV.tesla.quarters, B = EV.byd.months, R = EV.rivian.quarters, F_ = VS.fin, yrs = F_.years, last = yrs.length - 1;
  const ix = (a, y) => a[yrs.indexOf(y)];
  const sumK = (a, k) => sum(a.map((r) => r[k]));
  const vol = { tsl: [sumK(T.slice(-4), "deliveries"), sumK(T.slice(-8, -4), "deliveries")], byd: [sumK(B.slice(-12), "total"), sumK(B.slice(-24, -12), "total")], riv: [sumK(R.slice(-4), "deliveries"), sumK(R.slice(-8, -4), "deliveries")] };
  const fin = { tsl: F_.tesla, byd: F_.byd_usd, riv: F_.rivian };
  const y = yrs[last];
  const at = (k, m) => ix(fin[k][m], y), prev = (k, m) => ix(fin[k][m], yrs[last - 1]);
  const avg12 = (co) => mean(VS.pageviews[co].views.slice(-12)), avgP = (co) => mean(VS.pageviews[co].views.slice(-24, -12));
  const pvKey = { tsl: "tesla", byd: "byd", riv: "rivian" };

  // each row: label, value per company, formatter, note
  const rows = [
    ["Vehicles, last 12 months", (k) => vol[k][0], fmt.intC, `Tesla and Rivian deliveries, BYD new-energy vehicles, to ${fmt.month(B.at(-1).m)} / ${evQ(T.at(-1).q)}`],
    ["Volume growth vs prior 12 months", (k) => vol[k][0] / vol[k][1] - 1, pctTxt, ""],
    [`Revenue, ${y}`, (k) => at(k, "revenue"), usdB, "BYD in USD at the year's average rate"],
    [`Revenue growth, ${y}`, (k) => at(k, "revenue") / prev(k, "revenue") - 1, pctTxt, ""],
    [`Net income, ${y}`, (k) => at(k, "net_income"), usdB, "Profit attributable to shareholders; Rivian is loss-making"],
    [`Net margin, ${y}`, (k) => at(k, "net_income") / at(k, "revenue"), (v) => fmt.pct(v), ""],
    [`Gross margin, ${y}`, (k) => at(k, "gross_profit") / at(k, "revenue"), (v) => fmt.pct(v), "BYD includes phone components"],
    ["Wikipedia attention, monthly average (last 12 months)", (k) => avg12(pvKey[k]), fmt.intC, "English Wikipedia only"],
  ];
  const badge = (k) => { const c = CO.find((x) => x[0] === k); return `<span class="badge" style="min-width:64px;text-align:center;background:${rgba(c[2](), 0.16)};color:var(--ink)">${c[1]}</span>`; };
  $("vsSub").textContent = `Latest data: Tesla ${evQ(T.at(-1).q)}, BYD ${fmt.month(B.at(-1).m)}, Rivian ${evQ(R.at(-1).q)}, annual financials ${y}. "Leads" means the largest number on that row.`;
  $("vsTable").innerHTML = `<thead><tr><th>Measure</th>${CO.map(([, n, c]) => `<th class="n"><span class="dotk" style="background:${c()}"></span>${n}</th>`).join("")}<th>Leads</th></tr></thead><tbody>` +
    rows.map(([m, val, f, note]) => {
      const v = CO.map(([k]) => val(k)), okv = v.map((x) => (ok(x) ? x : -Infinity)), lead = CO[okv.indexOf(Math.max(...okv))][0];
      return `<tr><td><b>${m}</b>${note ? `<span class="sub2">${note}</span>` : ""}</td>${v.map((x) => `<td class="n">${ok(x) ? f(x) : "n/a"}</td>`).join("")}<td>${badge(lead)}</td></tr>`;
    }).join("") + "</tbody>";

  // plain-language reading of the numbers above
  const tR = fin.tsl.revenue, bR = fin.byd.revenue, rR = fin.riv.revenue, tN = fin.tsl.net_income, bN = fin.byd.net_income, rN = fin.riv.net_income;
  const crossed = yrs.find((yy, i) => i > 0 && ix(bR, yy) > ix(tR, yy) && ix(bR, yrs[i - 1]) <= ix(tR, yrs[i - 1]));
  const ovs = (r) => r.overseas / r.total, bl = B.at(-1), bp = B.at(-13);
  const nt = at("tsl", "net_income") / at("tsl", "revenue"), nb = at("byd", "net_income") / at("byd", "revenue"), nr = at("riv", "net_income") / at("riv", "revenue");
  $("vsFacts").innerHTML = [
    `Over the last 12 months BYD sold <b>${fmt.intC(vol.byd[0])}</b> vehicles, Tesla delivered <b>${fmt.intC(vol.tsl[0])}</b> and Rivian <b>${fmt.intC(vol.riv[0])}</b>: Tesla delivers about ${Math.round(vol.tsl[0] / vol.riv[0])}× as many cars as Rivian. BYD counts plug-in hybrids; Tesla and Rivian sell only battery-electric cars.`,
    crossed ? `BYD's revenue passed Tesla's in <b>${crossed}</b> and reached ${usdB(at("byd", "revenue"))} in ${y}, against Tesla's ${usdB(at("tsl", "revenue"))} and Rivian's ${usdB(at("riv", "revenue"))}.` : `Tesla's revenue is still ahead of BYD's in ${y}.`,
    `Net margins in ${y}: Tesla <b>${fmt.pct(nt)}</b>, BYD <b>${fmt.pct(nb)}</b>, Rivian <b>${fmt.pct(nr)}</b>. Rivian has lost money every year so far (${usdB(at("riv", "net_income"))} in ${y}, narrower than ${usdB(Math.min(...rN.filter(ok)))} at its worst); Tesla's net income fell from ${usdB(ix(tN, 2023))} in 2023 to ${usdB(at("tsl", "net_income"))}.`,
    `Rivian's volume is <b>${pctTxt(vol.riv[0] / vol.riv[1] - 1)}</b> vs the prior 12 months, helped by the R2 launch in mid-2026; Tesla is ${pctTxt(vol.tsl[0] / vol.tsl[1] - 1)} and BYD ${pctTxt(vol.byd[0] / vol.byd[1] - 1)}.`,
    `BYD is growing outside China: overseas sales were <b>${fmt.pct(ovs(bl), 0)}</b> of its sales in ${fmt.month(bl.m)}, up from ${fmt.pct(ovs(bp), 0)} a year earlier.`,
    `English Wikipedia attention vs the prior 12 months: Tesla ${pctTxt(avg12("tesla") / avgP("tesla") - 1)}, BYD ${pctTxt(avg12("byd") / avgP("byd") - 1)}, Rivian ${pctTxt(avg12("rivian") / avgP("rivian") - 1)}. Attention is not demand, so read it as context.`,
  ].map((t) => `<li>${t}</li>`).join("");

  // money
  const cat = yrs.map(String);
  draw("c-vs-rev", CO.map(([k, n, c]) => ({ x: cat, y: fin[k].revenue.map((v) => (v == null ? null : v / 1e3)), type: "bar", name: n, marker: { color: c() }, hovertemplate: "$%{y:.1f}B" })),
    layout({ barmode: "group", bargap: 0.2, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category" }, yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f" } }));
  draw("c-vs-net", [
    ...CO.map(([k, n, c]) => ({ x: cat, y: fin[k].net_income.map((v) => (v == null ? null : v / 1e3)), type: "bar", name: `${n} net income`, marker: { color: rgba(c(), 0.75) }, hovertemplate: "$%{y:.1f}B" })),
    ...CO.map(([k, n, c]) => ({ x: cat, y: fin[k].net_income.map((v, i) => (v == null || !fin[k].revenue[i] ? null : v / fin[k].revenue[i])), mode: "lines+markers", name: `${n} margin (right)`, yaxis: "y2", line: { color: c(), width: 2.2 }, marker: { size: 5 }, hovertemplate: "%{y:.1%}" })),
  ], layout({ barmode: "group", bargap: 0.2, margin: { l: 8, r: 40, t: 52, b: 8 }, legend: { y: 1.32 }, xaxis: { type: "category" }, yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f" }, yaxis2: { overlaying: "y", side: "right", tickformat: ".0%", showgrid: false, zeroline: true, range: [-1.2, 0.3] } }));
  draw("c-vs-gm", CO.map(([k, n, c]) => ({ x: cat, y: fin[k].gross_profit.map((v, i) => (v == null || !fin[k].revenue[i] || fin[k].revenue[i] < 500 ? null : v / fin[k].revenue[i])), mode: "lines+markers", name: n, line: { color: c(), width: 2.6 }, marker: { size: 6 }, hovertemplate: "%{y:.1%}" })),
    layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category" }, yaxis: { tickformat: ".0%" } }));

  // attention: 12-month rolling mean
  const pv = (co) => ({ x: VS.pageviews[co].months.map((m) => m + "-01"), y: rolling(VS.pageviews[co].views, 12).map((v, i) => (i >= 11 ? v : null)) });
  draw("c-vs-pop", CO.map(([k, n, c]) => ({ ...pv(pvKey[k]), mode: "lines", name: n, connectgaps: false, line: line(c(), 2.6), hovertemplate: "%{y:,.0f}" })),
    layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, hovermode: "x", xaxis: { type: "date" }, yaxis: { tickformat: ".2s" } }));

  // chargers: Tesla and Rivian (BYD has no U.S. network)
  const C = VS.chargers, RC = VS.chargers_rivian || { years: [], stations: [] };
  const allY = [...new Set([...C.years, ...RC.years])].sort(), thisYear = String(allY.at(-1));
  const per = (src) => allY.map((yy) => { const i = src.years.indexOf(yy); return i < 0 ? 0 : src.stations[i]; });
  const cumOf = (a) => a.map((_, i) => sum(a.slice(0, i + 1)));
  const tS = per(C), rS = per(RC);
  $("vsChSub").textContent = `${fmt.int(sum(tS))} public Tesla and ${fmt.int(sum(rS))} public Rivian Adventure Network charging stations are open in the U.S. today. ${thisYear} is a partial year. Stations that closed are missing, so older years are understated.`;
  draw("c-vs-ch", [
    { x: allY.map(String), y: tS, type: "bar", name: "Tesla stations opened", marker: { color: rgba(TSL(), 0.8) }, hovertemplate: "%{y}" },
    { x: allY.map(String), y: rS, type: "bar", name: "Rivian stations opened", marker: { color: rgba(RIVc(), 0.85) }, hovertemplate: "%{y}" },
    { x: allY.map(String), y: cumOf(tS), mode: "lines+markers", name: "Tesla cumulative (right)", yaxis: "y2", line: { color: TSL(), width: 2.2 }, marker: { size: 4 }, hovertemplate: "%{y:,}" },
    { x: allY.map(String), y: cumOf(rS), mode: "lines+markers", name: "Rivian cumulative (right)", yaxis: "y2", line: { color: RIVc(), width: 2.2 }, marker: { size: 4 }, hovertemplate: "%{y:,}" },
  ], layout({ barmode: "group", bargap: 0.25, margin: { l: 8, r: 40, t: 40, b: 8 }, legend: { y: 1.25 }, xaxis: { type: "category" }, yaxis: { tickformat: ".0f" }, yaxis2: { overlaying: "y", side: "right", showgrid: false, zeroline: false, tickformat: ",.0f" } }));

  $("vsNote").innerHTML = `${esc2(VS.meta.notes.fin)} ${esc2(VS.meta.notes.pageviews)} Sources: <a href="${EV.meta.tesla_sources.sec}">SEC EDGAR (Tesla)</a>, <a href="${EV.rivian.sources.sec}">SEC EDGAR (Rivian)</a> and <a href="${VS.meta.sources.byd_reports}">BYD annual reports (HKEXnews)</a>, <a href="${VS.meta.sources.fx}">FRED exchange rate</a>, <a href="${VS.meta.sources.pageviews}">Wikimedia page views</a>, <a href="${VS.meta.sources.chargers}">U.S. station locator</a>, plus the volume sources on the Sales &amp; forecast tab.`;
}
