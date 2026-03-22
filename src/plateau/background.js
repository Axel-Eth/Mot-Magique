import { initBackgroundBubbles } from "./letters.js";

const BG_THEME_BUBBLES = "bubbles";
const BG_STORAGE_KEY = "avm_plateau_background_theme_v1";

function loadSavedTheme() {
  try {
    const saved = localStorage.getItem(BG_STORAGE_KEY);
    return saved === BG_THEME_BUBBLES ? BG_THEME_BUBBLES : BG_THEME_BUBBLES;
  } catch {
    return BG_THEME_BUBBLES;
  }
}

function saveTheme() {
  try {
    localStorage.setItem(BG_STORAGE_KEY, BG_THEME_BUBBLES);
  } catch {}
}

function getBgRoot() {
  return document.getElementById("bg");
}

export function applyBackgroundTheme() {
  const root = getBgRoot();
  if (root) {
    root.dataset.theme = BG_THEME_BUBBLES;
  }
  initBackgroundBubbles();
  saveTheme();
  return BG_THEME_BUBBLES;
}

export function initBackgroundTheme() {
  loadSavedTheme();
  return applyBackgroundTheme();
}
