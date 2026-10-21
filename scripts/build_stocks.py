"""Stock performance vs the business: calendar-year price returns for Tesla (TSLA), Rivian (RIVN) and Lucid (LCID), all US-listed, set against
revenue and volume growth -> web/stocks.json (additive).

DATA TERMS, PLEASE READ: no free monthly price source clearly allows republishing prices. Monthly closes are fetched from Yahoo
Finance's chart endpoint, whose terms limit it to personal use, so this script is meant to be run by hand on your own machine,
the raw monthly closes are kept in a git-ignored local cache (data/external/ev/stock_monthly_local.csv), and ONLY derived
figures are published: calendar-year percentage changes, year-to-date change and annualised volatility. Prices are
split-adjusted closes in US dollars, without dividends. If Yahoo cannot be
reached, the script reuses the committed derived file (data/external/ev/stock_derived.json). It is NOT part of the daily
GitHub Action.
Usage: python scripts/build_stocks.py
"""
import datetime as dt
import json
import math
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
EV = ROOT / "data" / "external" / "ev"
LOCAL = EV / "stock_monthly_local.csv"             # git-ignored raw closes
DERIVED = EV / "stock_derived.json"                 # committed: only percentage figures
SYMS = {"Tesla": "TSLA", "Rivian": "RIVN", "Lucid": "LCID"}
LISTED = {"Lucid": "2021-07"}                        # first month the shares were the company itself


def fetch():
    rows = []
    for co, sym in SYMS.items():
        # daily closes, then the last trading day of each month: Yahoo sometimes answers a monthly request with weekly
        # bars (it did for LCID), and a week that starts in one month and ends in the next would land in the wrong month
        # (an explicit date range keeps daily bars; "range=max" is silently downgraded to weekly or monthly)
        u = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?period1=0&period2={int(dt.datetime.now().timestamp())}&interval=1d&events=div%2Csplit"
        d = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read())["chart"]["result"][0]
        for t, c in zip(d["timestamp"], d["indicators"]["quote"][0]["close"]):
            if c is not None:
                rows.append((co, dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime("%Y-%m"), float(c)))   # in time order, so the month's last close wins
    df = pd.DataFrame(rows, columns=["company", "month", "close"]).drop_duplicates(["company", "month"], keep="last")
    this_month = dt.date.today().strftime("%Y-%m")
    return df[df.month < this_month]                 # the running month is incomplete


def derive(df):
    out = {}
    for co in SYMS:
        s = df[df.company == co].set_index("month").close
        s = s[s.index >= LISTED.get(co, "")]            # before Lucid's July 2021 merger the ticker was the CCIV SPAC
        dec = {m[:4]: v for m, v in s.items() if m.endswith("-12")}
        last_m = s.index[-1]; ly = last_m[:4]
        ret = {int(y): round(float(dec[y] / dec[str(int(y) - 1)] - 1), 4) for y in dec if str(int(y) - 1) in dec and int(y) >= 2020 and int(y) < int(ly)}
        ytd = round(float(s.iloc[-1] / dec[str(int(ly) - 1)] - 1), 4) if str(int(ly) - 1) in dec else None
        r = s.pct_change().dropna().tail(36)
        out[co] = {"symbol": SYMS[co], "annual_return": ret, "ytd_return": ytd, "ytd_through": last_m, "volatility_36m": round(float(r.std() * math.sqrt(12)), 4), "first_month": s.index[0]}
    return out


def main():
    try:
        df = fetch(); df.to_csv(LOCAL, index=False)
        derived = derive(df); derived["built"] = dt.date.today().isoformat(); derived = json.loads(json.dumps(derived))   # same shape as the committed file
        DERIVED.write_text(json.dumps(derived, indent=1))
        print("fetched", len(df), "monthly closes; derived figures written")
    except Exception as e:
        print("Yahoo fetch failed, using the committed derived file:", e)
        derived = json.loads(DERIVED.read_text())
    ev = json.loads((ROOT / "web" / "ev.json").read_text()); vs = json.loads((ROOT / "web" / "versus.json").read_text())
    Y = vs["fin"]["years"]; rev_t, rev_r = vs["fin"]["tesla"]["revenue"], vs["fin"]["rivian"]["revenue"]
    ann_t = {}
    for q in ev["tesla"]["quarters"]:
        ann_t.setdefault(int(q["q"][:4]), []).append(q["deliveries"])
    ann_t = {y: sum(v) for y, v in ann_t.items() if len(v) == 4}
    ann_r = {}
    for q in ev["rivian"]["quarters"]:
        ann_r.setdefault(int(q["q"][:4]), []).append(q["deliveries"])
    ann_r = {y: sum(v) for y, v in ann_r.items() if len(v) == 4}
    ann_l = {}
    for q in ev["lucid"]["quarters"]:
        ann_l.setdefault(int(q["q"][:4]), []).append(q["deliveries"])
    ann_l = {y: sum(v) for y, v in ann_l.items() if len(v) == 4}
    rev_l = vs["fin"]["lucid"]["revenue"]
    g = lambda d, y: (d[y] / d[y - 1] - 1) if y in d and y - 1 in d and d[y - 1] else None
    rows = []
    for co, rev, vol in (("Tesla", dict(zip(Y, rev_t)), ann_t), ("Rivian", {y: v for y, v in zip(Y, rev_r) if v}, ann_r), ("Lucid", {y: v for y, v in zip(Y, rev_l) if v}, ann_l)):
        for y in sorted(derived[co]["annual_return"], key=int):
            y = int(y)
            rows.append({"company": co, "year": y, "stock_return": derived[co]["annual_return"][str(y)], "revenue_growth": None if g(rev, y) is None or rev.get(y - 1, 0) < 100 else round(g(rev, y), 4), "volume_growth": None if g(vol, y) is None else round(g(vol, y), 4)})
    out = {"meta": {"built": dt.date.today().isoformat(), "through": derived["Tesla"]["ytd_through"],
                    "notes": {"terms": "Prices come from Yahoo Finance, which limits its data to personal use, so only derived percentage figures are published here: calendar-year price changes, year-to-date change and annualised volatility. Split-adjusted closes in each share's own currency (USD), without dividends.",
                              "reading": "Five or six yearly points cannot show that stock returns follow revenue or volume; they show whether the market was ahead of or behind the business in each year."}},
           "companies": {co: {k: derived[co][k] for k in ("symbol", "ytd_return", "ytd_through", "volatility_36m")} for co in SYMS}, "years": rows}
    path = ROOT / "web" / "stocks.json"
    path.write_text(json.dumps(out, separators=(",", ":"), allow_nan=False))
    print(f"wrote {path} ({len(rows)} company-years); through {out['meta']['through']}")
    for r in rows[-6:]:
        print(r)


if __name__ == "__main__":
    main()
