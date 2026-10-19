// Research tabs: brief, market share, who buys, customer view, sentiment and investor view (research.json, scripts/build_research.py).
let RS = null;
function prepResearch(d) { RS = d; }
const cT = () => css("--c2"), cR = () => css("--c1"), cO = () => css("--muted");
const BR = [["tesla", "Tesla", cT], ["rivian", "Rivian", cR]];
const M0 = { l: 8, r: 16, t: 28, b: 8 };
const usd = (m) => (m < 0 ? "−$" : "$") + (Math.abs(m) >= 1e3 ? (Math.abs(m) / 1e3).toFixed(1) + "B" : Math.abs(m).toFixed(0) + "M");
const usdK = (v) => (v < 0 ? "−$" : "$") + Math.round(Math.abs(v) / 100) / 10 + "K";
const pp = (v) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1) + " pts";
const qTicks = (qs) => ({ type: "category", tickmode: "array", tickvals: qs.filter((q) => q.endsWith("-01")).map(evQ), ticktext: qs.filter((q) => q.endsWith("-01")).map((q) => q.slice(0, 4)), tickangle: 0 });
const nn = (a) => a.map((v) => (v == null ? null : v));
const ttmOf = (a, i) => (i >= 3 && a.slice(i - 3, i + 1).every((v) => v != null) ? sum(a.slice(i - 3, i + 1)) : null);
const linkTab = (t, label) => `<button type="button" class="linkbtn" data-go-tab="${t}">${label} →</button>`;

// ---------------------------------------------------------------- shared numbers used by several tabs
function researchFacts() {
  const M = RS.market, n = M.quarters.length - 1, y = n - 4;
  const share = (k, i) => M[k][i] / M.total_ev[i];
  const I = RS.investors, C = RS.customers, S = RS.sentiment, O = RS.owners;
  const avgL = (a, k0, k1) => mean(a.slice(k0, k1).filter(ok));
  const tone = (co) => (S[co] ? { last: avgL(S[co].tone, -12), prev: avgL(S[co].tone, -24, -12) } : null);
  const rate = (mk, my) => { const r = C.complaint_rates.filter((x) => x.make === mk && x.model_year === my); return r.length ? sum(r.map((x) => x.complaints)) / sum(r.map((x) => x.sold)) * 1e4 : null; };
  const best = (mk) => C.epa.filter((e) => e.make === mk).sort((a, b) => b.range_max - a.range_max)[0];
  return { M, n, y, share, I, C, S, O, tone, rate, best, q: evQ(M.quarters[n]), qy: evQ(M.quarters[y]) };
}

