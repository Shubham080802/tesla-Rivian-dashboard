"""Research layer for Tesla vs Rivian: investor economics, customer-facing quality data, public sentiment, U.S. market share
and where owners live. Writes web/research.json. Every source is public; each fetch is cached under data/external/research
so the site keeps its last good data when a source is down.

  Investors   SEC EDGAR company facts: quarterly P&L, cash flow, R&D, SG&A, stock-based pay, cash, debt, share count,
              public float (10-K cover page). Per-vehicle figures use company-reported deliveries (ev.json inputs).
  Market      Cox Automotive / Kelley Blue Book quarterly U.S. EV sales estimates (scripts/parse_cox_ev_report.py) and
              FRED LTOTALNSA (all new light vehicles) for the EV share of the U.S. market.
  Customers   NHTSA recalls, owner complaints and NCAP star ratings; EPA range and efficiency (fueleconomy.gov).
  Sentiment   GDELT news tone and volume (English-language online news); NHTSA complaints filed per month.
  Owners      Washington DOL and New York DMV registrations joined to Census ACS 5-year area statistics (via Census
              Reporter). These describe the neighbourhoods owners live in, not the owners themselves.
"""
import csv
import io
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import date

import numpy as np
import pandas as pd
from scipy import stats

import common as bm

R = bm.EXT / "research"
R.mkdir(parents=True, exist_ok=True)
EV = bm.EXT / "ev"
W = bm.ROOT / "web"
CIK = {"tesla": 1318605, "rivian": 1874178}
CACHE_ONLY = os.environ.get("RESEARCH_CACHE_ONLY") == "1"      # local development: reuse cached downloads
qkey = lambda end: f"{end[:4]}-{int(end[5:7]) - 2:02d}"


def cached(name, fetch, kind="csv"):
    """Run fetch() and cache the result; on any failure fall back to the cached copy."""
    path = R / name
    if CACHE_ONLY and path.exists():
        return pd.read_csv(path) if kind == "csv" else json.loads(path.read_text())
    try:
        obj = fetch()
        if kind == "csv":
            obj.to_csv(path, index=False)
        else:
            path.write_text(json.dumps(obj))
        print("fetched", name)
    except Exception as e:
        print(f"{name}: fetch failed, using cache ({e})")
    return pd.read_csv(path) if kind == "csv" else json.loads(path.read_text())


def jget(url, headers=None):
    return json.loads(bm.get(url, headers or {"User-Agent": "Mozilla/5.0 (research dashboard)"}))


def jtry(url):
    """NHTSA answers 400 when a model and year have no records, so treat that as empty."""
    try:
        return jget(url)
    except urllib.error.HTTPError as e:
        if e.code == 400:
            return {}
        raise


# ---------------------------------------------------------------- investors
FLOW = {"revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax"], "gross_profit": ["GrossProfit"],
        "operating_income": ["OperatingIncomeLoss"], "net_income": ["NetIncomeLoss"],
        "ocf": ["NetCashProvidedByUsedInOperatingActivities"], "capex": ["PaymentsToAcquirePropertyPlantAndEquipment"],
        "rnd": ["ResearchAndDevelopmentExpense"], "sga": ["SellingGeneralAndAdministrativeExpense"], "sbc": ["ShareBasedCompensation"]}
INSTANT = {"cash": ["CashAndCashEquivalentsAtCarryingValue"], "st_investments": ["ShortTermInvestments"],
           "debt": {"tesla": ["LongTermDebt"], "rivian": ["LongTermDebtNoncurrent", "LongTermDebt"]},
           "shares": ["CommonStockSharesOutstanding"], "equity": ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
           "inventory": ["InventoryNet"]}


