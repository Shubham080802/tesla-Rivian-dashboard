// Overview, market share, who buys, quality & safety, sentiment and investors (research.json, scripts/build_research.py).
// Every tab works from one company list, so all three companies always appear the same way and in the same order.
let RS = null;
function prepResearch(d) { RS = d; }
const cT = () => css("--c2"), cR = () => css("--c1"), cL = () => css("--c3"), cO = () => css("--muted");
const BR = [["tesla", "Tesla", cT], ["rivian", "Rivian", cR], ["lucid", "Lucid", cL]];
const CO_NAME = Object.fromEntries(BR.map(([k, n]) => [k, n]));
const coColor = (k) => (BR.find(([x]) => x === k) || [, , cO])[2]();                  // "tesla" -> Tesla's colour
const brandOf = (label) => String(label).split(" ")[0].toLowerCase();                    // "Lucid Air" -> "lucid"
const M0 = { l: 8, r: 16, t: 28, b: 8 };
const usd = (m) => (m < 0 ? "−$" : "$") + (Math.abs(m) >= 1e3 ? (Math.abs(m) / 1e3).toFixed(1) + "B" : Math.abs(m).toFixed(0) + "M");
const usdK = (v) => (v < 0 ? "−$" : "$") + Math.round(Math.abs(v) / 100) / 10 + "K";
const pp = (v) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1) + " pts";
const qTicks = (qs) => ({ type: "category", tickmode: "array", tickvals: qs.filter((q) => q.endsWith("-01")).map(evQ), ticktext: qs.filter((q) => q.endsWith("-01")).map((q) => q.slice(0, 4)), tickangle: 0 });
const nn = (a) => a.map((v) => (v == null ? null : v));

// ---------------------------------------------------------------- shared numbers used by several tabs
function researchFacts() {
  const M = RS.market, n = M.quarters.length - 1, y = n - 4;
  const I = RS.investors, C = RS.customers, S = RS.sentiment, O = RS.owners;
  const avgL = (a, k0, k1) => mean(a.slice(k0, k1).filter(ok));
  const tone = (co) => (S[co] ? { last: avgL(S[co].tone, -12), prev: avgL(S[co].tone, -24, -12) } : null);
  const rate = (mk, my) => { const r = C.complaint_rates.filter((x) => x.make === mk && x.model_year === my); return r.length ? sum(r.map((x) => x.complaints)) / sum(r.map((x) => x.sold)) * 1e4 : null; };
  const best = (mk) => C.epa.filter((e) => e.make === mk).sort((a, b) => b.range_max - a.range_max)[0];
  const share = (k, i) => (M[k] && M[k][i] != null && M.total_ev[i] ? M[k][i] / M.total_ev[i] : null);
  return { M, n, y, share, I, C, S, O, tone, rate, best, q: evQ(M.quarters[n]), qy: evQ(M.quarters[y]) };
}

// One tile, every company: each row is a coloured key, the company, its value and an optional change chip.
function duoTile(label, rows, sub) {
  return `<div class="tile duo"><div class="l">${label}</div>${rows.map(([nme, c, v, d]) => `<div class="duo-r"><span class="dotk" style="background:${c}"></span><span class="duo-n">${nme}</span><span class="duo-v">${v}</span>${d || ""}</div>`).join("")}${sub ? `<div class="sub"><span>${sub}</span></div>` : ""}</div>`;
}
// fn(company key) returns [value text, optional change chip]
const coTile = (label, fn, sub) => duoTile(label, BR.map(([k, n, c]) => [n, c(), ...fn(k)]), sub);

