// Runs the dashboard's own probAtLeast (web/core.js) over web/ev.json and prints each series' chance of growth as JSON,
// so scripts/check_data.py can prove the Tableau export gives the same answers. Usage: node scripts/rules_probe.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, "..");
const ev = JSON.parse(fs.readFileSync(path.join(root, "web", "ev.json"), "utf8"));
const sb = { matchMedia: () => ({ matches: false }), document: { documentElement: { dataset: {} } }, getComputedStyle: () => ({ getPropertyValue: () => "" }), console };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(root, "web", "core.js"), "utf8") + "\n;this.probAtLeast = probAtLeast;", sb);
const S = [["Tesla deliveries", ev.tesla.quarters.map((r) => r.deliveries), ev.tesla.forecast_deliveries, 4], ["Tesla revenue ($M)", ev.tesla.quarters.filter((r) => r.revenue != null).map((r) => r.revenue), ev.tesla.forecast_revenue, 4],
  ["BYD NEV sales", ev.byd.months.map((r) => r.total), ev.byd.forecast_total, 12], ["BYD overseas sales", ev.byd.months.filter((r) => r.overseas != null).map((r) => r.overseas), ev.byd.forecast_overseas, 12],
  ["Rivian deliveries", ev.rivian.quarters.map((r) => r.deliveries), ev.rivian.forecast_deliveries, 4], ["Rivian revenue ($M)", ev.rivian.quarters.filter((r) => r.revenue != null && r.revenue > 0).map((r) => r.revenue), ev.rivian.forecast_revenue, 4]];
process.stdout.write(JSON.stringify(S.map(([name, y, fc, n]) => ({ series: name, p: sb.probAtLeast(fc.cumq[n - 1], y.slice(-n).reduce((a, b) => a + b, 0)) }))));
