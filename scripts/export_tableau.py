"""Tidy CSVs for Tableau (Desktop, Cloud or Public) from the dashboard's own data. Writes tableau/*.csv.

One row per observation, plain column names, ISO dates, so each file connects directly and joins on `company` or `series`.
The outlook table repeats the dashboard's own rule (chance of growth from the stored forecast quantiles), and
scripts/check_data.py proves the two agree.
Usage: python scripts/export_tableau.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
W, OUT = ROOT / "web", ROOT / "tableau"
OUT.mkdir(exist_ok=True)
ev = json.loads((W / "ev.json").read_text())
vs = json.loads((W / "versus.json").read_text())
dr = json.loads((W / "drivers.json").read_text())
qd = lambda q: f"{q}-01"                       # quarter labels are the first month, so Tableau reads them as dates
QL = np.round(np.arange(0.05, 0.951, 0.05), 2)


def prob_at_least(qv, x):
    """Same rule as probAtLeast in web/core.js: linear between the stored quantiles, capped at 0.97 and 0.03."""
    if x <= qv[0]:
        return 0.97
    if x >= qv[-1]:
        return 0.03
    for i in range(1, len(qv)):
        if x <= qv[i]:
            w = 0 if qv[i] == qv[i - 1] else (x - qv[i - 1]) / (qv[i] - qv[i - 1])
            return 1 - (QL[i - 1] + w * (QL[i] - QL[i - 1]))
    return 0.03


def save(name, df):
    df.to_csv(OUT / name, index=False)
    print(f"{name}: {len(df):,} rows")


# volumes
B = pd.DataFrame(ev["byd"]["months"])
save("volumes_monthly.csv", pd.concat([B.assign(company="BYD", metric=m_, value=B[k], month=B.m + "-01")[["company", "month", "metric", "value"]].dropna() for m_, k in (("NEV sales", "total"), ("Passenger NEV sales", "passenger"), ("Overseas sales", "overseas"))]))
T = pd.DataFrame(ev["tesla"]["quarters"])
vol = pd.concat([T.assign(company="Tesla", metric=m_, value=T[k], quarter_start=T.q.map(qd))[["company", "quarter_start", "metric", "value"]].dropna() for m_, k in (("Deliveries", "deliveries"), ("Production", "production"), ("Model 3/Y deliveries", "model_3y"))])
RVq = pd.DataFrame(ev["rivian"]["quarters"])
vol = pd.concat([vol] + [RVq.assign(company="Rivian", metric=m_, value=RVq[k], quarter_start=RVq.q.map(qd))[["company", "quarter_start", "metric", "value"]] for m_, k in (("Deliveries", "deliveries"), ("Production", "production"))])
save("volumes_quarterly.csv", vol)
fin_cols = {"revenue": "Revenue", "gross_profit": "Gross profit", "operating_income": "Operating income", "net_income": "Net income", "operating_cash_flow": "Operating cash flow", "capex": "Capital spending"}
save("tesla_financials_quarterly.csv", pd.concat([T.assign(company="Tesla", metric=lab, value_usd_m=T[k], quarter_start=T.q.map(qd))[["company", "quarter_start", "metric", "value_usd_m"]].dropna() for k, lab in fin_cols.items() if k in T]))

# annual financials in both currencies
F = vs["fin"]; Y = F["years"]; rows = []
for k, lab in (("revenue", "Revenue"), ("gross_profit", "Gross profit"), ("net_income", "Net income")):
    for i, y in enumerate(Y):
        rows.append({"company": "Tesla", "year": y, "metric": lab, "value_usd_m": F["tesla"][k][i], "value_local_m": F["tesla"][k][i], "currency": "USD", "cny_per_usd": None})
        rows.append({"company": "BYD", "year": y, "metric": lab, "value_usd_m": F["byd_usd"][k][i], "value_local_m": (F["byd_rmb"].get(k) or [None] * len(Y))[i], "currency": "RMB", "cny_per_usd": F["cny_per_usd"][i]})
        if F.get("rivian") and F["rivian"][k][i] is not None:
            rows.append({"company": "Rivian", "year": y, "metric": lab, "value_usd_m": F["rivian"][k][i], "value_local_m": F["rivian"][k][i], "currency": "USD", "cny_per_usd": None})
ann = pd.DataFrame(rows)
bydfull = pd.read_csv(ROOT / "data" / "external" / "ev" / "byd_annual_financials.csv").set_index("year")
m = (ann.company == "BYD") & (ann.metric == "Gross profit"); ann.loc[m, "value_local_m"] = ann.loc[m, "year"].map(bydfull.gross_profit_rmb_m)
save("annual_financials.csv", ann)

# attention and charging
save("attention_monthly.csv", pd.concat([pd.DataFrame({"company": {"tesla": "Tesla", "byd": "BYD", "rivian": "Rivian"}[co], "month": [x + "-01" for x in v["months"]], "wikipedia_views": v["views"]}) for co, v in vs["pageviews"].items()]))
save("tesla_chargers_by_year.csv", pd.DataFrame({"year": vs["chargers"]["years"], "stations_opened": vs["chargers"]["stations"], "fast_ports_opened": vs["chargers"]["fast_ports"]}).assign(cumulative_stations=lambda d: d.stations_opened.cumsum()))

# forecasts and outlook
SER = [("tsl_del", "Tesla deliveries", "Tesla", ev["tesla"]["forecast_deliveries"], tuple(T.deliveries), 3), ("tsl_rev", "Tesla revenue ($M)", "Tesla", ev["tesla"]["forecast_revenue"], tuple(T.revenue.dropna()), 3),
       ("byd_total", "BYD NEV sales", "BYD", ev["byd"]["forecast_total"], tuple(B.total), 1), ("byd_over", "BYD overseas sales", "BYD", ev["byd"]["forecast_overseas"], tuple(B.overseas.dropna()), 1),
       ("riv_del", "Rivian deliveries", "Rivian", ev["rivian"]["forecast_deliveries"], tuple(RVq.deliveries), 3), ("riv_rev", "Rivian revenue ($M)", "Rivian", ev["rivian"]["forecast_revenue"], tuple(RVq.revenue[RVq.revenue > 0].dropna()), 3)]
fc_rows, out_rows = [], []
for sid, label, co, fc, hist, step in SER:
    f = fc["fc"]
    for k, mo in enumerate(f["month"]):
        fc_rows.append({"series": label, "company": co, "period_start": qd(mo) if step == 3 else mo + "-01", "expected": f["mean"][k], "p05": f["p05"][k], "p10": f["p10"][k], "p90": f["p90"][k], "p95": f["p95"][k], "model": fc["model"], "backtest_error": fc["wmape"]})
    n = 4 if step == 3 else 12
    last12, prior12, fc12 = sum(hist[-n:]), sum(hist[-2 * n:-n]), sum(f["mean"][:n]); q = fc["cumq"][n - 1]
    p = prob_at_least(q, last12)
    out_rows.append({"series": label, "company": co, "last_12m": last12, "prior_12m": prior12, "expected_next_12m": fc12, "range_low_p10": q[1], "range_high_p90": q[17], "growth": fc12 / last12 - 1, "chance_of_growth": round(p, 4),
                     "reliability": "High" if fc["wmape"] <= 0.15 else "Medium" if fc["wmape"] <= 0.30 else "Low", "outlook": "Expanding" if p >= 0.7 else "Contracting" if p <= 0.3 else "Uncertain", "backtest_error": fc["wmape"], "coverage80": fc["coverage80"]})
save("forecasts.csv", pd.DataFrame(fc_rows)); save("outlook.csv", pd.DataFrame(out_rows))

# drivers
save("drivers_series.csv", pd.concat([pd.DataFrame({"driver": v["label"], "date": [d + "-01" for d in v["dates"]], "value": v["values"], "unit": v["unit"]}) for v in dr["series"].values()]))
save("driver_tests.csv", pd.DataFrame(dr["tests"]).rename(columns={"label": "driver", "p": "raw_p", "p_adj": "adjusted_p", "n_eff": "effective_n"}))

# regions
if (W / "regions.json").exists():
    rg = json.loads((W / "regions.json").read_text())
    tc = rg["tesla_china"]
    save("tesla_china_monthly.csv", pd.DataFrame({"month": [m + "-01" for m in tc["months"]], "domestic": tc["domestic"], "exports": tc["exports"]}).assign(wholesale=lambda d: d.domestic + d.exports, export_share=lambda d: d.exports / d.wholesale))
    bh = rg["byd_home"]
    save("byd_home_vs_overseas_monthly.csv", pd.DataFrame({"month": [m + "-01" for m in bh["months"]], "home_and_other": bh["home"], "overseas": bh["overseas"]}).assign(overseas_share=lambda d: d.overseas / (d.overseas + d.home_and_other)))
    eu = rg["europe"]
    save("europe_registrations_monthly.csv", pd.concat([pd.DataFrame({"company": co, "month": [m + "-01" for m in eu["months"]], "registrations": eu[k]}).dropna() for co, k in (("Tesla", "tesla"), ("BYD", "byd"))]))

# stock vs business (derived percentages only)
if (W / "stocks.json").exists():
    sk = json.loads((W / "stocks.json").read_text())
    save("stock_vs_business.csv", pd.DataFrame(sk["years"]))

# checks
ck = json.loads((W / "checks.json").read_text())
save("data_checks.csv", pd.DataFrame(ck["checks"]).rename(columns={"status": "result"}))
