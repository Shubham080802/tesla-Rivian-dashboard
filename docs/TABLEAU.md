# Building the dashboard in Tableau

The `tableau/` folder holds eleven tidy CSVs, refreshed by the daily job. Connect to them from Tableau Desktop, or upload them to Tableau Cloud (Tableau Online) or Tableau Public. A Tableau workbook is a point-and-click build, so this guide gives the exact fields and views rather than a prebuilt file.

## Which Tableau?
| | Data refresh | Who can see it | Notes |
|---|---|---|---|
| **Tableau Public** | Re-upload the CSVs by hand (or reconnect) | Anyone with the link | The easiest way to share. Everything here is public data, but a Public workbook cannot be made private. |
| **Tableau Cloud (Online)** | Re-upload, or keep the CSVs in a folder with Tableau Bridge | Only people you invite | Sign-in required to view, so it suits a private portfolio piece. |
| **Tableau Desktop** | Edit the data source to refresh | Whoever you send the workbook to | Full control; publish to Cloud or Public when ready. |

## The tables
| File | One row per | Key columns |
|---|---|---|
| `volumes_monthly.csv` | BYD month and metric | company, month, metric (NEV sales, Passenger NEV sales, Overseas sales), value |
| `volumes_quarterly.csv` | Tesla quarter and metric | company, quarter_start, metric (Deliveries, Production, Model 3/Y deliveries), value |
| `tesla_financials_quarterly.csv` | Tesla quarter and metric | quarter_start, metric (Revenue, Gross profit, Operating income, Net income, ...), value_usd_m |
| `annual_financials.csv` | Company, year and metric | company, year, metric (Revenue, Gross profit, Net income), value_usd_m, value_local_m, currency, cny_per_usd |
| `attention_monthly.csv` | Company and month | company, month, wikipedia_views |
| `tesla_chargers_by_year.csv` | Opening year | year, stations_opened, fast_ports_opened, cumulative_stations |
| `forecasts.csv` | Series and future period | series, period_start, expected, p05, p10, p90, p95, model, backtest_error |
| `outlook.csv` | Series | last_12m, expected_next_12m, range_low_p10, range_high_p90, growth, chance_of_growth, reliability, outlook |
| `drivers_series.csv` | Driver and month | driver, date, value, unit |
| `driver_tests.csv` | Driver, company and lead | r, raw_p, adjusted_p, n, effective_n, verdict |
| `data_checks.csv` | Check | check name, result, detail |

Relationships: connect `volumes_*` and `annual_financials` on `company`; keep the others as separate data sources (they have different grains). Set `month`, `quarter_start`, `period_start` and `date` to the Date type.

## Suggested sheets
1. **Head to head KPIs.** From `annual_financials`, filter `year` to the latest. Rows: `metric`; columns: `company`; text: `SUM([value_usd_m])`.
2. **Revenue by year.** Columns `year`, rows `SUM([value_usd_m])`, colour `company`, filter `metric = Revenue`; bars side by side.
3. **Net margin.** Calculated field `Net margin = SUM(IF [metric]="Net income" THEN [value_usd_m] END) / SUM(IF [metric]="Revenue" THEN [value_usd_m] END)`; lines by `company` over `year`.
4. **BYD monthly sales and outlook.** Dual source: BYD actuals from `volumes_monthly` (metric = NEV sales) with `forecasts` (series = BYD NEV sales) on a shared date axis; use `p10`/`p90` as a band (a second sheet with Tableau's "Dual axis" and `expected` as a dashed line).
5. **Tesla deliveries by quarter.** `volumes_quarterly`, metric = Deliveries, plus the forecast the same way.
6. **Outlook scorecard.** `outlook.csv` as a table: series, `last_12m`, `expected_next_12m`, `growth` (percentage), `chance_of_growth`, with `outlook` on colour (Expanding green, Contracting red, Uncertain amber).
7. **Attention.** `attention_monthly`, a 12-month moving average: right-click `wikipedia_views`, Quick Table Calculation, Moving Average, previous 11 values; colour `company`.
8. **Tesla charging.** `tesla_chargers_by_year`: bars of `stations_opened`, line of `cumulative_stations` on a dual axis.
9. **Drivers.** `drivers_series` small multiples by `driver`; a table from `driver_tests` showing `verdict` and `adjusted_p`.

Then arrange sheets 1 to 3 and 6 on a "Head to head" dashboard, and 4, 5 and 7 to 9 on a second, and add the page's caveats as text (see the About the data tab).

## Rules to keep honest
* Quote BYD figures with their caveats: unaudited monthly volumes, and revenue that includes phone components.
* Attention is English Wikipedia only. Charging counts only stations open today.
* `outlook` and `chance_of_growth` come from the same rule as the web dashboard; `scripts/check_data.py` proves they match.