def instants(facts, tags, unit):
    out = {}
    for tag in tags:                                   # earlier tags win
        best = {}
        for r in facts.get(tag, {}).get("units", {}).get(unit, []):
            if "start" in r or r["end"][5:] not in ("03-31", "06-30", "09-30", "12-31"):
                continue
            if r["end"] not in best or r["filed"] > best[r["end"]]["filed"]:
                best[r["end"]] = r
        for e, r in best.items():
            out.setdefault(e, r["val"])
    return out


def sec_company(name):
    def fetch():
        f = jget(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{CIK[name]:010d}.json", {"User-Agent": bm.SEC_UA})["facts"]
        g, rows = f["us-gaap"], {}
        for col, tags in FLOW.items():
            vals, _ = bm.quarterly_from_facts(g, tags)
            for e, v in vals.items():
                rows.setdefault(e, {})[col] = v / 1e6
        for col, tags in INSTANT.items():
            tags = tags[name] if isinstance(tags, dict) else tags
            for e, v in instants(g, tags, "shares" if col == "shares" else "USD").items():
                rows.setdefault(e, {})[col] = v / 1e6
        df = pd.DataFrame(rows).T.sort_index()
        df.index = [qkey(e) for e in df.index]; df.index.name = "quarter"
        pf = [(r["end"], r["val"] / 1e6) for r in list(f["dei"].get("EntityPublicFloat", {}).get("units", {}).values() or [[]])[0]]
        (R / f"{name}_public_float.json").write_text(json.dumps(sorted(set(pf))))
        return df.reset_index()
    df = cached(f"{name}_sec_research.csv", fetch).set_index("quarter")
    pf = json.loads((R / f"{name}_public_float.json").read_text())
    return df[df.index >= "2019-01"], pf


def investors(vol):
    out = {}
    for name in ("tesla", "rivian"):
        df, pf = sec_company(name)
        df = df.join(vol[name], how="left")
        df = df[df.revenue.notna()]
        df["fcf"] = df.ocf - df.capex
        df["liquidity"] = df.cash + df.st_investments.fillna(0)
        q = lambda c: [None if pd.isna(v) else round(float(v), 3) for v in df[c]]
        ttm = df[["revenue", "gross_profit", "operating_income", "net_income", "fcf", "rnd", "sga", "sbc", "deliveries"]].rolling(4).sum()
        last = df.index[-1]
        t = ttm.loc[last]
        burn = -t.fcf if t.fcf < 0 else 0
        opex = t.gross_profit - t.operating_income                      # everything between gross profit and operating income
        gp_per = t.gross_profit / t.deliveries
        pf_last = pf[-1] if pf else None
        rev_at_pf = None
        if pf_last:
            pq = qkey(pf_last[0]); idx = list(ttm.index)
            if pq in idx and not pd.isna(ttm.loc[pq].revenue):
                rev_at_pf = float(ttm.loc[pq].revenue)
        out[name] = {
            "quarters": list(df.index), **{c: q(c) for c in ["revenue", "gross_profit", "operating_income", "net_income", "ocf", "capex", "fcf", "rnd", "sga", "sbc", "cash", "st_investments", "liquidity", "debt", "shares", "equity", "inventory", "deliveries"]},
            "ttm": {k: round(float(v), 2) for k, v in t.items()}, "latest": last,
            "runway_quarters": round(float(df.liquidity.iloc[-1] / (burn / 4)), 1) if burn > 0 else None,
            "opex_ttm": round(float(opex), 1),
            "breakeven_deliveries": round(float(opex / gp_per)) if gp_per > 0 else None,
            "gp_per_vehicle": round(float(gp_per * 1e6)),
            "public_float": [{"date": d, "value": v} for d, v in pf],
            "float_to_sales": round(pf_last[1] / rev_at_pf, 2) if pf_last and rev_at_pf else None,
            "share_growth_3y": round(float(df.shares.dropna().iloc[-1] / df.shares.dropna().iloc[-13] - 1), 3) if df.shares.dropna().size > 12 else None,
        }
    return out


# ---------------------------------------------------------------- market share
def market():
    cox = pd.read_csv(R / "us_ev_sales_cox.csv")
    p = cox.pivot(index="quarter", columns="item", values="units").sort_index()
    lv = bm.fred("LTOTALNSA")                                      # thousands of new light vehicles per month, not seasonally adjusted
    lvq = lv.groupby(lv.index.to_period("Q")).agg(["sum", "count"])
    allq = {f"{i.year}-{(i.quarter - 1) * 3 + 1:02d}": s * 1000 for i, (s, c) in lvq.iterrows() if c == 3}
    qs = list(p.index)
    col = lambda c: [None if pd.isna(p.at[x, c]) else int(p.at[x, c]) if c in p else None for x in qs]
    models = [c for c in p.columns if c.startswith(("Tesla ", "Rivian "))]
    return {"quarters": qs, "total_ev": col("Total EV market"), "tesla": col("Tesla"), "rivian": col("Rivian"),
            "all_vehicles": [allq.get(x) for x in qs], "models": {m: col(m) for m in models},
            "sources": sorted(cox.source.unique().tolist())}


# ---------------------------------------------------------------- customers
NHTSA = "https://api.nhtsa.gov"
YEARS = {"tesla": range(2019, date.today().year + 1), "rivian": range(2022, date.today().year + 1)}


def nhtsa_models(make, year, issue):
    try:
        d = jget(f"{NHTSA}/products/vehicle/models?modelYear={year}&make={make}&issueType={issue}")
    except Exception:                                  # a model year with no records yet answers 400
        return []
    return sorted({r["model"].upper() for r in d.get("results", [])})          # exact names; NHTSA needs them as listed


def base_model(m):
    return str(m).upper().replace("(ALL VARIANTS)", "").strip()


def nhtsa_recalls():
    def fetch():
        rows = []
        for make, yrs in YEARS.items():
            for y in yrs:
                for m in nhtsa_models(make, y, "r"):
                    for r in jtry(f"{NHTSA}/recalls/recallsByVehicle?make={make}&model={urllib.parse.quote(m)}&modelYear={y}").get("results", []):
                        rows.append({"make": make, "model": base_model(m), "model_year": y, "campaign": r.get("NHTSACampaignNumber"), "date": r.get("ReportReceivedDate"),
                                     "component": r.get("Component"), "ota": bool(r.get("overTheAirUpdate")), "park_it": bool(r.get("parkIt")),
                                     "units": r.get("PotentialNumberofUnitsAffected")})
                    time.sleep(0.2)
        return pd.DataFrame(rows)
    return cached("nhtsa_recalls.csv", fetch)


def nhtsa_complaints():
    def fetch():
        rows = []
        for make, yrs in YEARS.items():
            for y in yrs:
                for m in nhtsa_models(make, y, "c"):
                    for r in jtry(f"{NHTSA}/complaints/complaintsByVehicle?make={make}&model={urllib.parse.quote(m)}&modelYear={y}").get("results", []):
                        rows.append({"make": make, "model": base_model(m), "model_year": y, "odi": r.get("odiNumber"), "filed": r.get("dateComplaintFiled"),
                                     "crash": bool(r.get("crash")), "fire": bool(r.get("fire")), "injuries": r.get("numberOfInjuries") or 0,
                                     "deaths": r.get("numberOfDeaths") or 0, "components": r.get("components")})
                    time.sleep(0.2)
        return pd.DataFrame(rows).drop_duplicates("odi")
    return cached("nhtsa_complaints.csv", fetch)


def nhtsa_ratings():
    def fetch():
        rows = []
        for make in ("tesla", "rivian"):
            for y in range(date.today().year - 2, date.today().year + 2):
                for m in jget(f"{NHTSA}/SafetyRatings/modelyear/{y}/make/{make}").get("Results", []):
                    for v in jget(f"{NHTSA}/SafetyRatings/modelyear/{y}/make/{make}/model/{urllib.parse.quote(m['Model'])}").get("Results", []):
                        d = jget(f"{NHTSA}/SafetyRatings/VehicleId/{v['VehicleId']}").get("Results", [{}])[0]
                        rows.append({"make": make, "model_year": y, "model": m["Model"], "variant": v.get("VehicleDescription"),
                                     "overall": d.get("OverallRating"), "frontal": d.get("OverallFrontCrashRating"),
                                     "side": d.get("OverallSideCrashRating"), "rollover": d.get("RolloverRating")})
        return pd.DataFrame(rows)
    return cached("nhtsa_ratings.csv", fetch)


def epa():
    def fetch():
        z = zipfile.ZipFile(io.BytesIO(bm.get("https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip")))
        df = pd.read_csv(z.open(z.namelist()[0]), low_memory=False)
        df = df[df.make.isin(["Tesla", "Rivian"]) & (df.year >= 2022)]
        return df[["year", "make", "model", "VClass", "drive", "range", "combE", "comb08", "UCity", "evMotor"]]
    return cached("epa_tesla_rivian.csv", fetch)


def customers(market_):
    rec, com, rat, ep = nhtsa_recalls(), nhtsa_complaints(), nhtsa_ratings(), epa()
    # recalls: one campaign can cover several model years; count campaigns per make and calendar year
    rec["year"] = pd.to_datetime(rec.date, format="%d/%m/%Y", errors="coerce").dt.year
    camp = rec.drop_duplicates(["make", "campaign"])
    rec_year = {mk: {int(y): int(n) for y, n in g.groupby("year").size().items() if y >= 2019} for mk, g in camp.groupby("make")}
    ota = {mk: round(float(g.ota.mean()), 3) for mk, g in camp.groupby("make")}
    comp = camp.assign(c=camp.component.str.split(":").str[0].str.title()).groupby(["make", "c"]).size()
    rec_comp = {mk: comp[mk].sort_values(ascending=False).head(8).to_dict() for mk in ("tesla", "rivian") if mk in comp}
    # complaints per 10,000 sold: model year Y against calendar-year Y U.S. sales of that model (Cox), an approximation
    p = pd.DataFrame(market_["models"], index=market_["quarters"])
    cal = p.groupby(p.index.str[:4]).sum(min_count=4)
    nm = {"tesla": {"MODEL 3": "Tesla Model 3", "MODEL Y": "Tesla Model Y", "MODEL S": "Tesla Model S", "MODEL X": "Tesla Model X", "CYBERTRUCK": "Tesla Cybertruck"},
          "rivian": {"R1S": "Rivian R1S", "R1T": "Rivian R1T", "R2": "Rivian R2"}}
    rate = []
    for (mk, m, y), g in com.assign(model=com.model.map(base_model)).groupby(["make", "model", "model_year"]):
        key = nm.get(mk, {}).get(base_model(m))
        sold = cal.at[str(y), key] if key and str(y) in cal.index and key in cal.columns and not pd.isna(cal.at[str(y), key]) else None
        if sold:
            rate.append({"make": mk, "model": key, "model_year": int(y), "complaints": len(g), "sold": int(sold), "per10k": round(len(g) / sold * 1e4, 1),
                         "crash": int(g.crash.sum()), "fire": int(g.fire.sum())})
    com["month"] = pd.to_datetime(com.filed, format="%m/%d/%Y", errors="coerce").dt.strftime("%Y-%m")
    cm = com.groupby(["make", "month"]).size().unstack(0).fillna(0).sort_index()
    cm = cm[(cm.index >= "2021-01") & (cm.index < date.today().strftime("%Y-%m"))]
    ccomp = com.assign(c=com.components.fillna("").str.split(",").str[0].str.split(":").str[0].str.title()).groupby(["make", "c"]).size()
    com_comp = {mk: ccomp[mk].sort_values(ascending=False).head(8).to_dict() for mk in ("tesla", "rivian") if mk in ccomp}
    # NCAP: best rating per model for the latest model year rated
    rat = rat.dropna(subset=["overall"])
    rat = rat[rat.overall.astype(str).str.isdigit()]
    ncap = []
    rat = rat.assign(model=rat.model.str.upper().str.replace(r"\(ALL VARIANTS\)|\bBEV\b|\bRWD\b|\bAWD\b", "", regex=True).str.split().str.join(" ").str.title())
    for (mk, m), g in rat.groupby(["make", "model"]):
        g = g[g.model_year == g.model_year.max()]
        ncap.append({"make": mk, "model": m, "model_year": int(g.model_year.iloc[0]), "overall": int(g.overall.astype(int).max()),
                     "frontal": str(g.frontal.iloc[0]), "side": str(g.side.iloc[0]), "rollover": str(g.rollover.iloc[0])})
    # EPA: longest-range and most efficient version per model for the newest model year
    ep = ep[ep["range"] > 0]
    specs = []
    for (mk, base), g in ep.assign(base=ep.model.str.extract(r"^(Model [3SXY]|Cybertruck|R1S|R1T|R2|EDV)", expand=False).fillna(ep.model)).groupby(["make", "base"]):
        cur = g.year[g.year <= date.today().year]                         # next year's line-up is often incomplete
        g = g[g.year == (cur.max() if len(cur) else g.year.max())]
        specs.append({"make": mk.lower(), "model": base, "year": int(g.year.iloc[0]), "versions": len(g), "range_max": int(g["range"].max()), "range_min": int(g["range"].min()),
                      "kwh_per_100mi_best": float(g.combE.min()), "mpge_best": int(g.comb08.max()), "class": g.VClass.mode().iloc[0]})
    return {"recalls_by_year": rec_year, "recall_ota_share": ota, "recall_components": rec_comp, "recall_campaigns": {mk: int(len(g)) for mk, g in camp.groupby("make")},
            "complaint_rates": rate, "complaints_monthly": {"months": list(cm.index), **{mk: [int(v) for v in cm[mk]] for mk in cm.columns}},
            "complaint_components": com_comp, "ncap": ncap, "epa": specs,
            "complaints_total": {mk: int(len(g)) for mk, g in com.groupby("make")}}


# ---------------------------------------------------------------- sentiment
GDELT_Q = {"tesla": "Tesla (car OR cars OR EV OR electric OR Musk OR Cybertruck) sourcelang:english", "rivian": "Rivian sourcelang:english"}


def gdelt_series(co, mode, waits=(20, 60, 120, 240)):
    """One GDELT timeline, cached per series so a rate-limited run keeps whatever already worked."""
    path = R / f"gdelt_{co}_{mode}.csv"
    if (CACHE_ONLY or os.environ.get("RESEARCH_SKIP_GDELT") == "1") and (path.exists() or os.environ.get("RESEARCH_SKIP_GDELT") == "1"):
        return pd.read_csv(path, dtype={"date": str}) if path.exists() else None
    url = "https://api.gdeltproject.org/api/v2/doc/doc?" + urllib.parse.urlencode({"query": GDELT_Q[co], "mode": mode, "format": "json", "startdatetime": "20200101000000", "enddatetime": date.today().strftime("%Y%m%d000000")})
    for w in waits:
        time.sleep(w)                                    # GDELT allows one request every few seconds and throttles busy clients
        try:
            txt = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "research dashboard"}), timeout=120).read().decode()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                break
            continue
        except Exception:
            continue
        if txt.lstrip().startswith("{"):
            rows = [{"date": r["date"][:8], "value": r["value"], "norm": r.get("norm")} for r in json.loads(txt)["timeline"][0]["data"]]
            pd.DataFrame(rows).to_csv(path, index=False)
            print("fetched", path.name)
            break
    else:
        print(f"{path.name}: GDELT rate limit, using cache")
    return pd.read_csv(path, dtype={"date": str}) if path.exists() else None


