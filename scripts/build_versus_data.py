"""Tesla vs BYD: popularity, annual financials in a common currency, and Tesla's U.S. charging build-out -> web/versus.json.

Sources (all public, additive; quarterly volumes stay in web/ev.json):
  * Wikipedia page views (Wikimedia REST API, English Wikipedia, monthly, human users). Tesla = "Tesla, Inc." plus the old
    "Tesla Motors" title; BYD = "BYD Company" plus "BYD Auto". A popularity proxy for English-speaking audiences, which
    understates BYD (its audience is mostly Chinese-speaking).
  * Annual financials: Tesla from SEC filings (sum of four quarters, USD); BYD from its annual reports (RMB, typed in with the
    page source in data/external/ev/byd_annual_financials.csv). BYD is converted at each year's average CNY per USD (FRED DEXCHUS).
  * Tesla charging: the U.S. federal alternative-fuel station locator, public Tesla-network stations that are open today,
    counted by the year they opened (so closed stations are missing and older years are understated).
Usage: python scripts/build_versus_data.py      (network only to refresh; caches in data/external/ev/)
"""
import csv
import datetime as dt
import io
import json
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
EV = ROOT / "data" / "external" / "ev"
UA = {"User-Agent": "tesla-byd-dashboard personal-research-project"}
WIKI = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/{}/monthly/2015070100/{}"
GROUPS = {"tesla": ["Tesla,_Inc.", "Tesla_Motors"], "byd": ["BYD_Company", "BYD_Auto"]}


def get(url, tries=3):
    for k in range(tries):                                  # FRED and the station API are occasionally slow
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
        except Exception:
            if k == tries - 1:
                raise


def pageviews():
    path = EV / "wikipedia_pageviews.csv"
    try:
        end = dt.date.today().replace(day=1).strftime("%Y%m0100")           # last complete month is before this one
        rows = []
        for co, titles in GROUPS.items():
            tot = defaultdict(int)
            for t in titles:
                for it in json.loads(get(WIKI.format(urllib.parse.quote(t, safe=""), end)))["items"]:
                    tot[it["timestamp"][:6]] += it["views"]
            this_month = dt.date.today().strftime("%Y%m")             # the running month is incomplete, so drop it
            rows += [(co, f"{k[:4]}-{k[4:]}", v) for k, v in sorted(tot.items()) if k < this_month]
        with open(path, "w", newline="") as f:
            w = csv.writer(f); w.writerow(["company", "month", "views"]); w.writerows(rows)
        print("Wikipedia page views:", len(rows), "rows")
    except Exception as e:
        print("Wikipedia fetch failed, using cache:", e)
    return pd.read_csv(path)


def fx():
    path = EV / "cny_per_usd_annual.csv"
    try:
        df = pd.read_csv(io.StringIO(urllib.request.urlopen("https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXCHUS", timeout=180).read().decode()))   # same call as the other FRED series
        df.columns = ["date", "v"]; df = df[df.date >= "2018-01-01"]; df["v"] = pd.to_numeric(df.v, errors="coerce")
        a = df.dropna().assign(year=lambda d: d.date.str[:4].astype(int)).groupby("year").v.mean().round(4)
        a.to_csv(path, header=["cny_per_usd"]); print("FRED DEXCHUS:", len(a), "years")
    except Exception as e:
        print("FX fetch failed, using cache:", e)
    return pd.read_csv(path, index_col=0).cny_per_usd


def chargers():
    path = EV / "tesla_chargers_by_year.csv"
    try:
        q = urllib.parse.urlencode({"fuel_type": "ELEC", "ev_network": "Tesla", "access": "public", "status": "E", "limit": "all", "api_key": "DEMO_KEY"})
        st = json.loads(get("https://developer.nlr.gov/api/alt-fuel-stations/v1.json?" + q))["fuel_stations"]
        yr = defaultdict(lambda: [0, 0])
        for s in st:
            if s.get("open_date"):
                yr[int(s["open_date"][:4])][0] += 1; yr[int(s["open_date"][:4])][1] += s.get("ev_dc_fast_num") or 0
        with open(path, "w", newline="") as f:
            w = csv.writer(f); w.writerow(["year", "stations", "fast_ports"])
            for y in sorted(yr):
                w.writerow([y, *yr[y]])
        print("Tesla chargers:", len(st), "stations, latest open date", max(s["open_date"] for s in st if s.get("open_date")))
    except Exception as e:
        print("Charger fetch failed, using cache:", e)
    return pd.read_csv(path)


