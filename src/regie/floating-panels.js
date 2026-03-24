import { $ } from "./dom.js";
import { refreshRegieGridLayout } from "./grid-view.js";

let zIndexSeed = 10;
let resizeObserver = null;

function getLayout() {
  return document.querySelector(".layout");
}

function bringPanelToFront(panel) {
  if (!panel) return;
  zIndexSeed += 1;
  document.querySelectorAll(".floating-panel.active").forEach((el) => {
    if (el !== panel) el.classList.remove("active");
  });
  panel.classList.add("active");
  panel.style.zIndex = `${zIndexSeed}`;
}

function clampPanelToLayout(panel) {
  const layout = getLayout();
  if (!layout || !panel || window.innerWidth <= 980) return;
  const maxLeft = Math.max(0, layout.clientWidth - panel.offsetWidth);
  const left = Math.min(maxLeft, Math.max(0, panel.offsetLeft));
  const top = Math.max(0, panel.offsetTop);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function syncLayoutHeight() {
  const layout = getLayout();
  if (!layout || window.innerWidth <= 980) {
    if (layout) layout.style.minHeight = "";
    return;
  }
  const panels = [...layout.querySelectorAll(".floating-panel")];
  const maxBottom = panels.reduce((acc, panel) => {
    return Math.max(acc, panel.offsetTop + panel.offsetHeight);
  }, 0);
  layout.style.minHeight = `${Math.max(maxBottom + 20, window.innerHeight - 92)}px`;
}

function initPanelDrag(panel) {
  const handle = panel?.querySelector(".floating-panel-handle");
  if (!panel || !handle) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMove = (event) => {
    if (!dragging) return;
    panel.style.left = `${Math.round(event.clientX - offsetX)}px`;
    panel.style.top = `${Math.round(event.clientY - offsetY)}px`;
    clampPanelToLayout(panel);
    syncLayoutHeight();
    if (panel.id === "regieGridPanel") refreshRegieGridLayout();
  };

  const stopDrag = () => {
    dragging = false;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", stopDrag);
    document.removeEventListener("pointercancel", stopDrag);
  };

  handle.addEventListener("pointerdown", (event) => {
    if (window.innerWidth <= 980) return;
    if (event.button != null && event.button !== 0) return;
    if (event.target?.closest?.("button, input, select, textarea, a, label")) return;
    const rect = panel.getBoundingClientRect();
    dragging = true;
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    bringPanelToFront(panel);
    event.preventDefault();
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", stopDrag);
    document.addEventListener("pointercancel", stopDrag);
  });

  panel.addEventListener("pointerdown", () => bringPanelToFront(panel), true);
}

function placePanels() {
  const controls = $("regieControlsPanel");
  const grid = $("regieGridPanel");
  const teams = $("regieTeamsPanel");
  const layout = getLayout();
  if (!controls || !grid || !teams || !layout || window.innerWidth <= 980) return;

  const sideWidth = controls.offsetWidth || 476;
  const gap = 16;
  const layoutWidth = layout.clientWidth;
  const gridLeft = sideWidth + gap;
  const gridWidth = Math.max(640, layoutWidth - gridLeft);

  controls.style.left = "0px";
  controls.style.top = "0px";
  controls.style.width = `${sideWidth}px`;

  grid.style.left = `${gridLeft}px`;
  grid.style.top = "0px";
  grid.style.width = `${gridWidth}px`;
  grid.style.height = `${Math.max(420, window.innerHeight - 150)}px`;

  const teamsTop = controls.offsetHeight + gap;
  teams.style.left = "0px";
  teams.style.top = `${teamsTop}px`;
  teams.style.width = `${sideWidth}px`;
  teams.style.height = `${Math.max(220, window.innerHeight - teamsTop - 120)}px`;

  [controls, grid, teams].forEach((panel) => {
    clampPanelToLayout(panel);
    bringPanelToFront(panel);
  });
  bringPanelToFront(grid);
  syncLayoutHeight();
  refreshRegieGridLayout();
}

export function initFloatingPanels() {
  const panels = ["regieControlsPanel", "regieGridPanel", "regieTeamsPanel"]
    .map((id) => $(id))
    .filter(Boolean);

  panels.forEach(initPanelDrag);

  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver((entries) => {
      let shouldRefreshGrid = false;
      entries.forEach(({ target }) => {
        clampPanelToLayout(target);
        if (target.id === "regieGridPanel") shouldRefreshGrid = true;
      });
      syncLayoutHeight();
      if (shouldRefreshGrid) refreshRegieGridLayout();
    });
    panels.forEach((panel) => resizeObserver.observe(panel));
  }

  window.addEventListener("resize", () => {
    if (window.innerWidth <= 980) {
      const layout = getLayout();
      if (layout) layout.style.minHeight = "";
      return;
    }
    placePanels();
  });

  requestAnimationFrame(() => {
    placePanels();
  });
}