def sentiment():
    res, cutoff = {}, date.today().strftime("%Y-%m")
    tones = {co: gdelt_series(co, "timelinetone") for co in GDELT_Q}          # tone first: GDELT often allows only a few requests
    for co in GDELT_Q:
        tone, vol = tones[co], gdelt_series(co, "timelinevolraw")
        if tone is None:
            continue
        for d in (tone, vol):
            if d is not None:
                d["month"] = d.date.str[:4] + "-" + d.date.str[4:6]
        t = tone[tone.month < cutoff].groupby("month").value.mean()
        v = vol[vol.month < cutoff].groupby("month").agg(a=("value", "sum"), n=("norm", "sum")) if vol is not None else None
        res[co] = {"months": list(t.index), "tone": [round(float(x), 3) for x in t],
                   "articles": [int(v.a.get(m, 0)) if v is not None else None for m in t.index],
                   "share_per_million": [round(float(v.a[m] / v.n[m] * 1e6), 1) if v is not None and m in v.index and v.n[m] else None for m in t.index]}
    return res


# ---------------------------------------------------------------- owners: geography and demographics
ACS = "B19013,B01003,B01002,B15003,B25003"


def census(level, state):
    def fetch():
        d = jget(f"https://api.censusreporter.org/1.0/data/show/latest?table_ids={ACS}&geo_ids={level}|04000US{state}")
        rows = []
        for gid, t in d["data"].items():
            e = lambda tab, c: t[tab]["estimate"].get(f"{tab}{c:03d}")
            pop = e("B01003", 1); edu = e("B15003", 1)
            rows.append({"geoid": gid.split("US")[1], "pop": pop, "income": e("B19013", 1), "age": e("B01002", 1),
                         "bachelor_plus": (sum(e("B15003", c) or 0 for c in (22, 23, 24, 25)) / edu) if edu else None,
                         "owner_share": (e("B25003", 2) / e("B25003", 1)) if e("B25003", 1) else None})
        (R / f"acs_{state}_release.json").write_text(json.dumps(d["release"]))
        return pd.DataFrame(rows)
    return cached(f"acs_{state}.csv", fetch, "csv")


