"""Read one Cox Automotive / Kelley Blue Book quarterly "Electric Vehicle Sales Report" PDF and update
data/external/research/us_ev_sales_cox.csv with U.S. EV sales estimates for Tesla, Rivian, Lucid, their models and the whole market.

Each report gives the quarter and the same quarter a year earlier. The newest report covering a quarter wins, because Cox
revises earlier quarters. Run by hand once a quarter (Cox publishes about two weeks after quarter end):

    python scripts/parse_cox_ev_report.py <report-url> <quarter, e.g. 2026-07>

Needs pypdf. These are Cox's modelled estimates, not registrations or company-reported deliveries.
"""
import io
import re
import sys
import urllib.request
from pathlib import Path

import pandas as pd
import pypdf

OUT = Path(__file__).resolve().parent.parent / "data" / "external" / "research" / "us_ev_sales_cox.csv"
ITEMS = ["Tesla", "Rivian", "Lucid", "Tesla Model 3", "Tesla Model Y", "Tesla Model S", "Tesla Model X", "Tesla Cybertruck",
         "Rivian R1S", "Rivian R1T", "Rivian R2", "Rivian EDV500/700", "Lucid Air", "Lucid Gravity"]
NUM = r"([\d,]+|-)"


def prev_year(q):
    return f"{int(q[:4]) - 1}{q[4:]}"


def parse(pdf_bytes, quarter):
    text = "\n".join(p.extract_text() for p in pypdf.PdfReader(io.BytesIO(pdf_bytes)).pages)
    rows = {}
    for line in text.splitlines():
        line = line.strip()
        for item in ["Total (Estimates)"] + ITEMS:
            m = re.match(re.escape(item) + r"\s+" + NUM + r"\s+" + NUM + r"\s", line + " ")
            if m and item not in rows:
                cur, prev = (None if v == "-" else int(v.replace(",", "")) for v in m.groups())
                rows[item] = (cur, prev)
    if "Total (Estimates)" not in rows or "Tesla" not in rows:
        raise SystemExit("could not find the brand table in this PDF")
    out = []
    for item, (cur, prev) in rows.items():
        name = "Total EV market" if item == "Total (Estimates)" else item
        if cur is not None:
            out.append((quarter, name, cur))
        if prev is not None:
            out.append((prev_year(quarter), name, prev))
    return out


def main(url, quarter):
    pdf = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=120).read()
    new = pd.DataFrame(parse(pdf, quarter), columns=["quarter", "item", "units"])
    new["report_quarter"], new["source"] = quarter, url
    old = pd.read_csv(OUT) if OUT.exists() else new.iloc[:0]
    both = pd.concat([old, new]).sort_values("report_quarter", kind="stable").drop_duplicates(["quarter", "item"], keep="last")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    both.sort_values(["quarter", "item"]).to_csv(OUT, index=False)
    print(f"{len(new)} rows from the {quarter} report; {both.quarter.nunique()} quarters in {OUT.name}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
