import { defBar, defText, gridEl, timerEl } from "./dom.js";
import { state } from "./state.js";
import { notifySelection } from "./bridge.js";
import { safePlay, safeStop, sounds, stopAllFx, stopRevealSound } from "./audio.js";

function key(r, c) {
  return `${r},${c}`;
}

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
  return state.grid?.magicWordCells && state.grid.magicWordCells.has(pos);
}

function isMagicHighlightCell(pos) {
  return (state.grid?.magic && state.grid.magic.has(pos))
    || (state.grid?.magicWordCells && state.grid.magicWordCells.has(pos));
}

export function setMagicWord(wordId) {
  if (!state.grid) return;
  const prevCells = state.grid.magicWordCells || new Set();
  state.grid.magicWordId = wordId;
  state.grid.magicWordCells = buildMagicWordCells(wordId);
  state.grid.magicSolved = false;
  if (wordId == null) {
    for (const [pos] of state.grid.letters) {
      const [r, c] = pos.split(",").map(Number);
      renderCell(r, c);
    }
    return;
  }
  const refresh = new Set([...prevCells, ...state.grid.magicWordCells]);
  for (const pos of refresh) {
    if (state.grid.magicWordCells.has(pos)) {
      state.grid.revealed.set(pos, false);
    }
    const [r, c] = pos.split(",").map(Number);
    renderCell(r, c);
  }
}

function isMagicWordSelection(word) {
  if (!word || !state.grid?.magicWordCells || !state.grid.magicWordCells.size) return false;
  if (word.id === state.grid.magicWordId) return true;
  if (!Array.isArray(word.cells) || word.cells.length !== state.grid.magicWordCells.size) return false;
  return word.cells.every((p) => state.grid.magicWordCells.has(key(p.r, p.c)));
}

export function rebuildGrid(payload) {
  return {
    url: payload.url,
    bounds: payload.bounds,
    letters: new Map(payload.letters),
    numbers: new Map(payload.numbers),
    revealed: new Map(payload.revealed),
    magic: new Set(payload.magic || []),
    words: payload.words,
    cellToWords: new Map(payload.cellToWords),
    numberPosToWord: new Map(payload.numberPosToWord),
    magicWordId: payload.magicWordId ?? null,
    magicWordCells: new Set(),
    magicSolved: !!payload.magicSolved
  };
}

function showDefinition(text) {
  if (!text) {
    defBar.classList.add("hidden");
    defText.textContent = "";
    fitGridToViewport();
    return;
  }
  defBar.classList.remove("hidden");
  defText.textContent = text;
  fitGridToViewport();
}

function fitGridToViewport() {
  if (!state.grid || !gridEl) return;

  const { minRow, maxRow, minCol, maxCol } = state.grid.bounds;
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;

  const rootStyles = getComputedStyle(document.documentElement);
  const cellSize = parseFloat(rootStyles.getPropertyValue("--cell")) || 72;
  const gap = parseFloat(rootStyles.getPropertyValue("--gap")) || 4;
  const gridStyles = getComputedStyle(gridEl);
  const padX = (parseFloat(gridStyles.paddingLeft) || 0) + (parseFloat(gridStyles.paddingRight) || 0);
  const padY = (parseFloat(gridStyles.paddingTop) || 0) + (parseFloat(gridStyles.paddingBottom) || 0);
  const borderX = (parseFloat(gridStyles.borderLeftWidth) || 0) + (parseFloat(gridStyles.borderRightWidth) || 0);
  const borderY = (parseFloat(gridStyles.borderTopWidth) || 0) + (parseFloat(gridStyles.borderBottomWidth) || 0);

  const gridWidth = cols * cellSize + Math.max(0, cols - 1) * gap + padX + borderX;
  const gridHeight = rows * cellSize + Math.max(0, rows - 1) * gap + padY + borderY;

  const availableW = window.innerWidth - 32;
  let availableH = window.innerHeight - 32;
  if (defBar && !defBar.classList.contains("hidden")) {
    availableH -= defBar.offsetHeight + 12;
  }

  const scale = Math.min(
    1,
    availableW / Math.max(1, gridWidth),
    availableH / Math.max(1, gridHeight)
  );
  gridEl.style.transformOrigin = "center center";
  gridEl.style.transform = `scale(${Math.max(0.1, scale)})`;
}

