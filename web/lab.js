// Forecast lab: pick a series, see its outlook, test a target, apply a demand scenario, and check whether the latest period is on track.
// Series come from ev.json (forecasts built by scripts/build_ev_data.py).

let LAB = null;
const labState = { id: "byd_total", shift: 0, target: "" };

function buildLab() {
  const T = EV.tesla, B = EV.byd;
  const tq = T.quarters, rq = tq.filter((r) => r.revenue != null);
  const mk = (id, co, label, unit, step, x, y, fc, f, rev) => ({ id, co, label, unit, step, n12: step === 3 ? 4 : 12, x, y, fc, f, color: co === "Tesla" ? css("--c2") : css("--c1") });
  LAB = [
    mk("tsl_del", "Tesla", "Tesla deliveries", "vehicles", 3, tq.map((r) => r.q), tq.map((r) => r.deliveries), T.forecast_deliveries, fmt.intC),
    mk("tsl_rev", "Tesla", "Tesla revenue", "$ millions", 3, rq.map((r) => r.q), rq.map((r) => r.revenue), T.forecast_revenue, fmt.usdB),
    mk("byd_total", "BYD", "BYD NEV sales", "vehicles", 1, B.months.map((r) => r.m), B.months.map((r) => r.total), B.forecast_total, fmt.intC),
    mk("byd_over", "BYD", "BYD overseas sales", "vehicles", 1, B.months.map((r) => r.m), B.months.map((r) => r.overseas), B.forecast_overseas, fmt.intC),
  ];
  LAB.forEach((s) => {
    const n = s.n12, q = s.fc.cumq[n - 1], last12 = sum(s.y.slice(-n)), prior12 = sum(s.y.slice(-2 * n, -n)), fc12 = sum(s.fc.fc.mean.slice(0, n));
    s.d = { last12, prior12, fc12, lo: q[1], hi: q[17], q, growth: fc12 / last12 - 1, pGrowth: probAtLeast(q, last12), wmape: s.fc.wmape, grade: s.fc.wmape <= 0.15 ? "High" : s.fc.wmape <= 0.30 ? "Medium" : "Low" };
    s.d.action = s.d.pGrowth >= 0.7 ? "Expanding" : s.d.pGrowth <= 0.3 ? "Contracting" : "Uncertain";
  });
}
const labSeries = () => LAB.find((s) => s.id === labState.id) || LAB[0];
const labLabel = (s, p) => (s.step === 3 ? evQ(p) : p);

function initLab() {
  $("labSeg").onclick = (e) => { const b = e.target.closest("button"); if (b) { labState.id = b.dataset.id; labState.target = ""; $("labTarget").value = ""; syncUI(); renderLab(); } };
  $("labShift").oninput = () => { labState.shift = +$("labShift").value; renderLab(); };
  $("labTarget").oninput = () => { labState.target = $("labTarget").value; renderLabTarget(); };
  $("labScoreBody").onclick = (e) => { const r = e.target.closest("[data-id]"); if (r) { labState.id = r.dataset.id; syncUI(); renderLab(); } };
}

function labReadHash(p) { if (p.get("ls") && ["tsl_del", "tsl_rev", "byd_total", "byd_over"].includes(p.get("ls"))) labState.id = p.get("ls"); const v = parseInt(p.get("lsh")); if (Number.isFinite(v) && v >= -30 && v <= 30) labState.shift = v; }
function labWriteHash(p) { if (labState.id !== "byd_total") p.set("ls", labState.id); if (labState.shift) p.set("lsh", labState.shift); }

