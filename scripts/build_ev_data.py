"""Tesla and BYD: reported volumes, Tesla's SEC financials, and forecasts, written to web/ev.json (additive).

Sources (all public):
  * Tesla deliveries/production by quarter: Tesla's own 8-K Exhibit 99.1 releases, via the datahub.io
    "tesla-quarterly-deliveries" snapshot (Q2 2019 to Q2 2026), plus the latest quarter read by hand from the 8-K
    (data/external/ev/tesla_q3_2026_manual.csv, with its accession number).
  * Tesla financials: SEC EDGAR company facts (CIK 1318605), quarters filled only by accounting identities.
  * BYD monthly NEV sales, passenger NEVs and overseas sales: BYD's monthly HKEX announcements as tabulated by CnEVPost
    (data/external/ev/byd_monthly_sales.csv, Jan 2022 to Sep 2026). Spot-checked against HKEX filings for May, Jun, Aug 2026.
    The figures are unaudited and BYD may adjust them; "overseas" definitions differ between sources.
Forecasts use the same backtested engine as the rest of the dashboard.

Usage: python scripts/build_ev_data.py       (network only needed to refresh the SEC cache)
"""
import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "scripts"))
from forecast_engine import forecast_series  # noqa: E402
import common as bm  # noqa: E402  (HTTP fetch and the SEC quarterly-from-YTD helper)

EV = ROOT / "data" / "external" / "ev"
TSLA_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK0001318605.json"
TAGS = {
    "revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax"],
    "gross_profit": ["GrossProfit"],
    "operating_income": ["OperatingIncomeLoss"],
    "net_income": ["NetIncomeLoss"],
    "operating_cash_flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment"],
}
qkey = lambda end: f"{end[:4]}-{int(end[5:7]) - 2:02d}"        # quarter label = first month, as elsewhere in the project


def tesla_financials():
    path = EV / "tesla_quarterly_financials.csv"
    try:
        facts = json.loads(bm.get(TSLA_URL, {"User-Agent": bm.SEC_UA}))["facts"]["us-gaap"]
        table, derived = {}, {}
        for name, tags in TAGS.items():
            vals, how = bm.quarterly_from_facts(facts, tags)
            for end, v in vals.items():
                table.setdefault(qkey(end), {})[name] = v / 1e6
                if how[end] != "reported":
                    derived.setdefault(qkey(end), {})[name] = how[end]
        df = pd.DataFrame(table).T.sort_index(); df.index.name = "quarter"
        df.to_csv(path); (EV / "tesla_quarterly_derived.json").write_text(json.dumps(derived, indent=1, sort_keys=True))
        print("SEC (Tesla):", len(df), "quarters, latest", df.index[-1])
    except Exception as e:
        print("SEC fetch failed, using cache:", e)
    return pd.read_csv(path, index_col=0)


def tesla_volumes():
    t = pd.read_csv(EV / "tesla_quarterly_totals_datahub.csv", parse_dates=["period_start"])
    t["quarter"] = t.period_start.dt.strftime("%Y-%m")
    t = t.set_index("quarter")[["deliveries", "production"]]
    m = pd.read_csv(EV / "tesla_q3_2026_manual.csv", parse_dates=["period_start"])
    for _, r in m.iterrows():
        t.loc[r.period_start.strftime("%Y-%m")] = [r.deliveries, r.production]
    t = t.sort_index()
    g = pd.read_csv(EV / "tesla_quarterly_by_model_datahub.csv", parse_dates=["period_start"])
    g = g[(g.metric == "deliveries") & g.vehicle_group.isin(["Model 3/Y", "Other Models"])]
    g = g.assign(quarter=g.period_start.dt.strftime("%Y-%m")).pivot_table(index="quarter", columns="vehicle_group", values="vehicles")
    t["model_3y"] = g.get("Model 3/Y")
    for _, r in m.iterrows():
        t.loc[r.period_start.strftime("%Y-%m"), "model_3y"] = r.model_3y_deliveries
    return t


def nn(v):
    return None if pd.isna(v) else round(float(v), 1)


