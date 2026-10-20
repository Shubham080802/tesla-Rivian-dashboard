"""Shared helpers: HTTP fetch, SEC quarterly figures from year-to-date filings, FRED series."""
import datetime as dt
import io
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "data" / "external"
EXT.mkdir(parents=True, exist_ok=True)
SEC_UA = "tesla-rivian-dashboard personal-research-project"     # SEC asks for a descriptive User-Agent


def get(url, headers=None, tries=3):
    for k in range(tries):                                     # public APIs are occasionally slow
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=120).read()
        except Exception:
            if k == tries - 1:
                raise


def fred(series_id, cache=True):
    """A FRED series as a pandas Series (date index), refreshed from the web when possible, else from the cached CSV."""
    path = EXT / f"fred_{series_id}.csv"
    try:
        txt = get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}").decode()
        if not txt.startswith("observation_date"):
            raise ValueError("unexpected response")
        path.write_text(txt)
    except Exception as e:
        print(f"FRED {series_id} fetch failed, using cache:", e)
        txt = path.read_text()
    s = pd.read_csv(io.StringIO(txt), parse_dates=[0], index_col=0).iloc[:, 0]
    return pd.to_numeric(s, errors="coerce").dropna()


def quarterly_from_facts(facts, tags):
    """Quarterly values with gaps filled by accounting identities, never by estimation:
         Q1 = 3-month figure; Q2 = 6-month YTD - Q1; Q3 = 9-month YTD - 6-month YTD; Q4 = full year - 9-month YTD.
       Returns ({quarter_end: value}, {quarter_end: how it was derived}) so every filled value is traceable."""
    dur = {"q": {}, "h1": {}, "m9": {}, "fy": {}}
    for tag in tags:                                     # earlier tags win; later ones fill older history
        rows = facts.get(tag, {}).get("units", {}).get("USD", [])
        best = {}
        for r in rows:
            if "start" not in r:
                continue
            k = (r["start"], r["end"])
            if k not in best or r["filed"] > best[k]["filed"]:
                best[k] = r
        for (s, e), r in best.items():
            days = (dt.date.fromisoformat(e) - dt.date.fromisoformat(s)).days
            kind = "q" if 80 <= days <= 100 else "h1" if 170 <= days <= 195 else "m9" if 260 <= days <= 285 else "fy" if 350 <= days <= 380 else None
            if kind:
                dur[kind].setdefault(e, r["val"])
    q, how = dict(dur["q"]), {e: "reported" for e in dur["q"]}
    for y in sorted({e[:4] for e in list(dur["h1"]) + list(dur["m9"]) + list(dur["fy"]) + list(q)}):
        e1, e2, e3, e4 = (f"{y}-{m}" for m in ("03-31", "06-30", "09-30", "12-31"))
        get = lambda e: q.get(e)
        if get(e2) is None and e2 in dur["h1"] and get(e1) is not None:
            q[e2], how[e2] = dur["h1"][e2] - get(e1), "derived: 6-month total minus Q1"
        if get(e3) is None and e3 in dur["m9"] and e2 in dur["h1"]:
            q[e3], how[e3] = dur["m9"][e3] - dur["h1"][e2], "derived: 9-month total minus 6-month total"
        if get(e4) is None and e4 in dur["fy"]:
            if e3 in dur["m9"]:
                q[e4], how[e4] = dur["fy"][e4] - dur["m9"][e3], "derived: full year minus 9-month total"
            elif all(get(e) is not None for e in (e1, e2, e3)):
                q[e4], how[e4] = dur["fy"][e4] - sum(get(e) for e in (e1, e2, e3)), "derived: full year minus Q1-Q3"
    return q, how
