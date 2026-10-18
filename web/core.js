// Shared helpers: formatting, Plotly defaults, small UI parts. Tab logic lives in its own file.
const $ = (id) => document.getElementById(id);
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const isDark = () => matchMedia("(prefers-color-scheme: dark)").matches
  ? document.documentElement.dataset.theme !== "light" : document.documentElement.dataset.theme === "dark";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = {
  int: (v) => Math.round(v).toLocaleString("en-US"),
  intC: (v) => (v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : String(Math.round(v))),
  usdB: (m) => "$" + (m / 1e3).toFixed(1) + "B",                  // $ millions -> "$28.2B"
  pct: (v, d = 1) => (v * 100).toFixed(d) + "%",
  month: (m) => MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4),
};
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : NaN);
const rolling = (a, w) => a.map((_, i) => mean(a.slice(Math.max(0, i - w + 1), i + 1)));
const ok = (v) => Number.isFinite(v);
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const esc2 = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = {                                   // small per-viewer conveniences; never required
  get(k) { try { return localStorage.getItem("dash." + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem("dash." + k, v); } catch (e) {} },
};

const monthsAgo = (ym, add = 0) => { const n = new Date(); return n.getFullYear() * 12 + n.getMonth() - ((+ym.slice(0, 4)) * 12 + (+ym.slice(5, 7) - 1 + add)); };
const ageText = (m) => (m <= 0 ? "this month" : m === 1 ? "1 month ago" : m < 24 ? `${m} months ago` : `${(m / 12).toFixed(1)} years ago`);
const ageBadge = (m) => (m <= 4 ? '<span class="badge good">Current</span>' : m <= 12 ? '<span class="badge warn">Ageing</span>' : '<span class="badge bad">Out of date</span>');
const evQ = (q) => `Q${(+q.slice(5, 7) - 1) / 3 + 1} ${q.slice(0, 4)}`;

function layout(extra = {}) {
  const ax = { gridcolor: css("--grid"), gridwidth: 1, zeroline: false, linecolor: css("--axis"), tickcolor: "rgba(0,0,0,0)",
    tickfont: { color: css("--muted"), size: 12 }, automargin: true };
  const l = {
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "system-ui, -apple-system, 'Segoe UI', sans-serif", color: css("--ink2"), size: 12 },
    margin: { l: 8, r: 8, t: 8, b: 8 },
    xaxis: { ...ax, showgrid: false, showline: true },
    yaxis: { ...ax, showline: false },
    hovermode: "x unified",
    hoverlabel: { bgcolor: css("--surface"), bordercolor: css("--axis"), font: { color: css("--ink"), size: 12.5 }, namelength: -1 },
    legend: { orientation: "h", x: 0, y: 1.12, font: { color: css("--ink2"), size: 12.5 }, bgcolor: "rgba(0,0,0,0)" },
    bargap: 0.38, dragmode: "zoom",
    transition: { duration: reduceMotion ? 0 : 350, easing: "cubic-in-out" },
  };
  for (const k of Object.keys(extra)) {
    l[k] = (extra[k] && typeof extra[k] === "object" && !Array.isArray(extra[k]) && l[k]) ? { ...l[k], ...extra[k] } : extra[k];
  }
  return l;
}
const draw = (id, traces, lay) => Plotly.react(id, traces, lay, { displayModeBar: false, responsive: true, scrollZoom: false });
const line = (color, w = 2) => ({ color, width: w, shape: "spline", smoothing: 0.4 });

const ARROW = { up: "▲", down: "▼", flat: "–" };
function deltaChip(value, textFn, goodWhenUp = true) {
  if (!ok(value)) return `<span class="chip flat">${ARROW.flat} n/a</span>`;
  const dir = Math.abs(value) < 1e-9 ? "flat" : value > 0 ? "up" : "down";
  const cls = dir === "flat" ? "flat" : (value > 0) === goodWhenUp ? "up" : "down";
  return `<span class="chip ${cls}"><span aria-hidden="true">${ARROW[dir]}</span>${textFn(value)}</span>`;
}
const pctTxt = (v) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1) + "%";
const numTxt = (d, p = 2) => (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(p) + d;
const info = (text) => `<button type="button" class="tip" aria-label="${esc2(text)}" data-tip="${esc2(text)}">i</button>`;
function tile({ label, value, delta, sub }) {
  return `<div class="tile"><div class="l">${label}</div><div class="v">${value}</div><div class="sub">${delta || ""}${sub ? `<span>${sub}</span>` : ""}</div></div>`;
}

// P(total >= x) from the 19 stored cumulative quantiles (5% to 95%), linear between them
const QLEVELS = Array.from({ length: 19 }, (_, i) => 0.05 * (i + 1));
function probAtLeast(qv, x) {
  if (x <= qv[0]) return 0.97;
  if (x >= qv.at(-1)) return 0.03;
  for (let i = 1; i < qv.length; i++) {
    if (x <= qv[i]) { const w = qv[i] === qv[i - 1] ? 0 : (x - qv[i - 1]) / (qv[i] - qv[i - 1]); return 1 - (QLEVELS[i - 1] + w * (QLEVELS[i] - QLEVELS[i - 1])); }
  }
  return 0.03;
}
