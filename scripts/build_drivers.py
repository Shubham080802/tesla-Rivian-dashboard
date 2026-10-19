"""Demand drivers for EVs (U.S. macro series from FRED) and an exploratory test of whether they line up with
Tesla and Rivian deliveries. Writes web/drivers.json (additive).

Honest limits: Tesla has about 26 usable year-over-year quarters and Rivian about 15, which is little data, and Tesla's
volumes are also shaped by China and Europe, which these U.S. series do not capture. The test is therefore labelled exploratory:
growth in the indicator vs growth in volumes (year over year), at lag 0 and at a one-period lead. Overlapping year-over-year
windows inflate significance, so the headline p-value uses an effective sample (n/12 monthly, n/4 quarterly) and a Bonferroni
correction. 'Yes' needs to pass both; a raw p below 0.05 alone is only 'Suggestive'; otherwise 'No'.
Usage: python scripts/build_drivers.py
"""
import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402

ROOT = common.ROOT
SERIES = [  # id, label, kind ('level' = compare log growth, 'rate' = compare change in points), unit, publisher
    ("GASREGW", "U.S. regular gasoline price", "level", "dollars per gallon", "U.S. Energy Information Administration"),
    ("TERMCBAUTO48NS", "New-car loan rate, 48 months", "rate", "percent", "Federal Reserve Board"),
    ("TOTALSA", "U.S. light vehicle sales", "level", "millions of units, annual rate", "Bureau of Economic Analysis"),
    ("CUSR0000SETA01", "Consumer prices: new vehicles", "level", "index, 1982-84 = 100", "Bureau of Labor Statistics"),
    ("UMCSENT", "Consumer sentiment", "level", "index, 1966 Q1 = 100", "University of Michigan"),
    ("FEDFUNDS", "Federal funds rate", "rate", "percent", "Federal Reserve Board"),
]


def yoy(s, kind, lag):
    return np.log(s / s.shift(lag)) if kind == "level" else s - s.shift(lag)


def test(vol_g, ind_g, lead, overlap):
    """Year-over-year windows overlap (each month shares 11 of 12 months with the next), so the usual p-value is far too
    optimistic. p_adj uses an effective sample of n / overlap (12 for monthly, 4 for quarterly) instead."""
    d = pd.concat([vol_g, ind_g.shift(lead)], axis=1, keys=["y", "x"]).dropna()
    if len(d) < 12:
        return None
    r, p = stats.pearsonr(d.y, d.x)
    ne = len(d) / overlap
    t = r * np.sqrt(max(ne - 2, 0.1) / max(1 - r * r, 1e-9))
    p_adj = float(2 * stats.t.sf(abs(t), max(ne - 2, 1)))
    return {"n": int(len(d)), "n_eff": round(float(ne), 1), "r": round(float(r), 2), "p": round(float(p), 3), "p_adj": round(p_adj, 3), "lead": lead}


def main():
    ev = json.loads((ROOT / "web" / "ev.json").read_text())
    tq = pd.Series({q["q"]: q["deliveries"] for q in ev["tesla"]["quarters"]}, dtype=float)
    tq.index = pd.PeriodIndex([f"{q[:4]}Q{(int(q[5:7]) - 1) // 3 + 1}" for q in tq.index], freq="Q")
    rq = pd.Series({q["q"]: q["deliveries"] for q in ev["rivian"]["quarters"]}, dtype=float)
    rq.index = pd.PeriodIndex([f"{q[:4]}Q{(int(q[5:7]) - 1) // 3 + 1}" for q in rq.index], freq="Q")
    tg, rg = np.log(tq / tq.shift(4)).dropna(), np.log(rq / rq.shift(4)).dropna()
    alpha = 0.05 / (len(SERIES) * 2 * 2)                       # indicators x leads x companies
    out_series, rows = {}, []
    for sid, label, kind, unit, pub in SERIES:
        s = common.fred(sid)
        if len(s) > 1 and (s.index[1] - s.index[0]).days < 20:  # weekly -> monthly average
            s = s.resample("MS").mean().dropna()
        sm = s.copy(); sm.index = sm.index.to_period("M")
        m_ = sm.groupby(level=0).mean() if sm.index.is_monotonic_increasing else sm
        # monthly view for the chart (quarterly series are carried as-is at their dates)
        shown = s[s.index >= "2018-01-01"]
        out_series[sid] = {"label": label, "kind": kind, "unit": unit, "publisher": pub, "dates": shown.index.strftime("%Y-%m").tolist(), "values": [round(float(v), 3) for v in shown.values]}
        qv = s.copy(); qv.index = qv.index.to_period("Q"); qv = qv.groupby(level=0).mean()
        mv = s.copy(); mv.index = mv.index.to_period("M"); mv = mv.groupby(level=0).mean()
        for lead in (0, 1):
            for co, g, v, lag in (("Tesla", tg, qv, 4), ("Rivian", rg, qv, 4)):
                res = test(g, yoy(v, kind, lag), lead, lag)
                if res:
                    rows.append({"id": sid, "label": label, "company": co, **res})
    for r in rows:
        r["verdict"] = "Yes" if r["p_adj"] < alpha else "Suggestive" if r["p"] < 0.05 else "No"
    best = {}
    for r in rows:                                               # strongest result per indicator and company
        k = (r["id"], r["company"])
        if k not in best or abs(r["r"]) > abs(best[k]["r"]):
            best[k] = r
    out = {"meta": {"built": dt.date.today().isoformat(), "alpha": round(alpha, 4), "comparisons": len(rows), "latest": max(v["dates"][-1] for v in out_series.values())},
           "series": out_series, "tests": list(best.values())}
    path = ROOT / "web" / "drivers.json"
    path.write_text(json.dumps(out, separators=(",", ":"), allow_nan=False))
    print(f"wrote {path} ({path.stat().st_size / 1024:.0f} KB), alpha {alpha:.4f}")
    for r in sorted(best.values(), key=lambda r: r["p"])[:6]:
        print(f"  {r['verdict']:<10} {r['company']:<6} {r['label']:<34} lead {r['lead']} r={r['r']:+.2f} raw p={r['p']:.3f} adjusted p={r['p_adj']:.3f} n={r['n']} (effective {r['n_eff']})")


if __name__ == "__main__":
    main()
