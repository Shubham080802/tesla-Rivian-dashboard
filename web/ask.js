// "Ask the dashboard": suggested questions and keyword search, answered from the same numbers as the charts. No language model, no guessing.
const ASK_Q = [
  { id: "vol", q: "Who sold more vehicles?", kw: ["sold", "sales", "volume", "more vehicles", "bigger", "units", "deliver"] },
  { id: "growth", q: "Who is growing faster?", kw: ["growing", "growth", "faster", "momentum"] },
  { id: "profit", q: "Who makes more money?", kw: ["profit", "money", "margin", "earn", "income", "revenue"] },

  { id: "where", q: "Where do they sell?", kw: ["where", "china", "europe", "regions", "domestic", "home market", "registrations", "markets"] },
  { id: "riv", q: "How is Rivian doing?", kw: ["rivian", "r2", "r1s", "r1t"] },
  { id: "luc", q: "How is Lucid doing?", kw: ["lucid", "gravity", "lucid air"] },
  { id: "tsl", q: "What is the outlook for Tesla deliveries?", kw: ["tesla outlook", "tesla forecast", "tesla deliveries", "tesla next"] },
  { id: "rivo", q: "What is the outlook for Rivian deliveries?", kw: ["rivian outlook", "rivian forecast", "rivian next", "r2 ramp"] },
  { id: "share", q: "How do they share the U.S. market?", kw: ["market share", "share of", "u s market", "us market", "america", "united states"] },
  { id: "who", q: "Who buys a Tesla or a Rivian?", kw: ["who buys", "buyer", "demographic", "income", "rich", "age", "customer profile", "owners"] },
  { id: "safe", q: "Which is safer and more reliable?", kw: ["safe", "safety", "recall", "crash", "complaint", "reliable", "problem"] },
  { id: "mood", q: "What is the sentiment around them?", kw: ["sentiment", "tone", "news", "feel", "opinion", "reputation", "perception"] },
  { id: "cash", q: "How long can Rivian keep funding itself?", kw: ["cash", "runway", "burn", "funding", "debt", "dilution", "loss"] },
  { id: "track", q: "Is the latest quarter on track?", kw: ["on track", "latest month", "latest quarter", "pulse", "behind", "ahead"] },
  { id: "drive", q: "Do gas prices or interest rates drive sales?", kw: ["gas", "gasoline", "interest", "rate", "driver", "macro", "sentiment"] },
  { id: "fresh", q: "How current is the data?", kw: ["current", "fresh", "up to date", "latest data", "how old", "updated"] },
  { id: "gaps", q: "What data is missing?", kw: ["missing", "gap", "limit", "cannot", "not included", "caveat"] },
];
const ASK_OUT = [
  { re: /\b(stock|share price|shares|invest|should i (buy|sell)|trade|price target|worth buying|dividend)\b/i, why: "I can't give investment advice or stock forecasts. The Investors tab shows the companies' profit, cash and dilution from their filings, which is evidence, not advice." },
  { re: /\b(review|rating|satisf|complain|reliab|quality|nps|owner)/i, why: "There is no open customer-review or satisfaction dataset for Tesla, Rivian or Lucid, so the dashboard has none. The 'What data is missing?' answer lists the other gaps." },
  { re: /\b(nvidia|google|apple|ford|toyota|volkswagen|gm|nio|xpeng|waymo|amazon)\b/i, why: "This dashboard compares Tesla, Rivian and Lucid only, three U.S.-listed EV makers that report to the SEC. Companies listed outside the U.S. are not covered." },
  { re: /\b(202[7-9]|20[3-9]\d)\b/, why: "Forecasts here run about a year (four to six quarters ahead). Use the Forecast lab for the horizon each series supports." },
];
const askNorm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function askAnswer(id) {
  if (!LAB) buildLab();
  const T = EV.tesla.quarters, R = EV.rivian.quarters, LQ = EV.lucid.quarters, F_ = VS.fin, Y = F_.years, i = Y.length - 1, y = Y[i];
  const d4 = (Q, a, b) => sum(Q.slice(a, b).map((r) => r.deliveries)), co3 = [["Tesla", T, "tesla"], ["Rivian", R, "rivian"], ["Lucid", LQ, "lucid"]];
  const t12 = d4(T, -4), r12 = d4(R, -4), l12 = d4(LQ, -4);
  const L = (k) => LAB.find((s) => s.id === k);
  const list = (f) => co3.map(([n, Q, k]) => `${n} ${f(Q, k)}`).join(", ");
  const A = {
    vol: () => [`Over the last 4 quarters Tesla delivered <b>${fmt.intC(t12)}</b> vehicles, Rivian <b>${fmt.intC(r12)}</b> and Lucid <b>${fmt.intC(l12)}</b>: Tesla delivered about ${Math.round(t12 / r12)}× as many as Rivian and ${Math.round(t12 / l12)}× as many as Lucid. All three are battery-electric only.`, "Head to head", "versus"],
    growth: () => [`Deliveries vs the prior 4 quarters: ${list((Q) => `<b>${pctTxt(d4(Q, -4) / d4(Q, -8, -4) - 1)}</b>`)}. Revenue growth in ${y}: ${list((Q, k) => pctTxt(F_[k].revenue[i] / F_[k].revenue[i - 1] - 1))}.`, "Head to head", "versus"],
    profit: () => [`Net income in ${y}: ${list((Q, k) => `<b>${fmt.usdB(F_[k].net_income[i])}</b> (${fmt.pct(F_[k].net_income[i] / F_[k].revenue[i], 0)} of revenue)`)}. Only Tesla is profitable; all figures are from 10-K filings, in US dollars.`, "Head to head", "versus"],
    where: () => { if (!RG) return ["Regional data is not loaded.", "About", "quality"]; const tc = RG.tesla_china, n = tc.months.length - 1, ex = tc.exports[n] / (tc.exports[n] + tc.domestic[n]), eu = RG.europe, last = eu.months.length - 1;
      return [`In ${fmt.month(tc.months[n])}, Tesla's China wholesale was <b>${fmt.int(tc.domestic[n] + tc.exports[n])}</b>, of which <b>${fmt.pct(ex, 0)}</b> was exported from Shanghai. In Europe (EU, EFTA and UK), Tesla registered <b>${fmt.int(eu.tesla[last])}</b> cars in ${fmt.month(eu.months[last])}, from ACEA. Rivian and Lucid sell mostly in North America.`, "Market share", "market"]; },
    riv: () => { const s = LAB.find((x) => x.id === "riv_del"), R = EV.rivian.quarters, l = R.at(-1), p = R.at(-5), f = R.filter((r) => r.revenue != null).at(-1);
      return [`Rivian delivered <b>${fmt.intC(l.deliveries)}</b> vehicles in ${evQ(l.q)} (${pctTxt(l.deliveries / p.deliveries - 1)} vs a year earlier) and is expected to deliver about <b>${fmt.intC(s.d.fc12)}</b> over the next 4 quarters (range ${fmt.intC(s.d.lo)} to ${fmt.intC(s.d.hi)}; reliability ${s.d.grade.toLowerCase()}). Revenue in ${evQ(f.q)} was ${fmt.usdB(f.revenue)} with a ${fmt.pct(f.net_income / f.revenue)} net margin: it is still loss-making.`, "Sales", "ev"]; },
    tsl: () => { const s = L("tsl_del"); return [`Tesla is expected to deliver about <b>${fmt.intC(s.d.fc12)}</b> over the next 4 quarters (range ${fmt.intC(s.d.lo)} to ${fmt.intC(s.d.hi)}), vs ${fmt.intC(s.d.last12)} in the last 4. Chance of growth: ${fmt.pct(s.d.pGrowth, 0)}. Reliability: ${s.d.grade.toLowerCase()}.`, "Forecast lab", "lab", "tsl_del"]; },
    luc: () => { const s = L("luc_del"), l = LQ.at(-1), p = LQ.at(-5), f = LQ.filter((r) => r.revenue != null).at(-1);
      return [`Lucid delivered <b>${fmt.intC(l.deliveries)}</b> vehicles in ${evQ(l.q)} (${pctTxt(l.deliveries / p.deliveries - 1)} vs a year earlier) and is expected to deliver about <b>${fmt.intC(s.d.fc12)}</b> over the next 4 quarters (range ${fmt.intC(s.d.lo)} to ${fmt.intC(s.d.hi)}). Revenue in ${evQ(f.q)} was ${fmt.usdB(f.revenue)} with a ${fmt.pct(f.gross_profit / f.revenue, 0)} gross margin: it still sells each car below cost.`, "Sales", "ev"]; },
    rivo: () => { const s = L("riv_del"); return [`Rivian is expected to deliver about <b>${fmt.intC(s.d.fc12)}</b> over the next 4 quarters (range ${fmt.intC(s.d.lo)} to ${fmt.intC(s.d.hi)}), vs ${fmt.intC(s.d.last12)} in the last 4. Chance of growth: ${fmt.pct(s.d.pGrowth, 0)}. Reliability: ${s.d.grade.toLowerCase()}; the history is short.`, "Forecast lab", "lab", "riv_del"]; },
    share: () => { if (!RS) return ["Market data is not loaded.", "About", "quality"]; const M = RS.market, n = M.quarters.length - 1; return [`In ${evQ(M.quarters[n])} Tesla sold <b>${fmt.pct(M.tesla[n] / M.total_ev[n], 1)}</b> of new EVs in the U.S., Rivian <b>${fmt.pct(M.rivian[n] / M.total_ev[n], 1)}</b> and Lucid <b>${fmt.pct(M.lucid[n] / M.total_ev[n], 1)}</b>, out of ${fmt.intC(M.total_ev[n])} EVs in all (Cox Automotive estimates).`, "Market share", "market"]; },
    who: () => { if (!RS) return ["Owner data is not loaded.", "About", "quality"]; const p = RS.owners.all.profile; return [`Registration records only show where cars are kept. Across California, Washington, New York and Connecticut, Lucids are registered in areas with a median household income of <b>${usdK(p.lucid.income_median)}</b>, Rivians <b>${usdK(p.rivian.income_median)}</b> and Teslas <b>${usdK(p.tesla.income_median)}</b>, against ${usdK(p.population.income_median)} for all residents; ${fmt.pct(p.lucid.bachelor_plus, 0)} of adults in Lucid areas hold a degree (all residents ${fmt.pct(p.population.bachelor_plus, 0)}).`, "Who buys", "buyers"]; },
    safe: () => { if (!RS) return ["Customer data is not loaded.", "About", "quality"]; const C = RS.customers; return [`${C.ncap.filter((x) => x.overall === 5).map((x) => `${({ tesla: "Tesla", rivian: "Rivian", lucid: "Lucid" })[x.make]} ${x.model}`).join(", ") || "No model"} carry NHTSA's five-star overall rating. Recall campaigns since 2019: Tesla ${C.recall_campaigns.tesla}, Rivian ${C.recall_campaigns.rivian}, Lucid ${C.recall_campaigns.lucid ?? 0}; fixable over the air: ${fmt.pct(C.recall_ota_share.tesla, 0)}, ${fmt.pct(C.recall_ota_share.rivian, 0)} and ${fmt.pct(C.recall_ota_share.lucid ?? 0, 0)}. Complaint rates per 10,000 sold are on the Quality & safety tab.`, "Quality & safety", "customers"]; },
    mood: () => { if (!RS || !RS.sentiment.tesla) return ["News tone is not loaded yet.", "Sentiment", "sentiment"]; const S = RS.sentiment, a = (k) => (S[k] ? mean(S[k].tone.slice(-12)).toFixed(2) : "pending"); return [`Average news tone over the last 12 months: Tesla <b>${a("tesla")}</b>, Rivian <b>${a("rivian")}</b>, Lucid <b>${a("lucid")}</b> (GDELT; 0 is neutral, most business news is slightly negative). That measures how coverage is written, not what buyers think.`, "Sentiment", "sentiment"]; },
    cash: () => { if (!RS) return ["Investor data is not loaded.", "About", "quality"]; const I = RS.investors; return [[["rivian", "Rivian"], ["lucid", "Lucid"]].map(([k, n]) => { const x = I[k]; return `${n} held <b>${usd(x.liquidity.at(-1))}</b> in cash and short-term investments at ${evQ(x.latest)} against four-quarter free cash flow of ${usd(x.ttm.fcf)}${x.runway_quarters ? `, about <b>${x.runway_quarters} quarters</b> at that rate` : ""}; its share count rose ${x.share_growth_3y != null ? pctTxt(x.share_growth_3y) : "n/a"} in three years.`; }).join(" ") + " Undrawn credit lines are not counted. Not investment advice.", "Investors", "investors"]; },
    track: () => [LAB.filter((s) => s.id !== "tsl_rev").map((s) => { const m = s.fc.monitor.at(-1), ins = m.actual >= m.lo && m.actual <= m.hi; return `<b>${s.label}</b>: ${labLabel(s, m.month)} was ${fmt.pct(Math.abs(m.actual / m.expected - 1))} ${m.actual >= m.expected ? "above" : "below"} what was expected, ${ins ? "inside" : "outside"} the normal range.`; }).join("<br>"), "Forecast lab", "lab"],
    drive: () => { const n = DR.tests.filter((r) => r.verdict === "Yes").length; return [n ? `${n} U.S. indicator(s) pass the strict test.` : `No U.S. indicator (gasoline price, loan rates, vehicle sales, new-car prices, sentiment, fed funds) passes the strict test of lining up with Tesla, Rivian or Lucid growth. A few show patterns that could be chance, because there are only ${Math.min(...DR.tests.map((r) => r.n))} to ${Math.max(...DR.tests.map((r) => r.n))} overlapping year-over-year points.`, "Drivers", "drivers"]; },
    fresh: () => [`Tesla deliveries to <b>${evQ(T.at(-1).q)}</b>, Tesla financials to <b>${evQ(T.filter((r) => r.revenue != null).at(-1).q)}</b>, Rivian deliveries to <b>${evQ(R.at(-1).q)}</b>, Rivian financials to <b>${evQ(R.filter((r) => r.revenue != null).at(-1).q)}</b>, Lucid deliveries to <b>${evQ(LQ.at(-1).q)}</b>, attention to <b>${fmt.month(VS.meta.pageviews_latest)}</b>.`, "About", "quality"],
    gaps: () => [`No customer reviews or satisfaction surveys (none is open); NHTSA complaints, crash ratings and news tone stand in. Owner demographics are neighbourhood averages from four states (CA, WA, NY, CT), not individual owners. Volumes are quarterly only, since none of the three reports monthly. Share prices are near-live TradingView widgets (up to 15 minutes delayed); the site stores only derived yearly changes. Registrations only for Tesla in China and Europe (ACEA, as first published); Rivian and Lucid sell mostly in North America. Attention is English Wikipedia only. Charging counts only stations open today. Companies listed outside the U.S. are not covered.`, "About", "quality"],
  };
  return A[id]();
}

