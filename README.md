# Tesla vs Rivian Dashboard

A head-to-head dashboard for two U.S.-listed electric-vehicle makers, Tesla (TSLA) and Rivian (RIVN), built only from SEC filings, company releases and open data through 2026: vehicle volumes with backtested forecasts, quarterly and annual financials in US dollars, share price changes beside the business, Tesla's sales in China and Europe, English Wikipedia attention, both U.S. charging networks, and U.S. demand drivers. Every chart and KPI is drawn natively on the site (Plotly), from the same JSON files, and the Research brief tab turns it into findings for investors and customers with methods, limits and citations. It began as an Amazon Appliances review analysis; that project lives in its own repository.

**Live site:** https://tesla-rivian-dashboard.vercel.app

## What's in it
The site is laid out like a research paper: a brief with findings for investors and for customers, then one tab per research question, each with its evidence, method notes and sources.

| Tab | Answers |
|---|---|
| **Research brief** | The headline findings, written for an investor and for a buyer, a research-question table linking to the evidence, the method, the limits to state in any write-up, and a citation list. |
| **Head to head** | A scoreboard (deliveries, growth, revenue, net income, margins, revenue per vehicle, attention) with the leader on each row, revenue and net income by year, margins, attention, and both charging networks. |
| **Market share** | Tesla and Rivian's share of U.S. EV sales by quarter, sales stacked against every other brand, EVs as a share of all new vehicles, sales by model, plus Tesla's China wholesale and Europe registrations. |
| **Who buys** | Every Tesla and Rivian registered in Washington (by census tract) and New York (by ZIP code) joined to Census ACS income, age, education and home-ownership: where the cars sit by neighbourhood income, ownership per 1,000 residents, the typical owner's neighbourhood, top counties and share by model year. |
| **Customer view** | EPA range and efficiency by model, NHTSA crash-test stars, owner complaints per 10,000 vehicles sold, recalls by year and how many were fixable over the air, and what complaints and recalls were about. |
| **Sentiment** | GDELT news tone and coverage by month, and owner complaints filed with NHTSA (Wikipedia attention is on Head to head). |
| **Investor view** | Margins from gross to free cash flow, per-vehicle economics, quarterly net income and free cash flow, cash vs debt, cash runway, R&D, SG&A and stock-based pay, dilution, public float to sales, a scorecard, and share price changes beside the business. Not investment advice. |
| **Sales & forecast** | Tesla and Rivian deliveries side by side, then each company's deliveries with forecasts and 80% ranges, production vs deliveries, revenue and margins, and Tesla's model mix. |
| **Forecast lab** | Ask the dashboard, an outlook scorecard, a per-series lab with demand scenarios and a target tester, an on-track check and seasonality. |
| **Drivers** | Gasoline price, loan rates, vehicle sales, new-car prices, sentiment and the fed funds rate, tested against Tesla and Rivian growth with an overlap-corrected test. |
| **About the data** | How current each source is, the checks run on every refresh, and what is not here. |

## Data sources
| Source | Covers | Latest |
|---|---|---|
| [Tesla 8-K releases](https://datahub.io/datapressr/tesla-quarterly-deliveries) and [SEC EDGAR](https://www.sec.gov/edgar/browse/?CIK=1318605) | deliveries, production, financials | Q3 2026 deliveries, Q2 2026 financials |
| [Rivian 8-K releases](https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1874178&type=8-K) and [SEC EDGAR](https://www.sec.gov/edgar/browse/?CIK=1874178) | deliveries, production, financials | Q3 2026 deliveries, Q2 2026 financials |
| [CPCA](https://cnevpost.com/2026/08/12/tesla-jul-china-deliveries-shanghai-exports/) (via CnEVPost) and [ACEA press releases](https://www.acea.auto/files/Press_release_car_registrations_August_2026.pdf) | Tesla China domestic and exports; Tesla Europe registrations (EU, EFTA, UK) | Sep 2026 / Aug 2026 |
| Yahoo Finance (personal use, run by hand) | TSLA and RIVN share price changes (percentages only) | Sep 2026 |
| [FRED](https://fred.stlouisfed.org/) | U.S. demand drivers; all new light-vehicle sales (LTOTALNSA) | Oct 2026 |
| [Cox Automotive / Kelley Blue Book EV Sales Reports](https://www.coxautoinc.com/insights/q3-2026-ev-sales-report-commentary/) | U.S. EV sales estimates by brand and model | Q3 2026 |
| [NHTSA APIs](https://www.nhtsa.gov/nhtsa-datasets-and-apis) | recalls, owner complaints, NCAP crash ratings | daily |
| [EPA fueleconomy.gov](https://www.fueleconomy.gov/feg/ws/) | range and efficiency by model | model year 2026 |
| [GDELT DOC 2.0](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) | news tone and coverage | last full month |
| [Washington DOL](https://data.wa.gov/Transportation/Electric-Vehicle-Population-Data/f6w7-q2d2) and [New York DMV](https://data.ny.gov/Transportation/Vehicle-Snowmobile-and-Boat-Registrations/w4pv-hbkt) | registered EVs by census tract / ZIP | Oct 2026 |
| [Census ACS 5-year](https://censusreporter.org/) (via Census Reporter) | income, age, education, home ownership by area | 2020-2024 |
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
python scripts/build_research.py       # investors, market share, customers, sentiment, owners -> web/research.json (RESEARCH_CACHE_ONLY=1 reuses cached downloads)
python scripts/parse_cox_ev_report.py <report-url> <quarter>   # by hand, once a quarter: add Cox's new EV sales report
python scripts/check_data.py           # checks -> web/checks.json
python -m http.server -d web 8000      # open http://localhost:8000
```
A GitHub Action (`.github/workflows/refresh-data.yml`) runs the same steps daily (except share prices) and commits only when a source changed; Vercel redeploys on every push to `main`. Tesla China, Europe and new Rivian quarters are typed in by hand (see [docs/TODO.md](docs/TODO.md)).

## Caveats
Owner demographics are neighbourhood averages from two states, not facts about individual owners; Cox sales are modelled estimates; NHTSA complaints are unverified owner reports; GDELT tone measures news wording, not buyer opinion. Only U.S.-listed companies are covered, so both report to the SEC in US dollars under the same accounting rules. Volumes are what the companies report, not revenue. There are no customer-review or satisfaction views because neither company publishes that data. Attention is English Wikipedia only. This is not investment advice. Method notes: [docs/MODEL.md](docs/MODEL.md).