// ---------------------------------------------------------------- overview
function renderOverview() {
  if (!RS || !EV) return;
  const F = researchFacts(), { M, n, y, I } = F;
  const d4 = (k, a, b) => sum(EV[k].quarters.slice(a, b).map((x) => x.deliveries));
  const nm = (x) => x.ttm.net_income / x.ttm.revenue;
  const runway = BR.filter(([k]) => I[k].runway_quarters).map(([k, n]) => `${n} ${I[k].runway_quarters} quarters`).join(", ");
  $("ovTiles").innerHTML = [
    coTile(`U.S. EV market share, ${F.q}`, (k) => [F.share(k, n) == null ? "n/a" : fmt.pct(F.share(k, n), 1), F.share(k, y) == null ? "" : deltaChip(F.share(k, n) - F.share(k, y), pp)], `vs ${F.qy}`),
    coTile("Deliveries, last 4 quarters", (k) => [fmt.intC(d4(k, -4)), deltaChip(d4(k, -4) / d4(k, -8, -4) - 1, pctTxt)], `to ${evQ(EV.tesla.quarters.at(-1).q)}, vs prior 4 quarters`),
    coTile("Revenue, last 4 quarters", (k) => [usd(I[k].ttm.revenue)], `to ${evQ(I.tesla.latest)}`),
    coTile("Net margin, last 4 quarters", (k) => [fmt.pct(nm(I[k]), 0)], "net income as a share of revenue"),
  ].join("");
  $("ovTiles2").innerHTML = [
    coTile("Free cash flow, last 4 quarters", (k) => [usd(I[k].ttm.fcf)], "operating cash flow minus capex"),
    coTile("Cash and short-term investments", (k) => [usd(I[k].liquidity.at(-1))], runway ? `runway at current burn: ${runway} (balance-sheet cash only)` : `at ${evQ(I.tesla.latest)}`),
    coTile("Gross profit per vehicle", (k) => [usdK(I[k].gp_per_vehicle)], "last 4 quarters"),
    coTile("News tone, last 12 months", (k) => { const t = F.tone(k); return t ? [t.last.toFixed(2), deltaChip(t.last - t.prev, numTxt("", 2))] : ["–"]; }, "GDELT average tone; 0 is neutral"),
  ].join("");
  const q = M.quarters, ql = q.map(evQ), m0 = { l: 8, r: 16, t: 28, b: 8 };
  draw("c-ov-share", BR.map(([k, nme, c]) => ({ x: ql, y: q.map((_, i) => F.share(k, i)), mode: "lines+markers", name: nme, connectgaps: false, line: line(c(), 2.6), marker: { size: 6 }, hovertemplate: `${nme}: %{y:.1%}<extra></extra>` })),
    layout({ margin: m0, xaxis: qTicks(q), yaxis: { tickformat: ".0%", rangemode: "tozero" } }));
  const gq = EV.tesla.quarters.map((x) => x.q).filter((x) => x >= "2024-01");
  const yoy = (k) => gq.map((z) => { const Q = EV[k].quarters, i = Q.findIndex((r) => r.q === z); return i >= 4 && Q[i - 4].deliveries ? Q[i].deliveries / Q[i - 4].deliveries - 1 : null; });
  draw("c-ov-growth", BR.map(([k, nme, c]) => ({ x: gq.map(evQ), y: yoy(k), type: "bar", name: nme, marker: { color: c() }, hovertemplate: `${nme}: %{y:+.0%}<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.25, margin: m0, xaxis: qTicks(gq), yaxis: { tickformat: "+.0%", zeroline: true, zerolinecolor: css("--axis") } }));
  const fq = [...new Set(BR.flatMap(([k]) => I[k].quarters))].filter((x) => x >= "2024-01").sort();
  const at = (x, f) => fq.map((z) => { const i = x.quarters.indexOf(z); return i < 0 || x[f][i] == null ? null : x[f][i]; });
  const marg = (x) => fq.map((z) => { const i = x.quarters.indexOf(z); return i < 0 || !x.revenue[i] ? null : x.net_income[i] / x.revenue[i]; });
  const FLOOR = -3;                                             // −300%: deeper quarters would flatten the other two lines
  draw("c-ov-margin", BR.map(([k, nme, c]) => ({ x: fq.map(evQ), y: marg(I[k]), mode: "lines+markers", name: nme, line: line(c(), 2.6), marker: { size: 6 }, hovertemplate: `${nme}: %{y:.0%}<extra></extra>` })),
    layout({ margin: m0, xaxis: qTicks(fq), yaxis: { tickformat: ".0%", zeroline: true, zerolinecolor: css("--axis"), range: [FLOOR, 0.3] } }));
  const below = BR.flatMap(([k, nme]) => marg(I[k]).map((v, i) => (v != null && v < FLOOR ? `${nme} ${evQ(fq[i])} ${fmt.pct(v, 0)}` : null)).filter(Boolean));
  $("ovMarginSub").textContent = `Quarterly net income as a share of revenue, since 2024.${below.length ? ` Below the chart: ${below.join(", ")}.` : ""}`;
  draw("c-ov-fcf", BR.map(([k, nme, c]) => ({ x: fq.map(evQ), y: at(I[k], "fcf").map((v) => (v == null ? null : v / 1e3)), type: "bar", name: nme, marker: { color: c() }, hovertemplate: `${nme}: $%{y:.2f}B<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.25, margin: m0, xaxis: qTicks(fq), yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f", zeroline: true, zerolinecolor: css("--axis") } }));
  $("ovNote").textContent = `Sources: SEC filings, company delivery releases, Cox Automotive, GDELT. Updated ${RS.meta.built}. Not investment advice.`;
}

// ---------------------------------------------------------------- market share
function renderMarket() {
  if (!RS) return;
  const F = researchFacts(), { M, n, y } = F, q = M.quarters, ql = q.map(evQ);
  const sh = (k) => q.map((_, i) => F.share(k, i));
  const evs = M.total_ev.map((v, i) => (M.all_vehicles[i] ? v / M.all_vehicles[i] : null));
  const lastEv = evs.map((v, i) => [v, i]).filter(([v]) => v != null).at(-1);
  $("mkTiles").innerHTML = [
    coTile(`Share of U.S. EV sales, ${F.q}`, (k) => [F.share(k, n) == null ? "n/a" : fmt.pct(F.share(k, n), 1), F.share(k, y) == null ? "" : deltaChip(F.share(k, n) - F.share(k, y), pp)], `vs ${F.qy}`),
    coTile(`U.S. EV sales, ${F.q}`, (k) => [M[k][n] == null ? "n/a" : fmt.intC(M[k][n]), M[k][y] ? deltaChip(M[k][n] / M[k][y] - 1, pctTxt) : ""], `Cox estimates, vs ${F.qy}`),
    tile({ label: `All U.S. EV sales, ${F.q}`, value: fmt.intC(M.total_ev[n]), delta: deltaChip(M.total_ev[n] / M.total_ev[y] - 1, pctTxt), sub: `every brand, vs ${F.qy}` }),
    tile({ label: lastEv ? `EV share of new vehicles, ${evQ(q[lastEv[1]])}` : "EV share of new vehicles", value: lastEv ? fmt.pct(lastEv[0], 1) : "n/a", sub: "battery-electric, of all light vehicles" }),
  ].join("");
  draw("c-mk-share", BR.map(([k, nme, c]) => ({ x: ql, y: sh(k), mode: "lines+markers+text", name: nme, connectgaps: false, line: line(c(), 2.6), marker: { size: 7 }, text: sh(k).map((v, i) => (i === n && v != null ? fmt.pct(v, 1) : "")), textposition: "top center", textfont: { color: css("--ink2") }, hovertemplate: `${nme}: %{y:.1%}<extra></extra>` })),
    layout({ margin: M0, xaxis: qTicks(q), yaxis: { tickformat: ".0%", rangemode: "tozero" } }));
  const other = M.total_ev.map((v, i) => v - sum(BR.map(([k]) => M[k][i] || 0)));
  draw("c-mk-stack", [
    ...BR.map(([k, nme, c]) => ({ x: ql, y: M[k], type: "bar", name: nme, marker: { color: c() }, hovertemplate: `${nme}: %{y:,}<extra></extra>` })),
    { x: ql, y: other, type: "bar", name: "All other brands", marker: { color: rgba(cO(), 0.45) }, hovertemplate: "Others: %{y:,}<extra></extra>" },
  ], layout({ barmode: "stack", bargap: 0.3, margin: M0, xaxis: qTicks(q), yaxis: { tickformat: ".2s" } }));
  $("mkShareSub").textContent = `Each company's share of all new battery-electric vehicles sold in the U.S., ${ql[0]} to ${F.q}. Cox did not list Lucid separately in its Q1 2025 report, so Lucid's Q1 2024 point is missing.`;
  draw("c-mk-ev", [{ x: ql, y: evs, mode: "lines+markers", name: "EV share", line: line(css("--ink2"), 2.6), marker: { size: 7 }, hovertemplate: "%{y:.1%}<extra></extra>" }],
    layout({ margin: M0, showlegend: false, xaxis: qTicks(q), yaxis: { tickformat: ".0%", rangemode: "tozero" } }));
  $("mkEvSub").textContent = "Cox's EV sales divided by all new cars and light trucks sold (BEA, via FRED). Quarters without three months of BEA data are left out.";
  const mods = Object.entries(M.models).map(([k, v]) => [k, v[n]]).filter(([, v]) => v).sort((a, b) => a[1] - b[1]);
  draw("c-mk-mix", [{ y: mods.map(([k]) => k), x: mods.map(([, v]) => v), type: "bar", orientation: "h", marker: { color: mods.map(([k]) => coColor(brandOf(k))) }, text: mods.map(([, v]) => fmt.int(v)), textposition: "outside", cliponaxis: false, hovertemplate: "%{y}: %{x:,}<extra></extra>" }],
    layout({ margin: { l: 8, r: 40, t: 8, b: 8 }, showlegend: false, hovermode: "closest", bargap: 0.3, xaxis: { showgrid: true, showline: false, tickformat: ".2s" }, yaxis: { automargin: true } }));
  $("mkMixSub").textContent = `U.S. sales by model in ${F.q} (Cox estimates).`;
  const shade = (list, c) => list.map((k, i) => ({ x: ql, y: nn(M.models[k]), mode: "lines+markers", name: k, connectgaps: false, line: { color: rgba(c(), 1 - i * (0.6 / Math.max(1, list.length - 1))), width: 2.2, dash: ["solid", "dot", "dash", "dashdot", "longdash"][i % 5] }, marker: { size: 6 }, hovertemplate: `${k}: %{y:,}<extra></extra>` }));
  draw("c-mk-models", BR.flatMap(([k, , c]) => shade(Object.keys(M.models).filter((m) => brandOf(m) === k), c)),
    layout({ margin: M0, legend: { y: 1.25 }, xaxis: qTicks(q), yaxis: { type: "log", tickformat: ",.0f", title: { text: "log scale", font: { size: 11, color: css("--muted") } } } }));
  $("mkNote").innerHTML = `Cox Automotive / Kelley Blue Book estimates, which Cox revises each quarter; each quarter here comes from the newest report that covers it. Cox counts U.S. sales, so its Rivian and Lucid figures differ slightly from their worldwide deliveries. Reports: ${M.sources.map((u, i) => `<a href="${u}">${i + 1}</a>`).join(", ")}. All vehicles: <a href="${RS.meta.sources.fred}">FRED LTOTALNSA</a>.`;
}

// ---------------------------------------------------------------- who buys
let byState = "all";
const ST_NAME = { all: "the four states", ca: "California", wa: "Washington", ny: "New York", ct: "Connecticut" };
const ST_UNIT = { all: "areas", ca: "ZIP code areas", wa: "census tracts", ny: "ZIP code areas", ct: "towns" };
function renderBuyers() {
  if (!RS) return;
  const O = RS.owners, P = O[byState], prof = P.profile, st = ST_NAME[byState];
  $("byState").onclick = (e) => { const b = e.target.closest("[data-s]"); if (!b) return; byState = b.dataset.s; [...$("byState").children].forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); renderBuyers(); };
  const allEv = sum(["tesla", "rivian", "lucid", "other_ev"].map((k) => prof[k]?.count || 0));
  $("byTiles").innerHTML = [
    coTile(`Registered in ${st}`, (k) => [fmt.intC(prof[k].count)], "battery-electric and plug-in vehicles"),
    coTile("Share of all registered EVs", (k) => [fmt.pct(prof[k].count / allEv, 1)], `of ${fmt.intC(allEv)} EVs`),
    coTile("Median income of owners' areas", (k) => [usdK(prof[k].income_median)], `all residents ${usdK(prof.population.income_median)}`),
    coTile("In the richest 10% of areas", (k) => [fmt.pct(P.top10pct_income_share[k], 0)], "where 10% of residents live"),
  ].join("");
  const grp = [...BR, ["other_ev", "Other EVs", () => rgba(cO(), 0.5)]];
  draw("c-by-band", [
    ...grp.map(([k, nme, c]) => ({ x: P.bands, y: P.share_by_band[k], type: "bar", name: nme, marker: { color: c() }, hovertemplate: `${nme}: %{y:.1%}<extra></extra>` })),
    { x: P.bands, y: P.share_by_band.population, mode: "lines+markers", name: "All residents", line: { color: css("--ink2"), width: 2, dash: "dot" }, marker: { size: 7, symbol: "diamond" }, hovertemplate: "Residents: %{y:.1%}<extra></extra>" },
  ], layout({ barmode: "group", bargap: 0.2, margin: M0, xaxis: { type: "category", tickangle: 0 }, yaxis: { tickformat: ".0%" } }));
  $("byBandSub").textContent = `Share of each group living in ${ST_UNIT[byState]} at each level of median household income. Bars above the dotted line mean the group is over-represented there. ${P.areas.toLocaleString()} areas.`;
  draw("c-by-rate", grp.map(([k, nme, c]) => ({ x: P.bands, y: P.per1k_by_band[k], mode: "lines+markers", name: nme, line: line(c(), 2.6), marker: { size: 7 }, hovertemplate: `${nme}: %{y:.2f} per 1,000<extra></extra>` })),
    layout({ margin: M0, xaxis: { type: "category", tickangle: 0 }, yaxis: { type: "log", tickformat: ",.2f", title: { text: "per 1,000 residents (log scale)", font: { size: 11, color: css("--muted") } } } }));
  const cols = [...BR.map(([k, n]) => [k, n]), ["other_ev", "Other EVs"], ["population", "All residents"]];
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
  draw("c-by-cty", BR.map(([k, nme, c]) => ({ y: ord.map((i) => W.county[i]), x: ord.map((i) => W[`${k}_per1k`][i]), type: "bar", orientation: "h", name: nme, marker: { color: c() }, hovertemplate: `${nme}: %{x:.2f} per 1,000<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.2, hovermode: "y unified", margin: M0, xaxis: { showgrid: true, showline: false }, yaxis: { automargin: true } }));
  const Y = O.wa_bev_share_by_model_year;
  draw("c-by-my", BR.map(([k, nme, c]) => ({ x: Y.years.map(String), y: Y[k], mode: "lines+markers", name: nme, line: line(c(), 2.6), marker: { size: 7 }, hovertemplate: `${nme}: %{y:.1%}<extra></extra>` })),
    layout({ margin: M0, xaxis: { type: "category", tickangle: 0 }, yaxis: { tickformat: ".0%", rangemode: "tozero" } }));
  $("byNote").innerHTML = `Registrations: <a href="${RS.meta.sources.ca}">California DMV</a> (light-duty battery-electric and plug-in hybrid vehicles by ZIP, as of ${O.snapshots.ca}), <a href="${RS.meta.sources.wa}">Washington DOL</a> (current, by census tract), <a href="${RS.meta.sources.ny}">New York DMV</a> (current, by ZIP) and <a href="${RS.meta.sources.ct}">Connecticut DMV</a> (by town, as of ${O.snapshots.ct}; ${fmt.pct(O.ct_town_match, 0)} of registrations name a town that matches a Census town, the rest use village names). ZIP codes are matched to ZIP code tabulation areas. Area statistics: U.S. Census Bureau, ${esc2(O.acs_release)}, via <a href="${RS.meta.sources.acs}">Census Reporter</a>. These are neighbourhood averages, so they cannot say how old or rich an individual owner is. Leased and fleet vehicles are registered where the lessor or fleet is based.`;
}

// ---------------------------------------------------------------- quality & safety
function renderCustomers() {
  if (!RS) return;
  const F = researchFacts(), C = RS.customers, yrs = [...new Set(Object.values(C.recalls_by_year).flatMap((o) => Object.keys(o)))].sort();
  const yr = new Date().getFullYear();
  $("cuTiles").innerHTML = [
    coTile("Recall campaigns since 2019", (k) => [String(C.recall_campaigns[k] ?? 0)], "all models (NHTSA)"),
    coTile("Recalls fixable over the air", (k) => [C.recall_ota_share[k] == null ? "n/a" : fmt.pct(C.recall_ota_share[k], 0)], "no service visit needed"),
    coTile("Complaints per 10,000 sold, model year 2024", (k) => [F.rate(k, 2024)?.toFixed(1) ?? "n/a"], "lower is better"),
    coTile("Longest EPA range", (k) => [F.best(k) ? `${F.best(k).range_max} mi` : "n/a"], BR.map(([k]) => F.best(k)?.model).filter(Boolean).join(" · ")),
  ].join("");
  const specs = [...C.epa].sort((a, b) => BR.findIndex(([k]) => k === a.make) - BR.findIndex(([k]) => k === b.make) || b.range_max - a.range_max);
  $("cuSpecs").innerHTML = `<thead><tr><th>Model</th><th>Type</th><th class="n">Model year</th><th class="n">Versions</th><th class="n">EPA range (mi)</th><th class="n">Best kWh/100 mi</th><th class="n">Best MPGe</th></tr></thead><tbody>` +
    specs.map((s) => `<tr><td><span class="dotk" style="background:${coColor(s.make)}"></span><b>${CO_NAME[s.make]} ${esc2(s.model)}</b></td><td>${esc2(s.class)}</td><td class="n">${s.year}</td><td class="n">${s.versions}</td><td class="n">${s.range_min === s.range_max ? s.range_max : `${s.range_min}–${s.range_max}`}</td><td class="n">${s.kwh_per_100mi_best.toFixed(1)}</td><td class="n">${s.mpge_best}</td></tr>`).join("") + "</tbody>";
  const sp = [...specs].sort((a, b) => a.range_max - b.range_max), lab = sp.map((s) => `${CO_NAME[s.make]} ${s.model}`);
  draw("c-cu-range", [{ y: lab, x: sp.map((s) => Math.max(s.range_max - s.range_min, 4)), base: sp.map((s) => (s.range_max - s.range_min < 4 ? s.range_max - 2 : s.range_min)), type: "bar", orientation: "h", marker: { color: sp.map((s) => coColor(s.make)) }, customdata: sp.map((s) => [s.range_min, s.range_max]), hovertemplate: "%{y}: %{customdata[0]} to %{customdata[1]} miles<extra></extra>", text: sp.map((s) => `${s.range_max} mi`), textposition: "outside", cliponaxis: false }],
    layout({ margin: { l: 8, r: 50, t: 8, b: 8 }, showlegend: false, hovermode: "closest", bargap: 0.35, xaxis: { showgrid: true, showline: false, rangemode: "tozero", ticksuffix: " mi" }, yaxis: { automargin: true } }));
  const star = (v) => (/^\d$/.test(String(v)) ? "★".repeat(+v) + `<span class="muted">${"★".repeat(5 - v)}</span>` : "<span class=\"muted\">not rated</span>");
  const rated = new Set(C.ncap.map((x) => x.make)), unrated = BR.filter(([k]) => !rated.has(k)).map(([, n]) => n);
  $("cuNcap").innerHTML = `<thead><tr><th>Model</th><th class="n">Year</th><th>Overall</th><th>Front</th><th>Side</th><th>Rollover</th></tr></thead><tbody>` +
    [...C.ncap].sort((a, b) => a.make.localeCompare(b.make)).map((x) => `<tr><td><span class="dotk" style="background:${coColor(x.make)}"></span><b>${CO_NAME[x.make]} ${esc2(x.model)}</b></td><td class="n">${x.model_year}</td><td class="stars">${star(x.overall)}</td><td class="stars">${star(x.frontal)}</td><td class="stars">${star(x.side)}</td><td class="stars">${star(x.rollover)}</td></tr>`).join("") +
    (unrated.length ? `<tr><td colspan="6" class="muted-row">${unrated.join(" and ")}: no NHTSA five-star rating published yet.</td></tr>` : "") + "</tbody>";
  const cr = C.complaint_rates.filter((x) => x.model_year >= yr - 3 && x.model_year < yr && x.sold >= 1000).sort((a, b) => a.per10k - b.per10k);
  draw("c-cu-rate", [{ y: cr.map((x) => `${x.model} · MY${x.model_year}`), x: cr.map((x) => x.per10k), type: "bar", orientation: "h", marker: { color: cr.map((x) => coColor(x.make)) }, customdata: cr.map((x) => [x.complaints, x.sold]), text: cr.map((x) => x.per10k.toFixed(1)), textposition: "outside", cliponaxis: false, hovertemplate: "%{y}: %{x:.1f} per 10,000 (%{customdata[0]} complaints, %{customdata[1]:,} sold)<extra></extra>" }],
    layout({ margin: { l: 8, r: 40, t: 8, b: 8 }, showlegend: false, hovermode: "closest", bargap: 0.3, xaxis: { showgrid: true, showline: false, rangemode: "tozero" }, yaxis: { automargin: true } }));
  $("cuRateSub").textContent = "NHTSA owner complaints for each model year, per 10,000 of that model sold in the U.S. in the same calendar year (Cox). Newer model years have had less time on the road, so compare within a year. Models with under 1,000 sales are left out.";
  draw("c-cu-rec", BR.map(([k, nme, c]) => ({ x: yrs, y: yrs.map((y) => C.recalls_by_year[k]?.[y] ?? 0), type: "bar", name: nme, marker: { color: c() }, hovertemplate: `${nme} %{x}: %{y} campaigns<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.25, margin: M0, xaxis: { type: "category", tickangle: 0 }, yaxis: { dtick: 5 } }));
  $("cuRecSub").textContent = `Recall campaigns filed with NHTSA each year. One campaign can cover many vehicles and model years, and many are fixed by a software update rather than a service visit.`;
  const compChart = (id, obj) => {
    const tot = (k) => sum(Object.values(obj[k] || {})) || 1, keys = [...new Set(BR.flatMap(([k]) => Object.keys(obj[k] || {}).slice(0, 5)))];
    const weight = (x) => sum(BR.map(([k]) => (obj[k]?.[x] || 0) / tot(k)));
    keys.sort((a, b) => weight(a) - weight(b));
    draw(id, BR.map(([k, nme, c]) => ({ y: keys, x: keys.map((x) => (obj[k]?.[x] || 0) / tot(k)), type: "bar", orientation: "h", name: nme, marker: { color: c() }, hovertemplate: `${nme}: %{x:.0%}<extra></extra>` })),
      layout({ barmode: "group", bargap: 0.2, hovermode: "y unified", margin: M0, xaxis: { tickformat: ".0%", showgrid: true, showline: false }, yaxis: { automargin: true } }));
  };
  compChart("c-cu-ccomp", C.complaint_components); compChart("c-cu-rcomp", C.recall_components);
  $("cuNote").innerHTML = `Sources: <a href="${RS.meta.sources.nhtsa}">NHTSA</a> recalls, complaints and NCAP ratings; <a href="${RS.meta.sources.epa}">EPA fueleconomy.gov</a>; sales denominators from Cox Automotive. Complaints are owner reports that NHTSA has not verified. ${BR.map(([k, n]) => `${(C.complaints_total[k] ?? 0).toLocaleString()} ${n}`).join(", ")} complaints are on file across the model years shown. Charging networks are compared on the Head to head tab.`;
}

// ---------------------------------------------------------------- sentiment
function renderSentiment() {
  if (!RS) return;
  const F = researchFacts(), S = RS.sentiment, C = RS.customers.complaints_monthly;
  const cv = (co) => (S[co] ? mean(S[co].share_per_million.slice(-12).filter(ok)) : NaN);
  const HAS = BR.filter(([k]) => S[k]), HASV = HAS.filter(([k]) => S[k].share_per_million.some(ok));
  const comp12 = (k) => sum((C[k] || []).slice(-12));
  draw("c-se-comp", BR.map(([k, nme, c]) => ({ x: C.months.map((m) => m + "-01"), y: C[k] || C.months.map(() => 0), type: "bar", name: nme, marker: { color: c() }, hovertemplate: `${nme}: %{y}<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.15, margin: M0, xaxis: { type: "date" }, yaxis: { rangemode: "tozero" } }));
  $("c-se-tone").closest("article").hidden = !HAS.length; $("c-se-vol").closest("article").hidden = !HASV.length;
  $("seTiles").innerHTML = [
    coTile("News tone, last 12 months", (k) => { const t = F.tone(k); return t ? [t.last.toFixed(2), deltaChip(t.last - t.prev, numTxt("", 2))] : ["pending"]; }, "vs prior 12 months; 0 is neutral"),
    coTile("News coverage, last 12 months", (k) => [ok(cv(k)) ? `${fmt.int(cv(k))}` : "pending"], "articles per million monitored"),
    coTile("Owner complaints, last 12 months", (k) => [fmt.intC(comp12(k))], "filed with NHTSA"),
  ].join("");
  if (!HAS.length) { $("seNote").textContent = "News tone from GDELT could not be fetched at the last build; it will appear after the next successful refresh."; return; }
  draw("c-se-tone", [
    ...HAS.map(([k, nme, c]) => ({ x: S[k].months.map((m) => m + "-01"), y: S[k].tone, mode: "markers", name: `${nme} monthly`, showlegend: false, marker: { size: 5, color: rgba(c(), 0.35) }, hoverinfo: "skip" })),
    ...HAS.map(([k, nme, c]) => ({ x: S[k].months.map((m) => m + "-01"), y: rolling(S[k].tone, 3).map((v, i) => (i >= 2 ? v : null)), mode: "lines", name: nme, line: line(c(), 2.6), hovertemplate: `${nme}: %{y:.2f}<extra></extra>` })),
  ], layout({ margin: M0, xaxis: { type: "date" }, yaxis: { zeroline: true, zerolinecolor: css("--axis"), title: { text: "average tone (negative to positive)", font: { size: 11, color: css("--muted") } } },
    shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: css("--axis"), width: 1 } }] }));
  const missing = BR.filter(([k]) => !S[k]).map(([, n]) => n);
  $("seToneSub").textContent = `GDELT scores the wording of every English-language online news article it monitors from very negative to very positive; this is the monthly average for articles mentioning each company, with a 3-month line. Most business news sits slightly below zero.${missing.length ? ` ${missing.join(" and ")}: not fetched yet.` : ""}`;
  if (HASV.length) draw("c-se-vol", HASV.map(([k, nme, c]) => ({ x: S[k].months.map((m) => m + "-01"), y: S[k].share_per_million, mode: "lines", name: nme, line: line(c(), 2.4), hovertemplate: `${nme}: %{y:,.0f} per million<extra></extra>` })),
    layout({ margin: M0, xaxis: { type: "date" }, yaxis: { type: "log", tickformat: ",.0f" } }));
  $("seNote").innerHTML = `Sources: <a href="${RS.meta.sources.gdelt}">The GDELT Project</a> (DOC 2.0 API, English-language sources; Tesla articles must also mention cars, EVs, Musk or Cybertruck, to leave out Nikola Tesla; Lucid articles must name Lucid Motors, Lucid Group, the Air or the Gravity, since "lucid" is an ordinary word), <a href="${RS.meta.sources.nhtsa}">NHTSA complaints</a>. Wikipedia attention is on the Head to head tab. Tone measures how the news is written, not what buyers think, and spikes with events such as earnings, recalls and political news about Tesla's chief executive.`;
}

// ---------------------------------------------------------------- investors
function renderInvestors() {
  if (!RS) return;
  const I = RS.investors, t = I.tesla;
  const m = (x, k) => x.ttm[k] / x.ttm.revenue;
  $("ivTiles").innerHTML = [
    coTile("Revenue", (k) => [usd(I[k].ttm.revenue)], `four quarters to ${evQ(t.latest)}`),
    coTile("Net income", (k) => [usd(I[k].ttm.net_income)], "four quarters"),
    coTile("Free cash flow", (k) => [usd(I[k].ttm.fcf)], "operating cash flow minus capital spending"),
    coTile("Cash runway at current burn", (k) => [I[k].runway_quarters ? `${I[k].runway_quarters} quarters` : "cash positive"], "balance-sheet cash ÷ free-cash-flow burn; leaves out undrawn credit lines"),
  ].join("");
  const steps = [["Gross margin", "gross_profit"], ["Operating margin", "operating_income"], ["Net margin", "net_income"], ["Free cash flow margin", "fcf"]];
  draw("c-iv-wf", BR.map(([k, nme, c]) => ({ x: steps.map(([l]) => l), y: steps.map(([, f]) => m(I[k], f)), type: "bar", name: nme, marker: { color: c() }, customdata: steps.map(([, f]) => usd(I[k].ttm[f])), text: steps.map(([, f]) => fmt.pct(m(I[k], f), 0)), textposition: "outside", cliponaxis: false, hovertemplate: `${nme} %{x}: %{y:.1%} (%{customdata})<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.25, margin: M0, xaxis: { type: "category" }, yaxis: { tickformat: ".0%", zeroline: true, zerolinecolor: css("--axis") } }));
  $("ivWfSub").textContent = `Each line of the income statement as a share of revenue, so companies of very different sizes (${BR.map(([k, n]) => `${n} ${usd(I[k].ttm.revenue)}`).join(", ")}) can sit on one chart. Hover for dollar amounts.`;
  const per = [["Revenue", "revenue"], ["Gross profit", "gross_profit"], ["Net income", "net_income"]];
  draw("c-iv-unit", BR.map(([k, nme, c]) => ({ x: per.map(([l]) => l), y: per.map(([, f]) => (I[k].ttm[f] * 1e6) / I[k].ttm.deliveries), type: "bar", name: nme, marker: { color: c() }, text: per.map(([, f]) => usdK((I[k].ttm[f] * 1e6) / I[k].ttm.deliveries)), textposition: "outside", cliponaxis: false, hovertemplate: `${nme} %{x}: $%{y:,.0f} per vehicle<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.25, margin: M0, xaxis: { type: "category" }, yaxis: { tickprefix: "$", tickformat: ",.0f", zeroline: true, zerolinecolor: css("--axis") } }));
  const qs = [...new Set(BR.flatMap(([k]) => I[k].quarters))].filter((q) => q >= "2021-01").sort(), ix = (x, k) => qs.map((q) => { const i = x.quarters.indexOf(q); return i < 0 || x[k][i] == null ? null : x[k][i] / 1e3; });
  const qbars = (id, k) => draw(id, BR.map(([kk, nme, c]) => ({ x: qs.map(evQ), y: ix(I[kk], k), type: "bar", name: nme, marker: { color: c() }, hovertemplate: `${nme} %{x}: $%{y:.2f}B<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.2, margin: M0, xaxis: qTicks(qs), yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f", zeroline: true, zerolinecolor: css("--axis") } }));
  qbars("c-iv-ni", "net_income"); qbars("c-iv-fcf", "fcf");
  draw("c-iv-cash", [
    ...BR.map(([k, nme, c]) => ({ x: qs.map(evQ), y: ix(I[k], "liquidity"), mode: "lines+markers", name: `${nme} cash and investments`, line: line(c(), 2.6), marker: { size: 5 }, hovertemplate: `${nme} cash: $%{y:.1f}B<extra></extra>` })),
    ...BR.map(([k, nme, c]) => ({ x: qs.map(evQ), y: ix(I[k], "debt"), mode: "lines", name: `${nme} debt`, connectgaps: true, line: { color: c(), width: 2, dash: "dot" }, hovertemplate: `${nme} debt: $%{y:.1f}B<extra></extra>` })),
  ], layout({ margin: M0, legend: { y: 1.3 }, xaxis: qTicks(qs), yaxis: { tickprefix: "$", ticksuffix: "B", tickformat: ".0f", rangemode: "tozero" } }));
  $("ivCashSub").textContent = "Cash and equivalents plus short-term investments (solid) against debt excluding leases (dotted), at each quarter end.";
  const ox = [["R&D", "rnd"], ["Selling, general and admin", "sga"], ["Stock-based pay", "sbc"]];
  draw("c-iv-opex", BR.map(([k, nme, c]) => ({ x: ox.map(([l]) => l), y: ox.map(([, f]) => m(I[k], f)), type: "bar", name: nme, marker: { color: c() }, text: ox.map(([, f]) => fmt.pct(m(I[k], f), 0)), textposition: "outside", cliponaxis: false, hovertemplate: `${nme} %{x}: %{y:.1%} of revenue<extra></extra>` })),
    layout({ barmode: "group", bargap: 0.25, margin: M0, xaxis: { type: "category" }, yaxis: { tickformat: ".0%", rangemode: "tozero" } }));
  const base = qs.filter((q) => q >= "2023-01").find((q) => BR.every(([k]) => { const i = I[k].quarters.indexOf(q); return i >= 0 && I[k].shares[i] != null; }));
  draw("c-iv-shares", BR.map(([k, nme, c]) => { const b = I[k].shares[I[k].quarters.indexOf(base)]; return { x: qs.map(evQ), y: qs.map((q) => { const i = I[k].quarters.indexOf(q); return i < 0 || I[k].shares[i] == null || q < base ? null : (I[k].shares[i] / b) * 100; }), mode: "lines+markers", name: nme, connectgaps: true, line: line(c(), 2.6), marker: { size: 5 }, hovertemplate: `${nme}: %{y:.0f}<extra></extra>` }; }),
    layout({ margin: M0, xaxis: qTicks(qs), yaxis: { tickformat: ".0f" } }));
  $("ivShSub").textContent = `Common shares outstanding at each quarter end, indexed to ${evQ(base)} = 100 and adjusted for stock splits (Tesla's 3-for-1 in 2022, Lucid's 1-for-10 reverse split in 2025). A rising line means existing holders own a smaller slice.`;
  const pf = (x) => x.public_float.at(-1);
  const rows = [
    ["Revenue, last 4 quarters", (x) => usd(x.ttm.revenue)], ["Gross margin", (x) => fmt.pct(m(x, "gross_profit"))], ["Operating margin", (x) => fmt.pct(m(x, "operating_income"))],
    ["Net income", (x) => usd(x.ttm.net_income)], ["Free cash flow", (x) => usd(x.ttm.fcf)], ["Vehicles delivered", (x) => fmt.int(x.ttm.deliveries)],
    ["Gross profit per vehicle", (x) => usdK(x.gp_per_vehicle)], ["Deliveries a year to cover operating costs at that gross profit", (x) => (x.breakeven_deliveries ? fmt.int(x.breakeven_deliveries) : "not reachable while gross profit is negative")],
    ["Cash and short-term investments", (x) => usd(x.liquidity.at(-1))], ["Debt (excluding leases)", (x) => (x.debt.filter(ok).length ? usd(x.debt.filter(ok).at(-1)) : "n/a")],
    ["Cash runway at current burn", (x) => (x.runway_quarters ? `${x.runway_quarters} quarters` : "cash positive")],
    ["R&D as share of revenue", (x) => fmt.pct(m(x, "rnd"))], ["Stock-based pay as share of revenue", (x) => fmt.pct(m(x, "sbc"))],
    ["Share count change, 3 years", (x) => (x.share_growth_3y != null ? pctTxt(x.share_growth_3y) : "n/a")],
    ["Public float (10-K cover page)", (x) => (pf(x) ? `${usd(pf(x).value)} at ${pf(x).date}` : "n/a")], ["Public float to trailing sales", (x) => (x.float_to_sales ? `${x.float_to_sales}×` : "n/a")],
  ];
  $("ivTable").innerHTML = `<thead><tr><th>Measure</th>${BR.map(([, n, c]) => `<th class="n"><span class="dotk" style="background:${c()}"></span>${n}</th>`).join("")}</tr></thead><tbody>` + rows.map(([l, f]) => `<tr><td><b>${l}</b></td>${BR.map(([k]) => `<td class="n">${f(I[k])}</td>`).join("")}</tr>`).join("") + "</tbody>";
  $("ivNote").innerHTML = `Source: <a href="${RS.meta.sources.sec}">SEC EDGAR</a> company facts (10-Q and 10-K). Quarterly figures not reported directly are derived from year-to-date totals; Lucid files cost of revenue rather than gross profit, so its gross profit is revenue minus cost of revenue. Operating costs are gross profit minus operating income. Cash runway counts balance-sheet cash and short-term investments only; companies' own "total liquidity" also counts undrawn credit lines (Lucid's include a facility from its majority owner, Saudi Arabia's Public Investment Fund), so their runway is longer than this measure if those lines are drawn. Deliveries are company-reported. <b>This is not investment advice.</b>`;
}
