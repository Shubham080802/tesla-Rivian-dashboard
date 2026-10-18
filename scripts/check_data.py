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

B, T = ev["byd"]["months"], ev["tesla"]["quarters"]
ms = [r["m"] for r in B]
consec = all((int(b[:4]) * 12 + int(b[5:]) - int(a[:4]) * 12 - int(a[5:])) == 1 for a, b in zip(ms, ms[1:]))
check("BYD months are consecutive and recent", consec and months_old(ms[-1]) <= 3, f"{len(ms)} months, latest {ms[-1]} ({months_old(ms[-1])} months ago)")
yr = lambda y, k: sum(r[k] for r in B if r["m"].startswith(y))
check("BYD transcription matches published totals", yr("2022", "total") == 1863494 and yr("2023", "passenger") == 3012906 and abs(yr("2024", "total") - 4272145) < 1000 and abs(yr("2025", "total") - 4602436) < 1000,
      f"2022 total {yr('2022', 'total'):,}, 2023 passenger {yr('2023', 'passenger'):,}, 2024 total {yr('2024', 'total'):,}, 2025 total {yr('2025', 'total'):,}")
check("BYD passenger and overseas never exceed total", all((r["passenger"] or 0) <= r["total"] and (r["overseas"] or 0) <= r["total"] for r in B), "holds in every month")
d25 = sum(r["deliveries"] for r in T if r["q"].startswith("2025"))
check("Tesla 2025 deliveries match the published annual total", d25 == 1636129, f"{d25:,} delivered in 2025")
check("Tesla quarters are consecutive and recent", months_old(T[-1]["q"]) <= 6 and len(T) >= 28, f"{len(T)} quarters, latest {T[-1]['q']}")
check("Tesla production is within 25% of deliveries each quarter", all(abs(r["production"] / r["deliveries"] - 1) < 0.25 for r in T), "no implausible quarter")
for name, fc in (("Tesla deliveries", ev["tesla"]["forecast_deliveries"]), ("Tesla revenue", ev["tesla"]["forecast_revenue"]), ("BYD sales", ev["byd"]["forecast_total"]), ("BYD overseas", ev["byd"]["forecast_overseas"])):
    f = fc["fc"]
    check(f"{name} forecast is ordered and non-negative", all(0 <= lo <= m <= hi for lo, m, hi in zip(f["p10"], f["mean"], f["p90"])) and all(a <= b for q in fc["cumq"] for a, b in zip(q, q[1:])), f"{len(f['mean'])} periods, backtest error {fc['wmape']:.0%}")
    check(f"{name} 80% range held up in backtests", 0.6 <= fc["coverage80"] <= 0.97, f"coverage {fc['coverage80']:.0%} (target 80%)", warn=True)

fin = vs["fin"]; yrs = fin["years"]; i23 = yrs.index(2023)
check("Annual financials cover consecutive years to last year", yrs == list(range(yrs[0], yrs[-1] + 1)) and yrs[-1] >= date.today().year - 2, f"{yrs[0]} to {yrs[-1]}")
check("Tesla 2023 revenue matches the filing", abs(fin["tesla"]["revenue"][i23] - 96773) < 5, f"${fin['tesla']['revenue'][i23] / 1e3:.2f}B")
check("BYD revenue converts back to the reported RMB", all(abs(u * r - m) / m < 0.001 for u, r, m in zip(fin["byd_usd"]["revenue"], fin["cny_per_usd"], fin["byd_rmb"]["revenue"])), "USD x rate equals the report within 0.1%")
check("BYD 2025 revenue matches the annual report", abs(fin["byd_rmb"]["revenue"][yrs.index(2025)] - 803964.958) < 1, "RMB 803,965 million")
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
    check("Europe registrations are plausible", 300000 < t24 < 350000 and 220000 < t25 < 260000 and all(v is None or v > 0 for v in eu["byd"]), f"Tesla Europe {t24:,} in 2024 and {t25:,} in 2025")
    import csv as _csv
    prim = list(_csv.DictReader(open(ROOT / "data" / "external" / "ev" / "acea_primary_rows.csv")))
    key = {(r["release_month"], r["company"]): r for r in prim}
    idx = {m: k for k, m in enumerate(eu["months"])}
    bad = [f"{rm} {co}" for (rm, co), r in key.items() if (eu["tesla"] if co == "Tesla" else eu["byd"])[idx[rm]] != int(r["month_value"]) or (eu["tesla"] if co == "Tesla" else eu["byd"])[idx[str(int(rm[:4]) - 1) + rm[4:]]] != int(r["same_month_last_year"])]
    check("Europe months equal the figures read from ACEA's press releases", not bad, f"{len(key)} release rows checked, including the restated 2025 months" if not bad else f"differences in: {bad}")
    gaps = []
    for co, arr in (("Tesla", eu["tesla"]), ("BYD", eu["byd"])):
        for rm in ("2026-06", "2026-08"):
            s = sum(v or 0 for m, v in zip(eu["months"], arr) if m.startswith("2026") and m <= rm)
            ytd = int(key[(rm, co)]["year_to_date"])
            if abs(s / ytd - 1) > 0.02:
                gaps.append(f"{co} to {rm}: {s / ytd - 1:+.1%}")
    check("Europe monthly sums stay within 2% of ACEA's year-to-date totals", not gaps, "revisions to earlier months explain the small difference (BYD about 1.5%)" if not gaps else "; ".join(gaps))
    check("Europe data is current", months_old(eu["months"][-1]) <= 4, f"latest {eu['months'][-1]} (ACEA publishes about three weeks after month end; see docs/TODO.md)", warn=True)