// ---------------------------------------------------------------- research brief
function renderOverview() {
  if (!RS || !EV) return;
  const F = researchFacts(), { M, n, y, I, C, O } = F, t = I.tesla, r = I.rivian;
  const ts = F.share("tesla", n), rs = F.share("rivian", n), tsy = F.share("tesla", y), rsy = F.share("rivian", y);
  const nm = (x) => x.ttm.net_income / x.ttm.revenue;
  const tt = F.tone("tesla"), rt = F.tone("rivian"), r24 = F.rate("rivian", 2024), t24 = F.rate("tesla", 2024);
  const wa = O.wa.profile;
  $("ovSub").textContent = `Built ${RS.meta.built} from SEC filings, Cox Automotive, NHTSA, EPA, GDELT, Wikipedia, U.S. Census and state registration records. Latest quarter: ${F.q}.`;
  $("ovLede").innerHTML = `Tesla is the incumbent: it sold <b>${fmt.pct(ts, 0)}</b> of all new electric vehicles in the U.S. in ${F.q} and earned <b>${usd(t.ttm.net_income)}</b> over the last four reported quarters. Rivian is the challenger: <b>${fmt.pct(rs, 1)}</b> of U.S. EV sales, a share that ${rs > rsy ? "is rising" : "is not rising"} (${fmt.pct(rsy, 1)} a year earlier), but still losing <b>${usd(-r.ttm.net_income)}</b> a year with about <b>${r.runway_quarters ?? "n/a"}</b> quarters of cash at the current burn. The rest of this brief sets out what that means for an investor and for a buyer, with the evidence behind each point.`;
  $("ovTiles").innerHTML = [
    tile({ label: `Tesla share of U.S. EV sales, ${F.q}`, value: fmt.pct(ts, 1), delta: deltaChip(ts - tsy, pp), sub: `vs ${F.qy}` }),
    tile({ label: `Rivian share of U.S. EV sales, ${F.q}`, value: fmt.pct(rs, 1), delta: deltaChip(rs - rsy, pp), sub: `vs ${F.qy}` }),
    tile({ label: "Net margin, last 4 quarters", value: `${fmt.pct(nm(t), 1)} / ${fmt.pct(nm(r), 0)}`, sub: "Tesla / Rivian" }),
    tile({ label: "Median income where cars are registered (WA)", value: `${usdK(wa.tesla.income_median)} / ${usdK(wa.rivian.income_median)}`, sub: `Tesla / Rivian; state ${usdK(wa.population.income_median)}` }),
  ].join("");
  const inv = [
    `<b>Scale.</b> Over the last four quarters Tesla booked ${usd(t.ttm.revenue)} of revenue to Rivian's ${usd(r.ttm.revenue)}, about ${Math.round(t.ttm.revenue / r.ttm.revenue)}×. Tesla's net margin is ${fmt.pct(nm(t))}; Rivian's is ${fmt.pct(nm(r))}.`,
    `<b>Unit economics.</b> Tesla made ${usdK(t.gp_per_vehicle)} of gross profit per vehicle delivered; Rivian ${usdK(r.gp_per_vehicle)}. At that level Rivian would need about <b>${r.breakeven_deliveries ? fmt.intC(r.breakeven_deliveries) : "n/a"}</b> deliveries a year to cover its operating costs, vs ${fmt.intC(r.ttm.deliveries)} in the last four quarters.`,
    `<b>Cash.</b> Rivian held ${usd(r.liquidity.at(-1))} in cash and short-term investments at ${evQ(r.latest)} and burned ${usd(-r.ttm.fcf)} of free cash flow in four quarters${r.runway_quarters ? `, about ${r.runway_quarters} quarters of runway before new funding` : ""}. Tesla generated ${usd(t.ttm.fcf)}.`,
    `<b>Dilution.</b> Shares outstanding grew ${r.share_growth_3y != null ? pctTxt(r.share_growth_3y) : "n/a"} at Rivian and ${t.share_growth_3y != null ? pctTxt(t.share_growth_3y) : "n/a"} at Tesla over three years.`,
    `<b>Valuation.</b> On the 10-K cover-page public float, Tesla was valued at about ${t.float_to_sales ?? "n/a"}× trailing sales and Rivian at ${r.float_to_sales ?? "n/a"}×: the market prices Tesla on more than cars. ${linkTab("investors", "Investor view")}`,
  ];
  const tb = F.best("tesla"), rb = F.best("rivian");
  const cus = [
    `<b>Range.</b> The longest-range Tesla (${tb ? `${tb.model}, ${tb.range_max} miles` : "n/a"}) vs the longest-range Rivian (${rb ? `${rb.model}, ${rb.range_max} miles` : "n/a"}), EPA. Tesla's sedans are the most efficient; Rivian builds larger trucks and SUVs.`,
    `<b>Safety ratings.</b> ${C.ncap.filter((x) => x.overall === 5).map((x) => `${x.model} (${x.model_year})`).join(", ") || "No"} hold NHTSA's top five-star overall rating.`,
    `<b>Quality signal.</b> Owners filed ${t24 != null ? t24.toFixed(1) : "n/a"} NHTSA complaints per 10,000 model-year-2024 Teslas sold and ${r24 != null ? r24.toFixed(1) : "n/a"} per 10,000 Rivians. ${fmt.pct(C.recall_ota_share.tesla ?? 0, 0)} of Tesla's and ${fmt.pct(C.recall_ota_share.rivian ?? 0, 0)} of Rivian's recall campaigns were fixable over the air.`,
    `<b>Charging.</b> Tesla's Supercharger network is far larger in the U.S.; Rivian's own network is small, though Rivian drivers can now use Superchargers. ${linkTab("versus", "Charging chart")}`,
    tt && rt ? `<b>Mood.</b> News tone over the last 12 months averaged ${tt.last.toFixed(2)} for Tesla (${tt.last > tt.prev ? "warmer" : "cooler"} than the year before) and ${rt.last.toFixed(2)} for Rivian (${rt.last > rt.prev ? "warmer" : "cooler"}). ${linkTab("sentiment", "Sentiment")}` : `<b>Mood.</b> Owner complaints and attention are on the Sentiment tab. ${linkTab("sentiment", "Sentiment")}`,
  ];
  $("ovInv").innerHTML = inv.map((x) => `<li>${x}</li>`).join("");
  $("ovCus").innerHTML = cus.map((x) => `<li>${x}</li>`).join("");
  const rm = Object.keys(M.models).filter((k) => k.startsWith("Rivian")).map((k) => [k, (M.models[k][n] || 0) - (M.models[k][y] || 0)]).sort((a, b) => b[1] - a[1]);
  const riv = rm.length ? `Rivian's biggest gain was ${rm[0][0].replace("Rivian ", "")} (${rm[0][1] >= 0 ? "+" : "−"}${fmt.int(Math.abs(rm[0][1]))} units)${rm[1] && rm[1][1] > 0 ? `, then ${rm[1][0].replace("Rivian ", "")} (+${fmt.int(rm[1][1])})` : ""}.` : "";
  const rq = [
    ["How do they share the U.S. EV market?", `Tesla ${fmt.pct(ts, 0)}, Rivian ${fmt.pct(rs, 1)}, everyone else ${fmt.pct(1 - ts - rs, 0)} in ${F.q}. The whole market was ${pctTxt(M.total_ev[n] / M.total_ev[y] - 1)} on a year earlier while Tesla was ${pctTxt(M.tesla[n] / M.tesla[y] - 1)} and Rivian ${pctTxt(M.rivian[n] / M.rivian[y] - 1)}, so both gained share. ${riv}`, "market", "Market share"],
    ["What is the profit and loss scale?", `Tesla: ${usd(t.ttm.revenue)} revenue, ${usd(t.ttm.net_income)} net income. Rivian: ${usd(r.ttm.revenue)} revenue, ${usd(r.ttm.net_income)} net income (last four quarters).`, "investors", "Investor view"],
    ["Who buys them?", `In Washington the median household income of the tracts where Rivians are registered is ${usdK(O.wa.profile.rivian.income_median)}, Teslas ${usdK(O.wa.profile.tesla.income_median)}, the state ${usdK(O.wa.profile.population.income_median)}. ${fmt.pct(O.wa.top10pct_income_share.rivian, 0)} of Rivians sit in the richest tenth of tracts.`, "buyers", "Who buys"],
    ["How do people feel about them?", tt && rt ? `News tone: Tesla ${tt.last.toFixed(2)}, Rivian ${rt.last.toFixed(2)} (GDELT, last 12 months; 0 is neutral). Owner complaints and Wikipedia attention give the other two signals.` : "Owner complaints and Wikipedia attention; news tone appears once GDELT data is loaded.", "sentiment", "Sentiment"],
    ["Is the product good for a buyer?", `Five-star crash ratings where tested, ${C.recall_campaigns.tesla ?? 0} Tesla and ${C.recall_campaigns.rivian ?? 0} Rivian recall campaigns since 2019 (${fmt.pct(C.recall_ota_share.tesla ?? 0, 0)} and ${fmt.pct(C.recall_ota_share.rivian ?? 0, 0)} fixable over the air), EPA range up to ${tb?.range_max ?? "n/a"} and ${rb?.range_max ?? "n/a"} miles.`, "customers", "Customer view"],
    ["What comes next?", "Backtested forecasts of deliveries and revenue with 80% ranges, and a scorecard of where each series is heading.", "lab", "Forecast lab"],
  ];
  $("ovRQ").innerHTML = `<thead><tr><th>Question</th><th>Finding</th><th></th></tr></thead><tbody>` + rq.map(([qq, a, tab, l]) => `<tr><td><b>${qq}</b></td><td>${a}</td><td>${linkTab(tab, l)}</td></tr>`).join("") + "</tbody>";
  $("ovMethod").innerHTML = [
    "Financials come from SEC company facts (10-Q and 10-K XBRL). Missing quarters are filled only by accounting identities, never estimated.",
    "U.S. market share uses Cox Automotive / Kelley Blue Book quarterly sales estimates, with each quarter taken from the newest report that covers it; the EV share of the whole market divides by BEA light-vehicle sales (FRED LTOTALNSA).",
    "Buyer profiles join every registered Tesla and Rivian in Washington (by census tract) and New York (by ZIP) to the Census Bureau's ACS 5-year estimates and weight each area by its vehicles.",
    "Complaint rates divide NHTSA owner complaints for a model year by Cox's U.S. sales of that model in the same calendar year.",
    "News tone is GDELT's average tone of English-language online articles mentioning each company, averaged by month.",
    "Forecasts are exponential-smoothing models chosen and calibrated by rolling-origin backtests.",
  ].map((x) => `<li>${x}</li>`).join("");
  $("ovLimits").innerHTML = [
    "Area statistics describe neighbourhoods, not owners (the ecological fallacy). Two states are not the U.S.",
    "Cox figures are modelled estimates and differ slightly from company-reported deliveries.",
    "NHTSA complaints are unverified reports from owners and scale with fleet size, publicity and model age.",
    "GDELT tone measures the wording of coverage, not consumer opinion; Wikipedia views measure attention, not demand.",
    "Rivian has a short history (public since November 2021), so its trends and forecasts carry wide uncertainty.",
    "Only U.S.-listed companies are compared. Nothing here is investment advice.",
  ].map((x) => `<li>${x}</li>`).join("");
  const S = RS.meta.sources;
  $("ovCite").innerHTML = [
    `U.S. Securities and Exchange Commission, EDGAR company facts API, Tesla, Inc. (CIK 1318605) and Rivian Automotive, Inc. (CIK 1874178). <a href="${S.sec}">sec.gov</a>`,
    `Cox Automotive / Kelley Blue Book, Electric Vehicle Sales Report, quarterly, Q1 2025 to ${F.q}. ${S.cox.map((u, i) => `<a href="${u}">[${i + 1}]</a>`).join(" ")}`,
    `U.S. Bureau of Economic Analysis, Light Weight Vehicle Sales (LTOTALNSA), via FRED. <a href="${S.fred}">fred.stlouisfed.org</a>`,
    `National Highway Traffic Safety Administration, recalls, complaints and NCAP ratings APIs. <a href="${S.nhtsa}">nhtsa.gov</a>`,
    `U.S. EPA and DOE, fueleconomy.gov vehicle data. <a href="${S.epa}">fueleconomy.gov</a>`,
    `The GDELT Project, DOC 2.0 API (timelinetone, timelinevolraw). <a href="${S.gdelt}">gdeltproject.org</a>`,
    `Washington State Department of Licensing, Electric Vehicle Population Data. <a href="${S.wa}">data.wa.gov</a>`,
    `New York State DMV, Vehicle, Snowmobile, and Boat Registrations. <a href="${S.ny}">data.ny.gov</a>`,
    `U.S. Census Bureau, ${esc2(O.acs_release)}, tables B19013, B01003, B01002, B15003, B25003, via <a href="${S.acs}">Census Reporter</a>.`,
    `Wikimedia Foundation page views; U.S. DOE Alternative Fuels Data Center station locator; CPCA via CnEVPost; ACEA press releases (see Head to head and Market share tabs).`,
  ].map((x) => `<li>${x}</li>`).join("");
}

