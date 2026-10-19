// Demand drivers: U.S. macro series and an exploratory test against Tesla and Rivian volumes (drivers.json, scripts/build_drivers.py).
let DR = null;
function prepDrivers(d) { DR = d; }

function renderDrivers() {
  if (!DR) return;
  const S = DR.series, ids = Object.keys(S);
  const latest = (id) => S[id].values.at(-1), yearAgo = (id) => S[id].values.at(-13) ?? S[id].values.at(-5);
  const chg = (id) => { const k = S[id]; return k.kind === "level" ? latest(id) / yearAgo(id) - 1 : latest(id) - yearAgo(id); };
  $("drTiles").innerHTML = ids.slice(0, 4).map((id) => {
    const k = S[id], c = chg(id);
    return tile({ label: `${k.label}, ${fmt.month(k.dates.at(-1))}`, value: (k.unit.includes("percent") ? latest(id).toFixed(2) + "%" : k.unit.includes("dollars") ? "$" + latest(id).toFixed(2) : latest(id).toFixed(1)),
      delta: deltaChip(c, k.kind === "level" ? pctTxt : numTxt(" pts", 2), id !== "GASREGW"), sub: "vs a year earlier" });
  }).join("");
  $("drGrid").innerHTML = ids.map((id) => `<article class="card"><header><h3>${S[id].label}</h3><p>${S[id].unit}. ${S[id].publisher}.</p></header><div class="plot sm" id="c-dr-${id}"></div></article>`).join("");
  ids.forEach((id, i) => draw(`c-dr-${id}`, [{ x: S[id].dates.map((d) => d + "-01"), y: S[id].values, mode: "lines", line: line([css("--c1"), css("--c2"), css("--c3"), css("--c4"), "#8a6fd6", "#e87ba4"][i % 6], 2.4), hovertemplate: "%{y:.2f}" }],
    layout({ margin: { l: 8, r: 12, t: 8, b: 8 }, xaxis: { type: "date" }, showlegend: false })));
  const rows = DR.tests.slice().sort((a, b) => a.p - b.p);
  $("drTable").innerHTML = `<thead><tr><th>Driver</th><th>Company</th><th class="n">Link (r)</th><th class="n">Raw p</th><th class="n">Adjusted p</th><th class="n">Data points</th><th>Verdict</th></tr></thead><tbody>` +
    rows.map((r) => `<tr><td><b>${esc2(r.label)}</b><span class="sub2">${r.lead ? "driver leads by one period" : "same period"}</span></td><td>${r.company}</td><td class="n">${r.r >= 0 ? "+" : "−"}${Math.abs(r.r).toFixed(2)}</td><td class="n">${r.p.toFixed(3)}</td><td class="n">${r.p_adj.toFixed(3)}</td><td class="n">${r.n} (${r.n_eff} effective)</td>
      <td><span class="badge ${r.verdict === "Yes" ? "good" : r.verdict === "Suggestive" ? "warn" : ""}">${r.verdict}</span></td></tr>`).join("") + "</tbody>";
  const yes = rows.filter((r) => r.verdict === "Yes").length, sug = rows.filter((r) => r.verdict === "Suggestive").length;
  $("drNote").textContent = `${yes ? yes + " driver(s) pass" : "No driver passes"} the strict test. ${sug} show a pattern that could be chance: with only ${Math.min(...rows.map((r) => r.n))} to ${Math.max(...rows.map((r) => r.n))} year-over-year points that overlap each other, the adjusted p-value (which counts overlapping windows once) is the one to trust, and none of the U.S. indicators can speak for China or global demand. Use them as context, not as inputs to the forecast.`;
}