export function buildGridDOM() {
  gridEl.innerHTML = "";
  state.selectedWordId = null;
  state.tempNumbers.clear();
  state.gridCompletePlayed = false;
  showDefinition("");

  const { minRow, maxRow, minCol, maxCol } = state.grid.bounds;
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;

  gridEl.style.gridTemplateRows = `repeat(${rows}, var(--cell))`;
  gridEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const pos = key(r, c);
      const hasLetter = state.grid.letters.has(pos);
      const hasNumber = state.grid.numbers.has(pos);

      const cell = document.createElement("div");
      cell.dataset.pos = pos;

      if (hasLetter) {
        cell.className = "cell letter";
        cell.addEventListener("click", () => onLetterCellClick(r, c));
        gridEl.appendChild(cell);
        renderCell(r, c);
        continue;
      }

      if (hasNumber) {
        cell.className = "cell number";
        renderNumberCell(r, c);
        cell.addEventListener("click", () => onNumberCellClick(r, c));
        gridEl.appendChild(cell);
        continue;
      }

      cell.className = "cell empty";
      cell.setAttribute("aria-hidden", "true");
      gridEl.appendChild(cell);
    }
  }

  fitGridToViewport();
}

export function renderCell(r, c) {
  const pos = key(r, c);
  const el = document.querySelector(`[data-pos="${pos}"]`);
  if (!el) return;

  if (state.grid.letters.has(pos)) {
    const revealed = state.grid.revealed.get(pos);
    const magicWordCell = isMagicWordCell(pos);
    const canReveal = !magicWordCell || state.grid.magicSolved;
    el.classList.remove("revealed", "dim", "nop", "orange", "magic");
    if (isMagicHighlightCell(pos)) el.classList.add("magic");

    if (revealed && canReveal) {
      el.classList.add("revealed");
      el.textContent = state.grid.letters.get(pos);
    } else {
      el.textContent = "";
    }
  }
}

function clearHighlight() {
  for (const [pos] of state.grid.letters) {
    const el = document.querySelector(`[data-pos="${pos}"]`);
    if (!el) continue;

    const magicWordCell = isMagicWordCell(pos);
    const canReveal = !magicWordCell || state.grid.magicSolved;
    el.classList.remove("dim", "nop", "orange", "magic");
    if (isMagicHighlightCell(pos)) el.classList.add("magic");

    if (state.grid.revealed.get(pos) && canReveal) {
      el.classList.add("revealed");
      el.textContent = state.grid.letters.get(pos);
    } else {
      el.textContent = "";
    }
  }
}

export function applySelection(word) {
  clearHighlight();
  state.tempNumbers.clear();

  if (!word) {
    state.selectedWordId = null;
    showDefinition("");
    stopAllFx();
    notifySelection(null);
    refreshNumberCells();
    resetTimer();
    return;
  }

  state.selectedWordId = word.id;
  const wordCells = new Set(word.cells.map((p) => key(p.r, p.c)));

  for (const [pos] of state.grid.letters) {
    const el = document.querySelector(`[data-pos="${pos}"]`);
    if (!el) continue;

    if (!wordCells.has(pos)) {
      el.classList.add("dim");
    }
  }

  const isMagic = isMagicWordSelection(word);
  showDefinition(isMagic ? "Mot Magique" : word.definition);
  stopAllFx("timer");
  safePlay(sounds.timer);
  if (word.numberPos) {
    state.tempNumbers.add(key(word.numberPos.r, word.numberPos.c));
  }
  if (isMagic) {
    safeStop(sounds.selectWord);
    stopAllFx("magicSelect");
    safePlay(sounds.magicSelect);
  } else {
    stopAllFx("selectWord");
    safePlay(sounds.selectWord);
  }
  refreshNumberCells();
  notifySelection(word.id);
}

