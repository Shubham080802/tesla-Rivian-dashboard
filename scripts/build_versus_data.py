"""Tesla vs Rivian: attention, annual financials, and both U.S. charging networks -> web/versus.json.

Sources (all public; quarterly volumes stay in web/ev.json):
  * Wikipedia page views (Wikimedia REST API, English Wikipedia, monthly, human users). Tesla = "Tesla, Inc." plus the old
    "Tesla Motors" title; Rivian = "Rivian". A proxy for attention, not demand.
  * Annual financials: both from SEC filings (sum of four quarters, USD), complete years only.
  * Charging: the U.S. federal alternative-fuel station locator, public Tesla-network and Rivian Adventure Network stations
    that are open today, counted by the year they opened (so closed stations are missing and older years are understated).
Usage: python scripts/build_versus_data.py      (network only to refresh; caches in data/external/ev/)
"""
import csv
import datetime as dt
import json
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
EV = ROOT / "data" / "external" / "ev"
UA = {"User-Agent": "tesla-rivian-dashboard personal-research-project"}
WIKI = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/{}/monthly/2015070100/{}"
GROUPS = {"tesla": ["Tesla,_Inc.", "Tesla_Motors"], "rivian": ["Rivian"]}


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


def chargers(network="Tesla", name="tesla"):
    """Public stations of one charging network that are open today, counted by opening year."""
    path = EV / f"{name}_chargers_by_year.csv"
    try:
        q = urllib.parse.urlencode({"fuel_type": "ELEC", "ev_network": network, "access": "public", "status": "E", "limit": "all", "api_key": "DEMO_KEY"})
        st = json.loads(get("https://developer.nlr.gov/api/alt-fuel-stations/v1.json?" + q))["fuel_stations"]
        yr = defaultdict(lambda: [0, 0])
        for s in st:
            if s.get("open_date"):
                yr[int(s["open_date"][:4])][0] += 1; yr[int(s["open_date"][:4])][1] += s.get("ev_dc_fast_num") or 0
        with open(path, "w", newline="") as f:
            w = csv.writer(f); w.writerow(["year", "stations", "fast_ports"])
            for y in sorted(yr):
                w.writerow([y, *yr[y]])
        print(f"{network} chargers:", len(st), "stations, latest open date", max(s["open_date"] for s in st if s.get("open_date")))
    except Exception as e:
        print(f"Charger fetch failed for {network}, using cache:", e)
    return pd.read_csv(path)


def annual(name):
    """Calendar-year sums of a company's quarterly SEC figures, complete years only."""
    fin = pd.read_csv(EV / f"{name}_quarterly_financials.csv", index_col=0)
    fin["year"] = fin.index.str[:4].astype(int)
    full = fin.groupby("year").filter(lambda g: len(g) == 4 and g.revenue.notna().all())
    return full.groupby("year")[["revenue", "gross_profit", "operating_income", "net_income"]].sum()


def main():
    pv, ch = pageviews(), chargers()
    rch = chargers("RIVIAN_ADVENTURE", "rivian")
    ty, ry = annual("tesla"), annual("rivian")
    years = [y for y in sorted(ty.index) if y >= 2019]
    rnd = lambda v: round(float(v), 1)
    out = {
        "meta": {"built": dt.date.today().isoformat(), "pageviews_latest": pv.month.max(), "charger_latest_year": int(ch.year.max()),
                 "sources": {"pageviews": "https://pageviews.wmcloud.org/", "sec": "https://www.sec.gov/edgar/browse/?CIK=1318605", "sec_rivian": "https://www.sec.gov/edgar/browse/?CIK=1874178", "chargers": "https://afdc.energy.gov/stations/"},
                 "notes": {"pageviews": "English Wikipedia page views measure attention, not demand.",
                           "fin": "Both companies' figures come from their SEC filings, in US dollars. Rivian began deliveries in late 2021 and has not yet made a profit.",
                           "chargers": "Public stations that are open today, by opening year. Stations that closed are missing, so older years are understated. U.S. only."}},
        "pageviews": {co: {"months": pv[pv.company == co].month.tolist(), "views": pv[pv.company == co].views.astype(int).tolist()} for co in GROUPS},
        "fin": {"years": [int(y) for y in years],
                "tesla": {k: [rnd(ty.loc[y, k]) for y in years] for k in ty.columns},
                "rivian": {k: [rnd(ry.loc[y, k]) if y in ry.index else None for y in years] for k in ry.columns}},
        "chargers": {"years": ch.year.astype(int).tolist(), "stations": ch.stations.astype(int).tolist(), "fast_ports": ch.fast_ports.astype(int).tolist()},
        "chargers_rivian": {"years": rch.year.astype(int).tolist(), "stations": rch.stations.astype(int).tolist(), "fast_ports": rch.fast_ports.astype(int).tolist()},
    }
    path = ROOT / "web" / "versus.json"
    path.write_text(json.dumps(out, separators=(",", ":"), allow_nan=False))
    print(f"wrote {path} ({path.stat().st_size / 1024:.0f} KB); financial years {years[0]}-{years[-1]}")
    for y in years[-3:]:
        print(y, "Tesla rev $%.1fB net $%.1fB | Rivian rev %s net %s" % (ty.loc[y, "revenue"] / 1e3, ty.loc[y, "net_income"] / 1e3, ry.loc[y, "revenue"] if y in ry.index else "n/a", ry.loc[y, "net_income"] if y in ry.index else "n/a"))


if __name__ == "__main__":
    main()
