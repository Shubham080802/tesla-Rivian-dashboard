// Live share prices (TSLA, RIVN) through TradingView's free embeddable widgets. TradingView supplies and licenses the
// quotes; this site stores and republishes no prices. Widgets are rebuilt only when the colour theme changes.
const TICKERS = [["NASDAQ:TSLA", "Tesla"], ["NASDAQ:RIVN", "Rivian"]];
const tvBuilt = {};

function tvWidget(id, script, config) {
  const host = $(id), theme = isDark() ? "dark" : "light";
  if (!host || tvBuilt[id] === theme) return;
  tvBuilt[id] = theme;
  host.innerHTML = "";
  const box = document.createElement("div");
  box.className = "tradingview-widget-container";
  box.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
  const s = document.createElement("script");
  s.src = `https://s3.tradingview.com/external-embedding/${script}`;
  s.async = true;
  s.textContent = JSON.stringify({ ...config, colorTheme: theme, isTransparent: true, locale: "en" });
  box.appendChild(s);
  host.appendChild(box);
}

function renderQuotes() {
  TICKERS.forEach(([sym], i) => tvWidget(`tv-quote-${i}`, "embed-widget-single-quote.js", { symbol: sym, width: "100%" }));
}

function renderPriceChart() {
  tvWidget("tv-chart", "embed-widget-symbol-overview.js", {
    symbols: TICKERS.map(([sym, name]) => [name, `${sym}|12M`]), chartOnly: false, width: "100%", height: 420, autosize: true,
    showVolume: false, hideDateRanges: false, scalePosition: "right", scaleMode: "Normal", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: "12", noTimeScale: false, valuesTracking: "1", changeMode: "price-and-percent", chartType: "area", lineWidth: 2,
    dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
  });
}
