import { state, isSingleLetter } from "./state.js";
import { showNumbersForLetter, renderRegieGrid } from "./grid-view.js";
import { isMagicWordCell } from "./magic.js";
import { postToPlateau } from "./bridge.js";

function showRevealWheel(letter) {
  const existing = document.getElementById("revealWheel");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "revealWheel";
  overlay.className = "reveal-wheel";
  const wheel = document.createElement("div");
  wheel.className = "wheel";
  const label = document.createElement("div");
  label.className = "wheel-letter";
  label.textContent = letter;
  wheel.appendChild(label);
  overlay.appendChild(wheel);
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 1600);
}

function setLastRevealedLetter(letter) {
  const el = document.getElementById("lastLetter");
  if (el) el.textContent = `Lettre : ${letter}`;
}

function overrideLetterInput() {
  const old = document.getElementById("letterInput");
  if (!old) return;
  const clone = old.cloneNode(true);
  old.parentNode.replaceChild(clone, old);

  clone.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const typed = clone.value.trim().toUpperCase();
    clone.value = "";

    let letter = typed;
    const valid = isSingleLetter(letter);

    if (!valid) {
      if (!state.grid) return;
      const remaining = [];
      for (const [pos, ltr] of state.grid.letters) {
        if (!state.grid.revealed.get(pos)) remaining.push(ltr);
      }
      if (!remaining.length) return;
      letter = remaining[Math.floor(Math.random() * remaining.length)];
      showRevealWheel(letter);
    }

    setLastRevealedLetter(letter);

    if (state.grid) {
      for (const [pos, ltr] of state.grid.letters) {
        if (ltr === letter && !state.grid.revealed.get(pos) && (!isMagicWordCell(pos) || state.magicSolved)) {
          state.grid.revealed.set(pos, true);
        }
      }
      showNumbersForLetter(letter);
      renderRegieGrid();
    }

    postToPlateau({ type: "REVEAL_LETTER", letter });
  });
}

export function initLetterInput() {
  const input = document.getElementById("letterInput");
  if (!input) return;
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const raw = input.value.trim().toUpperCase();
    input.value = "";

    if (!isSingleLetter(raw)) {
      alert("Merci de taper UNE lettre.");
      return;
    }

    if (state.grid) {
      for (const [pos, letter] of state.grid.letters) {
        if (letter === raw && !state.grid.revealed.get(pos) && (!isMagicWordCell(pos) || state.magicSolved)) {
          state.grid.revealed.set(pos, true);
        }
      }
      showNumbersForLetter(raw);
      renderRegieGrid();
    }

    postToPlateau({ type: "REVEAL_LETTER", letter: raw });
  });

  overrideLetterInput();
}
