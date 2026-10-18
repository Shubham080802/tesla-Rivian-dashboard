// Start-up, tabs and URL state. Each tab's logic lives in its own file; helpers are in core.js.
let EV = null, VS = null, RG = null;
const state = { tab: "versus" };
const TABS = ["versus", "ev", "regions", "lab", "drivers", "quality"];
const renderers = {
  versus: () => typeof renderVersus === "function" && renderVersus(), ev: () => typeof renderEv === "function" && renderEv(),
  regions: () => typeof renderRegions === "function" && renderRegions(), lab: () => renderLab(), drivers: () => renderDrivers(), quality: () => renderQuality(),
};
function prepEv(d) { EV = d; }
function prepVersus(d) { VS = d; }
function prepRegions(d) { RG = d; }

function syncUI() {
  document.querySelectorAll("#tabs button").forEach((b) => { const on = b.dataset.tab === state.tab; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + state.tab));
  document.body.dataset.tab = state.tab;
  writeHash();
}
function writeHash() {
  const p = new URLSearchParams();
  if (state.tab !== "versus") p.set("tab", state.tab);
  labWriteHash(p);
  const s = p.toString();
  if (location.hash.slice(1) !== s) history.replaceState(null, "", s ? "#" + s : location.pathname + location.search);
}
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (TABS.includes(p.get("tab"))) state.tab = p.get("tab");
  labReadHash(p);
}
function renderAll() { try { renderers[state.tab](); } catch (e) { console.error(e); } }
function goTab(t) { state.tab = t; syncUI(); renderAll(); window.scrollTo({ top: 0, behavior: "auto" }); }
let toastTimer;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800); }

function renderChips() {
  const T = EV.tesla.quarters, B = EV.byd.months;
  const items = [["Tesla", evQ(T.at(-1).q), monthsAgo(T.at(-1).q, 2)], ["BYD", fmt.month(B.at(-1).m), monthsAgo(B.at(-1).m)], ["Financials", String(VS.fin.years.at(-1)), monthsAgo(VS.fin.years.at(-1) + "-12")]];
  const cls = (a) => (a <= 4 ? "good" : a <= 12 ? "warn" : "bad"), worst = items.some(([, , a]) => a > 12) ? "bad" : items.some(([, , a]) => a > 4) ? "warn" : "good";
  $("freshChips").innerHTML = `<button type="button" class="fchip all ${worst}" data-go-tab="quality" title="About the data"><span class="fdot"></span>Data</button>` +
    items.map(([n, v, a]) => `<button type="button" class="fchip ${cls(a)}" data-go-tab="quality" title="${n}: latest ${v} (${ageText(a)}). Click for details."><span class="fdot"></span><b>${n}</b> ${v}</button>`).join("");
}

function start() {
  const get = (u, opt) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(u))).catch((e) => (opt ? null : Promise.reject(e)));
  Promise.all([get("ev.json"), get("versus.json"), get("drivers.json", true), get("checks.json", true), get("regions.json", true)]).then(([ev, vs, dr, ck, rg]) => {
    prepEv(ev); prepVersus(vs); if (rg) prepRegions(rg); if (dr) prepDrivers(dr); if (ck) prepChecks(ck);
    $("subtitle").textContent = `Public filings and announcements, through ${fmt.month(ev.byd.months.at(-1).m)}`;
    readHash(); renderChips(); initLab(); initAsk();
    $("tabs").onclick = (e) => { const b = e.target.closest("button"); if (b) goTab(b.dataset.tab); };
    document.addEventListener("click", (e) => { const b = e.target.closest("[data-go-tab]"); if (b) goTab(b.dataset.goTab); });
    $("shareBtn").onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast("Link to this view copied"); } catch (err) { toast("Copy the address bar to share this view"); } };
    $("themeBtn").onclick = () => { const next = isDark() ? "light" : "dark"; document.documentElement.dataset.theme = next; try { localStorage.setItem("theme", next); } catch (err) {} renderAll(); };
    matchMedia("(prefers-color-scheme: dark)").onchange = renderAll;
    window.addEventListener("hashchange", () => { readHash(); syncUI(); renderAll(); });
    syncUI(); renderAll();
  }).catch((e) => { $("subtitle").textContent = "Failed to load data: " + e; });
}
window.addEventListener("DOMContentLoaded", start);
