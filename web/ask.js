// "Ask the dashboard": suggested questions and keyword search, answered from the same numbers as the charts. No language model, no guessing.
const ASK_Q = [
  { id: "vol", q: "Who sold more vehicles?", kw: ["sold", "sales", "volume", "more vehicles", "bigger", "units", "deliver"] },
  { id: "growth", q: "Who is growing faster?", kw: ["growing", "growth", "faster", "momentum"] },
  { id: "profit", q: "Who makes more money?", kw: ["profit", "money", "margin", "earn", "income", "revenue"] },
  { id: "over", q: "How big is BYD's overseas business?", kw: ["overseas", "export", "abroad", "international", "outside china"] },
  { id: "tsl", q: "What is the outlook for Tesla deliveries?", kw: ["tesla outlook", "tesla forecast", "tesla deliveries", "tesla next"] },
  { id: "byd", q: "What is the outlook for BYD sales?", kw: ["byd outlook", "byd forecast", "byd next", "byd sales"] },
  { id: "track", q: "Is the latest month on track?", kw: ["on track", "latest month", "latest quarter", "pulse", "behind", "ahead"] },
  { id: "drive", q: "Do gas prices or interest rates drive sales?", kw: ["gas", "gasoline", "interest", "rate", "driver", "macro", "sentiment"] },
  { id: "fresh", q: "How current is the data?", kw: ["current", "fresh", "up to date", "latest data", "how old", "updated"] },
  { id: "gaps", q: "What data is missing?", kw: ["missing", "gap", "limit", "cannot", "not included", "caveat"] },
];
const ASK_OUT = [
  { re: /\b(stock|share price|shares|invest|buy|sell|trade|price target|worth buying|dividend)\b/i, why: "I can't give investment advice or stock forecasts. The dashboard covers vehicle volumes, financials, attention and forecasts of volumes and revenue." },
  { re: /\b(review|rating|satisf|complain|reliab|quality|nps|owner)/i, why: "There is no open customer-review or satisfaction dataset for Tesla or BYD, so the dashboard has none. The 'What data is missing?' answer lists the other gaps." },
  { re: /\b(nvidia|google|apple|ford|toyota|volkswagen|gm|rivian|nio|xpeng|waymo|amazon)\b/i, why: "This dashboard compares Tesla and BYD only." },
  { re: /\b(202[7-9]|20[3-9]\d)\b/, why: "Forecasts here run about a year (twelve months for BYD, six quarters for Tesla). Use the Forecast lab for the horizon each series supports." },
];
const askNorm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function askAnswer(id) {
  if (!LAB) buildLab();
  const T = EV.tesla.quarters, B = EV.byd.months, F_ = VS.fin, Y = F_.years, i = Y.length - 1, y = Y[i];
  const t12 = sum(T.slice(-4).map((r) => r.deliveries)), t12p = sum(T.slice(-8, -4).map((r) => r.deliveries)), b12 = sum(B.slice(-12).map((r) => r.total)), b12p = sum(B.slice(-24, -12).map((r) => r.total));
  const L = (k) => LAB.find((s) => s.id === k);
  const A = {
    vol: () => [`Over the last 12 months BYD sold <b>${fmt.intC(b12)}</b> new-energy vehicles and Tesla delivered <b>${fmt.intC(t12)}</b>, so BYD sold ${(b12 / t12).toFixed(1)}× as many. BYD's figure includes plug-in hybrids; Tesla's is battery-electric only.`, "Head to head", "versus"],
    growth: () => [`Tesla's volume is <b>${pctTxt(t12 / t12p - 1)}</b> vs the prior 12 months; BYD's is <b>${pctTxt(b12 / b12p - 1)}</b>. In ${y}, revenue grew ${pctTxt(F_.tesla.revenue[i] / F_.tesla.revenue[i - 1] - 1)} at Tesla and ${pctTxt(F_.byd_usd.revenue[i] / F_.byd_usd.revenue[i - 1] - 1)} at BYD.`, "Head to head", "versus"],
    profit: () => [`In ${y}, Tesla earned <b>${fmt.usdB(F_.tesla.net_income[i])}</b> (${fmt.pct(F_.tesla.net_income[i] / F_.tesla.revenue[i])} of revenue) and BYD <b>${fmt.usdB(F_.byd_usd.net_income[i])}</b> (${fmt.pct(F_.byd_usd.net_income[i] / F_.byd_usd.revenue[i])}), converted from RMB. BYD also makes phone components, so margins are not purely car-to-car.`, "Head to head", "versus"],
    over: () => { const l = B.at(-1), p = B.at(-13); return [`BYD's overseas sales were <b>${fmt.intC(l.overseas)}</b> in ${fmt.month(l.m)}, ${fmt.pct(l.overseas / l.total, 0)} of its total, up from ${fmt.pct(p.overseas / p.total, 0)} a year earlier. "Overseas" is defined differently across sources.`, "Sales & forecast", "ev"]; },
    tsl: () => { const s = L("tsl_del"); return [`Tesla is expected to deliver about <b>${fmt.intC(s.d.fc12)}</b> over the next 4 quarters (range ${fmt.intC(s.d.lo)} to ${fmt.intC(s.d.hi)}), vs ${fmt.intC(s.d.last12)} in the last 4. Chance of growth: ${fmt.pct(s.d.pGrowth, 0)}. Reliability: ${s.d.grade.toLowerCase()}.`, "Forecast lab", "lab", "tsl_del"]; },
    byd: () => { const s = L("byd_total"); return [`BYD is expected to sell about <b>${fmt.intC(s.d.fc12)}</b> over the next 12 months (range ${fmt.intC(s.d.lo)} to ${fmt.intC(s.d.hi)}), vs ${fmt.intC(s.d.last12)} in the last 12. Chance of growth: ${fmt.pct(s.d.pGrowth, 0)}. Reliability: ${s.d.grade.toLowerCase()}.`, "Forecast lab", "lab", "byd_total"]; },
    track: () => [LAB.filter((s) => s.id !== "tsl_rev").map((s) => { const m = s.fc.monitor.at(-1), ins = m.actual >= m.lo && m.actual <= m.hi; return `<b>${s.label}</b>: ${labLabel(s, m.month)} was ${fmt.pct(Math.abs(m.actual / m.expected - 1))} ${m.actual >= m.expected ? "above" : "below"} what was expected, ${ins ? "inside" : "outside"} the normal range.`; }).join("<br>"), "Forecast lab", "lab"],
    drive: () => { const n = DR.tests.filter((r) => r.verdict === "Yes").length; return [n ? `${n} U.S. indicator(s) pass the strict test.` : `No U.S. indicator (gasoline price, loan rates, vehicle sales, new-car prices, sentiment, fed funds) passes the strict test of lining up with Tesla or BYD growth. A few show patterns that could be chance, because there are only ${Math.min(...DR.tests.map((r) => r.n))} to ${Math.max(...DR.tests.map((r) => r.n))} overlapping year-over-year points.`, "Drivers", "drivers"]; },
    fresh: () => [`Tesla deliveries to <b>${evQ(T.at(-1).q)}</b>, Tesla financials to <b>${evQ(T.filter((r) => r.revenue != null).at(-1).q)}</b>, BYD monthly sales to <b>${fmt.month(B.at(-1).m)}</b>, BYD annual financials to <b>${y}</b>, attention to <b>${fmt.month(VS.meta.pageviews_latest)}</b>.`, "About the data", "quality"],
    gaps: () => [`No customer reviews or satisfaction data (none is open). BYD monthly volumes only from January 2023 (before that, annual figures only). No stock prices or country registrations yet. Attention is English Wikipedia only. Charging counts only stations open today. BYD's monthly figures are unaudited and its annual revenue includes phone components.`, "About the data", "quality"],
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
    if (best) run(best.id); else show(`I can answer questions about volumes, growth, profit, BYD's overseas sales, outlooks, whether the latest period is on track, demand drivers, data freshness and data gaps. Try one of the suggestions above.`);
  };
}
// test: every suggested question gives an answer, and every out-of-scope phrase is declined
function selfTestAsk() {
  const bad = [];
  ASK_Q.forEach((q) => { try { if (!askAnswer(q.id)[0]) bad.push(q.id); } catch (e) { bad.push(q.id + ": " + e.message); } });
  ["should I buy tesla stock", "customer reviews of byd", "what about ford", "sales in 2029"].forEach((t) => { if (!ASK_OUT.some((o) => o.re.test(askNorm(t)))) bad.push("not declined: " + t); });
  return bad;
}
