// "Head to head": Tesla vs BYD scoreboard, finances, attention and Tesla's charging build-out.
// Reads versus.json (scripts/build_versus_data.py) and ev.json (scripts/build_ev_data.py).


const TSL = () => css("--c2"), BYDc = () => css("--c1");
const usdB = (m) => "$" + (m / 1e3).toFixed(1) + "B";

function renderVersus() {
  if (!VS || !EV) return;
  const T = EV.tesla.quarters, B = EV.byd.months, F_ = VS.fin, yrs = F_.years, last = yrs.length - 1;
  const ix = (a, y) => a[yrs.indexOf(y)];
  const sumK = (a, k) => sum(a.map((r) => r[k]));
  const t12 = sumK(T.slice(-4), "deliveries"), t12p = sumK(T.slice(-8, -4), "deliveries");
  const b12 = sumK(B.slice(-12), "total"), b12p = sumK(B.slice(-24, -12), "total");
  const tR = F_.tesla.revenue, bR = F_.byd_usd.revenue, tN = F_.tesla.net_income, bN = F_.byd_usd.net_income, tG = F_.tesla.gross_profit, bG = F_.byd_usd.gross_profit;
  const y = yrs[last], g = (a) => a[last] / a[last - 1] - 1;
  const avg12 = (co) => mean(VS.pageviews[co].views.slice(-12)), avgP = (co) => mean(VS.pageviews[co].views.slice(-24, -12));

  const rows = [
    ["Vehicles, last 12 months", fmt.intC(t12), fmt.intC(b12), b12 > t12 ? "byd" : "tsl", "Tesla deliveries vs BYD new-energy vehicles, to " + fmt.month(B.at(-1).m)],
    ["Volume growth vs prior 12 months", pctTxt(t12 / t12p - 1), pctTxt(b12 / b12p - 1), t12 / t12p > b12 / b12p ? "tsl" : "byd", ""],
    [`Revenue, ${y}`, usdB(ix(tR, y)), usdB(ix(bR, y)), ix(bR, y) > ix(tR, y) ? "byd" : "tsl", "BYD in USD at the year's average rate"],
    [`Revenue growth, ${y}`, pctTxt(g(tR)), pctTxt(g(bR)), g(tR) > g(bR) ? "tsl" : "byd", ""],
    [`Net income, ${y}`, usdB(ix(tN, y)), usdB(ix(bN, y)), ix(bN, y) > ix(tN, y) ? "byd" : "tsl", "Profit attributable to shareholders"],
    [`Net margin, ${y}`, fmt.pct(ix(tN, y) / ix(tR, y)), fmt.pct(ix(bN, y) / ix(bR, y)), ix(tN, y) / ix(tR, y) > ix(bN, y) / ix(bR, y) ? "tsl" : "byd", ""],
    [`Gross margin, ${y}`, fmt.pct(ix(tG, y) / ix(tR, y)), fmt.pct(ix(bG, y) / ix(bR, y)), ix(tG, y) / ix(tR, y) > ix(bG, y) / ix(bR, y) ? "tsl" : "byd", "BYD includes phone components"],
    ["Wikipedia attention, monthly average (last 12 months)", fmt.intC(avg12("tesla")), fmt.intC(avg12("byd")), avg12("tesla") > avg12("byd") ? "tsl" : "byd", "English Wikipedia only"],
  ];
  const badge = (k) => `<span class="badge ${k === "tsl" ? "bad" : "good"}" style="min-width:64px;text-align:center">${k === "tsl" ? "Tesla" : "BYD"}</span>`;
  $("vsSub").textContent = `Latest data: Tesla ${evQ(T.at(-1).q)}, BYD ${fmt.month(B.at(-1).m)}, annual financials ${y}. "Leads" means the larger number on that row.`;
  $("vsTable").innerHTML = `<thead><tr><th>Measure</th><th class="n"><span class="dotk" style="background:${TSL()}"></span>Tesla</th><th class="n"><span class="dotk" style="background:${BYDc()}"></span>BYD</th><th>Leads</th></tr></thead><tbody>` +
    rows.map(([m, a, b, k, note]) => `<tr><td><b>${m}</b>${note ? `<span class="sub2">${note}</span>` : ""}</td><td class="n">${a}</td><td class="n">${b}</td><td>${badge(k)}</td></tr>`).join("") + "</tbody>";

  // plain-language reading of the numbers above
  const crossed = yrs.find((yy, i) => i > 0 && ix(bR, yy) > ix(tR, yy) && ix(bR, yrs[i - 1]) <= ix(tR, yrs[i - 1]));
  const ovs = bl => bl.overseas / bl.total, bl = B.at(-1), bp = B.at(-13);
  $("vsFacts").innerHTML = [
    `BYD sold <b>${(b12 / t12).toFixed(1)}×</b> as many vehicles as Tesla over the last 12 months (${fmt.intC(b12)} vs ${fmt.intC(t12)}), but BYD counts plug-in hybrids and Tesla only battery-electric cars.`,
    crossed ? `BYD's revenue passed Tesla's in <b>${crossed}</b> and reached ${usdB(ix(bR, y))} in ${y}, against Tesla's ${usdB(ix(tR, y))}.` : `Tesla's revenue is still ahead of BYD's in ${y}.`,
    (() => {
      const nt = ix(tN, y) / ix(tR, y), nb = ix(bN, y) / ix(bR, y), hi = nt >= nb ? ["Tesla", nt, "BYD", nb] : ["BYD", nb, "Tesla", nt];
      return `${Math.abs(nt - nb) < 0.005 ? "Net margins are about level" : `${hi[0]} keeps more of each sales dollar`}: <b>${fmt.pct(nt)}</b> at Tesla vs <b>${fmt.pct(nb)}</b> at BYD in ${y}. Tesla's net income has fallen from ${usdB(ix(tN, 2023))} in 2023 to ${usdB(ix(tN, y))}; BYD's is ${usdB(ix(bN, y))} after peaking at ${usdB(Math.max(...bN))}.`;
    })(),
    `BYD is growing outside China: overseas sales were <b>${fmt.pct(ovs(bl), 0)}</b> of its sales in ${fmt.month(bl.m)}, up from ${fmt.pct(ovs(bp), 0)} a year earlier.`,
    `Both are being watched less on English Wikipedia than before (Tesla ${pctTxt(avg12("tesla") / avgP("tesla") - 1)}, BYD ${pctTxt(avg12("byd") / avgP("byd") - 1)} vs the prior 12 months). Attention is not demand, so read it as context.`,
  ].map((t) => `<li>${t}</li>`).join("");

  // money
  const cat = yrs.map(String);
  draw("c-vs-rev", [
    { x: cat, y: tR.map((v) => v / 1e3), type: "bar", name: "Tesla", marker: { color: TSL() }, hovertemplate: "$%{y:.1f}B" },
    { x: cat, y: bR.map((v) => v / 1e3), type: "bar", name: "BYD", marker: { color: BYDc() }, hovertemplate: "$%{y:.1f}B" },
  ], layout({ barmode: "group", bargap: 0.25, margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category" }, yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f" } }));
  draw("c-vs-net", [
    { x: cat, y: tN.map((v) => v / 1e3), type: "bar", name: "Tesla net income", marker: { color: rgba(TSL(), 0.75) }, hovertemplate: "$%{y:.1f}B" },
    { x: cat, y: bN.map((v) => v / 1e3), type: "bar", name: "BYD net income", marker: { color: rgba(BYDc(), 0.75) }, hovertemplate: "$%{y:.1f}B" },
    { x: cat, y: tN.map((v, i) => v / tR[i]), mode: "lines+markers", name: "Tesla margin (right)", yaxis: "y2", line: { color: TSL(), width: 2.4 }, marker: { size: 6 }, hovertemplate: "%{y:.1%}" },
    { x: cat, y: bN.map((v, i) => v / bR[i]), mode: "lines+markers", name: "BYD margin (right)", yaxis: "y2", line: { color: BYDc(), width: 2.4 }, marker: { size: 6 }, hovertemplate: "%{y:.1%}" },
  ], layout({ barmode: "group", bargap: 0.25, margin: { l: 8, r: 40, t: 40, b: 8 }, legend: { y: 1.25 }, xaxis: { type: "category" }, yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f" }, yaxis2: { overlaying: "y", side: "right", tickformat: ".0%", showgrid: false, zeroline: false } }));
  draw("c-vs-gm", [
    { x: cat, y: tG.map((v, i) => v / tR[i]), mode: "lines+markers", name: "Tesla", line: { color: TSL(), width: 2.6 }, marker: { size: 6 }, hovertemplate: "%{y:.1%}" },
    { x: cat, y: bG.map((v, i) => v / bR[i]), mode: "lines+markers", name: "BYD", line: { color: BYDc(), width: 2.6 }, marker: { size: 6 }, hovertemplate: "%{y:.1%}" },
  ], layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category" }, yaxis: { tickformat: ".0%" } }));

  // attention: 12-month rolling mean
  const pv = (co) => ({ x: VS.pageviews[co].months.map((m) => m + "-01"), y: rolling(VS.pageviews[co].views, 12).map((v, i) => (i >= 11 ? v : null)) });
  draw("c-vs-pop", [
    { ...pv("tesla"), mode: "lines", name: "Tesla", connectgaps: false, line: line(TSL(), 2.6), hovertemplate: "%{y:,.0f}" },
    { ...pv("byd"), mode: "lines", name: "BYD", connectgaps: false, line: line(BYDc(), 2.6), hovertemplate: "%{y:,.0f}" },
  ], layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, hovermode: "x", xaxis: { type: "date" }, yaxis: { tickformat: ".2s" } }));

  // chargers
  const C = VS.chargers, cum = C.stations.map((_, i) => sum(C.stations.slice(0, i + 1)));
  const cy = C.years.map(String), thisYear = String(C.years.at(-1));
  $("vsChSub").textContent = `${fmt.int(cum.at(-1))} public Tesla charging stations are open in the U.S. today. ${thisYear} is a partial year. Stations that closed are missing, so older years are understated.`;
  draw("c-vs-ch", [
    { x: cy, y: C.stations, type: "bar", name: "Stations opened", marker: { color: C.years.map((yy) => (String(yy) === thisYear ? rgba(TSL(), 0.45) : rgba(TSL(), 0.8))), cornerradius: 3 }, hovertemplate: "%{y}" },
    { x: cy, y: cum, mode: "lines+markers", name: "Cumulative (right)", yaxis: "y2", line: { color: css("--c3"), width: 2.4 }, marker: { size: 5 }, hovertemplate: "%{y:,}" },
  ], layout({ bargap: 0.3, margin: { l: 8, r: 40, t: 28, b: 8 }, xaxis: { type: "category" }, yaxis: { tickformat: ".0f" }, yaxis2: { overlaying: "y", side: "right", showgrid: false, zeroline: false, tickformat: ",.0f" } }));

  $("vsNote").innerHTML = `${esc2(VS.meta.notes.fin)} ${esc2(VS.meta.notes.pageviews)} Sources: <a href="${EV.meta.tesla_sources.sec}">SEC EDGAR</a> and <a href="${VS.meta.sources.byd_reports}">BYD annual reports (HKEXnews)</a>, <a href="${VS.meta.sources.fx}">FRED exchange rate</a>, <a href="${VS.meta.sources.pageviews}">Wikimedia page views</a>, <a href="${VS.meta.sources.chargers}">U.S. station locator</a>, plus the volume sources on the Sales &amp; forecast tab. The Amazon Appliances analysis is kept under "Amazon archive".`;
}
