// About the data: what each source is, how fresh it is, what was checked, and what is missing (checks.json from scripts/check_data.py).
let CK = null;
function prepChecks(d) { CK = d; }

function renderQuality() {
  if (!EV || !VS) return;
  const T = EV.tesla.quarters, B = EV.byd.months, fin = T.filter((r) => r.revenue != null).at(-1);
  const rows = [
    ["Tesla deliveries and production", "Tesla 8-K releases (via datahub.io snapshot, latest quarter from the filing)", evQ(T.at(-1).q), monthsAgo(T.at(-1).q, 2)],
    ["Tesla financials", "SEC EDGAR 10-Q and 10-K", evQ(fin.q), monthsAgo(fin.q, 2)],
    ["BYD monthly sales", "BYD announcements to HKEX, tabulated by CnEVPost", fmt.month(B.at(-1).m), monthsAgo(B.at(-1).m)],
    ["BYD annual financials", "BYD annual reports (HKEXnews)", String(VS.fin.years.at(-1)), monthsAgo(VS.fin.years.at(-1) + "-12")],
    ["Wikipedia attention", "Wikimedia page views API", fmt.month(VS.meta.pageviews_latest), monthsAgo(VS.meta.pageviews_latest)],
    ["Tesla charging stations", "U.S. federal station locator", String(VS.meta.charger_latest_year), monthsAgo(VS.meta.charger_latest_year + "-12")],
  ];
  if (RG) { rows.push(["Tesla China (domestic and exports)", "CPCA, as tabulated by CnEVPost", fmt.month(RG.meta.tesla_china_latest), monthsAgo(RG.meta.tesla_china_latest)]); rows.push(["Europe registrations", "ACEA press releases (earlier months via CnEVPost)", fmt.month(RG.meta.europe_latest), monthsAgo(RG.meta.europe_latest)]); }
  if (DR) rows.push(["Demand drivers", "FRED (EIA, BEA, BLS, Federal Reserve, Michigan)", fmt.month(DR.meta.latest), monthsAgo(DR.meta.latest)]);
  $("qFresh").innerHTML = `<thead><tr><th>Source</th><th>Publisher</th><th>Latest data</th><th>Age</th><th></th></tr></thead><tbody>` +
    rows.map(([n, p, l, a]) => `<tr><td><b>${n}</b></td><td>${p}</td><td>${l}</td><td>${ageText(a)}</td><td>${ageBadge(a)}</td></tr>`).join("") + "</tbody>";
  if (CK) {
    const fails = CK.checks.filter((c) => c.status === "fail").length;
    $("qCheckSub").textContent = `${CK.checks.length - fails} of ${CK.checks.length} checks passed at the last build (${CK.built}).`;
    $("qChecks").innerHTML = CK.checks.map((c) => `<li><span class="badge ${c.status === "pass" ? "good" : c.status === "warn" ? "warn" : "bad"}">${c.status === "pass" ? "Pass" : c.status === "warn" ? "Note" : "Fail"}</span> <b>${esc2(c.name)}</b><span class="sub2">${esc2(c.detail)}</span></li>`).join("");
  }
}