def wa_regs():
    def fetch():
        d = jget("https://data.wa.gov/resource/f6w7-q2d2.json?" + urllib.parse.urlencode({"$select": "_2020_census_tract as tract,county,make,count(*) as n", "$group": "tract,county,make", "$limit": 500000}))
        return pd.DataFrame(d)
    def fetch_my():
        d = jget("https://data.wa.gov/resource/f6w7-q2d2.json?" + urllib.parse.urlencode({"$select": "model_year,make,count(*) as n", "$group": "model_year,make", "$where": "ev_type like 'Battery%'", "$limit": 50000}))
        return pd.DataFrame(d)
    return cached("wa_tract_make.csv", fetch), cached("wa_model_year_make_bev.csv", fetch_my)


def ny_regs():
    def fetch():
        d = jget("https://data.ny.gov/resource/w4pv-hbkt.json?" + urllib.parse.urlencode({"$select": "zip,make,count(*) as n", "$where": "fuel_type='ELECTRIC' AND record_type='VEH'", "$group": "zip,make", "$limit": 500000}))
        return pd.DataFrame(d)
    return cached("ny_zip_make.csv", fetch)


BANDS = [0, 50000, 75000, 100000, 125000, 150000, 200000, 1e9]
BAND_LABELS = ["Under $50K", "$50K-75K", "$75K-100K", "$100K-125K", "$125K-150K", "$150K-200K", "$200K+"]