// ---------------------------------------------------------------- market share
function renderMarket() {
  if (!RS) return;
  const F = researchFacts(), { M, n, y } = F, q = M.quarters, ql = q.map(evQ);
  const sh = (k) => M[k].map((v, i) => (v != null && M.total_ev[i] ? v / M.total_ev[i] : null));
  const evs = M.total_ev.map((v, i) => (M.all_vehicles[i] ? v / M.all_vehicles[i] : null));
  const lastEv = evs.map((v, i) => [v, i]).filter(([v]) => v != null).at(-1);
  $("mkTiles").innerHTML = [
    tile({ label: `Tesla share of U.S. EV sales, ${F.q}`, value: fmt.pct(sh("tesla")[n], 1), delta: deltaChip(sh("tesla")[n] - sh("tesla")[y], pp), sub: `vs ${F.qy}` }),
    tile({ label: `Rivian share of U.S. EV sales, ${F.q}`, value: fmt.pct(sh("rivian")[n], 1), delta: deltaChip(sh("rivian")[n] - sh("rivian")[y], pp), sub: `vs ${F.qy}` }),
    tile({ label: `U.S. EV sales, ${F.q}`, value: fmt.intC(M.total_ev[n]), delta: deltaChip(M.total_ev[n] / M.total_ev[y] - 1, pctTxt), sub: `all brands, vs ${F.qy}` }),
    tile({ label: lastEv ? `EV share of new vehicles, ${evQ(q[lastEv[1]])}` : "EV share of new vehicles", value: lastEv ? fmt.pct(lastEv[0], 1) : "n/a", sub: "battery-electric, of all light vehicles" }),
  ].join("");
  draw("c-mk-share", BR.map(([k, nme, c]) => ({ x: ql, y: sh(k), mode: "lines+markers+text", name: nme, line: line(c(), 2.6), marker: { size: 7 }, text: sh(k).map((v, i) => (i === n ? fmt.pct(v, 1) : "")), textposition: "top center", textfont: { color: css("--ink2") }, hovertemplate: `${nme}: %{y:.1%}<extra></extra>` })),
    layout({ margin: M0, xaxis: qTicks(q), yaxis: { tickformat: ".0%", rangemode: "tozero" } }));
  const other = M.total_ev.map((v, i) => v - M.tesla[i] - M.rivian[i]);
  draw("c-mk-stack", [
    { x: ql, y: M.tesla, type: "bar", name: "Tesla", marker: { color: cT() }, hovertemplate: "Tesla: %{y:,}<extra></extra>" },
    { x: ql, y: M.rivian, type: "bar", name: "Rivian", marker: { color: cR() }, hovertemplate: "Rivian: %{y:,}<extra></extra>" },
    { x: ql, y: other, type: "bar", name: "All other brands", marker: { color: rgba(cO(), 0.45) }, hovertemplate: "Others: %{y:,}<extra></extra>" },
  ], layout({ barmode: "stack", bargap: 0.3, margin: M0, xaxis: qTicks(q), yaxis: { tickformat: ".2s" } }));
  $("mkShareSub").textContent = `Each company's share of all new battery-electric vehicles sold in the U.S., ${ql[0]} to ${F.q}.`;
  draw("c-mk-ev", [{ x: ql, y: evs, mode: "lines+markers", name: "EV share", line: line(css("--c3"), 2.6), marker: { size: 7 }, hovertemplate: "%{y:.1%}<extra></extra>" }],
    layout({ margin: M0, showlegend: false, xaxis: qTicks(q), yaxis: { tickformat: ".0%", rangemode: "tozero" } }));
  $("mkEvSub").textContent = "Cox's EV sales divided by all new cars and light trucks sold (BEA, via FRED). Quarters without three months of BEA data are left out.";
  const mods = Object.entries(M.models).map(([k, v]) => [k, v[n]]).filter(([, v]) => v).sort((a, b) => a[1] - b[1]);
  draw("c-mk-mix", [{ y: mods.map(([k]) => k), x: mods.map(([, v]) => v), type: "bar", orientation: "h", marker: { color: mods.map(([k]) => (k.startsWith("Tesla") ? cT() : cR())) }, text: mods.map(([, v]) => fmt.int(v)), textposition: "outside", cliponaxis: false, hovertemplate: "%{y}: %{x:,}<extra></extra>" }],
    layout({ margin: { l: 8, r: 40, t: 8, b: 8 }, showlegend: false, hovermode: "closest", bargap: 0.3, xaxis: { showgrid: true, showline: false, tickformat: ".2s" }, yaxis: { automargin: true } }));
  $("mkMixSub").textContent = `U.S. sales by model in ${F.q} (Cox estimates).`;
  const keys = Object.keys(M.models), tk = keys.filter((k) => k.startsWith("Tesla")), rk = keys.filter((k) => k.startsWith("Rivian"));
  const shade = (list, c) => list.map((k, i) => ({ x: ql, y: nn(M.models[k]), mode: "lines+markers", name: k, connectgaps: false, line: { color: rgba(c(), 1 - i * (0.6 / Math.max(1, list.length - 1))), width: 2.2, dash: ["solid", "dot", "dash", "dashdot", "longdash"][i % 5] }, marker: { size: 6 }, hovertemplate: `${k}: %{y:,}<extra></extra>` }));
  draw("c-mk-models", [...shade(tk, cT), ...shade(rk, cR)], layout({ margin: M0, legend: { y: 1.2 }, xaxis: qTicks(q), yaxis: { type: "log", tickformat: ",.0f", title: { text: "log scale", font: { size: 11, color: css("--muted") } } } }));
  $("mkNote").innerHTML = `Cox Automotive / Kelley Blue Book estimates, which Cox revises each quarter; each quarter here comes from the newest report that covers it. Cox counts U.S. sales, so its Rivian figures differ slightly from Rivian's worldwide deliveries. Reports: ${M.sources.map((u, i) => `<a href="${u}">${i + 1}</a>`).join(", ")}. All vehicles: <a href="${RS.meta.sources.fred}">FRED LTOTALNSA</a>.`;
}

