# To do

## Data
- [ ] **Cox EV sales report:** each quarter (about two weeks after quarter end) run `python scripts/parse_cox_ev_report.py <pdf-url> <quarter>` with the new Kelley Blue Book EV Sales Report.
- [ ] **More states for owner profiles:** California, Washington, New York and Connecticut are in. Colorado, Texas and others do not yet publish make-level EV registrations openly; add them if they do.
- [ ] **Rivian quarterly:** add each new quarter's production and deliveries (from the 8-K, Exhibit 99.1) to `data/external/ev/rivian_quarterly.csv`.
- [ ] **Share prices:** refresh by hand with `python scripts/build_stocks.py` after each month end (it fetches into a git-ignored cache). If a licensed, redistributable source is ever available, a full monthly price chart could replace the derived figures.
- [ ] **Europe registrations:** add each new ACEA monthly press release (`Press_release_car_registrations_<Month>_2026.pdf`; ACEA skips July, so derive it from year-to-date totals) to `data/external/ev/acea_primary_rows.csv` and `europe_registrations.csv`.
- [ ] **Tesla China monthly:** add each new month from the CPCA release (domestic deliveries and exports) to `data/external/ev/tesla_china_monthly.csv`.
- [ ] **U.S. registrations** for Tesla and Rivian are not free; look for a legitimate public source.
- [ ] **Tesla quarter:** until the datahub snapshot catches up, add the new quarter to a `tesla_*_manual.csv` file like `tesla_q3_2026_manual.csv` (from the 8-K, Exhibit 99.1).
- [ ] **More U.S.-listed EV makers** (for example Lucid, LCID) at the same depth, if wanted.
- [ ] **Google Trends:** manual CSVs only; test with the same overlap-corrected approach as `scripts/build_drivers.py`.

## Product
- [ ] Grounded Q&A agent: a model-backed Ask that only restates numbers returned by read-only tools over the JSON files, with a number check, rate limit and spend cap. Decide access (public or login) and budget first.
- [ ] Accessibility: keyboard access to chart points, and a table view for each chart.
- [ ] Print layout.
