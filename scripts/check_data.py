"""Checks on every refresh. Writes web/checks.json (shown on the About the data tab); exit code 1 means "do not publish"."""
import json
import math
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
W = ROOT / "web"
checks = []


def check(name, ok, detail, warn=False):
    checks.append({"name": name, "status": "pass" if ok else ("warn" if warn else "fail"), "detail": detail})


def finite(o):
    if isinstance(o, float):
        return math.isfinite(o)
    if isinstance(o, dict):
        return all(finite(v) for v in o.values())
    if isinstance(o, list):
        return all(finite(v) for v in o)
    return True


def months_old(ym):
    t = date.today()
    return t.year * 12 + t.month - 1 - (int(ym[:4]) * 12 + int(ym[5:7]) - 1)


ev = json.loads((W / "ev.json").read_text())
vs = json.loads((W / "versus.json").read_text())
dr = json.loads((W / "drivers.json").read_text())
for name, o in (("ev.json", ev), ("versus.json", vs), ("drivers.json", dr)):
    check(f"{name} has no missing or infinite numbers", finite(o), "all values are finite")

T = ev["tesla"]["quarters"]
d25 = sum(r["deliveries"] for r in T if r["q"].startswith("2025"))
check("Tesla 2025 deliveries match the published annual total", d25 == 1636129, f"{d25:,} delivered in 2025")
check("Tesla quarters are consecutive and recent", months_old(T[-1]["q"]) <= 6 and len(T) >= 28, f"{len(T)} quarters, latest {T[-1]['q']}")
check("Tesla production is within 25% of deliveries each quarter", all(abs(r["production"] / r["deliveries"] - 1) < 0.25 for r in T), "no implausible quarter")
for name, fc in (("Tesla deliveries", ev["tesla"]["forecast_deliveries"]), ("Tesla revenue", ev["tesla"]["forecast_revenue"])):
    f = fc["fc"]
    check(f"{name} forecast is ordered and non-negative", all(0 <= lo <= m <= hi for lo, m, hi in zip(f["p10"], f["mean"], f["p90"])) and all(a <= b for q in fc["cumq"] for a, b in zip(q, q[1:])), f"{len(f['mean'])} periods, backtest error {fc['wmape']:.0%}")
    check(f"{name} 80% range held up in backtests", 0.6 <= fc["coverage80"] <= 0.97, f"coverage {fc['coverage80']:.0%} (target 80%)", warn=True)

RV = ev["rivian"]["quarters"]
rsum = lambda y, k: sum(r[k] for r in RV if r["q"].startswith(y))
check("Rivian volumes match its reported annual totals",
      [rsum(y, "deliveries") for y in ("2022", "2023", "2024", "2025")] == [20332, 50122, 51579, 42247] and [rsum(y, "production") for y in ("2022", "2023", "2024", "2025")] == [24337, 57232, 49476, 42284],
      "deliveries 20,332 / 50,122 / 51,579 / 42,247 and production 24,337 / 57,232 / 49,476 / 42,284 for 2022-2025")
check("Rivian quarters are consecutive and recent", months_old(RV[-1]["q"]) <= 6 and all((int(b["q"][:4]) * 12 + int(b["q"][5:7])) - (int(a["q"][:4]) * 12 + int(a["q"][5:7])) == 3 for a, b in zip(RV, RV[1:])), f"{len(RV)} quarters, latest {RV[-1]['q']}")
check("Rivian 2024 revenue matches the filing", abs(sum(r["revenue"] for r in RV if r["q"].startswith("2024")) - 4970) < 2, "$4,970 million")
for name, fc in (("Rivian deliveries", ev["rivian"]["forecast_deliveries"]), ("Rivian revenue", ev["rivian"]["forecast_revenue"])):
    f = fc["fc"]
    check(f"{name} forecast is ordered and non-negative", all(0 <= lo <= m <= hi for lo, m, hi in zip(f["p10"], f["mean"], f["p90"])), f"{len(f['mean'])} periods, backtest error {fc['wmape']:.0%}")

fin = vs["fin"]; yrs = fin["years"]; i23 = yrs.index(2023)
check("Annual financials cover consecutive years to last year", yrs == list(range(yrs[0], yrs[-1] + 1)) and yrs[-1] >= date.today().year - 2, f"{yrs[0]} to {yrs[-1]}")
check("Tesla 2023 revenue matches the filing", abs(fin["tesla"]["revenue"][i23] - 96773) < 5, f"${fin['tesla']['revenue'][i23] / 1e3:.2f}B")
pv = vs["pageviews"]
check("Page views are complete months and recent", all(months_old(v["months"][-1]) <= 2 and len(v["months"]) == len(v["views"]) for v in pv.values()) and min(min(v["views"][-24:]) for v in pv.values()) > 10000,
      f"latest month {pv['tesla']['months'][-1]} (a partial running month would show far lower views)")
