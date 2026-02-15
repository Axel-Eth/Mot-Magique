import { $ } from "./dom.js";
import { state } from "./state.js";
import { buildMagicWordCells, updateMagicButtonState } from "./magic.js";
import { parseCustomGrid, parseJsonGrid, parseXlsx, serializeGridForPlateau } from "./grid-data.js";
import { loadCustomGridList } from "./grid-select.js";
import { postToPlateau } from "./bridge.js";
import { renderRegieGrid, clearVisibleNumbers } from "./grid-view.js";
import { setActionButtonsEnabled, updateSelectedInfo } from "./ui.js";

export async function loadSelectedGrid() {
  const file = $("gridSelect").value;

  state.grid = null;
  state.selectedWordId = null;
  state.visibleNumbers = new Set();
  updateSelectedInfo();
  setActionButtonsEnabled(false);

  try {
    let g = null;
    if (file.startsWith("custom:")) {
      const id = file.slice("custom:".length);
      const list = loadCustomGridList();
      const entry = list.find((x) => x.id === id);
      if (!entry) throw new Error("Grille locale introuvable.");
      g = parseCustomGrid(entry);
    } else if (/\.json$/i.test(file)) {
      g = await parseJsonGrid(file);
    } else {
      g = await parseXlsx(file);
    }
    state.grid = g;
    state.visibleNumbers = new Set();
    state.magicWordId = state.grid.magicWordId ?? null;
    state.magicSolved = state.grid.magicSolved ?? false;
    state.magicWordCells = buildMagicWordCells(state.magicWordId);
    if (state.grid) {
      state.grid.magicWordId = state.magicWordId;
      state.grid.magicWordCells = state.magicWordCells;
      state.grid.magicSolved = state.magicSolved;
    }
    updateMagicButtonState();

    postToPlateau({ type: "LOAD_GRID", grid: serializeGridForPlateau(g) });
    renderRegieGrid();
  } catch (err) {
    console.error(err);
    alert(String(err?.message ?? err));
  }
}

export function resetReveal() {
  if (!state.grid) return;
  for (const pos of state.grid.revealed.keys()) {
    state.grid.revealed.set(pos, false);
  }
  state.magicSolved = false;
  state.grid.magicSolved = false;
  for (const pos of state.magicWordCells) {
    state.grid.revealed.set(pos, false);
  }
  state.selectedWordId = null;
  clearVisibleNumbers();
  updateSelectedInfo();
  updateMagicButtonState();
  setActionButtonsEnabled(false);
  postToPlateau({ type: "RESET_REVEAL" });
  renderRegieGrid();
}
