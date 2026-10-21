"""Find Cox Automotive's newest quarterly EV sales report and add it to data/external/research/us_ev_sales_cox.csv.

Cox posts a commentary page for each quarter (insights/q<N>-<YYYY>-ev-sales-report-commentary/) that links the report
PDF. This checks the latest quarter already stored (Cox re-issues reports with revisions) and the quarter after it, and
parses any PDF not seen before with scripts/parse_cox_ev_report.py. Run by .github/workflows/cox-report.yml; safe to run
by hand. Prints what it did and exits 0 either way.
"""
import re
import urllib.request

import pandas as pd

from parse_cox_ev_report import OUT, main as parse

PAGE = "https://www.coxautoinc.com/insights/q{n}-{y}-ev-sales-report-commentary/"


def report_pdf(quarter):
    """The report PDF linked from a quarter's commentary page, or None if Cox has not published it yet."""
    y, m = int(quarter[:4]), int(quarter[5:7])
    try:
        html = urllib.request.urlopen(urllib.request.Request(PAGE.format(n=(m - 1) // 3 + 1, y=y), headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read().decode("utf-8", "ignore")
    except Exception:
        return None
    pdfs = sorted(set(re.findall(r"https://www\.coxautoinc\.com/wp-content/uploads/[^\"' >]+\.pdf", html)))
    pdfs = [u for u in pdfs if "ev" in u.lower()]
    return pdfs[-1] if pdfs else None


def next_quarter(q):
    y, m = int(q[:4]), int(q[5:7]) + 3
    return f"{y + (m > 12)}-{(m - 1) % 12 + 1:02d}"


def run():
    have = pd.read_csv(OUT)
    seen, latest = set(have.source), have.report_quarter.max()
    added = []
    for q in (latest, next_quarter(latest)):
        url = report_pdf(q)
        if url and url not in seen:
            parse(url, q)
            added.append(f"{q} {url}")
    print("new Cox reports: " + ("; ".join(added) if added else f"none (latest stored {latest})"))


if __name__ == "__main__":
    run()
