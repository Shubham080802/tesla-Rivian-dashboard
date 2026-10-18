# To do

## Data
- [ ] **Europe registrations after February 2026** (ACEA monthly press releases, EU plus EFTA plus UK) and a primary-source check of the typed-in table; ACEA's site could not be read directly here.
- [ ] **Tesla China monthly:** add each new month from the CPCA release (domestic deliveries and exports) to `data/external/ev/tesla_china_monthly.csv`.
- [ ] **U.S. registrations** for Tesla and BYD's China retail (CPCA members-only) are not free; look for a legitimate public source.
- [ ] **BYD monthly:** add the new month to `data/external/ev/byd_monthly_sales.csv` on the 1st (from the HKEX announcement or CnEVPost), then run the refresh. Parsing the HKEX PDF would automate it.
- [ ] **BYD annual:** add the new row to `data/external/ev/byd_annual_financials.csv` after each annual report (March).
- [ ] **Tesla quarter:** until the datahub snapshot catches up, add the new quarter to a `tesla_*_manual.csv` file like `tesla_q3_2026_manual.csv` (from the 8-K, Exhibit 99.1).
- [ ] **BYD volumes before 2022, and the 2022 passenger and overseas split:** 2021 monthly passenger figures exist (they sum to the reported 593,745) but commercial vehicles are missing, so they are not mixed into the total series yet.
- [ ] **Stock prices** (no clean free monthly source confirmed), **China (CPCA, CAAM) and Europe (ACEA) registrations**, **NHTSA complaint trends** for Tesla.
- [ ] **Google Trends:** manual CSVs only; test with the same overlap-corrected approach as `scripts/build_drivers.py`.

## Product
- [ ] Tableau: build the workbook from `docs/TABLEAU.md`, publish it, and link it from the README.
- [ ] Grounded Q&A agent: a model-backed Ask that only restates numbers returned by read-only tools over the JSON files, with a number check, rate limit and spend cap. Decide access (public or login) and budget first.
- [ ] Accessibility: keyboard access to chart points, and a table view for each chart.
- [ ] Print layout.
