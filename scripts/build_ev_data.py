"""Tesla, Rivian and Lucid: reported volumes, Tesla's SEC financials, and forecasts, written to web/ev.json (additive).

Sources (all public):
  * Tesla deliveries/production by quarter: Tesla's own 8-K Exhibit 99.1 releases, via the datahub.io
    "tesla-quarterly-deliveries" snapshot (Q2 2019 to Q2 2026), plus the latest quarter read by hand from the 8-K
    (data/external/ev/tesla_q3_2026_manual.csv, with its accession number).
  * Tesla financials: SEC EDGAR company facts (CIK 1318605), quarters filled only by accounting identities.
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
    "cost_of_revenue": ["CostOfRevenue", "CostOfGoodsAndServicesSold"],
}
qkey = lambda end: f"{end[:4]}-{int(end[5:7]) - 2:02d}"        # quarter label = first month, as elsewhere in the project


def sec_financials(cik, name):
    """Quarterly SEC figures ($ millions) for one company, cached as data/external/ev/<name>_quarterly_financials.csv."""
    path = EV / f"{name}_quarterly_financials.csv"
    try:
        url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
        facts = json.loads(bm.get(url, {"User-Agent": bm.SEC_UA}))["facts"]["us-gaap"]
        table, derived = {}, {}
        for col, tags in TAGS.items():
            vals, how = bm.quarterly_from_facts(facts, tags)
            for end, v in vals.items():
                table.setdefault(qkey(end), {})[col] = v / 1e6
                if how[end] != "reported":
                    derived.setdefault(qkey(end), {})[col] = how[end]
        df = pd.DataFrame(table).T.sort_index(); df.index.name = "quarter"
        if "cost_of_revenue" in df:                     # Lucid files cost of revenue but no gross-profit line
            df["gross_profit"] = df.get("gross_profit", pd.Series(index=df.index, dtype=float)).fillna(df.revenue - df.cost_of_revenue)
            df = df.drop(columns="cost_of_revenue")
        df.to_csv(path); (EV / f"{name}_quarterly_derived.json").write_text(json.dumps(derived, indent=1, sort_keys=True))
        print(f"SEC ({name}):", len(df), "quarters, latest", df.index[-1])
    except Exception as e:
        print(f"SEC fetch failed for {name}, using cache:", e)
    return pd.read_csv(path, index_col=0)


def tesla_financials():
    return sec_financials(1318605, "tesla")


def contiguous(series):
    """The latest unbroken run of quarters (forecasts need evenly spaced history)."""
    s = series.dropna()
    qi = [int(q[:4]) * 4 + (int(q[5:7]) - 1) // 3 for q in s.index]
    start = max([k for k in range(1, len(qi)) if qi[k] - qi[k - 1] != 1] + [0])
    return s.iloc[start:]


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


def challenger(name, cik):
    """Rivian and Lucid: quarterly volumes typed in from their 8-K releases (data/external/ev/<name>_quarterly.csv),
    financials from SEC, and the same backtested forecasts as Tesla."""
    v = pd.read_csv(EV / f"{name}_quarterly.csv", parse_dates=["quarter_start"])
    v["q"] = v.quarter_start.dt.strftime("%Y-%m"); v = v.set_index("q")
    f = sec_financials(cik, name)
    fc_v = forecast_series(v.deliveries.to_numpy(float), v.index[-1], season=4, step=3, horizon=6, origins=(8, 6, 4), min_history=16, monitor=True, monitor_n=8)
    fr = contiguous(f["revenue"][f["revenue"] > 0])
    fc_r = forecast_series(fr.to_numpy(float), fr.index[-1], season=4, step=3, horizon=6, origins=(8, 6, 4), min_history=12, monitor=True, monitor_n=8)
    rows = []
    for q, r in v.iterrows():
        row = {"q": q, "deliveries": int(r.deliveries), "production": None if pd.isna(r.production) else int(r.production)}
        if q in f.index:
            row.update({k: nn(f.loc[q, k]) for k in f.columns})
        rows.append(row)
    return v, rows, fc_v, fc_r, fr


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
    fr = contiguous(fin["revenue"])
    fc_r = forecast_series(fr.to_numpy(float), fr.index[-1], season=4, step=3, horizon=6, origins=(8, 6, 4), min_history=16, monitor=True, monitor_n=8)
    rv, rq, fc_rv, fc_rvr, rfr = challenger("rivian", 1874178)
    lv, lq, fc_lv, fc_lvr, lfr = challenger("lucid", 1811210)
    out = {
        "meta": {"built": dt.date.today().isoformat(), "tesla_latest_quarter": last_q, "rivian_latest_quarter": rv.index[-1], "lucid_latest_quarter": lv.index[-1],
                 "tesla_sources": {"deliveries": "https://datahub.io/datapressr/tesla-quarterly-deliveries", "q3_2026": "Tesla 8-K filed 2026-10-02, Exhibit 99.1", "sec": "https://www.sec.gov/edgar/browse/?CIK=1318605"},
                 "notes": {"tesla": "Deliveries are not sales revenue; quarterly financials come from SEC filings."}},
        "tesla": {"quarters": tq, "forecast_deliveries": fc_t, "forecast_revenue": fc_r, "revenue_latest_quarter": fr.index[-1], "financials_ahead": fin_extra},
        "rivian": {"quarters": rq, "forecast_deliveries": fc_rv, "forecast_revenue": fc_rvr, "revenue_latest_quarter": rfr.index[-1],
                   "sources": {"deliveries": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1874178&type=8-K", "sec": "https://www.sec.gov/edgar/browse/?CIK=1874178"},
                   "note": "Rivian reports production and deliveries each quarter in an 8-K; financials come from its SEC filings. It does not break deliveries out by model."},
        "lucid": {"quarters": lq, "forecast_deliveries": fc_lv, "forecast_revenue": fc_lvr, "revenue_latest_quarter": lfr.index[-1],
                  "sources": {"deliveries": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1811210&type=8-K", "sec": "https://www.sec.gov/edgar/browse/?CIK=1811210"},
                  "note": "Lucid reports production and deliveries each quarter in an 8-K (production for Q1 and Q2 2022 was published only as a first-half total); financials come from its SEC filings."},
    }
    path = ROOT / "web" / "ev.json"
    path.write_text(json.dumps(out, separators=(",", ":"), allow_nan=False))
    print(f"wrote {path} ({path.stat().st_size / 1024:.0f} KB)")
    for name, fc in (("Tesla deliveries", fc_t), ("Tesla revenue ($M)", fc_r), ("Rivian deliveries", fc_rv), ("Rivian revenue ($M)", fc_rvr), ("Lucid deliveries", fc_lv), ("Lucid revenue ($M)", fc_lvr)):
        print(name, "->", fc["model"], "wMAPE", fc["wmape"], "| next:", round(fc["fc"]["mean"][0]), f"({round(fc['fc']['p10'][0])}-{round(fc['fc']['p90'][0])})")


if __name__ == "__main__":
    main()
