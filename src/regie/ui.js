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
  const wordModal = $("wordSelectModal");
  if (!state.grid || state.selectedWordId == null) {
    setText("selectedInfo", "-");
    setText("regieWordHeader", "Aucun mot selectionne");
    setText("regieDefinitionText", "Selectionne un mot dans la grille pour afficher sa definition ici.");
    wordModal?.classList.add("hidden");
    return;
  }
  const w = state.grid.words[state.selectedWordId];
  const n = w.number != null ? `#${w.number}` : "-";
  setText("selectedInfo", `${n} ${w.orientation} (${w.cells.length})`);
  setText("regieWordHeader", `${n} ${w.orientation} (${w.cells.length} lettres)`);
  setText("regieDefinitionText", w.definition || "Aucune definition renseignee.");
  wordModal?.classList.remove("hidden");
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

export function initWordSelectModalDrag() {
  const modal = $("wordSelectModal");
  const card = modal?.querySelector(".word-select-card");
  const handle = $("regieWordHeader");
  if (!modal || !card || !handle) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMouseMove = (e) => {
    if (!dragging) return;
    const nextLeft = e.clientX - offsetX;
    const nextTop = e.clientY - offsetY;
    card.style.left = `${Math.max(8, nextLeft)}px`;
    card.style.top = `${Math.max(8, nextTop)}px`;
  };

  const stopDrag = () => {
    dragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", stopDrag);
  };

  handle.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const rect = card.getBoundingClientRect();

    // Keep the existing centered appearance until first drag.
    card.style.position = "fixed";
    card.style.margin = "0";
    card.style.left = `${rect.left}px`;
    card.style.top = `${rect.top}px`;
    card.style.transform = "none";

    dragging = true;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopDrag);
  });
}