def area_profile(df, label):
    """df: one row per area with pop, income, age, bachelor_plus, owner_share and counts tesla, rivian, other_ev."""
    df = df[(df["pop"] > 0) & df.income.notna()].copy()
    df["band"] = pd.cut(df.income, BANDS, labels=BAND_LABELS, right=False)
    groups = {"tesla": "tesla", "rivian": "rivian", "other_ev": "other_ev", "population": "pop"}
    bands = {g: [round(float(v), 4) for v in (df.groupby("band", observed=False)[c].sum() / df[c].sum())] for g, c in groups.items()}
    per1k = {g: [round(float(v), 2) for v in (df.groupby("band", observed=False)[c].sum() / df.groupby("band", observed=False)["pop"].sum() * 1000)] for g, c in groups.items() if g != "population"}

    def wmed(v, w):
        o = np.argsort(v.values); cw = np.cumsum(w.values[o]); return float(v.values[o][np.searchsorted(cw, cw[-1] / 2)])
    prof = {}
    for g, c in groups.items():
        sub = df[df[c] > 0]
        prof[g] = {"income_median": round(wmed(sub.income, sub[c])), "age": round(float(np.average(sub.age.fillna(sub.age.median()), weights=sub[c])), 1),
                   "bachelor_plus": round(float(np.average(sub.bachelor_plus.fillna(0), weights=sub[c])), 3),
                   "owner_share": round(float(np.average(sub.owner_share.fillna(0), weights=sub[c])), 3), "count": int(df[c].sum())}
    top = df.sort_values("income", ascending=False)
    top["cum_pop"] = top["pop"].cumsum() / top["pop"].sum()
    rich = top[top.cum_pop <= 0.10]
    conc = {g: round(float(rich[c].sum() / df[c].sum()), 3) for g, c in groups.items()}
    rho = {g: round(float(stats.spearmanr(df.income, df[c] / df["pop"]).statistic), 3) for g in ("tesla", "rivian", "other_ev") for c in [g]}
    return {"label": label, "areas": int(len(df)), "bands": BAND_LABELS, "share_by_band": bands, "per1k_by_band": per1k,
            "profile": prof, "top10pct_income_share": conc, "spearman_income_vs_per_capita": rho}