// ---------------------------------------------------------------- who buys
let byState = "wa";
function renderBuyers() {
  if (!RS) return;
  const O = RS.owners, P = O[byState], prof = P.profile, st = byState === "wa" ? "Washington" : "New York";
  $("byState").onclick = (e) => { const b = e.target.closest("[data-s]"); if (!b) return; byState = b.dataset.s; [...$("byState").children].forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); renderBuyers(); };
  $("byTiles").innerHTML = [
    tile({ label: `Teslas registered in ${st}`, value: fmt.intC(prof.tesla.count), sub: `${fmt.pct(prof.tesla.count / (prof.tesla.count + prof.rivian.count + prof.other_ev.count), 0)} of all battery and plug-in EVs` }),
    tile({ label: `Rivians registered in ${st}`, value: fmt.intC(prof.rivian.count), sub: `${fmt.pct(prof.rivian.count / (prof.tesla.count + prof.rivian.count + prof.other_ev.count), 1)} of all EVs` }),
    tile({ label: "Median income of owners' areas", value: `${usdK(prof.tesla.income_median)} / ${usdK(prof.rivian.income_median)}`, sub: `Tesla / Rivian; all residents ${usdK(prof.population.income_median)}` }),
    tile({ label: "In the richest 10% of areas", value: `${fmt.pct(P.top10pct_income_share.tesla, 0)} / ${fmt.pct(P.top10pct_income_share.rivian, 0)}`, sub: "of Teslas / Rivians (10% of residents live there)" }),
  ].join("");
  const grp = [["tesla", "Tesla", cT], ["rivian", "Rivian", cR], ["other_ev", "Other EVs", () => rgba(cO(), 0.5)]];
  draw("c-by-band", [
    ...grp.map(([k, nme, c]) => ({ x: P.bands, y: P.share_by_band[k], type: "bar", name: nme, marker: { color: c() }, hovertemplate: `${nme}: %{y:.1%}<extra></extra>` })),
    { x: P.bands, y: P.share_by_band.population, mode: "lines+markers", name: "All residents", line: { color: css("--ink2"), width: 2, dash: "dot" }, marker: { size: 7, symbol: "diamond" }, hovertemplate: "Residents: %{y:.1%}<extra></extra>" },
  ], layout({ barmode: "group", bargap: 0.25, margin: M0, xaxis: { type: "category", tickangle: 0 }, yaxis: { tickformat: ".0%" } }));
  $("byBandSub").textContent = `Share of each group living in ${byState === "wa" ? "census tracts" : "ZIP code areas"} at each level of median household income. Bars above the dotted line mean the group is over-represented there. ${P.areas.toLocaleString()} areas.`;
  draw("c-by-rate", grp.map(([k, nme, c]) => ({ x: P.bands, y: P.per1k_by_band[k], mode: "lines+markers", name: nme, line: line(c(), 2.6), marker: { size: 7 }, hovertemplate: `${nme}: %{y:.1f} per 1,000<extra></extra>` })),
    layout({ margin: M0, xaxis: { type: "category", tickangle: 0 }, yaxis: { type: "log", tickformat: ",.1f", title: { text: "per 1,000 residents (log scale)", font: { size: 11, color: css("--muted") } } } }));
  const cols = [["tesla", "Tesla"], ["rivian", "Rivian"], ["other_ev", "Other EVs"], ["population", "All residents"]];
  const rows = [
    ["Median household income", (k) => usdK(prof[k].income_median)],
    ["Median age", (k) => prof[k].age.toFixed(1)],
    ["Adults with a bachelor's degree or higher", (k) => fmt.pct(prof[k].bachelor_plus, 0)],
    ["Homes that are owner-occupied", (k) => fmt.pct(prof[k].owner_share, 0)],
    ["Share living in the richest 10% of areas", (k) => fmt.pct(P.top10pct_income_share[k], 0)],
    ["Rank correlation of ownership rate with area income", (k) => (k === "population" ? "" : P.spearman_income_vs_per_capita[k].toFixed(2))],
  ];
  $("byProfile").innerHTML = `<thead><tr><th>${esc2(P.label)}</th>${cols.map(([, l]) => `<th class="n">${l}</th>`).join("")}</tr></thead><tbody>` + rows.map(([l, f]) => `<tr><td><b>${l}</b></td>${cols.map(([k]) => `<td class="n">${f(k)}</td>`).join("")}</tr>`).join("") + "</tbody>";
  const W = O.wa_counties, ord = W.county.map((_, i) => i).reverse();
  draw("c-by-cty", BR.map(([k, nme, c]) => ({ y: ord.map((i) => W.county[i]), x: ord.map((i) => W[`${k}_per1k`][i]), type: "bar", orientation: "h", name: nme, marker: { color: c() }, hovertemplate: `${nme}: %{x:.1f} per 1,000<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.25, hovermode: "y unified", margin: M0, xaxis: { showgrid: true, showline: false }, yaxis: { automargin: true } }));
  const Y = O.wa_bev_share_by_model_year;
  draw("c-by-my", BR.map(([k, nme, c]) => ({ x: Y.years.map(String), y: Y[k], mode: "lines+markers", name: nme, line: line(c(), 2.6), marker: { size: 7 }, hovertemplate: `${nme}: %{y:.1%}<extra></extra>` })),
    layout({ margin: M0, xaxis: { type: "category", tickangle: 0 }, yaxis: { tickformat: ".0%", rangemode: "tozero" } }));
  $("byNote").innerHTML = `Registrations: <a href="${RS.meta.sources.wa}">Washington DOL</a> (current EV registrations by census tract) and <a href="${RS.meta.sources.ny}">New York DMV</a> (electric registrations by ZIP code, matched to ZIP code tabulation areas). Area statistics: U.S. Census Bureau, ${esc2(O.acs_release)}, via <a href="${RS.meta.sources.acs}">Census Reporter</a>. These are neighbourhood averages, so they cannot say how old or rich an individual owner is. Leased and fleet vehicles are registered where the lessor or fleet is based.`;
}

// ---------------------------------------------------------------- customer view
function renderCustomers() {
  if (!RS) return;
  const F = researchFacts(), C = RS.customers, yrs = [...new Set(Object.values(C.recalls_by_year).flatMap((o) => Object.keys(o)))].sort();
  const yr = new Date().getFullYear();
  $("cuTiles").innerHTML = [
    tile({ label: "Recall campaigns since 2019", value: `${C.recall_campaigns.tesla ?? 0} / ${C.recall_campaigns.rivian ?? 0}`, sub: "Tesla / Rivian, all models (NHTSA)" }),
    tile({ label: "Recalls fixable over the air", value: `${fmt.pct(C.recall_ota_share.tesla ?? 0, 0)} / ${fmt.pct(C.recall_ota_share.rivian ?? 0, 0)}`, sub: "Tesla / Rivian; no service visit needed" }),
    tile({ label: "Complaints per 10,000 sold, model year 2024", value: `${F.rate("tesla", 2024)?.toFixed(1) ?? "n/a"} / ${F.rate("rivian", 2024)?.toFixed(1) ?? "n/a"}`, sub: "Tesla / Rivian (lower is better)" }),
    tile({ label: "Longest EPA range", value: `${F.best("tesla")?.range_max ?? "n/a"} / ${F.best("rivian")?.range_max ?? "n/a"} mi`, sub: `${F.best("tesla")?.model ?? ""} / ${F.best("rivian")?.model ?? ""}` }),
  ].join("");
  const specs = [...C.epa].sort((a, b) => a.make.localeCompare(b.make) || b.range_max - a.range_max);
  $("cuSpecs").innerHTML = `<thead><tr><th>Model</th><th>Type</th><th class="n">Model year</th><th class="n">Versions</th><th class="n">EPA range (mi)</th><th class="n">Best kWh/100 mi</th><th class="n">Best MPGe</th></tr></thead><tbody>` +
    specs.map((s) => `<tr><td><span class="dotk" style="background:${s.make === "tesla" ? cT() : cR()}"></span><b>${s.make === "tesla" ? "Tesla" : "Rivian"} ${esc2(s.model)}</b></td><td>${esc2(s.class)}</td><td class="n">${s.year}</td><td class="n">${s.versions}</td><td class="n">${s.range_min === s.range_max ? s.range_max : `${s.range_min}–${s.range_max}`}</td><td class="n">${s.kwh_per_100mi_best.toFixed(1)}</td><td class="n">${s.mpge_best}</td></tr>`).join("") + "</tbody>";
  const sp = [...specs].sort((a, b) => a.range_max - b.range_max), lab = sp.map((s) => `${s.make === "tesla" ? "Tesla" : "Rivian"} ${s.model}`);
  draw("c-cu-range", [{ y: lab, x: sp.map((s) => Math.max(s.range_max - s.range_min, 4)), base: sp.map((s) => (s.range_max - s.range_min < 4 ? s.range_max - 2 : s.range_min)), type: "bar", orientation: "h", marker: { color: sp.map((s) => (s.make === "tesla" ? cT() : cR())) }, customdata: sp.map((s) => [s.range_min, s.range_max]), hovertemplate: "%{y}: %{customdata[0]} to %{customdata[1]} miles<extra></extra>", text: sp.map((s) => `${s.range_max} mi`), textposition: "outside", cliponaxis: false }],
    layout({ margin: { l: 8, r: 50, t: 8, b: 8 }, showlegend: false, hovermode: "closest", bargap: 0.35, xaxis: { showgrid: true, showline: false, rangemode: "tozero", ticksuffix: " mi" }, yaxis: { automargin: true } }));
  const star = (v) => (/^\d$/.test(String(v)) ? "★".repeat(+v) + `<span class="muted">${"★".repeat(5 - v)}</span>` : "<span class=\"muted\">not rated</span>");
  $("cuNcap").innerHTML = `<thead><tr><th>Model</th><th class="n">Year</th><th>Overall</th><th>Front</th><th>Side</th><th>Rollover</th></tr></thead><tbody>` +
    [...C.ncap].sort((a, b) => a.make.localeCompare(b.make)).map((x) => `<tr><td><span class="dotk" style="background:${x.make === "tesla" ? cT() : cR()}"></span><b>${esc2(x.model)}</b></td><td class="n">${x.model_year}</td><td class="stars">${star(x.overall)}</td><td class="stars">${star(x.frontal)}</td><td class="stars">${star(x.side)}</td><td class="stars">${star(x.rollover)}</td></tr>`).join("") + "</tbody>";
  const cr = C.complaint_rates.filter((x) => x.model_year >= yr - 3 && x.model_year < yr && x.sold >= 1000).sort((a, b) => a.per10k - b.per10k);
  draw("c-cu-rate", [{ y: cr.map((x) => `${x.model} · MY${x.model_year}`), x: cr.map((x) => x.per10k), type: "bar", orientation: "h", marker: { color: cr.map((x) => (x.make === "tesla" ? cT() : cR())) }, customdata: cr.map((x) => [x.complaints, x.sold]), text: cr.map((x) => x.per10k.toFixed(1)), textposition: "outside", cliponaxis: false, hovertemplate: "%{y}: %{x:.1f} per 10,000 (%{customdata[0]} complaints, %{customdata[1]:,} sold)<extra></extra>" }],
    layout({ margin: { l: 8, r: 40, t: 8, b: 8 }, showlegend: false, hovermode: "closest", bargap: 0.3, xaxis: { showgrid: true, showline: false, rangemode: "tozero" }, yaxis: { automargin: true } }));
  $("cuRateSub").textContent = "NHTSA owner complaints for each model year, per 10,000 of that model sold in the U.S. in the same calendar year (Cox). Newer model years have had less time on the road, so compare within a year. Models with under 1,000 sales are left out.";
  draw("c-cu-rec", BR.map(([k, nme, c]) => ({ x: yrs, y: yrs.map((y) => C.recalls_by_year[k]?.[y] ?? 0), type: "bar", name: nme, marker: { color: c() }, hovertemplate: `${nme} %{x}: %{y} campaigns<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.25, margin: M0, xaxis: { type: "category", tickangle: 0 }, yaxis: { dtick: 5 } }));
  $("cuRecSub").textContent = `Recall campaigns filed with NHTSA each year. One campaign can cover many vehicles and model years, and many are fixed by a software update rather than a service visit.`;
  const compChart = (id, obj) => {
    const tot = (k) => sum(Object.values(obj[k] || {})), keys = [...new Set(BR.flatMap(([k]) => Object.keys(obj[k] || {}).slice(0, 6)))];
    keys.sort((a, b) => ((obj.tesla?.[a] || 0) / tot("tesla") + (obj.rivian?.[a] || 0) / tot("rivian")) - ((obj.tesla?.[b] || 0) / tot("tesla") + (obj.rivian?.[b] || 0) / tot("rivian")));
    draw(id, BR.map(([k, nme, c]) => ({ y: keys, x: keys.map((x) => (obj[k]?.[x] || 0) / tot(k)), type: "bar", orientation: "h", name: nme, marker: { color: c() }, hovertemplate: `${nme}: %{x:.0%}<extra></extra>` })),
      layout({ barmode: "group", bargap: 0.25, hovermode: "y unified", margin: M0, xaxis: { tickformat: ".0%", showgrid: true, showline: false }, yaxis: { automargin: true } }));
  };
  compChart("c-cu-ccomp", C.complaint_components); compChart("c-cu-rcomp", C.recall_components);
  $("cuNote").innerHTML = `Sources: <a href="${RS.meta.sources.nhtsa}">NHTSA</a> recalls, complaints and NCAP ratings; <a href="${RS.meta.sources.epa}">EPA fueleconomy.gov</a>; sales denominators from Cox Automotive. Complaints are owner reports that NHTSA has not verified. ${C.complaints_total.tesla?.toLocaleString() ?? 0} Tesla and ${C.complaints_total.rivian?.toLocaleString() ?? 0} Rivian complaints are on file across the model years shown. Charging networks are compared on the Head to head tab.`;
}

