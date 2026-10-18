# Tesla vs BYD Dashboard

A head-to-head dashboard for Tesla and BYD built only from public filings, announcements and open data through 2026: vehicle volumes with backtested forecasts, annual financials in a common currency, English Wikipedia attention, Tesla's U.S. charging build-out, and U.S. demand drivers. It began as an Amazon Appliances review analysis; that project lives in its own repository.

**Live site:** https://tesla-byd-dashboard.vercel.app. **Tableau:** the `tableau/` folder and [docs/TABLEAU.md](docs/TABLEAU.md).

## What's in it
| Tab | Answers |
|---|---|
| **Head to head** | A scoreboard (volume, growth, revenue, margins, attention) with the leader on each row, a plain-language reading, revenue and profit by year, gross margin, attention, and Tesla's charging stations. |
| **Sales & forecast** | Tesla deliveries by quarter and BYD NEV sales by month with forecasts and 80% ranges, production vs deliveries, Tesla revenue and margin, model mix, BYD home vs overseas sales. |
| **Where they sell** | Tesla's China wholesale split into domestic deliveries and Shanghai exports, BYD's home market vs overseas, the share each sells abroad, and Europe registrations for both from ACEA's own press releases (BYD is not reported separately before mid-2024). |
| **Stock vs business** | Calendar-year share price changes for Tesla and BYD (H shares) beside revenue and volume growth, year-to-date change and volatility. Only derived percentages are published (see the terms note on the page); not investment advice. |
| **Forecast lab** | Ask the dashboard (suggested questions, answered from the same numbers), an outlook scorecard (Expanding, Contracting, Uncertain), a per-series lab with demand scenarios and a target tester, an on-track check and seasonality. |
| **Drivers** | Gasoline price, loan rates, vehicle sales, new-car prices, sentiment and the fed funds rate, tested against Tesla and BYD growth with an overlap-corrected test. |
| **About the data** | How current each source is, the 26 checks run on every refresh, and what is not here. |

## Data sources
| Source | Covers | Latest |
|---|---|---|
| [Tesla 8-K releases](https://datahub.io/datapressr/tesla-quarterly-deliveries) and [SEC EDGAR](https://www.sec.gov/edgar/browse/?CIK=1318605) | deliveries, production, financials | Q3 2026 deliveries, Q2 2026 financials |
| [BYD announcements](https://cnevpost.com/2026/10/01/byd-sept-2026-sales/) (HKEX) | NEV sales by month from Jan 2022 (passenger and overseas split from Jan 2023) | Sep 2026 |
| [BYD annual reports](https://www.hkexnews.hk/) | revenue, gross profit, net profit | 2025 |
| [CPCA](https://cnevpost.com/2026/08/12/tesla-jul-china-deliveries-shanghai-exports/) (via CnEVPost) and [ACEA press releases](https://www.acea.auto/files/Press_release_car_registrations_August_2026.pdf) | Tesla China domestic and exports; Europe registrations (EU, EFTA, UK) | Sep 2026 / Aug 2026 |
| [FRED](https://fred.stlouisfed.org/) | CNY/USD rate and U.S. demand drivers | Oct 2026 |
| [Wikimedia page views](https://pageviews.wmcloud.org/) | attention | Sep 2026 |
| [U.S. station locator](https://afdc.energy.gov/stations/) | Tesla charging stations | Oct 2026 |

## Run it
```bash
pip install -r requirements.txt
python scripts/build_ev_data.py        # Tesla + BYD volumes, financials, forecasts -> web/ev.json
python scripts/build_versus_data.py    # attention, annual financials in USD, charging -> web/versus.json
python scripts/build_regions.py        # Tesla China, BYD home vs overseas, Europe -> web/regions.json (Tesla China and Europe figures are typed in; see docs/TODO.md)
python scripts/build_stocks.py         # by hand only: share price changes vs the business -> web/stocks.json (fetches personal-use prices into a git-ignored cache; publishes only percentages)
python scripts/build_drivers.py        # demand drivers and the exploratory test -> web/drivers.json
python scripts/export_tableau.py       # eleven tidy CSVs for Tableau -> tableau/
python scripts/check_data.py           # checks (needs Node for the dashboard-vs-Tableau comparison) -> web/checks.json
python -m http.server -d web 8000      # open http://localhost:8000
```
A GitHub Action (`.github/workflows/refresh-data.yml`) runs the same steps daily and commits only when a source changed; Vercel redeploys on every push to `main`. BYD's monthly and annual figures are typed in by hand (see [docs/TODO.md](docs/TODO.md)).

## Caveats
Volumes are what the companies report, not revenue. BYD's monthly figures are unaudited and its revenue includes phone components. There are no customer-review or satisfaction views because neither company publishes that data. Attention is English Wikipedia only. This is not investment advice. Method notes: [docs/MODEL.md](docs/MODEL.md).