function onLetterCellClick(r, c) {
  stopRevealSound();
  const pos = key(r, c);
  const ids = state.grid.cellToWords.get(pos);
  if (!ids || !ids.length) {
    applySelection(null);
    return;
  }
  applySelection(state.grid.words[ids[0]]);
}

function onNumberCellClick(r, c) {
  stopRevealSound();
  const pos = key(r, c);
  const wid = state.grid.numberPosToWord.get(pos);
  if (wid == null) {
    applySelection(null);
    return;
  }
  applySelection(state.grid.words[wid]);
}

export function showNumbersForLetter(letter) {
  if (!state.grid) return;
  state.tempNumbers.clear();

  const isWordFullyRevealed = (word) => {
    if (!word?.cells?.length) return false;
    return word.cells.every((p) => {
      const pos = key(p.r, p.c);
      const canReveal = !isMagicWordCell(pos) || state.grid.magicSolved;
      return canReveal && !!state.grid.revealed.get(pos);
    });
  };

  for (const [pos, ltr] of state.grid.letters) {
    if (ltr === letter) {
      const ids = state.grid.cellToWords.get(pos);
      if (ids) {
        ids.forEach((wid) => {
          const w = state.grid.words[wid];
          if (w?.numberPos && !isWordFullyRevealed(w)) {
            state.tempNumbers.add(key(w.numberPos.r, w.numberPos.c));
          }
        });
      }
    }
  }
  refreshNumberCells();
}

export function startTimer(seconds) {
  if (!timerEl) return;
  clearTimeout(state.timerHandle);
  timerEl.classList.remove("hidden");
  state.timerEndsAt = Date.now() + seconds * 1000;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  if (!timerEl) return;
  const remaining = Math.max(0, Math.ceil((state.timerEndsAt - Date.now()) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  timerEl.textContent = `${mm}:${ss}`;
  if (remaining <= 0) {
    resetTimer();
    return;
  }
  state.timerHandle = setTimeout(updateTimerDisplay, 250);
}

export function resetTimer() {
  if (!timerEl) return;
  clearTimeout(state.timerHandle);
  state.timerHandle = null;
  timerEl.classList.add("hidden");
}

export function animateWordReveal(word) {
  const cells = word.cells.map((p) => key(p.r, p.c));
  let i = 0;

  function step() {
    if (i >= cells.length) return;
    const pos = cells[i];
    const el = document.querySelector(`[data-pos="${pos}"]`);
    if (el) {
      el.classList.add("orange");
      el.textContent = state.grid.letters.get(pos);
    }
    i++;
    setTimeout(step, 80);
  }

  setTimeout(step, 500);
}

export function checkGridCompletion() {
  for (const [pos] of state.grid.letters) {
    if (!state.grid.revealed.get(pos)) return;
  }

  if (!state.gridCompletePlayed) {
    state.gridCompletePlayed = true;
    safePlay(sounds.gridComplete);
  }
}

export function renderNumberCell(r, c) {
  const pos = key(r, c);
  const el = document.querySelector(`[data-pos="${pos}"]`);
  if (!el) return;
  const visible = state.tempNumbers.has(pos);
  if (visible) {
    el.className = "cell number";
    el.textContent = state.grid.numbers.get(pos);
    el.removeAttribute("aria-hidden");
    el.style.pointerEvents = "auto";
  } else {
    el.className = "cell hidden-number";
    el.textContent = "";
    el.setAttribute("aria-hidden", "true");
    el.style.pointerEvents = "none";
  }
}

export function refreshNumberCells() {
  if (!state.grid) return;
  for (const [pos] of state.grid.numbers) {
    const [r, c] = pos.split(",").map(Number);
    renderNumberCell(r, c);
  }
}

window.addEventListener("resize", () => {
  fitGridToViewport();
});
