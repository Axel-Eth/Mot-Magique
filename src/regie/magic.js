import { $ } from "./dom.js";
import { state } from "./state.js";

export function buildMagicWordCells(wordId) {
  const set = new Set();
  if (!state.grid || wordId == null) return set;
  const word = state.grid.words?.[wordId];
  if (!word) return set;
  word.cells.forEach((p) => {
    set.add(`${p.r},${p.c}`);
  });
  return set;
}

export function isMagicWordCell(pos) {
  return state.magicWordCells.has(pos);
}

export function isMagicHighlightCell(pos) {
  return (state.grid?.magic && state.grid.magic.has(pos)) || state.magicWordCells.has(pos);
}

export function updateMagicButtonState() {
  const btn = $("btnMagicWord");
  if (!btn) return;
  const isMagicSelected =
    state.selectedWordId != null && state.selectedWordId === state.magicWordId;
  btn.classList.toggle("active", isMagicSelected);
}
