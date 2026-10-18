// "Tableau" tab: embeds the three dashboards published on Tableau Public. The frame loads only when the tab is opened.
const TB_BASE = "https://public.tableau.com/views/TeslavsBYD_17923592165710/";
const TB_PROFILE = "https://public.tableau.com/app/profile/shubham.kumar6508/viz/TeslavsBYD_17923592165710/";
const tbState = { view: "TeslavsBYDheadtohead" };

function renderTableau() {
  const seg = $("tbSeg"), frame = $("tbFrame");
  if (!seg._bound) {
    seg._bound = true;
    seg.onclick = (e) => { const b = e.target.closest("[data-v]"); if (b) { tbState.view = b.dataset.v; renderTableau(); } };
  }
  seg.querySelectorAll("button").forEach((b) => { const on = b.dataset.v === tbState.view; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
  const src = `${TB_BASE}${tbState.view}?:showVizHome=no&:embed=true&:tabs=no&:toolbar=yes&:device=desktop`;
  if (frame.getAttribute("src") !== src) frame.setAttribute("src", src);
  $("tbOpen").href = TB_PROFILE + tbState.view;
}
