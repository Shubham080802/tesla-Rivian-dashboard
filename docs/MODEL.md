# Method notes

## Data
* **Tesla volumes:** deliveries and production by quarter from Tesla's 8-K Exhibit 99.1 releases (datahub.io snapshot, Q2 2019 onward, plus the latest quarter read from the filing). **Tesla financials:** SEC EDGAR company facts; missing quarters are filled only by accounting identities (Q2 = six months minus Q1, and so on), never estimated.
* **BYD monthly sales:** BYD's announcements to HKEX, tabulated by CnEVPost, January 2022 onward (2022 as totals only; the passenger and overseas split starts in January 2023), unaudited. The 2022 months reconcile to the reported year-to-date figures and to the full-year total of 1,863,494. Typed-in figures are checked against published annual totals. **BYD annual financials:** BYD's annual reports, converted from RMB at each year's average CNY per USD (FRED DEXCHUS). BYD is not a pure car maker: it also makes phone components.
* **Attention:** English Wikipedia monthly page views (Tesla = "Tesla, Inc." plus "Tesla Motors"; BYD = "BYD Company" plus "BYD Auto"), complete months only.
* **Charging:** public Tesla-network stations open today, by opening year, from the U.S. federal station locator, so closed stations are missing and older years are understated.

## Forecasts (`forecast_engine.py`)
Four exponential-smoothing candidates (level, damped trend, seasonality, trend plus seasonality) are chosen by rolling-origin backtest. Volumes are modelled on a log scale; 1,000 simulated paths use seeded bootstrap shocks; the 80% range is calibrated to its backtest coverage (scale 0.6 to 3.0). The engine also stores one-step-ahead forecasts for the last periods (the "on track" chart), a seasonal index, and 19 cumulative quantiles used for "chance of growth" and "chance of reaching a target". Tesla is quarterly (season 4), BYD monthly (season 12). The BYD overseas model has a much larger backtest error than the others and is labelled that way.

## Outlook rule
"Chance of growth" is the probability that the next 12 months exceed the last 12, read from the stored quantiles. **Expanding** needs 70% or more, **Contracting** 30% or less, otherwise **Uncertain**. A series whose backtest error is above 30% is marked tentative. The Tableau export implements the same rule and `scripts/check_data.py` verifies the two agree.

## Where they sell (`scripts/build_regions.py`)
Tesla China: CPCA monthly figures as tabulated by CnEVPost, January 2024 to September 2026. Domestic is deliveries in China and exports are Shanghai plant shipments abroad; their sum is CPCA's wholesale. The typed-in figures reconcile exactly to the reported July 2026 wholesale (93,579), Q3 2026 (275,111), September 2025 (90,812) and the nine-month 2026 total (743,060); August 2026 domestic is derived from the reported wholesale minus exports. BYD home vs overseas uses BYD's own announcements (home = total minus overseas). Europe (EU, EFTA and UK): ACEA registrations as tabulated by CnEVPost, January 2024 to February 2026; these are registrations, not sales, and ACEA did not report BYD separately in 10 of those months. The Europe table is one secondary compilation, so it is labelled as such and checked only for plausibility against annual totals.

## Demand drivers (`scripts/build_drivers.py`)
U.S. indicators from FRED tested against year-over-year growth in Tesla deliveries (quarterly, 26 points) and BYD sales (monthly, 33 points), at the same period and with the indicator leading by one period. Overlapping year-over-year windows overstate significance, so the p-value that counts uses an effective sample of n/12 (monthly) or n/4 (quarterly) and a Bonferroni correction. "Yes" needs that to pass; a raw p below 0.05 alone is "Suggestive". Nothing passes today. The indicators are context, not inputs to the forecast.

## Known limits
No customer reviews or ratings (no open data), BYD monthly volumes before 2022 (and the 2022 passenger and overseas split), no stock prices or registrations by country. Volumes are not revenue. These are public figures and not investment advice.