function renderLab() {
  if (!EV) return;
  if (!LAB) buildLab();
  const s = labSeries(), d = s.d, f = (1 + labState.shift / 100), n = s.n12, col = s.color;
  document.querySelectorAll("#labSeg button").forEach((b) => { b.classList.toggle("on", b.dataset.id === s.id); b.setAttribute("aria-checked", b.dataset.id === s.id); });
  $("labShift").value = labState.shift; $("labShiftVal").textContent = (labState.shift >= 0 ? "+" : "−") + Math.abs(labState.shift) + "%";

  // scorecard
  const tag = (a, tent) => `<span class="badge ${a === "Expanding" ? "good" : a === "Contracting" ? "bad" : "warn"}">${a}</span>${tent ? ' <span class="badge">Tentative</span>' : ""}`;
  $("labScoreBody").innerHTML = LAB.map((x) => `<tr data-id="${x.id}" class="${x.id === s.id ? "sel" : ""}" tabindex="0"><td><span class="dotk" style="background:${x.color}"></span><b>${x.label}</b></td>
    <td class="n">${x.f(x.d.last12)}</td><td class="n">${x.f(x.d.fc12)}</td><td class="n">${deltaChip(x.d.growth, pctTxt)}</td><td class="n">${fmt.pct(x.d.pGrowth, 0)}</td><td>${x.d.grade}</td><td>${tag(x.d.action, x.d.grade === "Low")}</td></tr>`).join("");

  // outlook tiles for the selected series
  $("labTiles").innerHTML = [
    tile({ label: `${s.label}: last 12 months`, value: s.f(d.last12), sub: `prior 12 months ${s.f(d.prior12)}`, delta: deltaChip(d.last12 / d.prior12 - 1, pctTxt) }),
    tile({ label: "Expected next 12 months", value: s.f(d.fc12 * f), delta: deltaChip(d.fc12 * f / d.last12 - 1, pctTxt), sub: labState.shift ? `scenario ${labState.shift > 0 ? "+" : "−"}${Math.abs(labState.shift)}%` : "model view" }),
    tile({ label: "Likely range (80%)", value: `${s.f(d.lo * f)} to ${s.f(d.hi * f)}`, sub: "one time in five it lands outside" }),
    tile({ label: "Chance of growth", value: fmt.pct(probAtLeast(d.q.map((v) => v * f), d.last12), 0), sub: `model reliability ${d.grade.toLowerCase()} (backtest error ${fmt.pct(d.wmape, 0)})` }),
  ].join("");

  // history + forecast with scenario overlay
  const hx = s.x.map((p) => labLabel(s, p)), fx = s.fc.fc.month.map((p) => labLabel(s, p)), keep = Math.min(s.x.length, s.step === 3 ? 16 : 36), H = hx.slice(-keep), Y = s.y.slice(-keep);
  const tv = [...H, ...fx].filter((_, i, a) => i % (s.step === 3 ? 4 : 6) === 0);
  const traces = [
    { x: H, y: Y, type: "bar", name: "Actual", marker: { color: Y.map((_, i) => (i === Y.length - 1 ? col : rgba(col, 0.55))), cornerradius: 3 }, hovertemplate: "%{y:,.0f}" },
    { x: fx, y: s.fc.fc.p90.map((v) => v * f), mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
    { x: fx, y: s.fc.fc.p10.map((v) => v * f), mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: rgba(css("--c3"), 0.18), name: "80% range", hoverinfo: "skip" },
    { x: fx, y: s.fc.fc.mean.map((v) => v * f), mode: "lines+markers", name: labState.shift ? "Scenario" : "Expected", line: { color: css("--c3"), width: 2.6, dash: "dash" }, marker: { size: 7, color: css("--c3"), line: { color: css("--surface"), width: 2 } }, hovertemplate: "%{y:,.0f}" },
  ];
  if (labState.shift) traces.push({ x: fx, y: s.fc.fc.mean, mode: "lines", name: "Model", line: { color: css("--muted"), width: 1.6, dash: "dot" }, hovertemplate: "%{y:,.0f}" });
  draw("c-lab", traces, layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", tickmode: "array", tickvals: tv, tickangle: 0 }, yaxis: { tickformat: ".2s" },
    shapes: [{ type: "line", xref: "x", x0: H.length - 0.5, x1: H.length - 0.5, yref: "paper", y0: 0, y1: 1, line: { color: css("--axis"), width: 1, dash: "dot" } }] }));
  $("labSub").textContent = `${s.label} (${s.unit}), ${s.step === 3 ? "by quarter" : "by month"}, with the model's outlook for the next ${fx.length} ${s.step === 3 ? "quarters" : "months"}.`;
  $("labModel").textContent = `Model: ${s.fc.model}. Backtest error ${fmt.pct(s.fc.wmape, 0)}; the 80% range held ${fmt.pct(s.fc.coverage80, 0)} of the time in testing; average bias ${s.fc.bias >= 0 ? "+" : "−"}${Math.abs(s.fc.bias * 100).toFixed(1)}%.`;

  // on track?
  const mo = s.fc.monitor, last = mo.at(-1), inside = last.actual >= last.lo && last.actual <= last.hi, dev = last.actual / last.expected - 1;
  const mlab = (p) => labLabel(s, p.month);
  draw("c-lab-mon", [
    { x: mo.map(mlab), y: mo.map((m) => m.hi), mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
    { x: mo.map(mlab), y: mo.map((m) => m.lo), mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: rgba(css("--c3"), 0.18), name: "Expected range", hoverinfo: "skip" },
    { x: mo.map(mlab), y: mo.map((m) => m.expected), mode: "lines", name: "Expected", line: { color: css("--c3"), width: 2, dash: "dash" }, hovertemplate: "%{y:,.0f}" },
    { x: mo.map(mlab), y: mo.map((m) => m.actual), mode: "lines+markers", name: "Actual", line: { color: col, width: 2.6 }, marker: { size: 7, color: mo.map((m) => (m.actual >= m.lo && m.actual <= m.hi ? col : css("--bad") || "#d03b3b")), line: { color: css("--surface"), width: 2 } }, hovertemplate: "%{y:,.0f}" },
  ], layout({ margin: { l: 8, r: 16, t: 28, b: 8 }, xaxis: { type: "category", tickangle: 0 }, yaxis: { tickformat: ".2s" } }));
  const outside = mo.filter((m) => m.actual < m.lo || m.actual > m.hi).length;
  $("labPulse").innerHTML = `<b>${mlab(last)}</b> came in at <b>${s.f(last.actual)}</b>, ${Math.abs(dev * 100).toFixed(1)}% ${dev >= 0 ? "above" : "below"} what the model expected, ${inside ? "inside" : "<b>outside</b>"} its normal range. ${outside} of the last ${mo.length} periods fell outside the range (about ${Math.round(mo.length * 0.2)} would be normal). Each point is a one-step-ahead forecast made before that period.`;

  // seasonality
  const si = s.fc.seasonal, names = s.step === 3 ? ["Q1", "Q2", "Q3", "Q4"] : MONTHS;
  draw("c-lab-sea", [{ x: names, y: si, type: "bar", marker: { color: si.map((v) => (v >= 1 ? col : rgba(col, 0.4))), cornerradius: 3 }, hovertemplate: "%{y:.2f}× average" }],
    layout({ margin: { l: 8, r: 16, t: 8, b: 8 }, xaxis: { type: "category" }, yaxis: { tickformat: ".2f" }, hovermode: "closest", showlegend: false, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 1, y1: 1, line: { color: css("--axis"), width: 1, dash: "dot" } }] }));
  renderLabTarget();
}

function renderLabTarget() {
  const s = labSeries(), f = 1 + labState.shift / 100, d = s.d, v = parseFloat(String(labState.target).replace(/[, $]/g, ""));
  const unitK = s.unit === "$ millions" ? 1e3 : 1;
  if (!ok(v) || v <= 0) { $("labTargetOut").innerHTML = `Type a number for the next 12 months (${s.unit === "$ millions" ? "in $ billions, e.g. 120" : "in vehicles, e.g. 5000000"}) to see the chance of reaching it.`; return; }
  const x = v * unitK, p = probAtLeast(d.q.map((q) => q * f), x);
  $("labTargetOut").innerHTML = `Chance of reaching <b>${s.f(x)}</b> or more over the next 12 months: <b>${fmt.pct(p, 0)}</b>${labState.shift ? " (with your scenario applied)" : ""}. Expected ${s.f(d.fc12 * f)}.`;
}
