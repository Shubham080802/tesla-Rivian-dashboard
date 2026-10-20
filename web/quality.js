// About the data: what each source is, how fresh it is, what was checked, and what is missing (checks.json from scripts/check_data.py).
let CK = null;
function prepChecks(d) { CK = d; }

function renderQuality() {
  if (!EV || !VS) return;
  const T = EV.tesla.quarters, fin = T.filter((r) => r.revenue != null).at(-1);
  const rows = [
    ["Tesla deliveries and production", "Tesla 8-K releases (via datahub.io snapshot, latest quarter from the filing)", evQ(T.at(-1).q), monthsAgo(T.at(-1).q, 2)],
    ["Tesla financials", "SEC EDGAR 10-Q and 10-K", evQ(fin.q), monthsAgo(fin.q, 2)],
    ["Rivian deliveries and production", "Rivian 8-K releases", evQ(EV.rivian.quarters.at(-1).q), monthsAgo(EV.rivian.quarters.at(-1).q, 2)],
    ["Rivian financials", "SEC EDGAR 10-Q and 10-K", evQ(EV.rivian.quarters.filter((r) => r.revenue != null).at(-1).q), monthsAgo(EV.rivian.quarters.filter((r) => r.revenue != null).at(-1).q, 2)],
    ["Wikipedia attention", "Wikimedia page views API", fmt.month(VS.meta.pageviews_latest), monthsAgo(VS.meta.pageviews_latest)],
    ["Tesla and Rivian charging stations", "U.S. federal station locator", String(VS.meta.charger_latest_year), monthsAgo(VS.meta.charger_latest_year + "-12")],
  ];
  if (RG) { rows.push(["Tesla China (domestic and exports)", "CPCA, as tabulated by CnEVPost", fmt.month(RG.meta.tesla_china_latest), monthsAgo(RG.meta.tesla_china_latest)]); rows.push(["Europe registrations", "ACEA press releases (earlier months via CnEVPost)", fmt.month(RG.meta.europe_latest), monthsAgo(RG.meta.europe_latest)]); }
  if (SK) rows.push(["Share prices (derived figures only)", "Yahoo Finance, personal-use data", fmt.month(SK.meta.through), monthsAgo(SK.meta.through)]);
  if (RS) {
    const M = RS.market, S = RS.sentiment, b = RS.meta.built;
    rows.push(["U.S. EV sales by brand and model", "Cox Automotive / Kelley Blue Book quarterly estimates", evQ(M.quarters.at(-1)), monthsAgo(M.quarters.at(-1), 2)]);
    rows.push(["Recalls, complaints, crash ratings", "NHTSA APIs", b, monthsAgo(b.slice(0, 7))]);
    rows.push(["Range and efficiency", "EPA fueleconomy.gov", String(Math.max(...RS.customers.epa.map((e) => e.year))), 0]);
    if (S.tesla) rows.push(["News tone and coverage", "GDELT DOC 2.0 API", fmt.month(S.tesla.months.at(-1)), monthsAgo(S.tesla.months.at(-1))]);
    rows.push(["EV registrations (CA, WA, NY, CT)", "State DMV open data", b, monthsAgo(b.slice(0, 7))]);
    rows.push(["Neighbourhood demographics", `U.S. Census Bureau, ${RS.owners.acs_release}`, RS.owners.acs_release.match(/\d{4}/)?.[0] ?? "", 0]);
  }
  if (DR) rows.push(["Demand drivers", "FRED (EIA, BEA, BLS, Federal Reserve, Michigan)", fmt.month(DR.meta.latest), monthsAgo(DR.meta.latest)]);
  if (RS) {
    const S = RS.meta.sources;
    $("qSources").innerHTML = [
      `U.S. SEC, EDGAR company facts: Tesla, Inc. (CIK 1318605) and Rivian Automotive, Inc. (CIK 1874178). <a href="${S.sec}">sec.gov</a>`,
      `Tesla and Rivian quarterly production and delivery releases (8-K).`,
      `Cox Automotive / Kelley Blue Book, Electric Vehicle Sales Report, quarterly. ${S.cox.map((u, i) => `<a href="${u}">[${i + 1}]</a>`).join(" ")}`,
      `U.S. BEA light-vehicle sales (LTOTALNSA) and U.S. demand indicators, via <a href="${S.fred}">FRED</a>.`,
      `NHTSA recalls, complaints and NCAP ratings. <a href="${S.nhtsa}">nhtsa.gov</a>`,
      `EPA / DOE vehicle data. <a href="${S.epa}">fueleconomy.gov</a>`,
      `The GDELT Project, DOC 2.0 API. <a href="${S.gdelt}">gdeltproject.org</a>`,
      `California DMV, <a href="${S.ca}">Vehicle Fuel Type Count by Zip Code</a>; Washington State DOL, <a href="${S.wa}">Electric Vehicle Population Data</a>; New York State DMV, <a href="${S.ny}">Vehicle, Snowmobile, and Boat Registrations</a>; Connecticut DMV, <a href="${S.ct}">Electric Vehicle Registration Data</a>.`,
      `U.S. Census Bureau, ${esc2(RS.owners.acs_release)}, via <a href="${S.acs}">Census Reporter</a>.`,
      `Wikimedia page views; U.S. DOE station locator; CPCA via CnEVPost; ACEA press releases; Yahoo Finance (derived percentages only).`,
    ].map((x) => `<li>${x}</li>`).join("");
  }
  $("qFresh").innerHTML = `<thead><tr><th>Source</th><th>Publisher</th><th>Latest data</th><th>Age</th><th></th></tr></thead><tbody>` +
    rows.map(([n, p, l, a]) => `<tr><td><b>${n}</b></td><td>${p}</td><td>${l}</td><td>${ageText(a)}</td><td>${ageBadge(a)}</td></tr>`).join("") + "</tbody>";
  if (CK) {
    const fails = CK.checks.filter((c) => c.status === "fail").length;
    $("qCheckSub").textContent = `${CK.checks.length - fails} of ${CK.checks.length} checks passed at the last build (${CK.built}).`;
    $("qChecks").innerHTML = CK.checks.map((c) => `<li><span class="badge ${c.status === "pass" ? "good" : c.status === "warn" ? "warn" : "bad"}">${c.status === "pass" ? "Pass" : c.status === "warn" ? "Note" : "Fail"}</span> <b>${esc2(c.name)}</b><span class="sub2">${esc2(c.detail)}</span></li>`).join("");
  }
}