// ---------------------------------------------------------------- sentiment
function renderSentiment() {
  if (!RS) return;
  const F = researchFacts(), S = RS.sentiment, C = RS.customers.complaints_monthly;
  const tt = F.tone("tesla"), rt = F.tone("rivian"), cv = (co) => (S[co] ? mean(S[co].share_per_million.slice(-12).filter(ok)) : NaN);
  const HAS = BR.filter(([k]) => S[k]), HASV = HAS.filter(([k]) => S[k].share_per_million.some(ok));
  draw("c-se-comp", BR.map(([k, nme, c]) => ({ x: C.months.map((m) => m + "-01"), y: C[k] || [], type: "bar", name: nme, marker: { color: c() }, hovertemplate: `${nme}: %{y}<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.2, margin: M0, xaxis: { type: "date" }, yaxis: { rangemode: "tozero" } }));
  const noTone = !tt && !rt;
  $("c-se-tone").closest("article").hidden = noTone; $("c-se-vol").closest("article").hidden = !HASV.length;
  if (noTone) {
    $("seTiles").innerHTML = tile({ label: "Owner complaints, last 12 months", value: `${fmt.intC(sum(C.tesla.slice(-12)))} / ${fmt.intC(sum(C.rivian.slice(-12)))}`, sub: "Tesla / Rivian, filed with NHTSA" });
    $("seNote").textContent = "News tone from GDELT could not be fetched at the last build; it will appear after the next successful refresh.";
    return;
  }
  $("seTiles").innerHTML = [
    ...[["Tesla", tt], ["Rivian", rt]].map(([n, x]) => tile({ label: `${n} news tone, last 12 months`, value: x ? x.last.toFixed(2) : "pending", delta: x ? deltaChip(x.last - x.prev, numTxt("", 2)) : "", sub: x ? "vs prior 12 months; 0 is neutral" : "GDELT not fetched yet" })),
    tile({ label: "News coverage, last 12 months", value: ok(cv("tesla") / cv("rivian")) ? `${Math.round(cv("tesla") / cv("rivian"))}×` : "pending", sub: "Tesla articles per Rivian article" }),
    tile({ label: "Owner complaints, last 12 months", value: `${fmt.intC(sum(C.tesla.slice(-12)))} / ${fmt.intC(sum(C.rivian.slice(-12)))}`, sub: "Tesla / Rivian, filed with NHTSA" }),
  ].join("");
  draw("c-se-tone", [
    ...HAS.map(([k, nme, c]) => ({ x: S[k].months.map((m) => m + "-01"), y: S[k].tone, mode: "markers", name: `${nme} monthly`, showlegend: false, marker: { size: 5, color: rgba(c(), 0.35) }, hoverinfo: "skip" })),
    ...HAS.map(([k, nme, c]) => ({ x: S[k].months.map((m) => m + "-01"), y: rolling(S[k].tone, 3).map((v, i) => (i >= 2 ? v : null)), mode: "lines", name: nme, line: line(c(), 2.6), hovertemplate: `${nme}: %{y:.2f}<extra></extra>` })),
  ], layout({ margin: M0, xaxis: { type: "date" }, yaxis: { zeroline: true, zerolinecolor: css("--axis"), title: { text: "average tone (negative to positive)", font: { size: 11, color: css("--muted") } } },
    shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: css("--axis"), width: 1 } }] }));
  $("seToneSub").textContent = "GDELT scores the wording of every English-language online news article it monitors from very negative to very positive; this is the monthly average for articles mentioning each company, with a 3-month line. Most business news sits slightly below zero.";
  if (HASV.length) draw("c-se-vol", HASV.map(([k, nme, c]) => ({ x: S[k].months.map((m) => m + "-01"), y: S[k].share_per_million, mode: "lines", name: nme, line: line(c(), 2.4), hovertemplate: `${nme}: %{y:,.0f} per million<extra></extra>` })),
    layout({ margin: M0, xaxis: { type: "date" }, yaxis: { type: "log", tickformat: ",.0f" } }));
  $("seNote").innerHTML = `Sources: <a href="${RS.meta.sources.gdelt}">The GDELT Project</a> (DOC 2.0 API, English-language sources; Tesla articles must also mention cars, EVs, Musk or Cybertruck, to leave out Nikola Tesla), <a href="${RS.meta.sources.nhtsa}">NHTSA complaints</a>. Wikipedia attention is on the Head to head tab. Tone measures how the news is written, not what buyers think, and spikes with events such as earnings, recalls and political news about Tesla's chief executive.`;
}

// ---------------------------------------------------------------- investor view
function renderInvestors() {
  if (!RS) return;
  const I = RS.investors, t = I.tesla, r = I.rivian;
  const m = (x, k) => x.ttm[k] / x.ttm.revenue;
  $("ivTiles").innerHTML = [
    tile({ label: "Revenue", value: `${usd(t.ttm.revenue)} / ${usd(r.ttm.revenue)}`, sub: `Tesla / Rivian, four quarters to ${evQ(t.latest)}` }),
    tile({ label: "Net income", value: `${usd(t.ttm.net_income)} / ${usd(r.ttm.net_income)}`, sub: `margin ${fmt.pct(m(t, "net_income"))} / ${fmt.pct(m(r, "net_income"))}` }),
    tile({ label: "Free cash flow", value: `${usd(t.ttm.fcf)} / ${usd(r.ttm.fcf)}`, sub: "operating cash flow minus capital spending" }),
    tile({ label: "Rivian cash runway", value: r.runway_quarters ? `${r.runway_quarters} quarters` : "cash positive", sub: `${usd(r.liquidity.at(-1))} cash and investments at the current burn` }),
  ].join("");
  const steps = [["Gross margin", "gross_profit"], ["Operating margin", "operating_income"], ["Net margin", "net_income"], ["Free cash flow margin", "fcf"]];
  draw("c-iv-wf", BR.map(([k, nme, c]) => ({ x: steps.map(([l]) => l), y: steps.map(([, f]) => m(I[k], f)), type: "bar", name: nme, marker: { color: c() }, customdata: steps.map(([, f]) => usd(I[k].ttm[f])), text: steps.map(([, f]) => fmt.pct(m(I[k], f), 0)), textposition: "outside", cliponaxis: false, hovertemplate: `${nme} %{x}: %{y:.1%} (%{customdata})<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.3, margin: M0, xaxis: { type: "category" }, yaxis: { tickformat: ".0%", zeroline: true, zerolinecolor: css("--axis") } }));
  $("ivWfSub").textContent = `Each line of the income statement as a share of revenue, so a $${(t.ttm.revenue / 1e3).toFixed(0)}B company and a $${(r.ttm.revenue / 1e3).toFixed(1)}B company can sit on one chart. Hover for dollar amounts.`;
  const per = [["Revenue", "revenue"], ["Gross profit", "gross_profit"], ["Net income", "net_income"]];
  draw("c-iv-unit", BR.map(([k, nme, c]) => ({ x: per.map(([l]) => l), y: per.map(([, f]) => (I[k].ttm[f] * 1e6) / I[k].ttm.deliveries), type: "bar", name: nme, marker: { color: c() }, text: per.map(([, f]) => usdK((I[k].ttm[f] * 1e6) / I[k].ttm.deliveries)), textposition: "outside", cliponaxis: false, hovertemplate: `${nme} %{x}: $%{y:,.0f} per vehicle<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.3, margin: M0, xaxis: { type: "category" }, yaxis: { tickprefix: "$", tickformat: ",.0f", zeroline: true, zerolinecolor: css("--axis") } }));
  const qs = [...new Set([...t.quarters, ...r.quarters])].filter((q) => q >= "2021-01").sort(), ix = (x, k) => qs.map((q) => { const i = x.quarters.indexOf(q); return i < 0 || x[k][i] == null ? null : x[k][i] / 1e3; });
  const qbars = (id, k) => draw(id, BR.map(([kk, nme, c]) => ({ x: qs.map(evQ), y: ix(I[kk], k), type: "bar", name: nme, marker: { color: c() }, hovertemplate: `${nme} %{x}: $%{y:.2f}B<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.25, margin: M0, xaxis: qTicks(qs), yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f", zeroline: true, zerolinecolor: css("--axis") } }));
  qbars("c-iv-ni", "net_income"); qbars("c-iv-fcf", "fcf");
  draw("c-iv-cash", [
    ...BR.map(([k, nme, c]) => ({ x: qs.map(evQ), y: ix(I[k], "liquidity"), mode: "lines+markers", name: `${nme} cash and investments`, line: line(c(), 2.6), marker: { size: 5 }, hovertemplate: `${nme} cash: $%{y:.1f}B<extra></extra>` })),
    ...BR.map(([k, nme, c]) => ({ x: qs.map(evQ), y: ix(I[k], "debt"), mode: "lines", name: `${nme} debt`, connectgaps: true, line: { color: c(), width: 2, dash: "dot" }, hovertemplate: `${nme} debt: $%{y:.1f}B<extra></extra>` })),
  ], layout({ margin: M0, legend: { y: 1.22 }, xaxis: qTicks(qs), yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f", rangemode: "tozero" } }));
  $("ivCashSub").textContent = "Cash and equivalents plus short-term investments (solid) against debt excluding leases (dotted), at each quarter end.";
  const ox = [["R&D", "rnd"], ["Selling, general and admin", "sga"], ["Stock-based pay", "sbc"]];
  draw("c-iv-opex", BR.map(([k, nme, c]) => ({ x: ox.map(([l]) => l), y: ox.map(([, f]) => m(I[k], f)), type: "bar", name: nme, marker: { color: c() }, text: ox.map(([, f]) => fmt.pct(m(I[k], f), 0)), textposition: "outside", cliponaxis: false, hovertemplate: `${nme} %{x}: %{y:.1%} of revenue<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.3, margin: M0, xaxis: { type: "category" }, yaxis: { tickformat: ".0%", rangemode: "tozero" } }));
  const base = qs.filter((q) => q >= "2023-01").find((q) => BR.every(([k]) => { const i = I[k].quarters.indexOf(q); return i >= 0 && I[k].shares[i] != null; }));
  draw("c-iv-shares", BR.map(([k, nme, c]) => { const b = I[k].shares[I[k].quarters.indexOf(base)]; return { x: qs.map(evQ), y: qs.map((q) => { const i = I[k].quarters.indexOf(q); return i < 0 || I[k].shares[i] == null || q < base ? null : (I[k].shares[i] / b) * 100; }), mode: "lines+markers", name: nme, connectgaps: true, line: line(c(), 2.6), marker: { size: 5 }, hovertemplate: `${nme}: %{y:.0f}<extra></extra>` }; }),
    layout({ margin: M0, xaxis: qTicks(qs), yaxis: { tickformat: ".0f" } }));
  $("ivShSub").textContent = `Common shares outstanding at each quarter end, indexed to ${evQ(base)} = 100. A rising line means existing holders own a smaller slice. Starts after Tesla's 2022 three-for-one split and Rivian's 2021 listing, which would otherwise distort the line.`;
  const pf = (x) => x.public_float.at(-1);
  const rows = [
    ["Revenue, last 4 quarters", (x) => usd(x.ttm.revenue)], ["Gross margin", (x) => fmt.pct(m(x, "gross_profit"))], ["Operating margin", (x) => fmt.pct(m(x, "operating_income"))],
    ["Net income", (x) => usd(x.ttm.net_income)], ["Free cash flow", (x) => usd(x.ttm.fcf)], ["Vehicles delivered", (x) => fmt.int(x.ttm.deliveries)],
    ["Gross profit per vehicle", (x) => usdK(x.gp_per_vehicle)], ["Deliveries a year to cover operating costs at that gross profit", (x) => (x.breakeven_deliveries ? fmt.int(x.breakeven_deliveries) : "n/a")],
    ["Cash and short-term investments", (x) => usd(x.liquidity.at(-1))], ["Debt (excluding leases)", (x) => (x.debt.filter(ok).length ? usd(x.debt.filter(ok).at(-1)) : "n/a")],
    ["Cash runway at current burn", (x) => (x.runway_quarters ? `${x.runway_quarters} quarters` : "cash positive")],
    ["R&D as share of revenue", (x) => fmt.pct(m(x, "rnd"))], ["Stock-based pay as share of revenue", (x) => fmt.pct(m(x, "sbc"))],
    ["Share count change, 3 years", (x) => (x.share_growth_3y != null ? pctTxt(x.share_growth_3y) : "n/a")],
    ["Public float (10-K cover page)", (x) => (pf(x) ? `${usd(pf(x).value)} at ${pf(x).date}` : "n/a")], ["Public float to trailing sales", (x) => (x.float_to_sales ? `${x.float_to_sales}×` : "n/a")],
  ];
  $("ivTable").innerHTML = `<thead><tr><th>Measure</th>${BR.map(([, n, c]) => `<th class="n"><span class="dotk" style="background:${c()}"></span>${n}</th>`).join("")}</tr></thead><tbody>` + rows.map(([l, f]) => `<tr><td><b>${l}</b></td>${BR.map(([k]) => `<td class="n">${f(I[k])}</td>`).join("")}</tr>`).join("") + "</tbody>";
  $("ivNote").innerHTML = `Source: <a href="${RS.meta.sources.sec}">SEC EDGAR</a> company facts (10-Q and 10-K). Quarterly figures not reported directly are derived from year-to-date totals. Operating costs are gross profit minus operating income. Deliveries are company-reported. <b>This is not investment advice.</b>`;
}
