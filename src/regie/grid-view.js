import { $ } from "./dom.js";
import { state } from "./state.js";
import { ensureTeamChosen } from "./teams.js";
import { isMagicHighlightCell, isMagicWordCell } from "./magic.js";
import { postToPlateau } from "./bridge.js";
import { setActionButtonsEnabled, updateSelectedInfo } from "./ui.js";
import { updateMagicButtonState } from "./magic.js";
import { keyPos } from "./grid-data.js";
import { startRegieTimer } from "./timer.js";

export function clearVisibleNumbers() {
  state.visibleNumbers = new Set();
}

export function showNumbersForWords(wordIds = []) {
  const s = new Set();
  if (state.grid && Array.isArray(wordIds)) {
    for (const wid of wordIds) {
      const w = state.grid.words?.[wid];
      if (w?.numberPos) s.add(keyPos(w.numberPos));
    }
  }
  state.visibleNumbers = s;
}

export function showNumbersForLetter(letter) {
  if (!state.grid) return;
  const s = new Set();

  const isWordFullyRevealed = (word) => {
    if (!word?.cells?.length) return false;
    return word.cells.every((p) => {
      const pos = `${p.r},${p.c}`;
      const canReveal = !isMagicWordCell(pos) || state.magicSolved;
      return canReveal && !!state.grid.revealed.get(pos);
    });
  };

  for (const [pos, ltr] of state.grid.letters) {
    if (ltr === letter) {
      const ids = state.grid.cellToWords.get(pos);
      if (ids) {
        ids.forEach((wid) => {
          const w = state.grid.words?.[wid];
          if (w?.numberPos && !isWordFullyRevealed(w)) {
            s.add(keyPos(w.numberPos));
          }
        });
      }
    }
  }
  state.visibleNumbers = s;
}

function revealLetterEverywhere(letter) {
  const ltr = String(letter || "").trim().toUpperCase();
  if (!ltr || !state.grid) return;

  for (const [pos, value] of state.grid.letters) {
    if (value === ltr && (!isMagicWordCell(pos) || state.magicSolved)) {
      state.grid.revealed.set(pos, true);
    }
  }

  const lastLetter = $("lastLetter");
  if (lastLetter) lastLetter.textContent = `Lettre : ${ltr}`;

  showNumbersForLetter(ltr);
  renderRegieGrid();

  // Meme sequence que la saisie clavier: on coupe le media puis on revele.
  postToPlateau({ type: "HIDE_MEDIA" });
  postToPlateau({ type: "STOP_MUSIC" });
  postToPlateau({ type: "REVEAL_LETTER", letter: ltr });
}

function revealMagicHintCell(pos) {
  if (!state.grid || !pos) return;
  if (!state.grid.magicHints) state.grid.magicHints = new Set();

  state.grid.magicHints.add(pos);
  state.grid.revealed.set(pos, true);

  const [r, c] = pos.split(",").map(Number);
  const letter = state.grid.letters.get(pos) || "";
  const lastLetter = $("lastLetter");
  if (lastLetter && letter) lastLetter.textContent = `Lettre : ${letter}`;

  renderRegieGrid();
  postToPlateau({ type: "HIDE_MEDIA" });
  postToPlateau({ type: "STOP_MUSIC" });
  postToPlateau({ type: "REVEAL_MAGIC_HINT_CELL", r, c });
}

export function renderRegieGrid() {
  const gridEl = $("regieGrid");
  if (!gridEl || !state.grid) return;
  gridEl.innerHTML = "";

  const { minRow, maxRow, minCol, maxCol } = state.grid.bounds;
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;

  gridEl.style.gridTemplateRows = `repeat(${rows}, 48px)`;
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 48px)`;

  const visibleNums = state.visibleNumbers || new Set();

  const selectedWord =
    state.selectedWordId != null ? state.grid.words[state.selectedWordId] : null;
  const selectedCells = new Set(
    selectedWord ? selectedWord.cells.map((p) => `${p.r},${p.c}`) : []
  );

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const pos = `${r},${c}`;
      const hasLetter = state.grid.letters.has(pos);
      const hasNumber = state.grid.numbers.has(pos);

      const cell = document.createElement("div");
      cell.dataset.pos = pos;

      if (!hasLetter && !hasNumber) {
        cell.className = "cell empty";
        cell.setAttribute("aria-hidden", "true");
        gridEl.appendChild(cell);
        continue;
      }

      if (hasLetter) {
        cell.className = "cell letter";
        const revealed = state.grid.revealed.get(pos);
        const magicWordCell = isMagicWordCell(pos);
        const hintedMagic = !!state.grid.magicHints?.has(pos);
        const canReveal = !magicWordCell || state.magicSolved || hintedMagic;
        if (isMagicHighlightCell(pos)) cell.classList.add("magic");
        if (selectedWord && selectedCells.has(pos)) {
          cell.classList.add("revealed");
          cell.textContent = state.grid.letters.get(pos);
        } else if (revealed && canReveal) {
          cell.classList.add("revealed");
          cell.textContent = state.grid.letters.get(pos);
        }
        if (selectedWord && !selectedCells.has(pos)) {
          cell.classList.add("dim");
        }
        if (selectedCells.has(pos)) {
          cell.classList.add("selected-word");
        }
        cell.addEventListener("click", (e) => {
          if (e.ctrlKey || e.metaKey) {
            if (magicWordCell && !state.magicSolved) {
              revealMagicHintCell(pos);
            } else {
              revealLetterEverywhere(state.grid.letters.get(pos));
            }
            return;
          }
          if (!ensureTeamChosen()) return;
          const ids = state.grid.cellToWords.get(pos);
          if (ids && ids.length) {
            state.selectedWordId = ids[0];
            clearVisibleNumbers();
            const w = state.grid.words[state.selectedWordId];
            if (w?.numberPos) state.visibleNumbers.add(`${w.numberPos.r},${w.numberPos.c}`);
            updateSelectedInfo();
            setActionButtonsEnabled(true);
            updateMagicButtonState();
            postToPlateau({ type: "SELECT_WORD", wordId: state.selectedWordId });
            startRegieTimer(30);
            renderRegieGrid();
          }
        });
      } else if (hasNumber) {
        const visible = visibleNums.has(pos);
        cell.className = visible ? "cell number" : "cell hidden-number";
        cell.textContent = visible ? state.grid.numbers.get(pos) : "";
        if (visible) {
          cell.addEventListener("click", () => {
            if (!ensureTeamChosen()) return;
            const wid = state.grid.numberPosToWord.get(pos);
            if (wid != null) {
              state.selectedWordId = wid;
              state.visibleNumbers = new Set();
              const w = state.grid.words[wid];
              if (w?.numberPos) state.visibleNumbers.add(`${w.numberPos.r},${w.numberPos.c}`);
              updateSelectedInfo();
              setActionButtonsEnabled(true);
              updateMagicButtonState();
              postToPlateau({ type: "SELECT_WORD", wordId: state.selectedWordId });
              startRegieTimer(30);
              renderRegieGrid();
            }
          });
        } else {
          cell.setAttribute("aria-hidden", "true");
        }
      }

      gridEl.appendChild(cell);
    }
  }
}
