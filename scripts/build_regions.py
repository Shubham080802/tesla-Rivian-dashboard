"""Where they sell: Tesla in China (domestic vs export) and in Europe, BYD at home vs overseas and in Europe -> web/regions.json.

Sources (public, typed in by hand with the reconciliations below; see docs/TODO.md):
  * Tesla China: CPCA monthly figures as tabulated by CnEVPost, Jan 2024 to Sep 2026. Domestic = deliveries in China,
    exports = Shanghai plant shipments abroad; their sum is the CPCA "wholesale". Reconciled to the reported July 2026
    wholesale (93,579), Q3 2026 (275,111), Sep 2025 (90,812), and the nine-month 2026 total (743,060).
  * Europe (EU + EFTA + UK): ACEA monthly registrations as tabulated by CnEVPost, Jan 2024 to Feb 2026. ACEA did not report
    BYD separately in many months before mid-2025, so BYD has gaps. Registrations are not sales or deliveries.
  * BYD home vs overseas: from BYD's own monthly announcements (data in ev.json): home = total minus overseas.
Usage: python scripts/build_regions.py     (after build_ev_data.py)
"""
import datetime as dt
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
EV = ROOT / "data" / "external" / "ev"
ev = json.loads((ROOT / "web" / "ev.json").read_text())
tc = pd.read_csv(EV / "tesla_china_monthly.csv")
eu = pd.read_csv(EV / "europe_registrations.csv")
nn = lambda v: None if pd.isna(v) else int(v)
byd = [m for m in ev["byd"]["months"] if m["overseas"] is not None]
out = {
    "meta": {"built": dt.date.today().isoformat(), "tesla_china_latest": tc.month.iloc[-1], "europe_latest": eu.month.iloc[-1],
             "notes": {"china": "Tesla's China figures are CPCA data: domestic deliveries plus exports from the Shanghai plant (together, wholesale). BYD's overseas figure is its own definition.",
                       "europe": "Europe means EU, EFTA and the UK. These are registrations (cars put on the road), from ACEA, not sales or deliveries. ACEA did not report BYD separately in many months before mid-2025, so BYD has gaps; the table stops at February 2026."},
             "sources": {"cpca": "https://cnevpost.com/2026/08/12/tesla-jul-china-deliveries-shanghai-exports/", "acea": "https://www.acea.auto/", "europe_table": "https://cnevpost.com/2026/03/24/byd-tesla-registrations-europe-feb-2026/"}},
    "tesla_china": {"months": tc.month.tolist(), "domestic": tc.domestic.astype(int).tolist(), "exports": tc.exports.astype(int).tolist()},
    "byd_home": {"months": [m["m"] for m in byd], "home": [m["total"] - m["overseas"] for m in byd], "overseas": [m["overseas"] for m in byd]},
    "europe": {"months": eu.month.tolist(), "tesla": [nn(v) for v in eu.tesla], "byd": [nn(v) for v in eu.byd]},
}
path = ROOT / "web" / "regions.json"
path.write_text(json.dumps(out, separators=(",", ":"), allow_nan=False))
print(f"wrote {path} ({path.stat().st_size / 1024:.0f} KB): Tesla China to {tc.month.iloc[-1]}, Europe to {eu.month.iloc[-1]}")
