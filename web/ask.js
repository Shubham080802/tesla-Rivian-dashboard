// "Ask the dashboard": suggested questions and keyword search, answered from the same numbers as the charts. No language model, no guessing.
const ASK_Q = [
  { id: "vol", q: "Who sold more vehicles?", kw: ["sold", "sales", "volume", "more vehicles", "bigger", "units", "deliver"] },
  { id: "growth", q: "Who is growing faster?", kw: ["growing", "growth", "faster", "momentum"] },
  { id: "profit", q: "Who makes more money?", kw: ["profit", "money", "margin", "earn", "income", "revenue"] },

  { id: "where", q: "Where do they sell?", kw: ["where", "china", "europe", "regions", "domestic", "home market", "registrations", "markets"] },
  { id: "riv", q: "How is Rivian doing?", kw: ["rivian", "r2", "r1s", "r1t"] },
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
  { re: /\b(stock|share price|shares|invest|should i (buy|sell)|trade|price target|worth buying|dividend)\b/i, why: "I can't give investment advice or stock forecasts. The Investor view shows the companies' profit, cash and dilution from their filings, which is evidence, not advice." },
  { re: /\b(review|rating|satisf|complain|reliab|quality|nps|owner)/i, why: "There is no open customer-review or satisfaction dataset for Tesla or Rivian, so the dashboard has none. The 'What data is missing?' answer lists the other gaps." },
  { re: /\b(byd|nvidia|google|apple|ford|toyota|volkswagen|gm|nio|xpeng|lucid|waymo|amazon)\b/i, why: "This dashboard compares Tesla and Rivian only, two U.S.-listed EV makers that report to the SEC. Companies listed outside the U.S. are not covered." },
  { re: /\b(202[7-9]|20[3-9]\d)\b/, why: "Forecasts here run about a year (four to six quarters ahead). Use the Forecast lab for the horizon each series supports." },
];
const askNorm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function askAnswer(id) {
  if (!LAB) buildLab();
  const T = EV.tesla.quarters, R = EV.rivian.quarters, F_ = VS.fin, Y = F_.years, i = Y.length - 1, y = Y[i];
  const t12 = sum(T.slice(-4).map((r) => r.deliveries)), t12p = sum(T.slice(-8, -4).map((r) => r.deliveries)), r12 = sum(R.slice(-4).map((r) => r.deliveries)), r12p = sum(R.slice(-8, -4).map((r) => r.deliveries));
  const L = (k) => LAB.find((s) => s.id === k);
  const A = {
    vol: () => [`Over the last 4 quarters Tesla delivered <b>${fmt.intC(t12)}</b> vehicles and Rivian <b>${fmt.intC(r12)}</b>, so Tesla delivered about ${Math.round(t12 / r12)}× as many. Both are battery-electric only.`, "Head to head", "versus"],
    growth: () => [`Rivian's deliveries are <b>${pctTxt(r12 / r12p - 1)}</b> vs the prior 4 quarters; Tesla's are <b>${pctTxt(t12 / t12p - 1)}</b>. In ${y}, revenue grew ${pctTxt(F_.tesla.revenue[i] / F_.tesla.revenue[i - 1] - 1)} at Tesla and ${pctTxt(F_.rivian.revenue[i] / F_.rivian.revenue[i - 1] - 1)} at Rivian.`, "Head to head", "versus"],
    profit: () => [`In ${y}, Tesla earned <b>${fmt.usdB(F_.tesla.net_income[i])}</b> (${fmt.pct(F_.tesla.net_income[i] / F_.tesla.revenue[i])} of revenue) while Rivian lost <b>${fmt.usdB(-F_.rivian.net_income[i])}</b> (${fmt.pct(F_.rivian.net_income[i] / F_.rivian.revenue[i])}). Both figures are from 10-K filings, in US dollars.`, "Head to head", "versus"],

    where: () => { if (!RG) return ["Regional data is not loaded.", "About the data", "quality"]; const tc = RG.tesla_china, n = tc.months.length - 1, ex = tc.exports[n] / (tc.exports[n] + tc.domestic[n]), eu = RG.europe, last = eu.months.length - 1;
      return [`In ${fmt.month(tc.months[n])}, Tesla's China wholesale was <b>${fmt.int(tc.domestic[n] + tc.exports[n])}</b>, of which <b>${fmt.pct(ex, 0)}</b> was exported from Shanghai. In Europe (EU, EFTA and UK), Tesla registered <b>${fmt.int(eu.tesla[last])}</b> cars in ${fmt.month(eu.months[last])}, from ACEA. Rivian sells almost only in North America.`, "Where they sell", "regions"]; },
    riv: () => { const s = LAB.find((x) => x.id === "riv_del"), R = EV.rivian.quarters, l = R.at(-1), p = R.at(-5), f = R.filter((r) => r.revenue != null).at(-1);
      return [`Rivian delivered <b>${fmt.intC(l.deliveries)}</b> vehicles in ${evQ(l.q)} (${pctTxt(l.deliveries / p.deliveries - 1)} vs a year earlier) and is expected to deliver about <b>${fmt.intC(s.d.fc12)}</b> over the next 4 quarters (range ${fmt.intC(s.d.lo)} to ${fmt.intC(s.d.hi)}; reliability ${s.d.grade.toLowerCase()}). Revenue in ${evQ(f.q)} was ${fmt.usdB(f.revenue)} with a ${fmt.pct(f.net_income / f.revenue)} net margin: it is still loss-making.`, "Sales & forecast", "ev"]; },
    tsl: () => { const s = L("tsl_del"); return [`Tesla is expected to deliver about <b>${fmt.intC(s.d.fc12)}</b> over the next 4 quarters (range ${fmt.intC(s.d.lo)} to ${fmt.intC(s.d.hi)}), vs ${fmt.intC(s.d.last12)} in the last 4. Chance of growth: ${fmt.pct(s.d.pGrowth, 0)}. Reliability: ${s.d.grade.toLowerCase()}.`, "Forecast lab", "lab", "tsl_del"]; },
    rivo: () => { const s = L("riv_del"); return [`Rivian is expected to deliver about <b>${fmt.intC(s.d.fc12)}</b> over the next 4 quarters (range ${fmt.intC(s.d.lo)} to ${fmt.intC(s.d.hi)}), vs ${fmt.intC(s.d.last12)} in the last 4. Chance of growth: ${fmt.pct(s.d.pGrowth, 0)}. Reliability: ${s.d.grade.toLowerCase()}; the history is short.`, "Forecast lab", "lab", "riv_del"]; },
    share: () => { if (!RS) return ["Market data is not loaded.", "About the data", "quality"]; const M = RS.market, n = M.quarters.length - 1; return [`In ${evQ(M.quarters[n])} Tesla sold <b>${fmt.pct(M.tesla[n] / M.total_ev[n], 1)}</b> of new EVs in the U.S. and Rivian <b>${fmt.pct(M.rivian[n] / M.total_ev[n], 1)}</b>, out of ${fmt.intC(M.total_ev[n])} EVs in all (Cox Automotive estimates).`, "Market share", "market"]; },
    who: () => { if (!RS) return ["Owner data is not loaded.", "About the data", "quality"]; const p = RS.owners.wa.profile; return [`Registration records only show where cars are kept. In Washington, Rivians are registered in tracts with a median household income of <b>${usdK(p.rivian.income_median)}</b> and Teslas <b>${usdK(p.tesla.income_median)}</b>, against ${usdK(p.population.income_median)} for all residents; ${fmt.pct(p.rivian.bachelor_plus, 0)} of adults in Rivian areas hold a degree (state ${fmt.pct(p.population.bachelor_plus, 0)}).`, "Who buys", "buyers"]; },
    safe: () => { if (!RS) return ["Customer data is not loaded.", "About the data", "quality"]; const C = RS.customers; return [`${C.ncap.filter((x) => x.overall === 5).map((x) => x.model).join(", ") || "No model"} carry NHTSA's five-star overall rating. Since 2019 Tesla has had ${C.recall_campaigns.tesla} recall campaigns and Rivian ${C.recall_campaigns.rivian}; ${fmt.pct(C.recall_ota_share.tesla, 0)} and ${fmt.pct(C.recall_ota_share.rivian, 0)} were fixable over the air. Complaint rates per 10,000 sold are on the Customer view.`, "Customer view", "customers"]; },
    mood: () => { if (!RS || !RS.sentiment.tesla) return ["News tone is not loaded yet.", "Sentiment", "sentiment"]; const S = RS.sentiment, a = (k) => mean(S[k].tone.slice(-12)); return [`Average news tone over the last 12 months: Tesla <b>${a("tesla").toFixed(2)}</b>, Rivian <b>${a("rivian").toFixed(2)}</b> (GDELT; 0 is neutral, most business news is slightly negative). That measures how coverage is written, not what buyers think.`, "Sentiment", "sentiment"]; },
    cash: () => { if (!RS) return ["Investor data is not loaded.", "About the data", "quality"]; const r = RS.investors.rivian; return [`Rivian held <b>${usd(r.liquidity.at(-1))}</b> in cash and short-term investments at ${evQ(r.latest)} and its free cash flow over four quarters was ${usd(r.ttm.fcf)}${r.runway_quarters ? `, about <b>${r.runway_quarters} quarters</b> of runway at that rate` : ""}. Its share count rose ${r.share_growth_3y != null ? pctTxt(r.share_growth_3y) : "n/a"} in three years. Not investment advice.`, "Investor view", "investors"]; },
    track: () => [LAB.filter((s) => s.id !== "tsl_rev").map((s) => { const m = s.fc.monitor.at(-1), ins = m.actual >= m.lo && m.actual <= m.hi; return `<b>${s.label}</b>: ${labLabel(s, m.month)} was ${fmt.pct(Math.abs(m.actual / m.expected - 1))} ${m.actual >= m.expected ? "above" : "below"} what was expected, ${ins ? "inside" : "outside"} the normal range.`; }).join("<br>"), "Forecast lab", "lab"],
    drive: () => { const n = DR.tests.filter((r) => r.verdict === "Yes").length; return [n ? `${n} U.S. indicator(s) pass the strict test.` : `No U.S. indicator (gasoline price, loan rates, vehicle sales, new-car prices, sentiment, fed funds) passes the strict test of lining up with Tesla or Rivian growth. A few show patterns that could be chance, because there are only ${Math.min(...DR.tests.map((r) => r.n))} to ${Math.max(...DR.tests.map((r) => r.n))} overlapping year-over-year points.`, "Drivers", "drivers"]; },
    fresh: () => [`Tesla deliveries to <b>${evQ(T.at(-1).q)}</b>, Tesla financials to <b>${evQ(T.filter((r) => r.revenue != null).at(-1).q)}</b>, Rivian deliveries to <b>${evQ(R.at(-1).q)}</b>, Rivian financials to <b>${evQ(R.filter((r) => r.revenue != null).at(-1).q)}</b>, attention to <b>${fmt.month(VS.meta.pageviews_latest)}</b>.`, "About the data", "quality"],
    gaps: () => [`No customer reviews or satisfaction surveys (none is open); NHTSA complaints, crash ratings and news tone stand in. Owner demographics are neighbourhood averages from two states (WA, NY), not individual owners. Volumes are quarterly only, since neither company reports monthly. No raw share prices (only derived yearly changes). Registrations only for Tesla in China and Europe (ACEA, as first published); Rivian sells almost only in North America. Attention is English Wikipedia only. Charging counts only stations open today. Companies listed outside the U.S. are not covered.`, "About the data", "quality"],
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