def owners():
    wa, wa_my = wa_regs()
    wa["n"] = wa.n.astype(int); wa = wa[wa.tract.astype(str).str.startswith("53")]
    wa["tract"] = wa.tract.astype(str).str[:11]
    k = wa.assign(g=np.where(wa.make == "TESLA", "tesla", np.where(wa.make == "RIVIAN", "rivian", "other_ev"))).pivot_table(index="tract", columns="g", values="n", aggfunc="sum", fill_value=0)
    acs_wa = census("140", "53"); acs_wa["geoid"] = acs_wa.geoid.astype(str).str.zfill(11)
    wa_df = acs_wa.set_index("geoid").join(k, how="left").fillna({"tesla": 0, "rivian": 0, "other_ev": 0})
    cty = wa.assign(g=np.where(wa.make == "TESLA", "tesla", np.where(wa.make == "RIVIAN", "rivian", "other_ev"))).pivot_table(index="county", columns="g", values="n", aggfunc="sum", fill_value=0)
    cpop = acs_wa.assign(c=acs_wa.geoid.astype(str).str[:5]).groupby("c")["pop"].sum()
    county_fips = wa.groupby("county").tract.first().str[:5]
    cty["pop"] = [cpop.get(county_fips.get(c)) for c in cty.index]
    cty = cty[cty["pop"] > 0]
    cty["tesla_per1k"], cty["rivian_per1k"] = cty.tesla / cty["pop"] * 1000, cty.rivian / cty["pop"] * 1000
    cty = cty.sort_values("tesla_per1k", ascending=False)
    wa_my["n"] = wa_my.n.astype(int); wa_my = wa_my[(wa_my.model_year.astype(int) >= 2016) & (wa_my.model_year.astype(int) <= date.today().year)]
    myp = wa_my.assign(g=np.where(wa_my.make == "TESLA", "tesla", np.where(wa_my.make == "RIVIAN", "rivian", "other"))).pivot_table(index="model_year", columns="g", values="n", aggfunc="sum", fill_value=0)
    myp = myp.div(myp.sum(axis=1), axis=0)

    ny = ny_regs(); ny["n"] = ny.n.astype(int); ny["zip"] = ny.zip.astype(str).str[:5].str.zfill(5)
    kn = ny.assign(g=np.where(ny.make == "TESLA", "tesla", np.where(ny.make.isin(["RIVIA", "RIVIAN"]), "rivian", "other_ev"))).pivot_table(index="zip", columns="g", values="n", aggfunc="sum", fill_value=0)
    acs_ny = census("860", "36"); acs_ny["geoid"] = acs_ny.geoid.astype(str).str.zfill(5)
    ny_df = acs_ny.set_index("geoid").join(kn, how="left").fillna({"tesla": 0, "rivian": 0, "other_ev": 0})
    rel = lambda s: json.loads((R / f"acs_{s}_release.json").read_text())["name"] if (R / f"acs_{s}_release.json").exists() else "ACS 5-year"
    return {"wa": area_profile(wa_df, "Washington (census tracts)"), "ny": area_profile(ny_df, "New York (ZIP code areas)"),
            "wa_counties": {"county": list(cty.index[:15]), "tesla_per1k": [round(v, 2) for v in cty.tesla_per1k[:15]], "rivian_per1k": [round(v, 2) for v in cty.rivian_per1k[:15]]},
            "wa_bev_share_by_model_year": {"years": [int(y) for y in myp.index], "tesla": [round(float(v), 4) for v in myp.get("tesla", 0)], "rivian": [round(float(v), 4) for v in myp.get("rivian", 0)]},
            "totals": {"wa": {"tesla": int(k.tesla.sum()), "rivian": int(k.rivian.sum()), "other_ev": int(k.other_ev.sum())},
                       "ny": {"tesla": int(kn.tesla.sum()), "rivian": int(kn.rivian.sum()), "other_ev": int(kn.other_ev.sum())}},
            "acs_release": rel("53")}