def main():
    pv, fxr, ch = pageviews(), fx(), chargers()
    fin = pd.read_csv(EV / "tesla_quarterly_financials.csv", index_col=0)
    fin["year"] = fin.index.str[:4].astype(int)
    full = fin.groupby("year").filter(lambda g: len(g) == 4 and g.revenue.notna().all())
    ty = full.groupby("year")[["revenue", "gross_profit", "operating_income", "net_income"]].sum()
    by = pd.read_csv(EV / "byd_annual_financials.csv").set_index("year")
    rate = fxr.reindex(by.index)
    if rate.isna().any():
        raise SystemExit(f"missing CNY/USD rate for {list(rate[rate.isna()].index)}")
    byd_usd = pd.DataFrame({"revenue": by.revenue_rmb_m / rate, "gross_profit": by.gross_profit_rmb_m / rate, "net_income": by.net_profit_rmb_m / rate})
    years = sorted(set(by.index) & set(ty.index))
    rnd = lambda v: round(float(v), 1)
    out = {
        "meta": {"built": dt.date.today().isoformat(), "pageviews_latest": pv.month.max(), "charger_latest_year": int(ch.year.max()),
                 "sources": {"pageviews": "https://pageviews.wmcloud.org/", "byd_reports": "https://www.hkexnews.hk/", "sec": "https://www.sec.gov/edgar/browse/?CIK=1318605", "fx": "https://fred.stlouisfed.org/series/DEXCHUS", "chargers": "https://afdc.energy.gov/stations/"},
                 "notes": {"pageviews": "English Wikipedia only, so this understates BYD, whose audience is mostly Chinese-speaking. It measures attention, not sales.",
                           "fin": "Tesla in USD from SEC filings; BYD reported in RMB and converted at each year's average CNY per USD. BYD includes a large phone-components business; Tesla is almost all vehicles and energy.",
                           "chargers": "Public Tesla-network stations that are open today, by opening year. Stations that closed are missing, so older years are understated. U.S. only."}},
        "pageviews": {co: {"months": pv[pv.company == co].month.tolist(), "views": pv[pv.company == co].views.astype(int).tolist()} for co in GROUPS},
        "fin": {"years": [int(y) for y in years],
                "tesla": {k: [rnd(ty.loc[y, k]) for y in years] for k in ty.columns},
                "byd_usd": {k: [rnd(byd_usd.loc[y, k]) for y in years] for k in byd_usd.columns},
                "byd_rmb": {"revenue": [rnd(by.loc[y, "revenue_rmb_m"]) for y in years], "net_income": [rnd(by.loc[y, "net_profit_rmb_m"]) for y in years]},
                "cny_per_usd": [round(float(rate[y]), 3) for y in years]},
        "chargers": {"years": ch.year.astype(int).tolist(), "stations": ch.stations.astype(int).tolist(), "fast_ports": ch.fast_ports.astype(int).tolist()},
    }
    path = ROOT / "web" / "versus.json"
    path.write_text(json.dumps(out, separators=(",", ":"), allow_nan=False))
    print(f"wrote {path} ({path.stat().st_size / 1024:.0f} KB); financial years {years[0]}-{years[-1]}")
    for y in years[-3:]:
        print(y, "Tesla rev $%.1fB, BYD rev $%.1fB | Tesla net $%.1fB, BYD net $%.1fB" % (ty.loc[y, "revenue"] / 1e3, byd_usd.loc[y, "revenue"] / 1e3, ty.loc[y, "net_income"] / 1e3, byd_usd.loc[y, "net_income"] / 1e3))


if __name__ == "__main__":
    main()