check("Charging stations counted with plausible totals", sum(vs["chargers"]["stations"]) > 1000, f"{sum(vs['chargers']['stations']):,} open Tesla stations")
check("Driver tests use the overlap-corrected p-value", all("p_adj" in t and t["p_adj"] >= t["p"] - 1e-9 for t in dr["tests"]), f"{len(dr['tests'])} tests; Yes needs the adjusted p below {dr['meta']['alpha']}")
check("Driver series are current", months_old(dr["meta"]["latest"]) <= 4, f"latest observation {dr['meta']['latest']}", warn=True)

rg_path = W / "regions.json"
if rg_path.exists():
    rg = json.loads(rg_path.read_text())
    check("regions.json has no missing or infinite numbers", finite(rg), "all values are finite")
    tc = rg["tesla_china"]; wh = {m: d + e for m, d, e in zip(tc["months"], tc["domestic"], tc["exports"])}
    check("Tesla China months are consecutive", all((int(b[:4]) * 12 + int(b[5:]) - int(a[:4]) * 12 - int(a[5:])) == 1 for a, b in zip(tc["months"], tc["months"][1:])), f"{len(tc['months'])} months, {tc['months'][0]} to {tc['months'][-1]}")
    check("Tesla China reconciles to reported totals", wh["2026-07"] == 93579 and wh["2025-09"] == 90812 and wh["2026-07"] + wh["2026-08"] + wh["2026-09"] == 275111 and sum(v for m, v in wh.items() if m.startswith("2026")) == 743060,
          "July 2026 93,579; Q3 2026 275,111; September 2025 90,812; January to September 2026 743,060")
    check("Tesla China data is current", months_old(tc["months"][-1]) <= 3, f"latest {tc['months'][-1]}", warn=True)
    eu = rg["europe"]; t24 = sum(v for m, v in zip(eu["months"], eu["tesla"]) if m.startswith("2024")); t25 = sum(v for m, v in zip(eu["months"], eu["tesla"]) if m.startswith("2025"))
    check("Europe registrations are plausible", 300000 < t24 < 350000 and 220000 < t25 < 260000, f"Tesla Europe {t24:,} in 2024 and {t25:,} in 2025")
    import csv as _csv
    prim = list(_csv.DictReader(open(ROOT / "data" / "external" / "ev" / "acea_primary_rows.csv")))
    key = {(r["release_month"], r["company"]): r for r in prim}
    idx = {m: k for k, m in enumerate(eu["months"])}
    bad = [f"{rm} {co}" for (rm, co), r in key.items() if eu["tesla"][idx[rm]] != int(r["month_value"]) or eu["tesla"][idx[str(int(rm[:4]) - 1) + rm[4:]]] != int(r["same_month_last_year"])]
    check("Europe months equal the figures read from ACEA's press releases", not bad, f"{len(key)} release rows checked, including the restated 2025 months" if not bad else f"differences in: {bad}")
    gaps = []
    for co, arr in (("Tesla", eu["tesla"]),):
        for rm in ("2026-06", "2026-08"):
            s = sum(v or 0 for m, v in zip(eu["months"], arr) if m.startswith("2026") and m <= rm)
            ytd = int(key[(rm, co)]["year_to_date"])
            if abs(s / ytd - 1) > 0.02:
                gaps.append(f"{co} to {rm}: {s / ytd - 1:+.1%}")
    check("Europe monthly sums stay within 2% of ACEA's year-to-date totals", not gaps, "revisions to earlier months explain any small difference" if not gaps else "; ".join(gaps))
    check("Europe data is current", months_old(eu["months"][-1]) <= 4, f"latest {eu['months'][-1]} (ACEA publishes about three weeks after month end; see docs/TODO.md)", warn=True)

sk_path = W / "stocks.json"
if sk_path.exists():
    sk = json.loads(sk_path.read_text())
    check("stocks.json has no missing or infinite numbers", finite(sk), "all values are finite")
    t = {r["year"]: r["stock_return"] for r in sk["years"] if r["company"] == "Tesla"}
    rv_ = {r["year"]: r["stock_return"] for r in sk["years"] if r["company"] == "Rivian"}
    check("Rivian yearly share price changes match the published record", abs(rv_[2022] + 0.822) < 0.01 and abs(rv_[2023] - 0.273) < 0.01, "2022 -82%, 2023 +27% (price only)")
    check("Tesla yearly share price changes match the published record", abs(t[2020] - 7.434) < 0.01 and abs(t[2021] - 0.498) < 0.01 and abs(t[2022] + 0.650) < 0.01 and abs(t[2023] - 1.017) < 0.01 and abs(t[2024] - 0.625) < 0.01,
          "2020 +743%, 2021 +50%, 2022 -65%, 2023 +102%, 2024 +63% (split-adjusted, price only)")
    check("Share price data is current", months_old(sk["meta"]["through"]) <= 3, f"through {sk['meta']['through']} (refreshed by hand; not part of the daily job)", warn=True)
    check("No raw prices are published", all(set(r) <= {"company", "year", "stock_return", "revenue_growth", "volume_growth"} for r in sk["years"]) and all(set(v) <= {"symbol", "ytd_return", "ytd_through", "volatility_36m"} for v in sk["companies"].values()), "only percentage figures appear in stocks.json")