# ---------------------------------------------------------------- main
def volumes():
    t = pd.read_csv(EV / "tesla_quarterly_totals_datahub.csv", parse_dates=["period_start"])
    t = t.set_index(t.period_start.dt.strftime("%Y-%m"))["deliveries"]
    m = pd.read_csv(EV / "tesla_q3_2026_manual.csv", parse_dates=["period_start"])
    for _, r in m.iterrows():
        t.loc[r.period_start.strftime("%Y-%m")] = r.deliveries
    rv = pd.read_csv(EV / "rivian_quarterly.csv"); rv = rv.set_index(rv.quarter_start.str[:7])["deliveries"]
    return {"tesla": t.sort_index().rename("deliveries"), "rivian": rv.rename("deliveries")}


def main():
    vol = volumes()
    mk = market()
    out = {"meta": {"built": date.today().isoformat(),
                    "sources": {"sec": "https://www.sec.gov/edgar/search/", "cox": mk["sources"], "fred": "https://fred.stlouisfed.org/series/LTOTALNSA",
                                "nhtsa": "https://www.nhtsa.gov/nhtsa-datasets-and-apis", "epa": "https://www.fueleconomy.gov/feg/ws/",
                                "gdelt": "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
                                "wa": "https://data.wa.gov/Transportation/Electric-Vehicle-Population-Data/f6w7-q2d2",
                                "ny": "https://data.ny.gov/Transportation/Vehicle-Snowmobile-and-Boat-Registrations/w4pv-hbkt",
                                "acs": "https://censusreporter.org/"}},
           "investors": investors(vol), "market": mk, "customers": customers(mk), "sentiment": sentiment(), "owners": owners()}
    (W / "research.json").write_text(json.dumps(out, separators=(",", ":"), allow_nan=False))
    print("research.json:", round((W / "research.json").stat().st_size / 1024), "KB")


if __name__ == "__main__":
    main()
