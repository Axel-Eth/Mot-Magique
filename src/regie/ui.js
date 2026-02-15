import { $, setText } from "./dom.js";
import { state } from "./state.js";
import { postToPlateau } from "./bridge.js";
import { updateMagicButtonState } from "./magic.js";

export function setPlateauLabel() {
  setText(
    "plateauState",
    state.plateauWin && !state.plateauWin.closed ? "ouvert" : "fermee"
  );
}

export function setActionButtonsEnabled(enabled) {
  const btnCorrect = $("btnCorrect");
  const btnNop = $("btnNop");
  if (btnCorrect) btnCorrect.disabled = !enabled;
  if (btnNop) btnNop.disabled = !enabled;
  const btnMagic = $("btnMagicWord");
  if (btnMagic) btnMagic.disabled = !enabled;
}

export function setFullscreenEnabled(enabled) {
  const btn = $("btnFullscreen");
  if (btn) btn.disabled = !enabled;
}

export function setMultiplier(value, silent = false) {
  state.multiplier = value;
  const b2 = $("btnDouble");
  const b3 = $("btnTriple");
  if (b2) b2.classList.toggle("active", value === 2);
  if (b3) b3.classList.toggle("active", value === 3);
  if (!silent) {
    postToPlateau({ type: "SET_MULTIPLIER", value });
  }
}

export function setBadPointsActive(active) {
  state.badPointsActive = active;
  const btn = $("btnBad");
  if (btn) btn.classList.toggle("bad-active", active);
}

export function updateSelectedInfo() {
  if (!state.grid || state.selectedWordId == null) {
    setText("selectedInfo", "-");
    return;
  }
  const w = state.grid.words[state.selectedWordId];
  const n = w.number != null ? `#${w.number}` : "-";
  setText("selectedInfo", `${n} ${w.orientation} (${w.cells.length})`);
}

export function countRemainingLetters() {
  if (!state.grid) return 0;
  let remaining = 0;
  for (const [pos] of state.grid.letters) {
    if (!state.grid.revealed.get(pos)) remaining++;
  }
  return remaining;
}

export function resetSelectionUi() {
  updateSelectedInfo();
  updateMagicButtonState();
  setActionButtonsEnabled(false);
}