def main():
    tv, fin = tesla_volumes(), tesla_financials()
    # Tesla: quarterly deliveries forecast (season 4, 3 months a step)
    last_q = tv.index[-1]
    fc_t = forecast_series(tv.deliveries.to_numpy(float), last_q, season=4, step=3, horizon=6, origins=(8, 6, 4), min_history=16, monitor=True, monitor_n=8)
    tq = []
    for q, r in tv.iterrows():
        row = {"q": q, "deliveries": int(r.deliveries), "production": int(r.production), "model_3y": None if pd.isna(r.model_3y) else int(r.model_3y)}
        if q in fin.index:
            row.update({k: nn(fin.loc[q, k]) for k in fin.columns})
        tq.append(row)
    fin_extra = [{"q": q, **{k: nn(v) for k, v in r.items()}} for q, r in fin.iterrows() if q > last_q]   # SEC may be ahead of the delivery release
    # Tesla revenue: quarterly forecast on the SEC series (contiguous quarters only)
    fr = fin["revenue"].dropna()
    qi = [int(q[:4]) * 4 + (int(q[5:7]) - 1) // 3 for q in fr.index]
    start = max([k for k in range(1, len(qi)) if qi[k] - qi[k - 1] != 1] + [0])
    fr = fr.iloc[start:]
    fc_r = forecast_series(fr.to_numpy(float), fr.index[-1], season=4, step=3, horizon=6, origins=(8, 6, 4), min_history=16, monitor=True, monitor_n=8)
    # BYD: monthly NEV sales forecast (season 12)
    b = pd.read_csv(EV / "byd_monthly_sales.csv").set_index("month")
    assert (b.passenger_nev.fillna(0) <= b.total_nev).all() and (b.overseas.fillna(0) <= b.total_nev).all() and b.index.is_monotonic_increasing
    last_m = b.index[-1]
    fc_b = forecast_series(b.total_nev.to_numpy(float), last_m, season=12, step=1, horizon=12, origins=(12, 9, 6), min_history=36, monitor=True, monitor_n=12)
    fc_o = forecast_series(b.overseas.dropna().to_numpy(float), last_m, season=12, step=1, horizon=12, origins=(12, 9, 6), min_history=36, monitor=True, monitor_n=12)
    out = {
        "meta": {"built": dt.date.today().isoformat(), "tesla_latest_quarter": last_q, "byd_latest_month": last_m,
                 "tesla_sources": {"deliveries": "https://datahub.io/datapressr/tesla-quarterly-deliveries", "q3_2026": "Tesla 8-K filed 2026-10-02, Exhibit 99.1", "sec": "https://www.sec.gov/edgar/browse/?CIK=1318605"},
                 "byd_sources": {"monthly": "https://cnevpost.com/2026/10/01/byd-sept-2026-sales/", "filings": "https://www.hkexnews.hk/"},
                 "notes": {"byd": "BYD's monthly figures are unaudited, reported in HKEX announcements, and may be adjusted. Overseas definitions differ between sources.",
                           "tesla": "Deliveries are not sales revenue; quarterly financials come from SEC filings."}},
        "tesla": {"quarters": tq, "forecast_deliveries": fc_t, "forecast_revenue": fc_r, "revenue_latest_quarter": fr.index[-1], "financials_ahead": fin_extra},
        "byd": {"months": [{"m": m_, "total": int(r.total_nev), "passenger": None if pd.isna(r.passenger_nev) else int(r.passenger_nev), "overseas": None if pd.isna(r.overseas) else int(r.overseas)} for m_, r in b.iterrows()],
                "forecast_total": fc_b, "forecast_overseas": fc_o},
    }
    path = ROOT / "web" / "ev.json"
    path.write_text(json.dumps(out, separators=(",", ":"), allow_nan=False))
    print(f"wrote {path} ({path.stat().st_size / 1024:.0f} KB)")
    for name, fc in (("Tesla deliveries", fc_t), ("Tesla revenue ($M)", fc_r), ("BYD total", fc_b), ("BYD overseas", fc_o)):
        print(name, "->", fc["model"], "wMAPE", fc["wmape"], "| next:", round(fc["fc"]["mean"][0]), f"({round(fc['fc']['p10'][0])}-{round(fc['fc']['p90'][0])})")


if __name__ == "__main__":
    main()
