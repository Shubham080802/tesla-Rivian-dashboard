# Tesla vs Rivian Dashboard

A head-to-head dashboard for two U.S.-listed electric-vehicle makers, Tesla (TSLA) and Rivian (RIVN), built only from SEC filings, company releases and open data through 2026: vehicle volumes with backtested forecasts, quarterly and annual financials in US dollars, share price changes beside the business, Tesla's sales in China and Europe, English Wikipedia attention, both U.S. charging networks, and U.S. demand drivers. Every chart and KPI is drawn natively on the site (Plotly), from the same JSON files. It began as an Amazon Appliances review analysis; that project lives in its own repository.

**Live site:** https://tesla-byd-dashboard.vercel.app

## What's in it
| Tab | Answers |
|---|---|
| **Head to head** | A scoreboard (deliveries, growth, revenue, net income, margins, revenue per vehicle, attention) with the leader on each row, a plain-language reading, revenue and net income by year, gross and net margin, attention, and both charging networks. |
| **Sales & forecast** | Tesla and Rivian deliveries side by side (trailing four quarters), then each company's deliveries with forecasts and 80% ranges, production vs deliveries, revenue and margins, and Tesla's model mix. |
| **Where they sell** | Tesla's China wholesale split into domestic deliveries and Shanghai exports, the export share, and Tesla's Europe registrations by year from ACEA's own press releases. Rivian sells almost only in North America. |
| **Stock vs business** | Calendar-year share price changes for TSLA and RIVN beside revenue and delivery growth, year-to-date change and volatility. Only derived percentages are published (see the terms note on the page); not investment advice. |
| **Forecast lab** | Ask the dashboard (suggested questions, answered from the same numbers), an outlook scorecard (Expanding, Contracting, Uncertain), a per-series lab with demand scenarios and a target tester, an on-track check and seasonality. |
| **Drivers** | Gasoline price, loan rates, vehicle sales, new-car prices, sentiment and the fed funds rate, tested against Tesla and Rivian growth with an overlap-corrected test. |
| **About the data** | How current each source is, the 34 checks run on every refresh, and what is not here. |

## Data sources
| Source | Covers | Latest |
|---|---|---|
| [Tesla 8-K releases](https://datahub.io/datapressr/tesla-quarterly-deliveries) and [SEC EDGAR](https://www.sec.gov/edgar/browse/?CIK=1318605) | deliveries, production, financials | Q3 2026 deliveries, Q2 2026 financials |
| [Rivian 8-K releases](https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1874178&type=8-K) and [SEC EDGAR](https://www.sec.gov/edgar/browse/?CIK=1874178) | deliveries, production, financials | Q3 2026 deliveries, Q2 2026 financials |
| [CPCA](https://cnevpost.com/2026/08/12/tesla-jul-china-deliveries-shanghai-exports/) (via CnEVPost) and [ACEA press releases](https://www.acea.auto/files/Press_release_car_registrations_August_2026.pdf) | Tesla China domestic and exports; Tesla Europe registrations (EU, EFTA, UK) | Sep 2026 / Aug 2026 |
| Yahoo Finance (personal use, run by hand) | TSLA and RIVN share price changes (percentages only) | Sep 2026 |
| [FRED](https://fred.stlouisfed.org/) | U.S. demand drivers | Oct 2026 |
| [Wikimedia page views](https://pageviews.wmcloud.org/) | attention | Sep 2026 |
| [U.S. station locator](https://afdc.energy.gov/stations/) | Tesla and Rivian Adventure Network stations | Oct 2026 |

## Run it
```bash
pip install -r requirements.txt
python scripts/build_ev_data.py        # Tesla + Rivian volumes, quarterly financials, forecasts -> web/ev.json
python scripts/build_versus_data.py    # attention, annual financials, charging -> web/versus.json
python scripts/build_regions.py        # Tesla China and Europe -> web/regions.json (typed in from releases; see docs/TODO.md)
python scripts/build_stocks.py         # by hand only: share price changes vs the business -> web/stocks.json (fetches personal-use prices into a git-ignored cache; publishes only percentages)
python scripts/build_drivers.py        # demand drivers and the exploratory test -> web/drivers.json
python scripts/check_data.py           # checks -> web/checks.json
python -m http.server -d web 8000      # open http://localhost:8000
```
A GitHub Action (`.github/workflows/refresh-data.yml`) runs the same steps daily (except share prices) and commits only when a source changed; Vercel redeploys on every push to `main`. Tesla China, Europe and new Rivian quarters are typed in by hand (see [docs/TODO.md](docs/TODO.md)).

## Caveats
Only U.S.-listed companies are covered, so both report to the SEC in US dollars under the same accounting rules; BYD was dropped for that reason. Volumes are what the companies report, not revenue. There are no customer-review or satisfaction views because neither company publishes that data. Attention is English Wikipedia only. This is not investment advice. Method notes: [docs/MODEL.md](docs/MODEL.md).