function initAsk() {
  $("askChips").innerHTML = ASK_Q.map((q) => `<button type="button" class="chipbtn" data-q="${q.id}">${q.q}</button>`).join("");
  const show = (html, label, tab, lab) => {
    const el = $("askAnswer"); el.hidden = false;
    el.innerHTML = `<div class="ask-q">${html}</div>${label ? `<button type="button" class="linkbtn" data-ask-go="${tab}" data-lab="${lab || ""}">Source: ${label} →</button>` : ""}`;
  };
  const run = (id) => { const r = askAnswer(id); show(r[0], r[1], r[2], r[3]); };
  $("askChips").onclick = (e) => { const b = e.target.closest("[data-q]"); if (b) run(b.dataset.q); };
  $("askAnswer").onclick = (e) => { const b = e.target.closest("[data-ask-go]"); if (b) { if (b.dataset.lab) labState.id = b.dataset.lab; goTab(b.dataset.askGo); } };
  $("askInput").onkeydown = (e) => {
    if (e.key !== "Enter") return;
    const t = askNorm($("askInput").value); if (!t) return;
    const out = ASK_OUT.find((o) => o.re.test(t)); if (out) { show(out.why); return; }
    let best = null, score = 0;
    ASK_Q.forEach((q) => { const sc = q.kw.filter((k) => t.includes(k)).length; if (sc > score) { score = sc; best = q; } });
    if (best) run(best.id); else show(`I can answer questions about volumes, growth, profit, market share, who buys, safety, sentiment, cash, where they sell, Rivian, outlooks, whether the latest period is on track, demand drivers, data freshness and data gaps. Try one of the suggestions above.`);
  };
}
// test: every suggested question gives an answer, and every out-of-scope phrase is declined
function selfTestAsk() {
  const bad = [];
  ASK_Q.forEach((q) => { try { if (!askAnswer(q.id)[0]) bad.push(q.id); } catch (e) { bad.push(q.id + ": " + e.message); } });
  ["should I buy tesla stock", "customer reviews of rivian", "what about ford", "sales in 2029"].forEach((t) => { if (!ASK_OUT.some((o) => o.re.test(askNorm(t)))) bad.push("not declined: " + t); });
  return bad;
}
