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
// Events that explain jumps in the data. Drawn on any chart whose x axis is dates ("2025-07-01") or quarters ("Q3 2025").
const EVENTS = [
  { d: "2021-11-10", q: "Q4 2021", t: "Rivian IPO", s: "IPO" },
  { d: "2023-11-30", q: "Q4 2023", t: "Cybertruck launch", s: "Cybertruck" },
  { d: "2025-09-30", q: "Q3 2025", t: "Federal EV tax credit ends", s: "Tax credit ends" },
  { d: "2026-04-01", q: "Q2 2026", t: "Rivian R2 launch", s: "R2" },
];
function eventMarks(traces, below = 0) {
  const xs = traces.flatMap((t) => (t.orientation === "h" || !Array.isArray(t.x) ? [] : t.x)).filter((v) => typeof v === "string");
  if (!xs.length) return { shapes: [], annotations: [] };
  const isDate = xs.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v)), isQ = xs.every((v) => /^Q[1-4] \d{4}$/.test(v));
  if (!isDate && !isQ) return { shapes: [], annotations: [] };
  const lo = isDate ? xs.reduce((a, b) => (a < b ? a : b)) : null, hi = isDate ? xs.reduce((a, b) => (a > b ? a : b)) : null, qs = new Set(xs);
  const hits = EVENTS.filter((e) => (isDate ? e.d > lo && e.d <= hi : qs.has(e.q)));
  const c = css("--muted"), cats = [...qs], narrow = innerWidth < 600;
  const frac = (e) => (isDate ? (Date.parse(e.d) - Date.parse(lo)) / (Date.parse(hi) - Date.parse(lo) || 1) : cats.indexOf(e.q) / Math.max(1, cats.length - 1));
  return {
    shapes: hits.map((e) => ({ type: "line", xref: "x", x0: isDate ? e.d : e.q, x1: isDate ? e.d : e.q, yref: "paper", y0: 0, y1: 1, line: { color: c, width: 1, dash: "dot" }, layer: "below" })),
    annotations: hits.map((e, i) => ({ x: isDate ? e.d : e.q, xref: "x", y: 1, yref: "paper", yanchor: "top", yshift: -2 - below - (narrow ? i : i % 2) * 14, text: narrow ? e.s : e.t, showarrow: false, xanchor: frac(e) > 0.7 ? "right" : "left", xshift: frac(e) > 0.7 ? -3 : 3, font: { size: 10.5, color: c }, bgcolor: "rgba(0,0,0,0)" })),
  };
}

// Every chart gets a "Download CSV" link with the data exactly as plotted (one row per series and point).
function chartCsv(gd) {
  const rows = [["series", "category", "value"]];
  (gd.data || []).forEach((t, i) => {
    const h = t.orientation === "h", cat = (h ? t.y : t.x) || [], val = (h ? t.x : t.y) || [];
    const name = t.name || (t.showlegend === false && t.hoverinfo === "skip" ? "80% range (upper)" : gd.data.length === 1 ? (gd.closest("article")?.querySelector("h3")?.textContent || "value") : `series ${i + 1}`);
    cat.forEach((c, k) => { if (val[k] != null) rows.push([name, c, val[k]]); });
  });
  return rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(",")).join("\n");
}
function addCsvLink(id) {
  const gd = $(id);
  if (!gd || gd.nextElementSibling?.classList.contains("plot-foot")) return;
  const foot = document.createElement("div");
  foot.className = "plot-foot";
  foot.innerHTML = '<button type="button" class="dl">Download CSV</button>';
  foot.firstChild.onclick = () => {
    const title = gd.closest("article")?.querySelector("h3")?.textContent || id;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([chartCsv(gd)], { type: "text/csv" }));
    a.download = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".csv";
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  gd.after(foot);
}

// Period filter shared by every time chart: keeps points from the chosen year onward. Charts that are not over time,
// or that position markers by index (forecast dividers), are left alone.
let PERIOD = "all";
const PERIODS = ["all", "2020", "2022", "2024", "2025"];
function xKey(v) {
  if (typeof v !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{4}-\d{2}$/.test(v)) return v + "-01";
  if (/^\d{4}$/.test(v)) return v + "-01-01";
  const m = v.match(/^Q([1-4]) (\d{4})$/);
  return m ? `${m[2]}-${String((m[1] - 1) * 3 + 1).padStart(2, "0")}-01` : null;
}
function applyPeriod(traces, lay) {
  if (PERIOD === "all" || (lay.shapes || []).some((sh) => typeof sh.x0 === "number")) return [traces, lay];
  const xs = traces.filter((t) => t.orientation !== "h" && Array.isArray(t.x) && t.x.length);
  if (!xs.length || !xs.every((t) => t.x.every((v) => xKey(v) !== null))) return [traces, lay];
  const st = `${PERIOD}-01-01`;
  const out = traces.map((t) => {
    if (t.orientation === "h" || !Array.isArray(t.x)) return t;
    const keep = t.x.map((v) => xKey(v) >= st), n = t.x.length, cut = (a) => (Array.isArray(a) && a.length === n ? a.filter((_, i) => keep[i]) : a);
    const u = {}; for (const [k, v] of Object.entries(t)) u[k] = cut(v);
    if (t.marker) { u.marker = {}; for (const [k, v] of Object.entries(t.marker)) u.marker[k] = cut(v); }
    return u;
  });
  const l = { ...lay };
  if (l.xaxis?.range && String(l.xaxis.range[0]) < st) l.xaxis = { ...l.xaxis, range: [st, l.xaxis.range[1]] };
  if (Array.isArray(l.xaxis?.tickvals)) { const keepT = l.xaxis.tickvals.map((v) => (xKey(String(v)) ?? st) >= st); l.xaxis = { ...l.xaxis, tickvals: l.xaxis.tickvals.filter((_, i) => keepT[i]), ticktext: l.xaxis.ticktext?.filter((_, i) => keepT[i]) }; }
  return [out, l];
}

const draw = (id, tracesIn, layIn) => {
  const [traces, lay] = applyPeriod(tracesIn, layIn);
  const ev = eventMarks(traces, (lay.annotations || []).length ? 18 : 0);   // start below a chart's own top labels
  const l = { ...lay, shapes: [...(lay.shapes || []), ...ev.shapes], annotations: [...(lay.annotations || []), ...ev.annotations] };
  const p = Plotly.react(id, traces, l, { displayModeBar: false, responsive: true, scrollZoom: false });
  addCsvLink(id);
  return p;
};
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
