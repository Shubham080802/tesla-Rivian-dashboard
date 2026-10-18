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
check("BYD transcription matches published totals", yr("2023", "passenger") == 3012906 and abs(yr("2024", "total") - 4272145) < 1000 and abs(yr("2025", "total") - 4602436) < 1000,
      f"2023 passenger {yr('2023', 'passenger'):,}, 2024 total {yr('2024', 'total'):,}, 2025 total {yr('2025', 'total'):,}")
check("BYD passenger and overseas never exceed total", all(r["passenger"] <= r["total"] and r["overseas"] <= r["total"] for r in B), "holds in every month")
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