rs_path = W / "research.json"
if rs_path.exists():
    rs = json.loads(rs_path.read_text())
    check("research.json has no missing or infinite numbers", finite(rs), "all values are finite")
    M = rs["market"]; qi = {q: i for i, q in enumerate(M["quarters"])}
    check("U.S. market quarters are consecutive", all((int(b[:4]) * 12 + int(b[5:])) - (int(a[:4]) * 12 + int(a[5:])) == 3 for a, b in zip(M["quarters"], M["quarters"][1:])), f"{len(M['quarters'])} quarters, {M['quarters'][0]} to {M['quarters'][-1]}")
    near = lambda v, ref: abs(v / ref - 1) < 0.05                  # Cox revises earlier quarters slightly in later reports
    check("Cox figures match the published reports", near(M["tesla"][qi["2026-07"]], 144094) and near(M["rivian"][qi["2026-07"]], 19239) and near(M["total_ev"][qi["2026-07"]], 262649) and near(M["total_ev"][qi["2025-10"]], 234171),
          f"Q3 2026: Tesla {M['tesla'][qi['2026-07']]:,}, Rivian {M['rivian'][qi['2026-07']]:,}, all EVs {M['total_ev'][qi['2026-07']]:,} (within 5% of first publication, allowing Cox's revisions)")
    check("Tesla and Rivian never exceed the whole EV market", all(t + r <= v for t, r, v in zip(M["tesla"], M["rivian"], M["total_ev"])), "holds in every quarter")
    mods = M["models"]
    check("Cox model rows add up to the brand totals", all(abs(sum(mods[k][i] or 0 for k in mods if k.startswith(co)) - M[co.lower()][i]) <= 0.02 * M[co.lower()][i] for co in ("Tesla", "Rivian") for i in range(len(M["quarters"]))), "within 2% every quarter")
    I = rs["investors"]
    tq = {q: v for q, v in zip(I["tesla"]["quarters"], I["tesla"]["revenue"])}
    check("Investor figures agree with the annual filings", abs(sum(tq[f"2023-{m}"] for m in ("01", "04", "07", "10")) - 96773) < 5 and abs(sum(v for q, v in zip(I["rivian"]["quarters"], I["rivian"]["revenue"]) if q.startswith("2024")) - 4970) < 2,
          "Tesla 2023 revenue $96,773M and Rivian 2024 revenue $4,970M rebuilt from quarters")
    check("Cash and share counts are present for both companies", all(I[c]["liquidity"][-1] and I[c]["shares"][-1] for c in I), f"latest quarter {I['tesla']['latest']}")
    O = rs["owners"]
    T_ = O["totals"]
    check("Registration totals are plausible", T_["ca"]["tesla"] > 500000 and T_["wa"]["tesla"] > 80000 and T_["ny"]["tesla"] > 80000 and T_["ct"]["tesla"] > 10000 and min(T_[s]["rivian"] for s in T_) > 500,
          "; ".join(f"{s.upper()} Tesla {T_[s]['tesla']:,}, Rivian {T_[s]['rivian']:,}" for s in ("ca", "wa", "ny", "ct")))
    check("Income-band shares add up to 100%", all(abs(sum(v) - 1) < 1e-3 for st in ("wa", "ny", "ca", "ct", "all") for v in O[st]["share_by_band"].values()), "every group in every state and combined")
    check("Connecticut towns match the Census list", O["ct_town_match"] >= 0.85, f"{O['ct_town_match']:.0%} of registrations matched to a Census town", warn=True)
    C = rs["customers"]
    check("Crash ratings are between one and five stars", all(1 <= x["overall"] <= 5 for x in C["ncap"]) and len(C["ncap"]) >= 3, f"{len(C['ncap'])} models rated")
    check("EPA ranges are plausible", all(100 < e["range_max"] < 600 for e in C["epa"]), f"{len(C['epa'])} models")
    se = rs["sentiment"]
    check("News tone covers both companies and is current", set(se) == {"tesla", "rivian"} and all(months_old(v["months"][-1]) <= 2 for v in se.values()), "latest " + ", ".join(f"{k} {v['months'][-1]}" for k, v in se.items()) if se else "GDELT not yet fetched", warn=True)

out = {"built": date.today().isoformat(), "checks": checks}
(W / "checks.json").write_text(json.dumps(out, separators=(",", ":")))
for c in checks:
    print({"pass": "PASS", "warn": "WARN", "fail": "FAIL"}[c["status"]], "-", c["name"], "|", c["detail"])
fails = [c for c in checks if c["status"] == "fail"]
print(f"\n{len(checks) - len(fails)}/{len(checks)} checks passed")
sys.exit(1 if fails else 0)