sk_path = W / "stocks.json"
if sk_path.exists():
    sk = json.loads(sk_path.read_text())
    check("stocks.json has no missing or infinite numbers", finite(sk), "all values are finite")
    t = {r["year"]: r["stock_return"] for r in sk["years"] if r["company"] == "Tesla"}
    check("Tesla yearly share price changes match the published record", abs(t[2020] - 7.434) < 0.01 and abs(t[2021] - 0.498) < 0.01 and abs(t[2022] + 0.650) < 0.01 and abs(t[2023] - 1.017) < 0.01 and abs(t[2024] - 0.625) < 0.01,
          "2020 +743%, 2021 +50%, 2022 -65%, 2023 +102%, 2024 +63% (split-adjusted, price only)")
    byd = {r["year"]: r["revenue_growth"] for r in sk["years"] if r["company"] == "BYD"}
    check("BYD revenue growth in the stock table matches the annual reports", abs(byd[2022] - (424060.635 / 216142.395 - 1)) < 0.001 and abs(byd[2025] - (803964.958 / 777102.455 - 1)) < 0.001, "2022 +96.2%, 2025 +3.5%")
    check("Share price data is current", months_old(sk["meta"]["through"]) <= 3, f"through {sk['meta']['through']} (refreshed by hand; not part of the daily job)", warn=True)
    check("No raw prices are published", all(set(r) <= {"company", "year", "stock_return", "revenue_growth", "volume_growth"} for r in sk["years"]) and set(sk["companies"]["Tesla"]) <= {"symbol", "ytd_return", "ytd_through", "volatility_36m"}, "only percentage figures appear in stocks.json")

# the Tableau export must agree with the dashboard's own rule
import subprocess
tab = ROOT / "tableau" / "outlook.csv"
if tab.exists():
    try:
        import pandas as pd
        js = {r["series"]: r["p"] for r in json.loads(subprocess.run(["node", str(ROOT / "scripts" / "rules_probe.js")], capture_output=True, text=True, check=True).stdout)}
        csv_ = pd.read_csv(tab).set_index("series").chance_of_growth.to_dict()
        diffs = [k for k in js if abs(js[k] - csv_.get(k, -1)) > 1e-3]
        check("The Tableau export gives the same chance of growth as the dashboard", not diffs and len(js) == len(csv_), f"{len(js)} series compared" if not diffs else f"differences in: {diffs}")
    except FileNotFoundError:
        check("The Tableau export gives the same chance of growth as the dashboard", False, "Node is not installed, so the dashboard's rule could not be run for comparison", warn=True)
else:
    check("The Tableau export has been generated", False, "run python scripts/export_tableau.py", warn=True)

out = {"built": date.today().isoformat(), "checks": checks}
(W / "checks.json").write_text(json.dumps(out, separators=(",", ":")))
for c in checks:
    print({"pass": "PASS", "warn": "WARN", "fail": "FAIL"}[c["status"]], "-", c["name"], "|", c["detail"])
fails = [c for c in checks if c["status"] == "fail"]
print(f"\n{len(checks) - len(fails)}/{len(checks)} checks passed")
sys.exit(1 if fails else 0)
